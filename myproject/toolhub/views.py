# -*- coding: utf-8 -*-
"""toolhub 视图：工具包装页 + 通用 AI 端点。

AI 端点与 dovime /s/ime/ai 同一模式（fast 档供应商轮询、<think> 思考流、
text/plain 流式、nginx 需 uwsgi_buffering off），但 system_prompt/temperature/
max_tokens 来自各工具自己的 tool.json —— 新工具要 LLM 只需在清单里写
ai 配置，零后端代码。
"""
import json

from django.http import Http404, JsonResponse, StreamingHttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST

from mysite.ai_models import fast_model_providers

from . import registry

MAX_TEXT_CHARS = 4000
MAX_MESSAGES = 20
AI_ROLES = ("user", "assistant")


def _open_client(provider):
    from openai import OpenAI

    return OpenAI(
        api_key=provider["api_key"],
        base_url=provider["base_url"],
        timeout=provider.get("timeout", 15.0),
        max_retries=provider.get("max_retries", 0),
    )


@ensure_csrf_cookie
def tool_page(request, tool_id):
    """工具包装页：站点壳 + iframe 载入 /static/tools/<id>/index.html。"""
    tool = registry.get_tool(tool_id)
    if tool is None or tool["kind"] != "app":
        raise Http404("tool not found")
    manifest = registry.get_manifest(tool_id) or {}
    if manifest.get("bare"):
        return redirect("/static/tools/%s/index.html" % tool_id)
    return render(request, "toolhub/wrapper.html", {"tool": tool, "manifest": manifest})


def _build_messages(data, ai):
    """POST 体 → OpenAI messages。支持 {text} 单发与 {messages:[...]} 多轮。"""
    messages = [{"role": "system", "content": ai["system_prompt"]}]

    raw_msgs = data.get("messages")
    if isinstance(raw_msgs, list) and raw_msgs:
        for item in raw_msgs[-MAX_MESSAGES:]:
            if not isinstance(item, dict):
                continue
            role = item.get("role")
            content = item.get("content")
            if role not in AI_ROLES or not isinstance(content, str) or not content.strip():
                continue
            messages.append({"role": role, "content": content[:MAX_TEXT_CHARS]})
        if len(messages) == 1:
            raise ValueError("messages 里没有可用的 user/assistant 消息")
        return messages

    text = str(data.get("text", ""))[:MAX_TEXT_CHARS].strip()
    if not text:
        raise ValueError("内容不能为空")
    messages.append({"role": "user", "content": text})
    return messages


@require_POST
def tool_ai(request, tool_id):
    """POST {text} 或 {messages:[{role,content}]} → text/plain 流式。"""
    tool = registry.get_tool(tool_id)
    manifest = registry.get_manifest(tool_id) if tool else None
    if tool is None or not (manifest or {}).get("ai"):
        return JsonResponse({"success": False, "error": "该工具未启用 AI"}, status=404)

    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "请求体不是合法 JSON"}, status=400)
    if not isinstance(data, dict):
        return JsonResponse({"success": False, "error": "请求体必须是 JSON 对象"}, status=400)

    ai = manifest["ai"]
    try:
        messages = _build_messages(data, ai)
    except ValueError as exc:
        return JsonResponse({"success": False, "error": str(exc)}, status=400)

    providers = fast_model_providers()
    if not providers:
        return JsonResponse(
            {"success": False, "error": "站点 AI 未配置（ai_config.yaml 无可用供应商）"},
            status=503,
        )

    def generate():
        state = {"produced": False, "in_think": False, "closed": False}
        failures = []

        for provider in providers:
            try:
                client = _open_client(provider)
                stream = client.chat.completions.create(
                    model=provider["model"],
                    stream=True,
                    temperature=ai["temperature"],
                    max_tokens=ai["max_tokens"],
                    messages=messages,
                )
                for chunk in stream:
                    if not chunk.choices:
                        continue
                    delta = chunk.choices[0].delta
                    reasoning = getattr(delta, "reasoning_content", None)
                    if reasoning:
                        if not state["in_think"]:
                            state["in_think"] = True
                            yield "\n<think>\n"
                        state["produced"] = True
                        yield str(reasoning)
                    content = getattr(delta, "content", None)
                    if content:
                        if state["in_think"] and not state["closed"]:
                            state["closed"] = True
                            yield "\n</think>\n\n"
                        state["produced"] = True
                        yield str(content)
                if state["in_think"] and not state["closed"]:
                    state["closed"] = True
                    yield "\n</think>\n"
                if state["produced"]:
                    return
            except Exception as exc:
                if state["produced"]:
                    return  # 已流出部分正文，不重复追发
                failures.append("%s: %s" % (provider.get("name", "?"), exc))
                print("[toolhub %s AI stream failed] %s" % (tool_id, exc))
                continue

        if state["in_think"] and not state["closed"]:
            yield "\n</think>\n"
        detail = "; ".join(failures) or "no providers configured"
        yield "\n[AI 调用异常：All AI providers failed: %s]" % detail

    response = StreamingHttpResponse(generate(), content_type="text/plain; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["X-Accel-Buffering"] = "no"
    return response
