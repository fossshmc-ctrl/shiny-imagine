import json
import os
import base64
import mimetypes
import re
import tempfile
import socket
import ipaddress
import sys
import time
import threading
import hashlib
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, urlencode, parse_qs
from urllib.request import Request, ProxyHandler, build_opener

import paddleocr_cloud_service
import copy_coze_token

ROOT = os.path.dirname(os.path.abspath(__file__))
APP_VERSION = 'V29.1'
BUILD_ID = 'v29.1-wireframe-vercel-preview-fix-20260815'
EVOLINK_BASE = 'https://api.evolink.ai/v1'
EVOLINK_FILES_BASE = 'https://files-api.evolink.ai'
EVOLINK_IMAGE_MODELS = ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview', 'nano-banana-pro-beta', 'nano-banana-2-beta', 'nano-banana-2-lite-beta', 'nano-banana-beta', 'gemini-2.5-flash-image', 'gpt-image-2', 'gpt-image-2-beta', 'gpt-image-1.5', 'doubao-seedream-5.0-pro', 'doubao-seedream-5.0-lite', 'doubao-seedream-4.5', 'doubao-seedream-4.0', 'qwen-image-3.0', 'qwen-image-3.0-pro', 'qwen-image-edit', 'qwen-image-edit-plus', 'wan2.5-text-to-image', 'wan2.5-image-to-image', 'z-image-turbo', 'krea-2-turbo', 'mj-v8.1', 'mj-v8.1-retexture', 'mj-v8.1-remove-bg', 'mj-v7', 'mj-v7-retexture', 'mj-v7-remove-bg']

def is_evolink_base(base):
    try:
        return (urlparse(str(base or '')).hostname or '').lower() in ('api.evolink.ai', 'direct.evolink.ai')
    except Exception:
        return False

def normalize_evolink_base(base):
    raw = str(base or '').strip().rstrip('/')
    try:
        parsed = urlparse(raw)
        host = (parsed.hostname or '').lower()
        if host.endswith('evolink.ai') and '/docs/' in (parsed.path or '').lower():
            return EVOLINK_BASE
        if host == 'api.evolink.ai':
            path = (parsed.path or '').rstrip('/')
            if not path or path == '/v1' or path == '/v1/images/generations' or path == '/v1/models' or path.startswith('/v1/tasks/'):
                return EVOLINK_BASE
    except Exception:
        pass
    return raw

def evolink_model_payload():
    return {'object':'list','data':[{'id':mid,'object':'model','type':'image','output_modalities':['image'],'supported_endpoints':['/v1/images/generations']} for mid in EVOLINK_IMAGE_MODELS]}

def _array_field(obj, keys):
    if not isinstance(obj, dict): return []
    for key in keys:
        value=obj.get(key)
        if isinstance(value,list) and value:return [str(x) for x in value if x is not None]
    return []

def _number_field(obj, keys):
    if not isinstance(obj, dict): return None
    for key in keys:
        try:
            value=float(obj.get(key))
            if value >= 0:return value
        except Exception: pass
    return None

def normalize_evolink_model_capability(model):
    row={'id':model} if isinstance(model,str) else dict(model or {})
    model_id=str(row.get('id') or row.get('name') or row.get('model') or '').strip()
    if not model_id:return None
    arch=row.get('architecture') if isinstance(row.get('architecture'),dict) else {}
    params=row.get('parameters') or row.get('parameter_schema') or row.get('schema') or {}
    if not isinstance(params,dict):params={}
    endpoints=_array_field(row,['supported_endpoints','endpoints']) or _array_field(arch,['supported_endpoints','endpoints'])
    inputs=_array_field(row,['input_modalities','modalities_in','input_types']) or _array_field(arch,['input_modalities','modalities_in','input_types'])
    outputs=_array_field(row,['output_modalities','modalities_out','output_types']) or _array_field(arch,['output_modalities','modalities_out','output_types'])
    max_images=_number_field(row,['max_input_images','max_images','max_reference_images','reference_image_limit'])
    if max_images is None:max_images=_number_field(params,['max_input_images','max_images','max_reference_images','reference_image_limit'])
    aspects=_array_field(row,['aspect_ratios','supported_aspect_ratios']) or _array_field(params,['aspect_ratios','supported_aspect_ratios','size_options'])
    resolutions=_array_field(row,['resolutions','supported_resolutions']) or _array_field(params,['resolutions','supported_resolutions','resolution_options'])
    qualities=_array_field(row,['qualities','supported_qualities','quality_options']) or _array_field(params,['qualities','supported_qualities','quality_options'])
    joined=' '.join(endpoints+outputs+[model_id]).lower()
    image_output=bool(re.search(r'image|gpt[-_ ]?image|nano[-_ ]?banana|seedream|qwen.*image|wan.*image|z[-_ ]?image|krea|midjourney|^mj[-_ ]?v',joined))
    supports_image_input=(any('image' in x.lower() for x in inputs) if inputs else None)
    return {'id':model_id,'imageOutput':image_output,'supportedEndpoints':endpoints,'inputModalities':inputs,'outputModalities':outputs,'supportsImageInput':supports_image_input,'maxInputImages':max_images,'aspectRatios':aspects,'resolutions':resolutions,'qualities':qualities,'source':'evolink-model-catalog'}

def evolink_capability_payload(rows, source='builtin'):
    models=[x for x in (rows or []) if x]
    caps=[c for c in (normalize_evolink_model_capability(x) for x in models) if c]
    return {'ok':True,'version':APP_VERSION,'source':source,'refreshedAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'models':models,'capabilities':caps}

def evolink_credits_payload(raw, status):
    body=raw if isinstance(raw,dict) else {}
    data=body.get('data') if isinstance(body.get('data'),dict) else {}
    token=data.get('token') if isinstance(data.get('token'),dict) else {}
    user=data.get('user') if isinstance(data.get('user'),dict) else {}
    def num(v):
        try:return float(v)
        except Exception:return None
    token_remaining=num(token.get('remaining_credits'));user_remaining=num(user.get('remaining_credits'))
    token_used=num(token.get('used_credits'));user_used=num(user.get('used_credits'));token_unlimited=token.get('unlimited_credits') is True
    blocked_by_token=(not token_unlimited and token_remaining is not None and token_remaining <= 0)
    blocked_by_user=(user_remaining is not None and user_remaining <= 0)
    candidates=[]
    if user_remaining is not None:candidates.append(user_remaining)
    if not token_unlimited and token_remaining is not None:candidates.append(token_remaining)
    effective=min(candidates) if candidates else (user_remaining if token_unlimited else None)
    recognized=(token_remaining is not None or user_remaining is not None or token_unlimited)
    checked=200 <= int(status or 0) < 300 and body.get('success') is not False and recognized
    return {'checked':checked,'recognized':recognized,'blocked':bool(blocked_by_token or blocked_by_user),'generationReady':bool(checked and not (blocked_by_token or blocked_by_user)),'tokenRemaining':token_remaining,'userRemaining':user_remaining,'tokenUsed':token_used,'userUsed':user_used,'tokenUnlimited':token_unlimited,'effectiveRemaining':effective,'success':body.get('success') is not False,'message':str(body.get('message') or '')}

_EVOLINK_MODEL_CACHE={'base':'','at':0.0,'raw':None,'rows':[]}
_EVOLINK_MODEL_CACHE_TTL=300.0

def fetch_evolink_model_catalog(base,key,force=False):
    normalized=normalize_evolink_base(base or EVOLINK_BASE);now=time.time()
    if (not force and _EVOLINK_MODEL_CACHE.get('base')==normalized and _EVOLINK_MODEL_CACHE.get('rows') and now-float(_EVOLINK_MODEL_CACHE.get('at') or 0)<_EVOLINK_MODEL_CACHE_TTL):
        return dict(_EVOLINK_MODEL_CACHE, cached=True)
    status,headers,raw=request_external('GET',normalized+'/models',key)
    try:data=json.loads(raw.decode('utf-8','ignore') or '{}')
    except Exception:data={}
    rows=data if isinstance(data,list) else (data.get('data') or data.get('models') or [])
    if not (200 <= status < 300 and isinstance(rows,list) and rows):raise RuntimeError(f'EvoLink /models 返回无效：HTTP {status}')
    _EVOLINK_MODEL_CACHE.update({'base':normalized,'at':now,'raw':data,'rows':rows})
    return dict(_EVOLINK_MODEL_CACHE,cached=False)
WIRE_ASSET_FILES = [f'assets/wolassen/{i:02d}.jpg' for i in range(2, 11)] + [f'assets/lebao/{i:02d}.jpg' for i in range(2, 11)]
V26_DATA_DIR = os.path.join(ROOT, 'data', 'v26')
V26_WIRE_HISTORY_ASSET_DIR = os.path.join(V26_DATA_DIR, 'wireframe-history-assets')
V26_WIRE_HISTORY_FILE = os.path.join(V26_DATA_DIR, 'wireframe-history.json')
V26_IMAGE_TASKS_FILE = os.path.join(V26_DATA_DIR, 'image-tasks.json')
V26_EVOLINK_REFERENCE_CACHE_FILE = os.path.join(V26_DATA_DIR, 'evolink-reference-cache.json')
os.makedirs(V26_WIRE_HISTORY_ASSET_DIR, exist_ok=True)
_DATA_LOCK = threading.RLock()

def _safe_id(value):
    text = re.sub(r'[^a-zA-Z0-9._-]+', '-', str(value or '')).strip('-')[:120]
    return text or ('item-' + str(int(time.time()*1000)))

def _read_collection(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data=json.load(f)
        items=data.get('items') if isinstance(data,dict) else []
        return items if isinstance(items,list) else []
    except Exception:
        return []

def _write_collection(path, items):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.tmp-v26-',dir=os.path.dirname(path))
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as f: json.dump({'version':1,'items':items},f,ensure_ascii=False,indent=2)
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):
            try: os.unlink(tmp)
            except Exception: pass

def _collection_list(path, limit=200):
    with _DATA_LOCK:
        items=_read_collection(path)
    items.sort(key=lambda x:str((x or {}).get('updatedAt') or (x or {}).get('createdAt') or ''),reverse=True)
    return items[:max(1,int(limit or 200))]

def _collection_get(path, item_id):
    key=str(item_id or '')
    with _DATA_LOCK:
        return next((dict(x) for x in _read_collection(path) if str((x or {}).get('id') or '')==key),None)

def _collection_upsert(path,item,max_items):
    now=time.strftime('%Y-%m-%dT%H:%M:%S')
    next_item=dict(item or {});next_item['id']=_safe_id(next_item.get('id'));next_item['updatedAt']=now
    with _DATA_LOCK:
        items=_read_collection(path);old=next((x for x in items if str((x or {}).get('id') or '')==next_item['id']),None)
        next_item['createdAt']=(old or {}).get('createdAt') or next_item.get('createdAt') or now
        items=[x for x in items if str((x or {}).get('id') or '')!=next_item['id']]
        items.insert(0,next_item);items=items[:max_items];_write_collection(path,items)
    return next_item

def _collection_remove(path,item_id):
    key=str(item_id or '')
    with _DATA_LOCK:
        items=_read_collection(path);new=[x for x in items if str((x or {}).get('id') or '')!=key]
        changed=len(new)!=len(items)
        if changed:_write_collection(path,new)
    return changed

def _materialize_wire_image(src,item_id):
    value=str(src or '').strip()
    if not value:return ''
    if value.startswith('/api/wireframe-history/assets/'):return value
    data=b'';ext='.png'
    if value.lower().startswith('data:image/'):
        m=re.match(r'^data:(image/[^;,]+)(?:;charset=[^;,]+)?;base64,(.+)$',value,re.I|re.S)
        if not m: raise ValueError('历史图片 Data URL 无效')
        data=base64.b64decode(m.group(2));mime=m.group(1).lower();ext='.jpg' if 'jpeg' in mime or 'jpg' in mime else '.webp' if 'webp' in mime else '.gif' if 'gif' in mime else '.png'
    elif value.startswith('/assets/'):
        full=os.path.realpath(os.path.join(ROOT,value.lstrip('/')))
        if not full.startswith(os.path.realpath(ROOT)+os.sep):raise ValueError('历史图片路径越界')
        with open(full,'rb') as f:data=f.read()
        ext=os.path.splitext(full)[1].lower() or '.png'
    elif value.lower().startswith(('http://','https://')):
        req=Request(value,headers={'User-Agent':'AI-Tool-V27.9/1.0','Accept':'image/*,*/*;q=0.8'})
        opener=make_opener(value)
        with opener.open(req,timeout=45) as response:
            data=response.read(35*1024*1024+1);ctype=str(response.headers.get('Content-Type') or '').lower()
            if len(data)>35*1024*1024:raise ValueError('历史图片超过 35MB')
            ext='.jpg' if 'jpeg' in ctype or 'jpg' in ctype else '.webp' if 'webp' in ctype else '.gif' if 'gif' in ctype else os.path.splitext(urlparse(value).path)[1].lower() or '.png'
    else: raise ValueError('历史图片来源不支持持久化')
    if ext=='.jpeg':ext='.jpg'
    if ext not in ('.png','.jpg','.webp','.gif'):ext='.png'
    name=_safe_id(item_id)+ext
    with open(os.path.join(V26_WIRE_HISTORY_ASSET_DIR,name),'wb') as f:f.write(data)
    return '/api/wireframe-history/assets/'+name

def _remove_wire_asset(item):
    try:
        src=str((item or {}).get('src') or '')
        prefix='/api/wireframe-history/assets/'
        if src.startswith(prefix):
            full=os.path.realpath(os.path.join(V26_WIRE_HISTORY_ASSET_DIR,src[len(prefix):]))
            if full.startswith(os.path.realpath(V26_WIRE_HISTORY_ASSET_DIR)+os.sep) and os.path.exists(full):os.unlink(full)
    except Exception:pass

def _is_private_image_export_host(hostname):
    h=str(hostname or '').strip().lower().strip('[]')
    if not h or h=='localhost' or h.endswith('.local'): return True
    try:
        ip=ipaddress.ip_address(h)
        return bool(ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_unspecified or ip.is_reserved)
    except ValueError:
        return False

def _image_mime_from_binary(data,content_type,url):
    ctype=str(content_type or '').split(';',1)[0].strip().lower()
    if ctype in ('image/png','image/jpeg','image/jpg','image/webp','image/gif'): return 'image/jpeg' if ctype=='image/jpg' else ctype
    b=data or b''
    if b.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if len(b)>=3 and b[:3]==b'\xff\xd8\xff': return 'image/jpeg'
    if b.startswith((b'GIF87a',b'GIF89a')): return 'image/gif'
    if len(b)>=12 and b[:4]==b'RIFF' and b[8:12]==b'WEBP': return 'image/webp'
    ext=os.path.splitext(urlparse(str(url or '')).path)[1].lower()
    return 'image/jpeg' if ext in ('.jpg','.jpeg') else 'image/webp' if ext=='.webp' else 'image/gif' if ext=='.gif' else 'image/png'

def _read_remote_image_for_export(url):
    parsed=urlparse(str(url or ''))
    if parsed.scheme not in ('http','https') or _is_private_image_export_host(parsed.hostname): raise ValueError('图片下载代理仅允许公网 HTTP(S) 图片地址')
    req=Request(url,headers={'User-Agent':'AI-Tool-V27.9/1.0','Accept':'image/*,*/*;q=0.8'})
    opener=make_opener(url)
    with opener.open(req,timeout=45) as response:
        data=response.read(35*1024*1024+1)
        if len(data)>35*1024*1024: raise ValueError('远程图片超过 35MB')
        if not data: raise ValueError('远程图片内容为空')
        final_url=response.geturl() or url
        return data,_image_mime_from_binary(data,response.headers.get('Content-Type'),final_url)

def wireframe_asset_status():
    assets = []
    for relative in WIRE_ASSET_FILES:
        full = os.path.join(ROOT, *relative.split('/'))
        try:
            size = os.path.getsize(full)
            assets.append({'path': '/' + relative, 'ok': os.path.isfile(full) and size > 0, 'size': size})
        except Exception as exc:
            assets.append({'path': '/' + relative, 'ok': False, 'size': 0, 'error': getattr(exc, 'errno', None) or str(exc)})
    missing = [item['path'] for item in assets if not item['ok']]
    return {'ok': True, 'version': APP_VERSION, 'buildId': BUILD_ID, 'rootPath': ROOT, 'assetsReady': not missing, 'total': len(assets), 'ready': len(assets)-len(missing), 'missing': missing, 'assets': assets}
CONFIG_PATH = os.path.join(ROOT, 'config.json')
COPY_COZE_PRIVATE_PATH = os.path.join(ROOT, 'copy-coze.private.json')
HTML_FILE = 'index.html'
COMMON_PROXIES = [
    'http://127.0.0.1:7890', 'http://127.0.0.1:7897',
    'http://127.0.0.1:7891', 'http://127.0.0.1:10809',
    'http://127.0.0.1:1080', 'http://127.0.0.1:10808',
    'http://127.0.0.1:2080', 'http://127.0.0.1:8080',
    'http://127.0.0.1:8888',
]

try:
    with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
        CFG = json.load(f)
except Exception:
    CFG = {}
try:
    with open(COPY_COZE_PRIVATE_PATH, 'r', encoding='utf-8') as f:
        COPY_COZE = json.load(f)
except Exception:
    COPY_COZE = {}

PORT = int(CFG.get('port', 8787))
FORCE_IP = str(CFG.get('forceHostIp') or '').strip()
PROXY_SETTING = str(
    CFG.get('proxyUrl')
    or os.environ.get('HTTPS_PROXY')
    or os.environ.get('https_proxy')
    or os.environ.get('HTTP_PROXY')
    or os.environ.get('http_proxy')
    or os.environ.get('ALL_PROXY')
    or os.environ.get('all_proxy')
    or ''
).strip()
NETWORK_CFG = CFG.get('network') if isinstance(CFG.get('network'), dict) else {}
REQUEST_TIMEOUT_MS = max(15000, int(NETWORK_CFG.get('requestTimeoutMs') or 120000))
UPLOAD_TIMEOUT_MS = max(30000, int(NETWORK_CFG.get('uploadTimeoutMs') or 300000))
UPLOAD_ATTEMPT_TIMEOUT_MS = max(15000, min(UPLOAD_TIMEOUT_MS, int(NETWORK_CFG.get('uploadAttemptTimeoutMs') or 90000)))
MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS = max(12000, min(60000, int(NETWORK_CFG.get('microUploadAttemptTimeoutMs') or 30000)))
MICRO_TASK_REQUEST_TIMEOUT_MS = max(5000, min(30000, int(NETWORK_CFG.get('microTaskRequestTimeoutMs') or 12000)))
MICRO_GENERATION_SUBMIT_TIMEOUT_MS = max(15000, min(90000, int(NETWORK_CFG.get('microGenerationSubmitTimeoutMs') or 45000)))
MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS = max(30000, int(NETWORK_CFG.get('microAdjustPollSoftTimeoutMs') or 180000))
MICRO_ADJUST_POLL_TIMEOUT_MS = max(MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS, int(NETWORK_CFG.get('microAdjustPollTimeoutMs') or 360000))
MICRO_ADJUST_POLL_MAX_TIMEOUT_MS = max(MICRO_ADJUST_POLL_TIMEOUT_MS, int(NETWORK_CFG.get('microAdjustPollMaxTimeoutMs') or 480000))
MICRO_RUN_STALE_MS = max(MICRO_ADJUST_POLL_MAX_TIMEOUT_MS + 60000, int(NETWORK_CFG.get('microRunStaleMs') or 600000))
DIAGNOSTIC_TIMEOUT_MS = max(5000, int(NETWORK_CFG.get('diagnosticTimeoutMs') or 20000))
UPLOAD_RETRY_DELAYS_MS = [int(x) for x in (NETWORK_CFG.get('uploadRetryDelaysMs') or [1200,3000,7000]) if isinstance(x,(int,float))]
RESOLVED_PROXY = None
AUTO_PROXY_CACHE = {}
AUTO_PROXY_BAD_UNTIL = {}
FILE_ROUTE_HEALTH = {}
MICRO_ROUTE_HEALTH = {}
SERVER_LOGS = []

def push_server_log(**entry):
    item = {
        'time': time.strftime('%Y-%m-%d %H:%M:%S'),
        'method': entry.get('method', ''),
        'path': entry.get('path', ''),
        'status': entry.get('status', 0),
        'durationMs': entry.get('durationMs', 0),
        'channel': entry.get('channel', ''),
        'message': entry.get('message', ''),
    }
    if entry.get('fieldAudit') is not None:
        item['fieldAudit'] = entry.get('fieldAudit')
    SERVER_LOGS.insert(0, item)
    del SERVER_LOGS[200:]
    return item


COPY_EXPECTED_FIELDS = ['version','style','mainTitle','coreSellingPoint','functionArea','subtitles','consumerInsight']
COPY_FIELD_ALIASES = {
    'mainTitle': ['main_title','title','headline'],
    'coreSellingPoint': ['core_selling_point','sellingPoint','selling_point','benefits'],
    'functionArea': ['function_area','subInfo','features'],
    'consumerInsight': ['consumer_insight','insight'],
    'subtitles': ['subtitle','smallTitles'],
}

def _copy_empty(value):
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (list, dict)):
        return len(value) == 0
    return False

