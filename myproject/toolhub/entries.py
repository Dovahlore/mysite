# -*- coding: utf-8 -*-
"""工具墙的 link 条目：站内已有页面与外部链接。

加一个外链/站内页工具 = 在这里加一条 dict，主页工具墙自动出现。
字段：
    id          唯一标识（小写字母/数字/-/_）
    name        卡片名
    desc        卡片一句话描述
    url         跳转地址（站内路径或完整外链）
    icon_fa     FontAwesome 图标类（如 "fas fa-robot"），与 icon_img 二选一
    icon_color  图标颜色（#rrggbb）
    icon_img    站内 static 图片路径（如 "ime/img/skyrim_logo_light.png"）
    order       排序权重（小在前，默认 500）
"""

LINK_TOOLS = [
    {
        "id": "assistant",
        "name": "Site Assistant",
        "desc": "站内数据问答助手",
        "url": "/s/agent",
        "icon_fa": "fas fa-robot",
        "icon_color": "#89bfe1",
        "order": 100,
    },
    {
        "id": "dovime",
        "name": "龙语输入法",
        "desc": "dovahzul ime · 中↔龙语",
        "url": "/s/ime",
        "icon_img": "ime/img/skyrim_logo_light.png",
        "order": 200,
    },
    {
        "id": "deepseek",
        "name": "DeepSeek AI",
        "desc": "deepseek.dovahwall.cn",
        "url": "http://deepseek.dovahwall.cn",
        "icon_fa": "fas fa-brain",
        "icon_color": "#4d90fe",
        "order": 800,
    },
    {
        "id": "portainer",
        "name": "Portainer",
        "desc": "portainer.dovahwall.cn",
        "url": "http://portainer.dovahwall.cn",
        "icon_fa": "fab fa-docker",
        "icon_color": "#2496ed",
        "order": 900,
    },
]
