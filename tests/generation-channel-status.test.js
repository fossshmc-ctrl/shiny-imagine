const test=require('node:test');
const assert=require('node:assert/strict');
const status=require('../src/core/generation-channel-status');

test('copy channel only becomes normal from the isolated Coze configured field',()=>{
  assert.equal(status.describe('copy',{configured:true,tokenLoaded:true}).label,'扣子通道正常');
  assert.equal(status.describe('copy',{configured:false,tokenLoaded:true}).label,'扣子通道待配置');
  assert.equal(status.describe('copy',{configured:true,loading:true}).label,'扣子通道检查中');
});

test('shared image channel ignores copy fields and requires only shared credentials',()=>{
  assert.equal(status.describe('integrate',{baseUrl:'https://api.example/v1',apiKey:'sk-test',copyConfigured:false}).label,'共享图像通道正常');
  assert.equal(status.describe('image',{baseUrl:'https://api.example/v1',apiKey:'',copyConfigured:true}).label,'共享图像通道待配置');
});

test('page labels are deliberately concise and channel scoped',()=>{
  assert.deepEqual(
    [status.describe('copy',{configured:true}).label,status.describe('integrate',{baseUrl:'x',apiKey:'y'}).label,status.describe('image',{baseUrl:'',apiKey:''}).label],
    ['扣子通道正常','共享图像通道正常','共享图像通道待配置']
  );
});
