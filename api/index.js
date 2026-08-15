'use strict';

process.env.AI_LINKUANG_RUNTIME=process.env.AI_LINKUANG_RUNTIME||'serverless';
const {apiHandler}=require('../server');

function normalizedApiUrl(req){
  const current=new URL(String(req.url||'/api/health'),'http://127.0.0.1');
  const queryPath=current.searchParams.get('path');
  const requestPath=req.query&&req.query.path;
  const forwarded=String(queryPath!=null?queryPath:(requestPath!=null?requestPath:'')).replace(/^\/+/, '');
  if(!forwarded&&current.pathname!=='/api/index'&&current.pathname!=='/api/index.js')return current.pathname+current.search;
  current.searchParams.delete('path');
  const query=current.searchParams.toString();
  return '/api/'+forwarded+(query?'?'+query:'');
}

module.exports=async function handler(req,res){
  req.url=normalizedApiUrl(req);
  return apiHandler(req,res);
};

module.exports.normalizedApiUrl=normalizedApiUrl;