def audit_copy_return(content):
    audit = {'schema':'copy-v25.5','ok':False,'parsed':False,'expectedVersionCount':8,'versionCount':0,'rootFields':[],'missingRoot':[],'extraRoot':[],'missingFieldCount':0,'emptyFieldCount':0,'aliasFieldCount':0,'subtitleIssueCount':0,'versionAudits':[],'summary':''}
    data = content
    try:
        if isinstance(data, str):
            text = data.strip()
            if text.startswith('```'):
                import re
                text = re.sub(r'^```(?:json)?\s*', '', text, flags=re.I)
                text = re.sub(r'\s*```$', '', text)
            data = json.loads(text)
        audit['parsed'] = isinstance(data, dict)
    except Exception as e:
        audit['parseError'] = str(e); audit['missingRoot']=['versions']; audit['summary']='返回内容不是合法 JSON，无法检查字段'; return audit
    if not audit['parsed']:
        audit['parseError']='返回内容不是 JSON 对象'; audit['missingRoot']=['versions']; audit['summary']='返回内容不是 JSON 对象，无法检查字段'; return audit
    audit['rootFields'] = list(data.keys())
    audit['missingRoot'] = [] if 'versions' in data else ['versions']
    audit['extraRoot'] = [k for k in data.keys() if k != 'versions']
    versions = data.get('versions') if isinstance(data.get('versions'), list) else []
    audit['versionCount'] = len(versions)
    for idx, item in enumerate(versions[:24]):
        outer = item if isinstance(item, dict) else {}
        inner = outer.get('block') if isinstance(outer.get('block'), dict) else {}
        effective = dict(outer); effective.update(inner)
        actual_fields = list(dict.fromkeys([k for k in outer.keys() if k != 'block'] + list(inner.keys())))
        missing=[]; empty=[]; aliases=[]
        for field in COPY_EXPECTED_FIELDS:
            if field not in effective:
                missing.append(field)
                for alias in COPY_FIELD_ALIASES.get(field, []):
                    if alias in effective:
                        aliases.append({'expected':field,'actual':alias}); break
            elif _copy_empty(effective.get(field)):
                empty.append(field)
        subtitle_issue=''
        if 'subtitles' in effective:
            subs=effective.get('subtitles')
            if not isinstance(subs, list): subtitle_issue='subtitles 不是数组'
            elif len(subs) != 3: subtitle_issue='subtitles 数量为 %s，应为 3' % len(subs)
            elif any(_copy_empty(x) for x in subs): subtitle_issue='subtitles 包含空值'
        extra=[k for k in actual_fields if k not in COPY_EXPECTED_FIELDS and k != 'block']
        ok=not missing and not empty and not subtitle_issue
        audit['versionAudits'].append({'index':idx+1,'version':effective.get('version',''),'ok':ok,'actualFields':actual_fields,'missing':missing,'empty':empty,'aliases':aliases,'extra':extra,'subtitleIssue':subtitle_issue})
        audit['missingFieldCount'] += len(missing); audit['emptyFieldCount'] += len(empty); audit['aliasFieldCount'] += len(aliases); audit['subtitleIssueCount'] += 1 if subtitle_issue else 0
    count_ok=len(versions)==8
    audit['ok']=audit['parsed'] and not audit['missingRoot'] and count_ok and len(audit['versionAudits'])==8 and all(v['ok'] for v in audit['versionAudits'])
    problems=[]
    if audit['missingRoot']: problems.append('缺少根字段 ' + '、'.join(audit['missingRoot']))
    if not count_ok: problems.append('versions=%s（应为 8）' % len(versions))
    if audit['missingFieldCount']: problems.append('缺失字段 %s 处' % audit['missingFieldCount'])
    if audit['emptyFieldCount']: problems.append('空字段 %s 处' % audit['emptyFieldCount'])
    if audit['subtitleIssueCount']: problems.append('小标题结构异常 %s 处' % audit['subtitleIssueCount'])
    if audit['aliasFieldCount']: problems.append('发现别名字段 %s 处' % audit['aliasFieldCount'])
    audit['summary']='字段完整：8/8 个版本均符合返回契约' if audit['ok'] else '字段监控异常：' + ('；'.join(problems) if problems else '返回结构不符合约定')
    return audit


def probe_proxy(url, target):
    try:
        p = urlparse(url)
        u = urlparse(target)
        target_port = u.port or (80 if u.scheme == 'http' else 443)
        with socket.create_connection((p.hostname, p.port or 80), timeout=1.2) as sock:
            msg = f'CONNECT {u.hostname}:{target_port} HTTP/1.1\r\nHost: {u.hostname}:{target_port}\r\nProxy-Connection: close\r\n\r\n'
            sock.sendall(msg.encode('ascii'))
            sock.settimeout(1.2)
            first = sock.recv(256).decode('latin1', 'ignore').split('\r\n', 1)[0]
            return first.startswith('HTTP/1.1 200') or first.startswith('HTTP/1.0 200')
    except Exception:
        return False


def _target_authority(target):
    try:
        u=urlparse(str(target or ''))
        return '%s:%s'%((u.hostname or 'unknown'), u.port or (80 if u.scheme=='http' else 443))
    except Exception:return str(target or 'unknown')

