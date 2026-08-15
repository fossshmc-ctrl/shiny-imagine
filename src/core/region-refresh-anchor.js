/* V26 region refresh anchor: reload restores only the workspace explicitly anchored by the current tab session. */
(function(root,factory){
  'use strict';
  const api=factory();
  if(root)root.RegionRefreshAnchor=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STORAGE_KEY='turing_region_v25_6_refresh_anchor';
  const SCHEMA=1;

  function storage(env){
    try{return env&&env.sessionStorage?env.sessionStorage:(typeof sessionStorage!=='undefined'?sessionStorage:null);}catch(_e){return null;}
  }
  function now(env){
    try{return env&&typeof env.now==='function'?Number(env.now()):Date.now();}catch(_e){return Date.now();}
  }
  function normalize(value){
    if(!value||typeof value!=='object')return null;
    const mode=value.mode==='project'?'project':value.mode==='empty'?'empty':'';
    if(!mode)return null;
    if(mode==='project'){
      const projectId=String(value.projectId||'').trim();
      if(!projectId)return null;
      return {schema:SCHEMA,mode:'project',projectId,versionKey:String(value.versionKey||'refreshAnchor')||'refreshAnchor',reason:String(value.reason||''),updatedAt:Number(value.updatedAt)||0};
    }
    return {schema:SCHEMA,mode:'empty',projectId:'',versionKey:'',reason:String(value.reason||''),updatedAt:Number(value.updatedAt)||0};
  }
  function read(env){
    const s=storage(env);if(!s)return null;
    let raw='';try{raw=String(s.getItem(STORAGE_KEY)||'');}catch(_e){return null;}
    if(!raw)return null;
    try{
      const normalized=normalize(JSON.parse(raw));
      if(!normalized){try{s.removeItem(STORAGE_KEY);}catch(_e){}return null;}
      return normalized;
    }catch(_e){try{s.removeItem(STORAGE_KEY);}catch(_x){}return null;}
  }
  function write(anchor,env){
    const s=storage(env),normalized=normalize(anchor);if(!s||!normalized)return null;
    normalized.updatedAt=now(env);
    try{s.setItem(STORAGE_KEY,JSON.stringify(normalized));return normalized;}catch(_e){return null;}
  }
  function writeEmpty(reason='',env){return write({mode:'empty',reason},env);}
  function writeProject(projectId,reason='',env,versionKey='refreshAnchor'){
    return write({mode:'project',projectId,reason,versionKey},env);
  }
  function projectId(env){const anchor=read(env);return anchor&&anchor.mode==='project'?anchor.projectId:'';}
  function shouldRestore(env){const anchor=read(env);return !!(anchor&&anchor.mode==='project'&&anchor.projectId);}
  function clear(env){const s=storage(env);try{s&&s.removeItem(STORAGE_KEY);}catch(_e){}return true;}

  return {STORAGE_KEY,SCHEMA,normalize,read,write,writeEmpty,writeProject,projectId,shouldRestore,clear};
});
