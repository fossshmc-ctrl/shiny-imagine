'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const rules=require('../src/core/copy-rules.js');

test('extract parses structured product input',()=>{
  const out=rules.extract('品牌：华美科\n品类：医用洁面\n核心卖点：温和清洁、屏障友好\n促销：限时优惠');
  assert.equal(out.brand,'华美科');
  assert.equal(out.category,'医用洁面');
  assert.deepEqual(out.core,['温和清洁','屏障友好']);
  assert.equal(out.promotion,'限时优惠');
});

test('normalizeCopyBlock always exposes three subtitles and one selection',()=>{
  const out=rules.normalizeCopyBlock({mainTitle:'测试',benefits:'A · B'});
  assert.equal(out.subtitles.length,3);
  assert.deepEqual(out.selectedSubtitles,[0]);
});

test('generate returns eight independent copy strategies',()=>{
  const out=rules.generate('品牌：测试品牌\n品类：洁面产品\n核心卖点：温和、清洁');
  assert.equal(out.length,8);
  assert.deepEqual(out.map(x=>x.version),[1,2,3,4,5,6,7,8]);
  assert.equal(new Set(out.map(x=>x.style)).size,8);
});
