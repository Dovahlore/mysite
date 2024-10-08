# Generated by Django 5.0.3 on 2024-06-10 11:24

from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='admin',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user', models.CharField(max_length=32)),
                ('password', models.CharField(max_length=32)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='tag',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tag', models.CharField(max_length=20)),
            ],
        ),
        migrations.CreateModel(
            name='photo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('pic', models.ImageField(upload_to='Wall/%Y/%m/org/')),
                ('small_pic', models.FilePathField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('title', models.CharField(max_length=32)),
                ('information', models.CharField(default='', max_length=100)),
                ('img_h', models.IntegerField(default=1080)),
                ('img_w', models.IntegerField(default=1980)),
                ('flex', models.DecimalField(decimal_places=2, max_digits=5)),
                ('camera_exif', models.CharField(default='未知', max_length=300)),
                ('like', models.IntegerField(default=0)),
                ('tags', models.ManyToManyField(to='app.tag')),
            ],
        ),
    ]
