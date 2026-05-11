#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request

API_BASE = os.environ.get("VERACITYAPI_BASE_URL", "https://api.veracityapi.com")
API_KEY = os.environ.get("VERACITYAPI_KEY")

if not API_KEY:
    raise SystemExit("Set VERACITYAPI_KEY")


def request(path: str, method: str = "POST", payload: dict | None = None) -> dict:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}{path}",
        data=data,
        method=method,
        headers={
            "Authorization": f"Bearer {API_KEY}",
            "Content-Type": "application/json",
            "User-Agent": "veracityapi-python-example/0.1",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8")
        raise RuntimeError(f"{exc.code} {detail}") from exc


def get_balance() -> dict:
    return request("/v1/balance", method="GET")


def analyze_text(text: str) -> dict:
    return request(
        "/v1/analyze",
        payload={
            "type": "text", "content": text,
            "context": {"format": "article", "intended_use": "publish", "domain": "content QA"},
            "store_content": False,
        },
    )


def analyze_image(image_url: str) -> dict:
    return request(
        "/v1/analyze",
        payload={
            "image_url": image_url,
            "context": {"format": "social_post", "intended_use": "publish", "domain": "image trust"},
            "store_content": False,
        },
    )


def analyze_audio(audio_url: str, transcript: str | None = None) -> dict:
    return request(
        "/v1/analyze",
        payload={
            "audio_url": audio_url,
            "transcript": transcript,
            "context": {"format": "social_post", "intended_use": "publish", "domain": "audio workflow triage with transcript return"},
            "store_content": False,
        },
    )


def analyze_batch(items: list[dict]) -> dict:
    return request(
        "/v1/analyze-batch",
        payload={
            "items": items,
            "context": {"format": "article", "intended_use": "publish", "domain": "batch QA"},
            "store_content": False,
        },
    )


if __name__ == "__main__":
    print(json.dumps(get_balance(), indent=2))
    result = analyze_text("This is a specific enough demo sentence only if it includes concrete evidence and context for an agent workflow.")
    print(result.get("recommended_action"), result.get("risk_level"))
