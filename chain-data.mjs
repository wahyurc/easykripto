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
  return {chain:'solana',address,nativeBalance:decimalUnits(balance.value,9),nativeSymbol:'SOL',transfers,scanned,unavailable,partial:true,note:'Sampel maksimal 8 transaksi yang menyebut alamat wallet. Transfer SPL yang hanya menyebut akun token dapat tidak tercakup. Instruksi transfer belum diklasifikasikan sebagai beli atau jual.'};
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
  const results=[];
  for(const direction of ['fromAddress','toAddress'])results.push(await rpc(url,'alchemy_getAssetTransfers',[{fromBlock:'0x0',toBlock:'latest',[direction]:address,category:['external','erc20'],excludeZeroValue:true,withMetadata:true,order:'desc',maxCount:'0x19'}],signal,observe));
  const unique=new Map();
  for(const result of results)for(const transfer of result.transfers||[]) {
    const id=transfer.uniqueId||`${transfer.hash}:${transfer.from}:${transfer.to}:${transfer.rawContract?.address||''}:${transfer.value}`;
    const raw=transfer.rawContract;
    const amount=raw?.value!=null&&raw?.decimal!=null?decimalUnits(raw.value,Number(raw.decimal)):transfer.value==null?null:String(transfer.value);
    unique.set(id,{id,hash:transfer.hash,from:transfer.from?.toLowerCase(),to:transfer.to?.toLowerCase(),asset:transfer.asset||raw?.address||'Token',assetAddress:raw?.address||null,amount,timestamp:transfer.metadata?.blockTimestamp||null,endpointType:'wallet'});
  }
  const transfers=[...unique.values()].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
  return {chain,address,nativeBalance,nativeSymbol:chain==='bsc'?'BNB':'ETH',transfers,scanned:transfers.length,partial:true,moreAvailable:results.some(result=>result.pageKey),note:'Maksimal 25 transfer masuk dan 25 keluar (native/ERC-20). Tidak mencakup semua internal transfer, NFT, atau seluruh riwayat. Transfer belum diklasifikasikan sebagai beli/jual.'};
}
