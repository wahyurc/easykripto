import {firebaseClaims} from './firebase-token.mjs';
import {DataError} from './chain-data.mjs';

const providers=['helius','alchemy','solana-rpc','dexscreener','gecko','goplus','worker'];
const publicMethods={dexscreener:['search','token-pairs'],gecko:['pools','trending_pools','new_pools','ohlcv'],goplus:['token_security']};
const chains=['solana','ethereum','base','bsc','robinhood','auto'];
const gates=new Map(),summaryCache=new Map();
let loggingFailures=0;
function send(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function gate(uid,kind,max){const key=`${uid}:${kind}`,now=Date.now();for(const [id,entry]of gates)if(entry.until<now)gates.delete(id);const entry=gates.get(key)||{count:0,until:now+60000};if(entry.count>=max||gates.size>=10000)throw new DataError('Terlalu banyak permintaan pemantauan. Coba lagi nanti.',429);entry.count++;gates.set(key,entry);}
export async function writeAPIEvents(env,events){
  if(!env.API_LOGS||!events.length)return false;
  try{
    const statements=[];
    for(const event of events.slice(0,30)){
      const id=event.id||crypto.randomUUID(),at=event.at||Date.now(),duration=Math.max(0,Math.min(120000,Math.round(event.duration)||0)),status=Number.isInteger(event.status)?event.status:0;
      if(!providers.includes(event.provider)||!chains.includes(event.chain)||!['server','browser'].includes(event.source))continue;
      const values=[id,at,event.provider,String(event.method).slice(0,60),event.chain,status,event.ok?1:0,duration,event.source,event.cached?1:0];
      statements.push(env.API_LOGS.prepare('INSERT OR IGNORE INTO api_events (id,at,provider,method,chain,status,ok,duration,source,cached) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(...values));
      // A retried browser batch must not increment its counters twice.
      statements.push(env.API_LOGS.prepare('INSERT INTO api_hourly (hour,provider,source,requests,errors,limited,duration,cached) SELECT ?,?,?,1,?,?,?,? WHERE changes()=1 ON CONFLICT(hour,provider,source) DO UPDATE SET requests=requests+1,errors=errors+excluded.errors,limited=limited+excluded.limited,duration=duration+excluded.duration,cached=cached+excluded.cached').bind(Math.floor(at/3600000)*3600000,event.provider,event.source,event.ok?0:1,status===429?1:0,duration,event.cached?1:0));
    }
    if(statements.length)await env.API_LOGS.batch(statements);
    summaryCache.clear();return true;
  }catch{loggingFailures++;return false;}
}
export async function pruneAPILogs(env){
  if(!env.API_LOGS)return;
  const now=Date.now();await env.API_LOGS.batch([
    env.API_LOGS.prepare('DELETE FROM api_events WHERE id IN (SELECT id FROM api_events WHERE at<? ORDER BY at LIMIT 2000)').bind(now-7*86400000),
    env.API_LOGS.prepare('DELETE FROM api_hourly WHERE hour<?').bind(now-7*86400000)
  ]);
}
async function body(req,max=12000){
  if(req.readJson)return req.readJson(max);
  let length=0,chunks=[];for await(const chunk of req){length+=chunk.length;if(length>max)throw new DataError('Data terlalu besar.',413);chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new DataError('Data tidak valid.',400);}
}
async function summary(env,period){
  const cached=summaryCache.get(period);if(cached&&cached.until>Date.now())return {...cached.data,loggingFailures};
  const now=Date.now();
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Makassar',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now),part=kind=>parts.find(p=>p.type===kind).value;
  const day=Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00+08:00`);
  const from=period==='7d'?day-6*86400000:Math.floor(now/3600000)*3600000-23*3600000;
  const result=await env.API_LOGS.batch([
    env.API_LOGS.prepare('SELECT * FROM api_hourly WHERE hour>=? ORDER BY hour').bind(Math.floor(from/3600000)*3600000),
    env.API_LOGS.prepare('SELECT provider,SUM(requests) requests,SUM(errors) errors,SUM(limited) limited,SUM(duration) duration,SUM(cached) cached FROM api_hourly WHERE hour>=? GROUP BY provider').bind(day),
    env.API_LOGS.prepare('SELECT provider,COUNT(*) requests,SUM(CASE WHEN ok=0 THEN 1 ELSE 0 END) errors,SUM(CASE WHEN status=429 THEN 1 ELSE 0 END) limited,MAX(at) lastAt FROM api_events WHERE at>=? GROUP BY provider').bind(now-300000),
    env.API_LOGS.prepare('SELECT * FROM api_budgets'),
    env.API_LOGS.prepare('SELECT MIN(hour) startedAt FROM api_hourly')
  ]);
  const data={period,from,to:now,dayStart:day,hourly:result[0].results,daily:result[1].results,recent:result[2].results,budgets:result[3].results,startedAt:result[4].results[0]?.startedAt||null,loggingFailures,scope:'Permintaan Easykripto yang tercatat sejak pemasangan. Bukan kuota tagihan seluruh akun provider. Server: RPC aktual dan permintaan Worker; browser: laporan API publik. Batas harian adalah batas pemantauan aplikasi, bukan batas provider.',retentionDays:7};
  summaryCache.set(period,{data,until:now+15000});return data;
}
export async function handleAPIMonitor(req,res,pathname,env){
  if(!pathname.startsWith('/api/monitor/'))return false;
  const origin=req.headers.origin,allowed=new Set(['https://wahyurc.github.io','http://localhost:4173',...(env.API_ALLOWED_ORIGINS||'').split(',').map(v=>v.trim()).filter(Boolean)]);
  if(origin&&!allowed.has(origin)){send(res,403,{error:'Origin tidak diizinkan.'});return true;}
  if(origin){res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');}
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');res.writeHead(204);res.end();return true;}
  try{
    const claims=await firebaseClaims(req.headers.authorization?.match(/^Bearer (.+)$/)?.[1]);
    const telemetry=pathname==='/api/monitor/events';
    if(!telemetry&&(claims.role!=='superadmin'||claims.superadmin!==true))throw new DataError('Khusus superadmin.',403);
    if(!env.API_LOGS)throw new DataError('Penyimpanan log API belum tersedia. Pengelola perlu mengaktifkan Cloudflare D1.',503);
    if(telemetry){
      if(req.method!=='POST')throw new DataError('Metode tidak didukung.',405);gate(claims.sub,'telemetry',10);
      if(!req.headers['content-type']?.startsWith('application/json'))throw new DataError('Format data tidak didukung.',415);
      const data=await body(req);if(!Array.isArray(data.events)||!data.events.length||data.events.length>10)throw new DataError('Data log tidak valid.',400);
      const events=data.events.map(e=>{
        if(!e||!publicMethods[e.provider]?.includes(e.method)||!chains.includes(e.chain)||typeof e.id!=='string'||!/^[a-zA-Z0-9-]{10,80}$/.test(e.id)||!Number.isInteger(e.status)||!(e.status===0||(e.status>=100&&e.status<=599))||!Number.isFinite(e.duration)||e.duration<0||e.duration>120000||typeof e.ok!=='boolean')throw new DataError('Data log tidak valid.',400);
        return {id:e.id,provider:e.provider,method:e.method,chain:e.chain,status:e.status,ok:e.ok,duration:e.duration,source:'browser',at:Date.now(),cached:false};
      });
      if(!await writeAPIEvents(env,events))throw new DataError('Pencatatan API belum dapat disimpan.',503);send(res,200,{saved:events.length});return true;
    }
    gate(claims.sub,'admin',30);
    const query=new URL(req.url,'http://localhost').searchParams;
    if(pathname==='/api/monitor/summary'&&req.method==='GET'){send(res,200,await summary(env,query.get('period')==='7d'?'7d':'24h'));return true;}
    if(pathname==='/api/monitor/logs'&&req.method==='GET'){
      const clauses=['at>=?'],params=[Date.now()-7*86400000];const provider=query.get('provider');if(provider&&providers.includes(provider)){clauses.push('provider=?');params.push(provider);}
      if(query.get('errors')==='1')clauses.push('ok=0');
      const before=Number(query.get('before')),id=query.get('id');if(before&&Number.isFinite(before)&&typeof id==='string'&&/^[a-zA-Z0-9-]{10,80}$/.test(id)){clauses.push('(at<? OR (at=? AND id<?))');params.push(before,before,id);}
      const result=await env.API_LOGS.prepare(`SELECT * FROM api_events WHERE ${clauses.join(' AND ')} ORDER BY at DESC,id DESC LIMIT 51`).bind(...params).all();
      const rows=result.results.slice(0,50),last=rows.at(-1);send(res,200,{rows,next:result.results.length>50?{at:last.at,id:last.id}:null});return true;
    }
    if(pathname==='/api/monitor/budgets'&&req.method==='POST'){
      const data=await body(req,2000);if(!providers.includes(data.provider)||(data.dailyLimit!==null&&(!Number.isSafeInteger(data.dailyLimit)||data.dailyLimit<1||data.dailyLimit>100000000))||!Number.isInteger(data.alertPercent)||data.alertPercent<50||data.alertPercent>99)throw new DataError('Batas pemantauan tidak valid.',400);
      await env.API_LOGS.prepare('INSERT INTO api_budgets(provider,daily_limit,alert_percent,updated_at) VALUES(?,?,?,?) ON CONFLICT(provider) DO UPDATE SET daily_limit=excluded.daily_limit,alert_percent=excluded.alert_percent,updated_at=excluded.updated_at').bind(data.provider,data.dailyLimit,data.alertPercent,Date.now()).run();summaryCache.clear();send(res,200,{saved:true});return true;
    }
    throw new DataError('Endpoint pemantauan tidak tersedia.',404);
  }catch(error){send(res,error instanceof DataError?error.status:503,{error:error instanceof DataError?error.message:'Pemantauan API belum dapat dihubungi.'});return true;}
}
