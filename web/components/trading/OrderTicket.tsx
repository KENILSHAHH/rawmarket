import {ArrowDownRight,ArrowUpRight,Check,CircleAlert,RefreshCw,X} from 'lucide-react';
import {money} from '@/lib/format';
import {hashscanTransactionUrl} from '@/lib/constants';
import type {Market,OrderType,Position,Side,Toast} from '@/lib/types';

type Props={market:Market;side:Side;orderType:OrderType;price:string;qty:string;postOnly:boolean;availableCash:number;position:Position;executablePrice?:number;orderValue:number;connected:boolean;engineOnline:boolean;submitting:boolean;toast:Toast|null;onSide:(value:Side)=>void;onOrderType:(value:OrderType)=>void;onPrice:(value:string)=>void;onQty:(value:string)=>void;onPostOnly:(value:boolean)=>void;onPercent:(value:number)=>void;onSubmit:()=>void;onDismissToast:()=>void};

export function OrderTicket({market,side,orderType,price,qty,postOnly,availableCash,position,executablePrice,orderValue,connected,engineOnline,submitting,toast,onSide,onOrderType,onPrice,onQty,onPostOnly,onPercent,onSubmit,onDismissToast}:Props){
  return <aside className="order-ticket">
    <div className="ticket-heading"><div><strong>Place order</strong><span>{market.symbol} / USD</span></div><div className="mode-pill">Spot</div></div>
    <div className="side-switch"><button className={side==='buy'?'buy selected':''} onClick={()=>onSide('buy')}><ArrowDownRight size={15}/> Buy</button><button className={side==='sell'?'sell selected':''} onClick={()=>onSide('sell')}><ArrowUpRight size={15}/> Sell</button></div>
    <div className="type-tabs"><button className={orderType==='limit'?'selected':''} onClick={()=>onOrderType('limit')}>Limit</button><button className={orderType==='market'?'selected':''} onClick={()=>onOrderType('market')}>Market</button></div>
    <div className="account-summary"><div><span>Available cash</span><strong>{money(availableCash)}</strong></div><div><span>Available {market.symbol}</span><strong>{position.available-position.reserved}</strong></div></div>
    {orderType==='limit'?<label className="field"><span>Limit price <small>{market.unit}</small></span><div><input inputMode="decimal" value={price} onChange={event=>onPrice(event.target.value)} placeholder="0.00"/><b>USD</b></div></label>:<div className="market-price"><span>Estimated execution</span><strong>{executablePrice?money(executablePrice):'No liquidity'}</strong><small>Best available price</small></div>}
    <label className="field"><span>Quantity <small>whole units</small></span><div><input inputMode="numeric" value={qty} onChange={event=>onQty(event.target.value.replace(/\D/g,''))} placeholder="1"/><b>{market.symbol}</b></div></label>
    <div className="percent-row">{[25,50,75,100].map(value=><button key={value} onClick={()=>onPercent(value)}>{value}%</button>)}</div>
    {orderType==='limit'&&<label className="check-row"><input type="checkbox" checked={postOnly} onChange={event=>onPostOnly(event.target.checked)}/><span>Post only</span><small>Maker only</small></label>}
    <div className="order-review"><div><span>Order value</span><strong>{money(orderValue)}</strong></div><div><span>Fee</span><strong>$0.00</strong></div></div>
    <button className={`submit-order ${side}`} onClick={onSubmit} disabled={submitting||!engineOnline}>{submitting?<><RefreshCw className="spin" size={16}/> Processing…</>:!connected?'Connect':`${side==='buy'?'Buy':'Sell'} ${market.symbol}`}</button>
    {toast&&<div className={`toast ${toast.kind}`}>{toast.kind==='success'?<Check size={15}/>:toast.kind==='error'?<CircleAlert size={15}/>:<RefreshCw className="spin" size={15}/>}<span>{toast.message}{toast.transactionId&&<a href={hashscanTransactionUrl(toast.transactionId)} target="_blank" rel="noreferrer">View Hedera order receipt ↗</a>}</span><button onClick={onDismissToast}><X size={13}/></button></div>}
  </aside>;
}
