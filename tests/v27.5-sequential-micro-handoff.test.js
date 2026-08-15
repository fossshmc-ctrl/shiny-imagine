'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');

function makeEventRuntime(extra={}){
  const listeners=new Map();
  class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
  const runtime=Object.assign({
    console,Date,Math,Promise,setTimeout,clearTimeout,queueMicrotask,CustomEvent,
    addEventListener(type,fn){const rows=listeners.get(type)||[];rows.push(fn);listeners.set(type,rows);},
    dispatchEvent(event){for(const fn of listeners.get(event.type)||[])fn(event);return true;}
  },extra);
  runtime.window=runtime;
  return runtime;
}

function loadDirectHandoffHarness(handler){
  const source=read('src/features/adjust/image-adjust-enhancement-layer.js');
  const end=source.indexOf('\n\nconst adjustWorkspaceHtmlV137');
  assert.ok(end>0,'direct handoff coordinator prefix must be extractable');
  const acknowledgements=[];
  const adjustState={aiBusy:false,microRunActive:false,microRunId:'',microRunStartedAt:0,microRunHeartbeatAt:0,microRunAcknowledgedAt:0,microRunStatus:'idle',microRunSessionId:''};
  const meterState={sessionId:'perf-default'};
  const bridge={
    isGenerationActive:()=>true,
    acknowledgeGeneration(generationId,meta){acknowledgements.push({generationId,meta});return{ok:true,generationId,acceptedAt:Date.now()};}
  };
  const runtime=makeEventRuntime({
    adjustState,
    __V27_MICRO_API__:bridge,
    MicroPerformanceMeterV275:{snapshot:()=>meterState,annotate(meta){Object.assign(meterState,meta||{});}},
    adjustGenerateCandidates:handler?handler(adjustState):undefined
  });
  vm.createContext(runtime);
  vm.runInContext(source.slice(0,end),runtime,{filename:'image-adjust-enhancement-layer-direct-prefix.js'});
  return{runtime,adjustState,bridge,acknowledgements,meterState};
}

function outputHarness(){
  const store=new Map();
  const sessionStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  const perf={sessionId:'perf-0',generationId:'',status:'running'};
  const adjustState={name:'demo.png',v15Ocr:{v22ImageKey:'image-A',v22ImageRevision:1,v22AppliedRecognitionEpoch:1,result:{imageKey:'image-A',imageRevision:1,recognitionEpoch:1}}};
  const runtime=makeEventRuntime({sessionStorage,adjustState,MicroPerformanceMeterV275:{snapshot:()=>Object.assign({},perf)},adjustGenerateCandidates:undefined});
  vm.createContext(runtime);
  vm.runInContext(read('src/features/adjust/micro-adjust-output-channel.js'),runtime,{filename:'micro-adjust-output-channel.js'});
  return{runtime,perf};
}

function billingGateHarness(){
  const store=new Map([
    ['turing_v27_micro_evolink_migrated','1'],
    ['turing_v23_micro_api_config',JSON.stringify({version:'V28.1.1',baseUrl:'https://api.evolink.ai/v1',apiKey:'test-key',imageModel:'gemini-3.1-flash-lite-image',models:['gemini-3.1-flash-lite-image']})]
  ]);
  const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  function element(tag='div'){return{tagName:String(tag).toUpperCase(),id:'',className:'',textContent:'',innerHTML:'',hidden:false,style:{},appendChild(){},remove(){},focus(){},querySelector(){return null;},querySelectorAll(){return[];},setAttribute(){},addEventListener(){},matches(){return false;},closest(){return null;}};}
  const document={head:element('head'),body:element('body'),createElement:element,getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){}};
  const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
  const requests=[];
  const evo={
    DEFAULT_BASE:'https://api.evolink.ai/v1',BUILTIN_IMAGE_MODELS:['gemini-3.1-flash-lite-image'],
    normalizeEvolinkBase:value=>String(value||'https://api.evolink.ai/v1').replace(/\/+$/,''),
    isEvolinkBase:()=>true,isDirectImageModelObject:()=>true,isImageModelObject:()=>true,modelProfile:()=>({maxRefs:4}),ingestRemoteModels(){},
    prepareReferenceSource:async value=>value,normalizeTaskStatus:update=>String(update?.status||'pending'),
    async generate({fetchJson}){await fetchJson('/api/images/generations',{method:'POST',body:'{}'});return['data:image/png;base64,AA=='];}
  };
  const runtime=makeEventRuntime({
    performance:{now:()=>Date.now()},localStorage,document,Blob,FormData,Uint8Array,URL,atob:global.atob,
    EvoLinkImageAdapter:evo,MicroPerformanceMeterV275:{annotate(){},mergeProvider(){},recordTask(){}},
    apiImageEditMulti:async()=>['legacy'],apiImageEditNativeMask:async()=>['legacy-mask'],adjustGenerateCandidates:undefined,
    async fetch(url,options={}){requests.push({url:String(url),options});return response({ok:true});}
  });
  vm.createContext(runtime);
  vm.runInContext(read('src/integrations/micro-api-channel.js'),runtime,{filename:'micro-api-channel.js'});
  return{runtime,bridge:runtime.__V27_MICRO_API__,requests};
}

