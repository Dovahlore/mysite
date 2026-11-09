# -*- coding: utf-8 -*-
"""toolhub 测试：注册表发现/校验、工具墙渲染、包装页、通用 AI 端点（mock OpenAI 客户端）。

全部 SimpleTestCase —— 不碰数据库。
"""
import json
import os
import shutil
import tempfile
from types import SimpleNamespace
from unittest import mock

from django.template import Context, Template
from django.test import SimpleTestCase

from toolhub import registry, views as toolhub_views


def _chunk(**kw):
    delta = SimpleNamespace(
        content=kw.get("content"),
        reasoning_content=kw.get("reasoning_content"),
    )
    return SimpleNamespace(choices=[SimpleNamespace(delta=delta)])


class FakeCompletions:
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


def _write_tool(root, tool_id, manifest, with_index=True):
    folder = os.path.join(root, tool_id)
    os.makedirs(folder)
    with open(os.path.join(folder, "tool.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False)
    if with_index:
        with open(os.path.join(folder, "index.html"), "w", encoding="utf-8") as f:
            f.write("<!DOCTYPE html><html><body>tool</body></html>")
    return folder


class RegistryScanTests(SimpleTestCase):
    """对临时目录跑 _scan，验证 drop-in 发现与校验规则。"""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="toolhub_test_")
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)

    def test_scan_finds_valid_folder_tool(self):
        _write_tool(self.tmp, "demo", {"name": "演示", "description": "desc", "order": 300})
        tools, manifests = registry._scan(self.tmp)
        app = [t for t in tools if t["kind"] == "app"]
        self.assertEqual(len(app), 1)
        self.assertEqual(app[0]["id"], "demo")
        self.assertEqual(app[0]["url"], "/s/t/demo/")
        self.assertFalse(app[0]["has_ai"])
        self.assertIn("demo", manifests)

    def test_scan_bare_tool_links_static(self):
        _write_tool(self.tmp, "bare1", {"name": "裸", "bare": True})
        tools, _ = registry._scan(self.tmp)
        app = [t for t in tools if t["kind"] == "app"]
        self.assertEqual(app[0]["url"], "/static/tools/bare1/index.html")

    def test_scan_skips_invalid(self):
        _write_tool(self.tmp, "BadName", {"name": "大写"})          # 目录名不合法
        _write_tool(self.tmp, "nojson", {"name": "x"}, with_index=False)  # 无 index.html
        _write_tool(self.tmp, "badprompt", {"name": "x", "ai": {"temperature": 0.5}})  # ai 无 system_prompt
        _write_tool(self.tmp, "longdesc", {"name": "x", "description": "d" * 200})
        _write_tool(self.tmp, "_common", {"name": "下划线跳过"})    # 共享目录不算工具
        open(os.path.join(self.tmp, "stray.txt"), "w").close()       # 普通文件不算
        tools, manifests = registry._scan(self.tmp)
        self.assertEqual([t for t in tools if t["kind"] == "app"], [])
        self.assertEqual(manifests, {})

    def test_scan_ai_config_normalized(self):
        _write_tool(self.tmp, "aigame", {
            "name": "AI 游戏",
            "ai": {"system_prompt": "你是点评员。", "temperature": 9, "max_tokens": 10},
        })
        _, manifests = registry._scan(self.tmp)
        ai = manifests["aigame"]["ai"]
        self.assertEqual(ai["system_prompt"], "你是点评员。")
        self.assertEqual(ai["temperature"], 2.0)   # 钳到 [0, 2]
        self.assertEqual(ai["max_tokens"], 64)     # 钳到 [64, 4000]

    def test_scan_icon_img_path_rejected(self):
        _write_tool(self.tmp, "evil", {"name": "x", "icon_img": "../../etc/passwd"})
        tools, manifests = registry._scan(self.tmp)
        self.assertEqual([t for t in tools if t["kind"] == "app"], [])
        self.assertEqual(manifests, {})

    def test_scan_id_conflict_with_link_skipped(self):
        _write_tool(self.tmp, "portainer", {"name": "撞车"})
        tools, _ = registry._scan(self.tmp)
        self.assertEqual(len([t for t in tools if t["id"] == "portainer"]), 1)  # 只剩 link 条目


class ShippedToolTests(SimpleTestCase):
    """随包发布的 g2048 示例 + link 条目合并结果。"""

    def test_list_tools_contains_links_and_demo(self):
        ids = [t["id"] for t in registry.list_tools()]
        for link_id in ("assistant", "dovime", "deepseek", "portainer", "g2048"):
            self.assertIn(link_id, ids)
        g2048 = registry.get_tool("g2048")
        self.assertEqual(g2048["url"], "/s/t/g2048/")
        self.assertTrue(g2048["has_ai"])

    def test_tools_sorted_by_order(self):
        tools = registry.list_tools()
        orders = [t.get("order", 500) for t in tools]
        self.assertEqual(orders, sorted(orders))

    def test_get_manifest_g2048(self):
        m = registry.get_manifest("g2048")
        self.assertEqual(m["name"], "2048")
        self.assertTrue(m["has_ai"])
        self.assertIn("system_prompt", m["ai"])

    def test_get_unknown_returns_none(self):
        self.assertIsNone(registry.get_tool("nope"))
        self.assertIsNone(registry.get_manifest("nope"))


