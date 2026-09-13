# RawMarket — three-minute demo script

## 0:00–0:25 — Problem and product

“Commodity price exposure is still difficult to access transparently, especially for products such as milk, potatoes and tomatoes. RawMarket is a Hedera-powered spot venue for tokenized US commodity benchmarks. The interface is familiar to professional exchange users, but every market clearly states its benchmark, quotation unit, source quality and testnet status.”

## 0:25–0:55 — Market and benchmark

“I’ll use US Class III Milk. It is quoted in US dollars per hundredweight and references the official USDA Class III announcement. The terminal keeps five values separate: the USDA reference, the order-book bid and ask, the last matched trade, the portfolio mark and the final settlement fixing. RawMarket never replaces missing USDA history with a market-maker quote or a fabricated chart. That is why unsupported windows visibly show no verified candles.”

## 0:55–1:25 — Architecture

“The frontend is built with Next.js 16 and React 19 and runs on Vercel. Live market data and orders go to a Rust Axum matching engine running on AWS App Runner. The CLOB uses integer ticks, whole-number lots and deterministic price-time priority. It supports limit orders, immediate-or-cancel market orders, post-only orders, partial fills, cancellations, self-trade prevention and cash or inventory reservations.”

## 1:25–2:10 — Place a real demo order

“I’ll fund a unique test wallet with ten thousand demo dollars. This faucet can fund the wallet only once per engine session. The best milk ask is visible in red, with real depth from the live AWS order book. I choose Market, enter one unit and buy. The order executes at the resting ask. We can see the ask size decrease, the engine sequence advance, cash decrease and one MILK unit appear in inventory. The confirmed engine fill also appears in Recent Trades and My Fills.”

“Now I place a limit bid below the market. It rests in Open Orders and reserves exactly the required cash. When I cancel it, the order moves to cancelled state and the reservation is released. Selling inventory follows the same route, and naked short selling is rejected.”

## 2:10–2:45 — Hedera

“Hedera is the public asset and settlement layer. On testnet, RawMarket has a deployed EVM settlement contract, configured commodity series and interim HTS token IDs that can be inspected through HashScan. We pinned Hedera Asset Tokenization Studio and deployed its BLR proxy and initial facets. ATS contributes controlled issuance, ownership, transfer controls, holds and redemption primitives; RawMarket adds benchmark validation, exchange reservations and commodity-specific settlement logic.”

## 2:45–3:00 — Close

“RawMarket demonstrates how transparent source evidence, a deterministic high-performance order book and Hedera tokenization can fit into one auditable commodity venue. Milk works end to end as the priority market, while produce, grains and pulses remain clearly labelled historical demo markets until their coverage audits pass.”
