
/* ===== V26 EvoLink 共享图像 API + 本地参考图预处理修复 =====
   修复目标：
   1. 通过本地 WebUI 代理请求 API，避免浏览器 CORS 导致 Failed to fetch。
   2. 预接入 EvoLink 官方 API Base URL；API Key 强制留空，由用户在本机填写，不写入发布包。
   3. 增加 /api/health、/api/diagnose、/models 诊断，定位代理/网络/密钥/模型问题。
*/
const EVO_IMAGE = window.EvoLinkImageAdapter || null;
const API_DEFAULT_BASE = EVO_IMAGE ? EVO_IMAGE.DEFAULT_BASE : "https://api.evolink.ai/v1";
const API_DEFAULT_KEY = "";
const API_DEFAULT_IMAGE_MODEL = EVO_IMAGE ? EVO_IMAGE.DEFAULT_MODEL : "gemini-3.1-flash-lite-image";
const API_V258_MIGRATION_KEY='api_v258_evolink_migrated';
function normalizeSharedImageBase(value){return EVO_IMAGE&&EVO_IMAGE.normalizeEvolinkBase?EVO_IMAGE.normalizeEvolinkBase(value):String(value||API_DEFAULT_BASE).trim().replace(/\/+$/,'');}
(function migrateSharedImageProviderToEvoLink(){
  if(localStorage.getItem(API_V258_MIGRATION_KEY)==='1')return;
  const oldBase=String(localStorage.getItem('api_base_url')||'').trim();
  const providerChanged=!oldBase || /api\.ofox\.ai/i.test(oldBase) || /evolink\.ai\/docs\//i.test(oldBase) || /api\.example\.com/i.test(oldBase);
  if(providerChanged){
    localStorage.setItem('api_base_url',API_DEFAULT_BASE);
    localStorage.setItem('api_key','');
    localStorage.setItem('api_wire_model',API_DEFAULT_IMAGE_MODEL);
    localStorage.setItem('api_image_model',API_DEFAULT_IMAGE_MODEL);
    localStorage.setItem('api_models',JSON.stringify(EVO_IMAGE?EVO_IMAGE.BUILTIN_IMAGE_MODELS:[API_DEFAULT_IMAGE_MODEL]));
  }
  localStorage.setItem(API_V258_MIGRATION_KEY,'1');
})();
let __savedApiModels=[];try{__savedApiModels=JSON.parse(localStorage.getItem('api_models')||'[]');}catch(_e){__savedApiModels=[];}
if(!Array.isArray(__savedApiModels)||!__savedApiModels.length)__savedApiModels=EVO_IMAGE?EVO_IMAGE.BUILTIN_IMAGE_MODELS.slice():[API_DEFAULT_IMAGE_MODEL];

