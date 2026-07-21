import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q
from django.http import JsonResponse
from django.core.paginator import Paginator, EmptyPage, PageNotAnInteger
from django.forms.models import model_to_dict  # 引入偷懒工具


from django.views.decorators.http import require_GET
from django.core.files.base import ContentFile
import uuid
import requests
from dovahbase.api.douban import *
@require_GET
def api_scrape_movie(request):
    title = request.GET.get('title', '').strip()
    if not title:
        return JsonResponse({'success': False, 'error': '请输入标题'})

    # 运行爬虫
    result = run_douban_spider(title)

    # 数据清洗：将列表转为字符串，方便前端直接填入 input
    if result['success']:
        # 将 ['剧情', '犯罪'] 转换为 "剧情, 犯罪"
        result['genres'] = ', '.join(result['genres'])
        # 将 ['The Shawshank Redemption'] 转换为 "The Shawshank Redemption"

        # 1. 处理 Genres (保持 list 传给前端，前端更好处理)
        # result['genres'] 保持原样: ['剧情', '犯罪']

        # 2. 【核心修改】处理 Aliases (限制 100 字符)
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


class upload_movie_form(forms.ModelForm):

    class Meta:
        model = models.movie  # 与models建立了依赖关系
        fields = ["title", "org_title", "alternate_titles", "review", "myrate", "resource", "pic", "release_time",
                  "watch_date","tags"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["watch_date"].widget = forms.TextInput(attrs={'type': 'date'})
        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': 'form-control', 'style': 'width:100%;'})

        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control'})


class filter_movie_form(forms.ModelForm):
    title = forms.CharField(required=False, label='模糊标题')
    start_time = forms.DateField(required=False, widget=forms.TextInput(attrs={'type': 'date'}), label='起始时间')
    end_time = forms.DateField(required=False, widget=forms.TextInput(attrs={'type': 'date'}), label='结束时间')
    class Meta:
        model = models.movie  # 与models建立了依赖关系
        fields = ["tags","release_time"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.fields['tags'].queryset = models.movie_tag.objects.all()
        self.fields['tags'].required = False
        self.fields['release_time'].required = False


        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})
        self.fields["tags"].widget.attrs.update({'class': 'js-select form-control'})

    def clean(self):
        cleaned_data = super().clean()
        start_time = cleaned_data.get('start_time')
        end_time = cleaned_data.get('end_time')

        if start_time and end_time and start_time > end_time:
            self.add_error('end_time', 'End Date must be later than Start Date.')

        return cleaned_data


# --- 新增：公共筛选逻辑 (私有函数) ---
def _get_filtered_movies(request):
    """
    提取公共筛选逻辑，供主视图和API视图复用
    """
    movies = models.movie.objects.all().order_by('-created_at', '-id')

    # 初始化表单：如果是POST(点击筛选或AJAX加载)则填入数据，否则为空
    if request.method == 'POST':
        form = filter_movie_form(request.POST)
        if form.is_valid():
            filters = Q()
            start_time = form.cleaned_data.get('start_time')
            end_time = form.cleaned_data.get('end_time')

            if form.cleaned_data.get('title'):
                title_query = form.cleaned_data['title']
                filters &= Q(title__icontains=title_query) | Q(org_title__icontains=title_query) | Q(
                    alternate_titles__icontains=title_query)
            if form.cleaned_data.get('tags'):
                tags = form.cleaned_data['tags']
                filters &= Q(tags__in=tags)
            if form.cleaned_data.get('release_time'):
                release_time = form.cleaned_data['release_time']
                filters &= Q(release_time=release_time)
            if start_time:
                filters &= Q(watch_date__gte=start_time)
            if end_time:
                filters &= Q(watch_date__lte=end_time)

            movies = movies.filter(filters).distinct()
    else:
        form = filter_movie_form()

    return movies, form


# --- 修改：主视图 (只渲染第1页 HTML) ---
def movie(request):
    # 调用公共筛选
    queryset, form = _get_filtered_movies(request)
    queryset = queryset.prefetch_related('tags')
    # 分页：每页 12 条 (根据你的图片墙排版，12或20比较合适)
    paginator = Paginator(queryset, 12)

    # 永远只加载第 1 页
    page_obj = paginator.get_page(1)

    # 消息显示总数
    message = "共%s条结果" % (paginator.count)

    # 传递给模板的是 page_obj (只包含第一页数据)
    return render(request, "movie.html", {"movies": page_obj, "form": form, "message": message})


