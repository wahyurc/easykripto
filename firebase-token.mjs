import {DataError} from './chain-data.mjs';
import {requireApprovedRegistration} from './registration-access.mjs';

const projectId='easykripto-40e96';
let keys=[],expires=0,refreshing,lastFetch=0;
function decode(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),character=>character.charCodeAt(0));}
async function publicKeys(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
    const response=await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new DataError('Verifikasi akun belum tersedia.',503);
    const data=await response.json();keys=data.keys||[];lastFetch=Date.now();
    const seconds=Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||300);expires=Date.now()+Math.min(seconds,3600)*1000;
  })();
  try{await refreshing;}finally{refreshing=null;}
}
export async function firebaseClaims(token,appCheckToken){
  if(!token||token.length>12000)throw new DataError('Masuk ke akun untuk menganalisis wallet.',401);
  try{
    const parts=token.split('.');if(parts.length!==3)throw new Error();
    const header=JSON.parse(new TextDecoder().decode(decode(parts[0])));
    if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error();
    if(expires<Date.now())await publicKeys();
    let jwk=keys.find(key=>key.kid===header.kid);
    if(!jwk&&Date.now()-lastFetch>30000){await publicKeys();jwk=keys.find(key=>key.kid===header.kid);}
    if(!jwk||jwk.kty!=='RSA')throw new Error();
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(`${parts[0]}.${parts[1]}`)))throw new Error();
    const payload=JSON.parse(new TextDecoder().decode(decode(parts[1]))),now=Math.floor(Date.now()/1000);
    if(payload.aud!==projectId||payload.iss!==`https://securetoken.google.com/${projectId}`||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>128||payload.email_verified!==true)throw new Error();
    if(!Number.isFinite(payload.exp)||payload.exp<=now||!Number.isFinite(payload.iat)||payload.iat>now+30||payload.exp>payload.iat+3900||!Number.isFinite(payload.auth_time)||payload.auth_time>now+30)throw new Error();
    await requireApprovedRegistration(payload,token,appCheckToken);
    return payload;
  }catch(error){if(error instanceof DataError)throw error;throw new DataError('Sesi tidak dapat diverifikasi. Keluar lalu masuk kembali.',401);}
}
export async function firebaseIdentity(token,appCheckToken){return (await firebaseClaims(token,appCheckToken)).sub;}
