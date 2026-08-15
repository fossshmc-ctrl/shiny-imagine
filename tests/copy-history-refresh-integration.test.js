const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const store=require('../src/core/copy-snapshot-store.js');
const historySource=fs.readFileSync(path.join(__dirname,'../src/features/copy/copy-history.js'),'utf8');

function makeStorage(){
  const map=new Map();
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;},_map:map};
}
function makeContext(storage,{session=makeStorage()}={}){
  const ctx={console,CopySnapshotStore:store,localStorage:storage,sessionStorage:session,Date,Math,Set,JSON,structuredClone,setTimeout,clearTimeout};
  ctx.addEventListener=()=>{};
  ctx.document={addEventListener:()=>{},visibilityState:'visible'};
  vm.createContext(ctx);ctx.window=ctx;
  vm.runInContext("let copies=[],selected=new Set(),expanded=null,curView='home';const $=()=>null;function setActionStatus(){}function esc(v){return String(v)}function renderCopyOut(){}",ctx);
  vm.runInContext(historySource,ctx);
  return ctx;
}
function batch(label){return Array.from({length:8},(_,i)=>({version:i+1,style:label,block:{mainTitle:`${label}-${i+1}`}}));}

test('fresh app/navigation keeps prior snapshots but does not auto-fill copy runtime',()=>{
  const storage=makeStorage(),session=makeStorage(),first=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('A'))};copies._in='旧测试文案';selected=new Set([0,2]);copySnapshotCaptureGenerated(copies._in,'test');`,first);
  const fresh=makeContext(storage,{session});
  const state=vm.runInContext("({count:copies.length,input:copies._in||'',history:CopyGenerationHistory.state().batches.length})",fresh);
  assert.equal(state.count,0);
  assert.equal(state.input,'');
  assert.equal(state.history,1);
});

test('refresh on copy page restores current eight-copy batch',()=>{
  const storage=makeStorage(),session=makeStorage(),first=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('R'))};copies._in='刷新保留测试';selected=new Set([1,4]);copySnapshotCaptureGenerated(copies._in,'test');`,first);
  const second=makeContext(storage,{session});
  const restored=vm.runInContext("const ok=copySnapshotRestoreOnReload();({ok,input:copies._in,count:copies.length,selected:[...selected],label:copySnapshotActiveLabel()})",second);
  assert.equal(restored.ok,true);
  assert.equal(restored.input,'刷新保留测试');
  assert.equal(restored.count,8);
  assert.deepEqual([...restored.selected],[1,4]);
  assert.equal(restored.label,'本次');
});


test('refresh on an intentionally blank copy page stays blank even when history exists',()=>{
  const storage=makeStorage(),session=makeStorage(),first=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('H'))};copies._in='历史存在';copySnapshotCaptureGenerated(copies._in,'test');copySnapshotBeginFreshEntry();`,first);
  const second=makeContext(storage,{session});
  const result=vm.runInContext("const ok=copySnapshotRestoreOnReload();({ok,count:copies.length,history:CopyGenerationHistory.state().batches.length})",second);
  assert.equal(result.ok,false);
  assert.equal(result.count,0);
  assert.equal(result.history,1);
});

test('manual restore works from a fresh blank entry even when target is already active',()=>{
  const storage=makeStorage(),session=makeStorage(),first=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('M'))};copies._in='手动恢复';selected=new Set([3]);copySnapshotCaptureGenerated(copies._in,'test');`,first);
  const fresh=makeContext(storage,{session});
  const result=vm.runInContext("const id=CopyGenerationHistory.state().activeId;copySnapshotBeginFreshEntry();const ok=copySnapshotSwitch(id);({ok,input:copies._in,count:copies.length,selected:[...selected]})",fresh);
  assert.equal(result.ok,true);
  assert.equal(result.input,'手动恢复');
  assert.equal(result.count,8);
  assert.deepEqual([...result.selected],[3]);
});

test('five-batch history keeps active older batch across copy-page reload',()=>{
  const storage=makeStorage(),session=makeStorage(),first=makeContext(storage,{session});
  for(let i=1;i<=6;i++){
    first.__payload=JSON.stringify(batch('B'+i));
    vm.runInContext(`copies=JSON.parse(__payload);copies._in='批次${i}';selected=new Set([${i%8}]);copySnapshotCaptureGenerated(copies._in,'test');`,first);
  }
  const ids=vm.runInContext('CopyGenerationHistory.state().batches.map(x=>x.id)',first);
  assert.equal(ids.length,5);
  vm.runInContext(`copySnapshotSwitch(${JSON.stringify(ids[1])});`,first);
  const second=makeContext(storage,{session});
  const restored=vm.runInContext("copySnapshotRestoreOnReload();({input:copies._in,count:copies.length,label:copySnapshotActiveLabel(),len:CopyGenerationHistory.state().batches.length})",second);
  assert.equal(restored.input,'批次5');
  assert.equal(restored.count,8);
  assert.equal(restored.label,'上一次');
  assert.equal(restored.len,5);
});

