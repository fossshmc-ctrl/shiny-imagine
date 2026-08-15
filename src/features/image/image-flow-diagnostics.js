
/* ===== V23 AI 生图：真实进度轮询/流式解析 + 安全失败诊断 ===== */
(function(){
  const FLOW_VERSION='V27';
  const POLL_INTERVAL=1400;
  const POLL_TIMEOUT=300000;
  const oldUi=window.imageFlowUi;
  const SESSION=window.ImageGenerationSession;
  function ensureUi(mode){
    const ui=oldUi(mode);
    if(!('progressSource' in ui))ui.progressSource='estimate';
    if(!('serverProgress' in ui))ui.serverProgress=null;
    if(!('serverStatus' in ui))ui.serverStatus='';
    if(!('serverEtaSec' in ui))ui.serverEtaSec=null;
    if(!('taskId' in ui))ui.taskId='';
    if(!('requestId' in ui))ui.requestId='';
    if(!('abortController' in ui))ui.abortController=null;
    if(SESSION&&typeof SESSION.ensure==='function')SESSION.ensure(ui);
    return ui;
  }
  window.imageFlowUi=function(mode=img.mode){return ensureUi(mode);};
  try{imageFlowUi=window.imageFlowUi;}catch(_e){}

  function clampPercent(v){
    let n=Number(v);if(!Number.isFinite(n))return null;
    if(n>0&&n<=1)n*=100;
    return Math.max(0,Math.min(100,Math.round(n)));
  }
  function safeText(v,max=280){
    let out=String(v==null?'':v);
    try{if(API_BRIDGE&&API_BRIDGE.apiKey)out=out.split(API_BRIDGE.apiKey).join('[密钥已隐藏]');}catch(_e){}
    out=out.replace(/Bearer\s+[A-Za-z0-9._~+\/-]{10,}/gi,'Bearer [已隐藏]')
      .replace(/\b(?:sk|key|token)-[A-Za-z0-9_-]{6,}/gi,'[密钥已隐藏]')
      .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi,'[图片数据已隐藏]')
      .replace(/([?&](?:key|api_key|token|access_token|secret)=)[^&\s]+/gi,'$1[已隐藏]')
      .replace(/[A-Za-z0-9+/=_-]{160,}/g,'[长数据已隐藏]');
    return out.replace(/\s+/g,' ').trim().slice(0,max)||'未提供错误摘要';
  }
  function richError(message,meta={}){
    const e=message instanceof Error?message:new Error(String(message||'接口调用失败'));
    e.httpStatus=Number(meta.httpStatus??e.httpStatus??e.status)||0;
    e.endpoint=String(meta.endpoint||e.endpoint||'');
    e.model=String(meta.model||e.model||'');
    e.stage=String(meta.stage||e.stage||'API 调用');
    e.requestId=String(meta.requestId||e.requestId||'');
    e.taskId=String(meta.taskId||e.taskId||'');
    e.parentStage=String(meta.parentStage||e.parentStage||'');
    e.channel=String(meta.channel||e.channel||'');
    e.transport=String(meta.transport||e.transport||'');
    e.route=String(meta.route||e.route||'');
    e.trace=Array.isArray(meta.trace)?meta.trace:(Array.isArray(e.trace)?e.trace:[]);
    e.safeSummary=safeText(meta.safeSummary||e.message);
    return e;
  }
  function normalizeStatus(v){return String(v||'').trim().toLowerCase().replace(/[\s-]+/g,'_');}
  function deepGet(obj,paths){
    for(const path of paths){let cur=obj;for(const k of path.split('.')){if(cur==null)break;cur=cur[k];}if(cur!==undefined&&cur!==null&&cur!=='')return cur;}
    return null;
  }
  function progressSnapshot(data,headers){
    const progress=deepGet(data||{},['progress','percent','percentage','progress_percent','progressPercent','completion','data.progress','data.percent','data.percentage','task.progress','task.percent','result.progress','output.progress','status.progress']);
    const status=deepGet(data||{},['status','state','phase','task.status','data.status','result.status','output.status']);
    const eta=deepGet(data||{},['eta','eta_seconds','etaSeconds','remaining_seconds','remainingSeconds','data.eta','task.eta']);
    const hp=headers&&Number(headers.get&& (headers.get('x-progress')||headers.get('x-task-progress')||headers.get('x-progress-percent')));
    return {percent:clampPercent(progress!=null?progress:hp),status:String(status||''),etaSec:Number.isFinite(Number(eta))?Math.max(0,Math.ceil(Number(eta))):null};
  }
  function applyServerProgress(mode,data,headers,ctx={}){
    const snap=progressSnapshot(data,headers);if(snap.percent==null)return false;
    const ui=ensureUi(mode),units=Math.max(1,Number(ctx.units)||1),unitIndex=Math.max(0,Number(ctx.unitIndex)||0);
    const overall=units>1?((unitIndex+snap.percent/100)/units)*100:snap.percent;
    ui.progressSource='server';ui.serverProgress=clampPercent(overall);ui.progress=ui.serverProgress;
    ui.serverStatus=snap.status||ui.serverStatus;ui.serverEtaSec=snap.etaSec;ui.lastServerProgressAt=Date.now();
    refreshImageFlowRuntimeDom(mode);return true;
  }
  function extractImages(data){
    const candidates=[];
    const add=v=>{if(Array.isArray(v))candidates.push(...v);else if(v)candidates.push(v);};
    add(data&&data.results);add(data&&data.data);add(data&&data.images);add(data&&data.output);add(data&&data.result&&data.result.images);add(data&&data.result&&data.result.data);add(data&&data.data&&data.data.images);add(data&&data.task&&data.task.output);
    return candidates.map(x=>{
      if(typeof x==='string')return x;
      if(!x||typeof x!=='object')return '';
      if(x.b64_json)return 'data:image/png;base64,'+x.b64_json;
      return x.url||x.image_url||x.image||x.src||x.output_url||'';
    }).filter(Boolean);
  }
  function taskInfo(data,headers){
    const status=normalizeStatus(deepGet(data||{},['status','state','phase','task.status','data.status','result.status']));
    const id=deepGet(data||{},['id','task_id','taskId','job_id','jobId','request_id','requestId','task.id','data.task_id','data.id']);
    const statusUrl=deepGet(data||{},['status_url','statusUrl','poll_url','pollUrl','task_url','taskUrl','urls.status','task.status_url','data.status_url']);
    const reqId=(headers&&headers.get&&(headers.get('x-request-id')||headers.get('request-id')||headers.get('x-task-id')))||deepGet(data||{},['request_id','requestId']);
    return {id:String(id||''),statusUrl:String(statusUrl||''),status,requestId:String(reqId||'')};
  }
  function isPendingStatus(s){return ['queued','pending','processing','running','in_progress','submitted','created','starting'].includes(normalizeStatus(s));}
  function isDoneStatus(s){return ['completed','complete','succeeded','success','finished','done','ready'].includes(normalizeStatus(s));}
  function isFailedStatus(s){return ['failed','error','cancelled','canceled','rejected','expired'].includes(normalizeStatus(s));}
  function localPollUrls(info){
    const out=[];
    const push=u=>{if(u&&!out.includes(u))out.push(u);};
    function toLocal(raw){
      raw=String(raw||'').trim();if(!raw)return '';
      try{
        if(/^https?:\/\//i.test(raw)){
          const base=new URL(API_BRIDGE.baseUrl),u=new URL(raw);
          if(base.origin!==u.origin)return '';
          let p=u.pathname+u.search,basePath=base.pathname.replace(/\/$/,'');
          if(basePath&&p.startsWith(basePath))p=p.slice(basePath.length)||'/';
          return '/api'+(p.startsWith('/')?p:'/'+p);
        }
      }catch(_e){}
      if(raw.startsWith('/api/'))return raw;
      try{
        const basePath=new URL(API_BRIDGE.baseUrl).pathname.replace(/\/$/,'');
        if(basePath&&raw.startsWith(basePath))raw=raw.slice(basePath.length)||'/';
      }catch(_e){}
      return '/api'+(raw.startsWith('/')?raw:'/'+raw);
    }
    push(toLocal(info.statusUrl));
    if(info.id){const id=encodeURIComponent(info.id);['/tasks/'+id,'/images/tasks/'+id,'/images/generations/'+id,'/generations/'+id,'/jobs/'+id].forEach(x=>push('/api'+x));}
    return out;
  }
  function parseEventLine(line){
    let raw=String(line||'').trim();if(!raw||raw==='[DONE]')return null;
    if(raw.startsWith('data:'))raw=raw.slice(5).trim();
    if(raw.startsWith('event:')||raw.startsWith(':'))return null;
    try{return JSON.parse(raw);}catch(_e){return null;}
  }
  async function readResponseWithProgress(res,meta){
    const mode=meta.mode||img.mode,decoder=new TextDecoder(),reader=res.body&&res.body.getReader?res.body.getReader():null;
    if(!reader){const txt=await res.text();let data={};try{data=txt?JSON.parse(txt):{};}catch(_e){data={raw:txt};}applyServerProgress(mode,data,res.headers,meta);return {data,text:txt};}
    let buffer='',full='',lastData=null;
    while(true){
      const part=await reader.read();if(part.done)break;
      const text=decoder.decode(part.value,{stream:true});full+=text;buffer+=text;
      let nl;while((nl=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,nl);buffer=buffer.slice(nl+1);const d=parseEventLine(line);if(d){lastData=d;applyServerProgress(mode,d,res.headers,meta);}}
    }
    full+=decoder.decode();
    if(buffer.trim()){const d=parseEventLine(buffer);if(d){lastData=d;applyServerProgress(mode,d,res.headers,meta);}}
    let data=null;try{data=full.trim()?JSON.parse(full):null;}catch(_e){}
    if(!data)data=lastData||{raw:full};
    applyServerProgress(mode,data,res.headers,meta);return {data,text:full};
  }
  async function pollTask(initial,headers,meta){
    const mode=meta.mode||img.mode,info=taskInfo(initial,headers),ui=ensureUi(mode);
    if(info.id)ui.taskId=info.id;if(info.requestId)ui.requestId=info.requestId;
    if(extractImages(initial).length)return initial;
    if(!info.statusUrl&&!info.id)return initial;
    if(info.status&&!isPendingStatus(info.status)&&!isDoneStatus(info.status))return initial;
    const urls=localPollUrls(info);if(!urls.length)return initial;
    const start=Date.now();let last=initial,lastError=null;
    while(Date.now()-start<POLL_TIMEOUT){
      const sessionId=String(meta.sessionId||ui.sessionId||'');
      if(SESSION&&sessionId&&!SESSION.isCurrent(ui,sessionId))throw Object.assign(richError('旧的生图会话已被新的任务替代',{stage:'任务轮询',model:meta.model,taskId:info.id}),{kind:'stale_generation',code:'stale_generation',generationSessionId:sessionId});
      if(ui.abortController&&ui.abortController.signal.aborted){
        const cls=SESSION&&sessionId?SESSION.classify(new DOMException('Aborted','AbortError'),ui,sessionId):null;
        throw Object.assign(richError(cls&&cls.message||'生成任务已停止',{stage:'任务轮询',model:meta.model,taskId:info.id}),{kind:cls&&cls.kind||'generation_cancelled',code:cls&&cls.kind||'generation_cancelled',generationSessionId:sessionId});
      }
      await new Promise(r=>setTimeout(r,POLL_INTERVAL));
      let got=false;
      for(const url of urls){
        let res;
        try{
          const signal=SESSION&&sessionId?SESSION.signal(ui,sessionId,{recoverUnexpected:false}):(ui.abortController&&ui.abortController.signal);
          res=await fetch(url,{method:'GET',headers:apiHeaders(),cache:'no-store',signal});
        }
        catch(e){const cls=SESSION&&sessionId?SESSION.classify(e,ui,sessionId):null;if(cls&&cls.intentional)throw Object.assign(richError(cls.message,{endpoint:url,model:meta.model,stage:'任务轮询',taskId:info.id}),{kind:cls.kind,code:cls.kind,generationSessionId:sessionId});lastError=e;continue;}
        const packet=await readResponseWithProgress(res,Object.assign({},meta,{stage:'任务轮询'}));
        if(res.status===404)continue;
        got=true;last=packet.data;
        const ti=taskInfo(last,res.headers);if(ti.id)ui.taskId=ti.id;if(ti.requestId)ui.requestId=ti.requestId;
        if(!res.ok)throw richError(deepGet(last||{},['error.message','message','error'])||('任务查询失败：HTTP '+res.status),{httpStatus:res.status,endpoint:url,model:meta.model,stage:'任务轮询',requestId:ui.requestId,taskId:ui.taskId});
        if(extractImages(last).length||isDoneStatus(ti.status))return last;
        if(isFailedStatus(ti.status))throw richError(deepGet(last||{},['error.message','message','error'])||('任务状态：'+ti.status),{httpStatus:res.status,endpoint:url,model:meta.model,stage:'服务端生成任务',requestId:ui.requestId,taskId:ui.taskId});
        break;
      }
      if(!got&&lastError&&Date.now()-start>10000)throw richError(lastError,{endpoint:urls[0],model:meta.model,stage:'任务轮询',taskId:info.id});
    }
    throw richError('服务端任务轮询超时（超过 5 分钟）',{endpoint:urls[0],model:meta.model,stage:'任务轮询',taskId:info.id});
  }
  async function flowFetch(url,options,meta={}){
    const mode=meta.mode||img.mode,ui=ensureUi(mode),sessionId=String(meta.sessionId||ui.sessionId||'');
    if(!API_BRIDGE.baseUrl||!API_BRIDGE.apiKey)throw richError('请先填写接口域名和 API 密钥',{endpoint:url,model:meta.model,stage:meta.stage||'接口配置'});
    if(SESSION&&sessionId&&!SESSION.isCurrent(ui,sessionId))throw Object.assign(richError('旧的生图请求已被新的任务替代',{endpoint:url,model:meta.model,stage:meta.stage||'请求本地代理'}),{kind:'stale_generation',code:'stale_generation',generationSessionId:sessionId});
    try{if(!API_BRIDGE.proxyReady)await checkProxy();}catch(e){throw richError(e,{endpoint:'/api/health',model:meta.model,stage:'本地代理连接'});}
    const opt=Object.assign({},options||{}),baseHeaders=apiHeaders();
    if(opt.body instanceof FormData)delete baseHeaders['Content-Type'];
    opt.headers=Object.assign(baseHeaders,opt.headers||{}, {'X-AI-Progress-Stream':'1','Accept':'text/event-stream, application/x-ndjson, application/json'});
    try{
      if(SESSION&&sessionId)opt.signal=SESSION.signal(ui,sessionId,{recoverUnexpected:true});
      else if(ui.abortController)opt.signal=ui.abortController.signal;
    }catch(e){const cls=SESSION&&sessionId?SESSION.classify(e,ui,sessionId):null;throw Object.assign(richError(cls&&cls.message||e,{endpoint:url,model:meta.model,stage:meta.stage||'请求本地代理'}),{kind:cls&&cls.kind||e.kind||'abort',code:cls&&cls.kind||e.code||'abort',generationSessionId:sessionId});}
    let res;
    try{res=await fetch(url,opt);}
    catch(e){
      const cls=SESSION&&sessionId?SESSION.classify(e,ui,sessionId):null;
      if(cls&&cls.intentional)throw Object.assign(richError(cls.message,{endpoint:url,model:meta.model,stage:meta.stage||'请求本地代理'}),{kind:cls.kind,code:cls.kind,generationSessionId:sessionId});
      if(cls&&cls.kind==='unexpected_abort'){
        const method=String(opt.method||'GET').toUpperCase(),safeRetry=method==='GET'||url==='/api/credits'||url==='/api/evolink/files/upload/reference'||url==='/api/evolink/files/upload/base64';
        dbgLog({ok:false,endpoint:url,model:meta.model||'-',status:0,error:'V27 捕获异常 AbortSignal：'+safeText(e.message)+(safeRetry?'；安全端点自动重建会话信号并重试 1 次':''),channel:'浏览器生图会话隔离'});
        if(safeRetry&&SESSION&&SESSION.isCurrent(ui,sessionId)&&ui.active!==false){
          SESSION.mark(ui,sessionId,'unexpected_abort_recovered','safe local proxy retry');ui.abortController=new AbortController();ui.controllerSessionId=sessionId;
          const retryOpt=Object.assign({},opt,{signal:ui.abortController.signal});
          try{res=await fetch(url,retryOpt);dbgLog({ok:true,endpoint:url,model:meta.model||'-',status:res.status,error:'AbortSignal 安全重试已完成',channel:'V27 浏览器安全重试'});}
          catch(e2){const cls2=SESSION.classify(e2,ui,sessionId),err=richError(cls2.message||e2,{endpoint:url,model:meta.model,stage:meta.stage||'浏览器请求中止'});err.kind=cls2.kind||'unexpected_abort';err.code=err.kind;err.generationSessionId=sessionId;throw err;}
        }else{
          const err=richError(cls.message,{endpoint:url,model:meta.model,stage:meta.stage||'浏览器请求中止'});err.kind='unexpected_abort';err.code='unexpected_abort';err.generationSessionId=sessionId;throw err;
        }
      }
      throw richError(e,{endpoint:url,model:meta.model,stage:meta.stage||'请求本地代理'});
    }
    let packet;
    try{packet=await readResponseWithProgress(res,Object.assign({},meta,{sessionId}));}
    catch(e){
      const cls=SESSION&&sessionId?SESSION.classify(e,ui,sessionId):null,method=String(opt.method||'GET').toUpperCase(),safeRetry=method==='GET'||url==='/api/credits'||url==='/api/evolink/files/upload/reference'||url==='/api/evolink/files/upload/base64';
      if(cls&&cls.intentional)throw Object.assign(richError(cls.message,{endpoint:url,model:meta.model,stage:meta.stage||'响应读取'}),{kind:cls.kind,code:cls.kind,generationSessionId:sessionId});
      if(cls&&cls.kind==='unexpected_abort'&&safeRetry&&SESSION&&SESSION.isCurrent(ui,sessionId)&&ui.active!==false){
        SESSION.mark(ui,sessionId,'unexpected_abort_recovered','safe response-read retry');ui.abortController=new AbortController();ui.controllerSessionId=sessionId;
        const retryOpt=Object.assign({},opt,{signal:ui.abortController.signal});
        let retryRes;try{retryRes=await fetch(url,retryOpt);packet=await readResponseWithProgress(retryRes,Object.assign({},meta,{sessionId}));res=retryRes;dbgLog({ok:true,endpoint:url,model:meta.model||'-',status:retryRes.status,error:'响应读取中止后安全重试成功',channel:'V27 浏览器安全重试'});}catch(e2){const cls2=SESSION.classify(e2,ui,sessionId),err=richError(cls2.message||e2,{endpoint:url,model:meta.model,stage:meta.stage||'响应读取'});err.kind=cls2.kind||'unexpected_abort';err.code=err.kind;err.generationSessionId=sessionId;throw err;}
      }else if(cls&&cls.kind==='unexpected_abort'){
        const billed=url==='/api/images/generations';
        const message=billed?'生图任务创建响应被意外中止。为避免重复创建任务或重复扣费，V27 不会自动重提计费请求；请先打开“生图任务中心”确认是否已经产生 task_id，再决定是否重新生成。':cls.message;
        const err=richError(message,{endpoint:url,model:meta.model,stage:meta.stage||'响应读取'});err.kind='unexpected_abort';err.code='unexpected_abort';err.generationSessionId=sessionId;throw err;
      }else throw e;
    }
    const data=packet.data||{};
    if(SESSION&&sessionId&&!SESSION.isCurrent(ui,sessionId))throw Object.assign(richError('旧的生图请求已结束，忽略其迟到响应',{endpoint:url,model:meta.model,stage:meta.stage||'响应处理'}),{kind:'stale_generation',code:'stale_generation',generationSessionId:sessionId});
    const ti=taskInfo(data,res.headers);if(ti.id)ui.taskId=ti.id;if(ti.requestId)ui.requestId=ti.requestId;
    if(!res.ok){
      const raw=deepGet(data,['error.message','message','error','raw'])||('HTTP '+res.status),info=typeof apiFailureInfo==='function'?apiFailureInfo(data,res.status,meta.model||'-'):{message:String(raw),kind:'api'};
      const upstreamError=data&&data.error&&typeof data.error==='object'?data.error:{};
      const failChannel=String(upstreamError.channel||'Node 本地代理 /api'),trace=Array.isArray(upstreamError.trace)?upstreamError.trace:[];
      dbgLog({ok:false,endpoint:url,model:meta.model||'-',status:res.status,error:safeText(raw,600),channel:failChannel});
      const err=richError(info.message,{httpStatus:res.status,endpoint:url,model:meta.model,stage:meta.stage||'API 请求',parentStage:meta.parentStage||'',requestId:ui.requestId,taskId:ui.taskId,channel:failChannel,transport:upstreamError.transport||'',route:upstreamError.route||'',trace});err.kind=info.kind;err.rawMessage=info.rawMsg;err.generationSessionId=sessionId;throw err;
    }
    const localMeta=data&&data.local&&typeof data.local==='object'?data.local:{};
    const successChannel=localMeta.referenceUploadChannel==='isolated'?'evolink-files/reference isolated':'Node 本地代理 /api';
    dbgLog({ok:true,endpoint:url,model:meta.model||'-',status:res.status,error:localMeta.referenceUploadChannel==='isolated'?('transport='+(localMeta.transport||'unknown')+'；route='+(localMeta.route||'unknown')+'；cache='+(localMeta.cacheHit?'hit':'miss')):'',channel:successChannel});
    return pollTask(data,res.headers,Object.assign({},meta,{sessionId}));
  }

  window.imageFlowProgressPercent=function(mode=img.mode){const ui=ensureUi(mode);if(ui.active){if(ui.progressSource==='server'&&ui.serverProgress!=null)return Math.max(0,Math.min(99,Math.round(ui.serverProgress)));return Math.max(4,Math.min(95,Math.round(ui.progress||4)));}return imageFlowCompleted(mode)?100:0;};
  try{imageFlowProgressPercent=window.imageFlowProgressPercent;}catch(_e){}
  window.imageFlowEta=function(mode=img.mode){
    const ui=ensureUi(mode);if(ui.error)return{text:'需要处理',cls:'error'};
    if(ui.active&&ui.progressSource==='server'&&ui.serverProgress!=null){const suffix=ui.serverEtaSec!=null?` · 约 ${ui.serverEtaSec} 秒`:'';return{text:`服务端进度 ${Math.round(ui.serverProgress)}%${suffix}`,cls:'running server'};}
    if(ui.active){const elapsed=Math.max(0,(Date.now()-ui.startedAt)/1000),remain=Math.max(1,Math.ceil(ui.estimateSec-elapsed));return{text:`预计剩余 ${remain} 秒 · ${window.imageFlowProgressPercent(mode)}%`,cls:'running'};}
    if(imageFlowCompleted(mode))return{text:'已完成',cls:'done'};
    return{text:`预计约 ${Math.round(imageFlowStoredEstimate(mode))} 秒`,cls:''};
  };
  try{imageFlowEta=window.imageFlowEta;}catch(_e){}
  window.refreshImageFlowRuntimeDom=function(mode=img.mode){const eta=window.imageFlowEta(mode);document.querySelectorAll(`.ai-image-flow-card[data-flow-mode="${mode}"] .ai-image-flow-eta`).forEach(el=>{el.textContent=eta.text;el.className='ai-image-flow-eta '+eta.cls;});document.querySelectorAll('[data-img-flow-progressbar]').forEach(el=>{el.style.width=window.imageFlowProgressPercent(mode)+'%';});};
  try{refreshImageFlowRuntimeDom=window.refreshImageFlowRuntimeDom;}catch(_e){}

  window.beginImageFlowGeneration=function(mode,units=1){
    clearImageFlowTimers();const ui=ensureUi(mode),base=imageFlowStoredEstimate(mode);
    const sessionId=SESSION&&typeof SESSION.begin==='function'?SESSION.begin(ui,mode):(()=>{if(ui.abortController)try{ui.abortController.abort();}catch(_e){}ui.abortController=new AbortController();ui.sessionId=mode+'-'+Date.now().toString(36);ui.controllerSessionId=ui.sessionId;return ui.sessionId;})();
    ui.active=true;ui.startedAt=Date.now();ui.units=Math.max(1,Number(units)||1);ui.estimateSec=Math.max(8,Math.min(300,Math.round(base*ui.units)));ui.progress=4;ui.progressSource='estimate';ui.serverProgress=null;ui.serverStatus='';ui.serverEtaSec=null;ui.taskId='';ui.requestId='';ui.error=null;ui.collapsed=false;ui.autoCollapseDone=false;
    imgTimers.flowTick=setInterval(()=>{if(!ui.active||String(ui.sessionId||'')!==sessionId){clearInterval(imgTimers.flowTick);imgTimers.flowTick=null;return;}if(ui.progressSource!=='server'){const elapsed=Math.max(0,(Date.now()-ui.startedAt)/1000),ratio=Math.max(0,elapsed/ui.estimateSec);ui.progress=Math.min(95,Math.max(4,Math.round((1-Math.exp(-2.35*ratio))*100)));}window.refreshImageFlowRuntimeDom(mode);},1000);
    return sessionId;
  };

  try{beginImageFlowGeneration=window.beginImageFlowGeneration;}catch(_e){}
  window.finishImageFlowGeneration=function(mode,sessionId){const ui=ensureUi(mode),sid=String(sessionId||ui.sessionId||'');if(SESSION&&sid&&!SESSION.isCurrent(ui,sid))return false;const elapsed=ui.startedAt?Math.max(1,(Date.now()-ui.startedAt)/1000):20;if(imgTimers.flowTick){clearInterval(imgTimers.flowTick);imgTimers.flowTick=null;}ui.active=false;ui.progress=100;ui.serverProgress=100;ui.lastDuration=elapsed;ui.estimateSec=imageFlowSaveEstimate(mode,elapsed/Math.max(1,ui.units));ui.error=null;ui.collapsed=false;ui.autoCollapseDone=false;if(SESSION&&sid)SESSION.end(ui,sid);else ui.abortController=null;scheduleImageFlowCollapse(mode);return true;};

  try{finishImageFlowGeneration=window.finishImageFlowGeneration;}catch(_e){}
  window.setImageFlowError=function(mode,step,messageOrError,retry,extra={}){
    const ui=ensureUi(mode),err=messageOrError instanceof Error?messageOrError:richError(messageOrError,extra),sid=String(extra.sessionId||err.generationSessionId||ui.sessionId||'');
    if(SESSION&&sid&&!SESSION.isCurrent(ui,sid)){dbgLog({ok:false,endpoint:err.endpoint||extra.endpoint||'',model:err.model||extra.model||'-',status:0,error:'忽略旧会话失败回写：'+safeText(err.message),channel:'V27 生图会话隔离'});return false;}
    clearImageFlowTimers();if(SESSION&&sid)SESSION.cancel(ui,sid,'error','generation failed');else if(ui.abortController)try{ui.abortController.abort();}catch(_e){}ui.abortController=null;
    const status=Number(err.httpStatus||extra.httpStatus)||0,abortKind=String(err.kind||err.code||'');
    ui.active=false;ui.progress=0;ui.collapsed=false;ui.autoCollapseDone=false;
    ui.error={step:Math.max(1,Math.min(5,Number(step)||4)),message:safeText(err.message,220),retry:retry||{type:'generate'},diagnostic:{statusCode:status?String(status):(err.stage==='素材读取'?'本地读取':'未获得'),model:err.model||extra.model||((typeof API_BRIDGE!=='undefined'&&API_BRIDGE.imageModel)||'未选择'),stage:err.stage||extra.stage||(Number(step)<=3?'素材读取':'主图生成'),parentStage:err.parentStage||extra.parentStage||'',endpoint:err.endpoint||extra.endpoint||'',requestId:err.requestId||ui.requestId||'',taskId:err.taskId||ui.taskId||'',sessionId:sid,abortKind,channel:err.channel||extra.channel||'',transport:err.transport||extra.transport||'',route:err.route||extra.route||'',trace:Array.isArray(err.trace)?err.trace:[],summary:err.safeSummary||safeText(err.message)}};return true;
  };

  try{setImageFlowError=window.setImageFlowError;}catch(_e){}

  function errorDiagnosticHtml(error){const d=error&&error.diagnostic;if(!d)return'';const req=[d.requestId&&`请求 ${d.requestId}`,d.taskId&&`任务 ${d.taskId}`].filter(Boolean).join(' · ')||'未返回',trace=(Array.isArray(d.trace)?d.trace:[]).slice(-4).map(x=>`${x.attempt||'?'}:${x.route||'?'}→${x.status||x.kind||'ERR'}`).join(' ｜ ');return `<details class="ai-image-flow-diagnostic"><summary>查看失败诊断</summary><div class="ai-image-flow-diagnostic-grid"><div class="ai-image-flow-diagnostic-item"><span>接口状态码</span><b>${esc(d.statusCode||'未获得')}</b></div><div class="ai-image-flow-diagnostic-item"><span>模型名称</span><b>${esc(d.model||'未选择')}</b></div><div class="ai-image-flow-diagnostic-item"><span>失败阶段</span><b>${esc(d.stage||'未知阶段')}</b></div>${d.parentStage?`<div class="ai-image-flow-diagnostic-item"><span>父流程</span><b>${esc(d.parentStage)}</b></div>`:''}<div class="ai-image-flow-diagnostic-item"><span>请求 / 任务标识</span><b>${esc(req)}</b></div>${d.channel?`<div class="ai-image-flow-diagnostic-item"><span>失败通道</span><b>${esc(d.channel)}</b></div>`:''}${d.transport||d.route?`<div class="ai-image-flow-diagnostic-item"><span>传输 / 路径</span><b>${esc([d.transport,d.route].filter(Boolean).join(' / '))}</b></div>`:''}${d.sessionId?`<div class="ai-image-flow-diagnostic-item"><span>生成会话</span><b>${esc(d.sessionId)}</b></div>`:''}${d.abortKind?`<div class="ai-image-flow-diagnostic-item"><span>中止分类</span><b>${esc(d.abortKind)}</b></div>`:''}${d.endpoint?`<div class="ai-image-flow-diagnostic-item"><span>接口路径</span><b>${esc(d.endpoint)}</b></div>`:''}${trace?`<div class="ai-image-flow-diagnostic-summary"><b>最近上传轨迹：</b>${esc(trace)}</div>`:''}<div class="ai-image-flow-diagnostic-summary"><b>安全错误摘要：</b>${esc(d.summary||error.message||'未提供')}</div></div></details>`;}
  window.imageFlowCard=function(mode){
    const isFrame=mode==='frame',ui=ensureUi(mode);let steps=[],current=1,completed=false,message='';
    if(isFrame){const hasWire=!!img.inputs.frame.wire,hasProduct=!!img.inputs.frame.product,hasRef=!!img.inputs.frame.ref,hasResult=!!(img.result&&img.mode==='frame'&&img.result.images&&img.result.images.length);steps=['线框图','产品图','参考图','生成主图','完成'];if(hasResult){current=5;completed=true;message='主图已生成，可在下方预览、重生成或批量导出。';}else if(img.generating&&img.mode==='frame'){current=4;message=ui.progressSource==='server'&&ui.serverStatus?`服务端状态：${ui.serverStatus}`:(img.progress||'正在根据线框、产品图与参考图生成主图…');}else if(!hasWire){current=1;message='先从 AI 线框生成带入线框图，或在下方上传线框图。';}else if(!hasProduct){current=2;message='线框图已准备，请上传需要保持外观一致的产品图。';}else if(!hasRef){current=3;message='产品图已准备，请上传用于约束风格、配色与光影的参考图。';}else{current=4;message='素材已齐全，请确认生成数量、比例、分辨率和质量后开始生成。';}}
    else{ensureCopySelection();rebuildCopyGroupsFromSelection(true);const hasCopy=selectedCopyIds().length>0&&img.copyGroups.length>0,hasProduct=!!img.inputs.copy.product||img.copyGroups.some(g=>!!g.product),hasRef=!!img.inputs.copy.ref||img.copyGroups.some(g=>!!g.ref),generating=img.copyGroups.some(g=>!!g.generating),hasResult=img.copyGroups.length>0&&img.copyGroups.every(g=>g.result&&g.result.images&&g.result.images.length);steps=['选择文案','产品图','参考图','生成队列','完成'];if(hasResult){current=5;completed=true;message='所选文案版本均已生成，可在各功能模块中预览或导出。';}else if(generating){current=4;message=ui.progressSource==='server'&&ui.serverStatus?`服务端状态：${ui.serverStatus}`:'正在按文案版本队列生成主图，请保持页面开启。';}else if(!hasCopy){current=1;message='先从文案排版库选择一个或多个文案版本。';}else if(!hasProduct){current=2;message='文案版本已选择，请上传统一产品图或为各模块分别上传。';}else if(!hasRef){current=3;message='产品图已准备，请上传统一参考图或为各模块分别上传。';}else{current=4;message='素材已齐全，请确认参数后生成全部队列或单独生成某个模块。';}}
    if(completed&&ui.collapsed)return `<section class="ai-image-flow-card is-collapsed" data-flow-mode="${mode}" aria-label="AI生图流程已完成"><button type="button" class="ai-image-flow-collapsed" data-img-flow-toggle><span class="ai-image-flow-collapsed-main"><span class="ai-image-flow-collapsed-check">✓</span><span><b>主图生成完成</b><small>${esc(mode==='frame'?'线框图模式结果已就绪':'所选文案队列结果已就绪')} · 点击展开流程</small></span></span><span class="ai-image-flow-collapsed-arrow">›</span></button></section>`;
    const error=ui.error;if(error){current=error.step;completed=false;message=error.message;}
    const stepHtml=steps.map((label,i)=>{const n=i+1;let cls='';if(error)cls=n===current?'error':n<current?'done':'';else cls=completed||n<current?'done':n===current?'current':'';const dot=(completed||(!error&&n<current))?'✓':error&&n===current?'!':String(n);return `<div class="ai-image-flow-step ${cls}"><span class="ai-image-flow-dot">${dot}</span><span class="ai-image-flow-label">${esc(label)}</span></div>`;}).join('');
    const stateText=error?`第 ${current} 步失败`:completed?'流程已完成':`当前第 ${current} 步`,shortLogic=isFrame?'线框图 + 产品图 + 参考图 = 主图':'排版文案 + 产品图 + 参考图 = 主图',eta=window.imageFlowEta(mode);let retryHtml='';if(error){const type=error.retry&&error.retry.type,label=type==='upload'?'重新上传':type==='config'?'配置接口':'重新生成';retryHtml=`<button type="button" class="ai-image-flow-retry" data-img-flow-retry>${label}</button>`;}
    return `<section class="ai-image-flow-card" data-flow-mode="${mode}" aria-label="AI生图流程"><div class="ai-image-flow-head"><div><b>${esc(MODE_SHORT[mode])}生成流程</b><small>${esc(shortLogic)}</small></div><div class="ai-image-flow-meta"><span class="ai-image-flow-state ${error?'error':completed?'done':''}">${stateText}</span><span class="ai-image-flow-eta ${eta.cls}">${eta.text}</span></div></div><div class="ai-image-flow-track ${error?'has-error':''}">${stepHtml}</div><div class="ai-image-flow-message ${error?'error':''}" aria-live="polite"><span class="ai-image-flow-progress-note ${ui.progressSource==='server'?'ai-image-flow-server-note':''}">${esc(message)}</span>${retryHtml}${errorDiagnosticHtml(error)}</div><details class="ai-image-flow-details"><summary>查看完整逻辑规则</summary><div class="ai-image-flow-rule">${esc(img.builtin[mode])}</div></details></section>`;
  };
  try{imageFlowCard=window.imageFlowCard;}catch(_e){}

  function imageArray(data){return extractImages(data);}
  window.apiImageEditMulti=async function(prompt,model,imageDataUrls,count,aspect,progressCtx={}){
    const useModel=model||requireModel('image'),mode=progressCtx.mode||img.mode,urls=(imageDataUrls||[]).filter(Boolean);if(!urls.length)throw richError('没有可用于编辑的图片',{model:useModel,stage:'素材准备'});
    const evo=window.EvoLinkImageAdapter;if(evo&&evo.isEvolinkBase(API_BRIDGE.baseUrl)){const opt=currentImageGenerationOptions();return evo.generate({fetchJson:flowFetch,prompt,model:useModel,count:count||1,aspect,refs:urls,resolution:opt.resolution,quality:opt.quality,meta:{mode,model:useModel,stage:progressCtx.stage||'EvoLink 图生图/编辑',unitIndex:progressCtx.unitIndex||0,units:progressCtx.units||1,sessionId:progressCtx.sessionId||ensureUi(mode).sessionId}});}
    const fd=new FormData();fd.append('model',useModel);fd.append('prompt',prompt);fd.append('n',String(count||1));if(aspect)fd.append('size',aspectToSize(aspect));
    try{if(urls.length===1)fd.append('image',dataURLtoBlob(urls[0]),'image.png');else urls.forEach((u,i)=>fd.append('image[]',dataURLtoBlob(u),'image'+i+'.png'));}catch(e){throw richError('图片处理失败：'+e.message,{model:useModel,stage:'素材读取'});}
    const data=await flowFetch('/api/images/edits',{method:'POST',body:fd},{mode,model:useModel,stage:progressCtx.stage||'多图编辑接口',unitIndex:progressCtx.unitIndex||0,units:progressCtx.units||1,sessionId:progressCtx.sessionId||ensureUi(mode).sessionId});
    const imgs=imageArray(data);if(!imgs.length)throw richError('编辑接口返回空结果',{model:useModel,stage:'结果解析',endpoint:'/api/images/edits'});return imgs;
  };
  try{apiImageEditMulti=window.apiImageEditMulti;}catch(_e){}
  window.apiImage=async function(prompt,model,count,aspect,refImages,progressCtx={}){
    const useModel=model||requireModel('image'),mode=progressCtx.mode||img.mode,refs=(refImages||[]).filter(Boolean);
    const evo=window.EvoLinkImageAdapter;if(evo&&evo.isEvolinkBase(API_BRIDGE.baseUrl)){const opt=currentImageGenerationOptions();return evo.generate({fetchJson:flowFetch,prompt,model:useModel,count:count||1,aspect,refs,resolution:opt.resolution,quality:opt.quality,meta:{mode,model:useModel,stage:progressCtx.stage||(refs.length?'EvoLink 图生图':'EvoLink 文生图'),unitIndex:progressCtx.unitIndex||0,units:progressCtx.units||1,sessionId:progressCtx.sessionId||ensureUi(mode).sessionId}});}
    const mkBody=(withRefs,sizeOverride)=>{const b={model:useModel,prompt,n:count||1,size:sizeOverride||aspectToSize(aspect||'1:1')};if(withRefs&&refs.length)b.image=refs.length===1?refs[0]:refs;return b;};
    const fire=(withRefs,sizeOverride,stage)=>flowFetch('/api/images/generations',{method:'POST',body:JSON.stringify(mkBody(withRefs,sizeOverride))},{mode,model:useModel,stage:stage||progressCtx.stage||'普通生图接口',unitIndex:progressCtx.unitIndex||0,units:progressCtx.units||1,sessionId:progressCtx.sessionId||ensureUi(mode).sessionId});
    const isSizeErr=msg=>/size|divisible|尺寸|width\s*and\s*height|must be one of/i.test(msg),isRefErr=msg=>/image|images|field|param|unsupported|invalid|400|不支持|bad\s*request/i.test(msg);let data;
    try{data=await fire(refs.length>0,null,'普通生图接口');}
    catch(e){if(isSizeErr(e.message)){try{data=await fire(refs.length>0,'1024x1024','尺寸兼容重试');}catch(e3){if(refs.length&&isRefErr(e3.message)){try{data=await fire(false,'1024x1024','无参考图兼容重试');apiToast('该接口未接受参考底图，已改为仅用「内置提示词 + 文案」生图',true);}catch(e4){throw richError(imgErr(e4,useModel),{model:useModel,stage:e4.stage||'普通生图回退'});}}else throw richError(imgErr(e3,useModel),{model:useModel,stage:e3.stage||'尺寸兼容重试'});}}
      else if(refs.length&&isRefErr(e.message)){try{data=await fire(false,null,'无参考图兼容重试');apiToast('注意：该生图接口未接受参考底图，已改为仅用「内置提示词 + 文案」生图（文案仍然生效）',true);}catch(e2){if(isSizeErr(e2.message)){try{data=await fire(false,'1024x1024','无参考图尺寸重试');}catch(e5){throw richError(imgErr(e5,useModel),{model:useModel,stage:e5.stage||'无参考图尺寸重试'});}}else throw richError(imgErr(e2,useModel),{model:useModel,stage:e2.stage||'无参考图兼容重试'});}}
      else throw richError(imgErr(e,useModel),{model:useModel,stage:e.stage||'普通生图接口'});}
    const imgs=imageArray(data);if(!imgs.length)throw richError(`生图接口返回空结果；请确认所选生图模型「${useModel}」可用。`,{model:useModel,stage:'结果解析',endpoint:'/api/images/generations'});return imgs;
  };
  try{apiImage=window.apiImage;}catch(_e){}

  window.startImgGen=async function(groupIdx=null){
    const m=img.mode;try{requireModel('image');}catch(err){window.setImageFlowError(m,4,richError(err,{model:API_BRIDGE.imageModel,stage:'接口配置'}),{type:'config'});renderImageView();openImgCfg();apiToast(err.message,true);return;}
    const actionKey='image-api-generate';if(actionBusy[actionKey]||img.generating||img.copyGroups.some(g=>g.generating)){setActionStatus('loading','生图任务正在进行，请勿重复点击…',false);return;}
    if(m==='frame'){
      const a=img.inputs.frame.wire,b=img.inputs.frame.product,c=img.inputs.frame.ref;if(!a||!b||!c){apiToast('请先准备好「AI生成的线框图」「产品图」「参考图」',true);return;}if(!actionLock(actionKey,document.querySelector('[data-imggen]')))return;
      setActionStatus('loading','正在通过 API 生成主图…',true);const generationSessionId=window.beginImageFlowGeneration('frame',1);img.generating=true;img.progress='API 生图中：线框图 + 产品图 + 参考图 → 主图';img.result=null;renderImageView();
      try{let images;if(isEvolinkImageChannel()){images=await window.apiImageEditMulti(composeImagePromptFromFrame(),API_BRIDGE.imageModel,[a.src,b.src,c.src],img.count,img.aspect,{mode:'frame',stage:'EvoLink 多图编辑',unitIndex:0,units:1,sessionId:generationSessionId});}else{try{images=await window.apiImageEditMulti(composeImagePromptFromFrame(),API_BRIDGE.imageModel,[a.src,b.src,c.src],img.count,img.aspect,{mode:'frame',stage:'多图编辑接口',unitIndex:0,units:1,sessionId:generationSessionId});}catch(editErr){dbgLog({ok:false,endpoint:'/api/images/edits',model:API_BRIDGE.imageModel,status:editErr.httpStatus||0,error:'非 EvoLink 多图编辑不可用，回退生成接口：'+editErr.message,channel:'兼容回退'});apiToast('当前非 EvoLink 通道的编辑调用失败，正在尝试兼容生成路径。',true);images=await window.apiImage(composeImagePromptFromFrame(),API_BRIDGE.imageModel,img.count,img.aspect,[a.src,b.src,c.src],{mode:'frame',stage:'普通生图回退',unitIndex:0,units:1,sessionId:generationSessionId});}}
        if(!images.length)images=resultImagesFrom(a.src,img.count);img.generating=false;img.result={time:nowStr(),images};img.history.unshift({id:uid(),mode:m,time:nowStr(),inputs:cloneObj(img.inputs.frame),builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:images[0]||a.src});window.finishImageFlowGeneration('frame',generationSessionId);renderImageView();actionDone(actionKey,'已生成 '+img.count+' 张主图');}
      catch(err){img.generating=false;{const cls=SESSION?SESSION.classify(err,ensureUi('frame'),generationSessionId):null;if(cls&&cls.intentional){if(cls.stale)return;img.generating=false;renderImageView();actionUnlock(actionKey);setActionStatus('success',cls.message,false);return;}img.generating=false;window.setImageFlowError('frame',4,err,{type:'generate',groupIdx:null},{model:API_BRIDGE.imageModel,sessionId:generationSessionId});renderImageView();actionFail(actionKey,'生图 API 调用失败：'+safeText(err.message));}}return;
    }
    rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();const targets=groupIdx==null?img.copyGroups:[img.copyGroups[groupIdx]].filter(Boolean);if(!targets.length){apiToast('请先选择文案版本并生成任务队列',true);return;}const notReady=targets.find(g=>!g.poster||!(g.product||img.inputs.copy.product)||!(g.ref||img.inputs.copy.ref));if(notReady){apiToast('请确认每组都有排版文案、产品图和参考图',true);return;}
    const genBtn=groupIdx==null?document.querySelector('[data-imggencopyall],[data-imggen]'):document.querySelector('[data-imggengroup="'+groupIdx+'"]');if(!actionLock(actionKey,genBtn))return;setActionStatus('loading','正在生成 '+targets.length+' 个主图任务…',true);const generationSessionId=window.beginImageFlowGeneration('copy',targets.length);targets.forEach(g=>{g.generating=true;g.result=null;});img.generating=groupIdx==null;renderImageView();
    try{for(let ti=0;ti<targets.length;ti++){const g=targets[ti],gi=img.copyGroups.indexOf(g),_prod=(g.product||img.inputs.copy.product),_ref=(g.ref||img.inputs.copy.ref);let images;if(isEvolinkImageChannel()){images=await window.apiImageEditMulti(composeImagePromptFromCopyGroup(g,gi),API_BRIDGE.imageModel,[_prod&&_prod.src,_ref&&_ref.src],img.count,img.aspect,{mode:'copy',stage:`队列 ${ti+1} EvoLink 多图编辑`,unitIndex:ti,units:targets.length,sessionId:generationSessionId});}else{try{images=await window.apiImageEditMulti(composeImagePromptFromCopyGroup(g,gi),API_BRIDGE.imageModel,[_prod&&_prod.src,_ref&&_ref.src],img.count,img.aspect,{mode:'copy',stage:`队列 ${ti+1} 多图编辑`,unitIndex:ti,units:targets.length,sessionId:generationSessionId});}catch(editErr){dbgLog({ok:false,endpoint:'/api/images/edits',model:API_BRIDGE.imageModel,status:editErr.httpStatus||0,error:'非 EvoLink 多图编辑不可用，回退生成接口：'+editErr.message,channel:'兼容回退'});images=await window.apiImage(composeImagePromptFromCopyGroup(g,gi),API_BRIDGE.imageModel,img.count,img.aspect,[_prod&&_prod.src,_ref&&_ref.src],{mode:'copy',stage:`队列 ${ti+1} 普通生图回退`,unitIndex:ti,units:targets.length,sessionId:generationSessionId});}}const base=(g.ref||img.inputs.copy.ref).src;if(!images.length)images=resultImagesFrom(base,img.count);g.generating=false;g.result={time:nowStr(),images};img.history.unshift({id:uid(),mode:m,time:nowStr(),label:g.label,poster:g.poster,inputs:{product:g.product||img.inputs.copy.product,ref:g.ref||img.inputs.copy.ref},builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:images[0]||base});renderImageView();}
      img.generating=false;window.finishImageFlowGeneration('copy',generationSessionId);renderImageView();actionDone(actionKey,'已完成 '+targets.length+' 个队列任务');}
    catch(err){const cls=SESSION?SESSION.classify(err,ensureUi('copy'),generationSessionId):null;if(cls&&cls.intentional){if(cls.stale)return;targets.forEach(g=>g.generating=false);img.generating=false;renderImageView();actionUnlock(actionKey);setActionStatus('success',cls.message,false);return;}targets.forEach(g=>g.generating=false);img.generating=false;window.setImageFlowError('copy',4,err,{type:'generate',groupIdx},{model:API_BRIDGE.imageModel,sessionId:generationSessionId});renderImageView();actionFail(actionKey,'队列 API 调用失败：'+safeText(err.message));}
  };
  try{startImgGen=window.startImgGen;}catch(_e){}

  const oldStop=window.stopImgGen;
  window.stopImgGen=function(){const ui=ensureUi(img.mode),sid=String(ui.sessionId||'');if(SESSION&&sid)SESSION.cancel(ui,sid,'user','user clicked stop generation');else if(ui.abortController)try{ui.abortController.abort();}catch(_e){}const out=oldStop.apply(this,arguments);if(SESSION&&sid)SESSION.end(ui,sid);else ui.abortController=null;return out;};
  try{stopImgGen=window.stopImgGen;}catch(_e){}
  window.__V229_IMAGE_FLOW_DIAGNOSTICS__=function(){const ui=ensureUi(img.mode);return{version:FLOW_VERSION,mode:img.mode,active:ui.active,sessionId:ui.sessionId||'',controllerSessionId:ui.controllerSessionId||'',progressSource:ui.progressSource,serverProgress:ui.serverProgress,serverStatus:ui.serverStatus,taskId:ui.taskId,requestId:ui.requestId,error:ui.error&&ui.error.diagnostic||null};};
})();
