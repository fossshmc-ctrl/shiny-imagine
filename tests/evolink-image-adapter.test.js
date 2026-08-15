'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const adapter=require('../src/core/evolink-image-adapter.js');

test('V26 EvoLink defaults point at the real API, not the docs URL',()=>{
  assert.equal(adapter.VERSION,'V28.1.1');
  assert.equal(adapter.DEFAULT_BASE,'https://api.evolink.ai/v1');
  assert.equal(adapter.DEFAULT_MODEL,'gemini-3.1-flash-lite-image');
  assert.equal(adapter.isEvolinkBase('https://api.evolink.ai/v1'),true);
  assert.equal(adapter.isEvolinkDocsUrl('https://evolink.ai/docs/en/api-manual/image-series/nanobanana/nanobanana-2-lite-image-generate'),true);
});

test('EvoLink Base normalizer corrects docs URLs and bare API host',()=>{
  assert.equal(adapter.normalizeEvolinkBase('https://evolink.ai/docs/en/api-manual/image-series/nanobanana/nanobanana-2-lite-image-generate'),'https://api.evolink.ai/v1');
  assert.equal(adapter.normalizeEvolinkBase('https://api.evolink.ai'),'https://api.evolink.ai/v1');
  assert.equal(adapter.normalizeEvolinkBase('https://api.evolink.ai/v1/'),'https://api.evolink.ai/v1');
  assert.equal(adapter.normalizeEvolinkBase('https://api.evolink.ai/v1/images/generations'),'https://api.evolink.ai/v1');
  assert.equal(adapter.normalizeEvolinkBase('https://api.evolink.ai/v1/tasks/task-demo'),'https://api.evolink.ai/v1');
});

test('image model classifier keeps current image families and excludes video/audio',()=>{
  for(const id of ['gemini-3.1-flash-lite-image','nano-banana-2-beta','gpt-image-2','gpt-image-1.5','doubao-seedream-5.0-lite','qwen-image-3.0','qwen-image-edit-plus','z-image-turbo','wan2.5-image-to-image','krea-2-turbo','mj-v8.1','mj-v8.1-retexture']){
    assert.equal(adapter.isImageModelName(id),true,id);
  }
  for(const id of ['sora-2','veo-3.1','seedance-2.0','tts-1','text-embedding-3-large']){
    assert.equal(adapter.isImageModelName(id),false,id);
  }
});

test('Nano Banana 2 Lite request uses unified image generation schema',()=>{
  const body=adapter.buildRequest({model:'gemini-3.1-flash-lite-image',prompt:'product shot',aspect:'3:4',imageUrls:['https://files.evolink.ai/a.png'],resolution:'4K'});
  assert.equal(body.model,'gemini-3.1-flash-lite-image');
  assert.equal(body.prompt,'product shot');
  assert.equal(body.size,'3:4');
  assert.deepEqual(body.image_urls,['https://files.evolink.ai/a.png']);
  assert.equal(body.quality,'1K');
  assert.equal(body.n,undefined);
});

test('GPT Image 2 request maps resolution, quality and native mask_url',()=>{
  const body=adapter.buildRequest({model:'gpt-image-2',prompt:'replace label',aspect:'1:1',imageUrls:['https://files.evolink.ai/base.png'],maskUrl:'https://files.evolink.ai/mask.png',resolution:'4K',quality:'high'});
  assert.equal(body.resolution,'4K');
  assert.equal(body.quality,'high');
  assert.equal(body.mask_url,'https://files.evolink.ai/mask.png');
});

test('GPT Image 1.5 supports up to 16 references and quality without fake resolution field',()=>{
  const body=adapter.buildRequest({model:'gpt-image-1.5',prompt:'edit this',aspect:'3:2',imageUrls:['https://files.evolink.ai/base.png'],quality:'high'});
  assert.equal(body.size,'3:2');
  assert.equal(body.quality,'high');
  assert.equal(body.resolution,undefined);
  assert.deepEqual(body.image_urls,['https://files.evolink.ai/base.png']);
});

