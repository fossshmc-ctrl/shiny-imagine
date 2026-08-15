const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const childProcess = require('child_process');
const zlib = require('zlib');
const {parseCozePayload,answersFromMessageList,errorText} = require('./coze-response');
const {auditCopyReturn} = require('./copy-field-audit');
const {JsonCollection,ensureDir,safeId} = require('./local-data-store');
const {classifyNetworkError,decodeImageDataUrl,buildMultipartFile,isRetryableStatus,sleep} = require('./network-resilience');
const {referenceCacheId,parseFileUploadResponse,shouldProtocolFallback,buildBase64Payload,safeCacheExpiry} = require('./evolink-reference-upload');
const KEEPALIVE = require('./network-keepalive');

const ROOT = __dirname;
const APP_VERSION='V29';
const BUILD_ID='v29-github-vercel-dual-runtime-20260815';
const HOSTED_RUNTIME=!!(process.env.VERCEL||process.env.AI_LINKUANG_RUNTIME==='serverless');
const RUNTIME_KIND=HOSTED_RUNTIME?'vercel-serverless':'windows-local';
const RUNTIME_DATA_ROOT=HOSTED_RUNTIME?path.join('/tmp','ai-linkuang-v29'):ROOT;
const ACCESS_CODE=String(process.env.AI_LINKUANG_ACCESS_CODE||'').trim();
const EVOLINK_BASE='https://api.evolink.ai/v1';
const EVOLINK_FILES_BASE='https://files-api.evolink.ai';
const EVOLINK_IMAGE_MODELS=["gemini-3.1-flash-lite-image","gemini-3.1-flash-image-preview","gemini-3-pro-image-preview","nano-banana-pro-beta","nano-banana-2-beta","nano-banana-2-lite-beta","nano-banana-beta","gemini-2.5-flash-image","gpt-image-2","gpt-image-2-beta","gpt-image-1.5","doubao-seedream-5.0-pro","doubao-seedream-5.0-lite","doubao-seedream-4.5","doubao-seedream-4.0","qwen-image-3.0","qwen-image-3.0-pro","qwen-image-edit","qwen-image-edit-plus","wan2.5-text-to-image","wan2.5-image-to-image","z-image-turbo","krea-2-turbo","mj-v8.1","mj-v8.1-retexture","mj-v8.1-remove-bg","mj-v7","mj-v7-retexture","mj-v7-remove-bg"];
function isEvolinkBase(base){try{const u=new URL(String(base||''));return /^(api|direct)\.evolink\.ai$/i.test(u.hostname);}catch(_e){return false;}}
function normalizeEvolinkBase(base){const raw=String(base||'').trim().replace(/\/+$/,'');try{const u=new URL(raw);if(/(^|\.)evolink\.ai$/i.test(u.hostname)&&/\/docs\//i.test(u.pathname))return EVOLINK_BASE;if(/^api\.evolink\.ai$/i.test(u.hostname)&&(!u.pathname||u.pathname==='/'||/^\/v1(?:\/)?$/i.test(u.pathname)||/^\/v1\/(?:images\/generations|tasks(?:\/.*)?|models)(?:\/)?$/i.test(u.pathname)))return EVOLINK_BASE;}catch(_e){}return raw;}
function evolinkModelPayload(){return {object:'list',data:EVOLINK_IMAGE_MODELS.map(id=>({id,object:'model',type:'image',output_modalities:['image'],supported_endpoints:['/v1/images/generations']}))};}
function arrayField(obj,keys){for(const key of keys){const value=obj&&obj[key];if(Array.isArray(value)&&value.length)return value.filter(v=>v!=null).map(String);}return [];}
function numberField(obj,keys){for(const key of keys){const value=Number(obj&&obj[key]);if(Number.isFinite(value)&&value>=0)return value;}return null;}
function normalizeEvolinkModelCapability(model){
  const row=typeof model==='string'?{id:model}:Object.assign({},model||{}),arch=row.architecture||{},params=row.parameters||row.parameter_schema||row.schema||{};
  const id=String(row.id||row.name||row.model||'').trim();if(!id)return null;
  const supportedEndpoints=arrayField(row,['supported_endpoints','endpoints']).length?arrayField(row,['supported_endpoints','endpoints']):arrayField(arch,['supported_endpoints','endpoints']);
  const inputModalities=arrayField(row,['input_modalities','modalities_in','input_types']).length?arrayField(row,['input_modalities','modalities_in','input_types']):arrayField(arch,['input_modalities','modalities_in','input_types']);
  const outputModalities=arrayField(row,['output_modalities','modalities_out','output_types']).length?arrayField(row,['output_modalities','modalities_out','output_types']):arrayField(arch,['output_modalities','modalities_out','output_types']);
  const maxInputImages=numberField(row,['max_input_images','max_images','max_reference_images','reference_image_limit']) ?? numberField(params,['max_input_images','max_images','max_reference_images','reference_image_limit']);
  const aspectRatios=(arrayField(row,['aspect_ratios','supported_aspect_ratios']).length?arrayField(row,['aspect_ratios','supported_aspect_ratios']):arrayField(params,['aspect_ratios','supported_aspect_ratios','size_options']));
  const resolutions=(arrayField(row,['resolutions','supported_resolutions']).length?arrayField(row,['resolutions','supported_resolutions']):arrayField(params,['resolutions','supported_resolutions','resolution_options']));
  const qualities=(arrayField(row,['qualities','supported_qualities','quality_options']).length?arrayField(row,['qualities','supported_qualities','quality_options']):arrayField(params,['qualities','supported_qualities','quality_options']));
  const imageOutput=outputModalities.some(x=>/image/i.test(x))||supportedEndpoints.some(x=>/images\/generations/i.test(x))||/(image|img|gpt[-_ ]?image|nano[-_ ]?banana|seedream|qwen.*image|wan.*image|z[-_ ]?image|krea|midjourney|^mj[-_ ]?v)/i.test(id);
  const supportsImageInput=inputModalities.length?inputModalities.some(x=>/image/i.test(x)):null;
  return {id,imageOutput,supportedEndpoints,inputModalities,outputModalities,supportsImageInput,maxInputImages,aspectRatios,resolutions,qualities,source:'evolink-model-catalog'};
}
function evolinkCapabilityPayload(rows,source){
  const models=(Array.isArray(rows)?rows:[]).filter(Boolean),capabilities=models.map(normalizeEvolinkModelCapability).filter(Boolean);
  return {ok:true,version:APP_VERSION,source:source||'builtin',refreshedAt:new Date().toISOString(),models,capabilities};
}
function evolinkCreditsPayload(raw,status){
  const body=raw&&typeof raw==='object'?raw:{},data=body.data&&typeof body.data==='object'?body.data:{},token=data.token&&typeof data.token==='object'?data.token:{},user=data.user&&typeof data.user==='object'?data.user:{};
  const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
  const tokenRemaining=n(token.remaining_credits),userRemaining=n(user.remaining_credits),tokenUsed=n(token.used_credits),userUsed=n(user.used_credits),tokenUnlimited=token.unlimited_credits===true;
  const blockedByToken=!tokenUnlimited&&tokenRemaining!==null&&tokenRemaining<=0,blockedByUser=userRemaining!==null&&userRemaining<=0,blocked=blockedByToken||blockedByUser;
  const candidates=[];if(userRemaining!==null)candidates.push(userRemaining);if(!tokenUnlimited&&tokenRemaining!==null)candidates.push(tokenRemaining);
  const effectiveRemaining=candidates.length?Math.min(...candidates):(tokenUnlimited?userRemaining:null);
  const recognized=tokenRemaining!==null||userRemaining!==null||tokenUnlimited===true,checked=status>=200&&status<300&&body.success!==false&&recognized;
  return {checked,recognized,blocked,generationReady:checked&&!blocked,tokenRemaining,userRemaining,tokenUsed,userUsed,tokenUnlimited,effectiveRemaining,success:body.success!==false,message:String(body.message||'')};
}
const EVOLINK_MODEL_CACHE_TTL_MS=5*60*1000;
let EVOLINK_MODEL_CATALOG_CACHE={base:'',at:0,raw:null,rows:[]};
async function fetchEvolinkModelCatalog(baseUrl,key,force){
  const base=normalizeEvolinkBase(baseUrl||EVOLINK_BASE),now=Date.now();
  if(!force&&EVOLINK_MODEL_CATALOG_CACHE.base===base&&EVOLINK_MODEL_CATALOG_CACHE.rows.length&&now-EVOLINK_MODEL_CATALOG_CACHE.at<EVOLINK_MODEL_CACHE_TTL_MS)return Object.assign({cached:true},EVOLINK_MODEL_CATALOG_CACHE);
  const r=await requestExternal('GET',base+'/models',key,null);let parsed={};try{parsed=JSON.parse(r.body.toString('utf8')||'{}');}catch(_e){}
  const rows=Array.isArray(parsed)?parsed:(parsed.data||parsed.models||[]);
  if(!(r.status>=200&&r.status<300&&Array.isArray(rows)&&rows.length))throw new Error('EvoLink /models 返回无效：HTTP '+r.status);
  EVOLINK_MODEL_CATALOG_CACHE={base,at:now,raw:parsed,rows};return Object.assign({cached:false},EVOLINK_MODEL_CATALOG_CACHE);
}
const WIRE_ASSET_FILES=[...Array.from({length:9},(_,i)=>`assets/wolassen/${String(i+2).padStart(2,'0')}.jpg`),...Array.from({length:9},(_,i)=>`assets/lebao/${String(i+2).padStart(2,'0')}.jpg`)];

const V26_DATA_DIR=ensureDir(path.join(RUNTIME_DATA_ROOT,'data','v26'));
const V26_WIRE_HISTORY_ASSET_DIR=ensureDir(path.join(V26_DATA_DIR,'wireframe-history-assets'));
const V26_WIRE_HISTORY=new JsonCollection(path.join(V26_DATA_DIR,'wireframe-history.json'),{maxItems:120});
const V26_IMAGE_TASKS=new JsonCollection(path.join(V26_DATA_DIR,'image-tasks.json'),{maxItems:600});
const V26_EVOLINK_REFERENCE_CACHE=new JsonCollection(path.join(V26_DATA_DIR,'evolink-reference-cache.json'),{maxItems:500});

function extFromContentType(type){
  const t=String(type||'').toLowerCase();
  if(t.includes('jpeg')||t.includes('jpg'))return'.jpg';
  if(t.includes('webp'))return'.webp';
  if(t.includes('gif'))return'.gif';
  return'.png';
}
function extFromUrl(value){
  try{const u=new URL(String(value||''));const e=path.extname(u.pathname).toLowerCase();if(['.png','.jpg','.jpeg','.webp','.gif'].includes(e))return e==='.jpeg'?'.jpg':e;}catch(_e){}
  return'.png';
}
function readRemoteBinary(url,redirects=0){
  return new Promise((resolve,reject)=>{
    if(redirects>5)return reject(new Error('历史图片下载重定向过多'));
    let u;try{u=new URL(url);}catch(e){return reject(new Error('历史图片 URL 无效'));}
    const lib=u.protocol==='http:'?http:https;
    const request=lib.get(u,{timeout:45000,headers:{'User-Agent':'AI-Tool-V27.9/1.0','Accept':'image/*,*/*;q=0.8'}},response=>{
      if([301,302,303,307,308].includes(response.statusCode)&&response.headers.location){
        response.resume();const next=new URL(response.headers.location,u).toString();return resolve(readRemoteBinary(next,redirects+1));
      }
      if(response.statusCode<200||response.statusCode>=300){response.resume();return reject(new Error('历史图片下载失败：HTTP '+response.statusCode));}
      const chunks=[];let total=0;const max=35*1024*1024;
      response.on('data',c=>{total+=c.length;if(total>max){request.destroy(new Error('历史图片超过 35MB'));return;}chunks.push(c);});
      response.on('end',()=>resolve({body:Buffer.concat(chunks),contentType:String(response.headers['content-type']||'application/octet-stream'),finalUrl:u.toString()}));
    });
    request.on('timeout',()=>request.destroy(new Error('历史图片下载超时')));
    request.on('error',reject);
  });
}
async function materializeWireHistoryImage(src,id){
  const value=String(src||'').trim();if(!value)return'';
  let buf=null,ext='.png';
  if(/^data:image\//i.test(value)){
    const m=value.match(/^data:(image\/[^;,]+)(?:;charset=[^;,]+)?;base64,(.+)$/i);
    if(!m)throw new Error('历史图片 Data URL 无效');buf=Buffer.from(m[2],'base64');ext=extFromContentType(m[1]);
  }else if(/^https?:\/\//i.test(value)){
    const out=await readRemoteBinary(value);buf=out.body;ext=extFromContentType(out.contentType)||extFromUrl(out.finalUrl);
  }else if(value.startsWith('/assets/')){
    const full=path.resolve(ROOT,'.'+value);if(full!==ROOT&&!full.startsWith(ROOT+path.sep))throw new Error('历史图片本地路径越界');
    buf=fs.readFileSync(full);ext=path.extname(full)||'.png';
  }else if(value.startsWith('/api/wireframe-history/assets/')){
    return value;
  }else{
    throw new Error('历史图片来源不支持持久化');
  }
  if(!buf||!buf.length)throw new Error('历史图片内容为空');
  const file=safeId(id)+ext.toLowerCase();
  fs.writeFileSync(path.join(V26_WIRE_HISTORY_ASSET_DIR,file),buf);
  return '/api/wireframe-history/assets/'+encodeURIComponent(file);
}
function removeWireHistoryAsset(item){
  try{const src=String(item&&item.src||'');const prefix='/api/wireframe-history/assets/';if(src.startsWith(prefix)){const file=decodeURIComponent(src.slice(prefix.length));const full=path.resolve(V26_WIRE_HISTORY_ASSET_DIR,file);if(full.startsWith(V26_WIRE_HISTORY_ASSET_DIR+path.sep)&&fs.existsSync(full))fs.unlinkSync(full);}}catch(_e){}
}
function isPrivateImageExportHost(hostname){
  const h=String(hostname||'').trim().toLowerCase().replace(/^\[|\]$/g,'');
  if(!h||h==='localhost'||h.endsWith('.local')||h==='::1')return true;
  if(net.isIP(h)===4){const p=h.split('.').map(Number);if(p[0]===10||p[0]===127||p[0]===0||p[0]===169&&p[1]===254||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31)return true;}
  if(net.isIP(h)===6&&(h.startsWith('fc')||h.startsWith('fd')||h.startsWith('fe80:')))return true;
  return false;
}
function imageMimeFromBinary(body,contentType,url){
  const type=String(contentType||'').split(';')[0].trim().toLowerCase();if(/^image\/(?:png|jpeg|jpg|webp|gif)$/i.test(type))return type==='image/jpg'?'image/jpeg':type;
  const b=body||Buffer.alloc(0);if(b.length>=8&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';
  if(b.length>=3&&b[0]===0xff&&b[1]===0xd8&&b[2]===0xff)return'image/jpeg';
  if(b.length>=6&&(b.subarray(0,6).toString('ascii')==='GIF87a'||b.subarray(0,6).toString('ascii')==='GIF89a'))return'image/gif';
  if(b.length>=12&&b.subarray(0,4).toString('ascii')==='RIFF'&&b.subarray(8,12).toString('ascii')==='WEBP')return'image/webp';
  const ext=extFromUrl(url);return ext==='.jpg'?'image/jpeg':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/png';
}

async function readExportRemoteBinary(url,redirects=0){
  if(redirects>5)throw new Error('图片下载重定向过多');
  let u;try{u=new URL(String(url||''));}catch(_e){throw new Error('图片下载 URL 无效');}
  if(!['http:','https:'].includes(u.protocol)||isPrivateImageExportHost(u.hostname))throw new Error('图片下载代理仅允许公网 HTTP(S) 图片地址');
  const out=await requestExternal('GET',u.toString(),'',null,null,'image/*,*/*;q=0.8');
  if([301,302,303,307,308].includes(out.status)&&out.headers&&out.headers.location){return readExportRemoteBinary(new URL(out.headers.location,u).toString(),redirects+1);}
  if(out.status<200||out.status>=300)throw new Error('远程图片返回 HTTP '+out.status);
  if(!out.body||!out.body.length)throw new Error('远程图片内容为空');
  if(out.body.length>35*1024*1024)throw new Error('远程图片超过 35MB');
  return {body:out.body,contentType:String(out.headers&&out.headers['content-type']||'application/octet-stream'),finalUrl:u.toString()};
}

function wireframeAssetStatus(){
  const assets=WIRE_ASSET_FILES.map(relative=>{const full=path.join(ROOT,...relative.split('/'));try{const st=fs.statSync(full);return{path:'/'+relative,ok:st.isFile()&&st.size>0,size:st.size};}catch(e){return{path:'/'+relative,ok:false,size:0,error:e.code||e.message};}});
  const missing=assets.filter(x=>!x.ok).map(x=>x.path);
  return{ok:true,version:APP_VERSION,buildId:BUILD_ID,rootPath:ROOT,assetsReady:missing.length===0,total:assets.length,ready:assets.length-missing.length,missing,assets};
}
const SERVER_LOGS = [];
function pushServerLog(entry){
  const e = Object.assign({time:new Date().toLocaleString('zh-CN'),method:'',path:'',status:0,durationMs:0,channel:'',message:''}, entry||{});
  SERVER_LOGS.unshift(e);
  if(SERVER_LOGS.length>200) SERVER_LOGS.length=200;
  return e;
}
const cfgPath = path.join(ROOT, 'config.json');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')); } catch(e) { cfg = {}; }

const COPY_COZE_PRIVATE_PATH = path.join(ROOT, 'copy-coze.private.json');
let COPY_COZE = {};
try { COPY_COZE = JSON.parse(fs.readFileSync(COPY_COZE_PRIVATE_PATH, 'utf8')); } catch(e) { COPY_COZE = {}; }
const COPY_COZE_TOKENS = require('./copy-coze-token')({root:RUNTIME_DATA_ROOT,privateConfig:COPY_COZE});
function copyCozeBots(){ return Array.isArray(COPY_COZE.bots) ? COPY_COZE.bots.filter(x=>x&&x.id) : []; }
function copyCozeBot(botId){ const bots=copyCozeBots(); return bots.find(x=>String(x.id)===String(botId)) || bots[0] || null; }
function copyCozeStatus(){
  const bot=copyCozeBot(''), base=String(COPY_COZE.apiBaseUrl||'https://api.coze.cn').replace(/\/+$/,''), chatPath=String(COPY_COZE.chatPath||'/v3/chat'), tokenState=COPY_COZE_TOKENS.status();
  const enabled=COPY_COZE.enabled!==false, configured=!!(enabled&&tokenState.configured&&bot);
  let message='';
  if(!enabled)message='扣子文案专用通道已停用';
  else if(!bot)message='copy-coze.private.json 中缺少 Bot ID';
  else message=tokenState.message;
  return {ok:true,version:APP_VERSION,provider:'coze',isolated:true,configured,tokenLoaded:tokenState.tokenLoaded,tokenSource:tokenState.tokenSource,tokenSourceLabel:tokenState.tokenSourceLabel,secureStorage:tokenState.secureStorage,manualTokenInput:true,endpoint:base+chatPath,docsUrl:COPY_COZE.docsUrl||'https://docs.coze.cn/',selectedModel:bot&&String(bot.id),models:copyCozeBots().map(x=>({id:String(x.id),label:String(x.label||'扣子文案智能体'),description:String(x.description||'')})),message};
}
function decodeUpstreamBody(response){
  let body=response&&response.body?response.body:Buffer.alloc(0);
  const enc=String((response&&response.headers&&response.headers['content-encoding'])||'').toLowerCase();
  try{
    if(enc.includes('gzip'))body=zlib.gunzipSync(body);
    else if(enc.includes('deflate'))body=zlib.inflateSync(body);
    else if(enc.includes('br')&&typeof zlib.brotliDecompressSync==='function')body=zlib.brotliDecompressSync(body);
  }catch(e){
    const err=new Error('扣子响应解压失败：'+e.message);err.status=502;throw err;
  }
  return body;
}
function cozeJson(text,label){
  let data;try{data=JSON.parse(String(text||'').trim()||'{}');}catch(e){const err=new Error((label||'扣子响应')+'不是合法 JSON');err.status=502;throw err;}
  if(Number(data.code||0)!==0){const err=new Error(errorText(data,(label||'扣子接口')+'返回业务错误'));err.status=400;err.cozeCode=data.code;err.logId=data.detail&&data.detail.logid;throw err;}
  return data;
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function recoverCozeAnswer(base,token,parsed,timeoutMs){
  if(!parsed||!parsed.conversationId||!parsed.chatId)return null;
  const deadline=Date.now()+Math.max(5000,Math.min(Number(timeoutMs)||180000,180000));
  let detail=null;
  while(Date.now()<deadline){
    const q='?conversation_id='+encodeURIComponent(parsed.conversationId)+'&chat_id='+encodeURIComponent(parsed.chatId);
    const r=await requestExternal('GET',base+'/v3/chat/retrieve'+q,token,null,'application/json','application/json');
    const text=decodeUpstreamBody(r).toString('utf8');
    if(r.status<200||r.status>=300){const err=new Error('扣子对话状态查询 HTTP '+r.status+'：'+text.slice(0,300));err.status=r.status;throw err;}
    detail=cozeJson(text,'扣子对话状态');
    const chat=detail.data||{};
    const status=String(chat.status||'');
    if(status==='completed')break;
    if(status==='failed'){
      const last=chat.last_error||{};const err=new Error(last.msg||last.message||'扣子对话执行失败');err.cozeCode=last.code;throw err;
    }
    if(status==='requires_action')throw new Error('扣子 Bot 返回 requires_action，当前文案通道不支持需要人工提交工具结果的对话');
    if(status==='canceled')throw new Error('扣子对话已取消');
    await wait(1000);
  }
  const finalStatus=String((detail&&detail.data&&detail.data.status)||'');
  if(finalStatus!=='completed')throw new Error('扣子对话状态轮询超时，最后状态：'+(finalStatus||'unknown'));
  const q='?conversation_id='+encodeURIComponent(parsed.conversationId)+'&chat_id='+encodeURIComponent(parsed.chatId);
  const r=await requestExternal('GET',base+'/v3/chat/message/list'+q,token,null,'application/json','application/json');
  const text=decodeUpstreamBody(r).toString('utf8');
  if(r.status<200||r.status>=300){const err=new Error('扣子消息详情查询 HTTP '+r.status+'：'+text.slice(0,300));err.status=r.status;throw err;}
  const payload=cozeJson(text,'扣子消息详情');
  const answer=answersFromMessageList(payload);
  return answer?{answer,transport:'message-list',eventCount:parsed.events?.length||0,chatId:parsed.chatId,conversationId:parsed.conversationId,logId:(payload.detail&&payload.detail.logid)||parsed.logId||''}:null;
}
function cozeAuthFailure(status,code){return [4100,4101].includes(Number(code))||Number(status)===401||Number(status)===403;}
function decorateCozeError(err,{status,code,requestId,logId,upstreamMessage}={}){
  const auth=cozeAuthFailure(status,code);
  err.status=auth?401:(Number(status)>=400&&Number(status)<600?Number(status):502);
  err.cozeCode=code||err.cozeCode||'';
  err.requestId=requestId||err.requestId||'';
  err.logId=logId||err.logId||'';
  err.errorType=auth?'auth_failed':(err.errorType||'upstream_error');
  err.upstreamStatus=Number(status)||0;
  if(auth){
    const n=Number(code),suffix=code?('（错误码 '+code+'）'):'';
    if(n===4100)err.message='扣子拒绝了当前访问令牌'+suffix+'：个人访问令牌不正确、已过期、被撤销或复制不完整。请重新生成令牌并在 V27 中手动粘贴。';
    else if(n===4101)err.message='扣子拒绝访问当前 Bot/工作空间'+suffix+'：令牌没有该资源权限，或未包含 chat 权限。请重新配置令牌权限与可访问空间后再手动粘贴。';
    else err.message='扣子拒绝了当前访问令牌'+suffix+'。请检查令牌有效期、权限、可访问工作空间和 Bot 归属后重试。';
  }else if(upstreamMessage&&!err.message){err.message=String(upstreamMessage);}
  return err;
}
function parseCozeHttpError(status,raw,headers,token){
  let data={},message=String(raw||'').slice(0,600),code='',logId='';
  try{data=JSON.parse(String(raw||'')||'{}');message=errorText(data,message);code=data.code||data.error?.code||'';logId=(data.detail&&data.detail.logid)||data.log_id||'';}catch(_e){}
  if(token&&message)message=String(message).split(String(token)).join('[令牌已隐藏]');
  const requestId=String((headers&&((headers['x-request-id'])||(headers['request-id'])||(headers['x-tt-logid'])))||'');
  return decorateCozeError(new Error(message||('扣子 API HTTP '+status)),{status,code,requestId,logId,upstreamMessage:message});
}
async function callCopyCoze(botId,userPrompt){
  const st=copyCozeStatus();
  if(!st.configured){const err=new Error(st.message);err.status=401;err.errorType='token_not_configured';throw err;}
  const bot=copyCozeBot(botId); if(!bot){const err=new Error('选择的扣子 Bot 不在允许列表中');err.status=400;throw err;}
  const base=String(COPY_COZE.apiBaseUrl||'https://api.coze.cn').replace(/\/+$/,''), target=base+String(COPY_COZE.chatPath||'/v3/chat'),tokenState=COPY_COZE_TOKENS.getToken(),token=String(tokenState.token||'');
  const payload={bot_id:String(bot.id),user_id:String(COPY_COZE.userIdPrefix||'turing-copy-current')+'-'+Date.now().toString(36),stream:true,auto_save_history:true,additional_messages:[{role:'user',content:String(userPrompt||''),content_type:'text'}]};
  const body=Buffer.from(JSON.stringify(payload));
  const r=await requestExternal('POST',target,token,body,'application/json','text/event-stream, application/json');
  const raw=decodeUpstreamBody(r).toString('utf8');
  const requestId=String((r.headers&&((r.headers['x-request-id'])||(r.headers['request-id'])||(r.headers['x-tt-logid'])))||'');
  if(r.status<200||r.status>=300)throw parseCozeHttpError(r.status,raw,r.headers,token);
  let parsed;
  try{parsed=parseCozePayload(raw);}catch(e){decorateCozeError(e,{status:e.status||502,code:e.cozeCode,requestId:e.requestId||requestId,logId:e.logId});throw e;}
  if(parsed.answer)return {status:r.status,reply:parsed.answer,bot,remoteIp:r.remoteIp||'',eventCount:parsed.events.length,transport:parsed.rawKind||'sse',chatId:parsed.chatId||'',conversationId:parsed.conversationId||'',requestId,logId:parsed.logId||''};
  try{
    const recovered=await recoverCozeAnswer(base,token,parsed,COPY_COZE.timeoutMs);
    if(recovered&&recovered.answer)return {status:r.status,reply:recovered.answer,bot,remoteIp:r.remoteIp||'',eventCount:recovered.eventCount||0,transport:recovered.transport,chatId:recovered.chatId||'',conversationId:recovered.conversationId||'',requestId,logId:recovered.logId||''};
  }catch(recoverErr){
    const names=(parsed.eventNames||[]).join(', ')||'无';
    const err=new Error('扣子已返回响应，但未解析到 answer；恢复查询也失败：'+recoverErr.message+'。事件：'+names);
    err.status=recoverErr.status||502;err.cozeCode=recoverErr.cozeCode;err.requestId=requestId;err.logId=recoverErr.logId||parsed.logId||'';throw err;
  }
  const names=(parsed.eventNames||[]).join(', ')||'无';
  const err=new Error('扣子已返回响应，但没有可用的 answer 消息。事件：'+names);err.status=502;err.requestId=requestId;err.logId=parsed.logId||'';throw err;
}
function cozeErrorPayload(e){
  return {message:String((e&&e.message)||'扣子接口调用失败'),code:(e&&e.cozeCode)||'',type:(e&&e.errorType)||'',upstreamStatus:(e&&e.upstreamStatus)||0,requestId:(e&&e.requestId)||'',logId:(e&&e.logId)||''};
}
function copyPrompt(productInfo,jsonPrompt){
  const schema=jsonPrompt||'请返回包含 versions 数组的合法 JSON，共 8 个版本。';
  return `${schema}\n\n【当前产品信息】\n${String(productInfo||'').trim()}\n\n再次强调：只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释。versions 必须恰好 8 项。`;
}
const PORT = Number(cfg.port || 8787);
const FORCE_IP = HOSTED_RUNTIME?'':String(cfg.forceHostIp || '').trim();
// Vercel Functions cannot use a user's local Clash/V2Ray port. Hosted mode is direct by default;
// an explicit AI_LINKUANG_PROXY_URL remains available for controlled infrastructure.
const PROXY_URL = HOSTED_RUNTIME
  ? String(process.env.AI_LINKUANG_PROXY_URL||'').trim()
  : String(cfg.proxyUrl || process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || process.env.ALL_PROXY || '').trim();
const NETWORK_CFG=cfg.network&&typeof cfg.network==='object'?cfg.network:{};
const REQUEST_TIMEOUT_MS=Math.max(15000,Number(NETWORK_CFG.requestTimeoutMs)||120000);
const UPLOAD_TIMEOUT_MS=Math.max(30000,Number(NETWORK_CFG.uploadTimeoutMs)||300000);
const UPLOAD_ATTEMPT_TIMEOUT_MS=Math.max(15000,Math.min(UPLOAD_TIMEOUT_MS,Number(NETWORK_CFG.uploadAttemptTimeoutMs)||90000));
const MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS=Math.max(12000,Math.min(60000,Number(NETWORK_CFG.microUploadAttemptTimeoutMs)||30000));
const MICRO_TASK_REQUEST_TIMEOUT_MS=Math.max(5000,Math.min(30000,Number(NETWORK_CFG.microTaskRequestTimeoutMs)||12000));
const MICRO_GENERATION_SUBMIT_TIMEOUT_MS=Math.max(15000,Math.min(90000,Number(NETWORK_CFG.microGenerationSubmitTimeoutMs)||45000));
const MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS=Math.max(30000,Number(NETWORK_CFG.microAdjustPollSoftTimeoutMs)||180000);
const MICRO_ADJUST_POLL_TIMEOUT_MS=Math.max(MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS,Number(NETWORK_CFG.microAdjustPollTimeoutMs)||360000);
const MICRO_ADJUST_POLL_MAX_TIMEOUT_MS=Math.max(MICRO_ADJUST_POLL_TIMEOUT_MS,Number(NETWORK_CFG.microAdjustPollMaxTimeoutMs)||480000);
const MICRO_RUN_STALE_MS=Math.max(MICRO_ADJUST_POLL_MAX_TIMEOUT_MS+60000,Number(NETWORK_CFG.microRunStaleMs)||600000);
const DIAGNOSTIC_TIMEOUT_MS=Math.max(5000,Number(NETWORK_CFG.diagnosticTimeoutMs)||20000);
const UPLOAD_RETRY_DELAYS_MS=Array.isArray(NETWORK_CFG.uploadRetryDelaysMs)&&NETWORK_CFG.uploadRetryDelaysMs.length?NETWORK_CFG.uploadRetryDelaysMs.map(Number).filter(Number.isFinite):[1200,3000,7000];
// proxyUrl 设为 "auto" 时，自动探测本机常见代理端口（Clash/V2Ray 等）
const COMMON_PROXIES = ['http://127.0.0.1:7890','http://127.0.0.1:7897','http://127.0.0.1:7891','http://127.0.0.1:10809','http://127.0.0.1:1080','http://127.0.0.1:10808','http://127.0.0.1:2080','http://127.0.0.1:8080','http://127.0.0.1:8888'];
let RESOLVED_PROXY = null;
let AUTO_PROXY_MISS_LOGGED = false;
const AUTO_PROXY_CACHE=new Map();
const AUTO_PROXY_BAD_UNTIL=new Map();
const FILE_ROUTE_HEALTH=new Map();
function targetAuthority(target){try{const u=new URL(String(target||''));return u.hostname+':'+(u.port||(u.protocol==='http:'?'80':'443'));}catch(_e){return String(target||'unknown');}}
function proxyHealthKey(target,proxy){return targetAuthority(target)+'|'+String(proxy||'direct');}
function markProxyBad(target,proxy,ttlMs=45000){if(!proxy)return;AUTO_PROXY_BAD_UNTIL.set(proxyHealthKey(target,proxy),Date.now()+Math.max(5000,Number(ttlMs)||45000));const k=targetAuthority(target),hit=AUTO_PROXY_CACHE.get(k);if(hit&&hit.proxy===proxy)AUTO_PROXY_CACHE.delete(k);if(RESOLVED_PROXY===proxy)RESOLVED_PROXY=null;}
function proxyIsTemporarilyBad(target,proxy){return Number(AUTO_PROXY_BAD_UNTIL.get(proxyHealthKey(target,proxy))||0)>Date.now();}
function noteFileRoute(target,route,ok){const key=proxyHealthKey(target,route&&route.proxyUrl||route&&route.type||'direct'),old=FILE_ROUTE_HEALTH.get(key)||{ok:0,fail:0,lastSuccess:0,lastFailure:0};if(ok){old.ok++;old.lastSuccess=Date.now();old.fail=Math.max(0,old.fail-1);}else{old.fail++;old.lastFailure=Date.now();}FILE_ROUTE_HEALTH.set(key,old);}
function fileRouteScore(target,route){const key=proxyHealthKey(target,route&&route.proxyUrl||route&&route.type||'direct'),h=FILE_ROUTE_HEALTH.get(key)||{};return (Number(h.ok)||0)*4-(Number(h.fail)||0)*7+(Number(h.lastSuccess)||0)/1e13-(Number(h.lastFailure)||0)/1e13;}
function probeHttpProxy(proxyUrl, target){
  return new Promise(resolve=>{
    let p, u;
    try { p=new URL(proxyUrl); u=new URL(target); }
    catch(e){ return resolve(false); }
    const targetPort=Number(u.port || (u.protocol==='http:'?80:443));
    const s=net.connect({host:p.hostname, port:Number(p.port||80)});
    let done=false, buf='';
    const finish=(ok)=>{ if(done)return; done=true; try{s.destroy();}catch(e){} resolve(ok); };
    s.on('connect', ()=>{
      s.write('CONNECT '+u.hostname+':'+targetPort+' HTTP/1.1\r\nHost: '+u.hostname+':'+targetPort+'\r\nProxy-Connection: keep-alive\r\nConnection: keep-alive\r\n\r\n');
    });
    s.on('data', d=>{
      buf += d.toString('latin1');
      if(buf.includes('\r\n')) finish(/^HTTP\/1\.[01]\s+200\b/i.test(buf));
    });
    s.on('error', ()=>finish(false));
    s.on('end', ()=>finish(/^HTTP\/1\.[01]\s+200\b/i.test(buf)));
    s.setTimeout(1400, ()=>finish(false));
  });
}
async function resolveAutoProxy(target){
  const authority=targetAuthority(target),cached=AUTO_PROXY_CACHE.get(authority);
  if(cached&&Date.now()-cached.at<60000&&!proxyIsTemporarilyBad(target,cached.proxy)){RESOLVED_PROXY=cached.proxy;return cached.proxy;}
  for(const u of COMMON_PROXIES){
    if(proxyIsTemporarilyBad(target,u))continue;
    try{
      if(await probeHttpProxy(u, target)){
        AUTO_PROXY_CACHE.set(authority,{proxy:u,at:Date.now()});RESOLVED_PROXY=u;
        console.log('[auto-proxy] detected upstream proxy for '+authority+': '+u);
        return u;
      }
    }catch(e){}
  }
  return null;
}
function makeLookup(ip){
  const fam = ip.indexOf(':') >= 0 ? 6 : 4;
  return function(hostname, options, callback){
    if(typeof options === 'function'){ callback = options; options = {}; }
    options = options || {};
    // Node 20+ 的 autoSelectFamily 会以 {all:true} 调用，需返回数组
    if(options.all){ return callback(null, [{ address: ip, family: fam }]); }
    return callback(null, ip, fam);
  };
}

const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.gif':'image/gif',
  '.svg':'image/svg+xml',
  '.txt':'text/plain; charset=utf-8'
};

function headers(type='application/json; charset=utf-8'){
  const out={
    'Content-Type': type,
    'Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type, Authorization, X-Base-Url, X-API-Key, X-App-Access-Code, X-AI-Progress-Stream, X-Channel, X-Micro-Generation-Id, X-Micro-Conflict-Policy, X-Micro-Instruction-Fingerprint, X-Micro-Handoff-Acknowledged',
    'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma':'no-cache',
    'Expires':'0'
  };
  if(!HOSTED_RUNTIME)out['Access-Control-Allow-Origin']='*';
  return out;
}
function send(res, code, body, type='application/json; charset=utf-8'){
  res.writeHead(code, headers(type));
  res.end(body);
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    const chunks=[];
    req.on('data', d=>chunks.push(d));
    req.on('end', ()=>resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
function safeEqual(left,right){
  const a=Buffer.from(String(left||'')),b=Buffer.from(String(right||''));
  return a.length===b.length&&a.length>0&&crypto.timingSafeEqual(a,b);
}
function accessGranted(req){
  if(!ACCESS_CODE)return true;
  return safeEqual(req&&req.headers&&req.headers['x-app-access-code'],ACCESS_CODE);
}
function assertAllowedHostedBase(baseUrl){
  if(!HOSTED_RUNTIME)return;
  let url;try{url=new URL(String(baseUrl||''));}catch(_e){const err=new Error('线上接口域名格式无效');err.status=400;throw err;}
  const extra=String(process.env.AI_LINKUANG_ALLOWED_API_HOSTS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  const allowed=new Set(['api.evolink.ai','direct.evolink.ai',...extra]);
  if(url.protocol!=='https:'||!allowed.has(url.hostname.toLowerCase())){
    const err=new Error('线上版仅允许受信任的 HTTPS API 域名；如需自定义域名，请在 Vercel 环境变量 AI_LINKUANG_ALLOWED_API_HOSTS 中加入主机名。');
    err.status=400;throw err;
  }
}
function getCfg(req){
  const managedKey=String(process.env.EVOLINK_API_KEY||'').trim();
  const managedBase=String(process.env.EVOLINK_BASE_URL||'').trim();
  const baseRaw = managedBase || (managedKey?EVOLINK_BASE:String(req.headers['x-base-url'] || cfg.baseUrl || EVOLINK_BASE).trim());
  const key = managedKey || String(req.headers['x-api-key'] || cfg.apiKey || '').trim();
  const baseUrl=normalizeEvolinkBase(baseRaw);
  assertAllowedHostedBase(baseUrl);
  return {baseUrl,key,serverManaged:!!managedKey};
}
function requestDirect(method, target, key, bodyBuf, contentType, rawMode=false, acceptHeader='', requestOptions={}){
  return new Promise((resolve,reject)=>{
    let u;
    try { u = new URL(target); } catch(e) { return reject(new Error('接口域名格式错误：'+target)); }
    const lib = u.protocol === 'http:' ? http : https;
    const opt = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      timeout: Math.max(1000,Number(requestOptions.timeoutMs)||REQUEST_TIMEOUT_MS),
      agent: KEEPALIVE.directAgentFor(target),
      headers: rawMode ? {
        'Accept': '*/*',
        'User-Agent': 'AI-Studio-V27.9',
        'Connection':'keep-alive'
      } : {
        'Content-Type': contentType || 'application/json',
        'Accept': acceptHeader || 'application/json',
        'Accept-Encoding':'gzip, deflate, br',
        'Connection':'keep-alive'
      }
    };
    if(key) opt.headers['Authorization']='Bearer '+key;
    if(FORCE_IP && !rawMode && /(?:^|\.)evolink\.ai$/i.test(u.hostname)){ opt.lookup = makeLookup(FORCE_IP); opt.servername = u.hostname; opt.autoSelectFamily = false; }
    if(bodyBuf && bodyBuf.length) opt.headers['Content-Length'] = bodyBuf.length;
    let remoteIp = '';
    const r = lib.request(opt, rr=>{
      try { remoteIp = (rr.socket && rr.socket.remoteAddress) || ''; } catch(e){}
      const chunks=[];
      rr.on('data', d=>chunks.push(d));
      rr.on('end', ()=>{
        let body=Buffer.concat(chunks);const enc=String(rr.headers['content-encoding']||'').toLowerCase();
        try{if(enc==='gzip')body=zlib.gunzipSync(body);else if(enc==='deflate')body=zlib.inflateSync(body);else if(enc==='br'&&zlib.brotliDecompressSync)body=zlib.brotliDecompressSync(body);}catch(_e){}
        resolve({status: rr.statusCode || 500, headers: rr.headers, body, remoteIp, reusedSocket:!!r.reusedSocket});
      });
    });
    r.on('timeout', ()=>{ const err=new Error('请求超时：外部 API '+Math.round((Number(requestOptions.timeoutMs)||REQUEST_TIMEOUT_MS)/1000)+' 秒内未响应');err.code='ETIMEDOUT';r.destroy(err); });
    r.on('error', err=>{const out=new Error('无法连接外部 API：'+err.message);out.code=err.code||'';out.cause=err;reject(out);});
    if(bodyBuf && bodyBuf.length) r.write(bodyBuf);
    r.end();
  });
}
// 经上游代理（VPN / Clash / 公司代理）出网：对 https 使用 CONNECT + TLS 隧道
function proxyAuthHeader(p){
  if(!p.username) return '';
  const user = decodeURIComponent(p.username || '');
  const pass = decodeURIComponent(p.password || '');
  return 'Basic ' + Buffer.from(user + ':' + pass).toString('base64');
}
async function requestViaProxy(method, target, key, bodyBuf, contentType, proxyUrl, rawMode=false, acceptHeader='', requestOptions={}){
  const ctype = contentType || 'application/json';
  return new Promise((resolve,reject)=>{
    let u, p;
    try { u = new URL(target); } catch(e) { return reject(new Error('接口域名格式错误：'+target)); }
    try { p = new URL(proxyUrl); } catch(e) { return reject(new Error('上游代理地址格式错误：'+proxyUrl)); }
    if(p.protocol !== 'http:') return reject(new Error('当前仅支持 HTTP 代理地址（例如 http://127.0.0.1:7890），收到：'+proxyUrl));
    const proxyPort = Number(p.port || 80),targetPort = Number(u.port || (u.protocol === 'http:' ? 80 : 443)),proxyAuth = proxyAuthHeader(p);
    const timeoutMs=Math.max(1000,Number(requestOptions.timeoutMs)||REQUEST_TIMEOUT_MS);
    const finish=(lib,opt)=>{
      if(bodyBuf&&bodyBuf.length)opt.headers['Content-Length']=bodyBuf.length;
      const r=lib.request(opt,rr=>{
        const chunks=[];rr.on('data',d=>chunks.push(d));rr.on('end',()=>{
          let body=Buffer.concat(chunks),enc=String(rr.headers['content-encoding']||'').toLowerCase();
          try{if(enc==='gzip')body=zlib.gunzipSync(body);else if(enc==='deflate')body=zlib.inflateSync(body);else if(enc==='br'&&zlib.brotliDecompressSync)body=zlib.brotliDecompressSync(body);}catch(_e){}
          resolve({status:rr.statusCode||500,headers:rr.headers,body,remoteIp:'via-proxy '+p.host,reusedSocket:!!r.reusedSocket});
        });
      });
      r.on('timeout',()=>{const err=new Error('请求超时（经上游代理 '+Math.round(timeoutMs/1000)+' 秒未响应）');err.code='ETIMEDOUT';r.destroy(err);});
      r.on('error',err=>{const out=new Error('经上游代理请求失败：'+err.message);out.code=err.code||'';out.cause=err;reject(out);});
      if(bodyBuf&&bodyBuf.length)r.write(bodyBuf);r.end();
    };
    if(u.protocol==='http:'){
      const h=rawMode?{'Accept':'*/*','User-Agent':'AI-Studio-V27.9','Host':u.host,'Connection':'keep-alive'}:{'Content-Type':ctype,'Accept':acceptHeader||'application/json','Accept-Encoding':'gzip, deflate, br','Connection':'keep-alive','Host':u.host};if(key)h['Authorization']='Bearer '+key;if(proxyAuth)h['Proxy-Authorization']=proxyAuth;
      return finish(http,{host:p.hostname,port:proxyPort,method,path:target,timeout:timeoutMs,agent:KEEPALIVE.httpProxyAgent(proxyUrl),headers:h});
    }
    const agent=KEEPALIVE.httpsProxyAgent(proxyUrl,target);
    if(!agent)return reject(new Error('当前 HTTPS 目标的连接复用仅支持 http:// 上游代理：'+proxyUrl));
    const h=rawMode?{'Accept':'*/*','User-Agent':'AI-Studio-V27.9','Connection':'keep-alive'}:{'Content-Type':ctype,'Accept':acceptHeader||'application/json','Accept-Encoding':'gzip, deflate, br','Connection':'keep-alive'};if(key)h['Authorization']='Bearer '+key;
    return finish(https,{method,hostname:u.hostname,port:targetPort,path:u.pathname+u.search,timeout:timeoutMs,agent,servername:u.hostname,headers:h});
  });
}
async function requestPublicDownload(target){
  const cleanUrl=String(target||'').replace(/&amp;/g,'&').trim();
  if(!/^https?:\/\//i.test(cleanUrl)) throw new Error('结果下载地址无效');
  const history=[];
  async function once(startUrl, proxyChoice){
    let current=startUrl;
    for(let hop=0;hop<6;hop++){
      let r;
      if(proxyChoice) r=await requestViaProxy('GET',current,'',null,'',proxyChoice,true);
      else r=await requestDirect('GET',current,'',null,'',true);
      const host=(()=>{try{return new URL(current).host}catch(e){return''}})();
      history.push({hop,status:r.status,host,via:proxyChoice?'proxy':'direct'});
      if([301,302,303,307,308].includes(r.status)&&r.headers&&r.headers.location){
        current=new URL(String(r.headers.location),current).toString();
        continue;
      }
      let body=r.body;
      const enc=String((r.headers||{})['content-encoding']||'').toLowerCase();
      try{if(enc.includes('gzip'))body=zlib.gunzipSync(body);else if(enc.includes('deflate'))body=zlib.inflateSync(body);}catch(e){}
      return Object.assign({},r,{body,finalUrl:current,history:history.slice()});
    }
    return{status:508,headers:{},body:Buffer.from('Too many redirects'),finalUrl:current,history:history.slice()};
  }
  let proxyChoice='';
  if(PROXY_URL==='auto') proxyChoice=await resolveAutoProxy(cleanUrl)||'';
  else if(PROXY_URL) proxyChoice=PROXY_URL;
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    last=await once(cleanUrl,proxyChoice);
    if(last.status===200)return Object.assign(last,{attempt});
    if(proxyChoice&&[400,401,403].includes(last.status)){
      last=await once(cleanUrl,'');
      if(last.status===200)return Object.assign(last,{attempt,directFallback:true});
    }
    if(![403,404,429,500,502,503,504].includes(last.status))break;
    await new Promise(r=>setTimeout(r,1000*attempt));
  }
  return last;
}

async function requestExternal(method, target, key, bodyBuf, contentType, acceptHeader='', requestOptions={}){
  if(!PROXY_URL) return requestDirect(method, target, key, bodyBuf, contentType, false, acceptHeader,requestOptions);
  if(PROXY_URL === 'auto'){
    const autoProxy = await resolveAutoProxy(target);
    if(autoProxy) return requestViaProxy(method, target, key, bodyBuf, contentType, autoProxy, false, acceptHeader,requestOptions);
    if(!AUTO_PROXY_MISS_LOGGED){
      AUTO_PROXY_MISS_LOGGED=true;
      console.log('[auto-proxy] no common local proxy detected; trying direct connection.');
    }
    return requestDirect(method, target, key, bodyBuf, contentType, false, acceptHeader,requestOptions);
  }
  return requestViaProxy(method, target, key, bodyBuf, contentType, PROXY_URL, false, acceptHeader,requestOptions);
}
const MICRO_ROUTE_HEALTH=new Map();
function microRouteKey(target,route){return 'micro|'+targetAuthority(target)+'|'+String(route&&route.proxyUrl||route&&route.type||'direct');}
function noteMicroRoute(target,route,ok){
  const key=microRouteKey(target,route),now=Date.now(),old=MICRO_ROUTE_HEALTH.get(key)||{ok:0,fail:0,consecutiveFailures:0,lastSuccess:0,lastFailure:0};
  // V27.9: bounded exponentially-decayed history. A large first-run success count can no longer
  // keep a broken proxy ahead of direct after repeated second-run TLS failures.
  old.ok=Math.min(12,(Number(old.ok)||0)*.72+(ok?1:0));old.fail=Math.min(12,(Number(old.fail)||0)*.72+(ok?0:1));
  if(ok){old.lastSuccess=now;old.consecutiveFailures=0;}else{old.lastFailure=now;old.consecutiveFailures=Math.min(6,(Number(old.consecutiveFailures)||0)+1);}
  MICRO_ROUTE_HEALTH.set(key,old);return old;
}
function microRouteScore(target,route){const h=MICRO_ROUTE_HEALTH.get(microRouteKey(target,route))||{},now=Date.now(),successFresh=h.lastSuccess?Math.max(0,1-(now-h.lastSuccess)/120000):0,failureFresh=h.lastFailure?Math.max(0,1-(now-h.lastFailure)/120000):0;return (Number(h.ok)||0)*4-(Number(h.fail)||0)*8-(Number(h.consecutiveFailures)||0)*18+successFresh*5-failureFresh*10;}
function safePreconnectFailure(error){const t=String((error&&error.message)||error||'')+' '+String(error&&error.code||'');return /before secure TLS connection was established|Client network socket disconnected before secure TLS|TLS.*handshake|SSL routines|ERR_TLS|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(t);}
async function microRouteCandidates(target){
  const routes=[];
  if(PROXY_URL==='auto'){
    const p=await resolveAutoProxy(target);if(p&&!proxyIsTemporarilyBad(target,p))routes.push({type:'proxy',proxyUrl:p,label:'micro-proxy '+p});routes.push({type:'direct',label:'micro-direct'});
  }else if(PROXY_URL){routes.push({type:'proxy',proxyUrl:PROXY_URL,label:'micro-proxy '+PROXY_URL});}
  else routes.push({type:'direct',label:'micro-direct'});
  const dedup=[];for(const r of routes){if(!dedup.some(x=>x.label===r.label))dedup.push(r);}dedup.sort((a,b)=>microRouteScore(target,b)-microRouteScore(target,a));return dedup;
}
async function requestMicroExternal(method,target,key,bodyBuf,contentType,acceptHeader='',requestOptions={}){
  const routes=await microRouteCandidates(target),isWrite=!['GET','HEAD','OPTIONS'].includes(String(method||'GET').toUpperCase()),trace=[];let lastError=null,lastResponse=null;
  for(let i=0;i<routes.length;i++){
    const route=routes[i],started=Date.now();
    try{
      const response=await requestOnRoute(route,method,target,key,bodyBuf,contentType,acceptHeader,requestOptions);lastResponse=response;const ok=response.status>=200&&response.status<400;noteMicroRoute(target,route,ok);trace.push({route:route.label,status:response.status,durationMs:Date.now()-started,error:''});
      response.route=route.label;response.networkTrace=trace.slice();return response;
    }catch(error){lastError=error;const health=noteMicroRoute(target,route,false),info=classifyNetworkError(error),preconnect=safePreconnectFailure(error);let quarantinedMs=0,agentReset=0;
      if(route.type==='proxy'&&info.transient){agentReset=KEEPALIVE.invalidateHttpsProxyAgent?.(route.proxyUrl,target)||0;if(PROXY_URL==='auto'){quarantinedMs=90000;markProxyBad(target,route.proxyUrl,quarantinedMs);}}
      trace.push({route:route.label,status:0,durationMs:Date.now()-started,error:info.message,kind:info.kind,code:info.code,preconnect,quarantinedMs,agentReset,consecutiveFailures:Number(health&&health.consecutiveFailures)||0});
      if(isWrite&&!preconnect){error.networkTrace=trace;error.route=route.label;throw error;}
      if(i===routes.length-1){error.networkTrace=trace;error.route=route.label;throw error;}
    }
  }
  if(lastError)throw lastError;return lastResponse;
}

async function outboundPrimaryRoute(target){
  if(PROXY_URL==='auto'){const p=await resolveAutoProxy(target);return p?{type:'proxy',proxyUrl:p,label:'proxy '+p}:{type:'direct',label:'direct'};}
  if(PROXY_URL)return{type:'proxy',proxyUrl:PROXY_URL,label:'proxy '+PROXY_URL};
  return{type:'direct',label:'direct'};
}
async function requestOnRoute(route,method,target,key,bodyBuf,contentType,acceptHeader,options){
  return route.type==='proxy'?requestViaProxy(method,target,key,bodyBuf,contentType,route.proxyUrl,false,acceptHeader||'',options||{}):requestDirect(method,target,key,bodyBuf,contentType,false,acceptHeader||'',options||{});
}
async function fileUploadRouteCandidates(target,channel='shared'){
  const routes=[];
  if(PROXY_URL==='auto'){
    const p=await resolveAutoProxy(target);
    if(p&&!proxyIsTemporarilyBad(target,p))routes.push({type:'proxy',proxyUrl:p,label:'proxy '+p});
    routes.push({type:'direct',label:'direct'});
  }else if(PROXY_URL){routes.push({type:'proxy',proxyUrl:PROXY_URL,label:'proxy '+PROXY_URL});}
  else routes.push({type:'direct',label:'direct'});
  const dedup=[];for(const r of routes){if(!dedup.some(x=>x.label===r.label))dedup.push(r);}
  dedup.sort((a,b)=>(channel==='micro'?microRouteScore(target,b)-microRouteScore(target,a):fileRouteScore(target,b)-fileRouteScore(target,a)));
  return dedup;
}
async function requestFileUploadResilient(target,key,bodyBuf,contentType,options={}){
  const channel=String(options.channel||'shared'),routes=await fileUploadRouteCandidates(target,channel),trace=[],rounds=Math.max(1,Number(options.rounds)||2),maxAttempts=Math.max(routes.length,Math.min(8,routes.length*rounds)),attemptTimeout=Math.max(5000,Number(options.timeoutMs)||(channel==='micro'?MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS:UPLOAD_ATTEMPT_TIMEOUT_MS));
  let lastResponse=null,lastError=null;
  for(let attempt=1;attempt<=maxAttempts;attempt++){
    const route=routes[(attempt-1)%routes.length],started=Date.now();
    try{
      const response=await requestOnRoute(route,'POST',target,key,bodyBuf,contentType,'application/json',{timeoutMs:attemptTimeout});
      const retryable=isRetryableStatus(response.status);if(channel==='micro')noteMicroRoute(target,route,response.status>=200&&response.status<400);else noteFileRoute(target,route,response.status>=200&&response.status<400);
      trace.push({attempt,route:route.label,status:response.status,durationMs:Date.now()-started,retryable,error:''});
      lastResponse=Object.assign({},response,{attempts:attempt,route:route.label,networkTrace:trace.slice()});
      if(!retryable)return lastResponse;
    }catch(error){
      lastError=error;const info=classifyNetworkError(error);if(channel==='micro')noteMicroRoute(target,route,false);else noteFileRoute(target,route,false);
      if(route.type==='proxy'&&info.transient&&PROXY_URL==='auto')markProxyBad(target,route.proxyUrl);
      trace.push({attempt,route:route.label,status:0,durationMs:Date.now()-started,retryable:info.transient,error:info.message,kind:info.kind,code:info.code});
      if(!info.transient){error.networkTrace=trace;error.attempts=attempt;error.route=route.label;throw error;}
    }
    if(attempt<maxAttempts)await sleep(UPLOAD_RETRY_DELAYS_MS[Math.min(attempt-1,UPLOAD_RETRY_DELAYS_MS.length-1)]||800);
  }
  if(lastResponse)return Object.assign(lastResponse,{networkTrace:trace});
  if(lastError){lastError.networkTrace=trace;lastError.attempts=maxAttempts;throw lastError;}
  return {status:599,headers:{},body:Buffer.from('upload failed'),attempts:maxAttempts,route:'unknown',networkTrace:trace};
}
function parseReferenceCache(id){const hit=V26_EVOLINK_REFERENCE_CACHE.get(id);if(!hit)return null;const expires=Date.parse(String(hit.cacheUntil||''));if(!Number.isFinite(expires)||expires<=Date.now()){try{V26_EVOLINK_REFERENCE_CACHE.remove(id);}catch(_e){}return null;}return hit;}
function saveReferenceCache(id,parsed,meta){const cacheUntil=new Date(safeCacheExpiry(parsed.expiresAt)).toISOString();return V26_EVOLINK_REFERENCE_CACHE.upsert({id,url:parsed.url,downloadUrl:parsed.downloadUrl||'',upstreamExpiresAt:parsed.expiresAt||'',cacheUntil,transport:String(meta.transport||''),route:String(meta.route||''),bytes:Number(meta.bytes)||0,mime:String(meta.mime||'')});}
async function requestReferenceUploadRobust(decoded,key,options={}){
  const id=referenceCacheId(decoded.buffer,key,options.channel||'shared');
  if(!options.skipCache){const hit=parseReferenceCache(id);if(hit&&hit.url)return {status:200,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify({success:true,code:200,msg:'参考图命中本地上传缓存',data:{file_url:hit.url,download_url:hit.downloadUrl||'',expires_at:hit.upstreamExpiresAt||''},local:{cacheHit:true,transport:hit.transport||'cache',route:hit.route||'cache'}})),attempts:0,route:'cache',transport:'cache',cacheHit:true,networkTrace:[]};}
  const streamTarget=EVOLINK_FILES_BASE+'/api/v1/files/upload/stream',mp=buildMultipartFile(decoded.buffer,decoded.mime,decoded.filename);
  let stream=null,streamError=null;
  const uploadChannel=options.channel||'shared',fastMicro=uploadChannel==='micro',uploadRounds=fastMicro?1:2,uploadTimeout=fastMicro?MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS:UPLOAD_ATTEMPT_TIMEOUT_MS;
  try{stream=await requestFileUploadResilient(streamTarget,key,mp.body,mp.contentType,{rounds:uploadRounds,channel:uploadChannel,timeoutMs:uploadTimeout});const parsed=parseFileUploadResponse(stream);if(parsed.success){saveReferenceCache(id,parsed,{transport:'stream',route:stream.route,bytes:decoded.buffer.length,mime:decoded.mime});return Object.assign({},stream,{transport:'stream',cacheHit:false,parsed});}if(!shouldProtocolFallback(stream))return Object.assign({},stream,{transport:'stream',cacheHit:false,parsed});}catch(e){streamError=e;if(!shouldProtocolFallback(e))throw e;}
  const base64Target=EVOLINK_FILES_BASE+'/api/v1/files/upload/base64',base64Body=buildBase64Payload(decoded.buffer,decoded.mime);
  try{const b64=await requestFileUploadResilient(base64Target,key,base64Body,'application/json',{rounds:uploadRounds,channel:uploadChannel,timeoutMs:uploadTimeout});const parsed=parseFileUploadResponse(b64);const combined=[...(stream&&stream.networkTrace||streamError&&streamError.networkTrace||[]),...(b64.networkTrace||[])];if(parsed.success){saveReferenceCache(id,parsed,{transport:'base64-fallback',route:b64.route,bytes:decoded.buffer.length,mime:decoded.mime});return Object.assign({},b64,{transport:'base64-fallback',cacheHit:false,fallbackUsed:true,parsed,networkTrace:combined});}return Object.assign({},b64,{transport:'base64-fallback',cacheHit:false,fallbackUsed:true,parsed,networkTrace:combined});}catch(e){e.networkTrace=[...(stream&&stream.networkTrace||streamError&&streamError.networkTrace||[]),...(e.networkTrace||[])];e.streamFailure=streamError||stream;throw e;}
}
function networkDiagnosisPayload(error){const info=classifyNetworkError(error);return{code:info.kind,message:info.message,retryable:info.transient,proxySetting:PROXY_URL||'direct',resolvedProxy:RESOLVED_PROXY||null,requestTimeoutMs:REQUEST_TIMEOUT_MS,uploadTimeoutMs:UPLOAD_TIMEOUT_MS,uploadAttemptTimeoutMs:UPLOAD_ATTEMPT_TIMEOUT_MS};}
async function runNetworkDiagnostics(key,deep,microChannel=false){
  const result={ok:true,warning:false,version:APP_VERSION,proxySetting:PROXY_URL||'direct',resolvedProxy:RESOLVED_PROXY||null,requestTimeoutMs:REQUEST_TIMEOUT_MS,uploadTimeoutMs:UPLOAD_TIMEOUT_MS,authoritative:'EvoLink API /models + 文件服务 + 参考图上传',steps:[],warnings:[]};
  const add=(name,ok,message,extra={},required=true)=>{
    const severity=ok?'ok':(required?'error':'warning'),item=Object.assign({name,ok:!!ok,required:!!required,severity,message},extra||{});result.steps.push(item);
    if(!ok&&required)result.ok=false;
    if(!ok&&!required){result.warning=true;result.warnings.push(name+'：'+message);}
    return item;
  };
  // Apifox is only a control probe. Its proxy TLS policy can differ from EvoLink and therefore must
  // never override successful authoritative EvoLink checks.
  try{const r=await requestDirect('GET','https://echo.apifox.com/get','',null,'',false,'application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});add('公网直连 / Apifox Echo（辅助探针）',r.status===200,'HTTP '+r.status+(r.status===200?'，直连公网正常':'，辅助探针异常'),{status:r.status,route:'direct',advisory:true},false);}catch(e){const d=networkDiagnosisPayload(e);add('公网直连 / Apifox Echo（辅助探针）',false,d.message,Object.assign({status:0,route:'direct',advisory:true},d),false);}
  try{const primary=await outboundPrimaryRoute('https://echo.apifox.com/get'),r=await requestOnRoute(primary,'GET','https://echo.apifox.com/get','',null,'','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});add('当前代理路径 / Apifox Echo（辅助探针）',r.status===200,'HTTP '+r.status+'，'+primary.label,{status:r.status,route:primary.label,advisory:true},false);}catch(e){const d=networkDiagnosisPayload(e);add('当前代理路径 / Apifox Echo（辅助探针）',false,d.message+'。该结果仅代表 Apifox 控制站点，不代表 EvoLink 不可用。',Object.assign({status:0,advisory:true},d),false);}
  try{const r=await (microChannel?requestMicroExternal:requestExternal)('GET',EVOLINK_BASE+'/models',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});add('EvoLink 生图 API /models（权威）',r.status>=200&&r.status<300,'HTTP '+r.status+'，实际 EvoLink 生图 API 路径'+(r.status<300?'正常':'异常'),{status:r.status,route:r.route||'',trace:r.networkTrace||[],authoritative:true});}catch(e){const d=networkDiagnosisPayload(e);add('EvoLink 生图 API /models（权威）',false,d.message,Object.assign({status:0,trace:e.networkTrace||[],authoritative:true},d));}
  try{const r=await (microChannel?requestMicroExternal:requestExternal)('GET',EVOLINK_FILES_BASE+'/api/v1/files/quota',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});add('EvoLink 文件服务 GET（权威）',r.status>=200&&r.status<300,'HTTP '+r.status+'，文件服务基础连接'+(r.status<300?'正常':'异常'),{status:r.status,route:r.route||'',trace:r.networkTrace||[],authoritative:true});}catch(e){const d=networkDiagnosisPayload(e);add('EvoLink 文件服务 GET（权威）',false,d.message,Object.assign({status:0,trace:e.networkTrace||[],authoritative:true},d));}
  if(deep){
    try{const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64'),r=await requestReferenceUploadRobust({buffer:png,mime:'image/png',filename:'v276-network-probe.png'},key,{skipCache:true,channel:microChannel?'micro':'shared'}),parsed=r.parsed||parseFileUploadResponse(r);add('EvoLink 独立参考图通道（1×1 PNG，权威）',parsed.success,'HTTP '+r.status+'；transport='+(r.transport||'unknown')+'；route='+(r.route||'unknown')+'；attempts='+(r.attempts||0),{status:r.status,route:r.route,transport:r.transport,attempts:r.attempts,trace:r.networkTrace||[],authoritative:true});}catch(e){const d=networkDiagnosisPayload(e);add('EvoLink 独立参考图通道（1×1 PNG，权威）',false,d.message,Object.assign({status:0,trace:e.networkTrace||[],authoritative:true},d));}
    try{const sample=path.join(ROOT,'assets','wolassen','02.jpg'),buf=fs.readFileSync(sample),r=await requestReferenceUploadRobust({buffer:buf,mime:'image/jpeg',filename:'v276-real-reference-probe.jpg'},key,{skipCache:true,channel:microChannel?'micro':'shared'}),parsed=r.parsed||parseFileUploadResponse(r);add('EvoLink 实际参考图上传（800×800，权威）',parsed.success,'HTTP '+r.status+'；'+buf.length+'B；transport='+(r.transport||'unknown')+'；route='+(r.route||'unknown'),{status:r.status,route:r.route,transport:r.transport,attempts:r.attempts,trace:r.networkTrace||[],authoritative:true});}catch(e){const d=networkDiagnosisPayload(e);add('EvoLink 实际参考图上传（800×800，权威）',false,d.message,Object.assign({status:0,trace:e.networkTrace||[],authoritative:true},d));}
  }
  result.resolvedProxy=RESOLVED_PROXY||null;
  result.summary=result.ok?(result.warning?'权威 EvoLink 路径全部通过，但辅助探针存在警告；不影响当前微调链路。':'权威 EvoLink 网络路径全部通过。'):'至少一项权威 EvoLink 网络路径失败，请按失败项处理。';
  return result;
}

const PADDLE_CLOUD = require('./paddleocr_cloud_node')({root:RUNTIME_DATA_ROOT,cfg,requestExternal,requestPublicDownload});


function streamResponseHeaders(upstream){
  const h=headers((upstream&&upstream['content-type'])||'application/json; charset=utf-8');
  delete h['Content-Length'];
  const requestId=upstream&&(upstream['x-request-id']||upstream['request-id']||upstream['x-task-id']);
  if(requestId)h['X-Upstream-Request-Id']=String(requestId);
  h['X-Accel-Buffering']='no';
  return h;
}
function pipeUpstream(rr,res,resolve,reject,label){
  let bytes=0,ended=false;
  const finish=(err)=>{if(ended)return;ended=true;if(err)reject(err);else resolve({status:rr.statusCode||500,bytes});};
  try{res.writeHead(rr.statusCode||500,streamResponseHeaders(rr.headers||{}));}catch(e){return finish(e);}
  rr.on('data',d=>{bytes+=d.length;try{res.write(d);}catch(e){try{rr.destroy();}catch(_e){}finish(e);}});
  rr.on('end',()=>{try{res.end();}catch(e){}finish();});
  rr.on('error',finish);
  res.on('close',()=>{if(!ended){try{rr.destroy();}catch(e){}}});
}
function requestDirectStream(method,target,key,bodyBuf,contentType,res){
  return new Promise((resolve,reject)=>{let u;try{u=new URL(target);}catch(e){return reject(new Error('接口域名格式错误：'+target));}const lib=u.protocol==='http:'?http:https;const opt={method,hostname:u.hostname,port:u.port||(u.protocol==='http:'?80:443),path:u.pathname+u.search,timeout:300000,headers:{'Content-Type':contentType||'application/json','Accept':'text/event-stream, application/x-ndjson, application/json'}};if(key)opt.headers['Authorization']='Bearer '+key;if(FORCE_IP){opt.lookup=makeLookup(FORCE_IP);opt.servername=u.hostname;opt.autoSelectFamily=false;}if(bodyBuf&&bodyBuf.length)opt.headers['Content-Length']=bodyBuf.length;const r=lib.request(opt,rr=>pipeUpstream(rr,res,resolve,reject,'direct'));r.on('timeout',()=>r.destroy(new Error('流式请求超时：外部 API 300 秒内未完成')));r.on('error',reject);if(bodyBuf&&bodyBuf.length)r.write(bodyBuf);r.end();});
}
function requestViaProxyStream(method,target,key,bodyBuf,contentType,proxyUrl,res){
  return new Promise((resolve,reject)=>{let u,p;try{u=new URL(target);p=new URL(proxyUrl);}catch(e){return reject(e);}if(p.protocol!=='http:')return reject(new Error('流式通道当前仅支持 HTTP 代理地址'));const proxyPort=Number(p.port||80),targetPort=Number(u.port||(u.protocol==='http:'?80:443)),proxyAuth=proxyAuthHeader(p);
    if(u.protocol==='http:'){const h={'Content-Type':contentType||'application/json','Accept':'text/event-stream, application/x-ndjson, application/json','Host':u.host};if(key)h['Authorization']='Bearer '+key;if(proxyAuth)h['Proxy-Authorization']=proxyAuth;if(bodyBuf&&bodyBuf.length)h['Content-Length']=bodyBuf.length;const r=http.request({host:p.hostname,port:proxyPort,method,path:target,timeout:300000,headers:h},rr=>pipeUpstream(rr,res,resolve,reject,'proxy-http'));r.on('timeout',()=>r.destroy(new Error('流式请求经代理超时')));r.on('error',reject);if(bodyBuf&&bodyBuf.length)r.write(bodyBuf);r.end();return;}
    const connectHeaders={Host:u.hostname+':'+targetPort};if(proxyAuth)connectHeaders['Proxy-Authorization']=proxyAuth;const cr=http.request({host:p.hostname,port:proxyPort,method:'CONNECT',path:u.hostname+':'+targetPort,headers:connectHeaders,timeout:300000});cr.on('connect',(cres,socket,head)=>{if(cres.statusCode!==200){socket.destroy();return reject(new Error('上游代理 CONNECT 失败：HTTP '+cres.statusCode));}if(head&&head.length)socket.unshift(head);const h={'Content-Type':contentType||'application/json','Accept':'text/event-stream, application/x-ndjson, application/json'};if(key)h['Authorization']='Bearer '+key;if(bodyBuf&&bodyBuf.length)h['Content-Length']=bodyBuf.length;const r=https.request({method,hostname:u.hostname,port:targetPort,path:u.pathname+u.search,agent:false,servername:u.hostname,timeout:300000,headers:h,createConnection:()=>tls.connect({socket,servername:u.hostname,rejectUnauthorized:process.env.NODE_TLS_REJECT_UNAUTHORIZED!=='0'})},rr=>pipeUpstream(rr,res,resolve,reject,'proxy-https'));r.on('timeout',()=>r.destroy(new Error('流式请求经代理超时')));r.on('error',reject);if(bodyBuf&&bodyBuf.length)r.write(bodyBuf);r.end();});cr.on('timeout',()=>cr.destroy(new Error('连接上游代理超时')));cr.on('error',reject);cr.end();});
}
async function requestExternalStream(method,target,key,bodyBuf,contentType,res){let proxyChoice='';if(PROXY_URL==='auto')proxyChoice=await resolveAutoProxy(target)||'';else if(PROXY_URL)proxyChoice=PROXY_URL;return proxyChoice?requestViaProxyStream(method,target,key,bodyBuf,contentType,proxyChoice,res):requestDirectStream(method,target,key,bodyBuf,contentType,res);}

async function proxy(req, res){
  if(req.method === 'OPTIONS') return send(res, 204, '');
  const requestUrl = new URL(req.url, 'http://127.0.0.1');
  const rawApiPath = requestUrl.pathname.replace(/^\/api/, '');
  const microChannel = rawApiPath==='/micro'||rawApiPath.startsWith('/micro/');
  const apiPath = microChannel ? (rawApiPath.slice('/micro'.length)||'/') : rawApiPath;
  if(apiPath === '/health' && req.method === 'GET'){
    const assetState=wireframeAssetStatus(); return send(res, 200, JSON.stringify({ok:true, version:APP_VERSION, buildId:BUILD_ID, runtime:RUNTIME_KIND, rootPath:HOSTED_RUNTIME?'serverless-bundle':ROOT, assetsReady:assetState.assetsReady, missingAssets:assetState.missing, proxy:'node', port:HOSTED_RUNTIME?null:PORT, forceHostIp:FORCE_IP||null, proxyUrl:PROXY_URL||null, resolvedProxy:RESOLVED_PROXY||null, accessRequired:!!ACCESS_CODE, accessGranted:accessGranted(req), serverManaged:{evolink:!!String(process.env.EVOLINK_API_KEY||'').trim(),coze:!!String(process.env.COZE_API_TOKEN||'').trim(),paddleocr:!!String(process.env.PADDLEOCR_ACCESS_TOKEN||'').trim()}, persistence:{mode:HOSTED_RUNTIME?'ephemeral-serverless':'local-json',shared:false,durable:!HOSTED_RUNTIME}, limits:{functionBodyBytes:HOSTED_RUNTIME?4500000:null,largeImageHint:HOSTED_RUNTIME?'线上函数请求体不得超过 4.5MB；V29 会在浏览器端提前拦截并提示压缩。':''}, generationChannels:{copy:{provider:'coze',isolated:true,endpointPrefix:'/api/copy-coze/'},wireframe:{provider:'evolink-image',isolatedFromCopy:true,endpointPrefix:'/api/'},image:{provider:'evolink-image',isolatedFromCopy:true,endpointPrefix:'/api/'},referenceUpload:{provider:'evolink-files',isolatedFromGeneration:true,endpointPrefix:'/api/evolink/files/upload/'},adjust:{provider:'evolink-image-micro-adjust',isolatedFromCopy:true,isolatedFromSharedImageConfig:true,isolatedFromConflictRisk:true,conflictRiskMode:'advisory-only',channelHeader:'micro-adjust-v27.8',instructionRegression:true,baseUrl:EVOLINK_BASE,defaultModel:'gemini-3.1-flash-lite-image',diagnose:'/api/micro/diagnose',deepDiagnose:'/api/micro/network-diagnose?deep=1',endpointPrefix:'/api/micro/',routeIsolation:true,pollSoftTimeoutMs:MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS,pollTimeoutMs:MICRO_ADJUST_POLL_TIMEOUT_MS,pollMaxTimeoutMs:MICRO_ADJUST_POLL_MAX_TIMEOUT_MS,pollGetRetryAttempts:3,sameTaskPolling:true,proxyTlsRecovery:true,diagnosticAdvisoryProbes:true,keepAlive:true,uploadConcurrency:2,adaptivePolling:true,fastReferencePlan:true,referencePlan:'source+layout-mask-guide+text-fidelity-v280',diagnosticCacheMs:300000,creditCacheMs:60000,fullDiagnosticsOnlyOnTestOrCacheExpiry:true,clickToImagePerformance:true,taskLifecycle:true,directHandoff:true,handoffAcknowledgementGate:true,handoffAckMode:'synchronous-before-provider',handoffAckTimeoutMs:0,sequentialRunIsolation:true,staleRunRecoveryMs:MICRO_RUN_STALE_MS}}}));
  }
  if(!accessGranted(req))return send(res,401,JSON.stringify({ok:false,error:{code:'app_access_required',message:'请输入 V29 线上访问口令后继续使用。'}}));
  if(apiPath === '/image-export/source' && req.method === 'GET'){
    const startedAt=Date.now(),raw=String(requestUrl.searchParams.get('url')||'').trim();
    try{
      const u=new URL(raw);if(!['http:','https:'].includes(u.protocol)||isPrivateImageExportHost(u.hostname))return send(res,400,JSON.stringify({ok:false,error:{message:'图片下载代理仅允许公网 HTTP(S) 图片地址'}}));
      const out=await readExportRemoteBinary(u.toString());
      const mime=imageMimeFromBinary(out.body,out.contentType,out.finalUrl);
      pushServerLog({method:'GET',path:'/api/image-export/source',status:200,durationMs:Date.now()-startedAt,channel:'image export',message:'远程图片已通过本地代理读取'});
      res.writeHead(200,Object.assign(headers(mime),{'Cache-Control':'no-store','Content-Length':out.body.length,'X-Content-Type-Options':'nosniff'}));return res.end(out.body);
    }catch(e){pushServerLog({method:'GET',path:'/api/image-export/source',status:502,durationMs:Date.now()-startedAt,channel:'image export',message:e.message});return send(res,502,JSON.stringify({ok:false,error:{message:'读取远程图片失败：'+e.message}}));}
  }
  if(apiPath === '/wireframe-assets/status' && req.method === 'GET'){
    const result=wireframeAssetStatus();
    pushServerLog({method:'GET',path:'/api/wireframe-assets/status',status:result.assetsReady?200:503,durationMs:0,channel:'local assets',message:result.assetsReady?'18 张内置线框素材已就绪':('缺少线框素材：'+result.missing.join(', '))});
    return send(res,result.assetsReady?200:503,JSON.stringify(result));
  }
  if(apiPath === '/config' && req.method === 'GET'){
    const managedKey=!!String(process.env.EVOLINK_API_KEY||'').trim();
    return send(res, 200, JSON.stringify({baseUrl:String(process.env.EVOLINK_BASE_URL||cfg.baseUrl||EVOLINK_BASE), keyLoaded:managedKey||!!cfg.apiKey, keySource:managedKey?'environment':'browser-or-local-config', runtime:RUNTIME_KIND, port:HOSTED_RUNTIME?null:PORT, forceHostIp:FORCE_IP||null, proxyUrl:PROXY_URL||null, resolvedProxy:RESOLVED_PROXY||null}));
  }
  if(apiPath === '/logs' && req.method === 'GET'){
    return send(res, 200, JSON.stringify({ok:true,version:APP_VERSION,logs:SERVER_LOGS.slice(0,200)}));
  }
  if(apiPath === '/logs' && req.method === 'DELETE'){
    SERVER_LOGS.length=0;
    pushServerLog({method:'DELETE',path:'/api/logs',status:200,durationMs:0,channel:'local',message:'后台日志已清空'});
    return send(res, 200, JSON.stringify({ok:true,cleared:true}));
  }
  if(apiPath === '/paddleocr-cloud/status' && req.method === 'GET'){
    const startedAt=Date.now();
    const result=PADDLE_CLOUD.status();result.launcher='node';
    pushServerLog({method:'GET',path:'/api/paddleocr-cloud/status',status:200,durationMs:Date.now()-startedAt,channel:'cloud paddleocr',message:result.message||'PaddleOCR 云端配置检查'});
    return send(res,200,JSON.stringify(result));
  }
  if(apiPath === '/paddleocr-cloud/queue-status' && req.method === 'GET'){
    const requestId=String(requestUrl.searchParams.get('requestId')||'').trim();
    const result=PADDLE_CLOUD.queueStatus(requestId);result.launcher='node';
    return send(res,200,JSON.stringify(result));
  }
  if(apiPath === '/paddleocr-cloud/config' && req.method === 'POST'){
    const startedAt=Date.now();
    try{
      const body=await readBody(req);let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(e){return send(res,400,JSON.stringify({ok:false,error:{code:'invalid_json',message:'令牌配置 JSON 无效'}}));}
      const result=PADDLE_CLOUD.configure(payload),code=result.ok?200:400;
      pushServerLog({method:'POST',path:'/api/paddleocr-cloud/config',status:code,durationMs:Date.now()-startedAt,channel:'cloud paddleocr',message:result.message||((result.error||{}).message||'PaddleOCR 云端令牌配置')});
      return send(res,code,JSON.stringify(result));
    }catch(e){
      pushServerLog({method:'POST',path:'/api/paddleocr-cloud/config',status:500,durationMs:Date.now()-startedAt,channel:'cloud paddleocr',message:e.message});
      return send(res,500,JSON.stringify({ok:false,error:{code:'token_config_failed',message:'令牌配置失败：'+e.message}}));
    }
  }
  if(apiPath === '/paddleocr-cloud/recognize' && req.method === 'POST'){
    const startedAt=Date.now();
    try{
      const body=await readBody(req);if(body.length>50*1024*1024)return send(res,413,JSON.stringify({ok:false,error:{code:'payload_too_large',message:'识别图片请求超过 50MB'}}));
      let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(e){return send(res,400,JSON.stringify({ok:false,error:{code:'invalid_json',message:'PaddleOCR 云端请求 JSON 无效'}}));}
      const result=await PADDLE_CLOUD.recognize(payload),errCode=(result.error||{}).code;
      const code=result.ok?200:(['token_not_configured','auth_failed'].includes(errCode)?401:errCode==='invalid_submit_request'?400:errCode==='quota_or_rate_limit'?429:503);
      pushServerLog({method:'POST',path:'/api/paddleocr-cloud/recognize',status:code,durationMs:Date.now()-startedAt,channel:'cloud paddleocr',message:result.message||((result.error||{}).message||'PaddleOCR 云端识别完成')});
      return send(res,code,JSON.stringify(result));
    }catch(e){
      pushServerLog({method:'POST',path:'/api/paddleocr-cloud/recognize',status:500,durationMs:Date.now()-startedAt,channel:'cloud paddleocr',message:e.message});
      return send(res,500,JSON.stringify({ok:false,error:{code:'cloud_ocr_error',message:'PaddleOCR 云端识别失败：'+e.message}}));
    }
  }
  if(apiPath === '/copy-coze/status' && req.method === 'GET'){
    return send(res,200,JSON.stringify(copyCozeStatus()));
  }
  if(apiPath === '/copy-coze/config' && req.method === 'POST'){
    const startedAt=Date.now();
    try{
      const body=await readBody(req);let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(_e){return send(res,400,JSON.stringify({ok:false,error:{code:'invalid_json',message:'令牌配置 JSON 无效'}}));}
      const result=COPY_COZE_TOKENS.configure(payload),code=result.ok?200:400;
      pushServerLog({method:'POST',path:'/api/copy-coze/config',status:code,durationMs:Date.now()-startedAt,channel:'copy/coze token',message:result.message||((result.error||{}).message||'扣子令牌配置')});
      return send(res,code,JSON.stringify(result));
    }catch(e){
      pushServerLog({method:'POST',path:'/api/copy-coze/config',status:500,durationMs:Date.now()-startedAt,channel:'copy/coze token',message:e.message});
      return send(res,500,JSON.stringify({ok:false,error:{code:'token_config_failed',message:'扣子令牌配置失败：'+e.message}}));
    }
  }
  if(apiPath === '/copy-coze/test' && req.method === 'POST'){
    const startedAt=Date.now();try{const body=await readBody(req);let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(e){}const out=await callCopyCoze(payload.botId,'请只回复四个字：连接正常');const result={ok:true,status:out.status,durationMs:Date.now()-startedAt,reply:out.reply,model:String(out.bot.id),modelLabel:String(out.bot.label||'扣子文案智能体'),transport:out.transport||'sse',eventCount:out.eventCount||0,requestId:out.requestId||'',logId:out.logId||'',message:'扣子文案 Bot API 连接正常'};pushServerLog({method:'POST',path:'/api/copy-coze/test',status:200,durationMs:result.durationMs,channel:'copy/coze isolated',message:result.message});return send(res,200,JSON.stringify(result));}catch(e){pushServerLog({method:'POST',path:'/api/copy-coze/test',status:e.status||500,durationMs:Date.now()-startedAt,channel:'copy/coze isolated',message:e.message+((e.requestId||e.logId)?(' · requestId='+(e.requestId||'')+' logId='+(e.logId||'')):'')});return send(res,e.status||500,JSON.stringify({ok:false,error:cozeErrorPayload(e)}));}
  }
  if(apiPath === '/copy-coze/generate' && req.method === 'POST'){
    const startedAt=Date.now();try{const body=await readBody(req);if(body.length>2*1024*1024)return send(res,413,JSON.stringify({ok:false,error:{message:'文案请求超过 2MB'}}));let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(e){return send(res,400,JSON.stringify({ok:false,error:{message:'文案请求 JSON 无效'}}));}if(!String(payload.productInfo||'').trim())return send(res,400,JSON.stringify({ok:false,error:{message:'产品信息不能为空'}}));const out=await callCopyCoze(payload.botId,copyPrompt(payload.productInfo,payload.jsonPrompt));const fieldAudit=auditCopyReturn(out.reply);const result={ok:true,status:out.status,durationMs:Date.now()-startedAt,content:out.reply,model:String(out.bot.id),modelLabel:String(out.bot.label||'扣子文案智能体'),provider:'coze',isolated:true,transport:out.transport||'sse',eventCount:out.eventCount||0,requestId:out.requestId||'',logId:out.logId||'',fieldAudit};pushServerLog({method:'POST',path:'/api/copy-coze/generate',status:200,durationMs:result.durationMs,channel:'copy/coze isolated',message:'扣子文案生成完成 · '+fieldAudit.summary,fieldAudit});return send(res,200,JSON.stringify(result));}catch(e){pushServerLog({method:'POST',path:'/api/copy-coze/generate',status:e.status||500,durationMs:Date.now()-startedAt,channel:'copy/coze isolated',message:e.message+((e.requestId||e.logId)?(' · requestId='+(e.requestId||'')+' logId='+(e.logId||'')):'')});return send(res,e.status||500,JSON.stringify({ok:false,error:cozeErrorPayload(e)}));}
  }

  // V26 本地持久化：线框历史与 EvoLink 生图任务中心均使用零依赖 JSON 仓库，
  // 不要求用户安装数据库。图片本体会落盘到 data/v26，避免上游临时 URL 过期后历史无法预览。
  if(apiPath === '/wireframe-history' && req.method === 'GET'){
    const limit=Math.max(1,Math.min(120,Number(requestUrl.searchParams.get('limit'))||60));
    return send(res,200,JSON.stringify({ok:true,version:APP_VERSION,items:V26_WIRE_HISTORY.list({limit})}));
  }
  if(apiPath === '/wireframe-history' && req.method === 'POST'){
    const startedAt=Date.now();
    try{
      const body=await readBody(req);if(body.length>48*1024*1024)return send(res,413,JSON.stringify({ok:false,error:{message:'线框历史写入请求超过 48MB'}}));
      let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(_e){return send(res,400,JSON.stringify({ok:false,error:{message:'线框历史 JSON 无效'}}));}
      const id=safeId(payload.id||('wire-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)));
      const old=V26_WIRE_HISTORY.get(id);let src=String(payload.src||old&&old.src||'').trim();
      if(src&&!src.startsWith('/api/wireframe-history/assets/'))src=await materializeWireHistoryImage(src,id);
      const item=V26_WIRE_HISTORY.upsert({
        id,label:String(payload.label||old&&old.label||'未命名线框').slice(0,180),time:String(payload.time||old&&old.time||new Date().toLocaleString('zh-CN')).slice(0,80),
        groupId:String(payload.groupId||old&&old.groupId||'').slice(0,140),poster:String(payload.poster||old&&old.poster||'').slice(0,20000),frameName:String(payload.frameName||old&&old.frameName||'').slice(0,260),
        src,model:String(payload.model||old&&old.model||'').slice(0,180),prompt:String(payload.prompt||old&&old.prompt||'').slice(0,30000),status:String(payload.status||old&&old.status||'completed').slice(0,40),
        sourceTaskId:String(payload.sourceTaskId||old&&old.sourceTaskId||'').slice(0,180)
      });
      if(old&&old.src&&old.src!==item.src)removeWireHistoryAsset(old);
      pushServerLog({method:'POST',path:'/api/wireframe-history',status:200,durationMs:Date.now()-startedAt,channel:'local persistence',message:'AI 线框历史已持久化：'+item.id});
      return send(res,200,JSON.stringify({ok:true,item}));
    }catch(e){pushServerLog({method:'POST',path:'/api/wireframe-history',status:500,durationMs:Date.now()-startedAt,channel:'local persistence',message:e.message});return send(res,500,JSON.stringify({ok:false,error:{message:'线框历史保存失败：'+e.message}}));}
  }
  const wireDelete=apiPath.match(/^\/wireframe-history\/([^/]+)$/);
  if(wireDelete && req.method === 'DELETE'){
    const id=decodeURIComponent(wireDelete[1]),old=V26_WIRE_HISTORY.get(id);if(old)removeWireHistoryAsset(old);const removed=V26_WIRE_HISTORY.remove(id);return send(res,200,JSON.stringify({ok:true,removed,id}));
  }
  const wireAsset=apiPath.match(/^\/wireframe-history\/assets\/([^/]+)$/);
  if(wireAsset && req.method === 'GET'){
    const file=decodeURIComponent(wireAsset[1]),full=path.resolve(V26_WIRE_HISTORY_ASSET_DIR,file);
    if(!full.startsWith(V26_WIRE_HISTORY_ASSET_DIR+path.sep)||!fs.existsSync(full))return send(res,404,'not found','text/plain; charset=utf-8');
    const ext=path.extname(full).toLowerCase(),mime=ext==='.jpg'||ext==='.jpeg'?'image/jpeg':ext==='.webp'?'image/webp':ext==='.gif'?'image/gif':'image/png';
    res.writeHead(200,Object.assign(headers(mime),{'Cache-Control':'no-store','Content-Length':fs.statSync(full).size}));return fs.createReadStream(full).pipe(res);
  }
  if(apiPath === '/image-tasks' && req.method === 'GET'){
    const limit=Math.max(1,Math.min(600,Number(requestUrl.searchParams.get('limit'))||200));return send(res,200,JSON.stringify({ok:true,version:APP_VERSION,items:V26_IMAGE_TASKS.list({limit})}));
  }
  if(apiPath === '/image-tasks' && req.method === 'POST'){
    const startedAt=Date.now();try{
      const body=await readBody(req);if(body.length>2*1024*1024)return send(res,413,JSON.stringify({ok:false,error:{message:'生图任务记录超过 2MB'}}));let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(_e){return send(res,400,JSON.stringify({ok:false,error:{message:'生图任务记录 JSON 无效'}}));}
      const rawId=payload.id||payload.taskId||payload.task_id;if(!rawId)return send(res,400,JSON.stringify({ok:false,error:{message:'生图任务缺少 task_id'}}));const id=safeId(rawId),old=V26_IMAGE_TASKS.get(id)||{};
      const item=V26_IMAGE_TASKS.upsert({id,taskId:String(payload.taskId||payload.task_id||old.taskId||rawId).slice(0,220),model:String(payload.model||old.model||'').slice(0,180),prompt:String(payload.prompt||old.prompt||'').slice(0,30000),stage:String(payload.stage||old.stage||'AI 生图').slice(0,120),submittedAt:String(payload.submittedAt||old.submittedAt||new Date().toISOString()).slice(0,80),status:String(payload.status||old.status||'queued').toLowerCase().slice(0,40),progress:Number.isFinite(Number(payload.progress))?Number(payload.progress):(Number(old.progress)||0),error:String(payload.error||old.error||'').slice(0,6000),resultUrls:Array.isArray(payload.resultUrls)?payload.resultUrls.filter(Boolean).map(String).slice(0,20):(old.resultUrls||[]),unitIndex:Number.isFinite(Number(payload.unitIndex))?Number(payload.unitIndex):(old.unitIndex??null),units:Number.isFinite(Number(payload.units))?Number(payload.units):(old.units??null),source:String(payload.source||old.source||'evolink').slice(0,80)});
      pushServerLog({method:'POST',path:'/api/image-tasks',status:200,durationMs:Date.now()-startedAt,channel:'local persistence',message:'生图任务已更新：'+item.taskId+' '+item.status});return send(res,200,JSON.stringify({ok:true,item}));
    }catch(e){return send(res,500,JSON.stringify({ok:false,error:{message:'生图任务保存失败：'+e.message}}));}
  }
  const taskDelete=apiPath.match(/^\/image-tasks\/([^/]+)$/);
  if(taskDelete && req.method === 'DELETE'){const id=decodeURIComponent(taskDelete[1]);return send(res,200,JSON.stringify({ok:true,removed:V26_IMAGE_TASKS.remove(id),id}));}
  const startedAt = Date.now();
  const {baseUrl, key} = getCfg(req);
  if(!baseUrl || !key){
    pushServerLog({method:req.method,path:'/api'+apiPath,status:400,durationMs:Date.now()-startedAt,channel:'local proxy',message:'缺少 Base URL 或 API Key'});
    return send(res, 400, JSON.stringify({error:{message:'缺少 Base URL 或 API Key，请在网页配置中填写'}}));
  }
  try{
    if((apiPath === '/evolink/files/upload/reference'||apiPath === '/evolink/files/upload/base64') && req.method === 'POST'){
      const localPath='/api'+(microChannel?'/micro':'')+apiPath;
      const body=await readBody(req);if(body.length>75*1024*1024)return send(res,413,JSON.stringify({error:{message:'EvoLink 参考图上传请求超过 75MB'}}));
      try{
        let payload={};try{payload=JSON.parse(body.toString('utf8')||'{}');}catch(_e){return send(res,400,JSON.stringify({error:{code:'invalid_upload_payload',message:'参考图上传 JSON 无法解析'}}));}
        const decoded=decodeImageDataUrl(payload.base64_data||payload.base64Data||'');if(decoded.buffer.length>50*1024*1024)return send(res,413,JSON.stringify({error:{code:'image_too_large',message:'参考图原始文件超过 50MB'}}));
        if(payload.file_name||payload.fileName)decoded.filename=String(payload.file_name||payload.fileName).slice(0,100);
        const r=await requestReferenceUploadRobust(decoded,key,{skipCache:payload.skip_cache===true||payload.skipCache===true,channel:microChannel?'micro':'shared'}),parsed=r.parsed||parseFileUploadResponse(r),ok=parsed.success||r.cacheHit;
        pushServerLog({method:'POST',path:localPath,status:r.status,durationMs:Date.now()-startedAt,channel:'evolink/files reference-isolated',message:(ok?'参考图上传可用':'EvoLink 参考图上传失败')+'；transport='+(r.transport||'unknown')+'；cache='+(r.cacheHit?'hit':'miss')+'；原图 '+decoded.buffer.length+'B；尝试 '+(r.attempts||0)+' 次；路径 '+(r.route||'unknown')});
        let out;try{out=JSON.parse(r.body.toString('utf8')||'{}');}catch(_e){out={raw:r.body.toString('utf8')};}if(out&&typeof out==='object')out.local=Object.assign({},out.local||{},{referenceUploadChannel:'isolated',transport:r.transport||'',route:r.route||'',cacheHit:!!r.cacheHit,fallbackUsed:!!r.fallbackUsed,attempts:r.attempts||0});
        return send(res,r.status,JSON.stringify(out));
      }catch(e){
        const d=networkDiagnosisPayload(e),msg=d.code==='connection_reset'?'EvoLink 参考图文件通道连接被中途断开。V27 已将参考图上传与生图任务通道隔离，并会在 stream 上传失败后切换官方 Base64 上传，同时按 files-api 域名单独选择代理/直连路径；本次所有安全上传路径均失败，请运行“深度网络诊断”查看每条传输轨迹。':'EvoLink 参考图文件通道失败：'+e.message;
        pushServerLog({method:'POST',path:localPath,status:502,durationMs:Date.now()-startedAt,channel:'evolink/files reference-isolated',message:msg+'；trace='+JSON.stringify(e.networkTrace||[]).slice(0,1800)});return send(res,502,JSON.stringify({error:{code:d.code,message:msg,retryable:d.retryable,diagnosis:d,trace:e.networkTrace||[],channel:'evolink-files/reference'}}));
      }
    }
    if(apiPath === '/network-diagnose' && req.method === 'POST' && isEvolinkBase(baseUrl)){
      try{const deep=requestUrl.searchParams.get('deep')==='1',out=await runNetworkDiagnostics(key,deep,microChannel);pushServerLog({method:'POST',path:'/api/network-diagnose',status:out.ok?200:207,durationMs:Date.now()-startedAt,channel:'network-diagnose',message:'网络诊断 '+(out.ok?'通过':'发现异常')+'；deep='+(deep?'1':'0')});return send(res,200,JSON.stringify(out));}
      catch(e){pushServerLog({method:'POST',path:'/api/network-diagnose',status:500,durationMs:Date.now()-startedAt,channel:'network-diagnose',message:e.message});return send(res,200,JSON.stringify({ok:false,version:APP_VERSION,steps:[{name:'网络诊断',ok:false,message:e.message}],diagnosis:networkDiagnosisPayload(e)}));}
    }
    if(apiPath === '/credits' && req.method === 'GET' && isEvolinkBase(baseUrl)){
      try{
        const r=await (microChannel?requestMicroExternal:requestExternal)('GET',normalizeEvolinkBase(baseUrl)+'/credits',key,null);
        let parsed={};try{parsed=JSON.parse(r.body.toString('utf8')||'{}');}catch(_e){}
        const billing=evolinkCreditsPayload(parsed,r.status);
        pushServerLog({method:'GET',path:'/api/credits',status:r.status,durationMs:Date.now()-startedAt,channel:'evolink/credits preflight',message:billing.blocked?'Credits 不足，已阻止计费生图':(billing.checked?'Credits 生图预检通过':'Credits 查询失败')});
        res.writeHead(r.status,Object.assign(headers(r.headers['content-type']||'application/json; charset=utf-8'),{'Cache-Control':'no-store'}));return res.end(r.body);
      }catch(e){
        pushServerLog({method:'GET',path:'/api/credits',status:500,durationMs:Date.now()-startedAt,channel:'evolink/credits preflight',message:e.message});
        return send(res,500,JSON.stringify({error:{code:'credits_check_failed',message:'EvoLink Credits 查询失败：'+e.message}}));
      }
    }
    if(apiPath === '/model-capabilities' && req.method === 'GET' && isEvolinkBase(baseUrl)){
      try{
        const force=requestUrl.searchParams.get('refresh')==='1',catalog=await fetchEvolinkModelCatalog(baseUrl,key,force),payload=evolinkCapabilityPayload(catalog.rows,catalog.cached?'evolink-models-cache':'evolink-models-live');
        pushServerLog({method:'GET',path:'/api/model-capabilities',status:200,durationMs:Date.now()-startedAt,channel:'evolink/models capabilities',message:'动态能力目录 '+payload.capabilities.length+' 个模型'+(catalog.cached?'（缓存）':'（实时）')});
        return send(res,200,JSON.stringify(payload));
      }catch(error){
        const rows=evolinkModelPayload().data,payload=evolinkCapabilityPayload(rows,'builtin-fallback');payload.ok=false;payload.warning='EvoLink 远端模型目录不可用：'+error.message;
        pushServerLog({method:'GET',path:'/api/model-capabilities',status:200,durationMs:Date.now()-startedAt,channel:'evolink/models capabilities fallback',message:payload.warning});
        return send(res,200,JSON.stringify(payload));
      }
    }
    if(apiPath === '/models' && req.method === 'GET' && isEvolinkBase(baseUrl)){
      if(microChannel){
        try{const r=await requestMicroExternal('GET',normalizeEvolinkBase(baseUrl)+'/models',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});pushServerLog({method:'GET',path:'/api/micro/models',status:r.status,durationMs:Date.now()-startedAt,channel:'micro/evolink-models '+(r.route||''),message:r.status>=200&&r.status<300?'微调模型目录实时连通':'微调模型目录返回错误'});res.writeHead(r.status,headers(r.headers['content-type']||'application/json; charset=utf-8'));return res.end(r.body);}catch(e){pushServerLog({method:'GET',path:'/api/micro/models',status:502,durationMs:Date.now()-startedAt,channel:'micro/evolink-models',message:e.message});return send(res,502,JSON.stringify({error:{code:'micro_models_unreachable',message:'微调专用模型目录无法连接：'+e.message,channel:'micro-adjust'}}));}
      }
      try{const catalog=await fetchEvolinkModelCatalog(baseUrl,key,false);pushServerLog({method:'GET',path:'/api/models',status:200,durationMs:Date.now()-startedAt,channel:'evolink/models',message:'使用 EvoLink '+(catalog.cached?'缓存':'实时')+'模型目录'});res.writeHead(200,headers('application/json; charset=utf-8'));return res.end(JSON.stringify(catalog.raw));}catch(_e){}
      pushServerLog({method:'GET',path:'/api/models',status:200,durationMs:Date.now()-startedAt,channel:'evolink/models fallback',message:'远端模型目录不可用，返回 V27 内置图像模型目录'});return send(res,200,JSON.stringify(evolinkModelPayload()));
    }
    if(apiPath === '/diagnose' && req.method === 'POST'){
      if(isEvolinkBase(baseUrl)){
        try{
          const outbound=microChannel?requestMicroExternal:requestExternal;
          const [fileQuota,creditsResp]=await Promise.all([
            outbound('GET',EVOLINK_FILES_BASE+'/api/v1/files/quota',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS}),
            outbound('GET',normalizeEvolinkBase(baseUrl)+'/credits',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS})
          ]);let fileParsed={};try{fileParsed=JSON.parse(fileQuota.body.toString('utf8')||'{}');}catch(_e){}
          const fileOk=fileQuota.status>=200&&fileQuota.status<300;
          let creditsParsed={};try{creditsParsed=JSON.parse(creditsResp.body.toString('utf8')||'{}');}catch(_e){}
          const billing=evolinkCreditsPayload(creditsParsed,creditsResp.status),authOk=fileOk&&creditsResp.status!==401&&creditsResp.status!==403;
          let message='';
          if(!fileOk)message='EvoLink 文件通道连接失败：HTTP '+fileQuota.status+' '+fileQuota.body.toString('utf8').slice(0,260);
          else if(creditsResp.status<200||creditsResp.status>=300)message='EvoLink 基础连接正常，但账户 Credits 查询失败：HTTP '+creditsResp.status+' '+creditsResp.body.toString('utf8').slice(0,260);
          else if(billing.blocked)message='EvoLink API Key 与文件通道可用，但当前账户/Token Credits 不足，生图请求会返回 HTTP 402；请充值或调整 Token 额度后再生成。';
          else message='EvoLink API Key、图像文件通道与账户 Credits 检查通过；V27 会在生成前再次检查额度。该诊断不会提交计费生图任务。';
          let models=evolinkModelPayload().data,capabilities=evolinkCapabilityPayload(models,'builtin').capabilities,modelCatalogSource='builtin';
          if(authOk){try{if(microChannel){const mr=await requestMicroExternal('GET',normalizeEvolinkBase(baseUrl)+'/models',key,null,'application/json','application/json',{timeoutMs:DIAGNOSTIC_TIMEOUT_MS});let mp={};try{mp=JSON.parse(mr.body.toString('utf8')||'{}');}catch(_e){}const rows=Array.isArray(mp)?mp:(mp.data||mp.models||[]);if(!(mr.status>=200&&mr.status<300&&Array.isArray(rows)&&rows.length))throw new Error('HTTP '+mr.status);models=rows;capabilities=evolinkCapabilityPayload(models,'evolink-models-live').capabilities;modelCatalogSource='evolink-models-live';}else{const catalog=await fetchEvolinkModelCatalog(baseUrl,key,false);models=catalog.rows;capabilities=evolinkCapabilityPayload(models,catalog.cached?'evolink-models-cache':'evolink-models-live').capabilities;modelCatalogSource=catalog.cached?'evolink-models-cache':'evolink-models-live';}}catch(_catalogError){modelCatalogSource='builtin-fallback';}}
          pushServerLog({method:'POST',path:'/api/diagnose',status:fileQuota.status,durationMs:Date.now()-startedAt,channel:'evolink/files quota',message:fileOk?'文件通道正常':'文件通道失败'});
          pushServerLog({method:'GET',path:'/api/credits',status:creditsResp.status,durationMs:Date.now()-startedAt,channel:'evolink/credits',message:billing.blocked?'Credits 不足，生图不可用':(billing.checked?'Credits 可用':'Credits 查询失败')});
          const ok=authOk&&fileOk,generationReady=ok&&billing.checked&&!billing.blocked;
          return send(res,200,JSON.stringify({ok,generationReady,status:fileQuota.status,creditsStatus:creditsResp.status,message,provider:'evolink',billing,models,capabilities,modelCatalogSource,remoteIp:fileQuota.remoteIp||creditsResp.remoteIp||'',resolvedProxy:RESOLVED_PROXY||null}));
        }catch(e){pushServerLog({method:'POST',path:'/api/diagnose',status:500,durationMs:Date.now()-startedAt,channel:'evolink/diagnose',message:e.message});return send(res,200,JSON.stringify({ok:false,generationReady:false,message:'无法连接 EvoLink：'+e.message,provider:'evolink',models:evolinkModelPayload().data,resolvedProxy:RESOLVED_PROXY||null}));}
      }
      const target = baseUrl + '/models';
      const viaStr = ()=>{ if(PROXY_URL==='auto') return RESOLVED_PROXY ? ('（经上游代理 '+RESOLVED_PROXY+' 出网）') : '（未探测到本机代理，已尝试直连）'; return PROXY_URL ? ('（经上游代理 '+PROXY_URL+' 出网）') : (FORCE_IP ? ('（已强制直连 IP '+FORCE_IP+'，绕过系统 DNS）') : '（使用系统 DNS 解析直连）'); };
      try{
        const r = await requestExternal('GET', target, key, null);
        let parsed = {};
        try { parsed = JSON.parse(r.body.toString('utf8') || '{}'); } catch(e) {}
        const arr = Array.isArray(parsed) ? parsed : (parsed.data || parsed.models || []);
        if(r.status >= 200 && r.status < 300){
          pushServerLog({method:'POST',path:'/api/diagnose',status:200,durationMs:Date.now()-startedAt,channel:'external /models',message:'连接成功，模型数量 '+(Array.isArray(arr)?arr.length:0)});
          return send(res, 200, JSON.stringify({ok:true, message:'外部 API 可连接'+viaStr()+'，/models 返回 HTTP '+r.status+'，模型数量 '+(Array.isArray(arr)?arr.length:0), status:r.status, remoteIp:r.remoteIp, forceHostIp:FORCE_IP||null, resolvedProxy:RESOLVED_PROXY||null, models:arr}));
        }
        pushServerLog({method:'POST',path:'/api/diagnose',status:r.status,durationMs:Date.now()-startedAt,channel:'external /models',message:'模型接口返回错误'});
        return send(res, 200, JSON.stringify({ok:false, message:'已连接'+viaStr()+'，但 /models 返回 HTTP '+r.status+'：'+r.body.toString('utf8').slice(0,500), status:r.status, remoteIp:r.remoteIp, forceHostIp:FORCE_IP||null, resolvedProxy:RESOLVED_PROXY||null}));
      }catch(e){
        pushServerLog({method:'POST',path:'/api/diagnose',status:500,durationMs:Date.now()-startedAt,channel:'external /models',message:e.message});
        return send(res, 200, JSON.stringify({ok:false, message:e.message+viaStr()+'　若仍超时：请先在浏览器中测试当前 Base URL 的 /models 地址；浏览器可打开但程序失败时，请检查 VPN/代理是否允许本地 Node 服务出网。proxyUrl=auto 会探测常见本机代理端口，仍失败时可在 config.json 手填代理地址。', forceHostIp:FORCE_IP||null, proxyUrl:PROXY_URL||null, resolvedProxy:RESOLVED_PROXY||null}));
      }
    }
    if(microChannel && apiPath === '/images/generations' && req.method === 'POST'){
      const channel=String(req.headers['x-channel']||''),generationId=String(req.headers['x-micro-generation-id']||''),handoffAcknowledged=String(req.headers['x-micro-handoff-acknowledged']||''),fingerprint=String(req.headers['x-micro-instruction-fingerprint']||''),conflictPolicy=String(req.headers['x-micro-conflict-policy']||'isolated');
      if(channel!=='micro-adjust-v27.8'||!generationId||handoffAcknowledged!=='1'){pushServerLog({method:'POST',path:'/api/micro/images/generations',status:409,durationMs:Date.now()-startedAt,channel:'micro-adjust isolation rejected',message:'拒绝未携带 V27.9 微调会话/流程交接确认的计费请求'});return send(res,409,JSON.stringify({error:{code:'micro_channel_isolation_failed',message:'微调计费请求缺少 V27.9 独立通道标识、generationId 或流程交接确认，已阻止发送到 EvoLink。',channel:'micro-adjust'}}));}
      pushServerLog({method:'POST',path:'/api/micro/images/generations',status:100,durationMs:Date.now()-startedAt,channel:'micro-adjust isolated preflight',message:`generationId=${generationId}; conflictPolicy=${conflictPolicy}; instruction=${fingerprint||'none'}`});
    }
    const body = ['GET','HEAD'].includes(req.method) ? null : await readBody(req);
    const wantsProgressStream = String(req.headers['x-ai-progress-stream']||'') === '1';
    if(wantsProgressStream){
      const result=await requestExternalStream(req.method, baseUrl + apiPath, key, body, req.headers['content-type'], res);
      pushServerLog({method:req.method,path:'/api'+apiPath,status:result.status,durationMs:Date.now()-startedAt,channel:(PROXY_URL?'proxy':'direct')+'/progress-stream',message:'外部 API 流式/实时进度通道完成，字节 '+result.bytes});
      return;
    }
    const outbound = microChannel ? requestMicroExternal : requestExternal;
    const microTimeout=apiPath.startsWith('/tasks/')?MICRO_TASK_REQUEST_TIMEOUT_MS:(apiPath==='/images/generations'?MICRO_GENERATION_SUBMIT_TIMEOUT_MS:Math.min(30000,REQUEST_TIMEOUT_MS));
    const r = await outbound(req.method, baseUrl + apiPath, key, body, req.headers['content-type'],'',microChannel?{timeoutMs:microTimeout}:{});
    pushServerLog({method:req.method,path:'/api'+(microChannel?'/micro':'')+apiPath,status:r.status,durationMs:Date.now()-startedAt,channel:microChannel?('micro-adjust isolated '+(r.route||'')):(PROXY_URL?'proxy/outbound':'direct/outbound'),message:r.status===402?'EvoLink Credits 不足（HTTP 402）':(r.status>=400?'外部 API 返回错误':'外部 API 请求成功')});
    res.writeHead(r.status, headers(r.headers['content-type'] || 'application/json; charset=utf-8'));
    res.end(r.body);
  }catch(e){
    pushServerLog({method:req.method,path:'/api'+apiPath,status:500,durationMs:Date.now()-startedAt,channel:'proxy error',message:e.message});
    send(res, e.status||500, JSON.stringify({error:{message:e.message}}));
  }
}

function handleRequest(req,res){
  if(req.url.startsWith('/api/')) return proxy(req,res);
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  if(/(?:^|\/)copy-coze\.private\.json$/i.test(pathname)||/\.env(?:\.|$)/i.test(pathname)||/(?:^|\/)\.[^/]+/.test(pathname)||/\.(?:secure|dpapi)$/i.test(pathname)) return send(res,403,'Forbidden','text/plain; charset=utf-8');
  const appRoutes = new Set(['/','/copy','/wireframe','/image','/users','/audit','/region','/region/files','/region/regions','/region/canvas','/region/adjust','/region/details','/region/quality']);
  if(appRoutes.has(pathname)) pathname = '/index.html';
  const file = path.resolve(ROOT, '.' + pathname);
  if(file !== ROOT && !file.startsWith(ROOT + path.sep)) return send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
  fs.readFile(file, (err, data)=>{
    if(err){
      if(pathname.startsWith('/assets/'))pushServerLog({method:req.method,path:pathname,status:404,durationMs:0,channel:'local assets',message:'静态素材读取失败：'+(err.code||err.message)});
      return send(res, 404, 'Not Found', 'text/plain; charset=utf-8');
    }
    const type=mime[path.extname(file).toLowerCase()] || 'application/octet-stream';
    if(pathname.startsWith('/assets/')){const h=headers(type);h['Cache-Control']='public, max-age=300';res.writeHead(200,h);return res.end(req.method==='HEAD'?undefined:data);}
    send(res, 200, req.method==='HEAD'?undefined:data, type);
  });
}
function createServer(){return http.createServer(handleRequest);}
if(require.main===module){
  createServer().listen(PORT, '127.0.0.1', ()=>{
    const url = 'http://127.0.0.1:'+PORT+'/';
    console.log('AI Tool Web UI '+APP_VERSION+' started: '+url);
    console.log('Do not close this window while using the page.');
    if(process.platform === 'win32' && process.env.AI_TOOL_AUTO_OPEN === '1') require('child_process').exec('start "" "'+url+'"');
  });
}

module.exports={handler:handleRequest,apiHandler:proxy,createServer,APP_VERSION,BUILD_ID,RUNTIME_KIND};
