# RawMarket

RawMarket is a Hedera testnet hackathon MVP for fully-funded, capped commodity-linked notes. The first production-shaped path is MILK; POTATO, TOMATO, WHEAT, CORN, RICE, SOYBEAN, and DRY_BEAN share the same deterministic Rust CLOB and remain clearly marked historical/demo until their source coverage gates pass.

## Run

```bash
cargo run --manifest-path engine/Cargo.toml
cd web && npm install && npm run dev
```

Open http://localhost:3000. The UI uses a demo wallet and demo USD until Hedera testnet credentials and deployed contract IDs are configured.

## Truthfulness boundary

No Chainlink/Pyth feed is assumed. The oracle pipeline is source-document -> deterministic adapter -> signed report -> Hedera verifier -> settlement. The checked-in `sources/manifest.json` records exact source URLs and hashes captured on 2026-09-13. USDA report availability varies by product, so non-MILK markets are not presented as live until the 90-day audit is complete.

Charts are source-backed OHLC candles, not generated curves. The current MILK fixture contains one verified USDA Class III observation dated 2026-09-02, so it is shown as a single candle. The 1D, 1W, 1M, 1Y, 5Y, and 25Y controls never fabricate missing history; unsupported ranges display no verified candles.

## Contract model

Each series has a cap C and multiplier m. A long and complementary short are fully collateralized by m*C USD. At expiry: `long=m*clamp(S,0,C)` and `short=m*(C-clamp(S,0,C))`.

## Hedera / ATS

`contracts/RawMarketSettlement.sol` is deployed on Hedera testnet at `0x553678C79D4F38d0C7b1297824048887059AD7BA`; the deployment transaction and eight on-chain series are recorded in [`deployments/hedera-testnet.json`](/Users/kenilshah/Desktop/code/rawmarket/deployments/hedera-testnet.json). ATS is pinned to commit `be4f860e408ec5b1a24d12feb6f872aabff69319` in `sources/manifest.json`, but ATS factory/resolver deployment and HTS token issuance are still pending and are not claimed as complete.

## Verification

```bash
cargo test --manifest-path engine/Cargo.toml
npm --prefix web run build
```
