/* ============ V26 全局路由 + 交互 ============ */
const main=$('main');
function setActive(k){document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.dataset.k===k));}
let curView='home';
function render(k){
  const route=(window.AppRoutePersistence&&window.AppRoutePersistence.normalize(k))||'home';
  curView=route; setActive(route);
  try{window.AppRoutePersistence&&window.AppRoutePersistence.remember(route);}catch(_e){}
  if(route!=='adjust'&&typeof window.v207DeactivateRegionRoute==='function')window.v207DeactivateRegionRoute({silent:true});
  const regionRoute=route==='adjust';
  window.__V207_REGION_ROUTE__=regionRoute;
  document.body.classList.toggle('v207-region-route',regionRoute);
  if(route==='home')main.innerHTML=viewHome();
  else if(route==='copy'){main.innerHTML=viewCopy();bindCopy();renderCopyOut();}
  else if(route==='integrate'){main.innerHTML=viewIntegrate();renderWireframe();}
  else if(route==='image'){main.innerHTML=viewImage();renderImageView();}
  else if(route==='adjust'){
    main.innerHTML=viewAdjust();
    /* 保留旧微调运行时 DOM 作为生成流程的兼容层，但页面视觉与交互全部切换到 V21 智能区域工作台。 */
    renderAdjustView();
    requestAnimationFrame(()=>window.v207OpenRegionRoute?.());
  }
  else if(route==='users')main.innerHTML=viewUsers();
  else if(route==='audit')main.innerHTML=viewAudit();
  window.scrollTo(0,0);
  requestAnimationFrame(()=>{try{window.AppChannelRuntime&&window.AppChannelRuntime.enter(route);}catch(_e){}});
}
function navigateView(k){
  const target=(window.AppRoutePersistence&&window.AppRoutePersistence.normalize(k))||'home';
  try{window.AppPageStateLifecycle&&window.AppPageStateLifecycle.beforeNavigation(curView,target);}catch(_e){}
  render(target);
}
function bindCopy(){
  const inp=$('cp-in'),gen=$('cp-gen');
  if(copies._in)inp.value=copies._in;
  const sync=()=>{gen.disabled=!inp.value.trim();};
  inp.addEventListener('input',sync);sync();
  gen.addEventListener('click',()=>{
    if(!inp.value.trim())return;
    const source=inp.value;
    withAction('generate-copy','正在生成 8 个预制文案版本…','8 个预制文案版本已生成','文案生成失败',()=>new Promise(resolve=>{
      setTimeout(()=>{copies=generate(source);copies._in=source;selected=new Set();expanded=null;copySnapshotCaptureGenerated(source,'local-rule');syncAllBoundTaskGroups();renderCopyOut();resolve();},360);
    }),gen);
  });
}

document.getElementById('nav').addEventListener('click',e=>{const a=e.target.closest('a[data-k]');if(a)navigateView(a.dataset.k);});

main.addEventListener('toggle',e=>{
  const panel=e.target&&e.target.matches&&e.target.matches('[data-wf-workflow-overview]')?e.target:null;
  if(panel&&typeof setWireOverviewExpanded==='function')setWireOverviewExpanded(panel.open);
},true);

