import json
import re
import traceback

from django.conf import settings
from django.core.cache import cache
from django.db import connections
from django.http import JsonResponse, StreamingHttpResponse
from django.shortcuts import render
from django.views.decorators.http import require_GET, require_POST
from mysite.ai_gateway import stream_chat_completion
from mysite.ai_models import full_model_providers
from mysite.cache_utils import client_ip, rate_limit_allows

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
EXCLUDED_TABLES = {"dovahwall_admin"}
ALLOWED_TABLES_CACHE_KEY = "agent:allowed_tables:v1"
SCHEMA_CACHE_KEY = "agent:schema:v1"
DISALLOWED_SQL = re.compile(
    r"\b(ALTER|ANALYZE|BENCHMARK|CALL|CREATE|DELETE|DO|DROP|GRANT|HANDLER|INSERT|INTO|KILL|LOAD_FILE|LOCK|OPTIMIZE|RENAME|REPLACE|REVOKE|SET|SLEEP|TRUNCATE|UNION|UNLOCK|UPDATE)\b",
    re.IGNORECASE,
)

# Redis-only conversation storage. One turn is one user message plus its
# assistant response (including any internal tool messages).
MAX_HISTORY_TURNS = 20


def _readonly_connection():
    if "agent_readonly" not in settings.DATABASES:
        raise RuntimeError("The read-only database account is not configured.")
    return connections["agent_readonly"]


def _allowed_tables(connection):
    cached = cache.get(ALLOWED_TABLES_CACHE_KEY)
    if cached is not None:
        return cached

    tables = sorted(
        table
        for table in connection.introspection.table_names()
        if table.startswith(TABLE_PREFIXES) and table not in EXCLUDED_TABLES
    )
    cache.set(ALLOWED_TABLES_CACHE_KEY, tables, timeout=60 * 60)
    return tables


def _schema(connection):
    cached = cache.get(SCHEMA_CACHE_KEY)
    if cached is not None:
        return cached

    schema = []
    with connection.cursor() as cursor:
        for table in _allowed_tables(connection):
            columns = connection.introspection.get_table_description(cursor, table)
            schema.append({"table": table,
                           "columns": [{"name": column.name, "type": str(column.type_code), "nullable": column.null_ok}
                                       for column in columns]})
    cache.set(SCHEMA_CACHE_KEY, schema, timeout=60 * 60)
    return schema


def _validate_readonly_sql(sql, allowed_tables, allowed_schema=None):
    sql = str(sql or "").strip()
    if not sql or len(sql) > 4000:
        raise ValueError("SQL must be between 1 and 4000 characters.")
    if ";" in sql or "--" in sql or "/*" in sql or "#" in sql or "\x00" in sql:
        raise ValueError("Only one SQL statement without comments is allowed.")
    if not re.match(r"^SELECT\b", sql, re.IGNORECASE):
        raise ValueError("Only SELECT statements are allowed.")
    if DISALLOWED_SQL.search(sql) or re.search(r"\bFOR\s+UPDATE\b", sql, re.IGNORECASE):
        raise ValueError("This query contains a disallowed SQL operation.")
    referenced = re.findall(
        r"\b(?:FROM|JOIN)\s+(?:(`?[A-Za-z0-9_]+`?)\s*\.\s*)?(`?[A-Za-z0-9_]+`?)",
        sql,
        re.IGNORECASE,
    )
    normalized = [
        (schema.strip("`") if schema else None, table.strip("`"))
        for schema, table in referenced
    ]
    if any(
        table not in allowed_tables
        or (schema is not None and schema != allowed_schema)
        for schema, table in normalized
    ):
        raise ValueError("The query references a table outside the approved schema.")
    if not re.search(r"\bLIMIT\s+\d+\b", sql, re.IGNORECASE):
        sql = "%s LIMIT 100" % sql
    return sql


def _run_readonly_query(sql):
    connection = _readonly_connection()
    allowed_tables = _allowed_tables(connection)
    sql = _validate_readonly_sql(
        sql,
        allowed_tables,
        allowed_schema=connection.settings_dict["NAME"],
    )
    with connection.cursor() as cursor:
        cursor.execute(sql)
        columns = [column[0] for column in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchmany(100)]
    return {"sql": sql, "row_count": len(rows), "rows": rows}


