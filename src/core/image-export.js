(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ImageExport=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const FORMATS={
    jpg:{id:'jpg',label:'JPG',mime:'image/jpeg',ext:'.jpg',quality:0.95},
    jpeg:{id:'jpeg',label:'JPEG',mime:'image/jpeg',ext:'.jpeg',quality:0.95},
    png:{id:'png',label:'PNG',mime:'image/png',ext:'.png'},
    pdf:{id:'pdf',label:'PDF',mime:'application/pdf',ext:'.pdf',quality:0.95}
  };
  function normalizeFormat(value){
    const v=String(value||'').trim().toLowerCase().replace(/^\./,'');
    if(v==='jpg'||v==='jpeg'||v==='jrpg')return v==='jpg'?'jpg':'jpeg';
    if(v==='png'||v==='pdf')return v;
    return 'png';
  }
  function formatDescriptor(value){return FORMATS[normalizeFormat(value)]||FORMATS.png;}
  function safeBaseName(name){
    const raw=String(name||'ai-image').trim().replace(/\.(?:png|jpe?g|webp|gif|pdf)$/i,'');
    const cleaned=raw.replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,' ').trim().slice(0,150);
    return cleaned||'ai-image';
  }
  function fileName(name,format){const d=formatDescriptor(format);return safeBaseName(name)+d.ext;}
  function isDataOrBlobUrl(src){return /^(?:data:image\/|blob:)/i.test(String(src||''));}
  function browserFetchUrl(src){
    const s=String(src||'').trim();if(!s)return'';
    if(isDataOrBlobUrl(s)||s.startsWith('/'))return s;
    if(!/^https?:\/\//i.test(s))return s;
    if(typeof location!=='undefined'){
      try{const u=new URL(s,location.href);if(u.origin===location.origin)return u.href;}catch(_e){}
    }
    return '/api/image-export/source?url='+encodeURIComponent(s);
  }
  function concatBytes(parts){
    const size=parts.reduce((n,p)=>n+p.length,0),out=new Uint8Array(size);let off=0;
    for(const p of parts){out.set(p,off);off+=p.length;}return out;
  }
  const encoder=typeof TextEncoder!=='undefined'?new TextEncoder():null;
  function ascii(text){
    if(encoder)return encoder.encode(String(text));
    const s=String(text),out=new Uint8Array(s.length);for(let i=0;i<s.length;i++)out[i]=s.charCodeAt(i)&255;return out;
  }
  function jpegBytesToPdf(jpegBytes,pixelWidth,pixelHeight){
    const img=jpegBytes instanceof Uint8Array?jpegBytes:new Uint8Array(jpegBytes||[]);
    if(!img.length)throw new Error('PDF 导出缺少 JPEG 图像数据');
    const pw=Math.max(1,Number(pixelWidth)||1),ph=Math.max(1,Number(pixelHeight)||1);
    const portrait=pw<=ph,pageW=portrait?595.28:841.89,pageH=portrait?841.89:595.28,margin=18;
    const scale=Math.min((pageW-margin*2)/pw,(pageH-margin*2)/ph),drawW=pw*scale,drawH=ph*scale,x=(pageW-drawW)/2,y=(pageH-drawH)/2;
    const content=`q\n${drawW.toFixed(3)} 0 0 ${drawH.toFixed(3)} ${x.toFixed(3)} ${y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
    const contentBytes=ascii(content),header=concatBytes([ascii('%PDF-1.4\n%'),new Uint8Array([0xe2,0xe3,0xcf,0xd3]),ascii('\n')]);
    const objs=[
      ascii('<< /Type /Catalog /Pages 2 0 R >>'),
      ascii('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
      ascii(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`),
      concatBytes([ascii(`<< /Type /XObject /Subtype /Image /Width ${Math.round(pw)} /Height ${Math.round(ph)} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.length} >>\nstream\n`),img,ascii('\nendstream')]),
      concatBytes([ascii(`<< /Length ${contentBytes.length} >>\nstream\n`),contentBytes,ascii('endstream')])
    ];
    const parts=[header],offsets=[0];let cursor=header.length;
    objs.forEach((obj,i)=>{offsets.push(cursor);const pre=ascii(`${i+1} 0 obj\n`),post=ascii('\nendobj\n');parts.push(pre,obj,post);cursor+=pre.length+obj.length+post.length;});
    const xrefOffset=cursor;let xref=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    for(let i=1;i<offsets.length;i++)xref+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
    const trailer=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    parts.push(ascii(xref),ascii(trailer));return concatBytes(parts);
  }
  async function fetchSourceBlob(src){
    if(typeof fetch!=='function')throw new Error('当前浏览器不支持图片下载处理');
    const url=browserFetchUrl(src);if(!url)throw new Error('没有可下载的图片地址');
    const response=await fetch(url,{cache:'no-store'});if(!response.ok)throw new Error(`读取图片失败（HTTP ${response.status}）`);
    const blob=await response.blob();if(!blob.size)throw new Error('读取到的图片内容为空');return blob;
  }
  async function imageToCanvas(blob,whiteBackground){
    if(typeof document==='undefined'||typeof Image==='undefined'||typeof URL==='undefined')throw new Error('当前环境无法进行图片格式转换');
    const objectUrl=URL.createObjectURL(blob);try{
      const img=new Image();img.decoding='async';await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('图片解码失败，可能是链接已失效或格式不受浏览器支持'));img.src=objectUrl;});
      const width=img.naturalWidth||img.width,height=img.naturalHeight||img.height;if(!width||!height)throw new Error('图片尺寸无效');
      if(width*height>120000000)throw new Error('图片像素过大，超过 1.2 亿像素，无法在浏览器中安全转换');
      const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:!whiteBackground});if(!ctx)throw new Error('浏览器无法创建图片转换画布');
      if(whiteBackground){ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);}ctx.drawImage(img,0,0,width,height);return canvas;
    }finally{URL.revokeObjectURL(objectUrl);}
  }
  function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('图片编码失败')),type,quality));}
  async function buildExportBlob(src,format){
    const f=normalizeFormat(format),d=formatDescriptor(f),source=await fetchSourceBlob(src),canvas=await imageToCanvas(source,f!=='png');
    if(f==='png')return {blob:await canvasBlob(canvas,'image/png'),width:canvas.width,height:canvas.height,format:f};
    const jpeg=await canvasBlob(canvas,'image/jpeg',d.quality||0.95);
    if(f==='jpg'||f==='jpeg')return {blob:jpeg,width:canvas.width,height:canvas.height,format:f};
    const bytes=new Uint8Array(await jpeg.arrayBuffer()),pdf=jpegBytesToPdf(bytes,canvas.width,canvas.height);
    return {blob:new Blob([pdf],{type:'application/pdf'}),width:canvas.width,height:canvas.height,format:'pdf'};
  }
  function triggerBlobDownload(blob,name){
    if(typeof document==='undefined'||typeof URL==='undefined')throw new Error('当前环境无法触发文件下载');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);
  }
  function pickerTypes(format){
    const d=formatDescriptor(format);
    return [{description:d.label+' 文件',accept:{[d.mime]:[d.ext]}}];
  }
  function canUseFilePicker(){
    try{return typeof window!=='undefined'&&typeof window.showSaveFilePicker==='function'&&window.isSecureContext!==false;}catch(_e){return false;}
  }
  function canUseDirectoryPicker(){
    try{return typeof window!=='undefined'&&typeof window.showDirectoryPicker==='function'&&window.isSecureContext!==false;}catch(_e){return false;}
  }
  // Must be called directly from the user's click handler BEFORE any fetch/Canvas await.
  // Chromium/Edge can otherwise treat the later synthetic <a download>.click() as an automatic
  // download and silently block it after user activation has expired.
  function requestDownloadTarget(items,format){
    const list=(items||[]).filter(Boolean),f=normalizeFormat(format);
    if(list.length===1&&canUseFilePicker()){
      const name=fileName(list[0].name||'ai-image',f);
      try{return {mode:'file-picker',format:f,promise:window.showSaveFilePicker({suggestedName:name,types:pickerTypes(f),excludeAcceptAllOption:false})};}
      catch(error){return {mode:'picker-error',format:f,error};}
    }
    if(list.length>1&&canUseDirectoryPicker()){
      try{return {mode:'directory-picker',format:f,promise:window.showDirectoryPicker({mode:'readwrite'})};}
      catch(error){return {mode:'picker-error',format:f,error};}
    }
    return {mode:'legacy',format:f};
  }
  function isAbortError(error){return !!(error&&(error.name==='AbortError'||/cancel|取消|aborted/i.test(String(error.message||error))));}
  async function writeBlobToHandle(handle,blob){
    if(!handle||typeof handle.createWritable!=='function')throw new Error('浏览器文件保存句柄不可用');
    const writable=await handle.createWritable();
    try{await writable.write(blob);}finally{await writable.close();}
  }
  async function exportImageToTarget(src,name,format,target,index){
    const f=normalizeFormat(format),targetName=fileName(name,f);
    if(target&&target.mode==='picker-error')throw target.error;
    // Resolve the user-selected destination first. The picker itself was already opened synchronously
    // from the click handler by requestDownloadTarget(), so this remains compatible with Edge/Chrome
    // user-activation rules while avoiding unnecessary remote fetch/Canvas work after a cancellation.
    let fileHandle=null,directory=null;
    if(target&&target.mode==='file-picker')fileHandle=await target.promise;
    else if(target&&target.mode==='directory-picker')directory=await target.promise;
    const out=await buildExportBlob(src,f);
    if(fileHandle){await writeBlobToHandle(fileHandle,out.blob);return Object.assign(out,{fileName:targetName,savedBy:'file-picker'});}
    if(directory){const handle=await directory.getFileHandle(targetName,{create:true});await writeBlobToHandle(handle,out.blob);return Object.assign(out,{fileName:targetName,savedBy:'directory-picker'});}
    triggerBlobDownload(out.blob,targetName);return Object.assign(out,{fileName:targetName,savedBy:'legacy-download'});
  }
  async function prepareDownloadArtifact(src,name,format){
    if(typeof URL==='undefined'||typeof URL.createObjectURL!=='function')throw new Error('当前浏览器无法准备本地下载文件');
    const f=normalizeFormat(format),out=await buildExportBlob(src,f),targetName=fileName(name,f),objectUrl=URL.createObjectURL(out.blob);
    let disposed=false;
    return Object.assign(out,{fileName:targetName,objectUrl,dispose(){if(disposed)return;disposed=true;try{URL.revokeObjectURL(objectUrl);}catch(_e){}}});
  }
  function disposePreparedArtifact(artifact){if(artifact&&typeof artifact.dispose==='function')artifact.dispose();}
  async function exportImage(src,name,format){return exportImageToTarget(src,name,format,null,0);}
  return {FORMATS,normalizeFormat,formatDescriptor,safeBaseName,fileName,isDataOrBlobUrl,browserFetchUrl,jpegBytesToPdf,fetchSourceBlob,buildExportBlob,prepareDownloadArtifact,disposePreparedArtifact,exportImage,requestDownloadTarget,exportImageToTarget,canUseFilePicker,canUseDirectoryPicker,isAbortError};
});
