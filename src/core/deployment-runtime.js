/* V29.1 GitHub/Vercel runtime bridge: access gate, managed-key bootstrap and payload guard. */
(function(root){
  'use strict';
  if(!root||!root.fetch)return;

  const VERSION='V29.1';
  const MAX_FUNCTION_BODY_BYTES=4200000;
  const ACCESS_KEY='ai_linkuang_v29_access_code';
  const nativeFetch=root.fetch.bind(root);
  const state={runtime:'unknown',hosted:false,health:null,ready:null};

  function sameOriginApi(input){
    const raw=typeof input==='string'?input:(input&&input.url)||'';
    try{const url=new URL(raw,location.href);return url.origin===location.origin&&url.pathname.startsWith('/api/');}catch(_e){return false;}
  }
  function accessCode(){try{return sessionStorage.getItem(ACCESS_KEY)||'';}catch(_e){return'';}}
  function setAccessCode(value){try{sessionStorage.setItem(ACCESS_KEY,String(value||'').trim());}catch(_e){}}
  function bodyBytes(body){
    if(body==null)return 0;
    if(typeof body==='string')return new TextEncoder().encode(body).length;
    if(body instanceof Blob)return body.size;
    if(body instanceof ArrayBuffer)return body.byteLength;
    if(ArrayBuffer.isView(body))return body.byteLength;
    if(body instanceof URLSearchParams)return new TextEncoder().encode(body.toString()).length;
    if(typeof FormData!=='undefined'&&body instanceof FormData){
      let total=1024;
      for(const [key,value] of body.entries())total+=String(key).length+256+(value instanceof Blob?value.size:String(value).length);
      return total;
    }
    return 0;
  }
  function limitResponse(bytes){
    const mb=(bytes/1024/1024).toFixed(1);
    return new Response(JSON.stringify({ok:false,error:{code:'vercel_payload_limit',message:`当前线上请求约 ${mb}MB，超过 Vercel Function 4.5MB 限制。请缩小图片尺寸、减少参考图，或改用 Windows 本地版处理大图。`}}),{status:413,headers:{'Content-Type':'application/json; charset=utf-8'}});
  }
  root.fetch=function(input,init){
    if(!sameOriginApi(input))return nativeFetch(input,init);
    const options=Object.assign({},init||{});
    const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined)||{});
    const code=accessCode();if(code)headers.set('X-App-Access-Code',code);
    options.headers=headers;
    const bytes=bodyBytes(options.body);
    if(state.hosted&&bytes>MAX_FUNCTION_BODY_BYTES)return Promise.resolve(limitResponse(bytes));
    return nativeFetch(input,options);
  };

  function gateStyle(){
    if(document.getElementById('v29-deployment-style'))return;
    const style=document.createElement('style');style.id='v29-deployment-style';style.textContent=`
      .v29-access-gate{position:fixed;inset:0;z-index:500000;background:rgba(15,23,42,.62);backdrop-filter:blur(16px);display:grid;place-items:center;padding:20px}
      .v29-access-card{width:min(440px,100%);background:#fff;border:1px solid rgba(148,163,184,.35);border-radius:22px;box-shadow:0 32px 90px rgba(15,23,42,.32);padding:26px;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif}
      .v29-access-card h2{font-size:22px;margin:0 0 8px}.v29-access-card p{color:#64748b;line-height:1.65;margin:0 0 18px}
      .v29-access-card input{width:100%;border:1px solid #cbd5e1;border-radius:12px;padding:12px 14px;font-size:15px;outline:none}
      .v29-access-card input:focus{border-color:#7c3aed;box-shadow:0 0 0 4px rgba(124,58,237,.12)}
      .v29-access-card button{width:100%;margin-top:12px;border:0;border-radius:12px;background:#0f172a;color:#fff;padding:12px 16px;font-weight:700;cursor:pointer}
      .v29-access-error{min-height:20px;color:#b91c1c;font-size:13px;margin-top:8px}
      .v29-runtime-badge{position:fixed;left:14px;bottom:14px;z-index:50;border:1px solid #d8b4fe;background:rgba(250,245,255,.94);color:#6b21a8;border-radius:999px;padding:6px 10px;font:600 11px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;box-shadow:0 8px 24px rgba(88,28,135,.12)}
    `;document.head.appendChild(style);
  }
  function runtimeBadge(){
    if(!state.hosted||document.querySelector('.v29-runtime-badge'))return;
    if(!document.body){document.addEventListener('DOMContentLoaded',runtimeBadge,{once:true});return;}
    const badge=document.createElement('div');badge.className='v29-runtime-badge';badge.textContent='V29.1 · 在线预览版';document.body.appendChild(badge);
  }
  function enableVercelAnalytics(){
    if(!state.hosted||document.querySelector('script[data-v29-vercel-analytics]'))return;
    root.va=root.va||function(){(root.vaq=root.vaq||[]).push(arguments);};
    const script=document.createElement('script');script.defer=true;script.src='/_vercel/insights/script.js';script.dataset.v29VercelAnalytics='1';document.head.appendChild(script);
  }
  function showGate(){
    if(!document.body){document.addEventListener('DOMContentLoaded',showGate,{once:true});return null;}
    gateStyle();
    let gate=document.querySelector('.v29-access-gate');
    if(gate)return gate;
    gate=document.createElement('div');gate.className='v29-access-gate';gate.innerHTML='<form class="v29-access-card"><h2>进入 V29.1 工作台</h2><p>这是小范围测试版本。请输入管理员提供的访问口令，口令只保存在当前浏览器标签页。</p><input type="password" autocomplete="current-password" placeholder="访问口令" aria-label="访问口令"><div class="v29-access-error" aria-live="polite"></div><button type="submit">验证并进入</button></form>';
    document.body.appendChild(gate);
    const form=gate.querySelector('form'),input=gate.querySelector('input'),error=gate.querySelector('.v29-access-error'),button=gate.querySelector('button');
    form.addEventListener('submit',async event=>{
      event.preventDefault();const value=input.value.trim();if(!value){error.textContent='请输入访问口令。';return;}
      setAccessCode(value);button.disabled=true;button.textContent='正在验证…';error.textContent='';
      try{const response=await root.fetch('/api/health?access='+Date.now(),{cache:'no-store'}),data=await response.json();if(!data.accessGranted)throw new Error('访问口令不正确');state.health=data;gate.remove();runtimeBadge();document.dispatchEvent(new CustomEvent('v29-runtime-ready',{detail:data}));}
      catch(err){setAccessCode('');error.textContent=err.message||'验证失败，请稍后重试。';}
      finally{button.disabled=false;button.textContent='验证并进入';}
    });setTimeout(()=>input.focus(),20);return gate;
  }
  async function boot(){
    try{
      const response=await root.fetch('/api/health?v29='+Date.now(),{cache:'no-store'}),health=await response.json();
      state.health=health;state.runtime=health.runtime||'unknown';state.hosted=health.runtime==='vercel-serverless';
      if(health.serverManaged&&health.serverManaged.evolink){
        try{localStorage.setItem('api_base_url','https://api.evolink.ai/v1');localStorage.setItem('api_key','server-managed');}catch(_e){}
      }
      enableVercelAnalytics();
      if(health.accessRequired&&!health.accessGranted)showGate();else runtimeBadge();
      document.dispatchEvent(new CustomEvent('v29-runtime-ready',{detail:health}));
      return health;
    }catch(_e){state.runtime='static-only';return null;}
  }
  state.hosted=!/^(?:localhost|127\.0\.0\.1)$/i.test(location.hostname);
  state.ready=boot();
  root.DeploymentRuntimeV29={VERSION,state,ready:()=>state.ready,accessCode,setAccessCode,bodyBytes,enableVercelAnalytics,MAX_FUNCTION_BODY_BYTES};
})(typeof window!=='undefined'?window:null);
