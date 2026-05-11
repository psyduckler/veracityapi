Use the VeracityAPI MCP tools to check the user's text for workflow risk.

If the text to review is not already provided, ask the user for the text and intended use.

When text is available:
1. Call `analyze_text` or `verify_content` with `store_content:false`.
2. Include context when possible:
   - `format`: article, social_post, product_review, caption, or other
   - `intended_use`: publish, train, cite, moderate, or other
   - `domain`: short topic hint
3. Report `recommended_action`, risk level/score, top evidence, recommended fixes, and limitations.
4. Treat the result as workflow-risk triage, not forensic proof of authorship.
