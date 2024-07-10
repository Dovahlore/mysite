from django.shortcuts import render, HttpResponse, redirect
import dovahwall.models as models
from .upload import upload_pic_form

def organize(request):
    pics=models.photo.objects.all().order_by('-created_at')
    return render(request, "organize.html",{"pics":pics})
def edit(request,id):
    pic = models.photo.objects.get(id=id)

    if request.method == 'POST':
        # 处理表单提交的数据
        if 'edit' in request.POST:
            form = upload_pic_form(request.POST)
            form.fields.pop("pic", None)
            if form.is_valid():
                new= {k: v for k, v in form.cleaned_data.items() if k != 'tags'}
                print(new)
                pic.tags.set(form.cleaned_data['tags'])
                for key, value in new.items():
                    setattr(pic, key, value)

                pic.update()

                # 处理表单提交后的逻辑，比如重定向到详情页或其他页面
                return redirect('/organize')
            else:
                return render(request, "edit.html", {"pic": pic, "form": form,"message":"更新失败"})
        else:
            pic.delete()
            return redirect('/organize')
    form = upload_pic_form(instance=pic)
    form.fields.pop("pic", None)
    return render(request,"edit.html" ,{"pic":pic,"form":form})
