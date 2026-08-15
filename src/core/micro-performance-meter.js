/* V27.9 Smart Region micro-adjust click-to-image performance meter. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.MicroPerformanceMeterV276=api;root.MicroPerformanceMeterV275=api;root.MicroPerformanceMeterV274=api;}
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const VERSION='V28.1.1';
  const PHASES=['preflight','sync','compress','upload','submit','providerQueue','generation','result','postCheck'];
  let current=null;
  const mono=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now();
  const wall=()=>Date.now();
  const finite=v=>Number.isFinite(Number(v))?Math.max(0,Math.round(Number(v))):0;
  function emit(){
    if(!root||typeof root.dispatchEvent!=='function')return;
    const detail=snapshot();
    try{root.dispatchEvent(new CustomEvent('v276-micro-performance',{detail}));}catch(_e){}
    try{root.dispatchEvent(new CustomEvent('v275-micro-performance',{detail}));}catch(_e){}
    // Compatibility for older listeners in mixed/cached pages. V27.9 listeners use the new event.
    try{root.dispatchEvent(new CustomEvent('v274-micro-performance',{detail}));}catch(_e){}
  }
  function create(meta={}){
    const phases={};PHASES.forEach(x=>phases[x]=0);
    const startMono=mono(),startEpoch=wall();
    return{version:VERSION,sessionId:String(meta.sessionId||`micro_perf_${startEpoch}_${Math.random().toString(36).slice(2,7)}`),generationId:String(meta.generationId||''),source:String(meta.source||'smart-region-workbench'),status:'running',startedAt:new Date(startEpoch).toISOString(),startedEpochMs:startEpoch,startedMonoMs:startMono,updatedAt:new Date(startEpoch).toISOString(),imageReadyAt:'',completedAt:'',failedAt:'',error:'',phases,phaseStarted:{},clickToImageMs:0,totalMs:0,providerResultMs:0,creditsMs:0,creditsSkipped:false,preflightMode:'',handoffStatus:String(meta.handoffStatus||'waiting'),referenceCount:0,referenceBeforeBytes:0,referenceAfterBytes:0,taskId:'',taskStates:[],statusPath:[],queueObserved:false,providerSplitObserved:false,softTimeoutReached:false,pollRetryCount:0,networkStallMs:0,pollTimeoutBudgetMs:0,pollMaxTimeoutMs:0,sameTaskOnly:true,unattributedToImageMs:0,meta:Object.assign({},meta||{})};
  }
  function ensure(meta={}){if(!current)current=create(meta);return current;}
  function begin(meta={}){current=create(meta);emit();return snapshot();}
  function annotate(meta={}){const s=ensure();s.meta=Object.assign({},s.meta||{},meta||{});if(meta.generationId!==undefined)s.generationId=String(meta.generationId||'');if(meta.preflightMode!==undefined)s.preflightMode=String(meta.preflightMode||'');if(meta.handoffStatus!==undefined)s.handoffStatus=String(meta.handoffStatus||'');s.updatedAt=new Date().toISOString();emit();return snapshot();}
  function startPhase(name){const s=ensure();if(!PHASES.includes(name))return 0;if(!s.phaseStarted[name])s.phaseStarted[name]=mono();s.updatedAt=new Date().toISOString();emit();return s.phaseStarted[name];}
  function endPhase(name){const s=ensure();if(!PHASES.includes(name))return 0;const started=s.phaseStarted[name];if(started){s.phases[name]=finite((s.phases[name]||0)+(mono()-started));delete s.phaseStarted[name];}s.updatedAt=new Date().toISOString();emit();return s.phases[name]||0;}
  function setPhase(name,value){const s=ensure();if(!PHASES.includes(name))return 0;s.phases[name]=finite(value);delete s.phaseStarted[name];s.updatedAt=new Date().toISOString();emit();return s.phases[name];}
  function normalizeTaskStatus(update={}){
    const raw=String(update.status||'').toLowerCase().replace(/[\s-]+/g,'_');
    const hasResult=Array.isArray(update.resultUrls)&&update.resultUrls.length>0;
    if(hasResult||['completed','complete','succeeded','success','done','finished'].includes(raw))return'completed';
    if(['failed','error','cancelled','canceled','timeout'].includes(raw))return raw==='timeout'?'timeout':'failed';
    if(['processing','running','in_progress','generating','active'].includes(raw)||Number(update.progress)>0)return'processing';
    return'pending';
  }
  function recordTask(update={}){
    const s=ensure(),status=normalizeTaskStatus(update),atMs=finite(mono()-s.startedMonoMs),taskId=String(update.taskId||s.taskId||''),rawStatus=String(update.rawStatus||update.status||'');
    if(taskId)s.taskId=taskId;
    const progress=Number.isFinite(Number(update.progress))?Math.max(0,Math.min(100,Math.round(Number(update.progress)))):0;
    s.softTimeoutReached=s.softTimeoutReached||update.softTimeoutReached===true;s.pollRetryCount=Math.max(s.pollRetryCount,finite(update.pollRetryCount));s.networkStallMs=Math.max(s.networkStallMs,finite(update.networkStallMs));s.pollTimeoutBudgetMs=Math.max(s.pollTimeoutBudgetMs,finite(update.pollTimeoutBudgetMs));s.pollMaxTimeoutMs=Math.max(s.pollMaxTimeoutMs,finite(update.pollMaxTimeoutMs));s.sameTaskOnly=update.sameTaskOnly!==false;
    if(!s.taskStates.length&&status!=='pending'){s.taskStates.push({status:'pending',rawStatus,atMs,taskId,progress:0,estimatedTime:null,inferred:true});s.statusPath.push('pending');}
    if(status==='completed'&&!s.statusPath.includes('processing')){
      const pending=s.taskStates.find(x=>x.status==='pending'),inferredAt=pending?pending.atMs:atMs;
      s.taskStates.push({status:'processing',rawStatus,atMs:inferredAt,taskId,progress:0,estimatedTime:null,inferred:true});
      s.statusPath.push('processing');
    }
    const last=s.taskStates[s.taskStates.length-1];
    if(last&&last.status===status&&last.taskId===taskId){last.progress=Math.max(last.progress||0,progress);last.atMs=atMs;last.estimatedTime=Number(update.estimatedTime)||last.estimatedTime||null;last.rawStatus=rawStatus||last.rawStatus;}
    else{s.taskStates.push({status,rawStatus,atMs,taskId,progress,estimatedTime:Number(update.estimatedTime)||null,inferred:update.inferred===true});if(!s.statusPath.includes(status))s.statusPath.push(status);}
    if(status==='processing'&&update.inferred!==true){s.queueObserved=true;s.providerSplitObserved=true;}
    if(status==='completed'&&s.taskStates.some(x=>x.status==='processing'&&!x.inferred))s.providerSplitObserved=true;
    s.updatedAt=new Date().toISOString();emit();return snapshot();
  }
  function mergeProvider(perf={}){
    const s=ensure();
    if(Number.isFinite(Number(perf.uploadMs??perf.prepareUploadMs)))s.phases.upload=finite(perf.uploadMs??perf.prepareUploadMs);
    if(Number.isFinite(Number(perf.submitMs)))s.phases.submit=finite(perf.submitMs);
    if(Number.isFinite(Number(perf.providerQueueMs)))s.phases.providerQueue=finite(perf.providerQueueMs);
    if(Number.isFinite(Number(perf.generationMs)))s.phases.generation=finite(perf.generationMs);
    if(Number.isFinite(Number(perf.resultMs)))s.providerResultMs=finite(perf.resultMs);
    if(Number.isFinite(Number(perf.creditsMs)))s.creditsMs=finite(perf.creditsMs);
    s.creditsSkipped=perf.creditsSkipped===true;
    if(Number.isFinite(Number(perf.refCount)))s.referenceCount=Math.max(0,Math.round(Number(perf.refCount)));
    if(perf.taskId)s.taskId=String(perf.taskId);
    if(Array.isArray(perf.taskStates)&&perf.taskStates.length){
      for(const row of perf.taskStates){const status=normalizeTaskStatus(row);if(!s.statusPath.includes(status))s.statusPath.push(status);}
      if(!s.taskStates.length)s.taskStates=perf.taskStates.map(row=>({status:normalizeTaskStatus(row),rawStatus:String(row.rawStatus||row.status||''),atMs:finite(row.atMs),taskId:String(row.taskId||perf.taskId||''),progress:finite(row.progress),estimatedTime:Number(row.estimatedTime)||null,inferred:row.inferred===true}));
    }
    s.queueObserved=s.queueObserved||perf.queueObserved===true||s.phases.providerQueue>0;
    s.providerSplitObserved=s.providerSplitObserved||perf.providerSplitObserved===true;
    s.softTimeoutReached=s.softTimeoutReached||perf.softTimeoutReached===true;s.pollRetryCount=Math.max(s.pollRetryCount,finite(perf.pollRetryCount));s.networkStallMs=Math.max(s.networkStallMs,finite(perf.networkStallMs));s.pollTimeoutBudgetMs=Math.max(s.pollTimeoutBudgetMs,finite(perf.pollTimeoutBudgetMs));s.pollMaxTimeoutMs=Math.max(s.pollMaxTimeoutMs,finite(perf.pollMaxTimeoutMs));s.sameTaskOnly=perf.sameTaskOnly!==false;
    s.updatedAt=new Date().toISOString();emit();return snapshot();
  }
  function setReferenceStats(stats={}){const s=ensure();s.referenceCount=finite(stats.referenceCount);s.referenceBeforeBytes=finite(stats.beforeBytes);s.referenceAfterBytes=finite(stats.afterBytes);s.meta=Object.assign({},s.meta||{},{referencePlan:String(stats.referencePlan||''),mergedGuide:stats.mergedGuide===true});s.updatedAt=new Date().toISOString();emit();return snapshot();}
  function phaseValue(s,name){const base=finite(s.phases[name]);const started=s.phaseStarted&&s.phaseStarted[name];return started?finite(base+(mono()-started)):base;}
  function recalc(s){
    const elapsed=finite(mono()-s.startedMonoMs);
    if(!s.clickToImageMs&&s.imageReadyAt)s.clickToImageMs=elapsed;
    const namedToImage=['preflight','sync','compress','upload','submit','providerQueue','generation','result'].reduce((n,k)=>n+phaseValue(s,k),0);
    if(s.clickToImageMs)s.unattributedToImageMs=Math.max(0,s.clickToImageMs-namedToImage);
    if(s.status==='complete'||s.status==='failed')s.totalMs=Math.max(s.totalMs,elapsed);
  }
  function markImageReady(meta={}){const s=ensure();if(s.imageReadyAt){s.meta=Object.assign({},s.meta||{},meta||{});emit();return snapshot();}endPhase('result');s.clickToImageMs=finite(mono()-s.startedMonoMs);s.imageReadyAt=new Date().toISOString();s.status='image-ready';s.meta=Object.assign({},s.meta||{},meta||{});recalc(s);s.updatedAt=new Date().toISOString();emit();return snapshot();}
  function complete(meta={}){const s=ensure();endPhase('postCheck');s.status='complete';s.handoffStatus=s.handoffStatus||'accepted';s.completedAt=new Date().toISOString();s.meta=Object.assign({},s.meta||{},meta||{});s.totalMs=finite(mono()-s.startedMonoMs);recalc(s);s.updatedAt=new Date().toISOString();emit();return snapshot();}
  function fail(error){const s=ensure();for(const name of Object.keys(s.phaseStarted||{}))endPhase(name);s.status='failed';s.error=String(error&&error.message||error||'微调生成失败');s.failedAt=new Date().toISOString();s.totalMs=finite(mono()-s.startedMonoMs);recalc(s);s.updatedAt=new Date().toISOString();emit();return snapshot();}
  function snapshot(){
    if(!current)return null;const s=current;recalc(s);
    const activePhases=Object.keys(s.phaseStarted||{}),currentPhase=activePhases.length?activePhases[activePhases.length-1]:'';
    return{version:s.version,sessionId:s.sessionId,generationId:s.generationId,source:s.source,status:s.status,startedAt:s.startedAt,updatedAt:s.updatedAt,imageReadyAt:s.imageReadyAt,completedAt:s.completedAt,failedAt:s.failedAt,error:s.error,currentPhase,handoffStatus:s.handoffStatus,preflightMs:phaseValue(s,'preflight'),syncMs:phaseValue(s,'sync'),compressMs:phaseValue(s,'compress'),uploadMs:phaseValue(s,'upload'),submitMs:phaseValue(s,'submit'),providerQueueMs:phaseValue(s,'providerQueue'),generationMs:phaseValue(s,'generation'),resultMs:phaseValue(s,'result'),postCheckMs:phaseValue(s,'postCheck'),providerResultMs:finite(s.providerResultMs),creditsMs:finite(s.creditsMs),creditsSkipped:s.creditsSkipped===true,clickToImageMs:finite(s.clickToImageMs),totalMs:finite(s.totalMs),unattributedToImageMs:finite(s.unattributedToImageMs),preflightMode:s.preflightMode,referenceCount:finite(s.referenceCount),referenceBeforeBytes:finite(s.referenceBeforeBytes),referenceAfterBytes:finite(s.referenceAfterBytes),taskId:s.taskId,taskStates:(s.taskStates||[]).map(x=>Object.assign({},x)),statusPath:(s.statusPath||[]).slice(),queueObserved:s.queueObserved===true,providerSplitObserved:s.providerSplitObserved===true,softTimeoutReached:s.softTimeoutReached===true,pollRetryCount:finite(s.pollRetryCount),networkStallMs:finite(s.networkStallMs),pollTimeoutBudgetMs:finite(s.pollTimeoutBudgetMs),pollMaxTimeoutMs:finite(s.pollMaxTimeoutMs),sameTaskOnly:s.sameTaskOnly!==false,meta:Object.assign({},s.meta||{})};
  }
  function reset(){current=null;emit();}
  return{VERSION,PHASES,begin,annotate,startPhase,endPhase,setPhase,recordTask,mergeProvider,setReferenceStats,markImageReady,complete,fail,snapshot,reset,normalizeTaskStatus};
});
