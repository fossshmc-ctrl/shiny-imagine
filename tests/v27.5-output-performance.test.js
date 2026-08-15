'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const workbench=fs.readFileSync(path.join(root,'src/features/region-workbench/region-workbench.js'),'utf8');
const css=fs.readFileSync(path.join(root,'styles/features/region-workbench.css'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const launcher=fs.readFileSync(path.join(root,'start.bat'),'utf8');
const enhancement=fs.readFileSync(path.join(root,'src/features/adjust/image-adjust-enhancement-layer.js'),'utf8');

function rule(selector){
  const escaped=selector.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=css.match(new RegExp(escaped+'\\{([^}]*)\\}'));
  return match?match[1]:'';
}

test('V28.1.1 result information and performance UI stay below generated pixels',()=>{
  assert.match(workbench,/class="v225-output-caption" aria-label="智能区域微调结果信息与操作"/);
  const caption=rule('#v15-ocr-overlay .v225-output-caption');
  assert.ok(caption,'result caption CSS rule must exist');
  assert.match(caption,/position:static/);
  assert.doesNotMatch(caption,/position:absolute/);
  assert.match(rule('#v15-ocr-overlay .v225-output-shell'),/flex-direction:column/);
  assert.match(workbench,/<div class="v20-generate-stage v225-output-stage">\$\{body\}<\/div>\$\{v274PerformanceHtml\(performance\)\}/);
  assert.match(css,/\.v274-performance-panel\{[^}]*margin:8px 12px 10px/);
});

test('V28.1.1 bottom result bar keeps explicit confirmed image download',()=>{
  assert.match(workbench,/data-v232-download-output/);
  assert.match(workbench,/↓ 下载图片/);
  assert.match(workbench,/function downloadMicroAdjustOutput\(\)/);
  assert.match(workbench,/openImageDownloadDialog\(src,name,'下载智能区域微调结果'\)/);
  assert.match(workbench,/exporter\.requestDownloadTarget\(\[\{src,name\}\],'png'\)/);
});

test('V28.1.1 performance panel renders nine phases and pending to completed lifecycle',()=>{
  for(const token of ['preflightMs','syncMs','compressMs','uploadMs','submitMs','providerQueueMs','generationMs','resultMs','postCheckMs'])assert.ok(workbench.includes(token),token);
  assert.match(workbench,/\['pending','processing','completed'\]/);
  assert.match(workbench,/服务端未返回该中间状态，由客户端按时间线推断/);
  assert.match(workbench,/当前最大耗时是 EvoLink 上游排队/);
  assert.match(workbench,/当前最大耗时是双参考图上传/);
});


test('V28.1.1 click boundary is visible during preflight and result timing waits for decodable pixels',()=>{
  const fnStart=workbench.indexOf('async function performGeneration(options={})');
  const fnEnd=workbench.indexOf('function beginCheck(mode)',fnStart);
  const source=workbench.slice(fnStart,fnEnd);
  assert.ok(source.indexOf('const expected=selectedRows(s).length')<source.indexOf("meter?.begin?.({source:'region-workbench-click'"),'selection must be validated before network-timed generation starts');
  assert.ok(source.indexOf('__V225_BEGIN_MICRO_ADJUST_GENERATION__')<source.indexOf("meter?.startPhase?.('preflight')"),'right pane must enter generating state before preflight');
  assert.doesNotMatch(source,/\brun\.click\s*\(/);
  assert.match(source,/window\.__V276_START_MICRO_ADJUST__/);
  assert.match(workbench,/\['syncMs','流程交接'\]/);
  assert.match(enhancement,/function adjustWaitResultDisplayReady\(src,timeoutMs=30000\)/);
  assert.match(enhancement,/await adjustWaitResultDisplayReady\(results\[0\],30000\)/);
  assert.match(enhancement,/resultMs\/clickToImageMs represent visible pixels rather than JSON arrival/);
});

test('V29 cache-busting, title and Windows build metadata are consistent',()=>{
  assert.match(html,/<title>V29.1 · 图灵线框工作台<\/title>/);
  assert.match(html,/micro-performance-meter\.js\?v=29\.1\.0/);
  assert.match(html,/region-workbench\.js\?v=29\.1\.0/);
  assert.doesNotMatch(html,/\?v=27\.3\.2/);
  assert.match(launcher,/EXPECTED_VERSION=V29.1/);
  assert.match(launcher,/EXPECTED_BUILD=v29.1-wireframe-vercel-preview-fix-20260815/);
  assert.match(launcher,/\?v=29\.1\.0/);
});