main.addEventListener('click',e=>{
  const navc=e.target.closest('.inner[data-k]'); if(navc){navigateView(navc.dataset.k);return;}
  // V26 文案历史快照：恢复 / 星标保留 / 删除
  const cstar=e.target.closest('[data-copy-snapshot-star]');if(cstar){e.preventDefault();e.stopPropagation();copySnapshotTogglePinned(cstar.dataset.copySnapshotStar);return;}
  const cdel=e.target.closest('[data-copy-snapshot-delete]');if(cdel){e.preventDefault();e.stopPropagation();const id=cdel.dataset.copySnapshotDelete,batch=CopyGenerationHistory.state().batches.find(x=>x.id===id);if(!batch)return;confirmDialog(`删除${batch.pinned?'已星标保留的':''}历史快照“${(batch.input||'未命名产品').replace(/\s+/g,' ').slice(0,28)}”？删除后不可恢复。`,()=>copySnapshotDelete(id),{preserveParent:true});return;}
  const cshot=e.target.closest('[data-copy-snapshot]');if(cshot){copySnapshotSwitch(cshot.dataset.copySnapshot);return;}
  // 文案：AI 接入与调试通道
  const cpcfg=e.target.closest('[data-copy-api-config]');if(cpcfg){openCopyApiConfig();return;}
  const cptest=e.target.closest('[data-copy-test]');if(cptest){testCopyConnection(cptest);return;}
  if(e.target.closest('[data-copy-json]')||e.target.closest('[data-copy-json-mapping]')){openCopyJsonMappingWorkspace();return;}
  if(e.target.closest('[data-copy-logs]')){openBackendLogs();return;}
  // 文案：示例词
  const ex=e.target.closest('[data-ex]'); if(ex){const inp=$('cp-in');inp.value=ex.dataset.ex;$('cp-gen').disabled=false;inp.focus();return;}
  // 文案：全选/清空/下一步
  if(e.target.id==='sel-all'){copies.forEach((_,i)=>selected.add(i));renderCopyOut();return;}
  if(e.target.id==='sel-clear'){selected.clear();renderCopyOut();return;}
  if(e.target.id==='go-next'){ if(!selected.size)return;
    wf.groups=[...selected].sort((a,b)=>a-b).map(i=>newGroup('版本 '+copies[i].version+' · '+copies[i].style,copyToPoster(copies[i]),{sourceCopyIndex:i,sourceVersion:copies[i].version,sourceStyle:copies[i].style,sourceBoundAt:nowStr()}));
    COPY_API_CHANNEL.promptLinkEnabled=true;wf.promptTargetGroupIds=wf.groups.map(g=>g.id);wf.groups.forEach((g,gi)=>syncTaskGroupJson(g,gi,'V26 文案确认后自动确认任务 JSON'));saveCopyApiChannel();
    wfUndo=[]; toast('已带入 '+selected.size+' 组文案，任务 JSON 已自动确认');
    setTimeout(()=>render('integrate'),300); return;}
  // 文案：版本 chip
  const vc=e.target.closest('[data-v]'); if(vc){const i=+vc.dataset.v;selected.has(i)?selected.delete(i):selected.add(i);renderCopyOut();return;}
  // 文案：卡头切换选择
  const tog=e.target.closest('[data-tog]'); if(tog){const i=+tog.dataset.tog;selected.has(i)?selected.delete(i):selected.add(i);renderCopyOut();return;}
  // 文案：小标题可单选 / 多选（至少保留 1 条）
  const sp=e.target.closest('[data-subtitle-pick]'); if(sp){
    const parts=sp.dataset.subtitlePick.split('|'),ci=+parts[0],si=Math.max(0,Math.min(2,+parts[1]));
    if(copies[ci]){
      const b=normalizeCopyBlock(copies[ci].block),set=new Set(b.selectedSubtitles),wasSelected=set.has(si);
      if(wasSelected&&set.size===1){setActionStatus('info','至少保留 1 条小标题',false);return;}
      wasSelected?set.delete(si):set.add(si);
      b.selectedSubtitles=[...set];copies[ci].block=b;syncCopyVersionToBoundTasks(ci);renderCopyOut();
      const names=selectedSubtitleTexts(b).join('、');
      setActionStatus('success',`已选 ${b.selectedSubtitles.length} 条小标题：${names}`,false);
    }
    return;
  }
  // 文案：复制
  const cp=e.target.closest('[data-copy]'); if(cp){navigator.clipboard&&navigator.clipboard.writeText(cp.dataset.copy);toast('✓ 已复制');return;}
  // 文案：展开区块
  const blk=e.target.closest('[data-blk]'); if(blk){expanded=expanded===blk.dataset.blk?null:blk.dataset.blk;renderCopyOut();return;}
  // 通用上传占位（AI 生图四张参考图）
  const upl=e.target.closest('[data-upl]'); if(upl){const on=upl.classList.toggle('filled');upl.innerHTML=on?'<span class="ph-em">✅</span>已选择图片':'<span class="ph-em">🖼️</span>'+(upl.dataset.label||'点击上传');return;}
  // 质量/数量分段
  const segb=e.target.closest('[data-seg] button'); if(segb){segb.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('on'));segb.classList.add('on');return;}
  // ===== AI 线框生成 =====
  const wfadv=e.target.closest('[data-wf-advanced-toggle]');if(wfadv){setWireAdvancedDebug(!wf.advancedDebug);renderWireframe();setActionStatus('info',wf.advancedDebug?'已打开高级 / 调试：可查看任务 JSON 与历史':'已关闭高级 / 调试：普通流程隐藏 JSON 技术细节',false);return;}
  const iq=e.target.closest('[data-issue-quick]');if(iq){openIssueCenter(iq.dataset.issueQuick);return;}
  if(e.target.closest('[data-issue-center-open]')){openIssueCenter();return;}
  const ic=e.target.closest('[data-issue-category]');if(ic){wf.issueCenterFilter=ic.dataset.issueCategory;refreshIssueCenterUi();return;}
  if(e.target.closest('[data-issue-repair-category]')){const btn=e.target.closest('[data-issue-repair-category]'),filter=normalizeIssueCenterFilter();if(btn.disabled)return;btn.disabled=true;btn.innerHTML='<span class="issue-repair-progress"><span class="spin"></span>处理中</span>';Promise.resolve(safeRepairPromptFilter(filter)).catch(err=>{setActionStatus('error','当前分类处理失败：'+err.message,false);refreshIssueCenterUi();});return;}
  const pick=e.target.closest('[data-pick]'); if(pick){openPicker(+pick.dataset.pick);return;}
  const wfregen=e.target.closest('[data-wfregen]'); if(wfregen){startGen(+wfregen.dataset.wfregen);return;}
  const wfhist=e.target.closest('[data-wfhist]'); if(wfhist){openHist(+wfhist.dataset.wfhist);return;}
  const wfcurdl=e.target.closest('[data-wfcurrent-download]'); if(wfcurdl){const g=wf.groups[+wfcurdl.dataset.wfcurrentDownload];if(g&&g.result&&g.result.src){openImageDownloadDialog(g.result.src,`ai-wireframe-${(+wfcurdl.dataset.wfcurrentDownload)+1}-${Date.now()}`,'下载当前 AI 线框图');}return;}
  if(e.target.closest('[data-genwf]')){startGen(+e.target.closest('[data-genwf]').dataset.genwf);return;}
  const wfpv=e.target.closest('[data-wfpreview]'); if(wfpv){const gg=wf.groups[+wfpv.dataset.wfpreview]; if(gg&&gg.result&&gg.result.src) openImgPreview(gg.result.src,'AI 生成线框图预览'); return;}
  if(e.target.closest('[data-tonext]')){toNextImage(+e.target.closest('[data-tonext]').dataset.tonext);return;}
  if(e.target.closest('[data-stopwf]')){stopGen(+e.target.closest('[data-stopwf]').dataset.stopwf);return;}
  const wsj=e.target.closest('[data-wfstatus-jump]');if(wsj){const i=+wsj.dataset.wfstatusJump,el=$('wf-group-'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});return;}
  const wss=e.target.closest('[data-wfstatus-sync]');if(wss){const i=+wss.dataset.wfstatusSync,g=wf.groups[i],idx=g?inferGroupCopyIndex(g):null;if(idx==null||!copies[idx]){setActionStatus('error','当前任务组没有固定绑定的文案版本',false);return;}bindGroupToCopy(g,idx,true);renderWireframe();setActionStatus('success','已从来源版本 '+copies[idx].version+' 同步当前任务组文案',false);return;}
  if(e.target.closest('[data-addwf]')){pushWf();wf.groups.push(newGroup('','')); renderWireframe();return;}
  const dwf=e.target.closest('[data-delwf]'); if(dwf){const idx=+dwf.dataset.delwf;withAction('delete-wf-group-'+idx,'正在删除线框组…','线框组已删除','删除线框组失败',()=>{pushWf();wf.groups.splice(idx,1);renderWireframe();},dwf);return;}
  if(e.target.closest('[data-cfg]')){openCfg();return;}
  if(e.target.closest('[data-builtin]')){openBuiltin();return;}
  if(e.target.closest('[data-conntest]')){ if(typeof runApiDiagnose==='function'){ toast('正在测试连接…'); runApiDiagnose(true); } return; }
  if(e.target.closest('[data-hist]')){openHist(null);return;}
  if(e.target.closest('[data-wfautoflow]')){wf.autoToImage=!wf.autoToImage;renderWireframe();toast('线框生成自动流转已'+(wf.autoToImage?'开启':'关闭'));return;}
  const wjt=e.target.closest('[data-wfjson-toggle]');if(wjt){const g=wf.groups[+wjt.dataset.wfjsonToggle];if(g){const a=ensureWireJsonState(g);a.open=!a.open;renderWireframe();if(a.open)setTimeout(()=>{const el=$('wf-json-panel-'+(+wjt.dataset.wfjsonToggle));if(el)el.scrollIntoView({behavior:'smooth',block:'nearest'});},40);}return;}
  const wju=e.target.closest('[data-wfjson-upload]');if(wju){chooseWireJsonImage(+wju.dataset.wfjsonUpload,wju);return;}
  const wjc=e.target.closest('[data-wfjson-current]');if(wjc){useCurrentWireForJson(+wjc.dataset.wfjsonCurrent);return;}
  const wja=e.target.closest('[data-wfjson-analyze]');if(wja){analyzeWireJson(+wja.dataset.wfjsonAnalyze,wja);return;}
  const wjm=e.target.closest('[data-wfjson-modify]');if(wjm){modifyWireJson(+wjm.dataset.wfjsonModify,wjm);return;}
  const wjf=e.target.closest('[data-wfjson-format]');if(wjf){formatWireJson(+wjf.dataset.wfjsonFormat);return;}
  const wjs=e.target.closest('[data-wfjson-save]');if(wjs){saveWireJson(+wjs.dataset.wfjsonSave);return;}
  const wjcp=e.target.closest('[data-wfjson-copy]');if(wjcp){const a=ensureWireJsonState(wf.groups[+wjcp.dataset.wfjsonCopy]);if(!a.jsonText.trim()){setActionStatus('error','当前没有可复制的 JSON',false);return;}navigator.clipboard&&navigator.clipboard.writeText(a.jsonText);setActionStatus('success','JSON 已复制',false);return;}
  const wjdl=e.target.closest('[data-wfjson-download]');if(wjdl){const i=+wjdl.dataset.wfjsonDownload,a=ensureWireJsonState(wf.groups[i]);if(!a.jsonText.trim()){setActionStatus('error','当前没有可下载的 JSON',false);return;}const blob=new Blob([a.jsonText],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),ln=document.createElement('a');ln.href=url;ln.download=`wireframe-analysis-${i+1}-${Date.now()}.json`;document.body.appendChild(ln);ln.click();ln.remove();setTimeout(()=>URL.revokeObjectURL(url),500);setActionStatus('success','JSON 文件已开始下载',false);return;}
  const wjcl=e.target.closest('[data-wfjson-clear]');if(wjcl){confirmDialog('清空当前任务组的分析图片和 JSON？',()=>clearWireJson(+wjcl.dataset.wfjsonClear));return;}
  // ===== AI 生图（增强双模式） =====
  if(e.target.closest('[data-img-flow-toggle]')){toggleImageFlowCard();return;}
  if(e.target.closest('[data-img-flow-retry]')){retryImageFlowError();return;}
  if(e.target.closest('[data-img-parameter-toggle]')){img.parametersExpanded=!img.parametersExpanded;renderImageView();return;}
  const up=e.target.closest('[data-up]'); if(up){const parts=up.dataset.up.split('|');imgUpload(parts[0],parts[1],parts[2]!=null?+parts[2]:null);return;}
  const md=e.target.closest('[data-mode]'); if(md){if(img.mode!==md.dataset.mode){img.mode=md.dataset.mode;if(img.mode==='copy')rebuildCopyGroupsFromSelection(true);renderImageView();}return;}
  const cnt=e.target.closest('[data-imgcount]'); if(cnt){img.count=+cnt.dataset.imgcount;renderImageView();return;}
  const q=e.target.closest('[data-imgquality]'); if(q){img.quality=q.dataset.imgquality;renderImageView();return;}
  const delv=e.target.closest('[data-imgdelversion]'); if(delv){e.stopPropagation();const i=+delv.dataset.imgdelversion;confirmDialog('确定删除版本 '+(copies[i]?copies[i].version:'')+' 吗？',()=>withAction('delete-copy-version-'+i,'正在删除文案版本…','文案版本已删除','删除文案版本失败',()=>deleteCopyVersion(i),delv));return;}
  const iv=e.target.closest('[data-imgv]'); if(iv){const i=+iv.dataset.imgv;setActiveCopyVersion(i);return;}
  if(e.target.closest('[data-imgvall]')){img.copySelectionTouched=true;img.copySelected=copies.map((_,i)=>i);rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();renderImageView();toast('已全选文案版本，并自动新增对应模块');return;}
  if(e.target.closest('[data-imgvclear]')){img.copySelectionTouched=true;img.copySelected=[];rebuildCopyGroupsFromSelection(true);renderImageView();toast('已清空选择');return;}
  if(e.target.closest('[data-imgaddversion]')){openAddCopyVersion();return;}
  if(e.target.closest('[data-save-newcopy]')){e.stopPropagation();const btn=e.target.closest('[data-save-newcopy]');withAction('save-new-copy','正在保存文案版本…','文案版本已保存','保存文案版本失败',saveNewCopyVersion,btn);return;}
  if(e.target.closest('[data-gocopy]')){navigateView('copy');return;}
  if(e.target.closest('[data-refreshcopygroup]')){rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();renderImageView();toast('已同步当前文案版本');return;}
  if(e.target.closest('[data-imgautogroups]')){rebuildCopyGroupsFromSelection(true);syncCopyInputsToGroups();renderImageView();toast('已自动补充当前版本模块');return;}
  if(e.target.closest('[data-imgsync]')){syncCopyInputsToGroups();renderImageView();toast('已将产品图和参考图同步到当前模块');return;}
  if(e.target.closest('[data-imgaddgroup]')){openAddCopyVersion();return;}
  const dg=e.target.closest('[data-imgdelgroup]'); if(dg){const idx=+dg.dataset.imgdelgroup;withAction('delete-img-group-'+idx,'正在删除生图组…','生图组已删除','删除生图组失败',()=>{img.copyGroups.splice(idx,1);renderImageView();toast('已删除该生图组');},dg);return;}
  const gg=e.target.closest('[data-imggengroup]'); if(gg){startImgGen(+gg.dataset.imggengroup);return;}
  if(e.target.closest('[data-imggencopyall]')){startImgGen();return;}
  if(e.target.closest('[data-queuejump]')){const i=+e.target.closest('[data-queuejump]').dataset.queuejump;const el=document.querySelector('[data-copygroup="'+i+'"]');if(el){el.scrollIntoView({behavior:'smooth',block:'start'});el.style.boxShadow='0 0 0 2px #c7d2fe';setTimeout(()=>el.style.boxShadow='',1200);}return;}
  if(e.target.closest('[data-imggen]')){startImgGen();return;}
  if(e.target.closest('[data-imgstop]')){stopImgGen();return;}
  const ix=e.target.closest('[data-image-export-format]');if(ix){runImageExportFormat(ix.dataset.imageExportFormat,ix);return;}
  const pv=e.target.closest('[data-preview-kind]'); if(pv){const src=getResultImage(pv.dataset.previewKind,pv.dataset.previewGroup===''?null:+pv.dataset.previewGroup,+pv.dataset.previewIdx);openImgPreview(src,'结果预览');return;}
  const dl=e.target.closest('[data-download-kind]'); if(dl){const src=getResultImage(dl.dataset.downloadKind,dl.dataset.downloadGroup===''?null:+dl.dataset.downloadGroup,+dl.dataset.downloadIdx);openImageDownloadDialog(src,`${dl.dataset.downloadKind==='frame'?'frame':'group'+((+dl.dataset.downloadGroup)+1)}-${(+dl.dataset.downloadIdx)+1}`,'下载生成图片');return;}
  const rg=e.target.closest('[data-regen-kind]'); if(rg){const kind=rg.dataset.regenKind; if(kind==='frame'){startImgGen();} else {startImgGen(+rg.dataset.regenGroup);} return;}
  if(e.target.closest('[data-imgregen-frame]')){startImgGen();return;}
  if(e.target.closest('[data-imgexport-frame]')){batchExportImages((img.result&&img.result.images)||[],'frame-result');return;}
  const eg=e.target.closest('[data-imgexport-group]'); if(eg){const i=+eg.dataset.imgexportGroup; const g=img.copyGroups[i]; batchExportImages((g&&g.result&&g.result.images)||[],`group-${i+1}`); return;}
  if(e.target.closest('[data-imgexportall]')){exportAllCopyResults();return;}
  if(e.target.closest('[data-imgcfg]')){openImgCfg();return;}
  if(e.target.closest('[data-imgbuiltin]')){openImgBuiltin();return;}
  if(e.target.closest('[data-imghist]')){openImgHist();return;}
  if(e.target.closest('[data-image-task-center]')){openImageTaskCenter();return;}
});

