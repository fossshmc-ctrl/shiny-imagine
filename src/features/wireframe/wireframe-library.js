/* —— 线框图素材库 —— */
/* V26：保留素材恢复与折叠总览，并增加页面专属共享图像通道状态。 */
const WIRE_ASSET_VERSION='27.3.0';
function canonicalWireframeSrc(src){
  return (typeof AssetUrl!=='undefined'&&AssetUrl.normalizeBuiltinAssetUrl)
    ? AssetUrl.normalizeBuiltinAssetUrl(src,WIRE_ASSET_VERSION)
    : String(src||'');
}
function builtinWireframe(name,src,index){return{id:uid(),name,time:Date.now()+index*1000,src:canonicalWireframeSrc(src),builtin:true,assetKey:(typeof AssetUrl!=='undefined'&&AssetUrl.assetKey)?AssetUrl.assetKey(src):''};}
const WLS_IMAGES=[
  {"name":"沃朗森-图2","src":"/assets/wolassen/02.jpg"},
  {"name":"沃朗森-图3","src":"/assets/wolassen/03.jpg"},
  {"name":"沃朗森-图4","src":"/assets/wolassen/04.jpg"},
  {"name":"沃朗森-图5","src":"/assets/wolassen/05.jpg"},
  {"name":"沃朗森-图6","src":"/assets/wolassen/06.jpg"},
  {"name":"沃朗森-图7","src":"/assets/wolassen/07.jpg"},
  {"name":"沃朗森-图8","src":"/assets/wolassen/08.jpg"},
  {"name":"沃朗森-图9","src":"/assets/wolassen/09.jpg"},
  {"name":"沃朗森-图10","src":"/assets/wolassen/10.jpg"}
];
const WLS_LIBRARY_VERSION='v25.5-wolassen-nine-assets-20260807';
function wfSvg(seed){
  const hue=['#e2e8f0','#ddd6fe','#bfdbfe','#fde68a','#bbf7d0','#fecaca'][seed%6];
  const v=seed%3;
  const b = v===0
    ? '<rect x="14" y="14" width="92" height="16" rx="3"/><circle cx="60" cy="78" r="32"/><rect x="20" y="120" width="80" height="9" rx="3"/><rect x="30" y="134" width="60" height="7" rx="3"/><rect x="34" y="148" width="52" height="13" rx="4" fill="#ef4444" opacity=".7"/>'
    : v===1
    ? '<rect x="14" y="14" width="60" height="14" rx="3"/><rect x="14" y="34" width="92" height="58" rx="4"/><rect x="20" y="102" width="44" height="8" rx="3"/><rect x="20" y="114" width="70" height="8" rx="3"/><rect x="20" y="138" width="50" height="14" rx="4" fill="#ef4444" opacity=".7"/>'
    : '<rect x="20" y="14" width="80" height="12" rx="3"/><rect x="14" y="32" width="44" height="48" rx="4"/><rect x="64" y="32" width="42" height="48" rx="4"/><rect x="20" y="92" width="80" height="8" rx="3"/><rect x="20" y="104" width="64" height="8" rx="3"/><rect x="34" y="130" width="52" height="14" rx="4" fill="#ef4444" opacity=".7"/>';
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="160" viewBox="0 0 120 160"><rect width="120" height="160" rx="8" fill="${hue}"/><g fill="#94a3b8">${b}</g></svg>`;
  return 'data:image/svg+xml;utf8,'+encodeURIComponent(svg);
}
const LEB_IMAGES=[{"name":"勒宝-图2","src":"/assets/lebao/02.jpg"},{"name":"勒宝-图3","src":"/assets/lebao/03.jpg"},{"name":"勒宝-图4","src":"/assets/lebao/04.jpg"},{"name":"勒宝-图5","src":"/assets/lebao/05.jpg"},{"name":"勒宝-图6","src":"/assets/lebao/06.jpg"},{"name":"勒宝-图7","src":"/assets/lebao/07.jpg"},{"name":"勒宝-图8","src":"/assets/lebao/08.jpg"},{"name":"勒宝-图9","src":"/assets/lebao/09.jpg"},{"name":"勒宝-图10","src":"/assets/lebao/10.jpg"}];
const LEB_LIBRARY_VERSION='v25.5-lebao-nine-assets-20260807';
let lib=[], activeCat=null, pickerGroup=null, _dragImg=null, loadedLebVersion='', loadedWlsVersion='';
function mkImg(name,seed){return{id:uid(),name,time:Date.now()+seed*1000,src:wfSvg(seed)};}
const LIB_KEY='wfLib_v1';
function normalizeLibraryAssetSources(input){
  return (Array.isArray(input)?input:[]).map(cat=>Object.assign({},cat,{imgs:(Array.isArray(cat&&cat.imgs)?cat.imgs:[]).map(im=>{
    const next=Object.assign({},im),normalized=canonicalWireframeSrc(next.src);
    if(normalized!==next.src)next.src=normalized;
    if(typeof AssetUrl!=='undefined'&&AssetUrl.isBuiltinAsset&&AssetUrl.isBuiltinAsset(next.src)){next.builtin=true;next.assetKey=AssetUrl.assetKey(next.src);}
    return next;
  })}));
}
function saveLib(){try{lib=normalizeLibraryAssetSources(lib);localStorage.setItem(LIB_KEY,JSON.stringify({lib,activeCat,lebVersion:LEB_LIBRARY_VERSION,wlsVersion:WLS_LIBRARY_VERSION,assetVersion:WIRE_ASSET_VERSION}));loadedLebVersion=LEB_LIBRARY_VERSION;loadedWlsVersion=WLS_LIBRARY_VERSION;return true;}catch(e){if(!saveLib._warned){saveLib._warned=true;toast('本地存储已满，保存失败',true);}return false;}}
function loadLib(){try{const s=localStorage.getItem(LIB_KEY);if(s){const d=JSON.parse(s);if(d&&Array.isArray(d.lib)&&d.lib.length){lib=normalizeLibraryAssetSources(d.lib);loadedLebVersion=d.lebVersion||'';loadedWlsVersion=d.wlsVersion||'';activeCat=d.activeCat&&lib.find(c=>c.id===d.activeCat)?d.activeCat:lib[0].id;return true;}}}catch(e){}return false;}
function ensureBuiltinCategory(name,images){
  if(!images||!images.length)return;
  let cat=lib.find(c=>c.name===name);
  if(!cat){cat={id:uid(),name,imgs:[]};lib.push(cat);}
  if(!Array.isArray(cat.imgs))cat.imgs=[];
  images.forEach((x,i)=>{
    const canonical=canonicalWireframeSrc(x.src),existing=cat.imgs.find(im=>im.name===x.name||(typeof AssetUrl!=='undefined'&&AssetUrl.assetKey&&AssetUrl.assetKey(im.src)===AssetUrl.assetKey(canonical)));
    if(existing){existing.src=canonical;existing.builtin=true;existing.assetKey=typeof AssetUrl!=='undefined'&&AssetUrl.assetKey?AssetUrl.assetKey(canonical):'';}
    else cat.imgs.push(builtinWireframe(x.name,canonical,i));
  });
}
function resetBuiltinCategory(cat,images){cat.imgs=(images||[]).map((x,i)=>builtinWireframe(x.name,x.src,i));}
function ensureBuiltinWireframes(){
  const previousActive=activeCat;
  let wls=lib.find(c=>c.name==='沃朗森');
  if(!wls){wls={id:uid(),name:'沃朗森',imgs:[]};lib.push(wls);}
  if(loadedWlsVersion!==WLS_LIBRARY_VERSION)resetBuiltinCategory(wls,WLS_IMAGES);else ensureBuiltinCategory('沃朗森',WLS_IMAGES);
  let lebao=lib.find(c=>c.name==='勒宝');
  if(!lebao){lebao={id:uid(),name:'勒宝',imgs:[]};lib.push(lebao);}
  if(loadedLebVersion!==LEB_LIBRARY_VERSION)resetBuiltinCategory(lebao,LEB_IMAGES);else ensureBuiltinCategory('勒宝',LEB_IMAGES);
  activeCat=lib.some(c=>c.id===previousActive)?previousActive:(lib[0]&&lib[0].id)||lebao.id;
  saveLib();
}
(function initLib(){
  const defs=[['常规',[1,2,3]],['维邦乐',[4,5]],['加尔夫',[6,7]]];
  lib=defs.map(d=>({id:uid(),name:d[0],imgs:d[1].map(s=>mkImg(d[0]+'-0'+s,s))}));
  lib.push({id:uid(),name:'沃朗森',imgs:WLS_IMAGES.map((x,i)=>builtinWireframe(x.name,x.src,i))});
  lib.push({id:uid(),name:'勒宝',imgs:LEB_IMAGES.map((x,i)=>builtinWireframe(x.name,x.src,i))});
  activeCat=lib[0].id;
  loadLib();
  ensureBuiltinWireframes();
})();

function wireGroupGenerationMeta(g){
  if(g.generating)return {text:'生成中',cls:'run'};
  if(g.lastGenerateError)return {text:'生成失败',cls:'bad'};
  if(g.result&&g.result.src)return {text:'已生成',cls:'ok'};
  if(g.frame&&g.poster&&g.poster.trim())return {text:'待生成',cls:'wait'};
  return {text:'待补资料',cls:'bad'};
}
function wireWorkflowOverviewStats(){
  const checks={
    isBound:g=>groupSourceInfo(g).bound,
    hasFrame:g=>!!(g&&g.frame&&g.frame.src),
    hasJson:g=>!!ensureWireJsonState(g).jsonText.trim(),
    isLinked:g=>isPromptLinkedForGroup(g),
    isDone:g=>!!(g&&g.result&&g.result.src),
    isFailed:g=>!!(g&&g.lastGenerateError)
  };
  if(typeof WireframeOverviewState!=='undefined')return WireframeOverviewState.summarizeGroups(wf.groups,checks);
  return {all:wf.groups.length,bound:wf.groups.filter(checks.isBound).length,frame:wf.groups.filter(checks.hasFrame).length,json:wf.groups.filter(checks.hasJson).length,linked:wf.groups.filter(checks.isLinked).length,done:wf.groups.filter(checks.isDone).length,needsAttention:wf.groups.filter(g=>checks.isFailed(g)||!checks.isBound(g)||!checks.hasFrame(g)||!checks.hasJson(g)||!checks.isLinked(g)).length};
}
function renderWireOverviewRows(){
  if(!wf.groups.length)return '<div class="wf-overview-empty">当前还没有线框任务组。添加任务组或从“文案生成”带入版本后，这里会集中显示联通状态。</div>';
  const debug=!!wf.advancedDebug;
  const rows=wf.groups.map((g,i)=>{const src=groupSourceInfo(g),gen=wireGroupGenerationMeta(g),linked=isPromptLinkedForGroup(g),js=taskJsonSyncMeta(g,i);return debug
    ? `<tr><td><b>${esc(g.label||('第 '+(i+1)+' 组'))}</b><div class="wf-source-note">${src.bound?'固定绑定：'+esc(src.label):'未绑定来源版本'}</div></td><td><span class="wf-status-chip ${src.bound?'ok':'bad'}">${src.bound?'版本 '+src.c.version:'未绑定'}</span></td><td><span class="wf-status-chip ${g.frame?'ok':'bad'}">${g.frame?esc(g.frame.name||'已选择'):'未选择'}</span></td><td><span class="wf-status-chip ${js.id==='synced'?'ok':js.id==='changed'?'wait':'bad'}">${js.label}</span><div class="wf-source-note">${esc(js.time)}</div></td><td><span class="wf-status-chip ${linked?'ok':'bad'}">${linked?'已联通':'未联通'}</span></td><td><span class="wf-status-chip ${gen.cls}">${gen.text}</span></td><td><div class="wf-overview-actions"><button class="mini-btn" data-wfstatus-jump="${i}">定位</button><button class="mini-btn" data-wfstatus-sync="${i}" ${src.bound?'':'disabled'}>同步文案</button><button class="mini-btn" data-task-json-history="${g.id}">JSON 历史</button></div></td></tr>`
    : `<tr><td><b>${esc(g.label||('第 '+(i+1)+' 组'))}</b><div class="wf-source-note">${src.bound?'固定绑定：'+esc(src.label):'未绑定来源版本'}</div></td><td><span class="wf-status-chip ${src.bound?'ok':'bad'}">${src.bound?'版本 '+src.c.version:'未绑定'}</span></td><td><span class="wf-status-chip ${g.frame?'ok':'bad'}">${g.frame?esc(g.frame.name||'已选择'):'未选择'}</span></td><td><span class="wf-status-chip ${linked?'ok':'bad'}">${linked?'已联通':'未联通'}</span></td><td><span class="wf-status-chip ${gen.cls}">${gen.text}</span></td><td><div class="wf-overview-actions"><button class="mini-btn" data-wfstatus-jump="${i}">定位</button><button class="mini-btn" data-wfstatus-sync="${i}" ${src.bound?'':'disabled'}>同步文案</button></div></td></tr>`;}).join('');
  return debug
    ? `<div class="wf-overview-body"><table class="wf-overview-table"><thead><tr><th>任务组</th><th>文案版本</th><th>线框素材</th><th>JSON</th><th>提示词</th><th>生成状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`
    : `<div class="wf-overview-body"><table class="wf-overview-table"><thead><tr><th>任务组</th><th>文案版本</th><th>线框素材</th><th>提示词</th><th>生成状态</th><th>操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function renderWireWorkflowOverview(){
  const stats=wireWorkflowOverviewStats(),open=wf.overviewExpanded?' open':'';
  const autoText=wf.autoToImage?'当前已开启，线框生成成功后将自动进入 AI 生图并带入本组线框与文案。':'当前已关闭，线框生成后停留在本页，由你手动进入 AI 生图。';
  return `<details class="wf-workflow-overview" data-wf-workflow-overview${open}>
    <summary>
      <span class="wf-workflow-summary-copy"><span class="wf-workflow-summary-title">生成规则与任务组状态</span><span class="wf-workflow-summary-desc">点击展开查看生成逻辑、自动流转说明和任务组联通情况</span></span>
      <span class="wf-workflow-summary-meta"><span class="wf-workflow-auto ${wf.autoToImage?'on':'off'}">自动流转 ${wf.autoToImage?'已开启':'已关闭'}</span><span>任务 ${stats.all}</span><span class="${stats.needsAttention?'warn':'ok'}">待处理 ${stats.needsAttention}</span><span>已生成 ${stats.done}</span><span class="wf-workflow-chevron" aria-hidden="true">⌄</span></span>
    </summary>
    <div class="wf-workflow-content">
      <section class="wf-workflow-logic" aria-label="AI 线框生成逻辑">
        <div class="wf-workflow-section-head"><div><h3>生成逻辑</h3><p>三个输入共同约束 AI 线框输出，展开后集中查看，不再占用页面常驻空间。</p></div></div>
        <div class="wf-logic-equation"><span>内置提示词</span><b>+</b><span>排版参考图</span><b>+</b><span>海报文案</span><b>=</b><strong>AI 生成线框图</strong></div>
        <div class="wf-logic-grid"><div><b>排版参考图</b><p>约束版式结构与构图。</p></div><div><b>海报文案</b><p>约束标题、辅助信息与卖点内容。</p></div><div><b>内置提示词</b><p>约束线框输出规则。</p></div></div>
        <div class="wf-auto-flow-note ${wf.autoToImage?'on':'off'}"><b>自动流转：</b>${autoText}</div>
      </section>
      <section class="wf-workflow-status" aria-label="任务组联通状态总览">
        <div class="wf-workflow-section-head"><div><h3>任务组联通状态总览</h3><p>${wf.advancedDebug?'高级/调试模式：显示任务 JSON 同步状态。':'普通模式：只显示文案、素材、联通与生成状态。'}</p></div><div class="wf-overview-counts"><span>任务 ${stats.all}</span><span>绑定 ${stats.bound}</span><span>素材 ${stats.frame}</span>${wf.advancedDebug?`<span>JSON ${stats.json}</span>`:''}<span>联通 ${stats.linked}</span><span>已生成 ${stats.done}</span></div></div>
        ${renderWireOverviewRows()}
      </section>
    </div>
  </details>`;
}
function viewIntegrate(){ return `<h1 class="title">${uiIcon('wire','title-icon')}<span>AI 线框生成</span></h1><div id="wf-root"></div>`; }
function renderWireframe(){
  const root=$('wf-root'); if(!root)return;
  const sharedReady=typeof sharedImageChannelReady==='function'?sharedImageChannelReady():!!wf.configured;
  const channelCard=typeof sharedChannelStatusHtml==='function'?sharedChannelStatusHtml('integrate'):'';
  const bar=`<div class="toolbar">
    <button class="tbtn" data-cfg><span class="dot ${sharedReady?'on':''}"></span>⚙ AI 接入配置</button>
    <button class="tbtn" data-conntest>🔗 测试连接</button>
    <button class="tbtn" data-builtin>${uiIcon('copy','mini-linear-icon')}内置提示词</button>
    <button class="tbtn" data-hist>🕘 历史生成线框记录${wf.history.length?` (${wf.history.length})`:''}</button>
    <button class="tbtn" data-issue-center-open>! 查看问题任务 <span class="problem-count">${Math.max(0,promptDiagnosisCounts().all-promptDiagnosisCounts().ready)}</span></button>
    <button class="tbtn ${wf.advancedDebug?'on':''}" data-wf-advanced-toggle>🛠 高级 / 调试${wf.advancedDebug?'：开':''}</button>
    <button class="auto-flow ${wf.autoToImage?'on':''}" data-wfautoflow>${wf.autoToImage?'🟣 自动流转：已开启':'⚪ 自动流转：已关闭'}</button>
    <span class="undo-hint">提示：Ctrl/⌘+Z 撤回</span>
  </div>`;
  let body;
  if(!wf.groups.length){
    body=`<div class="panel empty"><div class="spark">${uiIcon('wire','empty-icon')}</div><h2>还没有线框任务</h2>
      <p class="hint">先到「文案生成」选择版本并点击『下一步：AI 线框生成』带入文案，或手动添加一组。</p>
      <div style="margin-top:18px;"><button class="btn btn-ghost" data-addwf>+ 添加一组</button></div></div>`;
  }else{
    body=wf.groups.map((g,i)=>{
      const res = g.generating
        ? `<div class="wfres"><div class="spin"></div><div>线框生成中…</div><button class="stopbtn" data-stopwf="${i}">停止生成</button></div>`
        : g.result
          ? `<div class="wfres has" style="padding:6px;"><img data-wfpreview="${i}" src="${g.result.src}" alt="线框图" title="点击预览大图" style="max-width:100%;max-height:250px;border-radius:8px;object-fit:contain;background:#fff;display:block;margin:0 auto;cursor:zoom-in;"><div class="hint" style="margin-top:6px;text-align:center;">AI 生成线框图 · ${g.result.time}</div><div class="wf-result-actions"><button class="mini-btn" data-wfregen="${i}">↻ 再次重新生成</button><button class="mini-btn" data-wfpreview="${i}">🔍 放大预览</button><button class="mini-btn" data-wfcurrent-download="${i}">⬇ 下载当前图</button></div></div>`
          : `<div class="wfres"><div>${uiIcon('wire','result-icon')}</div><div>待生成</div></div>`;
      const frameModule=`<div class="framemod" data-pick="${i}">
        <span class="ti">${uiIcon('wire','section-icon')}线框图</span>
        <span class="hint">点击进入，选择需要使用的线框图（自动同步到排版参考图）</span>
        <span class="sel">${g.frame?`<img src="${g.frame.src}" alt=""> 已选：${esc(g.frame.name)}`:'未选择'}</span></div>`;
      const refCell = g.frame
        ? `<div class="upl" data-pick="${i}" style="flex:1;border-style:solid;border-color:var(--emerald);background:#ecfdf5;color:var(--emerald-700);padding:8px;"><img class="frameimg" src="${g.frame.src}" alt=""><span style="font-size:12px;">已选：${esc(g.frame.name)} · <span class="hint">点击重新选择</span></span></div>`
        : `<div class="upl" data-pick="${i}" style="flex:1;"><span class="ph-em">${uiIcon('wire','placeholder-icon')}</span>点击选择线框图</div>`;
      const source=groupSourceInfo(g);
      return `<div class="panel" id="wf-group-${i}">
        <div class="gh" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <div><b>${g.label?esc(g.label):('第 '+(i+1)+' 组')}</b><span class="source-version-badge ${source.bound?'bound':'unbound'}">${source.bound?'固定来源：版本 '+source.c.version:'未绑定文案版本'}</span></div><span class="del" data-delwf="${i}" style="color:var(--red-500);cursor:pointer;font-size:12px;">删除本组</span></div>
        ${frameModule}
        <div class="notebox" style="margin-bottom:12px;background:#eef2ff;border-color:#c7d2fe;color:#3730a3;">本组固定逻辑：<b>内置提示词</b> + <b>排版参考图</b> + <b>海报文案</b> = <b>AI 生成线框图</b>。生成时将同时受到版式参考与文案内容双重约束。</div>
        <div class="eq">
          <div class="cell"><label class="fl">排版参考图 <span style="color:var(--red-500)">*</span></label>${refCell}</div>
          <div class="op">+</div>
          <div class="cell"><label class="fl">海报文案 <span style="color:var(--red-500)">*</span></label><textarea data-poster="${i}" placeholder="海报文案…">${esc(g.poster)}</textarea></div>
          <div class="op">=</div>
          <div class="cell"><label class="fl">AI 生成线框图</label>${res}</div>
        </div>
        <div class="row" style="margin-top:14px;">
          ${g.generating?'':`<button class="btn btn-violet" data-genwf="${i}">${g.result?'重新生成线框':'生成线框'}</button>`}
          ${g.generating?'':`<button class="btn btn-ghost" data-wfhist="${i}">🕘 历史生成线框记录${wf.history.length?' ('+wf.history.length+')':''}</button>`}
          ${(g.result&&!g.generating)?`<button class="btn btn-ghost" data-wfpreview="${i}">🔍 预览线框</button>`:''}
          ${(g.result&&!g.generating)?`<button class="btn btn-emerald" data-tonext="${i}">下一步：AI 生图 →</button>`:''}
        </div>
        ${wf.advancedDebug?renderWireJsonPanel(g,i):''}
      </div>`;
    }).join('') + `<div style="margin-bottom:24px;"><button class="btn btn-ghost" data-addwf>+ 添加一组</button></div>`;
  }
  root.innerHTML=channelCard+bar+renderWireWorkflowOverview()+body;
}
function startGen(i){
  if(!(typeof sharedImageChannelReady==='function'?sharedImageChannelReady():wf.configured)){toast('请先完成共享图像通道配置',true);openCfg();return;}
  const g=wf.groups[i];
  if(!g.frame||!g.poster||!g.poster.trim()){toast('请先准备好「排版参考图」和「海报文案」后再生成线框图',true);return;}
  const key='wf-generate-'+g.id;
  if(!actionLock(key))return;
  setActionStatus('loading','正在生成线框图，请稍候…',true);
  pushWf(); g.generating=true; g.result=null; renderWireframe();
  genTimers[g.id]=setTimeout(()=>{
    g.generating=false; g.result={time:nowStr(),src:g.frame?g.frame.src:wfSvg(i+1)};
    addGeneratedWireHistory(g,i,g.result.src);
    delete genTimers[g.id]; renderWireframe(); actionDone(key,'线框已生成，并存入历史');
    if(wf.autoToImage){setTimeout(()=>toNextImage(i),500);}
  },2400);
}
function stopGen(i){const g=wf.groups[i];const t=genTimers[g.id];if(t){clearTimeout(t);delete genTimers[g.id];}g.generating=false;renderWireframe();actionUnlock('wf-generate-'+g.id);actionUnlock('wf-api-generate-'+g.id);setActionStatus('success','线框生成已停止',false);}
function toNextImage(i){const g=wf.groups[i];imgCarry={frame:g.result?{src:g.result.src,name:(g.label||('第'+(i+1)+'组'))+' 线框'}:g.frame,prompt:g.poster};toast('已带入线框与文案到 AI 生图');setTimeout(()=>render('image'),250);}
