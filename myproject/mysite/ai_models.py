import os

import yaml


def _load_config():
    path = os.environ.get("AI_CONFIG_FILE", "/run/config/ai_config.yaml")
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


def model_name(tier):
    if tier not in {"fast", "full"}:
        raise ValueError("AI model tier must be 'fast' or 'full'")

    models = _load_config().get("models")
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

    config = _load_config()
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
