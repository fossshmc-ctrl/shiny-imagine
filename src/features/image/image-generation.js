/* ===== AI 生图（增强模式：线框+产品+参考 / 文案+产品+参考，多组批量生图） ===== */
const DEFAULT_IMG_BUILTIN={
  frame:'把第2张「产品图」中的产品，按第1张「AI生成的线框图」的版式、文字布局与各区块位置精确放入，参考第3张「参考图」的风格、配色、光影与质感，生成一张专业级、高质量电商主图。【画质】构图严谨工整、主体突出、光影自然、质感高级、细节锐利清晰，达到商业海报级别。【硬性要求】① 严格保持线框图的排版结构、文字内容与文字位置不变；② 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘产品；③ 参考图仅用于整体风格与配色氛围，不改变产品与版式；④ 画面只呈现线框版式与该产品本身，不要主动添加任何输入素材中不存在的元素（包括但不限于宠物、动物、人物、手、道具、新场景）；⑤ 不要新增任何线框图之外的文字。',
  copy:'参考「参考图」的版式、设计、配色与整体风格，把「产品图」中的产品放入并保持完全一致，文字使用「排版文案」，生成一张专业级、高质量电商主图。【宠物/动物（重要，先判断再执行）】请先识别「参考图」画面中是否出现宠物：① 如果参考图里有宠物（猫、狗等），则生成的主图必须同样包含一只相同类型、真实自然可爱的宠物，作为画面主体之一，与产品自然互动（依偎、注视、陪伴等），保持毛发质感、五官神态与身体比例真实、不变形不失真——这是硬性要求，绝对不可省略或丢弃该宠物；② 如果参考图里没有任何宠物/动物，则不得主动添加宠物或动物。【画质】构图美观协调、主体突出、光影自然真实、质感高级、留白合理、色彩通透、细节锐利清晰，达到商业海报级别。【硬性要求】① 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘；② 只使用排版文案中的文字，不新增无关文字；③ 整体版式与风格贴合参考图。'
};
const OLD_IMG_FRAME_DEFAULTS=[
  '将「AI生成的线框图」作为版式与构图的硬约束，结合「产品图」与「参考图」生成电商主图；必须保持线框图的排版结构与文字区域，产品须与产品图保持一致，参考图仅用于风格、场景、质感与电商主图氛围。',
  '把第2张「产品图」中的产品，按第1张「AI生成的线框图」的版式、文字布局与各区块位置精确放入，生成一张高质量电商主图；参考第3张「参考图」的风格、配色、光影、场景与质感。硬性要求：① 严格保持线框图的排版结构、文字内容与文字位置不变；② 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘产品；③ 参考图仅用于整体风格氛围，不改变产品与版式；④ 不要新增任何线框图之外的文字。',
  '把第2张「产品图」中的产品，按第1张「AI生成的线框图」的版式、文字布局与各区块位置精确放入，参考第3张「参考图」的风格、配色、光影与场景，生成一张专业级、高质量电商主图。【画质要求】构图美观协调、主体突出、光影自然真实、质感高级、留白合理、色彩通透、细节锐利清晰，达到商业海报级别。【宠物/动物】若画面或参考图含宠物（猫、狗等），需将其真实、自然、可爱地融入构图，保持毛发质感、五官神态与身体比例真实，不变形不失真，与产品和谐互动、衔接自然。【硬性要求】① 严格保持线框图的排版结构、文字内容与文字位置不变；② 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘产品；③ 参考图仅用于整体风格氛围，不改变产品与版式；④ 不要新增任何线框图之外的文字。'
];
const OLD_IMG_COPY_DEFAULTS=[
  '将「排版文案」作为画面文字与排版内容来源，结合「产品图」与「参考图」生成电商主图；根据文案版本自动建立生图任务组，保持产品真实一致，参考图仅用于风格、场景、配色与设计元素。',
  '将「排版文案」作为画面文字与排版内容来源，结合「产品图」与「参考图」生成电商主图；产品须与产品图完全一致，参考图仅用于风格、场景、配色与设计元素，文字严格使用排版文案、不新增无关文字。',
  '参考「参考图」的整体版式、设计、配色、排版与风格作为模板，把「产品图」中的产品放入并保持完全一致，文字使用「排版文案」，生成一张高质量电商主图。硬性要求：① 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘；② 只使用排版文案中的文字，不新增无关文字；③ 整体版式与风格贴合参考图。',
  '参考「参考图」的整体版式、设计、配色、排版与风格作为模板，把「产品图」中的产品放入并保持完全一致，文字使用「排版文案」，生成一张专业级、高质量电商主图。【画质要求】构图美观协调、主体突出、光影自然真实、质感高级、留白合理、色彩通透、细节锐利清晰，达到商业海报级别。【宠物/动物】若参考图或场景含宠物（猫、狗等），需将其真实、自然、可爱地融入画面，保持毛发质感、五官神态与身体比例真实，不变形不失真，与产品和谐共处、互动自然。【硬性要求】① 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘；② 只使用排版文案中的文字，不新增无关文字；③ 整体版式与风格贴合参考图。',
  '参考「参考图」的整体版式、设计、配色、排版与风格作为模板，把「产品图」中的产品放入并保持完全一致，文字使用「排版文案」，生成一张专业级、高质量电商主图。【画质】构图美观协调、主体突出、光影自然真实、质感高级、留白合理、色彩通透、细节锐利清晰，达到商业海报级别。【宠物/动物（条件性，切勿主动添加）】仅当「参考图」本身画面中确实出现宠物（猫、狗等）时，才在主图中保留/还原相同类型的宠物，并使其真实、自然、可爱，保持毛发质感、五官神态与身体比例真实、不变形失真，与产品和谐互动；若参考图中没有宠物，则严禁主动添加任何宠物或动物。【硬性要求】① 产品的外观、包装、logo、颜色、文字必须与产品图完全一致，不得改动、替换或重绘；② 只使用排版文案中的文字，不新增无关文字；③ 整体版式与风格贴合参考图；④ 不要添加输入素材中不存在的元素。'
];
let img={configured:false,baseUrl:'',key:'',mode:'frame',
  builtin:{frame:DEFAULT_IMG_BUILTIN.frame,copy:DEFAULT_IMG_BUILTIN.copy},
  userPrompt:{frame:'',copy:''},
  inputs:{frame:{wire:null,product:null,ref:null},copy:{product:null,ref:null}},
  count:1,aspect:'1:1',resolution:'2k',quality:'中',parametersExpanded:false,
  copySelected:[],copySelectionTouched:false,copyGroups:[],result:null,generating:false,banner:false,progress:'',history:[],flowUi:null};
