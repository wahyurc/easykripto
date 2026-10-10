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

const tokens = [
 {id:'arka',name:'ARKA',full:'Arka Protocol',initial:'A',theme:'',x:356,y:218,r:55,mc:845000,liquidity:126000},
 {id:'nomi',name:'NOMI',full:'Nomi Network',initial:'N',theme:'violet',x:548,y:118,r:37,mc:321000,liquidity:68000},
 {id:'kora',name:'KORA',full:'Kora Labs',initial:'K',theme:'coral',x:538,y:352,r:34,mc:178000,liquidity:34000}
];
const demoWallets = [
 {id:'awan',name:'Awan',initial:'AW',label:'Pengamat awal',x:155,y:100,demo:true},
 {id:'rimba',name:'Rimba',initial:'RI',label:'Aktif di Solana',x:150,y:300,demo:true},
 {id:'sora',name:'Sora',initial:'SO',label:'Pemegang bertahap',x:350,y:395,demo:true},
 {id:'dune',name:'Dune',initial:'DU',label:'Penjelajah token',x:617,y:236,demo:true}
];
// Relative times and prices are fixed demo fixtures, not live market data.
const events = [
 {id:'e1',wallet:'awan',token:'arka',type:'buy',usd:4250,qty:50000,minutes:4},
 {id:'e2',wallet:'dune',token:'nomi',type:'sell',usd:1820,qty:20000,minutes:12},
 {id:'e3',wallet:'rimba',token:'arka',type:'buy',usd:3100,qty:38000,minutes:23},
 {id:'e4',wallet:'awan',to:'rimba',token:'nomi',type:'transfer',usd:650,qty:7000,minutes:42},
 {id:'e5',wallet:'sora',token:'arka',type:'buy',usd:2200,qty:27000,minutes:78},
 {id:'e6',wallet:'dune',token:'kora',type:'buy',usd:1680,qty:24000,minutes:130},
 {id:'e7',wallet:'rimba',token:'kora',type:'sell',usd:740,qty:10000,minutes:245},
 {id:'e8',wallet:'awan',token:'nomi',type:'buy',usd:2360,qty:26000,minutes:420},
 {id:'e9',wallet:'rimba',to:'sora',token:'arka',type:'transfer',usd:900,qty:10000,minutes:720},
 {id:'e10',wallet:'sora',token:'nomi',type:'sell',usd:980,qty:11000,minutes:1110},
 {id:'e11',wallet:'dune',to:'awan',token:'kora',type:'transfer',usd:410,qty:6000,minutes:2200},
 {id:'e12',wallet:'awan',token:'arka',type:'sell',usd:1600,qty:19000,minutes:3400}
];
const stored = load('easykripto.wallets',[]);
const storedAlerts = load('easykripto.alerts',{});
const state = {route:'ringkasan',mode:'token',period:24,type:'all',zoom:1,x:0,y:0,reduced:load('easykripto.motion',false) === true,
 wallets:Array.isArray(stored)?stored.filter(w=>w&&typeof w.id==='string'&&typeof w.name==='string'&&typeof w.address==='string').map(w=>({id:w.id,name:w.name,address:w.address,chain:typeof w.chain==='string'?w.chain:'solana',demo:false})):[],
 alerts:storedAlerts && typeof storedAlerts === 'object' && !Array.isArray(storedAlerts)?storedAlerts:{}
};
const routes = [
 {id:'ringkasan',label:'Ringkasan',icon:'grid',title:'Pahami setiap <span>pergerakan.</span>',desc:'Lihat aktivitas wallet. Temukan hubungan di baliknya.'},
 {id:'peta',label:'Peta',icon:'map',title:'Setiap titik, <span>punya cerita.</span>',desc:'Jelajahi hubungan wallet dan token melalui transaksi.'},
 {id:'pantauan',label:'Pantauan',icon:'wallet',title:'Wallet pilihan, <span>dalam pantauan.</span>',desc:'Simpan alamat dan beri nama agar lebih mudah dikenali.'},
 {id:'aktivitas',label:'Aktivitas',icon:'activity',title:'Ikuti jejak <span>aktivitasnya.</span>',desc:'Bedakan pembelian, penjualan, dan perpindahan aset.'},
 {id:'superadmin',label:'Superadmin',icon:'shield',title:'Kenali pengguna. <span>Pahami kunjungannya.</span>',desc:'Pantau kunjungan dan akun terdaftar dalam satu ruang.',adminOnly:true}
];
let canSuperadmin = false;
const getWallet = id => [...demoWallets,...state.wallets].find(w=>w.id===id);
const getToken = id => tokens.find(t=>t.id===id);
const inPeriod = () => selectedBlockchain==='solana'?events.filter(e=>e.minutes<=state.period*60):[];
const net = list => list.reduce((n,e)=>n+(e.type==='buy'?e.usd:e.type==='sell'?-e.usd:0),0);
const age = m => m<60?`${m} mnt`:m<1440?`${Math.floor(m/60)} jam`:`${Math.floor(m/1440)} hari`;
let toastTimer;
function toast(text){ $('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),4000); }

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
function row(e){
 const w=getWallet(e.wallet),t=getToken(e.token),text=e.type==='transfer'?`${w.name} → ${getWallet(e.to).name}`:`${w.name} ${e.type==='buy'?'membeli':'menjual'} ${t.name}`;
 return `<button class="activity-row" data-event="${e.id}"><span class="activity-icon ${e.type}">${icon(e.type==='buy'?'down':e.type==='sell'?'up':'transfer')}</span><span class="activity-main"><strong>${escapeHTML(text)}</strong><small>${e.type==='transfer'?`Transfer ${t.name}`:'Solana'} · simulasi</small></span><span class="activity-number">${currency(e.usd)}<small>${age(e.minutes)} lalu</small></span></button>`;
}
function renderSummary(){
 const solana=selectedBlockchain==='solana',list=solana?events.filter(e=>e.minutes<=1440):[],wallets=availableWallets();
 const stats=[['Wallet pantauan',String(wallets.length),'wallet',`${wallets.filter(w=>!w.demo).length} tersimpan · ${currentNetwork().name}`],['Pembelian bersih',solana?signed(net(list)):'—','up',solana?'Beli − jual · contoh 24 jam':'Data transaksi belum terhubung'],['Token terpantau',solana?'03':'—','map',solana?'Dalam kumpulan data simulasi':'Belum ada data pantauan'],['Aktivitas wallet',solana?String(list.length):'—','activity',solana?'Termasuk transfer · contoh 24 jam':'Data transaksi belum terhubung']];
 $('#stats').innerHTML=stats.map(([label,value,i,note],index)=>`<article class="stat-card"><div class="stat-label">${label}${icon(i)}</div><div class="stat-value ${index===1?'positive':''}">${value}</div><div class="stat-note">${note}</div></article>`).join('');
 $('#token-cards').innerHTML=tokens.map(t=>{const es=list.filter(e=>e.token===t.id),n=net(es),count=new Set(es.filter(e=>e.type!=='transfer').map(e=>e.wallet)).size;return `<button class="token-card" data-token="${t.id}"><div class="token-card-head"><span class="token-logo ${t.theme}">${t.initial}</span><span class="token-name"><strong>${t.name}</strong><small>Token simulasi</small></span></div><div class="token-card-value ${n<0?'negative':''}">${signed(n)}</div><div class="token-card-caption">Pembelian bersih · 24 jam</div><div class="token-card-bottom"><span>${count} wallet bertransaksi</span>${icon('arrow')}</div></button>`;}).join('');
 $('#recent-activity').innerHTML=events.slice(0,4).map(row).join('');
}
function renderActivities(){ $('#all-activity').innerHTML=(selectedBlockchain==='solana'?events:[]).filter(e=>state.type==='all'||e.type===state.type).map(row).join('')||'<div class="empty-state">Data transaksi jaringan ini belum terhubung.</div>';$$('.activity-filters button').forEach(b=>{const on=b.dataset.type===state.type;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);}); }
function renderWallets(){
 const q=$('#wallet-search').value.toLowerCase();
 $('#wallet-list').innerHTML=availableWallets().filter(w=>`${w.name} ${w.address||''}`.toLowerCase().includes(q)).map(w=>`<article class="wallet-card"><div class="wallet-card-heading"><span class="wallet-avatar">${escapeHTML(w.initial||w.name.slice(0,2).toUpperCase())}</span><div><h3>${escapeHTML(w.name)}</h3><small>${w.demo?w.label:escapeHTML(`${w.address.slice(0,6)}…${w.address.slice(-5)}`)}</small></div></div><div class="wallet-status"><span class="chain-dot"></span>${w.demo?'Wallet contoh · data simulasi':'Alamat publik · siap ditelusuri'}</div><div class="wallet-card-footer"><button class="text-button" data-wallet="${escapeHTML(w.id)}">Lihat detail ${icon('arrow')}</button><button class="icon-button" data-alert="${escapeHTML(w.id)}" aria-label="Preferensi pemberitahuan ${escapeHTML(w.name)}" aria-pressed="${!!state.alerts[w.id]}">${icon('bell')}</button></div></article>`).join('')||'<div class="empty-state">Tidak ada wallet yang cocok.</div>';
}
function mapEvents(){return inPeriod().filter(e=>state.mode==='wallet'?e.type==='transfer':e.type!=='transfer');}
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
function renderMap(){
 const positions={awan:[210,100],rimba:[490,120],sora:[480,350],dune:[210,345]};
 const nodes=selectedBlockchain!=='solana'?[]:state.mode==='token'?[...demoWallets,...tokens]:demoWallets.map(w=>({...w,x:positions[w.id][0],y:positions[w.id][1],r:34}));
 const list=mapEvents(),active=new Set(),groups=new Map();
 list.forEach(e=>{const target=state.mode==='wallet'?e.to:e.token;active.add(e.wallet);active.add(target);const key=`${e.wallet}-${target}-${e.type}`;if(!groups.has(key))groups.set(key,{source:e.wallet,target,type:e.type,events:[]});groups.get(key).events.push(e);});
 let html='';
 groups.forEach((g,key)=>{
  let a=nodes.find(n=>n.id===g.source),b=nodes.find(n=>n.id===g.target);if(g.type==='sell')[a,b]=[b,a];
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ar=(a.r||25)+7,br=(b.r||25)+7;
  const x1=a.x+dx/length*ar,y1=a.y+dy/length*ar,x2=b.x-dx/length*br,y2=b.y-dy/length*br;
  const c=g.type==='sell'?-16:16,path=`M ${x1} ${y1} Q ${(x1+x2)/2-dy/length*c} ${(y1+y2)/2+dx/length*c} ${x2} ${y2}`;
  const color={buy:'#63dac6',sell:'#f28e9a',transfer:'#aaa0f5'}[g.type];
  html+=`<defs><marker id="arrow-${key}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10Z" fill="${color}"/></marker></defs><g class="graph-edge" role="button" tabindex="0" data-edge="${g.events.map(e=>e.id).join(',')}" aria-label="${a.name} ke ${b.name}" ><title>${a.name} → ${b.name} · ${g.events.length} transaksi simulasi</title><path class="edge-hit" d="${path}"/><path class="edge-line" d="${path}" stroke="${color}" marker-end="url(#arrow-${key})"/><circle class="flow-dot" r="2.5" fill="${color}" pointer-events="none"><animateMotion dur="4s" repeatCount="indefinite" path="${path}"/></circle></g>`;
 });
 nodes.forEach(n=>{
  const t=!!n.full,r=n.r||25,on=active.has(n.id),color=t?({violet:'#ac9ae6',coral:'#d89c7c'}[n.theme]||'#94d991'):'#4a647a';
  const value=net(list.filter(e=>e.token===n.id));
  html+=`<g class="graph-node" role="button" tabindex="0" data-node="${n.id}" aria-label="${t?'Token':'Wallet'} ${n.name}" transform="translate(${n.x} ${n.y})" opacity="${on?1:.48}"><circle r="${r+8}" fill="none" stroke="${color}" stroke-opacity=".13"/><circle class="node-outline" r="${r}" fill="${t?({violet:'#27263d',coral:'#392b28'}[n.theme]||'#233c2c'):'#1b2c39'}" stroke="${color}" ${t?'':'stroke-dasharray="3 3"'}/><text class="${t?'token-symbol':'wallet-initial'}" text-anchor="middle" y="${t?-1:5}" style="font-size:${t?(r>40?25:20):13}px">${t?n.initial:n.initial}</text>${t?`<text class="node-value" text-anchor="middle" y="20" style="font-size:${r>40?10:8}px">${signed(value)}</text>`:''}<text class="node-label" text-anchor="middle" y="${r+24}">${n.name}</text><text class="node-sub" text-anchor="middle" y="${r+39}">${t?'token contoh':on?'wallet pantauan':'tidak aktif pada filter ini'}</text></g>`;
 });
 $('.graph-world').innerHTML=html;$('.map-count').textContent=`${list.length} transaksi contoh · ${state.period===168?'7 hari':`${state.period} jam`}`;$('.map-empty').hidden=list.length>0;
 $('.map-list').innerHTML=list.map(row).join('')||'<div class="empty-state">Tidak ada transaksi pada periode ini.</div>';
 $$('.map-modes button').forEach(b=>{const on=b.dataset.mode===state.mode;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
 $$('.period-selector button').forEach(b=>{const on=Number(b.dataset.period)===state.period;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);b.setAttribute('aria-label',Number(b.dataset.period)===168?'7 hari':`${b.dataset.period} jam`);});transform();motion();
}

let returnFocus;
function dialog(title,content,eyebrow='DETAIL SIMULASI'){
 const d=$('#detail-dialog');if(!d.open)returnFocus=document.activeElement;
 $('#dialog-eyebrow').textContent=eyebrow;$('#dialog-content').innerHTML=`<h2 id="dialog-title">${escapeHTML(title)}</h2>${content}`;hydrate(d);
 if(!d.open){d.showModal();document.body.style.overflow='hidden';}
}
function closeDialog(){$('#detail-dialog').close();}
$('#detail-dialog').addEventListener('close',()=>{document.body.style.overflow='';if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
$('#detail-dialog').addEventListener('click',e=>{if(e.target!==e.currentTarget)return;const b=e.currentTarget.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog();});
function showToken(id){const t=getToken(id);if(!t)return;const list=events.filter(e=>e.token===id&&e.minutes<=1440);dialog(t.name,`<p class="dialog-body-copy" style="margin:10px 0 20px">${t.full} · token fiktif / simulasi</p><div class="detail-metrics"><div class="detail-metric"><small>Pembelian bersih · 24 jam</small><strong>${signed(net(list))}</strong></div><div class="detail-metric"><small>Wallet pembeli · 24 jam</small><strong>${new Set(list.filter(e=>e.type==='buy').map(e=>e.wallet)).size}</strong></div><div class="detail-metric"><small>Market cap contoh</small><strong>${currency(t.mc)}</strong></div><div class="detail-metric"><small>Likuiditas contoh</small><strong>${currency(t.liquidity)}</strong></div></div><div class="detail-note">Pembelian bersih = beli − jual. Transfer dihitung terpisah. Semua angka adalah simulasi.</div><h3 class="detail-title">Jejak transaksi · 24 jam</h3><div class="detail-activity">${list.map(row).join('')}</div>`);}
function showWallet(id){const w=getWallet(id);if(!w)return;dialog(w.name,w.demo?`<div class="detail-note">Wallet contoh ini tidak mewakili individu atau alamat blockchain.</div><div class="detail-activity">${events.filter(e=>e.wallet===id||e.to===id).map(row).join('')}</div>`:`<div class="address-block" style="margin-top:20px">${escapeHTML(w.address)}</div><button class="secondary-button full-width" data-copy="${escapeHTML(w.address)}">${icon('copy')} Salin alamat</button><button class="primary-button full-width" data-analyze-wallet="${escapeHTML(w.id)}">Analisis wallet ${icon('arrow')}</button><div class="detail-note">Analisis mengambil sampel transaksi yang tersedia pada jaringan wallet. Tidak perlu seed phrase atau private key.</div><button class="danger-button" data-remove="${escapeHTML(id)}">Hapus dari pantauan</button>`,w.demo?'WALLET SIMULASI':'WALLET TERSIMPAN');}
function showEvents(ids){const list=ids.map(id=>events.find(e=>e.id===id)).filter(Boolean);if(!list.length)return;if(list.length>1){dialog('Jejak hubungan',`<div class="detail-note">${list.length} transaksi pada periode yang dipilih.</div><div class="detail-activity">${list.map(row).join('')}</div>`);return;}const e=list[0],t=getToken(e.token);dialog(`${{buy:'Pembelian',sell:'Penjualan',transfer:'Transfer'}[e.type]} ${t.name}`,`<div class="detail-note">${getWallet(e.wallet).name}${e.to?` → ${getWallet(e.to).name}`:''} · ${age(e.minutes)} lalu dalam skenario contoh.</div><div class="detail-metrics"><div class="detail-metric"><small>Nilai contoh</small><strong>${currency(e.usd)}</strong></div><div class="detail-metric"><small>Jumlah ${t.name}</small><strong>${new Intl.NumberFormat('id-ID').format(e.qty)}</strong></div></div><p class="dialog-body-copy">Ini transaksi simulasi, sehingga tidak memiliki hash atau tautan explorer.</p><button class="secondary-button full-width" data-token="${t.id}">Lihat token ${icon('arrow')}</button>`);}
function addWallet(){dialog('Beri nama pada jejaknya.',`<form id="wallet-form" novalidate><div class="form-field"><label for="wallet-name">Nama wallet</label><input id="wallet-name" maxlength="32" required placeholder="Contoh: Wallet riset saya" autocomplete="off"></div><div class="form-field"><label for="wallet-address">Alamat wallet ${currentNetwork().name}</label><input id="wallet-address" required placeholder="Tempel alamat publik" autocomplete="off" autocapitalize="off" spellcheck="false" aria-describedby="address-hint wallet-error"><small id="address-hint">Cukup alamat publik. Tidak perlu seed phrase atau private key.</small></div><p id="wallet-error" class="form-error" role="alert"></p><button class="primary-button full-width" type="submit">Simpan wallet ${icon('plus')}</button><p class="panel-footnote">Disimpan pada perangkat ini. Buka detail wallet untuk mengambil sampel data blockchain.</p></form>`,'DAFTAR PANTAUAN');$('#wallet-name').focus();}
function validAddress(value){if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value))return false;const alphabet='123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';let n=0n;for(const c of value)n=n*58n+BigInt(alphabet.indexOf(c));let count=0;while(n>0n){count++;n>>=8n;}return count+(value.match(/^1*/)?.[0].length||0)===32;}
document.addEventListener('submit',e=>{
 if(e.target.id!=='wallet-form')return;e.preventDefault();const name=$('#wallet-name').value.trim(),address=$('#wallet-address').value.trim();
 const error=!name?'Isi nama wallet terlebih dahulu.':!validChainAddress(address)?`Alamat tidak sesuai format ${currentNetwork().name}. ${currentNetwork().kind==='evm'?'Gunakan 0x diikuti 40 karakter heksadesimal.':'Gunakan public key Base58 32 byte.'}`:state.wallets.some(w=>w.chain===selectedBlockchain&&equalChainAddress(w.address,address))?'Alamat sudah dipantau pada jaringan ini.':'';
 if(error){$('#wallet-error').textContent=error;(!name?$('#wallet-name'):$('#wallet-address')).focus();return;}
 const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(16).slice(2)}`;
 state.wallets.push({id:`local-${id}`,name,address,chain:selectedBlockchain,demo:false});const saved=save('easykripto.wallets',state.wallets);renderWallets();renderSummary();closeDialog();navigate('pantauan');if(saved)toast(`Wallet ${currentNetwork().name} disimpan. Pemantauan blockchain belum aktif.`);
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
 if(d.node||d.edge){if(suppressClick){suppressClick=false;return;}if(d.edge)showEvents(d.edge.split(','));else if(getToken(d.node))showToken(d.node);else showWallet(d.node);return;}
 if(d.token){showToken(d.token);return;}if(d.wallet){showWallet(d.wallet);return;}if(d.event){showEvents([d.event]);return;}
 if(d.mode){state.mode=d.mode;state.zoom=1;state.x=state.y=0;renderMap();return;}
 if(d.period){state.period=Number(d.period);renderMap();return;}if(d.type){state.type=d.type;renderActivities();return;}
 if(d.mapAction){if(d.mapAction==='reset'){state.zoom=1;state.x=state.y=0;}else state.zoom=Math.max(.75,Math.min(2.8,state.zoom*(d.mapAction==='in'?1.2:1/1.2)));transform();return;}
 if(b.classList.contains('map-list-toggle')){const list=$('.map-list');list.hidden=!list.hidden;b.setAttribute('aria-expanded',!list.hidden);b.innerHTML=`${icon('list')} ${list.hidden?'Lihat daftar':'Tutup daftar'}`;return;}
 if(d.alert){state.alerts[d.alert]=!state.alerts[d.alert];const saved=save('easykripto.alerts',state.alerts);renderWallets();if(saved)toast('Preferensi disimpan. Pengiriman notifikasi belum aktif.');return;}
 if(d.copy){try{await navigator.clipboard.writeText(d.copy);toast('Alamat wallet disalin.');}catch{toast('Pilih dan salin alamat secara manual dari panel.');}return;}
 if(d.remove){dialog('Hapus wallet ini?',`<p class="dialog-body-copy" style="margin-top:14px">${escapeHTML(getWallet(d.remove)?.name||'Wallet')} akan dihapus dari daftar pada perangkat ini.</p><button class="danger-button" data-confirm-remove="${escapeHTML(d.remove)}">Hapus wallet</button><button class="secondary-button full-width" data-wallet="${escapeHTML(d.remove)}">Kembali</button>`,'DAFTAR PANTAUAN');return;}
 if(d.confirmRemove){state.wallets=state.wallets.filter(w=>w.id!==d.confirmRemove);delete state.alerts[d.confirmRemove];const saved=save('easykripto.wallets',state.wallets);save('easykripto.alerts',state.alerts);renderWallets();renderSummary();closeDialog();if(saved)toast('Wallet dihapus dari pantauan.');return;}
 switch(d.action){
  case 'add-wallet':addWallet();break;
  case 'close-dialog':closeDialog();break;
  case 'focus-arka':state.mode='token';state.period=24;renderMap();navigate('peta');showToken('arka');break;
  case 'guide':dialog('Baca peta dengan mudah.',`<div class="dialog-body-copy"><div class="guide-step"><b>1</b><p><strong>Pilih sudut pandang.</strong><br>Wallet & token menunjukkan beli/jual. Antarwallet menunjukkan transfer langsung.</p></div><div class="guide-step"><b>2</b><p><strong>Ketuk untuk detail.</strong><br>Lingkaran membuka wallet atau token. Garis membuka transaksi.</p></div><div class="guide-step"><b>3</b><p><strong>Jelajahi sesuai waktunya.</strong><br>Pilih periode, geser peta, lalu cubit atau gunakan tombol perbesar.</p></div><p>Ukuran lingkaran ditetapkan untuk tata letak, bukan nilai investasi. Tombol <strong>Lihat daftar</strong> menyediakan alternatif peta.</p></div><button class="primary-button full-width" data-action="close-dialog">Mulai menjelajah</button>`,'PANDUAN');break;
  case 'about-data':dialog('Data contoh untuk eksplorasi.',`<div class="dialog-body-copy"><p>Semua token, wallet bawaan, nominal, dan waktu transaksi adalah simulasi.</p><p>Alamat yang kamu tambahkan tersimpan di browser ini. Tidak dikirim ke server atau penyedia data.</p><p>API, data pasar, dan notifikasi blockchain belum dihubungkan.</p></div>`,'TRANSPARANSI DATA');break;
  case 'settings':dialog('Nyaman dengan caramu.',`<div class="setting-row"><div><strong>Kurangi gerakan</strong><p>Matikan titik bergerak pada peta.</p></div><button class="switch" role="switch" aria-label="Kurangi gerakan" aria-checked="${state.reduced}" data-action="toggle-motion"></button></div><div class="detail-note">Preferensi pemberitahuan tersimpan secara lokal. Belum ada notifikasi push atau pemantauan latar belakang.</div>`,'PENGATURAN');break;
  case 'toggle-motion':state.reduced=!state.reduced;save('easykripto.motion',state.reduced);b.setAttribute('aria-checked',state.reduced);motion();break;
 }
});
window.addEventListener('easykripto-session',event=>{canSuperadmin=event.detail.user?.role==='superadmin';document.body.classList.toggle('has-superadmin',canSuperadmin);renderRoute();});
$('#wallet-search').addEventListener('input',renderWallets);window.addEventListener('hashchange',renderRoute);window.addEventListener('resize',transform);
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',motion);
hydrate();renderSummary();renderActivities();renderWallets();renderMap();renderRoute();
