'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {auditCopyReturn}=require('../copy-field-audit');
function version(i){return {version:i,style:'策略'+i,mainTitle:'主标题',coreSellingPoint:'核心卖点',functionArea:'功能区',subtitles:['一','二','三'],consumerInsight:'洞察'};}
test('完整 8 版本返回通过字段审计',()=>{const a=auditCopyReturn(JSON.stringify({versions:Array.from({length:8},(_,i)=>version(i+1))}));assert.equal(a.ok,true);assert.equal(a.versionCount,8);assert.equal(a.missingFieldCount,0);});
test('漏字段会定位到具体版本与字段',()=>{const list=Array.from({length:8},(_,i)=>version(i+1));delete list[3].functionArea;const a=auditCopyReturn(JSON.stringify({versions:list}));assert.equal(a.ok,false);assert.equal(a.missingFieldCount,1);assert.deepEqual(a.versionAudits[3].missing,['functionArea']);});
test('版本数和 subtitles 数量异常会被监控',()=>{const list=Array.from({length:7},(_,i)=>version(i+1));list[0].subtitles=['一','二'];const a=auditCopyReturn({versions:list});assert.equal(a.ok,false);assert.equal(a.versionCount,7);assert.equal(a.subtitleIssueCount,1);assert.match(a.summary,/versions=7/);});
test('非 JSON 返回会得到解析错误且不抛出',()=>{const a=auditCopyReturn('不是 JSON');assert.equal(a.ok,false);assert.equal(a.parsed,false);assert.ok(a.parseError);assert.deepEqual(a.missingRoot,['versions']);});
