import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';

if(existsSync('.env'))process.loadEnvFile('.env');
const workerName='easykripto-data';
const tokenFile='api-keys/CLOUDFLARE_API_KEY';
const token=(process.env.CLOUDFLARE_API_TOKEN||(existsSync(tokenFile)?readFileSync(tokenFile,'utf8'):''))
  .replace(/^\uFEFF/,'').trim().replace(/^(?:CLOUDFLARE_API_(?:KEY|TOKEN)|(?:API[ _]?)?(?:KEY|TOKEN))\s*[:=]\s*/i,'').replace(/^['"]|['"]$/g,'');

async function api(path,{method='GET',json,body,allowMissing=false}={}){
  const headers={Authorization:`Bearer ${token}`};
  if(json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(json);}
  const response=await fetch(`https://api.cloudflare.com/client/v4${path}`,{method,headers,body,signal:AbortSignal.timeout(45000)});
  const data=await response.json();
  if(allowMissing&&response.status===404)return null;
  if(!response.ok||!data.success)throw new Error(`Cloudflare HTTP ${response.status}; codes ${(data.errors||[]).map(error=>error.code).join(',')}; ${method} ${path}`);
  return data.result;
}

try{
  if(!/^[A-Za-z0-9_-]{20,200}$/.test(token))throw new Error('Cloudflare token missing or invalid format.');
  for(const name of ['HELIUS_API_KEY','ALCHEMY_API_KEY'])if(!process.env[name]?.trim())throw new Error(`Missing ${name} in local environment.`);
  const accounts=await api('/accounts?per_page=50');
  const account=process.env.CLOUDFLARE_ACCOUNT_ID?accounts.find(item=>item.id===process.env.CLOUDFLARE_ACCOUNT_ID):accounts.length===1?accounts[0]:null;
  if(!account)throw new Error('Select CLOUDFLARE_ACCOUNT_ID in the local environment.');
  const root=`/accounts/${account.id}/workers`;
  const dbName='easykripto-api-monitor',dbRoot=`/accounts/${account.id}/d1/database`;
  const databases=await api(`${dbRoot}?per_page=100`);
  const database=databases.find(db=>db.name===dbName)||await api(dbRoot,{method:'POST',json:{name:dbName}});
  await api(`${dbRoot}/${database.uuid}/query`,{method:'POST',json:{sql:readFileSync('api-monitor-schema.sql','utf8')}});
  let subdomain=await api(`${root}/subdomain`,{allowMissing:true});
  if(!subdomain)subdomain=await api(`${root}/subdomain`,{method:'PUT',json:{subdomain:'easykripto-wahyurc'}});
  const bindings=[{type:'d1',name:'API_LOGS',id:database.uuid},{type:'plain_text',name:'API_ALLOWED_ORIGINS',text:'https://wahyurc.github.io,http://localhost:4173'},
    {type:'plain_text',name:'APP_CHECK_REQUIRED',text:process.env.APP_CHECK_REQUIRED==='true'?'true':'false'},
    ...['HELIUS_API_KEY','ALCHEMY_API_KEY'].map(name=>({type:'secret_text',name,text:process.env[name].trim()}))];
  const form=new FormData();
  form.append('metadata',new Blob([JSON.stringify({main_module:'api-worker.mjs',compatibility_date:'2026-10-10',bindings})],{type:'application/json'}));
  for(const file of ['api-worker.mjs','analytics-api.mjs','firebase-token.mjs','chain-data.mjs','api-monitor.mjs','app-check.mjs']){
    form.append(file,new Blob([readFileSync(file)],{type:'application/javascript+module'}),file);
  }
  await api(`${root}/scripts/${workerName}`,{method:'PUT',body:form});
  await api(`${root}/scripts/${workerName}/subdomain`,{method:'POST',json:{enabled:true,previews_enabled:false}});
  await api(`${root}/scripts/${workerName}/schedules`,{method:'PUT',json:[{cron:'17 * * * *'}]});
  const settings=await api(`${root}/scripts/${workerName}/settings`);
  const secrets=(settings.bindings||[]).filter(binding=>binding.type==='secret_text').map(binding=>binding.name);
  if(!['HELIUS_API_KEY','ALCHEMY_API_KEY'].every(name=>secrets.includes(name)))throw new Error('Deployment returned incomplete secret bindings.');
  if(!settings.bindings?.some(binding=>binding.name==='API_LOGS'&&binding.type==='d1'))throw new Error('Deployment returned incomplete log binding.');
  const result={worker:workerName,origin:`https://${workerName}.${subdomain.subdomain}.workers.dev`,secrets,databaseId:database.uuid,databaseName:dbName,accountId:account.id,deployedAt:new Date().toISOString()};
  mkdirSync('.secrets',{recursive:true});writeFileSync('.secrets/cloudflare-deployment.json',JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}catch(error){
  console.error(/^(Cloudflare HTTP|Cloudflare token|Missing [A-Z_]+ in|Select CLOUDFLARE_ACCOUNT_ID|Deployment returned)/.test(error.message)?error.message:'Cloudflare deployment failed; credentials are hidden.');
  process.exitCode=1;
}
