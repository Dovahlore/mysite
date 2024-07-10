import uuid
from django.db import models
from PIL import Image,ImageOps
from PIL.ExifTags import TAGS
import datetime
import os
# Create your models here.
class admin(models.Model):
    user = models.CharField(max_length=32)
    password = models.CharField(max_length=32)
    created_at = models.DateTimeField(auto_now_add=True)


class tag(models.Model):
    tag = models.CharField(max_length=20)
    def __str__(self):
        return str(self.tag)


class photo(models.Model):
    pic = models.ImageField(upload_to='Wall/%Y/%m/org/')
    small_pic =models.FilePathField()
    created_at = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=32)
    tags = models.ManyToManyField(to=tag)
    information = models.CharField(max_length=100, default="")
    img_h = models.IntegerField(default=1080)
    img_w = models.IntegerField(default=1980)
    flex = models.DecimalField(max_digits=5, decimal_places=2)
    camera_exif = models.CharField(max_length=300, default="未知")
    like=models.IntegerField(default=0)

    def save(self, *args, **kwargs):
        image = Image.open(self.pic)
        self.img_h = image.size[1]
        self.img_w = image.size[0]
        height=270
        exif_data = image._getexif()
        if exif_data:
            if 274 in exif_data:
                if exif_data[274] in [6, 8, 5, 7]:
                    self.img_h = image.size[0]
                    self.img_w = image.size[1]

            strs = ""
            for k in [271, 272, 36867, 34855, 42036, 33434, 37386, 33437]:
                if k in exif_data:
                    strs += TAGS[k] + ": " + str(exif_data[k]) + "\n"

            self.camera_exif = strs
        else:
            self.camera_exif = "unknown"
        ratio = height/self.img_h
        self.flex = int(ratio *self.img_w)
        image = ImageOps.exif_transpose(image)
        image=image.resize((self.flex,height))
        random_name=f'{uuid.uuid4()}.'
        format=str(self.pic).split('.')[-1]
        p=datetime.datetime.now().strftime("media/Wall/%Y/%m/" + random_name + format)
        self.small_pic=p
        super().save(*args, **kwargs)
        image.save(p)

    def update(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        # 先删除图像文件
        if self.pic:
            if os.path.isfile(self.pic.path):
                os.remove(self.pic.path)
            if os.path.isfile(self.small_pic):
                os.remove(self.small_pic)
            # 然后删除模型对象
        # 然后删除模型对象
        super().delete(*args, **kwargs)








