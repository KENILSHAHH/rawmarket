# ETHGlobal ETHOnline 2026 submission

## Project name

RawMarket

## Short description

Trade tokenized US commodity benchmarks through a Rust order book and Hedera.

_77 characters including spaces._

## Description

RawMarket is a 24/7 spot trading venue for transparent, tokenized US commodity benchmark assets. It gives commodities such as Class III milk, Russet potatoes, round tomatoes, wheat, corn, rice, soybeans and dry beans a professional exchange interface with visible bid/ask depth, source-labelled candlestick data, market and limit orders, cash reservations, inventory controls, personal fills and cancellable open orders.

The core product principle is that reference data and trading data must never be confused. RawMarket keeps the official or methodology-defined benchmark, order-book bid and ask, last engine-confirmed fill, portfolio mark and final settlement fixing separate. Missing USDA observations remain visibly missing; the interface never draws synthetic history or substitutes a market-maker quote for a benchmark.

The public demo is live. Its Next.js terminal sends real order commands to a Rust central limit order book running on AWS. The Hedera testnet deployment provides a public EVM settlement-registry contract, eight configured series, interim HTS test assets and a pinned, partially deployed Asset Tokenization Studio infrastructure path. Test balances and liquidity are explicitly labelled demo data and have no monetary value.

## How it is made

The frontend uses Next.js 16, React 19, TypeScript and a responsive custom exchange design deployed on Vercel. It polls sequence-numbered market and account views from an Axum REST API and renders source-aware candlesticks, seven levels of depth per side, recent fills, order entry and portfolio state. Each browser receives a persistent test identity and can claim demo USD once per engine session.

The matching engine is written in Rust with Tokio and Axum. Its pure book uses integer price ticks, whole-number lots and `BTreeMap<PriceTicks, VecDeque<OrderId>>` queues for deterministic price-time priority. It supports resting-price execution, partial fills, ordinary and post-only limits, immediate-or-cancel market orders, cancellation, idempotent client order IDs, self-trade prevention, monotonic sequence numbers, and cash or inventory reservation. A sell must be backed by inventory, so the demo cannot create a naked short.

The engine is packaged as a non-root Linux container. AWS CodeBuild builds the x86-64 image, private ECR stores it, and App Runner supplies the public TLS endpoint and health checks. Vercel receives that endpoint through `NEXT_PUBLIC_ENGINE_URL`.

On Hedera testnet we deployed a Solidity settlement-registry extension through the EVM JSON-RPC relay, created eight commodity series and created interim fungible HTS test assets with public token IDs. We pinned Hedera Asset Tokenization Studio at commit `be4f860e408ec5b1a24d12feb6f872aabff69319` and deployed its ProxyAdmin, Business Logic Resolver implementation/proxy and the first 28 facets before the testnet operator exhausted its faucet allocation. ATS is valuable because it supplies controlled issuance, ownership, holds, transfer restrictions, roles and redemption primitives; RawMarket supplies the commodity methodology, deterministic matcher, reservation model, oracle-report shape and settlement-specific logic ATS does not provide.

The most notable hack is deliberate restraint: source reports and hashes are archived in the repository, and the chart refuses to fabricate missing history. We also used cloud-native CodeBuild to produce the Rust container without relying on a local Docker daemon.

## Partner technology — Hedera

RawMarket uses Hedera in three distinct layers:

1. **Hedera Smart Contract Service / EVM relay** for the deployed series and settlement-registry extension.
2. **Hedera Token Service** for public interim test token identities, supply controls and Mirror Node visibility.
3. **Asset Tokenization Studio** as the pinned security-token lifecycle and transfer-control layer. Its BLR infrastructure is deployed partially; ATS factory configuration and ATS-issued commodity assets are not claimed as complete.

This separation matters. ATS is not described as a derivatives engine, and plain HTS test tokens are not described as ATS security tokens.

## Live links

- Product: [rawmarket-terminal.vercel.app](https://rawmarket-terminal.vercel.app)
- Source: [github.com/KENILSHAHH/rawmarket](https://github.com/KENILSHAHH/rawmarket)
- Matching engine health: [AWS App Runner](https://qr87wwmycq.us-east-1.awsapprunner.com/health)
- Hedera contract: [HashScan testnet](https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA)
- Demo narration: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- Hedera implementation details: [HEDERA_INTEGRATION.md](HEDERA_INTEGRATION.md)
- Benchmark methodology and evidence policy: [DATA_METHODOLOGY.md](DATA_METHODOLOGY.md)

## Suggested technologies/tags

Hedera, Asset Tokenization Studio, HTS, Hedera Smart Contract Service, Solidity, Rust, Tokio, Axum, Next.js, React, TypeScript, AWS App Runner, AWS CodeBuild, ECR, Vercel, USDA, commodity markets, tokenization, central limit order book.

## Three-minute judge flow

1. Open MILK and explain that the reference is USD/cwt from the USDA Class III announcement.
2. Point out the distinction between reference, best bid, best ask and confirmed fills.
3. Fund the unique test wallet.
4. Select **Market**, buy one MILK unit and show depth, sequence, cash and inventory update.
5. Place a limit bid below the spread, open the Open Orders panel and cancel it to release reserved cash.
6. Open HashScan and show the deployed contract and testnet artifact IDs.
7. Close with the architecture and the explicit ATS/data-audit completion gates.

## Honest demo boundaries

- The AWS engine holds books and demo balances in memory; an App Runner replacement resets them.
- Browser identities are test identities, not authenticated Hedera wallets.
- Engine fills are real CLOB executions but are not yet atomic HTS/ATS transfers.
- HTS assets are interim plain test tokens; ATS-issued commodity assets are pending completion of the pinned ATS deployment.
- The deployed Solidity contract is a prototype settlement registry. Its current signature array is not a production threshold-signature verifier and `claim` records accounting state rather than transferring collateral.
- MILK has one archived verified fixing in the demo. Produce, grain and pulse markets remain historical/demo until their 90-day coverage audits and deterministic adapters pass.

These boundaries are intentional submission disclosures, not hidden assumptions.

## Pre-submission checklist

- [ ] Make the GitHub repository public or grant the judges access; it is currently private.
- [ ] Rotate the testnet operator key that was exposed during development.
- [ ] Confirm the Vercel terminal, AWS health endpoint and HashScan links in a logged-out browser.
- [ ] Record the three-minute flow using [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) and add the final video URL.
- [ ] Add screenshots showing the live order fill, open-order cancellation and HashScan evidence.
- [ ] If more testnet HBAR is available, resume the pinned ATS checkpoint and update every ATS claim and address in the submission.
- [ ] Do not remove the demo/historical labels or describe interim HTS tokens as ATS-issued assets.
