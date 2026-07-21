from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.core.paginator import Paginator
from django.views.decorators.http import require_POST
from ..models import Ride
from datetime import timedelta

def ride_manage(request):
    """
    数据管理后台：以表格形式展示，提供删除功能
    """
    ride_list = Ride.objects.all().order_by('-start_time')
    for r in ride_list:
        seconds = r.total_duration
        td = timedelta(seconds=seconds)

        total_seconds = int(td.total_seconds())
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        if h:
            r.total_duration_str = f" {h}小时{m}分钟{s}秒"
        elif m:
            r.total_duration_str = f" {m}分钟{s}秒"
        else:
            r.total_duration_str = f" {s}秒"
    # 管理页一页显示 20 条，方便快速浏览
    paginator = Paginator(ride_list, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    return render(request, 'ride_organize.html', {
        'page_obj': page_obj
    })


@require_POST
def ride_delete(request, id):
    """删除逻辑"""
    ride = get_object_or_404(Ride, pk=id)
    title = ride.title  # 记录一下名字用于提示
    ride.delete()  # 触发 model 的 delete，物理删除文件

    messages.success(request, f"记录 '{title}' 已成功删除")

    # 删除后通常留在管理页，而不是跳回 Wall
    return redirect('ride_manage')