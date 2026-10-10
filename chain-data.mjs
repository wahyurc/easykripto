export class DataError extends Error {
  constructor(message,status=502){super(message);this.status=status;}
}

export async function rpc(url,method,params,signal) {
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:signal||AbortSignal.timeout(10000)});
  if(response.status===429)throw new DataError('Kuota sumber blockchain sedang dibatasi. Coba beberapa saat lagi.',429);
  if(!response.ok)throw new DataError('Sumber blockchain belum dapat dihubungi.');
  const data=await response.json();
  if(data.error)throw new DataError('Sumber blockchain menolak permintaan data. Periksa paket API dan coba lagi.');
  return data.result;
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

export async function solanaWallet(url,address,signal) {
  const balance=await rpc(url,'getBalance',[address,{commitment:'confirmed'}],signal);
  const signatures=await rpc(url,'getSignaturesForAddress',[address,{limit:8,commitment:'confirmed'}],signal);
  const transfers=[];let scanned=0,unavailable=0;
  for(const signature of signatures||[]) {
    const tx=await rpc(url,'getTransaction',[signature.signature,{encoding:'jsonParsed',maxSupportedTransactionVersion:0,commitment:'confirmed'}],signal);
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
        transfers.push({id:`${signature.signature}:${index}`,hash:signature.signature,from:info.source,to:info.destination,asset:'SOL',amount:String(Number(info.lamports)/1e9),timestamp:tx.blockTime?new Date(tx.blockTime*1000).toISOString():null,endpointType:'wallet'});
      }else if(['spl-token','spl-token-2022'].includes(instruction.program)){
        const from=owners.get(info.source),to=owners.get(info.destination);
        if(from!==address&&to!==address)return;
        const token=tokens.get(info.source)||tokens.get(info.destination);
        const decimals=info.tokenAmount?.decimals??token?.uiTokenAmount?.decimals;
        const raw=info.tokenAmount?.amount??info.amount;
        if(raw==null||decimals==null)return;
        transfers.push({id:`${signature.signature}:${index}`,hash:signature.signature,from:from||info.source,to:to||info.destination,asset:info.mint||token?.mint||'SPL',amount:String(Number(raw)/10**decimals),timestamp:tx.blockTime?new Date(tx.blockTime*1000).toISOString():null,endpointType:from&&to?'wallet':'token-account'});
      }
    });
  }
  return {chain:'solana',address,nativeBalance:String(Number(balance.value)/1e9),nativeSymbol:'SOL',transfers,scanned,unavailable,partial:true,note:'Sampel maksimal 8 transaksi yang menyebut alamat wallet. Transfer SPL yang hanya menyebut akun token dapat tidak tercakup. Instruksi transfer belum diklasifikasikan sebagai beli atau jual.'};
}

export async function solanaHolders(url,mint,signal) {
  const largest=await rpc(url,'getTokenLargestAccounts',[mint,{commitment:'confirmed'}],signal);
  const accounts=largest?.value||[];
  if(!accounts.length)return {chain:'solana',mint,holders:[],partial:true};
  const details=await rpc(url,'getMultipleAccounts',[accounts.map(account=>account.address),{encoding:'jsonParsed',commitment:'confirmed'}],signal);
  const supply=await rpc(url,'getTokenSupply',[mint,{commitment:'confirmed'}],signal);
  const owners=new Map();
  accounts.forEach((token,index)=>{
    const owner=details.value[index]?.data?.parsed?.info?.owner;
    if(!owner)return;
    const item=owners.get(owner)||{address:owner,raw:0n,accounts:0};
    item.raw+=BigInt(token.amount);item.accounts++;owners.set(owner,item);
  });
  const total=BigInt(supply.value.amount);
  const holders=[...owners.values()].sort((a,b)=>a.raw>b.raw?-1:a.raw<b.raw?1:0).map(item=>({address:item.address,amount:String(Number(item.raw)/10**supply.value.decimals),share:total?Number(item.raw*1000000n/total)/10000:0,accounts:item.accounts}));
  return {chain:'solana',mint,holders,sampledTokenAccounts:accounts.length,partial:true,note:'Pemilik dari maksimal 20 akun token terbesar, bukan seluruh holder. Persentase terhadap supply saat ini. Wallet pool/exchange belum diberi label; kepemilikan bukan bukti hubungan antarwallet.'};
}

export async function evmWallet(url,chain,address,signal) {
  address=address.toLowerCase();
  const balance=await rpc(url,'eth_getBalance',[address,'latest'],signal);
  const nativeBalance=String(Number(BigInt(balance))/1e18);
  const results=[];
  for(const direction of ['fromAddress','toAddress'])results.push(await rpc(url,'alchemy_getAssetTransfers',[{fromBlock:'0x0',toBlock:'latest',[direction]:address,category:['external','erc20'],excludeZeroValue:true,withMetadata:true,order:'desc',maxCount:'0x19'}],signal));
  const unique=new Map();
  for(const result of results)for(const transfer of result.transfers||[]) {
    const id=transfer.uniqueId||`${transfer.hash}:${transfer.from}:${transfer.to}:${transfer.rawContract?.address||''}:${transfer.value}`;
    unique.set(id,{id,hash:transfer.hash,from:transfer.from?.toLowerCase(),to:transfer.to?.toLowerCase(),asset:transfer.asset||transfer.rawContract?.address||'Token',amount:transfer.value==null?null:String(transfer.value),timestamp:transfer.metadata?.blockTimestamp||null,endpointType:'wallet'});
  }
  const transfers=[...unique.values()].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
  return {chain,address,nativeBalance,nativeSymbol:'ETH',transfers,scanned:transfers.length,partial:true,moreAvailable:results.some(result=>result.pageKey),note:'Maksimal 25 transfer masuk dan 25 keluar (native/ERC-20). Tidak mencakup semua internal transfer, NFT, atau seluruh riwayat. Transfer belum diklasifikasikan sebagai beli/jual.'};
}
