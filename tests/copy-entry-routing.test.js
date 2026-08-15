const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const router=fs.readFileSync(path.join(__dirname,'../src/app/router-events.js'),'utf8');
const lifecycle=fs.readFileSync(path.join(__dirname,'../src/app/page-state-lifecycle.js'),'utf8');
const workbench=fs.readFileSync(path.join(__dirname,'../src/features/copy/copy-workbench.js'),'utf8');

test('every render normalizes and records the global lastRoute',()=>{
  assert.match(router,/AppRoutePersistence&&window\.AppRoutePersistence\.normalize\(k\)/);
  assert.match(router,/AppRoutePersistence&&window\.AppRoutePersistence\.remember\(route\)/);
  assert.match(router,/curView=route/);
});

test('boot restores a whitelisted global route before rendering instead of defaulting to home',()=>{
  assert.match(router,/APP_BOOT_ROUTE=window\.AppRoutePersistence\?window\.AppRoutePersistence\.boot\(\)/);
  assert.match(router,/AppPageStateLifecycle\.prepareBoot\(APP_BOOT_ROUTE\.route,APP_BOOT_ROUTE\)/);
  assert.match(router,/render\(APP_BOOT_ROUTE\.route\)/);
  assert.doesNotMatch(router,/render\(COPY_RELOAD_RESTORED\?'copy':'home'\)/);
});

test('user navigation into copy delegates fresh-state behavior to page lifecycle',()=>{
  assert.match(router,/function navigateView\(k\)/);
  assert.match(router,/AppPageStateLifecycle\.beforeNavigation\(curView,target\)/);
  assert.match(router,/nav'\)\.addEventListener\('click',[\s\S]*navigateView\(a\.dataset\.k\)/);
  assert.match(router,/\.inner\[data-k\][\s\S]*navigateView\(navc\.dataset\.k\)/);
  assert.match(lifecycle,/target==='copy'&&source!=='copy'/);
  assert.match(lifecycle,/copySnapshotBeginFreshEntry/);
});

test('blank copy state exposes history only as a manual restore archive',()=>{
  assert.match(workbench,/copySnapshotArchiveHtml/);
  assert.match(workbench,/开始生成文案/);
});
