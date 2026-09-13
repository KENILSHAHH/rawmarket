#!/usr/bin/env bash
set -euo pipefail

AWS_REGION="${AWS_REGION:-us-east-1}"
SERVICE_NAME="${SERVICE_NAME:-rawmarket-engine}"
ECR_REPOSITORY="${ECR_REPOSITORY:-rawmarket-engine}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENGINE_DIR="$ROOT_DIR/engine"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
BUILD_BUCKET="rawmarket-build-$AWS_ACCOUNT_ID-$AWS_REGION"
SOURCE_KEY="engine/source.zip"
CODEBUILD_ROLE="rawmarket-codebuild-role"
CODEBUILD_PROJECT="rawmarket-engine-build"
APPRUNNER_ROLE="rawmarket-apprunner-ecr-role"
IMAGE_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY:$IMAGE_TAG"

if ! aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPOSITORY" >/dev/null 2>&1; then
  aws ecr create-repository --region "$AWS_REGION" --repository-name "$ECR_REPOSITORY" --image-scanning-configuration scanOnPush=true >/dev/null
fi

if ! aws s3api head-bucket --bucket "$BUILD_BUCKET" >/dev/null 2>&1; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUILD_BUCKET" --region "$AWS_REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUILD_BUCKET" --region "$AWS_REGION" --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
fi

SOURCE_ZIP="$(mktemp -t rawmarket-engine-source).zip"
trap 'rm -f "$SOURCE_ZIP"' EXIT
(cd "$ENGINE_DIR" && zip -q -r "$SOURCE_ZIP" Cargo.toml Cargo.lock src data Dockerfile .dockerignore buildspec.yml)
aws s3 cp "$SOURCE_ZIP" "s3://$BUILD_BUCKET/$SOURCE_KEY" --region "$AWS_REGION" >/dev/null

CODEBUILD_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name "$CODEBUILD_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$CODEBUILD_ROLE" --assume-role-policy-document "$CODEBUILD_TRUST" >/dev/null
fi
CODEBUILD_POLICY="{\"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Action\":[\"logs:CreateLogGroup\",\"logs:CreateLogStream\",\"logs:PutLogEvents\"],\"Resource\":\"*\"},{\"Effect\":\"Allow\",\"Action\":[\"s3:GetObject\",\"s3:GetObjectVersion\",\"s3:PutObject\"],\"Resource\":\"arn:aws:s3:::$BUILD_BUCKET/*\"},{\"Effect\":\"Allow\",\"Action\":[\"ecr:GetAuthorizationToken\"],\"Resource\":\"*\"},{\"Effect\":\"Allow\",\"Action\":[\"ecr:BatchCheckLayerAvailability\",\"ecr:GetDownloadUrlForLayer\",\"ecr:BatchGetImage\",\"ecr:InitiateLayerUpload\",\"ecr:UploadLayerPart\",\"ecr:CompleteLayerUpload\",\"ecr:PutImage\"],\"Resource\":\"arn:aws:ecr:$AWS_REGION:$AWS_ACCOUNT_ID:repository/$ECR_REPOSITORY\"}]}"
aws iam put-role-policy --role-name "$CODEBUILD_ROLE" --policy-name rawmarket-engine-build --policy-document "$CODEBUILD_POLICY"
CODEBUILD_ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$CODEBUILD_ROLE"
sleep 10

PROJECT_JSON="$(mktemp -t rawmarket-codebuild).json"
trap 'rm -f "$SOURCE_ZIP" "$PROJECT_JSON"' EXIT
cat >"$PROJECT_JSON" <<JSON
{
  "name": "$CODEBUILD_PROJECT",
  "source": {"type": "S3", "location": "$BUILD_BUCKET/$SOURCE_KEY", "buildspec": "buildspec.yml"},
  "artifacts": {"type": "NO_ARTIFACTS"},
  "environment": {
    "type": "LINUX_CONTAINER",
    "computeType": "BUILD_GENERAL1_SMALL",
    "image": "aws/codebuild/standard:7.0",
    "privilegedMode": true,
    "environmentVariables": [
      {"name": "AWS_ACCOUNT_ID", "value": "$AWS_ACCOUNT_ID"},
      {"name": "ECR_REPOSITORY", "value": "$ECR_REPOSITORY"},
      {"name": "IMAGE_TAG", "value": "$IMAGE_TAG"}
    ]
  },
  "serviceRole": "$CODEBUILD_ROLE_ARN"
}
JSON
if aws codebuild batch-get-projects --region "$AWS_REGION" --names "$CODEBUILD_PROJECT" --query 'projects[0].name' --output text 2>/dev/null | grep -q "$CODEBUILD_PROJECT"; then
  aws codebuild update-project --region "$AWS_REGION" --cli-input-json "file://$PROJECT_JSON" >/dev/null