test('model-specific reference limits are enforced',()=>{
  assert.throws(()=>adapter.buildRequest({model:'qwen-image-3.0',prompt:'edit',imageUrls:['1','2','3','4']}),/最多支持 3 张/);
  assert.throws(()=>adapter.buildRequest({model:'z-image-turbo',prompt:'edit',imageUrls:['1']}),/不支持参考图/);
  assert.throws(()=>adapter.buildRequest({model:'krea-2-turbo',prompt:'edit',imageUrls:['1']}),/不支持参考图/);
});

test('Krea 2 Turbo is treated as text-to-image only with 1K/2K quality tiers',()=>{
  const body=adapter.buildRequest({model:'krea-2-turbo',prompt:'premium poster',aspect:'16:9',resolution:'4K'});
  assert.equal(body.size,'16:9');
  assert.equal(body.quality,'1K');
  const body2=adapter.buildRequest({model:'krea-2-turbo',prompt:'premium poster',aspect:'1:1',resolution:'2K'});
  assert.equal(body2.quality,'2K');
});

test('Midjourney V8.1 puts reference URLs first, maps aspect into prompt and does not send generic size',()=>{
  const body=adapter.buildRequest({model:'mj-v8.1',prompt:'cinematic product shot',aspect:'16:9',imageUrls:['https://files.evolink.ai/ref.png'],quality:'high'});
  assert.match(body.prompt,/^https:\/\/files\.evolink\.ai\/ref\.png cinematic product shot --ar 16:9$/);
  assert.equal(body.image_urls,undefined);
  assert.equal(body.size,undefined);
  assert.equal(body.quality,'hd');
});

test('Midjourney V8.1 keeps an explicit --ar and Retexture uses image_urls',()=>{
  const main=adapter.buildRequest({model:'mj-v8.1',prompt:'product --ar 3:4',aspect:'16:9',imageUrls:['https://files.evolink.ai/ref.png'],quality:'medium'});
  assert.match(main.prompt,/--ar 3:4$/);
  assert.doesNotMatch(main.prompt,/--ar 16:9/);
  assert.equal(main.quality,'standard');
  const edit=adapter.buildRequest({model:'mj-v8.1-retexture',prompt:'metal texture',imageUrls:['https://files.evolink.ai/ref.png']});
  assert.deepEqual(edit.image_urls,['https://files.evolink.ai/ref.png']);
  assert.equal(edit.size,undefined);
});

test('Midjourney V8.1 remove-background accepts exactly an image and no prompt field',()=>{
  const body=adapter.buildRequest({model:'mj-v8.1-remove-bg',prompt:'',imageUrls:['https://files.evolink.ai/ref.png']});
  assert.equal(body.prompt,undefined);
  assert.deepEqual(body.image_urls,['https://files.evolink.ai/ref.png']);
  assert.throws(()=>adapter.buildRequest({model:'mj-v8.1-remove-bg',prompt:''}),/至少需要 1 张/);
});



test('Node and Python fallback catalogs keep the V26 direct image models in sync',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const nodeServer=fs.readFileSync(path.join(__dirname,'..','server.js'),'utf8');
  const pyServer=fs.readFileSync(path.join(__dirname,'..','server.py'),'utf8');
  for(const id of adapter.BUILTIN_IMAGE_MODELS){
    assert.ok(nodeServer.includes(id),'Node catalog missing '+id);
    assert.ok(pyServer.includes(id),'Python catalog missing '+id);
  }
  assert.match(nodeServer,/https:\/\/api\.evolink\.ai\/v1/);
  assert.match(pyServer,/https:\/\/api\.evolink\.ai\/v1/);
});

test('fallback image catalog includes current direct Nano Pro Beta and Midjourney V7 remove-bg models',()=>{
  assert.ok(adapter.BUILTIN_IMAGE_MODELS.includes('nano-banana-pro-beta'));
  assert.ok(adapter.BUILTIN_IMAGE_MODELS.includes('mj-v7-remove-bg'));
  const merged=adapter.mergeImageModels([]);
  assert.ok(merged.includes('nano-banana-pro-beta'));
  assert.ok(merged.includes('mj-v7-remove-bg'));
});

