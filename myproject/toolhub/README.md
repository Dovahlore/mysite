# toolhub —— 站点工具墙的通用扩展机制

主页 Tools Wall 由本应用驱动，加工具不再改模板/后端代码。

## 两种加工具的方式

### 1. 外链 / 站内已有页面 → 加 link 条目

在 `entries.py` 的 `LINK_TOOLS` 里加一条 dict（id/name/desc/url/icon_fa/icon_color/icon_img/order），
主页工具墙自动出现新卡片。适合 Portainer、DeepSeek、`/s/agent` 这类已有入口。

### 2. 独立 html/js 小工具 → drop-in 文件夹（推荐，零后端代码）

在 `toolhub/static/tools/` 下新建一个文件夹：

```
toolhub/static/tools/<id>/
├── tool.json      # 清单（必需）
├── index.html     # 入口（必需，自包含或引用同目录资源）
└── …              # 其他 js/css/图片随意
```

`tool.json` 字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `name` | ✓ | 卡片名（≤40 字符） |
| `description` | | 一句话描述（≤80 字符） |
| `icon` | | FontAwesome 类，如 `"fas fa-gamepad"`（默认拼图） |
| `icon_color` | | 图标颜色 `#rrggbb` |
| `icon_img` | | 工具目录内的图片文件名（如 `icon.png`），优先于 icon |
| `order` | | 排序权重，小在前（默认 500） |
| `bare` | | `true` 时卡片直开静态页，不套站点壳（默认 false） |
| `ai` | | `{"system_prompt": "...", "temperature": 0.4, "max_tokens": 800}`，声明后 `/s/t/<id>/ai` 立即可用 |

目录名即工具 id（小写字母/数字/`-`/`_`）。以 `_` 开头的目录不是工具
（`_common/` 放共享脚本）。文件夹双击可独立运行，放进站内自动上墙——
页面地址 `/s/t/<id>/`（站点壳 + iframe）。

## 工具里调用本站 LLM

`index.html` 里引入共享助手：

```html
<script src="../_common/ai.js"></script>
<script>
  // 单发（返回 Promise<完整文本>，含 <think>…</think> 思考段）
  ToolHubAI.ask("给这道题出个提示").then(console.log);
  // 流式
  ToolHubAI.askStream("点评一下", chunk => append(chunk));
  // 多轮
  ToolHubAI.askMessages([{role: "user", content: "…"}, {role: "assistant", content: "…"}]);
</script>
```

系统提示词/温度/最大长度都来自本工具 `tool.json` 的 `ai` 字段，
前端不接触任何 API Key。CSRF token 由共享助手自动处理。
注意单文件双击打开（file://）时没有 AI，先判 `window.ToolHubAI` 是否存在。

## 活样例

`static/tools/g2048/` —— 2048 小游戏（键盘/触屏 + 局末 AI 毒舌点评），
新工具照它的目录结构抄即可。

## 部署注意

- nginx 已有通用流式块 `location ~ ^/s/t/[^/]+/ai$`（uwsgi_buffering off），新工具 AI 端点免配置。
- 新静态文件需要 collectstatic（容器重启自动跑；dev 下手动
  `docker compose exec web python manage.py collectstatic --no-input`）。
- 增删工具文件夹后刷新页面即生效（registry 按目录 mtime 失效缓存）。
