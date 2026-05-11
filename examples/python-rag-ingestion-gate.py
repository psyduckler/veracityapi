#!/usr/bin/env python3
"""Gate RAG/source documents before embedding them."""

import sys
from veracityapi import VeracityAPI

client = VeracityAPI()


def verify(text: str) -> dict:
    return client.analyze_text(
        text,
        context={
            "intended_use": "train",
            "domain": "rag_ingestion",
            "custom_policy": "Flag unsupported medical, financial, legal, or factual claims as human_review unless the source has clear provenance.",
        },
    )


def route(text: str) -> str:
    result = verify(text)
    action = result["recommended_action"]
    if action in {"allow", "revise"}:
        # embed(text) or embed(result.get("revised_text", text))
        return "embed"
    if action == "human_review":
        # quarantine_for_review(text, result)
        return "quarantine"
    if action == "reject":
        # drop(text, result)
        return "drop"
    raise ValueError(f"Unknown recommended_action: {action}")


if __name__ == "__main__":
    text = sys.stdin.read().strip() or "This supplement cures diabetes in 3 days with no side effects, according to unnamed experts."
    print(route(text))