const API_BRIDGE = {
  baseUrl: normalizeSharedImageBase(localStorage.getItem('api_base_url') || API_DEFAULT_BASE),
  apiKey: localStorage.getItem('api_key') || API_DEFAULT_KEY,
  models: __savedApiModels,
  wireModel: localStorage.getItem('api_wire_model') || API_DEFAULT_IMAGE_MODEL,
  imageModel: localStorage.getItem('api_image_model') || API_DEFAULT_IMAGE_MODEL,
  copyModel: localStorage.getItem('api_copy_model') || '',
  ready: false,
  proxyReady: false,
  lastDiag: null,
  modelCapabilities: []
};
/* ===== API 调试日志 ===== */
const API_DBG=[];
function dbgLog(e){ e.time=(typeof nowStr==='function'?nowStr():new Date().toLocaleTimeString()); API_DBG.unshift(e); if(API_DBG.length>60)API_DBG.length=60; }
function openDbgLog(){
  const list=API_DBG.length?API_DBG.map(d=>`<div class="histitem"><div class="ht"><b>${d.time} · ${d.ok?'✓ 成功':'✗ 失败'} · HTTP ${d.status==null?'-':d.status}</b><p>接口：${esc(d.endpoint||'')}　｜　模型：${esc(d.model||'-')}　｜　通道：${esc(d.channel||'Node 本地代理')}</p>${d.error?`<p style="color:#b91c1c;white-space:pre-wrap;">原始错误：${esc(String(d.error).slice(0,500))}</p>`:''}</div></div>`).join(''):'<p class="hint">暂无调试记录。发起一次「诊断 / 生成」后，这里会显示：请求接口、使用模型、HTTP 状态码、API 原始错误、本地代理通道。</p>';
  modalOpen(`<h3>API 调试日志</h3><p class="hint" style="margin:-4px 0 10px;">每次调用记录：请求接口 / 使用模型 / HTTP 状态 / 原始错误 / 代理通道。</p>${list}<div class="row" style="margin-top:10px;"><button class="btn btn-ghost" data-dbg-clear>清空日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
}

function apiToast(msg, isErr){ if(typeof toast==='function') toast(msg, isErr); else console.log(msg); }
function modelName(m){ return typeof m==='string'?m:(m && (m.id||m.name||m.model||m.object)) || ''; }
function isImageLikeModel(id){ return EVO_IMAGE?EVO_IMAGE.isImageModelName(id):/(image|img|dall|gpt-image|flux|stable|midjourney|seedream|qwen.*image|wan.*image|z-image|绘图|生图|图生图)/i.test(id||''); }
function isImageModelObj(m){
  if(EVO_IMAGE&&EVO_IMAGE.isImageModelObject(m))return true;
  if(typeof m==='string') return isImageLikeModel(m);
  const arch = (m && m.architecture) || {};
  const eps = (m && m.supported_endpoints) || arch.supported_endpoints || [];
  if(Array.isArray(eps) && eps.some(e=>/images\/generations/i.test(String(e)))) return true;
  const om = (m && m.output_modalities) || arch.output_modalities || [];
  if(Array.isArray(om) && om.some(x=>/image/i.test(String(x)))) return true;
  return isImageLikeModel(modelName(m));
}
function classifyModels(rawArr){
  const raw = Array.isArray(rawArr) ? rawArr : [];
  API_BRIDGE.models = [...new Set(raw.map(modelName).filter(Boolean))];
  const imageModels = EVO_IMAGE?EVO_IMAGE.mergeImageModels(raw):raw.filter(isImageModelObj).map(modelName).filter(Boolean);
  API_BRIDGE.models=[...new Set([...API_BRIDGE.models,...imageModels])];
  const textModels  = API_BRIDGE.models.filter(id=>imageModels.indexOf(id)<0);
  API_BRIDGE.imageModels = imageModels; API_BRIDGE.textModels = textModels;
  if(!API_BRIDGE.wireModel  || imageModels.indexOf(API_BRIDGE.wireModel)<0)  API_BRIDGE.wireModel  = imageModels.includes(API_DEFAULT_IMAGE_MODEL)?API_DEFAULT_IMAGE_MODEL:(imageModels[0] || '');
  if(!API_BRIDGE.imageModel || imageModels.indexOf(API_BRIDGE.imageModel)<0) API_BRIDGE.imageModel = imageModels.includes(API_DEFAULT_IMAGE_MODEL)?API_DEFAULT_IMAGE_MODEL:(imageModels[0] || '');
  // V26：共享模型只维护生图/图生图模型；文案 Bot 始终由独立扣子通道维护。
  saveApiLocal();
  return {imageModels, textModels};
}
function maskKey(k){ if(!k)return ''; return k.length>14 ? k.slice(0,8)+'…'+k.slice(-6) : '已填写'; }
function apiHeaders(){
  return {
    'Content-Type':'application/json',
    'X-Base-Url': API_BRIDGE.baseUrl || API_DEFAULT_BASE,
    'X-API-Key': API_BRIDGE.apiKey || API_DEFAULT_KEY
  };
}
function saveApiLocal(){
  localStorage.setItem('api_base_url', API_BRIDGE.baseUrl || API_DEFAULT_BASE);
  localStorage.setItem('api_key', API_BRIDGE.apiKey || API_DEFAULT_KEY);
  localStorage.setItem('api_wire_model', API_BRIDGE.wireModel || '');
  localStorage.setItem('api_image_model', API_BRIDGE.imageModel || '');
  localStorage.setItem('api_copy_model', API_BRIDGE.copyModel || '');
  localStorage.setItem('api_models', JSON.stringify(API_BRIDGE.models || []));
  API_BRIDGE.ready = !!(API_BRIDGE.baseUrl && API_BRIDGE.apiKey);
  if(typeof wf!=='undefined'){ wf.configured=API_BRIDGE.ready; wf.baseUrl=API_BRIDGE.baseUrl; wf.key=API_BRIDGE.apiKey?'已预接入':''; }
  if(typeof img!=='undefined'){ img.configured=API_BRIDGE.ready; img.baseUrl=API_BRIDGE.baseUrl; img.key=API_BRIDGE.apiKey?'已预接入':''; }
  try{document.dispatchEvent(new CustomEvent('shared-image-channel-change',{detail:{ready:API_BRIDGE.ready}}));}catch(_e){}
}
saveApiLocal();

function isLocalProxyPage(){
  return location.protocol === 'http:' || location.protocol === 'https:';
}
async function checkProxy(){
  if(!isLocalProxyPage()){
    API_BRIDGE.proxyReady=false;
    throw new Error('当前是 file:// 方式打开，/api 本地代理不存在。请双击 start.bat 后使用 http://127.0.0.1:8787/ 打开。');
  }
  const res = await fetch('/api/health', {method:'GET'});
  if(!res.ok) throw new Error('本地代理健康检查失败：HTTP '+res.status);
  const data = await res.json();
  if(data&&data.serverManaged&&data.serverManaged.evolink){
    API_BRIDGE.baseUrl='https://api.evolink.ai/v1';
    API_BRIDGE.apiKey='server-managed';
    API_BRIDGE.ready=true;
    saveApiLocal();
  }
  API_BRIDGE.proxyReady=!!data.ok;
  return data;
}

function applyV29ManagedRuntime(event){
  const data=event&&event.detail||window.DeploymentRuntimeV29?.state?.health;
  if(data&&data.serverManaged&&data.serverManaged.evolink){
    API_BRIDGE.baseUrl='https://api.evolink.ai/v1';API_BRIDGE.apiKey='server-managed';API_BRIDGE.ready=true;saveApiLocal();
  }
}
document.addEventListener('v29-runtime-ready',applyV29ManagedRuntime);
applyV29ManagedRuntime();
function apiFailureInfo(data,status,model){
  const errObj=data&&data.error&&typeof data.error==='object'?data.error:{},rawMsg=String((errObj&&errObj.message)||(data&&data.message)||(data&&data.raw)||('HTTP '+status)),code=String((errObj&&errObj.code)||(data&&data.code)||''),type=String((errObj&&errObj.type)||(data&&data.type)||'');
  if(status===402||/insufficient[_\s-]?(?:credits|quota)|insufficient credits|insufficient quota|额度不足|余额不足/i.test([rawMsg,code,type].join(' ')))return {kind:'credits',message:'EvoLink 生图额度不足：API 连接正常，但当前账户或 API Token 没有足够 Credits 创建该生图任务。请先在 EvoLink 充值或调整 Token 额度，再重新生成。',rawMsg,code,type};
  if(status===401||/unauthorized|invalid or expired token|authentication_error/i.test([rawMsg,code,type].join(' ')))return {kind:'auth',message:'EvoLink API Key 无效或已过期，请重新填写有效密钥。',rawMsg,code,type};
  if(status===403&&/model_access_denied|does not have access|access denied/i.test([rawMsg,code,type].join(' ')))return {kind:'model_access',message:'当前 EvoLink API Token 无权使用模型「'+String(model||'当前模型')+'」，请更换有权限的模型或调整 Token 权限。',rawMsg,code,type};
  if(status===429||/rate[_\s-]?limit|too many requests/i.test([rawMsg,code,type].join(' ')))return {kind:'rate_limit',message:'EvoLink 请求过于频繁，请稍后再试。',rawMsg,code,type};
  if(status===502&&/connection_reset|socket hang up|ECONNRESET|连接被中途断开/i.test([rawMsg,code,type].join(' ')))return {kind:'connection_reset',message:'EvoLink 参考图文件通道连接被中途断开。V27 已把 files-api 参考图上传与 /images/generations 生图任务通道隔离：优先 stream，异常时自动切换官方 Base64 上传，并对 files-api 单独学习代理/直连路径；若仍失败，请运行“深度网络诊断”查看传输轨迹。',rawMsg,code,type};
  if(/socket hang up|ECONNRESET|connection reset|premature close/i.test([rawMsg,code,type].join(' ')))return {kind:'connection_reset',message:'连接被远端或代理中途重置（socket hang up/ECONNRESET）。请运行“深度网络诊断”确认是代理路径还是目标服务链路。',rawMsg,code,type};
  if(/ETIMEDOUT|ESOCKETTIMEDOUT|timed out|请求超时/i.test([rawMsg,code,type].join(' ')))return {kind:'timeout',message:'外部接口请求超时。V27 对参考图文件通道采用独立路由、有限重试与双协议 fallback；若仍发生，请检查代理/VPN 或运行深度网络诊断。',rawMsg,code,type};
  return {kind:'api',message:rawMsg,rawMsg,code,type};
}
async function apiFetchJSON(url, options, meta){
  meta = meta || {};
  if(!API_BRIDGE.baseUrl || !API_BRIDGE.apiKey) throw new Error('请先填写接口域名和 API 密钥');
  try{ if(!API_BRIDGE.proxyReady) await checkProxy(); }
  catch(e){ throw new Error(e.message); }
  const opt = Object.assign({}, options||{});
  opt.headers = Object.assign(apiHeaders(), opt.headers||{});
  let res;
  try{ res = await fetch(url, opt); }
  catch(e){ dbgLog({ok:false,endpoint:url,model:meta.model||'-',status:0,error:'浏览器 fetch 本地代理失败：'+e.message,channel:'浏览器 → Node 本地代理'}); throw new Error('请求本地代理失败：'+e.message+'。请确认 start.bat 窗口没有关闭。'); }
  const txt = await res.text();
  let data = null;
  try{ data = txt ? JSON.parse(txt) : {}; }catch(e){ data = {raw:txt}; }
  if(!res.ok){
    const info=apiFailureInfo(data,res.status,meta.model||'-');
    dbgLog({ok:false,endpoint:url,model:meta.model||'-',status:res.status,error:(txt||info.rawMsg||info.message).slice(0,600),channel:'Node 本地代理 /api'});
    const err=new Error(info.message);err.httpStatus=res.status;err.apiCode=info.code;err.apiType=info.type;err.kind=info.kind;err.rawMessage=info.rawMsg;throw err;
  }
  dbgLog({ok:true,endpoint:url,model:meta.model||'-',status:res.status,channel:'Node 本地代理 /api'});
  return data;
}

async function fetchNetworkDiagnose(deep){
  return apiFetchJSON('/api/network-diagnose'+(deep?'?deep=1':''),{method:'POST',body:'{}'},{stage:deep?'深度网络诊断':'网络诊断'});
}
function networkStepSummary(d){
  const rows=Array.isArray(d&&d.steps)?d.steps:[];
  return rows.map(x=>(x.ok?'✅ ':'❌ ')+x.name+'：'+(x.message||'')).join('\n');
}
async function runDeepNetworkDiagnose(){
  modalOpen('<h3>深度网络诊断</h3><div class="notebox">正在分别检测公网直连、当前代理路径、EvoLink 文件服务 GET，并通过独立参考图通道上传 1×1 PNG 和内置 800×800 参考图；会验证 stream/Base64 fallback 与 files-api 专用路由。该测试不会创建生图任务，也不会产生生图费用。</div>',true);
  try{
    const d=await fetchNetworkDiagnose(true),rows=Array.isArray(d.steps)?d.steps:[];
    const upload=rows.find(x=>/独立参考图通道|实际参考图上传|文件上传 POST/.test(x.name||''));
    let verdict=d.ok?'<div class="notebox" style="background:#ecfdf5;border-color:#a7f3d0;color:#047857;"><b>✅ 深度网络诊断通过</b>：真实文件上传路径可用。</div>':'<div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c;"><b>❌ 深度网络诊断发现异常</b>：请根据失败步骤判断是公网、代理还是 EvoLink 文件上传链路。</div>';
    if(upload&&!upload.ok&&/socket hang up|ECONNRESET|connection reset/i.test(upload.message||''))verdict+='<div class="notebox" style="margin-top:10px;background:#fff7ed;border-color:#fed7aa;color:#9a3412;"><b>连接重置诊断：</b>小 GET 能成功但文件 POST 失败，通常说明代理/VPN/中间网络对上传长连接不稳定。proxyUrl=auto 下 V27 会针对 files-api 单独选择代理/直连，并在 stream 失败后切换官方 Base64 上传；请优先查看诊断里的 transport、route 与 trace，再决定是否固定代理。</div>';
    modalOpen(`<h3>深度网络诊断</h3>${verdict}<div style="display:grid;gap:10px;margin-top:10px;">${rows.map(x=>`<div class="histitem"><div class="ht"><b>${x.ok?'✅':'❌'} ${esc(x.name)}</b><p style="white-space:pre-wrap;">${esc(x.message||'')}</p>${x.trace&&x.trace.length?`<p class="hint">重试轨迹：${esc(JSON.stringify(x.trace).slice(0,1200))}</p>`:''}</div></div>`).join('')}</div><div class="row" style="margin-top:14px;"><button class="btn btn-blue" data-api-diagnose>返回基础诊断</button><button class="btn btn-ghost" data-api-dbg>调试日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
  }catch(e){modalOpen('<h3>深度网络诊断</h3><div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c;">诊断失败：'+esc(e.message||String(e))+'</div><div class="row" style="margin-top:14px;"><button class="btn btn-ghost" data-mclose>关闭</button></div>',true);}
}

