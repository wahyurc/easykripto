import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {handleAuth, getAppOrigin} from './auth-server.mjs';
import {handleAnalytics} from './analytics-api.mjs';
import {handleAPIMonitor} from './api-monitor.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
try{process.loadEnvFile(path.join(root,'.env'));}catch(error){if(error.code!=='ENOENT')throw error;}
const files=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/app.js','app.js'],['/auth.js','auth.js'],['/search.js','search.js'],['/networks.js','networks.js'],['/admin.js','admin.js'],['/admin.css','admin.css']]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png'};
const port=Number(process.env.PORT||4173);
for(const file of ['data-config.js','data-client.js','token-ui.js','dashboard-data.js','market-data.js','market-feed.js','market-feed.css','black-theme.css','wallet-data.js','chain-data.mjs','live-data.css'])files.set(`/${file}`,file);
types['.mjs']='text/javascript; charset=utf-8';
for(const file of ['notifications.js','notifications.css','api-telemetry.js','api-monitor-ui.js','api-monitor-ui.css'])files.set(`/${file}`,file);
for(const file of ['dexscreener-logo.png','gmgn-logo.png'])files.set(`/${file}`,file);
for(const file of ['app-check.js','pwa.js','pwa.css','sw.js','manifest.webmanifest','offline.html','offline.css','offline.js','icons/app-icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png'])files.set(`/${file}`,file);
types['.webmanifest']='application/manifest+json; charset=utf-8';
for(const file of ['registration.js','registration-admin.js','registration.css'])files.set(`/${file}`,file);
types['.svg']='image/svg+xml';
const host=process.env.HOST||(process.env.RENDER==='true'?'0.0.0.0':'127.0.0.1');
const appOrigin=getAppOrigin();
http.createServer(async(req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/healthz'&&['GET','HEAD'].includes(req.method)){
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:'{"ok":true}');return;
 }
 if(req.method==='GET'&&!pathname.startsWith('/api/')&&req.headers.host===`127.0.0.1:${port}`&&appOrigin===`http://localhost:${port}`){res.writeHead(302,{Location:`${appOrigin}${req.url}`});res.end();return;}
 try{if(await handleAPIMonitor(req,res,pathname,process.env))return;if(await handleAnalytics(req,res,pathname))return;if(await handleAuth(req,res,pathname))return;}catch{res.writeHead(500);res.end('Layanan tidak tersedia');return;}
 const file=files.get(pathname);
 if(!file){res.writeHead(404);res.end('Tidak ditemukan');return;}
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
 try{const body=await readFile(path.join(root,file));res.writeHead(200,{'Content-Type':types[path.extname(file)],'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:body);}
 catch{res.writeHead(500);res.end('File tidak dapat dibaca');}
}).listen(port,host,()=>console.log(`Easykripto: ${appOrigin}`));
