const test=require('node:test');
const assert=require('node:assert/strict');
const isolation=require('../src/core/channel-isolation.js');

test('copy view is assigned exclusively to the Coze copy channel',()=>{
  assert.equal(isolation.channelForView('copy'),isolation.CHANNELS.COPY_COZE);
  const d=isolation.channelDescriptor('copy');
  assert.equal(d.provider,'coze');
  assert.equal(d.credential,'manual-token');
  assert.equal(d.shared,false);
});

test('copy view never bootstraps or reports failures from the shared model channel',()=>{
  const configured={baseUrl:'https://example.test/v1',apiKey:'secret',models:[]};
  assert.equal(isolation.shouldBootstrapSharedModels('copy',configured),false);
  assert.equal(isolation.mayReportSharedModelFailure('copy'),false);
});

test('wireframe and image views may lazily bootstrap configured shared models',()=>{
  const configured={baseUrl:'https://example.test/v1',apiKey:'secret',models:[]};
  assert.equal(isolation.shouldBootstrapSharedModels('integrate',configured),true);
  assert.equal(isolation.shouldBootstrapSharedModels('image',configured),true);
  assert.equal(isolation.mayReportSharedModelFailure('integrate'),true);
  assert.equal(isolation.mayReportSharedModelFailure('image'),true);
});

test('shared bootstrap is skipped when credentials are missing or models are already cached',()=>{
  assert.equal(isolation.shouldBootstrapSharedModels('integrate',{baseUrl:'',apiKey:'',models:[]}),false);
  assert.equal(isolation.shouldBootstrapSharedModels('image',{baseUrl:'https://x',apiKey:'k',models:['image-model']}),false);
});

test('adjust and non-generation pages remain outside the shared image channel',()=>{
  assert.equal(isolation.channelForView('adjust'),isolation.CHANNELS.MICRO_ADJUST);
  assert.equal(isolation.channelForView('home'),isolation.CHANNELS.NONE);
  assert.equal(isolation.channelForView('users'),isolation.CHANNELS.NONE);
});
