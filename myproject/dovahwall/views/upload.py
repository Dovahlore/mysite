from django.shortcuts import render, HttpResponse, redirect
from django import forms
import dovahwall.models as models

import uuid
class upload_pic_form(forms.ModelForm):

    camera_exif = forms.CharField(required=False,widget=forms.Textarea)
    class Meta:
        model = models.photo  # 与models建立了依赖关系
        fields = ["pic","title","tags","information","camera_exif"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})
        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control'})
    def clean_pic(self):  # clean_字段名
        file = self.cleaned_data["pic"]
        ext = file.name.split(".")[-1]
        new_file_name = f'{uuid.uuid4()}.'
        file.name =  new_file_name+ext
        return file
def upload(request):
    webform = upload_pic_form()
    webform.fields.pop("camera_exif",None)
    if request.method == "GET":
        return render(request, "upload.html",{"form": webform})
    form=upload_pic_form(request.POST,request.FILES)

    if  form.is_valid():
        form.save()
        form.fields.pop("camera_exif", None)
        return render(request, "upload.html",{"form":form,"message":"上传%s成功"%form.cleaned_data["title"]})

    form.fields.pop("camera_exif", None)
    return render(request, "upload.html",{"form":form,"message":"上传失败"})

