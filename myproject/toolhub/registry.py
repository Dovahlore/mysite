# -*- coding: utf-8 -*-
"""toolhub 工具注册表：主页工具墙的唯一数据源。

两种工具来源自动合并：
1. entries.py 的 link 条目 —— 站内已有页面或外部链接（如 Portainer）；
2. drop-in 文件夹 static/tools/<id>/（tool.json + index.html）——
   独立 html/js 小工具，扔进文件夹即自动上墙，零后端代码。

注册表按目录 mtime 做进程内缓存：dev 下增删文件夹后刷新页面即可生效。
以 "_" 开头的目录（如 _common 共享脚本）不会被当作工具。
"""
import json
import os
import re
import threading

from .entries import LINK_TOOLS

TOOLS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "tools")

_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
_MAX_NAME = 40
_MAX_DESC = 80

DEFAULT_ICON_FA = "fas fa-puzzle-piece"
DEFAULT_ICON_COLOR = "#89bfe1"

# 悬停预览：工具目录里放了这些名字的文件，卡片 hover 时自动播真实画面。
# 按元组顺序取第一个命中的文件；只认固定文件名，天然无路径穿越风险。
PREVIEW_FILES = (
    "preview.mp4",
    "preview.webm",
    "preview.gif",
    "preview.png",
    "preview.jpg",
    "preview.jpeg",
)
PREVIEW_TYPES = {
    "preview.mp4": "video",
    "preview.webm": "video",
    "preview.gif": "gif",
    "preview.png": "image",
    "preview.jpg": "image",
    "preview.jpeg": "image",
}

_lock = threading.Lock()
_cache = {"key": None, "tools": None, "manifests": None}


def _fail(tool_id, reason):
    print("[toolhub] skip tool %r: %s" % (tool_id, reason))
    return None


