(function(){
  'use strict';
  const VERSION='V28.1.1';
  const STORAGE_KEY='ai_v225_region_micro_adjust_output_channel';
  let memory=null;
  function meter(){return window.MicroPerformanceMeterV276||window.MicroPerformanceMeterV275||window.MicroPerformanceMeterV274||null;}
  function regionState(){
    try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}
  }
  function currentIdentity(){
    const s=regionState();
    return {
      imageKey:String(s?.v22ImageKey||s?.result?.imageKey||''),
      imageRevision:Number(s?.v22ImageRevision||s?.result?.imageRevision)||0,
      recognitionEpoch:Number(s?.v22AppliedRecognitionEpoch||s?.result?.recognitionEpoch)||0,
      imageName:String(s?.name||((typeof adjustState!=='undefined'&&adjustState?.name)||'')),baseMode:String(s?.microBaseMode||'current')
    };
  }
  function safeGet(){
    try{const raw=sessionStorage.getItem(STORAGE_KEY);if(!raw)return null;const data=JSON.parse(raw);return data&&data.phase?data:null;}catch(_e){return null;}
  }
  function safeSet(data){
    try{
      if(!data){sessionStorage.removeItem(STORAGE_KEY);return;}
      const json=JSON.stringify(data);
      if(json.length<4_500_000)sessionStorage.setItem(STORAGE_KEY,json);
      else sessionStorage.setItem(STORAGE_KEY,JSON.stringify(Object.assign({},data,{src:'',oversized:true,error:'生成结果过大，未写入会话缓存'})));
    }catch(_e){}
  }
  function belongsToCurrent(data){
    if(!data)return false;
    const cur=currentIdentity();
    if(cur.imageKey&&data.imageKey&&cur.imageKey!==data.imageKey)return false;
    if(cur.imageRevision&&data.imageRevision&&cur.imageRevision!==data.imageRevision)return false;
    return true;
  }
  function emit(type,data){try{window.dispatchEvent(new CustomEvent(type,{detail:data||null}));}catch(_e){}}
  function write(next,eventName='v225-micro-adjust-output'){
    memory=Object.assign({version:VERSION,channel:'region-micro-adjust-output-v276',updatedAt:new Date().toISOString()},next||{});
    safeSet(memory);emit(eventName,memory);return memory;
  }
  function begin(meta={}){
    const id=currentIdentity(),performance=meta.performance||meter()?.snapshot?.()||null;
    const incomingSession=String(meta.sessionId||performance?.sessionId||'');
    const storedSession=String(memory?.performance?.sessionId||memory?.sessionId||'');
    // V27.9 only preserves the in-flight record when both calls belong to the same click-meter
    // session. A second click always receives a new session and cannot inherit a stale "generating".
    const sameSession=!!(memory&&memory.phase==='generating'&&belongsToCurrent(memory)&&incomingSession&&storedSession===incomingSession);
    const generationId=String(meta.generationId||performance?.generationId||(sameSession?memory.generationId:'')||`micro_output_${Date.now()}_${Math.random().toString(36).slice(2,7)}`);
    return write(Object.assign({},sameSession?memory:{},id,meta,{phase:'generating',src:'',error:'',sessionId:incomingSession,generationId,startedAt:sameSession?memory.startedAt:new Date().toISOString(),performance:performance||memory?.performance||null}));
  }
  function candidatePayload(item,batch,index,reason){
    const id=currentIdentity(),quality=item?.quality||{},performance=batch?.performance||meter()?.snapshot?.()||memory?.performance||null;
    return Object.assign({},id,{
      phase:'ready',src:String(item?.src||''),name:`智能区域微调结果 ${index+1}`,reason:String(reason||'candidate-ready'),candidateIndex:index,candidateCount:Array.isArray(batch?.results)?batch.results.length:1,rank:Number(item?.rank)||index+1,rankScore:item?.rankScore??quality.score??null,quality,regression:item?.regression||null,regionIds:Array.isArray(batch?.ids)?batch.ids.slice():[],prompt:String(batch?.prompt||''),generatedAt:new Date().toLocaleString('zh-CN'),sessionId:String(performance?.sessionId||memory?.sessionId||''),generationId:String(performance?.generationId||memory?.generationId||`micro_${Date.now()}`),performance
    });
  }
  function publishBatch(reason='candidate-ready'){
    let batch=null;
    try{batch=typeof adjustState!=='undefined'?adjustState?.candidateBatch:null;}catch(_e){}
    const results=Array.isArray(batch?.results)?batch.results:[];
    if(!results.length)return null;
    let index=results.findIndex(x=>Number(x?.rank)===1);if(index<0)index=0;
    return write(candidatePayload(results[index],batch,index,reason));
  }
  function publishSelected(index,reason='candidate-selected'){
    let batch=null;
    try{batch=typeof adjustState!=='undefined'?adjustState?.candidateBatch:null;}catch(_e){}
    const item=batch?.results?.[Number(index)];if(!item)return null;
    return write(Object.assign(candidatePayload(item,batch,Number(index),reason),{selected:true,name:'已选用的智能区域微调结果'}));
  }
  function fail(error){
    const id=currentIdentity(),performance=meter()?.snapshot?.()||memory?.performance||null;
    return write(Object.assign({},id,{phase:'error',src:'',error:String(error?.message||error||'微调生成失败'),failedAt:new Date().toISOString(),sessionId:String(performance?.sessionId||memory?.sessionId||''),generationId:String(performance?.generationId||memory?.generationId||`micro_${Date.now()}`),performance}));
  }
  function get(){const data=memory||safeGet();if(!data||!belongsToCurrent(data))return null;memory=data;return data;}
  function clear(reason='manual-clear'){memory=null;safeSet(null);emit('v225-micro-adjust-output-cleared',{reason});}
  window.__V225_GET_MICRO_ADJUST_OUTPUT__=get;
  window.__V225_BEGIN_MICRO_ADJUST_GENERATION__=begin;
  window.__V225_PUBLISH_MICRO_ADJUST_BATCH__=publishBatch;
  window.__V225_PUBLISH_MICRO_ADJUST_SELECTED__=publishSelected;
  window.__V225_FAIL_MICRO_ADJUST_GENERATION__=fail;
  window.__V225_CLEAR_MICRO_ADJUST_OUTPUT__=clear;
  window.__V225_MICRO_ADJUST_DIAGNOSTICS__=function(){const current=get(),id=currentIdentity();return{version:VERSION,channel:'region-micro-adjust-output-v276',phase:current?.phase||'idle',hasOutput:!!current?.src,currentImageKey:id.imageKey,outputImageKey:current?.imageKey||'',baseMode:current?.baseMode||id.baseMode||'current',sessionId:current?.sessionId||'',generationId:current?.generationId||'',candidateCount:Number(current?.candidateCount)||0,performance:current?.performance||null,recognitionFallback:false,primaryAiImageFallback:false,rightPaneSelector:'#v15-ocr-overlay .v225-output-stage'};};

  window.addEventListener('v276-micro-performance',event=>{
    const performance=event?.detail;if(!performance)return;
    const current=memory||safeGet();if(!current||!belongsToCurrent(current))return;
    // Do not let a delayed event from a previous click overwrite the current run.
    const currentSession=String(current.sessionId||current.performance?.sessionId||''),eventSession=String(performance.sessionId||'');
    if(currentSession&&eventSession&&currentSession!==eventSession)return;
    write(Object.assign({},current,{sessionId:eventSession||currentSession,generationId:String(performance.generationId||current.generationId||''),performance}));
  });

  const original=typeof window.adjustGenerateCandidates==='function'?window.adjustGenerateCandidates:null;
  if(original&&!original.__v225MicroOutputWrapped){
    const wrapped=async function(ids,opts={}){
      const performance=meter()?.snapshot?.()||null;
      begin({regionIds:Array.isArray(ids)?ids.slice():[],source:['v276','v275'].includes(opts?.directBridge)?'region-workbench-direct-v276':'region-workbench',sessionId:String(opts?.microRunSessionId||performance?.sessionId||''),generationId:String(opts?.microRunId||performance?.generationId||''),performance});
      try{
        const result=await original.apply(this,arguments);
        const published=publishBatch('generation-complete');
        if(!published){
          let status='',type='';
          try{status=String(adjustState?.aiStatus||'');type=String(adjustState?.aiStatusType||'');}catch(_e){}
          if(result?.ok===false)fail(result.error||result.message||status||'微调生成失败');
          else if(type==='bad'||/失败|错误/.test(status))fail(status||'微调生成失败');
          else fail('生成任务未返回可用图片');
        }
        return result;
      }catch(error){fail(error);throw error;}
    };
    wrapped.__v225MicroOutputWrapped=true;wrapped.__v225Original=original;
    window.adjustGenerateCandidates=wrapped;try{adjustGenerateCandidates=wrapped;}catch(_e){}
  }

  const originalConfirm=typeof window.adjustConfirmCandidateApply==='function'?window.adjustConfirmCandidateApply:null;
  if(originalConfirm&&!originalConfirm.__v225MicroOutputWrapped){
    const wrappedConfirm=async function(index){
      let payload=null;
      try{const batch=typeof adjustState!=='undefined'?adjustState?.candidateBatch:null,item=batch?.results?.[Number(index)];if(item)payload=Object.assign(candidatePayload(item,batch,Number(index),'candidate-confirmed'),{selected:true,name:'已选用的智能区域微调结果'});}catch(_e){}
      const result=await originalConfirm.apply(this,arguments);if(payload)write(payload);return result;
    };
    wrappedConfirm.__v225MicroOutputWrapped=true;wrappedConfirm.__v225Original=originalConfirm;
    window.adjustConfirmCandidateApply=wrappedConfirm;try{adjustConfirmCandidateApply=wrappedConfirm;}catch(_e){}
  }
})();
