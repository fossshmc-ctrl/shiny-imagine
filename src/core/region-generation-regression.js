/* V27.9 region-generation regression guard.
 * Verifies that mixed manual/automatic/free-added Smart Region tasks reach the
 * billed micro prompt without treating JSON-escaped auto geometry as missing.
 * Pixel checks remain non-billing and never trigger an automatic resubmission.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.RegionGenerationRegressionV279=api;root.RegionGenerationRegressionV278=api;root.RegionGenerationRegressionV273=api;root.RegionGenerationRegression=api;}
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='V28.1.1';
  const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
  function decodePromptText(value){
    return String(value==null?'':value)
      .replace(/\\u([0-9a-f]{4})/gi,(_m,h)=>{try{return String.fromCharCode(parseInt(h,16));}catch(_e){return _m;}})
      .replace(/\\r\\n|\\n|\\r/g,'\n').replace(/\\t/g,' ').replace(/\\"/g,'"').replace(/\\\\/g,'\\');
  }
  function normalizeMatch(value){return clean(decodePromptText(value)).toLowerCase().replace(/[，。；：、,.!！?？“”‘’'"`~·\\/\s【】（）()［］\[\]{}<>《》:_—-]/g,'');}
  function box(value){const v=value||{},x=Math.max(0,Math.min(1,Number(v.x)||0)),y=Math.max(0,Math.min(1,Number(v.y)||0)),width=Math.max(0,Math.min(1-x,Number(v.width)||0)),height=Math.max(0,Math.min(1-y,Number(v.height)||0));return{x,y,width,height};}
  function sameBox(a,b,eps=1e-4){a=box(a);b=box(b);return Math.abs(a.x-b.x)<=eps&&Math.abs(a.y-b.y)<=eps&&Math.abs(a.width-b.width)<=eps&&Math.abs(a.height-b.height)<=eps;}
  function hash(value){let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return('00000000'+(h>>>0).toString(16)).slice(-8);}
  function compactTask(task){
    const source=box(task&&task.sourceBBox),target=box(task&&task.targetBBox||task&&task.sourceBBox);
    return{regionId:clean(task&&task.regionId),name:clean(task&&task.name),type:clean(task&&task.type),brushId:clean(task&&task.brushId),userInstruction:clean(task&&task.userInstruction),instruction:clean(task&&task.instruction),suggestedInstruction:clean(task&&task.suggestedInstruction),textEdited:!!(task&&task.textEdited),origin:clean(task&&task.origin||task&&task.source),manualCreated:!!(task&&task.manualCreated),sourceBBox:source,targetBBox:target,moved:!sameBox(source,target)};
  }
  function createExpectation(tasks,prompt,meta){
    const list=(Array.isArray(tasks)?tasks:[]).filter(Boolean).map(compactTask),payload={version:VERSION,tasks:list,promptHash:hash(prompt),changedGeometryCount:list.filter(x=>x.moved).length,instructionCount:list.filter(x=>x.userInstruction||x.instruction||x.suggestedInstruction).length,meta:meta||{}};
    payload.fingerprint=hash(JSON.stringify(payload));return payload;
  }
  function fuzzyIncludes(haystack,needle){
    const h=normalizeMatch(haystack),n=normalizeMatch(needle);if(!n)return true;
    const probe=n.slice(0,Math.min(n.length,48));
    if(h.includes(probe))return true;
    if(n.length>64){const tail=n.slice(-Math.min(n.length,32));return h.includes(n.slice(0,28))&&h.includes(tail);}
    return false;
  }
  function generatedGeometryInstruction(value){
    const text=clean(value);
    return /^(?:仅修改区域|修改区域)/.test(text)&&/(?:原始位置|原始区域左上角坐标)/.test(text)&&/(?:目标位置|目标区域左上角|目标保持不变)/.test(text);
  }
  function taskIdentityCandidates(task){
    const id=clean(task&&task.regionId),name=clean(task&&task.name),out=[];
    if(id)out.push(`区域任务ID：${id}`,`"region_id":"${id}"`,id);
    if(name)out.push(`【${name}】`,name);
    return [...new Set(out.filter(Boolean))];
  }
  function identityIncluded(prompt,task){return taskIdentityCandidates(task).some(value=>fuzzyIncludes(prompt,value));}
  function verifyBridge(expectation,tasks,prompt){
    const exp=expectation||createExpectation(tasks,prompt),actual=(Array.isArray(tasks)?tasks:[]).filter(Boolean).map(compactTask),issues=[],missingInstructionRegionIds=[],checks=[];
    if(!actual.length)issues.push('微调通道没有收到结构化区域任务');
    for(const e of exp.tasks||[]){
      const label=e.name||e.regionId||'未命名',a=actual.find(x=>x.regionId&&x.regionId===e.regionId)||actual.find(x=>x.name&&x.name===e.name);
      if(!a){issues.push(`区域 ${label} 未进入微调任务`);continue;}
      if(e.moved&&sameBox(a.sourceBBox,a.targetBBox))issues.push(`区域 ${label} 的目标位置/尺寸变化在同步后丢失`);
      const explicit=clean(e.userInstruction),effective=clean(e.instruction||e.suggestedInstruction),identityOk=identityIncluded(prompt,e);
      let instructionOk=true,mode='identity+auto-geometry';
      if(explicit){mode='explicit-user-instruction';instructionOk=fuzzyIncludes(prompt,explicit);}
      else if(effective&&!generatedGeometryInstruction(effective)){mode='custom-instruction';instructionOk=fuzzyIncludes(prompt,effective);}
      else instructionOk=identityOk;
      checks.push({regionId:e.regionId,name:e.name,mode,identityOk,instructionOk});
      if(!instructionOk){missingInstructionRegionIds.push(e.regionId||e.name||'');issues.push(`区域 ${label} 的 AI 修改指令没有进入最终生图 Prompt`);}
      else if(!identityOk){missingInstructionRegionIds.push(e.regionId||e.name||'');issues.push(`区域 ${label} 的任务身份没有进入最终生图 Prompt`);}
      if(e.textEdited && !/文字内容强制执行/.test(String(prompt||''))){missingInstructionRegionIds.push(e.regionId||e.name||'');issues.push(`区域 ${label} 是文字编辑任务，但最终 Prompt 缺少 V28.1.1 文字强制执行段`);}
    }
    if((exp.changedGeometryCount||0)>0&&!/(目标区域|target|目标位置|TARGET)/i.test(String(prompt||'')))issues.push('最终 Prompt 缺少目标区域几何约束');
    if(!/最高优先级：AI 修改指令/.test(String(prompt||'')))issues.push('最终 Prompt 缺少“AI 修改指令最高优先级”约束');
    return{ok:issues.length===0,issues,missingInstructionRegionIds:[...new Set(missingInstructionRegionIds.filter(Boolean))],checks,fingerprint:exp.fingerprint,taskCount:actual.length,changedGeometryCount:exp.changedGeometryCount||0};
  }
  async function sourceBlob(src){const s=String(src||'').trim();if(!s)throw new Error('缺少回归检测图片');if(typeof fetch!=='function')throw new Error('当前环境不支持回归检测');let url=s;if(/^https?:\/\//i.test(s)&&typeof location!=='undefined'){try{const u=new URL(s,location.href);if(u.origin!==location.origin)url='/api/image-export/source?url='+encodeURIComponent(s);}catch(_e){}}const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(`读取回归检测图片失败（HTTP ${res.status}）`);return res.blob();}
  async function imageFromBlob(blob){if(typeof createImageBitmap==='function')return createImageBitmap(blob);return new Promise((resolve,reject)=>{const u=URL.createObjectURL(blob),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('回归检测图片解码失败'));};img.src=u;});}
  function regionDiff(A,B,w,h,b){b=box(b);const x0=Math.max(0,Math.floor(b.x*w)),y0=Math.max(0,Math.floor(b.y*h)),x1=Math.min(w,Math.ceil((b.x+b.width)*w)),y1=Math.min(h,Math.ceil((b.y+b.height)*h));let sum=0,n=0,changed=0;const stride=Math.max(1,Math.ceil(Math.sqrt((w*h)/180000)));for(let y=y0;y<y1;y+=stride)for(let x=x0;x<x1;x+=stride){const i=(y*w+x)*4,d=(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2]))/765;sum+=d;n++;if(d>.055)changed++;}return{delta:n?sum/n:0,changedRatio:n?changed/n:0,samples:n};}
  function unionBox(a,b){a=box(a);b=box(b);const x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),r=Math.max(a.x+a.width,b.x+b.width),d=Math.max(a.y+a.height,b.y+b.height);return{x,y,width:Math.max(0,r-x),height:Math.max(0,d-y)};}
  async function analyzeImages(beforeSrc,afterSrc,tasks,opts){opts=opts||{};if(typeof document==='undefined')return{available:false,status:'unavailable',pass:true,message:'当前环境无法执行像素回归检测'};const [bb,ab]=await Promise.all([sourceBlob(beforeSrc),sourceBlob(afterSrc)]),[before,after]=await Promise.all([imageFromBlob(bb),imageFromBlob(ab)]);const bw=before.width||before.naturalWidth,bh=before.height||before.naturalHeight,aw=after.width||after.naturalWidth,ah=after.height||after.naturalHeight;if(!bw||!bh||!aw||!ah)throw new Error('回归检测图片尺寸无效');const maxSide=Math.max(160,Math.min(520,Number(opts.maxSide)||420)),scale=Math.min(1,maxSide/Math.max(bw,bh)),w=Math.max(1,Math.round(bw*scale)),h=Math.max(1,Math.round(bh*scale)),c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(before,0,0,w,h);const A=ctx.getImageData(0,0,w,h).data;ctx.clearRect(0,0,w,h);ctx.drawImage(after,0,0,w,h);const B=ctx.getImageData(0,0,w,h).data;try{before.close?.();after.close?.();}catch(_e){}
    const list=(Array.isArray(tasks)?tasks:[]).filter(Boolean).map(compactTask),regions=list.map(t=>{const envelope=unionBox(t.sourceBBox,t.targetBBox),inside=regionDiff(A,B,w,h,envelope),source=regionDiff(A,B,w,h,t.sourceBBox),target=regionDiff(A,B,w,h,t.targetBBox);return{regionId:t.regionId,name:t.name,moved:t.moved,inside,source,target};});const full=regionDiff(A,B,w,h,{x:0,y:0,width:1,height:1});let status='passed',message='生成结果已通过区域回归检测';const failures=[],warnings=[];if(full.delta<.0015)failures.push('生成结果与原图几乎没有变化');for(const r of regions){if(r.moved&&r.inside.delta<.007&&r.inside.changedRatio<.06)failures.push(`${r.name||r.regionId||'目标区域'} 的移动/缩放变化过小，疑似未执行 AI 修改指令`);else if(!r.moved&&r.inside.delta<.0035)warnings.push(`${r.name||r.regionId||'目标区域'} 的局部变化较小，请人工确认指令是否生效`);if(r.moved&&r.source.delta<.003&&r.target.delta<.003)failures.push(`${r.name||r.regionId||'目标区域'} 的 source/target 两端都缺少有效变化`);}if(failures.length){status='failed';message=failures.join('；');}else if(warnings.length){status='warning';message=warnings.join('；');}return{available:true,status,pass:status!=='failed',message,failures,warnings,metrics:{fullDelta:Number(full.delta.toFixed(4)),fullChangedRatio:Number(full.changedRatio.toFixed(4)),regions:regions.map(r=>({regionId:r.regionId,name:r.name,moved:r.moved,insideDelta:Number(r.inside.delta.toFixed(4)),insideChangedRatio:Number(r.inside.changedRatio.toFixed(4)),sourceDelta:Number(r.source.delta.toFixed(4)),targetDelta:Number(r.target.delta.toFixed(4))}))}};
  }
  return{VERSION,clean,decodePromptText,normalizeMatch,box,sameBox,hash,compactTask,createExpectation,fuzzyIncludes,generatedGeometryInstruction,taskIdentityCandidates,identityIncluded,verifyBridge,analyzeImages};
});
