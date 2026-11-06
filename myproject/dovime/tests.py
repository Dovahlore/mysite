"""dovime（龙语输入法）测试：页面渲染、静态资源、词典解析、AI 工具调用链（mock OpenAI 客户端）。

全部 SimpleTestCase —— 不碰数据库。
"""
from types import SimpleNamespace
from unittest import mock

from django.contrib.staticfiles import finders
from django.test import SimpleTestCase

from dovime import dovzul_lexicon
from dovime.views import ai as ai_view


def _chunk(**kw):
    delta = SimpleNamespace(
        content=kw.get("content"),
        reasoning_content=kw.get("reasoning_content"),
        tool_calls=kw.get("tool_calls"),
    )
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=kw.get("finish_reason"))])

def _tool_chunk(index=0, cid=None, name=None, args=None):
    tc = SimpleNamespace(index=index, id=cid, function=SimpleNamespace(name=name, arguments=args))
    return _chunk(tool_calls=[tc])


class FakeCompletions:
    """按轮次返回预置的 chunk 流，并记录每次 create 的入参。"""

    def __init__(self, rounds):
        self.rounds = list(rounds)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        if not self.rounds:
            raise RuntimeError("no more rounds")
        return iter(self.rounds.pop(0))


class FakeClient:
    def __init__(self, rounds):
        self.chat = SimpleNamespace(completions=FakeCompletions(rounds))


class PageTests(SimpleTestCase):
    def test_page_renders(self):
        response = self.client.get("/s/ime")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'id="ime-input"')
        self.assertContains(response, "DOV_AI_ENDPOINT")
        self.assertContains(response, 'href="/"')          # 返回首页
        self.assertContains(response, 'id="cursor-dot"')   # 继承的光标特效
        self.assertContains(response, 'id="starfield"')    # 继承的背景特效
        self.assertContains(response, "csrfmiddlewaretoken")
        self.assertContains(response, 'id="tw-in"')          # 符文打字机
        self.assertContains(response, 'id="tw-strip"')
        self.assertContains(response, 'id="tw-zh"')
        self.assertNotContains(response, 'id="kbd-buttons"')  # 旧三块已移除
        self.assertNotContains(response, 'id="latin-in"')
        self.assertNotContains(response, 'id="alpha-grid"')

    def test_static_assets_exist(self):
        for rel in (
            "ime/js/font.js", "ime/js/data.js", "ime/js/ref.js",
            "ime/js/core.js", "ime/js/app.js",
            "ime/font/dragon_alphabet.ttf",
            "ime/img/skyrim_logo_light.png",
            "ime/img/skyrim_favicon_black.png",
        ):
            self.assertTrue(finders.find(rel), f"缺少静态资源 {rel}")


class LexiconTests(SimpleTestCase):
    def test_lexicon_loaded(self):
        lex = dovzul_lexicon.get_lexicon()
        self.assertGreater(lex.size, 4000)

    def test_lookup_dragon_word(self):
        hits = dovzul_lexicon.get_lexicon().lookup("jun")
        self.assertTrue(hits)
        line = dovzul_lexicon.get_lexicon().entry_line(hits[0])
        self.assertIn("Jun", line)
        self.assertIn("King", line)

    def test_lookup_via_chinese(self):
        hits = dovzul_lexicon.get_lexicon().lookup("王")
        self.assertTrue(hits)

    def test_lookup_no_match(self):
        self.assertEqual(dovzul_lexicon.get_lexicon().lookup("zzzzqqq"), [])


