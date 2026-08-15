'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const http=require('node:http');

const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const adapter=require('../src/core/evolink-image-adapter.js');
const transport=require('../src/core/micro-image-transport.js');
const meter=require('../src/core/micro-performance-meter.js');
const keepAlive=require('../network-keepalive.js');

function createMicroChannelHarness(){
  const clock={now:1_800_000_000_000,advance(ms){this.now+=ms;}};
  class FakeDate extends Date{
    constructor(...args){super(...(args.length?args:[clock.now]));}
    static now(){return clock.now;}
  }
  const store=new Map([
    ['turing_v27_micro_evolink_migrated','1'],
    ['turing_v23_micro_api_config',JSON.stringify({
      version:'V28.1.1',baseUrl:'https://api.evolink.ai/v1',apiKey:'test-key',
      imageModel:'gemini-3.1-flash-lite-image',models:['gemini-3.1-flash-lite-image']
    })]
  ]);
  const counters={health:0,diagnose:0,credits:0};
  const localStorage={getItem:key=>store.has(key)?store.get(key):null,setItem:(key,value)=>store.set(key,String(value)),removeItem:key=>store.delete(key)};
  function element(tag='div'){
    return {tagName:String(tag).toUpperCase(),id:'',className:'',textContent:'',innerHTML:'',hidden:false,style:{},
      appendChild(){},remove(){},focus(){},querySelector(){return null;},querySelectorAll(){return[];},
      setAttribute(){},addEventListener(){},matches(){return false;},closest(){return null;}};
  }
  const document={head:element('head'),body:element('body'),createElement:element,getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];},addEventListener(){}};
  const eventListeners=new Map();
  class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
  const response=(data,status=200)=>({ok:status>=200&&status<300,status,text:async()=>JSON.stringify(data)});
  const evo={
    DEFAULT_BASE:'https://api.evolink.ai/v1',BUILTIN_IMAGE_MODELS:['gemini-3.1-flash-lite-image'],
    normalizeEvolinkBase:value=>String(value||'https://api.evolink.ai/v1').replace(/\/+$/,''),
    isEvolinkBase:()=>true,isDirectImageModelObject:()=>true,isImageModelObject:()=>true,
    modelProfile:()=>({maxRefs:4}),ingestRemoteModels(){},
    prepareReferenceSource:async()=> 'data:image/png;base64,AA==',
    ensureGenerationCredits:async()=>{counters.credits++;return{checked:true,blocked:false,userRemaining:100,tokenRemaining:100,tokenUnlimited:false};},
    normalizeTaskStatus:update=>String(update&&update.status||'pending')
  };
  const sandbox={
    console,Date:FakeDate,performance:{now:()=>clock.now-1_800_000_000_000},localStorage,document,
    CustomEvent,setTimeout,clearTimeout,Blob,FormData,Uint8Array,URL,atob:global.atob,
    EvoLinkImageAdapter:evo,apiImageEditMulti:undefined,apiImageEditNativeMask:undefined,adjustGenerateCandidates:undefined,
    addEventListener(type,fn){const rows=eventListeners.get(type)||[];rows.push(fn);eventListeners.set(type,rows);},
    dispatchEvent(event){for(const fn of eventListeners.get(event.type)||[])fn(event);return true;}
  };
  sandbox.window=sandbox;
  sandbox.fetch=async(url,options={})=>{
    const target=String(url);
    if(target.startsWith('/api/micro/health')){
      counters.health++;
      return response({ok:true,version:'V28.1.1',generationChannels:{adjust:{provider:'evolink-image-micro-adjust',endpointPrefix:'/api/micro/',routeIsolation:true,channelHeader:'micro-adjust-v27.8',keepAlive:true}}});
    }
    if(target==='/api/micro/diagnose'){
      counters.diagnose++;
      const headers=options.headers||{};
      const model=headers['X-Model']||'gemini-3.1-flash-lite-image';
      return response({ok:true,message:'diagnostic ok',generationReady:true,modelCatalogSource:'evolink-models-live',
        billing:{checked:true,blocked:false,userRemaining:100,tokenRemaining:100,tokenUnlimited:false},
        models:[{id:model}],capabilities:[{id:model,supportsImageInput:true,maxInputImages:4}]});
    }
    throw new Error('unexpected fetch '+target);
  };
  vm.createContext(sandbox);
  vm.runInContext(read('src/integrations/micro-api-channel.js'),sandbox,{filename:'micro-api-channel.js'});
  return{bridge:sandbox.__V27_MICRO_API__,clock,counters};
}

