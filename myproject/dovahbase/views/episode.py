import json
from django.views.decorators.http import require_POST
import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.forms.models import model_to_dict
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from dovahbase.api.douban import *
from django.core.files.base import ContentFile
import uuid
import requests
import datetime




SEASON_CHOICES = [
    ('', '全部季节'),
    ('1', '❄️ 冬季 (1-3月)'),
    ('2', '🌸 春季 (4-6月)'),
    ('3', '☀️ 夏季 (7-9月)'),
    ('4', '🍁 秋季 (10-12月)'),
]


@require_GET
def api_scrape_episode(request):
    title = request.GET.get('title', '').strip()
    if not title:
        return JsonResponse({'success': False, 'error': '请输入标题'})

    # 运行爬虫
    result = run_douban_spider(title)

    # 数据清洗：将列表转为字符串，方便前端直接填入 input
    if result['success']:
        # 将 ['剧情', '犯罪'] 转换为 "剧情, 犯罪"
        result['genres'] = ', '.join(result['genres'])

        aliases = result.get('aliases', [])
        separator = "/ "

        # 预先拼接
        final_str = separator.join(aliases)

        # 如果超长，就循环移除最后一个，直到满足要求
        while len(final_str) > 100 and aliases:
            aliases.pop()  # 移除最后一个译名
            final_str = separator.join(aliases)

        result['aliases'] = final_str

    return JsonResponse(result)


class upload_episode_form(forms.ModelForm):
    choices = [
        (True, 'True  已归档'),
        (False, 'False 未归档'),
    ]
    finish = forms.ChoiceField(choices=choices, label='完成', initial='False')

    class Meta:
        model = models.episode  # 与models建立了依赖关系
        fields = ["title", "org_title", "alternate_titles", "review", "type", "myprogress", "pic", "finish",
                  "resource", "release_time"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})


class filter_episode_form(forms.ModelForm):
    title = forms.CharField(required=False, label='模糊标题')
    choices = [
        ('True', '归档'),
        ('False', '未归档'),
        ('any', '任意'),
    ]
    finish = forms.ChoiceField(choices=choices, label='完成', initial='any')

    # 🌟 核心修改：使用 IntegerField 和 NumberInput
    year = forms.IntegerField(
        required=False,
        label="放送年份",
        widget=forms.NumberInput(attrs={
            'placeholder': '直接输入或点击按钮加减',
            'min': 1920,  # 允许加减的最小值
            'max': 2200,  # 允许加减的最大值
            'step': 1  # 每次点击按钮加减 1
        })
    )

    season = forms.ChoiceField(
        choices=SEASON_CHOICES,
        required=False,
        label="放送季度",
        widget=forms.Select(attrs={'class': 'js-select'})
    )

    class Meta:
        model = models.episode
        fields = ["type"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['type'].required = False
        self.fields['type'].initial = False
        self.fields['type'].choices = [('', '任意')] + list(self.fields['type'].choices)

        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})
# 🌟 核心过滤逻辑：包含你的标题、类型以及新增的【时间段字符串检索】
def _get_filtered_episodes(request):
    episodes = models.episode.objects.all().order_by('-created_at', '-id')

    # 初始化表单：POST则填入数据，否则为空
    if request.method == 'POST':
        form = filter_episode_form(request.POST)
        if form.is_valid():
            filters = Q()

            # 1. 模糊匹配标题/原名/其它译名
            if form.cleaned_data.get('title'):
                title_query = form.cleaned_data['title']
                filters &= (Q(title__icontains=title_query) | \
                            Q(org_title__icontains=title_query) | \
                            Q(alternate_titles__icontains=title_query))

            # 2. 匹配 Type
            if form.cleaned_data.get('type'):
                type_val = form.cleaned_data['type']
                filters &= Q(type=type_val)

            # 3. 匹配归档情况
            if form.cleaned_data.get('finish') != 'any':
                filters &= Q(finish=form.cleaned_data['finish'])

            # 4. 🌟 匹配年份与季节（解决字符串查询 "2019-1" 越界的问题）
            year = form.cleaned_data.get('year')
            season = form.cleaned_data.get('season')

            # 映射季节到具体可能出现的月份格式
            season_months = {
                '1': ['1', '01', '2', '02', '3', '03'],
                '2': ['4', '04', '5', '05', '6', '06'],
                '3': ['7', '07', '8', '08', '9', '09'],
                '4': ['10', '11', '12'],
            }

            if year and season:
                q_obj = Q()
                for m in season_months[season]:
                    # 匹配 '2025-4' 或者 '2025-04'
                    q_obj |= Q(release_time=f"{year}-{m}")
                    # 匹配 '2025-4-xx'
                    q_obj |= Q(release_time__startswith=f"{year}-{m}-")
                filters &= q_obj

            elif year:
                # 仅年份
                filters &= Q(release_time__startswith=f"{year}-")

            elif season:
                # 仅季节
                q_obj = Q()
                for m in season_months[season]:
                    # 匹配以该月份结尾如 '-04'
                    q_obj |= Q(release_time__endswith=f"-{m}")
                    # 匹配中间包含该月份如 '-04-'
                    q_obj |= Q(release_time__contains=f"-{m}-")
                filters &= q_obj

            # 执行查询
            episodes = episodes.filter(filters).distinct()
    else:
        form = filter_episode_form()

    return episodes, form


# --- 主视图 (只渲染第1页) ---
def episode(request):
    queryset, form = _get_filtered_episodes(request)

    # 分页：每页 12 条
    paginator = Paginator(queryset, 12)
    page_obj = paginator.get_page(1)

    message = "共%s条结果" % (paginator.count)
    return render(request, "episode.html", {"episodes": page_obj, "form": form, "message": message})