test('Seedream 5 profiles map current reference and quality constraints',()=>{
  const pro=adapter.modelProfile('doubao-seedream-5.0-pro');
  assert.equal(pro.maxRefs,10);
  assert.equal(pro.maxBytes,30*1024*1024);
  const proReq=adapter.buildRequest({model:'doubao-seedream-5.0-pro',prompt:'poster',aspect:'1:1',resolution:'4K'});
  assert.equal(proReq.quality,'2K');
  const pro2=adapter.buildRequest({model:'doubao-seedream-5.0-pro',prompt:'poster',aspect:'1:1',resolution:'2K'});
  assert.equal(pro2.quality,'2K');
  const lite=adapter.modelProfile('doubao-seedream-5.0-lite');
  assert.equal(lite.maxRefs,14);
  assert.equal(lite.maxBytes,10*1024*1024);
  assert.equal(adapter.buildRequest({model:'doubao-seedream-5.0-lite',prompt:'poster',aspect:'3:4',resolution:'3K'}).quality,'3K');
  assert.equal(adapter.buildRequest({model:'doubao-seedream-5.0-lite',prompt:'poster',aspect:'3:4',resolution:'4K'}).quality,'4K');
});

test('Wan text-to-image and image-to-image capabilities are kept separate',()=>{
  assert.throws(()=>adapter.buildRequest({model:'wan2.5-text-to-image',prompt:'poster',imageUrls:['https://files.evolink.ai/ref.png']}),/不支持参考图/);
  assert.throws(()=>adapter.buildRequest({model:'wan2.5-image-to-image',prompt:'edit'}),/至少需要 1 张输入图片/);
  const ok=adapter.buildRequest({model:'wan2.5-image-to-image',prompt:'edit',imageUrls:['https://files.evolink.ai/a.png','https://files.evolink.ai/b.png']});
  assert.equal(ok.image_urls.length,2);
  assert.throws(()=>adapter.buildRequest({model:'wan2.5-image-to-image',prompt:'edit',imageUrls:['1','2','3']}),/最多支持 2 张/);
});

test('Qwen edit models require references and V7 remove-bg is image-only',()=>{
  assert.throws(()=>adapter.buildRequest({model:'qwen-image-edit-plus',prompt:'edit'}),/至少需要 1 张输入图片/);
  const q=adapter.buildRequest({model:'qwen-image-edit-plus',prompt:'edit',imageUrls:['https://files.evolink.ai/ref.png']});
  assert.deepEqual(q.image_urls,['https://files.evolink.ai/ref.png']);
  const bg=adapter.buildRequest({model:'mj-v7-remove-bg',prompt:'ignored',imageUrls:['https://files.evolink.ai/ref.png']});
  assert.equal(bg.prompt,undefined);
  assert.deepEqual(bg.image_urls,['https://files.evolink.ai/ref.png']);
});

test('top-level EvoLink async task fields and results are parsed',()=>{
  assert.deepEqual(adapter.taskInfo({id:'task-123',status:'processing',progress:42}),{id:'task-123',status:'processing',progress:42,estimatedTime:null,error:null});
  assert.deepEqual(adapter.extractImages({status:'completed',results:['https://cdn.example/final.png']}),['https://cdn.example/final.png']);
});

test('local Data URL reference is uploaded then used in async image generation request',async()=>{
  const calls=[];
  const fetchJson=async(url,options)=>{
    calls.push({url,options});
    if(url===adapter.FILE_UPLOAD_ENDPOINT)return {success:true,data:{file_url:'https://files.evolink.ai/tmp/ref.png'}};
    if(url===adapter.GENERATE_ENDPOINT){
      const body=JSON.parse(options.body);
      assert.deepEqual(body.image_urls,['https://files.evolink.ai/tmp/ref.png']);
      return {id:'task-1',status:'completed',results:['https://cdn.evolink.ai/out.png']};
    }
    throw new Error('unexpected '+url);
  };
  const tiny='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const result=await adapter.generate({fetchJson,model:'gemini-3.1-flash-lite-image',prompt:'edit this image',refs:[tiny],count:1,aspect:'1:1'});
  assert.deepEqual(result,['https://cdn.evolink.ai/out.png']);
  assert.equal(calls.length,3);
});

