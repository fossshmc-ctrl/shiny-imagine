/* V27.9 Smart Region AI prompt bridge.
 * Every selected region receives one explicit priority instruction. A manual
 * correction on one region must never hide the automatic instruction of the
 * remaining OCR regions or of a freely added region.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.RegionAiPromptV279=api;
    root.RegionAiPromptV278=api;
    root.RegionAiPromptV273=api;
    root.RegionAiPromptV271=api;
  }
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const VERSION='V28.1.1';
  const AUTO_MARKER=/(?:^|\n\n)【V(?:17|18|19|20|21|22|23|24|25|26|27)(?:\.[0-9]+)?\s*实时参数(?:（自动更新(?:，请勿手改)?）)?】\n/;

  function clean(value){return String(value==null?'':value).replace(/\r\n/g,'\n').trim();}
  function box(value){
    const v=value||{};
    const x=Math.max(0,Math.min(1,Number(v.x)||0));
    const y=Math.max(0,Math.min(1,Number(v.y)||0));
    const width=Math.max(0,Math.min(1-x,Number(v.width)||0));
    const height=Math.max(0,Math.min(1-y,Number(v.height)||0));
    return{x,y,width,height};
  }
  function sameBox(a,b,eps=1e-5){
    a=box(a);b=box(b);
    return Math.abs(a.x-b.x)<=eps&&Math.abs(a.y-b.y)<=eps&&Math.abs(a.width-b.width)<=eps&&Math.abs(a.height-b.height)<=eps;
  }
  function pct(n){return(Number(n||0)*100).toFixed(1)+'%';}
  function generatedGeometryPrompt(value){
    const text=clean(value);
    return /^(?:仅修改区域|修改区域)/.test(text)&&/(?:原始位置|原始区域左上角坐标)/.test(text)&&/(?:目标位置|目标区域左上角|目标保持不变)/.test(text);
  }
  function splitPrompt(value){
    const text=clean(value);
    if(!text)return{manual:'',auto:'',fullOverride:''};
    const parts=text.split(AUTO_MARKER);
    if(parts.length>1)return{manual:clean(parts.shift()),auto:clean(parts.join('\n')),fullOverride:''};
    if(generatedGeometryPrompt(text))return{manual:'',auto:text,fullOverride:''};
    return{manual:text,auto:'',fullOverride:''};
  }
  function userIntent(task){
    const explicit=clean(task&&task.userInstruction);if(explicit)return explicit;
    const full=clean(task&&task.fullPromptOverride);if(full)return full;
    const split=splitPrompt(task&&task.instruction);return split.manual||'';
  }
  function effectiveInstruction(task){
    const full=clean(task&&task.fullPromptOverride);if(full)return full;
    return clean(task&&task.instruction)||userIntent(task);
  }
  function taskName(task,index){const ordinal=Number.isInteger(index)?index+1:1;return clean(task&&task.name)||clean(task&&task.regionId)||('区域'+ordinal);}
  function modeLabel(mode){
    if(mode==='move_and_repair')return'移动主体并修复原位置';
    if(mode==='local_regenerate')return'重新生成当前区域';
    return'按目标框执行位置/尺寸变换';
  }
  function defaultTaskInstruction(task,index){
    return `必须处理已选区域“${taskName(task,index)}”，按照它的 source/target 坐标、Mask、区域类型和“${modeLabel(task&&task.executionMode)}”执行；其他未选区域保持不变。`;
  }
  function taskPrimaryInstruction(task,index,fallbackInstructions){
    const manual=userIntent(task);
    if(manual)return{text:manual,source:'user'};
    const effective=effectiveInstruction(task);
    if(effective)return{text:effective,source:'effective'};
    const fallbackIndex=Number.isInteger(index)?index:0;
    const fallback=clean(Array.isArray(fallbackInstructions)?fallbackInstructions[fallbackIndex]:'');
    if(fallback)return{text:fallback,source:'fallback'};
    return{text:defaultTaskInstruction(task,index),source:'generated-default'};
  }
  function taskInstruction(task,index,fallbackInstructions){return taskPrimaryInstruction(task,index,fallbackInstructions).text;}
  function priorityEntries(tasks,fallbackInstructions){
    const list=(Array.isArray(tasks)?tasks:[]).filter(Boolean);
    if(list.length){
      return list.map((task,index)=>{
        const primary=taskPrimaryInstruction(task,index,fallbackInstructions);
        return `${index+1}. 【${taskName(task,index)}】${primary.text}`;
      });
    }
    return(Array.isArray(fallbackInstructions)?fallbackInstructions:[]).map(clean).filter(Boolean).map((text,index)=>`${index+1}. ${text}`);
  }
  function regionLine(task,index){
    const s=box(task&&task.sourceBBox),t=box(task&&task.targetBBox||task&&task.sourceBBox),name=taskName(task,index);
    const moved=!sameBox(s,t);
    return `${index+1}. ${name}（${clean(task&&task.type)||'区域'} / ${modeLabel(task&&task.executionMode)}）：原区域 X ${pct(s.x)}、Y ${pct(s.y)}、W ${pct(s.width)}、H ${pct(s.height)}；${moved?`目标区域 X ${pct(t.x)}、Y ${pct(t.y)}、W ${pct(t.width)}、H ${pct(t.height)}`:'目标区域保持原位置与尺寸'}。`;
  }
  function compactTask(task,index,fallbackInstructions){
    const primary=taskPrimaryInstruction(task,index,fallbackInstructions);
    return{
      region_id:task&&task.regionId||'',
      name:task&&task.name||'',
      type:task&&task.type||'',
      brush_id:task&&task.brushId||'',
      execution_mode:task&&task.executionMode||'direct_transform',
      prompt_source:primary.source,
      user_instruction:userIntent(task),
      instruction:effectiveInstruction(task)||primary.text,
      source:box(task&&task.sourceBBox),
      target:box(task&&task.targetBBox||task&&task.sourceBBox),
      preserve:Array.isArray(task&&task.preserve)?task.preserve:[],
      repair:task&&task.repair||{},
      lock_aspect_ratio:!!(task&&task.lockAspectRatio),
      manual_created:!!(task&&task.manualCreated)
    };
  }

  function textFidelityEntries(tasks){
    const list=(Array.isArray(tasks)?tasks:[]).filter(t=>t&&(
      String(t.type||'').toLowerCase()==='text' ||
      !!t.textEdited ||
      /必须(?:删除|在该文字区域准确写入|将该文字区域原文)/.test(String(t.userInstruction||t.instruction||''))
    ));
    if(!list.length)return[];
    return list.map((task,index)=>{
      const name=taskName(task,index),instruction=clean(task.userInstruction||task.instruction||task.suggestedInstruction||'');
      return `${index+1}. 【${name}】${instruction||'这是文字区域：必须修改文字内容，不得只做位置/尺寸处理。'}`;
    });
  }
  function textFidelityPrompt(tasks){
    const entries=textFidelityEntries(tasks);
    if(!entries.length)return'';
    return `

【文字内容强制执行｜V28.1.1】
以下区域属于文字编辑任务。文字内容不是参考建议，而是必须落实的确定性目标。
${entries.join('\n')}

强制规则：
- 引号内的新文案必须逐字输出，禁止改写、同义替换、翻译、漏字、增字、自动补标点或自行润色。
- 如果要求删除原文，结果中不得保留原文残片或相似旧字。
- 文字的字体、字号、颜色、字距、行距、对齐和清晰度尽量继承原图；只改变明确要求改变的文字内容。
- 必须让文字区域产生实际可见变化；不能因为整图其它内容没有变化而返回与输入近似相同的图片。
- 先读取原图中的目标文字，再按上述精确文案执行；不要把提示词、坐标、Mask 或任何工作台标记绘制到结果中。`;
  }
  function referenceInstructions(opts){
    const merged=opts.referencePlan==='fast-v278'||opts.referencePlan==='fast-v277';
    if(merged)return opts.hasTargetLayoutGuide?'2. 第2张参考图：目标布局 + 编辑范围合并引导图。底层内容是工作台按 source → target 坐标确定性合成的目标布局预演；青色半透明覆盖区是允许修改的 source + target 合并范围。必须按预演执行位置与尺寸，但不得把青色蒙层、框线或引导痕迹复制到结果。':'2. 第2张参考图：编辑范围合并引导图。青色区域表示允许修改，黑色/暗色区域应尽量保持；不得把青色蒙层或引导痕迹复制到结果。';
    if(opts.referencePlan==='fast-v2731')return opts.hasTargetLayoutGuide?'2. 第2张参考图：目标布局预演图。它由工作台按 source → target 坐标确定性合成，必须优先按照它执行位置与尺寸。\n3. 第3张参考图：source + target 合并编辑 Mask。白色/灰色代表允许修改范围，黑色代表应保持不变。':'2. 第2张参考图：source + target 合并编辑 Mask。白色/灰色代表允许修改范围，黑色代表应保持不变。';
    return opts.hasTargetLayoutGuide?'2. 第2张参考图：目标布局预演图。它由工作台按 source → target 坐标确定性合成，必须优先按照它执行位置与尺寸；其中原位置残影表示待清除 source，不代表最终保留重复主体。\n3. 第3张参考图：区域定位/标注参考，只用于识别 source 与 target，不得把彩色标注、框线、标签复制到结果。\n4. 后续参考图：编辑 Mask。白色/灰色代表允许修改范围，黑色代表应保持不变。':'2. 第2张参考图：区域定位/标注参考，只用于识别 source 与 target，不得把彩色标注、框线、标签复制到结果。\n3. 后续参考图：编辑 Mask。白色/灰色代表允许修改范围，黑色代表应保持不变。';
  }
  function buildGenerationPrompt(opts){
    opts=opts||{};
    const tasks=(Array.isArray(opts.tasks)?opts.tasks:[]).filter(Boolean);
    const fallback=(Array.isArray(opts.fallbackInstructions)?opts.fallbackInstructions:[]).map(clean);
    const priority=priorityEntries(tasks,fallback);
    const geometry=tasks.length?tasks.map(regionLine).join('\n'):'无结构化区域任务，仅按下面的文字修改要求和 Mask 执行。';
    const taskJson=tasks.length?JSON.stringify(tasks.map((task,index)=>compactTask(task,index,fallback)),null,2):'[]';
    const textFidelity=textFidelityPrompt(tasks);
    return `你是电商图片的“精确局部编辑执行器”。这不是重新设计整张图，而是在原图上执行局部编辑。\n\n【最高优先级：AI 修改指令】\n${priority.length?priority.join('\n'):'1. 严格执行当前区域的几何与局部编辑要求。'}\n\n重要：每个已选区域都必须执行。不得因为其中某个区域存在手工文案要求而忽略其他自动区域或自由添加区域。AI 修改指令优先级高于下面的自动坐标说明；坐标、Mask 和参考图只用于帮助准确定位与执行，不得削弱、忽略或改写任何已选区域的指令。\n\n【区域定位与几何执行】\n${geometry}\n\n【参考图顺序】\n1. 第1张参考图：原始图片，是最终视觉内容、文字、品牌、产品外观和整体风格的唯一基准。\n${referenceInstructions(opts)}${textFidelity}${textFidelityEntries(tasks).length?'\n\n【文字放大参考图顺序｜V28.1.1】\n原图之后若存在文字放大参考图，它们按已选文字区域顺序排列；这些图只用于确认原始字符形状、笔画和目标文案，不代表最终排版尺寸。必须优先读取这些放大参考图中的字符，不得把参考图边框或裁剪痕迹复制到结果。':''}\n\n【移动 / 缩放 / 重排规则】\n- 若 source 与 target 不同，允许同时修改“原始区域 + 目标区域”；必须从原位置移除主体并自然修复原位置，再把同一主体放入目标区域。\n- 不能只在目标区域复制一份主体而保留原位置的重复主体。\n- 移动或缩放时保持主体身份、包装文字、产品造型、人物/宠物特征、材质与视角一致，除非 AI 修改指令明确要求改变这些内容。\n- 目标区域的位置与尺寸要尽量匹配坐标，不要自行把主体移回原位置。\n- 这是可回归检测的几何任务：若 source 与 target 不同，最终结果必须在 source 或 target 区域产生可观察到的变化；不得返回近似原图来规避修改。\n- 若目标布局预演图存在，几何位置与尺寸以预演图为优先视觉证据，坐标说明用于校验。\n\n【严格保护】\n- 未被 source/target 编辑包络和 Mask 覆盖的区域尽量保持与原图一致。\n- 保持画布尺寸、整体版式、未指定文字、品牌标识、未指定产品与背景不变。\n- 不得输出提示词、坐标、Mask、框线、颜色标记或解释文字。\n- Mask 羽化 ${Number(opts.maskFeather||0)}px；扩张/收缩 ${Number(opts.maskExpand||0)}px。\n\n【结构化区域任务】\n${taskJson}`;
  }
  function envelope(task){return{source:box(task&&task.sourceBBox),target:box(task&&task.targetBBox||task&&task.sourceBBox),moved:!sameBox(task&&task.sourceBBox,task&&task.targetBBox||task&&task.sourceBBox)};}

  return{
    VERSION,AUTO_MARKER,clean,box,sameBox,splitPrompt,userIntent,effectiveInstruction,
    taskPrimaryInstruction,taskInstruction,taskName,priorityEntries,textFidelityEntries,textFidelityPrompt,buildGenerationPrompt,
    envelope,compactTask
  };
});
