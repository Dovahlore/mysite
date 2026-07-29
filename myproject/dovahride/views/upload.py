from django.shortcuts import render, redirect
from django.contrib import messages
from django.core.exceptions import ValidationError
from ..services.importer import import_ride_file
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
                    if import_ride_file(f):
                        success_count += 1

                except Exception as e:
                    print(f"❌ Error processing {f.name}: {e}")

            if success_count > 0:
                messages.success(request, f"成功导入 {success_count} 条数据")
            else:
                messages.warning(request, "没有有效的数据被导入")

            return redirect('ride_wall')

    else:
        form = UploadFileForm()

    return render(request, 'ride_upload.html', {'form': form})
