'use strict';

const EXPECTED_VERSION_FIELDS=['version','style','mainTitle','coreSellingPoint','functionArea','subtitles','consumerInsight'];
const EXPECTED_ROOT_FIELDS=['versions'];
const ALIASES={
  mainTitle:['main_title','title','headline'],
  coreSellingPoint:['core_selling_point','sellingPoint','selling_point','benefits'],
  functionArea:['function_area','subInfo','features'],
  consumerInsight:['consumer_insight','insight'],
  subtitles:['subtitle','smallTitles']
};
function stripFence(text){return String(text==null?'':text).trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'').trim();}
function isEmpty(v){if(v===null||v===undefined)return true;if(typeof v==='string')return !v.trim();if(Array.isArray(v))return v.length===0;if(typeof v==='object')return Object.keys(v).length===0;return false;}
function safeKeys(v){return v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v):[];}
function aliasFor(obj,field){const list=ALIASES[field]||[];return list.find(k=>Object.prototype.hasOwnProperty.call(obj||{},k))||'';}
function auditCopyReturn(content){
  const audit={schema:'copy-v25.5',ok:false,parsed:false,expectedVersionCount:8,versionCount:0,rootFields:[],missingRoot:[],extraRoot:[],missingFieldCount:0,emptyFieldCount:0,aliasFieldCount:0,subtitleIssueCount:0,versionAudits:[],summary:''};
  let data=content;
  try{if(typeof data==='string')data=JSON.parse(stripFence(data));audit.parsed=!!data&&typeof data==='object';}
  catch(e){audit.parseError=String(e&&e.message||e);audit.missingRoot=['versions'];audit.summary='返回内容不是合法 JSON，无法检查字段';return audit;}
  if(!audit.parsed){audit.parseError='返回内容不是 JSON 对象';audit.missingRoot=['versions'];audit.summary='返回内容不是 JSON 对象，无法检查字段';return audit;}
  audit.rootFields=safeKeys(data);
  audit.missingRoot=EXPECTED_ROOT_FIELDS.filter(k=>!Object.prototype.hasOwnProperty.call(data,k));
  audit.extraRoot=audit.rootFields.filter(k=>!EXPECTED_ROOT_FIELDS.includes(k));
  const versions=Array.isArray(data.versions)?data.versions:[];
  audit.versionCount=versions.length;
  versions.slice(0,24).forEach((item,index)=>{
    const outer=item&&typeof item==='object'&&!Array.isArray(item)?item:{};
    const inner=outer.block&&typeof outer.block==='object'&&!Array.isArray(outer.block)?outer.block:{};
    const effective=Object.assign({},outer,inner);
    const actualFields=[...new Set([...safeKeys(outer).filter(k=>k!=='block'),...safeKeys(inner)])];
    const missing=[],empty=[],aliases=[];
    EXPECTED_VERSION_FIELDS.forEach(field=>{
      const has=Object.prototype.hasOwnProperty.call(effective,field);
      if(!has){const a=aliasFor(effective,field);missing.push(field);if(a)aliases.push({expected:field,actual:a});}
      else if(isEmpty(effective[field]))empty.push(field);
    });
    let subtitleIssue='';
    if(Object.prototype.hasOwnProperty.call(effective,'subtitles')){
      if(!Array.isArray(effective.subtitles))subtitleIssue='subtitles 不是数组';
      else if(effective.subtitles.length!==3)subtitleIssue='subtitles 数量为 '+effective.subtitles.length+'，应为 3';
      else if(effective.subtitles.some(isEmpty))subtitleIssue='subtitles 包含空值';
    }
    const extra=actualFields.filter(k=>!EXPECTED_VERSION_FIELDS.includes(k)&&k!=='block');
    const ok=!missing.length&&!empty.length&&!subtitleIssue;
    audit.versionAudits.push({index:index+1,version:effective.version==null?'':effective.version,ok,actualFields,missing,empty,aliases,extra,subtitleIssue});
    audit.missingFieldCount+=missing.length;audit.emptyFieldCount+=empty.length;audit.aliasFieldCount+=aliases.length;if(subtitleIssue)audit.subtitleIssueCount++;
  });
  const countOk=versions.length===8;
  audit.ok=audit.parsed&&!audit.missingRoot.length&&countOk&&audit.versionAudits.length===8&&audit.versionAudits.every(v=>v.ok);
  const problems=[];
  if(audit.missingRoot.length)problems.push('缺少根字段 '+audit.missingRoot.join('、'));
  if(!countOk)problems.push('versions='+versions.length+'（应为 8）');
  if(audit.missingFieldCount)problems.push('缺失字段 '+audit.missingFieldCount+' 处');
  if(audit.emptyFieldCount)problems.push('空字段 '+audit.emptyFieldCount+' 处');
  if(audit.subtitleIssueCount)problems.push('小标题结构异常 '+audit.subtitleIssueCount+' 处');
  if(audit.aliasFieldCount)problems.push('发现别名字段 '+audit.aliasFieldCount+' 处');
  audit.summary=audit.ok?'字段完整：8/8 个版本均符合返回契约':('字段监控异常：'+(problems.join('；')||'返回结构不符合约定'));
  return audit;
}
module.exports={EXPECTED_VERSION_FIELDS,EXPECTED_ROOT_FIELDS,auditCopyReturn};
