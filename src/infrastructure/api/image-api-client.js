const EVO_IMAGE_API=window.EvoLinkImageAdapter||null;
function isEvolinkImageChannel(){return !!(EVO_IMAGE_API&&EVO_IMAGE_API.isEvolinkBase(API_BRIDGE.baseUrl));}
function currentImageGenerationOptions(model){
  const useModel=String(model||((typeof API_BRIDGE!=='undefined'&&API_BRIDGE.imageModel)||EVO_IMAGE_API&&EVO_IMAGE_API.DEFAULT_MODEL)||'');
  let raw={aspect:'1:1',resolution:'2K',quality:'中'};
  try{
    const isMainImage=typeof API_BRIDGE!=='undefined'&&useModel===API_BRIDGE.imageModel;
    if(isMainImage&&typeof img!=='undefined')raw={aspect:img.aspect||'1:1',resolution:img.resolution||'2K',quality:img.quality||'中'};
  }catch(_e){}
  if(EVO_IMAGE_API&&typeof EVO_IMAGE_API.normalizeModelOptions==='function')return EVO_IMAGE_API.normalizeModelOptions(useModel,raw);
  return raw;
}
let imageTaskCenterItems=[];
async function localDataFetch(url,options){
  try{if(!API_BRIDGE.proxyReady)await checkProxy();}catch(e){throw new Error(e.message);}
  const opt=Object.assign({},options||{});opt.headers=Object.assign({'Content-Type':'application/json'},opt.headers||{});const res=await fetch(url,opt);const text=await res.text();let data={};try{data=text?JSON.parse(text):{};}catch(_e){data={raw:text};}
  if(!res.ok||data.ok===false)throw new Error((data.error&&data.error.message)||data.message||data.raw||('HTTP '+res.status));return data;
}
async function persistImageTaskUpdate(update){
  if(!update||!update.taskId)return null;
  const payload=Object.assign({id:update.taskId,source:'evolink'},update);const data=await localDataFetch('/api/image-tasks',{method:'POST',body:JSON.stringify(payload)});const saved=data.item||payload;const idx=imageTaskCenterItems.findIndex(x=>x.id===saved.id||x.taskId===saved.taskId);if(idx>=0)imageTaskCenterItems[idx]=saved;else imageTaskCenterItems.unshift(saved);return saved;
}
async function loadImageTaskCenterItems(){
  const data=await localDataFetch('/api/image-tasks?limit=300');imageTaskCenterItems=Array.isArray(data.items)?data.items:[];return imageTaskCenterItems;
}
function imageTaskStatusText(s){const v=String(s||'').toLowerCase();return ({submitted:'已提交',queued:'排队中',pending:'排队中',processing:'生成中',running:'生成中',completed:'已完成',success:'已完成',failed:'失败',timeout:'超时'})[v]||v||'未知';}
function imageTaskStatusClass(s){const v=String(s||'').toLowerCase();if(/complete|success/.test(v))return'ok';if(/fail|timeout/.test(v))return'bad';return'warn';}
function imageTaskCenterHtml(){
  const active=imageTaskCenterItems.filter(x=>!/complete|success|fail|timeout/i.test(String(x.status||''))).length;
  const rows=imageTaskCenterItems.length?imageTaskCenterItems.map((t,i)=>{const urls=Array.isArray(t.resultUrls)?t.resultUrls:[],err=String(t.error||'');return `<div class="history-item image-task-item"><div class="history-info" style="width:100%"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(t.stage||'AI 生图')} · ${esc(t.model||'未记录模型')}</b><span class="prompt-diag-chip ${imageTaskStatusClass(t.status)}">${imageTaskStatusText(t.status)}${Number(t.progress)>0?' '+Math.round(Number(t.progress))+'%':''}</span></div><small>task_id：${esc(t.taskId||t.id||'')} · 提交：${esc(t.submittedAt||t.createdAt||'')}</small><p>${esc(String(t.prompt||'').replace(/\s+/g,' ').slice(0,240)||'无 Prompt 摘要')}</p>${err?`<div class="notebox" style="margin:6px 0;background:#fff1f2;border-color:#fecdd3;color:#9f1239">${esc(err)}</div>`:''}${urls.length?`<div class="thumb-grid">${urls.slice(0,4).map(u=>`<div class="thumb-card"><img src="${u}" alt="生图结果"><div class="thumb-actions"><button class="mini-btn" data-image-task-preview="${i}" data-result-index="${urls.indexOf(u)}">预览</button></div></div>`).join('')}</div>`:''}<div class="row" style="gap:6px;margin-top:8px"><button class="mini-btn" data-image-task-refresh="${i}">刷新状态</button><button class="mini-btn" data-image-task-delete="${i}">删除记录</button></div></div></div>`;}).join(''):`<div class="prompt-diagnosis-empty">暂无生图任务。提交 EvoLink 生图后，task_id、模型、Prompt、进度、失败原因和结果地址会自动保存在本机。</div>`;
  return `<h3>生图任务中心</h3><p class="hint">V26 本地持久化异步任务。页面刷新或程序重启后仍可查看；“刷新状态”只查询已有 task_id，不会重新提交生图。</p><div class="layout-check-summary"><span>全部 ${imageTaskCenterItems.length}</span><span>进行中 ${active}</span><button class="btn btn-violet" data-image-task-refresh-all>刷新进行中任务</button></div><div class="image-task-center-list">${rows}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`;
}
async function refreshOneImageTask(t){
  if(!t||!t.taskId)return t;const status=String(t.status||'').toLowerCase();if(/complete|success|fail|timeout/.test(status))return t;if(!API_BRIDGE.baseUrl||!API_BRIDGE.apiKey)throw new Error('刷新云端任务状态需要先配置 EvoLink API Key');
  const d=await apiFetchJSON('/api/tasks/'+encodeURIComponent(t.taskId),{method:'GET'},{model:t.model||API_BRIDGE.imageModel,stage:'V26 任务中心恢复轮询',taskId:t.taskId});const info=EVO_IMAGE_API.taskInfo(d),urls=EVO_IMAGE_API.extractImages(d),err=info.error&&(info.error.message||info.error.code)||'';return persistImageTaskUpdate(Object.assign({},t,{taskId:t.taskId,status:urls.length?'completed':(info.status||t.status),progress:urls.length?100:(Number.isFinite(info.progress)?info.progress:t.progress||0),error:String(err||''),resultUrls:urls.length?urls:(t.resultUrls||[])}));
}
async function openImageTaskCenter(){
  modalOpen('<h3>生图任务中心</h3><p class="hint">正在读取本机任务库…</p>',true);try{await loadImageTaskCenterItems();modalRefresh(imageTaskCenterHtml(),true);}catch(e){modalRefresh(`<h3>生图任务中心</h3><div class="notebox">读取失败：${esc(e.message)}</div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}
}
async function resumePendingImageTasksOnce(){
  await loadImageTaskCenterItems();
  if(!API_BRIDGE.baseUrl||!API_BRIDGE.apiKey)return imageTaskCenterItems;
  const pending=imageTaskCenterItems.filter(t=>t&&t.taskId&&!/complete|success|fail|timeout/i.test(String(t.status||''))).slice(0,12);
  for(const t of pending){try{await refreshOneImageTask(t);}catch(err){dbgLog({ok:false,endpoint:'/api/tasks/'+encodeURIComponent(t.taskId),model:t.model||'',status:0,error:'V26 恢复已有异步任务状态失败：'+err.message,channel:'V26 生图任务中心'});}}
  return imageTaskCenterItems;
}
setTimeout(()=>resumePendingImageTasksOnce().then(()=>{if(typeof curView!=='undefined'&&curView==='image'&&typeof renderImageView==='function')renderImageView();}).catch(()=>{}),500);
function aspectToSize(aspect){
  if(isEvolinkImageChannel())return EVO_IMAGE_API.normalizeAspect(aspect||'1:1');
  const map={'1:1':'1024x1024','3:4':'1024x1536','4:3':'1536x1024','9:16':'1024x1536','16:9':'1536x1024'};
  return map[aspect] || '1024x1024';
}
async function evolinkGenerateImages(prompt,model,count,aspect,refs,mask,fetcher,meta){
  const opt=currentImageGenerationOptions(model),requestedAspect=aspect||opt.aspect;
  return EVO_IMAGE_API.generate({fetchJson:fetcher||apiFetchJSON,prompt,model,count,aspect:requestedAspect,refs:refs||[],mask:mask||'',resolution:opt.resolution,quality:opt.quality,meta:meta||{model},onTaskUpdate:update=>{persistImageTaskUpdate(update).catch(err=>dbgLog({ok:false,endpoint:'/api/image-tasks',model,status:0,error:'任务中心保存失败：'+err.message,channel:'V26 本地任务中心'}));}});
}
function requireModel(kind){
  const m = kind==='image' ? API_BRIDGE.imageModel : (kind==='copy'?API_BRIDGE.copyModel:API_BRIDGE.wireModel);
  if(!m) throw new Error(kind==='image'
    ? '尚未选择生图模型：请到「API 接入配置」点“载入生图模型”，默认建议 gemini-3.1-flash-lite-image；也可选择 GPT Image / Seedream / Qwen / Midjourney / Wan 等 EvoLink 图像模型。'
    : (kind==='copy'?'尚未选择文案生成模型：请到「文案生成 → AI 接入配置」载入模型，并选择一个文本/对话模型。':'尚未选择线框生成模型：请到「AI 接入配置」点“载入生图模型”，并选择一个 EvoLink 图像模型。'));
  return m;
}
function extractChatContent(data){
  return (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content)
    || (data.output_text)
    || (data.choices && data.choices[0] && data.choices[0].text)
    || '';
}
async function apiChat(prompt, model){
  const useModel = model || requireModel('wire');
  // 直出：只调用所选模型的 /chat/completions，不再降级到 /responses，避免“两个接口都不支持”的报错
  const data = await apiFetchJSON('/api/chat/completions', {
    method:'POST',
    body: JSON.stringify({
      model: useModel,
      messages: [
        {role:'system', content:'你是一个电商视觉工作流助手。请严格根据用户输入生成结构化、可执行的设计说明。'},
        {role:'user', content: prompt}
      ],
      temperature: 0.2
    })
  }, {model:useModel});
  return extractChatContent(data) || JSON.stringify(data).slice(0,2000);
}

function requireAnalysisModel(allowFallback=true){
  const list=(API_BRIDGE.textModels||[]).filter(x=>!/embedding|rerank|tts|audio|speech/i.test(x));
  const vision=list.find(x=>/vision|vl|gpt-4o|gpt-5|gemini|claude|qwen|doubao/i.test(x));
  const m=vision||list[0]||(allowFallback?API_BRIDGE.wireModel:'');
  if(!m)throw new Error('尚未找到可用于图片分析的视觉/文本模型，请在 AI 接入配置中载入模型列表');return m;
}
async function apiVisionJson(imageSrc,prompt){
  const useModel=requireAnalysisModel(true),url=await normalizeVisionImageSource(imageSrc);
  const data=await apiFetchJSON('/api/chat/completions',{
    method:'POST',body:JSON.stringify({model:useModel,messages:[{role:'system',content:'你是专业的电商视觉版式分析器。必须只输出严格有效的 JSON。'},{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url,detail:'high'}}]}],temperature:0.1})
  },{model:useModel});
  return extractChatContent(data)||JSON.stringify(data).slice(0,5000);
}
function imgErr(e, useModel){
  if(e&&(e.httpStatus===402||e.kind==='credits'||/insufficient[_\s-]?(?:credits|quota)|额度不足|余额不足/i.test(String(e.message||''))))return e;
  if(/model|not\s*found|unsupported|not\s*support|invalid|400|404|不支持/i.test(e.message))
    return new Error('生图模型「'+useModel+'」当前调用失败。V27 默认使用 EvoLink /v1/images/generations；请确认模型权限与参数。原始错误：'+e.message);
  return e;
}
function dataURLtoBlob(dataurl){
  const arr=String(dataurl).split(','); const m=(arr[0].match(/:(.*?);/)||[])[1]||'image/png';
  const bstr=atob(arr[1]||''); let n=bstr.length; const u8=new Uint8Array(n);
  while(n--) u8[n]=bstr.charCodeAt(n);
  return new Blob([u8],{type:m});
}
function loadImageSize(src){
  return new Promise(res=>{ try{ const im=new Image(); im.onload=()=>res({w:im.naturalWidth||1024,h:im.naturalHeight||1024}); im.onerror=()=>res({w:1024,h:1024}); im.src=src; }catch(e){ res({w:1024,h:1024}); } });
}
function ratioToAspect(w,h){ const r=w/h; if(r>1.2) return '4:3'; if(r<0.83) return '3:4'; return '1:1'; }
// 图像编辑：支持原图、彩色标注图与多个黑白 Mask 组成的多图局部编辑请求（multipart /v1/images/edits）
async function apiImageEditMulti(prompt, model, imageDataUrls, count, aspect){
  const useModel = model || requireModel('image');
  if(!API_BRIDGE.baseUrl || !API_BRIDGE.apiKey) throw new Error('请先填写 EvoLink Base URL 和 API 密钥');
  if(isEvolinkImageChannel())return evolinkGenerateImages(prompt,useModel,count||1,aspect,(imageDataUrls||[]).filter(Boolean),'',apiFetchJSON,{model:useModel,stage:'EvoLink 图生图/编辑'});
  try{ if(!API_BRIDGE.proxyReady) await checkProxy(); }catch(e){ throw new Error(e.message); }
  const urls=(imageDataUrls||[]).filter(Boolean);
  if(!urls.length) throw new Error('没有可用于编辑的图片');
  const fd=new FormData();
  fd.append('model', useModel);
  fd.append('prompt', prompt);
  fd.append('n', String(count||1));
  if(aspect) fd.append('size', aspectToSize(aspect)); // 统一所有结果图尺寸/比例，避免第一张与其它不一致
  try{
    if(urls.length===1){ fd.append('image', dataURLtoBlob(urls[0]), 'image.png'); }
    else { urls.forEach((u,i)=>fd.append('image[]', dataURLtoBlob(u), 'image'+i+'.png')); }
  }catch(e){ throw new Error('图片处理失败：'+e.message); }
  const h=apiHeaders(); const headers={};
  Object.keys(h).forEach(k=>{ if(k.toLowerCase()!=='content-type') headers[k]=h[k]; });
  let res;
  try{ res=await fetch('/api/images/edits', {method:'POST', headers, body:fd}); }
  catch(e){ dbgLog({ok:false,endpoint:'/api/images/edits',model:useModel,status:0,error:'fetch 失败：'+e.message,channel:'浏览器 → Node 本地代理'}); throw new Error('请求本地代理失败：'+e.message); }
  const txt=await res.text();
  let data=null; try{ data=txt?JSON.parse(txt):{}; }catch(e){ data={raw:txt}; }
  if(!res.ok){
    const msg=data&&(data.error&&(data.error.message||data.error)||data.message||data.raw)||('HTTP '+res.status);
    dbgLog({ok:false,endpoint:'/api/images/edits',model:useModel,status:res.status,error:(txt||String(msg)).slice(0,600),channel:'Node 本地代理 /api'});
    throw new Error(typeof msg==='string'?msg:JSON.stringify(msg));
  }
  dbgLog({ok:true,endpoint:'/api/images/edits',model:useModel,status:res.status,channel:'Node 本地代理 /api'});
  const arr=data.data||data.images||[];
  const imgs=arr.map(x=> typeof x==='string'?x:(x.b64_json?('data:image/png;base64,'+x.b64_json):(x.url||''))).filter(Boolean);
  if(!imgs.length) throw new Error('编辑接口返回空结果');
  return imgs;
}
async function apiImageEditNativeMask(prompt,model,imageDataUrl,maskDataUrl,count,aspect){
  const useModel=model||requireModel('image');if(!API_BRIDGE.baseUrl||!API_BRIDGE.apiKey)throw new Error('请先填写 EvoLink Base URL 和 API 密钥');
  if(isEvolinkImageChannel())return evolinkGenerateImages(prompt,useModel,count||1,aspect,[imageDataUrl].filter(Boolean),maskDataUrl,apiFetchJSON,{model:useModel,stage:'EvoLink Mask 编辑'});
  try{if(!API_BRIDGE.proxyReady)await checkProxy();}catch(e){throw new Error(e.message);}
  const fd=new FormData();fd.append('model',useModel);fd.append('prompt',prompt);fd.append('n',String(count||1));if(aspect)fd.append('size',aspectToSize(aspect));
  fd.append('image',dataURLtoBlob(imageDataUrl),'image.png');fd.append('mask',dataURLtoBlob(maskDataUrl),'mask.png');
  const h=apiHeaders(),headers={};Object.keys(h).forEach(k=>{if(k.toLowerCase()!=='content-type')headers[k]=h[k];});
  const res=await fetch('/api/images/edits',{method:'POST',headers,body:fd});const txt=await res.text();let data={};try{data=txt?JSON.parse(txt):{};}catch(e){data={raw:txt};}
  if(!res.ok){const msg=data&&(data.error&&(data.error.message||data.error)||data.message||data.raw)||('HTTP '+res.status);throw new Error(typeof msg==='string'?msg:JSON.stringify(msg));}
  const arr=data.data||data.images||[],imgs=arr.map(x=>typeof x==='string'?x:(x.b64_json?('data:image/png;base64,'+x.b64_json):(x.url||''))).filter(Boolean);if(!imgs.length)throw new Error('蒙版编辑接口返回空结果');return imgs;
}
async function apiImageEdit(prompt, model, imageDataUrl){ return apiImageEditMulti(prompt, model, [imageDataUrl], 1); }
// refImages: 作为底图/参考图一起上传的图片（data URL 数组）。支持图生图：以参考图为底图，按提示词替换文字。
async function apiImage(prompt, model, count, aspect, refImages){
  const useModel = model || requireModel('image');
  const refs = (refImages||[]).filter(Boolean);
  if(isEvolinkImageChannel())return evolinkGenerateImages(prompt,useModel,count||1,aspect,refs,'',apiFetchJSON,{model:useModel,stage:refs.length?'EvoLink 图生图':'EvoLink 文生图'});
  const mkBody = (withRefs, sizeOverride)=>{
    const b = { model: useModel, prompt, n: count || 1, size: sizeOverride || aspectToSize(aspect || '1:1') };
    if(withRefs && refs.length){ b.image = refs.length===1 ? refs[0] : refs; }
    return b;
  };
  const fire = (withRefs, sizeOverride)=>apiFetchJSON('/api/images/generations', {method:'POST', body: JSON.stringify(mkBody(withRefs, sizeOverride))}, {model:useModel});
  const isSizeErr = (msg)=>/size|divisible|尺寸|width\s*and\s*height|must be one of/i.test(msg);
  const isRefErr  = (msg)=>/image|images|field|param|unsupported|invalid|400|不支持|bad\s*request/i.test(msg);
  let data;
  try{
    data = await fire(refs.length>0);
  }catch(e){
    if(isSizeErr(e.message)){
      // 尺寸不被该模型接受 → 退回 1024x1024 再试（仍带参考底图）
      try{ data = await fire(refs.length>0, '1024x1024'); }
      catch(e3){
        if(refs.length && isRefErr(e3.message)){
          try{ data = await fire(false, '1024x1024'); apiToast('该接口未接受参考底图，已改为仅用「内置提示词 + 文案」生图', true); }
          catch(e4){ throw imgErr(e4, useModel); }
        } else throw imgErr(e3, useModel);
      }
    } else if(refs.length && isRefErr(e.message)){
      try{ data = await fire(false); apiToast('注意：该生图接口未接受参考底图，已改为仅用「内置提示词 + 文案」生图（文案仍然生效）', true); }
      catch(e2){
        if(isSizeErr(e2.message)){ try{ data = await fire(false, '1024x1024'); }catch(e5){ throw imgErr(e5, useModel); } }
        else throw imgErr(e2, useModel);
      }
    } else { throw imgErr(e, useModel); }
  }
  const arr = data.data || data.images || [];
  const imgs = arr.map(x=>{
    if(typeof x==='string') return x;
    if(x.b64_json) return 'data:image/png;base64,'+x.b64_json;
    if(x.url) return x.url;
    return '';
  }).filter(Boolean);
  if(!imgs.length) throw new Error('生图接口返回空结果；请确认所选生图模型「'+useModel+'」可用。');
  return imgs;
}
