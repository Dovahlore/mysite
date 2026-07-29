from django.test import SimpleTestCase

from dovahbase.views.agent import _validate_readonly_sql


class AgentReadonlySqlValidationTests(SimpleTestCase):
    allowed_tables = ["dovahride_ride"]

    def test_accepts_unqualified_approved_table(self):
        sql = _validate_readonly_sql(
            "SELECT MAX(total_ascent) FROM dovahride_ride",
            self.allowed_tables,
            allowed_schema="mysite",
        )

        self.assertEqual(
            sql,
            "SELECT MAX(total_ascent) FROM dovahride_ride LIMIT 100",
        )

    def test_accepts_approved_table_qualified_with_current_schema(self):
        sql = _validate_readonly_sql(
            "SELECT MAX(total_ascent) FROM `mysite`.`dovahride_ride`",
            self.allowed_tables,
            allowed_schema="mysite",
        )

        self.assertEqual(
            sql,
            "SELECT MAX(total_ascent) FROM `mysite`.`dovahride_ride` LIMIT 100",
        )

    def test_rejects_approved_table_qualified_with_another_schema(self):
        with self.assertRaisesRegex(ValueError, "outside the approved schema"):
            _validate_readonly_sql(
                "SELECT MAX(total_ascent) FROM other_db.dovahride_ride",
                self.allowed_tables,
                allowed_schema="mysite",
            )
