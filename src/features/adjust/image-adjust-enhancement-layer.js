
/* ===== V14 功能增强覆盖层 · V27.9 微调连续运行稳定性 ===== */
const ADJUST_V138_ANNOTATIONS=[['text','文字变形'],['background','背景错误'],['shift','主体偏移']];
const ADJUST_V138_QUICK_TASKS={
  'remove-text':{label:'删除文字',desc:'自动使用红色区域与温和补背景参数',brush:'red',template:'remove-text'},
  'change-background':{label:'换背景',desc:'自动使用蓝色区域与大范围羽化参数',brush:'blue',template:'adjust-color'},
  'move-product':{label:'移动产品',desc:'自动使用橙色区域并增加 Mask 扩张',brush:'amber',template:'move-subject'},
  'enhance-material':{label:'提升材质',desc:'自动使用绿色区域并保护主体造型',brush:'green',template:'enhance-material'}
};
adjustState.autoSelectColor=false;
adjustState.protectedSnapshots=adjustState.protectedSnapshots||{};
adjustState.protectionWarnings=adjustState.protectionWarnings||[];
adjustState.selectedDetectedRegionIds=adjustState.selectedDetectedRegionIds||[];
adjustState.quickTaskType=adjustState.quickTaskType||'';
adjustState.autoExecuteMode=!!adjustState.autoExecuteMode;
adjustState.projectSaveMode=adjustState.projectSaveMode||'full';

adjustState.microRunActive=!!adjustState.microRunActive;
adjustState.microRunId=String(adjustState.microRunId||'');
adjustState.microRunStartedAt=Number(adjustState.microRunStartedAt)||0;
adjustState.microRunHeartbeatAt=Number(adjustState.microRunHeartbeatAt)||0;
adjustState.microRunAcknowledgedAt=Number(adjustState.microRunAcknowledgedAt)||0;
adjustState.microRunStatus=String(adjustState.microRunStatus||'idle');
adjustState.microRunSessionId=String(adjustState.microRunSessionId||'');

const V275_MICRO_RUN_STALE_MS=600000;
let v275MicroRunPromise=null;
function adjustMicroMeter(){return window.MicroPerformanceMeterV276||window.MicroPerformanceMeterV275||window.MicroPerformanceMeterV274||null;}
function adjustMicroRunEvent(type,detail={}){try{window.dispatchEvent(new CustomEvent(type,{detail:Object.assign({version:'V27.9',at:Date.now()},detail||{})}));}catch(_e){}}
function adjustMicroRunError(message,code='micro_generation_error'){const error=new Error(message);error.code=code;return error;}
function adjustTouchMicroRun(status,extra={}){
  const now=Date.now();
  if(status)adjustState.microRunStatus=String(status);
  adjustState.microRunHeartbeatAt=now;
  adjustMicroRunEvent('v275-micro-generation-progress',Object.assign({generationId:adjustState.microRunId,sessionId:adjustState.microRunSessionId,status:adjustState.microRunStatus},extra||{}));
  return now;
}
function adjustRecoverTerminalMicroRun(){
  const terminal=['complete','failed','handoff-failed','cancelled','timeout'].includes(String(adjustState.microRunStatus||''));
  const started=Number(adjustState.microRunHeartbeatAt||adjustState.microRunStartedAt)||0;
  const stale=!!(adjustState.microRunId&&started&&Date.now()-started>V275_MICRO_RUN_STALE_MS);
  if(!v275MicroRunPromise&&(terminal||stale)){
    adjustState.aiBusy=false;
    adjustState.microRunActive=false;
    if(stale&&!terminal)adjustState.microRunStatus='stale-recovered';
    return true;
  }
  return false;
}
function adjustStartMicroGenerationDirect(payload={}){
  const ids=[...new Set((Array.isArray(payload.ids)?payload.ids:[]).filter(Boolean))];
  const generationId=String(payload.generationId||'');
  const sessionId=String(payload.sessionId||adjustMicroMeter()?.snapshot?.()?.sessionId||'');
  const microApi=window.__V27_MICRO_API__||window.__V24_MICRO_API__||window.__V23_MICRO_API__;
  if(!generationId)throw adjustMicroRunError('微调流程交接失败：缺少独立 generationId，未提交计费任务','micro_handoff_missing_generation_id');
  if(!ids.length)throw adjustMicroRunError('微调流程交接失败：没有可执行的区域任务','micro_handoff_empty_regions');
  if(!microApi?.isGenerationActive?.())throw adjustMicroRunError('微调流程交接失败：独立微调会话未激活','micro_handoff_inactive_channel');

  adjustRecoverTerminalMicroRun();
  if(v275MicroRunPromise||adjustState.microRunActive||adjustState.aiBusy){
    const old=String(adjustState.microRunId||'');
    const error=adjustMicroRunError(old?`上一项微调任务仍在运行（${old.slice(0,12)}…），本次未重复提交。`:'图片微调区仍有任务运行，本次未重复提交。','micro_generation_busy');
    adjustMicroRunEvent('v275-micro-generation-handoff',{status:'rejected-busy',generationId,sessionId,previousGenerationId:old});
    throw error;
  }

  const fn=window.adjustGenerateCandidates;
  if(typeof fn!=='function')throw adjustMicroRunError('微调流程交接失败：生成函数未加载','micro_handoff_missing_handler');
  const startedAt=Date.now();
  adjustState.microRunActive=true;
  adjustState.microRunId=generationId;
  adjustState.microRunSessionId=sessionId;
  adjustState.microRunStartedAt=startedAt;
  adjustState.microRunHeartbeatAt=startedAt;
  adjustState.microRunAcknowledgedAt=0;
  adjustState.microRunStatus='handoff';
  adjustMicroMeter()?.annotate?.({generationId,sessionId,handoffStatus:'starting',directBridge:'v276'});
  adjustMicroRunEvent('v275-micro-generation-handoff',{status:'starting',generationId,sessionId,regionCount:ids.length});

  let rawPromise;
  try{
    // Direct function invocation intentionally bypasses the legacy capture-phase click/conflict
    // listener. Async functions execute synchronously until their first await, so the handler must
    // acknowledge the run before this call returns; otherwise no provider POST has been reached.
    rawPromise=fn(ids,Object.assign({},payload.options||{},{queue:false,microRunId:generationId,microRunSessionId:sessionId,directBridge:'v276'}));
  }catch(error){
    adjustState.microRunActive=false;
    adjustState.microRunStatus='handoff-failed';
    adjustState.microRunHeartbeatAt=Date.now();
    adjustMicroRunEvent('v275-micro-generation-handoff',{status:'failed',generationId,sessionId,error:String(error?.message||error)});
    throw error;
  }

  if(adjustState.microRunId!==generationId||!adjustState.microRunAcknowledgedAt){
    const error=adjustMicroRunError('微调流程交接未被生成器确认；已在提交 EvoLink 任务前中止，请重新点击一次。','micro_handoff_not_acknowledged');
    adjustState.microRunActive=false;
    adjustState.microRunStatus='handoff-failed';
    adjustState.microRunHeartbeatAt=Date.now();
    adjustMicroMeter()?.annotate?.({handoffStatus:'failed'});
    adjustMicroRunEvent('v275-micro-generation-handoff',{status:'failed',generationId,sessionId,error:error.message});
    Promise.resolve(rawPromise).catch(()=>{});
    throw error;
  }
  // Unlock the billed /images/generations route only after the exact handler acknowledged this run.
  // Because the first await in adjustGenerateCandidates occurs after acknowledgement, this gate is
  // established before reference upload or provider task submission can begin.
  const channelAck=microApi.acknowledgeGeneration?.(generationId,{sessionId,performanceSessionId:sessionId,handlerAcknowledgedAt:adjustState.microRunAcknowledgedAt});
  if(!channelAck?.ok){
    const error=adjustMicroRunError('微调流程交接确认未写入独立计费通道，未提交 EvoLink 任务。','micro_handoff_channel_ack_failed');
    adjustState.microRunActive=false;adjustState.microRunStatus='handoff-failed';adjustState.microRunHeartbeatAt=Date.now();
    adjustMicroMeter()?.annotate?.({handoffStatus:'failed'});Promise.resolve(rawPromise).catch(()=>{});throw error;
  }

  const guarded=Promise.resolve(rawPromise).then(result=>{
    if(result&&result.ok===false)throw result.error||adjustMicroRunError(result.message||'微调生成失败','micro_generation_failed');
    return result;
  }).finally(()=>{
    if(adjustState.microRunId===generationId){
      adjustState.microRunActive=false;
      // The owned run has settled. This is the final protection against a sticky aiBusy flag.
      adjustState.aiBusy=false;
      adjustState.microRunHeartbeatAt=Date.now();
      if(!['complete','failed'].includes(adjustState.microRunStatus))adjustState.microRunStatus='settled';
    }
    if(v275MicroRunPromise===guarded)v275MicroRunPromise=null;
  });
  v275MicroRunPromise=guarded;
  adjustMicroRunEvent('v275-micro-generation-handoff',{status:'accepted',generationId,sessionId,acknowledgedAt:adjustState.microRunAcknowledgedAt});
  return{accepted:true,generationId,sessionId,acknowledgedAt:adjustState.microRunAcknowledgedAt,promise:guarded};
}
window.__V276_START_MICRO_ADJUST__=adjustStartMicroGenerationDirect;
window.__V275_START_MICRO_ADJUST__=adjustStartMicroGenerationDirect;
window.__V276_MICRO_RUN_DIAGNOSTICS__=()=>({version:'V27.9',active:!!adjustState.microRunActive,aiBusy:!!adjustState.aiBusy,generationId:String(adjustState.microRunId||''),sessionId:String(adjustState.microRunSessionId||''),status:String(adjustState.microRunStatus||'idle'),startedAt:Number(adjustState.microRunStartedAt)||0,heartbeatAt:Number(adjustState.microRunHeartbeatAt)||0,acknowledgedAt:Number(adjustState.microRunAcknowledgedAt)||0,hasPromise:!!v275MicroRunPromise,staleMs:V275_MICRO_RUN_STALE_MS,handoffAckMode:'synchronous-before-provider'});
window.__V275_MICRO_RUN_DIAGNOSTICS__=window.__V276_MICRO_RUN_DIAGNOSTICS__;

