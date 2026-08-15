'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {Readable}=require('node:stream');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

function loadWireHistoryRuntime({hosted=true,stored=[]}={}){
  const values=new Map([['wfGeneratedHistory_v26_fallback',JSON.stringify(stored)]]);let fetchCalls=0;
  const localStorage={getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
  const context={
    DeploymentRuntimeV29:{state:{hosted}},
    localStorage,
    fetch:async()=>{fetchCalls++;return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,items:[]})};},
    setTimeout:()=>0,
    Date,
    console,
    encodeURIComponent
  };
  vm.createContext(context);
  vm.runInContext(read('src/features/wireframe/wireframe-generation.js')+`\n;globalThis.__v291={
    getHistory:()=>wf.history,
    persistGeneratedWireHistoryItem,
    refreshGeneratedWireHistoryFromServer,
    deleteGeneratedWireHistoryItem,
    resolveGeneratedWireResultSrc,
    isEphemeralWireHistoryAsset
  };`,context);
  return {api:context.__v291,state:context.DeploymentRuntimeV29.state,fetchCalls:()=>fetchCalls,stored:()=>JSON.parse(values.get('wfGeneratedHistory_v26_fallback')||'[]')};
}

function apiCall(handler,{method='GET',url='/api/health',headers={},body=''}={}){
  return new Promise((resolve,reject)=>{
    const payload=Buffer.from(body);const req=Readable.from(payload.length?[payload]:[]);
    req.method=method;req.url=url;req.headers=Object.assign({},headers,payload.length?{'content-length':String(payload.length)}:{});
    const chunks=[];const res={
      statusCode:200,headers:{},
      writeHead(status,outHeaders){this.statusCode=status;this.headers=outHeaders||{};},
      write(chunk){if(chunk)chunks.push(Buffer.from(chunk));return true;},
      end(chunk){if(chunk)chunks.push(Buffer.from(chunk));resolve({status:this.statusCode,headers:this.headers,body:Buffer.concat(chunks).toString('utf8')});},
      on(){},once(){},emit(){}
    };
    Promise.resolve(handler(req,res)).catch(reject);
  });
}

test('V29.1 hosted history keeps the provider URL, skips /tmp API sync and removes stale V29 asset entries',async()=>{
  const remote='https://cdn.example.test/current-wireframe.png';
  const runtime=loadWireHistoryRuntime({hosted:true,stored:[
    {id:'old-broken',src:'/api/wireframe-history/assets/old.png'},
    {id:'remote-ok',src:remote}
  ]});
  assert.deepEqual(Array.from(runtime.api.getHistory(),x=>x.id),['remote-ok']);
  const item={id:'new-wire',src:'https://cdn.example.test/new-wireframe.png'};
  const saved=await runtime.api.persistGeneratedWireHistoryItem(item);
  assert.equal(saved.src,item.src);
  assert.equal(runtime.api.resolveGeneratedWireResultSrc(item.src,{src:'/api/wireframe-history/assets/replaced.png'}),item.src);
  await runtime.api.refreshGeneratedWireHistoryFromServer();
  await runtime.api.deleteGeneratedWireHistoryItem(item.id);
  assert.equal(runtime.fetchCalls(),0,'hosted browser history must not call /api/wireframe-history');
  assert.ok(runtime.stored().every(entry=>!runtime.api.isEphemeralWireHistoryAsset(entry.src)));
});

test('V29.1 Windows history still accepts the persisted local asset URL',()=>{
  const runtime=loadWireHistoryRuntime({hosted:false});
  const original='https://cdn.example.test/wireframe.png',local='/api/wireframe-history/assets/wireframe.png';
  assert.equal(runtime.api.resolveGeneratedWireResultSrc(original,{src:local}),local);
  const probe=spawnSync(process.execPath,['-e',`const s=require('./server');process.stdout.write(JSON.stringify({runtime:s.RUNTIME_KIND,mode:s.wireHistoryPersistenceMode(),remote:s.shouldMaterializeWireHistorySource('https://cdn.example.test/wire.png'),local:s.shouldMaterializeWireHistorySource('/api/wireframe-history/assets/wire.png')}));`],{
    cwd:root,encoding:'utf8',env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['VERCEL','AI_LINKUANG_RUNTIME','AI_LINKUANG_ACCESS_CODE'].includes(key)))
  });
  assert.equal(probe.status,0,probe.stderr);
  assert.deepEqual(JSON.parse(probe.stdout),{runtime:'windows-local',mode:'windows-local-disk',remote:true,local:false});
  assert.match(read('server.py'),/if src and not src\.startswith\('\/api\/wireframe-history\/assets\/'\):src=_materialize_wire_image\(src,item_id\)/);
});

test('V29.1 serverless fallback preserves the remote URL without weakening the access gate',async()=>{
  process.env.AI_LINKUANG_RUNTIME='serverless';
  process.env.AI_LINKUANG_ACCESS_CODE='v291-test-access';
  const server=require('../server');
  const source='https://cdn.example.test/provider-result.png',id='v291-'+Date.now();
  const authorized={'x-app-access-code':'v291-test-access','content-type':'application/json'};
  const saved=await apiCall(server.apiHandler,{method:'POST',url:'/api/wireframe-history',headers:authorized,body:JSON.stringify({id,src:source,label:'V29.1 test'})});
  assert.equal(saved.status,200,saved.body);
  const payload=JSON.parse(saved.body);
  assert.equal(payload.item.src,source);
  assert.equal(payload.persistence,'browser-local');
  assert.equal(server.shouldMaterializeWireHistorySource(source),false);

  const denied=await apiCall(server.apiHandler,{url:'/api/wireframe-history/assets/unknown.png'});
  assert.equal(denied.status,401);
  assert.equal(JSON.parse(denied.body).error.code,'app_access_required');

  const health=await apiCall(server.apiHandler,{url:'/api/health',headers:{'x-app-access-code':'v291-test-access'}});
  assert.equal(health.status,200);
  const healthData=JSON.parse(health.body);
  assert.equal(healthData.version,'V29.1');
  assert.equal(healthData.runtime,'vercel-serverless');
  assert.equal(healthData.persistence.wireframeHistory,'browser-local');
  assert.equal(healthData.persistence.wireframeAssets,'provider-url');

  await apiCall(server.apiHandler,{method:'DELETE',url:'/api/wireframe-history/'+encodeURIComponent(id),headers:{'x-app-access-code':'v291-test-access'}});
});

test('V29.1 generation flow uses the runtime-aware display URL resolver',()=>{
  const source=read('src/features/prompt/prompt-composition.js');
  assert.match(source,/displaySrc=resolveGeneratedWireResultSrc\(src,saved\)/);
  assert.doesNotMatch(source,/g\.result\.src=saved\.src/);
});
