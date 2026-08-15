
(function(){
  if(typeof adjustState==='undefined'||typeof ADJUST_BRUSH_DEFS==='undefined')return;
  const IDS=ADJUST_BRUSH_DEFS.map(x=>x.id);
  const AUTOSAVE_DB='ai_studio_adjust_autosave_v138';
  const AUTOSAVE_STORE='projects';
  const AUTOSAVE_ID='latest';
  const STRENGTH_META={strict:{label:'严格锁定',limit:1.8},soft:{label:'允许轻微变化',limit:6.5},position:{label:'仅位置锁定',limit:12}};
  const ISSUE_CONSTRAINTS={text:'文字与品牌标识必须保持笔画、字形、清晰度和原位置不变，禁止出现拉伸、错字或乱码。',background:'背景必须自然衔接，不得出现色块断层、重复纹理或明显修补边缘。',shift:'主体中心位置、尺寸、角度和构图占比必须与修改前一致，禁止整体位移。'};

  function ensureState(){
    adjustState.autoSelectColor=false;
    adjustState.layerMeta=adjustState.layerMeta||{};
    IDS.forEach(id=>{const d=ADJUST_BRUSH_DEFS.find(x=>x.id===id);adjustState.layerMeta[id]=Object.assign({name:d?d.label:id,visible:true,locked:false,opacity:48},adjustState.layerMeta[id]||{});});
    adjustState.focusMode=!!adjustState.focusMode;
    adjustState.focusBrush=adjustState.focusBrush||'';
    adjustState.retryConstraints=Array.isArray(adjustState.retryConstraints)?adjustState.retryConstraints:[];
    adjustState.autosaveEnabled=adjustState.autosaveEnabled!==false;
    adjustState.autosaveAvailable=!!adjustState.autosaveAvailable;
    adjustState.lastAutosaveAt=adjustState.lastAutosaveAt||'';
    adjustState.protectedSnapshots=adjustState.protectedSnapshots||{};
    Object.values(adjustState.protectedSnapshots).forEach(s=>{if(s&&!s.strength)s.strength='strict';});
  }
  ensureState();

  const baseBrushDef=adjustBrushDef;
  adjustBrushDef=function(id){const b=baseBrushDef(id),m=adjustState.layerMeta&&adjustState.layerMeta[id];return Object.assign({},b,{label:m&&m.name?m.name:b.label});};

  const baseSnapshot=adjustSnapshot;
  adjustSnapshot=function(label){ensureState();const s=baseSnapshot(label);s.layerMeta=JSON.parse(JSON.stringify(adjustState.layerMeta));s.focusMode=adjustState.focusMode;s.focusBrush=adjustState.focusBrush;return s;};
  const baseRestoreSnapshot=adjustRestoreSnapshot;
  adjustRestoreSnapshot=function(s){if(s&&s.layerMeta)adjustState.layerMeta=JSON.parse(JSON.stringify(s.layerMeta));if(s&&s.focusMode!==undefined)adjustState.focusMode=!!s.focusMode;if(s&&s.focusBrush!==undefined)adjustState.focusBrush=s.focusBrush||'';baseRestoreSnapshot(s);};

  adjustDrawAnnotations=function(ctx,canvas,force){
    ensureState();if((!adjustState.showAnnotations&&!force)||!adjustState.strokes.length)return;
    const layer=document.createElement('canvas');layer.width=canvas.width;layer.height=canvas.height;const lx=layer.getContext('2d');lx.lineCap='round';lx.lineJoin='round';
    adjustState.strokes.forEach(st=>{if(!st||!Array.isArray(st.points)||!st.points.length)return;const meta=adjustState.layerMeta[st.brushId]||{};if(meta.visible===false)return;lx.save();lx.globalCompositeOperation=st.tool==='eraser'?'destination-out':'source-over';lx.globalAlpha=st.tool==='eraser'?1:Math.max(.08,Math.min(1,Number(meta.opacity||48)/100));lx.strokeStyle=baseBrushDef(st.brushId).color;lx.fillStyle=lx.strokeStyle;lx.lineWidth=Math.max(2,(st.size||.03)*Math.min(layer.width,layer.height));const pts=st.points;if(pts.length===1){lx.beginPath();lx.arc(pts[0].x*layer.width,pts[0].y*layer.height,lx.lineWidth/2,0,Math.PI*2);lx.fill();}else{lx.beginPath();lx.moveTo(pts[0].x*layer.width,pts[0].y*layer.height);for(let i=1;i<pts.length;i++)lx.lineTo(pts[i].x*layer.width,pts[i].y*layer.height);lx.stroke();}lx.restore();});ctx.drawImage(layer,0,0);
  };

  adjustBindBrushCanvas=function(c){
    if(!c||c.__adjustBrushBound)return;c.__adjustBrushBound=true;
    const start=e=>{ensureState();if(!adjustState.img||adjustState.previewOriginal||adjustState.aiBusy)return;const meta=adjustState.layerMeta[adjustState.activeBrush]||{};if(meta.locked){e.preventDefault();setActionStatus('error',adjustBrushDef(adjustState.activeBrush).label+'已锁定，请先解锁图层',false);return;}e.preventDefault();c.setPointerCapture&&c.setPointerCapture(e.pointerId);const p=adjustCanvasPoint(c,e);adjustState.drawing=true;adjustState.currentStroke={brushId:adjustState.activeBrush,tool:adjustState.brushTool,size:p.size,points:[{x:p.x,y:p.y}]};adjustState.strokes.push(adjustState.currentStroke);adjustRenderCanvas();};
    const move=e=>{if(!adjustState.drawing||!adjustState.currentStroke)return;e.preventDefault();const p=adjustCanvasPoint(c,e),pts=adjustState.currentStroke.points,last=pts[pts.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.002){pts.push({x:p.x,y:p.y});adjustRenderCanvas();}};
    const end=e=>{if(!adjustState.drawing)return;e.preventDefault();adjustState.drawing=false;adjustState.currentStroke=null;adjustState.autoSelectColor=false;adjustPushHistory(adjustState.brushTool==='eraser'?'擦除标注':'添加'+adjustBrushDef(adjustState.activeBrush).label+'标注');adjustRefreshBrushSummary();adjustScheduleAutosave();};
    c.addEventListener('pointerdown',start);c.addEventListener('pointermove',move);c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('pointerleave',e=>{if(adjustState.drawing)end(e);});
  };

  const baseBuildPrompt=adjustBuildAiPrompt;
  adjustBuildAiPrompt=function(ids){let p=baseBuildPrompt(ids);if(adjustState.retryConstraints&&adjustState.retryConstraints.length)p+='\n\n本次问题重试附加约束：\n- '+adjustState.retryConstraints.join('\n- ');return p;};

  adjustCheckProtectedBatch=async function(beforeSrc,resultSrc,editingIds){
    ensureState();const skips=new Set(editingIds||[]),out=[];
    for(const [id,s] of Object.entries(adjustState.protectedSnapshots||{})){if(skips.has(id)||!s.maskSrc)continue;const strength=s.strength||'strict',meta=STRENGTH_META[strength]||STRENGTH_META.strict,change=await adjustProtectedChange(beforeSrc,resultSrc,s.maskSrc);if(change>meta.limit)out.push({id,change,strength,limit:meta.limit});}
    return out;
  };
  adjustCreateProtectionSnapshots=function(batch,resultSrc){ensureState();batch.ids.forEach(id=>{const old=adjustState.protectedSnapshots[id]||{};adjustState.protectedSnapshots[id]={id,time:new Date().toLocaleString('zh-CN'),instruction:String(adjustState.brushes[id]&&adjustState.brushes[id].prompt||''),resultSrc,maskSrc:adjustMaskDataUrl([id]),quality:(batch.results||[]).find(x=>x.src===resultSrc)?.quality||null,strength:old.strength||'strict'};});adjustScheduleAutosave();};
  adjustProtectionHtml=function(){ensureState();const snaps=adjustState.protectedSnapshots||{},items=Object.entries(snaps);return `<div class="adjust-protection"><div class="adjust-protection-head"><div><h4>区域保护快照</h4><p>为每个保护区选择严格锁定、允许轻微变化或仅位置锁定。</p></div><span class="wf-status-chip ${items.length?'ok':'wait'}">已保护 ${items.length} 个区域</span></div>${items.length?`<div class="adjust-protection-list">${items.map(([id,s])=>`<div class="adjust-protection-item" style="--protect-color:${baseBrushDef(id).color}"><span class="adjust-protection-dot"></span><div><b>${esc(adjustBrushDef(id).label)}</b><small>${esc(s.time||'')} · ${esc(s.instruction||'已确认结果')}</small></div><div class="adjust-protection-actions"><select class="adjust-protection-strength" data-adj-protect-strength="${id}">${Object.entries(STRENGTH_META).map(([k,v])=>`<option value="${k}" ${(s.strength||'strict')===k?'selected':''}>${v.label}</option>`).join('')}</select><button class="mini-btn" data-adj-protect-restore="${id}">恢复保护区</button><button class="mini-btn" data-adj-protect-remove="${id}">解除</button></div></div>`).join('')}</div>`:'<div class="hint" style="margin-top:7px">尚无保护快照。选用某个区域候选后会自动创建。</div>'}${adjustState.protectionWarnings&&adjustState.protectionWarnings.length?`<div class="adjust-protection-warning">最近检测：${adjustState.protectionWarnings.map(x=>`${esc(adjustBrushDef(x.id).label)}变化 ${x.change}%（${esc((STRENGTH_META[x.strength]||STRENGTH_META.strict).label)}）`).join('；')}。可恢复对应保护区域。</div>`:''}</div>`;};

  function layerPanelHtml(){ensureState();return `<div class="adjust-layer-panel"><div class="adjust-layer-head"><div><h4>区域图层管理</h4><p>图层支持显示、锁定、复制、重命名和标注透明度；锁定后不会被画笔误改。</p></div><span class="wf-status-chip">${IDS.length} 个图层</span></div><div class="adjust-layer-list">${IDS.map(id=>{const d=baseBrushDef(id),m=adjustState.layerMeta[id],count=adjustColorStrokeCount(id);return `<div class="adjust-layer-row ${adjustState.activeBrush===id?'active':''} ${m.visible===false?'hidden-layer':''} ${m.locked?'locked-layer':''}" data-layer-row="${id}"><span class="adjust-layer-color" style="--layer-color:${d.color}"></span><div class="adjust-layer-main"><button type="button" data-adj-layer-select="${id}"><b>${esc(m.name||d.label)}</b><small>${count} 笔标注 · ${m.visible===false?'已隐藏':'可见'} · ${m.locked?'已锁定':'可编辑'}</small></button><label class="adjust-layer-opacity">透明度<input type="range" min="10" max="100" value="${Number(m.opacity||48)}" data-adj-layer-opacity="${id}"><span>${Number(m.opacity||48)}%</span></label></div><div class="adjust-layer-actions"><button class="mini-btn" data-adj-layer-visible="${id}">${m.visible===false?'显示':'隐藏'}</button><button class="mini-btn" data-adj-layer-lock="${id}">${m.locked?'解锁':'锁定'}</button><button class="mini-btn" data-adj-layer-copy="${id}">复制</button><button class="mini-btn" data-adj-layer-rename="${id}">重命名</button></div></div>`;}).join('')}</div></div>`;}

  function focusBannerHtml(){if(!adjustState.focusMode||!adjustState.focusBrush)return'';return `<div class="adjust-focus-banner"><div><b>单任务专注模式 · ${esc(adjustBrushDef(adjustState.focusBrush).label)}</b><br><span>当前只显示该任务所需画笔、修改要求和生成入口。</span></div><button type="button" data-adj-focus-exit>退出专注</button></div>`;}

  function retryPanelHtml(i,item){const notes=item&&item.annotations||[];if(!notes.length)return'';const labels=notes.map(x=>({text:'文字变形',background:'背景错误',shift:'主体偏移'}[x]||x));return `<div class="adjust-issue-retry"><b>已标记：${esc(labels.join('、'))}</b><button class="btn btn-ghost" data-adj-candidate-retry="${i}">按此问题重新生成</button></div>`;}

  function enhanceUI(){
    ensureState();if(curView!=='adjust')return;
    const list=document.querySelector('.adjust-brush-list');if(list&&!document.querySelector('.adjust-layer-panel'))list.insertAdjacentHTML('beforebegin',focusBannerHtml()+layerPanelHtml());
    const auto=document.querySelector('.adjust-auto-row');if(auto){auto.className='adjust-manual-color-note';auto.innerHTML='<span>画笔颜色保持手动选择，绘制结束后不会自动跳转。</span><b>'+adjustUsableColorIds().length+'/5 个区域可生成</b>';}
    document.querySelectorAll('.adjust-brush-row').forEach(row=>{const id=row.querySelector('[data-adj-brush]')?.dataset.adjBrush,m=id&&adjustState.layerMeta[id];if(!id)return;row.classList.toggle('layer-hidden',m&&m.visible===false);row.classList.toggle('layer-locked',!!(m&&m.locked));row.classList.toggle('focus-hidden',!!(adjustState.focusMode&&adjustState.focusBrush&&id!==adjustState.focusBrush));row.querySelectorAll('textarea,select,[data-adj-ai-color],[data-adj-mask]').forEach(el=>{if(m&&m.locked)el.disabled=true;});});
    const toolbar=document.querySelector('.adjust-toolbar-right');if(toolbar&&!document.querySelector('[data-adj-autosave-status]')){const label=adjustState.lastAutosaveAt?'上次 '+adjustState.lastAutosaveAt:'等待首次保存';toolbar.insertAdjacentHTML('afterbegin',`<span class="adjust-autosave-chip ${adjustState.lastAutosaveAt?'ok':'warn'}" data-adj-autosave-status>自动保存：${esc(label)}</span><button class="btn btn-ghost" data-adj-autosave-restore ${adjustState.autosaveAvailable?'':'disabled'}>恢复自动保存</button>`);}
    const root=document.getElementById('adjust-root');if(root&&adjustState.autosaveAvailable&&!adjustState.img&&!document.querySelector('.adjust-recovery'))root.insertAdjacentHTML('afterbegin',`<div class="adjust-recovery"><div><h4>发现上次自动保存的图片微调项目</h4><p>可恢复画笔、Mask、候选结果、队列、保护快照和图层状态。</p></div><div class="adjust-recovery-actions"><button class="btn btn-violet" data-adj-autosave-restore>恢复项目</button><button class="btn btn-ghost" data-adj-autosave-clear>忽略并清除</button></div></div>`);
    if(adjustState.candidateBatch)document.querySelectorAll('.adjust-candidate-card').forEach((card,i)=>{const item=adjustState.candidateBatch.results[i];if(item&&!card.querySelector('[data-adj-candidate-retry]'))card.insertAdjacentHTML('beforeend',retryPanelHtml(i,item));});
  }

  const baseRender=renderAdjustView;
  renderAdjustView=function(){ensureState();baseRender();requestAnimationFrame(enhanceUI);};

  const baseApplyQuick=adjustApplyQuickTask;
  adjustApplyQuickTask=function(id){baseApplyQuick(id);const cfg=typeof ADJUST_V138_QUICK_TASKS!=='undefined'&&ADJUST_V138_QUICK_TASKS[id];if(cfg){adjustState.focusMode=true;adjustState.focusBrush=cfg.brush;adjustState.activeBrush=cfg.brush;renderAdjustView();setActionStatus('success','已进入“'+cfg.label+'”单任务专注模式',false);adjustScheduleAutosave();}};

  const baseProjectPayload=adjustProjectPayload;
  adjustProjectPayload=function(mode='full'){ensureState();const p=baseProjectPayload(mode);p.schema='ai_image_adjustment_project_v138_enhanced';p.version='V14';p.state=p.state||{};Object.assign(p.state,{layerMeta:adjustState.layerMeta,focusMode:adjustState.focusMode,focusBrush:adjustState.focusBrush,retryConstraints:adjustState.retryConstraints,autosaveEnabled:adjustState.autosaveEnabled});if(p.state.protectedSnapshots)Object.values(p.state.protectedSnapshots).forEach(s=>{if(s&&!s.strength)s.strength='strict';});return p;};

  async function restorePayload(p,sourceLabel){
    if(!p||!p.image||!p.image.src)throw new Error('项目缺少图片数据');
    adjustState.src=p.image.src;adjustState.name=p.image.name||'restored-image.png';adjustState.originalSrc=p.image.originalSrc||p.image.src;adjustState.originalName=p.image.originalName||adjustState.name;adjustState.img=await adjustLoadImageObject(adjustState.src);const s=p.state||{};adjustState.settings=Object.assign({},ADJUST_DEFAULTS,s.settings||{});['rotate','flipX','flipY','crop','format','quality','activeBrush','brushSize','brushTool','showAnnotations','exportAnnotations','simpleMode','maskFeather','maskExpand','candidateCount','guideMode','guideStep','paramRecommendation','lastMarkedSrc','lastResultSrc','quickTaskType','autoExecuteMode','focusMode','focusBrush','autosaveEnabled'].forEach(k=>{if(s[k]!==undefined)adjustState[k]=s[k];});adjustState.autoSelectColor=false;adjustState.brushes=Object.assign(adjustDefaultBrushes(),s.brushes||{});adjustState.strokes=Array.isArray(s.strokes)?s.strokes:[];adjustState.queueOrder=Array.isArray(s.queueOrder)?s.queueOrder:IDS.slice();adjustState.queueStatus=s.queueStatus||{};adjustState.dependencies=Object.assign({red:'',amber:'',green:'',blue:'',purple:''},s.dependencies||{});adjustState.detectedRegions=Array.isArray(s.detectedRegions)?s.detectedRegions:[];adjustState.selectedDetectedRegionIds=[];adjustState.candidateBatch=s.candidateBatch||null;adjustState.editHistory=Array.isArray(s.editHistory)?s.editHistory:[];adjustState.protectedSnapshots=s.protectedSnapshots||{};Object.values(adjustState.protectedSnapshots).forEach(x=>{if(x&&!x.strength)x.strength='strict';});adjustState.layerMeta=s.layerMeta||{};adjustState.retryConstraints=Array.isArray(s.retryConstraints)?s.retryConstraints:[];adjustState.editHistoryLoaded=true;adjustState.history=[];adjustState.historyIndex=-1;adjustState.projectLoadedAt=new Date().toLocaleString('zh-CN');ensureState();adjustPushHistory('恢复'+sourceLabel);renderAdjustView();
  }
  adjustImportProjectFile=async function(file){if(!file)return;setActionStatus('loading','正在恢复微调项目…',true);try{const p=JSON.parse(await file.text());if(!String(p.schema||'').startsWith('ai_image_adjustment_project_'))throw new Error('不是兼容的图片微调项目文件');await restorePayload(p,'微调项目');setActionStatus('success',`微调项目已恢复（${p.saveMode==='light'?'轻量':'完整'}模式）`,false);adjustScheduleAutosave();}catch(e){setActionStatus('error','项目恢复失败：'+e.message,false);}};

  const baseReset=window.adjustResetRuntime;
  window.adjustResetRuntime=function(){if(typeof baseReset==='function')baseReset();adjustState.layerMeta={};adjustState.focusMode=false;adjustState.focusBrush='';adjustState.retryConstraints=[];ensureState();};

  function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open(AUTOSAVE_DB,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(AUTOSAVE_STORE))db.createObjectStore(AUTOSAVE_STORE,{keyPath:'id'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async function autosaveRead(){if(localStorage.getItem('turing_region_v21_1_legacy_cleaned')==='1')return null;try{const db=await dbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(AUTOSAVE_STORE,'readonly'),r=tx.objectStore(AUTOSAVE_STORE).get(AUTOSAVE_ID);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch(e){return null;}}
  async function autosaveWrite(){if(localStorage.getItem('turing_region_v21_1_legacy_cleaned')==='1'||!adjustState.autosaveEnabled||!adjustState.img)return;try{const db=await dbOpen(),payload=adjustProjectPayload('full'),updatedAt=new Date().toISOString();await new Promise((resolve,reject)=>{const tx=db.transaction(AUTOSAVE_STORE,'readwrite');tx.objectStore(AUTOSAVE_STORE).put({id:AUTOSAVE_ID,updatedAt,payload});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});adjustState.lastAutosaveAt=new Date(updatedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});adjustState.autosaveAvailable=true;const el=document.querySelector('[data-adj-autosave-status]');if(el){el.textContent='自动保存：上次 '+adjustState.lastAutosaveAt;el.className='adjust-autosave-chip ok';}}catch(e){const el=document.querySelector('[data-adj-autosave-status]');if(el){el.textContent='自动保存失败';el.className='adjust-autosave-chip warn';}}}
  async function autosaveClear(){try{const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(AUTOSAVE_STORE,'readwrite');tx.objectStore(AUTOSAVE_STORE).delete(AUTOSAVE_ID);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(e){}adjustState.autosaveAvailable=false;adjustState.lastAutosaveAt='';renderAdjustView();}
  let autosaveTimer=null;
  window.adjustScheduleAutosave=function(){clearTimeout(autosaveTimer);autosaveTimer=setTimeout(autosaveWrite,1800);};
  setInterval(()=>{if(document.visibilityState==='visible')autosaveWrite();},20000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')autosaveWrite();});
  autosaveRead().then(rec=>{adjustState.autosaveAvailable=!!(rec&&rec.payload);if(rec&&rec.updatedAt)adjustState.autosaveRecordAt=new Date(rec.updatedAt).toLocaleString('zh-CN');if(curView==='adjust')renderAdjustView();});

  async function retryCandidate(index){const b=adjustState.candidateBatch,item=b&&b.results&&b.results[index];if(!b||!item)return;let notes=item.annotations||[];if(!notes.length){if(item.quality&&item.quality.edge>10)notes.push('text');if(item.quality&&item.quality.shift>2)notes.push('shift');if(item.quality&&item.quality.outside>3)notes.push('background');}notes=[...new Set(notes)];if(!notes.length){setActionStatus('error','请先标记“文字变形、背景错误或主体偏移”',false);return;}adjustState.retryConstraints=notes.map(x=>ISSUE_CONSTRAINTS[x]).filter(Boolean);const ids=b.ids.slice(),queue=b.queue;setActionStatus('loading','正在把问题转换成约束并重新生成…',true);try{await adjustGenerateCandidates(ids,{queue,retry:true});setActionStatus('success','已按问题约束重新生成候选',false);}finally{adjustState.retryConstraints=[];adjustScheduleAutosave();}}

  function duplicateLayer(id){ensureState();const order=IDS,srcIndex=order.indexOf(id),target=order.find(x=>x!==id&&adjustColorStrokeCount(x)===0&&!String(adjustState.brushes[x]?.prompt||'').trim())||order[(srcIndex+1)%order.length];const apply=()=>{const srcStrokes=adjustState.strokes.filter(s=>s.brushId===id).map(s=>{const c=JSON.parse(JSON.stringify(s));c.brushId=target;return c;});adjustState.strokes=adjustState.strokes.filter(s=>s.brushId!==target).concat(srcStrokes);adjustState.brushes[target]=JSON.parse(JSON.stringify(adjustState.brushes[id]||{}));adjustState.layerMeta[target]=Object.assign({},adjustState.layerMeta[id],{name:(adjustState.layerMeta[id].name||adjustBrushDef(id).label)+' 副本',locked:false,visible:true});adjustState.activeBrush=target;adjustPushHistory('复制区域图层');renderAdjustView();setActionStatus('success','已复制到 '+adjustBrushDef(target).label,false);adjustScheduleAutosave();};if(adjustColorStrokeCount(target)||String(adjustState.brushes[target]?.prompt||'').trim())confirmDialog('目标颜色已有内容，是否覆盖为当前图层副本？',apply);else apply();}

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    const sel=e.target.closest('[data-adj-layer-select]');if(sel){adjustState.activeBrush=sel.dataset.adjLayerSelect;adjustState.brushTool='brush';renderAdjustView();return;}
    const vis=e.target.closest('[data-adj-layer-visible]');if(vis){const m=adjustState.layerMeta[vis.dataset.adjLayerVisible];m.visible=!m.visible;adjustRenderCanvas();renderAdjustView();adjustScheduleAutosave();return;}
    const lock=e.target.closest('[data-adj-layer-lock]');if(lock){const m=adjustState.layerMeta[lock.dataset.adjLayerLock];m.locked=!m.locked;renderAdjustView();setActionStatus('success',m.locked?'图层已锁定':'图层已解锁',false);adjustScheduleAutosave();return;}
    const copy=e.target.closest('[data-adj-layer-copy]');if(copy){duplicateLayer(copy.dataset.adjLayerCopy);return;}
    const rename=e.target.closest('[data-adj-layer-rename]');if(rename){const id=rename.dataset.adjLayerRename;inputDialog('重命名区域图层',adjustState.layerMeta[id].name,n=>{adjustState.layerMeta[id].name=n;renderAdjustView();adjustScheduleAutosave();});return;}
    if(e.target.closest('[data-adj-focus-exit]')){adjustState.focusMode=false;adjustState.focusBrush='';adjustState.quickTaskType='';renderAdjustView();setActionStatus('success','已退出单任务专注模式',false);return;}
    const retry=e.target.closest('[data-adj-candidate-retry]');if(retry){retryCandidate(Number(retry.dataset.adjCandidateRetry));return;}
    if(e.target.closest('[data-adj-autosave-restore]')){setActionStatus('loading','正在恢复自动保存项目…',true);autosaveRead().then(async rec=>{if(!rec||!rec.payload)throw new Error('没有可恢复的自动保存');await restorePayload(rec.payload,'自动保存');setActionStatus('success','已恢复自动保存项目',false);}).catch(err=>setActionStatus('error','恢复失败：'+err.message,false));return;}
    if(e.target.closest('[data-adj-autosave-clear]')){autosaveClear();setActionStatus('success','自动保存记录已清除',false);return;}
  });
  document.addEventListener('change',e=>{
    if(curView!=='adjust')return;
    const st=e.target.closest('[data-adj-protect-strength]');if(st){const s=adjustState.protectedSnapshots[st.dataset.adjProtectStrength];if(s)s.strength=st.value;setActionStatus('success','保护强度已更新为 '+(STRENGTH_META[st.value]||STRENGTH_META.strict).label,false);adjustScheduleAutosave();return;}
  });
  document.addEventListener('input',e=>{
    if(curView!=='adjust')return;
    const op=e.target.closest('[data-adj-layer-opacity]');if(op){adjustState.layerMeta[op.dataset.adjLayerOpacity].opacity=Number(op.value);const row=op.closest('.adjust-layer-opacity');if(row)row.querySelector('span').textContent=op.value+'%';adjustRenderCanvas();adjustScheduleAutosave();return;}
  });
  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    if(e.target.closest('[data-adj-clear-color]')){ensureState();const m=adjustState.layerMeta[adjustState.activeBrush];if(m&&m.locked){e.preventDefault();e.stopImmediatePropagation();setActionStatus('error','当前图层已锁定，不能清空',false);}}
    if(e.target.closest('[data-adj-clear-all]')){ensureState();const locked=new Set(IDS.filter(id=>adjustState.layerMeta[id].locked));if(locked.size){e.preventDefault();e.stopImmediatePropagation();const before=adjustState.strokes.length;adjustState.strokes=adjustState.strokes.filter(s=>locked.has(s.brushId));adjustPushHistory('清空未锁定图层');adjustRenderCanvas();setActionStatus('success','已清空未锁定图层，保留 '+locked.size+' 个锁定图层',false);adjustScheduleAutosave();}}
  },true);

  const baseConfirm=adjustConfirmCandidateApply;
  adjustConfirmCandidateApply=async function(index){await baseConfirm(index);adjustScheduleAutosave();};
  const baseUse=adjustUseDataUrl;
  adjustUseDataUrl=async function(src,name,keep){const r=await baseUse(src,name,keep);adjustScheduleAutosave();return r;};
  requestAnimationFrame(()=>{if(curView==='adjust')renderAdjustView();});
})();
