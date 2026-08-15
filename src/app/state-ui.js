/* ============ 状态 ============ */
let copies=[], selected=new Set(), expanded=null, groupCount=1, subtitleDragState=null;
const UI_ICONS={
  studio:`<svg class="ui-icon icon-studio" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 3.5c.7 4.9 2.2 7.2 7.1 7.9-4.9.8-6.4 3.1-7.1 8-.7-4.9-2.2-7.2-7.1-8 4.9-.7 6.4-3 7.1-7.9Z"/><path class="icon-soft" d="M24.4 18.4c.4 2.7 1.2 4 3.9 4.4-2.7.4-3.5 1.7-3.9 4.4-.4-2.7-1.2-4-3.9-4.4 2.7-.4 3.5-1.7 3.9-4.4ZM7.2 19.1c.3 2.2 1 3.2 3.2 3.5-2.2.4-2.9 1.4-3.2 3.6-.3-2.2-1-3.2-3.2-3.6 2.2-.3 2.9-1.3 3.2-3.5Z"/><circle cx="26.2" cy="7.2" r="1.35"/></svg>`,
  copy:`<svg class="ui-icon icon-copy" viewBox="0 0 32 32" aria-hidden="true"><path d="M8.5 5.5h11.8l4.2 4.2v17H8.5z"/><path class="icon-soft" d="M20.3 5.5v4.2h4.2M12 12.2h8.4M12 16h7M12 19.8h4.8"/><path d="m17.9 24.8 6.7-6.7 2.8 2.8-6.7 6.7-3.8 1z"/><path d="m24.6 18.1 1.2-1.2c.6-.6 1.5-.6 2.1 0l.7.7c.6.6.6 1.5 0 2.1l-1.2 1.2"/><path class="icon-soft" d="M5.5 9.2v18.3h8.8"/></svg>`,
  wire:`<svg class="ui-icon icon-wire" viewBox="0 0 32 32" aria-hidden="true"><path d="M6 11V6h5M21 6h5v5M26 21v5h-5M11 26H6v-5"/><rect x="9.5" y="9.5" width="13" height="13" rx="1.5"/><path class="icon-soft" d="M16 9.5v13M9.5 16h13"/><circle cx="16" cy="16" r="1.5"/><path d="M12 12h2M18 20h2"/></svg>`,
  image:`<svg class="ui-icon icon-image" viewBox="0 0 32 32" aria-hidden="true"><rect x="5.5" y="6.5" width="21" height="19" rx="3"/><circle cx="21.8" cy="11.3" r="2"/><path d="m8.8 22 5.2-5.4 3.7 3.4 2.2-2 3.4 4"/><path class="icon-soft" d="M9.2 10.3h4.2M9.2 13.2h2.8"/><path d="M25.3 3.8v3M23.7 5.3h3M8 27.8h16"/></svg>`,
  adjust:`<svg class="ui-icon icon-adjust" viewBox="0 0 32 32" aria-hidden="true"><rect x="5.5" y="5.5" width="21" height="21" rx="3"/><path d="M10 11h12M10 16h12M10 21h12"/><circle cx="14" cy="11" r="2.1"/><circle cx="20" cy="16" r="2.1"/><circle cx="12.5" cy="21" r="2.1"/><path class="icon-soft" d="M25.8 3.7v4.2M23.7 5.8h4.2"/></svg>`
};
function uiIcon(name,cls=''){const svg=UI_ICONS[name]||'';return cls?svg.replace('class="ui-icon ','class="ui-icon '+cls+' '):svg;}
const $=id=>document.getElementById(id);
function toast(msg,api){const t=$('toast');t.textContent=msg;t.className='show'+(api?' api':'');clearTimeout(t._t);t._t=setTimeout(()=>t.className='',1900);}
const actionBusy = Object.create(null);
function setActionStatus(type,msg,sticky){const box=$('actionStatus');if(!box)return;const icon=type==='loading'?'<span class="spin"></span>':`<span class="icon">${type==='success'?'✓':'✕'}</span>`;box.innerHTML=icon+`<span class="action-status-message">${esc(msg||'')}</span>`;box.className=`show ${type}`;clearTimeout(box._t);if(!sticky)box._t=setTimeout(()=>box.className='',2200);}
function updateActionStatusMessage(msg){const box=$('actionStatus');if(!box)return false;const el=box.querySelector('.action-status-message');if(!el)return false;el.textContent=String(msg==null?'':msg);return true;}
try{window.updateActionStatusMessage=updateActionStatusMessage;}catch(_e){}
function actionLock(key,btn){if(actionBusy[key]){setActionStatus('loading','正在处理中，请勿重复点击…',false);return false;}actionBusy[key]=1;if(btn){btn.classList.add('is-busy');btn.dataset.busyKey=key;}return true;}
function actionUnlock(key){delete actionBusy[key];document.querySelectorAll(`[data-busy-key="${key}"]`).forEach(el=>{el.classList.remove('is-busy');el.removeAttribute('data-busy-key');});}
function actionDone(key,msg){actionUnlock(key);setActionStatus('success',msg||'操作成功',false);}
function actionFail(key,msg){actionUnlock(key);setActionStatus('error',msg||'操作失败',false);}
function withAction(key,loadingMsg,successMsg,failMsg,fn,btn){if(!actionLock(key,btn))return Promise.resolve(null);setActionStatus('loading',loadingMsg,true);return Promise.resolve().then(fn).then(res=>{actionDone(key,successMsg);return res;}).catch(err=>{console.error(err);actionFail(key,failMsg+(err&&err.message?('：'+err.message):''));return null;});}


