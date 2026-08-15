/* ===== 内置提示词持久化 + 历史记录（保存后不回默认，可恢复旧版本） ===== */
const PROMPT_KEY='promptStore_v3';
let promptStore={wire:{cur:'',hist:[]},imgframe:{cur:'',hist:[]},imgcopy:{cur:'',hist:[]}};
function loadPromptStore(){try{const s=localStorage.getItem(PROMPT_KEY);if(s){const d=JSON.parse(s);['wire','imgframe','imgcopy'].forEach(k=>{if(d&&d[k]&&typeof d[k].cur==='string')promptStore[k]=d[k];});}}catch(e){}}
function savePromptStore(){try{localStorage.setItem(PROMPT_KEY,JSON.stringify(promptStore));}catch(e){}}
function commitPrompt(slot,text){const ps=promptStore[slot];if(!ps)return;if(ps.cur&&ps.cur!==text){ps.hist.unshift({text:ps.cur,time:(typeof nowStr==='function'?nowStr():new Date().toLocaleString())});if(ps.hist.length>30)ps.hist.length=30;}ps.cur=text;savePromptStore();}
function imgSlot(){return img.mode==='frame'?'imgframe':'imgcopy';}
// 已知的历史默认提示词（用于把旧默认自动升级为最新默认；用户自定义的不动）
const OLD_WF_DEFAULTS=[
  `请以上传的「排版参考图」为底图，把「海报文案」中的文字准确替换到图中对应的文字位置，生成最终图片。
【最高原则】严格保持「排版参考图」的整体版式、线框结构、构图比例、各文字区、徽章、按钮、功能条、底栏的位置、形状、大小、数量、颜色、背景与图形元素完全不变；只替换文字，不重新设计、不增减任何版块。
【V11.1 文案字段映射】
1. 主标题 → 替换原图中最主要的标题或“核心卖点”大标题位置。
2. 核心卖点 → 替换原图中的副标题、第二层卖点标题或主标题下方的核心说明位置。
3. 功能区 → 优先替换原图底部“功能区 / 数据 / 功能 / 文案内容”等功能条文字；若模板没有底部功能条，则替换品牌短句或辅助信息区域。
4. 小标题 → 替换原图中的小标题、标签、徽章短句或副标题条。文案中会传入用户从 3 个备选中选定的 1–3 条小标题；若有多条，将以“小标题1、小标题2、小标题3”分别提供。请按顺序填入模板中的多个小标题、标签或徽章位置，不得使用未选中的备选文案。
5. 徽章、按钮、标签：只替换其中的文字，绝不改变形状、大小、颜色、数量与位置。
【必须做到】
· 替换排版参考图中的所有占位文字；生成图中不得残留“核心卖点”“小标题1”“小标题2”“证书进口”“数据/功能”“功能区”等模板占位词。
· 保持原有版块与徽章数量不变，不得新增或删减任何徽章、圆块或版块。
· 若模板文字区数量多于 V11.1 文案字段数量，可按顺序循环使用已选择的“小标题”，或使用“核心卖点”合理补足，但不得新增文案内容。
· 文字保持原图字体风格、字号比例、粗细、颜色和层级关系，按原文字框自然换行，保证完整可读、不溢出。
【禁止】不要重新设计画面；不要改变排版结构、版块或徽章数量、文字区域的位置与大小；不要改变背景、色块、线框、徽章、按钮、装饰元素；不要扩写、改写文案；不要出现说明文字或无关文字。
【最终效果】除把 V11 海报文案准确替换进各文字区、且所有占位词均被替换外，其余画面元素与原排版参考图完全一致。`,
  `请以上传的「排版参考图」为底图，把「海报文案」中的文字准确替换到图中对应的文字位置，生成最终图片。
【最高原则】严格保持「排版参考图」的整体版式、线框结构、构图比例、各文字区、徽章、按钮、功能条、底栏的位置、形状、大小、数量、颜色、背景与图形元素完全不变；只替换文字，不重新设计、不增减任何版块。
【V11 文案字段映射】
1. 主标题 → 替换原图中最主要的标题或“核心卖点”大标题位置。
2. 核心卖点 → 替换原图中的副标题、第二层卖点标题或主标题下方的核心说明位置。
3. 功能区 → 优先替换原图底部“功能区 / 数据 / 功能 / 文案内容”等功能条文字；若模板没有底部功能条，则替换品牌短句或辅助信息区域。
4. 小标题 → 替换原图中的小标题、标签、徽章短句或副标题条。文案中只会传入用户从 3 个备选中选定的 1 条小标题，不要擅自使用未选中的备选文案。
5. 徽章、按钮、标签：只替换其中的文字，绝不改变形状、大小、颜色、数量与位置。
【必须做到】
· 替换排版参考图中的所有占位文字；生成图中不得残留“核心卖点”“小标题1”“小标题2”“证书进口”“数据/功能”“功能区”等模板占位词。
· 保持原有版块与徽章数量不变，不得新增或删减任何徽章、圆块或版块。
· 若模板文字区数量多于 V11 文案字段数量，可重复使用“核心卖点”或已选择的“小标题”合理补足，但不得新增文案内容。
· 文字保持原图字体风格、字号比例、粗细、颜色和层级关系，按原文字框自然换行，保证完整可读、不溢出。
【禁止】不要重新设计画面；不要改变排版结构、版块或徽章数量、文字区域的位置与大小；不要改变背景、色块、线框、徽章、按钮、装饰元素；不要扩写、改写文案；不要出现说明文字或无关文字。
【最终效果】除把 V11 海报文案准确替换进各文字区、且所有占位词均被替换外，其余画面元素与原排版参考图完全一致。`,
  `请以上传的「排版参考图」为底图，把「海报文案」的文字准确替换到图中对应的文字位置，生成最终图片。
【最高原则】严格保持「排版参考图」的整体版式、线框结构、构图比例、各文字区/徽章/按钮/功能条/底栏的位置、形状、大小、数量、颜色、背景与图形元素完全不变；只替换文字，不重新设计、不增减任何版块。
【替换映射】
1. 主标题 → 替换到原主标题（核心卖点）位置。
2. 「海报文案」中的「功能区」这一行（品牌+卖点短句，例如“勒堡乳铁蛋白猫用免疫保健品 | 高效配方”）→ 替换到原副标题/徽章条位置。注意：此处的「功能区」指文案内容，不是指底部的数据/功能条。
3. 利益点：把以「·」「、」「,」分隔的每一项，按顺序依次填入原图中的圆形卖点徽章/小标题块，原图有几个就填几项、一一对应。
   · 若利益点项数多于徽章/小标题数：把多出的项依次填入底部「功能区/数据/功能」条等其它文字区，确保底栏不再保留占位词；
   · 若利益点项数少于文字区数：用其余利益点或品牌短句合理补足，不要留空位。
4. 徽章、按钮、标签：只替换其中文字，绝不改变其形状、大小、颜色、数量与位置。
【必须做到】
· 替换「排版参考图」中的【所有】占位文字；生成图中绝对不得残留任何模板占位词，例如“核心卖点”“副标题1”“证书进口”“数据/功能”“功能区”等都必须被实际文案替换掉。
· 保持原有版块与徽章的【数量】不变：不得新增或删减任何徽章、圆块或版块（参考图有 2 个徽章就保持 2 个）。
· 文字保持原图的字体风格、字号比例、粗细、颜色与层级关系，按原文字框范围自然换行，保证完整可读、不溢出。
【禁止】不要重新设计画面；不要改变排版结构、版块/徽章数量、文字区域的位置与大小；不要改变背景、色块、线框、徽章、按钮、装饰元素；不要新增任何「海报文案」以外的文字；不要扩写或改写文案；不要出现说明文字或无关文字。
【最终效果】除把「海报文案」准确替换进各文字区、且所有占位词都被替换外，其余画面元素与原「排版参考图」完全一致。`,
  '请基于上传的「排版参考图」与「海报文案」，生成一张电商主图线框图（wireframe）：用色块与占位框标注主标题、辅助信息、利益点的位置、大小与层级，版式需与排版参考图保持一致，只输出结构线框，不渲染最终视觉效果。',
  '请基于上传的「排版参考图」与「海报文案」，生成一张电商主图线框图（wireframe）：将「海报文案」替换到「排版参考图」色块与占位框标注主标题、辅助信息、利益点的位置、大小与层级，版式需与排版参考图保持一致，只输出结构线框，不渲染最终视觉效果。',
  `请基于上传的「排版参考图」与输入的「海报文案」生成图片。
核心要求：
严格保持「排版参考图」当前的整体版式、线框结构、构图比例、文字区域位置、文字大小层级、对齐方式、颜色、背景、图形元素、徽章/按钮/功能区样式不变。
仅执行一项操作：
将「海报文案」中的文字信息，替换到「排版参考图」中对应的文字位置。
替换规则：
1. 将「海报文案」中的主标题，替换到「排版参考图」原主标题位置。
2. 将「海报文案」中的辅助信息/副标题，替换到「排版参考图」原辅助信息/副标题位置。
3. 将「海报文案」中的利益点/卖点/功能区文字，替换到「排版参考图」原利益点/功能区位置。
4. 如有徽章内容、按钮文字、标签文字，只替换对应区域内的文字，不改变该区域的形状、大小、颜色和位置。
5. 文案需保持原排版参考图的字体风格、字号比例、粗细、颜色和层级关系；根据原文字框范围进行自然换行，保证文字完整可读。
禁止事项：
不要重新设计画面。
不要改变排版结构。
不要改变文字区域的位置和大小。
不要改变背景、色块、线框、徽章、按钮、功能区、装饰元素。
不要新增任何「海报文案」以外的文字。
不要自动补充、扩写、改写文案。
不要出现提示词、说明文字或无关文字。
最终效果：
只将「海报文案」的信息准确替换到「排版参考图」的文字信息中，除文字内容替换外，其余所有画面元素保持不变。`
];
function initPrompts(){loadPromptStore();
  // 线框内置提示词：空或仍是旧默认 → 升级为最新默认；用户改过的保留
  if(!promptStore.wire.cur || OLD_WF_DEFAULTS.indexOf(promptStore.wire.cur)>=0){ promptStore.wire.cur=DEFAULT_WF_PROMPT; wf.builtin=DEFAULT_WF_PROMPT; }
  else { wf.builtin=promptStore.wire.cur; }
  if(typeof img!=='undefined'&&img.builtin){
    if(promptStore.imgframe.cur && OLD_IMG_FRAME_DEFAULTS.indexOf(promptStore.imgframe.cur)<0) img.builtin.frame=promptStore.imgframe.cur;
    else { img.builtin.frame=DEFAULT_IMG_BUILTIN.frame; promptStore.imgframe.cur=DEFAULT_IMG_BUILTIN.frame; }
    if(promptStore.imgcopy.cur && OLD_IMG_COPY_DEFAULTS.indexOf(promptStore.imgcopy.cur)<0) img.builtin.copy=promptStore.imgcopy.cur;
    else { img.builtin.copy=DEFAULT_IMG_BUILTIN.copy; promptStore.imgcopy.cur=DEFAULT_IMG_BUILTIN.copy; }
  }
  savePromptStore();}
