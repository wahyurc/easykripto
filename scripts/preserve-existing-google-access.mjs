import {mkdir,writeFile} from 'node:fs/promises';
import {adminClient,projectId,database,AdminSetupError,reportError} from './firebase-admin-client.mjs';

// One-time migration: a fixed cutoff never grants access to later signups.
async function migrate(){
  const before=process.argv.find(arg=>arg.startsWith('--before='))?.slice(9);
  const cutoff=Date.parse(before),apply=process.argv.includes('--apply');
  if(!before||!Number.isFinite(cutoff)||cutoff>Date.now())throw new AdminSetupError('Berikan --before=timestamp-ISO tetap, tidak boleh di masa depan.');
  const client=await adminClient(),plan=[];
  let pageToken,examined=0,existing=0;
  do{
    const response=await client.request({url:`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:batchGet`,params:{maxResults:1000,...(pageToken?{nextPageToken:pageToken}:{})},timeout:15000});
    for(const user of response.data.users||[]){
      examined++;
      const providers=(user.providerUserInfo||[]).map(provider=>provider.providerId),created=Number(user.createdAt);
      if(!user.localId||!user.email||user.disabled||user.emailVerified!==true||!Number.isFinite(created)||created<=0||created>=cutoff||!providers.includes('google.com')||providers.includes('password'))continue;
      let claims;try{claims=JSON.parse(user.customAttributes||'{}');}catch{continue;}
      if(claims.role==='superadmin'&&claims.superadmin===true)continue;
      const url=`https://firestore.googleapis.com/v1/${database}/documents/registrations/${encodeURIComponent(user.localId)}`;
      try{await client.request({url,timeout:15000});existing++;continue;}catch(error){if(error.response?.status!==404)throw error;}
      const text=value=>({stringValue:String(value)});
      plan.push({uid:user.localId,fields:{uid:text(user.localId),name:text((user.displayName||user.email).trim().slice(0,150)),email:text(user.email),status:text('approved'),createdAt:{timestampValue:new Date(created).toISOString()},reviewedAt:{timestampValue:new Date().toISOString()},reviewedBy:text('system:existing-google-migration'),reason:text(`Akses akun Google lama dipertahankan; terdaftar sebelum ${new Date(cutoff).toISOString()}.`)}});
    }
    pageToken=response.data.nextPageToken;
  }while(pageToken);
  const summary={projectId,before:new Date(cutoff).toISOString(),apply,examined,existingRegistrations:existing,eligible:plan.length};
  if(!apply){console.log(JSON.stringify(summary));return;}
  const directory=new URL('../.secrets/registration-migrations/',import.meta.url);
  await mkdir(directory,{recursive:true});
  await writeFile(new URL(`${Date.now()}-existing-google.json`,directory),JSON.stringify({summary,plan},null,2));
  let created=0,concurrent=0;
  for(const item of plan){
    try{
      await client.request({url:`https://firestore.googleapis.com/v1/${database}/documents/registrations?documentId=${encodeURIComponent(item.uid)}`,method:'POST',data:{fields:item.fields},timeout:15000});created++;
    }catch(error){if(error.response?.status===409){concurrent++;continue;}throw error;}
  }
  console.log(JSON.stringify({...summary,created,concurrent}));
}
migrate().catch(reportError);
