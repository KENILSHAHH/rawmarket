import type {CSSProperties} from 'react';
import {compact,money} from '@/lib/format';
import type {Book,Level} from '@/lib/types';

export function OrderBook({book,symbol,onPrice}:{book:Book|null;symbol:string;onPrice:(price:number)=>void}){
  const asks=book?.asks.slice(0,7)||[],bids=book?.bids.slice(0,7)||[];
  const maxSize=Math.max(1,...asks.map(level=>level.size),...bids.map(level=>level.size));
  const spread=asks[0]&&bids[0]?asks[0].price-bids[0].price:0;
  const row=(level:Level,side:'ask'|'bid')=><button className={`book-row ${side}`} key={`${side}-${level.price}`} onClick={()=>onPrice(level.price)} style={{'--depth':`${Math.max(8,(level.size/maxSize)*100)}%`} as CSSProperties}><span>{level.price.toFixed(2)}</span><span>{compact(level.size)}</span><span>{money(level.total).replace('$','')}</span></button>;
  return <section className="book-card panel"><div className="book-tabs"><button className="selected">Order Book</button><button>Trades</button><button aria-label="Order book settings">•••</button></div><div className="book-toolbar"><span>0.01</span><strong>{symbol}</strong></div><div className="book-columns"><span>Price (USD)</span><span>Size ({symbol})</span><span>Total</span></div><div className="book-side asks">{[...asks].reverse().map(level=>row(level,'ask'))}</div><div className="spread-row"><div><strong>{book?.last.toFixed(2)||'—'}</strong><span>mid</span></div><div><strong>{spread?spread.toFixed(2):'—'}</strong><span>spread</span></div></div><div className="book-side">{bids.map(level=>row(level,'bid'))}</div></section>;
}
