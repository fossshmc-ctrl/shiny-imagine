/* ======================================================================
   V26 primary route + unified save/recovery + session-scoped refresh anchor
   - Empty workbench stays empty after browser refresh.
   - Manual history restore cannot hijack the next refresh target.
   - Only the explicitly anchored current project may auto-restore on reload.
   - Keeps five independent region projects and clean /region/* routes.
   ====================================================================== */
(function(){
  'use strict';

  const VERSION='V27';
  const APP_TITLE=window.__APP_TITLE__||'V27.9 · 图灵线框工作台';
  const DB_NAME='turing_region_projects_v21';
  const DB_STORE='projects';
  const ACTIVE_PROJECT_KEY='turing_region_v21_active_project';
  const SESSION_UI_KEY='turing_region_v21_ui';
  const MAX_PROJECTS=5;
  const LEGACY_CLEANED_KEY='turing_region_v21_1_legacy_cleaned';
  const LEGACY_DATABASES=['ai_studio_adjust_autosave_v138','ai_studio_adjust_v14_timeline','turing_region_projects_v20_9','turing_region_refresh_v20_9','turing_region_projects_v20.9'];
  const VALID_VIEWS=new Set(window.AppRoutePersistence?.VALID_ROUTES||['home','copy','integrate','image','adjust','users','audit']);
  const VALID_PANELS=new Set(['files','regions','canvas','adjust','details','quality']);
  const VIEW_PATH={home:'/',copy:'/copy',integrate:'/wireframe',image:'/image',adjust:'/region/canvas',users:'/users',audit:'/audit'};
  const PATH_VIEW={'/':'home','/copy':'copy','/wireframe':'integrate','/image':'image','/users':'users','/audit':'audit'};
  const navEntry=performance.getEntriesByType?.('navigation')?.[0];
  const isReload=!!(navEntry&&navEntry.type==='reload');
  const $=s=>document.querySelector(s);

  let routeWrapped=false;
  let routeSyncing=false;
  let retryTimer=0;
  let decorating=false;
  let lastPanel='';
  let saveTimer=0;
  let savePromise=null;
  let restorePromise=null;
  let restoreAttempted=false;
  let mutationEpoch=0;
  let currentProjectId='';
  let currentProjectName='';
  let currentFileMeta=null;
  let saveState='saved';
  let saveStateMessage='已保存';
  let lastSavedAt='';
  let lastKnownRegionCount=-1;
  let uploadInProgress=false;
  let mutationQueue=Promise.resolve();
  let baseProjectPayload=null;
  let baseImportProject=null;
  let lastImageSwitchReport=null;
  let manualRestorePreview=false;

  function state(){return typeof adjustState!=='undefined'&&adjustState.v15Ocr&&typeof adjustState.v15Ocr==='object'?adjustState.v15Ocr:null;}
  function openFunction(){return window.openV154OcrWorkspace||window.openV153OcrWorkspace||window.openV152OcrWorkspace||window.openV151OcrWorkspace||window.openV155SmartRegionWorkspace;}
  function safeLocalGet(key){try{return localStorage.getItem(key)||'';}catch(_e){return'';}}
  function safeLocalSet(key,value){try{localStorage.setItem(key,String(value));}catch(_e){}}
  function safeSessionGet(key){try{return sessionStorage.getItem(key)||'';}catch(_e){return'';}}
  function safeSessionSet(key,value){try{sessionStorage.setItem(key,String(value));}catch(_e){}}
  function safeLocalRemove(key){try{localStorage.removeItem(key);}catch(_e){}}
  function safeSessionRemove(key){try{sessionStorage.removeItem(key);}catch(_e){}}
  function legacyCleaned(){return safeLocalGet(LEGACY_CLEANED_KEY)==='1';}
  function legacyStorageKey(key){const k=String(key||'');if(/^ai_studio_adjust_(?:autosave|timeline|recovery)/i.test(k))return true;return /^turing_region_/i.test(k)&&!/v21(?:[._-]|$)/i.test(k)&&/(?:v?20(?:[._-]?\d+)*|route|refresh|project|autosave|recovery)/i.test(k);}
  function deleteDatabase(name){return new Promise(resolve=>{try{const open=indexedDB.open(name);open.onerror=()=>resolve({name,ok:false});open.onupgradeneeded=()=>{};open.onsuccess=()=>{const db=open.result,stores=[...db.objectStoreNames];if(!stores.length){db.close();const del=indexedDB.deleteDatabase(name);del.onsuccess=()=>resolve({name,ok:true});del.onerror=()=>resolve({name,ok:false});del.onblocked=()=>resolve({name,ok:true,cleared:true,blocked:true});return;}try{const tx=db.transaction(stores,'readwrite');stores.forEach(store=>tx.objectStore(store).clear());tx.oncomplete=()=>{db.close();const del=indexedDB.deleteDatabase(name);del.onsuccess=()=>resolve({name,ok:true});del.onerror=()=>resolve({name,ok:true,cleared:true});del.onblocked=()=>resolve({name,ok:true,cleared:true,blocked:true});};tx.onerror=()=>{db.close();resolve({name,ok:false});};}catch(_e){db.close();resolve({name,ok:false});}};}catch(_e){resolve({name,ok:false});}});}
  async function legacyDatabaseNames(){const names=new Set(LEGACY_DATABASES);try{if(typeof indexedDB.databases==='function'){for(const item of await indexedDB.databases()){const name=String(item&&item.name||'');if(!name||name===DB_NAME)continue;if((/^(?:ai_studio_adjust_|turing_region_)/i.test(name)||/(?:region|adjust).*(?:autosave|timeline|project)/i.test(name))&&!/v21(?:[._-]|$)/i.test(name))names.add(name);}}}catch(_e){}return [...names];}
  function suppressLegacyRecoveryUi(){if(!legacyCleaned())return;try{if(typeof adjustState!=='undefined'){adjustState.autosaveAvailable=false;adjustState.lastAutosaveAt='';adjustState.autosaveRecordAt='';adjustState.autosaveTimeline=[];adjustState.timelineLoaded=true;adjustState.recoveryDismissed=true;adjustState.autosaveEnabled=false;}}catch(_e){}document.querySelectorAll('.adjust-recovery,.v14-recovery,[data-adj-autosave-restore],[data-adj-autosave-clear],[data-adj-autosave-status]').forEach(el=>el.remove());}
  async function clearLegacyRecords(){
    setSaveState('saving','正在清理旧记录…');
    const dbNames=await legacyDatabaseNames();
    const dbResults=await Promise.all(dbNames.map(deleteDatabase));
    let localCount=0,sessionCount=0;
    try{for(let i=localStorage.length-1;i>=0;i--){const key=localStorage.key(i);if(legacyStorageKey(key)){localStorage.removeItem(key);localCount++;}}}catch(_e){}
    try{for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(legacyStorageKey(key)){sessionStorage.removeItem(key);sessionCount++;}}}catch(_e){}
    safeLocalSet(LEGACY_CLEANED_KEY,'1');suppressLegacyRecoveryUi();
    const deleted=dbResults.filter(x=>x.ok).length;
    setSaveState('saved','旧记录已清理');
    setActionStatus?.('success',`已清理 V20.9 及更早记录：${deleted} 个数据库、${localCount+sessionCount} 个缓存键`,false);
    showRecoveryBar('V20.9 及更早的自动保存、时间线和路由缓存已清理；V21/V24 当前项目不受影响',0,'cleanup');
    return {deleted,localCount,sessionCount,dbResults};
  }
  function nowIso(){return new Date().toISOString();}
  function timeText(value){try{return new Date(value).toLocaleString('zh-CN',{hour12:false});}catch(_e){return String(value||'');}}
  function esc(value){return String(value==null?'':value).replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function clone(value){try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}}
  function currentPath(){return location.pathname.replace(/\/+$/,'')||'/';}
  function panelFromPath(){const m=currentPath().match(/^\/region\/([^/]+)$/);return m&&VALID_PANELS.has(m[1])?m[1]:'canvas';}
  function requestedView(){const p=currentPath();if(/^\/region(?:\/|$)/.test(p))return'adjust';return PATH_VIEW[p]||'home';}
  function requestedPanel(){const direct=panelFromPath();if(direct)return direct;try{const ui=JSON.parse(safeSessionGet(SESSION_UI_KEY)||'null');if(ui&&VALID_PANELS.has(ui.panel))return ui.panel;}catch(_e){}return'canvas';}
  function regionUiSnapshot(){const s=state();return s?{panel:s.v157&&VALID_PANELS.has(s.v157.mode)?s.v157.mode:'canvas',activeId:s.activeId||'',bigZoom:Number(s.bigZoom||1),detailsOpen:!!(s.v162Ui&&s.v162Ui.detailsOpen),savedAt:Date.now()}:null;}
  function rememberRegionUi(){const ui=regionUiSnapshot();if(ui)safeSessionSet(SESSION_UI_KEY,JSON.stringify(ui));return ui;}
  function viewPath(view){if(view==='adjust'){const ui=rememberRegionUi(),panel=ui&&VALID_PANELS.has(ui.panel)?ui.panel:requestedPanel();return'/region/'+panel;}return VIEW_PATH[view]||'/';}
  function syncUrl(view,opts={}){
    if(routeSyncing)return;
    const normalized=VALID_VIEWS.has(view)?view:'home';
    routeSyncing=true;
    try{
      const path=viewPath(normalized),method=opts.push?'pushState':'replaceState';
      history[method]({view:normalized,panel:normalized==='adjust'?path.split('/').pop():null},'',path);
    }catch(_e){}finally{routeSyncing=false;}
  }

  function dbOpen(){
    return new Promise((resolve,reject)=>{
      const r=indexedDB.open(DB_NAME,1);
      r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(DB_STORE)){const st=db.createObjectStore(DB_STORE,{keyPath:'id'});st.createIndex('updatedAt','updatedAt',{unique:false});}};
      r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
    });
  }
  async function dbGet(id){try{const db=await dbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}catch(_e){return null;}}
  async function dbGetAll(){try{const db=await dbOpen();return await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).getAll();r.onsuccess=()=>resolve((r.result||[]).filter(x=>x&&x.id));r.onerror=()=>reject(r.error);});}catch(_e){return[];}}
  async function dbPut(record){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(record);tx.oncomplete=()=>resolve(record);tx.onerror=()=>reject(tx.error);});}
  async function dbDelete(id){try{const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch(_e){}}
  async function pruneProjects(){const all=(await dbGetAll()).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));for(const rec of all.slice(MAX_PROJECTS))if(rec.id!==currentProjectId)await dbDelete(rec.id);}

  function regionCountFromPayload(payload){const a=payload&&payload.state&&payload.state.v155RegionData&&payload.state.v155RegionData.regions;return Array.isArray(a)?a.length:0;}
  function currentRegionCount(){const s=state();return s&&s.result&&Array.isArray(s.result.regions)?s.result.regions.length:0;}
  function projectIdFromPayload(payload){return String(payload?.state?.v21ProjectMeta?.projectId||payload?.state?.v21ProjectId||'');}
  function readRefreshAnchor(){return window.RegionRefreshAnchor?.read?.()||null;}
  function refreshAnchorProjectId(){const anchor=readRefreshAnchor();return anchor&&anchor.mode==='project'?String(anchor.projectId||''):'';}
  function setRefreshEmptyAnchor(reason='empty-workspace'){return window.RegionRefreshAnchor?.writeEmpty?.(reason)||null;}
  function setRefreshProjectAnchor(projectId,reason='current-workspace',versionKey='refreshAnchor'){return window.RegionRefreshAnchor?.writeProject?.(projectId,reason,undefined,versionKey)||null;}
  function activeProjectId(){return currentProjectId||refreshAnchorProjectId();}
  function setActiveProject(id,name){currentProjectId=String(id||'');currentProjectName=String(name||'');safeLocalRemove(ACTIVE_PROJECT_KEY);}
  function beginFreshRegionEntry(reason='fresh-entry'){
    /* V26: an intentionally empty workbench must stay empty after F5.
       Never resurrect a historical local active-project pointer. */
    if(typeof adjustState==='undefined'||!adjustState.img)setRefreshEmptyAnchor(reason);
  }

  function setSaveState(next,message){
    saveState=next;saveStateMessage=message||({saved:'已保存',saving:'保存中',dirty:'有未保存修改',error:'保存失败'}[next]||'');
    decorateStatus();
  }
  function markDirty(reason){if(uploadInProgress)return;setSaveState('dirty',reason?'有未保存修改 · '+reason:'有未保存修改');scheduleSave(reason||'interaction');}
  function scheduleSave(reason='interaction',delay=850){clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveProjectVersion('autosave',reason),delay);}
  function enqueueMutation(fn){const run=mutationQueue.then(fn,fn);mutationQueue=run.catch(()=>{});return run;}

  async function fileDataUrl(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('文件读取失败'));r.readAsDataURL(file);});}
  async function fileFingerprint(file){
    try{const buf=await file.arrayBuffer(),digest=await crypto.subtle.digest('SHA-256',buf);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,'0')).join('');}
    catch(_e){return btoa(unescape(encodeURIComponent([file.name,file.size,file.lastModified].join('|')))).replace(/[^a-z0-9]/gi,'').slice(0,32);}
  }
  function resetOcrForImage(src,name,imageKey){
    const s=state();if(!s)return;
    const mode=s.mode,panel=s.v157&&VALID_PANELS.has(s.v157.mode)?s.v157.mode:'canvas';
    if(typeof window.__V22_BEGIN_IMAGE_SESSION__==='function')window.__V22_BEGIN_IMAGE_SESSION__(src,name,'v22-upload-image',imageKey);else{s.v22ImageRevision=(Number(s.v22ImageRevision)||0)+1;s.v22RecognitionEpoch=(Number(s.v22RecognitionEpoch)||0)+1;s.v22AppliedRecognitionEpoch=0;s.v22ImageKey=String(imageKey||'');window.__V22_RESET_REGION_WORKSPACE__?.('v22-upload-image',{preserveUi:true,imageKey:s.v22ImageKey});}
    s.src=src;s.name=name;s.source='main';s.busy=false;s.message='新图片已载入，旧区域已清空，等待识别';s.error='';s.result=null;s.selected=[];s.activeId='';s.crop=null;s.cropConfirmed=false;s.selectionMode=false;s.correctionMode=false;s.correctionAddMode=false;s.progress={phase:'idle',message:'等待开始识别',startedAt:0,elapsed:0,jobId:'',scope:'full'};s.progressExpanded=false;s.localMenuOpen=false;s.recognitionMenuOpen=false;s.fullRecognitionMode='replace_all';s.visualApiWarning=null;s.v192AddRegionOpen=false;s.v199CreationStep='info';s.v157=s.v157||{};s.v157.mode=panel;s.mode=mode;
  }

  function installPayloadWrappers(){
    if(baseProjectPayload||typeof window.adjustProjectPayload!=='function')return;
    baseProjectPayload=window.adjustProjectPayload;
    window.adjustProjectPayload=function(mode='full'){
      const p=baseProjectPayload(mode);p.version=VERSION;p.state=p.state||{};
      p.state.v21ProjectId=currentProjectId||p.state.v21ProjectId||'';
      p.state.v21ProjectMeta={projectId:currentProjectId||'',name:currentProjectName||adjustState.name||'',fileMeta:currentFileMeta||null,savedAt:nowIso(),routePanel:state()?.v157?.mode||'canvas'};
      p.state.v21SafeRefreshRecovery=true;p.state.v21MultiProjectSlots=MAX_PROJECTS;
      return p;
    };
    baseImportProject=window.adjustImportProjectFile;
  }

  async function payloadForSave(){installPayloadWrappers();if(typeof window.adjustProjectPayload!=='function'||typeof adjustState==='undefined'||!adjustState.img)return null;return window.adjustProjectPayload('full');}
  async function saveProjectVersion(kind='autosave',reason='interaction',opts={}){
    if(savePromise)return savePromise;
    if(typeof curView==='undefined'||curView!=='adjust'||typeof adjustState==='undefined'||!adjustState.img||(uploadInProgress&&!opts.allowUpload))return false;
    installPayloadWrappers();
    savePromise=(async()=>{
      setSaveState('saving','保存中…');
      try{
        let payload=await payloadForSave();if(!payload)return false;
        let projectId=currentProjectId||projectIdFromPayload(payload);
        if(!projectId){projectId='project_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8);setActiveProject(projectId,adjustState.name||'未命名图片');payload=await payloadForSave();}
        const existing=await dbGet(projectId),at=nowIso(),count=regionCountFromPayload(payload),version={kind,updatedAt:at,reason,regionCount:count,payload};
        const rec=existing||{id:projectId,createdAt:at,versions:{}};rec.name=adjustState.name||currentProjectName||'未命名图片';rec.updatedAt=at;rec.version=VERSION;rec.fileMeta=currentFileMeta||rec.fileMeta||null;rec.regionCount=count;rec.panel=state()?.v157?.mode||'canvas';rec.versions=rec.versions||{};rec.versions[kind]=version;
        const anchor=readRefreshAnchor();
        if(kind==='autosave'&&anchor?.mode==='project'&&anchor.projectId===projectId&&!manualRestorePreview){
          rec.versions.refreshAnchor={kind:'refreshAnchor',updatedAt:at,reason:'刷新锚点快照 · '+reason,regionCount:count,payload:clone(payload)};
        }
        if(kind==='autosave'&&!rec.versions.initial)rec.versions.initial={kind:'initial',updatedAt:at,reason:'首次载入图片',regionCount:count,payload:clone(payload)};
        if(count>0&&!rec.versions.initialRecognition)rec.versions.initialRecognition={kind:'initialRecognition',updatedAt:at,reason:'首次识别完成',regionCount:count,payload:clone(payload)};
        await dbPut(rec);await pruneProjects();setActiveProject(projectId,rec.name);lastSavedAt=at;lastKnownRegionCount=count;setSaveState('saved','已保存 · '+new Date(at).toLocaleTimeString('zh-CN',{hour12:false}));
        return true;
      }catch(err){console.error('[V21] save failed',err);setSaveState('error','保存失败 · '+(err&&err.message||'未知错误'));return false;}
      finally{savePromise=null;}
    })();
    return savePromise;
  }

  function frameReady(){return new Promise(resolve=>{if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(resolve));else setTimeout(resolve,32);});}
  function staleRegionDomNodes(){
    return Array.from(document.querySelectorAll([
      '#v15-ocr-overlay .v15-region-box',
      '#v15-ocr-overlay .v155-transform-layer',
      '#v15-ocr-overlay .v161-snap-overlay',
      '#v15-ocr-overlay .v154-region-float',
      '#v15-ocr-overlay .v164-focus-source',
      '#v15-ocr-overlay .v164-focus-target',
      '#v15-ocr-overlay .v194-pending-selection:not([hidden])',
      '#v15-ocr-overlay .v154-add-selection:not([hidden])',
      '#v15-ocr-overlay .v152-local-selection:not([hidden])'
    ].join(',')));
  }
  function clearIntegritySnapshot(expectedKey,priorSession={}){
    const s=state(),issues=[],domNodes=staleRegionDomNodes(),v=s&&s.v155&&typeof s.v155==='object'?s.v155:{};
    const resultRegions=Array.isArray(s?.result?.regions)?s.result.regions.length:0;
    const legacyRegions=typeof adjustState!=='undefined'&&Array.isArray(adjustState.detectedRegions)?adjustState.detectedRegions.length:0;
    const selected=Array.isArray(s?.selected)?s.selected.length:0;
    const history=Array.isArray(v.history)?v.history.length:0;
    const audit=Array.isArray(v.v179Audit)?v.v179Audit.length:0;
    const validation=Array.isArray(v.validation)?v.validation.length:0;
    const conflictIssues=Array.isArray(v.v177ConflictCheck?.issues)?v.v177ConflictCheck.issues.length:0;
    const pending=!!(s?.crop||s?.v194PendingRegionBox||s?.v194RegionDraft||s?.correctionAddMode||s?.selectionMode||s?.correctionMode);
    const keyMatches=!!s&&String(s.v22ImageKey||'')===String(expectedKey||'');
    const epochAdvanced=!!s&&Number(s.v22RecognitionEpoch||0)>Number(priorSession.recognitionEpoch||0);
    const taskInvalidated=keyMatches&&epochAdvanced&&Number(s.v22AppliedRecognitionEpoch||0)===0&&!s.busy;
    if(resultRegions)issues.push(`仍有 ${resultRegions} 个旧识别区域`);
    if(legacyRegions)issues.push(`旧版区域数据仍有 ${legacyRegions} 条`);
    if(selected||s?.activeId)issues.push('旧区域选中状态未清空');
    if(history||audit||validation||conflictIssues)issues.push('旧历史、审计或冲突结果未清空');
    if(pending)issues.push('局部框选或自由添加状态未退出');
    if(domNodes.length)issues.push(`画布仍残留 ${domNodes.length} 个旧框线节点`);
    if(!taskInvalidated)issues.push('旧识别任务会话尚未完全失效');
    return {ok:issues.length===0,issues,domCount:domNodes.length,resultRegions,legacyRegions,selected,history,audit,validation,conflictIssues,pending,keyMatches,epochAdvanced,taskInvalidated,imageKey:String(s?.v22ImageKey||''),recognitionEpoch:Number(s?.v22RecognitionEpoch||0),appliedRecognitionEpoch:Number(s?.v22AppliedRecognitionEpoch||0)};
  }
  function forceSecondaryImageClear(expectedKey,reason='integrity-repair'){
    const s=state();
    if(typeof adjustState!=='undefined'){
      adjustState.detectedRegions=[];
      adjustState.selectedDetectedRegionIds=[];
      adjustState.v142LastConflictReport=null;
      adjustState.protectionWarnings=[];
      adjustState.retryConstraints=[];
    }
    if(s){
      s.result=null;s.selected=[];s.activeId='';s.crop=null;s.cropConfirmed=false;s.selectionMode=false;s.correctionMode=false;s.correctionAddMode=false;s.busy=false;s.error='';s.visualApiWarning=null;s.lastRecognitionDiff=null;s.diffOpen=false;s.diffDetailsOpen=false;s.v192AddRegionOpen=false;s.v194PendingRegionBox=null;s.v194RegionDraft=null;s.v199CreationStep='info';s.v22ImageKey=String(expectedKey||s.v22ImageKey||'');s.v22RecognitionEpoch=(Number(s.v22RecognitionEpoch)||0)+1;s.v22AppliedRecognitionEpoch=0;s.progress={phase:'idle',message:'等待开始识别',startedAt:0,elapsed:0,jobId:'',scope:'full'};s.message='新图片已载入，旧区域已清空，等待识别';
      window.__V22_RESET_REGION_WORKSPACE__?.(`v22.9-${reason}`,{preserveUi:true,imageKey:s.v22ImageKey});
    }
    window.__V2051_DISARM_DRAWING__?.();
    staleRegionDomNodes().forEach(el=>el.remove());
  }
  async function verifyAutoClearIntegrity(expectedKey,priorSession={}){
    await frameReady();
    const before=clearIntegritySnapshot(expectedKey,priorSession);let repaired=false;
    if(!before.ok){
      repaired=true;forceSecondaryImageClear(expectedKey,'integrity-repair');
      if(typeof renderAdjustView==='function')renderAdjustView();openRegionRoute();
      await new Promise(resolve=>setTimeout(resolve,70));await frameReady();
    }
    let after=clearIntegritySnapshot(expectedKey,priorSession);
    if(!after.ok){
      staleRegionDomNodes().forEach(el=>el.remove());
      await frameReady();after=clearIntegritySnapshot(expectedKey,priorSession);
    }
    const report={version:VERSION,checkedAt:nowIso(),expectedKey:String(expectedKey||''),repaired,before,after,ok:after.ok};
    lastImageSwitchReport=report;
    const s=state();if(s){s.v222LastSwitchIntegrity=report;s.v222IntegrityFailed=!after.ok;if(!after.ok){s.error='自动清场完整性检查仍发现残留，请打开诊断详情';s.message=s.error;}}
    return report;
  }
  function integrityDetailsHtml(integrity){
    const after=integrity?.after||{},historyTotal=(Number(after.history)||0)+(Number(after.audit)||0)+(Number(after.validation)||0)+(Number(after.conflictIssues)||0);
    const checks=[
      {label:'旧框线',value:`${Number(after.domCount)||0} 个`,ok:!(Number(after.domCount)||0)},
      {label:'旧识别区域',value:`${Number(after.resultRegions)||0} 个`,ok:!(Number(after.resultRegions)||0)},
      {label:'旧版区域数据',value:`${Number(after.legacyRegions)||0} 条`,ok:!(Number(after.legacyRegions)||0)},
      {label:'旧区域选中',value:`${Number(after.selected)||0} 项`,ok:!(Number(after.selected)||0)},
      {label:'旧历史与冲突',value:`${historyTotal} 项`,ok:!historyTotal},
      {label:'旧识别任务',value:after.taskInvalidated?'已失效':'未完全失效',ok:!!after.taskInvalidated}
    ];
    const abnormal=checks.filter(x=>!x.ok),summary=abnormal.length
      ?`<div class="v224-clear-summary bad"><b>${abnormal.length} 项异常</b>${abnormal.map(x=>`<span>${esc(x.label)}：${esc(x.value)}</span>`).join('')}</div>`
      :'<div class="v224-clear-summary ok"><b>6项检查全部通过</b><span>展开后可查看完整清场数据</span></div>';
    return `<div class="v224-clear-report">${summary}<div class="v223-clear-details" data-v223-clear-details hidden>${checks.map(x=>`<div class="${x.ok?'ok':'bad'}"><span>${esc(x.label)}</span><b>${esc(x.value)}</b></div>`).join('')}</div></div>`;
  }
  function showImageSwitchStatusCard({hadPreviousImage=false,previousName,newName,previousSaved,integrity}){
    const overlay=$('#v15-ocr-overlay');if(!overlay)return;
    overlay.querySelector('.v222-image-switch-card')?.remove();
    const repaired=!!integrity?.repaired,clearOk=!!integrity?.ok,allOk=clearOk&&(!hadPreviousImage||previousSaved);
    const card=document.createElement('section');card.className=`v222-image-switch-card${hadPreviousImage?'':' first-upload'}`;card.dataset.v222ImageSwitchCard='';
    const saveStep=hadPreviousImage?`<div class="${previousSaved?'ok':'warn'}"><i>${previousSaved?'✓':'!'}</i><span><b>${previousSaved?'上一项目已保存':'上一项目保存未确认'}</b><small>${esc(previousName||'上一张图片')}</small></span></div>`:'';
    const clearTitle=hadPreviousImage?(clearOk?'新图片已清场':'新图片清场异常'):(clearOk?'图片已载入':'图片载入异常');
    const clearSub=clearOk?(repaired?'检测到残留后已自动二次清理':'6项检查全部通过'):'默认仅显示异常项，点击查看完整检查';
    card.innerHTML=`<header data-v223-switch-expand role="button" tabindex="0" aria-expanded="true"><div><b>${hadPreviousImage?'图片切换完成':'图片已载入'}</b><span>${esc(newName||'新图片')} · ${allOk?'等待识别':'需要处理异常'}</span></div><span class="v223-card-actions"><button type="button" data-v223-switch-toggle aria-label="折叠或展开状态卡">⌃</button><button type="button" data-v222-switch-close aria-label="关闭状态卡">×</button></span></header><div class="v222-switch-body"><div class="v222-switch-steps ${hadPreviousImage?'':'two-steps'}">${saveStep}<button type="button" class="v223-clear-step ${clearOk?'ok':'bad'}" data-v223-clear-toggle aria-expanded="false"><i>${clearOk?'✓':'!'}</i><span><b>${clearTitle}</b><small>${clearSub}</small></span><em>查看检查项</em></button><div class="waiting"><i>${hadPreviousImage?'3':'2'}</i><span><b>等待识别</b><small>点击“开始识别图片”生成当前图片的新区域</small></span></div></div>${integrityDetailsHtml(integrity)}${repaired?'<footer>完整性检查已执行二次清理，当前画布已重新核验。</footer>':''}</div>`;
    const head=overlay.querySelector('.v15-ocr-head');if(head)head.insertAdjacentElement('afterend',card);else overlay.prepend(card);
    const toggleCard=force=>{const collapsed=typeof force==='boolean'?force:!card.classList.contains('is-collapsed');card.classList.toggle('is-collapsed',collapsed);card.querySelector('[data-v223-switch-expand]')?.setAttribute('aria-expanded',String(!collapsed));const btn=card.querySelector('[data-v223-switch-toggle]');if(btn)btn.textContent=collapsed?'⌄':'⌃';};
    card.querySelector('[data-v222-switch-close]').onclick=e=>{e.stopPropagation();card.remove();};
    card.querySelector('[data-v223-switch-toggle]').onclick=e=>{e.preventDefault();e.stopPropagation();toggleCard();};
    card.querySelector('[data-v223-switch-expand]').onclick=e=>{if(e.target.closest('button'))return;if(card.classList.contains('is-collapsed'))toggleCard(false);};
    card.querySelector('[data-v223-switch-expand]').onkeydown=e=>{if((e.key==='Enter'||e.key===' ')&&card.classList.contains('is-collapsed')){e.preventDefault();toggleCard(false);}};
    const clearToggle=card.querySelector('[data-v223-clear-toggle]'),details=card.querySelector('[data-v223-clear-details]');
    clearToggle.onclick=e=>{e.preventDefault();e.stopPropagation();const open=details.hasAttribute('hidden');details.toggleAttribute('hidden',!open);clearToggle.setAttribute('aria-expanded',String(open));clearToggle.querySelector('em').textContent=open?'收起检查项':'查看检查项';};
    if(allOk)setTimeout(()=>{if(card.isConnected&&!card.querySelector('[data-v223-clear-toggle][aria-expanded="true"]'))toggleCard(true);},4200);
  }

  async function loadUploadedImage(file){
    if(!file)return false;
    if(!/^image\/(png|jpeg|webp)$/i.test(file.type||'')){setActionStatus?.('error','仅支持 PNG、JPG、JPEG 或 WebP 图片',false);return false;}
    if(file.size>30*1024*1024){setActionStatus?.('error','图片超过 30MB，请先压缩后再上传',false);return false;}

    /* V24：更换图片不再询问“保留哪些旧区域”。先静默保存旧项目，再一次性清空旧图片状态。 */
    const hadPreviousImage=typeof adjustState!=='undefined'&&!!adjustState.img;
    const previousName=hadPreviousImage?String(adjustState.name||currentProjectName||'上一张图片'):'';
    const previousState=state(),priorSession={imageKey:String(previousState?.v22ImageKey||''),imageRevision:Number(previousState?.v22ImageRevision||0),recognitionEpoch:Number(previousState?.v22RecognitionEpoch||0),appliedRecognitionEpoch:Number(previousState?.v22AppliedRecognitionEpoch||0)};
    let previousSaveTask=null,previousSaved=!hadPreviousImage;
    if(hadPreviousImage&&!uploadInProgress){
      clearTimeout(saveTimer);
      setSaveState('saving','正在保存当前项目…');
      setActionStatus?.('loading','正在自动保存当前项目并准备更换图片…',true);
      previousSaveTask=Promise.resolve(saveProjectVersion('autosave','更换图片前自动保存')).catch(()=>false);
      try{await Promise.race([previousSaveTask,new Promise(resolve=>setTimeout(resolve,2200))]);}catch(_e){}
    }

    const epoch=++mutationEpoch;restoreAttempted=true;uploadInProgress=true;clearTimeout(saveTimer);setSaveState('saving','正在载入新图片…');setActionStatus?.('loading','正在清空旧区域并建立新项目…',true);
    try{
      const [src,fingerprint]=await Promise.all([fileDataUrl(file),fileFingerprint(file)]),img=await (typeof adjustLoadImageObject==='function'?adjustLoadImageObject(src):new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片读取失败'));im.src=src;}));
      const nameHash=Array.from(file.name||'image').reduce((n,ch)=>((n*33)^ch.charCodeAt(0))>>>0,5381).toString(36);const projectId='p_'+fingerprint.slice(0,16)+'_'+nameHash,meta={name:file.name,size:file.size,lastModified:file.lastModified,type:file.type,fingerprint};
      await enqueueMutation(async()=>{
        if(epoch!==mutationEpoch)return false;
        installPayloadWrappers();
        if(previousSaveTask)previousSaved=!!(await previousSaveTask.catch(()=>false));
        else if(savePromise)await savePromise.catch(()=>{});

        /* 旧图片的区域、框线、选区、局部识别、自由添加、冲突和历史状态在这里统一清场。 */
        if(typeof window.adjustResetRuntime==='function')window.adjustResetRuntime();else if(typeof adjustResetRuntime==='function')adjustResetRuntime();
        adjustState.src=src;adjustState.name=file.name;adjustState.img=img;adjustState.originalSrc=src;adjustState.originalName=file.name;adjustState.autosaveEnabled=false;adjustState.projectLoadedAt='';
        resetOcrForImage(src,file.name,fingerprint);

        currentFileMeta=meta;manualRestorePreview=false;setActiveProject(projectId,file.name);setRefreshProjectAnchor(projectId,'upload-current-image');lastKnownRegionCount=0;
        if(typeof adjustPushHistory==='function')adjustPushHistory('更换图片并自动清空旧区域');
        if(typeof renderAdjustView==='function')renderAdjustView();openRegionRoute();
        const integrity=await verifyAutoClearIntegrity(fingerprint,priorSession);
        setSaveState('dirty','新图片待保存');
        await saveProjectVersion('autosave','上传新图片',{allowUpload:true});
        const prefix=hadPreviousImage?`${previousSaved?'已自动保存':'未能确认保存'}“${previousName}”并清空旧区域；`:'';
        if(integrity.ok){
          setActionStatus?.('success',`${prefix}已载入“${file.name}”，等待重新识别`,false);
          showImageSwitchStatusCard({hadPreviousImage,previousName,newName:file.name,previousSaved,integrity});
        }else{
          setActionStatus?.('error',`已载入“${file.name}”，但自动清场仍发现残留，请打开诊断详情`,false);
          showImageSwitchStatusCard({hadPreviousImage,previousName,newName:file.name,previousSaved,integrity});
        }
        return true;
      });
      return true;
    }catch(err){setSaveState('error','图片载入失败');setActionStatus?.('error','图片读取失败：'+(err&&err.message||err),false);return false;}
    finally{uploadInProgress=false;}
  }

  function installUploadGuard(){
    if(window.__V21_UPLOAD_GUARD_INSTALLED__)return;window.__V21_UPLOAD_GUARD_INSTALLED__=true;
    window.__V221_REPLACE_IMAGE__=loadUploadedImage;
    window.adjustLoadFile=loadUploadedImage;try{adjustLoadFile=loadUploadedImage;}catch(_e){}
  }

  async function applyPayloadRecord(record,versionKey,source='refresh'){
    if(!record)return false;
    const requested=record.versions?.[versionKey];
    const version=source==='refresh'?requested:(requested||record.versions?.autosave||record.versions?.manual||record.versions?.initialRecognition||record.versions?.initial);
    if(!version||!version.payload)return false;
    const epoch=mutationEpoch;
    return enqueueMutation(async()=>{
      if(epoch!==mutationEpoch||uploadInProgress)return false;
      installPayloadWrappers();if(typeof baseImportProject!=='function')baseImportProject=window.adjustImportProjectFile;
      if(typeof baseImportProject!=='function')throw new Error('项目恢复模块尚未准备完成');
      const payload=clone(version.payload),file=new File([JSON.stringify(payload)],`v21-${record.id}-${versionKey}.json`,{type:'application/json'});
      await baseImportProject(file);
      if(epoch!==mutationEpoch||uploadInProgress)return false;
      adjustState.autosaveEnabled=false;manualRestorePreview=source==='manual';currentFileMeta=record.fileMeta||payload?.state?.v21ProjectMeta?.fileMeta||null;setActiveProject(record.id,record.name||payload.image?.name||'恢复项目');lastKnownRegionCount=currentRegionCount();lastSavedAt=version.updatedAt||record.updatedAt||'';clearTimeout(saveTimer);openRegionRoute();applyRequestedUi();setSaveState('saved','已恢复并保存');
      const count=currentRegionCount();showRecoveryBar(`已恢复图片“${record.name||adjustState.name}”、${count} 个区域和当前画布状态`,count,'restore');
      setActionStatus?.('success',`已恢复图片、${count} 个区域和当前画布状态`,false);
      return true;
    });
  }

  async function recentProjects(){return(await dbGetAll()).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||''))).slice(0,MAX_PROJECTS);}
  async function restoreWorkspaceAfterRefresh(force=false){
    if(restoreAttempted||(!force&&requestedView()!=='adjust'))return false;
    restoreAttempted=true;installPayloadWrappers();installUploadGuard();
    const startEpoch=mutationEpoch,anchor=readRefreshAnchor();
    restorePromise=(async()=>{
      try{
        /* V26: refresh recovery is session-anchored.
           Empty/no anchor means stay empty; never fall back to the most recent or historically active project. */
        if(!anchor){setRefreshEmptyAnchor('reload-without-anchor');setSaveState('saved','等待载入图片');return false;}
        if(anchor.mode!=='project'||!anchor.projectId){setSaveState('saved','等待载入图片');return false;}
        const projects=await recentProjects();if(startEpoch!==mutationEpoch||uploadInProgress)return false;
        const rec=projects.find(x=>x.id===anchor.projectId);
        if(!rec){setRefreshEmptyAnchor('missing-anchor-project');setSaveState('saved','刷新目标已失效 · 等待载入图片');return false;}
        return await applyPayloadRecord(rec,anchor.versionKey||'refreshAnchor','refresh');
      }catch(err){console.warn('[V26] refresh recovery failed',err);setSaveState('error','刷新恢复失败');return false;}
      finally{restorePromise=null;}
    })();
    return restorePromise;
  }

  function decorateStatus(){
    const overlay=$('#v15-ocr-overlay'),right=overlay?.querySelector('.v15-ocr-head-right');if(!right)return;
    right.querySelectorAll('[data-v21-version-restore],[data-v155-save-version]').forEach(el=>el.remove());
    let chip=right.querySelector('[data-v21-save-status]');if(!chip){chip=document.createElement('button');chip.type='button';chip.className='v21-save-status';chip.dataset.v21SaveStatus='';right.insertBefore(chip,right.firstChild);}
    if(chip.dataset.state!==saveState||chip.dataset.message!==saveStateMessage){chip.dataset.state=saveState;chip.dataset.message=saveStateMessage;chip.className='v21-save-status '+saveState;chip.innerHTML=`<i></i><span>${esc(saveStateMessage)}</span><b>保存与恢复</b>`;}chip.title='点击保存当前区域版本、恢复历史版本或清理旧记录';
    suppressLegacyRecoveryUi();
  }
  function showRecoveryBar(message,count,type){
    const overlay=$('#v15-ocr-overlay');if(!overlay)return;
    overlay.querySelector('.v21-recovery-bar')?.remove();const bar=document.createElement('div');bar.className='v21-recovery-bar '+(type||'');bar.innerHTML=`<div><b>${type==='upload'?'新图片已安全保留':type==='cleanup'?'旧记录清理完成':'刷新恢复完成'}</b><span>${esc(message)}</span></div><button type="button" aria-label="关闭">×</button>`;const head=overlay.querySelector('.v15-ocr-head');if(head)head.insertAdjacentElement('afterend',bar);else overlay.prepend(bar);bar.querySelector('button').onclick=()=>bar.remove();if(type==='upload')setTimeout(()=>bar.remove(),6500);
  }
  function versionButtons(rec){
    const v=rec.versions||{},buttons=[];
    if(v.autosave)buttons.push(`<button data-v21-restore-project="${esc(rec.id)}" data-v21-version="autosave">最近自动保存<small>${esc(timeText(v.autosave.updatedAt))} · ${v.autosave.regionCount||0} 个区域</small></button>`);
    if(v.manual)buttons.push(`<button data-v21-restore-project="${esc(rec.id)}" data-v21-version="manual">上一次手动保存<small>${esc(timeText(v.manual.updatedAt))} · ${v.manual.regionCount||0} 个区域</small></button>`);
    const initial=v.initialRecognition||v.initial;if(initial)buttons.push(`<button data-v21-restore-project="${esc(rec.id)}" data-v21-version="${v.initialRecognition?'initialRecognition':'initial'}">${v.initialRecognition?'初始识别版本':'初始图片版本'}<small>${esc(timeText(initial.updatedAt))} · ${initial.regionCount||0} 个区域</small></button>`);
    return buttons.join('');
  }
  function closeRestoreChooser(){document.querySelector('.v21-restore-modal')?.remove();}
  function saveRestoreSummary(){const has=typeof adjustState!=='undefined'&&!!adjustState.img;return `<section class="v211-save-actions"><div><b>当前项目</b><span>${has?esc(adjustState.name||currentProjectName||'未命名图片'):'尚未载入图片'} · ${currentRegionCount()} 个区域</span></div><button type="button" data-v211-save-manual ${has?'':'disabled'}>立即保存区域版本<small>写入“上一次手动保存”，不会覆盖初始版本</small></button></section>`;}
  function legacyCleanupHtml(){const done=legacyCleaned();return `<section class="v211-legacy-clean"><div><b>旧记录一次性清理</b><span>${done?'V20.9 及更早记录已经清理，旧版恢复提示已隐藏。':'删除 V20.9 及更早的单槽自动保存、旧时间线与路由缓存；不会删除当前 V21/V24 的 5 个项目。'}</span></div><button type="button" data-v211-clean-legacy ${done?'disabled':''}>${done?'旧记录已清理':'清理旧记录'}</button></section>`;}
  function showRestoreChooser(projects,opts={}){
    closeRestoreChooser();const rows=(projects||[]).map(rec=>`<article class="${rec.id===activeProjectId()?'active':''}"><header><div><b>${esc(rec.name||'未命名图片')}</b><small>最近更新 ${esc(timeText(rec.updatedAt))} · ${rec.regionCount||0} 个区域</small></div>${rec.id===activeProjectId()?'<em>当前项目</em>':''}</header><div class="v21-version-grid">${versionButtons(rec)}</div></article>`).join('');
    const modal=document.createElement('div');modal.className='v21-restore-modal v211-save-restore-modal';modal.innerHTML=`<div class="v21-restore-card" role="dialog" aria-modal="true"><header><div><h3>项目保存与恢复</h3><p>${esc(opts.reason||'在同一个入口中保存当前版本、恢复最近 5 个项目，或清理旧版记录。')}</p></div><button data-v21-restore-close aria-label="关闭">×</button></header><section>${saveRestoreSummary()}<div class="v211-section-title"><b>恢复版本</b><span>默认静默恢复；只有多项目或恢复失败时需要手动选择。</span></div>${rows||'<div class="v21-empty-projects">没有可恢复的项目。上传图片后会自动建立独立项目。</div>'}${legacyCleanupHtml()}</section></div>`;document.body.appendChild(modal);
  }
  async function refreshSaveRestoreChooser(reason='') {const list=await recentProjects();showRestoreChooser(list,{reason});}


  function decorate(){
    if(decorating)return;const overlay=$('#v15-ocr-overlay');if(!overlay)return;decorating=true;
    try{
      overlay.classList.add('v207-primary-route','v21-primary-route');
      if(!overlay.dataset.v212Entered){overlay.dataset.v212Entered='1';overlay.classList.add('v212-entering');requestAnimationFrame(()=>overlay.classList.add('v212-enter-active'));setTimeout(()=>overlay.classList.remove('v212-entering','v212-enter-active'),620);}const title=overlay.querySelector('.v15-ocr-title b');if(title&&title.textContent!=='智能区域编辑工作台 · V27.9')title.textContent='智能区域编辑工作台 · V27.9';const sub=overlay.querySelector('.v15-ocr-title small');if(sub&&sub.textContent!=='轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复')sub.textContent='轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复';const back=overlay.querySelector('.v15-ocr-back');if(back){if(back.textContent!=='← 返回AI生图')back.textContent='← 返回AI生图';back.removeAttribute('data-v15-ocr-close');back.setAttribute('data-v213-return-image','');back.setAttribute('aria-label','返回 AI 生图');if(back.title!=='保存当前区域状态并返回 AI 生图')back.title='保存当前区域状态并返回 AI 生图';back.onclick=ev=>{ev.preventDefault();ev.stopImmediatePropagation();returnToImage();};}if(document.title!==APP_TITLE)document.title=APP_TITLE;decorateStatus();syncPanelRoute();
    }finally{decorating=false;}
  }
  function applyRequestedUi(){
    const s=state(),overlay=$('#v15-ocr-overlay');if(!s||!overlay)return false;let saved=null;try{saved=JSON.parse(safeSessionGet(SESSION_UI_KEY)||'null');}catch(_e){}const panel=requestedPanel();if(s.v157&&VALID_PANELS.has(panel)&&s.v157.mode!==panel){const button=overlay.querySelector(`[data-v157-mode="${panel}"]`);if(button)button.click();else s.v157.mode=panel;}if(saved){if(saved.activeId&&s.result&&Array.isArray(s.result.regions)&&s.result.regions.some(r=>String(r.id||r.region_id)===String(saved.activeId)))s.activeId=saved.activeId;if(Number.isFinite(Number(saved.bigZoom)))s.bigZoom=Math.max(.5,Math.min(3,Number(saved.bigZoom)));}return true;
  }
  function openRegionRoute(){
    if(typeof curView!=='undefined'&&curView!=='adjust')return;window.__V207_REGION_ROUTE__=true;document.body.classList.add('v207-region-route');const fn=openFunction();if(typeof fn!=='function'){clearTimeout(retryTimer);retryTimer=setTimeout(openRegionRoute,40);return;}const s=state();if(s){s.open=true;s.v157=s.v157&&typeof s.v157==='object'?s.v157:{mode:'canvas',transformExpanded:false,lastNonCanvas:'details'};const panel=requestedPanel();if(VALID_PANELS.has(panel))s.v157.mode=panel;s.v162Ui=s.v162Ui&&typeof s.v162Ui==='object'?s.v162Ui:{};s.v162Ui.detailsOpen=s.v157.mode==='details';s.v207PrimaryRoute=true;}fn();requestAnimationFrame(()=>{decorate();applyRequestedUi();});setTimeout(()=>{decorate();applyRequestedUi();},100);setTimeout(()=>{decorate();applyRequestedUi();},360);if(isReload)setTimeout(restoreWorkspaceAfterRefresh,120);
  }
  function deactivateRegionRoute(){clearTimeout(retryTimer);window.__V207_REGION_ROUTE__=false;document.body.classList.remove('v207-region-route');const s=state();if(s){s.open=false;s.selectionMode=false;s.correctionAddMode=false;s.v199CreationStep='info';s.v207PrimaryRoute=false;}window.__V2051_DISARM_DRAWING__?.();$('#v15-ocr-overlay')?.remove();document.documentElement.classList.remove('v15-ocr-lock');document.body.classList.remove('v15-ocr-lock');}
  let returningToImage=false;
  function returnToImage(){
    if(returningToImage)return;
    returningToImage=true;
    const back=$('#v15-ocr-overlay [data-v213-return-image]');
    if(back){back.disabled=true;back.setAttribute('aria-busy','true');back.textContent='正在返回AI生图…';}
    const finish=()=>{
      deactivateRegionRoute();
      try{
        if(typeof window.render==='function')window.render('image');
        else location.assign('/image');
      }catch(_e){location.assign('/image');}
      setTimeout(()=>{returningToImage=false;},500);
    };
    const saveTask=Promise.resolve().then(()=>saveProjectVersion('autosave','返回 AI 生图前'));
    Promise.race([saveTask,new Promise(resolve=>setTimeout(resolve,800))]).catch(()=>{}).finally(finish);
  }
  function syncPanelRoute(){if(typeof curView==='undefined'||curView!=='adjust')return;const s=state(),panel=s&&s.v157&&VALID_PANELS.has(s.v157.mode)?s.v157.mode:'canvas';rememberRegionUi();if(panel===lastPanel)return;lastPanel=panel;syncUrl('adjust');}
  function wrapRender(){
    if(routeWrapped||typeof window.render!=='function')return false;const base=window.render;window.render=function(view){const previous=typeof curView==='undefined'?'home':curView,normalized=VALID_VIEWS.has(view)?view:'home',intendedPanel=normalized==='adjust'?requestedPanel():'';const result=base.apply(this,arguments);if(normalized==='adjust'){if(previous!=='adjust')beginFreshRegionEntry('route-entry');const s=state();if(s&&s.v157&&VALID_PANELS.has(intendedPanel)){s.v157.mode=intendedPanel;if(s.v162Ui)s.v162Ui.detailsOpen=intendedPanel==='details';}}syncUrl(normalized);if(normalized==='adjust')setTimeout(openRegionRoute,0);return result;};routeWrapped=true;return true;
  }

  window.v207OpenRegionRoute=openRegionRoute;
  window.v207DeactivateRegionRoute=deactivateRegionRoute;
  window.__V213_RETURN_TO_IMAGE__=returnToImage;
  window.__V21_SAVE_PROJECT__=saveProjectVersion;
  window.__V211_CLEAR_LEGACY__=clearLegacyRecords;
  window.__V223_CLEAR_INTEGRITY__=window.__V222_CLEAR_INTEGRITY__=()=>({lastImageSwitchReport,current:clearIntegritySnapshot(state()?.v22ImageKey||'',{recognitionEpoch:Math.max(0,Number(state()?.v22RecognitionEpoch||0)-1)})});
  window.__V21_RESTORE_AFTER_REFRESH__=()=>{restoreAttempted=false;return restoreWorkspaceAfterRefresh(true);};
  window.__V21_PROJECT_DIAGNOSTICS__=async()=>({version:VERSION,view:typeof curView==='undefined'?null:curView,path:location.pathname,panel:state()?.v157?.mode||null,isReload,mutationEpoch,currentProjectId,refreshAnchor:readRefreshAnchor(),manualRestorePreview,saveState,uploadInProgress,imageKey:state()?.v22ImageKey||'',imageRevision:Number(state()?.v22ImageRevision)||0,recognitionEpoch:Number(state()?.v22AppliedRecognitionEpoch)||0,lastImageSwitchReport,projects:(await recentProjects()).map(x=>({id:x.id,name:x.name,updatedAt:x.updatedAt,regionCount:x.regionCount,versions:Object.keys(x.versions||{})}))});
  window.__V212_UI_DIAGNOSTICS__=()=>{const overlay=$('#v15-ocr-overlay'),preview=overlay?.querySelector('.v15-ocr-preview'),footer=overlay?.querySelector('.v15-ocr-footer'),pr=preview?.getBoundingClientRect(),fr=footer?.getBoundingClientRect(),grid=overlay?.querySelector('.v20-footer-grid');return{version:VERSION,route:location.pathname,view:typeof curView==='undefined'?null:curView,backText:overlay?.querySelector('.v15-ocr-back')?.textContent?.trim()||'',backDedicated:!!overlay?.querySelector('[data-v213-return-image]'),backLegacyClose:!!overlay?.querySelector('.v15-ocr-back[data-v15-ocr-close]'),returningToImage,canvasFooterGap:pr&&fr?Math.round(fr.top-pr.bottom):null,previewBottom:pr?.bottom??null,footerTop:fr?.top??null,glass:grid?getComputedStyle(grid).backdropFilter:'',footerRadius:grid?getComputedStyle(grid).borderRadius:'',openingAnimation:!!overlay?.classList.contains('v212-entering')};};
  window.__V213_UI_DIAGNOSTICS__=window.__V212_UI_DIAGNOSTICS__;

  document.addEventListener('click',e=>{
    const closeModal=e.target.closest?.('[data-v21-restore-close]');if(closeModal){closeRestoreChooser();return;}
    const manualSave=e.target.closest?.('[data-v211-save-manual]');if(manualSave){e.preventDefault();if(manualSave.disabled)return;manualSave.disabled=true;manualSave.textContent='正在保存…';Promise.resolve(savePromise).catch(()=>{}).then(()=>saveProjectVersion('manual','手动保存区域版本')).then(ok=>refreshSaveRestoreChooser(ok?'手动区域版本已保存。':'保存失败，请检查浏览器存储空间。'));return;}
    const legacyClean=e.target.closest?.('[data-v211-clean-legacy]');if(legacyClean){e.preventDefault();if(legacyClean.disabled)return;if(!window.confirm('确认清理 V20.9 及更早的自动保存与时间线记录？当前 V21/V24 项目不会被删除。'))return;legacyClean.disabled=true;legacyClean.textContent='正在清理…';clearLegacyRecords().then(()=>refreshSaveRestoreChooser('旧记录清理完成，旧版恢复提示已隐藏。')).catch(err=>{setSaveState('error','旧记录清理失败');refreshSaveRestoreChooser('清理失败：'+(err&&err.message||err));});return;}
    const restoreBtn=e.target.closest?.('[data-v21-restore-project]');if(restoreBtn){e.preventDefault();const id=restoreBtn.dataset.v21RestoreProject,key=restoreBtn.dataset.v21Version||'autosave';mutationEpoch++;setSaveState('saving','正在恢复版本…');dbGet(id).then(rec=>applyPayloadRecord(rec,key,'manual')).then(ok=>{if(ok)closeRestoreChooser();else setSaveState('error','恢复失败');}).catch(err=>{setSaveState('error','恢复失败');showRestoreChooser([],{reason:'恢复失败：'+err.message,failure:true});});return;}
    const switchClose=e.target.closest?.('[data-v222-switch-close]');if(switchClose){e.preventDefault();switchClose.closest('.v222-image-switch-card')?.remove();return;}
    if(e.target.closest?.('[data-v168-run-main]'))document.querySelector('.v222-image-switch-card')?.remove();
    if(e.target.closest?.('[data-v21-save-status]')){recentProjects().then(list=>showRestoreChooser(list));return;}
    if(window.__V207_REGION_ROUTE__===true){
      const back=e.target.closest?.('#v15-ocr-overlay [data-v213-return-image],#v15-ocr-overlay .v15-ocr-back');
      if(back){
        e.preventDefault();e.stopImmediatePropagation();
        returnToImage();
        return;
      }
      const close=e.target.closest?.('#v15-ocr-overlay .v15-ocr-close');
      if(close){e.preventDefault();e.stopImmediatePropagation();deactivateRegionRoute();setTimeout(()=>window.render?.('home'),0);return;}
    }
    if(e.target.closest?.('[data-v157-mode]'))setTimeout(syncPanelRoute,40);
        if(typeof curView!=='undefined'&&curView==='adjust'&&e.target.closest?.('#v15-ocr-overlay')&&!e.target.closest?.('[data-v21-save-status],[data-v211-save-manual],[data-v211-clean-legacy],[data-v21-restore-project]'))markDirty('交互修改');
  },true);
  document.addEventListener('change',e=>{if(typeof curView!=='undefined'&&curView==='adjust'&&e.target.closest?.('#v15-ocr-overlay'))markDirty('字段变更');},true);
  document.addEventListener('input',e=>{if(typeof curView!=='undefined'&&curView==='adjust'&&e.target.closest?.('#v15-ocr-overlay'))markDirty('内容输入');},true);
  document.addEventListener('pointerup',e=>{if(typeof curView!=='undefined'&&curView==='adjust'&&e.target.closest?.('#v15-ocr-overlay'))markDirty('区域调整');},true);
  document.addEventListener('contextmenu',()=>{if(typeof curView!=='undefined'&&curView==='adjust'){syncUrl('adjust');saveProjectVersion('autosave','右键刷新前');}},true);
  document.addEventListener('keydown',e=>{const refreshKey=e.key==='F5'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r');if(!refreshKey||typeof curView==='undefined'||curView!=='adjust')return;e.preventDefault();e.stopImmediatePropagation();syncUrl('adjust');Promise.race([saveProjectVersion('autosave','键盘刷新前'),new Promise(resolve=>setTimeout(resolve,1200))]).finally(()=>location.reload());},true);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&typeof curView!=='undefined'&&curView==='adjust')saveProjectVersion('autosave','页面隐藏');});
  window.addEventListener('pagehide',()=>{if(typeof curView!=='undefined'&&curView==='adjust')saveProjectVersion('autosave','页面退出');});
  window.addEventListener('popstate',()=>{const view=requestedView();if(typeof window.render==='function'&&view!==(typeof curView==='undefined'?'home':curView))window.render(view);else if(view==='adjust')openRegionRoute();});

  const observer=new MutationObserver(()=>{if(window.__V207_REGION_ROUTE__===true){decorate();syncPanelRoute();const count=currentRegionCount();if(count!==lastKnownRegionCount){lastKnownRegionCount=count;if(typeof adjustState!=='undefined'&&adjustState.img)markDirty('区域状态变化');}}});observer.observe(document.documentElement,{childList:true,subtree:true});

  function boot(){
    installPayloadWrappers();installUploadGuard();safeLocalRemove(ACTIVE_PROJECT_KEY);if(typeof adjustState!=='undefined')adjustState.autosaveEnabled=false;suppressLegacyRecoveryUi();
    if(!wrapRender()){setTimeout(boot,20);return;}
    const persistedReloadRoute=isReload&&window.AppRoutePersistence?window.AppRoutePersistence.readLastRoute():'';
    const initial=persistedReloadRoute||requestedView();if(initial==='adjust'&&!isReload)beginFreshRegionEntry('boot-entry');if(initial!==(typeof curView==='undefined'?'home':curView))window.render(initial);else syncUrl(initial);if(initial==='adjust'){setTimeout(openRegionRoute,0);if(isReload)setTimeout(restoreWorkspaceAfterRefresh,180);}document.title=APP_TITLE;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
