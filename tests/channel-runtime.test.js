const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const isolation=require('../src/core/channel-isolation.js');

function createRuntime(){
  const calls={copy:0,shared:0};
  const document={documentElement:{dataset:{}}};
  const window={
    GenerationChannelIsolation:isolation,
    CopyCozeV24:{status:async()=>{calls.copy++;return {ok:true,provider:'coze'};}},
    SharedApiBootstrap:{ensureForView:async view=>{calls.shared++;return {ok:true,view};}}
  };
  const context={window,document,curView:'home',console,Promise,setTimeout,clearTimeout};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../src/infrastructure/api/channel-runtime.js'),'utf8');
  vm.runInContext(source,context);
  return {window,document,calls};
}

test('entering copy calls only the Coze status channel',async()=>{
  const r=createRuntime();
  r.calls.copy=0;r.calls.shared=0;
  await r.window.AppChannelRuntime.enter('copy');
  assert.equal(r.calls.copy,1);
  assert.equal(r.calls.shared,0);
  assert.equal(r.document.documentElement.dataset.generationChannel,'copy-coze');
});

test('entering image or wireframe may use the shared model bootstrap',async()=>{
  const r=createRuntime();
  r.calls.copy=0;r.calls.shared=0;
  await r.window.AppChannelRuntime.enter('integrate');
  await r.window.AppChannelRuntime.enter('image');
  assert.equal(r.calls.copy,0);
  assert.equal(r.calls.shared,2);
  assert.equal(r.document.documentElement.dataset.generationChannel,'shared-image');
});
