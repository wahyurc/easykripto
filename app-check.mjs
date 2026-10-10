import {DataError} from './chain-data.mjs';
const projectNumber='625824114212',appId='1:625824114212:web:a9b63f76160432561adab1';
let keys=[],until=0,inflight=null;
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyAppCheck(token){
  if(typeof token!=='string'||token.length>12000)throw new DataError('Verifikasi aplikasi diperlukan.',401);
  try{
    const parts=token.split('.');if(parts.length!==3)throw new Error();
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string')throw new Error();
    if(until<Date.now()){
      inflight ||= (async()=>{const response=await fetch('https://firebaseappcheck.googleapis.com/v1/jwks',{signal:AbortSignal.timeout(10000)});if(!response.ok)throw new DataError('Layanan verifikasi aplikasi belum tersedia.',503);keys=(await response.json()).keys||[];until=Date.now()+Math.min(21600,Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300))*1000;})();
      try{await inflight;}finally{inflight=null;}
    }
    const jwk=keys.find(key=>key.kid===header.kid);if(!jwk||jwk.kty!=='RSA')throw new Error();
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))throw new Error();
    const claims=JSON.parse(new TextDecoder().decode(decode(parts[1]))),now=Date.now()/1000;
    if(claims.iss!==`https://firebaseappcheck.googleapis.com/${projectNumber}`||!Array.isArray(claims.aud)||!claims.aud.includes(`projects/${projectNumber}`)||claims.sub!==appId||!Number.isFinite(claims.exp)||claims.exp<=now||!Number.isFinite(claims.iat)||claims.iat>now+30)throw new Error();
    return claims;
  }catch(error){if(error instanceof DataError)throw error;throw new DataError('Verifikasi aplikasi gagal. Muat ulang halaman dan coba lagi.',401);}
}
export async function requireAppCheck(req,env){
  if(env.APP_CHECK_REQUIRED==='true')await verifyAppCheck(req.headers['x-firebase-appcheck']);
}
