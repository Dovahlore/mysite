from django.shortcuts import render, HttpResponse, redirect
from django import forms
import random
from dovahwall.utils.encrypt import md5
import dovahwall.models as models
from dovahwall.utils.checkcode import check_code
from django.urls import reverse

class loginForm(forms.Form):
    user = forms.CharField(label="管理员账号", max_length=20, required=True,
                           widget=forms.widgets.TextInput(
                               attrs={'placeholder': '输入账号', 'class': 'form-control form-control-lg'}),
                           error_messages={"required": "账户输入不能为空"})
    password = forms.CharField(label="管理员账号", max_length=20, required=True,
                               widget=forms.widgets.PasswordInput(
                                   attrs={'placeholder': '输入密码', 'class': 'form-control form-control-lg'
                                          }), error_messages={"required": "密码输入不能为空"})
    image_code =forms.CharField( max_length=4, required=True,
                               widget=forms.widgets.TextInput(
                                   attrs={'placeholder': '输入验证码', 'class': 'form-control form-control-lg'
                                          }), error_messages={"required": "请输入验证码"})

    def clean_password(self):
        password = self.cleaned_data.get('password')
        return md5(password)


def choose_bg():
    x = random.choice(
        ["bird2.jpg",
"bird4.jpg",
"dogdigging-1.jpg",
"DSC_0684.jpg",
"DSC_0697_1.jpg",
"DSC_0762.jpg",
"DSC_0803.jpg",
"DSC_0826.jpg",
"DSC_0957-已增强-降噪-1.jpg",
"DSC_1106-已增强-降噪.jpg",
"DSC_1109-已增强-降噪.jpg",
"DSC_1111-已增强-降噪.jpg",
"DSC_1119.jpg",
"DSC_1132-已增强-降噪.jpg",
"DSC_1140.jpg",
"DSC_1157-已增强-降噪.jpg",
"DSC_1168-已增强-降噪.jpg",
"DSC_1276-已增强-降噪.jpg",
"DSC_1280-已增强-降噪-1.jpg",
"landscape-1.jpg",
"mount1.jpg",
"mouse-1.jpg",
"operator-1.jpg",
"peak.jpg",
"sunsetcamp-1.jpg",
"sunsetpolls-1.jpg",
"threehillundershade-1.jpg",
"石雕.jpg",
"赛博都市.jpg",])
    str = "/static/img/bg/" + x
    return str


def login(request):
    message=""
    if request.method == "GET":
        form = loginForm()

        return render(request, "login.html", {"bg": choose_bg(), "form": form, "message":  message})
    elif request.method == "POST":
        form = loginForm(data=request.POST)
        if form.is_valid():
            print(form.cleaned_data)
            user_input_code=form.cleaned_data.pop('image_code')
            image_code=request.session.get('image_code',"")
            if image_code =="":
                message="验证码超时失效，请刷新页面后重试！"
                return render(request, "login.html", {"bg": choose_bg(), "form": form, "message": message})
            if image_code.upper()!=user_input_code.upper():
                message="验证码错误！"
                return render(request, "login.html", {"bg": choose_bg(), "form": form, "message": message})

            admin = models.admin.objects.filter(**form.cleaned_data).first()
            if not admin:

                message="账户密码验证失败！"
                return render(request, "login.html", {"bg": choose_bg(), "form": form, "message": message})
                # 跳转到管理界面
            else:
                request.session["info"] = {'id': admin.id, 'user': admin.user}
                request.session.set_expiry(60*24*60*30)
                next_url = request.GET.get('next', reverse('mainpage'))
                return redirect(next_url)


from io import BytesIO


# 生成默认含4个字符验证码的图片
def image_code(request):
    img, code = check_code()
    request.session['image_code']=code
    request.session.set_expiry(60)
    stream=BytesIO()
    img.save(stream,'png')
    return HttpResponse(stream.getvalue())
