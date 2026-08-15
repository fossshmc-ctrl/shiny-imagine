'use strict';
const fs=require('fs');
const path=require('path');

const root=path.resolve(__dirname,'..');
const out=path.join(root,'dist');
const entries=['index.html','assets','src','styles'];
const forbidden=['.env','config.json','copy-coze.private.json','server.js','server.py','data','tests'];

fs.rmSync(out,{recursive:true,force:true});
fs.mkdirSync(out,{recursive:true});
for(const entry of entries){
  const source=path.join(root,entry),target=path.join(out,entry);
  if(!fs.existsSync(source))throw new Error('V29 Vercel build missing '+entry);
  fs.cpSync(source,target,{recursive:true});
}
fs.writeFileSync(path.join(out,'version.json'),JSON.stringify({version:'V29',buildId:'v29-github-vercel-dual-runtime-20260815',builtAt:new Date().toISOString()},null,2));
for(const name of forbidden)if(fs.existsSync(path.join(out,name)))throw new Error('Sensitive/non-public entry leaked into dist: '+name);

function countFiles(dir){return fs.readdirSync(dir,{withFileTypes:true}).reduce((sum,item)=>sum+(item.isDirectory()?countFiles(path.join(dir,item.name)):1),0);}
console.log(JSON.stringify({ok:true,output:'dist',files:countFiles(out),version:'V29'}));
