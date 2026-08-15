(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.ElapsedTimer=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function normalizeMs(ms){
    const n=Number(ms);
    return Number.isFinite(n)&&n>0?n:0;
  }
  function formatElapsed(ms){
    const tenths=Math.floor(normalizeMs(ms)/100);
    const totalSeconds=Math.floor(tenths/10);
    const tenth=tenths%10;
    const seconds=totalSeconds%60;
    const totalMinutes=Math.floor(totalSeconds/60);
    const minutes=totalMinutes%60;
    const hours=Math.floor(totalMinutes/60);
    if(hours>0)return `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenth}`;
    return `${String(totalMinutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}.${tenth}`;
  }
  function create(options){
    const opts=options||{};
    const now=typeof opts.now==='function'?opts.now:(()=>typeof performance!=='undefined'&&performance.now?performance.now():Date.now());
    const schedule=typeof opts.setInterval==='function'?opts.setInterval:setInterval;
    const cancel=typeof opts.clearInterval==='function'?opts.clearInterval:clearInterval;
    const intervalMs=Math.max(50,Number(opts.intervalMs)||100);
    const onTick=typeof opts.onTick==='function'?opts.onTick:()=>{};
    let startedAt=0,lastElapsed=0,handle=null,running=false;
    function elapsedMs(){return running?Math.max(0,now()-startedAt):lastElapsed;}
    function emit(){const ms=elapsedMs();onTick({elapsedMs:ms,text:formatElapsed(ms)});return ms;}
    function start(){
      if(running)return controller;
      startedAt=now();lastElapsed=0;running=true;emit();handle=schedule(emit,intervalMs);return controller;
    }
    function stop(){
      if(!running)return lastElapsed;
      lastElapsed=Math.max(0,now()-startedAt);running=false;
      if(handle!=null){cancel(handle);handle=null;}
      onTick({elapsedMs:lastElapsed,text:formatElapsed(lastElapsed),final:true});
      return lastElapsed;
    }
    function reset(){if(running)stop();startedAt=0;lastElapsed=0;return controller;}
    const controller={start,stop,reset,elapsedMs,format:()=>formatElapsed(elapsedMs()),isRunning:()=>running};
    return controller;
  }
  return {normalizeMs,formatElapsed,create};
});
