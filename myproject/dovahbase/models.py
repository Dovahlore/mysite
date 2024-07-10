from django.db import models
import re
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator
# Create your models here.
class manga_tag(models.Model):
    tag = models.CharField(max_length=20)
    def __str__(self):
        return str(self.tag)
class movie_tag(models.Model):
    tag = models.CharField(max_length=20)
    def __str__(self):
        return str(self.tag)

class manga(models.Model):
    title=models.CharField(max_length=50, verbose_name="中文标题")
    org_title = models.CharField(max_length=80, verbose_name="原始标题")
    alternate_titles = models.CharField(max_length=100, blank=True,verbose_name="译名/其它译名",default="", null=True)
    author=models.CharField(max_length=20,verbose_name="作者",default="")
    tags = models.ManyToManyField(to=manga_tag,verbose_name="标签", blank=True)
    STATUS_CHOICES = [
        ('连载中', '连载中'),
        ('停更', '停更'),
        ('完结', '完结'),
        ('独立作品', '独立作品'),
        ('衍生作品','衍生作品')
    ]
    status=models.CharField(max_length=10, choices=STATUS_CHOICES,default='连载中',verbose_name="连载状态")
    created_at = models.DateTimeField(auto_now_add=True,verbose_name="创建时间")
    review=models.TextField(verbose_name="我的想法", blank=True, null=True)
    finish=models.BooleanField(default=False,verbose_name="完成阅读")
    myprogress=models.CharField(max_length=20,verbose_name="我的进度", blank=True, null=True)
    pic=models.ImageField(upload_to='Base/manga/pic', blank=True, null=True,verbose_name="封面")
def validate_year_month(value):
    if not re.match(r'^\d{4}-(0?[1-9]|1[0-2])$', value):
        raise ValidationError('日期格式应为YYYY-M或YYYY-MM')
def validate_year(value):
    if value < 1800 or value > 2100:
        raise ValidationError(
            ('年份必须在1800到2100之间'),
            code='invalid_year'
        )
class episode(models.Model):
    title=models.CharField(max_length=50, verbose_name="中文标题")
    org_title = models.CharField(max_length=80, verbose_name="原始标题")
    alternate_titles = models.CharField(max_length=100, blank=True, verbose_name="译名/其它译名", default="", null=True)
    TYPE_CHOICES = [
        ('动画番剧', '动画番剧'),
        ('国产剧', '国产剧'),
        ('欧美剧集', '欧美剧集'),
        ('纪录片', '纪录片'),
        ('其他', '其他')
    ]
    type = models.CharField(max_length=4, choices=TYPE_CHOICES, default='动画番剧', verbose_name="剧集类型")
    pic = models.ImageField(upload_to='Base/episode/pic', blank=True, null=True,verbose_name="封面")
    finish = models.BooleanField(default=False, verbose_name="完成观看")
    review = models.TextField(verbose_name="我的想法", blank=True, null=True)
    release_time = models.CharField(max_length=7, validators=[validate_year_month],verbose_name="放送时间")
    myprogress = models.CharField(max_length=20, verbose_name="我的进度", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    resource=models.TextField(verbose_name="资源信息",default="", blank=True, null=True)
class movie(models.Model):
    title=models.CharField(max_length=50, verbose_name="中文标题")
    org_title = models.CharField(max_length=80, verbose_name="原始标题")
    alternate_titles = models.CharField(max_length=100, blank=True, verbose_name="译名/其它译名", default="", null=True)
    pic = models.ImageField(upload_to='Base/episode/pic', blank=True, null=True,verbose_name="封面")
    review = models.TextField(verbose_name="我的想法", blank=True, null=True)
    release_time = models.IntegerField(validators=[validate_year],verbose_name="上映年份")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="创建时间")
    watch_date= models.DateField(verbose_name="观看时间", null=True)
    resource=models.TextField(verbose_name="资源信息",default="", blank=True, null=True)
    myrate= models.IntegerField(default=80,verbose_name="我的评分", validators=[
        MinValueValidator(0),
        MaxValueValidator(100)
    ])
    tags = models.ManyToManyField(to=movie_tag, verbose_name="标签", blank=True)
