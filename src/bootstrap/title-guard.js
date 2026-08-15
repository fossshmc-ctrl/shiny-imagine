
(function(){
  'use strict';
  const APP_TITLE='V29.1 · 图灵线框工作台';
  window.__APP_TITLE__=APP_TITLE;
  let applying=false;
  function applyAppTitle(){
    if(applying)return;
    applying=true;
    try{
      let titleNode=document.head&&document.head.querySelector('title');
      if(!titleNode&&document.head){titleNode=document.createElement('title');document.head.appendChild(titleNode);}
      if(titleNode&&titleNode.textContent!==APP_TITLE)titleNode.textContent=APP_TITLE;
    }finally{applying=false;}
  }
  window.__SET_APP_TITLE__=applyAppTitle;
  applyAppTitle();
  function installTitleGuard(){
    applyAppTitle();
    if(!document.head)return;
    const observer=new MutationObserver(applyAppTitle);
    observer.observe(document.head,{childList:true,subtree:true,characterData:true});
    window.__APP_TITLE_OBSERVER__=observer;
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installTitleGuard,{once:true});
  else installTitleGuard();
})();