async function runApiDiagnose(showModal){
  const steps=[];
  function push(name, ok, msg){ steps.push({name,ok,msg}); }
  try{ const h=await checkProxy(); push('本地代理 /api/health', true, '代理正常：'+(h.version||'V9')); }
  catch(e){ push('本地代理 /api/health', false, e.message); }
  if(API_BRIDGE.proxyReady){
    try{
      const nd=await fetchNetworkDiagnose(false),rows=Array.isArray(nd.steps)?nd.steps:[];
      const direct=rows.find(x=>/公网直连/.test(x.name||'')),configured=rows.find(x=>/当前代理路径/.test(x.name||'')),files=rows.find(x=>/文件服务 GET/.test(x.name||''));
      push('公网基础网络 / Apifox Echo',!!((direct&&direct.ok)||(configured&&configured.ok)),networkStepSummary(nd));
      if(configured)push('当前出网路径 / 代理',!!configured.ok,(configured.message||'')+'；proxyUrl='+(nd.proxySetting||'direct')+(nd.resolvedProxy?('；resolved='+nd.resolvedProxy):''));
      if(files)push('EvoLink 文件服务基础连接',!!files.ok,files.message||'');
    }catch(e){push('公网基础网络 / Apifox Echo',false,e.message||String(e));}
    try{
      const d=await apiFetchJSON('/api/diagnose', {method:'POST', body:JSON.stringify({baseUrl:API_BRIDGE.baseUrl, apiKey:API_BRIDGE.apiKey})});
      push('外部 API 连通性', !!d.ok, (d.message || (d.ok?'连接成功':'连接失败'))+(d.ok?'\n说明：该步骤会验证鉴权、文件通道与账户 Credits，但不会提交计费生图任务。':''));
      if(d.billing){
        const b=d.billing,fmt=v=>Number.isFinite(Number(v))?String(Number(v)):'未知',parts=['账户剩余 '+fmt(b.userRemaining)+' credits',b.tokenUnlimited?'Token 额度不限':'Token 剩余 '+fmt(b.tokenRemaining)+' credits'];
        const billingOk=!!(b.checked&&!b.blocked&&d.generationReady!==false);
        push('账户 Credits / 生图额度',billingOk,billingOk?('额度检查通过：'+parts.join('；')+'。'):((b.blocked?'额度不足：':'额度状态无法确认：')+parts.join('；')+(b.blocked?'。当前生成会返回 HTTP 402，请先充值或调整 Token 额度。':'。请重新诊断后再生成。')));
      }else if(EVO_IMAGE&&EVO_IMAGE.isEvolinkBase(API_BRIDGE.baseUrl)){
        push('账户 Credits / 生图额度',false,'未取得 EvoLink /v1/credits 结果，无法确认当前账户是否具备生图额度。');
      }
      if(d.models && Array.isArray(d.models)){
        if(d.models.length){
          if(Array.isArray(d.capabilities))API_BRIDGE.modelCapabilities=d.capabilities;
          if(EVO_IMAGE&&typeof EVO_IMAGE.ingestRemoteModels==='function')EVO_IMAGE.ingestRemoteModels(d.models);
          const {imageModels, textModels} = classifyModels(d.models);
          push('模型列表 / 分类', true, '共 '+d.models.length+' 个：文本/视觉 '+textModels.length+'，生图 '+imageModels.length+(Array.isArray(d.capabilities)?('，动态能力 '+d.capabilities.length+' 项'):'')+'。线框模型='+(API_BRIDGE.wireModel||'未选')+'，生图模型='+(API_BRIDGE.imageModel||'未识别，请手选')+(imageModels.length?('（生图候选：'+imageModels.slice(0,3).join('、')+'…）'):''));
        }
      }
      if(EVO_IMAGE&&EVO_IMAGE.isEvolinkBase(API_BRIDGE.baseUrl)){
        const wire=API_BRIDGE.wireModel||API_DEFAULT_IMAGE_MODEL,profile=EVO_IMAGE.modelProfile(wire);
        push('线框模型图生图能力', !!(profile&&profile.maxRefs!==0), profile&&profile.maxRefs!==0
          ? ('模型 '+wire+' 已按 image_urls 图生图/编辑路径配置；参考图上限 '+(Number.isFinite(profile.maxRefs)?profile.maxRefs:'多张')+' 张。')
          : ('模型 '+wire+' 不接受参考图，请更换支持 image_urls 的图像模型。'));
        try{
          const prepared=await EVO_IMAGE.prepareReferenceSource('/assets/wolassen/02.jpg?v=26-preflight');
          const ok=/^data:image\/(?:jpeg|jpg|png|webp|gif);/i.test(prepared);
          push('本地参考图转换',ok,ok?'内置 /assets 参考图可读取并转换为 EvoLink 上传所需 Data URL；V26 的相对路径失败点已通过。':'内置参考图转换结果格式异常。');
        }catch(e){push('本地参考图转换',false,e.message||String(e));}
      }
    }catch(e){ push('外部 API 连通性', false, e.message); }
  }
  API_BRIDGE.lastDiag=steps;
  if(showModal) openDiagModal(steps);
  return steps;
}
function openDiagModal(steps){
  const proxyOk=steps.find(s=>/本地代理/.test(s.name)); const extOk=steps.find(s=>/外部 API/.test(s.name)); const credits=steps.find(s=>/Credits|生图额度/.test(s.name));
  const allOk=steps.length&&steps.every(s=>s.ok);
  let verdict, tip='';
  if(allOk){ verdict='<div class="notebox" style="background:#ecfdf5;border-color:#a7f3d0;color:#047857;"><b>✅ 生图前置检查通过</b>：鉴权、账户 Credits、模型能力与本地参考图转换均正常。为避免产生费用，连接测试本身不会实际提交生图任务。</div>'; }
  else if(proxyOk&&!proxyOk.ok){ verdict='<div class="notebox" style="background:#fff7ed;border-color:#fed7aa;color:#9a3412;"><b>❌ 本地代理未连通</b>：请确认 start.bat 黑窗口没关闭，并用 http://127.0.0.1:8787/ 打开（不要用 file:// 直接双击 html）。</div>'; }
  else if(credits&&!credits.ok&&proxyOk&&proxyOk.ok&&(!extOk||extOk.ok)){
    verdict='<div class="notebox" style="background:#fff7ed;border-color:#fdba74;color:#9a3412;"><b>⚠️ API 可以连接，但当前生图额度不可用</b>：这不是网络或模型路由故障。EvoLink 在真正创建生图任务时会因 Credits 不足返回 HTTP 402。</div>';
    tip='<div class="notebox" style="margin-top:10px;background:#fff7ed;border-color:#fed7aa;color:#9a3412;"><b>处理方式：</b><br>① 登录 EvoLink 检查账户余额并充值；<br>② 如果账户有余额但 Token 剩余额度为 0，请调整该 Token 的 Credits 限额或更换 Token；<br>③ 充值/调整后重新点“接口诊断”，看到“账户 Credits / 生图额度”变绿后再生成。<br><br><b>当前检查：</b>'+esc(credits.msg||'额度不足')+'</div>';
  }
  else if(extOk&&!extOk.ok){
    const reason=extOk.msg||'';
    let cause='连接外部 API 失败。';
    if(/ETIMEDOUT|超时|timeout/i.test(reason)) cause='连接超时（ETIMEDOUT）：本机网络到 api.evolink.ai 不通（多为防火墙/地区限制/被墙）。换 IP 通常无效，需让代理经 VPN/上游代理出网。';
    else if(/Invalid IP address|forceHostIp/i.test(reason)) cause='直连 IP（forceHostIp）设置无效或代理解析异常。请检查 config.json 里 forceHostIp 是否填了正确的 IP，并重启 start.bat。';
    else if(/ENOTFOUND|getaddrinfo/i.test(reason)) cause='域名解析失败（ENOTFOUND）：DNS 无法解析 api.evolink.ai。';
    else if(/ECONNREFUSED/i.test(reason)) cause='连接被拒绝（ECONNREFUSED）：目标端口拒绝连接，可能 IP/端口不对。';
    else if(/\b401\b|\b403\b|unauthorized|无权限|鉴权|api[\s_-]*key/i.test(reason)) cause='已连上但鉴权失败：密钥可能无效或无权限（这说明网络其实是通的）。';
    else if(/HTTP [45]\d\d/i.test(reason)) cause='已连上外部 API，但返回了错误状态码（网络是通的，属接口/模型/参数问题）。';
    verdict='<div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c;"><b>❌ '+esc(cause)+'</b></div>';
    tip='<div class="notebox" style="margin-top:10px;background:#fff7ed;border-color:#fed7aa;color:#9a3412;"><b>失败原因（原始）：</b>'+esc(reason)+'<br><br><b>解决办法：</b><br>① 若是超时（ETIMEDOUT，本机连不出去）：打开 <b>config.json</b>，把 <code>"proxyUrl"</code> 填成你的 VPN/代理地址（如 Clash 默认 <code>http://127.0.0.1:7890</code>），保存后重启 start.bat，让本地代理经它出网。<br>② 也可先确认浏览器能否直接打开 https://api.evolink.ai/v1/models（能开说明网络通，是程序问题；打不开说明确实被网络挡住）。<br>③ 若是鉴权/状态码错误：网络已通，改密钥或在配置里改选模型即可。</div>';
  }
  modalOpen(`<h3>API 连接测试结果</h3>
    ${verdict}
    <div style="display:grid;gap:10px;margin-top:10px;">${steps.map(s=>`<div class="histitem"><div class="ht"><b>${s.ok?'✅':'❌'} ${esc(s.name)}</b><p style="white-space:pre-wrap;">${esc(s.msg||'')}</p></div></div>`).join('')}</div>
    ${tip}
    <div class="row" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-violet" data-api-open-wire>线框配置</button><button class="btn btn-ghost" data-api-open-copy>文案配置</button>
      <button class="btn btn-blue" data-api-network-diagnose>深度网络诊断</button><button class="btn btn-ghost" data-api-dbg>调试日志</button>
      <button class="btn btn-ghost" data-mclose>关闭</button>
    </div>`, true);
}
async function loadApiModels(options){
  const opts=Object.assign({notify:true},options||{});
  API_BRIDGE.baseUrl = normalizeSharedImageBase(($('api-base-url') && $('api-base-url').value.trim()) || API_BRIDGE.baseUrl || API_DEFAULT_BASE);
  API_BRIDGE.apiKey = ($('api-key') && $('api-key').value.trim()) || API_BRIDGE.apiKey || API_DEFAULT_KEY;
  saveApiLocal();
  let arr=[],fallbackReason='',capabilityRows=[];
  try{
    const dynamic=!!(EVO_IMAGE&&EVO_IMAGE.isEvolinkBase(API_BRIDGE.baseUrl));
    const data = await apiFetchJSON(dynamic?'/api/model-capabilities':'/api/models', {method:'GET'});
    arr = Array.isArray(data) ? data : (data.models || data.data || []);
    capabilityRows=Array.isArray(data&&data.capabilities)?data.capabilities:[];
    API_BRIDGE.modelCapabilities=capabilityRows;
    if(EVO_IMAGE&&typeof EVO_IMAGE.ingestRemoteModels==='function')EVO_IMAGE.ingestRemoteModels(arr);
    if(data&&data.warning)fallbackReason=data.warning;
  }catch(e){
    if(!(EVO_IMAGE&&EVO_IMAGE.isEvolinkBase(API_BRIDGE.baseUrl)))throw e;
    fallbackReason=e.message||'EvoLink 未返回模型目录';
  }
  if(!arr.length&&EVO_IMAGE&&EVO_IMAGE.isEvolinkBase(API_BRIDGE.baseUrl))arr=EVO_IMAGE.BUILTIN_IMAGE_MODELS.map(id=>({id,supported_endpoints:['/v1/images/generations'],output_modalities:['image']}));
  if(!arr.length) throw new Error('模型列表为空；可在下方手动输入模型名');
  const {imageModels, textModels} = classifyModels(arr);
  if(opts.notify!==false)apiToast('✓ 已载入 '+imageModels.length+' 个生图/图生图模型'+(capabilityRows.length?('，动态能力 '+capabilityRows.length+' 项'):'')+(fallbackReason?'（'+fallbackReason+'）':''), !imageModels.length);
  return {models:[...API_BRIDGE.models],imageModels:[...imageModels],textModels:[...textModels],capabilities:[...capabilityRows],fallbackReason};
}