// 海报文案输入 → 同步状态
main.addEventListener('input',e=>{const p=e.target.closest('[data-poster]');if(p)wf.groups[+p.dataset.poster].poster=p.value;const jt=e.target.closest('[data-wfjson-text]');if(jt&&wf.groups[+jt.dataset.wfjsonText])ensureWireJsonState(wf.groups[+jt.dataset.wfjsonText]).jsonText=jt.value;const jr=e.target.closest('[data-wfjson-require]');if(jr&&wf.groups[+jr.dataset.wfjsonRequire])ensureWireJsonState(wf.groups[+jr.dataset.wfjsonRequire]).requirement=jr.value;const ip=e.target.closest('[data-imgprompt]');if(ip)img.userPrompt[img.mode]=ip.value;const cp=e.target.closest('[data-copygroup-poster]');if(cp&&img.copyGroups[+cp.dataset.copygroupPoster]){const g=img.copyGroups[+cp.dataset.copygroupPoster];g.poster=cp.value;if(g.copyIdx!=null)updateCopyVersionFromPoster(g.copyIdx,cp.value);}});
main.addEventListener('change',e=>{const a=e.target.closest('[data-imgaspect]'),r=e.target.closest('[data-imgres]');if(a)img.aspect=a.value;if(r)img.resolution=r.value;if((a||r)&&curView==='image')renderImageView();});
main.addEventListener('focusout',e=>{const p=e.target.closest('[data-poster]');if(p)pushWf();},true);

