from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("dovahride", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="ride",
            name="source",
            field=models.CharField(
                choices=[("manual", "Manual upload"), ("igpsport", "iGPSPORT")],
                default="manual",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="ride",
            name="external_id",
            field=models.CharField(blank=True, max_length=100, null=True),
        ),
        migrations.AddConstraint(
            model_name="ride",
            constraint=models.UniqueConstraint(
                fields=("source", "external_id"),
                name="unique_ride_external_source_id",
            ),
        ),
    ]
