'use strict';

const crypto=require('crypto');

const REFERENCE_CACHE_TTL_MS=12*60*60*1000;
const PROTOCOL_FALLBACK_HTTP=new Set([408,425,500,502,503,504]);

function tokenFingerprint(key){
  return crypto.createHash('sha256').update(String(key||''),'utf8').digest('hex').slice(0,16);
}
function referenceCacheId(buffer,key,channel='shared'){
  const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer||'');
  return crypto.createHash('sha256').update(b).update('|'+tokenFingerprint(key)).update('|'+String(channel||'shared')).digest('hex');
}
function parseJsonBody(body){
  try{return JSON.parse(Buffer.isBuffer(body)?body.toString('utf8'):String(body||''));}catch(_e){return null;}
}
function parseFileUploadResponse(response){
  const status=Number(response&&response.status)||0;
  const parsed=parseJsonBody(response&&response.body);
  const data=parsed&&parsed.data&&typeof parsed.data==='object'?parsed.data:{};
  const url=String(data.file_url||data.fileUrl||parsed&&parsed.file_url||parsed&&parsed.fileUrl||'').trim();
  const downloadUrl=String(data.download_url||data.downloadUrl||'').trim();
  const expiresAt=String(data.expires_at||data.expiresAt||'').trim();
  const success=status>=200&&status<300&&!!url;
  return {status,parsed,data,url,downloadUrl,expiresAt,success};
}
function shouldProtocolFallback(value){
  if(value instanceof Error)return true;
  const status=Number(value&&value.status)||0;
  if(!status)return true;
  if(PROTOCOL_FALLBACK_HTTP.has(status))return true;
  if(status>=200&&status<300){
    const parsed=parseFileUploadResponse(value);
    return !parsed.success;
  }
  return false;
}
function buildBase64Payload(buffer,mime){
  const b=Buffer.isBuffer(buffer)?buffer:Buffer.from(buffer||'');
  const type=String(mime||'application/octet-stream');
  return Buffer.from(JSON.stringify({base64_data:`data:${type};base64,${b.toString('base64')}`}), 'utf8');
}
function safeCacheExpiry(upstreamExpiresAt,now=Date.now()){
  const ttl=now+REFERENCE_CACHE_TTL_MS;
  const parsed=Date.parse(String(upstreamExpiresAt||''));
  if(!Number.isFinite(parsed))return ttl;
  return Math.max(now+60*1000,Math.min(ttl,parsed-60*60*1000));
}
module.exports={
  REFERENCE_CACHE_TTL_MS,
  PROTOCOL_FALLBACK_HTTP,
  tokenFingerprint,
  referenceCacheId,
  parseFileUploadResponse,
  shouldProtocolFallback,
  buildBase64Payload,
  safeCacheExpiry
};
