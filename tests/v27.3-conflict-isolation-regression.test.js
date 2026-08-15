const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('V27.3 regression bridge keeps AI instruction and changed geometry',()=>{
  const reg=require('../src/core/region-generation-regression.js');
  assert.equal(reg.VERSION,'V28.1.1');
  const tasks=[{regionId:'cloud_2',name:'核心卖点',type:'text',userInstruction:'把核心卖点移动到右下方，保持文字内容不变',sourceBBox:{x:.5,y:.16,width:.26,height:.4},targetBBox:{x:.64,y:.24,width:.26,height:.18}}];
  const prompt='【最高优先级：AI 修改指令】把核心卖点移动到右下方，保持文字内容不变。目标区域 TARGET：X 64%，Y 24%。';
  const exp=reg.createExpectation(tasks,prompt,{source:'test'});
  assert.equal(exp.changedGeometryCount,1);
  assert.equal(reg.verifyBridge(exp,tasks,prompt).ok,true);
  const broken=tasks.map(t=>({...t,targetBBox:{...t.sourceBBox}}));
  const check=reg.verifyBridge(exp,broken,prompt);
  assert.equal(check.ok,false);
  assert.match(check.issues.join('；'),/目标位置\/尺寸变化在同步后丢失/);
});

test('V27.3 conflict detection is advisory and offers ignore-obstacles generation',()=>{
  const s=read('src/features/region-workbench/region-workbench.js');
  assert.match(s,/data-v273-ignore-obstacles/);
  assert.match(s,/无视阻碍继续生成/);
  assert.match(s,/isolated-no-auto-conflict-check/);
  assert.match(s,/ignore-known-conflicts-once/);
  assert.match(s,/冲突检测已与微调通道隔离/);
  const begin=s.match(/function beginCheck\(mode\)\{[^\n]+\}/)?.[0]||'';
  assert.match(begin,/mode==='inspect'.*runNativeConflict/);
  assert.doesNotMatch(begin,/mode==='generate'.*runNativeConflict/);
});

test('V27.3 supplies deterministic target-layout evidence before billed micro generation',()=>{
  const core=read('src/features/adjust/image-adjust-core.js');
  const layer=read('src/features/adjust/image-adjust-enhancement-layer.js');
  const prompt=read('src/core/region-ai-prompt.js');
  assert.match(core,/function adjustTargetLayoutGuideDataUrl/);
  assert.match(core,/hasTargetLayoutGuide/);
  assert.match(layer,/targetLayoutGuideSrc/);
  assert.match(layer,/verifyBridge\(expectation,tasks,prompt\)/);
  assert.match(layer,/analyzeImages\(source,src,tasks\)/);
  assert.match(layer,/不会自动重复计费生成/);
  assert.match(prompt,/目标布局预演图/);
  assert.match(prompt,/最终结果必须在 source 或 target 区域产生可观察到的变化/);
});

test('V27.3 micro billed channel requires isolated health plus instruction fingerprint',()=>{
  const client=read('src/integrations/micro-api-channel.js');
  const server=read('server.js');
  assert.match(client,/micro-adjust-v27\.8/);
  assert.match(client,/fetchBounded\('\/api\/micro\/health/);
  assert.match(client,/function assertIsolation/);
  assert.match(client,/X-Micro-Instruction-Fingerprint/);
  assert.match(client,/X-Micro-Conflict-Policy/);
  assert.match(client,/X-Micro-Handoff-Acknowledged/);
  assert.match(client,/acknowledgeGeneration/);
  assert.match(server,/micro-adjust-v27\.8/);
  assert.match(server,/X-Micro-Generation-Id/i);
  assert.match(server,/x-micro-handoff-acknowledged/i);
  assert.match(server,/micro_channel_isolation_failed/);
  assert.match(server,/isolatedFromConflictRisk:true/);
});

test('V27.3 micro output exposes regression status to the right-side result pane',()=>{
  const output=read('src/features/adjust/micro-adjust-output-channel.js');
  const workbench=read('src/features/region-workbench/region-workbench.js');
  assert.match(output,/regression:item\?\.regression\|\|null/);
  assert.match(workbench,/回归检测通过/);
  assert.match(workbench,/结果需复核/);
});
