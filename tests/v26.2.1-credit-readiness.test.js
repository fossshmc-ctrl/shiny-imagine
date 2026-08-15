const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const adapter=require('../src/core/evolink-image-adapter.js');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V26.2.3 normalizes EvoLink account and token credit balances',()=>{
  const info=adapter.normalizeCreditsPayload({success:true,data:{token:{remaining_credits:7.5,unlimited_credits:false,used_credits:2},user:{remaining_credits:10,used_credits:1}}});
  assert.equal(info.checked,true);
  assert.equal(info.blocked,false);
  assert.equal(info.effectiveRemaining,7.5);
  assert.equal(info.tokenRemaining,7.5);
  assert.equal(info.userRemaining,10);
});

test('V26.2.3 blocks before file upload or billed image generation when credits are exhausted',async()=>{
  const calls=[];
  const fetchJson=async(url,options)=>{
    calls.push(url);
    if(url==='/api/credits')return {success:true,data:{token:{remaining_credits:0,unlimited_credits:false},user:{remaining_credits:0}}};
    if(url===adapter.FILE_UPLOAD_ENDPOINT)throw new Error('must not upload when credits are exhausted');
    if(url===adapter.GENERATE_ENDPOINT)throw new Error('must not create billed task when credits are exhausted');
    throw new Error('unexpected '+url);
  };
  await assert.rejects(()=>adapter.generate({fetchJson,model:'gpt-image-2',prompt:'demo',refs:['data:image/png;base64,aGVsbG8=']}),err=>{
    assert.equal(err.httpStatus,402);
    assert.equal(err.code,'insufficient_credits');
    assert.match(err.message,/EvoLink 生图额度不足/);
    return true;
  });
  assert.deepEqual(calls,['/api/credits']);
});

test('V26.2.3 proceeds when credits are available',async()=>{
  const calls=[];
  const fetchJson=async(url,options)=>{
    calls.push(url);
    if(url==='/api/credits')return {success:true,data:{token:{remaining_credits:100,unlimited_credits:false},user:{remaining_credits:50}}};
    if(url===adapter.GENERATE_ENDPOINT)return {id:'task-ok',status:'completed',results:['https://cdn.example/out.png']};
    throw new Error('unexpected '+url);
  };
  const result=await adapter.generate({fetchJson,model:'gemini-3.1-flash-lite-image',prompt:'demo',count:1});
  assert.deepEqual(result,['https://cdn.example/out.png']);
  assert.deepEqual(calls,['/api/credits',adapter.GENERATE_ENDPOINT]);
});

test('V26.2.3 diagnostics query real EvoLink credits instead of treating file quota as generation readiness',()=>{
  const node=read('server.js'),py=read('server.py'),client=read('src/infrastructure/api/api-config-client.js'),flow=read('src/features/image/image-flow-diagnostics.js');
  for(const source of [node,py]){
    assert.match(source,/\/credits/);
    assert.match(source,/generationReady/);
    assert.match(source,/Credits 不足/);
  }
  assert.match(client,/账户 Credits \/ 生图额度/);
  assert.match(client,/status===402/);
  assert.match(client,/EvoLink 生图额度不足/);
  assert.match(flow,/apiFailureInfo/);
});

test('V26.2.3 exposes a non-billable local /api/credits preflight route in both Windows servers',()=>{
  const node=read('server.js'),py=read('server.py');
  assert.match(node,/apiPath === '\/credits'/);
  assert.match(node,/normalizeEvolinkBase\(baseUrl\)\+'\/credits'/);
  assert.match(py,/api_path == '\/credits'/);
  assert.match(py,/normalize_evolink_base\(base\) \+ '\/credits'/);
});

test('V26.2.3 does not mark an unrecognized credits payload as verified',()=>{
  const info=adapter.normalizeCreditsPayload({success:true,data:{}});
  assert.equal(info.checked,false);
  assert.equal(info.recognized,false);
  assert.equal(info.blocked,false);
});
