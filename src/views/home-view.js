/* ============ 视图 ============ */
function viewHome(){
  const cards=[
    {em:uiIcon('copy'),n:'文案生成',d:'输入主题，AI 帮你生成营销文案',k:'copy'},
    {em:uiIcon('wire'),n:'AI 线框生成',d:'排版参考图 + 文案，AI 生成线框图',k:'integrate'},
    {em:uiIcon('image'),n:'AI 生图',d:'输入描述，生成精美图片',k:'image'},
    {em:uiIcon('adjust'),n:'智能区域编辑',d:'识别图片区域，调整区域位置、大小与局部生成任务',k:'adjust'},
    {em:'📊',n:'主图投放测图',d:'登记主图测试后的曝光、点击、转化等投放数据',soon:true},
  ].map(t=>`<div class="tcard ${t.soon?'soon':''}"><div class="inner" ${t.soon?'':`data-k="${t.k}"`}>
    <span class="em">${t.em}</span><h3>${t.n}</h3><p>${t.d}</p>
    ${t.soon?'<span class="soon-badge">即将上线</span>':'<span class="enter">进入</span>'}</div></div>`).join('');
  return `<div class="home-h"><h2>V29 · 图灵线框工作台</h2><p>支持 Windows 本地运行与 GitHub / Vercel 在线预览，快速完成文案、线框、生图与智能区域编辑任务。</p></div><div class="tools">${cards}</div>`;
}

const COPY_API_CHANNEL_KEY='copyApiChannel_v123';
const COPY_JSON_PROMPT_DEFAULT="你是专业的电商文案结构化助手。请根据用户输入的产品信息，生成 8 个不同策略的文案版本。\n\n只返回合法 JSON，不要输出 Markdown、代码围栏、解释或额外文字。\n\n固定返回结构：\n{\n  \"versions\": [\n    {\n      \"version\": 1,\n      \"style\": \"策略名称\",\n      \"mainTitle\": \"主标题\",\n      \"coreSellingPoint\": \"核心卖点\",\n      \"functionArea\": \"功能区文案\",\n      \"subtitles\": [\"小标题1\", \"小标题2\", \"小标题3\"],\n      \"consumerInsight\": \"消费者洞察\"\n    }\n  ]\n}\n\n规则：\n1. versions 必须包含 8 个对象，version 从 1 到 8。\n2. 每个版本必须包含 mainTitle、coreSellingPoint、functionArea、subtitles、consumerInsight。\n3. subtitles 必须固定为 3 条短文案。\n4. 文案简洁、明确、适合电商主图，不自动添加产品信息之外的功效承诺。\n5. consumerInsight 只用于内部策略分析，不作为图片画面文字。";
const COPY_API_DEFAULT={
  endpoint:'/chat/completions',
  method:'POST',
  responsePath:'choices.0.message.content',
  requestTemplate:JSON.stringify({
    model:'{{model}}',
    messages:[
      {role:'system',content:'{{json_prompt}}'},
      {role:'user',content:'请根据以下产品信息生成 8 个文案版本：\\n{{product_info}}'}
    ],
    temperature:0.4
  },null,2),
  jsonPrompt:COPY_JSON_PROMPT_DEFAULT,
  fieldMapping:{
    mainTitle:'',coreSellingPoint:'',functionArea:'',subtitle1:'',subtitle2:'',subtitle3:'',consumerInsight:''
  },
  mappingName:'默认字段映射',
  lastMapped:null,
  lastResponse:'',
  updatedAt:'',
  promptLinkEnabled:true,
  lastAppliedAt:'',
  lastAppliedVersions:[]
};
let COPY_API_CHANNEL=loadCopyApiChannel();
function loadCopyApiChannel(){try{const v=JSON.parse(localStorage.getItem(COPY_API_CHANNEL_KEY)||localStorage.getItem('copyApiChannel_v119')||localStorage.getItem('copyApiChannel_v118')||'null');const out=Object.assign({},COPY_API_DEFAULT,v||{});out.fieldMapping=Object.assign({},COPY_API_DEFAULT.fieldMapping,(v&&v.fieldMapping)||{});out.jsonPrompt=(v&&v.jsonPrompt)||COPY_JSON_PROMPT_DEFAULT;if(!out.requestTemplate||String(out.requestTemplate).includes('你是专业的电商文案生成助手。请根据产品信息输出结构化 JSON，字段包含 versions 数组。'))out.requestTemplate=COPY_API_DEFAULT.requestTemplate;return out;}catch(e){return Object.assign({},COPY_API_DEFAULT,{jsonPrompt:COPY_JSON_PROMPT_DEFAULT,fieldMapping:Object.assign({},COPY_API_DEFAULT.fieldMapping)});}}
function saveCopyApiChannel(){localStorage.setItem(COPY_API_CHANNEL_KEY,JSON.stringify(COPY_API_CHANNEL));}
