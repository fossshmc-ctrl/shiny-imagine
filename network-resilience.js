'use strict';

const TRANSIENT_NETWORK_RE=/(?:socket hang up|ECONNRESET|ECONNABORTED|ETIMEDOUT|ESOCKETTIMEDOUT|EPIPE|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND|Temporary failure in name resolution|Client network socket disconnected before secure TLS connection was established|before secure TLS connection was established|socket disconnected|TLS(?:v\d+(?:\.\d+)?)?.*(?:handshake|closed|reset|socket|alert)|SSL routines|ERR_TLS|socket.*(?:closed|reset|disconnected)|premature close|connection reset|remote host closed|connection aborted)/i;
const RETRYABLE_HTTP=new Set([408,425,429,500,502,503,504]);

function classifyNetworkError(error){
  const e=error||{},code=String(e.code||e.cause&&e.cause.code||'').toUpperCase();
  const message=String(e.message||e||'');
  const text=[code,message].join(' ');
  let kind='network_error';
  if(/before secure TLS connection was established|Client network socket disconnected before secure TLS|TLS(?:v\d+(?:\.\d+)?)?.*handshake|SSL routines|ERR_TLS/i.test(text))kind='tls_handshake';
  else if(/ECONNRESET|socket hang up|socket disconnected|connection reset|premature close|remote host closed/i.test(text))kind='connection_reset';
  else if(/ETIMEDOUT|ESOCKETTIMEDOUT|timeout|超时/i.test(text))kind='timeout';
  else if(/ENOTFOUND|EAI_AGAIN|getaddrinfo|Temporary failure in name resolution|DNS/i.test(text))kind='dns';
  else if(/ECONNREFUSED/i.test(text))kind='connection_refused';
  else if(/EPIPE/i.test(text))kind='broken_pipe';
  else if(/ENETUNREACH|EHOSTUNREACH/i.test(text))kind='network_unreachable';
  return {kind,code,message,transient:TRANSIENT_NETWORK_RE.test(text)};
}
function isRetryableStatus(status){return RETRYABLE_HTTP.has(Number(status));}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));}
function safeFilename(name,mime){
  const ext=mime==='image/jpeg'?'.jpg':mime==='image/png'?'.png':mime==='image/gif'?'.gif':'.webp';
  const base=String(name||'reference').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,80)||'reference';
  return /\.(?:jpe?g|png|gif|webp)$/i.test(base)?base:base+ext;
}
function decodeImageDataUrl(value){
  const raw=String(value||'').trim();
  const m=raw.match(/^data:image\/(jpeg|jpg|png|gif|webp);(?:charset=[^;,]+;)?base64,([\s\S]+)$/i);
  if(!m)throw new Error('参考图不是可识别的 JPEG/PNG/GIF/WebP Data URL');
  const subtype=m[1].toLowerCase(),mime=subtype==='jpg'?'image/jpeg':'image/'+subtype;
  const compact=m[2].replace(/\s+/g,'');
  let buffer;try{buffer=Buffer.from(compact,'base64');}catch(_e){throw new Error('参考图 Base64 解码失败');}
  if(!buffer.length)throw new Error('参考图 Base64 内容为空');
  return {buffer,mime,filename:safeFilename('reference',mime)};
}
function buildMultipartFile(buffer,mime,filename){
  const boundary='----AIStudioV2623'+Math.random().toString(16).slice(2)+Date.now().toString(16);
  const safe=safeFilename(filename,mime);
  const head=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${safe}"\r\nContent-Type: ${mime||'application/octet-stream'}\r\n\r\n`,'utf8');
  const tail=Buffer.from(`\r\n--${boundary}--\r\n`,'utf8');
  return {body:Buffer.concat([head,Buffer.from(buffer),tail]),contentType:'multipart/form-data; boundary='+boundary,filename:safe,boundary};
}
async function retryTransient(operation,options){
  const opts=options||{},routes=Array.isArray(opts.routes)&&opts.routes.length?opts.routes:['direct'];
  const delays=Array.isArray(opts.delays)?opts.delays:[1000,3000,7000];
  const maxAttempts=Math.max(1,Number(opts.maxAttempts)||Math.max(routes.length,delays.length+1));
  const trace=[];let lastError=null,lastResponse=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const route=routes[(attempt-1)%routes.length];
    const started=Date.now();
    try{
      const response=await operation({attempt,route});
      lastResponse=response;
      const status=Number(response&&response.status)||0,retryable=isRetryableStatus(status);
      trace.push({attempt,route,status,durationMs:Date.now()-started,retryable,error:''});
      if(!retryable)return Object.assign({},response,{attempts:attempt,route,networkTrace:trace});
      if(attempt>=maxAttempts)return Object.assign({},response,{attempts:attempt,route,networkTrace:trace});
    }catch(error){
      lastError=error;const info=classifyNetworkError(error);
      trace.push({attempt,route,status:0,durationMs:Date.now()-started,retryable:info.transient,error:info.message,kind:info.kind,code:info.code});
      if(!info.transient||attempt>=maxAttempts){error.networkTrace=trace;error.attempts=attempt;error.route=route;throw error;}
    }
    await (opts.sleep||sleep)(delays[Math.min(attempt-1,delays.length-1)]||0);
  }
  if(lastError)throw lastError;
  return Object.assign({},lastResponse||{status:599,headers:{},body:Buffer.alloc(0)},{networkTrace:trace});
}
module.exports={TRANSIENT_NETWORK_RE,RETRYABLE_HTTP,classifyNetworkError,isRetryableStatus,decodeImageDataUrl,buildMultipartFile,retryTransient,sleep};
