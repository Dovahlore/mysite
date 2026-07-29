from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from mysite.ai_gateway import stream_chat_completion


class AiGatewayTests(SimpleTestCase):
    providers = [
        {
            "name": "primary",
            "api_key": "primary-key",
            "base_url": "https://primary.example/v1",
            "model": "primary-model",
            "timeout": 30,
            "max_retries": 0,
        },
        {
            "name": "fallback",
            "api_key": "fallback-key",
            "base_url": "https://fallback.example/v1",
            "model": "fallback-model",
            "timeout": 30,
            "max_retries": 0,
        },
    ]

    @patch("openai.OpenAI")
    def test_stream_falls_back_before_the_first_chunk(self, openai_client):
        primary = Mock()
        primary.chat.completions.create.side_effect = TimeoutError("primary timeout")
        fallback = Mock()
        fallback.chat.completions.create.return_value = iter(
            [SimpleNamespace(value="fallback chunk")]
        )
        openai_client.side_effect = [primary, fallback]

        chunks = list(
            stream_chat_completion(
                self.providers,
                messages=[{"role": "user", "content": "hello"}],
            )
        )

        self.assertEqual(chunks[0].value, "fallback chunk")
        self.assertEqual(openai_client.call_count, 2)
