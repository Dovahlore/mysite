import json
import os
import re
import traceback

from django.conf import settings
from django.db import connections
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import redirect, render
from django.views.decorators.http import require_POST
from openai import OpenAI

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_database_schema",
            "description": "Read the schema for the site's approved application tables before writing a database query.",
            "parameters": {"type": "object", "properties": {}, "additionalProperties": False},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_site_database",
            "description": "Run one read-only SELECT query against the approved site tables. Use get_database_schema first. Never use write SQL.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {"type": "string", "description": "One SELECT statement using only approved table names"}},
                "required": ["sql"],
                "additionalProperties": False,
            },
        },
    }
]

SYSTEM_PROMPT = """You are the private Dovahlore site assistant. Use tools for site data requests.
For database questions, call get_database_schema first, then query_site_database. Never attempt write SQL.
Only answer requests supported by the supplied tools. Be concise and answer in Chinese. Use Markdown formatting for lists and code blocks."""

TABLE_PREFIXES = ("dovahbase_", "dovahwall_", "dovahride_")
DISALLOWED_SQL = re.compile(
    r"\b(ALTER|ANALYZE|BENCHMARK|CALL|CREATE|DELETE|DO|DROP|GRANT|HANDLER|INSERT|INTO|KILL|LOAD_FILE|LOCK|OPTIMIZE|RENAME|REPLACE|REVOKE|SET|SLEEP|TRUNCATE|UNION|UNLOCK|UPDATE)\b",
    re.IGNORECASE,
)

# 最多保留多少条对话历史
MAX_HISTORY_MESSAGES = 20


def _readonly_connection():
    if "agent_readonly" not in settings.DATABASES:
        raise RuntimeError("The read-only database account is not configured.")
    return connections["agent_readonly"]


def _allowed_tables(connection):
    return sorted(table for table in connection.introspection.table_names() if table.startswith(TABLE_PREFIXES))


def _schema(connection):
    schema = []
    with connection.cursor() as cursor:
        for table in _allowed_tables(connection):
            columns = connection.introspection.get_table_description(cursor, table)
            schema.append({"table": table,
                           "columns": [{"name": column.name, "type": str(column.type_code), "nullable": column.null_ok}
                                       for column in columns]})
    return schema


def _validate_readonly_sql(sql, allowed_tables):
    sql = str(sql or "").strip()
    if not sql or len(sql) > 4000:
        raise ValueError("SQL must be between 1 and 4000 characters.")
    if ";" in sql or "--" in sql or "/*" in sql or "#" in sql or "\x00" in sql:
        raise ValueError("Only one SQL statement without comments is allowed.")
    if not re.match(r"^SELECT\b", sql, re.IGNORECASE):
        raise ValueError("Only SELECT statements are allowed.")
    if DISALLOWED_SQL.search(sql) or re.search(r"\bFOR\s+UPDATE\b", sql, re.IGNORECASE):
        raise ValueError("This query contains a disallowed SQL operation.")
    referenced = re.findall(r"\b(?:FROM|JOIN)\s+`?([A-Za-z0-9_]+)`?", sql, re.IGNORECASE)
    if any(table not in allowed_tables for table in referenced):
        raise ValueError("The query references a table outside the approved schema.")
    if not re.search(r"\bLIMIT\s+\d+\b", sql, re.IGNORECASE):
        sql = "%s LIMIT 100" % sql
    return sql


def _run_readonly_query(sql):
    connection = _readonly_connection()
    allowed_tables = _allowed_tables(connection)
    sql = _validate_readonly_sql(sql, allowed_tables)
    with connection.cursor() as cursor:
        cursor.execute(sql)
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchmany(100)]
    return {"sql": sql, "row_count": len(rows), "rows": rows}


def _is_logged_in(request):
    return bool(request.session.get("info"))


def agent_page(request):
    if not _is_logged_in(request):
        return redirect("/s/login?next=/s/agent")
    return render(request, "agent.html")


