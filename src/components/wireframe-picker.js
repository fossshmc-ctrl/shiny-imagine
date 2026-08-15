/* —— 线框图选择器 —— */
let wireframeAssetCheckPromise=null;
function wireframeDisplaySrc(src){return typeof canonicalWireframeSrc==='function'?canonicalWireframeSrc(src):String(src||'');}
function bindPickerUpload(){const fi=$('upinput');if(fi){fi.onchange=null;fi.addEventListener('change',onUpImg,{once:true});}}
function verifyWireframeAssetServer(){
  if(wireframeAssetCheckPromise)return wireframeAssetCheckPromise;
  wireframeAssetCheckPromise=fetch('/api/wireframe-assets/status?ts='+Date.now(),{cache:'no-store'}).then(async res=>{
    let data={};try{data=await res.json();}catch(_e){}
    if(!res.ok||data.assetsReady===false){const missing=(data.missing||[]).join('、')||('HTTP '+res.status);setActionStatus('error','内置线框素材未就绪：'+missing+'。请关闭旧版本服务后重新运行 start.bat。',false);}
    return data;
  }).catch(err=>{setActionStatus('error','无法检查内置线框素材：'+err.message+'。请重新运行 start.bat。',false);return{ok:false,error:err.message};});
  return wireframeAssetCheckPromise;
}
function openPicker(i){pickerGroup=i;modalOpen(pickerHtml(),true);bindPickerUpload();bindPickerImageRecovery();verifyWireframeAssetServer();}
function updatePickerSelectionUi(imgId){
  const box=document.querySelector('#modal .modal-box');if(!box)return;
  box.querySelectorAll('.wfimg').forEach(el=>{const on=el.dataset.img===imgId;el.classList.toggle('sel',on);let badge=el.querySelector('.badge');if(on&&!badge){badge=document.createElement('span');badge.className='badge';badge.textContent='已选中';el.appendChild(badge);}else if(!on&&badge)badge.remove();});
}
function curImgs(){const c=lib.find(x=>x.id===activeCat);return c?c.imgs:[];}
function pickerAttr(s){return esc(String(s==null?'':s)).replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function pickerCategoryHtml(){
  return lib.map(c=>`<div class="catitem ${c.id===activeCat?'on':''}" data-cat="${pickerAttr(c.id)}"><span class="nm">${esc(c.name)}</span><span class="act" aria-label="品类操作"><button type="button" data-renamecat="${pickerAttr(c.id)}" title="重命名品类" aria-label="重命名 ${pickerAttr(c.name)}">✎</button><button type="button" data-delcat="${pickerAttr(c.id)}" title="删除品类" aria-label="删除 ${pickerAttr(c.name)}">🗑</button></span></div>`).join('')+'<button class="addcat" data-addcat>+ 添加品类</button>';
}
function pickerThumbHtml(im){
  const src=wireframeDisplaySrc(im.src);
  return `<div class="wf-thumb loading"><span class="wf-thumb-loading">素材加载中…</span><img data-wireframe-thumb="1" data-original-src="${pickerAttr(src)}" src="${pickerAttr(src)}" alt="${pickerAttr(im.name||'线框图')}" loading="eager" decoding="async"><button type="button" class="wf-thumb-error" data-retry-wireframe-image>素材读取失败<br><small>点击重试</small></button></div>`;
}
function pickerImageWrapHtml(){
  const sel=pickerGroup!=null&&wf.groups[pickerGroup].frame?wf.groups[pickerGroup].frame.id:null;
  const imgs=curImgs().map(im=>`<div class="wfimg ${im.id===sel?'sel':''}" draggable="true" data-img="${pickerAttr(im.id)}"> <span class="delimg" data-delimg="${pickerAttr(im.id)}" title="删除">×</span>${pickerThumbHtml(im)}<div class="nm">${esc(im.name)}</div>${im.id===sel?'<span class="badge">已选中</span>':''}</div>`).join('');
  const cname=(lib.find(x=>x.id===activeCat)||{}).name||'';
  return `<div class="sortbar"><span class="hint">${esc(cname)} · ${curImgs().length} 张</span><button class="btn btn-ghost" data-sorttime style="padding:6px 12px">按上传时间排序</button><span class="hint">悬停放大 · 可拖拽排序</span></div><div class="imggrid" id="imggrid">${imgs}<div class="uptile" data-upimg>＋ 上传线框图</div></div>`;
}
function pickerHtml(){
  return `<h3>选择线框图</h3>
  <div class="picker">
    <div class="catlist">${pickerCategoryHtml()}</div>
    <div class="imgwrap">${pickerImageWrapHtml()}</div>
  </div>
  <div class="row" style="margin-top:14px;"><button class="btn btn-violet" data-mclose>完成</button></div>
  <input type="file" id="upinput" accept="image/*" style="display:none">`;
}
function setPickerThumbState(img,state){const thumb=img&&img.closest('.wf-thumb');if(!thumb)return;thumb.classList.remove('loading','loaded','error');thumb.classList.add(state);}
function retryPickerImage(img,manual){
  if(!img)return;
  const original=img.dataset.originalSrc||wireframeDisplaySrc(img.getAttribute('src'));
  img.dataset.retryCount=manual?'0':String(Number(img.dataset.retryCount||0)+1);
  setPickerThumbState(img,'loading');
  const token=(manual?'manual-':'auto-')+Date.now();
  img.src=(typeof AssetUrl!=='undefined'&&AssetUrl.appendRetryToken)?AssetUrl.appendRetryToken(original,token):original;
}
function bindPickerImageRecovery(root){
  (root||document).querySelectorAll('img[data-wireframe-thumb]').forEach(img=>{
    if(img.dataset.recoveryBound==='1')return;img.dataset.recoveryBound='1';
    img.addEventListener('load',()=>{img.dataset.retryCount='0';setPickerThumbState(img,'loaded');});
    img.addEventListener('error',()=>{const retries=Number(img.dataset.retryCount||0);if(retries<1){retryPickerImage(img,false);return;}setPickerThumbState(img,'error');});
    if(img.complete){if(img.naturalWidth>0)setPickerThumbState(img,'loaded');else retryPickerImage(img,false);}
  });
  (root||document).querySelectorAll('[data-retry-wireframe-image]').forEach(btn=>{
    if(btn.dataset.retryBound==='1')return;btn.dataset.retryBound='1';
    btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();const img=btn.closest('.wf-thumb')?.querySelector('img[data-wireframe-thumb]');retryPickerImage(img,true);wireframeAssetCheckPromise=null;verifyWireframeAssetServer();});
  });
}
function refreshPicker(options){
  if(pickerGroup==null)return;
  options=options||{};
  const modal=$('modal'),box=modal&&modal.querySelector('.modal-box'),picker=box&&box.querySelector('.picker');
  if(!box||!picker){openPicker(pickerGroup);return;}
  const wrap=picker.querySelector('.imgwrap'),cat=picker.querySelector('.catlist');
  const wrapScroll=wrap?wrap.scrollTop:0,catScroll=cat?cat.scrollTop:0;
  if(cat&&options.imagesOnly!==true)cat.innerHTML=pickerCategoryHtml();
  if(wrap)wrap.innerHTML=pickerImageWrapHtml();
  if(wrap)wrap.scrollTop=wrapScroll;if(cat)cat.scrollTop=catScroll;
  bindPickerUpload();bindPickerImageRecovery(box);
}
function onUpImg(e){
  const input=e.target;
  const f=input.files&&input.files[0];
  if(!f)return;
  const c=lib.find(x=>x.id===activeCat);
  if(!c)return;
  withAction('wf-upload-'+activeCat,'正在上传线框图…','线框图已上传至「'+c.name+'」','线框图上传失败',()=>new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>{c.imgs.push({id:uid(),name:f.name,time:Date.now(),src:r.result,builtin:false});if(!saveLib())throw new Error('本地保存失败');input.value='';refreshPicker();resolve();};
    r.onerror=()=>reject(new Error('文件读取失败'));
    r.readAsDataURL(f);
  }));
}

