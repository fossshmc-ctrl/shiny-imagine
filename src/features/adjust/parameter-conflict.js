
(function(){
  if(typeof adjustState==='undefined'||typeof ADJUST_TEMPLATES==='undefined'||typeof ADJUST_BRUSH_DEFS==='undefined')return;
  const IDS=ADJUST_BRUSH_DEFS.map(x=>x.id);
  const PREF_KEY='ai_adjust_v142_template_preferences';
  const SUBJECT_TYPES={
    product:{label:'产品',noun:'产品主体'},
    person:{label:'人物',noun:'人物主体'},
    pet:{label:'宠物',noun:'宠物主体'},
    secondProduct:{label:'第二产品',noun:'第二产品主体'},
    prop:{label:'道具',noun:'道具主体'},
    custom:{label:'自定义主体',noun:'自定义主体'}
  };
  const DIRS={up:'上方',upRight:'右上方',right:'右侧',downRight:'右下方',down:'下方',downLeft:'左下方',left:'左侧',upLeft:'左上方'};
  let pendingConflictAction=null;

  function loadPrefs(){
    try{
      const raw=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');
      return {favorites:raw.favorites||{},usage:raw.usage||{},custom:Array.isArray(raw.custom)?raw.custom:[]};
    }catch(e){return{favorites:{},usage:{},custom:[]};}
  }
  let prefs=loadPrefs();
  function savePrefs(){try{localStorage.setItem(PREF_KEY,JSON.stringify(prefs));}catch(e){}}
  function escAttr(s){return esc(String(s==null?'':s)).replace(/\"/g,'&quot;').replace(/'/g,'&#39;');}
  function template(id,label,action,scope,text){return{id,label,action,scope,text};}
  function subjectNoun(id){
    const type=adjustState.v142SubjectTypes&&adjustState.v142SubjectTypes[id]|| (id==='amber'?'product':'person');
    if(type==='custom')return String(adjustState.v142CustomSubjectNames&&adjustState.v142CustomSubjectNames[id]||'自定义主体').trim()||'自定义主体';
    return SUBJECT_TYPES[type]?.noun||'主体';
  }
  function params(id){
    adjustState.v142TemplateParams=adjustState.v142TemplateParams||{};
    adjustState.v142TemplateParams[id]=Object.assign({scalePct:20,movePct:5,direction:'right',effectPct:25,angleDeg:10},adjustState.v142TemplateParams[id]||{});
    return adjustState.v142TemplateParams[id];
  }
  function buildScale(id,down){const p=params(id),noun=regionNoun(id),pct=Math.max(1,Math.min(80,Number(p.scalePct)||20)),ratio=down?100-pct:100+pct;return `将标注区域内的${noun}整体${down?'缩小':'放大'} ${pct}%，调整为当前大小的 ${ratio}%，保持${preserveText(id)}，并自然处理周围空缺或边缘；不要改变其他区域。`;}
  function buildMove(id){const p=params(id),noun=regionNoun(id),pct=Math.max(1,Math.min(50,Number(p.movePct)||5)),dir=DIRS[p.direction]||'右侧';return `将标注区域内的${noun}从当前位置向${dir}移动约 ${pct}%，保持比例、造型、文字与材质不变；移动后自然补全原位置，并禁止影响其他区域。`;}
  function preserveText(id){if(id==='red')return'文字内容、字体、颜色、字距、行距、对齐方式和层级不变';if(id==='purple')return'装饰造型、颜色、透明度、角度和层级不变';return `${regionNoun(id)}的造型、比例、角度、身份特征、包装文字或关键细节不变`;}
  function regionNoun(id){if(id==='red')return'文字';if(id==='blue')return'背景';if(id==='purple')return'装饰元素';return subjectNoun(id);}
  function buildSoften(id){const p=params(id),v=Math.max(5,Math.min(80,Number(p.effectPct)||25));return `将标注区域内的装饰效果弱化约 ${v}%，适度降低透明度、亮度或光效强度，使其不抢主体；保持造型、位置、大小、颜色倾向和其他区域不变。`;}
  function buildAngle(id){const p=params(id),v=Math.max(1,Math.min(45,Number(p.angleDeg)||10));return `将标注区域内的${regionNoun(id)}朝构图更自然的方向轻微调整约 ${v}°，保持造型、大小、包装文字、身份特征、材质、中心位置和其他区域稳定。`;}

  const BUILTIN={
    red:[
      template('v142-red-remove','删除文字 / 水印','static','red',()=>`删除标注区域内的文字、水印或字符，并根据周围纹理自然补全背景；不要改变未标注区域。`),
      template('v142-red-down','缩小文字','scaleDown','red',id=>buildScale(id,true)),
      template('v142-red-up','放大文字','scaleUp','red',id=>buildScale(id,false)),
      template('v142-red-move','移动文字','move','red',id=>buildMove(id)),
      template('v142-red-clear','优化文字清晰度','static','red',()=>`提升标注区域内文字的清晰度、笔画完整度和边缘锐度，修复模糊、重影或轻微变形；保持文字内容、位置、大小、颜色和其他区域不变。`)
    ],
    'subject:product':[
      template('v142-product-down','缩小产品','scaleDown','subject:product',id=>buildScale(id,true)),
      template('v142-product-up','放大产品','scaleUp','subject:product',id=>buildScale(id,false)),
      template('v142-product-move','移动产品','move','subject:product',id=>buildMove(id)),
      template('v142-product-material','提升产品材质','static','subject:product',()=>`提升标注区域内产品的清晰度、玻璃或金属材质、边缘和光影细节；严格保持产品造型、包装文字、颜色、比例、角度和其他区域不变。`),
      template('v142-product-angle','调整产品角度','angle','subject:product',id=>buildAngle(id))
    ],
    'subject:person':[
      template('v142-person-down','缩小人物','scaleDown','subject:person',id=>buildScale(id,true)),
      template('v142-person-up','放大人物','scaleUp','subject:person',id=>buildScale(id,false)),
      template('v142-person-move','移动人物','move','subject:person',id=>buildMove(id)),
      template('v142-person-detail','优化人物细节','static','subject:person',()=>`提升标注区域内人物的面部、皮肤、头发、手部和轮廓清晰度，保持身份特征、五官比例、表情、姿态、服装和其他区域不变，禁止变脸或肢体变形。`),
      template('v142-person-pose','微调人物姿态','static','subject:person',()=>`轻微优化标注区域内人物的姿态与肢体自然度，保持身份、脸部、服装、身体比例、主体大小和中心位置不变，禁止新增肢体或改变动作含义。`)
    ],
    'subject:pet':[
      template('v142-pet-down','缩小宠物','scaleDown','subject:pet',id=>buildScale(id,true)),
      template('v142-pet-up','放大宠物','scaleUp','subject:pet',id=>buildScale(id,false)),
      template('v142-pet-move','移动宠物','move','subject:pet',id=>buildMove(id)),
      template('v142-pet-detail','优化毛发与眼睛','static','subject:pet',()=>`提升标注区域内宠物的毛发层次、眼睛、鼻口和轮廓清晰度，保持品种、花色、表情、姿态、身体比例和其他区域不变。`),
      template('v142-pet-pose','优化宠物姿态','static','subject:pet',()=>`轻微优化标注区域内宠物的姿态与四肢自然度，保持品种、花色、脸部、身体比例、主体大小和中心位置不变，禁止增加肢体。`)
    ],
    'subject:secondProduct':[
      template('v142-second-down','缩小第二产品','scaleDown','subject:secondProduct',id=>buildScale(id,true)),
      template('v142-second-up','放大第二产品','scaleUp','subject:secondProduct',id=>buildScale(id,false)),
      template('v142-second-move','移动第二产品','move','subject:secondProduct',id=>buildMove(id)),
      template('v142-second-material','统一材质与光线','static','subject:secondProduct',()=>`统一标注区域内第二产品与主产品的材质、清晰度、色温、投影和光线方向，保持包装文字、造型、颜色和比例不变。`),
      template('v142-second-relation','优化双产品关系','static','subject:secondProduct',()=>`优化标注区域内第二产品与主产品的前后层级、间距和视觉呼应，保持两者造型、大小、包装文字、材质和整体构图稳定。`)
    ],
    'subject:prop':[
      template('v142-prop-down','缩小道具','scaleDown','subject:prop',id=>buildScale(id,true)),
      template('v142-prop-up','放大道具','scaleUp','subject:prop',id=>buildScale(id,false)),
      template('v142-prop-move','移动道具','move','subject:prop',id=>buildMove(id)),
      template('v142-prop-remove','删除道具','static','subject:prop',()=>`删除标注区域内的道具或辅助物件，并根据周围场景自然补全背景；保持产品、人物、文字、装饰和未标注区域不变。`),
      template('v142-prop-material','提升道具质感','static','subject:prop',()=>`提升标注区域内道具的清晰度、材质、边缘与光影细节，保持造型、颜色、比例、位置和其他区域不变。`)
    ],
    'subject:custom':[
      template('v142-custom-down','缩小自定义主体','scaleDown','subject:custom',id=>buildScale(id,true)),
      template('v142-custom-up','放大自定义主体','scaleUp','subject:custom',id=>buildScale(id,false)),
      template('v142-custom-move','移动自定义主体','move','subject:custom',id=>buildMove(id)),
      template('v142-custom-detail','优化主体细节','static','subject:custom',id=>`提升标注区域内${subjectNoun(id)}的清晰度、边缘、材质和光影细节，保持造型、颜色、比例、位置和其他区域不变。`),
      template('v142-custom-preserve','稳定主体造型','static','subject:custom',id=>`修复标注区域内${subjectNoun(id)}的轻微变形、锯齿或透视问题，严格保持原有身份特征、造型、颜色、比例和整体构图不变。`)
    ],
    blue:[
      template('v142-blue-color','更换背景颜色','static','blue',()=>`只将标注区域内的背景调整为与整体画面协调的浅色背景，保持主体、文字、装饰、构图和未标注区域不变。`),
      template('v142-blue-gradient','改为自然渐变','static','blue',()=>`将标注区域内背景改为柔和自然的深浅渐变，保持原有空间关系、主体、文字、装饰和其他区域不变，避免明显色带。`),
      template('v142-blue-clean','清理背景杂物','static','blue',()=>`删除标注区域内影响画面的杂物、污点或多余元素，并根据周围环境自然补全背景；不要改变主体、文字和其他区域。`),
      template('v142-blue-depth','增强背景景深','static','blue',()=>`适度增强标注区域内背景的空间层次和景深，使主体更突出；保持背景内容、主体边缘、文字、装饰和整体色调稳定。`),
      template('v142-blue-light','调整背景明暗','static','blue',()=>`只调整标注区域内背景的亮度与对比度，使光影更协调并突出主体；保持背景结构、颜色倾向和其他区域不变。`)
    ],
    purple:[
      template('v142-purple-remove','删除装饰元素','static','purple',()=>`删除标注区域内的装饰、图标、光效、线条或边框，并根据周围背景自然补全；不要改变主体、文字和其他区域。`),
      template('v142-purple-down','缩小装饰','scaleDown','purple',id=>buildScale(id,true)),
      template('v142-purple-move','移动装饰','move','purple',id=>buildMove(id)),
      template('v142-purple-color','调整装饰颜色','static','purple',()=>`只调整标注区域内装饰元素的颜色，使其与整体画面和产品主色协调；保持造型、大小、位置、透明度和其他区域不变。`),
      template('v142-purple-soften','弱化装饰效果','soften','purple',id=>buildSoften(id))
    ]
  };

  function allBuiltin(){return Object.values(BUILTIN).flat();}
  function scopeFor(id){if(id==='amber'||id==='green')return 'subject:'+(adjustState.v142SubjectTypes[id]|| (id==='amber'?'product':'person'));return id;}
  function customTemplates(scope){return prefs.custom.filter(t=>t.scope===scope).map(t=>Object.assign({action:'custom',text:()=>t.text},t));}
  function allTemplates(scope){return [...(BUILTIN[scope]||BUILTIN.red),...customTemplates(scope)];}
  function findTemplate(tid){return allBuiltin().find(t=>t.id===tid)||prefs.custom.find(t=>t.id===tid)||null;}
  function templatePrompt(id,t){if(!t)return'';if(typeof t.text==='function')return String(t.text(id)||'');return String(t.text||'');}
  function displayLabel(id,t){const p=params(id);if(t.action==='scaleDown')return `${t.label} ${p.scalePct}%`;if(t.action==='scaleUp')return `${t.label} ${p.scalePct}%`;if(t.action==='move')return `${t.label} ${p.movePct}%`;if(t.action==='soften')return `${t.label} ${p.effectPct}%`;if(t.action==='angle')return `${t.label} ${p.angleDeg}°`;return t.label;}
  function sortedTemplates(scope){return allTemplates(scope).map((t,i)=>({t,i})).sort((a,b)=>Number(!!prefs.favorites[b.t.id])-Number(!!prefs.favorites[a.t.id])||(prefs.usage[b.t.id]||0)-(prefs.usage[a.t.id]||0)||a.i-b.i).map(x=>x.t);}
  function topTemplates(scope){return sortedTemplates(scope).slice(0,5);}
  function usage(tid){return Number(prefs.usage[tid]||0);}
  function registerTemplates(){allBuiltin().forEach(t=>{if(!ADJUST_TEMPLATES.some(x=>x.id===t.id))ADJUST_TEMPLATES.push({id:t.id,label:t.label,text:templatePrompt(t.scope==='red'?'red':t.scope==='blue'?'blue':t.scope==='purple'?'purple':t.scope==='subject:product'?'amber':'green',t)});});prefs.custom.forEach(t=>{if(!ADJUST_TEMPLATES.some(x=>x.id===t.id))ADJUST_TEMPLATES.push({id:t.id,label:t.label,text:t.text});});}
  registerTemplates();

  function ensureV142(){
    adjustState.v142SubjectTypes=Object.assign({amber:'product',green:'person'},adjustState.v142SubjectTypes||{});
    adjustState.v142CustomSubjectNames=Object.assign({amber:'自定义主体',green:'自定义主体'},adjustState.v142CustomSubjectNames||{});
    adjustState.v142TemplateParams=adjustState.v142TemplateParams||{};IDS.forEach(params);
    adjustState.v142LastConflictReport=adjustState.v142LastConflictReport||null;
    adjustState.v142AutoLayerNames=adjustState.v142AutoLayerNames||{};
    const migration={
      'v141-red-remove-text':'v142-red-remove','v141-red-text-smaller':'v142-red-down','v141-red-text-larger':'v142-red-up','v141-red-text-move':'v142-red-move','v141-red-text-clean':'v142-red-clear',
      'v141-amber-product-smaller':'v142-product-down','v141-amber-product-larger':'v142-product-up','v141-amber-product-move':'v142-product-move','v141-amber-product-material':'v142-product-material','v141-amber-product-angle':'v142-product-angle',
      'v141-green-subject-smaller':'v142-person-down','v141-green-subject-larger':'v142-person-up','v141-green-subject-move':'v142-person-move','v141-green-person-detail':'v142-person-detail','v141-green-subject-material':'v142-person-pose',
      'v141-blue-background-color':'v142-blue-color','v141-blue-background-gradient':'v142-blue-gradient','v141-blue-background-clean':'v142-blue-clean','v141-blue-background-depth':'v142-blue-depth','v141-blue-background-light':'v142-blue-light',
      'v141-purple-decoration-remove':'v142-purple-remove','v141-purple-decoration-smaller':'v142-purple-down','v141-purple-decoration-move':'v142-purple-move','v141-purple-decoration-color':'v142-purple-color','v141-purple-decoration-soften':'v142-purple-soften'
    };
    IDS.forEach(id=>{const s=adjustState.brushes[id];if(s&&migration[s.template])s.template=migration[s.template];});
    updateLayerNames();
  }
  function updateLayerNames(){
    if(!adjustState.layerMeta)return;
    const names={red:'红色区域 · 文字区域',blue:'蓝色区域 · 背景区域',purple:'紫色区域 · 装饰区域',amber:`橙色区域 · 主体（${SUBJECT_TYPES[adjustState.v142SubjectTypes?.amber]?.label||'产品'}）`,green:`绿色区域 · 主体（${SUBJECT_TYPES[adjustState.v142SubjectTypes?.green]?.label||'人物'}）`};
    const defaults={red:['红色区域','红色区域 · 文字区域'],amber:['橙色区域','橙色区域 · 产品主体区域'],green:['绿色区域','绿色区域 · 人物 / 辅助主体区域'],blue:['蓝色区域','蓝色区域 · 背景区域'],purple:['紫色区域','紫色区域 · 装饰区域']};
    IDS.forEach(id=>{const m=adjustState.layerMeta[id];if(!m)return;const oldAuto=adjustState.v142AutoLayerNames[id];if(!m.name||defaults[id]?.includes(m.name)||m.name===oldAuto){m.name=names[id];adjustState.v142AutoLayerNames[id]=names[id];}});
  }
  ensureV142();

  function templateCard(id,d,t){const selected=adjustState.brushes[id]?.template===t.id,fav=!!prefs.favorites[t.id],u=usage(t.id);return `<div class="v142-template-card ${selected?'on':''}" style="--region-color:${d.color}"><button type="button" class="v142-template-use" data-v142-template-use="${escAttr(t.id)}" data-brush-id="${id}"><b>${esc(displayLabel(id,t))}</b><small>${fav?'已收藏 · ':''}${u?`使用 ${u} 次`:'点击应用并自动组合指令'}</small></button><button type="button" class="v142-template-fav ${fav?'on':''}" data-v142-template-fav="${escAttr(t.id)}" title="${fav?'取消收藏':'收藏模板'}">${fav?'★':'☆'}</button></div>`;}
  function subjectSelector(id){if(id!=='amber'&&id!=='green')return'';const type=adjustState.v142SubjectTypes[id]||'product';const options=Object.entries(SUBJECT_TYPES).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${esc(v.label)}</option>`).join('');return `<select class="v142-subject-select" data-v142-subject-type="${id}" title="选择主体类型">${options}</select>${type==='custom'?`<label class="v142-custom-subject"><span>主体名称</span><input type="text" value="${escAttr(adjustState.v142CustomSubjectNames[id]||'自定义主体')}" data-v142-custom-subject="${id}" placeholder="例如：牙刷、仪器、礼盒"></label>`:''}`;}
  function regionInfo(id){if(id==='red')return{name:'红色区域',kind:'文字区域',placeholder:'描述文字需要删除、缩放、移动、替换或优化的具体要求'};if(id==='blue')return{name:'蓝色区域',kind:'背景区域',placeholder:'描述背景需要换色、清理、渐变、景深或明暗调整的具体要求'};if(id==='purple')return{name:'紫色区域',kind:'装饰区域',placeholder:'描述装饰元素需要删除、缩放、移动、换色或弱化的具体要求'};const type=adjustState.v142SubjectTypes[id]|| (id==='amber'?'product':'person');return{name:id==='amber'?'橙色区域':'绿色区域',kind:`主体区域 · ${SUBJECT_TYPES[type]?.label||'自定义'}`,placeholder:`描述${subjectNoun(id)}需要缩放、移动、优化细节或调整构图的具体要求`};}
  function parameterHtml(id,t){const p=params(id),parametric=t&&['scaleDown','scaleUp','move','soften','angle'].includes(t.action);return `<div class="v142-param-box"><div class="v142-param-title"><b>模板参数化控件</b><span>${parametric?'修改后自动重组上方完整指令':'选择“缩小 / 放大 / 移动”等模板后自动启用'}</span></div><label class="v142-slider"><span>缩放幅度</span><input type="range" min="5" max="50" step="1" value="${p.scalePct}" data-v142-scale="${id}"><output>${p.scalePct}%</output></label><label class="v142-slider"><span>移动距离</span><input type="range" min="1" max="30" step="1" value="${p.movePct}" data-v142-move="${id}"><output>${p.movePct}%</output></label>${t&&t.action==='angle'?`<label class="v142-slider"><span>角度幅度</span><input type="range" min="1" max="30" step="1" value="${p.angleDeg}" data-v142-angle="${id}"><output>${p.angleDeg}°</output></label>`:''}${t&&t.action==='soften'?`<label class="v142-slider"><span>弱化幅度</span><input type="range" min="5" max="60" step="1" value="${p.effectPct}" data-v142-effect="${id}"><output>${p.effectPct}%</output></label>`:''}<div class="v142-param-title" style="margin-top:9px"><b>移动方向</b><span>仅使用方向与距离</span></div><div class="v142-direction-grid">${Object.entries(DIRS).map(([k,v])=>`<button type="button" class="${p.direction===k?'on':''}" data-v142-direction="${k}" data-brush-id="${id}">${esc(v)}</button>`).join('')}</div></div>`;}
  function conflictStatusHtml(){const r=adjustState.v142LastConflictReport;if(!r)return `<div class="v142-conflict-status"><div><b>尚未执行冲突检查</b><small>生成前会自动检查 Mask 重叠、锁定、顺序与指令矛盾。</small></div><span>—</span></div>`;const cls=r.errors?'bad':r.warnings?'warn':'ok',label=r.errors?`${r.errors} 个阻断问题`:r.warnings?`${r.warnings} 个警告`:'检查通过';return `<div class="v142-conflict-status ${cls}"><div><b>${label}</b><small>${esc(r.summary||'')}</small></div><span>${r.checkedAt?esc(r.checkedAt):''}</span></div>`;}
  function editorPanel(){
    ensureV142();const id=adjustState.activeBrush||'red',d=ADJUST_BRUSH_DEFS.find(x=>x.id===id)||ADJUST_BRUSH_DEFS[0],info=regionInfo(id),state=adjustState.brushes[id]||{prompt:'',template:''},scope=scopeFor(id),templates=topTemplates(scope),all=sortedTemplates(scope),selected=findTemplate(state.template),ready=!!(adjustState.img&&adjustColorStrokeCount(id)>0&&String(state.prompt||'').trim()&&!adjustState.aiBusy),autoOpen=selected&&['scaleDown','scaleUp','move','soften','angle'].includes(selected.action);
    const cards=templates.map(t=>templateCard(id,d,t)).join('');
    const options='<option value="">选择全部模板…</option>'+all.map(t=>`<option value="${escAttr(t.id)}" ${state.template===t.id?'selected':''}>${prefs.favorites[t.id]?'★ ':''}${esc(displayLabel(id,t))}${usage(t.id)?` · ${usage(t.id)}次`:''}</option>`).join('');
    return `<div class="v14-panel-head"><div><h3>当前区域指令</h3><p>默认只保留指令、5 个推荐模板与单独生成</p></div><span class="v14-status-pill ${ready?'ok':'warn'}">${ready?'可生成':'待完善'}</span></div><div class="v14-panel-body"><div class="v142-region-context" style="--region-color:${d.color}"><div class="v142-region-main"><i></i><div><b>${esc(info.name)} · ${esc(info.kind)}</b><small>${adjustColorStrokeCount(id)} 笔标注；橙色与绿色统一为主体区域</small></div></div>${subjectSelector(id)}</div><textarea class="v14-prompt" data-adj-brush-prompt="${id}" placeholder="${escAttr(info.placeholder)}">${esc(state.prompt||'')}</textarea><div class="v142-rec-head"><b>推荐模板</b><span>收藏优先，其次按使用次数自动排序</span></div><div class="v142-template-grid">${cards}</div><button type="button" class="btn btn-violet v142-generate" data-v142-generate="${id}" ${ready?'':'disabled'}>${adjustState.aiBusy?'正在处理…':'单独生成'}</button><details class="v142-more" ${autoOpen?'open':''}><summary><b>更多设置</b><span>参数化 · 全部模板 · Mask · 冲突检查</span></summary><div class="v142-more-body">${parameterHtml(id,selected)}<div class="v142-template-select-row"><label>全部快捷模板（收藏与使用次数排序）</label><select data-v142-template-select="${id}">${options}</select></div><div class="v142-run-settings"><label>候选数量<select data-adj-candidate-count><option value="2" ${adjustState.candidateCount===2?'selected':''}>2 个</option><option value="3" ${adjustState.candidateCount===3?'selected':''}>3 个</option><option value="4" ${adjustState.candidateCount===4?'selected':''}>4 个</option></select></label><label>联合执行范围<select data-adj-ai-scope><option value="active" ${adjustState.aiScope==='active'?'selected':''}>当前区域</option><option value="all" ${adjustState.aiScope==='all'?'selected':''}>全部有效区域</option></select></label></div><div class="v142-more-actions"><button type="button" class="btn btn-ghost" data-v142-custom-new="${id}">新建自定义模板</button><button type="button" class="btn btn-ghost" data-v142-template-manager="${id}">模板管理</button><button type="button" class="btn btn-ghost" data-adj-mask="${id}" ${adjustColorStrokeCount(id)?'':'disabled'}>导出当前 Mask</button><button type="button" class="btn btn-ghost" data-v142-conflict-check="${id}">立即检查冲突</button></div>${conflictStatusHtml()}</div></details></div>`;
  }
  function applyEditor(){
    ensureV142();const panels=[...document.querySelectorAll('.v14-right .v14-panel')],current=panels.find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='当前区域指令');if(current)current.innerHTML=editorPanel();
    const generate=panels.find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='AI 局部编辑');if(generate)generate.classList.add('v142-compact-hidden');
    document.querySelectorAll('.v14-group-title b').forEach(el=>{if((el.textContent||'').trim()==='产品 / 人物')el.textContent='主体区域';});
    document.querySelectorAll('.v14-group-title small').forEach(el=>{if(/产品主体、人物/.test(el.textContent||''))el.textContent='产品、人物、宠物、第二产品、道具或自定义主体';});
  }

  function applyTemplate(id,tid,countUse=true){const t=findTemplate(tid);if(!t||!adjustState.brushes[id])return;adjustState.brushes[id].template=t.id;adjustState.brushes[id].prompt=templatePrompt(id,t);if(countUse){prefs.usage[t.id]=usage(t.id)+1;savePrefs();}adjustPushHistory('应用参数化模板：'+t.label);adjustScheduleAutosave&&adjustScheduleAutosave();renderAdjustView();requestAnimationFrame(()=>{const ta=document.querySelector(`[data-adj-brush-prompt="${id}"]`);if(ta)ta.focus();});}
  function updateSelectedPrompt(id){const t=findTemplate(adjustState.brushes[id]?.template);if(!t||!['scaleDown','scaleUp','move','soften','angle'].includes(t.action))return;adjustState.brushes[id].prompt=templatePrompt(id,t);const ta=document.querySelector(`[data-adj-brush-prompt="${id}"]`);if(ta)ta.value=adjustState.brushes[id].prompt;adjustRefreshBrushSummary&&adjustRefreshBrushSummary();adjustScheduleAutosave&&adjustScheduleAutosave();}

  function maskArray(id,size=96){const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d',{willReadFrequently:true});x.lineCap='round';x.lineJoin='round';x.strokeStyle='#fff';x.fillStyle='#fff';(adjustState.strokes||[]).forEach(s=>{if(!s||!Array.isArray(s.points)||!s.points.length)return;const erasing=s.tool==='eraser';if(!erasing&&s.brushId!==id)return;x.save();x.globalCompositeOperation=erasing?'destination-out':'source-over';x.lineWidth=Math.max(1,(Number(s.size)||.03)*size);const pts=s.points;if(pts.length===1){x.beginPath();x.arc(pts[0].x*size,pts[0].y*size,x.lineWidth/2,0,Math.PI*2);x.fill();}else{x.beginPath();x.moveTo(pts[0].x*size,pts[0].y*size);for(let i=1;i<pts.length;i++)x.lineTo(pts[i].x*size,pts[i].y*size);x.stroke();}x.restore();});const data=x.getImageData(0,0,size,size).data,out=new Uint8Array(size*size);for(let i=0,j=0;i<data.length;i+=4,j++)out[j]=data[i+3]>20?1:0;return out;}
  function overlap(a,b){let aa=0,bb=0,inter=0;for(let i=0;i<a.length;i++){if(a[i])aa++;if(b[i])bb++;if(a[i]&&b[i])inter++;}return{areaA:aa,areaB:bb,inter,pct:aa&&bb?inter/Math.min(aa,bb)*100:0};}
  function contradictionIssues(id,prompt){const s=String(prompt||'');const pairs=[
    {a:/删除|去除|移除|清空/,b:/不要删除|保留该(?:文字|产品|人物|主体|装饰|背景)|必须保留该/,name:'同时要求删除与保留'},
    {a:/放大|增大/,b:/缩小|减小/,name:'同时要求放大与缩小'},
    {a:/向左|左移/,b:/向右|右移/,name:'同时要求向左与向右移动'},
    {a:/向上|上移/,b:/向下|下移/,name:'同时要求向上与向下移动'},
    {a:/变亮|提高亮度|增加亮度/,b:/变暗|降低亮度|减少亮度/,name:'同时要求变亮与变暗'},
    {a:/替换|更换内容/,b:/内容不变|保持原内容/,name:'同时要求替换与保持内容不变'}
  ];return pairs.filter(p=>p.a.test(s)&&p.b.test(s)).map(p=>({severity:'error',type:'instruction',title:`${regionInfo(id).name}指令矛盾`,detail:p.name+'，请删除其中一项要求后再生成。'}));}
  function desiredPriority(id){return id==='blue'?1:(id==='amber'||id==='green')?2:id==='red'?3:4;}
  function runConflictCheck(ids){
    ensureV142();ids=[...new Set((ids||[]).filter(id=>IDS.includes(id)))];const issues=[],masks={};IDS.forEach(id=>{if(adjustColorStrokeCount(id)>0)masks[id]=maskArray(id);});
    ids.forEach(id=>{const prompt=String(adjustState.brushes[id]?.prompt||'').trim();if(!adjustColorStrokeCount(id))issues.push({severity:'error',type:'missing',title:`${regionInfo(id).name}缺少 Mask`,detail:'请先在画布中标注需要修改的区域。'});if(!prompt)issues.push({severity:'error',type:'missing',title:`${regionInfo(id).name}缺少指令`,detail:'请填写修改要求或应用推荐模板。'});if(adjustState.layerMeta?.[id]?.locked)issues.push({severity:'error',type:'locked',title:`${regionInfo(id).name}已锁定`,detail:'锁定图层不能生成，请先在左侧图层区解锁。'});issues.push(...contradictionIssues(id,prompt));});
    const relevant=[...new Set([...ids,...Object.keys(masks)])],seenPairs=new Set();for(let i=0;i<relevant.length;i++)for(let j=i+1;j<relevant.length;j++){const a=relevant[i],b=relevant[j];if(!ids.includes(a)&&!ids.includes(b))continue;const pair=[a,b].sort().join('|');if(seenPairs.has(pair))continue;seenPairs.add(pair);const o=masks[a]&&masks[b]?overlap(masks[a],masks[b]):{pct:0};if(o.pct>=3){const outside=!ids.includes(a)||!ids.includes(b);issues.push({severity:'warning',type:'overlap',title:`${regionInfo(a).name}与${regionInfo(b).name} Mask 重叠`,detail:`重叠约占较小区域的 ${o.pct.toFixed(1)}%${outside?'；其中一个区域不在本次生成范围内':''}，后执行的区域可能覆盖前一结果。`});const order=adjustState.queueOrder||IDS,ia=order.indexOf(a),ib=order.indexOf(b),shouldA=desiredPriority(a)<=desiredPriority(b);if((shouldA&&ia>ib)||(!shouldA&&ib>ia))issues.push({severity:'warning',type:'order',title:'修改顺序可能破坏前一结果',detail:`建议执行顺序为：背景 → 主体 → 文字 → 装饰；当前 ${regionInfo(a).name} 与 ${regionInfo(b).name} 的顺序需要调整。`});}}
    ids.forEach(id=>{IDS.filter(x=>!ids.includes(x)&&adjustState.layerMeta?.[x]?.locked&&masks[x]).forEach(lockId=>{const o=masks[id]&&masks[lockId]?overlap(masks[id],masks[lockId]):{pct:0};if(o.pct>=1)issues.push({severity:'error',type:'locked-overlap',title:`${regionInfo(id).name}碰到锁定区域`,detail:`与锁定的 ${regionInfo(lockId).name} 重叠约 ${o.pct.toFixed(1)}%，请缩小 Mask 或解除锁定。`});});});
    const errors=issues.filter(x=>x.severity==='error').length,warnings=issues.filter(x=>x.severity==='warning').length,summary=errors?`存在 ${errors} 个必须处理的问题${warnings?`，另有 ${warnings} 个警告`:''}`:warnings?`无阻断问题，但有 ${warnings} 个可确认警告`:'Mask、锁定状态、修改顺序和指令均未发现冲突';
    const report={ids,issues,errors,warnings,summary,checkedAt:new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})};adjustState.v142LastConflictReport=report;return report;
  }
  function autoFixOrder(){const desired=['blue','amber','green','red','purple'],existing=adjustState.queueOrder||IDS;adjustState.queueOrder=[...desired.filter(x=>existing.includes(x)),...existing.filter(x=>!desired.includes(x))];adjustPushHistory('自动修正多区域执行顺序');adjustScheduleAutosave&&adjustScheduleAutosave();}
  function reportHtml(report,manual=false){const issues=report.issues||[];return `<h3>多区域冲突检查</h3><p class="hint">检查 Mask 重叠、锁定区域、修改顺序和指令矛盾，避免后执行区域破坏前一结果。</p>${issues.length?`<div class="v142-conflict-list">${issues.map(x=>`<div class="v142-conflict-item ${x.severity}"><b>${x.severity==='error'?'阻断：':'警告：'}${esc(x.title)}</b><p>${esc(x.detail)}</p></div>`).join('')}</div>`:`<div class="v142-conflict-pass">检查通过，可以安全生成。</div>`}<div class="row" style="margin-top:12px;display:flex;gap:7px;flex-wrap:wrap">${issues.some(x=>x.type==='order')?'<button class="btn btn-ghost" data-v142-conflict-fix-order>一键修正顺序</button>':''}${!report.errors&&!manual&&report.warnings?'<button class="btn btn-violet" data-v142-conflict-proceed>忽略警告并继续</button>':''}<button class="btn btn-ghost" data-mclose>${report.errors?'返回修改':'关闭'}</button></div>`;}
  function executeWithPreflight(ids,run){const report=runConflictCheck(ids);renderAdjustView();if(report.errors){pendingConflictAction=null;modalOpen(reportHtml(report,false),true);setActionStatus('error','生成已暂停：请先处理冲突检查中的阻断问题',false);return;}if(report.warnings){pendingConflictAction={ids,run};modalOpen(reportHtml(report,false),true);setActionStatus('error','生成前发现区域重叠或顺序警告，请确认后继续',false);return;}pendingConflictAction=null;setActionStatus('success','冲突检查通过，开始生成',false);run();}
  function openManualCheck(ids){const report=runConflictCheck(ids);pendingConflictAction=null;modalOpen(reportHtml(report,true),true);renderAdjustView();}

  function openCustomModal(id){const scope=scopeFor(id);modalOpen(`<h3>新建自定义模板</h3><p class="hint">模板将保存到当前“${esc(regionInfo(id).kind)}”类型，并参与收藏与使用次数排序。</p><label class="fl">模板名称</label><input id="v142-custom-label" type="text" placeholder="例如：主体向左移动并缩小"><label class="fl">完整指令</label><textarea id="v142-custom-text" style="width:100%;min-height:120px" placeholder="输入可直接用于当前区域的完整修改指令"></textarea><div class="row" style="margin-top:12px"><button class="btn btn-violet" data-v142-custom-save="${id}" data-scope="${escAttr(scope)}">保存模板</button><button class="btn btn-ghost" data-mclose>取消</button></div>`,true);}
  function openManager(id){const scope=scopeFor(id),list=sortedTemplates(scope);modalOpen(`<h3>模板收藏与使用排序</h3><p class="hint">收藏模板优先显示，其次按使用次数排序；自定义模板可以删除。</p><div class="v142-manager-list">${list.map(t=>`<div class="v142-manager-item"><div><b>${prefs.favorites[t.id]?'★ ':''}${esc(displayLabel(id,t))}</b><small>${usage(t.id)} 次使用 · ${prefs.custom.some(x=>x.id===t.id)?'自定义模板':'系统模板'}</small></div><div class="v142-manager-actions"><button class="mini-btn" data-v142-manager-fav="${escAttr(t.id)}">${prefs.favorites[t.id]?'取消收藏':'收藏'}</button>${prefs.custom.some(x=>x.id===t.id)?`<button class="mini-btn" data-v142-custom-delete="${escAttr(t.id)}" data-brush-id="${id}">删除</button>`:''}</div></div>`).join('')}</div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-v142-usage-reset="${id}">清空使用次数</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}

  const baseWorkspace=adjustWorkspaceHtml;
  adjustWorkspaceHtml=function(){let html=baseWorkspace();html=html.replace(/图片微调 · V14\.1 专业工作台/g,'图片微调 · V14.2 专业工作台').replace(/图片微调 · V14 专业工作台/g,'图片微调 · V14.2 专业工作台');html=html.replace('新增颜色区域与快捷模板联动：红色文字、橙色产品、绿色人物/辅助主体、蓝色背景、紫色装饰，每个区域提供 5 个专属推荐模板。','新增参数化模板、主体类型映射、收藏与使用排序，以及生成前多区域冲突检查。');return html;};
  const basePayload=adjustProjectPayload;
  adjustProjectPayload=function(mode='full'){ensureV142();const p=basePayload(mode);p.schema='ai_image_adjustment_project_v142';p.version='V14.2';p.state=p.state||{};Object.assign(p.state,{v142SubjectTypes:adjustState.v142SubjectTypes,v142CustomSubjectNames:adjustState.v142CustomSubjectNames,v142TemplateParams:adjustState.v142TemplateParams,v142LastConflictReport:adjustState.v142LastConflictReport,v142AutoLayerNames:adjustState.v142AutoLayerNames,v142TemplatePreferences:prefs});return p;};
  if(typeof adjustInstructionPayload==='function'){const baseInstruction=adjustInstructionPayload;adjustInstructionPayload=function(ids){const p=baseInstruction(ids);p.version='V14.2';p.regionTemplateMode='parameterized_semantic_v142';p.subjectTypeMapping=Object.assign({},adjustState.v142SubjectTypes);p.templateParameters=JSON.parse(JSON.stringify(adjustState.v142TemplateParams||{}));p.preflightConflictReport=adjustState.v142LastConflictReport||null;p.constraints=p.constraints||[];p.constraints.push('重叠区域必须按背景→主体→文字→装饰的队列顺序执行，后续区域不得改写已确认区域');return p;};}
  const baseImport=adjustImportProjectFile;
  adjustImportProjectFile=async function(file){if(!file)return;let parsed=null;try{parsed=JSON.parse(await file.text());}catch(e){}await baseImport(file);if(parsed&&parsed.state){adjustState.v142SubjectTypes=Object.assign({amber:'product',green:'person'},parsed.state.v142SubjectTypes||{});adjustState.v142CustomSubjectNames=Object.assign({amber:'自定义主体',green:'自定义主体'},parsed.state.v142CustomSubjectNames||{});adjustState.v142TemplateParams=parsed.state.v142TemplateParams||{};adjustState.v142LastConflictReport=parsed.state.v142LastConflictReport||null;adjustState.v142AutoLayerNames=parsed.state.v142AutoLayerNames||{};if(parsed.state.v142TemplatePreferences){prefs={favorites:parsed.state.v142TemplatePreferences.favorites||{},usage:parsed.state.v142TemplatePreferences.usage||{},custom:Array.isArray(parsed.state.v142TemplatePreferences.custom)?parsed.state.v142TemplatePreferences.custom:[]};savePrefs();registerTemplates();}ensureV142();renderAdjustView();}};
  if(typeof adjustSnapshot==='function'){const baseSnapshot=adjustSnapshot;adjustSnapshot=function(label){ensureV142();const s=baseSnapshot(label);s.v142={subjectTypes:JSON.parse(JSON.stringify(adjustState.v142SubjectTypes)),customNames:JSON.parse(JSON.stringify(adjustState.v142CustomSubjectNames)),params:JSON.parse(JSON.stringify(adjustState.v142TemplateParams)),lastConflict:JSON.parse(JSON.stringify(adjustState.v142LastConflictReport))};return s;};}
  if(typeof adjustRestoreSnapshot==='function'){const baseRestore=adjustRestoreSnapshot;adjustRestoreSnapshot=function(s){if(s&&s.v142){adjustState.v142SubjectTypes=s.v142.subjectTypes||adjustState.v142SubjectTypes;adjustState.v142CustomSubjectNames=s.v142.customNames||adjustState.v142CustomSubjectNames;adjustState.v142TemplateParams=s.v142.params||adjustState.v142TemplateParams;adjustState.v142LastConflictReport=s.v142.lastConflict||null;}baseRestore(s);ensureV142();};}
  if(typeof adjustResetRuntime==='function'){const baseReset=adjustResetRuntime;adjustResetRuntime=function(){baseReset();adjustState.v142SubjectTypes={amber:'product',green:'person'};adjustState.v142CustomSubjectNames={amber:'自定义主体',green:'自定义主体'};adjustState.v142TemplateParams={};adjustState.v142LastConflictReport=null;adjustState.v142AutoLayerNames={};ensureV142();};}
  if(typeof adjustOpenProjectSave==='function'){const baseOpen=adjustOpenProjectSave;adjustOpenProjectSave=function(){baseOpen();setTimeout(()=>{document.querySelectorAll('.modal h3,.modal-card h3').forEach(h=>{if(/保存 V14(?:\.1)? 微调项目/.test(h.textContent||''))h.textContent='保存 V14.2 微调项目';});},0);};}
  if(typeof adjustExportProject==='function'){adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v14.2-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V14.2 轻量项目已保存':'V14.2 完整项目已保存',false);};}

  const baseRender=renderAdjustView;
  renderAdjustView=function(){ensureV142();baseRender();applyEditor();};

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    const use=e.target.closest('[data-v142-template-use]');if(use){e.preventDefault();e.stopImmediatePropagation();applyTemplate(use.dataset.brushId,use.dataset.v142TemplateUse,true);return;}
    const fav=e.target.closest('[data-v142-template-fav]');if(fav){e.preventDefault();e.stopImmediatePropagation();const id=fav.dataset.v142TemplateFav;prefs.favorites[id]=!prefs.favorites[id];if(!prefs.favorites[id])delete prefs.favorites[id];savePrefs();renderAdjustView();return;}
    const dir=e.target.closest('[data-v142-direction]');if(dir){e.preventDefault();e.stopImmediatePropagation();const id=dir.dataset.brushId;params(id).direction=dir.dataset.v142Direction;updateSelectedPrompt(id);adjustPushHistory('调整模板移动方向');renderAdjustView();return;}
    const add=e.target.closest('[data-v142-custom-new]');if(add){e.preventDefault();e.stopImmediatePropagation();openCustomModal(add.dataset.v142CustomNew);return;}
    const mgr=e.target.closest('[data-v142-template-manager]');if(mgr){e.preventDefault();e.stopImmediatePropagation();openManager(mgr.dataset.v142TemplateManager);return;}
    const check=e.target.closest('[data-v142-conflict-check]');if(check){e.preventDefault();e.stopImmediatePropagation();const id=check.dataset.v142ConflictCheck,ids=adjustState.aiScope==='all'?adjustUsableColorIds():[id];openManualCheck(ids);return;}
    const gen=e.target.closest('[data-v142-generate]');if(gen){e.preventDefault();e.stopImmediatePropagation();const id=gen.dataset.v142Generate;executeWithPreflight([id],()=>adjustGenerateCandidates([id],{queue:false}));return;}
    const proceed=e.target.closest('[data-v142-conflict-proceed]');if(proceed){e.preventDefault();e.stopImmediatePropagation();const p=pendingConflictAction;pendingConflictAction=null;modalClose();if(p&&p.run){setActionStatus('success','已确认警告，继续生成',false);p.run();}return;}
    if(e.target.closest('[data-v142-conflict-fix-order]')){e.preventDefault();e.stopImmediatePropagation();autoFixOrder();const p=pendingConflictAction,ids=p?.ids||adjustUsableColorIds(),r=runConflictCheck(ids);modalOpen(reportHtml(r,!p),true);renderAdjustView();setActionStatus('success','已按背景→主体→文字→装饰修正执行顺序',false);return;}
    const save=e.target.closest('[data-v142-custom-save]');if(save){e.preventDefault();e.stopImmediatePropagation();const label=document.getElementById('v142-custom-label')?.value.trim(),text=document.getElementById('v142-custom-text')?.value.trim();if(!label||!text){setActionStatus('error','请填写模板名称和完整指令',false);return;}const id='v142-custom-'+Date.now().toString(36),item={id,label,text,scope:save.dataset.scope,createdAt:new Date().toISOString()};prefs.custom.push(item);prefs.favorites[id]=true;savePrefs();registerTemplates();modalClose();applyTemplate(save.dataset.v142CustomSave,id,true);setActionStatus('success','自定义模板已保存并收藏',false);return;}
    const mf=e.target.closest('[data-v142-manager-fav]');if(mf){e.preventDefault();e.stopImmediatePropagation();const id=mf.dataset.v142ManagerFav;prefs.favorites[id]=!prefs.favorites[id];if(!prefs.favorites[id])delete prefs.favorites[id];savePrefs();const active=adjustState.activeBrush||'red';openManager(active);renderAdjustView();return;}
    const del=e.target.closest('[data-v142-custom-delete]');if(del){e.preventDefault();e.stopImmediatePropagation();const tid=del.dataset.v142CustomDelete;prefs.custom=prefs.custom.filter(x=>x.id!==tid);delete prefs.favorites[tid];delete prefs.usage[tid];IDS.forEach(id=>{if(adjustState.brushes[id]?.template===tid)adjustState.brushes[id].template='';});savePrefs();openManager(del.dataset.brushId||adjustState.activeBrush);renderAdjustView();setActionStatus('success','自定义模板已删除',false);return;}
    const reset=e.target.closest('[data-v142-usage-reset]');if(reset){e.preventDefault();e.stopImmediatePropagation();prefs.usage={};savePrefs();openManager(reset.dataset.v142UsageReset);renderAdjustView();setActionStatus('success','模板使用次数已清空',false);return;}
  },true);

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;const t=e.target.closest('[data-adj-ai-color],[data-adj-ai-run],[data-adj-queue-start],[data-adj-auto-execute],[data-adj-guide-next]');if(!t)return;if(t.matches('[data-adj-guide-next]')&&Number(adjustState.guideStep||1)<3)return;e.preventDefault();e.stopImmediatePropagation();if(t.matches('[data-adj-ai-color]')){const id=t.dataset.adjAiColor;executeWithPreflight([id],()=>adjustGenerateCandidates([id],{queue:false}));return;}if(t.matches('[data-adj-ai-run]')){const ids=adjustState.aiScope==='all'?adjustUsableColorIds():[adjustState.activeBrush];executeWithPreflight(ids,()=>adjustGenerateCandidates(ids,{queue:false}));return;}if(t.matches('[data-adj-queue-start]')){const ids=adjustUsableColorIds();executeWithPreflight(ids,()=>adjustQueueStart());return;}if(t.matches('[data-adj-auto-execute]')){const ids=adjustUsableColorIds();executeWithPreflight(ids,()=>adjustAutoExecuteStart());return;}if(t.matches('[data-adj-guide-next]')){const ids=adjustState.aiScope==='all'?adjustUsableColorIds():[adjustState.activeBrush];executeWithPreflight(ids,()=>adjustGenerateCandidates(ids,{queue:false}));return;}},true);

  document.addEventListener('input',e=>{
    if(curView!=='adjust')return;const handlers=[['v142Scale','scalePct','%'],['v142Move','movePct','%'],['v142Angle','angleDeg','°'],['v142Effect','effectPct','%']];for(const [dataKey,key,unit] of handlers){const attr='data-'+dataKey.replace(/[A-Z]/g,m=>'-'+m.toLowerCase()),el=e.target.closest(`[${attr}]`);if(el){const id=el.dataset[dataKey];params(id)[key]=Number(el.value);const out=el.nextElementSibling;if(out)out.textContent=el.value+unit;updateSelectedPrompt(id);return;}}
    const custom=e.target.closest('[data-v142-custom-subject]');if(custom){const id=custom.dataset.v142CustomSubject;adjustState.v142CustomSubjectNames[id]=custom.value;updateSelectedPrompt(id);updateLayerNames();return;}
  });
  document.addEventListener('change',e=>{
    if(curView!=='adjust')return;const subject=e.target.closest('[data-v142-subject-type]');if(subject){const id=subject.dataset.v142SubjectType;adjustState.v142SubjectTypes[id]=subject.value;adjustState.brushes[id].template='';updateLayerNames();adjustPushHistory('切换主体区域类型');adjustScheduleAutosave&&adjustScheduleAutosave();renderAdjustView();setActionStatus('success',`${id==='amber'?'橙色':'绿色'}主体区域已切换为${SUBJECT_TYPES[subject.value]?.label||'自定义主体'}，模板组已更新`,false);return;}const select=e.target.closest('[data-v142-template-select]');if(select&&select.value){applyTemplate(select.dataset.v142TemplateSelect,select.value,true);return;}const param=e.target.closest('[data-v142-scale],[data-v142-move],[data-v142-angle],[data-v142-effect]');if(param){adjustPushHistory('更新模板参数');renderAdjustView();return;}const custom=e.target.closest('[data-v142-custom-subject]');if(custom){adjustPushHistory('更新自定义主体名称');renderAdjustView();return;}
  });

  window.__V142Api={
    get prefs(){return prefs;},savePrefs,findTemplate,templatePrompt,displayLabel,sortedTemplates,topTemplates,allTemplates,scopeFor,params,regionInfo,subjectSelector,conflictStatusHtml,subjectNoun,ensureV142,registerTemplates,updateLayerNames,usage
  };
  requestAnimationFrame(()=>{ensureV142();if(curView==='adjust')renderAdjustView();});
})();
