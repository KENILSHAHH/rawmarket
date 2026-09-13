import {ExternalLink,Landmark} from 'lucide-react';
import {HASHSCAN_URL,REPOSITORY_URL} from '@/lib/constants';

export function TerminalFooter({onDetails}:{onDetails:()=>void}){
  return <footer><div><Landmark size={11}/><strong>Hedera Testnet</strong></div><div>RawMarket</div><div><button onClick={onDetails}>Market details</button><a href={REPOSITORY_URL} target="_blank" rel="noreferrer">GitHub <ExternalLink size={11}/></a><a href={HASHSCAN_URL} target="_blank" rel="noreferrer">HashScan <ExternalLink size={11}/></a></div></footer>;
}
