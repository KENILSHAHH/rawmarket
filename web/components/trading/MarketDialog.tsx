import {Search,X} from 'lucide-react';
import {availability,money} from '@/lib/format';
import type {Market} from '@/lib/types';
import {CommodityMark} from './CommodityMark';

export function MarketDialog({markets,selected,search,onSearch,onSelect,onClose}:{markets:Market[];selected:string;search:string;onSearch:(value:string)=>void;onSelect:(symbol:string)=>void;onClose:()=>void}){
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="market-modal" onMouseDown={event=>event.stopPropagation()}><div className="modal-title"><div><span>MARKETS</span><h2>Select a commodity</h2></div><button onClick={onClose}><X size={18}/></button></div><div className="market-search"><Search size={15}/><input autoFocus value={search} onChange={event=>onSearch(event.target.value)} placeholder="Search markets"/></div><div className="market-list"><div className="market-list-head"><span>Market</span><span>Reference</span><span>Unit</span><span>Availability</span></div>{markets.map(item=><button key={item.symbol} onClick={()=>onSelect(item.symbol)} className={item.symbol===selected?'selected':''}><div><CommodityMark symbol={item.symbol}/><span><strong>{item.symbol}/USD</strong><small>{item.name}</small></span></div><b>{money(item.reference)}</b><span>{item.unit}</span><em className={item.status.includes('live')?'positive':'warning'}>{availability(item.status)}</em></button>)}</div></div></div>;
}
