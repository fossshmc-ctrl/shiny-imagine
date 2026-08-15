#!/usr/bin/env python3
from __future__ import annotations
import base64
import hashlib
import hmac
import json
import os
import re
import socket
from pathlib import Path
from typing import Any, Dict, Tuple

ROOT = Path(__file__).resolve().parent
TOKEN_FILE = ROOT / 'config' / '.copy-coze-token.secure'
SESSION_TOKEN = ''
SECURE_VERSION = 'local_encrypted_v1'


def normalize_token(value: Any) -> str:
    token = str(value or '').replace('\ufeff', '')
    token = re.sub(r'[\u200B-\u200D\u2060\uFEFF]', '', token).strip()
    token = re.sub(r'^Bearer\s+', '', token, flags=re.I).strip()
    if len(token) >= 2 and token[0] == token[-1] and token[0] in ('"', "'"):
        token = token[1:-1].strip()
    return re.sub(r'\s+', '', token)


def _machine_secret() -> bytes:
    user = os.environ.get('USERNAME') or os.environ.get('USER') or 'user'
    machine = os.environ.get('COMPUTERNAME') or socket.gethostname() or 'machine'
    return f'{user}|{machine}|copy-coze-token-v1'.encode('utf-8')


def _derive_key(salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac('sha256', _machine_secret(), salt, 120000, dklen=32)


def _xor_stream(data: bytes, key: bytes, iv: bytes) -> bytes:
    out = bytearray(len(data)); offset = 0; counter = 0
    while offset < len(data):
        block = hmac.new(key, iv + counter.to_bytes(4, 'big'), hashlib.sha256).digest(); counter += 1
        for value in block:
            if offset >= len(data): break
            out[offset] = data[offset] ^ value; offset += 1
    return bytes(out)


def _encrypt_token(token: str) -> str:
    salt, iv = os.urandom(16), os.urandom(16)
    key = _derive_key(salt)
    cipher = _xor_stream(token.encode('utf-8'), key, iv)
    tag = hmac.new(key, iv + cipher, hashlib.sha256).digest()
    return json.dumps({'version': 1, 'scheme': 'PBKDF2-HMAC-SHA256-STREAM', 'salt': base64.b64encode(salt).decode(), 'iv': base64.b64encode(iv).decode(), 'tag': base64.b64encode(tag).decode(), 'data': base64.b64encode(cipher).decode()}, ensure_ascii=False)


def _decrypt_token(text: str) -> str:
    obj = json.loads(text)
    if not isinstance(obj, dict) or obj.get('version') != 1:
        raise RuntimeError('令牌文件版本不受支持')
    salt = base64.b64decode(obj.get('salt') or ''); iv = base64.b64decode(obj.get('iv') or '')
    tag = base64.b64decode(obj.get('tag') or ''); cipher = base64.b64decode(obj.get('data') or '')
    key = _derive_key(salt); actual = hmac.new(key, iv + cipher, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, actual):
        raise RuntimeError('令牌文件校验失败，可能来自其他 Windows 用户或电脑')
    return normalize_token(_xor_stream(cipher, key, iv).decode('utf-8'))


def _stored_token() -> str:
    if not TOKEN_FILE.exists(): return ''
    try: return _decrypt_token(TOKEN_FILE.read_text('utf-8'))
    except Exception: return ''


def get_token(private_config: Dict[str, Any]) -> Tuple[str, str]:
    global SESSION_TOKEN
    current = normalize_token(SESSION_TOKEN)
    if current: return current, 'session'
    stored = _stored_token()
    if stored: return stored, SECURE_VERSION
    env = normalize_token(os.environ.get('COZE_API_TOKEN') or '')
    if env: return env, 'environment'
    legacy = normalize_token((private_config or {}).get('token') or '')
    if legacy: return legacy, 'legacy_config'
    return '', 'not_configured'


def _source_label(source: str) -> str:
    return {'session': '仅本次运行', 'environment': '环境变量', SECURE_VERSION: '本机加密保存', 'legacy_config': '旧版私有配置', 'not_configured': '未配置'}.get(source, '未配置')


def status_payload(private_config: Dict[str, Any]) -> Dict[str, Any]:
    token, source = get_token(private_config)
    return {'ok': True, 'configured': bool(token), 'tokenLoaded': bool(token), 'tokenSource': source, 'tokenSourceLabel': _source_label(source), 'secureStorage': SECURE_VERSION, 'manualTokenInput': True, 'message': ('扣子访问令牌已配置 · ' + _source_label(source)) if token else '请手动输入有效的扣子访问令牌'}


def configure_token(payload: Dict[str, Any], private_config: Dict[str, Any]) -> Dict[str, Any]:
    global SESSION_TOKEN
    payload = payload if isinstance(payload, dict) else {}
    if payload.get('clear'):
        SESSION_TOKEN = ''
        try: TOKEN_FILE.unlink(missing_ok=True)
        except Exception: pass
        out = status_payload(private_config); out['cleared'] = True; return out
    raw = str(payload.get('token') or '')
    token = normalize_token(raw)
    if not token: return {'ok': False, 'error': {'code': 'token_missing', 'message': '请输入扣子访问令牌'}}
    if re.match(r'^https?://', token, re.I) or len(token) < 20: return {'ok': False, 'error': {'code': 'token_invalid', 'message': '令牌格式或长度异常，请从扣子平台重新复制完整令牌'}}
    if re.match(r'^(?:your[_-]?token|replace[_-]?me|token)$', token, re.I): return {'ok': False, 'error': {'code': 'token_placeholder', 'message': '当前内容是占位文本，不是有效令牌'}}
    SESSION_TOKEN = token
    persisted = False; warning = ''
    if payload.get('remember'):
        try:
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_FILE.write_text(_encrypt_token(token), 'utf-8')
            persisted = True
            SESSION_TOKEN = ''
        except Exception as exc:
            warning = '令牌已在本次运行中生效，但本机加密保存失败：' + str(exc)
    out = status_payload(private_config)
    out.update({'saved': True, 'persisted': persisted, 'normalized': token != raw.strip(), 'warning': warning})
    return out
