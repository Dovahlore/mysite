from django.shortcuts import render
from django.core.cache import cache
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Sum
from ..models import Ride
from datetime import timedelta

def ride_wall(request):
    """展示骑行数据墙 (带分页)"""

    # 1. 获取所有数据，按时间倒序
    ride_list = Ride.objects.all().order_by('-start_time')

    # 2. 汇总值只在上传、修改或删除骑行记录时变化。
    stats = cache.get("ride:stats:v1")
    if stats is None:
        aggregate = ride_list.aggregate(total_km=Sum('total_distance'))
        stats = {
            "total_km": aggregate['total_km'] or 0,
            "total_count": ride_list.count(),
        }
        cache.set("ride:stats:v1", stats, timeout=60 * 60)

    # 3. 分页逻辑
    items_per_page = 16  # 每页显示布局
    paginator = Paginator(ride_list, items_per_page)

    page_number = request.GET.get('page')  # 获取url参数 ?page=2
    try:
        page_obj = paginator.get_page(page_number)
    except PageNotAnInteger:
        # 如果 page 不是整数，显示第一页
        page_obj = paginator.page(1)
    except EmptyPage:
        # 如果 page 超出范围，显示最后一页
        page_obj = paginator.page(paginator.num_pages)

    # 只格式化当前页，避免为一页 16 条记录遍历整张表。
    for r in page_obj.object_list:
        total_seconds = int(timedelta(seconds=r.total_duration).total_seconds())
        h = total_seconds // 3600
        m = (total_seconds % 3600) // 60
        s = total_seconds % 60
        if h:
            r.total_duration_str = f" {h}小时{m}分钟{s}秒"
        elif m:
            r.total_duration_str = f" {m}分钟{s}秒"
        else:
            r.total_duration_str = f" {s}秒"

    return render(request, 'ride_wall.html', {
        'page_obj': page_obj,  # 传递分页对象，而不是整个列表
        'total_km': round(stats["total_km"], 2),
        'total_count': stats["total_count"]
    })
