import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q
class upload_manga_form(forms.ModelForm):
    choices = [
        (True, 'True  已归档'),
        (False, 'False 未归档'),

    ]
    finish = forms.ChoiceField(choices=choices, label='完成', initial='False')
    class Meta:
        model = models.manga # 与models建立了依赖关系
        fields = ["title","org_title","alternate_titles","author","tags","review","status","myprogress","pic","finish"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields :
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})
        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control'})
class filter_manga_form(forms.ModelForm):
    title = forms.CharField(required=False,label='模糊标题')
    choices = [
        ('True', '归档'),
        ('False', '未归档'),
        ('any', '任意'),
    ]
    finish = forms.ChoiceField(choices=choices, label='完成',initial='any')
    class Meta:
        model = models.manga # 与models建立了依赖关系
        fields = ["tags","status"]



    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['status'].required = False
        self.fields['status'].initial=False
        self.fields['tags'].queryset = models.manga_tag.objects.all()
        self.fields['tags'].required = False
        self.fields['status'].choices = [('', '任意')] + list(self.fields['status'].choices)

        for field in self.fields :
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})
        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control'})


def manga(request):
    mangas = models.manga.objects.all().order_by('-created_at')
    form = filter_manga_form()
    if request.method == 'POST':
        form = filter_manga_form(request.POST)
        filters = Q()
        if form.is_valid():
            print(1, form.cleaned_data.get('finish'))
            if form.cleaned_data.get('title'):
                title_query = form.cleaned_data['title']
                filters &= Q(title__icontains=title_query) | Q(org_title__icontains=title_query) | Q(
                    alternate_titles__icontains=title_query)
            if form.cleaned_data.get('tags'):
                tags = form.cleaned_data['tags']
                filters &= Q(tags__in=tags)
            if form.cleaned_data.get('status'):
                status = form.cleaned_data['status']
                filters &= Q(status=status)
            if form.cleaned_data.get('finish') !=  'any':
                    filters &= Q(finish=form.cleaned_data['finish'])

            mangas = mangas.filter(filters).distinct()
        message = "共%s条结果" % (len(mangas))
        return render(request, "manga.html", {"mangas": mangas, "form": form,"message":message})
    message = "共%s条结果" % (len(mangas))
    return render(request, "manga.html",{"mangas":mangas,"form":form,"message":message})
def manga_edit(request,id):
    manga = models.manga.objects.get(id=id)
    print(manga.pic)
    if request.method == 'POST':
        form = upload_manga_form(request.POST, request.FILES, instance=manga)

        if form.is_valid():
            temp=form.save(commit=False)
            temp.save()
            form.save_m2m()


            # 处理表单提交后的逻辑，比如重定向到详情页或其他页面
            return redirect('/base/manga')


    form = upload_manga_form(instance=manga)


    return render(request, "manga_edit.html",{"form":form})

def manga_new(request):
    webform = upload_manga_form()
    if request.method == "GET":
        return render(request, "manga_new.html", {"form": webform})
    form = upload_manga_form(request.POST, request.FILES)
    if form.is_valid():
        form.save()
        return render(request, "manga_new.html", {"form": form, "message": "新增%s成功" % form.cleaned_data["title"]})
    return render(request, "manga_new.html", {"form": form, "message": "新增失败"})
