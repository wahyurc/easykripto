// Regression checks for account isolation requested during security hardening.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {adminClient,projectId,reportError} from './firebase-admin-client.mjs';
import {requireApprovedRegistration} from '../registration-access.mjs';

async function check(){
  const originalFetch=globalThis.fetch;
  const claims={sub:'registration-check',firebase:{sign_in_provider:'password'}};
  let status=200,value='pending',requests=0;
  globalThis.fetch=async()=>{requests++;return Response.json({fields:{status:{stringValue:value}}},{status});};
  try{
    for(const state of ['pending','rejected']){value=state;await assert.rejects(requireApprovedRegistration(claims,'example-token'),error=>error.status===403);}
    value='approved';await requireApprovedRegistration(claims,'example-token');
    status=404;await assert.rejects(requireApprovedRegistration(claims,'example-token'),error=>error.status===403);
    await requireApprovedRegistration({...claims,firebase:{sign_in_provider:'google.com'}},'example-token');
    status=200;value='pending';await assert.rejects(requireApprovedRegistration({...claims,firebase:{sign_in_provider:'google.com'}},'example-token'),error=>error.status===403);
    const before=requests;await requireApprovedRegistration({...claims,role:'superadmin',superadmin:true},'example-token');assert.equal(requests,before);
    status=403;await assert.rejects(requireApprovedRegistration(claims,'example-token'),error=>error.status===503);
    console.log('Approval API checks: 8 passed (mocked responses).');
  }finally{globalThis.fetch=originalFetch;}

  const client=await adminClient(),source=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
  const auth=(uid='user-a',provider='password',verified=true,extra={})=>({uid,token:{email_verified:verified,email:uid+'@example.com',firebase:{sign_in_provider:provider},...extra}});
  const mock=(name,value)=>({function:name,args:[{anyValue:{}}],result:{value}});
  const cases=[];
  const add=(name,path,method,user,expectation,mocks=[])=>cases.push({name,test:{request:{path:'/databases/(default)/documents/'+path,method,auth:user},expectation,functionMocks:mocks}});
  const approved=[mock('exists',true),mock('get',{data:{status:'approved'}})];
  const pending=[mock('exists',true),mock('get',{data:{status:'pending'}})];
  add('Own pending registration readable','registrations/user-a','get',auth('user-a','password',false),'ALLOW');
  add('Other registration denied','registrations/user-b','get',auth(),'DENY');
  add('Registration list denied for ordinary user','registrations','list',auth(),'DENY');
  add('Superadmin registration list allowed','registrations','list',auth('admin','google.com',true,{role:'superadmin',superadmin:true}),'ALLOW');
  add('Role string alone is not superadmin','registrations','list',auth('admin','google.com',true,{role:'superadmin'}),'DENY');
  add('Pending wallet access denied','accounts/user-a/wallets/item','get',auth(),'DENY',pending);
  add('Approved wallet owner allowed','accounts/user-a/wallets/item','get',auth(),'ALLOW',approved);
  add('Other wallet denied','accounts/user-b/wallets/item','get',auth(),'DENY',approved);
  add('Unverified approved user denied','accounts/user-a/wallets/item','get',auth('user-a','password',false),'DENY',approved);
  add('Missing registration password user denied','accounts/user-a/wallets/item','get',auth(),'DENY',[mock('exists',false)]);
  add('Existing Google user allowed','accounts/user-a/wallets/item','get',auth('user-a','google.com'),'ALLOW',[mock('exists',false)]);
  add('Anonymous visits denied','visits/12345678901234567890','create',null,'DENY');
  add('Self approval denied','registrations/user-a','update',auth(),'DENY');
  const response=await client.request({url:`https://firebaserules.googleapis.com/v1/projects/${projectId}:test`,method:'POST',data:{source:{files:[{name:'firestore.rules',content:source}]},testSuite:{testCases:cases.map(item=>item.test)}},timeout:30000});
  const results=response.data.testResults||[];
  const summary=cases.map((item,index)=>({case:item.name,state:results[index]?.state||'MISSING',debug:results[index]?.debugMessages}));
  console.log(JSON.stringify({rulesChecks:summary,issues:response.data.issues}));
  if(results.length!==cases.length||results.some(result=>result.state!=='SUCCESS'))throw new Error('Rules checks failed');
}
check().catch(reportError);
