/* V26 compact, page-scoped channel status cards. */
(function(){
  'use strict';
  function escStatus(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function sharedConfig(){
    try{return {baseUrl:API_BRIDGE.baseUrl||'',apiKey:API_BRIDGE.apiKey||''};}
    catch(_e){return {baseUrl:'',apiKey:''};}
  }
  function sharedDescriptor(view){
    const helper=window.GenerationChannelStatus;
    return helper?helper.describe(view,sharedConfig()):{channel:'shared-image',ready:false,loading:false,label:'共享图像通道待配置'};
  }
  function cardHtml(desc,view){
    const state=desc.loading?'loading':(desc.ready?'ready':'pending');
    return `<div class="generation-channel-card ${state}" data-generation-channel-card="${escStatus(desc.channel)}" data-channel-view="${escStatus(view)}" data-channel-state="${state}" aria-live="polite"><span class="generation-channel-signal" aria-hidden="true"></span><b>${escStatus(desc.label)}</b></div>`;
  }
  function sharedChannelStatusHtml(view){return cardHtml(sharedDescriptor(view),view);}
  function patchSharedCards(){
    document.querySelectorAll('[data-generation-channel-card="shared-image"]').forEach(card=>{
      const view=card.dataset.channelView||((typeof curView==='string'&&curView)||'integrate');
      const desc=sharedDescriptor(view),state=desc.ready?'ready':'pending';
      card.className='generation-channel-card '+state;
      card.dataset.channelState=state;
      const title=card.querySelector('b');if(title)title.textContent=desc.label;
    });
    const ready=sharedDescriptor('integrate').ready;
    document.querySelectorAll('[data-cfg] .dot,[data-imgcfg] .dot').forEach(dot=>dot.classList.toggle('on',ready));
  }
  window.sharedImageChannelReady=function(){return sharedDescriptor('integrate').ready;};
  window.sharedChannelStatusHtml=sharedChannelStatusHtml;
  window.refreshSharedChannelStatusUi=patchSharedCards;
  document.addEventListener('shared-image-channel-change',patchSharedCards);
})();
