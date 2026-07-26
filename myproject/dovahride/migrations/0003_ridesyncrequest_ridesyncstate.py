from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("dovahride", "0002_ride_source_external_id"),
    ]

    operations = [
        migrations.CreateModel(
            name="RideSyncState",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("idle", "Idle"),
                            ("running", "Running"),
                            ("success", "Success"),
                            ("failed", "Failed"),
                        ],
                        default="idle",
                        max_length=20,
                    ),
                ),
                ("heartbeat_at", models.DateTimeField(blank=True, null=True)),
                ("last_started_at", models.DateTimeField(blank=True, null=True)),
                ("last_finished_at", models.DateTimeField(blank=True, null=True)),
                ("last_success_at", models.DateTimeField(blank=True, null=True)),
                ("last_message", models.CharField(blank=True, max_length=500)),
                ("last_imported", models.PositiveIntegerField(default=0)),
                ("last_linked", models.PositiveIntegerField(default=0)),
                ("last_skipped", models.PositiveIntegerField(default=0)),
                ("last_failed", models.PositiveIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="RideSyncRequest",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("running", "Running"),
                            ("success", "Success"),
                            ("failed", "Failed"),
                        ],
                        db_index=True,
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("full_sync", models.BooleanField(default=True)),
                ("requested_by", models.CharField(blank=True, max_length=150)),
                ("requested_at", models.DateTimeField(auto_now_add=True)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("message", models.CharField(blank=True, max_length=500)),
            ],
            options={"ordering": ["requested_at"]},
        ),
    ]
