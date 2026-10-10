export class DataError extends Error {
  constructor(message,status=502){super(message);this.status=status;}
}

export function decimalUnits(raw,decimals){
  const value=BigInt(raw),negative=value<0n,digits=(negative?-value:value).toString().padStart(decimals+1,'0');
  if(!decimals)return `${negative?'-':''}${digits}`;
  const fraction=digits.slice(-decimals).replace(/0+$/,'');
  return `${negative?'-':''}${digits.slice(0,-decimals)}${fraction?'.'+fraction:''}`;
}

export async function rpc(url,method,params,signal,observe) {
  const started=Date.now();let status=0,ok=false;
  try{
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:signal||AbortSignal.timeout(10000)});status=response.status;
    if(response.status===429)throw new DataError('Kuota sumber blockchain sedang dibatasi. Coba beberapa saat lagi.',429);
    if(!response.ok)throw new DataError('Sumber blockchain belum dapat dihubungi.');
    const data=await response.json();
    if(data.error)throw new DataError('Sumber blockchain menolak permintaan data. Periksa paket API dan coba lagi.');
    ok=true;return data.result;
  }finally{observe?.({method,status,ok,duration:Date.now()-started});}
}

export function validAddress(address,chain){
  if(typeof address!=='string')return false;
  if(chain!=='solana')return /^0x[0-9a-fA-F]{40}$/.test(address);
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))return false;
  let value=0n;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  for(const character of address)value=value*58n+BigInt(alphabet.indexOf(character));
  let bytes=0;for(let n=value;n>0n;n>>=8n)bytes++;
  return bytes+(address.match(/^1*/)?.[0].length||0)===32;
}

