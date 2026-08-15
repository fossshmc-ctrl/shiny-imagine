'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const workbench=read('src/features/region-workbench/region-workbench.js');
const css=read('styles/features/region-workbench.css');
const index=read('index.html');
const pkg=JSON.parse(read('package.json'));
const config=JSON.parse(read('config.json'));
const start=read('start.bat');

test('V28.1.1 performance panel is collapsed by default and exposes one horizontal toggle',()=>{
  assert.match(workbench,/function v274PerformancePanelCollapsed\(\)/);
  assert.ok(workbench.includes("if(raw===null||raw==='')return true"));
  assert.match(workbench,/data-v274-performance-toggle/);
  assert.match(workbench,/aria-expanded="\$\{collapsed\?'false':'true'\}"/);
  assert.match(workbench,/v274-performance-details/);
  assert.match(workbench,/\$\{collapsed\?'false':'true'\}/);
});

test('V28.1.1 performance panel preserves all nine telemetry phases inside the expandable details',()=>{
  for(const token of ['preflightMs','syncMs','compressMs','uploadMs','submitMs','providerQueueMs','generationMs','resultMs','postCheckMs'])assert.ok(workbench.includes(token),token);
  assert.match(workbench,/class="v274-performance-details"/);
  assert.match(workbench,/EvoLink task/);
  assert.match(workbench,/轮询恢复/);
});

test('V28.1.1 toggle persists state and updates aria/hidden state without rebuilding the generate pane',()=>{
  assert.match(workbench,/v28_micro_performance_panel_collapsed/);
  assert.match(workbench,/setV274PerformancePanelCollapsed\(!collapsed\)/);
  assert.match(workbench,/panel\.classList\.toggle\('is-collapsed',nextCollapsed\)/);
  assert.match(workbench,/panel\.classList\.toggle\('is-expanded',!nextCollapsed\)/);
  assert.match(workbench,/details\.hidden=nextCollapsed/);
  assert.match(workbench,/performanceToggle\.setAttribute\('aria-expanded',String\(!nextCollapsed\)\)/);
});

test('V28.1.1 compact performance bar uses the full available width and does not consume metric height when collapsed',()=>{
  assert.match(css,/\.v274-performance-panel\{[^}]*padding:0[^}]*overflow:hidden/);
  assert.match(css,/\.v274-performance-toggle\{width:100%/);
  assert.match(css,/\.v274-performance-details\[hidden\]\{display:none!important\}/);
  assert.match(css,/\.v274-performance-toggle-arrow/);
});

test('V29 release metadata is consistent',()=>{
  assert.equal(pkg.version,'29.0.0');
  assert.equal(config.version,'V29');
  assert.match(config.buildId,/v29-github-vercel-dual-runtime-20260815/);
  assert.match(start,/EXPECTED_VERSION=V29/);
  assert.match(start,/EXPECTED_BUILD=v29-github-vercel-dual-runtime-20260815/);
  assert.match(index,/\?v=29\.0\.0/);
});
