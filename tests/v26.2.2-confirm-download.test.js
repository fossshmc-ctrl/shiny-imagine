'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const imageUi=fs.readFileSync(path.join(root,'src/features/image/image-generation.js'),'utf8');
const router=fs.readFileSync(path.join(root,'src/app/router-events.js'),'utf8');
const exp=require('../src/core/image-export.js');

test('V26.2.3 download dialog contains an explicit confirm-download step',()=>{
  assert.match(imageUi,/确认下载/);
  assert.match(imageUi,/id="image-export-confirm-area"/);
  assert.match(imageUi,/data-image-export-confirm/);
  assert.match(imageUi,/prepareImageExportFormat/);
});

test('V26.2.3 modal format buttons are handled on document, not only #main',()=>{
  const docAt=router.indexOf("document.addEventListener('click'");
  const modalFormatAt=router.indexOf("#modal [data-image-export-format]");
  const modalConfirmAt=router.indexOf("#modal [data-image-export-confirm]");
  assert.ok(docAt>=0);
  assert.ok(modalFormatAt>docAt);
  assert.ok(modalConfirmAt>docAt);
});

test('prepared download artifact exposes a direct blob URL and final filename',async()=>{
  const oldFetch=global.fetch,oldImage=global.Image,oldDocument=global.document,oldURL=global.URL;
  let revoked='';
  global.fetch=async()=>({ok:true,status:200,blob:async()=>new Blob([new Uint8Array([1,2,3])],{type:'image/png'})});
  global.Image=class FakeImage{constructor(){this.naturalWidth=320;this.naturalHeight=240;this.width=320;this.height=240;}set src(_v){queueMicrotask(()=>this.onload&&this.onload());}};
  global.document={createElement(tag){
    assert.equal(tag,'canvas');
    return {width:0,height:0,getContext(){return {fillStyle:'#fff',fillRect(){},drawImage(){}};},toBlob(cb,type){const bytes=type==='image/jpeg'?new Uint8Array([0xff,0xd8,0xff,0xd9]):new Uint8Array([137,80,78,71,13,10,26,10]);cb(new Blob([bytes],{type}));}};
  }};
  global.URL={createObjectURL(){return 'blob:v2622-ready';},revokeObjectURL(v){revoked=v;}};
  try{
    const artifact=await exp.prepareDownloadArtifact('/asset.png','wireframe.png','jpg');
    assert.equal(artifact.objectUrl,'blob:v2622-ready');
    assert.equal(artifact.fileName,'wireframe.jpg');
    assert.equal(artifact.blob.type,'image/jpeg');
    artifact.dispose();
    assert.equal(revoked,'blob:v2622-ready');
  }finally{global.fetch=oldFetch;global.Image=oldImage;global.document=oldDocument;global.URL=oldURL;}
});
