'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const bridge=require('../src/core/region-ai-prompt.js');
const regression=require('../src/core/region-generation-regression.js');
const promptState=require('../src/core/region-prompt-state.js');
const ROOT=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');

function task(index,overrides={}){
  const id=overrides.regionId||`cloud_${index}`;
  return{
    regionId:id,
    name:overrides.name||`区域 ${index}`,
    type:overrides.type||'text',
    brushId:overrides.brushId||'red',
    executionMode:overrides.executionMode||'direct_transform',
    userInstruction:overrides.userInstruction||'',
    instruction:Object.prototype.hasOwnProperty.call(overrides,'instruction')?overrides.instruction:`修改区域${id}，保持该区域内容并按目标框执行第 ${index} 项自动调整。`,
    sourceBBox:overrides.sourceBBox||{x:.01*index,y:.02,width:.12,height:.08},
    targetBBox:overrides.targetBBox||{x:.01*index+.01,y:.03,width:.12,height:.08},
    manualCreated:!!overrides.manualCreated
  };
}

function build(tasks){
  return bridge.buildGenerationPrompt({tasks,referencePlan:'fast-v278',hasTargetLayoutGuide:true,maskFeather:4,maskExpand:1});
}

test('V28.1.1 composes instructions per task instead of switching the whole selection to the manual branch',()=>{
  const tasks=[
    task(1,{name:'修改后的文案',userInstruction:'必须把原文“旧文案”准确替换为“新文案”。',instruction:'自动坐标说明 A'}),
    task(2,{name:'产品瓶身',type:'product',instruction:'自动要求 B：保持产品瓶身与包装文字，移动到目标框。'}),
    task(3,{name:'底部卖点',instruction:'自动要求 C：保持“3.6倍免疫提升”并按目标框缩放。'})
  ];
  const prompt=build(tasks);
  assert.match(prompt,/必须把原文“旧文案”准确替换为“新文案”/);
  assert.match(prompt,/自动要求 B：保持产品瓶身与包装文字/);
  assert.match(prompt,/自动要求 C：保持“3\.6倍免疫提升”/);
  assert.match(prompt,/每个已选区域都必须执行/);
  assert.match(prompt,/不得因为其中某个区域存在手工文案要求而忽略其他自动区域或自由添加区域/);
  const expected=regression.createExpectation(tasks,prompt,{source:'mixed-selection'});
  const check=regression.verifyBridge(expected,tasks,prompt);
  assert.equal(check.ok,true,check.issues.join('；'));
  assert.deepEqual(check.missingInstructionRegionIds,[]);
});

test('V28.1.1 keeps all fifteen selected regions in the final prompt after one OCR text correction',()=>{
  const tasks=Array.from({length:15},(_,i)=>task(i+1));
  tasks[6]={...tasks[6],name:'3.6倍免疫提升',userInstruction:'必须将文字“3.6倍免疫提升”修改为“3.6倍营养守护”。'};
  const prompt=build(tasks);
  for(let i=1;i<=15;i++)assert.match(prompt,new RegExp(`【区域 ${i}】|【3\\.6倍免疫提升】`));
  for(let i=1;i<=15;i++){
    if(i===7)assert.match(prompt,/3\.6倍营养守护/);
    else assert.match(prompt,new RegExp(`第 ${i} 项自动调整`));
  }
  const check=regression.verifyBridge(regression.createExpectation(tasks,prompt),tasks,prompt);
  assert.equal(check.ok,true,check.issues.join('；'));
  assert.equal(check.taskCount,15);
  assert.deepEqual(check.missingInstructionRegionIds,[]);
});

test('V28.1.1 freely added region remains executable beside edited and automatic OCR regions',()=>{
  const tasks=[
    task(1,{name:'安全营养健康',userInstruction:'把文字改为“科学营养守护”。'}),
    task(2,{name:'产品区域',type:'product',instruction:'保持产品外观，按目标框移动。'}),
    task(3,{regionId:'custom_01',name:'自由添加区域 01',type:'decoration',manualCreated:true,userInstruction:'仅编辑自由添加区域“自由添加区域 01”，在框内增加柔和光效；其他区域保持不变。',instruction:'自由区域实时坐标说明。'})
  ];
  const prompt=build(tasks);
  assert.match(prompt,/科学营养守护/);
  assert.match(prompt,/保持产品外观，按目标框移动/);
  assert.match(prompt,/仅编辑自由添加区域“自由添加区域 01”/);
  const check=regression.verifyBridge(regression.createExpectation(tasks,prompt),tasks,prompt);
  assert.equal(check.ok,true,check.issues.join('；'));
  assert.deepEqual(check.missingInstructionRegionIds,[]);
});

test('V28.1.1 creates an explicit priority instruction even when a selected task has no stored prompt',()=>{
  const tasks=[task(1,{name:'无历史指令区域',instruction:''})];
  const primary=bridge.taskPrimaryInstruction(tasks[0],0,[]);
  assert.equal(primary.source,'generated-default');
  assert.match(primary.text,/必须处理已选区域“无历史指令区域”/);
  const prompt=build(tasks);
  assert.match(prompt,/【无历史指令区域】必须处理已选区域/);
  assert.match(prompt,/"prompt_source": "generated-default"/);
});