const adjustWorkspaceHtmlV137=window.adjustWorkspaceHtml;
const adjustSnapshotV137=window.adjustSnapshot;
const adjustRestoreSnapshotV137=window.adjustRestoreSnapshot;
const adjustResetRuntimeV137=window.adjustResetRuntime;

// V27.9 click-to-image timing waits until the provider URL is actually browser-decodable.
// A bounded fallback prevents a slow CDN from blocking the local result/check pipeline forever.
function adjustWaitResultDisplayReady(src,timeoutMs=30000){
  const url=String(src||'');
  if(!url)return Promise.resolve({ready:false,reason:'empty'});
  return new Promise(resolve=>{
    let settled=false,timer=null;
    const finish=value=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);resolve(value);};
    const im=new Image();
    im.onload=()=>finish({ready:true,width:im.naturalWidth||im.width||0,height:im.naturalHeight||im.height||0});
    im.onerror=()=>finish({ready:false,reason:'load-error'});
    timer=setTimeout(()=>finish({ready:false,reason:'timeout'}),Math.max(3000,Number(timeoutMs)||30000));
    im.src=url;
    if(im.complete&&im.naturalWidth)finish({ready:true,width:im.naturalWidth,height:im.naturalHeight});
  });
}

window.adjustResetRuntime=function(){adjustResetRuntimeV137();adjustState.autoSelectColor=false;adjustState.protectedSnapshots={};adjustState.protectionWarnings=[];adjustState.selectedDetectedRegionIds=[];adjustState.quickTaskType='';adjustState.autoExecuteMode=false;adjustState.projectSaveMode='full';adjustState.aiBusy=false;adjustState.microRunActive=false;adjustState.microRunId='';adjustState.microRunStartedAt=0;adjustState.microRunHeartbeatAt=0;adjustState.microRunAcknowledgedAt=0;adjustState.microRunStatus='idle';adjustState.microRunSessionId='';v275MicroRunPromise=null;};

window.adjustSnapshot=function(label){const s=adjustSnapshotV137(label);s.autoSelectColor=false;s.protectedSnapshots=JSON.parse(JSON.stringify(adjustState.protectedSnapshots||{}));s.selectedDetectedRegionIds=[...(adjustState.selectedDetectedRegionIds||[])];s.quickTaskType=adjustState.quickTaskType||'';s.autoExecuteMode=!!adjustState.autoExecuteMode;return s;};
window.adjustRestoreSnapshot=function(s){adjustRestoreSnapshotV137(s);adjustState.autoSelectColor=false;adjustState.protectedSnapshots=JSON.parse(JSON.stringify(s&&s.protectedSnapshots||{}));adjustState.selectedDetectedRegionIds=[...(s&&s.selectedDetectedRegionIds||[])];adjustState.quickTaskType=s&&s.quickTaskType||'';adjustState.autoExecuteMode=!!(s&&s.autoExecuteMode);renderAdjustView();};

function adjustBindBrushCanvas(c){if(!c||c.__adjustBrushBound)return;c.__adjustBrushBound=true;const start=e=>{if(!adjustState.img||adjustState.previewOriginal||adjustState.aiBusy)return;e.preventDefault();c.setPointerCapture&&c.setPointerCapture(e.pointerId);const p=adjustCanvasPoint(c,e);adjustState.drawing=true;adjustState.currentStroke={brushId:adjustState.activeBrush,tool:adjustState.brushTool,size:p.size,points:[{x:p.x,y:p.y}]};adjustState.strokes.push(adjustState.currentStroke);adjustRenderCanvas();};const move=e=>{if(!adjustState.drawing||!adjustState.currentStroke)return;e.preventDefault();const p=adjustCanvasPoint(c,e),pts=adjustState.currentStroke.points,last=pts[pts.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>.002){pts.push({x:p.x,y:p.y});adjustRenderCanvas();}};const end=e=>{if(!adjustState.drawing)return;e.preventDefault();adjustState.drawing=false;adjustState.currentStroke=null;adjustPushHistory(adjustState.brushTool==='eraser'?'擦除标注':'添加'+adjustBrushDef(adjustState.activeBrush).label+'标注');adjustRefreshBrushSummary();setActionStatus('success','标注已保留在当前颜色，可自行选择其他画笔',false);};c.addEventListener('pointerdown',start);c.addEventListener('pointermove',move);c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end);c.addEventListener('pointerleave',e=>{if(e.buttons===0)end(e);});}

