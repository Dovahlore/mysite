from django.shortcuts import render
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.db.models import Sum
from ..models import Ride
from datetime import timedelta

def ride_wall(request):
    """展示骑行数据墙 (带分页)"""

    # 1. 获取所有数据，按时间倒序
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
    # 2. 计算总统计数据 (注意：总里程应该是所有数据的总和，而不是当前页的总和)
    stats = ride_list.aggregate(
        total_km=Sum('total_distance'),
    )
    total_km = stats['total_km'] or 0
    total_count = ride_list.count()

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

    return render(request, 'ride_wall.html', {
        'page_obj': page_obj,  # 传递分页对象，而不是整个列表
        'total_km': round(total_km, 2),
        'total_count': total_count
    })