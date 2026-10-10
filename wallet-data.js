'use strict';

(() => {
  const input=document.getElementById('live-wallet-address'),form=document.getElementById('live-wallet-form'),status=document.getElementById('live-wallet-status'),result=document.getElementById('live-wallet-result');
  const button=document.getElementById('live-wallet-submit'),label=document.getElementById('live-wallet-label');
  const short=address=>`${String(address).slice(0,6)}…${String(address).slice(-4)}`;
  const fmt=value=>value==null?'Tidak tersedia':Number.isFinite(Number(value))?new Intl.NumberFormat('id-ID',{maximumSignificantDigits:7}).format(Number(value)):'Tidak tersedia';
  const cache=new Map();let mode='wallet',current;
  function apiOrigin(){
    if(['localhost','127.0.0.1'].includes(location.hostname))return location.origin;
    const configured=window.EASYKRIPTO_API_ORIGIN;
    if(!configured)return null;
    const url=new URL(configured);return url.protocol==='https:'&&!url.username&&!url.password?url.origin:null;
  }
  function text(tag,value,className){const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;}
  function copy(address){if(!navigator.clipboard?.writeText){toast('Salin alamat melalui daftar di bawah peta.');return;}navigator.clipboard.writeText(address).then(()=>toast('Alamat disalin.')).catch(()=>toast('Salin alamat melalui daftar di bawah peta.'));}
  function graph(data){
    const holders=data.holders;
    const counts=new Map();
    if(!holders)for(const transfer of data.transfers){for(const address of [transfer.from,transfer.to])if(address&&address!==data.address)counts.set(address,(counts.get(address)||0)+1);}
    const sample=holders?holders.slice(0,20):[...counts].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([address,count])=>({address,count}));
    if(!sample.length)return;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 620 420');svg.setAttribute('class','live-graph');svg.setAttribute('role','group');svg.setAttribute('aria-label',holders?'Peta pemilik akun token terbesar. Daftar angka tersedia di bawah.':'Peta transfer langsung wallet. Daftar transaksi tersedia di bawah.');
    const add=(tag,attrs,parent=svg)=>{const node=document.createElementNS(svg.namespaceURI,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,value);parent.append(node);return node;};
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
    function node(address,x,y,r,name,color){const group=add('g',{class:'live-node',tabindex:0,role:'button','aria-label':`Salin alamat ${address}`});add('circle',{cx:x,cy:y,r,fill:color,stroke:'#91bea5','stroke-width':1.5},group);const title=add('title',{},group);title.textContent=address;const caption=add('text',{x,y:y+4,'text-anchor':'middle'},group);caption.textContent=name;group.addEventListener('click',()=>copy(address));group.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();copy(address);}});}
    if(!holders)node(data.address,310,210,42,'Wallet','#234b39');
    sample.forEach((item,index)=>{const pos=positions.get(item.address);node(item.address,pos.x,pos.y,holders?Math.min(48,14+Math.sqrt(item.share||0)*5):Math.min(37,22+Math.sqrt(item.count||1)*3),String(index+1),'#1f354b');});
    result.append(svg);
    const legend=text('p',holders?'Ukuran lingkaran mengikuti persentase supply. Tidak ada garis karena hubungan transfer belum ditelusuri.':`Ukuran lingkaran mengikuti jumlah kemunculan pada sampel transfer. Panah menunjukkan arah. Maksimal 12 alamat lawan ditampilkan; daftar tetap memuat seluruh hasil.`,'live-mode-description');result.append(legend);
    const addresses=document.createElement('details');addresses.append(text('summary','Alamat pada peta'));const list=document.createElement('div');list.className='live-result-list';sample.forEach((item,index)=>{const b=text('button',`${index+1}. ${item.address}`,'secondary-button');b.type='button';b.addEventListener('click',()=>copy(item.address));list.append(b);});addresses.append(list);result.append(addresses);
  }
  function render(data){
    result.replaceChildren();
    if(data.nativeBalance!=null)result.append(text('p',`${fmt(data.nativeBalance)} ${data.nativeSymbol}`,'live-metric'));
    result.append(text('p',data.note||'Sampel data blockchain.','live-mode-description'));graph(data);
    const list=document.createElement('div');list.className='live-result-list';
    if(data.holders){
      for(const [index,holder]of data.holders.entries()){const row=document.createElement('article');row.className='live-transfer';row.append(text('strong',`${index+1}. ${holder.address}`),text('p',`${fmt(holder.amount)} token · ${fmt(holder.share)}% supply · ${holder.accounts} akun token dalam sampel`));list.append(row);}
      if(!data.holders.length)list.append(text('p','Belum ditemukan pemilik pada sampel akun token.'));
    }else{
      for(const transfer of data.transfers){const row=document.createElement('article');row.className='live-transfer';const from=transfer.from||'Tidak diketahui',to=transfer.to||'Tidak diketahui';row.append(text('strong',`${short(from)} → ${short(to)}`),text('p',`${fmt(transfer.amount)} ${transfer.asset}`));
        if(transfer.timestamp){const date=new Date(transfer.timestamp);if(Number.isFinite(date.getTime()))row.append(text('small',`${date.toLocaleString('id-ID',{timeZone:'Asia/Makassar'})} WITA · `));}
        if(transfer.endpointType==='token-account')row.append(text('small','Salah satu titik adalah akun token; pemilik belum diketahui. '));
        const explorer=data.chain==='solana'?'https://solscan.io/tx/':data.chain==='base'?'https://basescan.org/tx/':'https://etherscan.io/tx/';const a=text('a','Buka transaksi');a.href=explorer+encodeURIComponent(transfer.hash);a.target='_blank';a.rel='noopener noreferrer';row.append(a);list.append(row);
      }
      if(!data.transfers.length)list.append(text('p','Tidak ditemukan transfer yang dapat diparsing pada sampel ini. Ini tidak berarti wallet tidak pernah bertransaksi.'));
    }
    result.append(list);result.append(text('p','Transfer tidak membuktikan pemilik wallet sama. Saldo token ditampilkan dalam satuan token, bukan nilai USD.','panel-footnote'));
  }
  async function analyze(address,chain,kind){
    if(document.body.classList.contains('signed-out'))return;
    if(!validChainAddress(address,chain)){status.textContent='Alamat tidak sesuai jaringan yang dipilih.';return;}
    if(!['solana','ethereum','base'].includes(chain)||(kind==='holders'&&chain!=='solana')){status.textContent='Analisis wallet tersedia untuk Solana, Ethereum, dan Base. Holder tersedia untuk Solana.';return;}
    current?.abort();const controller=new AbortController();current=controller;button.disabled=true;result.replaceChildren();status.textContent='Mengambil sampel data blockchain…';
    try{
      const cacheKey=`${chain}:${kind}:${address}`;let data=cache.get(cacheKey)?.until>Date.now()?cache.get(cacheKey).data:null;
      if(!data){
        const origin=apiOrigin();
        if(origin){
          const token=await window.easykriptoIdToken();
          const response=await fetch(`${origin}/api/analysis/${kind}?chain=${chain}&address=${encodeURIComponent(address)}`,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.any([controller.signal,AbortSignal.timeout(40000)]),credentials:'omit'});
          const body=await response.json().catch(()=>null);if(!response.ok)throw new Error(body?.error||'Layanan analisis belum tersedia.');data=body;
        }else{
          if(chain!=='solana')throw new Error('Analisis wallet jaringan ini menunggu pengaktifan layanan data oleh pengelola.');
          status.textContent='Menggunakan RPC publik Solana. Akses dapat dibatasi; menampilkan sampel terbatas.';
          const sdk=await import('./chain-data.mjs');
          const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(40000)]),url='https://api.mainnet-beta.solana.com';
          data=kind==='holders'?await sdk.solanaHolders(url,address,signal):await sdk.solanaWallet(url,address,signal);
          data={...data,source:'RPC publik Solana',fetchedAt:new Date().toISOString()};
        }
        if(cache.size>40)cache.clear();cache.set(cacheKey,{data,until:Date.now()+120000});
      }
      if(current!==controller||controller.signal.aborted||chain!==selectedBlockchain||document.body.classList.contains('signed-out'))return;
      render(data);status.textContent=`Sumber: ${data.source} · diambil ${new Date(data.fetchedAt).toLocaleTimeString('id-ID')} · ${data.holders?`${data.sampledTokenAccounts||0} akun token terbesar`:`${data.scanned} catatan diperiksa`}${data.unavailable?` · ${data.unavailable} transaksi tidak tersedia`:''}.`;
    }catch(error){if(current===controller&&!controller.signal.aborted)status.textContent=error.name==='TimeoutError'?'Analisis terlalu lama. Coba lagi nanti.':error.message==='Failed to fetch'?'Sumber blockchain belum dapat dihubungi. RPC publik dapat membatasi browser; coba lagi setelah layanan data diaktifkan.':error.message;}
    finally{if(current===controller){current=null;button.disabled=false;}}
  }
  function setMode(kind){mode=kind;label.textContent=kind==='holders'?'CA token Solana':`Alamat wallet ${currentNetwork().name}`;for(const b of document.querySelectorAll('[data-live-mode]')){b.classList.toggle('active',b.dataset.liveMode===kind);b.setAttribute('aria-pressed',String(b.dataset.liveMode===kind));if(b.dataset.liveMode==='holders')b.disabled=selectedBlockchain!=='solana';}}
  function reset(){current?.abort();current=null;button.disabled=false;setMode('wallet');input.value='';status.textContent='Analisis berdasarkan alamat publik, tanpa menghubungkan wallet.';result.replaceChildren();}
  form.addEventListener('submit',event=>{event.preventDefault();void analyze(input.value.trim(),selectedBlockchain,mode);});
  window.EasyWallet={open({address,chain=selectedBlockchain,kind='wallet'}){if(chain!==selectedBlockchain)return;closeDialog();location.hash='peta';setMode(kind);input.value=address;void analyze(address,chain,kind);}};
  for(const b of document.querySelectorAll('[data-live-mode]'))b.addEventListener('click',()=>{reset();setMode(b.dataset.liveMode);input.focus();});
  document.addEventListener('click',event=>{const b=event.target.closest('[data-analyze-wallet]');if(!b)return;const wallet=state.wallets.find(wallet=>wallet.id===b.dataset.analyzeWallet);if(wallet)window.EasyWallet.open({address:wallet.address,chain:wallet.chain});});
  document.getElementById('live-demo-toggle').addEventListener('click',event=>{const show=event.currentTarget.getAttribute('aria-expanded')!=='true';event.currentTarget.setAttribute('aria-expanded',String(show));document.getElementById('full-map-slot').hidden=!show;event.currentTarget.textContent=show?'Sembunyikan peta simulasi':'Lihat peta simulasi';window.dispatchEvent(new Event('resize'));});
  window.addEventListener('easykripto-network',reset);
  window.addEventListener('easykripto-session',event=>{if(!event.detail.signedIn)reset();});
  reset();
})();
