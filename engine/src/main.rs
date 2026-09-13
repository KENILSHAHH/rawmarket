use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use rawmarket_engine::{Book, Order, Side};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tower_http::cors::CorsLayer;
use uuid::Uuid;

mod hedera;
mod market_data;
use hedera::{OrderReceipt, ReceiptWriter};
use market_data::{CandleResponse, HistoryStore};

#[derive(Clone, Serialize)]
struct Market {
    symbol: String,
    name: String,
    unit: String,
    m: u64,
    cap: u64,
    status: String,
    expiry: String,
    description: String,
    reference: f64,
}

fn market(
    symbol: &str,
    name: &str,
    unit: &str,
    multiplier: u64,
    cap: u64,
    status: &str,
    description: &str,
    reference: f64,
) -> Market {
    Market {
        symbol: symbol.into(),
        name: name.into(),
        unit: unit.into(),
        m: multiplier,
        cap,
        status: status.into(),
        expiry: "2026-10-31T14:00:00Z".into(),
        description: description.into(),
        reference,
    }
}

fn markets() -> Vec<Market> {
    vec![
        market(
            "MILK",
            "US Class III Milk",
            "USD/cwt",
            2000,
            25,
            "live demo",
            "USDA announced Class III price; 2,000 cwt / 200,000 lb reference exposure",
            16.64,
        ),
        market(
            "POTATO",
            "RawMarket US Russet Potato Index v1",
            "USD / 50 lb carton",
            1,
            35,
            "historical/demo",
            "Russet Norkotah; U.S. One; 70-count; 50 lb cartons",
            20.0,
        ),
        market(
            "TOMATO",
            "RawMarket US Round Tomato Index v1",
            "USD / 25 lb carton",
            1,
            40,
            "historical/demo",
            "Round mature-green; U.S. One or better; 5x6; 25 lb cartons",
            18.0,
        ),
        market(
            "WHEAT",
            "RawMarket US Wheat Index v1",
            "USD / bushel",
            1,
            15,
            "historical/demo",
            "US domestic cash benchmark; audit gate before issuance",
            6.1,
        ),
        market(
            "CORN",
            "RawMarket US Corn Index v1",
            "USD / bushel",
            1,
            10,
            "historical/demo",
            "US domestic cash benchmark; audit gate before issuance",
            4.5,
        ),
        market(
            "RICE",
            "RawMarket US Rice Index v1",
            "USD / cwt",
            1,
            30,
            "historical/demo",
            "US long-grain benchmark; audit gate before issuance",
            18.0,
        ),
        market(
            "SOYBEAN",
            "RawMarket US Soybean Index v1",
            "USD / bushel",
            1,
            25,
            "historical/demo",
            "US domestic cash benchmark; audit gate before issuance",
            10.2,
        ),
        market(
            "DRY_BEAN",
            "RawMarket US Dry Bean Index v1",
            "USD / cwt",
            1,
            80,
            "historical/demo",
            "US dry edible bean benchmark; audit gate before issuance",
            42.0,
        ),
    ]
}

#[derive(Clone, Default, Serialize)]
struct Position {
    available: u64,
    reserved: u64,
}

#[derive(Clone, Default, Serialize)]
struct Account {
    wallet: String,
    cash: f64,
    reserved_cash: f64,
    positions: HashMap<String, Position>,
    #[serde(skip)]
    funded: bool,
}

#[derive(Clone)]
struct Tracked {
    wallet: String,
    key: String,
    side: Side,
    price: f64,
    qty: u64,
    remaining: u64,
    filled: u64,
    status: String,
    order_type: String,
    created_at: u64,
    hedera_tx_hash: Option<String>,
    hedera_transaction_id: Option<String>,
    hedera_status: String,
}

struct App {
    markets: Vec<Market>,
    books: HashMap<String, Book>,
    accounts: HashMap<String, Account>,
    tracked: HashMap<Uuid, Tracked>,
    fills: Vec<Trade>,
    history: HistoryStore,
    receipt_writer: Option<ReceiptWriter>,
}

