from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from dovahbase.api.douban import _split_douban_title


def completion(content):
    return SimpleNamespace(
        choices=[
            SimpleNamespace(
                message=SimpleNamespace(content=content),
            )
        ]
    )


class DoubanTitleSplitTests(SimpleTestCase):
    providers = [
        {
            "name": "primary",
            "api_key": "primary-key",
            "base_url": "https://primary.example/v1",
            "model": "primary-fast",
        },
        {
            "name": "deepseek",
            "api_key": "deepseek-key",
            "base_url": "https://api.deepseek.com",
            "model": "deepseek-v4-flash",
        },
    ]

    @patch("dovahbase.api.douban.fast_model_providers")
    @patch("openai.OpenAI")
    def test_falls_back_to_deepseek_when_primary_request_fails(
        self,
        openai_client,
        providers,
    ):
        providers.return_value = self.providers
        primary = Mock()
        primary.chat.completions.create.side_effect = TimeoutError("primary timeout")
        deepseek = Mock()
        deepseek.chat.completions.create.return_value = completion(
            '{"title":"千与千寻","original_title":"Spirited Away"}'
        )
        openai_client.side_effect = [primary, deepseek]

        result = _split_douban_title("千与千寻 Spirited Away")

        self.assertEqual(result, ("千与千寻", "Spirited Away"))
        self.assertEqual(openai_client.call_count, 2)

    @patch("dovahbase.api.douban.fast_model_providers")
    @patch("openai.OpenAI")
    def test_uses_local_split_when_all_providers_fail(
        self,
        openai_client,
        providers,
    ):
        providers.return_value = self.providers
        primary = Mock()
        primary.chat.completions.create.side_effect = TimeoutError("primary timeout")
        deepseek = Mock()
        deepseek.chat.completions.create.side_effect = TimeoutError("fallback timeout")
        openai_client.side_effect = [primary, deepseek]

        result = _split_douban_title("千与千寻 Spirited Away")

        self.assertEqual(result, ("千与千寻", "Spirited Away"))