const usdc={solana:'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',ethereum:'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',base:'0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'};
const nativeTokens={solana:'So11111111111111111111111111111111111111112',ethereum:'0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',base:'0x4200000000000000000000000000000000000006',bsc:'0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c'};
const priceCache=new Map(),metadataCache=new Map();
async function walletAssets(url,chain,address,nativeBalance,signal,observe){
  const assets=[],contract=usdc[chain],warnings=new Set();let usdcBalance=null,partial=false;
  const incomplete=message=>{partial=true;warnings.add(message);};
  try{
    if(chain==='solana'){
      const accounts=new Map();let standardRead=false;
      for(const programId of ['TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA','TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb']){
        try{
          const result=await rpc(url,'getTokenAccountsByOwner',[address,{programId},{encoding:'jsonParsed',commitment:'confirmed'}],signal,observe);
          if(!Array.isArray(result?.value))throw new Error('Respons tidak lengkap');
          if(programId==='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')standardRead=true;
          for(const row of result.value){
            const info=row.account?.data?.parsed?.info,t=info?.tokenAmount;
            if(info?.owner!==address||!validAddress(info?.mint,'solana')||!/^\d+$/.test(t?.amount||'')||!Number.isInteger(t.decimals)||t.decimals<0||t.decimals>255){incomplete('Sebagian akun token tidak dapat dibaca.');continue;}
            const item=accounts.get(info.mint)||{raw:0n,decimals:t.decimals};
            if(item.decimals!==t.decimals){incomplete('Desimal token tidak konsisten.');continue;}
            item.raw+=BigInt(t.amount);accounts.set(info.mint,item);
          }
        }catch{incomplete(programId==='TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'?'Saldo SPL belum dapat dimuat.':'Saldo Token-2022 belum dapat dimuat.');}
      }
      const stable=accounts.get(contract);if(standardRead)usdcBalance=stable?decimalUnits(stable.raw,stable.decimals):'0';
      for(const [address,item]of accounts)if(item.raw>0n)assets.push({address,amount:decimalUnits(item.raw,item.decimals)});
    }else{
      if(contract)try{const raw=await rpc(url,'eth_call',[{to:contract,data:`0x70a08231${address.slice(2).padStart(64,'0')}`},'latest'],signal,observe);if(!/^0x[0-9a-f]+$/i.test(raw))throw new Error('Saldo tidak tersedia');usdcBalance=decimalUnits(raw,6);}catch{incomplete('Pembacaan langsung USDC gagal; saldo dapat memakai daftar token jika tersedia.');}
      const result=await rpc(url,'alchemy_getTokenBalances',[address,'erc20'],signal,observe);
      if(!Array.isArray(result?.tokenBalances))throw new Error('Respons tidak lengkap');
      const valid=result.tokenBalances.filter(t=>!t.error&&validAddress(t.contractAddress,chain)&&/^0x[0-9a-f]+$/i.test(t.tokenBalance||''));
      const positive=valid.filter(t=>BigInt(t.tokenBalance)>0n),unique=[...new Map(positive.map(t=>[t.contractAddress.toLowerCase(),t])).values()];
      if(result.pageKey)incomplete('Masih ada halaman saldo token yang belum dibaca.');
      if(unique.length>20)incomplete('Metadata dibatasi pada 20 token ERC-20 pertama.');
      if(valid.length!==result.tokenBalances.length)incomplete('Sebagian saldo ERC-20 belum dapat dibaca.');
      for(let i=0;i<Math.min(unique.length,20);i+=4)await Promise.all(unique.slice(i,Math.min(i+4,20)).map(async token=>{
        const ca=token.contractAddress.toLowerCase();
        try{
          if(ca===contract){if(usdcBalance===null)usdcBalance=decimalUnits(token.tokenBalance,6);return;}
          const id=`${chain}:${ca}`,cached=metadataCache.get(id),meta=cached?.until>Date.now()?cached.meta:await rpc(url,'alchemy_getTokenMetadata',[ca],signal,observe);
          if(!Number.isInteger(meta?.decimals)||meta.decimals<0||meta.decimals>255)throw new Error('Metadata tidak tersedia');
          if(metadataCache.size>=300)metadataCache.delete(metadataCache.keys().next().value);metadataCache.set(id,{meta,until:Date.now()+1800000});
          assets.push({address:ca,amount:decimalUnits(token.tokenBalance,meta.decimals)});
        }catch{incomplete('Metadata sebagian token belum dapat dimuat.');}
      }));
    }
  }catch{incomplete('Daftar aset belum dapat dimuat sepenuhnya.');}
  if(contract&&usdcBalance!==null){const index=assets.findIndex(a=>a.address===contract);if(index>=0)assets.splice(index,1);if(Number(usdcBalance)>0)assets.unshift({address:contract,amount:usdcBalance});}
  const priceChain=chain,native=nativeTokens[chain],selected=assets.slice(0,29),prices=new Map();if(assets.length>29)incomplete('Harga dibatasi pada 29 token pertama.');
  const addresses=[...new Set([native,...selected.map(a=>a.address).filter(a=>a!==contract)].filter(Boolean))],cacheKey=`${priceChain}:${addresses.slice().sort().join(',')}`;
  try{
    let pairs=priceCache.get(cacheKey)?.until>Date.now()?priceCache.get(cacheKey).pairs:null;
    if(!pairs){const started=Date.now();let response,ok=false;try{if(!addresses.length){pairs=[];ok=true;}else{response=await fetch(`https://api.dexscreener.com/tokens/v1/${priceChain}/${addresses.join(',')}`,{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(8000)]):AbortSignal.timeout(8000)});if(!response.ok)throw new Error();pairs=await response.json();if(!Array.isArray(pairs))throw new Error();ok=true;}}finally{if(addresses.length)observe?.({provider:'dexscreener',method:'wallet_asset_prices',status:response?.status||0,ok,duration:Date.now()-started});}if(priceCache.size>=100)priceCache.delete(priceCache.keys().next().value);priceCache.set(cacheKey,{pairs,until:Date.now()+120000});}
    for(const p of pairs){const ca=p.baseToken?.address;if(p.chainId!==priceChain||!ca||!Number.isFinite(Number(p.priceUsd))||Number(p.priceUsd)<=0)continue;const id=priceChain==='solana'?ca:ca.toLowerCase(),old=prices.get(id);if(!old||Number(p.liquidity?.usd||0)>old.liquidity)prices.set(id,{price:Number(p.priceUsd),liquidity:Number(p.liquidity?.usd||0)});}
  }catch{incomplete('Harga pasar belum dapat dimuat.');}
  let total=0,priced=0,missing=0;
  for(const a of [{address:native,amount:nativeBalance},...selected]){const amount=Number(a.amount),price=a.address===contract?1:prices.get(a.address)?.price;if(amount===0)continue;if(!Number.isFinite(amount)||amount<0||price===undefined||!Number.isFinite(amount*price)){missing++;continue;}total+=amount*price;priced++;}
  if(missing)incomplete(`${missing} aset belum memiliki harga yang dapat digunakan.`);
  return {usdcBalance,usdcSupported:!!contract,assetValue:{usd:priced||(!missing&&!partial)?total:null,partial,pricedAssets:priced,unpricedAssets:missing,warnings:[...warnings],at:Date.now(),basis:'Native + token terbaca dengan harga DexScreener; USDC acuan 1 USD. Maks. 20 ERC-20 dan 29 token dinilai. Tidak mencakup NFT, DeFi, staking atau rent akun token. Harga DEX adalah estimasi, bukan nilai yang pasti dapat dicairkan.'}};
}

