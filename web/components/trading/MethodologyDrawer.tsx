import {ExternalLink,ShieldCheck,X} from 'lucide-react';
import {REPOSITORY_URL} from '@/lib/constants';
import {availability,money,sourceStatus} from '@/lib/format';
import type {CandleResponse,Market} from '@/lib/types';
import {CommodityMark} from './CommodityMark';

export function MethodologyDrawer({market,candles,onClose}:{market:Market;candles:CandleResponse;onClose:()=>void}){
  return <div className="modal-backdrop" onMouseDown={onClose}><aside className="methodology-drawer" onMouseDown={event=>event.stopPropagation()}><div className="modal-title"><div><span>MARKET DETAILS</span><h2>{market.name}</h2></div><button onClick={onClose}><X size={18}/></button></div><div className="methodology-body"><div className="spec-hero"><CommodityMark symbol={market.symbol}/><div><strong>{market.symbol}/USD</strong><span>{availability(market.status)}</span></div></div><p>{market.description}</p><dl><div><dt>Quotation unit</dt><dd>{market.unit}</dd></div><div><dt>Reference value</dt><dd>{money(market.reference)}</dd></div><div><dt>Contract multiplier</dt><dd>{market.m.toLocaleString()}</dd></div><div><dt>Published cap</dt><dd>{money(market.cap)}</dd></div><div><dt>Trading cutoff</dt><dd>{new Date(market.expiry).toLocaleString()}</dd></div><div><dt>Data quality</dt><dd>{sourceStatus(candles.source_status)}</dd></div><div><dt>History coverage</dt><dd>{candles.coverage||'Unavailable'}</dd></div></dl><div className="method-note"><ShieldCheck size={16}/><p>Class III candles are deterministic change bars built only from official monthly fixings: each open is the prior fixing and each close is the current fixing. No intramonth prices are invented.</p></div><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">View methodology <ExternalLink size={13}/></a></div></aside></div>;
}
