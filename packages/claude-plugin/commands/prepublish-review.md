Run a VeracityAPI pre-publish review for the content the user wants to publish.

Workflow:
1. Identify the publication surface and content type: article, social post, caption, product page, landing page, or other.
2. If this is a batch or autonomous queue, call `check_balance` first.
3. Use `verify_content` when available; otherwise use `analyze_text`, `analyze_image`, or `analyze_audio` based on the content.
4. Use `store_content:false` unless the user explicitly asks for retention/audit storage.
5. Route by `recommended_action`:
   - `allow`: publish-ready.
   - `revise`: provide concrete edits/fixes before publishing.
   - `human_review`: specify what a human should verify.
   - `reject`: explain why this should not be published in this workflow.
6. Return a concise publish/no-publish recommendation with evidence and limitations.

Do not describe results as forensic proof of AI authorship, manipulation, or speaker identity.