function promptHistHtml(slot,restoreAttr){const h=promptStore[slot]&&promptStore[slot].hist||[];if(!h.length)return '';return '<label class="fl" style="margin-top:16px;">历史记录（点击恢复，不会覆盖当前未保存内容）</label>'+h.map((x,i)=>`<div class="histitem"><div class="ht"><b>${x.time}</b><p>${esc(x.text.replace(/\n/g,' '))}</p></div><button class="btn btn-ghost" ${restoreAttr}="${i}">恢复</button></div>`).join('');}
let wfUndo=[]; const genTimers={};
let imgCarry=null;
const WF_TASK_JSON_HISTORY_KEY='wfTaskJsonHistory_v133';
let WF_TASK_JSON_HISTORY_STORE={};
try{WF_TASK_JSON_HISTORY_STORE=JSON.parse(localStorage.getItem(WF_TASK_JSON_HISTORY_KEY)||'{}')||{};}catch(_e){WF_TASK_JSON_HISTORY_STORE={};}
function newWireJsonState(){return{source:null,jsonText:'',requirement:'',updatedAt:'',origin:'',open:false,syncHistory:[],lastSyncAt:'',lastSyncHash:'',lastSyncPayload:null,manualEditedAt:'',ruleOverrides:null,historyLoaded:false};}
function newGroup(label,poster,meta={}){return{id:uid(),label:label||'',poster:poster||POSTER_DEFAULT,frame:null,result:null,generating:false,lastGenerateError:'',jsonAnalysis:newWireJsonState(),sourceCopyIndex:Number.isInteger(meta.sourceCopyIndex)?meta.sourceCopyIndex:null,sourceVersion:meta.sourceVersion==null?null:meta.sourceVersion,sourceStyle:meta.sourceStyle||'',sourceBoundAt:meta.sourceBoundAt||''};}
function taskJsonHistoryStoreKey(g){const s=groupSourceInfo(g);return s.bound?'version-'+String(s.c.version)+'-'+String(s.c.style||''):('group-'+String(g.label||g.id));}
function hydrateTaskJsonHistory(g,a){if(a.historyLoaded)return;a.historyLoaded=true;try{const saved=WF_TASK_JSON_HISTORY_STORE[taskJsonHistoryStoreKey(g)];if(saved&&typeof saved==='object'){if(Array.isArray(saved.syncHistory)&&!a.syncHistory.length)a.syncHistory=cloneObj(saved.syncHistory).slice(0,20);if(!a.lastSyncAt)a.lastSyncAt=saved.lastSyncAt||'';if(!a.lastSyncHash)a.lastSyncHash=saved.lastSyncHash||'';if(!a.lastSyncPayload&&saved.lastSyncPayload)a.lastSyncPayload=cloneObj(saved.lastSyncPayload);if(!a.ruleOverrides&&saved.ruleOverrides)a.ruleOverrides=cloneObj(saved.ruleOverrides);}}catch(_e){}}
function persistTaskJsonHistory(g){const a=g&&g.jsonAnalysis;if(!g||!a)return;try{WF_TASK_JSON_HISTORY_STORE[taskJsonHistoryStoreKey(g)]={syncHistory:(a.syncHistory||[]).slice(0,20),lastSyncAt:a.lastSyncAt||'',lastSyncHash:a.lastSyncHash||'',lastSyncPayload:a.lastSyncPayload||null,ruleOverrides:a.ruleOverrides||null};localStorage.setItem(WF_TASK_JSON_HISTORY_KEY,JSON.stringify(WF_TASK_JSON_HISTORY_STORE));}catch(_e){}}
function ensureWireJsonState(g){if(!g.jsonAnalysis||typeof g.jsonAnalysis!=='object')g.jsonAnalysis=newWireJsonState();const a=g.jsonAnalysis;if(!('source' in a))a.source=null;if(typeof a.jsonText!=='string')a.jsonText='';if(typeof a.requirement!=='string')a.requirement='';if(typeof a.updatedAt!=='string')a.updatedAt='';if(typeof a.origin!=='string')a.origin='';if(typeof a.open!=='boolean')a.open=false;if(!Array.isArray(a.syncHistory))a.syncHistory=[];if(typeof a.lastSyncAt!=='string')a.lastSyncAt='';if(typeof a.lastSyncHash!=='string')a.lastSyncHash='';if(!('lastSyncPayload' in a))a.lastSyncPayload=null;if(typeof a.manualEditedAt!=='string')a.manualEditedAt='';if(!('ruleOverrides' in a))a.ruleOverrides=null;if(typeof a.historyLoaded!=='boolean')a.historyLoaded=false;hydrateTaskJsonHistory(g,a);return a;}
function wireJsonSourceName(a){return a&&a.source?(a.source.name||'待分析图片'):'尚未选择分析图片';}
function renderWireJsonPanel(g,i){
  const a=ensureWireJsonState(g),hasSource=!!(a.source&&a.source.src),hasJson=!!a.jsonText.trim();
  const preview=hasSource?`<img src="${a.source.src}" alt="待分析图片">`:'上传图片或从历史记录送入';
  const model=(typeof requireAnalysisModel==='function'?(()=>{try{return requireAnalysisModel(false)}catch(e){return ''}})():'');
  const summary=hasJson?'JSON 已生成，可继续编辑或交给 AI 修改':hasSource?'分析图片已就绪，打开后可开始生成 JSON':'上传图片或从历史记录送入后开始分析';
  const sourceChip=hasSource?`<span class="wf-json-chip ok">图片已就绪</span>`:'<span class="wf-json-chip">未选图片</span>';
  const jsonChip=hasJson?`<span class="wf-json-chip ok">JSON 已生成</span>`:'<span class="wf-json-chip">未生成 JSON</span>';
  const body=a.open?`<div class="wf-json-body">
    <div class="wf-json-head"><div><h4>图片分析为 JSON</h4><p>先选择图片并生成结构化 JSON，再进行手动编辑、保存或根据需求交给 AI 修改。</p></div><span class="hint">${model?'分析模型：'+esc(model):'使用 API 配置中的视觉/文本模型'}</span></div>
    <div class="wf-json-source">
      <div class="wf-json-preview">${preview}</div>
      <div class="wf-json-source-info"><b>${esc(wireJsonSourceName(a))}</b><p>${a.origin?'来源：'+esc(a.origin):'请选择一张需要分析的图片'}</p>
        <div class="wf-json-source-actions"><button class="mini-btn" data-wfjson-upload="${i}">上传分析图片</button>${g.result&&g.result.src?`<button class="mini-btn" data-wfjson-current="${i}">使用当前生成图</button>`:''}<button class="btn btn-violet" data-wfjson-analyze="${i}" ${hasSource?'':'disabled'}>分析图片为 JSON</button></div>
      </div>
    </div>
    <div class="wf-json-grid">
      <div class="wf-json-editor"><label class="fl">分析 JSON（可直接修改）</label><textarea data-wfjson-text="${i}" spellcheck="false" placeholder="分析完成后会在这里显示结构化 JSON，也可以手动粘贴或修改。">${esc(a.jsonText)}</textarea>
        <div class="wf-json-actions" style="margin-top:9px;"><button class="mini-btn" data-wfjson-format="${i}">格式化/校验</button><button class="mini-btn" data-wfjson-save="${i}">保存修改</button><button class="mini-btn" data-wfjson-copy="${i}">复制 JSON</button><button class="mini-btn" data-wfjson-download="${i}">下载 JSON</button><button class="mini-btn" data-wfjson-clear="${i}">清空</button></div>
        <div class="wf-json-meta">${a.updatedAt?'最近更新：'+esc(a.updatedAt):'尚未生成 JSON'}</div>
      </div>
      <div class="wf-json-ai"><label class="fl">根据需求进行 AI 修改</label><textarea data-wfjson-require="${i}" placeholder="例如：保持版式结构不变，将主标题区域上移 5%，增加两个徽章区域，并把功能区高度缩小。">${esc(a.requirement)}</textarea><div class="ai-note">AI 只修改 JSON 数据，不直接修改图片。修改结果会回填到左侧，并可继续编辑、保存、复制或下载。</div><button class="btn btn-violet" data-wfjson-modify="${i}">根据需求进行 AI 修改</button></div>
    </div>
  </div>`:'';
  return `<div class="wf-json-menu ${a.open?'open':''}" id="wf-json-panel-${i}">
    <button type="button" class="wf-json-toggle" data-wfjson-toggle="${i}" aria-expanded="${a.open?'true':'false'}">
      <span class="wf-json-toggle-left"><span class="wf-json-toggle-icon">{ }</span><span class="wf-json-toggle-copy"><b>图片分析为 JSON</b><span>${esc(summary)}</span></span></span>
      <span class="wf-json-toggle-right">${sourceChip}${jsonChip}<span class="wf-json-chevron">⌄</span></span>
    </button>${body}
  </div>`;
}