const imgTimers={};
const IMG_FLOW_ESTIMATE_KEY='ai_image_flow_estimate_v229_';
function imageFlowUi(mode=img.mode){
  if(!img.flowUi)img.flowUi={};
  if(!img.flowUi[mode])img.flowUi[mode]={active:false,startedAt:0,estimateSec:20,progress:0,error:null,collapsed:false,autoCollapseDone:false,units:1,lastDuration:0};
  return img.flowUi[mode];
}
function imageFlowStoredEstimate(mode){
  try{const n=Number(localStorage.getItem(IMG_FLOW_ESTIMATE_KEY+mode));if(Number.isFinite(n)&&n>=8&&n<=180)return n;}catch(e){}
  return 20;
}
function imageFlowSaveEstimate(mode,seconds){
  const prev=imageFlowStoredEstimate(mode),actual=Math.max(8,Math.min(180,Number(seconds)||20));
  const next=Math.round(prev*.7+actual*.3);
  try{localStorage.setItem(IMG_FLOW_ESTIMATE_KEY+mode,String(next));}catch(e){}
  return next;
}
function imageFlowProgressPercent(mode=img.mode){
  const ui=imageFlowUi(mode);
  if(ui.active)return Math.max(4,Math.min(95,Math.round(ui.progress||4)));
  if((mode==='frame'&&img.result&&img.result.images&&img.result.images.length)||(mode==='copy'&&img.copyGroups.length&&img.copyGroups.every(g=>g.result&&g.result.images&&g.result.images.length)))return 100;
  return 0;
}
function imageFlowEta(mode=img.mode){
  const ui=imageFlowUi(mode);
  if(ui.error)return {text:'需要处理',cls:'error'};
  if(ui.active){const elapsed=Math.max(0,(Date.now()-ui.startedAt)/1000),remain=Math.max(1,Math.ceil(ui.estimateSec-elapsed));return {text:`预计剩余 ${remain} 秒 · ${imageFlowProgressPercent(mode)}%`,cls:'running'};}
  const done=(mode==='frame'&&img.result&&img.result.images&&img.result.images.length)||(mode==='copy'&&img.copyGroups.length&&img.copyGroups.every(g=>g.result&&g.result.images&&g.result.images.length));
  if(done)return {text:'已完成',cls:'done'};
  return {text:`预计约 ${Math.round(imageFlowStoredEstimate(mode))} 秒`,cls:''};
}
function refreshImageFlowRuntimeDom(mode=img.mode){
  const ui=imageFlowUi(mode),eta=imageFlowEta(mode);
  document.querySelectorAll(`.ai-image-flow-card[data-flow-mode="${mode}"] .ai-image-flow-eta`).forEach(el=>{el.textContent=eta.text;el.className='ai-image-flow-eta '+eta.cls;});
  document.querySelectorAll('[data-img-flow-progressbar]').forEach(el=>{el.style.width=imageFlowProgressPercent(mode)+'%';});
}
function clearImageFlowTimers(){
  if(imgTimers.flowTick){clearInterval(imgTimers.flowTick);imgTimers.flowTick=null;}
  if(imgTimers.flowCollapse){clearTimeout(imgTimers.flowCollapse);imgTimers.flowCollapse=null;}
}
function beginImageFlowGeneration(mode,units=1){
  clearImageFlowTimers();
  const ui=imageFlowUi(mode),base=imageFlowStoredEstimate(mode);
  ui.active=true;ui.startedAt=Date.now();ui.units=Math.max(1,Number(units)||1);ui.estimateSec=Math.max(8,Math.min(300,Math.round(base*ui.units)));ui.progress=4;ui.error=null;ui.collapsed=false;ui.autoCollapseDone=false;
  imgTimers.flowTick=setInterval(()=>{
    if(!ui.active){clearInterval(imgTimers.flowTick);imgTimers.flowTick=null;return;}
    const elapsed=Math.max(0,(Date.now()-ui.startedAt)/1000),ratio=Math.max(0,elapsed/ui.estimateSec);
    ui.progress=Math.min(95,Math.max(4,Math.round((1-Math.exp(-2.35*ratio))*100)));
    refreshImageFlowRuntimeDom(mode);
  },1000);
}
function imageFlowCompleted(mode){
  if(mode==='frame')return !!(img.result&&img.result.images&&img.result.images.length);
  return !!(img.copyGroups.length&&img.copyGroups.every(g=>g.result&&g.result.images&&g.result.images.length));
}
function scheduleImageFlowCollapse(mode){
  if(imgTimers.flowCollapse)clearTimeout(imgTimers.flowCollapse);
  const ui=imageFlowUi(mode);
  imgTimers.flowCollapse=setTimeout(()=>{
    if(!ui.error&&!ui.active&&!ui.autoCollapseDone&&imageFlowCompleted(mode)){ui.collapsed=true;ui.autoCollapseDone=true;if(curView==='image'&&img.mode===mode)renderImageView();}
  },4200);
}
function finishImageFlowGeneration(mode){
  const ui=imageFlowUi(mode),elapsed=ui.startedAt?Math.max(1,(Date.now()-ui.startedAt)/1000):20;
  if(imgTimers.flowTick){clearInterval(imgTimers.flowTick);imgTimers.flowTick=null;}
  ui.active=false;ui.progress=100;ui.lastDuration=elapsed;ui.estimateSec=imageFlowSaveEstimate(mode,elapsed/Math.max(1,ui.units));ui.error=null;ui.collapsed=false;ui.autoCollapseDone=false;
  scheduleImageFlowCollapse(mode);
}
function setImageFlowError(mode,step,message,retry){
  clearImageFlowTimers();
  const ui=imageFlowUi(mode);ui.active=false;ui.progress=0;ui.collapsed=false;ui.autoCollapseDone=false;ui.error={step:Math.max(1,Math.min(5,Number(step)||4)),message:String(message||'操作失败，请重试'),retry:retry||{type:'generate'}};
}
function clearImageFlowError(mode=img.mode){const ui=imageFlowUi(mode);ui.error=null;ui.collapsed=false;}
function invalidateImageFlowResult(mode,groupIdx=null){
  clearImageFlowTimers();const ui=imageFlowUi(mode);ui.active=false;ui.progress=0;ui.error=null;ui.collapsed=false;ui.autoCollapseDone=false;
  if(mode==='frame')img.result=null;else if(groupIdx==null)img.copyGroups.forEach(g=>{g.result=null;g.generating=false;});else if(img.copyGroups[groupIdx]){img.copyGroups[groupIdx].result=null;img.copyGroups[groupIdx].generating=false;}
}
function imageFlowUploadStep(field){return field==='wire'?1:field==='product'?2:3;}
function retryImageFlowError(){
  const mode=img.mode,ui=imageFlowUi(mode),r=ui.error&&ui.error.retry;if(!r)return;ui.error=null;ui.collapsed=false;renderImageView();
  if(r.type==='upload'){setTimeout(()=>imgUpload(r.scope,r.field,r.idx==null?null:r.idx),30);return;}
  if(r.type==='config'){setTimeout(openImgCfg,30);return;}
  setTimeout(()=>startImgGen(r.groupIdx==null?null:r.groupIdx),30);
}
function toggleImageFlowCard(){const ui=imageFlowUi(img.mode);if(!imageFlowCompleted(img.mode))return;ui.collapsed=!ui.collapsed;ui.autoCollapseDone=true;if(imgTimers.flowCollapse){clearTimeout(imgTimers.flowCollapse);imgTimers.flowCollapse=null;}renderImageView();}
const MODE_LABEL={frame:'AI生成的线框图 + 产品图 + 参考图 = 主图',copy:'排版文案 + 产品图 + 参考图 = 主图'};
const MODE_SHORT={frame:'线框图模式',copy:'排版文案模式'};
const SLOT_LABEL={wire:'AI生成的线框图',product:'产品图',ref:'参考图',poster:'排版文案'};
const IMG_COUNTS=[1,2,4,6];
function cloneObj(o){return o?JSON.parse(JSON.stringify(o)):null;}
function imgCountButtons(){return `<div class="img-counts">${IMG_COUNTS.map(n=>`<button class="countbtn ${img.count===n?'on':''}" data-imgcount="${n}">${n} 张</button>`).join('')}</div>`;}
function makeCopyGroup(idx){
  const c=(idx!=null&&copies[idx])?copies[idx]:null;
  return {id:uid(),copyIdx:idx,version:c?c.version:null,style:c?c.style:'手动文案',label:c?`版本 ${c.version} · ${c.style}`:'手动文案',poster:c?copyToPoster(c):POSTER_DEFAULT,product:cloneObj(img.inputs.copy.product),ref:cloneObj(img.inputs.copy.ref),result:null,generating:false};
}
function selectedCopyIds(){
  ensureCopySelection();
  return [...new Set((img.copySelected||[]).filter(i=>copies[i]))].sort((a,b)=>a-b);
}
function getCopyVersionByIndex(idx){return (idx!=null&&copies[idx])?copies[idx]:null;}
function maxCopyVersionNo(){return copies.reduce((m,c)=>Math.max(m,Number(c.version)||0),0);}
function parsePosterText(text){
  const t=(text||'').trim();
  const get=(re)=>{const m=t.match(re);return m&&m[1]?m[1].trim():'';};
  const mainTitle=get(/主标题[：:]\s*([^\n]+)/i)||get(/标题[：:]\s*([^\n]+)/i)||'自定义文案版本';
  const coreSellingPoint=get(/核心卖点[：:]\s*([^\n]+)/i)||get(/利益点[：:]\s*([^\n]+)/i)||'核心价值清晰可见';
  const functionArea=get(/功能区[：:]\s*([^\n]+)/i)||get(/辅助信息[：:]\s*([^\n]+)/i)||get(/副标题[：:]\s*([^\n]+)/i)||'';
  const explicit=[1,2,3].map(n=>get(new RegExp('小标题\\s*'+n+'[：:]\\s*([^\\n]+)','i'))).filter(Boolean);
  const one=get(/小标题[：:]\s*([^\n]+)/i);
  const subtitles=ensureThreeSubtitles(explicit.length?explicit:(one?[one]:[]),[coreSellingPoint,functionArea.split(/[|｜]/).pop()]);
  return {mainTitle,coreSellingPoint,functionArea,subtitles,selectedSubtitles:explicit.length?explicit.map((_,i)=>i):[0],insight:'用户在 AI 生图模块中自定义添加的排版文案版本。消费者洞察仅用于内部策略参考，不可复制。'};
}
function refreshCopyNumbers(){copies.forEach((c,i)=>{c.version=i+1;});}
function setActiveCopyVersion(idx,keepMaterial=true){
  if(!copies[idx])return;
  const picked=new Set(img.copySelected||[]);
  if(picked.has(idx))picked.delete(idx); else picked.add(idx);
  img.copySelectionTouched=true;
  img.copySelected=[...picked].sort((a,b)=>a-b);
  rebuildCopyGroupsFromSelection(true);
  if(keepMaterial)syncCopyInputsToGroups();
  renderImageView();
  const status=img.copySelected.includes(idx)?'已选中':'已取消';
  toast(status+'版本 '+copies[idx].version+'，模块已自动同步更新');
}
function deleteCopyVersion(idx){
  if(!copies[idx])return;
  const removed=copies[idx];
  copies.splice(idx,1);
  refreshCopyNumbers();
  selected=new Set([...selected].filter(i=>i!==idx).map(i=>i>idx?i-1:i));
  img.copySelectionTouched=true;
  img.copySelected=(img.copySelected||[]).filter(i=>i!==idx).map(i=>i>idx?i-1:i);
  if(!copies.length){
    img.copySelected=[];
    img.copyGroups=[];
  }else{
    if(!img.copySelected.length)img.copySelected=[Math.min(idx,copies.length-1)];
    rebuildCopyGroupsFromSelection(true);
    syncCopyInputsToGroups();
  }
  adjustGroupBindingsAfterCopyDelete(idx);
  renderImageView();
  toast('已删除「'+(removed.style||'文案版本')+'」，并自动更新对应模块');
}
function updateCopyVersionFromPoster(idx,poster){
  const c=getCopyVersionByIndex(idx);if(!c)return;
  const old=normalizeCopyBlock(c.block),next=parsePosterText(poster);
  const chosen=next.subtitles[0];
  next.subtitles=ensureThreeSubtitles([chosen],old.subtitles);
  next.selectedSubtitles=[0];
  next.insight=old.insight;
  c.block=next;
  if(!c.style)c.style='自定义文案';
  syncCopyVersionToBoundTasks(idx);
}
function openAddCopyVersion(){
  modalOpen(`<h3>新增文案版本</h3>
    <p class="hint">可粘贴完整排版文案。保存后会自动加入版本列表，并立即切换到该版本，不需要手动删除旧组。</p>
    <label class="fl">版本名称 / 风格</label><input type="text" id="newcopy-style" placeholder="例如：痛点强化 / 医用风格 / 自定义版本" value="自定义文案">
    <label class="fl">排版文案</label><textarea id="newcopy-text" rows="7" placeholder="主标题：...&#10;核心卖点：...&#10;功能区：...&#10;小标题：...">${esc(POSTER_DEFAULT)}</textarea>
    <div class="row" style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-violet" data-save-newcopy>保存并使用</button><button class="btn btn-ghost" data-mclose>取消</button></div>`);
}
function saveNewCopyVersion(){
  const txt=($('newcopy-text')&&$('newcopy-text').value.trim())||'';
  if(!txt){toast('请先填写文案内容',true);return;}
  const style=(($('newcopy-style')&&$('newcopy-style').value.trim())||'自定义文案');
  const c={version:maxCopyVersionNo()+1,style,block:parsePosterText(txt)};
  copies.push(c);
  const idx=copies.length-1;
  selected.add(idx);
  modalClose();
  const picked=new Set(img.copySelected||[]); picked.add(idx);
  img.copySelectionTouched=true;
  img.copySelected=[...picked].sort((a,b)=>a-b);
  rebuildCopyGroupsFromSelection(true);
  syncCopyInputsToGroups();
  renderImageView();
  toast('已新增文案版本，并自动添加对应功能模块');
}
function ensureCopySelection(){
  if(!copies.length){img.copySelected=[];return;}
  let picked=[...(img.copySelected||[])].filter(i=>copies[i]);
  if(!picked.length){
    if(img.copySelectionTouched){img.copySelected=[];return;}
    const fromCopy=[...selected].sort((a,b)=>a-b).filter(i=>copies[i]);
    picked=fromCopy.length?fromCopy:[0];
  }
  img.copySelected=[...new Set(picked)].sort((a,b)=>a-b);
}
function rebuildCopyGroupsFromSelection(keepExisting=true){
  ensureCopySelection();
  const ids=selectedCopyIds();
  const old=keepExisting?img.copyGroups:[];
  if(!ids.length){
    img.copyGroups=[];
    return;
  }
  img.copyGroups=ids.map(i=>{
    const existed=old.find(g=>g.copyIdx===i);
    const g=existed?existed:makeCopyGroup(i);
    const c=copies[i];
    if(c){
      g.copyIdx=i;
      g.version=c.version;
      g.style=c.style;
      g.label=`版本 ${c.version} · ${c.style}`;
      g.poster=copyToPoster(c);
    }
    if(!g.product&&img.inputs.copy.product)g.product=cloneObj(img.inputs.copy.product);
    if(!g.ref&&img.inputs.copy.ref)g.ref=cloneObj(img.inputs.copy.ref);
    return g;
  });
}
function syncCopyInputsToGroups(){
  img.copyGroups.forEach(g=>{if(img.inputs.copy.product)g.product=cloneObj(img.inputs.copy.product);if(img.inputs.copy.ref)g.ref=cloneObj(img.inputs.copy.ref);});
}
function queueStatus(g){
  const product=g.product||img.inputs.copy.product;
  const ref=g.ref||img.inputs.copy.ref;
  if(g.generating)return ['生成中','run'];
  if(g.result&&g.result.images&&g.result.images.length)return ['已完成','done'];
  if(g.poster&&product&&ref)return ['待生成','ready'];
  return ['待补素材','wait'];
}
function renderCopyQueue(){
  if(!img.copyGroups.length)return '';
  const doneCount=img.copyGroups.filter(g=>g.result&&g.result.images&&g.result.images.length).length;
  return `<div class="queue-panel"><div class="queue-head"><div><b>自动生成任务队列</b><p>文案版本已自动转为待执行任务，可一键批量生成，也可逐模块生成。</p></div><div class="version-actions"><button class="btn btn-violet" data-imggencopyall ${img.copyGroups.length?'':'disabled'}>一键生成全部队列</button><button class="btn btn-ghost" data-imgexportall ${doneCount?'':'disabled'}>批量导出全部结果</button></div></div><div class="queue-list">${img.copyGroups.map((g,i)=>{const st=queueStatus(g);return `<div class="qitem"><div class="qleft"><b>任务 ${i+1}</b><span>${esc(g.label||('版本 '+(g.version||'')))}</span></div><div class="qright"><span class="qstatus ${st[1]}">${st[0]}</span><button class="mini-btn" data-queuejump="${i}">定位模块</button>${g.result&&g.result.images&&g.result.images.length?`<button class="mini-btn" data-imgexport-group="${i}">导出本组</button>`:''}</div></div>`;}).join('')}</div></div>`;
}
function resultThumbs(images,kind,groupIdx,prefix){
  return `<div class="thumb-grid">${(images||[]).map((src,i)=>`<div class="thumb-card"><img src="${src}" alt="" data-preview-kind="${kind}" data-preview-group="${groupIdx==null?'':groupIdx}" data-preview-idx="${i}" title="点击放大预览"><div class="thumb-meta">${esc(prefix)} ${i+1}</div><div class="thumb-actions"><button class="mini-btn" data-preview-kind="${kind}" data-preview-group="${groupIdx==null?'':groupIdx}" data-preview-idx="${i}">预览</button><button class="mini-btn" data-download-kind="${kind}" data-download-group="${groupIdx==null?'':groupIdx}" data-download-idx="${i}">下载</button><button class="mini-btn" data-regen-kind="${kind}" data-regen-group="${groupIdx==null?'':groupIdx}" data-regen-idx="${i}">重生成</button></div></div>`).join('')}</div>`;
}
function getResultImage(kind,groupIdx,idx){
  if(kind==='frame')return img.result&&img.result.images?img.result.images[idx]:null;
  const g=img.copyGroups[groupIdx];
  return g&&g.result&&g.result.images?g.result.images[idx]:null;
}
let IMAGE_EXPORT_CONTEXT={items:[],title:'图片导出',selectedFormat:'jpg',prepareSeq:0,prepared:[]};
function imageExportBaseName(name,index){const raw=String(name||'').replace(/\.(?:png|jpe?g|webp|gif|pdf)$/i,'');return raw||('ai-image-'+(index+1));}
function cleanupImageExportPrepared(){
  (IMAGE_EXPORT_CONTEXT.prepared||[]).forEach(x=>{try{window.ImageExport&&window.ImageExport.disposePreparedArtifact?window.ImageExport.disposePreparedArtifact(x):x&&x.dispose&&x.dispose();}catch(_e){}});
  IMAGE_EXPORT_CONTEXT.prepared=[];
}
function cleanupImageExportContext(){IMAGE_EXPORT_CONTEXT.prepareSeq=(IMAGE_EXPORT_CONTEXT.prepareSeq||0)+1;cleanupImageExportPrepared();IMAGE_EXPORT_CONTEXT.items=[];}
function imageExportButtonsHtml(){
  const selected=IMAGE_EXPORT_CONTEXT.selectedFormat||'jpg';
  return `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <span class="hint" style="margin-right:2px">下载格式：</span>
    ${['jpg','jpeg','png','pdf'].map(f=>`<button class="btn ${selected===f?'btn-violet':'btn-ghost'}" data-image-export-format="${f}">${f==='jpg'?'JPG':f==='jpeg'?'JPEG':f.toUpperCase()}</button>`).join('')}
  </div>`;
}
function imageExportConfirmHtml(){return `<div id="image-export-download-state" class="notebox" style="margin:14px 0 0">正在准备 JPG 下载文件…</div><div id="image-export-confirm-area" class="row" style="margin-top:12px;gap:8px;display:flex;flex-wrap:wrap"><button class="btn btn-violet" disabled>正在准备，请稍候…</button></div>`;}
function setImageExportContext(items,title){
  cleanupImageExportContext();
  IMAGE_EXPORT_CONTEXT={items:(items||[]).filter(x=>x&&x.src).map((x,i)=>({src:x.src,name:imageExportBaseName(x.name,i)})),title:title||'图片导出',selectedFormat:'jpg',prepareSeq:(IMAGE_EXPORT_CONTEXT.prepareSeq||0)+1,prepared:[]};
  return IMAGE_EXPORT_CONTEXT;
}
function updateImageExportFormatButtons(format){
  document.querySelectorAll('#modal [data-image-export-format]').forEach(btn=>{const active=btn.dataset.imageExportFormat===format;btn.classList.toggle('btn-violet',active);btn.classList.toggle('btn-ghost',!active);});
}
function renderPreparedDownloadLinks(artifacts,format){
  const exporter=window.ImageExport,label=exporter.formatDescriptor(format).label,area=document.getElementById('image-export-confirm-area'),status=document.getElementById('image-export-download-state');
  if(!area)return;
  area.innerHTML=artifacts.map((a,i)=>`<a class="btn btn-violet" href="${a.objectUrl}" download="${esc(a.fileName)}" data-image-export-confirm="${i}">✓ 确认下载${artifacts.length>1?' '+(i+1):''} ${label}</a>`).join('');
  if(status){status.className='notebox';status.style.margin='14px 0 0';status.textContent=artifacts.length>1?`已准备 ${artifacts.length} 个 ${label} 文件。为避免浏览器拦截多文件自动下载，请逐个点击“确认下载”。`:`${label} 文件已准备完成。请点击下方“确认下载 ${label}”，由浏览器直接保存本地文件。`;}
}
async function prepareImageExportFormat(format,button){
  const exporter=window.ImageExport;if(!exporter||typeof exporter.prepareDownloadArtifact!=='function'){setActionStatus('error','V27 图片导出模块未加载',false);return;}
  const items=(IMAGE_EXPORT_CONTEXT.items||[]).slice();if(!items.length){setActionStatus('error','暂无可下载的图片',false);return;}
  const f=exporter.normalizeFormat(format),seq=++IMAGE_EXPORT_CONTEXT.prepareSeq;IMAGE_EXPORT_CONTEXT.selectedFormat=f;cleanupImageExportPrepared();updateImageExportFormatButtons(f);
  const label=exporter.formatDescriptor(f).label,status=document.getElementById('image-export-download-state'),area=document.getElementById('image-export-confirm-area');
  if(status){status.className='notebox';status.textContent=`正在把当前图片转换为 ${label}，完成后会出现“确认下载”按钮…`;}
  if(area)area.innerHTML='<button class="btn btn-violet" disabled>正在准备，请稍候…</button>';
  document.querySelectorAll('#modal [data-image-export-format]').forEach(x=>x.disabled=true);
  try{
    const artifacts=[];
    for(let i=0;i<items.length;i++)artifacts.push(await exporter.prepareDownloadArtifact(items[i].src,items[i].name,f));
    if(seq!==IMAGE_EXPORT_CONTEXT.prepareSeq){artifacts.forEach(x=>exporter.disposePreparedArtifact&&exporter.disposePreparedArtifact(x));return;}
    IMAGE_EXPORT_CONTEXT.prepared=artifacts;renderPreparedDownloadLinks(artifacts,f);
  }catch(e){
    if(seq!==IMAGE_EXPORT_CONTEXT.prepareSeq)return;
    if(status){status.className='notebox';status.style.background='#fef2f2';status.style.borderColor='#fecaca';status.style.color='#b91c1c';status.textContent='下载文件准备失败：'+(e&&e.message||e);}
    if(area)area.innerHTML='<button class="btn btn-ghost" data-image-export-retry>重新准备下载</button>';
    setActionStatus('error','图片下载准备失败：'+(e&&e.message||e),false);
  }finally{if(seq===IMAGE_EXPORT_CONTEXT.prepareSeq)document.querySelectorAll('#modal [data-image-export-format]').forEach(x=>x.disabled=false);}
}
function openImageDownloadDialog(src,name,title){
  const items=Array.isArray(src)?src:[{src,name:name||'ai-image'}];setImageExportContext(items,title||'图片导出');
  if(!IMAGE_EXPORT_CONTEXT.items.length){toast('暂无可下载的图片',true);return;}
  modalOpen(`<h3>${esc(title||'下载图片')}</h3><p class="hint">先选择格式，系统会在本地准备文件；文件准备完成后，再点击明确的“确认下载”按钮。JPG/JPEG 使用白色背景；PNG 保留透明通道；PDF 自动适配单页。</p><div class="notebox" style="margin:12px 0">V27 不再依赖异步后的自动下载，也不要求浏览器弹出文件系统权限。最终下载由你亲自点击“确认下载”触发，避免 Edge/Chrome 拦截。</div>${imageExportButtonsHtml()}${imageExportConfirmHtml()}<div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
  setTimeout(()=>{if(document.getElementById('image-export-confirm-area'))prepareImageExportFormat('jpg');},0);
}
async function runImageExportFormat(format,button){return prepareImageExportFormat(format,button);}
function downloadDataUrl(src,name){if(!src)return;openImageDownloadDialog(src,name||('ai-image-'+Date.now()),'下载图片');}
function batchExportImages(images,prefix){
  if(!images||!images.length){toast('暂无可导出的图片',true);return;}
  openImageDownloadDialog(images.map((src,i)=>({src,name:`${prefix}-${i+1}`})),'',`批量导出 ${images.length} 张图片`);
}
function exportAllCopyResults(){
  let all=[];img.copyGroups.forEach((g,gi)=>{(g.result&&g.result.images||[]).forEach((src,ii)=>all.push({src,name:`group${gi+1}-${ii+1}`}));});
  if(!all.length){toast('暂无可导出的结果',true);return;}openImageDownloadDialog(all,'',`批量导出全部结果（${all.length} 张）`);
}
function openImgPreview(src,title){
  if(!src)return;setImageExportContext([{src,name:'ai-image-'+Date.now()}],title||'图片预览');
  modalOpen(`<h3 style="margin-bottom:10px;">${esc(title||'图片预览')}</h3>
    <div class="preview-box"><img src="${src}" alt="预览"></div>
    <div style="margin-top:14px">${imageExportButtonsHtml()}${imageExportConfirmHtml()}</div>
    <div class="row" style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;"><button class="btn btn-ghost" data-mclose>关闭</button></div>`, true);
  const mb=document.querySelector('#modal .modal-box'); if(mb) mb.classList.add('huge');
  setTimeout(()=>{if(document.getElementById('image-export-confirm-area'))prepareImageExportFormat('jpg');},0);
}
function viewImage(){
  if(imgCarry){img.mode='frame';if(imgCarry.frame)img.inputs.frame.wire={src:imgCarry.frame.src,name:imgCarry.frame.name};if(imgCarry.prompt)img.userPrompt.frame=imgCarry.prompt;img.banner=!!imgCarry.frame;imgCarry=null;}
  return `<h1 class="title">${uiIcon('image','title-icon')}<span>AI 生图</span></h1><div id="img-root"></div>`;
}
function slotBox(mode,field,extra=''){
  const v= mode==='frame'?img.inputs.frame[field]:img.inputs.copy[field];
  const star=(field==='product'||field==='ref')?' <span style="color:var(--red-500)">*</span>':'';
  const label= mode==='copy'?`统一${SLOT_LABEL[field]}`:SLOT_LABEL[field];
  if(v)return `<div class="cell"><label class="fl">${label}${star}</label><div class="upl filled" data-up="${mode==='copy'?'copybulk':mode}|${field}" style="flex:1;padding:8px;"><img class="frameimg" src="${v.src}" alt=""><span style="font-size:12px;">${esc(v.name||'已上传')} · <span class="hint">点击替换</span></span></div></div>`;
  const tip=field==='wire'?'待从线框生成带入，或点击上传':'点击上传后自动同步到全部组';
  return `<div class="cell"><label class="fl">${label}${star}</label><div class="upl" data-up="${mode==='copy'?'copybulk':mode}|${field}" style="flex:1;"><span class="ph-em">🖼️</span>${tip}</div></div>`;
}
function frameResultBox(){
  if(img.generating&&img.mode==='frame')return `<div class="wfres"><div class="spin"></div><div>${esc(img.progress||'生成中…')}</div><div class="pbar"><span data-img-flow-progressbar style="width:${imageFlowProgressPercent('frame')}%"></span></div><button class="stopbtn" data-imgstop>停止生成</button></div>`;
  if(img.result&&img.mode==='frame')return `<div class="wfres has"><div class="result-actions"><button class="mini-btn" data-imgregen-frame>重生成</button><button class="mini-btn" data-imgexport-frame>批量导出</button></div>${resultThumbs(img.result.images||[],'frame',null,'主图')}<div class="hint" style="margin-top:8px;">生成时间：${img.result.time}</div></div>`;
  return `<div class="wfres"><div style="font-size:24px">🖼️</div><div>待生成</div></div>`;
}
function currentCopyVersionText(){
  ensureCopySelection();
  const ids=selectedCopyIds();
  if(!ids.length)return '暂无，需先选择或添加文案版本';
  return ids.map(idx=>{const c=getCopyVersionByIndex(idx);return c?`版本${c.version}`:'';}).filter(Boolean).join(' / ');
}
function copyVersionPicker(){
  if(!copies.length)return `<div class="version-toolbar"><div class="notebox" style="background:#fffbeb;border-color:#fde68a;color:#78350f;flex:1;">当前还没有从「文案生成」生成可选版本。可以先去文案生成，或点击右侧新增自定义文案版本。</div><button class="btn btn-violet" data-imgaddversion>+ 新增文案版本</button></div>`;
  ensureCopySelection();
  const activeSet=new Set(img.copySelected||[]);
  return `<div class="version-panel">
    <div class="version-head"><div><b>文案排版库（支持多选）</b><p>与「文案生成」模块联动。可同时勾选多个版本；每选中一个版本，下方会自动新增一个对应的「排版文案 + 产品图 + 参考图 = 主图」功能模块。</p></div><div class="version-actions"><button class="btn btn-ghost" data-gocopy>去文案生成</button><button class="btn btn-ghost" data-imgvclear>清空选择</button><button class="btn btn-ghost" data-imgvall>全选版本</button><button class="btn btn-violet" data-imgaddversion>+ 新增文案版本</button></div></div>
    <div class="version-tabs">${copies.map((c,i)=>`<button class="vtab ${activeSet.has(i)?'on':''}" data-imgv="${i}"><span>${activeSet.has(i)?'☑':'☐'} 版本 ${c.version}</span><em>${esc(c.style)}</em><i data-imgdelversion="${i}" title="删除此版本">×</i></button>`).join('')}</div>
  </div>`;
}
function copyGroupCard(g,i){
  const ready=g.poster&&(g.product||img.inputs.copy.product)&&(g.ref||img.inputs.copy.ref);
  const product=g.product||img.inputs.copy.product;
  const ref=g.ref||img.inputs.copy.ref;
  const result = g.generating ? `<div class="wfres"><div class="spin"></div><div>生成当前模块…</div><div class="pbar"><span data-img-flow-progressbar style="width:${imageFlowProgressPercent('copy')}%"></span></div></div>`
    : g.result ? `<div class="wfres has"><div class="result-actions"><button class="mini-btn" data-imggengroup="${i}">重生成本组</button><button class="mini-btn" data-imgexport-group="${i}">导出本组</button></div>${resultThumbs(g.result.images||[],'copy',i,'主图')}<div class="hint">完成时间：${g.result.time}</div></div>`
    : `<div class="wfres"><div style="font-size:22px">🖼️</div><div>${ready?'待生成主图':'请补充文案 / 产品图 / 参考图'}</div><p class="hint" style="margin:0;">当前模块会使用：排版文案 + 产品图 + 参考图</p></div>`;
  const uploadTile=(field,val)=> val ? `<div class="upl filled module-upl" data-up="copygrp|${field}|${i}"><img class="frameimg" src="${val.src}" alt=""><span>${esc(val.name||'已上传')} · 点击替换</span></div>` : `<div class="upl module-upl" data-up="copygrp|${field}|${i}"><span class="ph-em">🖼️</span>点击上传${SLOT_LABEL[field]}</div>`;
  return `<div class="imggroup module-card" data-copygroup="${i}">
    <div class="imggroup-h"><div><b>功能模块 ${i+1}：排版文案 + 产品图 + 参考图 = 主图</b><p>当前使用：${g.version?`版本${g.version}`:'手动文案'}${g.style?' · '+esc(g.style):''}</p></div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-ghost" data-refreshcopygroup="${i}">同步当前版本文案</button><button class="btn btn-violet" data-imggengroup="${i}" ${ready?'':'disabled'}>生成当前模块</button></div></div>
    <div class="module-formula"><span>排版文案</span><b>+</b><span>产品图</span><b>+</b><span>参考图</span><b>=</b><span>主图</span></div>
    <div class="module-grid">
      <div class="module-copy"><label class="fl">排版文案</label><textarea rows="9" data-copygroup-poster="${i}">${esc(g.poster||'')}</textarea><p class="hint">切换上方版本会自动替换这里的文案，不需要先删除旧组。</p></div>
      <div class="module-material"><label class="fl">产品图 <span style="color:var(--red-500)">*</span></label>${uploadTile('product',product)}</div>
      <div class="module-material"><label class="fl">参考图 <span style="color:var(--red-500)">*</span></label>${uploadTile('ref',ref)}</div>
      <div class="module-result"><label class="fl">生成主图</label><div class="mini-status"><span class="${g.poster?'ok':''}">文案：${g.poster?'已填充':'未填写'}</span><span class="${product?'ok':''}">产品图：${product?'已上传':'未上传'}</span><span class="${ref?'ok':''}">参考图：${ref?'已上传':'未上传'}</span><span>生成数量：${img.count} 张</span></div>${result}</div>
    </div>
  </div>`;
}
function renderFrameMode(){
  return `<div class="eq img-eq">${slotBox('frame','wire')}<div class="op">+</div>${slotBox('frame','product')}<div class="op">+</div>${slotBox('frame','ref')}<div class="op">=</div><div class="cell"><label class="fl">生成主图</label>${frameResultBox()}</div></div>`;
}
function renderCopyMode(){
  rebuildCopyGroupsFromSelection(true);
  return `<div class="copy-modebox">
    <div class="notebox" style="margin-bottom:14px;background:#f8fafc;border-color:#e2e8f0;color:#334155;">当前选中文案版本：<b>${currentCopyVersionText()}</b></div>
    <label class="fl">选择文案版本（支持多选）</label>${copyVersionPicker()}
    <div class="notebox" style="margin:14px 0;background:#eef2ff;border-color:#c7d2fe;color:#3730a3;">逻辑说明：上方「文案排版库」可多选；每选中一个版本，下方会自动新增一个相同结构的「功能模块：排版文案 + 产品图 + 参考图 = 主图」。取消勾选后，对应模块会自动移除；产品图和参考图可统一同步到全部模块。</div>
    ${renderCopyQueue()}
    <div class="imggroups ${img.copyGroups.length>1?'multi-module':'single-module'}">${img.copyGroups.length?img.copyGroups.map(copyGroupCard).join(''):`<div class="wfres"><div style="font-size:24px">🧩</div><div>请先从文案排版库选择一个或多个版本</div><p class="hint" style="margin:0;">选择后将自动生成对应数量的功能模块。</p></div>`}</div>
  </div>`;
}
function imageFlowCard(mode){
  const isFrame=mode==='frame',ui=imageFlowUi(mode);
  let steps=[],current=1,completed=false,message='';
  if(isFrame){
    const hasWire=!!img.inputs.frame.wire;
    const hasProduct=!!img.inputs.frame.product;
    const hasRef=!!img.inputs.frame.ref;
    const hasResult=!!(img.result&&img.mode==='frame'&&img.result.images&&img.result.images.length);
    steps=['线框图','产品图','参考图','生成主图','完成'];
    if(hasResult){current=5;completed=true;message='主图已生成，可在下方预览、重生成或批量导出。';}
    else if(img.generating&&img.mode==='frame'){current=4;message=img.progress||'正在根据线框、产品图与参考图生成主图…';}
    else if(!hasWire){current=1;message='先从 AI 线框生成带入线框图，或在下方上传线框图。';}
    else if(!hasProduct){current=2;message='线框图已准备，请上传需要保持外观一致的产品图。';}
    else if(!hasRef){current=3;message='产品图已准备，请上传用于约束风格、配色与光影的参考图。';}
    else{current=4;message='素材已齐全，请确认生成数量、比例、分辨率和质量后开始生成。';}
  }else{
    ensureCopySelection();
    rebuildCopyGroupsFromSelection(true);
    const hasCopy=selectedCopyIds().length>0&&img.copyGroups.length>0;
    const hasProduct=!!img.inputs.copy.product||img.copyGroups.some(g=>!!g.product);
    const hasRef=!!img.inputs.copy.ref||img.copyGroups.some(g=>!!g.ref);
    const generating=img.copyGroups.some(g=>!!g.generating);
    const hasResult=img.copyGroups.length>0&&img.copyGroups.every(g=>g.result&&g.result.images&&g.result.images.length);
    steps=['选择文案','产品图','参考图','生成队列','完成'];
    if(hasResult){current=5;completed=true;message='所选文案版本均已生成，可在各功能模块中预览或导出。';}
    else if(generating){current=4;message='正在按文案版本队列生成主图，请保持页面开启。';}
    else if(!hasCopy){current=1;message='先从文案排版库选择一个或多个文案版本。';}
    else if(!hasProduct){current=2;message='文案版本已选择，请上传统一产品图或为各模块分别上传。';}
    else if(!hasRef){current=3;message='产品图已准备，请上传统一参考图或为各模块分别上传。';}
    else{current=4;message='素材已齐全，请确认参数后生成全部队列或单独生成某个模块。';}
  }
  if(completed&&ui.collapsed){
    return `<section class="ai-image-flow-card is-collapsed" data-flow-mode="${mode}" aria-label="AI生图流程已完成"><button type="button" class="ai-image-flow-collapsed" data-img-flow-toggle><span class="ai-image-flow-collapsed-main"><span class="ai-image-flow-collapsed-check">✓</span><span><b>主图生成完成</b><small>${esc(mode==='frame'?'线框图模式结果已就绪':'所选文案队列结果已就绪')} · 点击展开流程</small></span></span><span class="ai-image-flow-collapsed-arrow">›</span></button></section>`;
  }
  const error=ui.error;
  if(error){current=error.step;completed=false;message=error.message;}
  const stepHtml=steps.map((label,i)=>{
    const n=i+1;
    let cls='';
    if(error){cls=n<current?'done':n===current?'error':'';}
    else cls=completed||n<current?'done':n===current?'current':'';
    const dot=(completed||n<current)?'✓':error&&n===current?'!':String(n);
    return `<div class="ai-image-flow-step ${cls}"><span class="ai-image-flow-dot">${dot}</span><span class="ai-image-flow-label">${esc(label)}</span></div>`;
  }).join('');
  const stateText=error?`第 ${current} 步失败`:completed?'流程已完成':`当前第 ${current} 步`;
  const shortLogic=isFrame?'线框图 + 产品图 + 参考图 = 主图':'排版文案 + 产品图 + 参考图 = 主图';
  const eta=imageFlowEta(mode);
  let retryHtml='';
  if(error){
    const type=error.retry&&error.retry.type;
    const label=type==='upload'?'重新上传':type==='config'?'配置接口':'重新生成';
    retryHtml=`<button type="button" class="ai-image-flow-retry" data-img-flow-retry>${label}</button>`;
  }
  return `<section class="ai-image-flow-card" data-flow-mode="${mode}" aria-label="AI生图流程">
    <div class="ai-image-flow-head"><div><b>${esc(MODE_SHORT[mode])}生成流程</b><small>${esc(shortLogic)}</small></div><div class="ai-image-flow-meta"><span class="ai-image-flow-state ${error?'error':completed?'done':''}">${stateText}</span><span class="ai-image-flow-eta ${eta.cls}">${eta.text}</span></div></div>
    <div class="ai-image-flow-track">${stepHtml}</div>
    <div class="ai-image-flow-message ${error?'error':''}" aria-live="polite"><span class="ai-image-flow-progress-note">${esc(message)}</span>${retryHtml}</div>
    <details class="ai-image-flow-details"><summary>查看完整逻辑规则</summary><div class="ai-image-flow-rule">${esc(img.builtin[mode])}</div></details>
  </section>`;
}
function imageModelParameterUi(){
  const model=(typeof API_BRIDGE!=='undefined'&&API_BRIDGE.imageModel)||(window.EvoLinkImageAdapter&&window.EvoLinkImageAdapter.DEFAULT_MODEL)||'未选择模型';
  const A=window.EvoLinkImageAdapter;
  const normalized=A&&A.normalizeModelOptions?A.normalizeModelOptions(model,{aspect:img.aspect,resolution:img.resolution,quality:img.quality}):{aspect:img.aspect,resolution:String(img.resolution||'2K').toUpperCase(),quality:img.quality,schema:{aspectOptions:['1:1','3:4','4:3','9:16','16:9'],resolutionOptions:['1K','2K','4K'],qualityOptions:[{value:'低',label:'低'},{value:'中',label:'中'},{value:'高',label:'高'}],showResolution:true,showQuality:true,hint:'通用参数'}};
  const sc=normalized.schema;img.aspect=normalized.aspect;img.resolution=normalized.resolution;img.quality=normalized.quality;
  const resolutionSummary=sc.showResolution?String(img.resolution||'模型自动').toUpperCase():String(sc.defaultResolution||img.resolution||'模型自动');
  const qualitySummary=sc.showQuality?String(img.quality||'模型自动'):'模型自动';
  const summary=`${img.count} 张 · ${img.aspect} · ${resolutionSummary} · ${qualitySummary}`;
  const aspect=`<div><label class="fl">画幅比例</label><select data-imgaspect>${sc.aspectOptions.map(x=>`<option value="${x}" ${img.aspect===x?'selected':''}>${x}</option>`).join('')}</select></div>`;
  const resolution=sc.showResolution?`<div><label class="fl">分辨率</label><select data-imgres>${sc.resolutionOptions.map(x=>`<option value="${x}" ${String(img.resolution).toUpperCase()===x?'selected':''}>${x}</option>`).join('')}</select></div>`:`<div><label class="fl">分辨率</label><div class="notebox image-parameter-auto-value">${esc(sc.defaultResolution||img.resolution||'模型自动')}</div></div>`;
  const quality=sc.showQuality?`<div><label class="fl">生成质量</label><div class="seg tinyseg">${sc.qualityOptions.map(x=>`<button type="button" data-imgquality="${x.value}" class="${img.quality===x.value?'on':''}">${esc(x.label)}</button>`).join('')}</div></div>`:`<div><label class="fl">质量参数</label><div class="notebox image-parameter-auto-value">模型自动适配</div></div>`;
  const panel=img.parametersExpanded?`<div class="image-parameter-panel" id="image-parameter-panel"><div class="gen-options"><div><label class="fl">生成数量</label>${imgCountButtons()}</div>${aspect}${resolution}${quality}</div><div class="notebox image-parameter-model-note"><b>当前模型：</b>${esc(model)} · ${esc(sc.hint||'已按模型能力自动适配参数')}</div></div>`:'';
  return `<section class="image-parameter-accordion ${img.parametersExpanded?'is-open':''}"><button type="button" class="image-parameter-toggle" data-img-parameter-toggle aria-expanded="${img.parametersExpanded?'true':'false'}" aria-controls="image-parameter-panel"><span class="image-parameter-toggle-main"><b>生成参数</b><small>${esc(summary)}</small></span><span class="image-parameter-toggle-action">${img.parametersExpanded?'收起':'展开'}<i aria-hidden="true">⌄</i></span></button>${panel}</section>`;
}
function renderImageView(){
  const root=$('img-root'); if(!root)return;
  const m=img.mode;
  const sharedReady=typeof sharedImageChannelReady==='function'?sharedImageChannelReady():!!img.configured;
  const channelCard=typeof sharedChannelStatusHtml==='function'?sharedChannelStatusHtml('image'):'';
  root.innerHTML=`${channelCard}
    <div class="toolbar">
      <button class="tbtn" data-imgcfg><span class="dot ${sharedReady?'on':''}"></span>⚙ API 接入配置</button>
      <button class="tbtn" data-conntest>🔗 测试连接</button>
      <button class="tbtn" data-imgbuiltin>${uiIcon('copy','mini-linear-icon')}内置提示词（当前模式）</button>
      <button class="tbtn" data-imghist>🕘 历史记录${img.history.length?` (${img.history.length})`:''}</button>
      <button class="tbtn" data-image-task-center>▣ 生图任务中心${typeof imageTaskCenterItems!=='undefined'&&imageTaskCenterItems.length?` (${imageTaskCenterItems.length})`:''}</button>
    </div>
    <div class="current-mode"><span>当前模式</span><b>${MODE_LABEL[m]}</b></div>
    <div class="panel">
      <label class="fl">生图模式（可双向切换）</label>
      <div class="seg mode-wide" id="mode-seg" style="margin-bottom:10px;"><button data-mode="frame" class="${m==='frame'?'on':''}">AI生成的线框图 + 产品图 + 参考图 = 主图</button><button data-mode="copy" class="${m==='copy'?'on':''}">排版文案 + 产品图 + 参考图 = 主图</button></div>
      ${imageFlowCard(m)}
      ${(m==='frame'&&img.banner)?`<div class="notebox" style="margin-bottom:14px;background:#ecfdf5;border-color:#a7f3d0;color:#047857;">✅ 已自动带入「AI 生成的线框图」，可继续上传产品图和参考图。</div>`:''}
      ${imageModelParameterUi()}
      ${m==='frame'?renderFrameMode():renderCopyMode()}
      <div style="margin-top:16px;"><label class="fl">补充提示词（可选）</label><textarea data-imgprompt placeholder="在内置提示词基础上补充，例如：医用类电商主图、背景元素不要过多、产品标签清晰…">${esc(img.userPrompt[m]||'')}</textarea></div>
      <div class="row" style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap;">${img.generating?'<button class="stopbtn" data-imgstop>停止生成</button>':`<button class="btn btn-violet" data-imggen>${m==='copy'?'生成全部队列':'生成图片'}</button>`}</div>
    </div>`;
}
function chooseFile(cb,errCb,cancelCb){let fi=$('imgfile');if(!fi){fi=document.createElement('input');fi.type='file';fi.accept='image/*';fi.id='imgfile';fi.style.display='none';document.body.appendChild(fi);}let picked=false;fi.value='';fi.onchange=()=>{const f=fi.files&&fi.files[0];if(!f){if(cancelCb)cancelCb();return;}picked=true;const r=new FileReader();r.onload=()=>cb({src:r.result,name:f.name});r.onerror=()=>{if(errCb)errCb(new Error('文件读取失败'));};r.readAsDataURL(f);};const onFocus=()=>setTimeout(()=>{window.removeEventListener('focus',onFocus);if(!picked&&!fi.files.length&&cancelCb)cancelCb();},260);window.addEventListener('focus',onFocus);fi.click();}
function imgUpload(scope,field,idx){
  const key='img-upload-'+scope+'-'+field+'-'+(idx==null?'all':idx),mode=scope==='frame'?'frame':'copy',step=imageFlowUploadStep(field);
  if(!actionLock(key))return;
  chooseFile(file=>{
    try{
      setActionStatus('loading','正在上传'+SLOT_LABEL[field]+'…',true);
      if(scope==='frame'){
        invalidateImageFlowResult('frame');img.inputs.frame[field]=file;if(field==='wire')img.banner=false;renderImageView();actionDone(key,'已上传'+SLOT_LABEL[field]);return;
      }
      if(scope==='copybulk'){
        invalidateImageFlowResult('copy');img.inputs.copy[field]=file;syncCopyInputsToGroups();renderImageView();actionDone(key,'已上传统一'+SLOT_LABEL[field]+'，并同步到全部组');return;
      }
      if(scope==='copygrp'){
        const g=img.copyGroups[idx];if(g){invalidateImageFlowResult('copy',idx);g[field]=file;renderImageView();actionDone(key,'已上传本组'+SLOT_LABEL[field]);return;}
      }
      const msg='上传失败：未找到目标模块';setImageFlowError(mode,step,msg,{type:'upload',scope,field,idx});renderImageView();actionFail(key,msg);
    }catch(err){const msg='上传失败：'+err.message;setImageFlowError(mode,step,msg,{type:'upload',scope,field,idx});renderImageView();actionFail(key,msg);}
  }, err=>{const msg='素材读取失败：'+err.message;setImageFlowError(mode,step,msg,{type:'upload',scope,field,idx});renderImageView();actionFail(key,msg);},()=>actionUnlock(key));
}
function resultImagesFrom(base,count){return Array.from({length:count},()=>base);}
function startImgGen(groupIdx=null){
  if(!(typeof sharedImageChannelReady==='function'?sharedImageChannelReady():img.configured)){toast('请先完成共享图像通道配置',true);openImgCfg();return;}
  const m=img.mode;
  if(m==='frame'){
    const a=img.inputs.frame.wire,b=img.inputs.frame.product,c=img.inputs.frame.ref;
    if(!a||!b||!c){toast('请先准备好「AI生成的线框图」「产品图」「参考图」',true);return;}
    const key='img-generate-frame';
    if(!actionLock(key))return;
    setActionStatus('loading','正在生成主图，请稍候…',true);
    img.generating=true;img.progress='生成中：线框图 + 产品图 + 参考图 → 主图';img.result=null;renderImageView();
    imgTimers.t=setTimeout(()=>{img.generating=false;img.result={time:nowStr(),images:resultImagesFrom(a.src,img.count)};img.history.unshift({id:uid(),mode:m,time:nowStr(),inputs:cloneObj(img.inputs.frame),builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:a.src});renderImageView();actionDone(key,'已生成 '+img.count+' 张主图，并存入历史');},2400);
    return;
  }
  rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();
  const targets=groupIdx==null?img.copyGroups:[img.copyGroups[groupIdx]].filter(Boolean);
  if(!targets.length){toast('请先选择文案版本并自动补充组',true);return;}
  const notReady=targets.find(g=>!g.poster||!(g.product||img.inputs.copy.product)||!(g.ref||img.inputs.copy.ref));
  if(notReady){toast('请确认每组都有排版文案、产品图和参考图',true);return;}
  const key='img-generate-copy-'+(groupIdx==null?'all':groupIdx);
  if(!actionLock(key))return;
  setActionStatus('loading',groupIdx==null?'正在生成全部队列主图…':'正在生成当前模块主图…',true);
  targets.forEach(g=>{g.generating=true;g.result=null;});img.generating=groupIdx==null;img.progress='当前模块生成中…';renderImageView();
  imgTimers.t=setTimeout(()=>{targets.forEach(g=>{g.generating=false;const base=(g.ref||img.inputs.copy.ref).src;g.result={time:nowStr(),images:resultImagesFrom(base,img.count)};img.history.unshift({id:uid(),mode:m,time:nowStr(),label:g.label,poster:g.poster,inputs:{product:g.product||img.inputs.copy.product,ref:g.ref||img.inputs.copy.ref},builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:base});});img.generating=false;renderImageView();actionDone(key,'已为 '+targets.length+' 个模块生成主图，每个模块 '+img.count+' 张');},2400);
}
function stopImgGen(){if(imgTimers.t){clearTimeout(imgTimers.t);imgTimers.t=null;}clearImageFlowTimers();const ui=imageFlowUi(img.mode);ui.active=false;ui.progress=0;ui.collapsed=false;img.generating=false;img.copyGroups.forEach(g=>g.generating=false);renderImageView();Object.keys(actionBusy).filter(k=>k.indexOf('img-generate-')===0||k==='image-api-generate').forEach(k=>actionUnlock(k));setActionStatus('success','已停止生成，可随时重新开始',false);toast('已停止生成');}
function openImgCfg(){modalOpen(`<h3>AI 生图 · API 接入配置</h3>
  <p class="hint">填好接口地址与密钥即可，<b>模型名称自动配置</b>，无需手动填写。两种模式共用网关，但各自调用对应的内置提示词与参数。</p>
  <label class="fl">接口地址</label><input type="text" id="imgcfg-url" placeholder="https://…/v1" value="${esc(img.baseUrl)}">
  <label class="fl">API 密钥</label><input type="text" id="imgcfg-key" placeholder="sk-…" value="${esc(img.key)}">
  <div class="row" style="margin-top:18px;"><button class="btn btn-violet" data-imgcfg-save>保存并自动配置</button><button class="btn btn-ghost" data-mclose>取消</button></div>`);}
function openImgBuiltin(){const m=img.mode;modalOpen(`<h3>内置提示词 · ${MODE_LABEL[m]}</h3>
  <p class="hint">仅作用于「${MODE_LABEL[m]}」模式；另一模式有独立提示词，互不干涉。<b>保存后持久化，不会回默认</b>。</p>
  <textarea id="imgbp" rows="7">${esc(img.builtin[m])}</textarea>
  <div class="row" style="margin-top:14px;"><button class="btn btn-violet" data-imgbp-save>保存</button><button class="btn btn-ghost" data-imgbp-reset>恢复默认</button><button class="btn btn-ghost" data-mclose>取消</button></div>
  ${promptHistHtml(imgSlot(),'data-imgbp-restore')}`);}
function openImgHist(){const list=img.history.length?img.history.map((h,idx)=>`<div class="histitem"><div class="ht" style="display:flex;align-items:center;gap:10px;"><img src="${h.resultSrc}" style="width:34px;height:44px;object-fit:cover;border-radius:6px;border:1px solid var(--slate-200)"><div style="min-width:0"><b>${MODE_LABEL[h.mode]} · ${h.time}</b><p>${esc(((h.label||'')+' '+(h.userPrompt||'（无补充提示词）')).replace(/\n/g,' '))}</p></div></div><div style="display:flex;gap:6px;flex:0 0 auto;"><button class="btn btn-ghost" data-imgreuse="${idx}">复用参数</button><button class="btn btn-violet" data-imgregen="${idx}">再次生成</button></div></div>`).join(''):'<p class="hint">暂无历史记录。</p>';modalOpen(`<h3>AI 生图 · 历史记录</h3><p class="hint" style="margin:-4px 0 12px;">记录每次的模式 / 输入图片 / 文案版本 / 生成数量 / 时间。</p>${list}<div class="row" style="margin-top:8px;"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}
function imgReuse(idx,gen){const h=img.history[idx];img.mode=h.mode;if(h.mode==='frame'){img.inputs.frame=cloneObj(h.inputs)||img.inputs.frame;img.result=null;}else{img.inputs.copy.product=cloneObj(h.inputs&&h.inputs.product);img.inputs.copy.ref=cloneObj(h.inputs&&h.inputs.ref);if(h.poster){img.copyGroups=[{id:uid(),copyIdx:null,version:null,style:'历史记录',label:h.label||'历史记录',poster:h.poster,product:cloneObj(img.inputs.copy.product),ref:cloneObj(img.inputs.copy.ref),result:null,generating:false}];}}img.userPrompt[h.mode]=h.userPrompt||'';img.builtin[h.mode]=h.builtin||img.builtin[h.mode];img.count=h.count||img.count;img.banner=false;modalClose();if(curView!=='image')render('image');else renderImageView();toast(gen?'已恢复参数并重新生成':'已恢复该次的模式 / 图片 / 提示词');if(gen)setTimeout(()=>startImgGen(),300);}
