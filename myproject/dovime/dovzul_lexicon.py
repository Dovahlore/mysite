# -*- coding: utf-8 -*-
"""龙语词典（服务端）：从前端 data.js / ref.js 解析 thuum.org 全量词库，
供 AI 工具调用（dict_lookup）做验证与查询。

格式：
  DOV_LEXICON    = [[dov, en_gloss, canon, pos, note], ...]        （data.js，严格 JSON）
  DOV_ZH         = [[hanzi, pinyin, [en_senses], level], ...]      （data.js，严格 JSON）
  DOV_ZH_EXTRA   = 同 DOV_ZH（ref.js，单引号 JS 风格，需容错转换）
"""
import json
import pathlib
import re

_STATIC = pathlib.Path(__file__).resolve().parent / "static" / "ime" / "js"
CANON_TXT = {0: "非正典", 1: "半正典", 2: "正典"}


def _decode_value(text, pos):
    """从 pos 起解析第一个 JSON 值；单引号数据先容错转换。"""
    try:
        return json.JSONDecoder().raw_decode(text, pos)[0]
    except json.JSONDecodeError:
        return None


def _extract(text, name):
    m = re.search(r"window\.%s\s*=\s*" % name, text)
    if not m:
        return None
    # 找到赋值表达式的起止：从 '=' 后第一个非空白字符到语句结尾 '];'
    start = m.end()
    while text[start] in " \t\r\n":
        start += 1
    end = text.find("];", start)
    if end < 0:
        return None
    chunk = text[start:end + 1]
    val = _decode_value(text, start)
    if val is None:
        try:  # 单引号风格 → 双引号
            val = json.loads(chunk.replace("'", '"'))
        except json.JSONDecodeError:
            return None
    return val


class Lexicon:
    def __init__(self):
        self.lex = []
        self.zh = []
        self._gloss2zh = {}
        self._load()

    def _load(self):
        raw = {}
        for fname in ("data.js", "ref.js"):
            path = _STATIC / fname
            if not path.exists():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except OSError:
                continue
            for name in ("DOV_LEXICON", "DOV_ZH", "DOV_ZH_EXTRA"):
                if name in raw:
                    continue
                val = _extract(text, name)
                if val is not None:
                    raw[name] = val
        self.lex = raw.get("DOV_LEXICON") or []
        for name in ("DOV_ZH", "DOV_ZH_EXTRA"):
            self.zh.extend(raw.get(name) or [])
        for row in self.zh:
            try:
                hanzi, _pinyin, senses = row[0], row[1], row[2]
            except (IndexError, TypeError):
                continue
            for s in senses or []:
                self._gloss2zh.setdefault(str(s).strip().lower(), []).append(hanzi)

    @property
    def size(self):
        return len(self.lex)

    def entry_line(self, e):
        zh_hits = []
        for tok in re.split(r"[,;/]", str(e[1]).lower()):
            tok = tok.strip()
            if tok and len(tok) > 1:
                for h in self._gloss2zh.get(tok, [])[:2]:
                    if h not in zh_hits:
                        zh_hits.append(h)
        parts = [str(e[0]), str(e[1])]
        canon = e[2] if len(e) > 2 else None
        parts.append(CANON_TXT.get(canon, str(canon)) if canon is not None else "")
        if len(e) > 3 and e[3]:
            parts.append(str(e[3]))
        if zh_hits:
            parts.append("中文:" + "/".join(zh_hits[:3]))
        if len(e) > 4 and e[4]:
            parts.append("注:" + str(e[4])[:60])
        return " | ".join(p for p in parts if p)

    def lookup(self, query, limit=8):
        q = str(query).strip().lower()
        if not q:
            return []
        res, seen = [], set()

        def add(e):
            key = str(e[0]).lower()
            if key not in seen:
                seen.add(key)
                res.append(e)

        for e in self.lex:  # 龙语词精确/前缀
            if str(e[0]).lower() == q or str(e[0]).lower().startswith(q):
                add(e)
                if len(res) >= limit:
                    return res
        for e in self.lex:  # 英文义项精确命中
            if any(tok.strip() == q for tok in re.split(r"[,;/]", str(e[1]).lower())):
                add(e)
                if len(res) >= limit:
                    return res
        for e in self.lex:  # 英文包含
            if q in str(e[1]).lower():
                add(e)
                if len(res) >= limit:
                    return res
        for row in self.zh:  # 中文 → 英文义项 → 龙语词
            try:
                hanzi, _pinyin, senses = row[0], row[1], row[2]
            except (IndexError, TypeError):
                continue
            if q in str(hanzi).lower() or any(q == str(s).lower() for s in senses or []):
                for s in senses or []:
                    for e in self.lex:
                        if any(tok.strip() == str(s).lower() for tok in re.split(r"[,;/]", str(e[1]).lower())):
                            add(e)
                            if len(res) >= limit:
                                return res
        return res[:limit]


_LEXICON = None


def get_lexicon():
    global _LEXICON
    if _LEXICON is None:
        _LEXICON = Lexicon()
    return _LEXICON
