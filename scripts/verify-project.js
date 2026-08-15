'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

for(const required of ['copy-field-audit.js','api/index.js','vercel.json','scripts/build-vercel.js','src/core/deployment-runtime.js','src/core/generation-channel-status.js','src/core/latest-request-gate.js','src/core/elapsed-timer.js','src/core/copy-snapshot-store.js','src/core/route-persistence.js','src/core/region-refresh-anchor.js','src/core/evolink-image-adapter.js','src/core/image-export.js','src/core/region-prompt-state.js','src/core/region-ai-prompt.js','src/app/page-state-lifecycle.js','src/features/copy/copy-history.js','src/components/generation-channel-status-card.js','styles/features/channel-status.css','local-data-store.js','network-resilience.js','network-keepalive.js','src/core/micro-image-transport.js','src/core/micro-edit-base-session.js','src/core/micro-performance-meter.js','src/core/region-generation-regression.js']){
  if(!fs.existsSync(path.join(root,required)))fail('missing V26 required module: '+required);
}

function fail(message){console.error('VERIFY FAILED:',message);process.exitCode=1;}
const inlineStyles=[...html.matchAll(/<style([^>]*)>[\s\S]*?<\/style>/gi)];
if(inlineStyles.some(m=>!m[1].includes('id="v29-critical-fallback"')))fail('index.html contains an unexpected inline style block');
const inlineScripts=[...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter(m=>!/[\s]src\s*=/.test(m[1])&&m[2].trim());
if(inlineScripts.length) fail('index.html still contains executable inline scripts');
const refs=[...html.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/gi)].map(m=>m[1].split('?')[0]).filter(x=>!/^https?:/i.test(x));
for(const ref of refs){if(!fs.existsSync(path.join(root,ref))) fail('missing referenced asset: '+ref);}
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const file of walk(path.join(root,'src')).filter(f=>f.endsWith('.js'))){
  const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
  if(r.status!==0) fail(path.relative(root,file)+' syntax error\n'+r.stderr);
}
const expectedWireframes=[...Array.from({length:9},(_,i)=>`assets/wolassen/${String(i+2).padStart(2,'0')}.jpg`),...Array.from({length:9},(_,i)=>`assets/lebao/${String(i+2).padStart(2,'0')}.jpg`)];
for(const relative of expectedWireframes){
  const file=path.join(root,...relative.split('/'));
  if(!fs.existsSync(file)){fail('missing built-in wireframe: '+relative);continue;}
  const buf=fs.readFileSync(file);
  if(buf.length<1024)fail('built-in wireframe is unexpectedly small: '+relative);
  if(buf[0]!==0xff||buf[1]!==0xd8||buf[buf.length-2]!==0xff||buf[buf.length-1]!==0xd9)fail('invalid JPEG boundaries: '+relative);
}
const librarySource=fs.readFileSync(path.join(root,'src/features/wireframe/wireframe-library.js'),'utf8');
if(/"src":"assets\/(?:wolassen|lebao)\//.test(librarySource))fail('built-in wireframe paths must be root absolute');
if(!librarySource.includes("WIRE_ASSET_VERSION='27.3.0'"))fail('wireframe asset version is not V27.3');

const overviewSource=fs.readFileSync(path.join(root,'src/features/wireframe/wireframe-library.js'),'utf8');
if(!overviewSource.includes('data-wf-workflow-overview'))fail('combined wireframe workflow overview is missing');
if(overviewSource.includes('renderWireLinkOverview'))fail('legacy standalone wireframe overview remains');
if(/const logic=`<div class="notebox"/.test(overviewSource))fail('legacy standalone generation logic box remains');


const promptSource=fs.readFileSync(path.join(root,'src/features/prompt/prompt-composition.js'),'utf8');
if(/checkProxy\(\)\.then[\s\S]{0,500}loadApiModels/.test(promptSource))fail('global startup still auto-loads shared models');
const routerSource=fs.readFileSync(path.join(root,'src/app/router-events.js'),'utf8');
if(!routerSource.includes('AppChannelRuntime.enter(route)'))fail('router is not connected to the channel runtime');
const runtimeSource=fs.readFileSync(path.join(root,'src/infrastructure/api/channel-runtime.js'),'utf8');
if(!runtimeSource.includes("channel==='copy-coze'"))fail('copy channel branch is missing');
if(!runtimeSource.includes("/api/models")&&runtimeSource.includes('copy-coze')){/* runtime intentionally delegates shared loading */}
const apiConfigSource=fs.readFileSync(path.join(root,'src/infrastructure/api/api-config-client.js'),'utf8');
if(/API_BRIDGE\.copyModel\s*=\s*textModels/.test(apiConfigSource))fail('shared model classification still overwrites the copy model');
const copySource=fs.readFileSync(path.join(root,'src/integrations/copy-coze-channel.js'),'utf8');
if(!copySource.includes('/api/copy-coze/status')||!copySource.includes('/api/copy-coze/generate'))fail('Coze copy endpoints are missing');
if(!copySource.includes('ElapsedTimer')||!copySource.includes('总耗时')||!copySource.includes('已用时 00:00.0'))fail('copy generation elapsed timer is missing');
const copyWorkbenchSource=fs.readFileSync(path.join(root,'src/features/copy/copy-workbench.js'),'utf8');
if(!copyWorkbenchSource.includes('返还字段监控')||!copyWorkbenchSource.includes('backendFieldMonitorHtml'))fail('V25.6 return-field monitor UI is missing');
const nodeServerSource=fs.readFileSync(path.join(root,'server.js'),'utf8');
const pythonServerSource=fs.readFileSync(path.join(root,'server.py'),'utf8');
if(!nodeServerSource.includes('auditCopyReturn')||!nodeServerSource.includes('fieldAudit'))fail('Node copy return-field audit is missing');
if(!pythonServerSource.includes('audit_copy_return')||!pythonServerSource.includes('fieldAudit'))fail('Python copy return-field audit is missing');

const copyHistorySource=fs.readFileSync(path.join(root,'src/features/copy/copy-history.js'),'utf8');
if(!copyHistorySource.includes("turing_copy_generation_snapshots_current"))fail('V25.6 copy snapshot storage key is missing');
if(!copyHistorySource.includes('copySnapshotSwitcherHtml'))fail('V25.6 copy history switcher is missing');
if(!copyHistorySource.includes('copySnapshotTogglePinned')||!copyHistorySource.includes('data-copy-snapshot-star'))fail('V25.6 pinned snapshot UI/logic is missing');
if(!copyHistorySource.includes('copySnapshotDelete')||!copyHistorySource.includes('data-copy-snapshot-delete'))fail('V25.6 snapshot delete UI/logic is missing');
const copySnapshotStoreSource=fs.readFileSync(path.join(root,'src/core/copy-snapshot-store.js'),'utf8');
if(!copySnapshotStoreSource.includes('pinned')||!copySnapshotStoreSource.includes('enforceRetention')||!copySnapshotStoreSource.includes('deleteBatch'))fail('V25.6 pinned retention/delete store logic is missing');
if(!copyHistorySource.includes('MAX_BATCHES')&&!fs.readFileSync(path.join(root,'src/core/copy-snapshot-store.js'),'utf8').includes('MAX_BATCHES=5'))fail('V25.6 five-batch snapshot limit is missing');
if(!routerSource.includes("copySnapshotCaptureGenerated(source,'local-rule')"))fail('local copy generation is not captured as a V25.6 snapshot');
if(!copySource.includes("copySnapshotCaptureGenerated(source,'coze-bot')"))fail('Coze copy generation is not captured as a V25.6 snapshot');

const routePersistenceSource=fs.readFileSync(path.join(root,'src/core/route-persistence.js'),'utf8');
const pageLifecycleSource=fs.readFileSync(path.join(root,'src/app/page-state-lifecycle.js'),'utf8');
if(!routePersistenceSource.includes('turing_app_last_route_current')||!routePersistenceSource.includes('VALID_ROUTES'))fail('V25.6 global route persistence is missing');
if(!routerSource.includes('AppRoutePersistence.remember(route)')||!routerSource.includes('AppRoutePersistence.boot()'))fail('router is not using V25.6 global lastRoute persistence');
if(!pageLifecycleSource.includes("copy:{storage:'session+local'")||!pageLifecycleSource.includes("adjust:{storage:'indexeddb+session'"))fail('page state lifecycle policies are missing');
if(copyHistorySource.includes('COPY_SESSION_VIEW_KEY')||copyHistorySource.includes('copySnapshotRememberView'))fail('copy persistence still owns route state');

const regionAnchorSource=fs.readFileSync(path.join(root,'src/core/region-refresh-anchor.js'),'utf8');
const regionRouteSource=fs.readFileSync(path.join(root,'src/features/region-workbench/region-route.js'),'utf8');
if(!regionAnchorSource.includes('turing_region_v25_6_refresh_anchor')||!regionAnchorSource.includes("mode:'empty'")||!regionAnchorSource.includes("mode:'project'"))fail('V25.6 region refresh anchor module is incomplete');
if(!html.includes('src/core/region-refresh-anchor.js?v=29.0.0'))fail('region refresh anchor is not loaded with the V27.3 cache version');
if(!regionRouteSource.includes('anchor=readRefreshAnchor()')||!regionRouteSource.includes('projects.find(x=>x.id===anchor.projectId)'))fail('region refresh recovery is not anchored to the current session project');
if(regionRouteSource.includes('projects.length===1)rec=projects[0]'))fail('region refresh still auto-restores the only historical project');
if(regionRouteSource.includes('startEpoch=mutationEpoch,active=activeProjectId()'))fail('region refresh still depends on the old active-project pointer');


const paddleNodeSource=fs.readFileSync(path.join(root,'paddleocr_cloud_node.js'),'utf8');
const paddlePythonSource=fs.readFileSync(path.join(root,'paddleocr_cloud_service.py'),'utf8');
const regionWorkbenchSource=fs.readFileSync(path.join(root,'src/features/region-workbench/region-workbench.js'),'utf8');
for(const token of ['providerCode===10010',"code:'queue_busy'",'DEFAULT_SUBMIT_RETRY_DELAYS_MS=[3000,6000,12000,20000]','paddleSubmissionQueue','submitWithRetry','queueStatus'])if(!paddleNodeSource.includes(token))fail('V26 Node PaddleOCR resilience is missing: '+token);
for(const token of ['provider_code == 10010','"queue_busy"','DEFAULT_SUBMIT_RETRY_DELAYS_MS = [3000, 6000, 12000, 20000]','_SUBMISSION_QUEUE','_submit_with_retry','submission_queue_status'])if(!paddlePythonSource.includes(token))fail('V26 Python PaddleOCR resilience is missing: '+token);
if(!nodeServerSource.includes("/paddleocr-cloud/queue-status")||!pythonServerSource.includes("/paddleocr-cloud/queue-status"))fail('V26 PaddleOCR queue-status endpoint is missing from Node/Python servers');
if(!regionWorkbenchSource.includes('/api/paddleocr-cloud/queue-status?requestId=')||!regionWorkbenchSource.includes("st.phase==='retry_wait'"))fail('V26 frontend PaddleOCR queue/retry progress monitor is missing');
const runRecognitionSource=regionWorkbenchSource.slice(regionWorkbenchSource.indexOf('async function runRecognition'),regionWorkbenchSource.indexOf('window.__V22_RUN_RECOGNITION_TEST__'));
if(runRecognitionSource.includes("setProgress('waiting','任务已提交"))fail('frontend still reports PaddleOCR task submitted before server confirmation');
if(!runRecognitionSource.includes('requestId:newOcrRequestId')&&!runRecognitionSource.includes('const requestId=newOcrRequestId()'))fail('V26 frontend request correlation id is missing');



// V26 EvoLink image-provider integration guards.
const evoSource=fs.readFileSync(path.join(root,'src/core/evolink-image-adapter.js'),'utf8');
const imageApiSource=fs.readFileSync(path.join(root,'src/infrastructure/api/image-api-client.js'),'utf8');
const imageFlowSource=fs.readFileSync(path.join(root,'src/features/image/image-flow-diagnostics.js'),'utf8');
const imageSessionSource=fs.readFileSync(path.join(root,'src/core/image-generation-session.js'),'utf8');
const microApiSource=fs.readFileSync(path.join(root,'src/integrations/micro-api-channel.js'),'utf8');
const evoScript='src/core/evolink-image-adapter.js?v=29.0.0';
if(!html.includes(evoScript))fail('V26 EvoLink image adapter is not loaded');
if(html.indexOf(evoScript)>html.indexOf('src/infrastructure/api/api-config-client.js?v=29.0.0'))fail('EvoLink adapter must load before API config client');
for(const token of ["DEFAULT_BASE='https://api.evolink.ai/v1'","DEFAULT_MODEL='gemini-3.1-flash-lite-image'","FILE_UPLOAD_ENDPOINT='/api/evolink/files/upload/reference'","GENERATE_ENDPOINT='/api/images/generations'",'normalizeEvolinkBase','image_urls',"'/api/tasks/'",'nano-banana-2-beta','gpt-image-2','gpt-image-1.5','doubao-seedream-5.0-lite','qwen-image-3.0','wan2.5-text-to-image','z-image-turbo','krea-2-turbo','mj-v8.1','mj-v8.1-retexture'])if(!evoSource.includes(token))fail('EvoLink adapter is missing: '+token);
for(const token of ['isLoopbackHost','isLocalReferenceSource','prepareReferenceSource','blobToDataUrl','referenceFetchUrl'])if(!evoSource.includes(token))fail('V26 local-reference materialization is missing: '+token);
if(!evoSource.includes("/^https?:\\/\\//i.test(s)&&!isLocalReferenceSource(s)"))fail('V26 must keep public reference URLs direct while materializing local references');
if(!promptSource.includes('if(isEvolinkImageChannel())')||!promptSource.includes('EvoLink 的图生图/编辑本来就统一走 /v1/images/generations + image_urls'))fail('V26 wireframe flow is not using the EvoLink unified image route');
if(promptSource.includes('该模型/中转站暂不支持图像编辑接口'))fail('old misleading edit-endpoint fallback warning remains');
if(!imageFlowSource.includes('if(isEvolinkImageChannel())')||!imageFlowSource.includes('非 EvoLink 多图编辑不可用，回退生成接口'))fail('V26 image flow provider-aware edit routing is missing');
if(!apiConfigSource.includes("prepareReferenceSource('/assets/wolassen/02.jpg?v=26-preflight')")||!apiConfigSource.includes('连接测试本身不会实际提交生图任务'))fail('V26 non-billable local-reference diagnostic is missing');
if(!apiConfigSource.includes('API_V258_MIGRATION_KEY')||!apiConfigSource.includes("localStorage.setItem('api_key','')")||!apiConfigSource.includes('docs\\//i.test(oldBase)'))fail('V26 shared-image config migration does not safely replace docs/legacy provider settings');
if(!imageApiSource.includes('EVO_IMAGE_API.generate')||!imageFlowSource.includes('EvoLinkImageAdapter')||!microApiSource.includes('EVO.generate'))fail('EvoLink adapter is not connected to image, progress and micro-adjust channels');
if(!imageFlowSource.includes('data&&data.results')||!imageFlowSource.includes("['id','task_id'"))fail('EvoLink top-level async id/results parsing is missing in progress UI');
for(const source of [nodeServerSource,pythonServerSource]){
  if(!source.includes('files-api.evolink.ai')||!source.includes('evolink/files/upload/base64')||!source.includes('gemini-3.1-flash-lite-image')||!source.includes('krea-2-turbo')||!source.includes('mj-v8.1'))fail('Node/Python EvoLink upload/model proxy parity is incomplete');
}


// V26 workflow persistence / simplification guards.
const wireGenerationSource=fs.readFileSync(path.join(root,'src/features/wireframe/wireframe-generation.js'),'utf8');
const wirePickerSource=fs.readFileSync(path.join(root,'src/components/wireframe-picker.js'),'utf8');
const wirePersistenceSource=fs.readFileSync(path.join(root,'src/features/wireframe/wireframe-persistence.js'),'utf8');
const imageGenerationSource=fs.readFileSync(path.join(root,'src/features/image/image-generation.js'),'utf8');
const localStoreSource=fs.readFileSync(path.join(root,'local-data-store.js'),'utf8');
if(!wireGenerationSource.includes('async function openHist(targetGroup)')||!wireGenerationSource.includes('/api/wireframe-history?limit=120')||!wireGenerationSource.includes('persistGeneratedWireHistoryItem'))fail('V26 persistent wireframe history opener/storage is missing');
if(!nodeServerSource.includes("'/api/wireframe-history'")||!nodeServerSource.includes("'/api/image-tasks'"))fail('V26 Node local history/task persistence endpoints are missing');
if(!pythonServerSource.includes("'/wireframe-history'")||!pythonServerSource.includes("'/image-tasks'"))fail('V26 Python local history/task persistence endpoints are missing');
for(const source of [wirePickerSource,routerSource,promptSource,wirePersistenceSource])for(const token of ['生成前版式字段检查','data-layout-check','runLayoutFieldCheck'])if(source.includes(token))fail('removed V26 layout-check feature still remains: '+token);
if(!promptSource.includes('V26 生成前自动确认任务 JSON')||promptSource.includes('openTaskJsonDiff'))fail('V26 wireframe generation still requires manual task JSON confirmation');
if(!routerSource.includes('V26 文案确认后自动确认任务 JSON'))fail('V26 copy-to-wireframe navigation does not auto-confirm task JSON');
if(!imageApiSource.includes('function openImageTaskCenter()')||!imageApiSource.includes('async function resumePendingImageTasksOnce()')||!imageApiSource.includes('/api/image-tasks')||!imageApiSource.includes("'/api/tasks/'+encodeURIComponent"))fail('V26 image task center persistence/resume logic is missing');
if(!evoSource.includes('function modelParameterSchema(model)')||!evoSource.includes('function normalizeModelOptions(model,options)')||!imageGenerationSource.includes('function imageModelParameterUi()'))fail('V26 model-specific parameter adaptation is missing');
const layoutCss=fs.readFileSync(path.join(root,'styles/base/layout.css'),'utf8');
for(const token of ['parametersExpanded:false','data-img-parameter-toggle','image-parameter-accordion','const panel=img.parametersExpanded?','生成参数'])if(!imageGenerationSource.includes(token))fail('V27.9 compact image-parameter UI is incomplete: '+token);
if(!routerSource.includes("img.parametersExpanded=!img.parametersExpanded;renderImageView()"))fail('V27.9 image-parameter toggle is not wired');
for(const token of ['.image-parameter-toggle{width:100%;min-height:58px;display:flex','.image-parameter-panel{','.image-parameter-accordion.is-open'])if(!layoutCss.includes(token))fail('V27.9 compact image-parameter styling is incomplete: '+token);
if(!localStoreSource.includes('class JsonCollection')||!localStoreSource.includes('atomicWriteJson'))fail('V26 atomic local JSON store is missing');

// V27 reliable multi-format image export guards.
const imageExportSource=fs.readFileSync(path.join(root,'src/core/image-export.js'),'utf8');
for(const token of ['normalizeFormat','jrpg','jpegBytesToPdf','/api/image-export/source?url=','image/jpeg','application/pdf'])if(!imageExportSource.includes(token))fail('V27 image export module is missing: '+token);
if(!html.includes('src/core/image-export.js?v=29.0.0'))fail('V27 image export module is not loaded');
if(html.indexOf('src/core/image-export.js?v=29.0.0')>html.indexOf('src/features/image/image-generation.js?v=29.0.0'))fail('image export module must load before image generation UI');
for(const token of ['data-image-export-format="${f}"','jpg','jpeg','png','pdf','runImageExportFormat'])if(!imageGenerationSource.includes(token))fail('V27 export UI/handler is missing: '+token);
if(!routerSource.includes("e.target.closest('[data-image-export-format]')"))fail('V27 router is not wired to image export formats');
if(!nodeServerSource.includes("'/image-export/source'")||!pythonServerSource.includes("'/image-export/source'"))fail('V27 Node/Python image download proxy parity is missing');

for(const token of ['prepareDownloadArtifact','objectUrl','disposePreparedArtifact'])if(!imageExportSource.includes(token))fail('V27 prepared-download artifact flow is missing: '+token);
for(const token of ['确认下载','image-export-confirm-area','data-image-export-confirm','prepareImageExportFormat'])if(!imageGenerationSource.includes(token))fail('V27 explicit confirm-download UI is missing: '+token);
if(!routerSource.includes("#modal [data-image-export-format]")||!routerSource.includes("#modal [data-image-export-confirm]"))fail('V27 modal-level download event delegation is missing');
if(routerSource.indexOf("#modal [data-image-export-format]")<0||routerSource.indexOf("document.addEventListener('click'")<0)fail('V27 download controls are not handled from the document-level modal listener');
const wireHistoryCss=fs.readFileSync(path.join(root,'styles/features/wireframe-workbench.css'),'utf8');
for(const token of ['.wire-history-card','.wire-history-thumb','.wire-history-thumb img','max-height:64vh'])if(!wireHistoryCss.includes(token))fail('V27 compact wireframe history styling is missing: '+token);
const historyModalStart=wireGenerationSource.indexOf('function wireHistoryModalHtml()'),historyModalEnd=wireGenerationSource.indexOf('async function openHist',historyModalStart),historyModalSource=wireGenerationSource.slice(historyModalStart,historyModalEnd);
for(const token of ['data-wfhist-preview','data-wfhist-use','data-wfhist-delete'])if(!historyModalSource.includes(token))fail('V27 unified wireframe history action is missing: '+token);
for(const token of ['data-wfhist-download','data-wfhist-json'])if(historyModalSource.includes(token))fail('V27 history card still exposes obsolete action: '+token);
if(!overviewSource.includes("data-wf-advanced-toggle")||!overviewSource.includes("wf.advancedDebug?renderWireJsonPanel(g,i):''"))fail('V27 Advanced/Debug JSON visibility gate is missing');
if(!wirePickerSource.includes('普通流程无需查看技术结构')||!wirePickerSource.includes('高级 / 调试'))fail('V27 normal wireframe flow does not hide JSON technical details');
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['/model-capabilities','evolink-models-live','maxInputImages'])if(!source.includes(token))fail('V27 dynamic EvoLink model capability endpoint is missing: '+token);
for(const token of ['remoteCapabilityMap','ingestRemoteModels','normalizeRemoteModelCapability','已合并 EvoLink /models 动态能力'])if(!evoSource.includes(token))fail('V27 dynamic model capability adapter is missing: '+token);
if(!apiConfigSource.includes("dynamic?'/api/model-capabilities':'/api/models'")||!apiConfigSource.includes('modelCapabilities'))fail('V27 API config client does not consume dynamic model capabilities');


// V27 EvoLink credit readiness / HTTP 402 guards.
for(const source of [nodeServerSource,pythonServerSource]){
  if(!source.includes('/credits')||!source.includes('generationReady')||!source.includes('Credits 不足'))fail('V27 EvoLink credit diagnostics are incomplete');
  if(!source.includes("'/api/credits'")&&!source.includes("path='/api/credits'"))fail('V27 local credits preflight logging/route is missing');
}
if(!nodeServerSource.includes("apiPath === '/credits'")||!nodeServerSource.includes("normalizeEvolinkBase(baseUrl)+'/credits'"))fail('V27 Node /api/credits preflight proxy is missing');
if(!pythonServerSource.includes("api_path == '/credits'")||!pythonServerSource.includes("normalize_evolink_base(base) + '/credits'"))fail('V27 Python /api/credits preflight proxy is missing');
if(!evoSource.includes('function normalizeCreditsPayload')||!evoSource.includes('function ensureGenerationCredits')||!evoSource.includes("fetchJson('/api/credits'"))fail('V27 EvoLink adapter credits preflight is missing');
if(evoSource.indexOf('await ensureGenerationCredits')<0||evoSource.indexOf('await uploadReferences')<0||evoSource.indexOf('await ensureGenerationCredits')>evoSource.indexOf('await uploadReferences'))fail('V27 credits check must run before reference upload');
for(const token of ['账户 Credits / 生图额度','status===402','EvoLink 生图额度不足'])if(!apiConfigSource.includes(token))fail('V27 API diagnostic/friendly 402 mapping is missing: '+token);
if(!imageFlowSource.includes('apiFailureInfo'))fail('V27 image flow does not reuse friendly HTTP 402 classification');

// V27 generation-session / AbortSignal race guards.
if(!html.includes('src/core/image-generation-session.js?v=29.0.0'))fail('V27 image generation session guard is not loaded');
if(html.indexOf('src/core/image-generation-session.js?v=29.0.0')>html.indexOf('src/features/image/image-flow-diagnostics.js?v=29.0.0'))fail('image generation session guard must load before image-flow diagnostics');
for(const token of ['stale_generation','generation_cancelled','unexpected_abort_recovered','ABORT_RE'])if(!imageSessionSource.includes(token))fail('V27 generation session helper is missing: '+token);
for(const token of ['忽略旧会话失败回写','safeRetry=method===','不会自动重提计费请求','sessionId:generationSessionId'])if(!imageFlowSource.includes(token))fail('V27 image flow session isolation is missing: '+token);
if(!evoSource.includes("stage:'EvoLink 参考图上传'")||!evoSource.includes('parentStage'))fail('V27 reference upload stage diagnostics are not isolated from parent generation stage');


// V27 network resilience / socket hang up guards.
const networkResilienceSource=fs.readFileSync(path.join(root,'network-resilience.js'),'utf8');
for(const token of ['connection_reset','ECONNRESET','retryTransient','buildMultipartFile','decodeImageDataUrl'])if(!networkResilienceSource.includes(token))fail('V27 network resilience helper is missing: '+token);
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['upload/stream','network-diagnose','echo.apifox.com/get','300000'])if(!source.includes(token))fail('V27 Node/Python network diagnostics/upload parity is missing: '+token);
if(!nodeServerSource.includes('requestFileUploadResilient')||!pythonServerSource.includes('request_file_upload_resilient'))fail('V27 resilient file upload path is missing');
for(const token of ['深度网络诊断','/api/network-diagnose','socket hang up','ECONNRESET'])if(!apiConfigSource.includes(token))fail('V27 frontend network diagnosis UI is missing: '+token);
const networkCfgGuard=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')).network||{};if(Number(networkCfgGuard.uploadTimeoutMs)<300000||!Array.isArray(networkCfgGuard.uploadRetryDelaysMs))fail('V27 network timeout/retry config is missing');

// V27 isolated EvoLink reference-file transport guards.
const referenceUploadSource=fs.readFileSync(path.join(root,'evolink-reference-upload.js'),'utf8');
for(const token of ['referenceCacheId','parseFileUploadResponse','shouldProtocolFallback','buildBase64Payload'])if(!referenceUploadSource.includes(token))fail('V27 reference upload helper is missing: '+token);
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['evolink-reference-cache.json','upload/stream','upload/base64','reference-isolated'])if(!source.includes(token))fail('V27 isolated reference upload parity is missing: '+token);
if(!evoSource.includes("/api/evolink/files/upload/reference"))fail('V27 adapter is not using isolated reference upload endpoint');
if(!nodeServerSource.includes("referenceUpload:{provider:'evolink-files'")||!pythonServerSource.includes("'referenceUpload': {'provider': 'evolink-files'"))fail('V27 health metadata does not expose isolated reference file channel');
const v2625Network=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')).network||{};if(Number(v2625Network.uploadAttemptTimeoutMs)<15000||Number(v2625Network.referenceCacheTtlHours)<1)fail('V27 reference channel timeout/cache configuration is missing');


// V27.9 Smart Region instruction, isolated channel and click-to-image performance guards.
const regionPromptStateSource=fs.readFileSync(path.join(root,'src/core/region-prompt-state.js'),'utf8');
const regionPromptSource=fs.readFileSync(path.join(root,'src/core/region-ai-prompt.js'),'utf8');
if(!html.includes('src/core/region-prompt-state.js?v=29.0.0'))fail('V27.9 live region prompt-state module is not loaded');
if(html.indexOf('src/core/region-prompt-state.js?v=29.0.0')>html.indexOf('src/core/region-ai-prompt.js?v=29.0.0')||html.indexOf('src/core/region-prompt-state.js?v=29.0.0')>html.indexOf('src/features/region-workbench/region-workbench.js?v=29.0.0'))fail('V27.9 prompt-state module must load before prompt bridge and region workbench');
for(const token of ['RegionPromptStateV278','RegionPromptStateV277','【V27.9 实时参数（自动更新）】','extractManual','compose','migrate','applyTextEdit','textEditInstruction','isFreeRegion','freeRegionInstruction'])if(!regionPromptStateSource.includes(token))fail('V27.9 live prompt/text state is incomplete: '+token);
if(!html.includes('src/core/region-ai-prompt.js?v=29.0.0'))fail('V27.9 region AI prompt bridge is not loaded');
if(html.indexOf('src/core/region-ai-prompt.js?v=29.0.0')>html.indexOf('src/features/adjust/image-adjust-core.js?v=29.0.0'))fail('V27.9 region AI prompt bridge must load before image adjust core');
for(const token of ['最高优先级：AI 修改指令','从原位置移除主体并自然修复原位置','目标布局 + 编辑范围合并引导图','青色半透明覆盖区'])if(!regionPromptSource.includes(token))fail('V27.9 prompt bridge is incomplete: '+token);
for(const token of ['__V271_COMMIT_ACTIVE_AI_PROMPT__','__V271_RESOLVE_REGION_PROMPT__','adjustState.regionAiTasks.push','sourceBBox','targetBBox'])if(!regionWorkbenchSource.includes(token))fail('V27.9 region workbench instruction bridge is incomplete: '+token);
for(const token of ['regionTextDrafts:{}','data-v163-region-text-save','Ctrl+Enter 保存，Esc 取消','applyRegionTextChange','__V277_APPLY_REGION_PROMPT_EDITOR__','__V277_SYNC_REGION_PROMPT__','textEditInstruction(r)','commitActiveRegionTextDraft','__V279_COMMIT_ACTIVE_REGION_TEXT__','commitActiveDocumentBlockDraft','__V279_COMMIT_ACTIVE_DOCUMENT_TEXT__'])if(!regionWorkbenchSource.includes(token))fail('V27.9 editable copy / live prompt linkage is incomplete: '+token);
for(const token of ['RegionPromptStateV279','RegionAiPromptV279'])if(!(regionPromptStateSource+regionPromptSource).includes(token))fail('V27.9 current Prompt alias is missing: '+token);
for(const token of ['regionTextFocusedId','regionTextComposing','regionTextRenderPending','captureRegionTextEditorState','restoreRegionTextEditorState','compositionstart','compositionend','nativeRegionTextBusy','mutationTouchesWorkbench'])if(!regionWorkbenchSource.includes(token))fail('V27.9 stable region-text editing is incomplete: '+token);
if(!regionWorkbenchSource.includes('input,textarea,select,option,button,a,label,[contenteditable="true"]'))fail('V27.9 textarea is not excluded from region-card activation');
if(regionWorkbenchSource.includes('setInterval(()=>{install();syncEditorDynamic(false);},90)'))fail('V27.9 still contains the 90 ms Smart Editor polling loop');
if(regionWorkbenchSource.indexOf('captureRegionTextEditorState')>regionWorkbenchSource.indexOf('el.innerHTML=`'))fail('V27.9 region-text state must be captured before OCR DOM replacement');
if(regionWorkbenchSource.includes('__v271FullPromptOverride=text'))fail('V27.9 still freezes live geometry by storing the complete textarea as a full prompt override');
const adjustCoreSource=fs.readFileSync(path.join(root,'src/features/adjust/image-adjust-core.js'),'utf8');
for(const token of ['RegionAiPromptV278','RegionAiPromptV273','adjustFillRegionEnvelope','adjustDrawRegionGuides','regionAiTasks','source_and_target','fast-v278'])if(!adjustCoreSource.includes(token))fail('V27.9 image-adjust prompt/envelope integration is incomplete: '+token);

// V27.9 mixed-region prompt bridge: a manual edit on one task must not discard
// the automatic instructions of the other OCR tasks or freely added regions.
for(const token of ['RegionAiPromptV278','taskPrimaryInstruction','prompt_source','每个已选区域都必须执行','不得因为其中某个区域存在手工文案要求而忽略其他自动区域或自由添加区域'])if(!regionPromptSource.includes(token))fail('V27.9 per-task prompt composition is incomplete: '+token);
if(/const primary\s*=\s*intents\.length\s*\?\s*intents\s*:\s*effective/.test(regionPromptSource))fail('V27.9 still uses the V27.7 global manual-vs-effective prompt branch');
for(const token of ['const freeInstruction=','aiUserInstruction:freeInstruction','__v173ManualRequirement:freeInstruction','__v278CreationInstruction:freeInstruction','__v278ManualRegion:true','freeRegionInstruction(r,auto,lastAuto)',"r.source==='manual-free-region'",'r.manualCreated'])if(!regionWorkbenchSource.includes(token))fail('V27.9 free-region prompt bridge is incomplete: '+token);

const regionRegressionSource=fs.readFileSync(path.join(root,'src/core/region-generation-regression.js'),'utf8');
for(const token of ['missingInstructionRegionIds','decodePromptText','normalizeMatch','identityIncluded','generatedGeometryInstruction'])if(!regionRegressionSource.includes(token))fail('V27.9 regression guard is incomplete: '+token);
const enhancementSource=fs.readFileSync(path.join(root,'src/features/adjust/image-adjust-enhancement-layer.js'),'utf8');
const microChannelSource=fs.readFileSync(path.join(root,'src/integrations/micro-api-channel.js'),'utf8');
const microTransportSource=fs.readFileSync(path.join(root,'src/core/micro-image-transport.js'),'utf8');
const microPerformanceSource=fs.readFileSync(path.join(root,'src/core/micro-performance-meter.js'),'utf8');
const microOutputSource=fs.readFileSync(path.join(root,'src/features/adjust/micro-adjust-output-channel.js'),'utf8');
const keepAliveSource=fs.readFileSync(path.join(root,'network-keepalive.js'),'utf8');
if(!html.includes('src/core/region-generation-regression.js?v=29.0.0'))fail('V27.9 region regression guard is not loaded');
if(html.indexOf('src/core/region-generation-regression.js?v=29.0.0')>html.indexOf('src/features/adjust/image-adjust-enhancement-layer.js?v=29.0.0'))fail('V27.9 regression guard must load before enhancement layer');
if(!html.includes('src/core/micro-performance-meter.js?v=29.0.0'))fail('V27.9 click-to-image performance meter is not loaded');
if(html.indexOf('src/core/micro-performance-meter.js?v=29.0.0')>html.indexOf('src/integrations/micro-api-channel.js?v=29.0.0'))fail('V27.9 performance meter must load before the micro API channel');
for(const token of ['data-v273-ignore-obstacles','无视阻碍继续生成','isolated-no-auto-conflict-check','ignore-known-conflicts-once'])if(!regionWorkbenchSource.includes(token))fail('V27.9 conflict isolation UI/flow is incomplete: '+token);
for(const token of ['createExpectation','verifyBridge','analyzeImages','changedGeometryCount'])if(!regionRegressionSource.includes(token))fail('V27.9 regression helper is incomplete: '+token);
for(const token of ['adjustTargetLayoutGuideDataUrl','targetLayoutGuideSrc','bridgeCheck','不会自动重复计费生成'])if(!(adjustCoreSource+enhancementSource).includes(token))fail('V27.9 target-layout/regression integration is incomplete: '+token);
for(const token of ["CHANNEL_NAME='micro-adjust-v27.8'",'/api/micro/health','assertIsolation','X-Micro-Instruction-Fingerprint','X-Micro-Conflict-Policy','X-Micro-Handoff-Acknowledged','acknowledgeGeneration','micro_handoff_not_accepted'])if(!microChannelSource.includes(token))fail('V27.9 micro isolation contract is incomplete: '+token);
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['isolatedFromConflictRisk','advisory-only','micro-adjust-v27.8','instructionRegression','handoffAcknowledgementGate','synchronous-before-provider','sequentialRunIsolation'])if(!source.includes(token))fail('V27.9 server micro isolation metadata is incomplete: '+token);
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['X-Micro-Handoff-Acknowledged','micro_channel_isolation_failed'])if(!source.includes(token))fail('V27.9 server billed handoff guard is incomplete: '+token);