class AiEndpointTests(SimpleTestCase):
    def _post(self, payload):
        return self.client.post("/s/ime/ai", data=payload, content_type="application/json")

    @staticmethod
    def _body(response):
        return b"".join(response.streaming_content).decode("utf-8")

    def _patch_providers(self):
        return mock.patch.object(ai_view, "fast_model_providers", return_value=[{
            "name": "p", "api_key": "k", "base_url": "http://x", "model": "m", "timeout": 1, "max_retries": 0,
        }])

    def test_get_rejected(self):
        self.assertEqual(self.client.get("/s/ime/ai").status_code, 405)

    def test_empty_text_rejected(self):
        response = self._post({"direction": "fwd", "text": "   "})
        self.assertEqual(response.status_code, 400)
        self.assertFalse(response.json()["success"])

    def test_bad_direction_rejected(self):
        response = self._post({"direction": "hack", "text": "你好"})
        self.assertEqual(response.status_code, 400)

    def test_not_json_rejected(self):
        response = self.client.post("/s/ime/ai", data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_fwd_stream_with_think(self):
        client = FakeClient([[
            _chunk(reasoning_content="想一下"),
            _chunk(content="Zu'u los jun"),
        ]])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "fwd", "text": "你是王"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertIn("<think>", body)
        self.assertIn("想一下", body)
        self.assertIn("</think>", body)
        self.assertIn("Zu'u los jun", body)
        self.assertTrue(body.index("</think>") < body.index("Zu'u los jun"))
        # 请求侧：system 提示词 + 用户文本 + 工具
        call = client.chat.completions.calls[0]
        self.assertEqual(call["messages"][0]["content"], ai_view.SYS_FWD)
        self.assertEqual(call["messages"][1]["content"], "你是王")
        self.assertEqual(call["temperature"], 0.2)
        self.assertEqual(call["tools"], ai_view.TOOLS)

    def test_tool_round_then_answer(self):
        client = FakeClient([
            [_tool_chunk(cid="c1", name="dict_lookup", args='{"queries": ["jun", "thur"]}')],
            [_chunk(content="王与霸主")],
        ])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "rev", "text": "jun thur"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("🔧 dict_lookup(jun, thur)", body)
        self.assertIn("King", body)            # jun 的词典结果进入思考流
        self.assertIn("Overlord", body)        # thur 的词典结果
        self.assertIn("</think>", body)
        self.assertIn("王与霸主", body)          # 第二轮正文
        second = client.chat.completions.calls[1]["messages"]
        self.assertEqual(second[-1]["role"], "tool")
        self.assertIn("King", second[-1]["content"])
        self.assertIn("Overlord", second[-1]["content"])

    def test_tool_single_query_backcompat(self):
        client = FakeClient([
            [_tool_chunk(cid="c1", name="dict_lookup", args='{"query": "jun"}')],
            [_chunk(content="王")],
        ])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "rev", "text": "jun"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("🔧 dict_lookup(jun)", body)
        self.assertIn("King", body)

    def test_text_truncated_to_cap(self):
        client = FakeClient([[_chunk(content="ok")]])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "fwd", "text": "龙" * 3000})
            self._body(response)
            msgs = client.chat.completions.calls[0]["messages"]
            self.assertEqual(len(msgs[1]["content"]), ai_view.MAX_TEXT_CHARS)
        self.assertEqual(len(client.chat.completions.calls[0]["messages"][1]["content"]), ai_view.MAX_TEXT_CHARS)

    def test_reasoning_only_then_forced_final_answer(self):
        """只思考不吐正文的轮次后，应强制无工具终答一轮。"""
        client = FakeClient([
            [_chunk(reasoning_content="只想不说")],
            [_chunk(content="被迫作答")],
        ])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "fwd", "text": "你好"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("<think>", body)
        self.assertIn("</think>", body)
        self.assertIn("被迫作答", body)
        # 终答轮不再携带工具
        self.assertNotIn("tools", client.chat.completions.calls[1])

    def test_all_rounds_empty_yields_fallback(self):
        """终答轮也空时，返回明确提示而非空响应。"""
        client = FakeClient([
            [_chunk(reasoning_content="只想不说")],
            [],
        ])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=client):
            response = self._post({"direction": "fwd", "text": "你好"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("</think>", body)
        self.assertIn("没吐出译文", body)

    def test_provider_error_yields_error_text(self):
        class Boom(FakeClient):
            def __init__(self):
                super().__init__([])
        with self._patch_providers(), mock.patch.object(ai_view, "_open_client", return_value=Boom()):
            response = self._post({"direction": "fwd", "text": "你好"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("AI 调用异常", body)

    def test_no_providers_returns_503(self):
        with mock.patch.object(ai_view, "fast_model_providers", return_value=[]):
            response = self._post({"direction": "fwd", "text": "你好"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])