/* 弹窗 */
const MODAL_STACK=[];
function modalTitleFromHtml(html){const m=String(html||'').match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);return m?m[1].replace(/<[^>]+>/g,'').trim():'';}
function modalRender(html,wide){let m=$('modal');if(!m){m=document.createElement('div');m.id='modal';document.body.appendChild(m);}const nav=MODAL_STACK.length?`<div class="modal-nav"><button type="button" class="modal-back-btn" data-modal-back>← 返回上一级</button><span class="modal-level">第 ${MODAL_STACK.length+1} 层</span></div>`:'';m.className='open';m.dataset.modalTitle=modalTitleFromHtml(html);m.dataset.modalWide=wide?'1':'0';m.innerHTML=`<div class="modal-back" data-mclose></div><div class="modal-box${wide?' wide':''}">${nav}${html}</div>`;}
function modalRefresh(html,wide){const m=$('modal'),oldBox=m&&m.querySelector('.modal-box'),scrollTop=oldBox?oldBox.scrollTop:0;modalRender(html,wide==null?(m&&m.dataset.modalWide==='1'):!!wide);requestAnimationFrame(()=>{const box=document.querySelector('#modal .modal-box');if(box)box.scrollTop=scrollTop;});}
function modalOpen(html,wide,opts){opts=opts||{};let m=$('modal');const isOpen=!!(m&&m.classList.contains('open'));const currentBox=isOpen&&m.querySelector('.modal-box');const currentTitle=isOpen?(m.dataset.modalTitle||''):'';const nextTitle=modalTitleFromHtml(html);const samePage=!!(currentTitle&&nextTitle&&currentTitle===nextTitle);if(isOpen&&!opts.replace&&!samePage&&currentBox){MODAL_STACK.push({html:currentBox.innerHTML.replace(/^<div class="modal-nav">[\s\S]*?<\/div>/,''),wide:m.dataset.modalWide==='1',scrollTop:currentBox.scrollTop,title:currentTitle});}modalRender(html,wide);}
function modalBack(){const prev=MODAL_STACK.pop();if(!prev){modalClose();return;}modalRender(prev.html,prev.wide);requestAnimationFrame(()=>{const box=document.querySelector('#modal .modal-box');if(box)box.scrollTop=prev.scrollTop||0;});}
function modalClose(){const m=$('modal');if(m){m.className='';m.innerHTML='';delete m.dataset.modalTitle;delete m.dataset.modalWide;}MODAL_STACK.length=0;pickerGroup=null;}
/* 应用内弹窗（替代被沙箱禁用的 prompt/confirm） */
function dlgOpen(html,opts){opts=opts||{};let m=$('dlg');if(!m){m=document.createElement('div');m.id='dlg';document.body.appendChild(m);}m.className='open'+(opts.preserveParent?' preserve-parent':'');m.innerHTML=`<div class="modal-back" data-dclose></div><div class="modal-box">${html}</div>`;return m;}
function dlgClose(){const m=$('dlg');if(m){m.className='';m.innerHTML='';}}
function inputDialog(title,val,cb,opts){dlgOpen(`<h3>${esc(title)}</h3><input type="text" id="dlg-in" value="${esc(val||'')}"><div class="row" style="margin-top:16px;"><button class="btn btn-violet" id="dlg-ok">确定</button><button class="btn btn-ghost" data-dclose>取消</button></div>`,opts);const inp=$('dlg-in');inp.focus();inp.select();$('dlg-ok').onclick=()=>{const v=inp.value.trim();dlgClose();if(v)cb(v);};inp.onkeydown=e=>{if(e.key==='Enter')$('dlg-ok').click();else if(e.key==='Escape')dlgClose();};}
function confirmDialog(msg,cb,opts){dlgOpen(`<h3>确认</h3><p style="margin:0 0 4px;">${esc(msg)}</p><div class="row" style="margin-top:16px;"><button class="btn btn-violet" id="dlg-ok">确定</button><button class="btn btn-ghost" data-dclose>取消</button></div>`,opts);$('dlg-ok').onclick=()=>{dlgClose();cb();};}
function openCfg(){modalOpen(`<h3>AI 接入配置</h3>
  <p class="hint">填好接口地址与密钥即可，<b>模型名称将自动配置</b>，无需手动填写。</p>
  <label class="fl">接口地址</label><input type="text" id="cfg-url" placeholder="https://…/v1" value="${esc(wf.baseUrl)}">
  <label class="fl">API 密钥</label><input type="text" id="cfg-key" placeholder="sk-…" value="${esc(wf.key)}">
  <div class="row" style="margin-top:18px;"><button class="btn btn-violet" data-cfg-save>保存并自动配置</button><button class="btn btn-ghost" data-mclose>取消</button></div>`);}
