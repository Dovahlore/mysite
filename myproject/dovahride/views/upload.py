from django.shortcuts import render, redirect
from django.contrib import messages
from datetime import timezone
from django.core.exceptions import ValidationError
from ..models import Ride
from ..utils.extract import parse_ride_file, generate_track_thumbnail
from django import forms

# 文件类型验证
def validate_file_extension(value):
    import os
    ext = os.path.splitext(value.name)[1]  # 获取扩展名
    valid_extensions = ['.fit', '.gpx']
    if ext.lower() not in valid_extensions:
        raise ValidationError(f'不支持的文件类型。只允许: {", ".join(valid_extensions)}')

# 上传表单
class UploadFileForm(forms.Form):
    files = forms.FileField(
        widget=forms.ClearableFileInput(attrs={'class': 'form-control', 'accept': '.fit,.gpx'}),
        label="选择文件 (支持多选 .fit, .gpx)",
        required=True,
        validators=[validate_file_extension]
    )

    def clean_files(self):
        files = self.files.getlist('files') if hasattr(self.files, 'getlist') else [self.files['files']]
        if not files:
            raise ValidationError("请至少选择一个文件")
        return files

# 上传视图
def ride_upload(request):
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            files = form.cleaned_data['files']
            success_count = 0

            for f in files:
                try:
                    # A. 预保存：先存文件
                    instance = Ride(data_file=f)
                    instance.save()

                    # B. 解析文件
                    full_path = instance.data_file.path
                    data = parse_ride_file(full_path)

                    if not data or not data.get('points'):
                        instance.delete()
                        continue

                    # C. 填充元数据
                    start_time = data.get('start_time')
                    if start_time:
                        # 明确 FIT 时间是 UTC
                        start_time_utc = start_time.replace(tzinfo=timezone.utc)
                        instance.start_time = start_time_utc
                        instance.title = f"{start_time_utc.strftime('%Y-%m-%d')} 骑行"
                    else:
                        instance.title = "未命名骑行"

                    instance.total_distance = data.get('total_distance', 0)
                    instance.total_duration = data.get('total_duration', 0)
                    instance.moving_time = data.get('total_timer_time',0)
                    instance.total_ascent = data.get('total_ascent', 0)
                    instance.avg_speed = data.get('avg_speed', 0)
                    instance.max_speed = data.get('max_speed', 0)
                    instance.calories = data.get('total_calories')
                    instance.avg_heart_rate = data.get('avg_heart_rate')
                    instance.avg_power = data.get('avg_power')

                    # D. 生成轨迹缩略图
                    thumb_file = generate_track_thumbnail(data['points'])
                    if thumb_file:
                        instance.thumbnail.save('thumb.png', thumb_file, save=False)

                    # E. 最终保存
                    instance.save()
                    success_count += 1

                except Exception as e:
                    print(f"❌ Error processing {f.name}: {e}")
                    if 'instance' in locals() and instance.id:
                        instance.delete()

            if success_count > 0:
                messages.success(request, f"成功导入 {success_count} 条数据")
            else:
                messages.warning(request, "没有有效的数据被导入")

            return redirect('ride_wall')

    else:
        form = UploadFileForm()

    return render(request, 'ride_upload.html', {'form': form})
