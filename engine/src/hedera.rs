use alloy::{
    primitives::{keccak256, Address, FixedBytes, U256},
    providers::ProviderBuilder,
    signers::local::PrivateKeySigner,
    sol,
};
use serde::Deserialize;

sol! {
    #[sol(rpc)]
    contract RawMarketOrderReceipts {
        function recordOrder(
            bytes32 orderId,
            bytes32 symbol,
            bytes32 walletRef,
            bool isBuy,
            uint256 priceTicks,
            uint256 quantity,
            uint64 engineSequence
        ) external;
    }
}

#[derive(Clone)]
pub struct ReceiptWriter {
    rpc_url: String,
    contract: Address,
    private_key: String,
}

impl ReceiptWriter {
    pub fn from_env() -> Option<Self> {
        let private_key = std::env::var("HEDERA_OPERATOR_KEY").ok()?;
        let contract = std::env::var("HEDERA_RECEIPT_CONTRACT")
            .ok()?
            .parse()
            .ok()?;
        Some(Self {
            rpc_url: std::env::var("HEDERA_RPC_URL")
                .unwrap_or_else(|_| "https://testnet.hashio.io/api".into()),
            contract,
            private_key,
        })
    }

    pub async fn record_order(&self, order: OrderReceipt<'_>) -> Result<RecordedReceipt, String> {
        let signer: PrivateKeySigner = self
            .private_key
            .parse()
            .map_err(|error| format!("invalid Hedera operator key: {error}"))?;
        let rpc_url = self
            .rpc_url
            .parse()
            .map_err(|error| format!("invalid Hedera RPC URL: {error}"))?;
        let provider = ProviderBuilder::new().wallet(signer).connect_http(rpc_url);
        let contract = RawMarketOrderReceipts::new(self.contract, provider);

        let pending = contract
            .recordOrder(
                keccak256(order.order_id.as_bytes()),
                ascii_bytes32(order.symbol)?,
                keccak256(order.wallet.as_bytes()),
                order.is_buy,
                U256::from(order.price_ticks),
                U256::from(order.quantity),
                order.engine_sequence,
            )
            .send()
            .await
            .map_err(|error| format!("Hedera submission failed: {error}"))?;
        let receipt = pending
            .get_receipt()
            .await
            .map_err(|error| format!("Hedera receipt failed: {error}"))?;
        let transaction_hash = format!("{:#x}", receipt.transaction_hash);
        let transaction_id = resolve_transaction_id(&transaction_hash).await.ok();
        Ok(RecordedReceipt {
            transaction_hash,
            transaction_id,
        })
    }
}

pub struct RecordedReceipt {
    pub transaction_hash: String,
    pub transaction_id: Option<String>,
}

#[derive(Deserialize)]
struct ContractResult {
    timestamp: String,
}

#[derive(Deserialize)]
struct MirrorTransaction {
    transaction_id: String,
}

#[derive(Deserialize)]
struct MirrorTransactions {
    transactions: Vec<MirrorTransaction>,
}

async fn resolve_transaction_id(hash: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let result = client
        .get(format!(
            "https://testnet.mirrornode.hedera.com/api/v1/contracts/results/{hash}"
        ))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<ContractResult>()
        .await
        .map_err(|error| error.to_string())?;
    let transactions = client
        .get(format!(
            "https://testnet.mirrornode.hedera.com/api/v1/transactions?timestamp={}",
            result.timestamp
        ))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<MirrorTransactions>()
        .await
        .map_err(|error| error.to_string())?;
    transactions
        .transactions
        .into_iter()
        .next()
        .map(|transaction| hashscan_transaction_id(&transaction.transaction_id))
        .ok_or_else(|| "Hedera transaction ID not indexed yet".into())
}

fn hashscan_transaction_id(value: &str) -> String {
    let parts: Vec<_> = value.split('-').collect();
    if parts.len() == 3 {
        format!("{}@{}.{}", parts[0], parts[1], parts[2])
    } else {
        value.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::hashscan_transaction_id;

    #[test]
    fn converts_mirror_node_id_for_hashscan() {
        assert_eq!(
            hashscan_transaction_id("0.0.7314364-1789311435-571365944"),
            "0.0.7314364@1789311435.571365944"
        );
    }
}

pub struct OrderReceipt<'a> {
    pub order_id: &'a str,
    pub symbol: &'a str,
    pub wallet: &'a str,
    pub is_buy: bool,
    pub price_ticks: u64,
    pub quantity: u64,
    pub engine_sequence: u64,
}

fn ascii_bytes32(value: &str) -> Result<FixedBytes<32>, String> {
    let bytes = value.as_bytes();
    if bytes.len() > 32 {
        return Err("symbol exceeds bytes32".into());
    }
    let mut output = [0_u8; 32];
    output[..bytes.len()].copy_from_slice(bytes);
    Ok(output.into())
}
