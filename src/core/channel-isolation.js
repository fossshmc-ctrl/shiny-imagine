/* V26 pure helpers for isolating generation channels by application view. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GenerationChannelIsolation=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const CHANNELS=Object.freeze({
    NONE:'none',
    COPY_COZE:'copy-coze',
    SHARED_IMAGE:'shared-image',
    MICRO_ADJUST:'micro-adjust'
  });
  function channelForView(view){
    const v=String(view||'').trim().toLowerCase();
    if(v==='copy')return CHANNELS.COPY_COZE;
    if(v==='integrate'||v==='image')return CHANNELS.SHARED_IMAGE;
    if(v==='adjust')return CHANNELS.MICRO_ADJUST;
    return CHANNELS.NONE;
  }
  function hasSharedCredentials(config){
    const c=config||{};
    return !!(String(c.baseUrl||'').trim()&&String(c.apiKey||'').trim());
  }
  function hasSharedModels(config){
    const c=config||{};
    return Array.isArray(c.models)&&c.models.length>0;
  }
  function shouldBootstrapSharedModels(view,config){
    return channelForView(view)===CHANNELS.SHARED_IMAGE&&hasSharedCredentials(config)&&!hasSharedModels(config);
  }
  function mayReportSharedModelFailure(view){
    return channelForView(view)===CHANNELS.SHARED_IMAGE;
  }
  function channelDescriptor(view){
    const channel=channelForView(view);
    if(channel===CHANNELS.COPY_COZE)return Object.freeze({channel,provider:'coze',credential:'manual-token',modelKind:'bot',shared:false});
    if(channel===CHANNELS.SHARED_IMAGE)return Object.freeze({channel,provider:'openai-compatible',credential:'shared-api-key',modelKind:'image',shared:true});
    if(channel===CHANNELS.MICRO_ADJUST)return Object.freeze({channel,provider:'micro-adjust',credential:'independent-api-key',modelKind:'image-edit',shared:false});
    return Object.freeze({channel,provider:'none',credential:'none',modelKind:'none',shared:false});
  }
  return {CHANNELS,channelForView,hasSharedCredentials,hasSharedModels,shouldBootstrapSharedModels,mayReportSharedModelFailure,channelDescriptor};
});