function adjustQuickTaskHtml(){const current=adjustState.quickTaskType||'';return `<section class="adjust-quick-task"><div class="adjust-quick-task-head"><div><h3>任务类型快捷入口</h3><p>先选择修改类型，系统自动设置颜色、模板、Mask 参数、候选数量与依赖关系。</p></div><span class="wf-status-chip ${current?'ok':'wait'}">${current?'已选择：'+esc(ADJUST_V138_QUICK_TASKS[current].label):'尚未选择任务'}</span></div><div class="adjust-quick-task-grid">${Object.entries(ADJUST_V138_QUICK_TASKS).map(([id,x])=>`<button type="button" class="adjust-quick-task-btn ${current===id?'on':''}" data-adj-quick-task="${id}"><b>${esc(x.label)}</b><span>${esc(x.desc)}</span></button>`).join('')}</div><div class="adjust-auto-confirm"><div><b>自动执行确认模式</b><div class="hint">自动识别区域、推荐参数并启动顺序队列；你只需逐项选择满意候选。</div></div><button class="btn btn-violet" data-adj-auto-execute ${adjustState.img&&!adjustState.aiBusy?'':'disabled'}>${adjustState.autoExecuteMode?'重新启动自动流程':'开始自动流程'}</button></div></section>`;}

function adjustProtectionHtml(){const snaps=adjustState.protectedSnapshots||{},items=Object.entries(snaps);return `<div class="adjust-protection"><div class="adjust-protection-head"><div><h4>区域保护快照</h4><p>确认候选后自动锁定成果；后续候选若改动保护区域会立即提示。</p></div><span class="wf-status-chip ${items.length?'ok':'wait'}">已保护 ${items.length} 个区域</span></div>${items.length?`<div class="adjust-protection-list">${items.map(([id,s])=>`<div class="adjust-protection-item" style="--protect-color:${adjustBrushDef(id).color}"><span class="adjust-protection-dot"></span><div><b>${esc(adjustBrushDef(id).label)}</b><small>${esc(s.time||'')} · ${esc(s.instruction||'已确认结果')}</small></div><div class="adjust-protection-actions"><button class="mini-btn" data-adj-protect-restore="${id}">恢复保护区</button><button class="mini-btn" data-adj-protect-remove="${id}">解除</button></div></div>`).join('')}</div>`:'<div class="hint" style="margin-top:7px">尚无保护快照。选用某个区域候选后会自动创建。</div>'}${adjustState.protectionWarnings&&adjustState.protectionWarnings.length?`<div class="adjust-protection-warning">最近检测：${adjustState.protectionWarnings.map(x=>`${esc(adjustBrushDef(x.id).label)}变化 ${x.change}%`).join('；')}。可在上方恢复对应保护区域。</div>`:''}</div>`;}

window.adjustWorkspaceHtml=function(){let html=adjustWorkspaceHtmlV137();html=html.replace(/图片微调 · V13\.7/g,'图片微调 · V14').replace(/支持保护强度、问题自动重试、区域图层、自动保存恢复与单任务专注模式。/g,'支持保护快照、滑动对比批注、区域拆分合并、轻量项目与自动执行确认。');html=html.replace(/<div class="adjust-auto-row"><label><input type="checkbox" data-adj-auto-color[\s\S]*?<\/label><span>([^<]*)<\/span><\/div>/,`<div class="adjust-auto-row adjust-manual-color-note"><strong>画笔不会自动切换颜色，请按需手动选择。</strong><span>$1</span></div>`);html=html.replace('<div class="adjust-shell">',adjustQuickTaskHtml()+'<div class="adjust-shell">');html=html.replace('<div class="adjust-advanced-wrap"',adjustProtectionHtml()+'<div class="adjust-advanced-wrap"');return html;};

function adjustAddDetectedBox(id,r,regionId){const x=Math.max(0,Math.min(1,Number(r.x)||0)),y=Math.max(0,Math.min(1,Number(r.y)||0)),w=Math.max(.02,Math.min(1-x,Number(r.width)||.2)),h=Math.max(.02,Math.min(1-y,Number(r.height)||.15)),rows=Math.max(4,Math.min(18,Math.round(h*28))),size=Math.max(.008,Math.min(.04,h/Math.max(3,rows)*1.2));for(let i=0;i<rows;i++){const yy=y+h*(i+.5)/rows;adjustState.strokes.push({brushId:id,tool:'brush',size,regionId:regionId||'',points:[{x,y:yy},{x:x+w,y:yy}]});}}

async function adjustAutoDetectRegions(){if(adjustState.recognitionBusy||adjustState.aiBusy)return false;if(!adjustState.img){setActionStatus('error','请先上传需要分析的图片',false);return false;}adjustState.recognitionBusy=true;adjustState.aiStatus='视觉模型正在识别文字、产品、背景、人物和装饰元素…';adjustState.aiStatusType='run';renderAdjustView();try{const src=adjustCanvasDataUrl('clean'),prompt=`分析这张电商图片中适合局部修改的视觉区域。只输出严格 JSON：{"regions":[{"type":"text|product|background|person|decoration","label":"区域名称","x":0到1,"y":0到1,"width":0到1,"height":0到1,"confidence":0到1,"template":"remove-text|replace-content|adjust-color|move-subject|enhance-material","suggestedInstruction":"简短中文修改建议"}]}。坐标为相对整图的左上角和宽高。最多返回5个最主要且互不重复的区域；不要输出 markdown。`,raw=await apiVisionJson(src,prompt),obj=adjustParseStrictJson(raw),regions=Array.isArray(obj.regions)?obj.regions.slice(0,5):[];if(!regions.length)throw new Error('视觉模型未返回可用区域');const colors=adjustRegionColorOrder(regions);adjustState.strokes=[];adjustState.brushes=adjustDefaultBrushes();adjustState.selectedDetectedRegionIds=[];adjustState.detectedRegions=regions.map((r,i)=>Object.assign({},r,{id:'dr_'+Date.now()+'_'+i,brushId:colors[i]}));adjustState.detectedRegions.forEach(r=>{const tpl=ADJUST_TEMPLATES.find(t=>t.id===r.template)?r.template:(r.type==='text'?'remove-text':r.type==='background'?'adjust-color':r.type==='product'?'enhance-material':r.type==='person'?'move-subject':'replace-content');adjustAddDetectedBox(r.brushId,r,r.id);adjustState.brushes[r.brushId].template=tpl;adjustState.brushes[r.brushId].prompt=String(r.suggestedInstruction||ADJUST_TEMPLATES.find(t=>t.id===tpl)?.text||'').trim();});adjustState.activeBrush=colors[0]||'red';adjustState.guideStep=2;adjustPushHistory('视觉模型自动识别修改区域');adjustRecommendParameters();adjustState.aiStatus=`已识别 ${regions.length} 个初始区域，可拆分、合并或继续用画笔修正。`;adjustState.aiStatusType='done';setActionStatus('success','视觉区域识别完成，已生成初始 Mask',false);return true;}catch(e){adjustState.aiStatus='区域识别失败：'+e.message;adjustState.aiStatusType='bad';setActionStatus('error','自动识别修改区域失败：'+e.message,false);return false;}finally{adjustState.recognitionBusy=false;if(curView==='adjust')renderAdjustView();}}

