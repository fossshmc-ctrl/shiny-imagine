const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {JsonCollection}=require('../local-data-store');

const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('V26 wireframe history button has a real opener and backend persistence endpoints',()=>{
  const generation=read('src/features/wireframe/wireframe-generation.js');
  const router=read('src/app/router-events.js');
  const server=read('server.js');
  assert.match(generation,/async function openHist\(targetGroup\)/);
  assert.match(router,/openHist\(\+wfhist\.dataset\.wfhist\)/);
  assert.match(server,/\/api\/wireframe-history/);
  assert.match(server,/wireframe-history-assets/);
});

test('V26 removes pre-generation layout-field-check UI and blocking generation flow',()=>{
  const files=['src/features/wireframe/wireframe-library.js','src/components/wireframe-picker.js','src/app/router-events.js','src/features/prompt/prompt-composition.js','src/features/wireframe/wireframe-persistence.js'];
  const source=files.map(read).join('\n');
  assert.doesNotMatch(source,/生成前版式字段检查/);
  assert.doesNotMatch(source,/data-layout-check/);
  assert.doesNotMatch(source,/runLayoutFieldCheck/);
});

test('V26 normal copy-to-wireframe path auto-confirms task JSON',()=>{
  const prompt=read('src/features/prompt/prompt-composition.js');
  const router=read('src/app/router-events.js');
  assert.match(prompt,/V26 生成前自动确认任务 JSON/);
  assert.match(router,/V26 文案确认后自动确认任务 JSON/);
  assert.doesNotMatch(prompt,/openTaskJsonDiff/);
});

test('V26 image task center persists async task lifecycle without re-submission',()=>{
  const client=read('src/infrastructure/api/image-api-client.js');
  const server=read('server.js');
  assert.match(client,/function openImageTaskCenter\(/);
  assert.match(client,/\/api\/image-tasks/);
  assert.match(client,/\/api\/tasks\/.*taskId/);
  assert.match(server,/\/api\/image-tasks/);
  assert.match(client,/taskId/);
  assert.match(client,/resultUrls/);
  assert.match(client,/async function resumePendingImageTasksOnce/);
  assert.doesNotMatch(client,/resumePendingImageTasksOnce[\s\S]{0,900}images\/generations/);
});

test('V26 image controls are driven by model-specific parameter schemas',()=>{
  const adapter=read('src/core/evolink-image-adapter.js');
  const image=read('src/features/image/image-generation.js');
  assert.match(adapter,/function modelParameterSchema\(model\)/);
  assert.match(adapter,/family==='nano-lite'/);
  assert.match(adapter,/family==='seedream'/);
  assert.match(adapter,/family==='gpt-image-2'/);
  assert.match(adapter,/family==='midjourney-main'/);
  assert.match(image,/function imageModelParameterUi\(/);
  assert.match(image,/normalizeModelOptions/);
});

test('JsonCollection survives process-style re-instantiation and preserves task/history fields',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'v26-store-'));
  const file=path.join(dir,'items.json');
  const first=new JsonCollection(file,{maxItems:20});
  first.upsert({id:'task-1',taskId:'remote-123',model:'gpt-image-2',prompt:'demo',status:'processing',progress:42,resultUrls:[]});
  const second=new JsonCollection(file,{maxItems:20});
  const item=second.get('task-1');
  assert.equal(item.taskId,'remote-123');
  assert.equal(item.model,'gpt-image-2');
  assert.equal(item.status,'processing');
  assert.equal(item.progress,42);
  second.upsert({...item,status:'completed',progress:100,resultUrls:['https://example.test/result.png']});
  assert.equal(new JsonCollection(file).get('task-1').resultUrls[0],'https://example.test/result.png');
  fs.rmSync(dir,{recursive:true,force:true});
});
