import os
import tempfile
from pathlib import Path

import yaml


def config_path():
    return Path(os.environ.get("AI_CONFIG_FILE", "/run/config/ai_config.yaml"))


def load_config():
    path = config_path()
    try:
        with open(path, encoding="utf-8") as config_file:
            config = yaml.safe_load(config_file)
    except FileNotFoundError as exc:
        raise ValueError(f"AI config file does not exist: {path}") from exc
    except yaml.YAMLError as exc:
        raise ValueError(f"AI config file is not valid YAML: {path}: {exc}") from exc

    if not isinstance(config, dict):
        raise ValueError("AI config must be a YAML object")
    return config


def save_config(config):
    """Persist validated AI settings, including through a Docker file mount."""
    if not isinstance(config, dict):
        raise ValueError("AI config must be a YAML object")

    serialized = yaml.safe_dump(
        config,
        allow_unicode=True,
        default_flow_style=False,
        sort_keys=False,
    )
    path = config_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_file.write(serialized)
            temporary_file.flush()
            os.fsync(temporary_file.fileno())
            temporary_path = Path(temporary_file.name)
        try:
            os.replace(temporary_path, path)
            temporary_path = None
        except OSError:
            # Docker bind-mounted files cannot be replaced as directory entries.
            # The mount is writable, so update its contents after the complete
            # replacement file has been prepared and flushed.
            with open(path, "w", encoding="utf-8") as config_file:
                config_file.write(serialized)
                config_file.flush()
                os.fsync(config_file.fileno())
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def validate_provider_credentials(provider):
    """Verify an OpenAI-compatible base URL and API key without invoking a model."""
    from openai import OpenAI

    client = OpenAI(
        api_key=provider["api_key"],
        base_url=provider["base_url"],
        timeout=provider.get("timeout", 30.0),
        max_retries=provider.get("max_retries", 0),
    )
    try:
        client.models.list()
    except Exception as exc:
        status_code = getattr(exc, "status_code", None)
        if status_code in {401, 403}:
            message = f"The API key was rejected (HTTP {status_code})."
        else:
            message = " ".join(str(exc).split())[:500]
            api_key = str(provider.get("api_key") or "")
            if len(api_key) >= 8:
                message = message.replace(api_key, "[redacted]")
        raise ValueError(f"API authentication failed: {message}") from exc


# Retain the private name for existing callers and tests.
_load_config = load_config


def model_name(tier):
    if tier not in {"fast", "full"}:
        raise ValueError("AI model tier must be 'fast' or 'full'")

    models = load_config().get("models")
    if not isinstance(models, dict):
        raise ValueError("AI config requires a models object")
    model = str(models.get(tier) or "").strip()
    if not model:
        raise ValueError(f"AI config requires models.{tier}")
    return model


def fast_model():
    return model_name("fast")


def full_model():
    return model_name("full")


def model_providers(tier):
    """Attach the selected model to providers in YAML declaration order."""
    if tier not in {"fast", "full"}:
        raise ValueError("AI provider tier must be 'fast' or 'full'")

    config = load_config()
    models = config.get("models")
    if not isinstance(models, dict):
        raise ValueError("AI config requires a models object")
    model = str(models.get(tier) or "").strip()
    if not model:
        raise ValueError(f"AI config requires models.{tier}")

    provider_catalog = config.get("providers")
    if not isinstance(provider_catalog, list):
        raise ValueError("AI config requires a providers array")
    selected = []
    for index, provider_config in enumerate(provider_catalog, start=1):
        if not isinstance(provider_config, dict):
            raise ValueError(f"AI provider #{index} must be a YAML object")
        if provider_config.get("enabled", True) is False:
            continue

        api_key = str(provider_config.get("api_key") or "").strip()
        if not api_key:
            continue

        name = str(provider_config.get("name") or f"provider-{index}").strip()
        base_url = str(provider_config.get("base_url") or "").strip()
        if not base_url:
            raise ValueError(f"AI provider {name} requires base_url")
        selected.append(
            {
                "name": name,
                "api_key": api_key,
                "base_url": base_url,
                "model": model,
                "timeout": float(
                    provider_config.get("timeout", 15 if tier == "fast" else 30)
                ),
                "max_retries": int(provider_config.get("max_retries", 0)),
            }
        )

    return selected


def fast_model_providers():
    return model_providers("fast")


def full_model_providers():
    return model_providers("full")