function adjustDetectPanelHtml(){const rs=adjustState.detectedRegions||[],sel=new Set(adjustState.selectedDetectedRegionIds||[]);return `<div class="adjust-detect-panel"><div class="adjust-detect-head"><div><b>自动识别修改区域</b><div class="hint">识别后可将大区域拆分，或选择多个相邻区域合并为同一颜色任务。</div></div><button class="mini-btn" data-adj-auto-detect ${adjustState.img&&!adjustState.recognitionBusy?'':'disabled'}>${adjustState.recognitionBusy?'识别中…':'视觉识别区域'}</button></div>${rs.length?`<div class="adjust-detect-list">${rs.map((r,i)=>`<div class="adjust-detect-item" style="--region-color:${adjustBrushDef(r.brushId).color}"><input type="checkbox" data-adj-region-select="${esc(r.id||String(i))}" ${sel.has(r.id||String(i))?'checked':''}><span class="dot"></span><div><b>${esc(r.label||r.type||('区域'+(i+1)))}</b><small>${esc(adjustBrushDef(r.brushId).label)} · ${Math.round(Number(r.confidence||0)*100)}% · ${Math.round((r.width||0)*100)}×${Math.round((r.height||0)*100)}%</small></div><button class="mini-btn" data-adj-region-split="${esc(r.id||String(i))}">拆分</button></div>`).join('')}</div><div class="adjust-detect-tools"><button class="mini-btn" data-adj-region-merge ${sel.size>=2?'':'disabled'}>合并所选区域</button><button class="mini-btn" data-adj-region-clear-select ${sel.size?'':'disabled'}>清空选择</button></div>`:''}</div>`;}

function adjustFindDetectedRegion(id){return (adjustState.detectedRegions||[]).find(r=>String(r.id)===String(id));}
function adjustRemoveRegionStrokes(regionIds){const set=new Set(regionIds);adjustState.strokes=adjustState.strokes.filter(s=>!set.has(s.regionId));}
function adjustSplitDetectedRegion(id){const r=adjustFindDetectedRegion(id);if(!r)return;adjustRemoveRegionStrokes([id]);const vertical=(Number(r.width)||0)>=(Number(r.height)||0),a=Object.assign({},r,{id:id+'_a',label:(r.label||'区域')+' A'}),b=Object.assign({},r,{id:id+'_b',label:(r.label||'区域')+' B'});if(vertical){a.width=(r.width||.2)/2;b.x=(r.x||0)+a.width;b.width=a.width;}else{a.height=(r.height||.2)/2;b.y=(r.y||0)+a.height;b.height=a.height;}const idx=adjustState.detectedRegions.indexOf(r);adjustState.detectedRegions.splice(idx,1,a,b);adjustAddDetectedBox(a.brushId,a,a.id);adjustAddDetectedBox(b.brushId,b,b.id);adjustState.selectedDetectedRegionIds=[];adjustPushHistory('拆分自动识别区域');renderAdjustView();setActionStatus('success','已将大区域拆分为两个可独立修正的小区域',false);}
function adjustMergeDetectedRegions(){const ids=adjustState.selectedDetectedRegionIds||[];if(ids.length<2){setActionStatus('error','请至少选择两个区域',false);return;}const rs=ids.map(adjustFindDetectedRegion).filter(Boolean);if(rs.length<2)return;const x=Math.min(...rs.map(r=>Number(r.x)||0)),y=Math.min(...rs.map(r=>Number(r.y)||0)),x2=Math.max(...rs.map(r=>(Number(r.x)||0)+(Number(r.width)||0))),y2=Math.max(...rs.map(r=>(Number(r.y)||0)+(Number(r.height)||0))),first=rs[0],merged={id:'dr_merge_'+Date.now(),type:first.type||'custom',label:rs.map(r=>r.label||r.type).join(' + '),x,y,width:Math.min(1-x,x2-x),height:Math.min(1-y,y2-y),confidence:Math.min(...rs.map(r=>Number(r.confidence)||0)),template:first.template,brushId:first.brushId,suggestedInstruction:rs.map(r=>r.suggestedInstruction).filter(Boolean).join('；')};adjustRemoveRegionStrokes(ids);adjustState.detectedRegions=adjustState.detectedRegions.filter(r=>!ids.includes(String(r.id)));adjustState.detectedRegions.push(merged);adjustAddDetectedBox(merged.brushId,merged,merged.id);adjustState.selectedDetectedRegionIds=[];adjustState.activeBrush=merged.brushId;adjustPushHistory('合并自动识别区域');renderAdjustView();setActionStatus('success','已将所选区域合并为同一颜色任务',false);}

async function adjustProtectedChange(beforeSrc,resultSrc,maskSrc){try{const [a,b,m]=await Promise.all([adjustLoadImageObject(beforeSrc),adjustLoadImageObject(resultSrc),adjustLoadImageObject(maskSrc)]),size=192,c=document.createElement('canvas');c.width=size;c.height=size;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(a,0,0,size,size);const A=x.getImageData(0,0,size,size).data;x.clearRect(0,0,size,size);x.drawImage(b,0,0,size,size);const B=x.getImageData(0,0,size,size).data;x.clearRect(0,0,size,size);x.drawImage(m,0,0,size,size);const M=x.getImageData(0,0,size,size).data;let diff=0,n=0;for(let i=0;i<M.length;i+=4){if(M[i]<80)continue;diff+=Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]);n+=3;}return Number((n?diff/n/255*100:0).toFixed(1));}catch(e){return 0;}}
async function adjustCheckProtectedBatch(beforeSrc,resultSrc,editingIds){const skips=new Set(editingIds||[]),out=[];for(const [id,s] of Object.entries(adjustState.protectedSnapshots||{})){if(skips.has(id)||!s.maskSrc)continue;const change=await adjustProtectedChange(beforeSrc,resultSrc,s.maskSrc);if(change>3.5)out.push({id,change});}return out;}

function adjustRankCandidates(items,ids){const prefs=adjustLoadPreferences(),key=adjustPreferenceType(ids),p=prefs[key];items.forEach((it,i)=>{const q=it.quality||{},history=p&&p.count?Math.max(-8,8-(Math.abs((q.outside||0)-p.outside)*.7+Math.abs((q.edge||0)-p.edge)*.12+Math.abs((q.shift||0)-p.shift)*.9)):0,neg=p&&p.negative||{},annotationPenalty=(neg.text||0)*Math.min(4,(q.edge||0)/18)+(neg.background||0)*Math.min(4,(q.outside||0)/4)+(neg.shift||0)*Math.min(4,(q.shift||0)/2),protectionPenalty=(it.protectedChanges||[]).reduce((s,x)=>s+Math.min(20,x.change*2),0),regressionPenalty=it.regression?.status==='failed'?35:it.regression?.status==='warning'?8:0;it.rankScore=Math.round((q.score||0)+history-annotationPenalty-protectionPenalty-regressionPenalty);it.rankReason=regressionPenalty?'AI 修改指令回归检测未完全通过，已降低排序':protectionPenalty?'已因保护区域变化降低排序':p&&p.count?'结合本地质量与 '+p.count+' 次历史选择/批注':'按未标注区稳定、边缘与主体位移排序';it.originalIndex=i;it.annotations=it.annotations||[];});items.sort((a,b)=>b.rankScore-a.rankScore);items.forEach((it,i)=>it.rank=i+1);return items;}
function adjustRecordCandidateAnnotation(ids,reason){const prefs=adjustLoadPreferences(),key=adjustPreferenceType(ids),p=prefs[key]||{count:0,outside:0,edge:0,shift:0};p.negative=p.negative||{text:0,background:0,shift:0};p.negative[reason]=(p.negative[reason]||0)+1;prefs[key]=p;try{localStorage.setItem(ADJUST_PREFERENCE_KEY,JSON.stringify(prefs));}catch(e){}}

