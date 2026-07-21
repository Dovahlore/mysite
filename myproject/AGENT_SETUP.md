# Site Assistant setup

The assistant has two distinct capabilities:

- `get_database_schema` and `query_site_database`: inspect approved application tables and run a single, limited `SELECT` query.
- `create_manga_draft`: prepare a write action, then wait for the user to confirm it in the browser.

## Configure the model

Set these server-side environment variables (for example in the deployment environment or a `.env` file that is not committed):

```env
OPENAI_API_KEY=replace-me
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5-mini
```

`OPENAI_BASE_URL` and `OPENAI_MODEL` may point to any OpenAI-compatible provider, but the chosen model must support function calling.

## Create the database account

Create a dedicated MySQL account instead of using the Django application's root account. Replace the password before running these commands:

```sql
CREATE USER 'dovah_agent_ro'@'%' IDENTIFIED BY 'replace-with-a-long-random-password';
GRANT SELECT ON mysite.dovahbase_% TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahwall_% TO 'dovah_agent_ro'@'%';
GRANT SELECT ON mysite.dovahride_% TO 'dovah_agent_ro'@'%';
FLUSH PRIVILEGES;
```

Then configure the web container:

```env
AGENT_DB_USER=dovah_agent_ro
AGENT_DB_PASSWORD=replace-with-a-long-random-password
AGENT_DB_NAME=mysite
AGENT_DB_HOST=db
AGENT_DB_PORT=3306
```

The assistant will not enable database querying if this separate account is absent. Server-side validation also permits only one `SELECT` statement, only from the three site app table namespaces, limits unbounded queries to 100 rows, rejects comments and known write/locking operations, and returns the executed SQL to the page.

## Adding tools safely

Add a JSON-schema entry to `TOOLS` in `dovahbase/views/agent.py`, then implement the corresponding branch in `_tool_result`. Keep read tools narrow and require browser confirmation for every mutation tool. Do not expose a generic shell, HTTP, Python, ORM, or arbitrary SQL tool to the model.
