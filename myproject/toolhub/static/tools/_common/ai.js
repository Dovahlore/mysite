/* toolhub 通用 AI 调用助手（drop-in 工具共享脚本，放 static/tools/_common/）。
 *
 * 用法（在工具的 index.html 里）：
 *   <script src="../_common/ai.js"></script>
 *   ToolHubAI.ask("你好")                      → Promise<完整文本>（含 <think> 段）
 *   ToolHubAI.askStream("你好", fn)            → 流式回调 fn(chunk)
 *   ToolHubAI.askMessages([{role:"user",content:"..."}, ...])   // 多轮
 *   ToolHubAI.askMessagesStream(messages, fn)
 *
 * 端点按约定从当前路径推导：/static/tools/<id>/… → /s/t/<id>/ai
 * （是否启用 AI、系统提示词都由本工具 tool.json 的 ai 字段决定）
 * 单文件直接双击打开（file://）时无法调用，请自行判空 window.ToolHubAI。
 */
(function () {
    "use strict";

    function toolId() {
        var m = location.pathname.match(/\/tools\/([^/]+)\//);
        return m ? m[1] : null;
    }

    function endpoint() {
        var id = toolId();
        if (!id) throw new Error("ToolHubAI: 无法从路径识别工具 id");
        return "/s/t/" + id + "/ai";
    }

    function readCookie(name) {
        var m = document.cookie.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
        return m ? decodeURIComponent(m[1]) : null;
    }

    function ensureCsrf() {
        var token = readCookie("csrftoken");
        if (token) return Promise.resolve(token);
        // 先摸一次工具页，让 Django 下发 csrftoken cookie
        return fetch("/s/t/" + toolId() + "/", { credentials: "same-origin" }).then(function () {
            token = readCookie("csrftoken");
            if (!token) throw new Error("ToolHubAI: 无法获取 CSRF token");
            return token;
        });
    }

    function post(body, onChunk) {
        return ensureCsrf().then(function (token) {
            return fetch(endpoint(), {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json", "X-CSRFToken": token },
                body: JSON.stringify(body)
            }).then(function (resp) {
                if (!resp.ok) {
                    return resp.text().then(function (t) {
                        throw new Error("AI " + resp.status + ": " + t.slice(0, 200));
                    });
                }
                if (!resp.body || !onChunk) return resp.text();
                var reader = resp.body.getReader();
                var decoder = new TextDecoder("utf-8");
                function pump() {
                    return reader.read().then(function (r) {
                        if (r.done) return undefined;
                        onChunk(decoder.decode(r.value, { stream: true }));
                        return pump();
                    });
                }
                return pump();
            });
        });
    }

    window.ToolHubAI = {
        ask: function (text) { return post({ text: String(text) }, null); },
        askMessages: function (messages) { return post({ messages: messages }, null); },
        askStream: function (text, onChunk) { return post({ text: String(text) }, onChunk); },
        askMessagesStream: function (messages, onChunk) { return post({ messages: messages }, onChunk); }
    };
})();
