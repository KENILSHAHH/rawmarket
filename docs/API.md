# RawMarket Trading API

RawMarket exposes a machine-readable REST surface for market makers, trading bots, and institutional integrations. The API is designed around the same spot order book used by the web terminal.

Base URL:

```text
https://qr87wwmycq.us-east-1.awsapprunner.com
```

For local development, use `http://localhost:8080`.

The public API is currently a testnet/demo interface. It does not yet authorize a caller to spend a Hedera account, and the `wallet` field is not an enterprise identity boundary. Production API keys, signed requests, durable sequencing, and Hedera transaction reconciliation are required before external capital should be used.

## Quick start

Start the engine:

```bash
cargo run --manifest-path engine/Cargo.toml
```

List markets:

```bash
curl http://localhost:8080/api/markets
```

Read the MILK spot book:

```bash
curl http://localhost:8080/api/book/MILK/SPOT
```

Fund the local demo wallet:

```bash
curl -X POST http://localhost:8080/api/fund \
  -H 'content-type: application/json' \
  -d '{"wallet":"bot-001","amount":10000}'
```

## Endpoints

### `GET /health`

Returns a JSON service/version response when the HTTP process is running. This does not prove that Hedera, the Mirror Node, persistence, or the settlement worker is healthy.

### `GET /api/markets`

Returns the configured market catalog. Important fields:

```json
{
  "symbol": "MILK",
  "unit": "USD/cwt",
  "reference": 16.64,
  "status": "live demo",
  "expiry": "2026-10-31T14:00:00Z"
}
```

Only markets whose source coverage and operational status are approved should be enabled for production order entry.

### `GET /api/book/{symbol}/SPOT`

Returns the current sequence-numbered book:

```json
{
  "symbol": "MILK",
  "claim": "SPOT",
  "bids": [{"price":16.61,"size":100,"total":1661}],
  "asks": [{"price":16.67,"size":100,"total":1667}],
  "last": 16.64,
  "sequence": 14
}
```

Prices are quoted in the market’s declared unit. `sequence` is monotonic for the process-local book. Production deployments must persist it and publish deltas over WebSocket with gap recovery.

### `GET /api/trades/{symbol}/SPOT`

Returns up to the most recent 50 engine-confirmed demo fills. A production trade feed must include Hedera settlement status and transaction ID; a match proposal must not be presented as an on-chain confirmed trade.

### `GET /api/candles/{symbol}/{interval}`

Supported UI intervals are `1D`, `1W`, `1M`, `1Y`, `5Y`, and `25Y`. The response intentionally includes data quality:

```json
{
  "interval":"1D",
  "frequency":"monthly",
  "source_status":"verified official history",
  "coverage":"2001-08-01 through 2026-08-01 · 301 observations",
  "source_url":"https://www.fmma30.com/ClassPrice/HistoryofClassIII--1990-Current.pdf",
  "as_of":"2026-08-01",
  "candles":[{
    "time":"2026-09-02",
    "open":16.64,
    "high":16.64,
    "low":16.64,
    "close":16.64,
    "volume":0,
    "source":"USDA Class III announcement"
  }]
}
```

MILK bars are fixing-change candles: `open` is the previous official monthly fixing, `close` is the current fixing, and `high`/`low` are the two endpoints. They are not intramonth trade OHLC. An empty `candles` array is a valid and meaningful result. Clients must not interpolate or backfill it with traded prices.

### `GET /api/account/{wallet}`

Returns the local demo account, cash reservations, inventory, and open-order count. In production this endpoint must be keyed by an authenticated principal, not an arbitrary URL wallet string.

### `GET /api/orders/{wallet}`

Returns the wallet's order history, including `limit`/`market` type, original quantity, filled quantity, remaining quantity, order state, and the Hedera receipt status/identifiers. A confirmed receipt is an immutable order acknowledgement, not proof of token/payment settlement.

### `GET /api/fills/{wallet}`

Returns up to 100 fills in which the wallet was the buyer or seller.

### `POST /api/fund`

Demo-only faucet. It grants at most $10,000 once per process-local wallet and does not mint HTS tokens or transfer HBAR. It must be disabled outside local/testnet demonstrations.

Request:

```json
{"wallet":"bot-001","amount":10000}
```

### `POST /api/orders`

Places a spot limit or immediate-or-cancel market order and attempts matching immediately.

Request:

```json
{
  "wallet":"bot-001",
  "symbol":"MILK",
  "claim":"SPOT",
  "side":"buy",
  "price":16.61,
  "qty":5,
  "client_id":"bot-001-milk-000001",
  "post_only":true,
  "order_type":"limit"
}
```

Rules:

