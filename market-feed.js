'use strict';

(() => {
  const root=document.getElementById('market-feed');
  const get=id=>document.getElementById(id);
  const poolCache=new Map(),countCache=new Map();
  const categories={
    new:{title:'Token baru',description:'Token dari pool perdagangan yang baru terdaftar di GeckoTerminal, diurutkan dari pool terbaru. Pool baru belum tentu berarti token baru dibuat.'},
    trending:{title:'Trending',description:'Token dari pool yang sedang ramai di GeckoTerminal. Urutan mengikuti aktivitas pasar dan minat pengguna pada jaringan yang dipilih.'},
    holders:{title:'Holder terbanyak',description:'Jumlah holder terbesar di antara maksimal 20 token kandidat dari daftar trending dan baru. Ini peringkat sampel pada jaringan terpilih, bukan seluruh pasar atau komunitas Easykripto.'}
  };
  let tab='trending',signedIn=false,controller,rows=[],limit=10,busy=false;
  let snapshotTime=0,scanned=0,total=0,missing=0,partial=false;
  const numeric=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const usd=value=>value==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(value);
  const compact=value=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(value);
  const count=value=>new Intl.NumberFormat('id-ID').format(value);
  const visible=()=>signedIn&&!document.hidden&&['','#ringkasan'].includes(location.hash)&&!get('detail-dialog').open;
  function stop(){controller?.abort();controller=null;busy=false;root.setAttribute('aria-busy','false');}
  function textNode(tag,text,className){const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;}
  function normalize(response,chain,kind){
    const tokens=new Map((response.included||[]).filter(item=>item.type==='token').map(item=>[item.id,item.attributes]));
    const found=new Map();
    for(const [index,pool] of (Array.isArray(response.data)?response.data:[]).entries()){
      const token=tokens.get(pool.relationships?.base_token?.data?.id),attrs=pool.attributes||{};
      if(!token||!validChainAddress(token.address,chain))continue;
      const key=chain==='solana'?token.address:token.address.toLowerCase();
      const value={chain,address:token.address,symbol:token.symbol||'Token',name:token.name||token.symbol||'Token',imageUrl:token.image_url,
        price:numeric(attrs.base_token_price_usd),change:numeric(attrs.price_change_percentage?.h24),
        marketCap:numeric(attrs.market_cap_usd),fdv:numeric(attrs.fdv_usd),liquidity:numeric(attrs.reserve_in_usd)||0,
        created:Date.parse(attrs.pool_created_at)||0,rank:index};
      const previous=found.get(key);
      if(!previous)found.set(key,value);
      else if(kind==='new'?value.created>previous.created:value.liquidity>previous.liquidity){value.rank=Math.min(previous.rank,value.rank);found.set(key,value);}
    }
    return [...found.values()].sort(kind==='new'?(a,b)=>b.created-a.created:(a,b)=>a.rank-b.rank).slice(0,20);
  }
  async function pools(chain,kind,signal){
    const key=`${chain}:${kind}`,saved=poolCache.get(key);
    if(saved&&Date.now()-saved.fetchedAt<300000)return saved;
    const response=await window.EasyMarket.pools(chain,kind,signal);
    if(signal.aborted)throw new DOMException('Dibatalkan','AbortError');
    const entry={rows:normalize(response.data,chain,kind),fetchedAt:response.fetchedAt};poolCache.set(key,entry);return entry;
  }
  function describe(){
    const category=categories[tab];get('feed-title').textContent=category.title;get('feed-description').textContent=category.description;
    get('feed-panel').setAttribute('aria-labelledby',`feed-tab-${tab}`);
    for(const button of root.querySelectorAll('[data-feed-tab]')){const active=button.dataset.feedTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    get('feed-network').replaceChildren();const logo=document.createElement('span');logo.innerHTML=networkLogo(selectedBlockchain);
    get('feed-network').append(logo,document.createTextNode(currentNetwork().name));
  }
  function render(){
    const list=get('feed-list');list.replaceChildren();
    const ordered=tab==='holders'?rows.filter(row=>row.holderCount!=null).sort((a,b)=>b.holderCount-a.holderCount||a.rank-b.rank):rows;
    ordered.slice(0,limit).forEach((token,index)=>{
      const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='feed-token';
      button.setAttribute('aria-label',`Buka detail ${token.symbol} di ${currentNetwork().name}`);
      button.addEventListener('click',()=>{stop();window.EasyTokenSearch.open({chain:token.chain,address:token.address});});
      const picture=document.createElement('span');picture.className='feed-token-picture';picture.append(window.EasyTokenUI.iconNode(token.imageUrl,token.symbol));
      const badge=document.createElement('span');badge.className='feed-chain-badge';badge.innerHTML=networkLogo(token.chain);picture.append(badge);
      const identity=document.createElement('span');identity.className='feed-token-identity';
      identity.append(textNode('strong',token.symbol,'feed-token-symbol'));
      const meta=document.createElement('span');meta.className='feed-token-meta';
      meta.append(textNode('span',token.marketCap>0?`${usdCompact(token.marketCap)} MC`:token.fdv>0?`${usdCompact(token.fdv)} FDV`:'MC —'));
      if(tab==='holders')meta.append(textNode('span',`${count(token.holderCount)} holder`,'feed-holder-count'));
      else if(tab==='new'&&token.created){const minutes=Math.max(0,Math.floor((Date.now()-token.created)/60000));meta.append(textNode('span',minutes<60?`${minutes} mnt`:minutes<1440?`${Math.floor(minutes/60)} jam`:`${Math.floor(minutes/1440)} hari`,'feed-pool-age'));}
      identity.append(meta);identity.title=token.name;
      const values=document.createElement('span');values.className='feed-token-values';values.append(textNode('strong',usd(token.price),'feed-token-price'));
      const change=token.change;values.append(textNode('span',change==null?'24 jam —':`${change<0?'▾':'▴'} ${Math.abs(change).toLocaleString('id-ID',{maximumFractionDigits:2})}%`,change==null?'feed-change':`feed-change ${change<0?'negative':'positive'}`));
      button.append(textNode('span',`#${index+1}`,'feed-rank'),picture,identity,values);item.append(button);list.append(item);
    });
    get('feed-more').hidden=ordered.length<=limit;
    get('feed-more').textContent=`Lihat ${Math.min(10,ordered.length-limit)} token lainnya`;
    get('feed-refresh').disabled=busy;
    root.setAttribute('aria-busy',String(busy));
    const time=snapshotTime?new Date(snapshotTime).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'}):'';
    get('feed-source').textContent=tab==='holders'?`Pasar: GeckoTerminal · holder: GoPlus${selectedBlockchain==='solana'?' Solana Beta':''} · ${scanned}/${total} diperiksa${missing?` · ${missing} tanpa jumlah holder`:''}${time?` · pasar ${time}`:''}. Jumlah holder mengikuti laporan penyedia; cache hitungan 10 menit.`:`GeckoTerminal${time?` · data ${time}`:''} · perubahan harga 24 jam · cache 5 menit. ${tab==='new'?'Waktu mengacu pada pembuatan pool. ':''}MC: market cap; FDV: valuasi seluruh supply saat MC belum tersedia.`;
  }
  function usdCompact(value){return `$${compact(value)}`;}
  async function load(){
    stop();if(!visible()){root.hidden=!signedIn||!['','#ringkasan'].includes(location.hash);return;}
    root.hidden=false;describe();controller=new AbortController();const signal=controller.signal,chain=selectedBlockchain,category=tab;
    busy=true;rows=[];snapshotTime=0;scanned=0;total=0;missing=0;partial=false;
    get('feed-status').textContent=category==='holders'?'Menyiapkan kandidat dari trending dan pool baru…':'Memuat token…';render();
    try{
      if(category!=='holders'){
        const data=await pools(chain,category,signal);if(signal.aborted)return;
        rows=data.rows;snapshotTime=data.fetchedAt;get('feed-status').textContent=rows.length?'':'Belum ada token yang terdaftar pada sumber ini. Coba jaringan lain atau perbarui nanti.';
      }else{
        const results=await Promise.allSettled([pools(chain,'trending',signal),pools(chain,'new',signal)]);if(signal.aborted)return;
        const trending=results[0].status==='fulfilled'?results[0].value:null,newest=results[1].status==='fulfilled'?results[1].value:null;
        if(!trending&&!newest)throw results[0].reason;
        partial=!trending||!newest;snapshotTime=Math.min(...[trending,newest].filter(Boolean).map(value=>value.fetchedAt));
        const candidates=[...(trending?.rows||[]).slice(0,15),...(newest?.rows||[]).slice(0,5),...(trending?.rows||[]),...(newest?.rows||[])];
        const unique=new Map();for(const token of candidates){const key=chain==='solana'?token.address:token.address.toLowerCase();if(!unique.has(key))unique.set(key,{...token,holderCount:null,rank:unique.size});}
        rows=[...unique.values()].slice(0,20);total=rows.length;
        for(const token of rows){
          if(signal.aborted)return;
          get('feed-status').textContent=`Memeriksa holder ${scanned+1}/${total}… Hasil diurutkan saat tersedia.`;
          const key=`${chain}:${chain==='solana'?token.address:token.address.toLowerCase()}`,saved=countCache.get(key);
          try{
            if(saved&&Date.now()-saved.fetchedAt<600000){token.holderCount=saved.count;token.countTime=saved.fetchedAt;}
            else{
              const result=await window.EasyMarket.security(chain,token.address,signal);if(signal.aborted)return;
              const value=numeric(result.data.holder_count);
              if(value!=null&&Number.isSafeInteger(value)&&value>=0){token.holderCount=value;token.countTime=result.fetchedAt;countCache.set(key,{count:value,fetchedAt:result.fetchedAt});}
            }
          }catch(error){if(signal.aborted)return;if(error.message.includes('Kuota'))throw error;}
          scanned++;if(token.holderCount==null)missing++;render();
        }
        get('feed-status').textContent=!total?'Belum ada kandidat token pada sumber ini.':missing===total?'Jumlah holder belum tersedia untuk kandidat pada jaringan ini. Coba lagi nanti.':`${scanned} token diperiksa${partial?' · salah satu sumber pool belum tersedia':''}. Ketuk token untuk melihat detail dan wallet holder.`;
      }
    }catch(error){if(signal.aborted)return;get('feed-status').textContent=error.message==='Failed to fetch'?'Sumber pasar belum dapat dihubungi. Ketuk perbarui untuk mencoba lagi.':`${error.message||'Data belum tersedia.'}${rows.some(row=>row.holderCount!=null)?' Hasil yang sudah dimuat tetap ditampilkan.':''}`;}
    finally{if(!signal.aborted){busy=false;render();}}
  }
  function switchTab(value){if(!categories[value])return;tab=value;limit=10;get('feed-explainer').hidden=false;get('feed-help').hidden=true;void load();}
  root.querySelector('.market-feed-tabs').addEventListener('click',event=>{const button=event.target.closest('[data-feed-tab]');if(button)switchTab(button.dataset.feedTab);});
  root.querySelector('.market-feed-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
    const keys=['new','trending','holders'],index=keys.indexOf(tab),next=event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowRight'?1:2))%3;
    switchTab(keys[next]);get(`feed-tab-${keys[next]}`).focus();
  });
  get('feed-close-explainer').addEventListener('click',()=>{get('feed-explainer').hidden=true;get('feed-help').hidden=false;get('feed-help').focus();});
  get('feed-help').addEventListener('click',()=>{get('feed-explainer').hidden=false;get('feed-help').hidden=true;get('feed-close-explainer').focus();});
  get('feed-more').addEventListener('click',()=>{limit+=10;render();});
  get('feed-refresh').addEventListener('click',()=>{poolCache.delete(`${selectedBlockchain}:new`);poolCache.delete(`${selectedBlockchain}:trending`);void load();});
  window.addEventListener('easykripto-session',event=>{signedIn=event.detail.signedIn;void load();});
  window.addEventListener('easykripto-network',()=>{limit=10;void load();});
  window.addEventListener('hashchange',()=>void load());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else void load();});
  window.addEventListener('pagehide',stop);
  new MutationObserver(()=>{if(get('detail-dialog').open)stop();else if(visible())void load();}).observe(get('detail-dialog'),{attributes:true,attributeFilter:['open']});
})();