class WallTagTests(SimpleTestCase):
    def test_tool_wall_renders_cards(self):
        out = Template("{% load toolhub_tags %}{% tool_wall %}").render(Context({}))
        self.assertIn('class="tool-card"', out)
        self.assertIn("龙语输入法", out)
        self.assertIn("/s/t/g2048/", out)
        self.assertIn("portainer.dovahwall.cn", out)
        self.assertIn("fas fa-gamepad", out)
        self.assertIn("ime/img/skyrim_logo_light.png", out)


class PageTests(SimpleTestCase):
    def test_wrapper_page_renders(self):
        response = self.client.get("/s/t/g2048/")
        self.assertEqual(response.status_code, 200)
        body = response.content.decode("utf-8")
        self.assertIn("/static/tools/g2048/index.html", body)
        self.assertIn("2048", body)

    def test_unknown_tool_404(self):
        self.assertEqual(self.client.get("/s/t/nope/").status_code, 404)

    def test_link_tool_has_no_page(self):
        self.assertEqual(self.client.get("/s/t/portainer/").status_code, 404)


class AiEndpointTests(SimpleTestCase):
    def _post(self, tool_id, payload):
        return self.client.post("/s/t/%s/ai" % tool_id, data=payload, content_type="application/json")

    @staticmethod
    def _body(response):
        return b"".join(response.streaming_content).decode("utf-8")

    def _patch_providers(self):
        return mock.patch.object(toolhub_views, "fast_model_providers", return_value=[{
            "name": "p", "api_key": "k", "base_url": "http://x", "model": "m", "timeout": 1, "max_retries": 0,
        }])

    def test_get_rejected(self):
        self.assertEqual(self.client.get("/s/t/g2048/ai").status_code, 405)

    def test_unknown_tool_404(self):
        self.assertEqual(self._post("nope", {"text": "hi"}).status_code, 404)

    def test_tool_without_ai_404(self):
        self.assertEqual(self._post("portainer", {"text": "hi"}).status_code, 404)

    def test_empty_text_rejected(self):
        self.assertEqual(self._post("g2048", {"text": "   "}).status_code, 400)

    def test_not_json_rejected(self):
        response = self.client.post("/s/t/g2048/ai", data="not json", content_type="application/json")
        self.assertEqual(response.status_code, 400)

    def test_messages_without_valid_items_rejected(self):
        response = self._post("g2048", {"messages": [{"role": "system", "content": "hack"}]})
        self.assertEqual(response.status_code, 400)

    def test_stream_with_think(self):
        client = FakeClient([[
            _chunk(reasoning_content="想一下"),
            _chunk(content="好棋！"),
        ]])
        with self._patch_providers(), mock.patch.object(toolhub_views, "_open_client", return_value=client):
            response = self._post("g2048", {"text": "得分 100"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertIn("<think>", body)
        self.assertIn("</think>", body)
        self.assertIn("好棋！", body)
        self.assertLess(body.index("</think>"), body.index("好棋！"))
        # 请求侧：system 提示词来自 tool.json，参数也来自清单
        manifest = registry.get_manifest("g2048")
        call = client.chat.completions.calls[0]
        self.assertEqual(call["messages"][0]["content"], manifest["ai"]["system_prompt"])
        self.assertEqual(call["messages"][-1]["content"], "得分 100")
        self.assertEqual(call["temperature"], manifest["ai"]["temperature"])
        self.assertEqual(call["max_tokens"], manifest["ai"]["max_tokens"])

    def test_messages_passthrough(self):
        client = FakeClient([[_chunk(content="好")]])
        msgs = [
            {"role": "user", "content": "第一轮"},
            {"role": "assistant", "content": "答"},
            {"role": "user", "content": "第二轮"},
        ]
        with self._patch_providers(), mock.patch.object(toolhub_views, "_open_client", return_value=client):
            response = self._post("g2048", {"messages": msgs})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("好", body)
        sent = client.chat.completions.calls[0]["messages"]
        self.assertEqual([m["role"] for m in sent], ["system", "user", "assistant", "user"])
        self.assertEqual(sent[3]["content"], "第二轮")

    def test_provider_error_yields_error_text(self):
        client = FakeClient([])  # create 直接抛 no more rounds
        with self._patch_providers(), mock.patch.object(toolhub_views, "_open_client", return_value=client):
            response = self._post("g2048", {"text": "hi"})
            body = self._body(response)
        self.assertEqual(response.status_code, 200)
        self.assertIn("[AI 调用异常：All AI providers failed:", body)

    def test_no_providers_returns_503(self):
        with mock.patch.object(toolhub_views, "fast_model_providers", return_value=[]):
            response = self._post("g2048", {"text": "hi"})
        self.assertEqual(response.status_code, 503)
