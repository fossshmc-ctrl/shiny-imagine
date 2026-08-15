'use strict';

function tryJson(value){
  if(value && typeof value === 'object') return value;
  const text=String(value==null?'':value).trim();
  if(!text || text==='[DONE]') return value;
  try{return JSON.parse(text);}catch(_e){return value;}
}

function errorText(data, fallback){
  if(data && typeof data === 'object'){
    const last=data.last_error && typeof data.last_error==='object' ? data.last_error : null;
    return String(data.msg||data.message||(data.error&&data.error.message)||(last&&(last.msg||last.message))||fallback||'扣子对话失败');
  }
  return String(data||fallback||'扣子对话失败');
}

function answerScore(text){
  const s=String(text||'').trim();
  let score=s.length;
  if(/"versions"\s*:/.test(s)) score+=1000000;
  if(/^\s*[\[{]/.test(s)) score+=10000;
  return score;
}

function selectBestAnswer(values){
  const seen=new Set();
  const list=[];
  for(const value of values||[]){
    const text=String(value==null?'':value).trim();
    if(!text || seen.has(text)) continue;
    seen.add(text);list.push(text);
  }
  list.sort((a,b)=>answerScore(b)-answerScore(a));
  return list[0]||'';
}

function parseSseFrames(text){
  const lines=String(text||'').replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
  const frames=[];
  let frame={event:'',dataLines:[],id:''};
  const flush=()=>{
    if(!frame.event && !frame.dataLines.length && !frame.id) return;
    const rawData=frame.dataLines.join('\n').trim();
    frames.push({event:frame.event.trim(),data:tryJson(rawData),rawData,id:frame.id});
    frame={event:'',dataLines:[],id:''};
  };
  for(const rawLine of lines){
    const line=String(rawLine||'');
    if(!line.trim()){flush();continue;}
    if(line.startsWith(':')) continue;
    if(line.startsWith('event:')){
      // 某些本地代理会移除 SSE 空行；遇到下一条 event 时主动封包。
      if(frame.event || frame.dataLines.length) flush();
      frame.event=line.slice(6).trim();
      continue;
    }
    if(line.startsWith('data:')){frame.dataLines.push(line.slice(5).replace(/^\s/,''));continue;}
    if(line.startsWith('id:')){frame.id=line.slice(3).trim();continue;}
    // 兼容只返回 JSON 行或代理去掉 data: 前缀的情况。
    if(/^\s*[\[{]/.test(line) && !frame.dataLines.length) frame.dataLines.push(line.trim());
  }
  flush();
  return frames;
}

function collectIds(data, state){
  if(!data || typeof data!=='object') return;
  const root=data.data && typeof data.data==='object' && !Array.isArray(data.data) ? data.data : data;
  if(root.conversation_id && !state.conversationId) state.conversationId=String(root.conversation_id);
  if((root.chat_id||root.id) && !state.chatId) state.chatId=String(root.chat_id||root.id);
  if(root.status) state.status=String(root.status);
  if(root.detail && root.detail.logid) state.logId=String(root.detail.logid);
}

function collectAnswersFromObject(value, answers, depth){
  if(depth>7 || value==null) return;
  if(Array.isArray(value)){
    for(const item of value) collectAnswersFromObject(item,answers,depth+1);
    return;
  }
  if(typeof value!=='object') return;
  const role=String(value.role||'').toLowerCase();
  const type=String(value.type||'').toLowerCase();
  if((!role || role==='assistant') && (!type || type==='answer') && typeof value.content==='string' && value.content.trim()) answers.push(value.content);
  for(const key of ['answer','reply','output','output_text','text']){
    if(typeof value[key]==='string' && value[key].trim()) answers.push(value[key]);
  }
  for(const key of ['data','result','messages','message','items','outputs']){
    if(value[key]!=null) collectAnswersFromObject(value[key],answers,depth+1);
  }
}

function parseJsonEnvelope(text){
  const raw=String(text||'').trim();
  if(!raw || !/^[\[{]/.test(raw)) return null;
  let obj;try{obj=JSON.parse(raw);}catch(_e){return null;}
  const state={conversationId:'',chatId:'',status:'',logId:''};
  collectIds(obj,state);
  if(obj && typeof obj==='object' && !Array.isArray(obj) && Number(obj.code||0)!==0){
    const err=new Error(errorText(obj,'扣子接口返回业务错误'));
    err.cozeCode=obj.code;err.logId=state.logId;throw err;
  }
  const answers=[];collectAnswersFromObject(obj,answers,0);
  return {answer:selectBestAnswer(answers),events:[],eventNames:[],rawKind:'json',...state};
}

function parseCozePayload(text){
  const raw=String(text==null?'':text).replace(/^\uFEFF/,'').trim();
  const json=parseJsonEnvelope(raw);
  if(json && json.answer) return json;
  const frames=parseSseFrames(raw);
  const state={conversationId:json?.conversationId||'',chatId:json?.chatId||'',status:json?.status||'',logId:json?.logId||''};
  const completed=[];
  const deltas=new Map();
  const loose=[];
  const eventNames=[];
  for(const frame of frames){
    const event=String(frame.event||'');
    if(event && !eventNames.includes(event)) eventNames.push(event);
    const data=frame.data;
    collectIds(data,state);
    if(event==='conversation.chat.failed' || event==='error'){
      const err=new Error(errorText(data,frame.rawData));
      if(data&&typeof data==='object'){err.cozeCode=data.code;err.logId=(data.detail&&data.detail.logid)||state.logId;}
      throw err;
    }
    if(data && typeof data==='object'){
      if(Number(data.code||0)!==0 && !data.role && !data.type){
        const err=new Error(errorText(data,'扣子接口返回业务错误'));
        err.cozeCode=data.code;err.logId=(data.detail&&data.detail.logid)||state.logId;throw err;
      }
      const role=String(data.role||'').toLowerCase();
      const type=String(data.type||'').toLowerCase();
      if((!role || role==='assistant') && type==='answer' && data.content){
        const content=String(data.content);
        if(event==='conversation.message.delta'){
          const key=String(data.id||data.message_id||'default');
          deltas.set(key,(deltas.get(key)||'')+content);
        }else if(event==='conversation.message.completed' || !event){
          completed.push(content);
        }
      }
      collectAnswersFromObject(data,loose,0);
    }
  }
  const answer=selectBestAnswer(completed.length?completed:[...deltas.values(),...loose,json?.answer||'']);
  return {answer,events:frames,eventNames,rawKind:frames.length?'sse':(json?'json':'unknown'),...state};
}

function answersFromMessageList(payload){
  if(!payload || typeof payload!=='object') return '';
  if(Number(payload.code||0)!==0){
    const err=new Error(errorText(payload,'获取扣子消息详情失败'));
    err.cozeCode=payload.code;err.logId=payload.detail&&payload.detail.logid;throw err;
  }
  const items=Array.isArray(payload.data)?payload.data:[];
  const answers=items.filter(x=>x&&String(x.role||'').toLowerCase()==='assistant'&&String(x.type||'').toLowerCase()==='answer'&&x.content).map(x=>String(x.content));
  return selectBestAnswer(answers);
}

module.exports={parseSseFrames,parseCozePayload,selectBestAnswer,answersFromMessageList,errorText};