type Shared = Arc<Mutex<App>>;

#[derive(Serialize)]
struct AccountView {
    wallet: String,
    cash: f64,
    reserved_cash: f64,
    available_cash: f64,
    positions: HashMap<String, Position>,
    open_orders: usize,
    funded: bool,
}

#[derive(Serialize)]
struct Level {
    price: f64,
    size: u64,
    total: f64,
}

#[derive(Serialize)]
struct BookView {
    symbol: String,
    claim: String,
    bids: Vec<Level>,
    asks: Vec<Level>,
    last: f64,
    sequence: u64,
}

#[derive(Clone, Serialize)]
struct Trade {
    id: Uuid,
    symbol: String,
    claim: String,
    price: f64,
    qty: u64,
    buyer: String,
    seller: String,
    timestamp: u64,
}

#[derive(Serialize)]
struct OrderView {
    id: Uuid,
    symbol: String,
    claim: String,
    wallet: String,
    side: String,
    order_type: String,
    price: f64,
    qty: u64,
    filled: u64,
    remaining: u64,
    status: String,
    created_at: u64,
    hedera_tx_hash: Option<String>,
    hedera_transaction_id: Option<String>,
    hedera_status: String,
}

#[derive(Deserialize)]
struct FundReq {
    wallet: String,
    amount: Option<f64>,
}

#[derive(Deserialize)]
struct PlaceReq {
    wallet: String,
    symbol: String,
    claim: String,
    side: String,
    price: Option<f64>,
    qty: u64,
    client_id: String,
    post_only: Option<bool>,
    order_type: Option<String>,
}

fn key(symbol: &str, claim: &str) -> String {
    format!("{}:{}", symbol.to_uppercase(), claim.to_uppercase())
}
fn error(message: impl ToString) -> (StatusCode, String) {
    (StatusCode::BAD_REQUEST, message.to_string())
}
fn now() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn account_mut<'a>(app: &'a mut App, wallet: &str) -> &'a mut Account {
    app.accounts
        .entry(wallet.to_string())
        .or_insert_with(|| Account {
            wallet: wallet.to_string(),
            ..Default::default()
        })
}

fn ensure_book(app: &mut App, book_key: &str) {
    if app.books.contains_key(book_key) {
        return;
    }
    let symbol = book_key.split(':').next().unwrap_or("MILK");
    let reference = app
        .markets
        .iter()
        .find(|item| item.symbol == symbol)
        .map(|item| item.reference)
        .unwrap_or(12.5);
    let maker = "rawmarket-demo-liquidity".to_string();
    let maker_account = account_mut(app, &maker);
    maker_account.cash = 1_000_000.0;
    maker_account
        .positions
        .entry(book_key.to_string())
        .or_insert(Position {
            available: 10_000,
            reserved: 0,
        });
    let step = (reference * 0.002).max(0.01);
    let quantities = [100, 150, 200, 250, 300, 400, 500];
    let mut book = Book::default();
    for (index, qty) in quantities.into_iter().enumerate() {
        for (side, price, client_id) in [
            (
                Side::Short,
                reference + step * (index as f64 + 1.0),
                format!("seed-ask-{index}"),
            ),
            (
                Side::Long,
                reference - step * (index as f64 + 1.0),
                format!("seed-bid-{index}"),
            ),
        ] {
            let ticks = (price * 100.0).round() as u64;
            let displayed = ticks as f64 / 100.0;
            let id = Uuid::new_v4();
            let _ = book.place(Order {
                id,
                client_id,
                owner: maker.clone(),
                side,
                price_ticks: ticks,
                qty,
                remaining: qty,
                post_only: false,
                immediate_or_cancel: false,
                seq: 0,
            });
            app.tracked.insert(
                id,
                Tracked {
                    wallet: maker.clone(),
                    key: book_key.into(),
                    side,
                    price: displayed,
                    qty,
                    remaining: qty,
                    filled: 0,
                    status: "open".into(),
                    order_type: "limit".into(),
                    created_at: now(),
                    hedera_tx_hash: None,
                    hedera_transaction_id: None,
                    hedera_status: "not_applicable".into(),
                },
            );
        }
    }
    app.books.insert(book_key.into(), book);
}