// 弹窗交互
document.addEventListener('click',e=>{
  if(e.target.closest('[data-save-newcopy]')){const btn=e.target.closest('[data-save-newcopy]');withAction('save-new-copy','正在保存文案版本…','文案版本已保存','保存文案版本失败',saveNewCopyVersion,btn);return;}
  if(e.target.closest('[data-dclose]')){dlgClose();return;}
  if(e.target.closest('[data-modal-back]')){if(document.getElementById('image-export-confirm-area')&&typeof cleanupImageExportContext==='function')cleanupImageExportContext();modalBack();return;}
  const modalExportFormat=e.target.closest('#modal [data-image-export-format]');if(modalExportFormat){e.preventDefault();runImageExportFormat(modalExportFormat.dataset.imageExportFormat,modalExportFormat);return;}
  const modalExportRetry=e.target.closest('#modal [data-image-export-retry]');if(modalExportRetry){e.preventDefault();prepareImageExportFormat(IMAGE_EXPORT_CONTEXT.selectedFormat||'jpg',modalExportRetry);return;}
  const modalExportConfirm=e.target.closest('#modal [data-image-export-confirm]');if(modalExportConfirm){setActionStatus('success','已确认下载 '+(window.ImageExport?window.ImageExport.formatDescriptor(IMAGE_EXPORT_CONTEXT.selectedFormat).label:'图片')+'；请查看浏览器下载列表或保存目录。',false);return;}
  if(e.target.closest('[data-mclose]')){if(typeof cleanupImageExportContext==='function')cleanupImageExportContext();modalClose();return;}
  /* V14 二级弹窗问题导航：这些控件位于 #modal，不属于主页面 main */
  const modalIssueQuick=e.target.closest('#modal [data-issue-quick]');if(modalIssueQuick){openIssueCenter(modalIssueQuick.dataset.issueQuick);return;}
  const modalIssueOpen=e.target.closest('#modal [data-issue-center-open]');if(modalIssueOpen){openIssueCenter();return;}
  const modalIssueCategory=e.target.closest('#modal [data-issue-category]');if(modalIssueCategory){wf.issueCenterFilter=modalIssueCategory.dataset.issueCategory;refreshIssueCenterUi();return;}
  const modalIssueRepair=e.target.closest('#modal [data-issue-repair-category]');if(modalIssueRepair){const filter=normalizeIssueCenterFilter();if(modalIssueRepair.disabled)return;modalIssueRepair.disabled=true;modalIssueRepair.innerHTML='<span class="issue-repair-progress"><span class="spin"></span>处理中</span>';Promise.resolve(safeRepairPromptFilter(filter)).catch(err=>{setActionStatus('error','当前分类处理失败：'+err.message,false);refreshIssueCenterUi();});return;}
  if(e.target.closest('[data-cfg-save]')){const btn=e.target.closest('[data-cfg-save]');withAction('save-wf-config','正在保存线框配置…',($('cfg-url').value.trim()&&$('cfg-key').value.trim())?'线框配置已保存':'请填写接口地址与密钥','保存线框配置失败',()=>{wf.baseUrl=$('cfg-url').value.trim();wf.key=$('cfg-key').value.trim();wf.configured=!!(wf.baseUrl&&wf.key);modalClose();renderWireframe();toast(wf.configured?'✓ 已自动配置完成（模型自动选择）':'请填写接口地址与密钥');},btn);return;}
  if(e.target.closest('[data-bp-save]')){const btn=e.target.closest('[data-bp-save]');withAction('save-wf-prompt','正在保存线框提示词…','线框内置提示词已保存','保存线框提示词失败',()=>{wf.builtin=$('bp').value;commitPrompt('wire',wf.builtin);modalClose();toast('内置提示词已保存（已持久化，不会回默认）');},btn);return;}
  const bpr=e.target.closest('[data-bp-restore]'); if(bpr){const h=promptStore.wire.hist[+bpr.dataset.bpRestore];if(h){wf.builtin=h.text;commitPrompt('wire',wf.builtin);openBuiltin();toast('已恢复该历史版本');}return;}
  if(e.target.closest('[data-bp-reset]')){$('bp').value=DEFAULT_WF_PROMPT;return;}
  if(e.target.closest('[data-imgcfg-save]')){const btn=e.target.closest('[data-imgcfg-save]');withAction('save-img-config','正在保存生图配置…',($('imgcfg-url').value.trim()&&$('imgcfg-key').value.trim())?'生图配置已保存':'请填写接口地址与密钥','保存生图配置失败',()=>{img.baseUrl=$('imgcfg-url').value.trim();img.key=$('imgcfg-key').value.trim();img.configured=!!(img.baseUrl&&img.key);modalClose();if(curView==='image')renderImageView();toast(img.configured?'✓ 已自动配置完成（模型自动选择）':'请填写接口地址与密钥');},btn);return;}
  if(e.target.closest('[data-imgbp-save]')){const btn=e.target.closest('[data-imgbp-save]');withAction('save-img-prompt','正在保存生图提示词…','生图内置提示词已保存','保存生图提示词失败',()=>{img.builtin[img.mode]=$('imgbp').value;commitPrompt(imgSlot(),img.builtin[img.mode]);modalClose();if(curView==='image')renderImageView();toast('内置提示词已保存（已持久化，不会回默认）');},btn);return;}
  const ibr=e.target.closest('[data-imgbp-restore]'); if(ibr){const h=promptStore[imgSlot()].hist[+ibr.dataset.imgbpRestore];if(h){img.builtin[img.mode]=h.text;commitPrompt(imgSlot(),h.text);openImgBuiltin();toast('已恢复该历史版本');}return;}
  if(e.target.closest('[data-imgbp-reset]')){$('imgbp').value=DEFAULT_IMG_BUILTIN[img.mode];return;}
  const ir=e.target.closest('[data-imgreuse]'); if(ir){imgReuse(+ir.dataset.imgreuse,false);return;}
  const ig=e.target.closest('[data-imgregen]'); if(ig){imgReuse(+ig.dataset.imgregen,true);return;}
  if(e.target.closest('[data-image-task-refresh-all]')){const pending=imageTaskCenterItems.filter(t=>!/complete|success|fail|timeout/i.test(String(t.status||'')));Promise.allSettled(pending.map(refreshOneImageTask)).then(()=>{loadImageTaskCenterItems().then(()=>modalRefresh(imageTaskCenterHtml(),true));});return;}
  const itr=e.target.closest('[data-image-task-refresh]');if(itr){const t=imageTaskCenterItems[+itr.dataset.imageTaskRefresh];if(!t)return;refreshOneImageTask(t).then(()=>loadImageTaskCenterItems()).then(()=>modalRefresh(imageTaskCenterHtml(),true)).catch(err=>setActionStatus('error','刷新生图任务失败：'+err.message,false));return;}
  const itd=e.target.closest('[data-image-task-delete]');if(itd){const t=imageTaskCenterItems[+itd.dataset.imageTaskDelete];if(!t)return;confirmDialog('删除这条生图任务记录？不会重新提交或取消云端任务。',async()=>{await localDataFetch('/api/image-tasks/'+encodeURIComponent(t.id||t.taskId),{method:'DELETE'});await loadImageTaskCenterItems();modalRefresh(imageTaskCenterHtml(),true);if(curView==='image')renderImageView();},{preserveParent:true});return;}
  const itp=e.target.closest('[data-image-task-preview]');if(itp){const t=imageTaskCenterItems[+itp.dataset.imageTaskPreview],u=t&&Array.isArray(t.resultUrls)?t.resultUrls[+itp.dataset.resultIndex]:'';if(u)openImgPreview(u,'任务中心结果预览');return;}
  const whp=e.target.closest('[data-wfhist-preview]'); if(whp){const h=(wf.history||[])[+whp.dataset.wfhistPreview];if(h&&h.src)openImgPreview(h.src,'历史生成线框图预览');return;}
  const whd=e.target.closest('[data-wfhist-download]'); if(whd){const h=(wf.history||[])[+whd.dataset.wfhistDownload];if(h&&h.src){openImageDownloadDialog(h.src,`history-wireframe-${(+whd.dataset.wfhistDownload)+1}-${Date.now()}`,'下载历史线框图');}return;}
  const whu=e.target.closest('[data-wfhist-use]'); if(whu){useWireHistory(+whu.dataset.wfhistUse);return;}
  const whj=e.target.closest('[data-wfhist-json]'); if(whj){sendWireHistoryToJson(+whj.dataset.wfhistJson);return;}
  const whdel=e.target.closest('[data-wfhist-delete]');if(whdel){const idx=+whdel.dataset.wfhistDelete,h=(wf.history||[])[idx];if(!h)return;confirmDialog('删除这条线框历史记录及本机保存的图片？',async()=>{await deleteGeneratedWireHistoryItem(h.id);modalRefresh(wireHistoryModalHtml(),true);if(curView==='integrate')renderWireframe();setActionStatus('success','历史线框记录已删除',false);},{preserveParent:true});return;}
  if(e.target.closest('[data-wfhist-refresh]')){refreshGeneratedWireHistoryFromServer({migrate:false}).then(()=>modalRefresh(wireHistoryModalHtml(),true)).catch(err=>setActionStatus('error','刷新线框历史失败：'+err.message,false));return;}
  const rc=e.target.closest('[data-recall]'); if(rc){const h=wf.history[+rc.dataset.recall];if(!h)return;pushWf();const ng=newGroup('回调 · '+h.label,h.poster);ng.result=h.src?{time:h.time||nowStr(),src:h.src}:null;wf.groups.push(ng);modalClose();if(curView!=='integrate')render('integrate');else renderWireframe();toast('已回调到新的一组');return;}
  // 选择器：品类
  const rn=e.target.closest('[data-renamecat]'); if(rn){e.preventDefault();e.stopImmediatePropagation();const c=lib.find(x=>x.id===rn.dataset.renamecat);if(!c)return;inputDialog('重命名品类',c.name,nm=>{lib=WireframeLibrary.renameCategory(lib,c.id,nm);saveLib();refreshPicker();toast('已重命名');},{preserveParent:true});return;}
  const dc=e.target.closest('[data-delcat]'); if(dc){e.preventDefault();e.stopImmediatePropagation();const id=dc.dataset.delcat;if(lib.length<=1){toast('至少保留一个品类');return;}confirmDialog('删除该品类及其下全部线框图？',()=>{withAction('delete-cat-'+id,'正在删除品类…','品类已删除','删除品类失败',()=>{const nextState=WireframeLibrary.deleteCategory(lib,activeCat,id);lib=nextState.library;activeCat=nextState.activeCategoryId;if(!saveLib())throw new Error('本地保存失败');refreshPicker();toast('已删除品类');},dc);},{preserveParent:true});return;}
  const ct=e.target.closest('[data-cat]'); if(ct&&!e.target.closest('.act')){activeCat=WireframeLibrary.selectCategory(lib,activeCat,ct.dataset.cat);saveLib();refreshPicker();return;}
  if(e.target.closest('[data-addcat]')){inputDialog('新品类名称','',nm=>{const c={id:uid(),name:nm,imgs:[]};lib=WireframeLibrary.addCategory(lib,c);activeCat=c.id;saveLib();refreshPicker();toast('已添加品类「'+nm+'」');});return;}
  if(e.target.closest('[data-sorttime]')){const c=lib.find(x=>x.id===activeCat);if(c){lib=WireframeLibrary.sortImagesByTime(lib,activeCat);saveLib();refreshPicker();toast('已按上传时间排序');}return;}
  if(e.target.closest('[data-upimg]')){const fi=$('upinput');if(fi)fi.click();return;}
  // 删除线框图（选中/悬停时图片右上角的 ×）
  const di=e.target.closest('[data-delimg]'); if(di){e.stopPropagation();const c=lib.find(x=>x.id===activeCat);const imgId=di.dataset.delimg;confirmDialog('删除这张线框图？',()=>{withAction('delete-wireframe-'+imgId,'正在删除线框图…','线框图已删除','删除线框图失败',()=>{c.imgs=c.imgs.filter(x=>x.id!==imgId);if(pickerGroup!=null&&wf.groups[pickerGroup].frame&&wf.groups[pickerGroup].frame.id===imgId){wf.groups[pickerGroup].frame=null;renderWireframe();}if(!saveLib())throw new Error('本地保存失败');hidePreview();refreshPicker();toast('已删除');},di);});return;}
  const wi=e.target.closest('[data-img]'); if(wi&&pickerGroup!=null){const c=lib.find(x=>x.id===activeCat);const im=c.imgs.find(x=>x.id===wi.dataset.img);if(im){pushWf();const frameSrc=typeof wireframeDisplaySrc==='function'?wireframeDisplaySrc(im.src):im.src;wf.groups[pickerGroup].frame={id:im.id,src:frameSrc,name:im.name};renderWireframe();updatePickerSelectionUi(im.id);toast('✓ 已选择，已同步到「排版参考图」');}return;}
});

