const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.join(__dirname,'..');
const promptState=require('../src/core/region-prompt-state.js');
const promptBridge=require('../src/core/region-ai-prompt.js');

function read(relative){return fs.readFileSync(path.join(ROOT,relative),'utf8');}

test('V28.1.1 manual AI instruction remains separate while resized geometry keeps updating',()=>{
  const autoBefore='修改区域cloud_7（产品），该区域类型为产品区域。原始区域左上角坐标为X 58.8%、Y 13.6%。目标区域左上角坐标为X 62.8%、Y 40.0%，宽度32.1%、高度37.8%。';
  const autoAfter='修改区域cloud_7（产品），该区域类型为产品区域。原始区域左上角坐标为X 58.8%、Y 13.6%。目标区域左上角坐标为X 60.0%、Y 38.0%，宽度28.0%、高度42.0%。';
  const edited=autoBefore+' 保持产品标签清晰，背景自然衔接。';
  const manual=promptState.extractManual(edited,autoBefore,autoBefore);
  assert.equal(manual,'保持产品标签清晰，背景自然衔接。');
  const resolved=promptState.compose(manual,autoAfter);
  assert.match(resolved,/保持产品标签清晰/);
  assert.match(resolved,/X 60\.0%/);
  assert.match(resolved,/宽度28\.0%/);
  assert.doesNotMatch(resolved,/宽度32\.1%/);
  assert.equal(resolved.match(/实时参数（自动更新）/g).length,1);
});

test('V28.1.1 prompt parser accepts an auto marker at the beginning of the textarea',()=>{
  const value=promptState.compose('','修改区域cloud_1，原始区域左上角坐标为X 1%，目标保持不变。');
  const split=promptBridge.splitPrompt(value);
  assert.equal(split.manual,'');
  assert.match(split.auto,/修改区域cloud_1/);
});

test('V28.1.1 text edit state preserves original text and emits a linked replacement instruction',()=>{
  const region={id:'text_1',type:'text',recognizedText:'植物纤维 只排不吐',label:'植物纤维 只排不吐'};
  const result=promptState.applyTextEdit(region,'植物纤维 呵护肠胃');
  assert.equal(result.changed,true);
  assert.equal(region.__v277OriginalText,'植物纤维 只排不吐');
  assert.equal(region.recognizedText,'植物纤维 呵护肠胃');
  assert.match(promptState.textEditInstruction(region),/原文“植物纤维 只排不吐”准确替换为“植物纤维 呵护肠胃”/);
  promptState.applyTextEdit(region,'');
  assert.match(promptState.textEditInstruction(region),/删除该文字区域中的原文/);
});

test('V28.1.1 workbench keeps per-region drafts, keyboard save and AI prompt linkage',()=>{
  const src=read('src/features/region-workbench/region-workbench.js');
  for(const token of ['regionTextDrafts:{}','Object.prototype.hasOwnProperty.call(drafts,r.id)','applyRegionTextChange','__V277_SYNC_REGION_PROMPT__','textEditInstruction(r)','Ctrl+Enter 保存','data-v163-region-text-cancel="${attr(r.id)}"'])assert.ok(src.includes(token),token);
  assert.match(src,/\(e\.ctrlKey\|\|e\.metaKey\)&&e\.key==='Enter'/);
  assert.match(src,/必须将该文字区域原文/);
});

test('V28.1.1 regression and download dialogs are promoted above the fullscreen workbench',()=>{
  const src=read('src/features/region-workbench/region-workbench.js');
  const css=read('styles/features/region-workbench.css');
  assert.match(src,/openRegionWorkbenchModal/);
  assert.match(src,/openImageDownloadDialog\(src,name,'下载智能区域微调结果'\)/);
  assert.match(src,/promoteRegionWorkbenchModal\(\);requestAnimationFrame\(promoteRegionWorkbenchModal\)/);
  assert.match(src,/__V277_OPEN_REGRESSION_DETAILS__/);
  assert.match(src,/__V277_DOWNLOAD_MICRO_OUTPUT__/);
  const overlay=Number(css.match(/\.v15-ocr-overlay\{[^}]*z-index:(\d+)/)?.[1]);
  const modal=Number(css.match(/#modal\.v277-region-modal\{[^}]*z-index:(\d+)/)?.[1]);
  assert.ok(overlay>0&&modal>overlay,{overlay,modal});
});

test('V29 prompt state loads before region workbench and remote output downloads use local proxy',()=>{
  const html=read('index.html');
  assert.ok(html.indexOf('src/core/region-prompt-state.js?v=29.0.0')<html.indexOf('src/features/region-workbench/region-workbench.js?v=29.0.0'));
  const exporter=require('../src/core/image-export.js');
  const oldLocation=global.location;
  global.location={href:'http://127.0.0.1:18081/workbench/',origin:'http://127.0.0.1:18081'};
  try{assert.equal(exporter.browserFetchUrl('https://cdn.example/result.png'),'/api/image-export/source?url=https%3A%2F%2Fcdn.example%2Fresult.png');}
  finally{global.location=oldLocation;}
});