fn account_view(app: &App, wallet: &str) -> AccountView {
    let account = app
        .accounts
        .get(wallet)
        .cloned()
        .unwrap_or_else(|| Account {
            wallet: wallet.into(),
            ..Default::default()
        });
    AccountView {
        wallet: account.wallet,
        cash: account.cash,
        reserved_cash: account.reserved_cash,
        available_cash: account.cash - account.reserved_cash,
        positions: account.positions,
        open_orders: app
            .tracked
            .values()
            .filter(|order| {
                order.wallet == wallet
                    && order.remaining > 0
                    && (order.status == "open" || order.status == "partially_filled")
            })
            .count(),
        funded: account.funded,
    }
}

fn order_view(id: Uuid, order: &Tracked) -> OrderView {
    let mut parts = order.key.split(':');
    OrderView {
        id,
        symbol: parts.next().unwrap_or("").into(),
        claim: parts.next().unwrap_or("").into(),
        wallet: order.wallet.clone(),
        side: if order.side == Side::Long {
            "buy".into()
        } else {
            "sell".into()
        },
        order_type: order.order_type.clone(),
        price: order.price,
        qty: order.qty,
        filled: order.filled,
        remaining: order.remaining,
        status: order.status.clone(),
        created_at: order.created_at,
        hedera_tx_hash: order.hedera_tx_hash.clone(),
        hedera_transaction_id: order.hedera_transaction_id.clone(),
        hedera_status: order.hedera_status.clone(),
    }
}

async fn list_markets(State(state): State<Shared>) -> Json<Vec<Market>> {
    Json(state.lock().unwrap().markets.clone())
}

async fn fund(
    State(state): State<Shared>,
    Json(request): Json<FundReq>,
) -> Result<Json<AccountView>, (StatusCode, String)> {
    if request.wallet.trim().is_empty() {
        return Err(error("wallet is required"));
    }
    let mut app = state.lock().unwrap();
    let account = account_mut(&mut app, &request.wallet);
    if !account.funded {
        account.cash += request.amount.unwrap_or(10_000.0).clamp(1.0, 10_000.0);
        account.funded = true;
    }
    Ok(Json(account_view(&app, &request.wallet)))
}

async fn account(Path(wallet): Path<String>, State(state): State<Shared>) -> Json<AccountView> {
    let app = state.lock().unwrap();
    Json(account_view(&app, &wallet))
}

async fn book(
    Path((symbol, claim)): Path<(String, String)>,
    State(state): State<Shared>,
) -> Json<BookView> {
    let mut app = state.lock().unwrap();
    let book_key = key(&symbol, &claim);
    ensure_book(&mut app, &book_key);
    let book = app.books.get(&book_key).unwrap();
    let (bids, asks) = book.snapshot();
    let levels = |items: Vec<(u64, u64)>| {
        items
            .into_iter()
            .map(|(price, size)| Level {
                price: price as f64 / 100.0,
                size,
                total: price as f64 * size as f64 / 100.0,
            })
            .collect()
    };
    Json(BookView {
        symbol: symbol.to_uppercase(),
        claim: claim.to_uppercase(),
        bids: levels(bids),
        asks: levels(asks),
        last: book.mid().unwrap_or(0) as f64 / 100.0,
        sequence: book.sequence(),
    })
}