/* 统一柔和点击动效。仅作用于网页 UI 元素，不修改线框图片本身。 */
const UI_MOTION_SELECTOR='.btn,.tbtn,.mini-btn,.stopbtn,.countbtn,.seg button,.vtab,.vchip,.examples button,.float-full,.nav a,.upl,.uptile,.addcat,.catitem,.wfimg,.framemod,.subtitle-option,.ccard,.tcard .inner[data-k],.adjust-presets button,.adjust-crops button,.adjust-brush-select,.adjust-brush-tool';
const UI_SELECT_SELECTOR='.vtab,.vchip,.seg button,.nav a,.catitem,.wfimg,.framemod,.subtitle-option,.ccard,.adjust-presets button,.adjust-crops button,.adjust-brush-select,.adjust-brush-tool';
function uiReducedMotion(){return !!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);}
function uiRestartAnimation(el,cls){
  if(!el||uiReducedMotion())return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(()=>el.classList.remove(cls),320);
}
function uiAddRipple(el,ev){
  if(!el||uiReducedMotion())return;
  const rect=el.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  const ripple=document.createElement('span');
  const diameter=Math.max(28,Math.min(Math.max(rect.width,rect.height)*.72,88));
  let rippleKind='';
  if(el.matches('.btn-violet,.btn-blue,.btn-emerald,.seg button.on,.countbtn.on,.vtab.on,.vchip.on')) rippleKind=' ripple-ring';
  else if(el.matches('.tcard .inner[data-k],.wfimg,.upl,.uptile,.framemod,.ccard,.subtitle-option')) rippleKind=' ripple-chromatic';
  else if(el.matches('.nav a,.btn,.tbtn,.mini-btn,.stopbtn,.countbtn,.float-full')) rippleKind=el.matches('.nav a.active,.btn-violet,.btn-blue,.btn-emerald')?' ripple-light':'';
  ripple.className='ui-ripple'+rippleKind;
  ripple.style.width=diameter+'px';
  ripple.style.height=diameter+'px';
  ripple.style.left=(ev.clientX-rect.left)+'px';
  ripple.style.top=(ev.clientY-rect.top)+'px';
  el.appendChild(ripple);
  window.setTimeout(()=>ripple.remove(),560);
}
document.addEventListener('pointerdown',ev=>{
  // V24.5：品类编辑/删除属于行内独立操作，不触发父级品类项的按压动画。
  if(ev.target.closest&&ev.target.closest('.catitem .act'))return;
  const el=ev.target.closest&&ev.target.closest(UI_MOTION_SELECTOR);
  if(!el||el.matches(':disabled'))return;
  uiAddRipple(el,ev);
  uiRestartAnimation(el,'ui-soft-press');
},true);
document.addEventListener('click',ev=>{
  // 避免点击铅笔/删除按钮时把整个品类行误判为“切换品类”。
  if(ev.target.closest&&ev.target.closest('.catitem .act'))return;
  const el=ev.target.closest&&ev.target.closest(UI_SELECT_SELECTOR);
  if(!el)return;
  window.setTimeout(()=>uiRestartAnimation(el,'ui-soft-select'),18);
},true);
function setupFullscreen(){
  const b=document.getElementById('openFull');
  if(!b)return;
  b.onclick=async()=>{
    try{
      if(document.fullscreenElement){await document.exitFullscreen(); b.textContent='⛶ 全屏查看';}
      else{await document.documentElement.requestFullscreen(); b.textContent='⛶ 退出全屏';}
    }catch(e){window.open(location.href,'_blank');}
  };
  document.addEventListener('fullscreenchange',()=>{b.textContent=document.fullscreenElement?'⛶ 退出全屏':'⛶ 全屏查看';});
}
setupFullscreen();

function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
const LOCK='<svg class="lock" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd"/></svg>';