# --- 新增：API 接口 (触底加载 JSON) ---
def api_movie_list(request):
    """
    专门处理 AJAX 请求，返回 JSON 数据
    """
    # 1. 复用筛选逻辑
    queryset, _ = _get_filtered_movies(request)

    # 2. 预加载 Tags 避免数据库查询爆炸 (N+1问题)
    queryset = queryset.prefetch_related('tags')

    # 3. 分页 (必须和主视图保持一致的数量)
    paginator = Paginator(queryset, 12)
    page_num = request.POST.get('page', 1)

    try:
        page_obj = paginator.page(page_num)
    except (EmptyPage, PageNotAnInteger):
        return JsonResponse({'success': True, 'movies': [], 'has_next': False})

    # 4. 构造数据 (使用 model_to_dict 偷懒)
    data_list = []
    for m in page_obj:
        # 自动转换简单字段，排除需要特殊处理的字段
        d = model_to_dict(m, exclude=['pic', 'tags', 'release_time', 'watch_date'])

        # 手动处理特殊字段
        d['pic'] = str(m.pic) if m.pic else ""  # 保持原始路径或空字符
        d['release_time'] = str(m.release_time) if m.release_time else ""
        d['watch_date'] = str(m.watch_date) if m.watch_date else ""
        d['created_at'] = m.created_at.strftime('%Y-%m-%d %H:%M:%S') if getattr(m, 'created_at', None) else ""
        # 处理 Tags：获取名称列表
        d['tags'] = [t.tag for t in m.tags.all()]

        data_list.append(d)

    return JsonResponse({
        'success': True,
        'movies': data_list,
        'has_next': page_obj.has_next()
    })

# def movie(request):
#     movies = models.movie.objects.all().order_by('-created_at')
#     form = filter_movie_form()
#     if request.method == 'POST':
#         form = filter_movie_form(request.POST)
#         filters = Q()
#         if form.is_valid():
#             start_time = form.cleaned_data.get('start_time')
#             end_time = form.cleaned_data.get('end_time')
#             if form.cleaned_data.get('title'):
#                 title_query = form.cleaned_data['title']
#                 filters &= Q(title__icontains=title_query) | Q(org_title__icontains=title_query) | Q(
#                     alternate_titles__icontains=title_query)
#             if form.cleaned_data.get('tags'):
#                 tags = form.cleaned_data['tags']
#                 filters &= Q(tags__in=tags)
#             if form.cleaned_data.get('release_time'):
#                 release_time = form.cleaned_data['release_time']
#                 filters &= Q(release_time=release_time)
#             if start_time:
#                 filters &= Q(watch_date__gte=start_time)
#             if end_time:
#                 filters &= Q(watch_date__lte=end_time)
#
#             movies = movies.filter(filters).distinct()
#         message = "共%s条结果" % (len(movies))
#         return render(request, "movie.html", {"movies": movies, "form": form, "message": message})
#     message = "共%s条结果" % (len(movies))
#     return render(request, "movie.html", {"movies": movies, "form": form, "message": message})
#

