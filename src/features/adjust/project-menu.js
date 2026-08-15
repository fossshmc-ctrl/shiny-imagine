
(()=>{
  document.addEventListener('click',e=>{
    const item=e.target.closest('.v147-project-record-pop [data-adj-ai-history],.v147-project-record-pop [data-adj-project-save]');
    if(item){const menu=item.closest('details');if(menu)setTimeout(()=>{menu.open=false;},0);return;}
    document.querySelectorAll('.v147-project-record-menu[open]').forEach(menu=>{if(!menu.contains(e.target))menu.open=false;});
  },true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.v147-project-record-menu[open]').forEach(x=>x.open=false);},true);
})();
