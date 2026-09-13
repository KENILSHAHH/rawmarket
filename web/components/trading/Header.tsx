import {ChevronDown,Landmark,Menu,WalletCards} from 'lucide-react';
import {HASHSCAN_URL} from '@/lib/constants';

export function Header({connected,wallet,submitting,onConnect,onOpenMarkets,onOpenMethodology,onPortfolio}:{connected:boolean;wallet:string;submitting:boolean;onConnect:()=>void;onOpenMarkets:()=>void;onOpenMethodology:()=>void;onPortfolio:()=>void}){
  return <header className="topbar">
    <div className="brand"><div className="brand-glyph"><span/><span/><span/></div><div>RAW<span>MARKET</span></div></div>
    <nav><button className="active">Trade</button><button onClick={onPortfolio}>Portfolio</button><button onClick={onOpenMarkets}>Markets</button><button onClick={onOpenMethodology}>Methodology</button></nav>
    <div className="top-actions"><a className="network-pill" href={HASHSCAN_URL} target="_blank" rel="noreferrer"><Landmark size={13}/><span>Testnet</span><ChevronDown size={12}/></a><button className="wallet-button" onClick={onConnect} disabled={submitting}><WalletCards size={15}/>{connected?<><span>{wallet.slice(0,7)}…{wallet.slice(-3)}</span><i/></>:'Connect'}</button></div>
    <button className="mobile-menu" onClick={onOpenMarkets} aria-label="Open markets"><Menu size={19}/></button>
  </header>;
}
