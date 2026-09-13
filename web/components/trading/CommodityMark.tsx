export function CommodityMark({symbol}:{symbol:string}){
  const letters:Record<string,string>={MILK:'MK',POTATO:'PT',TOMATO:'TM',WHEAT:'WH',CORN:'CR',RICE:'RC',SOYBEAN:'SB',DRY_BEAN:'DB'};
  return <span className={`commodity-mark mark-${symbol.toLowerCase()}`}>{letters[symbol]||symbol.slice(0,2)}</span>;
}