def _proxy_health_key(target, proxy):return _target_authority(target)+'|'+str(proxy or 'direct')
def _proxy_bad(target, proxy):return float(AUTO_PROXY_BAD_UNTIL.get(_proxy_health_key(target,proxy),0) or 0)>time.monotonic()
def _mark_proxy_bad(target, proxy, ttl=45.0):
    global RESOLVED_PROXY
    if not proxy:return
    AUTO_PROXY_BAD_UNTIL[_proxy_health_key(target,proxy)]=time.monotonic()+max(5.0,float(ttl or 45.0))
    key=_target_authority(target);hit=AUTO_PROXY_CACHE.get(key)
    if hit and hit.get('proxy')==proxy:AUTO_PROXY_CACHE.pop(key,None)
    if RESOLVED_PROXY==proxy:RESOLVED_PROXY=None

def _note_file_route(target,route,ok):
    key=_proxy_health_key(target,route);h=FILE_ROUTE_HEALTH.setdefault(key,{'ok':0,'fail':0,'lastSuccess':0.0,'lastFailure':0.0})
    if ok:h['ok']+=1;h['lastSuccess']=time.monotonic();h['fail']=max(0,h['fail']-1)
    else:h['fail']+=1;h['lastFailure']=time.monotonic()

def _file_route_score(target,route):
    h=FILE_ROUTE_HEALTH.get(_proxy_health_key(target,route),{})
    return float(h.get('ok') or 0)*4-float(h.get('fail') or 0)*7+float(h.get('lastSuccess') or 0)/1e6-float(h.get('lastFailure') or 0)/1e6

def resolve_proxy(target):
    global RESOLVED_PROXY
    if PROXY_SETTING != 'auto':return PROXY_SETTING or None
    authority=_target_authority(target);cached=AUTO_PROXY_CACHE.get(authority)
    if cached and time.monotonic()-float(cached.get('at') or 0)<60 and not _proxy_bad(target,cached.get('proxy')):
        RESOLVED_PROXY=cached.get('proxy');return RESOLVED_PROXY
    for candidate in COMMON_PROXIES:
        if _proxy_bad(target,candidate):continue
        if probe_proxy(candidate,target):
            AUTO_PROXY_CACHE[authority]={'proxy':candidate,'at':time.monotonic()};RESOLVED_PROXY=candidate
            print('[auto-proxy] detected upstream proxy for %s: %s'%(authority,candidate), flush=True)
            return candidate
    return None


def make_opener(target):
    # 本机/局域回环地址必须直连，避免系统代理把本地测试通道送到外部代理。
    try:
        host = (urlparse(target).hostname or '').lower()
    except Exception:
        host = ''
    if host in ('127.0.0.1', 'localhost', '::1'):
        return build_opener(ProxyHandler({}))
    proxy = resolve_proxy(target)
    if proxy:
        return build_opener(ProxyHandler({'http': proxy, 'https': proxy}))
    return build_opener(ProxyHandler({}))



def copy_coze_bots():
    return [x for x in (COPY_COZE.get('bots') or []) if isinstance(x, dict) and x.get('id')]

def copy_coze_bot(bot_id=''):
    bots = copy_coze_bots()
    for item in bots:
        if str(item.get('id')) == str(bot_id):
            return item
    return bots[0] if bots else None

def copy_coze_status():
    bot = copy_coze_bot()
    base = str(COPY_COZE.get('apiBaseUrl') or 'https://api.coze.cn').rstrip('/')
    chat_path = str(COPY_COZE.get('chatPath') or '/v3/chat')
    token_state = copy_coze_token.status_payload(COPY_COZE)
    enabled = COPY_COZE.get('enabled', True) is not False
    configured = bool(enabled and token_state.get('configured') and bot)
    if not enabled:
        message = '扣子文案专用通道已停用'
    elif not bot:
        message = 'copy-coze.private.json 中缺少 Bot ID'
    else:
        message = token_state.get('message') or '请手动输入有效的扣子访问令牌'
    return {'ok': True, 'version': 'V27', 'provider': 'coze', 'isolated': True, 'configured': configured, 'tokenLoaded': bool(token_state.get('tokenLoaded')), 'tokenSource': token_state.get('tokenSource'), 'tokenSourceLabel': token_state.get('tokenSourceLabel'), 'secureStorage': token_state.get('secureStorage'), 'manualTokenInput': True, 'endpoint': base + chat_path, 'docsUrl': COPY_COZE.get('docsUrl') or 'https://docs.coze.cn/', 'selectedModel': str(bot.get('id')) if bot else '', 'models': [{'id': str(x.get('id')), 'label': str(x.get('label') or '扣子文案智能体'), 'description': str(x.get('description') or '')} for x in copy_coze_bots()], 'message': message}

def _coze_error_text(data, fallback='扣子对话失败'):
    if isinstance(data, dict):
        last = data.get('last_error') if isinstance(data.get('last_error'), dict) else {}
        err = data.get('error') if isinstance(data.get('error'), dict) else {}
        return str(data.get('msg') or data.get('message') or err.get('message') or last.get('msg') or last.get('message') or fallback)
    return str(data or fallback)

def _answer_score(text):
    value = str(text or '').strip()
    score = len(value)
    if '"versions"' in value:
        score += 1000000
    if value.startswith(('{', '[')):
        score += 10000
    return score

def _select_best_answer(values):
    unique = []
    seen = set()
    for value in values or []:
        text = str(value or '').strip()
        if not text or text in seen:
            continue
        seen.add(text)
        unique.append(text)
    unique.sort(key=_answer_score, reverse=True)
    return unique[0] if unique else ''

def _parse_sse_frames(text):
    lines = str(text or '').lstrip('\ufeff').replace('\r\n', '\n').replace('\r', '\n').split('\n')
    frames = []
    event = ''
    data_lines = []
    event_id = ''
    def flush():
        nonlocal event, data_lines, event_id
        if not event and not data_lines and not event_id:
            return
        raw_data = '\n'.join(data_lines).strip()
        try:
            data = json.loads(raw_data) if raw_data and raw_data != '[DONE]' else raw_data
        except Exception:
            data = raw_data
        frames.append({'event': event.strip(), 'data': data, 'rawData': raw_data, 'id': event_id})
        event, data_lines, event_id = '', [], ''
    for raw_line in lines:
        line = str(raw_line or '')
        if not line.strip():
            flush()
            continue
        if line.startswith(':'):
            continue
        if line.startswith('event:'):
            if event or data_lines:
                flush()
            event = line[6:].strip()
        elif line.startswith('data:'):
            data_lines.append(line[5:].lstrip(' '))
        elif line.startswith('id:'):
            event_id = line[3:].strip()
        elif line.lstrip().startswith(('{', '[')) and not data_lines:
            data_lines.append(line.strip())
    flush()
    return frames

def _collect_ids(data, state):
    if not isinstance(data, dict):
        return
    root = data.get('data') if isinstance(data.get('data'), dict) else data
    if root.get('conversation_id') and not state.get('conversationId'):
        state['conversationId'] = str(root.get('conversation_id'))
    if (root.get('chat_id') or root.get('id')) and not state.get('chatId'):
        state['chatId'] = str(root.get('chat_id') or root.get('id'))
    if root.get('status'):
        state['status'] = str(root.get('status'))
    detail = root.get('detail') if isinstance(root.get('detail'), dict) else data.get('detail') if isinstance(data.get('detail'), dict) else {}
    if detail.get('logid'):
        state['logId'] = str(detail.get('logid'))

def _collect_answers(value, answers, depth=0):
    if depth > 7 or value is None:
        return
    if isinstance(value, list):
        for item in value:
            _collect_answers(item, answers, depth + 1)
        return
    if not isinstance(value, dict):
        return
    role = str(value.get('role') or '').lower()
    msg_type = str(value.get('type') or '').lower()
    content = value.get('content')
    if (not role or role == 'assistant') and (not msg_type or msg_type == 'answer') and isinstance(content, str) and content.strip():
        answers.append(content)
    for key in ('answer', 'reply', 'output', 'output_text', 'text'):
        if isinstance(value.get(key), str) and value.get(key).strip():
            answers.append(value.get(key))
    for key in ('data', 'result', 'messages', 'message', 'items', 'outputs'):
        if value.get(key) is not None:
            _collect_answers(value.get(key), answers, depth + 1)

def parse_coze_payload(text):
    raw = str(text or '').lstrip('\ufeff').strip()
    state = {'conversationId': '', 'chatId': '', 'status': '', 'logId': ''}
    json_answer = ''
    if raw.startswith(('{', '[')):
        try:
            envelope = json.loads(raw)
            if isinstance(envelope, dict) and int(envelope.get('code') or 0) != 0:
                err = RuntimeError(_coze_error_text(envelope, '扣子接口返回业务错误'))
                setattr(err, 'coze_code', envelope.get('code'))
                raise err
            _collect_ids(envelope, state)
            answers = []
            _collect_answers(envelope, answers)
            json_answer = _select_best_answer(answers)
            if json_answer:
                return dict(state, answer=json_answer, events=[], eventNames=[], rawKind='json')
        except RuntimeError:
            raise
        except Exception:
            pass
    frames = _parse_sse_frames(raw)
    completed = []
    deltas = {}
    loose = []
    event_names = []
    for frame in frames:
        event = str(frame.get('event') or '')
        if event and event not in event_names:
            event_names.append(event)
        data = frame.get('data')
        _collect_ids(data, state)
        if event in ('conversation.chat.failed', 'error'):
            err = RuntimeError(_coze_error_text(data, frame.get('rawData') or '扣子对话失败'))
            if isinstance(data, dict):
                setattr(err, 'coze_code', data.get('code'))
            raise err
        if isinstance(data, dict):
            if int(data.get('code') or 0) != 0 and not data.get('role') and not data.get('type'):
                err = RuntimeError(_coze_error_text(data, '扣子接口返回业务错误'))
                setattr(err, 'coze_code', data.get('code'))
                raise err
            role = str(data.get('role') or '').lower()
            msg_type = str(data.get('type') or '').lower()
            if (not role or role == 'assistant') and msg_type == 'answer' and data.get('content'):
                content = str(data.get('content'))
                if event == 'conversation.message.delta':
                    key = str(data.get('id') or data.get('message_id') or 'default')
                    deltas[key] = deltas.get(key, '') + content
                elif event == 'conversation.message.completed' or not event:
                    completed.append(content)
            _collect_answers(data, loose)
    answer = _select_best_answer(completed if completed else list(deltas.values()) + loose + ([json_answer] if json_answer else []))
    return dict(state, answer=answer, events=frames, eventNames=event_names, rawKind='sse' if frames else 'unknown')

def _coze_json(text, label):
    try:
        data = json.loads(str(text or '').strip() or '{}')
    except Exception:
        err = RuntimeError((label or '扣子响应') + '不是合法 JSON')
        setattr(err, 'status', 502)
        raise err
    if isinstance(data, dict) and int(data.get('code') or 0) != 0:
        err = RuntimeError(_coze_error_text(data, (label or '扣子接口') + '返回业务错误'))
        setattr(err, 'status', 400)
        setattr(err, 'coze_code', data.get('code'))
        raise err
    return data

def recover_coze_answer(base, token, parsed, timeout_ms):
    conversation_id = parsed.get('conversationId')
    chat_id = parsed.get('chatId')
    if not conversation_id or not chat_id:
        return None
    deadline = time.monotonic() + max(5, min(float(timeout_ms or 180000) / 1000.0, 180))
    detail = None
    query = urlencode({'conversation_id': conversation_id, 'chat_id': chat_id})
    while time.monotonic() < deadline:
        status, headers, data = request_external('GET', base + '/v3/chat/retrieve?' + query, token, None, 'application/json', 'application/json')
        text = data.decode('utf-8', 'ignore')
        if not (200 <= status < 300):
            err = RuntimeError('扣子对话状态查询 HTTP %s：%s' % (status, text[:300]))
            setattr(err, 'status', status)
            raise err
        detail = _coze_json(text, '扣子对话状态')
        chat = detail.get('data') if isinstance(detail, dict) and isinstance(detail.get('data'), dict) else {}
        current = str(chat.get('status') or '')
        if current == 'completed':
            break
        if current == 'failed':
            last = chat.get('last_error') if isinstance(chat.get('last_error'), dict) else {}
            raise RuntimeError(str(last.get('msg') or last.get('message') or '扣子对话执行失败'))
        if current == 'requires_action':
            raise RuntimeError('扣子 Bot 返回 requires_action，当前文案通道不支持需要人工提交工具结果的对话')
        if current == 'canceled':
            raise RuntimeError('扣子对话已取消')
        time.sleep(1)
    final_status = str(((detail or {}).get('data') or {}).get('status') or '') if isinstance(detail, dict) else ''
    if final_status != 'completed':
        raise RuntimeError('扣子对话状态轮询超时，最后状态：' + (final_status or 'unknown'))
    status, headers, data = request_external('GET', base + '/v3/chat/message/list?' + query, token, None, 'application/json', 'application/json')
    text = data.decode('utf-8', 'ignore')
    if not (200 <= status < 300):
        err = RuntimeError('扣子消息详情查询 HTTP %s：%s' % (status, text[:300]))
        setattr(err, 'status', status)
        raise err
    payload = _coze_json(text, '扣子消息详情')
    items = payload.get('data') if isinstance(payload, dict) and isinstance(payload.get('data'), list) else []
    answers = [str(x.get('content')) for x in items if isinstance(x, dict) and str(x.get('role') or '').lower() == 'assistant' and str(x.get('type') or '').lower() == 'answer' and x.get('content')]
    answer = _select_best_answer(answers)
    return {'answer': answer, 'transport': 'message-list', 'eventCount': len(parsed.get('events') or []), 'chatId': chat_id, 'conversationId': conversation_id} if answer else None

