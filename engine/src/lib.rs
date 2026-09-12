use std::collections::{BTreeMap, HashMap, VecDeque};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub enum Side { Long, Short }
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Order { pub id: Uuid, pub client_id: String, pub owner: String, pub side: Side, pub price_ticks: u64, pub qty: u64, pub remaining: u64, pub post_only: bool, pub seq: u64 }
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Fill { pub maker: Uuid, pub taker: Uuid, pub price_ticks: u64, pub qty: u64, pub seq: u64 }
#[derive(Default)]
pub struct Book { bids: BTreeMap<u64, VecDeque<Uuid>>, asks: BTreeMap<u64, VecDeque<Uuid>>, orders: HashMap<Uuid, Order>, clients: HashMap<(String,String),Uuid>, seq: u64 }
#[derive(Debug, PartialEq, Eq)] pub enum BookError { DuplicateClientId, SelfTrade, PostOnlyWouldCross, Empty, Unknown }
impl Book {
    pub fn place(&mut self, mut o: Order) -> Result<(Uuid, Vec<Fill>),BookError> {
        if o.qty == 0 { return Err(BookError::Empty); }
        if self.clients.contains_key(&(o.owner.clone(), o.client_id.clone())) { return Err(BookError::DuplicateClientId); }
        o.remaining=o.qty; o.id=if o.id==Uuid::nil(){Uuid::new_v4()}else{o.id}; self.seq+=1; o.seq=self.seq;
        if o.post_only && self.would_cross(&o) { return Err(BookError::PostOnlyWouldCross); }
        let mut fills=Vec::new();
        loop { let best=self.best_crossing(&o); let Some(mid)=best else {break};
            if self.orders.get(&mid).map(|m|m.owner==o.owner).unwrap_or(false) { return Err(BookError::SelfTrade); }
            let (price,mqty)= {let m=&self.orders[&mid];(m.price_ticks,m.remaining)}; let qty=o.remaining.min(mqty);
            self.seq+=1; fills.push(Fill{maker:mid,taker:o.id,price_ticks:price,qty,seq:self.seq});
            o.remaining-=qty; let done=o.remaining==0; self.decrement(mid,qty); if done{break;}
        }
        if o.remaining>0 { self.insert(o.clone()); }
        self.clients.insert((o.owner.clone(),o.client_id.clone()),o.id); Ok((o.id,fills))
    }
    fn insert(&mut self,o:Order){let map=match o.side{Side::Long=>&mut self.bids,Side::Short=>&mut self.asks};map.entry(o.price_ticks).or_default().push_back(o.id);self.orders.insert(o.id,o);}
    fn decrement(&mut self,id:Uuid,qty:u64){let remove={let x=self.orders.get_mut(&id).unwrap();x.remaining-=qty;x.remaining==0};if remove{self.orders.remove(&id);for map in [&mut self.bids,&mut self.asks]{for q in map.values_mut(){q.retain(|x|*x!=id);}}}}
    fn would_cross(&self,o:&Order)->bool{match o.side{Side::Long=>self.asks.keys().next().map(|p|*p<=o.price_ticks).unwrap_or(false),Side::Short=>self.bids.keys().next_back().map(|p|*p>=o.price_ticks).unwrap_or(false)}}
    fn best_crossing(&self,o:&Order)->Option<Uuid>{match o.side{Side::Long=>self.asks.iter().filter(|(p,q)|**p<=o.price_ticks && !q.is_empty()).next().and_then(|(_,q)|q.front()).copied(),Side::Short=>self.bids.iter().rev().filter(|(p,q)|**p>=o.price_ticks && !q.is_empty()).next().and_then(|(_,q)|q.front()).copied()}}
    pub fn cancel(&mut self,id:Uuid)->Result<Order,BookError>{let o=self.orders.remove(&id).ok_or(BookError::Unknown)?;for map in [&mut self.bids,&mut self.asks]{for q in map.values_mut(){q.retain(|x|*x!=id);}}Ok(o)}
    pub fn mid(&self)->Option<u64>{match (self.bids.keys().next_back(),self.asks.keys().next()){(Some(b),Some(a))=>Some((*b+*a)/2),_=>None}}
}
pub fn payout(m:u64,cap:u64,s:u64)->(u64,u64){let x=s.min(cap);(m*x,m*(cap-x))}
#[cfg(test)] mod tests {use super::*;fn o(owner:&str,side:Side,p:u64,q:u64,c:&str)->Order{Order{id:Uuid::nil(),client_id:c.into(),owner:owner.into(),side,price_ticks:p,qty:q,remaining:0,post_only:false,seq:0}}
#[test]fn priority_and_resting_price(){let mut b=Book::default();let(a,_)=b.place(o("a",Side::Short,105,3,"a")).unwrap();let(c,_)=b.place(o("c",Side::Short,104,2,"c")).unwrap();let(_,f)=b.place(o("t",Side::Long,106,4,"t")).unwrap();assert_eq!(f.iter().map(|x|x.price_ticks).collect::<Vec<_>>(),vec![104,105]);assert_eq!(f.iter().map(|x|x.qty).sum::<u64>(),4);assert!(b.cancel(a).is_ok());assert!(b.cancel(c).is_err());}
#[test]fn self_trade_and_replay(){let mut b=Book::default();b.place(o("a",Side::Short,100,1,"x")).unwrap();assert_eq!(b.place(o("a",Side::Long,101,1,"y")),Err(BookError::SelfTrade));assert_eq!(b.place(o("a",Side::Short,99,1,"x")),Err(BookError::DuplicateClientId));}
#[test]fn bounded_complementary_payout(){assert_eq!(payout(2000,25,30),(50000,0));assert_eq!(payout(1,20,7),(7,13));}}
