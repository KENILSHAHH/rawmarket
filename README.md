# RawMarket

RawMarket is a spot trading venue for tokenized representations of US commodity benchmarks. It combines a deterministic Rust central limit order book with a professional Next.js trading terminal and public Hedera testnet evidence.

[Open RawMarket](https://rawmarket-terminal.vercel.app)

The venue is spot-only. Users buy and sell funded inventory through market, limit, and post-only orders. There is no leverage, liquidation engine, perpetual funding rate, or naked short selling.

## Product

The trading terminal provides:

- a unified market selector for US commodity products;
- source-labelled candlestick charts with ranges from 1D to 25Y;
- live bid and ask depth;
- recent matched trades;
- market, limit, and post-only order entry;
- cash and inventory reservation before execution;
- open orders, order history, fills, and balances; and
- clickable Hedera receipts for accepted orders.

Each market keeps its benchmark value, order-book prices, matched trade price, portfolio mark, and final settlement fixing conceptually separate. Market-maker quotes and exchange trades never replace a missing benchmark observation.

## Markets

| Symbol | Benchmark | Quotation unit | Status |
| --- | --- | --- | --- |
| MILK | USDA Class III Milk | USD/cwt | Official historical series integrated |
| POTATO | RawMarket US Russet Potato Index v1 | USD/50 lb carton | Historical/demo pending coverage audit |
| TOMATO | RawMarket US Round Tomato Index v1 | USD/25 lb carton | Historical/demo pending coverage audit |
| WHEAT | RawMarket US Wheat Index v1 | USD/bushel | Historical/demo pending source adapter |
| CORN | RawMarket US Corn Index v1 | USD/bushel | Historical/demo pending source adapter |
| RICE | RawMarket US Rice Index v1 | USD/cwt | Historical/demo pending source adapter |
| SOYBEAN | RawMarket US Soybean Index v1 | USD/bushel | Historical/demo pending source adapter |
| DRY_BEAN | RawMarket US Dry Bean Index v1 | USD/cwt | Historical/demo pending source adapter |

MILK uses the USDA-announced Class III price for the named month. The reference exposure is 2,000 cwt, equivalent to 200,000 pounds.

The produce indices are RawMarket calculations, not official USDA national averages. Compatible observations are normalized by commodity, variety, grade, size, package, origin policy, and shipping-point basis. Each reporting area contributes at most one representative midpoint, and the daily index is the median of eligible area values. The methodology does not treat shipment quantities as prices and does not describe the result as VWAP.

## Architecture

```text
Official USDA publications
          │
          ▼
Deterministic source adapters ──► validated, source-hashed market history
                                              │
                                              ▼
Next.js trading terminal ◄──── REST/TLS ────► Rust CLOB on AWS
                                              │
                                              ▼
                                  Hedera order receipt contract
                                              │
                                  Mirror Node + HashScan evidence

Hedera settlement registry ──► series, oracle sequence, fixing and claim accounting
HTS test assets             ──► public testnet token identities
ATS infrastructure         ──► controlled-asset issuance and lifecycle foundation
```

### Trading terminal

The frontend uses Next.js, React, TypeScript, and TradingView Lightweight Charts. It is deployed on Vercel and communicates with the matching engine over HTTPS. The interface is organized into market summary, chart, order book, recent trades, order entry, portfolio, and methodology components.

### Rust matching engine

The engine uses Tokio and Axum for transport while keeping matching logic isolated from external I/O. Its order books use integer price ticks, whole-number lots, and price-time priority backed by `BTreeMap<PriceTicks, VecDeque<OrderId>>` queues.

The engine supports partial fills, cancellation, immediate-or-cancel market orders, post-only orders, self-trade prevention, idempotent client order IDs, resting-price execution, and monotonic sequence numbers. Cash or inventory is reserved before an order becomes executable so the same balance cannot fund multiple active orders.

The public engine runs as a non-root container on AWS App Runner. Images are built with AWS CodeBuild and stored in private ECR.

### Market data

Source documents and hashes are preserved under `sources/`. Validated history is embedded in the Rust service and served to the chart API without fabricating missing observations.

MILK contains official monthly Class III history from 1990 onward. Its visual bars are fixing-change candles: the previous monthly fixing is the open, the current fixing is the close, and the endpoints determine high and low. They are not represented as intramonth trade OHLC data.

Markets without compatible audited history return an unavailable state instead of displaying synthetic benchmark history.

## Hedera integration

RawMarket uses Hedera in four distinct layers.

### Order receipts

Every accepted user order is submitted by the AWS engine to `RawMarketOrderReceipts` on Hedera testnet. The contract emits an immutable `OrderRecorded` event containing:

- the hashed engine order ID;
- market symbol;
- hashed wallet reference;
- buy or sell direction;
- integer price ticks;
- quantity; and
- engine sequence number.

The engine waits for Hedera consensus, resolves the native transaction ID through Mirror Node, and returns both the EVM hash and Hedera transaction ID to the terminal. The user can open the exact transaction from the order confirmation or Order history in HashScan.

The signer is held by AWS Secrets Manager and injected into the App Runner service at runtime. It is not included in the container image, browser bundle, or repository.

An order receipt proves that the RawMarket engine acknowledged specific order metadata. It is deliberately separate from asset and payment settlement.

### Smart-contract settlement registry

`RawMarketSettlement` stores series identifiers, multipliers, payout caps, expiries, final benchmark values, oracle sequence numbers, finalization state, and claim-accounting records.

The current contract is a testnet registry. It does not yet custody collateral or atomically exchange HTS assets and payment for each engine match. Its existing claim and signature paths are prototype accounting controls, not a production collateral vault or threshold-signature oracle.

### Hedera Token Service

RawMarket has testnet HTS token identities for demo USD and each commodity market. HTS provides native token IDs, treasury and supply controls, mint and burn primitives, transfers, and Mirror Node visibility.

These tokens are development assets. Trading balances in the current terminal remain engine-managed demo balances and are not presented as user-controlled HTS balances.

### Asset Tokenization Studio

RawMarket integrates `@hashgraph/asset-tokenization-sdk` v8.0.0 as its controlled-asset application layer. The testnet bootstrap connects to the official ATS factory and resolver, creates the MILK claim through the factory, grants least-purpose issuer and locker roles, and exercises ERC-1400 issuance by partition, hold, release, and redemption operations.

ERC-3643 transfer eligibility is supplied through the deployed `RawMarketEligibility` identity registry and compliance module. The same allowlist is queried through `isVerified` and `canTransfer`, while ATS remains responsible for enforcing the configured registry and compliance hooks around token operations.

RawMarket supplies the domain-specific components ATS does not provide: commodity benchmark methodology, deterministic matching, reservation accounting, oracle reports, collateral rules, and variable-payoff settlement logic.

The application pins ATS v8.0.0. MILK is the first ATS-issued market asset; the other listed products retain clearly separated plain HTS development tokens until their data audits and ATS issuance are complete. Deployment identifiers and every lifecycle transaction are recorded in `deployments/hedera-testnet.json`.

### Mirror Node and HashScan

Mirror Node is the independent read path used to resolve contract results, native transaction IDs, token metadata, and public ledger evidence. HashScan provides the user-facing explorer for contracts, tokens, events, and individual order receipts.

## Hedera testnet deployments

| Component | Identifier |
| --- | --- |
| Order receipt contract | [`0x2D9e26E2558A527B41C61d753305e28b1D611FF3`](https://hashscan.io/testnet/contract/0x2D9e26E2558A527B41C61d753305e28b1D611FF3) |
| Settlement registry | [`0x553678C79D4F38d0C7b1297824048887059AD7BA`](https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA) |
| Official ATS factory | [`0.0.9213391`](https://hashscan.io/testnet/contract/0.0.9213391) |
| Official ATS resolver | [`0.0.9212226`](https://hashscan.io/testnet/contract/0.0.9212226) |
| ATS-issued MILK claim | [`0.0.10525401`](https://hashscan.io/testnet/contract/0.0.10525401) |
| ERC-3643 identity/compliance module | [`0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2`](https://hashscan.io/testnet/contract/0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2) |
| Demo USD | [`0.0.10522368`](https://hashscan.io/testnet/token/0.0.10522368) |
| MILK | [`0.0.10522374`](https://hashscan.io/testnet/token/0.0.10522374) |
| POTATO | [`0.0.10522375`](https://hashscan.io/testnet/token/0.0.10522375) |
| TOMATO | [`0.0.10522376`](https://hashscan.io/testnet/token/0.0.10522376) |
| WHEAT | [`0.0.10522378`](https://hashscan.io/testnet/token/0.0.10522378) |
| CORN | [`0.0.10522379`](https://hashscan.io/testnet/token/0.0.10522379) |
| RICE | [`0.0.10522380`](https://hashscan.io/testnet/token/0.0.10522380) |
| SOYBEAN | [`0.0.10522381`](https://hashscan.io/testnet/token/0.0.10522381) |
| DRY BEAN | [`0.0.10522382`](https://hashscan.io/testnet/token/0.0.10522382) |

The machine-readable deployment record is maintained in `deployments/hedera-testnet.json`.

The MILK lifecycle can be independently inspected on HashScan: [factory issuance](https://hashscan.io/testnet/transaction/0.0.7314364@1789314423.485781604), [partition issuance](https://hashscan.io/testnet/transaction/0.0.7314364@1789314855.741729447), [hold](https://hashscan.io/testnet/transaction/0.0.7314364@1789314878.831695254), [release](https://hashscan.io/testnet/transaction/0.0.7314364@1789314898.959775823), and [redemption](https://hashscan.io/testnet/transaction/0.0.7314364@1789314918.105998928).

## Repository structure

```text
rawmarket/
├── engine/          Rust matching engine, account state, market data, and Hedera writer
├── web/             Next.js trading terminal
├── contracts/       Order receipt and settlement contracts
├── deployments/     Hedera testnet identifiers
├── sources/         Archived market-data evidence and hashes
├── scripts/         Deterministic data importers
└── infra/           AWS deployment infrastructure
```

RawMarket’s trust boundary is explicit: the Rust engine determines order priority and matches, Hedera records public order evidence and contract state, and official source publications determine benchmark values. None of those layers is silently substituted for another.
