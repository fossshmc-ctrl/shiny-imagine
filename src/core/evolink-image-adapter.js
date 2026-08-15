/* V27.9 EvoLink image adapter: resilient same-task polling + task-state performance decomposition. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.EvoLinkImageAdapter=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='V28.1.1';
  const DEFAULT_BASE='https://api.evolink.ai/v1';
  const FILE_UPLOAD_ENDPOINT='/api/evolink/files/upload/reference';
  const GENERATE_ENDPOINT='/api/images/generations';
  const DEFAULT_MODEL='gemini-3.1-flash-lite-image';
  const POLL_INTERVAL_MS=1400;
  const POLL_SOFT_TIMEOUT_MS=180000;
  const POLL_TIMEOUT_MS=360000;
  const POLL_MAX_TIMEOUT_MS=480000;
  const POLL_RETRY_DELAYS_MS=[600,1500,3000];
  const MICRO_UPLOAD_CONCURRENCY=2;
  // Direct prompt/reference-driven image routes that the current UI can use without a source task id.
  // Remote /models discovery is still authoritative: this list is only the offline/fallback catalog.
  const BUILTIN_IMAGE_MODELS=[
    'gemini-3.1-flash-lite-image',
    'gemini-3.1-flash-image-preview',
    'gemini-3-pro-image-preview',
    'nano-banana-pro-beta',
    'nano-banana-2-beta',
    'nano-banana-2-lite-beta',
    'nano-banana-beta',
    'gemini-2.5-flash-image',
    'gpt-image-2',
    'gpt-image-2-beta',
    'gpt-image-1.5',
    'doubao-seedream-5.0-pro',
    'doubao-seedream-5.0-lite',
    'doubao-seedream-4.5',
    'doubao-seedream-4.0',
    'qwen-image-3.0',
    'qwen-image-3.0-pro',
    'qwen-image-edit',
    'qwen-image-edit-plus',
    'wan2.5-text-to-image',
    'wan2.5-image-to-image',
    'z-image-turbo',
    'krea-2-turbo',
    'mj-v8.1',
    'mj-v8.1-retexture',
    'mj-v8.1-remove-bg',
    'mj-v7',
    'mj-v7-retexture',
    'mj-v7-remove-bg'
  ];
  const uploadCache=new Map();
  const remoteCapabilityMap=new Map();
  function arrayValue(v){return Array.isArray(v)?v.filter(x=>x!=null).map(String):[];}
  function firstArray(obj,keys){for(const k of keys){const v=obj&&obj[k];if(Array.isArray(v)&&v.length)return v;}return [];}
  function firstNumber(obj,keys){for(const k of keys){const n=Number(obj&&obj[k]);if(Number.isFinite(n)&&n>=0)return n;}return null;}
  function normalizeRemoteModelCapability(model){
    if(!model||typeof model==='string')return model?{id:String(model),dynamic:true}:null;
    const arch=model.architecture||{},caps=model.capabilities||{},params=model.parameters||model.parameter_schema||model.schema||{};
    const id=modelName(model);if(!id)return null;
    const endpoints=firstArray(model,['supported_endpoints','endpoints']).length?firstArray(model,['supported_endpoints','endpoints']):firstArray(arch,['supported_endpoints','endpoints']);
    const input=firstArray(model,['input_modalities','modalities_in','input_types']).length?firstArray(model,['input_modalities','modalities_in','input_types']):firstArray(arch,['input_modalities','modalities_in','input_types']);
    const output=firstArray(model,['output_modalities','modalities_out','output_types']).length?firstArray(model,['output_modalities','modalities_out','output_types']):firstArray(arch,['output_modalities','modalities_out','output_types']);
    const capList=Array.isArray(caps)?arrayValue(caps):Object.entries(caps||{}).filter(([,v])=>v===true).map(([k])=>k);
    const all=[...endpoints,...input,...output,...capList].join(' ').toLowerCase();
    const supportsGeneration=endpoints.some(x=>/images\/generations/i.test(x))||/image/.test(all)||isImageModelName(id);
    const explicitImageInput=input.length?input.some(x=>/image/i.test(x)):null;
    const maxRefs=firstNumber(model,['max_input_images','max_images','max_reference_images','reference_image_limit'])??firstNumber(params,['max_input_images','max_images','max_reference_images','reference_image_limit']);
    const aspects=firstArray(model,['aspect_ratios','supported_aspect_ratios']).length?firstArray(model,['aspect_ratios','supported_aspect_ratios']):firstArray(params,['aspect_ratios','supported_aspect_ratios','size_options']);
    const resolutions=firstArray(model,['resolutions','supported_resolutions']).length?firstArray(model,['resolutions','supported_resolutions']):firstArray(params,['resolutions','supported_resolutions','resolution_options']);
    const qualities=firstArray(model,['qualities','supported_qualities','quality_options']).length?firstArray(model,['qualities','supported_qualities','quality_options']):firstArray(params,['qualities','supported_qualities','quality_options']);
    return {id,dynamic:true,endpoints,inputModalities:input,outputModalities:output,supportsGeneration,supportsImageInput:explicitImageInput,maxRefs,aspectOptions:aspects.map(x=>String(x).replace('×',':')),resolutionOptions:resolutions.map(x=>String(x).toUpperCase()),qualityOptions:qualities.map(x=>String(x)),raw:model};
  }
  function ingestRemoteModels(raw){
    const list=Array.isArray(raw)?raw:[];let count=0;
    for(const m of list){const c=normalizeRemoteModelCapability(m);if(c&&c.id){remoteCapabilityMap.set(c.id.toLowerCase(),c);count++;}}
    return count;
  }
  function remoteModelCapability(model){return remoteCapabilityMap.get(String(model||'').toLowerCase())||null;}

  function cleanBase(v){return String(v||'').trim().replace(/\/+$/,'');}
  function isEvolinkBase(v){
    try{const u=new URL(cleanBase(v));return /^(api|direct)\.evolink\.ai$/i.test(u.hostname);}
    catch(_e){return false;}
  }
  function isEvolinkDocsUrl(v){
    try{const u=new URL(String(v||'').trim());return /(^|\.)evolink\.ai$/i.test(u.hostname)&&/\/docs\//i.test(u.pathname);}
    catch(_e){return false;}
  }
  function normalizeEvolinkBase(v){
    const raw=cleanBase(v);
    if(!raw||isEvolinkDocsUrl(raw))return DEFAULT_BASE;
    try{
      const u=new URL(raw);
      if(/^api\.evolink\.ai$/i.test(u.hostname)){
        if(!u.pathname||u.pathname==='/'||/^\/v1(?:\/)?$/i.test(u.pathname)||/^\/v1\/(?:images\/generations|tasks(?:\/.*)?|models)(?:\/)?$/i.test(u.pathname))u.pathname='/v1';
        u.search='';u.hash='';
        return cleanBase(u.toString());
      }
    }catch(_e){}
    return raw;
  }
  function modelName(m){return typeof m==='string'?m:(m&&(m.id||m.name||m.model||m.object))||'';}
  function isImageModelName(value){
    const id=String(value||'').toLowerCase();
    if(!id)return false;
    if(/(?:text|image)[-_ ]?to[-_ ]?video|reference[-_ ]?to[-_ ]?video|\b(?:video|veo|sora|kling|seedance|audio|tts|speech|music|embedding|rerank)\b/.test(id))return false;
    return /(image|img|dall|gpt[-_ ]?image|nano[-_ ]?banana|nanobanana|gemini.*image|seedream|seededit|midjourney|\bmj[-_ ]?v|flux|stable|sdxl|sd3|imagen|recraft|ideogram|krea|qwen.*image|wan.*image|z[-_ ]?image|kolors|paint|inpaint|outpaint)/i.test(id);
  }
  function isImageModelObject(m){
    if(typeof m==='string')return isImageModelName(m);
    const eps=(m&&m.supported_endpoints)||((m&&m.architecture&&m.architecture.supported_endpoints)||[]);
    const out=(m&&m.output_modalities)||((m&&m.architecture&&m.architecture.output_modalities)||[]);
    if(Array.isArray(eps)&&eps.some(x=>/images\/generations/i.test(String(x))))return true;
    if(Array.isArray(out)&&out.some(x=>/^image$/i.test(String(x))))return true;
    return isImageModelName(modelName(m));
  }
  // Midjourney exposes several follow-up task operations in /models. They still output images,
  // but variation/remix/upscale/canvas operations require a source task_id (or dedicated canvas
  // payload) and cannot be invoked correctly from the common prompt/reference generation UI.
  // Keep direct prompt/reference-driven operations in the normal model picker and hide only
  // source-task/canvas-only operations, preventing a model that looks selectable but always fails.
  function isDirectImageModelName(value){
    const id=String(value||'').toLowerCase();
    if(!isImageModelName(id))return false;
    if(/^mj-v8\.1-(?:variation|remix|edit|upload-paint)$/i.test(id))return false;
    if(/^mj-v7-(?:variation|upscale|remix|enhance|pan|outpaint|inpaint|edit|upload-paint)$/i.test(id))return false;
    return true;
  }
  function isDirectImageModelObject(m){
    const id=modelName(m);
    if(!isDirectImageModelName(id))return false;
    if(typeof m==='string')return true;
    return isImageModelObject(m);
  }
  function unique(list){return [...new Set((list||[]).filter(Boolean))];}
  function mergeImageModels(raw){
    ingestRemoteModels(raw);
    const dynamic=(Array.isArray(raw)?raw:[]).filter(isDirectImageModelObject).map(modelName).filter(Boolean);
    return unique([DEFAULT_MODEL,...dynamic,...BUILTIN_IMAGE_MODELS]);
  }
  function normalizeAspect(v){
    const s=String(v||'auto').trim().replace('×',':');
    if(s==='auto')return 'auto';
    if(/^\d+\s*:\s*\d+$/.test(s))return s.replace(/\s+/g,'');
    const m=s.match(/^(\d+)x(\d+)$/i);if(m){const w=Number(m[1]),h=Number(m[2]);if(w&&h){const r=w/h;if(r>1.65)return '16:9';if(r>1.2)return '4:3';if(r<0.61)return '9:16';if(r<0.83)return '3:4';return '1:1';}}
    return '1:1';
  }
  function normalizeResolution(v){const s=String(v||'2K').toUpperCase().replace(/\s/g,'');if(s==='0.5K')return '0.5K';if(s.includes('4'))return '4K';if(s.includes('3'))return '3K';if(s.includes('2'))return '2K';return '1K';}
  function normalizeQuality(v){const s=String(v||'medium').toLowerCase();if(/高|high/.test(s))return'high';if(/低|low/.test(s))return'low';return'medium';}
  function staticModelProfile(model){
    const id=String(model||'').toLowerCase();
    if(id==='gemini-3.1-flash-lite-image'||id==='nano-banana-2-lite-beta')return {family:'nano-lite',maxRefs:14,maxBytes:20*1024*1024,qualityStyle:'lite1k',supportsMask:false,sendSize:true};
    if(id==='gemini-3.1-flash-image-preview')return {family:'nano-2',maxRefs:14,maxBytes:20*1024*1024,qualityStyle:'resolution-quality',supportsMask:false,sendSize:true};
    if(id==='gemini-3-pro-image-preview')return {family:'nano-pro',maxRefs:14,maxBytes:20*1024*1024,qualityStyle:'resolution-quality',supportsMask:false,sendSize:true};
    if(id==='nano-banana-pro-beta')return {family:'nano-pro-beta',maxRefs:10,maxBytes:10*1024*1024,qualityStyle:'resolution-quality',supportsMask:false,sendSize:true};
    if(id==='nano-banana-2-beta')return {family:'nano-2-beta',maxRefs:14,maxBytes:20*1024*1024,qualityStyle:'resolution-quality',supportsMask:false,sendSize:true};
    if(/^gpt-image-2(?:$|-)/.test(id))return {family:'gpt-image-2',maxRefs:16,maxBytes:50*1024*1024,qualityStyle:id==='gpt-image-2-beta'?'gpt-beta':'gpt',supportsMask:id==='gpt-image-2',sendSize:true};
    if(/^gpt-image-1\.5/.test(id))return {family:'gpt-image-1.5',maxRefs:16,maxBytes:50*1024*1024,qualityStyle:'gpt15',supportsMask:false,sendSize:true};
    if(id==='doubao-seedream-5.0-pro')return {family:'seedream-5-pro',maxRefs:10,maxBytes:30*1024*1024,qualityStyle:'seedream-5-pro',supportsMask:false,sendSize:true};
    if(id==='doubao-seedream-5.0-lite')return {family:'seedream-5-lite',maxRefs:14,maxBytes:10*1024*1024,qualityStyle:'seedream-5-lite',supportsMask:false,sendSize:true};
    if(/seedream/.test(id))return {family:'seedream',maxRefs:14,maxBytes:10*1024*1024,qualityStyle:'resolution-quality',supportsMask:false,sendSize:true};
    if(id==='qwen-image-3.0'||id==='qwen-image-3.0-pro')return {family:'qwen-image-3',maxRefs:3,maxBytes:0,qualityStyle:'qwen-3',supportsMask:false,sendSize:true};
    if(id==='qwen-image-edit'||id==='qwen-image-edit-plus')return {family:'qwen-image-edit',maxRefs:3,maxBytes:0,qualityStyle:'none',supportsMask:false,sendSize:true,requiresRefs:true};
    if(id==='krea-2-turbo')return {family:'krea-2-turbo',maxRefs:0,maxBytes:0,qualityStyle:'krea',supportsMask:false,sendSize:true};
    if(id==='mj-v8.1'||id==='mj-v7')return {family:'midjourney-main',maxRefs:Number.POSITIVE_INFINITY,maxBytes:0,qualityStyle:id==='mj-v8.1'?'midjourney-v81':'none',supportsMask:false,sendSize:false};
    if(id==='mj-v8.1-retexture'||id==='mj-v7-retexture')return {family:'midjourney-retexture',maxRefs:1,maxBytes:0,qualityStyle:'none',supportsMask:false,sendSize:false,requiresRefs:true};
    if(id==='mj-v8.1-remove-bg'||id==='mj-v7-remove-bg')return {family:'midjourney-remove-bg',maxRefs:1,maxBytes:0,qualityStyle:'none',supportsMask:false,sendSize:false,promptOptional:true,requiresRefs:true};
    if(/nano-banana-beta|gemini-2\.5-flash-image/.test(id))return {family:'nano-beta',maxRefs:5,maxBytes:10*1024*1024,qualityStyle:'none',supportsMask:false,sendSize:true};
    if(id==='wan2.5-text-to-image')return {family:'wan-text-to-image',maxRefs:0,maxBytes:0,qualityStyle:'none',supportsMask:false,sendSize:true};
    if(id==='wan2.5-image-to-image')return {family:'wan-image-to-image',maxRefs:2,maxBytes:10*1024*1024,qualityStyle:'none',supportsMask:false,sendSize:true,requiresRefs:true};
    if(/z[-_ ]?image/.test(id))return {family:'z-image',maxRefs:0,maxBytes:0,qualityStyle:'none',supportsMask:false,sendSize:true};
    return {family:'generic-image',maxRefs:14,maxBytes:20*1024*1024,qualityStyle:'none',supportsMask:false,sendSize:true};
  }
  function modelProfile(model){
    const base=staticModelProfile(model),remote=remoteModelCapability(model);if(!remote)return base;
    const out=Object.assign({},base,{dynamic:true,remoteCapabilities:remote});
    if(remote.supportsImageInput===false)out.maxRefs=0;
    else if(Number.isFinite(remote.maxRefs))out.maxRefs=remote.maxRefs;
    return out;
  }
  function modelParameterSchema(model){
    const id=String(model||DEFAULT_MODEL).toLowerCase(),p=modelProfile(id);
    const commonAspect=['1:1','3:4','4:3','9:16','16:9'];
    const nanoAspect=['auto','1:1','1:4','4:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9'];
    const seedAspect=['auto','1:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','21:9','9:21'];
    const gptAspect=['auto','1:1','1:2','2:1','1:3','3:1','2:3','3:2','3:4','4:3','4:5','5:4','9:16','16:9','9:21','21:9'];
    const out={family:p.family,model:String(model||DEFAULT_MODEL),aspectOptions:commonAspect,resolutionOptions:['1K','2K','4K'],qualityOptions:[{value:'低',label:'低'},{value:'中',label:'中'},{value:'高',label:'高'}],showResolution:true,showQuality:false,defaultAspect:'1:1',defaultResolution:'2K',defaultQuality:'中',hint:'按当前模型自动适配参数'};
    if(p.family==='nano-lite'){Object.assign(out,{aspectOptions:nanoAspect,resolutionOptions:['1K'],showResolution:false,showQuality:false,defaultResolution:'1K',hint:'Nano Banana Lite：输出档位固定为 1K，画幅按模型支持范围自适配'});}
    else if(/^nano-/.test(p.family)){Object.assign(out,{aspectOptions:nanoAspect,resolutionOptions:['0.5K','1K','2K','4K'],showResolution:true,showQuality:false,defaultResolution:'2K',hint:'Nano Banana：分辨率档位由模型 quality 参数承载'});}
    else if(p.family==='seedream'){Object.assign(out,{aspectOptions:seedAspect,resolutionOptions:['2K','4K'],showResolution:true,showQuality:false,defaultResolution:'2K',hint:'Seedream 4.x：仅显示模型支持的 2K / 4K 档位'});}
    else if(p.family==='seedream-5-lite'){Object.assign(out,{aspectOptions:seedAspect,resolutionOptions:['2K','4K'],showResolution:true,showQuality:false,defaultResolution:'2K',hint:'Seedream 5 Lite：按 2K / 4K 输出档位适配'});}
    else if(p.family==='seedream-5-pro'){Object.assign(out,{aspectOptions:seedAspect,resolutionOptions:['1K','2K'],showResolution:true,showQuality:false,defaultResolution:'2K',hint:'Seedream 5 Pro：按当前适配器支持的 1K / 2K 档位提交'});}
    else if(p.family==='gpt-image-2'){Object.assign(out,{aspectOptions:gptAspect,resolutionOptions:p.qualityStyle==='gpt-beta'?['1K']:['1K','2K','4K'],showResolution:p.qualityStyle!=='gpt-beta',showQuality:p.qualityStyle==='gpt',defaultResolution:p.qualityStyle==='gpt-beta'?'1K':'2K',hint:p.qualityStyle==='gpt-beta'?'GPT Image 2 Beta：分辨率固定 1K':'GPT Image 2：分辨率与质量独立适配'});}
    else if(p.family==='gpt-image-1.5'){Object.assign(out,{aspectOptions:gptAspect,showResolution:false,showQuality:true,hint:'GPT Image 1.5：使用模型质量档位，尺寸按画幅提交'});}
    else if(p.family==='midjourney-main'){Object.assign(out,{aspectOptions:['1:1','2:3','3:2','3:4','4:3','9:16','16:9','21:9'],showResolution:false,showQuality:p.qualityStyle==='midjourney-v81',qualityOptions:[{value:'中',label:'Standard'},{value:'高',label:'HD'}],defaultQuality:'中',hint:p.qualityStyle==='midjourney-v81'?'Midjourney V8.1：画幅写入 --ar，质量使用 Standard / HD':'Midjourney：画幅写入 Prompt 的 --ar 参数'});}
    else if(p.family==='krea-2-turbo'){Object.assign(out,{resolutionOptions:['1K','2K'],showResolution:true,showQuality:false,defaultResolution:'1K',hint:'Krea：仅显示当前适配器支持的输出档位'});}
    else if(p.family==='qwen-image-3'){Object.assign(out,{resolutionOptions:['1K','2K'],showResolution:true,showQuality:false,defaultResolution:'2K',hint:'Qwen Image 3：按 1K / 2K 档位提交'});}
    else if(p.qualityStyle==='none'){Object.assign(out,{showResolution:false,showQuality:false,hint:'当前模型无需通用 resolution / quality 参数；仅提交适用参数'});}
    const remote=remoteModelCapability(model);
    if(remote){
      if(remote.aspectOptions&&remote.aspectOptions.length){out.aspectOptions=unique(remote.aspectOptions.map(normalizeAspect));if(!out.aspectOptions.includes(out.defaultAspect))out.defaultAspect=out.aspectOptions[0]||out.defaultAspect;}
      if(remote.resolutionOptions&&remote.resolutionOptions.length){out.resolutionOptions=unique(remote.resolutionOptions.map(normalizeResolution));out.showResolution=out.resolutionOptions.length>1;if(!out.resolutionOptions.includes(out.defaultResolution))out.defaultResolution=out.resolutionOptions[0]||out.defaultResolution;}
      if(remote.qualityOptions&&remote.qualityOptions.length){out.qualityOptions=unique(remote.qualityOptions).map(v=>({value:v,label:v}));out.showQuality=out.qualityOptions.length>0;if(!out.qualityOptions.some(x=>x.value===out.defaultQuality))out.defaultQuality=out.qualityOptions[0]&&out.qualityOptions[0].value||out.defaultQuality;}
      out.dynamic=true;out.hint=(out.hint||'')+' · 已合并 EvoLink /models 动态能力';
    }
    return out;
  }
  function normalizeModelOptions(model,options){
    const s=modelParameterSchema(model),o=options||{};
    let aspect=normalizeAspect(o.aspect||s.defaultAspect),resolution=normalizeResolution(o.resolution||s.defaultResolution),quality=String(o.quality||s.defaultQuality||'中');
    if(!s.aspectOptions.includes(aspect))aspect=s.defaultAspect;
    if(!s.resolutionOptions.includes(resolution))resolution=s.defaultResolution;
    if(!s.qualityOptions.some(x=>x.value===quality))quality=s.defaultQuality;
    return {aspect,resolution,quality,schema:s};
  }
  function dataUrlBytes(src){
    const s=String(src||'');if(!/^data:/i.test(s))return 0;const idx=s.indexOf(',');if(idx<0)return 0;const payload=s.slice(idx+1).replace(/\s/g,'');return Math.floor(payload.length*3/4)-((payload.endsWith('==')?2:payload.endsWith('=')?1:0));
  }
  function quickHash(s){let h=2166136261;const text=String(s||'');for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16)+':'+text.length;}
  function isLoopbackHost(host){
    const h=String(host||'').toLowerCase().replace(/^\[|\]$/g,'');
    return h==='localhost'||h==='127.0.0.1'||h==='::1'||/^127\./.test(h);
  }
  function browserLocation(){
    try{return typeof location!=='undefined'&&location&&location.href?location:null;}catch(_e){return null;}
  }
  function isLocalReferenceSource(value){
    const s=String(value||'').trim();if(!s)return false;
    if(/^blob:/i.test(s))return true;
    if(/^data:/i.test(s))return false;
    if(/^file:/i.test(s))return true;
    if(!/^[a-z][a-z0-9+.-]*:/i.test(s))return true;
    if(/^https?:\/\//i.test(s)){
      try{
        const u=new URL(s),loc=browserLocation();
        if(isLoopbackHost(u.hostname))return true;
        if(loc&&/^https?:$/i.test(loc.protocol)&&u.origin===loc.origin)return true;
      }catch(_e){}
    }
    return false;
  }
  function arrayBufferToBase64(buf){
    const bytes=new Uint8Array(buf||new ArrayBuffer(0));
    if(typeof Buffer!=='undefined')return Buffer.from(bytes).toString('base64');
    let binary='',chunk=0x8000;for(let i=0;i<bytes.length;i+=chunk)binary+=String.fromCharCode.apply(null,bytes.subarray(i,Math.min(i+chunk,bytes.length)));
    if(typeof btoa!=='function')throw new Error('当前浏览器无法把本地图片转换为 Base64');
    return btoa(binary);
  }
  async function blobToDataUrl(blob){
    if(!blob)throw new Error('本地参考图读取结果为空');
    if(typeof FileReader!=='undefined'){
      return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=()=>reject(fr.error||new Error('本地参考图读取失败'));fr.readAsDataURL(blob);});
    }
    if(typeof blob.arrayBuffer!=='function')throw new Error('当前运行环境无法读取本地参考图');
    const mime=String(blob.type||'application/octet-stream').split(';')[0]||'application/octet-stream';
    return 'data:'+mime+';base64,'+arrayBufferToBase64(await blob.arrayBuffer());
  }
  function referenceFetchUrl(src){
    const s=String(src||'').trim();if(!s)return s;
    if(/^blob:|^https?:|^file:/i.test(s))return s;
    const loc=browserLocation();
    if(loc){try{return new URL(s,loc.href).toString();}catch(_e){}}
    return s;
  }
  async function prepareReferenceSource(src,fetchSource){
    const s=String(src||'').trim();if(!s)throw new Error('参考图地址为空');
    if(/^data:image\/(?:jpeg|jpg|png|gif|webp);/i.test(s))return s;
    if(/^data:/i.test(s))throw new Error('参考图 Data URL 不是受支持的图片类型');
    if(/^https?:\/\//i.test(s)&&!isLocalReferenceSource(s))return s;
    if(/^file:/i.test(s))throw new Error('不能直接读取 file:// 参考图；请通过 start.bat 打开工作台后重新选择图片');
    if(!isLocalReferenceSource(s))throw new Error('EvoLink 参考图需为公网 http(s) 图片、工作台本地图片或 JPEG/PNG/WebP Data URL');
    const f=fetchSource||(typeof fetch==='function'?fetch.bind(typeof window!=='undefined'?window:globalThis):null);
    if(typeof f!=='function')throw new Error('当前环境缺少读取本地参考图所需的 fetch 能力');
    const url=referenceFetchUrl(s);let res;
    try{res=await f(url,{method:'GET',cache:'no-store'});}catch(e){throw new Error('读取本地参考图失败：'+(e&&e.message||e));}
    if(!res||res.ok===false)throw new Error('读取本地参考图失败'+(res&&res.status?('：HTTP '+res.status):''));
    let blob;
    if(typeof res.blob==='function')blob=await res.blob();
    else if(typeof res.arrayBuffer==='function')blob=new Blob([await res.arrayBuffer()],{type:(res.headers&&res.headers.get&&res.headers.get('content-type'))||'image/png'});
    else throw new Error('本地参考图响应无法转换为图片');
    if(!/^image\//i.test(String(blob.type||'')))throw new Error('本地参考图不是图片文件（Content-Type: '+String(blob.type||'unknown')+'）');
    return blobToDataUrl(blob);
  }
  function extractImages(data){
    const candidates=[];const add=v=>{if(Array.isArray(v))candidates.push(...v);else if(v)candidates.push(v);};
    add(data&&data.results);add(data&&data.data);add(data&&data.images);add(data&&data.output);add(data&&data.result&&data.result.images);add(data&&data.result&&data.result.data);add(data&&data.data&&data.data.results);add(data&&data.data&&data.data.images);add(data&&data.task&&data.task.output);
    return unique(candidates.map(x=>{if(typeof x==='string')return x;if(!x||typeof x!=='object')return'';if(x.b64_json)return'data:image/png;base64,'+x.b64_json;return x.url||x.image_url||x.image||x.src||x.output_url||'';}).filter(Boolean));
  }
  function taskInfo(data){
    const d=data||{},nested=d.data&&typeof d.data==='object'?d.data:{},task=d.task_info&&typeof d.task_info==='object'?d.task_info:(nested.task_info&&typeof nested.task_info==='object'?nested.task_info:{});
    const estimated=Number(task.estimated_time??d.estimated_time??nested.estimated_time);
    return {id:String(d.id||d.task_id||d.taskId||task.id||task.task_id||task.taskId||(nested&&(nested.id||nested.task_id||nested.taskId))||''),status:String(d.status||task.status||nested.status||'').toLowerCase(),progress:Number(d.progress??task.progress??nested.progress),estimatedTime:Number.isFinite(estimated)&&estimated>0?estimated:null,error:d.error||task.error||nested.error||null};
  }
  function buildRequest(opts){
    opts=opts||{};
    const model=String(opts.model||DEFAULT_MODEL),profile=modelProfile(model),refs=unique(opts.imageUrls||opts.refs||[]),aspect=normalizeAspect(opts.aspect||opts.size||'1:1');
    const body={model,prompt:String(opts.prompt||'').trim()};
    if(!body.prompt&&!profile.promptOptional)throw new Error('生图提示词不能为空');
    if(profile.maxRefs===0&&refs.length)throw new Error('当前模型「'+model+'」不支持参考图，请改用支持图生图/编辑的图像模型');
    if(profile.maxRefs&&refs.length>profile.maxRefs)throw new Error('模型「'+model+'」最多支持 '+profile.maxRefs+' 张参考图，当前为 '+refs.length+' 张');
    if(profile.requiresRefs&&!refs.length)throw new Error('模型「'+model+'」至少需要 1 张输入图片');
    if(profile.sendSize!==false)body.size=aspect;
    if(refs.length){
      if(profile.family==='midjourney-main'){
        let prompt=body.prompt;
        if(aspect!=='auto'&&!/(?:^|\s)--ar\s+\d+\s*:\s*\d+(?:\s|$)/i.test(prompt))prompt=(prompt+' --ar '+aspect).trim();
        body.prompt=(refs.join(' ')+' '+prompt).trim();
      }else body.image_urls=refs;
    }else if(profile.family==='midjourney-main'&&aspect!=='auto'&&!/(?:^|\s)--ar\s+\d+\s*:\s*\d+(?:\s|$)/i.test(body.prompt)){
      body.prompt=(body.prompt+' --ar '+aspect).trim();
    }
    const resolution=normalizeResolution(opts.resolution),quality=normalizeQuality(opts.quality);
    if(profile.qualityStyle==='lite1k')body.quality='1K';
    else if(profile.qualityStyle==='resolution-quality')body.quality=resolution;
    else if(profile.qualityStyle==='seedream-5-pro')body.quality=resolution==='1K'?'1K':'2K';
    else if(profile.qualityStyle==='seedream-5-lite')body.quality=resolution==='4K'?'4K':resolution==='1K'?'2K':resolution;
    else if(profile.qualityStyle==='qwen-3')body.quality=resolution==='1K'?'1K':'2K';
    else if(profile.qualityStyle==='gpt'){body.resolution=resolution;body.quality=quality;}
    else if(profile.qualityStyle==='gpt-beta'){body.resolution='1K';}
    else if(profile.qualityStyle==='gpt15')body.quality=quality;
    else if(profile.qualityStyle==='krea')body.quality=resolution==='2K'?'2K':'1K';
    else if(profile.qualityStyle==='midjourney-v81')body.quality=quality==='high'?'hd':'standard';
    if(profile.family==='midjourney-remove-bg')delete body.prompt;
    if(opts.maskUrl&&profile.supportsMask&&refs.length)body.mask_url=opts.maskUrl;
    if(opts.modelParams&&typeof opts.modelParams==='object'&&Object.keys(opts.modelParams).length)body.model_params=opts.modelParams;
    return body;
  }
  async function uploadOne(src,fetchJson,meta,fetchSource){
    const original=String(src||'').trim();if(!original)return'';
    const key=quickHash(original),hit=uploadCache.get(key);if(hit&&Date.now()-hit.at<60*60*1000)return hit.url;
    const prepared=await prepareReferenceSource(original,fetchSource);
    if(/^https?:\/\//i.test(prepared))return prepared;
    if(!/^data:image\/(?:jpeg|jpg|png|gif|webp);(?:charset=[^;,]+;)?base64,/i.test(prepared))throw new Error('EvoLink 本地参考图转换失败：需要 JPEG/PNG/GIF/WebP 图片 Data URL');
    const parentStage=String(meta&&meta.stage||'');
    const uploadMeta=Object.assign({},meta||{},{stage:'EvoLink 参考图上传',parentStage});
    let data;try{data=await fetchJson(FILE_UPLOAD_ENDPOINT,{method:'POST',body:JSON.stringify({base64_data:prepared})},uploadMeta);}catch(error){if(error&&typeof error==='object'){error.stage='EvoLink 参考图上传';error.parentStage=parentStage||error.parentStage||'';error.referenceUpload=true;}throw error;}
    const url=data&&data.data&&data.data.file_url;if(!url){const error=new Error('EvoLink 文件上传成功但未返回 data.file_url');error.stage='EvoLink 参考图上传';error.parentStage=parentStage;throw error;}uploadCache.set(key,{url,at:Date.now()});return url;
  }
  async function mapLimit(list,limit,worker){
    const out=new Array(list.length),cap=Math.max(1,Math.min(4,Number(limit)||1));let cursor=0;
    async function run(){while(true){const i=cursor++;if(i>=list.length)return;out[i]=await worker(list[i],i);}}
    await Promise.all(Array.from({length:Math.min(cap,list.length)},run));return out;
  }
  async function uploadReferences(refs,fetchJson,opts){
    const profile=modelProfile(opts&&opts.model),list=(refs||[]).filter(Boolean);
    if(profile.maxRefs===0&&list.length)throw new Error('当前模型「'+(opts&&opts.model||'')+'」不支持图生图参考图');
    if(profile.maxRefs&&list.length>profile.maxRefs)throw new Error('参考图超过模型上限：最多 '+profile.maxRefs+' 张');
    return mapLimit(list,opts&&opts.uploadConcurrency||1,async(src,i)=>{const prepared=await prepareReferenceSource(src,opts&&opts.fetchSource),bytes=dataUrlBytes(prepared);if(bytes&&profile.maxBytes&&bytes>profile.maxBytes)throw new Error('第 '+(i+1)+' 张参考图超过当前模型单图大小限制');return uploadOne(prepared,fetchJson,Object.assign({unitIndex:i,units:list.length},opts&&opts.meta||{}),opts&&opts.fetchSource);});
  }
  function normalizeCreditsPayload(raw){
    const body=raw&&typeof raw==='object'?raw:{},data=body.data&&typeof body.data==='object'?body.data:{},token=data.token&&typeof data.token==='object'?data.token:{},user=data.user&&typeof data.user==='object'?data.user:{};
    const n=v=>{const x=Number(v);return Number.isFinite(x)?x:null;};
    const tokenRemaining=n(token.remaining_credits),userRemaining=n(user.remaining_credits),tokenUnlimited=token.unlimited_credits===true;
    const blockedByToken=!tokenUnlimited&&tokenRemaining!==null&&tokenRemaining<=0,blockedByUser=userRemaining!==null&&userRemaining<=0;
    const candidates=[];if(userRemaining!==null)candidates.push(userRemaining);if(!tokenUnlimited&&tokenRemaining!==null)candidates.push(tokenRemaining);
    const recognized=tokenRemaining!==null||userRemaining!==null||tokenUnlimited===true,checked=body.success!==false&&recognized;
    return {checked,recognized,blocked:blockedByToken||blockedByUser,tokenRemaining,userRemaining,tokenUnlimited,effectiveRemaining:candidates.length?Math.min(...candidates):(tokenUnlimited?userRemaining:null),raw:body};
  }
  function creditsText(info){
    const parts=[];if(info&&info.userRemaining!==null)parts.push('账户剩余 '+info.userRemaining+' credits');if(info&&!info.tokenUnlimited&&info.tokenRemaining!==null)parts.push('Token 剩余 '+info.tokenRemaining+' credits');if(info&&info.tokenUnlimited)parts.push('Token 额度不限');return parts.join('，');
  }
  async function ensureGenerationCredits(fetchJson,meta){
    try{
      const raw=await fetchJson('/api/credits',{method:'GET'},Object.assign({stage:'EvoLink 生图额度预检'},meta||{}));
      const info=normalizeCreditsPayload(raw);
      if(info.blocked){const detail=creditsText(info);const err=new Error('EvoLink 生图额度不足'+(detail?'（'+detail+'）':'')+'：API 连接正常，但当前账户/Token 没有足够 Credits 创建计费生图任务。请在 EvoLink 充值或调整 Token 额度后重试。');err.code='insufficient_credits';err.httpStatus=402;err.billing=info;throw err;}
      if(!info.checked)return {checked:false,blocked:false,warning:'EvoLink Credits 响应未包含可识别的 remaining_credits，继续提交并以实际生图接口响应为准。'};
      return info;
    }catch(error){
      if(error&&(/insufficient[_\s-]?(?:credits|quota)|额度不足|余额不足|HTTP\s*402/i.test(String(error.message||''))||error.httpStatus===402||error.code==='insufficient_credits'))throw error;
      return {checked:false,blocked:false,warning:String(error&&error.message||error||'Credits 查询失败')};
    }
  }
  function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
  function normalizeTaskStatus(update){
    const raw=String(update&&update.status||'').toLowerCase().replace(/[\s-]+/g,'_'),hasResult=Array.isArray(update&&update.resultUrls)&&update.resultUrls.length>0;
    if(hasResult||['completed','complete','succeeded','success','done','finished'].includes(raw))return'completed';
    if(['failed','error','cancelled','canceled','timeout'].includes(raw))return raw==='timeout'?'timeout':'failed';
    if(['processing','running','in_progress','generating','active'].includes(raw)||Number(update&&update.progress)>0)return'processing';
    return'pending';
  }
  function emitTaskUpdate(cb,payload){try{if(typeof cb==='function')cb(Object.assign({},payload||{}));}catch(_e){}}
  function createTaskTracker(nowMs,totalStarted,unitIndex){
    const state={acceptedAt:0,processingAt:0,completedAt:0,taskId:'',taskStates:[],queueObserved:false,providerSplitObserved:false};
    function accept(){if(!state.acceptedAt)state.acceptedAt=nowMs();}
    function pushRow(status,at,taskId,progress,payload,inferred=false){
      const row={status,rawStatus:String(payload&&payload.rawStatus||payload&&payload.status||''),atMs:Math.max(0,Math.round(at-totalStarted)),elapsedMs:Math.max(0,Math.round(at-state.acceptedAt)),taskId,progress,estimatedTime:Number(payload&&payload.estimatedTime)||null,unitIndex:Number(unitIndex)||0,inferred:!!inferred};
      const last=state.taskStates[state.taskStates.length-1];
      if(last&&last.status===status&&last.taskId===taskId&&!inferred){last.progress=Math.max(last.progress||0,progress);last.atMs=row.atMs;last.elapsedMs=row.elapsedMs;last.estimatedTime=row.estimatedTime||last.estimatedTime;last.rawStatus=row.rawStatus||last.rawStatus;}
      else state.taskStates.push(row);
    }
    function record(payload){
      accept();const status=normalizeTaskStatus(payload||{}),at=nowMs(),taskId=String(payload&&payload.taskId||state.taskId||''),progress=Number.isFinite(Number(payload&&payload.progress))?Math.max(0,Math.min(100,Math.round(Number(payload.progress)))):0;
      if(taskId)state.taskId=taskId;
      if(!state.taskStates.length&&status!=='pending')pushRow('pending',state.acceptedAt,taskId,0,payload,true);
      if(status==='completed'&&!state.processingAt){
        // Some providers jump directly to completed. Keep the requested lifecycle visible,
        // but mark the missing transition as inferred instead of pretending queue telemetry existed.
        state.processingAt=state.acceptedAt;pushRow('processing',state.processingAt,taskId,0,payload,true);
      }
      pushRow(status,at,taskId,progress,payload,false);
      if(status==='pending'&&!state.processingAt)state.queueObserved=true;
      if(status==='processing'&&!state.processingAt){state.processingAt=at;state.providerSplitObserved=true;}
      if(status==='completed'&&!state.completedAt){state.completedAt=at;if(state.processingAt>state.acceptedAt)state.providerSplitObserved=true;}
    }
    function summary(){
      const currentAt=nowMs();
      const queueEnd=state.processingAt||((state.queueObserved&&!state.completedAt)?currentAt:state.acceptedAt);
      const queueMs=Math.max(0,Math.round(queueEnd-state.acceptedAt));
      const generationStart=state.processingAt||state.acceptedAt;
      const generationEnd=state.completedAt||(state.processingAt?currentAt:0);
      const generationMs=generationEnd&&generationStart?Math.max(0,Math.round(generationEnd-generationStart)):0;
      return{taskId:state.taskId,taskStates:state.taskStates.slice(),providerQueueMs:queueMs,generationMs,queueObserved:state.queueObserved&&queueMs>0,providerSplitObserved:state.providerSplitObserved};
    }
    return{accept,record,summary};
  }
  function adaptivePollDelay(info,elapsedMs){
    const p=Number.isFinite(info&&info.progress)?Number(info.progress):0,estimatedMs=Number(info&&info.estimatedTime)>0?Number(info.estimatedTime)*1000:0,status=normalizeTaskStatus(info||{});
    if(p>=85||status==='processing'&&p>=60)return 850;
    if(p>0||status==='processing')return 1250;
    if(estimatedMs>0&&elapsedMs<estimatedMs*.45)return 3000;
    if(estimatedMs>0&&elapsedMs<estimatedMs*.75)return 2200;
    return 1500;
  }
  function retryablePollError(error){
    const status=Number(error&&(error.status||error.httpStatus)||0),text=String(error&&error.message||error||'')+' '+String(error&&error.code||'');
    if([408,425,429,500,502,503,504].includes(status))return true;
    if(status>=400&&status<500)return false;
    return !status||/(socket hang up|ECONNRESET|ECONNABORTED|ETIMEDOUT|ESOCKETTIMEDOUT|EPIPE|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND|before secure TLS connection was established|socket disconnected|TLS.*(?:handshake|closed|reset)|网络|连接|超时|Failed to fetch)/i.test(text);
  }
  async function pollTaskWithRetry(taskId,fetchJson,meta,onTaskUpdate,context,telemetry,options={}){
    const delays=Array.isArray(options.retryDelaysMs)&&options.retryDelaysMs.length?options.retryDelaysMs:POLL_RETRY_DELAYS_MS;
    const maxAttempts=Math.max(1,Math.min(5,Number(options.maxAttempts)||3));
    let lastError=null;
    for(let attempt=1;attempt<=maxAttempts;attempt++){
      const started=Date.now();
      try{return await fetchJson('/api/tasks/'+encodeURIComponent(taskId),{method:'GET'},Object.assign({stage:'EvoLink 任务轮询',taskId,pollAttempt:attempt},meta||{}));}
      catch(error){
        lastError=error;const duration=Math.max(0,Date.now()-started);telemetry.networkStallMs+=duration;
        const retryable=retryablePollError(error);if(!retryable||attempt>=maxAttempts)throw error;
        telemetry.pollRetryCount++;
        const delay=Math.max(0,Number(delays[Math.min(attempt-1,delays.length-1)])||0);telemetry.networkStallMs+=delay;
        emitTaskUpdate(onTaskUpdate,Object.assign({},context,{taskId,status:telemetry.lastStatus||'pending',rawStatus:telemetry.lastRawStatus||'',progress:telemetry.lastProgress||0,error:'',resultUrls:[],pollRetrying:true,pollRetryCount:telemetry.pollRetryCount,pollRetryAttempt:attempt,nextPollMs:delay,networkStallMs:telemetry.networkStallMs,sameTaskOnly:true,message:'任务查询网络抖动，正在继续查询同一 task_id；不会重复提交计费任务'}));
        await (options.sleepFn||sleep)(delay);
      }
    }
    throw lastError||new Error('EvoLink 任务轮询失败');
  }
  async function waitTask(initial,fetchJson,meta,onTaskUpdate,taskContext,pollTimeoutMs=POLL_TIMEOUT_MS,pollOptions={}){
    let info=taskInfo(initial),last=initial;const context=Object.assign({},taskContext||{});const images0=extractImages(last),initialStatus=normalizeTaskStatus({status:info.status,progress:info.progress,resultUrls:images0});
    const baseBudget=Math.max(60000,Number(pollTimeoutMs)||POLL_TIMEOUT_MS),softBudget=Math.max(30000,Math.min(baseBudget,Number(pollOptions.softTimeoutMs)||POLL_SOFT_TIMEOUT_MS)),maxBudget=Math.max(baseBudget,Math.min(900000,Number(pollOptions.maxTimeoutMs)||POLL_MAX_TIMEOUT_MS));
    const telemetry={softTimeoutReached:false,pollRetryCount:0,networkStallMs:0,pollTimeoutBudgetMs:baseBudget,pollMaxTimeoutMs:maxBudget,lastStatus:initialStatus,lastRawStatus:info.status||'',lastProgress:Number.isFinite(info.progress)?info.progress:0};
    const basePayload=()=>({softTimeoutReached:telemetry.softTimeoutReached,pollRetryCount:telemetry.pollRetryCount,networkStallMs:telemetry.networkStallMs,pollTimeoutBudgetMs:telemetry.pollTimeoutBudgetMs,pollMaxTimeoutMs:telemetry.pollMaxTimeoutMs,sameTaskOnly:true});
    if(info.id)emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:initialStatus,rawStatus:info.status||'',progress:initialStatus==='completed'?100:(Number.isFinite(info.progress)?info.progress:0),estimatedTime:info.estimatedTime,error:'',resultUrls:images0}));
    if(images0.length)return last;
    if(!info.id)return last;
    const started=Date.now();let activeBudget=baseBudget;
    while(Date.now()-started<activeBudget){
      const state=normalizeTaskStatus({status:info.status,progress:info.progress});telemetry.lastStatus=state;telemetry.lastRawStatus=info.status||'';telemetry.lastProgress=Number.isFinite(info.progress)?info.progress:0;
      if(state==='failed'){
        const msg=info.error&&(info.error.message||info.error.code)||'EvoLink 生图任务失败';emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:'failed',rawStatus:info.status||'',progress:telemetry.lastProgress,estimatedTime:info.estimatedTime,error:String(msg),resultUrls:[]}));throw new Error(String(msg));
      }
      if(state==='completed'){const imgs=extractImages(last);emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:'completed',rawStatus:info.status||'',progress:100,estimatedTime:info.estimatedTime,error:'',resultUrls:imgs}));return last;}
      const elapsed=Date.now()-started;
      if(!telemetry.softTimeoutReached&&elapsed>=softBudget){
        telemetry.softTimeoutReached=true;
        if(['pending','processing'].includes(state))activeBudget=maxBudget;
        telemetry.pollTimeoutBudgetMs=activeBudget;
        emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:state,rawStatus:info.status||'',progress:telemetry.lastProgress,estimatedTime:info.estimatedTime,elapsedMs:elapsed,error:'',resultUrls:[],softTimeoutReached:true,message:'已超过 '+Math.round(softBudget/1000)+' 秒软阈值，任务仍为 '+state+'；继续查询同一 task_id，绝不会重新 POST 计费任务'}));
      }
      const delay=adaptivePollDelay(info,elapsed);
      emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:state,rawStatus:info.status||'',progress:telemetry.lastProgress,estimatedTime:info.estimatedTime,nextPollMs:delay,elapsedMs:elapsed,error:'',resultUrls:[]}));
      await (pollOptions.sleepFn||sleep)(delay);
      last=await pollTaskWithRetry(info.id,fetchJson,meta,onTaskUpdate,context,telemetry,{retryDelaysMs:pollOptions.retryDelaysMs,maxAttempts:pollOptions.retryAttempts,sleepFn:pollOptions.sleepFn});
      info=taskInfo(last);const imgs=extractImages(last),nextStatus=normalizeTaskStatus({status:info.status,progress:info.progress,resultUrls:imgs});telemetry.lastStatus=nextStatus;telemetry.lastRawStatus=info.status||'';telemetry.lastProgress=nextStatus==='completed'?100:(Number.isFinite(info.progress)?info.progress:0);emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:nextStatus,rawStatus:info.status||'',progress:telemetry.lastProgress,estimatedTime:info.estimatedTime,error:'',resultUrls:imgs}));if(imgs.length)return last;
    }
    const err=new Error('EvoLink 生图任务等待超时（已持续查询同一 task_id 约 '+Math.round(activeBudget/1000)+' 秒，软阈值 '+Math.round(softBudget/1000)+' 秒）。当前任务已停止查询，但不会自动再次提交计费任务；可在 EvoLink 后台按 task_id 核对结果。');
    err.code='evolink_task_poll_timeout';err.taskId=info.id;err.pollRetryCount=telemetry.pollRetryCount;err.networkStallMs=telemetry.networkStallMs;err.pollTimeoutBudgetMs=activeBudget;
    emitTaskUpdate(onTaskUpdate,Object.assign({},context,basePayload(),{taskId:info.id,status:'timeout',rawStatus:info.status||'',progress:telemetry.lastProgress,estimatedTime:info.estimatedTime,error:err.message,resultUrls:[]}));
    throw err;
  }
  async function generate(opts){
    opts=opts||{};const fetchJson=opts.fetchJson;if(typeof fetchJson!=='function')throw new Error('EvoLink adapter 缺少 fetchJson');
    const nowMs=()=>typeof performance!=='undefined'&&typeof performance.now==='function'?performance.now():Date.now(),totalStarted=nowMs();
    const perf={creditsMs:0,prepareUploadMs:0,uploadMs:0,submitMs:0,pollMs:0,providerQueueMs:0,generationMs:0,resultMs:0,totalMs:0,refCount:0,uploadedRefCount:0,uploadConcurrency:Math.max(1,Number(opts.uploadConcurrency)||1),creditsSkipped:opts.skipCreditsCheck===true,taskId:'',taskStates:[],queueObserved:false,providerSplitObserved:false,softTimeoutReached:false,pollRetryCount:0,networkStallMs:0,pollTimeoutBudgetMs:Math.max(60000,Number(opts.pollTimeoutMs)||POLL_TIMEOUT_MS),pollMaxTimeoutMs:Math.max(Number(opts.pollTimeoutMs)||POLL_TIMEOUT_MS,Number(opts.pollMaxTimeoutMs)||POLL_MAX_TIMEOUT_MS),sameTaskOnly:true};
    const reportPerformance=(extra={})=>{try{if(typeof opts.onPerformance==='function'){const payload=Object.assign({},perf,extra);payload.taskStates=(Array.isArray(extra.taskStates)?extra.taskStates:perf.taskStates).map(x=>Object.assign({},x));payload.partial=extra.partial===true;opts.onPerformance(payload);}}catch(_e){}};
    const model=String(opts.model||DEFAULT_MODEL),count=Math.max(1,Math.min(10,Number(opts.count)||1)),refs=(opts.refs||opts.imageDataUrls||[]).filter(Boolean),profile=modelProfile(model);perf.refCount=refs.length;
    let t=nowMs();if(!opts.skipCreditsCheck)await ensureGenerationCredits(fetchJson,Object.assign({model},opts.meta||{}));perf.creditsMs=Math.round(nowMs()-t);reportPerformance({partial:true,stage:'credits'});
    t=nowMs();const uploaded=await uploadReferences(refs,fetchJson,{model,meta:opts.meta,fetchSource:opts.fetchSource,uploadConcurrency:opts.uploadConcurrency||1});perf.uploadedRefCount=uploaded.length;let maskUrl='',prompt=String(opts.prompt||'');
    if(opts.mask){
      maskUrl=await uploadOne(opts.mask,fetchJson,Object.assign({},opts.meta||{},{model,stage:'EvoLink Mask 上传',parentStage:String(opts.meta&&opts.meta.stage||'')}),opts.fetchSource);
      if(!profile.supportsMask){if(profile.maxRefs&&uploaded.length>=profile.maxRefs)throw new Error('当前模型参考图数量已达上限，无法再附加蒙版参考图');uploaded.push(maskUrl);prompt+='\n\n编辑约束：最后一张参考图为编辑区域蒙版，请仅修改蒙版指示区域并尽量保持其它区域不变。';}
    }
    perf.prepareUploadMs=Math.round(nowMs()-t);perf.uploadMs=perf.prepareUploadMs;reportPerformance({partial:true,stage:'upload'});
    const results=[];
    for(let i=0;i<count;i++){
      const body=buildRequest({model,prompt,aspect:opts.aspect,imageUrls:uploaded,maskUrl,resolution:opts.resolution,quality:opts.quality,modelParams:opts.modelParams});
      const meta=Object.assign({},opts.meta||{},{model,stage:(opts.meta&&opts.meta.stage)||'EvoLink 生图任务',unitIndex:i,units:count});
      t=nowMs();const initial=await fetchJson(GENERATE_ENDPOINT,{method:'POST',body:JSON.stringify(body)},meta);perf.submitMs+=Math.round(nowMs()-t);reportPerformance({partial:true,stage:'submit'});
      const submittedAt=new Date().toISOString(),tracker=createTaskTracker(nowMs,totalStarted,i);tracker.accept();
      const taskUpdate=payload=>{
        perf.softTimeoutReached=perf.softTimeoutReached||payload?.softTimeoutReached===true;perf.pollRetryCount=Math.max(perf.pollRetryCount,Number(payload?.pollRetryCount)||0);perf.networkStallMs=Math.max(perf.networkStallMs,Number(payload?.networkStallMs)||0);perf.pollTimeoutBudgetMs=Math.max(perf.pollTimeoutBudgetMs,Number(payload?.pollTimeoutBudgetMs)||0);perf.pollMaxTimeoutMs=Math.max(perf.pollMaxTimeoutMs,Number(payload?.pollMaxTimeoutMs)||0);
        tracker.record(payload);emitTaskUpdate(opts.onTaskUpdate,payload);
        const live=tracker.summary();
        reportPerformance({partial:true,stage:'task',taskId:live.taskId||perf.taskId,taskStates:[...perf.taskStates,...live.taskStates],providerQueueMs:perf.providerQueueMs+live.providerQueueMs,generationMs:perf.generationMs+live.generationMs,queueObserved:perf.queueObserved||live.queueObserved,providerSplitObserved:perf.providerSplitObserved||live.providerSplitObserved});
      };
      t=nowMs();const completed=await waitTask(initial,fetchJson,meta,taskUpdate,{model,prompt,stage:meta.stage,submittedAt,unitIndex:i,units:count,source:'evolink'},opts.pollTimeoutMs,{softTimeoutMs:opts.pollSoftTimeoutMs,maxTimeoutMs:opts.pollMaxTimeoutMs,retryAttempts:opts.pollRetryAttempts,retryDelaysMs:opts.pollRetryDelaysMs});perf.pollMs+=Math.round(nowMs()-t);
      const split=tracker.summary();perf.providerQueueMs+=split.providerQueueMs;perf.generationMs+=split.generationMs;perf.taskId=perf.taskId||split.taskId;perf.taskStates.push(...split.taskStates);perf.queueObserved=perf.queueObserved||split.queueObserved;perf.providerSplitObserved=perf.providerSplitObserved||split.providerSplitObserved;
      t=nowMs();const imgs=extractImages(completed);perf.resultMs+=Math.round(nowMs()-t);if(!imgs.length)throw new Error('EvoLink 任务完成但 results 中没有可用图片 URL');results.push(...imgs);
      if(results.length>=count)break;
    }
    perf.totalMs=Math.round(nowMs()-totalStarted);const sliced=results.slice(0,count);try{Object.defineProperty(sliced,'performance',{value:perf,enumerable:false});}catch(_e){sliced.performance=perf;}reportPerformance({partial:false,stage:'complete'});return sliced;
  }
  return {VERSION,DEFAULT_BASE,DEFAULT_MODEL,FILE_UPLOAD_ENDPOINT,GENERATE_ENDPOINT,POLL_SOFT_TIMEOUT_MS,POLL_TIMEOUT_MS,POLL_MAX_TIMEOUT_MS,POLL_RETRY_DELAYS_MS,BUILTIN_IMAGE_MODELS,isEvolinkBase,isEvolinkDocsUrl,normalizeEvolinkBase,isImageModelName,isImageModelObject,isDirectImageModelName,isDirectImageModelObject,mergeImageModels,ingestRemoteModels,remoteModelCapability,normalizeRemoteModelCapability,normalizeAspect,normalizeResolution,normalizeQuality,modelProfile,modelParameterSchema,normalizeModelOptions,dataUrlBytes,isLoopbackHost,isLocalReferenceSource,prepareReferenceSource,buildRequest,extractImages,taskInfo,adaptivePollDelay,normalizeTaskStatus,createTaskTracker,normalizeCreditsPayload,ensureGenerationCredits,uploadReferences,retryablePollError,pollTaskWithRetry,waitTask,generate};
});
