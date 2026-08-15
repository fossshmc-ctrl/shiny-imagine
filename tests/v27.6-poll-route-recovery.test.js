'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const adapter=require('../src/core/evolink-image-adapter.js');
const netRes=require('../network-resilience.js');
const keepalive=require('../network-keepalive.js');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');

test('V28.1.1 classifies the observed pre-TLS proxy disconnect as transient',()=>{
  const message='Client network socket disconnected before secure TLS connection was established';
  const info=netRes.classifyNetworkError(new Error(message));
  assert.equal(info.kind,'tls_handshake');
  assert.equal(info.transient,true);
  assert.equal(adapter.retryablePollError(new Error(message)),true);
});

test('V28.1.1 proxy keepalive pools are isolated by target and can be reset selectively',()=>{
  const proxy='http://127.0.0.1:17890';
  const taskAgent=keepalive.httpsProxyAgent(proxy,'https://api.evolink.ai/v1/tasks/task-a');
  const fileAgent=keepalive.httpsProxyAgent(proxy,'https://files-api.evolink.ai/api/v1/files/quota');
  assert.ok(taskAgent);
  assert.ok(fileAgent);
  assert.notEqual(taskAgent,fileAgent);
  assert.equal(keepalive.stats().targetScopedProxyAgents,true);
  assert.equal(keepalive.invalidateHttpsProxyAgent(proxy,'https://api.evolink.ai/v1/tasks/task-a'),1);
  assert.equal(keepalive.stats().httpsProxyAgents,1);
  keepalive.destroyAll();
});

test('V28.1.1 crosses the soft threshold, retries a safe GET, and completes the same task id',async()=>{
  const originalNow=Date.now;
  let now=1_000_000,requestCount=0;
  const paths=[],events=[];
  Date.now=()=>now;
  const sleepFn=async ms=>{now+=Number(ms)>=800?31_000:Number(ms)||0;};
  const fetchJson=async url=>{
    paths.push(url);requestCount++;
    if(requestCount===1)throw new Error('Client network socket disconnected before secure TLS connection was established');
    if(requestCount===2)return {task_id:'task-v276',status:'processing',progress:55};
    return {task_id:'task-v276',status:'completed',progress:100,results:[{url:'https://cdn.example/result.png'}]};
  };
  try{
    const result=await adapter.waitTask(
      {task_id:'task-v276',status:'pending',progress:0},
      fetchJson,
      {stage:'test'},
      event=>events.push(event),
      {source:'test'},
      60_000,
      {softTimeoutMs:30_000,maxTimeoutMs:90_000,retryAttempts:3,retryDelaysMs:[1],sleepFn}
    );
    assert.deepEqual(adapter.extractImages(result),['https://cdn.example/result.png']);
    assert.equal(paths.every(p=>p==='/api/tasks/task-v276'),true);
    assert.equal(events.some(e=>e.pollRetrying&&e.sameTaskOnly===true),true);
    assert.equal(events.some(e=>e.softTimeoutReached===true&&e.pollTimeoutBudgetMs===90_000),true);
    assert.equal(events.at(-1).status,'completed');
    assert.equal(events.at(-1).taskId,'task-v276');
  }finally{Date.now=originalNow;}
});

test('V29 release metadata preserves bounded same-task recovery and authoritative diagnostics',()=>{
  assert.equal(adapter.VERSION,'V28.1.1');
  assert.equal(adapter.POLL_SOFT_TIMEOUT_MS,180000);
  assert.equal(adapter.POLL_TIMEOUT_MS,360000);
  assert.equal(adapter.POLL_MAX_TIMEOUT_MS,480000);
  const config=JSON.parse(read('config.json'));
  assert.equal(config.version,'V29.1');
  assert.equal(config.network.microAdjustPollSoftTimeoutMs,180000);
  assert.equal(config.network.microAdjustPollTimeoutMs,360000);
  assert.equal(config.network.microAdjustPollMaxTimeoutMs,480000);
  assert.equal(config.network.microTaskPollRetryAttempts,3);
  assert.equal(config.network.microRunStaleMs,600000);
  const node=read('server.js'),py=read('server.py'),ui=read('src/features/region-workbench/region-workbench.js');
  for(const token of ['diagnosticAdvisoryProbes:true','sameTaskPolling:true','proxyTlsRecovery:true','pollSoftTimeoutMs:MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS','pollMaxTimeoutMs:MICRO_ADJUST_POLL_MAX_TIMEOUT_MS'])assert.ok(node.includes(token),token);
  for(const token of ["'diagnosticAdvisoryProbes':True","'sameTaskPolling':True","'proxyTlsRecovery':True","'pollSoftTimeoutMs':MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS","'pollMaxTimeoutMs':MICRO_ADJUST_POLL_MAX_TIMEOUT_MS"])assert.ok(py.includes(token),token);
  assert.match(node,/Apifox Echo（辅助探针）/);
  assert.match(node,/EvoLink 生图 API \/models（权威）/);
  assert.match(py,/Apifox Echo（辅助探针）/);
  assert.match(py,/EvoLink 生图 API \/models（权威）/);
  assert.match(ui,/180 秒软阈值后继续同一 task/);
  assert.match(ui,/不会重复提交计费任务/);
});