async fn place(
    State(state): State<Shared>,
    Json(request): Json<PlaceReq>,
) -> Result<Json<Vec<OrderView>>, (StatusCode, String)> {
    if request.qty == 0 {
        return Err(error("quantity must be positive"));
    }
    let (
        ids,
        receipt_writer,
        receipt_order_id,
        receipt_symbol,
        receipt_wallet,
        side,
        price_ticks,
        engine_sequence,
        id,
    ) = {
        let mut app = state.lock().unwrap();
        if !app
            .markets
            .iter()
            .any(|item| item.symbol.eq_ignore_ascii_case(&request.symbol))
        {
            return Err(error("unknown market"));
        }
        let book_key = key(&request.symbol, &request.claim);
        ensure_book(&mut app, &book_key);
        let side = match request.side.to_lowercase().as_str() {
            "buy" => Side::Long,
            "sell" => Side::Short,
            _ => return Err(error("side must be buy or sell")),
        };
        let order_type = request
            .order_type
            .as_deref()
            .unwrap_or("limit")
            .to_lowercase();
        let immediate_or_cancel = order_type == "market";
        let price_ticks = if immediate_or_cancel {
            let book = app.books.get(&book_key).unwrap();
            match side {
                Side::Long => book.best_ask(),
                Side::Short => book.best_bid(),
            }
            .ok_or_else(|| error("no executable liquidity"))?
        } else {
            let price = request
                .price
                .ok_or_else(|| error("price is required for a limit order"))?;
            if !price.is_finite() || price <= 0.0 {
                return Err(error("price must be positive"));
            }
            (price * 100.0).round() as u64
        };
        let price = price_ticks as f64 / 100.0;
        let maximum_cost = price * request.qty as f64;
        {
            let account = account_mut(&mut app, &request.wallet);
            if side == Side::Long && account.cash - account.reserved_cash < maximum_cost {
                return Err(error("insufficient available demo USD"));
            }
            if side == Side::Short {
                let position = account.positions.entry(book_key.clone()).or_default();
                if position.available < position.reserved + request.qty {
                    return Err(error(
                        "sell requires available inventory; naked shorting is disabled",
                    ));
                }
            }
        }

        let id = Uuid::new_v4();
        let order = Order {
            id,
            client_id: request.client_id,
            owner: request.wallet.clone(),
            side,
            price_ticks,
            qty: request.qty,
            remaining: request.qty,
            post_only: request.post_only.unwrap_or(false),
            immediate_or_cancel,
            seq: 0,
        };
        let (_, fills) = app
            .books
            .get_mut(&book_key)
            .unwrap()
            .place(order)
            .map_err(|reason| error(format!("order rejected: {reason:?}")))?;
        let engine_sequence = app.books.get(&book_key).unwrap().sequence();

        {
            let account = account_mut(&mut app, &request.wallet);
            if side == Side::Long {
                account.reserved_cash += maximum_cost;
            } else {
                account
                    .positions
                    .entry(book_key.clone())
                    .or_default()
                    .reserved += request.qty;
            }
        }

        let mut taker = Tracked {
            wallet: request.wallet.clone(),
            key: book_key.clone(),
            side,
            price,
            qty: request.qty,
            remaining: request.qty,
            filled: 0,
            status: "open".into(),
            order_type: order_type.clone(),
            created_at: now(),
            hedera_tx_hash: None,
            hedera_transaction_id: None,
            hedera_status: if app.receipt_writer.is_some() {
                "pending".into()
            } else {
                "unavailable".into()
            },
        };
        let mut ids = vec![id];
        for fill in fills {
            ids.push(fill.maker);
            let maker = app
                .tracked
                .get(&fill.maker)
                .cloned()
                .ok_or_else(|| error("maker state missing"))?;
            let (buyer, seller) = if side == Side::Long {
                (taker.clone(), maker.clone())
            } else {
                (maker.clone(), taker.clone())
            };
            let value = fill.price_ticks as f64 / 100.0 * fill.qty as f64;
            let held = buyer.price * fill.qty as f64;
            let buyer_account = account_mut(&mut app, &buyer.wallet);
            buyer_account.cash = (buyer_account.cash - value).max(0.0);
            buyer_account.reserved_cash = (buyer_account.reserved_cash - held).max(0.0);
            buyer_account
                .positions
                .entry(book_key.clone())
                .or_default()
                .available += fill.qty;
            let seller_account = account_mut(&mut app, &seller.wallet);
            seller_account.cash += value;
            let seller_position = seller_account
                .positions
                .entry(book_key.clone())
                .or_default();
            seller_position.reserved = seller_position.reserved.saturating_sub(fill.qty);
            seller_position.available = seller_position.available.saturating_sub(fill.qty);
            app.fills.push(Trade {
                id: Uuid::new_v4(),
                symbol: request.symbol.to_uppercase(),
                claim: request.claim.to_uppercase(),
                price: fill.price_ticks as f64 / 100.0,
                qty: fill.qty,
                buyer: buyer.wallet,
                seller: seller.wallet,
                timestamp: now(),
            });
            taker.remaining = taker.remaining.saturating_sub(fill.qty);
            taker.filled += fill.qty;
            if let Some(maker_order) = app.tracked.get_mut(&fill.maker) {
                maker_order.remaining = maker_order.remaining.saturating_sub(fill.qty);
                maker_order.filled += fill.qty;
                maker_order.status = if maker_order.remaining == 0 {
                    "filled".into()
                } else {
                    "partially_filled".into()
                };
            }
        }

        if immediate_or_cancel && taker.remaining > 0 {
            let unfilled = taker.remaining;
            let account = account_mut(&mut app, &request.wallet);
            if side == Side::Long {
                account.reserved_cash = (account.reserved_cash - price * unfilled as f64).max(0.0);
            } else {
                account
                    .positions
                    .entry(book_key.clone())
                    .or_default()
                    .reserved = account
                    .positions
                    .get(&book_key)
                    .map(|position| position.reserved)
                    .unwrap_or(0)
                    .saturating_sub(unfilled);
            }
            taker.remaining = 0;
            taker.status = if taker.filled > 0 {
                "partially_filled".into()
            } else {
                "expired".into()
            };
        } else {
            taker.status = if taker.remaining == 0 {
                "filled".into()
            } else if taker.filled > 0 {
                "partially_filled".into()
            } else {
                "open".into()
            };
        }
        app.tracked.insert(id, taker);
        let receipt_writer = app.receipt_writer.clone();
        let receipt_order_id = id.to_string();
        let receipt_symbol = request.symbol.to_uppercase();
        let receipt_wallet = request.wallet.clone();
        (
            ids,
            receipt_writer,
            receipt_order_id,
            receipt_symbol,
            receipt_wallet,
            side,
            price_ticks,
            engine_sequence,
            id,
        )
    };

    let receipt_result = if let Some(writer) = receipt_writer {
        Some(
            writer
                .record_order(OrderReceipt {
                    order_id: &receipt_order_id,
                    symbol: &receipt_symbol,
                    wallet: &receipt_wallet,
                    is_buy: side == Side::Long,
                    price_ticks,
                    quantity: request.qty,
                    engine_sequence,
                })
                .await,
        )
    } else {
        None
    };

    let mut app = state.lock().unwrap();
    if let Some(result) = receipt_result {
        if let Some(order) = app.tracked.get_mut(&id) {
            match result {
                Ok(receipt) => {
                    order.hedera_tx_hash = Some(receipt.transaction_hash);
                    order.hedera_transaction_id = receipt.transaction_id;
                    order.hedera_status = "confirmed".into();
                }
                Err(reason) => {
                    eprintln!("order {id} Hedera receipt failed: {reason}");
                    order.hedera_status = "failed".into();
                }
            }
        }
    }
    let result = ids
        .into_iter()
        .filter_map(|order_id| {
            app.tracked
                .get(&order_id)
                .map(|order| order_view(order_id, order))
        })
        .collect();
    Ok(Json(result))
}