def _coze_auth_failure(status, code):
    try: return int(code or 0) in (4100, 4101) or int(status or 0) in (401, 403)
    except Exception: return False


def _decorate_coze_error(exc, status=0, code='', request_id='', log_id='', upstream_message=''):
    auth = _coze_auth_failure(status, code)
    setattr(exc, 'status', 401 if auth else (int(status) if 400 <= int(status or 0) < 600 else 502))
    setattr(exc, 'coze_code', code or getattr(exc, 'coze_code', '') or '')
    setattr(exc, 'request_id', request_id or getattr(exc, 'request_id', '') or '')
    setattr(exc, 'log_id', log_id or getattr(exc, 'log_id', '') or '')
    setattr(exc, 'error_type', 'auth_failed' if auth else (getattr(exc, 'error_type', '') or 'upstream_error'))
    setattr(exc, 'upstream_status', int(status or 0))
    if auth:
        number = int(code or 0)
        suffix = f'（错误码 {code}）' if code else ''
        if number == 4100:
            exc.args = (f'扣子拒绝了当前访问令牌{suffix}：个人访问令牌不正确、已过期、被撤销或复制不完整。请重新生成令牌并在 V27 中手动粘贴。',)
        elif number == 4101:
            exc.args = (f'扣子拒绝访问当前 Bot/工作空间{suffix}：令牌没有该资源权限，或未包含 chat 权限。请重新配置令牌权限与可访问空间后再手动粘贴。',)
        else:
            exc.args = (f'扣子拒绝了当前访问令牌{suffix}。请检查令牌有效期、权限、可访问工作空间和 Bot 归属后重试。',)
    elif upstream_message and not str(exc):
        exc.args = (str(upstream_message),)
    return exc


def _parse_coze_http_error(status, text, headers, token):
    data = {}; message = str(text or '')[:600]; code = ''; log_id = ''
    try:
        data = json.loads(str(text or '') or '{}')
        message = _coze_error_text(data, message)
        code = data.get('code') or ((data.get('error') or {}).get('code') if isinstance(data.get('error'), dict) else '') or ''
        log_id = ((data.get('detail') or {}).get('logid') if isinstance(data.get('detail'), dict) else '') or data.get('log_id') or ''
    except Exception:
        pass
    if token and message:
        message = str(message).replace(str(token), '[令牌已隐藏]')
    header_lc = {str(k).lower(): v for k, v in (headers or {}).items()}
    request_id = str(header_lc.get('x-request-id') or header_lc.get('request-id') or header_lc.get('x-tt-logid') or '')
    return _decorate_coze_error(RuntimeError(message or f'扣子 API HTTP {status}'), status, code, request_id, log_id, message)


def call_copy_coze(bot_id, user_prompt):
    st = copy_coze_status()
    if not st.get('configured'):
        exc = RuntimeError(st.get('message') or '扣子文案通道未配置')
        setattr(exc, 'status', 401)
        setattr(exc, 'error_type', 'token_not_configured')
        raise exc
    bot = copy_coze_bot(bot_id)
    if not bot:
        exc = RuntimeError('选择的扣子 Bot 不在允许列表中')
        setattr(exc, 'status', 400)
        raise exc
    base = str(COPY_COZE.get('apiBaseUrl') or 'https://api.coze.cn').rstrip('/')
    target = base + str(COPY_COZE.get('chatPath') or '/v3/chat')
    token, token_source = copy_coze_token.get_token(COPY_COZE)
    payload = {'bot_id': str(bot.get('id')), 'user_id': str(COPY_COZE.get('userIdPrefix') or 'turing-copy-current') + '-' + format(int(time.time()*1000), 'x'), 'stream': True, 'auto_save_history': True, 'additional_messages': [{'role': 'user', 'content': str(user_prompt or ''), 'content_type': 'text'}]}
    raw = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    status, headers, data = request_external('POST', target, token, raw, 'application/json', 'text/event-stream, application/json')
    text = data.decode('utf-8', 'ignore')
    header_lc = {str(k).lower(): v for k, v in (headers or {}).items()}
    request_id = str(header_lc.get('x-request-id') or header_lc.get('request-id') or header_lc.get('x-tt-logid') or '')
    if not (200 <= status < 300):
        raise _parse_coze_http_error(status, text, headers, token)
    try:
        parsed = parse_coze_payload(text)
    except Exception as err:
        _decorate_coze_error(err, getattr(err, 'status', 502) or 502, getattr(err, 'coze_code', ''), getattr(err, 'request_id', '') or request_id, getattr(err, 'log_id', ''))
        raise
    if parsed.get('answer'):
        return {'status': status, 'reply': parsed.get('answer'), 'bot': bot, 'eventCount': len(parsed.get('events') or []), 'transport': parsed.get('rawKind') or 'sse', 'chatId': parsed.get('chatId') or '', 'conversationId': parsed.get('conversationId') or '', 'requestId': request_id, 'logId': parsed.get('logId') or ''}
    try:
        recovered = recover_coze_answer(base, token, parsed, COPY_COZE.get('timeoutMs'))
        if recovered and recovered.get('answer'):
            return {'status': status, 'reply': recovered.get('answer'), 'bot': bot, 'eventCount': recovered.get('eventCount') or 0, 'transport': recovered.get('transport'), 'chatId': recovered.get('chatId') or '', 'conversationId': recovered.get('conversationId') or '', 'requestId': request_id, 'logId': parsed.get('logId') or ''}
    except Exception as recover_err:
        names = ', '.join(parsed.get('eventNames') or []) or '无'
        err = RuntimeError('扣子已返回响应，但未解析到 answer；恢复查询也失败：%s。事件：%s' % (recover_err, names))
        setattr(err, 'status', getattr(recover_err, 'status', 502))
        setattr(err, 'request_id', request_id)
        raise err
    names = ', '.join(parsed.get('eventNames') or []) or '无'
    err = RuntimeError('扣子已返回响应，但没有可用的 answer 消息。事件：' + names)
    setattr(err, 'status', 502)
    setattr(err, 'request_id', request_id)
    raise err

def coze_error_payload(exc):
    return {
        'message': str(exc),
        'code': getattr(exc, 'coze_code', '') or '',
        'type': getattr(exc, 'error_type', '') or '',
        'upstreamStatus': getattr(exc, 'upstream_status', 0) or 0,
        'requestId': getattr(exc, 'request_id', '') or '',
        'logId': getattr(exc, 'log_id', '') or '',
    }

def copy_prompt(product_info, json_prompt):
    schema = json_prompt or '请返回包含 versions 数组的合法 JSON，共 8 个版本。'
    return schema + '\n\n【当前产品信息】\n' + str(product_info or '').strip() + '\n\n再次强调：只输出一个合法 JSON 对象，不要 Markdown 代码围栏，不要解释。versions 必须恰好 8 项。'

TRANSIENT_NETWORK_RE = re.compile(r'(socket hang up|ECONNRESET|ECONNABORTED|ETIMEDOUT|ESOCKETTIMEDOUT|EPIPE|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND|Temporary failure in name resolution|Client network socket disconnected before secure TLS connection was established|before secure TLS connection was established|socket disconnected|TLS.*(?:handshake|closed|reset|socket|alert)|SSL routines|ERR_TLS|premature close|connection reset|remote host closed|connection aborted|timed out)', re.I)
RETRYABLE_HTTP = {408,425,429,500,502,503,504}

def classify_network_error(exc):
    msg=str(exc or '')
    reason=getattr(exc,'reason',None)
    code=str(getattr(exc,'errno','') or getattr(reason,'errno','') or '')
    text=(code+' '+msg+' '+str(reason or '')).strip()
    kind='network_error'
    if re.search(r'before secure TLS connection was established|Client network socket disconnected before secure TLS|TLS.*handshake|SSL routines|ERR_TLS',text,re.I):kind='tls_handshake'
    elif re.search(r'ECONNRESET|socket hang up|socket disconnected|connection reset|premature close|remote host closed',text,re.I):kind='connection_reset'
    elif re.search(r'ETIMEDOUT|timed out|timeout|超时',text,re.I):kind='timeout'
    elif re.search(r'ENOTFOUND|EAI_AGAIN|getaddrinfo|Temporary failure in name resolution|DNS',text,re.I):kind='dns'
    elif re.search(r'ECONNREFUSED',text,re.I):kind='connection_refused'
    elif re.search(r'EPIPE',text,re.I):kind='broken_pipe'
    elif re.search(r'ENETUNREACH|EHOSTUNREACH',text,re.I):kind='network_unreachable'
    return {'kind':kind,'code':code,'message':msg,'transient':bool(TRANSIENT_NETWORK_RE.search(text))}

def decode_image_data_url(value):
    raw=str(value or '').strip()
    m=re.match(r'^data:image/(jpeg|jpg|png|gif|webp);(?:charset=[^;,]+;)?base64,([\s\S]+)$',raw,re.I)
    if not m:raise ValueError('参考图不是可识别的 JPEG/PNG/GIF/WebP Data URL')
    subtype=m.group(1).lower();mime='image/jpeg' if subtype=='jpg' else 'image/'+subtype
    try:data=base64.b64decode(re.sub(r'\s+','',m.group(2)),validate=False)
    except Exception as e:raise ValueError('参考图 Base64 解码失败：'+str(e))
    if not data:raise ValueError('参考图 Base64 内容为空')
    ext={'image/jpeg':'.jpg','image/png':'.png','image/gif':'.gif','image/webp':'.webp'}.get(mime,'.bin')
    return data,mime,'reference'+ext

def build_multipart_file(data,mime,filename):
    boundary='----AIStudioV2623'+str(int(time.time()*1000))+str(threading.get_ident())
    safe=re.sub(r'[^a-zA-Z0-9._-]+','-',str(filename or 'reference'))[:90] or 'reference'
    head=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{safe}"\r\nContent-Type: {mime or "application/octet-stream"}\r\n\r\n').encode('utf-8')
    tail=(f'\r\n--{boundary}--\r\n').encode('utf-8')
    return head+data+tail, 'multipart/form-data; boundary='+boundary

def opener_for_route(target,route):
    if route=='direct':return build_opener(ProxyHandler({}))
    if route and route.startswith('http://'):return build_opener(ProxyHandler({'http':route,'https':route}))
    return make_opener(target)

def request_external_on_route(method,target,key,body=None,content_type=None,accept_header=None,timeout_ms=None,route=None):
    req=Request(target,data=body,method=method)
    if key:req.add_header('Authorization','Bearer '+key)
    req.add_header('Accept',accept_header or 'application/json');req.add_header('Accept-Encoding','identity');req.add_header('Connection','keep-alive')
    if content_type:req.add_header('Content-Type',content_type)
    elif body is not None:req.add_header('Content-Type','application/json')
    opener=opener_for_route(target,route) if route else make_opener(target)
    try:
        with opener.open(req,timeout=max(1,float(timeout_ms or REQUEST_TIMEOUT_MS)/1000.0)) as r:return r.status,dict(r.headers.items()),r.read()
    except HTTPError as e:return e.code,dict(e.headers.items()),e.read()

def request_external(method, target, key, body=None, content_type=None, accept_header=None, timeout_ms=None):
    return request_external_on_route(method,target,key,body,content_type,accept_header,timeout_ms,None)

def _safe_preconnect_failure(exc):
    text=str(exc or '')+' '+str(getattr(exc,'reason','') or '')
    return bool(re.search(r'before secure TLS connection was established|Client network socket disconnected before secure TLS|TLS.*handshake|SSL routines|ERR_TLS|ECONNREFUSED|ENETUNREACH|EHOSTUNREACH|ENOTFOUND|EAI_AGAIN|getaddrinfo',text,re.I))

def _micro_route_key(target,route):return 'micro|'+_proxy_health_key(target,route)
def _note_micro_route(target,route,ok):
    key=_micro_route_key(target,route);now=time.monotonic();h=MICRO_ROUTE_HEALTH.setdefault(key,{'ok':0.0,'fail':0.0,'consecutiveFailures':0,'lastSuccess':0.0,'lastFailure':0.0})
    h['ok']=min(12.0,float(h.get('ok') or 0)*.72+(1.0 if ok else 0.0));h['fail']=min(12.0,float(h.get('fail') or 0)*.72+(0.0 if ok else 1.0))
    if ok:h['lastSuccess']=now;h['consecutiveFailures']=0
    else:h['lastFailure']=now;h['consecutiveFailures']=min(6,int(h.get('consecutiveFailures') or 0)+1)
    return h

def _micro_route_score(target,route):
    h=MICRO_ROUTE_HEALTH.get(_micro_route_key(target,route),{});now=time.monotonic()
    sf=max(0.0,1.0-(now-float(h.get('lastSuccess') or 0))/120.0) if h.get('lastSuccess') else 0.0
    ff=max(0.0,1.0-(now-float(h.get('lastFailure') or 0))/120.0) if h.get('lastFailure') else 0.0
    return float(h.get('ok') or 0)*4-float(h.get('fail') or 0)*8-int(h.get('consecutiveFailures') or 0)*18+sf*5-ff*10

