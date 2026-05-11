#!/usr/bin/env python3
"""LangGraph-style node for gating documents before RAG ingestion."""

from veracityapi import VeracityAPI

client = VeracityAPI()


def veracity_gate_node(state: dict) -> dict:
    """Expected state: {"document": "..."}. Returns route metadata."""
    text = state["document"]
    result = client.analyze_text(
        text,
        context={
            "intended_use": "train",
            "domain": "rag_ingestion",
            "custom_policy": "Human review if the chunk lacks provenance, cites unverifiable claims, or contains unsupported medical/financial/legal advice.",
        },
    )
    action = result["recommended_action"]
    return {
        **state,
        "veracity": result,
        "route": "embed" if action in ("allow", "revise") else "review" if action == "human_review" else "reject",
    }


def route_after_veracity(state: dict) -> str:
    return state["route"]


# LangGraph sketch:
# graph.add_node("veracity_gate", veracity_gate_node)
# graph.add_conditional_edges("veracity_gate", route_after_veracity, {
#   "embed": "embed_document",
#   "review": "human_review_queue",
#   "reject": "drop_document",
# })
