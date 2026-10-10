'use strict';

(() => {
  const cache=new Map(),nextRequest={};
  const networks={solana:'solana',ethereum:'eth',base:'base',bsc:'bsc',robinhood:'robinhood'};
  const chainIds={ethereum:'1',base:'8453',bsc:'56',robinhood:'4663'};
  const money=value=>value==null||!Number.isFinite(Number(value))?'Tidak tersedia':new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:5}).format(Number(value));
  async function json(url,signal,provider){
    const saved=cache.get(url);if(saved&&saved.until>Date.now())return saved.data;
    const slot=Math.max(Date.now(),nextRequest[provider]||0);nextRequest[provider]=slot+2200;
    if(slot>Date.now())await new Promise((resolve,reject)=>{
      if(signal?.aborted){reject(new DOMException('Dibatalkan','AbortError'));return;}
      const abort=()=>{clearTimeout(timer);reject(new DOMException('Dibatalkan','AbortError'));};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},slot-Date.now());signal?.addEventListener('abort',abort,{once:true});
    });
    const timeout=AbortSignal.timeout(12000);
    const response=await fetch(url,{signal:signal?AbortSignal.any([signal,timeout]):timeout,credentials:'omit',headers:{Accept:'application/json'}});
    if(response.status===429)throw new Error('Kuota penyedia sedang dibatasi. Coba lagi beberapa saat lagi.');
    if(!response.ok)throw new Error('Sumber data belum tersedia untuk token ini.');
    const data=await response.json();if(cache.size>150)cache.clear();cache.set(url,{data,until:Date.now()+120000});return data;
  }
  function target(id){return document.getElementById(id);}
  function candleChart(root,candles){
    root.replaceChildren();
    const valid=candles.filter(c=>Array.isArray(c)&&c.length>=6&&c.slice(0,6).every(Number.isFinite)&&c[2]>=c[3]).sort((a,b)=>a[0]-b[0]);
    if(!valid.length){root.textContent='Belum ada candle yang tersedia.';return;}
    const low=Math.min(...valid.map(c=>c[3])),high=Math.max(...valid.map(c=>c[2])),span=high-low||Math.abs(high)*.01||1;
    const y=n=>190-(n-low)/span*165,step=520/valid.length;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 600 230');svg.setAttribute('role','img');svg.setAttribute('aria-label',`Grafik ${valid.length} candle per jam dalam USD. Data angka tersedia di bawah grafik.`);svg.classList.add('price-candles');
    const element=(tag,attrs,text)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);if(text)node.textContent=text;svg.append(node);return node;};
    for(let i=0;i<4;i++){const value=low+span*i/3;const yy=y(value);element('line',{x1:15,x2:540,y1:yy,y2:yy,stroke:'#263b45'});element('text',{x:548,y:yy+4,fill:'#93aabb','font-size':10},money(value));}
    valid.forEach((c,index)=>{const x=20+step*(index+.5),color=c[4]>=c[1]?'#a7e7bc':'#ee8791';element('line',{x1:x,x2:x,y1:y(c[2]),y2:y(c[3]),stroke:color});element('rect',{x:x-step*.28,y:Math.min(y(c[1]),y(c[4])),width:Math.max(2,step*.56),height:Math.max(1,Math.abs(y(c[1])-y(c[4]))),fill:color});});
    const time=value=>new Date(value*1000).toLocaleString('id-ID',{timeZone:'Asia/Makassar',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
    element('text',{x:15,y:220,fill:'#93aabb','font-size':11},`${time(valid[0][0])} WITA`);element('text',{x:360,y:220,fill:'#93aabb','font-size':11},`${time(valid.at(-1)[0])} WITA`);root.append(svg);
    const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Lihat angka OHLCV';details.append(summary);
    const wrap=document.createElement('div');wrap.className='data-table-scroll';const table=document.createElement('table');
    table.innerHTML='<caption>Candle per jam · USD · WITA</caption><thead><tr><th>Waktu</th><th>Buka</th><th>Tertinggi</th><th>Terendah</th><th>Tutup</th><th>Volume</th></tr></thead>';
    const body=document.createElement('tbody');for(const c of valid){const row=document.createElement('tr');for(const value of [time(c[0]),...c.slice(1,6).map(money)]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}table.append(body);wrap.append(table);details.append(wrap);root.append(details);
  }
  async function chart(chain,ca,signal,root){
    const network=networks[chain];if(!network){root.textContent='Grafik belum tersedia pada jaringan ini.';return;}
    try{
      const pools=await json(`https://api.geckoterminal.com/api/v2/networks/${network}/tokens/${encodeURIComponent(ca)}/pools?page=1&include=base_token,quote_token`,signal,'gecko');
      const match=id=>chain==='solana'?id===`${network}_${ca}`:id?.toLowerCase()===`${network}_${ca}`.toLowerCase();
      const metadata=(pools.included||[]).find(item=>match(item.id))?.attributes;
      if(root.isConnected&&!signal.aborted&&metadata?.image_url&&!document.querySelector('#dialog-title .token-picture img'))window.EasyTokenUI.setDialogIcon({imageUrl:metadata.image_url,label:metadata.symbol||'Token'});
      const pool=(pools.data||[]).filter(p=>match(p.relationships?.base_token?.data?.id)||match(p.relationships?.quote_token?.data?.id)).sort((a,b)=>Number(b.attributes?.reserve_in_usd||0)-Number(a.attributes?.reserve_in_usd||0))[0];
      const address=pool?.attributes?.address;if(!address||!(validChainAddress(address,chain)||(chain!=='solana'&&/^0x[0-9a-fA-F]{64}$/.test(address))))throw new Error('Pool grafik belum tersedia untuk token ini.');
      const side=match(pool.relationships.base_token.data.id)?'base':'quote';
      // Space the two GeckoTerminal calls within its public rate budget.
      await new Promise((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Aborted','AbortError'));return;}const abort=()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));};const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},2300);signal.addEventListener('abort',abort,{once:true});});
      if(signal.aborted)return;
      const data=await json(`https://api.geckoterminal.com/api/v2/networks/${network}/pools/${encodeURIComponent(address)}/ohlcv/hour?aggregate=1&limit=48&currency=usd&token=${side}`,signal,'gecko');
      if(!root.isConnected)return;
      candleChart(root,data.data?.attributes?.ohlcv_list||[]);
      const note=document.createElement('p');note.className='panel-footnote';note.textContent=`GeckoTerminal · pool ${address.slice(0,6)}…${address.slice(-4)} · maksimal 48 candle/jam. Pool dapat berbeda dari DEX Screener. Diambil ${new Date().toLocaleTimeString('id-ID')}.`;root.append(note);
    }catch(error){if(root.isConnected&&!signal.aborted)root.textContent=error.message==='Failed to fetch'?'Grafik belum dapat dihubungi. Coba lagi nanti.':error.message;}
  }
  function riskValue(value){
    const raw=value&&typeof value==='object'?value.status:value;
    if(raw==='1'||raw===1||raw===true)return 'Terdeteksi';
    if(raw==='0'||raw===0||raw===false)return 'Tidak terdeteksi';
    return 'Tidak tersedia';
  }
  async function risk(chain,ca,signal,root,holdersRoot){
    const path=chain==='solana'?'solana/token_security':chainIds[chain]?`token_security/${chainIds[chain]}`:null;
    if(!path){root.textContent='Pemeriksaan risiko belum tersedia pada jaringan ini.';return;}
    try{
      const response=await json(`https://api.gopluslabs.io/api/v1/${path}?contract_addresses=${encodeURIComponent(ca)}`,signal,'goplus');
      if(response.code!==1)throw new Error('Pemeriksaan risiko belum tersedia.');
      const key=Object.keys(response.result||{}).find(key=>equalChainAddress(key,ca,chain)),data=response.result?.[key];
      if(!data||!Object.keys(data).length)throw new Error('Belum ada hasil pemeriksaan untuk token ini.');
      if(!root.isConnected)return;root.replaceChildren();
      if(chain!=='solana'&&holdersRoot?.isConnected)window.EasyTokenUI.renderHolders(holdersRoot,window.EasyTokenUI.fromGoPlus(data,chain),{chain,symbol:holdersRoot.dataset.symbol==='token'?data.token_symbol||'token':holdersRoot.dataset.symbol});
      const fields=chain==='solana'?[['mintable','Mint tambahan'],['freezable','Pembekuan token'],['closable','Penutupan akun'],['transfer_fee','Biaya transfer']]:[['is_honeypot','Indikasi honeypot'],['cannot_sell_all','Pembatasan menjual'],['is_blacklisted','Blacklist'],['is_proxy','Kontrak proxy']];
      const dl=document.createElement('dl');dl.className='risk-grid';for(const [field,label]of fields){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=riskValue(data[field]);dl.append(dt,dd);}root.append(dl);
      const p=document.createElement('p');p.className='panel-footnote';p.textContent=`GoPlus${chain==='solana'?' Solana Beta':''} · hasil deteksi bukan jaminan keamanan. Field yang tidak dilaporkan ditandai tidak tersedia.`;root.append(p);
    }catch(error){if(root.isConnected&&!signal.aborted){root.textContent=error.message==='Failed to fetch'?'Pemeriksaan risiko belum dapat dihubungi.':error.message;if(chain!=='solana'&&holdersRoot?.isConnected)holdersRoot.textContent='Daftar holder belum dapat dimuat dari GoPlus. Cari ulang token untuk mencoba lagi.';}}
  }
  async function solanaHolderList(ca,signal,root){
    if(!root?.isConnected||signal.aborted)return;
    root.textContent='Memuat pemilik akun token dari blockchain…';
    try{
      const data=await window.EasyData.analyze({chain:'solana',address:ca,kind:'holders',signal,onWait:message=>{if(root.isConnected&&!signal.aborted)root.textContent=message;}});
      if(!signal.aborted)window.EasyTokenUI.renderHolders(root,data,{chain:'solana',symbol:root.dataset.symbol});
    }catch(error){
      if(!root.isConnected||signal.aborted)return;root.replaceChildren();const message=document.createElement('p');message.textContent=error.message||'Daftar holder belum tersedia.';root.append(message);
      const retry=document.createElement('button');retry.type='button';retry.className='secondary-button';retry.textContent='Coba muat holder lagi';retry.addEventListener('click',()=>void solanaHolderList(ca,signal,root));root.append(retry);
    }
  }
  let analysis;
  window.loadTokenAnalysis=({chain,ca})=>{
    analysis?.abort();analysis=new AbortController();const signal=analysis.signal;
    const chartRoot=target('token-live-chart'),riskRoot=target('token-live-risk'),holdersRoot=target('token-live-holders');
    if(chartRoot)void chart(chain,ca,signal,chartRoot);
    if(riskRoot)void risk(chain,ca,signal,riskRoot,holdersRoot);
    if(chain==='solana'&&holdersRoot)void solanaHolderList(ca,signal,holdersRoot);
  };
  document.getElementById('detail-dialog').addEventListener('close',()=>{if(!document.getElementById('detail-dialog').open)analysis?.abort();});
  window.addEventListener('easykripto-network',()=>analysis?.abort());
  window.addEventListener('easykripto-session',event=>{if(!event.detail.signedIn)analysis?.abort();});
})();
