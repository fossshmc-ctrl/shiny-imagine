'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const createPaddle=require('../paddleocr_cloud_node');

function jsonResponse(status,obj,headers={}){
  return {status,headers,body:Buffer.from(JSON.stringify(obj),'utf8')};
}
function makeCfg(){
  return {paddleOcrCloud:{
    token:'test_token_abcdefghijklmnopqrstuvwxyz',
    jobUrl:'https://example.test/api/v2/ocr/jobs',
    model:'PaddleOCR-VL-1.6',
    pollIntervalMs:1,
    pollTimeoutMs:30000,
    maxRegions:40,
    submitRetryDelaysMs:[0,0,0,0],
    submitRetryJitterMs:0
  }};
}
function image(){return 'data:image/png;base64,'+Buffer.from('fake-image').toString('base64');}
function doneStatus(jobId){
  return jsonResponse(200,{code:0,data:{jobId,state:'done',extractProgress:{},resultUrl:{jsonUrl:'https://download.test/result.jsonl'}}});
}
function downloadResult(){
  return {status:200,headers:{},body:Buffer.from('{"result":{"layoutParsingResults":[]}}\n','utf8'),finalUrl:'https://download.test/result.jsonl',history:[{via:'direct'}],attempt:1};
}

test('classifies PaddleOCR HTTP 400 code 10010 as retryable queue_busy',()=>{
  const api=createPaddle({root:process.cwd(),cfg:makeCfg(),requestExternal:async()=>{},requestPublicDownload:async()=>{}});
  const c=api._test.classifySubmitResponse(jsonResponse(400,{traceId:'x',code:10010,msg:'任务提交队列已满，请稍后重试'}));
  assert.equal(c.code,'queue_busy');
  assert.equal(c.transient,true);
  assert.equal(c.providerCode,10010);
});

test('keeps other HTTP 400 responses non-retryable instead of mislabeling them queue_busy',()=>{
  const api=createPaddle({root:process.cwd(),cfg:makeCfg(),requestExternal:async()=>{},requestPublicDownload:async()=>{}});
  const c=api._test.classifySubmitResponse(jsonResponse(400,{code:40001,msg:'参数错误'}));
  assert.equal(c.code,'invalid_submit_request');
  assert.equal(c.transient,false);
});

test('retries code 10010 then succeeds and records submit diagnostics',async()=>{
  let postCount=0,getCount=0;
  const requestExternal=async(method)=>{
    if(method==='POST'){
      postCount++;
      if(postCount===1)return jsonResponse(400,{traceId:'retry-1',code:10010,msg:'任务提交队列已满，请稍后重试'});
      return jsonResponse(200,{code:0,data:{jobId:'job-retry-ok'}});
    }
    getCount++;
    return doneStatus('job-retry-ok');
  };
  const api=createPaddle({root:process.cwd(),cfg:makeCfg(),requestExternal,requestPublicDownload:async()=>downloadResult()});
  const result=await api.recognize({requestId:'req-retry',image:image(),imageWidth:100,imageHeight:100,submitRetryDelaysMs:[0,0,0,0],submitRetryJitterMs:0,pollIntervalMs:1});
  assert.equal(result.ok,true);
  assert.equal(result.jobId,'job-retry-ok');
  assert.equal(result.submitAttempts,2);
  assert.equal(result.submitDiagnostics[0].providerCode,10010);
  assert.equal(postCount,2);
  assert.equal(getCount,1);
  assert.equal(api.queueStatus('req-retry').state.phase,'done');
});

test('serializes job creation across concurrent local requests but releases queue after jobId',async()=>{
  let firstPostResolve;
  const firstPost=new Promise(resolve=>{firstPostResolve=resolve;});
  let postCount=0;
  const requestExternal=async(method,target)=>{
    if(method==='POST'){
      postCount++;
      if(postCount===1)return firstPost;
      return jsonResponse(200,{code:0,data:{jobId:'job-second'}});
    }
    const jobId=target.endsWith('job-second')?'job-second':'job-first';
    return doneStatus(jobId);
  };
  const api=createPaddle({root:process.cwd(),cfg:makeCfg(),requestExternal,requestPublicDownload:async()=>downloadResult()});
  const p1=api.recognize({requestId:'req-one',image:image(),imageWidth:10,imageHeight:10,submitRetryDelaysMs:[0],submitRetryJitterMs:0,pollIntervalMs:1});
  await new Promise(r=>setTimeout(r,20));
  const p2=api.recognize({requestId:'req-two',image:image(),imageWidth:10,imageHeight:10,submitRetryDelaysMs:[0],submitRetryJitterMs:0,pollIntervalMs:1});
  await new Promise(r=>setTimeout(r,20));
  assert.equal(postCount,1,'second POST must not hit PaddleOCR while first submission is active');
  const q=api.queueStatus('req-two');
  assert.equal(q.state.phase,'queued');
  assert.equal(q.state.queuePosition,1);
  firstPostResolve(jsonResponse(200,{code:0,data:{jobId:'job-first'}}));
  const [a,b]=await Promise.all([p1,p2]);
  assert.equal(a.ok,true);assert.equal(b.ok,true);
  assert.equal(postCount,2);
});

test('frontend does not claim task submitted before recognize call and polls real queue state',()=>{
  const source=fs.readFileSync(path.join(__dirname,'../src/features/region-workbench/region-workbench.js'),'utf8');
  const fn=source.slice(source.indexOf('async function runRecognition'),source.indexOf('window.__V22_RUN_RECOGNITION_TEST__'));
  const fetchPos=fn.indexOf("fetchJson('/api/paddleocr-cloud/recognize'");
  const submittedPos=fn.indexOf("setProgress('waiting','任务已提交");
  assert.ok(fetchPos>=0);
  assert.equal(submittedPos,-1,'runRecognition must not optimistically mark the job submitted before server confirmation');
  assert.ok(source.includes('/api/paddleocr-cloud/queue-status?requestId='));
  assert.ok(source.includes("st.phase==='retry_wait'"));
});
