from django.shortcuts import render,HttpResponse, redirect
import dovahwall.models as models
from django.http import JsonResponse
from django.core import serializers
from django.db.models import F
from django import forms
from django.db.models import Q


class filter_photo_form(forms.ModelForm):
    class Meta:
        model = models.photo # 与models建立了依赖关系
        fields = ["tags"]
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['tags'].required = False
        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control','style':"width:300px;"})

def wall(request):
    pics=models.photo.objects.all().order_by('-created_at')
    if request.method == 'POST':
        form = filter_photo_form(request.POST)
        filters = Q()
        if form.is_valid():
            message = ""
            if form.cleaned_data.get('tags'):
                tags = form.cleaned_data['tags']
                filters &= Q(tags__in=tags)
                tags = ", ".join(tag.tag for tag in tags)
                message = "筛选Tag：%s" % tags
            pics = pics.filter(filters).distinct()


        

            return render(request, "wall.html", {"pics": pics, "form": form,"message":message})
    form=filter_photo_form()
    return render(request, "wall.html",{"pics":pics,"form":form})

def like(request):
    data= request.POST
    id = data.get('id')
    models.photo.objects.filter(id=id).update(like=F('like')+1)
    return JsonResponse({"res":"success"})

