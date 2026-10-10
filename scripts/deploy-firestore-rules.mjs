import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {adminClient,projectId,database,AdminSetupError,reportError} from './firebase-admin-client.mjs';

async function deploy() {
  const client = await adminClient();
  const db = await client.request({url:`https://firestore.googleapis.com/v1/${database}`,timeout:15000});
  if (db.data.type !== 'FIRESTORE_NATIVE') throw new AdminSetupError('Dashboard membutuhkan Firestore Native mode.');
  const base = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;
  const name = `projects/${projectId}/releases/cloud.firestore`;
  const content = await readFile(new URL('../firestore.rules',import.meta.url),'utf8');
  let release;
  try { release = (await client.request({url:`${base}/releases/cloud.firestore`,timeout:15000})).data; }
  catch (error) { if (error.response?.status !== 404) throw error; }
  if (release) {
    const old = (await client.request({url:`https://firebaserules.googleapis.com/v1/${release.rulesetName}`,timeout:15000})).data;
    const backupDir = new URL('../.secrets/rules-backups/',import.meta.url);
    await mkdir(backupDir,{recursive:true});
    await writeFile(new URL(`${Date.now()}.json`,backupDir),JSON.stringify({release,ruleset:old},null,2));
    const files = old.source?.files || [];
    if (files.length === 1 && files[0].content.trim() === content.trim()) {
      console.log(JSON.stringify({projectId,rulesDeployed:true,changed:false}));return;
    }
    const normalized = files.map(file=>file.content).join('\n').replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s/g,'');
    const defaultDeny = /^rules_version=['"]2['"];servicecloud\.firestore\{match\/databases\/\{database\}\/documents\{match\/\{document=\*\*\}\{allowread,write:iffalse;\}\}\}$/;
    if (!defaultDeny.test(normalized)) throw new AdminSetupError('Aturan aktif berisi pengaturan lain. Cadangan tersimpan di .secrets/rules-backups; gabungkan aturan terlebih dahulu sebelum penerbitan.');
  }
  const ruleset = (await client.request({url:`${base}/rulesets`,method:'POST',data:{source:{files:[{name:'firestore.rules',content}]}},timeout:15000})).data;
  const payload = {name,rulesetName:ruleset.name};
  await client.request({url:release?`${base}/releases/cloud.firestore`:`${base}/releases`,method:release?'PATCH':'POST',data:release?{release:payload,updateMask:'rulesetName'}:payload,timeout:15000});
  const saved = (await client.request({url:`${base}/releases/cloud.firestore`,timeout:15000})).data;
  if (saved.rulesetName !== ruleset.name) throw new AdminSetupError('Penerbitan aturan belum dapat dikonfirmasi. Jalankan kembali skrip.');
  console.log(JSON.stringify({projectId,rulesDeployed:true,changed:true}));
}
deploy().catch(reportError);
