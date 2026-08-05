from copy import deepcopy
from urllib.parse import urlencode

from django import forms
from django.forms import formset_factory
from django.shortcuts import redirect, render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from mysite.ai_models import load_config, save_config, validate_provider_credentials


INPUT_CLASS = "settings-input"


class ModelSettingsForm(forms.Form):
    fast_model = forms.CharField(
        label="Fast model",
        max_length=200,
        widget=forms.TextInput(attrs={"class": INPUT_CLASS, "autocomplete": "off"}),
    )
    full_model = forms.CharField(
        label="Full model",
        max_length=200,
        widget=forms.TextInput(attrs={"class": INPUT_CLASS, "autocomplete": "off"}),
    )


class ProviderSettingsForm(forms.Form):
    original_index = forms.IntegerField(required=False, widget=forms.HiddenInput())
    name = forms.CharField(
        label="Name",
        max_length=80,
        widget=forms.TextInput(attrs={"class": INPUT_CLASS, "autocomplete": "off"}),
    )
    api_key = forms.CharField(
        label="API key",
        required=False,
        max_length=500,
        strip=True,
        widget=forms.PasswordInput(
            attrs={
                "class": INPUT_CLASS,
                "autocomplete": "new-password",
                "placeholder": "Leave blank to keep the current key",
            },
            render_value=False,
        ),
    )
    base_url = forms.URLField(
        label="Base URL",
        max_length=500,
        widget=forms.URLInput(
            attrs={"class": INPUT_CLASS, "placeholder": "https://example.com/v1"}
        ),
    )
    enabled = forms.BooleanField(label="Enabled", required=False, initial=True)
    timeout = forms.FloatField(
        label="Timeout (seconds)",
        min_value=0.1,
        max_value=600,
        initial=15,
        widget=forms.NumberInput(attrs={"class": INPUT_CLASS, "step": "0.1"}),
    )
    max_retries = forms.IntegerField(
        label="Max retries",
        min_value=0,
        max_value=10,
        initial=0,
        widget=forms.NumberInput(attrs={"class": INPUT_CLASS}),
    )


ProviderFormSet = formset_factory(
    ProviderSettingsForm,
    extra=0,
    can_delete=True,
    min_num=1,
    validate_min=True,
)


def _login_redirect(request):
    query = urlencode({"next": request.get_full_path()})
    return redirect(f"{reverse('login')}?{query}")


def _provider_initial(provider, index):
    return {
        "original_index": index,
        "name": provider.get("name", ""),
        "api_key": "",
        "base_url": provider.get("base_url", ""),
        "enabled": provider.get("enabled", True) is not False,
        "timeout": provider.get("timeout", 15),
        "max_retries": provider.get("max_retries", 0),
    }


def _mark_configured_keys(provider_formset, existing_providers):
    for provider_form in provider_formset.forms:
        raw_index = provider_form["original_index"].value()
        try:
            original_index = int(raw_index)
        except (TypeError, ValueError):
            original_index = None
        provider_form.key_is_configured = bool(
            original_index is not None
            and 0 <= original_index < len(existing_providers)
            and str(existing_providers[original_index].get("api_key") or "").strip()
        )


def _build_provider_config(provider_formset, existing_providers):
    providers = []
    provider_changes = []
    claimed_indexes = set()

    for provider_form in provider_formset.forms:
        if not provider_form.cleaned_data or provider_form.cleaned_data.get("DELETE"):
            continue

        original_index = provider_form.cleaned_data.get("original_index")
        existing = {}
        if original_index is not None:
            if (
                original_index < 0
                or original_index >= len(existing_providers)
                or original_index in claimed_indexes
            ):
                provider_form.add_error(
                    "original_index",
                    "This provider changed while the page was open. Reload and try again.",
                )
                continue
            claimed_indexes.add(original_index)
            existing = deepcopy(existing_providers[original_index])

        api_key = provider_form.cleaned_data.get("api_key", "").strip()
        if not api_key:
            api_key = str(existing.get("api_key") or "").strip()
        if (original_index is None or provider_form.cleaned_data.get("enabled")) and not api_key:
            provider_form.add_error("api_key", "A new or enabled provider requires an API key.")
            continue

        previous_api_key = str(existing.get("api_key") or "").strip()
        previous_base_url = str(existing.get("base_url") or "").strip()
        was_enabled = existing.get("enabled", True) is not False
        existing.update(
            {
                "name": provider_form.cleaned_data["name"].strip(),
                "api_key": api_key,
                "base_url": provider_form.cleaned_data["base_url"].strip(),
                "enabled": provider_form.cleaned_data.get("enabled", False),
                "timeout": provider_form.cleaned_data["timeout"],
                "max_retries": provider_form.cleaned_data["max_retries"],
            }
        )
        providers.append(existing)
        provider_changes.append(
            (
                provider_form,
                existing,
                (
                    original_index is None
                    or api_key != previous_api_key
                    or existing["base_url"] != previous_base_url
                    or (not was_enabled and existing["enabled"])
                ),
            )
        )

    return providers, provider_changes


