'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(ROOT,relative),'utf8');
const workbench=read('src/features/region-workbench/region-workbench.js');
const regionCss=read('styles/features/region-workbench.css');
const imageUi=read('src/features/image/image-generation.js');
const router=read('src/app/router-events.js');
const layoutCss=read('styles/base/layout.css');
const html=read('index.html');

function sliceBetween(source,start,end){
  const from=source.indexOf(start),to=source.indexOf(end,from+start.length);
  assert.ok(from>=0,`missing start marker: ${start}`);
  assert.ok(to>from,`missing end marker: ${end}`);
  return source.slice(from,to);
}

test('V28.1.1 region copy textarea is excluded from region-card activation and remains a native editable control',()=>{
  assert.match(workbench,/input,textarea,select,option,button,a,label,\[contenteditable="true"\]/);
  assert.match(workbench,/data-v163-region-text-input/);
  assert.match(regionCss,/pointer-events:auto!important/);
  assert.match(regionCss,/user-select:text!important/);
  assert.match(regionCss,/min-height:108px/);
});

test('V28.1.1 preserves region copy draft, focus, caret and scroll across required workbench renders',()=>{
  for(const token of [
    'regionTextFocusedId',
    'regionTextRenderPending',
    'captureRegionTextEditorState',
    'restoreRegionTextEditorState',
    'selectionStart',
    'setSelectionRange',
    'scrollTop',
    'regionTextFocusIntent'
  ])assert.ok(workbench.includes(token),token);
  const render=sliceBetween(workbench,'function renderOcr(options={})','function openOcr(');
  assert.ok(render.indexOf('captureRegionTextEditorState')<render.indexOf('el.innerHTML='));
  assert.ok(render.indexOf('restoreRegionTextEditorState')>render.indexOf('el.innerHTML='));
});

test('V28.1.1 does not replace the textarea during Chinese or Japanese IME composition',()=>{
  for(const token of ['compositionstart','compositionend','regionTextComposing','renderOcr({force:true})'])assert.ok(workbench.includes(token),token);
  assert.match(workbench,/if\(s\.regionTextComposing&&options\.force!==true\)\{s\.regionTextRenderPending=true;return;\}/);
});

test('V28.1.1 removes the 90 ms Smart Editor polling loop and limits synchronization to relevant workbench mutations',()=>{
  assert.doesNotMatch(workbench,/setInterval\(\(\)=>\{install\(\);syncEditorDynamic\(false\);\},90\)/);
  for(const token of ['nativeRegionTextBusy','mutationTouchesWorkbench','MutationObserver(records=>{if(mutationTouchesWorkbench(records))schedule();})'])assert.ok(workbench.includes(token),token);
});

test('V28.1.1 image generation parameters are collapsed by default into one horizontal toggle',()=>{
  assert.match(imageUi,/parametersExpanded:false/);
  assert.match(imageUi,/data-img-parameter-toggle/);
  assert.match(imageUi,/image-parameter-accordion/);
  assert.match(imageUi,/const panel=img\.parametersExpanded\?/);
  assert.match(imageUi,/生成参数/);
  assert.match(imageUi,/\$\{img\.count\} 张 · \$\{img\.aspect\}/);
  assert.match(router,/img\.parametersExpanded=!img\.parametersExpanded;renderImageView\(\)/);
  assert.match(layoutCss,/\.image-parameter-toggle\{width:100%;min-height:58px;display:flex/);
  assert.match(layoutCss,/\.image-parameter-panel\{/);
});

test('V28.1.1 keeps the parameter panel open while changing count, quality, aspect or resolution',()=>{
  const countHandler=sliceBetween(router,"const cnt=e.target.closest('[data-imgcount]')","const delv=e.target.closest('[data-imgdelversion]')");
  assert.doesNotMatch(countHandler,/parametersExpanded=false/);
  assert.match(countHandler,/renderImageView\(\)/);
  assert.match(router,/if\(\(a\|\|r\)&&curView==='image'\)renderImageView\(\)/);
});

test('V29 release cache and current prompt aliases are loaded',()=>{
  assert.match(html,/<title>V29 · 图灵线框工作台<\/title>/);
  assert.doesNotMatch(html,/\?v=27\.8/);
  assert.match(read('src/core/region-prompt-state.js'),/RegionPromptStateV279=api/);
  assert.match(read('src/core/region-ai-prompt.js'),/RegionAiPromptV279=api/);
  assert.match(read('src/core/region-generation-regression.js'),/RegionGenerationRegressionV279=api/);
});
