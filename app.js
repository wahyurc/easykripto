'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const escapeHTML = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const currency = n => new Intl.NumberFormat('id-ID',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const signed = n => `${n < 0 ? '−' : '+'}${currency(Math.abs(n))}`;
const paths = {
 grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 map:'<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="5" cy="20" r="2"/><circle cx="20" cy="19" r="2"/><path d="m6 6 4 4m4 0 4-4M7 18l3-4m4 0 4 4"/>',
 wallet:'<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M21 10h-6v5h6M5 5V3h13"/>',
 activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',arrow:'<path d="M4 12h15m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',
 up:'<path d="M7 17 17 7M7 7h10v10"/>',down:'<path d="M7 7 17 17M7 17h10V7"/>',transfer:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
 spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3ZM20 2v4m-2-2h4"/>',
 help:'<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 1 1 4 3l-1 2M12 17h.01"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
 shield:'<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>',flask:'<path d="M9 3h6m-5 0v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3l-6-9V3M7 15h10"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',locate:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',
 list:'<path d="M9 6h12M9 12h12M9 18h12M3 6h.01M3 12h.01M3 18h.01"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v12h5"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.info}</svg>`;
function hydrate(root = document){ $$('[data-icon]',root).forEach(el => el.innerHTML = icon(el.dataset.icon)); }
function load(key,fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
function save(key,value){ try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { toast('Penyimpanan perangkat tidak tersedia.'); return false; } }

const tokens = [];
const events = [];
const state = {route:'ringkasan',mode:'token',period:24,type:'all',zoom:1,x:0,y:0,reduced:load('easykripto.motion',false) === true,wallets:[],alerts:{}};
const routes = [
 {id:'ringkasan',label:'Ringkasan',icon:'grid',title:'Pahami setiap <span>pergerakan.</span>',desc:'Lihat aktivitas wallet. Temukan hubungan di baliknya.'},
 {id:'peta',label:'Peta',icon:'map',title:'Setiap titik, <span>punya cerita.</span>',desc:'Jelajahi hubungan wallet dan token melalui transaksi.'},
 {id:'pantauan',label:'Pantauan',icon:'wallet',title:'Wallet pilihan, <span>dalam pantauan.</span>',desc:'Simpan alamat dan beri nama agar lebih mudah dikenali.'},
 {id:'aktivitas',label:'Aktivitas',icon:'activity',title:'Ikuti jejak <span>aktivitasnya.</span>',desc:'Lihat transfer masuk, keluar, dan hubungan antarwallet.'},
 {id:'superadmin',label:'Superadmin',icon:'shield',title:'Kenali pengguna. <span>Pahami kunjungannya.</span>',desc:'Pantau kunjungan dan akun terdaftar dalam satu ruang.',adminOnly:true}
];
let canSuperadmin = false;
const getWallet = id => state.wallets.find(w=>w.id===id);
const age = m => m<60?`${m} mnt`:m<1440?`${Math.floor(m/60)} jam`:`${Math.floor(m/1440)} hari`;
let toastTimer;
function toast(text){if(window.EasyNotifications){window.EasyNotifications.toast(text);return;} $('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000); }

const map = document.createElement('section');map.id='interactive-map';map.className='panel';map.append($('#map-template').content.cloneNode(true));
$('#overview-map-slot').className='';$('#overview-map-slot').append(map);
function navigate(id){ if(location.hash===`#${id}`)renderRoute();else location.hash=id; }
function renderRoute(){
 const availableRoutes=routes.filter(r=>!r.adminOnly||canSuperadmin);
 state.route=availableRoutes.some(r=>r.id===location.hash.slice(1))?location.hash.slice(1):'ringkasan';
 document.body.classList.toggle('superadmin-view',state.route==='superadmin');
 const r=routes.find(r=>r.id===state.route);
 $$('.view').forEach(v=>v.hidden=v.id!==`view-${r.id}`);
 $('#page-title').innerHTML=r.title;$('#page-description').textContent=r.desc;$('#breadcrumb').textContent=r.label;document.title=`${r.label} — Easykripto`;
 const nav=availableRoutes.map(v=>`<button class="nav-button ${v.id===r.id?'active':''}" data-route="${v.id}" ${v.id===r.id?'aria-current="page"':''}>${icon(v.icon)}<span>${v.label}</span></button>`).join('');
 $('.desktop-nav').innerHTML=nav;$('.bottom-nav').innerHTML=nav;
 $(r.id==='peta'?'#full-map-slot':'#overview-map-slot').append(map);map.classList.toggle('full-map',r.id==='peta');transform();
 window.scrollTo(0,0);
}
function row(e){return window.EasyDashboard?.row(e)||'';}
function renderSummary(){window.EasyDashboard?.summary();}
function renderActivities(){window.EasyDashboard?.activities();}
function renderWallets(){window.EasyDashboard?.wallets();}
function transform(){
 $('.graph-world').setAttribute('transform',`translate(${360+state.x} ${230+state.y}) scale(${state.zoom}) translate(-360 -230)`);
 const bounds=$('.bubble-map').getBoundingClientRect();
 const scale=Math.min(bounds.width/720,bounds.height/460)*state.zoom;
 if(scale<=0)return;
 $$('.graph-node').forEach(node=>{
  let hit=$('.node-hit',node);
  if(!hit){hit=document.createElementNS('http://www.w3.org/2000/svg','circle');hit.setAttribute('class','node-hit');hit.setAttribute('fill','transparent');node.prepend(hit);}
  hit.setAttribute('r',String(Math.max(25,24/scale)));
 });
}
function motion(){document.body.classList.toggle('reduce-motion',state.reduced);const svg=$('.bubble-map');if(state.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches)svg.pauseAnimations?.();else svg.unpauseAnimations?.();}
function renderMap(){window.EasyDashboard?.map();}

let returnFocus;
function dialog(title,content,eyebrow='DETAIL DATA'){
 const d=$('#detail-dialog');if(!d.open)returnFocus=document.activeElement;
 $('#dialog-eyebrow').textContent=eyebrow;$('#dialog-content').innerHTML=`<h2 id="dialog-title">${escapeHTML(title)}</h2>${content}`;hydrate(d);
 if(!d.open){d.showModal();document.body.style.overflow='hidden';}
}
function closeDialog(){$('#detail-dialog').close();}
$('#detail-dialog').addEventListener('close',()=>{document.body.style.overflow=$('#notification-dialog')?.open?'hidden':'';if(returnFocus?.isConnected&&!$('#notification-dialog')?.open)returnFocus.focus({preventScroll:true});});
$('#detail-dialog').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog();});
function showToken(id){window.EasyDashboard?.openToken(id);}
function showWallet(id){
 const w=getWallet(id);if(!w)return;const data=window.EasyDashboard?.snapshot(w);
 dialog(w.name,`<div class="address-block" style="margin-top:20px">${escapeHTML(w.address)}</div>${data?`<p class="live-metric">${escapeHTML(data.nativeBalance)} ${escapeHTML(data.nativeSymbol)}</p><p class="detail-note">${escapeHTML(data.note)}<br>Sumber: ${escapeHTML(data.source)} · ${new Date(data.fetchedAt).toLocaleString('id-ID')}</p>`:''}<button class="secondary-button full-width" data-copy="${escapeHTML(w.address)}">${icon('copy')} Salin alamat</button><button class="primary-button full-width" data-analyze-wallet="${escapeHTML(w.id)}">Analisis wallet ${icon('arrow')}</button><div class="detail-note">Data merupakan sampel transaksi, bukan seluruh riwayat. Tidak perlu seed phrase atau private key.</div><button class="danger-button" data-remove="${escapeHTML(id)}">Hapus dari pantauan</button>`,'WALLET PANTAUAN');
}
function showEvents(ids){window.EasyDashboard?.showEvents(ids);}
function addWallet(){dialog('Beri nama pada jejaknya.',`<form id="wallet-form" novalidate><div class="form-field"><label for="wallet-name">Nama wallet</label><input id="wallet-name" maxlength="32" required placeholder="Contoh: Wallet riset saya" autocomplete="off"></div><div class="form-field"><label for="wallet-address">Alamat wallet ${currentNetwork().name}</label><input id="wallet-address" required placeholder="Tempel alamat publik" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="address-hint wallet-error"><small id="address-hint">Cukup alamat publik. Tidak perlu seed phrase atau private key.</small></div><p id="wallet-error" class="form-error" role="alert"></p><button class="primary-button full-width" type="submit">Simpan wallet ${icon('plus')}</button><p class="panel-footnote">Pantauan disimpan per akun. Salinan pada perangkat tersedia jika sinkronisasi gagal.</p></form>`,'DAFTAR PANTAUAN');$('#wallet-name').focus();}
function validAddress(value){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return false;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of value)n=n*58n+BigInt(alphabet.indexOf(c));let count=0;while(n>0n){count++;n>>=8n;}return count+(value.match(/^1*/)?.[0].length||0)===32;}
document.addEventListener('submit',e=>{
 if(e.target.id!=='wallet-form')return;e.preventDefault();if(!window.EasyDashboard?.allowed())return;const name=$('#wallet-name').value.trim(),address=$('#wallet-address').value.trim();
 const error=!name?'Isi nama wallet terlebih dahulu.':!validChainAddress(address)?`Alamat tidak sesuai format ${currentNetwork().name}. ${currentNetwork().kind==='evm'?'Gunakan 0x diikuti 40 karakter heksadesimal.':'Gunakan public key Base58 32 byte.'}`:state.wallets.some(w=>w.chain===selectedBlockchain&&equalChainAddress(w.address,address))?'Alamat sudah dipantau pada jaringan ini.':'';
 if(error){$('#wallet-error').textContent=error;(!name?$('#wallet-name'):$('#wallet-address')).focus();return;}
 const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
 if(!window.EasyDashboard.addWallet({id:`local-${id}`,name,address,chain:selectedBlockchain,alert:false}))return;closeDialog();navigate('pantauan');toast(`Wallet ${currentNetwork().name} disimpan. Mengambil sampel transaksi…`);
});

const svg=$('.bubble-map'),pointers=new Map();let gesture=null,suppressClick=false;
function point(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;return p.matrixTransform(svg.getScreenCTM().inverse());}
function beginGesture(){gesture={points:[...pointers.values()].map(p=>({x:p.x,y:p.y})),x:state.x,y:state.y,zoom:state.zoom};}
svg.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;if(!pointers.size)suppressClick=false;pointers.set(e.pointerId,point(e));beginGesture();});
svg.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,point(e));const a=[...pointers.values()],b=gesture.points;
 if(a.length===1&&b.length===1){const dx=a[0].x-b[0].x,dy=a[0].y-b[0].y;if(Math.hypot(dx,dy)>6){suppressClick=true;svg.setPointerCapture(e.pointerId);}state.x=Math.max(-550,Math.min(550,gesture.x+dx));state.y=Math.max(-400,Math.min(400,gesture.y+dy));}
 if(a.length===2&&b.length===2){suppressClick=true;const ratio=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)/Math.max(1,Math.hypot(b[0].x-b[1].x,b[0].y-b[1].y));state.zoom=Math.max(.75,Math.min(2.8,gesture.zoom*ratio));}transform();
});
function endPointer(e){pointers.delete(e.pointerId);if(pointers.size)beginGesture();else gesture=null;}
window.addEventListener('pointerup',endPointer);window.addEventListener('pointercancel',endPointer);
svg.addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)&&e.target.closest('[data-node],[data-edge]')){e.preventDefault();suppressClick=false;e.target.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});

