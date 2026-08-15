/* ===== AI 线框生成 ===== */
let _id=0; const uid=()=>'g'+(++_id);
const nowStr=()=>new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'});
const DEFAULT_WF_PROMPT=`请基于上传的「排版参考图」与输入的「海报文案」生成图片。
核心要求：
严格保持「排版参考图」当前的整体版式、线框结构、构图比例、文字区域位置、文字大小层级、对齐方式、颜色、背景、图形元素、徽章/按钮/功能区样式不变。
仅执行一项操作：
将「海报文案」中的文字信息，替换到「排版参考图」中对应的文字位置。
替换规则：
1. 将「海报文案」中的主标题，替换到「排版参考图」原“某某某某”或者“主标题”的位置。
2. 将「海报文案」中的核心卖点/副标题，替换到「排版参考图」原“核心卖点”或者“副标题”位置。
3. 将「海报文案」中的小标题1/小标题2/小标题3，替换到「排版参考图」原小标题/功能区位置。
4. 将「海报文案」中的功能区，替换到「排版参考图」原“功能区”的位置。
5. 如有徽章内容、按钮文字、标签文字，只替换对应区域内的文字，不改变该区域的形状、大小、颜色和位置。
6. 文案需保持原排版参考图的字体风格、字号比例、粗细、颜色和层级关系；根据原文字框范围进行自然换行，保证文字完整可读。
禁止事项：
不要重新设计画面。
不要改变排版结构。
不要改变文字区域的位置和大小。
不要改变背景、色块、线框、徽章、按钮、功能区、装饰元素。
不要新增任何「海报文案」以外的文字。
不要自动补充、扩写、改写文案。
不要出现提示词、说明文字或无关文字。
最终效果：
只将「海报文案」的信息准确替换到「排版参考图」的文字信息中，除文字内容替换外，其余所有画面元素保持不变。`;
const WF_OVERVIEW_EXPANDED_KEY='wfWorkflowOverviewExpanded_v246';
const WF_ADVANCED_DEBUG_KEY='wfAdvancedDebug_v262';
function readWireOverviewExpanded(){
  try{const raw=localStorage.getItem(WF_OVERVIEW_EXPANDED_KEY);return typeof WireframeOverviewState!=='undefined'?WireframeOverviewState.normalizeExpanded(raw):raw==='1';}catch(_e){return false;}
}
function setWireOverviewExpanded(open){
  const value=!!open;wf.overviewExpanded=value;
  try{localStorage.setItem(WF_OVERVIEW_EXPANDED_KEY,value?'1':'0');}catch(_e){}
}
function readWireAdvancedDebug(){try{return localStorage.getItem(WF_ADVANCED_DEBUG_KEY)==='1';}catch(_e){return false;}}
function setWireAdvancedDebug(open){wf.advancedDebug=!!open;try{localStorage.setItem(WF_ADVANCED_DEBUG_KEY,wf.advancedDebug?'1':'0');}catch(_e){}return wf.advancedDebug;}
let wf={configured:false,baseUrl:'',key:'',builtin:DEFAULT_WF_PROMPT,groups:[],history:[],autoToImage:false,overviewExpanded:readWireOverviewExpanded(),advancedDebug:readWireAdvancedDebug(),promptTargetGroupIds:null,promptActiveGroupId:null,promptDiagnosisFilter:'all',issueCenterFilter:'all'};
const WF_GENERATED_HISTORY_KEY='wfGeneratedHistory_v26_fallback';
let wfHistoryTargetGroup=null;
function wireHistoryHostedRuntime(){
  try{return !!(typeof DeploymentRuntimeV29!=='undefined'&&DeploymentRuntimeV29.state&&DeploymentRuntimeV29.state.hosted);}catch(_e){return false;}
}
function isEphemeralWireHistoryAsset(src){return /^\/api\/wireframe-history\/assets\//i.test(String(src||'').trim());}
function pruneHostedWireHistory(){
  if(!wireHistoryHostedRuntime())return false;
  const before=(wf.history||[]).length;
  wf.history=(wf.history||[]).filter(item=>item&&item.src&&!isEphemeralWireHistoryAsset(item.src));
  if(wf.history.length!==before)saveGeneratedWireHistory();
  return wf.history.length!==before;
}
function resolveGeneratedWireResultSrc(generatedSrc,savedItem){
  const original=String(generatedSrc||'').trim(),persisted=String(savedItem&&savedItem.src||'').trim();
  if(wireHistoryHostedRuntime())return original;
  return persisted||original;
}
function wireHistoryId(){return 'wire-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
function loadGeneratedWireHistory(){
  try{
    const raw=localStorage.getItem(WF_GENERATED_HISTORY_KEY)||localStorage.getItem('wfGeneratedHistory_v116');
    if(!raw)return;
    const arr=JSON.parse(raw);
    if(Array.isArray(arr))wf.history=arr.filter(x=>x&&x.src).slice(0,30);
    pruneHostedWireHistory();
  }catch(_e){}
}
function saveGeneratedWireHistory(){
  const clean=(wf.history||[]).filter(x=>x&&x.src).slice(0,30);
  try{localStorage.setItem(WF_GENERATED_HISTORY_KEY,JSON.stringify(clean.slice(0,12)));return true;}catch(_e){return false;}
}
function addGeneratedWireHistory(g,i,src,extra={}){
  const item=Object.assign({id:wireHistoryId(),time:nowStr(),label:g.label||('第'+(i+1)+'组'),groupId:g.id||'',poster:g.poster||'',src,frameName:g.frame&&g.frame.name||'',model:(typeof API_BRIDGE!=='undefined'&&API_BRIDGE.wireModel)||'',prompt:'',status:'completed',sourceTaskId:''},extra||{});
  wf.history.unshift(item);
  if(wf.history.length>60)wf.history.length=60;
  saveGeneratedWireHistory();
  return item;
}
async function wireHistoryFetch(url,opt){
  const res=await fetch(url,Object.assign({cache:'no-store'},opt||{}));const text=await res.text();let data={};try{data=text?JSON.parse(text):{};}catch(_e){data={raw:text};}
  if(!res.ok||data.ok===false)throw new Error((data.error&&data.error.message)||data.message||('HTTP '+res.status));return data;
}
async function refreshGeneratedWireHistoryFromServer({migrate=true}={}){
  if(wireHistoryHostedRuntime()){
    pruneHostedWireHistory();
    saveGeneratedWireHistory();
    return wf.history;
  }
  try{
    const data=await wireHistoryFetch('/api/wireframe-history?limit=120');const remote=Array.isArray(data.items)?data.items:[];
    if(!remote.length&&migrate&&wf.history.length){
      const legacy=wf.history.slice(0,12);for(const item of legacy){try{await persistGeneratedWireHistoryItem(item);}catch(_e){}}
      const again=await wireHistoryFetch('/api/wireframe-history?limit=120');wf.history=Array.isArray(again.items)?again.items:wf.history;
    }else wf.history=remote;
    saveGeneratedWireHistory();return wf.history;
  }catch(_e){return wf.history;}
}
async function persistGeneratedWireHistoryItem(item){
  if(!item||!item.src)return item;
  if(wireHistoryHostedRuntime()){
    const idx=(wf.history||[]).findIndex(x=>x.id===item.id);if(idx>=0)wf.history[idx]=item;else wf.history.unshift(item);
    saveGeneratedWireHistory();return item;
  }
  const data=await wireHistoryFetch('/api/wireframe-history',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(item)});
  const saved=data.item||item,idx=(wf.history||[]).findIndex(x=>x.id===item.id);if(idx>=0)wf.history[idx]=saved;else wf.history.unshift(saved);saveGeneratedWireHistory();return saved;
}
async function deleteGeneratedWireHistoryItem(id){
  if(!wireHistoryHostedRuntime())try{await wireHistoryFetch('/api/wireframe-history/'+encodeURIComponent(id),{method:'DELETE'});}catch(_e){}
  wf.history=(wf.history||[]).filter(x=>x.id!==id);saveGeneratedWireHistory();
}
function resolveWireHistoryUseGroup(){
  if(Number.isInteger(wfHistoryTargetGroup)&&wf.groups[wfHistoryTargetGroup])return wfHistoryTargetGroup;
  const activeId=wf.promptActiveGroupId,activeIndex=activeId?wf.groups.findIndex(g=>g.id===activeId):-1;
  if(activeIndex>=0)return activeIndex;
  return wf.groups.length?0:null;
}
function wireHistoryModalHtml(){
  const useIndex=resolveWireHistoryUseGroup(),target=useIndex==null?null:wf.groups[useIndex];
  const emptyText=wireHistoryHostedRuntime()?'当前浏览器还没有 AI 线框生成记录。在线记录不会写入 Vercel 临时磁盘。':'还没有已持久化的 AI 线框生成记录。成功生成后会自动保存到本机 data/v26。';
  const items=(wf.history||[]).length?(wf.history||[]).map((h,i)=>`<article class="wire-history-card"><button class="wire-history-thumb" type="button" data-wfhist-preview="${i}" title="预览历史线框">${h.src?`<img src="${h.src}" alt="历史线框" loading="lazy">`:'<span>无预览</span>'}</button><div class="wire-history-info"><div class="wire-history-title"><b>${esc(h.label||('历史 '+(i+1)))}</b><small>${esc(h.time||h.createdAt||'')} · ${esc(h.model||'模型未记录')}</small></div><p>${esc((h.poster||'').replace(/\s+/g,' ').slice(0,120)||'无文案摘要')}</p><div class="wire-history-actions"><button class="mini-btn" data-wfhist-preview="${i}">预览</button><button class="mini-btn" data-wfhist-use="${i}">使用</button><button class="mini-btn danger" data-wfhist-delete="${i}">删除</button></div></div></article>`).join(''):`<div class="prompt-diagnosis-empty">${emptyText}</div>`;
  const storageHint=wireHistoryHostedRuntime()?'在线版记录仅保存在当前浏览器；图片继续使用 EvoLink 原始地址，不写入 Vercel /tmp。':'图片本体继续保存在本机 data/v26。';
  return `<h3>历史生成线框记录</h3><p class="hint">历史与当前结果已统一：每条记录只保留「预览 / 使用 / 删除」。${target?'“使用”会替换当前任务组：'+esc(target.label||'当前任务组'):'当前没有任务组，使用历史时会自动创建一组。'} ${storageHint}</p><div class="wire-history-list">${items}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-wfhist-refresh>刷新记录</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`;
}
function useWireHistory(idx){
  const h=(wf.history||[])[idx];if(!h||!h.src){setActionStatus('error','历史线框图不存在或已失效',false);return;}
  let gi=resolveWireHistoryUseGroup();
  if(gi==null){pushWf();const ng=newGroup('历史 · '+(h.label||'线框记录'),h.poster||'');wf.groups.push(ng);gi=wf.groups.length-1;}else pushWf();
  const g=wf.groups[gi];g.result={time:h.time||nowStr(),src:h.src,historyId:h.id};g.lastGenerateError='';wf.promptActiveGroupId=g.id;modalClose();if(curView!=='integrate')render('integrate');else renderWireframe();setActionStatus('success','已将历史线框图设为当前任务组结果',false);
}
async function openHist(targetGroup){
  wfHistoryTargetGroup=Number.isInteger(targetGroup)?targetGroup:null;
  modalOpen(`<h3>历史生成线框记录</h3><p class="hint">${wireHistoryHostedRuntime()?'正在读取当前浏览器的线框记录…':'正在读取本机历史库并整理缩略图…'}</p>`,true);
  await refreshGeneratedWireHistoryFromServer();modalRefresh(wireHistoryModalHtml(),true);
}
loadGeneratedWireHistory();
setTimeout(()=>refreshGeneratedWireHistoryFromServer().then(()=>{if(curView==='integrate'&&typeof renderWireframe==='function')renderWireframe();}).catch(()=>{}),300);
