from unittest.mock import mock_open, patch

from django.test import SimpleTestCase

from mysite.ai_models import (
    fast_model,
    fast_model_providers,
    full_model,
    full_model_providers,
)


CONFIG = """
models:
  fast: fast-test-model
  full: full-test-model
providers:
  - name: aliyun
    api_key: ali-secret
    base_url: https://aliyun.example/v1
  - name: second
    api_key: second-secret
    base_url: https://second.example/v1
"""


class AiModelRoutingTests(SimpleTestCase):
    @patch("builtins.open", mock_open(read_data=CONFIG))
    def test_reads_both_models_from_yaml(self):
        self.assertEqual(fast_model(), "fast-test-model")
        self.assertEqual(full_model(), "full-test-model")

    @patch("builtins.open", mock_open(read_data=CONFIG))
    def test_every_provider_receives_the_selected_model_in_yaml_order(self):
        fast = fast_model_providers()
        full = full_model_providers()

        self.assertEqual([provider["name"] for provider in fast], ["aliyun", "second"])
        self.assertEqual([provider["model"] for provider in fast], ["fast-test-model"] * 2)
        self.assertEqual([provider["model"] for provider in full], ["full-test-model"] * 2)

    @patch(
        "builtins.open",
        mock_open(
            read_data="""
models:
  fast: fast-model
  full: full-model
providers:
  - name: missing
    base_url: https://missing.example/v1
  - name: available
    api_key: available-secret
    base_url: https://available.example/v1
  - name: disabled
    api_key: unused-secret
    base_url: https://disabled.example/v1
    enabled: false
"""
        ),
    )
    def test_missing_key_and_disabled_providers_are_skipped(self):
        providers = fast_model_providers()

        self.assertEqual([provider["name"] for provider in providers], ["available"])

    @patch("builtins.open", mock_open(read_data="providers: []"))
    def test_missing_models_reports_clear_error(self):
        with self.assertRaisesRegex(ValueError, "models object"):
            fast_model_providers()

    @patch("builtins.open", mock_open(read_data="not: [valid"))
    def test_invalid_yaml_reports_configuration_error(self):
        with self.assertRaisesRegex(ValueError, "not valid YAML"):
            fast_model_providers()

    @patch("builtins.open", side_effect=FileNotFoundError)
    def test_missing_file_reports_its_path(self, _mock_file):
        with self.assertRaisesRegex(ValueError, "does not exist"):
            fast_model_providers()
