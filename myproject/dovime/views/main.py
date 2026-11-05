from django.shortcuts import render


def page(request):
    """龙语输入法（Dovahzul IME）页面：离线转换引擎 + 站点统一 AI。"""
    return render(request, "ime.html")
