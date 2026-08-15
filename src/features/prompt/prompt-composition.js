function wirePromptQualityGuard(g){
  const f=structuredPosterJson(g.poster||'');
  return `【V14 生成前质量核验】
1. 只输出完成后的图片，不得在图片中出现规则、JSON、提示词、解释或字段名。
2. 主标题必须逐字使用：${f.mainTitle||'（缺失）'}。
3. 核心卖点必须逐字使用：${f.coreSellingPoint||'（缺失）'}。
4. 功能区必须逐字使用：${f.functionArea||'（缺失）'}。
5. 小标题按顺序使用：${[f.subtitle1,f.subtitle2,f.subtitle3].filter(Boolean).join('｜')||'（缺失）'}。
6. 完成替换后再次检查：原占位词全部消失，排版、色块、徽章、按钮、背景和尺寸保持原样。`;
}
function composeWirePrompt(g, idx){
  const linked=isPromptLinkedForGroup(g),a=ensureWireJsonState(g),parsed=parseTaskJsonText(a);
  const groupPayload=linked?(parsed||taskGroupJsonPayload(g,idx)):taskGroupJsonPayload(g,idx);
  const linkBlock=linked?`\n\n${copyMappingPromptGuide()}\n\n【V14 当前任务组精准替换 JSON（已确认同步）】\n${JSON.stringify(groupPayload,null,2)}\n\n${wirePromptQualityGuard(g)}`:'';
  return `${wf.builtin}${linkBlock}

【排版参考图】随附图片即为底图（基准），所有版式/线框/构图/颜色/元素均以它为准。
【海报文案】（需替换进底图对应文字位置的全部文字内容）：
${g.poster || ''}`;
}
function _composeWirePromptOld(g, idx){
  return `${wf.builtin}

【任务】根据排版参考图与海报文案生成 AI 线框图。
【组名】${g.label || ('第'+(idx+1)+'组')}
【排版参考图】${g.frame ? (g.frame.name || '已选择') : '未选择'}
【海报文案】
${g.poster || ''}

请输出：
1. 线框图布局说明
2. 主标题/辅助信息/利益点位置
3. 产品区/功能区/徽章区/背景区占位说明
4. 可直接交给图像生成接口的提示词`;
}
function composeImagePromptFromFrame(){
  return `${img.builtin.frame}

【三张图说明】第1张=AI生成的线框图（版式/文字布局基准，必须保留）；第2张=产品图（产品须与之完全一致，不得改动）；第3张=参考图（仅作整体风格参考）。${img.userPrompt.frame ? '\n【补充提示词】'+img.userPrompt.frame : ''}`;
}
function composeImagePromptFromCopyGroup(g, i){
  return `${img.builtin.copy}

【两张图说明】第1张=产品图（产品须与之完全一致，不得改动、替换或重绘）；第2张=参考图（作为版式/设计/配色/风格的模板）。
【画面文字】只使用下方「排版文案」，按主标题/功能区/利益点分别排布，不新增多余文字：
${g.poster || ''}${img.userPrompt.copy ? '\n【补充提示词】'+img.userPrompt.copy : ''}`;
}
startGen = async function(i){
  const g=wf.groups[i];
  if(!g.frame||!g.poster||!g.poster.trim()){apiToast('请先准备好「排版参考图」和「海报文案」后再生成线框图',true);return;}
  // V26：文案进入线框后 JSON 自动确认。生成前若文案发生变化，自动刷新任务 JSON，不再要求人工确认差异。
  if(isPromptLinkedForGroup(g)){const js=taskJsonSyncMeta(g,i);if(js.id!=='synced')syncTaskGroupJson(g,i,'V26 生成前自动确认任务 JSON');}
  try{ requireModel('wire'); }catch(err){ openCfg(); apiToast(err.message,true); return; }
  const actionKey='wf-api-generate-'+g.id;if(!actionLock(actionKey,document.querySelector('[data-genwf="'+i+'"]')))return;setActionStatus('loading','正在生成 AI 线框图…',true);
  pushWf(); const previousResult=g.result?{...g.result}:null;g.lastGenerateError='';g.generating=true; g.result=null; renderWireframe();
  try{
    let images;
    if(isEvolinkImageChannel()){
      // V26：EvoLink 的图生图/编辑本来就统一走 /v1/images/generations + image_urls。
      // 不再把“本地参考图读取失败”等前置错误误判成“模型不支持编辑接口”。
      images = await apiImageEdit(composeWirePrompt(g,i), API_BRIDGE.wireModel, g.frame.src);
    }else{
      try{
        images = await apiImageEdit(composeWirePrompt(g,i), API_BRIDGE.wireModel, g.frame.src);
      }catch(editErr){
        dbgLog({ok:false,endpoint:'/api/images/edits',model:API_BRIDGE.wireModel,status:0,error:'非 EvoLink 编辑接口不可用，回退到生成接口：'+editErr.message,channel:'兼容回退'});
        apiToast('当前非 EvoLink 通道的编辑接口调用失败，正在尝试兼容图生图路径。',true);
        const sz = await loadImageSize(g.frame.src);
        images = await apiImage(composeWirePrompt(g,i), API_BRIDGE.wireModel, 1, ratioToAspect(sz.w, sz.h), [g.frame.src]);
      }
    }
    const src = images[0];
    g.generating=false;g.lastGenerateError=''; g.result={time:nowStr(), src};
    const hist=addGeneratedWireHistory(g,i,src,{model:API_BRIDGE.wireModel,prompt:composeWirePrompt(g,i),status:'completed'});
    try{const saved=await persistGeneratedWireHistoryItem(hist);if(saved&&saved.src){g.result.src=saved.src;hist.src=saved.src;}}catch(historyErr){dbgLog({ok:false,endpoint:'/api/wireframe-history',model:API_BRIDGE.wireModel,status:0,error:'线框历史持久化失败：'+historyErr.message,channel:'V26 本地历史库'});apiToast('线框已生成，但历史库保存失败；本次结果仍可继续使用。',true);}
    renderWireframe();actionDone(actionKey,'AI 线框图生成成功并已保存历史');
    if(wf.autoToImage){setTimeout(()=>toNextImage(i),500);}
  }catch(err){g.generating=false;g.lastGenerateError=String(err&&err.message||err||'未知错误');if(previousResult)g.result=previousResult;renderWireframe();actionFail(actionKey,'线框生成失败：'+g.lastGenerateError);}
};
startImgGen = async function(groupIdx=null){
  const m=img.mode;
  try{ requireModel('image'); }
  catch(err){setImageFlowError(m,4,'生图接口尚未配置：'+err.message,{type:'config'});renderImageView();openImgCfg();apiToast(err.message,true);return;}
  const actionKey='image-api-generate';
  if(actionBusy[actionKey]||img.generating||img.copyGroups.some(g=>g.generating)){setActionStatus('loading','生图任务正在进行，请勿重复点击…',false);return;}
  if(m==='frame'){
    const a=img.inputs.frame.wire,b=img.inputs.frame.product,c=img.inputs.frame.ref;
    if(!a||!b||!c){apiToast('请先准备好「AI生成的线框图」「产品图」「参考图」',true);return;}
    if(!actionLock(actionKey,document.querySelector('[data-imggen]')))return;
    setActionStatus('loading','正在通过 API 生成主图…',true);
    beginImageFlowGeneration('frame',1);
    img.generating=true;img.progress='API 生图中：线框图 + 产品图 + 参考图 → 主图';img.result=null;renderImageView();
    try{
      let images;
      if(isEvolinkImageChannel()){
        images = await apiImageEditMulti(composeImagePromptFromFrame(), API_BRIDGE.imageModel, [a.src,b.src,c.src], img.count, img.aspect);
      }else{
        try{
          images = await apiImageEditMulti(composeImagePromptFromFrame(), API_BRIDGE.imageModel, [a.src,b.src,c.src], img.count, img.aspect);
        }catch(editErr){
          dbgLog({ok:false,endpoint:'/api/images/edits',model:API_BRIDGE.imageModel,status:0,error:'非 EvoLink 多图编辑不可用，回退生成接口：'+editErr.message,channel:'兼容回退'});
          apiToast('当前非 EvoLink 通道的多图编辑调用失败，正在尝试兼容生成路径。',true);
          images = await apiImage(composeImagePromptFromFrame(), API_BRIDGE.imageModel, img.count, img.aspect, [a.src,b.src,c.src]);
        }
      }
      if(!images.length) images = resultImagesFrom(a.src,img.count);
      img.generating=false;img.result={time:nowStr(),images};
      img.history.unshift({id:uid(),mode:m,time:nowStr(),inputs:cloneObj(img.inputs.frame),builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:images[0]||a.src});
      finishImageFlowGeneration('frame');renderImageView();actionDone(actionKey,'已生成 '+img.count+' 张主图');
    }catch(err){
      img.generating=false;setImageFlowError('frame',4,'生图 API 调用失败：'+err.message,{type:'generate',groupIdx:null});renderImageView();actionFail(actionKey,'生图 API 调用失败：'+err.message);
    }
    return;
  }
  rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();
  const targets=groupIdx==null?img.copyGroups:[img.copyGroups[groupIdx]].filter(Boolean);
  if(!targets.length){apiToast('请先选择文案版本并生成任务队列',true);return;}
  const notReady=targets.find(g=>!g.poster||!(g.product||img.inputs.copy.product)||!(g.ref||img.inputs.copy.ref));
  if(notReady){apiToast('请确认每组都有排版文案、产品图和参考图',true);return;}
  const genBtn=groupIdx==null?document.querySelector('[data-imggencopyall],[data-imggen]'):document.querySelector('[data-imggengroup="'+groupIdx+'"]');
  if(!actionLock(actionKey,genBtn))return;
  setActionStatus('loading','正在生成 '+targets.length+' 个主图任务…',true);
  beginImageFlowGeneration('copy',targets.length);
  targets.forEach(g=>{g.generating=true;g.result=null;});img.generating=groupIdx==null;renderImageView();
  try{
    for(const g of targets){
      const gi=img.copyGroups.indexOf(g);
      const _prod=(g.product||img.inputs.copy.product), _ref=(g.ref||img.inputs.copy.ref);
      let images;
      if(isEvolinkImageChannel()){
        images = await apiImageEditMulti(composeImagePromptFromCopyGroup(g,gi), API_BRIDGE.imageModel, [_prod&&_prod.src, _ref&&_ref.src], img.count, img.aspect);
      }else{
        try{
          images = await apiImageEditMulti(composeImagePromptFromCopyGroup(g,gi), API_BRIDGE.imageModel, [_prod&&_prod.src, _ref&&_ref.src], img.count, img.aspect);
        }catch(editErr){
          dbgLog({ok:false,endpoint:'/api/images/edits',model:API_BRIDGE.imageModel,status:0,error:'非 EvoLink 多图编辑不可用，回退生成接口：'+editErr.message,channel:'兼容回退'});
          images = await apiImage(composeImagePromptFromCopyGroup(g,gi), API_BRIDGE.imageModel, img.count, img.aspect, [_prod&&_prod.src, _ref&&_ref.src]);
        }
      }
      const base=(g.ref||img.inputs.copy.ref).src;
      if(!images.length) images = resultImagesFrom(base,img.count);
      g.generating=false;g.result={time:nowStr(),images};
      img.history.unshift({id:uid(),mode:m,time:nowStr(),label:g.label,poster:g.poster,inputs:{product:g.product||img.inputs.copy.product,ref:g.ref||img.inputs.copy.ref},builtin:img.builtin[m],userPrompt:img.userPrompt[m],count:img.count,resultSrc:images[0]||base});
      renderImageView();
    }
    img.generating=false;finishImageFlowGeneration('copy');renderImageView();actionDone(actionKey,'已完成 '+targets.length+' 个队列任务');
  }catch(err){
    targets.forEach(g=>g.generating=false);img.generating=false;setImageFlowError('copy',4,'队列 API 调用失败：'+err.message,{type:'generate',groupIdx});renderImageView();actionFail(actionKey,'队列 API 调用失败：'+err.message);
  }
};
// 初始化：恢复已持久化的内置提示词（不回默认）
initPrompts();
if(typeof renderWireframe==='function'&&curView==='integrate')renderWireframe();
// V26：取消全局启动时自动读取共享模型。
// 共享线框/生图通道由 channel-runtime.js 在对应页面静默按需预热；扣子文案页只访问 /api/copy-coze/*。