test('V28.1.1 save() preserves full-diagnostic and Credits caches for ordinary status updates',async()=>{
  const {bridge,clock,counters}=createMicroChannelHarness();
  assert.equal(bridge.version,'V28.1.1');

  await bridge.preflight({showOnError:false});
  assert.deepEqual(counters,{health:1,diagnose:1,credits:0});
  assert.match(bridge.diagnostics().lastPreflight.mode,/full-diagnostic:cold-start/);

  // The full diagnostic health response must also satisfy the immediate isolation check.
  await bridge.assertIsolation();
  assert.equal(counters.health,1);

  // Full diagnostics remain valid for 5 minutes; only Credits becomes stale after 60 seconds.
  clock.advance(61_000);
  await bridge.preflight({showOnError:false});
  assert.deepEqual(counters,{health:1,diagnose:1,credits:1});
  assert.equal(bridge.diagnostics().lastPreflight.mode,'diagnostic-cache+light-credits');

  // A second generation inside the 60-second Credits window performs no network preflight.
  await bridge.preflight({showOnError:false});
  assert.deepEqual(counters,{health:1,diagnose:1,credits:1});
  assert.equal(bridge.diagnostics().lastPreflight.mode,'diagnostic-cache+credit-cache');

  // This is the original regression: save(lastTest*) must not destroy the preflight cache.
  bridge.save({lastTestOk:true,lastTestAt:'status-only',lastTestMessage:'still healthy'});
  assert.notEqual(bridge.diagnostics().diagnosticCacheAgeMs,null);
  await bridge.preflight({showOnError:false});
  assert.deepEqual(counters,{health:1,diagnose:1,credits:1});

  // Changing the actual identity (Base URL / Key / Model) must invalidate and rerun diagnostics.
  bridge.save({imageModel:'gemini-3-pro-image-preview'});
  assert.equal(bridge.diagnostics().diagnosticCacheAgeMs,null);
  await bridge.preflight({showOnError:false});
  assert.deepEqual(counters,{health:2,diagnose:2,credits:1});
  assert.equal(bridge.diagnostics().lastPreflight.mode,'full-diagnostic:config-changed');
});

test('V28.1.1 merged reference plan emits source plus one layout/mask guide',async()=>{
  const previousImage=global.Image,previousDocument=global.document;
  class FakeImage{
    constructor(){this.naturalWidth=16;this.naturalHeight=12;this.width=16;this.height=12;}
    set src(value){this._src=value;queueMicrotask(()=>this.onload&&this.onload());}
    get src(){return this._src;}
  }
  function fakeContext(canvas){
    return {imageSmoothingEnabled:false,imageSmoothingQuality:'low',fillStyle:'',globalAlpha:1,globalCompositeOperation:'source-over',
      drawImage(){},fillRect(){},save(){},restore(){},putImageData(){},
      getImageData(){const data=new Uint8ClampedArray(canvas.width*canvas.height*4);data.fill(255);return{data};},
      createImageData(){return{data:new Uint8ClampedArray(canvas.width*canvas.height*4)};}};
  }
  global.Image=FakeImage;
  global.document={createElement(tag){assert.equal(tag,'canvas');const canvas={width:1,height:1};canvas.getContext=()=>fakeContext(canvas);canvas.toDataURL=()=>`data:image/webp;base64,${'A'.repeat(160)}`;return canvas;}};
  try{
    const tiny='data:image/png;base64,AAAA';
    const result=await transport.prepareFastReferenceSet({source:tiny,layoutGuide:tiny,mask:tiny});
    assert.equal(transport.VERSION,'V28.1.1');
    assert.equal(result.referencePlan,'source+layout-mask-guide+text-fidelity-v280');
    assert.equal(result.referenceCount,2);
    assert.equal(result.refs.length,2);
    assert.deepEqual(result.items.map(x=>x.role),['source','layout-mask-guide']);
    assert.equal(result.mergedGuide,true);
    assert.equal(result.uploadConcurrencyTarget,2);
  }finally{
    global.Image=previousImage;
    global.document=previousDocument;
  }
});

