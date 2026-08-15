/* V26 pure state helpers for recent + pinned copy-generation snapshots. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.CopySnapshotStore=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_BATCHES=5; // 普通快照最多保留最近 5 批；星标快照不计入上限。
  function clone(value){
    if(value==null)return value;
    try{return structuredClone(value);}catch(_e){return JSON.parse(JSON.stringify(value));}
  }
  function cleanSelected(value,length){
    const seen=new Set();
    return (Array.isArray(value)?value:[]).map(Number).filter(i=>Number.isInteger(i)&&i>=0&&i<length&&!seen.has(i)&&seen.add(i));
  }
  function normalizeBatch(batch,index){
    if(!batch||!Array.isArray(batch.copies)||!batch.copies.length)return null;
    const copies=clone(batch.copies);
    const createdAt=String(batch.createdAt||batch.updatedAt||new Date(0).toISOString());
    return {
      id:String(batch.id||('copy-batch-'+index+'-'+createdAt)),
      createdAt,
      updatedAt:String(batch.updatedAt||createdAt),
      input:String(batch.input||''),
      origin:String(batch.origin||'unknown'),
      copies,
      selected:cleanSelected(batch.selected,copies.length),
      pinned:!!(batch.pinned||batch.starred||batch.keep)
    };
  }
  function enforceRetention(batches,maxBatches=MAX_BATCHES){
    const limit=Math.max(1,Number(maxBatches)||MAX_BATCHES);
    let recentCount=0;
    return (Array.isArray(batches)?batches:[]).filter(batch=>{
      if(batch&&batch.pinned)return true;
      if(recentCount>=limit)return false;
      recentCount+=1;
      return true;
    });
  }
  function normalizeState(raw,maxBatches=MAX_BATCHES){
    let value=raw;
    if(typeof raw==='string'){try{value=JSON.parse(raw);}catch(_e){value=null;}}
    const source=value&&typeof value==='object'?value:{};
    const normalized=(Array.isArray(source.batches)?source.batches:[]).map(normalizeBatch).filter(Boolean);
    const batches=enforceRetention(normalized,maxBatches);
    let activeId=String(source.activeId||'');
    if(!batches.some(x=>x.id===activeId))activeId=batches[0]?.id||'';
    return {version:2,activeId,batches};
  }
  function addBatch(state,payload,options={}){
    const limit=options.maxBatches||MAX_BATCHES;
    const next=normalizeState(state,limit);
    const now=String(options.now||new Date().toISOString());
    const id=String(options.id||('copy-'+Date.now()+'-'+Math.random().toString(36).slice(2,8)));
    const batch=normalizeBatch({
      id,createdAt:now,updatedAt:now,input:payload&&payload.input,origin:payload&&payload.origin,
      copies:payload&&payload.copies,selected:payload&&payload.selected,pinned:payload&&payload.pinned
    },0);
    if(!batch)return next;
    next.batches=enforceRetention([batch,...next.batches.filter(x=>x.id!==id)],limit);
    next.activeId=id;
    return next;
  }
  function updateActive(state,payload){
    const next=normalizeState(state);
    const index=next.batches.findIndex(x=>x.id===next.activeId);
    if(index<0)return next;
    const old=next.batches[index],copies=Array.isArray(payload&&payload.copies)?clone(payload.copies):old.copies;
    next.batches[index]=Object.assign({},old,{
      updatedAt:String(payload&&payload.updatedAt||new Date().toISOString()),
      input:payload&&payload.input!==undefined?String(payload.input||''):old.input,
      copies,
      selected:payload&&payload.selected!==undefined?cleanSelected(payload.selected,copies.length):old.selected,
      pinned:payload&&payload.pinned!==undefined?!!payload.pinned:old.pinned
    });
    return next;
  }
  function activate(state,id){
    const next=normalizeState(state);
    if(next.batches.some(x=>x.id===String(id)))next.activeId=String(id);
    return next;
  }
  function setPinned(state,id,pinned,options={}){
    const limit=options.maxBatches||MAX_BATCHES;
    const next=normalizeState(state,limit),target=String(id||'');
    next.batches=next.batches.map(batch=>batch.id===target?Object.assign({},batch,{pinned:!!pinned,updatedAt:String(options.now||batch.updatedAt||new Date().toISOString())}):batch);
    next.batches=enforceRetention(next.batches,limit);
    if(!next.batches.some(x=>x.id===next.activeId))next.activeId=next.batches[0]?.id||'';
    return next;
  }
  function togglePinned(state,id,options={}){
    const next=normalizeState(state,options.maxBatches||MAX_BATCHES);
    const batch=next.batches.find(x=>x.id===String(id||''));
    if(!batch)return next;
    return setPinned(next,batch.id,!batch.pinned,options);
  }
  function deleteBatch(state,id,options={}){
    const next=normalizeState(state,options.maxBatches||MAX_BATCHES),target=String(id||'');
    if(!target||!next.batches.some(x=>x.id===target))return next;
    next.batches=next.batches.filter(x=>x.id!==target);
    if(next.activeId===target||!next.batches.some(x=>x.id===next.activeId))next.activeId=next.batches[0]?.id||'';
    return next;
  }
  function activeBatch(state){const next=normalizeState(state);return next.batches.find(x=>x.id===next.activeId)||next.batches[0]||null;}
  function stats(state){
    const next=normalizeState(state);
    const pinned=next.batches.filter(x=>x.pinned).length;
    return {total:next.batches.length,pinned,recent:next.batches.length-pinned,maxRecent:MAX_BATCHES};
  }
  return {MAX_BATCHES,clone,cleanSelected,normalizeBatch,enforceRetention,normalizeState,addBatch,updateActive,activate,setPinned,togglePinned,deleteBatch,activeBatch,stats};
});