// 悬停放大预览（置顶、不被遮挡）
const _prev=document.createElement('div');_prev.id='imgPreview';_prev.innerHTML='<img alt="">';document.body.appendChild(_prev);
function hidePreview(){_prev.style.display='none';}
function showPreview(src,tile){const img=_prev.querySelector('img');img.src=src;_prev.style.display='block';const r=tile.getBoundingClientRect();const pw=300;const vw=innerWidth,vh=innerHeight;let left=r.right+12;if(left+pw>vw-8)left=r.left-pw-12;if(left<8)left=8;let top=Math.min(Math.max(r.top,8),Math.max(8,vh-330));_prev.style.left=left+'px';_prev.style.top=top+'px';}
document.addEventListener('mouseover',e=>{if(pickerGroup==null)return;const t=e.target.closest('.wfimg');if(!t||t.querySelector('.wf-thumb.error,.wf-thumb.loading'))return;const im=t.querySelector('img[data-wireframe-thumb]');if(im&&im.naturalWidth>0)showPreview(im.currentSrc||im.src,t);});
document.addEventListener('mouseout',e=>{const t=e.target.closest('.wfimg');if(t&&!t.contains(e.relatedTarget))hidePreview();});

// 线框图拖拽排序
function clearSubtitleDragVisuals(){
  document.querySelectorAll('.subtitle-option.dragging,.subtitle-option.drag-over').forEach(el=>el.classList.remove('dragging','drag-over'));
}
document.addEventListener('dragstart',e=>{
  const t=e.target.closest&&e.target.closest('[data-subtitle-drag]');
  if(!t)return;
  const parts=t.dataset.subtitleDrag.split('|'),ci=+parts[0],si=+parts[1];
  const b=copies[ci]&&normalizeCopyBlock(copies[ci].block);
  if(!b||!b.selectedSubtitles.includes(si)){e.preventDefault();return;}
  subtitleDragState={ci,si};
  t.classList.add('dragging');
  if(e.dataTransfer){e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain',t.dataset.subtitleDrag);}catch(_){} }
});
document.addEventListener('dragover',e=>{
  const t=e.target.closest&&e.target.closest('[data-subtitle-drag]');
  if(!t||!subtitleDragState)return;
  const parts=t.dataset.subtitleDrag.split('|'),ci=+parts[0],si=+parts[1];
  if(ci!==subtitleDragState.ci||si===subtitleDragState.si)return;
  e.preventDefault();
  document.querySelectorAll('.subtitle-option.drag-over').forEach(el=>{if(el!==t)el.classList.remove('drag-over');});
  t.classList.add('drag-over');
  if(e.dataTransfer)e.dataTransfer.dropEffect='move';
});
document.addEventListener('dragleave',e=>{
  const t=e.target.closest&&e.target.closest('[data-subtitle-drag]');
  if(t&&!t.contains(e.relatedTarget))t.classList.remove('drag-over');
});
document.addEventListener('drop',e=>{
  const t=e.target.closest&&e.target.closest('[data-subtitle-drag]');
  if(!t||!subtitleDragState)return;
  const parts=t.dataset.subtitleDrag.split('|'),ci=+parts[0],targetSi=+parts[1];
  if(ci!==subtitleDragState.ci){clearSubtitleDragVisuals();subtitleDragState=null;return;}
  e.preventDefault();
  const c=copies[ci];
  if(c){
    const b=normalizeCopyBlock(c.block),order=[...b.selectedSubtitles];
    const from=order.indexOf(subtitleDragState.si),to=order.indexOf(targetSi);
    if(from>=0&&to>=0&&from!==to){
      const [moved]=order.splice(from,1);order.splice(to,0,moved);
      b.selectedSubtitles=order;c.block=b;syncCopyVersionToBoundTasks(ci);renderCopyOut();
      setActionStatus('success','小标题顺序已更新：'+selectedSubtitleTexts(b).map((x,i)=>(i+1)+'. '+x).join('；'),false);
    }
  }
  clearSubtitleDragVisuals();subtitleDragState=null;
});
document.addEventListener('dragend',()=>{clearSubtitleDragVisuals();subtitleDragState=null;});

document.addEventListener('dragstart',e=>{const t=e.target.closest('[data-img]');if(!t||pickerGroup==null)return;_dragImg=t.dataset.img;t.classList.add('drag');hidePreview();});
document.addEventListener('dragend',e=>{const t=e.target.closest('[data-img]');if(t)t.classList.remove('drag');_dragImg=null;});
document.addEventListener('dragover',e=>{if(_dragImg!=null&&e.target.closest('#imggrid'))e.preventDefault();});
document.addEventListener('drop',e=>{const t=e.target.closest('[data-img]');if(_dragImg==null||!t)return;e.preventDefault();const c=lib.find(x=>x.id===activeCat);const from=c.imgs.findIndex(x=>x.id===_dragImg),to=c.imgs.findIndex(x=>x.id===t.dataset.img);if(from>=0&&to>=0&&from!==to){const[m]=c.imgs.splice(from,1);c.imgs.splice(to,0,m);}_dragImg=null;saveLib();refreshPicker();});

// Ctrl/⌘+Z 撤回（仅线框视图）
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&(e.key==='z'||e.key==='Z')){
    if(curView==='integrate'){e.preventDefault();undoWf();}
  }
});