test('migrates a prior versioned snapshot key without forcing it onto a fresh page',()=>{
  const storage=makeStorage(),session=makeStorage();
  const priorKey='turing_copy_v999_generation_snapshots';
  const prior=store.addBatch(null,{input:'迁移测试',origin:'prior',copies:batch('P'),selected:[1,4]},{id:'prior-1',now:'2026-08-07T00:00:00.000Z'});
  storage.setItem(priorKey,JSON.stringify(prior));
  const ctx=makeContext(storage,{session});
  const initial=vm.runInContext("({count:copies.length,history:CopyGenerationHistory.state().batches.length})",ctx);
  assert.equal(initial.count,0);
  assert.equal(initial.history,1);
  assert.ok(storage.getItem('turing_copy_generation_snapshots_current'));
  const restored=vm.runInContext("copySnapshotSwitch('prior-1');({input:copies._in,count:copies.length,selected:[...selected]})",ctx);
  assert.equal(restored.input,'迁移测试');
  assert.equal(restored.count,8);
  assert.deepEqual([...restored.selected],[1,4]);
});

test('manual star keeps an old snapshot beyond five ordinary batches and delete removes it',()=>{
  const storage=makeStorage(),session=makeStorage(),ctx=makeContext(storage,{session});
  for(let i=1;i<=5;i++){
    ctx.__payload=JSON.stringify(batch('S'+i));
    vm.runInContext(`copies=JSON.parse(__payload);copies._in='星标批次${i}';copySnapshotCaptureGenerated(copies._in,'test');`,ctx);
  }
  const oldest=vm.runInContext('CopyGenerationHistory.state().batches[4].id',ctx);
  ctx.__oldest=oldest;
  vm.runInContext('copySnapshotSetPinned(__oldest,true)',ctx);
  ctx.__payload=JSON.stringify(batch('S6'));
  vm.runInContext(`copies=JSON.parse(__payload);copies._in='星标批次6';copySnapshotCaptureGenerated(copies._in,'test');`,ctx);
  const kept=vm.runInContext('CopyGenerationHistory.state()',ctx);
  assert.equal(kept.batches.length,6);
  assert.equal(kept.batches.find(x=>x.id===oldest).pinned,true);
  vm.runInContext('copySnapshotDelete(__oldest)',ctx);
  const after=vm.runInContext('CopyGenerationHistory.state()',ctx);
  assert.equal(after.batches.some(x=>x.id===oldest),false);
  assert.equal(after.batches.length,5);
});

test('deleting the active visible snapshot switches runtime to the next valid batch',()=>{
  const storage=makeStorage(),session=makeStorage(),ctx=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('OLD'))};copies._in='旧批';copySnapshotCaptureGenerated(copies._in,'test');`,ctx);
  vm.runInContext(`copies=${JSON.stringify(batch('NEW'))};copies._in='新批';copySnapshotCaptureGenerated(copies._in,'test');curView='copy';`,ctx);
  const active=vm.runInContext('CopyGenerationHistory.state().activeId',ctx);ctx.__active=active;
  const result=vm.runInContext("copySnapshotDelete(__active);({input:copies._in,title:copies[0].block.mainTitle,count:CopyGenerationHistory.state().batches.length})",ctx);
  assert.equal(result.input,'旧批');
  assert.equal(result.title,'OLD-1');
  assert.equal(result.count,1);
});

test('history archive markup exposes separate restore, pin and delete controls',()=>{
  const storage=makeStorage(),session=makeStorage(),ctx=makeContext(storage,{session});
  vm.runInContext(`copies=${JSON.stringify(batch('UI'))};copies._in='管理按钮测试';copySnapshotCaptureGenerated(copies._in,'test');`,ctx);
  const html=vm.runInContext('copySnapshotArchiveHtml()',ctx);
  assert.match(html,/data-copy-snapshot=/);
  assert.match(html,/data-copy-snapshot-star=/);
  assert.match(html,/data-copy-snapshot-delete=/);
  assert.match(html,/星标/);
});
