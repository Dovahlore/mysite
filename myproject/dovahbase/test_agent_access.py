from django.test import TestCase
from django.urls import reverse


class AgentGuestAccessTests(TestCase):
    def test_personal_homepage_does_not_mount_agent_widget(self):
        response = self.client.get("/")

        self.assertEqual(response.status_code, 200)
        self.assertNotContains(response, 'data-mode="widget"')

    def test_guest_can_view_agent_page_in_preview_mode(self):
        response = self.client.get(reverse("agent_page"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-authenticated="false"')
        self.assertContains(response, "访客预览")
        self.assertContains(response, "登录后可向 Site Assistant 提问")

    def test_guest_cannot_access_agent_features(self):
        history = self.client.get(reverse("agent_history"))
        chat = self.client.post(
            reverse("agent_chat"),
            data='{"message": "hello"}',
            content_type="application/json",
        )
        clear = self.client.post(
            reverse("agent_clear"),
            data="{}",
            content_type="application/json",
        )

        self.assertEqual(history.status_code, 401)
        self.assertEqual(chat.status_code, 401)
        self.assertEqual(clear.status_code, 401)

    def test_logged_in_user_gets_interactive_agent_page(self):
        session = self.client.session
        session["info"] = {"id": 1, "user": "tester"}
        session.save()

        response = self.client.get(reverse("agent_page"))

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-authenticated="true"')
        self.assertNotContains(response, "访客预览")
