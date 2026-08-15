'use strict';
const fs=require('fs');
const path=require('path');
const childProcess=require('child_process');
const crypto=require('crypto');

const DEFAULT_JOB_URL='https://paddleocr.aistudio-app.com/api/v2/ocr/jobs';
const DEFAULT_MODEL='PaddleOCR-VL-1.6';
const SECURE_VERSION='local_encrypted_v2';

module.exports=function createPaddleOcrCloud({root,cfg,requestExternal,requestPublicDownload}){
  const secureFile=path.join(root,'config','.paddleocr-token.secure');
  const legacyFile=path.join(root,'config','.paddleocr-token.dpapi');
  let sessionToken='';

  function machineSecret(){return[process.env.USERNAME||process.env.USER||'user',process.env.COMPUTERNAME||process.env.HOSTNAME||'machine',path.resolve(root)].join('|');}
  function deriveKey(salt){return crypto.pbkdf2Sync(machineSecret(),salt,120000,32,'sha256');}
  function xorStream(data,key,iv){const out=Buffer.alloc(data.length);let offset=0,counter=0;while(offset<data.length){const c=Buffer.alloc(4);c.writeUInt32BE(counter++);const block=crypto.createHmac('sha256',key).update(iv).update(c).digest();for(let i=0;i<block.length&&offset<data.length;i++,offset++)out[offset]=data[offset]^block[i];}return out;}
  function encryptToken(token){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(16),key=deriveKey(salt),plain=Buffer.from(String(token||''),'utf8'),cipher=xorStream(plain,key,iv),tag=crypto.createHmac('sha256',key).update(iv).update(cipher).digest();return JSON.stringify({version:2,scheme:'PBKDF2-HMAC-SHA256-STREAM',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:tag.toString('base64'),data:cipher.toString('base64')});}
  function decryptToken(text){const obj=JSON.parse(String(text||''));if(!obj||obj.version!==2)throw new Error('令牌文件版本不受支持');const salt=Buffer.from(obj.salt||'','base64'),iv=Buffer.from(obj.iv||'','base64'),tag=Buffer.from(obj.tag||'','base64'),cipher=Buffer.from(obj.data||'','base64'),key=deriveKey(salt),actual=crypto.createHmac('sha256',key).update(iv).update(cipher).digest();if(tag.length!==actual.length||!crypto.timingSafeEqual(tag,actual))throw new Error('令牌文件校验失败，可能来自其他 Windows 用户或电脑');return xorStream(cipher,key,iv).toString('utf8');}
  function psDpapi(mode,value){if(process.platform!=='win32')throw new Error('仅 Windows 支持旧版 DPAPI');const script=mode==='protect'?'Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($s);$e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($e))':'Add-Type -AssemblyName System.Security; $s=[Console]::In.ReadToEnd().Trim();$b=[Convert]::FromBase64String($s);$d=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($d))';const r=childProcess.spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script],{input:String(value||''),encoding:'utf8',windowsHide:true,timeout:20000,maxBuffer:1024*1024});if(r.error||r.status!==0)throw new Error(String(r.stderr||r.stdout||(r.error&&r.error.message)||'旧版 DPAPI 操作失败').trim());return String(r.stdout||'').trim();}
  function storedToken(){if(fs.existsSync(secureFile)){try{return decryptToken(fs.readFileSync(secureFile,'utf8'));}catch(e){return'';}}if(process.platform==='win32'&&fs.existsSync(legacyFile)){try{const token=psDpapi('unprotect',fs.readFileSync(legacyFile,'utf8').trim());if(token){fs.mkdirSync(path.dirname(secureFile),{recursive:true});fs.writeFileSync(secureFile,encryptToken(token),'utf8');try{fs.unlinkSync(legacyFile);}catch(e){}return token;}}catch(e){return'';}}return'';}
  function getToken(){if(sessionToken)return{token:sessionToken,source:'session'};const env=String(process.env.PADDLEOCR_ACCESS_TOKEN||'').trim();if(env)return{token:env,source:'environment'};const stored=storedToken();if(stored)return{token:stored,source:SECURE_VERSION};const legacy=String((((cfg||{}).paddleOcrCloud||{}).token)||'').trim();if(legacy)return{token:legacy,source:'legacy_config'};return{token:'',source:'not_configured'};}
  function status(){const cloud=(cfg||{}).paddleOcrCloud||{},t=getToken(),q=queueStatus('').queue;return{ok:true,configured:!!t.token,tokenSource:t.source,secureStorage:SECURE_VERSION,jobUrl:String(cloud.jobUrl||DEFAULT_JOB_URL),model:String(cloud.model||DEFAULT_MODEL),pollIntervalMs:Number(cloud.pollIntervalMs||5000),pollTimeoutMs:Number(cloud.pollTimeoutMs||600000),submitRetryDelaysMs:retryDelays({},cloud),submitRetryJitterMs:Number(cloud.submitRetryJitterMs??DEFAULT_SUBMIT_RETRY_JITTER_MS),submissionQueue:q,localModelRequired:false,apiKeyRequired:true,resultDownloadMode:'presigned_url_no_auth_redirect_follow_v153',message:t.token?'云端令牌已配置':'尚未配置 PaddleOCR 云端令牌'};}
  function configure(payload){payload=payload&&typeof payload==='object'?payload:{};if(payload.clear){sessionToken='';for(const f of[secureFile,legacyFile])try{fs.unlinkSync(f);}catch(e){}return status();}const token=String(payload.token||'').trim();if(!token)return{ok:false,error:{code:'token_missing',message:'请输入 PaddleOCR Access Token'}};if(token.length<20)return{ok:false,error:{code:'token_invalid',message:'令牌长度异常，请检查是否复制完整'}};sessionToken=token;let persisted=false,warning='';if(payload.remember){try{fs.mkdirSync(path.dirname(secureFile),{recursive:true});fs.writeFileSync(secureFile,encryptToken(token),'utf8');persisted=true;}catch(e){warning='令牌已在本次运行中生效，但本机加密保存失败：'+e.message;}}return Object.assign(status(),{saved:true,persisted,warning});}
  function decodeImage(value){let raw=String(value||'').trim(),mime='image/png';if(!raw)throw new Error('请求中缺少 image 数据');if(raw.startsWith('data:')){const m=raw.match(/^data:([^;,]+)?;base64,([\s\S]*)$/);if(!m)throw new Error('image 必须是 base64 Data URL');mime=m[1]||mime;raw=m[2];}const data=Buffer.from(raw,'base64');if(!data.length)throw new Error('图片数据为空');if(data.length>45*1024*1024)throw new Error('图片超过 45MB，请压缩后再识别');const ext=/jpe?g/i.test(mime)?'.jpg':/webp/i.test(mime)?'.webp':'.png';return{data,mime,ext};}
  function multipart(fields,filename,mime,data){const boundary='----AIV153'+crypto.randomBytes(12).toString('hex'),parts=[];for(const[name,value]of Object.entries(fields))parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${String(value)}\r\n`));parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`),data,Buffer.from(`\r\n--${boundary}--\r\n`));return{body:Buffer.concat(parts),contentType:`multipart/form-data; boundary=${boundary}`};}
  function parseJson(buf,context){try{const o=JSON.parse(buf.toString('utf8')||'{}');if(!o||typeof o!=='object'||Array.isArray(o))throw 0;return o;}catch(e){throw new Error(context+'返回了无法解析的 JSON');}}
  function apiError(obj,context){const code=Number(obj&&obj.code||0);if(code!==0)throw new Error(`${context}失败（code ${code}）：${String(obj&&obj.msg||obj&&obj.message||'未知错误')}`);}
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function normBox(box,w,h){if(box&&typeof box==='object'&&!Array.isArray(box))box=box.coordinate||box.coordinates||box.bbox||box.box||box.poly||box.points;if(!Array.isArray(box))return null;let v=null;if(box.length===4&&box.every(x=>Number.isFinite(Number(x))))v=box.map(Number);else if(box.length>=4&&box.every(p=>Array.isArray(p)&&p.length>=2)){const xs=box.map(p=>Number(p[0])),ys=box.map(p=>Number(p[1]));if(xs.every(Number.isFinite)&&ys.every(Number.isFinite))v=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}if(!v)return null;let[x1,y1,x2,y2]=v;if(Math.max(...v.map(Math.abs))<=1.01){x1*=w;x2*=w;y1*=h;y2*=h;}x1=Math.max(0,Math.min(w,x1));x2=Math.max(0,Math.min(w,x2));y1=Math.max(0,Math.min(h,y1));y2=Math.max(0,Math.min(h,y2));return x2>x1&&y2>y1?[x1,y1,x2,y2]:null;}
  function labelKind(label){const s=String(label||'').toLowerCase();if(/formula|equation|algorithm/.test(s))return'formula';if(/table/.test(s))return'table';if(/image|figure|picture|photo|chart/.test(s))return'image';if(/title/.test(s))return'title';if(/seal|stamp/.test(s))return'seal';return'text';}
  function blockType(label){const kind=labelKind(label);if(['text','title','formula','table','seal'].includes(kind))return'text';if(kind==='image')return'product';return'decoration';}
  function stringContent(b){const value=b.block_content??b.blockContent??b.content??b.text??b.markdown??b.res??'';if(typeof value==='string')return value.trim();if(value&&typeof value==='object')return String(value.text||value.markdown||value.html||'').trim();return'';}
  function arrayFrom(v){if(Array.isArray(v))return v;if(v&&typeof v==='object'&&Array.isArray(v.boxes))return v.boxes;return[];}
  function extractRegions(jsonl,w,h,maxRegions){
    const candidates=[],documentBlocks=[],markdown=[],pageRaw=[];let pages=0,blockSeq=0;
    const addCandidate=(row,pageNo,sourceLabel)=>{if(!row||typeof row!=='object')return;const box=normBox(row.block_bbox||row.blockBBox||row.bbox||row.box||row.coordinate||row.coordinates||row.poly||row.points,w,h);if(!box)return;const label=String(row.block_label||row.blockLabel||row.label||row.type||row.category||sourceLabel||'layout');const content=stringContent(row);const confidence=[row.score,row.confidence,row.prob].map(Number).find(Number.isFinite);const kind=labelKind(label),type=blockType(label),id='docblock_'+(++blockSeq);const item={id,type,kind,blockLabel:label,label:content?(content.length>32?content.slice(0,32)+'…':content):(label||'版面区域'),recognizedText:content,confidence:Number.isFinite(confidence)?confidence:null,box,source:'paddleocr-cloud',page:pageNo,order:documentBlocks.length};documentBlocks.push({...item});candidates.push({...item});};
    for(const rawLine of String(jsonl||'').split(/\r?\n/)){
      const line=rawLine.trim();if(!line)continue;let obj;try{obj=JSON.parse(line);}catch(e){continue;}const result=obj&&obj.result;if(!result||typeof result!=='object')continue;pageRaw.push(result);
      const pageRows=result.layoutParsingResults||result.layout_parsing_results||result.pages||[];
      for(const page of pageRows){if(!page||typeof page!=='object')continue;pages++;const pageNo=pages;const md=(page.markdown&&page.markdown.text)||page.markdownText||'';if(md)markdown.push(String(md));const pruned=page.prunedResult||page.pruned_result||page.result||{};
        const overall=pruned.overall_ocr_res||pruned.overallOcrRes||page.overall_ocr_res||page.overallOcrRes||{};
        if(overall&&typeof overall==='object'){const polys=overall.rec_polys||overall.dt_polys||overall.text_polys||overall.recPolys||[],texts=overall.rec_texts||overall.texts||overall.recTexts||[],scores=overall.rec_scores||overall.dt_scores||overall.scores||overall.recScores||[];polys.forEach((poly,i)=>{const box=normBox(poly,w,h);if(!box)return;const text=String(texts[i]||'');const item={id:'ocrline_'+(++blockSeq),type:'text',kind:'text',label:text?(text.length>32?text.slice(0,32)+'…':text):'文字区域',recognizedText:text,confidence:Number.isFinite(Number(scores[i]))?Number(scores[i]):null,box,blockLabel:'ocr',source:'paddleocr-cloud',page:pageNo,order:documentBlocks.length};documentBlocks.push({...item});candidates.push({...item});});}
        const collections=[pruned.parsing_res_list,pruned.parsingResList,page.parsing_res_list,page.parsingResList,result.parsing_res_list,result.parsingResList,pruned.layout_det_res,pruned.layoutDetRes,page.layout_det_res,page.layoutDetRes];
        collections.forEach(v=>arrayFrom(v).forEach(row=>addCandidate(row,pageNo,'layout')));
      }
    }
    const area=x=>(x.box[2]-x.box[0])*(x.box[3]-x.box[1]);const iou=(a,b)=>{const iw=Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0])),ih=Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1])),inter=iw*ih,uni=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter;return uni>0?inter/uni:0;};
    candidates.sort((a,b)=>(a.blockLabel==='ocr'?0:1)-(b.blockLabel==='ocr'?0:1)||a.order-b.order||area(b)-area(a));const out=[];for(const c of candidates){if(out.some(e=>c.type===e.type&&iou(c.box,e.box)>.86))continue;out.push({...c});if(out.length>=Math.max(1,Math.min(100,Number(maxRegions)||40)))break;}
    const products=out.filter(x=>x.type==='product').sort((a,b)=>area(b)-area(a));products.slice(1).forEach(x=>x.type='decoration');
    const regions=out.map((c,i)=>{const[x1,y1,x2,y2]=c.box,typ=c.type;delete c.box;return Object.assign(c,{id:'cloud_'+(i+1),x:+(x1/w).toFixed(6),y:+(y1/h).toFixed(6),width:+((x2-x1)/w).toFixed(6),height:+((y2-y1)/h).toFixed(6),template:typ==='text'?'remove-text':typ==='product'?'enhance-material':'replace-content',suggestedInstruction:typ==='text'?'编辑红色文字区域内的文字；删除时自然补全背景，其他区域保持不变。':typ==='product'?'只调整该产品主体区域，保持包装文字、造型与其他区域不变。':'只调整该装饰或版面元素，保持文字、主体和背景结构不变。'});});
    const regionByKey=new Map(regions.map(r=>[`${r.page}|${r.order}|${r.blockLabel}|${r.recognizedText}`,r]));
    const blocks=documentBlocks.map((b,i)=>{const[x1,y1,x2,y2]=b.box;const key=`${b.page}|${b.order}|${b.blockLabel}|${b.recognizedText}`,match=regionByKey.get(key);return{id:match?match.id:`block_${i+1}`,type:match?match.type:b.type,kind:b.kind,blockLabel:b.blockLabel,label:b.label,content:b.recognizedText,confidence:b.confidence,page:b.page,order:b.order,x:+(x1/w).toFixed(6),y:+(y1/h).toFixed(6),width:+((x2-x1)/w).toFixed(6),height:+((y2-y1)/h).toFixed(6)};});
    return{regions,documentBlocks:blocks,markdown:markdown.join('\n\n'),pageCount:pages,rawPageCount:pageRaw.length};
  }
  function safeHost(url){try{return new URL(url).host;}catch(e){return'';}}

  /* V26: serialize only PaddleOCR job submission across tabs/requests, while
     allowing already-submitted jobs to poll concurrently. This prevents a burst
     of local requests from amplifying PaddleOCR's remote submission queue. */
  const DEFAULT_SUBMIT_RETRY_DELAYS_MS=[3000,6000,12000,20000];
  const DEFAULT_SUBMIT_RETRY_JITTER_MS=500;
  const TRANSIENT_SUBMIT_HTTP=new Set([408,425,429,500,502,503,504]);
  const paddleSubmissionQueue=[];
  let paddleSubmissionRunning=false;
  let activeSubmissionRequestId='';
  const submissionStates=new Map();
  const STATE_TTL_MS=15*60*1000;

  function requestIdOf(value){
    const raw=String(value||'').trim().replace(/[^a-zA-Z0-9_.:-]/g,'').slice(0,120);
    return raw||('ocr_'+Date.now().toString(36)+'_'+crypto.randomBytes(5).toString('hex'));
  }
  function cleanupSubmissionStates(){
    const cutoff=Date.now()-STATE_TTL_MS;
    for(const [id,state] of submissionStates.entries())if(Number(state.updatedAt||0)<cutoff&&id!==activeSubmissionRequestId&&!paddleSubmissionQueue.some(task=>task.requestId===id))submissionStates.delete(id);
  }
  function setSubmissionState(requestId,patch){
    cleanupSubmissionStates();
    const id=requestIdOf(requestId),prev=submissionStates.get(id)||{requestId:id,createdAt:Date.now()};
    const next=Object.assign({},prev,patch||{},{requestId:id,updatedAt:Date.now()});
    submissionStates.set(id,next);return next;
  }
  function refreshQueuePositions(){
    paddleSubmissionQueue.forEach((task,index)=>setSubmissionState(task.requestId,{phase:'queued',queuePosition:index+1,queueDepth:paddleSubmissionQueue.length,activeRequestId:activeSubmissionRequestId||'',message:`本地已有识别任务正在提交，当前排队第 ${index+1} 位…`}));
  }
  function queueStatus(requestId){
    cleanupSubmissionStates();
    const id=String(requestId||'').trim();
    const state=id?submissionStates.get(id):null;
    return {ok:true,requestId:id,state:state?Object.assign({},state):null,queue:{active:!!paddleSubmissionRunning,activeRequestId:activeSubmissionRequestId||'',waiting:paddleSubmissionQueue.length}};
  }
  function pumpSubmissionQueue(){
    if(paddleSubmissionRunning)return;
    const task=paddleSubmissionQueue.shift();
    refreshQueuePositions();
    if(!task)return;
    paddleSubmissionRunning=true;activeSubmissionRequestId=task.requestId;
    setSubmissionState(task.requestId,{phase:'submitting',queuePosition:0,queueDepth:paddleSubmissionQueue.length,activeRequestId:task.requestId,message:'正在提交 PaddleOCR 云端识别任务…'});
    Promise.resolve().then(task.work).then(task.resolve,task.reject).finally(()=>{
      paddleSubmissionRunning=false;activeSubmissionRequestId='';refreshQueuePositions();pumpSubmissionQueue();
    });
  }
  function enqueueSubmission(requestId,work){
    return new Promise((resolve,reject)=>{
      paddleSubmissionQueue.push({requestId,work,resolve,reject});
      refreshQueuePositions();
      pumpSubmissionQueue();
    });
  }
  function jsonObjectLoose(body){
    try{const obj=JSON.parse(Buffer.isBuffer(body)?body.toString('utf8'):String(body||''));return obj&&typeof obj==='object'&&!Array.isArray(obj)?obj:null;}catch(e){return null;}
  }
  function retryAfterMs(headers){
    const value=headers&&((headers['retry-after'])||(headers['Retry-After']));if(value==null)return 0;
    const n=Number(value);if(Number.isFinite(n)&&n>=0)return Math.min(60000,n*1000);
    const when=Date.parse(String(value));return Number.isFinite(when)?Math.max(0,Math.min(60000,when-Date.now())):0;
  }
  function classifySubmitResponse(r){
    const status=Number(r&&r.status||0),body=r&&r.body?Buffer.from(r.body):Buffer.alloc(0),text=body.toString('utf8').slice(0,1200),obj=jsonObjectLoose(body),providerCode=Number(obj&&obj.code||0),providerMessage=String(obj&&(obj.msg||obj.message)||'').trim();
    if(status===200&&providerCode===0)return{ok:true,status,obj,text,providerCode,providerMessage};
    if(providerCode===10010)return{ok:false,transient:true,code:'queue_busy',status,providerCode,providerMessage:providerMessage||'任务提交队列已满，请稍后重试',message:'PaddleOCR 当前任务提交队列繁忙'};
    if([401,403].includes(status))return{ok:false,transient:false,code:'auth_failed',status,providerCode,providerMessage,message:'PaddleOCR Access Token 无效、过期或没有权限'};
    if(status===429)return{ok:false,transient:true,code:'quota_or_rate_limit',status,providerCode,providerMessage,message:'PaddleOCR 当前请求频率受限'};
    if(status===400)return{ok:false,transient:false,code:'invalid_submit_request',status,providerCode,providerMessage,message:'PaddleOCR 拒绝了任务参数'};
    if(TRANSIENT_SUBMIT_HTTP.has(status))return{ok:false,transient:true,code:'upstream_temporary',status,providerCode,providerMessage,message:'PaddleOCR 云端服务暂时不可用'};
    return{ok:false,transient:false,code:'submit_failed',status,providerCode,providerMessage,message:'PaddleOCR 云端任务提交失败'};
  }
  function retryDelays(payload,cloud){
    const raw=payload.submitRetryDelaysMs||cloud.submitRetryDelaysMs||DEFAULT_SUBMIT_RETRY_DELAYS_MS;
    const arr=Array.isArray(raw)?raw.map(Number).filter(Number.isFinite).map(x=>Math.max(0,Math.min(60000,x))).slice(0,8):DEFAULT_SUBMIT_RETRY_DELAYS_MS.slice();
    return arr.length?arr:DEFAULT_SUBMIT_RETRY_DELAYS_MS.slice();
  }
  async function submitWithRetry({requestId,jobUrl,token,body,contentType,payload,cloud}){
    const delays=retryDelays(payload,cloud),jitterMax=Math.max(0,Math.min(3000,Number(payload.submitRetryJitterMs??cloud.submitRetryJitterMs??DEFAULT_SUBMIT_RETRY_JITTER_MS)||0)),attempts=[];
    for(let attempt=1;attempt<=delays.length+1;attempt++){
      setSubmissionState(requestId,{phase:'submitting',attempt,maxAttempts:delays.length+1,retryTotal:delays.length,message:attempt===1?'正在提交 PaddleOCR 云端识别任务…':`正在进行第 ${attempt-1}/${delays.length} 次重新提交…`});
      let r,classified;
      try{
        r=await requestExternal('POST',jobUrl,token,body,contentType);
        classified=classifySubmitResponse(r);
      }catch(e){
        classified={ok:false,transient:true,code:'submit_network_error',status:0,providerCode:0,providerMessage:'',message:'连接 PaddleOCR 云端时出现临时网络错误',networkMessage:String(e&&e.message||e)};
      }
      attempts.push({attempt,httpStatus:classified.status||0,providerCode:classified.providerCode||0,code:classified.code||'ok',message:classified.providerMessage||classified.networkMessage||'',at:Date.now()});
      if(classified.ok)return{ok:true,response:r,submitted:classified.obj,attempts};
      if(!classified.transient||attempt>delays.length){
        const exhausted=classified.transient&&attempt>delays.length;
        let message;
        if(classified.code==='queue_busy')message=exhausted?`PaddleOCR 当前任务队列持续繁忙，已自动重试 ${delays.length} 次仍未提交成功，请稍后重新尝试。`:'PaddleOCR 当前任务队列繁忙。';
        else if(classified.code==='quota_or_rate_limit')message=exhausted?`PaddleOCR 当前请求频率持续受限，已自动重试 ${delays.length} 次，请稍后重新尝试。`:'PaddleOCR 当前请求频率受限。';
        else if(classified.code==='upstream_temporary'||classified.code==='submit_network_error')message=exhausted?`PaddleOCR 云端连接持续不稳定，已自动重试 ${delays.length} 次，请稍后重新尝试。`:`${classified.message}。`;
        else message=`${classified.message}${classified.status?`（HTTP ${classified.status}）`:''}${classified.providerMessage?`：${classified.providerMessage}`:''}`;
        return{ok:false,error:{code:classified.code,message,httpStatus:classified.status||0,providerCode:classified.providerCode||0,providerMessage:classified.providerMessage||'',retryable:!!classified.transient,retryExhausted:exhausted},attempts};
      }
      const base=delays[attempt-1],headerDelay=retryAfterMs(r&&r.headers),jitter=jitterMax?Math.floor(Math.random()*(jitterMax+1)):0,delayMs=Math.max(base,headerDelay)+jitter;
      setSubmissionState(requestId,{phase:'retry_wait',attempt,retryIndex:attempt,retryTotal:delays.length,nextAttempt:attempt+1,delayMs,httpStatus:classified.status||0,providerCode:classified.providerCode||0,errorCode:classified.code,message:classified.code==='queue_busy'?`PaddleOCR 当前任务较多，正在等待云端队列，第 ${attempt}/${delays.length} 次重试将在约 ${Math.ceil(delayMs/1000)} 秒后开始…`:`PaddleOCR 暂时不可用，正在等待，第 ${attempt}/${delays.length} 次重试将在约 ${Math.ceil(delayMs/1000)} 秒后开始…`});
      await sleep(delayMs);
    }
    return{ok:false,error:{code:'submit_failed',message:'PaddleOCR 云端任务提交失败'},attempts};
  }

  async function recognize(payload){
    payload=payload&&typeof payload==='object'?payload:{};const requestId=requestIdOf(payload.requestId);setSubmissionState(requestId,{phase:'preparing',message:'正在准备 PaddleOCR 云端识别任务…'});const t=getToken();if(!t.token){const error={code:'token_not_configured',message:'尚未配置 PaddleOCR 云端令牌，请先在识别面板中保存令牌。'};setSubmissionState(requestId,{phase:'failed',errorCode:error.code,message:error.message});return{ok:false,error,requestId};}
    const cloud=(cfg||{}).paddleOcrCloud||{},jobUrl=String(payload.jobUrl||cloud.jobUrl||DEFAULT_JOB_URL).replace(/\/+$/,''),model=String(payload.model||cloud.model||DEFAULT_MODEL),pollInterval=Math.max(1000,Number(payload.pollIntervalMs||cloud.pollIntervalMs||5000)),pollTimeout=Math.max(30000,Number(payload.pollTimeoutMs||cloud.pollTimeoutMs||600000)),maxRegions=Number(payload.maxRegions||cloud.maxRegions||40),w=Math.max(1,Number(payload.imageWidth)||1),h=Math.max(1,Number(payload.imageHeight)||1),img=decodeImage(payload.image);
    const options={markdownIgnoreLabels:['header','header_image','footer','footer_image','footnote','aside_text'],useDocOrientationClassify:!!payload.useDocOrientationClassify,useDocUnwarping:!!payload.useDocUnwarping,useLayoutDetection:true,useChartRecognition:!!payload.useChartRecognition,useSealRecognition:true,useOcrForImageBlock:true,mergeTables:true,relevelTitles:true,layoutShapeMode:'auto',promptLabel:'ocr',repetitionPenalty:1,temperature:0,topP:1,layoutNms:true,restructurePages:true};
    const mp=multipart({model,optionalPayload:JSON.stringify(options)},'image'+img.ext,img.mime,img.data);
    const submittedResult=await enqueueSubmission(requestId,()=>submitWithRetry({requestId,jobUrl,token:t.token,body:mp.body,contentType:mp.contentType,payload,cloud}));
    if(!submittedResult.ok){setSubmissionState(requestId,{phase:'failed',errorCode:submittedResult.error.code,message:submittedResult.error.message,submitAttempts:submittedResult.attempts.length});return{ok:false,error:submittedResult.error,requestId,submitAttempts:submittedResult.attempts.length,submitDiagnostics:submittedResult.attempts};}
    const submitted=submittedResult.submitted,jobId=submitted&&submitted.data&&submitted.data.jobId;if(!jobId){const error={code:'missing_job_id',message:'云端返回成功，但未包含 jobId'};setSubmissionState(requestId,{phase:'failed',errorCode:error.code,message:error.message});return{ok:false,error,requestId,submitAttempts:submittedResult.attempts.length,submitDiagnostics:submittedResult.attempts};}
    setSubmissionState(requestId,{phase:'submitted',jobId,message:'任务已提交，正在等待 PaddleOCR 云端解析与版面识别…',submitAttempts:submittedResult.attempts.length});
    const deadline=Date.now()+pollTimeout;let pollCount=0,progress={},jsonUrl='',r;
    while(Date.now()<deadline){
      pollCount++;setSubmissionState(requestId,{phase:'polling',jobId,pollCount,message:'任务已提交，正在等待 PaddleOCR 云端解析与版面识别…'});
      r=await requestExternal('GET',jobUrl+'/'+encodeURIComponent(jobId),t.token,null);
      if(r.status!==200){const error={code:'poll_failed',message:`查询云端任务失败（HTTP ${r.status}）：${r.body.toString('utf8').slice(0,800)}`};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
      let jo;try{jo=parseJson(r.body,'任务状态接口');apiError(jo,'任务状态查询');}catch(e){const error={code:'poll_response_error',message:e.message};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
      const d=jo.data||{},state=String(d.state||'');progress=d.extractProgress||{};
      if(state==='done'){jsonUrl=String(d.resultUrl&&d.resultUrl.jsonUrl||'').replace(/&amp;/g,'&');break;}
      if(state==='failed'){const error={code:'job_failed',message:String(d.errorMsg||'云端任务执行失败')};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
      await sleep(pollInterval);
    }
    if(!jsonUrl){const error={code:'poll_timeout',message:'云端识别等待超时，请稍后重试或调大轮询超时时间'};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
    setSubmissionState(requestId,{phase:'downloading',jobId,message:'云端任务已完成，正在下载并解析识别结果…'});
    try{r=await requestPublicDownload(jsonUrl);}catch(e){const error={code:'result_download_network_error',message:'结果文件下载连接失败：'+e.message};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
    if(r.status!==200){const snippet=String(r.body||'').slice(0,240).replace(/\s+/g,' '),error={code:'result_download_failed',message:`结果文件下载失败（HTTP ${r.status}）。当前版本已按官方要求使用“不携带 PaddleOCR Authorization、自动跟随重定向”的独立下载通道。${snippet?' 返回：'+snippet:''}`};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId,downloadDiagnostics:{host:safeHost(r.finalUrl||jsonUrl),status:r.status,history:r.history||[],attempt:r.attempt||0}};}
    let extracted;try{extracted=extractRegions(r.body.toString('utf8'),w,h,maxRegions);}catch(e){const error={code:'result_parse_failed',message:'云端结果解析失败：'+e.message};setSubmissionState(requestId,{phase:'failed',jobId,errorCode:error.code,message:error.message});return{ok:false,error,jobId,requestId};}
    const downloadDiagnostics={host:safeHost(r.finalUrl||jsonUrl),status:r.status,redirects:Math.max(0,(r.history||[]).length-1),attempt:r.attempt||1,directFallback:!!r.directFallback,via:(r.history||[]).slice(-1)[0]?.via||'direct'};
    const result={ok:true,engine:'PaddleOCR Official API',model,tokenSource:t.source,jobId,requestId,pollCount,submitAttempts:submittedResult.attempts.length,submitDiagnostics:submittedResult.attempts,progress,image:{width:w,height:h},regions:extracted.regions,documentBlocks:extracted.documentBlocks,markdown:extracted.markdown,pageCount:extracted.pageCount,downloadDiagnostics,message:`PaddleOCR 云端识别完成，共生成 ${extracted.regions.length} 个初始区域`};
    setSubmissionState(requestId,{phase:'done',jobId,message:result.message,submitAttempts:submittedResult.attempts.length,pollCount});
    return result;
  }
  return{status,configure,recognize,queueStatus,extractRegions,DEFAULT_JOB_URL,DEFAULT_MODEL,_test:{classifySubmitResponse,retryDelays}};
};
