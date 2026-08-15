
(function(){
  if(typeof adjustState==='undefined'||typeof ADJUST_TEMPLATES==='undefined'||typeof ADJUST_BRUSH_DEFS==='undefined')return;
  const REGION_INFO={
    red:{kind:'文字区域',name:'红色区域',placeholder:'描述文字需要删除、缩放、移动、替换或优化的具体要求'},
    amber:{kind:'产品主体区域',name:'橙色区域',placeholder:'描述产品需要缩放、移动、调整角度或提升材质的具体要求'},
    green:{kind:'人物 / 辅助主体区域',name:'绿色区域',placeholder:'描述人物或辅助主体需要缩放、移动、优化细节的具体要求'},
    blue:{kind:'背景区域',name:'蓝色区域',placeholder:'描述背景需要换色、清理、渐变、景深或明暗调整的具体要求'},
    purple:{kind:'装饰区域',name:'紫色区域',placeholder:'描述装饰元素需要删除、缩放、移动、换色或弱化的具体要求'}
  };
  const REGION_TEMPLATES={
    red:[
      {id:'v141-red-remove-text',label:'删除文字 / 水印',text:'删除标注区域内的文字、水印或字符，并根据周围纹理自然补全背景；不要改变未标注区域。'},
      {id:'v141-red-text-smaller',label:'文字缩小 20%',text:'将标注区域内的文字整体缩小至当前大小的 80%，保持字体、颜色、字距、行距、对齐方式和层级不变，并自然补全空出的背景；不要改变其他区域。'},
      {id:'v141-red-text-larger',label:'文字放大 20%',text:'将标注区域内的文字整体放大至当前大小的 120%，保持字体、颜色、字距、行距、对齐方式和层级不变，避免超出原文字区域；不要改变其他区域。'},
      {id:'v141-red-text-move',label:'调整文字位置',text:'将标注区域内的文字向更合理的位置轻微移动约 5%，保持文字大小、字体、颜色、排版层级和其他区域不变。'},
      {id:'v141-red-text-clean',label:'优化文字清晰度',text:'提升标注区域内文字的清晰度、笔画完整度和边缘锐度，修复模糊、重影或轻微变形；保持文字内容、位置、大小、颜色和其他区域不变。'}
    ],
    amber:[
      {id:'v141-amber-product-smaller',label:'产品缩小 15%',text:'将标注区域内的产品主体整体缩小至当前大小的 85%，保持造型、包装文字、比例、角度、材质和其他区域不变，并自然补全周围背景。'},
      {id:'v141-amber-product-larger',label:'产品放大 15%',text:'将标注区域内的产品主体整体放大至当前大小的 115%，保持造型、包装文字、比例、角度、材质和其他区域不变，避免裁切主体。'},
      {id:'v141-amber-product-move',label:'移动产品位置',text:'将标注区域内的产品主体向画面更合理的位置轻微移动约 5%，保持大小、比例、角度、包装文字和未标注区域不变。'},
      {id:'v141-amber-product-material',label:'提升产品材质',text:'提升标注区域内产品的清晰度、材质、玻璃或金属质感、边缘和光影细节；严格保持产品造型、包装文字、颜色、比例和其他区域不变。'},
      {id:'v141-amber-product-angle',label:'调整产品角度',text:'轻微调整标注区域内产品主体的朝向或透视，使构图更自然；保持产品造型、大小、包装文字、材质、中心位置和其他区域稳定。'}
    ],
    green:[
      {id:'v141-green-subject-smaller',label:'人物 / 主体缩小 15%',text:'将标注区域内的人物或辅助主体整体缩小至当前大小的 85%，保持人物身份、五官、姿态、身体比例、服装或主体造型不变，并自然补全背景。'},
      {id:'v141-green-subject-larger',label:'人物 / 主体放大 15%',text:'将标注区域内的人物或辅助主体整体放大至当前大小的 115%，保持人物身份、五官、姿态、身体比例、服装或主体造型不变，避免裁切。'},
      {id:'v141-green-subject-move',label:'移动人物 / 主体',text:'将标注区域内的人物或辅助主体向更合理的位置轻微移动约 5%，保持大小、姿态、身份特征、造型和其他区域不变。'},
      {id:'v141-green-person-detail',label:'优化人物细节',text:'提升标注区域内人物的面部、皮肤、头发、手部和轮廓清晰度，保持身份特征、五官比例、表情、姿态、服装和其他区域不变，禁止变脸或肢体变形。'},
      {id:'v141-green-subject-material',label:'提升辅助主体质感',text:'提升标注区域内辅助主体的清晰度、材质、边缘和光影细节，保持造型、颜色、比例、位置和其他区域不变。'}
    ],
    blue:[
      {id:'v141-blue-background-color',label:'更换背景颜色',text:'只将标注区域内的背景调整为与整体画面协调的浅色背景，保持主体、文字、装饰、构图和未标注区域不变。'},
      {id:'v141-blue-background-gradient',label:'改为自然渐变',text:'将标注区域内背景改为柔和自然的深浅渐变，保持原有空间关系、主体、文字、装饰和其他区域不变，避免明显色带。'},
      {id:'v141-blue-background-clean',label:'清理背景杂物',text:'删除标注区域内影响画面的杂物、污点或多余元素，并根据周围环境自然补全背景；不要改变主体、文字和其他区域。'},
      {id:'v141-blue-background-depth',label:'增强背景景深',text:'适度增强标注区域内背景的空间层次和景深，使主体更突出；保持背景内容、主体边缘、文字、装饰和整体色调稳定。'},
      {id:'v141-blue-background-light',label:'调整背景明暗',text:'只调整标注区域内背景的亮度与对比度，使光影更协调并突出主体；保持背景结构、颜色倾向和其他区域不变。'}
    ],
    purple:[
      {id:'v141-purple-decoration-remove',label:'删除装饰元素',text:'删除标注区域内的装饰、图标、光效、线条或边框，并根据周围背景自然补全；不要改变主体、文字和其他区域。'},
      {id:'v141-purple-decoration-smaller',label:'装饰缩小 20%',text:'将标注区域内的装饰元素整体缩小至当前大小的 80%，保持造型、颜色、透明度、角度和层级不变，并自然补全空出区域。'},
      {id:'v141-purple-decoration-move',label:'移动装饰位置',text:'将标注区域内的装饰元素向更合理的位置轻微移动约 5%，保持大小、造型、颜色、透明度、层级和其他区域不变。'},
      {id:'v141-purple-decoration-color',label:'调整装饰颜色',text:'只调整标注区域内装饰元素的颜色，使其与整体画面和产品主色协调；保持造型、大小、位置、透明度和其他区域不变。'},
      {id:'v141-purple-decoration-soften',label:'弱化装饰效果',text:'适度降低标注区域内装饰元素的透明度、亮度或光效强度，使其不抢主体；保持造型、位置、大小、颜色倾向和其他区域不变。'}
    ]
  };
  Object.values(REGION_TEMPLATES).flat().forEach(t=>{if(!ADJUST_TEMPLATES.some(x=>x.id===t.id))ADJUST_TEMPLATES.push(t);});
  ADJUST_BRUSH_DEFS.forEach(d=>{const i=REGION_INFO[d.id];if(i)d.placeholder=i.placeholder;});

  function regionTemplates(id){return REGION_TEMPLATES[id]||REGION_TEMPLATES.red;}
  function semanticName(id){const i=REGION_INFO[id]||REGION_INFO.red;return i.name+' · '+i.kind;}
  function updateDefaultLayerNames(){
    if(!adjustState.layerMeta)return;
    const old={red:'红色区域',amber:'橙色区域',green:'绿色区域',blue:'蓝色区域',purple:'紫色区域'};
    Object.keys(REGION_INFO).forEach(id=>{const m=adjustState.layerMeta[id];if(m&&(!m.name||m.name===old[id]))m.name=semanticName(id);});
  }
  function editorPanel(){
    const id=adjustState.activeBrush||'red',d=ADJUST_BRUSH_DEFS.find(x=>x.id===id)||ADJUST_BRUSH_DEFS[0],info=REGION_INFO[id]||REGION_INFO.red,state=adjustState.brushes[id]||{prompt:'',template:''},list=regionTemplates(id),ready=!!(adjustState.img&&adjustColorStrokeCount(id)>0&&String(state.prompt||'').trim()&&!adjustState.aiBusy);
    const opts='<option value="">请选择适合当前区域的快捷模板…</option>'+list.map(t=>`<option value="${t.id}" ${state.template===t.id?'selected':''}>${esc(t.label)}</option>`).join('');
    const chips=list.map(t=>`<button type="button" class="v141-template-chip ${state.template===t.id?'on':''}" style="--region-color:${d.color}" data-adj-recommend="${id}" data-template="${t.id}" title="应用：${esc(t.label)}"><i></i><span>${esc(t.label)}</span></button>`).join('');
    return `<div class="v14-panel-head"><div><h3>当前区域指令</h3><p>选择颜色后自动切换为对应区域的 5 个推荐模板</p></div><span class="v14-status-pill ${ready?'ok':'warn'}">${ready?'可生成':'待完善'}</span></div><div class="v14-panel-body"><div class="v141-region-context" style="--region-color:${d.color}"><div class="v141-region-context-main"><i></i><div><b>${esc(info.name)}</b><span>${esc(info.kind)} · ${adjustColorStrokeCount(id)} 笔标注</span></div></div><span class="v141-region-kind">${esc(info.kind)}</span></div><textarea class="v14-prompt" data-adj-brush-prompt="${id}" placeholder="${esc(info.placeholder)}">${esc(state.prompt||'')}</textarea><div class="v141-template-block"><div class="v141-template-title"><b>快捷模板</b><span>当前仅显示 ${esc(info.kind)} 模板</span></div><select class="v141-template-select" data-adj-template="${id}">${opts}</select><div class="v141-template-title" style="margin-top:8px"><b>推荐模板</b><span>共 5 个，可一键填入后继续编辑</span></div><div class="v141-template-grid">${chips}</div></div><div class="v141-editor-note" style="--region-color:${d.color}">模板中的百分比、移动方向和颜色描述都可以在上方指令框内继续修改。</div><div class="v14-inline-actions" style="margin-top:8px"><button class="btn btn-ghost" data-adj-mask="${id}" ${adjustColorStrokeCount(id)?'':'disabled'}>导出当前 Mask</button><button class="btn btn-violet" data-adj-ai-color="${id}" ${ready?'':'disabled'}>单独生成</button></div></div>`;
  }
  function applyV141Editor(){
    updateDefaultLayerNames();
    const panels=[...document.querySelectorAll('.v14-right .v14-panel')];
    const panel=panels.find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='当前区域指令');
    if(panel)panel.innerHTML=editorPanel();
  }
  const baseWorkspace=adjustWorkspaceHtml;
  adjustWorkspaceHtml=function(){
    let html=baseWorkspace();
    html=html.replace(/图片微调 · V14 专业工作台/g,'图片微调 · V14.1 专业工作台');
    html=html.replace('重新整理为“图层与画笔—中央画布—指令与生成”三栏工作流，常用操作不再堆叠在同一侧栏。','新增颜色区域与快捷模板联动：红色文字、橙色产品、绿色人物/辅助主体、蓝色背景、紫色装饰，每个区域提供 5 个专属推荐模板。');
    return html;
  };
  const basePayload=adjustProjectPayload;
  adjustProjectPayload=function(mode='full'){const p=basePayload(mode);p.schema='ai_image_adjustment_project_v141';p.version='V14.1';return p;};
  if(typeof adjustInstructionPayload==='function'){
    const baseInstructionPayload=adjustInstructionPayload;
    adjustInstructionPayload=function(ids){const p=baseInstructionPayload(ids);p.version='V14.1';p.regionTemplateMode='color_semantic_v141';return p;};
  }
  if(typeof adjustOpenProjectSave==='function'){
    const baseOpenProjectSave=adjustOpenProjectSave;
    adjustOpenProjectSave=function(){baseOpenProjectSave();setTimeout(()=>{const heads=[...document.querySelectorAll('.modal h3,.modal-card h3')],h=heads.find(x=>/保存 V14 微调项目/.test(x.textContent||''));if(h)h.textContent='保存 V14.1 微调项目';},0);};
  }
  if(typeof adjustExportProject==='function'){
    adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v14.1-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V14.1 轻量项目已保存':'V14.1 完整项目已保存',false);};
  }
  const baseRender=renderAdjustView;
  renderAdjustView=function(){updateDefaultLayerNames();baseRender();applyV141Editor();};
  document.addEventListener('change',e=>{if(curView!=='adjust')return;const s=e.target.closest('.v141-template-select');if(s)setTimeout(applyV141Editor,0);});
  requestAnimationFrame(()=>{updateDefaultLayerNames();if(curView==='adjust'){renderAdjustView();applyV141Editor();}});
})();