function currentPromptTargetIds(){
  const valid=wf.groups.map(g=>g.id);
  if(wf.promptTargetGroupIds===null)return valid;
  const set=new Set(Array.isArray(wf.promptTargetGroupIds)?wf.promptTargetGroupIds:[]);
  return valid.filter(id=>set.has(id));
}
function ensurePromptActiveGroup(preferred){
  const valid=wf.groups.map(g=>g.id);let id=preferred||wf.promptActiveGroupId;
  if(!valid.includes(id)){const chosen=currentPromptTargetIds();id=chosen[0]||valid[0]||null;}
  wf.promptActiveGroupId=id;return id;
}
function isPromptLinkedForGroup(g){
  if(COPY_API_CHANNEL.promptLinkEnabled===false||!g)return false;
  return wf.promptTargetGroupIds===null||currentPromptTargetIds().includes(g.id);
}
function setPromptGroupSelected(id,on){
  let ids=wf.promptTargetGroupIds===null?wf.groups.map(g=>g.id):currentPromptTargetIds();
  const set=new Set(ids);if(on)set.add(id);else set.delete(id);wf.promptTargetGroupIds=[...set];
}
function promptRulesHtml(){return `<ol class="prompt-rules">${WF_PRECISE_REPLACEMENT_RULES.map((x,i)=>`<li><b>规则 ${i+1}</b>：${esc(x)}</li>`).join('')}</ol>`;}
function promptGroupChipsHtml(){
  if(!wf.groups.length)return '<div class="prompt-group-empty">当前没有 AI 线框任务组。先从文案生成选择版本并进入 AI 线框生成。</div>';
  const chosen=new Set(currentPromptTargetIds()),active=ensurePromptActiveGroup();
  return `<div class="prompt-group-modules" role="list" aria-label="应用任务组横向列表">${wf.groups.map((g,i)=>{const on=chosen.has(g.id),cur=active===g.id,src=groupSourceInfo(g),version=src.bound?src.c.version:(i+1),style=src.bound?src.c.style:(g.label||('第 '+(i+1)+' 组'));return `<div class="prompt-group-module ${on?'selected':''} ${cur?'active':''}" role="listitem"><button type="button" class="prompt-group-main" data-prompt-group-activate="${g.id}" aria-current="${cur?'true':'false'}"><span class="prompt-group-topline"><span class="prompt-group-version">版本 ${esc(String(version))}</span>${cur?'<span class="prompt-current-badge">当前</span>':''}</span><b>${esc(style)}</b><small>${src.bound?'固定来源版本 '+esc(String(src.c.version)):'未绑定来源版本'} · ${cur?'正在查看':'点击切换'}</small>${wf.advancedDebug?taskJsonStatusHtml(g,i,true):''}</button><button type="button" class="prompt-group-apply ${on?'on':''}" data-prompt-group-toggle="${g.id}" aria-pressed="${on?'true':'false'}"><span aria-hidden="true"></span>${on?'已联通':'未联通'}</button></div>`;}).join('')}</div>`;
}
function promptGroupPreviewOptions(preferred){
  const use=ensurePromptActiveGroup(preferred);return {id:use,html:wf.groups.map((g,i)=>`<option value="${g.id}" ${g.id===use?'selected':''}>${esc(g.label||('第 '+(i+1)+' 组'))}${currentPromptTargetIds().includes(g.id)?' · 已联通':' · 未联通'}</option>`).join('')};
}
function taskJsonStableValue(v){if(Array.isArray(v))return v.map(taskJsonStableValue);if(v&&typeof v==='object'){const o={};Object.keys(v).sort().forEach(k=>{o[k]=taskJsonStableValue(v[k]);});return o;}return v;}
function taskJsonStableString(v){return JSON.stringify(taskJsonStableValue(v));}
function taskJsonComparable(payload){const p=cloneObj(payload||{});if(p.task){delete p.task.groupId;delete p.task.groupLabel;}return p;}
function taskJsonHash(payload){const s=taskJsonStableString(taskJsonComparable(payload));let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
function parseTaskJsonText(a){try{return a&&a.jsonText&&a.jsonText.trim()?JSON.parse(a.jsonText):null;}catch(_e){return null;}}
function defaultTaskQualityConstraints(){return{preserveLayout:true,preserveColors:true,preserveShapes:true,replaceTextOnly:true,doNotRenderPromptOrJson:true,doNotAddExtraCopy:true,naturalWrapWithinOriginalBoxes:true};}
function taskGroupJsonPayload(g,i){
  const source=groupSourceInfo(g),fields=structuredPosterJson(g.poster||''),a=ensureWireJsonState(g),over=a.ruleOverrides||{};
  return {schemaVersion:'13.3',purpose:'precise_wireframe_text_replacement',task:{groupId:g.id,groupLabel:g.label||('第 '+(i+1)+' 组'),sourceVersion:source.bound?source.label:'未绑定'},linked:isPromptLinkedForGroup(g),referenceImage:g.frame?{name:g.frame.name||'已选择线框图'}:null,posterFields:fields,replacementRules:Array.isArray(over.replacementRules)?cloneObj(over.replacementRules):cloneObj(WF_PRECISE_REPLACEMENT_RULES),qualityConstraints:over.qualityConstraints?cloneObj(over.qualityConstraints):defaultTaskQualityConstraints()};
}
function normalizeTaskSnapshotPayload(payload,g,i){const p=cloneObj(payload||{});p.schemaVersion='13.3';p.purpose='precise_wireframe_text_replacement';p.task=Object.assign({},p.task||{},{groupId:g.id,groupLabel:g.label||('第 '+(i+1)+' 组'),sourceVersion:groupSourceInfo(g).bound?groupSourceInfo(g).label:'未绑定'});if(!p.posterFields)p.posterFields=structuredPosterJson(g.poster||'');if(!Array.isArray(p.replacementRules))p.replacementRules=cloneObj(WF_PRECISE_REPLACEMENT_RULES);if(!p.qualityConstraints)p.qualityConstraints=defaultTaskQualityConstraints();return p;}
function recordTaskJsonSync(g,payload,origin){const a=ensureWireJsonState(g),time=nowStr(),normalized=cloneObj(payload),hash=taskJsonHash(normalized),seq=(a.syncHistory||[]).reduce((m,x)=>Math.max(m,Number(x.seq)||0),0)+1;const rec={id:uid(),seq,time,origin:origin||'任务组 JSON 同步',hash,payload:normalized};a.syncHistory.unshift(rec);if(a.syncHistory.length>20)a.syncHistory.length=20;a.lastSyncAt=time;a.lastSyncHash=hash;a.lastSyncPayload=cloneObj(normalized);a.manualEditedAt='';persistTaskJsonHistory(g);return rec;}
function syncTaskGroupJson(g,i,origin,options={}){
  if(!g)return null;const a=ensureWireJsonState(g);let payload=options.payload?normalizeTaskSnapshotPayload(options.payload,g,i):taskGroupJsonPayload(g,i);
  if(options.restore){a.ruleOverrides={replacementRules:cloneObj(payload.replacementRules||WF_PRECISE_REPLACEMENT_RULES),qualityConstraints:cloneObj(payload.qualityConstraints||defaultTaskQualityConstraints())};payload=normalizeTaskSnapshotPayload(payload,g,i);}
  a.jsonText=JSON.stringify(payload,null,2);a.updatedAt=nowStr();a.origin=origin||'V14 当前任务组精准替换 JSON';a.source=g.frame?{src:g.frame.src||'',name:g.frame.name||'排版参考图'}:a.source;recordTaskJsonSync(g,payload,a.origin);return payload;
}
function taskJsonSyncMeta(g,i){const a=ensureWireJsonState(g),desired=taskGroupJsonPayload(g,i),latest=(a.syncHistory&&a.syncHistory[0])||(a.lastSyncPayload?{payload:a.lastSyncPayload,hash:a.lastSyncHash,time:a.lastSyncAt}:null),actual=parseTaskJsonText(a);if(!latest||!latest.payload)return{id:'needs',label:'需要重新同步',cls:'needs',time:'尚未同步',reason:'当前任务组还没有建立可追溯的同步版本'};const latestPayload=normalizeTaskSnapshotPayload(latest.payload,g,i),latestHash=latest.hash||taskJsonHash(latestPayload),desiredHash=taskJsonHash(desired),actualHash=actual?taskJsonHash(actual):'';if(desiredHash===latestHash&&actualHash===latestHash)return{id:'synced',label:'已同步',cls:'synced',time:latest.time||a.lastSyncAt||'已同步',reason:'当前文案、规则和任务 JSON 完全一致'};const desiredOther=cloneObj(desired),latestOther=cloneObj(latestPayload);delete desiredOther.posterFields;delete latestOther.posterFields;const onlyPosterChanged=taskJsonStableString(desiredOther)===taskJsonStableString(latestOther)&&taskJsonStableString(desired.posterFields)!==taskJsonStableString(latestPayload.posterFields)&&actualHash===latestHash;if(onlyPosterChanged)return{id:'changed',label:'文案已变化',cls:'changed',time:latest.time||a.lastSyncAt||'上次同步未知',reason:'当前文案与上一次同步版本不同，需要确认差异后重新同步'};return{id:'needs',label:'需要重新同步',cls:'needs',time:latest.time||a.lastSyncAt||'上次同步未知',reason:actual?'当前 JSON、规则、素材或联通状态与上次同步版本不一致':'当前 JSON 为空或格式无效'};}
function taskJsonStatusHtml(g,i,compact=false){const s=taskJsonSyncMeta(g,i),a=ensureWireJsonState(g),count=(a.syncHistory||[]).length;if(compact)return`<span class="json-sync-mini ${s.cls}">${s.label}${s.id==='synced'&&s.time?' · '+esc(s.time):''}</span>`;return`<div class="task-json-sync-state ${s.cls}" id="prompt-json-sync-state"><div><span class="state-main">${s.label}</span><small>${esc(s.reason)}</small></div><div><small>最后同步：${esc(s.time)}</small> <span class="prompt-json-history-count" title="JSON 历史版本数">${count}</span></div></div>`;}
function posterFromTaskFields(f){f=f||{};const subs=[f.subtitle1,f.subtitle2,f.subtitle3].filter(Boolean);return`主标题：${f.mainTitle||''}\n核心卖点：${f.coreSellingPoint||''}\n功能区：${f.functionArea||''}\n${subs.map((x,i)=>`小标题${i+1}：${x}`).join('\n')}`.trim();}
function flattenTaskJsonDiff(oldV,newV,path='',out=[]){if(out.length>=80)return out;const oldObj=oldV&&typeof oldV==='object',newObj=newV&&typeof newV==='object';if(oldObj&&newObj&&!Array.isArray(oldV)&&!Array.isArray(newV)){const keys=[...new Set([...Object.keys(oldV),...Object.keys(newV)])].sort();keys.forEach(k=>flattenTaskJsonDiff(oldV[k],newV[k],path?path+'.'+k:k,out));return out;}if(Array.isArray(oldV)&&Array.isArray(newV)){const n=Math.max(oldV.length,newV.length);for(let i=0;i<n;i++)flattenTaskJsonDiff(oldV[i],newV[i],path+'['+i+']',out);return out;}if(taskJsonStableString(oldV)!==taskJsonStableString(newV))out.push({path:path||'(root)',oldValue:oldV,newValue:newV});return out;}
function taskJsonValuePreview(v){if(v===undefined)return'（不存在）';if(v===null)return'null';const s=typeof v==='string'?v:JSON.stringify(v,null,2);return String(s).length>500?String(s).slice(0,500)+'…':String(s);}
function taskJsonHistoryModalHtml(id){const i=wf.groups.findIndex(g=>g.id===id),g=i>=0?wf.groups[i]:null;if(!g)return'<h3>任务组 JSON 历史</h3><p>任务组不存在。</p>';const a=ensureWireJsonState(g),history=a.syncHistory||[],currentHash=taskJsonHash(parseTaskJsonText(a)||{}),items=history.length?history.map((h,idx)=>{const p=normalizeTaskSnapshotPayload(h.payload,g,i),f=p.posterFields||{},isCurrent=h.hash===currentHash;return`<div class="task-json-history-item ${isCurrent?'current':''}"><div><h5>版本 ${h.seq||history.length-idx} · ${esc(h.time||'')}</h5><p>${esc(h.origin||'任务组 JSON 同步')}${isCurrent?' · 当前正在使用':''}</p><div class="task-json-history-fields"><span>主标题：${esc(f.mainTitle||'空')}</span><span>规则 ${(p.replacementRules||[]).length} 条</span><span>质量约束 ${Object.keys(p.qualityConstraints||{}).length} 项</span></div></div><div class="task-json-history-actions"><button class="mini-btn" data-task-json-history-preview="${g.id}" data-history-id="${h.id}">查看</button><button class="mini-btn" data-task-json-history-restore="${g.id}" data-history-id="${h.id}" ${isCurrent?'disabled':''}>恢复此版本</button></div></div>`;}).join(''):'<div class="json-diff-empty">当前任务组还没有 JSON 同步历史。</div>';return`<h3>任务组 JSON 版本历史</h3><p class="hint">每次同步都会保存一条版本记录。恢复时会同时恢复文案字段、精准替换规则和质量约束，并重新作为当前生成 JSON 使用。</p><div class="task-json-history-list">${items}</div><div class="row" style="margin-top:14px"><button class="btn btn-ghost" data-modal-back>返回</button><button class="btn btn-ghost" data-mclose>关闭</button></div>`;}
function openTaskJsonHistory(id){modalOpen(taskJsonHistoryModalHtml(id),true);}
function taskJsonHistoryPreviewHtml(groupId,historyId){const i=wf.groups.findIndex(g=>g.id===groupId),g=i>=0?wf.groups[i]:null,a=g&&ensureWireJsonState(g),h=a&&(a.syncHistory||[]).find(x=>x.id===historyId);if(!h)return'<h3>JSON 历史详情</h3><p>历史版本不存在。</p>';return`<h3>JSON 历史详情</h3><p class="hint">版本 ${h.seq||''} · ${esc(h.time||'')} · ${esc(h.origin||'')}</p><textarea readonly style="min-height:430px;font-family:Consolas,monospace;font-size:11px">${esc(JSON.stringify(normalizeTaskSnapshotPayload(h.payload,g,i),null,2))}</textarea><div class="row" style="margin-top:12px"><button class="btn btn-violet" data-task-json-history-restore="${g.id}" data-history-id="${h.id}">恢复此版本</button><button class="btn btn-ghost" data-modal-back>返回</button></div>`;}
function restoreTaskJsonHistory(groupId,historyId){const i=wf.groups.findIndex(g=>g.id===groupId),g=i>=0?wf.groups[i]:null;if(!g)throw new Error('任务组不存在');const a=ensureWireJsonState(g),h=(a.syncHistory||[]).find(x=>x.id===historyId);if(!h)throw new Error('历史 JSON 版本不存在');const p=normalizeTaskSnapshotPayload(h.payload,g,i);g.poster=posterFromTaskFields(p.posterFields);if(p.linked)setPromptGroupSelected(g.id,true);else setPromptGroupSelected(g.id,false);a.ruleOverrides={replacementRules:cloneObj(p.replacementRules||WF_PRECISE_REPLACEMENT_RULES),qualityConstraints:cloneObj(p.qualityConstraints||defaultTaskQualityConstraints())};syncTaskGroupJson(g,i,'恢复 JSON 历史版本 '+(h.seq||'')+'（'+(h.time||'')+'）',{payload:p,restore:true});return p;}
function promptGroupJsonText(id){const i=wf.groups.findIndex(x=>x.id===id),g=i>=0?wf.groups[i]:null;if(!g)return '{}';const a=ensureWireJsonState(g);if(a.jsonText&&a.jsonText.trim())return a.jsonText;return JSON.stringify(taskGroupJsonPayload(g,i),null,2);}

const PROMPT_DIAG_FILTERS=[
  {id:'all',label:'全部任务'},
  {id:'missing-frame',label:'未选素材'},
  {id:'missing-json',label:'未生成 JSON'},
  {id:'unlinked',label:'未联通'},
  {id:'failed',label:'生成失败'}
];
function normalizePromptDiagnosisFilter(){const valid=PROMPT_DIAG_FILTERS.map(x=>x.id);if(!valid.includes(wf.promptDiagnosisFilter))wf.promptDiagnosisFilter='all';return wf.promptDiagnosisFilter;}
function promptGroupDiagnostics(g,i){
  if(typeof g.lastGenerateError!=='string')g.lastGenerateError='';
  const a=ensureWireJsonState(g),src=groupSourceInfo(g),fields=structuredPosterJson(g.poster||'');
  const subtitleCount=[fields.subtitle1,fields.subtitle2,fields.subtitle3].filter(Boolean).length;
  const textComplete=!!(fields.mainTitle&&fields.coreSellingPoint&&fields.functionArea&&subtitleCount);
  const d={id:g.id,index:i,label:g.label||('第 '+(i+1)+' 组'),source:src,missingFrame:!(g.frame&&g.frame.src),missingJson:!a.jsonText.trim(),unlinked:!isPromptLinkedForGroup(g),failed:!!g.lastGenerateError,textIncomplete:!textComplete,subtitleCount,fields};
  d.issueCount=['missingFrame','missingJson','unlinked','failed','textIncomplete'].filter(k=>d[k]).length;
  d.ready=d.issueCount===0;
  return d;
}
function promptDiagnosisMatches(d,filter){
  if(filter==='missing-frame')return d.missingFrame;
  if(filter==='missing-json')return d.missingJson;
  if(filter==='unlinked')return d.unlinked;
  if(filter==='failed')return d.failed;
  return true;
}
function promptDiagnosisCounts(){const ds=wf.groups.map(promptGroupDiagnostics);return {all:ds.length,'missing-frame':ds.filter(x=>x.missingFrame).length,'missing-json':ds.filter(x=>x.missingJson).length,unlinked:ds.filter(x=>x.unlinked).length,failed:ds.filter(x=>x.failed).length,ready:ds.filter(x=>x.ready).length};}
function promptDiagnosisActionLabel(filter){
  if(filter==='missing-frame')return '选择首个缺失素材';
  if(filter==='missing-json')return wf.advancedDebug?'一键补齐基础 JSON':'一键修复任务数据';
  if(filter==='unlinked')return '一键开启联通';
  if(filter==='failed')return '一键重试失败任务';
  return '一键修复可自动项';
}
function buildPromptBaselineJson(g,i){return syncTaskGroupJson(g,i,'V14 智能问题入口补齐的任务组 JSON');}
function repairPromptGroupSafe(g,i){
  const before=promptGroupDiagnostics(g,i);let changed=[];
  if(before.missingJson){buildPromptBaselineJson(g,i);changed.push('基础 JSON');}
  if(before.unlinked){COPY_API_CHANNEL.promptLinkEnabled=true;setPromptGroupSelected(g.id,true);changed.push('提示词联通');}
  if(before.failed){g.lastGenerateError='';changed.push('失败状态重置');}
  return {changed,needsFrame:before.missingFrame};
}
function promptDiagnosisInnerHtml(){
  const counts=promptDiagnosisCounts(),issues=Math.max(0,counts.all-counts.ready),active=ensurePromptActiveGroup();
  return `<div class="prompt-diagnosis-head"><div><h5>智能问题入口</h5><p>点击下方任一问题类型，可直接进入对应分类并处理；无需先打开总览再筛选。</p></div><div class="prompt-diagnosis-summary"><span>就绪 ${counts.ready}</span><span>问题 ${issues}</span><span>当前 ${esc(wf.groups.find(g=>g.id===active)?.label||'无')}</span></div></div><div class="issue-entry-card"><div><h5>${issues?'发现 '+issues+' 个问题任务':'全部任务已就绪'}</h5><p>${wf.advancedDebug?'素材、JSON、联通和失败状态':'素材、任务数据、联通和失败状态'}均可直接点击跳转；进入后可逐项修复或一键处理当前分类。</p></div><div class="issue-entry-meta"><button type="button" class="issue-quick-btn" data-issue-quick="missing-frame" ${counts['missing-frame']?'':'disabled'}>素材 <b>${counts['missing-frame']}</b></button><button type="button" class="issue-quick-btn" data-issue-quick="missing-json" ${counts['missing-json']?'':'disabled'}>${wf.advancedDebug?'JSON':'任务数据'} <b>${counts['missing-json']}</b></button><button type="button" class="issue-quick-btn" data-issue-quick="unlinked" ${counts.unlinked?'':'disabled'}>联通 <b>${counts.unlinked}</b></button><button type="button" class="issue-quick-btn" data-issue-quick="failed" ${counts.failed?'':'disabled'}>失败 <b>${counts.failed}</b></button><button type="button" class="btn btn-violet" data-issue-center-open>查看问题任务</button></div></div><div class="prompt-quality-note">生成质量保护：运行时会使用自动确认的精准替换数据与六条替换规则，禁止输出内部规则、解释文字或重新设计画面。</div>`;
}
function promptDiagnosisPanelHtml(){return `<div class="prompt-diagnosis-panel" id="prompt-diagnosis-panel">${promptDiagnosisInnerHtml()}</div>`;}
function refreshPromptDiagnosisUi(){const el=$('prompt-diagnosis-panel');if(el)el.innerHTML=promptDiagnosisInnerHtml();}
function normalizeIssueCenterFilter(){const ids=['all','missing-frame','missing-json','unlinked','failed'];if(!ids.includes(wf.issueCenterFilter))wf.issueCenterFilter='all';return wf.issueCenterFilter;}
function issueCenterCategoryLabel(id){return({all:'全部问题','missing-frame':'素材缺失','missing-json':wf.advancedDebug?'JSON 未生成':'任务数据异常',unlinked:'提示词未联通',failed:'生成失败'})[id]||'全部问题';}
function issueCenterTasks(){const filter=normalizeIssueCenterFilter(),all=wf.groups.map(promptGroupDiagnostics);return all.filter(d=>filter==='all'?!d.ready:promptDiagnosisMatches(d,filter));}
function issueCenterInnerHtml(){const filter=normalizeIssueCenterFilter(),counts=promptDiagnosisCounts(),items=issueCenterTasks(),cats=[['missing-frame','素材缺失'],['missing-json',wf.advancedDebug?'JSON 未生成':'任务数据异常'],['unlinked','未联通'],['failed','生成失败']];const categoryHtml=cats.map(([id,label])=>`<button type="button" class="issue-category-btn ${filter===id?'on':''}" data-issue-category="${id}"><span>${label}</span><b>${counts[id]||0}</b></button>`).join('');const cards=items.length?items.map(d=>{const g=wf.groups[d.index],issues=[];if(d.missingFrame)issues.push('<span class="prompt-diag-chip bad">未选素材</span>');if(d.missingJson)issues.push('<span class="prompt-diag-chip warn">'+(wf.advancedDebug?'缺少任务组精准替换 JSON：posterFields、replacementRules、qualityConstraints':'任务数据尚未自动同步')+'</span>');if(d.unlinked)issues.push('<span class="prompt-diag-chip bad">未联通</span>');if(d.failed)issues.push('<span class="prompt-diag-chip bad">生成失败</span>');if(d.textIncomplete)issues.push('<span class="prompt-diag-chip warn">文案字段不完整</span>');return `<div class="prompt-diagnosis-card ${d.ready?'ready':''}"><div class="prompt-diagnosis-title"><div><b>${esc(d.label)}</b><small>${d.source.bound?'来源：'+esc(d.source.label):'未绑定来源版本'} · 小标题 ${d.subtitleCount}/3</small></div><span class="prompt-diag-score bad">${d.issueCount} 项</span></div><div class="prompt-diagnosis-issues">${issues.join('')}</div><div class="prompt-diagnosis-actions"><button class="mini-btn" data-prompt-diag-current="${d.id}">设为当前</button><button class="mini-btn" data-prompt-diag-repair="${d.id}">安全修复</button>${d.missingJson?`<button class="mini-btn" data-prompt-diag-sync-json="${d.id}">${wf.advancedDebug?'同步任务 JSON':'自动修复任务数据'}</button>`:''}${d.missingFrame?`<button class="mini-btn" data-prompt-diag-frame="${d.id}">选择素材</button>`:''}${d.failed?`<button class="mini-btn" data-prompt-diag-retry="${d.id}">重试生成</button>`:''}</div></div>`;}).join(''):`<div class="prompt-diagnosis-empty">${filter==='all'?'当前没有问题任务。':'当前分类下没有问题任务。'}</div>`;return `<h3>查看问题任务</h3><p class="hint">按问题类型分类查看。安全修复会补齐本地任务数据、开启联通或清理失败状态；缺少素材时会直接打开对应任务组的线框选择器。</p><div class="issue-center-categories"><button type="button" class="issue-category-btn ${filter==='all'?'on':''}" data-issue-category="all"><span>全部问题</span><b>${Math.max(0,counts.all-counts.ready)}</b></button>${categoryHtml}</div><div class="issue-center-toolbar"><span>当前分类：<b>${issueCenterCategoryLabel(filter)}</b> · ${items.length} 个任务</span><div class="row" style="gap:6px"><button class="btn btn-ghost" data-issue-repair-category ${items.length?'':'disabled'}>一键处理当前分类</button></div></div><div class="issue-center-list" id="issue-center-list">${cards}</div><div class="row" style="margin-top:12px"><button class="btn btn-ghost" data-mclose>关闭</button></div>`;}
function openIssueCenter(filter){if(filter)wf.issueCenterFilter=filter;modalOpen(issueCenterInnerHtml(),true);}
function refreshIssueCenterUi(){const box=document.querySelector('#modal .modal-box');if(box&&box.querySelector('#issue-center-list'))modalRefresh(issueCenterInnerHtml(),true);}
function safeRepairPromptFilter(explicitFilter){
  const filter=explicitFilter||normalizeIssueCenterFilter()||normalizePromptDiagnosisFilter();
  const matches=wf.groups.map(promptGroupDiagnostics).filter(d=>filter==='all'?!d.ready:promptDiagnosisMatches(d,filter));
  if(!matches.length){setActionStatus('success','当前分类没有需要处理的任务组',false);refreshIssueCenterUi();return Promise.resolve({handled:0});}
  if(filter==='missing-frame'){
    const d=matches[0];wf.promptActiveGroupId=d.id;refreshPromptTargetUi(d.id);setActionStatus('loading','请为 '+d.label+' 选择排版参考图',false);setTimeout(()=>openPicker(d.index),60);return Promise.resolve({handled:0,pendingFrame:true});
  }
  if(filter==='failed'){
    return (async()=>{
      let ok=0,skipped=0;
      for(const d of matches){
        const g=wf.groups[d.index];
        if(!(g.frame&&g.frame.src&&g.poster&&g.poster.trim())){skipped++;continue;}
        g.lastGenerateError='';
        await startGen(d.index);
        if(!g.lastGenerateError)ok++;
      }
      refreshPromptTargetUi(wf.promptActiveGroupId);refreshIssueCenterUi();
      setActionStatus(ok?'success':'error',ok?'已重试 '+ok+' 个失败任务'+(skipped?'；跳过 '+skipped+' 个缺少素材或文案的任务':''):'没有可直接重试的任务，请先补齐素材、文案和 API 配置',false);
      return {handled:ok,skipped};
    })();
  }
  let changes=0,needsFrame=[];
  matches.forEach(d=>{const r=repairPromptGroupSafe(wf.groups[d.index],d.index);changes+=r.changed.length;if(r.needsFrame)needsFrame.push(d);});
  saveCopyApiChannel();
  if(curView==='integrate')renderWireframe();
  refreshPromptTargetUi(wf.promptActiveGroupId);refreshIssueCenterUi();
  const label=filter==='missing-json'?(wf.advancedDebug?'基础 JSON':'任务数据'):filter==='unlinked'?'提示词联通':'可自动修复项';
  setActionStatus('success','已处理 '+matches.length+' 个任务组，完成 '+changes+' 项'+label+(needsFrame.length?'；另有 '+needsFrame.length+' 组需要手动选择素材':''),false);
  return Promise.resolve({handled:matches.length,changes,needsFrame:needsFrame.length});
}
function refreshPromptTargetUi(preferred){
  const active=ensurePromptActiveGroup(preferred),chips=$('prompt-group-chips'),count=$('prompt-group-count'),select=$('prompt-preview-group'),ta=$('prompt-group-json');
  if(chips)chips.innerHTML=promptGroupChipsHtml();
  const chosen=currentPromptTargetIds();if(count)count.textContent=`已选择 ${chosen.length}/${wf.groups.length} 个任务组；当前：${wf.groups.find(g=>g.id===active)?.label||'无'}`;
  if(select){const opts=promptGroupPreviewOptions(active);select.innerHTML=opts.html;select.disabled=!opts.id;select.value=opts.id||'';if(ta)ta.value=promptGroupJsonText(opts.id);}
  else if(ta)ta.value=promptGroupJsonText(active);
  const i=wf.groups.findIndex(g=>g.id===active),status=$('prompt-json-sync-state');if(status&&i>=0)status.outerHTML=taskJsonStatusHtml(wf.groups[i],i,false);
  const histBtn=document.querySelector('[data-task-json-history-current]');if(histBtn){histBtn.dataset.taskJsonHistory=active||'';histBtn.disabled=!active;}
  refreshPromptDiagnosisUi();
}
function refreshPromptLinkModalUi(){
  const linked=COPY_API_CHANNEL.promptLinkEnabled!==false,card=document.querySelector('#modal .copy-link-card'),btn=document.querySelector('#modal [data-copy-prompt-link-toggle]');
  if(card)card.classList.toggle('off',!linked);if(btn){btn.classList.toggle('on',linked);btn.classList.toggle('off',!linked);btn.setAttribute('aria-pressed',linked?'true':'false');btn.innerHTML=`<span aria-hidden="true"></span>${linked?'已开启':'已关闭'}`;}
  const badge=document.querySelector('#modal .prompt-rule-workbench .copy-simple-status');if(badge){badge.classList.toggle('linked',linked);badge.classList.toggle('unlinked',!linked);badge.textContent=linked?'规则已联通':'规则未联通';}
  refreshPromptTargetUi(wf.promptActiveGroupId);
}
function openBuiltin(){
  const linked=COPY_API_CHANNEL.promptLinkEnabled!==false,chosen=currentPromptTargetIds(),preview=promptGroupPreviewOptions(chosen[0]);
  modalOpen(`<h3>内置线框 Prompt</h3>
  <p class="hint">点击「生成线框」时自动使用此提示词；<b>保存后会持久化，刷新也不会回到默认</b>。</p>
  <div class="copy-link-card ${linked?'':'off'}"><div class="head"><b>V14 文案字段联通</b><button type="button" class="link-status-btn ${linked?'on':'off'}" data-copy-prompt-link-toggle aria-pressed="${linked?'true':'false'}"><span aria-hidden="true"></span>${linked?'已开启':'已关闭'}</button></div><p>当前映射：${esc(COPY_API_CHANNEL.mappingName||'默认字段映射')}。运行时只向已选择的任务组附加结构化文案数据与精准替换规则。</p><div class="row" style="margin-top:8px;gap:7px"><button class="btn btn-ghost" data-copy-link-test>联通测试</button><button class="btn btn-ghost" data-copy-json-mapping>打开文案字段联通</button></div><div class="link-test-result" id="copy-link-test-result">可测试当前字段映射、任务组选择与线框提示词是否已联通。</div></div>
  <div class="prompt-rule-workbench">
    <div class="pr-head"><div><h4>精准文字替换规则</h4><p>以下规则会与每个任务组的结构化文案数据一起加入运行时提示词。</p></div><span class="copy-simple-status ${linked?'linked':'unlinked'}">${linked?'规则已联通':'规则未联通'}</span></div>
    ${promptRulesHtml()}
    <div class="prompt-target-box">
      <div class="prompt-target-toolbar"><div><b>应用任务组与当前任务组</b><div class="meta" id="prompt-group-count">已选择 ${chosen.length}/${wf.groups.length} 个任务组</div></div><div class="row" style="gap:6px"><button class="mini-btn" data-prompt-group-all>全选</button><button class="mini-btn" data-prompt-group-none>清空</button></div></div>
      <div class="prompt-group-chips" id="prompt-group-chips">${promptGroupChipsHtml()}</div>
      ${wf.advancedDebug?`<div class="prompt-group-preview"><div><label class="fl">当前任务组（点击上方任务组可切换）</label><select id="prompt-preview-group" data-prompt-preview-group ${preview.id?'':'disabled'}>${preview.html}</select>${preview.id?taskJsonStatusHtml(wf.groups[wf.groups.findIndex(g=>g.id===preview.id)],wf.groups.findIndex(g=>g.id===preview.id),false):''}<div class="preview-actions"><button class="mini-btn" data-prompt-sync-group-json ${preview.id?'':'disabled'}>立即刷新任务 JSON</button><button class="mini-btn" data-task-json-history-current data-task-json-history="${preview.id||''}" ${preview.id?'':'disabled'}>查看 JSON 历史</button><small class="hint" style="display:block;margin-top:5px">高级 / 调试模式：可查看自动确认的任务 JSON、同步状态和历史版本。</small></div></div><div><label class="fl">当前任务组精准替换数据</label><textarea id="prompt-group-json" readonly>${esc(promptGroupJsonText(preview.id))}</textarea></div></div>`:`<div class="prompt-group-preview"><div style="grid-column:1/-1"><label class="fl">当前任务组</label><select id="prompt-preview-group" data-prompt-preview-group ${preview.id?'':'disabled'}>${preview.html}</select><div class="notebox" style="margin-top:9px;background:#f0fdf4;border-color:#bbf7d0;color:#166534">任务数据会随文案自动同步并自动确认，普通流程无需查看技术结构。需要审计或恢复技术版本时，请回到 AI 线框页开启「高级 / 调试」。</div></div></div>`}
      ${promptDiagnosisPanelHtml()}
    </div>
  </div>
  <label class="fl">基础内置提示词</label><textarea id="bp" rows="10">${esc(wf.builtin)}</textarea>
  <div class="row" style="margin-top:14px;"><button class="btn btn-violet" data-bp-save>保存</button><button class="btn btn-ghost" data-bp-reset>恢复默认</button><button class="btn btn-ghost" data-mclose>取消</button></div>
  ${promptHistHtml('wire','data-bp-restore')}`,true);
}

async function normalizeVisionImageSource(src){
  const s=String(src||'');if(!s)throw new Error('图片地址为空');if(/^data:/i.test(s)||/^https?:/i.test(s))return s;
  const res=await fetch(s);if(!res.ok)throw new Error('无法读取本地图片：HTTP '+res.status);return blobToDataURL(await res.blob());
}
function setWireJsonSource(i,source,origin){const g=wf.groups[i];if(!g)return;const a=ensureWireJsonState(g);a.source=source;a.origin=origin||'';a.open=true;renderWireframe();setTimeout(()=>{const el=$('wf-json-panel-'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'center'});},60);}
function chooseWireJsonImage(i,btn){const g=wf.groups[i];if(!g)return;const key='wf-json-upload-'+g.id;if(!actionLock(key,btn))return;setActionStatus('loading','正在读取分析图片…',true);chooseFile(file=>{const a=ensureWireJsonState(g);a.source=file;a.origin='本地上传';a.open=true;renderWireframe();actionDone(key,'分析图片已上传');setTimeout(()=>{const el=$('wf-json-panel-'+i);if(el)el.scrollIntoView({behavior:'smooth',block:'center'});},60);},err=>actionFail(key,'上传分析图片失败：'+err.message),()=>{actionUnlock(key);setActionStatus('error','已取消选择图片',false);});}
function useCurrentWireForJson(i){const g=wf.groups[i];if(!g||!g.result||!g.result.src){setActionStatus('error','当前还没有已生成的 AI 线框图',false);return;}setWireJsonSource(i,{src:g.result.src,name:(g.label||('第 '+(i+1)+' 组'))+' · AI 线框图'},'当前 AI 生成线框图');setActionStatus('success','当前生成图已送入 JSON 分析区',false);}
function sendWireHistoryToJson(idx){
  const h=(wf.history||[])[idx];if(!h||!h.src){setActionStatus('error','历史线框图不存在或已失效',false);return;}
  let gi=wfHistoryTargetGroup;
  if(!(Number.isInteger(gi)&&wf.groups[gi])){const g=newGroup('JSON 分析 · '+(h.label||'历史线框'),h.poster||'');g.result={time:h.time||nowStr(),src:h.src,historyId:h.id};wf.groups.push(g);gi=wf.groups.length-1;}
  const g=wf.groups[gi],a=ensureWireJsonState(g);a.source={src:h.src,name:(h.label||'历史线框')+' · '+(h.time||'')};a.origin='历史生成线框记录';a.open=true;modalClose();if(curView!=='integrate')render('integrate');else renderWireframe();setActionStatus('success','历史线框图已送入 JSON 分析区',false);setTimeout(()=>{const el=$('wf-json-panel-'+gi);if(el)el.scrollIntoView({behavior:'smooth',block:'center'});},120);
}
async function analyzeWireJson(i,btn){
  const g=wf.groups[i];if(!g)return;const a=ensureWireJsonState(g);a.open=true;if(!a.source||!a.source.src){setActionStatus('error','请先上传或选择需要分析的图片',false);return;}if(!API_BRIDGE.ready){setActionStatus('error','请先完成 AI 接入配置',false);openCfg();return;}
  const key='wf-json-analyze-'+g.id;if(!actionLock(key,btn))return;setActionStatus('loading','正在识别图片结构并生成 JSON…',true);
  try{const raw=await apiVisionJson(a.source.src,WIRE_JSON_ANALYSIS_PROMPT);const out=cleanJsonResponse(raw);a.jsonText=out.text;a.updatedAt=nowStr();renderWireframe();if(out.valid)actionDone(key,'图片分析完成，JSON 已生成');else actionFail(key,'AI 已返回内容，但 JSON 格式需手动修正：'+out.error);}
  catch(e){actionFail(key,'图片分析失败：'+e.message);}
}
async function modifyWireJson(i,btn){
  const g=wf.groups[i];if(!g)return;const a=ensureWireJsonState(g);a.open=true;const req=a.requirement.trim(),cur=a.jsonText.trim();if(!cur){setActionStatus('error','请先生成或填写 JSON',false);return;}if(!req){setActionStatus('error','请先填写修改需求',false);return;}if(!API_BRIDGE.ready){setActionStatus('error','请先完成 AI 接入配置',false);openCfg();return;}
  const key='wf-json-modify-'+g.id;if(!actionLock(key,btn))return;setActionStatus('loading','AI 正在根据需求修改 JSON…',true);
  try{const prompt=`你是电商视觉结构 JSON 编辑器。只返回严格有效的 JSON，不要输出 Markdown 或解释。必须尽量保留未被需求涉及的字段和结构，不要擅自删除信息。

当前 JSON：
${cur}

修改需求：
${req}`;const raw=await apiChat(prompt,requireAnalysisModel(true));const out=cleanJsonResponse(raw);a.jsonText=out.text;a.updatedAt=nowStr();renderWireframe();if(out.valid)actionDone(key,'AI 已根据需求修改 JSON');else actionFail(key,'AI 返回内容需手动修正：'+out.error);}
  catch(e){actionFail(key,'AI 修改 JSON 失败：'+e.message);}
}
function formatWireJson(i){const g=wf.groups[i];if(!g)return;const a=ensureWireJsonState(g),out=cleanJsonResponse(a.jsonText);a.jsonText=out.text;if(out.valid){a.updatedAt=nowStr();renderWireframe();setActionStatus('success','JSON 格式正确，已完成格式化',false);}else setActionStatus('error','JSON 格式错误：'+out.error,false);}
function saveWireJson(i){const g=wf.groups[i];if(!g)return;const a=ensureWireJsonState(g),out=cleanJsonResponse(a.jsonText);if(!out.valid){setActionStatus('error','保存失败，JSON 格式错误：'+out.error,false);return;}a.jsonText=out.text;a.updatedAt=nowStr();a.manualEditedAt=a.updatedAt;renderWireframe();setActionStatus('success','JSON 修改已保存；状态已标记为需要重新同步',false);}
function clearWireJson(i){const g=wf.groups[i];if(!g)return;const old=ensureWireJsonState(g),hist=cloneObj(old.syncHistory||[]),last={lastSyncAt:old.lastSyncAt,lastSyncHash:old.lastSyncHash,lastSyncPayload:cloneObj(old.lastSyncPayload),ruleOverrides:cloneObj(old.ruleOverrides)};g.jsonAnalysis=newWireJsonState();Object.assign(g.jsonAnalysis,last,{syncHistory:hist,open:true,historyLoaded:true});persistTaskJsonHistory(g);renderWireframe();setActionStatus('success','当前 JSON 已清空；同步历史仍保留',false);}
