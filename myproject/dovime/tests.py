"""dovime（龙语输入法）测试：页面渲染、静态资源、AI 接口（mock 统一网关）。

全部用 SimpleTestCase —— 不碰数据库，可随 `manage.py test` 在容器内运行。
"""
from types import SimpleNamespace
from unittest import mock

from django.contrib.staticfiles import finders
from django.test import SimpleTestCase

from dovime.views import ai as ai_view


def _chunk(text):
    return SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=text))])


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

    def test_static_assets_exist(self):
        for rel in (
            "ime/js/font.js",
            "ime/js/data.js",
            "ime/js/ref.js",
            "ime/js/core.js",
            "ime/js/app.js",
            "ime/font/dragon_alphabet.ttf",
            "ime/img/skyrim_logo_light.png",
        ):
            self.assertTrue(finders.find(rel), f"缺少静态资源 {rel}")


class AiEndpointTests(SimpleTestCase):
    def _post(self, payload):
        return self.client.post("/s/ime/ai", data=payload, content_type="application/json")

    @staticmethod
    def _body(response):
        return b"".join(response.streaming_content).decode("utf-8")

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

    def test_fwd_uses_sys_fwd_prompt(self):
        captured = {}

        def fake_stream(providers, messages, **kwargs):
            captured["providers"] = providers
            captured["messages"] = messages
            captured["kwargs"] = kwargs
            yield _chunk("You ")
            yield _chunk("are dragon")

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=fake_stream):
            response = self._post({"direction": "fwd", "text": "你是龙"})
            body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertEqual(body, "You are dragon")
        self.assertEqual(captured["messages"][0]["role"], "system")
        self.assertEqual(captured["messages"][0]["content"], ai_view.SYS_FWD)
        self.assertEqual(captured["messages"][1]["role"], "user")
        self.assertEqual(captured["messages"][1]["content"], "你是龙")
        self.assertEqual(captured["kwargs"]["temperature"], 0.2)
        self.assertNotIn("max_tokens", captured["kwargs"])  # 不限思考预算，正文前会流式输出 <think>

    def test_rev_uses_sys_rev_prompt(self):
        captured = {}

        def fake_stream(providers, messages, **kwargs):
            captured["messages"] = messages
            yield _chunk("力量·平衡·推离")

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=fake_stream):
            response = self._post({"direction": "rev", "text": "force balance push"})
            body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("力量", body)
        self.assertEqual(captured["messages"][0]["content"], ai_view.SYS_REV)
        self.assertEqual(captured["messages"][1]["content"], "force balance push")

    def test_text_truncated_to_cap(self):
        captured = {}

        def fake_stream(providers, messages, **kwargs):
            captured["messages"] = messages
            yield _chunk("ok")

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=fake_stream):
            response = self._post({"direction": "fwd", "text": "龙" * 3000})
            self._body(response)

        self.assertEqual(len(captured["messages"][1]["content"]), ai_view.MAX_TEXT_CHARS)

    def test_no_providers_returns_503(self):
        with mock.patch.object(ai_view, "fast_model_providers", return_value=[]):
            response = self._post({"direction": "fwd", "text": "你好"})
        self.assertEqual(response.status_code, 503)
        self.assertFalse(response.json()["success"])

    def test_stream_error_yields_error_text(self):
        def broken_stream(providers, messages, **kwargs):
            yield _chunk("部分")
            raise RuntimeError("boom")

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=broken_stream):
            response = self._post({"direction": "fwd", "text": "你好"})
            body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("AI 调用异常", body)

    def test_reasoning_streamed_inside_think_block(self):
        """推理型模型：思考包在 <think>…</think> 里先流，正文随后。"""

        def mixed_stream(providers, messages, **kwargs):
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=None, reasoning_content="正在分析释义，"))]
            )
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=None, reasoning_content="这是个人名。"))]
            )
            yield _chunk("我的名字叫王楚钦。")

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=mixed_stream):
            response = self._post({"direction": "rev", "text": "My, mine · Call, Name"})
            body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("<think>", body)
        self.assertIn("</think>", body)
        self.assertIn("正在分析释义，", body)
        self.assertIn("这是个人名。", body)
        self.assertTrue(body.index("</think>") < body.index("我的名字叫王楚钦。"))

    def test_reasoning_only_stream_yields_fallback_hint(self):
        """只吐思考不吐正文时：闭块后给明确提示而非空响应。"""

        def reasoning_only_stream(providers, messages, **kwargs):
            yield SimpleNamespace(
                choices=[SimpleNamespace(delta=SimpleNamespace(content=None, reasoning_content="想了很久"), finish_reason=None)]
            )

        with mock.patch.object(ai_view, "fast_model_providers", return_value=[{"name": "p"}]), \
                mock.patch.object(ai_view, "stream_chat_completion", side_effect=reasoning_only_stream):
            response = self._post({"direction": "rev", "text": "My, mine · Call, Name"})
            body = self._body(response)

        self.assertEqual(response.status_code, 200)
        self.assertIn("<think>", body)
        self.assertIn("</think>", body)
        self.assertIn("没吐出译文", body)
