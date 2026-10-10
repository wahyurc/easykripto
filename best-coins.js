'use strict';

(() => {
  const el=id=>document.getElementById(id),root=el('view-bestcoin');
  const labels={volume:'Volume / valuasi 24 jam',liquidity:'Likuiditas / valuasi',pressure:'Rasio transaksi beli',momentum:'Perubahan harga'};
  const phases={buy:'Beli dominan',neutral:'Seimbang',sell:'Jual dominan',unknown:'Data minim'};
  const cache=new Map(),securityCache=new Map();
  let signedIn=false,controller=null,rows=[],ranked=[],shown=10,busy=false,checking=false,snapshotAt=0,partial=false,windowKey='h24';
  const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
  const nonnegative=value=>{const n=number(value);return n!=null&&n>=0?n:null;};
  const count=n=>n==null?'—':new Intl.NumberFormat('id-ID').format(n);
  const usd=n=>n==null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2}).format(n);
  const percent=n=>n==null?'—':`${n>0?'+':''}${n.toLocaleString('id-ID',{maximumFractionDigits:2})}%`;
  const ratio=n=>n==null?'—':n.toLocaleString('id-ID',{maximumFractionDigits:3});
  const active=()=>signedIn&&location.hash==='#bestcoin'&&!document.hidden;
  function stop(){controller?.abort();controller=null;busy=false;checking=false;controls();}
  function controls(){
    root.setAttribute('aria-busy',String(busy||checking));
    for(const input of root.querySelectorAll('input,select'))input.disabled=busy||checking;
    el('bc-refresh').disabled=busy||checking||!signedIn;
    el('bc-check-risk').disabled=busy||checking||!ranked.length||!signedIn;
    el('bc-check-risk').textContent=checking?'Memeriksa risiko…':'Periksa risiko 10 teratas';
  }
  function normalize(data,chain){
    const tokens=new Map((data.included||[]).filter(item=>item.type==='token').map(item=>[item.id,item.attributes]));
    return (Array.isArray(data.data)?data.data:[]).flatMap(pool=>{
      const token=tokens.get(pool.relationships?.base_token?.data?.id),p=pool.attributes||{};
      if(!token||!validChainAddress(token.address,chain))return [];
      return [{chain,address:token.address,symbol:String(token.symbol||'Token'),name:String(token.name||token.symbol||'Token'),imageUrl:token.image_url,
        marketCap:nonnegative(p.market_cap_usd),fdv:nonnegative(p.fdv_usd),liquidity:nonnegative(p.reserve_in_usd),price:nonnegative(p.base_token_price_usd),
        volume:nonnegative(p.volume_usd?.h24),changes:p.price_change_percentage||{},transactions:p.transactions||{},pool:p.address,risk:null}];
    });
  }
  function values(token){
    const valuation=token.marketCap>0?token.marketCap:el('bc-fdv').checked&&token.fdv>0?token.fdv:null;
    const tx=token.transactions[windowKey]||{},buys=nonnegative(tx.buys),sells=nonnegative(tx.sells);
    const total=buys!=null&&sells!=null?buys+sells:null,pressure=total>0?buys/total:null;
    const phase=total==null||total<10?'unknown':pressure>=.6?'buy':pressure<=.4?'sell':'neutral';
    return {valuation,valuationKind:token.marketCap>0?'MC':'FDV',buys,sells,total,phase,pressure,
      volume:valuation&&token.volume!=null?token.volume/valuation:null,
      liquidity:valuation&&token.liquidity!=null?token.liquidity/valuation:null,momentum:number(token.changes[windowKey])};
  }
  function riskFor(token){const risk=securityCache.get(`${token.chain}:${token.address}`);return risk&&risk.at>Date.now()-600000?risk:null;}
  // Equal values receive the same midpoint percentile. A lone observation gets 50.
  function percentiles(items,criterion){
    const ordered=items.filter(item=>item.metrics[criterion]!=null).sort((a,b)=>a.metrics[criterion]-b.metrics[criterion]);
    const result=new Map();
    for(let first=0;first<ordered.length;){let end=first+1;while(end<ordered.length&&ordered[end].metrics[criterion]===ordered[first].metrics[criterion])end++;
      const value=ordered.length===1?50:100*(first+(end-1))/2/(ordered.length-1);
      for(let i=first;i<end;i++)result.set(ordered[i],value);first=end;
    }
    return result;
  }
  function compute(){
    const criteria=[...root.querySelectorAll('[name="bc-criterion"]:checked')].map(input=>input.value);
    const selected=new Set([...root.querySelectorAll('[name="bc-phase"]:checked')].map(input=>input.value));
    const cap=el('bc-cap').value;
    const filtered=rows.map(token=>({...token,metrics:values(token),risk:riskFor(token)})).filter(token=>{
      const m=token.metrics;if(!selected.has(m.phase))return false;
      if(cap!=='all'&&(m.valuation==null||!(cap==='small'?m.valuation<100000:cap==='medium'?m.valuation>=100000&&m.valuation<=500000:m.valuation>500000)))return false;
      if(el('bc-hide-risk').checked&&token.risk?.flags.length)return false;
      return !el('bc-complete').checked||criteria.every(key=>m[key]!=null);
    });
    const scores=new Map(criteria.map(key=>[key,percentiles(filtered,key)]));
    for(const token of filtered){token.components=criteria.map(key=>({key,value:scores.get(key).get(token)??null}));const available=token.components.filter(item=>item.value!=null);token.score=available.length?available.reduce((sum,item)=>sum+item.value,0)/available.length:null;token.incomplete=available.length<criteria.length;}
    ranked=criteria.length?filtered.sort((a,b)=>(b.score??-1)-(a.score??-1)||(b.liquidity??0)-(a.liquidity??0)||a.address.localeCompare(b.address)):[];
    return criteria.length;
  }
  const node=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
  function metric(dl,label,value,className){const wrap=document.createElement('div');wrap.append(node('dt',label),node('dd',value,className));dl.append(wrap);}
  function breakdown(token){
    const m=token.metrics,windowLabel={h1:'1 jam',h6:'6 jam',h24:'24 jam'}[windowKey];
    dialog(`Skor ${escapeHTML(token.symbol)}`,`<div class="bc-detail"><p>Skor ${token.score==null?'tidak tersedia':Math.round(token.score)} dari 100, dibandingkan dengan ${ranked.length} kandidat yang lolos filter. Nilai komponen berikut adalah persentil, bukan peluang keuntungan.</p><dl>${token.components.map(item=>`<dt>${escapeHTML(labels[item.key])}</dt><dd>${item.value==null?'Data tidak tersedia':Math.round(item.value)+' / 100'}</dd>`).join('')}</dl><p>Transaksi pool ${escapeHTML(windowLabel)}: ${count(m.buys)} beli · ${count(m.sells)} jual. Minimal 10 transaksi untuk indikasi fase; rasio beli ≥60% berarti beli dominan, ≤40% berarti jual dominan.</p><p>${m.valuationKind==='FDV'?'Menggunakan FDV karena MC belum tersedia. FDV bukan kapitalisasi supply yang beredar.':'Valuasi memakai MC yang dilaporkan penyedia.'} Volume dan likuiditas berasal dari satu pool dengan likuiditas tertinggi di dalam sampel, bukan agregasi semua pool token.</p><p>${token.risk?`GoPlus diperiksa ${new Date(token.risk.at).toLocaleTimeString('id-ID')}. ${token.risk.flags.length?'Temuan: '+escapeHTML(token.risk.flags.join(', ')):token.risk.known?'Tidak ada flag pada field yang dilaporkan; ini bukan jaminan aman.':'Penyedia tidak melaporkan field risiko yang dapat dinilai.'}`:'Risiko belum diperiksa. Ketuk Periksa risiko 10 teratas untuk memeriksa kandidat.'}</p><p>Riwayat pertumbuhan holder $1.000/$10.000 belum tersedia. Skor ini mengukur aktivitas pasar dan tidak menilai hubungan kepemilikan wallet.</p></div>`,'TRANSPARANSI SKOR');
  }
  function render(){
    const hasCriteria=compute();el('bc-universe').textContent=count(rows.length);el('bc-passing').textContent=count(ranked.length);
    el('bc-checked').textContent=`${rows.filter(token=>riskFor(token)).length}/${rows.length}`;
    const badge=el('bc-network');badge.innerHTML=networkLogo(selectedBlockchain);badge.append(document.createTextNode(currentNetwork().name));
    el('bc-freshness').textContent=snapshotAt?`GeckoTerminal · ${new Date(snapshotAt).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})} · cache 5 menit${partial?' · sumber parsial':''}`:'Belum ada snapshot pasar.';
    const list=el('bc-list');list.replaceChildren();
    if(!ranked.length){const empty=node('li','','bc-empty');empty.append(node('strong',busy?'Menyiapkan peringkat…':!hasCriteria?'Pilih komponen skor.':'Belum ada token yang lolos.'),node('span',busy?'Mengambil pool trending dan baru pada jaringan pilihanmu.':rows.length?'Longgarkan filter fase, valuasi, atau kelengkapan data.':'Perbarui daftar atau pilih jaringan lain. Sumber bisa belum memiliki kandidat.'));list.append(empty);}
    for(const [index,token]of ranked.slice(0,shown).entries()){
      const card=node('li','','bc-card'),top=node('div','','bc-card-top'),picture=node('span','','bc-picture');
      picture.append(window.EasyTokenUI.iconNode(token.imageUrl,token.symbol));const logo=document.createElement('span');logo.innerHTML=networkLogo(token.chain);picture.append(logo.firstElementChild);
      const identity=node('div','','bc-identity');identity.append(node('strong',token.symbol),node('small',`${token.address.slice(0,5)}…${token.address.slice(-4)}`));identity.title=token.name;
      const score=node('span',token.score==null?'—':String(Math.round(token.score))+(token.incomplete?'*':''),'bc-score');score.append(node('small','SKOR / 100'));top.append(node('span',`#${index+1}`,'bc-rank'),picture,identity,score);card.append(top);
      const tags=node('div','','bc-card-tags');tags.append(node('span',phases[token.metrics.phase],`bc-tag ${token.metrics.phase}`));
      const risk=token.risk;tags.append(node('span',!risk?'Risiko belum diperiksa':risk.flags.length?'Risiko ditandai':risk.known?'Flag tidak terdeteksi':'Data risiko minim',`bc-tag ${risk?.flags.length?'flagged':risk?.known?'clear':''}`));
      if(risk?.holders!=null)tags.append(node('span',`${count(risk.holders)} holder`,'bc-tag'));card.append(tags);
      const dl=node('dl','','bc-metrics'),m=token.metrics;metric(dl,`Valuasi (${m.valuationKind})`,usd(m.valuation));metric(dl,`Harga · ${windowKey==='h1'?'1 jam':windowKey==='h6'?'6 jam':'24 jam'}`,percent(m.momentum),m.momentum>0?'positive':m.momentum<0?'negative':'');
      metric(dl,'Volume / valuasi · 24 jam',ratio(m.volume));metric(dl,'Likuiditas pool',usd(token.liquidity));metric(dl,'Rasio beli · jumlah transaksi',m.pressure==null?'—':`${(m.pressure*100).toLocaleString('id-ID',{maximumFractionDigits:1})}%`);metric(dl,'Transaksi beli / jual',`${count(m.buys)} / ${count(m.sells)}`);card.append(dl);
      const actions=node('div','','bc-actions'),detail=node('button','Detail token','primary-button'),watch=node('button','+ Pantau','secondary-button'),explain=node('button','ⓘ','bc-breakdown');
      for(const button of [detail,watch,explain])button.type='button';explain.setAttribute('aria-label',`Lihat perhitungan skor ${token.symbol}`);
      detail.addEventListener('click',()=>window.EasyTokenSearch.open({chain:token.chain,address:token.address}));
      const tracked=()=>tokens.some(saved=>saved.chain===token.chain&&equalChainAddress(saved.address,token.address,token.chain));
      if(tracked()){watch.textContent='Terpantau';watch.disabled=true;}
      watch.addEventListener('click',()=>{window.EasyDashboard.trackToken(token);if(tracked()){watch.textContent='Terpantau';watch.disabled=true;}});explain.addEventListener('click',()=>breakdown(token));actions.append(detail,watch,explain);card.append(actions);list.append(card);
    }
    el('bc-more').hidden=ranked.length<=shown;controls();
  }
  async function load(force=false){
    stop();if(!active())return;
    controller=new AbortController();const signal=controller.signal,chain=selectedBlockchain;
    const saved=cache.get(chain);if(!force&&saved&&saved.at>Date.now()-300000){({rows,snapshotAt,partial}=saved);el('bc-status').textContent='';render();return;}
    busy=true;rows=[];snapshotAt=0;partial=false;el('bc-status').textContent='Mengambil kandidat pasar…';render();
    try{
      const results=await Promise.allSettled(['trending','new'].map(kind=>window.EasyMarket.pools(chain,kind,signal)));if(signal.aborted)return;
      const success=results.filter(result=>result.status==='fulfilled').map(result=>result.value);if(!success.length)throw results[0].reason;
      const unique=new Map();for(const result of success)for(const token of normalize(result.data,chain)){const key=chain==='solana'?token.address:token.address.toLowerCase(),existing=unique.get(key);if(!existing||(token.liquidity??0)>(existing.liquidity??0))unique.set(key,token);}
      rows=[...unique.values()].slice(0,40);snapshotAt=Math.min(...success.map(result=>result.fetchedAt));partial=success.length<2;
      cache.set(chain,{rows,snapshotAt,partial,at:Date.now()});
      el('bc-status').textContent=partial?'Satu sumber pool belum tersedia. Peringkat memakai kandidat dari sumber yang berhasil dimuat.':'';
    }catch(error){if(signal.aborted)return;if(saved)({rows,snapshotAt,partial}=saved);el('bc-status').textContent=(error.message==='Failed to fetch'?'Sumber pasar belum dapat dihubungi. Periksa internet lalu ketuk Perbarui.':error.message||'Kandidat belum tersedia. Coba lagi nanti.')+(saved?' Snapshot sebelumnya tetap ditampilkan; perhatikan waktu datanya.':'');}
    finally{if(!signal.aborted){busy=false;render();}}
  }
  function flagged(value){const v=value&&typeof value==='object'?value.status:value;return v===true||v===1||v==='1';}
  async function checkRisk(){
    if(checking||busy||!active())return;controller?.abort();controller=new AbortController();const signal=controller.signal;
    const candidates=ranked.slice(0,10);checking=true;controls();let completed=0,failed=0;
    for(const token of candidates){
      if(signal.aborted||!active())break;
      el('bc-status').textContent=`Memeriksa risiko ${completed+failed+1}/${candidates.length}. GoPlus dipanggil bergiliran untuk menjaga kuota.`;
      try{
        if(!riskFor(token)){
          const result=await window.EasyMarket.security(token.chain,token.address,signal);if(signal.aborted)return;
          const fields=token.chain==='solana'?[['mintable','Mint tambahan'],['freezable','Pembekuan token'],['closable','Penutupan akun']]:[['is_honeypot','Indikasi honeypot'],['cannot_sell_all','Pembatasan menjual'],['is_blacklisted','Blacklist']];
          const flags=fields.filter(([key])=>flagged(result.data[key])).map(([,label])=>label),holderValue=nonnegative(result.data.holder_count);
          securityCache.set(`${token.chain}:${token.address}`,{at:result.fetchedAt,flags,known:fields.some(([key])=>{const v=result.data[key],raw=v&&typeof v==='object'?v.status:v;return [true,false,0,1,'0','1'].includes(raw);}),holders:Number.isSafeInteger(holderValue)?holderValue:null});
        }
        completed++;
      }catch(error){if(signal.aborted)return;failed++;if(error.message?.includes('Kuota')){el('bc-status').textContent=error.message;break;}}
      render();
    }
    if(!signal.aborted){checking=false;el('bc-status').textContent=`${completed} kandidat diperiksa${failed?` · ${failed} gagal dimuat`:''}. Field yang tidak dilaporkan tetap belum dinilai; hasil bukan jaminan aman. Risiko menggunakan cache 10 menit.`;render();}
  }
  root.querySelector('.bc-filters').addEventListener('change',()=>{windowKey=root.querySelector('[name="bc-window"]:checked').value;shown=10;render();});
  el('bc-refresh').addEventListener('click',()=>void load(true));el('bc-check-risk').addEventListener('click',()=>void checkRisk());el('bc-more').addEventListener('click',()=>{shown+=10;render();});
  el('bc-method').addEventListener('click',()=>dialog('Cara membaca Rekomendasi Ticker',`<div class="bc-detail"><p>Mulai dari jaringan, pilih komponen skor, lalu saring valuasi dan indikasi perdagangan. Ketuk ⓘ pada token untuk rincian perhitungannya.</p><ul><li>Skor 0–100 adalah rata-rata persentil komponen terpilih di antara kandidat yang lolos filter. Bobot setiap komponen sama; nilai seri mendapat persentil yang sama. Jika hanya ada satu kandidat, setiap komponen mendapat 50.</li><li>Mengubah filter dapat mengubah skor. Skor tinggi berarti lebih tinggi daripada sampel pembanding, bukan otomatis token berkualitas atau peluang keuntungan.</li><li>Volume memakai 24 jam; momentum dan rasio beli mengikuti 1/6/24 jam. Tanpa data skor lengkap, komponen kosong dilewati dan skor bertanda *.</li><li>Beli dominan ≥60%, jual dominan ≤40%, dengan minimal 10 transaksi. Ini jumlah transaksi pool, bukan nilai uang, net inflow, atau pertumbuhan holder.</li><li>Risiko diperiksa hanya saat tombol ditekan, maksimal 10 kandidat teratas saat itu. Filter risiko menyembunyikan flag yang terdeteksi; token belum diperiksa tetap terlihat dengan labelnya.</li><li>FDV digunakan hanya jika pilihannya aktif dan MC belum tersedia. Label valuasi menjelaskan sumber pembaginya.</li><li>Data pool: GeckoTerminal. Risiko dan jumlah holder jika tersedia: GoPlus. Riwayat holder $1.000/$10.000 belum tersedia.</li></ul></div>`,'PANDUAN SKOR'));
  window.addEventListener('easykripto-session',event=>{signedIn=event.detail.signedIn;if(!signedIn){stop();rows=[];ranked=[];el('bc-list').replaceChildren();}else void load();});
  window.addEventListener('easykripto-network',()=>{shown=10;void load();});window.addEventListener('hashchange',()=>void load());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else void load();});window.addEventListener('pagehide',stop);
  setInterval(()=>{if(active()&&!busy&&!checking&&!el('detail-dialog').open)void load();},300000);
})();
