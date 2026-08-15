/* V26 copy page-state persistence: reload restore is invoked by the global page lifecycle; history remains deletable and pinnable. */
const COPY_SNAPSHOT_KEY='turing_copy_generation_snapshots_current';
const COPY_SESSION_HAS_CURRENT_KEY='turing_copy_session_has_current_copy';
let COPY_SNAPSHOT_STATE={version:1,activeId:'',batches:[]};
let COPY_SNAPSHOT_HYDRATING=false;
let COPY_SNAPSHOT_BOOT_RESTORED=false;

function copySnapshotSafeRead(){
  try{
    let raw=localStorage.getItem(COPY_SNAPSHOT_KEY)||'';
    if(!raw&&Number.isInteger(localStorage.length)&&typeof localStorage.key==='function'){
      for(let i=0;i<localStorage.length;i++){
        const key=String(localStorage.key(i)||'');
        if(/^turing_copy_v\d+(?:_\d+)?_generation_snapshots$/.test(key)){
          raw=localStorage.getItem(key)||'';
          if(raw){try{localStorage.setItem(COPY_SNAPSHOT_KEY,raw);}catch(_e){}break;}
        }
      }
    }
    return CopySnapshotStore.normalizeState(raw);
  }catch(_e){return CopySnapshotStore.normalizeState(null);}
}
function copySnapshotSafeWrite(){
  try{localStorage.setItem(COPY_SNAPSHOT_KEY,JSON.stringify(COPY_SNAPSHOT_STATE));return true;}
  catch(_e){return false;}
}
function copySnapshotRememberRuntimePresence(hasCurrent){
  try{sessionStorage.setItem(COPY_SESSION_HAS_CURRENT_KEY,hasCurrent?'1':'0');return true;}catch(_e){return false;}
}

function copySnapshotApplyBatch(batch){
  if(!batch)return false;
  COPY_SNAPSHOT_HYDRATING=true;
  try{
    copies=CopySnapshotStore.clone(batch.copies)||[];
    copies._in=String(batch.input||'');
    selected=new Set(CopySnapshotStore.cleanSelected(batch.selected,copies.length));
    expanded=null;
  }finally{COPY_SNAPSHOT_HYDRATING=false;}
  return true;
}
function copySnapshotHasRestorableCurrent(){
  try{return sessionStorage.getItem(COPY_SESSION_HAS_CURRENT_KEY)==='1';}catch(_e){return false;}
}

function copySnapshotRestoreOnReload(){
  COPY_SNAPSHOT_STATE=copySnapshotSafeRead();
  // Route ownership lives in AppRoutePersistence/AppPageStateLifecycle. This page only decides whether its current copy state is safe to hydrate.
  if(!copySnapshotHasRestorableCurrent())return false;
  const batch=CopySnapshotStore.activeBatch(COPY_SNAPSHOT_STATE);
  COPY_SNAPSHOT_BOOT_RESTORED=copySnapshotApplyBatch(batch);
  return COPY_SNAPSHOT_BOOT_RESTORED;
}
function copySnapshotBeginFreshEntry(){
  COPY_SNAPSHOT_HYDRATING=true;
  try{copies=[];selected=new Set();expanded=null;}finally{COPY_SNAPSHOT_HYDRATING=false;}
  copySnapshotRememberRuntimePresence(false);
  return true;
}

function copySnapshotCaptureGenerated(input,origin){
  COPY_SNAPSHOT_STATE=CopySnapshotStore.addBatch(COPY_SNAPSHOT_STATE,{
    input:String(input||''),origin:String(origin||'generated'),copies,selected:[...selected]
  });
  copySnapshotSafeWrite();
  copySnapshotRememberRuntimePresence(true);
  return CopySnapshotStore.activeBatch(COPY_SNAPSHOT_STATE);
}

