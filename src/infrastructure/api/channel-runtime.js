/* V26 route-aware generation-channel runtime. */
(function(){
  'use strict';
  const state={activeView:'home',sequence:0,lastByChannel:Object.create(null)};
  function descriptor(view){
    const iso=window.GenerationChannelIsolation;
    return iso?iso.channelDescriptor(view):{channel:(view==='copy'?'copy-coze':(view==='integrate'||view==='image'?'shared-image':'none'))};
  }
  async function enter(view){
    state.activeView=String(view||'home');
    const seq=++state.sequence,desc=descriptor(state.activeView),channel=desc.channel;
    document.documentElement.dataset.generationChannel=channel;
    if(channel==='copy-coze'){
      // 只读取扣子专用状态；不检查共享 Base URL/API Key，不请求 /api/models。
      try{
        const result=window.CopyCozeV24?await window.CopyCozeV24.status(false):{ok:true,skipped:true};
        if(seq===state.sequence)state.lastByChannel[channel]=result;
        try{window.CopyCozeV24&&window.CopyCozeV24.patchStatusCard&&window.CopyCozeV24.patchStatusCard();}catch(_e){}
        return result;
      }catch(error){
        const result={ok:false,channel,error:String(error&&error.message||error)};
        if(seq===state.sequence)state.lastByChannel[channel]=result;
        return result;
      }
    }
    if(channel==='shared-image'){
      const boot=window.SharedApiBootstrap;
      const result=boot?await boot.ensureForView(state.activeView,{notify:false}):{ok:true,skipped:true,reason:'bootstrap-unavailable'};
      if(seq===state.sequence&&descriptor(state.activeView).channel===channel)state.lastByChannel[channel]=result;
      try{window.refreshSharedChannelStatusUi&&window.refreshSharedChannelStatusUi();}catch(_e){}
      return result;
    }
    // 智能区域微调和管理页面各自维护独立通道，不在这里触发共享模型载入。
    const result={ok:true,skipped:true,channel,reason:'independent-channel'};
    state.lastByChannel[channel]=result;
    return result;
  }
  function snapshot(){
    const desc=descriptor(state.activeView);
    return {activeView:state.activeView,activeChannel:desc.channel,descriptor:desc,lastByChannel:Object.assign({},state.lastByChannel)};
  }
  window.AppChannelRuntime={version:'V27',enter,snapshot,descriptor};
  if(typeof curView==='string')enter(curView);
})();
