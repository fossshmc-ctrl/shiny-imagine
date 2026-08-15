/* V27 智能区域编辑 · 独立微调生成 API 通道
   - EvoLink Nano Banana 2 Lite: https://api.evolink.ai/v1 / gemini-3.1-flash-lite-image
   - 配置与 AI 线框 / AI 生图保持通道隔离，但复用同一套本地代理、Credits、模型能力、文件通道诊断
   - API 测试不会创建计费生图任务
*/
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;

  const VERSION='V28.1.1';
  const CHANNEL_NAME='micro-adjust-v27.8';
  const LEGACY_CHANNEL='micro-adjust-v27.3.1'; // historical compatibility marker
  const EVO=window.EvoLinkImageAdapter||null;
  const DEFAULT_BASE=EVO?EVO.DEFAULT_BASE:'https://api.evolink.ai/v1';
  const DEFAULT_MODEL='gemini-3.1-flash-lite-image';
  const DOCS_URL='https://evolink.ai/docs/en/api-manual/image-series/nanobanana/nanobanana-2-lite-image-generate';
  const STORAGE_KEY='turing_v23_micro_api_config'; // 保留旧 key，升级 V27 不丢用户本地配置
  const MIGRATION_KEY='turing_v27_micro_evolink_migrated';
  const TEST_CACHE_MS=300000;
  const CREDIT_FRESH_MS=60000;
  const ISOLATION_CACHE_MS=30000;
  const LOCAL_HEALTH_TIMEOUT_MS=8000;
  const MICRO_TASK_SOFT_TIMEOUT_MS=180000;
  const MICRO_TASK_TIMEOUT_MS=360000;
  const MICRO_TASK_MAX_TIMEOUT_MS=480000;
  const MICRO_TASK_RETRY_ATTEMPTS=3;
  const MICRO_RUN_STALE_MS=600000;
  const MICRO_COUNT=1;
  const state={config:null,logs:[],lastTest:null,testCache:null,creditCache:null,creditReadyAt:0,preflightReadyAt:0,lastPreflight:null,isolationCache:null,generationActive:false,generationFatalError:null,generationId:'',generationMeta:null,modal:null};

  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const now=()=>new Date().toLocaleString('zh-CN');
  const maskKey=v=>{v=String(v||'');return !v?'未填写':v.length>12?`${v.slice(0,5)}…${v.slice(-4)}`:'已填写';};
  const normalizeBase=value=>EVO&&EVO.normalizeEvolinkBase?EVO.normalizeEvolinkBase(value):String(value||DEFAULT_BASE).trim().replace(/\/+$/,'');
  const modelName=m=>typeof m==='string'?m:String(m?.id||m?.name||m?.model||m?.object||'');
  const defaults=()=>({version:VERSION,baseUrl:DEFAULT_BASE,apiKey:'',imageModel:DEFAULT_MODEL,models:EVO?EVO.BUILTIN_IMAGE_MODELS.slice():[DEFAULT_MODEL],updatedAt:'',lastTestOk:null,lastTestAt:'',lastTestMessage:'',provider:'evolink',docsUrl:DOCS_URL});

  function load(){
    try{
      let raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null')||{};
      if(localStorage.getItem(MIGRATION_KEY)!=='1'){
        const oldBase=String(raw.baseUrl||'').trim();
        if(!oldBase||/api\.ofox\.ai/i.test(oldBase)||/evolink\.ai\/docs\//i.test(oldBase)||/api\.example\.com/i.test(oldBase)) raw.baseUrl=DEFAULT_BASE;
        if(!String(raw.imageModel||'').trim())raw.imageModel=DEFAULT_MODEL;
        if(!Array.isArray(raw.models)||!raw.models.length)raw.models=EVO?EVO.BUILTIN_IMAGE_MODELS.slice():[DEFAULT_MODEL];
        localStorage.setItem(MIGRATION_KEY,'1');
      }
      state.config=Object.assign(defaults(),raw);
      state.config.baseUrl=normalizeBase(state.config.baseUrl||DEFAULT_BASE);
      state.config.apiKey=String(state.config.apiKey||'').trim();
      state.config.imageModel=String(state.config.imageModel||DEFAULT_MODEL).trim();
      state.config.models=Array.isArray(state.config.models)&&state.config.models.length?state.config.models.map(modelName).filter(Boolean):(EVO?EVO.BUILTIN_IMAGE_MODELS.slice():[DEFAULT_MODEL]);
      if(!state.config.models.includes(DEFAULT_MODEL))state.config.models.unshift(DEFAULT_MODEL);
    }catch(_e){state.config=defaults();}
    return state.config;
  }

  function emitChange(){
    const detail=status();
    for(const name of ['v27-micro-api-change','v24-micro-api-change','v23-micro-api-change']){
      try{window.dispatchEvent(new CustomEvent(name,{detail}));}catch(_e){}
    }
  }

  function applyV29ManagedRuntime(event){
    const data=event&&event.detail||window.DeploymentRuntimeV29?.state?.health;
    if(data&&data.serverManaged&&data.serverManaged.evolink){
      const current=state.config||load();
      if(current.apiKey!=='server-managed')save({baseUrl:DEFAULT_BASE,apiKey:'server-managed',imageModel:current.imageModel||DEFAULT_MODEL});
    }
  }

  function save(cfg){
    const previous=state.config||load(),previousFingerprint=fingerprint(previous);
    const next=Object.assign(defaults(),previous||{},cfg||{},{version:VERSION,provider:'evolink',docsUrl:DOCS_URL,updatedAt:now()});
    next.baseUrl=normalizeBase(next.baseUrl||DEFAULT_BASE);
    next.apiKey=String(next.apiKey||'').trim();
    next.imageModel=String(next.imageModel||DEFAULT_MODEL).trim()||DEFAULT_MODEL;
    next.models=Array.isArray(next.models)?next.models.map(modelName).filter(Boolean):[];
    if(!next.models.includes(DEFAULT_MODEL))next.models.unshift(DEFAULT_MODEL);
    const nextFingerprint=fingerprint(next),identityChanged=previousFingerprint!==nextFingerprint;
    state.config=next;localStorage.setItem(STORAGE_KEY,JSON.stringify(state.config));
    if(identityChanged){
      state.testCache=null;state.creditCache=null;state.creditReadyAt=0;state.preflightReadyAt=0;state.isolationCache=null;state.lastPreflight={mode:'config-changed',at:Date.now(),durationMs:0};
      log({ok:true,stage:'微调配置变更',status:200,duration:0,message:'Base URL / API Key / Model 发生变化，已清除完整诊断与额度缓存；普通 lastTest 状态更新不会清缓存'});
    }
    emitChange();
    return state.config;
  }

  function modelMeta(m){
    const id=modelName(m),raw=JSON.stringify(m||{});
    const strong=/(inpaint|outpaint|image[-_ ]?edit|edit[-_ ]?image|mask|局部|重绘|擦除|gpt-image|seededit|qwen.*image.*edit|nanobanana|nano[-_ ]?banana|gemini.*image|seedream)/i.test(id+' '+raw);
    const image=EVO?(EVO.isDirectImageModelObject?EVO.isDirectImageModelObject(m):EVO.isImageModelObject(m)):(strong||/(image|img|dall|flux|stable|seedream|midjourney|绘图|生图|图生图)/i.test(id+' '+raw));
    return{id,strong,image,label:id===DEFAULT_MODEL?'★ Nano Banana 2 Lite（推荐）':strong?'★ 图生图/编辑推荐':image?'图像模型':'其他模型'};
  }
  function sortModels(list){return (list||[]).map(m=>({raw:m,...modelMeta(m)})).filter(x=>x.id).sort((a,b)=>Number(b.id===DEFAULT_MODEL)-Number(a.id===DEFAULT_MODEL)||Number(b.strong)-Number(a.strong)||Number(b.image)-Number(a.image)||a.id.localeCompare(b.id));}

  function status(){
    const c=state.config||load(),configured=!!(c.baseUrl&&c.apiKey&&c.imageModel);
    let key='unconfigured',label='未配置';
    if(configured&&c.lastTestOk===true){key='connected';label='已连接';}
    else if(configured&&c.lastTestOk===false){key='failed';label='连接失败';}
    else if(configured){key='untested';label='待测试';}
    return{key,label,configured,baseUrl:c.baseUrl||DEFAULT_BASE,model:c.imageModel||DEFAULT_MODEL,keyLabel:maskKey(c.apiKey),lastTestAt:c.lastTestAt||'',lastTestMessage:c.lastTestMessage||'',provider:'evolink'};
  }
  function summary(){const c=state.config||load();return`${c.baseUrl||DEFAULT_BASE} · 密钥${maskKey(c.apiKey)} · ${c.imageModel===DEFAULT_MODEL?'Nano Banana 2 Lite':'微调模型 '+(c.imageModel||DEFAULT_MODEL)}`;}
  function log(entry){state.logs.unshift(Object.assign({time:now()},entry||{}));if(state.logs.length>60)state.logs.length=60;}
  async function fetchBounded(url,options={},timeoutMs=LOCAL_HEALTH_TIMEOUT_MS){
    const controller=typeof AbortController!=='undefined'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),Math.max(1000,Number(timeoutMs)||LOCAL_HEALTH_TIMEOUT_MS)):null;
    try{return await fetch(url,Object.assign({},options,controller?{signal:controller.signal}:{}));}
    catch(error){if(error?.name==='AbortError'){const err=new Error(`本地微调通道请求超过 ${Math.round((Number(timeoutMs)||LOCAL_HEALTH_TIMEOUT_MS)/1000)} 秒未响应`);err.code='micro_local_timeout';throw err;}throw error;}
    finally{if(timer)clearTimeout(timer);}
  }

  function close(){document.querySelectorAll('.v23-micro-modal-backdrop').forEach(x=>x.remove());state.modal=null;}
  function ensureStyle(){
    if(document.getElementById('v27-micro-api-style'))return;
    const s=document.createElement('style');s.id='v27-micro-api-style';s.textContent=`
.v23-micro-modal-backdrop{position:fixed;inset:0;z-index:310000;background:rgba(15,23,42,.34);backdrop-filter:blur(18px) saturate(135%);display:grid;place-items:center;padding:24px;animation:v23MicroFade .18s ease-out}
.v23-micro-modal{width:min(740px,calc(100vw - 32px));max-height:min(90vh,920px);overflow:auto;background:rgba(255,255,255,.96);border:1px solid rgba(148,163,184,.28);border-radius:24px;box-shadow:0 28px 80px rgba(15,23,42,.24);padding:24px;color:#111827;animation:v23MicroRise .22s cubic-bezier(.2,.8,.2,1)}
.v23-micro-modal.wide{width:min(1000px,calc(100vw - 32px))}.v23-micro-modal h2{font-size:22px;margin:0 0 18px}.v23-micro-modal p{line-height:1.65}.v23-micro-close{position:sticky;float:right;top:0;width:36px;height:36px;border:0;border-radius:50%;background:#eef2f7;font-size:22px;cursor:pointer;z-index:2}.v23-micro-status{padding:14px 16px;border-radius:14px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;margin-bottom:16px}.v23-micro-status.empty{background:#f8fafc;border-color:#dbe4f0;color:#475569}.v23-micro-field{display:grid;gap:7px;margin:14px 0}.v23-micro-field label{font-weight:650;color:#334155}.v23-micro-field input,.v23-micro-field select{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font-size:15px;background:#fff;outline:none}.v23-micro-field input:focus,.v23-micro-field select:focus{border-color:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.12)}.v23-micro-tip{padding:14px 16px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;margin:14px 0}.v23-micro-recommend{padding:14px 16px;border-radius:14px;background:#eff6ff;border:1px solid #bfdbfe;color:#1e40af;margin:14px 0}.v23-micro-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.v23-micro-actions button{border:0;border-radius:999px;padding:11px 18px;font-weight:700;cursor:pointer}.v23-micro-primary{background:#111!important;color:#fff!important}.v23-micro-secondary{background:#fff!important;border:1px solid #cbd5e1!important;color:#1f2937!important}.v23-micro-danger{background:#fff1f2!important;border:1px solid #fecdd3!important;color:#be123c!important}.v23-micro-test-hero{padding:15px 17px;border-radius:14px;margin-bottom:12px;font-weight:700}.v23-micro-test-hero.ok{background:#ecfdf5;border:1px solid #a7f3d0;color:#047857}.v23-micro-test-hero.bad{background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}.v23-micro-test-hero.warn{background:#fff7ed;border:1px solid #fdba74;color:#9a3412}.v23-micro-test-hero.wait{background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8}.v23-micro-test-card{border:1px solid #dbe2ea;border-radius:16px;padding:15px 16px;margin:10px 0;background:#fff}.v23-micro-test-card b{display:block;margin-bottom:7px}.v23-micro-test-card p{margin:0;color:#64748b;white-space:pre-wrap}.v23-micro-test-card.bad b{color:#b91c1c}.v23-micro-test-card.warn b{color:#9a3412}.v23-micro-solution{padding:16px;border-radius:14px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;line-height:1.7}.v23-micro-logs{display:grid;gap:8px}.v23-micro-log{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px}.v23-micro-log small{color:#64748b}.v23-micro-spinner{width:18px;height:18px;border:2px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;display:inline-block;vertical-align:-4px;margin-right:8px;animation:v23Spin .8s linear infinite}.v27-micro-docs{font-size:12px;color:#475569;margin-top:8px}.v27-micro-docs a{color:#1d4ed8;text-decoration:none}.v27-micro-docs a:hover{text-decoration:underline}@keyframes v23Spin{to{transform:rotate(360deg)}}@keyframes v23MicroFade{from{opacity:0}to{opacity:1}}@keyframes v23MicroRise{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}@media(max-width:640px){.v23-micro-modal-backdrop{padding:8px}.v23-micro-modal{border-radius:18px;padding:18px;max-height:94vh}}
`;document.head.appendChild(s);
  }
  function open(html,wide=false){ensureStyle();close();const bd=document.createElement('div');bd.className='v23-micro-modal-backdrop';bd.innerHTML=`<section class="v23-micro-modal ${wide?'wide':''}" role="dialog" aria-modal="true"><button type="button" class="v23-micro-close" data-v27-micro-close aria-label="关闭">×</button>${html}</section>`;document.body.appendChild(bd);state.modal=bd;setTimeout(()=>bd.querySelector('input,select,button')?.focus(),30);return bd;}
  function optionsHtml(selected=''){const sorted=sortModels(state.config?.models||[]).filter(x=>x.image);if(!sorted.length)return'<option value="gemini-3.1-flash-lite-image">Nano Banana 2 Lite · gemini-3.1-flash-lite-image</option>';return sorted.map(x=>`<option value="${esc(x.id)}" ${x.id===selected?'selected':''}>${esc(x.label)} · ${esc(x.id)}</option>`).join('');}

  function openConfig(message=''){
    const c=state.config||load(),st=status();
    return open(`<h2>微调生成图片 · EvoLink API 接入 V27</h2>
      <div class="v23-micro-status ${st.configured?'':'empty'}">${st.configured?`当前 Base URL：<b>${esc(c.baseUrl)}</b>，密钥状态：<b>${esc(maskKey(c.apiKey))}</b>，微调模型：<b>${esc(c.imageModel)}</b>。`:`V27 已预填 EvoLink Base URL 与 Nano Banana 2 Lite；你只需要填写自己的 API Key，然后执行“API 测试”。`}</div>
      ${message?`<div class="v23-micro-tip">${esc(message)}</div>`:''}
      <div class="v23-micro-field"><label>接口域名 / Base URL</label><input id="v27-micro-base" type="url" value="${esc(c.baseUrl||DEFAULT_BASE)}" placeholder="https://api.evolink.ai/v1" autocomplete="off"></div>
      <div class="v23-micro-field"><label>API 密钥</label><input id="v27-micro-key" type="password" value="${esc(c.apiKey)}" placeholder="请填写你的 EvoLink API Key（发布包不预置）" autocomplete="new-password"></div>
      <div class="v23-micro-field"><label>微调生图模型</label><select id="v27-micro-model-select">${optionsHtml(c.imageModel||DEFAULT_MODEL)}</select></div>
      <div class="v23-micro-field"><label>模型手动输入（高级，可选）</label><input id="v27-micro-model-manual" value="${esc(c.imageModel||DEFAULT_MODEL)}" placeholder="gemini-3.1-flash-lite-image"></div>
      <div class="v23-micro-recommend"><b>默认：Nano Banana 2 Lite</b><br><code>gemini-3.1-flash-lite-image</code>。该模型支持文生图、图生图与图像编辑；微调工作台会把当前图与区域编辑约束通过 EvoLink 图像生成接口提交，并使用异步 task_id 查询结果。<div class="v27-micro-docs"><a href="${esc(DOCS_URL)}" target="_blank" rel="noopener noreferrer">查看 EvoLink Nano Banana 2 Lite 官方文档 ↗</a></div></div>
      <div class="v23-micro-tip">微调通道仍与“AI线框生成 / AI生图”配置隔离，避免修改微调 Key 或模型时影响前面的生成链路；底层统一使用 V27 的 EvoLink 文件通道、Credits 与网络诊断能力。</div>
      <div class="v23-micro-actions"><button class="v23-micro-primary" data-v27-micro-save>保存配置</button><button class="v23-micro-primary" data-v27-micro-load-models>载入生图模型</button><button class="v23-micro-primary" data-v27-micro-run-test>API 测试</button><button class="v23-micro-secondary" data-v27-micro-deep-test>深度网络诊断</button><button class="v23-micro-secondary" data-v27-micro-logs>调试日志</button><button class="v23-micro-secondary v23-micro-danger" data-v27-micro-clear>恢复默认</button><button class="v23-micro-secondary" data-v27-micro-close>关闭</button></div>`);
  }

  function readForm(){
    const current=state.config||load();
    const baseEl=document.getElementById('v27-micro-base')||document.getElementById('v23-micro-base');
    const keyEl=document.getElementById('v27-micro-key')||document.getElementById('v23-micro-key');
    const manualEl=document.getElementById('v27-micro-model-manual')||document.getElementById('v23-micro-model-manual');
    const selectEl=document.getElementById('v27-micro-model-select')||document.getElementById('v23-micro-model-select');
    const base=baseEl?baseEl.value.trim():(current.baseUrl||DEFAULT_BASE);
    const key=keyEl?keyEl.value.trim():(current.apiKey||'');
    const manual=manualEl?manualEl.value.trim():(current.imageModel||DEFAULT_MODEL);
    const selected=selectEl?selectEl.value:'';
    return{baseUrl:normalizeBase(base||DEFAULT_BASE),apiKey:key,imageModel:manual||selected||DEFAULT_MODEL};
  }
  function headers(cfg,extra={}){return Object.assign({'X-Base-Url':cfg.baseUrl||DEFAULT_BASE,'X-API-Key':cfg.apiKey||''},extra);}
  function classifyHttpError(data,status,model){
    const raw=String(data?.error?.message||data?.message||data?.error||data?.raw||`HTTP ${status}`),code=String(data?.error?.code||data?.code||'');
    if(status===402||/insufficient[_\s-]?(?:credits|quota)|insufficient credits|额度不足|余额不足/i.test(raw+' '+code))return`EvoLink 生图额度不足：API 已连接，但账户或 Token Credits 不足。请充值或调整 Token 额度后再执行微调生成。`;
    if(status===401||/unauthorized|invalid.*token/i.test(raw))return'EvoLink API Key 无效或已过期，请重新填写。';
    if(status===403&&/model_access_denied|does not have access|access denied/i.test(raw+' '+code))return`当前 Token 无权使用模型「${model||'当前模型'}」，请调整模型权限或更换模型。`;
    if(/socket hang up|ECONNRESET|connection reset|before secure TLS connection was established|socket disconnected|TLS.*handshake/i.test(raw))return'EvoLink 网络连接发生瞬时 TLS/Socket 抖动。V27.9 会隔离失效代理连接并继续查询同一 task_id；可运行“深度网络诊断”查看权威 EvoLink 路径。';
    return raw;
  }
  async function readResponse(res,model=''){const txt=await res.text();let data={};try{data=txt?JSON.parse(txt):{};}catch(_e){data={raw:txt};}if(!res.ok){const err=new Error(classifyHttpError(data,res.status,model));err.status=res.status;err.data=data;err.channel=data?.error?.channel||data?.channel||'';throw err;}return data;}
  function microPath(url){
    const raw=String(url||'');
    if(!raw.startsWith('/api/'))return raw;
    if(raw.startsWith('/api/micro/'))return raw;
    return '/api/micro/'+raw.slice('/api/'.length);
  }
  async function microFetchJson(url,options={}){
    const cfg=state.config||load(),opt=Object.assign({},options),target=microPath(url),method=String(opt.method||'GET').toUpperCase(),billed=method==='POST'&&/\/api\/micro\/images\/generations(?:\?|$)/.test(target),meta=state.generationMeta||{};
    if(billed&&(!state.generationActive||!state.generationId))throw new Error('微调计费通道拒绝请求：缺少独立 generationId，请从智能区域编辑工作台重新发起生成');
    // V27.9: a billed provider POST is impossible until the direct region -> adjust handoff has
    // synchronously acknowledged the exact generation id. This closes the preflight-only hang and
    // prevents an unacknowledged legacy click path from reaching EvoLink later in the event loop.
    if(billed&&(meta.handoff!=='accepted'||!Number(meta.handoffAcceptedAt))){const err=new Error('微调计费通道拒绝请求：生成器尚未确认流程交接，未发送到 EvoLink');err.code='micro_handoff_not_accepted';throw err;}
    opt.headers=headers(cfg,Object.assign({'Content-Type':'application/json','X-Channel':CHANNEL_NAME,'X-Micro-Generation-Id':state.generationId||'','X-Micro-Conflict-Policy':meta.conflictPolicy||'isolated','X-Micro-Instruction-Fingerprint':meta.instructionFingerprint||'','X-Micro-Handoff-Acknowledged':'1'},opt.headers||{}));
    const res=await fetch(target,opt);
    return readResponse(res,cfg.imageModel);
  }
  function isolationValue(h){const a=h?.generationChannels?.adjust||{},ok=a.endpointPrefix==='/api/micro/'&&a.routeIsolation===true&&a.provider==='evolink-image-micro-adjust'&&a.channelHeader===CHANNEL_NAME;return ok?{ok:true,version:h.version||VERSION,endpointPrefix:a.endpointPrefix,provider:a.provider,keepAlive:a.keepAlive===true}:null;}
  async function health(){const t=performance.now(),res=await fetchBounded('/api/micro/health?micro='+Date.now(),{cache:'no-store',headers:{'X-Channel':CHANNEL_NAME}},LOCAL_HEALTH_TIMEOUT_MS),data=await readResponse(res),isolated=isolationValue(data);if(isolated)state.isolationCache={at:Date.now(),value:isolated};log({ok:true,stage:'本地代理 /api/micro/health',status:res.status,duration:Math.round(performance.now()-t),message:`微调独立代理正常：${data.version||''}`});return data;}
  async function assertIsolation(){if(state.isolationCache&&Date.now()-state.isolationCache.at<ISOLATION_CACHE_MS)return state.isolationCache.value;const h=await health(),value=isolationValue(h);if(!value){const err=new Error('微调通道隔离校验失败：未确认 V27.9 /api/micro/* 独立路由，请不要继续计费生成');err.code='micro_channel_isolation_failed';throw err;}state.isolationCache={at:Date.now(),value};log({ok:true,stage:'微调通道隔离校验',status:200,duration:0,message:`endpointPrefix=${value.endpointPrefix}；routeIsolation=true；keepAlive=${value.keepAlive?'on':'unknown'}；provider=${value.provider}`});return value;}
  async function diagnose(cfg){const t=performance.now(),res=await fetch('/api/micro/diagnose',{method:'POST',headers:headers(cfg,{'Content-Type':'application/json','X-Channel':CHANNEL_NAME,'X-Model':cfg.imageModel||DEFAULT_MODEL}),body:'{}'}),data=await readResponse(res,cfg.imageModel);log({ok:!!data.ok,stage:'EvoLink 基础诊断',status:data.status||res.status,duration:Math.round(performance.now()-t),message:data.message||''});return data;}
  async function deepDiagnose(cfg){const t=performance.now(),res=await fetch('/api/micro/network-diagnose?deep=1',{method:'POST',headers:headers(cfg,{'Content-Type':'application/json','X-Channel':CHANNEL_NAME}),body:'{}'}),data=await readResponse(res,cfg.imageModel);log({ok:!!data.ok,stage:'深度网络诊断',status:res.status,duration:Math.round(performance.now()-t),message:(data.steps||[]).map(x=>(x.ok?'✓ ':'✗ ')+(x.name||'')).join('；')});return data;}
  async function localReferenceCheck(){
    if(!(EVO&&typeof EVO.prepareReferenceSource==='function'))return{ok:false,message:'EvoLink Image Adapter 未加载'};
    const prepared=await EVO.prepareReferenceSource('/assets/wolassen/02.jpg?v=27-micro-preflight');
    const ok=/^data:image\/(?:jpeg|jpg|png|webp|gif);/i.test(String(prepared||''));
    return{ok,message:ok?'内置参考图可读取并转换为 EvoLink 文件上传所需 Data URL。':'本地参考图转换结果异常。'};
  }
  function capabilityFor(data,model){
    const rows=Array.isArray(data?.capabilities)?data.capabilities:[];
    const hit=rows.find(x=>String(x?.id||'')===String(model||''));
    const profile=EVO&&typeof EVO.modelProfile==='function'?EVO.modelProfile(model):null;
    const supports=hit?hit.supportsImageInput!==false:!!(profile&&profile.maxRefs!==0);
    const max=hit&&Number.isFinite(Number(hit.maxInputImages))?Number(hit.maxInputImages):(profile&&Number.isFinite(profile.maxRefs)?profile.maxRefs:null);
    return{found:!!hit,supports,max,raw:hit||profile||null};
  }
  function billingInfo(d){
    const b=d&&d.billing||null;
    if(!b)return{ok:false,message:'未取得 EvoLink /v1/credits 结果，无法确认微调生图额度。'};
    const fmt=v=>Number.isFinite(Number(v))?String(Number(v)):'未知';
    const parts=[`账户剩余 ${fmt(b.userRemaining)} credits`,b.tokenUnlimited?'Token 额度不限':`Token 剩余 ${fmt(b.tokenRemaining)} credits`];
    return{ok:!!(b.checked&&!b.blocked&&d.generationReady!==false),message:(b.blocked?'额度不足：':'额度检查：')+parts.join('；')+(b.blocked?'。请充值或调整 Token 额度。':'。')};
  }
  function modelCheck(d,cfg){
    const cap=capabilityFor(d,cfg.imageModel),listed=(d.models||[]).map(modelName).includes(cfg.imageModel);
    if(!listed&&Array.isArray(d.models)&&d.models.length)return{ok:false,message:`当前 Token 的 EvoLink /models 没有返回模型 ${cfg.imageModel}，请载入模型并选择有权限的图像模型。`,cap};
    if(!cap.supports)return{ok:false,message:`模型 ${cfg.imageModel} 不接受 image_urls 参考图，不能用于智能区域微调。`,cap};
    return{ok:true,message:`模型 ${cfg.imageModel} 已配置为图生图/编辑通道；参考图上限 ${cap.max==null?'由远端决定':cap.max+' 张'}。${cfg.imageModel===DEFAULT_MODEL?' 当前为 Nano Banana 2 Lite 推荐模型。':''}`,cap};
  }

  async function collectDiagnostics(cfg,{includeLocalReference=true}={}){
    const result={local:{ok:false,message:''},external:{ok:false,message:''},billing:{ok:false,message:''},models:{ok:false,message:''},model:{ok:false,message:''},localRef:{ok:false,message:''},raw:null,ready:false,configMissing:!(cfg.baseUrl&&cfg.apiKey&&cfg.imageModel)};
    try{const h=await health();result.local={ok:true,message:`代理正常：${h.version||VERSION}；微调通道=${h.generationChannels?.adjust?.provider||'evolink-image-micro-adjust'}`};}catch(e){result.local={ok:false,message:e.message};}
    if(result.configMissing){result.external={ok:false,message:'Base URL、API Key 或微调模型尚未配置；未发起外部请求。'};return result;}
    if(result.local.ok){
      try{
        const d=await diagnose(cfg);result.raw=d;result.external={ok:!!d.ok,message:d.message||(d.ok?'EvoLink 基础链路正常':'EvoLink 基础链路失败')};
        result.billing=billingInfo(d);
        const modelRows=Array.isArray(d.models)?d.models:[],catalogLive=/evolink-models-(?:live|cache)/i.test(String(d.modelCatalogSource||''));
        result.models={ok:modelRows.length>0&&catalogLive,message:modelRows.length?(catalogLive?`EvoLink /models 实时/缓存目录可用：${modelRows.length} 个模型；能力目录 ${Array.isArray(d.capabilities)?d.capabilities.length:0} 项。`:`仅取得内置兜底模型目录（${modelRows.length} 个），不能证明 EvoLink /models 当前连通。请先修复网络通道。`):'未取得 EvoLink 模型目录。'};
        result.model=modelCheck(d,cfg);
        if(modelRows.length){save({models:[...new Set([DEFAULT_MODEL,...modelRows.map(modelName).filter(Boolean)])]});if(EVO&&typeof EVO.ingestRemoteModels==='function')EVO.ingestRemoteModels(modelRows);}
      }catch(e){result.external={ok:false,message:e.message};}
    }else result.external={ok:false,message:'本地代理未连接，无法测试 EvoLink。'};
    if(includeLocalReference){try{result.localRef=await localReferenceCheck();}catch(e){result.localRef={ok:false,message:e.message};}}
    result.ready=result.local.ok&&result.external.ok&&result.billing.ok&&result.models.ok&&result.model.ok&&(!includeLocalReference||result.localRef.ok);
    return result;
  }

  async function loadModels(){
    const draft=readForm(),cfg=Object.assign({},state.config||load(),draft);
    if(!cfg.baseUrl||!cfg.apiKey)throw new Error('请先填写 API 密钥');
    const t=performance.now();let raw=[],statusCode=200,fallback='';
    try{const res=await fetch('/api/micro/models',{method:'GET',headers:headers(cfg),cache:'no-store'});statusCode=res.status;const data=await readResponse(res,cfg.imageModel);raw=Array.isArray(data)?data:(data.data||data.models||[]);}catch(e){if(!(EVO&&EVO.isEvolinkBase(cfg.baseUrl)))throw e;fallback=e.message||'远端模型目录不可用';}
    if(!raw.length&&EVO&&EVO.isEvolinkBase(cfg.baseUrl))raw=EVO.BUILTIN_IMAGE_MODELS.map(id=>({id,supported_endpoints:['/v1/images/generations'],output_modalities:['image']}));
    const sorted=sortModels(raw).filter(x=>x.image),models=[...new Set([DEFAULT_MODEL,...sorted.map(x=>x.id)])];
    let model=cfg.imageModel||DEFAULT_MODEL;if(!models.includes(model))model=models.includes(DEFAULT_MODEL)?DEFAULT_MODEL:(sorted.find(x=>x.strong)?.id||models[0]||DEFAULT_MODEL);
    save({baseUrl:cfg.baseUrl,apiKey:cfg.apiKey,imageModel:model,models});
    log({ok:true,stage:'载入生图模型',status:statusCode,duration:Math.round(performance.now()-t),message:`共 ${models.length} 个图像模型${fallback?'（使用内置目录兜底）':''}`});
    openConfig(`已载入 ${models.length} 个图像模型。默认推荐 Nano Banana 2 Lite；当前选择「${model}」。${fallback?' 远端模型目录暂不可用，当前使用 V27 内置目录。':''}`);
    return models;
  }

  function testCard(title,item){return `<div class="v23-micro-test-card ${item.ok?'':'bad'}"><b>${item.ok?'✅':'❌'} ${esc(title)}</b><p>${esc(item.message||'')}</p></div>`;}
  function testResultHtml(r){
    let hero='';
    if(r.ready)hero='<div class="v23-micro-test-hero ok">✅ 微调生图前置检查通过。Nano Banana / 当前图生图模型、Credits、文件基础通道与本地参考图均可用；本测试不会创建计费生图任务。</div>';
    else if(r.configMissing)hero='<div class="v23-micro-test-hero bad">⚠ 尚未完成微调 API 配置。Base URL 和 Nano Banana 2 Lite 已预填，请填写 API Key。</div>';
    else if(r.external.ok&&!r.billing.ok)hero='<div class="v23-micro-test-hero warn">⚠ API 可以连接，但当前 Credits 不满足生图条件。</div>';
    else hero='<div class="v23-micro-test-hero bad">❌ 微调生成 API 前置检查未通过，请根据失败项处理。</div>';
    const solution=!r.ready?`<div class="v23-micro-solution"><b>处理建议：</b><br>① API Key / 401：重新填写 EvoLink Key。<br>② Credits：充值或提高 Token Credits。<br>③ 模型能力：优先使用 <code>${DEFAULT_MODEL}</code>。<br>④ files-api / socket hang up：运行“深度网络诊断”，检查 stream/Base64 与代理/直连轨迹。<br>⑤ 当前测试不会提交 <code>/v1/images/generations</code>，不会产生生图费用。</div>`:'';
    return `<h2>微调生成图片 · API 测试结果 V27.9</h2>${hero}${testCard('本地代理 /api/health',r.local)}${testCard('EvoLink API / 文件基础通道',r.external)}${testCard('账户 Credits / 生图额度',r.billing)}${testCard('模型目录 / 动态能力',r.models)}${testCard('当前微调模型图生图能力',r.model)}${testCard('本地参考图转换',r.localRef)}${solution}<div class="v23-micro-actions"><button class="v23-micro-primary" data-v27-micro-config>API 配置</button><button class="v23-micro-secondary" data-v27-micro-deep-test>深度网络诊断</button><button class="v23-micro-secondary" data-v27-micro-logs>调试日志</button><button class="v23-micro-secondary" data-v27-micro-close>关闭</button></div>`;
  }

  async function runTest(){
    const cfg=state.config||load();
    open(`<h2>微调生成图片 · API 测试结果 V27.9</h2><div class="v23-micro-test-hero wait"><span class="v23-micro-spinner"></span>正在执行完整诊断：本地代理、EvoLink 鉴权、Credits、files quota、模型能力与参考图转换……</div>`,true);
    const r=await collectDiagnostics(cfg),testedAt=Date.now();
    save({lastTestOk:r.ready,lastTestAt:now(),lastTestMessage:r.ready?'微调生图完整诊断通过':(r.model.message||r.billing.message||r.external.message),models:r.raw?.models?.length?[...new Set([DEFAULT_MODEL,...r.raw.models.map(modelName).filter(Boolean)])]:cfg.models});
    state.lastTest=r;
    if(r.ready){const fp=fingerprint(state.config||cfg);state.testCache={fingerprint:fp,at:testedAt,source:'api-test'};state.creditCache={fingerprint:fp,at:testedAt,info:r.raw?.billing||null,source:'full-diagnostic'};state.creditReadyAt=testedAt;state.preflightReadyAt=testedAt;state.lastPreflight={mode:'api-test-full-diagnostic',at:testedAt,durationMs:0};}
    else{state.testCache=null;state.creditCache=null;state.creditReadyAt=0;state.preflightReadyAt=0;}
    open(testResultHtml(r),true);return r;
  }

  async function runDeepTest(){
    const cfg=state.config||load();if(!cfg.apiKey){openConfig('请先填写 API Key，再执行深度网络诊断。');return null;}
    open(`<h2>微调生成图片 · 深度网络诊断 V27.9</h2><div class="v23-micro-test-hero wait"><span class="v23-micro-spinner"></span>正在检测辅助公网探针与权威 EvoLink API、files-api，并执行不计费的参考图上传链路测试……</div>`,true);
    try{
      const d=await deepDiagnose(cfg),rows=Array.isArray(d.steps)?d.steps:[],ok=!!d.ok,warning=ok&&d.warning===true;
      const heroClass=ok?(warning?'warn':'ok'):'bad',heroText=ok?(warning?'⚠ 权威 EvoLink 路径已通过；仅辅助 Apifox 探针存在警告，不影响当前微调链路。':'✅ 深度网络诊断通过：权威 EvoLink API、文件服务与参考图上传路径均可用。'):'❌ 深度网络诊断发现权威 EvoLink 路径异常：请查看失败项。';
      open(`<h2>微调生成图片 · 深度网络诊断 V27.9</h2><div class="v23-micro-test-hero ${heroClass}">${heroText}</div>${rows.map(x=>{const severity=String(x.severity||'');const warn=!x.ok&&(x.required===false||severity==='warning');return`<div class="v23-micro-test-card ${x.ok?'':warn?'warn':'bad'}"><b>${x.ok?'✅':warn?'⚠':'❌'} ${esc(x.name||'诊断步骤')}</b><p>${esc(x.message||'')}${x.trace&&x.trace.length?'\n轨迹：'+esc(JSON.stringify(x.trace).slice(0,1400)):''}</p></div>`;}).join('')}<div class="v23-micro-tip">判定以实际 EvoLink /models、文件服务和参考图上传为准。Apifox 只是辅助控制探针；本诊断不会创建 Nano Banana 2 Lite 生图任务。</div><div class="v23-micro-actions"><button class="v23-micro-primary" data-v27-micro-run-test>返回 API 测试</button><button class="v23-micro-secondary" data-v27-micro-logs>调试日志</button><button class="v23-micro-secondary" data-v27-micro-close>关闭</button></div>`,true);return d;
    }catch(e){log({ok:false,stage:'深度网络诊断',status:e.status||0,message:e.message});open(`<h2>微调生成图片 · 深度网络诊断 V27.9</h2><div class="v23-micro-test-hero bad">❌ ${esc(e.message)}</div><div class="v23-micro-actions"><button class="v23-micro-secondary" data-v27-micro-config>API 配置</button><button class="v23-micro-secondary" data-v27-micro-close>关闭</button></div>`,true);return null;}
  }

  function fingerprint(cfg){return JSON.stringify([normalizeBase(cfg?.baseUrl||''),String(cfg?.apiKey||'').trim(),String(cfg?.imageModel||'').trim()]);}
  function performanceMeter(){return window.MicroPerformanceMeterV276||window.MicroPerformanceMeterV275||window.MicroPerformanceMeterV274||null;}
  function notePreflight(mode,durationMs,extra={}){state.lastPreflight=Object.assign({mode,at:Date.now(),durationMs:Math.max(0,Math.round(durationMs||0))},extra||{});try{performanceMeter()?.annotate?.({preflightMode:mode,diagnosticCacheAgeMs:extra.diagnosticCacheAgeMs||0,creditCacheAgeMs:extra.creditCacheAgeMs||0});}catch(_e){}return state.lastPreflight;}
  async function ensureLightCredits(cfg){
    const fp=fingerprint(cfg),current=Date.now(),hit=state.creditCache&&state.creditCache.fingerprint===fp&&current-state.creditCache.at<CREDIT_FRESH_MS;
    if(hit){state.creditReadyAt=state.creditCache.at;state.preflightReadyAt=state.creditCache.at;log({ok:true,stage:'微调轻量额度检查',status:200,duration:0,message:`60 秒额度缓存命中；age=${current-state.creditCache.at}ms`});return{cached:true,info:state.creditCache.info||null,at:state.creditCache.at};}
    const t=performance.now();let info=null;
    if(EVO&&typeof EVO.ensureGenerationCredits==='function')info=await EVO.ensureGenerationCredits(microFetchJson,{model:cfg.imageModel,stage:'V27.9 微调轻量额度检查',channel:CHANNEL_NAME});
    else{const raw=await microFetchJson('/api/credits',{method:'GET'});info=raw;}
    const at=Date.now();state.creditCache={fingerprint:fp,at,info,source:'light-credits'};state.creditReadyAt=at;state.preflightReadyAt=at;
    log({ok:true,stage:'微调轻量额度检查',status:200,duration:Math.round(performance.now()-t),message:info&&info.checked===false?'Credits 响应未包含可识别余额，已完成一次轻量检查并交由实际生图接口最终确认':'Credits 轻量检查通过；60 秒内直接复用'});
    return{cached:false,info,at};
  }
  async function preflight(opts={}){
    const started=performance.now(),cfg=state.config||load();
    if(!cfg.baseUrl||!cfg.apiKey||!cfg.imageModel){if(opts.showOnError!==false)openConfig('请先填写 API Key；Base URL 与 Nano Banana 2 Lite 已预配置。');throw new Error('微调生成 API 尚未完成配置');}
    const fp=fingerprint(cfg),nowMs=Date.now(),diagnosticHit=state.testCache&&state.testCache.fingerprint===fp&&nowMs-state.testCache.at<TEST_CACHE_MS;
    if(diagnosticHit){
      const credit=await ensureLightCredits(cfg),mode=credit.cached?'diagnostic-cache+credit-cache':'diagnostic-cache+light-credits',duration=Math.round(performance.now()-started);
      notePreflight(mode,duration,{diagnosticCacheAgeMs:nowMs-state.testCache.at,creditCacheAgeMs:Date.now()-credit.at});
      log({ok:true,stage:'微调生成预检',status:200,duration,message:`完整诊断缓存命中；${credit.cached?'Credits 60 秒缓存命中':'仅执行轻量 Credits 请求'}；未访问 /models 或 files quota`});
      return true;
    }
    const reason=state.testCache&&state.testCache.fingerprint===fp?'cache-expired':(state.lastPreflight?.mode==='config-changed'?'config-changed':'cold-start');
    const r=await collectDiagnostics(cfg,{includeLocalReference:true});
    if(r.ready){
      const readyAt=Date.now();save({lastTestOk:true,lastTestAt:now(),lastTestMessage:'微调生图完整诊断通过'});
      state.testCache={fingerprint:fp,at:readyAt,source:reason};state.creditCache={fingerprint:fp,at:readyAt,info:r.raw?.billing||null,source:'full-diagnostic'};state.creditReadyAt=readyAt;state.preflightReadyAt=readyAt;
      const duration=Math.round(performance.now()-started),mode=`full-diagnostic:${reason}`;notePreflight(mode,duration,{diagnosticCacheAgeMs:0,creditCacheAgeMs:0});
      log({ok:true,stage:'微调生成预检',status:200,duration,message:`执行完整诊断（${reason}）：/models + files quota + Credits；结果缓存 ${TEST_CACHE_MS/1000} 秒`});return true;
    }
    const message=!r.local.ok?r.local.message:!r.external.ok?r.external.message:!r.billing.ok?r.billing.message:!r.models.ok?r.models.message:!r.model.ok?r.model.message:r.localRef.message;
    save({lastTestOk:false,lastTestAt:now(),lastTestMessage:message});state.testCache=null;state.creditCache=null;state.creditReadyAt=0;state.preflightReadyAt=0;notePreflight(`full-diagnostic-failed:${reason}`,Math.round(performance.now()-started));
    if(opts.showOnError!==false)open(testResultHtml(r),true);
    throw new Error(message||'微调生图前置检查失败');
  }

  function openLogs(){const rows=state.logs.length?state.logs.map(x=>`<div class="v23-micro-log"><b>${x.ok?'✓':'✗'} ${esc(x.stage||'请求')} · HTTP ${esc(String(x.status??'-'))}</b><div>${esc(x.message||'')}</div><small>${esc(x.time||'')} · ${esc(String(x.duration??'-'))} ms</small></div>`).join(''):'<p>暂无微调 API 日志。执行“API 测试 / 深度网络诊断 / 微调生成”后会显示。</p>';open(`<h2>微调生成图片 · 调试日志 V27.9</h2><div class="v23-micro-logs">${rows}</div><div class="v23-micro-actions"><button class="v23-micro-secondary v23-micro-danger" data-v27-micro-clear-logs>清空日志</button><button class="v23-micro-secondary" data-v27-micro-close>关闭</button></div>`,true);}

  function dataUrlBlob(dataUrl){const p=String(dataUrl||'').split(','),meta=p[0]||'',bin=atob(p[1]||''),arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return new Blob([arr],{type:(meta.match(/data:([^;]+)/)||[])[1]||'image/png'});}
  function sizeValue(aspect){if(/^\d+x\d+$/.test(String(aspect||'')))return aspect;return'1024x1024';}
  function extractImages(data){const arr=Array.isArray(data)?data:(data?.data||data?.images||data?.output||data?.results||[]);const out=[];for(const item of Array.isArray(arr)?arr:[arr]){if(!item)continue;if(typeof item==='string')out.push(item);else{const u=item.url||item.image_url||item.image||item.src,b=item.b64_json||item.base64||item.b64;if(u)out.push(u);else if(b)out.push(String(b).startsWith('data:')?b:'data:image/png;base64,'+b);}}return out;}
  function handleTaskUpdate(update){
    try{performanceMeter()?.recordTask?.(update);}catch(_e){}
    const status=EVO&&typeof EVO.normalizeTaskStatus==='function'?EVO.normalizeTaskStatus(update):String(update?.status||'pending'),meta=state.generationMeta||{};
    meta.taskStates=Array.isArray(meta.taskStates)?meta.taskStates:[];
    if(meta.lastTaskStatus!==status){meta.lastTaskStatus=status;meta.taskStates.push({status,at:Date.now(),taskId:String(update?.taskId||'')});log({ok:!['failed','timeout'].includes(status),stage:'EvoLink 任务状态',status:200,duration:0,message:`${meta.taskStates.map(x=>x.status).join(' → ')}${update?.taskId?'；task_id='+update.taskId:''}`});}
    if(update?.softTimeoutReached&&!meta.softTimeoutLogged){meta.softTimeoutLogged=true;log({ok:true,stage:'EvoLink 同任务持续查询',status:200,duration:Number(update.elapsedMs)||0,message:`已超过 ${Math.round(MICRO_TASK_SOFT_TIMEOUT_MS/1000)} 秒软阈值，继续查询同一 task_id；不会重复提交计费任务`});}
    if(Number(update?.pollRetryCount)>Number(meta.pollRetryCount||0)){meta.pollRetryCount=Number(update.pollRetryCount)||0;log({ok:true,stage:'EvoLink 任务查询网络恢复',status:200,duration:Number(update.networkStallMs)||0,message:`任务 GET 已安全重试 ${meta.pollRetryCount} 次；仍使用同一 task_id，不会重复计费`});}
  }
  function handleProviderPerformance(perf){
    try{performanceMeter()?.mergeProvider?.(perf);}catch(_e){}
    const path=Array.isArray(perf?.taskStates)?[...new Set(perf.taskStates.map(x=>x.status).filter(Boolean))].join(' → '):'';
    log({ok:true,stage:'微调性能分段',status:200,duration:perf.totalMs,message:`refs=${perf.refCount}；upload=${perf.uploadMs??perf.prepareUploadMs}ms；submit=${perf.submitMs}ms；providerQueue=${perf.providerQueueMs||0}ms；generation=${perf.generationMs||0}ms；result=${perf.resultMs||0}ms；credits=${perf.creditsSkipped?'cached':perf.creditsMs+'ms'}${path?'；task='+path:''}${perf.softTimeoutReached?'；soft-timeout=continued-same-task':''}${perf.pollRetryCount?'；poll-retries='+perf.pollRetryCount:''}${perf.networkStallMs?'；network-stall='+perf.networkStallMs+'ms':''}`});
  }

  async function microEditMulti(prompt,imageDataUrls,count,aspect){
    const cfg=state.config||load();if(!cfg.baseUrl||!cfg.apiKey||!cfg.imageModel)throw new Error('独立微调 API 尚未配置');const urls=(imageDataUrls||[]).filter(Boolean);if(!urls.length)throw new Error('没有可用于微调的图片');
    if(state.generationFatalError)throw state.generationFatalError;
    try{
      if(EVO&&EVO.isEvolinkBase(cfg.baseUrl)){const t=performance.now(),images=await EVO.generate({fetchJson:microFetchJson,prompt,model:cfg.imageModel,count:MICRO_COUNT,aspect,refs:urls,resolution:'1K',quality:'medium',pollSoftTimeoutMs:MICRO_TASK_SOFT_TIMEOUT_MS,pollTimeoutMs:MICRO_TASK_TIMEOUT_MS,pollMaxTimeoutMs:MICRO_TASK_MAX_TIMEOUT_MS,pollRetryAttempts:MICRO_TASK_RETRY_ATTEMPTS,uploadConcurrency:2,skipCreditsCheck:Date.now()-state.creditReadyAt<CREDIT_FRESH_MS,onTaskUpdate:handleTaskUpdate,onPerformance:handleProviderPerformance,meta:{model:cfg.imageModel,stage:'V27.9 智能区域微调 · EvoLink',channel:CHANNEL_NAME,generationId:state.generationId}});log({ok:true,stage:'EvoLink 微调生成',status:200,duration:Math.round(performance.now()-t),message:`模型 ${cfg.imageModel} 返回 ${images.length} 张图片；微调工作台固定单结果，避免候选串行造成长时间等待`});return images;}
      const fd=new FormData();fd.append('model',cfg.imageModel);fd.append('prompt',prompt);fd.append('n','1');fd.append('size',sizeValue(aspect));urls.forEach((u,i)=>fd.append(urls.length===1?'image':'image[]',dataUrlBlob(u),`image-${i+1}.png`));const res=await fetch('/api/micro/images/edits',{method:'POST',headers:headers(cfg,{'X-Channel':CHANNEL_NAME}),body:fd}),data=await readResponse(res,cfg.imageModel),images=extractImages(data);if(!images.length)throw new Error('微调接口未返回可用图片');return images;
    }catch(error){state.generationFatalError=error;throw error;}
  }
  async function microEditMask(prompt,imageDataUrl,maskDataUrl,count,aspect){
    const cfg=state.config||load();if(!cfg.baseUrl||!cfg.apiKey||!cfg.imageModel)throw new Error('独立微调 API 尚未配置');
    if(state.generationFatalError)throw state.generationFatalError;
    try{
      if(EVO&&EVO.isEvolinkBase(cfg.baseUrl)){const t=performance.now(),images=await EVO.generate({fetchJson:microFetchJson,prompt,model:cfg.imageModel,count:MICRO_COUNT,aspect,refs:[imageDataUrl].filter(Boolean),mask:maskDataUrl,resolution:'1K',quality:'medium',pollSoftTimeoutMs:MICRO_TASK_SOFT_TIMEOUT_MS,pollTimeoutMs:MICRO_TASK_TIMEOUT_MS,pollMaxTimeoutMs:MICRO_TASK_MAX_TIMEOUT_MS,pollRetryAttempts:MICRO_TASK_RETRY_ATTEMPTS,uploadConcurrency:2,skipCreditsCheck:Date.now()-state.creditReadyAt<CREDIT_FRESH_MS,onTaskUpdate:handleTaskUpdate,onPerformance:handleProviderPerformance,meta:{model:cfg.imageModel,stage:'V27.9 智能区域微调 · Mask',channel:CHANNEL_NAME,generationId:state.generationId}});log({ok:true,stage:'EvoLink Mask 编辑',status:200,duration:Math.round(performance.now()-t),message:`模型 ${cfg.imageModel} 返回 ${images.length} 张图片`});return images;}
      const fd=new FormData();fd.append('model',cfg.imageModel);fd.append('prompt',prompt);fd.append('n','1');fd.append('size',sizeValue(aspect));fd.append('image',dataUrlBlob(imageDataUrl),'image.png');fd.append('mask',dataUrlBlob(maskDataUrl),'mask.png');const res=await fetch('/api/micro/images/edits',{method:'POST',headers:headers(cfg,{'X-Channel':CHANNEL_NAME}),body:fd}),data=await readResponse(res,cfg.imageModel),images=extractImages(data);if(!images.length)throw new Error('Mask 微调接口未返回可用图片');return images;
    }catch(error){state.generationFatalError=error;throw error;}
  }

  function beginGeneration(meta={}){
    if(state.generationActive){const age=Date.now()-Number(state.generationMeta?.startedAt||0);if(age>MICRO_RUN_STALE_MS)abortGeneration('stale-session-recovered');else{const err=new Error('上一项独立微调会话仍在运行，本次未重复提交');err.code='micro_generation_session_busy';throw err;}}
    state.generationActive=true;state.generationFatalError=null;state.generationId='micro_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);state.generationMeta=Object.assign({startedAt:Date.now(),channel:CHANNEL_NAME,taskStates:[],lastTaskStatus:'',handoff:'waiting',handoffAcceptedAt:0},meta||{});try{performanceMeter()?.annotate?.({generationId:state.generationId,channel:CHANNEL_NAME,handoffStatus:'waiting'});}catch(_e){}log({ok:true,stage:'微调生成会话隔离',status:200,duration:0,message:`generationId=${state.generationId}；conflictPolicy=${state.generationMeta.conflictPolicy||'isolated'}；instruction=${state.generationMeta.instructionFingerprint||'none'}`});return state.generationId;
  }
  function acknowledgeGeneration(generationId,meta={}){
    const id=String(generationId||'');
    if(!state.generationActive||!state.generationId||id!==state.generationId){const err=new Error('微调流程交接确认失败：generationId 与当前独立会话不一致');err.code='micro_handoff_generation_mismatch';throw err;}
    const acceptedAt=Date.now();
    state.generationMeta=Object.assign({},state.generationMeta||{},meta||{},{handoff:'accepted',handoffAcceptedAt:acceptedAt});
    try{performanceMeter()?.annotate?.({generationId:id,handoffStatus:'accepted',handoffAcceptedAt:acceptedAt});}catch(_e){}
    log({ok:true,stage:'微调流程交接确认',status:200,duration:0,message:`generationId=${id}；sessionId=${state.generationMeta.performanceSessionId||state.generationMeta.sessionId||'none'}；计费 POST 已解锁`});
    return{ok:true,generationId:id,acceptedAt};
  }
  function abortGeneration(reason='settled'){if(state.generationMeta)state.generationMeta.endedAt=Date.now();log({ok:true,stage:'微调生成会话结束',status:200,duration:0,message:`generationId=${state.generationId||'none'}；reason=${reason}`});state.generationActive=false;state.generationFatalError=null;state.generationId='';state.generationMeta=null;}


  load();applyV29ManagedRuntime();document.addEventListener('v29-runtime-ready',applyV29ManagedRuntime);ensureStyle();
  const originalMulti=window.apiImageEditMulti;
  if(typeof originalMulti==='function'&&!originalMulti.__v27MicroIsolated){const wrapped=async function(prompt,model,images,count,aspect){if(state.generationActive)return microEditMulti(prompt,images,count,aspect);return originalMulti.apply(this,arguments);};wrapped.__v27MicroIsolated=true;wrapped.__v23MicroIsolated=true;wrapped.__v23Original=originalMulti;window.apiImageEditMulti=wrapped;try{apiImageEditMulti=wrapped;}catch(_e){}}
  const originalMask=window.apiImageEditNativeMask;
  if(typeof originalMask==='function'&&!originalMask.__v27MicroIsolated){const wrapped=async function(prompt,model,image,mask,count,aspect){if(state.generationActive)return microEditMask(prompt,image,mask,count,aspect);return originalMask.apply(this,arguments);};wrapped.__v27MicroIsolated=true;wrapped.__v23MicroIsolated=true;wrapped.__v23Original=originalMask;window.apiImageEditNativeMask=wrapped;try{apiImageEditNativeMask=wrapped;}catch(_e){}}
  const originalGenerate=window.adjustGenerateCandidates;
  if(typeof originalGenerate==='function'&&!originalGenerate.__v27MicroIsolated){const wrapped=async function(){try{return await originalGenerate.apply(this,arguments);}finally{if(state.generationActive)abortGeneration('generation-handler-settled');}};wrapped.__v27MicroIsolated=true;wrapped.__v23MicroIsolated=true;wrapped.__v23Original=originalGenerate;window.adjustGenerateCandidates=wrapped;try{adjustGenerateCandidates=wrapped;}catch(_e){}}

  // V27 存在 data-v24 与 __V23 名称错位，导致界面永远显示“未配置”。V27 同时接管新旧 selector，保证升级兼容。
  window.addEventListener('click',e=>{
    const cfg=e.target?.closest?.('[data-v27-micro-api-config],[data-v24-micro-api-config],[data-v23-micro-api-config]');
    const test=e.target?.closest?.('[data-v27-micro-api-test],[data-v24-micro-api-test],[data-v23-micro-api-test]');
    if(!cfg&&!test)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();document.querySelectorAll('[data-v201-interface-menu]').forEach(x=>x.hidden=true);if(cfg)openConfig();else runTest();
  },true);

  document.addEventListener('click',async e=>{
    if(!e.target?.closest?.('.v23-micro-modal-backdrop'))return;
    const t=e.target.closest('[data-v27-micro-close],[data-v27-micro-save],[data-v27-micro-load-models],[data-v27-micro-run-test],[data-v27-micro-config],[data-v27-micro-deep-test],[data-v27-micro-logs],[data-v27-micro-clear],[data-v27-micro-clear-logs],[data-v23-micro-close],[data-v23-micro-save],[data-v23-micro-load-models],[data-v23-micro-run-test],[data-v23-micro-config],[data-v23-micro-logs],[data-v23-micro-clear],[data-v23-micro-clear-logs]');
    if(!t){if(e.target.classList.contains('v23-micro-modal-backdrop'))close();return;}
    e.preventDefault();e.stopImmediatePropagation();
    try{
      if(t.matches('[data-v27-micro-close],[data-v23-micro-close]'))close();
      else if(t.matches('[data-v27-micro-save],[data-v23-micro-save]')){save(readForm());openConfig('配置已保存。建议立即执行“API 测试”。');}
      else if(t.matches('[data-v27-micro-load-models],[data-v23-micro-load-models]'))await loadModels();
      else if(t.matches('[data-v27-micro-run-test],[data-v23-micro-run-test]')){save(readForm());await runTest();}
      else if(t.matches('[data-v27-micro-config],[data-v23-micro-config]'))openConfig();
      else if(t.matches('[data-v27-micro-deep-test]'))await runDeepTest();
      else if(t.matches('[data-v27-micro-logs],[data-v23-micro-logs]'))openLogs();
      else if(t.matches('[data-v27-micro-clear],[data-v23-micro-clear]')){save(defaults());openConfig('已恢复 EvoLink 默认 Base URL 与 Nano Banana 2 Lite；API Key 已清空。');}
      else if(t.matches('[data-v27-micro-clear-logs],[data-v23-micro-clear-logs]')){state.logs=[];openLogs();}
    }catch(err){log({ok:false,stage:'界面操作',status:err.status||0,message:err.message});openConfig(err.message);}
  },true);
  document.addEventListener('change',e=>{if(e.target?.id==='v27-micro-model-select'||e.target?.id==='v23-micro-model-select'){if(e.target.value){const manual=document.getElementById('v27-micro-model-manual')||document.getElementById('v23-micro-model-manual');if(manual)manual.value=e.target.value;}}},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('.v23-micro-modal-backdrop')){e.preventDefault();close();}},true);

  const bridge={version:VERSION,provider:'evolink',defaultBase:DEFAULT_BASE,defaultModel:DEFAULT_MODEL,docsUrl:DOCS_URL,getConfig:()=>Object.assign({},state.config||load()),status,summary,save,openConfig,openTest:runTest,runDeepTest,preflight,loadModels,assertIsolation,beginGeneration,acknowledgeGeneration,abortGeneration,isGenerationActive:()=>state.generationActive,logs:()=>state.logs.slice(),close,diagnostics:()=>({version:VERSION,storageKey:STORAGE_KEY,isolated:true,endpointPrefix:'/api/micro/',generationCount:MICRO_COUNT,pollSoftTimeoutMs:MICRO_TASK_SOFT_TIMEOUT_MS,pollTimeoutMs:MICRO_TASK_TIMEOUT_MS,pollMaxTimeoutMs:MICRO_TASK_MAX_TIMEOUT_MS,pollRetryAttempts:MICRO_TASK_RETRY_ATTEMPTS,sameTaskPolling:true,proxyTlsRecovery:true,diagnosticAdvisoryProbes:true,microRunStaleMs:MICRO_RUN_STALE_MS,preflightCacheMs:TEST_CACHE_MS,creditFreshMs:CREDIT_FRESH_MS,diagnosticCacheAgeMs:state.testCache?Date.now()-state.testCache.at:null,creditCacheAgeMs:state.creditCache?Date.now()-state.creditCache.at:null,lastPreflight:state.lastPreflight,uploadConcurrency:2,adaptivePolling:true,fastReferencePlan:true,referencePlan:'source+layout-mask-guide+text-fidelity-v280',performanceMeter:true,directHandoff:true,handoffAcknowledgementGate:true,handoffAckMode:'synchronous-before-provider',handoffTimeoutMs:0,localHealthTimeoutMs:LOCAL_HEALTH_TIMEOUT_MS,status:status(),defaultBase:DEFAULT_BASE,defaultModel:DEFAULT_MODEL,docsUrl:DOCS_URL,generationActive:state.generationActive,generationId:state.generationId,generationMeta:state.generationMeta,channelName:CHANNEL_NAME,logCount:state.logs.length})};
  window.__V27_MICRO_API__=bridge;
  window.__V24_MICRO_API__=bridge; // V26 region-workbench compatibility
  window.__V23_MICRO_API__=bridge; // V23 historical compatibility
  emitChange();
})();
