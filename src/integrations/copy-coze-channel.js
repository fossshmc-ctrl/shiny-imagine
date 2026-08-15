(function(){
  'use strict';
  const VERSION='V27';
  const MODEL_KEY='v24_copy_coze_bot_id';
  const statusGate=window.LatestRequestGate?window.LatestRequestGate.create():null;
  const state={status:null,statusPromise:null,statusRequestSeq:0,busy:false,lastRaw:null};
  const localPresetGenerate=typeof window.generate==='function'?window.generate:null;
  const $id=id=>document.getElementById(id);
  function safe(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  async function jsonFetch(url,options){
    const res=await fetch(url,Object.assign({cache:'no-store',headers:{'Content-Type':'application/json'}},options||{}));
    const text=await res.text();let data={};try{data=text?JSON.parse(text):{};}catch(_e){data={ok:false,error:{message:text||('HTTP '+res.status)}};}
    if(!res.ok||data.ok===false){const msg=data?.error?.message||data?.message||('HTTP '+res.status);const err=new Error(msg);err.status=res.status;err.data=data;throw err;}
    return data;
  }
  function announceStatus(status){
    try{document.dispatchEvent(new CustomEvent('copy-coze-status-change',{detail:{status:status||cached()}}));}catch(_e){}
    patchStatusCard();
  }
  async function loadStatus(force){
    if(state.status&&!force)return state.status;
    if(state.statusPromise&&!force)return state.statusPromise;
    const seq=statusGate?statusGate.begin():++state.statusRequestSeq;
    let request;
    request=jsonFetch('/api/copy-coze/status',{cache:'no-store'}).then(d=>{
      if(statusGate?statusGate.isLatest(seq):seq===state.statusRequestSeq){
        state.status=d;
        const models=d.models||[];let chosen=localStorage.getItem(MODEL_KEY)||d.selectedModel||models[0]?.id||'';
        if(!models.some(x=>x.id===chosen))chosen=models[0]?.id||'';
        if(chosen)localStorage.setItem(MODEL_KEY,chosen);
        announceStatus(d);
      }
      return d;
    }).catch(e=>{
      const failed={ok:false,configured:false,message:e.message,models:[]};
      if(statusGate?statusGate.isLatest(seq):seq===state.statusRequestSeq){state.status=failed;announceStatus(failed);}
      return failed;
    }).finally(()=>{if(state.statusPromise===request)state.statusPromise=null;});
    state.statusPromise=request;
    return request;
  }
  function cached(){return state.status||{ok:true,configured:false,loading:true,models:[],message:'正在读取扣子文案通道…'};}
  function selectedBot(){const s=cached(),models=s.models||[];let id=localStorage.getItem(MODEL_KEY)||s.selectedModel||models[0]?.id||'';if(!models.some(x=>x.id===id))id=models[0]?.id||'';return id;}
  function modelLabel(){const s=cached(),id=selectedBot(),m=(s.models||[]).find(x=>x.id===id);return m?.label||id||'未载入';}
  function maskedBot(id){id=String(id||'');return id.length>10?id.slice(0,6)+'…'+id.slice(-4):id;}
  function statusDescriptor(){
    const s=cached(),helper=window.GenerationChannelStatus;
    return helper?helper.describe('copy',s):{channel:'copy-coze',ready:!!s.configured,loading:!!s.loading,label:s.loading?'扣子通道检查中':(s.configured?'扣子通道正常':'扣子通道待配置')};
  }
  function statusHtml(){
    const d=statusDescriptor(),stateName=d.loading?'loading':(d.ready?'ready':'pending');
    return `<div class="copy-api-status ${stateName}" data-generation-channel-card="copy-coze" data-channel-state="${stateName}" aria-live="polite"><span class="signal"></span><div><b>${safe(d.label)}</b></div></div>`;
  }
  function patchStatusCard(){
    const card=document.querySelector('[data-generation-channel-card="copy-coze"]');if(!card)return;
    const d=statusDescriptor(),stateName=d.loading?'loading':(d.ready?'ready':'pending');
    card.className='copy-api-status '+stateName;card.dataset.channelState=stateName;
    const b=card.querySelector('b');if(b)b.textContent=d.label;
  }
  function optionsHtml(s){const models=s.models||[];if(!models.length)return '<option value="">未读取到可用 Bot</option>';const cur=selectedBot();return models.map(m=>`<option value="${safe(m.id)}" ${m.id===cur?'selected':''}>${safe(m.label||m.id)} · ${safe(maskedBot(m.id))}</option>`).join('');}
  async function openConfig(){
    modalOpen(`<h3>文案生成 · 扣子 Bot API 接入 V26</h3><div class="v24-coze-loading">正在读取独立文案接口、Bot 与令牌状态…</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
    const s=await loadStatus(true);
    const ready=!!s.configured;
    modalOpen(`<h3>文案生成 · 扣子 Bot API 接入 V26</h3>
      <div class="v24-coze-banner ${ready?'ok':'bad'}"><b>${ready?'独立文案通道已配置':'请先手动配置令牌'}</b><span>${safe(s.message||'')}</span></div>
      <div class="v24-coze-grid">
        <label><span>接口类型</span><input value="扣子（Coze）Bot API" readonly></label>
        <label><span>API 请求地址</span><input value="${safe(s.endpoint||'https://api.coze.cn/v3/chat')}" readonly></label>
        <label><span>令牌状态</span><input value="${s.tokenLoaded?'已配置 · '+safe(s.tokenSourceLabel||'本地服务'):'未配置'}" readonly></label>
        <label><span>文案模型 / Bot（列表选择）</span><select id="v24-copy-coze-model">${optionsHtml(s)}</select></label>
      </div>
      <div class="v242-token-panel">
        <div class="v242-token-head"><div><b>扣子访问令牌（手动输入）</b><span>压缩包不再内置 Token；请粘贴当前有效的个人访问令牌。</span></div>${s.tokenLoaded?'<em>已配置</em>':'<em class="bad">待配置</em>'}</div>
        <div class="v242-token-input"><input id="v242-copy-coze-token" type="password" autocomplete="new-password" spellcheck="false" placeholder="粘贴扣子访问令牌，例如 pat_…"><button type="button" class="btn btn-ghost" data-v242-token-visibility>显示</button></div>
        <div class="v242-token-actions"><button class="btn btn-violet" data-v242-token-session>仅本次使用</button><button class="btn btn-emerald" data-v242-token-save>本机加密保存</button>${s.tokenLoaded?'<button class="btn btn-ghost" data-v242-token-clear>清除令牌</button>':''}</div>
        <p>保存前会自动去除首尾空格、换行、引号及误复制的 <code>Bearer</code> 前缀。令牌只发送到本机 Node/Python 服务，不写入网页、localStorage、项目 JSON 或后台日志。</p>
      </div>
      <div class="notebox" style="margin-top:12px">Bot 列表仍由文案专用配置提供；手动输入只用于令牌。文案生成的 Bot、令牌、测试状态与请求日志继续和“AI线框生成”“AI生图”“智能区域微调”完全隔离。</div>
      <div class="notebox" style="margin-top:8px;background:#eff6ff;border-color:#bfdbfe;color:#1e40af">官方文档入口：${safe(s.docsUrl||'https://docs.coze.cn/')}。令牌需要具备 <b>chat</b> 权限，智能体需要已发布为 API 服务。</div>
      <div class="row" style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn-violet" data-v24-coze-save>保存 Bot 选择</button><button class="btn btn-emerald" data-v24-coze-reload>重新读取 Bot 列表</button><button class="btn btn-blue" data-v24-coze-test>测试文案接口</button><button class="btn btn-ghost" data-copy-open-backend-log>后台日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
  }
  async function saveManualToken(remember){
    const input=$id('v242-copy-coze-token'),token=(input&&input.value)||'';
    if(!token.trim()){setActionStatus('error','请先粘贴扣子访问令牌',false);return;}
    setActionStatus('loading',remember?'正在本机加密保存扣子令牌…':'正在为本次运行配置扣子令牌…',true);
    try{
      const d=await jsonFetch('/api/copy-coze/config',{method:'POST',body:JSON.stringify({token,remember:!!remember})});
      await loadStatus(true);
      patchStatusCard();
      setActionStatus('success',d.warning||(remember?'扣子令牌已本机加密保存':'扣子令牌已在本次运行中生效'),false);
      openConfig();
    }catch(err){setActionStatus('error','扣子令牌保存失败：'+err.message,false);}
  }
  async function clearManualToken(){
    setActionStatus('loading','正在清除扣子令牌…',true);
    try{await jsonFetch('/api/copy-coze/config',{method:'POST',body:JSON.stringify({clear:true})});await loadStatus(true);patchStatusCard();setActionStatus('success','扣子令牌已从本机配置中清除',false);openConfig();}catch(err){setActionStatus('error','清除令牌失败：'+err.message,false);}
  }
  async function testConnection(btn){
    if(btn)btn.disabled=true;
    setActionStatus('loading','正在测试扣子文案 Bot API…',true);
    try{
      const s=await loadStatus(true);
      if(!s.configured)throw new Error(s.message||'扣子文案通道未配置');
      const d=await jsonFetch('/api/copy-coze/test',{method:'POST',body:JSON.stringify({botId:selectedBot()})});
      state.lastRaw=d;
      await loadStatus(true);
      patchStatusCard();
      const transport=d.transport==='message-list'?'消息详情恢复':(d.transport==='json'?'JSON 兼容':'SSE 流式');
      const diag=(d.requestId||d.logId)?`<div class="notebox" style="margin-top:8px"><b>诊断标识：</b>${safe(d.requestId||d.logId)}</div>`:'';
      setActionStatus('success','扣子文案接口连接正常',false);
      modalOpen(`<h3>文案生成 · 扣子 API 测试结果</h3><div class="notebox" style="background:#ecfdf5;border-color:#a7f3d0;color:#047857"><b>✅ 连接正常</b><br>${safe(d.message||'扣子 Bot 已返回测试消息')}</div><div class="v24-coze-test-grid"><div><span>通道</span><b>文案生成专用</b></div><div><span>Bot</span><b>${safe(d.modelLabel||modelLabel())}</b></div><div><span>HTTP</span><b>${safe(String(d.status||200))}</b></div><div><span>耗时</span><b>${safe(String(d.durationMs||0))} ms</b></div><div><span>返回方式</span><b>${safe(transport)}</b></div><div><span>解析事件</span><b>${safe(String(d.eventCount||0))}</b></div></div><div class="notebox" style="margin-top:12px">测试回复：${safe(d.reply||'连接正常')}</div>${diag}<div class="row" style="margin-top:14px"><button class="btn btn-violet" data-v24-coze-config>返回配置</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
    }catch(err){
      const detail=err&&err.data&&err.data.error||{};
      const diag=[detail.code&&('错误码 '+detail.code),detail.requestId&&('Request ID '+detail.requestId),detail.logId&&('Log ID '+detail.logId)].filter(Boolean).join(' · ');
      setActionStatus('error','扣子文案接口测试失败：'+err.message,false);
      const code=String(detail.code||''),missing=detail.type==='token_not_configured';
      const authFail=detail.type==='auth_failed'||code==='4100'||code==='4101'||err.status===401;
      const hint=missing?'尚未向本地服务配置令牌。请在“检查配置”中手动粘贴后，先选择“仅本次使用”完成测试。':code==='4100'?'扣子判定个人访问令牌无效。请撤销旧令牌，重新生成并完整复制后手动粘贴。':code==='4101'?'请求已到达扣子，但当前令牌无权访问该 Bot/工作空间。请为令牌勾选 chat 权限，并把 Bot 所在空间加入可访问范围。':authFail?'扣子拒绝了当前令牌。请检查令牌有效期、权限、可访问工作空间和 Bot 归属后重新粘贴。':'V26 保留 SSE/JSON 与消息详情恢复；请根据错误码、Request ID 和 Log ID 检查 Bot 发布状态、权限或网络。';
      modalOpen(`<h3>文案生成 · 扣子 API 测试结果</h3><div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c"><b>❌ 测试失败</b><br>${safe(err.message)}</div>${diag?`<div class="notebox" style="margin-top:8px"><b>诊断信息：</b>${safe(diag)}</div>`:''}<p class="hint">${safe(hint)}</p><div class="row" style="margin-top:14px"><button class="btn btn-violet" data-v24-coze-config>检查配置</button><button class="btn btn-ghost" data-copy-open-backend-log>后台日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
    }finally{
      if(btn)btn.disabled=false;
    }
  }
  function stripFence(text){let t=String(text||'').trim();t=t.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();const a=t.indexOf('{'),b=t.lastIndexOf('}');if(a>=0&&b>a)t=t.slice(a,b+1);return t;}
  function normalizeResponse(content){
    let obj=content;if(typeof obj==='string')obj=JSON.parse(stripFence(obj));
    const arr=Array.isArray(obj)?obj:(obj?.versions||obj?.data?.versions||obj?.result?.versions||[]);
    if(!Array.isArray(arr)||!arr.length)throw new Error('扣子返回内容中没有 versions 数组');
    const out=arr.slice(0,8).map((item,i)=>{const b=item?.block||item||{};return{version:Number(item?.version)||i+1,style:String(item?.style||STRATEGIES[i]||('策略'+(i+1))),block:normalizeCopyBlock({mainTitle:b.mainTitle||b.main_title||b.title,coreSellingPoint:b.coreSellingPoint||b.core_selling_point||b.sellingPoint||b.benefits,functionArea:b.functionArea||b.function_area||b.subInfo,subtitles:b.subtitles||[b.subtitle1,b.subtitle2,b.subtitle3].filter(Boolean),consumerInsight:b.consumerInsight||b.consumer_insight||b.insight})};});
    if(out.length!==8)throw new Error(`扣子返回 ${out.length} 个版本，要求固定返回 8 个版本`);
    return out;
  }
  async function generate(productInfo){
    const s=await loadStatus();if(!s.configured)throw new Error(s.message||'扣子文案通道尚未配置');
    const d=await jsonFetch('/api/copy-coze/generate',{method:'POST',body:JSON.stringify({botId:selectedBot(),productInfo:String(productInfo||''),jsonPrompt:typeof COPY_API_CHANNEL!=='undefined'?(COPY_API_CHANNEL.jsonPrompt||''):''})});state.lastRaw=d;return{copies:normalizeResponse(d.content),raw:d};
  }
  function installOverrides(){
    try{copyApiReady=function(){return !!cached().configured;};}catch(_e){}
    try{copyApiStatusHtml=statusHtml;}catch(_e){}
    try{openCopyApiConfig=openConfig;}catch(_e){}
    try{openCopyProfileManager=openConfig;}catch(_e){}
    try{copyProfileQuickbar=function(){const s=cached();return `<div class="profile-quickbar"><b>扣子文案专用通道</b><select id="v24-copy-inline-model">${optionsHtml(s)}</select><button class="btn btn-violet" data-v24-coze-save-inline>保存模型选择</button><button class="btn btn-ghost" data-v24-coze-config>接口详情</button><span class="meta">Bot 列表自动载入；扣子令牌在接口详情中手动配置，不使用共享 API 密钥。</span></div>`;};}catch(_e){}
    try{backendLogHtml=function(logs){const s=cached(),mp=(typeof COPY_API_CHANNEL!=='undefined'&&(COPY_API_CHANNEL.mappingName||'V13 预制文案自动映射'))||'V13 预制文案自动映射';const head=`<div class="notebox" style="margin-bottom:10px">当前通道：<b>扣子文案专用 · V26</b>　｜　Bot：<b>${safe(modelLabel())}</b>　｜　令牌：<b>${safe(s.tokenSourceLabel||'未配置')}</b>　｜　字段映射：<b>${safe(mp)}</b></div>`;if(!logs||!logs.length)return head+'<div class="copy-log-empty">暂无后台日志。测试连接或调用接口后，日志会显示在这里。</div>';return head+`<div class="copy-log-list">${logs.map(x=>`<div class="copy-log-item ${Number(x.status)>=400||(x.fieldAudit&&x.fieldAudit.ok===false)?'err':''}"><div><b>${safe(x.time||'')} · ${safe(x.method||'')} ${safe(x.path||'')} · HTTP ${safe(String(x.status==null?'-':x.status))}</b><p>${safe(x.message||x.channel||'')}</p></div><span class="code">${safe(String(x.durationMs==null?'-':x.durationMs))} ms</span></div>`).join('')}</div>`;};}catch(_e){}
    try{testCopyConnection=testConnection;}catch(_e){}
    try{testCopyJsonChannel=async function(btn){if(btn)btn.disabled=true;setActionStatus('loading','正在通过扣子生成结构化文案测试…',true);try{const product=($id('cp-in')&&$id('cp-in').value.trim())||(copies._in||'测试产品：宠物营养保健品');const r=await generate(product);COPY_API_CHANNEL.lastResponse=JSON.stringify(r.raw,null,2);COPY_API_CHANNEL.lastMapped={versions:r.copies.map(x=>({version:x.version,style:x.style,...x.block}))};saveCopyApiChannel();const ta=$id('copy-json-response');if(ta)ta.value=COPY_API_CHANNEL.lastResponse;setActionStatus('success','扣子结构化文案接口测试成功',false);}catch(e){setActionStatus('error','接口测试失败：'+e.message,false);}finally{if(btn)btn.disabled=false;}};}catch(_e){}
    try{bindCopy=function(){const inp=$id('cp-in'),gen=$id('cp-gen');if(!inp||!gen)return;if(copies._in)inp.value=copies._in;const sync=()=>{gen.disabled=!inp.value.trim()||state.busy;};inp.addEventListener('input',sync);sync();gen.addEventListener('click',async()=>{if(!inp.value.trim()||state.busy)return;const source=inp.value.trim(),timerApi=window.ElapsedTimer;state.busy=true;gen.disabled=true;gen.textContent='扣子生成中…';const baseMessage='正在通过扣子 Bot API 生成 8 个文案版本…';let elapsedMs=0;const generationTimer=timerApi&&timerApi.create?timerApi.create({intervalMs:100,onTick:tick=>{const text=baseMessage+' · 已用时 '+tick.text;if(typeof updateActionStatusMessage==='function'){if(!updateActionStatusMessage(text))setActionStatus('loading',text,true);}else setActionStatus('loading',text,true);}}):null;if(generationTimer){setActionStatus('loading',baseMessage+' · 已用时 00:00.0',true);generationTimer.start();}else setActionStatus('loading',baseMessage,true);try{const r=await generate(source);copies=r.copies;copies._in=source;selected=new Set();expanded=null;copySnapshotCaptureGenerated(source,'coze-bot');syncAllBoundTaskGroups();renderCopyOut();elapsedMs=generationTimer?generationTimer.stop():0;setActionStatus('success','扣子已生成 8 个结构化文案版本'+(generationTimer&&timerApi&&timerApi.formatElapsed?' · 总耗时 '+timerApi.formatElapsed(elapsedMs):''),false);}catch(err){elapsedMs=generationTimer?generationTimer.stop():0;setActionStatus('error','扣子文案生成失败'+(timerApi&&timerApi.formatElapsed?' · '+timerApi.formatElapsed(elapsedMs):'')+'：'+err.message,false);modalOpen(`<h3>文案生成失败</h3><div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c">${safe(err.message)}</div><p class="hint">当前没有使用本地预制结果覆盖页面。V27 会先解析 SSE/JSON，再在必要时读取同一次对话的消息详情；认证失败时请在接口详情中重新手动输入令牌，并检查 chat 权限与 Bot 发布状态。</p><div class="row" style="margin-top:14px"><button class="btn btn-violet" data-v24-coze-test>测试接口</button><button class="btn btn-ghost" data-v24-local-fallback>使用本地备用规则</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}finally{if(generationTimer&&generationTimer.isRunning())generationTimer.stop();state.busy=false;gen.textContent='生成 8 个版本';sync();}});};}catch(_e){}
    try{window.CopyApiBridge={getConfig:()=>({provider:'coze',status:cached(),selectedBot:selectedBot(),channel:Object.assign({},COPY_API_CHANNEL)}),openConfig,test:testConnection,request:generate,map:(raw)=>applyCopyMapping(raw,COPY_API_CHANNEL.fieldMapping||{})};}catch(_e){}
  }
  document.addEventListener('click',async e=>{
    const cfg=e.target.closest?.('[data-v24-coze-config]');if(cfg){e.preventDefault();e.stopPropagation();openConfig();return;}
    const save=e.target.closest?.('[data-v24-coze-save],[data-v24-coze-save-inline]');if(save){const el=$id(save.hasAttribute('data-v24-coze-save-inline')?'v24-copy-inline-model':'v24-copy-coze-model');if(el&&el.value)localStorage.setItem(MODEL_KEY,el.value);setActionStatus('success','扣子文案模型选择已保存',false);if(curView==='copy')render('copy');return;}
    const reload=e.target.closest?.('[data-v24-coze-reload]');if(reload){reload.disabled=true;await loadStatus(true);reload.disabled=false;openConfig();return;}
    const test=e.target.closest?.('[data-v24-coze-test]');if(test){e.preventDefault();e.stopPropagation();testConnection(test);return;}
    const session=e.target.closest?.('[data-v242-token-session]'),persist=e.target.closest?.('[data-v242-token-save]');if(session||persist){e.preventDefault();e.stopPropagation();saveManualToken(!!persist);return;}
    const clear=e.target.closest?.('[data-v242-token-clear]');if(clear){e.preventDefault();e.stopPropagation();clearManualToken();return;}
    const visibility=e.target.closest?.('[data-v242-token-visibility]');if(visibility){e.preventDefault();e.stopPropagation();const input=$id('v242-copy-coze-token');if(input){const show=input.type==='password';input.type=show?'text':'password';visibility.textContent=show?'隐藏':'显示';input.focus();}return;}
    const fallback=e.target.closest?.('[data-v24-local-fallback]');if(fallback){const input=($id('cp-in')?.value||copies._in||'').trim();if(!input)return;copies=generateLocal(input);copies._in=input;selected=new Set();expanded=null;copySnapshotCaptureGenerated(input,'local-fallback');modalClose();renderCopyOut();setActionStatus('success','已使用本地备用规则生成 8 个版本',false);return;}
  },true);
  function generateLocal(input){if(typeof localPresetGenerate!=='function')throw new Error('本地备用规则不可用');return localPresetGenerate(input);}
  try{window.__V24_LOCAL_COPY_GENERATE__=localPresetGenerate;}catch(_e){}
  installOverrides();
  loadStatus().then(()=>{if(typeof curView!=='undefined'&&curView==='copy'){patchStatusCard();if(!document.querySelector('[data-generation-channel-card="copy-coze"]'))render('copy');}});
  window.CopyCozeV24={version:VERSION,status:loadStatus,cached,selectedBot,openConfig,test:testConnection,generate,refreshStatus:()=>loadStatus(true),patchStatusCard};
  const style=document.createElement('style');style.textContent=`
    .v24-coze-banner{display:flex;flex-direction:column;gap:4px;padding:13px 14px;border-radius:14px;border:1px solid;margin-bottom:14px}.v24-coze-banner.ok{background:#ecfdf5;border-color:#a7f3d0;color:#047857}.v24-coze-banner.bad{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.v24-coze-banner span{font-size:12px}.v24-coze-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.v24-coze-grid label{display:flex;flex-direction:column;gap:6px}.v24-coze-grid label span{font-size:12px;font-weight:700;color:#475569}.v24-coze-grid input,.v24-coze-grid select{width:100%;min-height:42px;border:1px solid #d7deea;border-radius:11px;padding:0 12px;background:#fff}.v24-coze-test-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.v24-coze-test-grid>div{padding:10px;border:1px solid #e2e8f0;border-radius:11px;background:#f8fafc}.v24-coze-test-grid span{display:block;font-size:11px;color:#64748b}.v24-coze-test-grid b{font-size:13px;color:#0f172a}.v242-token-panel{margin-top:12px;padding:13px;border:1px solid #d7deea;border-radius:14px;background:#f8fafc}.v242-token-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.v242-token-head div{display:flex;flex-direction:column;gap:3px}.v242-token-head span,.v242-token-panel p{font-size:12px;color:#64748b}.v242-token-head em{font-style:normal;font-size:12px;font-weight:700;color:#047857;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:999px;padding:4px 9px}.v242-token-head em.bad{color:#b45309;background:#fff7ed;border-color:#fed7aa}.v242-token-input{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:10px}.v242-token-input input{min-height:42px;border:1px solid #cbd5e1;border-radius:11px;padding:0 12px;background:#fff}.v242-token-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:9px}.v242-token-panel p{margin:9px 0 0;line-height:1.55}.v242-token-panel code{font-family:ui-monospace,monospace;background:#e2e8f0;padding:1px 4px;border-radius:4px}@media(max-width:760px){.v24-coze-grid,.v24-coze-test-grid{grid-template-columns:1fr}.v242-token-input{grid-template-columns:1fr}.v242-token-input button{width:100%}}
  `;document.head.appendChild(style);
})();