test('V28.1.1 migrates legacy freely added regions into a usable manual instruction',()=>{
  const region={region_id:'custom_04',name:'自由框 04',type:'product',source:'manual-free-region',manualCreated:true,suggestedInstruction:'只编辑自由添加的产品区域，其他区域保持不变。'};
  assert.equal(promptState.isFreeRegion(region),true);
  assert.equal(promptState.freeRegionInstruction(region,'当前自动坐标','旧自动坐标'),'只编辑自由添加的产品区域，其他区域保持不变。');
  const emptyLegacy={region_id:'custom_05',name:'自由框 05',type:'decoration',source:'manual-free-region',manualCreated:true};
  assert.match(promptState.freeRegionInstruction(emptyLegacy,'',''),/仅处理自由添加的装饰区域/);
});

test('V28.1.1 browser wiring exposes current aliases and seeds newly created free regions',()=>{
  const promptSource=read('src/core/region-ai-prompt.js');
  const stateSource=read('src/core/region-prompt-state.js');
  const workbench=read('src/features/region-workbench/region-workbench.js');
  const core=read('src/features/adjust/image-adjust-core.js');
  assert.match(promptSource,/root\.RegionAiPromptV279=api/);
  assert.match(promptSource,/root\.RegionAiPromptV278=api/);
  assert.match(stateSource,/root\.RegionPromptStateV279=api/);
  assert.match(stateSource,/root\.RegionPromptStateV278=api/);
  assert.match(core,/RegionAiPromptV279/);
  assert.match(core,/promptBridge:'RegionAiPromptV279'/);
  for(const token of ['const freeInstruction=','__v173ManualRequirement:freeInstruction','__v278ManualRegion:true','freeRegionInstruction(r,auto,lastAuto)'])assert.ok(workbench.includes(token),token);
  assert.doesNotMatch(promptSource,/const primary\s*=\s*intents\.length\s*\?\s*intents\s*:\s*effective/);
});

test('V29 loads prompt state and prompt bridge before generation consumers with a fresh cache key',()=>{
  const html=read('index.html');
  const stateAt=html.indexOf('src/core/region-prompt-state.js?v=29.1.0');
  const bridgeAt=html.indexOf('src/core/region-ai-prompt.js?v=29.1.0');
  const coreAt=html.indexOf('src/features/adjust/image-adjust-core.js?v=29.1.0');
  const workbenchAt=html.indexOf('src/features/region-workbench/region-workbench.js?v=29.1.0');
  assert.ok(stateAt>=0&&bridgeAt>stateAt&&coreAt>bridgeAt&&workbenchAt>coreAt,{stateAt,bridgeAt,coreAt,workbenchAt});
  assert.doesNotMatch(html,/\?v=27\.7/);
});


test('V28.1.1 regression matcher accepts the same automatic instruction after JSON escaping',()=>{
  const instruction='修改区域R07（3.6倍免疫提升），原始区域左上角坐标为X 5.0%、Y 70.0%，目标区域保持不变。\n保持文字内容与排版不变。';
  const serialized=JSON.stringify({instruction});
  assert.equal(regression.fuzzyIncludes(serialized,instruction),true);
  const tasks=[task(7,{regionId:'R07',name:'3.6倍免疫提升',instruction})];
  const prompt=`【最高优先级：AI 修改指令】\n【3.6倍免疫提升】按区域任务执行\n\n【结构化区域任务】\n${serialized}`;
  const check=regression.verifyBridge(regression.createExpectation(tasks,prompt),tasks,prompt);
  assert.equal(check.ok,true,check.issues.join('；'));
});

test('V28.1.1 commits active text drafts before Prompt synchronization and preserves free regions on refresh',()=>{
  const workbench=read('src/features/region-workbench/region-workbench.js');
  for(const token of [
    'function commitActiveRegionTextDraft(options={})',
    'window.__V278_COMMIT_ACTIVE_REGION_TEXT__',
    'function commitActiveDocumentBlockDraft(options={})',
    'window.__V278_COMMIT_ACTIVE_DOCUMENT_TEXT__',
    'r.manualCreated',
    "r.source==='manual-free-region'",
    'aiUserInstruction:freeInstruction',
    '__v278CreationInstruction:freeInstruction',
    'const migratedFree=',
    'if(r.__v277PromptHydrated)'
  ])assert.ok(workbench.includes(token),token);

  const applyStart=workbench.indexOf('async function applyToMain()');
  const applyEnd=workbench.indexOf('\n  function copyText(',applyStart);
  const applySource=workbench.slice(applyStart,applyEnd);
  assert.ok(applySource.indexOf('commitActiveDocumentBlockDraft')>=0);
  assert.ok(applySource.indexOf('commitActiveDocumentBlockDraft')<applySource.indexOf('commitActiveRegionTextDraft'));
  assert.ok(applySource.indexOf('commitActiveRegionTextDraft')<applySource.indexOf('__V271_COMMIT_ACTIVE_AI_PROMPT__'));

  const generateStart=workbench.indexOf('async function performGeneration(options={})');
  const generateEnd=workbench.indexOf('\n  function beginCheck(mode)',generateStart);
  const generateSource=workbench.slice(generateStart,generateEnd);
  assert.ok(generateSource.indexOf('__V278_COMMIT_ACTIVE_DOCUMENT_TEXT__')>=0);
  assert.ok(generateSource.indexOf('__V278_COMMIT_ACTIVE_DOCUMENT_TEXT__')<generateSource.indexOf('__V278_COMMIT_ACTIVE_REGION_TEXT__'));
  assert.ok(generateSource.indexOf('__V278_COMMIT_ACTIVE_REGION_TEXT__')<generateSource.indexOf('__V271_COMMIT_ACTIVE_AI_PROMPT__'));
});
