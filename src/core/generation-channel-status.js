/* V26 pure helpers for concise page-scoped generation-channel status. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.GenerationChannelStatus=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function bool(v){return v===true;}
  function copyReady(status){
    const s=status||{};
    return bool(s.configured)&&s.loading!==true;
  }
  function sharedReady(config){
    const c=config||{};
    return !!(String(c.baseUrl||'').trim()&&String(c.apiKey||'').trim());
  }
  function describe(view,input){
    const v=String(view||'').trim().toLowerCase(),data=input||{};
    if(v==='copy'){
      const loading=data.loading===true,ready=copyReady(data);
      return Object.freeze({channel:'copy-coze',ready,loading,label:loading?'扣子通道检查中':(ready?'扣子通道正常':'扣子通道待配置')});
    }
    if(v==='integrate'||v==='image'){
      const ready=sharedReady(data);
      return Object.freeze({channel:'shared-image',ready,loading:false,label:ready?'共享图像通道正常':'共享图像通道待配置'});
    }
    return Object.freeze({channel:'none',ready:false,loading:false,label:'通道未启用'});
  }
  return {copyReady,sharedReady,describe};
});