def _is_logged_in(request):
    return bool(request.session.get("info"))


def _conversation_key(request):
    user_id = request.session.get("info", {}).get("id")
    return f"agent:conversation:v1:user:{user_id}"


def _trim_to_last_turns(items):
    user_indexes = [index for index, item in enumerate(items) if item.get("role") == "user"]
    if len(user_indexes) <= MAX_HISTORY_TURNS:
        return items
    return items[user_indexes[-MAX_HISTORY_TURNS]:]


def _load_conversation(request):
    state = cache.get(_conversation_key(request))
    if not isinstance(state, dict):
        return {"messages": [], "transcript": []}
    return {
        "messages": _trim_to_last_turns(state.get("messages", [])),
        "transcript": _trim_to_last_turns(state.get("transcript", [])),
    }


def _save_conversation(request, messages, transcript):
    state = {
        "messages": _trim_to_last_turns(messages),
        "transcript": _trim_to_last_turns(transcript),
    }
    # No timeout: history remains in Redis until cleared or evicted by LRU.
    # It is intentionally never copied into the database-backed session.
    cache.set(_conversation_key(request), state, timeout=None)
    return sum(1 for item in state["transcript"] if item.get("role") == "user")


def agent_page(request):
    return render(
        request,
        "agent.html",
        {"agent_is_authenticated": _is_logged_in(request)},
    )


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
    cache.delete(_conversation_key(request))
    return JsonResponse({"message": "已清空对话记忆。", "turn_count": 0, "max_turns": MAX_HISTORY_TURNS})


@require_GET
def history(request):
    if not _is_logged_in(request):
        return JsonResponse({"error": "Please log in again."}, status=401)

    state = _load_conversation(request)
    transcript = state["transcript"]
    response = JsonResponse({
        "messages": transcript,
        "turn_count": sum(1 for item in transcript if item.get("role") == "user"),
        "max_turns": MAX_HISTORY_TURNS,
    })
    response["Cache-Control"] = "no-store"
    return response


@require_POST
def chat(request):
    if not _is_logged_in(request):
        return JsonResponse({"error": "Please log in again."}, status=401)

    info = request.session.get("info", {})
    identity = info.get("id") or client_ip(request)
    if not rate_limit_allows("agent_chat", identity, limit=20, period=60):
        return JsonResponse({"error": "请求过于频繁，请稍后再试。"}, status=429)

    try:
        message = str(json.loads(request.body).get("message", "")).strip()
    except (TypeError, ValueError):
        return JsonResponse({"error": "Invalid request body."}, status=400)

    if not message or len(message) > 2000:
        return JsonResponse({"error": "Message must be between 1 and 2000 characters."}, status=400)

    try:
        providers = full_model_providers()
    except ValueError as exc:
        return JsonResponse({"error": str(exc)}, status=503)
    if not providers:
        return JsonResponse({"error": "Assistant provider chain is not configured."}, status=503)

    def event_stream():
        state = _load_conversation(request)
        history = _trim_to_last_turns(
            state["messages"] + [{"role": "user", "content": message}]
        )
        transcript = _trim_to_last_turns(
            state["transcript"] + [{"role": "user", "content": message}]
        )

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history
        visible_assistant_content = ""
        stream_error = None

        try:
            for _ in range(10):
                response = stream_chat_completion(
                    providers,
                    messages=messages,
                    tools=TOOLS,
                    tool_choice="auto",
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
                        visible_assistant_content += delta.content
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
                stream_error = "The assistant exceeded its tool-call limit."

        except Exception as e:
            traceback.print_exc()
            stream_error = f"服务或接口异常: {str(e)}"
        finally:
            if visible_assistant_content:
                transcript.append({"role": "assistant", "content": visible_assistant_content})
            turn_count = _save_conversation(request, history, transcript)

        if stream_error:
            yield f"data: {json.dumps({'error': stream_error, 'turn_count': turn_count, 'max_turns': MAX_HISTORY_TURNS}, ensure_ascii=False)}\n\n"
        else:
            yield f"data: {json.dumps({'done': True, 'turn_count': turn_count, 'max_turns': MAX_HISTORY_TURNS})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream; charset=utf-8')
    response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response['X-Accel-Buffering'] = 'no'
    return response
