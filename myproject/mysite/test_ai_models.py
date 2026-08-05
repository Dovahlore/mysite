import os
import tempfile
from pathlib import Path
from unittest.mock import mock_open, patch

from django.test import SimpleTestCase

from mysite.ai_models import (
    fast_model,
    fast_model_providers,
    full_model,
    full_model_providers,
    load_config,
    save_config,
    validate_provider_credentials,
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


class AiConfigPersistenceTests(SimpleTestCase):
    def test_saved_config_is_immediately_available_to_model_routing(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            config_file = Path(temporary_directory) / "ai_config.yaml"
            config = {
                "models": {"fast": "fast-live", "full": "full-live"},
                "providers": [
                    {
                        "name": "new-provider",
                        "api_key": "new-secret",
                        "base_url": "https://api.example.com/v1",
                    }
                ],
            }
            with patch.dict(os.environ, {"AI_CONFIG_FILE": str(config_file)}):
                save_config(config)

                self.assertEqual(load_config(), config)
                self.assertEqual(fast_model(), "fast-live")
                self.assertEqual(full_model_providers()[0]["api_key"], "new-secret")

    @patch("openai.OpenAI")
    def test_provider_authentication_uses_timeout_and_retries(self, openai_mock):
        provider = {
            "name": "test",
            "api_key": "secret",
            "base_url": "https://api.example.com/v1",
            "timeout": 12.5,
            "max_retries": 3,
        }

        validate_provider_credentials(provider)

        openai_mock.assert_called_once_with(
            api_key="secret",
            base_url="https://api.example.com/v1",
            timeout=12.5,
            max_retries=3,
        )
        openai_mock.return_value.models.list.assert_called_once_with()
        openai_mock.return_value.chat.completions.create.assert_not_called()

    @patch("openai.OpenAI")
    def test_provider_authentication_failure_redacts_the_key(self, openai_mock):
        client = openai_mock.return_value
        client.models.list.side_effect = ValueError("bad credential: secret-key-123")
        provider = {
            "name": "test",
            "api_key": "secret-key-123",
            "base_url": "https://api.example.com/v1",
            "timeout": 10,
            "max_retries": 0,
        }

        with self.assertRaisesRegex(ValueError, "bad credential: \\[redacted\\]"):
            validate_provider_credentials(provider)

        client.models.list.assert_called_once_with()

    @patch("openai.OpenAI")
    def test_rejected_key_has_a_concise_error(self, openai_mock):
        class AuthenticationFailure(Exception):
            status_code = 401

        client = openai_mock.return_value
        client.models.list.side_effect = AuthenticationFailure("large response body")
        provider = {
            "name": "test",
            "api_key": "invalid",
            "base_url": "https://api.example.com/v1",
            "timeout": 10,
            "max_retries": 0,
        }

        with self.assertRaisesRegex(ValueError, "API key was rejected \\(HTTP 401\\)"):
            validate_provider_credentials(provider)