test('V28.1.1 provider tracker separates queue/generation and preserves inferred lifecycle stages',()=>{
  let now=100;
  const tracker=adapter.createTaskTracker(()=>now,100,0);
  tracker.accept();
  tracker.record({taskId:'task-1',status:'pending',progress:0});
  now=430;tracker.record({taskId:'task-1',status:'processing',progress:10});
  now=980;tracker.record({taskId:'task-1',status:'completed',progress:100,resultUrls:['x']});
  const actual=tracker.summary();
  assert.equal(actual.providerQueueMs,330);
  assert.equal(actual.generationMs,550);
  assert.deepEqual(actual.taskStates.map(x=>x.status),['pending','processing','completed']);
  assert.equal(actual.taskStates.some(x=>x.inferred),false);
  assert.equal(actual.queueObserved,true);
  assert.equal(actual.providerSplitObserved,true);

  now=1_000;
  const direct=adapter.createTaskTracker(()=>now,1_000,0);
  direct.accept();
  now=1_650;direct.record({taskId:'task-direct',status:'completed',progress:100,resultUrls:['x']});
  const inferred=direct.summary();
  assert.deepEqual(inferred.taskStates.map(x=>x.status),['pending','processing','completed']);
  assert.deepEqual(inferred.taskStates.map(x=>x.inferred),[true,true,false]);
  assert.equal(inferred.providerQueueMs,0);
  assert.equal(inferred.generationMs,650);
  assert.equal(inferred.queueObserved,false);
  assert.equal(inferred.providerSplitObserved,false);
});

test('V28.1.1 click-to-image meter exposes all requested phases and task path',()=>{
  meter.reset();
  meter.begin({source:'test'});
  meter.setPhase('preflight',11);
  meter.setPhase('sync',12);
  meter.setPhase('compress',22);
  meter.setPhase('upload',33);
  meter.setPhase('submit',44);
  meter.setPhase('providerQueue',55);
  meter.setPhase('generation',66);
  meter.setPhase('result',77);
  meter.setPhase('postCheck',88);
  meter.recordTask({taskId:'task-meter',status:'processing',progress:20});
  meter.recordTask({taskId:'task-meter',status:'completed',progress:100,resultUrls:['x']});
  const snap=meter.snapshot();
  assert.equal(meter.VERSION,'V28.1.1');
  for(const key of ['preflightMs','syncMs','compressMs','uploadMs','submitMs','providerQueueMs','generationMs','resultMs','postCheckMs'])assert.equal(typeof snap[key],'number',key);
  assert.deepEqual(snap.statusPath,['pending','processing','completed']);
  assert.equal(snap.taskStates[0].inferred,true);
  assert.equal(snap.taskId,'task-meter');
});

test('V28.1.1 Node outbound direct requests reuse a keep-alive connection',async()=>{
  let connections=0;
  const server=http.createServer((_req,res)=>{res.setHeader('Connection','keep-alive');res.end('ok');});
  server.on('connection',()=>connections++);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address(),agent=keepAlive.directAgentFor(`http://127.0.0.1:${port}/`);
  const hit=()=>new Promise((resolve,reject)=>{const req=http.get({hostname:'127.0.0.1',port,path:'/',agent},res=>{res.resume();res.on('end',resolve);});req.on('error',reject);});
  try{await hit();await hit();assert.equal(agent.keepAlive,true);assert.equal(connections,1);}finally{await new Promise(resolve=>server.close(resolve));}
});

test('V29 package preserves cache, two-reference and lifecycle diagnostics',()=>{
  const node=read('server.js'),py=read('server.py'),config=JSON.parse(read('config.json'));
  for(const token of ["channelHeader:'micro-adjust-v27.8'",'diagnosticCacheMs:300000','creditCacheMs:60000','fullDiagnosticsOnlyOnTestOrCacheExpiry:true',"referencePlan:'source+layout-mask-guide+text-fidelity-v280'",'clickToImagePerformance:true','taskLifecycle:true','directHandoff:true','handoffAcknowledgementGate:true',"handoffAckMode:'synchronous-before-provider'",'sequentialRunIsolation:true'])assert.ok(node.includes(token),token);
  for(const token of ["'channelHeader':'micro-adjust-v27.8'","'diagnosticCacheMs':300000","'creditCacheMs':60000","'referencePlan':'source+layout-mask-guide+text-fidelity-v280'","'taskLifecycle':True","'directHandoff':True","'handoffAcknowledgementGate':True","'sequentialRunIsolation':True"])assert.ok(py.includes(token),token);
  assert.equal(config.version,'V29.1');
  assert.equal(config.network.microUploadConcurrency,2);
  assert.equal(config.network.microPreflightCacheMs,300000);
  assert.equal(config.network.microCreditFreshMs,60000);
  assert.equal(config.network.microRunStaleMs,600000);
  assert.equal(config.network.microHandoffAckMode,'synchronous-before-provider');
});
