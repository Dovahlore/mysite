import os
from datetime import date, datetime, timezone
from io import StringIO
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.management import call_command
from django.db import IntegrityError, transaction
from django.test import TestCase

from .models import Ride, RideSyncRequest, RideSyncState
from .services.igpsport import IGPSportClient
from .services.importer import find_existing_ride, suggest_ride_title


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
        state = RideSyncState.objects.get(pk=1)
        self.assertEqual(state.status, RideSyncState.Status.SUCCESS)
        self.assertEqual(state.last_skipped, 1)

    @patch.dict(
        os.environ,
        {"IGPSPORT_USERNAME": "test-user", "IGPSPORT_PASSWORD": "test-password"},
    )
    @patch.object(IGPSportClient, "list_activities")
    def test_full_sync_queries_without_date_filter(self, list_activities):
        list_activities.return_value = iter([])

        call_command("sync_igpsport", full_sync=True, stdout=StringIO())

        list_activities.assert_called_once_with(None, None)

    @patch.dict(
        os.environ,
        {"IGPSPORT_USERNAME": "test-user", "IGPSPORT_PASSWORD": "test-password"},
    )
    @patch.object(IGPSportClient, "list_activities")
    def test_remote_activity_title_replaces_generated_title(self, list_activities):
        ride = self.make_ride(
            source=Ride.Source.IGPSPORT,
            external_id="ride-1",
            title="2026-07-25 骑行",
        )
        list_activities.return_value = iter(
            [{"rideId": "ride-1", "rideName": "河畔晨骑"}]
        )

        call_command("sync_igpsport", days=1, stdout=StringIO())

        ride.refresh_from_db()
        self.assertEqual(ride.title, "河畔晨骑")


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

    def test_fallback_title_uses_local_time_period(self):
        local_start = datetime(
            2026,
            7,
            25,
            18,
            30,
            tzinfo=ZoneInfo("Asia/Shanghai"),
        )

        self.assertEqual(suggest_ride_title(local_start), "傍晚骑行")


class RideSyncRequestViewTests(TestCase):
    def setUp(self):
        session = self.client.session
        session["info"] = {"id": 1, "user": "admin"}
        session.save()

    def test_full_sync_button_creates_only_one_active_request(self):
        first = self.client.post("/bike/sync/")
        second = self.client.post("/bike/sync/")

        self.assertEqual(first.status_code, 302)
        self.assertEqual(second.status_code, 302)
        self.assertEqual(RideSyncRequest.objects.count(), 1)
        request = RideSyncRequest.objects.get()
        self.assertTrue(request.full_sync)
        self.assertEqual(request.status, RideSyncRequest.Status.PENDING)

    def test_ride_wall_renders_scheduler_health_and_sync_button(self):
        RideSyncState.objects.create(
            pk=1,
            status=RideSyncState.Status.SUCCESS,
            heartbeat_at=datetime.now(timezone.utc),
            last_success_at=datetime.now(timezone.utc),
        )

        response = self.client.get("/s/bike/")

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "同步服务健康")
        self.assertContains(response, "完整同步全部骑行")
