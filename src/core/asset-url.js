/* V24.5 pure asset URL normalization and retry helpers. */
(function(root,factory){
  'use strict';
  const api=factory();
  root.AssetUrl=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const BUILTIN_RE=/(?:^|\/)(assets\/(?:wolassen|lebao)\/[^?#]+\.(?:jpe?g|png|webp))(?:[?#].*)?$/i;

  function clean(value){
    return String(value==null?'':value).trim().replace(/\\/g,'/');
  }
  function builtinAssetPath(value){
    const src=clean(value);
    if(!src||/^data:|^blob:/i.test(src)) return '';
    let candidate=src;
    try{
      if(/^[a-z][a-z0-9+.-]*:/i.test(src)) candidate=new URL(src).pathname;
    }catch(_e){}
    candidate=candidate.replace(/^\.\//,'').replace(/^\/+/, '');
    const match=candidate.match(BUILTIN_RE);
    return match?match[1].toLowerCase():'';
  }
  function normalizeBuiltinAssetUrl(value,version){
    const path=builtinAssetPath(value);
    if(!path) return clean(value);
    const v=String(version||'').trim();
    return '/'+path+(v?'?v='+encodeURIComponent(v):'');
  }
  function isBuiltinAsset(value){return !!builtinAssetPath(value);}
  function appendRetryToken(value,token){
    const src=clean(value);if(!src||/^data:|^blob:/i.test(src))return src;
    const join=src.includes('?')?'&':'?';
    return src+join+'retry='+encodeURIComponent(String(token||Date.now()));
  }
  function assetKey(value){return builtinAssetPath(value).replace(/^assets\//i,'');}
  return {clean,builtinAssetPath,normalizeBuiltinAssetUrl,isBuiltinAsset,appendRetryToken,assetKey};
});
