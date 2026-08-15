const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const routes=require('../src/core/route-persistence.js');
const store=require('../src/core/copy-snapshot-store.js');
const historySource=fs.readFileSync(path.join(__dirname,'../src/features/copy/copy-history.js'),'utf8');
const lifecycleSource=fs.readFileSync(path.join(__dirname,'../src/app/page-state-lifecycle.js'),'utf8');

function storage(){const map=new Map();return{getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;}};}
function batch(label){return Array.from({length:8},(_,i)=>({version:i+1,style:label,block:{mainTitle:`${label}-${i+1}`}}));}
function context(local,session){
  const ctx={console,CopySnapshotStore:store,AppRoutePersistence:routes,localStorage:local,sessionStorage:session,Date,Math,Set,JSON,structuredClone,setTimeout,clearTimeout};
  ctx.addEventListener=()=>{};ctx.document={addEventListener:()=>{},visibilityState:'visible'};
  vm.createContext(ctx);ctx.window=ctx;ctx.globalThis=ctx;
  vm.runInContext("let copies=[],selected=new Set(),expanded=null,curView='home';const $=()=>null;function setActionStatus(){}function esc(v){return String(v)}function renderCopyOut(){}",ctx);
  vm.runInContext(historySource,ctx);vm.runInContext(lifecycleSource,ctx);return ctx;
}
function boot(ctx,type,path='/'){
  const info=routes.boot({sessionStorage:ctx.sessionStorage,location:{pathname:path},performance:{getEntriesByType:n=>n==='navigation'?[{type}]:[]}});
  ctx.AppPageStateLifecycle.prepareBoot(info.route,info);return info;
}

test('copy reload restores both the global page route and the copy page-owned current batch',()=>{
  const local=storage(),session=storage(),first=context(local,session);
  first.__batch=JSON.stringify(batch('R'));
  vm.runInContext("copies=JSON.parse(__batch);copies._in='全局刷新测试';selected=new Set([2,6]);copySnapshotCaptureGenerated(copies._in,'test')",first);
  routes.remember('copy',{sessionStorage:session});
  const second=context(local,session),info=boot(second,'reload','/');
  const state=vm.runInContext("({count:copies.length,input:copies._in,selected:[...selected]})",second);
  assert.equal(info.route,'copy');assert.equal(state.count,8);assert.equal(state.input,'全局刷新测试');assert.deepEqual([...state.selected],[2,6]);
});

test('reload on image restores image route without hydrating hidden copy business state',()=>{
  const local=storage(),session=storage(),first=context(local,session);
  first.__batch=JSON.stringify(batch('HIDDEN'));
  vm.runInContext("copies=JSON.parse(__batch);copies._in='不应跨页灌入';copySnapshotCaptureGenerated(copies._in,'test')",first);
  routes.remember('image',{sessionStorage:session});
  const second=context(local,session),info=boot(second,'reload','/');
  const count=vm.runInContext('copies.length',second);
  assert.equal(info.route,'image');assert.equal(count,0);
});

test('illegal historical route cannot trigger page-state hydration or a blank route',()=>{
  const local=storage(),session=storage(),ctx=context(local,session);
  session.setItem(routes.STORAGE_KEY,'removed-legacy-route');
  const info=boot(ctx,'reload','/');
  assert.equal(info.route,'home');assert.equal(session.getItem(routes.STORAGE_KEY),null);assert.equal(vm.runInContext('copies.length',ctx),0);
});
