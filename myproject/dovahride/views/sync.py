from django.contrib import messages
from django.db import transaction
from django.shortcuts import redirect
from django.views.decorators.http import require_POST

from ..models import RideSyncRequest, RideSyncState


@require_POST
def request_full_sync(request):
    info = request.session.get("info")
    if not info:
        return redirect(f"/s/login?next={request.path}")

    with transaction.atomic():
        RideSyncState.objects.select_for_update().get_or_create(pk=1)
        active_request = RideSyncRequest.objects.filter(
            status__in=[
                RideSyncRequest.Status.PENDING,
                RideSyncRequest.Status.RUNNING,
            ]
        ).first()
        if active_request:
            messages.info(request, "已经有一个完整同步任务正在排队或运行。")
        else:
            RideSyncRequest.objects.create(
                full_sync=True,
                requested_by=str(info.get("user") or info.get("id") or "")[:150],
            )
            messages.success(
                request,
                "完整同步任务已提交，scheduler 将在几秒内开始处理。",
            )

    return redirect("ride_wall")
