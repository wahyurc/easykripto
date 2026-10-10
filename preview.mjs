import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleAuth, getAppOrigin} from './auth-server.mjs';
import {handleAnalytics} from './analytics-api.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const files=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/app.js','app.js'],['/auth.js','auth.js'],['/search.js','search.js'],['/networks.js','networks.js'],['/admin.js','admin.js'],['/admin.css','admin.css']]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const port=Number(process.env.PORT||4173);
for(const file of ['data-config.js','market-data.js','wallet-data.js','chain-data.mjs','live-data.css'])files.set(`/${file}`,file);
types['.mjs']='text/javascript; charset=utf-8';
const host=process.env.HOST||(process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1');
const appOrigin=getAppOrigin();
http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/healthz'&&['GET','HEAD'].includes(req.method)){
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"ok":true}');return;
 }
 if(req.method==='GET'&&!pathname.startsWith('/api/')&&req.headers.host===`127.0.0.1:${port}`&&appOrigin===`http://localhost:${port}`){res.writeHead(302,{Location:`${appOrigin}${req.url}`});res.end();return;}
 try{if(await handleAnalytics(req,res,pathname))return;if(await handleAuth(req,res,pathname))return;}catch{res.writeHead(500);res.end('Layanan tidak tersedia');return;}
 const file=files.get(pathname);
 if(!file){res.writeHead(404);res.end('Tidak ditemukan');return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{const body=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);}
 catch{res.writeHead(500);res.end('File tidak dapat dibaca');}
}).listen(port,host,()=>console.log(`Easykripto: ${appOrigin}`));