/* V26：EvoLink 共享图像模型只在对应页面按需预热；状态卡只显示当前页面所属通道。 */
function sharedApiKeyFingerprint(value){let h=2166136261;const text=String(value||'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
const SHARED_API_BOOTSTRAP={
  promise:null,
  fingerprint:'',
  lastResult:null,
  lastAttemptAt:0,
  fingerprintOf(){return [API_BRIDGE.baseUrl||'',sharedApiKeyFingerprint(API_BRIDGE.apiKey),...(API_BRIDGE.models||[])].join('|');},
  async ensureForView(view,options){
    const opts=Object.assign({notify:false,force:false},options||{});
    const isolation=window.GenerationChannelIsolation;
    const channel=isolation?isolation.channelForView(view):((view==='integrate'||view==='image')?'shared-image':'none');
    if(channel!=='shared-image')return {ok:true,skipped:true,reason:'isolated-view',channel};
    if(!API_BRIDGE.baseUrl||!API_BRIDGE.apiKey)return {ok:true,skipped:true,reason:'not-configured',channel};
    if(API_BRIDGE.models&&API_BRIDGE.models.length&&!opts.force)return {ok:true,cached:true,channel,models:[...API_BRIDGE.models]};
    const fp=[API_BRIDGE.baseUrl,sharedApiKeyFingerprint(API_BRIDGE.apiKey)].join('|');
    if(this.promise&&!opts.force)return this.promise;
    if(this.lastResult&&this.fingerprint===fp&&!opts.force&&this.lastResult.ok===false&&(Date.now()-this.lastAttemptAt)<15000)return this.lastResult;
    this.fingerprint=fp;this.lastAttemptAt=Date.now();
    this.promise=(async()=>{
      try{
        if(!API_BRIDGE.proxyReady)await checkProxy();
        const loaded=await loadApiModels({notify:opts.notify===true});
        const result={ok:true,channel,loaded:true,models:loaded.models||[]};
        this.lastResult=result;return result;
      }catch(error){
        const result={ok:false,channel,error:String(error&&error.message||error||'共享模型载入失败')};
        this.lastResult=result;
        if(opts.notify===true){
          const active=typeof curView==='string'?curView:view;
          const allowed=isolation?isolation.mayReportSharedModelFailure(active):(active==='integrate'||active==='image');
          if(allowed)apiToast('模型载入失败：'+result.error+'（可在「API 接入配置」点诊断/手动载入）',true);
        }
        return result;
      }finally{this.promise=null;}
    })();
    return this.promise;
  },
  reset(){this.promise=null;this.fingerprint='';this.lastResult=null;this.lastAttemptAt=0;}
};
window.SharedApiBootstrap=SHARED_API_BOOTSTRAP;

function apiModelOptions(selected){
  if(!API_BRIDGE.models.length) return '<option value="">未载入模型，可点击“载入模型列表”</option>';
  return API_BRIDGE.models.map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(id)}</option>`).join('');
}
function apiConfigForm(kind){
  const isImg=kind==='image',isCopy=kind==='copy';
  const selected=isImg?API_BRIDGE.imageModel:(isCopy?API_BRIDGE.copyModel:API_BRIDGE.wireModel);
  const prefix=isImg?'image':(isCopy?'copy':'wire'),manualId=prefix+'-model-manual',selectId=prefix+'-model';
  const title=isImg?'AI 生图 · EvoLink API 接入 V26':(isCopy?'文案生成 · AI 接入配置 V14':'AI 线框生成 · EvoLink API 接入 V26');
  const modelLabel=isImg?'生图模型':(isCopy?'文案生成文本模型':'线框生成模型（建议选图像模型，直接出线框图）');
  const candidates=isCopy?(API_BRIDGE.textModels||[]):((API_BRIDGE.imageModels&&API_BRIDGE.imageModels.length)?API_BRIDGE.imageModels:(EVO_IMAGE?EVO_IMAGE.mergeImageModels(API_BRIDGE.models):API_BRIDGE.models));
  const options=candidates&&candidates.length?candidates.map(id=>`<option value="${esc(id)}" ${id===selected?'selected':''}>${esc(id)}</option>`).join(''):'<option value="">未载入模型，可点击“载入全部模型”</option>';
  return `<h3>${title}</h3>
  ${isCopy?copyProfileQuickbar():''}
  <div class="notebox" style="margin-bottom:12px;background:#ecfdf5;border-color:#a7f3d0;color:#047857;">当前 Base URL：<b>${esc(API_BRIDGE.baseUrl||API_DEFAULT_BASE)}</b>，密钥状态：<b>${maskKey(API_BRIDGE.apiKey||API_DEFAULT_KEY)}</b>。该共享配置仅供 AI 线框生成与 AI 生图使用；文案生成使用独立扣子通道。</div>
  <label class="fl">接口域名 / Base URL</label><input type="text" id="api-base-url" value="${esc(API_BRIDGE.baseUrl||API_DEFAULT_BASE)}" placeholder="https://api.evolink.ai/v1">
  <label class="fl">API 密钥</label><input type="password" id="api-key" value="${esc(API_BRIDGE.apiKey||API_DEFAULT_KEY)}" placeholder="请填写你的 EvoLink API Key（本包不预置）" autocomplete="new-password">
  <label class="fl">${modelLabel}（模型列表）</label><select id="${selectId}" onchange="var mi=document.getElementById('${manualId}');if(mi&&this.value)mi.value=this.value;">${options}</select>
  <label class="fl">${modelLabel}（手动输入，优先使用）</label><input type="text" id="${manualId}" placeholder="模型列表为空时可手动输入模型名" value="${esc(selected||'')}">
  <div class="notebox" style="margin-top:12px;">EvoLink 图像通道统一使用 /v1/images/generations：支持文生图、图生图与图像编辑；本地参考图会先经 EvoLink 文件接口上传，再以 image_urls 提交异步任务。文案生成继续使用独立扣子通道。</div>
  <div class="notebox" style="margin-top:8px;background:#fff7ed;border-color:#fed7aa;color:#9a3412;">外部 API 超时通常是网络或代理问题。可在 <b>config.json</b> 的 <code>proxyUrl</code> 填写本机代理地址，保存后重启 start.bat。</div>
  <div class="row" style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-violet" data-api-save="${kind}">保存配置</button><button class="btn btn-emerald" data-api-load-models="${kind}">载入生图模型</button><button class="btn btn-blue" data-api-diagnose>接口诊断</button><button class="btn btn-ghost" data-api-dbg>前端调试日志</button>${isCopy?'<button class="btn btn-ghost" data-copy-profile-manager>接口版本管理</button><button class="btn btn-ghost" data-copy-mapper-open>字段映射器</button><button class="btn btn-ghost" data-copy-open-backend-log>后台日志</button>':''}<button class="btn btn-ghost" data-api-reset-default>恢复预接入配置</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`;
}
function openCfg(){ modalOpen(apiConfigForm('wire')); }
function openImgCfg(){ modalOpen(apiConfigForm('image')); }
function saveApiFromModal(kind){
  const rawBase=($('api-base-url')&&$('api-base-url').value.trim())||API_DEFAULT_BASE;
  API_BRIDGE.baseUrl=normalizeSharedImageBase(rawBase);
  if(EVO_IMAGE&&EVO_IMAGE.isEvolinkDocsUrl(rawBase))apiToast('检测到 EvoLink 文档页面地址，已自动纠正为官方 API Base URL：https://api.evolink.ai/v1');
  API_BRIDGE.apiKey=($('api-key')&&$('api-key').value.trim())||API_DEFAULT_KEY;
  const prefix=kind==='image'?'image':(kind==='copy'?'copy':'wire');
  const selectVal=(($(prefix+'-model')&&$(prefix+'-model').value)||'');
  const manualVal=(($(prefix+'-model-manual')&&$(prefix+'-model-manual').value.trim())||'');
  const chosen=manualVal||selectVal;
  if(kind==='image')API_BRIDGE.imageModel=chosen||API_BRIDGE.imageModel;
  else if(kind==='copy')API_BRIDGE.copyModel=chosen||API_BRIDGE.copyModel;
  else API_BRIDGE.wireModel=chosen||API_BRIDGE.wireModel;
  saveApiLocal();SHARED_API_BOOTSTRAP.reset();apiToast('✓ API 配置已保存');
}
document.addEventListener('click', async e=>{
  if(e.target.closest('[data-copy-profiles]')||e.target.closest('[data-copy-profile-manager]')){openCopyProfileManager();return;}
  if(e.target.closest('[data-copy-mapper]')||e.target.closest('[data-copy-mapper-open]')||e.target.closest('[data-copy-json-mapping]')){openCopyJsonMappingWorkspace();return;}
  if(e.target.closest('[data-copy-profile-new]')){inputDialog('新建接口配置方案名称','新接口配置',name=>{createCopyProfile(name);openCopyProfileManager();setActionStatus('success','已新建并保存接口配置方案',false);});return;}
  if(e.target.closest('[data-copy-profile-save-version]')){try{if($('api-base-url')){API_BRIDGE.baseUrl=normalizeSharedImageBase($('api-base-url').value.trim()||API_BRIDGE.baseUrl);}if($('api-key'))API_BRIDGE.apiKey=$('api-key').value.trim()||API_BRIDGE.apiKey;if($('copy-model-manual'))API_BRIDGE.copyModel=$('copy-model-manual').value.trim()||API_BRIDGE.copyModel;if($('copy-json-template'))saveCopyJsonModal();saveApiLocal();const v=saveCurrentCopyProfileVersion();setActionStatus('success','已保存接口配置 '+v.label,false);if($('modal')&&$('modal').className==='open'&&!$('copy-mapper-raw')&&!$('copy-json-template'))openCopyProfileManager();}catch(err){setActionStatus('error','保存配置版本失败：'+err.message,false);}return;}
  const pSwitch=e.target.closest('[data-copy-profile-switch]');if(pSwitch){try{const id=($('copy-profile-quick')&&$('copy-profile-quick').value)||COPY_PROFILE_STORE.activeProfileId;const x=switchCopyProfile(id);setActionStatus('success','已切换至 '+x.p.name+' '+x.v.label,false);if($('copy-json-template')||$('copy-mapper-raw'))openCopyJsonMappingWorkspace();else if(curView==='copy')render('copy');}catch(err){setActionStatus('error','切换配置失败：'+err.message,false);}return;}
  const pUse=e.target.closest('[data-copy-profile-use]');if(pUse){try{const x=switchCopyProfile(pUse.dataset.copyProfileUse);openCopyProfileManager();setActionStatus('success','已切换至 '+x.p.name+' '+x.v.label,false);}catch(err){setActionStatus('error','切换配置失败：'+err.message,false);}return;}
  const pSnap=e.target.closest('[data-copy-profile-snapshot]');if(pSnap){try{if(COPY_PROFILE_STORE.activeProfileId!==pSnap.dataset.copyProfileSnapshot)switchCopyProfile(pSnap.dataset.copyProfileSnapshot);const v=saveCurrentCopyProfileVersion();openCopyProfileManager();setActionStatus('success','已保存 '+v.label,false);}catch(err){setActionStatus('error','保存版本失败：'+err.message,false);}return;}
  const pRoll=e.target.closest('[data-copy-profile-rollback]');if(pRoll){confirmDialog('回滚到该接口配置版本？当前未保存的配置会被替换。',()=>{try{const x=rollbackCopyProfile(pRoll.dataset.copyProfileRollback,pRoll.dataset.copyProfileVersion);openCopyProfileManager();setActionStatus('success','已回滚至 '+x.p.name+' '+x.v.label,false);}catch(err){setActionStatus('error','回滚失败：'+err.message,false);}});return;}
  const pRen=e.target.closest('[data-copy-profile-rename]');if(pRen){const p=COPY_PROFILE_STORE.profiles.find(x=>x.id===pRen.dataset.copyProfileRename);if(p)inputDialog('重命名接口配置方案',p.name,name=>{p.name=name;saveCopyProfileStore();openCopyProfileManager();setActionStatus('success','配置方案已重命名',false);});return;}
  const ahp=e.target.closest('[data-adj-hist-preview]');if(ahp){adjustLoadEditHistory();const h=adjustState.editHistory.find(x=>x.id===ahp.dataset.adjHistPreview);if(h)openImgPreview(ahp.dataset.side==='before'?h.beforeSrc:h.resultSrc,ahp.dataset.side==='before'?'AI 修改前':'AI 修改后');return;}
  const ahr=e.target.closest('[data-adj-hist-restore]');if(ahr){adjustLoadEditHistory();const h=adjustState.editHistory.find(x=>x.id===ahr.dataset.adjHistRestore);if(h){modalClose();await adjustUseDataUrl(h.resultSrc,'history-ai-edit.png',false);adjustState.lastMarkedSrc=h.markedSrc||'';adjustState.lastResultSrc=h.resultSrc;adjustState.aiStatus='已恢复历史结果，可继续编辑';adjustState.aiStatusType='done';setActionStatus('success','历史结果已恢复为当前底图',false);}return;}
  const ahg=e.target.closest('[data-adj-hist-regen]');if(ahg){adjustLoadEditHistory();const h=adjustState.editHistory.find(x=>x.id===ahg.dataset.adjHistRegen);if(h){modalClose();await adjustUseDataUrl(h.beforeSrc,'history-before.png',true);Object.keys(adjustState.brushes).forEach(id=>{adjustState.brushes[id].prompt='';});(h.payload&&h.payload.regions||[]).forEach(r=>{if(adjustState.brushes[r.id])adjustState.brushes[r.id].prompt=r.instruction||'';});adjustState.strokes=[];(h.payload&&h.payload.regions||[]).forEach(r=>(r.strokes||[]).forEach(s=>adjustState.strokes.push({brushId:r.id,tool:'brush',size:s.size,points:s.points||[]})));renderAdjustView();adjustGenerateCandidates(h.colorIds||[],{queue:false});}return;}
  const ahd=e.target.closest('[data-adj-hist-download]');if(ahd){adjustLoadEditHistory();const h=adjustState.editHistory.find(x=>x.id===ahd.dataset.adjHistDownload);if(h){adjustDownloadDataUrl(h.resultSrc,'ai-local-edit-'+Date.now()+'.png');setActionStatus('success','历史结果已开始下载',false);}return;}
  const ahx=e.target.closest('[data-adj-hist-delete]');if(ahx){adjustState.editHistory=adjustState.editHistory.filter(x=>x.id!==ahx.dataset.adjHistDelete);adjustSaveEditHistory();adjustOpenAiHistory();setActionStatus('success','历史记录已删除',false);return;}
  const pDel=e.target.closest('[data-copy-profile-delete]');if(pDel){confirmDialog('删除该接口配置方案及全部历史版本？',()=>{COPY_PROFILE_STORE.profiles=COPY_PROFILE_STORE.profiles.filter(x=>x.id!==pDel.dataset.copyProfileDelete);if(COPY_PROFILE_STORE.activeProfileId===pDel.dataset.copyProfileDelete){COPY_PROFILE_STORE.activeProfileId=COPY_PROFILE_STORE.profiles[0].id;switchCopyProfile(COPY_PROFILE_STORE.activeProfileId);}saveCopyProfileStore();openCopyProfileManager();setActionStatus('success','接口配置方案已删除',false);});return;}
  if(e.target.closest('[data-copy-mapper-reload]')){openCopyJsonMappingWorkspace();return;}
  const previewModeBtn=e.target.closest('[data-copy-preview-mode]');if(previewModeBtn){setCopyPreviewMode(previewModeBtn.dataset.copyPreviewMode);return;}
  const linkTestBtn=e.target.closest('[data-copy-link-test]');if(linkTestBtn){testCopyPromptLink(linkTestBtn);return;}
  if(e.target.closest('[data-copy-simple-run]')){try{const ids=runSimpleCopyLink();updateCopyWorkspaceUi(COPY_API_CHANNEL.lastMapped);setActionStatus('success','已完成：案例载入、字段映射、版本更新、下一级任务 JSON 创建及 AI 线框联通，共更新 '+ids.length+' 个版本',false);}catch(err){setActionStatus('error','一键联通失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-batch-apply]')){try{const ids=applyCopyBatchEdit();setActionStatus('success','已批量编辑 '+ids.length+' 个文案版本，并同步固定绑定任务组',false);}catch(err){setActionStatus('error','批量编辑失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-mapper-apply-selected]')){try{const ids=applyMappedResultToSelectedCopies();updateCopyWorkspaceUi(COPY_API_CHANNEL.lastMapped);setActionStatus('success','字段映射已应用到 '+ids.length+' 个版本文案，并同步下一级任务 JSON 与生成提示词',false);}catch(err){setActionStatus('error','应用映射失败：'+err.message,false);}return;}
  const caseToggle=e.target.closest('[data-copy-case-toggle]');if(caseToggle){const idx=+caseToggle.dataset.copyCaseToggle;normalizeCopyCaseState(false);const on=!COPY_CASE_SELECTED.has(idx);if(!on&&COPY_CASE_SELECTED.size<=1){setActionStatus('error','至少保留一个预制文案版本',false);return;}if(on)COPY_CASE_SELECTED.add(idx);else COPY_CASE_SELECTED.delete(idx);if(on||COPY_CASE_ACTIVE===idx)COPY_CASE_ACTIVE=on?idx:selectedCopyCaseIndices()[0];preparePresetCopyCase(COPY_CASE_ACTIVE);updateCopyWorkspaceUi();return;}
  const casePreview=e.target.closest('[data-copy-preview-case]');if(casePreview){COPY_CASE_ACTIVE=+casePreview.dataset.copyPreviewCase;preparePresetCopyCase(COPY_CASE_ACTIVE);COPY_CASE_VIEW='single';updateCopyWorkspaceUi();return;}
  const caseView=e.target.closest('[data-copy-case-view]');if(caseView){COPY_CASE_VIEW=caseView.dataset.copyCaseView==='multi'?'multi':'single';updateCopyWorkspaceUi();return;}
  const pga=e.target.closest('[data-prompt-group-activate]');if(pga){const id=pga.dataset.promptGroupActivate;wf.promptActiveGroupId=id;if(!currentPromptTargetIds().includes(id))setPromptGroupSelected(id,true);refreshPromptTargetUi(id);setActionStatus('success','已切换当前任务组，并同步刷新精准替换数据',false);return;}
  const pgt=e.target.closest('[data-prompt-group-toggle]');if(pgt){const id=pgt.dataset.promptGroupToggle,on=!pgt.classList.contains('on');setPromptGroupSelected(id,on);wf.promptActiveGroupId=id;refreshPromptTargetUi(id);setActionStatus('success',on?'已将任务组加入精准提示词联通':'已取消该任务组的提示词联通',false);return;}
  if(e.target.closest('[data-prompt-group-all]')){wf.promptTargetGroupIds=null;refreshPromptTargetUi(wf.promptActiveGroupId);setActionStatus('success','已选择全部 AI 线框任务组',false);return;}
  if(e.target.closest('[data-prompt-group-none]')){wf.promptTargetGroupIds=[];refreshPromptTargetUi(wf.promptActiveGroupId);setActionStatus('success','已清空任务组选择',false);return;}
  if(e.target.closest('[data-prompt-sync-group-json]')){
    const sel=$('prompt-preview-group'),id=(sel&&sel.value)||ensurePromptActiveGroup(),i=wf.groups.findIndex(g=>g.id===id),g=i>=0?wf.groups[i]:null;
    if(!g){setActionStatus('error','未找到当前任务组',false);return;}
    COPY_API_CHANNEL.promptLinkEnabled=true;setPromptGroupSelected(g.id,true);wf.promptActiveGroupId=g.id;syncTaskGroupJson(g,i,'V26 手动刷新（自动确认）任务 JSON');saveCopyApiChannel();refreshPromptTargetUi(g.id);setActionStatus('success','任务 JSON 已自动确认并刷新，历史版本已保存',false);return;
  }
  const tjh=e.target.closest('[data-task-json-history]');if(tjh){const id=tjh.dataset.taskJsonHistory||ensurePromptActiveGroup();if(id)openTaskJsonHistory(id);return;}
  const tjhp=e.target.closest('[data-task-json-history-preview]');if(tjhp){modalOpen(taskJsonHistoryPreviewHtml(tjhp.dataset.taskJsonHistoryPreview,tjhp.dataset.historyId),true);return;}
  const tjhr=e.target.closest('[data-task-json-history-restore]');if(tjhr){try{const id=tjhr.dataset.taskJsonHistoryRestore;restoreTaskJsonHistory(id,tjhr.dataset.historyId);saveCopyApiChannel();modalClose();openBuiltin();setActionStatus('success','已恢复历史 JSON，并重新作为当前任务组生成数据使用',false);}catch(err){setActionStatus('error','恢复 JSON 历史失败：'+err.message,false);}return;}
  const pdf=e.target.closest('[data-prompt-diag-filter]');if(pdf){wf.promptDiagnosisFilter=pdf.dataset.promptDiagFilter;refreshPromptDiagnosisUi();return;}
  const pdc=e.target.closest('[data-prompt-diag-current]');if(pdc){wf.promptActiveGroupId=pdc.dataset.promptDiagCurrent;refreshPromptTargetUi(wf.promptActiveGroupId);refreshIssueCenterUi();setActionStatus('success','已切换诊断当前任务组',false);return;}
  const pdjson=e.target.closest('[data-prompt-diag-sync-json]');if(pdjson){const id=pdjson.dataset.promptDiagSyncJson,i=wf.groups.findIndex(g=>g.id===id);if(i>=0){const g=wf.groups[i];COPY_API_CHANNEL.promptLinkEnabled=true;setPromptGroupSelected(id,true);wf.promptActiveGroupId=id;syncTaskGroupJson(g,i,'V14 问题中心同步的任务组 JSON');saveCopyApiChannel();refreshPromptTargetUi(id);refreshPromptDiagnosisUi();refreshIssueCenterUi();setActionStatus('success','任务组精准替换 JSON 已补齐并启用',false);}return;}
  const pdr=e.target.closest('[data-prompt-diag-repair]');if(pdr){const id=pdr.dataset.promptDiagRepair,i=wf.groups.findIndex(g=>g.id===id);if(i>=0){const r=repairPromptGroupSafe(wf.groups[i],i);saveCopyApiChannel();wf.promptActiveGroupId=id;if(curView==='integrate')renderWireframe();refreshPromptTargetUi(id);refreshIssueCenterUi();setActionStatus('success',r.changed.length?'已修复：'+r.changed.join('、'):(r.needsFrame?'仍需手动选择线框素材':'当前任务组无需自动修复'),false);}return;}
  const pdfm=e.target.closest('[data-prompt-diag-frame]');if(pdfm){const id=pdfm.dataset.promptDiagFrame,i=wf.groups.findIndex(g=>g.id===id);if(i>=0){wf.promptActiveGroupId=id;setTimeout(()=>openPicker(i),40);}return;}
  const pdretry=e.target.closest('[data-prompt-diag-retry]');if(pdretry){const id=pdretry.dataset.promptDiagRetry,i=wf.groups.findIndex(g=>g.id===id);if(i>=0){wf.promptActiveGroupId=id;wf.groups[i].lastGenerateError='';refreshPromptTargetUi(id);await startGen(i);refreshPromptTargetUi(id);}return;}
  if(e.target.closest('[data-prompt-diag-repair-filter]')){await safeRepairPromptFilter(normalizePromptDiagnosisFilter());return;}
  if(e.target.closest('[data-copy-prompt-link-toggle]')){COPY_API_CHANNEL.promptLinkEnabled=COPY_API_CHANNEL.promptLinkEnabled===false;saveCopyApiChannel();updateCopyWorkspaceUi();refreshPromptLinkModalUi();setActionStatus('success','AI 线框提示词联通已'+(COPY_API_CHANNEL.promptLinkEnabled===false?'关闭':'开启'),false);return;}
  if(e.target.closest('[data-copy-open-wire-prompt]')){modalClose();if(curView!=='integrate')render('integrate');setTimeout(()=>openBuiltin(),80);return;}
  if(e.target.closest('[data-copy-mapper-format]')){try{const el=$('copy-mapper-raw');el.value=JSON.stringify(JSON.parse(el.value),null,2);refreshMapperPreview();setActionStatus('success','返回 JSON 格式正确',false);}catch(err){setActionStatus('error','JSON 格式错误：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-mapper-auto]')){try{const bundle=readMapperBundle(),entries=mapperPathEntries(bundle),mapping=autoSuggestCopyMapping(entries);document.querySelectorAll('[data-map-field]').forEach(el=>{el.value=mapping[el.dataset.mapField]||'';});refreshMapperPreview();setActionStatus('success','已自动识别并建议字段映射',false);}catch(err){setActionStatus('error','自动识别失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-mapper-save]')){try{const out=saveCopyFieldMapping();refreshMapperPreview();setActionStatus('success','字段映射已保存',false);}catch(err){setActionStatus('error','保存字段映射失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-mapper-copy]')){try{const out=publicMappedPreview(currentCopyWorkspaceMapped());navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(out,null,2));setActionStatus('success','预览 JSON 已复制',false);}catch(err){setActionStatus('error','复制失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-json-save]')){const b=e.target.closest('[data-copy-json-save]');withAction('save-copy-json','正在保存 JSON 接口…','JSON 接口配置已保存','保存 JSON 接口失败',()=>{saveCopyJsonModal();},b);return;}
  if(e.target.closest('[data-copy-json-format]')){try{formatCopyJsonModal();}catch(err){setActionStatus('error','JSON 校验失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-json-reset]')){COPY_API_CHANNEL=Object.assign({},COPY_API_DEFAULT);preparePresetCopyCase(COPY_CASE_ACTIVE);if($('copy-json-prompt'))$('copy-json-prompt').value=COPY_API_CHANNEL.jsonPrompt||COPY_JSON_PROMPT_DEFAULT;if($('copy-json-method'))$('copy-json-method').value=COPY_API_CHANNEL.method;if($('copy-json-endpoint'))$('copy-json-endpoint').value=COPY_API_CHANNEL.endpoint;if($('copy-json-response-path'))$('copy-json-response-path').value=COPY_API_CHANNEL.responsePath;if($('copy-json-template'))$('copy-json-template').value=COPY_API_CHANNEL.requestTemplate;updateCopyWorkspaceUi(COPY_API_CHANNEL.lastMapped);setActionStatus('success','JSON 接口已恢复默认',false);return;}
  const cpjt=e.target.closest('[data-copy-json-test]');if(cpjt){await testCopyJsonChannel(cpjt);return;}
  if(e.target.closest('[data-copy-json-copy-response]')){const v=($('copy-json-response')&&$('copy-json-response').value)||'';navigator.clipboard&&navigator.clipboard.writeText(v);setActionStatus('success','响应已复制',false);return;}
  if(e.target.closest('[data-copy-json-clear-response]')){COPY_API_CHANNEL.lastResponse='';saveCopyApiChannel();if($('copy-json-response'))$('copy-json-response').value='';if($('copy-mapper-raw'))$('copy-mapper-raw').value='{}';setActionStatus('success','最近响应已清空',false);return;}
  if(e.target.closest('[data-copy-field-monitor]')){await openBackendFieldMonitor();return;}
  if(e.target.closest('[data-copy-log-refresh]')||e.target.closest('[data-copy-open-backend-log]')){await openBackendLogs();return;}
  if(e.target.closest('[data-copy-log-clear]')){try{await fetch('/api/logs',{method:'DELETE'});setActionStatus('success','后台日志已清空',false);await openBackendLogs();}catch(err){setActionStatus('error','清空后台日志失败：'+err.message,false);}return;}
  if(e.target.closest('[data-copy-log-copy]')){try{const d=await fetchBackendLogs();navigator.clipboard&&navigator.clipboard.writeText(JSON.stringify(d.logs||[],null,2));setActionStatus('success','后台日志已复制',false);}catch(err){setActionStatus('error','复制后台日志失败：'+err.message,false);}return;}
  const save=e.target.closest('[data-api-save]');
  if(save){withAction('save-api-config','正在保存 API 配置…','API 配置已保存','保存 API 配置失败',()=>{saveApiFromModal(save.dataset.apiSave);modalClose();},save);return;}
  const load=e.target.closest('[data-api-load-models]');
  if(load){
    if(!actionLock('save-api-models',load))return;setActionStatus('loading','正在保存配置并载入模型…',true);
    try{saveApiFromModal(load.dataset.apiLoadModels);await loadApiModels();modalClose();actionDone('save-api-models','配置已保存，模型列表已载入');}
    catch(err){actionFail('save-api-models','模型载入失败：'+err.message);}
    return;
  }
  if(e.target.closest('[data-api-network-diagnose]')){await runDeepNetworkDiagnose();return;}
  if(e.target.closest('[data-api-diagnose]')){
    if($('api-base-url')) API_BRIDGE.baseUrl=normalizeSharedImageBase($('api-base-url').value.trim()||API_DEFAULT_BASE);
    if($('api-key')) API_BRIDGE.apiKey=$('api-key').value.trim()||API_DEFAULT_KEY;
    saveApiLocal(); await runApiDiagnose(true); return;
  }
  if(e.target.closest('[data-api-reset-default]')){
    withAction('save-api-reset','正在恢复 EvoLink 预接入配置…','EvoLink 预接入配置已恢复','恢复预接入配置失败',()=>{API_BRIDGE.baseUrl=API_DEFAULT_BASE;API_BRIDGE.apiKey='';API_BRIDGE.models=EVO_IMAGE?EVO_IMAGE.BUILTIN_IMAGE_MODELS.slice():[API_DEFAULT_IMAGE_MODEL];API_BRIDGE.imageModels=EVO_IMAGE?EVO_IMAGE.mergeImageModels(API_BRIDGE.models):API_BRIDGE.models.slice();API_BRIDGE.wireModel=API_DEFAULT_IMAGE_MODEL;API_BRIDGE.imageModel=API_DEFAULT_IMAGE_MODEL;saveApiLocal();SHARED_API_BOOTSTRAP.reset();modalClose();},e.target.closest('[data-api-reset-default]'));return;
  }
  if(e.target.closest('[data-api-dbg]')){ openDbgLog(); return; }
  if(e.target.closest('[data-dbg-clear]')){ API_DBG.length=0; openDbgLog(); apiToast('调试日志已清空'); return; }
  if(e.target.closest('[data-api-open-wire]')){ modalClose(); openCfg(); return; }
  if(e.target.closest('[data-api-open-copy]')){ modalClose(); openCopyApiConfig(); return; }
});

document.addEventListener('change',e=>{if(e.target&&e.target.matches&&e.target.matches('[data-map-field],#copy-profile-quick')){if(e.target.matches('[data-map-field]'))refreshMapperPreview();}const pg=e.target&&e.target.closest&&e.target.closest('[data-prompt-preview-group]');if(pg){wf.promptActiveGroupId=pg.value;const ta=$('prompt-group-json');if(ta)ta.value=promptGroupJsonText(pg.value);refreshPromptTargetUi(pg.value);}});
