from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase

from dovahwall.views import main as main_view
from dovahwall.views.site_settings import logout, settings_page


CURRENT_CONFIG = {
    "models": {"fast": "old-fast", "full": "old-full"},
    "providers": [
        {
            "name": "existing",
            "api_key": "existing-secret",
            "base_url": "https://existing.example/v1",
            "timeout": 15,
            "max_retries": 0,
        }
    ],
}

TWO_PROVIDER_CONFIG = {
    "models": {"fast": "old-fast", "full": "old-full"},
    "providers": [
        {
            "name": "aliyun",
            "api_key": "aliyun-secret",
            "base_url": "https://aliyun.example/v1",
            "enabled": True,
            "timeout": 15,
            "max_retries": 0,
        },
        {
            "name": "deepseek",
            "api_key": "deepseek-secret",
            "base_url": "https://deepseek.example/v1",
            "enabled": True,
            "timeout": 15,
            "max_retries": 0,
        },
    ],
}


def authenticated(request):
    request.session = {"info": {"id": 1, "user": "admin"}}
    return request


class SiteSettingsTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @patch("dovahwall.views.site_settings.load_config", return_value=CURRENT_CONFIG)
    def test_settings_page_never_renders_existing_api_key(self, _load_config):
        request = authenticated(self.factory.get("/settings"))

        response = settings_page(request)

        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertNotIn("existing-secret", content)
        self.assertIn("Key configured", content)
        self.assertIn('action="/settings"', content)

    def test_homepage_shows_settings_entry_for_signed_in_user(self):
        request = authenticated(self.factory.get("/"))

        response = main_view.main(request)

        self.assertContains(response, 'href="/settings"')
        self.assertContains(response, 'aria-label="Site settings"')

    @patch("dovahwall.views.site_settings.save_config")
    @patch("dovahwall.views.site_settings.validate_provider_credentials")
    @patch("dovahwall.views.site_settings.load_config", return_value=CURRENT_CONFIG)
    def test_can_keep_existing_key_add_provider_and_change_models(
        self, _load_config, validate_credentials_mock, save_config_mock
    ):
        request = authenticated(
            self.factory.post(
                "/settings",
                {
                    "fast_model": "new-fast",
                    "full_model": "new-full",
                    "providers-TOTAL_FORMS": "2",
                    "providers-INITIAL_FORMS": "1",
                    "providers-MIN_NUM_FORMS": "1",
                    "providers-MAX_NUM_FORMS": "1000",
                    "providers-0-original_index": "0",
                    "providers-0-name": "existing-renamed",
                    "providers-0-api_key": "",
                    "providers-0-base_url": "https://existing.example/v1",
                    "providers-0-enabled": "on",
                    "providers-0-timeout": "20",
                    "providers-0-max_retries": "1",
                    "providers-0-DELETE": "",
                    "providers-1-original_index": "",
                    "providers-1-name": "new-provider",
                    "providers-1-api_key": "new-secret",
                    "providers-1-base_url": "https://new.example/v1",
                    "providers-1-enabled": "on",
                    "providers-1-timeout": "30",
                    "providers-1-max_retries": "2",
                    "providers-1-DELETE": "",
                },
            )
        )

        response = settings_page(request)

        self.assertEqual(response.status_code, 302)
        saved = save_config_mock.call_args.args[0]
        self.assertEqual(saved["models"], {"fast": "new-fast", "full": "new-full"})
        self.assertEqual(saved["providers"][0]["api_key"], "existing-secret")
        self.assertEqual(saved["providers"][1]["api_key"], "new-secret")
        self.assertEqual(saved["providers"][1]["max_retries"], 2)
        validate_credentials_mock.assert_called_once()
        self.assertEqual(
            validate_credentials_mock.call_args.args[0]["name"], "new-provider"
        )

    @patch("dovahwall.views.site_settings.save_config")
    @patch(
        "dovahwall.views.site_settings.validate_provider_credentials",
        side_effect=ValueError("API authentication failed: Unauthorized"),
    )
    @patch("dovahwall.views.site_settings.load_config", return_value=CURRENT_CONFIG)
    def test_rejects_save_when_the_changed_provider_fails_validation(
        self, _load_config, _validate_credentials, save_config_mock
    ):
        request = authenticated(
            self.factory.post(
                "/settings?saved=1",
                {
                    "fast_model": "old-fast",
                    "full_model": "old-full",
                    "providers-TOTAL_FORMS": "1",
                    "providers-INITIAL_FORMS": "1",
                    "providers-MIN_NUM_FORMS": "1",
                    "providers-MAX_NUM_FORMS": "1000",
                    "providers-0-original_index": "0",
                    "providers-0-name": "existing",
                    "providers-0-api_key": "invalid-new-key",
                    "providers-0-base_url": "https://existing.example/v1",
                    "providers-0-enabled": "on",
                    "providers-0-timeout": "15",
                    "providers-0-max_retries": "0",
                    "providers-0-DELETE": "",
                },
            )
        )

        response = settings_page(request)

        self.assertEqual(response.status_code, 400)
        self.assertContains(response, "Unauthorized", status_code=400)
        self.assertNotContains(response, "Settings saved", status_code=400)
        self.assertNotContains(response, "invalid-new-key", status_code=400)
        save_config_mock.assert_not_called()

    @patch("dovahwall.views.site_settings.save_config")
    @patch("dovahwall.views.site_settings.validate_provider_credentials")
    @patch("dovahwall.views.site_settings.load_config", return_value=CURRENT_CONFIG)
    def test_unchanged_provider_is_not_validated(
        self, _load_config, validate_credentials_mock, save_config_mock
    ):
        request = authenticated(
            self.factory.post(
                "/settings",
                {
                    "fast_model": "old-fast",
                    "full_model": "old-full",
                    "providers-TOTAL_FORMS": "1",
                    "providers-INITIAL_FORMS": "1",
                    "providers-MIN_NUM_FORMS": "1",
                    "providers-MAX_NUM_FORMS": "1000",
                    "providers-0-original_index": "0",
                    "providers-0-name": "existing",
                    "providers-0-api_key": "",
                    "providers-0-base_url": "https://existing.example/v1",
                    "providers-0-enabled": "on",
                    "providers-0-timeout": "15",
                    "providers-0-max_retries": "0",
                    "providers-0-DELETE": "",
                },
            )
        )

        response = settings_page(request)

        self.assertEqual(response.status_code, 302)
        validate_credentials_mock.assert_not_called()
        save_config_mock.assert_called_once()

    @patch("dovahwall.views.site_settings.save_config")
    @patch("dovahwall.views.site_settings.validate_provider_credentials")
    @patch(
        "dovahwall.views.site_settings.load_config",
        return_value=TWO_PROVIDER_CONFIG,
    )
    def test_only_the_edited_provider_is_validated(
        self, _load_config, validate_credentials_mock, _save_config
    ):
        data = {
            "fast_model": "old-fast",
            "full_model": "old-full",
            "providers-TOTAL_FORMS": "2",
            "providers-INITIAL_FORMS": "2",
            "providers-MIN_NUM_FORMS": "1",
            "providers-MAX_NUM_FORMS": "1000",
        }
        for index, provider in enumerate(TWO_PROVIDER_CONFIG["providers"]):
            data.update(
                {
                    f"providers-{index}-original_index": str(index),
                    f"providers-{index}-name": provider["name"],
                    f"providers-{index}-api_key": (
                        "new-deepseek-secret" if index == 1 else ""
                    ),
                    f"providers-{index}-base_url": provider["base_url"],
                    f"providers-{index}-enabled": "on",
                    f"providers-{index}-timeout": "15",
                    f"providers-{index}-max_retries": "0",
                    f"providers-{index}-DELETE": "",
                }
            )
        request = authenticated(self.factory.post("/settings", data))

        response = settings_page(request)

        self.assertEqual(response.status_code, 302)
        validate_credentials_mock.assert_called_once()
        provider = validate_credentials_mock.call_args.args[0]
        self.assertEqual(provider["name"], "deepseek")

    @patch("dovahwall.views.site_settings.save_config")
    @patch("dovahwall.views.site_settings.validate_provider_credentials")
    @patch(
        "dovahwall.views.site_settings.load_config",
        return_value=TWO_PROVIDER_CONFIG,
    )
    def test_model_change_does_not_revalidate_provider_credentials(
        self, _load_config, validate_credentials_mock, _save_config
    ):
        data = {
            "fast_model": "new-fast",
            "full_model": "old-full",
            "providers-TOTAL_FORMS": "2",
            "providers-INITIAL_FORMS": "2",
            "providers-MIN_NUM_FORMS": "1",
            "providers-MAX_NUM_FORMS": "1000",
        }
        for index, provider in enumerate(TWO_PROVIDER_CONFIG["providers"]):
            data.update(
                {
                    f"providers-{index}-original_index": str(index),
                    f"providers-{index}-name": provider["name"],
                    f"providers-{index}-api_key": "",
                    f"providers-{index}-base_url": provider["base_url"],
                    f"providers-{index}-enabled": "on",
                    f"providers-{index}-timeout": "15",
                    f"providers-{index}-max_retries": "0",
                    f"providers-{index}-DELETE": "",
                }
            )
        request = authenticated(self.factory.post("/settings", data))

        response = settings_page(request)

        self.assertEqual(response.status_code, 302)
        validate_credentials_mock.assert_not_called()

    def test_settings_requires_custom_admin_session(self):
        request = self.factory.get("/settings")
        request.session = {}

        response = settings_page(request)

        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "/s/login?next=%2Fsettings")

    def test_logout_flushes_session_and_returns_home(self):
        class Session(dict):
            flushed = False

            def flush(self):
                self.flushed = True
                self.clear()

        request = self.factory.post("/logout")
        request.session = Session(info={"id": 1, "user": "admin"})

        response = logout(request)

        self.assertTrue(request.session.flushed)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.url, "/")