def _micro_routes(target):
    routes=[]
    if PROXY_SETTING=='auto':
        proxy=resolve_proxy(target)
        if proxy and not _proxy_bad(target,proxy):routes.append(proxy)
        routes.append('direct')
    elif PROXY_SETTING:routes.append(PROXY_SETTING)
    else:routes.append('direct')
    unique=[]
    for route in routes:
        if route not in unique:unique.append(route)
    unique.sort(key=lambda route:_micro_route_score(target,route),reverse=True)
    return unique

def request_micro_external(method,target,key,body=None,content_type=None,accept_header=None,timeout_ms=None):
    routes=_micro_routes(target);trace=[];last_exc=None;last_response=None;is_write=str(method or 'GET').upper() not in ('GET','HEAD','OPTIONS')
    for idx,route in enumerate(routes):
        started=time.monotonic()
        try:
            status,headers,data=request_external_on_route(method,target,key,body,content_type,accept_header,timeout_ms,route);last_response=(status,headers,data)
            _note_micro_route(target,route,200<=status<400);trace.append({'route':route,'status':status,'durationMs':int((time.monotonic()-started)*1000),'error':''})
            return status,headers,data
        except Exception as exc:
            last_exc=exc;health=_note_micro_route(target,route,False);info=classify_network_error(exc);preconnect=_safe_preconnect_failure(exc);quarantined_ms=0
            if route!='direct' and info['transient'] and PROXY_SETTING=='auto':quarantined_ms=90000;_mark_proxy_bad(target,route,90.0)
            trace.append({'route':route,'status':0,'durationMs':int((time.monotonic()-started)*1000),'error':info['message'],'kind':info['kind'],'code':info['code'],'preconnect':preconnect,'quarantinedMs':quarantined_ms,'consecutiveFailures':int(health.get('consecutiveFailures') or 0)})
            if is_write and not preconnect:setattr(exc,'network_trace',trace);raise
            if idx==len(routes)-1:setattr(exc,'network_trace',trace);raise
    if last_exc:raise last_exc
    return last_response

def outbound_primary_route(target):
    if PROXY_SETTING=='auto':
        proxy=resolve_proxy(target);return proxy or 'direct'
    return PROXY_SETTING or 'direct'

def _file_upload_routes(target):
    routes=[]
    if PROXY_SETTING=='auto':
        proxy=resolve_proxy(target)
        if proxy and not _proxy_bad(target,proxy):routes.append(proxy)
        routes.append('direct')
    elif PROXY_SETTING:routes.append(PROXY_SETTING)
    else:routes.append('direct')
    unique=[]
    for route in routes:
        if route not in unique:unique.append(route)
    unique.sort(key=lambda r:_file_route_score(target,r),reverse=True)
    return unique

def request_file_upload_resilient(target,key,body,content_type,rounds=2,channel='shared',timeout_ms=None):
    routes=_file_upload_routes(target);trace=[];last_response=None;last_exc=None;attempts=max(len(routes),min(8,len(routes)*max(1,int(rounds or 2))));overall=time.monotonic();attempt_timeout=int(timeout_ms or (MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS if channel=='micro' else UPLOAD_ATTEMPT_TIMEOUT_MS))
    for idx in range(attempts):
        if (time.monotonic()-overall)*1000 >= UPLOAD_TIMEOUT_MS:break
        route=routes[idx%len(routes)];started=time.time()
        try:
            status,headers,data=request_external_on_route('POST',target,key,body,content_type,'application/json',attempt_timeout,route)
            retryable=status in RETRYABLE_HTTP;_note_file_route(target,route,200<=status<400)
            trace.append({'attempt':idx+1,'route':route,'status':status,'durationMs':int((time.time()-started)*1000),'retryable':retryable})
            last_response=(status,headers,data,idx+1,route,trace)
            if not retryable:return last_response
        except Exception as exc:
            last_exc=exc;info=classify_network_error(exc);_note_file_route(target,route,False)
            if route!='direct' and info['transient'] and PROXY_SETTING=='auto':_mark_proxy_bad(target,route)
            trace.append({'attempt':idx+1,'route':route,'status':0,'durationMs':int((time.time()-started)*1000),'retryable':info['transient'],'error':info['message'],'kind':info['kind'],'code':info['code']})
            if not info['transient']:
                setattr(exc,'network_trace',trace);raise
        if idx+1<attempts:
            delay=UPLOAD_RETRY_DELAYS_MS[min(idx,len(UPLOAD_RETRY_DELAYS_MS)-1)] if UPLOAD_RETRY_DELAYS_MS else 800
            if delay:time.sleep(delay/1000.0)
    if last_response:return last_response
    if last_exc:setattr(last_exc,'network_trace',trace);raise last_exc
    return 599,{},b'upload failed',len(trace),'unknown',trace

def _reference_cache_id(raw,key,channel='shared'):return hashlib.sha256(raw+b'|'+hashlib.sha256(str(key or '').encode()).hexdigest()[:16].encode()+b'|'+str(channel or 'shared').encode()).hexdigest()
def _parse_file_upload(status,raw):
    try:parsed=json.loads(raw.decode('utf-8','ignore') or '{}')
    except Exception:parsed={}
    data=parsed.get('data') if isinstance(parsed,dict) and isinstance(parsed.get('data'),dict) else {}
    url=str(data.get('file_url') or data.get('fileUrl') or (parsed.get('file_url') if isinstance(parsed,dict) else '') or '').strip()
    return {'status':int(status or 0),'parsed':parsed,'data':data,'url':url,'downloadUrl':str(data.get('download_url') or data.get('downloadUrl') or ''),'expiresAt':str(data.get('expires_at') or data.get('expiresAt') or ''),'success':200<=int(status or 0)<300 and bool(url)}

def _should_protocol_fallback(value):
    if isinstance(value,Exception):return True
    status=int((value or {}).get('status') or 0) if isinstance(value,dict) else int(value or 0)
    return status==0 or status in {408,425,500,502,503,504}

def _reference_cache_get(cache_id):
    hit=_collection_get(V26_EVOLINK_REFERENCE_CACHE_FILE,cache_id)
    if not hit:return None
    try:valid=float(hit.get('cacheUntilEpoch') or 0)>time.time()
    except Exception:valid=False
    if not valid:_collection_remove(V26_EVOLINK_REFERENCE_CACHE_FILE,cache_id);return None
    return hit

def _reference_cache_save(cache_id,parsed,transport,route,raw,mime):
    ttl_hours=max(1,min(48,float(NETWORK_CFG.get('referenceCacheTtlHours') or 12)))
    return _collection_upsert(V26_EVOLINK_REFERENCE_CACHE_FILE,{'id':cache_id,'url':parsed.get('url'),'downloadUrl':parsed.get('downloadUrl') or '','upstreamExpiresAt':parsed.get('expiresAt') or '','cacheUntilEpoch':time.time()+ttl_hours*3600,'transport':transport,'route':route,'bytes':len(raw),'mime':mime},500)

def request_reference_upload_robust(raw,mime,filename,key,skip_cache=False,channel='shared'):
    cache_id=_reference_cache_id(raw,key,channel)
    if not skip_cache:
        hit=_reference_cache_get(cache_id)
        if hit and hit.get('url'):
            body=json.dumps({'success':True,'code':200,'msg':'参考图命中本地上传缓存','data':{'file_url':hit.get('url'),'download_url':hit.get('downloadUrl') or '','expires_at':hit.get('upstreamExpiresAt') or ''},'local':{'cacheHit':True,'transport':hit.get('transport') or 'cache','route':hit.get('route') or 'cache'}},ensure_ascii=False).encode()
            return {'status':200,'headers':{'content-type':'application/json'},'raw':body,'attempts':0,'route':'cache','transport':'cache','cacheHit':True,'fallbackUsed':False,'trace':[],'parsed':_parse_file_upload(200,body)}
    mp,ct=build_multipart_file(raw,mime,filename);stream=None;stream_exc=None;fast_micro=channel=='micro';upload_rounds=1 if fast_micro else 2;upload_timeout=MICRO_UPLOAD_ATTEMPT_TIMEOUT_MS if fast_micro else UPLOAD_ATTEMPT_TIMEOUT_MS
    try:
        st,hd,data,attempts,route,trace=request_file_upload_resilient(EVOLINK_FILES_BASE+'/api/v1/files/upload/stream',key,mp,ct,upload_rounds,channel,upload_timeout);parsed=_parse_file_upload(st,data);stream={'status':st,'headers':hd,'raw':data,'attempts':attempts,'route':route,'transport':'stream','cacheHit':False,'fallbackUsed':False,'trace':trace,'parsed':parsed}
        if parsed['success']:_reference_cache_save(cache_id,parsed,'stream',route,raw,mime);return stream
        if not _should_protocol_fallback({'status':st}):return stream
    except Exception as exc:
        stream_exc=exc
    payload=json.dumps({'base64_data':'data:%s;base64,%s'%(mime,base64.b64encode(raw).decode('ascii'))},ensure_ascii=False).encode()
    try:
        st,hd,data,attempts,route,trace=request_file_upload_resilient(EVOLINK_FILES_BASE+'/api/v1/files/upload/base64',key,payload,'application/json',upload_rounds,channel,upload_timeout);parsed=_parse_file_upload(st,data);combined=list((stream or {}).get('trace') or getattr(stream_exc,'network_trace',[]) or [])+list(trace or []);out={'status':st,'headers':hd,'raw':data,'attempts':attempts,'route':route,'transport':'base64-fallback','cacheHit':False,'fallbackUsed':True,'trace':combined,'parsed':parsed}
        if parsed['success']:_reference_cache_save(cache_id,parsed,'base64-fallback',route,raw,mime)
        return out
    except Exception as exc:
        setattr(exc,'network_trace',list((stream or {}).get('trace') or getattr(stream_exc,'network_trace',[]) or [])+list(getattr(exc,'network_trace',[]) or []));raise


def network_diagnosis_payload(exc):
    info=classify_network_error(exc);return {'code':info['kind'],'message':info['message'],'retryable':info['transient'],'proxySetting':PROXY_SETTING or 'direct','resolvedProxy':RESOLVED_PROXY,'requestTimeoutMs':REQUEST_TIMEOUT_MS,'uploadTimeoutMs':UPLOAD_TIMEOUT_MS,'uploadAttemptTimeoutMs':UPLOAD_ATTEMPT_TIMEOUT_MS}

def run_network_diagnostics(key,deep=False,micro_channel=True):
    out={'ok':True,'warning':False,'version':APP_VERSION,'proxySetting':PROXY_SETTING or 'direct','resolvedProxy':RESOLVED_PROXY,'requestTimeoutMs':REQUEST_TIMEOUT_MS,'uploadTimeoutMs':UPLOAD_TIMEOUT_MS,'authoritative':'EvoLink API /models + 文件服务 + 参考图上传','steps':[],'warnings':[]}
    def add(name,ok,message,required=True,**extra):
        # message is a first-class field; do not allow a diagnostic payload to
        # overwrite it (or raise a duplicate-key TypeError at runtime).
        extra.pop('message',None)
        item={'name':name,'ok':bool(ok),'required':bool(required),'severity':('ok' if ok else ('error' if required else 'warning')),'message':message};item.update(extra);out['steps'].append(item)
        if not ok and required:out['ok']=False
        if not ok and not required:out['warning']=True;out['warnings'].append(name+'：'+message)
    def diagnosis_extra(exc):
        details=dict(network_diagnosis_payload(exc) or {})
        details.pop('message',None)
        return details
    try:
        st,hd,raw=request_external_on_route('GET','https://echo.apifox.com/get','',None,None,'application/json',DIAGNOSTIC_TIMEOUT_MS,'direct');add('公网直连 / Apifox Echo（辅助探针）',st==200,'HTTP %s，直连公网%s'%(st,'正常' if st==200 else '异常'),False,status=st,route='direct',advisory=True)
    except Exception as e:
        d=network_diagnosis_payload(e);add('公网直连 / Apifox Echo（辅助探针）',False,d.get('message') or str(e),False,status=0,route='direct',advisory=True,**diagnosis_extra(e))
    try:
        route=outbound_primary_route('https://echo.apifox.com/get');st,hd,raw=request_external_on_route('GET','https://echo.apifox.com/get','',None,None,'application/json',DIAGNOSTIC_TIMEOUT_MS,route);add('当前代理路径 / Apifox Echo（辅助探针）',st==200,'HTTP %s，%s'%(st,route),False,status=st,route=route,advisory=True)
    except Exception as e:
        d=network_diagnosis_payload(e);add('当前代理路径 / Apifox Echo（辅助探针）',False,(d.get('message') or str(e))+'。该结果仅代表 Apifox 控制站点，不代表 EvoLink 不可用。',False,status=0,advisory=True,**diagnosis_extra(e))
    requester=request_micro_external if micro_channel else request_external
    try:
        st,hd,raw=requester('GET',EVOLINK_BASE+'/models',key,None,'application/json','application/json',DIAGNOSTIC_TIMEOUT_MS);add('EvoLink 生图 API /models（权威）',200<=st<300,'HTTP %s，实际 EvoLink 生图 API 路径%s'%(st,'正常' if 200<=st<300 else '异常'),True,status=st,authoritative=True)
    except Exception as e:
        d=network_diagnosis_payload(e);add('EvoLink 生图 API /models（权威）',False,d.get('message') or str(e),True,status=0,trace=getattr(e,'network_trace',[]),authoritative=True,**diagnosis_extra(e))
    try:
        st,hd,raw=requester('GET',EVOLINK_FILES_BASE+'/api/v1/files/quota',key,None,'application/json','application/json',DIAGNOSTIC_TIMEOUT_MS);add('EvoLink 文件服务 GET（权威）',200<=st<300,'HTTP %s，文件服务基础连接%s'%(st,'正常' if 200<=st<300 else '异常'),True,status=st,authoritative=True)
    except Exception as e:
        d=network_diagnosis_payload(e);add('EvoLink 文件服务 GET（权威）',False,d.get('message') or str(e),True,status=0,trace=getattr(e,'network_trace',[]),authoritative=True,**diagnosis_extra(e))
    if deep:
        try:
            png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');r=request_reference_upload_robust(png,'image/png','v276-network-probe.png',key,True,'micro' if micro_channel else 'shared');parsed=r.get('parsed') or {};add('EvoLink 独立参考图通道（1×1 PNG，权威）',bool(parsed.get('success')),'HTTP %s；transport=%s；route=%s；attempts=%s'%(r.get('status'),r.get('transport'),r.get('route'),r.get('attempts')),True,status=r.get('status'),route=r.get('route'),transport=r.get('transport'),attempts=r.get('attempts'),trace=r.get('trace') or [],authoritative=True)
        except Exception as e:
            d=network_diagnosis_payload(e);add('EvoLink 独立参考图通道（1×1 PNG，权威）',False,d.get('message') or str(e),True,status=0,trace=getattr(e,'network_trace',[]),authoritative=True,**diagnosis_extra(e))
        try:
            sample=os.path.join(ROOT,'assets','wolassen','02.jpg');raw=open(sample,'rb').read();r=request_reference_upload_robust(raw,'image/jpeg','v276-real-reference-probe.jpg',key,True,'micro' if micro_channel else 'shared');parsed=r.get('parsed') or {};add('EvoLink 实际参考图上传（800×800，权威）',bool(parsed.get('success')),'HTTP %s；%sB；transport=%s；route=%s'%(r.get('status'),len(raw),r.get('transport'),r.get('route')),True,status=r.get('status'),route=r.get('route'),transport=r.get('transport'),attempts=r.get('attempts'),trace=r.get('trace') or [],authoritative=True)
        except Exception as e:
            d=network_diagnosis_payload(e);add('EvoLink 实际参考图上传（800×800，权威）',False,d.get('message') or str(e),True,status=0,trace=getattr(e,'network_trace',[]),authoritative=True,**diagnosis_extra(e))
    out['resolvedProxy']=RESOLVED_PROXY
    out['summary']=('权威 EvoLink 路径全部通过，但辅助探针存在警告；不影响当前微调链路。' if out['warning'] else '权威 EvoLink 网络路径全部通过。') if out['ok'] else '至少一项权威 EvoLink 网络路径失败，请按失败项处理。'
    return out