function copyToPoster(c){const b=normalizeCopyBlock(c.block);c.block=b;const subs=selectedSubtitleTexts(b);const subtitleLines=subs.length===1?`小标题：${subs[0]}`:subs.map((t,i)=>`小标题${i+1}：${t}`).join('\n');return `主标题：${b.mainTitle}
核心卖点：${b.coreSellingPoint}
功能区：${b.functionArea}
${subtitleLines}`;}
function inferGroupCopyIndex(g){
  if(!g)return null;
  if(Number.isInteger(g.sourceCopyIndex)&&copies[g.sourceCopyIndex])return g.sourceCopyIndex;
  const byVersion=g.sourceVersion!=null?copies.findIndex(c=>Number(c.version)===Number(g.sourceVersion)):-1;
  if(byVersion>=0){g.sourceCopyIndex=byVersion;return byVersion;}
  const m=String(g.label||'').match(/^版本\s*(\d+)/);const idx=m?copies.findIndex(c=>Number(c.version)===Number(m[1])):-1;
  if(idx>=0){g.sourceCopyIndex=idx;g.sourceVersion=copies[idx].version;g.sourceStyle=copies[idx].style||'';return idx;}
  return null;
}
function bindGroupToCopy(g,idx,refreshPoster=true){
  const c=copies[idx];if(!g||!c)return false;
  g.sourceCopyIndex=idx;g.sourceVersion=c.version;g.sourceStyle=c.style||'';g.sourceBoundAt=nowStr();
  g.label=`版本 ${c.version} · ${c.style}`;
  if(refreshPoster)g.poster=copyToPoster(c);
  return true;
}
function groupSourceInfo(g){const idx=inferGroupCopyIndex(g),c=idx!=null?copies[idx]:null;return {idx,c,bound:!!c,label:c?`版本 ${c.version} · ${c.style}`:'未绑定文案版本'};}
function syncCopyVersionToBoundTasks(idx,options={}){
  const c=copies[idx];if(!c)return 0;let count=0;
  const syncJson=options.syncJson!==false,link=options.link!==false,origin=options.origin||'V14 固定来源版本自动同步 JSON';
  if(link)COPY_API_CHANNEL.promptLinkEnabled=true;
  wf.groups.forEach((g,gi)=>{
    const sourceIdx=inferGroupCopyIndex(g);
    if(sourceIdx===idx){
      bindGroupToCopy(g,idx,true);
      if(link)setPromptGroupSelected(g.id,true);
      if(syncJson)syncTaskGroupJson(g,gi,origin);
      count++;
    }
  });
  img.copyGroups.forEach(g=>{if(g.copyIdx===idx){g.version=c.version;g.style=c.style;g.label=`版本 ${c.version} · ${c.style}`;g.poster=copyToPoster(c);}});
  return count;
}
function syncAllBoundTaskGroups(){let count=0;copies.forEach((_,idx)=>{count+=syncCopyVersionToBoundTasks(idx);});return count;}
function adjustGroupBindingsAfterCopyDelete(idx){
  wf.groups.forEach(g=>{if(g.sourceCopyIndex===idx){g.sourceCopyIndex=null;g.sourceVersion=null;g.sourceStyle='';}else if(Number.isInteger(g.sourceCopyIndex)&&g.sourceCopyIndex>idx)g.sourceCopyIndex--;});
  syncAllBoundTaskGroups();
}

function pushWf(){try{wfUndo.push(JSON.stringify(wf.groups));if(wfUndo.length>30)wfUndo.shift();}catch(e){}}
function undoWf(){if(!wfUndo.length){toast('没有可撤回的操作');return;}Object.values(genTimers).forEach(clearTimeout);for(const k in genTimers)delete genTimers[k];wf.groups=JSON.parse(wfUndo.pop());wf.groups.forEach(g=>g.generating=false);renderWireframe();toast('已撤回');}