/* V14 图片微调区域画笔交互 */
main.addEventListener('click',e=>{
  if(curView!=='adjust')return;
  const open=e.target.closest('[data-adj-open]');if(open){const f=$('adj-file');if(f)f.click();return;}
  if(e.target.closest('[data-adj-undo]')){adjustUndo();return;}
  if(e.target.closest('[data-adj-redo]')){adjustRedo();return;}
  if(e.target.closest('[data-adj-reset]')){adjustReset();return;}
  if(e.target.closest('[data-adj-compare]')){adjustState.previewOriginal=!adjustState.previewOriginal;adjustRenderCanvas();return;}
  if(e.target.closest('[data-adj-show-marks]')){adjustState.showAnnotations=!adjustState.showAnnotations;renderAdjustView();return;}
  if(e.target.closest('[data-adj-download]')){withAction('adjust-download','正在导出图片…','图片导出完成','图片导出失败',()=>new Promise(resolve=>{adjustDownload();setTimeout(resolve,80);}),e.target.closest('[data-adj-download]'));return;}
  if(e.target.closest('[data-adj-copy-task]')){adjustCopyTaskJson();return;}
  if(e.target.closest('[data-adj-api-config]')){openImgCfg();return;}
  if(e.target.closest('[data-adj-api-test]')){runApiDiagnose(true);return;}
  if(e.target.closest('[data-adj-ai-history]')){adjustOpenAiHistory();return;}
  if(e.target.closest('[data-adj-project-save]')){adjustExportProject();return;}
  if(e.target.closest('[data-adj-project-open]')){const f=$('adj-project-file');if(f)f.click();return;}
  if(e.target.closest('[data-adj-guide-toggle]')){adjustState.guideMode=!adjustState.guideMode;if(adjustState.guideMode)adjustState.simpleMode=true;renderAdjustView();return;}
  const gs=e.target.closest('[data-adj-guide-step]');if(gs){adjustGuideSetStep(Number(gs.dataset.adjGuideStep));return;}
  if(e.target.closest('[data-adj-guide-prev]')){adjustGuideSetStep(adjustState.guideStep-1);return;}
  if(e.target.closest('[data-adj-guide-next]')){if(adjustState.guideStep<3)adjustGuideSetStep(adjustState.guideStep+1);else{const ids=adjustState.aiScope==='all'?adjustUsableColorIds():[adjustState.activeBrush];adjustGenerateCandidates(ids,{queue:false});}return;}
  if(e.target.closest('[data-adj-auto-detect]')){adjustAutoDetectRegions();return;}
  if(e.target.closest('[data-adj-recommend-params]')){adjustRecommendParameters();return;}
  if(e.target.closest('[data-adj-auto-deps]')){adjustAutoDependencies();return;}
  if(e.target.closest('[data-adj-apply-deps]')){adjustApplyDependencyOrder(false);return;}
  const mode=e.target.closest('[data-adj-mode]');if(mode){adjustState.simpleMode=mode.dataset.adjMode==='simple';renderAdjustView();return;}
  const rec=e.target.closest('[data-adj-recommend]');if(rec){const id=rec.dataset.adjRecommend,t=ADJUST_TEMPLATES.find(x=>x.id===rec.dataset.template);if(t&&adjustState.brushes[id]){adjustState.brushes[id].template=t.id;adjustState.brushes[id].prompt=t.text;adjustPushHistory('应用智能推荐模板');renderAdjustView();requestAnimationFrame(()=>{const ta=document.querySelector(`[data-adj-brush-prompt="${id}"]`);if(ta)ta.focus();});}return;}
  const aiColor=e.target.closest('[data-adj-ai-color]');if(aiColor){adjustGenerateCandidates([aiColor.dataset.adjAiColor],{queue:false});return;}
  if(e.target.closest('[data-adj-ai-run]')){const ids=adjustState.aiScope==='all'?adjustUsableColorIds():[adjustState.activeBrush];adjustGenerateCandidates(ids,{queue:false});return;}
  const qm=e.target.closest('[data-adj-queue-move]');if(qm){adjustQueueMove(qm.dataset.adjQueueMove,Number(qm.dataset.dir));return;}
  if(e.target.closest('[data-adj-queue-start]')){adjustQueueStart();return;}
  if(e.target.closest('[data-adj-queue-next]')){adjustQueueNext();return;}
  if(e.target.closest('[data-adj-queue-skip]')){adjustQueueSkip();return;}
  if(e.target.closest('[data-adj-queue-stop]')){adjustQueueStop();return;}
  const cu=e.target.closest('[data-adj-candidate-use]');if(cu){adjustConfirmCandidate(Number(cu.dataset.adjCandidateUse));return;}
  const cp=e.target.closest('[data-adj-candidate-preview]');if(cp&&adjustState.candidateBatch){const item=adjustState.candidateBatch.results[Number(cp.dataset.adjCandidatePreview)];if(item)openImgPreview(item.src,'局部编辑候选预览');return;}
  if(e.target.closest('[data-adj-candidate-regenerate]')&&adjustState.candidateBatch){const b=adjustState.candidateBatch;adjustState.candidateBatch=null;adjustGenerateCandidates(b.ids,{queue:b.queue});return;}
  const mask=e.target.closest('[data-adj-mask]');if(mask){adjustExportMask(mask.dataset.adjMask);return;}
  const brush=e.target.closest('[data-adj-brush]');if(brush){adjustState.activeBrush=brush.dataset.adjBrush;adjustState.brushTool='brush';renderAdjustView();return;}
  const tool=e.target.closest('[data-adj-tool]');if(tool){adjustState.brushTool=tool.dataset.adjTool;renderAdjustView();return;}
  if(e.target.closest('[data-adj-clear-color]')){const before=adjustState.strokes.length;adjustState.strokes=adjustState.strokes.filter(s=>s.brushId!==adjustState.activeBrush);if(before!==adjustState.strokes.length){adjustPushHistory('清空'+adjustBrushDef(adjustState.activeBrush).label);adjustRenderCanvas();setActionStatus('success','已清空当前颜色标注',false);}else setActionStatus('success','当前颜色没有标注',false);return;}
  if(e.target.closest('[data-adj-clear-all]')){if(adjustState.strokes.length){adjustState.strokes=[];adjustPushHistory('清空全部区域标注');adjustRenderCanvas();setActionStatus('success','已清空全部标注',false);}else setActionStatus('success','当前没有标注',false);return;}
  const rot=e.target.closest('[data-adj-rotate]');if(rot&&adjustState.img){adjustState.rotate=(adjustState.rotate+Number(rot.dataset.adjRotate))%360;adjustState.previewOriginal=false;adjustPushHistory('旋转图片');renderAdjustView();return;}
  const flip=e.target.closest('[data-adj-flip]');if(flip&&adjustState.img){if(flip.dataset.adjFlip==='x')adjustState.flipX*=-1;else adjustState.flipY*=-1;adjustState.previewOriginal=false;adjustPushHistory('翻转图片');renderAdjustView();return;}
  const crop=e.target.closest('[data-adj-crop]');if(crop&&adjustState.img){adjustState.crop=crop.dataset.adjCrop;adjustState.previewOriginal=false;adjustPushHistory('调整画幅比例');renderAdjustView();return;}
});
main.addEventListener('input',e=>{
  if(curView!=='adjust')return;
  const r=e.target.closest('[data-adj-range]');if(r){const key=r.dataset.adjRange;adjustState.settings[key]=Number(r.value);adjustState.previewOriginal=false;const out=$('adj-out-'+key);if(out)out.textContent=r.value+(key==='hue'?'°':key==='blur'?'px':key==='brightness'||key==='contrast'||key==='saturation'?'%':'');adjustRenderCanvas();return;}
  if(e.target.matches('[data-adj-quality]')){adjustState.quality=Number(e.target.value)/100;return;}
  if(e.target.matches('[data-adj-brush-size]')){adjustState.brushSize=Number(e.target.value);const out=$('adj-brush-size-out');if(out)out.textContent=adjustState.brushSize+'px';return;}
  const prompt=e.target.closest('[data-adj-brush-prompt]');if(prompt){const id=prompt.dataset.adjBrushPrompt;if(adjustState.brushes[id]){adjustState.brushes[id].prompt=prompt.value;adjustState.brushes[id].recommendation=adjustRecommendTemplate(prompt.value);}adjustRefreshBrushSummary();return;}
  if(e.target.matches('[data-adj-mask-feather]')){adjustState.maskFeather=Number(e.target.value);const n=e.target.nextElementSibling;if(n)n.textContent=adjustState.maskFeather+'px';return;}
  if(e.target.matches('[data-adj-mask-expand]')){adjustState.maskExpand=Number(e.target.value);const n=e.target.nextElementSibling;if(n)n.textContent=adjustState.maskExpand+'px';return;}
});
main.addEventListener('change',e=>{
  const older=e.target.closest('[data-copy-snapshot-older]');if(older){if(older.value)copySnapshotSwitch(older.value);return;}
  if(curView!=='adjust')return;
  if(e.target.id==='adj-file'){adjustLoadFile(e.target.files&&e.target.files[0]);e.target.value='';return;}
  if(e.target.id==='adj-project-file'){adjustImportProjectFile(e.target.files&&e.target.files[0]);e.target.value='';return;}
  const dep=e.target.closest('[data-adj-dependency]');if(dep){adjustState.dependencies[dep.dataset.adjDependency]=dep.value||'';if(adjustDependencyCycle()){adjustState.dependencies[dep.dataset.adjDependency]='';setActionStatus('error','不能形成循环依赖，已取消该设置',false);}else{adjustPushHistory('更新区域依赖关系');adjustApplyDependencyOrder(true);setActionStatus('success','区域依赖关系已更新',false);}renderAdjustView();return;}
  const tpl=e.target.closest('[data-adj-template]');if(tpl){const id=tpl.dataset.adjTemplate,t=ADJUST_TEMPLATES.find(x=>x.id===tpl.value);if(adjustState.brushes[id]){adjustState.brushes[id].template=tpl.value;if(t&&t.text)adjustState.brushes[id].prompt=t.text;}adjustPushHistory('应用'+(t?t.label:'常用')+'模板');renderAdjustView();requestAnimationFrame(()=>{const ta=document.querySelector(`[data-adj-brush-prompt="${id}"]`);if(ta)ta.focus();});return;}
  if(e.target.matches('[data-adj-auto-color]')){adjustState.autoSelectColor=!!e.target.checked;adjustPushHistory('切换自动选择颜色');return;}
  if(e.target.matches('[data-adj-ai-scope]')){adjustState.aiScope=e.target.value;return;}
  if(e.target.matches('[data-adj-candidate-count]')){adjustState.candidateCount=Math.max(2,Math.min(4,Number(e.target.value)||3));renderAdjustView();return;}
  const r=e.target.closest('[data-adj-range]');if(r){adjustPushHistory('调整'+r.dataset.adjRange);adjustRefreshHistoryButtons();return;}
  const prompt=e.target.closest('[data-adj-brush-prompt]');if(prompt){adjustPushHistory('更新'+adjustBrushDef(prompt.dataset.adjBrushPrompt).label+'修改指令');adjustRefreshHistoryButtons();return;}
  if(e.target.matches('[data-adj-format]')){adjustState.format=e.target.value;renderAdjustView();return;}
  if(e.target.matches('[data-adj-export-content]')){adjustState.exportAnnotations=e.target.value==='marked';return;}
  if(e.target.matches('[data-adj-quality]')){adjustState.quality=Number(e.target.value)/100;return;}
});

const APP_BOOT_ROUTE=window.AppRoutePersistence?window.AppRoutePersistence.boot():{route:'home',isReload:false,navigationType:'navigate',source:'default'};
try{window.AppPageStateLifecycle&&window.AppPageStateLifecycle.prepareBoot(APP_BOOT_ROUTE.route,APP_BOOT_ROUTE);}catch(_e){}
render(APP_BOOT_ROUTE.route);
