/* V24.5 testable JSON normalization and hashing helpers. */
(function(root,factory){
  'use strict';
  const api=factory();
  root.AppJson=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function stableValue(value){
    if(Array.isArray(value)) return value.map(stableValue);
    if(value&&typeof value==='object'){
      const out={};
      Object.keys(value).sort().forEach(key=>{ out[key]=stableValue(value[key]); });
      return out;
    }
    return value;
  }
  function stableString(value){ return JSON.stringify(stableValue(value)); }
  function fnv1a(value){
    const text=typeof value==='string'?value:stableString(value);
    let hash=2166136261;
    for(let i=0;i<text.length;i++){
      hash^=text.charCodeAt(i);
      hash=Math.imul(hash,16777619);
    }
    return ('00000000'+(hash>>>0).toString(16)).slice(-8);
  }
  function parseText(text){
    if(typeof text!=='string'||!text.trim()) return null;
    try{return JSON.parse(text);}catch(_error){return null;}
  }
  return {stableValue,stableString,fnv1a,parseText};
});
