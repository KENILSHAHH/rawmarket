import {ChevronDown} from 'lucide-react';
import {availability,money} from '@/lib/format';
import type {Book,Market} from '@/lib/types';
import {CommodityMark} from './CommodityMark';

export function MarketSummary({market,book,onOpenMarkets}:{market:Market;book:Book|null;onOpenMarkets:()=>void}){
  return <section className="market-bar">
    <button className="market-picker" onClick={onOpenMarkets}><CommodityMark symbol={market.symbol}/><div><strong>{market.symbol}<small>/ USD</small></strong><span>{market.name}</span></div><ChevronDown size={16}/></button>
    <div className="market-stat primary"><span>LAST PRICE</span><strong>{money(book?.last||market.reference)}</strong><small>{market.unit}</small></div>
    <div className="market-stat"><span>REFERENCE</span><strong>{money(market.reference)}</strong><small>{market.unit}</small></div>
    <div className="market-stat"><span>BEST BID</span><strong className="positive">{book?.bids[0]?money(book.bids[0].price):'—'}</strong><small>{book?.bids[0]?`${book.bids[0].size} ${market.symbol}`:'—'}</small></div>
    <div className="market-stat"><span>BEST ASK</span><strong className="negative">{book?.asks[0]?money(book.asks[0].price):'—'}</strong><small>{book?.asks[0]?`${book.asks[0].size} ${market.symbol}`:'—'}</small></div>
    <div className="market-stat"><span>EXPIRY</span><strong>{new Date(market.expiry).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong><small>14:00 UTC</small></div>
    <div className="market-stat"><span>MARKET</span><strong className={market.status.includes('live')?'positive':'warning'}>{availability(market.status)}</strong><small>Spot</small></div>
  </section>;
}
