'use strict';

(() => {
  const input=document.getElementById('live-wallet-address'),form=document.getElementById('live-wallet-form'),status=document.getElementById('live-wallet-status'),result=document.getElementById('live-wallet-result');
  const button=document.getElementById('live-wallet-submit'),label=document.getElementById('live-wallet-label');
  const short=address=>`${String(address).slice(0,6)}…${String(address).slice(-4)}`;
  const fmt=value=>value==null?'Tidak tersedia':Number.isFinite(Number(value))?new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value)):'Tidak tersedia';
  let mode='wallet',current,sessionId=null;
  function text(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
  function copy(address){if(!navigator.clipboard?.writeText){toast('Salin alamat melalui daftar di bawah peta.');return;}navigator.clipboard.writeText(address).then(()=>toast('Alamat disalin.')).catch(()=>toast('Salin alamat melalui daftar di bawah peta.'));}
  function recolorWallets(){
    for(const group of result.querySelectorAll('[data-map-wallet-address]')){
      const category=walletCategoryFor(group.dataset.mapWalletAddress,group.dataset.mapWalletChain),circle=group.querySelector('circle');
      circle.setAttribute('fill',category.fill);circle.setAttribute('stroke',category.color);
      group.setAttribute('aria-label',`Detail alamat ${group.dataset.mapWalletAddress} · ${category.label}`);
      group.querySelector('title').textContent=`${group.dataset.mapWalletAddress} · ${category.label}`;
    }
  }
  function graph(data){
    const holders=data.holders;
    const counts=new Map();
    if(!holders)for(const transfer of data.transfers){for(const address of [transfer.from,transfer.to])if(address&&address!==data.address)counts.set(address,(counts.get(address)||0)+1);}
    const sample=holders?holders.slice(0,20):[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([address,count])=>({address,count}));
    if(!sample.length)return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 620 420');svg.setAttribute('class','live-graph');svg.setAttribute('role','group');svg.setAttribute('aria-label',holders?'Peta pemilik akun token terbesar. Daftar angka tersedia di bawah.':'Peta transfer langsung wallet. Daftar transaksi tersedia di bawah.');
    const add=(tag,attrs,parent=svg)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);parent.append(node);return node;};
    const world=add('g',{});
    const positions=new Map();
    sample.forEach((item,index)=>{const angle=2*Math.PI*index/sample.length-Math.PI/2;const ring=holders&&sample.length>10&&index%2===0?105:170;positions.set(item.address,{x:310+Math.cos(angle)*(holders?ring:220),y:210+Math.sin(angle)*ring});});
    if(!holders){
      const defs=add('defs',{}),marker=add('marker',{id:'live-arrow',viewBox:'0 0 10 10',refX:9,refY:5,markerWidth:5,markerHeight:5,orient:'auto'},defs);add('path',{d:'M0 0 L10 5 L0 10 Z',fill:'#83adbc'},marker);
      const edges=new Map();for(const transfer of data.transfers){const from=transfer.from,to=transfer.to;if(!from||!to||from===to)continue;const key=`${from}:${to}`;const edge=edges.get(key)||{from,to,count:0};edge.count++;edges.set(key,edge);}
      for(const edge of edges.values()){
        const from=edge.from===data.address?{x:310,y:210}:positions.get(edge.from),to=edge.to===data.address?{x:310,y:210}:positions.get(edge.to);
        if(!from||!to)continue;const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy);if(!length)continue;
        add('line',{x1:from.x+dx/length*42,y1:from.y+dy/length*42,x2:to.x-dx/length*38,y2:to.y-dy/length*38,stroke:'#587b8e','stroke-width':Math.min(5,1+Math.sqrt(edge.count)),'marker-end':'url(#live-arrow)'});
      }
    }
    let zoom=1,panX=0,panY=0,dragged=false,gesture=null;const pointers=new Map();
    function transformGraph(){world.setAttribute('transform',`translate(${310+panX} ${210+panY}) scale(${zoom}) translate(-310 -210)`);}
    function node(address,x,y,r,name){
      const category=walletCategoryFor(address,data.chain);
      const group=add('g',{class:'live-node',tabindex:0,role:'button','aria-label':`Detail alamat ${address} · ${category.label}`,'data-map-wallet-address':address,'data-map-wallet-chain':data.chain});add('circle',{cx:x,cy:y,r,fill:category.fill,stroke:category.color,'stroke-width':2},group);const title=add('title',{},group);title.textContent=`${address} · ${category.label}`;const caption=add('text',{x,y:y+4,'text-anchor':'middle'},group);caption.textContent=name;
      const account=(data.transfers||[]).some(t=>(t.from===address&&t.fromType==='token-account')||(t.to===address&&t.toType==='token-account'));
      const show=()=>{if(dragged){dragged=false;return;}dialog(account?'Akun token':'Alamat pada peta',`<div class="address-block">${escapeHTML(address)}</div><button class="secondary-button full-width" data-copy="${escapeHTML(address)}">Salin alamat</button>${account?'<p class="detail-note">Pemilik akun token ini belum diketahui pada sampel. Alamat ini tidak dilabeli sebagai wallet pemilik.</p>':`<button class="primary-button full-width" data-open-address="${escapeHTML(address)}" data-chain="${data.chain}">Analisis transfer alamat</button>`}<p class="detail-note">Ukuran titik mengikuti ${holders?'persentase supply dalam sampel':'frekuensi transfer dalam sampel'}. Analisis hubungan tidak membuktikan pemilik yang sama.</p>`,'DATA BLOCKCHAIN');};
      group.addEventListener('click',show);group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();dragged=false;show();}});
    }
    if(!holders)node(data.address,310,210,42,'Wallet');
    sample.forEach((item,index)=>{const pos=positions.get(item.address);node(item.address,pos.x,pos.y,holders?Math.min(48,14+Math.sqrt(item.share||0)*5):Math.min(37,22+Math.sqrt(item.count||1)*3),String(index+1));});
    [...svg.children].filter(child=>child!==world&&child.tagName!=='defs').forEach(child=>world.append(child));
    const frame=document.createElement('div');frame.className='live-graph-frame';frame.append(svg);
    const controls=document.createElement('div');controls.className='live-graph-controls';
    for(const [label,action]of [['Perbesar','in'],['Perkecil','out'],['Pusatkan','reset']]){const button=text('button',label,'secondary-button');button.type='button';button.addEventListener('click',()=>{if(action==='reset'){zoom=1;panX=panY=0;}else zoom=Math.max(.75,Math.min(3,zoom*(action==='in'?1.2:1/1.2)));transformGraph();});controls.append(button);}
    frame.append(controls);result.append(frame);const categories=document.createElement('div');categories.innerHTML=walletCategoryLegend();result.append(categories);
    const point=event=>{const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());};
    const begin=()=>{gesture={points:[...pointers.values()],x:panX,y:panY,zoom};};
    svg.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'&&event.button!==0)return;if(!pointers.size)dragged=false;pointers.set(event.pointerId,point(event));begin();});
    svg.addEventListener('pointermove',event=>{
      if(!pointers.has(event.pointerId)||!gesture)return;pointers.set(event.pointerId,point(event));const a=[...pointers.values()],b=gesture.points;
      if(a.length===1&&b.length===1){const dx=a[0].x-b[0].x,dy=a[0].y-b[0].y;if(Math.hypot(dx,dy)>6){dragged=true;svg.setPointerCapture(event.pointerId);}panX=Math.max(-500,Math.min(500,gesture.x+dx));panY=Math.max(-350,Math.min(350,gesture.y+dy));}
      if(a.length===2&&b.length===2){dragged=true;zoom=Math.max(.75,Math.min(3,gesture.zoom*Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,Math.hypot(b[0].x-b[1].x,b[0].y-b[1].y))));}transformGraph();
    });
    const end=event=>{pointers.delete(event.pointerId);if(pointers.size)begin();else gesture=null;};svg.addEventListener('pointerup',end);svg.addEventListener('pointercancel',end);svg.addEventListener('pointerleave',event=>{if(!svg.hasPointerCapture(event.pointerId))end(event);});
    const legend=text('p',holders?'Ukuran lingkaran mengikuti persentase supply. Tidak ada garis karena hubungan transfer belum ditelusuri.':`Ukuran lingkaran mengikuti jumlah kemunculan pada sampel transfer. Panah menunjukkan arah. Maksimal 12 alamat lawan ditampilkan; daftar tetap memuat seluruh hasil.`,'live-mode-description');result.append(legend);
    const addresses=document.createElement('details');addresses.append(text('summary','Alamat pada peta'));const list=document.createElement('div');list.className='live-result-list';sample.forEach((item,index)=>{const b=text('button',`${index+1}. ${item.address}`,'secondary-button');b.type='button';b.addEventListener('click',()=>copy(item.address));list.append(b);});addresses.append(list);result.append(addresses);
  }
  function render(data){
    result.replaceChildren();
    if(data.nativeBalance!=null)result.append(text('p',`${fmt(data.nativeBalance)} ${data.nativeSymbol}`,'live-metric'));
    if(data.address&&!state.wallets.some(w=>w.chain===data.chain&&equalChainAddress(w.address,data.address,data.chain))){const save=text('button','Tambahkan wallet ke pantauan','secondary-button');save.type='button';save.dataset.addAddress=data.address;save.dataset.chain=data.chain;result.append(save);}
    result.append(text('p',data.note||'Sampel data blockchain.','live-mode-description'));graph(data);
    const list=document.createElement('div');list.className='live-result-list';
    if(data.holders){
      result.append(list);
      window.EasyTokenUI.renderHolders(list,data,{chain:data.chain,symbol:'token'});
    }else{
      for(const transfer of data.transfers){const row=document.createElement('article');row.className='live-transfer';const from=transfer.from||'Tidak diketahui',to=transfer.to||'Tidak diketahui';row.append(text('strong',`${short(from)} → ${short(to)}`),text('p',`${fmt(transfer.amount)} ${transfer.asset}`));
        if(transfer.timestamp){const date=new Date(transfer.timestamp);if(Number.isFinite(date.getTime()))row.append(text('small',`${date.toLocaleString('id-ID',{timeZone:'Asia/Makassar'})} WITA · `));}
        if(transfer.endpointType==='token-account')row.append(text('small','Salah satu titik adalah akun token; pemilik belum diketahui. '));
        const explorer={solana:'https://solscan.io/tx/',base:'https://basescan.org/tx/',ethereum:'https://etherscan.io/tx/',bsc:'https://bscscan.com/tx/',robinhood:'https://robinhoodchain.blockscout.com/tx/'}[data.chain];const a=text('a','Buka transaksi');a.href=explorer+encodeURIComponent(transfer.hash);a.target='_blank';a.rel='noopener noreferrer';row.append(a);list.append(row);
      }
      if(!data.transfers.length)list.append(text('p','Tidak ditemukan transfer yang dapat diparsing pada sampel ini. Ini tidak berarti wallet tidak pernah bertransaksi.'));
    }
    result.append(list);result.append(text('p','Transfer tidak membuktikan pemilik wallet sama. Saldo token ditampilkan dalam satuan token, bukan nilai USD.','panel-footnote'));
  }
  async function analyze(address,chain,kind){
    if(document.body.classList.contains('signed-out'))return;
    if(!validChainAddress(address,chain)){status.textContent='Alamat tidak sesuai jaringan yang dipilih.';return;}
    if(!blockchainNetworks.some(network=>network.id===chain)||(kind==='holders'&&chain!=='solana')){status.textContent='Holder tersedia untuk Solana. Pilih mode transfer untuk jaringan lainnya.';return;}
    current?.abort();const controller=new AbortController();current=controller;button.disabled=true;result.replaceChildren();status.textContent='Mengambil sampel data blockchain…';
    try{
      const data=await window.EasyData.analyze({chain,address,kind,signal:controller.signal,onWait:message=>{if(current===controller)status.textContent=message;}});
      if(current!==controller||controller.signal.aborted||chain!==selectedBlockchain||document.body.classList.contains('signed-out'))return;
      window.EasyDashboard?.receive(data);render(data);status.textContent=`Sumber: ${data.source} · diambil ${new Date(data.fetchedAt).toLocaleTimeString('id-ID')} · ${data.holders?`${data.sampledTokenAccounts||0} akun token terbesar`:`${data.scanned} catatan diperiksa`}${data.unavailable?` · ${data.unavailable} transaksi tidak tersedia`:''}.`;
      window.EasyNotifications?.push({category:'system',level:'success',title:data.holders?'Sampel holder berhasil dimuat':'Analisis wallet berhasil dimuat',message:data.holders?`${data.holders.length} pemilik pada sampel akun token. Daftar ini bukan seluruh holder.`:`${data.scanned||0} catatan diperiksa; ${data.transfers.length} transfer dapat diparsing. Hasil bukan seluruh riwayat transaksi.`,context:`${currentNetwork().name} · ${data.source}`,key:`manual-analysis:${chain}:${kind}:${address}`,toast:false,action:{type:kind==='holders'?'token':'wallet',chain,address}});
    }catch(error){if(current===controller&&!controller.signal.aborted){status.textContent=error.name==='TimeoutError'?'Analisis terlalu lama. Coba lagi nanti.':error.message==='Failed to fetch'?'Sumber blockchain belum dapat dihubungi. RPC publik dapat membatasi browser; coba lagi setelah layanan data diaktifkan.':error.message;window.EasyNotifications?.push({category:'system',level:'warning',title:'Analisis belum dapat dimuat',message:status.textContent,context:currentNetwork().name,key:`manual-analysis-failed:${chain}:${kind}:${address}`,action:{type:kind==='holders'?'token':'wallet',chain,address}});}}
    finally{if(current===controller){current=null;button.disabled=false;}}
  }
  function setMode(kind){mode=kind;label.textContent=kind==='holders'?'CA token Solana':`Alamat wallet ${currentNetwork().name}`;for(const b of document.querySelectorAll('[data-live-mode]')){b.classList.toggle('active',b.dataset.liveMode===kind);b.setAttribute('aria-pressed',String(b.dataset.liveMode===kind));if(b.dataset.liveMode==='holders')b.disabled=selectedBlockchain!=='solana';}}
  function reset(){current?.abort();current=null;button.disabled=false;setMode('wallet');input.value='';status.textContent='Analisis berdasarkan alamat publik, tanpa menghubungkan wallet.';result.replaceChildren();}
  form.addEventListener('submit',event=>{event.preventDefault();void analyze(input.value.trim(),selectedBlockchain,mode);});
  window.addEventListener('easykripto-watch-change',recolorWallets);
  window.EasyWallet={open({address,chain=selectedBlockchain,kind='wallet'}){if(chain!==selectedBlockchain){const select=document.getElementById('network-select');select.value=chain;select.dispatchEvent(new Event('change'));}closeDialog();location.hash='peta';setMode(kind);input.value=address;void analyze(address,chain,kind);}};
  for(const b of document.querySelectorAll('[data-live-mode]'))b.addEventListener('click',()=>{reset();setMode(b.dataset.liveMode);input.focus();});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-analyze-wallet]');if(!b)return;const wallet=state.wallets.find(wallet=>wallet.id===b.dataset.analyzeWallet);if(wallet)window.EasyWallet.open({address:wallet.address,chain:wallet.chain});});
  document.getElementById('live-demo-toggle').addEventListener('click',event=>{const show=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',String(show));document.getElementById('full-map-slot').hidden=!show;event.currentTarget.textContent=show?'Sembunyikan peta aliran dana':'Lihat peta aliran dana';window.dispatchEvent(new Event('resize'));});
  window.addEventListener('easykripto-network',reset);
  window.addEventListener('easykripto-session',event=>{const uid=event.detail.user?.id||null;if(uid!==sessionId){sessionId=uid;reset();}});
  reset();
})();
