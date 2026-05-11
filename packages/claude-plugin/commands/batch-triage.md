Use VeracityAPI to triage a bounded batch of user-provided text items.

Workflow:
1. Confirm the batch is in scope and bounded.
2. Call `check_balance` before running the batch.
3. Use `analyze_batch` for text snippets, claims, comments, captions, listings, or search results.
4. Use `store_content:false` by default.
5. Summarize counts by `recommended_action`: allow, revise, human_review, reject.
6. Highlight the highest-risk items with evidence and recommended fixes.
7. If any item fails, report partial failures separately and do not hide them.

Avoid unbounded autonomous runs unless the user explicitly confirms scope and spend.
