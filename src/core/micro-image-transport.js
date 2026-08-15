/* V27.9 micro-adjust transport: merge target-layout + mask into one guide, then upload two references concurrently. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root){root.MicroImageTransportV276=api;root.MicroImageTransportV275=api;root.MicroImageTransportV274=api;root.MicroImageTransportV2731=api;}})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='V28.1.1';
  const REFERENCE_PLAN='source+layout-mask-guide+text-fidelity-v280';
  function bytes(dataUrl){const s=String(dataUrl||''),i=s.indexOf(',');if(i<0)return 0;return Math.floor((s.length-i-1)*3/4);}
  function loadImage(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('微调参考图压缩读取失败'));im.src=src;});}
  function scaledSize(width,height,maxEdge){const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1),edge=Math.max(w,h),scale=edge>maxEdge?maxEdge/edge:1;return{width:Math.max(1,Math.round(w*scale)),height:Math.max(1,Math.round(h*scale)),scale};}
  function encodeCanvas(canvas,type='image/webp',quality=.9){let out='';try{out=canvas.toDataURL(type,quality);}catch(_e){}if(!out||out==='data:,')out=canvas.toDataURL('image/png');return out;}
  async function recompress(src,{maxEdge=1600,quality=.9,type='image/webp',keepUnder=900000}={}){
    const raw=String(src||'');if(!/^data:image\//i.test(raw))return{src:raw,before:bytes(raw),after:bytes(raw),changed:false};
    const before=bytes(raw);let im;try{im=await loadImage(raw);}catch(_e){return{src:raw,before,after:before,changed:false};}
    const w=im.naturalWidth||im.width,h=im.naturalHeight||im.height,dims=scaledSize(w,h,maxEdge);
    if(before<=keepUnder&&dims.scale>=.999)return{src:raw,before,after:before,changed:false,width:w,height:h};
    const c=document.createElement('canvas');c.width=dims.width;c.height=dims.height;const ctx=c.getContext('2d',{alpha:type==='image/png'});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(im,0,0,c.width,c.height);
    const out=encodeCanvas(c,type,quality),after=bytes(out),useOut=!!(out&&after<before*1.04);
    return{src:useOut?out:raw,before,after:useOut?after:before,changed:useOut,width:c.width,height:c.height};
  }
  async function buildLayoutMaskGuide({layoutGuide,mask,maxEdge=1280,quality=.9}={}){
    const layout=String(layoutGuide||''),maskSrc=String(mask||''),before=bytes(layout)+bytes(maskSrc);
    if(!layout&&!maskSrc)return{src:'',before:0,after:0,changed:false,role:'layout-mask-guide',merged:false};
    let layoutImage=null,maskImage=null;
    try{[layoutImage,maskImage]=await Promise.all([layout?loadImage(layout):Promise.resolve(null),maskSrc?loadImage(maskSrc):Promise.resolve(null)]);}catch(_e){const fallback=layout||maskSrc;return{src:fallback,before,after:bytes(fallback),changed:false,role:'layout-mask-guide',merged:false};}
    const base=layoutImage||maskImage,w=base.naturalWidth||base.width,h=base.naturalHeight||base.height,dims=scaledSize(w,h,maxEdge);
    const canvas=document.createElement('canvas');canvas.width=dims.width;canvas.height=dims.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    if(layoutImage)ctx.drawImage(layoutImage,0,0,canvas.width,canvas.height);else{ctx.fillStyle='#050505';ctx.fillRect(0,0,canvas.width,canvas.height);}
    if(maskImage){
      const mc=document.createElement('canvas');mc.width=canvas.width;mc.height=canvas.height;const mx=mc.getContext('2d',{willReadFrequently:true});mx.imageSmoothingEnabled=true;mx.imageSmoothingQuality='high';mx.drawImage(maskImage,0,0,mc.width,mc.height);
      try{
        const md=mx.getImageData(0,0,mc.width,mc.height),overlay=ctx.createImageData(mc.width,mc.height);
        for(let i=0;i<md.data.length;i+=4){const lum=(md.data[i]+md.data[i+1]+md.data[i+2])/3,alpha=Math.round(Math.max(0,Math.min(255,lum))*.48);overlay.data[i]=0;overlay.data[i+1]=184;overlay.data[i+2]=217;overlay.data[i+3]=alpha;}
        const oc=document.createElement('canvas');oc.width=canvas.width;oc.height=canvas.height;oc.getContext('2d').putImageData(overlay,0,0);ctx.drawImage(oc,0,0);
      }catch(_e){ctx.save();ctx.globalAlpha=.34;ctx.globalCompositeOperation='screen';ctx.drawImage(maskImage,0,0,canvas.width,canvas.height);ctx.restore();}
    }
    const out=encodeCanvas(canvas,'image/webp',quality),after=bytes(out);
    return{src:out||layout||maskSrc,before,after:after||bytes(layout||maskSrc),changed:!!out,width:canvas.width,height:canvas.height,role:'layout-mask-guide',merged:!!(layout&&maskSrc),guideColor:'#00b8d9'};
  }
  async function prepareFastReferenceSet({source,layoutGuide,mask,extraRefs=[]}={}){
    const extras=(Array.isArray(extraRefs)?extraRefs:[]).filter(x=>x&&x.src).slice(0,8);
    const tasks=[recompress(source,{maxEdge:1600,quality:.92,type:'image/webp',keepUnder:1100000}).then(x=>({role:'source',...x}))];
    if(layoutGuide||mask)tasks.push(buildLayoutMaskGuide({layoutGuide,mask,maxEdge:1280,quality:.9}));
    extras.forEach((ref,index)=>tasks.push(recompress(ref.src,{maxEdge:1200,quality:.95,type:'image/webp',keepUnder:650000}).then(x=>Object.assign({role:ref.role||'extra-reference',label:ref.label||'',index},x))));
    const items=(await Promise.all(tasks)).filter(x=>x&&x.src),beforeBytes=bytes(source)+bytes(layoutGuide)+bytes(mask)+extras.reduce((n,x)=>n+bytes(x.src),0),afterBytes=items.reduce((n,x)=>n+(x.after||bytes(x.src)),0);
    return{version:'V28.1.1',referencePlan:'source+layout-mask-guide+text-fidelity-v280',refs:items.map(x=>x.src),items,referenceCount:items.length,originalReferenceCount:[source,layoutGuide,mask,...extras.map(x=>x.src)].filter(Boolean).length,beforeBytes,afterBytes,parallelPrepared:true,mergedGuide:!!(layoutGuide&&mask),extraReferenceCount:extras.length,uploadConcurrencyTarget:2};
  }
  return{VERSION,REFERENCE_PLAN,bytes,scaledSize,recompress,buildLayoutMaskGuide,prepareFastReferenceSet};
});
