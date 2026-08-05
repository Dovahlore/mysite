# Site Assistant setup

The assistant has two distinct capabilities:

- `get_database_schema` and `query_site_database`: inspect approved application tables and run a single, limited `SELECT` query.
- `create_manga_draft`: prepare a write action, then wait for the user to confirm it in the browser.

## Configure the model

Copy `ai_config.example.yaml` to `ai_config.yaml`. Models are declared once at
the top, while provider keys and endpoints stay together below them:

```yaml
models:
  fast: deepseek-v4-flash
  full: qwen3.7-max
providers:
  - name: aliyun
    api_key: replace-with-aliyun-key
    base_url: https://dashscope.aliyuncs.com/compatible-mode/v1
  - name: deepseek
    api_key: replace-with-deepseek-key
    base_url: https://api.deepseek.com
```

Providers are tried from top to bottom. The same selected fast or full model is
sent to each provider in turn; a provider that rejects or cannot serve that model
is skipped automatically. The real `ai_config.yaml` is ignored by Git and mounted
only into the web container, so its keys are not stored in the image. After the
first login, models and providers can also be managed from `/settings`; existing
keys are never sent back to the browser, and leaving a key blank keeps its value.
New providers, changed credentials/endpoints, and re-enabled providers call the
OpenAI-compatible model-list endpoint before the file is updated. This verifies
the base URL and API key without invoking or billing a model. Model-only changes
and unchanged credentials do not make validation requests.

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
