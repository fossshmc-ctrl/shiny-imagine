
(function(){
  if(typeof adjustState==='undefined'||!window.__V142Api)return;
  const api=window.__V142Api, IDS=ADJUST_BRUSH_DEFS.map(x=>x.id);
  const DIRS={up:'上方',upRight:'右上方',right:'右侧',downRight:'右下方',down:'下方',downLeft:'左下方',left:'左侧',upLeft:'左上方'};
  const SUBJECT_TYPES={product:'产品',person:'人物',pet:'宠物',secondProduct:'第二产品',prop:'道具',custom:'自定义主体'};
  const REMOVE_IDS=new Set(['v142-red-remove','v142-prop-remove','v142-purple-remove']);
  const STATIC_CLAUSES={
    'v142-red-remove':'删除文字、水印或字符，并根据周围纹理自然补全删除区域',
    'v142-red-clear':'提升文字清晰度、笔画完整度和边缘锐度，修复模糊、重影或轻微变形',
    'v142-product-material':'提升产品清晰度、玻璃或金属材质、边缘和光影细节',
    'v142-person-detail':'提升人物面部、皮肤、头发、手部和轮廓清晰度，修复轻微变形',
    'v142-person-pose':'轻微优化人物姿态与肢体自然度，不改变动作含义',
    'v142-pet-detail':'提升宠物毛发层次、眼睛、鼻口和轮廓清晰度',
    'v142-pet-pose':'轻微优化宠物姿态与四肢自然度，禁止增加肢体',
    'v142-second-material':'统一第二产品与主产品的材质、清晰度、色温、投影和光线方向',
    'v142-second-relation':'优化第二产品与主产品的前后层级、间距和视觉呼应',
    'v142-prop-remove':'删除道具或辅助物件，并根据周围场景自然补全删除区域',
    'v142-prop-material':'提升道具清晰度、材质、边缘与光影细节',
    'v142-custom-detail':'提升自定义主体的清晰度、边缘、材质和光影细节',
    'v142-custom-preserve':'修复自定义主体的轻微变形、锯齿或透视问题，稳定主体造型',
    'v142-blue-color':'将背景颜色调整为与整体画面协调的浅色',
    'v142-blue-gradient':'将背景改为柔和自然的深浅渐变，避免明显色带',
    'v142-blue-clean':'清理背景杂物、污点或多余元素，并自然补全背景',
    'v142-blue-depth':'适度增强背景空间层次和景深，使主体更突出',
    'v142-blue-light':'调整背景亮度与对比度，使光影更协调并突出主体',
    'v142-purple-remove':'删除装饰、图标、光效、线条或边框，并自然补全背景',
    'v142-purple-color':'调整装饰元素颜色，使其与整体画面及产品主色协调'
  };
  const escAttr=s=>esc(String(s==null?'':s)).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const params=id=>api.params(id);
  const scope=id=>api.scopeFor(id);
  function allowedTemplates(id){return api.allTemplates(scope(id));}
  function resolveTemplate(id,tid){return allowedTemplates(id).find(t=>t.id===tid)||api.findTemplate(tid)||null;}
  function ensure143(){
    api.ensureV142();
    adjustState.v143SelectedTemplates=adjustState.v143SelectedTemplates||{};
    IDS.forEach(id=>{
      let list=Array.isArray(adjustState.v143SelectedTemplates[id])?adjustState.v143SelectedTemplates[id].slice():[];
      const currentTemplate=adjustState.brushes[id]?.template||'';
      const valid=new Set(allowedTemplates(id).map(t=>t.id));
      if(!list.length&&currentTemplate&&valid.has(currentTemplate))list=[currentTemplate];
      list=[...new Set(list.filter(tid=>valid.has(tid)))];
      adjustState.v143SelectedTemplates[id]=list;
      if(list.length)adjustState.brushes[id].template=list[list.length-1];
    });
  }
  function selectedIds(id){ensure143();return adjustState.v143SelectedTemplates[id]||[];}
  function selectedTemplates(id){return selectedIds(id).map(tid=>resolveTemplate(id,tid)).filter(Boolean);}
  function noun(id){if(id==='red')return'文字';if(id==='blue')return'背景';if(id==='purple')return'装饰元素';return api.subjectNoun(id);}
  function templateAction(t){if(t&&t.action)return t.action;const id=t?.id||'';if(/-(down)$/.test(id))return'scaleDown';if(/-(up)$/.test(id))return'scaleUp';if(/-move$/.test(id))return'move';if(/-angle$/.test(id))return'angle';if(/-soften$/.test(id))return'soften';return'custom';}
  function displayLabel(id,t){return api.displayLabel(id,t);}
  function operationClause(id,t){
    const p=params(id),n=noun(id),a=templateAction(t);
    if(a==='scaleDown'){const v=Math.max(1,Math.min(80,Number(p.scalePct)||20));return`将${n}整体缩小 ${v}%（调整为原大小的 ${100-v}%）`;}
    if(a==='scaleUp'){const v=Math.max(1,Math.min(80,Number(p.scalePct)||20));return`将${n}整体放大 ${v}%（调整为原大小的 ${100+v}%）`;}
    if(a==='move'){const v=Math.max(1,Math.min(50,Number(p.movePct)||5)),d=DIRS[p.direction]||'右侧';return`将${n}从当前位置向${d}移动约 ${v}%`;}
    if(a==='angle'){const v=Math.max(1,Math.min(45,Number(p.angleDeg)||10));return`轻微调整${n}角度约 ${v}°，保持透视与落地关系自然`;}
    if(a==='soften'){const v=Math.max(5,Math.min(80,Number(p.effectPct)||25));return`将装饰效果弱化约 ${v}%，适度降低透明度、亮度或光效强度`;}
    if(STATIC_CLAUSES[t.id]){
      let c=STATIC_CLAUSES[t.id];
      if(t.id.startsWith('v142-custom-'))c=c.replace('自定义主体',n);
      return c;
    }
    const raw=typeof t.text==='function'?String(t.text(id)||''):String(t.text||'');
    return raw.trim()?`执行自定义要求：${raw.trim()}`:`应用“${t.label||'自定义模板'}”要求`;
  }
  function preserveClause(id,templates){
    const actions=new Set(templates.map(templateAction)), ids=new Set(templates.map(t=>t.id));
    if(id==='red'){
      if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持产品、人物、背景、装饰及未标注区域不变。';
      const keep=['文字内容','字体风格','颜色','字距','行距','对齐方式','层级关系'];
      return`除上述已选操作外，保持${keep.join('、')}不变；不要改变主体、背景、装饰和未标注区域。`;
    }
    if(id==='blue')return'保持主体、文字、装饰、整体构图及未标注区域不变，避免污染主体边缘。';
    if(id==='purple'){
      const keep=['装饰造型','大小','位置','颜色','透明度','角度','层级'];
      if(actions.has('scaleDown')||actions.has('scaleUp'))keep.splice(keep.indexOf('大小'),1);
      if(actions.has('move'))keep.splice(keep.indexOf('位置'),1);
      if(actions.has('soften')){for(const k of ['透明度']){const i=keep.indexOf(k);if(i>=0)keep.splice(i,1);}}
      if(ids.has('v142-purple-color')){const i=keep.indexOf('颜色');if(i>=0)keep.splice(i,1);}
      if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持主体、文字、背景及未标注区域不变。';
      return`除上述已选操作外，保持${keep.join('、')}不变；不要改变主体、文字、背景和未标注区域。`;
    }
    const keep=['身份特征与主体造型','包装文字或关键细节','颜色','比例','大小','位置','角度','材质与光影','姿态'];
    const remove=k=>{const i=keep.indexOf(k);if(i>=0)keep.splice(i,1);};
    if(actions.has('scaleDown')||actions.has('scaleUp'))remove('大小');
    if(actions.has('move'))remove('位置');
    if(actions.has('angle'))remove('角度');
    if([...ids].some(x=>/material|detail|preserve/.test(x)))remove('材质与光影');
    if([...ids].some(x=>/pose|relation/.test(x)))remove('姿态');
    if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持主产品、人物、文字、背景、装饰和未标注区域不变。';
    return`除上述已选操作外，保持${keep.join('、')}不变；不要新增、删除或改写其他区域。`;
  }
  function composePrompt(id){
    const ts=selectedTemplates(id);if(!ts.length)return'';
    const clauses=ts.map(t=>operationClause(id,t));
    const actions=new Set(ts.map(templateAction));
    const prefix=clauses.length===1?`请只编辑标注区域内的${noun(id)}，完成以下操作：`:`请只编辑标注区域内的${noun(id)}，在同一次编辑中按顺序完成以下 ${clauses.length} 项操作：`;
    const body=clauses.map((c,i)=>`${i+1}. ${c}`).join('；');
    const joint=(actions.has('move')&&(actions.has('scaleDown')||actions.has('scaleUp')))?'缩放与移动必须作为同一主体的一次联合变换完成，不要分别重绘；移动后自然补全原位置及新暴露的背景。 ':actions.has('move')?'移动后自然补全原位置及新暴露的背景。 ':'';
    return`${prefix}${body}。${joint}${preserveClause(id,ts)}`;
  }
  function syncPrompt(id,historyLabel){
    const rawList=Array.isArray(adjustState.v143SelectedTemplates?.[id])?adjustState.v143SelectedTemplates[id]:[];adjustState.brushes[id].template=rawList[rawList.length-1]||'';
    const prompt=composePrompt(id);adjustState.brushes[id].prompt=prompt;const list=selectedIds(id);adjustState.brushes[id].template=list[list.length-1]||'';
    const ta=document.querySelector(`[data-adj-brush-prompt="${id}"]`);if(ta)ta.value=prompt;
    adjustRefreshBrushSummary&&adjustRefreshBrushSummary();adjustScheduleAutosave&&adjustScheduleAutosave();
    if(historyLabel)adjustPushHistory(historyLabel);
  }
  function toggleTemplate(id,tid){
    ensure143();const t=resolveTemplate(id,tid);if(!t)return;let list=selectedIds(id).slice(),idx=list.indexOf(tid);
    if(idx>=0){list.splice(idx,1);}else{
      const action=templateAction(t),isRemove=REMOVE_IDS.has(tid);
      if(isRemove)list=[];
      else list=list.filter(x=>!REMOVE_IDS.has(x));
      if(action==='scaleDown'||action==='scaleUp')list=list.filter(x=>{const a=templateAction(resolveTemplate(id,x));return a!=='scaleDown'&&a!=='scaleUp';});
      list.push(tid);api.prefs.usage[tid]=Number(api.prefs.usage[tid]||0)+1;api.savePrefs();
    }
    adjustState.v143SelectedTemplates[id]=list;syncPrompt(id,'更新多选推荐模板组合');renderAdjustView();
  }
  function clearTemplates(id){adjustState.v143SelectedTemplates[id]=[];adjustState.brushes[id].template='';adjustState.brushes[id].prompt='';adjustPushHistory('清空多选模板组合');adjustScheduleAutosave&&adjustScheduleAutosave();renderAdjustView();}
  function cardHtml(id,d,t){const list=selectedIds(id),order=list.indexOf(t.id)+1,on=order>0,fav=!!api.prefs.favorites[t.id],u=Number(api.prefs.usage[t.id]||0);return`<div class="v143-template-card ${on?'on':''}" style="--region-color:${d.color}"><button type="button" class="v143-template-use" data-v143-template="${escAttr(t.id)}" data-brush-id="${id}"><span class="v143-template-check" data-order="${on?order:''}"></span><b>${esc(displayLabel(id,t))}</b><small>${on?`已选 · 第 ${order} 项`:fav?'已收藏':u?`使用 ${u} 次`:'点击加入组合'}</small></button><button type="button" class="v143-template-fav ${fav?'on':''}" data-v143-favorite="${escAttr(t.id)}" title="${fav?'取消收藏':'收藏模板'}">${fav?'★':'☆'}</button></div>`;}
  function comboSummary(id){const ts=selectedTemplates(id);if(!ts.length)return`<div class="v143-combo-summary"><div class="v143-combo-head"><b>尚未选择模板</b><span>可同时选择“缩小 + 移动”等组合</span></div></div>`;return`<div class="v143-combo-summary"><div class="v143-combo-head"><b>已选择 ${ts.length} 项 <span class="v143-multi-badge">多选组合</span></b><button type="button" class="v143-clear" data-v143-clear="${id}">清空组合</button></div><div class="v143-combo-order">${ts.map((t,i)=>`<span class="v143-order-chip"><i>${i+1}</i>${esc(displayLabel(id,t))}</span>`).join('')}</div></div>`;}
  function parameterHtml(id,ts){
    const p=params(id),acts=new Set(ts.map(templateAction)),hasScale=acts.has('scaleDown')||acts.has('scaleUp'),hasMove=acts.has('move'),hasAngle=acts.has('angle'),hasSoften=acts.has('soften');
    if(!hasScale&&!hasMove&&!hasAngle&&!hasSoften)return`<div class="v142-param-box"><div class="v142-param-title"><b>模板参数化控件</b><span>目标位置功能已移除</span></div><div class="v143-param-empty">当前组合没有可调百分比参数。选择“缩小、放大、移动、角度或弱化”模板后，这里会显示对应滑块；移动仅使用方向与距离，不再设置九宫格目标位置。</div></div>`;
    return`<div class="v142-param-box"><div class="v142-param-title"><b>组合参数控件</b><span>修改后自动重组完整指令</span></div>${hasScale?`<label class="v142-slider"><span>缩放幅度</span><input type="range" min="5" max="50" step="1" value="${p.scalePct}" data-v143-scale="${id}"><output>${p.scalePct}%</output></label>`:''}${hasMove?`<label class="v142-slider"><span>移动距离</span><input type="range" min="1" max="30" step="1" value="${p.movePct}" data-v143-move="${id}"><output>${p.movePct}%</output></label><div class="v143-direction-title"><b>移动方向</b><span>已删除“目标位置”九宫格</span></div><div class="v142-direction-grid">${Object.entries(DIRS).map(([k,v])=>`<button type="button" class="${p.direction===k?'on':''}" data-v143-direction="${k}" data-brush-id="${id}">${esc(v)}</button>`).join('')}</div>`:''}${hasAngle?`<label class="v142-slider"><span>角度幅度</span><input type="range" min="1" max="30" step="1" value="${p.angleDeg}" data-v143-angle="${id}"><output>${p.angleDeg}°</output></label>`:''}${hasSoften?`<label class="v142-slider"><span>弱化幅度</span><input type="range" min="5" max="60" step="1" value="${p.effectPct}" data-v143-effect="${id}"><output>${p.effectPct}%</output></label>`:''}</div>`;
  }
  function editorPanel(){
    ensure143();const id=adjustState.activeBrush||'red',d=ADJUST_BRUSH_DEFS.find(x=>x.id===id)||ADJUST_BRUSH_DEFS[0],info=api.regionInfo(id),state=adjustState.brushes[id],selected=selectedTemplates(id),all=api.sortedTemplates(scope(id));
    const chosenIds=new Set(selected.map(t=>t.id)),cards=[...selected,...all.filter(t=>!chosenIds.has(t.id))].slice(0,5).map(t=>cardHtml(id,d,t)).join('');
    const options='<option value="">选择一个模板加入组合…</option>'+all.map(t=>`<option value="${escAttr(t.id)}">${api.prefs.favorites[t.id]?'★ ':''}${esc(displayLabel(id,t))}${Number(api.prefs.usage[t.id]||0)?` · ${Number(api.prefs.usage[t.id])}次`:''}</option>`).join('');
    const ready=!!(adjustState.img&&adjustColorStrokeCount(id)>0&&String(state.prompt||'').trim()&&!adjustState.aiBusy),type=id==='amber'||id==='green'?(SUBJECT_TYPES[adjustState.v142SubjectTypes?.[id]]||'主体'):info.kind;
    return`<div class="v14-panel-head"><div><h3>当前区域指令</h3><p>5 个推荐模板支持多选，并自动组合为一条完整提示词</p></div><span class="v14-status-pill ${ready?'ok':'warn'}">${ready?'可生成':'待完善'}</span></div><div class="v14-panel-body"><div class="v142-region-context" style="--region-color:${d.color}"><div class="v142-region-main"><i></i><div><b>${esc(info.name)} · ${esc(info.kind)}</b><small>${adjustColorStrokeCount(id)} 笔标注；当前类型：${esc(type)}</small></div></div>${api.subjectSelector(id)}</div><textarea class="v14-prompt" data-adj-brush-prompt="${id}" placeholder="${escAttr(info.placeholder)}">${esc(state.prompt||'')}</textarea><div class="v142-rec-head"><b>推荐模板（可多选）</b><span>点击顺序即组合指令的执行顺序</span></div><div class="v143-template-grid">${cards}</div>${comboSummary(id)}<div class="v143-combo-note" style="--region-color:${d.color}">例如同时选择“缩小”和“移动”，系统会生成“在同一次编辑中先缩小、再移动”的联合指令，并自动去掉“移动时保持大小不变”等冲突约束。</div><button type="button" class="btn btn-violet v142-generate" data-v142-generate="${id}" ${ready?'':'disabled'}>${adjustState.aiBusy?'正在处理…':'单独生成'}</button><details class="v142-more" ${selected.some(t=>['scaleDown','scaleUp','move','soften','angle'].includes(templateAction(t)))?'open':''}><summary><b>更多设置</b><span>组合参数 · 全部模板 · Mask · 冲突检查</span></summary><div class="v142-more-body">${parameterHtml(id,selected)}<div class="v142-template-select-row"><label>全部模板（选择后加入当前组合）</label><div class="v143-add-select"><select data-v143-add-select="${id}">${options}</select><button type="button" class="btn btn-ghost" data-v143-add="${id}">加入组合</button></div></div><div class="v142-run-settings"><label>候选数量<select data-adj-candidate-count><option value="2" ${adjustState.candidateCount===2?'selected':''}>2 个</option><option value="3" ${adjustState.candidateCount===3?'selected':''}>3 个</option><option value="4" ${adjustState.candidateCount===4?'selected':''}>4 个</option></select></label><label>联合执行范围<select data-adj-ai-scope><option value="active" ${adjustState.aiScope==='active'?'selected':''}>当前区域</option><option value="all" ${adjustState.aiScope==='all'?'selected':''}>全部有效区域</option></select></label></div><div class="v142-more-actions"><button type="button" class="btn btn-ghost" data-v142-custom-new="${id}">新建自定义模板</button><button type="button" class="btn btn-ghost" data-v142-template-manager="${id}">模板管理</button><button type="button" class="btn btn-ghost" data-adj-mask="${id}" ${adjustColorStrokeCount(id)?'':'disabled'}>导出当前 Mask</button><button type="button" class="btn btn-ghost" data-v142-conflict-check="${id}">立即检查冲突</button></div>${api.conflictStatusHtml()}</div></details></div>`;
  }
  function applyEditor(){ensure143();const panels=[...document.querySelectorAll('.v14-right .v14-panel')],current=panels.find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='当前区域指令');if(current)current.innerHTML=editorPanel();}

  const baseWorkspace=adjustWorkspaceHtml;
  adjustWorkspaceHtml=function(){let html=baseWorkspace();html=html.replace(/图片微调 · V14\.2 专业工作台/g,'图片微调 · V14.4 专业工作台').replace(/图片微调 · V14\.1 专业工作台/g,'图片微调 · V14.4 专业工作台').replace(/图片微调 · V14 专业工作台/g,'图片微调 · V14.4 专业工作台');html=html.replace('新增参数化模板、主体类型映射、收藏与使用排序，以及生成前多区域冲突检查。','删除目标位置九宫格；推荐模板支持多选，并按选择顺序自动生成兼容的组合提示词。');return html;};
  const baseRender=renderAdjustView;renderAdjustView=function(){ensure143();baseRender();applyEditor();};
  const basePayload=adjustProjectPayload;adjustProjectPayload=function(mode='full'){ensure143();const p=basePayload(mode);p.schema='ai_image_adjustment_project_v143';p.version='V14.4';p.state=p.state||{};p.state.v143SelectedTemplates=JSON.parse(JSON.stringify(adjustState.v143SelectedTemplates));p.state.v143CombinationMode='ordered_multi_select';if(p.state.v142TemplateParams)Object.values(p.state.v142TemplateParams).forEach(x=>{if(x&&typeof x==='object')delete x.position;});return p;};
  if(typeof adjustInstructionPayload==='function'){const baseInstruction=adjustInstructionPayload;adjustInstructionPayload=function(ids){ensure143();const p=baseInstruction(ids);p.version='V14.4';p.regionTemplateMode='ordered_multi_select_v143';p.selectedTemplateCombinations={};(ids||[]).forEach(id=>{p.selectedTemplateCombinations[id]=selectedIds(id).slice();});if(p.templateParameters)Object.values(p.templateParameters).forEach(x=>{if(x&&typeof x==='object')delete x.position;});p.constraints=p.constraints||[];p.constraints.push('同一区域的多项模板必须按所选顺序在一次编辑中联合执行，缩放与移动不得拆分重绘');p.constraints.push('移动仅使用方向和距离，不使用目标位置九宫格');return p;};}
  const baseImport=adjustImportProjectFile;adjustImportProjectFile=async function(file){let parsed=null;try{parsed=JSON.parse(await file.text());}catch(e){}await baseImport(file);if(parsed?.state?.v143SelectedTemplates)adjustState.v143SelectedTemplates=parsed.state.v143SelectedTemplates;ensure143();renderAdjustView();};
  if(typeof adjustSnapshot==='function'){const baseSnapshot=adjustSnapshot;adjustSnapshot=function(label){ensure143();const x=baseSnapshot(label);x.v143={selectedTemplates:JSON.parse(JSON.stringify(adjustState.v143SelectedTemplates))};return x;};}
  if(typeof adjustRestoreSnapshot==='function'){const baseRestore=adjustRestoreSnapshot;adjustRestoreSnapshot=function(x){baseRestore(x);if(x?.v143?.selectedTemplates)adjustState.v143SelectedTemplates=x.v143.selectedTemplates;ensure143();};}
  if(typeof adjustResetRuntime==='function'){const baseReset=adjustResetRuntime;adjustResetRuntime=function(){baseReset();adjustState.v143SelectedTemplates={};ensure143();};}
  if(typeof adjustOpenProjectSave==='function'){const baseOpen=adjustOpenProjectSave;adjustOpenProjectSave=function(){baseOpen();setTimeout(()=>{document.querySelectorAll('.modal h3,.modal-card h3').forEach(h=>{if(/保存 V14(?:\.1|\.2)? 微调项目/.test(h.textContent||''))h.textContent='保存 V14.4 微调项目';});},0);};}
  if(typeof adjustExportProject==='function'){adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v14.4-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V14.4 轻量项目已保存':'V14.4 完整项目已保存',false);};}

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    const tpl=e.target.closest('[data-v143-template]');if(tpl){e.preventDefault();e.stopImmediatePropagation();toggleTemplate(tpl.dataset.brushId,tpl.dataset.v143Template);return;}
    const fav=e.target.closest('[data-v143-favorite]');if(fav){e.preventDefault();e.stopImmediatePropagation();const tid=fav.dataset.v143Favorite;api.prefs.favorites[tid]=!api.prefs.favorites[tid];if(!api.prefs.favorites[tid])delete api.prefs.favorites[tid];api.savePrefs();renderAdjustView();return;}
    const clear=e.target.closest('[data-v143-clear]');if(clear){e.preventDefault();e.stopImmediatePropagation();clearTemplates(clear.dataset.v143Clear);return;}
    const dir=e.target.closest('[data-v143-direction]');if(dir){e.preventDefault();e.stopImmediatePropagation();const id=dir.dataset.brushId;params(id).direction=dir.dataset.v143Direction;syncPrompt(id,'调整组合模板移动方向');renderAdjustView();return;}
    const add=e.target.closest('[data-v143-add]');if(add){e.preventDefault();e.stopImmediatePropagation();const id=add.dataset.v143Add,sel=document.querySelector(`[data-v143-add-select="${id}"]`);if(sel?.value)toggleTemplate(id,sel.value);return;}
  },true);
  document.addEventListener('change',e=>{if(curView!=='adjust')return;const sel=e.target.closest('[data-v143-add-select]');if(sel&&sel.value){toggleTemplate(sel.dataset.v143AddSelect,sel.value);return;}const subject=e.target.closest('[data-v142-subject-type]');if(subject)setTimeout(()=>{ensure143();syncPrompt(subject.dataset.v142SubjectType,'切换主体类型并更新模板组合');renderAdjustView();},0);});
  document.addEventListener('input',e=>{
    if(curView!=='adjust')return;const map=[['v143Scale','scalePct','%'],['v143Move','movePct','%'],['v143Angle','angleDeg','°'],['v143Effect','effectPct','%']];for(const [dk,key,unit] of map){const attr='data-'+dk.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),el=e.target.closest(`[${attr}]`);if(el){const id=el.dataset[dk];params(id)[key]=Number(el.value);if(el.nextElementSibling)el.nextElementSibling.textContent=el.value+unit;syncPrompt(id);return;}}
  });
  document.addEventListener('change',e=>{if(curView!=='adjust')return;const el=e.target.closest('[data-v143-scale],[data-v143-move],[data-v143-angle],[data-v143-effect]');if(el){adjustPushHistory('更新多选组合参数');renderAdjustView();}});
  requestAnimationFrame(()=>{ensure143();if(curView==='adjust')renderAdjustView();});
})();
