'use strict';

(() => {
  const el=id=>document.getElementById(id),root=el('api-monitor'),names={helius:'Helius',alchemy:'Alchemy','solana-rpc':'RPC Solana',dexscreener:'DEX Screener',gecko:'GeckoTerminal',goplus:'GoPlus',worker:'Cloudflare Worker'};
  const colors={helius:'#ed9e6c',alchemy:'#82a8ee','solana-rpc':'#bda4ef',dexscreener:'#dfdfe1',gecko:'#88c967',goplus:'#e7bd70',worker:'#f7a967'};
  const number=new Intl.NumberFormat('id-ID'),clock=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Makassar',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit',second:'2-digit'});
  let account=null,epoch=0,timer=null,controller=null,data=null,logRows=[],next=null,busy=false,logBusy=false,budgetBusy=false,lastHealth=new Map();
  const text=(tag,value,className)=>{const node=document.createElement(tag);node.textContent=value;if(className)node.className=className;return node;};
  const admin=()=>account?.role==='superadmin',shown=()=>admin()&&location.hash==='#superadmin'&&!document.hidden;
  const total=(list,field)=>list.reduce((sum,row)=>sum+(Number(row[field])||0),0);
  function amount(value){return number.format(Number(value)||0);}
  async function request(path,{method='GET',body,signal}={}){
    const token=await window.easykriptoIdToken();if(signal?.aborted)throw new DOMException('Dibatalkan','AbortError');
    const origin=window.EASYKRIPTO_API_ORIGIN?new URL(window.EASYKRIPTO_API_ORIGIN).origin:location.origin;
    const response=await fetch(`${origin}/api/monitor/${path}`,{method,headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,credentials:'omit',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});
    const result=await response.json().catch(()=>null);if(!response.ok)throw new Error(result?.error||'Pemantauan belum tersedia.');return result;
  }
  function health(provider){
    const day=data.daily.find(row=>row.provider===provider)||{},recent=data.recent.find(row=>row.provider===provider)||{},budget=data.budgets.find(row=>row.provider===provider)||{};
    const count=Number(day.requests)||0,limit=budget.daily_limit,percent=limit?count/limit*100:null;
    let state='unknown',label='Belum ada data',description='Lakukan analisis atau pencarian untuk mulai mengisi log.';
    if(recent.limited>0){state='limited';label='Sedang dibatasi';description=provider==='worker'?'Worker menolak permintaan dengan HTTP 429. Bisa berasal dari batas 4 analisis/menit atau antrean penuh.':'HTTP 429 teramati dalam 5 menit terakhir. Periksa rate limit dan pemakaian pada dashboard provider.';}
    else if(percent>=100){state='limit';label='Batas pantauan tercapai';description='Penggunaan tercatat mencapai batas harian yang Anda tetapkan. Ini bukan konfirmasi kuota provider habis.';}
    else if(percent>=(budget.alert_percent||80)){state='warning';label='Mendekati batas pantauan';description=`Sudah memakai ${percent.toFixed(1)}% dari batas pemantauan harian aplikasi.`;}
    else if(recent.errors>0){state='error';label='Respons perlu diperiksa';description=`${amount(recent.errors)} kegagalan teramati dalam 5 menit terakhir. Lihat status HTTP dan metode pada log.`;}
    else if(recent.requests>0){state='normal';label='Respons normal';description='Tidak ada kegagalan pada permintaan yang tercatat dalam 5 menit terakhir.';}
    else if(count>0){state='idle';label='Belum ada respons terbaru';description='Ada riwayat hari ini, tetapi tidak ada permintaan tercatat dalam 5 menit terakhir.';}
    return {provider,count,limit,percent,alert:budget.alert_percent||80,state,label,description,recent};
  }
  function inform(){
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).format(data.to);
    for(const provider of Object.keys(names)){
      const value=health(provider),previous=lastHealth.get(provider);lastHealth.set(provider,value.state);
      if(['limited','limit','warning','error'].includes(value.state))window.EasyNotifications?.push({category:'api',level:value.state==='limit'?'error':'warning',title:`${names[provider]}: ${value.label.toLowerCase()}`,message:value.description,context:`${amount(value.count)} permintaan tercatat hari ini · WITA`,key:`api:${day}:${provider}:${value.state}:${value.limit||0}`,dedupeMs:['limit','warning'].includes(value.state)?86400000:600000,action:{type:'route',route:'superadmin'}});
      else if(value.state==='normal'&&previous&&['limited','error'].includes(previous))window.EasyNotifications?.push({category:'api',level:'success',title:`${names[provider]} kembali merespons normal`,message:value.description,key:`api-recovery:${provider}`,action:{type:'route',route:'superadmin'}});
    }
    if(data.loggingFailures)window.EasyNotifications?.push({category:'api',level:'warning',title:'Sebagian log API gagal disimpan',message:'Angka pemakaian mungkin kurang dari aktivitas sebenarnya. Periksa penyimpanan Cloudflare D1.',key:'api-log-failure',action:{type:'route',route:'superadmin'}});
  }
  function renderCards(){
    const hourly=data.hourly.filter(row=>row.provider!=='worker'),requests=total(hourly,'requests'),errors=total(hourly,'errors'),limited=total(hourly,'limited'),worker=data.hourly.filter(row=>row.provider==='worker');
    const metrics=[['api-count-requests',amount(requests)],['api-count-success',requests?`${((requests-errors)/requests*100).toFixed(1)}%`:'—'],['api-count-limited',amount(limited)],['api-count-latency',requests?`${amount(Math.round(total(hourly,'duration')/requests))} ms`:'—']];for(const [id,value] of metrics)el(id).textContent=value;
    el('api-worker-cache').textContent=`Worker: ${amount(total(worker,'requests'))} permintaan · ${amount(total(worker,'cached'))} dari cache. Permintaan Worker terpisah dari panggilan provider.`;
    const cards=el('api-provider-cards');cards.replaceChildren();
    for(const provider of Object.keys(names)){
      const value=health(provider),card=text('article','','api-provider-card');card.dataset.health=value.state;
      const header=text('div','','api-provider-heading');header.append(text('h3',names[provider]),text('span',value.label,'api-health-label'));card.append(header);
      card.append(text('strong',amount(value.count),'api-provider-number'),text('span','permintaan hari ini · WITA','api-provider-unit'));
      const progress=document.createElement('progress');progress.max=100;progress.value=Math.min(100,value.percent||0);progress.setAttribute('aria-label',`Pemakaian batas pemantauan ${names[provider]}`);if(value.percent==null){progress.className='unconfigured';progress.setAttribute('aria-valuetext','Batas pemantauan belum diatur');}card.append(progress);
      card.append(text('p',value.limit?`${amount(Math.max(0,value.limit-value.count))} tersisa dari batas pantauan ${amount(value.limit)} (${value.percent.toFixed(1)}%).`:'Batas pemantauan belum diatur. Sisa kuota akun provider tidak tersedia.','api-budget-note'),text('p',value.description,'api-provider-description'));
      const button=text('button','Atur batas pantauan','text-button');button.type='button';button.addEventListener('click',()=>{el('api-budget-provider').value=provider;selectBudget();el('api-budget-settings').open=true;el('api-budget-limit').focus();el('api-budget-settings').scrollIntoView({block:'nearest',behavior:state.reduced?'auto':'smooth'});});card.append(button);cards.append(card);
    }
    el('api-last-update').textContent=`Diperbarui ${clock.format(data.to)} WITA${data.startedAt?` · pencatatan sejak ${clock.format(data.startedAt)} WITA`:''}${data.loggingFailures?' · sebagian log tidak tersimpan':''}`;
  }
  function svgNode(svg,tag,attrs,label){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));if(label!=null)node.textContent=label;svg.append(node);return node;}
  function chart(){
    const chartRoot=el('api-usage-chart');chartRoot.replaceChildren();const period=data.period,step=period==='7d'?86400000:3600000,size=period==='7d'?7:24;
    const start=period==='7d'?data.dayStart-6*86400000:Math.floor(data.to/3600000)*3600000-23*3600000,buckets=Array.from({length:size},(_,i)=>({at:start+i*step,requests:0,errors:0,duration:0}));
    for(const row of data.hourly){if(row.provider==='worker')continue;const index=Math.floor((row.hour-start)/step);if(buckets[index])for(const key of ['requests','errors','duration'])buckets[index][key]+=Number(row[key])||0;}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 680 245');svg.setAttribute('role','img');svg.setAttribute('aria-label','Grafik jumlah permintaan API per waktu, hijau berhasil dan merah gagal. Tabel data tersedia di bawah.');
    const maximum=Math.max(1,...buckets.map(row=>row.requests)),width=590/size;
    for(let i=0;i<=4;i++){const y=190-i*40;svgNode(svg,'line',{x1:48,x2:648,y1:y,y2:y,stroke:'#252b27'});svgNode(svg,'text',{x:40,y:y+4,'text-anchor':'end',fill:'#8b958f','font-size':10},amount(Math.round(maximum*i/4)));}
    const label=new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Makassar',...(period==='7d'?{day:'numeric',month:'short'}:{hour:'2-digit',minute:'2-digit'})});
    for(const [i,row] of buckets.entries()){
      const x=52+i*width,height=row.requests/maximum*160,errorHeight=row.errors/maximum*160,barWidth=Math.max(4,width-7);
      const group=svgNode(svg,'g',{tabindex:0,role:'img','aria-label':`${label.format(row.at)} WITA: ${row.requests} permintaan, ${row.errors} gagal`});const title=document.createElementNS(svg.namespaceURI,'title');title.textContent=`${label.format(row.at)} WITA · ${row.requests} permintaan · ${row.errors} gagal`;group.append(title);
      svgNode(group,'rect',{x,y:190-height+errorHeight,width:barWidth,height:Math.max(0,height-errorHeight),rx:2,fill:'#19c79e'});
      svgNode(group,'rect',{x,y:190-height,width:barWidth,height:errorHeight,rx:2,fill:'#ef737d'});
      if(period==='7d'||i%4===0||i===size-1)svgNode(svg,'text',{x:x+barWidth/2,y:216,'text-anchor':'middle',fill:'#8b958f','font-size':10},label.format(row.at));
    }
    chartRoot.append(svg);const table=el('api-chart-table');table.replaceChildren();
    for(const row of buckets){const tr=document.createElement('tr');for(const value of [`${clock.format(row.at)} WITA`,amount(row.requests),amount(row.errors),row.requests?`${amount(Math.round(row.duration/row.requests))} ms`:'—'])tr.append(text('td',value));table.append(tr);}
    const mix=el('api-provider-chart');mix.replaceChildren();const circle=document.createElementNS(svg.namespaceURI,'svg');circle.setAttribute('viewBox','0 0 160 160');circle.setAttribute('role','img');circle.setAttribute('aria-label','Distribusi permintaan per provider, angka tersedia pada legenda.');
    const values=Object.keys(names).filter(p=>p!=='worker').map(provider=>({provider,count:total(data.hourly.filter(row=>row.provider===provider),'requests')})),sum=total(values,'count'),circumference=2*Math.PI*58;let offset=0;
    svgNode(circle,'circle',{cx:80,cy:80,r:58,fill:'none',stroke:'#262d29','stroke-width':15});
    for(const row of values){if(!sum||!row.count)continue;const length=row.count/sum*circumference;svgNode(circle,'circle',{cx:80,cy:80,r:58,fill:'none',stroke:colors[row.provider],'stroke-width':15,'stroke-dasharray':`${length} ${circumference-length}`,'stroke-dashoffset':-offset,transform:'rotate(-90 80 80)'});offset+=length;}
    svgNode(circle,'text',{x:80,y:79,'text-anchor':'middle',fill:'#eee','font-size':23,'font-weight':650},amount(sum));svgNode(circle,'text',{x:80,y:99,'text-anchor':'middle',fill:'#8e9b92','font-size':10},'permintaan');mix.append(circle);
    const legend=text('ul','','api-provider-legend');for(const row of values){const li=document.createElement('li'),dot=text('i','');dot.style.background=colors[row.provider];li.append(dot,text('span',names[row.provider]),text('strong',amount(row.count)));legend.append(li);}mix.append(legend);
    el('api-chart-empty').hidden=sum>0;
  }
  function renderLogs(){
    const body=el('api-log-table');body.replaceChildren();
    for(const row of logRows){const tr=document.createElement('tr');tr.dataset.ok=String(!!row.ok);for(const value of [`${clock.format(row.at)} WITA`,names[row.provider]||row.provider,row.chain==='auto'?'—':row.chain,row.method,row.status===0?'Koneksi gagal':`${row.status}${row.status===429?' · dibatasi':[401,403].includes(row.status)?' · akses ditolak':row.status>=500?' · error provider':!row.ok&&row.status<400?' · ditolak':''}`,`${amount(row.duration)} ms`,row.cached?'Cache Worker':row.source==='server'?'Server':'Laporan browser'])tr.append(text('td',value));body.append(tr);}
    el('api-log-empty').hidden=logRows.length>0;el('api-log-more').hidden=!next;el('api-log-more').disabled=logBusy;el('api-log-count').textContent=`${amount(logRows.length)} log ditampilkan · riwayat maksimal 7 hari`;el('api-export').disabled=!logRows.length;
  }
  async function logs(more=false){
    if(!admin()||logBusy)return;const version=epoch;logBusy=true;
    el('api-log-provider').disabled=true;el('api-log-errors').disabled=true;el('api-log-more').disabled=true;
    const query=new URLSearchParams();if(el('api-log-provider').value)query.set('provider',el('api-log-provider').value);if(el('api-log-errors').checked)query.set('errors','1');if(more&&next){query.set('before',next.at);query.set('id',next.id);}
    try{const result=await request(`logs?${query}`,{signal:controller?.signal});if(version!==epoch)return;logRows=more?[...logRows,...result.rows]:result.rows;next=result.next;renderLogs();}
    catch(error){if(version===epoch&&error.name!=='AbortError')el('api-monitor-status').textContent=error.message;}
    finally{if(version===epoch){logBusy=false;el('api-log-more').disabled=false;el('api-log-provider').disabled=false;el('api-log-errors').disabled=false;}}
  }
  function selectBudget(){const provider=el('api-budget-provider').value,budget=data?.budgets.find(row=>row.provider===provider);el('api-budget-limit').value=budget?.daily_limit||'';el('api-budget-alert').value=budget?.alert_percent||80;}
  async function refresh(manual=false){
    if(!admin()||busy||document.hidden)return;const version=epoch;busy=true;controller=new AbortController();el('api-refresh').disabled=true;el('api-period').disabled=true;
    if(manual||!data)el('api-monitor-status').textContent='Memuat log dan statistik API…';
    try{const result=await request(`summary?period=${el('api-period').value}`,{signal:controller.signal});if(version!==epoch)return;data=result;inform();renderCards();chart();el('api-monitor-status').textContent='Data tercatat sejak fitur dipasang. Kuota tagihan provider tidak tersedia; gunakan batas pantauan aplikasi untuk peringatan.';if(shown())await logs();}
    catch(error){if(version===epoch&&error.name!=='AbortError'){el('api-monitor-status').textContent=error.message;if(data)el('api-last-update').textContent+=' · belum berhasil diperbarui';window.EasyNotifications?.push({category:'api',level:'warning',title:'Pemantauan API belum dapat diperbarui',message:error.message,key:'api-monitor-unavailable',action:{type:'route',route:'superadmin'}});}}
    finally{if(version===epoch){busy=false;el('api-refresh').disabled=false;el('api-period').disabled=false;}}
  }
  function schedule(){clearTimeout(timer);if(admin())timer=setTimeout(async()=>{if(!document.hidden)await refresh();schedule();},60000);}
  el('api-refresh').addEventListener('click',()=>void refresh(true));el('api-period').addEventListener('change',()=>void refresh(true));el('api-log-provider').addEventListener('change',()=>void logs());el('api-log-errors').addEventListener('change',()=>void logs());el('api-log-more').addEventListener('click',()=>void logs(true));el('api-budget-provider').addEventListener('change',selectBudget);
  el('api-budget-settings').addEventListener('toggle',()=>{if(el('api-budget-settings').open)selectBudget();});
  el('api-budget-form').addEventListener('submit',async event=>{
    event.preventDefault();if(!admin()||budgetBusy)return;const raw=el('api-budget-limit').value.trim(),dailyLimit=raw===''?null:Number(raw),alertPercent=Number(el('api-budget-alert').value);
    if(dailyLimit!==null&&(!Number.isSafeInteger(dailyLimit)||dailyLimit<1||dailyLimit>100000000)){el('api-budget-status').textContent='Isi bilangan bulat positif atau kosongkan untuk menonaktifkan batas.';return;}
    const version=epoch;budgetBusy=true;el('api-budget-save').disabled=true;
    try{await request('budgets',{method:'POST',body:{provider:el('api-budget-provider').value,dailyLimit,alertPercent},signal:controller?.signal});if(version!==epoch)return;el('api-budget-status').textContent='Batas pemantauan disimpan. Pengaturan ini tidak mengubah paket atau menghentikan permintaan API.';await refresh(true);}
    catch(error){if(version===epoch)el('api-budget-status').textContent=error.message;}
    finally{if(version===epoch){budgetBusy=false;el('api-budget-save').disabled=false;}}
  });
  el('api-export').addEventListener('click',()=>{if(!admin()||!logRows.length)return;const escape=value=>`"${String(value).replace(/"/g,'""')}"`,lines=[['Waktu WITA','Provider','Jaringan','Metode','HTTP','Berhasil','Durasi ms','Sumber','Cache'],...logRows.map(row=>[clock.format(row.at),names[row.provider],row.chain,row.method,row.status,row.ok?'Ya':'Tidak',row.duration,row.source,row.cached?'Ya':'Tidak'])];const url=URL.createObjectURL(new Blob(['\uFEFF'+lines.map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='easykripto-log-api.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  window.addEventListener('easykripto-session',event=>{const nextAccount=event.detail.user||null;if(account?.id===nextAccount?.id&&account?.role===nextAccount?.role)return;epoch++;controller?.abort();account=nextAccount;data=null;logRows=[];lastHealth.clear();busy=false;logBusy=false;budgetBusy=false;root.hidden=!admin();el('api-budget-save').disabled=false;el('api-period').disabled=false;el('api-log-provider').disabled=false;el('api-log-errors').disabled=false;el('api-provider-cards').replaceChildren();el('api-usage-chart').replaceChildren();el('api-provider-chart').replaceChildren();el('api-chart-table').replaceChildren();el('api-budget-settings').open=false;el('api-budget-limit').value='';el('api-budget-status').textContent='';el('api-last-update').textContent='';for(const id of ['api-count-requests','api-count-success','api-count-limited','api-count-latency'])el(id).textContent='—';el('api-worker-cache').textContent='';next=null;renderLogs();if(admin())void refresh();schedule();});
  window.addEventListener('hashchange',()=>{if(shown())void refresh();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&admin())void refresh();});
  window.addEventListener('online',()=>{if(admin())void refresh();});
})();
