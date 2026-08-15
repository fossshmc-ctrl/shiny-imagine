const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V27 micro channel is wired to region workbench with compatibility aliases',()=>{
  const micro=read('src/integrations/micro-api-channel.js');
  const region=read('src/features/region-workbench/region-workbench.js');
  assert.match(micro,/window\.__V27_MICRO_API__=bridge/);
  assert.match(micro,/window\.__V24_MICRO_API__=bridge/);
  assert.match(micro,/window\.__V23_MICRO_API__=bridge/);
  assert.match(region,/function microApiBridge\(\).*__V27_MICRO_API__/s);
  assert.match(region,/data-v27-micro-api-config/);
  assert.match(region,/data-v27-micro-api-test/);
});

test('V27 micro channel defaults to EvoLink Nano Banana 2 Lite',()=>{
  const micro=read('src/integrations/micro-api-channel.js');
  assert.match(micro,/https:\/\/api\.evolink\.ai\/v1/);
  assert.match(micro,/gemini-3\.1-flash-lite-image/);
  assert.match(micro,/nanobanana\/nanobanana-2-lite-image-generate/);
  assert.match(micro,/Nano Banana 2 Lite/);
});

test('V27 API test checks credits, model image input and local reference without billed generation',()=>{
  const micro=read('src/integrations/micro-api-channel.js');
  assert.match(micro,/账户 Credits \/ 生图额度/);
  assert.match(micro,/当前微调模型图生图能力/);
  assert.match(micro,/本地参考图转换/);
  assert.match(micro,/generationReady/);
  assert.match(micro,/supportsImageInput/);
  assert.match(micro,/不会创建计费生图任务/);
  assert.match(micro,/\/api\/micro\/network-diagnose\?deep=1/);
});

test('V27 preflight blocks unavailable credits or non-image-input model before micro generation',()=>{
  const micro=read('src/integrations/micro-api-channel.js');
  assert.match(micro,/r\.ready/);
  assert.match(micro,/!r\.billing\.ok/);
  assert.match(micro,/!r\.model\.ok/);
  assert.match(micro,/throw new Error\(message\|\|'微调生图前置检查失败'\)/);
});

test('V27 keeps micro generation channel isolated while reusing EvoLink adapter',()=>{
  const micro=read('src/integrations/micro-api-channel.js');
  assert.match(micro,/generationActive/);
  assert.match(micro,/EVO\.generate/);
  assert.match(micro,/const VERSION='V28\.1\.1'/);
  assert.match(micro,/微调通道仍与“AI线框生成 \/ AI生图”配置隔离/);
});
