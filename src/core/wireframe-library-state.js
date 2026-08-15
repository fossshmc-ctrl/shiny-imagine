/* V24.5 pure wireframe-category state operations. */
(function(root,factory){
  'use strict';
  const api=factory();
  root.WireframeLibrary=api;
  if(typeof module==='object'&&module.exports) module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function cloneLibrary(library){
    return (Array.isArray(library)?library:[]).map(category=>Object.assign({},category,{imgs:Array.isArray(category.imgs)?category.imgs.slice():[]}));
  }
  function selectCategory(library,currentId,nextId){
    const list=Array.isArray(library)?library:[];
    return list.some(item=>item&&item.id===nextId)?nextId:(list.some(item=>item&&item.id===currentId)?currentId:(list[0]&&list[0].id)||null);
  }
  function renameCategory(library,id,name){
    const next=cloneLibrary(library),clean=String(name||'').trim();
    if(!clean) return next;
    const category=next.find(item=>item.id===id);
    if(category) category.name=clean;
    return next;
  }
  function addCategory(library,category){
    const next=cloneLibrary(library);
    if(!category||!category.id) return next;
    next.push({id:String(category.id),name:String(category.name||'未命名品类').trim()||'未命名品类',imgs:Array.isArray(category.imgs)?category.imgs.slice():[]});
    return next;
  }
  function deleteCategory(library,activeId,id){
    const next=cloneLibrary(library);
    if(next.length<=1) return {library:next,activeCategoryId:selectCategory(next,activeId,activeId),deleted:false,reason:'minimum_one'};
    const filtered=next.filter(item=>item.id!==id);
    if(filtered.length===next.length) return {library:next,activeCategoryId:selectCategory(next,activeId,activeId),deleted:false,reason:'not_found'};
    const activeCategoryId=activeId===id?(filtered[0]&&filtered[0].id):selectCategory(filtered,activeId,activeId);
    return {library:filtered,activeCategoryId,deleted:true,reason:''};
  }
  function sortImagesByTime(library,id){
    const next=cloneLibrary(library),category=next.find(item=>item.id===id);
    if(category) category.imgs.sort((a,b)=>(Number(a&&a.time)||0)-(Number(b&&b.time)||0));
    return next;
  }
  return {cloneLibrary,selectCategory,renameCategory,addCategory,deleteCategory,sortImagesByTime};
});
