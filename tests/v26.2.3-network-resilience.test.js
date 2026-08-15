'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const net=require('../network-resilience');

test('V26.2.3 classifies socket hang up as transient connection reset',()=>{
  const info=net.classifyNetworkError(Object.assign(new Error('socket hang up'),{code:'ECONNRESET'}));
  assert.equal(info.kind,'connection_reset');
  assert.equal(info.transient,true);
});

test('V26.2.3 decodes Data URL and builds smaller multipart stream payload',()=>{
  const payload='data:image/png;base64,'+Buffer.from('1234567890').toString('base64');
  const decoded=net.decodeImageDataUrl(payload);
  assert.equal(decoded.mime,'image/png');
  assert.deepEqual(decoded.buffer,Buffer.from('1234567890'));
  const mp=net.buildMultipartFile(decoded.buffer,decoded.mime,'probe.png');
  assert.match(mp.contentType,/multipart\/form-data; boundary=/);
  assert.match(mp.body.toString('latin1'),/name="file"; filename="probe.png"/);
  assert.match(mp.body.toString('latin1'),/Content-Type: image\/png/);
});

test('V26.2.3 resilient upload falls back from proxy route to direct after reset',async()=>{
  const calls=[];
  const result=await net.retryTransient(async({attempt,route})=>{
    calls.push({attempt,route});
    if(attempt===1){const e=Object.assign(new Error('socket hang up'),{code:'ECONNRESET'});throw e;}
    return {status:200,headers:{},body:Buffer.from('{}')};
  },{routes:['proxy http://127.0.0.1:7890','direct-fallback'],delays:[0],maxAttempts:2,sleep:async()=>{}});
  assert.equal(result.status,200);
  assert.equal(result.attempts,2);
  assert.equal(result.route,'direct-fallback');
  assert.deepEqual(calls.map(x=>x.route),['proxy http://127.0.0.1:7890','direct-fallback']);
});

test('V26.2.3 does not retry non-transient request errors',async()=>{
  let count=0;
  await assert.rejects(()=>net.retryTransient(async()=>{count++;throw new Error('invalid parameters');},{routes:['direct'],delays:[0,0],maxAttempts:3,sleep:async()=>{}}),/invalid parameters/);
  assert.equal(count,1);
});

test('V26.2.3 Node/Python servers proxy local base64 through EvoLink stream endpoint',()=>{
  const root=path.resolve(__dirname,'..');
  const node=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const py=fs.readFileSync(path.join(root,'server.py'),'utf8');
  for(const source of [node,py]){
    assert.match(source,/upload\/stream/);
    assert.match(source,/network-diagnose/);
    assert.match(source,/echo\.apifox\.com\/get/);
  }
  assert.match(node,/requestFileUploadResilient/);
  assert.match(py,/request_file_upload_resilient/);
});
