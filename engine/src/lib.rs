use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, VecDeque};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Side {
    Long,
    Short,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: Uuid,
    pub client_id: String,
    pub owner: String,
    pub side: Side,
    pub price_ticks: u64,
    pub qty: u64,
    pub remaining: u64,
    pub post_only: bool,
    pub immediate_or_cancel: bool,
    pub seq: u64,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Fill {
    pub maker: Uuid,
    pub taker: Uuid,
    pub price_ticks: u64,
    pub qty: u64,
    pub seq: u64,
}

#[derive(Default)]
pub struct Book {
    bids: BTreeMap<u64, VecDeque<Uuid>>,
    asks: BTreeMap<u64, VecDeque<Uuid>>,
    orders: HashMap<Uuid, Order>,
    clients: HashMap<(String, String), Uuid>,
    seq: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum BookError {
    DuplicateClientId,
    SelfTrade,
    PostOnlyWouldCross,
    Empty,
    Unknown,
}

impl Book {
    pub fn place(&mut self, mut order: Order) -> Result<(Uuid, Vec<Fill>), BookError> {
        if order.qty == 0 {
            return Err(BookError::Empty);
        }
        if self
            .clients
            .contains_key(&(order.owner.clone(), order.client_id.clone()))
        {
            return Err(BookError::DuplicateClientId);
        }
        order.remaining = order.qty;
        order.id = if order.id == Uuid::nil() {
            Uuid::new_v4()
        } else {
            order.id
        };
        self.seq += 1;
        order.seq = self.seq;
        if order.post_only && self.would_cross(&order) {
            return Err(BookError::PostOnlyWouldCross);
        }

        let mut fills = Vec::new();
        loop {
            let Some(maker_id) = self.best_crossing(&order) else {
                break;
            };
            if self
                .orders
                .get(&maker_id)
                .map(|maker| maker.owner == order.owner)
                .unwrap_or(false)
            {
                return Err(BookError::SelfTrade);
            }
            let (price_ticks, maker_qty) = {
                let maker = &self.orders[&maker_id];
                (maker.price_ticks, maker.remaining)
            };
            let qty = order.remaining.min(maker_qty);
            self.seq += 1;
            fills.push(Fill {
                maker: maker_id,
                taker: order.id,
                price_ticks,
                qty,
                seq: self.seq,
            });
            order.remaining -= qty;
            self.decrement(maker_id, qty);
            if order.remaining == 0 {
                break;
            }
        }

        if order.remaining > 0 && !order.immediate_or_cancel {
            self.insert(order.clone());
        }
        self.clients
            .insert((order.owner.clone(), order.client_id.clone()), order.id);
        Ok((order.id, fills))
    }

    fn insert(&mut self, order: Order) {
        let levels = match order.side {
            Side::Long => &mut self.bids,
            Side::Short => &mut self.asks,
        };
        levels
            .entry(order.price_ticks)
            .or_default()
            .push_back(order.id);
        self.orders.insert(order.id, order);
    }

    fn decrement(&mut self, id: Uuid, qty: u64) {
        let remove = {
            let order = self.orders.get_mut(&id).unwrap();
            order.remaining -= qty;
            order.remaining == 0
        };
        if remove {
            self.orders.remove(&id);
            for levels in [&mut self.bids, &mut self.asks] {
                for queue in levels.values_mut() {
                    queue.retain(|candidate| *candidate != id);
                }
            }
        }
    }

    fn would_cross(&self, order: &Order) -> bool {
        match order.side {
            Side::Long => self
                .asks
                .keys()
                .next()
                .map(|price| *price <= order.price_ticks)
                .unwrap_or(false),
            Side::Short => self
                .bids
                .keys()
                .next_back()
                .map(|price| *price >= order.price_ticks)
                .unwrap_or(false),
        }
    }

    fn best_crossing(&self, order: &Order) -> Option<Uuid> {
        match order.side {
            Side::Long => self
                .asks
                .iter()
                .find(|(price, queue)| **price <= order.price_ticks && !queue.is_empty())
                .and_then(|(_, queue)| queue.front())
                .copied(),
            Side::Short => self
                .bids
                .iter()
                .rev()
                .find(|(price, queue)| **price >= order.price_ticks && !queue.is_empty())
                .and_then(|(_, queue)| queue.front())
                .copied(),
        }
    }

    pub fn cancel(&mut self, id: Uuid) -> Result<Order, BookError> {
        let order = self.orders.remove(&id).ok_or(BookError::Unknown)?;
        for levels in [&mut self.bids, &mut self.asks] {
            for queue in levels.values_mut() {
                queue.retain(|candidate| *candidate != id);
            }
        }
        Ok(order)
    }

    pub fn best_bid(&self) -> Option<u64> {
        self.bids.keys().next_back().copied()
    }
    pub fn best_ask(&self) -> Option<u64> {
        self.asks.keys().next().copied()
    }
    pub fn mid(&self) -> Option<u64> {
        match (self.best_bid(), self.best_ask()) {
            (Some(bid), Some(ask)) => Some((bid + ask) / 2),
            _ => None,
        }
    }

    pub fn snapshot(&self) -> (Vec<(u64, u64)>, Vec<(u64, u64)>) {
        let bids = self
            .bids
            .iter()
            .rev()
            .filter_map(|(price, queue)| {
                let size = queue
                    .iter()
                    .filter_map(|id| self.orders.get(id).map(|order| order.remaining))
                    .sum();
                (size > 0).then_some((*price, size))
            })
            .collect();
        let asks = self
            .asks
            .iter()
            .filter_map(|(price, queue)| {
                let size = queue
                    .iter()
                    .filter_map(|id| self.orders.get(id).map(|order| order.remaining))
                    .sum();
                (size > 0).then_some((*price, size))
            })
            .collect();
        (bids, asks)
    }

    pub fn order(&self, id: Uuid) -> Option<Order> {
        self.orders.get(&id).cloned()
    }
    pub fn sequence(&self) -> u64 {
        self.seq
    }
}

pub fn payout(multiplier: u64, cap: u64, settlement: u64) -> (u64, u64) {
    let bounded = settlement.min(cap);
    (multiplier * bounded, multiplier * (cap - bounded))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn order(owner: &str, side: Side, price_ticks: u64, qty: u64, client: &str) -> Order {
        Order {
            id: Uuid::nil(),
            client_id: client.into(),
            owner: owner.into(),
            side,
            price_ticks,
            qty,
            remaining: 0,
            post_only: false,
            immediate_or_cancel: false,
            seq: 0,
        }
    }

    #[test]
    fn priority_and_resting_price() {
        let mut book = Book::default();
        let (first, _) = book.place(order("a", Side::Short, 105, 3, "a")).unwrap();
        let (better, _) = book.place(order("c", Side::Short, 104, 2, "c")).unwrap();
        let (_, fills) = book.place(order("t", Side::Long, 106, 4, "t")).unwrap();
        assert_eq!(
            fills
                .iter()
                .map(|fill| fill.price_ticks)
                .collect::<Vec<_>>(),
            vec![104, 105]
        );
        assert_eq!(fills.iter().map(|fill| fill.qty).sum::<u64>(), 4);
        assert!(book.cancel(first).is_ok());
        assert!(book.cancel(better).is_err());
    }

    #[test]
    fn self_trade_and_replay() {
        let mut book = Book::default();
        book.place(order("a", Side::Short, 100, 1, "x")).unwrap();
        assert_eq!(
            book.place(order("a", Side::Long, 101, 1, "y")),
            Err(BookError::SelfTrade)
        );
        assert_eq!(
            book.place(order("a", Side::Short, 99, 1, "x")),
            Err(BookError::DuplicateClientId)
        );
    }

    #[test]
    fn immediate_or_cancel_does_not_rest() {
        let mut book = Book::default();
        let mut ioc = order("a", Side::Long, 100, 3, "ioc");
        ioc.immediate_or_cancel = true;
        let (id, fills) = book.place(ioc).unwrap();
        assert!(fills.is_empty());
        assert!(book.order(id).is_none());
        assert!(book.snapshot().0.is_empty());
    }

    #[test]
    fn bounded_complementary_payout() {
        assert_eq!(payout(2000, 25, 30), (50000, 0));
        assert_eq!(payout(1, 20, 7), (7, 13));
    }
}
