# Generated by Django 5.0.3 on 2024-07-03 04:12

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("dovahbase", "0011_alter_episode_alternate_titles_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="movie",
            name="watch_date",
            field=models.DateField(null=True, verbose_name="观看时间"),
        ),
    ]
