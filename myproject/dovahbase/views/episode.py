import dovahbase.models as models
from django.shortcuts import render, HttpResponse, redirect
from django import forms
from django.db.models import Q


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

    class Meta:
        model = models.episode  # 与models建立了依赖关系
        fields = [ "type"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['type'].required = False
        self.fields['type'].initial = False
        self.fields['type'].choices = [('', '任意')] + list(self.fields['type'].choices)

        for field in self.fields:
            self.fields[field].widget.attrs.update({'class': ' form-control', 'style': 'width:100%;'})



def episode(request):
    episodes = models.episode.objects.all().order_by('-created_at')
    form = filter_episode_form()
    if request.method == 'POST':
        form = filter_episode_form(request.POST)
        filters = Q()
        if form.is_valid():
            print(1, form.cleaned_data.get('finish'))
            if form.cleaned_data.get('title'):
                title_query = form.cleaned_data['title']
                filters &= Q(title__icontains=title_query) | Q(org_title__icontains=title_query) | Q(
                    alternate_titles__icontains=title_query)

            if form.cleaned_data.get('type'):
                type = form.cleaned_data['type']
                filters &= Q(type=type)
            if form.cleaned_data.get('finish') != 'any':
                filters &= Q(finish=form.cleaned_data['finish'])

            episodes = episodes.filter(filters).distinct()
        message = "共%s条结果" % (len(episodes))
        return render(request, "episode.html", {"episodes": episodes, "form": form, "message": message})
    message = "共%s条结果" % (len(episodes))
    return render(request, "episode.html", {"episodes": episodes, "form": form, "message": message})


def episode_edit(request, id):
    episode = models.episode.objects.get(id=id)

    if request.method == 'POST':
        form = upload_episode_form(request.POST, request.FILES, instance=episode)

        if form.is_valid():
            form.save()


            # 处理表单提交后的逻辑，比如重定向到详情页或其他页面
            return redirect('/base/episode')
        else:
            return render(request, "episode_edit.html", {"form": form})
    form = upload_episode_form(instance=episode)

    return render(request, "episode_edit.html", {"form": form})


def episode_new(request):
    webform = upload_episode_form()
    if request.method == "GET":
        return render(request, "episode_new.html", {"form": webform})
    form = upload_episode_form(request.POST, request.FILES)
    if form.is_valid():
        form.save()
        return render(request, "episode_new.html", {"form": form, "message": "新增%s成功" % form.cleaned_data["title"]})
    return render(request, "episode_new.html", {"form": form, "message": "新增失败"})
