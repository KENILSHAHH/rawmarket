#!/usr/bin/env node

/*
 * RawMarket ATS testnet bootstrap.
 *
 * Uses the public ATS v8 API for asset creation and lifecycle operations. The
 * small internal-adapter setup below is the same signer injection used by the
 * upstream SDK integration tests, allowing this non-interactive deployment
 * script to sign with a temporary testnet operator instead of a browser wallet.
 */
require("../web/node_modules/reflect-metadata");

const path = require("node:path");
const {
  SDK,
  LoggerTransports,
  Network,
  Equity,
  Security,
  Role,
  SupportedWallets,
  ConnectRequest,
  CreateEquityRequest,
  RoleRequest,
  IssueRequest,
  CreateHoldByPartitionRequest,
  ReleaseHoldByPartitionRequest,
  RedeemRequest,
} = require("../web/node_modules/@hashgraph/asset-tokenization-sdk");
const { PrivateKey } = require("../web/node_modules/@hashgraph/sdk");
const { Wallet, JsonRpcProvider } = require("../web/node_modules/ethers");

const SDK_ROOT = path.join(
  __dirname,
  "../web/node_modules/@hashgraph/asset-tokenization-sdk/build/cjs/src",
);
const Injectable = require(path.join(SDK_ROOT, "core/injectable/Injectable.js")).default;
const { RPCTransactionAdapter } = require(path.join(
  SDK_ROOT,
  "port/out/rpc/RPCTransactionAdapter.js",
));
const NetworkService = require(path.join(SDK_ROOT, "app/service/network/NetworkService.js")).default;
const { MirrorNodeAdapter } = require(path.join(SDK_ROOT, "port/out/mirror/MirrorNodeAdapter.js"));
const { RPCQueryAdapter } = require(path.join(SDK_ROOT, "port/out/rpc/RPCQueryAdapter.js"));

const FACTORY = "0.0.9213391";
const RESOLVER = "0.0.9212226";
const ELIGIBILITY = "0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2";
const ACCOUNT_ID = process.env.HEDERA_OPERATOR_ID || "0.0.10522153";
const EVM_ADDRESS = process.env.HEDERA_OPERATOR_EVM_ADDRESS || "0xf3591089bfd94760f6da5c9be2833abb0479bb39";
const MIRROR = { name: "hedera-testnet", baseUrl: "https://testnet.mirrornode.hedera.com/api/v1/" };
const RPC = { name: "hashio-testnet", baseUrl: "https://testnet.hashio.io/api" };
const DEFAULT_PARTITION = "0x0000000000000000000000000000000000000000000000000000000000000001";
const EQUITY_CONFIG = "0x0000000000000000000000000000000000000000000000000000000000000001";
const ISSUER_ROLE = "0x5eeaf5602c75bf26e73b5206d0bd6ee82f621166255e5fd73cc06bc7bd84a95f";
const LOCKER_ROLE = "0xd327cd9a2be405896f3d4584b3b437d798833cc4aa0aafb34c870659c0d47184";

function normalizeKey(value) {
  if (!value) throw new Error("HEDERA_OPERATOR_KEY is required");
  return value.startsWith("0x") ? value.slice(2) : value;
}

async function configureSdk(privateKey) {
  SDK.log = { level: "ERROR", transports: new LoggerTransports.Console() };
  // The SDK exposes MetaMask as its RPC signer mode only in browser contexts.
  // Upstream's own non-interactive tests enable the same mode explicitly.
  Injectable.isWeb = () => true;

  const transactionAdapter = Injectable.resolve(RPCTransactionAdapter);
  const networkService = Injectable.resolve(NetworkService);
  const mirrorNodeAdapter = Injectable.resolve(MirrorNodeAdapter);
  const queryAdapter = Injectable.resolve(RPCQueryAdapter);

  mirrorNodeAdapter.set(MIRROR);
  queryAdapter.init();
  networkService.environment = "testnet";
  networkService.configuration = { factoryAddress: FACTORY, resolverAddress: RESOLVER };
  networkService.mirrorNode = MIRROR;
  networkService.rpcNode = RPC;

  await transactionAdapter.init(true);
  await transactionAdapter.register(undefined, true);
  const wallet = new Wallet(privateKey, new JsonRpcProvider(RPC.baseUrl));
  transactionAdapter.setSignerOrProvider(wallet);

  await Network.connect(
    new ConnectRequest({
      account: {
        accountId: ACCOUNT_ID,
        privateKey: PrivateKey.fromStringECDSA(privateKey),
        evmAddress: EVM_ADDRESS,
      },
      network: "testnet",
      wallet: SupportedWallets.METAMASK,
      mirrorNode: MIRROR,
      rpcNode: RPC,
      debug: true,
    }),
  );
  return wallet;
}