function copySnapshotPersistCurrent(){
  if(COPY_SNAPSHOT_HYDRATING||!copies.length)return false;
  const payload={input:String(copies._in||$('cp-in')?.value||''),copies,selected:[...selected],updatedAt:new Date().toISOString()};
  if(!COPY_SNAPSHOT_STATE.batches.length){
    COPY_SNAPSHOT_STATE=CopySnapshotStore.addBatch(COPY_SNAPSHOT_STATE,Object.assign({origin:'restored-runtime'},payload));
  }else{
    COPY_SNAPSHOT_STATE=CopySnapshotStore.updateActive(COPY_SNAPSHOT_STATE,payload);
  }
  copySnapshotRememberRuntimePresence(true);
  return copySnapshotSafeWrite();
}
function copySnapshotSwitch(id){
  if(!id)return false;
  const same=id===COPY_SNAPSHOT_STATE.activeId;
  if(!same&&copies.length)copySnapshotPersistCurrent();
  if(!same)COPY_SNAPSHOT_STATE=CopySnapshotStore.activate(COPY_SNAPSHOT_STATE,id);
  const batch=CopySnapshotStore.activeBatch(COPY_SNAPSHOT_STATE);
  if(!batch||String(batch.id)!==String(id))return false;
  copySnapshotApplyBatch(batch);copySnapshotSafeWrite();copySnapshotRememberRuntimePresence(true);
  if(typeof curView!=='undefined'&&curView==='copy'){
    const inp=$('cp-in');if(inp)inp.value=copies._in||'';
    renderCopyOut();
    const gen=$('cp-gen');if(gen)gen.disabled=!String(inp?.value||'').trim();
  }
  setActionStatus('success','已恢复'+copySnapshotActiveLabel()+'文案快照',false);
  return true;
}
function copySnapshotRefreshUi(){
  if(typeof curView!=='undefined'&&curView==='copy'){
    const inp=$('cp-in');
    if(inp&&copies.length)inp.value=copies._in||'';
    if(inp&&!copies.length)inp.value='';
    renderCopyOut();
    const gen=$('cp-gen');if(gen)gen.disabled=!String(inp?.value||'').trim();
  }
}
function copySnapshotSetPinned(id,pinned){
  const target=COPY_SNAPSHOT_STATE.batches.find(x=>x.id===String(id||''));
  if(!target)return false;
  const wasActive=String(COPY_SNAPSHOT_STATE.activeId)===String(target.id),hadRuntime=!!copies.length;
  COPY_SNAPSHOT_STATE=CopySnapshotStore.setPinned(COPY_SNAPSHOT_STATE,target.id,!!pinned,{now:new Date().toISOString()});
  const targetStillExists=COPY_SNAPSHOT_STATE.batches.some(x=>x.id===target.id);
  if(!targetStillExists&&wasActive&&hadRuntime){
    const next=CopySnapshotStore.activeBatch(COPY_SNAPSHOT_STATE);
    if(next)copySnapshotApplyBatch(next);else{copies=[];selected=new Set();expanded=null;copySnapshotRememberRuntimePresence(false);}
  }
  copySnapshotSafeWrite();copySnapshotRefreshUi();
  setActionStatus('success',pinned?'已星标保留：该快照不会被最近 5 批规则自动淘汰':targetStillExists?'已取消保留：该快照重新进入最近 5 批规则':'已取消保留；该快照超出最近 5 批，已按规则自动淘汰',false);
  return true;
}
function copySnapshotTogglePinned(id){
  const target=COPY_SNAPSHOT_STATE.batches.find(x=>x.id===String(id||''));
  return target?copySnapshotSetPinned(target.id,!target.pinned):false;
}
function copySnapshotDelete(id){
  const target=COPY_SNAPSHOT_STATE.batches.find(x=>x.id===String(id||''));
  if(!target)return false;
  const wasActive=String(COPY_SNAPSHOT_STATE.activeId)===String(target.id),hadRuntime=!!copies.length;
  COPY_SNAPSHOT_HYDRATING=true;
  try{
    COPY_SNAPSHOT_STATE=CopySnapshotStore.deleteBatch(COPY_SNAPSHOT_STATE,target.id);
    if(wasActive&&hadRuntime){
      const next=CopySnapshotStore.activeBatch(COPY_SNAPSHOT_STATE);
      if(next)copySnapshotApplyBatch(next);else{copies=[];selected=new Set();expanded=null;copySnapshotRememberRuntimePresence(false);}
    }
  }finally{COPY_SNAPSHOT_HYDRATING=false;}
  copySnapshotSafeWrite();copySnapshotRefreshUi();
  setActionStatus('success','历史快照已删除',false);
  return true;
}
function copySnapshotStats(){return CopySnapshotStore.stats(COPY_SNAPSHOT_STATE);}
function copySnapshotBatchLabel(batch,index){
  if(!batch)return'';
  const base=index===0?'本次':index===1?'上一次':`更早 · 第 ${index+1} 批`;
  return batch.pinned?'★ 保留 · '+base:base;
}
function copySnapshotTime(value){
  try{return new Date(value).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});}
  catch(_e){return'';}
}
function copySnapshotActiveLabel(){
  const idx=COPY_SNAPSHOT_STATE.batches.findIndex(x=>x.id===COPY_SNAPSHOT_STATE.activeId),batch=COPY_SNAPSHOT_STATE.batches[idx];
  return copySnapshotBatchLabel(batch,Math.max(0,idx));
}
function copySnapshotArchiveHtml(){
  const batches=COPY_SNAPSHOT_STATE.batches;
  if(!batches.length)return'';
  const stat=copySnapshotStats();
  return `<details class="copy-history-archive"><summary>恢复历史快照 <span>${stat.recent}/${stat.maxRecent}${stat.pinned?` · ★${stat.pinned}`:''}</span></summary><div class="copy-history-archive-list">${batches.map((batch,i)=>`<div class="copy-history-archive-item ${batch.pinned?'pinned':''}" data-copy-snapshot-row="${esc(batch.id)}"><button type="button" class="copy-history-archive-restore" data-copy-snapshot="${esc(batch.id)}"><span><b>${esc(copySnapshotBatchLabel(batch,i))}</b><small>${esc(copySnapshotTime(batch.createdAt))}</small></span><em>${esc((batch.input||'未命名产品').replace(/\s+/g,' ').slice(0,38))}</em><strong>恢复</strong></button><div class="copy-history-archive-actions"><button type="button" class="copy-history-star ${batch.pinned?'on':''}" data-copy-snapshot-star="${esc(batch.id)}" aria-pressed="${batch.pinned?'true':'false'}" title="${batch.pinned?'取消星标保留':'星标保留，避免自动淘汰'}">${batch.pinned?'★ 已保留':'☆ 保留'}</button><button type="button" class="copy-history-delete" data-copy-snapshot-delete="${esc(batch.id)}" title="删除该历史快照">删除</button></div></div>`).join('')}</div><p>普通快照自动保留最近 5 批；★ 星标“保留”的优秀文案不计入 5 批上限，也不会自动淘汰。删除后不可恢复。</p></details>`;
}
function copySnapshotSwitcherHtml(){
  const batches=COPY_SNAPSHOT_STATE.batches;
  if(!batches.length)return'';
  const stat=copySnapshotStats(),active=COPY_SNAPSHOT_STATE.activeId,latest=batches[0],previous=batches[1],older=batches.slice(2);
  const olderActive=older.some(x=>x.id===active);
  const activeBatch=batches.find(x=>x.id===active)||latest;
  const btn=(batch,label)=>batch?`<button type="button" class="copy-history-tab ${active===batch.id?'on':''} ${batch.pinned?'pinned':''}" data-copy-snapshot="${esc(batch.id)}"><b>${batch.pinned?'★ ':''}${label}</b><span>${esc(copySnapshotTime(batch.createdAt))}</span></button>`:'';
  return `<div class="copy-history-panel" data-copy-history-panel>
    <div class="copy-history-head"><div><b>生成历史快照</b><span>普通快照 ${stat.recent}/${stat.maxRecent} 批${stat.pinned?` · 已星标保留 ${stat.pinned} 批`:''}；星标快照不参与自动淘汰。</span></div><span class="copy-history-current">正在查看：${esc(copySnapshotActiveLabel())}</span></div>
    <div class="copy-history-controls">${btn(latest,'本次')}${btn(previous,'上一次')}
      <label class="copy-history-older ${olderActive?'on':''}"><b>更早</b><select data-copy-snapshot-older ${older.length?'':'disabled'}><option value="">${older.length?`选择更早快照（${older.length}）`:'暂无更早快照'}</option>${older.map((batch,i)=>`<option value="${esc(batch.id)}" ${active===batch.id?'selected':''}>${batch.pinned?'★ 保留 · ':''}第 ${i+3} 批 · ${esc(copySnapshotTime(batch.createdAt))} · ${esc((batch.input||'').slice(0,24)||'未命名产品')}</option>`).join('')}</select></label>
    </div>
    <div class="copy-history-meta"><span>当前快照：${esc(copySnapshotTime(activeBatch.createdAt))}</span><span>输入：${esc((activeBatch.input||'').replace(/\s+/g,' ').slice(0,60)||'—')}</span><span>${activeBatch.copies.length} 个版本</span><div class="copy-history-manage"><button type="button" class="copy-history-star ${activeBatch.pinned?'on':''}" data-copy-snapshot-star="${esc(activeBatch.id)}">${activeBatch.pinned?'★ 已保留':'☆ 星标保留'}</button><button type="button" class="copy-history-delete" data-copy-snapshot-delete="${esc(activeBatch.id)}">删除当前快照</button></div></div>
  </div>`;
}

COPY_SNAPSHOT_STATE=copySnapshotSafeRead();
window.addEventListener('pagehide',()=>{try{copySnapshotPersistCurrent();}catch(_e){}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){try{copySnapshotPersistCurrent();}catch(_e){}}});
try{window.CopyGenerationHistory={state:()=>CopySnapshotStore.clone(COPY_SNAPSHOT_STATE),capture:copySnapshotCaptureGenerated,persist:copySnapshotPersistCurrent,switchTo:copySnapshotSwitch,setPinned:copySnapshotSetPinned,togglePinned:copySnapshotTogglePinned,delete:copySnapshotDelete,stats:copySnapshotStats,beginFresh:copySnapshotBeginFreshEntry,restoreOnReload:copySnapshotRestoreOnReload};}catch(_e){}
