'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ref=require('../evolink-reference-upload');

test('V27 reference cache id is stable per file and API token without storing token',()=>{
  const a=ref.referenceCacheId(Buffer.from('abc'),'secret-one');
  const b=ref.referenceCacheId(Buffer.from('abc'),'secret-one');
  const c=ref.referenceCacheId(Buffer.from('abc'),'secret-two');
  assert.equal(a,b);assert.notEqual(a,c);assert.match(a,/^[a-f0-9]{64}$/);
});

test('V27 recognizes valid EvoLink file response and protocol fallback cases',()=>{
  const good={status:200,body:Buffer.from(JSON.stringify({success:true,data:{file_url:'https://files.evolink.ai/a.jpg',expires_at:'2099-01-01T00:00:00Z'}}))};
  assert.equal(ref.parseFileUploadResponse(good).url,'https://files.evolink.ai/a.jpg');
  assert.equal(ref.shouldProtocolFallback(good),false);
  assert.equal(ref.shouldProtocolFallback({status:502,body:Buffer.from('bad gateway')}),true);
  assert.equal(ref.shouldProtocolFallback({status:401,body:Buffer.from('unauthorized')}),false);
  assert.equal(ref.shouldProtocolFallback({status:200,body:Buffer.from('{"success":true}')}),true);
});

test('V27 base64 protocol fallback payload is official Data URL shape',()=>{
  const body=JSON.parse(ref.buildBase64Payload(Buffer.from([1,2,3]),'image/png').toString('utf8'));
  assert.equal(body.base64_data,'data:image/png;base64,AQID');
});

test('V27 server exposes isolated reference-upload route, dual protocol fallback and persistent cache',()=>{
  const root=path.join(__dirname,'..');
  const js=fs.readFileSync(path.join(root,'server.js'),'utf8');
  const adapter=fs.readFileSync(path.join(root,'src/core/evolink-image-adapter.js'),'utf8');
  assert.match(js,/evolink-reference-cache\.json/);
  assert.match(js,/requestReferenceUploadRobust/);
  assert.match(js,/upload\/stream/);
  assert.match(js,/upload\/base64/);
  assert.match(js,/referenceUpload:\{provider:'evolink-files'/);
  assert.match(adapter,/\/api\/evolink\/files\/upload\/reference/);
});

test('V27 UI exposes isolated reference-upload channel and attempt trace instead of blaming image generation',()=>{
  const root=path.resolve(__dirname,'..');
  const flow=fs.readFileSync(path.join(root,'src/features/image/image-flow-diagnostics.js'),'utf8');
  const adapter=fs.readFileSync(path.join(root,'src/core/evolink-image-adapter.js'),'utf8');
  assert.match(flow,/失败通道/);
  assert.match(flow,/最近上传轨迹/);
  assert.match(flow,/evolink-files\/reference isolated/);
  assert.match(adapter,/error\.stage='EvoLink 参考图上传'/);
  assert.match(adapter,/error\.parentStage=parentStage/);
});
