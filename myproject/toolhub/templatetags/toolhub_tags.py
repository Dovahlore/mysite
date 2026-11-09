# -*- coding: utf-8 -*-
from django import template

from toolhub import registry

register = template.Library()


@register.inclusion_tag("toolhub/wall.html")
def tool_wall():
    """渲染主页工具墙（toolhub 注册表驱动，卡片标记与原手写版一致）。"""
    return {"tools": registry.list_tools()}