async fn cancel(
    Path(id): Path<Uuid>,
    State(state): State<Shared>,
) -> Result<Json<OrderView>, (StatusCode, String)> {
    let mut app = state.lock().unwrap();
    let order = app
        .tracked
        .get(&id)
        .cloned()
        .ok_or_else(|| error("unknown order"))?;
    if order.remaining == 0 {
        return Err(error("order is already inactive"));
    }
    app.books
        .get_mut(&order.key)
        .ok_or_else(|| error("book missing"))?
        .cancel(id)
        .map_err(|reason| error(format!("cancel rejected: {reason:?}")))?;
    if let Some(account) = app.accounts.get_mut(&order.wallet) {
        if order.side == Side::Long {
            account.reserved_cash =
                (account.reserved_cash - order.price * order.remaining as f64).max(0.0);
        } else {
            account
                .positions
                .entry(order.key.clone())
                .or_default()
                .reserved = account
                .positions
                .get(&order.key)
                .map(|position| position.reserved)
                .unwrap_or(0)
                .saturating_sub(order.remaining);
        }
    }
    let tracked = app.tracked.get_mut(&id).unwrap();
    tracked.remaining = 0;
    tracked.status = "cancelled".into();
    Ok(Json(order_view(id, tracked)))
}

async fn orders(Path(wallet): Path<String>, State(state): State<Shared>) -> Json<Vec<OrderView>> {
    let app = state.lock().unwrap();
    let mut result: Vec<_> = app
        .tracked
        .iter()
        .filter(|(_, order)| order.wallet == wallet)
        .map(|(id, order)| order_view(*id, order))
        .collect();
    result.sort_by_key(|order| std::cmp::Reverse(order.created_at));
    Json(result)
}

