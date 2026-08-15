const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=require('../src/core/region-ai-prompt.js');
const ROOT=path.join(__dirname,'..');

test('V27.1 region prompt bridge makes user AI instruction highest priority',()=>{
  const prompt=bridge.buildGenerationPrompt({tasks:[{regionId:'cloud_3',name:'猫咪',type:'person',brushId:'amber',executionMode:'move_and_repair',userInstruction:'把猫咪向左移动，保持猫咪外观完全一致',instruction:'自动坐标说明',sourceBBox:{x:.55,y:.2,width:.35,height:.4},targetBBox:{x:.1,y:.25,width:.35,height:.4}}],maskFeather:6,maskExpand:2});
  assert.match(prompt,/最高优先级：AI 修改指令/);
  assert.match(prompt,/把猫咪向左移动，保持猫咪外观完全一致/);
  assert.match(prompt,/从原位置移除主体并自然修复原位置/);
  assert.match(prompt,/不能只在目标区域复制一份主体/);
  assert.match(prompt,/SOURCE|source/i);
});

test('V27.1 prompt parsing preserves manual intent separate from generated geometry',()=>{
  const value='把人物移到右下角，人物身份不变\n\n【V27 实时参数（自动更新）】\n修改区域cloud_1，原始区域左上角坐标为X 1%，目标区域左上角坐标为X 20%。';
  const split=bridge.splitPrompt(value);
  assert.equal(split.manual,'把人物移到右下角，人物身份不变');
  assert.match(split.auto,/修改区域cloud_1/);
});

test('V27.1 edit envelope contains source and target for move operations',()=>{
  const e=bridge.envelope({sourceBBox:{x:.6,y:.2,width:.2,height:.3},targetBBox:{x:.1,y:.4,width:.2,height:.3}});
  assert.equal(e.moved,true);
  assert.equal(e.source.x,.6);
  assert.equal(e.target.x,.1);
});

test('region workbench commits Detail AI instruction before generation and syncs per-region tasks',()=>{
  const src=fs.readFileSync(path.join(ROOT,'src/features/region-workbench/region-workbench.js'),'utf8');
  assert.match(src,/__V271_COMMIT_ACTIVE_AI_PROMPT__/);
  assert.match(src,/__V271_RESOLVE_REGION_PROMPT__/);
  assert.match(src,/__V271_REGION_USER_INTENT__/);
  assert.match(src,/adjustState\.regionAiTasks\.push/);
  assert.match(src,/adjustState\.aiScope=rows\.length>1\?'all':'active'/);
  assert.match(src,/AI 修改指令已作为最高优先级同步/);
});

test('image adjust core uses V27.1 prompt bridge and source-target edit envelopes',()=>{
  const src=fs.readFileSync(path.join(ROOT,'src/features/adjust/image-adjust-core.js'),'utf8');
  assert.match(src,/RegionAiPromptV271/);
  assert.match(src,/adjustFillRegionEnvelope/);
  assert.match(src,/adjustDrawRegionGuides/);
  assert.match(src,/regionAiTasks/);
  assert.match(src,/source_and_target/);
});
