import {randomBytes, timingSafeEqual} from 'node:crypto';
import {OAuth2Client} from 'google-auth-library';

const client = new OAuth2Client();
const sessions = new Map();
const challenges = new Map();
const TTL = 7 * 24 * 60 * 60 * 1000;
const random = () => randomBytes(32).toString('base64url');
const cookies = request => Object.fromEntries((request.headers.cookie || '').split(';').map(s=>s.trim().split('=')).filter(p=>p.length===2));
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));}
function reply(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function cookie(name,value,maxAge){return `${name}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${process.env.APP_ORIGIN?.startsWith('https://')?'; Secure':''}`;}
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>16384)throw new Error('BODY_TOO_LARGE');}return JSON.parse(text);}

export async function handleAuth(req,res,pathname){
 if(!pathname.startsWith('/api/auth/'))return false;
 const now=Date.now();for(const [id,s] of sessions)if(s.expires<=now)sessions.delete(id);for(const [id,s] of challenges)if(s.expires<=now)challenges.delete(id);
 const jar=cookies(req),clientId=process.env.GOOGLE_CLIENT_ID||'';
 const origin=process.env.APP_ORIGIN||`http://localhost:${process.env.PORT||4173}`;
 if(req.method==='GET'&&pathname==='/api/auth/session'){
  reply(res,200,{user:sessions.get(jar.ek_session)?.user||null});return true;
 }
 if(req.method==='GET'&&pathname==='/api/auth/config'){
  if(!clientId){reply(res,200,{clientId:null});return true;}
  if(challenges.size>=1000){reply(res,429,{error:'Terlalu banyak permintaan. Coba beberapa menit lagi.'});return true;}
  const id=random(),nonce=random();challenges.set(id,{nonce,expires:now+10*60*1000});res.setHeader('Set-Cookie',cookie('ek_login',id,600));reply(res,200,{clientId,nonce});return true;
 }
 if(req.method!=='POST'||req.headers.origin!==origin||!(req.headers['content-type']||'').startsWith('application/json')){
  reply(res,403,{error:'Permintaan login tidak diizinkan.'});return true;
 }
 if(pathname==='/api/auth/logout'){
  sessions.delete(jar.ek_session);res.setHeader('Set-Cookie',[cookie('ek_session','',0),cookie('ek_login','',0)]);reply(res,200,{ok:true});return true;
 }
 if(pathname==='/api/auth/google'){
  const challenge=challenges.get(jar.ek_login);challenges.delete(jar.ek_login);
  if(!clientId||!challenge){reply(res,401,{error:'Sesi login berakhir. Silakan muat ulang halaman.'});return true;}
  try{
   const {credential}=await body(req);if(typeof credential!=='string')throw new Error('INVALID_TOKEN');
   const ticket=await client.verifyIdToken({idToken:credential,audience:clientId});
   const payload=ticket.getPayload();
   if(!payload?.sub||!payload.email_verified||!equal(payload.nonce,challenge.nonce))throw new Error('INVALID_IDENTITY');
   if(sessions.size>=10000){reply(res,503,{error:'Layanan sibuk. Coba beberapa saat lagi.'});return true;}
   const user={id:payload.sub,name:payload.name||payload.email,email:payload.email};
   sessions.delete(jar.ek_session);const id=random();sessions.set(id,{user,expires:Date.now()+TTL});
   res.setHeader('Set-Cookie',[cookie('ek_session',id,TTL/1000),cookie('ek_login','',0)]);reply(res,200,{user});
  }catch{reply(res,401,{error:'Akun Google tidak dapat diverifikasi.'});}
  return true;
 }
 reply(res,404,{error:'Tidak ditemukan.'});return true;
}