test('one async task returning multiple images satisfies count without duplicate submissions',async()=>{
  let generations=0;
  const fetchJson=async(url)=>{
    if(url===adapter.GENERATE_ENDPOINT){generations++;return {id:'task-mj',status:'completed',results:['https://cdn.evolink.ai/1.png','https://cdn.evolink.ai/2.png','https://cdn.evolink.ai/3.png','https://cdn.evolink.ai/4.png']};}
    throw new Error('unexpected '+url);
  };
  const result=await adapter.generate({fetchJson,model:'mj-v8.1',prompt:'product shot',count:3,aspect:'1:1'});
  assert.equal(generations,1);
  assert.equal(result.length,3);
});

test('direct model discovery hides source-task-only Midjourney operations from normal generation picker',()=>{
  for(const id of ['mj-v8.1','mj-v8.1-retexture','mj-v8.1-remove-bg','mj-v7','mj-v7-retexture','mj-v7-remove-bg']){
    assert.equal(adapter.isDirectImageModelName(id),true,id);
  }
  for(const id of ['mj-v8.1-variation','mj-v8.1-remix','mj-v8.1-edit','mj-v8.1-upload-paint','mj-v7-variation','mj-v7-upscale','mj-v7-remix','mj-v7-enhance','mj-v7-pan','mj-v7-outpaint','mj-v7-inpaint','mj-v7-edit','mj-v7-upload-paint']){
    assert.equal(adapter.isImageModelName(id),true,id+' should still be recognized as image-related');
    assert.equal(adapter.isDirectImageModelName(id),false,id+' must not appear in common prompt/reference picker');
  }
  const merged=adapter.mergeImageModels([
    {id:'mj-v8.1-remix',supported_endpoints:['/v1/images/generations'],output_modalities:['image']},
    {id:'mj-v7-upscale',supported_endpoints:['/v1/images/generations'],output_modalities:['image']},
    {id:'gemini-3.1-flash-lite-image',supported_endpoints:['/v1/images/generations'],output_modalities:['image']},
    {id:'mj-v8.1-retexture',supported_endpoints:['/v1/images/generations'],output_modalities:['image']}
  ]);
  assert.equal(merged.includes('mj-v8.1-remix'),false);
  assert.equal(merged.includes('mj-v7-upscale'),false);
  assert.equal(merged.includes('gemini-3.1-flash-lite-image'),true);
  assert.equal(merged.includes('mj-v8.1-retexture'),true);
});


test('V26 treats relative, blob and loopback references as local sources that must be materialized',()=>{
  assert.equal(adapter.isLocalReferenceSource('/assets/wolassen/02.jpg?v=demo'),true);
  assert.equal(adapter.isLocalReferenceSource('./assets/lebao/03.jpg'),true);
  assert.equal(adapter.isLocalReferenceSource('blob:http://127.0.0.1:8787/demo'),true);
  assert.equal(adapter.isLocalReferenceSource('http://127.0.0.1:8787/assets/wolassen/02.jpg'),true);
  assert.equal(adapter.isLocalReferenceSource('https://files.evolink.ai/tmp/ref.png'),false);
});

test('V26 converts a relative built-in wireframe asset to Data URL before EvoLink file upload',async()=>{
  const calls=[];
  const fetchSource=async(url)=>{
    calls.push({kind:'source',url});
    return new Response(new Blob([Buffer.from([0xff,0xd8,0xff,0xd9])],{type:'image/jpeg'}),{status:200,headers:{'content-type':'image/jpeg'}});
  };
  const fetchJson=async(url,options)=>{
    calls.push({kind:'api',url,options});
    if(url===adapter.FILE_UPLOAD_ENDPOINT){
      const body=JSON.parse(options.body);
      assert.match(body.base64_data,/^data:image\/jpeg;base64,/);
      return {success:true,data:{file_url:'https://files.evolink.ai/tmp/wire.jpg'}};
    }
    if(url===adapter.GENERATE_ENDPOINT){
      const body=JSON.parse(options.body);
      assert.deepEqual(body.image_urls,['https://files.evolink.ai/tmp/wire.jpg']);
      return {id:'task-local-wire',status:'completed',results:['https://cdn.evolink.ai/wire-out.png']};
    }
    throw new Error('unexpected '+url);
  };
  const result=await adapter.generate({fetchJson,fetchSource,model:'doubao-seedream-4.5',prompt:'replace only text',refs:['/assets/wolassen/02.jpg?v=26'],count:1,aspect:'3:4'});
  assert.deepEqual(result,['https://cdn.evolink.ai/wire-out.png']);
  assert.equal(calls.filter(x=>x.kind==='source').length,1);
  assert.equal(calls.filter(x=>x.kind==='api').length,3);
});

