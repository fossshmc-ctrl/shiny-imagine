/* V27.9 region prompt state: keeps manual intent editable while geometry/text facts stay live. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){root.RegionPromptStateV279=api;root.RegionPromptStateV278=api;root.RegionPromptStateV277=api;}
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  const VERSION='V28.1.1';
  const MARKER='\n\n【V27.9 实时参数（自动更新）】\n';
  const MARKER_RE=/(?:^|\n\n)【V(?:17|18|19|20|21|22|23|24|25|26|27)(?:\.[0-9]+)?\s*实时参数(?:（自动更新(?:，请勿手改)?）)?】\n/;

  function clean(value){return String(value==null?'':value).replace(/\r\n/g,'\n').trim();}
  function looksGeneratedPrompt(value){
    const text=clean(value);if(!text)return false;
    return /^(?:仅修改区域|修改区域)/.test(text)&&/(?:原始位置|原始区域左上角坐标)/.test(text)&&/(?:目标位置|目标区域左上角|目标保持不变)/.test(text);
  }
  function uniq(values){const out=[];for(const value of values){const text=clean(value);if(text&&!out.includes(text))out.push(text);}return out;}
  function stripKnownAuto(value,candidates){
    let text=clean(value);if(!text)return'';
    for(const auto of uniq(candidates||[])){
      if(text===auto)return'';
      if(text.startsWith(auto))return clean(text.slice(auto.length));
      if(text.endsWith(auto))return clean(text.slice(0,-auto.length));
      const at=text.indexOf(auto);
      if(at>=0)return clean(text.slice(0,at)+'\n'+text.slice(at+auto.length));
    }
    return looksGeneratedPrompt(text)?'':text;
  }
  function mergeManual(){return uniq(Array.from(arguments)).join('\n\n');}
  function extractManual(value,currentAuto,lastAuto){
    const text=clean(value);if(!text)return'';
    const match=MARKER_RE.exec(text);
    if(match){
      const before=clean(text.slice(0,match.index));
      const after=clean(text.slice(match.index+match[0].length));
      const extra=stripKnownAuto(after,[currentAuto,lastAuto]);
      return mergeManual(before,extra);
    }
    return stripKnownAuto(text,[currentAuto,lastAuto]);
  }
  function textValue(value){return clean(value).replace(/\s+/g,' ').slice(0,800);}
  function applyTextEdit(region,value){
    if(!region)return{changed:false,text:'',original:''};
    const text=clean(value),before=clean(region.recognizedText??region.content??region.label??'');
    if(!Object.prototype.hasOwnProperty.call(region,'__v277OriginalText'))region.__v277OriginalText=before;
    const original=clean(region.__v277OriginalText);
    region.__v277TextBefore=original;region.__v277TextAfter=text;region.recognizedText=text;region.content=text;
    if(text){region.label=text.slice(0,48);region.name=region.label;}
    region.regionTextEdited=original!==text;region.manualCorrected=true;
    if(!region.regionTextEdited){delete region.__v277TextBefore;delete region.__v277TextAfter;}
    return{changed:region.regionTextEdited,text,original};
  }
  function textEditInstruction(region){
    if(!region||!region.regionTextEdited)return'';
    const original=textValue(region.__v277OriginalText??region.__v277TextBefore??''),next=textValue(region.__v277TextAfter??region.recognizedText??region.content??'');
    if(original===next)return'';
    if(!next&&original)return`必须删除该文字区域中的原文“${original}”，不要填入其他文案；同时尽量保持原文字区域的背景、边缘和周边排版自然。`;
    if(!original&&next)return`必须在该文字区域准确写入“${next}”，不得新增其他文案；尽量匹配当前页面的字体、字号、颜色、字距、对齐与清晰度。`;
    return`必须将该文字区域原文“${original}”准确替换为“${next}”，不得保留旧文、不得新增其他文案；尽量保持原字体、字号、颜色、排版、字距和清晰度。`;
  }
  function isFreeRegion(region){
    if(!region)return false;
    const source=clean(region.source).toLowerCase(),regionId=clean(region.region_id||region.regionId);
    return !!(region.manualCreated||source==='manual-free-region'||source==='manual-brush'||/^custom[_-]/i.test(regionId));
  }
  function freeRegionInstruction(region,currentAuto,lastAuto){
    if(!isFreeRegion(region))return'';
    const seed=clean(region.__v278CreationInstruction||region.aiUserInstruction||region.suggestedInstruction||'');
    const extracted=extractManual(seed,currentAuto,lastAuto);
    if(extracted)return extracted;
    const label={text:'文字区域',product:'产品区域',person:'人物/宠物区域',background:'背景区域',decoration:'装饰区域'}[clean(region.type)]||'自定义区域';
    return`仅处理自由添加的${label}，严格限制在该区域及其目标区域内；按照当前区域的位置、尺寸、执行方式和用户后续指令完成编辑，其他区域保持不变。`;
  }
  function compose(manual,auto){
    const m=clean(manual),a=clean(auto);
    if(!a)return m;
    return m?`${m}${MARKER}${a}`:`${MARKER.trimStart()}${a}`;
  }
  function migrate(opts){
    opts=opts||{};
    const currentAuto=clean(opts.currentAuto),lastAuto=clean(opts.lastAuto),stored=clean(opts.storedManual);
    const legacyFull=clean(opts.fullOverride),existing=clean(opts.existing);
    const fromFull=legacyFull?extractManual(legacyFull,currentAuto,lastAuto):'';
    const fromExisting=!stored&&!legacyFull?extractManual(existing,currentAuto,lastAuto):'';
    return mergeManual(stored,fromFull,fromExisting);
  }
  return{VERSION,MARKER,MARKER_RE,clean,looksGeneratedPrompt,uniq,stripKnownAuto,mergeManual,extractManual,textValue,applyTextEdit,textEditInstruction,isFreeRegion,freeRegionInstruction,compose,migrate};
});