else
  aws codebuild create-project --region "$AWS_REGION" --cli-input-json "file://$PROJECT_JSON" >/dev/null
fi

BUILD_ID="$(aws codebuild start-build --region "$AWS_REGION" --project-name "$CODEBUILD_PROJECT" --query 'build.id' --output text)"
while true; do
  BUILD_STATUS="$(aws codebuild batch-get-builds --region "$AWS_REGION" --ids "$BUILD_ID" --query 'builds[0].buildStatus' --output text)"
  case "$BUILD_STATUS" in
    SUCCEEDED) break ;;
    FAILED|FAULT|STOPPED|TIMED_OUT)
      aws codebuild batch-get-builds --region "$AWS_REGION" --ids "$BUILD_ID" --query 'builds[0].logs.deepLink' --output text
      exit 1
      ;;
  esac
  sleep 10
done

APPRUNNER_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
if ! aws iam get-role --role-name "$APPRUNNER_ROLE" >/dev/null 2>&1; then
  aws iam create-role --role-name "$APPRUNNER_ROLE" --assume-role-policy-document "$APPRUNNER_TRUST" >/dev/null
fi
aws iam attach-role-policy --role-name "$APPRUNNER_ROLE" --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess
APPRUNNER_ROLE_ARN="arn:aws:iam::$AWS_ACCOUNT_ID:role/$APPRUNNER_ROLE"
sleep 10

SOURCE_CONFIG="{\"ImageRepository\":{\"ImageIdentifier\":\"$IMAGE_URI\",\"ImageRepositoryType\":\"ECR\",\"ImageConfiguration\":{\"Port\":\"8080\"}},\"AutoDeploymentsEnabled\":false,\"AuthenticationConfiguration\":{\"AccessRoleArn\":\"$APPRUNNER_ROLE_ARN\"}}"
SERVICE_ARN="$(aws apprunner list-services --region "$AWS_REGION" --query "ServiceSummaryList[?ServiceName=='$SERVICE_NAME'].ServiceArn | [0]" --output text)"
if [[ "$SERVICE_ARN" == "None" ]]; then
  SERVICE_ARN="$(aws apprunner create-service --region "$AWS_REGION" --service-name "$SERVICE_NAME" --source-configuration "$SOURCE_CONFIG" --health-check-configuration 'Protocol=HTTP,Path=/health,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5' --instance-configuration 'Cpu=0.25 vCPU,Memory=0.5 GB' --query 'Service.ServiceArn' --output text)"
else
  aws apprunner update-service --region "$AWS_REGION" --service-arn "$SERVICE_ARN" --source-configuration "$SOURCE_CONFIG" >/dev/null
fi

while true; do
  SERVICE_STATUS="$(aws apprunner describe-service --region "$AWS_REGION" --service-arn "$SERVICE_ARN" --query 'Service.Status' --output text)"
  case "$SERVICE_STATUS" in
    RUNNING) break ;;
    CREATE_FAILED|DELETE_FAILED|UPDATE_FAILED)
      printf 'App Runner service entered failure state: %s\n' "$SERVICE_STATUS" >&2
      exit 1
      ;;
  esac
  sleep 10
done

SERVICE_URL="$(aws apprunner describe-service --region "$AWS_REGION" --service-arn "$SERVICE_ARN" --query 'Service.ServiceUrl' --output text)"
printf 'https://%s\n' "$SERVICE_URL"
