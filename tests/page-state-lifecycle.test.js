const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const routes=require('../src/core/route-persistence.js');
const source=fs.readFileSync(path.join(__dirname,'../src/app/page-state-lifecycle.js'),'utf8');

function context(){
  const calls={restore:0,fresh:0};
  const ctx={AppRoutePersistence:routes,copySnapshotRestoreOnReload:()=>{calls.restore++;return true;},copySnapshotBeginFreshEntry:()=>{calls.fresh++;return true;},calls};
  vm.createContext(ctx);ctx.window=ctx;ctx.globalThis=ctx;vm.runInContext(source,ctx);return ctx;
}

test('reload of copy delegates business-state restore to the copy page only',()=>{
  const ctx=context();
  const result=ctx.AppPageStateLifecycle.prepareBoot('copy',{isReload:true});
  assert.equal(result.restored,true);
  assert.equal(ctx.calls.restore,1);
  ctx.AppPageStateLifecycle.prepareBoot('image',{isReload:true});
  assert.equal(ctx.calls.restore,1);
});

test('fresh navigation into copy clears only copy runtime while history remains page-owned',()=>{
  const ctx=context();
  ctx.AppPageStateLifecycle.beforeNavigation('home','copy');
  assert.equal(ctx.calls.fresh,1);
  ctx.AppPageStateLifecycle.beforeNavigation('copy','copy');
  assert.equal(ctx.calls.fresh,1);
});

test('page policies keep route location separate from business-state storage',()=>{
  const ctx=context(),p=ctx.AppPageStateLifecycle.POLICY;
  assert.equal(p.copy.storage,'session+local');
  assert.equal(p.adjust.storage,'indexeddb+session');
  assert.equal(p.image.reload,'fresh-task-runtime');
  assert.equal(p.integrate.reload,'fresh-task-runtime');
  assert.equal(p.home.storage,'none');
});
