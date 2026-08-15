'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const AssetUrl=require('../src/core/asset-url.js');

function loadLibrary(stored){
  let saved='';let id=0;
  const storage={
    getItem:key=>key==='wfLib_v1'?JSON.stringify(stored):null,
    setItem:(key,value)=>{if(key==='wfLib_v1')saved=value;}
  };
  const context={AssetUrl,localStorage:storage,uid:()=>`id-${++id}`,toast:()=>{},Date,encodeURIComponent,console};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../src/features/wireframe/wireframe-library.js'),'utf8');
  vm.runInContext(source+'\n;globalThis.__wireframeTest={lib,activeCat,loadedLebVersion,loadedWlsVersion};',context);
  return {state:context.__wireframeTest,saved:JSON.parse(saved)};
}

test('migrates stale relative and nested built-in paths to V26 root URLs',()=>{
  const stored={
    lib:[
      {id:'w',name:'沃朗森',imgs:[{id:'old-w',name:'沃朗森-图2',src:'wireframe/assets/wolassen/02.jpg',time:1}]},
      {id:'l',name:'勒宝',imgs:[{id:'old-l',name:'勒宝-图2',src:'assets/lebao/02.jpg',time:1}]}
    ],
    activeCat:'w',lebVersion:'old',wlsVersion:'old'
  };
  const out=loadLibrary(stored);
  for(const name of ['沃朗森','勒宝']){
    const category=out.state.lib.find(item=>item.name===name);
    assert.ok(category);
    assert.equal(category.imgs.length,9);
    assert.ok(category.imgs.every(item=>item.src.startsWith('/assets/')));
    assert.ok(category.imgs.every(item=>item.src.includes('v=27.3.0')));
    assert.ok(category.imgs.every(item=>item.builtin===true));
  }
  assert.equal(out.state.activeCat,'w');
  assert.equal(out.saved.lebVersion,'v25.5-lebao-nine-assets-20260807');
  assert.equal(out.saved.wlsVersion,'v25.5-wolassen-nine-assets-20260807');
});
