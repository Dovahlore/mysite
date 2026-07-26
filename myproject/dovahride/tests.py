import os
from datetime import date, datetime, timezone
from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Ride
from .services.igpsport import IGPSportClient
from .services.importer import find_existing_ride


class RideDeduplicationTests(TestCase):
    def make_ride(self, **overrides):
        values = {
            "data_file": "ride/raw/test.fit",
            "start_time": datetime(2026, 7, 25, 2, 30, tzinfo=timezone.utc),
            "total_distance": 35.2,
            "total_duration": 3600,
        }
        values.update(overrides)
        return Ride.objects.create(**values)

    def test_external_source_id_is_unique(self):
        self.make_ride(source=Ride.Source.IGPSPORT, external_id="ride-1")

        with self.assertRaises(IntegrityError), transaction.atomic():
            self.make_ride(source=Ride.Source.IGPSPORT, external_id="ride-1")

    def test_existing_manual_import_is_matched_by_ride_fingerprint(self):
        existing = self.make_ride()

        matched = find_existing_ride(
            {
                "start_time": datetime(2026, 7, 25, 2, 30),
                "total_distance": 35.21,
                "total_duration": 3602,
            }
        )

        self.assertEqual(matched, existing)

    @patch.dict(
        os.environ,
        {"IGPSPORT_USERNAME": "test-user", "IGPSPORT_PASSWORD": "test-password"},
    )
    @patch.object(IGPSportClient, "get_download_url")
    @patch.object(IGPSportClient, "list_activities")
    def test_sync_does_not_download_an_existing_external_id(
        self,
        list_activities,
        get_download_url,
    ):
        self.make_ride(source=Ride.Source.IGPSPORT, external_id="ride-1")
        list_activities.return_value = iter([{"rideId": "ride-1"}])
        output = StringIO()

        call_command("sync_igpsport", days=1, stdout=output)

        get_download_url.assert_not_called()
        self.assertIn("1 already present", output.getvalue())


class IGPSportClientTests(TestCase):
    def test_activity_list_is_paginated(self):
        client = IGPSportClient("user", "password")
        client.token = "token"
        responses = [
            {"rows": [{"rideId": 1}], "totalPage": 2},
            {"rows": [{"rideId": 2}], "totalPage": 2},
        ]

        with patch.object(client, "_request_json", side_effect=responses) as request:
            activities = list(
                client.list_activities(date(2026, 7, 1), date(2026, 7, 14))
            )

        self.assertEqual([item["rideId"] for item in activities], [1, 2])
        self.assertEqual(request.call_count, 2)
        self.assertIn("beginTime=2026-07-01", request.call_args_list[0].args[0])