// V27.9 preflight cache behavior: identity-only invalidation, 5-minute full diagnostics and 60-second Credits reuse.
const saveStart=microChannelSource.indexOf('function save(cfg)'),saveEnd=microChannelSource.indexOf('function modelMeta',saveStart),saveSource=microChannelSource.slice(saveStart,saveEnd);
for(const token of ['previousFingerprint=fingerprint(previous)','nextFingerprint=fingerprint(next)','identityChanged=previousFingerprint!==nextFingerprint','if(identityChanged)','state.testCache=null','state.creditCache=null'])if(!saveSource.includes(token))fail('V27.9 identity-only cache invalidation is incomplete: '+token);
if(/state\.testCache=null[\s\S]*state\.preflightReadyAt=0/.test(saveSource)&&!saveSource.includes('if(identityChanged)'))fail('V27.9 save() still clears preflight caches unconditionally');
const testStart=microChannelSource.indexOf('async function runTest'),testEnd=microChannelSource.indexOf('async function runDeepTest',testStart),testSource=microChannelSource.slice(testStart,testEnd);
if(!testSource.includes('collectDiagnostics(cfg)')||!testSource.includes("source:'api-test'"))fail('V27.9 API Test must always run and cache full diagnostics');
const preflightStart=microChannelSource.indexOf('async function preflight'),preflightEnd=microChannelSource.indexOf('function openLogs',preflightStart),preflightSource=microChannelSource.slice(preflightStart,preflightEnd);
for(const token of ['diagnosticHit','ensureLightCredits(cfg)','TEST_CACHE_MS','full-diagnostic:','未访问 /models 或 files quota'])if(!preflightSource.includes(token))fail('V27.9 preflight cache/credits flow is incomplete: '+token);
if(preflightSource.indexOf('if(diagnosticHit)')<0||preflightSource.indexOf('ensureLightCredits(cfg)')<preflightSource.indexOf('if(diagnosticHit)'))fail('V27.9 cached generation preflight must use the light Credits path');
if(!microChannelSource.includes('CREDIT_FRESH_MS=60000'))fail('V27.9 60-second Credits cache constant is missing');
if(!microChannelSource.includes('skipCreditsCheck:Date.now()-state.creditReadyAt<CREDIT_FRESH_MS'))fail('V27.9 adapter Credits skip does not use the fresh Credits timestamp');
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['diagnosticCacheMs','creditCacheMs','fullDiagnosticsOnlyOnTestOrCacheExpiry'])if(!source.includes(token))fail('V27.9 server cache metadata is incomplete: '+token);

