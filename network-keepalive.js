'use strict';
const http=require('http');
const https=require('https');
const net=require('net');
const tls=require('tls');
const {URL}=require('url');

const directHttpAgent=new http.Agent({keepAlive:true,keepAliveMsecs:15000,maxSockets:24,maxFreeSockets:8,timeout:60000});
const directHttpsAgent=new https.Agent({keepAlive:true,keepAliveMsecs:15000,maxSockets:24,maxFreeSockets:8,timeout:60000});
const httpProxyAgents=new Map();
const httpsProxyAgents=new Map();

function directAgentFor(target){
  try{return new URL(String(target||'')).protocol==='http:'?directHttpAgent:directHttpsAgent;}catch(_e){return directHttpsAgent;}
}
function httpProxyAgent(proxyUrl){
  const key=String(proxyUrl||'');
  if(!httpProxyAgents.has(key))httpProxyAgents.set(key,new http.Agent({keepAlive:true,keepAliveMsecs:15000,maxSockets:16,maxFreeSockets:6,timeout:60000}));
  return httpProxyAgents.get(key);
}
class HttpConnectHttpsAgent extends https.Agent{
  constructor(proxyUrl,opts={}){super(Object.assign({keepAlive:true,keepAliveMsecs:15000,maxSockets:12,maxFreeSockets:4,timeout:60000},opts));this.proxyUrl=String(proxyUrl||'');}
  createConnection(options,callback){
    let proxy;
    try{proxy=new URL(this.proxyUrl);}catch(error){callback(error);return;}
    if(proxy.protocol!=='http:'){callback(new Error('当前 Keep-Alive CONNECT Agent 仅支持 http:// 本机代理'));return;}
    const targetHost=String(options.servername||options.hostname||options.host||'').replace(/^\[|\]$/g,'');
    const targetPort=Number(options.port)||443;
    const proxyPort=Number(proxy.port)||80;
    const socket=net.connect({host:proxy.hostname,port:proxyPort});
    let settled=false,buffer='';
    const fail=error=>{if(settled)return;settled=true;try{socket.destroy();}catch(_e){}callback(error instanceof Error?error:new Error(String(error||'代理 CONNECT 失败')));};
    const timer=setTimeout(()=>fail(new Error('代理 CONNECT 超时')),Math.max(5000,Number(options.timeout)||20000));
    socket.once('error',fail);
    socket.once('connect',()=>{
      const headers=[`CONNECT ${targetHost}:${targetPort} HTTP/1.1`,`Host: ${targetHost}:${targetPort}`,'Proxy-Connection: keep-alive','Connection: keep-alive'];
      if(proxy.username||proxy.password){const auth=Buffer.from(decodeURIComponent(proxy.username||'')+':'+decodeURIComponent(proxy.password||'')).toString('base64');headers.push('Proxy-Authorization: Basic '+auth);}
      socket.write(headers.join('\r\n')+'\r\n\r\n');
    });
    const onData=chunk=>{
      buffer+=chunk.toString('latin1');const end=buffer.indexOf('\r\n\r\n');if(end<0){if(buffer.length>16384)fail(new Error('代理 CONNECT 响应头过大'));return;}
      socket.removeListener('data',onData);
      const head=buffer.slice(0,end),m=head.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/i),status=m?Number(m[1]):0;
      if(status!==200){fail(new Error('代理 CONNECT 失败：HTTP '+(status||'unknown')));return;}
      clearTimeout(timer);
      const rest=Buffer.from(buffer.slice(end+4),'latin1');if(rest.length)socket.unshift(rest);
      const tlsSocket=tls.connect({socket,servername:targetHost,ALPNProtocols:['http/1.1'],rejectUnauthorized:options.rejectUnauthorized!==false});
      tlsSocket.once('secureConnect',()=>{if(settled)return;settled=true;callback(null,tlsSocket);});
      tlsSocket.once('error',fail);
    };
    socket.on('data',onData);
  }
}
function targetAuthority(target){
  try{const u=new URL(String(target||''));return u.hostname+':'+(u.port||(u.protocol==='http:'?'80':'443'));}
  catch(_e){return String(target||'unknown');}
}
function httpsProxyAgent(proxyUrl,target=''){
  const raw=String(proxyUrl||'');
  let u;try{u=new URL(raw);}catch(_e){return null;}
  if(u.protocol!=='http:')return null;
  // V27.8: isolate CONNECT/TLS socket pools by proxy and target authority. A stale TLS
  // tunnel for Apifox or files-api can no longer poison task polling against api.evolink.ai.
  const key=raw+'|'+targetAuthority(target);
  if(!httpsProxyAgents.has(key))httpsProxyAgents.set(key,new HttpConnectHttpsAgent(raw));
  return httpsProxyAgents.get(key);
}
function invalidateHttpsProxyAgent(proxyUrl,target=''){
  const raw=String(proxyUrl||''),authority=target?targetAuthority(target):'';let count=0;
  for(const [key,agent] of [...httpsProxyAgents.entries()]){
    if(!key.startsWith(raw+'|'))continue;
    if(authority&&!key.endsWith('|'+authority))continue;
    try{agent.destroy();}catch(_e){}
    httpsProxyAgents.delete(key);count++;
  }
  return count;
}
function stats(){return{directHttp:{keepAlive:directHttpAgent.keepAlive},directHttps:{keepAlive:directHttpsAgent.keepAlive},httpProxyAgents:httpProxyAgents.size,httpsProxyAgents:httpsProxyAgents.size,targetScopedProxyAgents:true};}
function destroyAll(){directHttpAgent.destroy();directHttpsAgent.destroy();for(const a of httpProxyAgents.values())a.destroy();for(const a of httpsProxyAgents.values())a.destroy();httpProxyAgents.clear();httpsProxyAgents.clear();}
module.exports={directAgentFor,httpProxyAgent,httpsProxyAgent,invalidateHttpsProxyAgent,targetAuthority,stats,destroyAll};
