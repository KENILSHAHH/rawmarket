# RawMarket

### A Hedera-native spot venue for transparent US commodity markets

RawMarket is a hackathon MVP for trading spot representations of US commodity benchmarks through a deterministic Rust central limit order book, with Hedera used for token issuance, public settlement records, and the security-token infrastructure layer.

The product is designed in the style of a modern professional trading terminal: a market selector, source-backed charts, live order books, a spot order ticket, balances, positions, and settlement evidence. It is intentionally spot-only: there is no leverage, no liquidation engine, no naked shorting, and no perpetual contract.

> **Important status note**
>
> The Rust CLOB and UI are functional. A RawMarket settlement contract, eight series, and interim HTS test tokens are deployed on Hedera testnet. The pinned ATS deployment is partially complete: the BLR infrastructure and 28 of 108 facets have deployed, but the ATS factory/configuration and ATS-issued market assets are not yet complete because the operator account needs more testnet HBAR. The repository records this honestly and does not present plain HTS tokens as ATS security tokens.

## Live deployment

- Trading terminal: [rawmarket-terminal.vercel.app](https://rawmarket-terminal.vercel.app)
- Rust matching engine: [qr87wwmycq.us-east-1.awsapprunner.com](https://qr87wwmycq.us-east-1.awsapprunner.com)
- Engine health: [qr87wwmycq.us-east-1.awsapprunner.com/health](https://qr87wwmycq.us-east-1.awsapprunner.com/health)

The engine runs as a non-root Linux container on AWS App Runner. AWS CodeBuild performs the reproducible x86-64 image build, stores the image in private ECR, and App Runner supplies the public TLS endpoint and health checks. The Vercel production build is configured with this endpoint through `NEXT_PUBLIC_ENGINE_URL`.

This is a public hackathon demo service. Its balances and order state are currently in memory and reset when App Runner replaces the container. Authentication, durable command persistence, multi-instance coordination, rate limiting, and Hedera-backed settlement remain required before production use.

## What the product does

RawMarket presents one US-facing market family for each product, with no state-specific or city-specific trading screens. The initial catalog is:

| Symbol | Product | Quotation unit | Data status |
| --- | --- | --- | --- |
| MILK | US Class III Milk | USD/cwt | One verified USDA fixing captured; live history gate pending |
| POTATO | RawMarket US Russet Potato Index v1 | USD/50 lb carton | Historical/demo until the 90-day audit passes |
| TOMATO | RawMarket US Round Tomato Index v1 | USD/25 lb carton | Historical/demo until the 90-day audit passes |
| WHEAT | RawMarket US Wheat Index v1 | USD/bushel | Historical/demo; source adapter gate pending |
| CORN | RawMarket US Corn Index v1 | USD/bushel | Historical/demo; source adapter gate pending |
| RICE | RawMarket US Rice Index v1 | USD/cwt | Historical/demo; source adapter gate pending |
| SOYBEAN | RawMarket US Soybean Index v1 | USD/bushel | Historical/demo; source adapter gate pending |
| DRY_BEAN | RawMarket US Dry Bean Index v1 | USD/cwt | Historical/demo; source adapter gate pending |

The user can connect the demo wallet, receive demo USD, view depth, and place buy or sell spot limit orders. A sell order requires inventory; the engine does not permit an unfunded short sale.

The public terminal now runs on Next.js 16 and React 19. Each browser receives a persistent demo identity, can claim test funds once per engine session, execute immediate-or-cancel market orders against the displayed book, rest post-only or ordinary limit orders, inspect personal fills and open orders, and cancel orders with reservation release. These are real commands against the AWS-hosted Rust engine, while the balances remain explicitly labelled demo balances rather than user-controlled HTS funds.

## Product flow

```text
USDA publication
      │
      ▼
Deterministic source adapter ──► validated benchmark / OHLC candle
      │                                  │
      ▼                                  ▼
Signed oracle report              trading terminal
      │                                  │
      ▼                                  ▼
Hedera verifier + settlement ◄── Rust price-time CLOB
      │
      ▼
HTS / ATS asset ownership and public Hedera evidence
```

### 1. Discover a market

The terminal shows the symbol, unit, reference price, mark, expiry, market status, and spot mode. The UI separates:

- the benchmark/reference value;
- the order-book bid and ask;
- the last settled trade;
- the portfolio mark; and
- the final settlement fixing.

These values are not interchangeable.

### 2. Inspect verified price data

Charts are OHLC candlesticks, not generated curves. Timeframe controls are available for 1D, 1W, 1M, 1Y, 5Y, and 25Y. Missing source history is shown as **No verified candles**. RawMarket does not fill an empty chart with synthetic history or market-maker quotes.

The current MILK fixture is one USDA Class III announcement dated 2026-09-02. It is therefore displayed as one verified candle, not as a fabricated historical series.

### 3. Trade spot inventory

The order ticket supports:

- buy and sell;
- market and limit order modes in the UI;
- integer quantity lots;
- price and order-value preview;
- cash and inventory checks; and
- reservation before an order becomes executable.

The current Rust demo transport uses a `SPOT` book for each symbol. The CLOB has seven seeded bid levels and seven seeded ask levels per market so the terminal is usable during the demo. These levels are explicitly demo market-maker liquidity and are not reported as real market volume.

## Market specifications

### MILK

- Benchmark: USDA-announced Class III milk price for the named month.
- Quote: USD per hundredweight.
- Contract reference exposure: 2,000 cwt / 200,000 pounds.
- Source evidence: CME Class III specifications and the USDA Class and Component Prices report.
- No substitution with Class I, Class II, Class IV, retail milk, or a previous month is permitted.

### POTATO

- Benchmark: RawMarket US Russet Potato Index v1.
- Source: USDA National Potato and Onion Report, cross-checked with the National FOB Review where useful.
- Eligible observation: Russet Norkotah, U.S. One, 70-count, 50-pound cartons.
- Quote: USD per 50-pound carton.
- Contract reference size: one 50-pound carton equivalent.
- Onion records and incompatible grades, sizes, packages, and products are excluded.

### TOMATO

- Benchmark: RawMarket US Round Tomato Index v1.
- Source: USDA National FOB Review, cross-checked with Tomato Fax.
- Eligible observation: round mature-green tomatoes, 85% U.S. One or Better, 5x6, 25-pound cartons loose.
- Quote: USD per 25-pound carton.
- Contract reference size: one 25-pound carton equivalent.
- Roma, cherry, grape, vine-ripe, and incompatible grade or size records are excluded.

The produce indices are RawMarket calculations, not official USDA national averages. For each eligible observation, the adapter uses the midpoint of the reported “mostly” range, otherwise the midpoint of the ordinary range, or a single reported price. Missing prices, non-price text, shipment quantities, and incompatible records are excluded. One representative value is retained per reporting area, and the daily composite is the median of those area values. This is not called VWAP.

Before a product is promoted from historical/demo mode, the pipeline must pass a 90-day audit covering coverage, stale records, revisions, seasonality, missing days, and specification consistency.

## Rust matching engine

The matching core is intentionally deterministic and isolated from network I/O.

Core properties:

- integer price ticks and quantity lots;
- checked arithmetic at the matching boundary;
- price-time priority;
- `BTreeMap<PriceTicks, VecDeque<OrderId>>` book structure;
- immediate-or-cancel market orders that never leave an unfilled remainder resting;
- distinct open, partially filled, filled, cancelled, and expired states;
- one-time process-local test funding and wallet-specific order/fill retrieval;
- order lookup for cancellation and state changes;
- limit orders, partial fills, cancellation, and post-only intent;
- self-trade prevention;
- idempotent client order IDs;
- monotonic engine sequence numbers;
- execution at the resting order’s price; and
- explicit order states for accepted, open, filled, cancelled, and rejected commands.

The current MVP process keeps accounts and books in memory. The next production step is durable command logging, reservations, snapshots, deterministic replay, and reconciliation against confirmed Hedera transactions. The current demo CLOB must not be confused with a production exchange clearing system.

## Oracle and benchmark integrity

RawMarket does not assume a Chainlink or Pyth feed for these commodities. The intended oracle path is:

1. capture the official USDA publication;
2. preserve the exact source document and SHA-256 hash;
3. parse it with a deterministic adapter;
4. validate unit, period, freshness, coverage, revisions, and sequence;
5. produce a signed report with methodology and evidence metadata;
6. verify the report on Hedera; and
7. allow settlement only against a valid final report.

A signed report includes the benchmark and series IDs, price and decimals, currency and quotation unit, observation period, publication and ingestion timestamps, methodology version, source-document hashes, constituent count, quality status, and a unique sequence/report identifier.

Multiple relayers can protect delivery of the same USDA publication, but they do not create multiple independent underlying price sources. A single-operator demo must be disclosed as such.

## How Hedera is used

### Hedera Smart Contract Service / EVM relay

RawMarket’s settlement extension is a Solidity contract deployed through Hedera’s EVM-compatible JSON-RPC relay. It stores:

- series identifiers;
- multipliers and payout caps;
- expiry timestamps;
- finalization status;
- final benchmark values;
- oracle sequence numbers; and
- claimable settlement amounts.

The eight RawMarket series have been created in the deployed contract. The contract is not a replacement for ATS: it is the application-specific collateral, oracle, and settlement extension around the asset infrastructure.

### Hedera Token Service

The testnet deployment also created interim fungible HTS tokens for demo USD and the eight spot assets. HTS supplies the native token ledger primitives: token IDs, treasury ownership, supply keys, mint/burn authority, transfers, and mirror-node visibility.

These are currently plain HTS test tokens. They are recorded for testnet experimentation but are not claimed to be ATS-issued regulated/security assets.

### Asset Tokenization Studio

ATS is the intended tokenization layer for the production-shaped path. It provides the security-token infrastructure around ERC-1400/partial ERC-3643-style controls, including:

- asset/factory deployment;
- ownership and transfer controls;
- compliance and eligibility hooks;
- holds and controlled transfers;
- mint and burn roles;
- partition-aware operations; and
- redemption/lifecycle capabilities.

RawMarket adds the commodity-specific logic that ATS does not provide by itself: benchmark fixing, collateral accounting, variable payoff, oracle verification, and order-book integration.

The pinned ATS deployment has started on testnet. The BLR proxy, ProxyAdmin, deployment libraries, and the first 28 facets are deployed. The remaining facets, factory, configuration, and ATS-issued commodity assets require additional testnet HBAR and a resumed deployment checkpoint.

### Mirror Node and public evidence

Hedera’s Mirror Node is the read path for balances, token metadata, contract activity, transaction confirmation, and audit evidence. HashScan provides a human-readable verification surface for the deployed contract and later ATS assets.

## Why Hedera is a strong fit

RawMarket could be implemented on other chains, so “only possible with Hedera” should be understood as a product-design advantage rather than a literal impossibility. Hedera is particularly well suited because the complete design can use native services instead of assembling every ledger primitive from third-party contracts:

1. **HTS gives commodity and cash balances first-class token identities.** The product can show a Hedera token ID and mirror-node balance rather than representing every asset as an opaque database row.
2. **EVM compatibility allows Solidity settlement logic.** The same deployment can use familiar Solidity tooling while benefiting from Hedera’s network and explorer ecosystem.
3. **ATS adds security-token controls instead of forcing RawMarket to recreate them.** Compliance, controlled transfers, holds, roles, and lifecycle operations belong in a tokenization platform rather than in the Rust matcher.
4. **Fast finality is useful for exchange reconciliation.** The engine can separate matching acknowledgement from confirmed Hedera settlement and reconcile by unique transaction ID.
5. **Mirror Node APIs make evidence queryable.** A user can inspect token ownership, transaction status, and contract events without trusting a private exchange database.
6. **HCS is a natural future extension for oracle evidence.** Source hashes, signed fixing reports, and correction/dispute notices can be timestamped on a Hedera topic while the settlement contract verifies the final report.
7. **Native account, token, and contract identifiers create a clear audit boundary.** Users can distinguish an order-book event from an on-chain transfer and from the final oracle fixing.

The important architectural point is that Hedera does not magically turn an exchange into a compliant financial product. ATS is security-token infrastructure, HTS is a token service, and the RawMarket contracts still need careful collateral, oracle, eligibility, and administrative-role design.

## Testnet deployment artifacts

The public deployment record is [`deployments/hedera-testnet.json`](deployments/hedera-testnet.json).

| Component | Public identifier | Status |
| --- | --- | --- |
| RawMarket settlement contract | `0x553678C79D4F38d0C7b1297824048887059AD7BA` | Deployed |
| Deployment transaction | `0xdd3859b55287b28c7e297af0ea37a22ad6f75827236162c060af73db279d4544` | Confirmed |
| Demo USD | `0.0.10522368` | Plain HTS interim token |
| MILK spot token | `0.0.10522374` | Plain HTS interim token |
| POTATO spot token | `0.0.10522375` | Plain HTS interim token |
| TOMATO spot token | `0.0.10522376` | Plain HTS interim token |
| WHEAT spot token | `0.0.10522378` | Plain HTS interim token |
| CORN spot token | `0.0.10522379` | Plain HTS interim token |
| RICE spot token | `0.0.10522380` | Plain HTS interim token |
| SOYBEAN spot token | `0.0.10522381` | Plain HTS interim token |
| DRY BEAN spot token | `0.0.10522382` | Plain HTS interim token |
| ATS BLR proxy | `0xf0433BeF9a0838323D57b4a6cbE6976CE66A0A26` | Partial deployment |

View the settlement contract on [HashScan testnet](https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA).

## Run locally

### Rust engine

```bash
cargo run --manifest-path engine/Cargo.toml
```

The engine listens on `http://localhost:8080`.

### Web terminal

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The current local UI uses the demo wallet and Rust API. It does not yet sign HashPack/MetaMask transactions or spend a user’s Hedera account. Testnet IDs shown in the deployment record are public evidence, not a claim that the local order ticket has already been fully wired to them.

## Verification

```bash
cargo test --manifest-path engine/Cargo.toml
npm --prefix web run build
```

Programmatic trading documentation is in [`docs/API.md`](docs/API.md), with the machine-readable contract in [`docs/openapi.yaml`](docs/openapi.yaml).

Useful endpoints:

```text
GET  /health
GET  /api/markets
GET  /api/book/{symbol}/SPOT
GET  /api/trades/{symbol}/SPOT
GET  /api/candles/{symbol}/{interval}
POST /api/fund
POST /api/orders
DELETE /api/orders/{id}
```

## What remains before calling it live

The next required work is not cosmetic:

- resume and complete the ATS deployment from checkpoint `hedera-testnet-2026-09-13T11-39-30-743`;
- deploy the ATS factory/configuration and issue the commodity assets through ATS;
- create the collateral vault with actual token transfers and allowance/hold checks;
- replace the demo wallet with HashPack/MetaMask signing;
- bind CLOB reservations to confirmed HTS/ATS balances;
- implement settlement transaction submission, confirmation, replay protection, and unknown-transaction reconciliation;
- implement threshold-signed oracle reports and finalization rules;
- persist engine commands and snapshots;
- expose token IDs and transaction IDs in the UI;
- add eligibility revocation and ATS hold behavior tests; and
- complete the 90-day data audits before promoting produce and grain markets.

Until those items are complete, RawMarket is a functional Hedera testnet hackathon MVP and not a live regulated exchange or investment product.

## Security notes

- Never commit operator keys or `.env.local`; these paths are gitignored.
- The operator key used for the testnet deployment was exposed during development and should be rotated before any serious testing.
- Testnet tokens have no monetary value, but private-key hygiene still matters.
- Do not use demo market-maker depth as evidence of real liquidity.
- Do not use historical/demo benchmark values for financial settlement.
- Administrative powers, ATS roles, oracle signers, and collateral custody must be minimized and documented before production use.

## Repository structure

```text
rawmarket/
├── engine/                         Rust matching engine and Axum API
├── web/                            Next.js trading terminal
├── contracts/                      RawMarket settlement extension
├── deployments/                    Public Hedera testnet IDs and status
└── sources/                        Archived source documents and hashes
```

## License and disclaimer

This repository is a hackathon prototype. It is not investment advice, a futures exchange, a broker, a clearinghouse, or a regulated offering. Commodity references are methodology-defined benchmarks, and all testnet balances and tokens are experimental.
