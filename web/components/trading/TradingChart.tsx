'use client';

import {useEffect,useRef,useState} from 'react';
import {BarChart3,Expand,ShieldCheck,SlidersHorizontal} from 'lucide-react';
import {CandlestickSeries,ColorType,CrosshairMode,createChart,type CandlestickData,type IChartApi,type ISeriesApi,type Time} from 'lightweight-charts';
import {TIME_RANGES} from '@/lib/constants';
import {money,sourceStatus} from '@/lib/format';
import type {Candle,CandleResponse,Market} from '@/lib/types';

const toChartCandle=(item:Candle):CandlestickData<Time>=>({time:item.time,open:item.open,high:item.high,low:item.low,close:item.close});

export function TradingChart({market,data,timeframe,onTimeframe}:{market:Market;data:CandleResponse;timeframe:string;onTimeframe:(value:string)=>void}){
  const containerRef=useRef<HTMLDivElement>(null);
  const chartRef=useRef<IChartApi|null>(null);
  const seriesRef=useRef<ISeriesApi<'Candlestick'>|null>(null);
  const [hovered,setHovered]=useState<Candle|null>(null);

  useEffect(()=>{
    if(!containerRef.current)return;
    const chart=createChart(containerRef.current,{
      width:containerRef.current.clientWidth,
      height:containerRef.current.clientHeight,
      layout:{background:{type:ColorType.Solid,color:'#0c1116'},textColor:'#7f8d97',fontFamily:'Menlo, Consolas, monospace',fontSize:10,attributionLogo:false},
      grid:{vertLines:{color:'#18222a'},horzLines:{color:'#18222a'}},
      crosshair:{mode:CrosshairMode.Normal,vertLine:{color:'#63717b',labelBackgroundColor:'#26323a'},horzLine:{color:'#63717b',labelBackgroundColor:'#26323a'}},
      rightPriceScale:{borderColor:'#202b34',scaleMargins:{top:.08,bottom:.12}},
      timeScale:{borderColor:'#202b34',timeVisible:false,rightOffset:4,barSpacing:7,minBarSpacing:.8},
      handleScroll:{mouseWheel:true,pressedMouseMove:true,horzTouchDrag:true,vertTouchDrag:false},
      handleScale:{axisPressedMouseMove:true,mouseWheel:true,pinch:true},
    });
    const series=chart.addSeries(CandlestickSeries,{upColor:'#45e0b1',downColor:'#ff5d70',wickUpColor:'#45e0b1',wickDownColor:'#ff5d70',borderVisible:false,priceLineColor:'#66737c',priceLineStyle:2,priceFormat:{type:'price',precision:2,minMove:.01}});
    chartRef.current=chart;
    seriesRef.current=series;
    chart.subscribeCrosshairMove(param=>{
      const point=param.seriesData.get(series) as CandlestickData<Time>|undefined;
      if(!point){setHovered(null);return}
      setHovered({time:String(point.time),open:point.open,high:point.high,low:point.low,close:point.close,volume:0,source:''});
    });
    const observer=new ResizeObserver(entries=>{const box=entries[0]?.contentRect;if(box)chart.applyOptions({width:box.width,height:box.height})});
    observer.observe(containerRef.current);
    return()=>{observer.disconnect();chart.remove();chartRef.current=null;seriesRef.current=null};
  },[]);

  useEffect(()=>{
    if(!seriesRef.current||!chartRef.current)return;
    seriesRef.current.setData(data.candles.map(toChartCandle));
    chartRef.current.timeScale().fitContent();
    setHovered(null);
  },[data.candles]);

  const quote=hovered||data.candles.at(-1);
  return <section className="chart-card panel">
    <div className="chart-tabs"><button className="selected">Chart</button><button>Market info</button></div>
    <div className="chart-tools">
      <div className="timeframes">{TIME_RANGES.map(frame=><button key={frame} className={timeframe===frame?'selected':''} onClick={()=>onTimeframe(frame)}>{frame}</button>)}</div>
      <div className="chart-actions"><button><BarChart3 size={14}/> Candles</button><button><SlidersHorizontal size={14}/> Indicators</button><button aria-label="Expand chart"><Expand size={14}/></button></div>
    </div>
    <div className="chart-canvas tradingview-chart">
      <div className="ohlc-legend"><strong>{market.symbol}USD · {data.frequency==='monthly'?'1M':'—'} · RawMarket</strong>{quote&&<><span>O <b>{quote.open.toFixed(2)}</b></span><span>H <b>{quote.high.toFixed(2)}</b></span><span>L <b>{quote.low.toFixed(2)}</b></span><span>C <b className={quote.close>=quote.open?'positive':'negative'}>{quote.close.toFixed(2)}</b></span></>}</div>
      <div ref={containerRef} className="lightweight-chart"/>
      {!data.candles.length&&<div className="chart-empty"><div className="empty-orbit"><BarChart3 size={22}/></div><strong>No compatible history</strong><p>{data.coverage||'The source adapter has not published compatible observations.'}</p></div>}
      {data.candles.length>0&&<a className="source-pill" href={data.source_url} target="_blank" rel="noreferrer"><ShieldCheck size={13}/>{data.candles[0].source}</a>}
      <a className="tradingview-credit" href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">Charts by TradingView</a>
    </div>
    <div className="chart-foot"><span>{data.coverage||'Source window unavailable'}</span><span>Reference {money(market.reference)}</span><span>{sourceStatus(data.source_status)} · {market.unit}</span></div>
  </section>;
}
