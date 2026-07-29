from django.shortcuts import render, HttpResponse, redirect
##test
from django.core.cache import cache
from django.template.loader import render_to_string
from django.test import RequestFactory, SimpleTestCase
from types import SimpleNamespace
from unittest.mock import patch
import pickle
import re

from dovahwall.views import wall as wall_view


class ss:
        def __init__(self):
            self.a=1


def test_cache(request):

    return render(request,"test.html")


class WallCarouselTests(SimpleTestCase):
    @patch("dovahwall.views.wall.render")
    @patch("dovahwall.views.wall._build_photo_timeline", return_value=[])
    @patch("dovahwall.views.wall.random_photos", return_value=[])
    def test_wall_requests_five_carousel_photos(
        self,
        random_photos_mock,
        _timeline_mock,
        render_mock,
    ):
        request = RequestFactory().get("/s/wall")

        wall_view.wall(request)

        random_photos_mock.assert_called_once_with(5)

    def test_wall_renders_five_zoomable_carousel_images(self):
        photos = [
            SimpleNamespace(
                pic=SimpleNamespace(url=f"/media/photo-{index}.jpg"),
                title=f"Photo {index}",
                information=f"Information {index}",
            )
            for index in range(5)
        ]

        html = render_to_string(
            "wall.html",
            {
                "carousel_photos": photos,
                "photo_timeline": [],
            },
        )

        self.assertEqual(html.count('class="d-block w-100 carousel-photo"'), 5)
        self.assertEqual(html.count('data-original="/media/photo-'), 5)

    def test_timeline_keeps_years_visible_and_expands_one_month_group(self):
        timeline = [
            {
                "year": 2026,
                "months": [
                    {"month": 7, "anchor": "photos-2026-07", "photos": []},
                    {"month": 6, "anchor": "photos-2026-06", "photos": []},
                ],
            },
            {
                "year": 2025,
                "months": [
                    {"month": 12, "anchor": "photos-2025-12", "photos": []},
                ],
            },
        ]

        html = render_to_string(
            "wall.html",
            {
                "carousel_photos": [],
                "photo_timeline": timeline,
            },
        )

        self.assertEqual(html.count("data-timeline-year-target="), 2)
        self.assertEqual(html.count("data-timeline-target="), 3)
        self.assertIn('data-timeline-year="2025"', html)
        self.assertEqual(html.count("timeline-year-group is-active"), 1)
        collapsed_years = re.findall(
            r'data-timeline-year-target="[^"]+"[^>]*aria-expanded="false"',
            html,
        )
        self.assertEqual(len(collapsed_years), 1)
        self.assertNotIn("<select", html)