def _tool_result(request, name, arguments):
    if name == "get_database_schema":
        return {"tables": _schema(_readonly_connection())}, None

    if name == "query_site_database":
        return _run_readonly_query(arguments.get("sql")), None

    return {"error": "unsupported tool"}, None


@require_POST
def clear_history(request):
    """清空多轮对话上下文记录"""
    if not _is_logged_in(request):
        return JsonResponse({"error": "Please log in again."}, status=401)
    request.session.pop("agent_chat_history", None)
    request.session.modified = True
    return JsonResponse({"message": "已清空对话记忆。"})


@require_POST
def chat(request):
    if not _is_logged_in(request):
        return JsonResponse({"error": "Please log in again."}, status=401)

    try:
        message = str(json.loads(request.body).get("message", "")).strip()
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid request body."}, status=400)

    if not message or len(message) > 2000:
        return JsonResponse({"error": "Message must be between 1 and 2000 characters."}, status=400)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return JsonResponse({"error": "Assistant is not configured: set OPENAI_API_KEY in the web container."},
                            status=503)

    client = OpenAI(api_key=api_key, base_url=os.environ.get("OPENAI_BASE_URL") or None)
    model = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

    def event_stream():
        # 获取多轮对话历史
        history = request.session.get("agent_chat_history", [])
        history.append({"role": "user", "content": message})

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

        try:
            for _ in range(10):
                response = client.chat.completions.create(
                    model=model, messages=messages, tools=TOOLS, tool_choice="auto", stream=True
                )

                tool_calls_dict = {}
                has_tool_calls = False
                role = "assistant"
                assistant_content = ""

                for chunk in response:
                    if not getattr(chunk, "choices", None) or len(chunk.choices) == 0:
                        continue

                    delta = chunk.choices[0].delta
                    if delta.role:
                        role = delta.role

                    if delta.content:
                        assistant_content += delta.content
                        yield f"data: {json.dumps({'content': delta.content}, ensure_ascii=False)}\n\n"

                    if delta.tool_calls:
                        has_tool_calls = True
                        for tc in delta.tool_calls:
                            idx = tc.index
                            if idx not in tool_calls_dict:
                                tool_calls_dict[idx] = {
                                    "id": tc.id, "type": "function",
                                    "function": {"name": tc.function.name or "", "arguments": ""}
                                }
                            if tc.function and tc.function.arguments:
                                tool_calls_dict[idx]["function"]["arguments"] += tc.function.arguments

                assistant_msg = {
                    "role": role,
                    "content": assistant_content or None,
                    "tool_calls": list(tool_calls_dict.values()) if has_tool_calls else None
                }
                assistant_msg = {k: v for k, v in assistant_msg.items() if v is not None}

                messages.append(assistant_msg)
                history.append(assistant_msg)

                if not has_tool_calls:
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break

                for tc in tool_calls_dict.values():
                    try:
                        arguments = json.loads(tc["function"]["arguments"] or "{}")
                    except json.JSONDecodeError:
                        arguments = {}

                    try:
                        result, _ = _tool_result(request, tc["function"]["name"], arguments)
                    except (RuntimeError, ValueError) as error:
                        result = {"error": str(error)}

                    tool_msg = {
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": json.dumps(result, ensure_ascii=False, default=str)
                    }
                    messages.append(tool_msg)
                    history.append(tool_msg)
            else:
                yield f"data: {json.dumps({'error': 'The assistant exceeded its tool-call limit.'})}\n\n"

        except Exception as e:
            traceback.print_exc()
            yield f"data: {json.dumps({'error': f'服务或接口异常: {str(e)}'}, ensure_ascii=False)}\n\n"
        finally:
            request.session["agent_chat_history"] = history[-MAX_HISTORY_MESSAGES:]
            request.session.save()

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream; charset=utf-8')
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['X-Accel-Buffering'] = 'no'
    return response