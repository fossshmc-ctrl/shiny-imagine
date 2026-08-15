#!/usr/bin/env python3
"""PaddleOCR official hosted API client for AI Studio V26.

No local OCR model is installed or executed. Tokens remain server-side. Persistent
storage uses a machine/user-bound authenticated encrypted file and does not rely
on PowerShell ProtectedData, avoiding the previous DPAPI compatibility failure.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import re
import socket
import time
import uuid
import random
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.request import Request, ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parent
TOKEN_FILE = ROOT / "config" / ".paddleocr-token.secure"
LEGACY_TOKEN_FILE = ROOT / "config" / ".paddleocr-token.dpapi"
SESSION_TOKEN = ""
SECURE_VERSION = "local_encrypted_v2"

DEFAULT_JOB_URL = "https://paddleocr.aistudio-app.com/api/v2/ocr/jobs"
DEFAULT_MODEL = "PaddleOCR-VL-1.6"
DEFAULT_SUBMIT_RETRY_DELAYS_MS = [3000, 6000, 12000, 20000]
DEFAULT_SUBMIT_RETRY_JITTER_MS = 500
TRANSIENT_SUBMIT_HTTP = {408, 425, 429, 500, 502, 503, 504}
_STATE_TTL_SECONDS = 15 * 60
_SUBMISSION_COND = threading.Condition()
_SUBMISSION_QUEUE: List[str] = []
_SUBMISSION_ACTIVE = ""
_SUBMISSION_STATES: Dict[str, Dict[str, Any]] = {}


def _machine_secret() -> bytes:
    user = os.environ.get("USERNAME") or os.environ.get("USER") or "user"
    machine = os.environ.get("COMPUTERNAME") or socket.gethostname() or "machine"
    return f"{user}|{machine}|{ROOT.resolve()}".encode("utf-8")


def _derive_key(salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", _machine_secret(), salt, 120000, dklen=32)


def _xor_stream(data: bytes, key: bytes, iv: bytes) -> bytes:
    out = bytearray(len(data))
    offset = 0
    counter = 0
    while offset < len(data):
        block = hmac.new(key, iv + counter.to_bytes(4, "big"), hashlib.sha256).digest()
        counter += 1
        for value in block:
            if offset >= len(data):
                break
            out[offset] = data[offset] ^ value
            offset += 1
    return bytes(out)


def _encrypt_token(token: str) -> str:
    salt, iv = os.urandom(16), os.urandom(16)
    key = _derive_key(salt)
    cipher = _xor_stream(token.encode("utf-8"), key, iv)
    tag = hmac.new(key, iv + cipher, hashlib.sha256).digest()
    return json.dumps({
        "version": 2,
        "scheme": "PBKDF2-HMAC-SHA256-STREAM",
        "salt": base64.b64encode(salt).decode("ascii"),
        "iv": base64.b64encode(iv).decode("ascii"),
        "tag": base64.b64encode(tag).decode("ascii"),
        "data": base64.b64encode(cipher).decode("ascii"),
    }, ensure_ascii=False)


def _decrypt_token(text: str) -> str:
    obj = json.loads(text)
    if not isinstance(obj, dict) or obj.get("version") != 2:
        raise RuntimeError("令牌文件版本不受支持")
    salt = base64.b64decode(obj.get("salt") or "")
    iv = base64.b64decode(obj.get("iv") or "")
    tag = base64.b64decode(obj.get("tag") or "")
    cipher = base64.b64decode(obj.get("data") or "")
    key = _derive_key(salt)
    actual = hmac.new(key, iv + cipher, hashlib.sha256).digest()
    if not hmac.compare_digest(tag, actual):
        raise RuntimeError("令牌文件校验失败，可能来自其他 Windows 用户或电脑")
    return _xor_stream(cipher, key, iv).decode("utf-8")


def _stored_token() -> str:
    if TOKEN_FILE.exists():
        try:
            return _decrypt_token(TOKEN_FILE.read_text("utf-8"))
        except Exception:
            return ""
    return ""


def get_token(cfg: Dict[str, Any]) -> Tuple[str, str]:
    global SESSION_TOKEN
    if SESSION_TOKEN:
        return SESSION_TOKEN, "session"
    env = (os.environ.get("PADDLEOCR_ACCESS_TOKEN") or "").strip()
    if env:
        return env, "environment"
    stored = _stored_token()
    if stored:
        return stored, SECURE_VERSION
    legacy = str(((cfg.get("paddleOcrCloud") or {}).get("token") or "")).strip()
    if legacy:
        return legacy, "legacy_config"
    return "", "not_configured"


def configure_token(payload: Dict[str, Any], cfg: Dict[str, Any]) -> Dict[str, Any]:
    global SESSION_TOKEN
    if payload.get("clear"):
        SESSION_TOKEN = ""
        for file in (TOKEN_FILE, LEGACY_TOKEN_FILE):
            try:
                file.unlink(missing_ok=True)
            except Exception:
                pass
        return status_payload(cfg)
    token = str(payload.get("token") or "").strip()
    if not token:
        return {"ok": False, "error": {"code": "token_missing", "message": "请输入 PaddleOCR Access Token"}}
    if len(token) < 20:
        return {"ok": False, "error": {"code": "token_invalid", "message": "令牌长度异常，请检查是否复制完整"}}
    SESSION_TOKEN = token
    persisted = False
    warning = ""
    if payload.get("remember"):
        try:
            TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
            TOKEN_FILE.write_text(_encrypt_token(token), "utf-8")
            persisted = True
        except Exception as exc:
            warning = "令牌已在本次运行中生效，但本机加密保存失败：" + str(exc)
    out = status_payload(cfg)
    out.update({"saved": True, "persisted": persisted, "warning": warning})
    return out


def status_payload(cfg: Dict[str, Any]) -> Dict[str, Any]:
    cloud = cfg.get("paddleOcrCloud") or {}
    token, source = get_token(cfg)
    return {
        "ok": True,
        "configured": bool(token),
        "tokenSource": source,
        "secureStorage": SECURE_VERSION,
        "jobUrl": str(cloud.get("jobUrl") or DEFAULT_JOB_URL),
        "model": str(cloud.get("model") or DEFAULT_MODEL),
        "pollIntervalMs": int(cloud.get("pollIntervalMs") or 5000),
        "pollTimeoutMs": int(cloud.get("pollTimeoutMs") or 600000),
        "submitRetryDelaysMs": _retry_delays({}, cloud),
        "submitRetryJitterMs": int(cloud.get("submitRetryJitterMs", DEFAULT_SUBMIT_RETRY_JITTER_MS)),
        "submissionQueue": submission_queue_status("").get("queue"),
        "localModelRequired": False,
        "apiKeyRequired": True,
        "resultDownloadMode": "presigned_url_no_auth_redirect_follow_v153",
        "message": "云端令牌已配置" if token else "尚未配置 PaddleOCR 云端令牌",
    }

def _opener(proxy_url: str):
    if proxy_url and proxy_url != "auto":
        return build_opener(ProxyHandler({"http": proxy_url, "https": proxy_url}))
    return build_opener()


def _request(method: str, url: str, headers: Dict[str, str], body: Optional[bytes], timeout: int, proxy_url: str) -> Tuple[int, Dict[str, str], bytes]:
    req = Request(url, data=body, method=method)
    for k, v in headers.items():
        if v:
            req.add_header(k, v)
    try:
        with _opener(proxy_url).open(req, timeout=timeout) as r:
            return int(r.status), dict(r.headers.items()), r.read()
    except HTTPError as e:
        return int(e.code), dict(e.headers.items()), e.read()
    except URLError as e:
        raise RuntimeError("无法连接 PaddleOCR 云端服务：" + str(e.reason or e)) from e


def _decode_image(value: str) -> Tuple[bytes, str, str]:
    raw = str(value or "").strip()
    if not raw:
        raise ValueError("请求中缺少 image 数据")
    mime = "image/png"
    if raw.startswith("data:"):
        m = re.match(r"^data:([^;,]+)?;base64,(.*)$", raw, re.S)
        if not m:
            raise ValueError("image 必须是 base64 Data URL")
        mime = m.group(1) or mime
        raw = m.group(2)
    data = base64.b64decode(raw, validate=False)
    if not data:
        raise ValueError("图片数据为空")
    if len(data) > 35 * 1024 * 1024:
        raise ValueError("图片超过 35MB，请压缩后再识别")
    ext = ".jpg" if "jpeg" in mime or "jpg" in mime else ".webp" if "webp" in mime else ".png"
    return data, mime, ext


def _multipart(fields: Dict[str, str], filename: str, mime: str, data: bytes) -> Tuple[bytes, str]:
    boundary = "----AIV151" + uuid.uuid4().hex
    chunks: List[bytes] = []
    for name, value in fields.items():
        chunks.extend([
            f"--{boundary}\r\n".encode(),
            f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
            str(value).encode("utf-8"), b"\r\n",
        ])
    chunks.extend([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode(),
        f"Content-Type: {mime}\r\n\r\n".encode(),
        data, b"\r\n", f"--{boundary}--\r\n".encode(),
    ])
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def _json(raw: bytes, context: str) -> Dict[str, Any]:
    try:
        obj = json.loads(raw.decode("utf-8", "replace") or "{}")
    except Exception as e:
        raise RuntimeError(context + "返回了无法解析的 JSON") from e
    if not isinstance(obj, dict):
        raise RuntimeError(context + "返回格式异常")
    return obj



def _norm_box(box: Any, width: float, height: float) -> Optional[Tuple[float, float, float, float]]:
    if isinstance(box, dict):
        box = box.get("coordinate") or box.get("coordinates") or box.get("bbox") or box.get("box") or box.get("poly") or box.get("points")
    if not isinstance(box, (list, tuple)):
        return None
    vals: List[float] = []
    if len(box) == 4 and all(isinstance(x, (int, float)) for x in box):
        vals = [float(x) for x in box]
    elif len(box) >= 4 and all(isinstance(pt, (list, tuple)) and len(pt) >= 2 for pt in box):
        xs = [float(pt[0]) for pt in box]
        ys = [float(pt[1]) for pt in box]
        vals = [min(xs), min(ys), max(xs), max(ys)]
    if len(vals) != 4:
        return None
    x1, y1, x2, y2 = vals
    if max(abs(x1), abs(y1), abs(x2), abs(y2)) <= 1.01:
        x1, x2 = x1 * width, x2 * width
        y1, y2 = y1 * height, y2 * height
    x1, y1 = max(0.0, min(width, x1)), max(0.0, min(height, y1))
    x2, y2 = max(0.0, min(width, x2)), max(0.0, min(height, y2))
    return (x1, y1, x2, y2) if x2 > x1 and y2 > y1 else None


def _label_kind(label: str) -> str:
    s = (label or "").strip().lower()
    if any(k in s for k in ("formula", "equation", "algorithm")):
        return "formula"
    if "table" in s:
        return "table"
    if any(k in s for k in ("image", "figure", "picture", "photo", "chart")):
        return "image"
    if "title" in s:
        return "title"
    if any(k in s for k in ("seal", "stamp")):
        return "seal"
    return "text"


def _block_type(label: str) -> str:
    return "product" if _label_kind(label) == "image" else "text"


def _string_content(block: Dict[str, Any]) -> str:
    value = block.get("block_content", block.get("blockContent", block.get("content", block.get("text", block.get("markdown", block.get("res", ""))))))
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        return str(value.get("text") or value.get("markdown") or value.get("html") or "").strip()
    return ""


def _as_array(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if isinstance(value, dict) and isinstance(value.get("boxes"), list):
        return value["boxes"]
    return []


def _extract_regions(jsonl: str, width: int, height: int, max_regions: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], str, int]:
    candidates: List[Dict[str, Any]] = []
    blocks: List[Dict[str, Any]] = []
    markdown_parts: List[str] = []
    pages = 0
    seq = 0

    def add_block(row: Dict[str, Any], page_no: int, source_label: str = "layout") -> None:
        nonlocal seq
        if not isinstance(row, dict):
            return
        box = _norm_box(row.get("block_bbox") or row.get("blockBBox") or row.get("bbox") or row.get("box") or row.get("coordinate") or row.get("coordinates") or row.get("poly") or row.get("points"), width, height)
        if not box:
            return
        label = str(row.get("block_label") or row.get("blockLabel") or row.get("label") or row.get("type") or row.get("category") or source_label)
        content = _string_content(row)
        score = next((float(v) for v in (row.get("score"), row.get("confidence"), row.get("prob")) if isinstance(v, (int, float))), None)
        seq += 1
        item = {
            "id": f"docblock_{seq}", "type": _block_type(label), "kind": _label_kind(label),
            "blockLabel": label, "label": (content[:32] + "…") if len(content) > 32 else (content or label or "版面区域"),
            "recognizedText": content, "confidence": score, "box": box, "source": "paddleocr-cloud",
            "page": page_no, "order": len(blocks),
        }
        blocks.append(dict(item)); candidates.append(dict(item))

    for raw_line in str(jsonl or "").splitlines():
        line = raw_line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except Exception:
            continue
        result = obj.get("result") if isinstance(obj, dict) else None
        if not isinstance(result, dict):
            continue
        page_rows = result.get("layoutParsingResults") or result.get("layout_parsing_results") or result.get("pages") or []
        for page in page_rows:
            if not isinstance(page, dict):
                continue
            pages += 1
            page_no = pages
            md = ((page.get("markdown") or {}).get("text") if isinstance(page.get("markdown"), dict) else page.get("markdownText")) or ""
            if md:
                markdown_parts.append(str(md))
            pruned = page.get("prunedResult") or page.get("pruned_result") or page.get("result") or {}
            overall = (pruned.get("overall_ocr_res") or pruned.get("overallOcrRes") or page.get("overall_ocr_res") or page.get("overallOcrRes") or {}) if isinstance(pruned, dict) else {}
            if isinstance(overall, dict):
                polys = overall.get("rec_polys") or overall.get("dt_polys") or overall.get("text_polys") or overall.get("recPolys") or []
                texts = overall.get("rec_texts") or overall.get("texts") or overall.get("recTexts") or []
                scores = overall.get("rec_scores") or overall.get("dt_scores") or overall.get("scores") or overall.get("recScores") or []
                for i, poly in enumerate(polys):
                    box = _norm_box(poly, width, height)
                    if not box:
                        continue
                    text = str(texts[i] if i < len(texts) else "")
                    seq += 1
                    item = {
                        "id": f"ocrline_{seq}", "type": "text", "kind": "text", "blockLabel": "ocr",
                        "label": (text[:32] + "…") if len(text) > 32 else (text or "文字区域"), "recognizedText": text,
                        "confidence": float(scores[i]) if i < len(scores) and isinstance(scores[i], (int, float)) else None,
                        "box": box, "source": "paddleocr-cloud", "page": page_no, "order": len(blocks),
                    }
                    blocks.append(dict(item)); candidates.append(dict(item))
            if not isinstance(pruned, dict):
                pruned = {}
            collections = [
                pruned.get("parsing_res_list"), pruned.get("parsingResList"), page.get("parsing_res_list"), page.get("parsingResList"),
                result.get("parsing_res_list"), result.get("parsingResList"), pruned.get("layout_det_res"), pruned.get("layoutDetRes"),
                page.get("layout_det_res"), page.get("layoutDetRes"),
            ]
            for collection in collections:
                for row in _as_array(collection):
                    add_block(row, page_no)

    def area(item: Dict[str, Any]) -> float:
        x1, y1, x2, y2 = item["box"]
        return (x2-x1)*(y2-y1)

    def iou(a: Tuple[float,float,float,float], b: Tuple[float,float,float,float]) -> float:
        iw = max(0.0, min(a[2],b[2])-max(a[0],b[0])); ih = max(0.0, min(a[3],b[3])-max(a[1],b[1]))
        inter = iw*ih; union = (a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-inter
        return inter/union if union > 0 else 0.0

    candidates.sort(key=lambda x: (0 if x.get("blockLabel") == "ocr" else 1, x.get("order", 0), -area(x)))
    chosen: List[Dict[str, Any]] = []
    for item in candidates:
        if any(item.get("type") == old.get("type") and iou(item["box"], old["box"]) > .86 for old in chosen):
            continue
        chosen.append(dict(item))
        if len(chosen) >= max(1, min(100, int(max_regions or 40))):
            break
    products = sorted((x for x in chosen if x.get("type") == "product"), key=area, reverse=True)
    for item in products[1:]:
        item["type"] = "decoration"

    regions: List[Dict[str, Any]] = []
    for i, item in enumerate(chosen):
        x1, y1, x2, y2 = item.pop("box")
        typ = item.get("type") or "decoration"
        regions.append({
            **item, "id": f"cloud_{i+1}",
            "x": round(x1/width, 6), "y": round(y1/height, 6), "width": round((x2-x1)/width, 6), "height": round((y2-y1)/height, 6),
            "template": "remove-text" if typ == "text" else "enhance-material" if typ == "product" else "replace-content",
            "suggestedInstruction": "编辑红色文字区域内的文字；删除时自然补全背景，其他区域保持不变。" if typ == "text" else "只调整该产品主体区域，保持包装文字、造型与其他区域不变。" if typ == "product" else "只调整该装饰或版面元素，保持文字、主体和背景结构不变。",
        })
    block_rows: List[Dict[str, Any]] = []
    for i, item in enumerate(blocks):
        x1, y1, x2, y2 = item["box"]
        block_rows.append({
            "id": item.get("id") or f"block_{i+1}", "type": item.get("type") or "text", "kind": item.get("kind") or "text",
            "blockLabel": item.get("blockLabel") or "layout", "label": item.get("label") or "版面区域", "content": item.get("recognizedText") or "",
            "confidence": item.get("confidence"), "page": item.get("page", 1), "order": item.get("order", i),
            "x": round(x1/width, 6), "y": round(y1/height, 6), "width": round((x2-x1)/width, 6), "height": round((y2-y1)/height, 6),
        })
    return regions, block_rows, "\n\n".join(markdown_parts), pages


def _download_presigned(url: str, proxy_url: str) -> Tuple[int, Dict[str, str], bytes, Dict[str, Any]]:
    clean = str(url or "").replace("&amp;", "&").strip()
    headers = {"Accept": "*/*", "User-Agent": "AI-Studio-PaddleOCR-V26"}
    attempts: List[Dict[str, Any]] = []
    modes = [proxy_url, ""] if proxy_url else [""]
    last_status, last_headers, last_body = 0, {}, b""
    for round_no in range(1, 4):
        for mode in modes:
            try:
                status, resp_headers, body = _request("GET", clean, headers, None, 180, mode)
            except Exception as exc:
                attempts.append({"round": round_no, "via": "proxy" if mode else "direct", "error": str(exc)})
                continue
            attempts.append({"round": round_no, "via": "proxy" if mode else "direct", "status": status})
            last_status, last_headers, last_body = status, resp_headers, body
            if status == 200:
                return status, resp_headers, body, {"attempts": attempts, "via": "proxy" if mode else "direct"}
            if status not in (400, 401, 403, 404, 429, 500, 502, 503, 504):
                return status, resp_headers, body, {"attempts": attempts, "via": "proxy" if mode else "direct"}
        time.sleep(round_no)
    return last_status, last_headers, last_body, {"attempts": attempts, "via": attempts[-1].get("via") if attempts else "direct"}


def _request_id(value: Any) -> str:
    raw = re.sub(r"[^a-zA-Z0-9_.:-]", "", str(value or "").strip())[:120]
    return raw or ("ocr_" + uuid.uuid4().hex)


def _cleanup_submission_states_locked() -> None:
    cutoff = time.time() - _STATE_TTL_SECONDS
    for request_id in list(_SUBMISSION_STATES.keys()):
        if (float((_SUBMISSION_STATES.get(request_id) or {}).get("updatedAt") or 0) < cutoff
                and request_id != _SUBMISSION_ACTIVE and request_id not in _SUBMISSION_QUEUE):
            _SUBMISSION_STATES.pop(request_id, None)


def _set_submission_state(request_id: str, **patch: Any) -> Dict[str, Any]:
    request_id = _request_id(request_id)
    with _SUBMISSION_COND:
        _cleanup_submission_states_locked()
        prev = dict(_SUBMISSION_STATES.get(request_id) or {"requestId": request_id, "createdAt": time.time()})
        prev.update(patch)
        prev.update({"requestId": request_id, "updatedAt": time.time()})
        _SUBMISSION_STATES[request_id] = prev
        return dict(prev)


def _refresh_queue_positions_locked() -> None:
    for index, request_id in enumerate(_SUBMISSION_QUEUE):
        prev = dict(_SUBMISSION_STATES.get(request_id) or {"requestId": request_id, "createdAt": time.time()})
        prev.update({
            "phase": "queued",
            "queuePosition": index + 1,
            "queueDepth": len(_SUBMISSION_QUEUE),
            "activeRequestId": _SUBMISSION_ACTIVE,
            "message": f"本地已有识别任务正在提交，当前排队第 {index + 1} 位…",
            "updatedAt": time.time(),
        })
        _SUBMISSION_STATES[request_id] = prev


def submission_queue_status(request_id: str = "") -> Dict[str, Any]:
    request_id = str(request_id or "").strip()
    with _SUBMISSION_COND:
        _cleanup_submission_states_locked()
        state = dict(_SUBMISSION_STATES.get(request_id) or {}) if request_id else None
        return {
            "ok": True,
            "requestId": request_id,
            "state": state or None,
            "queue": {
                "active": bool(_SUBMISSION_ACTIVE),
                "activeRequestId": _SUBMISSION_ACTIVE,
                "waiting": len(_SUBMISSION_QUEUE),
            },
        }


def _run_submission_queued(request_id: str, work):
    global _SUBMISSION_ACTIVE
    with _SUBMISSION_COND:
        _SUBMISSION_QUEUE.append(request_id)
        _refresh_queue_positions_locked()
        _SUBMISSION_COND.notify_all()
        while True:
            if not _SUBMISSION_ACTIVE and _SUBMISSION_QUEUE and _SUBMISSION_QUEUE[0] == request_id:
                _SUBMISSION_QUEUE.pop(0)
                _SUBMISSION_ACTIVE = request_id
                _refresh_queue_positions_locked()
                _set_submission_state(
                    request_id,
                    phase="submitting",
                    queuePosition=0,
                    queueDepth=len(_SUBMISSION_QUEUE),
                    activeRequestId=request_id,
                    message="正在提交 PaddleOCR 云端识别任务…",
                )
                break
            _SUBMISSION_COND.wait(timeout=1.0)
    try:
        return work()
    finally:
        with _SUBMISSION_COND:
            if _SUBMISSION_ACTIVE == request_id:
                _SUBMISSION_ACTIVE = ""
            _refresh_queue_positions_locked()
            _SUBMISSION_COND.notify_all()


def _json_loose(raw: bytes) -> Optional[Dict[str, Any]]:
    try:
        obj = json.loads(raw.decode("utf-8", "replace") or "{}")
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _retry_after_ms(headers: Dict[str, str]) -> int:
    value = ""
    for key, val in (headers or {}).items():
        if str(key).lower() == "retry-after":
            value = str(val or "").strip()
            break
    try:
        return min(60000, max(0, int(float(value) * 1000))) if value else 0
    except Exception:
        return 0


def _classify_submit_response(status: int, headers: Dict[str, str], raw: bytes) -> Dict[str, Any]:
    obj = _json_loose(raw)
    provider_code = int((obj or {}).get("code") or 0)
    provider_message = str((obj or {}).get("msg") or (obj or {}).get("message") or "").strip()
    if status == 200 and provider_code == 0:
        return {"ok": True, "status": status, "obj": obj or {}, "providerCode": provider_code, "providerMessage": provider_message}
    if provider_code == 10010:
        return {"ok": False, "transient": True, "code": "queue_busy", "status": status, "providerCode": provider_code,
                "providerMessage": provider_message or "任务提交队列已满，请稍后重试", "message": "PaddleOCR 当前任务提交队列繁忙"}
    if status in (401, 403):
        return {"ok": False, "transient": False, "code": "auth_failed", "status": status, "providerCode": provider_code,
                "providerMessage": provider_message, "message": "PaddleOCR Access Token 无效、过期或没有权限"}
    if status == 429:
        return {"ok": False, "transient": True, "code": "quota_or_rate_limit", "status": status, "providerCode": provider_code,
                "providerMessage": provider_message, "message": "PaddleOCR 当前请求频率受限"}
    if status == 400:
        return {"ok": False, "transient": False, "code": "invalid_submit_request", "status": status, "providerCode": provider_code,
                "providerMessage": provider_message, "message": "PaddleOCR 拒绝了任务参数"}
    if status in TRANSIENT_SUBMIT_HTTP:
        return {"ok": False, "transient": True, "code": "upstream_temporary", "status": status, "providerCode": provider_code,
                "providerMessage": provider_message, "message": "PaddleOCR 云端服务暂时不可用"}
    return {"ok": False, "transient": False, "code": "submit_failed", "status": status, "providerCode": provider_code,
            "providerMessage": provider_message, "message": "PaddleOCR 云端任务提交失败"}


def _retry_delays(payload: Dict[str, Any], cloud: Dict[str, Any]) -> List[int]:
    raw = payload.get("submitRetryDelaysMs") or cloud.get("submitRetryDelaysMs") or DEFAULT_SUBMIT_RETRY_DELAYS_MS
    if not isinstance(raw, list):
        return list(DEFAULT_SUBMIT_RETRY_DELAYS_MS)
    out: List[int] = []
    for item in raw[:8]:
        try:
            out.append(max(0, min(60000, int(item))))
        except Exception:
            pass
    return out or list(DEFAULT_SUBMIT_RETRY_DELAYS_MS)


def _submit_with_retry(request_id: str, job_url: str, token: str, body: bytes, ctype: str,
                       payload: Dict[str, Any], cloud: Dict[str, Any], proxy_url: str) -> Dict[str, Any]:
    delays = _retry_delays(payload, cloud)
    try:
        jitter_max = max(0, min(3000, int(payload.get("submitRetryJitterMs", cloud.get("submitRetryJitterMs", DEFAULT_SUBMIT_RETRY_JITTER_MS)))))
    except Exception:
        jitter_max = DEFAULT_SUBMIT_RETRY_JITTER_MS
    attempts: List[Dict[str, Any]] = []
    for attempt in range(1, len(delays) + 2):
        _set_submission_state(
            request_id,
            phase="submitting", attempt=attempt, maxAttempts=len(delays) + 1, retryTotal=len(delays),
            message="正在提交 PaddleOCR 云端识别任务…" if attempt == 1 else f"正在进行第 {attempt - 1}/{len(delays)} 次重新提交…",
        )
        headers: Dict[str, str] = {}
        try:
            status, headers, raw = _request(
                "POST", job_url,
                {"Authorization": "bearer " + token, "Content-Type": ctype, "Accept": "application/json"},
                body, 180, proxy_url,
            )
            classified = _classify_submit_response(status, headers, raw)
        except Exception as exc:
            classified = {
                "ok": False, "transient": True, "code": "submit_network_error", "status": 0, "providerCode": 0,
                "providerMessage": "", "message": "连接 PaddleOCR 云端时出现临时网络错误", "networkMessage": str(exc),
            }
            raw = b""
        attempts.append({
            "attempt": attempt,
            "httpStatus": int(classified.get("status") or 0),
            "providerCode": int(classified.get("providerCode") or 0),
            "code": classified.get("code") or "ok",
            "message": classified.get("providerMessage") or classified.get("networkMessage") or "",
            "at": time.time(),
        })
        if classified.get("ok"):
            return {"ok": True, "submitted": classified.get("obj") or {}, "attempts": attempts}
        transient = bool(classified.get("transient"))
        exhausted = transient and attempt > len(delays)
        if not transient or exhausted:
            code = str(classified.get("code") or "submit_failed")
            if code == "queue_busy":
                message = f"PaddleOCR 当前任务队列持续繁忙，已自动重试 {len(delays)} 次仍未提交成功，请稍后重新尝试。" if exhausted else "PaddleOCR 当前任务队列繁忙。"
            elif code == "quota_or_rate_limit":
                message = f"PaddleOCR 当前请求频率持续受限，已自动重试 {len(delays)} 次，请稍后重新尝试。" if exhausted else "PaddleOCR 当前请求频率受限。"
            elif code in ("upstream_temporary", "submit_network_error"):
                message = f"PaddleOCR 云端连接持续不稳定，已自动重试 {len(delays)} 次，请稍后重新尝试。" if exhausted else str(classified.get("message") or "PaddleOCR 云端暂时不可用") + "。"
            else:
                message = str(classified.get("message") or "PaddleOCR 云端任务提交失败")
                if classified.get("status"):
                    message += f"（HTTP {classified.get('status')}）"
                if classified.get("providerMessage"):
                    message += "：" + str(classified.get("providerMessage"))
            return {
                "ok": False,
                "error": {
                    "code": code, "message": message, "httpStatus": int(classified.get("status") or 0),
                    "providerCode": int(classified.get("providerCode") or 0), "providerMessage": str(classified.get("providerMessage") or ""),
                    "retryable": transient, "retryExhausted": exhausted,
                },
                "attempts": attempts,
            }
        base = delays[attempt - 1]
        delay_ms = max(base, _retry_after_ms(headers)) + (random.randint(0, jitter_max) if jitter_max else 0)
        code = str(classified.get("code") or "")
        _set_submission_state(
            request_id,
            phase="retry_wait", attempt=attempt, retryIndex=attempt, retryTotal=len(delays), nextAttempt=attempt + 1,
            delayMs=delay_ms, httpStatus=int(classified.get("status") or 0), providerCode=int(classified.get("providerCode") or 0), errorCode=code,
            message=(
                f"PaddleOCR 当前任务较多，正在等待云端队列，第 {attempt}/{len(delays)} 次重试将在约 {(delay_ms + 999) // 1000} 秒后开始…"
                if code == "queue_busy"
                else f"PaddleOCR 暂时不可用，正在等待，第 {attempt}/{len(delays)} 次重试将在约 {(delay_ms + 999) // 1000} 秒后开始…"
            ),
        )
        time.sleep(delay_ms / 1000.0)
    return {"ok": False, "error": {"code": "submit_failed", "message": "PaddleOCR 云端任务提交失败"}, "attempts": attempts}


def recognize(payload: Dict[str, Any], cfg: Dict[str, Any], proxy_url: str = "") -> Dict[str, Any]:
    payload = payload if isinstance(payload, dict) else {}
    request_id = _request_id(payload.get("requestId"))
    _set_submission_state(request_id, phase="preparing", message="正在准备 PaddleOCR 云端识别任务…")
    token, source = get_token(cfg)
    if not token:
        error = {"code": "token_not_configured", "message": "尚未配置 PaddleOCR 云端令牌，请先在识别面板中保存令牌。"}
        _set_submission_state(request_id, phase="failed", errorCode=error["code"], message=error["message"])
        return {"ok": False, "error": error, "requestId": request_id}
    cloud = cfg.get("paddleOcrCloud") or {}
    job_url = str(payload.get("jobUrl") or cloud.get("jobUrl") or DEFAULT_JOB_URL).rstrip("/")
    model = str(payload.get("model") or cloud.get("model") or DEFAULT_MODEL)
    poll_interval = max(1000, int(payload.get("pollIntervalMs") or cloud.get("pollIntervalMs") or 5000)) / 1000.0
    poll_timeout = max(30000, int(payload.get("pollTimeoutMs") or cloud.get("pollTimeoutMs") or 600000)) / 1000.0
    max_regions = int(payload.get("maxRegions") or cloud.get("maxRegions") or 40)
    width = max(1, int(payload.get("imageWidth") or 1)); height = max(1, int(payload.get("imageHeight") or 1))
    data, mime, ext = _decode_image(str(payload.get("image") or ""))
    options = {
        "markdownIgnoreLabels": ["header", "header_image", "footer", "footer_image", "footnote", "aside_text"],
        "useDocOrientationClassify": bool(payload.get("useDocOrientationClassify", False)), "useDocUnwarping": bool(payload.get("useDocUnwarping", False)),
        "useLayoutDetection": True, "useChartRecognition": bool(payload.get("useChartRecognition", False)), "useSealRecognition": True,
        "useOcrForImageBlock": True, "mergeTables": True, "relevelTitles": True, "layoutShapeMode": "auto", "promptLabel": "ocr",
        "repetitionPenalty": 1, "temperature": 0, "topP": 1, "layoutNms": True, "restructurePages": True,
    }
    body, ctype = _multipart({"model": model, "optionalPayload": json.dumps(options, ensure_ascii=False)}, "image"+ext, mime, data)
    submitted_result = _run_submission_queued(
        request_id,
        lambda: _submit_with_retry(request_id, job_url, token, body, ctype, payload, cloud, proxy_url),
    )
    if not submitted_result.get("ok"):
        error = submitted_result.get("error") or {"code": "submit_failed", "message": "PaddleOCR 云端任务提交失败"}
        _set_submission_state(request_id, phase="failed", errorCode=error.get("code"), message=error.get("message"), submitAttempts=len(submitted_result.get("attempts") or []))
        return {"ok": False, "error": error, "requestId": request_id, "submitAttempts": len(submitted_result.get("attempts") or []), "submitDiagnostics": submitted_result.get("attempts") or []}
    submitted = submitted_result.get("submitted") or {}
    job_id = ((submitted.get("data") or {}).get("jobId")) if isinstance(submitted.get("data"), dict) else None
    if not job_id:
        error = {"code": "missing_job_id", "message": "云端返回成功，但未包含 jobId"}
        _set_submission_state(request_id, phase="failed", errorCode=error["code"], message=error["message"])
        return {"ok": False, "error": error, "requestId": request_id, "submitAttempts": len(submitted_result.get("attempts") or []), "submitDiagnostics": submitted_result.get("attempts") or []}
    _set_submission_state(request_id, phase="submitted", jobId=job_id, message="任务已提交，正在等待 PaddleOCR 云端解析与版面识别…", submitAttempts=len(submitted_result.get("attempts") or []))
    deadline = time.monotonic()+poll_timeout; poll_count = 0; progress: Dict[str, Any] = {}; json_url = ""
    while time.monotonic() < deadline:
        poll_count += 1
        _set_submission_state(request_id, phase="polling", jobId=job_id, pollCount=poll_count, message="任务已提交，正在等待 PaddleOCR 云端解析与版面识别…")
        s, _, rr = _request("GET", f"{job_url}/{job_id}", {"Authorization": "bearer "+token, "Accept": "application/json"}, None, 90, proxy_url)
        if s != 200:
            error = {"code": "poll_failed", "message": f"查询云端任务失败（HTTP {s}）："+rr.decode("utf-8", "replace")[:800]}
            _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
            return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id}
        try:
            jo = _json(rr, "任务状态接口")
            if int(jo.get("code") or 0) != 0:
                raise RuntimeError(f"任务状态查询失败（code {jo.get('code')}）：{jo.get('msg') or jo.get('message') or '未知错误'}")
        except Exception as exc:
            error = {"code": "poll_response_error", "message": str(exc)}
            _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
            return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id}
        d = jo.get("data") or {}; state = str(d.get("state") or ""); progress = d.get("extractProgress") or {}
        if state == "done":
            json_url = str(((d.get("resultUrl") or {}).get("jsonUrl")) or "").replace("&amp;", "&"); break
        if state == "failed":
            error = {"code": "job_failed", "message": str(d.get("errorMsg") or "云端任务执行失败")}
            _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
            return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id}
        time.sleep(poll_interval)
    if not json_url:
        error = {"code": "poll_timeout", "message": "云端识别等待超时，请稍后重试或调大轮询超时时间"}
        _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
        return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id}
    _set_submission_state(request_id, phase="downloading", jobId=job_id, message="云端任务已完成，正在下载并解析识别结果…")
    s, _, result_raw, diagnostics = _download_presigned(json_url, proxy_url)
    if s != 200:
        snippet = result_raw.decode("utf-8", "replace")[:240].replace("\n", " ")
        error = {"code": "result_download_failed", "message": f"结果文件下载失败（HTTP {s}）。当前版本已使用不携带 PaddleOCR Authorization 的预签名 URL 下载通道。"+(f" 返回：{snippet}" if snippet else "")}
        _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
        return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id, "downloadDiagnostics": diagnostics}
    try:
        regions, document_blocks, markdown, pages = _extract_regions(result_raw.decode("utf-8", "replace"), width, height, max_regions)
    except Exception as exc:
        error = {"code": "result_parse_failed", "message": "云端结果解析失败："+str(exc)}
        _set_submission_state(request_id, phase="failed", jobId=job_id, errorCode=error["code"], message=error["message"])
        return {"ok": False, "error": error, "jobId": job_id, "requestId": request_id}
    result = {
        "ok": True, "engine": "PaddleOCR Official API", "model": model, "tokenSource": source, "jobId": job_id, "requestId": request_id,
        "submitAttempts": len(submitted_result.get("attempts") or []), "submitDiagnostics": submitted_result.get("attempts") or [], "pollCount": poll_count,
        "progress": progress, "image": {"width": width, "height": height}, "regions": regions, "documentBlocks": document_blocks,
        "markdown": markdown, "pageCount": pages, "downloadDiagnostics": diagnostics,
        "message": f"PaddleOCR 云端识别完成，共生成 {len(regions)} 个初始区域",
    }
    _set_submission_state(request_id, phase="done", jobId=job_id, message=result["message"], submitAttempts=result["submitAttempts"], pollCount=poll_count)
    return result