async function main() {
  const privateKey = normalizeKey(process.env.HEDERA_OPERATOR_KEY);
  const wallet = await configureSdk(privateKey);

  const created = process.env.ATS_SECURITY_ID
    ? {
        security: { evmDiamondAddress: process.env.ATS_SECURITY_ID },
        transactionId: process.env.ATS_CREATE_TRANSACTION || "already-deployed",
      }
    : await Equity.create(
    new CreateEquityRequest({
      name: "RawMarket Class III Milk Claim",
      symbol: "RMMILK26",
      isin: "USRMILK00027",
      decimals: 0,
      isWhiteList: false,
      erc20VotesActivated: false,
      isControllable: true,
      arePartitionsProtected: false,
      isMultiPartition: false,
      clearingActive: false,
      internalKycActivated: false,
      diamondOwnerAccount: ACCOUNT_ID,
      complianceId: ELIGIBILITY,
      identityRegistryId: ELIGIBILITY,
      votingRight: false,
      informationRight: true,
      liquidationRight: false,
      subscriptionRight: false,
      conversionRight: false,
      redemptionRight: true,
      putRight: false,
      dividendRight: 0,
      currency: "0x555344",
      numberOfShares: "1000000",
      nominalValue: "1",
      nominalValueDecimals: 0,
      regulationType: 1,
      regulationSubType: 0,
      isCountryControlListWhiteList: false,
      countries: "US",
      info: "RawMarket hackathon testnet commodity claim; no monetary value",
      configId: EQUITY_CONFIG,
      configVersion: 1,
    }),
      );

  const securityId = created.security.evmDiamondAddress?.toString?.() || created.security.id?.toString?.();
  if (!securityId) throw new Error("ATS factory returned no security address");

  const roleTransactions = [];
  if (!process.env.ATS_SECURITY_ID) {
    for (const role of [ISSUER_ROLE, LOCKER_ROLE]) {
      roleTransactions.push(
        await Role.grantRole(new RoleRequest({ securityId, targetId: EVM_ADDRESS, role })),
      );
    }
  }

  const issuance = await Security.issue(
    new IssueRequest({ securityId, targetId: EVM_ADDRESS, amount: "1000" }),
  );
  const hold = await Security.createHoldByPartition(
    new CreateHoldByPartitionRequest({
      securityId,
      partitionId: DEFAULT_PARTITION,
      amount: "10",
      escrowId: EVM_ADDRESS,
      targetId: EVM_ADDRESS,
      expirationDate: String(Math.floor(Date.now() / 1000) + 3600),
    }),
  );
  const holdRelease = await Security.releaseHoldByPartition(
    new ReleaseHoldByPartitionRequest({
      securityId,
      partitionId: DEFAULT_PARTITION,
      targetId: EVM_ADDRESS,
      holdId: hold.payload,
      amount: "10",
    }),
  );
  const redemption = await Security.redeem(new RedeemRequest({ securityId, amount: "1" }));

  process.stdout.write(
    `${JSON.stringify(
      {
        sdkVersion: "8.0.0",
        factory: FACTORY,
        resolver: RESOLVER,
        eligibility: ELIGIBILITY,
        asset: created.security,
        transactions: {
          create: created.transactionId,
          roles: roleTransactions.map((entry) => entry.transactionId),
          issue: issuance.transactionId,
          hold: hold.transactionId,
          holdRelease: holdRelease.transactionId,
          redeem: redemption.transactionId,
        },
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