test('V26 keeps public reference URLs untouched and does not re-upload them',async()=>{
  let uploads=0;
  const fetchJson=async(url,options)=>{
    if(url===adapter.FILE_UPLOAD_ENDPOINT){uploads++;throw new Error('public URL must not be uploaded');}
    if(url===adapter.GENERATE_ENDPOINT){
      const body=JSON.parse(options.body);
      assert.deepEqual(body.image_urls,['https://files.evolink.ai/ref/public.png']);
      return {id:'task-public-ref',status:'completed',results:['https://cdn.evolink.ai/result.png']};
    }
    throw new Error('unexpected '+url);
  };
  const result=await adapter.generate({fetchJson,model:'gemini-3.1-flash-lite-image',prompt:'edit',refs:['https://files.evolink.ai/ref/public.png']});
  assert.deepEqual(result,['https://cdn.evolink.ai/result.png']);
  assert.equal(uploads,0);
});

test('V26 model parameter adaptation keeps Nano, Seedream, GPT Image and Midjourney controls distinct',()=>{
  const nano=adapter.modelParameterSchema('gemini-3.1-flash-image-preview');
  const seed=adapter.modelParameterSchema('doubao-seedream-4.5');
  const gpt=adapter.modelParameterSchema('gpt-image-2');
  const mj=adapter.modelParameterSchema('mj-v8.1');
  assert.equal(nano.showQuality,false);
  assert.ok(nano.resolutionOptions.includes('4K'));
  assert.deepEqual(seed.resolutionOptions,['2K','4K']);
  assert.equal(gpt.showResolution,true);
  assert.equal(gpt.showQuality,true);
  assert.equal(mj.showResolution,false);
  assert.equal(mj.showQuality,true);
  assert.ok(mj.aspectOptions.includes('16:9'));
});

test('V26.2.3 merges live EvoLink model catalog metadata into a newly discovered image model',()=>{
  const rows=[{
    id:'future-image-model-2026',
    supported_endpoints:['/v1/images/generations'],
    input_modalities:['text','image'],
    output_modalities:['image'],
    max_input_images:6,
    aspect_ratios:['1:1','2:3','16:9'],
    resolutions:['1K','3K'],
    qualities:['draft','hd']
  }];
  assert.equal(adapter.ingestRemoteModels(rows),1);
  const merged=adapter.mergeImageModels(rows);
  assert.ok(merged.includes('future-image-model-2026'));
  const cap=adapter.remoteModelCapability('future-image-model-2026');
  assert.equal(cap.supportsImageInput,true);
  assert.equal(cap.maxRefs,6);
  const profile=adapter.modelProfile('future-image-model-2026');
  assert.equal(profile.dynamic,true);
  assert.equal(profile.maxRefs,6);
  const schema=adapter.modelParameterSchema('future-image-model-2026');
  assert.equal(schema.dynamic,true);
  assert.deepEqual(schema.aspectOptions,['1:1','2:3','16:9']);
  assert.deepEqual(schema.resolutionOptions,['1K','3K']);
  assert.deepEqual(schema.qualityOptions.map(x=>x.value),['draft','hd']);
});

test('V26.2.3 respects a live catalog declaration that a model does not accept image input',()=>{
  adapter.ingestRemoteModels([{id:'future-t2i-image-model',supported_endpoints:['/v1/images/generations'],input_modalities:['text'],output_modalities:['image']}]);
  const profile=adapter.modelProfile('future-t2i-image-model');
  assert.equal(profile.dynamic,true);
  assert.equal(profile.maxRefs,0);
});
