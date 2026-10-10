import {handleAnalytics} from './analytics-api.mjs';
import {handleAPIMonitor,pruneAPILogs} from './api-monitor.mjs';

export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname==='/healthz')return Response.json({ok:true});
    const headers=new Headers();let status=200,body='';
    const res={setHeader(name,value){headers.set(name,value);},writeHead(code,extra={}){status=code;for(const [name,value]of Object.entries(extra))headers.set(name,value);},end(value){body=value||'';}};
    const req={url:request.url,method:request.method,headers:Object.fromEntries(request.headers),waitUntil:promise=>ctx.waitUntil(promise),async readJson(max){
      const reader=request.body?.getReader();if(!reader)throw new Error('Body kosong');let bytes=0,parts=[];
      for(;;){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>max){await reader.cancel();throw new Error('Body terlalu besar');}parts.push(value);}
      const data=new Uint8Array(bytes);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return JSON.parse(new TextDecoder().decode(data));
    }};
    if(await handleAPIMonitor(req,res,url.pathname,env))return new Response(status===204?null:body,{status,headers});
    if(!await handleAnalytics(req,res,url.pathname,env))return Response.json({error:'Tidak ditemukan.'},{status:404});
    return new Response(status===204?null:body,{status,headers});
  },
  async scheduled(_controller,env,ctx){ctx.waitUntil(pruneAPILogs(env));}
};
