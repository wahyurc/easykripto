import {firebaseIdentity} from './firebase-token.mjs';
import {requireAppCheck} from './app-check.mjs';
import {DataError,validAddress,solanaWallet,solanaHolders,evmWallet} from './chain-data.mjs';
import {writeAPIEvents} from './api-monitor.mjs';

const limits=new Map(),cache=new Map();let active=0;
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}

export async function handleAnalytics(req,res,pathname,env=process.env){
  if(!pathname.startsWith('/api/analysis/'))return false;
  const origin=req.headers.origin;
  const allowed=new Set(['https://wahyurc.github.io','http://localhost:4173',...(env.API_ALLOWED_ORIGINS||'').split(',').map(value=>value.trim()).filter(Boolean)]);
  if(origin&&!allowed.has(origin)){send(res,403,{error:'Origin tidak diizinkan.'});return true;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Firebase-AppCheck');res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.writeHead(204);res.end();return true;}
  if(req.method!=='GET'){send(res,405,{error:'Metode tidak didukung.'});return true;}
  if(pathname==='/api/analysis/capabilities'){
    const networks=[
      {id:'solana',name:'Solana',kind:'solana',walletProvider:env.HELIUS_API_KEY?'Helius':'RPC Solana',holderProvider:'RPC Solana',holderLimit:20},
      ...[{id:'ethereum',name:'Ethereum'},{id:'base',name:'Base'},{id:'bsc',name:'BNB Chain'},{id:'robinhood',name:'Robinhood'}].filter(()=>!!env.ALCHEMY_API_KEY).map(network=>({...network,kind:'evm',walletProvider:'Alchemy',holderProvider:'GoPlus',holderLimit:10}))
    ];
    send(res,200,{networks,scope:'Jaringan yang didukung implementasi aplikasi dan layanan yang dikonfigurasi; ketersediaan data bergantung penyedia.'});return true;
  }
  const started=Date.now(),observed=[];let uid=null,requestChain='auto',requestKind='wallet',cached=false,responseStatus=200;
  try{
    await requireAppCheck(req,env);
    uid=await firebaseIdentity(req.headers.authorization?.match(/^Bearer (.+)$/)?.[1],req.headers['x-firebase-appcheck']);
    const now=Date.now();for(const [key,value]of limits)if(value.until<now)limits.delete(key);
    const limit=limits.get(uid)||{used:0,until:now+60000};
    if(limit.used>=4||limits.size>=10000)throw new DataError('Maksimal 4 analisis per menit. Tunggu sebentar.',429);
    limit.used++;limits.set(uid,limit);
    const query=new URL(req.url,'http://localhost').searchParams,chain=query.get('chain'),address=query.get('address');
    const mode=pathname==='/api/analysis/holders'?'holders':pathname==='/api/analysis/wallet'?'wallet':null;
    requestChain=['solana','ethereum','base','bsc','robinhood'].includes(chain)?chain:'auto';requestKind=mode||'wallet';
    if(!mode)throw new DataError('Analisis tidak tersedia.',404);
    if(!['solana','ethereum','base','bsc','robinhood'].includes(chain)||(mode==='holders'&&chain!=='solana'))throw new DataError('Analisis wallet tersedia di lima jaringan. Analisis holder tersedia untuk Solana.',400);
    if(!validAddress(address,chain))throw new DataError('Alamat tidak sesuai jaringan.',400);
    const apiKey=chain==='solana'?env.HELIUS_API_KEY:env.ALCHEMY_API_KEY;
    if(!apiKey&&chain!=='solana')throw new DataError('Analisis Alchemy belum diaktifkan oleh pengelola.',503);
    const key=`${mode}:${chain}:${chain==='solana'?address:address.toLowerCase()}`;
    for(const [key,value]of cache)if(value.until<now)cache.delete(key);
    if(cache.has(key)){cached=true;send(res,200,{...cache.get(key).data,cached:true});return true;}
    if(active>=2)throw new DataError('Analisis sedang penuh. Coba beberapa saat lagi.',429);
    active++;
    try{
      const hosts={ethereum:'eth-mainnet',base:'base-mainnet',bsc:'bnb-mainnet',robinhood:'robinhood-mainnet'};
      const url=chain==='solana'?(apiKey?`https://mainnet.helius-rpc.com/?api-key=${encodeURIComponent(apiKey)}`:'https://api.mainnet-beta.solana.com'):`https://${hosts[chain]}.g.alchemy.com/v2/${encodeURIComponent(apiKey)}`;
      const signal=AbortSignal.timeout(35000);
      const provider=chain==='solana'?(apiKey?'helius':'solana-rpc'):'alchemy',observe=event=>observed.push({provider,...event,chain,source:'server'});
      const data=chain==='solana'?(mode==='holders'?await solanaHolders(url,address,signal,observe):await solanaWallet(url,address,signal,observe)):await evmWallet(url,chain,address,signal,observe);
      const result={...data,source:chain==='solana'?(apiKey?'Helius':'RPC publik Solana'):'Alchemy',fetchedAt:new Date().toISOString()};
      if(cache.size<300)cache.set(key,{data:result,until:Date.now()+120000});
      send(res,200,result);
    }finally{active--;}
  }catch(error){responseStatus=error instanceof DataError?error.status:502;send(res,responseStatus,{error:error instanceof DataError?error.message:'Analisis belum dapat dimuat. Periksa koneksi dan coba lagi.'});}
  finally{if(uid){observed.push({provider:'worker',method:requestKind,chain:requestChain,status:responseStatus,ok:responseStatus<400,duration:Date.now()-started,source:'server',cached});const write=writeAPIEvents(env,observed);if(req.waitUntil)req.waitUntil(write);else await write;}}
  return true;
}
