const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const overview=require('../src/core/wireframe-overview-state.js');

test('normalizes persisted disclosure values',()=>{
  assert.equal(overview.normalizeExpanded(true),true);
  assert.equal(overview.normalizeExpanded('1'),true);
  assert.equal(overview.normalizeExpanded('true'),true);
  assert.equal(overview.normalizeExpanded('0'),false);
  assert.equal(overview.normalizeExpanded(null),false);
});

test('summarizes task group connectivity and attention count',()=>{
  const groups=[
    {bound:true,frame:true,json:true,linked:true,done:true,failed:false},
    {bound:true,frame:true,json:false,linked:true,done:false,failed:false},
    {bound:false,frame:false,json:false,linked:false,done:false,failed:true}
  ];
  const stats=overview.summarizeGroups(groups,{
    isBound:g=>g.bound,hasFrame:g=>g.frame,hasJson:g=>g.json,isLinked:g=>g.linked,isDone:g=>g.done,isFailed:g=>g.failed
  });
  assert.deepEqual(stats,{all:3,bound:2,frame:2,json:1,linked:2,done:1,needsAttention:2});
});

test('wireframe page renders one combined native details disclosure',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/features/wireframe/wireframe-library.js'),'utf8');
  assert.match(source,/data-wf-workflow-overview/);
  assert.match(source,/生成规则与任务组状态/);
  assert.match(source,/任务组联通状态总览/);
  assert.doesNotMatch(source,/const logic=`<div class="notebox"/);
  assert.doesNotMatch(source,/renderWireLinkOverview/);
});
