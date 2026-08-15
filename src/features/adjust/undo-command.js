
(function(){
  if(typeof adjustState==='undefined'||typeof renderAdjustView!=='function')return;
  const IDS=(typeof ADJUST_BRUSH_DEFS!=='undefined'?ADJUST_BRUSH_DEFS:[]).map(x=>x.id);
  function ensure145(){
    adjustState.v145ComboExpanded=adjustState.v145ComboExpanded||{};
    adjustState.v145CommandTab=adjustState.v145CommandTab||{};
    IDS.forEach(id=>{
      if(typeof adjustState.v145ComboExpanded[id]!=='boolean')adjustState.v145ComboExpanded[id]=false;
      if(!['templates','presets'].includes(adjustState.v145CommandTab[id]))adjustState.v145CommandTab[id]='templates';
    });
  }
  function isEditableTarget(target){
    if(!target)return false;
    const tag=String(target.tagName||'').toLowerCase();
    return target.isContentEditable||tag==='input'||tag==='textarea'||tag==='select'||!!target.closest?.('[contenteditable="true"]');
  }
  function travelHistory(delta){
    if(!adjustState.img||!Array.isArray(adjustState.history)||!adjustState.history.length){setActionStatus('error','当前没有可撤销或重做的图片微调记录',false);return;}
    const old=Number(adjustState.historyIndex||0),target=Math.max(0,Math.min(adjustState.history.length-1,old+delta));
    if(target===old){setActionStatus('error',delta<0?'已经是最早记录':'已经是最新记录',false);return;}
    adjustState.historyIndex=target;
    adjustRestoreSnapshot(adjustState.history[target]);
    if(typeof adjustRefreshHistoryButtons==='function')adjustRefreshHistoryButtons();
    const moved=Math.abs(target-old),verb=delta<0?'撤回':'重做';
    setActionStatus('success',`已${verb} ${moved} 步（历史 ${target+1}/${adjustState.history.length}）`,false);
  }
  function shortcutHint(){
    const box=document.createElement('div');box.className='v145-shortcut-hint';
    box.innerHTML='<b>撤销快捷键</b><span><kbd>Ctrl/⌘ + Z</kbd> 1 步</span><span><kbd>Ctrl/⌘ + Alt + Z</kbd> 5 步</span><span><kbd>Ctrl/⌘ + Shift + Z</kbd> 重做</span><span><kbd>Ctrl/⌘ + Shift + Alt + Z</kbd> 快速重做</span>';
    return box;
  }
  function enhanceCombo(panel,id){
    const box=panel.querySelector('.v144-combo-summary');if(!box||box.dataset.v145Enhanced==='1')return;
    box.dataset.v145Enhanced='1';box.classList.add('v145-combo-summary');
    const order=box.querySelector('.v144-combo-order'),chips=order?[...order.querySelectorAll('.v144-order-chip')]:[];
    if(!chips.length){box.classList.add('v145-combo-empty');return;}
    const labels=chips.map(x=>x.querySelector('span')?.textContent.trim()).filter(Boolean),expanded=!!adjustState.v145ComboExpanded[id];
    const oldClear=box.querySelector('[data-v144-clear]');
    const compact=document.createElement('div');compact.className='v145-combo-compact';
    const copy=document.createElement('div');copy.className='v145-combo-copy';
    const title=document.createElement('div');title.className='v145-combo-title';title.innerHTML=`已选组合 <span class="v145-combo-count">${chips.length} 步</span>`;
    const line=document.createElement('span');line.className='v145-combo-line';line.textContent=labels.join(' → ');line.title=labels.join(' → ');
    copy.append(title,line);
    const actions=document.createElement('div');actions.className='v145-combo-actions';
    const toggle=document.createElement('button');toggle.type='button';toggle.className='v145-combo-toggle';toggle.dataset.v145ComboToggle=id;toggle.setAttribute('aria-expanded',String(expanded));toggle.textContent=expanded?'收起排序':'展开排序';actions.append(toggle);
    if(oldClear)actions.append(oldClear);
    compact.append(copy,actions);
    const drawer=document.createElement('div');drawer.className='v145-combo-drawer';drawer.dataset.v145ComboDrawer=id;drawer.hidden=!expanded;
    const note=document.createElement('div');note.className='v145-combo-drawer-note';note.textContent='拖拽下方步骤可改变执行顺序，完整提示词会实时同步。';drawer.append(note,order);
    box.innerHTML='';box.append(compact,drawer);
  }
  function mergeCommandPanel(panel,id){
    const sections=[...panel.querySelectorAll('.v144-section')];
    const preset=sections.find(x=>x.querySelector('.v144-section-head b')?.textContent.includes('完整组合预设'));
    const library=sections.find(x=>x.querySelector('.v144-section-head b')?.textContent.includes('统一模板选择器'));
    if(!preset||!library||panel.querySelector('[data-v145-command-panel]'))return;
    const active=adjustState.v145CommandTab[id]||'templates';
    const command=document.createElement('section');command.className='v145-command-panel';command.dataset.v145CommandPanel=id;
    const tabs=document.createElement('div');tabs.className='v145-command-tabs';
    for(const [key,label] of [['templates','模板'],['presets','预设']]){const b=document.createElement('button');b.type='button';b.className='v145-command-tab'+(active===key?' on':'');b.dataset.v145CommandTab=key;b.dataset.brushId=id;b.textContent=label;b.setAttribute('aria-selected',String(active===key));tabs.append(b);}
    const tplPane=document.createElement('div');tplPane.className='v145-command-pane';tplPane.dataset.v145CommandPane='templates';tplPane.hidden=active!=='templates';
    const prePane=document.createElement('div');prePane.className='v145-command-pane';prePane.dataset.v145CommandPane='presets';prePane.hidden=active!=='presets';
    while(library.firstChild)tplPane.append(library.firstChild);
    while(preset.firstChild)prePane.append(preset.firstChild);
    const meta=document.createElement('div');meta.className='v145-command-meta';meta.textContent='同一命令面板内切换模板库与完整组合预设，搜索、收藏、应用和保存功能保持不变。';
    command.append(tabs,tplPane,prePane,meta);
    preset.replaceWith(command);library.remove();
    const more=command.closest('details');if(more){const span=more.querySelector(':scope > summary span');if(span){const hasParam=!!more.querySelector('.v144-param-box');span.textContent=(hasParam?'组合参数 · ':'')+'模板／预设命令面板 · Mask';}}
  }
  function enhancePanel(){
    ensure145();
    const panels=[...document.querySelectorAll('.v14-right .v14-panel')],panel=panels.find(p=>p.querySelector('.v14-panel-head h3')?.textContent.trim()==='当前区域指令');if(!panel)return;
    const id=adjustState.activeBrush||'red';
    const head=panel.querySelector('.v14-panel-head');if(head&&!panel.querySelector('.v145-shortcut-hint'))head.insertAdjacentElement('afterend',shortcutHint());
    enhanceCombo(panel,id);mergeCommandPanel(panel,id);
    const note=panel.querySelector('.v144-combo-note');if(note)note.textContent='组合默认以“步骤数量 + 一行摘要”显示；需要调整顺序时点击“展开排序”。';
    const undo=document.querySelector('[data-adj-undo]'),redo=document.querySelector('[data-adj-redo]');
    if(undo)undo.title='Ctrl/⌘+Z 撤销 1 步；Ctrl/⌘+Alt+Z 快速撤回 5 步';
    if(redo)redo.title='Ctrl/⌘+Shift+Z 或 Ctrl/⌘+Y 重做；加 Alt 快速重做 5 步';
  }
  function setCommandTab(id,tab){
    ensure145();adjustState.v145CommandTab[id]=tab;
    const panel=document.querySelector(`[data-v145-command-panel="${id}"]`);if(!panel)return;
    panel.querySelectorAll('[data-v145-command-tab]').forEach(b=>{const on=b.dataset.v145CommandTab===tab;b.classList.toggle('on',on);b.setAttribute('aria-selected',String(on));});
    panel.querySelectorAll('[data-v145-command-pane]').forEach(p=>p.hidden=p.dataset.v145CommandPane!==tab);
  }

  const baseWorkspace=adjustWorkspaceHtml;adjustWorkspaceHtml=function(){
    let html=baseWorkspace();
    html=html.replace(/V14\.4/g,'V14.5');
    html=html.replace('修复推荐模板被顶替问题；新增拖拽排序、完整组合预设及统一搜索分类模板选择器。','新增 Ctrl+Z 快捷键组；已选组合默认紧凑显示，并将模板与预设合并为标签式命令面板。');
    return html;
  };
  const baseRender=renderAdjustView;renderAdjustView=function(){ensure145();baseRender();enhancePanel();};
  const basePayload=adjustProjectPayload;adjustProjectPayload=function(mode='full'){
    ensure145();const p=basePayload(mode);p.schema='ai_image_adjustment_project_v145';p.version='V14.5';p.state=p.state||{};
    p.state.v145ComboExpanded=JSON.parse(JSON.stringify(adjustState.v145ComboExpanded));p.state.v145CommandTab=JSON.parse(JSON.stringify(adjustState.v145CommandTab));p.state.v145ShortcutMode='ctrl_z_family';p.state.v145CommandPanelMode='template_preset_tabs';return p;
  };
  if(typeof adjustInstructionPayload==='function'){const baseInstruction=adjustInstructionPayload;adjustInstructionPayload=function(ids){const p=baseInstruction(ids);p.version='V14.5';p.regionTemplateMode='stable_multi_select_compact_command_tabs_v145';return p;};}
  if(typeof adjustSnapshot==='function'){const baseSnapshot=adjustSnapshot;adjustSnapshot=function(label){ensure145();const x=baseSnapshot(label);x.v145={comboExpanded:JSON.parse(JSON.stringify(adjustState.v145ComboExpanded)),commandTab:JSON.parse(JSON.stringify(adjustState.v145CommandTab))};return x;};}
  if(typeof adjustRestoreSnapshot==='function'){const baseRestore=adjustRestoreSnapshot;adjustRestoreSnapshot=function(x){baseRestore(x);if(x?.v145?.comboExpanded)adjustState.v145ComboExpanded=x.v145.comboExpanded;if(x?.v145?.commandTab)adjustState.v145CommandTab=x.v145.commandTab;ensure145();if(curView==='adjust')renderAdjustView();};}
  const baseImport=adjustImportProjectFile;adjustImportProjectFile=async function(file){let parsed=null;try{parsed=JSON.parse(await file.text());}catch(e){}await baseImport(file);if(parsed?.state?.v145ComboExpanded)adjustState.v145ComboExpanded=parsed.state.v145ComboExpanded;if(parsed?.state?.v145CommandTab)adjustState.v145CommandTab=parsed.state.v145CommandTab;ensure145();renderAdjustView();};
  if(typeof adjustResetRuntime==='function'){const baseReset=adjustResetRuntime;adjustResetRuntime=function(){baseReset();adjustState.v145ComboExpanded={};adjustState.v145CommandTab={};ensure145();};}
  if(typeof adjustOpenProjectSave==='function'){const baseOpen=adjustOpenProjectSave;adjustOpenProjectSave=function(){baseOpen();setTimeout(()=>{document.querySelectorAll('.modal h3,.modal-card h3').forEach(h=>{if(/保存 V14(?:\.1|\.2|\.3|\.4|\.5)? 微调项目/.test(h.textContent||''))h.textContent='保存 V14.5 微调项目';});},0);};}
  if(typeof adjustExportProject==='function'){adjustExportProject=function(mode){if(!mode){adjustOpenProjectSave();return;}const payload=adjustProjectPayload(mode),blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a'),base=(adjustState.name||'image').replace(/\.[^.]+$/,'').replace(/[\\/:*?"<>|]+/g,'-');a.href=URL.createObjectURL(blob);a.download=`${base}-微调项目-v14.5-${mode==='light'?'轻量':'完整'}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500);setActionStatus('success',mode==='light'?'V14.5 轻量项目已保存':'V14.5 完整项目已保存',false);};}

  document.addEventListener('click',e=>{
    if(curView!=='adjust')return;
    const combo=e.target.closest('[data-v145-combo-toggle]');if(combo){e.preventDefault();e.stopImmediatePropagation();const id=combo.dataset.v145ComboToggle;adjustState.v145ComboExpanded[id]=!adjustState.v145ComboExpanded[id];const drawer=document.querySelector(`[data-v145-combo-drawer="${id}"]`);if(drawer)drawer.hidden=!adjustState.v145ComboExpanded[id];combo.textContent=adjustState.v145ComboExpanded[id]?'收起排序':'展开排序';combo.setAttribute('aria-expanded',String(adjustState.v145ComboExpanded[id]));return;}
    const tab=e.target.closest('[data-v145-command-tab]');if(tab){e.preventDefault();e.stopImmediatePropagation();setCommandTab(tab.dataset.brushId,tab.dataset.v145CommandTab);return;}
  },true);
  document.addEventListener('keydown',e=>{
    if(curView!=='adjust'||!(e.ctrlKey||e.metaKey)||String(e.key).toLowerCase()!=='z'||isEditableTarget(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();
    const fast=!!e.altKey,redo=!!e.shiftKey;travelHistory(redo?(fast?5:1):(fast?-5:-1));
  },true);
  document.addEventListener('keydown',e=>{
    if(curView!=='adjust'||!(e.ctrlKey||e.metaKey)||String(e.key).toLowerCase()!=='y'||isEditableTarget(e.target))return;
    e.preventDefault();e.stopImmediatePropagation();travelHistory(1);
  },true);
  requestAnimationFrame(()=>{ensure145();if(curView==='adjust'){renderAdjustView();enhancePanel();}});
})();
