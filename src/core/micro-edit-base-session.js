/* V28.1.1 micro-edit base session: make sequential-edit inheritance explicit and testable. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.MicroEditBaseSessionV280=api;root.MicroEditBaseSessionV279=api;}
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='V28.1.1';
  const MODES={CURRENT:'current',ORIGINAL:'original'};
  function normalizeMode(value){return value===MODES.ORIGINAL?MODES.ORIGINAL:MODES.CURRENT;}
  function resolveBase(state,mode){
    const s=state||{},m=normalizeMode(mode||s.microBaseMode);
    const currentSrc=String(s.src||''),originalSrc=String(s.originalSrc||'');
    const useOriginal=m===MODES.ORIGINAL&&!!originalSrc;
    return {
      mode:m,
      source:useOriginal?originalSrc:currentSrc,
      name:useOriginal?(s.originalName||s.name||'original-image.png'):(s.name||'current-result.png'),
      isOriginal:useOriginal,
      fallbackToCurrent:m===MODES.ORIGINAL&&!originalSrc
    };
  }
  function label(mode){return normalizeMode(mode)===MODES.ORIGINAL?'识别原图':'当前结果';}
  function hint(mode){return normalizeMode(mode)===MODES.ORIGINAL?'本次微调不继承之前已确认的微调结果':'本次微调会在当前结果上继续修改，并保留之前已确认的结果';}
  return{VERSION,MODES,normalizeMode,resolveBase,label,hint};
});
