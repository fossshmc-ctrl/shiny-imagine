/* ======================================================================
   AI 智能区域编辑与微调生成工作台 V24 - Windows Clean Package
   Consolidated current-version runtime.
   ====================================================================== */

/* --- Core recognition and region management --- */
/* ===== V18：整图区域直接编辑 + 重新识别模式 + 精简识别状态 ===== */
(function(){
  'use strict';
  if(typeof adjustState==='undefined'||typeof renderAdjustView!=='function')return;

  const VERSION='V24';
  window.__AI_STUDIO_VERSION__=VERSION;
  const TYPE_META={
    text:{label:'文字区域',color:'#ef4444',brush:'red'},
    product:{label:'产品区域',color:'#f59e0b',brush:'amber'},
    person:{label:'人物区域',color:'#22c55e',brush:'green'},
    background:{label:'背景区域',color:'#3b82f6',brush:'blue'},
    decoration:{label:'装饰区域',color:'#8b5cf6',brush:'purple'}
  };
  const STORAGE_MODE='ai_studio_v154_ocr_mode';
  const h=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const attr=h;
  const regionName=(r,fallback='区域')=>{
    const technical=value=>/^(?:cloud|region|custom|ocr|block|task|job|area|mask|box|r)[_-]?\d+(?:[_-].*)?$/i.test(String(value||'').trim())||/^[a-f0-9]{16,}$/i.test(String(value||'').trim());
    const candidates=[r&&r.name,r&&r.label,r&&r.recognizedText,r&&r.content].map(v=>String(v||'').replace(/\s+/g,' ').trim()).filter(Boolean);
    const name=candidates.find(v=>!technical(v));
    return String(name||(r&&TYPE_META[r.type]||TYPE_META.decoration).label||fallback);
  };
  window.__V221_REGION_NAME__=regionName;
  let cropDrag=null;
  let regionDrag=null;
  let addRegionDrag=null;
  let busyTicker=null;
  /* V27.9：记录文字编辑器的真实交互意图。全量重绘发生时，仅在用户仍在
     textarea 内编辑的情况下恢复焦点与光标；点击其他按钮时不抢回焦点。 */
  let regionTextFocusIntent=false;

  function freshProgress(){return{phase:'idle',message:'等待开始识别',startedAt:0,elapsed:0,jobId:'',scope:'full'};}
  function ensure(){
    adjustState.v15DetailOpen=adjustState.v15DetailOpen||{};
    const defaults={
      open:false,src:'',name:'',source:'',busy:false,message:'等待开始识别',error:'',result:null,
      selected:[],activeId:'',tab:'combined',mode:localStorage.getItem(STORAGE_MODE)||adjustState.ocrRecognitionMode||'cloud',
      tokenStatus:null,showToken:false,drag:false,selectionMode:false,crop:null,cropConfirmed:false,progress:freshProgress(),progressExpanded:false,localMenuOpen:false,lastLocalCount:0,editingBlockId:'',blockEdits:{},documentFilter:'all',correctionMode:false,correctionAddMode:false,correctionAddType:'text',manualCorrectionCount:0,deleteMode:false,regionTextEditing:'',regionTextDraft:'',regionTextDrafts:{},regionTextFocusedId:'',regionTextComposing:false,regionTextRenderPending:false,bigZoom:1,showAllRegions:false,focusMode:false,focusPadding:.08,resetStageViewport:false,fullRecognitionMode:'replace_all',recognitionMenuOpen:false,legendExpanded:false,moreToolsOpen:false,diffOpen:false,diffDetailsOpen:false,lastRecognitionDiff:null,v168EditorAdvanced:false,v168JsonOpen:false,v168RegionPickerOpen:false,v168RegionSearch:'',v177ClosedExpanded:{},v178CloseFilter:'all',v192AddRegionOpen:false,v192AddRegionName:'',v192AddRegionType:'text',v193AddRegionTemplate:'custom',v193AddRegionMode:'direct_transform',v193AddRegionPreserveKey:'auto',v196TemplateManagerOpen:false,v193SelectionCoordsOpen:false,v194RegionPreflightOpen:false,v194PendingRegionBox:null,v194RegionDraft:null,visualApiWarning:null,v22ImageKey:'',v22ImageRevision:0,v22RecognitionEpoch:0,v22AppliedRecognitionEpoch:0,v157:{mode:'canvas',transformExpanded:false,lastNonCanvas:'details'}
    };
    if(!adjustState.v15Ocr||typeof adjustState.v15Ocr!=='object')adjustState.v15Ocr=defaults;
    else Object.keys(defaults).forEach(k=>{if(typeof adjustState.v15Ocr[k]==='undefined')adjustState.v15Ocr[k]=defaults[k];});
    if(!adjustState.v15Ocr.progress||typeof adjustState.v15Ocr.progress!=='object')adjustState.v15Ocr.progress=freshProgress();
    if(['regions','markdown'].includes(adjustState.v15Ocr.tab))adjustState.v15Ocr.tab='combined';
    if(typeof adjustState.v15Ocr.cropConfirmed!=='boolean')adjustState.v15Ocr.cropConfirmed=false;
    adjustState.v15Ocr.deleteMode=false;
    if(typeof adjustState.v15Ocr.regionTextEditing!=='string')adjustState.v15Ocr.regionTextEditing='';
    if(typeof adjustState.v15Ocr.regionTextDraft!=='string')adjustState.v15Ocr.regionTextDraft='';
    if(!adjustState.v15Ocr.regionTextDrafts||typeof adjustState.v15Ocr.regionTextDrafts!=='object'||Array.isArray(adjustState.v15Ocr.regionTextDrafts))adjustState.v15Ocr.regionTextDrafts={};
    if(typeof adjustState.v15Ocr.regionTextFocusedId!=='string')adjustState.v15Ocr.regionTextFocusedId='';
    if(typeof adjustState.v15Ocr.regionTextComposing!=='boolean')adjustState.v15Ocr.regionTextComposing=false;
    if(typeof adjustState.v15Ocr.regionTextRenderPending!=='boolean')adjustState.v15Ocr.regionTextRenderPending=false;
    if(typeof adjustState.v15Ocr.showAllRegions!=='boolean')adjustState.v15Ocr.showAllRegions=false;
    if(typeof adjustState.v15Ocr.focusMode!=='boolean')adjustState.v15Ocr.focusMode=false;
    if(!['replace_all','preserve_manual'].includes(adjustState.v15Ocr.fullRecognitionMode))adjustState.v15Ocr.fullRecognitionMode='replace_all';
    if(typeof adjustState.v15Ocr.recognitionMenuOpen!=='boolean')adjustState.v15Ocr.recognitionMenuOpen=false;
    if(typeof adjustState.v15Ocr.legendExpanded!=='boolean')adjustState.v15Ocr.legendExpanded=false;
    if(typeof adjustState.v15Ocr.moreToolsOpen!=='boolean')adjustState.v15Ocr.moreToolsOpen=false;
    if(typeof adjustState.v15Ocr.diffOpen!=='boolean')adjustState.v15Ocr.diffOpen=false;
    if(typeof adjustState.v15Ocr.diffDetailsOpen!=='boolean')adjustState.v15Ocr.diffDetailsOpen=false;
    if(typeof adjustState.v15Ocr.v168EditorAdvanced!=='boolean')adjustState.v15Ocr.v168EditorAdvanced=false;
    if(typeof adjustState.v15Ocr.v168JsonOpen!=='boolean')adjustState.v15Ocr.v168JsonOpen=false;
    if(typeof adjustState.v15Ocr.v168RegionPickerOpen!=='boolean')adjustState.v15Ocr.v168RegionPickerOpen=false;
    if(typeof adjustState.v15Ocr.v168RegionSearch!=='string')adjustState.v15Ocr.v168RegionSearch='';
    if(!adjustState.v15Ocr.v177ClosedExpanded||typeof adjustState.v15Ocr.v177ClosedExpanded!=='object')adjustState.v15Ocr.v177ClosedExpanded={};
    if(typeof adjustState.v15Ocr.v178CloseFilter!=='string')adjustState.v15Ocr.v178CloseFilter='all';
    if(typeof adjustState.v15Ocr.v192AddRegionOpen!=='boolean')adjustState.v15Ocr.v192AddRegionOpen=false;
    if(typeof adjustState.v15Ocr.v192AddRegionName!=='string')adjustState.v15Ocr.v192AddRegionName='';
    if(!TYPE_META[adjustState.v15Ocr.v192AddRegionType])adjustState.v15Ocr.v192AddRegionType='text';
    if(typeof adjustState.v15Ocr.v193AddRegionTemplate!=='string')adjustState.v15Ocr.v193AddRegionTemplate='custom';
    if(!['direct_transform','move_and_repair','local_regenerate'].includes(adjustState.v15Ocr.v193AddRegionMode))adjustState.v15Ocr.v193AddRegionMode='direct_transform';
    if(typeof adjustState.v15Ocr.v193AddRegionPreserveKey!=='string')adjustState.v15Ocr.v193AddRegionPreserveKey='auto';
    if(typeof adjustState.v15Ocr.v196TemplateManagerOpen!=='boolean')adjustState.v15Ocr.v196TemplateManagerOpen=false;
    if(typeof adjustState.v15Ocr.v193SelectionCoordsOpen!=='boolean')adjustState.v15Ocr.v193SelectionCoordsOpen=false;
    if(typeof adjustState.v15Ocr.v194RegionPreflightOpen!=='boolean')adjustState.v15Ocr.v194RegionPreflightOpen=false;
    if(adjustState.v15Ocr.v194PendingRegionBox&&typeof adjustState.v15Ocr.v194PendingRegionBox!=='object')adjustState.v15Ocr.v194PendingRegionBox=null;
    if(adjustState.v15Ocr.v194RegionDraft&&typeof adjustState.v15Ocr.v194RegionDraft!=='object')adjustState.v15Ocr.v194RegionDraft=null;
    if(adjustState.v15Ocr.visualApiWarning&&typeof adjustState.v15Ocr.visualApiWarning!=='object')adjustState.v15Ocr.visualApiWarning=null;
    if(typeof adjustState.v15Ocr.v22ImageKey!=='string')adjustState.v15Ocr.v22ImageKey='';
    if(!Number.isFinite(Number(adjustState.v15Ocr.v22ImageRevision)))adjustState.v15Ocr.v22ImageRevision=0;
    if(!Number.isFinite(Number(adjustState.v15Ocr.v22RecognitionEpoch)))adjustState.v15Ocr.v22RecognitionEpoch=0;
    if(!Number.isFinite(Number(adjustState.v15Ocr.v22AppliedRecognitionEpoch)))adjustState.v15Ocr.v22AppliedRecognitionEpoch=0;
    if(!['info','drawing','confirm'].includes(adjustState.v15Ocr.v199CreationStep))adjustState.v15Ocr.v199CreationStep='info';
    /* V20：移除“识别区域直接编辑”中的旧人工校正入口。旧项目残留状态也强制退出。 */
    adjustState.v15Ocr.correctionMode=false;
    const fp=Number(adjustState.v15Ocr.focusPadding);adjustState.v15Ocr.focusPadding=Number.isFinite(fp)?Math.max(.02,Math.min(.2,fp)):.08;
    const z=Number(adjustState.v15Ocr.bigZoom);adjustState.v15Ocr.bigZoom=Number.isFinite(z)?Math.max(.5,Math.min(3,z)):1;
    return adjustState.v15Ocr;
  }
  ensure();

  function detailKey(d){
    if(d.classList.contains('v14-advanced'))return'advanced-root';
    const t=(d.querySelector(':scope > summary')?.textContent||'').replace(/\s+/g,' ').trim();
    return t?'summary:'+t.slice(0,80):'';
  }
  function captureDetails(){
    const out=Object.assign({},adjustState.v15DetailOpen||{});
    document.querySelectorAll('#adjust-root details').forEach(d=>{const k=detailKey(d);if(k)out[k]=!!d.open;});
    adjustState.v15DetailOpen=out;return out;
  }
  function restoreDetails(map){document.querySelectorAll('#adjust-root details').forEach(d=>{const k=detailKey(d);if(k&&Object.prototype.hasOwnProperty.call(map,k))d.open=!!map[k];});}
  function enhanceDetectEntry(){
    document.querySelectorAll('#adjust-root [data-adj-auto-detect],#adjust-root [data-v15-ocr-open]').forEach(b=>{
      b.removeAttribute('data-adj-auto-detect');b.setAttribute('data-v15-ocr-open','');b.disabled=false;b.type='button';b.textContent='打开视觉识别工作台';b.title='进入 PaddleOCR-VL 二级识别页面';
      if(!b.dataset.v152Bound){b.dataset.v152Bound='1';b.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();openOcr();});}
    });
  }
  const baseRender=renderAdjustView;
  renderAdjustView=function(){
    const map=captureDetails(),y=window.scrollY;baseRender();enhanceDetectEntry();restoreDetails(map);
    requestAnimationFrame(()=>{enhanceDetectEntry();restoreDetails(map);if(!ensure().open&&Math.abs(window.scrollY-y)>2)window.scrollTo({top:y,left:0,behavior:'auto'});});
  };
  document.addEventListener('toggle',e=>{if(e.target instanceof HTMLDetailsElement&&e.target.closest('#adjust-root')){const k=detailKey(e.target);if(k)adjustState.v15DetailOpen[k]=e.target.open;}},true);

  function fileToData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>reject(new Error('文件读取失败'));r.readAsDataURL(file);});}
  function compactImageKey(src,name){
    const raw=String(src||''),label=String(name||'image');let hash=2166136261;const sample=raw.length>4096?raw.slice(0,2048)+raw.slice(-2048):raw;for(let i=0;i<sample.length;i++){hash^=sample.charCodeAt(i);hash=Math.imul(hash,16777619);}return `${label}:${raw.length}:${(hash>>>0).toString(36)}`;
  }
  function beginImageSession(src,name,reason,keyOverride){
    const s=ensure(),key=String(keyOverride||compactImageKey(src,name));s.v22ImageRevision=(Number(s.v22ImageRevision)||0)+1;s.v22RecognitionEpoch=(Number(s.v22RecognitionEpoch)||0)+1;s.v22AppliedRecognitionEpoch=0;s.v22ImageKey=key;s.busy=false;stopBusyTicker();s.lastRecognitionDiff=null;s.diffOpen=false;s.diffDetailsOpen=false;window.__V22_RESET_REGION_WORKSPACE__?.(reason||'image-change',{preserveUi:true,imageKey:key});return{key,revision:s.v22ImageRevision};
  }
  window.__V22_BEGIN_IMAGE_SESSION__=(src,name,reason,key)=>beginImageSession(src,name,reason,key);
  async function setOcrFile(file,source){
    if(!file)return;if(!/^image\/(png|jpeg|webp)$/i.test(file.type||''))throw new Error('仅支持 PNG、JPG、JPEG 或 WebP 图片');if(file.size>45*1024*1024)throw new Error('图片超过 45MB，请先压缩后再上传');
    const src=await fileToData(file),name=file.name||'ocr-image.png',s=ensure();beginImageSession(src,name,'upload-image');s.src=src;s.name=name;s.source=source||'manual';s.result=null;s.selected=[];s.activeId='';s.error='';s.crop=null;s.cropConfirmed=false;s.selectionMode=false;s.correctionMode=false;s.correctionAddMode=false;s.progress=freshProgress();s.progressExpanded=false;s.localMenuOpen=false;s.recognitionMenuOpen=false;s.fullRecognitionMode='replace_all';s.visualApiWarning=null;s.message='新图片已载入，旧区域已清空，等待识别';if(s.open)renderOcr();
  }
  function replaceImageFile(file,source='manual'){
    if(!file)return Promise.resolve(false);
    const guarded=window.__V221_REPLACE_IMAGE__;
    return typeof guarded==='function'?Promise.resolve(guarded(file,{source})):setOcrFile(file,source);
  }
  function syncMain(force){
    const s=ensure(),src=adjustState.originalSrc||adjustState.src||'';if(!src)return false;
    if(force||!s.src||s.source==='main'){const name=adjustState.originalName||adjustState.name||'main-image.png';if(force||src!==s.src||name!==s.name)beginImageSession(src,name,'sync-main-image');s.src=src;s.name=name;s.source='main';s.result=null;s.selected=[];s.activeId='';s.error='';s.crop=null;s.cropConfirmed=false;s.selectionMode=false;s.correctionMode=false;s.correctionAddMode=false;s.progress=freshProgress();s.progressExpanded=false;s.localMenuOpen=false;s.visualApiWarning=null;s.message='已自动同步图片微调主图';return true;}return false;
  }
  if(typeof adjustLoadFile==='function'){
    const baseLoad=adjustLoadFile;
    adjustLoadFile=function(file){if(file)setOcrFile(file,'main').catch(()=>{});return baseLoad(file);};
  }

  function toast(text,type){let t=document.querySelector('.v15-toast');if(t)t.remove();t=document.createElement('div');t.className='v15-toast '+(type||'');t.textContent=text;document.body.appendChild(t);setTimeout(()=>t.remove(),3600);}
  async function fetchJson(url,opts,label){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),660000);try{
      const r=await fetch(url,Object.assign({},opts||{},{signal:ctrl.signal}));const text=await r.text();let d={};try{d=text?JSON.parse(text):{};}catch(e){throw new Error(`${label||'服务'}返回了无法解析的内容（HTTP ${r.status}）`);}if(!r.ok||d.ok===false){const msg=d?.error?.message||d?.message||`${label||'请求'}失败（HTTP ${r.status}）`,err=new Error(msg);err.code=d?.error?.code||'request_failed';err.httpStatus=r.status;err.details=d;throw err;}return d;
    }catch(e){if(e.name==='AbortError')throw new Error(`${label||'请求'}等待超时，请检查网络或稍后重试`);throw e;}finally{clearTimeout(timer);}
  }
  function statusClass(st){return st&&st.busy?'run':st&&st.configured?'ok':st&&st.checked?'bad':'';}
  function statusText(st){return st&&st.busy?'检查中…':st&&st.configured?'云端已配置':st&&st.checked?'未配置令牌':'尚未检查';}
  async function checkToken(showMessage){
    const s=ensure();s.tokenStatus=Object.assign({},s.tokenStatus||{},{busy:true});if(s.open)renderOcr();
    try{const d=await fetchJson('/api/paddleocr-cloud/status',{cache:'no-store'},'配置检查');s.tokenStatus=Object.assign({checked:true,busy:false},d);if(!d.configured)s.showToken=true;if(showMessage)toast(d.configured?'PaddleOCR 云端配置可用':'尚未配置 PaddleOCR Access Token',d.configured?'ok':'bad');return d;}
    catch(e){s.tokenStatus={checked:true,busy:false,configured:false,message:e.message};if(showMessage)toast('配置检查失败：'+e.message,'bad');return s.tokenStatus;}
    finally{if(s.open)renderOcr();}
  }
  async function saveToken(token,remember){
    if(!token||token.length<20)throw new Error('请粘贴完整的 PaddleOCR Access Token');
    const d=await fetchJson('/api/paddleocr-cloud/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,remember:!!remember})},'令牌配置');
    const s=ensure();s.tokenStatus=Object.assign({checked:true,busy:false},d);s.showToken=false;renderOcr();
    const msg=remember&&d.persisted?'令牌已使用本机兼容加密保存':'令牌仅在本次服务运行期间有效';toast(d.warning?msg+'；'+d.warning:msg,d.warning?'bad':'ok');
  }
  async function clearToken(){const d=await fetchJson('/api/paddleocr-cloud/config',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clear:true})},'清除令牌');const s=ensure();s.tokenStatus=Object.assign({checked:true,busy:false},d);s.showToken=true;renderOcr();toast('令牌已清除','ok');}

  function normalizeRegion(r,i){
    const type=TYPE_META[r&&r.type]?r.type:'decoration',x=Math.max(0,Math.min(1,Number(r&&r.x)||0)),y=Math.max(0,Math.min(1,Number(r&&r.y)||0));
    return Object.assign({},r,{id:String(r&&r.id||('v152_region_'+Date.now()+'_'+(i+1))),type,x,y,width:Math.max(.005,Math.min(1-x,Number(r&&r.width)||.1)),height:Math.max(.005,Math.min(1-y,Number(r&&r.height)||.1)),source:r&&r.source||'paddleocr-cloud'});
  }
  async function runHybrid(src){
    if(typeof apiVisionJson!=='function')return[];
    const prompt='分析这张电商图片中适合局部修改的非文字视觉区域。只输出严格 JSON：{"regions":[{"type":"product|background|person|decoration","label":"区域名称","x":0到1,"y":0到1,"width":0到1,"height":0到1,"confidence":0到1,"suggestedInstruction":"简短中文修改建议"}]}。最多返回8个主要区域，不要输出 markdown。';
    const raw=await apiVisionJson(src,prompt),obj=typeof adjustParseStrictJson==='function'?adjustParseStrictJson(raw):JSON.parse(raw);return(Array.isArray(obj.regions)?obj.regions:[]).map((r,i)=>Object.assign({},r,{id:'vision_'+Date.now()+'_'+(i+1),source:'vision-api'}));
  }
  function diagnoseVisualApiFailure(error){
    const raw=String(error&&error.message||error||'未知错误').trim();
    const target=(raw.match(/(?:ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH)\s+([^\s）)]+)/i)||[])[1]||'';
    if(/ETIMEDOUT|connect\s+timeout|连接超时|请求超时/i.test(raw)){
      return{code:'timeout',summary:`视觉 API 补充超时${target?`（${target} 无响应）`:''}`,detail:`主识别已完成，但补充视觉接口在建立 HTTPS 连接前超时。请检查当前接口方案、代理/VPN、防火墙和 Base URL。原始错误：${raw}`,raw,target};
    }
    if(/ECONNREFUSED|连接被拒绝/i.test(raw))return{code:'refused',summary:'视觉 API 补充连接被拒绝',detail:`目标服务或本机代理未监听。请检查接口地址和代理进程。原始错误：${raw}`,raw,target};
    if(/ENOTFOUND|getaddrinfo|DNS/i.test(raw))return{code:'dns',summary:'视觉 API 补充域名解析失败',detail:`DNS 无法解析接口域名。请检查网络、DNS 与 Base URL。原始错误：${raw}`,raw,target};
    if(/401|403|鉴权|unauthorized|forbidden/i.test(raw))return{code:'auth',summary:'视觉 API 补充鉴权失败',detail:`网络已连通，但密钥或权限无效。请检查当前接口方案。原始错误：${raw}`,raw,target};
    return{code:'unknown',summary:'视觉 API 补充失败',detail:`PaddleOCR 主识别已完成；补充视觉接口失败。原始错误：${raw}`,raw,target};
  }
  function setProgress(phase,message,extra){const s=ensure();s.progress=Object.assign({},s.progress||freshProgress(),extra||{},{phase,message});s.message=message;if(s.open)renderOcr();}
  function newOcrRequestId(){
    try{if(window.crypto&&typeof window.crypto.randomUUID==='function')return'ocr_'+window.crypto.randomUUID();}catch(e){}
    return'ocr_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,12);
  }
  function watchSubmissionProgress(requestId,isCurrent){
    let stopped=false,lastKey='';
    const tick=async()=>{
      if(stopped||!isCurrent())return;
      try{
        const r=await fetch('/api/paddleocr-cloud/queue-status?requestId='+encodeURIComponent(requestId),{cache:'no-store'});if(!r.ok)return;
        const d=await r.json(),st=d&&d.state;if(!st||stopped||!isCurrent())return;
        const key=[st.phase,st.queuePosition,st.attempt,st.retryIndex,st.delayMs,st.pollCount,st.jobId,st.message].join('|');if(key===lastKey)return;lastKey=key;
        if(st.phase==='queued')setProgress('submitting',st.message||`本地已有识别任务正在提交，当前排队第 ${st.queuePosition||1} 位…`,{requestId});
        else if(st.phase==='submitting'||st.phase==='retry_wait')setProgress('submitting',st.message||'正在提交 PaddleOCR 云端识别任务…',{requestId,retryIndex:st.retryIndex||0,retryTotal:st.retryTotal||0});
        else if(st.phase==='submitted'||st.phase==='polling')setProgress('waiting',st.message||'任务已提交，正在等待 PaddleOCR 云端解析与版面识别…',{requestId,jobId:st.jobId||''});
        else if(st.phase==='downloading')setProgress('parsing',st.message||'云端任务已完成，正在下载并解析识别结果…',{requestId,jobId:st.jobId||''});
      }catch(e){}
    };
    tick();const timer=setInterval(tick,700);
    return()=>{stopped=true;clearInterval(timer);};
  }
  function startBusyTicker(){clearInterval(busyTicker);busyTicker=setInterval(()=>{const s=ensure();if(!s.busy){clearInterval(busyTicker);busyTicker=null;return;}s.progress.elapsed=Math.max(0,Math.round((Date.now()-(s.progress.startedAt||Date.now()))/1000));const el=document.querySelector('[data-v152-elapsed]');if(el)el.textContent=`已等待 ${s.progress.elapsed} 秒`;},1000);}
  function stopBusyTicker(){clearInterval(busyTicker);busyTicker=null;}
  async function cropDataUrl(src,crop){
    const img=typeof adjustLoadImageObject==='function'?await adjustLoadImageObject(src):await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片加载失败'));im.src=src;});
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height,sx=Math.max(0,Math.round(crop.x*iw)),sy=Math.max(0,Math.round(crop.y*ih)),sw=Math.max(2,Math.round(crop.width*iw)),sh=Math.max(2,Math.round(crop.height*ih));
    const c=document.createElement('canvas');c.width=sw;c.height=sh;c.getContext('2d').drawImage(img,sx,sy,Math.min(sw,iw-sx),Math.min(sh,ih-sy),0,0,sw,sh);return{src:c.toDataURL('image/png'),width:sw,height:sh};
  }
  function transformCropRegion(r,crop,i){const n=normalizeRegion(r,i);return Object.assign({},n,{id:'local_'+Date.now()+'_'+i,x:crop.x+n.x*crop.width,y:crop.y+n.y*crop.height,width:n.width*crop.width,height:n.height*crop.height,source:(n.source||'paddleocr-cloud')+'-local'});}
  function transformCropBlock(b,crop,i){return Object.assign({},b,{id:'local_block_'+Date.now()+'_'+i,x:crop.x+(Number(b.x)||0)*crop.width,y:crop.y+(Number(b.y)||0)*crop.height,width:(Number(b.width)||0)*crop.width,height:(Number(b.height)||0)*crop.height,page:b.page||1,order:b.order||i});}
  function overlapsCrop(r,c){const cx=r.x+r.width/2,cy=r.y+r.height/2;if(cx>=c.x&&cx<=c.x+c.width&&cy>=c.y&&cy<=c.y+c.height)return true;const iw=Math.max(0,Math.min(r.x+r.width,c.x+c.width)-Math.max(r.x,c.x)),ih=Math.max(0,Math.min(r.y+r.height,c.y+c.height)-Math.max(r.y,c.y)),inter=iw*ih,area=Math.max(.000001,r.width*r.height);return inter/area>.35;}
  function regionIoU(a,b){
    if(!a||!b)return 0;const ax=Number(a.x)||0,ay=Number(a.y)||0,aw=Number(a.width)||0,ah=Number(a.height)||0,bx=Number(b.x)||0,by=Number(b.y)||0,bw=Number(b.width)||0,bh=Number(b.height)||0;
    const iw=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx)),ih=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by)),inter=iw*ih,union=aw*ah+bw*bh-inter;return union>0?inter/union:0;
  }
  function manualRegion(r){return !!(r&&(r.manualCorrected||r.userCorrected||r.manualCreated||r.source==='manual-correction'||r.source==='manual-free-region'||r.source==='manual-brush'||r.locked||r.regionTextEdited));}
  function preserveManualRegions(oldRows,newRows){
    const incoming=(newRows||[]).map(x=>Object.assign({},x)),manual=(oldRows||[]).filter(manualRegion),used=new Set();
    manual.forEach(old=>{let best=-1,score=0;incoming.forEach((n,i)=>{if(used.has(i))return;const same=String(n.type)===String(old.type),v=regionIoU(old,n)+(same?.18:0);if(v>score){score=v;best=i;}});if(best>=0&&score>.28){const fresh=incoming[best];incoming[best]=Object.assign({},fresh,old,{id:old.id||fresh.id,manualCorrected:true,source:old.source||fresh.source});used.add(best);}else incoming.push(Object.assign({},old,{manualCorrected:true}));});
    return incoming;
  }
  function recognitionDiff(oldRows,newRows){
    const old=oldRows||[],next=newRows||[],matched=new Set(),changedRows=[],addedRows=[];
    next.forEach(n=>{let best=-1,score=0;old.forEach((o,i)=>{if(matched.has(i))return;const v=regionIoU(o,n)+(String(o.type)===String(n.type)?.16:0);if(v>score){score=v;best=i;}});if(best<0||score<.22){addedRows.push(n);return;}matched.add(best);const o=old[best],delta=Math.abs((o.x||0)-(n.x||0))+Math.abs((o.y||0)-(n.y||0))+Math.abs((o.width||0)-(n.width||0))+Math.abs((o.height||0)-(n.height||0));if(delta>.025||o.type!==n.type)changedRows.push({before:o,after:n});});
    const removedRows=old.filter((_o,i)=>!matched.has(i));
    return{added:addedRows.length,removed:removedRows.length,changed:changedRows.length,addedRows,removedRows,changedRows,details:changedRows};
  }
  async function runRecognition(scope,fullMode){
    const s=ensure();if(s.busy)return;if(!s.src){toast('请先上传识别图片','bad');return;}scope=scope==='local'?'local':'full';fullMode=['replace_all','preserve_manual'].includes(fullMode)?fullMode:(s.fullRecognitionMode||'replace_all');const oldFullRows=scope==='full'&&s.result?JSON.parse(JSON.stringify(s.result.regions||[])):[];s.fullRecognitionMode=fullMode;s.recognitionMenuOpen=false;s.diffOpen=false;s.diffDetailsOpen=false;s.visualApiWarning=null;
    if(scope==='local'&&(!s.crop||s.crop.width<.015||s.crop.height<.015)){toast('请先点击“框选局部区域”，并在图片上拖出识别范围','bad');return;}
    if(scope==='local'&&!s.cropConfirmed){toast('请先点击“确定选区”，再重新识别选区','bad');return;}
    if(scope==='full'){s.focusMode=false;s.bigZoom=1;s.resetStageViewport=true;}
    const task={epoch:(s.v22RecognitionEpoch=(Number(s.v22RecognitionEpoch)||0)+1),imageRevision:Number(s.v22ImageRevision)||0,imageKey:String(s.v22ImageKey||compactImageKey(s.src,s.name)),src:s.src};
    const isCurrent=()=>{const now=ensure();return Number(now.v22RecognitionEpoch)===task.epoch&&Number(now.v22ImageRevision)===task.imageRevision&&String(now.v22ImageKey||'')===task.imageKey&&now.src===task.src;};
    s.busy=true;s.error='';s.correctionMode=false;s.correctionAddMode=false;s.progressExpanded=true;s.progress={phase:'preparing',message:scope==='local'?'正在准备局部识别图片…':'正在准备整图识别…',startedAt:Date.now(),elapsed:0,jobId:'',scope};s.message=s.progress.message;renderOcr();startBusyTicker();let stopSubmissionWatch=()=>{};
    try{
      const st=await checkToken(false);if(!isCurrent())return;if(!st.configured)throw new Error('尚未配置 PaddleOCR Access Token，请先在左侧配置令牌');
      let requestSrc=task.src,size=await loadImageSize(task.src),crop=null;if(!isCurrent())return;
      if(scope==='local'){crop=Object.assign({},s.crop);const cropped=await cropDataUrl(task.src,crop);if(!isCurrent())return;requestSrc=cropped.src;size={w:cropped.width,h:cropped.height};}
      const requestId=newOcrRequestId();setProgress('submitting','正在提交识别任务…',{requestId});stopSubmissionWatch=watchSubmissionProgress(requestId,isCurrent);
      const d=await fetchJson('/api/paddleocr-cloud/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId,image:requestSrc,imageWidth:size.w,imageHeight:size.h,model:'PaddleOCR-VL-1.6',useDocOrientationClassify:false,useDocUnwarping:false,useChartRecognition:false,maxRegions:40,pollIntervalMs:4000,pollTimeoutMs:600000})},'PaddleOCR 云端识别');stopSubmissionWatch();if(!isCurrent())return;
      setProgress('parsing','云端任务已完成，正在解析文字、公式、产品和版面区域…',{jobId:d.jobId||''});
      let rows=Array.isArray(d.regions)?d.regions:[],hybridWarning='';
      if(s.mode==='cloud_hybrid')try{rows=rows.concat(await runHybrid(requestSrc));if(!isCurrent())return;}catch(e){if(!isCurrent())return;const diag=diagnoseVisualApiFailure(e);s.visualApiWarning=diag;hybridWarning='；'+diag.summary;}
      rows=scope==='local'?rows.map((r,i)=>transformCropRegion(r,crop,i)):rows.map(normalizeRegion);
      rows.forEach(r=>{r.v22ImageKey=task.imageKey;r.v22RecognitionEpoch=task.epoch;delete r.v22GeometryBound;});
      if(scope==='full'&&fullMode==='preserve_manual')rows=preserveManualRegions(oldFullRows,rows);
      let documentBlocks=Array.isArray(d.documentBlocks)?d.documentBlocks:[];documentBlocks=scope==='local'?documentBlocks.map((b,i)=>transformCropBlock(b,crop,i)):documentBlocks;if(!isCurrent())return;
      if(scope==='full'&&fullMode==='replace_all')window.__V22_RESET_REGION_WORKSPACE__?.('full-recognition-replace',{preserveUi:true,imageKey:task.imageKey});
      if(scope==='local'){
        const old=s.result?.regions||[],kept=old.filter(r=>!overlapsCrop(r,crop)),oldBlocks=s.result?.documentBlocks||[],keptBlocks=oldBlocks.filter(r=>!overlapsCrop(r,crop));s.result=Object.assign({},s.result||{},{jobId:d.jobId||'',model:d.model||'PaddleOCR-VL-1.6',pageCount:d.pageCount||1,markdown:[s.result?.markdown||'',d.markdown||''].filter(Boolean).join('\n\n--- 局部重新识别 ---\n\n'),regions:kept.concat(rows),documentBlocks:keptBlocks.concat(documentBlocks),downloadDiagnostics:d.downloadDiagnostics||s.result?.downloadDiagnostics||null,imageKey:task.imageKey,imageRevision:task.imageRevision,recognitionEpoch:task.epoch});s.lastLocalCount=rows.length;
      }else{s.result={jobId:d.jobId||'',model:d.model||'PaddleOCR-VL-1.6',pageCount:d.pageCount||1,markdown:d.markdown||'',regions:rows,documentBlocks,downloadDiagnostics:d.downloadDiagnostics||null,imageKey:task.imageKey,imageRevision:task.imageRevision,recognitionEpoch:task.epoch};}
      s.result.raw={ok:d.ok,engine:d.engine,model:d.model,jobId:d.jobId,requestId:d.requestId||'',submitAttempts:d.submitAttempts||1,submitDiagnostics:d.submitDiagnostics||[],pollCount:d.pollCount,progress:d.progress,image:d.image,pageCount:d.pageCount,scope,crop,downloadDiagnostics:d.downloadDiagnostics||null,regions:s.result.regions,documentBlocks:s.result.documentBlocks||[],markdown:s.result.markdown||'',imageKey:task.imageKey,imageRevision:task.imageRevision,recognitionEpoch:task.epoch};
      s.v22AppliedRecognitionEpoch=task.epoch;if(scope==='full')s.lastRecognitionDiff=recognitionDiff(oldFullRows,s.result.regions||[]);s.selected=(s.result.regions||[]).map(x=>x.id);s.activeId=rows[0]?.id||s.result.regions?.[0]?.id||'';
      if(scope==='full'){s.focusMode=false;s.bigZoom=1;s.resetStageViewport=true;}
      s.tab='combined';s.error='';const retryNote=Number(d.submitAttempts||1)>1?` · 云端提交自动尝试 ${d.submitAttempts} 次`:'';s.message=scope==='local'?`局部重新识别完成，新获得 ${rows.length} 个区域并替换选区内旧结果${retryNote}${hybridWarning}`:`识别完成，共获得 ${rows.length} 个区域 · ${fullMode==='preserve_manual'?'已保留手动调整区域':'已覆盖全部'}${retryNote}${hybridWarning}`;s.progress={phase:'done',message:s.message,startedAt:s.progress.startedAt,elapsed:Math.round((Date.now()-s.progress.startedAt)/1000),jobId:d.jobId||'',scope};s.progressExpanded=false;if(!rows.length)s.error='云端任务已完成，但没有返回可用区域。';
    }catch(e){stopSubmissionWatch();if(!isCurrent())return;s.error=e.message;s.message='识别失败：'+e.message;s.progress={phase:'failed',message:s.message,startedAt:s.progress.startedAt,elapsed:Math.round((Date.now()-s.progress.startedAt)/1000),jobId:s.progress.jobId||'',scope};s.progressExpanded=true;toast('视觉识别失败：'+e.message,'bad');}
    finally{stopSubmissionWatch();if(isCurrent()){s.busy=false;stopBusyTicker();renderOcr();}}
  }
  window.__V22_RUN_RECOGNITION_TEST__=(scope,mode)=>runRecognition(scope,mode);


  function typeOptions(type){return Object.entries(TYPE_META).map(([k,v])=>`<option value="${k}" ${type===k?'selected':''}>${v.label}</option>`).join('');}
  function sourceLabel(s){return s==='main'?'自动同步自图片微调主图':'识别页独立图片';}
  function selectedSet(){return new Set(ensure().selected||[]);}
  function typeCounts(s){const counts={text:0,product:0,person:0,background:0,decoration:0};(s.result?.regions||[]).forEach(r=>{if(Object.prototype.hasOwnProperty.call(counts,r.type))counts[r.type]++;});return counts;}
  function shouldCompactRegionLabels(s){
    const rows=(s.result&&Array.isArray(s.result.regions))?s.result.regions.filter(r=>r.visible!==false):[];
    const count=rows.length,zoom=Number(s.bigZoom||1);
    const occupied=rows.reduce((sum,r)=>sum+Math.max(0,Number(r.width)||0)*Math.max(0,Number(r.height)||0),0);
    const density=count+occupied*7;
    const threshold=density>=24?1.2:density>=17?1.05:density>=11?.9:.72;
    return zoom<threshold;
  }
  function legendHtml(s){const counts=typeCounts(s),entries=Object.entries(TYPE_META),filled=entries.filter(([k])=>(counts[k]||0)>0),empty=entries.filter(([k])=>(counts[k]||0)===0),show=filled.concat(s.legendExpanded?empty:[]);return `<div class="v151-region-legend" aria-label="识别区域颜色说明">${show.map(([key,m])=>`<span class="v151-legend-item ${counts[key]?'':'empty'}" style="--legend-color:${m.color}"><i></i><b>${h(m.label)}</b><em>${counts[key]||0}</em></span>`).join('')}${empty.length?`<button type="button" class="v168-legend-toggle" data-v168-legend-toggle>${s.legendExpanded?'收起空类型':'显示空类型 '+empty.length}</button>`:''}</div>`;}
  function diffRowLabel(r){return regionName(r);}
  function recognitionDiffHtml(s){
    const d=s.lastRecognitionDiff||{added:0,removed:0,changed:0},details=!!s.diffDetailsOpen;
    const changedRows=d.changedRows||d.details||[],addedRows=d.addedRows||[],removedRows=d.removedRows||[];
    const list=details?`<div class="v168-diff-detail">${addedRows.length?`<section><b>新增区域</b>${addedRows.map(r=>`<span class="added">＋ ${h(diffRowLabel(r))}</span>`).join('')}</section>`:''}${removedRows.length?`<section><b>移除区域</b>${removedRows.map(r=>`<span class="removed">－ ${h(diffRowLabel(r))}</span>`).join('')}</section>`:''}${changedRows.length?`<section><b>发生变化</b>${changedRows.map(x=>`<span class="changed">↻ ${h(diffRowLabel(x.after||x.before))}</span>`).join('')}</section>`:''}</div>`:'';
    return `<div class="v168-diff-card"><div class="v168-diff-head"><b>本次重新识别变化</b><button type="button" data-v168-diff-details>${details?'收起详细区域':'展开详细区域'}</button></div><div class="v168-diff-summary"><span>新增 ${d.added||0}</span><span>移除 ${d.removed||0}</span><span>变更 ${d.changed||0}</span></div><small>${s.fullRecognitionMode==='preserve_manual'?'手动调整区域已优先保留。':'本次结果已覆盖旧识别区域。'}</small>${list}</div>`;
  }
  function progressHtml(s){
    const p=s.progress||freshProgress(),order=['preparing','submitting','waiting','parsing','done'],current=order.indexOf(p.phase),failed=p.phase==='failed';
    const steps=[['preparing','准备图片'],['submitting','创建任务'],['waiting','云端识别'],['parsing','解析区域'],['done','完成']];
    if(p.phase==='idle'&&!s.busy)return `<div class="v152-ready-card"><b>识别提示</b><p>点击“开始视觉识别”后，将按官方 API 流程创建任务、轮询状态，并使用不携带令牌的独立通道下载 BOS 预签名结果。完成后可在左右对照视图中复核、复制和纠正识别块。</p></div>`;
    const total=(s.result?.regions||[]).length;
    if(p.phase==='done'&&!s.progressExpanded){const d=s.lastRecognitionDiff||{},hasDiff=(d.added||d.removed||d.changed);return `<div class="v154-progress-summary v168-progress-summary"><span><i>✓</i><b>识别完成 · ${total} 个区域 · ${Number(p.elapsed||0)} 秒</b></span><span class="v168-progress-actions">${hasDiff?'<button type="button" data-v168-diff-toggle>查看变化</button>':''}<button type="button" data-v154-progress-toggle>任务详情⌄</button></span></div>${s.diffOpen?recognitionDiffHtml(s):''}`;}
    return `<div class="v152-progress-card ${failed?'failed':p.phase==='done'?'done':''}"><div class="v152-progress-head"><b>${failed?'识别失败':p.phase==='done'?'识别完成':'PaddleOCR-VL 正在识别'}</b><span data-v152-elapsed>${p.elapsed?`已等待 ${p.elapsed} 秒`:''}</span></div><div class="v152-progress-steps">${steps.map(([key,label],i)=>`<div class="v152-step ${failed&&i===Math.max(0,current)?'bad':i<current||p.phase==='done'?'done':i===current?'active':''}"><i>${i<current||p.phase==='done'?'✓':i+1}</i><span>${label}</span></div>`).join('')}</div><p>${h(p.message||s.message||'')}</p>${p.phase==='done'?'<button type="button" class="v154-progress-collapse" data-v154-progress-toggle>收起详情⌃</button>':''}</div>`;
  }
  function regionListHtml(s){
    if(s.busy||(!s.result&&s.progress.phase!=='idle'))return progressHtml(s);
    if(!s.result)return progressHtml(s);
    const sel=selectedSet(),allRows=s.result.regions||[],active=allRows.find(r=>String(r.id)===String(s.activeId))||allRows[0],rows=active?[active]:[];
    if(!rows.length)return progressHtml(s)+'<div class="v15-result-empty">本次没有识别到可用区域，可使用“局部识别”菜单重试，或切换“云端 + 视觉 API”。</div>';
    return `${progressHtml(s)}<div class="v15-result-summary"><span>${allRows.length} 个区域</span><span>已选 ${sel.size} 个</span><span>${h(s.result.model)}</span>${active?`<span class="v168-current-summary">当前 ${h(regionName(active))}</span>`:''}${s.result.downloadDiagnostics?`<span>结果下载：${h(s.result.downloadDiagnostics.via||'direct')} · ${Number(s.result.downloadDiagnostics.redirects||0)} 次跳转</span>`:''}</div>${legendHtml(s)}`+rows.map((r,i)=>{
      const m=TYPE_META[r.type]||TYPE_META.decoration,on=sel.has(r.id),editing=s.regionTextEditing===r.id,order=Math.max(1,allRows.findIndex(x=>String(x.id)===String(r.id))+1);
      const drafts=s.regionTextDrafts||{},hasDraft=Object.prototype.hasOwnProperty.call(drafts,r.id),content=hasDraft?String(drafts[r.id]):String(r.recognizedText??r.content??r.label??''),expanded=!!(s.v177ClosedExpanded&&s.v177ClosedExpanded[r.id]),collapsed=!on&&!expanded;
      if(collapsed){
        return `<article class="v15-region-card active off v177-closed-collapsed" style="--box-color:${m.color}" data-region-type="${attr(r.type)}" data-v15-region-active="${attr(r.id)}"><div class="v15-region-card-head"><input type="checkbox" data-v15-region-check="${attr(r.id)}"><b>${order}. ${h(regionName(r,m.label))}</b><button type="button" class="v177-closed-expand" data-v177-closed-expand="${attr(r.id)}">展开</button></div></article>`;
      }
      return `<article class="v15-region-card ${s.activeId===r.id?'active':''} ${on?'':'off'} ${!on?'v177-closed-expanded':''}" style="--box-color:${m.color}" data-region-type="${attr(r.type)}" data-v15-region-active="${attr(r.id)}">
        <div class="v15-region-card-head"><input type="checkbox" data-v15-region-check="${attr(r.id)}" ${on?'checked':''}><span class="v151-type-dot"></span><b>${order}. ${h(regionName(r,m.label))}</b><span class="v151-type-badge">${h(m.label)}</span>${!on?`<span class="v177-closed-state">已关闭</span><button type="button" class="v177-closed-expand" data-v177-closed-expand="${attr(r.id)}">收起</button>`:''}</div>
        <div class="v177-region-card-body"><small>${h(String(r.source||'').includes('local')?'局部重新识别':String(r.source||'')==='manual-free-region'?'手动添加':String(r.source||'').includes('manual')?'手动调整':r.source==='paddleocr-cloud'?'PaddleOCR 云端':'视觉 API')} · ${r.confidence==null?'无置信度':Math.round(Number(r.confidence||0)*100)+'%'} · ${Math.round(r.width*100)}×${Math.round(r.height*100)}%</small>
        ${editing?`<div class="v163-region-text-editor"><textarea data-v163-region-text-input="${attr(r.id)}" aria-label="修改区域文案">${h(content)}</textarea><div><button type="button" data-v163-region-text-save="${attr(r.id)}">保存文案</button><button type="button" data-v163-region-text-cancel="${attr(r.id)}">取消</button></div><small>保存后会同步到“AI 修改指令”；Ctrl+Enter 保存，Esc 取消。</small></div>`:`<button type="button" class="v15-recognized-text v163-region-text-trigger" data-v163-region-text="${attr(r.id)}" title="点击修正文案">${h((Object.prototype.hasOwnProperty.call(r,'recognizedText')?r.recognizedText:(r.content??r.label??''))||(r.regionTextEdited?'（已设为空文案）':'点击修正文案'))}</button>`}
        <label class="v151-type-select"><span>区域类型</span><select data-v15-region-type="${attr(r.id)}">${typeOptions(r.type)}</select></label></div>
      </article>`;
    }).join('');
  }
  function blockMeta(b){const kind=String(b&&b.kind||b&&b.blockLabel||'text').toLowerCase();if(/formula|equation|algorithm/.test(kind))return{label:'行间公式',className:'formula'};if(/table/.test(kind))return{label:'表格',className:'table'};if(/image|figure|chart|picture/.test(kind))return{label:'图片',className:'image'};if(/title/.test(kind))return{label:'标题',className:'title'};if(/seal|stamp/.test(kind))return{label:'印章',className:'seal'};return{label:'文本',className:'text'};}
  function blockRows(s){const rows=Array.isArray(s.result?.documentBlocks)&&s.result.documentBlocks.length?s.result.documentBlocks:(s.result?.regions||[]).map((r,i)=>({id:r.id,type:r.type,kind:r.kind||'text',blockLabel:r.blockLabel||r.type,label:r.label,content:r.recognizedText||r.label||'',confidence:r.confidence,page:r.page||1,order:i,x:r.x,y:r.y,width:r.width,height:r.height}));return rows;}
  function overlapScore(a,b){const ax2=a.x+a.width,ay2=a.y+a.height,bx2=b.x+b.width,by2=b.y+b.height,iw=Math.max(0,Math.min(ax2,bx2)-Math.max(a.x,b.x)),ih=Math.max(0,Math.min(ay2,by2)-Math.max(a.y,b.y)),inter=iw*ih,uni=a.width*a.height+b.width*b.height-inter;return uni>0?inter/uni:0;}
  function nearestRegion(block){let best=null,score=0;(ensure().result?.regions||[]).forEach(r=>{const v=overlapScore(block,r);if(v>score){score=v;best=r;}});return best;}
  function documentViewHtml(s){if(!s.result)return'<div class="v15-result-empty">识别完成后显示文档解析结果。</div>';const rows=blockRows(s),filter=s.documentFilter||'all',activeRegion=regionById(s.activeId),scoped=!activeRegion?rows:rows.filter(b=>nearestRegion(b)?.id===activeRegion.id),visible=filter==='all'?scoped:scoped.filter(b=>blockMeta(b).className===filter);if(!rows.length)return `<pre class="v15-code-view">${h(s.result.markdown||'云端结果未返回可复核的版面块。')}</pre>`;const diag=s.result.downloadDiagnostics||{};return `<div class="v153-doc-toolbar"><div><b>文档对照复核</b><small>${rows.length} 个解析块${diag.host?` · 结果源 ${h(diag.host)}`:''}</small></div><div class="v153-doc-actions"><select data-v153-doc-filter><option value="all" ${filter==='all'?'selected':''}>全部类型</option><option value="text" ${filter==='text'?'selected':''}>文本</option><option value="title" ${filter==='title'?'selected':''}>标题</option><option value="formula" ${filter==='formula'?'selected':''}>公式</option><option value="table" ${filter==='table'?'selected':''}>表格</option><option value="image" ${filter==='image'?'selected':''}>图片</option></select><button type="button" data-v153-copy-all>复制全部</button><button type="button" data-v153-download-json>导出 JSON</button></div></div><div class="v153-doc-list">${visible.map((b,i)=>{const meta=blockMeta(b),editing=s.editingBlockId===b.id,content=String(s.blockEdits?.[b.id]??b.content??b.recognizedText??'');return `<article class="v153-doc-block ${meta.className} ${s.activeId===nearestRegion(b)?.id?'active':''}" data-v153-doc-active="${attr(b.id)}"><header><span>${h(meta.label)}</span><em>第 ${b.page||1} 页 · ${i+1}</em><div><button type="button" data-v153-copy-block="${attr(b.id)}">复制</button><button type="button" data-v153-edit-block="${attr(b.id)}">${editing?'取消':'纠正'}</button></div></header>${editing?`<textarea data-v153-edit-input="${attr(b.id)}">${h(content)}</textarea><div class="v153-edit-actions"><button type="button" data-v153-save-block="${attr(b.id)}">保存纠正</button></div>`:`<div class="v153-doc-content">${h(content||b.label||'未返回文本内容')}</div>`}</article>`;}).join('')}</div>`;}
  function regionPickerHtml(s){
    const rows=(s.result?.regions||[]),active=rows.find(r=>String(r.id)===String(s.activeId))||rows[0],query=String(s.v168RegionSearch||'').trim().toLowerCase();
    const filtered=query?rows.filter(r=>`${regionName(r)} ${(TYPE_META[r.type]||TYPE_META.decoration).label}`.toLowerCase().includes(query)):rows;
    return `<div class="v168-region-picker">
      <button type="button" class="v168-region-picker-main" data-v168-region-picker-toggle><span>当前区域</span><b>${active?h(regionName(active)):'请选择区域'}</b><i>${s.v168RegionPickerOpen?'⌃':'⌄'}</i></button>
      ${s.v168RegionPickerOpen?`<div class="v168-region-picker-pop"><input type="search" value="${h(s.v168RegionSearch||'')}" placeholder="搜索区域名称或类型" data-v168-region-search autofocus><div class="v168-region-picker-list">${filtered.length?filtered.map(r=>{const meta=TYPE_META[r.type]||TYPE_META.decoration;return `<button type="button" class="${String(r.id)===String(s.activeId)?'on':''}" data-v168-region-pick="${attr(r.id)}" data-v168-region-key="${attr(`${regionName(r)} ${meta.label}`.toLowerCase())}"><i style="--picker-color:${meta.color}"></i><span><b>${h(regionName(r))}</b><small>${h(meta.label)}</small></span></button>`;}).join(''):'<p>没有匹配的区域</p>'}</div></div>`:''}
    </div>`;
  }
  function combinedReviewHtml(s){
    s.showAllRegions=false;
    const regionHtml=regionListHtml(s),docHtml=documentViewHtml(s);
    return `<div class="v162-combined-review"><section class="v162-combined-section v162-region-section"><header class="v168-combined-head"><div><b>区域与文案</b><small>只展示当前区域；通过区域选择器搜索和切换</small></div>${regionPickerHtml(s)}</header>${regionHtml}</section><section class="v162-combined-section v162-document-section"><header><div><b>识别文案纠正</b><small>点击解析块可定位当前区域，并可复制或纠正文案</small></div></header>${docHtml}</section></div>`;
  }
  function diagnosticDetailsHtml(s){
    const result=s.result||{},jobId=result.jobId||s.progress?.jobId||'',imageKey=s.v22ImageKey||result.imageKey||'',revision=Number(s.v22ImageRevision||result.imageRevision)||0,epoch=Number(s.v22AppliedRecognitionEpoch||result.recognitionEpoch)||0,rows=result.regions||[],misaligned=rows.filter(r=>Number(r.v22RecognitionEpoch||epoch)===epoch&&r.v22GeometryBound&&r.sourceBBox&&(Math.abs((Number(r.x)||0)-(Number(r.sourceBBox.x)||0))+Math.abs((Number(r.y)||0)-(Number(r.sourceBBox.y)||0))+Math.abs((Number(r.width)||0)-(Number(r.sourceBBox.width)||0))+Math.abs((Number(r.height)||0)-(Number(r.sourceBBox.height)||0))>.0002)).length;
    const professional=!!(s.v155&&(s.v155.v169ProfessionalMode||s.v155.v17ProfessionalMode));
    const failed=!!s.error||s.progress?.phase==='failed'||!!s.v222IntegrityFailed;
    if(!professional&&!failed&&!misaligned)return'';
    const reason=misaligned?'检测到坐标异常':failed?'识别或清场异常':'专业模式已开启';
    const tone=misaligned||failed?' issue':' professional';
    return `<details class="v221-diagnostic-details${tone}"><summary><span><b>诊断详情</b><small>${h(reason)} · 技术编号仅在此处显示</small></span><i>⌄</i></summary><div class="v221-diagnostic-grid"><label><span>图片会话键 imageKey</span><code>${h(imageKey||'尚未建立')}</code></label><label><span>图片修订号</span><code>${revision||0}</code></label><label><span>识别任务轮次 recognitionEpoch</span><code>${epoch||0}</code></label><label><span>云端任务 ID</span><code>${h(jobId||'尚未创建')}</code></label><label><span>当前区域数量</span><code>${rows.length}</code></label><label><span>坐标绑定检查</span><code>${misaligned?`${misaligned} 个异常`:'正常'}</code></label></div><p>正常状态下诊断入口自动隐藏；识别失败、坐标异常或开启专业模式时才会显示。</p></details>`;
  }
  function resultContent(s){const diag=diagnosticDetailsHtml(s);if(s.tab==='json')return (s.result?`<pre class="v15-code-view">${h(JSON.stringify(s.result.raw,null,2))}</pre>`:'<div class="v15-result-empty">识别完成后显示结构化 JSON。</div>')+diag;return combinedReviewHtml(s)+diag;}
  function boxesHtml(s){
    if(!s.result)return'';const sel=selectedSet();
    return(s.result.regions||[]).map((r,i)=>{const m=TYPE_META[r.type]||TYPE_META.decoration,on=sel.has(r.id),editable=s.correctionMode&&s.activeId===r.id&&on,activeOn=s.activeId===r.id&&on;return `<div role="button" tabindex="0" class="v15-region-box ${activeOn?'active':''} ${on?'':'off'} ${s.correctionMode&&on?'correcting':''}" style="--box-color:${m.color};left:${r.x*100}%;top:${r.y*100}%;width:${Math.min(r.width,1-r.x)*100}%;height:${Math.min(r.height,1-r.y)*100}%" data-region-type="${attr(r.type)}" data-v15-region-active="${attr(r.id)}" data-v154-region-box="${attr(r.id)}"><span class="v15-region-label"><i></i>${i+1} · ${h(m.label)} · ${h(regionName(r,m.label))}</span>${editable?'<i class="v154-corner nw" data-v154-region-handle="nw"></i><i class="v154-corner ne" data-v154-region-handle="ne"></i><i class="v154-corner sw" data-v154-region-handle="sw"></i><i class="v154-corner se" data-v154-region-handle="se"></i>':''}</div>`;}).join('');
  }
  function cropBoxHtml(s){if(!s.crop)return'<div class="v152-local-selection" hidden></div>';return `<div class="v152-local-selection" style="left:${s.crop.x*100}%;top:${s.crop.y*100}%;width:${s.crop.width*100}%;height:${s.crop.height*100}%"><span>局部识别范围</span></div>`;}
  function addDraftHtml(){const s=ensure(),b=s.v194PendingRegionBox;if(!b)return '<div class="v154-add-selection" hidden><span>新增区域</span></div>';return `<div class="v154-add-selection v194-pending-selection" style="left:${b.x*100}%;top:${b.y*100}%;width:${b.width*100}%;height:${b.height*100}%"><span>待确认区域</span></div>`;}
  function tokenHtml(s){const st=s.tokenStatus||adjustState.paddleCloudStatus||{};return `<div class="v15-ocr-side-section"><h3>云端令牌</h3><span class="v15-ocr-pill ${statusClass(st)}">${h(statusText(st))}</span><div class="v15-ocr-side-actions"><button type="button" class="v15-ocr-btn" data-v15-token-check>检查配置</button><button type="button" class="v15-ocr-btn" data-v15-token-toggle>${s.showToken?'收起令牌':'配置令牌'}</button></div>${s.showToken?`<div class="v15-token-box" style="margin-top:8px"><input type="password" autocomplete="off" placeholder="PaddleOCR Access Token" data-v15-token-input><div class="v15-token-row"><button type="button" class="v15-ocr-btn" data-v15-token-session>仅本次使用</button><button type="button" class="v15-ocr-btn" data-v15-token-save>本机加密保存</button></div><small class="v152-secure-note">V18 使用兼容加密文件，不再调用 PowerShell ProtectedData。</small>${st.configured?'<button type="button" class="v15-ocr-btn" data-v15-token-clear>清除令牌</button>':''}</div>`:''}</div>`;}
  function localSelectionPreviewHtml(s){
    if(!s.crop||!s.cropConfirmed)return'';
    const c=s.crop,areaPct=Math.max(0,c.width)*Math.max(0,c.height)*100,open=!!s.v193SelectionCoordsOpen;
    return `<div class="v192-selection-preview v193-selection-preview" aria-label="已确认选区参数"><header><span><i>✓</i><b>选区确认预览</b></span><em>已锁定</em></header><div class="v193-selection-summary"><strong>面积占比 ${areaPct.toFixed(1)}%</strong><button type="button" data-v193-selection-coords>${open?'收起坐标':'查看坐标'}</button></div>${open?`<div class="v193-selection-coords"><span>X ${(c.x*100).toFixed(1)}%</span><span>Y ${(c.y*100).toFixed(1)}%</span><span>W ${(c.width*100).toFixed(1)}%</span><span>H ${(c.height*100).toFixed(1)}%</span></div>`:''}<small>重新框选会自动取消本次确认，避免误用旧选区。</small></div>`;
  }
  function localToolsHtml(s){
    const cropReady=!!(s.crop&&s.crop.width>=.015&&s.crop.height>=.015),confirmed=cropReady&&!!s.cropConfirmed;
    const step=!cropReady?'draw':confirmed?'run':'confirm';
    const summary=!cropReady?'第 1 步：框选局部区域':confirmed?`第 3 步：选区已确定 · 面积 ${(s.crop.width*s.crop.height*100).toFixed(1)}%`:`第 2 步：确认 ${Math.round(s.crop.width*100)}% × ${Math.round(s.crop.height*100)}% 选区`;
    const drawLabel=s.selectionMode?'正在框选…':cropReady?'重新框选':'框选局部区域';
    const actions=[`<button type="button" class="v15-ocr-btn ${step==='draw'?'primary v192-current-step':''} ${s.selectionMode?'active':''}" data-v152-select-local ${s.busy?'disabled':''}><span class="v192-step-no">1</span>${drawLabel}</button>`];
    if(cropReady){
      actions.push(`<button type="button" class="v15-ocr-btn" data-v152-clear-local ${s.busy?'disabled':''}>清除选区</button>`);
      actions.push(`<button type="button" class="v15-ocr-btn ${step==='confirm'?'primary v192-current-step':confirmed?'active':''}" data-v191-confirm-local ${!confirmed&&!s.busy?'':'disabled'}><span class="v192-step-no">2</span>${confirmed?'选区已确定':'确定选区'}</button>`);
      actions.push(`<button type="button" class="v15-ocr-btn primary ${step==='run'?'v192-current-step':''}" data-v152-run-local ${confirmed&&!s.busy?'':'disabled'}><span class="v192-step-no">3</span>重新识别选区</button>`);
    }
    return `<div class="v154-local-menu"><button type="button" class="v154-local-main ${s.localMenuOpen?'open':''}" data-v154-local-toggle><span><b>局部识别</b><small>${summary}</small></span><i>${s.localMenuOpen?'⌃':'⌄'}</i></button>${s.localMenuOpen?`<div class="v154-local-pop v192-local-pop"><div class="v192-local-progress" data-step="${step}"><i class="${step==='draw'?'on':'done'}">1</i><span></span><i class="${step==='confirm'?'on':confirmed?'done':''}">2</i><span></span><i class="${step==='run'?'on':''}">3</i></div><div class="v192-local-actions">${actions.join('')}</div>${localSelectionPreviewHtml(s)}</div>`:''}</div>`;
  }
  function correctionToolsHtml(s){
    const has=!!(s.result&&(s.result.regions||[]).length),zoom=Math.round(Number(s.bigZoom||1)*100);
    return `<div class="v154-correction-tools v163-correction-tools v168-direct-tools v193-direct-tools">
      <div><b>识别区域直接编辑</b><small>${!has?'识别完成后可选择区域并进入“调整”':'选择区域后使用“调整”进行位置、尺寸与提示词编辑'}</small></div>
      <div class="v154-correction-actions">
        ${!s.focusMode?`<div class="v163-zoom-controls" aria-label="整图画布缩放"><button type="button" data-v163-zoom-minus title="缩小">−</button><button type="button" data-v163-zoom-fit title="恢复100%">${zoom}%</button><input type="range" min="50" max="300" step="10" value="${zoom}" data-v163-zoom-range aria-label="缩放比例"><button type="button" data-v163-zoom-plus title="放大">＋</button></div>`:''}
        ${has&&!s.focusMode?'<button type="button" class="v15-ocr-btn" data-v164-focus-toggle>聚焦当前区域</button>':''}
      </div>
    </div>`;
  }


  function v164Clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function v164Box(r){return r&&r.sourceBBox?{x:Number(r.sourceBBox.x)||0,y:Number(r.sourceBBox.y)||0,width:Number(r.sourceBBox.width)||.1,height:Number(r.sourceBBox.height)||.1}:{x:Number(r&&r.x)||0,y:Number(r&&r.y)||0,width:Number(r&&r.width)||.1,height:Number(r&&r.height)||.1};}
  function v164Target(r){const b=v164Box(r),t=r&&r.targetBBox;return t?{x:Number(t.x)||0,y:Number(t.y)||0,width:Number(t.width)||b.width,height:Number(t.height)||b.height}:b;}
  function v164FocusBounds(s,r){
    const a=v164Box(r),b=v164Target(r),pad=Number(s.focusPadding||.08),x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y),x1=Math.max(a.x+a.width,b.x+b.width),y1=Math.max(a.y+a.height,b.y+b.height),cx=(x0+x1)/2,cy=(y0+y1)/2;
    let w=Math.max(.22,x1-x0+pad*2),h=Math.max(.22,y1-y0+pad*2);w=Math.min(1,w);h=Math.min(1,h);
    return{x:v164Clamp(cx-w/2,0,1-w),y:v164Clamp(cy-h/2,0,1-h),width:w,height:h};
  }
  function v164Rel(box,c){return{x:(box.x-c.x)/c.width,y:(box.y-c.y)/c.height,width:box.width/c.width,height:box.height/c.height};}
  function v164FocusPreviewHtml(s){
    if(!s.result||!s.focusMode||s.correctionMode||s.selectionMode||s.correctionAddMode)return'';
    const rows=s.result.regions||[],r=rows.find(x=>String(x.id)===String(s.activeId))||rows[0];if(!r)return'';
    const src=v164Box(r),target=v164Target(r),crop=v164FocusBounds(s,r),sr=v164Rel(src,crop),tr=v164Rel(target,crop),changed=Math.abs(src.x-target.x)+Math.abs(src.y-target.y)+Math.abs(src.width-target.width)+Math.abs(src.height-target.height)>.00001;
    const image=s.result.raw&&s.result.raw.image||{},iw=Number(image.width)||1,ih=Number(image.height)||1,ratio=Math.max(.35,Math.min(3,(crop.width*iw)/(crop.height*ih)));
    const meta=TYPE_META[r.type]||TYPE_META.decoration,scale=Number(r.transform&&r.transform.scale_pct||100);
    return `<div class="v164-focus-wrap"><div class="v164-focus-head"><div><b>当前区域聚焦预览</b><small>${h(regionName(r,meta.label))} · 与“调整/精确局部指令”实时联动</small></div><button type="button" data-v164-focus-toggle>返回整图</button></div><div class="v164-focus-stage" style="aspect-ratio:${ratio}" data-v164-focus-shell data-crop-x="${crop.x}" data-crop-y="${crop.y}" data-crop-w="${crop.width}" data-crop-h="${crop.height}" data-region-id="${attr(r.id)}"><img src="${attr(s.src)}" alt="当前区域聚焦" draggable="false" style="width:${100/crop.width}%;height:${100/crop.height}%;left:${-crop.x/crop.width*100}%;top:${-crop.y/crop.height*100}%">${changed?`<div class="v164-focus-source" style="left:${sr.x*100}%;top:${sr.y*100}%;width:${sr.width*100}%;height:${sr.height*100}%"></div>`:''}<div class="v164-focus-target" style="--focus-color:${meta.color};left:${tr.x*100}%;top:${tr.y*100}%;width:${tr.width*100}%;height:${tr.height*100}%" data-v164-focus-target="${attr(r.id)}"><span>${h(regionName(r,meta.label))}</span><i data-v164-focus-handle="nw"></i><i data-v164-focus-handle="ne"></i><i data-v164-focus-handle="sw"></i><i data-v164-focus-handle="se"></i></div></div><div class="v164-focus-readout"><span data-v164-focus-value="x">X ${(target.x*100).toFixed(1)}%</span><span data-v164-focus-value="y">Y ${(target.y*100).toFixed(1)}%</span><span data-v164-focus-value="w">W ${(target.width*100).toFixed(1)}%</span><span data-v164-focus-value="h">H ${(target.height*100).toFixed(1)}%</span><span data-v164-focus-value="s">缩放 ${scale.toFixed(1)}%</span></div></div>`;
  }

  function captureRegionTextEditorState(s,overlay){
    if(!overlay||!s.regionTextEditing)return null;
    const id=String(s.regionTextEditing),input=overlay.querySelector(`[data-v163-region-text-input="${CSS.escape(id)}"]`);
    if(!input)return null;
    s.regionTextDraft=String(input.value??'');s.regionTextDrafts=s.regionTextDrafts||{};s.regionTextDrafts[id]=s.regionTextDraft;
    const focused=document.activeElement===input&&regionTextFocusIntent;
    return{id,focused,start:Number.isFinite(input.selectionStart)?input.selectionStart:input.value.length,end:Number.isFinite(input.selectionEnd)?input.selectionEnd:input.value.length,direction:input.selectionDirection||'none',scrollTop:input.scrollTop||0,scrollLeft:input.scrollLeft||0};
  }
  function restoreRegionTextEditorState(snapshot){
    if(!snapshot||!snapshot.focused)return;
    requestAnimationFrame(()=>{
      const s=ensure();if(!s.open||String(s.regionTextEditing)!==String(snapshot.id))return;
      const input=document.querySelector(`[data-v163-region-text-input="${CSS.escape(String(snapshot.id))}"]`);if(!input)return;
      regionTextFocusIntent=true;s.regionTextFocusedId=String(snapshot.id);
      try{input.focus({preventScroll:true});input.setSelectionRange(Math.min(snapshot.start,input.value.length),Math.min(snapshot.end,input.value.length),snapshot.direction);}catch(_e){}
      input.scrollTop=snapshot.scrollTop;input.scrollLeft=snapshot.scrollLeft;
    });
  }
  function renderOcr(options={}){
    const s=ensure();let el=document.getElementById('v15-ocr-overlay');if(!s.open){if(el)el.remove();s.regionTextRenderPending=false;s.regionTextComposing=false;s.regionTextFocusedId='';regionTextFocusIntent=false;document.documentElement.classList.remove('v15-ocr-lock');document.body.classList.remove('v15-ocr-lock');return;}
    /* 中文/日文 IME 组词期间禁止替换 textarea 节点，避免候选词被中断。 */
    if(s.regionTextComposing&&options.force!==true){s.regionTextRenderPending=true;return;}
    s.regionTextRenderPending=false;
    if(!el){el=document.createElement('div');el.id='v15-ocr-overlay';document.body.appendChild(el);}document.documentElement.classList.add('v15-ocr-lock');document.body.classList.add('v15-ocr-lock');
    const editorSnapshot=captureRegionTextEditorState(s,el);
    const keep={body:el.querySelector('.v15-ocr-body')?.scrollTop||0,stage:el.querySelector('.v15-ocr-stage')?.scrollTop||0,stageLeft:el.querySelector('.v15-ocr-stage')?.scrollLeft||0,results:el.querySelector('.v15-result-content')?.scrollTop||0};
    const st=s.tokenStatus||adjustState.paddleCloudStatus||{},has=!!s.src,selected=(s.selected||[]).length;
    const ui=s.v157&&typeof s.v157==='object'?s.v157:{mode:'canvas',transformExpanded:false};
    const uiMode=['files','regions','canvas','adjust','details','quality'].includes(ui.mode)?ui.mode:'canvas',dui=s.v162Ui||{};
    const leftOpen=uiMode==='files'||uiMode==='regions',rightOpen=!!dui.detailsOpen&&!dui.detailsCollapsed;
    const uiOpen=(leftOpen?' v157-left-open':'')+(rightOpen?' v157-right-open':'')+(dui.detailsCollapsed?' v162-detail-collapsed':'');
    const focusHtml=has&&s.focusMode&&s.result?v164FocusPreviewHtml(s):'';
    el.className=`v15-ocr-overlay v157-ios-ui v164-stable-detail v157-mode-${uiMode}${uiOpen}`;el.innerHTML=`
      <header class="v15-ocr-header"><div class="v15-ocr-head-left"><button type="button" class="v15-ocr-back" data-v213-return-image title="保存当前区域状态并返回 AI 生图" aria-label="返回 AI 生图">← 返回AI生图</button><div class="v15-ocr-title"><b>PaddleOCR-VL 视觉识别工作台 · V20</b><small>区域模板创建、局部选区确认、大图自由缩放与稳定详情抽屉</small></div></div><div class="v15-ocr-head-right"><span class="v15-ocr-pill ${statusClass(st)}">${h(statusText(st))}</span><span class="v15-ocr-pill">模型 PaddleOCR-VL-1.6</span><button type="button" class="v15-ocr-close" data-v15-ocr-close>关闭</button></div></header>
      <div class="v15-ocr-body">
        <aside class="v15-ocr-sidebar"><div class="v15-ocr-side-section"><h3>识别文件</h3>${has?`<div class="v15-ocr-file-card"><img src="${attr(s.src)}" alt=""><div><b>${h(s.name||'识别图片')}</b><small>${h(sourceLabel(s.source))}</small></div></div>`:'<div class="v15-ocr-side-note">尚未载入图片。可从图片微调主图自动同步，或在本页独立上传。</div>'}<div class="v15-ocr-side-actions"><button type="button" class="v15-ocr-btn" data-v15-file-open>${has?'更换识别图片':'上传识别图片'}</button><button type="button" class="v15-ocr-btn" data-v15-sync-main ${adjustState.img?'':'disabled'}>同步图片微调主图</button></div><label class="v15-ocr-field"><span>区域识别模式</span><select data-v15-mode><option value="cloud" ${s.mode==='cloud'?'selected':''}>PaddleOCR 云端版面识别</option><option value="cloud_hybrid" ${s.mode==='cloud_hybrid'?'selected':''}>云端 + 原视觉 API</option></select></label></div>${tokenHtml(s)}<div class="v15-ocr-side-section"><h3>识别状态</h3>${progressHtml(s)}</div></aside>
        <section class="v15-ocr-preview"><div class="v15-ocr-panelbar"><div class="v151-preview-title"><div><b>识别区域预览</b><br><small>${has?h(s.name):'等待图片'}</small></div><span class="v15-ocr-pill">${s.result?(s.result.regions||[]).length+' 个区域':'尚未识别'}</span></div>${legendHtml(s)}</div>${localToolsHtml(s)}${correctionToolsHtml(s)}<div class="v15-ocr-stage ${s.selectionMode?'selecting':''} ${s.correctionMode?'correcting':''} ${s.correctionAddMode?'adding-region':''}" data-v15-dropzone>${has?(focusHtml||`<div class="v15-ocr-image-shell v163-zoom-shell ${shouldCompactRegionLabels(s)?'v168-compact-labels':''}" style="zoom:${Number(s.bigZoom||1)}" data-v152-image-shell><img src="${attr(s.src)}" alt="识别图片" draggable="false">${boxesHtml(s)}${cropBoxHtml(s)}${addDraftHtml()}</div>`):`<div class="v15-ocr-empty"><div class="v15-ocr-drop ${s.drag?'drag':''}" data-v15-file-open><div class="v15-upload-icon">↥</div><strong>点击上传或拖入文件开始解析</strong><p>支持 PNG / JPG / WebP；图片微调主图上传后也会自动出现在这里。</p><button class="v15-ocr-btn primary" type="button">选择图片</button></div></div>`}${s.busy?`<div class="v15-ocr-busy"><div class="v15-ocr-busy-card"><div class="v15-spinner"></div><b>${s.progress.scope==='local'?'局部重新识别进行中':'云端视觉识别进行中'}</b><p class="v15-ocr-side-note">${h(s.progress.message||s.message)}</p><span data-v152-elapsed>${s.progress.elapsed?`已等待 ${s.progress.elapsed} 秒`:''}</span></div></div>`:''}</div></section>
        <aside class="v15-ocr-results"><div class="v15-result-tabs"><button type="button" class="${s.tab!=='json'?'on':''}" data-v15-tab="combined">区域与文案</button><button type="button" class="${s.tab==='json'?'on':''}" data-v15-tab="json">JSON</button></div><div class="v15-result-content">${resultContent(s)}</div></aside>
      </div>
      <footer class="v15-ocr-footer"><div class="v15-footer-note">${s.error?`错误：${h(s.error)}`:h(s.message||'识别结果应用后，会生成图片微调区域 Mask。')}</div><div class="v15-footer-actions"><button type="button" class="v15-ocr-btn" data-v15-file-open>${has?'更换图片':'上传图片'}</button>${s.result?`<div class="v168-run-split"><button type="button" class="v15-ocr-btn primary" data-v168-run-main ${has&&!s.busy?'':'disabled'}>重新识别整图</button><button type="button" class="v15-ocr-btn primary v168-run-arrow" data-v168-run-menu ${has&&!s.busy?'':'disabled'}>⌄</button>${s.recognitionMenuOpen?`<div class="v168-run-menu"><button type="button" data-v168-run-mode="replace_all" class="${s.fullRecognitionMode==='replace_all'?'on':''}">覆盖全部</button><button type="button" data-v168-run-mode="preserve_manual" class="${s.fullRecognitionMode==='preserve_manual'?'on':''}">保留手动调整区域</button></div>`:''}</div>`:`<button type="button" class="v15-ocr-btn primary" data-v168-run-main ${has&&!s.busy?'':'disabled'}>开始视觉识别</button>`}<button type="button" class="v15-ocr-btn primary" data-v15-apply ${s.result&&selected&&!s.busy?'':'disabled'}>应用 ${selected||''} 个区域到图片微调</button></div></footer><input type="file" id="v15-ocr-file" accept="image/png,image/jpeg,image/webp" hidden>`;
    bindOverlay(el);
    requestAnimationFrame(()=>{const cur=document.getElementById('v15-ocr-overlay');if(!cur)return;const body=cur.querySelector('.v15-ocr-body'),stage=cur.querySelector('.v15-ocr-stage'),results=cur.querySelector('.v15-result-content');const resetViewport=!!s.resetStageViewport;if(body)body.scrollTop=resetViewport?0:keep.body;if(stage){stage.scrollTop=resetViewport?0:keep.stage;stage.scrollLeft=resetViewport?0:keep.stageLeft;}if(results)results.scrollTop=keep.results;if(resetViewport)s.resetStageViewport=false;});
    restoreRegionTextEditorState(editorSnapshot);
  }

  function bindOverlay(el){
    const bind=(sel,fn)=>el.querySelectorAll(sel).forEach(node=>{node.onclick=ev=>{ev.preventDefault();ev.stopPropagation();fn(ev,node);};});
    bind('[data-v168-run-main]',()=>runRecognition('full',ensure().fullRecognitionMode));
    bind('[data-v191-confirm-local]',()=>confirmLocalSelection());
    bind('[data-v152-run-local]',()=>runRecognition('local'));
    bind('[data-v154-progress-toggle]',()=>{const s=ensure();s.progressExpanded=!s.progressExpanded;renderOcr();});
    bind('[data-v154-local-toggle]',()=>{const s=ensure();s.localMenuOpen=!s.localMenuOpen;renderOcr();});
    bind('[data-v154-add-region]',()=>toggleAddRegion());
    bind('[data-v154-delete-active]',()=>deleteRegion(ensure().activeId));
    bind('[data-v164-focus-toggle]',()=>{const s=ensure();s.focusMode=!s.focusMode;renderOcr();});
    bind('[data-v163-zoom-minus]',()=>setBigZoom((ensure().bigZoom||1)-.1));
    bind('[data-v163-zoom-plus]',()=>setBigZoom((ensure().bigZoom||1)+.1));
    bind('[data-v163-zoom-fit]',()=>setBigZoom(1));
    bind('[data-v152-select-local]',()=>{const s=ensure();s.selectionMode=!s.selectionMode;if(s.selectionMode){s.cropConfirmed=false;toast('请在中间图片上按住鼠标拖出局部识别范围');}renderOcr();});
    bind('[data-v152-clear-local]',()=>{const s=ensure();s.crop=null;s.cropConfirmed=false;s.selectionMode=false;renderOcr();});
    bind('[data-v15-ocr-close]',()=>closeOcr());
    bind('[data-v15-file-open]',()=>document.getElementById('v15-ocr-file')?.click());
    bind('[data-v15-sync-main]',()=>{if(syncMain(true)){renderOcr();toast('已同步图片微调主图','ok');}else toast('图片微调尚未上传主图','bad');});
    bind('[data-v15-apply]',()=>applyToMain().catch(err=>toast('应用失败：'+err.message,'bad')));
    bind('[data-v15-token-check]',()=>checkToken(true));
    bind('[data-v15-token-toggle]',()=>{ensure().showToken=!ensure().showToken;renderOcr();});
    bind('[data-v15-token-session]',()=>{const input=el.querySelector('[data-v15-token-input]');saveToken(input?.value.trim(),false).catch(err=>toast(err.message,'bad'));});
    bind('[data-v15-token-save]',()=>{const input=el.querySelector('[data-v15-token-input]');saveToken(input?.value.trim(),true).catch(err=>toast(err.message,'bad'));});
    bind('[data-v15-token-clear]',()=>clearToken().catch(err=>toast(err.message,'bad')));
  }
  function setBigZoom(value,live){
    const s=ensure(),next=Math.max(.5,Math.min(3,Number(value)||1));s.bigZoom=Math.round(next*10)/10;
    const shell=document.querySelector('#v15-ocr-overlay [data-v152-image-shell]');if(shell){shell.style.zoom=String(s.bigZoom);shell.classList.toggle('v168-compact-labels',shouldCompactRegionLabels(s));}
    const label=document.querySelector('#v15-ocr-overlay [data-v163-zoom-fit]');if(label)label.textContent=Math.round(s.bigZoom*100)+'%';
    if(!live)renderOcr();
  }
  function pushRegionHistory(label){
    if(typeof window.__V163_REGION_HISTORY_PUSH==='function')window.__V163_REGION_HISTORY_PUSH(label,true);
  }
  function applyRegionTextChange(r,value){
    if(!r)return{changed:false,text:'',original:''};
    const api=window.RegionPromptStateV279||window.RegionPromptStateV278||window.RegionPromptStateV277,result=api?.applyTextEdit?api.applyTextEdit(r,value):{changed:false,text:String(value==null?'':value).trim(),original:String(r.recognizedText??r.content??r.label??'').trim()};
    if(!api?.applyTextEdit){r.recognizedText=result.text;r.content=result.text;r.regionTextEdited=result.original!==result.text;r.manualCorrected=true;}
    r.updated_at=new Date().toISOString();r.status='editing';r.review_status='editing';
    try{window.__V277_SYNC_REGION_PROMPT__?.(r);}catch(_e){}
    return result;
  }
  function focusRegionTextEditor(id){
    regionTextFocusIntent=true;const s=ensure();s.regionTextFocusedId=String(id);
    queueMicrotask(()=>{const node=document.querySelector(`[data-v163-region-text-input="${CSS.escape(String(id))}"]`);if(!node)return;node.focus({preventScroll:true});const n=node.value.length;try{node.setSelectionRange(n,n);}catch(_e){}});
  }
  function syncRegionTextBlock(s,r,text){
    const blocks=blockRows(s);let best=null,bestScore=0;
    blocks.forEach(b=>{const score=overlapScore(b,r);if(score>bestScore){bestScore=score;best=b;}});
    if(best){best.content=text;best.recognizedText=text;s.blockEdits[best.id]=text;}
    return best;
  }
  function commitActiveRegionTextDraft(options={}){
    const s=ensure(),id=String(options.id||s.regionTextEditing||'');
    if(!id)return{committed:false,reason:'no-active-draft'};
    const r=regionById(id);if(!r)return{committed:false,reason:'region-missing',id};
    const selector=`[data-v163-region-text-input="${CSS.escape(id)}"]`,input=document.querySelector(selector),drafts=s.regionTextDrafts||{},hasDraft=Object.prototype.hasOwnProperty.call(drafts,id),hasValue=Object.prototype.hasOwnProperty.call(options,'value');
    if(!input&&!hasDraft&&!hasValue)return{committed:false,reason:'draft-missing',id};
    const value=hasValue?options.value:(input?input.value:drafts[id]);
    if(options.history!==false)pushRegionHistory('修正文案前');
    const result=applyRegionTextChange(r,value),text=result.text;
    syncRegionTextBlock(s,r,text);
    s.regionTextEditing='';s.regionTextDraft='';s.regionTextFocusedId='';s.regionTextComposing=false;s.regionTextRenderPending=false;regionTextFocusIntent=false;delete drafts[id];s.regionTextDrafts=drafts;
    syncCorrectedRegions();
    if(options.history!==false)pushRegionHistory('修正文案');
    if(options.render!==false)renderOcr();
    if(options.toast!==false)toast(result.changed?'区域文案已保存，并同步到 AI 修改指令':'区域文案已恢复为原文','ok');
    return{committed:true,id,result,text};
  }
  function updateRegionText(id,value){return commitActiveRegionTextDraft({id,value,history:true,render:true,toast:true});}
  window.__V279_COMMIT_ACTIVE_REGION_TEXT__=window.__V278_COMMIT_ACTIVE_REGION_TEXT__=options=>commitActiveRegionTextDraft(options||{});
  function openOcr(){syncMain(false);const s=ensure();s.open=true;s.error='';s.message=s.message||'等待开始识别';renderOcr();if(!s.tokenStatus&&!adjustState.paddleCloudStatus?.checked)checkToken(false);}
  window.openV154OcrWorkspace=openOcr;window.openV153OcrWorkspace=openOcr;window.openV152OcrWorkspace=openOcr;window.openV151OcrWorkspace=openOcr;
  function closeOcr(){try{commitActiveDocumentBlockDraft({history:true,render:false,toast:false});}catch(_e){}try{commitActiveRegionTextDraft({history:true,render:false,toast:false});}catch(_e){}const routeMode=window.__V207_REGION_ROUTE__===true,s=ensure();s.open=false;s.selectionMode=false;s.correctionAddMode=false;s.v199CreationStep='info';window.__V2051_DISARM_DRAWING__?.();renderOcr();if(routeMode){window.__V207_REGION_ROUTE__=false;document.body.classList.remove('v207-region-route');setTimeout(()=>{if(typeof window.render==='function')window.render('home');else if(typeof render==='function')render('home');},0);}}
  function regionById(id){return(ensure().result?.regions||[]).find(x=>x.id===id);}
  function refreshHotSwitchPanels(id,opts={}){
    const s=ensure(),overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return;
    const enabled=(s.selected||[]).includes(id);
    overlay.querySelectorAll('[data-v15-region-active],[data-v154-region-box],[data-v155-target-box],[data-v155-select-region]').forEach(el=>{const rid=el.dataset.v15RegionActive||el.dataset.v154RegionBox||el.dataset.v155TargetBox||el.dataset.v155SelectRegion,isCanvas=!!(el.dataset.v154RegionBox||el.dataset.v155TargetBox);el.classList.toggle('active',String(rid)===String(id)&&(!isCanvas||enabled));});
    const content=overlay.querySelector('.v15-result-content');
    if(content&&s.v155?.view!=='edit'){content.innerHTML=resultContent(s);}
    if(typeof window.__V168_REFRESH_ACTIVE_PANELS==='function')window.__V168_REFRESH_ACTIVE_PANELS(id);
    const current=overlay.querySelector(`.v15-region-card[data-v15-region-active="${CSS.escape(String(id))}"]`);if(current&&content&&opts.scroll!==false)setTimeout(()=>{const top=current.offsetTop,bottom=top+current.offsetHeight;if(top<content.scrollTop)content.scrollTop=Math.max(0,top-8);else if(bottom>content.scrollTop+content.clientHeight)content.scrollTop=Math.max(0,bottom-content.clientHeight+8);},0);
    const leftList=overlay.querySelector('.v155-left-list'),leftCard=overlay.querySelector(`.v155-left-card[data-v155-select-region="${CSS.escape(String(id))}"]`);
    if(leftList&&leftCard){setTimeout(()=>{const top=leftCard.offsetTop,bottom=top+leftCard.offsetHeight;if(top<leftList.scrollTop)leftList.scrollTop=Math.max(0,top-8);else if(bottom>leftList.scrollTop+leftList.clientHeight)leftList.scrollTop=Math.max(0,bottom-leftList.clientHeight+8);leftCard.classList.remove('v176-list-pulse');void leftCard.offsetWidth;leftCard.classList.add('v176-list-pulse');setTimeout(()=>leftCard.classList.remove('v176-list-pulse'),760);},0);}
    overlay.classList.add('v168-hot-switching');setTimeout(()=>overlay.classList.remove('v168-hot-switching'),180);
  }
  function hotSwitchRegion(id,opts={}){
    const s=ensure(),r=regionById(id);if(!r)return false;
    const enabled=(s.selected||[]).includes(id),wantsSelect=opts.select!==false;
    if(wantsSelect&&!enabled&&opts.forceEnable!==true){
      if(opts.feedback!==false)toast('该区域已关闭，请先打开区域开关','bad');
      return false;
    }
    if(opts.forceEnable===true&&!enabled)s.selected=[...(s.selected||[]),id];
    const changed=String(s.activeId)!==String(id);
    if(changed&&s.regionTextEditing&&String(s.regionTextEditing)!==String(id))commitActiveRegionTextDraft({id:s.regionTextEditing,history:true,render:false,toast:false});
    s.activeId=id;
    if(opts.full)renderOcr();else refreshHotSwitchPanels(id,opts);return true;
  }
  window.__V168_HOT_SWITCH_REGION=hotSwitchRegion;
  function locateSelectedRegion(id){
    const s=ensure(),overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return false;
    s.focusMode=false;
    const escaped=CSS.escape(String(id));
    const locate=()=>{
      const current=document.getElementById('v15-ocr-overlay');if(!current)return;
      const stage=current.querySelector('.v15-ocr-stage');
      const boxes=[...current.querySelectorAll(`[data-v155-target-box="${escaped}"],[data-v154-region-box="${escaped}"]`)];
      if(!boxes.length)return;
      boxes.forEach(box=>{box.classList.remove('v175-locate-pulse');void box.offsetWidth;box.classList.add('v175-locate-pulse');setTimeout(()=>box.classList.remove('v175-locate-pulse'),820);});
      const box=boxes[0];if(!stage)return;
      try{const sr=stage.getBoundingClientRect(),br=box.getBoundingClientRect(),dx=br.left-sr.left-(sr.width-br.width)/2,dy=br.top-sr.top-(sr.height-br.height)/2;if(typeof stage.scrollBy==='function')stage.scrollBy({left:dx,top:dy,behavior:'smooth'});else{stage.scrollLeft+=dx;stage.scrollTop+=dy;}}catch(_e){}
    };
    requestAnimationFrame(locate);setTimeout(locate,60);setTimeout(locate,180);
    return true;
  }
  function selectAndLocateRegion(id){
    const s=ensure(),r=regionById(id);if(!r)return false;
    s.focusMode=false;
    const enabled=(s.selected||[]).includes(id);
    if(!enabled){
      hotSwitchRegion(id,{select:false,scroll:false,keepView:true,feedback:false});
      locateSelectedRegion(id);
      const label=regionName(r);
      toast(`${label} 已关闭，请使用开关重新开启`,'bad');
      return false;
    }
    hotSwitchRegion(id,{select:true,forceEnable:false,scroll:false,keepView:true});
    const overlay=document.getElementById('v15-ocr-overlay');
    if(overlay){
      overlay.querySelectorAll('[data-v155-select-check],[data-v15-region-check]').forEach(input=>{
        const rid=input.dataset.v155SelectCheck||input.dataset.v15RegionCheck;
        if(String(rid)===String(id))input.checked=true;
      });
    }
    locateSelectedRegion(id);
    const label=regionName(r);
    toast(`已选中 ${label}`,'ok');
    return true;
  }
  window.__V175_SELECT_AND_LOCATE_REGION=selectAndLocateRegion;
  window.__V176_SELECT_AND_LOCATE_REGION=selectAndLocateRegion;
  function syncCorrectedRegions(){
    const s=ensure();if(!s.result)return;s.result.regions=(s.result.regions||[]).map((r,i)=>normalizeRegion(r,i));
    s.result.raw=s.result.raw||{};s.result.raw.regions=s.result.regions;s.result.raw.manualCorrection={version:'V18',count:Number(s.manualCorrectionCount||0),updatedAt:new Date().toISOString()};
  }
  function toggleCorrection(){const s=ensure();if(!s.result)return;s.correctionMode=!s.correctionMode;s.correctionAddMode=false;s.selectionMode=false;if(s.correctionMode&&!s.activeId)s.activeId=s.result.regions?.[0]?.id||'';renderOcr();if(s.correctionMode)toast('人工校正已开启：拖动框体移动，拖动四角调整范围','ok');}
  function confirmLocalSelection(){
    const s=ensure();
    if(!s.crop||s.crop.width<.015||s.crop.height<.015){toast('请先框选有效的局部识别范围','bad');return;}
    s.cropConfirmed=true;s.selectionMode=false;s.localMenuOpen=true;
    renderOcr();toast('选区已确定，可执行“重新识别选区”','ok');
  }
  function confirmCorrectionRegion(){
    const s=ensure();if(!s.result||!s.correctionMode){toast('请先开启人工校正并选择区域','bad');return;}
    const r=regionById(s.activeId);if(!r){toast('当前没有可确认的人工校正区域','bad');return;}
    pushRegionHistory('确定人工校正前');
    r.manualCorrected=true;r.userCorrected=true;r.updated_at=new Date().toISOString();
    r.sourceBBox={x:Number(r.x)||0,y:Number(r.y)||0,width:Number(r.width)||.1,height:Number(r.height)||.1};
    s.manualCorrectionCount=Number(s.manualCorrectionCount||0)+1;s.correctionAddMode=false;s.correctionMode=false;s.moreToolsOpen=false;s.deleteMode=false;
    syncCorrectedRegions();pushRegionHistory('确定人工校正区域');renderOcr();
    toast(`已确定“${regionName(r)}”的人工校正范围`,'ok');
  }
  function toggleAddRegion(){const s=ensure();if(!s.correctionMode||!s.result)return;s.correctionAddMode=!s.correctionAddMode;s.selectionMode=false;renderOcr();if(s.correctionAddMode)toast('请在图片空白位置拖出新的识别区域');}
  function deleteRegion(id){const s=ensure();if(!id||!s.result)return;pushRegionHistory('删除区域前');const rows=s.result.regions||[],idx=rows.findIndex(r=>r.id===id);if(idx<0)return;rows.splice(idx,1);s.selected=(s.selected||[]).filter(x=>x!==id);s.activeId=rows[Math.min(idx,rows.length-1)]?.id||'';s.manualCorrectionCount=Number(s.manualCorrectionCount||0)+1;syncCorrectedRegions();pushRegionHistory('删除区域');renderOcr();toast('识别区域已删除，可在“历史”中撤回','ok');}
  const V193_PRESERVE_PRESETS={
    auto:null,
    text:['text_content','font_style','layout','color'],
    product:['shape','packaging_text','material','color','aspect_ratio'],
    face:['identity','face','hair_or_fur','body_integrity'],
    background:['main_subjects','text','composition'],
    decoration:['style','direction','transparency']
  };
  function v193AutoRegionName(s,type,meta){
    const base=type==='person'?'人物/宠物区域':meta.label;
    const count=(s.result?.regions||[]).filter(r=>r.type===type&&r.manualCreated).length+1;
    return `${base} ${String(count).padStart(2,'0')}`;
  }
  function v193PreserveFor(s,type){
    const key=String(s.v193AddRegionPreserveKey||'auto');
    if(key!=='auto'&&Array.isArray(V193_PRESERVE_PRESETS[key]))return [...V193_PRESERVE_PRESETS[key]];
    const autoKey=type==='text'?'text':type==='product'?'product':type==='person'?'face':type==='background'?'background':'decoration';
    return [...(V193_PRESERVE_PRESETS[autoKey]||[])];
  }
  window.__V193_PRESERVE_FOR__=v193PreserveFor;
  function addManualRegion(box){
    const s=ensure();if(!s.result)return;
    const draft=s.v194RegionDraft&&typeof s.v194RegionDraft==='object'?s.v194RegionDraft:{};
    const requestedType=TYPE_META[draft.type]?draft.type:(TYPE_META[s.v192AddRegionType]?s.v192AddRegionType:s.correctionAddType),type=TYPE_META[requestedType]?requestedType:'text',meta=TYPE_META[type],id='manual_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const customName=String(draft.name||s.v192AddRegionName||'').trim(),label=customName||v193AutoRegionName(s,type,meta),mode=['direct_transform','move_and_repair','local_regenerate'].includes(draft.mode)?draft.mode:((['direct_transform','move_and_repair','local_regenerate'].includes(s.v193AddRegionMode)?s.v193AddRegionMode:'direct_transform')),preserve=Array.isArray(draft.preserve)?[...draft.preserve]:v193PreserveFor(s,type);
    try{window.__V163_REGION_HISTORY_PUSH&&window.__V163_REGION_HISTORY_PUSH('自由添加区域前',true);}catch(_e){}
    const freeInstruction=`仅编辑自由添加区域“${label}”（${meta.label}），按当前区域框和“${mode==='move_and_repair'?'移动主体并修复原位置':mode==='local_regenerate'?'重新生成当前区域':'只调整位置与大小'}”执行；其他未选区域保持不变。`;
    const r=normalizeRegion({id,type,label,name:label,region_id:'custom_'+String((s.result.regions||[]).filter(x=>String(x.source||'').includes('manual')).length+1).padStart(2,'0'),x:box.x,y:box.y,width:box.width,height:box.height,confidence:1,source:'manual-free-region',manualCreated:true,manualCorrected:false,execution_mode:mode,preserve,suggestedInstruction:freeInstruction,aiUserInstruction:freeInstruction,__v173ManualRequirement:freeInstruction,__v278CreationInstruction:freeInstruction,__v278ManualRegion:true},(s.result.regions||[]).length);
    s.result.regions.push(r);s.selected=[...new Set([...(s.selected||[]),id])];s.activeId=id;s.correctionAddMode=false;s.v199CreationStep='info';window.__V2051_DISARM_DRAWING__?.();s.correctionMode=false;s.v192AddRegionOpen=false;s.v192AddRegionName='';s.v194PendingRegionBox=null;s.v194RegionPreflightOpen=false;s.v194RegionDraft=null;s.v196TemplateManagerOpen=false;s.manualCorrectionCount=Number(s.manualCorrectionCount||0)+1;syncCorrectedRegions();
    let creationAudit=null;try{creationAudit=window.__V179_AUDIT__&&window.__V179_AUDIT__('自由添加区域',r,`${meta.label} · ${(box.width*100).toFixed(1)}% × ${(box.height*100).toFixed(1)}% · ${mode}`);window.__V163_REGION_HISTORY_PUSH&&window.__V163_REGION_HISTORY_PUSH('自由添加区域',true);}catch(_e){}
    renderOcr();
    /* V20：创建完成后自动收起表单，并在列表和画布中定位新区域。 */
    setTimeout(()=>{try{hotSwitchRegion(id,{select:true,full:false,scroll:true,keepView:true,feedback:false});locateSelectedRegion(id);window.__V183_LOCATE_REGION_CARD__?.(id);}catch(_e){}},80);
    const feedback=window.__V184_MENU_ACTION_FEEDBACK__?.(`已创建 ${label}`,creationAudit&&creationAudit.id);
    requestAnimationFrame(()=>{const btn=document.querySelector('.v184-action-feedback [data-v184-toast-undo]');if(btn)btn.textContent='撤回创建';});
    if(!feedback)toast(`已添加“${label}”，表单已收起并定位到新区域`,'ok');
  }
  window.__V194_ADD_MANUAL_REGION__=box=>addManualRegion(box);
  function setActive(id){hotSwitchRegion(id,{select:false,full:false,scroll:true,keepView:true});}
  async function applyToMain(){
    if(typeof window.__V177_PRE_APPLY_CONFLICT_CHECK__==='function'&&!window.__V177_PRE_APPLY_CONFLICT_CHECK__())return;
    try{commitActiveDocumentBlockDraft({history:true,render:false,toast:false});}catch(_e){}
    try{commitActiveRegionTextDraft({history:true,render:false,toast:false});}catch(_e){}
    try{window.__V271_COMMIT_ACTIVE_AI_PROMPT__?.();}catch(_e){}
    const s=ensure(),sel=selectedSet(),rows=(s.result?.regions||[]).filter(r=>sel.has(r.id));if(!rows.length){toast('请至少选择一个识别区域','bad');return;}
    const mainSrc=adjustState.originalSrc||adjustState.src||'',different=!!(s.src&&s.src!==mainSrc);
    if(different){if(!window.confirm('识别页使用了独立更换的图片。应用区域时将把该图片设为当前图片微调主图，是否继续？'))return;adjustState.src=s.src;adjustState.originalSrc=s.src;adjustState.name=s.name||'ocr-image.png';adjustState.originalName=adjustState.name;adjustState.img=await adjustLoadImageObject(s.src);adjustResetRuntime();}
    if(!adjustState.img){toast('图片微调主图尚未载入，请先返回并上传主图','bad');return;}
    adjustState.strokes=[];adjustState.brushes=adjustDefaultBrushes();adjustState.detectedRegions=[];adjustState.selectedDetectedRegionIds=[];adjustState.regionAiTasks=[];adjustState.regionPromptVersion='V27.9';const promptsByBrush={};
    rows.forEach((r,i)=>{
      const meta=TYPE_META[r.type]||TYPE_META.decoration,brush=meta.brush,target=r.targetBBox||calcTarget(r),source=r.sourceBBox||{x:r.x,y:r.y,width:r.width,height:r.height};
      const effective=window.__V271_RESOLVE_REGION_PROMPT__?.(r)||r.suggestedInstruction||r.prompt_override||promptFor(r);
      const userInstruction=window.__V271_REGION_USER_INTENT__?.(r)||r.aiUserInstruction||'';
      const rr=Object.assign({},r,{id:'v271_apply_'+Date.now()+'_'+i,brushId:brush,x:target.x,y:target.y,width:target.width,height:target.height,suggestedInstruction:effective});
      adjustAddDetectedBox(brush,rr,rr.id);adjustState.detectedRegions.push(rr);
      adjustState.regionAiTasks.push({
        regionId:r.region_id||r.id,name:r.name||r.label||meta.label,type:r.type,brushId:brush,executionMode:r.execution_mode||'direct_transform',
        userInstruction,instruction:effective,suggestedInstruction:String(r.suggestedInstruction||''),fullPromptOverride:String(r.__v271FullPromptOverride||''),
        origin:String(r.source||''),source:String(r.source||''),manualCreated:!!r.manualCreated,textEdited:!!r.regionTextEdited,
        sourceBBox:{x:Number(source.x)||0,y:Number(source.y)||0,width:Number(source.width)||0,height:Number(source.height)||0},
        targetBBox:{x:Number(target.x)||0,y:Number(target.y)||0,width:Number(target.width)||0,height:Number(target.height)||0},
        preserve:Array.isArray(r.preserve)?r.preserve.slice():[],repair:Object.assign({},r.repair||{}),lockAspectRatio:!!r.lock_aspect_ratio
      });
      (promptsByBrush[brush]||(promptsByBrush[brush]=[])).push(`【${r.name||r.label||meta.label}】${effective}`);
    });
    Object.keys(promptsByBrush).forEach(brush=>{adjustState.brushes[brush].prompt=promptsByBrush[brush].join('\n\n');});
    adjustState.activeBrush=(TYPE_META[rows[0].type]||TYPE_META.decoration).brush;adjustState.aiScope=rows.length>1?'all':'active';adjustState.guideStep=2;adjustState.aiStatus=`V27.9 已同步 ${rows.length} 个区域及 AI 修改指令，可直接进行局部生成。`;adjustState.aiStatusType='done';if(typeof adjustRecommendParameters==='function')adjustRecommendParameters();adjustState.paramRecommendation=`V27.9：AI 修改指令已作为最高优先级同步；移动/缩放会同时开放原位置与目标位置编辑包络。${adjustState.paramRecommendation||''}`;if(typeof adjustPushHistory==='function')adjustPushHistory('V27.9 AI 指令与区域应用');
    const v207Stay=window.__V207_REGION_ROUTE__===true;
    renderAdjustView();
    if(v207Stay){s.open=true;s.message=`已确认 ${rows.length} 个区域，AI 修改指令已直接同步到微调生图`;renderOcr();toast(`已同步 ${rows.length} 个区域与 AI 修改指令，可继续生成`,'ok');}
    else{s.open=false;renderOcr();}
    setActionStatus('success',`已同步 ${rows.length} 个区域及 AI 修改指令并进入微调生成`,false);
  }

  function copyText(text){const value=String(text||'');if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(value);const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return Promise.resolve();}
  function documentBlockById(id){return blockRows(ensure()).find(b=>String(b.id)===String(id));}
  function activateDocumentBlock(id){const s=ensure(),b=documentBlockById(id);if(!b)return;const r=nearestRegion(b);if(r)hotSwitchRegion(r.id,{select:false,full:false,scroll:true,keepView:true});else renderOcr();}
  function downloadJson(){const s=ensure();if(!s.result)return;const blob=new Blob([JSON.stringify(s.result.raw||s.result,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(s.name||'paddleocr-result').replace(/\.[^.]+$/,'')+'-PaddleOCR-V18.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);}
  function commitActiveDocumentBlockDraft(options={}){
    const s=ensure(),id=String(options.id||s.editingBlockId||''),b=documentBlockById(id);
    if(!id)return{committed:false,reason:'no-active-document-draft'};
    const input=document.querySelector(`[data-v153-edit-input="${CSS.escape(id)}"]`);
    if(!b||!input)return{committed:false,reason:!b?'document-block-missing':'document-draft-missing',id};
    if(options.history!==false)pushRegionHistory('修正文案前');
    const value=String(input.value==null?'':input.value).replace(/\r\n/g,'\n').trim();
    b.content=value;b.recognizedText=value;s.blockEdits[id]=value;
    const r=nearestRegion(b);if(r)applyRegionTextChange(r,value);
    s.editingBlockId='';s.result.raw=s.result.raw||{};s.result.raw.documentBlocks=s.result.documentBlocks;syncCorrectedRegions();
    if(options.history!==false)pushRegionHistory('修正文案');
    if(options.render!==false)renderOcr();
    if(options.toast!==false)toast(r?'纠正文案已保存，并同步到 AI 修改指令':'纠正内容已保存到当前识别结果','ok');
    return{committed:true,id,value,regionId:r&&r.id||''};
  }
  function saveBlockEdit(id){return commitActiveDocumentBlockDraft({id,history:true,render:true,toast:true});}
  window.__V279_COMMIT_ACTIVE_DOCUMENT_TEXT__=window.__V278_COMMIT_ACTIVE_DOCUMENT_TEXT__=options=>commitActiveDocumentBlockDraft(options||{});

  function eventAction(e){
    const target=e.target;
    const open=target.closest?.('[data-v15-ocr-open]');if(open){e.preventDefault();e.stopPropagation();openOcr();return true;}
    if(!ensure().open)return false;
    const action=(sel,fn)=>{if(!target.closest?.(sel))return false;e.preventDefault();e.stopImmediatePropagation();fn();return true;};
    if(action('[data-v168-run-main]',()=>runRecognition('full',ensure().fullRecognitionMode)))return true;
    if(action('[data-v168-run-menu]',()=>{const s=ensure();s.recognitionMenuOpen=!s.recognitionMenuOpen;renderOcr();}))return true;
    const runMode=target.closest?.('[data-v168-run-mode]');if(runMode){e.preventDefault();e.stopImmediatePropagation();const s=ensure();s.fullRecognitionMode=runMode.dataset.v168RunMode;s.recognitionMenuOpen=false;runRecognition('full',s.fullRecognitionMode);return true;}
    if(action('[data-v168-legend-toggle]',()=>{const s=ensure();s.legendExpanded=!s.legendExpanded;renderOcr();}))return true;
    if(action('[data-v168-diff-toggle]',()=>{const s=ensure();s.diffOpen=!s.diffOpen;if(!s.diffOpen)s.diffDetailsOpen=false;renderOcr();}))return true;
    if(action('[data-v168-diff-details]',()=>{const s=ensure();s.diffDetailsOpen=!s.diffDetailsOpen;renderOcr();}))return true;
    if(action('[data-v168-more-tools]',()=>{const s=ensure();s.moreToolsOpen=!s.moreToolsOpen;renderOcr();}))return true;
    if(action('[data-v191-confirm-local]',()=>confirmLocalSelection()))return true;
    if(action('[data-v152-run-local]',()=>runRecognition('local')))return true;
    if(action('[data-v154-progress-toggle]',()=>{const s=ensure();s.progressExpanded=!s.progressExpanded;renderOcr();}))return true;
    if(action('[data-v154-local-toggle]',()=>{const s=ensure();s.localMenuOpen=!s.localMenuOpen;renderOcr();}))return true;
    if(action('[data-v154-add-region]',()=>toggleAddRegion()))return true;
    if(action('[data-v154-delete-active]',()=>deleteRegion(ensure().activeId)))return true;
    if(action('[data-v152-select-local]',()=>{const s=ensure();s.selectionMode=!s.selectionMode;if(s.selectionMode){s.cropConfirmed=false;toast('请在中间图片上按住鼠标拖出局部识别范围');}renderOcr();}))return true;
    if(action('[data-v152-clear-local]',()=>{const s=ensure();s.crop=null;s.cropConfirmed=false;s.selectionMode=false;renderOcr();}))return true;
    if(action('[data-v15-ocr-close]',()=>closeOcr()))return true;
    if(action('[data-v15-file-open]',()=>document.getElementById('v15-ocr-file')?.click()))return true;
    if(action('[data-v15-sync-main]',()=>{if(syncMain(true)){renderOcr();toast('已同步图片微调主图','ok');}else toast('图片微调尚未上传主图','bad');}))return true;
    if(action('[data-v15-apply]',()=>applyToMain().catch(err=>toast('应用失败：'+err.message,'bad'))))return true;
    if(action('[data-v15-token-check]',()=>checkToken(true)))return true;
    if(action('[data-v15-token-toggle]',()=>{ensure().showToken=!ensure().showToken;renderOcr();}))return true;
    if(action('[data-v15-token-session]',()=>{const input=document.querySelector('[data-v15-token-input]');saveToken(input?.value.trim(),false).catch(err=>toast(err.message,'bad'));}))return true;
    if(action('[data-v15-token-save]',()=>{const input=document.querySelector('[data-v15-token-input]');saveToken(input?.value.trim(),true).catch(err=>toast(err.message,'bad'));}))return true;
    if(action('[data-v15-token-clear]',()=>clearToken().catch(err=>toast(err.message,'bad'))))return true;
    if(action('[data-v164-focus-toggle]',()=>{const s=ensure();s.focusMode=!s.focusMode;renderOcr();}))return true;
    if(action('[data-v163-zoom-minus]',()=>setBigZoom((ensure().bigZoom||1)-.1)))return true;
    if(action('[data-v163-zoom-plus]',()=>setBigZoom((ensure().bigZoom||1)+.1)))return true;
    if(action('[data-v163-zoom-fit]',()=>setBigZoom(1)))return true;
    const regionText=target.closest?.('[data-v163-region-text]');if(regionText){e.preventDefault();e.stopImmediatePropagation();const s=ensure(),id=regionText.dataset.v163RegionText,r=regionById(id),value=String(r?.recognizedText??r?.content??r?.label??'');s.activeId=id;s.regionTextEditing=id;s.regionTextDraft=value;s.regionTextDrafts[id]=value;renderOcr();focusRegionTextEditor(id);return true;}
    const saveRegionText=target.closest?.('[data-v163-region-text-save]');if(saveRegionText){e.preventDefault();e.stopImmediatePropagation();const id=saveRegionText.dataset.v163RegionTextSave,input=document.querySelector(`[data-v163-region-text-input="${CSS.escape(id)}"]`);updateRegionText(id,input?input.value:(ensure().regionTextDrafts[id]??''));return true;}
    const cancelRegionText=target.closest?.('[data-v163-region-text-cancel]');if(cancelRegionText){e.preventDefault();e.stopImmediatePropagation();const s=ensure(),id=cancelRegionText.dataset.v163RegionTextCancel||s.regionTextEditing;s.regionTextEditing='';s.regionTextDraft='';s.regionTextFocusedId='';s.regionTextComposing=false;s.regionTextRenderPending=false;regionTextFocusIntent=false;delete s.regionTextDrafts[id];renderOcr();return true;}
    if(action('[data-v163-toggle-all-regions]',()=>{const s=ensure();s.showAllRegions=!s.showAllRegions;renderOcr();}))return true;
    if(action('[data-v153-copy-all]',()=>copyText(blockRows(ensure()).map(b=>b.content||b.recognizedText||'').filter(Boolean).join('\n\n')).then(()=>toast('已复制全部解析内容','ok'))))return true;
    if(action('[data-v153-download-json]',()=>downloadJson()))return true;
    const deleteCard=target.closest?.('[data-v154-delete-region]');if(deleteCard){e.preventDefault();e.stopImmediatePropagation();deleteRegion(deleteCard.dataset.v154DeleteRegion);return true;}
    const copyBlock=target.closest?.('[data-v153-copy-block]');if(copyBlock){e.preventDefault();e.stopImmediatePropagation();const b=documentBlockById(copyBlock.dataset.v153CopyBlock);copyText(b?.content||b?.recognizedText||'').then(()=>toast('已复制当前识别块','ok'));return true;}
    const editBlock=target.closest?.('[data-v153-edit-block]');if(editBlock){e.preventDefault();e.stopImmediatePropagation();const s=ensure(),id=editBlock.dataset.v153EditBlock;s.editingBlockId=s.editingBlockId===id?'':id;renderOcr();return true;}
    const saveBlock=target.closest?.('[data-v153-save-block]');if(saveBlock){e.preventDefault();e.stopImmediatePropagation();saveBlockEdit(saveBlock.dataset.v153SaveBlock);return true;}
    const docCard=target.closest?.('[data-v153-doc-active]');if(docCard&&!target.closest('button,textarea,select')){e.preventDefault();const s=ensure(),id=docCard.dataset.v153DocActive;activateDocumentBlock(id);if(target.closest('.v153-doc-content')){s.editingBlockId=id;renderOcr();}return true;}
    const tab=target.closest?.('[data-v15-tab]');if(tab){e.preventDefault();ensure().tab=tab.dataset.v15Tab==='json'?'json':'combined';renderOcr();return true;}
    const closedExpand=target.closest?.('[data-v177-closed-expand]');if(closedExpand){e.preventDefault();e.stopImmediatePropagation();const s=ensure(),id=closedExpand.dataset.v177ClosedExpand;s.v177ClosedExpanded=s.v177ClosedExpanded||{};s.v177ClosedExpanded[id]=!s.v177ClosedExpanded[id];renderOcr();return true;}
    /* V27.9：textarea 必须被视为独立交互控件。旧判断遗漏 textarea，导致每次
       点击文案输入框都会触发区域卡片切换并重建 DOM，从而立即失焦、无法输入。 */
    const card=target.closest?.('[data-v15-region-active]');if(card&&!target.closest?.('input,textarea,select,option,button,a,label,[contenteditable="true"]')){e.preventDefault();setActive(card.dataset.v15RegionActive);return true;}
    return false;
  }
  document.addEventListener('click',eventAction,true);
  document.addEventListener('change',e=>{
    if(e.target.id==='v15-ocr-file'){const f=e.target.files&&e.target.files[0];e.target.value='';replaceImageFile(f,'manual').catch(err=>toast(err.message,'bad'));return;}
    if(!ensure().open)return;
    const chk=e.target.closest('[data-v15-region-check]');if(chk){const s=ensure(),id=chk.dataset.v15RegionCheck,set=selectedSet(),r=regionById(id);if(chk.checked){set.add(id);if(r){r.close_reason='';r.close_reason_updated_at=new Date().toISOString();}}else{set.delete(id);if(r&&!r.close_reason)r.close_reason='defer';}s.selected=[...set];s.v177ClosedExpanded=s.v177ClosedExpanded||{};if(!chk.checked)s.v177ClosedExpanded[id]=false;if(chk.checked&&typeof window.__V175_SELECT_AND_LOCATE_REGION==='function'){window.__V175_SELECT_AND_LOCATE_REGION(id);refreshHotSwitchPanels(id,{scroll:false});}else{renderOcr();setTimeout(()=>window.__V178_ASK_CLOSE_REASON__&&window.__V178_ASK_CLOSE_REASON__(id),0);}return;}
    const typ=e.target.closest('[data-v15-region-type]');if(typ){const r=regionById(typ.dataset.v15RegionType);if(r&&TYPE_META[typ.value]){r.type=typ.value;syncCorrectedRegions();}renderOcr();return;}
    const addType=e.target.closest('[data-v154-add-type]');if(addType){ensure().correctionAddType=addType.value;return;}
    const docFilter=e.target.closest('[data-v153-doc-filter]');if(docFilter){ensure().documentFilter=docFilter.value;renderOcr();return;}
    const zoom=e.target.closest('[data-v163-zoom-range]');if(zoom){setBigZoom(Number(zoom.value)/100,true);const label=document.querySelector('[data-v163-zoom-fit]');if(label)label.textContent=Math.round(ensure().bigZoom*100)+'%';return;}
    const mode=e.target.closest('[data-v15-mode]');if(mode){const s=ensure();s.mode=mode.value;adjustState.ocrRecognitionMode=mode.value;localStorage.setItem(STORAGE_MODE,mode.value);renderOcr();}
  },true);
  document.addEventListener('pointerdown',e=>{
    const s=ensure();if(!s.open)return;const txt=e.target?.closest?.('[data-v163-region-text-input]');
    regionTextFocusIntent=!!txt;if(txt)s.regionTextFocusedId=String(txt.dataset.v163RegionTextInput||'');
  },true);
  document.addEventListener('focusin',e=>{const txt=e.target?.closest?.('[data-v163-region-text-input]');if(!txt)return;const s=ensure();regionTextFocusIntent=true;s.regionTextFocusedId=String(txt.dataset.v163RegionTextInput||'');},true);
  document.addEventListener('focusout',e=>{const txt=e.target?.closest?.('[data-v163-region-text-input]');if(!txt)return;queueMicrotask(()=>{const active=document.activeElement?.closest?.('[data-v163-region-text-input]');if(!active){regionTextFocusIntent=false;const s=ensure();if(!s.regionTextComposing)s.regionTextFocusedId='';}});},true);
  document.addEventListener('compositionstart',e=>{const txt=e.target?.closest?.('[data-v163-region-text-input]');if(!txt)return;const s=ensure();regionTextFocusIntent=true;s.regionTextFocusedId=String(txt.dataset.v163RegionTextInput||'');s.regionTextComposing=true;},true);
  document.addEventListener('compositionend',e=>{const txt=e.target?.closest?.('[data-v163-region-text-input]');if(!txt)return;const s=ensure(),id=String(txt.dataset.v163RegionTextInput||'');s.regionTextDraft=txt.value;s.regionTextDrafts[id]=txt.value;s.regionTextComposing=false;const pending=s.regionTextRenderPending;s.regionTextRenderPending=false;if(pending)queueMicrotask(()=>renderOcr({force:true}));},true);
  document.addEventListener('input',e=>{
    const s=ensure();if(!s.open)return;
    const z=e.target.closest('[data-v163-zoom-range]');if(z){setBigZoom(Number(z.value)/100,true);const label=document.querySelector('[data-v163-zoom-fit]');if(label)label.textContent=Math.round(s.bigZoom*100)+'%';return;}
    const txt=e.target.closest('[data-v163-region-text-input]');if(txt){const id=txt.dataset.v163RegionTextInput;s.regionTextDraft=txt.value;s.regionTextDrafts[id]=txt.value;}
  },true);
  document.addEventListener('keydown',e=>{const input=e.target?.closest?.('[data-v163-region-text-input]');if(!input)return;const id=input.dataset.v163RegionTextInput;if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();e.stopImmediatePropagation();updateRegionText(id,input.value);return;}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();const s=ensure();s.regionTextEditing='';s.regionTextDraft='';s.regionTextFocusedId='';s.regionTextComposing=false;s.regionTextRenderPending=false;regionTextFocusIntent=false;delete s.regionTextDrafts[id];renderOcr();}},true);
  function imagePoint(ev,rect){return{x:Math.max(0,Math.min(1,(ev.clientX-rect.left)/rect.width)),y:Math.max(0,Math.min(1,(ev.clientY-rect.top)/rect.height))};}
  function setActiveDom(id){document.querySelectorAll('.v15-region-box.active').forEach(x=>x.classList.remove('active'));document.querySelector(`[data-v154-region-box="${CSS.escape(id)}"]`)?.classList.add('active');}
  function renderRegionLive(id,r){const el=document.querySelector(`[data-v154-region-box="${CSS.escape(id)}"]`);if(!el)return;Object.assign(el.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.width*100+'%',height:r.height*100+'%'});}
  function renderCropLive(){const c=ensure().crop,el=document.querySelector('.v152-local-selection');if(!c||!el)return;el.hidden=false;Object.assign(el.style,{left:c.x*100+'%',top:c.y*100+'%',width:c.width*100+'%',height:c.height*100+'%'});}
  function renderAddLive(box){const el=document.querySelector('.v154-add-selection');if(!el)return;el.hidden=false;Object.assign(el.style,{left:box.x*100+'%',top:box.y*100+'%',width:box.width*100+'%',height:box.height*100+'%'});}
  document.addEventListener('pointerdown',e=>{
    const s=ensure(),shell=e.target.closest?.('[data-v152-image-shell]');if(!s.open||!shell)return;
    const img=shell.querySelector('img'),rect=img.getBoundingClientRect();if(!rect.width||!rect.height)return;
    const boxEl=e.target.closest?.('[data-v154-region-box]'),handle=e.target.closest?.('[data-v154-region-handle]');
    /* V20：自由框选优先级最高，并允许从已有识别框上方开始拖动。 */
    if(s.correctionAddMode){e.preventDefault();e.stopImmediatePropagation();const p=imagePoint(e,rect);addRegionDrag={pointerId:e.pointerId,shell,rect,start:p,box:{x:p.x,y:p.y,width:.001,height:.001}};try{shell.setPointerCapture?.(e.pointerId);}catch(_e){}renderAddLive(addRegionDrag.box);return;}
    if(s.correctionMode&&boxEl){const id=boxEl.dataset.v154RegionBox,r=regionById(id);if(!r)return;e.preventDefault();e.stopImmediatePropagation();if(!selectedSet().has(id)){toast('该区域已关闭，不能进入人工校正模式','bad');return;}if(typeof window.__V168_HOT_SWITCH_REGION==='function')window.__V168_HOT_SWITCH_REGION(id,{select:true,scroll:false,keepView:true});else s.activeId=id;setActiveDom(id);const p=imagePoint(e,rect);regionDrag={pointerId:e.pointerId,shell,rect,start:p,id,handle:handle?.dataset.v154RegionHandle||'move',orig:{x:r.x,y:r.y,width:r.width,height:r.height},moved:false};try{shell.setPointerCapture?.(e.pointerId);}catch(_e){}return;}
    if(!s.selectionMode||boxEl)return;e.preventDefault();e.stopPropagation();const p=imagePoint(e,rect);cropDrag={pointerId:e.pointerId,shell,img,rect,start:p};s.cropConfirmed=false;s.crop={x:p.x,y:p.y,width:.001,height:.001};try{shell.setPointerCapture?.(e.pointerId);}catch(_e){}renderCropLive();
  },true);
  document.addEventListener('pointermove',e=>{
    if(regionDrag&&e.pointerId===regionDrag.pointerId){e.preventDefault();const r=regionById(regionDrag.id);if(!r)return;const p=imagePoint(e,regionDrag.rect),dx=p.x-regionDrag.start.x,dy=p.y-regionDrag.start.y,o=regionDrag.orig,min=.01;let left=o.x,top=o.y,right=o.x+o.width,bottom=o.y+o.height;
      if(regionDrag.handle==='move'){left=Math.max(0,Math.min(1-o.width,o.x+dx));top=Math.max(0,Math.min(1-o.height,o.y+dy));right=left+o.width;bottom=top+o.height;}
      else{if(regionDrag.handle.includes('w'))left=Math.max(0,Math.min(right-min,o.x+dx));if(regionDrag.handle.includes('e'))right=Math.min(1,Math.max(left+min,o.x+o.width+dx));if(regionDrag.handle.includes('n'))top=Math.max(0,Math.min(bottom-min,o.y+dy));if(regionDrag.handle.includes('s'))bottom=Math.min(1,Math.max(top+min,o.y+o.height+dy));}
      Object.assign(r,{x:left,y:top,width:right-left,height:bottom-top});regionDrag.moved=true;renderRegionLive(regionDrag.id,r);return;}
    if(addRegionDrag&&e.pointerId===addRegionDrag.pointerId){e.preventDefault();const p=imagePoint(e,addRegionDrag.rect),a=addRegionDrag.start;addRegionDrag.box={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)};renderAddLive(addRegionDrag.box);return;}
    if(!cropDrag||e.pointerId!==cropDrag.pointerId)return;e.preventDefault();const p=imagePoint(e,cropDrag.rect),a=cropDrag.start;ensure().cropConfirmed=false;ensure().crop={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)};renderCropLive();
  },true);
  document.addEventListener('pointerup',e=>{
    if(regionDrag&&e.pointerId===regionDrag.pointerId){const d=regionDrag;regionDrag=null;if(d.moved){const s=ensure();s.manualCorrectionCount=Number(s.manualCorrectionCount||0)+1;syncCorrectedRegions();toast('识别框范围已校正','ok');renderOcr();}return;}
    if(addRegionDrag&&e.pointerId===addRegionDrag.pointerId){const d=addRegionDrag;addRegionDrag=null;if(d.box.width<.012||d.box.height<.012){toast('新增区域太小，请重新框选','bad');renderOcr();}else{const s=ensure();s.v194PendingRegionBox={x:d.box.x,y:d.box.y,width:d.box.width,height:d.box.height};s.correctionAddMode=false;s.v199CreationStep='confirm';s.v194RegionPreflightOpen=false;window.__V2051_DISARM_DRAWING__?.();renderOcr();toast('框选完成，请在“区域”功能栏确认后创建','ok');}return;}
    if(!cropDrag||e.pointerId!==cropDrag.pointerId)return;const s=ensure();cropDrag=null;if(!s.crop||s.crop.width<.015||s.crop.height<.015){s.crop=null;s.cropConfirmed=false;toast('局部识别范围太小，请重新框选','bad');}else{s.cropConfirmed=false;s.v193SelectionCoordsOpen=false;toast('局部范围已框选，请点击“确定选区”','ok');}s.selectionMode=false;renderOcr();
  },true);
  document.addEventListener('dragover',e=>{if(!ensure().open)return;const z=e.target.closest('[data-v15-dropzone]');if(z){e.preventDefault();ensure().drag=true;z.querySelector('.v15-ocr-drop')?.classList.add('drag');}},true);
  document.addEventListener('dragleave',e=>{if(!ensure().open)return;const z=e.target.closest('[data-v15-dropzone]');if(z){ensure().drag=false;z.querySelector('.v15-ocr-drop')?.classList.remove('drag');}},true);
  document.addEventListener('drop',e=>{if(!ensure().open)return;const z=e.target.closest('[data-v15-dropzone]');if(z){e.preventDefault();ensure().drag=false;const f=e.dataTransfer?.files?.[0];replaceImageFile(f,'manual').catch(err=>toast(err.message,'bad'));}},true);
  document.addEventListener('keydown',e=>{const s=ensure();if(!s.open||e.key!=='Escape')return;e.preventDefault();if(s.v194PendingRegionBox||s.v194RegionPreflightOpen){s.v194PendingRegionBox=null;s.v194RegionPreflightOpen=false;s.v194RegionDraft=null;s.correctionAddMode=false;s.v199CreationStep='info';window.__V2051_DISARM_DRAWING__?.();renderOcr();return;}if(s.correctionAddMode){s.correctionAddMode=false;s.v199CreationStep='info';window.__V2051_DISARM_DRAWING__?.();renderOcr();return;}if(s.localMenuOpen){s.localMenuOpen=false;renderOcr();return;}closeOcr();},true);

  window.__V164_RENDER_OCR=()=>renderOcr();
  window.__V164_DELETE_REGION=id=>deleteRegion(id||ensure().activeId);
  window.__V164_ACTIVE_REGION=()=>regionById(ensure().activeId);
  const baseWorkspace=adjustWorkspaceHtml;
  adjustWorkspaceHtml=function(){return baseWorkspace().replace(/V15\.\d+/g,'V18').replace(/V15(?!\.)/g,'V18').replace(/V14\.9/g,'V18').replace('新增独立 PaddleOCR-VL 视觉识别工作台：主图自动同步、可独立更换、区域框预览并回传 Mask。','新增识别区域直接编辑：区域选择、局部识别、自由添加区域与统一调整入口。');};
  if(typeof adjustOpenProjectSave==='function'){const baseOpenProjectSave=adjustOpenProjectSave;adjustOpenProjectSave=function(){baseOpenProjectSave();setTimeout(()=>{document.querySelectorAll('.modal h3,.modal-card h3').forEach(el=>{if(/保存 V15(?:\.\d+)? 微调项目/.test(el.textContent||''))el.textContent='保存 V18 微调项目';});},0);};}
  const basePayload=adjustProjectPayload;
  adjustProjectPayload=function(mode='full'){const p=basePayload(mode);p.schema='ai_image_adjustment_project_v18';p.version='V18';p.state=p.state||{};p.state.v15OcrMode=ensure().mode;p.state.v15SecondaryRecognitionWorkspace=true;p.state.v152RecognitionProgress=true;p.state.v152LocalRerecognition=true;p.state.v152SecureTokenFallback=true;p.state.v153PresignedResultDownload=true;p.state.v153DocumentReview=true;p.state.v154ManualRegionCorrection=false;p.state.v154CollapsedRecognitionProgress=true;p.state.v154LocalRecognitionMenu=true;return p;};
  if(typeof adjustInstructionPayload==='function'){const baseInstruction=adjustInstructionPayload;adjustInstructionPayload=function(ids){const p=baseInstruction(ids);p.version='V18';p.regionTemplateMode='paddleocr_integrated_full_frame_edit_v17';return p;};}
  if(typeof adjustExportProject==='function'){adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v18-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V18 轻量项目已保存':'V18 完整项目已保存',false);};}
  document.title=(window.__APP_TITLE__||'V28.1.1 · 图灵线框工作台');
  requestAnimationFrame(()=>{if(typeof curView!=='undefined'&&curView==='adjust')renderAdjustView();});
})();


/* --- Region data, parameters, instructions and history --- */
/* ===== V18：目标框优先小图 + 稳定详情 + 区域删除撤回 ===== */
(function(){
  'use strict';
  if(typeof adjustState==='undefined')return;

  const VERSION='V24';
  const META={
    text:{label:'文字区域',color:'#ef4444',brush:'red',defaultMode:'direct_transform'},
    product:{label:'产品区域',color:'#f59e0b',brush:'amber',defaultMode:'move_and_repair'},
    person:{label:'人物/宠物',color:'#22c55e',brush:'green',defaultMode:'move_and_repair'},
    background:{label:'背景区域',color:'#3b82f6',brush:'blue',defaultMode:'local_regenerate'},
    decoration:{label:'装饰区域',color:'#8b5cf6',brush:'purple',defaultMode:'direct_transform'},
    unclassified:{label:'未分类',color:'#94a3b8',brush:'purple',defaultMode:'local_regenerate'}
  };
  const ANCHORS={
    'top-left':[0,0],'top':[.5,0],'top-right':[1,0],
    'left':[0,.5],'center':[.5,.5],'right':[1,.5],
    'bottom-left':[0,1],'bottom':[.5,1],'bottom-right':[1,1]
  };
  const MODE_LABELS={direct_transform:'A 直接几何变换',move_and_repair:'B 移动 + 背景修复',local_regenerate:'C 局部重新生成'};
  const DEFAULT_PRESERVE={text:['text_content','font_style','layout','color'],product:['shape','packaging_text','material','color','aspect_ratio'],person:['identity','face','hair_or_fur','body_integrity'],background:['main_subjects','text','composition'],decoration:['style','direction','transparency'],unclassified:[]};
  const $=(q,r=document)=>r.querySelector(q), $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let enhancing=false,scheduled=false,targetDrag=null,miniDrag=null,correctionBefore=null,initializingHistory=false,transformInteracting=false,transformReleaseTimer=0;

  function state(){
    const s=adjustState.v15Ocr;
    if(!s||typeof s!=='object')return null;
    if(!s.v155||typeof s.v155!=='object')s.v155={view:'edit',previewReady:false,previewAt:'',validation:[],validationAt:'',history:[],historyIndex:-1,maskView:'overlay',guides:true,sourceGhost:true,activeTemplate:'',lastChange:'',lastSavedAt:''};
    const v=s.v155;
    if(!Array.isArray(v.history))v.history=[];
    if(typeof v.historyIndex!=='number')v.historyIndex=v.history.length-1;
    if(!Array.isArray(v.validation))v.validation=[];
    if(!v.v177ConflictCheck||typeof v.v177ConflictCheck!=='object')v.v177ConflictCheck={status:'idle',blocks:0,warnings:0,hints:0,checkedAt:'',issues:[]};
    if(typeof v.v178ConflictScope!=='string')v.v178ConflictScope='all';
    if(typeof v.v178ConflictShowHints!=='boolean')v.v178ConflictShowHints=false;
    if(typeof v.v159AdvancedOpen!=='boolean')v.v159AdvancedOpen=false;if(typeof v.v159ConstraintsOpen!=='boolean')v.v159ConstraintsOpen=false;if(typeof v.v159HistoryOpen!=='boolean')v.v159HistoryOpen=false;
    if(typeof v.v160HistoryOpen!=='boolean')v.v160HistoryOpen=false;
    if(!v.v161Snap||typeof v.v161Snap!=='object')v.v161Snap={enabled:true,threshold_px:9,canvas_center:true,thirds:true,regions:true,distance_labels:true};
    v.v161Snap=Object.assign({enabled:true,threshold_px:9,canvas_center:true,thirds:true,regions:true,distance_labels:true},v.v161Snap||{});
    v.v161RightTool='correction';
    v.v161ToolMenuOpen=false;
    const miniDefaults={showSource:true,zoom:1,panX:0,panY:0,sourceOpacity:.72,targetOpacity:.88};
    if(!v.v162Mini||typeof v.v162Mini!=='object')v.v162Mini=Object.assign({},miniDefaults);
    if(!v.v187MiniViews||typeof v.v187MiniViews!=='object'||Array.isArray(v.v187MiniViews))v.v187MiniViews={};
    const activeMiniKey=s.activeId==null?'':String(s.activeId);
    if(activeMiniKey&&!v.v187MiniMigrated){v.v187MiniViews[activeMiniKey]=Object.assign({},miniDefaults,v.v162Mini||{});v.v187MiniMigrated=true;}
    if(activeMiniKey&&!v.v187MiniViews[activeMiniKey])v.v187MiniViews[activeMiniKey]=Object.assign({},miniDefaults);
    if(activeMiniKey)v.v162Mini=v.v187MiniViews[activeMiniKey];
    v.v162Mini=Object.assign({},miniDefaults,v.v162Mini||{});
    if(activeMiniKey)v.v187MiniViews[activeMiniKey]=v.v162Mini;
    v.v162Mini.zoom=Math.max(1,Math.min(6,Number(v.v162Mini.zoom)||1));
    v.v162Mini.panX=Number(v.v162Mini.panX)||0;v.v162Mini.panY=Number(v.v162Mini.panY)||0;
    v.v162Mini.sourceOpacity=Math.max(.08,Math.min(1,Number(v.v162Mini.sourceOpacity)||.72));
    v.v162Mini.targetOpacity=Math.max(.12,Math.min(1,Number(v.v162Mini.targetOpacity)||.88));
    if(!v.v187PaneScroll||typeof v.v187PaneScroll!=='object')v.v187PaneScroll={main:0,mini:0};
    v.v187PaneScroll.main=Math.max(0,Number(v.v187PaneScroll.main)||0);v.v187PaneScroll.mini=Math.max(0,Number(v.v187PaneScroll.mini)||0);
    if(typeof v.v186HistoryShowAll!=='boolean')v.v186HistoryShowAll=false;
    if(typeof v.v186LayoutRatio!=='number'){let saved=58;try{saved=Number(localStorage.getItem('ai_v186_adjust_ratio'))||58;}catch(_e){}v.v186LayoutRatio=Math.max(28,Math.min(78,saved));}
    if(typeof v.v163SnapAdvanced!=='boolean')v.v163SnapAdvanced=false;
    if(typeof v.v169ProfessionalMode!=='boolean')v.v169ProfessionalMode=false;
    if(typeof v.v169PromptExpanded!=='boolean')v.v169PromptExpanded=false;
    if(typeof v.v169JsonExpanded!=='boolean')v.v169JsonExpanded=false;
    if(!Array.isArray(v.v179Audit))v.v179Audit=[];
    if(typeof v.v180AuditShowAll!=='boolean')v.v180AuditShowAll=false;
    if(!v.v180ClosedExpanded||typeof v.v180ClosedExpanded!=='object')v.v180ClosedExpanded={misrecognized:true,duplicate:true,defer:true,unmarked:true};
    if(typeof v.v180LastMiniResetAt!=='number')v.v180LastMiniResetAt=0;
    if(typeof s.v179MoreRegionId==='undefined')s.v179MoreRegionId='';
    if(typeof s.v192AddRegionOpen!=='boolean')s.v192AddRegionOpen=false;
    if(typeof s.v192AddRegionName!=='string')s.v192AddRegionName='';
    if(!META[s.v192AddRegionType])s.v192AddRegionType='text';
    if(typeof s.v193AddRegionTemplate!=='string')s.v193AddRegionTemplate='custom';
    if(!['direct_transform','move_and_repair','local_regenerate'].includes(s.v193AddRegionMode))s.v193AddRegionMode='direct_transform';
    if(typeof s.v193AddRegionPreserveKey!=='string')s.v193AddRegionPreserveKey='auto';
    if(typeof s.v193SelectionCoordsOpen!=='boolean')s.v193SelectionCoordsOpen=false;
    if(typeof s.v194RegionPreflightOpen!=='boolean')s.v194RegionPreflightOpen=false;
    if(s.v194PendingRegionBox&&typeof s.v194PendingRegionBox!=='object')s.v194PendingRegionBox=null;
    if(s.v194RegionDraft&&typeof s.v194RegionDraft!=='object')s.v194RegionDraft=null;
    s.correctionMode=false;
    return s;
  }
  function v22ResetRegionWorkspace(reason,opts={}){
    const s=adjustState.v15Ocr;if(!s||typeof s!=='object')return false;const old=s.v155&&typeof s.v155==='object'?s.v155:{};
    const keepSnap=old.v161Snap&&typeof old.v161Snap==='object'?Object.assign({},old.v161Snap):null,keepClosed=old.v180ClosedExpanded&&typeof old.v180ClosedExpanded==='object'?Object.assign({},old.v180ClosedExpanded):null;
    s.v155={view:old.view||'edit',previewReady:false,previewAt:'',validation:[],validationAt:'',history:[],historyIndex:-1,maskView:old.maskView||'overlay',guides:old.guides!==false,sourceGhost:old.sourceGhost!==false,activeTemplate:'',lastChange:'',lastSavedAt:'',v161Snap:keepSnap||{enabled:true,threshold_px:9,canvas_center:true,thirds:true,regions:true,distance_labels:true},v178ConflictScope:old.v178ConflictScope||'all',v178ConflictShowHints:!!old.v178ConflictShowHints,v177ConflictCheck:{status:'idle',blocks:0,warnings:0,hints:0,checkedAt:'',issues:[]},v162Mini:{showSource:true,zoom:1,panX:0,panY:0,sourceOpacity:.72,targetOpacity:.88},v187MiniViews:{},v187PaneScroll:{main:0,mini:0},v186LayoutRatio:Number(old.v186LayoutRatio)||58,v163SnapAdvanced:!!old.v163SnapAdvanced,v169ProfessionalMode:!!old.v169ProfessionalMode,v169PromptExpanded:false,v169JsonExpanded:false,v179Audit:[],v180AuditShowAll:false,v180ClosedExpanded:keepClosed||{misrecognized:true,duplicate:true,defer:true,unmarked:true},v22ImageKey:String(opts.imageKey||s.v22ImageKey||''),v22ResetReason:String(reason||'reset'),v22ResetAt:new Date().toISOString()};
    s.v179MoreRegionId='';s.v192AddRegionOpen=false;s.v192AddRegionName='';s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.v194RegionDraft=null;s.v199CreationStep='info';s.correctionMode=false;s.correctionAddMode=false;s.selectionMode=false;targetDrag=null;miniDrag=null;correctionBefore=null;transformInteracting=false;clearTimeout(transformReleaseTimer);scheduled=false;enhancing=false;window.__V2051_DISARM_DRAWING__?.();
    document.querySelectorAll('#v15-ocr-overlay .v155-transform-layer,#v15-ocr-overlay .v161-snap-overlay,#v15-ocr-overlay .v154-region-float').forEach(el=>el.remove());return true;
  }
  window.__V22_RESET_REGION_WORKSPACE__=v22ResetRegionWorkspace;
  function round(n,d=4){const p=10**d;return Math.round(Number(n||0)*p)/p;}
  function clone(o){return JSON.parse(JSON.stringify(o));}
  function sameBox(a,b){return a&&b&&Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6&&Math.abs(a.width-b.width)<1e-6&&Math.abs(a.height-b.height)<1e-6;}
  function baseBox(r){return{x:Number(r.x)||0,y:Number(r.y)||0,width:Number(r.width)||.1,height:Number(r.height)||.1};}
  function defaultTransform(r){return{move_x_canvas_pct:0,move_y_canvas_pct:0,scale_pct:100,width_pct:100,height_pct:100,rotation_deg:0,anchor:'center',free_aspect:true};}
  function cleanBox(b){const x=Number(b&&b.x)||0,y=Number(b&&b.y)||0,width=Math.max(.001,Number(b&&b.width)||.1),height=Math.max(.001,Number(b&&b.height)||.1);return{x:round(x,6),y:round(y,6),width:round(width,6),height:round(height,6)};}
  function initialBox(r){
    if(r&&r.initialBBox)return cleanBox(r.initialBBox);
    const s=state(),baseline=s&&s.v155&&Array.isArray(s.v155.history)&&s.v155.history.length?s.v155.history[0]:null;
    const first=baseline&&Array.isArray(baseline.regions)?baseline.regions.find(x=>String(x.id||x.region_id)===String(r&&r.id||r&&r.region_id)):null;
    const box=first&&(first.initialBBox||first.sourceBBox||baseBox(first))||r&&r.sourceBBox||baseBox(r||{});
    if(r)r.initialBBox=cleanBox(box);
    return cleanBox(box);
  }
  function defaultComposition(r){const b=(r&&r.sourceBBox)||baseBox(r||{});return{bottom_contact:{enabled:false,bottom_y:round(b.y+b.height)},center_line:{mode:'none'},spacing:{enabled:false,reference_id:'',direction:'right',gap_pct:5},alignment:{enabled:false,reference_id:'',mode:'center_x'}};}
  function normalizeComposition(r){const d=defaultComposition(r),c=r&&r.composition_constraints&&typeof r.composition_constraints==='object'?r.composition_constraints:{};r.composition_constraints={bottom_contact:Object.assign({},d.bottom_contact,c.bottom_contact||{}),center_line:Object.assign({},d.center_line,c.center_line||{}),spacing:Object.assign({},d.spacing,c.spacing||{}),alignment:Object.assign({},d.alignment,c.alignment||{})};return r.composition_constraints;}
  function regionName(r,i){return window.__V221_REGION_NAME__?.(r)||`${(META[r.type]||META.unclassified).label} ${i+1}`;}
  function initRegion(r,i){
    if(!META[r.type])r.type='unclassified';
    const s=state(),currentKey=String(s&&s.v22ImageKey||''),regionKey=String(r&&r.v22ImageKey||'');
    if(regionKey&&currentKey&&regionKey!==currentKey){delete r.initialBBox;delete r.sourceBBox;delete r.targetBBox;delete r.transform;delete r.composition_constraints;delete r.v22GeometryBound;}
    const freshEpoch=Number(r&&r.v22RecognitionEpoch)||0;if(freshEpoch&&Number(r.v22GeometryBound)!==freshEpoch){const freshBox=cleanBox(baseBox(r));r.initialBBox=freshBox;r.sourceBBox=freshBox;r.transform=defaultTransform(r);r.targetBBox=freshBox;r.composition_constraints=defaultComposition({sourceBBox:freshBox});r.v22GeometryBound=freshEpoch;}
    r.region_id=r.region_id||r.id||`R${String(i+1).padStart(2,'0')}`;
    r.id=r.id||r.region_id;
    r.name=regionName(r,i);
    r.label=r.name;
    r.initialBBox=initialBox(r);
    r.sourceBBox=cleanBox(r.sourceBBox||r.initialBBox||baseBox(r));
    r.transform=Object.assign(defaultTransform(r),r.transform||{});
    r.anchor='center';
    r.transform.anchor='center';
    r.transform.free_aspect=true;
    normalizeComposition(r);
    r.targetBBox=calcTarget(r);
    r.visible=r.visible!==false;
    r.locked=!!r.locked;
    r.z_index=Number.isFinite(Number(r.z_index))?Number(r.z_index):i+1;
    r.parent_id=r.parent_id||'';
    r.child_ids=Array.isArray(r.child_ids)?r.child_ids:[];
    r.follow_move=r.follow_move!==false;
    r.follow_scale=!!r.follow_scale;
    r.lock_aspect_ratio=r.type==='text'?r.lock_aspect_ratio!==false:r.lock_aspect_ratio!==false;
    r.execution_mode=r.execution_mode||META[r.type].defaultMode;
    r.mask=Object.assign({mask_id:`MASK-${r.region_id}-V1`,type:(r.type==='person'||r.type==='decoration')?'soft':'hard',feather_px:(r.type==='person'||r.type==='decoration')?6:0,include_source:true,include_target:true,mask_area_ratio:null},r.mask||{});
    r.preserve=Array.isArray(r.preserve)?r.preserve:clone(DEFAULT_PRESERVE[r.type]||[]);
    r.repair=Object.assign({background_hole:r.execution_mode!=='direct_transform',rebuild_shadow:r.type==='product'||r.type==='person',edge_blending:r.execution_mode!=='direct_transform'},r.repair||{});
    r.review_status=r.review_status||(r.type==='unclassified'||(r.confidence!=null&&Number(r.confidence)<.65)?'review_required':'ready');
    r.status=r.status||r.review_status;
    r.validation_issues=Array.isArray(r.validation_issues)?r.validation_issues:[];
    r.version_id=r.version_id||`${r.region_id}-V1`;
    r.created_at=r.created_at||new Date().toISOString();
    r.updated_at=r.updated_at||r.created_at;
    return r;
  }
  function initRegions(){
    const s=state();if(!s||!s.result)return[];const resultKey=String(s.result.imageKey||s.result.raw?.imageKey||s.v22ImageKey||'');
    if(resultKey&&String(s.v155.v22ImageKey||'')!==resultKey)v22ResetRegionWorkspace('result-image-key-rebind',{preserveUi:true,imageKey:resultKey});
    if(resultKey&&!s.v22ImageKey)s.v22ImageKey=resultKey;s.v155.v22ImageKey=resultKey||s.v155.v22ImageKey||'';
    s.result.regions=(s.result.regions||[]).map(initRegion);
    if(!s.activeId&&s.result.regions[0])s.activeId=s.result.regions[0].id;
    if(!s.v155.history.length&&s.result.regions.length&&!initializingHistory){
      initializingHistory=true;
      s.v155.history=[{label:'自动识别基线',time:new Date().toISOString(),regions:clone(s.result.regions),documentBlocks:clone(s.result.documentBlocks||[]),blockEdits:clone(s.blockEdits||{}),selected:clone(s.selected||[]),activeId:s.activeId,view:s.v155.view||'edit'}];
      s.v155.historyIndex=0;
      initializingHistory=false;
    }
    return s.result.regions;
  }
  function region(id){const s=state();return s&&s.result&&(s.result.regions||[]).find(r=>String(r.id)===String(id));}
  function active(){const s=state();return s?region(s.activeId):null;}
  function selectedRegions(){const s=state();const set=new Set(s&&s.selected||[]);return initRegions().filter(r=>set.has(r.id));}
  function effectiveTransform(r){
    const t=Object.assign(defaultTransform(r),r.transform||{}),rows=(state()&&state().result&&state().result.regions)||[],p=r.parent_id?rows.find(x=>String(x.id)===String(r.parent_id)):null;
    if(p&&r.follow_move){const pt=effectiveTransform(p);t.move_x_canvas_pct+=Number(pt.move_x_canvas_pct)||0;t.move_y_canvas_pct+=Number(pt.move_y_canvas_pct)||0;}
    if(p&&r.follow_scale){const pt=effectiveTransform(p);t.scale_pct=t.scale_pct*(Number(pt.scale_pct)||100)/100;}
    return t;
  }
  function rawTarget(r){
    const b=r.sourceBBox||baseBox(r),t=effectiveTransform(r),a=ANCHORS[t.anchor]||ANCHORS.center;
    const overall=Math.max(.05,Number(t.scale_pct||100)/100),sx=overall*Math.max(.05,Number(t.width_pct||100)/100),sy=overall*Math.max(.05,Number(t.height_pct||100)/100);
    const w=b.width*sx,h=b.height*sy,anchorX=b.x+b.width*a[0],anchorY=b.y+b.height*a[1];
    return{x:anchorX+(Number(t.move_x_canvas_pct)||0)/100-w*a[0],y:anchorY+(Number(t.move_y_canvas_pct)||0)/100-h*a[1],width:w,height:h};
  }
  function compositionReference(id){const rows=(state()&&state().result&&state().result.regions)||[];return rows.find(x=>String(x.id)===String(id));}
  function constrainedBox(r,box,stack){
    const c=normalizeComposition(r),out=Object.assign({},box),seen=stack||new Set();
    const refFor=id=>{const ref=compositionReference(id);if(!ref||ref.id===r.id||seen.has(ref.id))return null;return calcTarget(ref,new Set(seen));};
    const al=c.alignment||{},ar=al.enabled?refFor(al.reference_id):null;
    if(ar){
      if(al.mode==='left')out.x=ar.x;else if(al.mode==='center_x')out.x=ar.x+ar.width/2-out.width/2;else if(al.mode==='right')out.x=ar.x+ar.width-out.width;
      else if(al.mode==='top')out.y=ar.y;else if(al.mode==='center_y')out.y=ar.y+ar.height/2-out.height/2;else if(al.mode==='bottom')out.y=ar.y+ar.height-out.height;
    }
    const sp=c.spacing||{},sr=sp.enabled?refFor(sp.reference_id):null,gap=(Number(sp.gap_pct)||0)/100;
    if(sr){
      if(sp.direction==='right')out.x=sr.x+sr.width+gap;else if(sp.direction==='left')out.x=sr.x-gap-out.width;
      else if(sp.direction==='below')out.y=sr.y+sr.height+gap;else if(sp.direction==='above')out.y=sr.y-gap-out.height;
    }
    const cm=(c.center_line||{}).mode||'none';
    if(cm==='vertical'||cm==='both')out.x=.5-out.width/2;
    if(cm==='horizontal'||cm==='both')out.y=.5-out.height/2;
    if(c.bottom_contact&&c.bottom_contact.enabled)out.y=Number(c.bottom_contact.bottom_y)-out.height;
    return out;
  }
  function calcTarget(r,stack){const seen=stack||new Set();if(seen.has(r.id))return rawTarget(r);seen.add(r.id);const out=constrainedBox(r,rawTarget(r),seen);seen.delete(r.id);return out;}
  function syncCompositionTransform(r){if(!r)return;const raw=rawTarget(r),target=calcTarget(r);const dx=target.x-raw.x,dy=target.y-raw.y;if(Math.abs(dx)>1e-8)r.transform.move_x_canvas_pct=round((Number(r.transform.move_x_canvas_pct)||0)+dx*100,4);if(Math.abs(dy)>1e-8)r.transform.move_y_canvas_pct=round((Number(r.transform.move_y_canvas_pct)||0)+dy*100,4);}
  function refreshRegion(r){if(!r)return;r.anchor=r.transform.anchor;syncCompositionTransform(r);r.targetBBox=calcTarget(r);r.updated_at=new Date().toISOString();r.review_status='editing';r.status='editing';state().v155.previewReady=false;state().v155.lastChange=new Date().toISOString();}
  function restoreOriginalRange(r){
    if(!r)return false;
    const b=initialBox(r);
    r.sourceBBox=cleanBox(b);
    Object.assign(r,{x:b.x,y:b.y,width:b.width,height:b.height});
    r.transform=defaultTransform(r);
    r.composition_constraints=defaultComposition({sourceBBox:b});
    r.targetBBox=cleanBox(b);
    r.prompt_override='';
    r.manualCorrected=false;
    refreshRegion(r);
    r.targetBBox=cleanBox(b);
    return true;
  }
  function boundaryInfo(r){
    const t=r&&(r.targetBBox||calcTarget(r));if(!t)return{warn:false,outside:false,near:false,message:''};
    const pad=.02,outside=t.x<0||t.y<0||t.x+t.width>1||t.y+t.height>1,near=!outside&&(t.x<pad||t.y<pad||1-(t.x+t.width)<pad||1-(t.y+t.height)<pad);
    const edges=[];if(t.x<0)edges.push('左侧越界');else if(t.x<pad)edges.push('接近左边界');if(t.y<0)edges.push('顶部越界');else if(t.y<pad)edges.push('接近上边界');if(t.x+t.width>1)edges.push('右侧越界');else if(1-(t.x+t.width)<pad)edges.push('接近右边界');if(t.y+t.height>1)edges.push('底部越界');else if(1-(t.y+t.height)<pad)edges.push('接近下边界');
    return{warn:outside||near,outside,near,message:edges.join('、')||'区域处于安全范围'};
  }
  function moveRegionInside(r,padding=.01){
    if(!r)return false;
    let t=r.targetBBox||calcTarget(r),tr=r.transform;
    const maxW=Math.max(.02,1-padding*2),maxH=Math.max(.02,1-padding*2);
    if(t.width>maxW){tr.width_pct=round((Number(tr.width_pct)||100)*maxW/t.width,4);refreshRegion(r);t=r.targetBBox||calcTarget(r);}
    if(t.height>maxH){tr.height_pct=round((Number(tr.height_pct)||100)*maxH/t.height,4);refreshRegion(r);t=r.targetBBox||calcTarget(r);}
    let dx=0,dy=0;
    if(t.x<padding)dx=padding-t.x;else if(t.x+t.width>1-padding)dx=1-padding-(t.x+t.width);
    if(t.y<padding)dy=padding-t.y;else if(t.y+t.height>1-padding)dy=1-padding-(t.y+t.height);
    tr.move_x_canvas_pct=round((Number(tr.move_x_canvas_pct)||0)+dx*100,4);
    tr.move_y_canvas_pct=round((Number(tr.move_y_canvas_pct)||0)+dy*100,4);
    refreshRegion(r);return true;
  }
  function updateMiniBoundaryLive(r){
    const box=document.querySelector('#v15-ocr-overlay [data-v180-mini-boundary]');if(!box||!r)return;
    const info=boundaryInfo(r);box.hidden=!info.warn;box.classList.toggle('danger',!!info.outside);
    const b=box.querySelector('b'),span=box.querySelector('span');if(b)b.textContent=info.outside?'区域已超出画布':'区域接近安全边界';if(span)span.textContent=info.message;
  }
  /* V19：小图区域框拖动/拉伸期间锁定小图可视尺寸。
     旧版在拖动超过 900ms 或边界提示出现时，调整面板可能被重新渲染，
     新节点会先使用 240px 回退尺寸，再由自适应逻辑恢复，形成“突然收缩一下”。 */
  function lockMiniResizeViewport(stage){
    if(!stage)return null;
    const rect=stage.getBoundingClientRect(),overlay=document.getElementById('v15-ocr-overlay');
    const width=Math.max(1,rect.width||Number(stage.dataset.v189FitWidth)||240),height=Math.max(1,rect.height||Number(stage.dataset.v189FitHeight)||240);
    stage.dataset.v190ResizeLocked='true';
    stage.style.setProperty('--v188-stage-width',`${width}px`);
    stage.style.setProperty('--v188-stage-height',`${height}px`);
    if(overlay){overlay.style.setProperty('--v188-stage-width',`${width}px`);overlay.style.setProperty('--v188-stage-height',`${height}px`);overlay.classList.add('v190-mini-resize-active');}
    window.__V190_MINI_RESIZE_ACTIVE__=true;
    return{width,height};
  }
  function unlockMiniResizeViewport(stage){
    if(stage)delete stage.dataset.v190ResizeLocked;
    const overlay=document.getElementById('v15-ocr-overlay');if(overlay)overlay.classList.remove('v190-mini-resize-active');
    window.__V190_MINI_RESIZE_ACTIVE__=false;
  }
  function area(b){return Math.max(0,b.width)*Math.max(0,b.height)*100;}
  function center(b){return{x:b.x+b.width/2,y:b.y+b.height/2};}
  function pct(n){return `${round(n*100,1).toFixed(1)}%`;}
  function transformChanged(r){const t=r.transform||defaultTransform(r);return Math.abs(t.move_x_canvas_pct)>1e-6||Math.abs(t.move_y_canvas_pct)>1e-6||Math.abs(t.scale_pct-100)>1e-6||Math.abs(t.width_pct-100)>1e-6||Math.abs(t.height_pct-100)>1e-6||Math.abs(t.rotation_deg)>1e-6;}
  function targetInside(b){return b.x>=0&&b.y>=0&&b.x+b.width<=1&&b.y+b.height<=1;}
  function intersection(a,b){const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),x2=Math.min(a.x+a.width,b.x+b.width),y2=Math.min(a.y+a.height,b.y+b.height);return Math.max(0,x2-x)*Math.max(0,y2-y);}
  function overlapRatio(a,b){const inter=intersection(a,b);return inter/Math.max(.000001,Math.min(a.width*a.height,b.width*b.height));}

  function promptFor(r){
    if(!r)return'';const m=META[r.type]||META.unclassified,b=r.sourceBBox,t=r.targetBBox||calcTarget(r),bc=center(b),tc=center(t),tr=r.transform||defaultTransform(r);
    const changes=[];
    if(Math.abs(tr.move_x_canvas_pct)>.01)changes.push(`${tr.move_x_canvas_pct>0?'向右':'向左'}移动${Math.abs(tr.move_x_canvas_pct).toFixed(1)}%画布宽度`);
    if(Math.abs(tr.move_y_canvas_pct)>.01)changes.push(`${tr.move_y_canvas_pct>0?'向下':'向上'}移动${Math.abs(tr.move_y_canvas_pct).toFixed(1)}%画布高度`);
    if(Math.abs(tr.scale_pct-100)>.01)changes.push(`整体缩放至原来的${Number(tr.scale_pct).toFixed(1)}%`);
    if(Math.abs(tr.width_pct-100)>.01)changes.push(`宽度调整为基准宽度的${Number(tr.width_pct).toFixed(1)}%`);
    if(Math.abs(tr.height_pct-100)>.01)changes.push(`高度调整为基准高度的${Number(tr.height_pct).toFixed(1)}%`);
    if(Math.abs(tr.rotation_deg)>.01)changes.push(`旋转${Number(tr.rotation_deg).toFixed(1)}°`);
    const mode=r.execution_mode||m.defaultMode;
    let modeText='优先使用直接几何变换，不重新生成区域内容。';
    if(mode==='move_and_repair')modeText='提取并保持主体内容，修复原位置背景空洞，在目标位置重新融合边缘、接触面与自然阴影。';
    if(mode==='local_regenerate')modeText='使用精细蒙版和区域裁剪参考执行局部重新生成，严格限制在原位置修复范围、目标位置融合范围和边缘羽化范围内。';
    const preserve=(r.preserve||[]).map(x=>String(x).replaceAll('_',' ')).join('、')||'非目标内容',cc=normalizeComposition(r),locks=[];
    if(cc.bottom_contact.enabled)locks.push(`锁定底部接触线Y ${(Number(cc.bottom_contact.bottom_y)*100).toFixed(1)}%`);
    if(cc.center_line.mode!=='none')locks.push(`锁定${cc.center_line.mode==='vertical'?'画布竖向中心线':cc.center_line.mode==='horizontal'?'画布横向中心线':'画布双中心线'}`);
    if(cc.spacing.enabled){const rr=compositionReference(cc.spacing.reference_id);locks.push(`与${rr?(window.__V221_REGION_NAME__?.(rr)||rr.name||rr.label||'参考区域'):'参考区域'}保持${Number(cc.spacing.gap_pct).toFixed(1)}%对象间距`);}
    if(cc.alignment.enabled){const rr=compositionReference(cc.alignment.reference_id);locks.push(`与${rr?(window.__V221_REGION_NAME__?.(rr)||rr.name||rr.label||'参考区域'):'参考区域'}维持对齐关系`);}
    const lockText=locks.length?`构图约束：${locks.join('，')}。`:'';
    const targetUnchanged=sameBox(b,t)&&changes.length===0;
    const targetText=targetUnchanged?'目标保持不变。':`目标区域左上角坐标为X ${(t.x*100).toFixed(1)}%、Y ${(t.y*100).toFixed(1)}%，宽度${(t.width*100).toFixed(1)}%（占画面宽度${(t.width*100).toFixed(1)}%）、高度${(t.height*100).toFixed(1)}%（占画面高度${(t.height*100).toFixed(1)}%），中心坐标为X ${(tc.x*100).toFixed(1)}%、Y ${(tc.y*100).toFixed(1)}%，目标区域外接框面积占整张画面${area(t).toFixed(1)}%。`;
    return `修改区域“${r.name||r.label||m.label}”，该区域类型为${m.label}。原始区域左上角坐标为X ${(b.x*100).toFixed(1)}%、Y ${(b.y*100).toFixed(1)}%，宽度${(b.width*100).toFixed(1)}%（占画面宽度${(b.width*100).toFixed(1)}%）、高度${(b.height*100).toFixed(1)}%（占画面高度${(b.height*100).toFixed(1)}%），中心坐标为X ${(bc.x*100).toFixed(1)}%、Y ${(bc.y*100).toFixed(1)}%，区域外接框面积占整张画面${area(b).toFixed(1)}%。${changes.length?'执行：'+changes.join('，')+'。':'保持当前几何位置和尺寸。'}宽度与高度可独立调整，缩放以区域中心为基准。${lockText}${targetText}${modeText}保持${preserve}不变。除当前区域、原位置修复范围和目标位置融合范围外，不改变其他区域。`;
  }
  function anchorLabel(a){return({'top-left':'左上','top':'上中','top-right':'右上','left':'左中','center':'中心','right':'右中','bottom-left':'左下','bottom':'下中','bottom-right':'右下'})[a]||'中心';}
  function regionTask(r){
    const b=r.sourceBBox,t=r.targetBBox||calcTarget(r),bc=center(b),tc=center(t),tr=effectiveTransform(r);
    const box=x=>({x_pct:round(x.x*100),y_pct:round(x.y*100),width_pct:round(x.width*100),height_pct:round(x.height*100),center_x_pct:round((x.x+x.width/2)*100),center_y_pct:round((x.y+x.height/2)*100),area_ratio:round(area(x)),normalized_1000:{x:Math.round(x.x*1000),y:Math.round(x.y*1000),width:Math.round(x.width*1000),height:Math.round(x.height*1000)}});
    return{schema_version:'1.0',region_id:r.region_id,name:r.name,region_type:r.type,execution_mode:r.execution_mode,status:r.status,confidence:r.confidence==null?null:round(r.confidence),source:box(b),transform:{move_x_canvas_pct:round(tr.move_x_canvas_pct),move_y_canvas_pct:round(tr.move_y_canvas_pct),scale_x:round((tr.scale_pct/100)*(tr.width_pct/100)),scale_y:round((tr.scale_pct/100)*(tr.height_pct/100)),overall_scale:round(tr.scale_pct/100),width_scale:round(tr.width_pct/100),height_scale:round(tr.height_pct/100),rotation_deg:round(tr.rotation_deg),anchor:'center'},target:box(t),mask:clone(r.mask),preserve:clone(r.preserve||[]),repair:clone(r.repair||{}),constraints:{modify_other_regions:false,keep_inside_canvas:true,lock_aspect_ratio:!!r.lock_aspect_ratio,avoid_region_ids:validationAvoidIds(r),composition:clone(normalizeComposition(r))},dependencies:{parent_id:r.parent_id||null,child_ids:clone(r.child_ids||[]),follow_move:!!r.follow_move,follow_scale:!!r.follow_scale,z_index:r.z_index},prompt:(window.__V271_RESOLVE_REGION_PROMPT__?.(r)||r.prompt_override||promptFor(r)),validation_issues:clone(r.validation_issues||[])};
  }
  function validationAvoidIds(r){return initRegions().filter(x=>x.id!==r.id&&x.visible!==false&&overlapRatio(r.targetBBox||calcTarget(r),x.targetBBox||calcTarget(x))>.05).map(x=>x.region_id);}
  function projectTask(){const s=state(),v=s&&s.v155||{};return{schema_version:'1.0',workspace_version:VERSION,job_id:s&&s.result&&s.result.jobId||`JOB-${Date.now()}`,state:s&&s.v155.previewReady?'preview_ready':'editing',image:{name:s&&s.name||'',source:s&&s.source||'',width_px:s&&s.result&&s.result.raw&&s.result.raw.image&&s.result.raw.image.width||null,height_px:s&&s.result&&s.result.raw&&s.result.raw.image&&s.result.raw.image.height||null,coordinate_system:'normalized_0_1000'},regions:initRegions().map(regionTask),validation:{checked_at:s&&s.v155.validationAt||'',issues:clone(s&&s.v155.validation||[])},selected_region_ids:selectedRegions().map(r=>r.region_id),workspace_ui:{adjust_layout_ratio:Number(v.v186LayoutRatio)||58,pane_scroll:clone(v.v187PaneScroll||{main:0,mini:0}),mini_views:clone(v.v187MiniViews||{})}};}

  function validate(){
    const s=state(),rows=initRegions(),issues=[],enabled=new Set(s.selected||[]),byId=new Map();
    rows.forEach(r=>{byId.set(String(r.id),r);byId.set(String(r.region_id),r);r.validation_issues=[];});
    const add=(r,severity,code,message,fix)=>{const it={id:`${r.id}:${code}`,regionId:r.id,region_id:r.region_id,severity,code,message,fix:fix||''};issues.push(it);r.validation_issues.push(it);};
    const hasParentCycle=r=>{const seen=new Set([String(r.id)]);let cur=r;for(let i=0;i<rows.length+1;i++){if(!cur.parent_id)return false;const p=byId.get(String(cur.parent_id));if(!p)return false;if(seen.has(String(p.id)))return true;seen.add(String(p.id));cur=p;}return true;};
    rows.forEach(r=>{
      if(!enabled.has(r.id))return;
      const t=r.targetBBox||calcTarget(r);
      if(r.type==='unclassified')add(r,'block','unclassified','未分类区域必须人工确认类型后才能正式应用。','confirm_type');
      if(!targetInside(t))add(r,'block','out_of_bounds',`目标框超出画布：X ${(t.x*100).toFixed(1)}%、Y ${(t.y*100).toFixed(1)}%。`,'inside');
      if(t.width<.008||t.height<.008)add(r,'block','too_small','目标区域过小，无法形成有效蒙版。','reset_scale');
      if(r.type==='text'&&(t.height<.025||t.width<.025))add(r,'warning','text_readability','文字区域缩放后可能无法阅读。','text_size');
      if((r.type==='product'||r.type==='person')&&t.y+t.height<.72&&Number(r.transform.move_y_canvas_pct)<-2)add(r,'warning','floating','主体可能悬空，建议使用下中锚点或底部对齐。','bottom_align');
      if(r.mask&&r.mask.type==='soft'&&Number(r.mask.feather_px)>24)add(r,'hint','large_feather','羽化值较大，可能混入背景。','reduce_feather');

      if(r.parent_id){
        const parent=byId.get(String(r.parent_id));
        if(!parent)add(r,'block','parent_missing',`父区域 ${r.parent_id} 不存在，无法计算跟随变换。`,'');
        else{
          if(hasParentCycle(r))add(r,'block','parent_cycle','父子区域形成循环依赖，跟随变换无法安全计算。','');
          if((r.follow_move||r.follow_scale)&&!enabled.has(parent.id))add(r,'warning','parent_disabled',`当前区域跟随“${window.__V221_REGION_NAME__?.(parent)||parent.name||parent.label||'父区域'}”，但父区域未启用，应用后可能出现位置或缩放偏差。`,'');
          if(Array.isArray(parent.child_ids)&&parent.child_ids.length&&!parent.child_ids.some(id=>String(id)===String(r.id)))add(r,'warning','parent_link_mismatch',`父区域“${window.__V221_REGION_NAME__?.(parent)||parent.name||parent.label||'父区域'}”的子区域列表未包含当前区域，父子关系未双向同步。`,'');
          const tr=r.transform||{};
          if(r.follow_move&&(Math.abs(Number(tr.move_x_canvas_pct)||0)>.01||Math.abs(Number(tr.move_y_canvas_pct)||0)>.01))add(r,'warning','follow_move_stack',`当前区域既设置独立移动又跟随“${window.__V221_REGION_NAME__?.(parent)||parent.name||parent.label||'父区域'}”移动，位移会叠加。`,'');
          if(r.follow_scale&&(Math.abs((Number(tr.scale_pct)||100)-100)>.01||Math.abs((Number(tr.width_pct)||100)-100)>.01||Math.abs((Number(tr.height_pct)||100)-100)>.01))add(r,'warning','follow_scale_stack',`当前区域既设置独立缩放又跟随“${window.__V221_REGION_NAME__?.(parent)||parent.name||parent.label||'父区域'}”缩放，尺寸变化会叠加。`,'');
        }
      }

      rows.forEach(o=>{
        if(o.id===r.id||o.visible===false)return;
        const ot=o.targetBBox||calcTarget(o),inter=intersection(t,ot);if(inter<=0)return;
        const ratio=overlapRatio(t,ot),textCoverage=o.type==='text'&&r.type!=='text'?inter/Math.max(.000001,ot.width*ot.height):0;
        if(textCoverage>.12){add(r,textCoverage>.45?'block':'warning','text_coverage_'+o.id,`文字覆盖风险：目标区域覆盖“${window.__V221_REGION_NAME__?.(o)||o.name||o.label||'文字区域'}”文字框 ${(textCoverage*100).toFixed(0)}%。`,'avoid_text');return;}
        if(enabled.has(o.id)&&ratio>.55)add(r,'warning','mutual_occlusion_'+o.id,`互相遮挡风险：与“${window.__V221_REGION_NAME__?.(o)||o.name||o.label||'其他区域'}”重叠 ${(ratio*100).toFixed(0)}%。`,'');
        else if(ratio>.35)add(r,'hint','overlap_'+o.id,`与“${window.__V221_REGION_NAME__?.(o)||o.name||o.label||'其他区域'}”重叠 ${(ratio*100).toFixed(0)}%。`,'');
      });
    });
    s.v155.validation=issues;s.v155.validationAt=new Date().toISOString();
    rows.forEach(r=>{if(!enabled.has(r.id))return;const block=r.validation_issues.some(x=>x.severity==='block'),warn=r.validation_issues.some(x=>x.severity==='warning');r.status=block?'review_required':warn?'ready_with_warning':'ready';r.review_status=r.status;});
    return issues;
  }

  function conflictMessage(items,title){
    const lines=items.slice(0,8).map((it,i)=>`${i+1}. ${window.__V221_REGION_NAME__?.(initRegions().find(r=>String(r.id)===String(it.regionId)))||'当前区域'}：${it.message}`);if(items.length>8)lines.push(`……另有 ${items.length-8} 项`);return `${title}\n\n${lines.join('\n')}`;
  }
  function conflictScopeLabel(scope){return({all:'全部类型',text:'文字区域',product:'产品区域',person:'人物/宠物',background:'背景区域',decoration:'装饰区域'})[scope]||'全部类型';}
  function conflictDialog(blocks,warnings,hints,scope){
    document.querySelector('.v178-modal-backdrop')?.remove();const allMain=[...blocks,...warnings],allIssues=[...allMain,...hints];const fixable=allIssues.filter(x=>x.fix);
    const item=it=>{const rr=region(it.regionId)||region(it.region_id);return `<button type="button" class="v178-conflict-item ${it.severity}" data-v180-conflict-locate="${esc(it.regionId)}"><b>${it.severity==='block'?'阻断':it.severity==='warning'?'风险':'轻提示'} · ${esc(window.__V221_REGION_NAME__?.(rr)||rr?.name||rr?.label||'区域')}</b><p>${esc(it.message)}</p><small>点击直接定位并高亮该区域</small></button>`;};
    const highest=blocks.length?'阻断':warnings.length?'风险':hints.length?'轻提示':'无风险';
    const summaryClass=blocks.length?'block':warnings.length?'warning':hints.length?'hint':'pass';
    const summaryText=blocks.length?`发现 ${blocks.length} 个阻断问题，需先处理`:warnings.length?`发现 ${warnings.length} 个风险，请确认后处理`:hints.length?`检查通过，另有 ${hints.length} 个轻提示`:'检查通过，未发现区域冲突';
    const detailHtml=allIssues.length?allIssues.map(item).join(''):'<div class="v178-conflict-pass">没有可显示的详细问题。</div>';
    const wrap=document.createElement('div');wrap.className='v178-modal-backdrop';wrap.innerHTML=`<section class="v178-modal v178-conflict-modal v181-conflict-summary-mode" role="dialog" aria-modal="true"><header><div><b>批量区域冲突检查</b><small>${esc(conflictScopeLabel(scope))}</small></div><button type="button" data-v178-modal-close>×</button></header><div class="v181-conflict-summary ${summaryClass}"><div><span>最高风险</span><b>${highest}</b></div><div><span>问题统计</span><b>阻断 ${blocks.length} · 风险 ${warnings.length} · 轻提示 ${hints.length}</b></div><p>${esc(summaryText)}</p></div>${allIssues.length?`<details class="v181-conflict-details"><summary>查看详细问题（${allIssues.length}）</summary><div class="v178-conflict-main">${detailHtml}</div></details>`:'<div class="v178-conflict-pass">未发现阻断、风险或轻提示。</div>'}<footer>${fixable.length?`<button type="button" class="primary" data-v178-batch-fix>批量修复可处理项（${fixable.length}）</button>`:''}<button type="button" data-v178-modal-close>关闭</button></footer></section>`;document.body.appendChild(wrap);
    const close=()=>wrap.remove();wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-v178-modal-close]')){close();return;}const locate=e.target.closest('[data-v180-conflict-locate]');if(locate){const id=locate.dataset.v180ConflictLocate;close();if(typeof window.__V175_SELECT_AND_LOCATE_REGION==='function')window.__V175_SELECT_AND_LOCATE_REGION(id);else{const s=state();s.activeId=id;scheduleEnhance();}toast(`已定位冲突区域 ${window.__V221_REGION_NAME__?.(region(id))||region(id)?.name||region(id)?.label||'区域'}`,'ok');return;}if(e.target.closest('[data-v178-batch-fix]')){fixable.forEach(x=>fixIssue(x.id));close();validate();scheduleEnhance();toast(`已批量修复 ${fixable.length} 个可处理项`,'ok');}});
  }
  function runConflictCheck(forApply){
    const s=state();if(!s)return false;const enabled=new Set(s.selected||[]),scope=s.v155.v178ConflictScope||'all',scopedIds=new Set(initRegions().filter(r=>enabled.has(r.id)&&(scope==='all'||r.type===scope)).map(r=>r.id));
    const all=validate().filter(it=>scopedIds.has(it.regionId)),blocks=all.filter(x=>x.severity==='block'),warnings=all.filter(x=>x.severity==='warning'),hints=all.filter(x=>x.severity==='hint');
    s.v155.v177ConflictCheck={status:blocks.length?'blocked':warnings.length?'warning':'passed',scope,blocks:blocks.length,warnings:warnings.length,hints:hints.length,checkedAt:new Date().toISOString(),generationFingerprint:v273ConflictFingerprint(s),issues:clone(all)};scheduleEnhance();
    if(!scopedIds.size){toast(`${conflictScopeLabel(scope)}没有已启用区域`,'bad');return false;}
    if(blocks.length){conflictDialog(blocks,warnings,hints,scope);toast(`冲突检查发现 ${blocks.length} 个阻断问题`,'bad');return false;}
    if(warnings.length){if(forApply){return window.confirm(`区域冲突检查摘要\n\n最高风险：风险\n阻断 0 · 风险 ${warnings.length} · 轻提示 ${hints.length}\n\n详细问题可通过“检查区域冲突”按需展开查看。仍要继续应用吗？`);}conflictDialog(blocks,warnings,hints,scope);toast(`冲突检查发现 ${warnings.length} 个风险`,'bad');return false;}
    if(forApply){toast(hints.length?`冲突检查通过，${hints.length} 个轻提示已折叠`:'区域冲突检查通过','ok');return true;}
    conflictDialog(blocks,warnings,hints,scope);toast('区域冲突检查通过','ok');return true;
  }
  window.__V177_PRE_APPLY_CONFLICT_CHECK__=()=>runConflictCheck(true);
  function fixIssue(id){const s=state(),it=(s.v155.validation||[]).find(x=>x.id===id);if(!it)return;const r=region(it.regionId);if(!r)return;pushHistory('自动修复前');
    const t=r.targetBBox||calcTarget(r),tr=r.transform;
    if(it.fix==='inside'){
      let dx=0,dy=0;if(t.x<0)dx=-t.x;if(t.x+t.width>1)dx=1-(t.x+t.width);if(t.y<0)dy=-t.y;if(t.y+t.height>1)dy=1-(t.y+t.height);tr.move_x_canvas_pct+=dx*100;tr.move_y_canvas_pct+=dy*100;
    }else if(it.fix==='text_size'){tr.scale_pct=Math.max(80,Number(tr.scale_pct)||100);tr.width_pct=100;tr.height_pct=100;}
    else if(it.fix==='bottom_align'){const nt=calcTarget(r);tr.move_y_canvas_pct+=(Math.min(.96,r.sourceBBox.y+r.sourceBBox.height)- (nt.y+nt.height))*100;}
    else if(it.fix==='reduce_feather')r.mask.feather_px=12;
    else if(it.fix==='reset_scale'){tr.scale_pct=100;tr.width_pct=100;tr.height_pct=100;}
    refreshRegion(r);validate();pushHistory('自动修复：'+it.code);rerender();
  }

  function historySnapshot(label){const s=state();return{label,time:new Date().toISOString(),regions:clone(initRegions()),documentBlocks:clone(s.result?.documentBlocks||[]),blockEdits:clone(s.blockEdits||{}),selected:clone(s.selected||[]),activeId:s.activeId,view:s.v155.view};}
  function pushHistory(label,force){const s=state();if(!s||!s.result)return;const snap=historySnapshot(label);const current=s.v155.history[s.v155.historyIndex];if(!force&&current&&JSON.stringify(current.regions)===JSON.stringify(snap.regions))return;s.v155.history=s.v155.history.slice(0,s.v155.historyIndex+1);s.v155.history.push(snap);if(s.v155.history.length>80)s.v155.history.shift();s.v155.historyIndex=s.v155.history.length-1;}
  function restoreHistory(index){const s=state(),snap=s&&s.v155.history[index];if(!snap||!s.result)return;s.result.regions=clone(snap.regions);if(Array.isArray(snap.documentBlocks))s.result.documentBlocks=clone(snap.documentBlocks);if(snap.blockEdits)s.blockEdits=clone(snap.blockEdits);s.selected=clone(snap.selected);s.activeId=snap.activeId;s.v155.view=snap.view||'edit';s.v155.historyIndex=index;s.v155.previewReady=false;validate();rerender();}
  function undo(){const s=state();if(s&&s.v155.historyIndex>0)restoreHistory(s.v155.historyIndex-1);}
  function redo(){const s=state();if(s&&s.v155.historyIndex<s.v155.history.length-1)restoreHistory(s.v155.historyIndex+1);}

  function rememberScroll(){const overlay=$('#v15-ocr-overlay');return{windowY:window.scrollY||0,overlay:overlay?overlay.scrollTop:0,body:overlay&&$('.v15-ocr-body',overlay)?$('.v15-ocr-body',overlay).scrollTop:0,stage:overlay&&$('.v15-ocr-stage',overlay)?$('.v15-ocr-stage',overlay).scrollTop:0,main:overlay&&$('.v160-adjust-main',overlay)?$('.v160-adjust-main',overlay).scrollTop:0,side:overlay&&$('.v160-side-content',overlay)?$('.v160-side-content',overlay).scrollTop:0};}
  function restoreScroll(pos){requestAnimationFrame(()=>{const overlay=$('#v15-ocr-overlay');window.scrollTo(0,pos.windowY||0);if(overlay)overlay.scrollTop=pos.overlay||0;const body=overlay&&$('.v15-ocr-body',overlay),stage=overlay&&$('.v15-ocr-stage',overlay),main=overlay&&$('.v160-adjust-main',overlay),side=overlay&&$('.v160-side-content',overlay);if(body)body.scrollTop=pos.body||0;if(stage)stage.scrollTop=pos.stage||0;if(main)main.scrollTop=pos.main||0;if(side)side.scrollTop=pos.side||0;});}
  function rerender(){const s=state();if(!s||!s.open)return;const pos=rememberScroll();transformInteracting=false;clearTimeout(transformReleaseTimer);const r=active();if(r&&typeof window.__V164_UPDATE_FOCUS_LIVE==='function')window.__V164_UPDATE_FOCUS_LIVE(r,r.targetBBox||calcTarget(r));scheduleEnhance();restoreScroll(pos);}
  function beginTransformInteraction(){
    transformInteracting=true;clearTimeout(transformReleaseTimer);
    /* 仅把定时器作为异常中断保险；正常拖动必须由 pointerup/pointercancel 结束。
       旧版 900ms 超时会在用户仍拉伸时重建面板，是尺寸闪缩的主要根因。 */
    transformReleaseTimer=setTimeout(()=>{
      if(miniDrag||targetDrag){beginTransformInteraction();return;}
      transformInteracting=false;scheduleEnhance();
    },30000);
  }
  function endTransformInteraction(refresh=true){transformInteracting=false;clearTimeout(transformReleaseTimer);if(refresh)scheduleEnhance();}
  function scheduleEnhance(){if(transformInteracting||scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;if(transformInteracting)return;enhance();});}

  const V178_CLOSE_REASONS={misrecognized:'误识别',duplicate:'重复区域',defer:'暂不处理'};
  const V179_AUDIT_LIMIT=120;
  function closeReasonLabel(r){return V178_CLOSE_REASONS[r&&r.close_reason]||'未标记';}
  function auditBoxText(b){return b?`X ${(Number(b.x||0)*100).toFixed(1)}% · Y ${(Number(b.y||0)*100).toFixed(1)}% · W ${(Number(b.width||0)*100).toFixed(1)}% · H ${(Number(b.height||0)*100).toFixed(1)}% · 面积 ${(Math.max(0,Number(b.width||0))*Math.max(0,Number(b.height||0))*100).toFixed(1)}%`:'—';}
  function auditRegionState(r){if(!r)return null;const full=clone(r);delete full.audit_log;return{id:r.id,region_id:r.region_id,name:r.name,label:r.label,type:r.type,visible:r.visible!==false,locked:!!r.locked,close_reason:r.close_reason||'',sourceBBox:clone(r.sourceBBox||baseBox(r)),targetBBox:clone(r.targetBBox||calcTarget(r)),transform:clone(r.transform||defaultTransform(r)),full};}
  function auditDiffRows(before,after){
    const rows=[];const add=(label,a,b)=>{if(String(a)===String(b))return;rows.push({label,before:String(a),after:String(b)});};
    if(!before&&!after)return rows;if(!before){rows.push({label:'区域状态',before:'不存在',after:'已创建'});return rows;}if(!after){rows.push({label:'区域状态',before:'存在',after:'已删除'});return rows;}
    add('区域名称',before.name||before.label||'',after.name||after.label||'');add('显示状态',before.visible?'显示':'隐藏',after.visible?'显示':'隐藏');add('锁定状态',before.locked?'锁定':'未锁定',after.locked?'锁定':'未锁定');add('关闭原因',closeReasonLabel(before),closeReasonLabel(after));add('区域范围变化',auditBoxText(before.targetBBox),auditBoxText(after.targetBBox));
    const bt=before.transform||{},at=after.transform||{};add('水平移动',`${Number(bt.move_x_canvas_pct||0).toFixed(1)}%`,`${Number(at.move_x_canvas_pct||0).toFixed(1)}%`);add('垂直移动',`${Number(bt.move_y_canvas_pct||0).toFixed(1)}%`,`${Number(at.move_y_canvas_pct||0).toFixed(1)}%`);add('整体缩放',`${Number(bt.scale_pct||100).toFixed(1)}%`,`${Number(at.scale_pct||100).toFixed(1)}%`);add('宽度',`${Number(bt.width_pct||100).toFixed(1)}%`,`${Number(at.width_pct||100).toFixed(1)}%`);add('高度',`${Number(bt.height_pct||100).toFixed(1)}%`,`${Number(at.height_pct||100).toFixed(1)}%`);add('旋转',`${Number(bt.rotation_deg||0).toFixed(1)}°`,`${Number(at.rotation_deg||0).toFixed(1)}°`);
    return rows;
  }
  function auditAction(action,r,detail=''){
    const s=state();if(!s)return null;
    const now=new Date(),hist=s.v155.history[s.v155.historyIndex]||null,beforeRegion=r&&hist&&Array.isArray(hist.regions)?hist.regions.find(x=>String(x.id)===String(r.id)):null;
    const item={id:`audit_${now.getTime()}_${Math.random().toString(36).slice(2,7)}`,at:now.toISOString(),action:String(action||'区域操作'),region_id:r&&String(r.region_id||r.id)||'',region_name:r&&String(r.name||r.label||'')||'',detail:String(detail||''),before:r?auditRegionState(beforeRegion):null,after:r?auditRegionState(r):null,selected_before:clone(hist&&hist.selected||s.selected||[]),selected_after:clone(s.selected||[]),active_before:hist&&hist.activeId||s.activeId,active_after:s.activeId};
    if(!r&&hist){
      item.before_regions=clone(hist.regions||[]);item.after_regions=clone(initRegions());item.documentBlocks=clone(hist.documentBlocks||[]);item.blockEdits=clone(hist.blockEdits||{});
      const beforeIds=new Set(item.before_regions.map(x=>String(x.id))),afterIds=new Set(item.after_regions.map(x=>String(x.id))),removed=[...beforeIds].filter(id=>!afterIds.has(id)),added=[...afterIds].filter(id=>!beforeIds.has(id));
      item.diff=[{label:'区域数量',before:String(item.before_regions.length),after:String(item.after_regions.length)}];if(removed.length)item.diff.push({label:'已移除区域',before:removed.join('、'),after:'已删除'});if(added.length)item.diff.push({label:'新增区域',before:'不存在',after:added.join('、')});
    }else item.diff=auditDiffRows(item.before,item.after);
    s.v155.v179Audit=Array.isArray(s.v155.v179Audit)?s.v155.v179Audit:[];
    s.v155.v179Audit.unshift(item);if(s.v155.v179Audit.length>V179_AUDIT_LIMIT)s.v155.v179Audit.length=V179_AUDIT_LIMIT;
    if(r){r.audit_log=Array.isArray(r.audit_log)?r.audit_log:[];r.audit_log.unshift({id:item.id,at:item.at,action:item.action,detail:item.detail,diff:clone(item.diff)});if(r.audit_log.length>30)r.audit_log.length=30;r.updated_at=now.toISOString();}
    return item;
  }
  window.__V179_AUDIT__=auditAction;
  function auditTime(value){try{return new Date(value).toLocaleString('zh-CN',{hour12:false});}catch(_e){return String(value||'');}}
  function auditPanelHtml(){
    const s=state(),all=s&&s.v155&&s.v155.v179Audit||[],showAll=!!(s&&s.v155&&s.v155.v180AuditShowAll),rows=showAll?all:all.slice(0,5);
    const cards=rows.length?rows.map(x=>`<article data-v180-audit-row="${esc(x.id)}"><header><b>${esc(x.action)}</b><time>${esc(auditTime(x.at))}</time></header><p>${x.region_id?esc(x.region_name||'区域'):'批量操作'}${x.detail?` · ${esc(x.detail)}`:''}</p><footer><button type="button" data-v180-audit-detail="${esc(x.id)}">查看差异</button><button type="button" data-v180-audit-rollback="${esc(x.id)}">快速撤回</button></footer></article>`).join(''):'<p class="v179-audit-empty">暂无区域操作记录。</p>';
    return `<details class="v179-audit-panel"><summary><b>区域操作记录</b><span>${all.length} 条</span></summary><div>${cards}${all.length>5?`<button type="button" class="v180-audit-toggle" data-v180-audit-toggle>${showAll?'收起到最近五条':`查看全部（${all.length}）`}</button>`:''}</div></details>`;
  }
  function auditItem(id){const s=state();return s&&(s.v155.v179Audit||[]).find(x=>String(x.id)===String(id));}
  function auditDetailDialog(id){
    const item=auditItem(id);if(!item)return;document.querySelector('.v178-modal-backdrop')?.remove();
    const rows=item.diff&&item.diff.length?item.diff:[{label:'操作说明',before:'—',after:item.detail||'没有可显示的字段差异'}];
    const wrap=document.createElement('div');wrap.className='v178-modal-backdrop';wrap.innerHTML=`<section class="v178-modal v180-audit-modal" role="dialog" aria-modal="true"><header><div><b>审计记录差异</b><small>${esc(item.action)} · ${esc(auditTime(item.at))}</small></div><button type="button" data-v178-modal-close>×</button></header><div class="v180-audit-diff">${rows.map(x=>`<article><b>${esc(x.label)}</b><span>${esc(x.before)}</span><i>→</i><strong>${esc(x.after)}</strong></article>`).join('')}</div><footer><button type="button" class="primary" data-v180-audit-rollback="${esc(item.id)}">恢复到此次操作前</button><button type="button" data-v178-modal-close>关闭</button></footer></section>`;document.body.appendChild(wrap);
    wrap.addEventListener('click',e=>{if(e.target===wrap||e.target.closest('[data-v178-modal-close]'))wrap.remove();});
  }
  function rollbackAudit(id){
    const s=state(),item=auditItem(id);if(!s||!item||!s.result)return false;
    pushHistory('审计快速回滚前',true);
    if(item.before_regions){s.result.regions=clone(item.before_regions);s.selected=clone(item.selected_before||[]);s.activeId=item.active_before||s.result.regions[0]?.id||'';if(Array.isArray(item.documentBlocks))s.result.documentBlocks=clone(item.documentBlocks);if(item.blockEdits)s.blockEdits=clone(item.blockEdits);}
    else if(item.before&&item.before.full){const idx=(s.result.regions||[]).findIndex(r=>String(r.id)===String(item.before.full.id));if(idx>=0)s.result.regions[idx]=clone(item.before.full);else s.result.regions.push(clone(item.before.full));s.selected=clone(item.selected_before||s.selected||[]);s.activeId=item.active_before||item.before.full.id;}
    else if(!item.before&&item.after&&item.after.full){const createdId=String(item.after.full.id||'');s.result.regions=(s.result.regions||[]).filter(r=>String(r.id)!==createdId);s.selected=clone(item.selected_before||[]).filter(id=>String(id)!==createdId);s.activeId=item.active_before||s.result.regions[0]?.id||'';}
    else return false;
    initRegions();validate();const rr=item.region_id?region(item.before&&item.before.id||item.region_id):null;auditAction('快速回滚',rr,`恢复到“${item.action}”之前`);pushHistory('审计快速回滚',true);document.querySelector('.v178-modal-backdrop')?.remove();rerender();toast('已恢复到该操作发生之前','ok');return true;
  }
  window.__V180_AUDIT_ROLLBACK__=rollbackAudit;
  function closeReasonDialog(regionId){
    const s=state(),r=region(regionId);if(!s||!r)return;
    document.querySelector('.v178-modal-backdrop')?.remove();
    const wrap=document.createElement('div');wrap.className='v178-modal-backdrop';
    wrap.innerHTML=`<section class="v178-modal" role="dialog" aria-modal="true" aria-label="选择区域关闭原因"><header><div><b>关闭原因</b><small>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</small></div><button type="button" data-v178-modal-close>×</button></header><p>标记关闭原因，后续可筛选并批量清理。关闭区域仍可查看，但点击卡片或画布不会重新启用。</p><div class="v178-reason-grid">${Object.entries(V178_CLOSE_REASONS).map(([key,label])=>`<button type="button" data-v178-reason="${key}" class="${r.close_reason===key?'on':''}"><b>${label}</b><small>${key==='misrecognized'?'识别结果不正确，可后续清理':key==='duplicate'?'与其他区域重复，可批量去重':'暂时关闭，保留后续恢复'}</small></button>`).join('')}</div><footer><button type="button" data-v178-reason="">暂不标记</button></footer></section>`;
    document.body.appendChild(wrap);
    const close=()=>wrap.remove();
    wrap.addEventListener('click',e=>{
      if(e.target===wrap||e.target.closest('[data-v178-modal-close]')){close();return;}
      const btn=e.target.closest('[data-v178-reason]');if(!btn)return;
      pushHistory('修改关闭原因前',true);r.close_reason=btn.dataset.v178Reason||'';r.close_reason_updated_at=new Date().toISOString();
      auditAction(r.close_reason?'修改关闭原因':'清除关闭原因',r,closeReasonLabel(r));
      pushHistory(r.close_reason?`标记关闭原因：${closeReasonLabel(r)}`:'清除关闭原因',true);close();scheduleEnhance();
    });
  }
  window.__V178_ASK_CLOSE_REASON__=closeReasonDialog;
  function closedRowsForFilter(filter){
    const s=state(),selected=new Set(s&&s.selected||[]);return initRegions().filter(r=>{
      if(selected.has(r.id))return false;
      if(!filter||filter==='all'||filter==='closed')return true;
      return r.close_reason===filter;
    });
  }
  function batchCleanClosed(){
    const s=state();if(!s||!s.result)return;const filter=s.v178CloseFilter||'all',targets=closedRowsForFilter(filter);
    if(!targets.length){toast('当前筛选下没有可清理的已关闭区域','bad');return;}
    const label=filter==='all'||filter==='closed'?'全部已关闭区域':(V178_CLOSE_REASONS[filter]||filter);
    if(!window.confirm(`将永久移除 ${targets.length} 个“${label}”区域。该操作可通过历史撤回，是否继续？`))return;
    pushHistory('批量清理关闭区域前',true);const ids=new Set(targets.map(r=>r.id));
    s.result.regions=(s.result.regions||[]).filter(r=>!ids.has(r.id));s.selected=(s.selected||[]).filter(id=>!ids.has(id));
    if(ids.has(s.activeId))s.activeId=(s.result.regions||[])[0]?.id||'';
    auditAction('批量清理关闭区域',null,`${label} · ${targets.length} 个`);pushHistory(`批量清理关闭区域 ${targets.length} 个`,true);rerender();toast(`已清理 ${targets.length} 个关闭区域`,'ok');
  }
  const V193_TEMPLATE_STORAGE='ai_v193_region_templates';
  const V193_BUILTIN_TEMPLATES={
    product_badge:{id:'product_badge',label:'产品角标',name:'产品角标',type:'decoration',mode:'direct_transform',preserveKey:'decoration'},
    title_text:{id:'title_text',label:'标题文字',name:'标题文字',type:'text',mode:'direct_transform',preserveKey:'text'},
    person_face:{id:'person_face',label:'人物面部',name:'人物面部',type:'person',mode:'move_and_repair',preserveKey:'face'}
  };
  const V193_PRESERVE_LABELS={auto:'按区域类型自动',text:'文字内容/字体/版式/颜色',product:'产品造型/包装文字/材质/颜色/比例',face:'身份/面部/毛发/身体完整',background:'主体/文字/构图',decoration:'风格/方向/透明度'};
  function v193LoadCustomTemplates(){try{const rows=JSON.parse(localStorage.getItem(V193_TEMPLATE_STORAGE)||'[]');return Array.isArray(rows)?rows.filter(x=>x&&x.id&&x.label):[];}catch(_e){return[];}}
  function v193SaveCustomTemplates(rows){try{localStorage.setItem(V193_TEMPLATE_STORAGE,JSON.stringify(rows.slice(0,30)));return true;}catch(_e){return false;}}
  function v193TemplateMap(){const custom=v193LoadCustomTemplates();return{...V193_BUILTIN_TEMPLATES,...Object.fromEntries(custom.map(x=>[x.id,x]))};}
  function v193ApplyRegionTemplate(id){const s=state(),tpl=v193TemplateMap()[id];if(!tpl)return false;s.v193AddRegionTemplate=id;s.v192AddRegionName=tpl.name||tpl.label||'';s.v192AddRegionType=META[tpl.type]?tpl.type:'decoration';s.correctionAddType=s.v192AddRegionType;s.v193AddRegionMode=['direct_transform','move_and_repair','local_regenerate'].includes(tpl.mode)?tpl.mode:META[s.v192AddRegionType].defaultMode;s.v193AddRegionPreserveKey=V193_PRESERVE_LABELS[tpl.preserveKey]?tpl.preserveKey:'auto';return true;}
  function v193TemplateOptions(s){const custom=v193LoadCustomTemplates(),group=(label,rows)=>rows.length?`<optgroup label="${esc(label)}">${rows.map(t=>`<option value="${esc(t.id)}" ${s.v193AddRegionTemplate===t.id?'selected':''}>${esc(t.label)}</option>`).join('')}</optgroup>`:'';return `<option value="custom" ${s.v193AddRegionTemplate==='custom'?'selected':''}>自定义创建（手动选择类型）</option>${group('内置模板',Object.values(V193_BUILTIN_TEMPLATES))}${group('我的模板',custom)}`;}
  function v194TemplateLabel(id){if(id==='custom')return'自定义创建';const tpl=v193TemplateMap()[id];return tpl?.label||'';}
  function v196TypeFieldHtml(s,disabled){
    const type=META[s.v192AddRegionType]?s.v192AddRegionType:'text',meta=META[type]||META.text,isCustom=s.v193AddRegionTemplate==='custom';
    if(isCustom)return `<label><span>区域类型</span><select data-v192-add-region-type ${disabled?'disabled':''}>${Object.entries(META).filter(([key])=>key!=='unclassified').map(([key,m])=>`<option value="${key}" ${type===key?'selected':''}>${esc(m.label)}</option>`).join('')}</select></label>`;
    return `<label class="v196-readonly-type-wrap"><span>区域类型</span><div class="v196-readonly-type" style="--region-color:${meta.color}"><i></i><div><strong>${esc(meta.label)}</strong><small>由“${esc(v194TemplateLabel(s.v193AddRegionTemplate)||'当前模板')}”自动设置</small></div><em>只读</em></div></label>`;
  }
  function v196TemplateManagerHtml(s,disabled){
    if(!s.v196TemplateManagerOpen)return'';
    const rows=v193LoadCustomTemplates(),selected=String(s.v193AddRegionTemplate||'');
    return `<section class="v196-template-manager"><header><div><b>模板管理</b><small>保存当前配置，或管理已保存的自定义模板</small></div><button type="button" data-v196-template-manager-close aria-label="关闭模板管理">×</button></header><button type="button" class="v196-template-save primary" data-v196-template-save ${disabled?'disabled':''}>＋ 保存当前配置为模板</button><div class="v196-template-list">${rows.length?rows.map(t=>{const meta=META[t.type]||META.decoration;return `<article class="${selected===t.id?'on':''}" style="--region-color:${meta.color}"><i></i><div><b>${esc(t.label)}</b><small>${esc(meta.label)} · ${esc(t.name||'自动命名')}</small></div><button type="button" data-v196-template-use="${esc(t.id)}" ${disabled?'disabled':''}>使用</button><button type="button" class="danger" data-v196-template-delete="${esc(t.id)}" ${disabled?'disabled':''}>删除</button></article>`;}).join(''):`<p>还没有自定义模板。可将当前名称、类型和隐藏规则保存为模板。</p>`}</div></section>`;
  }
  function v194PreflightHtml(s){
    if(!s.v194RegionPreflightOpen)return'';
    const d=s.v194RegionDraft||{},meta=META[d.type]||META.text;
    return `<div class="v194-confirm-card preflight"><header><i>1</i><div><b>确认区域信息</b><small>开始框选前，请确认区域名称和区域创建模板均已填写正确。</small></div></header><dl><div><dt>区域名称</dt><dd>${esc(d.name||'未填写')}</dd></div><div><dt>创建模板</dt><dd>${esc(d.templateLabel||'未选择')}</dd></div><div><dt>区域类型</dt><dd>${esc(meta.label)}</dd></div></dl><div class="v194-confirm-actions"><button type="button" data-v194-preflight-cancel>返回修改</button><button type="button" class="primary" data-v194-preflight-confirm>确认并开始框选</button></div></div>`;
  }
  function v194PendingConfirmHtml(s){
    const b=s.v194PendingRegionBox,d=s.v194RegionDraft||{};if(!b)return'';
    const area=Math.max(0,b.width)*Math.max(0,b.height)*100;
    return `<div class="v194-confirm-card selection"><header><i>2</i><div><b>是否确认当前框选？</b><small>确认后才会将该区域加入“区域对象”；取消或重新框选不会产生新区域。</small></div></header><dl><div><dt>区域名称</dt><dd>${esc(d.name||'')}</dd></div><div><dt>创建模板</dt><dd>${esc(d.templateLabel||'')}</dd></div></dl><div class="v194-selection-metrics"><span>X ${(b.x*100).toFixed(1)}%</span><span>Y ${(b.y*100).toFixed(1)}%</span><span>W ${(b.width*100).toFixed(1)}%</span><span>H ${(b.height*100).toFixed(1)}%</span><strong>面积 ${area.toFixed(1)}%</strong></div><div class="v194-confirm-actions two"><button type="button" data-v194-region-redraw>重新框选</button><button type="button" class="primary" data-v194-region-confirm>确认创建区域</button></div></div>`;
  }
  let v198StartHandledAt=0;
  function v198NameReady(value){return String(value==null?'':value).trim().length>0;}
  function v198UpdateNameFieldDom(input){
    if(!input)return false;const ready=v198NameReady(input.value),panel=input.closest('.v192-add-region-panel'),status=panel?.querySelector('[data-v198-name-status]');let start=panel?.querySelector('[data-v192-add-region-start]'),hint=panel?.querySelector('.v199-name-required-hint');
    input.setAttribute('aria-invalid',ready?'false':'true');input.classList.toggle('is-valid',ready);input.classList.toggle('is-invalid',!ready);
    if(status){status.textContent=ready?'已填写':'必填';status.classList.toggle('is-complete',ready);status.classList.toggle('is-required',!ready);}
    /* V20：主按钮按有效状态即时出现/隐藏，不通过重绘替换输入框。 */
    if(ready&&!start&&hint){const wrap=document.createElement('div');wrap.className='v192-add-region-actions v196-single-primary';wrap.innerHTML='<button type="button" class="primary is-ready" data-v192-add-region-start>确认信息并开始框选</button>';hint.replaceWith(wrap);start=wrap.querySelector('[data-v192-add-region-start]');}
    else if(!ready&&start&&!panel?.classList.contains('is-adding')){const wrap=start.closest('.v192-add-region-actions');const next=document.createElement('div');next.className='v199-name-required-hint';next.textContent='请填写区域名称后继续';wrap?.replaceWith(next);start=null;}
    if(start){start.classList.toggle('is-ready',ready);start.setAttribute('aria-label',ready?'确认信息并开始框选':'请先填写区域名称');}
    return ready;
  }
  let v204DrawingWatchdog=0,v2051BridgeRaf=0,v2051BridgeDrag=null;
  function v204EnsureDrawingSurface(shell){
    if(!shell)return null;
    let surface=shell.querySelector('[data-v204-drawing-surface]');
    if(!surface){
      surface=document.createElement('div');surface.className='v204-drawing-surface';
      surface.dataset.v204DrawingSurface='true';surface.setAttribute('aria-hidden','true');shell.appendChild(surface);
    }
    return surface;
  }
  function v2051Toast(text,type){try{toast(text,type);}catch(_e){try{window.setActionStatus?.(type==='bad'?'error':'success',text,false);}catch(_e2){}}}
  function v2051ImageElements(){
    const overlay=document.getElementById('v15-ocr-overlay'),stage=overlay?.querySelector('.v15-ocr-stage'),shell=stage?.querySelector('[data-v152-image-shell]'),img=shell?.querySelector('img');
    return{overlay,stage,shell,img};
  }
  function v2051NormalizedPoint(ev,rect){
    return{x:Math.max(0,Math.min(1,(ev.clientX-rect.left)/Math.max(1,rect.width))),y:Math.max(0,Math.min(1,(ev.clientY-rect.top)/Math.max(1,rect.height)))};
  }
  function v2051RenderDrag(bridge,box){
    const sel=bridge?.querySelector('[data-v2051-selection]'),label=bridge?.querySelector('[data-v2051-selection-label]');if(!sel)return;
    sel.hidden=false;Object.assign(sel.style,{left:(box.x*100)+'%',top:(box.y*100)+'%',width:(box.width*100)+'%',height:(box.height*100)+'%'});
    if(label)label.textContent=`${(box.width*100).toFixed(1)}% × ${(box.height*100).toFixed(1)}%`;
  }
  function v2051ClearDrag(bridge){
    v2051BridgeDrag=null;const sel=bridge?.querySelector('[data-v2051-selection]');if(sel){sel.hidden=true;sel.removeAttribute('style');}
  }
  function v2051FinishDrawing(box){
    const s=state();if(!s||!s.open)return false;
    if(!box||box.width<.012||box.height<.012){v2051ClearDrag(document.getElementById('v2051-drawing-bridge'));v2051Toast('新增区域太小，请重新框选','bad');return false;}
    s.v194PendingRegionBox={x:box.x,y:box.y,width:box.width,height:box.height};s.correctionAddMode=false;s.v199CreationStep='confirm';s.v194RegionPreflightOpen=false;
    v204DisarmDrawingDom();
    if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else rerender();
    v2051Toast('框选完成，请在“区域”功能栏确认后创建','ok');return true;
  }
  function v2051BindBridge(bridge){
    if(!bridge||bridge.dataset.v2051Bound==='true')return bridge;bridge.dataset.v2051Bound='true';
    bridge.addEventListener('pointerdown',ev=>{
      const s=state();if(!s?.open||!s.correctionAddMode||s.v199CreationStep!=='drawing')return;
      if(ev.button!==undefined&&ev.button!==0)return;ev.preventDefault();ev.stopImmediatePropagation();
      const rect=bridge.getBoundingClientRect();if(rect.width<2||rect.height<2)return;
      const p=v2051NormalizedPoint(ev,rect);v2051BridgeDrag={pointerId:ev.pointerId,rect,start:p,box:{x:p.x,y:p.y,width:.001,height:.001}};
      try{bridge.setPointerCapture?.(ev.pointerId);}catch(_e){}v2051RenderDrag(bridge,v2051BridgeDrag.box);
    },true);
    bridge.addEventListener('pointermove',ev=>{
      const d=v2051BridgeDrag;if(!d||d.pointerId!==ev.pointerId)return;ev.preventDefault();ev.stopImmediatePropagation();
      const p=v2051NormalizedPoint(ev,d.rect),a=d.start;d.box={x:Math.min(a.x,p.x),y:Math.min(a.y,p.y),width:Math.abs(p.x-a.x),height:Math.abs(p.y-a.y)};v2051RenderDrag(bridge,d.box);
    },true);
    bridge.addEventListener('pointerup',ev=>{
      const d=v2051BridgeDrag;if(!d||d.pointerId!==ev.pointerId)return;ev.preventDefault();ev.stopImmediatePropagation();
      try{bridge.releasePointerCapture?.(ev.pointerId);}catch(_e){}v2051BridgeDrag=null;v2051FinishDrawing(d.box);
    },true);
    const cancel=ev=>{const d=v2051BridgeDrag;if(!d||d.pointerId!==ev.pointerId)return;ev.preventDefault();ev.stopImmediatePropagation();v2051ClearDrag(bridge);v2051Toast('框选已取消，请重新拖动','bad');};
    bridge.addEventListener('pointercancel',cancel,true);bridge.addEventListener('lostpointercapture',ev=>{if(v2051BridgeDrag&&v2051BridgeDrag.pointerId===ev.pointerId)v2051ClearDrag(bridge);},true);
    bridge.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopImmediatePropagation();},true);
    return bridge;
  }
  function v2051EnsureDrawingBridge(){
    const s=state(),{overlay,stage,shell,img}=v2051ImageElements();if(!s||!s.open||!s.correctionAddMode||s.v199CreationStep!=='drawing'||!overlay||!stage||!shell||!img)return null;
    const rect=img.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    let bridge=document.getElementById('v2051-drawing-bridge');
    if(!bridge){
      bridge=document.createElement('div');bridge.id='v2051-drawing-bridge';bridge.className='v2051-drawing-bridge';bridge.dataset.v2051DrawingBridge='true';bridge.tabIndex=0;
      bridge.setAttribute('role','application');bridge.setAttribute('aria-label','拖动鼠标框选新区域');
      bridge.innerHTML='<div class="v2051-drawing-instruction">按住鼠标拖动框选新区域</div><div class="v2051-live-selection" data-v2051-selection hidden><span data-v2051-selection-label></span></div>';
      document.body.appendChild(bridge);v2051BindBridge(bridge);
    }
    Object.assign(bridge.style,{left:`${Math.round(rect.left*100)/100}px`,top:`${Math.round(rect.top*100)/100}px`,width:`${Math.round(rect.width*100)/100}px`,height:`${Math.round(rect.height*100)/100}px`,display:'block'});
    bridge.dataset.v2051ImageRect=JSON.stringify({left:rect.left,top:rect.top,width:rect.width,height:rect.height});
    return bridge;
  }
  function v2051BridgeLoop(){
    v2051BridgeRaf=0;const s=state();if(!s||!s.open||!s.correctionAddMode||s.v199CreationStep!=='drawing')return;
    v2051EnsureDrawingBridge();v2051BridgeRaf=requestAnimationFrame(v2051BridgeLoop);
  }
  function v2051StartBridgeLoop(){if(!v2051BridgeRaf)v2051BridgeRaf=requestAnimationFrame(v2051BridgeLoop);}
  function v204DisarmDrawingDom(){
    clearTimeout(v204DrawingWatchdog);v204DrawingWatchdog=0;if(v2051BridgeRaf)cancelAnimationFrame(v2051BridgeRaf);v2051BridgeRaf=0;v2051BridgeDrag=null;
    document.documentElement.classList.remove('v199-region-drawing','v204-region-drawing','v2051-region-drawing');document.body.classList.remove('v199-region-drawing','v204-region-drawing','v2051-region-drawing');
    document.getElementById('v2051-drawing-bridge')?.remove();
    const overlay=document.getElementById('v15-ocr-overlay');overlay?.classList.remove('v204-region-drawing-active','v2051-region-drawing-active');
    overlay?.querySelectorAll('[data-v204-drawing-surface]').forEach(el=>el.remove());overlay?.querySelectorAll('[data-v152-image-shell].v198-drawing-ready').forEach(shell=>shell.classList.remove('v198-drawing-ready'));
    overlay?.querySelectorAll('.v15-ocr-stage[data-v199-drawing]').forEach(stage=>{delete stage.dataset.v199Drawing;stage.classList.remove('adding-region');stage.removeAttribute('aria-label');});
    window.__V2051_DRAWING_LOCK__=null;
  }
  window.__V204_DISARM_DRAWING_DOM__=v204DisarmDrawingDom;window.__V2051_DISARM_DRAWING__=v204DisarmDrawingDom;
  window.__V2051_DRAWING_DIAGNOSTICS__=()=>{const st=state(),els=v2051ImageElements(),bridge=document.getElementById('v2051-drawing-bridge');return{version:'V24',open:!!st?.open,step:st?.v199CreationStep||'',addMode:!!st?.correctionAddMode,hasOverlay:!!els.overlay,hasStage:!!els.stage,hasShell:!!els.shell,hasImage:!!els.img,hasBridge:!!bridge,bridgeRect:bridge?bridge.getBoundingClientRect().toJSON?.()||null:null,lastLock:window.__V2051_DRAWING_LOCK__||null};};
  window.__V2051_DRAWING_TEST__={ensureBridge:v2051EnsureDrawingBridge,finishDrawing:v2051FinishDrawing,disarm:v204DisarmDrawingDom};
  window.__V2051_ARM_DRAWING__=()=>{const st=state();if(!st||!st.open)return false;st.v192AddRegionOpen=true;st.correctionAddMode=true;st.v199CreationStep='drawing';st.correctionMode=false;st.focusMode=false;st.selectionMode=false;if(!st.v194RegionDraft)st.v194RegionDraft={name:String(st.v192AddRegionName||'自由区域').trim()||'自由区域',type:META[st.v192AddRegionType]?st.v192AddRegionType:'text',templateId:String(st.v193AddRegionTemplate||'custom'),templateLabel:v194TemplateLabel(st.v193AddRegionTemplate)||'自定义创建',mode:st.v193AddRegionMode||'direct_transform',preserve:(window.__V193_PRESERVE_FOR__?.(st,st.v192AddRegionType)||[...(DEFAULT_PRESERVE[st.v192AddRegionType]||[])])};if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else rerender();queueMicrotask(()=>v199VerifyDrawingMode(0));requestAnimationFrame(()=>v199VerifyDrawingMode(0));return true;};
  function v204StartDrawingWatchdog(attempt=0){
    clearTimeout(v204DrawingWatchdog);v204DrawingWatchdog=0;const s=state();if(!s||!s.open||!s.correctionAddMode||s.v199CreationStep!=='drawing')return;
    v199ApplyDrawingDom();v204DrawingWatchdog=setTimeout(()=>v204StartDrawingWatchdog(Math.min(99,attempt+1)),attempt<6?70:260);
  }
  function v199ApplyDrawingDom(){
    const s=state();if(!s||!s.open||!s.correctionAddMode||s.v199CreationStep!=='drawing'){v204DisarmDrawingDom();return false;}
    const {overlay,stage,shell}=v2051ImageElements();document.documentElement.classList.add('v199-region-drawing','v204-region-drawing','v2051-region-drawing');document.body.classList.add('v199-region-drawing','v204-region-drawing','v2051-region-drawing');
    overlay?.classList.add('v204-region-drawing-active','v2051-region-drawing-active');if(stage){stage.classList.add('adding-region');stage.dataset.v199Drawing='true';stage.setAttribute('aria-label','拖动鼠标框选新区域');}
    if(shell){shell.classList.add('v198-drawing-ready');shell.setAttribute('tabindex','-1');v204EnsureDrawingSurface(shell);}
    const bridge=v2051EnsureDrawingBridge();v2051StartBridgeLoop();try{bridge?.focus({preventScroll:true});}catch(_e){}
    window.__V2051_DRAWING_LOCK__={active:!!bridge,startedAt:window.__V2051_DRAWING_LOCK__?.startedAt||Date.now(),step:'drawing'};return !!(stage&&shell&&bridge);
  }
  function v199VerifyDrawingMode(attempt=0){
    const s=state();if(!s||!s.open||s.v199CreationStep!=='drawing'){v204DisarmDrawingDom();return;}
    s.v192AddRegionOpen=true;s.correctionAddMode=true;s.correctionMode=false;s.focusMode=false;s.selectionMode=false;const ready=v199ApplyDrawingDom();
    if((!ready||attempt<5)&&attempt<12)setTimeout(()=>v199VerifyDrawingMode(attempt+1),45+attempt*35);if(ready)v204StartDrawingWatchdog(0);
  }
  const v2051SyncBridge=()=>{const s=state();if(s?.open&&s.correctionAddMode&&s.v199CreationStep==='drawing')requestAnimationFrame(()=>v2051EnsureDrawingBridge());};
  window.addEventListener('resize',v2051SyncBridge,true);document.addEventListener('scroll',v2051SyncBridge,true);
  function v198BeginRegionDrawing(){
    const s=state();if(!s||!s.open)return false;
    if(s.correctionAddMode&&s.v199CreationStep==='drawing'){v199VerifyDrawingMode(0);return true;}
    const now=Date.now();if(now-v198StartHandledAt<120)return true;v198StartHandledAt=now;
    const overlay=document.getElementById('v15-ocr-overlay'),panel=overlay?.querySelector('.v192-add-region-panel'),nameInput=panel?.querySelector('[data-v192-add-region-name]'),templateSelect=panel?.querySelector('[data-v193-add-region-template]'),typeSelect=panel?.querySelector('[data-v192-add-region-type]');
    const name=String(nameInput?.value??s.v192AddRegionName??'').trim();s.v192AddRegionName=name;v198UpdateNameFieldDom(nameInput);
    if(!s.src){toast('请先上传或同步需要编辑的图片','bad');return false;}
    if(!name){panel?.classList.remove('v198-validation-shake');void panel?.offsetWidth;panel?.classList.add('v198-validation-shake');toast('请先填写区域名称，再开始框选','bad');nameInput?.focus({preventScroll:true});return false;}
    if(!s.result)s.result={model:'manual-region',regions:[],documentBlocks:[],raw:{image:{}}};
    const templateId=String(templateSelect?.value??s.v193AddRegionTemplate??'').trim();
    if(!templateId){toast('请先选择区域创建模板','bad');templateSelect?.focus({preventScroll:true});return false;}
    const enteredName=name;
    if(templateId!=='custom'&&!v193ApplyRegionTemplate(templateId)){toast('当前区域创建模板不可用，请重新选择','bad');return false;}
    s.v192AddRegionName=enteredName;s.v193AddRegionTemplate=templateId;
    const type=String(typeSelect?.value||s.v192AddRegionType||'text');s.v192AddRegionType=META[type]?type:'text';s.correctionAddType=s.v192AddRegionType;
    s.v194RegionDraft={name:enteredName,type:s.v192AddRegionType,templateId,templateLabel:v194TemplateLabel(templateId)||'自定义创建',mode:s.v193AddRegionMode,preserve:(window.__V193_PRESERVE_FOR__?.(s,s.v192AddRegionType)||[...(DEFAULT_PRESERVE[s.v192AddRegionType]||[])])};
    s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.v192AddRegionOpen=true;s.correctionAddMode=true;s.v199CreationStep='drawing';s.correctionMode=false;s.focusMode=false;s.moreToolsOpen=false;s.selectionMode=false;s.v196TemplateManagerOpen=false;
    if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else rerender();
    queueMicrotask(()=>v199VerifyDrawingMode(0));requestAnimationFrame(()=>v199VerifyDrawingMode(0));setTimeout(()=>v199VerifyDrawingMode(1),80);setTimeout(()=>v199VerifyDrawingMode(2),220);setTimeout(()=>v204StartDrawingWatchdog(0),320);
    toast('已进入框选模式：请在中间画布按住鼠标拖出新区域','ok');return true;
  }
  window.__V198_BEGIN_REGION_DRAWING__=v198BeginRegionDrawing;
  window.__V198_UPDATE_REGION_NAME_STATE__=v198UpdateNameFieldDom;
  function v199CreationProgressHtml(nameReady,adding,pending){
    const current=pending?3:adding?2:1;
    const step=(n,label)=>`<div class="${current===n?'current':current>n?'done':''}"><i>${current>n?'✓':n}</i><span>${label}</span></div>`;
    return `<div class="v199-create-progress" aria-label="创建区域进度">${step(1,'填写信息')}${step(2,'画布框选')}${step(3,'确认创建')}</div>`;
  }
  function v198HelpHtml(s,adding,pending){
    const summary=adding?'已进入框选模式：在画布拖动鼠标创建区域':pending?'框选完成：确认后才会创建区域':'填写名称并选择模板后，在画布框选区域';
    const details=adding?'在中间“识别区域预览”中按住鼠标并拖动，松开后会显示框选尺寸和面积；此时区域尚未创建。':pending?'检查区域名称、模板、坐标与面积占比。点击“确认创建区域”后才会写入区域对象、历史记录和任务 JSON。':'区域名称必须填写；模板会自动设置区域类型与隐藏规则。点击主按钮后立即进入十字光标框选模式。';
    return `<details class="v198-add-help"><summary><span>${esc(summary)}</span><b aria-hidden="true">?</b></summary><div>${esc(details)}</div></details>`;
  }

  function freeRegionPanelHtml(){
    const s=state(),open=!!s.v192AddRegionOpen,adding=!!s.correctionAddMode,pending=!!s.v194PendingRegionBox,locked=adding||pending,nameReady=v198NameReady(s.v192AddRegionName);
    if(!open)return'';
    /* V20：旧版本遗留的预确认状态不再阻断主按钮，主按钮本身即为框选前确认。 */
    if(s.v194RegionPreflightOpen&&!pending)s.v194RegionPreflightOpen=false;
    const primaryAction=pending?'':adding?`<div class="v192-add-region-actions v196-single-primary"><button type="button" class="primary is-ready" data-v192-add-region-start>重新开始框选</button></div>`:nameReady?`<div class="v192-add-region-actions v196-single-primary"><button type="button" class="primary is-ready" data-v192-add-region-start>确认信息并开始框选</button></div>`:`<div class="v199-name-required-hint">请填写区域名称后继续</div>`;
    return `<section class="v192-add-region-panel v193-add-region-panel v194-add-region-panel v196-add-region-panel v198-add-region-panel ${adding?'is-adding':''} ${pending?'has-pending':''}"><header><div><b>自由添加区域</b><small>${adding?'请在中间识别预览中拖出矩形区域':pending?'框选已完成，请确认后再创建区域':'模板自动应用；填写名称后即可进入画布框选'}</small></div><button type="button" data-v192-add-region-close aria-label="取消并关闭自由添加区域" title="取消并关闭">×</button></header>${v199CreationProgressHtml(nameReady,adding,pending)}<div class="v193-template-row v196-template-row"><label><span>区域创建模板</span><select data-v193-add-region-template ${locked?'disabled':''}>${v193TemplateOptions(s)}</select></label><button type="button" class="v196-template-manager-toggle ${s.v196TemplateManagerOpen?'on':''}" data-v196-template-manager-toggle ${locked?'disabled':''}>模板管理</button></div>${v196TemplateManagerHtml(s,locked)}<div class="v192-add-region-fields v193-add-region-fields v194-add-region-fields v196-add-region-fields"><label class="v198-name-field"><span>区域名称 <em class="${nameReady?'is-complete':'is-required'}" data-v198-name-status>${nameReady?'已填写':'必填'}</em></span><input type="text" maxlength="48" value="${esc(s.v192AddRegionName||'')}" placeholder="请输入明确的区域名称" data-v192-add-region-name aria-invalid="${nameReady?'false':'true'}" class="${nameReady?'is-valid':'is-invalid'}" ${locked?'disabled':''}></label>${v196TypeFieldHtml(s,locked)}</div>${v194PendingConfirmHtml(s)}${primaryAction}${v198HelpHtml(s,adding,pending)}</section>`;
  }

  function regionListSignature(){
    const s=state(),rows=initRegions(),audit=s.v155.v179Audit||[];return JSON.stringify({active:s.activeId,selected:s.selected,filter:s.v178CloseFilter,more:s.v179MoreRegionId,addOpen:!!s.v192AddRegionOpen,addName:s.v192AddRegionName,addType:s.v192AddRegionType,addTemplate:s.v193AddRegionTemplate,templateManager:!!s.v196TemplateManagerOpen,addMode:s.v193AddRegionMode,addPreserve:s.v193AddRegionPreserveKey,selectionCoords:!!s.v193SelectionCoordsOpen,adding:!!s.correctionAddMode,preflight:!!s.v194RegionPreflightOpen,pending:s.v194PendingRegionBox,draft:s.v194RegionDraft,audit:audit[0]&&audit[0].id||'',auditCount:audit.length,auditShowAll:!!s.v155.v180AuditShowAll,rows:rows.map(r=>[r.id,r.region_id,r.name,r.type,r.confidence,r.visible,r.locked,r.close_reason,r.z_index,r.sourceBBox,r.targetBBox])});
  }
  function regionMoreMenu(r,selected){
    /* V19：操作菜单由 document.body 级 Portal 渲染，卡片内部不再插入浮层。 */
    return '';
  }
  function regionCardHtml(r,compact=false){
    const s=state(),m=META[r.type]||META.unclassified,b=r.sourceBBox,t=r.targetBBox||calcTarget(r),on=String(s.activeId)===String(r.id),selected=(s.selected||[]).includes(r.id),reason=!selected?closeReasonLabel(r):'',label=esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||m.label);
    if(compact)return `<article class="v179-closed-row ${on?'active':''} ${r.visible===false?'hidden-region':''}" style="--region-color:${m.color}" data-v155-select-region="${esc(r.id)}"><header><input type="checkbox" data-v155-select-check="${esc(r.id)}" ${selected?'checked':''} aria-label="开启区域"><i></i><b>${label}</b><span>${esc(reason)}</span><button type="button" class="v185-icon-action" data-v179-more-toggle="${esc(r.id)}" aria-label="更多" aria-expanded="${String(s.v179MoreRegionId)===String(r.id)}"><span class="v185-action-icon">•••</span><span class="v185-action-text">更多</span></button></header>${regionMoreMenu(r,selected)}</article>`;
    if(!on)return `<article class="v155-left-card v185-compact-region ${selected?'':'v178-region-off'} ${r.visible===false?'hidden-region':''}" style="--region-color:${m.color}" data-v155-select-region="${esc(r.id)}"><header><input type="checkbox" data-v155-select-check="${esc(r.id)}" ${selected?'checked':''} aria-label="${selected?'关闭':'开启'}区域"><i></i><b>${label}</b><span class="v185-type-pill">${esc(m.label)}</span><button type="button" class="v185-icon-action" data-v179-more-toggle="${esc(r.id)}" aria-label="更多" aria-expanded="${String(s.v179MoreRegionId)===String(r.id)}"><span class="v185-action-icon">•••</span><span class="v185-action-text">更多</span></button></header>${regionMoreMenu(r,selected)}</article>`;
    return `<article class="v155-left-card active ${selected?'':'v178-region-off'} ${r.visible===false?'hidden-region':''}" style="--region-color:${m.color}" data-v155-select-region="${esc(r.id)}"><header><input type="checkbox" data-v155-select-check="${esc(r.id)}" ${selected?'checked':''} aria-label="${selected?'关闭':'开启'}区域"><i></i><b>${label}</b><span class="v181-current-pill">当前选中</span><span class="v181-confidence">${Math.round(Number(r.confidence||0)*100)||'—'}%</span></header><div><span>${esc(m.label)}</span><span>占比 ${area(b).toFixed(1)}% → ${area(t).toFixed(1)}%</span><span>层级 ${r.z_index}</span>${!selected?`<span class="v178-close-reason">${esc(reason)}</span>`:''}</div><footer class="${selected?'v184-current-actions':''}">${selected?`<button type="button" class="v184-quick-action" data-v184-quick-locate="${esc(r.id)}" aria-label="定位"><span class="v185-action-icon">⌖</span><span class="v185-action-text">定位</span></button><button type="button" class="v184-quick-action primary" data-v184-quick-adjust="${esc(r.id)}" aria-label="调整"><span class="v185-action-icon">◫</span><span class="v185-action-text">调整</span></button>`:''}<button type="button" class="v185-icon-action" data-v179-more-toggle="${esc(r.id)}" aria-label="更多" aria-expanded="${String(s.v179MoreRegionId)===String(r.id)}"><span class="v185-action-icon">•••</span><span class="v185-action-text">更多</span></button>${regionMoreMenu(r,selected)}</footer></article>`;
  }
  function closedReasonGroups(rows){
    const s=state(),groups=[['misrecognized','误识别'],['duplicate','重复区域'],['defer','暂不处理'],['unmarked','未标记']],openMap=s.v155.v180ClosedExpanded||{};
    return groups.map(([key,label])=>{const subset=rows.filter(r=>key==='unmarked'?!r.close_reason:r.close_reason===key);if(!subset.length)return'';const open=openMap[key]!==false;return `<details class="v179-closed-group" data-v180-closed-group="${key}" ${open?'open':''}><summary><b>${label}</b><span>${subset.length}</span></summary><div>${subset.map(r=>regionCardHtml(r,true)).join('')}</div></details>`;}).join('');
  }
  function regionListLeft(){
    const s=state(),rows=initRegions(),selectedSet=new Set(s.selected||[]),filter=s.v178CloseFilter||'all',enabled=rows.filter(r=>selectedSet.has(r.id)),closed=rows.filter(r=>!selectedSet.has(r.id));
    if(filter==='all'){
      if(!rows.length)return'<div class="v155-left-empty">当前没有区域对象。</div>';
      return `${enabled.length?`<section class="v179-enabled-group"><header><b>已启用区域</b><span>${enabled.length}</span></header>${enabled.map(r=>regionCardHtml(r,false)).join('')}</section>`:''}${closed.length?`<section class="v179-closed-section"><header><b>已关闭区域</b><span>${closed.length}</span></header><p>按关闭原因分组；默认仅显示名称、原因和开关。</p>${closedReasonGroups(closed)}</section>`:''}`;
    }
    const shown=filter==='enabled'?enabled:filter==='closed'?closed:closed.filter(r=>r.close_reason===filter);
    if(!shown.length)return'<div class="v155-left-empty">当前筛选下没有区域对象。</div>';
    return shown.map(r=>regionCardHtml(r,!selectedSet.has(r.id))).join('');
  }
  function enhanceSidebar(){
    const side=$('#v15-ocr-overlay .v15-ocr-sidebar');if(!side)return;let sec=$('#v155-region-list',side);
    if(!sec){sec=document.createElement('div');sec.id='v155-region-list';sec.className='v15-ocr-side-section v155-region-list-section';const first=$('.v15-ocr-side-section',side);first?first.after(sec):side.prepend(sec);}
    const focused=document.activeElement,editingName=!!(focused&&focused.matches&&focused.matches('[data-v192-add-region-name]')&&sec.contains(focused));
    const caret=editingName?{start:focused.selectionStart,end:focused.selectionEnd,direction:focused.selectionDirection,scrollTop:focused.scrollTop}:null;
    const s=state();sec.classList.toggle('v197-add-region-open',!!s.v192AddRegionOpen);if(editingName)s.v192AddRegionName=focused.value;
    const sig=regionListSignature();if(sec.dataset.v178Signature===sig&&sec.querySelector('.v155-left-list'))return;
    sec.dataset.v178Signature=sig;
    sec.innerHTML=`<div class="v155-side-title v192-region-title"><h3>区域对象</h3><span>${initRegions().length} 个</span><button type="button" class="v192-add-region-toggle ${s.v192AddRegionOpen?'on':''}" data-v192-add-region-toggle><b>＋</b>${s.v192AddRegionOpen?'收起添加':'添加区域'}</button></div>${freeRegionPanelHtml()}<div class="v178-region-tools"><select data-v178-close-filter aria-label="区域筛选"><option value="all" ${s.v178CloseFilter==='all'?'selected':''}>全部区域</option><option value="enabled" ${s.v178CloseFilter==='enabled'?'selected':''}>仅已启用</option><option value="closed" ${s.v178CloseFilter==='closed'?'selected':''}>全部已关闭</option><option value="misrecognized" ${s.v178CloseFilter==='misrecognized'?'selected':''}>误识别</option><option value="duplicate" ${s.v178CloseFilter==='duplicate'?'selected':''}>重复区域</option><option value="defer" ${s.v178CloseFilter==='defer'?'selected':''}>暂不处理</option></select><button type="button" data-v178-batch-clean>清理筛选项</button></div><div class="v155-left-list">${regionListLeft()}</div>${auditPanelHtml()}`;
    if(editingName){const restore=()=>{const next=sec.querySelector('[data-v192-add-region-name]');if(!next||next.disabled)return;next.value=s.v192AddRegionName||'';try{next.focus({preventScroll:true});next.setSelectionRange(caret.start,caret.end,caret.direction||'none');next.scrollTop=caret.scrollTop||0;}catch(_e){next.focus();}};queueMicrotask(restore);}
  }
  window.__V179_REFRESH_REGION_LIST__=enhanceSidebar;
  window.__V195_REGION_LIST_SIGNATURE__=regionListSignature;
  function v197RevealAddRegionPanel(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const overlay=document.getElementById('v15-ocr-overlay'),side=overlay?.querySelector('.v15-ocr-sidebar'),panel=overlay?.querySelector('.v192-add-region-panel');
      if(!side||!panel)return;
      const sideRect=side.getBoundingClientRect(),panelRect=panel.getBoundingClientRect();
      if(panelRect.top<sideRect.top+48||panelRect.bottom>sideRect.bottom-12){
        const target=Math.max(0,side.scrollTop+(panelRect.top-sideRect.top)-58);
        side.scrollTo({top:target,behavior:'auto'});
      }
    }));
  }
  window.__V197_REVEAL_ADD_REGION_PANEL__=v197RevealAddRegionPanel;

  function sourceGhost(r,i){if(!transformChanged(r)||state().v155.sourceGhost===false)return'';const b=r.sourceBBox,m=META[r.type]||META.unclassified;return `<div class="v155-source-ghost" style="--region-color:${m.color};left:${b.x*100}%;top:${b.y*100}%;width:${b.width*100}%;height:${b.height*100}%"><span>原位 ${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</span></div>`;}
  function targetBox(r,i){if(r.visible===false)return'';const t=r.targetBBox||calcTarget(r),m=META[r.type]||META.unclassified,a=ANCHORS.center,sel=(state().selected||[]).includes(r.id),activeOn=state().activeId===r.id&&sel,scale=Number(r.transform&&r.transform.scale_pct||100);return `<div class="v155-target-box ${activeOn?'active':''} ${sel?'':'off'} ${r.locked?'locked':''}" style="--region-color:${m.color};left:${t.x*100}%;top:${t.y*100}%;width:${t.width*100}%;height:${t.height*100}%;transform:rotate(${Number(r.transform.rotation_deg)||0}deg);transform-origin:${a[0]*100}% ${a[1]*100}%" data-v155-target-box="${esc(r.id)}"><span>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||m.label)}</span>${activeOn?`<i class="v168-target-handle nw" data-v168-target-handle="nw"></i><i class="v168-target-handle ne" data-v168-target-handle="ne"></i><i class="v168-target-handle sw" data-v168-target-handle="sw"></i><i class="v168-target-handle se" data-v168-target-handle="se"></i><div class="v168-region-readout"><b>X ${(t.x*100).toFixed(1)}%</b><b>Y ${(t.y*100).toFixed(1)}%</b><b>W ${(t.width*100).toFixed(1)}%</b><b>H ${(t.height*100).toFixed(1)}%</b><b>S ${scale.toFixed(1)}%</b></div>`:''}</div>`;}
  function guidesHtml(r){if(!r||state().v155.guides===false)return'';const t=r.targetBBox||calcTarget(r),c=center(t);return `<div class="v155-guide vertical" style="left:${c.x*100}%"></div><div class="v155-guide horizontal" style="top:${c.y*100}%"></div><div class="v155-safe-area"></div>`;}
  function enhanceLocalMenu(){
    const pop=$('#v15-ocr-overlay .v154-local-pop');if(!pop)return;
    if(!pop.querySelector('[data-v191-confirm-local]')){
      const b=document.createElement('button');b.type='button';b.className='v15-ocr-btn';b.dataset.v191ConfirmLocal='';b.textContent='确定选区';
      const run=pop.querySelector('[data-v152-run-local]');run?pop.insertBefore(b,run):pop.appendChild(b);
    }
  }

  function enhanceCanvas(){const shell=$('#v15-ocr-overlay [data-v152-image-shell]');if(!shell)return;const s=state(),rows=initRegions();$$('.v15-region-box',shell).forEach(el=>el.classList.toggle('v155-native-hidden',!s.correctionMode));let layer=$('.v155-transform-layer',shell);if(s.correctionMode){if(layer)layer.remove();const ar=active();if(ar){const native=$(`[data-v154-region-box="${CSS.escape(ar.id)}"]`,shell);if(native){['n','e','s','w'].forEach(k=>{if(!native.querySelector(`[data-v154-region-handle="${k}"]`)){const i=document.createElement('i');i.className=`v154-edge ${k}`;i.dataset.v154RegionHandle=k;native.appendChild(i);}});}}return;}
    if(!layer){layer=document.createElement('div');layer.className='v155-transform-layer';shell.appendChild(layer);}layer.innerHTML=rows.map((r,i)=>sourceGhost(r,i)+targetBox(r,i)).join('')+guidesHtml(active());
  }

  function slider(id,label,min,max,step,value,suffix){return `<label class="v155-slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${Number(value)}" data-v155-transform="${id}"><input type="number" min="${min}" max="${max}" step="${step}" value="${Number(value)}" data-v155-transform-number="${id}"><em>${suffix}</em></label>`;}
  function anchorGrid(r){return `<div class="v155-anchor-grid">${Object.keys(ANCHORS).map(k=>`<button type="button" class="${r.transform.anchor===k?'on':''}" title="${anchorLabel(k)}" data-v155-anchor="${k}">${anchorLabel(k)}</button>`).join('')}</div>`;}
  function templateButtons(r){const sets={
    text:[['shrink20','缩小文字20%'],['enlarge20','放大文字20%'],['right5','向右移动5%'],['down5','整体下移5%'],['clarity','优化文字清晰度']],
    product:[['shrink10','主体缩小10%'],['enlarge10','主体放大10%'],['right5','向右移动5%'],['bottom','底部对齐'],['center','产品居中']],
    person:[['enlarge10','主体放大10%'],['toward','向产品靠近'],['avoid','减少遮挡'],['face','保持面部不变'],['body','保留四肢/毛发']],
    background:[['extend','扩展背景'],['repair','修复空洞'],['simple','降低复杂度'],['tone','统一色调'],['depth','增强空间层次']],
    decoration:[['opacity','降低透明度'],['behind','移到主体后方'],['shrink20','缩小20%'],['reduce','减少数量'],['direction','保持光效方向']],
    unclassified:[['confirm','确认区域类型']]
  };return `<div class="v155-template-row">${(sets[r.type]||sets.unclassified).map(([k,l])=>`<button type="button" data-v155-template="${k}">${l}</button>`).join('')}</div>`;}
  function referenceOptions(r,value){return `<option value="">选择参考区域</option>${initRegions().filter(x=>x.id!==r.id).map(x=>`<option value="${esc(x.id)}" ${String(value||'')===String(x.id)?'selected':''}>${esc(window.__V221_REGION_NAME__?.(x)||x.name||x.label||'区域')}</option>`).join('')}`;}
  function miniViewForRegion(s,r){
    const d={showSource:true,zoom:1,panX:0,panY:0,sourceOpacity:.72,targetOpacity:.88},v=s.v155||(s.v155={}),key=String(r&&r.id!=null?r.id:s.activeId||'');
    if(!v.v187MiniViews||typeof v.v187MiniViews!=='object'||Array.isArray(v.v187MiniViews))v.v187MiniViews={};
    if(key&&!v.v187MiniViews[key])v.v187MiniViews[key]=Object.assign({},d);
    const view=Object.assign({},d,key?v.v187MiniViews[key]:v.v162Mini||{});
    view.zoom=Math.max(1,Math.min(6,Number(view.zoom)||1));view.panX=Number(view.panX)||0;view.panY=Number(view.panY)||0;
    view.sourceOpacity=Math.max(.08,Math.min(1,Number(view.sourceOpacity)||.72));view.targetOpacity=Math.max(.12,Math.min(1,Number(view.targetOpacity)||.88));
    if(key)v.v187MiniViews[key]=view;v.v162Mini=view;return view;
  }
  function miniCorrectionPanel(s,r){
    const mini=miniViewForRegion(s,r),src=s.src||'',b=r.sourceBBox||baseBox(r),t=r.targetBBox||calcTarget(r),m=META[r.type]||META.unclassified,changed=transformChanged(r),show=changed&&mini.showSource!==false,raw=s.result&&s.result.raw&&s.result.raw.image||{},iw=Number(raw.width||raw.width_px)||1,ih=Number(raw.height||raw.height_px)||1,edge=boundaryInfo(r);
    const zoom=Math.max(1,Math.min(6,Number(mini.zoom)||1)),panX=Number(mini.panX)||0,panY=Number(mini.panY)||0,sourceOpacity=Math.max(.08,Math.min(1,Number(mini.sourceOpacity)||.72)),targetOpacity=Math.max(.12,Math.min(1,Number(mini.targetOpacity)||.88));
    return `<section class="v160-side-section v162-mini-panel v188-mini-panel"><header><div><b>识别区域校正小图</b><small>默认自适应完整画面；普通滚轮滚动功能栏；Alt + 滚轮缩放小图</small></div><div class="v186-mini-head-tools"><span>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</span><details class="v186-mini-help"><summary aria-label="小图操作帮助">?</summary><div><b>小图操作</b><p>普通滚轮：滚动右侧功能栏。<br>Alt + 滚轮：围绕指针缩放。<br>空格 + 拖动空白处：平移画布。<br>拖动区域框或四角：校正目标范围。<br>“适应”：重新让完整图片进入可视范围。</p></div></details></div></header><div class="v162-mini-toolbar"><label class="${changed?'':'disabled'}"><input type="checkbox" data-v162-mini-source ${show?'checked':''} ${changed?'':'disabled'}> ${changed?'显示原始框':'未修改，仅显示目标框'}</label><div class="v186-mini-toolbar-actions"><span data-v186-mini-zoom-readout>${Math.round(zoom*100)}%</span><button type="button" data-v186-mini-fit>适应</button><button type="button" data-v162-mini-reset>恢复原始范围</button></div></div><div class="v186-opacity-controls"><label><span>原始框透明度</span><input type="range" min="8" max="100" step="1" value="${Math.round(sourceOpacity*100)}" data-v186-mini-opacity="source"><output>${Math.round(sourceOpacity*100)}%</output></label><label><span>目标框透明度</span><input type="range" min="12" max="100" step="1" value="${Math.round(targetOpacity*100)}" data-v186-mini-opacity="target"><output>${Math.round(targetOpacity*100)}%</output></label></div><div class="v180-mini-boundary ${edge.outside?'danger':''}" data-v180-mini-boundary ${edge.warn?'':'hidden'}><div><b>${edge.outside?'区域已超出画布':'区域接近安全边界'}</b><span>${esc(edge.message)}</span></div><button type="button" data-v180-mini-inside>移回画布</button></div><div class="v162-mini-stage v186-mini-stage v188-fit-mini-stage" style="--v188-image-aspect:${iw}/${ih}" data-v162-mini-stage data-v188-image-width="${iw}" data-v188-image-height="${ih}" tabindex="0" aria-label="小图校正画布"><div class="v186-mini-world" style="--v186-mini-zoom:${zoom};--v186-mini-pan-x:${panX}px;--v186-mini-pan-y:${panY}px" data-v186-mini-world>${src?`<img src="${esc(src)}" alt="小图校正预览" draggable="false">`:''}${show?`<i class="v162-mini-source" style="left:${b.x*100}%;top:${b.y*100}%;width:${b.width*100}%;height:${b.height*100}%;opacity:${sourceOpacity}" data-v186-mini-source-box></i>`:''}<div class="v162-mini-target" style="--region-color:${m.color};--v186-target-opacity:${targetOpacity};left:${t.x*100}%;top:${t.y*100}%;width:${t.width*100}%;height:${t.height*100}%" data-v162-mini-target="${esc(r.id)}"><span>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</span><i data-v162-mini-handle="nw"></i><i data-v162-mini-handle="ne"></i><i data-v162-mini-handle="sw"></i><i data-v162-mini-handle="se"></i></div></div><div class="v186-pan-hint" aria-hidden="true">按住空格拖动以平移</div></div><div class="v162-mini-readout"><span data-v162-mini-value="x">X ${(t.x*100).toFixed(1)}%</span><span data-v162-mini-value="y">Y ${(t.y*100).toFixed(1)}%</span><span data-v162-mini-value="width">W ${(t.width*100).toFixed(1)}%</span><span data-v162-mini-value="height">H ${(t.height*100).toFixed(1)}%</span></div></section>`;
  }
  function advancedPanel(r){
    return `<section class="v160-action-card v161-advanced-main"><header><b>更多参数</b><small>宽度、高度独立调整；旋转不会联动整体缩放</small></header><div class="v161-advanced-grid">${slider('width_pct','宽度',10,200,.1,r.transform.width_pct,'%')}${slider('height_pct','高度',10,200,.1,r.transform.height_pct,'%')}${slider('rotation_deg','旋转',-180,180,.1,r.transform.rotation_deg,'°')}</div></section>`;
  }
  function snapSettingsPanel(s){const x=s.v155.v161Snap,open=!!s.v155.v163SnapAdvanced;return `<section class="v160-side-section v161-snap-panel"><header><div><b>智能吸附与距离标注</b><small>默认只显示总开关与灵敏度；范围设置收进高级项</small></div><span>${x.enabled?'已启用':'已关闭'}</span></header><div class="v161-snap-settings v163-snap-simple"><label class="v160-switch"><input type="checkbox" data-v161-snap-enabled ${x.enabled?'checked':''}><span>启用智能吸附</span><small>拖动时自动吸附并标注距离</small></label><label><span>吸附灵敏度</span><div class="v161-inline-number"><input type="number" min="3" max="30" step="1" value="${Number(x.threshold_px)||9}" data-v161-snap-threshold><i>px</i></div></label><button type="button" class="v163-snap-advanced-toggle" data-v163-snap-advanced>${open?'收起高级吸附设置':'高级吸附设置'}</button>${open?`<div class="v163-snap-advanced"><label class="v160-switch"><input type="checkbox" data-v161-snap-center ${x.canvas_center?'checked':''}><span>画布中心线</span></label><label class="v160-switch"><input type="checkbox" data-v161-snap-thirds ${x.thirds?'checked':''}><span>画布三分线</span></label><label class="v160-switch"><input type="checkbox" data-v161-snap-regions ${x.regions?'checked':''}><span>其他区域边缘与中心点</span></label><label class="v160-switch"><input type="checkbox" data-v161-distance-labels ${x.distance_labels?'checked':''}><span>拖动时显示实时距离</span></label></div>`:''}</div></section>`;}
  function professionalPanel(s,r){s.v155.v161RightTool='correction';s.v155.v161ToolMenuOpen=false;return `<aside class="v160-adjust-side v161-professional-side v179-mini-only"><header class="v161-tool-header v179-mini-header"><div><b>小图校正</b><small>缩略图查看、拖动区域框与四角缩放</small></div></header><div class="v160-side-content">${miniCorrectionPanel(s,r)}</div></aside>`;}
  function historyMenu(s){
    if(!s.v155.v160HistoryOpen)return'';
    const all=(s.v155.history||[]).map((h,i)=>({h,i})),showAll=!!s.v155.v186HistoryShowAll,rows=(showAll?all:all.slice(-5)).reverse();
    return `<div class="v160-history-pop" role="dialog" aria-label="历史记录"><header><div><b>历史记录</b><small>${s.v155.historyIndex+1}/${s.v155.history.length}</small></div><button type="button" data-v160-history-close aria-label="关闭历史">×</button></header><nav><button type="button" data-v155-undo ${s.v155.historyIndex<=0?'disabled':''}>撤回</button><button type="button" data-v155-redo ${s.v155.historyIndex>=s.v155.history.length-1?'disabled':''}>重做</button></nav><div class="v160-history-list">${rows.map(({h,i})=>`<button type="button" class="${i===s.v155.historyIndex?'on':''}" data-v159-history-index="${i}"><b>${esc(h.label||'历史节点')}</b><small>${h.time?new Date(h.time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''}</small></button>`).join('')}</div>${all.length>5?`<button type="button" class="v186-history-more" data-v186-history-toggle>${showAll?'收起到最近五条':`查看全部（${all.length}）`}</button>`:''}</div>`;
  }
  function transformPanel(){
    const s=state(),r=active();
    if(!r||!s.result)return'<div class="v155-transform-empty">请选择一个区域后进行参数化编辑。</div>';
    const b=r.sourceBBox,t=r.targetBBox||calcTarget(r),bc=center(b),tc=center(t),ratio=Math.max(28,Math.min(78,Number(s.v155.v186LayoutRatio)||58));
    return `<section class="v155-transform-panel v159-transform-panel v160-transform-panel v161-transform-panel v185-layout v186-layout"><header class="v160-transform-header"><div><b>参数化编辑 · ${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</b><small>拖动中间分隔条可自由调整参数区与小图区宽度；比例会自动记忆</small></div><div class="v160-header-actions"><button type="button" class="v160-history-trigger ${s.v155.v160HistoryOpen?'on':''}" data-v160-history-toggle>历史 <span>${s.v155.historyIndex+1}/${s.v155.history.length}</span></button></div>${historyMenu(s)}</header><div class="v160-adjust-layout v185-adjust-layout v186-adjust-layout" style="--v186-left-pct:${ratio}%"><main class="v160-adjust-main">${advancedPanel(r)}<section class="v160-primary-card"><header><b>位置与缩放</b><small>拖动滑轨或输入精确数值；宽高不会再互相联动</small></header><div class="v155-transform-grid v159-primary-grid"><div>${slider('move_x_canvas_pct','水平移动',-50,50,.1,r.transform.move_x_canvas_pct,'%')}${slider('move_y_canvas_pct','垂直移动',-50,50,.1,r.transform.move_y_canvas_pct,'%')}${slider('scale_pct','整体缩放',10,200,.1,r.transform.scale_pct,'%')}</div></div></section><div class="v186-coordinate-summary" tabindex="0" aria-label="目标区域坐标详情"><div><b>目标区域</b><span data-v186-coordinate-main>X ${(t.x*100).toFixed(1)} · Y ${(t.y*100).toFixed(1)} · W ${(t.width*100).toFixed(1)} · H ${(t.height*100).toFixed(1)}</span></div><button type="button" aria-label="查看中心点和面积占比">i</button><aside><b>坐标详情</b><p data-v186-coordinate-target>目标中心 ${(tc.x*100).toFixed(1)}, ${(tc.y*100).toFixed(1)} · 面积占比 ${area(t).toFixed(1)}%</p><p>原始 X ${(b.x*100).toFixed(1)} · Y ${(b.y*100).toFixed(1)} · W ${(b.width*100).toFixed(1)} · H ${(b.height*100).toFixed(1)}</p><p>原始中心 ${(bc.x*100).toFixed(1)}, ${(bc.y*100).toFixed(1)} · 面积占比 ${area(b).toFixed(1)}%</p></aside></div></main><button type="button" class="v186-pane-splitter" data-v186-pane-splitter aria-label="拖动调整左右功能区宽度" title="拖动调宽；双击恢复 58%"><i></i><span>${ratio.toFixed(0)}%</span></button>${professionalPanel(s,r)}</div></section>`;
  }


  /* V16：拖动滑轨时只更新现有 DOM，不重建整个参数面板。
     V15.8 每次 input 都执行 enhanceTransformPanel().innerHTML，浏览器正在拖动的 range
     会被替换，导致滑块、数字框及紧邻按钮表现为无法操作。 */
  function updateTransformLive(r){
    const overlay=$('#v15-ocr-overlay');
    if(!overlay||!r)return;
    const t=r.targetBBox||calcTarget(r),a=ANCHORS[r.transform.anchor]||ANCHORS.center;
    const box=$(`[data-v155-target-box="${CSS.escape(String(r.id))}"]`,overlay);
    if(box){
      box.style.left=`${t.x*100}%`;box.style.top=`${t.y*100}%`;
      box.style.width=`${t.width*100}%`;box.style.height=`${t.height*100}%`;
      box.style.transform=`rotate(${Number(r.transform.rotation_deg)||0}deg)`;
      box.style.transformOrigin=`${a[0]*100}% ${a[1]*100}%`;
      const readout=$('.v168-region-readout',box);if(readout){const vals=[['X',t.x*100],['Y',t.y*100],['W',t.width*100],['H',t.height*100],['S',Number(r.transform.scale_pct)||100]];Array.from(readout.querySelectorAll('b')).forEach((el,i)=>{if(vals[i])el.textContent=`${vals[i][0]} ${vals[i][1].toFixed(1)}%`;});}
      const dot=$('.v155-anchor-dot',box);if(dot){dot.style.left=`${a[0]*100}%`;dot.style.top=`${a[1]*100}%`;}
    }
    const c=center(t),vertical=$('.v155-guide.vertical',overlay),horizontal=$('.v155-guide.horizontal',overlay);
    if(vertical)vertical.style.left=`${c.x*100}%`;if(horizontal)horizontal.style.top=`${c.y*100}%`;
    const coordMain=$('[data-v186-coordinate-main]',overlay),coordTarget=$('[data-v186-coordinate-target]',overlay);
    if(coordMain)coordMain.textContent=`X ${(t.x*100).toFixed(1)} · Y ${(t.y*100).toFixed(1)} · W ${(t.width*100).toFixed(1)} · H ${(t.height*100).toFixed(1)}`;
    if(coordTarget)coordTarget.textContent=`目标中心 ${(c.x*100).toFixed(1)}, ${(c.y*100).toFixed(1)} · 面积占比 ${area(t).toFixed(1)}%`;
    const float=$('.v159-canvas-float',box||overlay);if(float){const vals={x:t.x*100,y:t.y*100,width:t.width*100,height:t.height*100,scale:Number(r.transform.scale_pct)||100};Object.entries(vals).forEach(([k,v])=>{const input=$(`[data-v159-float-input="${k}"]`,float);if(input&&document.activeElement!==input)input.value=Number(v).toFixed(1);});}
    const summary=$('.v157-transform-summary small',overlay);
    if(summary)summary.textContent=`水平 ${Number(r.transform.move_x_canvas_pct||0).toFixed(1)}% · 垂直 ${Number(r.transform.move_y_canvas_pct||0).toFixed(1)}% · 缩放 ${Number(r.transform.scale_pct||100).toFixed(1)}%`;
    const host=$('.v155-transform-host',overlay);if(host)host.dataset.v158Live='true';
    updateMiniBoundaryLive(r);
    if(typeof window.__V164_UPDATE_FOCUS_LIVE==='function')window.__V164_UPDATE_FOCUS_LIVE(r,t);
  }
  function enhanceTransformPanel(){
    const preview=$('#v15-ocr-overlay .v15-ocr-preview');if(!preview)return;
    let panel=$('.v155-transform-host',preview);
    if(!panel){panel=document.createElement('div');panel.className='v155-transform-host';const stage=$('.v15-ocr-stage',preview);stage?stage.after(panel):preview.appendChild(panel);}
    let content=$('.v159-transform-content',panel);
    if(!content){content=document.createElement('div');content.className='v159-transform-content';Array.from(panel.children).filter(el=>!el.classList.contains('v157-transform-summary')).forEach(el=>el.remove());panel.appendChild(content);}
    const s=state(),memory=s&&s.v155&&(s.v155.v187PaneScroll||(s.v155.v187PaneScroll={main:0,mini:0}));
    /* V19：任何区域框正在拖动或拉伸时，保留现有小图 DOM，禁止中途重建。 */
    if((transformInteracting||miniDrag||targetDrag)&&content.querySelector('.v160-transform-panel'))return;
    const oldMain=content.querySelector('.v160-adjust-main'),oldMini=content.querySelector('.v160-side-content');
    const keepMain=oldMain?oldMain.scrollTop:Math.max(0,Number(memory&&memory.main)||0);
    const keepMini=oldMini?oldMini.scrollTop:Math.max(0,Number(memory&&memory.mini)||0);
    const markup=transformPanel();
    /* V19：MutationObserver 只负责发现真实状态变化。若输出没有变化，不再重建整个
       调整面板，避免用户拖动滚动条时节点被替换、滚动位置回到顶部，以及小图尺寸被
       重算后产生“突然缩放”的视觉跳变。 */
    if(content.__v189Markup===markup&&content.querySelector('.v160-transform-panel'))return;
    content.innerHTML=markup;content.__v189Markup=markup;
    const restore=()=>{
      const main=content.querySelector('.v160-adjust-main'),mini=content.querySelector('.v160-side-content');
      if(main){const max=Math.max(0,main.scrollHeight-main.clientHeight);main.scrollTop=Math.min(max,Math.max(0,keepMain));}
      if(mini){const max=Math.max(0,mini.scrollHeight-mini.clientHeight);mini.scrollTop=Math.min(max,Math.max(0,keepMini));}
    };
    restore();requestAnimationFrame(()=>{restore();requestAnimationFrame(restore);});
  }

  function simpleStatusLabel(r){
    if(r.status==='applied')return '已应用';
    if(r.status==='editing'||r.review_status==='editing'||transformChanged(r)||r.prompt_override||r.regionTextEdited||r.manualCorrected)return '已修改';
    return '可编辑';
  }
  function promptSummary(text){const value=String(text||'').replace(/\s+/g,' ').trim();return value.length>92?value.slice(0,92)+'…':value||'点击展开 AI 修改指令';}
  function regionMetaEditor(r){
    const s=state(),rows=initRegions().filter(x=>x.id!==r.id),professional=!!s.v155.v169ProfessionalMode;
    const mode=r.execution_mode||'direct_transform';
    const repairVisible=mode==='move_and_repair'||mode==='local_regenerate';
    return `<div class="v168-editor-settings v169-editor-settings">
      <div class="v168-core-grid v169-core-grid">
        <label><span>区域类型</span><select data-v169-region-type>${Object.entries(META).filter(([k])=>k!=='unclassified').map(([k,m])=>`<option value="${k}" ${r.type===k?'selected':''}>${m.label}</option>`).join('')}</select></label>
        <label><span>修改方式</span><select data-v169-mode><option value="direct_transform" ${mode==='direct_transform'?'selected':''}>只调整位置与大小</option><option value="move_and_repair" ${mode==='move_and_repair'?'selected':''}>移动主体并修复背景</option><option value="local_regenerate" ${mode==='local_regenerate'?'selected':''}>重新生成当前区域</option></select></label>
      </div>
      <label class="v168-primary-check"><input type="checkbox" data-v169-lock-aspect ${r.lock_aspect_ratio?'checked':''}><span><b>保持原始比例</b><small>避免文字或主体被横向、纵向拉伸</small></span></label>
      <button type="button" class="v169-professional-toggle ${professional?'on':''}" data-v169-professional-toggle aria-pressed="${professional?'true':'false'}"><span><b>专业模式</b><small>${professional?'已显示蒙版、层级、父子关系与任务 JSON':'关闭时只保留新手核心设置'}</small></span><i>${professional?'开启':'关闭'}</i></button>
      ${professional?`<section class="v169-professional-settings"><header><b>高级设置</b><small>${mode==='direct_transform'?'直接几何变换无需背景修复参数':mode==='move_and_repair'?'主体移动与背景修复参数':'局部重新生成参数'}</small></header>
        <div class="v168-advanced-grid v169-advanced-grid">
          <label><span>蒙版边缘</span><select data-v169-mask-type><option value="hard" ${r.mask.type==='hard'?'selected':''}>清晰硬边</option><option value="soft" ${r.mask.type==='soft'?'selected':''}>柔和软边</option></select></label>
          <label><span>边缘柔化</span><input type="number" min="0" max="64" step="1" value="${Number(r.mask.feather_px)||0}" data-v169-feather><em>px</em></label>
          <label><span>前后层级</span><input type="number" min="0" max="99" step="1" value="${r.z_index}" data-v169-z></label>
          <label><span>跟随区域</span><select data-v169-parent><option value="">不跟随其他区域</option>${rows.map(x=>`<option value="${esc(x.id)}" ${r.parent_id===x.id?'selected':''}>${esc(window.__V221_REGION_NAME__?.(x)||x.name||x.label||'区域')}</option>`).join('')}</select></label>
          ${r.parent_id?`<label class="v168-advanced-check"><input type="checkbox" data-v169-follow-move ${r.follow_move?'checked':''}> 跟随移动</label><label class="v168-advanced-check"><input type="checkbox" data-v169-follow-scale ${r.follow_scale?'checked':''}> 跟随缩放</label>`:''}
        </div>
        ${repairVisible?`<div class="v169-repair-grid"><label><input type="checkbox" data-v169-repair-hole ${r.repair.background_hole?'checked':''}><span><b>修复原位置背景</b><small>主体移动后填补空洞</small></span></label><label><input type="checkbox" data-v169-repair-shadow ${r.repair.rebuild_shadow?'checked':''}><span><b>重建自然阴影</b><small>匹配新位置的接触面</small></span></label><label><input type="checkbox" data-v169-repair-edge ${r.repair.edge_blending?'checked':''}><span><b>边缘融合</b><small>减少抠图和拼接痕迹</small></span></label></div>`:`<div class="v169-mode-hint">当前使用直接几何变换，背景修复、阴影重建和局部重绘参数已自动隐藏。</div>`}
      </section>`:''}
      <p class="v168-editor-note">核心设置会同步到画布、调整参数和 AI 修改指令；专业模式中的数据会同步到任务 JSON。</p>
    </div>`;
  }
  function editPanel(){
    const s=state(),r=active();if(!r)return'<div class="v15-result-empty">选择一个区域后即可开始编辑。</div>';
    const task=regionTask(r),prompt=r.prompt_override||promptFor(r),meta=META[r.type]||META.unclassified;
    const expanded=!!s.v155.v169PromptExpanded,professional=!!s.v155.v169ProfessionalMode,jsonOpen=professional&&!!s.v155.v169JsonExpanded;
    return `<div class="v155-edit-panel v168-edit-panel v169-edit-panel"><div class="v155-panel-title"><div><b>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</b><small>${esc(meta.label)} · ${esc(MODE_LABELS[r.execution_mode])}</small></div><span class="v155-status v169-simple-status">${simpleStatusLabel(r)}</span></div>
      ${regionMetaEditor(r)}
      <section class="v168-prompt-section v169-prompt-section ${expanded?'expanded':'collapsed'}"><button type="button" class="v169-prompt-summary" data-v169-prompt-toggle aria-expanded="${expanded?'true':'false'}"><span><b>AI 修改指令</b><small>${esc(promptSummary(prompt))}</small></span><i>${expanded?'收起':'展开'}</i></button>${expanded?`<div class="v169-prompt-editor"><header><span>可手工补充要求</span><button type="button" data-v169-copy-prompt>复制</button></header><textarea data-v169-prompt>${esc(prompt)}</textarea></div>`:''}</section>
      ${professional?`<button type="button" class="v168-json-toggle v169-json-toggle" data-v169-json-toggle>${jsonOpen?'收起专业信息与任务 JSON':'查看专业信息与任务 JSON'} <i>${jsonOpen?'⌃':'⌄'}</i></button>${jsonOpen?`<section class="v168-json-section v169-json-section"><header><b>Region Task JSON</b><button type="button" data-v169-copy-json>复制</button></header><pre>${esc(JSON.stringify(task,null,2))}</pre><details><summary>内部状态</summary><pre>${esc(JSON.stringify({status:r.status,review_status:r.review_status,confidence:r.confidence,version_id:r.version_id,updated_at:r.updated_at},null,2))}</pre></details></section>`:''}`:''}
    </div>`;
  }
  function enhanceResults(){
    const tabs=$('#v15-ocr-overlay .v15-result-tabs'),content=$('#v15-ocr-overlay .v15-result-content'),s=state();if(!tabs||!content)return;
    const oldQuality=$('[data-v155-view="quality"]',tabs);if(oldQuality)oldQuality.remove();
    let edit=$('[data-v155-view="edit"]',tabs);
    if(!edit){edit=document.createElement('button');edit.type='button';edit.dataset.v155View='edit';edit.textContent='智能编辑';tabs.prepend(edit);}
    $$('button',tabs).forEach(b=>b.classList.remove('on'));
    if(s.v155.view==='edit'){
      edit.classList.add('on');
      /* V18：详情抽屉的 MutationObserver 会高频调用 enhanceResults。
         V18 原逻辑每次都重写 content.innerHTML，导致 Shadow DOM 控件在鼠标按下与
         change/click 之间被销毁：下拉框刚打开就消失，复选框、专业模式和提示词展开
         看起来全部“无响应”。稳定宿主或待接管的旧面板存在时必须保留 DOM。 */
      const stableHost=$('.v17-smart-editor-host',content);
      const legacyPanel=$('.v169-edit-panel',content);
      if(!stableHost&&!legacyPanel)content.innerHTML=editPanel();
    }else{
      const native=$(`[data-v15-tab="${CSS.escape(s.tab==='json'?'json':'combined')}"]`,tabs);if(native)native.classList.add('on');
    }
  }
  window.__V168_REFRESH_ACTIVE_PANELS=function(){enhanceResults();enhanceTransformPanel();};
  function comparableRegion(r){
    if(!r)return null;return {name:r.name,type:r.type,visible:r.visible!==false,locked:!!r.locked,z_index:r.z_index,parent_id:r.parent_id||'',follow_move:!!r.follow_move,follow_scale:!!r.follow_scale,lock_aspect_ratio:!!r.lock_aspect_ratio,execution_mode:r.execution_mode,transform:r.transform,mask:r.mask,preserve:r.preserve,repair:r.repair,prompt_override:r.prompt_override||'',sourceBBox:r.sourceBBox,targetBBox:r.targetBBox};
  }
  function workspaceHasChanges(){
    const s=state();if(!s)return false;const base=s.v155.history&&s.v155.history[0];if(!base)return false;
    const nowSelected=[...(s.selected||[])].map(String).sort(),baseSelected=[...(base.selected||[])].map(String).sort();if(JSON.stringify(nowSelected)!==JSON.stringify(baseSelected))return true;
    const baseMap=new Map((base.regions||[]).map(r=>[String(r.id),r])),rows=initRegions();if(rows.length!==baseMap.size)return true;
    return rows.some(r=>JSON.stringify(comparableRegion(r))!==JSON.stringify(comparableRegion(baseMap.get(String(r.id)))));
  }
  function enhanceFooter(){
    const f=$('#v15-ocr-overlay .v15-footer-actions');if(!f)return;
    /* V24：移除底部旧版“检查范围 / 冲突检查通过”可视控件。
       冲突检查能力继续由新版底部“检查冲突”入口调用；保留隐藏事件桥，
       让跨模块检查流程无需依赖一个会占用布局空间的旧按钮。 */
    $$('.v155-footer-tools',f).forEach(node=>node.remove());
    const footer=f.closest('.v15-ocr-footer')||f;
    let bridge=$('[data-v226-conflict-bridge]',footer);
    if(!bridge){
      bridge=document.createElement('button');
      bridge.type='button';
      bridge.hidden=true;
      bridge.style.display='none';
      bridge.tabIndex=-1;
      bridge.setAttribute('aria-hidden','true');
      bridge.setAttribute('data-v226-conflict-bridge','');
      bridge.setAttribute('data-v177-conflict-check','');
      footer.appendChild(bridge);
    }
    const s=state(),apply=$('[data-v15-apply]',f),count=(s.selected||[]).length,changed=workspaceHasChanges();if(apply){apply.disabled=!count||!changed;apply.textContent=!count?'没有可应用区域':!changed?'无需应用':`应用 ${count} 个区域到图片微调`;apply.title=!changed&&count?'所有已启用区域均未发生修改':'';}
  }
  function enhanceHeader(){const title=$('#v15-ocr-overlay .v15-ocr-title b'),sub=$('#v15-ocr-overlay .v15-ocr-title small'),right=$('#v15-ocr-overlay .v15-ocr-head-right');if(title&&title.textContent!=='智能区域编辑工作台 · V27.9')title.textContent='智能区域编辑工作台 · V28.1.1';if(sub&&sub.textContent!=='轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复')sub.textContent='轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复';if(right){right.querySelectorAll('[data-v155-save-version],[data-v21-version-restore]').forEach(el=>el.remove());let wrap=right.querySelector('.v155-head-tools');if(!wrap){wrap=document.createElement('span');wrap.className='v155-head-tools';right.insertBefore(wrap,right.querySelector('.v15-ocr-close'));}if(!wrap.querySelector('[data-v155-export-task]'))wrap.innerHTML='<button type="button" class="v15-ocr-btn" data-v155-export-task>导出任务JSON</button>';}}
  function enhance(){if(enhancing)return;const s=state(),overlay=$('#v15-ocr-overlay');if(!s||!s.open||!overlay)return;enhancing=true;observer.disconnect();try{initRegions();enhanceHeader();enhanceSidebar();enhanceLocalMenu();enhanceCanvas();enhanceTransformPanel();enhanceResults();enhanceFooter();if(document.title!==(window.__APP_TITLE__||'V27.9 · 图灵线框工作台'))document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');}finally{observer.observe(document.documentElement,{childList:true,subtree:true});enhancing=false;}}



  function setTransform(key,value,commit){const r=active();if(!r||r.locked)return;let v=Number(value);if(!Number.isFinite(v))return;r.transform[key]=v;r.transform.anchor='center';r.transform.free_aspect=true;refreshRegion(r);if(commit){pushHistory('参数编辑：'+key);scheduleEnhance();}else updateTransformLive(r);}
  function setFloatValue(field,value,commit){const r=active();if(!r||r.locked)return;const v=Number(value);if(!Number.isFinite(v))return;const current=r.targetBBox||calcTarget(r),tr=r.transform,b=r.sourceBBox;
    if(field==='x')tr.move_x_canvas_pct=round((Number(tr.move_x_canvas_pct)||0)+(v/100-current.x)*100,4);
    else if(field==='y')tr.move_y_canvas_pct=round((Number(tr.move_y_canvas_pct)||0)+(v/100-current.y)*100,4);
    else if(field==='scale')tr.scale_pct=Math.max(10,Math.min(200,v));
    else if(field==='width'){const ratio=Math.max(.001,v/100)/(Math.max(.0001,b.width)*Math.max(.05,Number(tr.scale_pct||100)/100));tr.width_pct=ratio*100;}
    else if(field==='height'){const ratio=Math.max(.001,v/100)/(Math.max(.0001,b.height)*Math.max(.05,Number(tr.scale_pct||100)/100));tr.height_pct=ratio*100;}
    refreshRegion(r);if(commit){pushHistory('画布浮窗编辑：'+field);rerender();}else updateTransformLive(r);
  }
  function applyTemplate(key){const r=active();if(!r)return;pushHistory('模板应用前');const t=r.transform;
    if(key==='shrink20'){t.scale_pct=80;}else if(key==='enlarge20'){t.scale_pct=120;}else if(key==='shrink10'){t.scale_pct=90;}else if(key==='enlarge10'){t.scale_pct=110;}else if(key==='right5'){t.move_x_canvas_pct+=5;}else if(key==='down5'){t.move_y_canvas_pct+=5;}else if(key==='bottom'){const nt=calcTarget(r);t.move_y_canvas_pct+=(Math.min(.96,r.sourceBBox.y+r.sourceBBox.height)-(nt.y+nt.height))*100;}else if(key==='center'){const nt=calcTarget(r);t.move_x_canvas_pct+=(.5-(nt.x+nt.width/2))*100;}else if(key==='clarity'){r.execution_mode='direct_transform';r.prompt_override=(promptFor(r)+' 保持文字内容完全不变，只提升边缘清晰度和可读性。');}else if(key==='toward'){t.move_x_canvas_pct+=(r.sourceBBox.x<.5?5:-5);}else if(key==='avoid'){r.prompt_override=promptFor(r)+' 避免遮挡标题、产品和人物面部。';}else if(key==='face'){r.preserve=[...new Set([...(r.preserve||[]),'face','identity'])];}else if(key==='body'){r.preserve=[...new Set([...(r.preserve||[]),'body_integrity','hair_or_fur'])];}else if(key==='extend'||key==='repair'){r.execution_mode='local_regenerate';r.repair.background_hole=true;}else if(key==='simple'){r.prompt_override=promptFor(r)+' 降低背景元素密度和视觉复杂度。';}else if(key==='tone'){r.prompt_override=promptFor(r)+' 统一背景色调并保持主体颜色不变。';}else if(key==='depth'){r.prompt_override=promptFor(r)+' 增强前中后景空间层次。';}else if(key==='opacity'){r.prompt_override=promptFor(r)+' 将装饰透明度降低至约60%。';}else if(key==='behind'){r.z_index=Math.max(0,r.z_index-1);r.prompt_override=promptFor(r)+' 将装饰移动到主体后方。';}else if(key==='reduce'){r.execution_mode='local_regenerate';r.prompt_override=promptFor(r)+' 减少装饰元素数量并自然修复背景。';}else if(key==='direction'){r.preserve=[...new Set([...(r.preserve||[]),'effect_direction'])];}else if(key==='confirm'){r.type='decoration';r.review_status='ready';}
    refreshRegion(r);pushHistory('应用模板：'+key);rerender();
  }
  function copy(value){if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(value);const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return Promise.resolve();}
  function toast(text,type){let t=$('.v15-toast');if(t)t.remove();t=document.createElement('div');t.className='v15-toast '+(type||'');t.textContent=text;document.body.appendChild(t);setTimeout(()=>t.remove(),3200);}

  document.addEventListener('click',e=>{
    const s=state();if(!s||!s.open)return;
    const regionSearch=e.target.closest('[data-v168-region-search]');if(regionSearch){s.v168RegionSearch=regionSearch.value;const q=String(regionSearch.value||'').trim().toLowerCase();const list=regionSearch.closest('.v168-region-picker-pop')?.querySelector('.v168-region-picker-list');if(list){let visible=0;list.querySelectorAll('[data-v168-region-key]').forEach(btn=>{const on=!q||String(btn.dataset.v168RegionKey||'').includes(q);btn.hidden=!on;if(on)visible++;});let empty=list.querySelector('.v168-search-empty');if(!visible&&!empty){empty=document.createElement('p');empty.className='v168-search-empty';empty.textContent='没有匹配的区域';list.appendChild(empty);}else if(visible&&empty)empty.remove();}return;}
    const prompt168=e.target.closest('[data-v168-prompt]');if(prompt168){const r=active();if(r){window.__V277_APPLY_REGION_PROMPT_EDITOR__?.(r,prompt168.value)|| (r.prompt_override=prompt168.value);r.updated_at=new Date().toISOString();s.v155.previewReady=false;}return;}
    if(e.target.closest('[data-v168-advanced-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v168EditorAdvanced=!s.v155.v168EditorAdvanced;enhanceResults();return;}
    if(e.target.closest('[data-v168-json-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v168JsonOpen=!s.v155.v168JsonOpen;enhanceResults();return;}
    if(e.target.closest('[data-v168-region-picker-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v168RegionPickerOpen=!s.v168RegionPickerOpen;s.v168RegionSearch='';renderOcr();return;}
    const regionPick=e.target.closest('[data-v168-region-pick]');if(regionPick){e.preventDefault();e.stopImmediatePropagation();s.v168RegionPickerOpen=false;s.v168RegionSearch='';if(typeof window.__V168_HOT_SWITCH_REGION==='function')window.__V168_HOT_SWITCH_REGION(regionPick.dataset.v168RegionPick,{select:false,scroll:false,keepView:true});else hotSwitchRegion(regionPick.dataset.v168RegionPick,{select:false,scroll:false,keepView:true});renderOcr();return;}
    if(e.target.closest('[data-v168-more-tools]')){e.preventDefault();e.stopImmediatePropagation();s.moreToolsOpen=!s.moreToolsOpen;renderOcr();return;}
    if(e.target.closest('[data-v163-snap-advanced]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v163SnapAdvanced=!s.v155.v163SnapAdvanced;rerender();return;}
    if(e.target.closest('[data-v160-history-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v160HistoryOpen=!s.v155.v160HistoryOpen;rerender();return;}
    if(e.target.closest('[data-v160-history-close]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v160HistoryOpen=false;rerender();return;}
    if(e.target.closest('[data-v186-history-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v186HistoryShowAll=!s.v155.v186HistoryShowAll;rerender();return;}
    const view=e.target.closest('[data-v155-view]');if(view){e.preventDefault();e.stopImmediatePropagation();s.v155.view=view.dataset.v155View;enhance();return;}
    if(e.target.closest('[data-v155-export-task]')){e.preventDefault();e.stopImmediatePropagation();const blob=new Blob([JSON.stringify(projectTask(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${(s.name||'image').replace(/\.[^.]+$/,'')}-region-task-v21.1.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1200);toast('任务 JSON 已导出','ok');return;}
    const native=e.target.closest('[data-v15-tab]');if(native)s.v155.view='native';
    const reasonBtn=e.target.closest('[data-v178-change-reason]');if(reasonBtn){e.preventDefault();e.stopImmediatePropagation();closeReasonDialog(reasonBtn.dataset.v178ChangeReason);return;}
    if(e.target.closest('[data-v178-batch-clean]')){e.preventDefault();e.stopImmediatePropagation();batchCleanClosed();return;}
    if(e.target.closest('[data-v192-add-region-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v192AddRegionOpen=!s.v192AddRegionOpen;if(s.v192AddRegionOpen){s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.correctionAddMode=false;s.v199CreationStep='info';}else{s.correctionAddMode=false;s.v199CreationStep='info';v204DisarmDrawingDom();s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.v194RegionDraft=null;s.v196TemplateManagerOpen=false;}rerender();if(s.v192AddRegionOpen)v197RevealAddRegionPanel();return;}
    if(e.target.closest('[data-v192-add-region-close]')){e.preventDefault();e.stopImmediatePropagation();s.v192AddRegionOpen=false;s.correctionAddMode=false;s.v199CreationStep='info';v204DisarmDrawingDom();s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.v194RegionDraft=null;s.v196TemplateManagerOpen=false;rerender();return;}
    if(e.target.closest('[data-v192-add-region-start]')){e.preventDefault();e.stopImmediatePropagation();v198BeginRegionDrawing();return;}
    if(e.target.closest('[data-v194-preflight-cancel]')){e.preventDefault();e.stopImmediatePropagation();s.v194RegionPreflightOpen=false;s.v194RegionDraft=null;rerender();return;}
    if(e.target.closest('[data-v194-preflight-confirm]')){e.preventDefault();e.stopImmediatePropagation();if(!s.v194RegionDraft?.name||!s.v194RegionDraft?.templateId){toast('区域信息不完整，请返回修改','bad');return;}s.v194RegionPreflightOpen=false;s.v194PendingRegionBox=null;s.correctionAddMode=true;s.v199CreationStep='drawing';s.correctionMode=false;s.focusMode=false;s.selectionMode=false;if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else rerender();queueMicrotask(()=>v199VerifyDrawingMode(0));requestAnimationFrame(()=>v199VerifyDrawingMode(0));setTimeout(()=>v204StartDrawingWatchdog(0),120);toast('请在中间识别预览中按住鼠标拖出新区域','ok');return;}
    if(e.target.closest('[data-v194-region-redraw]')){e.preventDefault();e.stopImmediatePropagation();s.v194PendingRegionBox=null;s.correctionAddMode=true;s.v199CreationStep='drawing';s.correctionMode=false;s.focusMode=false;s.selectionMode=false;if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else rerender();queueMicrotask(()=>v199VerifyDrawingMode(0));requestAnimationFrame(()=>v199VerifyDrawingMode(0));setTimeout(()=>v204StartDrawingWatchdog(0),120);toast('请重新框选区域','ok');return;}
    if(e.target.closest('[data-v194-region-confirm]')){e.preventDefault();e.stopImmediatePropagation();const box=s.v194PendingRegionBox;if(!box){toast('没有可确认的框选区域','bad');return;}if(typeof window.__V194_ADD_MANUAL_REGION__!=='function'){toast('区域创建通道尚未就绪','bad');return;}window.__V194_ADD_MANUAL_REGION__({...box});return;}
    if(e.target.closest('[data-v196-template-manager-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v196TemplateManagerOpen=!s.v196TemplateManagerOpen;rerender();return;}
    if(e.target.closest('[data-v196-template-manager-close]')){e.preventDefault();e.stopImmediatePropagation();s.v196TemplateManagerOpen=false;rerender();return;}
    if(e.target.closest('[data-v196-template-save]')){e.preventDefault();e.stopImmediatePropagation();const label=window.prompt('输入模板名称',String(s.v192AddRegionName||'').trim()||'我的区域模板');if(!label||!label.trim())return;const rows=v193LoadCustomTemplates(),id='custom_'+Date.now(),tpl={id,label:label.trim(),name:String(s.v192AddRegionName||'').trim(),type:META[s.v192AddRegionType]?s.v192AddRegionType:'decoration',mode:s.v193AddRegionMode||META[s.v192AddRegionType]?.defaultMode||'direct_transform',preserveKey:s.v193AddRegionPreserveKey||'auto'};rows.push(tpl);if(!v193SaveCustomTemplates(rows)){toast('模板保存失败：本地存储不可用','bad');return;}s.v193AddRegionTemplate=id;s.v196TemplateManagerOpen=true;rerender();toast('区域创建模板已保存','ok');return;}
    const useManaged=e.target.closest('[data-v196-template-use]');if(useManaged){e.preventDefault();e.stopImmediatePropagation();const id=useManaged.dataset.v196TemplateUse,currentName=String(s.v192AddRegionName||'');if(v193ApplyRegionTemplate(id)){if(currentName.trim())s.v192AddRegionName=currentName;s.v196TemplateManagerOpen=false;rerender();toast('模板已应用','ok');}return;}
    const deleteManaged=e.target.closest('[data-v196-template-delete]');if(deleteManaged){e.preventDefault();e.stopImmediatePropagation();const id=deleteManaged.dataset.v196TemplateDelete;if(!String(id).startsWith('custom_'))return;const tpl=v193TemplateMap()[id];if(!window.confirm(`删除模板“${tpl?.label||id}”？`))return;const rows=v193LoadCustomTemplates().filter(x=>x.id!==id);if(v193SaveCustomTemplates(rows)){if(s.v193AddRegionTemplate===id)s.v193AddRegionTemplate='custom';s.v196TemplateManagerOpen=true;rerender();toast('自定义模板已删除','ok');}return;}
    if(e.target.closest('[data-v193-selection-coords]')){e.preventDefault();e.stopImmediatePropagation();s.v193SelectionCoordsOpen=!s.v193SelectionCoordsOpen;rerender();return;}
    const pick=e.target.closest('[data-v155-select-region]');if(pick&&!e.target.closest('button,input,select')){e.preventDefault();e.stopImmediatePropagation();const id=pick.dataset.v155SelectRegion;if(typeof window.__V175_SELECT_AND_LOCATE_REGION==='function')window.__V175_SELECT_AND_LOCATE_REGION(id);else if(typeof window.__V168_HOT_SWITCH_REGION==='function')window.__V168_HOT_SWITCH_REGION(id,{select:true,forceEnable:false,scroll:false,keepView:true});else{s.activeId=id;if(!(s.selected||[]).includes(id))s.selected=[...(s.selected||[]),id];}return;}
    const moreToggle=e.target.closest('[data-v179-more-toggle]');if(moreToggle){e.preventDefault();e.stopImmediatePropagation();/* 鼠标由 pointerdown 通道处理，避免同一次操作在 click 阶段再次切换而立即关闭；键盘激活仍在此打开。 */if(e.detail===0){const id=moreToggle.dataset.v179MoreToggle;s.v179MoreRegionId='';if(typeof window.__V183_TOGGLE_REGION_MENU__==='function')window.__V183_TOGGLE_REGION_MENU__(id,moreToggle);}return;}
    const vis=e.target.closest('[data-v155-visible]');if(vis){e.preventDefault();e.stopImmediatePropagation();const r=region(vis.dataset.v155Visible);if(r){pushHistory('显示状态变更前');r.visible=r.visible===false;auditAction(r.visible?'显示区域':'隐藏区域',r);pushHistory(r.visible?'显示区域':'隐藏区域');s.v179MoreRegionId='';rerender();}return;}
    const lock=e.target.closest('[data-v155-lock]');if(lock){e.preventDefault();e.stopImmediatePropagation();const r=region(lock.dataset.v155Lock);if(r){pushHistory('锁定状态变更前');r.locked=!r.locked;r.status=r.locked?'locked':'ready';auditAction(r.locked?'锁定区域':'解锁区域',r);pushHistory(r.locked?'锁定区域':'解锁区域');s.v179MoreRegionId='';rerender();}return;}
    const ren=e.target.closest('[data-v155-rename]');if(ren){e.preventDefault();e.stopImmediatePropagation();const r=region(ren.dataset.v155Rename);if(r){const oldName=r.name||r.label||'',name=window.prompt('输入区域名称',oldName);if(name&&name.trim()){pushHistory('重命名前');r.name=name.trim();r.label=r.name;auditAction('重命名区域',r,`${oldName} → ${r.name}`);pushHistory('重命名区域');s.v179MoreRegionId='';rerender();}}return;}
    const templ=e.target.closest('[data-v155-template]');if(templ){e.preventDefault();e.stopImmediatePropagation();applyTemplate(templ.dataset.v155Template);return;}
    if(e.target.closest('[data-v155-reset-transform]')){e.preventDefault();e.stopImmediatePropagation();const r=active();if(r){pushHistory('重置变换前',true);r.transform=defaultTransform(r);r.prompt_override='';refreshRegion(r);pushHistory('重置变换',true);toast('已重置当前区域的位置、尺寸与旋转','ok');rerender();}return;}
    if(e.target.closest('[data-v155-undo]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v160HistoryOpen=false;undo();return;}
    if(e.target.closest('[data-v155-redo]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v160HistoryOpen=false;redo();return;}
    const hi=e.target.closest('[data-v159-history-index]');if(hi){e.preventDefault();e.stopImmediatePropagation();s.v155.v160HistoryOpen=false;restoreHistory(Number(hi.dataset.v159HistoryIndex));return;}
    if(e.target.closest('[data-v155-copy-prompt]')){e.preventDefault();copy(active()?.prompt_override||promptFor(active())).then(()=>toast('提示词已复制','ok'));return;}
    if(e.target.closest('[data-v155-copy-json]')){e.preventDefault();copy(JSON.stringify(regionTask(active()),null,2)).then(()=>toast('Region JSON 已复制','ok'));return;}
    if(e.target.closest('[data-v177-conflict-check]')){e.preventDefault();e.stopImmediatePropagation();runConflictCheck(false);return;}
    const nativeDelete=e.target.closest('[data-v154-delete-region],[data-v154-delete-active]');if(nativeDelete){correctionBefore=historySnapshot('删除前');setTimeout(()=>{pushHistory('删除区域',true);validate();scheduleEnhance();},30);}
    const apply=e.target.closest('[data-v15-apply]');if(apply){
      try{window.__V271_COMMIT_ACTIVE_AI_PROMPT__?.();}catch(_e){}
      selectedRegions().forEach(r=>{const t=r.targetBBox||calcTarget(r),effective=window.__V271_RESOLVE_REGION_PROMPT__?.(r)||r.prompt_override||promptFor(r),userInstruction=window.__V271_REGION_USER_INTENT__?.(r)||'';Object.assign(r,{x:t.x,y:t.y,width:t.width,height:t.height,suggestedInstruction:effective,aiUserInstruction:userInstruction,regionTask:regionTask(r)});r.status='applied';});setTimeout(()=>{if(typeof adjustState.aiStatus==='string')adjustState.aiStatus=adjustState.aiStatus.replace(/V15\.[4-7]/g,'V27.9');},120);
    }
  },true);

  document.addEventListener('input',e=>{
    const s=state();if(!s||!s.open)return;
    const float=e.target.closest('[data-v159-float-input]');if(float){setFloatValue(float.dataset.v159FloatInput,float.value,false);return;}
    const range=e.target.closest('[data-v155-transform]');if(range){beginTransformInteraction();setTransform(range.dataset.v155Transform,range.value,false);const num=$(`[data-v155-transform-number="${CSS.escape(range.dataset.v155Transform)}"]`);if(num)num.value=range.value;return;}
    const num=e.target.closest('[data-v155-transform-number]');if(num){beginTransformInteraction();setTransform(num.dataset.v155Transform,num.value,false);const range2=$(`[data-v155-transform="${CSS.escape(num.dataset.v155Transform)}"]`);if(range2)range2.value=num.value;return;}
    const addName=e.target.closest('[data-v192-add-region-name]');if(addName){s.v192AddRegionName=addName.value;v198UpdateNameFieldDom(addName);const sec=addName.closest('#v155-region-list');if(sec)sec.dataset.v178Signature=regionListSignature();return;}
    const prompt=e.target.closest('[data-v155-prompt]');if(prompt){const r=active();if(r){window.__V277_APPLY_REGION_PROMPT_EDITOR__?.(r,prompt.value)|| (r.prompt_override=prompt.value);r.updated_at=new Date().toISOString();s.v155.previewReady=false;}return;}
  },true);
  document.addEventListener('change',e=>{
    const s=state();if(!s||!s.open)return;
    const float=e.target.closest('[data-v159-float-input]');if(float){setFloatValue(float.dataset.v159FloatInput,float.value,true);return;}
    const addTemplate=e.target.closest('[data-v193-add-region-template]');if(addTemplate){const next=addTemplate.value||'custom',prev=s.v193AddRegionTemplate||'custom',currentName=String(s.v192AddRegionName||''),prevDefault=v193TemplateMap()[prev]?.name||v193TemplateMap()[prev]?.label||'';s.v193AddRegionTemplate=next;s.v196TemplateManagerOpen=false;if(next==='custom'){rerender();toast('已切换为自定义创建，可手动选择区域类型','ok');return;}const preserveName=!!currentName.trim()&&currentName.trim()!==String(prevDefault).trim();if(v193ApplyRegionTemplate(next)){if(preserveName)s.v192AddRegionName=currentName;rerender();toast(`已自动应用模板：${v194TemplateLabel(next)}`,'ok');}else{toast('模板不可用，请重新选择','bad');}return;}
    const addType=e.target.closest('[data-v192-add-region-type]');if(addType){s.v192AddRegionType=META[addType.value]?addType.value:'text';s.correctionAddType=s.v192AddRegionType;if(s.v193AddRegionPreserveKey==='auto')s.v193AddRegionMode=META[s.v192AddRegionType].defaultMode;return;}
    const addMode=e.target.closest('[data-v193-add-region-mode]');if(addMode){s.v193AddRegionMode=['direct_transform','move_and_repair','local_regenerate'].includes(addMode.value)?addMode.value:'direct_transform';s.v193AddRegionTemplate='custom';return;}
    const addPreserve=e.target.closest('[data-v193-add-region-preserve]');if(addPreserve){s.v193AddRegionPreserveKey=V193_PRESERVE_LABELS[addPreserve.value]?addPreserve.value:'auto';s.v193AddRegionTemplate='custom';return;}
    const r159=active();
    const bottom=e.target.closest('[data-v159-bottom-lock]');if(bottom&&r159){pushHistory('底部接触点锁定前');const t=r159.targetBBox||calcTarget(r159),c=normalizeComposition(r159);c.bottom_contact.enabled=bottom.checked;if(bottom.checked)c.bottom_contact.bottom_y=t.y+t.height;refreshRegion(r159);validate();pushHistory(bottom.checked?'锁定底部接触点':'解除底部接触点');rerender();return;}
    const centerLine=e.target.closest('[data-v159-center-line]');if(centerLine&&r159){pushHistory('中心线约束修改前');normalizeComposition(r159).center_line.mode=centerLine.value;refreshRegion(r159);validate();pushHistory('修改中心线约束');rerender();return;}
    const spacingEnabled=e.target.closest('[data-v159-spacing-enabled]');if(spacingEnabled&&r159){pushHistory('对象间距约束修改前');const c=normalizeComposition(r159);c.spacing.enabled=spacingEnabled.checked;if(spacingEnabled.checked&&!c.spacing.reference_id){const ref=initRegions().find(x=>x.id!==r159.id);if(ref)c.spacing.reference_id=ref.id;}refreshRegion(r159);validate();pushHistory(spacingEnabled.checked?'锁定对象间距':'解除对象间距');rerender();return;}
    const spacingRef=e.target.closest('[data-v159-spacing-reference]');if(spacingRef&&r159){normalizeComposition(r159).spacing.reference_id=spacingRef.value;refreshRegion(r159);validate();pushHistory('修改间距参考区域');rerender();return;}
    const spacingDir=e.target.closest('[data-v159-spacing-direction]');if(spacingDir&&r159){normalizeComposition(r159).spacing.direction=spacingDir.value;refreshRegion(r159);validate();pushHistory('修改间距方向');rerender();return;}
    const spacingGap=e.target.closest('[data-v159-spacing-gap]');if(spacingGap&&r159){normalizeComposition(r159).spacing.gap_pct=Math.max(-50,Math.min(50,Number(spacingGap.value)||0));refreshRegion(r159);validate();pushHistory('修改对象间距');rerender();return;}
    const alignEnabled=e.target.closest('[data-v159-align-enabled]');if(alignEnabled&&r159){pushHistory('区域对齐约束修改前');const c=normalizeComposition(r159);c.alignment.enabled=alignEnabled.checked;if(alignEnabled.checked&&!c.alignment.reference_id){const ref=initRegions().find(x=>x.id!==r159.id);if(ref)c.alignment.reference_id=ref.id;}refreshRegion(r159);validate();pushHistory(alignEnabled.checked?'锁定区域对齐':'解除区域对齐');rerender();return;}
    const alignRef=e.target.closest('[data-v159-align-reference]');if(alignRef&&r159){normalizeComposition(r159).alignment.reference_id=alignRef.value;refreshRegion(r159);validate();pushHistory('修改对齐参考区域');rerender();return;}
    const alignMode=e.target.closest('[data-v159-align-mode]');if(alignMode&&r159){normalizeComposition(r159).alignment.mode=alignMode.value;refreshRegion(r159);validate();pushHistory('修改区域对齐方式');rerender();return;}
    const miniSource=e.target.closest('[data-v162-mini-source]');if(miniSource){s.v155.v162Mini.showSource=miniSource.checked;rerender();return;}
    if(e.target.closest('[data-v162-mini-reset]')){e.preventDefault();e.stopImmediatePropagation();if(Date.now()-Number(s.v155.v180LastMiniResetAt||0)<650)return;const r=active();if(r){pushHistory('小图校正恢复前',true);restoreOriginalRange(r);auditAction('恢复原始范围',r,'恢复到首次识别基线');pushHistory('小图校正恢复原始范围',true);toast('已恢复到首次识别的原始范围','ok');rerender();}return;}
    if(e.target.closest('[data-v180-mini-inside]')){e.preventDefault();e.stopImmediatePropagation();const r=active();if(r){pushHistory('移回画布前',true);moveRegionInside(r);auditAction('移回画布',r,'按 1% 安全边距重新放入画布');pushHistory('移回画布',true);toast('区域已移回画布安全范围','ok');rerender();}return;}
    const auditToggle=e.target.closest('[data-v180-audit-toggle]');if(auditToggle){e.preventDefault();e.stopImmediatePropagation();s.v155.v180AuditShowAll=!s.v155.v180AuditShowAll;scheduleEnhance();return;}
    const auditDetail=e.target.closest('[data-v180-audit-detail]');if(auditDetail){e.preventDefault();e.stopImmediatePropagation();auditDetailDialog(auditDetail.dataset.v180AuditDetail);return;}
    const auditRollback=e.target.closest('[data-v180-audit-rollback]');if(auditRollback){e.preventDefault();e.stopImmediatePropagation();rollbackAudit(auditRollback.dataset.v180AuditRollback);return;}
    const snapEnabled=e.target.closest('[data-v161-snap-enabled]');if(snapEnabled){s.v155.v161Snap.enabled=snapEnabled.checked;pushHistory(snapEnabled.checked?'启用智能吸附':'关闭智能吸附',true);rerender();return;}
    const snapThreshold=e.target.closest('[data-v161-snap-threshold]');if(snapThreshold){s.v155.v161Snap.threshold_px=Math.max(3,Math.min(30,Number(snapThreshold.value)||9));rerender();return;}
    const snapCenter=e.target.closest('[data-v161-snap-center]');if(snapCenter){s.v155.v161Snap.canvas_center=snapCenter.checked;rerender();return;}
    const snapThirds=e.target.closest('[data-v161-snap-thirds]');if(snapThirds){s.v155.v161Snap.thirds=snapThirds.checked;rerender();return;}
    const snapRegions=e.target.closest('[data-v161-snap-regions]');if(snapRegions){s.v155.v161Snap.regions=snapRegions.checked;rerender();return;}
    const distanceLabels=e.target.closest('[data-v161-distance-labels]');if(distanceLabels){s.v155.v161Snap.distance_labels=distanceLabels.checked;rerender();return;}
    const range=e.target.closest('[data-v155-transform],[data-v155-transform-number]');if(range){endTransformInteraction(false);setTransform(range.dataset.v155Transform||range.dataset.v155TransformNumber,range.value,true);rerender();return;}
    const closeFilter=e.target.closest('[data-v178-close-filter]');if(closeFilter){s.v178CloseFilter=closeFilter.value;scheduleEnhance();return;}
    const check=e.target.closest('[data-v155-select-check]');if(check){const id=check.dataset.v155SelectCheck,set=new Set(s.selected||[]),r=region(id);pushHistory(check.checked?'重新开启区域前':'关闭区域前',true);if(check.checked){set.add(id);if(r){r.close_reason='';r.close_reason_updated_at=new Date().toISOString();}}else{set.delete(id);if(r&&!r.close_reason)r.close_reason='defer';}s.selected=[...set];if(r)auditAction(check.checked?'开启区域':'关闭区域',r,check.checked?'重新加入可编辑区域':closeReasonLabel(r));pushHistory(check.checked?'重新开启区域':'关闭区域',true);s.v179MoreRegionId='';if(check.checked&&typeof window.__V175_SELECT_AND_LOCATE_REGION==='function')window.__V175_SELECT_AND_LOCATE_REGION(id);else{scheduleEnhance();setTimeout(()=>closeReasonDialog(id),0);}return;}
    const regionType=e.target.closest('[data-v155-region-type]');if(regionType){const r=active();if(r&&META[regionType.value]){pushHistory('区域类型修改前');r.type=regionType.value;r.preserve=clone(DEFAULT_PRESERVE[r.type]||[]);r.execution_mode=META[r.type].defaultMode;r.review_status='ready';r.status='ready';refreshRegion(r);validate();pushHistory('修改区域类型');rerender();}return;}
    const mode=e.target.closest('[data-v155-mode]');if(mode){const r=active();if(r){pushHistory('执行模式修改前');r.execution_mode=mode.value;r.repair.background_hole=mode.value!=='direct_transform';r.repair.edge_blending=mode.value!=='direct_transform';refreshRegion(r);pushHistory('修改执行模式');rerender();}return;}
    const mask=e.target.closest('[data-v155-mask-type]');if(mask){const r=active();if(r){r.mask.type=mask.value;if(mask.value==='soft'&&!r.mask.feather_px)r.mask.feather_px=6;pushHistory('修改蒙版类型');rerender();}return;}
    const feather=e.target.closest('[data-v155-feather]');if(feather){const r=active();if(r){r.mask.feather_px=Math.max(0,Math.min(64,Number(feather.value)||0));pushHistory('修改羽化');rerender();}return;}
    const z=e.target.closest('[data-v155-z]');if(z){const r=active();if(r){r.z_index=Math.max(0,Math.min(99,Number(z.value)||0));pushHistory('修改层级');rerender();}return;}
    const parent=e.target.closest('[data-v155-parent]');if(parent){const r=active();if(r){r.parent_id=parent.value;r.targetBBox=calcTarget(r);pushHistory('修改父子关系');rerender();}return;}
    const fm=e.target.closest('[data-v155-follow-move]');if(fm){const r=active();if(r){r.follow_move=fm.checked;r.targetBBox=calcTarget(r);pushHistory('跟随移动设置');rerender();}return;}
    const fs=e.target.closest('[data-v155-follow-scale]');if(fs){const r=active();if(r){r.follow_scale=fs.checked;r.targetBBox=calcTarget(r);pushHistory('跟随缩放设置');rerender();}return;}
    const la=e.target.closest('[data-v155-lock-aspect]');if(la){const r=active();if(r){r.lock_aspect_ratio=la.checked;pushHistory('比例锁定设置');rerender();}return;}
    const nativeType=e.target.closest('[data-v15-region-type]');if(nativeType){setTimeout(()=>{const r=region(nativeType.dataset.v15RegionType);if(r){r.preserve=clone(DEFAULT_PRESERVE[r.type]||[]);r.execution_mode=(META[r.type]||META.unclassified).defaultMode;refreshRegion(r);}pushHistory('修改区域类型',true);validate();scheduleEnhance();},40);}
  },true);


  function commitV168EditorControl(target){
    const s=state(),r=active();if(!s||!r)return false;
    const type=target.closest('[data-v168-region-type]');if(type){pushHistory('区域类型修改前',true);r.type=type.value;r.preserve=clone(DEFAULT_PRESERVE[r.type]||[]);r.execution_mode=(META[r.type]||META.unclassified).defaultMode;r.review_status='ready';r.status='ready';refreshRegion(r);validate();pushHistory('修改区域类型',true);rerender();toast('区域类型已更新','ok');return true;}
    const mode=target.closest('[data-v168-mode]');if(mode){pushHistory('修改方式调整前',true);r.execution_mode=mode.value;r.repair.background_hole=mode.value!=='direct_transform';r.repair.edge_blending=mode.value!=='direct_transform';refreshRegion(r);pushHistory('修改处理方式',true);rerender();toast('修改方式已更新','ok');return true;}
    const aspect=target.closest('[data-v168-lock-aspect]');if(aspect){r.lock_aspect_ratio=aspect.checked;pushHistory(aspect.checked?'保持原始比例':'允许独立宽高',true);refreshRegion(r);rerender();return true;}
    const mask=target.closest('[data-v168-mask-type]');if(mask){r.mask.type=mask.value;if(mask.value==='soft'&&!r.mask.feather_px)r.mask.feather_px=6;pushHistory('修改蒙版边缘',true);rerender();return true;}
    const feather=target.closest('[data-v168-feather]');if(feather){r.mask.feather_px=Math.max(0,Math.min(64,Number(feather.value)||0));pushHistory('修改边缘柔化',true);rerender();return true;}
    const z=target.closest('[data-v168-z]');if(z){r.z_index=Math.max(0,Math.min(99,Number(z.value)||0));pushHistory('修改前后层级',true);rerender();return true;}
    const parent=target.closest('[data-v168-parent]');if(parent){r.parent_id=parent.value;r.targetBBox=calcTarget(r);pushHistory('修改跟随区域',true);rerender();return true;}
    const fm=target.closest('[data-v168-follow-move]');if(fm){r.follow_move=fm.checked;r.targetBBox=calcTarget(r);pushHistory('修改跟随移动',true);rerender();return true;}
    const fs=target.closest('[data-v168-follow-scale]');if(fs){r.follow_scale=fs.checked;r.targetBBox=calcTarget(r);pushHistory('修改跟随缩放',true);rerender();return true;}
    return false;
  }
  window.addEventListener('change',e=>{const t=e.target;if(!t||!t.closest||!t.closest('#v15-ocr-overlay .v168-edit-panel'))return;if(commitV168EditorControl(t)){e.preventDefault();e.stopImmediatePropagation();}},true);


  /* V18：独立于旧版详情事件的稳定交互桥。使用全新的 data-v169-* 属性，避免旧监听器抢占。 */
  function refreshV169Editor(){enhanceResults();const panel=$('#v15-ocr-overlay .v169-edit-panel');if(panel)panel.dataset.v169Interactive='true';}
  function commitV169Control(target,finalize){
    const s=state(),r=active();if(!s||!r||!target)return false;
    const type=target.closest?.('[data-v169-region-type]');if(type){if(finalize)pushHistory('区域类型修改前',true);r.type=type.value;r.preserve=clone(DEFAULT_PRESERVE[r.type]||[]);r.execution_mode=(META[r.type]||META.unclassified).defaultMode;r.review_status='editing';r.status='editing';refreshRegion(r);if(finalize)pushHistory('修改区域类型',true);refreshV169Editor();toast('区域类型已更新','ok');return true;}
    const mode=target.closest?.('[data-v169-mode]');if(mode){if(finalize)pushHistory('修改方式调整前',true);r.execution_mode=mode.value;r.repair.background_hole=mode.value!=='direct_transform';r.repair.edge_blending=mode.value!=='direct_transform';if(mode.value==='direct_transform')r.repair.rebuild_shadow=false;else if(r.type==='product'||r.type==='person')r.repair.rebuild_shadow=true;refreshRegion(r);if(finalize)pushHistory('修改处理方式',true);refreshV169Editor();toast('修改方式已更新','ok');return true;}
    const aspect=target.closest?.('[data-v169-lock-aspect]');if(aspect){r.lock_aspect_ratio=!!aspect.checked;refreshRegion(r);if(finalize)pushHistory(aspect.checked?'保持原始比例':'允许独立宽高',true);refreshV169Editor();return true;}
    const mask=target.closest?.('[data-v169-mask-type]');if(mask){r.mask.type=mask.value;if(mask.value==='soft'&&!r.mask.feather_px)r.mask.feather_px=6;if(finalize)pushHistory('修改蒙版边缘',true);refreshV169Editor();return true;}
    const feather=target.closest?.('[data-v169-feather]');if(feather){r.mask.feather_px=Math.max(0,Math.min(64,Number(feather.value)||0));if(finalize)pushHistory('修改边缘柔化',true);return true;}
    const z=target.closest?.('[data-v169-z]');if(z){r.z_index=Math.max(0,Math.min(99,Number(z.value)||0));if(finalize)pushHistory('修改前后层级',true);return true;}
    const parent=target.closest?.('[data-v169-parent]');if(parent){r.parent_id=parent.value;r.targetBBox=calcTarget(r);if(finalize)pushHistory('修改跟随区域',true);refreshV169Editor();return true;}
    const fm=target.closest?.('[data-v169-follow-move]');if(fm){r.follow_move=!!fm.checked;r.targetBBox=calcTarget(r);if(finalize)pushHistory('修改跟随移动',true);return true;}
    const fs=target.closest?.('[data-v169-follow-scale]');if(fs){r.follow_scale=!!fs.checked;r.targetBBox=calcTarget(r);if(finalize)pushHistory('修改跟随缩放',true);return true;}
    const hole=target.closest?.('[data-v169-repair-hole]');if(hole){r.repair.background_hole=!!hole.checked;if(finalize)pushHistory('修改背景修复设置',true);return true;}
    const shadow=target.closest?.('[data-v169-repair-shadow]');if(shadow){r.repair.rebuild_shadow=!!shadow.checked;if(finalize)pushHistory('修改阴影重建设置',true);return true;}
    const edge=target.closest?.('[data-v169-repair-edge]');if(edge){r.repair.edge_blending=!!edge.checked;if(finalize)pushHistory('修改边缘融合设置',true);return true;}
    const prompt=target.closest?.('[data-v169-prompt]');if(prompt){window.__V277_APPLY_REGION_PROMPT_EDITOR__?.(r,prompt.value)|| (r.prompt_override=prompt.value);r.updated_at=new Date().toISOString();s.v155.previewReady=false;r.status='editing';r.review_status='editing';if(finalize)pushHistory('修改 AI 指令',true);return true;}
    return false;
  }
  window.addEventListener('click',e=>{
    const s=state();if(!s||!s.open||!e.target.closest?.('#v15-ocr-overlay .v169-edit-panel'))return;
    if(e.target.closest('[data-v169-professional-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v169ProfessionalMode=!s.v155.v169ProfessionalMode;if(!s.v155.v169ProfessionalMode)s.v155.v169JsonExpanded=false;if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();requestAnimationFrame(()=>refreshV169Editor());toast(s.v155.v169ProfessionalMode?'专业模式已开启，诊断详情已显示':'已切回新手模式，正常状态下隐藏诊断详情','ok');return;}
    if(e.target.closest('[data-v169-prompt-toggle]')){e.preventDefault();e.stopImmediatePropagation();const next=!s.v155.v169PromptExpanded;s.v155.v169PromptExpanded=next;s.v155.v17PromptExpanded=next;s.v155.v173PromptExpanded=next;if(window.__V17_INTERACTION_TEST__&&typeof window.__V17_INTERACTION_TEST__.install==='function')window.__V17_INTERACTION_TEST__.install();else refreshV169Editor();return;}
    if(e.target.closest('[data-v169-json-toggle]')){e.preventDefault();e.stopImmediatePropagation();s.v155.v169JsonExpanded=!s.v155.v169JsonExpanded;refreshV169Editor();return;}
    if(e.target.closest('[data-v169-copy-prompt]')){e.preventDefault();e.stopImmediatePropagation();copy(active()?.prompt_override||promptFor(active())).then(()=>toast('AI 修改指令已复制','ok'));return;}
    if(e.target.closest('[data-v169-copy-json]')){e.preventDefault();e.stopImmediatePropagation();copy(JSON.stringify(regionTask(active()),null,2)).then(()=>toast('任务 JSON 已复制','ok'));return;}
  },true);
  window.addEventListener('input',e=>{
    const t=e.target;if(!t||!t.closest?.('#v15-ocr-overlay .v169-edit-panel'))return;
    const finalize=!!t.closest('select,input[type=checkbox]');if(commitV169Control(t,finalize)){e.stopImmediatePropagation();}
  },true);
  window.addEventListener('change',e=>{
    const t=e.target;if(!t||!t.closest?.('#v15-ocr-overlay .v169-edit-panel'))return;
    if(commitV169Control(t,true)){e.preventDefault();e.stopImmediatePropagation();refreshV169Editor();}
  },true);

  function snapCandidates(r){const s=state(),cfg=s.v155.v161Snap||{},xs=[],ys=[];if(cfg.canvas_center){xs.push({v:.5,label:'画布中心'});ys.push({v:.5,label:'画布中心'});}if(cfg.thirds){[1/3,2/3].forEach((v,i)=>{xs.push({v,label:`竖向三分线${i+1}`});ys.push({v,label:`横向三分线${i+1}`});});}if(cfg.regions){initRegions().filter(x=>x.id!==r.id&&x.visible!==false).forEach(x=>{const b=x.targetBBox||calcTarget(x),name=window.__V221_REGION_NAME__?.(x)||x.name||x.label||'区域';xs.push({v:b.x,label:`${name} 左边缘`,region:x},{v:b.x+b.width/2,label:`${name} 中心`,region:x},{v:b.x+b.width,label:`${name} 右边缘`,region:x});ys.push({v:b.y,label:`${name} 上边缘`,region:x},{v:b.y+b.height/2,label:`${name} 中心`,region:x},{v:b.y+b.height,label:`${name} 下边缘`,region:x});});}return{xs,ys};}
  function nearestSnap(values,candidates,tol){let best=null;values.forEach((v,slot)=>candidates.forEach(c=>{const d=c.v-v;if(Math.abs(d)<=tol&&(!best||Math.abs(d)<Math.abs(best.delta)))best={delta:d,slot,candidate:c};}));return best;}
  function nearestDistances(r,box){let bestX=null,bestY=null;initRegions().filter(x=>x.id!==r.id&&x.visible!==false).forEach(x=>{const b=x.targetBBox||calcTarget(x);let dx=0,x1=0,x2=0;if(box.x+box.width<=b.x){dx=b.x-(box.x+box.width);x1=box.x+box.width;x2=b.x;}else if(b.x+b.width<=box.x){dx=box.x-(b.x+b.width);x1=b.x+b.width;x2=box.x;}if(dx>0&&(!bestX||dx<bestX.value))bestX={value:dx,from:x1,to:x2,y:Math.max(box.y,Math.min(box.y+box.height,b.y+b.height/2)),region:x};let dy=0,y1=0,y2=0;if(box.y+box.height<=b.y){dy=b.y-(box.y+box.height);y1=box.y+box.height;y2=b.y;}else if(b.y+b.height<=box.y){dy=box.y-(b.y+b.height);y1=b.y+b.height;y2=box.y;}if(dy>0&&(!bestY||dy<bestY.value))bestY={value:dy,from:y1,to:y2,x:Math.max(box.x,Math.min(box.x+box.width,b.x+b.width/2)),region:x};});return{x:bestX,y:bestY};}
  function applySmartSnap(r,rect){const s=state(),cfg=s.v155.v161Snap||{};let box=rawTarget(r),info={x:null,y:null,distances:null};if(cfg.enabled){const tolX=(Number(cfg.threshold_px)||9)/Math.max(1,rect.width),tolY=(Number(cfg.threshold_px)||9)/Math.max(1,rect.height),c=snapCandidates(r),sx=nearestSnap([box.x,box.x+box.width/2,box.x+box.width],c.xs,tolX),sy=nearestSnap([box.y,box.y+box.height/2,box.y+box.height],c.ys,tolY);if(sx){r.transform.move_x_canvas_pct=round((Number(r.transform.move_x_canvas_pct)||0)+sx.delta*100,4);info.x=sx;}if(sy){r.transform.move_y_canvas_pct=round((Number(r.transform.move_y_canvas_pct)||0)+sy.delta*100,4);info.y=sy;}refreshRegion(r);box=r.targetBBox||calcTarget(r);}if(cfg.distance_labels)info.distances=nearestDistances(r,box);return info;}
  function renderSnapOverlay(r,info){const shell=$('#v15-ocr-overlay [data-v152-image-shell]');if(!shell)return;let layer=$('.v161-snap-overlay',shell);if(!layer){layer=document.createElement('div');layer.className='v161-snap-overlay';shell.appendChild(layer);}const box=r.targetBBox||calcTarget(r),parts=[];if(info&&info.x)parts.push(`<i class="v161-snap-line vertical" style="left:${info.x.candidate.v*100}%"><b>${esc(info.x.candidate.label)}</b></i>`);if(info&&info.y)parts.push(`<i class="v161-snap-line horizontal" style="top:${info.y.candidate.v*100}%"><b>${esc(info.y.candidate.label)}</b></i>`);const d=info&&info.distances;if(d&&d.x)parts.push(`<span class="v161-distance horizontal" style="left:${Math.min(d.x.from,d.x.to)*100}%;top:${d.x.y*100}%;width:${Math.abs(d.x.to-d.x.from)*100}%">↔ ${(d.x.value*100).toFixed(1)}%</span>`);if(d&&d.y)parts.push(`<span class="v161-distance vertical" style="left:${d.y.x*100}%;top:${Math.min(d.y.from,d.y.to)*100}%;height:${Math.abs(d.y.to-d.y.from)*100}%">↕ ${(d.y.value*100).toFixed(1)}%</span>`);layer.innerHTML=parts.join('');}
  function clearSnapOverlay(){const el=$('#v15-ocr-overlay .v161-snap-overlay');if(el)el.remove();}

  document.addEventListener('click',e=>{
    const s=state();if(!s||!s.open)return;
    const auditToggle=e.target.closest('[data-v180-audit-toggle]');if(auditToggle){e.preventDefault();e.stopImmediatePropagation();s.v155.v180AuditShowAll=!s.v155.v180AuditShowAll;scheduleEnhance();return;}
    const auditDetail=e.target.closest('[data-v180-audit-detail]');if(auditDetail){e.preventDefault();e.stopImmediatePropagation();auditDetailDialog(auditDetail.dataset.v180AuditDetail);return;}
    const auditRollback=e.target.closest('[data-v180-audit-rollback]');if(auditRollback){e.preventDefault();e.stopImmediatePropagation();rollbackAudit(auditRollback.dataset.v180AuditRollback);return;}
  },true);

  document.addEventListener('pointerdown',e=>{
    const s=state();if(!s||!s.open)return;
    const resetBtn=e.target.closest('[data-v162-mini-reset]');if(resetBtn){e.preventDefault();e.stopImmediatePropagation();s.v155.v180LastMiniResetAt=Date.now();const r=active();if(r){pushHistory('小图校正恢复前',true);restoreOriginalRange(r);auditAction('恢复原始范围',r,'恢复到首次识别基线');pushHistory('小图校正恢复原始范围',true);toast('已恢复到首次识别的原始范围','ok');rerender();}return;}
    const insideBtn=e.target.closest('[data-v180-mini-inside]');if(insideBtn){e.preventDefault();e.stopImmediatePropagation();const r=active();if(r){pushHistory('移回画布前',true);moveRegionInside(r);auditAction('移回画布',r,'按 1% 安全边距重新放入画布');pushHistory('移回画布',true);toast('区域已移回画布安全范围','ok');rerender();}return;}
    if(e.target.closest('[data-v159-canvas-float]'))return;
    if(e.target.closest('[data-v155-transform],[data-v155-transform-number]'))beginTransformInteraction();
    const lockedNative=e.target.closest('[data-v154-region-box]');if(s.correctionMode&&lockedNative){const r=region(lockedNative.dataset.v154RegionBox);if(r&&r.locked){e.preventDefault();e.stopImmediatePropagation();toast('该区域已锁定，请先解锁','bad');return;}}
    const miniTarget=e.target.closest('[data-v162-mini-target]');if(miniTarget){const r=region(miniTarget.dataset.v162MiniTarget);if(!r||r.locked)return;e.preventDefault();e.stopImmediatePropagation();if(!(s.selected||[]).includes(r.id)){toast('该区域已关闭，不能进入小图校正模式','bad');return;}/* 小图本身始终对应当前区域，拖动开始时禁止热切换重绘，否则旧节点会在 pointerdown 阶段被销毁。 */s.activeId=r.id;const stage=miniTarget.closest('[data-v162-mini-stage]'),rect=stage&&stage.getBoundingClientRect();if(!rect||!rect.width||!rect.height)return;const fitLock=lockMiniResizeViewport(stage);beginTransformInteraction();const box=r.targetBBox||calcTarget(r),handle=e.target.closest('[data-v162-mini-handle]');miniDrag={pointerId:e.pointerId,rect,startX:e.clientX,startY:e.clientY,regionId:r.id,handle:handle?handle.dataset.v162MiniHandle:'move',box:Object.assign({},box),before:historySnapshot('小图校正前'),targetEl:miniTarget,stageEl:stage,fitLock,zoom:Math.max(1,Number(s.v155.v162Mini&&s.v155.v162Mini.zoom)||1)};try{(stage||miniTarget).setPointerCapture?.(e.pointerId);}catch(_e){}return;}
    const target=e.target.closest('[data-v155-target-box]');if(target&&!s.correctionMode){const r=region(target.dataset.v155TargetBox);if(!r||r.locked)return;e.preventDefault();e.stopImmediatePropagation();if(!(s.selected||[]).includes(r.id)){toast('该区域已关闭，点击区域块不会重新启用','bad');return;}if(typeof window.__V168_HOT_SWITCH_REGION==='function')window.__V168_HOT_SWITCH_REGION(r.id,{select:true,scroll:false,keepView:true});else s.activeId=r.id;const img=$('[data-v152-image-shell] img');if(!img)return;const rect=img.getBoundingClientRect(),handle=e.target.closest('[data-v168-target-handle]'),box=r.targetBBox||calcTarget(r);targetDrag={pointerId:e.pointerId,rect,startX:e.clientX,startY:e.clientY,regionId:r.id,handle:handle?handle.dataset.v168TargetHandle:'move',box:Object.assign({},box),moveX:Number(r.transform.move_x_canvas_pct)||0,moveY:Number(r.transform.move_y_canvas_pct)||0,before:historySnapshot('整图区域编辑前')};try{target.setPointerCapture?.(e.pointerId);}catch(_e){}return;}
    const native=e.target.closest('[data-v154-region-box]');if(s.correctionMode&&native){correctionBefore=historySnapshot('人工校正前');}
  },true);
  document.addEventListener('pointermove',e=>{
    if(miniDrag&&e.pointerId===miniDrag.pointerId){const r=region(miniDrag.regionId);if(!r)return;e.preventDefault();const zoom=Math.max(1,Number(miniDrag.zoom)||1),dx=(e.clientX-miniDrag.startX)/(miniDrag.rect.width*zoom),dy=(e.clientY-miniDrag.startY)/(miniDrag.rect.height*zoom),b=Object.assign({},miniDrag.box),min=.01,h=miniDrag.handle;
      if(h==='move'){b.x+=dx;b.y+=dy;}else{if(h.includes('w')){b.x+=dx;b.width-=dx;}if(h.includes('e'))b.width+=dx;if(h.includes('n')){b.y+=dy;b.height-=dy;}if(h.includes('s'))b.height+=dy;b.width=Math.min(1,Math.max(min,b.width));b.height=Math.min(1,Math.max(min,b.height));}
      b.x=Math.max(0,Math.min(1-b.width,b.x));b.y=Math.max(0,Math.min(1-b.height,b.y));
      const src=r.sourceBBox,tr=r.transform,scale=Math.max(.05,Number(tr.scale_pct||100)/100);tr.move_x_canvas_pct=round((b.x-src.x-(src.width-b.width)/2)*100,4);tr.move_y_canvas_pct=round((b.y-src.y-(src.height-b.height)/2)*100,4);tr.width_pct=round(b.width/(Math.max(.0001,src.width)*scale)*100,4);tr.height_pct=round(b.height/(Math.max(.0001,src.height)*scale)*100,4);refreshRegion(r);updateTransformLive(r);
      const el=miniDrag.targetEl&&miniDrag.targetEl.isConnected?miniDrag.targetEl:$(`[data-v162-mini-target="${CSS.escape(String(r.id))}"]`);if(el){const t=r.targetBBox||calcTarget(r);el.style.left=`${t.x*100}%`;el.style.top=`${t.y*100}%`;el.style.width=`${t.width*100}%`;el.style.height=`${t.height*100}%`;const values={x:['X',t.x],y:['Y',t.y],width:['W',t.width],height:['H',t.height]};Object.entries(values).forEach(([k,[label,v]])=>{const out=$(`[data-v162-mini-value="${k}"]`);if(out)out.textContent=`${label} ${(v*100).toFixed(1)}%`;});}updateMiniBoundaryLive(r);
      return;
    }
    if(!targetDrag||e.pointerId!==targetDrag.pointerId)return;const r=region(targetDrag.regionId);if(!r)return;e.preventDefault();const dx=(e.clientX-targetDrag.startX)/targetDrag.rect.width,dy=(e.clientY-targetDrag.startY)/targetDrag.rect.height,h=targetDrag.handle,b=Object.assign({},targetDrag.box),min=.01;if(h==='move'){r.transform.move_x_canvas_pct=round(targetDrag.moveX+dx*100,3);r.transform.move_y_canvas_pct=round(targetDrag.moveY+dy*100,3);refreshRegion(r);const snap=applySmartSnap(r,targetDrag.rect);renderSnapOverlay(r,snap);}else{if(h.includes('w')){b.x+=dx;b.width-=dx;}if(h.includes('e'))b.width+=dx;if(h.includes('n')){b.y+=dy;b.height-=dy;}if(h.includes('s'))b.height+=dy;b.width=Math.max(min,Math.min(1,b.width));b.height=Math.max(min,Math.min(1,b.height));b.x=Math.max(0,Math.min(1-b.width,b.x));b.y=Math.max(0,Math.min(1-b.height,b.y));const src=r.sourceBBox,tr=r.transform,scale=Math.max(.05,Number(tr.scale_pct||100)/100);tr.move_x_canvas_pct=round((b.x-src.x-(src.width-b.width)/2)*100,4);tr.move_y_canvas_pct=round((b.y-src.y-(src.height-b.height)/2)*100,4);tr.width_pct=round(b.width/(Math.max(.0001,src.width)*scale)*100,4);tr.height_pct=round(b.height/(Math.max(.0001,src.height)*scale)*100,4);refreshRegion(r);}r.manualCorrected=true;updateTransformLive(r);
  },true);
  document.addEventListener('pointerup',e=>{
    if(miniDrag&&e.pointerId===miniDrag.pointerId){const drag=miniDrag;miniDrag=null;try{(drag.stageEl||drag.targetEl)?.releasePointerCapture?.(e.pointerId);}catch(_e){}endTransformInteraction(false);pushHistory(drag.handle==='move'?'小图拖动区域':'小图四角缩放区域');rerender();requestAnimationFrame(()=>requestAnimationFrame(()=>{unlockMiniResizeViewport(document.querySelector('#v15-ocr-overlay [data-v162-mini-stage]'));if(typeof window.__V188_FIT_MINI_STAGE__==='function'){const next=document.querySelector('#v15-ocr-overlay [data-v162-mini-stage]');if(next)window.__V188_FIT_MINI_STAGE__(next,{persist:false});}}));return;}
    if(transformInteracting&&e.target&&e.target.closest&&e.target.closest('[data-v155-transform],[data-v155-transform-number]'))endTransformInteraction(false);
    if(targetDrag&&e.pointerId===targetDrag.pointerId){const r=region(targetDrag.regionId),mode=targetDrag.handle;targetDrag=null;clearSnapOverlay();if(r){r.manualCorrected=true;pushHistory(mode==='move'?'整图拖动区域':'整图调整区域尺寸');rerender();}return;}
    if(correctionBefore){const before=correctionBefore;correctionBefore=null;setTimeout(()=>{const s=state();initRegions().forEach(r=>{const current=baseBox(r);if(!sameBox(current,r.sourceBBox)){r.sourceBBox=current;r.targetBBox=calcTarget(r);r.manualCorrected=true;r.updated_at=new Date().toISOString();}});pushHistory('识别框人工校正',true);scheduleEnhance();},60);}
  },true);

  document.addEventListener('pointercancel',e=>{
    if(miniDrag&&e.pointerId===miniDrag.pointerId){const drag=miniDrag;miniDrag=null;try{(drag.stageEl||drag.targetEl)?.releasePointerCapture?.(e.pointerId);}catch(_e){}endTransformInteraction(false);unlockMiniResizeViewport(drag.stageEl);scheduleEnhance();}
  },true);

  document.addEventListener('toggle',e=>{const s=state();if(!s||!s.open)return;const group=e.target&&e.target.closest&&e.target.closest('[data-v180-closed-group]');if(group){s.v155.v180ClosedExpanded[group.dataset.v180ClosedGroup]=!!group.open;return;}/* V16 专业面板改为显式按钮切换，保留空监听兼容旧项目。 */},true);

  document.addEventListener('keydown',e=>{const s=state();if(!s||!s.open)return;const tag=(e.target&&e.target.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag))return;if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();}else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();}},true);

  const observer=new MutationObserver(scheduleEnhance);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-v15-ocr-open]'))setTimeout(scheduleEnhance,80);},true);

  if(typeof adjustWorkspaceHtml==='function'){
    const base=adjustWorkspaceHtml;
    adjustWorkspaceHtml=function(){return base().replace(/V15\.[4-7]/g,'V18').replace(/V15\.3/g,'V18').replace('新增识别区域直接编辑：区域选择、局部识别、自由添加区域与统一调整入口。','按《智能区域编辑工作台 PRD V1.0》建立统一 Region 数据层：坐标、变换、蒙版、提示词、JSON、检查、预览和版本闭环。');};
  }
  if(typeof adjustProjectPayload==='function'){
    const base=adjustProjectPayload;
    adjustProjectPayload=function(mode='full'){const p=base(mode);p.schema='ai_image_adjustment_project_v18';p.version=VERSION;p.state=p.state||{};const s=state();p.state.v155SmartRegionWorkspace=true;p.state.v155RegionData=s&&s.result?{imageKey:String(s.v22ImageKey||s.result.imageKey||''),imageRevision:Number(s.v22ImageRevision)||0,recognitionEpoch:Number(s.v22AppliedRecognitionEpoch||s.result.recognitionEpoch)||0,regions:clone(initRegions()),selected:clone(s.selected||[]),activeId:s.activeId,validation:clone(s.v155.validation||[]),previewReady:!!s.v155.previewReady,history:mode==='full'?clone(s.v155.history||[]):[],audit:mode==='full'?clone(s.v155.v179Audit||[]):[],closedExpanded:clone(s.v155.v180ClosedExpanded||{}),auditShowAll:!!s.v155.v180AuditShowAll}:null;return p;};
  }

  if(typeof adjustImportProjectFile==='function'){
    const baseImportProject=adjustImportProjectFile;
    adjustImportProjectFile=async function(file){
      let extra=null;
      try{const raw=JSON.parse(await file.text());extra=raw&&raw.state&&raw.state.v155RegionData||null;}catch(e){}
      await baseImportProject(file);
      if(extra&&Array.isArray(extra.regions)){
        const s=state(),restoredSrc=adjustState.originalSrc||adjustState.src||s.src,restoredName=adjustState.originalName||adjustState.name||s.name||'restored-image',restoredKey=String(extra.imageKey||`restored:${restoredName}:${String(restoredSrc||'').length}`);s.src=restoredSrc;s.name=restoredName;s.source='main';s.v22ImageKey=restoredKey;s.v22ImageRevision=Number(extra.imageRevision)||((Number(s.v22ImageRevision)||0)+1);s.v22AppliedRecognitionEpoch=Number(extra.recognitionEpoch)||1;s.v22RecognitionEpoch=Math.max(Number(s.v22RecognitionEpoch)||0,s.v22AppliedRecognitionEpoch);v22ResetRegionWorkspace('project-restore',{preserveUi:true,imageKey:restoredKey});s.result={jobId:'RESTORED-V22',model:'project-restore',imageKey:restoredKey,imageRevision:s.v22ImageRevision,recognitionEpoch:s.v22AppliedRecognitionEpoch,regions:clone(extra.regions),documentBlocks:[],markdown:'',raw:{restored:true,imageKey:restoredKey,regions:clone(extra.regions)}};s.selected=clone(extra.selected||extra.regions.map(r=>r.id));s.activeId=extra.activeId||extra.regions[0]?.id||'';s.v155.validation=clone(extra.validation||[]);s.v155.previewReady=!!extra.previewReady;s.v155.history=clone(extra.history||[]);s.v155.historyIndex=s.v155.history.length-1;s.v155.v179Audit=clone(extra.audit||[]);s.v155.v180ClosedExpanded=Object.assign({misrecognized:true,duplicate:true,defer:true,unmarked:true},extra.closedExpanded||{});s.v155.v180AuditShowAll=!!extra.auditShowAll;s.v155.v22ImageKey=restoredKey;initRegions();if(typeof setActionStatus==='function')setActionStatus('success',`V24 智能区域数据已恢复（${extra.regions.length} 个区域）`,false);
      }
    };
  }
  if(typeof adjustOpenProjectSave==='function'){
    const baseOpenSave=adjustOpenProjectSave;
    adjustOpenProjectSave=function(){baseOpenSave();setTimeout(()=>{$$('.modal h3,.modal-card h3').forEach(el=>{if(/保存 V15(?:\.\d+)? 微调项目/.test(el.textContent||''))el.textContent='保存 V18 微调项目';});},0);};
  }
  if(typeof adjustInstructionPayload==='function'){
    const base=adjustInstructionPayload;
    adjustInstructionPayload=function(ids){const p=base(ids);p.version=VERSION;p.regionTemplateMode='smart_region_full_view_rerecognition_v168';p.smartRegionTask=projectTask();return p;};
  }
  if(typeof adjustExportProject==='function'){
    const old=adjustExportProject;
    adjustExportProject=function(mode){if(!mode)return old(mode);const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),baseName=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${baseName}-微调项目-v18-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);if(typeof setActionStatus==='function')setActionStatus('success',`V18 ${mode==='light'?'轻量':'完整'}项目已保存`,false);};
  }
  window.__V163_REGION_HISTORY_PUSH=(label,force)=>pushHistory(label||'区域操作',!!force);
  window.__V163_REGION_HISTORY_UNDO=()=>undo();
  window.__V163_REGION_HISTORY_REDO=()=>redo();
  window.__V22_REGION_BINDING_DIAGNOSTICS__=()=>{const s=state(),rows=initRegions();return{version:VERSION,imageKey:s&&s.v22ImageKey||'',imageRevision:Number(s&&s.v22ImageRevision)||0,recognitionEpoch:Number(s&&s.v22AppliedRecognitionEpoch)||0,historyCount:s&&s.v155&&s.v155.history?s.v155.history.length:0,workspaceImageKey:s&&s.v155&&s.v155.v22ImageKey||'',regions:rows.map(r=>({id:r.id,region_id:r.region_id,imageKey:r.v22ImageKey||'',recognitionEpoch:Number(r.v22RecognitionEpoch)||0,geometryBound:Number(r.v22GeometryBound)||0,raw:baseBox(r),source:r.sourceBBox,target:r.targetBBox,aligned:sameBox(baseBox(r),r.sourceBBox)})),misaligned:rows.filter(r=>Number(r.v22RecognitionEpoch)===Number(s.v22AppliedRecognitionEpoch)&&!sameBox(baseBox(r),r.sourceBBox)).map(r=>r.id)};};
  window.__V163_REGION_HISTORY_STATE=()=>{const x=state();return x?{index:x.v155.historyIndex,length:x.v155.history.length}:null;};
  window.__V163_TEST__={
    version:VERSION,
    defaultTransform:()=>clone(defaultTransform({})),
    panelHtml:()=>{initRegions();return transformPanel();},
    calcTarget:r=>{const x=initRegion(clone(r),0);return clone(calcTarget(x));},
    independentSize:(r,w,h)=>{const x=initRegion(clone(r),0);x.transform.width_pct=w;x.transform.height_pct=h;x.transform.free_aspect=true;refreshRegion(x);return{width_pct:x.transform.width_pct,height_pct:x.transform.height_pct,target:clone(x.targetBBox)};},
    historyState:()=>{const s=state();return s?{index:s.v155.historyIndex,length:s.v155.history.length,active:s.activeId}:null;},
    snapActive:(width=1000,height=1000)=>{const r=active();if(!r)return null;refreshRegion(r);const info=applySmartSnap(r,{width,height});return{transform:clone(r.transform),target:clone(r.targetBBox),x:info.x?info.x.candidate.label:null,y:info.y?info.y.candidate.label:null};},
    resetActive:()=>{const r=active();if(!r)return null;pushHistory('测试重置前',true);r.transform=defaultTransform(r);refreshRegion(r);pushHistory('测试重置',true);return clone(r.transform);},
    restoreOriginalActive:()=>{const r=active();if(!r)return null;pushHistory('测试恢复原始范围前',true);restoreOriginalRange(r);pushHistory('测试恢复原始范围',true);return{source:clone(r.sourceBBox),target:clone(r.targetBBox),transform:clone(r.transform),initial:clone(r.initialBBox)};},
    boundaryActive:()=>{const r=active();return r?clone(boundaryInfo(r)):null;},
    moveInsideActive:()=>{const r=active();if(!r)return null;moveRegionInside(r);return{target:clone(r.targetBBox),boundary:clone(boundaryInfo(r))};},
    auditState:()=>{const s=state();return s?{count:s.v155.v179Audit.length,showAll:s.v155.v180AuditShowAll,closedExpanded:clone(s.v155.v180ClosedExpanded)}:null;},
    undo:()=>undo(),redo:()=>redo()
  };
  window.__V162_TEST__=window.__V163_TEST__;
  window.openV155SmartRegionWorkspace=function(){const fn=window.openV154OcrWorkspace||window.openV153OcrWorkspace;if(fn)fn();setTimeout(scheduleEnhance,60);};
  requestAnimationFrame(()=>{if(typeof curView!=='undefined'&&curView==='adjust'&&typeof renderAdjustView==='function')renderAdjustView();scheduleEnhance();});
})();


/* --- Focused task view and detail drawer --- */
/* ===== V18：稳定详情抽屉、默认窄标签与滚动位置保护 ===== */
(function(){
  'use strict';
  if(typeof adjustState==='undefined') return;
  const VERSION='V24';
  const $=(q,r=document)=>r.querySelector(q);
  const $$=(q,r=document)=>Array.from(r.querySelectorAll(q));
  const setText=(el,value)=>{const next=String(value??'');if(el&&el.textContent!==next)el.textContent=next;};
  let applying=false, scheduled=false;

  function ocrState(){
    const s=adjustState.v15Ocr;
    if(!s||typeof s!=='object') return null;
    if(!s.v157||typeof s.v157!=='object') s.v157={mode:'canvas',transformExpanded:false,lastNonCanvas:'details'};
    if(!['files','regions','canvas','adjust','details'].includes(s.v157.mode)) s.v157.mode='canvas';
    if(!s.v162Ui||typeof s.v162Ui!=='object')s.v162Ui={detailsOpen:true,detailsCollapsed:true};
    return s;
  }
  function schedule(){
    if(scheduled)return;scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;applyLayout();});
  }
  function activeSummary(){
    const s=ocrState(), rows=s&&s.result&&Array.isArray(s.result.regions)?s.result.regions:[];
    const r=rows.find(x=>String(x.id)===String(s&&s.activeId))||rows[0];
    if(!r)return {title:'请选择一个区域',sub:'点击区域框或区域列表后开始调整'};
    const t=r.transform||{};
    return {title:String(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'当前区域'),sub:`水平 ${Number(t.move_x_canvas_pct||0).toFixed(1)}% · 垂直 ${Number(t.move_y_canvas_pct||0).toFixed(1)}% · 缩放 ${Number(t.scale_pct||100).toFixed(1)}%`};
  }
  function navHtml(compact){
    const items=[
      ['files','▤','文件'],['regions','◉','区域'],['canvas','▣','画布'],
      ['adjust','⌁','调整'],['details','≡','详情']
    ];
    const cls=compact?'v157-dock':'v157-segmented';
    return `<nav class="${cls}" aria-label="工作台视图">${items.map(([id,icon,label])=>`<button type="button" data-v157-mode="${id}" title="${label}"><i>${icon}</i><span>${label}</span></button>`).join('')}</nav>`;
  }
  function ensureHeader(overlay){
    const header=$('.v15-ocr-header',overlay), title=$('.v15-ocr-title b',overlay), sub=$('.v15-ocr-title small',overlay);
    setText(title,'智能区域编辑工作台 · V27.9');
    setText(sub,'轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复');
    if(header&&!$('.v157-segmented',header)){
      const wrap=document.createElement('div');wrap.innerHTML=navHtml(false);const nav=wrap.firstElementChild;
      const right=$('.v15-ocr-head-right',header);right?header.insertBefore(nav,right):header.appendChild(nav);
    }
  }
  function ensureDock(overlay){
    if(!$('.v157-dock',overlay)){
      const wrap=document.createElement('div');wrap.innerHTML=navHtml(true);const dock=wrap.firstElementChild;
      const footer=$('.v15-ocr-footer',overlay);footer?overlay.insertBefore(dock,footer):overlay.appendChild(dock);
    }
    if(!$('.v157-sheet-scrim',overlay)){
      const scrim=document.createElement('div');scrim.className='v157-sheet-scrim';scrim.dataset.v157CloseSheet='';
      const body=$('.v15-ocr-body',overlay);body&&body.appendChild(scrim);
    }
  }
  function ensureSheetHead(sheet,type){
    if(!sheet||$('.v157-sheet-head',sheet))return;
    const head=document.createElement('div');head.className='v157-sheet-head';
    head.innerHTML=type==='left'?`<b>工作台资源</b><button type="button" class="v157-sheet-close" data-v157-close-sheet aria-label="关闭">×</button>`:`<b>区域详情</b><span class="v162-detail-actions"><button type="button" class="v162-detail-collapse" data-v162-detail-collapse aria-label="收起为二级菜单">→</button><button type="button" class="v157-sheet-close" data-v162-detail-close aria-label="关闭详情">×</button></span>`;
    sheet.prepend(head);
  }
  function ensureDetailReopen(overlay){let btn=$('[data-v162-detail-reopen]',overlay);if(!btn){btn=document.createElement('button');btn.type='button';btn.className='v162-detail-reopen';btn.dataset.v162DetailReopen='';btn.innerHTML='<span>详情</span><i>←</i>';overlay.appendChild(btn);}const s=ocrState();btn.hidden=!(s&&s.v162Ui&&s.v162Ui.detailsCollapsed);}
  function ensureTransformSummary(overlay){
    const host=$('.v155-transform-host',overlay);if(!host)return;
    let bar=$('.v157-transform-summary',host);
    const info=activeSummary();
    if(!bar){
      bar=document.createElement('div');bar.className='v157-transform-summary';bar.dataset.v157TransformToggle='';
      bar.innerHTML='<span class="v157-transform-grabber"></span><i>⌁</i><div><b></b><small></small></div><button type="button" aria-label="展开参数">⌃</button>';
      host.prepend(bar);
    }
    const b=$('b',bar),sm=$('small',bar);setText(b,info.title);setText(sm,info.sub);
  }
  function setNativeView(view){
    const s=ocrState();if(!s||!s.v155)return;
    if(view==='details'){
      s.v155.view='native';s.tab='combined';
      const target=$('[data-v15-tab="combined"]');
      if(target&&!target.classList.contains('on'))target.click();
    }
  }
  function scrollSnapshot(overlay){const body=overlay&&$('.v15-ocr-body',overlay),stage=overlay&&$('.v15-ocr-stage',overlay),main=overlay&&$('.v160-adjust-main',overlay),side=overlay&&$('.v160-side-content',overlay);return{wy:window.scrollY||0,body:body?body.scrollTop:0,stage:stage?stage.scrollTop:0,main:main?main.scrollTop:0,side:side?side.scrollTop:0};}
  function restoreSnapshot(pos,overlay){requestAnimationFrame(()=>{const current=$('#v15-ocr-overlay')||overlay;window.scrollTo(0,pos.wy||0);const body=current&&$('.v15-ocr-body',current),stage=current&&$('.v15-ocr-stage',current),main=current&&$('.v160-adjust-main',current),side=current&&$('.v160-side-content',current);if(body)body.scrollTop=pos.body||0;if(stage)stage.scrollTop=pos.stage||0;if(main)main.scrollTop=pos.main||0;if(side)side.scrollTop=pos.side||0;});}
  function setMode(mode,opts={}){
    const s=ocrState();if(!s)return;const ui=s.v162Ui,overlay=$('#v15-ocr-overlay'),pos=scrollSnapshot(overlay);
    if(mode==='details'){
      const open=ui.detailsOpen&&!ui.detailsCollapsed;
      if(opts.toggle!==false&&open){ui.detailsOpen=true;ui.detailsCollapsed=true;}
      else{ui.detailsOpen=true;ui.detailsCollapsed=false;setNativeView('details');}
      if(s.v157.mode==='canvas')s.v157.mode='adjust';s.v157.transformExpanded=true;
    }else{
      const current=s.v157.mode,canToggle=['files','regions','adjust'].includes(mode),closing=opts.toggle!==false&&canToggle&&current===mode;
      s.v157.mode=closing?'canvas':mode;if(s.v157.mode!=='canvas')s.v157.lastNonCanvas=s.v157.mode;
      if(s.v157.mode==='adjust')s.v157.transformExpanded=true;else if(s.v157.mode==='canvas')s.v157.transformExpanded=false;
    }
    if(overlay){applyMode(overlay);restoreSnapshot(pos,overlay);}schedule();
  }
  function applyMode(overlay){
    const s=ocrState(),mode=s.v157.mode,ui=s.v162Ui;
    overlay.classList.remove('v157-left-open','v157-right-open','v162-detail-collapsed');
    [...overlay.classList].filter(x=>x.startsWith('v157-mode-')).forEach(x=>overlay.classList.remove(x));
    overlay.classList.add(`v157-mode-${mode}`);
    if(mode==='files'||mode==='regions')overlay.classList.add('v157-left-open');
    if(ui.detailsOpen&&!ui.detailsCollapsed)overlay.classList.add('v157-right-open');
    if(ui.detailsCollapsed)overlay.classList.add('v162-detail-collapsed');
    const host=$('.v155-transform-host',overlay);if(host)host.classList.toggle('v157-expanded',!!s.v157.transformExpanded||mode==='adjust');
    $$('[data-v157-mode]',overlay).forEach(btn=>{let on=btn.dataset.v157Mode===mode;if(btn.dataset.v157Mode==='details')on=ui.detailsOpen;btn.classList.toggle('on',on);btn.setAttribute('aria-pressed',on?'true':'false');btn.setAttribute('aria-expanded',on?'true':'false');});
    const side=$('.v15-ocr-sidebar',overlay),results=$('.v15-ocr-results',overlay);
    if(side)side.setAttribute('aria-hidden',!(mode==='files'||mode==='regions'));
    if(results)results.setAttribute('aria-hidden',!(ui.detailsOpen&&!ui.detailsCollapsed));
    ensureDetailReopen(overlay);
  }
  function applyLayout(){
    if(applying)return;
    const s=ocrState(),overlay=$('#v15-ocr-overlay');if(!s||!s.open||!overlay)return;
    applying=true;
    try{
      overlay.classList.add('v157-ios-ui');
      ensureHeader(overlay);ensureDock(overlay);
      ensureSheetHead($('.v15-ocr-sidebar',overlay),'left');
      ensureSheetHead($('.v15-ocr-results',overlay),'right');
      ensureTransformSummary(overlay);ensureDetailReopen(overlay);
      applyMode(overlay);
      if(document.title!==(window.__APP_TITLE__||'V27.9 · 图灵线框工作台'))document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
    }finally{applying=false;}
  }

  document.addEventListener('click',e=>{
    const s=ocrState();if(!s||!s.open)return;
    const mode=e.target.closest('[data-v157-mode]');
    if(mode){e.preventDefault();e.stopImmediatePropagation();setMode(mode.dataset.v157Mode,{toggle:true});return;}
    if(e.target.closest('[data-v162-detail-collapse]')){e.preventDefault();e.stopImmediatePropagation();const o=$('#v15-ocr-overlay'),p=scrollSnapshot(o);s.v162Ui.detailsOpen=true;s.v162Ui.detailsCollapsed=true;applyMode(o);restoreSnapshot(p,o);return;}
    if(e.target.closest('[data-v162-detail-close]')){e.preventDefault();e.stopImmediatePropagation();const o=$('#v15-ocr-overlay'),p=scrollSnapshot(o);s.v162Ui.detailsOpen=false;s.v162Ui.detailsCollapsed=false;applyMode(o);restoreSnapshot(p,o);return;}
    if(e.target.closest('[data-v162-detail-reopen]')){e.preventDefault();e.stopImmediatePropagation();const o=$('#v15-ocr-overlay'),p=scrollSnapshot(o);s.v162Ui.detailsOpen=true;s.v162Ui.detailsCollapsed=false;setNativeView('details');applyMode(o);restoreSnapshot(p,o);return;}
    if(e.target.closest('[data-v157-close-sheet],[data-v157-close-sheet] *')){e.preventDefault();e.stopImmediatePropagation();if(s.v157.mode==='files'||s.v157.mode==='regions')setMode('canvas',{toggle:false});return;}
    const summary=e.target.closest('[data-v157-transform-toggle]');
    if(summary){e.preventDefault();e.stopImmediatePropagation();setMode(s.v157.mode==='adjust'?'canvas':'adjust',{toggle:false});return;}
    if(e.target.closest('[data-v155-select-region],[data-v155-target-box],[data-v154-region-box]'))setTimeout(schedule,30);
  },true);
  document.addEventListener('keydown',e=>{
    const s=ocrState();if(!s||!s.open)return;
    if(e.key==='Escape'){if(s.v162Ui.detailsOpen){e.preventDefault();s.v162Ui.detailsOpen=false;s.v162Ui.detailsCollapsed=false;applyMode($('#v15-ocr-overlay'));}else if(s.v157.mode==='files'||s.v157.mode==='regions'){e.preventDefault();setMode('canvas',{toggle:false});}}
    if((e.ctrlKey||e.metaKey)&&e.key==='1'){e.preventDefault();setMode('canvas',{toggle:false});}
    if((e.ctrlKey||e.metaKey)&&e.key==='2'){e.preventDefault();setMode('regions',{toggle:false});}
    if((e.ctrlKey||e.metaKey)&&e.key==='3'){e.preventDefault();setMode('adjust',{toggle:false});}
    if((e.ctrlKey||e.metaKey)&&e.key==='4'){e.preventDefault();setMode('details',{toggle:false});}
  },true);

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('click',e=>{if(e.target.closest('[data-v15-ocr-open]'))setTimeout(schedule,80);},true);

  /* 项目与接口版本升级；内部 v155 状态保留以兼容 V15.5 项目。 */
  if(typeof adjustWorkspaceHtml==='function'){
    const base=adjustWorkspaceHtml;
    adjustWorkspaceHtml=function(){return base().replace(/V15\.[4-8]/g,'V18').replace('按《智能区域编辑工作台 PRD V1.0》建立统一 Region 数据层：坐标、变换、蒙版、提示词、JSON、检查、预览和版本闭环。','V18 使用区域校正小图替代构图约束，并让调整页与详情二级抽屉同时工作。');};
  }
  if(typeof adjustProjectPayload==='function'){
    const base=adjustProjectPayload;
    adjustProjectPayload=function(mode='full'){
      const p=base(mode);p.schema='ai_image_adjustment_project_v18';p.version=VERSION;p.state=p.state||{};
      const s=ocrState();p.state.v162IosWorkspace=true;p.state.v162Ui=s?{mode:s.v157.mode,transformExpanded:!!s.v157.transformExpanded,detailsOpen:!!s.v162Ui.detailsOpen,detailsCollapsed:!!s.v162Ui.detailsCollapsed}:null;p.state.v161Ui=p.state.v162Ui;p.state.v16Ui=p.state.v162Ui;p.state.v158Ui=p.state.v162Ui;p.state.v157Ui=p.state.v162Ui;
      return p;
    };
  }
  if(typeof adjustInstructionPayload==='function'){
    const base=adjustInstructionPayload;
    adjustInstructionPayload=function(ids){const p=base(ids);p.version=VERSION;p.regionTemplateMode='smart_region_full_view_rerecognition_v168';if(p.smartRegionTask)p.smartRegionTask.workspace_version=VERSION;return p;};
  }
  if(typeof adjustImportProjectFile==='function'){
    const base=adjustImportProjectFile;
    adjustImportProjectFile=async function(file){
      let ui=null;try{const raw=JSON.parse(await file.text());ui=raw&&raw.state&&(raw.state.v162Ui||raw.state.v161Ui||raw.state.v16Ui||raw.state.v158Ui||raw.state.v157Ui)||null;}catch(_e){}
      await base(file);const s=ocrState();if(ui&&s){s.v157.mode=ui.mode||'canvas';s.v157.transformExpanded=!!ui.transformExpanded;s.v162Ui.detailsOpen=!!ui.detailsOpen;s.v162Ui.detailsCollapsed=!!ui.detailsCollapsed;}setTimeout(schedule,80);
    };
  }
  if(typeof adjustExportProject==='function'){
    const base=adjustExportProject;
    adjustExportProject=function(mode){
      if(!mode)return base(mode);
      const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');
      const baseName=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');
      a.href=URL.createObjectURL(blob);a.download=`${baseName}-微调项目-v18-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);
      if(typeof setActionStatus==='function')setActionStatus('success',`V18 ${mode==='light'?'轻量':'完整'}项目已保存`,false);
    };
  }
  requestAnimationFrame(schedule);
})();


/* --- V18 stable detail, focus preview and shortcuts --- */
/* ===== V18：稳定详情交互、区域聚焦预览、快捷键 ===== */
(function(){
  'use strict';
  if(typeof adjustState==='undefined')return;
  const VERSION='V24';
  const $=(q,r=document)=>r.querySelector(q);
  let focusDrag=null;

  function state(){
    const s=adjustState.v15Ocr;
    if(!s||typeof s!=='object')return null;
    if(typeof s.focusMode!=='boolean')s.focusMode=false;
    if(!s.v162Ui||typeof s.v162Ui!=='object')s.v162Ui={detailsOpen:false,detailsCollapsed:true};
    if(!s.v157||typeof s.v157!=='object')s.v157={mode:'canvas',transformExpanded:false,lastNonCanvas:'details'};
    return s;
  }
  function region(){
    const s=state(),rows=s&&s.result&&Array.isArray(s.result.regions)?s.result.regions:[];
    return rows.find(r=>String(r.id)===String(s.activeId))||rows[0]||null;
  }
  function isEditableTarget(t){
    return !!t&&((t.matches&&t.matches('input,textarea,select,[contenteditable="true"]'))||(t.closest&&t.closest('input,textarea,select,[contenteditable="true"]')));
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
  function boxOf(r){return r&&r.sourceBBox?{x:+r.sourceBBox.x||0,y:+r.sourceBBox.y||0,width:+r.sourceBBox.width||.1,height:+r.sourceBBox.height||.1}:{x:+r.x||0,y:+r.y||0,width:+r.width||.1,height:+r.height||.1};}
  function targetOf(r){const b=boxOf(r),t=r&&r.targetBBox;return t?{x:+t.x||0,y:+t.y||0,width:+t.width||b.width,height:+t.height||b.height}:b;}
  function updateRegionFromBox(r,b){
    const src=boxOf(r),tr=r.transform||(r.transform={move_x_canvas_pct:0,move_y_canvas_pct:0,scale_pct:100,width_pct:100,height_pct:100,rotation_deg:0,anchor:'center',free_aspect:true});
    const scale=Math.max(.05,(+tr.scale_pct||100)/100);
    b.width=clamp(b.width,.008,1);b.height=clamp(b.height,.008,1);b.x=clamp(b.x,0,1-b.width);b.y=clamp(b.y,0,1-b.height);
    tr.width_pct=b.width/(Math.max(.0001,src.width)*scale)*100;
    tr.height_pct=b.height/(Math.max(.0001,src.height)*scale)*100;
    tr.move_x_canvas_pct=(b.x-src.x-(src.width-b.width)/2)*100;
    tr.move_y_canvas_pct=(b.y-src.y-(src.height-b.height)/2)*100;
    tr.anchor='center';tr.free_aspect=true;
    r.targetBBox={x:b.x,y:b.y,width:b.width,height:b.height};
    r.updated_at=new Date().toISOString();r.status='editing';r.review_status='editing';
    return r;
  }
  function finalTarget(r){
    try{if(window.__V163_TEST__&&typeof window.__V163_TEST__.calcTarget==='function')return window.__V163_TEST__.calcTarget(r);}catch(_e){}
    return targetOf(r);
  }
  function focusRect(shell){return{cropX:+shell.dataset.cropX||0,cropY:+shell.dataset.cropY||0,cropW:+shell.dataset.cropW||1,cropH:+shell.dataset.cropH||1,rect:shell.getBoundingClientRect()};}
  function renderFocusLive(r,b,shell){
    const c=focusRect(shell),el=shell.querySelector('[data-v164-focus-target]');if(!el)return;
    Object.assign(el.style,{left:(b.x-c.cropX)/c.cropW*100+'%',top:(b.y-c.cropY)/c.cropH*100+'%',width:b.width/c.cropW*100+'%',height:b.height/c.cropH*100+'%'});
    const values={x:b.x,y:b.y,w:b.width,h:b.height};
    Object.entries(values).forEach(([k,v])=>{const out=shell.closest('.v164-focus-wrap')?.querySelector(`[data-v164-focus-value="${k}"]`);if(out)out.textContent=`${k.toUpperCase()} ${(v*100).toFixed(1)}%`;});
    const scale=shell.closest('.v164-focus-wrap')?.querySelector('[data-v164-focus-value="s"]');if(scale)scale.textContent=`缩放 ${Number(r.transform?.scale_pct||100).toFixed(1)}%`;
  }


  window.__V164_UPDATE_FOCUS_LIVE=(r,b)=>{
    const shell=$('[data-v164-focus-shell]');if(!shell||!r||String(shell.dataset.regionId)!==String(r.id))return;
    renderFocusLive(r,b||targetOf(r),shell);
  };

  /* 详情面板中的内部操作只更新内容，不允许抽屉状态被异步重绘改写。 */
  function stabilizeDetail(snapshot){
    const s=state(),overlay=$('#v15-ocr-overlay');if(!s||!overlay)return;
    s.v162Ui.detailsOpen=snapshot.detailsOpen;s.v162Ui.detailsCollapsed=snapshot.detailsCollapsed;
    s.v157.mode=snapshot.mode;s.v157.transformExpanded=snapshot.transformExpanded;
    overlay.classList.toggle('v157-right-open',snapshot.detailsOpen&&!snapshot.detailsCollapsed);
    overlay.classList.toggle('v162-detail-collapsed',snapshot.detailsCollapsed);
    overlay.classList.add('v164-stable-detail');
    const body=$('.v15-ocr-body',overlay),results=$('.v15-result-content',overlay),adjust=$('.v155-transform-host',overlay);
    if(body)body.scrollTop=snapshot.body;if(results)results.scrollTop=snapshot.results;if(adjust)adjust.scrollTop=snapshot.adjust;
  }
  window.addEventListener('click',e=>{
    const s=state(),overlay=$('#v15-ocr-overlay');if(!s||!s.open||!overlay)return;
    const inside=e.target.closest&&e.target.closest('.v15-ocr-results');
    const explicit=e.target.closest&&e.target.closest('[data-v162-detail-collapse],[data-v162-detail-close],[data-v162-detail-reopen],[data-v157-mode]');
    if(!inside||explicit||e.target.closest?.('[data-v163-region-text-input]'))return;
    const snap={detailsOpen:!!s.v162Ui.detailsOpen,detailsCollapsed:!!s.v162Ui.detailsCollapsed,mode:s.v157.mode,transformExpanded:!!s.v157.transformExpanded,body:$('.v15-ocr-body',overlay)?.scrollTop||0,results:$('.v15-result-content',overlay)?.scrollTop||0,adjust:$('.v155-transform-host',overlay)?.scrollTop||0};
    setTimeout(()=>stabilizeDetail(snap),0);requestAnimationFrame(()=>requestAnimationFrame(()=>stabilizeDetail(snap)));
  },true);
  window.addEventListener('change',e=>{
    if(!e.target.closest?.('.v15-ocr-results')||e.target.closest?.('[data-v163-region-text-input]'))return;
    const s=state(),overlay=$('#v15-ocr-overlay');if(!s||!overlay)return;
    const snap={detailsOpen:!!s.v162Ui.detailsOpen,detailsCollapsed:!!s.v162Ui.detailsCollapsed,mode:s.v157.mode,transformExpanded:!!s.v157.transformExpanded,body:$('.v15-ocr-body',overlay)?.scrollTop||0,results:$('.v15-result-content',overlay)?.scrollTop||0,adjust:$('.v155-transform-host',overlay)?.scrollTop||0};
    requestAnimationFrame(()=>requestAnimationFrame(()=>stabilizeDetail(snap)));
  },true);

  window.addEventListener('pointerdown',e=>{
    const target=e.target.closest?.('[data-v164-focus-target]');if(!target)return;
    const s=state(),r=region(),shell=target.closest('[data-v164-focus-shell]');if(!s||!r||!shell||String(r.id)!==String(target.dataset.v164FocusTarget))return;
    e.preventDefault();e.stopImmediatePropagation();
    const c=focusRect(shell),handle=e.target.closest('[data-v164-focus-handle]')?.dataset.v164FocusHandle||'move';
    focusDrag={pointerId:e.pointerId,shell,handle,startX:e.clientX,startY:e.clientY,crop:c,orig:targetOf(r),regionId:r.id,moved:false};
    try{target.setPointerCapture?.(e.pointerId);}catch(_e){}
  },true);
  window.addEventListener('pointermove',e=>{
    if(!focusDrag||e.pointerId!==focusDrag.pointerId)return;
    const r=region();if(!r||String(r.id)!==String(focusDrag.regionId))return;
    e.preventDefault();
    const d=focusDrag,c=d.crop,dx=(e.clientX-d.startX)/c.rect.width*c.cropW,dy=(e.clientY-d.startY)/c.rect.height*c.cropH,o=d.orig,min=.008;
    let left=o.x,top=o.y,right=o.x+o.width,bottom=o.y+o.height;
    if(d.handle==='move'){left=clamp(o.x+dx,0,1-o.width);top=clamp(o.y+dy,0,1-o.height);right=left+o.width;bottom=top+o.height;}
    else{if(d.handle.includes('w'))left=clamp(o.x+dx,0,right-min);if(d.handle.includes('e'))right=clamp(o.x+o.width+dx,left+min,1);if(d.handle.includes('n'))top=clamp(o.y+dy,0,bottom-min);if(d.handle.includes('s'))bottom=clamp(o.y+o.height+dy,top+min,1);}
    const b={x:left,y:top,width:right-left,height:bottom-top};updateRegionFromBox(r,b);renderFocusLive(r,b,d.shell);d.moved=true;
  },true);
  window.addEventListener('pointerup',e=>{
    if(!focusDrag||e.pointerId!==focusDrag.pointerId)return;
    const d=focusDrag;focusDrag=null;const r=region();if(!r||!d.moved)return;
    r.targetBBox=finalTarget(r);
    if(typeof window.__V163_REGION_HISTORY_PUSH==='function')window.__V163_REGION_HISTORY_PUSH('区域聚焦预览校正',true);
    if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();
  },true);

  /* Windows 常用快捷键：Ctrl+Z 撤回，Delete 删除当前区域。 */
  window.addEventListener('keydown',e=>{
    const s=state();if(!s||!s.open||isEditableTarget(e.target))return;
    if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.key.toLowerCase()==='z'){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.shiftKey&&typeof window.__V163_REGION_HISTORY_REDO==='function')window.__V163_REGION_HISTORY_REDO();
      else if(typeof window.__V163_REGION_HISTORY_UNDO==='function')window.__V163_REGION_HISTORY_UNDO();
      setTimeout(()=>{if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();},0);
      return;
    }
    if(e.key==='Delete'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      const r=region();if(!r)return;e.preventDefault();e.stopImmediatePropagation();
      if(typeof window.__V164_DELETE_REGION==='function')window.__V164_DELETE_REGION(r.id);
    }
  },true);

  window.__V164_TEST__={version:VERSION,active:()=>region(),updateRegionFromBox:(r,b)=>updateRegionFromBox(r,b)};
  document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
})();



/* ===== V18：AI 指令实时联动 + 即时展开稳定通道 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const VERSION='V24';
  const $=(q,r=document)=>r.querySelector(q);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let scheduled=false,dynamicScheduled=false,observer=null;

  function state(){
    /* index.html 使用顶层 let adjustState；它可被同页脚本访问，但不会自动成为 window 属性。 */
    const s=(typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr)||(window.adjustState&&window.adjustState.v15Ocr);
    if(!s||typeof s!=='object')return null;
    if(!s.v155||typeof s.v155!=='object')s.v155={};
    if(typeof s.v155.v17ProfessionalMode!=='boolean')s.v155.v17ProfessionalMode=!!s.v155.v169ProfessionalMode;
    if(typeof s.v155.v17PromptExpanded!=='boolean')s.v155.v17PromptExpanded=!!(s.v155.v169PromptExpanded||s.v155.v173PromptExpanded);
    s.v155.v169PromptExpanded=!!s.v155.v17PromptExpanded;
    s.v155.v173PromptExpanded=!!s.v155.v17PromptExpanded;
    if(typeof s.v155.v17JsonExpanded!=='boolean')s.v155.v17JsonExpanded=false;
    return s;
  }
  function rows(){const s=state();return s&&s.result&&Array.isArray(s.result.regions)?s.result.regions:[];}
  function active(){const s=state(),list=rows();return list.find(r=>String(r.id)===String(s&&s.activeId))||list[0]||null;}
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function toast(text,type='ok'){
    let t=document.querySelector('.v17-toast');if(t)t.remove();
    t=document.createElement('div');t.className='v17-toast '+type;t.textContent=text;document.body.appendChild(t);setTimeout(()=>t.remove(),2600);
  }
  function push(label){try{window.__V163_REGION_HISTORY_PUSH&&window.__V163_REGION_HISTORY_PUSH(label,true);}catch(_e){}}
  function setEditing(r){if(!r)return;r.status='editing';r.review_status='editing';r.updated_at=new Date().toISOString();const s=state();if(s&&s.v155)s.v155.previewReady=false;}
  function typeMeta(type){return ({text:'文字区域',product:'产品区域',person:'人物区域',background:'背景区域',decoration:'装饰区域',unclassified:'未分类区域'})[type]||'区域';}
  function modeLabel(mode){return ({direct_transform:'只调整位置与大小',move_and_repair:'移动主体并修复背景',local_regenerate:'重新生成当前区域'})[mode]||'只调整位置与大小';}
  function sourceBox(r){return r&&r.sourceBBox?clone(r.sourceBBox):{x:+r.x||0,y:+r.y||0,width:+r.width||.1,height:+r.height||.1};}
  function targetBox(r){return r&&r.targetBBox?clone(r.targetBBox):sourceBox(r);}
  function boxCenter(box){return{x:Number(box.x||0)+Number(box.width||0)/2,y:Number(box.y||0)+Number(box.height||0)/2};}
  function boxAreaPct(box){return Math.max(0,Number(box.width||0))*Math.max(0,Number(box.height||0))*100;}
  function preserveText(r){
    const list=Array.isArray(r&&r.preserve)?r.preserve:[];
    return list.length?list.map(x=>String(x).replaceAll('_',' ')).join('、'):'非目标内容';
  }
  function executionText(mode){
    if(mode==='move_and_repair')return '提取并保持主体内容，修复原位置背景空洞，在目标位置重新融合边缘、接触面与自然阴影。';
    if(mode==='local_regenerate')return '使用精细蒙版和区域裁剪参考执行局部重新生成，严格限制在原位置修复范围、目标位置融合范围和边缘羽化范围内。';
    return '优先使用直接几何变换，不重新生成区域内容。';
  }
  function promptTextValue(value){return String(value==null?'':value).replace(/\r\n/g,'\n').replace(/\s+/g,' ').trim().slice(0,800);}
  function textEditInstruction(r){
    const api=window.RegionPromptStateV279||window.RegionPromptStateV278||window.RegionPromptStateV277;if(api?.textEditInstruction)return api.textEditInstruction(r);
    if(!r||!r.regionTextEdited)return'';
    const original=promptTextValue(r.__v277OriginalText??r.__v277TextBefore??''),next=promptTextValue(r.__v277TextAfter??r.recognizedText??r.content??'');
    if(original===next)return'';
    if(!next&&original)return`必须删除该文字区域中的原文“${original}”，不要填入其他文案；同时尽量保持原文字区域的背景、边缘和周边排版自然。`;
    if(!original&&next)return`必须在该文字区域准确写入“${next}”，不得新增其他文案；尽量匹配当前页面的字体、字号、颜色、字距、对齐与清晰度。`;
    return`必须将该文字区域原文“${original}”准确替换为“${next}”，不得保留旧文、不得新增其他文案；尽量保持原字体、字号、颜色、排版、字距和清晰度。`;
  }
  function buildPrompt(r){
    const s=sourceBox(r),t=targetBox(r),sc=boxCenter(s),tc=boxCenter(t),tr=r.transform||{},changes=[];
    const moveX=Number(tr.move_x_canvas_pct||0),moveY=Number(tr.move_y_canvas_pct||0),scale=Number(tr.scale_pct||100),width=Number(tr.width_pct||100),height=Number(tr.height_pct||100),rotation=Number(tr.rotation_deg||0);
    if(Math.abs(moveX)>.01)changes.push(`${moveX>0?'向右':'向左'}移动${Math.abs(moveX).toFixed(1)}%画布宽度`);
    if(Math.abs(moveY)>.01)changes.push(`${moveY>0?'向下':'向上'}移动${Math.abs(moveY).toFixed(1)}%画布高度`);
    if(Math.abs(scale-100)>.01)changes.push(`整体缩放至原来的${scale.toFixed(1)}%`);
    if(Math.abs(width-100)>.01)changes.push(`宽度调整为基准宽度的${width.toFixed(1)}%`);
    if(Math.abs(height-100)>.01)changes.push(`高度调整为基准高度的${height.toFixed(1)}%`);
    if(Math.abs(rotation)>.01)changes.push(`旋转${rotation.toFixed(1)}°`);
    const sourceArea=boxAreaPct(s),targetArea=boxAreaPct(t),regionName=r.name||r.label||typeMeta(r.type),regionId=r.region_id||r.id||'';
    const targetUnchanged=changes.length===0&&Math.abs(Number(s.x)-Number(t.x))<1e-6&&Math.abs(Number(s.y)-Number(t.y))<1e-6&&Math.abs(Number(s.width)-Number(t.width))<1e-6&&Math.abs(Number(s.height)-Number(t.height))<1e-6;
    const targetText=targetUnchanged?'目标保持不变。':`目标区域左上角坐标为X ${(t.x*100).toFixed(1)}%、Y ${(t.y*100).toFixed(1)}%，宽度${(t.width*100).toFixed(1)}%（占画面宽度${(t.width*100).toFixed(1)}%）、高度${(t.height*100).toFixed(1)}%（占画面高度${(t.height*100).toFixed(1)}%），中心坐标为X ${(tc.x*100).toFixed(1)}%、Y ${(tc.y*100).toFixed(1)}%，目标区域外接框面积占整张画面${targetArea.toFixed(1)}%。`;
    const textInstruction=textEditInstruction(r);
    return `修改区域${regionId}（${regionName}），该区域类型为${typeMeta(r.type)}。原始区域左上角坐标为X ${(s.x*100).toFixed(1)}%、Y ${(s.y*100).toFixed(1)}%，宽度${(s.width*100).toFixed(1)}%（占画面宽度${(s.width*100).toFixed(1)}%）、高度${(s.height*100).toFixed(1)}%（占画面高度${(s.height*100).toFixed(1)}%），中心坐标为X ${(sc.x*100).toFixed(1)}%、Y ${(sc.y*100).toFixed(1)}%，区域外接框面积占整张画面${sourceArea.toFixed(1)}%。${changes.length?'执行：'+changes.join('，')+'。':'保持当前几何位置和尺寸。'}${r.lock_aspect_ratio?'保持原始宽高比例，缩放以区域中心为基准。':'宽度与高度可独立调整，缩放以区域中心为基准。'}${targetText}${textInstruction}${executionText(r.execution_mode)}保持${preserveText(r)}不变。除当前区域、原位置修复范围和目标位置融合范围外，不改变其他区域。`;
  }
  function promptStateApi(){return window.RegionPromptStateV279||window.RegionPromptStateV278||window.RegionPromptStateV277||null;}
  function promptMarker(){return promptStateApi()?.MARKER||'\n\n【V27.9 实时参数（自动更新）】\n';}
  function hydratePromptState(r){
    const api=promptStateApi(),auto=buildPrompt(r),existing=String(r.prompt_override||''),lastAuto=String(r.__v172LastAutoPrompt||'');
    if(r.__v277PromptHydrated){
      const migratedFree=api?.freeRegionInstruction?api.freeRegionInstruction(r,auto,lastAuto):'';
      if(migratedFree){r.__v173ManualRequirement=api?.mergeManual?api.mergeManual(r.__v173ManualRequirement,migratedFree):[r.__v173ManualRequirement,migratedFree].filter(Boolean).join('\n\n');if(!r.__v278CreationInstruction)r.__v278CreationInstruction=migratedFree;}
      return;
    }
    let manual='';
    if(api?.migrate)manual=api.migrate({storedManual:r.__v173ManualRequirement,fullOverride:r.__v271FullPromptOverride,existing,currentAuto:auto,lastAuto});
    else manual=String(r.__v173ManualRequirement||r.__v271FullPromptOverride||'').trim();
    const freeSeed=api?.freeRegionInstruction?api.freeRegionInstruction(r,auto,lastAuto):'';
    manual=api?.mergeManual?api.mergeManual(manual,freeSeed):[manual,freeSeed].filter(Boolean).join('\n\n');
    if(freeSeed&&!r.__v278CreationInstruction)r.__v278CreationInstruction=freeSeed;
    r.__v173ManualRequirement=manual;r.__v271FullPromptOverride='';r.__v277PromptHydrated=true;r.__v173PromptHydrated=true;r.__v172PromptManual=false;r.__v172PromptAuto=true;
  }
  function resolvedPrompt(r){
    hydratePromptState(r);
    const auto=buildPrompt(r),manual=String(r.__v173ManualRequirement||'').trim(),api=promptStateApi(),output=api?.compose?api.compose(manual,auto):(manual?`${manual}${promptMarker()}${auto}`:`${promptMarker().trimStart()}${auto}`);
    r.__v271FullPromptOverride='';r.prompt_override=output;r.__v172LastAutoPrompt=auto;r.__v173LastResolvedPrompt=output;return output;
  }
  function applyPromptEditorValue(r,value){
    hydratePromptState(r);const text=String(value==null?'':value),auto=buildPrompt(r),lastAuto=String(r.__v172LastAutoPrompt||''),api=promptStateApi();
    r.__v173ManualRequirement=api?.extractManual?api.extractManual(text,auto,lastAuto):text.trim();
    r.__v271FullPromptOverride='';r.__v277PromptHydrated=true;r.__v173PromptHydrated=true;r.__v172PromptManual=false;r.__v172PromptAuto=true;r.__v172LegacyPrompt='';return resolvedPrompt(r);
  }
  function regionUserIntent(r){
    hydratePromptState(r);
    const api=promptStateApi(),auto=buildPrompt(r),manual=String(r.__v173ManualRequirement||'').trim();
    const freeSeed=api?.freeRegionInstruction?api.freeRegionInstruction(r,auto,String(r.__v172LastAutoPrompt||'')):'';
    return api?.mergeManual?api.mergeManual(textEditInstruction(r),manual,freeSeed):[textEditInstruction(r),manual,freeSeed].filter(Boolean).join('\n\n');
  }
  function commitActivePromptFromDom(){const r=active(),host=$('#v15-ocr-overlay .v17-smart-editor-host'),ta=host?.shadowRoot?.getElementById('prompt');if(!r)return'';if(ta)applyPromptEditorValue(r,ta.value);return resolvedPrompt(r);}
  window.__V271_RESOLVE_REGION_PROMPT__=r=>r?resolvedPrompt(r):'';
  window.__V271_REGION_USER_INTENT__=r=>r?regionUserIntent(r):'';
  window.__V271_COMMIT_ACTIVE_AI_PROMPT__=commitActivePromptFromDom;
  window.__V277_APPLY_REGION_PROMPT_EDITOR__=(r,value)=>r?applyPromptEditorValue(r,value):'';
  window.__V277_SYNC_REGION_PROMPT__=r=>{if(!r)return'';const out=resolvedPrompt(r);scheduleDynamic(true);return out;};
  window.__V279_APPLY_REGION_PROMPT_EDITOR__=window.__V278_APPLY_REGION_PROMPT_EDITOR__=window.__V277_APPLY_REGION_PROMPT_EDITOR__;
  window.__V279_SYNC_REGION_PROMPT__=window.__V278_SYNC_REGION_PROMPT__=window.__V277_SYNC_REGION_PROMPT__;
  function task(r){return {schema_version:'1.0',workspace_version:VERSION,region_id:r.region_id||r.id,name:r.name||r.label,region_type:r.type,execution_mode:r.execution_mode,status:r.status,source:sourceBox(r),transform:clone(r.transform||{}),target:targetBox(r),mask:clone(r.mask||{}),z_index:Number(r.z_index||0),parent_id:r.parent_id||null,follow_move:!!r.follow_move,follow_scale:!!r.follow_scale,lock_aspect_ratio:!!r.lock_aspect_ratio,repair:clone(r.repair||{}),prompt:resolvedPrompt(r),updated_at:r.updated_at||''};}
  function copyText(value){
    const text=String(value||'');
    if(navigator.clipboard&&window.isSecureContext)return navigator.clipboard.writeText(text);
    const ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;opacity:0;pointer-events:none';document.body.appendChild(ta);ta.select();try{document.execCommand('copy');}finally{ta.remove();}return Promise.resolve();
  }
  function syncRaw(){const s=state();if(s&&s.result){s.result.raw=s.result.raw||{};s.result.raw.regions=s.result.regions;}}
  function refresh(label){
    syncRaw();
    const r=active();
    try{
      if(r&&window.__V168_HOT_SWITCH_REGION)window.__V168_HOT_SWITCH_REGION(r.id,{select:false,scroll:false,keepView:true});
      else if(window.__V168_REFRESH_ACTIVE_PANELS)window.__V168_REFRESH_ACTIVE_PANELS();
    }catch(_e){}
    schedule();scheduleDynamic(true);
    if(label)toast(label,'ok');
  }
  function mutate(label,fn){const r=active();if(!r)return;push(label+'前');fn(r);setEditing(r);push(label);refresh(label);}
  function resetActive(){
    const r=active();if(!r){toast('请先选择一个区域','bad');return;}
    push('重置变换前');
    r.transform={move_x_canvas_pct:0,move_y_canvas_pct:0,scale_pct:100,width_pct:100,height_pct:100,rotation_deg:0,anchor:'center',free_aspect:true};
    r.targetBBox=sourceBox(r);r.prompt_override='';r.__v172PromptManual=false;r.__v172PromptAuto=true;r.__v172LegacyPrompt='';r.__v172LastAutoPrompt='';r.__v173PromptHydrated=true;r.__v173ManualRequirement='';r.__v173LastResolvedPrompt='';r.manualCorrected=false;setEditing(r);push('重置变换');
    try{window.__V164_UPDATE_FOCUS_LIVE&&window.__V164_UPDATE_FOCUS_LIVE(r,r.targetBBox);}catch(_e){}
    refresh('已重置当前区域的位置、尺寸和旋转');
  }

  const css=`
    :host{display:block;font-family:inherit;color:#172033}.panel{display:grid;gap:12px}.title{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.title b{font-size:15px}.title small{display:block;margin-top:4px;color:#7a8799;font-size:11px}.status{padding:7px 10px;border:1px solid #dbe3ed;border-radius:999px;background:#f4f7fb;color:#52627a;font-size:11px}.card{display:grid;gap:11px;padding:13px;border:1px solid #dfe6ef;border-radius:16px;background:#fff}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{display:grid;gap:6px;font-size:11px;color:#536077}.field span{font-weight:700;color:#3c495f}.field select,.field input[type=number]{width:100%;height:42px;border:1px solid #d4ddeb;border-radius:12px;padding:0 11px;background:#fff;color:#223047;font:12px/1 inherit;box-sizing:border-box}.field select:focus,.field input:focus,textarea:focus{outline:3px solid rgba(10,132,255,.14);border-color:#0a84ff}.check{display:flex;align-items:flex-start;gap:10px;padding:11px;border:1px solid #e0e6ef;border-radius:12px;background:#f8faff;cursor:pointer}.check input[type=checkbox],.repair input[type=checkbox]{-webkit-appearance:none;appearance:none;width:38px;height:22px;min-width:38px;margin:0;border:0;border-radius:999px;background:#d7dbe3;box-shadow:inset 0 0 0 1px rgba(50,60,80,.08);position:relative;cursor:pointer;transition:background .2s ease,box-shadow .2s ease;flex:0 0 38px}.check input[type=checkbox]::after,.repair input[type=checkbox]::after{content:'';position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.28);transition:transform .2s ease}.check input[type=checkbox]:checked,.repair input[type=checkbox]:checked{background:#34c759}.check input[type=checkbox]:checked::after,.repair input[type=checkbox]:checked::after{transform:translateX(16px)}.check input[type=checkbox]:focus-visible,.repair input[type=checkbox]:focus-visible{outline:3px solid rgba(10,132,255,.22);outline-offset:3px}.check span{display:grid;gap:3px}.check b{font-size:12px}.check small{font-size:10px;color:#7b8799}.toggle,.summary,.json-toggle{width:100%;min-height:48px;border:1px solid #dbe3ee;border-radius:13px;background:#f8fafc;padding:9px 11px;display:flex;align-items:center;justify-content:space-between;gap:10px;color:#425169;text-align:left;cursor:pointer;font:inherit}.toggle.on{border-color:#8abef1;background:#edf6ff;color:#126eb5}.toggle span,.summary span{display:grid;gap:3px;min-width:0}.toggle b,.summary b{font-size:12px}.toggle small,.summary small{font-size:10px;color:#7a8799;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.toggle i,.summary i{font-style:normal;font-size:11px}.advanced{display:grid;gap:10px;padding:11px;border:1px dashed #d7e0eb;border-radius:13px;background:#fbfcfe}.repair{display:grid;gap:7px}.repair label{display:flex;gap:8px;align-items:flex-start;padding:9px;border:1px solid #e3e8ef;border-radius:10px;background:#fff;font-size:11px}.prompt{border:1px solid #dfe5ee;border-radius:15px;background:#fff;overflow:hidden}.summary{border:0;border-radius:0;background:#fff;min-height:58px}.summary:hover{background:#f8fbff}.editor{display:block;padding:10px;border-top:1px solid #e3e8ef}.editor.is-hidden{display:none}.editor header,.json header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;color:#78869a;font-size:10px}.editor textarea{width:100%;min-height:190px;height:auto;overflow-y:hidden;border:1px solid #d7dfeb;border-radius:11px;padding:10px;box-sizing:border-box;font:11px/1.65 inherit;resize:vertical}.btn{height:32px;border:1px solid #d7dfeb;border-radius:9px;background:#fff;padding:0 11px;color:#40506a;cursor:pointer;font:11px/1 inherit}.json-toggle{min-height:42px}.json{padding:11px;border:1px solid #dfe5ee;border-radius:14px;background:#fff}.json pre{max-height:330px;overflow:auto;margin:0;padding:10px;border-radius:10px;background:#f7f9fc;font:10px/1.55 Consolas,monospace;white-space:pre-wrap}.hint{margin:0;color:#7c8798;font-size:10px;line-height:1.5}.live{display:inline-flex;align-items:center;gap:5px;color:#168246}.live:before{content:"";width:6px;height:6px;border-radius:50%;background:#23a55a;box-shadow:0 0 0 3px rgba(35,165,90,.12)}@media(max-width:520px){.grid{grid-template-columns:1fr}}
  `;
  function editorMarkup(r,s){
    const professional=!!s.v155.v17ProfessionalMode,expanded=!!s.v155.v17PromptExpanded,jsonOpen=professional&&!!s.v155.v17JsonExpanded;
    const mode=r.execution_mode||'direct_transform',prompt=resolvedPrompt(r),others=rows().filter(x=>x.id!==r.id);
    const promptRows=Math.max(9,Math.min(40,Math.ceil(prompt.length/30)+String(prompt).split('\n').length+2));
    return `<style>${css}</style><div class="panel"><div class="title"><div><b id="editorTitle">${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||typeMeta(r.type))}</b><small id="editorSubtitle">${esc(typeMeta(r.type))} · ${esc(modeLabel(mode))}</small></div><span id="editorStatus" class="status">${r.status==='applied'?'已应用':'已修改'}</span></div><section class="card"><div class="grid"><label class="field"><span>区域类型</span><select id="type"><option value="text" ${r.type==='text'?'selected':''}>文字区域</option><option value="product" ${r.type==='product'?'selected':''}>产品区域</option><option value="person" ${r.type==='person'?'selected':''}>人物区域</option><option value="background" ${r.type==='background'?'selected':''}>背景区域</option><option value="decoration" ${r.type==='decoration'?'selected':''}>装饰区域</option></select></label><label class="field"><span>修改方式</span><select id="mode"><option value="direct_transform" ${mode==='direct_transform'?'selected':''}>只调整位置与大小</option><option value="move_and_repair" ${mode==='move_and_repair'?'selected':''}>移动主体并修复背景</option><option value="local_regenerate" ${mode==='local_regenerate'?'selected':''}>重新生成当前区域</option></select></label></div><label class="check"><input id="aspect" type="checkbox" ${r.lock_aspect_ratio?'checked':''}><span><b>保持原始比例</b><small>避免文字或主体横向、纵向拉伸</small></span></label><button id="professional" class="toggle ${professional?'on':''}" type="button"><span><b>专业模式</b><small>${professional?'显示跟随、修复、蒙版、层级与任务 JSON':'新手模式仅保留区域类型、修改方式和比例'}</small></span><i>${professional?'开启':'关闭'}</i></button>${professional?`<div class="advanced"><div class="grid"><label class="field"><span>蒙版边缘</span><select id="mask"><option value="hard" ${r.mask?.type!=='soft'?'selected':''}>清晰硬边</option><option value="soft" ${r.mask?.type==='soft'?'selected':''}>柔和软边</option></select></label><label class="field"><span>边缘柔化</span><input id="feather" type="number" min="0" max="64" value="${Number(r.mask?.feather_px||0)}"></label><label class="field"><span>前后层级</span><input id="z" type="number" min="0" max="99" value="${Number(r.z_index||0)}"></label><label class="field"><span>跟随区域</span><select id="parent"><option value="">不跟随其他区域</option>${others.map(x=>`<option value="${esc(x.id)}" ${r.parent_id===x.id?'selected':''}>${esc(window.__V221_REGION_NAME__?.(x)||x.name||x.label||'区域')}</option>`).join('')}</select></label></div>${r.parent_id?`<div class="repair"><label><input id="followMove" type="checkbox" ${r.follow_move?'checked':''}>跟随父区域移动</label><label><input id="followScale" type="checkbox" ${r.follow_scale?'checked':''}>跟随父区域缩放</label></div>`:''}${mode!=='direct_transform'?`<div class="repair"><label><input id="repairHole" type="checkbox" ${r.repair?.background_hole?'checked':''}>修复原位置背景</label><label><input id="repairShadow" type="checkbox" ${r.repair?.rebuild_shadow?'checked':''}>重建自然阴影</label><label><input id="repairEdge" type="checkbox" ${r.repair?.edge_blending?'checked':''}>边缘融合</label></div>`:'<p class="hint">直接几何变换不显示背景修复参数。</p>'}</div>`:''}<p class="hint">新手模式只保留区域类型、修改方式和比例；跟随、修复、蒙版、层级及任务 JSON 已统一收进专业模式。AI 修改指令会实时同步区域参数，并作为最高优先级直接进入微调生图。</p></section><section class="prompt"><button id="promptToggle" class="summary" type="button" aria-expanded="${expanded?'true':'false'}"><span><b>AI 修改指令</b><small id="promptSummary">${esc(prompt.replace(/\s+/g,' ').slice(0,100))}${prompt.length>100?'…':''}</small></span><i id="promptToggleText">${expanded?'收起':'展开'}</i></button><div id="promptEditor" class="editor ${expanded?'':'is-hidden'}"><header><span class="live">直接进入微调生图 · 手工内容最高优先级</span><button id="copyPrompt" class="btn" type="button">复制</button></header><textarea id="prompt" rows="${promptRows}">${esc(prompt)}</textarea></div></section>${professional?`<button id="jsonToggle" class="json-toggle" type="button">${jsonOpen?'收起专业信息与任务 JSON':'查看专业信息与任务 JSON'} <span>${jsonOpen?'⌃':'⌄'}</span></button>${jsonOpen?`<section class="json"><header><b>Region Task JSON</b><button id="copyJson" class="btn" type="button">复制</button></header><pre id="taskJson">${esc(JSON.stringify(task(r),null,2))}</pre></section>`:''}`:''}</div>`;
  }
  function resizePrompt(root){const prompt=root&&root.getElementById('prompt');if(!prompt)return;prompt.style.height='auto';prompt.style.height=Math.max(190,prompt.scrollHeight)+'px';}
  function applyExpandedState(host,expanded){
    const root=host&&host.shadowRoot;if(!root)return;
    const btn=root.getElementById('promptToggle'),editor=root.getElementById('promptEditor'),text=root.getElementById('promptToggleText');
    if(btn)btn.setAttribute('aria-expanded',expanded?'true':'false');
    if(editor){editor.hidden=!expanded;editor.classList.toggle('is-hidden',!expanded);editor.style.display=expanded?'block':'none';}
    if(text)text.textContent=expanded?'收起':'展开';
    host.dataset.promptExpanded=expanded?'true':'false';
    if(expanded){resizePrompt(root);queueMicrotask(()=>resizePrompt(root));requestAnimationFrame(()=>resizePrompt(root));}
  }
  function dynamicSignature(r){
    const t=targetBox(r),tr=r.transform||{};
    return JSON.stringify([r.id,r.type,r.execution_mode,r.lock_aspect_ratio,r.status,r.name,r.label,t.x,t.y,t.width,t.height,tr.move_x_canvas_pct,tr.move_y_canvas_pct,tr.scale_pct,tr.width_pct,tr.height_pct,tr.rotation_deg,r.__v173ManualRequirement,r.__v271FullPromptOverride,r.recognizedText,r.__v277OriginalText,r.__v277TextAfter,r.updated_at]);
  }
  function syncEditorDynamic(force=false){
    dynamicScheduled=false;
    const s=state(),r=active(),host=$('#v15-ocr-overlay .v17-smart-editor-host');
    if(!s||!r||!host||!host.isConnected||!host.shadowRoot)return;
    if(host.dataset.regionId!==String(r.id)){renderEditor(host);return;}
    const sig=dynamicSignature(r);if(!force&&host.dataset.dynamicSignature===sig)return;host.dataset.dynamicSignature=sig;
    const root=host.shadowRoot,prompt=resolvedPrompt(r),summary=root.getElementById('promptSummary'),textarea=root.getElementById('prompt');
    const title=root.getElementById('editorTitle'),subtitle=root.getElementById('editorSubtitle'),status=root.getElementById('editorStatus');
    if(title)title.textContent=String(window.__V221_REGION_NAME__?.(r)||r.name||r.label||typeMeta(r.type));
    if(subtitle)subtitle.textContent=`${typeMeta(r.type)} · ${modeLabel(r.execution_mode)}`;
    if(status)status.textContent=r.status==='applied'?'已应用':'已修改';
    if(summary)summary.textContent=prompt.replace(/\s+/g,' ').slice(0,100)+(prompt.length>100?'…':'');
    if(textarea&&root.activeElement!==textarea){textarea.value=prompt;resizePrompt(root);}
    const type=root.getElementById('type'),mode=root.getElementById('mode'),aspect=root.getElementById('aspect');
    if(type&&root.activeElement!==type)type.value=r.type||'decoration';
    if(mode&&root.activeElement!==mode)mode.value=r.execution_mode||'direct_transform';
    if(aspect&&root.activeElement!==aspect)aspect.checked=!!r.lock_aspect_ratio;
    const json=root.getElementById('taskJson');if(json)json.textContent=JSON.stringify(task(r),null,2);
  }
  function scheduleDynamic(force=false){
    if(force){dynamicScheduled=false;requestAnimationFrame(()=>syncEditorDynamic(true));return;}
    if(dynamicScheduled)return;dynamicScheduled=true;requestAnimationFrame(()=>syncEditorDynamic(false));
  }
  function stableRender(host){
    if(host&&host.isConnected)renderEditor(host);
    queueMicrotask(()=>{install();scheduleDynamic(true);});
    requestAnimationFrame(()=>{install();scheduleDynamic(true);});
  }
  function bindEditor(host){
    const s=state(),r=active();if(!s||!r)return;const root=host.shadowRoot;
    root.getElementById('type').onchange=e=>{mutate('修改区域类型',x=>{x.type=e.target.value;x.preserve=[];if(!x.execution_mode)x.execution_mode='direct_transform';});stableRender(host);};
    root.getElementById('mode').onchange=e=>{mutate('修改处理方式',x=>{x.execution_mode=e.target.value;x.repair=x.repair||{};x.repair.background_hole=e.target.value!=='direct_transform';x.repair.edge_blending=e.target.value!=='direct_transform';if(e.target.value==='direct_transform')x.repair.rebuild_shadow=false;});stableRender(host);};
    root.getElementById('aspect').onchange=e=>{mutate(e.target.checked?'保持原始比例':'允许独立宽高',x=>x.lock_aspect_ratio=!!e.target.checked);scheduleDynamic(true);};
    root.getElementById('professional').onclick=()=>{s.v155.v17ProfessionalMode=!s.v155.v17ProfessionalMode;if(!s.v155.v17ProfessionalMode)s.v155.v17JsonExpanded=false;if(typeof window.__V164_RENDER_OCR==='function')window.__V164_RENDER_OCR();else stableRender(host);queueMicrotask(()=>install());toast(s.v155.v17ProfessionalMode?'专业模式已开启，诊断详情已显示':'专业模式已关闭，正常状态下隐藏诊断详情','ok');};
    root.getElementById('promptToggle').onclick=e=>{
      e.preventDefault();e.stopPropagation();
      s.v155.v17PromptExpanded=!s.v155.v17PromptExpanded;
      s.v155.v169PromptExpanded=s.v155.v17PromptExpanded;
      s.v155.v173PromptExpanded=s.v155.v17PromptExpanded;
      applyExpandedState(host,s.v155.v17PromptExpanded);
      scheduleDynamic(true);
      toast(s.v155.v17PromptExpanded?'AI 修改指令已即时展开':'AI 修改指令已收起','ok');
    };
    const prompt=root.getElementById('prompt');if(prompt){
      resizePrompt(root);
      prompt.oninput=e=>{applyPromptEditorValue(r,e.target.value);setEditing(r);resizePrompt(root);const sm=root.getElementById('promptSummary');if(sm)sm.textContent=e.target.value.replace(/\s+/g,' ').slice(0,100)+(e.target.value.length>100?'…':'');};
      prompt.onchange=()=>{applyPromptEditorValue(r,prompt.value);push('修改 AI 指令');refresh();};
    }
    const cp=root.getElementById('copyPrompt');if(cp)cp.onclick=()=>copyText(resolvedPrompt(r)).then(()=>toast('AI 修改指令已复制'));
    const jt=root.getElementById('jsonToggle');if(jt)jt.onclick=()=>{s.v155.v17JsonExpanded=!s.v155.v17JsonExpanded;stableRender(host);};
    const cj=root.getElementById('copyJson');if(cj)cj.onclick=()=>copyText(JSON.stringify(task(r),null,2)).then(()=>toast('任务 JSON 已复制'));
    const mask=root.getElementById('mask');if(mask)mask.onchange=e=>{mutate('修改蒙版边缘',x=>{x.mask=x.mask||{};x.mask.type=e.target.value;if(e.target.value==='soft'&&!x.mask.feather_px)x.mask.feather_px=6;});stableRender(host);};
    const feather=root.getElementById('feather');if(feather)feather.onchange=e=>mutate('修改边缘柔化',x=>{x.mask=x.mask||{};x.mask.feather_px=Math.max(0,Math.min(64,Number(e.target.value)||0));});
    const z=root.getElementById('z');if(z)z.onchange=e=>mutate('修改前后层级',x=>x.z_index=Math.max(0,Math.min(99,Number(e.target.value)||0)));
    const parent=root.getElementById('parent');if(parent)parent.onchange=e=>{mutate('修改跟随区域',x=>x.parent_id=e.target.value);stableRender(host);};
    const fm=root.getElementById('followMove');if(fm)fm.onchange=e=>mutate('修改跟随移动',x=>x.follow_move=!!e.target.checked);
    const fs=root.getElementById('followScale');if(fs)fs.onchange=e=>mutate('修改跟随缩放',x=>x.follow_scale=!!e.target.checked);
    const hole=root.getElementById('repairHole');if(hole)hole.onchange=e=>mutate('修改背景修复设置',x=>{x.repair=x.repair||{};x.repair.background_hole=!!e.target.checked;});
    const sh=root.getElementById('repairShadow');if(sh)sh.onchange=e=>mutate('修改阴影重建设置',x=>{x.repair=x.repair||{};x.repair.rebuild_shadow=!!e.target.checked;});
    const edge=root.getElementById('repairEdge');if(edge)edge.onchange=e=>mutate('修改边缘融合设置',x=>{x.repair=x.repair||{};x.repair.edge_blending=!!e.target.checked;});
  }
  function renderEditor(host){const s=state(),r=active();if(!s||!r||!host||!host.shadowRoot)return;host.dataset.regionId=String(r.id);host.shadowRoot.innerHTML=editorMarkup(r,s);host.dataset.dynamicSignature='';bindEditor(host);applyExpandedState(host,!!s.v155.v17PromptExpanded);syncEditorDynamic(true);}
  function installEditor(){
    const content=$('#v15-ocr-overlay .v15-result-content');if(!content)return;
    const old=$('.v169-edit-panel',content);let host=$('.v17-smart-editor-host',content);
    if(old){
      /* 保留旧面板节点作为稳定外壳。旧版观察器会寻找 .v169-edit-panel；若直接替换该节点，
         它会马上重新生成旧内容，造成新编辑器闪现后消失。 */
      let created=false;
      if(!host){host=document.createElement('div');host.className='v17-smart-editor-host';host.attachShadow({mode:'open'});created=true;}
      if(host.parentElement!==old)old.replaceChildren(host);
      old.classList.add('v173-stable-editor-shell');
      const r=active();
      if(created||!host.shadowRoot||!host.shadowRoot.childNodes.length||(r&&host.dataset.regionId!==String(r.id)))renderEditor(host);
      else scheduleDynamic(false);
      return;
    }
    if(host){const r=active();if(r&&host.dataset.regionId!==String(r.id))renderEditor(host);else scheduleDynamic(false);}
  }
  function installReset(){
    /* V19：顶部“重置变换”与小图“恢复原始范围”语义重复，统一移除旧入口。 */
    document.querySelectorAll('#v15-ocr-overlay .v160-reset-btn[data-v155-reset-transform],#v15-ocr-overlay .v17-reset-host').forEach(el=>el.remove());
  }
  function nativeRegionTextBusy(){
    const s=state(),focused=document.activeElement?.closest?.('#v15-ocr-overlay [data-v163-region-text-input]');
    return !!(focused||(s&&s.regionTextComposing));
  }
  function install(){scheduled=false;const s=state();if(!s||!s.open||nativeRegionTextBusy())return;installEditor();installReset();scheduleDynamic(false);}
  function schedule(){if(scheduled||nativeRegionTextBusy())return;scheduled=true;requestAnimationFrame(install);}

  /* V18：旧详情节点尚未被稳定宿主接管时，第一次点击也立即完成展开。 */
  window.addEventListener('click',e=>{
    const legacy=e.target&&e.target.closest&&e.target.closest('[data-v169-prompt-toggle]');
    if(!legacy)return;
    const s=state();if(!s||!s.open)return;
    e.preventDefault();e.stopImmediatePropagation();
    s.v155.v17PromptExpanded=!s.v155.v17PromptExpanded;
    s.v155.v169PromptExpanded=s.v155.v17PromptExpanded;
    s.v155.v173PromptExpanded=s.v155.v17PromptExpanded;
    installEditor();
    const host=$('#v15-ocr-overlay .v17-smart-editor-host');
    if(host){if(host.dataset.regionId!==String(active()?.id||''))renderEditor(host);applyExpandedState(host,s.v155.v17PromptExpanded);scheduleDynamic(true);}
    toast(s.v155.v17PromptExpanded?'AI 修改指令已即时展开':'AI 修改指令已收起','ok');
  },true);

  const liveSelectors='[data-v155-transform],[data-v155-transform-number],[data-v159-float-input],[data-v155-target-box],[data-v162-mini-target]';
  document.addEventListener('input',e=>{if(e.target&&e.target.closest&&e.target.closest(liveSelectors))scheduleDynamic(false);},true);
  document.addEventListener('change',e=>{if(e.target&&e.target.closest&&e.target.closest(liveSelectors))scheduleDynamic(true);},true);
  document.addEventListener('pointermove',e=>{if(e.buttons&&state()&&state().open)scheduleDynamic(false);},true);
  document.addEventListener('pointerup',()=>scheduleDynamic(true),true);
  document.addEventListener('click',e=>{if(e.target&&e.target.closest&&e.target.closest('[data-v155-template],[data-v155-reset-transform],[data-v162-mini-reset]'))scheduleDynamic(true);},true);

  /* V18：绑定实际 OCR 重绘入口。重绘结束后同步安装稳定详情宿主，避免必须切换区域才出现。 */
  if(typeof window.__V164_RENDER_OCR==='function'&&!window.__V164_RENDER_OCR.__v173ImmediateEditor){
    const baseRenderOcr=window.__V164_RENDER_OCR;
    const wrapped=function(){
      const out=baseRenderOcr.apply(this,arguments);
      install();
      queueMicrotask(()=>{install();syncEditorDynamic(true);});
      requestAnimationFrame(()=>{install();syncEditorDynamic(true);});
      return out;
    };
    wrapped.__v173ImmediateEditor=true;
    window.__V164_RENDER_OCR=wrapped;
  }
  if(typeof window.__V168_REFRESH_ACTIVE_PANELS==='function'&&!window.__V168_REFRESH_ACTIVE_PANELS.__v173ImmediateEditor){
    const baseRefreshPanels=window.__V168_REFRESH_ACTIVE_PANELS;
    const wrapped=function(){
      const out=baseRefreshPanels.apply(this,arguments);
      install();
      scheduleDynamic(true);
      return out;
    };
    wrapped.__v173ImmediateEditor=true;
    window.__V168_REFRESH_ACTIVE_PANELS=wrapped;
  }

  function mutationTouchesWorkbench(records){
    const overlay=document.getElementById('v15-ocr-overlay');if(!overlay||!state()?.open)return false;
    return records.some(m=>overlay===m.target||overlay.contains(m.target)||[...m.addedNodes].some(n=>n&&n.nodeType===1&&(n===overlay||overlay.contains(n)||n.querySelector?.('#v15-ocr-overlay'))));
  }
  observer=new MutationObserver(records=>{if(mutationTouchesWorkbench(records))schedule();});observer.observe(document.body||document.documentElement,{subtree:true,childList:true});
  document.addEventListener('focusout',e=>{if(e.target?.closest?.('#v15-ocr-overlay [data-v163-region-text-input]'))setTimeout(schedule,0);},true);
  /* V27.9：移除 90ms 全局轮询。OCR 重绘包装器、相关 DOM 变更和焦点退出事件
     已能完整驱动安装，避免空闲时每秒执行十余次查询与同步。 */
  window.__V17_INTERACTION_TEST__={version:VERSION,active,resetActive,task,buildPrompt,resolvedPrompt,syncEditorDynamic,install:()=>{install();return{editor:!!$('.v17-smart-editor-host'),reset:!!$('.v17-reset-host')}}};window.__V173_SYNC_AI_PROMPT=()=>{install();syncEditorDynamic(true);return active()?resolvedPrompt(active()):'';};
  document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');schedule();
})();


/* ===== V18：显式区域对象选择、定位高亮与列表/画布双向同步 ===== */
(function(){
  'use strict';
  document.addEventListener('pointerdown',e=>{
    const card=e.target&&e.target.closest&&e.target.closest('#v15-ocr-overlay [data-v155-select-region]');
    if(!card||e.target.closest('button,input,select,textarea,a'))return;
    e.preventDefault();e.stopImmediatePropagation();
    const id=card.dataset.v155SelectRegion;
    if(id&&typeof window.__V175_SELECT_AND_LOCATE_REGION==='function')window.__V175_SELECT_AND_LOCATE_REGION(id);
  },true);
})();


/* ===== V18：工作台资源即时交互、更多菜单与审计保护层 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  function state(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function row(id){const s=state();return s&&s.result&&Array.isArray(s.result.regions)?s.result.regions.find(r=>String(r.id)===String(id)):null;}
  function captureScroll(){const overlay=document.getElementById('v15-ocr-overlay');return overlay?{side:overlay.querySelector('.v15-ocr-sidebar')?.scrollTop||0,list:overlay.querySelector('.v155-left-list')?.scrollTop||0,main:overlay.querySelector('.v160-adjust-main')?.scrollTop||0,mini:overlay.querySelector('.v160-side-content')?.scrollTop||0}:null;}
  function restoreScroll(pos){if(!pos)return;requestAnimationFrame(()=>{const overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return;const side=overlay.querySelector('.v15-ocr-sidebar'),list=overlay.querySelector('.v155-left-list'),main=overlay.querySelector('.v160-adjust-main'),mini=overlay.querySelector('.v160-side-content');if(side)side.scrollTop=pos.side;if(list)list.scrollTop=pos.list;if(main)main.scrollTop=pos.main;if(mini)mini.scrollTop=pos.mini;});}
  function refresh(full=true){const pos=captureScroll();if(full){try{window.__V164_RENDER_OCR&&window.__V164_RENDER_OCR();}catch(_e){}}else{try{window.__V179_REFRESH_REGION_LIST__&&window.__V179_REFRESH_REGION_LIST__();}catch(_e){}}requestAnimationFrame(()=>{try{window.__V168_REFRESH_ACTIVE_PANELS&&window.__V168_REFRESH_ACTIVE_PANELS();}catch(_e){}restoreScroll(pos);});}
  function history(label){try{window.__V163_REGION_HISTORY_PUSH&&window.__V163_REGION_HISTORY_PUSH(label,true);}catch(_e){}}
  function audit(action,r,detail=''){try{return window.__V179_AUDIT__&&window.__V179_AUDIT__(action,r,detail);}catch(_e){return null;}}
  /* pointerdown 即时提交，避免高频重绘在 click 之前替换按钮节点。 */
  window.addEventListener('pointerdown',e=>{
    const root=e.target&&e.target.closest&&e.target.closest('#v15-ocr-overlay #v155-region-list');if(!root)return;
    const more=e.target.closest('button[data-v179-more-toggle]');
    if(more){e.preventDefault();e.stopImmediatePropagation();const s=state(),id=more.dataset.v179MoreToggle;if(!s)return;s.v179MoreRegionId='';if(typeof window.__V183_TOGGLE_REGION_MENU__==='function')window.__V183_TOGGLE_REGION_MENU__(id,more);return;}
    const btn=e.target.closest('button[data-v155-visible],button[data-v155-lock],button[data-v155-rename]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();const s=state(),id=btn.dataset.v155Visible||btn.dataset.v155Lock||btn.dataset.v155Rename,r=row(id);if(!s||!r)return;
    if(btn.dataset.v155Visible!=null){history('显示状态变更前');r.visible=r.visible===false;audit(r.visible?'显示区域':'隐藏区域',r);history(r.visible?'显示区域':'隐藏区域');}
    else if(btn.dataset.v155Lock!=null){history('锁定状态变更前');r.locked=!r.locked;r.status=r.locked?'locked':'ready';audit(r.locked?'锁定区域':'解锁区域',r);history(r.locked?'锁定区域':'解锁区域');}
    else{const oldName=r.name||r.label||'',name=window.prompt('输入区域名称',oldName);if(!name||!name.trim())return;history('重命名前');r.name=name.trim();r.label=r.name;audit('重命名区域',r,`${oldName} → ${r.name}`);history('重命名区域');}
    s.v179MoreRegionId='';refresh(true);
  },true);
  window.addEventListener('pointerdown',e=>{const s=state();if(!s||!s.v179MoreRegionId)return;if(e.target?.closest?.('#v15-ocr-overlay #v155-region-list [data-v179-more-toggle],#v15-ocr-overlay #v155-region-list .v179-region-more,#v183-region-menu-portal'))return;s.v179MoreRegionId='';refresh(false);},true);
  window.__V179_TEST__={version:'V20',state,row,refresh,audit};
})();

/* ===== V18：调整面板滚轮与小图交互通道 ===== */
(function(){
  'use strict';
  function normalizeDelta(e,el){let d=Number(e.deltaY)||0;if(e.deltaMode===1)d*=18;else if(e.deltaMode===2)d*=Math.max(120,el?.clientHeight||600);return d;}
  document.addEventListener('wheel',e=>{
    if(e.ctrlKey||e.metaKey)return;
    const panel=e.target?.closest?.('#v15-ocr-overlay.v157-mode-adjust .v160-transform-panel');if(!panel)return;
    if(e.target.closest('[data-v162-mini-stage]'))return;/* 小图内部滚轮保留给独立缩放。 */
    const preferred=e.target.closest('.v160-side-content,.v160-adjust-main'),candidates=[preferred,e.target.closest('.v160-adjust-main'),e.target.closest('.v160-side-content')].filter((x,i,a)=>x&&a.indexOf(x)===i);
    for(const el of candidates){if(el.scrollHeight<=el.clientHeight+1)continue;const d=normalizeDelta(e,el),max=Math.max(0,el.scrollHeight-el.clientHeight),next=Math.max(0,Math.min(max,el.scrollTop+d));if(Math.abs(next-el.scrollTop)<.5)continue;el.scrollTop=next;const s=typeof adjustState!=='undefined'&&adjustState.v15Ocr,mem=s&&s.v155&&(s.v155.v187PaneScroll||(s.v155.v187PaneScroll={main:0,mini:0}));if(mem)mem[el.classList.contains('v160-adjust-main')?'main':'mini']=next;e.preventDefault();e.stopImmediatePropagation();return;}
  },{capture:true,passive:false});
})();

/* ===== V19：区域更多菜单稳定定位、抽屉扩展/拖拽与画布渐变联动 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const WIDTH_KEY='ai_linkuang_v182_region_drawer_width';
  const COMPACT_KEY='ai_linkuang_v182_region_drawer_compact_width';
  let raf=0,drag=null;
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  const storageGet=key=>{try{return window.localStorage?localStorage.getItem(key):null;}catch(_e){return null;}};
  const storageSet=(key,value)=>{try{if(window.localStorage)localStorage.setItem(key,String(value));}catch(_e){}};
  function overlay(){return document.getElementById('v15-ocr-overlay');}
  function sidebar(){return overlay()?.querySelector('.v15-ocr-sidebar')||null;}
  function readWidth(){const n=Number(storageGet(WIDTH_KEY));return Number.isFinite(n)&&n>=320?n:390;}
  function maxWidth(){return Math.max(320,Math.min(720,window.innerWidth-(window.innerWidth<=1050?20:52)));}
  function setDrawerWidth(value,persist=true){
    const side=sidebar();if(!side)return 0;
    const next=clamp(Math.round(Number(value)||390),320,maxWidth());
    side.style.setProperty('--v182-region-drawer-width',next+'px');
    side.style.width=next+'px';
    if(persist)storageSet(WIDTH_KEY,next);
    const btn=side.querySelector('[data-v182-drawer-expand]');
    if(btn){const expanded=next>=520,label=expanded?'收窄':'展开',title=expanded?'恢复紧凑宽度':'向右展开区域功能栏';if(btn.textContent!==label)btn.textContent=label;if(btn.getAttribute('aria-pressed')!==(expanded?'true':'false'))btn.setAttribute('aria-pressed',expanded?'true':'false');if(btn.title!==title)btn.title=title;}
    scheduleMenuPosition();return next;
  }
  function toggleDrawer(){
    const side=sidebar();if(!side)return;
    const current=Math.round(side.getBoundingClientRect().width||readWidth());
    if(current>=520){const compact=Number(storageGet(COMPACT_KEY))||390;setDrawerWidth(compact);}
    else{storageSet(COMPACT_KEY,current);setDrawerWidth(Math.min(620,maxWidth()));}
  }
  function ensureDrawerControls(){
    const o=overlay(),side=sidebar();if(!o||!side)return;
    const head=side.querySelector('.v157-sheet-head');
    if(head&&!head.querySelector('[data-v182-drawer-expand]')){
      const btn=document.createElement('button');btn.type='button';btn.className='v182-sheet-expand';btn.dataset.v182DrawerExpand='';btn.setAttribute('aria-pressed','false');
      const close=head.querySelector('.v157-sheet-close');head.insertBefore(btn,close||null);
    }
    if(!side.querySelector('[data-v182-drawer-resize]')){
      const handle=document.createElement('div');handle.className='v182-drawer-resize';handle.dataset.v182DrawerResize='';handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','拖动调整区域功能栏宽度');side.appendChild(handle);
    }
    if(!side.dataset.v182WidthReady){side.dataset.v182WidthReady='1';setDrawerWidth(readWidth(),false);}
  }
  function activeMenuParts(){
    const o=overlay();if(!o)return{};
    const menu=o.querySelector('.v179-region-more[data-v182-region-menu],.v179-region-more');
    if(!menu)return{};
    const id=menu.dataset.v182RegionMenu||menu.closest('[data-v155-select-region]')?.dataset.v155SelectRegion||'';
    const esc=window.CSS&&CSS.escape?CSS.escape(String(id)):String(id).replace(/["\\]/g,'\\$&');
    const button=o.querySelector(`[data-v179-more-toggle="${esc}"][aria-expanded="true"]`)||o.querySelector(`[data-v179-more-toggle="${esc}"]`);
    return{menu,button};
  }
  function positionMenu(){
    raf=0;const {menu,button}=activeMenuParts();if(!menu||!button||!button.isConnected){return;}
    menu.classList.remove('v182-menu-ready');
    menu.style.setProperty('--v182-menu-left','12px');menu.style.setProperty('--v182-menu-top','12px');
    const br=button.getBoundingClientRect(),mr=menu.getBoundingClientRect();
    const gap=9,pad=12,mw=Math.max(150,mr.width||208),mh=Math.max(38,mr.height||80);
    const roomRight=window.innerWidth-br.right-gap,roomLeft=br.left-gap;
    const placeRight=roomRight>=mw||roomRight>=roomLeft;
    let left=placeRight?br.right+gap:br.left-mw-gap;
    left=clamp(left,pad,Math.max(pad,window.innerWidth-mw-pad));
    let top=br.top;
    if(top+mh>window.innerHeight-pad)top=br.bottom-mh;
    top=clamp(top,pad,Math.max(pad,window.innerHeight-mh-pad));
    menu.style.setProperty('--v182-menu-left',Math.round(left)+'px');
    menu.style.setProperty('--v182-menu-top',Math.round(top)+'px');
    menu.dataset.v182Side=placeRight?'right':'left';
    requestAnimationFrame(()=>menu.classList.add('v182-menu-ready'));
  }
  function scheduleMenuPosition(){if(raf)return;raf=requestAnimationFrame(positionMenu);}
  document.addEventListener('click',e=>{if(e.target.closest('[data-v182-drawer-expand]')){e.preventDefault();e.stopImmediatePropagation();toggleDrawer();}},true);
  document.addEventListener('pointerdown',e=>{
    const handle=e.target.closest('[data-v182-drawer-resize]');if(!handle)return;
    const side=sidebar();if(!side)return;e.preventDefault();e.stopImmediatePropagation();
    drag={startX:e.clientX,startWidth:side.getBoundingClientRect().width,pointerId:e.pointerId,handle};
    handle.classList.add('dragging');document.body.classList.add('v182-resizing-drawer');
    try{handle.setPointerCapture(e.pointerId);}catch(_e){}
  },true);
  document.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.pointerId)return;e.preventDefault();setDrawerWidth(drag.startWidth+(e.clientX-drag.startX),false);},true);
  function endDrag(e){if(!drag||e.pointerId!==drag.pointerId)return;const side=sidebar();drag.handle?.classList.remove('dragging');document.body.classList.remove('v182-resizing-drawer');if(side)setDrawerWidth(side.getBoundingClientRect().width,true);drag=null;}
  document.addEventListener('pointerup',endDrag,true);document.addEventListener('pointercancel',endDrag,true);
  window.addEventListener('resize',()=>{const side=sidebar();if(side)setDrawerWidth(side.getBoundingClientRect().width||readWidth(),false);scheduleMenuPosition();});
  window.addEventListener('scroll',scheduleMenuPosition,true);
  const mo=new MutationObserver(muts=>{if(muts.some(m=>m.addedNodes.length||m.removedNodes.length)){ensureDrawerControls();scheduleMenuPosition();}});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  requestAnimationFrame(()=>{ensureDrawerControls();scheduleMenuPosition();});
  window.__V182_TEST__={version:'V20',ensureDrawerControls,setDrawerWidth,positionMenu};
})();


/* ===== V19：区域“更多”Portal 菜单与预览框快速定位列表 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const PORTAL_ID='v183-region-menu-portal';
  let activeId='',anchorEl=null,positionRaf=0;
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const cssEscape=value=>window.CSS&&CSS.escape?CSS.escape(String(value)):String(value).replace(/["\\]/g,'\\$&');
  function state(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function row(id){const s=state();return s&&s.result&&Array.isArray(s.result.regions)?s.result.regions.find(r=>String(r.id)===String(id)):null;}
  function portal(){return document.getElementById(PORTAL_ID);}
  function closeMenu(){
    portal()?.remove();
    document.querySelectorAll('#v15-ocr-overlay [data-v179-more-toggle][aria-expanded="true"]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
    activeId='';anchorEl=null;
  }
  function actionHtml(r){
    const out=[];
    /* V20：已启用区域不再提供“隐藏区域”，避免与区域启用开关冲突；仅为旧隐藏状态保留“显示区域”。 */
    if(r.visible===false)out.push(`<button type="button" data-v183-action="visible"><span>显示区域</span></button>`);
    if(r.locked)out.push(`<button type="button" data-v183-action="lock"><span>解锁区域</span></button>`);
    else out.push(`<button type="button" data-v183-action="lock"><span>锁定区域</span></button>`);
    out.push(`<button type="button" data-v183-action="rename"><span>重命名</span></button>`);
    const s=state();if(s&&!(s.selected||[]).includes(r.id))out.push(`<button type="button" data-v183-action="reason"><span>修改关闭原因</span></button>`);
    return out.join('');
  }
  function createPortal(id){
    const r=row(id);if(!r)return null;
    const menu=document.createElement('div');menu.id=PORTAL_ID;menu.className='v183-region-menu-portal';menu.dataset.regionId=String(id);menu.setAttribute('role','menu');
    menu.innerHTML=`<div class="v183-region-menu-head"><b>${esc(window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域')}</b><button type="button" data-v183-close aria-label="关闭">×</button></div><div class="v183-region-menu-grid">${actionHtml(r)}</div>`;
    document.body.appendChild(menu);return menu;
  }
  function positionMenu(){
    positionRaf=0;const menu=portal();if(!menu||!anchorEl||!anchorEl.isConnected){closeMenu();return;}
    const br=anchorEl.getBoundingClientRect(),mw=Math.max(220,menu.offsetWidth||220),mh=Math.max(92,menu.offsetHeight||92),gap=8,pad=10;
    const rightSpace=window.innerWidth-br.right-gap,leftSpace=br.left-gap;
    let left=rightSpace>=mw||rightSpace>=leftSpace?br.right+gap:br.left-mw-gap;
    left=Math.max(pad,Math.min(left,window.innerWidth-mw-pad));
    let top=br.top;
    if(top+mh>window.innerHeight-pad)top=br.bottom-mh;
    top=Math.max(pad,Math.min(top,window.innerHeight-mh-pad));
    menu.style.left=Math.round(left)+'px';menu.style.top=Math.round(top)+'px';menu.classList.add('ready');
  }
  function schedulePosition(){if(positionRaf)return;positionRaf=requestAnimationFrame(positionMenu);}
  function toggleMenu(id,anchor){
    id=String(id||'');
    if(activeId===id&&portal()){closeMenu();return;}
    closeMenu();const r=row(id);if(!r)return;
    activeId=id;anchorEl=anchor&&anchor.isConnected?anchor:document.querySelector(`#v15-ocr-overlay [data-v179-more-toggle="${cssEscape(id)}"]`);
    document.querySelectorAll('#v15-ocr-overlay [data-v179-more-toggle]').forEach(btn=>btn.setAttribute('aria-expanded',String(btn===anchorEl)));
    createPortal(id);schedulePosition();
  }
  window.__V183_TOGGLE_REGION_MENU__=toggleMenu;
  function history(label){try{window.__V163_REGION_HISTORY_PUSH&&window.__V163_REGION_HISTORY_PUSH(label,true);}catch(_e){}}
  function audit(action,r,detail=''){try{return window.__V179_AUDIT__&&window.__V179_AUDIT__(action,r,detail);}catch(_e){return null;}}
  function refresh(full=true){try{window.__V179_TEST__?.refresh?.(full);}catch(_e){try{window.__V164_RENDER_OCR&&window.__V164_RENDER_OCR();}catch(_e2){}}}
  function doAction(action){
    const s=state(),r=row(activeId);if(!s||!r)return;
    if(action==='visible'){
      /* V20：只允许恢复历史遗留的隐藏区域，不再从“更多”菜单隐藏已启用区域。 */
      if(r.visible!==false){closeMenu();window.__V184_MENU_ACTION_FEEDBACK__?.(`当前区域已显示，请使用区域开关管理启用状态`,'');return;}
      history('显示状态变更前');r.visible=true;const item=audit('显示区域',r);history('显示区域');const msg=`已显示“${window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域'}”`;closeMenu();refresh(true);window.__V184_MENU_ACTION_FEEDBACK__?.(msg,item&&item.id);return;
    }
    if(action==='lock'){
      history('锁定状态变更前');r.locked=!r.locked;r.status=r.locked?'locked':'ready';const item=audit(r.locked?'锁定区域':'解锁区域',r);history(r.locked?'锁定区域':'解锁区域');const msg=`已${r.locked?'锁定':'解锁'}“${window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域'}”`;closeMenu();refresh(true);window.__V184_MENU_ACTION_FEEDBACK__?.(msg,item&&item.id);return;
    }
    if(action==='rename'){
      const oldName=r.name||r.label||'',name=window.prompt('输入区域名称',oldName);if(!name||!name.trim())return;
      history('重命名前');r.name=name.trim();r.label=r.name;const item=audit('重命名区域',r,`${oldName} → ${r.name}`);history('重命名区域');const msg=`已重命名为“${r.name}”`;closeMenu();refresh(true);window.__V184_MENU_ACTION_FEEDBACK__?.(msg,item&&item.id);return;
    }
    if(action==='reason'){
      const id=r.id;closeMenu();if(typeof window.__V178_ASK_CLOSE_REASON__==='function')window.__V178_ASK_CLOSE_REASON__(id);return;
    }
  }
  document.addEventListener('pointerdown',e=>{
    const menu=e.target?.closest?.('#'+PORTAL_ID);if(menu){
      e.preventDefault();e.stopImmediatePropagation();
      if(e.target.closest('[data-v183-close]')){closeMenu();return;}
      const btn=e.target.closest('[data-v183-action]');if(btn)doAction(btn.dataset.v183Action);
      return;
    }
    if(portal()&&!e.target?.closest?.('#v15-ocr-overlay [data-v179-more-toggle]'))closeMenu();
  },true);
  window.addEventListener('resize',schedulePosition);
  window.addEventListener('scroll',schedulePosition,true);

  function locateListCard(id){
    const overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return false;
    const side=overlay.querySelector('.v15-ocr-sidebar'),sel=`[data-v155-select-region="${cssEscape(id)}"]`,card=overlay.querySelector(`#v155-region-list ${sel}`);
    if(!card||!side)return false;
    const sideRect=side.getBoundingClientRect(),cardRect=card.getBoundingClientRect();
    const desired=side.scrollTop+(cardRect.top-sideRect.top)-Math.max(62,(side.clientHeight-cardRect.height)/2);
    if(typeof side.scrollTo==='function')side.scrollTo({top:Math.max(0,desired),behavior:'smooth'});else side.scrollTop=Math.max(0,desired);
    card.classList.remove('v183-preview-list-pulse');void card.offsetWidth;card.classList.add('v183-preview-list-pulse');setTimeout(()=>card.classList.remove('v183-preview-list-pulse'),1050);
    return true;
  }
  function locateWithRetry(id){[0,45,140,300].forEach(ms=>setTimeout(()=>locateListCard(id),ms));}
  document.addEventListener('click',e=>{
    const box=e.target?.closest?.('#v15-ocr-overlay .v15-ocr-preview [data-v154-region-box],#v15-ocr-overlay .v15-ocr-preview [data-v155-target-box]');
    if(!box||e.target.closest('[data-v154-region-handle],[data-v168-target-handle]'))return;
    const id=box.dataset.v154RegionBox||box.dataset.v155TargetBox;if(!id)return;
    locateWithRetry(id);
  },true);
  window.__V183_LOCATE_REGION_CARD__=locateWithRetry;
  window.__V183_TEST__={version:'V20',toggleMenu,closeMenu,locateListCard,state,row};
  document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
})();


/* ===== V19：定位反馈、悬停联动、方向键切换与快捷操作 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const TYPE_LABELS={text:'文字区域',product:'产品区域',person:'人物/宠物区域',background:'背景区域',decoration:'装饰区域',unclassified:'未分类区域'};
  const cssEscape=value=>window.CSS&&CSS.escape?CSS.escape(String(value)):String(value).replace(/["\\]/g,'\\$&');
  let hoverId='',previewPointer=null,toastTimer=0,feedbackBatch={verb:'',count:0,regions:[],auditId:'',lastAt:0};
  function state(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function rows(){const s=state();return s&&s.result&&Array.isArray(s.result.regions)?s.result.regions:[];}
  function row(id){return rows().find(r=>String(r.id)===String(id));}
  function typeLabel(r){return TYPE_LABELS[r&&r.type]||'区域';}
  function locationText(r,prefix='已定位'){return `${prefix} ${window.__V221_REGION_NAME__?.(r)||r?.name||r?.label||typeLabel(r)}`;}
  function removeFeedback(){document.querySelector('.v184-action-feedback')?.remove();clearTimeout(toastTimer);toastTimer=0;feedbackBatch={verb:'',count:0,regions:[],auditId:'',lastAt:0};}
  function escapeFeedback(value){return String(value||'操作完成').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
  function feedback(message,auditId='',kind='ok',opts={}){
    const now=Date.now(),match=String(message||'').match(/^已(隐藏|显示|锁定|解锁)\s+(.+)$/),batchable=kind==='ok'&&match;
    if(batchable&&feedbackBatch.verb===match[1]&&now-feedbackBatch.lastAt<1800){
      feedbackBatch.count+=1;feedbackBatch.lastAt=now;feedbackBatch.auditId=String(auditId||feedbackBatch.auditId||'');
      if(!feedbackBatch.regions.includes(match[2]))feedbackBatch.regions.push(match[2]);
      const el=document.querySelector('.v184-action-feedback');
      if(el){const label=feedbackBatch.regions.slice(0,3).join('、')+(feedbackBatch.regions.length>3?' 等':'');el.querySelector('span').textContent=`已连续${feedbackBatch.verb} ${feedbackBatch.count} 个区域：${label}`;if(feedbackBatch.auditId)el.dataset.auditId=feedbackBatch.auditId;clearTimeout(toastTimer);toastTimer=setTimeout(removeFeedback,5200);return el;}
    }
    removeFeedback();
    if(batchable)feedbackBatch={verb:match[1],count:1,regions:[match[2]],auditId:String(auditId||''),lastAt:now};
    const el=document.createElement('div');el.className=`v184-action-feedback ${kind}`;el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML=`<span>${escapeFeedback(message)}</span>${auditId?'<button type="button" data-v184-toast-undo>撤回最近一次</button>':''}`;
    if(auditId)el.dataset.auditId=String(auditId);
    document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('show'));
    toastTimer=setTimeout(removeFeedback,auditId?5200:2800);
    return el;
  }
  window.__V184_MENU_ACTION_FEEDBACK__=(message,auditId)=>feedback(message,auditId,'ok',{batch:true});
  document.addEventListener('pointerdown',e=>{
    const btn=e.target?.closest?.('[data-v184-toast-undo]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();const host=btn.closest('.v184-action-feedback'),id=host&&host.dataset.auditId;
    if(id&&typeof window.__V180_AUDIT_ROLLBACK__==='function'){window.__V180_AUDIT_ROLLBACK__(id);removeFeedback();feedback('已撤回上一项区域操作','','ok');}
  },true);

  function canvasBoxes(id){
    const overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return[];const q=cssEscape(id);
    return Array.from(overlay.querySelectorAll(`[data-v154-region-box="${q}"],[data-v155-target-box="${q}"]`));
  }
  function clearHover(){
    if(!hoverId)return;canvasBoxes(hoverId).forEach(el=>el.classList.remove('v184-hover-sync'));hoverId='';
  }
  function setHover(id){
    id=String(id||'');if(!id||hoverId===id)return;clearHover();hoverId=id;canvasBoxes(id).forEach(el=>el.classList.add('v184-hover-sync'));
  }
  document.addEventListener('pointerover',e=>{
    const card=e.target?.closest?.('#v15-ocr-overlay #v155-region-list [data-v155-select-region]');if(!card)return;
    if(e.relatedTarget&&card.contains(e.relatedTarget))return;setHover(card.dataset.v155SelectRegion);
  },true);
  document.addEventListener('pointerout',e=>{
    const card=e.target?.closest?.('#v15-ocr-overlay #v155-region-list [data-v155-select-region]');if(!card)return;
    if(e.relatedTarget&&card.contains(e.relatedTarget))return;clearHover();
  },true);

  function locateList(id){try{window.__V183_LOCATE_REGION_CARD__?.(id);}catch(_e){}}
  function selectLocate(id,opts={}){
    const r=row(id);if(!r)return false;const s=state();if(!s)return false;
    const enabled=(s.selected||[]).some(x=>String(x)===String(id));
    if(!enabled){feedback(`“${window.__V221_REGION_NAME__?.(r)||r.name||r.label||'区域'}”已关闭，请先打开区域开关`,'','bad');locateList(id);return false;}
    if(typeof window.__V175_SELECT_AND_LOCATE_REGION==='function')window.__V175_SELECT_AND_LOCATE_REGION(id);
    else{s.activeId=id;try{window.__V168_HOT_SWITCH_REGION?.(id,{select:true,scroll:false,keepView:true});}catch(_e){}}
    locateList(id);canvasBoxes(id).forEach(el=>{el.classList.remove('v184-locate-pulse');void el.offsetWidth;el.classList.add('v184-locate-pulse');setTimeout(()=>el.classList.remove('v184-locate-pulse'),1000);});
    if(opts.feedback!==false)feedback(locationText(r,opts.prefix||'已定位'),'','ok');return true;
  }

  document.addEventListener('pointerdown',e=>{
    const quick=e.target?.closest?.('[data-v184-quick-locate],[data-v184-quick-adjust]');if(!quick)return;
    e.preventDefault();e.stopImmediatePropagation();const id=quick.dataset.v184QuickLocate||quick.dataset.v184QuickAdjust;if(!selectLocate(id,{feedback:false}))return;
    if(quick.dataset.v184QuickAdjust!=null){
      const s=state();if(s&&s.v157&&s.v157.mode!=='adjust')setTimeout(()=>document.querySelector('#v15-ocr-overlay [data-v157-mode="adjust"]')?.click(),0);
      feedback(`已打开调整 · ${window.__V221_REGION_NAME__?.(row(id))||row(id)?.name||row(id)?.label||'区域'}`,'','ok');
    }else feedback(locationText(row(id)),'','ok');
  },true);

  document.addEventListener('pointerdown',e=>{
    const box=e.target?.closest?.('#v15-ocr-overlay .v15-ocr-preview [data-v154-region-box],#v15-ocr-overlay .v15-ocr-preview [data-v155-target-box]');
    if(!box||e.target.closest('[data-v154-region-handle],[data-v168-target-handle]'))return;
    previewPointer={id:box.dataset.v154RegionBox||box.dataset.v155TargetBox,pointerId:e.pointerId,x:e.clientX,y:e.clientY};
  },true);
  document.addEventListener('pointerup',e=>{
    const p=previewPointer;previewPointer=null;if(!p||p.pointerId!==e.pointerId)return;
    if(Math.hypot(e.clientX-p.x,e.clientY-p.y)>6)return;
    setTimeout(()=>selectLocate(p.id,{prefix:'已定位'}),0);
  },true);
  document.addEventListener('pointercancel',()=>{previewPointer=null;},true);

  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey||!['ArrowUp','ArrowDown'].includes(e.key))return;
    const s=state(),overlay=document.getElementById('v15-ocr-overlay');if(!s||!s.open||!overlay)return;
    const target=e.target,tag=(target&&target.tagName||'').toLowerCase();if(['input','textarea','select'].includes(tag)||target?.isContentEditable)return;
    if(document.querySelector('.v178-modal-backdrop'))return;
    const enabled=new Set((s.selected||[]).map(String));const list=rows().filter(r=>enabled.has(String(r.id))&&r.visible!==false);if(!list.length)return;
    let index=list.findIndex(r=>String(r.id)===String(s.activeId));if(index<0)index=0;else index=(index+(e.key==='ArrowDown'?1:-1)+list.length)%list.length;
    e.preventDefault();e.stopImmediatePropagation();selectLocate(list[index].id,{prefix:'已定位'});
  },true);

  window.__V184_TEST__={version:'V20',state,row,selectLocate,setHover,clearHover,feedback};
  document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
})();


/* ===== V19：自由调宽、小图独立缩放/平移、框透明度与紧凑历史 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const STORAGE_RATIO='ai_v186_adjust_ratio';
  let splitDrag=null,panDrag=null,spaceHeld=false;
  function appState(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function v155(){const s=appState();return s&&s.v155||null;}
  function mini(){const s=appState(),v=v155();if(!v||!s)return null;const d={showSource:true,zoom:1,panX:0,panY:0,sourceOpacity:.72,targetOpacity:.88},key=String(s.activeId||'');if(!v.v187MiniViews||typeof v.v187MiniViews!=='object'||Array.isArray(v.v187MiniViews))v.v187MiniViews={};if(key&&!v.v187MiniViews[key])v.v187MiniViews[key]=Object.assign({},d);const m=Object.assign({},d,key?v.v187MiniViews[key]:v.v162Mini||{});if(key)v.v187MiniViews[key]=m;v.v162Mini=m;return m;}
  function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
  function layout(){return document.querySelector('#v15-ocr-overlay .v186-adjust-layout');}
  function applyRatio(value,persist=true){const host=layout(),v=v155();value=clamp(Number(value)||58,28,78);if(v)v.v186LayoutRatio=value;if(host){host.style.setProperty('--v186-left-pct',`${value}%`);const readout=host.querySelector('[data-v186-pane-splitter] span');if(readout&&readout.textContent!==`${Math.round(value)}%`)readout.textContent=`${Math.round(value)}%`;}if(persist){try{localStorage.setItem(STORAGE_RATIO,String(value));}catch(_e){}}return value;}
  document.addEventListener('pointerdown',e=>{const grip=e.target&&e.target.closest&&e.target.closest('[data-v186-pane-splitter]');if(!grip)return;const host=grip.closest('.v186-adjust-layout'),rect=host&&host.getBoundingClientRect();if(!rect||rect.width<1)return;e.preventDefault();e.stopImmediatePropagation();splitDrag={pointerId:e.pointerId,host,rect};document.body.classList.add('v186-resizing-panes');grip.classList.add('dragging');try{grip.setPointerCapture(e.pointerId);}catch(_e){}},true);
  document.addEventListener('pointermove',e=>{if(!splitDrag||e.pointerId!==splitDrag.pointerId)return;e.preventDefault();const ratio=(e.clientX-splitDrag.rect.left)/splitDrag.rect.width*100;applyRatio(ratio,false);},true);
  function finishSplit(e){if(!splitDrag||e&&e.pointerId!==splitDrag.pointerId)return;const grip=splitDrag.host&&splitDrag.host.querySelector('[data-v186-pane-splitter]');if(grip){grip.classList.remove('dragging');try{grip.releasePointerCapture(e&&e.pointerId);}catch(_e){}}const current=v155()&&v155().v186LayoutRatio;applyRatio(current,true);splitDrag=null;document.body.classList.remove('v186-resizing-panes');}
  document.addEventListener('pointerup',finishSplit,true);document.addEventListener('pointercancel',finishSplit,true);
  document.addEventListener('dblclick',e=>{const grip=e.target&&e.target.closest&&e.target.closest('[data-v186-pane-splitter]');if(!grip)return;e.preventDefault();applyRatio(58,true);},true);
  document.addEventListener('keydown',e=>{const grip=e.target&&e.target.closest&&e.target.closest('[data-v186-pane-splitter]');if(!grip||!['ArrowLeft','ArrowRight','Home'].includes(e.key))return;e.preventDefault();const current=Number(v155()&&v155().v186LayoutRatio)||58;applyRatio(e.key==='Home'?58:current+(e.key==='ArrowRight'?2:-2),true);},true);

  function miniStage(){return document.querySelector('#v15-ocr-overlay [data-v162-mini-stage]');}
  function miniWorld(stage=miniStage()){return stage&&stage.querySelector('[data-v186-mini-world]');}
  function constrainPan(stage,z,x,y){const w=stage.clientWidth||1,h=stage.clientHeight||1;return{x:clamp(x,w*(1-z),0),y:clamp(y,h*(1-z),0)};}
  function applyMiniView(stage=miniStage(),persist=true){const m=mini(),world=miniWorld(stage);if(!m||!stage||!world)return;m.zoom=clamp(Number(m.zoom)||1,1,6);const p=constrainPan(stage,m.zoom,Number(m.panX)||0,Number(m.panY)||0);m.panX=p.x;m.panY=p.y;world.style.setProperty('--v186-mini-zoom',String(m.zoom));world.style.setProperty('--v186-mini-pan-x',`${m.panX}px`);world.style.setProperty('--v186-mini-pan-y',`${m.panY}px`);const readout=stage.closest('.v162-mini-panel')&&stage.closest('.v162-mini-panel').querySelector('[data-v186-mini-zoom-readout]');if(readout&&readout.textContent!==`${Math.round(m.zoom*100)}%`)readout.textContent=`${Math.round(m.zoom*100)}%`;stage.classList.toggle('zoomed',m.zoom>1.001);}
  document.addEventListener('wheel',e=>{const stage=e.target&&e.target.closest&&e.target.closest('#v15-ocr-overlay [data-v162-mini-stage]');if(!stage)return;const browserZoomGesture=!!(e.ctrlKey||e.metaKey);if(browserZoomGesture&&!e.altKey){e.preventDefault();e.stopImmediatePropagation();return;}const zoomIntent=!!e.altKey;if(!zoomIntent){const pane=stage.closest('.v160-side-content');if(pane){let delta=Number(e.deltaY)||0;if(e.deltaMode===1)delta*=18;else if(e.deltaMode===2)delta*=Math.max(120,pane.clientHeight||500);const max=Math.max(0,pane.scrollHeight-pane.clientHeight),next=clamp(pane.scrollTop+delta,0,max);if(Math.abs(next-pane.scrollTop)>.25){pane.scrollTop=next;const mem=paneMemory();if(mem)mem.mini=next;e.preventDefault();e.stopImmediatePropagation();scheduleRails();return;}}return;}e.preventDefault();e.stopImmediatePropagation();const m=mini();if(!m)return;const rect=stage.getBoundingClientRect(),old=clamp(Number(m.zoom)||1,1,6),factor=Math.exp(-e.deltaY*.0015),next=clamp(old*factor,1,6),px=e.clientX-rect.left,py=e.clientY-rect.top,wx=(px-(Number(m.panX)||0))/old,wy=(py-(Number(m.panY)||0))/old;m.zoom=next;m.panX=px-wx*next;m.panY=py-wy*next;applyMiniView(stage,true);},{capture:true,passive:false});
  document.addEventListener('click',e=>{const fit=e.target&&e.target.closest&&e.target.closest('[data-v186-mini-fit]');if(!fit)return;e.preventDefault();e.stopImmediatePropagation();const m=mini(),stage=fit.closest('.v162-mini-panel')?.querySelector('[data-v162-mini-stage]');if(m){m.zoom=1;m.panX=0;m.panY=0;if(typeof window.__V188_FIT_MINI_STAGE__==='function')window.__V188_FIT_MINI_STAGE__(stage,{force:true});applyMiniView(stage,true);}},true);
  document.addEventListener('keydown',e=>{if(e.code!=='Space'||e.repeat)return;const s=appState();if(!s||!s.open)return;const tag=(e.target&&e.target.tagName||'').toLowerCase();if(['input','textarea','select','button'].includes(tag)||e.target&&e.target.isContentEditable)return;e.preventDefault();spaceHeld=true;document.body.classList.add('v186-space-pan');},true);
  document.addEventListener('keyup',e=>{if(e.code!=='Space')return;spaceHeld=false;document.body.classList.remove('v186-space-pan');},true);
  window.addEventListener('blur',()=>{spaceHeld=false;document.body.classList.remove('v186-space-pan');panDrag=null;});
  document.addEventListener('pointerdown',e=>{const stage=e.target&&e.target.closest&&e.target.closest('#v15-ocr-overlay [data-v162-mini-stage]');if(!stage||!spaceHeld||e.target.closest('[data-v162-mini-target]'))return;const m=mini();if(!m)return;e.preventDefault();e.stopImmediatePropagation();panDrag={pointerId:e.pointerId,stage,startX:e.clientX,startY:e.clientY,panX:Number(m.panX)||0,panY:Number(m.panY)||0};stage.classList.add('panning');try{stage.setPointerCapture(e.pointerId);}catch(_e){}},true);
  document.addEventListener('pointermove',e=>{if(!panDrag||e.pointerId!==panDrag.pointerId)return;e.preventDefault();const m=mini();if(!m)return;m.panX=panDrag.panX+(e.clientX-panDrag.startX);m.panY=panDrag.panY+(e.clientY-panDrag.startY);applyMiniView(panDrag.stage,true);},true);
  function finishPan(e){if(!panDrag||e&&e.pointerId!==panDrag.pointerId)return;panDrag.stage.classList.remove('panning');try{panDrag.stage.releasePointerCapture(e&&e.pointerId);}catch(_e){}panDrag=null;}
  document.addEventListener('pointerup',finishPan,true);document.addEventListener('pointercancel',finishPan,true);

  document.addEventListener('input',e=>{const ctl=e.target&&e.target.closest&&e.target.closest('[data-v186-mini-opacity]');if(!ctl)return;const m=mini();if(!m)return;const value=clamp(Number(ctl.value)||100,Number(ctl.min)||0,100)/100,mtype=ctl.dataset.v186MiniOpacity;const panel=ctl.closest('.v162-mini-panel');if(mtype==='source'){m.sourceOpacity=value;const box=panel&&panel.querySelector('[data-v186-mini-source-box]');if(box)box.style.opacity=String(value);}else{m.targetOpacity=value;const box=panel&&panel.querySelector('[data-v162-mini-target]');if(box)box.style.setProperty('--v186-target-opacity',String(value));}const out=ctl.parentElement&&ctl.parentElement.querySelector('output');if(out)out.textContent=`${Math.round(value*100)}%`;},true);

  function paneMemory(){const v=v155();if(!v)return null;if(!v.v187PaneScroll||typeof v.v187PaneScroll!=='object')v.v187PaneScroll={main:0,mini:0};return v.v187PaneScroll;}
  function paneKey(el){return el&&el.classList.contains('v160-adjust-main')?'main':'mini';}
  const lastUserScroll={main:0,mini:0};
  function restorePaneScroll(){
    const host=layout(),mem=paneMemory();if(!host||!mem)return;
    const apply=(el,key)=>{if(!el||el.matches(':active'))return;const saved=Math.max(0,Number(mem[key])||0),max=Math.max(0,el.scrollHeight-el.clientHeight);if(Date.now()-lastUserScroll[key]<900&&el.scrollTop>0)return;const target=Math.min(max,saved);if(Math.abs(el.scrollTop-target)>1)el.scrollTop=target;};
    apply(host.querySelector('.v160-adjust-main'),'main');apply(host.querySelector('.v160-side-content'),'mini');
  }
  document.addEventListener('scroll',e=>{const el=e.target;if(!(el instanceof Element)||!el.matches('#v15-ocr-overlay.v157-mode-adjust .v160-adjust-main,#v15-ocr-overlay.v157-mode-adjust .v160-side-content'))return;const key=paneKey(el),mem=paneMemory();lastUserScroll[key]=Date.now();if(mem)mem[key]=el.scrollTop;},{capture:true,passive:true});
  document.addEventListener('pointerdown',e=>{const pane=e.target&&e.target.closest&&e.target.closest('#v15-ocr-overlay.v157-mode-adjust .v160-adjust-main,#v15-ocr-overlay.v157-mode-adjust .v160-side-content');if(!pane)return;pane.dataset.v187ScrollActive='1';},true);
  document.addEventListener('pointerup',e=>{document.querySelectorAll('[data-v187-scroll-active]').forEach(el=>{delete el.dataset.v187ScrollActive;const mem=paneMemory();if(mem)mem[paneKey(el)]=el.scrollTop;});},true);
  document.addEventListener('pointercancel',()=>document.querySelectorAll('[data-v187-scroll-active]').forEach(el=>delete el.dataset.v187ScrollActive),true);

  const railIds={main:'v187-main-scroll-rail',mini:'v187-mini-scroll-rail'};let railDrag=null,railRaf=0;
  function paneFor(kind){const host=layout();return host&&host.querySelector(kind==='main'?'.v160-adjust-main':'.v160-side-content');}
  function ensureRail(kind){let rail=document.getElementById(railIds[kind]);if(!rail){rail=document.createElement('div');rail.id=railIds[kind];rail.className='v187-scroll-rail';rail.dataset.v187ScrollRail=kind;rail.setAttribute('aria-label',kind==='main'?'参数区垂直滚动条':'小图区垂直滚动条');rail.innerHTML='<i></i>';document.body.appendChild(rail);}return rail;}
  function syncRail(kind){const rail=ensureRail(kind),pane=paneFor(kind),overlay=document.getElementById('v15-ocr-overlay');if(!pane||!overlay||!overlay.classList.contains('v157-mode-adjust')){rail.hidden=true;return;}const rect=pane.getBoundingClientRect(),max=Math.max(0,pane.scrollHeight-pane.clientHeight);if(rect.width<40||rect.height<80||max<2){rail.hidden=true;return;}rail.hidden=false;rail.style.left=`${Math.round(rect.right-14)}px`;rail.style.top=`${Math.round(rect.top+2)}px`;rail.style.height=`${Math.max(48,Math.round(rect.height-4))}px`;const track=Math.max(1,rect.height-8),thumb=Math.max(44,Math.min(track,track*(pane.clientHeight/pane.scrollHeight))),top=max?((pane.scrollTop/max)*(track-thumb)):0,handle=rail.firstElementChild;handle.style.height=`${Math.round(thumb)}px`;handle.style.transform=`translateY(${Math.round(top)}px)`;rail.dataset.max=String(max);}
  function syncRails(){railRaf=0;syncRail('main');syncRail('mini');}
  function scheduleRails(){if(railRaf)return;railRaf=requestAnimationFrame(syncRails);}
  document.addEventListener('pointerdown',e=>{const rail=e.target&&e.target.closest&&e.target.closest('[data-v187-scroll-rail]');if(!rail)return;const kind=rail.dataset.v187ScrollRail,pane=paneFor(kind);if(!pane)return;e.preventDefault();e.stopImmediatePropagation();const rr=rail.getBoundingClientRect(),thumb=rail.firstElementChild,tr=thumb.getBoundingClientRect(),max=Math.max(0,pane.scrollHeight-pane.clientHeight);if(max<1)return;if(e.target===thumb){railDrag={pointerId:e.pointerId,rail,pane,startY:e.clientY,startScroll:pane.scrollTop,track:rr.height,thumb:tr.height,max};thumb.classList.add('dragging');try{rail.setPointerCapture(e.pointerId);}catch(_e){}}else{const ratio=Math.max(0,Math.min(1,(e.clientY-rr.top-tr.height/2)/Math.max(1,rr.height-tr.height)));pane.scrollTop=ratio*max;const mem=paneMemory();if(mem)mem[kind]=pane.scrollTop;scheduleRails();}},true);
  document.addEventListener('pointermove',e=>{if(!railDrag||e.pointerId!==railDrag.pointerId)return;e.preventDefault();e.stopImmediatePropagation();const usable=Math.max(1,railDrag.track-railDrag.thumb),delta=(e.clientY-railDrag.startY)/usable*railDrag.max;railDrag.pane.scrollTop=Math.max(0,Math.min(railDrag.max,railDrag.startScroll+delta));const mem=paneMemory();if(mem)mem[railDrag.rail.dataset.v187ScrollRail]=railDrag.pane.scrollTop;scheduleRails();},true);
  function finishRail(e){if(!railDrag||e&&e.pointerId!==railDrag.pointerId)return;railDrag.rail.firstElementChild?.classList.remove('dragging');try{railDrag.rail.releasePointerCapture(e&&e.pointerId);}catch(_e){}railDrag=null;scheduleRails();}
  document.addEventListener('pointerup',finishRail,true);document.addEventListener('pointercancel',finishRail,true);
  document.addEventListener('scroll',e=>{if(e.target?.matches?.('#v15-ocr-overlay.v157-mode-adjust .v160-adjust-main,#v15-ocr-overlay.v157-mode-adjust .v160-side-content'))scheduleRails();},{capture:true,passive:true});
  window.addEventListener('resize',scheduleRails);document.addEventListener('wheel',scheduleRails,{capture:true,passive:true});

  /* V19：完整画面优先。按右侧真实可视矩形计算，而不是使用可能被父级
     height:100% 放大的逻辑高度；尺寸只有在容器发生实质变化时才更新。 */
  let fitRaf=0,fitObserver=null;
  function imageRatio(stage){
    if(!stage)return 1;
    const image=stage.querySelector('img'),naturalW=Number(image&&image.naturalWidth)||0,naturalH=Number(image&&image.naturalHeight)||0;
    const width=naturalW||Number(stage.dataset.v188ImageWidth)||1,height=naturalH||Number(stage.dataset.v188ImageHeight)||1;
    return clamp(width/Math.max(1,height),.12,8);
  }
  function fitMiniStage(stage,opts={}){
    if(!stage||!stage.isConnected)return null;
    const content=stage.closest('.v160-side-content'),panel=stage.closest('.v162-mini-panel'),overlay=document.getElementById('v15-ocr-overlay');
    if(!content||!panel||!overlay)return null;
    /* V19：区域框交互期间完全冻结 fit，避免 ResizeObserver、边界提示或历史更新
       在 pointermove 中改变小图尺寸。 */
    if(window.__V190_MINI_RESIZE_ACTIVE__||stage.dataset.v190ResizeLocked==='true'){
      const lockedW=stage.getBoundingClientRect().width||Number(stage.dataset.v189FitWidth)||0,lockedH=stage.getBoundingClientRect().height||Number(stage.dataset.v189FitHeight)||0;
      return{width:lockedW,height:lockedH,ratio:imageRatio(stage),availableWidth:lockedW,availableHeight:lockedH,visibleHeight:content.clientHeight||0,changed:false,locked:true};
    }
    const contentRect=content.getBoundingClientRect(),overlayRect=overlay.getBoundingClientRect();
    const cs=getComputedStyle(content),padX=(parseFloat(cs.paddingLeft)||0)+(parseFloat(cs.paddingRight)||0),padY=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
    const ps=getComputedStyle(panel),gap=parseFloat(ps.rowGap||ps.gap)||0;
    let fixed=0;for(const child of panel.children){if(child===stage||child.matches?.('[data-v180-mini-boundary]'))continue;fixed+=child.getBoundingClientRect().height||child.offsetHeight||0;}
    fixed+=Math.max(0,panel.children.length-1)*gap;
    const visibleBottom=Math.min(window.innerHeight||overlayRect.bottom,overlayRect.bottom,contentRect.bottom);
    const visibleHeight=Math.max(0,visibleBottom-Math.max(contentRect.top,overlayRect.top));
    const availableWidth=Math.max(140,(panel.clientWidth||contentRect.width||420)-padX);
    /* 允许在低高度窗口中缩到 120px，完整显示优先于最小视觉尺寸。 */
    const availableHeight=Math.max(120,visibleHeight-padY-fixed-8);
    const ratio=imageRatio(stage);
    let width=Math.min(availableWidth,availableHeight*ratio),height=width/ratio;
    if(height>availableHeight){height=availableHeight;width=height*ratio;}
    width=Math.max(120,Math.min(availableWidth,width));height=Math.max(120,Math.min(availableHeight,height));
    /* 当最小宽高与可用空间冲突时，再次以完整可见为准。 */
    if(width>availableWidth){width=availableWidth;height=width/ratio;}
    if(height>availableHeight){height=availableHeight;width=height*ratio;}
    const oldW=Number(stage.dataset.v189FitWidth)||0,oldH=Number(stage.dataset.v189FitHeight)||0;
    const changed=opts.force||Math.abs(oldW-width)>2||Math.abs(oldH-height)>2;
    if(changed){
      const fitW=`${Math.max(1,Math.round(width))}px`,fitH=`${Math.max(1,Math.round(height))}px`;
      stage.style.setProperty('--v188-stage-width',fitW);
      stage.style.setProperty('--v188-stage-height',fitH);
      /* 写到稳定的 overlay 宿主，使参数面板重建后的新 stage 在首帧就继承正确尺寸，
         不再先显示 240px 回退值再恢复。 */
      overlay.style.setProperty('--v188-stage-width',fitW);overlay.style.setProperty('--v188-stage-height',fitH);
      stage.dataset.v189FitWidth=String(width);stage.dataset.v189FitHeight=String(height);
    }
    stage.dataset.v188Fit='ready';stage.dataset.v189CompleteView='true';
    if(opts.force){const m=mini();if(m){m.zoom=1;m.panX=0;m.panY=0;}}
    if(changed||opts.force)applyMiniView(stage,!!opts.persist);
    scheduleRails();return{width,height,ratio,availableWidth,availableHeight,visibleHeight,changed};
  }
  function fitAllMiniStages(){fitRaf=0;document.querySelectorAll('#v15-ocr-overlay.v157-mode-adjust [data-v162-mini-stage]').forEach(stage=>fitMiniStage(stage));}
  function scheduleFit(){if(fitRaf)return;fitRaf=requestAnimationFrame(fitAllMiniStages);}
  window.__V188_FIT_MINI_STAGE__=fitMiniStage;
  document.addEventListener('load',e=>{if(e.target&&e.target.matches&&e.target.matches('#v15-ocr-overlay [data-v162-mini-stage] img'))scheduleFit();},true);
  if(typeof ResizeObserver==='function'){
    fitObserver=new ResizeObserver(entries=>{if(entries.some(entry=>entry.target&&entry.target.classList&&entry.target.classList.contains('v160-adjust-side')))scheduleFit();});
    const watch=()=>{const side=layout()?.querySelector('.v160-adjust-side');if(side&&!side.dataset.v189FitObserved){side.dataset.v189FitObserved='1';fitObserver.observe(side);}};setTimeout(watch,0);
  }
  const observer=new MutationObserver(()=>{
    const host=layout();if(host){let saved=58;try{saved=Number(localStorage.getItem(STORAGE_RATIO))||58;}catch(_e){}const value=Number(v155()&&v155().v186LayoutRatio)||saved;applyRatio(value,false);}
    const stage=miniStage();if(stage&&!window.__V190_MINI_RESIZE_ACTIVE__)applyMiniView(stage,false);
    if(!window.__V190_MINI_RESIZE_ACTIVE__)scheduleFit();
    if(fitObserver){const side=layout()?.querySelector('.v160-adjust-side');if(side&&!side.dataset.v189FitObserved){side.dataset.v189FitObserved='1';fitObserver.observe(side);}}
    requestAnimationFrame(()=>{restorePaneScroll();scheduleRails();scheduleFit();});
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.__V186_TEST__={version:'V20',applyRatio,applyMiniView,mini,constrainPan,restorePaneScroll};
  window.__V187_TEST__={version:'V20',mini,paneMemory,restorePaneScroll,applyMiniView,syncRails,paneFor};
  window.__V188_TEST__={version:'V20',fitMiniStage,fitAllMiniStages,scheduleFit,imageRatio,paneFor,syncRails};
  window.__V190_TEST__={version:'V20',fitMiniStage,isResizeActive:()=>!!window.__V190_MINI_RESIZE_ACTIVE__};
  scheduleFit();scheduleRails();
  document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
})();


/* ===== V20：自由添加区域名称稳定输入通道 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  let composing=false;
  const selector='#v15-ocr-overlay [data-v192-add-region-name]';
  function isNameInput(t){return !!(t&&t.matches&&t.matches(selector));}
  function state(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function sync(input){const s=state();if(!s||!input)return;s.v192AddRegionName=input.value;try{window.__V198_UPDATE_REGION_NAME_STATE__?.(input);}catch(_e){}const sec=input.closest('#v155-region-list');if(sec&&typeof window.__V195_REGION_LIST_SIGNATURE__==='function')sec.dataset.v178Signature=window.__V195_REGION_LIST_SIGNATURE__();}
  document.addEventListener('compositionstart',e=>{if(isNameInput(e.target))composing=true;},true);
  document.addEventListener('compositionend',e=>{if(!isNameInput(e.target))return;composing=false;sync(e.target);},true);
  document.addEventListener('input',e=>{if(!isNameInput(e.target))return;sync(e.target);},true);
  document.addEventListener('focusin',e=>{if(!isNameInput(e.target))return;e.target.dataset.v195StableInput='true';try{window.__V198_UPDATE_REGION_NAME_STATE__?.(e.target);}catch(_e){}},true);
  /* V21：以 click 为主、pointerup 为后备的独立启动通道。
     不再在 pointerdown 阶段阻断事件，避免 Windows/Edge 下按钮按下后 click 被旧监听或指针捕获吞掉。 */
  let startPress=null,startFallbackTimer=0;
  function beginDrawingFromControl(){
    const s=state();
    if(s?.correctionAddMode&&s?.v199CreationStep==='drawing'){window.__V2051_ARM_DRAWING__?.();return true;}
    try{
      const fn=window.__V198_BEGIN_REGION_DRAWING__;if(typeof fn!=='function')throw new Error('自由框选启动函数未加载');
      return fn()!==false;
    }catch(err){
      console.error('[V21] 自由框选主启动通道异常，切换后备通道：',err);
      try{window.setActionStatus?.('error','框选主通道异常，已自动切换后备交互层',false);}catch(_e){}
      return window.__V2051_ARM_DRAWING__?.()!==false;
    }
  }
  window.addEventListener('click',e=>{
    const btn=e.target?.closest?.('#v15-ocr-overlay [data-v192-add-region-start]');if(!btn)return;
    e.preventDefault();e.stopImmediatePropagation();
    clearTimeout(startFallbackTimer);startFallbackTimer=0;startPress=null;
    btn.classList.remove('is-pressing');beginDrawingFromControl();
  },true);
  document.addEventListener('pointerdown',e=>{
    const btn=e.target?.closest?.('#v15-ocr-overlay [data-v192-add-region-start]');if(!btn)return;
    startPress={pointerId:e.pointerId,btn,startX:e.clientX,startY:e.clientY};btn.classList.add('is-pressing');
  },true);
  document.addEventListener('pointerup',e=>{
    const p=startPress;if(!p||p.pointerId!==e.pointerId)return;
    p.btn?.classList.remove('is-pressing');
    const moved=Math.hypot(e.clientX-p.startX,e.clientY-p.startY);startPress=null;
    clearTimeout(startFallbackTimer);
    if(moved<=18)startFallbackTimer=setTimeout(()=>{startFallbackTimer=0;beginDrawingFromControl();},0);
  },true);
  document.addEventListener('pointercancel',()=>{clearTimeout(startFallbackTimer);startFallbackTimer=0;startPress?.btn?.classList.remove('is-pressing');startPress=null;},true);
  document.addEventListener('keydown',e=>{
    const btn=e.target?.closest?.('#v15-ocr-overlay [data-v192-add-region-start]');if(!btn||!['Enter',' '].includes(e.key))return;
    e.preventDefault();e.stopImmediatePropagation();beginDrawingFromControl();
  },true);
  window.__V195_TEST__={version:'V24',isNameInput,state:()=>state(),isComposing:()=>composing};
  window.__V199_TEST__={version:'V24',state:()=>state(),begin:()=>window.__V198_BEGIN_REGION_DRAWING__?.(),drawingReady:()=>!!document.querySelector('#v15-ocr-overlay.v2051-region-drawing-active .v15-ocr-stage.adding-region[data-v199-drawing="true"]')&&!!document.getElementById('v2051-drawing-bridge'),drawingSurface:()=>document.getElementById('v2051-drawing-bridge'),drawingLock:()=>window.__V2051_DRAWING_LOCK__,hideActionPresent:()=>!!document.querySelector('#v183-region-menu-portal [data-v183-action="visible"]')};
  window.__V197_TEST__={version:'V24',revealAddRegionPanel:window.__V197_REVEAL_ADD_REGION_PANEL__};
})();


/* ===== V27.9：多 API 方案 + 智能区域双参考图 + 点击到出图性能仪表 ===== */
(function(){
  'use strict';
  if(typeof window==='undefined'||typeof document==='undefined')return;
  const VERSION='V28.1.1';
  const STORAGE_RATIO='ai_v20_recognition_generate_split';
  const API_PROFILE_KEY='ai_v202_api_profiles';
  const TYPE_META={
    text:{label:'文字区域',color:'#ef4444'},product:{label:'产品区域',color:'#f59e0b'},
    person:{label:'人物/宠物区域',color:'#22c55e'},background:{label:'背景区域',color:'#3b82f6'},
    decoration:{label:'装饰区域',color:'#8b5cf6'},unclassified:{label:'未分类区域',color:'#64748b'}
  };
  let scheduled=false,enhancing=false,drag=null,lastSignature='';
  const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`api_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
  function captureApiConfig(){
    try{return{baseUrl:API_BRIDGE.baseUrl||'',apiKey:API_BRIDGE.apiKey||'',wireModel:API_BRIDGE.wireModel||'',imageModel:API_BRIDGE.imageModel||'',copyModel:API_BRIDGE.copyModel||'',models:Array.isArray(API_BRIDGE.models)?API_BRIDGE.models.slice():[],imageModels:Array.isArray(API_BRIDGE.imageModels)?API_BRIDGE.imageModels.slice():[],textModels:Array.isArray(API_BRIDGE.textModels)?API_BRIDGE.textModels.slice():[]};}
    catch(_e){return{baseUrl:'',apiKey:'',wireModel:'',imageModel:'',copyModel:'',models:[],imageModels:[],textModels:[]};}
  }
  function normalizeProfileStore(raw){
    const profiles=Array.isArray(raw?.profiles)?raw.profiles.filter(Boolean).map((p,i)=>({id:String(p.id||uid()),name:String(p.name||`接口方案 ${i+1}`),config:Object.assign({baseUrl:'',apiKey:'',wireModel:'',imageModel:'',copyModel:'',models:[],imageModels:[],textModels:[]},p.config||{}),lastTestOk:p.lastTestOk===true?true:p.lastTestOk===false?false:null,lastTestAt:String(p.lastTestAt||''),updatedAt:String(p.updatedAt||'')})):[];
    if(!profiles.length){const p={id:uid(),name:'默认接口',config:captureApiConfig(),lastTestOk:null,lastTestAt:'',updatedAt:new Date().toLocaleString()};profiles.push(p);}
    const activeId=profiles.some(p=>p.id===raw?.activeId)?raw.activeId:profiles[0].id;
    return{version:'V24',activeId,profiles};
  }
  function loadApiProfiles(){try{return normalizeProfileStore(JSON.parse(localStorage.getItem(API_PROFILE_KEY)||'null'));}catch(_e){return normalizeProfileStore(null);}}
  let API_PROFILES=loadApiProfiles();
  function saveApiProfiles(){try{localStorage.setItem(API_PROFILE_KEY,JSON.stringify(API_PROFILES));}catch(_e){}}
  saveApiProfiles();
  function activeApiProfile(){return API_PROFILES.profiles.find(p=>p.id===API_PROFILES.activeId)||API_PROFILES.profiles[0];}
  function keyLabel(k){const v=String(k||'');return!v?'未填写':v.length>12?`${v.slice(0,5)}…${v.slice(-4)}`:'已填写';}
  function configFingerprint(cfg){return JSON.stringify([cfg?.baseUrl||'',cfg?.apiKey||'',cfg?.wireModel||'',cfg?.imageModel||'',cfg?.copyModel||'']);}
  function syncActiveProfileFromBridge(invalidate=true){const p=activeApiProfile();if(!p)return;const next=captureApiConfig(),changed=configFingerprint(next)!==configFingerprint(p.config);p.config=next;p.updatedAt=new Date().toLocaleString();if(invalidate&&changed){p.lastTestOk=null;p.lastTestAt='';}saveApiProfiles();}
  function applyApiProfile(id){
    const p=API_PROFILES.profiles.find(x=>x.id===id);if(!p)return false;const c=p.config||{};
    try{API_BRIDGE.baseUrl=c.baseUrl||'';API_BRIDGE.apiKey=c.apiKey||'';API_BRIDGE.wireModel=c.wireModel||'';API_BRIDGE.imageModel=c.imageModel||'';API_BRIDGE.copyModel=c.copyModel||'';API_BRIDGE.models=Array.isArray(c.models)?c.models.slice():[];API_BRIDGE.imageModels=Array.isArray(c.imageModels)?c.imageModels.slice():[];API_BRIDGE.textModels=Array.isArray(c.textModels)?c.textModels.slice():[];API_BRIDGE.proxyReady=false;API_BRIDGE.lastDiag=null;saveApiLocal();}
    catch(_e){return false;}
    API_PROFILES.activeId=p.id;saveApiProfiles();schedule();return true;
  }
  function createApiProfile(name){const p={id:uid(),name:String(name||`接口方案 ${API_PROFILES.profiles.length+1}`).trim()||`接口方案 ${API_PROFILES.profiles.length+1}`,config:captureApiConfig(),lastTestOk:null,lastTestAt:'',updatedAt:new Date().toLocaleString()};API_PROFILES.profiles.push(p);API_PROFILES.activeId=p.id;saveApiProfiles();schedule();return p;}
  function apiProfileOptions(){return API_PROFILES.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===API_PROFILES.activeId?'selected':''}>${esc(p.name)}</option>`).join('');}
  function microApiBridge(){return window.__V27_MICRO_API__||window.__V24_MICRO_API__||window.__V23_MICRO_API__||null;}
  function profileConnectionState(){const api=microApiBridge();if(api&&typeof api.status==='function')return api.status();return{key:'unconfigured',label:'未配置',configured:false};}
  function profileSummary(_p){const api=microApiBridge();return api&&typeof api.summary==='function'?api.summary():'https://api.evolink.ai/v1 · 密钥未填写 · Nano Banana 2 Lite';}
  function openApiProfileManager(){
    const cards=API_PROFILES.profiles.map(p=>{const st=p.lastTestOk===true?'已连接':p.lastTestOk===false?'连接失败':(p.config?.baseUrl&&p.config?.apiKey?'待测试':'未配置');return`<article class="v202-profile-card ${p.id===API_PROFILES.activeId?'active':''}"><header><div><b>${esc(p.name)}</b><small>${esc(profileSummary(p))}</small></div><span class="${p.lastTestOk===true?'ok':p.lastTestOk===false?'bad':''}">${st}</span></header><div class="v202-profile-actions"><button type="button" class="btn btn-violet" data-v202-profile-use="${esc(p.id)}" ${p.id===API_PROFILES.activeId?'disabled':''}>切换使用</button><button type="button" class="btn btn-ghost" data-v202-profile-overwrite="${esc(p.id)}">用当前配置覆盖</button><button type="button" class="btn btn-ghost" data-v202-profile-rename="${esc(p.id)}">重命名</button>${API_PROFILES.profiles.length>1?`<button type="button" class="btn btn-ghost" data-v202-profile-delete="${esc(p.id)}">删除</button>`:''}</div><small class="v202-profile-time">${p.lastTestAt?`最近测试：${esc(p.lastTestAt)}`:`最近更新：${esc(p.updatedAt||'—')}`}</small></article>`;}).join('');
    modalOpen(`<h3>API 配置方案</h3><p class="hint">保存并快速切换识别接口、局部生成接口或备用接口。每个方案独立保存 Base URL、密钥和各模块模型。</p><div class="v202-profile-toolbar"><button type="button" class="btn btn-violet" data-v202-profile-new>新建方案</button><button type="button" class="btn btn-ghost" data-adj-api-config>编辑当前方案</button><button type="button" class="btn btn-ghost" data-adj-api-test>测试当前方案</button></div><div class="v202-profile-grid">${cards}</div><div class="row" style="margin-top:14px"><button type="button" class="btn btn-ghost" data-mclose>关闭</button></div>`,true);
  }
  function installApiHooks(){
    if(window.__V202_API_HOOKS__)return;window.__V202_API_HOOKS__=true;
    try{if(typeof saveApiFromModal==='function'){const base=saveApiFromModal;saveApiFromModal=function(kind){const out=base(kind);syncActiveProfileFromBridge(true);schedule();return out;};}}catch(_e){}
    try{if(typeof runApiDiagnose==='function'){const base=runApiDiagnose;runApiDiagnose=async function(showModal){const steps=await base(showModal),ok=!!steps.length&&steps.every(x=>x.ok),p=activeApiProfile();if(p){p.config=captureApiConfig();p.lastTestOk=ok;p.lastTestAt=new Date().toLocaleString();p.updatedAt=p.lastTestAt;saveApiProfiles();}schedule();return steps;};}}catch(_e){}
    try{if(typeof loadApiModels==='function'){const base=loadApiModels;loadApiModels=async function(){const out=await base();syncActiveProfileFromBridge(false);schedule();return out;};}}catch(_e){}
  }
  installApiHooks();
  function state(){try{return typeof adjustState!=='undefined'&&adjustState&&adjustState.v15Ocr?adjustState.v15Ocr:null;}catch(_e){return null;}}
  function rows(s){return Array.isArray(s?.result?.regions)?s.result.regions:[];}
  function selectedRows(s){const set=new Set((s?.selected||[]).map(String));return rows(s).filter(r=>set.has(String(r.id)));}
  function box(r){const b=r?.targetBBox||r?.sourceBBox||r||{};return{x:Number(b.x)||0,y:Number(b.y)||0,width:Number(b.width)||0,height:Number(b.height)||0};}
  function area(b){return Math.max(0,b.width)*Math.max(0,b.height)*100;}
  function typeMeta(r){return TYPE_META[r?.type]||TYPE_META.unclassified;}
  function loadRatio(s){let v=Number(s?.v20SplitRatio);if(!Number.isFinite(v)){try{v=Number(localStorage.getItem(STORAGE_RATIO));}catch(_e){}}return Math.max(36,Math.min(74,Number.isFinite(v)?v:60));}
  function saveRatio(v){const s=state();v=Math.max(36,Math.min(74,Number(v)||60));if(s)s.v20SplitRatio=v;try{localStorage.setItem(STORAGE_RATIO,String(v));}catch(_e){}applyRatio(v);}
  function applyRatio(v){const overlay=document.getElementById('v15-ocr-overlay');if(!overlay)return;overlay.style.setProperty('--v20-left',`${Math.max(36,Math.min(74,Number(v)||60))}%`);}
  function relationTarget(issue,s){
    const all=rows(s),byId=new Map();all.forEach(r=>{byId.set(String(r.id),r);byId.set(String(r.region_id),r);});
    const code=String(issue?.code||'');let id='';
    for(const prefix of ['text_coverage_','mutual_occlusion_','overlap_'])if(code.startsWith(prefix)){id=code.slice(prefix.length);break;}
    if(!id){const msg=String(issue?.message||'');const m=msg.match(/(?:覆盖|与|跟随)\s+([^（，。\s]+)/);if(m)id=m[1];}
    return byId.get(String(id))||null;
  }
  function issueRelation(issue){const c=String(issue?.code||'');if(c.startsWith('text_coverage_'))return'覆盖文字';if(c.startsWith('mutual_occlusion_'))return'互相遮挡';if(c.startsWith('overlap_'))return'区域重叠';if(c==='out_of_bounds')return'超出画布';if(c==='too_small')return'尺寸过小';if(c==='unclassified')return'类型未确认';if(c.includes('parent'))return'父子关系';if(c.includes('follow_move'))return'位移叠加';if(c.includes('follow_scale'))return'缩放叠加';if(c==='text_readability')return'文字可读性';if(c==='floating')return'主体悬空';if(c==='large_feather')return'蒙版羽化';return'区域约束';}
  function issueSuggestion(issue){const c=String(issue?.code||''),fix=String(issue?.fix||'');if(fix==='inside'||c==='out_of_bounds')return'移回画布安全范围';if(fix==='avoid_text'||c.startsWith('text_coverage_'))return'调整位置或尺寸，避开文字框';if(c.startsWith('mutual_occlusion_')||c.startsWith('overlap_'))return'检查层级、位置和区域范围';if(fix==='text_size'||c==='text_readability')return'恢复安全文字尺寸';if(fix==='bottom_align'||c==='floating')return'启用底部对齐或下移主体';if(fix==='reset_scale'||c==='too_small')return'恢复原始尺寸';if(c.includes('parent'))return'修复父子区域双向关系';if(c.includes('follow_'))return'取消重复的独立变换或跟随';return issue?.fix?'可在冲突详情中处理':'人工检查后再确认生成';}
  function issueSeverity(issue){return issue?.severity==='block'?'阻断':issue?.severity==='warning'?'风险':'提示';}
  function boxText(r){if(!r)return'画布/全局';const b=box(r);return`X ${(b.x*100).toFixed(1)}% · Y ${(b.y*100).toFixed(1)}% · W ${(b.width*100).toFixed(1)}% · H ${(b.height*100).toFixed(1)}%`;}
  function overlapText(issue){const m=String(issue?.message||'').match(/(\d+(?:\.\d+)?)%/);return m?`${m[1]}%`:'—';}
  function v273ConflictFingerprint(s){const chosen=new Set(s?.selected||[]);return JSON.stringify(rows(s).filter(r=>chosen.has(r.id)).map(r=>[r.id,r.type,r.targetBBox||calcTarget(r),r.execution_mode||'',r.visible!==false]));}
  function v273ConflictPolicy(s){if(!s)return{ignore:false};s.v155=s.v155||{};if(typeof s.v155.v273IgnoreObstacles!=='boolean')s.v155.v273IgnoreObstacles=false;return{ignore:!!s.v155.v273IgnoreObstacles};}
  function conflictState(s){const c=s?.v155?.v177ConflictCheck||{},stale=!!(c.checkedAt&&c.generationFingerprint&&c.generationFingerprint!==v273ConflictFingerprint(s));return{status:stale?'idle':(c.status||'idle'),blocks:stale?0:(Number(c.blocks)||0),warnings:stale?0:(Number(c.warnings)||0),hints:stale?0:(Number(c.hints)||0),issues:stale?[]:(Array.isArray(c.issues)?c.issues:[]),checkedAt:stale?'':(c.checkedAt||''),stale,generationFingerprint:c.generationFingerprint||''};}
  function conflictLabel(c){if(c.status==='blocked')return`${c.blocks} 个阻断冲突`;if(c.status==='warning')return`${c.warnings} 个冲突风险`;if(c.status==='passed')return c.hints?`检查通过 · ${c.hints} 个提示`:'冲突检查通过';return'检查冲突';}
  function recognitionVisualState(s){
    const phase=String(s?.progress?.phase||'idle');
    if(s?.busy||['preparing','submitting','waiting','parsing'].includes(phase))return{key:'running',label:'正在识别图片'};
    if(phase==='failed'||(s?.error&&!s?.result))return{key:'failed',label:'识别失败'};
    if(s?.result)return{key:'done',label:'识别完成'};
    return{key:'idle',label:'未识别'};
  }
  function microAdjustOutput(){
    try{return window.__V225_GET_MICRO_ADJUST_OUTPUT__?.()||null;}catch(_e){return null;}
  }
  function recognitionSummaryData(s){
    const selected=selectedRows(s),c=conflictState(s);
    const changed=selected.filter(r=>{const a=r.sourceBBox||r,b=r.targetBBox||r;return Math.abs((a.x||0)-(b.x||0))+Math.abs((a.y||0)-(b.y||0))+Math.abs((a.width||0)-(b.width||0))+Math.abs((a.height||0)-(b.height||0))>.00001;}).length;
    return{selected,c,changed,totalArea:selected.reduce((n,r)=>n+area(box(r)),0)};
  }
  function renderRecognitionSummary(left,s){
    if(!left)return;
    const data=recognitionSummaryData(s);
    let summary=left.querySelector(':scope > .v224-recognition-summary');
    if(!summary){summary=document.createElement('footer');summary.className='v224-recognition-summary';summary.setAttribute('aria-label','识别区域编辑信息');}
    summary.innerHTML=`<div><span>已选择</span><b>${data.selected.length} 个区域</b></div><div><span>发生变换</span><b>${data.changed} 个区域</b></div><div><span>区域总占比</span><b>${data.totalArea.toFixed(1)}%</b></div><div><span>冲突状态</span><b>${esc(conflictLabel(data.c))}</b></div>`;
    const stage=left.querySelector(':scope > .v15-ocr-stage');
    if(stage)left.insertBefore(summary,stage);else left.prepend(summary);
  }
  function regressionPassed(regression){return !!regression&&regression.status!=='failed'&&regression.pass!==false;}
  function regressionDetailsHtml(regression){
    if(!regression)return'<p class="hint">当前结果没有可用的回归检测记录。</p>';
    const passed=regressionPassed(regression),metrics=regression.metrics||{},regions=Array.isArray(metrics.regions)?metrics.regions:[],notes=[...(regression.failures||[]),...(regression.warnings||[])];
    return `<div class="v273-regression-summary ${passed?'ok':'risk'}"><b>${passed?'✓ AI 修改指令回归检测通过':'⚠ AI 修改指令回归检测需复核'}</b><span>${esc(regression.message||'')}</span></div>${notes.length?`<div class="v273-regression-notes">${notes.map(x=>`<p>${esc(x)}</p>`).join('')}</div>`:''}<div class="v273-regression-metrics"><div><span>整图变化</span><b>${metrics.fullDelta==null?'—':esc(String(metrics.fullDelta))}</b></div><div><span>变化像素占比</span><b>${metrics.fullChangedRatio==null?'—':esc(String(metrics.fullChangedRatio))}</b></div></div>${regions.length?`<div class="v273-regression-regions">${regions.map(r=>`<div><b>${esc(r.name||r.regionId||'区域')}</b><span>${r.moved?'移动/缩放任务':'局部任务'} · 编辑包络变化 ${esc(String(r.insideDelta??'—'))}</span></div>`).join('')}</div>`:''}<p class="hint">回归检测只用于判断“AI 修改指令/目标几何是否可能被忽略”。检测不通过不会自动重新提交计费生图任务。</p>`;
  }
  function promoteRegionWorkbenchModal(){
    const modal=document.getElementById('modal');if(!modal)return null;
    modal.classList.add('v277-region-modal');modal.dataset.v277RegionModal='1';
    const box=modal.querySelector('.modal-box');if(box)box.setAttribute('data-v277-region-modal-box','1');
    return modal;
  }
  function openRegionWorkbenchModal(html,wide){
    if(typeof modalOpen!=='function'){if(typeof setActionStatus==='function')setActionStatus('error','弹窗模块未加载，请刷新页面后重试',false);return null;}
    modalOpen(html,wide);promoteRegionWorkbenchModal();requestAnimationFrame(promoteRegionWorkbenchModal);return document.getElementById('modal');
  }
  function openRegressionDetails(){const output=microAdjustOutput(),r=output?.regression||state()?.v155?.v273Regression?.results?.[0]||null;openRegionWorkbenchModal(`<h3>AI 修改指令回归检测 · V27.9</h3>${regressionDetailsHtml(r)}<div class="row" style="margin-top:14px"><button type="button" class="btn btn-ghost" data-mclose>关闭</button></div>`,true);}
  function microOutputDownloadName(output){
    const idx=Number(output?.candidateIndex),candidate=Number.isFinite(idx)?idx+1:1,raw=String(output?.name||`智能区域微调结果 ${candidate}`).trim();
    return raw||`智能区域微调结果 ${candidate}`;
  }
  function downloadMicroAdjustOutput(){
    const output=microAdjustOutput(),src=String(output?.src||'');
    if(!src){if(typeof setActionStatus==='function')setActionStatus('warning','暂无可下载的智能区域微调结果',false);return false;}
    const name=microOutputDownloadName(output);
    if(typeof openImageDownloadDialog==='function'){
      try{
        openImageDownloadDialog(src,name,'下载智能区域微调结果');
        promoteRegionWorkbenchModal();requestAnimationFrame(promoteRegionWorkbenchModal);
        if(typeof setActionStatus==='function')setActionStatus('success','下载窗口已打开，文件准备完成后请点击“确认下载”',false);
        return true;
      }catch(error){if(typeof setActionStatus==='function')setActionStatus('error','无法打开图片下载窗口：'+(error?.message||error),false);}
    }
    const exporter=window.ImageExport;
    if(!exporter||typeof exporter.requestDownloadTarget!=='function'||typeof exporter.exportImageToTarget!=='function'){
      if(typeof setActionStatus==='function')setActionStatus('error','图片下载模块未加载，请刷新页面后重试',false);
      return false;
    }
    let target;
    try{target=exporter.requestDownloadTarget([{src,name}],'png');}
    catch(error){if(typeof setActionStatus==='function')setActionStatus('error','无法打开图片保存入口：'+(error?.message||error),false);return false;}
    Promise.resolve(exporter.exportImageToTarget(src,name,'png',target,0)).then(()=>{if(typeof setActionStatus==='function')setActionStatus('success','智能区域微调结果已进入下载/保存流程',false);}).catch(error=>{if(exporter.isAbortError?.(error))return;if(typeof setActionStatus==='function')setActionStatus('error','图片下载失败：'+(error?.message||error),false);});
    return true;
  }
  function v274Duration(ms){
    const n=Math.max(0,Math.round(Number(ms)||0));
    if(!n)return '—';
    if(n<1000)return `${n} ms`;
    return `${(n/1000).toFixed(n<10000?1:0)} s`;
  }
  function v274PerformanceDiagnosis(perf){
    if(!perf)return'';
    const rows=[['预检',perf.preflightMs],['流程交接',perf.syncMs],['参考图处理',perf.compressMs],['参考图上传',perf.uploadMs],['任务提交',perf.submitMs],['上游排队',perf.providerQueueMs],['模型生成',perf.generationMs],['结果显示',perf.resultMs],['本地检查',perf.postCheckMs]].map(([label,value])=>({label,value:Number(value)||0})).sort((a,b)=>b.value-a.value);
    const top=rows[0]||{label:'',value:0},total=Math.max(1,Number(perf.clickToImageMs)||rows.slice(0,7).reduce((n,x)=>n+x.value,0));
    if(!top.value)return'正在采集从点击到出图的各阶段耗时。';
    if(perf.softTimeoutReached){
      const retries=Math.max(0,Number(perf.pollRetryCount)||0),stall=Math.max(0,Number(perf.networkStallMs)||0);
      return `任务已超过 180 秒软阈值，但 V27.9 正在继续查询同一 task_id，不会再次提交计费任务${retries?`；任务状态 GET 已安全重试 ${retries} 次`:''}${stall?`；网络停顿约 ${v274Duration(stall)}`:''}。`;
    }
    if(Number(perf.pollRetryCount)>0)return `检测到任务状态查询发生临时 TLS/Socket 中断，V27.9 已安全重试 GET 并继续跟踪同一 task_id；没有重复提交生图任务。`;
    const pct=Math.round(top.value/total*100);
    if(top.label==='上游排队')return`当前最大耗时是 EvoLink 上游排队（约 ${pct}%），更接近同 Key 并发或模型队列，不是本地工作台锁通道。`;
    if(top.label==='模型生成')return`当前最大耗时是模型实际生成（约 ${pct}%），本地准备与上传并非主要瓶颈。`;
    if(top.label==='参考图上传')return`当前最大耗时是双参考图上传（约 ${pct}%），建议重点检查代理、国际链路与 files-api。`;
    if(top.label==='流程交接')return`当前最大耗时是区域同步/生成流程交接（约 ${pct}%）；V27.9 会在提交 EvoLink 任务前直接校验生成器已接管，避免只显示预检后无限等待。`;
    if(top.label==='预检')return`当前最大耗时是接口预检（约 ${pct}%）；可查看是否命中 5 分钟完整诊断缓存与 60 秒 Credits 缓存。`;
    return`当前最大耗时阶段：${top.label}（约 ${pct}%）。`;
  }
  function v274PerformancePanelCollapsed(){
    try{
      const raw=window.localStorage?.getItem('v28_micro_performance_panel_collapsed');
      if(raw===null||raw==='')return true;
      return raw!=='0';
    }catch(_e){return true;}
  }
  function setV274PerformancePanelCollapsed(collapsed){
    try{window.localStorage?.setItem('v28_micro_performance_panel_collapsed',collapsed?'1':'0');}catch(_e){}
    return !!collapsed;
  }
  function v274PerformanceHtml(perf){
    if(!perf)return'';
    const metrics=[['preflightMs','预检'],['syncMs','流程交接'],['compressMs','压缩/合并'],['uploadMs','上传'],['submitMs','提交'],['providerQueueMs','上游排队'],['generationMs','模型生成'],['resultMs','结果显示'],['postCheckMs','本地检查']];
    const path=Array.isArray(perf.statusPath)?perf.statusPath:[],has=x=>path.includes(x),taskId=String(perf.taskId||'');
    const lifecycle=['pending','processing','completed'].map((status,index)=>{const done=has(status),active=done&&!has(['processing','completed'][index]||'__none__'),inferred=Array.isArray(perf.taskStates)&&perf.taskStates.some(x=>x.status===status&&x.inferred===true);const label=status==='pending'?'pending 等待':status==='processing'?'processing 生成':'completed 完成';return`<span class="${done?'done':''} ${active?'active':''} ${inferred?'inferred':''}" title="${inferred?'服务端未返回该中间状态，由客户端按时间线推断':''}">${done?'✓':'·'} ${label}${inferred?'*':''}</span>`;}).join('<i>→</i>');
    const preflight=String(perf.preflightMode||'').replace('diagnostic-cache+credit-cache','完整诊断缓存 + Credits 缓存').replace('diagnostic-cache+light-credits','完整诊断缓存 + 轻量 Credits').replace('full-diagnostic:cold-start','首次完整诊断').replace('full-diagnostic:cache-expired','缓存过期完整诊断').replace('full-diagnostic:config-changed','配置变化完整诊断');
    const phaseLabels={preflight:'预检',sync:'流程交接',compress:'参考图处理',upload:'参考图上传',submit:'任务提交',providerQueue:'上游排队',generation:'模型生成',result:'结果显示',postCheck:'本地检查'},livePhase=phaseLabels[perf.currentPhase]||'';
    const recovery=[perf.softTimeoutReached?'180 秒软阈值后继续同一 task':'',Number(perf.pollRetryCount)>0?`状态 GET 安全重试 ${Number(perf.pollRetryCount)} 次`:'',Number(perf.networkStallMs)>0?`网络停顿 ${v274Duration(perf.networkStallMs)}`:'',Number(perf.pollTimeoutBudgetMs)>0?`当前预算 ${v274Duration(perf.pollTimeoutBudgetMs)}`:'',Number(perf.pollMaxTimeoutMs)>Number(perf.pollTimeoutBudgetMs||0)?`上限 ${v274Duration(perf.pollMaxTimeoutMs)}`:''].filter(Boolean);
    const collapsed=v274PerformancePanelCollapsed();
    const stateLabel=perf.status==='complete'?'采集完成':perf.status==='failed'?'生成中断':'实时采集中';
    const compactMeta=`${stateLabel}${livePhase?' · '+esc(livePhase):''}`;
    const total=perf.clickToImageMs?v274Duration(perf.clickToImageMs):'计时中';
    return `<section class="v274-performance-panel v275-performance-panel v276-performance-panel ${collapsed?'is-collapsed':'is-expanded'}" aria-label="点击到出图性能仪表">
      <button type="button" class="v274-performance-toggle" data-v274-performance-toggle aria-expanded="${collapsed?'false':'true'}" title="${collapsed?'展开出图性能仪表':'收起出图性能仪表'}">
        <span class="v274-performance-toggle-main"><b>点击到出图性能仪表</b><small>${compactMeta}${preflight?' · '+esc(preflight):''}</small></span>
        <span class="v274-performance-toggle-total">${total}</span>
        <span class="v274-performance-toggle-arrow" aria-hidden="true">${collapsed?'⌄':'⌃'}</span>
      </button>
      <div class="v274-performance-details" ${collapsed?'hidden':''}>
        <div class="v274-performance-grid">${metrics.map(([key,label])=>`<div><span>${label}</span><b>${v274Duration(perf[key])}</b></div>`).join('')}</div>
        <div class="v274-task-path"><span class="label">EvoLink task</span>${lifecycle}${taskId?`<code title="${esc(taskId)}">${esc(taskId.slice(0,8))}…</code>`:''}</div>
        ${recovery.length?`<div class="v276-poll-recovery"><b>轮询恢复</b><span>${esc(recovery.join(' · '))}</span></div>`:''}
        <p>${esc(v274PerformanceDiagnosis(perf))}</p>
      </div>
    </section>`;
  }
  function renderGeneratePane(pane,s){
    const output=microAdjustOutput(),phase=String(output?.phase||'idle'),src=String(output?.src||''),hasOutput=phase==='ready'&&!!src,isGenerating=phase==='generating',isError=phase==='error';
    const performance=output?.performance||((hasOutput||isGenerating||isError)?(window.MicroPerformanceMeterV276||window.MicroPerformanceMeterV275||window.MicroPerformanceMeterV274)?.snapshot?.():null);
    const quality=output?.quality||{},score=output?.rankScore??quality.score,regression=output?.regression||s?.v155?.v273Regression?.results?.[0]||null,regressionOk=regressionPassed(regression),regressionLabel=regression?(regressionOk?'回归检测通过':regression.status==='warning'?'回归检测需复核':'回归检测未通过'):'',captionMeta=[output?.candidateCount?`${output.candidateCount} 个候选`:'' ,score!=null?`质量 ${score} 分`:'',regressionLabel].filter(Boolean).join(' · ');
    let body='';
    if(hasOutput){
      body=`<div class="v20-generate-image-shell v225-output-shell"><img src="${esc(src)}" alt="智能区域编辑微调生成结果" draggable="false" data-v225-preview-output><div class="v225-output-caption" aria-label="智能区域微调结果信息与操作"><div class="v232-output-info"><span>智能区域编辑生成</span><b>${esc(output?.name||'最新微调生成图')}</b><small>${esc(captionMeta||output?.generatedAt||'')}</small></div><div class="v232-output-actions">${regression?'<button type="button" class="v273-regression-detail-btn" data-v273-regression-details>查看回归检测</button>':''}<button type="button" class="v232-output-download-btn" data-v232-download-output title="下载当前智能区域微调结果">↓ 下载图片</button></div></div></div>`;
    }else if(isGenerating){
      body=`<div class="v20-generate-empty v225-output-empty generating"><i class="v225-output-spinner" aria-hidden="true"></i><b>正在微调生成</b><span>正在按“原图 + 布局/Mask 合并引导图”双路上传；下方仪表会实时区分预检、上传、上游排队与模型生成；超过 180 秒后仍继续查询同一 task_id，不会重复提交计费任务。</span></div>`;
    }else if(isError){
      body=`<div class="v20-generate-empty v225-output-empty error"><b>微调生成失败</b><span>${esc(output?.error||'生成任务未返回可用图片，请检查接口配置后重试。')}</span></div>`;
    }else{
      body=`<div class="v20-generate-empty v225-output-empty"><b>暂无微调生成结果</b><span>先在左侧选择需要微调的区域，再点击底部“微调生成”。该画布只显示智能区域编辑工作台生成的图片。</span></div>`;
    }
    const chipLabel=hasOutput?(regression&&!regressionOk?'结果需复核':'微调结果已生成'):isGenerating?'微调生成中':isError?'生成失败':'等待微调生成';
    const chipClass=hasOutput?(regression&&!regressionOk?'risk':'ok'):isGenerating?'run':isError?'bad':'wait';
    pane.innerHTML=`<header class="v20-pane-head v225-output-head"><div><b>微调生成图片</b><small>V27.9 独立微调通道 · 同一任务最长 8 分钟恢复轮询 · 代理 TLS 自动切换</small></div><span class="v225-channel-chip ${chipClass}">${chipLabel}</span></header><div class="v20-generate-stage v225-output-stage">${body}</div>${v274PerformanceHtml(performance)}`;
  }
  function installSplit(overlay,s){
    const preview=overlay.querySelector('.v15-ocr-preview'),tools=preview?.querySelector('.v193-direct-tools,.v168-direct-tools,.v154-correction-tools'),stage=preview?.querySelector(':scope > .v15-ocr-stage')||preview?.querySelector('.v15-ocr-stage');if(!preview||!stage)return;
    let split=preview.querySelector(':scope > .v20-canvas-split');
    if(!split){
      split=document.createElement('div');split.className='v20-canvas-split';
      split.innerHTML='<section class="v20-recognition-pane"></section><div class="v20-splitter" role="separator" tabindex="0" aria-label="调整识别编辑与微调生成区域宽度" aria-orientation="vertical"><i></i></div><section class="v20-generate-pane"></section>';
      const anchor=tools||stage;preview.insertBefore(split,anchor);const left=split.querySelector('.v20-recognition-pane');if(tools)left.appendChild(tools);left.appendChild(stage);
    }
    const left=split.querySelector('.v20-recognition-pane'),right=split.querySelector('.v20-generate-pane');
    const currentTools=preview.querySelector(':scope > .v193-direct-tools,:scope > .v168-direct-tools,:scope > .v154-correction-tools');if(currentTools)left.insertBefore(currentTools,left.firstChild);
    const currentStage=preview.querySelector(':scope > .v15-ocr-stage');if(currentStage)left.appendChild(currentStage);
    const transform=preview.querySelector(':scope > .v155-transform-host');if(transform)left.appendChild(transform);
    renderRecognitionSummary(left,s);renderGeneratePane(right,s);applyRatio(loadRatio(s));
  }
  function closeInterfaceMenu(root=document){
    root.querySelectorAll?.('[data-v201-interface-menu]').forEach(menu=>{menu.hidden=true;menu.closest('.v201-interface-wrap')?.classList.remove('open');});
    root.querySelectorAll?.('[data-v201-interface-toggle]').forEach(btn=>btn.setAttribute('aria-expanded','false'));
  }
  function interfaceMenuHtml(){
    const st=profileConnectionState();
    return `<div class="v201-interface-wrap v202-interface-${st.key}"><button type="button" class="v15-ocr-btn v201-interface-btn" data-v201-interface-toggle aria-expanded="false">接口 · ${esc(st.label)} <span>⌄</span></button><div class="v201-interface-menu v202-interface-menu" data-v201-interface-menu hidden><div class="v202-interface-current"><span>当前通道</span><b>微调生成接口</b><small>${esc(profileSummary())}</small></div><button type="button" data-v27-micro-api-config><b>API 配置</b><small>填写独立 Base URL、密钥与微调生图模型</small></button><button type="button" data-v27-micro-api-test><b>API 测试</b><small>打开连接测试结果并检查本地代理与外部接口</small></button></div></div>`;
  }
  function updateFooterState(actions,s){
    const c=conflictState(s),count=selectedRows(s).length,conflict=actions.querySelector('[data-v20-conflict]'),generate=actions.querySelector('[data-v20-generate]'),busy=!!s?.busy;
    if(conflict){const passed=c.status==='passed';conflict.textContent=passed?`✓ ${conflictLabel(c)}`:conflictLabel(c);conflict.classList.toggle('risk',c.status==='blocked'||c.status==='warning');conflict.classList.toggle('ok',passed);conflict.classList.toggle('v202-status-tag',passed);conflict.disabled=busy;conflict.title=passed?'检查已通过；点击查看冲突检查明细':'检查当前区域冲突';}
    if(generate){const output=microAdjustOutput(),generating=output?.phase==='generating',policy=v273ConflictPolicy(s);generate.disabled=!count||busy||generating;generate.textContent=generating?'生成中…':policy.ignore?'无视阻碍生成':'微调生成';generate.title=count?(policy.ignore?'已开启“无视阻碍”：冲突/风险检测不会参与本次微调通道':'冲突检测已与微调通道隔离；如需风险提示请单独点击“检查冲突”'):'请先在左侧选择至少一个微调区域';}const ignore=actions.querySelector('[data-v273-ignore-obstacles]');if(ignore){ignore.checked=v273ConflictPolicy(s).ignore;ignore.disabled=busy;}
    const runMain=actions.querySelector('[data-v168-run-main]'),runWrap=actions.querySelector('.v168-run-split')||runMain,fileBtn=actions.querySelector('[data-v15-file-open]');
    if(runMain)runMain.textContent=s?.result?'重新识别整图':'开始识别图片';if(runWrap)runWrap.hidden=busy;if(fileBtn){fileBtn.textContent=s?.src?'更换图片':'上传图片';fileBtn.hidden=busy;}
    const visual=recognitionVisualState(s),status=actions.querySelector('[data-v203-recognition-status]'),statusText=status?.querySelector('span');
    if(status){status.classList.remove('idle','running','done','failed');status.classList.add(visual.key);status.setAttribute('aria-label',visual.label);if(statusText)statusText.textContent=visual.label;}
    const warning=actions.querySelector('[data-v203-visual-warning]');if(warning){const diag=s?.visualApiWarning;warning.hidden=!diag;warning.textContent=diag?.code==='timeout'?'视觉补充超时':'视觉补充异常';warning.title=diag?.detail||'';}
    const message=actions.querySelector('[data-v203-recognition-message]');if(message){message.textContent=s?.message||'上传图片后开始识别';message.title=s?.visualApiWarning?.detail||s?.message||'';}
    const st=profileConnectionState(),toggle=actions.querySelector('[data-v201-interface-toggle]');if(toggle){toggle.childNodes[0].nodeValue=`接口 · ${st.label} `;const wrap=toggle.closest('.v201-interface-wrap');wrap?.classList.remove('v202-interface-unconfigured','v202-interface-connected','v202-interface-failed','v202-interface-untested');wrap?.classList.add(`v202-interface-${st.key}`);const summaryEl=wrap?.querySelector('.v202-interface-current small');if(summaryEl)summaryEl.textContent=profileSummary();}
  }
  function installFooter(overlay,s){
    const footer=overlay.querySelector('.v15-ocr-footer'),actions=footer?.querySelector('.v15-footer-actions');if(!footer||!actions)return;
    const existing=actions.querySelector('.v20-footer-grid');
    if(existing){
      actions.querySelectorAll('[data-v155-preview]').forEach(x=>x.remove());actions.querySelector('.v155-footer-tools')?.remove();
      updateFooterState(actions,s);applyRatio(loadRatio(s));return;
    }
    const file=actions.querySelector('[data-v15-file-open]'),run=actions.querySelector('.v168-run-split')||actions.querySelector('[data-v168-run-main]'),nativeApply=actions.querySelector('[data-v15-apply]'),note=footer.querySelector('.v15-footer-note');
    const grid=document.createElement('div');grid.className='v20-footer-grid';grid.innerHTML=`<section class="v20-footer-left" title="识别图片或更换当前图片"><div class="v20-footer-title v203-recognition-title"><div class="v203-title-row"><b>识别图片</b><span class="v203-recognition-status idle" data-v203-recognition-status aria-label="未识别"><i></i><span>未识别</span></span><span class="v203-visual-warning" data-v203-visual-warning hidden>视觉补充异常</span></div><small data-v203-recognition-message>${esc(s?.message||'上传图片后开始识别')}</small><span class="v202-help" title="识别图片或更换当前图片">?</span></div><div class="v20-footer-controls" data-v20-left-controls></div></section><div class="v20-footer-splitter" role="separator" tabindex="0" aria-label="调整底部功能区宽度"><i></i></div><section class="v20-footer-right" title="配置生成接口并确认当前区域微调任务"><div class="v20-footer-title"><b>微调生成图片</b><small>配置生成接口并确认当前区域微调任务</small><span class="v202-help" title="配置生成接口并确认当前区域微调任务">?</span></div><div class="v20-footer-controls" data-v20-right-controls>${interfaceMenuHtml()}<label class="v28-base-mode" title="决定本次微调使用哪一张基图"><span>本次基图</span><select data-v28-micro-base><option value="current" ${(typeof adjustState!=='undefined'&&adjustState.microBaseMode!=='original')?'selected':''}>当前结果</option><option value="original" ${(typeof adjustState!=='undefined'&&adjustState.microBaseMode==='original')?'selected':''}>识别原图</option></select></label><button type="button" class="v15-ocr-btn v20-conflict-btn" data-v20-conflict>检查冲突</button><label class="v273-ignore-obstacles" title="区域冲突/风险只做提示，不再阻断微调生图"><input type="checkbox" data-v273-ignore-obstacles><span>无视阻碍继续生成</span></label><button type="button" class="v15-ocr-btn primary v20-generate-btn" data-v20-generate>微调生成</button></div></section>`;
    actions.innerHTML='';actions.appendChild(grid);
    const left=grid.querySelector('[data-v20-left-controls]');if(run)left.appendChild(run);if(file)left.appendChild(file);
    if(nativeApply){nativeApply.classList.add('v20-native-apply');nativeApply.hidden=true;actions.appendChild(nativeApply);}
    if(note)note.hidden=true;actions.querySelectorAll('[data-v155-preview]').forEach(x=>x.remove());updateFooterState(actions,s);applyRatio(loadRatio(s));
  }
  function updateVersion(overlay){
    const title=overlay.querySelector('.v15-ocr-title b');if(title)title.textContent='智能区域编辑工作台 · V28.1.1';
    const sub=overlay.querySelector('.v15-ocr-title small');if(sub)sub.textContent='轻量毛玻璃界面 · 紧凑画布 · 自动保存与恢复';
    document.title=(window.__APP_TITLE__||'V27.9 · 图灵线框工作台');
  }
  function signature(s){const c=conflictState(s),out=microAdjustOutput(),api=microApiBridge()?.status?.()||{};return JSON.stringify({src:s?.src,active:s?.activeId,sel:s?.selected,result:rows(s).map(r=>[r.id,r.type,r.name,r.sourceBBox,r.targetBBox]),conf:[c.status,c.blocks,c.warnings,c.hints],busy:s?.busy,recognition:[s?.progress?.phase,s?.error,s?.message,s?.visualApiWarning?.code],ratio:loadRatio(s),api:[api.key,api.baseUrl,api.model,api.lastTestAt],microOutput:[out?.generationId,out?.phase,out?.src?.length,out?.updatedAt],baseMode:(typeof adjustState!=='undefined'?adjustState.microBaseMode:'current'),v273:[v273ConflictPolicy(s).ignore,s?.v155?.v273Regression?.status,s?.v155?.v273Regression?.failed]});}
  function enhance(){
    if(enhancing)return;const overlay=document.getElementById('v15-ocr-overlay'),s=state();if(!overlay||!s||!s.open)return;enhancing=true;
    try{updateVersion(overlay);overlay.querySelectorAll('[data-v155-preview]').forEach(x=>x.remove());installSplit(overlay,s);installFooter(overlay,s);lastSignature=signature(s);}finally{enhancing=false;}
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;enhance();});}
  function runNativeConflict(callback){
    const overlay=document.getElementById('v15-ocr-overlay'),btn=overlay?.querySelector('[data-v177-conflict-check]');
    if(btn){btn.click();setTimeout(()=>{document.querySelector('.v178-modal-backdrop')?.remove();callback?.(conflictState(state()));schedule();},30);return;}
    const s=state(),c=conflictState(s);callback?.(c);schedule();
  }
  function conflictTableHtml(c,s){
    const all=rows(s),byId=new Map();all.forEach(r=>{byId.set(String(r.id),r);byId.set(String(r.region_id),r);});
    if(!c.issues.length)return'<div class="v20-conflict-pass"><b>未发现冲突</b><span>当前选择的区域可以进入微调生成流程。</span></div>';
    return `<div class="v20-conflict-table-wrap"><table class="v20-conflict-table"><thead><tr><th>等级</th><th>区域 A</th><th>冲突关系</th><th>区域 B / 画布</th><th>位置与比例</th><th>处理建议</th></tr></thead><tbody>${c.issues.map(it=>{const a=byId.get(String(it.regionId))||byId.get(String(it.region_id)),b=relationTarget(it,s),sev=issueSeverity(it);return`<tr class="${esc(it.severity||'hint')}" data-v20-locate="${esc(a?.id||it.regionId||'')}"><td><span class="v20-severity">${sev}</span></td><td><b>${esc(window.__V221_REGION_NAME__?.(a)||a?.name||a?.label||typeMeta(a).label||'区域')}</b></td><td><strong>${esc(issueRelation(it))}</strong><small>${esc(it.message||'')}</small></td><td><b>${esc(b?(window.__V221_REGION_NAME__?.(b)||b.name||b.label||'区域'):'画布/全局')}</b></td><td><span>${esc(boxText(a))}</span><em>${esc(overlapText(it))}</em></td><td>${esc(issueSuggestion(it))}</td></tr>`;}).join('')}</tbody></table></div>`;
  }
  function showConflictModal(c,mode='inspect'){
    const s=state();document.querySelector('.v20-conflict-backdrop')?.remove();const blocks=c.blocks||0,warnings=c.warnings||0,hints=c.hints||0,canGenerate=selectedRows(s).length>0,isGenerate=mode==='generate';
    const wrap=document.createElement('div');wrap.className='v20-conflict-backdrop';wrap.innerHTML=`<section class="v20-conflict-modal" role="dialog" aria-modal="true"><header><div><b>区域冲突对应关系 · 独立风险检查</b><small>V27.9：本检查与微调生成通道隔离，不再自动拦截生图</small></div><button type="button" data-v20-modal-close>×</button></header><div class="v20-conflict-summary"><span class="${blocks?'block':''}"><b>${blocks}</b> 阻断</span><span class="${warnings?'warning':''}"><b>${warnings}</b> 风险</span><span><b>${hints}</b> 提示</span><em>已选 ${selectedRows(s).length} 个区域</em></div><div class="v273-conflict-isolation-note">冲突检测只用于人工检查。继续生成时，微调通道只读取已选区域、AI 修改指令、source/target 几何、Mask 与独立 /api/micro/* 通道，不会把“阻断/风险”写入生成 Prompt。</div>${conflictTableHtml(c,s)}<footer><button type="button" data-v20-modal-close>返回编辑</button>${canGenerate?`<button type="button" class="primary" data-v20-confirm-generate data-v273-force-conflict="1">${blocks||warnings?'无视阻碍继续生成':'微调生成'}</button>`:''}</footer></section>`;document.body.appendChild(wrap);
  }
  async function performGeneration(options={}){
    try{(window.__V279_COMMIT_ACTIVE_DOCUMENT_TEXT__||window.__V278_COMMIT_ACTIVE_DOCUMENT_TEXT__)?.({history:true,render:false,toast:false});}catch(_e){}
    try{(window.__V279_COMMIT_ACTIVE_REGION_TEXT__||window.__V278_COMMIT_ACTIVE_REGION_TEXT__)?.({history:true,render:false,toast:false});}catch(_e){}
    try{window.__V271_COMMIT_ACTIVE_AI_PROMPT__?.();}catch(_e){}
    const meter=window.MicroPerformanceMeterV276||window.MicroPerformanceMeterV275||window.MicroPerformanceMeterV274||null,microApi=microApiBridge();
    const s=state(),overlay=document.getElementById('v15-ocr-overlay'),native=overlay?.querySelector('[data-v15-apply]');
    if(!microApi){const error=new Error('独立微调 API 通道未加载');if(typeof setActionStatus==='function')setActionStatus('error',error.message,false);return;}
    if(!s||!native){const error=new Error('区域同步通道不可用');if(typeof setActionStatus==='function')setActionStatus('error',error.message,false);return;}
    const expected=selectedRows(s).length;
    if(!expected){const error=new Error('请先选择至少一个微调区域');if(typeof setActionStatus==='function')setActionStatus('error',error.message,false);return;}
    // V27.9 starts a fresh click session every time. The output channel keys its generating record
    // by this session id, so a second run cannot inherit the first run's stale state.
    let perfSession=null;
    try{perfSession=meter?.begin?.({source:'region-workbench-click',conflictPolicy:options.conflictPolicy||'isolated',handoffStatus:'waiting'})||null;}catch(_e){}
    window.__V225_BEGIN_MICRO_ADJUST_GENERATION__?.({regionCount:expected,imageKey:String(s.v22ImageKey||s.result?.imageKey||''),source:'region-workbench-footer-v276',sessionId:String(perfSession?.sessionId||''),performance:meter?.snapshot?.()||null});
    try{
      meter?.startPhase?.('preflight');
      if(typeof setActionStatus==='function')setActionStatus('loading','正在预检微调生成接口…',false);
      await microApi.preflight({showOnError:true});
      meter?.endPhase?.('preflight');
    }catch(err){try{meter?.fail?.(err);}catch(_e){}window.__V225_FAIL_MICRO_ADJUST_GENERATION__?.(err);if(typeof setActionStatus==='function')setActionStatus('error',err.message||'微调接口预检失败',false);schedule();return;}
    try{meter?.startPhase?.('sync');meter?.annotate?.({handoffStatus:'syncing'});}catch(_e){}
    if(s.v155)s.v155.previewReady=true;native.disabled=false;
    const previous=window.__V177_PRE_APPLY_CONFLICT_CHECK__;window.__V177_PRE_APPLY_CONFLICT_CHECK__=()=>true;
    native.click();setTimeout(()=>{window.__V177_PRE_APPLY_CONFLICT_CHECK__=previous;},0);
    /* V27.9 no longer calls the hidden [data-adj-ai-run] button. That DOM click was intercepted by
       the legacy conflict listener (or silently ignored by a sticky aiBusy), which explains the
       screenshot state: preflight had 6 ms, while compress/upload/task lifecycle never started. */
    let attempts=0;const continueGenerate=async()=>{
      attempts++;
      const synced=Array.isArray(adjustState?.detectedRegions)&&adjustState.detectedRegions.length>=expected,closed=!state()?.open;
      if(synced&&(closed||window.__V207_REGION_ROUTE__===true)){
        let generationId='';
        try{
          const ids=[...new Set((adjustState.regionAiTasks||[]).map(t=>t&&t.brushId).filter(Boolean))];
          if(!ids.length)throw new Error('当前区域缺少可执行的修改指令');
          const prompt=typeof adjustBuildAiPrompt==='function'?adjustBuildAiPrompt(ids):'',reg=window.RegionGenerationRegressionV279||window.RegionGenerationRegressionV278||window.RegionGenerationRegressionV273||window.RegionGenerationRegression,tasks=Array.isArray(adjustState.regionAiTasks)?adjustState.regionAiTasks:[],expectation=reg?reg.createExpectation(tasks,prompt,{source:'region-workbench',conflictPolicy:options.conflictPolicy||'isolated'}):null,bridgeCheck=reg?reg.verifyBridge(expectation,tasks,prompt):{ok:true,issues:[]};
          if(!bridgeCheck.ok){
            adjustState.microRegressionPreflight=bridgeCheck;
            const visible=bridgeCheck.issues.slice(0,3),remaining=Math.max(0,bridgeCheck.issues.length-visible.length);
            throw new Error('AI 修改指令回归前检失败：'+visible.join('；')+(remaining?`；另有 ${remaining} 项，请查看调试日志`:'')+'。未提交 EvoLink 计费任务');
          }
          if(typeof microApi.assertIsolation==='function')await microApi.assertIsolation();
          adjustState.microRegressionExpectation=expectation;adjustState.microConflictPolicy=options.conflictPolicy||'isolated';
          generationId=microApi.beginGeneration({instructionFingerprint:expectation?.fingerprint||'',conflictPolicy:options.conflictPolicy||'isolated',regionCount:tasks.length,performanceSessionId:String(meter?.snapshot?.()?.sessionId||'')});
          const starter=window.__V276_START_MICRO_ADJUST__||window.__V275_START_MICRO_ADJUST__;
          if(typeof starter!=='function')throw new Error('V27.9 微调流程交接器未加载；未提交计费任务');
          const launch=starter({ids,generationId,sessionId:String(meter?.snapshot?.()?.sessionId||''),options:{conflictPolicy:options.conflictPolicy||'isolated'}});
          if(!launch?.accepted||!launch?.promise)throw new Error('微调生成器未确认流程交接；未提交计费任务');
          const current=state();if(current){current.message=`微调任务 ${generationId} 已完成流程交接；正在记录参考图处理、上传、EvoLink 排队与模型生成耗时`;schedule();}
          if(typeof setActionStatus==='function')setActionStatus('loading','微调生成器已接管，正在上传参考图并等待 EvoLink 结果…',false);
          launch.promise.then(()=>{schedule();}).catch(error=>{
            const snap=meter?.snapshot?.();if(snap?.status!=='failed')try{meter?.fail?.(error);}catch(_e){}
            window.__V225_FAIL_MICRO_ADJUST_GENERATION__?.(error);
            if(typeof setActionStatus==='function')setActionStatus('error',error?.message||'微调生成失败',false);
            schedule();
          });
        }catch(error){
          const diag=microApi.diagnostics?.()||{};if(generationId&&diag.generationId===generationId)microApi.abortGeneration?.('handoff-failed');
          try{meter?.annotate?.({handoffStatus:'failed'});meter?.fail?.(error);}catch(_e){}
          window.__V225_FAIL_MICRO_ADJUST_GENERATION__?.(error);
          if(typeof adjustState!=='undefined'){adjustState.aiBusy=false;adjustState.microRunActive=false;adjustState.microRunStatus='handoff-failed';}
          if(typeof setActionStatus==='function')setActionStatus('error',error.message||'微调通道/流程交接失败',false);
          schedule();
        }
        return;
      }
      if(attempts<16)setTimeout(continueGenerate,180);
      else{
        const error=new Error('区域同步超时，未能启动微调生成；未提交 EvoLink 计费任务');
        microApi.abortGeneration?.('region-sync-timeout');try{meter?.annotate?.({handoffStatus:'failed'});meter?.fail?.(error);}catch(_e){}window.__V225_FAIL_MICRO_ADJUST_GENERATION__?.(error);
        if(typeof setActionStatus==='function')setActionStatus('error',error.message,false);schedule();
      }
    };setTimeout(continueGenerate,180);
  }
  function beginCheck(mode){const s=state();if(mode==='inspect'){runNativeConflict(c=>showConflictModal(c,'inspect'));return;}const policy=v273ConflictPolicy(s),known=conflictState(s);if(policy.ignore){performGeneration({conflictPolicy:'ignore-obstacles'});return;}if(known.checkedAt&&(known.blocks||known.warnings)){showConflictModal(known,'generate');return;}performGeneration({conflictPolicy:'isolated-no-auto-conflict-check'});}
  function startResize(e,node){const overlay=document.getElementById('v15-ocr-overlay'),preview=overlay?.querySelector('.v15-ocr-preview');if(!preview)return;const rect=preview.getBoundingClientRect();drag={pointerId:e.pointerId,rect,node};node.classList.add('dragging');try{node.setPointerCapture?.(e.pointerId);}catch(_e){}e.preventDefault();}
  document.addEventListener('pointerdown',e=>{const node=e.target?.closest?.('#v15-ocr-overlay .v20-splitter,#v15-ocr-overlay .v20-footer-splitter');if(node)startResize(e,node);},true);
  document.addEventListener('pointermove',e=>{if(!drag||drag.pointerId!==e.pointerId)return;const v=(e.clientX-drag.rect.left)/Math.max(1,drag.rect.width)*100;saveRatio(v);e.preventDefault();},true);
  document.addEventListener('pointerup',e=>{if(!drag||drag.pointerId!==e.pointerId)return;drag.node?.classList.remove('dragging');drag=null;e.preventDefault();},true);
  document.addEventListener('pointercancel',()=>{drag?.node?.classList.remove('dragging');drag=null;},true);
  document.addEventListener('dblclick',e=>{if(e.target?.closest?.('#v15-ocr-overlay .v20-splitter,#v15-ocr-overlay .v20-footer-splitter'))saveRatio(60);},true);
  document.addEventListener('keydown',e=>{const node=e.target?.closest?.('#v15-ocr-overlay .v20-splitter,#v15-ocr-overlay .v20-footer-splitter');if(!node)return;if(e.key==='ArrowLeft'||e.key==='ArrowRight'){saveRatio(loadRatio(state())+(e.key==='ArrowLeft'?-2:2));e.preventDefault();}else if(e.key==='Home'){saveRatio(60);e.preventDefault();}},true);
  window.__V277_OPEN_REGRESSION_DETAILS__=openRegressionDetails;
  window.__V277_DOWNLOAD_MICRO_OUTPUT__=downloadMicroAdjustOutput;
  window.__V277_PROMOTE_REGION_MODAL__=promoteRegionWorkbenchModal;
  document.addEventListener('click',e=>{
    const outputDownload=e.target?.closest?.('[data-v232-download-output]');if(outputDownload){e.preventDefault();e.stopImmediatePropagation();downloadMicroAdjustOutput();return;}
    const performanceToggle=e.target?.closest?.('[data-v274-performance-toggle]');if(performanceToggle){e.preventDefault();e.stopImmediatePropagation();const panel=performanceToggle.closest('.v274-performance-panel');const collapsed=panel?.classList.contains('is-collapsed');setV274PerformancePanelCollapsed(!collapsed);const nextCollapsed=!collapsed;if(panel){panel.classList.toggle('is-collapsed',nextCollapsed);panel.classList.toggle('is-expanded',!nextCollapsed);performanceToggle.setAttribute('aria-expanded',String(!nextCollapsed));performanceToggle.setAttribute('title',nextCollapsed?'展开出图性能仪表':'收起出图性能仪表');const details=panel.querySelector('.v274-performance-details');if(details)details.hidden=nextCollapsed;const arrow=panel.querySelector('.v274-performance-toggle-arrow');if(arrow)arrow.textContent=nextCollapsed?'⌄':'⌃';}return;}
    const regressionDetails=e.target?.closest?.('[data-v273-regression-details]');if(regressionDetails){e.preventDefault();e.stopImmediatePropagation();openRegressionDetails();return;}
    const profileManager=e.target?.closest?.('[data-v202-profile-manager]');if(profileManager){e.preventDefault();e.stopImmediatePropagation();closeInterfaceMenu(document);openApiProfileManager();return;}
    const profileNew=e.target?.closest?.('[data-v202-profile-new]');if(profileNew){e.preventDefault();const create=name=>{createApiProfile(name);openApiProfileManager();};if(typeof inputDialog==='function')inputDialog('新建 API 配置方案','备用接口',create);else create(prompt('方案名称','备用接口'));return;}
    const profileUse=e.target?.closest?.('[data-v202-profile-use]');if(profileUse){e.preventDefault();if(applyApiProfile(profileUse.dataset.v202ProfileUse)){openApiProfileManager();if(typeof setActionStatus==='function')setActionStatus('success','接口配置方案已切换',false);}return;}
    const profileOverwrite=e.target?.closest?.('[data-v202-profile-overwrite]');if(profileOverwrite){e.preventDefault();const p=API_PROFILES.profiles.find(x=>x.id===profileOverwrite.dataset.v202ProfileOverwrite);if(p){p.config=captureApiConfig();p.lastTestOk=null;p.lastTestAt='';p.updatedAt=new Date().toLocaleString();saveApiProfiles();openApiProfileManager();}return;}
    const profileRename=e.target?.closest?.('[data-v202-profile-rename]');if(profileRename){e.preventDefault();const p=API_PROFILES.profiles.find(x=>x.id===profileRename.dataset.v202ProfileRename);if(p){const done=name=>{p.name=String(name||p.name).trim()||p.name;saveApiProfiles();openApiProfileManager();schedule();};if(typeof inputDialog==='function')inputDialog('重命名 API 配置方案',p.name,done);else done(prompt('方案名称',p.name));}return;}
    const profileDelete=e.target?.closest?.('[data-v202-profile-delete]');if(profileDelete){e.preventDefault();const id=profileDelete.dataset.v202ProfileDelete,remove=()=>{const idx=API_PROFILES.profiles.findIndex(x=>x.id===id);if(idx<0||API_PROFILES.profiles.length<=1)return;API_PROFILES.profiles.splice(idx,1);if(API_PROFILES.activeId===id){API_PROFILES.activeId=API_PROFILES.profiles[0].id;applyApiProfile(API_PROFILES.activeId);}saveApiProfiles();openApiProfileManager();schedule();};if(typeof confirmDialog==='function')confirmDialog('删除该 API 配置方案？',remove);else if(confirm('删除该 API 配置方案？'))remove();return;}
    const interfaceToggle=e.target?.closest?.('[data-v201-interface-toggle]');if(interfaceToggle){e.preventDefault();e.stopImmediatePropagation();const wrap=interfaceToggle.closest('.v201-interface-wrap'),menu=wrap?.querySelector('[data-v201-interface-menu]'),opening=!!menu?.hidden;closeInterfaceMenu(document);if(menu&&opening){menu.hidden=false;wrap.classList.add('open');interfaceToggle.setAttribute('aria-expanded','true');}return;}
    const interfaceAction=e.target?.closest?.('[data-v201-interface-menu] [data-v27-micro-api-config],[data-v201-interface-menu] [data-v27-micro-api-test]');if(interfaceAction){closeInterfaceMenu(document);}
    else if(!e.target?.closest?.('.v201-interface-wrap'))closeInterfaceMenu(document);
    const previewOutput=e.target?.closest?.('[data-v225-preview-output]');if(previewOutput){e.preventDefault();const out=microAdjustOutput();if(out?.src&&typeof openImgPreview==='function')openImgPreview(out.src,'智能区域微调生成结果预览');return;}
    const conflict=e.target?.closest?.('[data-v20-conflict]');if(conflict){e.preventDefault();e.stopImmediatePropagation();beginCheck('inspect');return;}
    const generate=e.target?.closest?.('[data-v20-generate]');if(generate){e.preventDefault();e.stopImmediatePropagation();beginCheck('generate');return;}
    if(e.target?.closest?.('[data-v20-modal-close]')){e.preventDefault();document.querySelector('.v20-conflict-backdrop')?.remove();return;}
    const locate=e.target?.closest?.('[data-v20-locate]');if(locate){e.preventDefault();const id=locate.dataset.v20Locate;document.querySelector('.v20-conflict-backdrop')?.remove();window.__V175_SELECT_AND_LOCATE_REGION?.(id);return;}
    if(e.target?.closest?.('[data-v20-confirm-generate]')){e.preventDefault();document.querySelector('.v20-conflict-backdrop')?.remove();performGeneration({conflictPolicy:'ignore-known-conflicts-once'});return;}
  },true);
  document.addEventListener('change',e=>{const base=e.target?.closest?.('[data-v28-micro-base]');if(base){try{if(typeof adjustState!=='undefined'){adjustState.microBaseMode=base.value==='original'?'original':'current';if(typeof setActionStatus==='function')setActionStatus('success',adjustState.microBaseMode==='original'?'本次微调将从识别原图开始，不继承上一轮结果':'本次微调将在当前结果上继续，保留上一轮已确认修改',false);}}catch(_e){}schedule();return;}const ignore=e.target?.closest?.('[data-v273-ignore-obstacles]');if(ignore){const s=state();if(s){s.v155=s.v155||{};s.v155.v273IgnoreObstacles=!!ignore.checked;schedule();if(typeof setActionStatus==='function')setActionStatus('success',ignore.checked?'已开启：冲突/风险仅提示，本次及后续微调可无视阻碍继续生成':'已关闭无视阻碍；冲突检查仍与微调通道隔离，仅在手动检查后提示',false);}return;}const select=e.target?.closest?.('[data-v202-profile-select]');if(!select)return;e.preventDefault();if(applyApiProfile(select.value)){closeInterfaceMenu(document);if(typeof setActionStatus==='function')setActionStatus('success',`已切换接口方案：${activeApiProfile()?.name||''}`,false);}},true);
  window.addEventListener('v225-micro-adjust-output',()=>schedule());window.addEventListener('v225-micro-adjust-output-cleared',()=>schedule());window.addEventListener('v276-micro-performance',()=>schedule());window.addEventListener('v27-micro-api-change',()=>schedule());window.addEventListener('v24-micro-api-change',()=>schedule());window.addEventListener('v273-region-regression',e=>{const s=state();if(!s)return;s.v155=s.v155||{};s.v155.v273Regression=e.detail||null;if(e.detail?.failed){s.message=`AI 修改指令回归检测：${e.detail.failed}/${e.detail.total} 个结果疑似未落实目标位置/尺寸，请人工核对`;if(typeof setActionStatus==='function')setActionStatus('warning',s.message,false);}else{s.message='AI 修改指令回归检测通过：生成结果已产生目标区域变化';}schedule();});
  const observer=new MutationObserver(()=>{const s=state();if(!s?.open)return;const sig=signature(s);if(sig!==lastSignature||!document.querySelector('#v15-ocr-overlay .v20-canvas-split'))schedule();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.__V203_TEST__={version:'V28.1.1',state,enhance,conflictState,showConflictModal,performGeneration,saveRatio,selectedRows,closeInterfaceMenu,activeApiProfile,applyApiProfile,profileConnectionState,openApiProfileManager,createApiProfile,syncActiveProfileFromBridge,interfaceMenuHtml,updateFooterState,recognitionVisualState,microAdjustOutput,microOutputDownloadName,downloadMicroAdjustOutput};
  schedule();
})();
