
(function(){
  if(typeof adjustState==='undefined'||typeof renderAdjustView!=='function'||!window.__V142Api)return;
  const api=window.__V142Api;
  const IDS=(typeof ADJUST_BRUSH_DEFS!=='undefined'?ADJUST_BRUSH_DEFS:[]).map(x=>x.id);
  const REMOVE_IDS=new Set(['v142-red-remove','v142-prop-remove','v142-purple-remove']);
  const DIRS={up:'上方',upRight:'右上方',right:'右侧',downRight:'右下方',down:'下方',downLeft:'左下方',left:'左侧',upLeft:'左上方'};
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
  let dragInfo=null;

  function selectedIds(id){return Array.isArray(adjustState.v143SelectedTemplates?.[id])?adjustState.v143SelectedTemplates[id].slice():[];}
  function resolveTemplate(id,tid){const scope=api.scopeFor(id);return api.allTemplates(scope).find(t=>t.id===tid)||api.findTemplate(tid)||null;}
  function labelFor(id,tid){const t=resolveTemplate(id,tid);return t?api.displayLabel(id,t):tid;}
  function actionOf(id,tid){
    const t=resolveTemplate(id,tid),raw=String(tid||''),label=String(t?api.displayLabel(id,t):'');
    if(t&&t.action)return t.action;
    if(REMOVE_IDS.has(raw)||/(删除文字|删除装饰|删除道具|删除主体|移除主体)/.test(label))return'remove';
    if(/-down$/.test(raw)||/缩小/.test(label))return'scaleDown';
    if(/-up$/.test(raw)||/放大/.test(label))return'scaleUp';
    if(/-move$/.test(raw)||/移动/.test(label))return'move';
    if(/-angle$/.test(raw)||/角度|旋转/.test(label))return'angle';
    if(/-soften$/.test(raw)||/弱化/.test(label))return'soften';
    if(/material|detail|clear|preserve|enhance/.test(raw)||/材质|清晰|细节|修复|质感/.test(label))return'material';
    return'custom';
  }
  function priority(id,tid){
    const a=actionOf(id,tid);
    if(a==='remove')return 0;
    if(a==='scaleDown'||a==='scaleUp')return 10;
    if(a==='angle')return 15;
    if(a==='move')return 20;
    if(a==='material')return 30;
    if(a==='soften')return 40;
    return 50;
  }
  function recommendedOrder(id,list){
    if(list.some(tid=>actionOf(id,tid)==='remove')&&list.length>1)return list.slice();
    return list.map((tid,index)=>({tid,index,p:priority(id,tid)})).sort((a,b)=>a.p-b.p||a.index-b.index).map(x=>x.tid);
  }
  function sameOrder(a,b){return a.length===b.length&&a.every((x,i)=>x===b[i]);}
  function analysisFor(id,list){
    const actions=list.map(tid=>actionOf(id,tid)),issues=[];
    const removeIndexes=actions.map((a,i)=>a==='remove'?i:-1).filter(i=>i>=0);
    if(removeIndexes.length&&list.length>1)issues.push({level:'bad',text:'删除类操作应单独执行，不能与缩放、移动或材质优化混合，否则会产生“先删除又继续修改”的矛盾。'});
    const firstScale=actions.findIndex(a=>a==='scaleDown'||a==='scaleUp'),firstMove=actions.indexOf('move');
    if(firstScale>=0&&firstMove>=0&&firstMove<firstScale)issues.push({level:'warn',text:`“${labelFor(id,list[firstScale])}”建议放在“${labelFor(id,list[firstMove])}”之前：先确定最终大小，再按最终轮廓移动，更容易稳定构图。`});
    const geometryIndexes=actions.map((a,i)=>['scaleDown','scaleUp','angle','move'].includes(a)?i:-1).filter(i=>i>=0),materialIndexes=actions.map((a,i)=>a==='material'?i:-1).filter(i=>i>=0);
    if(geometryIndexes.length&&materialIndexes.some(mi=>mi<Math.max(...geometryIndexes)))issues.push({level:'warn',text:'材质、清晰度或细节优化建议放在缩放与移动之后，避免几何变换再次损失已经增强的边缘和纹理。'});
    const recommended=recommendedOrder(id,list);
    return{issues,recommended,changed:!sameOrder(list,recommended),level:issues.some(x=>x.level==='bad')?'bad':issues.length?'warn':'ok'};
  }
  function noun(id){if(id==='red')return'文字';if(id==='blue')return'背景';if(id==='purple')return'装饰元素';return api.subjectNoun(id);}
  function operationClause(id,t){
    const p=api.params(id),n=noun(id),a=actionOf(id,t.id);
    if(a==='scaleDown'){const v=Math.max(1,Math.min(80,Number(p.scalePct)||20));return`将${n}整体缩小 ${v}%（调整为原大小的 ${100-v}%）`;}
    if(a==='scaleUp'){const v=Math.max(1,Math.min(80,Number(p.scalePct)||20));return`将${n}整体放大 ${v}%（调整为原大小的 ${100+v}%）`;}
    if(a==='move'){const v=Math.max(1,Math.min(50,Number(p.movePct)||5)),d=DIRS[p.direction]||'右侧';return`将${n}从当前位置向${d}移动约 ${v}%`;}
    if(a==='angle'){const v=Math.max(1,Math.min(45,Number(p.angleDeg)||10));return`轻微调整${n}角度约 ${v}°，保持透视与落地关系自然`;}
    if(a==='soften'){const v=Math.max(5,Math.min(80,Number(p.effectPct)||25));return`将装饰效果弱化约 ${v}%，适度降低透明度、亮度或光效强度`;}
    if(STATIC_CLAUSES[t.id]){let c=STATIC_CLAUSES[t.id];if(t.id.startsWith('v142-custom-'))c=c.replace('自定义主体',n);return c;}
    const raw=typeof t.text==='function'?String(t.text(id)||''):String(t.text||'');return raw.trim()?`执行自定义要求：${raw.trim()}`:`应用“${t.label||'自定义模板'}”要求`;
  }
  function preserveClause(id,templates){
    const actions=new Set(templates.map(t=>actionOf(id,t.id))),ids=new Set(templates.map(t=>t.id));
    if(id==='red'){
      if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持产品、人物、背景、装饰及未标注区域不变。';
      return'除上述已选操作外，保持文字内容、字体风格、颜色、字距、行距、对齐方式、层级关系不变；不要改变主体、背景、装饰和未标注区域。';
    }
    if(id==='blue')return'保持主体、文字、装饰、整体构图及未标注区域不变，避免污染主体边缘。';
    if(id==='purple'){
      const keep=['装饰造型','大小','位置','颜色','透明度','角度','层级'];
      const remove=k=>{const i=keep.indexOf(k);if(i>=0)keep.splice(i,1);};
      if(actions.has('scaleDown')||actions.has('scaleUp'))remove('大小');if(actions.has('move'))remove('位置');if(actions.has('soften'))remove('透明度');if(ids.has('v142-purple-color'))remove('颜色');
      if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持主体、文字、背景及未标注区域不变。';
      return`除上述已选操作外，保持${keep.join('、')}不变；不要改变主体、文字、背景和未标注区域。`;
    }
    const keep=['身份特征与主体造型','包装文字或关键细节','颜色','比例','大小','位置','角度','材质与光影','姿态'];
    const remove=k=>{const i=keep.indexOf(k);if(i>=0)keep.splice(i,1);};
    if(actions.has('scaleDown')||actions.has('scaleUp'))remove('大小');if(actions.has('move'))remove('位置');if(actions.has('angle'))remove('角度');if([...ids].some(x=>/material|detail|preserve/.test(x)))remove('材质与光影');if([...ids].some(x=>/pose|relation/.test(x)))remove('姿态');
    if([...ids].some(x=>REMOVE_IDS.has(x)))return'自然补全删除区域；保持主产品、人物、文字、背景、装饰和未标注区域不变。';
    return`除上述已选操作外，保持${keep.join('、')}不变；不要新增、删除或改写其他区域。`;
  }
  function composePrompt(id,list){
    const ts=list.map(tid=>resolveTemplate(id,tid)).filter(Boolean);if(!ts.length)return'';
    const clauses=ts.map(t=>operationClause(id,t)),actions=new Set(ts.map(t=>actionOf(id,t.id)));
    const prefix=clauses.length===1?`请只编辑标注区域内的${noun(id)}，完成以下操作：`:`请只编辑标注区域内的${noun(id)}，在同一次编辑中按顺序完成以下 ${clauses.length} 项操作：`;
    const body=clauses.map((c,i)=>`${i+1}. ${c}`).join('；');
    const joint=(actions.has('move')&&(actions.has('scaleDown')||actions.has('scaleUp')))?'缩放与移动必须作为同一主体的一次联合变换完成，不要分别重绘；移动后自然补全原位置及新暴露的背景。 ':actions.has('move')?'移动后自然补全原位置及新暴露的背景。 ':'';
    return`${prefix}${body}。${joint}${preserveClause(id,ts)}`;
  }
  function applyRecommendedOrder(id){
    const list=selectedIds(id),a=analysisFor(id,list);
    if(!list.length){setActionStatus('error','当前区域尚未选择推荐模板',false);return;}
    if(!a.changed){setActionStatus('success','当前组合顺序已经合理，无需调整',false);return;}
    adjustState.v143SelectedTemplates[id]=a.recommended.slice();
    adjustState.brushes[id].template=a.recommended[a.recommended.length-1]||'';
    adjustState.brushes[id].prompt=composePrompt(id,a.recommended);
    if(typeof adjustPushHistory==='function')adjustPushHistory('V14.7 一键优化组合执行顺序');
    if(typeof adjustScheduleAutosave==='function')adjustScheduleAutosave();
    renderAdjustView();setActionStatus('success','已按“缩放／角度 → 移动 → 材质与细节 → 效果”的依赖顺序重新排列',false);
  }
  function predictDrop(id,sourceTid,targetTid,after){
    const list=selectedIds(id),from=list.indexOf(sourceTid),target=list.indexOf(targetTid);if(from<0||target<0)return list;
    list.splice(from,1);const to=list.indexOf(targetTid)+(after?1:0);list.splice(Math.max(0,to),0,sourceTid);return list;
  }
  function statusText(a,count){if(!count)return'等待组合';if(a.level==='bad')return'存在冲突';if(a.level==='warn')return`${a.issues.length} 项建议`;return'顺序合理';}
  function toolHtml(id,list,a,preview){
    const labels=list.map(tid=>labelFor(id,tid));
    const statusClass=preview?'drag':a.level;
    const issueHtml=a.issues.length?a.issues.map(x=>`<div class="v146-order-issue ${x.level==='bad'?'bad':''}">${esc(x.text)}</div>`).join(''):`<div class="v146-order-ok">${list.length?'当前执行顺序符合依赖关系：先完成几何调整，再完成材质和细节优化。':'选择多个推荐模板后，这里会实时检查删除、缩放、移动和材质优化的先后依赖。'}</div>`;
    const recommendedLabels=a.recommended.map(tid=>labelFor(id,tid));
    return`<div class="v146-order-head"><div><b>组合顺序与保护检查</b><small>多选和拖拽时实时分析步骤依赖，工具固定放在本区域方便处理</small></div><span class="v146-order-status ${statusClass}">${preview?'拖拽预览':statusText(a,list.length)}</span></div><div class="v146-order-body"><div class="v146-order-current"><b>${preview?'预览顺序':'当前顺序'}：</b>${labels.length?esc(labels.join(' → ')):'尚未选择模板'}</div>${issueHtml}${a.changed?`<div class="v146-order-suggest"><b>建议顺序：</b>${esc(recommendedLabels.join(' → '))}</div>`:''}<div class="v146-order-actions"><button type="button" class="mini-btn" data-v146-order-fix="${id}" ${a.changed?'':'disabled'}>一键优化顺序</button><button type="button" class="mini-btn" data-v146-order-locate="${id}" ${list.length>1?'':'disabled'}>展开拖拽排序</button><button type="button" class="mini-btn" data-v146-order-check-all>检查全部区域</button></div><div class="v146-order-live" data-v146-live hidden></div><div class="v146-protection-note">删除类操作建议单独执行；常规推荐顺序为：缩放／角度 → 移动 → 材质与细节 → 其他效果。</div></div>`;
  }
  function findProtectionPanel(){return[...document.querySelectorAll('.v14-right .v14-panel')].find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='已确认区域保护');}
  function enhanceProtection(previewList){
    if(curView!=='adjust')return;
    const panel=findProtectionPanel();if(!panel)return;
    const id=adjustState.activeBrush||'red',list=previewList||selectedIds(id),a=analysisFor(id,list);
    const headText=panel.querySelector('.v14-panel-head p');if(headText)headText.textContent='保护快照、组合顺序与依赖工具';
    const body=panel.querySelector('.v14-panel-body');if(!body)return;
    let tool=body.querySelector('[data-v146-order-tool]');
    if(!tool){tool=document.createElement('div');tool.className='v146-order-tool';tool.dataset.v146OrderTool=id;body.prepend(tool);}
    tool.dataset.v146OrderTool=id;tool.innerHTML=toolHtml(id,list,a,!!previewList);
  }
  function clearDropClasses(){document.querySelectorAll('.v146-drop-good,.v146-drop-warn,.v146-drop-bad').forEach(x=>x.classList.remove('v146-drop-good','v146-drop-warn','v146-drop-bad'));}
  function showDragPreview(chip,e){
    if(!dragInfo||chip.dataset.brushId!==dragInfo.id)return;
    const r=chip.getBoundingClientRect(),after=e.clientY>r.top+r.height/2,list=predictDrop(dragInfo.id,dragInfo.tid,chip.dataset.v144SortItem,after),a=analysisFor(dragInfo.id,list);
    clearDropClasses();chip.classList.add(a.level==='bad'?'v146-drop-bad':a.level==='warn'?'v146-drop-warn':'v146-drop-good');enhanceProtection(list);
    const live=document.querySelector('[data-v146-live]');if(live){live.hidden=false;live.textContent=`放到${after?'该步骤之后':'该步骤之前'}：${a.level==='ok'?'顺序合理':a.level==='bad'?'仍存在阻断冲突':'存在顺序建议'}。`;}
  }
  function checkAllRegions(){
    const rows=IDS.map(id=>({id,list:selectedIds(id)})).filter(x=>x.list.length),bad=rows.filter(x=>analysisFor(x.id,x.list).level==='bad'),warn=rows.filter(x=>analysisFor(x.id,x.list).level==='warn');
    if(!rows.length){setActionStatus('error','当前没有已选择模板的区域可检查',false);return;}
    if(bad.length)setActionStatus('error',`全部区域检查：${bad.length} 个区域存在阻断冲突，${warn.length} 个区域有顺序建议`,false);
    else if(warn.length)setActionStatus('error',`全部区域检查：${warn.length} 个区域需要优化执行顺序`,false);
    else setActionStatus('success',`全部区域检查通过：${rows.length} 个区域的组合顺序合理`,false);
  }

  const baseWorkspace=adjustWorkspaceHtml;
  adjustWorkspaceHtml=function(){let html=baseWorkspace();html=html.replace(/V14\.5/g,'V14.7');html=html.replace('新增 Ctrl+Z 快捷键组；已选组合默认紧凑显示，并将模板与预设合并为标签式命令面板。','精简高级工具区域，并将“前后记录／保存项目”合并为项目与记录二级菜单。');return html;};
  const baseRender=renderAdjustView;
  renderAdjustView=function(){baseRender();enhanceProtection();};
  const basePayload=adjustProjectPayload;
  adjustProjectPayload=function(mode='full'){const p=basePayload(mode);p.schema='ai_image_adjustment_project_v147';p.version='V14.7';p.state=p.state||{};p.state.v146OrderDependencyMode='live_drag_multi_select';p.state.v146OrderToolLocation='confirmed_region_protection';p.state.v147RemovedAdvancedSections=['region_dependency_queue_mask','protection_snapshot_retry_rules'];p.state.v147ProjectRecordMenu='secondary_menu';return p;};
  if(typeof adjustInstructionPayload==='function'){const baseInstruction=adjustInstructionPayload;adjustInstructionPayload=function(ids){const p=baseInstruction(ids);p.version='V14.7';p.regionTemplateMode='simplified_advanced_project_record_menu_v147';return p;};}
  if(typeof adjustOpenProjectSave==='function'){const baseOpen=adjustOpenProjectSave;adjustOpenProjectSave=function(){baseOpen();setTimeout(()=>{document.querySelectorAll('.modal h3,.modal-card h3').forEach(h=>{if(/保存 V14(?:\.1|\.2|\.3|\.4|\.5|\.6|\.7|\.8|\.9)? 微调项目/.test(h.textContent||''))h.textContent='保存 V27 区域编辑项目';});},0);};}
  if(typeof adjustExportProject==='function'){adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v14.7-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V14.7 轻量项目已保存':'V14.7 完整项目已保存',false);};}

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    const fix=e.target.closest('[data-v146-order-fix]');if(fix){e.preventDefault();e.stopImmediatePropagation();applyRecommendedOrder(fix.dataset.v146OrderFix);return;}
    const locate=e.target.closest('[data-v146-order-locate]');if(locate){e.preventDefault();e.stopImmediatePropagation();const id=locate.dataset.v146OrderLocate;adjustState.v145ComboExpanded=adjustState.v145ComboExpanded||{};adjustState.v145ComboExpanded[id]=true;renderAdjustView();requestAnimationFrame(()=>{const drawer=document.querySelector(`[data-v145-combo-drawer="${id}"]`);if(drawer){drawer.hidden=false;drawer.scrollIntoView({behavior:'smooth',block:'center'});}});return;}
    if(e.target.closest('[data-v146-order-check-all]')){e.preventDefault();e.stopImmediatePropagation();checkAllRegions();return;}
  },true);
  document.addEventListener('dragstart',e=>{const chip=e.target.closest('[data-v144-sort-item]');if(!chip)return;dragInfo={id:chip.dataset.brushId,tid:chip.dataset.v144SortItem};enhanceProtection(selectedIds(dragInfo.id));const live=document.querySelector('[data-v146-live]');if(live){live.hidden=false;live.textContent='正在拖动步骤：移动到其他步骤前后时，将实时预览新的依赖关系。';}},true);
  document.addEventListener('dragover',e=>{const chip=e.target.closest('[data-v144-sort-item]');if(!chip||!dragInfo)return;showDragPreview(chip,e);},true);
  document.addEventListener('drop',()=>{clearDropClasses();dragInfo=null;requestAnimationFrame(()=>enhanceProtection());},true);
  document.addEventListener('dragend',()=>{clearDropClasses();dragInfo=null;requestAnimationFrame(()=>enhanceProtection());},true);
  requestAnimationFrame(()=>{if(curView==='adjust'){renderAdjustView();enhanceProtection();}});
})();
