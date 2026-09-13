import {Activity} from 'lucide-react';
import {stamp} from '@/lib/format';
import type {Trade} from '@/lib/types';

export function RecentTrades({trades,wallet}:{trades:Trade[];wallet:string}){
  return <section className="trades-card panel"><div className="panel-heading"><div><h2>Recent trades</h2></div><Activity size={15}/></div><div className="trade-head"><span>Price</span><span>Size</span><span>Time</span></div><div className="trade-list">{trades.length?trades.map(trade=><div className="trade-row" key={trade.id}><span className={trade.buyer===wallet?'positive':'negative'}>{trade.price.toFixed(2)}</span><span>{trade.qty}</span><span>{stamp(trade.timestamp)}</span></div>):<div className="compact-empty">No trades</div>}</div></section>;
}
