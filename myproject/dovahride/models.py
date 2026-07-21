import os
import uuid
from django.db import models
from django.dispatch import receiver


# 生成随机文件名（保留后缀）
def ride_file_path(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    if not ext: ext = '.fit'
    filename = f'{uuid.uuid4()}{ext}'
    return os.path.join('ride', 'raw', filename)


# 生成随机缩略图名
def ride_thumb_path(instance, filename):
    filename = f'{uuid.uuid4()}.png'
    return os.path.join('ride', 'thumb', filename)


class Ride(models.Model):
    title = models.CharField("标题", max_length=100, blank=True)

    # 文件存储
    data_file = models.FileField("数据文件", upload_to=ride_file_path)
    thumbnail = models.ImageField("缩略图", upload_to=ride_thumb_path, blank=True, null=True)

    # 核心统计数据 (用于Wall展示)
    start_time = models.DateTimeField("开始时间", null=True, blank=True)
    total_distance = models.FloatField("里程(km)", default=0)
    total_duration = models.IntegerField("总耗时(s)", default=0)
    moving_time = models.IntegerField("骑行时间(s)", default=0)
    total_ascent = models.FloatField("爬升(m)", default=0)
    avg_speed = models.FloatField("均速(km/h)", default=0)
    max_speed = models.FloatField("极速(km/h)", default=0)
    calories = models.IntegerField("卡路里", null=True, blank=True)

    # 摘要数据
    avg_heart_rate = models.IntegerField("平均心率", null=True, blank=True)
    avg_power = models.IntegerField("平均功率", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f"{self.start_time} - {self.total_distance}km"


# 信号监听：模型删除后，自动删除本地文件
@receiver(models.signals.post_delete, sender=Ride)
def auto_delete_file_on_delete(sender, instance, **kwargs):
    if instance.data_file:
        if os.path.isfile(instance.data_file.path):
            os.remove(instance.data_file.path)
    if instance.thumbnail:
        if os.path.isfile(instance.thumbnail.path):
            os.remove(instance.thumbnail.path)