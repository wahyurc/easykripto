import {adminClient,projectId,reportError} from './firebase-admin-client.mjs';
const enable=async()=>{
  const client=await adminClient(),url=`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`;
  const current=(await client.request({url,timeout:15000})).data;
  if(!current.signIn?.email?.enabled||!current.signIn?.email?.passwordRequired){
    await client.request({url:url+'?updateMask=signIn.email.enabled,signIn.email.passwordRequired',method:'PATCH',data:{signIn:{email:{enabled:true,passwordRequired:true}}},timeout:15000});
  }
  const config=(await client.request({url,timeout:15000})).data;
  console.log(JSON.stringify({projectId,emailEnabled:config.signIn?.email?.enabled,passwordRequired:config.signIn?.email?.passwordRequired}));
};
enable().catch(reportError);
