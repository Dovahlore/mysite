def stream_chat_completion(providers, **kwargs):
    """Stream from the first provider that produces a first response chunk."""
    from openai import OpenAI

    failures = []
    for provider in providers:
        try:
            client = OpenAI(
                api_key=provider["api_key"],
                base_url=provider["base_url"],
                timeout=provider.get("timeout", 30.0),
                max_retries=provider.get("max_retries", 0),
            )
            chunks = iter(
                client.chat.completions.create(
                    model=provider["model"],
                    stream=True,
                    **kwargs,
                )
            )
            first_chunk = next(chunks)
        except Exception as exc:
            failures.append(f"{provider['name']}: {exc}")
            print(f"[{provider['name']} AI stream failed before output] {exc}")
            continue

        yield first_chunk
        yield from chunks
        return

    detail = "; ".join(failures) or "no providers configured"
    raise RuntimeError(f"All AI providers failed: {detail}")
