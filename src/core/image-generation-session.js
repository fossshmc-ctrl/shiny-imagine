/* ===== V27 AI 生图会话隔离：防止旧请求/旧 AbortController 污染新任务 ===== */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ImageGenerationSession=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  const ABORT_RE=/\bAbortError\b|signal\s+is\s+aborted|aborted\s+without\s+reason|operation\s+was\s+aborted|The user aborted a request|请求已中止|已停止生成/i;
  function ensure(ui){
    if(!ui||typeof ui!=='object')throw new Error('image generation ui state required');
    if(!Number.isFinite(Number(ui.sessionSeq)))ui.sessionSeq=0;
    if(!ui.abortHistory||typeof ui.abortHistory!=='object')ui.abortHistory={};
    if(!('sessionId' in ui))ui.sessionId='';
    if(!('controllerSessionId' in ui))ui.controllerSessionId='';
    if(!('abortController' in ui))ui.abortController=null;
    return ui;
  }
  function trimHistory(ui){
    const keys=Object.keys(ui.abortHistory||{}).sort((a,b)=>Number((ui.abortHistory[a]||{}).at||0)-Number((ui.abortHistory[b]||{}).at||0));
    while(keys.length>12){const k=keys.shift();delete ui.abortHistory[k];}
  }
  function mark(ui,sessionId,type,detail){
    ensure(ui);if(!sessionId)return;
    ui.abortHistory[sessionId]={type:String(type||'unknown'),detail:String(detail||''),at:Date.now()};trimHistory(ui);
  }
  function abortController(ui,sessionId,type,detail){
    ensure(ui);if(!sessionId||ui.controllerSessionId!==sessionId||!ui.abortController)return false;
    mark(ui,sessionId,type,detail);
    try{
      if(!ui.abortController.signal.aborted){
        try{ui.abortController.abort(String(type||'abort'));}catch(_e){ui.abortController.abort();}
      }
    }catch(_e){}
    return true;
  }
  function begin(ui,mode){
    ensure(ui);
    const oldId=String(ui.sessionId||'');
    if(oldId&&ui.abortController)abortController(ui,oldId,'superseded','new generation session started');
    ui.sessionSeq=Number(ui.sessionSeq||0)+1;
    const id=String(mode||'image')+'-'+Date.now().toString(36)+'-'+ui.sessionSeq.toString(36);
    ui.sessionId=id;
    ui.abortController=new AbortController();
    ui.controllerSessionId=id;
    ui.lastSessionStartedAt=Date.now();
    return id;
  }
  function isCurrent(ui,sessionId){ensure(ui);return !!sessionId&&String(ui.sessionId||'')===String(sessionId);}
  function history(ui,sessionId){ensure(ui);return (ui.abortHistory&&ui.abortHistory[String(sessionId||'')])||null;}
  function signal(ui,sessionId,{recoverUnexpected=true}={}){
    ensure(ui);
    if(!isCurrent(ui,sessionId)){
      const e=new Error('旧的生图会话已被新的任务替代');e.kind='stale_generation';e.code='stale_generation';e.generationSessionId=sessionId;throw e;
    }
    if(!ui.abortController||ui.controllerSessionId!==sessionId){ui.abortController=new AbortController();ui.controllerSessionId=sessionId;}
    if(ui.abortController.signal.aborted){
      const h=history(ui,sessionId);
      if(h&&h.type==='user'){
        const e=new Error('生成任务已由用户停止');e.kind='generation_cancelled';e.code='generation_cancelled';e.generationSessionId=sessionId;throw e;
      }
      if(h&&h.type==='superseded'){
        const e=new Error('旧的生图会话已被新的任务替代');e.kind='stale_generation';e.code='stale_generation';e.generationSessionId=sessionId;throw e;
      }
      if(recoverUnexpected){
        mark(ui,sessionId,'unexpected_abort_recovered','rotated AbortController before local proxy request');
        ui.abortController=new AbortController();ui.controllerSessionId=sessionId;
      }
    }
    return ui.abortController.signal;
  }
  function cancel(ui,sessionId,type='user',detail=''){
    ensure(ui);if(!sessionId)sessionId=ui.sessionId;
    abortController(ui,sessionId,type,detail);
    return sessionId;
  }
  function end(ui,sessionId){
    ensure(ui);if(!isCurrent(ui,sessionId))return false;
    ui.abortController=null;ui.controllerSessionId='';return true;
  }
  function isAbortLike(error){
    if(!error)return false;
    return error.name==='AbortError'||error.code==='ABORT_ERR'||ABORT_RE.test(String(error.message||error));
  }
  function classify(error,ui,sessionId){
    ensure(ui);
    if(!isCurrent(ui,sessionId))return {kind:'stale_generation',stale:true,intentional:true,message:'旧的生图请求已结束，不影响当前任务'};
    const h=history(ui,sessionId);
    if(h&&h.type==='user')return {kind:'generation_cancelled',stale:false,intentional:true,message:'生成任务已由用户停止'};
    if(h&&h.type==='superseded')return {kind:'stale_generation',stale:true,intentional:true,message:'旧的生图请求已被新的任务替代'};
    if(isAbortLike(error))return {kind:'unexpected_abort',stale:false,intentional:false,message:'浏览器到本地代理的请求被意外中止；V27 已隔离旧任务 AbortController，可重新生成。'};
    return {kind:'error',stale:false,intentional:false,message:String(error&&error.message||error||'请求失败')};
  }
  return {ensure,begin,isCurrent,signal,cancel,end,mark,history,isAbortLike,classify};
});