def _load_manifest(tool_id, folder):
    """读取并校验 tool.json，返回规整后的 manifest；不合法返回 None。"""
    path = os.path.join(folder, "tool.json")
    if not os.path.isfile(path):
        return _fail(tool_id, "缺少 tool.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw = json.load(f)
    except (OSError, ValueError) as exc:
        return _fail(tool_id, "tool.json 解析失败: %s" % exc)
    if not isinstance(raw, dict):
        return _fail(tool_id, "tool.json 顶层必须是对象")

    name = raw.get("name")
    if not isinstance(name, str) or not (1 <= len(name.strip()) <= _MAX_NAME):
        return _fail(tool_id, "name 必须是 1-%d 字符的字符串" % _MAX_NAME)

    desc = raw.get("description") or raw.get("desc") or ""
    if not isinstance(desc, str) or len(desc) > _MAX_DESC:
        return _fail(tool_id, "description 必须是不超过 %d 字符的字符串" % _MAX_DESC)

    order = raw.get("order", 500)
    if isinstance(order, bool) or not isinstance(order, (int, float)):
        order = 500

    icon_img = raw.get("icon_img")
    if icon_img is not None:
        if not isinstance(icon_img, str) or not icon_img.strip():
            icon_img = None
        else:
            icon_img = icon_img.strip()
            if "/" in icon_img or "\\" in icon_img or ".." in icon_img:
                return _fail(tool_id, "icon_img 只能是工具目录内的文件名（不含路径）")

    ai_cfg = raw.get("ai")
    has_ai = False
    ai = None
    if ai_cfg is not None:
        if (
            not isinstance(ai_cfg, dict)
            or not isinstance(ai_cfg.get("system_prompt"), str)
            or not ai_cfg["system_prompt"].strip()
        ):
            return _fail(tool_id, "ai.system_prompt 必填（非空字符串）")
        try:
            temperature = float(ai_cfg.get("temperature", 0.4))
        except (TypeError, ValueError):
            temperature = 0.4
        temperature = min(max(temperature, 0.0), 2.0)
        try:
            max_tokens = int(ai_cfg.get("max_tokens", 800))
        except (TypeError, ValueError):
            max_tokens = 800
        max_tokens = min(max(max_tokens, 64), 4000)
        ai = {
            "system_prompt": ai_cfg["system_prompt"],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        has_ai = True

    return {
        "id": tool_id,
        "name": name.strip(),
        "desc": desc.strip(),
        "order": order,
        "bare": bool(raw.get("bare", False)),
        "icon_fa": (str(raw.get("icon") or "").strip() or DEFAULT_ICON_FA),
        "icon_color": raw.get("icon_color") or DEFAULT_ICON_COLOR,
        "icon_img": ("tools/%s/%s" % (tool_id, icon_img)) if icon_img else None,
        "ai": ai,
        "has_ai": has_ai,
    }


def _find_preview(folder):
    """在工具目录里找悬停预览素材，返回 (文件名, 类型)；没有返回 (None, None)。"""
    for name in PREVIEW_FILES:
        if os.path.isfile(os.path.join(folder, name)):
            return name, PREVIEW_TYPES[name]
    return None, None


def _dir_sig(root):
    """目录签名（子目录名 + mtime），用于缓存失效判断。"""
    try:
        names = sorted(os.listdir(root))
    except OSError:
        return ()
    sig = []
    for name in names:
        p = os.path.join(root, name)
        try:
            if os.path.isdir(p):
                st = os.stat(p)
                sig.append((name, st.st_mtime_ns))
        except OSError:
            continue
    return tuple(sig)


def _scan(root=TOOLS_DIR):
    """扫描 link 条目 + drop-in 文件夹，返回 (tools, manifests)。"""
    tools = []
    manifests = {}
    for entry in LINK_TOOLS:
        tool = dict(entry)
        tool.setdefault("kind", "link")
        tool.setdefault("desc", "")
        tool.setdefault("icon_fa", DEFAULT_ICON_FA)
        tool.setdefault("icon_color", DEFAULT_ICON_COLOR)
        tool.setdefault("icon_img", None)
        tool.setdefault("order", 500)
        tool.setdefault("has_ai", False)
        tool.setdefault("preview", None)
        tool.setdefault("preview_type", None)
        tools.append(tool)

    try:
        names = sorted(os.listdir(root))
    except OSError:
        names = []
    for name in names:
        if name.startswith("_") or name.startswith("."):
            continue
        folder = os.path.join(root, name)
        if not os.path.isdir(folder):
            continue
        if not _ID_RE.match(name):
            _fail(name, "目录名只能用小写字母/数字/-/_（且以字母或数字开头）")
            continue
        if any(t["id"] == name for t in tools):
            _fail(name, "与 link 条目 id 冲突")
            continue
        if not os.path.isfile(os.path.join(folder, "index.html")):
            _fail(name, "缺少 index.html")
            continue
        manifest = _load_manifest(name, folder)
        if manifest is None:
            continue
        manifests[name] = manifest
        pv_file, pv_type = _find_preview(folder)
        manifest["preview"] = ("tools/%s/%s" % (name, pv_file)) if pv_file else None
        manifest["preview_type"] = pv_type if pv_file else None
        if manifest["bare"]:
            url = "/static/tools/%s/index.html" % name
        else:
            url = "/s/t/%s/" % name
        tools.append({
            "id": name,
            "kind": "app",
            "name": manifest["name"],
            "desc": manifest["desc"],
            "url": url,
            "icon_fa": manifest["icon_fa"],
            "icon_color": manifest["icon_color"],
            "icon_img": manifest["icon_img"],
            "order": manifest["order"],
            "has_ai": manifest["has_ai"],
            "preview": manifest["preview"],
            "preview_type": manifest["preview_type"],
        })

    tools.sort(key=lambda t: (t.get("order", 500), str(t.get("name", ""))))
    return tools, manifests


def list_tools():
    sig = _dir_sig(TOOLS_DIR)
    with _lock:
        if _cache["tools"] is None or _cache["key"] != sig:
            _cache["key"] = sig
            _cache["tools"], _cache["manifests"] = _scan(TOOLS_DIR)
        return _cache["tools"]


def get_tool(tool_id):
    for tool in list_tools():
        if tool["id"] == tool_id:
            return tool
    return None


def get_manifest(tool_id):
    list_tools()  # 确保已扫描
    return _cache["manifests"].get(tool_id)
