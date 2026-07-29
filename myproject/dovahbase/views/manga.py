import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.forms.models import model_to_dict
from django.http import JsonResponse
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


# def manga(request):
#     mangas = models.manga.objects.all().order_by('-created_at')
#     form = filter_manga_form()
#     if request.method == 'POST':
#         form = filter_manga_form(request.POST)
#         filters = Q()
#         if form.is_valid():
#             print(1, form.cleaned_data.get('finish'))
#             if form.cleaned_data.get('title'):
#                 title_query = form.cleaned_data['title']
#                 filters &= Q(title__icontains=title_query) | Q(org_title__icontains=title_query) | Q(
#                     alternate_titles__icontains=title_query)
#             if form.cleaned_data.get('tags'):
#                 tags = form.cleaned_data['tags']
#                 filters &= Q(tags__in=tags)
#             if form.cleaned_data.get('status'):
#                 status = form.cleaned_data['status']
#                 filters &= Q(status=status)
#             if form.cleaned_data.get('finish') !=  'any':
#                     filters &= Q(finish=form.cleaned_data['finish'])
#
#             mangas = mangas.filter(filters).distinct()
#         message = "共%s条结果" % (len(mangas))
#         return render(request, "manga.html", {"mangas": mangas, "form": form,"message":message})
#     message = "共%s条结果" % (len(mangas))
#     return render(request, "manga.html",{"mangas":mangas,"form":form,"message":message})
def _get_filtered_mangas(request):
    mangas = models.manga.objects.all().order_by('-created_at', '-id')

    # 无论是页面加载(可能带POST筛选) 还是 API调用(POST)，都尝试获取表单数据
    if request.method == 'POST':
        form = filter_manga_form(request.POST)
        if form.is_valid():
            filters = Q()
            # 这里的逻辑完全保留你原本的写法
            if form.cleaned_data.get('title'):
                title_query = form.cleaned_data['title']
                filters &= Q(title__icontains=title_query) | \
                           Q(org_title__icontains=title_query) | \
                           Q(alternate_titles__icontains=title_query)

            if form.cleaned_data.get('tags'):
                tags = form.cleaned_data['tags']
                filters &= Q(tags__in=tags)

            if form.cleaned_data.get('status'):
                status = form.cleaned_data['status']
                filters &= Q(status=status)

            # 注意：finish 的 logic 是 'any' 字符串判断
            if form.cleaned_data.get('finish') != 'any':
                filters &= Q(finish=form.cleaned_data['finish'])

            mangas = mangas.filter(filters).distinct()
    else:
        form = filter_manga_form()

    return mangas, form


# --- 2. 修改主视图 (只渲染第1页 HTML) ---
def manga(request):
    queryset, form = _get_filtered_mangas(request)
    queryset = queryset.prefetch_related('tags')
    # 分页：每页 12 条
    paginator = Paginator(queryset, 12)
    page_obj = paginator.get_page(1)

    message = "共%s条结果" % (paginator.count)
    return render(request, "manga.html", {"mangas": page_obj, "form": form, "message": message})


# --- 3. 新增 API 接口 (返回 JSON) ---
def api_manga_list(request):
    queryset, _ = _get_filtered_mangas(request)

    # 预加载 Tags 优化性能
    queryset = queryset.prefetch_related('tags')

    paginator = Paginator(queryset, 12)
    page_num = request.POST.get('page', 1)

    try:
        page_obj = paginator.page(page_num)
    except (EmptyPage, PageNotAnInteger):
        return JsonResponse({'success': True, 'mangas': [], 'has_next': False})

    data_list = []
    for m in page_obj:
        # 使用 model_to_dict 自动转换
        # 排除不需要或者需要手动处理的字段
        d = model_to_dict(m, exclude=['pic', 'tags'])

        # 手动处理图片路径
        d['pic'] = str(m.pic) if m.pic else ""

        # 手动处理 Tags (获取名字列表)
        d['tags'] = [t.tag for t in m.tags.all()]
        d['created_at'] = m.created_at.strftime('%Y-%m-%d %H:%M:%S') if getattr(m, 'created_at', None) else ""
        data_list.append(d)

    return JsonResponse({
        'success': True,
        'mangas': data_list,
        'has_next': page_obj.has_next()
    })

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
            return redirect('/s/base/manga')


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
