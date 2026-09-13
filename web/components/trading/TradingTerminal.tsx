'use client';

import {Header} from './Header';
import {MarketSummary} from './MarketSummary';
import {TradingChart} from './TradingChart';
import {OrderBook} from './OrderBook';
import {RecentTrades} from './RecentTrades';
import {OrderTicket} from './OrderTicket';
import {PortfolioDock} from './PortfolioDock';
import {MarketDialog} from './MarketDialog';
import {MethodologyDrawer} from './MethodologyDrawer';
import {TerminalFooter} from './TerminalFooter';
import {useTradingTerminal} from '@/hooks/useTradingTerminal';

export function TradingTerminal(){
  const terminal=useTradingTerminal();
  return <main className="app-shell">
    <Header connected={terminal.connected} wallet={terminal.wallet} submitting={terminal.submitting} onConnect={()=>void terminal.connect()} onOpenMarkets={()=>terminal.setMarketMenu(true)} onOpenMethodology={()=>terminal.setMethodology(true)} onPortfolio={()=>terminal.setDockTab('balances')}/>
    <MarketSummary market={terminal.market} book={terminal.book} onOpenMarkets={()=>terminal.setMarketMenu(true)}/>
    <div className="workspace"><div className="workspace-main"><div className="market-workspace"><TradingChart market={terminal.market} data={terminal.candles} timeframe={terminal.timeframe} onTimeframe={terminal.setTimeframe}/><OrderBook book={terminal.book} symbol={terminal.symbol} onPrice={value=>{terminal.setPrice(value.toFixed(2));terminal.setOrderType('limit')}}/><RecentTrades trades={terminal.publicTrades} wallet={terminal.wallet}/></div></div>
      <OrderTicket market={terminal.market} side={terminal.side} orderType={terminal.orderType} price={terminal.price} qty={terminal.qty} postOnly={terminal.postOnly} availableCash={terminal.account.available_cash} position={terminal.position} executablePrice={terminal.executablePrice} orderValue={terminal.orderValue} connected={terminal.connected} engineOnline={terminal.engineOnline} submitting={terminal.submitting} toast={terminal.toast} onSide={terminal.setSide} onOrderType={terminal.setOrderType} onPrice={terminal.setPrice} onQty={terminal.setQty} onPostOnly={terminal.setPostOnly} onPercent={terminal.setPercent} onSubmit={()=>void terminal.submit()} onDismissToast={()=>terminal.setToast(null)}/>
    </div>
    <PortfolioDock tab={terminal.dockTab} onTab={terminal.setDockTab} account={terminal.account} orders={terminal.orders} openOrders={terminal.openOrders} fills={terminal.fills} wallet={terminal.wallet} symbol={terminal.symbol} position={terminal.position} onCancel={id=>void terminal.cancelOrder(id)}/>
    <TerminalFooter onDetails={()=>terminal.setMethodology(true)}/>
    {terminal.marketMenu&&<MarketDialog markets={terminal.filteredMarkets} selected={terminal.symbol} search={terminal.search} onSearch={terminal.setSearch} onSelect={terminal.chooseMarket} onClose={()=>terminal.setMarketMenu(false)}/>} 
    {terminal.methodology&&<MethodologyDrawer market={terminal.market} candles={terminal.candles} onClose={()=>terminal.setMethodology(false)}/>} 
  </main>;
}
