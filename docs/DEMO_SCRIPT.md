# RawMarket — three-minute product demo

## 0:00–0:25 — Product

**On screen:** Open RawMarket with MILK/USD selected.

“RawMarket is a spot exchange for tokenized US commodity benchmarks. It combines a professional trading terminal, a deterministic Rust order book, verified public price history, and Hedera-native asset controls. There is no leverage or naked shorting: every sell must be backed by inventory.”

## 0:25–0:50 — Market data

**On screen:** Show the MILK chart, change the time range, and point to the source label.

“This market follows the USDA Class III Milk benchmark in dollars per hundredweight. The chart uses archived official monthly observations rather than generated prices. RawMarket keeps the external benchmark, order-book bid and ask, matched trade price, and settlement value separate.”

## 0:50–1:15 — Architecture

**On screen:** Show market depth and the order ticket.

“The frontend is built with Next.js and TradingView Lightweight Charts. Orders are sent to a Rust Axum matching engine on AWS. The CLOB uses integer ticks, whole lots, price-time priority, balance reservations, partial fills, post-only orders, cancellation, self-trade prevention, and idempotent client order IDs.”

## 1:15–1:55 — ATS asset and compliance

**On screen:** Open the selected asset’s Hedera panel and its HashScan links.

“The commodity asset is issued through Hedera Asset Tokenization Studio using the official SDK. ATS gives the asset its ERC-1400 lifecycle and partition-aware controls. ERC-3643 support connects an identity registry and compliance module, so eligibility is checked as part of controlled transfer operations rather than being a label in our database.”

“The same asset exposes hold and redemption operations. A hold reserves owned units without changing beneficial ownership, and redemption removes settled units through the governed token lifecycle. These controls are provided by ATS; RawMarket adds the commodity methodology and exchange workflow.”

## 1:55–2:35 — Place and verify an order

**On screen:** Fund the test account, place a MILK limit or market order, then open Order history.

“I’ll place an order against the live Rust book. The engine validates available cash or inventory and executes at the resting price. After accepting the order, it writes an immutable receipt to Hedera containing the hashed order ID, market, side, integer price, quantity, and engine sequence.”

**On screen:** Click the Hedera receipt in Order history.

“The returned native transaction ID opens the exact successful transaction in HashScan. Mirror Node independently exposes the contract result and emitted event, so this acknowledgement is publicly verifiable.”

## 2:35–2:55 — Position lifecycle

**On screen:** Show the ATS partition balance, hold status, transfer eligibility, and redemption transaction.

"For the deployed asset lifecycle, RawMarket uses ATS partition operations and ERC-3643 eligibility. The interface distinguishes an order acknowledgement from asset settlement, and exposes the corresponding Hedera transaction IDs instead of treating an off-chain match as final."

## 2:55–3:00 — Close

**On screen:** Return to the terminal overview.

“RawMarket brings transparent commodity data, deterministic exchange execution, and governed Hedera tokenization into one auditable trading venue.”

The ATS asset, identity registry, compliance module, partition issuance, hold, release, and redemption transactions are confirmed in `deployments/hedera-testnet.json`.