document.addEventListener('click',async e=>{
 const b=e.target.closest('button,[data-node],[data-edge]');if(!b)return;const d=b.dataset;
 if(d.route){navigate(d.route);return;}
 if(d.node||d.edge){if(suppressClick){suppressClick=false;return;}if(d.edge)showEvents(d.edge.split(','));else window.EasyDashboard?.showNode(d.node);return;}
 if(d.token){showToken(d.token);return;}if(d.wallet){showWallet(d.wallet);return;}if(d.event){showEvents([d.event]);return;}
 if(d.mode){state.mode=d.mode;state.zoom=1;state.x=state.y=0;renderMap();return;}
 if(d.period){state.period=Number(d.period);renderMap();return;}if(d.type){state.type=d.type;renderActivities();return;}
 if(d.mapAction){if(d.mapAction==='reset'){state.zoom=1;state.x=state.y=0;}else state.zoom=Math.max(.75,Math.min(2.8,state.zoom*(d.mapAction==='in'?1.2:1/1.2)));transform();return;}
 if(b.classList.contains('map-list-toggle')){const list=$('.map-list');list.hidden=!list.hidden;b.setAttribute('aria-expanded',!list.hidden);b.innerHTML=`${icon('list')} ${list.hidden?'Lihat daftar':'Tutup daftar'}`;return;}
 if(d.alert){window.EasyDashboard?.toggleAlert(d.alert);return;}
 if(d.copy){try{await navigator.clipboard.writeText(d.copy);toast('Alamat wallet disalin.');}catch{toast('Pilih dan salin alamat secara manual dari panel.');}return;}
 if(d.remove){dialog('Hapus wallet ini?',`<p class="dialog-body-copy" style="margin-top:14px">${escapeHTML(getWallet(d.remove)?.name||'Wallet')} akan dihapus dari pantauan akun ini.</p><button class="danger-button" data-confirm-remove="${escapeHTML(d.remove)}">Hapus wallet</button><button class="secondary-button full-width" data-wallet="${escapeHTML(d.remove)}">Kembali</button>`,'DAFTAR PANTAUAN');return;}
 if(d.confirmRemove){window.EasyDashboard?.removeWallet(d.confirmRemove);closeDialog();toast('Wallet dihapus dari pantauan.');return;}
 switch(d.action){
  case 'add-wallet':addWallet();break;
  case 'close-dialog':closeDialog();break;
  case 'guide':dialog('Baca peta dengan mudah.',`<div class="dialog-body-copy"><div class="guide-step"><b>1</b><p><strong>Pilih sudut pandang.</strong><br>Wallet & token menunjukkan arah perpindahan aset. Antarwallet menunjukkan alamat asal dan tujuan.</p></div><div class="guide-step"><b>2</b><p><strong>Ketuk untuk detail.</strong><br>Lingkaran membuka wallet atau token. Garis membuka transaksi.</p></div><div class="guide-step"><b>3</b><p><strong>Jelajahi sesuai waktunya.</strong><br>Pilih periode, geser peta, lalu cubit atau gunakan tombol perbesar.</p></div><p>Ukuran lingkaran mengikuti jumlah kemunculan pada sampel, bukan saldo atau nilai investasi. Maksimal 24 titik ditampilkan; daftar tetap memuat seluruh catatan yang dimuat. Tombol <strong>Lihat daftar</strong> menyediakan alternatif peta.</p></div><button class="primary-button full-width" data-action="close-dialog">Mulai menjelajah</button>`,'PANDUAN');break;
  case 'about-data':dialog('Sumber dan cakupan data.',`<div class="dialog-body-copy"><p>Harga dan volume pasangan: DEX Screener. Grafik: GeckoTerminal. Pemeriksaan risiko: GoPlus, dengan cakupan sesuai jaringan.</p><p>Transfer wallet: Helius untuk Solana dan Alchemy untuk Ethereum, Base, BNB Chain, serta Robinhood. Solana: maksimal 8 transaksi alamat. EVM: maksimal 25 transfer masuk dan 25 keluar. Holder Solana: pemilik dari maksimal 20 akun token terbesar.</p><p>Pantauan disimpan pada akun Firebase kamu dan pada perangkat. Alamat publik dikirim ke layanan data untuk dianalisis. API key disimpan pada server Cloudflare.</p><p>Data diperbarui saat diminta atau saat lonceng aktif dan aplikasi terbuka. Cache 2 menit. Maksimal 4 analisis per menit; permintaan tambahan menunggu giliran. Hubungan transfer bukan bukti pemilik wallet yang sama.</p></div>`,'TRANSPARANSI DATA');break;
  case 'settings':dialog('Nyaman dengan caramu.',`<div class="setting-row"><div><strong>Kurangi gerakan</strong><p>Matikan titik bergerak pada peta.</p></div><button class="switch" role="switch" aria-label="Kurangi gerakan" aria-checked="${state.reduced}" data-action="toggle-motion"></button></div><div class="detail-note">Lonceng memeriksa wallet secara bergiliran setiap 65 detik saat aplikasi terbuka. Cache 2 menit. Ini bukan pemantauan 24 jam.</div><button class="secondary-button full-width" data-action="notification-permission">Izinkan notifikasi browser</button>`,'PENGATURAN');break;
  case 'toggle-motion':state.reduced=!state.reduced;save('easykripto.motion',state.reduced);b.setAttribute('aria-checked',state.reduced);motion();break;
 }
});
window.addEventListener('easykripto-session',event=>{canSuperadmin=event.detail.user?.role==='superadmin';document.body.classList.toggle('has-superadmin',canSuperadmin);renderRoute();});
$('#wallet-search').addEventListener('input',renderWallets);window.addEventListener('hashchange',renderRoute);window.addEventListener('resize',transform);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',motion);
hydrate();renderSummary();renderActivities();renderWallets();renderMap();renderRoute();
