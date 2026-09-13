# RawMarket — three-minute demo script

## 0:00–0:25 — Problem and product

**On screen:** Open the live terminal with MILK selected.

“RawMarket is a Hedera-powered spot venue for tokenized US commodity benchmarks. It gives products such as milk, potatoes, tomatoes and grains a professional exchange interface while clearly showing each benchmark, quotation unit, source quality and testnet status.”

## 0:25–0:55 — Market and benchmark

**On screen:** Point to Reference, Best Bid, Best Ask and the source badge on the chart.

“I’ll use US Class III Milk, quoted in dollars per hundredweight from the official USDA announcement. RawMarket keeps the reference, order-book quotes, last fill and final fixing separate. A market-maker quote can never replace a missing benchmark, so unsupported history displays no verified candles instead of a fabricated chart.”

## 0:55–1:25 — Architecture

**On screen:** Keep the live engine badge and sequence number visible.

“The Next.js 16 terminal runs on Vercel. Live orders go to a Rust Axum engine on AWS App Runner. Its deterministic CLOB uses integer ticks, whole lots and price-time priority, with limit, post-only and immediate-or-cancel market orders, partial fills, cancellation, self-trade prevention and balance reservations.”

## 1:25–2:10 — Place a real demo order

**On screen:** Fund the wallet, select Market, buy one MILK, then show My Fills. Place and cancel a resting limit bid if time permits.

“I’ll fund a unique test wallet with ten thousand demo dollars. The red levels are live depth from the AWS order book. I choose Market and buy one MILK. It executes at the resting ask: ask size decreases, the sequence advances, cash decreases and inventory increases. The fill appears in Recent Trades and My Fills.”

“Next I place a limit bid below the market. It appears in Open Orders and reserves cash. Cancelling it releases that reservation. Sell orders require inventory, so naked shorting is rejected.”

## 2:10–2:45 — Hedera

**On screen:** Open the HashScan contract link from the terminal header or footer.

“Hedera is the public asset and settlement layer. RawMarket has a testnet EVM registry, eight series and interim HTS token IDs visible on HashScan. We also pinned Asset Tokenization Studio and deployed its BLR proxy and initial facets. ATS supplies controlled issuance, transfer controls, holds and redemption; RawMarket adds benchmark and exchange logic.”

## 2:45–3:00 — Close

**On screen:** Return to the market directory and show the explicit live/historical labels.

“RawMarket combines source evidence, deterministic matching and Hedera tokenization in one auditable venue. Milk is the priority demo; other markets remain clearly labelled historical until their coverage audits pass.”
