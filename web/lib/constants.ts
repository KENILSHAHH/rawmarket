import type {Account,Market} from './types';

export const ENGINE_URL=process.env.NEXT_PUBLIC_ENGINE_URL||'http://localhost:8080';
export const HASHSCAN_URL='https://hashscan.io/testnet/contract/0x553678C79D4F38d0C7b1297824048887059AD7BA';
export const hashscanTransactionUrl=(transactionId:string)=>`https://hashscan.io/testnet/transaction/${transactionId}`;
export const REPOSITORY_URL='https://github.com/KENILSHAHH/rawmarket';
export const ATS_MILK={
  asset:'0.0.10525401',
  assetUrl:'https://hashscan.io/testnet/contract/0.0.10525401',
  factory:'0.0.9213391',
  factoryUrl:'https://hashscan.io/testnet/contract/0.0.9213391',
  eligibility:'0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2',
  eligibilityUrl:'https://hashscan.io/testnet/contract/0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2',
  lifecycle:[
    {label:'Issue',transactionId:'0.0.7314364@1789314855.741729447'},
    {label:'Hold',transactionId:'0.0.7314364@1789314878.831695254'},
    {label:'Release',transactionId:'0.0.7314364@1789314898.959775823'},
    {label:'Redeem',transactionId:'0.0.7314364@1789314918.105998928'},
  ],
} as const;
export const TIME_RANGES=['1D','1W','1M','3M','1Y','5Y','25Y'] as const;

export const EMPTY_ACCOUNT:Account={wallet:'',cash:0,reserved_cash:0,available_cash:0,positions:{},open_orders:0,funded:false};

export const FALLBACK_MARKETS:Market[]=[
  {symbol:'MILK',name:'US Class III Milk',unit:'USD/cwt',m:2000,cap:25,status:'live demo',expiry:'2026-10-31T14:00:00Z',description:'USDA announced Class III price; 2,000 cwt reference exposure',reference:16.64},
  {symbol:'POTATO',name:'RawMarket US Russet Potato Index v1',unit:'USD / 50 lb carton',m:1,cap:35,status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'Russet Norkotah, U.S. One, 70-count, 50 lb cartons',reference:20},
  {symbol:'TOMATO',name:'RawMarket US Round Tomato Index v1',unit:'USD / 25 lb carton',m:1,cap:40,status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'Round mature-green, U.S. One or better, 5x6, 25 lb cartons',reference:18},
  ...[['WHEAT','US Wheat Index v1','USD / bushel',15,6.1],['CORN','US Corn Index v1','USD / bushel',10,4.5],['RICE','US Rice Index v1','USD / cwt',30,18],['SOYBEAN','US Soybean Index v1','USD / bushel',25,10.2],['DRY_BEAN','US Dry Bean Index v1','USD / cwt',80,42]].map(([symbol,name,unit,cap,reference])=>({symbol:String(symbol),name:String(name),unit:String(unit),m:1,cap:Number(cap),status:'historical/demo',expiry:'2026-10-31T14:00:00Z',description:'US benchmark specification pending coverage audit',reference:Number(reference)})),
];
