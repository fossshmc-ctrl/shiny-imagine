/* V26（继承 V24.6） pure state helpers for the collapsible wireframe workflow overview. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.WireframeOverviewState=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function normalizeExpanded(value){
    return value===true||value===1||value==='1'||value==='true';
  }
  function summarizeGroups(groups,checks){
    const list=Array.isArray(groups)?groups:[];
    const c=checks&&typeof checks==='object'?checks:{};
    const run=(name,item)=>typeof c[name]==='function'&&!!c[name](item);
    const stats={all:list.length,bound:0,frame:0,json:0,linked:0,done:0,needsAttention:0};
    list.forEach(item=>{
      const bound=run('isBound',item),frame=run('hasFrame',item),json=run('hasJson',item),linked=run('isLinked',item),done=run('isDone',item),failed=run('isFailed',item);
      if(bound)stats.bound++;
      if(frame)stats.frame++;
      if(json)stats.json++;
      if(linked)stats.linked++;
      if(done)stats.done++;
      if(failed||!bound||!frame||!json||!linked)stats.needsAttention++;
    });
    return stats;
  }
  return {normalizeExpanded,summarizeGroups};
});
