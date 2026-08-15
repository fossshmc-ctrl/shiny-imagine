'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const exp=require('../src/core/image-export.js');

test('normalizes requested image export formats including the common jrpg typo',()=>{
  assert.equal(exp.normalizeFormat('jpg'),'jpg');
  assert.equal(exp.normalizeFormat('.JPEG'),'jpeg');
  assert.equal(exp.normalizeFormat('jrpg'),'jpeg');
  assert.equal(exp.normalizeFormat('png'),'png');
  assert.equal(exp.normalizeFormat('pdf'),'pdf');
});

test('builds safe output filenames for all supported formats',()=>{
  assert.equal(exp.fileName('AI 线框图.png','jpg'),'AI 线框图.jpg');
  assert.equal(exp.fileName('a:b?.webp','jpeg'),'a-b-.jpeg');
  assert.equal(exp.fileName('poster','png'),'poster.png');
  assert.equal(exp.fileName('poster','pdf'),'poster.pdf');
});

test('remote images use the same-origin export proxy while local/data sources stay direct',()=>{
  assert.equal(exp.browserFetchUrl('/api/wireframe-history/assets/a.jpg'),'/api/wireframe-history/assets/a.jpg');
  assert.equal(exp.browserFetchUrl('data:image/png;base64,AAAA'),'data:image/png;base64,AAAA');
  assert.match(exp.browserFetchUrl('https://cdn.example.com/a.png'),/^\/api\/image-export\/source\?url=/);
});

test('creates a structurally valid single-page PDF around JPEG bytes',()=>{
  const jpeg=new Uint8Array([0xff,0xd8,0xff,0xd9]);
  const pdf=exp.jpegBytesToPdf(jpeg,1200,800);
  const text=Buffer.from(pdf).toString('latin1');
  assert.match(text,/^%PDF-1\.4/);
  assert.match(text,/\/Subtype \/Image/);
  assert.match(text,/\/Filter \/DCTDecode/);
  assert.match(text,/xref/);
  assert.match(text,/%%EOF/);
});

test('browser conversion pipeline emits PNG, JPEG and PDF blobs with native dimensions',async()=>{
  const oldFetch=global.fetch,oldImage=global.Image,oldDocument=global.document;
  global.fetch=async()=>({ok:true,status:200,blob:async()=>new Blob([new Uint8Array([1,2,3])],{type:'image/png'})});
  global.Image=class FakeImage{constructor(){this.naturalWidth=640;this.naturalHeight=360;this.width=640;this.height=360;}set src(_v){queueMicrotask(()=>this.onload&&this.onload());}};
  global.document={createElement(tag){
    if(tag!=='canvas')throw new Error('unexpected element');
    return {width:0,height:0,getContext(){return {fillStyle:'#fff',fillRect(){},drawImage(){}};},toBlob(cb,type){const bytes=type==='image/jpeg'?new Uint8Array([0xff,0xd8,0xff,0xd9]):new Uint8Array([137,80,78,71,13,10,26,10]);cb(new Blob([bytes],{type}));}};
  }};
  try{
    const png=await exp.buildExportBlob('/asset.png','png');assert.equal(png.blob.type,'image/png');assert.equal(png.width,640);assert.equal(png.height,360);
    const jpg=await exp.buildExportBlob('/asset.png','jpg');assert.equal(jpg.blob.type,'image/jpeg');
    const pdf=await exp.buildExportBlob('/asset.png','pdf');assert.equal(pdf.blob.type,'application/pdf');assert.ok(pdf.blob.size>100);
  }finally{global.fetch=oldFetch;global.Image=oldImage;global.document=oldDocument;}
});

test('V26.2.3 download target falls back safely when File System Access API is unavailable',()=>{
  const target=exp.requestDownloadTarget([{src:'/asset.png',name:'wireframe'}],'jpg');
  assert.equal(target.mode,'legacy');
  assert.equal(target.format,'jpg');
});

test('V26.2.3 opens Edge/Chromium Save File Picker synchronously from the format click path',()=>{
  const modulePath=require.resolve('../src/core/image-export.js');
  const oldWindow=global.window;let called=0;
  global.window={isSecureContext:true,showSaveFilePicker(options){called++;assert.equal(options.suggestedName,'wireframe.jpg');return Promise.resolve({});}};
  delete require.cache[modulePath];
  try{
    const browserExp=require(modulePath);
    const target=browserExp.requestDownloadTarget([{src:'/asset.png',name:'wireframe'}],'jpg');
    assert.equal(called,1);
    assert.equal(target.mode,'file-picker');
  }finally{
    delete require.cache[modulePath];
    if(oldWindow===undefined)delete global.window;else global.window=oldWindow;
  }
});
