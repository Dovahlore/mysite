import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q


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


def movie(request):
    movies = models.movie.objects.all().order_by('-created_at')
    form = filter_movie_form()
    if request.method == 'POST':
        form = filter_movie_form(request.POST)
        filters = Q()
        if form.is_valid():
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
        message = "共%s条结果" % (len(movies))
        return render(request, "movie.html", {"movies": movies, "form": form, "message": message})
    message = "共%s条结果" % (len(movies))
    return render(request, "movie.html", {"movies": movies, "form": form, "message": message})


def movie_edit(request, id):
    movie = models.movie.objects.get(id=id)

    if request.method == 'POST':
        form = upload_movie_form(request.POST, request.FILES, instance=movie)

        if form.is_valid():
            form.save()


            # 处理表单提交后的逻辑，比如重定向到详情页或其他页面
            return redirect('/base/movie')
        else:
            return render(request, "movie_edit.html", {"form": form})
    form = upload_movie_form(instance=movie)

    return render(request, "movie_edit.html", {"form": form})


def movie_new(request):
    webform = upload_movie_form()
    if request.method == "GET":
        return render(request, "movie_new.html", {"form": webform})
    form = upload_movie_form(request.POST, request.FILES)
    if form.is_valid():
        form.save()
        return render(request, "movie_new.html", {"form": form, "message": "新增%s成功" % form.cleaned_data["title"]})
    return render(request, "movie_new.html", {"form": form, "message": "新增失败"})
