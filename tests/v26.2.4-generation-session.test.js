'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const session=require('../src/core/image-generation-session');
const adapter=require('../src/core/evolink-image-adapter');

test('V26.2.4 new generation session supersedes old AbortController without poisoning the new session',()=>{
  const ui={active:true};
  const first=session.begin(ui,'frame');
  const firstSignal=ui.abortController.signal;
  const second=session.begin(ui,'frame');
  assert.notEqual(first,second);
  assert.equal(firstSignal.aborted,true);
  assert.equal(session.isCurrent(ui,first),false);
  assert.equal(session.isCurrent(ui,second),true);
  assert.equal(session.signal(ui,second).aborted,false);
  const oldClass=session.classify(new Error('signal is aborted without reason'),ui,first);
  assert.equal(oldClass.kind,'stale_generation');
  assert.equal(oldClass.intentional,true);
  assert.equal(session.signal(ui,second).aborted,false);
});

test('V26.2.4 recovers an unexplained already-aborted current signal before a safe local request',()=>{
  const ui={active:true};
  const id=session.begin(ui,'copy');
  ui.abortController.abort(); // no user/superseded ledger entry => unexplained abort
  assert.equal(ui.abortController.signal.aborted,true);
  const recovered=session.signal(ui,id,{recoverUnexpected:true});
  assert.equal(recovered.aborted,false);
  assert.equal(session.history(ui,id).type,'unexpected_abort_recovered');
});

test('V26.2.4 user stop is classified and never silently recovered',()=>{
  const ui={active:true};
  const id=session.begin(ui,'frame');
  session.cancel(ui,id,'user','clicked stop');
  assert.throws(()=>session.signal(ui,id,{recoverUnexpected:true}),e=>e&&e.kind==='generation_cancelled');
  const cls=session.classify(new Error('signal is aborted without reason'),ui,id);
  assert.equal(cls.kind,'generation_cancelled');
  assert.equal(cls.intentional,true);
});

test('V26.2.4 reference upload diagnostics report the real upload stage while retaining parent stage',async()=>{
  const seen=[];
  const dataUrl='data:image/png;base64,'+Buffer.from('abc').toString('base64');
  const out=await adapter.uploadReferences([dataUrl],async(endpoint,options,meta)=>{
    seen.push({endpoint,meta});
    return {data:{file_url:'https://files.evolink.ai/tmp/ref.png'}};
  },{model:'gpt-image-2',meta:{mode:'frame',stage:'EvoLink 多图编辑',sessionId:'frame-test'}});
  assert.deepEqual(out,['https://files.evolink.ai/tmp/ref.png']);
  assert.equal(seen[0].endpoint,'/api/evolink/files/upload/reference');
  assert.equal(seen[0].meta.stage,'EvoLink 参考图上传');
  assert.equal(seen[0].meta.parentStage,'EvoLink 多图编辑');
  assert.equal(seen[0].meta.sessionId,'frame-test');
});

test('V26.2.4 image-flow integration guards stale failure writeback and safe-abort retry',()=>{
  const root=path.resolve(__dirname,'..');
  const source=fs.readFileSync(path.join(root,'src/features/image/image-flow-diagnostics.js'),'utf8');
  assert.match(source,/SESSION\.isCurrent\(ui,sid\)/);
  assert.match(source,/忽略旧会话失败回写/);
  assert.match(source,/safeRetry=method==='GET'\|\|url==='\/api\/credits'\|\|url==='\/api\/evolink\/files\/upload\/reference'\|\|url==='\/api\/evolink\/files\/upload\/base64'/);
  assert.match(source,/sessionId:generationSessionId/);
  assert.match(source,/不会自动重提计费请求/);
  assert.match(source,/生图任务中心/);
});
