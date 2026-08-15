'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const store=require('../src/core/wireframe-library-state.js');

const source=[{id:'a',name:'常规',imgs:[{id:'2',time:20},{id:'1',time:10}]},{id:'b',name:'维邦乐',imgs:[]}];

test('category operations are immutable',()=>{
  const renamed=store.renameCategory(source,'a','新名称');
  assert.equal(renamed[0].name,'新名称');
  assert.equal(source[0].name,'常规');
});

test('deleteCategory preserves a valid active category',()=>{
  const out=store.deleteCategory(source,'a','a');
  assert.equal(out.deleted,true);
  assert.equal(out.activeCategoryId,'b');
  assert.deepEqual(out.library.map(x=>x.id),['b']);
});

test('deleteCategory prevents deleting the final category',()=>{
  const out=store.deleteCategory([{id:'a',name:'A',imgs:[]}],'a','a');
  assert.equal(out.deleted,false);
  assert.equal(out.reason,'minimum_one');
});

test('sortImagesByTime returns chronological image order',()=>{
  const out=store.sortImagesByTime(source,'a');
  assert.deepEqual(out[0].imgs.map(x=>x.id),['1','2']);
  assert.deepEqual(source[0].imgs.map(x=>x.id),['2','1']);
});
