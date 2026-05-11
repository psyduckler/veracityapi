# veracityapi

Python client SDK for VeracityAPI content trust scoring.

VeracityAPI returns an action contract your app can route on: `allow`, `revise`, `human_review`, or `reject`.

## Install

```bash
pip install veracityapi
```

## Quickstart

```py
from veracityapi import VeracityAPI

client = VeracityAPI()  # reads VERACITY_API_KEY

result = client.analyze_text(
    "Travelers should always be careful in tourist areas because scams can happen anywhere.",
    auto_revise=True,
    context={"format": "article", "intended_use": "publish", "domain": "travel safety"},
)

if result["recommended_action"] == "human_review":
    print(result["evidence"])
```

## Helpers

```py
client.analyze({"type": "text", "content": text, "store_content": False})
client.analyze_text(text, auto_revise=True, context={"intended_use": "publish"})
client.analyze_image("https://cdn.example.com/photo.webp")
client.analyze_audio("https://cdn.example.com/voice.mp3", transcript="optional transcript")
client.analyze_batch(items=[{"id": "one", "text": text}])
client.get_balance()
```

Image/audio helper methods force `store_content=False`; VeracityAPI does not retain raw media bytes, base64 payloads, or full media URLs for media analysis.

## Local release checks

```bash
PYTHONPATH=src python -m unittest discover -s tests -v
python -m build --sdist --wheel
python -m twine check dist/*
```

## Errors

Non-2xx responses raise `VeracityAPIError` with:

- `status`
- `body`
- `request_id` when the API returns `x-request-id`
- a safe message that does not include your API key
