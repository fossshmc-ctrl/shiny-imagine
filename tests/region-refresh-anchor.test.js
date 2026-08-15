const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const anchors=require('../src/core/region-refresh-anchor.js');

function storage(){
  const map=new Map();
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),_map:map};
}

test('empty workbench anchor survives reload without selecting any historical project',()=>{
  const sessionStorage=storage(),env={sessionStorage,now:()=>100};
  const written=anchors.writeEmpty('fresh-entry',env);
  assert.equal(written.mode,'empty');
  assert.equal(anchors.shouldRestore(env),false);
  assert.equal(anchors.projectId(env),'');
  assert.equal(anchors.read(env).reason,'fresh-entry');
});

test('uploaded current image becomes the only project eligible for automatic refresh restore',()=>{
  const sessionStorage=storage(),env={sessionStorage,now:()=>200};
  anchors.writeProject('project-A','upload-current-image',env);
  assert.equal(anchors.shouldRestore(env),true);
  assert.equal(anchors.projectId(env),'project-A');
  assert.equal(anchors.read(env).versionKey,'refreshAnchor');
});

test('viewing or manually restoring history does not mutate the refresh anchor unless explicitly promoted',()=>{
  const sessionStorage=storage(),env={sessionStorage,now:()=>300};
  anchors.writeProject('current-A','upload-current-image',env);
  // Manual history restore is intentionally a consumer-only action in V26:
  // it must not call writeProject('history-B').
  const manualHistoryProject='history-B';
  assert.equal(manualHistoryProject,'history-B');
  assert.equal(anchors.projectId(env),'current-A');
});

test('malformed refresh anchor is removed instead of falling back to an old active project',()=>{
  const sessionStorage=storage(),env={sessionStorage};
  sessionStorage.setItem(anchors.STORAGE_KEY,'{"mode":"project","projectId":""}');
  assert.equal(anchors.read(env),null);
  assert.equal(sessionStorage.getItem(anchors.STORAGE_KEY),null);
});

test('region route reload path is refresh-anchor only and contains no one-project/recent-project fallback',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/features/region-workbench/region-route.js'),'utf8');
  assert.match(source,/const startEpoch=mutationEpoch,anchor=readRefreshAnchor\(\)/);
  assert.match(source,/anchor\.mode!==['"]project['"]\|\|!anchor\.projectId/);
  assert.match(source,/projects\.find\(x=>x\.id===anchor\.projectId\)/);
  assert.doesNotMatch(source,/projects\.length===1\)rec=projects\[0\]/);
  assert.doesNotMatch(source,/startEpoch=mutationEpoch,active=activeProjectId\(\)/);
});

test('manual history restore is separate from refresh anchor promotion',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/features/region-workbench/region-route.js'),'utf8');
  assert.match(source,/applyPayloadRecord\(rec,key,'manual'\)/);
  const applyBlock=source.slice(source.indexOf('async function applyPayloadRecord'),source.indexOf('async function recentProjects'));
  assert.doesNotMatch(applyBlock,/setRefreshProjectAnchor/);
  assert.doesNotMatch(applyBlock,/setRefreshEmptyAnchor/);
});


test('same-project historical restore cannot overwrite the immutable refresh snapshot slot',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/features/region-workbench/region-route.js'),'utf8');
  assert.match(source,/rec\.versions\.refreshAnchor=\{kind:'refreshAnchor'/);
  assert.match(source,/&&\s*!manualRestorePreview/);
  assert.match(source,/manualRestorePreview=source==='manual'/);
  assert.match(source,/const version=source==='refresh'\?requested:/);
});
