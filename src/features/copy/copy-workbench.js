/* ===== V13 AI 返回 JSON 字段映射器 ===== */
const COPY_MAPPING_FIELDS=[
  ['mainTitle','主标题',['title','headline','mainTitle','main_title','主标题']],
  ['coreSellingPoint','核心卖点',['coreSellingPoint','sellingPoint','selling_point','core_selling_point','副标题','核心卖点']],
  ['functionArea','功能区',['functionArea','function_area','benefits','features','feature','功能区']],
  ['subtitle1','小标题1',['subtitle1','subtitles.0','subtitle.0','smallTitles.0','小标题1']],
  ['subtitle2','小标题2',['subtitle2','subtitles.1','subtitle.1','smallTitles.1','小标题2']],
  ['subtitle3','小标题3',['subtitle3','subtitles.2','subtitle.2','smallTitles.2','小标题3']],
  ['consumerInsight','消费者洞察',['consumerInsight','consumer_insight','insight','consumer','消费者洞察']]
];
let COPY_PREVIEW_MODE='copy';
let COPY_CASE_SELECTED=new Set();
let COPY_CASE_ACTIVE=0;
let COPY_CASE_VIEW='single';
function stripJsonFence(s){return String(s||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');}
function parseMaybeJson(v){if(v&&typeof v==='object')return v;if(typeof v!=='string')return v;const s=stripJsonFence(v);try{return JSON.parse(s);}catch(e){return v;}}
function copyResponseBundle(){let parsed={};try{parsed=JSON.parse(COPY_API_CHANNEL.lastResponse||'{}');}catch(e){parsed={rawText:COPY_API_CHANNEL.lastResponse||''};}let raw=Object.prototype.hasOwnProperty.call(parsed,'raw')?parsed.raw:parsed;let extracted=Object.prototype.hasOwnProperty.call(parsed,'extracted')?parsed.extracted:getByPath(raw,COPY_API_CHANNEL.responsePath);extracted=parseMaybeJson(extracted);return {raw,extracted};}
function flattenJsonPaths(obj,prefix='',out=[],depth=0){if(depth>8||out.length>700)return out;if(obj===null||obj===undefined){out.push({path:prefix,value:obj});return out;}if(Array.isArray(obj)){if(!obj.length)out.push({path:prefix,value:[]});obj.forEach((v,i)=>flattenJsonPaths(v,prefix?prefix+'.'+i:String(i),out,depth+1));return out;}if(typeof obj==='object'){const keys=Object.keys(obj);if(!keys.length)out.push({path:prefix,value:{}});keys.forEach(k=>flattenJsonPaths(obj[k],prefix?prefix+'.'+k:k,out,depth+1));return out;}out.push({path:prefix,value:obj});return out;}
function mapperPathEntries(bundle){const rows=[];flattenJsonPaths(bundle.extracted,'extracted',rows);flattenJsonPaths(bundle.raw,'raw',rows);return rows.filter(x=>x.path);}
function shortPreview(v){if(v===undefined)return '未映射';if(typeof v==='string')return v.length>70?v.slice(0,70)+'…':v;try{const s=JSON.stringify(v);return s.length>70?s.slice(0,70)+'…':s;}catch(e){return String(v);}}
function mappingSourceValue(bundle,path){return getByPath(bundle,path);}
function autoSuggestCopyMapping(entries){const result=Object.assign({},COPY_API_DEFAULT.fieldMapping);const low=entries.map(x=>({path:x.path,low:x.path.toLowerCase()}));COPY_MAPPING_FIELDS.forEach(([field,label,aliases])=>{let hit=null;for(const alias of aliases){const a=alias.toLowerCase();hit=low.find(x=>x.low===a||x.low.endsWith('.'+a)||x.low.replace(/\.\d+\./g,'.').endsWith('.'+a));if(hit)break;}if(!hit&&field.startsWith('subtitle')){const idx=Number(field.slice(-1))-1;hit=low.find(x=>new RegExp(`(subtitle|smalltitle|小标题)(s)?\\.${idx}$`,'i').test(x.path));}result[field]=hit?hit.path:'';});return result;}
function applyCopyMapping(bundle,mapping){const out={};COPY_MAPPING_FIELDS.forEach(([field,label])=>out[field]=mappingSourceValue(bundle,mapping[field]||''));out.subtitles=[out.subtitle1,out.subtitle2,out.subtitle3].filter(v=>v!==undefined&&v!==null&&v!=='');delete out.subtitle1;delete out.subtitle2;delete out.subtitle3;return out;}
function mapperOptions(entries,selected){return `<option value="">未映射</option>`+entries.map(x=>`<option value="${esc(x.path)}" ${x.path===selected?'selected':''}>${esc(x.path)}</option>`).join('');}
function presetCopyCases(){
  const src=copies.length?copies:generate((copies._in||'勒堡乳铁蛋白，猫用免疫保健品'));
  return src;
}
function copyCaseMappedObject(c){
  const b=normalizeCopyBlock(c.block),subs=selectedSubtitleTexts(b);
  return {mainTitle:b.mainTitle,coreSellingPoint:b.coreSellingPoint,functionArea:b.functionArea,subtitles:ensureThreeSubtitles(subs,b.subtitles),consumerInsight:b.insight};
}
function buildPresetCopyBundle(idx){
  const list=presetCopyCases(),safe=Math.max(0,Math.min(Number(idx)||0,list.length-1)),c=list[safe],mapped=copyCaseMappedObject(c);
  return {raw:{id:'preset-copy-case-v13-'+(safe+1),provider:'V13_LOCAL_PRESET',mode:'example_without_api',data:{versions:[{version:c.version,style:c.style,copy:mapped}]}},extracted:{title:mapped.mainTitle,coreSellingPoint:mapped.coreSellingPoint,functionArea:mapped.functionArea,subtitles:mapped.subtitles,consumerInsight:mapped.consumerInsight}};
}
function presetMappingPaths(){return {mainTitle:'extracted.title',coreSellingPoint:'extracted.coreSellingPoint',functionArea:'extracted.functionArea',subtitle1:'extracted.subtitles.0',subtitle2:'extracted.subtitles.1',subtitle3:'extracted.subtitles.2',consumerInsight:'extracted.consumerInsight'};}
function normalizeCopyCaseState(syncFromMain=false){
  const max=presetCopyCases().length;
  let ids=[];
  if(syncFromMain&&selected&&selected.size)ids=[...selected].filter(i=>i>=0&&i<max).sort((a,b)=>a-b);
  else ids=[...COPY_CASE_SELECTED].filter(i=>i>=0&&i<max).sort((a,b)=>a-b);
  if(!ids.length)ids=[0];
  COPY_CASE_SELECTED=new Set(ids);
  if(!ids.includes(COPY_CASE_ACTIVE))COPY_CASE_ACTIVE=ids[0];
  return ids;
}
function selectedCopyCaseIndices(){return normalizeCopyCaseState(false);}
function selectedCopyTargetSummary(){
  const ids=selectedCopyCaseIndices();
  return '当前选择 '+ids.length+' 个预制版本：'+ids.map(i=>{const c=presetCopyCases()[i];return '版本 '+(c?c.version:i+1);}).join('、')+'。可单选，也可多选。';
}
function copyCaseChipsHtml(){
  const list=presetCopyCases(),chosen=new Set(selectedCopyCaseIndices());
  return list.map((c,i)=>`<button type="button" class="copy-case-chip ${chosen.has(i)?'on':''} ${COPY_CASE_ACTIVE===i?'active':''}" data-copy-case-toggle="${i}" aria-pressed="${chosen.has(i)?'true':'false'}"><span>版本 ${c.version} · ${esc(c.style)}</span>${COPY_CASE_ACTIVE===i?'<span class="tag">当前预览</span>':''}</button>`).join('');
}
function copyPreviewVersionChipsHtml(){
  return selectedCopyCaseIndices().map(i=>{const c=presetCopyCases()[i];return `<button type="button" class="copy-preview-versionchip ${COPY_CASE_ACTIVE===i?'on':''}" data-copy-preview-case="${i}">版本 ${c.version} · ${esc(c.style)}</button>`;}).join('');
}
function mappedForCopyCase(idx,mapping){const bundle=buildPresetCopyBundle(idx);return applyCopyMapping(bundle,mapping||presetMappingPaths());}
function activeCopyCaseMapped(){return mappedForCopyCase(COPY_CASE_ACTIVE,presetMappingPaths());}
function copyCaseOptionsHtml(){const list=presetCopyCases();return list.map((c,i)=>`<option value="${i}" ${i===COPY_CASE_ACTIVE?'selected':''}>版本 ${c.version} · ${esc(c.style)}</option>`).join('');}
function ensurePresetCopyResponse(force=false,idx=0){
  let valid=false;
  if(!force&&COPY_API_CHANNEL.lastResponse){try{const x=JSON.parse(COPY_API_CHANNEL.lastResponse);valid=!!x&&!x.error;}catch(e){}}
  if(valid)return;
  const bundle=buildPresetCopyBundle(idx);
  COPY_API_CHANNEL.lastResponse=JSON.stringify(bundle,null,2);
  COPY_API_CHANNEL.fieldMapping=Object.assign({},presetMappingPaths());
  COPY_API_CHANNEL.mappingName='V13 预制文案案例映射';
  COPY_API_CHANNEL.lastMapped=applyCopyMapping(bundle,COPY_API_CHANNEL.fieldMapping);
  COPY_API_CHANNEL.updatedAt=new Date().toLocaleString();
  saveCopyApiChannel();
}
function mappingRowsHtml(bundle,mapping){const entries=mapperPathEntries(bundle);return COPY_MAPPING_FIELDS.map(([field,label])=>`<div class="mapping-row"><label>${label}</label><select data-map-field="${field}">${mapperOptions(entries,mapping[field]||'')}</select><div class="preview" data-map-preview="${field}">${esc(shortPreview(mappingSourceValue(bundle,mapping[field]||'')))}</div></div>`).join('');}
function publicMappedPreview(mapped){
  const subs=Array.isArray(mapped&&mapped.subtitles)?mapped.subtitles:[];
  return {mainTitle:mappedValueText(mapped&&mapped.mainTitle),coreSellingPoint:mappedValueText(mapped&&mapped.coreSellingPoint),functionArea:mappedValueText(mapped&&mapped.functionArea),subtitles:[mappedValueText(subs[0]),mappedValueText(subs[1]),mappedValueText(subs[2])].filter(Boolean)};
}
function simpleMappedFieldsHtml(mapped){
  const subs=Array.isArray(mapped&&mapped.subtitles)?mapped.subtitles:[];
  const rows=[['主标题',mapped&&mapped.mainTitle],['核心卖点',mapped&&mapped.coreSellingPoint],['功能区',mapped&&mapped.functionArea],['小标题1',subs[0]],['小标题2',subs[1]],['小标题3',subs[2]]];
  return rows.map(x=>`<div class="copy-field-item"><b>${x[0]}</b><span>${esc(mappedValueText(x[1],'未填写'))}</span></div>`).join('');
}
function simpleMappedJsonText(mapped){return JSON.stringify(publicMappedPreview(mapped),null,2);}
function preparePresetCopyCase(idx){
  const bundle=buildPresetCopyBundle(idx),mapping=Object.assign({},presetMappingPaths());
  COPY_API_CHANNEL.lastResponse=JSON.stringify(bundle,null,2);
  COPY_API_CHANNEL.fieldMapping=mapping;
  COPY_API_CHANNEL.mappingName='V13 预制文案自动映射';
  COPY_API_CHANNEL.lastMapped=applyCopyMapping(bundle,mapping);
  COPY_API_CHANNEL.updatedAt=new Date().toLocaleString();
  saveCopyApiChannel();
  return {bundle,mapping,mapped:COPY_API_CHANNEL.lastMapped};
}
function currentCopyWorkspaceMapped(){
  try{if($('copy-mapper-raw'))return applyCopyMapping(readMapperBundle(),readMapperSelections());}catch(_e){}
  try{return applyCopyMapping(copyResponseBundle(),Object.assign({},COPY_API_DEFAULT.fieldMapping,COPY_API_CHANNEL.fieldMapping||{}));}catch(_e){}
  return COPY_API_CHANNEL.lastMapped||{mainTitle:'',coreSellingPoint:'',functionArea:'',subtitles:[]};
}
function setCopyPreviewMode(mode){
  COPY_PREVIEW_MODE=mode==='json'?'json':'copy';
  document.querySelectorAll('[data-copy-preview-mode]').forEach(b=>b.classList.toggle('on',b.dataset.copyPreviewMode===COPY_PREVIEW_MODE));
  const cp=$('copy-preview-copy'),jp=$('copy-preview-json');if(cp)cp.hidden=COPY_PREVIEW_MODE!=='copy';if(jp)jp.hidden=COPY_PREVIEW_MODE!=='json';
}
function renderCopyPreviewUi(){
  normalizeCopyCaseState(false);
  const ids=selectedCopyCaseIndices(),mapping=presetMappingPaths();
  const versionBox=$('copy-preview-version-chips');if(versionBox)versionBox.innerHTML=copyPreviewVersionChipsHtml();
  document.querySelectorAll('[data-copy-case-view]').forEach(b=>b.classList.toggle('on',b.dataset.copyCaseView===COPY_CASE_VIEW));
  const copyPane=$('copy-preview-copy'),jsonValue=$('copy-preview-json-value');
  if(COPY_CASE_VIEW==='multi'){
    if(copyPane)copyPane.innerHTML=`<div class="copy-preview-compare">${ids.map(i=>{const c=presetCopyCases()[i],m=mappedForCopyCase(i,mapping);return `<div class="copy-preview-compare-card"><h5>版本 ${c.version}<span>${esc(c.style)}</span></h5><div class="copy-field-preview">${simpleMappedFieldsHtml(m)}</div></div>`;}).join('')}</div>`;
    if(jsonValue){jsonValue.classList.add('copy-json-multi');jsonValue.textContent=JSON.stringify(ids.map(i=>{const c=presetCopyCases()[i];return {version:c.version,style:c.style,copy:publicMappedPreview(mappedForCopyCase(i,mapping))};}),null,2);}
  }else{
    const m=mappedForCopyCase(COPY_CASE_ACTIVE,mapping);
    if(copyPane)copyPane.innerHTML=`<div class="copy-field-preview">${simpleMappedFieldsHtml(m)}</div>`;
    if(jsonValue){jsonValue.classList.remove('copy-json-multi');jsonValue.textContent=simpleMappedJsonText(m);}
  }
}
function updateCopyWorkspaceUi(mapped){
  normalizeCopyCaseState(false);
  const selector=$('copy-case-selector');if(selector)selector.innerHTML=copyCaseChipsHtml();
  const helper=$('copy-target-summary');if(helper)helper.textContent=selectedCopyTargetSummary();
  renderCopyPreviewUi();
  const linked=COPY_API_CHANNEL.promptLinkEnabled!==false;
  document.querySelectorAll('[data-copy-link-state-text]').forEach(el=>el.textContent=linked?'已开启':'已关闭');
  document.querySelectorAll('[data-copy-prompt-link-toggle]').forEach(el=>{el.classList.toggle('on',linked);el.classList.toggle('off',!linked);el.setAttribute('aria-pressed',linked?'true':'false');el.innerHTML=`<span aria-hidden="true"></span>${linked?'已开启':'已关闭'}`;});
  document.querySelectorAll('[data-copy-simple-status]').forEach(el=>{el.textContent=linked?'AI 线框已联通':'AI 线框未联通';el.classList.toggle('linked',linked);el.classList.toggle('unlinked',!linked);});
  const step=$('copy-link-step');if(step)step.classList.toggle('done',linked);
  setCopyPreviewMode(COPY_PREVIEW_MODE);
}

function copyBatchEditorHtml(){
  const ids=selectedCopyCaseIndices();
  return `<div class="copy-batch-editor"><div class="batch-head"><div><h5>多版本批量编辑</h5><p>当前选中 ${ids.length} 个版本。可批量替换功能区或小标题，也可向指定字段末尾统一追加内容。</p></div><span class="wf-status-chip ${ids.length>1?'ok':'wait'}">${ids.length>1?'可批量编辑':'至少选择 2 个版本'}</span></div><div class="copy-batch-grid"><div><label>编辑字段</label><select id="copy-batch-field"><option value="functionArea">功能区</option><option value="subtitle1">小标题1</option><option value="subtitle2">小标题2</option><option value="subtitle3">小标题3</option><option value="allSubtitles">全部小标题</option><option value="allVisible">全部可见文案字段</option></select></div><div><label>编辑方式</label><select id="copy-batch-op"><option value="replace">替换内容</option><option value="append">末尾追加</option></select></div><div class="batch-value"><label>批量内容</label><input id="copy-batch-value" placeholder="输入需要替换或统一追加的内容"></div><div class="batch-action"><button class="btn btn-violet" data-copy-batch-apply ${ids.length>1?'':'disabled'}>应用到 ${ids.length} 个版本</button></div></div><div class="copy-batch-result" id="copy-batch-result">修改后会自动同步到固定绑定的 AI 线框任务组和 AI 生图文案任务。</div></div>`;
}
function appendBatchText(oldText,value){const a=String(oldText||'').trim(),b=String(value||'').trim();if(!b)return a;if(!a)return b;return a.endsWith(b)?a:(a+' · '+b);}
function applyCopyBatchEdit(){
  const ids=selectedCopyCaseIndices();if(ids.length<2)throw new Error('请至少选择两个文案版本');
  const field=$('copy-batch-field')&&$('copy-batch-field').value,op=$('copy-batch-op')&&$('copy-batch-op').value,value=($('copy-batch-value')&&$('copy-batch-value').value.trim())||'';
  if(!value)throw new Error('请输入批量编辑内容');
  const edit=(old)=>op==='append'?appendBatchText(old,value):value;
  ids.forEach(idx=>{const c=copies[idx];if(!c)return;const b=normalizeCopyBlock(c.block);
    if(field==='functionArea')b.functionArea=edit(b.functionArea);
    else if(/^subtitle[123]$/.test(field)){const si=Number(field.slice(-1))-1;b.subtitles[si]=edit(b.subtitles[si]);if(!b.selectedSubtitles.includes(si))b.selectedSubtitles.push(si);}
    else if(field==='allSubtitles'){b.subtitles=b.subtitles.map(edit);b.selectedSubtitles=[0,1,2];}
    else if(field==='allVisible'){b.mainTitle=edit(b.mainTitle);b.coreSellingPoint=edit(b.coreSellingPoint);b.functionArea=edit(b.functionArea);b.subtitles=b.subtitles.map(edit);b.selectedSubtitles=[0,1,2];}
    c.block=b;
  });
  syncMappedCopiesToDownstream(ids);if(curView==='copy')renderCopyOut();updateCopyWorkspaceUi();
  const result=$('copy-batch-result');if(result)result.textContent=`已${op==='append'?'追加':'替换'} ${ids.length} 个版本，并同步固定绑定任务组。`;
  return ids;
}
function openCopyJsonMappingWorkspace(){
  normalizeCopyCaseState(true);
  const caseIndex=COPY_CASE_ACTIVE;
  ensurePresetCopyResponse(!copyApiReady(),caseIndex);
  const bundle=copyResponseBundle(),mapping=Object.assign({},COPY_API_DEFAULT.fieldMapping,COPY_API_CHANNEL.fieldMapping||{}),mapped=applyCopyMapping(bundle,mapping);
  const linked=COPY_API_CHANNEL.promptLinkEnabled!==false;
  modalOpen(`<h3>文案生成 · 文案字段联通</h3>
  <p class="hint">V13 简易模式：预制版本支持单选或多选；每个版本独立映射、独立预览，并同步到对应的文案版本与 AI 线框任务。当前不会调用外部 AI，也不会生成图片。</p>
  <div class="copy-simple-shell">
    <div class="copy-simple-hero"><div><h4>新手简易模式</h4><p>日常使用只保留核心步骤；高级接口路径、原始 JSON 和字段规则仍放在下方高级设置中。</p></div><span class="copy-simple-status ${linked?'linked':'unlinked'}" data-copy-simple-status>${linked?'AI 线框已联通':'AI 线框未联通'}</span></div>
    <div class="copy-simple-steps"><div class="copy-simple-step done"><b>1. 选择案例</b><span>使用当前 8 个预制文案版本模拟 AI 返回。</span></div><div class="copy-simple-step done"><b>2. 自动对应字段</b><span>自动对应主标题、卖点、功能区和 3 条小标题。</span></div><div class="copy-simple-step ${linked?'done':''}" id="copy-link-step"><b>3. 同步下游</b><span>更新已选文案，并把结构化字段送到 AI 线框提示词。</span></div></div>
    <div class="copy-simple-action"><div style="min-width:0;flex:1"><label>选择预制文案版本（单选 / 多选）</label><div class="copy-case-selector" id="copy-case-selector">${copyCaseChipsHtml()}</div><div class="helper" id="copy-target-summary">${esc(selectedCopyTargetSummary())}</div></div><div class="row" style="gap:7px;flex-wrap:wrap"><button class="btn btn-blue" data-copy-simple-run>一键载入并应用</button></div></div>
    <div class="copy-simple-grid">
      <div class="copy-simple-card"><div class="copy-preview-head"><div><h4>映射后的文案预览</h4><p>支持单个版本查看或多版本并排对比；消费者洞察继续保留在内部策略数据中，不在此处显示。</p></div><div class="copy-preview-tabs" role="group" aria-label="预览模式"><button type="button" class="${COPY_PREVIEW_MODE==='copy'?'on':''}" data-copy-preview-mode="copy">文案</button><button type="button" class="${COPY_PREVIEW_MODE==='json'?'on':''}" data-copy-preview-mode="json">JSON</button></div></div><div class="copy-preview-versionbar"><div style="min-width:0;flex:1"><b style="font-size:12px">查看版本</b><div class="copy-preview-versionchips" id="copy-preview-version-chips">${copyPreviewVersionChipsHtml()}</div></div><div class="copy-view-mode" role="group" aria-label="版本查看方式"><button type="button" class="${COPY_CASE_VIEW==='single'?'on':''}" data-copy-case-view="single">单个查看</button><button type="button" class="${COPY_CASE_VIEW==='multi'?'on':''}" data-copy-case-view="multi">多版本对比</button></div></div><div class="copy-preview-pane" id="copy-preview-copy" ${COPY_PREVIEW_MODE==='copy'?'':'hidden'}><div class="copy-field-preview">${simpleMappedFieldsHtml(mapped)}</div></div><div class="copy-preview-pane copy-json-preview" id="copy-preview-json" ${COPY_PREVIEW_MODE==='json'?'':'hidden'}><pre id="copy-preview-json-value">${esc(simpleMappedJsonText(mapped))}</pre></div><div class="row" style="margin-top:11px;gap:7px;flex-wrap:wrap"><button class="btn btn-violet" data-copy-mapper-apply-selected>应用到已选版本</button><button class="btn btn-ghost" data-copy-mapper-copy>复制预览 JSON</button></div></div>
      <div class="copy-simple-card copy-simple-link"><h4>AI 线框生成联通</h4><p>状态按钮可直接切换联通开关。开启后，生成线框时自动附加结构化文案 JSON、字段顺序和禁止错位规则。</p><div class="link-state"><div class="link-state-control"><b>联通状态</b><button type="button" class="link-status-btn ${linked?'on':'off'}" data-copy-prompt-link-toggle aria-pressed="${linked?'true':'false'}"><span aria-hidden="true"></span>${linked?'已开启':'已关闭'}</button></div><p>当前方案：${esc(COPY_API_CHANNEL.mappingName||'预制文案自动映射')}</p></div><button class="btn btn-ghost" data-copy-link-test>联通测试</button><div class="link-test-result" id="copy-link-test-result">用于检查字段映射、结构化 JSON 与线框提示词是否已正确连通。</div><button class="btn btn-ghost" data-copy-open-wire-prompt>查看 AI 线框内置提示词</button></div>
    </div>
    ${copyBatchEditorHtml()}
    <details class="copy-advanced"><summary>高级设置：接口、字段路径和内置 JSON 提示词</summary><div class="copy-advanced-body">
      ${copyProfileQuickbar()}
      <div class="copy-advanced-grid">
        <div class="copy-advanced-pane"><h5>内置 JSON 提示词</h5><p class="hint">以后接入真实 AI 时，系统会要求模型严格返回统一结构。当前可提前修改并保存。</p><textarea class="copy-json-prompt" id="copy-json-prompt" spellcheck="false">${esc(COPY_API_CHANNEL.jsonPrompt||COPY_JSON_PROMPT_DEFAULT)}</textarea><div class="row" style="margin-top:8px;gap:7px;flex-wrap:wrap"><button class="btn btn-violet" data-copy-json-save>保存高级设置</button><button class="btn btn-ghost" data-copy-json-reset>恢复默认</button></div></div>
        <div class="copy-advanced-pane"><h5>接口与请求模板</h5><div class="copy-interface-mini"><div><label>请求方法</label><select id="copy-json-method"><option ${COPY_API_CHANNEL.method==='POST'?'selected':''}>POST</option><option ${COPY_API_CHANNEL.method==='PUT'?'selected':''}>PUT</option><option ${COPY_API_CHANNEL.method==='PATCH'?'selected':''}>PATCH</option></select></div><div><label>接口路径</label><input id="copy-json-endpoint" value="${esc(COPY_API_CHANNEL.endpoint)}"></div><div class="wide"><label>响应提取路径</label><input id="copy-json-response-path" value="${esc(COPY_API_CHANNEL.responsePath)}"><div class="mapping-path-help">兼容 choices.0.message.content、content[0].text、data.result、response.output.text</div></div><div class="wide"><label>请求 JSON 模板</label><textarea id="copy-json-template" spellcheck="false">${esc(COPY_API_CHANNEL.requestTemplate)}</textarea></div></div><div class="row" style="gap:7px;flex-wrap:wrap"><button class="btn btn-ghost" data-copy-json-format>格式化模板</button><button class="btn btn-blue" data-copy-json-test>真实接口测试</button></div></div>
      </div>
      <div class="copy-advanced-grid">
        <div class="copy-advanced-pane"><h5>案例返回 JSON</h5><textarea class="mapper-raw" id="copy-mapper-raw" spellcheck="false">${esc(JSON.stringify(bundle,null,2))}</textarea><div class="row" style="margin-top:8px;gap:7px"><button class="btn btn-ghost" data-copy-mapper-format>格式化返回 JSON</button><button class="btn btn-ghost" data-copy-mapper-auto>自动识别字段</button></div></div>
        <div class="copy-advanced-pane"><h5>字段路径映射</h5><label class="fl">映射方案名称</label><input id="copy-mapping-name" value="${esc(COPY_API_CHANNEL.mappingName||'预制文案自动映射')}"><div class="mapping-list" id="copy-mapping-list" style="margin-top:9px">${mappingRowsHtml(bundle,mapping)}</div><label class="fl" style="margin-top:10px">统一 JSON 结果</label><textarea class="mapping-result" id="copy-mapping-result" readonly>${esc(JSON.stringify(mapped,null,2))}</textarea><div class="row" style="margin-top:8px;gap:7px"><button class="btn btn-ghost" data-copy-mapper-save>保存字段路径</button><button class="btn btn-ghost" data-copy-profile-save-version>保存到配置版本</button></div></div>
      </div>
    </div></details>
  </div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
  setCopyPreviewMode(COPY_PREVIEW_MODE);
}
function testCopyPromptLink(btn){
  const result=$('copy-link-test-result');
  const linked=COPY_API_CHANNEL.promptLinkEnabled!==false;
  const mapping=Object.assign({},COPY_API_CHANNEL.fieldMapping||{});
  const required=['mainTitle','coreSellingPoint','functionArea','subtitle1','subtitle2','subtitle3'];
  const missing=required.filter(k=>!mapping[k]);
  const mapped=currentCopyWorkspaceMapped(),pub=publicMappedPreview(mapped);
  const incomplete=!pub.mainTitle||!pub.coreSellingPoint||!pub.functionArea||pub.subtitles.length<1;
  const promptOk=copyMappingPromptGuide().includes('精准替换规则')&&copyMappingPromptGuide().includes('消费者洞察仅作内部策略参考');
  const targetIds=currentPromptTargetIds(),targetOk=targetIds.length>0;
  const ok=linked&&!missing.length&&!incomplete&&promptOk&&targetOk;
  if(result){result.className='link-test-result '+(ok?'ok':'bad');result.textContent=ok?'联通测试通过：字段映射、精准替换规则和 '+targetIds.length+' 个 AI 线框任务组已正确连接。':(!linked?'联通测试未通过：当前联通状态为关闭。':!targetOk?'联通测试未通过：尚未选择要应用提示词的 AI 线框任务组。':missing.length?'联通测试未通过：缺少字段路径 '+missing.join('、')+'。':'联通测试未通过：映射文案字段不完整。');}
  if(btn){const old=btn.textContent;btn.disabled=true;btn.textContent=ok?'联通正常':'测试未通过';setTimeout(()=>{btn.disabled=false;btn.textContent='联通测试';},1200);}
  setActionStatus(ok?'success':'error',ok?'AI 线框字段联通测试通过':'AI 线框字段联通测试未通过',false);
  return ok;
}
function openCopyFieldMapper(){openCopyJsonMappingWorkspace();}
function openCopyJsonInterface(){openCopyJsonMappingWorkspace();}
function loadPresetCopyCaseIntoWorkspace(){
  normalizeCopyCaseState(false);
  try{if($('copy-json-template'))saveCopyJsonModal();}catch(e){}
  preparePresetCopyCase(COPY_CASE_ACTIVE);updateCopyWorkspaceUi();setActionStatus('success','已载入当前预览版本的预制案例',false);
}
function mappedValueText(v,fallback=''){if(v===undefined||v===null)return fallback;if(Array.isArray(v))return v.filter(Boolean).join(' · ');if(typeof v==='object')return JSON.stringify(v);return String(v).trim()||fallback;}
function syncMappedCopiesToDownstream(indices){
  COPY_API_CHANNEL.promptLinkEnabled=true;
  const ids=[];
  indices.forEach(idx=>{syncCopyVersionToBoundTasks(idx,{syncJson:true,link:true,origin:'V14 文案字段联通自动下发 JSON'});ids.push(idx);});
  saveCopyApiChannel();
  refreshPromptDiagnosisUi();
  refreshIssueCenterUi();
  return ids;
}
function applyOneMappedCaseToCopy(caseIdx,mapping){
  const c=copies[caseIdx];if(!c)return null;
  const mapped=applyCopyMapping(buildPresetCopyBundle(caseIdx),mapping||presetMappingPaths());
  const old=normalizeCopyBlock(c.block),subs=Array.isArray(mapped.subtitles)?mapped.subtitles.map(x=>mappedValueText(x)).filter(Boolean):[];
  c.block={mainTitle:mappedValueText(mapped.mainTitle,old.mainTitle),coreSellingPoint:mappedValueText(mapped.coreSellingPoint,old.coreSellingPoint),functionArea:mappedValueText(mapped.functionArea,old.functionArea),subtitles:ensureThreeSubtitles(subs,old.subtitles),selectedSubtitles:subs.length?subs.slice(0,3).map((_,i)=>i):old.selectedSubtitles,insight:mappedValueText(mapped.consumerInsight,old.insight)};
  return mapped;
}
function applySelectedPresetCases(mapping){
  const targets=selectedCopyCaseIndices();if(!copies.length)throw new Error('请先在文案生成页面生成 8 个预制版本');
  const done=[];targets.forEach(idx=>{if(copies[idx]){applyOneMappedCaseToCopy(idx,mapping||presetMappingPaths());done.push(idx);}});
  if(!done.length)throw new Error('请选择至少一个有效版本');
  COPY_API_CHANNEL.fieldMapping=Object.assign({},mapping||presetMappingPaths());COPY_API_CHANNEL.mappingName=($('copy-mapping-name')&&$('copy-mapping-name').value.trim())||'V13 多版本预制文案映射';COPY_API_CHANNEL.lastMapped=mappedForCopyCase(COPY_CASE_ACTIVE,COPY_API_CHANNEL.fieldMapping);COPY_API_CHANNEL.lastAppliedAt=new Date().toLocaleString();COPY_API_CHANNEL.lastAppliedVersions=done.map(i=>copies[i].version);saveCopyApiChannel();syncMappedCopiesToDownstream(done);if(curView==='copy')renderCopyOut();return done;
}
function applyMappedBundleToTargets(bundle,mapping,caseIdx){
  // 保留高级接口兼容：单个自定义返回仍可应用至当前选择；简易模式使用多版本逐一映射。
  const mapped=applyCopyMapping(bundle,mapping);let targets=selectedCopyCaseIndices();if(!targets.length&&copies[caseIdx])targets=[caseIdx];
  targets.forEach(idx=>{const c=copies[idx];if(!c)return;const old=normalizeCopyBlock(c.block),subs=Array.isArray(mapped.subtitles)?mapped.subtitles.map(x=>mappedValueText(x)).filter(Boolean):[];c.block={mainTitle:mappedValueText(mapped.mainTitle,old.mainTitle),coreSellingPoint:mappedValueText(mapped.coreSellingPoint,old.coreSellingPoint),functionArea:mappedValueText(mapped.functionArea,old.functionArea),subtitles:ensureThreeSubtitles(subs,old.subtitles),selectedSubtitles:subs.length?subs.slice(0,3).map((_,i)=>i):old.selectedSubtitles,insight:mappedValueText(mapped.consumerInsight,old.insight)};});
  COPY_API_CHANNEL.fieldMapping=Object.assign({},mapping);COPY_API_CHANNEL.lastMapped=mapped;saveCopyApiChannel();syncMappedCopiesToDownstream(targets);if(curView==='copy')renderCopyOut();return targets;
}
function applyMappedResultToSelectedCopies(){
  let mapping=presetMappingPaths();try{if($('copy-mapper-raw'))mapping=readMapperSelections();}catch(_e){}
  return applySelectedPresetCases(mapping);
}
function runSimpleCopyLink(){
  normalizeCopyCaseState(false);preparePresetCopyCase(COPY_CASE_ACTIVE);COPY_API_CHANNEL.promptLinkEnabled=true;saveCopyApiChannel();return applySelectedPresetCases(presetMappingPaths());
}
const WF_PRECISE_REPLACEMENT_RULES=[
  '将「海报文案」中的主标题，替换到「排版参考图」原“某某某某”或者“主标题”的位置。',
  '将「海报文案」中的核心卖点/副标题，替换到「排版参考图」原“核心卖点”或者“副标题”位置。',
  '将「海报文案」中的小标题1/小标题2/小标题3，按顺序替换到「排版参考图」原小标题、标签、徽章短句或相应功能区文字位置。',
  '将「海报文案」中的功能区，替换到「排版参考图」原“功能区”的位置。',
  '如有徽章内容、按钮文字、标签文字，只替换对应区域内的文字，不改变该区域的形状、大小、颜色和位置。',
  '文案需保持原排版参考图的字体风格、字号比例、粗细、颜色和层级关系；根据原文字框范围自然换行，保证文字完整可读。'
];
function copyMappingPromptGuide(){
  const m=COPY_API_CHANNEL.fieldMapping||{},name=COPY_API_CHANNEL.mappingName||'默认字段映射';
  return `【V13 文案字段联通与精准替换规则】
映射方案：${name}
${WF_PRECISE_REPLACEMENT_RULES.map((x,i)=>(i+1)+'. '+x).join('\n')}
字段来源路径：主标题=${m.mainTitle||'系统文案'}；核心卖点=${m.coreSellingPoint||'系统文案'}；功能区=${m.functionArea||'系统文案'}；小标题=${[m.subtitle1,m.subtitle2,m.subtitle3].filter(Boolean).join(' / ')||'系统文案'}。
消费者洞察仅作内部策略参考，不得写入画面；禁止把不同字段错放到其他区域。`;
}
function structuredPosterJson(poster){const b=parsePosterText(poster||'');const subs=selectedSubtitleTexts(b);return {mainTitle:b.mainTitle,coreSellingPoint:b.coreSellingPoint,functionArea:b.functionArea,subtitle1:subs[0]||'',subtitle2:subs[1]||'',subtitle3:subs[2]||''};}

function readMapperBundle(){const el=$('copy-mapper-raw');if(!el)return copyResponseBundle();const obj=JSON.parse(el.value);return {raw:Object.prototype.hasOwnProperty.call(obj,'raw')?obj.raw:obj,extracted:Object.prototype.hasOwnProperty.call(obj,'extracted')?parseMaybeJson(obj.extracted):parseMaybeJson(getByPath(obj,COPY_API_CHANNEL.responsePath))};}
function readMapperSelections(){const m={};document.querySelectorAll('[data-map-field]').forEach(el=>m[el.dataset.mapField]=el.value||'');return Object.assign({},COPY_API_DEFAULT.fieldMapping,m);}
function refreshMapperPreview(){try{const bundle=readMapperBundle(),mapping=readMapperSelections();COPY_MAPPING_FIELDS.forEach(([f])=>{const p=document.querySelector(`[data-map-preview="${f}"]`);if(p)p.textContent=shortPreview(mappingSourceValue(bundle,mapping[f]));});const r=$('copy-mapping-result');if(r)r.value=JSON.stringify(applyCopyMapping(bundle,mapping),null,2);}catch(e){setActionStatus('error','映射预览失败：'+e.message,false);}}
function saveCopyFieldMapping(){const bundle=readMapperBundle(),mapping=readMapperSelections();COPY_API_CHANNEL.fieldMapping=mapping;COPY_API_CHANNEL.mappingName=($('copy-mapping-name')&&$('copy-mapping-name').value.trim())||'字段映射';COPY_API_CHANNEL.lastMapped=applyCopyMapping(bundle,mapping);COPY_API_CHANNEL.updatedAt=new Date().toLocaleString();saveCopyApiChannel();return COPY_API_CHANNEL.lastMapped;}

function copyApiReady(){return !!(typeof API_BRIDGE!=='undefined'&&API_BRIDGE.baseUrl&&API_BRIDGE.apiKey);}
function copyApiStatusHtml(){const ready=copyApiReady(),model=(typeof API_BRIDGE!=='undefined'&&API_BRIDGE.copyModel)||'';return `<div class="copy-api-status"><span class="signal ${ready?'ready':''}"></span><div><b>${ready?'AI 通道配置已就绪':'AI 通道尚未完整配置'}</b><p>当前配置：${esc(activeProfileSummary())}。文案生成仍使用本地预制规则；已预留 API、JSON 请求、字段映射与后台日志通道。${model?' 当前文案模型：'+esc(model):''}</p></div></div>`;}
function deepReplaceCopyVars(v,vars){if(typeof v==='string')return v.replace(/\{\{(model|product_info|json_prompt)\}\}/g,(_,k)=>vars[k]||'');if(Array.isArray(v))return v.map(x=>deepReplaceCopyVars(x,vars));if(v&&typeof v==='object'){const o={};Object.keys(v).forEach(k=>o[k]=deepReplaceCopyVars(v[k],vars));return o;}return v;}
function normalizeDataPath(path){return String(path||'').trim().replace(/\[(?:\"([^\"]+)\"|'([^']+)'|(\d+))\]/g,(_,a,b,c)=>'.'+(a||b||c)).replace(/^\./,'');}
function getByPath(obj,path){if(!path)return obj;return normalizeDataPath(path).split('.').filter(Boolean).reduce((cur,key)=>cur==null?undefined:cur[/^\d+$/.test(key)?+key:key],obj);}
function normalizeCopyEndpoint(ep){ep=String(ep||'').trim();if(!ep)ep='/chat/completions';if(!ep.startsWith('/'))ep='/'+ep;return ep;}
function openCopyApiConfig(){modalOpen(apiConfigForm('copy'));}
function readCopyJsonModal(){const template=$('copy-json-template')&&$('copy-json-template').value.trim();if(!template)throw new Error('请求 JSON 模板不能为空');JSON.parse(template);const jsonPrompt=($('copy-json-prompt')&&$('copy-json-prompt').value.trim())||COPY_JSON_PROMPT_DEFAULT;return {method:($('copy-json-method')&&$('copy-json-method').value)||'POST',endpoint:normalizeCopyEndpoint($('copy-json-endpoint')&&$('copy-json-endpoint').value),responsePath:($('copy-json-response-path')&&$('copy-json-response-path').value.trim())||'',requestTemplate:template,jsonPrompt};}
function saveCopyJsonModal(){Object.assign(COPY_API_CHANNEL,readCopyJsonModal(),{updatedAt:new Date().toLocaleString()});saveCopyApiChannel();}
function formatCopyJsonModal(){const el=$('copy-json-template');const obj=JSON.parse(el.value);el.value=JSON.stringify(obj,null,2);setActionStatus('success','JSON 模板格式正确',false);}
async function testCopyJsonChannel(btn){if(!actionLock('copy-json-test',btn))return;setActionStatus('loading','正在测试文案 JSON 接口…',true);try{saveCopyJsonModal();if(!copyApiReady())throw new Error('请先完成 AI 接入配置');const model=API_BRIDGE.copyModel||(API_BRIDGE.textModels&&API_BRIDGE.textModels[0])||API_BRIDGE.wireModel;if(!model)throw new Error('尚未选择文案模型，请先载入模型列表并选择文本模型');const tpl=JSON.parse(COPY_API_CHANNEL.requestTemplate);const product=($('cp-in')&&$('cp-in').value.trim())||(copies._in||'测试产品：宠物营养保健品');const payload=deepReplaceCopyVars(tpl,{model,product_info:product,json_prompt:COPY_API_CHANNEL.jsonPrompt||COPY_JSON_PROMPT_DEFAULT});const data=await apiFetchJSON('/api'+COPY_API_CHANNEL.endpoint,{method:COPY_API_CHANNEL.method,body:JSON.stringify(payload)},{model});const extracted=getByPath(data,COPY_API_CHANNEL.responsePath);COPY_API_CHANNEL.lastResponse=JSON.stringify({raw:data,extracted:extracted===undefined?null:extracted},null,2);try{const bundle={raw:data,extracted:parseMaybeJson(extracted)};COPY_API_CHANNEL.lastMapped=applyCopyMapping(bundle,COPY_API_CHANNEL.fieldMapping||{});}catch(_e){}COPY_API_CHANNEL.updatedAt=new Date().toLocaleString();saveCopyApiChannel();const ta=$('copy-json-response');if(ta)ta.value=COPY_API_CHANNEL.lastResponse;if($('copy-mapper-raw')){$('copy-mapper-raw').value=COPY_API_CHANNEL.lastResponse;refreshMapperPreview();updateCopyWorkspaceUi(COPY_API_CHANNEL.lastMapped);}actionDone('copy-json-test','文案 JSON 接口测试成功');}catch(err){COPY_API_CHANNEL.lastResponse=JSON.stringify({error:err.message,time:new Date().toLocaleString()},null,2);saveCopyApiChannel();const ta=$('copy-json-response');if(ta)ta.value=COPY_API_CHANNEL.lastResponse;actionFail('copy-json-test','接口测试失败：'+err.message);}}
async function testCopyConnection(btn){if(!actionLock('copy-connect-test',btn))return;setActionStatus('loading','正在测试文案 AI 通道…',true);try{const steps=await runApiDiagnose(false);const failed=steps.find(s=>!s.ok);if(failed)throw new Error(failed.msg||failed.name);const model=API_BRIDGE.copyModel||(API_BRIDGE.textModels&&API_BRIDGE.textModels[0]);if(!model)throw new Error('连接正常，但尚未选择文案文本模型');actionDone('copy-connect-test','文案 AI 通道连接正常');openDiagModal(steps);}catch(err){actionFail('copy-connect-test','文案通道测试失败：'+err.message);}}
async function fetchBackendLogs(){const r=await fetch('/api/logs');if(!r.ok)throw new Error('后台日志读取失败：HTTP '+r.status);return r.json();}
function backendLogHtml(logs){if(!logs||!logs.length)return '<div class="copy-log-empty">暂无后台日志。测试连接或调用接口后，日志会显示在这里。</div>';const pv=activeProfileSummary(),mp=COPY_API_CHANNEL.mappingName||'未命名映射';return `<div class="notebox" style="margin-bottom:10px">当前配置版本：<b>${esc(pv)}</b>　｜　文案模型：<b>${esc(API_BRIDGE.copyModel||'未选择')}</b>　｜　字段映射：<b>${esc(mp)}</b></div><div class="copy-log-list">${logs.map(x=>`<div class="copy-log-item ${Number(x.status)>=400||(x.fieldAudit&&x.fieldAudit.ok===false)?'err':''}"><div><b>${esc(x.time||'')} · ${esc(x.method||'')} ${esc(x.path||'')} · HTTP ${esc(String(x.status==null?'-':x.status))}</b><p>${esc(x.message||x.channel||'')}</p></div><span class="code">${esc(String(x.durationMs==null?'-':x.durationMs))} ms</span></div>`).join('')}</div>`;}
function copyFieldAuditSummary(logs){const audits=(logs||[]).filter(x=>x&&x.fieldAudit).map(x=>({log:x,audit:x.fieldAudit}));const ok=audits.filter(x=>x.audit&&x.audit.ok).length,bad=audits.length-ok;return {audits,ok,bad,total:audits.length,latest:audits[0]||null};}
function copyFieldAuditVersionRows(audit){const rows=(audit&&audit.versionAudits)||[];if(!rows.length)return '<div class="copy-log-empty">没有可展开的版本字段记录。</div>';return `<div class="field-monitor-version-list">${rows.map(v=>{const issues=[];if(v.missing&&v.missing.length)issues.push('缺失：'+v.missing.join('、'));if(v.empty&&v.empty.length)issues.push('空值：'+v.empty.join('、'));if(v.subtitleIssue)issues.push(v.subtitleIssue);if(v.aliases&&v.aliases.length)issues.push('别名：'+v.aliases.map(a=>a.actual+'→'+a.expected).join('、'));return `<div class="field-monitor-version ${v.ok?'ok':'bad'}"><b>版本 ${esc(String(v.version||v.index||'-'))}</b><span>${v.ok?'字段完整':esc(issues.join('；')||'结构异常')}</span><small>实际字段：${esc((v.actualFields||[]).join(' · ')||'-')}</small></div>`;}).join('')}</div>`;}
function backendFieldMonitorHtml(logs){const s=copyFieldAuditSummary(logs);if(!s.total)return `<div class="field-monitor-head idle"><b>返还字段监控已开启</b><span>尚无结构化文案生成记录</span></div><div class="copy-log-empty">点击“生成 8 个版本”后，系统会自动检查 AI 原始返回是否缺字段、空字段、版本数量异常或小标题数量异常。</div>`;const latest=s.latest,la=latest.audit||{};return `<div class="field-monitor-head ${la.ok?'ok':'bad'}"><div><b>${la.ok?'✓ 最近一次字段完整':'! 最近一次发现字段异常'}</b><span>${esc(la.summary||'')}</span></div><div class="field-monitor-counts"><em>检测 ${s.total}</em><em>通过 ${s.ok}</em><em>异常 ${s.bad}</em></div></div><div class="field-monitor-contract"><b>当前返回契约</b><span>versions = 8；每版必须包含 version / style / mainTitle / coreSellingPoint / functionArea / subtitles / consumerInsight；subtitles 必须 3 条。</span></div><div class="field-monitor-runs">${s.audits.map(({log,audit},idx)=>`<details class="field-monitor-run ${audit.ok?'ok':'bad'}" ${idx===0?'open':''}><summary><b>${esc(log.time||'')} · ${audit.ok?'字段完整':'字段异常'}</b><span>${esc(audit.summary||'')}</span></summary><div class="field-monitor-meta">实际版本数：<b>${esc(String(audit.versionCount==null?'-':audit.versionCount))}/8</b>　缺失字段：<b>${esc(String(audit.missingFieldCount||0))}</b>　空字段：<b>${esc(String(audit.emptyFieldCount||0))}</b>　小标题异常：<b>${esc(String(audit.subtitleIssueCount||0))}</b>${audit.parseError?`<br>JSON 解析错误：${esc(audit.parseError)}`:''}</div>${copyFieldAuditVersionRows(audit)}</details>`).join('')}</div>`;}
async function openBackendLogs(){modalOpen('<h3>文案生成 · 后台日志</h3><div class="copy-log-empty">正在读取后台日志…</div>',true);try{const d=await fetchBackendLogs();modalOpen(`<h3>文案生成 · 后台日志</h3><p class="hint">来自本地 Node/Python 服务的请求记录，不保存 API 密钥。用于排查代理、接口路径、HTTP 状态和耗时。</p>${backendLogHtml(d.logs||[])}<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn btn-violet" data-copy-log-refresh>刷新</button><button class="btn btn-emerald" data-copy-field-monitor>返还字段监控</button><button class="btn btn-ghost" data-copy-log-clear>清空后台日志</button><button class="btn btn-ghost" data-copy-log-copy>复制日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}catch(err){modalOpen(`<h3>文案生成 · 后台日志</h3><div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c">${esc(err.message)}。请通过 start.bat 启动本地服务后再查看。</div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}}
async function openBackendFieldMonitor(){modalOpen('<h3>文案生成 · 返还字段监控</h3><div class="copy-log-empty">正在检查最近的 AI 返回字段…</div>',true);try{const d=await fetchBackendLogs();modalOpen(`<h3>文案生成 · 返还字段监控</h3><p class="hint">这是测试监测工具：直接审计 AI 原始结构化返回。HTTP 200 不等于字段完整；缺字段、空字段、版本数不足和 subtitles 数量异常都会单独记录。</p>${backendFieldMonitorHtml(d.logs||[])}<div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap"><button class="btn btn-violet" data-copy-field-monitor>重新检测</button><button class="btn btn-ghost" data-copy-log-refresh>返回请求日志</button><button class="btn btn-ghost" data-copy-log-copy>复制完整日志</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}catch(err){modalOpen(`<h3>文案生成 · 返还字段监控</h3><div class="notebox" style="background:#fef2f2;border-color:#fecaca;color:#b91c1c">${esc(err.message)}</div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}}
window.CopyApiBridge={getConfig:()=>({api:{baseUrl:API_BRIDGE.baseUrl,copyModel:API_BRIDGE.copyModel},channel:Object.assign({},COPY_API_CHANNEL),profiles:COPY_PROFILE_STORE}),openConfig:openCopyApiConfig,openJson:openCopyJsonMappingWorkspace,openProfiles:openCopyProfileManager,openMapper:openCopyJsonMappingWorkspace,test:testCopyConnection,request:testCopyJsonChannel,map:(raw)=>applyCopyMapping(raw,COPY_API_CHANNEL.fieldMapping||{})};

function viewCopy(){
  let html=`<h1 class="title">${uiIcon('copy','title-icon')}<span>文案生成</span></h1>
  <div class="copy-api-toolbar">${copyApiStatusHtml()}<div class="copy-api-actions"><button class="tbtn" data-copy-api-config>⚙ 扣子 API 配置</button><button class="tbtn" data-copy-test>◉ 测试扣子接口</button><button class="tbtn" data-copy-json-mapping>⇄ 文案字段联通</button><button class="tbtn" data-copy-logs>▤ 后台日志</button></div></div>
  <div class="panel">
    <label class="fl">输入产品信息</label>
    <textarea id="cp-in" rows="4" placeholder="品牌/产品名：勒堡化毛片&#10;所属品类：宠物保健品&#10;王牌卖点：16小时排毛、7倍排毛&#10;辅助卖点：专研化毛酶、宠院同款、733%排毛、只排不吐、温和化毛">${copies.length?copies._in||'':''}</textarea>
    <div style="margin-top:16px;"><button class="btn btn-blue" id="cp-gen" disabled>生成 8 个版本</button></div>
  </div><div id="cp-out"></div>`;
  return html;
}
function renderCopyOut(){
  const out=$('cp-out');
  if(!copies.length){
    out.innerHTML=`<div class="panel empty">
      <div class="spark">${uiIcon('studio','empty-icon')}</div><h2>开始生成文案</h2>
      <p class="hint">输入产品信息，一键生成 8 个不同风格的预制文案版本</p>
      <div class="examples">
        ${[['🐱','勒堡乳铁蛋白，猫用免疫保健品'],['💊','宠物化毛片，5酶+3菌配方'],['🦴','狗用关节宝，氨糖软骨素'],[uiIcon('studio','mini-linear-icon'),'宠物营养补充剂']].map(e=>`<button data-ex="${e[1]}"><span style="margin-right:4px">${e[0]}</span>${e[1]}</button>`).join('')}
      </div>${typeof copySnapshotArchiveHtml==='function'?copySnapshotArchiveHtml():''}</div>`;
    return;
  }
  const bar=`<div class="panel" style="padding:16px;">
    <div class="selbar">
      <div class="chips" style="align-items:center;"><span style="font-size:13px;font-weight:500;color:var(--slate-700)">选择版本：</span>
        <span class="link" id="sel-all">全选</span><span class="link muted" id="sel-clear">清空</span></div>
      <div style="display:flex;align-items:center;gap:12px;">
        <span class="hint">已选 ${selected.size}/${copies.length} 个版本</span>
        <button class="btn btn-emerald" id="go-next" ${selected.size?'':'disabled'}>下一步：AI 线框生成 →</button></div>
    </div>
    <div class="chips">${copies.map((c,idx)=>`<label class="vchip ${selected.has(idx)?'on':''}" data-v="${idx}"><input type="checkbox" ${selected.has(idx)?'checked':''}/><span style="font-weight:500">版本 ${c.version}</span><span style="opacity:.7">(${c.style})</span></label>`).join('')}</div>
  </div>`;
  const cards=`<div class="cards">${copies.map((c,idx)=>{
    const sel=selected.has(idx),b=normalizeCopyBlock(c.block);c.block=b;
    const standardBlocks=[['主标题',b.mainTitle,false],['核心卖点',b.coreSellingPoint,false],['功能区',b.functionArea,false]].map((item,bi)=>{
      const bid=idx+'-'+bi,exp=expanded===bid;
      return `<div class="blk ${exp?'exp':''}" data-blk="${bid}">
        <div class="top"><span class="lab">${item[0]}</span>${exp?`<button class="copy" data-copy="${esc(item[1])}">复制</button>`:''}</div>
        <p class="txt">${esc(item[1])}</p></div>`;
    }).join('');
    const selectedSubtitleList=selectedSubtitleTexts(b);
    const selectedSubtitleSet=new Set(b.selectedSubtitles);
    const subtitleRenderOrder=[...b.selectedSubtitles,...b.subtitles.map((_,i)=>i).filter(i=>!selectedSubtitleSet.has(i))];
    const subtitleBlock=`<div class="blk subtitle-block">
      <div class="top"><span class="lab">小标题 <em>可单选 / 多选 · 可拖拽排序</em></span><button class="copy" data-copy="${esc(selectedSubtitleList.join(' · '))}">复制已选（${selectedSubtitleList.length}）</button></div>
      <div class="subtitle-options">${subtitleRenderOrder.map(si=>{const t=b.subtitles[si],on=selectedSubtitleSet.has(si),order=on?b.selectedSubtitles.indexOf(si)+1:0;return `<button class="subtitle-option ${on?'on':''}" data-subtitle-pick="${idx}|${si}" ${on?'draggable="true" data-subtitle-drag="'+idx+'|'+si+'"':''} aria-pressed="${on?'true':'false'}" title="${on?'拖动已选小标题可调整同步顺序':'点击加入已选小标题'}">${on?`<span class="subtitle-drag-handle" aria-hidden="true">⋮⋮</span><span class="subtitle-order">${order}</span>`:'<span class="pick-icon">＋</span>'}<b>${esc(t)}</b></button>`;}).join('')}</div>
      <p class="subtitle-note">支持选择 1–3 条；至少保留 1 条。拖动已选小标题可调整顺序，顺序将决定同步到“小标题1、小标题2、小标题3”的先后位置。</p>
    </div>`;
    const insightId=idx+'-insight',insightExp=expanded===insightId;
    const insightBlock=`<div class="blk locked ${insightExp?'exp':''}" data-blk="${insightId}">
      <div class="top"><span class="lab">消费者洞察${LOCK}</span></div>
      <p class="txt">${esc(b.insight)}</p>${!insightExp?'<p class="detail">点击查看详情（不可复制）</p>':''}</div>`;
    return `<div class="ccard ${sel?'sel':''}">
      <div class="chead" data-tog="${idx}"><div class="l"><input type="checkbox" ${sel?'checked':''}/><span class="vn">版本 ${c.version}</span></div><span class="tag">${c.style}</span></div>
      <div class="cbody">${standardBlocks}${subtitleBlock}${insightBlock}</div></div>`;
  }).join('')}</div>`;
  out.innerHTML=copySnapshotSwitcherHtml()+bar+cards;
  try{copySnapshotPersistCurrent();}catch(_e){}
}
