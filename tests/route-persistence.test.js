const test=require('node:test');
const assert=require('node:assert/strict');
const routes=require('../src/core/route-persistence.js');

function storage(initial={}){
  const map=new Map(Object.entries(initial));
  return {getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i]??null,get length(){return map.size;},_map:map};
}
function env({type='navigate',path='/',store=storage()}={}){
  return {sessionStorage:store,location:{pathname:path},performance:{getEntriesByType:n=>n==='navigation'?[{type}]:[]}};
}

test('global route whitelist contains every renderable top-level page',()=>{
  assert.deepEqual([...routes.VALID_ROUTES],['home','copy','integrate','image','adjust','users','audit']);
  for(const route of routes.VALID_ROUTES)assert.equal(routes.normalize(route),route);
});

test('every legal remembered route is restored on reload',()=>{
  for(const route of routes.VALID_ROUTES){
    const store=storage();
    assert.equal(routes.remember(route,{sessionStorage:store}),true);
    const boot=routes.boot(env({type:'reload',store,path:'/'}));
    assert.equal(boot.route,route);
    assert.equal(boot.source,'lastRoute');
    assert.equal(boot.isReload,true);
  }
});

test('illegal stale lastRoute is removed at startup and falls back safely',()=>{
  const store=storage({[routes.STORAGE_KEY]:'old-v999-deleted-page'});
  const boot=routes.boot(env({type:'reload',store,path:'/'}));
  assert.equal(boot.route,'home');
  assert.equal(store.getItem(routes.STORAGE_KEY),null);
});

test('legacy copy-owned session route migrates into the global route key only when legal',()=>{
  const legacy=routes.LEGACY_KEYS[0],store=storage({[legacy]:'image'});
  const boot=routes.boot(env({type:'reload',store,path:'/'}));
  assert.equal(boot.route,'image');
  assert.equal(store.getItem(routes.STORAGE_KEY),'image');
  assert.equal(store.getItem(legacy),null);
});

test('normal navigation does not resurrect an old lastRoute on the root URL',()=>{
  const store=storage({[routes.STORAGE_KEY]:'copy'});
  const boot=routes.boot(env({type:'navigate',store,path:'/'}));
  assert.equal(boot.route,'home');
  assert.equal(boot.source,'default');
});

test('legal deep-link paths are whitelisted while unknown paths cannot become routes',()=>{
  assert.equal(routes.routeFromPath('/copy'),'copy');
  assert.equal(routes.routeFromPath('/wireframe'),'integrate');
  assert.equal(routes.routeFromPath('/region/details'),'adjust');
  assert.equal(routes.routeFromPath('/region/not-a-real-panel'),'');
  assert.equal(routes.routeFromPath('/removed-old-page'),'');
});

test('remember rejects illegal routes instead of poisoning session storage',()=>{
  const store=storage();
  assert.equal(routes.remember('not-real',{sessionStorage:store}),false);
  assert.equal(store.getItem(routes.STORAGE_KEY),null);
});

test('region route bootstrap cannot overwrite a recovered global reload route with stale pathname state',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../src/features/region-workbench/region-route.js'),'utf8');
  assert.match(source,/persistedReloadRoute=isReload&&window\.AppRoutePersistence\?window\.AppRoutePersistence\.readLastRoute\(\):''/);
  assert.match(source,/initial=persistedReloadRoute\|\|requestedView\(\)/);
});
