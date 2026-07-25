from django.views.decorators.http import require_POST
from django.http import JsonResponse, StreamingHttpResponse
from openai import OpenAI
import json
import os
# ====================z AI 润色配置区 =====================
@require_POST
def api_common_ai_polish(request):
    """【通用流式】AI 评价润色接口 (支持番剧、电影、漫画等)"""
    try:
        data = json.loads(request.body)
        raw_text = data.get('text', '').strip()
        title = data.get('title', '该作品').strip() or '该作品'
        work_context = str(data.get('context', '')).strip()[:6000]

        # 前置校验，如果出错了直接回传普通 JSON
        if not raw_text:
            return JsonResponse({'success': False, 'error': '评论内容不能为空哦'})

        api_key = os.environ.get("OPENAI_API_KEY")
        base_url = os.environ.get("OPENAI_BASE_URL") or None
        model = os.environ.get("OPENAI_MODEL", "qwen3.7-max")
        if not api_key:
            return JsonResponse(
                {'success': False, 'error': 'AI polish is not configured: set OPENAI_API_KEY.'},
                status=503,
            )

        client = OpenAI(api_key=api_key, base_url=base_url)

        system_prompt = (
            f"你是一个资深的影视与二次元编辑。请帮用户润色他对《{title}》的评价，并完成补充扩展，类似豆瓣影评评价，使得更加顺畅。词藻一定简练凝缩，不要浮夸的言语，也不要太高级的词语。"
            f"要求：修正错别字，让语言更通顺流畅，不要让你的润色修改用户当前对这部作品评价的思考与意见。另外，请务必贴合《{title}》这部作品的背景和调性。"
            f"注意：绝对不要改变原意，不要输出额外对话，直接输出润色后的内容。"
        )

        polish_messages = [{"role": "system", "content": system_prompt}]
        if work_context:
            polish_messages.append({
                "role": "system",
                "content": (
                    "以下是当前页面已有的作品资料。请结合这些资料润色，"
                    "不要虚构资料中没有的信息：\n" + work_context
                ),
            })
        polish_messages.append({"role": "user", "content": raw_text})

        # 定义一个生成器函数，用来不断产出文字碎片
        def generate_stream():
            try:
                response = client.chat.completions.create(
                    model=model,
                    messages=polish_messages,
                    temperature=0.6,
                    max_tokens=800,

                    stream=True  # 🌟 核心：开启大模型的流式输出
                )

                for chunk in response:
                    # 提取每一个 chunk 里的内容并 yield 出去
                    if chunk.choices and chunk.choices[0].delta.content:
                        yield chunk.choices[0].delta.content
            except Exception as e:
                # 如果大模型中途断联报错，把错误信息也打在屏幕上
                yield f"\n[AI 润色发生异常：{str(e)}]"

        # 🌟 返回流式响应，指定 Content-Type 为 plain text
        response = StreamingHttpResponse(
            generate_stream(),
            content_type='text/plain; charset=utf-8',
        )
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['X-Accel-Buffering'] = 'no'
        return response

    except Exception as e:
        import traceback
        traceback.print_exc()
        return JsonResponse({'success': False, 'error': 'AI 润色接口解析出错：' + str(e)})
