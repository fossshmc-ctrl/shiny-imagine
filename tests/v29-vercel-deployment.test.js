'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');

test('V29 Vercel contract has an explicit build and API rewrite',()=>{
  const config=JSON.parse(read('vercel.json'));
  assert.equal(config.framework,null);
  assert.equal(config.buildCommand,'node scripts/build-vercel.js');
  assert.equal(config.outputDirectory,'dist');
  assert.ok(config.rewrites.some(item=>item.source==='/api/:path*'&&item.destination.startsWith('/api/index')));
});

test('V29 API entry preserves rewritten paths and query strings',()=>{
  const entry=require('../api/index');
  assert.equal(entry.normalizedApiUrl({url:'/api/index?path=micro%2Fhealth&deep=1',query:{}}),'/api/micro/health?deep=1');
  assert.equal(entry.normalizedApiUrl({url:'/api/health?ready=1',query:{}}),'/api/health?ready=1');
});

test('V29 public build is complete and excludes private server files',()=>{
  const build=spawnSync(process.execPath,['scripts/build-vercel.js'],{cwd:root,encoding:'utf8'});
  assert.equal(build.status,0,build.stderr||build.stdout);
  for(const name of ['index.html','styles/base/layout.css','src/core/deployment-runtime.js','assets/wolassen/02.jpg','version.json']){
    assert.equal(fs.existsSync(path.join(root,'dist',name)),true,name+' should be published');
  }
  for(const name of ['config.json','copy-coze.private.json','server.js','server.py','data','tests']){
    assert.equal(fs.existsSync(path.join(root,'dist',name)),false,name+' must stay private');
  }
});

test('V29 keeps a critical CSS fallback for recognizable failed deployments',()=>{
  const html=read('index.html');
  assert.match(html,/id="v29-critical-fallback"/);
  assert.match(html,/\.ui-icon\{width:1em;height:1em;max-width:64px;max-height:64px/);
  assert.match(html,/src\/core\/deployment-runtime\.js\?v=29\.0\.0/);
});
