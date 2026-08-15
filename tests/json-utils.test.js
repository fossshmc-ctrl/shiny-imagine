'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const json=require('../src/core/json-utils.js');

test('stableString ignores object key order',()=>{
  assert.equal(json.stableString({b:2,a:{d:4,c:3}}),json.stableString({a:{c:3,d:4},b:2}));
});

test('fnv1a is stable for equivalent JSON values',()=>{
  assert.equal(json.fnv1a({b:2,a:1}),json.fnv1a({a:1,b:2}));
});

test('parseText returns null for malformed or empty content',()=>{
  assert.equal(json.parseText(''),null);
  assert.equal(json.parseText('{bad'),null);
  assert.deepEqual(json.parseText('{"ok":true}'),{ok:true});
});