export async function solanaWallet(url,address,signal,observe) {
  const balance=await rpc(url,'getBalance',[address,{commitment:'confirmed'}],signal,observe);
  const signatures=await rpc(url,'getSignaturesForAddress',[address,{limit:8,commitment:'confirmed'}],signal,observe);
  const transfers=[];let scanned=0,unavailable=0;
  for(const signature of signatures||[]) {
    const tx=await rpc(url,'getTransaction',[signature.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}],signal,observe);
    if(!tx){unavailable++;continue;}scanned++;
    if(tx.meta?.err)continue;
    const keys=tx.transaction?.message?.accountKeys||[];
    const owners=new Map(),tokens=new Map();
    for(const token of [...(tx.meta?.preTokenBalances||[]),...(tx.meta?.postTokenBalances||[])]){
      const key=keys[token.accountIndex]?.pubkey;if(key&&token.owner)owners.set(key,token.owner);
      if(key)tokens.set(key,token);
    }
    const instructions=[...(tx.transaction?.message?.instructions||[]),...(tx.meta?.innerInstructions||[]).flatMap(group=>group.instructions||[])];
    instructions.forEach((instruction,index)=>{
      const parsed=instruction.parsed,info=parsed?.info;
      if(!['transfer','transferChecked'].includes(parsed?.type)||!info?.source||!info.destination)return;
      if(instruction.program==='system'&&info.lamports!=null){
        if(info.source!==address&&info.destination!==address)return;
        transfers.push({id:`${signature.signature}:${index}`,hash:signature.signature,from:info.source,to:info.destination,asset:'SOL',amount:decimalUnits(info.lamports,9),timestamp:tx.blockTime?new Date(tx.blockTime*1000).toISOString():null,endpointType:'wallet'});
      }else if(['spl-token','spl-token-2022'].includes(instruction.program)){
        const from=owners.get(info.source),to=owners.get(info.destination);
        if(from!==address&&to!==address)return;
        const token=tokens.get(info.source)||tokens.get(info.destination);
        const decimals=info.tokenAmount?.decimals??token?.uiTokenAmount?.decimals;
        const raw=info.tokenAmount?.amount??info.amount;
        if(raw==null||decimals==null)return;
        transfers.push({id:`${signature.signature}:${index}`,hash:signature.signature,from:from||info.source,to:to||info.destination,fromType:from?'wallet':'token-account',toType:to?'wallet':'token-account',asset:info.mint||token?.mint||'SPL',assetAddress:info.mint||token?.mint||null,amount:decimalUnits(raw,decimals),timestamp:tx.blockTime?new Date(tx.blockTime*1000).toISOString():null,endpointType:from&&to?'wallet':'token-account'});
      }
    });
  }
  return {chain:'solana',address,nativeBalance:decimalUnits(balance.value,9),nativeSymbol:'SOL',...await walletAssets(url,'solana',address,decimalUnits(balance.value,9),signal,observe),transfers,scanned,unavailable,partial:true,note:'Sampel maksimal 8 transaksi yang menyebut alamat wallet. Transfer SPL yang hanya menyebut akun token dapat tidak tercakup. Instruksi transfer belum diklasifikasikan sebagai beli atau jual.'};
}

