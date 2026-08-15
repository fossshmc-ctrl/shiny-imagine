'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const promptBridge=require('../src/core/region-ai-prompt.js');
const regression=require('../src/core/region-generation-regression.js');
const base=require('../src/core/micro-edit-base-session.js');

test('V28 text edit prompt carries exact replacement into a dedicated high-priority section',()=>{
  const task={regionId:'cloud_3',name:'升级内调免疫配方',type:'text',textEdited:true,userInstruction:'必须将该文字区域原文“普通补剂”准确替换为“升级内调免疫配方”，不得保留旧文、不得新增其他文案。',instruction:'自动几何信息'};
  const prompt=promptBridge.buildGenerationPrompt({tasks:[task],fallbackInstructions:[],hasTargetLayoutGuide:false,referencePlan:'fast-v280',maskFeather:6,maskExpand:0});
  assert.match(prompt,/【文字内容强制执行｜V28\.1\.1】/);
  assert.match(prompt,/“普通补剂”准确替换为“升级内调免疫配方”/);
  assert.match(prompt,/禁止改写、同义替换、翻译、漏字、增字/);
  const exp=regression.createExpectation([task],prompt,{source:'test'});
  assert.equal(regression.verifyBridge(exp,[task],prompt).ok,true);
});

test('V28 text regression blocks a task when the dedicated text section is missing',()=>{
  const task={regionId:'cloud_3',name:'文字区域',type:'text',textEdited:true,userInstruction:'必须将该文字区域原文“普通补剂”准确替换为“升级内调免疫配方”'};
  const prompt='【最高优先级：AI 修改指令】必须将该文字区域原文“普通补剂”准确替换为“升级内调免疫配方”';
  const exp=regression.createExpectation([task],prompt,{source:'test'});
  const result=regression.verifyBridge(exp,[task],prompt);
  assert.equal(result.ok,false);
  assert.match(result.issues.join('；'),/文字强制执行段/);
});

test('V28 base session explicitly distinguishes current-result continuation from recognition-original restart',()=>{
  const state={src:'current-result',originalSrc:'recognition-original',name:'result.png',originalName:'original.png'};
  assert.equal(base.resolveBase(state,'current').source,'current-result');
  assert.equal(base.resolveBase(state,'original').source,'recognition-original');
  assert.equal(base.label('current'),'当前结果');
  assert.equal(base.label('original'),'识别原图');
  assert.match(base.hint('current'),/继续/);
  assert.match(base.hint('original'),/不继承/);
});

test('V28 micro transport accepts additional text-fidelity references without replacing the base reference',()=>{
  const source=read('src/core/micro-image-transport.js');
  assert.match(source,/extraRefs=\[\]/);
  assert.match(read('src/features/adjust/image-adjust-core.js'),/role:'text-fidelity'/);
  assert.match(source,/extraReferenceCount/);
  assert.match(source,/source\+layout-mask-guide\+text-fidelity-v280/);
});

test('V28 workbench exposes an explicit micro-edit base selector',()=>{
  const workbench=read('src/features/region-workbench/region-workbench.js');
  assert.match(workbench,/data-v28-micro-base/);
  assert.match(workbench,/当前结果/);
  assert.match(workbench,/识别原图/);
  assert.match(workbench,/microBaseMode==='original'/);
});
