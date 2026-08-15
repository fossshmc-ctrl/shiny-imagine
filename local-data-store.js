const fs=require('fs');
const path=require('path');

function ensureDir(dir){fs.mkdirSync(dir,{recursive:true});return dir;}
function clone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function readJson(file,fallback){try{const raw=fs.readFileSync(file,'utf8');const data=JSON.parse(raw);return data;}catch(_e){return clone(fallback);}}
function atomicWriteJson(file,value){ensureDir(path.dirname(file));const tmp=file+'.tmp-'+process.pid+'-'+Date.now();fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);}
function safeId(v){return String(v||'').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||('item-'+Date.now().toString(36));}

class JsonCollection{
  constructor(file,{maxItems=500,idField='id'}={}){this.file=file;this.maxItems=maxItems;this.idField=idField;ensureDir(path.dirname(file));if(!fs.existsSync(file))atomicWriteJson(file,{version:1,items:[]});}
  _state(){const d=readJson(this.file,{version:1,items:[]});if(!d||!Array.isArray(d.items))return{version:1,items:[]};return d;}
  list({limit,sortField='updatedAt'}={}){const state=this._state(),items=state.items.slice();items.sort((a,b)=>String(b&&b[sortField]||b&&b.createdAt||'').localeCompare(String(a&&a[sortField]||a&&a.createdAt||'')));return clone(items.slice(0,Math.max(1,Math.min(Number(limit)||this.maxItems,this.maxItems))));}
  get(id){const key=String(id||''),hit=this._state().items.find(x=>String(x&&x[this.idField]||'')===key);return clone(hit||null);}
  upsert(item){const state=this._state(),now=new Date().toISOString(),next=Object.assign({},clone(item)||{});next[this.idField]=safeId(next[this.idField]);if(!next.createdAt)next.createdAt=now;next.updatedAt=now;const idx=state.items.findIndex(x=>String(x&&x[this.idField]||'')===String(next[this.idField]));if(idx>=0)next.createdAt=state.items[idx].createdAt||next.createdAt;if(idx>=0)state.items.splice(idx,1);state.items.unshift(next);if(state.items.length>this.maxItems)state.items.length=this.maxItems;atomicWriteJson(this.file,state);return clone(next);}
  remove(id){const state=this._state(),before=state.items.length,key=String(id||'');state.items=state.items.filter(x=>String(x&&x[this.idField]||'')!==key);if(state.items.length!==before)atomicWriteJson(this.file,state);return state.items.length!==before;}
  replace(items){const state={version:1,items:(Array.isArray(items)?items:[]).slice(0,this.maxItems).map(x=>clone(x))};atomicWriteJson(this.file,state);return this.list();}
}

module.exports={JsonCollection,ensureDir,readJson,atomicWriteJson,safeId};
