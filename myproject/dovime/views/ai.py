"""龙语输入法 AI 翻译接口。

走站点统一 AI 网关（ai_config.yaml），默认 fast 轻量档；
前端不再接触任何 API Key。系统提示词与前端离线引擎的
SYS_FWD / SYS_REV 保持同口径（见 app/app.js）。
"""
import json

from django.http import JsonResponse, StreamingHttpResponse
from django.views.decorators.http import require_POST

from mysite.ai_gateway import stream_chat_completion
from mysite.ai_models import fast_model_providers

SYS_FWD = (
    "你是《上古卷轴5》龙语(Dovahzul)输入法的翻译前置模块。把用户的中文译成英语，"
    "且英文必须按龙语习惯组织，供逐词查龙语词典使用：1) 一律陈述语序（主语+动词+其余），"
    "疑问句绝不倒装——龙语疑问句就是陈述语序，例如「你是谁」译为 You are who，"
    "「他在哪」译为 He is where；2) 不用任何冠词 a/an/the；3) 不用缩写；"
    "物主用 my/your/his/her；名词复数直接加 s；4) 时态用助词明示：将来加 will、过去加 did、"
    "完成用 have+过去分词；5) 只用最基础、具象的常见词（火、天空、国王、灵魂这类），"
    "避免抽象词与俚语，逐词对应、不增删内容；6) 只输出这一句英文本身，不加任何解释。"
)
SYS_REV = "下面是龙语句子逐词的英文释义，把它连成一句通顺自然的中文，保持原意、不增删内容，只输出这一句中文。"

MAX_TEXT_CHARS = 2000


@require_POST
def translate(request):
    """POST {direction: 'fwd'|'rev', text: str} → text/plain 流式译文。"""
    try:
        data = json.loads(request.body or "{}")
    except json.JSONDecodeError:
        return JsonResponse({"success": False, "error": "请求体不是合法 JSON"}, status=400)

    direction = data.get("direction", "fwd")
    if direction not in ("fwd", "rev"):
        return JsonResponse({"success": False, "error": "direction 只能是 fwd 或 rev"}, status=400)

    text = str(data.get("text", ""))[:MAX_TEXT_CHARS].strip()
    if not text:
        return JsonResponse({"success": False, "error": "内容不能为空"}, status=400)

    providers = fast_model_providers()
    if not providers:
        return JsonResponse(
            {"success": False, "error": "站点 AI 未配置（ai_config.yaml 无可用供应商）"},
            status=503,
        )

    messages = [
        {"role": "system", "content": SYS_FWD if direction == "fwd" else SYS_REV},
        {"role": "user", "content": text},
    ]

    def generate():
        try:
            for chunk in stream_chat_completion(
                providers, messages=messages, temperature=0.2, max_tokens=500
            ):
                if chunk.choices and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        except Exception as exc:
            yield "\n[AI 调用异常：" + str(exc) + "]"

    response = StreamingHttpResponse(generate(), content_type="text/plain; charset=utf-8")
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response["X-Accel-Buffering"] = "no"
    return response