// V27.9 two-reference plan and concurrent upload.
for(const token of ['keepAlive:true','HttpConnectHttpsAgent','directAgentFor','httpsProxyAgent'])if(!keepAliveSource.includes(token))fail('V27.9 keep-alive transport is incomplete: '+token);
for(const token of ["REFERENCE_PLAN='source+layout-mask-guide+text-fidelity-v280'",'buildLayoutMaskGuide',"role:'source'","role:'layout-mask-guide'",'image/webp','Promise.all(tasks)','uploadConcurrencyTarget:2'])if(!microTransportSource.includes(token))fail('V27.9 merged two-reference transport is incomplete: '+token);
if(microTransportSource.includes("role:'target-layout'")||microTransportSource.includes("role:'combined-mask'"))fail('V27.9 transport still emits separate target-layout or combined-mask references');
if(!enhancementSource.includes('prepareFastReferenceSet({source,layoutGuide,mask:combinedMask,extraRefs:textRefs})')||!enhancementSource.includes('pendingChecks:true')||!enhancementSource.includes("__V225_PUBLISH_MICRO_ADJUST_BATCH__('image-ready-checking')"))fail('V27.9 merged reference / early result path is incomplete');
if(enhancementSource.indexOf("meter.startPhase('compress')")>enhancementSource.indexOf("const source=adjustCanvasDataUrl('clean')"))fail('V27.9 compressMs starts too late and excludes reference canvas serialization');
for(const token of ['function adjustWaitResultDisplayReady(src,timeoutMs=30000)','await adjustWaitResultDisplayReady(results[0],30000)','visible pixels rather than JSON arrival'])if(!enhancementSource.includes(token))fail('V27.9 resultMs is not anchored to browser-decodable pixels: '+token);
const generationStart=regionWorkbenchSource.indexOf('async function performGeneration(options={})'),generationEnd=regionWorkbenchSource.indexOf('function beginCheck(mode)',generationStart),generationSource=regionWorkbenchSource.slice(generationStart,generationEnd);
if(generationSource.indexOf('const expected=selectedRows(s).length')>generationSource.indexOf("meter?.begin?.({source:'region-workbench-click'"))fail('V27.9 empty region requests can still start network-timed preflight');
if(generationSource.indexOf('__V225_BEGIN_MICRO_ADJUST_GENERATION__')>generationSource.indexOf("meter?.startPhase?.('preflight')"))fail('V27.9 right-side generating/performance UI starts after preflight instead of at click time');
if(/\brun\.click\s*\(/.test(generationSource))fail('V27.9 performGeneration still uses the hidden generation button click');
for(const token of ['window.__V276_START_MICRO_ADJUST__','starter({ids,generationId,sessionId:',"meter?.startPhase?.('sync')",'微调生成器已接管'])if(!generationSource.includes(token))fail('V27.9 direct acknowledged handoff is incomplete: '+token);
for(const token of ['__V276_START_MICRO_ADJUST__','microRunAcknowledgedAt','acknowledgeGeneration?.(generationId','synchronous-before-provider','v275MicroRunPromise'])if(!enhancementSource.includes(token))fail('V27.9 sequential handoff coordinator is incomplete: '+token);
for(const token of ['incomingSession','sameSession','currentSession&&eventSession&&currentSession!==eventSession','region-micro-adjust-output-v276'])if(!microOutputSource.includes(token))fail('V27.9 output session isolation is incomplete: '+token);
for(const token of ['uploadConcurrency:2','referencePlan:\'source+layout-mask-guide+text-fidelity-v280\''])if(!microChannelSource.includes(token))fail('V27.9 micro upload/reference diagnostics are incomplete: '+token);

// V27.9 provider and click-to-image performance instrumentation.
for(const token of ['adaptivePollDelay','estimatedTime','uploadConcurrency','skipCreditsCheck','onPerformance','onTaskUpdate','providerQueueMs','generationMs','resultMs','createTaskTracker','pending','processing','completed'])if(!evoSource.includes(token))fail('V27.9 adaptive lifecycle/performance adapter is incomplete: '+token);
for(const token of ["PHASES=['preflight','sync','compress','upload','submit','providerQueue','generation','result','postCheck']",'clickToImageMs','preflightMs','syncMs','compressMs','uploadMs','submitMs','providerQueueMs','generationMs','resultMs','postCheckMs','taskStates','statusPath'])if(!microPerformanceSource.includes(token))fail('V27.9 click-to-image meter is incomplete: '+token);
for(const token of ['点击到出图性能仪表','preflightMs','syncMs','流程交接','compressMs','uploadMs','submitMs','providerQueueMs','generationMs','resultMs','postCheckMs',"['pending','processing','completed']",'taskId','服务端未返回该中间状态'])if(!regionWorkbenchSource.includes(token))fail('V27.9 performance UI is incomplete: '+token);
for(const token of ['clickToImagePerformance:true','taskLifecycle:true','directHandoff:true','handoffAcknowledgementGate:true',"handoffAckMode:'synchronous-before-provider'",'sequentialRunIsolation:true','referencePlan:\'source+layout-mask-guide+text-fidelity-v280\'','uploadConcurrency:2','adaptivePolling:true','keepAlive:true'])if(!nodeServerSource.includes(token))fail('V27.9 Node health/performance metadata is incomplete: '+token);
const perfCfg=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8')).network||{};
if(perfCfg.keepAlive!==true||Number(perfCfg.microUploadConcurrency)!==2||Number(perfCfg.microAdjustPollSoftTimeoutMs)!==180000||Number(perfCfg.microAdjustPollTimeoutMs)!==360000||Number(perfCfg.microAdjustPollMaxTimeoutMs)!==480000||Number(perfCfg.microTaskPollRetryAttempts)!==3||Number(perfCfg.microPreflightCacheMs)!==300000||Number(perfCfg.microCreditFreshMs)!==60000||Number(perfCfg.microRunStaleMs)!==600000||perfCfg.microHandoffAckMode!=='synchronous-before-provider'||Number(perfCfg.microHandoffAckTimeoutMs)!==0)fail('V27.9 performance/handoff config is incomplete');


// V27.9 second-run provider recovery: the observed pre-TLS proxy disconnect is transient,
// task polling continues the same task_id after a soft threshold, and diagnostics are based on
// real EvoLink routes rather than an unrelated control-site probe.
for(const token of ['Client network socket disconnected before secure TLS connection was established','tls_handshake'])if(!networkResilienceSource.includes(token))fail('V27.9 TLS transient classification is incomplete: '+token);
for(const token of ['targetAuthority','invalidateHttpsProxyAgent','targetScopedProxyAgents'])if(!keepAliveSource.includes(token))fail('V27.9 target-scoped proxy reset is incomplete: '+token);
for(const token of ['POLL_SOFT_TIMEOUT_MS=180000','POLL_TIMEOUT_MS=360000','POLL_MAX_TIMEOUT_MS=480000','pollTaskWithRetry','sameTaskOnly:true','softTimeoutReached','pollRetryCount','networkStallMs'])if(!evoSource.includes(token))fail('V27.9 same-task polling recovery is incomplete: '+token);
for(const source of [nodeServerSource,pythonServerSource])for(const token of ['Apifox Echo（辅助探针）','EvoLink 生图 API /models（权威）','diagnosticAdvisoryProbes','proxyTlsRecovery','sameTaskPolling'])if(!source.includes(token))fail('V27.9 authoritative diagnostics / proxy recovery metadata is incomplete: '+token);
for(const token of ['180 秒软阈值后继续同一 task','状态 GET 安全重试','不会重复提交计费任务'])if(!regionWorkbenchSource.includes(token))fail('V27.9 recovery telemetry UI is incomplete: '+token);

// V27.9 output action visibility and download proxy guards.
const regionWorkbenchCss=fs.readFileSync(path.join(root,'styles/features/region-workbench.css'),'utf8');
for(const token of ['promoteRegionWorkbenchModal','openRegionWorkbenchModal','__V277_OPEN_REGRESSION_DETAILS__','__V277_DOWNLOAD_MICRO_OUTPUT__','openImageDownloadDialog(src,name'])if(!regionWorkbenchSource.includes(token))fail('V27.9 regression/download action wiring is incomplete: '+token);
for(const token of ['#modal.v277-region-modal','z-index:100500!important','pointer-events:auto'])if(!regionWorkbenchCss.includes(token))fail('V27.9 result modal elevation is incomplete: '+token);
if(!imageExportSource.includes("/api/image-export/source?url="))fail('V27.9 remote result download does not use the local image proxy');
for(const source of [nodeServerSource,pythonServerSource])if(!source.includes('/image-export/source'))fail('V27.9 local image-download proxy route is missing');

const releaseVersion='V29', releaseSemver='29.0.0';
const currentDocs=['V29-CHANGELOG.txt','V29-REGRESSION-CHECKLIST.txt','V29-MODIFIED-FILES.txt','V29-DEPLOYMENT-GUIDE.txt'];
const rootFiles=fs.readdirSync(root).filter(name=>fs.statSync(path.join(root,name)).isFile());
const staleReleaseFiles=rootFiles.filter(name=>/^V\d/i.test(name)&&!currentDocs.includes(name));
if(staleReleaseFiles.length)fail('historical release files remain in package root: '+staleReleaseFiles.join(', '));
for(const required of currentDocs)if(!rootFiles.includes(required))fail('missing current release document: '+required);
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const cfg=JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
if(pkg.version!==releaseSemver)fail('package.json version is not '+releaseSemver);
if(cfg.version!==releaseVersion)fail('config.json version is not '+releaseVersion);
if(cfg.buildId!=='v29-github-vercel-dual-runtime-20260815')fail('config.json buildId is incorrect');
if(cfg.baseUrl!=='https://api.evolink.ai/v1')fail('config.json EvoLink Base URL is incorrect');
if(cfg.apiKey!=='')fail('config.json must not ship an API key');
if(!cfg.imageProvider||cfg.imageProvider.defaultModel!=='gemini-3.1-flash-lite-image')fail('config.json imageProvider default model is missing');
if(!html.includes('<title>V29 · 图灵线框工作台</title>'))fail('page title is not V29');
if(!html.includes('src/core/deployment-runtime.js?v=29.0.0'))fail('V29 deployment runtime is not loaded');
if(!html.includes('?v=29.0.0'))fail('HTML cache version is not 29.0.0');
if(html.includes('?v=27.3.2'))fail('stale V27.3.2 cache query remains in index.html');
const launcher=fs.readFileSync(path.join(root,'start.bat'),'utf8');
for(const token of ['set "EXPECTED_VERSION=V29"','set "EXPECTED_BUILD=v29-github-vercel-dual-runtime-20260815"','?v=29.0.0'])if(!launcher.includes(token))fail('Windows launcher V29 metadata is incomplete: '+token);

const vercel=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
if(vercel.buildCommand!=='node scripts/build-vercel.js'||vercel.outputDirectory!=='dist')fail('V29 Vercel build/output configuration is incomplete');
if(!Array.isArray(vercel.rewrites)||!vercel.rewrites.some(x=>x.source==='/api/:path*'&&String(x.destination).startsWith('/api/index')))fail('V29 Vercel API catch-all rewrite is missing');
const deploymentSource=fs.readFileSync(path.join(root,'src/core/deployment-runtime.js'),'utf8');
for(const token of ['MAX_FUNCTION_BODY_BYTES=4200000','X-App-Access-Code','vercel_payload_limit','v29-runtime-ready'])if(!deploymentSource.includes(token))fail('V29 hosted runtime guard is incomplete: '+token);
for(const token of ["HOSTED_RUNTIME?'vercel-serverless':'windows-local'",'AI_LINKUANG_ACCESS_CODE','EVOLINK_API_KEY','RUNTIME_DATA_ROOT','module.exports={handler:handleRequest'])if(!nodeServerSource.includes(token))fail('V29 dual-runtime server bridge is incomplete: '+token);
const apiEntry=fs.readFileSync(path.join(root,'api/index.js'),'utf8');
if(!apiEntry.includes("require('../server')")||!apiEntry.includes('normalizedApiUrl'))fail('V29 Vercel API entry is incomplete');
const build=cp.spawnSync(process.execPath,['scripts/build-vercel.js'],{cwd:root,encoding:'utf8'});
if(build.status!==0)fail('V29 Vercel build failed\n'+build.stderr);
for(const required of ['index.html','version.json','styles/base/layout.css','src/core/deployment-runtime.js','assets/wolassen/02.jpg'])if(!fs.existsSync(path.join(root,'dist',required)))fail('V29 dist is missing '+required);
for(const forbidden of ['config.json','copy-coze.private.json','server.js','server.py','tests'])if(fs.existsSync(path.join(root,'dist',forbidden)))fail('V29 dist leaks non-public file '+forbidden);

if(!process.exitCode) console.log(`Verified ${refs.length} HTML assets, ${expectedWireframes.length} built-in JPEGs and all src JavaScript modules.`);
