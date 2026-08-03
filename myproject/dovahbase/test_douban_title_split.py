from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from dovahbase.api.douban import (
    TITLE_SPLIT_SYSTEM_PROMPT,
    _split_douban_title,
    run_douban_spider,
)


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

    def test_prompt_tells_model_title_order_is_not_fixed(self):
        self.assertIn("排列顺序不固定", TITLE_SPLIT_SYSTEM_PROMPT)
        self.assertIn("不能简单按第一个空格切分", TITLE_SPLIT_SYSTEM_PROMPT)

    @patch("dovahbase.api.douban.fast_model_providers")
    @patch("openai.OpenAI")
    def test_model_can_classify_original_title_before_chinese_title(
        self,
        openai_client,
        providers,
    ):
        providers.return_value = self.providers[:1]
        primary = Mock()
        primary.chat.completions.create.return_value = completion(
            '{"title":"这个杀手不太冷","original_title":"Léon"}'
        )
        openai_client.return_value = primary

        result = _split_douban_title("Léon 这个杀手不太冷")

        self.assertEqual(result, ("这个杀手不太冷", "Léon"))

    @patch("dovahbase.api.douban.cache")
    @patch("dovahbase.api.douban._run_douban_spider_uncached")
    def test_local_fallback_is_only_cached_briefly(self, spider, title_cache):
        title_cache.get.return_value = None
        spider.return_value = {
            "success": True,
            "title": "Léon",
            "original_title": "这个杀手不太冷",
            "_title_split_used_fallback": True,
        }

        result = run_douban_spider("Léon")

        self.assertNotIn("_title_split_used_fallback", result)
        self.assertEqual(title_cache.set.call_args.kwargs["timeout"], 3 * 60)
        self.assertIn("douban:lookup:v2:", title_cache.set.call_args.args[0])

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
