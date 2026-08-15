/* V26 global route persistence: remember only where the app is, never page business state. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.AppRoutePersistence=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='turing_app_last_route_current';
  const LEGACY_KEYS=['turing_copy_session_last_view_current'];
  const VALID_ROUTES=Object.freeze(['home','copy','integrate','image','adjust','users','audit']);
  const ROUTE_SET=new Set(VALID_ROUTES);
  const PATH_ROUTE=Object.freeze({
    '/':'home','/copy':'copy','/wireframe':'integrate','/image':'image','/region':'adjust',
    '/region/files':'adjust','/region/regions':'adjust','/region/canvas':'adjust','/region/adjust':'adjust',
    '/region/details':'adjust','/region/quality':'adjust','/users':'users','/audit':'audit'
  });
  function normalize(route){
    const value=String(route==null?'':route).trim();
    return ROUTE_SET.has(value)?value:'';
  }
  function normalizePath(pathname){
    let path=String(pathname||'/').split('?')[0].split('#')[0].replace(/\\/g,'/');
    if(!path.startsWith('/'))path='/'+path;
    path=path.replace(/\/{2,}/g,'/').replace(/\/$/,'')||'/';
    return path;
  }
  function routeFromPath(pathname){return PATH_ROUTE[normalizePath(pathname)]||'';}
  function safeStorage(env){
    try{return env&&env.sessionStorage?env.sessionStorage:(typeof sessionStorage!=='undefined'?sessionStorage:null);}catch(_e){return null;}
  }
  function safeRemove(storage,key){try{storage&&storage.removeItem(key);}catch(_e){}}
  function readRaw(storage,key){try{return String(storage&&storage.getItem(key)||'').trim();}catch(_e){return'';}}
  function readLastRoute(env){
    const storage=safeStorage(env);if(!storage)return'';
    let raw=readRaw(storage,STORAGE_KEY),source=STORAGE_KEY;
    if(!raw){
      for(const key of LEGACY_KEYS){const legacy=readRaw(storage,key);if(legacy){raw=legacy;source=key;break;}}
    }
    if(!raw)return'';
    const normalized=normalize(raw);
    if(!normalized){
      safeRemove(storage,source);
      if(source!==STORAGE_KEY)safeRemove(storage,STORAGE_KEY);
      return'';
    }
    if(source!==STORAGE_KEY){
      try{storage.setItem(STORAGE_KEY,normalized);}catch(_e){}
      safeRemove(storage,source);
    }
    return normalized;
  }
  function remember(route,env){
    const normalized=normalize(route);if(!normalized)return false;
    const storage=safeStorage(env);if(!storage)return false;
    try{storage.setItem(STORAGE_KEY,normalized);return true;}catch(_e){return false;}
  }
  function navigationType(env){
    try{
      const perf=env&&env.performance?env.performance:(typeof performance!=='undefined'?performance:null);
      const nav=perf&&typeof perf.getEntriesByType==='function'?perf.getEntriesByType('navigation'):null;
      if(nav&&nav[0]&&nav[0].type)return String(nav[0].type);
      if(perf&&perf.navigation&&perf.navigation.type===1)return'reload';
    }catch(_e){}
    return'navigate';
  }
  function boot(env){
    const storage=safeStorage(env);
    // Always validate/migrate the stored value at startup, even on a normal navigation.
    const stored=readLastRoute(env);
    const type=navigationType(env),isReload=type==='reload';
    const loc=env&&env.location?env.location:(typeof location!=='undefined'?location:null);
    const pathRoute=routeFromPath(loc&&loc.pathname||'/');
    let route='home',source='default';
    if(isReload&&stored){route=stored;source='lastRoute';}
    else if(pathRoute&&pathRoute!=='home'){route=pathRoute;source='path';}
    else if(isReload&&pathRoute){route=pathRoute;source='path';}
    // Keep the storage clean if an environment supplied an unusable storage object.
    if(!storage&&route!=='home'&&!pathRoute){route='home';source='default';}
    return {route,isReload,navigationType:type,source,storedRoute:stored||'',pathRoute:pathRoute||''};
  }
  function clear(env){const storage=safeStorage(env);safeRemove(storage,STORAGE_KEY);return true;}
  return {STORAGE_KEY,LEGACY_KEYS,VALID_ROUTES,normalize,normalizePath,routeFromPath,readLastRoute,remember,navigationType,boot,clear};
});