def _render_settings(
    request,
    model_form,
    provider_formset,
    existing_providers,
    *,
    config_error="",
    status=200,
):
    _mark_configured_keys(provider_formset, existing_providers)
    return render(
        request,
        "settings.html",
        {
            "model_form": model_form,
            "provider_formset": provider_formset,
            "config_error": config_error,
            "saved": request.method == "GET" and request.GET.get("saved") == "1",
            "current_user": request.session.get("info", {}).get("user", ""),
        },
        status=status,
    )


@require_http_methods(["GET", "POST"])
def settings_page(request):
    if not request.session.get("info"):
        return _login_redirect(request)

    try:
        config = load_config()
    except (OSError, ValueError) as exc:
        empty_models = ModelSettingsForm(request.POST or None)
        empty_providers = ProviderFormSet(request.POST or None, prefix="providers")
        return _render_settings(
            request,
            empty_models,
            empty_providers,
            [],
            config_error=str(exc),
            status=500,
        )

    models = config.get("models") if isinstance(config.get("models"), dict) else {}
    existing_providers = (
        config.get("providers") if isinstance(config.get("providers"), list) else []
    )
    existing_providers = [
        provider for provider in existing_providers if isinstance(provider, dict)
    ]

    if request.method == "GET":
        model_form = ModelSettingsForm(
            initial={
                "fast_model": models.get("fast", ""),
                "full_model": models.get("full", ""),
            }
        )
        provider_initial = [
            _provider_initial(provider, index)
            for index, provider in enumerate(existing_providers)
        ] or [_provider_initial({}, None)]
        provider_formset = ProviderFormSet(initial=provider_initial, prefix="providers")
        return _render_settings(
            request, model_form, provider_formset, existing_providers
        )

    model_form = ModelSettingsForm(request.POST)
    provider_formset = ProviderFormSet(request.POST, prefix="providers")
    if model_form.is_valid() and provider_formset.is_valid():
        providers, provider_changes = _build_provider_config(
            provider_formset, existing_providers
        )
        if not any(provider_form.errors for provider_form in provider_formset.forms):
            updated_config = deepcopy(config)
            updated_models = (
                deepcopy(models) if isinstance(models, dict) else {}
            )
            updated_models.update(
                {
                    "fast": model_form.cleaned_data["fast_model"].strip(),
                    "full": model_form.cleaned_data["full_model"].strip(),
                }
            )
            validation_failed = False
            for provider_form, provider, requires_auth_validation in provider_changes:
                if not requires_auth_validation:
                    continue
                try:
                    validate_provider_credentials(provider)
                except (OSError, ValueError) as exc:
                    provider_form.add_error(None, str(exc))
                    validation_failed = True

            if validation_failed:
                return _render_settings(
                    request,
                    model_form,
                    provider_formset,
                    existing_providers,
                    status=400,
                )

            updated_config["models"] = updated_models
            updated_config["providers"] = providers
            try:
                save_config(updated_config)
            except OSError as exc:
                return _render_settings(
                    request,
                    model_form,
                    provider_formset,
                    existing_providers,
                    config_error=f"Could not save AI configuration: {exc}",
                    status=500,
                )
            return redirect(f"{reverse('site_settings')}?saved=1")

    return _render_settings(
        request,
        model_form,
        provider_formset,
        existing_providers,
        status=400,
    )


@require_POST
def logout(request):
    request.session.flush()
    return redirect("mainpage")