async fn trades(
    Path((symbol, claim)): Path<(String, String)>,
    State(state): State<Shared>,
) -> Json<Vec<Trade>> {
    let app = state.lock().unwrap();
    Json(
        app.fills
            .iter()
            .filter(|trade| {
                trade.symbol.eq_ignore_ascii_case(&symbol)
                    && trade.claim.eq_ignore_ascii_case(&claim)
            })
            .cloned()
            .rev()
            .take(50)
            .collect(),
    )
}

async fn fills(Path(wallet): Path<String>, State(state): State<Shared>) -> Json<Vec<Trade>> {
    let app = state.lock().unwrap();
    Json(
        app.fills
            .iter()
            .filter(|trade| trade.buyer == wallet || trade.seller == wallet)
            .cloned()
            .rev()
            .take(100)
            .collect(),
    )
}

async fn candles(
    Path((symbol, interval)): Path<(String, String)>,
    State(state): State<Shared>,
) -> Json<CandleResponse> {
    let app = state.lock().unwrap();
    Json(app.history.candles(&symbol, &interval))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({"status":"ok","service":"rawmarket-engine","version":"0.2.0"}))
}

#[tokio::main]
async fn main() {
    let shared = Arc::new(Mutex::new(App {
        markets: markets(),
        books: HashMap::new(),
        accounts: HashMap::new(),
        tracked: HashMap::new(),
        fills: vec![],
        history: HistoryStore::embedded().expect("embedded market history must be valid"),
        receipt_writer: ReceiptWriter::from_env(),
    }));
    let app = Router::new()
        .route("/api/markets", get(list_markets))
        .route("/api/fund", post(fund))
        .route("/api/account/{wallet}", get(account))
        .route("/api/book/{symbol}/{claim}", get(book))
        .route("/api/trades/{symbol}/{claim}", get(trades))
        .route("/api/candles/{symbol}/{interval}", get(candles))
        .route("/api/fills/{wallet}", get(fills))
        .route("/api/orders", post(place))
        .route("/api/orders/{id}", get(orders).delete(cancel))
        .route("/health", get(health))
        .layer(CorsLayer::permissive())
        .with_state(shared);
    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let address = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&address).await.unwrap();
    println!("RawMarket engine listening on {address}");
    axum::serve(listener, app).await.unwrap();
}
