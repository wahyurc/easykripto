'use strict';

(() => {
  const snapshots=new Map(),markets=new Map(),errors=new Map(),analysisFailures=new Set(),tokenPictures=new Map();
  let pictureRequest=null,pictureCooldown=0,mapLoad=null;
  // Circle mainnet contracts: https://developers.circle.com/stablecoins/usdc-contract-addresses
  const usdcContracts={solana:'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',ethereum:'0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',base:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'};
  function isUSDC(e){return !!usdcContracts[e.chain]&&typeof e.assetAddress==='string'&&equalChainAddress(e.assetAddress,usdcContracts[e.chain],e.chain);}
  const short=value=>`${String(value).slice(0,6)}…${String(value).slice(-4)}`;
  const key=(chain,address)=>`${chain}:${chain==='solana'?address:address.toLowerCase()}`;
  const format=value=>value==null?'—':new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value));
  const money=value=>value==null?'—':new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumSignificantDigits:6}).format(Number(value));
  const chainName=chain=>blockchainNetworks.find(n=>n.id===chain)?.name||chain;
  const explorer={solana:'https://solscan.io/tx/',ethereum:'https://etherscan.io/tx/',base:'https://basescan.org/tx/',bsc:'https://bscscan.com/tx/',robinhood:'https://robinhoodchain.blockscout.com/tx/'};
  const empty=message=>`<div class="empty-state">${escapeHTML(message)}</div>`;
  let user=null,epoch=0,ready=false,cloud=null,syncQueue=Promise.resolve(),timer=null,pollIndex=0,busy=new Set(),nodeLookup=new Map();
  let syncMessage='Masuk untuk memuat pantauan.',refreshBusy=false,syncedWatch={wallets:[],tokens:[]};
  let syncFailed=false,priceQueue=Promise.resolve();
  const pendingPrices=new Map();
  function notice(value){window.EasyNotifications?.push(value);}
  function watchLimit(){return user?.role==='superadmin'?Infinity:20;}
  function localKey(){return `easykripto.watch.${user.id}`;}
  async function deadline(promise){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Sinkronisasi terlalu lama')),12000);})]);}finally{clearTimeout(timer);}}
  function normalize(items,kind){
    if(!Array.isArray(items))return [];
    const seen=new Set();
    return items.filter(item=>{
      if(!item||typeof item.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(item.id)||typeof item.name!=='string'||item.name.length>80||typeof item.address!=='string'||!blockchainNetworks.some(n=>n.id===item.chain)||!validChainAddress(item.address,item.chain))return false;
      const id=key(item.chain,item.address);if(seen.has(id))return false;seen.add(id);return true;
    }).slice(0,watchLimit()).map(item=>({id:item.id,name:item.name,address:item.address,chain:item.chain,...(kind==='wallets'?{alert:item.alert===true,category:walletCategory(item.category).id}:{symbol:typeof item.symbol==='string'?item.symbol.slice(0,32):'Token'})}));
  }
  function applyWatch(watch){
    state.wallets=normalize(watch.wallets,'wallets');tokens.splice(0,tokens.length,...normalize(watch.tokens,'tokens'));
    state.alerts=Object.fromEntries(state.wallets.map(w=>[w.id,w.alert===true]));
  }
  function watch(){return {wallets:state.wallets.map(w=>({id:w.id,name:w.name,address:w.address,chain:w.chain,category:walletCategory(w.category).id,alert:!!state.alerts[w.id]})),tokens:tokens.map(t=>({id:t.id,name:t.name,address:t.address,chain:t.chain,symbol:t.symbol}))};}
  function allowed(){if(!user||!ready){toast('Pantauan akun sedang dimuat. Coba kembali sebentar lagi.');return false;}return true;}
  async function firebase(){
    if(cloud)return cloud;
    const [app,sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js')]);
    cloud={sdk,db:sdk.getFirestore(app.getApp())};return cloud;
  }
  function renderAll(){rebuildEvents();renderSummary();renderWallets();renderActivities();renderMap();const label=$('#watch-sync-status');if(label)label.textContent=syncMessage;window.dispatchEvent(new Event('easykripto-watch-change'));}
  function persist(){
    if(!user)return;
    const value=watch(),uid=user.id,version=epoch;save(localKey(),{...value,pending:true,baseline:syncedWatch});
    syncMessage='Menyimpan pantauan ke akun Easykripto…';renderAll();
    syncQueue=syncQueue.catch(()=>{}).then(async()=>{
      if(version!==epoch)return;
      if(!navigator.onLine)throw new Error('Perangkat sedang offline');
      const {sdk,db}=await firebase();
      if(version!==epoch)return;
      let batch=sdk.writeBatch(db),changes=0;
      async function flush(){if(!changes)return;if(version!==epoch)throw new Error('Sesi berubah');await batch.commit();batch=sdk.writeBatch(db);changes=0;}
      for(const kind of ['wallets','tokens']){
        const existing=new Map(syncedWatch[kind].map(item=>[item.id,item])),wanted=new Set(value[kind].map(item=>item.id));
        for(const item of value[kind]){
          const previous=existing.get(item.id);
          if(!previous||Object.entries(item).some(([field,v])=>previous[field]!==v)){batch.set(sdk.doc(db,'accounts',uid,kind,item.id),{...item,updatedAt:sdk.serverTimestamp()});changes++;if(changes>=400)await flush();}
        }
        for(const id of existing.keys())if(!wanted.has(id)){batch.delete(sdk.doc(db,'accounts',uid,kind,id));changes++;if(changes>=400)await flush();}
      }
      await flush();
      if(version===epoch){syncedWatch=value;const current=watch(),pending=JSON.stringify(current)!==JSON.stringify(value);save(localKey(),{...current,pending,baseline:value});syncMessage=pending?'Menyimpan perubahan berikutnya…':'Pantauan tersinkron ke akun Easykripto.';if(syncFailed&&!pending){syncFailed=false;notice({category:'system',level:'success',title:'Pantauan kembali tersinkron',message:'Perubahan pantauan sudah tersimpan pada akun Easykripto.',key:'sync-recovered',action:{type:'route',route:'pantauan'}});}renderAll();}
    }).catch(()=>{if(version===epoch){syncFailed=true;syncMessage='Belum tersinkron. Salinan akun tersedia pada perangkat ini.';renderAll();notice({category:'system',level:'warning',title:'Pantauan belum tersinkron',message:'Perubahan masih tersimpan pada perangkat ini. Periksa koneksi, lalu sinkronkan ulang agar tersimpan pada akun Easykripto.',key:'sync-failed',action:{type:'sync'}});}});
  }
  function rebuildEvents(){
    const watched=new Set(state.wallets.map(w=>key(w.chain,w.address))),unique=new Map();
    for(const data of snapshots.values())for(const transfer of data.transfers||[]){
      const identity=`${data.chain}:${transfer.id}`;
      const previous=unique.get(identity),observed=previous?.observed||new Set();observed.add(key(data.chain,data.address));
      unique.set(identity,{...transfer,chain:data.chain,observed,source:data.source,fetchedAt:data.fetchedAt});
    }
    const sorted=[...unique.values()].sort((a,b)=>(Date.parse(b.timestamp)||0)-(Date.parse(a.timestamp)||0));
    events.splice(0,events.length,...sorted.map((e,index)=>{
      const from=key(e.chain,e.from||''),to=key(e.chain,e.to||'');
      const fromKnown=watched.has(from)||e.observed.has(from),toKnown=watched.has(to)||e.observed.has(to);
      return {...e,id:`event-${index}`,type:fromKnown&&toKnown?'transfer':toKnown?'incoming':'outgoing',minutes:e.timestamp?Math.max(0,(Date.now()-Date.parse(e.timestamp))/60000):Infinity};
    }));
  }
  function feed(){rebuildEvents();return events.filter(e=>e.chain===selectedBlockchain);}
  function walletLabel(address,chain){return state.wallets.find(w=>w.chain===chain&&equalChainAddress(w.address,address||'',chain))?.name||short(address||'?');}
  function assetLabel(e){if(isUSDC(e))return 'USDC';const token=tokens.find(t=>t.chain===e.chain&&e.assetAddress&&equalChainAddress(t.address,e.assetAddress,e.chain));return token?.symbol||(e.assetAddress?tokenPictures.get(key(e.chain,e.assetAddress))?.symbol:null)||(e.asset?.length>16?short(e.asset):e.asset)||'Token';}
  function mapPicture(node){return window.EasyTokenUI.imageURL(markets.get(key(node.chain,node.address||''))?.pair?.info?.imageUrl)||window.EasyTokenUI.imageURL(tokenPictures.get(key(node.chain,node.address||''))?.imageUrl);}
  async function loadMapPictures(nodes){
    if(pictureRequest||!user||document.body.classList.contains('signed-out')||document.hidden||!navigator.onLine||state.mode!=='token'||!['ringkasan','peta'].includes(state.route)||Date.now()<pictureCooldown)return;
    const needed=nodes.filter(node=>node.kind==='token'&&validChainAddress(node.address||'',node.chain)&&!mapPicture(node)&&!(tokenPictures.get(key(node.chain,node.address))?.at>Date.now()-600000));
    if(!needed.length)return;
    const controller=new AbortController(),version=epoch,chain=selectedBlockchain;pictureRequest=controller;
    try{
      for(const node of needed){
        if(controller.signal.aborted||version!==epoch||chain!==selectedBlockchain||state.mode!=='token'||!['ringkasan','peta'].includes(state.route)||document.hidden||!navigator.onLine)break;
        let imageUrl=null,symbol=null;
        try{
          const response=await window.EasyAPILog.fetch(`https://api.dexscreener.com/token-pairs/v1/${node.chain}/${encodeURIComponent(node.address)}`,{credentials:'omit',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(12000)])});
          if(response.status===429){pictureCooldown=Date.now()+120000;throw new Error('Kuota gambar dibatasi');}
          if(!response.ok)throw new Error('Ikon belum tersedia');
          const body=await response.json();
          const pair=(Array.isArray(body)?body:[]).filter(pair=>pair&&pair.chainId===node.chain&&typeof pair.baseToken?.address==='string'&&equalChainAddress(pair.baseToken.address,node.address,node.chain)).sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0))[0];
          imageUrl=window.EasyTokenUI.imageURL(pair?.info?.imageUrl);symbol=typeof pair?.baseToken?.symbol==='string'?pair.baseToken.symbol.slice(0,32):null;
        }catch{if(controller.signal.aborted)break;}
        if(version!==epoch||controller.signal.aborted)break;
        if(tokenPictures.size>=100&&!tokenPictures.has(key(node.chain,node.address)))tokenPictures.delete(tokenPictures.keys().next().value);
        tokenPictures.set(key(node.chain,node.address),{imageUrl,symbol,at:Date.now()});
        if(chain===selectedBlockchain)renderMap();
        if(Date.now()<pictureCooldown)break;
      }
    }finally{
      if(pictureRequest===controller){pictureRequest=null;if(version===epoch)renderMap();}
    }
  }
  function row(e){
    const type={incoming:'Masuk',outgoing:'Keluar',transfer:'Antar pantauan'}[e.type];
    return `<button class="activity-row" data-event="${escapeHTML(e.id)}"><span class="activity-icon ${e.type==='incoming'?'buy':e.type==='outgoing'?'sell':'transfer'}">${icon(e.type==='incoming'?'down':e.type==='outgoing'?'up':'transfer')}</span><span class="activity-main"><strong>${escapeHTML(walletLabel(e.from,e.chain))} → ${escapeHTML(walletLabel(e.to,e.chain))}</strong><small>${type} · ${escapeHTML(chainName(e.chain))}</small></span><span class="activity-number">${escapeHTML(format(e.amount))} ${escapeHTML(assetLabel(e))}<small>${Number.isFinite(e.minutes)?`${age(e.minutes)} lalu`:'Waktu tidak tersedia'}</small></span></button>`;
  }
  function summary(){
    const list=feed().filter(e=>e.minutes<=1440),wallets=availableWallets(),currentTokens=tokens.filter(t=>t.chain===selectedBlockchain);
    const examined=[...snapshots.values()].filter(s=>s.chain===selectedBlockchain),newest=examined.map(s=>s.fetchedAt).sort().at(-1);
    const stats=[['Wallet pantauan',wallets.length,'wallet',`${examined.length} alamat dianalisis`],['Transfer masuk / keluar',`${list.filter(e=>e.type==='incoming').length} / ${list.filter(e=>e.type==='outgoing').length}`,'transfer','Jumlah catatan dalam sampel · 24 jam'],['Token pantauan',currentTokens.length,'map','Harga pasangan DEX Screener'],['Aktivitas teramati',list.length,'activity',newest?`Pembaruan ${new Date(newest).toLocaleTimeString('id-ID')}`:'Analisis wallet untuk mulai']];
    $('#stats').innerHTML=stats.map(([label,value,i,note])=>`<article class="stat-card"><div class="stat-label">${label}${icon(i)}</div><div class="stat-value">${value}</div><div class="stat-note">${escapeHTML(note)}</div></article>`).join('');
    $('#recent-activity').innerHTML=list.slice(0,4).map(row).join('')||empty('Belum ada aktivitas 24 jam pada sampel yang dimuat.');
    $('#token-cards').innerHTML=currentTokens.map(t=>{
      const market=markets.get(key(t.chain,t.address));
      return `<button class="token-card" data-token="${escapeHTML(t.id)}"><div class="token-card-head"><span class="token-logo token-picture" data-token-picture data-image="${escapeHTML(window.EasyTokenUI.imageURL(market?.pair?.info?.imageUrl)||'')}" data-label="${escapeHTML(t.symbol)}"></span><span class="token-name"><strong>${escapeHTML(t.symbol)}</strong><small>${escapeHTML(short(t.address))}</small></span></div><div class="token-card-value">${market?.error?'—':money(market?.pair?.priceUsd)}</div><div class="token-card-caption">${market?.error?escapeHTML(market.error):market?.at?`Harga · ${new Date(market.at).toLocaleTimeString('id-ID')}`:'Harga belum dimuat'}</div><div class="token-card-bottom"><span>Buka grafik & risiko</span>${icon('arrow')}</div></button>`;
    }).join('')||empty('Cari CA lalu ketuk Pantau token untuk menambahkan token.');
    window.EasyTokenUI.updateCardIcons();
    const counterparties=new Map();list.forEach(e=>{const addr=e.type==='incoming'?e.from:e.to;if(addr)counterparties.set(addr,(counterparties.get(addr)||0)+1);});
    const top=[...counterparties].sort((a,b)=>b[1]-a[1])[0];
    $('.insight-card').innerHTML=`<div class="insight-label">${icon('spark')} CATATAN SAMPEL</div><h2>${top?'Alamat paling sering muncul.':'Mulai dari satu wallet.'}</h2><p>${top?`${escapeHTML(walletLabel(top[0],selectedBlockchain))} muncul pada ${top[1]} dari ${list.length} catatan transfer 24 jam yang dimuat. Frekuensi bukan bukti pemilik yang sama.`:'Tambahkan wallet, lalu analisis untuk melihat hubungan dan aktivitas dari catatan blockchain.'}</p><button class="text-button" data-route="peta">Telusuri peta ${icon('arrow')}</button>`;
  }
  function activities(){
    $('#all-activity').innerHTML=feed().filter(e=>state.type==='all'||e.type===state.type).slice(0,500).map(row).join('')||empty('Belum ada catatan untuk filter ini. Muat data melalui Peta atau Pantauan.');
    $$('.activity-filters button').forEach(b=>{const active=b.dataset.type===state.type;b.classList.toggle('active',active);b.setAttribute('aria-pressed',active);});
  }
  function wallets(){
    window.EasyWatchlist?.render({wallets:availableWallets(),tokens,snapshot:w=>snapshots.get(key(w.chain,w.address)),market:t=>markets.get(key(t.chain,t.address)),waiting:w=>busy.has(w.id),error:w=>errors.get(w.id),refreshPrices:ids=>{if(user&&ready)void refreshTokens(ids);}});
  }
  function mapView(){
    const watched=availableWallets(),watchedKeys=new Set(watched.map(w=>key(w.chain,w.address)));
    const list=feed().filter(e=>e.minutes<=state.period*60&&e.from&&e.to&&e.from!==e.to&&(watchedKeys.has(key(e.chain,e.from))||watchedKeys.has(key(e.chain,e.to)))&&(state.mapAsset!=='usdc'||isUSDC(e))).map(e=>({...e,type:watchedKeys.has(key(e.chain,e.from))?(watchedKeys.has(key(e.chain,e.to))?'transfer':'outgoing'):'incoming'}));
    const nodes=new Map(),groups=new Map(),visibleIds=new Set();nodeLookup=new Map();
    const add=(id,data)=>{const current=nodes.get(id)||{id,...data,count:0};current.count++;nodes.set(id,current);};
    const connect=(source,target,e)=>{const id=`${source}>${target}:${e.type}`,group=groups.get(id)||{source,target,type:e.type,events:[]};group.events.push(e);groups.set(id,group);};
    for(const e of list){
      const from=key(e.chain,e.from),to=key(e.chain,e.to),tokenId=`asset:${e.chain}:${e.assetAddress||e.asset}:${from}>${to}`;
      const pathIds=state.mode==='wallet'?[from,to]:[from,tokenId,to];
      if(visibleIds.size+pathIds.filter(id=>!visibleIds.has(id)).length>24)continue;
      pathIds.forEach(id=>visibleIds.add(id));
      add(from,{address:e.from,name:walletLabel(e.from,e.chain),chain:e.chain,watched:watchedKeys.has(from),kind:e.fromType==='token-account'?'account':'wallet'});add(to,{address:e.to,name:walletLabel(e.to,e.chain),chain:e.chain,watched:watchedKeys.has(to),kind:e.toType==='token-account'?'account':'wallet'});
      if(state.mode==='wallet')connect(from,to,e);
      else{add(tokenId,{address:e.assetAddress,name:assetLabel(e),chain:e.chain,kind:'token',nativeNetwork:!e.assetAddress?{SOL:'solana',ETH:'ethereum',BNB:'bsc'}[e.asset]:null});connect(from,tokenId,e);connect(tokenId,to,e);}
    }
    const visible=[...nodes.values()].sort((a,b)=>Number(!!b.watched)-Number(!!a.watched)||b.count-a.count),positions=new Map();
    visible.forEach((node,index)=>{const angle=2*Math.PI*index/visible.length-Math.PI/2,ring=index%2?170:115;const position={...node,x:360+Math.cos(angle)*(ring+45),y:230+Math.sin(angle)*ring,r:Math.min(37,21+Math.sqrt(node.count)*2)};positions.set(node.id,position);nodeLookup.set(`node-${index}`,position);});
    let html='',index=0;
    for(const group of groups.values()){
      const a=positions.get(group.source),b=positions.get(group.target);if(!a||!b)continue;
      const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(!length)continue;
      const path=`M ${a.x+dx/length*(a.r+3)} ${a.y+dy/length*(a.r+3)} L ${b.x-dx/length*(b.r+6)} ${b.y-dy/length*(b.r+6)}`;
      const color=group.type==='incoming'?'#63dac6':group.type==='outgoing'?'#f28e9a':'#aaa0f5',marker=`observed-${index++}`;
      html+=`<defs><marker id="${marker}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker></defs><g class="graph-edge" role="button" tabindex="0" data-edge="${group.events.map(e=>e.id).join(',')}" aria-label="${escapeHTML(a.name)} ke ${escapeHTML(b.name)}"><title>${escapeHTML(a.name)} → ${escapeHTML(b.name)} · ${group.events.length} transfer</title><path class="edge-hit" d="${path}"/><path class="edge-line" d="${path}" stroke="${color}" marker-end="url(#${marker})"/><circle class="flow-dot" r="2.5" fill="${color}" pointer-events="none"><animateMotion dur="4s" repeatCount="indefinite" path="${path}"/></circle></g>`;
    }
    for(const [id,n]of nodeLookup){
      const category=walletCategoryFor(n.address,n.chain),token=n.kind==='token',image=token?mapPicture(n):null,clip=`map-token-${id}`,radius=n.r-3;
      const content=image?`<defs><clipPath id="${clip}"><circle r="${radius}"/></clipPath></defs><image class="map-token-image" href="${escapeHTML(image)}" x="${-radius}" y="${-radius}" width="${radius*2}" height="${radius*2}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clip})" pointer-events="none"/>`:token&&n.nativeNetwork?`<g transform="translate(${-radius*.7} ${-radius*.7}) scale(${radius*1.4/24})" pointer-events="none">${networkLogos[n.nativeNetwork]}</g>`:'';
      const kind=token?'Token':n.kind==='account'?'Akun token':n.watched?`${category.label} · Pantauan`:'Wallet luar';
      html+=`<g class="graph-node" role="button" tabindex="0" data-node="${id}" aria-label="${escapeHTML(n.name)} · ${kind}" transform="translate(${n.x} ${n.y})"><title>${escapeHTML(n.name)} · ${kind}</title><circle class="node-outline" r="${n.r}" fill="${token?'#12382d':category.fill}" stroke="${token?'#63dac6':category.color}" stroke-width="2"${n.kind==='account'?' stroke-dasharray="4 3"':''}/><text class="wallet-initial map-token-fallback" text-anchor="middle" y="5"${token&&n.nativeNetwork?' visibility="hidden"':''}>${escapeHTML(n.name.slice(0,3))}</text>${content}<text class="node-label" text-anchor="middle" y="${n.r+20}">${escapeHTML(n.name.slice(0,15))}</text><text class="node-sub" text-anchor="middle" y="${n.r+33}">${kind} · ${n.count} kemunculan</text></g>`;
    }
    $('.graph-world').innerHTML=html;$('.map-count').textContent=`${list.length} transfer ${state.mapAsset==='usdc'?'USDC ':''}· ${visible.length} titik · ${state.period===168?'7 hari':state.period+' jam'}`;
    for(const image of $$('.map-token-image')){
      const fallback=image.parentElement.querySelector('.map-token-fallback');
      image.addEventListener('load',()=>fallback?.setAttribute('visibility','hidden'),{once:true});
      image.addEventListener('error',()=>{image.remove();fallback?.removeAttribute('visibility');},{once:true});
    }
    $('.map-wallet-legend').innerHTML=walletCategoryLegend();
    const examined=watched.filter(w=>snapshots.has(key(w.chain,w.address))),failed=watched.filter(w=>errors.has(w.id));
    $('.map-empty').hidden=list.length>0;$('.map-empty').innerHTML=!watched.length?'Belum ada wallet pantauan.<small>Tambahkan wallet pada menu Pantauan.</small>':state.mapAsset==='usdc'&&!usdcContracts[selectedBlockchain]?'Kontrak USDC resmi belum terdaftar untuk jaringan ini.<small>Filter USDC tersedia pada Solana, Ethereum, dan Base.</small>':'Belum ada transfer yang sesuai pada sampel.<small>Muat aliran pantauan, ubah filter, atau pilih periode lebih panjang.</small>';
    $('.map-list').innerHTML=list.map(row).join('')||empty('Tidak ada catatan pada periode ini.');
    $('.map-asset-filter').value=state.mapAsset;
    const loadButton=$('[data-action="load-map-watch"]');loadButton.disabled=!watched.length||!!mapLoad?.cancelled;loadButton.textContent=mapLoad?(mapLoad.cancelled?'Menghentikan…':'Hentikan pemuatan'):'Muat aliran pantauan';
    $('.map-data-status').textContent=mapLoad?`Memuat ${mapLoad.index}/${mapLoad.total} wallet secara bergiliran. Batas laju API tetap berlaku.`:`${examined.length}/${watched.length} wallet pantauan dimuat pada ${chainName(selectedBlockchain)}${failed.length?` · ${failed.length} mengalami kendala`:''}. ${list.filter(e=>e.type==='incoming').length} masuk · ${list.filter(e=>e.type==='outgoing').length} keluar · ${list.filter(e=>e.type==='transfer').length} antar pantauan.`;
    const mapped=new Set([...groups.values()].flatMap(g=>g.events.map(e=>e.id))).size;
    $('.map-data-note').textContent=`Sampel transaksi, bukan seluruh riwayat atau penelusuran berantai. Panah mengikuti pengirim → penerima. ${state.mode==='token'?'Token adalah label aset transfer; titik token yang sama dapat muncul pada jalur berbeda. ':''}${mapped<list.length?`${mapped}/${list.length} transfer digambar agar peta tetap terbaca; daftar memuat seluruh hasil filter. `:''}${state.mapAsset==='usdc'?'Hanya kontrak USDC resmi Circle pada Solana/Ethereum/Base; token bridged dan kesamaan ticker tidak disertakan. ':''}Akun token yang pemiliknya belum diketahui ditandai khusus. Rentang waktu menyaring sampel yang sudah dimuat.`;
    $$('.map-modes button').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
    $$('.period-selector button').forEach(b=>{const on=Number(b.dataset.period)===state.period;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});transform();motion();void loadMapPictures(visible);
  }
  function showEvents(ids){
    const list=ids.map(id=>events.find(e=>e.id===id)).filter(Boolean);if(!list.length)return;
    dialog(list.length>1?'Jejak hubungan':'Detail transfer',`<div class="detail-note">${list.length} catatan blockchain. Nilai dalam satuan aset, bukan USD.</div>${list.map(e=>`<article class="live-transfer"><strong>${escapeHTML(walletLabel(e.from,e.chain))} → ${escapeHTML(walletLabel(e.to,e.chain))}</strong><p>${escapeHTML(e.amount??'Tidak tersedia')} ${escapeHTML(assetLabel(e))}</p><p>${e.timestamp?escapeHTML(new Date(e.timestamp).toLocaleString('id-ID',{timeZone:'Asia/Makassar'}))+' WITA':'Waktu tidak tersedia'}</p><div class="address-block">Dari: ${escapeHTML(e.from||'?')}<br>Ke: ${escapeHTML(e.to||'?')}</div>${e.endpointType==='token-account'?'<p>Salah satu alamat merupakan akun token, pemiliknya belum diketahui.</p>':''}<a class="secondary-button full-width" href="${explorer[e.chain]+encodeURIComponent(e.hash)}" target="_blank" rel="noopener noreferrer">Buka transaksi</a></article>`).join('')}`,'DATA BLOCKCHAIN');
  }
  function showNode(id){
    const node=nodeLookup.get(id);if(!node)return;
    if(node.kind==='token'){
      if(node.address)window.EasyTokenSearch.open({chain:node.chain,address:node.address});
      else dialog(node.name,'<p class="detail-note">Aset native jaringan. Ukuran titik mengikuti jumlah kemunculan pada sampel, bukan saldo.</p>','ASET NATIVE');return;
    }
    const wallet=state.wallets.find(w=>w.chain===node.chain&&equalChainAddress(w.address,node.address||'',node.chain));
    if(wallet){showWallet(wallet.id);return;}
    dialog(node.kind==='account'?'Akun token':node.name,`<div class="address-block">${escapeHTML(node.address||'?')}</div><button class="secondary-button full-width" data-copy="${escapeHTML(node.address||'')}">Salin alamat</button>${node.kind!=='account'?`<button class="primary-button full-width" data-open-address="${escapeHTML(node.address||'')}" data-chain="${node.chain}">Analisis alamat</button><button class="secondary-button full-width" data-add-address="${escapeHTML(node.address||'')}" data-chain="${node.chain}">Tambahkan pantauan</button>`:'<p class="detail-note">Ini akun token; alamat pemilik belum diketahui pada sampel ini.</p>'}`,'TITIK PETA');
  }
  function receive(data){
    if(!user||!data.transfers)return;
    const id=key(data.chain,data.address),previous=snapshots.get(id);
    const watchedKeys=new Set(state.wallets.map(w=>key(w.chain,w.address))),unwatched=[...snapshots.keys()].filter(id=>!watchedKeys.has(id));
    if(!watchedKeys.has(id)&&!snapshots.has(id)&&unwatched.length>=20)snapshots.delete(unwatched[0]);
    snapshots.set(id,data);
    const wallet=state.wallets.find(w=>w.chain===data.chain&&equalChainAddress(w.address,data.address,data.chain));
    if(wallet&&state.alerts[wallet.id]&&previous){
      const known=new Set(previous.transfers.map(t=>t.id)),newest=Math.max(0,...previous.transfers.map(t=>Date.parse(t.timestamp)||0));
      const fresh=data.transfers.filter(t=>!known.has(t.id)&&(Date.parse(t.timestamp)||0)>=newest);
      if(fresh.length){
        const incoming=fresh.filter(t=>equalChainAddress(t.to||'',wallet.address,wallet.chain)).length,outgoing=fresh.filter(t=>equalChainAddress(t.from||'',wallet.address,wallet.chain)).length;
        const directions=[incoming?`${incoming} masuk`:null,outgoing?`${outgoing} keluar`:null].filter(Boolean).join(' · ');
        notice({category:'activity',level:'info',title:`Aktivitas baru: ${wallet.name}`,message:`${fresh.length} transfer baru teramati${directions?` (${directions})`:''}. Hasil berasal dari sampel transaksi, belum diklasifikasikan sebagai beli atau jual.`,context:`${chainName(wallet.chain)} · ${short(wallet.address)} · ${data.source||'blockchain'}`,key:`activity:${wallet.chain}:${wallet.address}:${fresh.map(t=>t.id).sort().join(',')}`,dedupeMs:30*86400000,action:{type:'wallet',chain:wallet.chain,address:wallet.address}});
      }
    }
    renderAll();
  }
  async function refreshWallet(id,quiet=false){
    const wallet=state.wallets.find(w=>w.id===id);if(!wallet||busy.has(id)||!user)return;
    const version=epoch;busy.add(id);errors.delete(id);renderWallets();
    try{
      const data=await window.EasyData.analyze({chain:wallet.chain,address:wallet.address,onWait:message=>{if(version===epoch){errors.set(id,message);renderWallets();}}});
      if(version===epoch&&state.wallets.some(w=>w.id===id)){errors.delete(id);receive(data);if(analysisFailures.delete(id))notice({category:'system',level:'success',title:`Data ${wallet.name} kembali tersedia`,message:'Analisis berhasil dimuat kembali. Pantauan dapat melanjutkan pemeriksaan sampel transaksi.',context:`${chainName(wallet.chain)} · ${data.source}`,key:`analysis-recovered:${id}`,action:{type:'wallet',chain:wallet.chain,address:wallet.address}});else if(!quiet)notice({category:'system',level:'success',title:'Analisis diperbarui',message:`Sampel ${wallet.name} sudah dimuat. ${data.scanned||0} catatan diperiksa; hasil bukan seluruh riwayat transaksi.`,context:`${chainName(wallet.chain)} · ${data.source}`,key:`analysis-success:${id}`,action:{type:'wallet',chain:wallet.chain,address:wallet.address}});}
    }catch(error){if(version===epoch&&error.name!=='AbortError'){errors.set(id,error.message);analysisFailures.add(id);notice({category:'system',level:'warning',title:`Data ${wallet.name} belum dapat diperbarui`,message:error.message||'Layanan data belum tersedia. Coba perbarui wallet beberapa saat lagi.',context:chainName(wallet.chain),key:`analysis-failed:${id}`,action:{type:'wallet',chain:wallet.chain,address:wallet.address}});}}
    finally{if(version===epoch){busy.delete(id);renderWallets();}}
  }
  async function loadWatchedMap(){
    if(!allowed())return;
    if(mapLoad){mapLoad.cancelled=true;renderMap();return;}
    const wallets=availableWallets();if(!wallets.length){toast('Tambahkan wallet pada menu Pantauan.');return;}
    const job={version:epoch,chain:selectedBlockchain,index:0,total:wallets.length,cancelled:false};mapLoad=job;renderMap();
    try{
      for(const wallet of wallets){
        if(job.cancelled||job.version!==epoch||job.chain!==selectedBlockchain||!['ringkasan','peta'].includes(state.route))break;
        if(state.wallets.some(w=>w.id===wallet.id))await refreshWallet(wallet.id,true);
        job.index++;if(job.version===epoch)renderMap();
      }
    }finally{if(mapLoad===job){mapLoad=null;renderMap();if(job.version===epoch&&job.index===job.total)toast('Pemuatan selesai. Cakupan dan kendala tersedia di bawah peta.');}}
  }
  async function refreshTokens(requestIds=null){
    const version=epoch,requested=requestIds?new Set(requestIds):null,tasks=[];
    for(const token of tokens.filter(t=>requested?requested.has(t.id):t.chain===selectedBlockchain)){
      const id=key(token.chain,token.address),jobId=`${version}:${id}`,previous=markets.get(id);
      if(previous?.at>Date.now()-120000)continue;
      if(pendingPrices.has(jobId)){tasks.push(pendingPrices.get(jobId));continue;}
      const task=priceQueue.then(async()=>{
        if(version!==epoch||!tokens.some(t=>t.id===token.id))return;
        try{
          const response=await window.EasyAPILog.fetch(`https://api.dexscreener.com/token-pairs/v1/${token.chain}/${encodeURIComponent(token.address)}`,{credentials:'omit',signal:AbortSignal.timeout(12000)});
          if(!response.ok)throw new Error(response.status===429?'Kuota pasar dibatasi':'Harga belum tersedia');
          const body=await response.json();const pairs=(Array.isArray(body)?body:[]).filter(p=>p.chainId===token.chain&&typeof p.baseToken?.address==='string'&&equalChainAddress(p.baseToken.address,token.address,token.chain)).sort((a,b)=>Number(b.liquidity?.usd||0)-Number(a.liquidity?.usd||0));
          if(version===epoch&&tokens.some(t=>t.id===token.id))markets.set(id,{pair:pairs[0],at:Date.now(),error:pairs.length?null:'Pasangan belum ditemukan'});
        }catch(error){if(version===epoch&&tokens.some(t=>t.id===token.id))markets.set(id,{error:'Harga belum dapat dimuat',at:Date.now()});}
        if(version===epoch){renderSummary();renderWallets();renderMap();}
      }).finally(()=>pendingPrices.delete(jobId));
      pendingPrices.set(jobId,task);priceQueue=task.catch(()=>{});tasks.push(task);
    }
    await Promise.allSettled(tasks);
  }
  function schedule(){
    clearTimeout(timer);if(!user)return;
    timer=setTimeout(async()=>{
      if(!document.hidden&&navigator.onLine){const monitored=state.wallets.filter(w=>state.alerts[w.id]);if(monitored.length)await refreshWallet(monitored[pollIndex++%monitored.length].id,true);}
      schedule();
    },65000);
  }
  async function session(event){
    const account=event.detail.user||null;if(user?.id===account?.id&&user?.role===account?.role)return;
    if($('#detail-dialog').open)closeDialog();
    user=account;epoch++;const version=epoch;mapLoad=null;state.mapAsset='all';priceQueue=Promise.resolve();pendingPrices.clear();pictureRequest?.abort();pictureRequest=null;tokenPictures.clear();pictureCooldown=0;ready=false;busy=new Set();snapshots.clear();markets.clear();errors.clear();analysisFailures.clear();syncFailed=false;events.splice(0);applyWatch({});clearTimeout(timer);syncQueue=Promise.resolve();syncedWatch={wallets:[],tokens:[]};
    syncMessage=user?'Memuat pantauan akun Google…':'Masuk untuk memuat pantauan.';renderAll();
    if(!user)return;
    const cached=load(localKey(),{});applyWatch(cached);renderAll();
    try{
      const {sdk,db}=await firebase(),uid=user.id;
      const collections=await deadline(Promise.all(['wallets','tokens'].map(kind=>sdk.getDocs(sdk.collection(db,'accounts',uid,kind)))));
      if(version!==epoch)return;
      const remote={wallets:collections[0].docs.map(d=>({...d.data(),id:d.id})),tokens:collections[1].docs.map(d=>({...d.data(),id:d.id}))};
      syncedWatch={wallets:normalize(remote.wallets,'wallets'),tokens:normalize(remote.tokens,'tokens')};
      const local=watch();
      if(cached.pending){
        const merged={};
        for(const kind of ['wallets','tokens']){
          const base=new Map(normalize(cached.baseline?.[kind],kind).map(item=>[item.id,item]));
          const current=new Map(local[kind].map(item=>[item.id,item]));
          const target=new Map(syncedWatch[kind].map(item=>[item.id,item]));
          for(const id of base.keys())if(!current.has(id))target.delete(id);
          for(const [id,item]of current)if(JSON.stringify(base.get(id))!==JSON.stringify(item))target.set(id,item);
          merged[kind]=[...target.values()];
        }
        applyWatch(merged);ready=true;persist();
      }
      else if(!remote.wallets.length&&!remote.tokens.length&&(local.wallets.length||local.tokens.length)){ready=true;persist();}
      else{applyWatch(remote);save(localKey(),watch());syncMessage='Pantauan tersinkron ke akun Easykripto.';}
    }catch{if(version!==epoch)return;syncFailed=true;syncedWatch={wallets:normalize(cached.baseline?.wallets,'wallets'),tokens:normalize(cached.baseline?.tokens,'tokens')};syncMessage='Sinkronisasi belum tersedia. Menggunakan salinan akun pada perangkat ini.';notice({category:'system',level:'warning',title:'Pantauan cloud belum dapat dimuat',message:'Aplikasi menggunakan salinan akun pada perangkat ini. Sinkronkan ulang saat koneksi dan layanan tersedia.',key:'sync-load-failed',action:{type:'sync'}});}
    if(version!==epoch)return;ready=true;renderAll();schedule();
    void refreshTokens();const first=availableWallets()[0];if(first)void refreshWallet(first.id,true);
  }
  window.EasyDashboard={row,summary,activities,wallets,map:mapView,showEvents,showNode,receive,persist,allowed,
    addWallet(wallet){if(!allowed())return false;if(!blockchainNetworks.some(n=>n.id===wallet.chain)||!validChainAddress(wallet.address,wallet.chain)){toast('Alamat holder tidak sesuai jaringan.');return false;}if(state.wallets.some(w=>w.chain===wallet.chain&&equalChainAddress(w.address,wallet.address,wallet.chain))){toast('Alamat sudah berada di pantauan.');return false;}if(state.wallets.length>=watchLimit()){toast('Maksimal 20 wallet per akun untuk menjaga kuota gratis.');return false;}wallet={...wallet,category:walletCategory(wallet.category).id};state.wallets.push(wallet);persist();notice({category:'watch',level:'success',title:'Wallet ditambahkan ke pantauan',message:wallet.name,context:chainName(wallet.chain)+' · '+short(wallet.address),key:'watch-wallet:'+wallet.id,toast:false,action:{type:'wallet',chain:wallet.chain,address:wallet.address}});void refreshWallet(wallet.id);return true;},
    setWalletCategory(id,value){if(!allowed()||!Object.hasOwn(walletCategories,value))return;const wallet=state.wallets.find(w=>w.id===id);if(!wallet||wallet.category===value)return;wallet.category=value;persist();toast(`Kategori wallet diubah menjadi ${walletCategory(value).label}.`);},
    updateWallet(id,{name,category}){if(!allowed())return false;const wallet=state.wallets.find(w=>w.id===id),label=typeof name==='string'?name.trim():'';if(!wallet||!label||label.length>80||!Object.hasOwn(walletCategories,category))return false;if(wallet.name!==label||wallet.category!==category){wallet.name=label;wallet.category=category;persist();}return true;},
    removeWallet(id){state.wallets=state.wallets.filter(w=>{if(w.id!==id)return true;snapshots.delete(key(w.chain,w.address));return false;});delete state.alerts[id];errors.delete(id);persist();},
    toggleAlert(id){if(!allowed())return;state.alerts[id]=!state.alerts[id];persist();if(state.alerts[id])void refreshWallet(id,true);const wallet=state.wallets.find(w=>w.id===id);if(wallet)notice({category:'watch',level:'info',title:state.alerts[id]?'Lonceng wallet diaktifkan':'Lonceng wallet dimatikan',message:state.alerts[id]?wallet.name+': pemeriksaan bergiliran setiap 65 detik saat tab aktif. Cache 2 menit; snapshot pertama menjadi pembanding.':wallet.name+': pemeriksaan otomatis dihentikan. Wallet tetap tersimpan pada pantauan.',key:'alert:'+id+':'+state.alerts[id],action:{type:'route',route:'pantauan'}});schedule();},
    trackToken({chain,address,name,symbol,pair}){if(!allowed())return;if(tokens.some(t=>key(t.chain,t.address)===key(chain,address))){toast('Token sudah ada dalam pantauan.');return;}if(tokens.length>=watchLimit()){toast('Maksimal 20 token per akun.');return;}tokens.push({id:crypto.randomUUID(),chain,address,name:String(name||'Token').slice(0,80),symbol:String(symbol||'Token').slice(0,32)});if(pair)markets.set(key(chain,address),{pair,at:Date.now()});persist();notice({category:'watch',level:'success',title:'Token ditambahkan ke pantauan',message:String(symbol||name||'Token'),context:chainName(chain)+' · '+short(address),key:'watch-token:'+key(chain,address),action:{type:'token',chain,address}});},
    openToken(id){const token=tokens.find(t=>t.id===id);if(token)window.EasyTokenSearch.open({chain:token.chain,address:token.address});},
    snapshot(wallet){return snapshots.get(key(wallet.chain,wallet.address));},
    async refreshTokenPrices(){if(allowed())await refreshTokens();}
  };
  document.addEventListener('click',async event=>{
    const b=event.target.closest('button');if(!b)return;const d=b.dataset;
    if(d.action==='load-map-watch')void loadWatchedMap();
    if(d.refreshWallet)void refreshWallet(d.refreshWallet);
    if(d.openAddress)window.EasyWallet.open({address:d.openAddress,chain:d.chain});
    if(d.addAddress){const address=d.addAddress;closeDialog();addWallet({address,name:short(address),chain:d.chain||selectedBlockchain});}
    if(d.removeToken&&allowed()){const index=tokens.findIndex(t=>t.id===d.removeToken);if(index>=0){tokens.splice(index,1);persist();closeDialog();toast('Token dihapus dari pantauan.');}}
    if(d.action==='sync-watch'&&allowed()){await syncQueue;persist();}
    if(d.action==='import-watch'&&allowed()){
      const saved=load('easykripto.wallets',[]);
      const legacy=normalize((Array.isArray(saved)?saved:[]).filter(w=>w&&typeof w==='object').map(w=>({...w,chain:w.chain||'solana'})),'wallets');
      for(const wallet of legacy)if(state.wallets.length<watchLimit()&&!state.wallets.some(w=>key(w.chain,w.address)===key(wallet.chain,wallet.address)))state.wallets.push(wallet);
      persist();toast('Pantauan lama pada perangkat diimpor ke akun ini.');
    }
    if(d.action==='notification-permission'){
      if(window.EasyNotifications){await window.EasyNotifications.browserPermission();return;}
      if(!('Notification' in window)){toast('Browser ini belum mendukung notifikasi. Pemberitahuan dalam aplikasi tetap tersedia.');return;}
      try{const permission=await Notification.requestPermission();toast(permission==='granted'?'Notifikasi browser diizinkan selama aplikasi terbuka.':'Pemberitahuan tetap muncul di dalam aplikasi.');}catch{toast('Pemberitahuan tetap tersedia di dalam aplikasi.');}
    }
    if(d.action==='refresh-dashboard'&&!refreshBusy&&allowed()){
      const version=epoch;refreshBusy=true;b.disabled=true;
      try{await refreshTokens();for(const wallet of availableWallets()){if(version!==epoch)break;await refreshWallet(wallet.id,true);}if(version===epoch)toast('Pembaruan selesai. Status setiap wallet tersedia di Pantauan.');}
      finally{refreshBusy=false;b.disabled=false;}
    }
  });
  window.addEventListener('easykripto-session',session);
  document.addEventListener('change',event=>{if(event.target.matches('.map-asset-filter')&&['all','usdc'].includes(event.target.value)){state.mapAsset=event.target.value;state.zoom=1;state.x=state.y=0;renderMap();}});
  window.addEventListener('easykripto-network',()=>{renderAll();if(user)void refreshTokens();});
  renderAll();
})();
