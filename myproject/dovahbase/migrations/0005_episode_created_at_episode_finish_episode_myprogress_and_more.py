# Generated by Django 5.0.3 on 2024-07-01 09:50

import django.utils.timezone
import dovahbase.models
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("dovahbase", "0004_alter_episode_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="episode",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                default=django.utils.timezone.now,
                verbose_name="创建时间",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="episode",
            name="finish",
            field=models.BooleanField(default=False, verbose_name="完成观看"),
        ),
        migrations.AddField(
            model_name="episode",
            name="myprogress",
            field=models.CharField(
                blank=True, max_length=20, null=True, verbose_name="我的进度"
            ),
        ),
        migrations.AddField(
            model_name="episode",
            name="pic",
            field=models.ImageField(
                blank=True, null=True, upload_to="Base/episode/pic", verbose_name="封面"
            ),
        ),
        migrations.AddField(
            model_name="episode",
            name="release_time",
            field=models.CharField(
                default="2024 1",
                max_length=7,
                validators=[dovahbase.models.validate_year_month],
                verbose_name="放送时间",
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="episode",
            name="resource",
            field=models.TextField(
                blank=True, default="", null=True, verbose_name="资源信息"
            ),
        ),
        migrations.AddField(
            model_name="episode",
            name="review",
            field=models.TextField(blank=True, null=True, verbose_name="我的想法"),
        ),
        migrations.AlterField(
            model_name="manga",
            name="pic",
            field=models.ImageField(
                blank=True, null=True, upload_to="Base/manga/pic", verbose_name="封面"
            ),
        ),
        migrations.AlterField(
            model_name="manga",
            name="status",
            field=models.CharField(
                choices=[
                    ("连载中", "连载中"),
                    ("停更", "停更"),
                    ("完结", "完结"),
                    ("独立作品", "独立作品"),
                    ("衍生作品", "衍生作品"),
                ],
                default="连载中",
                max_length=10,
                verbose_name="连载状态",
            ),
        ),
    ]
