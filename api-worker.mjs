import {handleAnalytics} from './analytics-api.mjs';

export default {
  async fetch(request,env){
    const url=new URL(request.url);
    if(url.pathname==='/healthz')return Response.json({ok:true});
    const headers=new Headers();let status=200,body='';
    const res={setHeader(name,value){headers.set(name,value);},writeHead(code,extra={}){status=code;for(const [name,value]of Object.entries(extra))headers.set(name,value);},end(value){body=value||'';}};
    const req={url:request.url,method:request.method,headers:Object.fromEntries(request.headers)};
    if(!await handleAnalytics(req,res,url.pathname,env))return Response.json({error:'Tidak ditemukan.'},{status:404});
    return new Response(status===204?null:body,{status,headers});
  }
};
