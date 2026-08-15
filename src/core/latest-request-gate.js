/* V26 pure helper: only the newest async request may update shared state. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LatestRequestGate=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(){
    let sequence=0;
    return Object.freeze({
      begin(){sequence+=1;return sequence;},
      isLatest(token){return Number(token)===sequence;},
      current(){return sequence;},
      invalidate(){sequence+=1;return sequence;}
    });
  }
  return {create};
});
