'use client';

import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, BookOpen, Check,
  ChevronDown, CircleAlert, ExternalLink, Landmark, Menu, RefreshCw, Search,
  ShieldCheck, SlidersHorizontal, WalletCards, X,
} from 'lucide-react';
import {useCallback, useEffect, useMemo, useState} from 'react';

type Market={symbol:string;name:string;unit:string;m:number;cap:number;status:string;expiry:string;description:string;reference:number};
type Level={price:number;size:number;total:number};
type Book={symbol:string;claim:string;bids:Level[];asks:Level[];last:number;sequence:number};
type Position={available:number;reserved:number};
type Account={wallet:string;cash:number;reserved_cash:number;available_cash:number;positions:Record<string,Position>;open_orders:number;funded:boolean};
type Candle={time:string;open:number;high:number;low:number;close:number;volume:number;source:string};
type CandleResponse={interval:string;source_status:string;coverage:string;candles:Candle[]};
type Order={id:string;symbol:string;claim:string;wallet:string;side:'buy'|'sell';order_type:string;price:number;qty:number;filled:number;remaining:number;status:string;created_at:number};
type Trade={id:string;symbol:string;claim:string;price:number;qty:number;buyer:string;seller:string;timestamp:number};

const API=process.env.NEXT_PUBLIC_ENGINE_URL||'http://localhost:8080';
const EMPTY_ACCOUNT:Account={wallet:'',cash:0,reserved_cash:0,available_cash:0,positions:{},open_orders:0,funded:false};
const FALLBACK_MARKETS:Market[]=[
  {symbol:'MILK',name:'US Class III Milk',unit:'USD/cwt',m:2000,cap:25,status:'live demo',expiry:'2026-10-31T14:00:00Z',description:'USDA announced Class III price; 2,000 cwt reference exposure',reference:16.64},
  {symbol:'POTATO',name:'RawMarket US Russet Potato Index v1',unit:'USD / 50 lb carton',m:1,cap:35,status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'Russet Norkotah, U.S. One, 70-count, 50 lb cartons',reference:20},
  {symbol:'TOMATO',name:'RawMarket US Round Tomato Index v1',unit:'USD / 25 lb carton',m:1,cap:40,status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'Round mature-green, U.S. One or better, 5x6, 25 lb cartons',reference:18},
  ...[['WHEAT','US Wheat Index v1','USD / bushel',15,6.1],['CORN','US Corn Index v1','USD / bushel',10,4.5],['RICE','US Rice Index v1','USD / cwt',30,18],['SOYBEAN','US Soybean Index v1','USD / bushel',25,10.2],['DRY_BEAN','US Dry Bean Index v1','USD / cwt',80,42]].map(([symbol,name,unit,cap,reference])=>({symbol:String(symbol),name:String(name),unit:String(unit),m:1,cap:Number(cap),status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'US benchmark specification pending coverage audit',reference:Number(reference)})),
];

async function request<T>(path:string,init?:RequestInit):Promise<T>{
  const response=await fetch(`${API}${path}`,{...init,headers:{'content-type':'application/json',...(init?.headers||{})},cache:'no-store'});
  if(!response.ok){const body=await response.text();throw new Error(body.replace(/^"|"$/g,'')||`Request failed (${response.status})`)}
  return response.json() as Promise<T>;
}

