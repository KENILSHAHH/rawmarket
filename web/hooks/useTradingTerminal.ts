'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {apiRequest} from '@/lib/api';
import {EMPTY_ACCOUNT,FALLBACK_MARKETS} from '@/lib/constants';
import type {Account,Book,CandleResponse,DockTab,Market,Order,OrderType,Side,Toast,Trade} from '@/lib/types';

const EMPTY_CANDLES:CandleResponse={interval:'5Y',frequency:'unavailable',source_status:'Loading source data',coverage:'',candles:[]};

export function useTradingTerminal(){
  const [markets,setMarkets]=useState<Market[]>(FALLBACK_MARKETS);
  const [symbol,setSymbol]=useState('MILK');
  const [book,setBook]=useState<Book|null>(null);
  const [account,setAccount]=useState<Account>(EMPTY_ACCOUNT);
  const [orders,setOrders]=useState<Order[]>([]);
  const [fills,setFills]=useState<Trade[]>([]);
  const [publicTrades,setPublicTrades]=useState<Trade[]>([]);
  const [candles,setCandles]=useState<CandleResponse>(EMPTY_CANDLES);
  const [wallet,setWallet]=useState('');
  const [connected,setConnected]=useState(false);
  const [engineOnline,setEngineOnline]=useState(false);
  const [side,setSide]=useState<Side>('buy');
  const [orderType,setOrderType]=useState<OrderType>('limit');
  const [price,setPrice]=useState('');
  const [qty,setQty]=useState('1');
  const [postOnly,setPostOnly]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const [toast,setToast]=useState<Toast|null>(null);
  const [timeframe,setTimeframe]=useState('5Y');
  const [marketMenu,setMarketMenu]=useState(false);
  const [search,setSearch]=useState('');
  const [dockTab,setDockTab]=useState<DockTab>('orders');
  const [methodology,setMethodology]=useState(false);

  const market=markets.find(item=>item.symbol===symbol)||FALLBACK_MARKETS[0];
  const position=account.positions[`${symbol}:SPOT`]||{available:0,reserved:0};
  const executablePrice=side==='buy'?book?.asks[0]?.price:book?.bids[0]?.price;
  const effectivePrice=orderType==='market'?(executablePrice||0):Number(price||0);
  const orderValue=effectivePrice*Number(qty||0);
  const filteredMarkets=useMemo(()=>markets.filter(item=>`${item.symbol} ${item.name}`.toLowerCase().includes(search.toLowerCase())),[markets,search]);
  const openOrders=useMemo(()=>orders.filter(order=>order.remaining>0&&(order.status==='open'||order.status==='partially_filled')),[orders]);

  useEffect(()=>{
    let id=localStorage.getItem('rawmarket-wallet');
    if(!id){id=`rm-${crypto.randomUUID().slice(0,8)}`;localStorage.setItem('rawmarket-wallet',id)}
    setWallet(id);
  },[]);

  const refreshMarket=useCallback(async(silent=false)=>{
    try{
      const [nextBook,nextTrades]=await Promise.all([apiRequest<Book>(`/api/book/${symbol}/SPOT`),apiRequest<Trade[]>(`/api/trades/${symbol}/SPOT`)]);
      setBook(nextBook);setPublicTrades(nextTrades);setEngineOnline(true);
      setPrice(current=>current||(nextBook.asks[0]?.price.toFixed(2)||''));
    }catch(error){setEngineOnline(false);if(!silent)setToast({kind:'error',message:error instanceof Error?error.message:'Market data unavailable'})}
  },[symbol]);

  const refreshAccount=useCallback(async()=>{
    if(!wallet)return;
    try{
      const [nextAccount,nextOrders,nextFills]=await Promise.all([apiRequest<Account>(`/api/account/${wallet}`),apiRequest<Order[]>(`/api/orders/${wallet}`),apiRequest<Trade[]>(`/api/fills/${wallet}`)]);
      setAccount(nextAccount);setOrders(nextOrders);setFills(nextFills);setConnected(nextAccount.funded);
    }catch{/* Controls remain unavailable until connectivity resumes. */}
  },[wallet]);

  useEffect(()=>{apiRequest<Market[]>('/api/markets').then(setMarkets).catch(()=>{});},[]);
  useEffect(()=>{setPrice('');void refreshMarket();const timer=setInterval(()=>void refreshMarket(true),2500);return()=>clearInterval(timer)},[symbol,refreshMarket]);
  useEffect(()=>{setCandles({...EMPTY_CANDLES,interval:timeframe});apiRequest<CandleResponse>(`/api/candles/${symbol}/${timeframe}`).then(setCandles).catch(()=>setCandles({interval:timeframe,frequency:'unavailable',source_status:'Source unavailable',coverage:'The source adapter did not respond.',candles:[]}))},[symbol,timeframe]);
  useEffect(()=>{void refreshAccount();const timer=setInterval(()=>void refreshAccount(),3000);return()=>clearInterval(timer)},[refreshAccount]);

  const chooseMarket=(next:string)=>{setSymbol(next);setMarketMenu(false);setSearch('');setToast(null)};
  const connect=async()=>{if(!wallet)return;setSubmitting(true);try{const next=await apiRequest<Account>('/api/fund',{method:'POST',body:JSON.stringify({wallet,amount:10000})});setAccount(next);setConnected(true);setToast({kind:'success',message:'Account connected'})}catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Connection failed'})}finally{setSubmitting(false)}};
  const submit=async()=>{
    if(!connected){await connect();return}
    const amount=Number(qty);
    if(!Number.isInteger(amount)||amount<=0){setToast({kind:'error',message:'Quantity must be a positive whole number'});return}
    if(orderType==='limit'&&(!Number(price)||Number(price)<=0)){setToast({kind:'error',message:'Enter a valid limit price'});return}
    setSubmitting(true);setToast({kind:'info',message:'Submitting order…'});
    try{
      const result=await apiRequest<Order[]>('/api/orders',{method:'POST',body:JSON.stringify({wallet,symbol,claim:'SPOT',side,price:orderType==='limit'?Number(price):undefined,qty:amount,client_id:`web-${crypto.randomUUID()}`,post_only:orderType==='limit'&&postOnly,order_type:orderType})});
      const own=result.find(item=>item.wallet===wallet);const filled=own?.filled||0;
      setToast({kind:'success',message:filled?`${side==='buy'?'Bought':'Sold'} ${filled} ${symbol} at the resting price`:`Order accepted · ${own?.status||'open'}`,transactionId:own?.hedera_transaction_id||undefined});
      await Promise.all([refreshMarket(true),refreshAccount()]);
    }catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Order rejected'})}finally{setSubmitting(false)}
  };
  const cancelOrder=async(id:string)=>{try{await apiRequest<Order>(`/api/orders/${id}`,{method:'DELETE'});setToast({kind:'success',message:'Order cancelled'});await Promise.all([refreshMarket(true),refreshAccount()])}catch(error){setToast({kind:'error',message:error instanceof Error?error.message:'Cancellation failed'})}};
  const setPercent=(percent:number)=>{const maximum=side==='buy'?Math.floor(account.available_cash/Math.max(effectivePrice,0.01)):Math.max(0,position.available-position.reserved);setQty(String(Math.max(percent?1:0,Math.floor(maximum*percent/100))))};

  return {markets,symbol,market,book,account,orders,fills,publicTrades,candles,wallet,connected,engineOnline,side,orderType,price,qty,postOnly,submitting,toast,timeframe,marketMenu,search,dockTab,methodology,position,executablePrice,orderValue,filteredMarkets,openOrders,setSide,setOrderType,setPrice,setQty,setPostOnly,setToast,setTimeframe,setMarketMenu,setSearch,setDockTab,setMethodology,chooseMarket,connect,submit,cancelOrder,setPercent};
}