- `side` is `buy` or `sell`.
- `claim` must be `SPOT` in the current venue.
- `order_type` is `limit` or `market`.
- `price` must be positive for a limit order and is rounded to the market tick.
- A market order executes immediate-or-cancel at the current best displayed price; unfilled quantity never rests.
- `qty` must be a positive integer lot.
- Buy orders reserve demo USD before execution.
- Sell orders reserve available spot inventory.
- A sell cannot create a naked short position.
- `client_id` must be unique per wallet and book.
- Matching uses price-time priority and executes at the resting order price.
- Self-trading is rejected.

The response is an array because one taker order can produce multiple fills and an order-state record:

```json
[
  {
    "id":"3d8a…",
    "symbol":"MILK",
    "claim":"SPOT",
    "wallet":"bot-001",
    "side":"buy",
    "order_type":"limit",
    "price":16.61,
    "qty":5,
    "filled":5,
    "remaining":0,
    "status":"filled",
    "hedera_tx_hash":"0x…",
    "hedera_transaction_id":"0.0.7314364@1789311435.571365944",
    "hedera_status":"confirmed"
  }
]
```

The engine separates `open`, `partially_filled`, `filled`, `cancelled`, and IOC `expired` states. It separately records `hedera_status` for the order acknowledgement. Asset settlement must still add `matched_pending_settlement`, `settled`, and `settlement_failed` without conflating a match or receipt with chain finality.

### `DELETE /api/orders/{id}`

Cancels an open order and releases its local reservation. Cancellation is idempotent at the command layer in the production design; clients should retain the order ID and retry only after reconciling the last known status.

## Programmatic trading pattern

```text
1. GET markets
2. GET book and record sequence
3. GET account / confirm available balance
4. Submit an order with a unique client_id
5. Store the returned order ID and response
6. Poll book/account/trades or subscribe to the production WebSocket
7. On a timeout, reconcile by client_id before retrying
8. Cancel using the order ID, then reconcile reservation release
9. For Hedera settlement, wait for confirmed transaction status
```

Never retry an unknown order submission with a new client ID. That can create duplicate exposure. Production clients should use an idempotency key and request hash, and the server should reject reuse with a different payload.

## TypeScript example

```ts
const base = process.env.RAWMARKET_URL ?? 'http://localhost:8080';
const wallet = 'bot-001';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

const markets = await json('/api/markets');
const book = await json<any>('/api/book/MILK/SPOT');

const order = await json('/api/orders', {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({
    wallet,
    symbol: 'MILK',
    claim: 'SPOT',
    side: 'buy',
    price: book.bids[0]?.price ?? 16.61,
    qty: 1,
    client_id: `bot-001-${crypto.randomUUID()}`,
    post_only: true
  })
});

console.log({markets, order});
```

## Market-maker behavior

A market maker should:

- maintain one logical order per side and price level;
- use cancel/replace with a fresh client ID only after the prior order is reconciled;
- stop quoting when the benchmark is stale or source quality is not `approved`;
- enforce inventory and cash limits locally and on the venue;
- keep a clock and measure acknowledgement, match, and Hedera settlement latency separately;
- treat demo seeded depth as synthetic; and
- never price a spot token as an oracle fixing.

The future production API will add authenticated bulk cancel, cancel/replace, maker-only credentials, private order streams, and signed WebSocket snapshots.

## Production authentication contract

The current local API accepts a wallet string for demo purposes. The enterprise API must replace this with:

- API key ID plus secret created in the RawMarket account console;
- HMAC or Ed25519 request signatures;
- timestamp and nonce replay protection;
- key scopes such as `market.read`, `orders.write`, `orders.cancel`, and `account.read`;
- IP allowlists and optional mTLS for institutional makers;
- per-key rate limits;
- audit logging of principal, request hash, order ID, and response;
- separate sandbox and testnet credentials; and
- no private Hedera operator key in a browser or market-maker process.

The proposed signing string is:

```text
RAW-MARKET-V1\nMETHOD\nPATH\nTIMESTAMP\nNONCE\nSHA256(BODY)
```

The server should verify the signature before parsing a mutation and persist the nonce atomically with the accepted command.

## OpenAPI

The machine-readable contract is [`openapi.yaml`](openapi.yaml). It describes the current demo endpoints and marks the enterprise authentication and settlement fields that are being introduced in the production API version.

## Error handling

Clients should treat non-2xx responses as non-acceptance. A production error envelope will be:

```json
{
  "error": {
    "code":"INSUFFICIENT_AVAILABLE_BALANCE",
    "message":"buy reservation exceeds available cash",
    "request_id":"req_…",
    "retryable":false
  }
}
```

Retryable infrastructure failures must never imply that an order was not accepted. Reconcile by idempotency key and server sequence before retrying.

## Versioning

The current demo paths are unversioned for compatibility with the local UI. The production surface will be released at `/api/v1` with:

- explicit response schemas;
- stable enum values;
- request IDs;
- pagination cursors;
- WebSocket snapshot/delta sequencing;
- deprecation headers; and
- a compatibility window for prior clients.
