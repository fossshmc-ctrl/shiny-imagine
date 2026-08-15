/* V26 page-state lifecycle: route persistence chooses the page; each page owns its own restore/clear policy. */
(function(root){
  'use strict';
  const POLICY=Object.freeze({
    home:{storage:'none',reload:'fresh'},
    copy:{storage:'session+local',reload:'restore-current-copy-only'},
    integrate:{storage:'runtime',reload:'fresh-task-runtime'},
    image:{storage:'runtime',reload:'fresh-task-runtime'},
    adjust:{storage:'indexeddb+session',reload:'owned-by-region-workbench'},
    users:{storage:'none',reload:'fresh'},
    audit:{storage:'none',reload:'fresh'}
  });
  function prepareBoot(route,context){
    const normalized=root.AppRoutePersistence?.normalize(route)||'home';
    const ctx=context||{};
    const result={route:normalized,restored:false,policy:POLICY[normalized]||POLICY.home};
    if(normalized==='copy'&&ctx.isReload&&typeof root.copySnapshotRestoreOnReload==='function'){
      result.restored=!!root.copySnapshotRestoreOnReload();
    }
    // Region-workbench owns project/session recovery after its module loads.
    return result;
  }
  function beforeNavigation(from,to){
    const source=root.AppRoutePersistence?.normalize(from)||'home';
    const target=root.AppRoutePersistence?.normalize(to)||'home';
    if(target==='copy'&&source!=='copy'&&typeof root.copySnapshotBeginFreshEntry==='function'){
      root.copySnapshotBeginFreshEntry();
    }
    return {from:source,to:target,policy:POLICY[target]||POLICY.home};
  }
  root.AppPageStateLifecycle={POLICY,prepareBoot,beforeNavigation};
})(typeof globalThis!=='undefined'?globalThis:this);