async function adjustPrepareMicroBaseV280(){
  const api=window.MicroEditBaseSessionV280||window.MicroEditBaseSessionV279;
  const resolved=api?.resolveBase?api.resolveBase(adjustState,adjustState.microBaseMode):{mode:adjustState.microBaseMode||'current',source:adjustState.microBaseMode==='original'&&adjustState.originalSrc?adjustState.originalSrc:adjustState.src,isOriginal:adjustState.microBaseMode==='original'&&!!adjustState.originalSrc};
  if(!resolved.isOriginal||!resolved.source||resolved.source===adjustState.src)return{resolved,restore:null};
  const restore={src:adjustState.src,name:adjustState.name,img:adjustState.img,settings:adjustState.settings,rotate:adjustState.rotate,flipX:adjustState.flipX,flipY:adjustState.flipY,crop:adjustState.crop};
  try{
    adjustState.src=resolved.source;adjustState.name=resolved.name;adjustState.img=await adjustLoadImageObject(resolved.source);
    adjustState.settings=Object.assign({},ADJUST_DEFAULTS);adjustState.rotate=0;adjustState.flipX=1;adjustState.flipY=1;adjustState.crop='original';
    return{resolved,restore};
  }catch(error){
    adjustState.src=restore.src;adjustState.name=restore.name;adjustState.img=restore.img;adjustState.settings=restore.settings;adjustState.rotate=restore.rotate;adjustState.flipX=restore.flipX;adjustState.flipY=restore.flipY;adjustState.crop=restore.crop;
    throw error;
  }
}
function adjustRestoreMicroBaseV280(ctx){
  const r=ctx&&ctx.restore;if(!r)return;
  adjustState.src=r.src;adjustState.name=r.name;adjustState.img=r.img;adjustState.settings=r.settings;adjustState.rotate=r.rotate;adjustState.flipX=r.flipX;adjustState.flipY=r.flipY;adjustState.crop=r.crop;
}
async function adjustGenerateCandidates(colorIds,opts={}){
  const microApi=window.__V27_MICRO_API__||window.__V24_MICRO_API__||window.__V23_MICRO_API__;
  const micro=!!(microApi&&microApi.isGenerationActive&&microApi.isGenerationActive());
  const meter=micro?adjustMicroMeter():null;
  const requestedRunId=String(opts.microRunId||microApi?.diagnostics?.()?.generationId||'');
  const requestedSessionId=String(opts.microRunSessionId||meter?.snapshot?.()?.sessionId||'');
  if(adjustState.aiBusy){
    const error=adjustMicroRunError('上一项图片微调仍在运行，本次未重复提交。','micro_generation_busy');
    if(micro)adjustMicroRunEvent('v275-micro-generation-handoff',{status:'rejected-busy',generationId:requestedRunId,sessionId:requestedSessionId});
    return{ok:false,busy:true,error,message:error.message};
  }
  if(!adjustState.img){const error=adjustMicroRunError('请先上传图片','micro_generation_no_image');setActionStatus('error',error.message,false);return{ok:false,error,message:error.message};}
  const ids=(colorIds||[]).filter(id=>adjustColorStrokeCount(id)>0&&String(adjustState.brushes[id]&&adjustState.brushes[id].prompt||'').trim());
  if(!ids.length){const error=adjustMicroRunError('所选颜色需要同时有画笔区域和修改指令','micro_generation_no_instruction');setActionStatus('error',error.message,false);return{ok:false,error,message:error.message};}
  const count=micro?1:Math.max(2,Math.min(4,adjustState.candidateCount));
  let succeeded=false,failure=null;
  if(micro){
    const now=Date.now();
    adjustState.microRunActive=true;
    adjustState.microRunId=requestedRunId||adjustState.microRunId||`micro_${now}`;
    adjustState.microRunSessionId=requestedSessionId;
    adjustState.microRunStartedAt=adjustState.microRunStartedAt||now;
    adjustState.microRunAcknowledgedAt=now;
    adjustTouchMicroRun('compress',{regionCount:ids.length});
    meter?.endPhase?.('sync');
    meter?.annotate?.({generationId:adjustState.microRunId,sessionId:requestedSessionId,handoffStatus:'accepted',directBridge:opts.directBridge||''});
    adjustMicroRunEvent('v275-micro-generation-started',{generationId:adjustState.microRunId,sessionId:requestedSessionId,regionCount:ids.length});
  }
  adjustState.aiBusy=true;
  adjustState.aiStatus=micro?`正在以${adjustMicroBaseLabel?.()||'当前结果'}为基图，合并目标布局、Mask 与文字参考，并上传…`:`正在以${adjustMicroBaseLabel?.()||'当前结果'}为基图生成 ${count} 个候选结果并执行质量、保护区域与 AI 指令回归检查…`;
  adjustState.aiStatusType='run';
  adjustState.candidateBatch=null;
  renderAdjustView();
  let microBaseCtx=null;
  try{
    microBaseCtx=await adjustPrepareMicroBaseV280();
    if(microBaseCtx?.resolved?.isOriginal){
      adjustState.aiStatus='正在以识别原图作为本次微调基图（不继承上一轮结果）…';
      renderAdjustView();
    }
    // V27.9: syncMs ends only after the direct generation handler acknowledges the run. This
    // exposes the formerly hidden region->adjust handoff and prevents an endless preflight-only UI.
    if(meter)meter.startPhase('compress');
    const source=adjustCanvasDataUrl('clean');
    const layoutGuide=typeof adjustTargetLayoutGuideDataUrl==='function'?adjustTargetLayoutGuideDataUrl(ids):'';
    const combinedMask=adjustMaskDataUrl(ids);
    const textRefs=typeof adjustTextFidelityReferenceDataUrls==='function'?adjustTextFidelityReferenceDataUrls(ids):[];
    let marked=micro?'':adjustCanvasDataUrl('marked',ids);
    const prompt=adjustBuildAiPrompt(ids,{hasTargetLayoutGuide:!!layoutGuide,referencePlan:'fast-v280'});
    const tasks=typeof adjustRegionTasksForBrushes==='function'?adjustRegionTasksForBrushes(ids):[];
    const size=await loadImageSize(source);
    const aspect=ratioToAspect(size.w,size.h);
    const reg=window.RegionGenerationRegressionV273||window.RegionGenerationRegression;
    const transport=window.MicroImageTransportV276||window.MicroImageTransportV275||window.MicroImageTransportV274||window.MicroImageTransportV2731;
    const fast=transport&&typeof transport.prepareFastReferenceSet==='function'
      ?await transport.prepareFastReferenceSet({source,layoutGuide,mask:combinedMask,extraRefs:textRefs})
      :{version:'fallback',referencePlan:'fallback-v280',refs:[source,layoutGuide||combinedMask,...textRefs.map(x=>x.src)].filter(Boolean).slice(0,10),items:[],beforeBytes:0,afterBytes:0,referenceCount:[source,layoutGuide||combinedMask,...textRefs.map(x=>x.src)].filter(Boolean).length,mergedGuide:false,extraReferenceCount:textRefs.length,uploadConcurrencyTarget:2};
    if(meter){meter.endPhase('compress');meter.setReferenceStats(fast);}
    if(micro)adjustTouchMicroRun('references-ready',{referenceCount:fast.referenceCount,beforeBytes:fast.beforeBytes,afterBytes:fast.afterBytes});
    if(!micro&&marked)adjustState.lastMarkedSrc=marked;
    if(micro)adjustState.aiStatus=`参考图已合并为 ${fast.referenceCount} 张（${Math.max(1,Math.round(fast.beforeBytes/1024))}KB → ${Math.max(1,Math.round(fast.afterBytes/1024))}KB），正在双路并发上传并生成…`;

    const expectation=reg?reg.createExpectation(tasks,prompt,{source:'adjust-generation'}):null;
    const bridgeCheck=reg?reg.verifyBridge(expectation,tasks,prompt):{ok:true,issues:[]};
    if(!bridgeCheck.ok)throw new Error('AI 修改指令回归前检失败：'+bridgeCheck.issues.join('；'));

    let results;
    if(micro){adjustTouchMicroRun('provider-request');results=await apiImageEditMulti(prompt,'',fast.refs,1,aspect);}
    else{
      try{results=await apiImageEditMulti(prompt,'',fast.refs,count,aspect);}
      catch(e1){
        try{results=await apiImageEditNativeMask(prompt,'',source,combinedMask,count,aspect);}
        catch(e2){results=await apiImageEditMulti(prompt,'',[source,...(layoutGuide?[layoutGuide]:[])],count,aspect);}
      }
    }
    if(!Array.isArray(results)||!results.length)throw new Error('微调接口未返回可用图片');

    if(meter)meter.startPhase('result');
    if(micro)adjustTouchMicroRun('result-loading',{resultCount:results.length});
    // The API may return only a remote URL. Wait until the first result can actually be decoded
    // by the browser, so resultMs/clickToImageMs represent visible pixels rather than JSON arrival.
    const displayReady=micro?await adjustWaitResultDisplayReady(results[0],30000):{ready:true,reason:'non-micro'};
    // Publish returned pixels before local quality/regression work. Marked preview serialization and
    // post checks stay after image-ready and therefore cannot inflate click-to-image time.
    adjustState.candidateBatch={ids,beforeSrc:source,targetLayoutGuideSrc:layoutGuide,markedSrc:marked,maskSrc:combinedMask,prompt,regressionExpectation:expectation,bridgeCheck,queue:!!opts.queue,pendingChecks:true,transportStats:fast,displayReady,performance:meter?.snapshot?.()||null,results:results.map((src,i)=>({src,rank:i+1,rankScore:null,quality:{score:null,level:'checking',outside:0,edge:0,shift:0,messages:['图片已返回，正在进行本地质量与回归检查']},protectedChanges:[],regression:{available:false,status:'checking',pass:true,message:'回归检测中'},annotations:[]}))};
    adjustState.aiStatus='图片已返回，正在后台完成本地质量 / 保护区域 / AI 指令回归检查…';
    adjustState.aiStatusType='run';
    try{if(typeof window.__V225_PUBLISH_MICRO_ADJUST_BATCH__==='function')window.__V225_PUBLISH_MICRO_ADJUST_BATCH__('image-ready-checking');}catch(_e){}
    if(curView==='adjust')renderAdjustView();
    if(meter){
      meter.markImageReady({referenceCount:fast.referenceCount,referencePlan:fast.referencePlan,displayReady:displayReady.ready===true,displayReadyReason:displayReady.reason||''});
      adjustState.candidateBatch.performance=meter.snapshot();
      try{window.__V225_PUBLISH_MICRO_ADJUST_BATCH__?.('image-ready-performance');}catch(_e){}
      meter.startPhase('postCheck');
    }
    if(micro)adjustTouchMicroRun('post-check');

    if(!marked){
      marked=adjustCanvasDataUrl('marked',ids);
      adjustState.lastMarkedSrc=marked;
      if(adjustState.candidateBatch)adjustState.candidateBatch.markedSrc=marked;
    }
    const checks=await Promise.all(results.map(src=>adjustQualityCheck(source,src,combinedMask)));
    const protects=await Promise.all(results.map(src=>adjustCheckProtectedBatch(source,src,ids)));
    const regressions=reg&&tasks.length
      ?await Promise.all(results.map(async src=>{try{return await reg.analyzeImages(source,src,tasks);}catch(e){return{available:false,status:'warning',pass:true,message:'回归检测暂不可用：'+e.message};}}))
      :results.map(()=>({available:false,status:'unavailable',pass:true,message:'无结构化区域任务'}));
    const ranked=adjustRankCandidates(results.map((src,i)=>({src,quality:checks[i],protectedChanges:protects[i],regression:regressions[i],annotations:[]})),ids);
    const failed=ranked.filter(x=>x.regression?.status==='failed');
    if(meter)meter.complete({regressionFailed:failed.length,resultCount:results.length});
    adjustState.candidateBatch={ids,beforeSrc:source,targetLayoutGuideSrc:layoutGuide,markedSrc:marked,maskSrc:combinedMask,prompt,regressionExpectation:expectation,bridgeCheck,queue:!!opts.queue,pendingChecks:false,transportStats:fast,displayReady,performance:meter?.snapshot?.()||null,results:ranked};
    adjustState.aiStatus=failed.length?`已生成 ${results.length} 个结果，但 ${failed.length} 个未通过 AI 修改指令回归检测；请核对结果，不会自动重复计费生成。`:`已生成 ${results.length} 个结果，AI 修改指令回归检测已完成。`;
    adjustState.aiStatusType=failed.length?'bad':'done';
    if(opts.queue){adjustState.queueAwaiting=true;adjustState.queueStatus[ids[0]]='waiting';}
    try{window.dispatchEvent(new CustomEvent('v273-region-regression',{detail:{expectation,bridgeCheck,failed:failed.length,total:results.length,status:failed.length?'failed':'passed',results:ranked.map(x=>x.regression)}}));}catch(_e){}
    try{if(typeof window.__V225_PUBLISH_MICRO_ADJUST_BATCH__==='function')window.__V225_PUBLISH_MICRO_ADJUST_BATCH__('checks-complete');}catch(_e){}
    setActionStatus(failed.length?'warning':'success',failed.length?'生成完成，但检测到 AI 修改指令可能未落实，请查看回归提示':'图片已返回并完成本地质量、保护区域与 AI 修改指令回归检查',false);
    succeeded=true;
    if(micro)adjustTouchMicroRun('complete',{resultCount:results.length});
    return{ok:true,resultCount:results.length,results,performance:meter?.snapshot?.()||null};
  }catch(err){
    failure=err;
    try{meter?.fail?.(err);}catch(_e){}
    adjustState.aiStatus='生成失败：'+err.message;
    adjustState.aiStatusType='bad';
    if(opts.queue&&ids[0])adjustState.queueStatus[ids[0]]='failed';
    if(micro)adjustTouchMicroRun('failed',{error:String(err?.message||err)});
    setActionStatus('error','AI 局部编辑失败：'+err.message,false);
    return{ok:false,error:err,message:String(err?.message||err)};
  }finally{
    adjustRestoreMicroBaseV280(microBaseCtx);
    adjustState.aiBusy=false;
    if(micro&&(!requestedRunId||adjustState.microRunId===requestedRunId)){
      adjustState.microRunActive=false;
      adjustState.microRunStatus=succeeded?'complete':'failed';
      adjustState.microRunHeartbeatAt=Date.now();
      adjustMicroRunEvent('v275-micro-generation-settled',{generationId:adjustState.microRunId,sessionId:adjustState.microRunSessionId,status:adjustState.microRunStatus,error:failure?String(failure?.message||failure):''});
    }
    if(curView==='adjust')renderAdjustView();
  }
}
async function adjustConfirmCandidateApply(index){const b=adjustState.candidateBatch,item=b&&b.results&&b.results[index];if(!b||!item)return;adjustCreateProtectionSnapshots(b,item.src);const entry={id:'ae_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),time:new Date().toLocaleString('zh-CN'),label:b.ids.length===1?adjustBrushDef(b.ids[0]).label+'候选确认':'多区域候选确认',colorIds:b.ids,prompt:b.prompt,beforeSrc:b.beforeSrc,markedSrc:b.markedSrc,resultSrc:item.src,payload:adjustInstructionPayload(b.ids),quality:item.quality,annotations:item.annotations||[],protectedChanges:item.protectedChanges||[]};adjustAddEditHistory(entry);adjustRecordPreference(b.ids,item.quality);adjustState.lastResultSrc=item.src;adjustState.protectionWarnings=item.protectedChanges||[];b.ids.forEach(id=>{adjustState.strokes=adjustState.strokes.filter(s=>s.brushId!==id);if(adjustState.queueRunning)adjustState.queueStatus[id]='confirmed';});adjustState.candidateBatch=null;adjustState.queueAwaiting=false;await adjustUseDataUrl(item.src,(adjustState.name||'image').replace(/\.[^.]+$/,'')+'-ai-edit.png',true);adjustState.aiStatus=adjustState.queueRunning?(adjustState.autoExecuteMode?'已确认，自动进入下一项。':'已确认当前区域结果，请点击“继续下一项”。'):'候选结果已确认并作为当前底图。';adjustState.aiStatusType='done';if(adjustState.queueRunning)adjustState.queueIndex++;renderAdjustView();setActionStatus('success','已确认候选并创建区域保护快照',false);if(adjustState.queueRunning&&adjustState.autoExecuteMode)setTimeout(()=>adjustQueueNext(),250);}
async function adjustConfirmCandidate(index){const b=adjustState.candidateBatch,item=b&&b.results&&b.results[index];if(!item)return;const risks=item.protectedChanges||[];if(risks.length){confirmDialog(`该候选可能改变已保护区域：${risks.map(x=>adjustBrushDef(x.id).label+' '+x.change+'%').join('、')}。仍然选用吗？选用后可在“区域保护快照”恢复。`,()=>adjustConfirmCandidateApply(index));return;}return adjustConfirmCandidateApply(index);}

async function adjustRestoreProtectedArea(id){const s=adjustState.protectedSnapshots&&adjustState.protectedSnapshots[id];if(!s||!s.resultSrc||!s.maskSrc){setActionStatus('error','该保护快照数据不完整',false);return;}setActionStatus('loading','正在恢复 '+adjustBrushDef(id).label+'…',true);try{const current=adjustCanvasDataUrl('clean'),[cur,old,mask]=await Promise.all([adjustLoadImageObject(current),adjustLoadImageObject(s.resultSrc),adjustLoadImageObject(s.maskSrc)]),c=document.createElement('canvas');c.width=cur.naturalWidth||cur.width;c.height=cur.naturalHeight||cur.height;const ctx=c.getContext('2d');ctx.drawImage(cur,0,0,c.width,c.height);const layer=document.createElement('canvas');layer.width=c.width;layer.height=c.height;const lx=layer.getContext('2d',{willReadFrequently:true});lx.drawImage(old,0,0,c.width,c.height);const oldData=lx.getImageData(0,0,c.width,c.height);lx.clearRect(0,0,c.width,c.height);lx.drawImage(mask,0,0,c.width,c.height);const md=lx.getImageData(0,0,c.width,c.height).data;for(let i=0;i<oldData.data.length;i+=4)oldData.data[i+3]=md[i];lx.putImageData(oldData,0,0);ctx.drawImage(layer,0,0);const out=c.toDataURL('image/png');await adjustUseDataUrl(out,(adjustState.name||'image').replace(/\.[^.]+$/,'')+'-protected-restored.png',true);adjustState.protectionWarnings=(adjustState.protectionWarnings||[]).filter(x=>x.id!==id);renderAdjustView();setActionStatus('success',adjustBrushDef(id).label+'已从保护快照恢复',false);}catch(e){setActionStatus('error','恢复保护区域失败：'+e.message,false);}}

function adjustProjectPayload(mode='full'){const light=mode==='light',masks={};if(light&&adjustState.img)ADJUST_BRUSH_DEFS.forEach(b=>{if(adjustColorStrokeCount(b.id))masks[b.id]=adjustMaskDataUrl([b.id]);});return{schema:'ai_image_adjustment_project_v138',version:'V14',saveMode:light?'light':'full',exportedAt:new Date().toISOString(),image:{src:adjustState.src,name:adjustState.name,originalSrc:adjustState.originalSrc,originalName:adjustState.originalName},masks,state:{settings:adjustState.settings,rotate:adjustState.rotate,flipX:adjustState.flipX,flipY:adjustState.flipY,crop:adjustState.crop,format:adjustState.format,quality:adjustState.quality,brushes:adjustState.brushes,activeBrush:adjustState.activeBrush,brushSize:adjustState.brushSize,brushTool:adjustState.brushTool,strokes:adjustState.strokes,showAnnotations:adjustState.showAnnotations,exportAnnotations:adjustState.exportAnnotations,autoSelectColor:false,simpleMode:adjustState.simpleMode,maskFeather:adjustState.maskFeather,maskExpand:adjustState.maskExpand,candidateCount:adjustState.candidateCount,queueOrder:adjustState.queueOrder,queueStatus:adjustState.queueStatus,dependencies:adjustState.dependencies,guideMode:adjustState.guideMode,guideStep:adjustState.guideStep,detectedRegions:adjustState.detectedRegions,paramRecommendation:adjustState.paramRecommendation,lastMarkedSrc:light?'':adjustState.lastMarkedSrc,lastResultSrc:adjustState.lastResultSrc,candidateBatch:light?null:adjustState.candidateBatch,editHistory:light?[]:adjustState.editHistory.slice(0,10),protectedSnapshots:light?{}:adjustState.protectedSnapshots,quickTaskType:adjustState.quickTaskType,autoExecuteMode:adjustState.autoExecuteMode}};}
function adjustOpenProjectSave(){if(!adjustState.img){setActionStatus('error','请先载入图片后再保存项目',false);return;}modalOpen(`<h3>保存微调项目</h3><p class="hint">选择项目文件体积与保存范围。</p><div class="adjust-project-choice"><div class="adjust-project-option"><h4>完整项目</h4><p>保存原图、全部候选、前后记录、保护快照、队列和全部参数，适合完整归档。</p><button class="btn btn-violet" data-adj-project-export="full">保存完整项目</button></div><div class="adjust-project-option"><h4>轻量项目</h4><p>仅保存原图/当前选中结果、Mask、画笔、指令与关键参数，不保存全部候选图片。</p><button class="btn btn-ghost" data-adj-project-export="light">保存轻量项目</button></div></div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-mclose>取消</button></div>`,true);}
function adjustExportProject(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v138-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'轻量项目已保存':'完整项目已保存',false);}
async function adjustImportProjectFile(file){if(!file)return;setActionStatus('loading','正在恢复微调项目…',true);try{const txt=await file.text(),p=JSON.parse(txt);if(!String(p.schema||'').startsWith('ai_image_adjustment_project_'))throw new Error('不是兼容的图片微调项目文件');if(!p.image||!p.image.src)throw new Error('项目文件缺少图片数据');adjustState.src=p.image.src;adjustState.name=p.image.name||'restored-image.png';adjustState.originalSrc=p.image.originalSrc||p.image.src;adjustState.originalName=p.image.originalName||adjustState.name;adjustState.img=await adjustLoadImageObject(adjustState.src);const s=p.state||{};adjustState.settings=Object.assign({},ADJUST_DEFAULTS,s.settings||{});['rotate','flipX','flipY','crop','format','quality','activeBrush','brushSize','brushTool','showAnnotations','exportAnnotations','simpleMode','maskFeather','maskExpand','candidateCount','guideMode','guideStep','paramRecommendation','lastMarkedSrc','lastResultSrc','quickTaskType','autoExecuteMode','ocrRecognitionMode','ocrLanguage'].forEach(k=>{if(s[k]!==undefined)adjustState[k]=s[k];});adjustState.autoSelectColor=false;adjustState.brushes=Object.assign(adjustDefaultBrushes(),s.brushes||{});adjustState.strokes=Array.isArray(s.strokes)?s.strokes:[];adjustState.queueOrder=Array.isArray(s.queueOrder)?s.queueOrder:ADJUST_BRUSH_DEFS.map(x=>x.id);adjustState.queueStatus=s.queueStatus||{};adjustState.dependencies=Object.assign({red:'',amber:'',green:'',blue:'',purple:''},s.dependencies||{});adjustState.detectedRegions=Array.isArray(s.detectedRegions)?s.detectedRegions:[];adjustState.selectedDetectedRegionIds=[];adjustState.candidateBatch=s.candidateBatch||null;adjustState.editHistory=Array.isArray(s.editHistory)?s.editHistory:[];adjustState.protectedSnapshots=s.protectedSnapshots||{};adjustState.editHistoryLoaded=true;adjustState.history=[];adjustState.historyIndex=-1;adjustState.projectLoadedAt=new Date().toLocaleString('zh-CN');adjustPushHistory('恢复微调项目');renderAdjustView();setActionStatus('success',`微调项目已恢复（${p.saveMode==='light'?'轻量':'完整'}模式）`,false);}catch(e){setActionStatus('error','项目恢复失败：'+e.message,false);}}

function adjustApplyQuickTask(id){const cfg=ADJUST_V138_QUICK_TASKS[id];if(!cfg)return;adjustState.quickTaskType=id;adjustState.activeBrush=cfg.brush;adjustState.brushTool='brush';const t=ADJUST_TEMPLATES.find(x=>x.id===cfg.template);adjustState.brushes[cfg.brush].template=cfg.template;adjustState.brushes[cfg.brush].prompt=t?t.text:'';const meta=ADJUST_REGION_TYPE_META[cfg.template]||ADJUST_REGION_TYPE_META.custom;adjustState.maskFeather=meta.feather;adjustState.maskExpand=meta.expand;adjustState.candidateCount=meta.count;adjustState.simpleMode=true;adjustState.guideMode=true;adjustState.guideStep=1;adjustState.paramRecommendation=`${cfg.label}：${adjustBrushDef(cfg.brush).label}，羽化 ${meta.feather}px，扩张 ${meta.expand}px，候选 ${meta.count} 个`;adjustAutoDependencies();renderAdjustView();requestAnimationFrame(()=>{const ta=document.querySelector(`[data-adj-brush-prompt="${cfg.brush}"]`);if(ta)ta.focus();});setActionStatus('success','已应用“'+cfg.label+'”快捷配置，请在图片上标记区域',false);}
async function adjustAutoExecuteStart(){if(!adjustState.img){setActionStatus('error','请先上传图片',false);return;}adjustState.autoExecuteMode=true;adjustState.simpleMode=true;adjustState.guideMode=true;let ok=true;if(!adjustUsableColorIds().length)ok=await adjustAutoDetectRegions();if(!ok)return;adjustRecommendParameters();adjustAutoDependencies();adjustApplyDependencyOrder(true);adjustState.guideStep=3;renderAdjustView();setTimeout(()=>adjustQueueStart(),120);setActionStatus('success','自动执行确认模式已启动：请逐项选择满意候选',false);}

main.addEventListener('click',e=>{if(curView!=='adjust')return;const q=e.target.closest('[data-adj-quick-task]');if(q){adjustApplyQuickTask(q.dataset.adjQuickTask);return;}if(e.target.closest('[data-adj-auto-execute]')){adjustAutoExecuteStart();return;}const split=e.target.closest('[data-adj-region-split]');if(split){adjustSplitDetectedRegion(split.dataset.adjRegionSplit);return;}if(e.target.closest('[data-adj-region-merge]')){adjustMergeDetectedRegions();return;}if(e.target.closest('[data-adj-region-clear-select]')){adjustState.selectedDetectedRegionIds=[];renderAdjustView();return;}const comp=e.target.closest('[data-adj-candidate-compare]');if(comp){adjustOpenCandidateCompare(Number(comp.dataset.adjCandidateCompare));return;}const note=e.target.closest('[data-adj-candidate-note]');if(note&&adjustState.candidateBatch){const [i,r]=note.dataset.adjCandidateNote.split('|'),item=adjustState.candidateBatch.results[Number(i)];if(item){item.annotations=item.annotations||[];const pos=item.annotations.indexOf(r);if(pos>=0)item.annotations.splice(pos,1);else{item.annotations.push(r);adjustRecordCandidateAnnotation(adjustState.candidateBatch.ids,r);}renderAdjustView();setActionStatus('success',pos>=0?'已取消候选批注':'批注已记录，将用于后续本地排序',false);}return;}const restore=e.target.closest('[data-adj-protect-restore]');if(restore){adjustRestoreProtectedArea(restore.dataset.adjProtectRestore);return;}const remove=e.target.closest('[data-adj-protect-remove]');if(remove){delete adjustState.protectedSnapshots[remove.dataset.adjProtectRemove];renderAdjustView();setActionStatus('success','已解除该区域保护',false);return;}});
main.addEventListener('change',e=>{if(curView!=='adjust')return;const rs=e.target.closest('[data-adj-region-select]');if(rs){const set=new Set(adjustState.selectedDetectedRegionIds||[]);rs.checked?set.add(rs.dataset.adjRegionSelect):set.delete(rs.dataset.adjRegionSelect);adjustState.selectedDetectedRegionIds=[...set];renderAdjustView();return;}});
document.addEventListener('click',e=>{const ex=e.target.closest('[data-adj-project-export]');if(ex){modalClose();adjustExportProject(ex.dataset.adjProjectExport);return;}const use=e.target.closest('[data-adj-compare-use]');if(use){modalClose();adjustConfirmCandidate(Number(use.dataset.adjCompareUse));return;}});
document.addEventListener('input',e=>{if(e.target.matches('[data-adj-compare-range]')){const ov=document.getElementById('adj-compare-overlay');if(ov)ov.style.width=e.target.value+'%';}});
