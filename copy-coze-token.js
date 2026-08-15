'use strict';
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');

const SECURE_VERSION='local_encrypted_v1';

module.exports=function createCopyCozeTokenStore({root,privateConfig}){
  const secureFile=path.join(root,'config','.copy-coze-token.secure');
  let sessionToken='';

  function normalizeToken(value){
    let token=String(value==null?'':value)
      .replace(/^\uFEFF/,'')
      .replace(/[\u200B-\u200D\u2060\uFEFF]/g,'')
      .trim();
    token=token.replace(/^Bearer\s+/i,'').trim();
    if((token.startsWith('"')&&token.endsWith('"'))||(token.startsWith("'")&&token.endsWith("'")))token=token.slice(1,-1).trim();
    return token.replace(/\s+/g,'');
  }
  function machineSecret(){
    return [process.env.USERNAME||process.env.USER||'user',process.env.COMPUTERNAME||process.env.HOSTNAME||'machine','copy-coze-token-v1'].join('|');
  }
  function deriveKey(salt){return crypto.pbkdf2Sync(machineSecret(),salt,120000,32,'sha256');}
  function xorStream(data,key,iv){
    const out=Buffer.alloc(data.length);let offset=0,counter=0;
    while(offset<data.length){
      const c=Buffer.alloc(4);c.writeUInt32BE(counter++);
      const block=crypto.createHmac('sha256',key).update(iv).update(c).digest();
      for(let i=0;i<block.length&&offset<data.length;i++,offset++)out[offset]=data[offset]^block[i];
    }
    return out;
  }
  function encryptToken(token){
    const salt=crypto.randomBytes(16),iv=crypto.randomBytes(16),key=deriveKey(salt),plain=Buffer.from(token,'utf8');
    const cipher=xorStream(plain,key,iv),tag=crypto.createHmac('sha256',key).update(iv).update(cipher).digest();
    return JSON.stringify({version:1,scheme:'PBKDF2-HMAC-SHA256-STREAM',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:tag.toString('base64'),data:cipher.toString('base64')});
  }
  function decryptToken(text){
    const obj=JSON.parse(String(text||''));
    if(!obj||obj.version!==1)throw new Error('令牌文件版本不受支持');
    const salt=Buffer.from(obj.salt||'','base64'),iv=Buffer.from(obj.iv||'','base64'),tag=Buffer.from(obj.tag||'','base64'),cipher=Buffer.from(obj.data||'','base64'),key=deriveKey(salt);
    const actual=crypto.createHmac('sha256',key).update(iv).update(cipher).digest();
    if(tag.length!==actual.length||!crypto.timingSafeEqual(tag,actual))throw new Error('令牌文件校验失败，可能来自其他 Windows 用户或电脑');
    return normalizeToken(xorStream(cipher,key,iv).toString('utf8'));
  }
  function storedToken(){
    if(!fs.existsSync(secureFile))return'';
    try{return decryptToken(fs.readFileSync(secureFile,'utf8'));}catch(_e){return'';}
  }
  function getToken(){
    const current=normalizeToken(sessionToken);if(current)return{token:current,source:'session'};
    const stored=storedToken();if(stored)return{token:stored,source:SECURE_VERSION};
    const env=normalizeToken(process.env.COZE_API_TOKEN||'');if(env)return{token:env,source:'environment'};
    const legacy=normalizeToken((privateConfig||{}).token||'');if(legacy)return{token:legacy,source:'legacy_config'};
    return{token:'',source:'not_configured'};
  }
  function sourceLabel(source){
    return {session:'仅本次运行',environment:'环境变量',local_encrypted_v1:'本机加密保存',legacy_config:'旧版私有配置',not_configured:'未配置'}[source]||'未配置';
  }
  function status(){
    const t=getToken();
    return{ok:true,configured:!!t.token,tokenLoaded:!!t.token,tokenSource:t.source,tokenSourceLabel:sourceLabel(t.source),secureStorage:SECURE_VERSION,manualTokenInput:true,message:t.token?('扣子访问令牌已配置 · '+sourceLabel(t.source)):'请手动输入有效的扣子访问令牌'};
  }
  function configure(payload){
    payload=payload&&typeof payload==='object'?payload:{};
    if(payload.clear){
      sessionToken='';
      try{fs.unlinkSync(secureFile);}catch(_e){}
      return Object.assign(status(),{cleared:true});
    }
    const raw=String(payload.token==null?'':payload.token),token=normalizeToken(raw);
    if(!token)return{ok:false,error:{code:'token_missing',message:'请输入扣子访问令牌'}};
    if(/^https?:\/\//i.test(token)||token.length<20)return{ok:false,error:{code:'token_invalid',message:'令牌格式或长度异常，请从扣子平台重新复制完整令牌'}};
    if(/^(?:your[_-]?token|replace[_-]?me|token)$/i.test(token))return{ok:false,error:{code:'token_placeholder',message:'当前内容是占位文本，不是有效令牌'}};
    sessionToken=token;
    let persisted=false,warning='';
    if(payload.remember){
      try{
        fs.mkdirSync(path.dirname(secureFile),{recursive:true});
        fs.writeFileSync(secureFile,encryptToken(token),{encoding:'utf8',mode:0o600});
        persisted=true;
        sessionToken='';
      }catch(e){warning='令牌已在本次运行中生效，但本机加密保存失败：'+e.message;}
    }
    return Object.assign(status(),{saved:true,persisted,normalized:token!==raw.trim(),warning});
  }
  return{getToken,status,configure,normalizeToken,secureFile,SECURE_VERSION};
};
