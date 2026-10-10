import {DataError} from './chain-data.mjs';

export async function requireApprovedRegistration(payload,token,appCheckToken){
  if(payload.role==='superadmin'&&payload.superadmin===true)return;
  const url=`https://firestore.googleapis.com/v1/projects/easykripto-40e96/databases/(default)/documents/registrations/${encodeURIComponent(payload.sub)}`;
  let response;
  try{response=await fetch(url,{headers:{Authorization:`Bearer ${token}`,...(appCheckToken?{'X-Firebase-AppCheck':appCheckToken}:{})},signal:AbortSignal.timeout(10000)});}catch{throw new DataError('Status persetujuan akun belum dapat diperiksa.',503);}
  if(response.status===404){
    throw new DataError('Daftarkan akun dan tunggu persetujuan superadmin.',403);
  }
  if(!response.ok)throw new DataError('Status persetujuan akun belum dapat diverifikasi.',503);
  const document=await response.json();
  if(document.fields?.status?.stringValue!=='approved')throw new DataError('Pendaftaran belum disetujui superadmin.',403);
}