# --- 🌟 API 接口 (JSON) ---
def api_episode_list(request):
    queryset, _ = _get_filtered_episodes(request)

    paginator = Paginator(queryset, 12)
    page_num = request.POST.get('page', 1)

    try:
        page_obj = paginator.page(page_num)
    except (EmptyPage, PageNotAnInteger):
        return JsonResponse({'success': True, 'episodes': [], 'has_next': False})

    data_list = []
    for e in page_obj:
        # 使用 model_to_dict 转换
        d = model_to_dict(e, exclude=['pic'])

        # 手动处理图片
        d['pic'] = str(e.pic) if e.pic else ""

        # 处理 type 字段 (防止如果是ForeignKey只返回ID，转成字符串更稳妥)
        d['type'] = str(e.type) if e.type else ""

        # 🌟 核心修复：model_to_dict 默认不会获取 auto_now_add 的时间字段，必须手动加上并转为字符串
        # 否则前端 JS 的 e.created_at 会变成 undefined
        d['created_at'] = e.created_at.strftime('%Y-%m-%d %H:%M:%S') if getattr(e, 'created_at', None) else ""

        # 兜底转换 finish 为字符串形式，防止 JS 接收到 null
        d['finish'] = 'True' if getattr(e, 'finish', False) else 'False'

        data_list.append(d)

    return JsonResponse({
        'success': True,
        'episodes': data_list,
        'has_next': page_obj.has_next()
    })


def episode_new(request):
    webform = upload_episode_form()

    if request.method == "GET":
        return render(request, "episode_new.html", {"form": webform})

    # POST 请求处理
    form = upload_episode_form(request.POST, request.FILES)
    if form.is_valid():
        episode_instance = form.save(commit=False)

        # 图片下载逻辑 - 添加调试信息
        remote_url = request.POST.get('remote_poster_url', '').strip()

        print(f"[DEBUG] 是否上传了文件: {bool(request.FILES.get('pic'))}")
        print(f"[DEBUG] remote_poster_url: {remote_url}")
        print(f"[DEBUG] episode_instance.pic: {episode_instance.pic}")

        if not request.FILES.get('pic') and remote_url:
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://episode.douban.com/'
                }

                print(f"[DEBUG] 开始下载图片: {remote_url}")
                response = requests.get(remote_url, headers=headers, timeout=10)

                print(f"[DEBUG] 下载状态码: {response.status_code}")
                print(f"[DEBUG] Content-Type: {response.headers.get('Content-Type')}")
                print(f"[DEBUG] 内容大小: {len(response.content)} bytes")

                if response.status_code == 200:
                    import os
                    from urllib.parse import urlparse

                    parsed_url = urlparse(remote_url)
                    url_path = parsed_url.path
                    ext = os.path.splitext(url_path)[1] or '.jpg'

                    file_name = f"{uuid.uuid4().hex}{ext}"
                    print(f"[DEBUG] 保存文件名: {file_name}")

                    episode_instance.pic.save(file_name, ContentFile(response.content), save=False)
                    print(f"[DEBUG] 图片保存成功！pic 字段: {episode_instance.pic}")
                else:
                    print(f"[DEBUG] 图片下载失败，状态码: {response.status_code}")

            except Exception as e:
                print(f"[ERROR] 图片下载失败: {e}")
                import traceback
                traceback.print_exc()

        episode_instance.save()
        form.save_m2m()

        print(f"[DEBUG] 最终保存的 pic: {episode_instance.pic}")

        return render(request, "episode_new.html", {"form": form, "message": "新增%s成功" % form.cleaned_data["title"]})

    return render(request, "episode_new.html", {"form": form, "message": "新增失败"})


def episode_edit(request, id):
    episode = models.episode.objects.get(id=id)

    if request.method == 'POST':
        form = upload_episode_form(request.POST, request.FILES, instance=episode)

        if form.is_valid():
            episode_instance = form.save(commit=False)
            remote_url = request.POST.get('remote_poster_url', '').strip()

            print(f"[DEBUG] 编辑模式")
            print(f"[DEBUG] 是否上传了新文件: {bool(request.FILES.get('pic'))}")
            print(f"[DEBUG] 原有图片: {episode.pic}")
            print(f"[DEBUG] remote_poster_url: {remote_url}")

            if not request.FILES.get('pic') and remote_url:
                try:
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://episode.douban.com/'
                    }

                    print(f"[DEBUG] 开始下载图片: {remote_url}")
                    response = requests.get(remote_url, headers=headers, timeout=10)

                    print(f"[DEBUG] 下载状态码: {response.status_code}")

                    if response.status_code == 200:
                        import os
                        from urllib.parse import urlparse

                        parsed_url = urlparse(remote_url)
                        url_path = parsed_url.path
                        ext = os.path.splitext(url_path)[1] or '.jpg'

                        file_name = f"{uuid.uuid4().hex}{ext}"
                        print(f"[DEBUG] 保存文件名: {file_name}")

                        if episode_instance.pic:
                            try:
                                episode_instance.pic.delete(save=False)
                                print(f"[DEBUG] 删除旧图片")
                            except:
                                pass

                        episode_instance.pic.save(file_name, ContentFile(response.content), save=False)
                        print(f"[DEBUG] 图片保存成功！")

                except Exception as e:
                    print(f"[ERROR] 图片下载失败: {e}")
                    import traceback
                    traceback.print_exc()

            episode_instance.save()
            form.save_m2m()

            print(f"[DEBUG] 最终保存的 pic: {episode_instance.pic}")
            return redirect('/s/base/episode')
        else:
            return render(request, "episode_edit.html", {"form": form})

    form = upload_episode_form(instance=episode)
    return render(request, "episode_edit.html", {"form": form})