export async function solanaHolders(url,mint,signal,observe) {
  let accounts=[],fallback=false;
  try{
    const largest=await rpc(url,'getTokenLargestAccounts',[mint,{commitment:'confirmed'}],signal,observe);accounts=largest?.value||[];
  }catch(error){
    if(!(error instanceof DataError)||signal?.aborted)throw error;
    // Very large mints can exceed the RPC provider's largest-account scan limit.
    const start=Date.now();let response,data,status=0;
    try{response=await fetch(`https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(mint)}`,{signal,headers:{Accept:'application/json'}});status=response.status;data=response.ok?await response.json():null;}finally{observe?.({provider:'goplus',method:'token_security',status,ok:response?.ok&&data?.code===1,duration:Date.now()-start});}
    const token=data?.code===1?data.result?.[mint]:null;
    accounts=[...new Set((Array.isArray(token?.holders)?token.holders:[]).map(holder=>holder.token_account).filter(address=>validAddress(address,'solana')))].slice(0,10).map(address=>({address}));
    if(!accounts.length)throw error;fallback=true;
  }
  if(!accounts.length)return {chain:'solana',mint,holders:[],partial:true};
  const details=await rpc(url,'getMultipleAccounts',[accounts.map(account=>account.address),{encoding:'jsonParsed',commitment:'confirmed'}],signal,observe);
  const supply=await rpc(url,'getTokenSupply',[mint,{commitment:'confirmed'}],signal,observe);
  const owners=new Map();
  accounts.forEach((token,index)=>{
    const info=details.value[index]?.data?.parsed?.info,owner=info?.owner;
    const raw=info?.tokenAmount?.amount;
    if(!owner||info.mint!==mint||typeof raw!=='string'||!/^\d+$/.test(raw)||BigInt(raw)===0n)return;
    const item=owners.get(owner)||{address:owner,raw:0n,accounts:0};
    item.raw+=BigInt(raw);item.accounts++;owners.set(owner,item);
  });
  const total=BigInt(supply.value.amount);
  const holders=[...owners.values()].sort((a,b)=>a.raw>b.raw?-1:a.raw<b.raw?1:0).map(item=>({address:item.address,amount:decimalUnits(item.raw,supply.value.decimals),share:total?Number(item.raw*1000000n/total)/10000:0,accounts:item.accounts}));
  return {chain:'solana',mint,holders,sampledTokenAccounts:accounts.length,holderDiscovery:fallback?'GoPlus':'RPC',partial:true,note:`${fallback?'RPC daftar terbesar dibatasi penyedia. Memakai maksimal 10 akun token yang dilaporkan GoPlus; pemilik dan saldo positif diperiksa kembali melalui RPC.':'Pemilik dari maksimal 20 akun token terbesar.'} Bukan seluruh holder. Persentase terhadap supply saat ini. Wallet pool/exchange belum diberi label; kepemilikan bukan bukti hubungan antarwallet.`};
}

export async function evmWallet(url,chain,address,signal,observe) {
  address=address.toLowerCase();
  const balance=await rpc(url,'eth_getBalance',[address,'latest'],signal,observe);
  const nativeBalance=decimalUnits(balance,18);
  const assets=await walletAssets(url,chain,address,nativeBalance,signal,observe),results=[];let transferUnavailable=0;
  for(const direction of ['fromAddress','toAddress']){
    try{const result=await rpc(url,'alchemy_getAssetTransfers',[{fromBlock:'0x0',toBlock:'latest',[direction]:address,category:['external','erc20'],excludeZeroValue:true,withMetadata:true,order:'desc',maxCount:'0x19'}],signal,observe);if(!Array.isArray(result?.transfers))throw new Error('Respons tidak lengkap');results.push(result);}catch{transferUnavailable++;}
  }
  const unique=new Map();
  for(const result of results)for(const transfer of result.transfers||[]) {
    const id=transfer.uniqueId||`${transfer.hash}:${transfer.from}:${transfer.to}:${transfer.rawContract?.address||''}:${transfer.value}`;
    const raw=transfer.rawContract;
    const amount=raw?.value!=null&&raw?.decimal!=null?decimalUnits(raw.value,Number(raw.decimal)):transfer.value==null?null:String(transfer.value);
    unique.set(id,{id,hash:transfer.hash,from:transfer.from?.toLowerCase(),to:transfer.to?.toLowerCase(),asset:transfer.asset||raw?.address||'Token',assetAddress:raw?.address||null,amount,timestamp:transfer.metadata?.blockTimestamp||null,endpointType:'wallet'});
  }
  const transfers=[...unique.values()].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
  return {chain,address,nativeBalance,nativeSymbol:chain==='bsc'?'BNB':'ETH',...assets,transfers,scanned:transfers.length,unavailable:transferUnavailable,transferUnavailable:transferUnavailable>0,partial:true,moreAvailable:results.some(result=>result.pageKey),note:(transferUnavailable?'Sebagian sumber riwayat transfer belum tersedia; saldo yang berhasil dibaca tetap ditampilkan. ':'')+'Maksimal 25 transfer masuk dan 25 keluar (native/ERC-20). Tidak mencakup semua internal transfer, NFT, atau seluruh riwayat. Transfer belum diklasifikasikan sebagai beli/jual.'};
}