const money=(value:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',minimumFractionDigits:2,maximumFractionDigits:2}).format(value||0);
const compact=(value:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(value||0);
const stamp=(seconds:number)=>new Date(seconds*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const availability=(status:string)=>status.toLowerCase().includes('live')?'Trading':'Preview';
const sourceStatus=(status:string)=>{
  const normalized=status.toLowerCase();
  if(normalized.includes('verified'))return 'USDA verified';
  if(normalized.includes('loading'))return 'Loading';
  if(normalized.includes('unavailable'))return 'Unavailable';
  return 'Reference data';
};

function CommodityMark({symbol}:{symbol:string}){
  const letters:Record<string,string>={MILK:'MK',POTATO:'PT',TOMATO:'TM',WHEAT:'WH',CORN:'CR',RICE:'RC',SOYBEAN:'SB',DRY_BEAN:'DB'};
  return <span className={`commodity-mark mark-${symbol.toLowerCase()}`}>{letters[symbol]||symbol.slice(0,2)}</span>;
}

function CandleChart({market,data,timeframe,onTimeframe}:{market:Market;data:CandleResponse;timeframe:string;onTimeframe:(value:string)=>void}){
  const candles=data.candles;
  const values=candles.flatMap(item=>[item.high,item.low]);
  const max=Math.max(market.reference*1.03,...values);
  const min=Math.min(market.reference*.97,...values);
  const span=max-min||1;
  const y=(value:number)=>360-((value-min)/span)*285;
  const frames=['1D','1W','1M','3M','1Y','5Y','25Y'];
  return <section className="chart-card panel">
    <div className="panel-heading chart-heading"><div><h2>{market.symbol} / USD</h2><span>Reference index</span></div><div className="chart-legend"><span className="status-dot"/> {sourceStatus(data.source_status)}</div></div>
    <div className="chart-tools"><div className="timeframes">{frames.map(frame=><button key={frame} className={timeframe===frame?'selected':''} onClick={()=>onTimeframe(frame)}>{frame}</button>)}</div><div className="chart-actions"><button><BarChart3 size={14}/> Candles</button><button><SlidersHorizontal size={14}/> Indicators</button></div></div>
    <div className="chart-canvas">
      <svg viewBox="0 0 920 410" preserveAspectRatio="none" role="img" aria-label={`${market.symbol} reference price candlestick chart`}>
        <g className="grid"><path d="M0 45H920M0 120H920M0 195H920M0 270H920M0 345H920"/><path d="M80 0V410M250 0V410M420 0V410M590 0V410M760 0V410"/></g>
        <line className="reference-line" x1="0" x2="920" y1={y(market.reference)} y2={y(market.reference)}/>
        {candles.map((item,index)=>{const x=90+(index/Math.max(candles.length-1,1))*720;const open=y(item.open),close=y(item.close);const positive=item.close>=item.open;return <g key={item.time} className={positive?'candle-up':'candle-down'}><line x1={x} x2={x} y1={y(item.high)} y2={y(item.low)}/><rect x={x-8} y={Math.min(open,close)-1} width="16" height={Math.max(3,Math.abs(open-close)+2)}/></g>})}
      </svg>
      <div className="price-axis"><span>{money(max)}</span><span>{money(min+span*.75)}</span><span>{money(min+span*.5)}</span><span>{money(min+span*.25)}</span><span>{money(min)}</span></div>
      {!candles.length&&<div className="chart-empty"><div className="empty-orbit"><Activity size={22}/></div><strong>No verified candles for this window</strong><p>{data.coverage||'The source adapter has not published compatible observations.'}</p></div>}
      {candles.length>0&&<div className="source-pill"><ShieldCheck size={13}/>{candles[0].source}</div>}
    </div>
    <div className="chart-foot"><span>{candles[0]?.time||'Source window unavailable'}</span><span>Reference {money(market.reference)}</span><span>{market.unit}</span></div>
  </section>
}

function OrderBook({book,symbol,onPrice}:{book:Book|null;symbol:string;onPrice:(price:number)=>void}){
  const asks=book?.asks.slice(0,7)||[],bids=book?.bids.slice(0,7)||[];
  const maxSize=Math.max(1,...asks.map(level=>level.size),...bids.map(level=>level.size));
  const spread=asks[0]&&bids[0]?asks[0].price-bids[0].price:0;
  const row=(level:Level,side:'ask'|'bid')=><button className={`book-row ${side}`} key={`${side}-${level.price}`} onClick={()=>onPrice(level.price)} style={{'--depth':`${Math.max(8,(level.size/maxSize)*100)}%`} as React.CSSProperties}><span>{level.price.toFixed(2)}</span><span>{compact(level.size)}</span><span>{money(level.total).replace('$','')}</span></button>;
  return <section className="book-card panel"><div className="panel-heading"><div><h2>Order book</h2></div></div><div className="book-columns"><span>Price (USD)</span><span>Size ({symbol})</span><span>Total</span></div><div className="book-side asks">{[...asks].reverse().map(level=>row(level,'ask'))}</div><div className="spread-row"><div><strong>{book?.last.toFixed(2)||'—'}</strong><span>mid</span></div><div><strong>{spread?spread.toFixed(2):'—'}</strong><span>spread</span></div></div><div className="book-side">{bids.map(level=>row(level,'bid'))}</div></section>;
}

export default function Home(){
  const [markets,setMarkets]=useState<Market[]>(FALLBACK_MARKETS);
  const [symbol,setSymbol]=useState('MILK');
  const [book,setBook]=useState<Book|null>(null);
  const [account,setAccount]=useState<Account>(EMPTY_ACCOUNT);
  const [orders,setOrders]=useState<Order[]>([]);
  const [fills,setFills]=useState<Trade[]>([]);
  const [publicTrades,setPublicTrades]=useState<Trade[]>([]);
  const [candles,setCandles]=useState<CandleResponse>({interval:'1D',source_status:'Loading source data',coverage:'',candles:[]});
  const [wallet,setWallet]=useState('');
  const [connected,setConnected]=useState(false);
  const [engineOnline,setEngineOnline]=useState(false);
  const [side,setSide]=useState<'buy'|'sell'>('buy');
  const [orderType,setOrderType]=useState<'limit'|'market'>('limit');
  const [price,setPrice]=useState('');
  const [qty,setQty]=useState('1');
  const [postOnly,setPostOnly]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [toast,setToast]=useState<{kind:'success'|'error'|'info';message:string}|null>(null);
  const [timeframe,setTimeframe]=useState('1D');
  const [marketMenu,setMarketMenu]=useState(false);
  const [search,setSearch]=useState('');
  const [dockTab,setDockTab]=useState<'orders'|'fills'|'balances'>('orders');
  const [methodology,setMethodology]=useState(false);
  const market=markets.find(item=>item.symbol===symbol)||FALLBACK_MARKETS[0];
  const position=account.positions[`${symbol}:SPOT`]||{available:0,reserved:0};
  const executablePrice=side==='buy'?book?.asks[0]?.price:book?.bids[0]?.price;
  const effectivePrice=orderType==='market'?(executablePrice||0):Number(price||0);
  const orderValue=effectivePrice*Number(qty||0);
  const filteredMarkets=markets.filter(item=>`${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase()));
  const openOrders=orders.filter(order=>order.remaining>0&&(order.status==='open'||order.status==='partially_filled'));

  useEffect(()=>{
    let id=localStorage.getItem('rawmarket-demo-wallet');
    if(!id){id=`rm-${crypto.randomUUID().slice(0,8)}`;localStorage.setItem('rawmarket-demo-wallet',id)}
    setWallet(id);
  },[]);

  const refreshMarket=useCallback(async(silent=false)=>{
    try{
      const [nextBook,nextTrades]=await Promise.all([request<Book>(`/api/book/${symbol}/SPOT`),request<Trade[]>(`/api/trades/${symbol}/SPOT`)]);
      setBook(nextBook);setPublicTrades(nextTrades);setEngineOnline(true);
      if(!price&&nextBook.asks[0])setPrice(nextBook.asks[0].price.toFixed(2));
    }catch(error){setEngineOnline(false);if(!silent)setToast({kind:'error',message:error instanceof Error?error.message:'Engine unavailable'})}
  },[symbol,price]);

  const refreshAccount=useCallback(async()=>{
    if(!wallet)return;
    try{
      const [nextAccount,nextOrders,nextFills]=await Promise.all([request<Account>(`/api/account/${wallet}`),request<Order[]>(`/api/orders/${wallet}`),request<Trade[]>(`/api/fills/${wallet}`)]);
      setAccount(nextAccount);setOrders(nextOrders);setFills(nextFills);setConnected(nextAccount.funded);
    }catch{/* The trading controls remain unavailable until connectivity resumes. */}
  },[wallet]);

  useEffect(()=>{request<Market[]>('/api/markets').then(setMarkets).catch(()=>{});},[]);
  useEffect(()=>{setPrice('');refreshMarket();const timer=setInterval(()=>refreshMarket(true),2500);return()=>clearInterval(timer)},[symbol,refreshMarket]);
  useEffect(()=>{request<CandleResponse>(`/api/candles/${symbol}/${timeframe}`).then(setCandles).catch(()=>setCandles({interval:timeframe,source_status:'Source unavailable',coverage:'The verified source adapter did not respond.',candles:[]}))},[symbol,timeframe]);
  useEffect(()=>{refreshAccount();const timer=setInterval(refreshAccount,3000);return()=>clearInterval(timer)},[refreshAccount]);

  const chooseMarket=(next:string)=>{setSymbol(next);setMarketMenu(false);setSearch('');setToast(null)};
  const connect=async()=>{if(!wallet)return;setSubmitting(true);try{const next=await request<Account>('/api/fund',{method:'POST',body:JSON.stringify({wallet,amount:10000})});setAccount(next);setConnected(true);setToast({kind:'success',message:'Account connected'})}catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Connection failed'})}finally{setSubmitting(false)}};
  const submit=async()=>{
    if(!connected){await connect();return}
    const amount=Number(qty);
    if(!Number.isInteger(amount)||amount<=0){setToast({kind:'error',message:'Quantity must be a positive whole number'});return}
    if(orderType==='limit'&&(!Number(price)||Number(price)<=0)){setToast({kind:'error',message:'Enter a valid limit price'});return}
    setSubmitting(true);setToast({kind:'info',message:'Submitting order…'});
    try{
      const result=await request<Order[]>('/api/orders',{method:'POST',body:JSON.stringify({wallet,symbol,claim:'SPOT',side,price:orderType==='limit'?Number(price):undefined,qty:amount,client_id:`web-${crypto.randomUUID()}`,post_only:orderType==='limit'&&postOnly,order_type:orderType})});
      const own=result.find(item=>item.wallet===wallet);
      const filled=own?.filled||0;
      setToast({kind:'success',message:filled?`${side==='buy'?'Bought':'Sold'} ${filled} ${symbol} at the resting book price`:`Order accepted · ${own?.status||'open'}`});
      await Promise.all([refreshMarket(true),refreshAccount()]);
    }catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Order rejected'})}finally{setSubmitting(false)}
  };
  const cancelOrder=async(id:string)=>{try{await request<Order>(`/api/orders/${id}`,{method:'DELETE'});setToast({kind:'success',message:'Order cancelled and reservation released'});await Promise.all([refreshMarket(true),refreshAccount()])}catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Cancellation failed'})}};
  const setPercent=(percent:number)=>{const maximum=side==='buy'?Math.floor(account.available_cash/Math.max(effectivePrice,0.01)):Math.max(0,position.available-position.reserved);setQty(String(Math.max(percent?1:0,Math.floor(maximum*percent/100))))};

  return <main className="app-shell">
    <header className="topbar"><div className="brand"><div className="brand-glyph"><span/><span/><span/></div><div>RAW<span>MARKET</span></div></div><nav><button className="active">Trade</button><button onClick={()=>setDockTab('balances')}>Portfolio</button><button onClick={()=>setMarketMenu(true)}>Markets</button><button onClick={()=>setMethodology(true)}>Methodology</button></nav><div className="top-actions"><a className="network-pill" href="https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA" target="_blank" rel="noreferrer"><Landmark size={13}/><span>Testnet</span><ChevronDown size={12}/></a><button className="wallet-button" onClick={connect} disabled={submitting}><WalletCards size={15}/>{connected?<><span>{wallet.slice(0,7)}…{wallet.slice(-3)}</span><i/></>:'Connect'}</button></div><button className="mobile-menu" onClick={()=>setMarketMenu(true)}><Menu size={19}/></button></header>

    <section className="market-bar"><button className="market-picker" onClick={()=>setMarketMenu(true)}><CommodityMark symbol={symbol}/><div><strong>{symbol}<small>/ USD</small></strong><span>{market.name}</span></div><ChevronDown size={16}/></button><div className="market-stat primary"><span>LAST PRICE</span><strong>{money(book?.last||market.reference)}</strong><small>{market.unit}</small></div><div className="market-stat"><span>REFERENCE</span><strong>{money(market.reference)}</strong><small>{market.unit}</small></div><div className="market-stat"><span>BEST BID</span><strong className="positive">{book?.bids[0]?money(book.bids[0].price):'—'}</strong><small>{book?.bids[0]?`${book.bids[0].size} ${symbol}`:'—'}</small></div><div className="market-stat"><span>BEST ASK</span><strong className="negative">{book?.asks[0]?money(book.asks[0].price):'—'}</strong><small>{book?.asks[0]?`${book.asks[0].size} ${symbol}`:'—'}</small></div><div className="market-stat"><span>EXPIRY</span><strong>{new Date(market.expiry).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</strong><small>14:00 UTC</small></div><div className="market-stat"><span>MARKET</span><strong className={market.status.includes('live')?'positive':'warning'}>{availability(market.status)}</strong><small>Spot</small></div></section>

    <div className="workspace"><div className="workspace-main"><div className="market-workspace"><CandleChart market={market} data={candles} timeframe={timeframe} onTimeframe={setTimeframe}/><OrderBook book={book} symbol={symbol} onPrice={value=>{setPrice(value.toFixed(2));setOrderType('limit')}}/><section className="trades-card panel"><div className="panel-heading"><div><h2>Recent trades</h2></div><Activity size={15}/></div><div className="trade-head"><span>Price</span><span>Size</span><span>Time</span></div><div className="trade-list">{publicTrades.length?publicTrades.map(trade=><div className="trade-row" key={trade.id}><span className={trade.buyer===wallet?'positive':'negative'}>{trade.price.toFixed(2)}</span><span>{trade.qty}</span><span>{stamp(trade.timestamp)}</span></div>):<div className="compact-empty">No trades</div>}</div></section></div></div>

      <aside className="order-ticket"><div className="ticket-heading"><div><strong>Place order</strong><span>{symbol} / USD</span></div><div className="mode-pill">Spot</div></div><div className="side-switch"><button className={side==='buy'?'buy selected':''} onClick={()=>setSide('buy')}><ArrowDownRight size={15}/> Buy</button><button className={side==='sell'?'sell selected':''} onClick={()=>setSide('sell')}><ArrowUpRight size={15}/> Sell</button></div><div className="type-tabs"><button className={orderType==='limit'?'selected':''} onClick={()=>setOrderType('limit')}>Limit</button><button className={orderType==='market'?'selected':''} onClick={()=>setOrderType('market')}>Market</button></div><div className="account-summary"><div><span>Available cash</span><strong>{money(account.available_cash)}</strong></div><div><span>Available {symbol}</span><strong>{position.available-position.reserved}</strong></div></div>{orderType==='limit'?<label className="field"><span>Limit price <small>{market.unit}</small></span><div><input inputMode="decimal" value={price} onChange={event=>setPrice(event.target.value)} placeholder="0.00"/><b>USD</b></div></label>:<div className="market-price"><span>Estimated execution</span><strong>{executablePrice?money(executablePrice):'No liquidity'}</strong><small>Best available price</small></div>}<label className="field"><span>Quantity <small>whole units</small></span><div><input inputMode="numeric" value={qty} onChange={event=>setQty(event.target.value.replace(/\D/g,''))} placeholder="1"/><b>{symbol}</b></div></label><div className="percent-row">{[25,50,75,100].map(value=><button key={value} onClick={()=>setPercent(value)}>{value}%</button>)}</div>{orderType==='limit'&&<label className="check-row"><input type="checkbox" checked={postOnly} onChange={event=>setPostOnly(event.target.checked)}/><span>Post only</span><small>Maker only</small></label>}<div className="order-review"><div><span>Order value</span><strong>{money(orderValue)}</strong></div><div><span>Fee</span><strong>$0.00</strong></div></div><button className={`submit-order ${side}`} onClick={submit} disabled={submitting||!engineOnline}>{submitting?<><RefreshCw className="spin" size={16}/> Processing…</>:!connected?'Connect':`${side==='buy'?'Buy':'Sell'} ${symbol}`}</button>{toast&&<div className={`toast ${toast.kind}`}>{toast.kind==='success'?<Check size={15}/>:toast.kind==='error'?<CircleAlert size={15}/>:<RefreshCw className="spin" size={15}/>}<span>{toast.message}</span><button onClick={()=>setToast(null)}><X size={13}/></button></div>}</aside>
    </div>

    <section className="portfolio panel"><div className="portfolio-tabs"><button className={dockTab==='orders'?'selected':''} onClick={()=>setDockTab('orders')}>Open orders <b>{openOrders.length}</b></button><button className={dockTab==='fills'?'selected':''} onClick={()=>setDockTab('fills')}>Trade history <b>{fills.length}</b></button><button className={dockTab==='balances'?'selected':''} onClick={()=>setDockTab('balances')}>Balances</button><div className="portfolio-value"><span>PORTFOLIO</span><strong>{money(account.cash)}</strong><small>{money(account.reserved_cash)} reserved</small></div></div>{dockTab==='orders'&&<div className="data-table"><div className="table-head"><span>Market</span><span>Side</span><span>Type</span><span>Price</span><span>Filled / Qty</span><span>Status</span><span/></div>{openOrders.length?openOrders.map(order=><div className="table-row" key={order.id}><strong>{order.symbol}/USD</strong><span className={order.side==='buy'?'positive':'negative'}>{order.side.toUpperCase()}</span><span>{order.order_type}</span><span>{money(order.price)}</span><span>{order.filled} / {order.qty}</span><span><i className="open-dot"/> {order.status}</span><button onClick={()=>cancelOrder(order.id)}>Cancel</button></div>):<div className="table-empty"><BookOpen size={19}/><div><strong>No open orders</strong><span>Your active orders will appear here.</span></div></div>}</div>}{dockTab==='fills'&&<div className="data-table"><div className="table-head six"><span>Market</span><span>Side</span><span>Price</span><span>Quantity</span><span>Value</span><span>Time</span></div>{fills.length?fills.map(fill=>{const mine=fill.buyer===wallet?'buy':'sell';return <div className="table-row six" key={fill.id}><strong>{fill.symbol}/USD</strong><span className={mine==='buy'?'positive':'negative'}>{mine.toUpperCase()}</span><span>{money(fill.price)}</span><span>{fill.qty}</span><span>{money(fill.price*fill.qty)}</span><span>{stamp(fill.timestamp)}</span></div>}):<div className="table-empty"><Activity size={19}/><div><strong>No trades yet</strong><span>Your completed trades will appear here.</span></div></div>}</div>}{dockTab==='balances'&&<div className="balance-grid"><div><span>Cash balance</span><strong>{money(account.cash)}</strong><small>USD</small></div><div><span>Available cash</span><strong>{money(account.available_cash)}</strong><small>After reservations</small></div><div><span>Reserved cash</span><strong>{money(account.reserved_cash)}</strong><small>Open buy orders</small></div><div><span>{symbol} inventory</span><strong>{position.available}</strong><small>{position.reserved} reserved</small></div></div>}</section>

    <footer><div><Landmark size={11}/><strong>Hedera Testnet</strong></div><div>RawMarket</div><div><button onClick={()=>setMethodology(true)}>Market details</button><a href="https://github.com/KENILSHAHH/rawmarket" target="_blank" rel="noreferrer">GitHub <ExternalLink size={11}/></a><a href="https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA" target="_blank" rel="noreferrer">HashScan <ExternalLink size={11}/></a></div></footer>

    {marketMenu&&<div className="modal-backdrop" onMouseDown={()=>setMarketMenu(false)}><div className="market-modal" onMouseDown={event=>event.stopPropagation()}><div className="modal-title"><div><span>MARKETS</span><h2>Select a commodity</h2></div><button onClick={()=>setMarketMenu(false)}><X size={18}/></button></div><div className="market-search"><Search size={15}/><input autoFocus value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search markets"/></div><div className="market-list"><div className="market-list-head"><span>Market</span><span>Reference</span><span>Unit</span><span>Availability</span></div>{filteredMarkets.map(item=><button key={item.symbol} onClick={()=>chooseMarket(item.symbol)} className={item.symbol===symbol?'selected':''}><div><CommodityMark symbol={item.symbol}/><span><strong>{item.symbol}/USD</strong><small>{item.name}</small></span></div><b>{money(item.reference)}</b><span>{item.unit}</span><em className={item.status.includes('live')?'positive':'warning'}>{availability(item.status)}</em></button>)}</div></div></div>}
    {methodology&&<div className="modal-backdrop" onMouseDown={()=>setMethodology(false)}><aside className="methodology-drawer" onMouseDown={event=>event.stopPropagation()}><div className="modal-title"><div><span>MARKET DETAILS</span><h2>{market.name}</h2></div><button onClick={()=>setMethodology(false)}><X size={18}/></button></div><div className="methodology-body"><div className="spec-hero"><CommodityMark symbol={symbol}/><div><strong>{symbol}/USD</strong><span>{availability(market.status)}</span></div></div><p>{market.description}</p><dl><div><dt>Quotation unit</dt><dd>{market.unit}</dd></div><div><dt>Reference value</dt><dd>{money(market.reference)}</dd></div><div><dt>Contract multiplier</dt><dd>{market.m.toLocaleString()}</dd></div><div><dt>Published cap</dt><dd>{money(market.cap)}</dd></div><div><dt>Trading cutoff</dt><dd>{new Date(market.expiry).toLocaleString()}</dd></div><div><dt>Data quality</dt><dd>{sourceStatus(candles.source_status)}</dd></div></dl><div className="method-note"><ShieldCheck size={16}/><p>Reference prices, order-book prices, completed trades and final settlement values are maintained as distinct market data.</p></div><a href="https://github.com/KENILSHAHH/rawmarket" target="_blank" rel="noreferrer">View methodology <ExternalLink size={13}/></a></div></aside></div>}
  </main>;
}