test('V28.1.1 direct handoff accepts two completed runs sequentially without inheriting sticky busy state',async()=>{
  const calls=[];
  const h=loadDirectHandoffHarness(adjustState=>async(ids,opts)=>{
    calls.push({ids:[...ids],opts:Object.assign({},opts)});
    adjustState.microRunAcknowledgedAt=Date.now();
    adjustState.microRunStatus='compress';
    adjustState.aiBusy=true;
    await Promise.resolve();
    adjustState.aiBusy=false;
    adjustState.microRunStatus='complete';
    return{ok:true};
  });
  const first=h.runtime.__V276_START_MICRO_ADJUST__({ids:['red'],generationId:'gen-1',sessionId:'session-1'});
  assert.equal(first.accepted,true);
  await first.promise;
  const second=h.runtime.__V276_START_MICRO_ADJUST__({ids:['blue'],generationId:'gen-2',sessionId:'session-2'});
  assert.equal(second.accepted,true);
  await second.promise;
  assert.equal(calls.length,2);
  assert.deepEqual(h.acknowledgements.map(x=>x.generationId),['gen-1','gen-2']);
  assert.equal(h.adjustState.aiBusy,false);
  assert.equal(h.adjustState.microRunActive,false);
  assert.equal(h.adjustState.microRunId,'gen-2');
});

test('V28.1.1 direct handoff fails immediately before channel unlock when handler does not acknowledge',()=>{
  const h=loadDirectHandoffHarness(()=>async()=>({ok:true}));
  assert.throws(()=>h.runtime.__V276_START_MICRO_ADJUST__({ids:['red'],generationId:'gen-no-ack',sessionId:'session-no-ack'}),error=>{
    assert.equal(error.code,'micro_handoff_not_acknowledged');return true;
  });
  assert.equal(h.acknowledgements.length,0);
  assert.equal(h.adjustState.microRunActive,false);
});

test('V28.1.1 output channel starts a fresh record for the second click and ignores delayed first-session telemetry',()=>{
  const {runtime}=outputHarness();
  runtime.__V225_BEGIN_MICRO_ADJUST_GENERATION__({sessionId:'session-1',generationId:'generation-1',performance:{sessionId:'session-1',generationId:'generation-1',preflightMs:6}});
  runtime.__V225_BEGIN_MICRO_ADJUST_GENERATION__({sessionId:'session-2',generationId:'generation-2',performance:{sessionId:'session-2',generationId:'generation-2',preflightMs:0}});
  let current=runtime.__V225_GET_MICRO_ADJUST_OUTPUT__();
  assert.equal(current.sessionId,'session-2');
  assert.equal(current.generationId,'generation-2');
  assert.equal(current.phase,'generating');
  runtime.dispatchEvent(new runtime.CustomEvent('v276-micro-performance',{detail:{sessionId:'session-1',generationId:'generation-1',preflightMs:999,status:'running'}}));
  current=runtime.__V225_GET_MICRO_ADJUST_OUTPUT__();
  assert.equal(current.sessionId,'session-2');
  assert.notEqual(current.performance.preflightMs,999);
});

test('V28.1.1 billed provider POST is blocked until exact generation handoff acknowledgement',async()=>{
  const {runtime,bridge,requests}=billingGateHarness();
  const first=bridge.beginGeneration({performanceSessionId:'session-1'});
  await assert.rejects(()=>runtime.apiImageEditMulti('prompt','',['data:image/png;base64,AA=='],1,'1:1'),/尚未确认流程交接/);
  assert.equal(requests.filter(x=>x.url.includes('/images/generations')).length,0);
  bridge.abortGeneration('test-unacknowledged');

  const second=bridge.beginGeneration({performanceSessionId:'session-2'});
  const ack=bridge.acknowledgeGeneration(second,{performanceSessionId:'session-2'});
  assert.equal(ack.ok,true);
  const images=await runtime.apiImageEditMulti('prompt','',['data:image/png;base64,AA=='],1,'1:1');
  assert.equal(images.length,1);
  const billed=requests.find(x=>x.url==='/api/micro/images/generations');
  assert.ok(billed);
  assert.equal(billed.options.headers['X-Micro-Generation-Id'],second);
  assert.equal(billed.options.headers['X-Micro-Handoff-Acknowledged'],'1');
  bridge.abortGeneration('test-complete');
  assert.notEqual(first,second);
});

test('V28.1.1 region workbench bypasses hidden generation-button click and exposes handoff timing',()=>{
  const source=read('src/features/region-workbench/region-workbench.js');
  const start=source.indexOf('async function performGeneration(options={})');
  const end=source.indexOf('function beginCheck(mode)',start);
  const fn=source.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.doesNotMatch(fn,/\brun\.click\s*\(/);
  assert.match(fn,/window\.__V276_START_MICRO_ADJUST__/);
  assert.match(fn,/starter\(\{ids,generationId,sessionId:/);
  assert.match(fn,/meter\?\.startPhase\?\.\('sync'\)/);
  assert.match(source,/\['syncMs','流程交接'\]/);
});
