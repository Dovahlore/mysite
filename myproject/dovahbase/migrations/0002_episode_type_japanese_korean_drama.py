from django.db import migrations, models


EPISODE_TYPES = (
    "动画番剧",
    "国产剧",
    "日韩剧",
    "欧美剧集",
    "纪录片",
    "其他",
)


def change_type_to_mysql_enum(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    values = ", ".join(f"'{value}'" for value in EPISODE_TYPES)
    schema_editor.execute(
        f"ALTER TABLE `dovahbase_episode` "
        f"MODIFY `type` ENUM({values}) CHARACTER SET utf8mb4 NOT NULL"
    )


def change_type_to_varchar(apps, schema_editor):
    if schema_editor.connection.vendor != "mysql":
        return
    schema_editor.execute(
        "ALTER TABLE `dovahbase_episode` "
        "MODIFY `type` VARCHAR(4) CHARACTER SET utf8mb4 NOT NULL"
    )


class Migration(migrations.Migration):
    atomic = False

    dependencies = [
        ("dovahbase", "0001_initial"),
    ]

    operations = [
        migrations.RunSQL(
            "UPDATE `dovahbase_episode` SET `type` = '日韩剧' WHERE `type` = '日韩剧集'",
            reverse_sql=(
                "UPDATE `dovahbase_episode` "
                "SET `type` = '日韩剧集' WHERE `type` = '日韩剧'"
            ),
        ),
        migrations.AlterField(
            model_name="episode",
            name="type",
            field=models.CharField(
                choices=[
                    ("动画番剧", "动画番剧"),
                    ("国产剧", "国产剧"),
                    ("日韩剧", "日韩剧"),
                    ("欧美剧集", "欧美剧集"),
                    ("纪录片", "纪录片"),
                    ("其他", "其他"),
                ],
                default="动画番剧",
                max_length=4,
                verbose_name="剧集类型",
            ),
        ),
        migrations.RunPython(change_type_to_mysql_enum, change_type_to_varchar),
    ]
