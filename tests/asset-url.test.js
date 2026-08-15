'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const asset=require('../src/core/asset-url.js');

test('normalizes relative built-in wireframe paths to root absolute URLs',()=>{
  assert.equal(asset.normalizeBuiltinAssetUrl('assets/wolassen/02.jpg','25.6.0'),'/assets/wolassen/02.jpg?v=25.6.0');
  assert.equal(asset.normalizeBuiltinAssetUrl('./assets/lebao/10.jpg','25.6.0'),'/assets/lebao/10.jpg?v=25.6.0');
});

test('repairs stale file and nested-route paths',()=>{
  assert.equal(asset.normalizeBuiltinAssetUrl('file:///D:/demo/assets/lebao/02.jpg','25.6.0'),'/assets/lebao/02.jpg?v=25.6.0');
  assert.equal(asset.normalizeBuiltinAssetUrl('/wireframe/assets/wolassen/09.jpg','25.6.0'),'/assets/wolassen/09.jpg?v=25.6.0');
});

test('keeps uploaded data URLs and remote URLs unchanged',()=>{
  assert.equal(asset.normalizeBuiltinAssetUrl('data:image/png;base64,AAAA','25.6.0'),'data:image/png;base64,AAAA');
  assert.equal(asset.normalizeBuiltinAssetUrl('https://example.com/a.jpg','25.6.0'),'https://example.com/a.jpg');
});

test('adds retry token without damaging existing cache query',()=>{
  assert.match(asset.appendRetryToken('/assets/lebao/02.jpg?v=25.6.0','second'),/[?&]retry=second$/);
});