class Handler(SimpleHTTPRequestHandler):
    server_version = 'AI-Tool-V27.9'

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Base-Url, X-API-Key, X-AI-Progress-Stream, X-Channel, X-Micro-Generation-Id, X-Micro-Conflict-Policy, X-Micro-Instruction-Fingerprint, X-Micro-Handoff-Acknowledged')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def map_app_route(self):
        parsed = urlparse(self.path)
        app_routes = {'/','/copy','/wireframe','/image','/users','/audit','/region','/region/files','/region/regions','/region/canvas','/region/adjust','/region/details','/region/quality'}
        if parsed.path in app_routes:
            self.path = '/' + HTML_FILE

    def do_GET(self):
        static_path = urlparse(self.path).path
        if static_path.endswith('/copy-coze.private.json') or '.env' in static_path or '/.' in static_path or static_path.endswith(('.secure', '.dpapi')):
            self.send_error(403)
            return
        if self.path.startswith('/api/'):
            return self.proxy()
        self.map_app_route()
        return super().do_GET()

    def do_HEAD(self):
        static_path = urlparse(self.path).path
        if static_path.endswith('/copy-coze.private.json') or '.env' in static_path or '/.' in static_path or static_path.endswith(('.secure', '.dpapi')):
            self.send_error(403)
            return
        if self.path.startswith('/api/'):
            self.send_error(405)
            return
        self.map_app_route()
        return super().do_HEAD()

    def do_POST(self):
        if self.path.startswith('/api/'):
            return self.proxy()
        self.send_error(404)

    def do_PUT(self):
        if self.path.startswith('/api/'):
            return self.proxy()
        self.send_error(404)

    def do_PATCH(self):
        if self.path.startswith('/api/'):
            return self.proxy()
        self.send_error(404)

    def do_DELETE(self):
        if self.path.startswith('/api/'):
            return self.proxy()
        self.send_error(404)

    def cfg(self):
        base = normalize_evolink_base(self.headers.get('X-Base-Url') or CFG.get('baseUrl') or '')
        key = (self.headers.get('X-API-Key') or CFG.get('apiKey') or '').strip()
        return base, key

    def write_json(self, code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(data)

    def write_raw(self, code, headers, data):
        self.send_response(code)
        self.send_header('Content-Type', headers.get('Content-Type', headers.get('content-type', 'application/json; charset=utf-8')))
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def stream_external(self, method, target, key, body=None, content_type=None):
        req = Request(target, data=body, method=method)
        req.add_header('Authorization', 'Bearer ' + key)
        req.add_header('Accept', 'text/event-stream, application/x-ndjson, application/json')
        if content_type:
            req.add_header('Content-Type', content_type)
        elif body is not None:
            req.add_header('Content-Type', 'application/json')
        opener = make_opener(target)
        response = None
        try:
            response = opener.open(req, timeout=300)
        except HTTPError as e:
            response = e
        self.send_response(getattr(response, 'status', getattr(response, 'code', 500)))
        self.send_header('Content-Type', response.headers.get('Content-Type', 'application/json; charset=utf-8'))
        request_id = response.headers.get('X-Request-Id') or response.headers.get('Request-Id') or response.headers.get('X-Task-Id')
        if request_id:
            self.send_header('X-Upstream-Request-Id', request_id)
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        total = 0
        stream_type = (response.headers.get('Content-Type') or '').lower()
        read_chunk = response.readline if ('text/event-stream' in stream_type or 'ndjson' in stream_type) else getattr(response, 'read1', response.read)
        try:
            while True:
                chunk = read_chunk(4096)
                if not chunk:
                    break
                total += len(chunk)
                self.wfile.write(chunk)
                self.wfile.flush()
        finally:
            try:
                response.close()
            except Exception:
                pass
        return getattr(response, 'status', getattr(response, 'code', 500)), total

    def proxy(self):
        parsed = urlparse(self.path)
        raw_api_path = parsed.path.replace('/api', '', 1)
        micro_channel = raw_api_path == '/micro' or raw_api_path.startswith('/micro/')
        api_path = raw_api_path[6:] if micro_channel else raw_api_path
        if not api_path:
            api_path = '/'
        if api_path == '/health' and self.command == 'GET':
            asset_state = wireframe_asset_status()
            return self.write_json(200, {
                'ok': True,
                'version': APP_VERSION,
                'buildId': BUILD_ID,
                'rootPath': ROOT,
                'assetsReady': asset_state['assetsReady'],
                'missingAssets': asset_state['missing'],
                'proxy': 'python',
                'port': PORT,
                'forceHostIp': FORCE_IP or None,
                'proxyUrl': PROXY_SETTING or None,
                'resolvedProxy': RESOLVED_PROXY,
                'generationChannels': {
                    'copy': {'provider': 'coze', 'isolated': True, 'endpointPrefix': '/api/copy-coze/'},
                    'wireframe': {'provider': 'evolink-image', 'isolatedFromCopy': True, 'endpointPrefix': '/api/'},
                    'image': {'provider': 'evolink-image', 'isolatedFromCopy': True, 'endpointPrefix': '/api/'},
                    'referenceUpload': {'provider': 'evolink-files', 'isolatedFromGeneration': True, 'endpointPrefix': '/api/evolink/files/upload/'},
                    'adjust': {'provider': 'evolink-image-micro-adjust', 'isolatedFromCopy': True, 'isolatedFromSharedImageConfig': True, 'isolatedFromConflictRisk': True, 'conflictRiskMode':'advisory-only', 'channelHeader':'micro-adjust-v27.8', 'instructionRegression':True, 'baseUrl': EVOLINK_BASE, 'defaultModel': 'gemini-3.1-flash-lite-image', 'diagnose': '/api/micro/diagnose', 'deepDiagnose': '/api/micro/network-diagnose?deep=1', 'endpointPrefix':'/api/micro/', 'routeIsolation':True, 'pollSoftTimeoutMs':MICRO_ADJUST_POLL_SOFT_TIMEOUT_MS, 'pollTimeoutMs':MICRO_ADJUST_POLL_TIMEOUT_MS, 'pollMaxTimeoutMs':MICRO_ADJUST_POLL_MAX_TIMEOUT_MS, 'pollGetRetryAttempts':3, 'sameTaskPolling':True, 'proxyTlsRecovery':True, 'diagnosticAdvisoryProbes':True, 'keepAlive':False, 'uploadConcurrency':2, 'adaptivePolling':True, 'fastReferencePlan':True, 'referencePlan':'source+layout-mask-guide+text-fidelity-v280', 'diagnosticCacheMs':300000, 'creditCacheMs':60000, 'fullDiagnosticsOnlyOnTestOrCacheExpiry':True, 'clickToImagePerformance':True, 'taskLifecycle':True, 'directHandoff':True, 'handoffAcknowledgementGate':True, 'handoffAckMode':'synchronous-before-provider', 'handoffAckTimeoutMs':0, 'sequentialRunIsolation':True, 'staleRunRecoveryMs':MICRO_RUN_STALE_MS},
                },
            })
        if api_path == '/wireframe-assets/status' and self.command == 'GET':
            result = wireframe_asset_status()
            code = 200 if result['assetsReady'] else 503
            push_server_log(method='GET', path='/api/wireframe-assets/status', status=code, channel='local assets', message='18 张内置线框素材已就绪' if result['assetsReady'] else '缺少线框素材：' + ', '.join(result['missing']))
            return self.write_json(code, result)
        if api_path == '/config' and self.command == 'GET':
            return self.write_json(200, {
                'baseUrl': CFG.get('baseUrl', ''),
                'keyLoaded': bool(CFG.get('apiKey')),
                'port': PORT,
                'forceHostIp': FORCE_IP or None,
                'proxyUrl': PROXY_SETTING or None,
                'resolvedProxy': RESOLVED_PROXY,
            })
        if api_path == '/logs' and self.command == 'GET':
            return self.write_json(200, {'ok': True, 'version': APP_VERSION, 'logs': SERVER_LOGS[:200]})
        if api_path == '/logs' and self.command == 'DELETE':
            SERVER_LOGS.clear()
            push_server_log(method='DELETE', path='/api/logs', status=200, channel='local', message='后台日志已清空')
            return self.write_json(200, {'ok': True, 'cleared': True})
        if api_path == '/paddleocr-cloud/status' and self.command == 'GET':
            result = paddleocr_cloud_service.status_payload(CFG)
            result['launcher'] = 'python'
            push_server_log(method='GET', path='/api/paddleocr-cloud/status', status=200, channel='cloud paddleocr', message=result.get('message', 'PaddleOCR 云端配置检查'))
            return self.write_json(200, result)
        if api_path == '/paddleocr-cloud/queue-status' and self.command == 'GET':
            request_id = str((parse_qs(parsed.query).get('requestId') or [''])[0]).strip()
            result = paddleocr_cloud_service.submission_queue_status(request_id)
            result['launcher'] = 'python'
            return self.write_json(200, result)
        if api_path == '/paddleocr-cloud/config' and self.command == 'POST':
            length = int(self.headers.get('Content-Length', '0') or '0')
            try:
                payload = json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}')
                result = paddleocr_cloud_service.configure_token(payload if isinstance(payload, dict) else {}, CFG)
                code = 200 if result.get('ok') else 400
                push_server_log(method='POST', path='/api/paddleocr-cloud/config', status=code, channel='cloud paddleocr', message=result.get('message') or (result.get('error') or {}).get('message', 'PaddleOCR 云端令牌配置'))
                return self.write_json(code, result)
            except Exception as e:
                push_server_log(method='POST', path='/api/paddleocr-cloud/config', status=500, channel='cloud paddleocr', message=str(e))
                return self.write_json(500, {'ok': False, 'error': {'code': 'token_config_failed', 'message': '令牌配置失败：' + str(e)}})
        if api_path == '/paddleocr-cloud/recognize' and self.command == 'POST':
            started_at = time.time()
            length = int(self.headers.get('Content-Length', '0') or '0')
            if length > 50 * 1024 * 1024:
                return self.write_json(413, {'ok': False, 'error': {'code': 'payload_too_large', 'message': '识别图片请求超过 50MB'}})
            try:
                body = self.rfile.read(length) if length else b'{}'
                payload = json.loads(body.decode('utf-8') or '{}')
                proxy = resolve_proxy((CFG.get('paddleOcrCloud') or {}).get('jobUrl') or paddleocr_cloud_service.DEFAULT_JOB_URL) or ''
                result = paddleocr_cloud_service.recognize(payload if isinstance(payload, dict) else {}, CFG, proxy)
                err_code = (result.get('error') or {}).get('code')
                code = 200 if result.get('ok') else (401 if err_code in ('token_not_configured','auth_failed') else 400 if err_code == 'invalid_submit_request' else 429 if err_code == 'quota_or_rate_limit' else 503)
                push_server_log(method='POST', path='/api/paddleocr-cloud/recognize', status=code, durationMs=int((time.time()-started_at)*1000), channel='cloud paddleocr', message=result.get('message') or (result.get('error') or {}).get('message', 'PaddleOCR 云端识别完成'))
                return self.write_json(code, result)
            except Exception as e:
                push_server_log(method='POST', path='/api/paddleocr-cloud/recognize', status=500, durationMs=int((time.time()-started_at)*1000), channel='cloud paddleocr', message=str(e))
                return self.write_json(500, {'ok': False, 'error': {'code': 'cloud_ocr_error', 'message': 'PaddleOCR 云端识别失败：' + str(e)}})

        if api_path == '/copy-coze/status' and self.command == 'GET':
            return self.write_json(200, copy_coze_status())
        if api_path == '/copy-coze/config' and self.command == 'POST':
            started_at = time.time()
            length = int(self.headers.get('Content-Length', '0') or '0')
            try:
                payload = json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}')
                result = copy_coze_token.configure_token(payload if isinstance(payload, dict) else {}, COPY_COZE)
                code = 200 if result.get('ok') else 400
                push_server_log(method='POST', path='/api/copy-coze/config', status=code, durationMs=int((time.time()-started_at)*1000), channel='copy/coze token', message=result.get('message') or (result.get('error') or {}).get('message', '扣子令牌配置'))
                return self.write_json(code, result)
            except Exception as e:
                push_server_log(method='POST', path='/api/copy-coze/config', status=500, durationMs=int((time.time()-started_at)*1000), channel='copy/coze token', message=str(e))
                return self.write_json(500, {'ok': False, 'error': {'code': 'token_config_failed', 'message': '扣子令牌配置失败：' + str(e)}})
        if api_path == '/copy-coze/test' and self.command == 'POST':
            started_at = time.time()
            length = int(self.headers.get('Content-Length', '0') or '0')
            try:
                payload = json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}')
                out = call_copy_coze(payload.get('botId'), '请只回复四个字：连接正常')
                result = {'ok': True, 'status': out['status'], 'durationMs': int((time.time()-started_at)*1000), 'reply': out['reply'], 'model': str(out['bot'].get('id')), 'modelLabel': str(out['bot'].get('label') or '扣子文案智能体'), 'transport': out.get('transport') or 'sse', 'eventCount': out.get('eventCount') or 0, 'requestId': out.get('requestId') or '', 'logId': out.get('logId') or '', 'message': '扣子文案 Bot API 连接正常'}
                push_server_log(method='POST', path='/api/copy-coze/test', status=200, durationMs=result['durationMs'], channel='copy/coze isolated', message=result['message'])
                return self.write_json(200, result)
            except Exception as e:
                code = int(getattr(e, 'status', 500) or 500)
                push_server_log(method='POST', path='/api/copy-coze/test', status=code, durationMs=int((time.time()-started_at)*1000), channel='copy/coze isolated', message=str(e))
                return self.write_json(code, {'ok': False, 'error': coze_error_payload(e)})
        if api_path == '/copy-coze/generate' and self.command == 'POST':
            started_at = time.time()
            length = int(self.headers.get('Content-Length', '0') or '0')
            if length > 2 * 1024 * 1024:
                return self.write_json(413, {'ok': False, 'error': {'message': '文案请求超过 2MB'}})
            try:
                payload = json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}')
                if not str(payload.get('productInfo') or '').strip():
                    return self.write_json(400, {'ok': False, 'error': {'message': '产品信息不能为空'}})
                out = call_copy_coze(payload.get('botId'), copy_prompt(payload.get('productInfo'), payload.get('jsonPrompt')))
                field_audit = audit_copy_return(out['reply'])
                result = {'ok': True, 'status': out['status'], 'durationMs': int((time.time()-started_at)*1000), 'content': out['reply'], 'model': str(out['bot'].get('id')), 'modelLabel': str(out['bot'].get('label') or '扣子文案智能体'), 'provider': 'coze', 'isolated': True, 'transport': out.get('transport') or 'sse', 'eventCount': out.get('eventCount') or 0, 'requestId': out.get('requestId') or '', 'logId': out.get('logId') or '', 'fieldAudit': field_audit}
                push_server_log(method='POST', path='/api/copy-coze/generate', status=200, durationMs=result['durationMs'], channel='copy/coze isolated', message='扣子文案生成完成 · ' + field_audit.get('summary',''), fieldAudit=field_audit)
                return self.write_json(200, result)
            except Exception as e:
                code = int(getattr(e, 'status', 500) or 500)
                push_server_log(method='POST', path='/api/copy-coze/generate', status=code, durationMs=int((time.time()-started_at)*1000), channel='copy/coze isolated', message=str(e))
                return self.write_json(code, {'ok': False, 'error': coze_error_payload(e)})


        # V26 本地持久化接口：不依赖 EvoLink Key，因此必须在外部 API 配置校验之前处理。
        if api_path == '/image-export/source' and self.command == 'GET':
            q=parse_qs(parsed.query);url=str((q.get('url') or [''])[0] or '').strip()
            try:
                data,ctype=_read_remote_image_for_export(url)
                push_server_log(method='GET', path='/api/image-export/source', status=200, durationMs=0, channel='image export', message='远程图片已通过本地代理读取')
                return self.write_raw(200,{'Content-Type':ctype,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'},data)
            except Exception as e:
                push_server_log(method='GET', path='/api/image-export/source', status=502, durationMs=0, channel='image export', message=str(e))
                return self.write_json(502,{'ok':False,'error':{'message':'读取远程图片失败：'+str(e)}})
        if api_path == '/wireframe-history' and self.command == 'GET':
            q=parse_qs(parsed.query);limit=max(1,min(120,int((q.get('limit') or ['60'])[0] or 60)))
            return self.write_json(200, {'ok':True,'version':APP_VERSION,'items':_collection_list(V26_WIRE_HISTORY_FILE,limit)})
        if api_path == '/wireframe-history' and self.command == 'POST':
            started_at=time.time();length=int(self.headers.get('Content-Length','0') or '0')
            if length>48*1024*1024:return self.write_json(413,{'ok':False,'error':{'message':'线框历史写入请求超过 48MB'}})
            try:
                payload=json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}');item_id=_safe_id(payload.get('id') or ('wire-'+str(int(time.time()*1000))))
                old=_collection_get(V26_WIRE_HISTORY_FILE,item_id) or {};src=str(payload.get('src') or old.get('src') or '').strip()
                if src and not src.startswith('/api/wireframe-history/assets/'):src=_materialize_wire_image(src,item_id)
                item=_collection_upsert(V26_WIRE_HISTORY_FILE,{'id':item_id,'label':str(payload.get('label') or old.get('label') or '未命名线框')[:180],'time':str(payload.get('time') or old.get('time') or time.strftime('%Y-%m-%d %H:%M:%S'))[:80],'groupId':str(payload.get('groupId') or old.get('groupId') or '')[:140],'poster':str(payload.get('poster') or old.get('poster') or '')[:20000],'frameName':str(payload.get('frameName') or old.get('frameName') or '')[:260],'src':src,'model':str(payload.get('model') or old.get('model') or '')[:180],'prompt':str(payload.get('prompt') or old.get('prompt') or '')[:30000],'status':str(payload.get('status') or old.get('status') or 'completed')[:40],'sourceTaskId':str(payload.get('sourceTaskId') or old.get('sourceTaskId') or '')[:180]},120)
                if old.get('src') and old.get('src')!=item.get('src'):_remove_wire_asset(old)
                return self.write_json(200,{'ok':True,'item':item})
            except Exception as e:return self.write_json(500,{'ok':False,'error':{'message':'线框历史保存失败：'+str(e)}})
        if api_path.startswith('/wireframe-history/assets/') and self.command == 'GET':
            name=api_path.split('/wireframe-history/assets/',1)[1];full=os.path.realpath(os.path.join(V26_WIRE_HISTORY_ASSET_DIR,name))
            if not full.startswith(os.path.realpath(V26_WIRE_HISTORY_ASSET_DIR)+os.sep) or not os.path.isfile(full):return self.write_json(404,{'ok':False,'error':{'message':'历史图片不存在'}})
            with open(full,'rb') as f:data=f.read();ctype=mimetypes.guess_type(full)[0] or 'image/png'
            return self.write_raw(200,{'Content-Type':ctype},data)
        if api_path.startswith('/wireframe-history/') and self.command == 'DELETE':
            item_id=api_path.rsplit('/',1)[-1];old=_collection_get(V26_WIRE_HISTORY_FILE,item_id);_remove_wire_asset(old);return self.write_json(200,{'ok':True,'removed':_collection_remove(V26_WIRE_HISTORY_FILE,item_id),'id':item_id})
        if api_path == '/image-tasks' and self.command == 'GET':
            q=parse_qs(parsed.query);limit=max(1,min(600,int((q.get('limit') or ['200'])[0] or 200)));return self.write_json(200,{'ok':True,'version':APP_VERSION,'items':_collection_list(V26_IMAGE_TASKS_FILE,limit)})
        if api_path == '/image-tasks' and self.command == 'POST':
            length=int(self.headers.get('Content-Length','0') or '0')
            if length>2*1024*1024:return self.write_json(413,{'ok':False,'error':{'message':'生图任务记录超过 2MB'}})
            try:
                payload=json.loads((self.rfile.read(length) if length else b'{}').decode('utf-8') or '{}');raw_id=payload.get('id') or payload.get('taskId') or payload.get('task_id')
                if not raw_id:return self.write_json(400,{'ok':False,'error':{'message':'生图任务缺少 task_id'}})
                item_id=_safe_id(raw_id);old=_collection_get(V26_IMAGE_TASKS_FILE,item_id) or {};progress=payload.get('progress',old.get('progress',0))
                try:progress=float(progress or 0)
                except Exception:progress=0
                item=_collection_upsert(V26_IMAGE_TASKS_FILE,{'id':item_id,'taskId':str(payload.get('taskId') or payload.get('task_id') or old.get('taskId') or raw_id)[:220],'model':str(payload.get('model') or old.get('model') or '')[:180],'prompt':str(payload.get('prompt') or old.get('prompt') or '')[:30000],'stage':str(payload.get('stage') or old.get('stage') or 'AI 生图')[:120],'submittedAt':str(payload.get('submittedAt') or old.get('submittedAt') or time.strftime('%Y-%m-%dT%H:%M:%S'))[:80],'status':str(payload.get('status') or old.get('status') or 'queued').lower()[:40],'progress':progress,'error':str(payload.get('error') or old.get('error') or '')[:6000],'resultUrls':[str(x) for x in (payload.get('resultUrls') if isinstance(payload.get('resultUrls'),list) else old.get('resultUrls') or []) if x][:20],'unitIndex':payload.get('unitIndex',old.get('unitIndex')),'units':payload.get('units',old.get('units')),'source':str(payload.get('source') or old.get('source') or 'evolink')[:80]},600)
                return self.write_json(200,{'ok':True,'item':item})
            except Exception as e:return self.write_json(500,{'ok':False,'error':{'message':'生图任务保存失败：'+str(e)}})
        if api_path.startswith('/image-tasks/') and self.command == 'DELETE':
            item_id=api_path.rsplit('/',1)[-1];return self.write_json(200,{'ok':True,'removed':_collection_remove(V26_IMAGE_TASKS_FILE,item_id),'id':item_id})

        started_at = time.time()
        base, key = self.cfg()
        if not base or not key:
            push_server_log(method=self.command, path='/api'+api_path, status=400, durationMs=int((time.time()-started_at)*1000), channel='local proxy', message='缺少 Base URL 或 API Key')
            return self.write_json(400, {'error': {'message': '缺少 Base URL 或 API Key，请在网页配置中填写'}})

        if api_path in ('/evolink/files/upload/reference','/evolink/files/upload/base64') and self.command == 'POST':
            local_path='/api'+('/micro' if micro_channel else '')+api_path
            try:
                payload=self.read_json();data_url=(payload or {}).get('base64_data') or (payload or {}).get('base64Data') or '';raw,mime,filename=decode_image_data_url(data_url)
                if len(raw)>50*1024*1024:return self.write_json(413,{'error':{'code':'image_too_large','message':'参考图原始文件超过 50MB'}})
                filename=str((payload or {}).get('file_name') or (payload or {}).get('fileName') or filename)[:100]
                r=request_reference_upload_robust(raw,mime,filename,key,bool((payload or {}).get('skip_cache') is True or (payload or {}).get('skipCache') is True), 'micro' if micro_channel else 'shared');parsed=r.get('parsed') or {};ok=bool(parsed.get('success') or r.get('cacheHit'))
                push_server_log(method='POST',path=local_path,status=r.get('status'),durationMs=int((time.time()-started_at)*1000),channel='evolink/files reference-isolated',message=('参考图上传可用' if ok else 'EvoLink 参考图上传失败')+'；transport='+str(r.get('transport'))+'；cache='+('hit' if r.get('cacheHit') else 'miss')+'；原图 '+str(len(raw))+'B；尝试 '+str(r.get('attempts') or 0)+' 次；路径 '+str(r.get('route')))
                try:out=json.loads((r.get('raw') or b'{}').decode('utf-8','ignore') or '{}')
                except Exception:out={'raw':(r.get('raw') or b'').decode('utf-8','ignore')}
                if isinstance(out,dict):out['local']=dict(out.get('local') or {},referenceUploadChannel='isolated',transport=r.get('transport') or '',route=r.get('route') or '',cacheHit=bool(r.get('cacheHit')),fallbackUsed=bool(r.get('fallbackUsed')),attempts=r.get('attempts') or 0)
                return self.write_json(int(r.get('status') or 500),out)
            except Exception as e:
                d=network_diagnosis_payload(e);msg='EvoLink 参考图文件通道连接被中途断开。V27 已将参考图上传与生图任务通道隔离，并会在 stream 上传失败后切换官方 Base64 上传，同时按 files-api 域名单独选择代理/直连路径；本次所有安全上传路径均失败，请运行“深度网络诊断”查看每条传输轨迹。' if d.get('code')=='connection_reset' else 'EvoLink 参考图文件通道失败：'+str(e)
                push_server_log(method='POST',path=local_path,status=502,durationMs=int((time.time()-started_at)*1000),channel='evolink/files reference-isolated',message=msg+'；trace='+json.dumps(getattr(e,'network_trace',[]),ensure_ascii=False)[:1800]);return self.write_json(502,{'error':{'code':d.get('code'),'message':msg,'retryable':d.get('retryable'),'diagnosis':d,'trace':getattr(e,'network_trace',[]),'channel':'evolink-files/reference'}})
        if api_path == '/network-diagnose' and self.command == 'POST' and is_evolink_base(base):
            try:
                q=parse_qs(parsed.query);deep=(q.get('deep') or ['0'])[0]=='1';out=run_network_diagnostics(key,deep);push_server_log(method='POST',path='/api/network-diagnose',status=200 if out.get('ok') else 207,durationMs=int((time.time()-started_at)*1000),channel='network-diagnose',message='网络诊断 '+('通过' if out.get('ok') else '发现异常')+'；deep='+('1' if deep else '0'));return self.write_json(200,out)
            except Exception as e:
                push_server_log(method='POST',path='/api/network-diagnose',status=500,durationMs=int((time.time()-started_at)*1000),channel='network-diagnose',message=str(e));return self.write_json(200,{'ok':False,'version':APP_VERSION,'steps':[{'name':'网络诊断','ok':False,'message':str(e)}],'diagnosis':network_diagnosis_payload(e)})

        if api_path == '/credits' and self.command == 'GET' and is_evolink_base(base):
            try:
                status, headers, data = request_external('GET', normalize_evolink_base(base) + '/credits', key)
                try: parsed_credits = json.loads(data.decode('utf-8','ignore') or '{}')
                except Exception: parsed_credits = {}
                billing = evolink_credits_payload(parsed_credits, status)
                push_server_log(method='GET', path='/api/credits', status=status, durationMs=int((time.time()-started_at)*1000), channel='evolink/credits preflight', message='Credits 不足，已阻止计费生图' if billing.get('blocked') else ('Credits 生图预检通过' if billing.get('checked') else 'Credits 查询失败'))
                out_headers=dict(headers or {});out_headers['Cache-Control']='no-store'
                return self.write_raw(status, out_headers, data)
            except Exception as e:
                push_server_log(method='GET', path='/api/credits', status=500, durationMs=int((time.time()-started_at)*1000), channel='evolink/credits preflight', message=str(e))
                return self.write_json(500, {'error': {'code':'credits_check_failed','message':'EvoLink Credits 查询失败：'+str(e)}})

        if api_path == '/model-capabilities' and self.command == 'GET' and is_evolink_base(base):
            try:
                q=parse_qs(parsed.query);force=(q.get('refresh') or ['0'])[0]=='1';catalog=fetch_evolink_model_catalog(base,key,force);payload=evolink_capability_payload(catalog.get('rows'), 'evolink-models-cache' if catalog.get('cached') else 'evolink-models-live')
                push_server_log(method='GET', path='/api/model-capabilities', status=200, durationMs=int((time.time()-started_at)*1000), channel='evolink/models capabilities', message='动态能力目录 '+str(len(payload.get('capabilities') or []))+' 个模型'+('（缓存）' if catalog.get('cached') else '（实时）'))
                return self.write_json(200,payload)
            except Exception as e:
                payload=evolink_capability_payload(evolink_model_payload()['data'],'builtin-fallback');payload['ok']=False;payload['warning']='EvoLink 远端模型目录不可用：'+str(e)
                push_server_log(method='GET', path='/api/model-capabilities', status=200, durationMs=int((time.time()-started_at)*1000), channel='evolink/models capabilities fallback', message=payload['warning'])
                return self.write_json(200,payload)

        if api_path == '/models' and self.command == 'GET' and is_evolink_base(base):
            try:
                catalog=fetch_evolink_model_catalog(base,key,False)
                push_server_log(method='GET', path='/api/models', status=200, durationMs=int((time.time()-started_at)*1000), channel='evolink/models', message='使用 EvoLink '+('缓存' if catalog.get('cached') else '实时')+'模型目录')
                return self.write_json(200,catalog.get('raw'))
            except Exception:
                pass
            push_server_log(method='GET', path='/api/models', status=200, durationMs=int((time.time()-started_at)*1000), channel='evolink/models fallback', message='远端模型目录不可用，返回 V27 内置图像模型目录')
            return self.write_json(200, evolink_model_payload())

        if api_path == '/diagnose' and self.command == 'POST':
            if is_evolink_base(base):
                try:
                    file_status, file_headers, file_raw = request_external('GET', EVOLINK_FILES_BASE + '/api/v1/files/quota', key)
                    file_text = file_raw.decode('utf-8', 'ignore');file_ok=200 <= file_status < 300
                    credits_status, credits_headers, credits_raw = request_external('GET', normalize_evolink_base(base) + '/credits', key)
                    credits_text=credits_raw.decode('utf-8','ignore')
                    try:credits_parsed=json.loads(credits_text or '{}')
                    except Exception:credits_parsed={}
                    billing=evolink_credits_payload(credits_parsed,credits_status);auth_ok=file_ok and credits_status not in (401,403)
                    if not file_ok:message=f'EvoLink 文件通道连接失败：HTTP {file_status} {file_text[:260]}'
                    elif not (200 <= credits_status < 300):message=f'EvoLink 基础连接正常，但账户 Credits 查询失败：HTTP {credits_status} {credits_text[:260]}'
                    elif billing.get('blocked'):message='EvoLink API Key 与文件通道可用，但当前账户/Token Credits 不足，生图请求会返回 HTTP 402；请充值或调整 Token 额度后再生成。'
                    else:message='EvoLink API Key、图像文件通道与账户 Credits 检查通过；V27 会在生成前再次检查额度。该诊断不会提交计费生图任务。'
                    models=evolink_model_payload()['data'];capabilities=evolink_capability_payload(models,'builtin')['capabilities'];catalog_source='builtin'
                    if auth_ok:
                        try:
                            catalog=fetch_evolink_model_catalog(base,key,False);models=catalog.get('rows') or models;catalog_source='evolink-models-cache' if catalog.get('cached') else 'evolink-models-live';capabilities=evolink_capability_payload(models,catalog_source)['capabilities']
                        except Exception:catalog_source='builtin-fallback'
                    push_server_log(method='POST', path='/api/diagnose', status=file_status, durationMs=int((time.time()-started_at)*1000), channel='evolink/files quota', message='文件通道正常' if file_ok else '文件通道失败')
                    push_server_log(method='GET', path='/api/credits', status=credits_status, durationMs=int((time.time()-started_at)*1000), channel='evolink/credits', message='Credits 不足，生图不可用' if billing.get('blocked') else ('Credits 可用' if billing.get('checked') else 'Credits 查询失败'))
                    ok=bool(auth_ok and file_ok);generation_ready=bool(ok and billing.get('checked') and not billing.get('blocked'))
                    return self.write_json(200, {'ok':ok,'generationReady':generation_ready,'message':message,'status':file_status,'creditsStatus':credits_status,'provider':'evolink','billing':billing,'models':models,'capabilities':capabilities,'modelCatalogSource':catalog_source,'resolvedProxy':RESOLVED_PROXY})
                except Exception as e:
                    push_server_log(method='POST', path='/api/diagnose', status=500, durationMs=int((time.time()-started_at)*1000), channel='evolink/diagnose', message=str(e))
                    return self.write_json(200, {'ok':False,'generationReady':False,'message':'无法连接 EvoLink：'+str(e),'provider':'evolink','models':evolink_model_payload()['data'],'resolvedProxy':RESOLVED_PROXY})
            target = base + '/models'
            try:
                status, headers, raw = request_external('GET', target, key)
                text = raw.decode('utf-8', 'ignore')
                try: data = json.loads(text or '{}')
                except Exception: data = {'raw': text}
                arr = data if isinstance(data, list) else (data.get('data') or data.get('models') or [])
                via = RESOLVED_PROXY or (PROXY_SETTING if PROXY_SETTING not in ('', 'auto') else 'direct')
                if 200 <= status < 300:
                    push_server_log(method='POST', path='/api/diagnose', status=200, durationMs=int((time.time()-started_at)*1000), channel='external /models', message='连接成功，模型数量 '+str(len(arr) if isinstance(arr, list) else 0))
                    return self.write_json(200, {'ok':True,'message':f'外部 API 可连接（{via}），/models 返回 HTTP {status}，模型数量 {len(arr) if isinstance(arr,list) else 0}','status':status,'models':arr,'resolvedProxy':RESOLVED_PROXY})
                return self.write_json(200, {'ok':False,'message':f'/models 返回 HTTP {status}：{text[:500]}','status':status,'resolvedProxy':RESOLVED_PROXY})
            except Exception as e:
                return self.write_json(200, {'ok':False,'message':'无法连接外部 API：'+str(e),'resolvedProxy':RESOLVED_PROXY})

        if micro_channel and api_path == '/images/generations' and self.command == 'POST':
            channel=str(self.headers.get('X-Channel') or '')
            generation_id=str(self.headers.get('X-Micro-Generation-Id') or '')
            handoff_acknowledged=str(self.headers.get('X-Micro-Handoff-Acknowledged') or '')
            fingerprint=str(self.headers.get('X-Micro-Instruction-Fingerprint') or '')
            conflict_policy=str(self.headers.get('X-Micro-Conflict-Policy') or 'isolated')
            if channel != 'micro-adjust-v27.8' or not generation_id or handoff_acknowledged != '1':
                push_server_log(method='POST', path='/api/micro/images/generations', status=409, durationMs=int((time.time()-started_at)*1000), channel='micro-adjust isolation rejected', message='拒绝未携带 V27.9 微调会话/流程交接确认的计费请求')
                return self.write_json(409, {'error': {'code':'micro_channel_isolation_failed','message':'微调计费请求缺少 V27.9 独立通道标识、generationId 或流程交接确认，已阻止发送到 EvoLink。','channel':'micro-adjust'}})
            push_server_log(method='POST', path='/api/micro/images/generations', status=100, durationMs=int((time.time()-started_at)*1000), channel='micro-adjust isolated preflight', message=f'generationId={generation_id}; conflictPolicy={conflict_policy}; instruction={fingerprint or "none"}')

        target = base + api_path + (('?' + parsed.query) if parsed.query else '')
        length = int(self.headers.get('Content-Length', '0') or '0')
        body = self.rfile.read(length) if length else None
        content_type = self.headers.get('Content-Type')
        try:
            if self.headers.get('X-AI-Progress-Stream') == '1':
                status, total = self.stream_external(self.command, target, key, body, content_type)
                push_server_log(method=self.command, path='/api'+api_path, status=status, durationMs=int((time.time()-started_at)*1000), channel='progress-stream', message='外部 API 流式/实时进度通道完成，字节 '+str(total))
                return
            micro_timeout = (MICRO_TASK_REQUEST_TIMEOUT_MS if api_path.startswith('/tasks/') else (MICRO_GENERATION_SUBMIT_TIMEOUT_MS if api_path == '/images/generations' else min(30000, REQUEST_TIMEOUT_MS))) if micro_channel else None
            status, headers, data = (request_micro_external if micro_channel else request_external)(self.command, target, key, body, content_type, None, micro_timeout)
            push_server_log(method=self.command, path='/api'+('/micro' if micro_channel else '')+api_path, status=status, durationMs=int((time.time()-started_at)*1000), channel=('micro-adjust isolated' if micro_channel else ('proxy/outbound' if PROXY_SETTING else 'direct/outbound')), message=('EvoLink Credits 不足（HTTP 402）' if status == 402 else ('外部 API 请求成功' if status < 400 else '外部 API 返回错误')))
            return self.write_raw(status, headers, data)
        except Exception as e:
            push_server_log(method=self.command, path='/api'+('/micro' if micro_channel else '')+api_path, status=500, durationMs=int((time.time()-started_at)*1000), channel='micro-adjust proxy error' if micro_channel else 'proxy error', message=str(e))
            return self.write_json(500, {'error': {'message': '无法连接外部 API：' + str(e)}})


if __name__ == '__main__':
    os.chdir(ROOT)
    print(f'AI Tool Web UI {APP_VERSION} started: http://127.0.0.1:{PORT}/', flush=True)
    print('Do not close this window while using the page.', flush=True)
    if FORCE_IP:
        print('Note: forceHostIp is only supported by the Node.js server. start.bat will prefer Node.js.', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)
