'use client';

export const ATS_TESTNET={
  factory:'0.0.9213391',
  resolver:'0.0.9212226',
  milkAsset:'0.0.10525401',
  milkAssetEvm:'0xe50d819ea31c4eaa6b78e4b826db611959a72074',
  eligibility:'0x3229b6f48152cc7A8a1Cb39Dd56d9728780113A2',
} as const;

type Eip1193Provider={request(args:{method:string;params?:unknown[]}):Promise<unknown>};

export async function connectAtsWallet():Promise<string>{
  const provider=(window as Window&{ethereum?:Eip1193Provider}).ethereum;
  if(!provider)throw new Error('MetaMask is required for Hedera wallet connection');
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x128'}]})}
  catch(error){
    if((error as {code?:number}).code!==4902)throw error;
    await provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x128',chainName:'Hedera Testnet',nativeCurrency:{name:'HBAR',symbol:'HBAR',decimals:18},rpcUrls:['https://testnet.hashio.io/api'],blockExplorerUrls:['https://hashscan.io/testnet']} ]});
  }
  const accounts=await provider.request({method:'eth_requestAccounts'}) as string[];
  const address=accounts[0];
  if(!address)throw new Error('The wallet did not return a Hedera EVM address');
  return address.toLowerCase();
}
