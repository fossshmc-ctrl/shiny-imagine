/* V24.5 independent copy rule module. Browser globals are kept for legacy feature scripts. */
(function(root,factory){
  'use strict';
  const api=factory();
  Object.keys(api).forEach(key=>{ root[key]=api[key]; });
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

/* ============ 文案规则引擎（移植自 copy-generator.ts，本地生成，无需 API） ============ */
const STRATEGIES=['痛点直击','数据证言','成分科普','场景代入','对比优势','信任背书','情感共鸣','行动号召'];
function g(re,s){const m=s.match(re);return m&&m[1]?m[1].trim():'';}
function extract(input){
  const brand=g(/(?:品牌|产品名?|品名)[：:]\s*([^\n,，]+)/i,input);
  const category=g(/(?:品类|分类|类目)[：:]\s*([^\n,，]+)/i,input);
  const coreSP=[];const cm=input.match(/(?:王牌卖点|核心卖点|主打)[：:]?\s*(.+?)(?:\n|$)/i);
  if(cm)cm[1].split(/[,，、]/).forEach(s=>{const t=s.trim();if(t)coreSP.push(t);});
  const secSP=[];const sm=input.match(/(?:辅助卖点|其他卖点|补充)[：:]?\s*(.+?)(?:\n|$)/i);
  if(sm)sm[1].split(/[,，、]/).forEach(s=>{const t=s.trim();if(t)secSP.push(t);});
  const all=[...coreSP,...secSP];
  const bG=!brand?(input.split(/[，,：:]/)[0]||'').trim()||'产品':brand;
  const cG=!category?(input.split(/[，,：:]/)[1]||'').trim()||'商品':category;
  return{brand:bG||'产品',category:cG||'商品',core:coreSP.length?coreSP:all.slice(0,2),sec:secSP.length?secSP:all.slice(2),promotion:g(/(?:促销|优惠|活动)[：:]\s*([^\n]+)/i,input)};
}
function ensureThreeSubtitles(list,fallback){
  const out=[];
  (Array.isArray(list)?list:[]).forEach(x=>{const t=String(x||'').trim();if(t&&!out.includes(t))out.push(t);});
  (Array.isArray(fallback)?fallback:[]).forEach(x=>{const t=String(x||'').trim();if(t&&!out.includes(t))out.push(t);});
  while(out.length<3)out.push(['品质安心有保障','使用体验更省心','日常守护更持久'][out.length]);
  return out.slice(0,3);
}
function makeCopyBlock(mainTitle,coreSellingPoint,functionArea,subtitles,insight){
  return {mainTitle,coreSellingPoint,functionArea,subtitles:ensureThreeSubtitles(subtitles),selectedSubtitles:[0],insight};
}
function normalizeCopyBlock(block){
  const b=block||{};
  const legacyBenefits=String(b.benefits||'').split(/[·、,，|]/).map(s=>s.trim()).filter(Boolean);
  const coreSellingPoint=String(b.coreSellingPoint||b.benefits||'核心价值清晰可见').trim();
  const functionArea=String(b.functionArea||b.subInfo||'专业配方 | 品质之选').trim();
  const subtitles=ensureThreeSubtitles(b.subtitles&&b.subtitles.length?b.subtitles:legacyBenefits,[coreSellingPoint,functionArea.split(/[|｜]/).pop()]);
  let selectedSubtitles=[];
  if(Array.isArray(b.selectedSubtitles)) selectedSubtitles=b.selectedSubtitles.map(Number).filter(x=>Number.isInteger(x)&&x>=0&&x<3);
  else if(Number.isInteger(b.selectedSubtitle)) selectedSubtitles=[Math.max(0,Math.min(2,b.selectedSubtitle))];
  selectedSubtitles=[...new Set(selectedSubtitles)];
  if(!selectedSubtitles.length)selectedSubtitles=[0];
  return {mainTitle:String(b.mainTitle||'自定义文案版本').trim(),coreSellingPoint,functionArea,subtitles,selectedSubtitles,insight:String(b.insight||'该版本为预制文案结构，消费者洞察仅用于内部策略参考。').trim()};
}
function selectedSubtitleTexts(block){const b=normalizeCopyBlock(block);return b.selectedSubtitles.map(i=>b.subtitles[i]).filter(Boolean);}
function selectedSubtitleText(block){return selectedSubtitleTexts(block).join(' · ');}
function generate(input){
  const i=extract(input);
  const G=[
    ()=>{const c=i.core[0]||'高效配方',s=i.sec[0]||'温和无刺激';return makeCopyBlock(`${c}，告别困扰`,`${c}直击核心问题`,`${i.brand}${i.category} | 高效解决核心困扰`,[`${s}更温和`,'快速见效少等待','持久守护更安心'],'消费者在选购同类商品时，最关注的是“能否真正解决我的问题”。痛点直击型文案通过直接点出用户困扰，建立“我懂你”的情感连接，降低决策门槛。该洞察仅用于内部策略判断，不参与复制。');},
    ()=>{const c=i.core[0]||'16小时',m=i.core[1]||'7倍提升';return makeCopyBlock(`${c}${m}，实证可见`,`${c}${m}，真实数据验证`,`${i.brand} | 实测数据说话`,['科学验证有依据','数据透明更可信','效果量化看得见'],'数据证言型文案利用具体数字建立信任感。量化指标比“效果好”“很快”等模糊表述更容易形成可信度，适合同质化竞争明显的品类。该洞察仅用于内部策略判断，不参与复制。');},
    ()=>{const ing=i.sec.find(s=>/酶|菌|素|蛋白|纤维|油/.test(s))||i.core[0]||'科学配方';return makeCopyBlock(`${ing}，专研之选`,`${ing}科学配比，专业更安心`,`${i.brand} | 成分党优选`,['核心成分更透明','科学配比有依据','温和使用更放心'],'成分科普型文案面向会主动研究配方、原料与机制的消费者，应强调专业、准确和透明，避免夸大。该洞察仅用于内部策略判断，不参与复制。');},
    ()=>makeCopyBlock('每一天，都值得被好好对待','轻松融入日常，守护每一天',`${i.brand} | 日常养护方案`,['每天使用更省心','自然融入好坚持','舒适体验无负担'],'场景代入型文案通过描绘具体使用体验，让消费者在脑海中预演产品进入生活后的状态，从而增强代入感。该洞察仅用于内部策略判断，不参与复制。'),
    ()=>{const d=i.core[0]||'升级配方',o=i.category.includes('膏')?'传统高糖配方':'普通同类商品';return makeCopyBlock(`告别${o}，${d}来了`,`${d}，对比普通方案更进一步`,`${i.brand} | 配方升级之选`,['配方升级更有效','使用体验再提升','告别传统旧方案'],'对比优势型文案通过“旧方案与新方案”的差异，让消费者快速理解产品价值。对比维度应具体可感，避免只说“更好”。该洞察仅用于内部策略判断，不参与复制。');},
    ()=>{const e=i.sec.find(s=>/同款|认证|推荐|专研|研发/.test(s))||'专业研发';return makeCopyBlock(`${e}，值得信赖`,`${e}标准，品质更有保障`,`${i.brand} | 专业研发严选`,['专业标准更可信','品质把控更严格','安心选择有依据'],'信任背书型文案利用专业研发、认证、推荐或口碑来降低决策风险，适合高客单、新品类或需要建立安全感的产品。该洞察仅用于内部策略判断，不参与复制。');},
    ()=>makeCopyBlock('用心守护，只因值得','细致呵护，把关爱落到每一天',`${i.brand} | 每一份关爱都不将就`,['温情陪伴每一天','细致呵护更贴心','安心守护不缺席'],'情感共鸣型文案将产品与关爱、陪伴和守护等情感价值绑定，重点不在理性参数，而在建立长期品牌好感。该洞察仅用于内部策略判断，不参与复制。'),
    ()=>{const p=i.promotion||'限时优惠';return makeCopyBlock(`立即行动，${p}不容错过`,`${p}，现在入手更划算`,`${i.brand} | 限时专享`,['限时福利别错过','先到先得更省心','立即行动享优惠'],'行动号召型文案用于促销节点或库存紧张场景，通过明确利益与时间窗口推动转化，但要避免过度催促。该洞察仅用于内部策略判断，不参与复制。');},
  ];
  return G.map((fn,idx)=>({version:idx+1,style:STRATEGIES[idx],block:fn()}));
}
  return {STRATEGIES,g,extract,ensureThreeSubtitles,makeCopyBlock,normalizeCopyBlock,selectedSubtitleTexts,selectedSubtitleText,generate};
});