def movie_new(request):
    webform = upload_movie_form()

    if request.method == "GET":
        return render(request, "movie_new.html", {"form": webform})

    # POST 请求处理
    form = upload_movie_form(request.POST, request.FILES)
    if form.is_valid():
        movie_instance = form.save(commit=False)

        # 图片下载逻辑 - 添加调试信息
        remote_url = request.POST.get('remote_poster_url', '').strip()

        print(f"[DEBUG] 是否上传了文件: {bool(request.FILES.get('pic'))}")
        print(f"[DEBUG] remote_poster_url: {remote_url}")
        print(f"[DEBUG] movie_instance.pic: {movie_instance.pic}")

        # 关键修复：检查条件
        # 1. 用户没有上传文件
        # 2. 有远程 URL
        # 3. 当前实例的 pic 字段为空（新建时总是空的）
        if not request.FILES.get('pic') and remote_url:
            try:
                headers = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://movie.douban.com/'
                }

                print(f"[DEBUG] 开始下载图片: {remote_url}")
                response = requests.get(remote_url, headers=headers, timeout=10)

                print(f"[DEBUG] 下载状态码: {response.status_code}")
                print(f"[DEBUG] Content-Type: {response.headers.get('Content-Type')}")
                print(f"[DEBUG] 内容大小: {len(response.content)} bytes")

                if response.status_code == 200:
                    # 从 URL 中提取扩展名
                    import os
                    from urllib.parse import urlparse

                    parsed_url = urlparse(remote_url)
                    url_path = parsed_url.path
                    ext = os.path.splitext(url_path)[1] or '.jpg'  # 默认 .jpg

                    file_name = f"{uuid.uuid4().hex}{ext}"

                    print(f"[DEBUG] 保存文件名: {file_name}")

                    # 保存图片
                    movie_instance.pic.save(file_name, ContentFile(response.content), save=False)

                    print(f"[DEBUG] 图片保存成功！pic 字段: {movie_instance.pic}")
                else:
                    print(f"[DEBUG] 图片下载失败，状态码: {response.status_code}")

            except Exception as e:
                print(f"[ERROR] 图片下载失败: {e}")
                import traceback
                traceback.print_exc()

        # 正式保存到数据库
        movie_instance.save()

        # 保存多对多字段
        form.save_m2m()

        print(f"[DEBUG] 最终保存的 pic: {movie_instance.pic}")

        return render(request, "movie_new.html", {"form": form, "message": "新增%s成功" % form.cleaned_data["title"]})

    return render(request, "movie_new.html", {"form": form, "message": "新增失败"})


def movie_edit(request, id):
    movie = models.movie.objects.get(id=id)

    if request.method == 'POST':
        form = upload_movie_form(request.POST, request.FILES, instance=movie)

        if form.is_valid():
            movie_instance = form.save(commit=False)

            # 图片下载逻辑 - 添加调试
            remote_url = request.POST.get('remote_poster_url', '').strip()

            print(f"[DEBUG] 编辑模式")
            print(f"[DEBUG] 是否上传了新文件: {bool(request.FILES.get('pic'))}")
            print(f"[DEBUG] 原有图片: {movie.pic}")
            print(f"[DEBUG] remote_poster_url: {remote_url}")

            # 修复：只在以下情况下载远程图片
            # 1. 用户没有上传新文件
            # 2. 有远程 URL
            # 3. (原来没有图片 OR 用户希望替换图片)
            if not request.FILES.get('pic') and remote_url:
                try:
                    headers = {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        'Referer': 'https://movie.douban.com/'
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

                        # 如果原来有图片，先删除旧文件
                        if movie_instance.pic:
                            try:
                                movie_instance.pic.delete(save=False)
                                print(f"[DEBUG] 删除旧图片")
                            except:
                                pass

                        movie_instance.pic.save(file_name, ContentFile(response.content), save=False)
                        print(f"[DEBUG] 图片保存成功！")

                except Exception as e:
                    print(f"[ERROR] 图片下载失败: {e}")
                    import traceback
                    traceback.print_exc()

            # 保存
            movie_instance.save()
            form.save_m2m()

            print(f"[DEBUG] 最终保存的 pic: {movie_instance.pic}")

            return redirect('/s/base/movie')
        else:
            return render(request, "movie_edit.html", {"form": form})

    form = upload_movie_form(instance=movie)
    return render(request, "movie_edit.html", {"form": form})
@require_GET
def proxy_image(request):
    img_url = request.GET.get('url')
    if not img_url:
        return HttpResponse('No URL provided', status=400)

    headers = {
        'Referer': 'https://movie.douban.com/',  # 必须加豆瓣域名
        'User-Agent': 'Mozilla/5.0',
    }

    try:
        resp = requests.get(img_url, headers=headers, timeout=10)
        content_type = resp.headers.get('Content-Type', 'image/jpeg')
        return HttpResponse(resp.content, content_type=content_type)
    except Exception as e:
        return HttpResponse(f'Error fetching image: {str(e)}', status=500)


