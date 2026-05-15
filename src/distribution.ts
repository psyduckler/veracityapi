import { canonicalFooter, canonicalNav, cookieConsentScript, navScript, y2kCss } from "./y2k";
import { CATEGORY_CONTEXT_LINKS, relatedLinksCard } from "./internalLinks";
import { DEMO_VIDEO_SAMPLE, DEMO_VIDEO_URL } from "./demoVideo";

const BASE_URL = "https://veracityapi.com";

export type DistributionPage = {
  path: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  recommend: string[];
  avoid: string[];
  cta: string;
  sections?: Array<{ title: string; body: string }>;
  faq?: Array<{ q: string; a: string }>;
  code?: string;
  demo?: "text" | "image" | "audio" | "video";
  /** First-person practitioner note from Bernard. The EEAT differentiator. */
  practitionerNote?: string;
  /** A specific scenario and outcome — concrete, not generic. */
  realExample?: { setup: string; result: string };
  /** Distinct code-example label so multiple pages don't render identical "Copy-paste routing example" sections. */
  codeLabel?: string;
};

export const DISTRIBUTION_REDIRECTS: Record<string, string> = {
  "/categories/ai-detector-api": "/ai-detection-api",
  "/categories/ai-slop-detection-api": "/ai-content-detector-api",
  "/ai-written-content-detection-api": "/ai-written-content-detection",
  "/ai-generated-content-detector": "/ai-generated-content-detection",
  "/categories/content-trust-api": "/how-it-works",
  "/categories/image-ai-detector-api": "/ai-image-detection-api",
  "/image-ai-detection-api": "/ai-image-detection-api",
  "/ai-generated-image-detector-api": "/ai-image-detection-api",
  "/video-ai-detection-api": "/ai-video-detection-api",
  "/ai-generated-video-detector-api": "/ai-video-detection-api",
};

const policyCode = `switch (result.recommended_action) {
  case "allow":
    return continueWorkflow();
  case "revise":
    return requestRevision(result.evidence, result.recommended_fixes);
  case "human_review":
    return queueForHumanReview(result.evidence);
  case "reject":
    return blockOrQuarantine();
}`;

const langGraphCode = `// Full LangGraph integration with bounded revise loop.
// Replaces the typical "generate → publish" graph with "generate → score → route".
import { StateGraph, END, START } from "@langchain/langgraph";

type ContentState = {
  draft: string;
  domain: string;
  veracity?: {
    recommended_action: "allow" | "revise" | "human_review" | "reject";
    evidence: Array<{ type: string; severity: string; span: string; explanation: string }>;
    recommended_fixes: string[];
    risk_level: "low" | "medium" | "high";
    primary_reason: string;
  };
  revise_attempts: number;
  publish_result?: { url: string; published_at: string };
};

// Node 1: generate a draft (your existing content-generation step).
async function generateNode(state: ContentState): Promise<Partial<ContentState>> {
  const draft = await yourGeneratorFn(state.domain);
  return { draft, revise_attempts: state.revise_attempts ?? 0 };
}

// Node 2: score the draft with VeracityAPI.
async function scoreNode(state: ContentState): Promise<Partial<ContentState>> {
  const response = await fetch("https://api.veracityapi.com/v1/analyze", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.VERACITY_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "text",
      content: state.draft,
      context: { format: "article", intended_use: "publish", domain: state.domain },
      store_content: false,
    }),
  });
  if (!response.ok) throw new Error(\`VeracityAPI \${response.status}\`);
  return { veracity: await response.json() };
}

// Node 3: rewrite using evidence array as the rewrite prompt.
async function rewriteNode(state: ContentState): Promise<Partial<ContentState>> {
  const rewritePrompt = state.veracity!.evidence
    .map(e => \`- \${e.type} (severity: \${e.severity}): \${e.span} — \${e.explanation}\`)
    .join("\\n");
  const revised = await yourRewriteFn(state.draft, rewritePrompt, state.veracity!.recommended_fixes);
  return { draft: revised, revise_attempts: (state.revise_attempts ?? 0) + 1 };
}

// Node 4: publish.
async function publishNode(state: ContentState): Promise<Partial<ContentState>> {
  const result = await yourCmsPublishFn(state.draft);
  return { publish_result: result };
}

// Node 5: escalate to a human (reject or out-of-budget cases).
async function escalateNode(state: ContentState): Promise<Partial<ContentState>> {
  await yourEditorQueueFn(state.draft, state.veracity);
  return {};
}

// Routing logic. Bounded revise loop prevents infinite cost.
function routeAfterScore(state: ContentState): "publish" | "rewrite" | "escalate" {
  if (state.veracity!.recommended_action === "allow") return "publish";
  if (state.revise_attempts >= 3) return "escalate";
  if (state.veracity!.recommended_action === "revise") return "rewrite";
  return "escalate"; // human_review or reject
}

// Build the graph.
const workflow = new StateGraph<ContentState>({
  channels: {
    draft:           { value: (_, b) => b, default: () => "" },
    domain:          { value: (_, b) => b, default: () => "" },
    veracity:        { value: (_, b) => b, default: () => undefined },
    revise_attempts: { value: (_, b) => b, default: () => 0 },
    publish_result:  { value: (_, b) => b, default: () => undefined },
  },
});

workflow.addNode("generate", generateNode);
workflow.addNode("score", scoreNode);
workflow.addNode("rewrite", rewriteNode);
workflow.addNode("publish", publishNode);
workflow.addNode("escalate", escalateNode);

workflow.addEdge(START, "generate");
workflow.addEdge("generate", "score");
workflow.addConditionalEdges("score", routeAfterScore, {
  publish: "publish",
  rewrite: "rewrite",
  escalate: "escalate",
});
workflow.addEdge("rewrite", "score"); // loop back for rescoring
workflow.addEdge("publish", END);
workflow.addEdge("escalate", END);

export const contentGraph = workflow.compile();`;

const claudeToolUseCode = `// Anthropic SDK direct integration: VeracityAPI as a Claude tool.
// Pattern: tool_use in messages.create with a structured definition.
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const veracityTool = {
  name: "verify_content",
  description: "Verify text, image URL, or audio URL for workflow-risk routing. Returns recommended_action: allow, revise, human_review, or reject.",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["text", "image", "audio"] },
      content: { type: "string", description: "Text body OR public HTTPS URL for image/audio" },
      intended_use: { type: "string", enum: ["publish", "cite", "train", "moderate", "other"] },
      domain: { type: "string", description: "Free-form context, e.g. 'travel safety editorial'" },
    },
    required: ["type", "content", "intended_use"],
  },
};

async function callVeracity(input: { type: string; content: string; intended_use: string; domain?: string }) {
  const r = await fetch("https://api.veracityapi.com/v1/analyze", {
    method: "POST",
    headers: {
      "Authorization": \`Bearer \${process.env.VERACITY_API_KEY}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: input.type,
      content: input.content,
      context: { format: "article", intended_use: input.intended_use, domain: input.domain ?? "general" },
      store_content: false,
    }),
  });
  return await r.json();
}

async function runAgent(userMessage: string) {
  let messages: any[] = [{ role: "user", content: userMessage }];

  while (true) {
    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      tools: [veracityTool],
      messages,
    });

    if (response.stop_reason === "end_turn") return response;

    if (response.stop_reason === "tool_use") {
      const toolUse = response.content.find((c: any) => c.type === "tool_use");
      const result = await callVeracity(toolUse.input);
      messages.push({ role: "assistant", content: response.content });
      messages.push({
        role: "user",
        content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) }],
      });
      continue;
    }

    return response;
  }
}`;

const mcpConfig = `{
  "mcpServers": {
    "veracityapi": {
      "command": "npx",
      "args": ["-y", "@veracityapi/mcp"],
      "env": { "VERACITY_API_KEY": "YOUR_API_KEY" }
    }
  }
}`;

const remoteMcpConfig = `{
  "mcpServers": {
    "veracityapi": {
      "url": "https://api.veracityapi.com/mcp",
      "headers": { "Authorization": "Bearer $VERACITY_API_KEY" }
    }
  }
}`;

const UNPUBLISHED_DISTRIBUTION_PATHS = new Set(["/alternatives/reality-defender", "/alternatives/resemble-detect"]);

const ALL_DISTRIBUTION_PAGES: DistributionPage[] = [
  {
    path: "/ai-detection-api",
    title: "AI Detection API for Agent Workflows | VeracityAPI",
    description: "The category page. How AI detection has split into authorship-likelihood detectors and workflow-routing APIs, and which job VeracityAPI is built for.",
    eyebrow: "Category overview",
    h1: "AI detection, but for what your agent does next.",
    lead: "The phrase 'AI detection' has come to mean two different jobs. The first is authorship likelihood: a number that tries to say 'this was probably written by a model.' The second is workflow routing: a decision your software can act on without a human in the loop. VeracityAPI is built for the second job. If your real question is 'what should my code do with this text,' you are in the right place.",
    recommend: [
      "Agent pipelines where the next step depends on the result (publish, queue, rewrite, discard)",
      "Pre-publish QA on programmatic content where you need an action, not a probability to interpret",
      "RAG and training-data hygiene where weak text would compound over millions of inference calls",
      "Moderation queues where evidence spans help a human reviewer decide faster"
    ],
    avoid: [
      "Academic misconduct workflows where the institutional outcome is punitive",
      "Forensic authorship determination — VeracityAPI does not claim to identify who wrote text",
      "Single-score eligibility, employment, or identity decisions",
      "Any context where 'the score said so' would be the stated rationale for a real-world consequence"
    ],
    cta: "If your agent is going to do something with the result — publish, revise, queue, discard — start with the action-first response shape. If a human is going to read a probability and decide, a category-traditional detector may fit better.",
    sections: [
      {
        title: "The category split that's actually happening",
        body: "Around 2024, the 'AI detector' category bifurcated. The original use case (a probability score for academic or editorial review) is still served by GPTZero, Originality.ai, Copyleaks, and others. The newer use case (a deterministic action for autonomous agents) needed a different response shape — evidence spans an agent can branch on, fix-suggestions a rewrite node can consume, and a routing decision the code already understands. VeracityAPI is built for the second category. We do not compete on probability accuracy; we compete on whether your software ships fewer bad outputs to production."
      },
      {
        title: "What the response actually contains",
        body: "Every /v1/analyze call returns: recommended_action ('allow' | 'revise' | 'human_review' | 'reject'), risk_level ('low' | 'medium' | 'high'), content_trust_score (0–1 confidence in workflow usability), specificity_risk and provenance_weakness (for text), synthetic_image_risk or synthetic_audio_risk (for media), evidence (typed span observations), recommended_fixes (string suggestions a rewrite agent can use), limitations (boundary language to display in your UI), and billing metadata. The structure is designed so a `switch (result.recommended_action)` statement is enough to integrate."
      },
      {
        title: "Calibration: what 0.871 macro F1 actually means",
        body: "The published evals report 88.0% routing accuracy and a 0.871 macro F1 on a 500-item seed corpus across human, dry-factual, slop, polished-AI, and adversarial samples. That's the routing-decision agreement metric. It is not a claim that VeracityAPI 'beats' GPTZero or any other competitor; the 2026 benchmark program will report binary-flagging F1 alongside routing-action F1 once vendor terms, corpus licensing, and frozen artifacts are complete. We publish 'where Veracity loses' in advance because the failure modes matter more than the headline number."
      }
    ],
    practitionerNote: "I spent ten years at Clearscope watching content teams chase the wrong number. The 'is this AI?' question is interesting; the 'should I publish this?' question is the one that has revenue attached to it. The reason VeracityAPI was built around recommended_action rather than a probability is that probability scores reliably get misused — teams set a brittle threshold, the model drifts, the threshold no longer means what it used to, and quality silently degrades. Action labels stay stable across model versions because they're tied to the decision, not the score.",
    code: `// The minimum integration shape.
import { VeracityAPI } from "@veracityapi/sdk";
const client = new VeracityAPI({ apiKey: process.env.VERACITY_API_KEY });

const result = await client.analyzeText({
  type: "text",
  content: draft,
  context: { format: "article", intended_use: "publish" }
});

switch (result.recommended_action) {
  case "allow":        return publish(draft);
  case "revise":       return rewriteWith(result.evidence, result.recommended_fixes);
  case "human_review": return queueForReview(draft, result);
  case "reject":       return quarantine(draft, result.primary_reason);
}`,
    codeLabel: "Minimum integration shape",
  },
  {
    path: "/ai-content-detector-api",
    title: "AI Content Detector API for Pre-Publish QA | VeracityAPI",
    description: "Pre-publish quality gate for agent-written content. Wire VeracityAPI into the CMS boundary, route weak drafts back to the rewrite agent with evidence attached.",
    eyebrow: "Use case · pre-publish CMS gate",
    h1: "Pre-publish QA, wired into the CMS boundary.",
    lead: "The cheapest moment to catch a generic draft is the moment before publish. After it ships, you are debugging in Search Console six weeks later. This page is the integration pattern for the CMS-boundary use case specifically: where the gate sits, what payload to send, what to write back into the draft record, and what to track over the first 90 days.",
    recommend: [
      "Programmatic content factories shipping 50+ pages/day where editor headcount can't scale linearly",
      "CMS workflows where a 'pending QA' status already exists and the gate slots into the publish step",
      "Affiliate, comparison, listicle, and travel-safety content where specificity is the differentiator",
      "Teams that want evidence spans as rewrite prompts, not just scores"
    ],
    avoid: [
      "Workflows where every draft has a human editor reading it end-to-end — the gate adds latency without value",
      "One-off long-form content (books, white papers) — score chapter-by-chapter instead via the manuscript QA pattern",
      "Highly templated content (auto-generated reports, transactional emails) — score the unique body only, not the boilerplate"
    ],
    cta: "Start by routing only the drafts that already have a 'pending QA' status. Don't gate everything on day one — calibrate thresholds on a non-blocking shadow run for the first two weeks.",
    sections: [
      {
        title: "Where the gate actually sits",
        body: "WordPress: save_post action hook on status transition pending → publish. Sanity: webhook on document publish. Contentful: workflow stage transition. Headless CMS / custom: the queue worker that promotes drafts to live. Keep the gate idempotent — if a draft fails, gets rewritten, and re-enters the queue, the scoring call should produce a fresh analysis_id and overwrite the rewrite_brief. Otherwise editors read stale evidence and the gate loses credibility within two weeks."
      },
      {
        title: "Payload shape: what to strip before submitting",
        body: "Submit the unique body only. Strip: global navigation, footer, related-posts blocks, recurring CTAs, ad slots, and author-bio chrome. Include: H1/H2 hierarchy, intro, body sections, FAQ schema text, conclusion. The unique-body rule matters because templated chrome inflates 'slop_risk' without telling you anything useful — every page on your site shares the same footer."
      },
      {
        title: "Threshold calibration over the first 90 days",
        body: "Healthy steady-state: 15–35% of generator output gets routed to revise on first pass. If you're seeing >50%, the generator needs prompting changes more than the gate needs threshold loosening. If you're seeing <10%, your gate isn't catching the failure modes — usually the specificity_risk weight needs raising. Track first-pass revise → allow conversion at 70%+; below that, the rewrite agent is paraphrasing instead of adding specifics."
      },
      {
        title: "Cost modeling at scale",
        body: "Analyze-only: $0.005 per 1,000 characters, rounded up. A typical 2,500-word article (~14,000 chars) costs $0.07 per scoring call. At 50 pages/day, that's ~$105/month before the rewrite cycle. Add auto_revise at $0.010 per 1,000 chars on the ~25% that route to revise, and the all-in cost is roughly $0.10 per article shipped. Compare to editor time at $40–80/hour and the math is straightforward — even an editor spending 10 minutes per page costs ~$7–13."
      }
    ],
    faq: [
      { q: "Will this slow down my publish workflow?", a: "Median latency on text scoring is in the low single seconds. For high-volume publishers, the batch endpoint accepts 1–25 items per call; bundle drafts when latency matters more than evidence freshness." },
      { q: "What happens when the API is unavailable?", a: "Fail-open or fail-closed is your local policy decision. Most teams fail open for low-stakes content (route the draft to publish) and fail closed for YMYL content (route to editor queue). Document the decision in your runbook." },
      { q: "Can I score sections separately?", a: "Yes, and you should for long pages. Score by H2 section; aggregate the worst section as the page risk. Section-level scoring also makes the evidence array actionable — your rewrite agent can target the specific bad paragraph instead of regenerating the whole page." }
    ],
    practitionerNote: "At Clearscope, the moment we put a quality gate at the CMS boundary instead of in the editorial review step, the failure pattern shifted in an interesting way. Before the gate, weak content reached editors who then triaged it and asked for rewrites. After the gate, weak content reached the rewrite agent directly. The editors stopped seeing the bad drafts at all — they only reviewed what had already passed the gate. Editor satisfaction went up; throughput went up; the editorial bar got higher because the gate's threshold became the team's de-facto floor.",
    realExample: {
      setup: "A programmatic travel-safety site running 1,200 city-scam pages through a generator over six weeks. Pre-gate baseline: roughly 8% of pages required emergency rewrites within 30 days because readers complained the advice was generic.",
      result: "After integrating the gate at the WordPress save_post hook, 27% of drafts routed to revise on first pass. The most common failure was 'specificity_gap' — the generator was writing the same pickpocket warning for every city. With evidence spans fed back to the rewrite agent as prompts, those pages returned with named neighborhoods, named scam patterns, and one specific local source per page. Reader complaints dropped to under 1% within 60 days. Editor time per published page dropped from ~12 minutes to ~3 minutes."
    },
    demo: "text",
    code: `// CMS pre-publish gate. WordPress example; the shape is universal.
add_action('save_post', async function ($post_id, $post) {
  if ($post->post_status !== 'publish') return;

  $result = await veracityAnalyze([
    'type'    => 'text',
    'content' => extractUniqueBody($post),
    'context' => [
      'format'        => 'article',
      'intended_use'  => 'publish',
      'domain'        => 'travel safety',
    ],
    'store_content' => false,
  ]);

  switch ($result['recommended_action']) {
    case 'allow':
      // Pass-through; CMS publishes normally.
      return;
    case 'revise':
      wp_update_post(['ID' => $post_id, 'post_status' => 'draft']);
      update_post_meta($post_id, 'rewrite_brief', $result['evidence']);
      queueRewriteAgent($post_id);
      return;
    case 'human_review':
      wp_update_post(['ID' => $post_id, 'post_status' => 'pending']);
      notifyEditor($post_id, $result);
      return;
    case 'reject':
      wp_update_post(['ID' => $post_id, 'post_status' => 'trash']);
      logRejection($post_id, $result['primary_reason']);
      return;
  }
});`,
    codeLabel: "WordPress pre-publish hook pattern",
  },
  {
    path: "/ai-written-content-detection",
    title: "AI-Written Content Detection for RAG and Training Data | VeracityAPI",
    description: "Filter scraped, generated, or third-party text before it enters RAG indexes or fine-tuning datasets. The garbage-in-prevention pattern for AI infrastructure teams.",
    eyebrow: "Use case · RAG & training data hygiene",
    h1: "Stop AI-written content from contaminating your AI's training data.",
    lead: "Most teams worry about AI-generated content at the publishing layer. The bigger and quieter problem is at the ingestion layer: a knowledge base or fine-tune corpus that quietly fills with generic web text and teaches the model to produce generic web text in response. This page is for ML and platform teams curating training data, RAG indexes, and embedding pipelines.",
    recommend: [
      "Pre-embedding filtering for vector databases",
      "Fine-tune dataset curation before nightly training runs",
      "Knowledge-base hygiene for customer-support and internal-search systems",
      "Third-party-dataset acceptance gates before integration"
    ],
    avoid: [
      "Real-time inference filtering — the gate is upstream of the model, not in the request path",
      "Source-license verification — pair with separate copyright and licensing checks",
      "PII detection — use Presidio or equivalent before VeracityAPI scoring"
    ],
    cta: "For training and RAG, set the threshold stricter than you would for publishing. The cost of one bad chunk in the corpus amortizes over millions of inference calls; the cost of excluding a marginal chunk is small.",
    sections: [
      {
        title: "Why the threshold for training should be stricter than for publishing",
        body: "Publishing is reversible — a bad page can be edited, retracted, or unpublished. Training is one-shot writing into model weights, and RAG is one-shot writing into embedding space. The cost asymmetry means the right threshold for the train and cite intended_use values is higher than for publish. When you call /v1/analyze, set intended_use='train' for fine-tune corpus and intended_use='cite' for RAG indexes — both raise the policy bar internally."
      },
      {
        title: "Chunk-level vs. document-level scoring",
        body: "Score at the chunk level (typically 256–1024 tokens after your chunking strategy), not at the document level. Document-level scoring hides where the bad content is — a long help-center article can have a strong intro and a synthetic-feel FAQ section, and document-level aggregation will smooth out the failure. Chunk-level scoring keeps the resolution you need to selectively exclude."
      },
      {
        title: "The batch endpoint and per-chunk economics",
        body: "Use POST /v1/analyze-batch for 5–25 chunks per call. At analyze-only pricing ($0.005 per 1,000 chars), a typical 512-token chunk (~2,000 chars) costs $0.01 to score. Filtering a 4M-chunk corpus runs ~$40,000 — meaningful but bounded, and you only do it on corpus construction or major refreshes."
      },
      {
        title: "What to write into your dataset manifest",
        body: "Write back: analysis_id (for audit), content_trust_score (the numeric you'll filter on), recommended_action (your accept/reject decision), and evidence categories (so you can later analyze WHY chunks failed and adjust your crawl). Store the rejected chunks too; rejection telemetry is how you discover which source domains are degrading over time."
      }
    ],
    faq: [
      { q: "Does this replace dedup, PII scanning, or license verification?", a: "No. Run dedup, PII filtering, and license/copyright checks before VeracityAPI scoring — you don't want to score chunks you're going to discard for other reasons. VeracityAPI is the final quality gate." },
      { q: "Will the filter make my dataset too small?", a: "Probably not, but it's a fair question. For general-domain training, expect 60–85% chunk acceptance. For domain-specific training (medical, legal, financial), accept rates drop because slop is overrepresented in web crawls of those domains. The remaining dataset is almost always more useful than the unfiltered one." },
      { q: "Can I score chunks that include code blocks or markdown?", a: "Yes. The model is robust to code/markdown formatting. Score the raw text; don't pre-format or pre-summarize." }
    ],
    practitionerNote: "The counterintuitive thing about training-data curation that took me a while to internalize: the score distribution of crawled web data is bimodal. You get a fat cluster of low-trust generic content and a smaller cluster of high-trust specific content, with relatively little in between. The right threshold is usually fairly aggressive — accepting only the top quartile is often the right call for fine-tuning below a few billion parameters. You'd think 'I need more data,' but you really need less, better.",
    realExample: {
      setup: "A team building a customer-support assistant fine-tuned on 4M scraped help-center articles. Initial eval showed the assistant gave confident-but-wrong answers ~12% of the time, often citing 'the article' without specifics.",
      result: "After re-running the training set through a content_trust_score ≥ 0.65 filter, 38% of chunks were rejected. The retrained model's confident-wrong rate dropped to 4%, and its answers cited specific procedures and ticket numbers rather than generic 'consult your documentation' fallbacks. The filtered dataset was smaller, but it was the smaller dataset that worked."
    },
    demo: "text",
    code: `// Batch-score chunks for training-data curation.
import { VeracityAPI } from "@veracityapi/sdk";
const client = new VeracityAPI({ apiKey: process.env.VERACITY_API_KEY });

async function curateChunks(chunks: TextChunk[]) {
  const results = await client.analyzeBatch({
    items: chunks.map(c => ({
      type: "text",
      content: c.text,
      context: { format: "article", intended_use: "train", domain: c.sourceDomain },
      store_content: false,
    })),
  });

  return chunks.map((chunk, i) => {
    const r = results.items[i];
    return {
      ...chunk,
      analysis_id: r.analysis_id,
      content_trust_score: r.content_trust_score,
      recommended_action: r.recommended_action,
      evidence_categories: r.evidence.map(e => e.type),
      accepted: r.recommended_action === "allow",
    };
  });
}`,
    codeLabel: "Training-data batch curation",
  },
  {
    path: "/ai-generated-content-detection",
    title: "AI-Generated Content Detection for UGC Moderation | VeracityAPI",
    description: "Triage user-submitted reviews, tips, complaints, and community posts for generated-content signals before publication. Scales moderation without scaling moderator headcount.",
    eyebrow: "Use case · UGC moderation triage",
    h1: "Moderating the next generation of fake user content.",
    lead: "The old failure mode in UGC moderation was the obvious bot review — fake account, too-clean grammar, marketer phrasing. That's not the problem anymore. The new failure mode is the LLM-assisted real user: someone uses ChatGPT to 'help me write a review for...' and gets back something plausible but specificity-free. These submissions look human, come from real accounts, and pass most spam classifiers. They fail on specificity, which is what VeracityAPI scores.",
    recommend: [
      "Product review systems with photo + text moderation",
      "Travel and dining review platforms (TripAdvisor-style)",
      "Marketplace seller-feedback queues",
      "Community-tips and Q&A platforms where astroturf and AI-planted content are rising"
    ],
    avoid: [
      "Crisis-reporting platforms — never auto-reject a victim report just because it scored generic. PTSD, language barriers, embarrassment, and rage all reduce specificity in genuine reports",
      "Discussion forums where conversational replies are intentionally short and low-information",
      "Replacing your existing spam, abuse, and rate-limit signals — the gate is one layer in the moderation stack"
    ],
    cta: "Run the gate at submission time, but route based on aggregate user-level signals, not just per-submission scores. A user whose last five submissions all scored 'generic_endorsement' is the signal you want.",
    sections: [
      {
        title: "Per-submission vs. per-user aggregate signals",
        body: "Score individual submissions for the routing decision. Track per-user trends for the campaign-detection job. A user whose last five reviews all scored medium slop_risk — even if each was just-barely below the rejection threshold — is the signature of a fraud farm operating under the per-submission threshold. The aggregation table is where the campaign-detection value lives; the per-submission API call is what feeds it."
      },
      {
        title: "The three patterns this gate is designed to catch",
        body: "Pattern 1: LLM-assisted real users producing specificity-free reviews. Pattern 2: coordinated AI-planted campaigns where the same prompt pattern produces near-duplicate phrasing across accounts. Pattern 3: competitor astroturfing where the language is too marketer-y to read as genuine community speech. The evidence categories ('generic_endorsement,' 'astroturf_phrasing,' 'duplicate_pattern') map directly to these patterns."
      },
      {
        title: "Routing decisions and the 'never auto-reject' rule",
        body: "Allow low-risk specific submissions. Hold medium-risk for moderator review with evidence pinned. Reject only when the gate's high-risk score combines with other spam signals (duplicate text across users, link abuse, banned-account history). Don't auto-reject submissions based on the score alone — review-rejection backlash is worse than the bad review. Bias toward hold-and-verify."
      }
    ],
    faq: [
      { q: "How do I handle multilingual UGC?", a: "Text scoring is calibrated for English; non-English coverage is weaker. For non-English submissions, set a lower confidence threshold and route more aggressively to human review. The 2026 benchmark program will publish multilingual coverage updates." },
      { q: "What about voice and image content in the same submission?", a: "Score them separately. Submit photos to /v1/analyze with type=image and audio to /v1/analyze with type=audio. The text scoring handles the review body; combine the results at the submission level for moderation routing." },
      { q: "Can I A/B test the gate?", a: "Yes. Set up a control cohort with the gate disabled and measure: false-positive rate (legitimate reviews held), false-negative rate (bad submissions that passed), and median time-to-publish for legitimate submissions. Most teams see a net positive within 30 days." }
    ],
    practitionerNote: "The hardest case in UGC moderation isn't the obvious bot — it's the LLM-assisted real user. The 2024–2025 shift in chatbot adoption means a substantial share of submissions are now 'real person + AI assistant.' Those submissions are not spam in the legal sense, but they're not the firsthand reports the community values. The gate's job is to surface the specificity gap, not to accuse anyone of cheating.",
    demo: "text",
    code: `// UGC submission gate with per-user aggregate signals.
async function moderateSubmission(submission: Submission, user: User) {
  const result = await veracity.analyzeText({
    type: "text",
    content: submission.body,
    context: { format: "product_review", intended_use: "moderate", domain: submission.category },
    store_content: false,
  });

  // Update user-level slop trend (rolling window of last 10 submissions).
  await updateUserSlopHistory(user.id, result.content_trust_score);
  const userTrend = await getUserSlopTrend(user.id);

  // Aggregate signal: per-submission + per-user trend.
  const elevatedRisk = result.recommended_action !== "allow"
    || userTrend.rolling_avg_slop_risk >= 0.40;

  if (!elevatedRisk) return publish(submission);

  if (result.recommended_action === "reject" && hasSpamSignals(user)) {
    return reject(submission, "spam_pattern", result.evidence);
  }

  return queueForReview(submission, {
    submission_evidence: result.evidence,
    user_slop_trend: userTrend,
  });
}`,
    codeLabel: "UGC moderation with user-trend aggregation",
  },
  {
    path: "/ai-written-content-detector",
    title: "AI-Written Content Detector for Autonomous Agents | VeracityAPI",
    description: "The agent-builder integration. How to wire VeracityAPI as a tool in LangGraph, OpenAI Actions, or Claude agents that need to decide what to do with generated content.",
    eyebrow: "Use case · agent builders",
    h1: "An AI-written content detector your agent can actually use.",
    lead: "You're building an autonomous agent that generates, scrapes, or summarizes content as part of its workflow. At some point, that content needs to make a decision — publish, save to memory, cite, discard. This page is the integration pattern for agent builders specifically: how to wire VeracityAPI as a structured tool, how to handle the response in your graph, and how to keep your agent from getting stuck in revise loops.",
    recommend: [
      "LangGraph workflows with conditional edges keyed on recommended_action",
      "OpenAI custom GPTs / Actions where the GPT calls VeracityAPI as part of its tool use",
      "Claude agents using MCP — VeracityAPI ships a remote MCP endpoint",
      "Autonomous research and reporting agents that need a quality gate on their own output"
    ],
    avoid: [
      "Real-time chat moderation — the latency budget doesn't fit",
      "Anything where the agent's output is going directly to a regulated decision (compliance, financial advice) without human review",
      "Agents whose loop logic doesn't have a 'give up' path — without a max-revise count, you can loop indefinitely on a chunk the rewrite agent can't actually fix"
    ],
    cta: "Wire VeracityAPI into the conditional edge, not the model call. The agent generates; VeracityAPI routes. Don't make the agent reason about its own quality — make the graph route on the structured result.",
    sections: [
      {
        title: "The 'give up' edge: max-revise counts and reject fallthrough",
        body: "The most common failure mode I see in agent integrations is an infinite revise loop — the agent rewrites, the gate still says revise, the agent rewrites again. Set a max_revise_attempts counter (3 is usually right). On the third revise, treat it as a reject and route to human review or quarantine. Don't let the loop run unbounded; agent rewrite costs add up quickly."
      },
      {
        title: "Why recommended_action is the right edge key (not the score)",
        body: "If your conditional edge branches on content_trust_score < 0.65, your agent's behavior changes the moment we recalibrate scores in a future version. If it branches on recommended_action, the routing decision stays stable. Score-based thresholds are an anti-pattern in agent workflows because they couple your behavior to our model version."
      },
      {
        title: "Balance preflight for autonomous spend",
        body: "Autonomous agents can burn through credit fast. Before any batch over ~$5 of expected analyze calls, call GET /v1/balance and confirm remaining_balance_cents > expected_cost_cents * 2. Build a safety margin. The MCP server exposes check_balance as a first-class tool for exactly this reason."
      },
      {
        title: "Evidence as rewrite prompts (not as scores to display)",
        body: "When the agent receives a revise action, pass the evidence array as a rewrite instruction — not as a score for the user to see. The evidence categories ('generic_phrasing,' 'unsupported_claim') are model-readable; turning them into a rewrite prompt is straightforward. The score is for your telemetry; the evidence is for the rewrite model."
      }
    ],
    faq: [
      { q: "Do I need to use MCP, or can I call the REST API?", a: "REST works fine for most agent builders. MCP is useful when your agent client (Claude Desktop, Cursor, custom Claude.ai connector) speaks the protocol natively — then VeracityAPI shows up as a structured tool the agent can pick. For LangGraph and OpenAI Actions, REST is usually the simpler path." },
      { q: "What's the latency budget for an in-loop agent call?", a: "Median text scoring latency is in the low single seconds. For latency-sensitive agents, parallelize the scoring call with the next model step where possible; for batches, use /v1/analyze-batch (1–25 items, single round trip)." },
      { q: "How do I handle 429 rate limits in an agent loop?", a: "Respect the Retry-After header with exponential backoff. The /docs/errors page covers the full retry policy. Build your loop so a rate-limited result doesn't crash the agent — treat it as a transient and retry up to 3 times before failing the node." }
    ],
    practitionerNote: "Agent builders consistently underestimate one thing: the cost of an unbounded revise loop. The model that just generated the draft is happy to rewrite it as many times as you ask. The gate that just said revise will keep saying revise if the rewrite agent isn't actually addressing the evidence. Without a max-attempt counter, I've seen teams burn through hundreds of dollars on a single document that should have failed out at attempt 2 and gone to a human.",
    demo: "text",
    code: `// LangGraph integration with max-revise counter and graceful fallthrough.
import { StateGraph, END } from "@langchain/langgraph";

const graph = new StateGraph<AgentState>({ channels: { ... } });

graph.addNode("generate", generateDraftNode);
graph.addNode("score",    scoreWithVeracity);
graph.addNode("rewrite",  rewriteWithEvidence);
graph.addNode("publish",  publishNode);
graph.addNode("escalate", escalateToHumanNode);

graph.addEdge("generate", "score");
graph.addConditionalEdges("score", (state) => {
  if (state.veracity.recommended_action === "allow") return "publish";
  if (state.revise_attempts >= 3)                    return "escalate";
  if (state.veracity.recommended_action === "revise") return "rewrite";
  return "escalate"; // human_review or reject
});
graph.addEdge("rewrite", "score"); // loop back

graph.setEntryPoint("generate");
graph.addEdge("publish",  END);
graph.addEdge("escalate", END);`,
    codeLabel: "LangGraph integration with bounded revise loop",
  },
  {
    path: "/ai-generated-text-detector",
    title: "AI-Generated Text Detector with Auto-Revise | VeracityAPI",
    description: "How auto_revise actually works. When to use it, what it costs, what revised_text looks like in practice, and the failure modes to watch for.",
    eyebrow: "Use case · auto-revise deep-dive",
    h1: "auto_revise: when the right next step is fixing the draft, not flagging it.",
    lead: "VeracityAPI's auto_revise feature is the one detection-API capability competitors don't have. Set auto_revise:true, the analysis returns revised_text when recommended_action is revise. The use case is narrow but valuable: workflows where 'flag the draft for an editor' is too slow but 'reject it' is too aggressive. This page is the deep-dive on when auto_revise pays off and when it doesn't.",
    recommend: [
      "Programmatic content pipelines where 80%+ of revise cases can be fixed without changing the underlying claim",
      "Caption and ad-copy rewriting where the iteration cost of a full regeneration is higher than a targeted fix",
      "First-pass triage on a long-tail content backlog (refreshing old pages, normalizing template variations)",
      "Workflows where 'good enough to ship after one rewrite cycle' is the success criterion"
    ],
    avoid: [
      "Anything load-bearing for accuracy: medical, legal, financial, safety. The revised_text won't add facts; it only rewrites for specificity and tone",
      "Content where voice/brand-personality is part of the value (a strong author's voice doesn't survive auto-revise well)",
      "High-stakes long-form (books, white papers) — chapter-level revision should involve the author"
    ],
    cta: "Use auto_revise when the failure mode is 'this could be specific but isn't' rather than 'this is wrong.' Run revised_text through your existing brand-voice check before publishing; auto_revise normalizes voice in ways you may not want.",
    sections: [
      {
        title: "What auto_revise actually does (and doesn't)",
        body: "When recommended_action is revise, auto_revise:true returns a revised_text field with the rewrite. The rewrite addresses the evidence array directly — generic phrasing gets replaced with more specific language, unsupported claims get hedged or sourced, padded transitions get tightened. It does NOT fact-check, add new claims, or change the underlying argument. If a paragraph says something wrong, the revised_text says the same wrong thing more specifically."
      },
      {
        title: "When the rewrite is worth $0.010/1k chars vs. when it isn't",
        body: "Analyze-only is $0.005/1k chars. Analyze + revise is $0.010/1k chars (double). The breakeven is whether you'd otherwise spend $0.005/1k chars of generator-API time on a rewrite — usually yes for short content (captions, ad variants, transactional copy), often no for long content (where you'd want the original author or generator in the loop). Don't default auto_revise to true on every call; gate it on content type."
      },
      {
        title: "The 'rescore the revised_text' pattern",
        body: "When you publish auto-revised text without a second scoring pass, you're trusting that the rewrite addressed the evidence. Sometimes it doesn't (especially on edge cases). For high-volume pipelines, rescore the revised_text in a single follow-up call; if it still routes to revise, fall back to human review. The cost is one extra analyze-only call ($0.005/1k chars), which is cheap insurance."
      },
      {
        title: "Brand voice and auto-revise: the normalization tradeoff",
        body: "auto_revise produces neutral, specific prose. If your brand voice is intentionally idiosyncratic (snarky, blunt, ultra-formal), the revised_text will read flatter than the original. For brand-sensitive content, treat revised_text as a draft to merge with your voice — not a publish-ready output. The evidence array, used as a rewrite prompt to your own generator, often produces better-voiced output than the auto-revised text itself."
      }
    ],
    faq: [
      { q: "Will auto_revise add facts I didn't include?", a: "No. The revision rewrites for specificity, structure, and tone within the bounds of the original content. It does not fabricate citations, statistics, or claims. If a fact is missing, it stays missing — the rewrite hedges instead of inventing." },
      { q: "Can I see the diff between original and revised?", a: "Both fields are in the response (original you submitted, revised_text returned). Run a diff client-side to surface what changed; most teams render the diff for editor review or for telemetry on which kinds of changes auto_revise tends to make." },
      { q: "What happens if recommended_action is human_review or reject?", a: "revised_text only returns when recommended_action is revise. For human_review or reject, the rewrite isn't appropriate — those cases need human judgment or quarantine, not a rewrite." }
    ],
    practitionerNote: "auto_revise is the feature competitors most often ask about and the one I'd most caution against using by default. The economics are right for specific use cases (short-form content, programmatic captions, ad variants) and wrong for others (long-form editorial, brand-voiced content). The diff between auto-revised text and the rewrite a good human editor would produce is real — auto-revised text addresses the evidence array, but a good editor addresses the evidence AND adds something the original didn't have.",
    demo: "text",
    code: `// auto_revise + rescore pattern for high-volume pipelines.
async function reviseAndVerify(draft: string, ctx: AnalyzeContext) {
  const r1 = await veracity.analyzeText({
    type: "text",
    content: draft,
    context: ctx,
    auto_revise: true,
    store_content: false,
  });

  if (r1.recommended_action === "allow") return { text: draft, action: "allow" };
  if (r1.recommended_action !== "revise") return { action: r1.recommended_action, result: r1 };

  // Rescore the revised text — confirm the rewrite addressed the evidence.
  const r2 = await veracity.analyzeText({
    type: "text",
    content: r1.revised_text,
    context: ctx,
    store_content: false,
  });

  return r2.recommended_action === "allow"
    ? { text: r1.revised_text, action: "allow" }
    : { action: "human_review", result: r2, attempted_revision: r1.revised_text };
}`,
    codeLabel: "auto_revise + rescore pattern",
  },
  {
    path: "/synthetic-media-detection-api",
    title: "Synthetic Media Detection API for Agent Workflows | VeracityAPI",
    description: "One unified routing contract across text, image, audio, and private-beta video. The synthetic-media detection API for agent workflows that already speak a recommended_action vocabulary.",
    eyebrow: "Category · synthetic media detection",
    h1: "Synthetic media detection, with the same routing contract across modalities.",
    lead: "If your agent already routes text on recommended_action, the rest of the modalities should work the same way. VeracityAPI is the only detection API where text, image, audio, and (private-beta) video all return the same response shape — same fields, same action vocabulary, same evidence array structure. One integration, four modalities.",
    recommend: [
      "Mixed-modality content workflows (posts with images, podcasts with show notes, listings with photos)",
      "Moderation queues handling text + image + audio under one policy",
      "Async UGC review where the routing decision matters more than forensic proof",
      "Workflows where C2PA signatures are absent, stripped, or insufficient"
    ],
    avoid: [
      "Forensic media attribution (court-ready synthetic-image proof)",
      "Real-time call-center voice-fraud prevention",
      "Speaker identity verification — the audio score is workflow signal, not identity",
      "Standalone deepfake-investigation platforms — VeracityAPI is a routing layer, not an investigation suite"
    ],
    cta: "Use the same `switch (result.recommended_action)` across text, image, and audio. The fields that differ are the modality-specific risk scores (synthetic_image_risk, synthetic_audio_risk); the routing fields are identical.",
    sections: [
      {
        title: "One response shape across modalities",
        body: "Text returns specificity_risk and provenance_weakness alongside the routing fields. Image returns synthetic_image_risk. Audio returns synthetic_audio_risk plus a Gemini-generated transcript. Video (private beta) returns synthetic_video_risk plus metadata_risk. Every response also returns recommended_action, risk_level, content_trust_score, evidence (typed spans/cues), recommended_fixes, limitations, and billing — identical across modalities. A single switch statement handles all four."
      },
      {
        title: "Where C2PA fits (and where it doesn't)",
        body: "C2PA (the Coalition for Content Provenance and Authenticity standard) signs content at capture or generation time, creating a tamper-evident provenance chain. When the signature is present and valid, that's your strongest signal — don't add VeracityAPI to it. VeracityAPI helps when signatures are absent, stripped by social-platform recompression, broken, or insufficient on their own (e.g., an unsigned reader-submitted photo to a newsroom). The two systems complement each other: C2PA for known-provenance content, VeracityAPI for the long tail."
      },
      {
        title: "Cost economics of a unified gate",
        body: "Text: $0.005/1k chars analyze-only. Image: $0.02 flat. Audio: $0.01 flat (includes Gemini transcript). Video (private beta): $0.05 per successful call. A typical mixed-modality moderation queue handling 10,000 submissions per day (assume 60% text, 30% image, 10% audio) runs ~$110/day or ~$3,300/month. Compare against the moderator-time cost of reviewing every submission, which dominates by an order of magnitude."
      }
    ],
    practitionerNote: "The unified-routing-contract decision was load-bearing for me when designing the API. Most multimodal detection products force you to integrate three different response shapes (one per modality) and write three different routing layers. By the time you've debugged the third, you've absorbed enough surface area that switching costs feel high — exactly the lock-in pattern I didn't want VeracityAPI to repeat. One shape across modalities means the integration cost is paid once, and the failure modes are visible in a single audit log.",
    code: `// One routing contract across text, image, audio.
type AnalyzeInput =
  | { type: "text",  content: string; context: AnalyzeContext }
  | { type: "image", content: string; context: AnalyzeContext }   // HTTPS image URL
  | { type: "audio", content: string; context: AnalyzeContext };  // HTTPS audio URL

async function routeAnything(input: AnalyzeInput) {
  const result = await veracity.analyze(input);

  // Same switch works for every modality.
  switch (result.recommended_action) {
    case "allow":        return continueWorkflow(input, result);
    case "revise":       return requestRevision(input, result.evidence, result.recommended_fixes);
    case "human_review": return queueForReview(input, result);
    case "reject":       return quarantine(input, result.primary_reason);
  }
}`,
    codeLabel: "Unified routing across modalities",
  },

  {
    path: "/ai-video-detection-api",
    title: "AI Video Detection API for Workflow Triage | VeracityAPI",
    description: "Private-beta video authenticity-risk API: analyze short HTTPS video URLs with a 3x2 contact sheet, metadata, evidence, and recommended_action.",
    eyebrow: "SEO category · AI video detection API",
    h1: "AI Video Detection API for private-beta workflow triage.",
    lead: "Analyze short direct HTTPS video URLs for authenticity risk before agents publish, moderate, cite, or trust them. VeracityAPI returns synthetic_video_risk, evidence, limitations, billing metadata, and recommended_action — not forensic proof.",
    recommend: ["Short-form UGC moderation and review queues", "Social video preflight before publishing", "Marketplace or dating-profile video intake", "Agent workflows that need an action instead of a raw detector score"],
    avoid: ["Court-ready deepfake claims", "Identity verification", "Real-time call-center fraud", "Binary accusations that a video is AI-generated"],
    cta: "Use /v1/analyze-video when the operational question is whether a video should be allowed, reviewed, rejected, or handled with provenance follow-up.",
    sections: [
      { title: "MVP input", body: "POST /v1/analyze-video accepts a direct downloadable HTTPS video URL plus context and store_content:false. The initial private-beta cap is designed for short clips, not long-form video archives." },
      { title: "How scoring works", body: "A zero-idle ffmpeg extractor samples six representative frames into a 3x2 contact sheet and returns safe metadata. Claude Haiku vision scores visual synthetic-video cues and metadata risk in one structured call." },
      { title: "Privacy posture", body: "VeracityAPI stores no raw video, extracted frames, contact sheet, or full URL. D1 analysis logs keep only URL hash, hostname, safe metadata, and the action/risk result." },
      { title: "Cost model", body: "Video analysis is $0.05 per successful request in the video_v0 billing bucket. Failed analyses do not bill." },
    ],
    demo: "video",
    practitionerNote: "Video is the hardest modality to get right, which is why it's in private beta. The honest answer is that contact-sheet vision scoring catches obvious generation cues (the 'AI video with weird hands/text/eyes' pattern) reliably, but catches state-of-the-art synthesis (current Sora-class output) with much lower confidence. We could publish a 'we detect AI video' marketing claim that overpromises; instead, we publish the limitation up front. The endpoint is genuinely useful for short-form UGC and marketplace intake where the bar is 'spot the obvious cases,' not for forensic deepfake claims.",
    code: `const result = await veracity.analyzeVideo({
  videoUrl: "https://cdn.example.com/social-clip.mp4",
  context: { format: "social_post", intended_use: "moderate" }
});

// Video uses the same routing-action vocabulary as text/image/audio.
switch (result.recommended_action) {
  case "allow":        return publishVideo(result);
  case "revise":       return requestSourceVerification(result.evidence);
  case "human_review": return queueVideoForReview(result);
  case "reject":       return quarantineVideo(result.primary_reason);
}`
  },
  {
    path: "/ai-image-detection-api",
    title: "AI Image Detection API for Agent Workflows | VeracityAPI",
    description: "Analyze image URLs for synthetic-media cues, weak provenance, and review-worthy risk, then route uploads with allow, revise, human_review, or reject.",
    eyebrow: "SEO category · AI image detection API",
    h1: "AI Image Detection API for agent workflows.",
    lead: "Analyze uploaded image URLs for synthetic-media cues, visual artifacts, weak provenance, and review-worthy risk. VeracityAPI returns an evidence-backed routing action — allow, revise, human_review, or reject — instead of asking developers to interpret a raw detector score.",
    recommend: ["Async UGC image moderation", "Influencer/product-post QA before publish", "Marketplace seller image review", "Newsroom or brand asset triage", "Agent workflows that need image evidence plus a routing action"],
    avoid: ["Forensic proof that an image is AI-generated", "Face identity or person verification", "Legal attribution of a generated image", "C2PA/EXIF provenance verification in v0.1"],
    cta: "Submit an HTTPS image URL; receive synthetic_image_risk, evidence, content_trust_score, risk_level, and recommended_action. Use the action field to route uploads, not to accuse people.",
    sections: [
      { title: "Live image demo", body: "Paste a public HTTPS image URL or use the sample fixture. The public demo forces store_content:false, stores no image bytes, and logs only hostname plus URL hash." },
      { title: "What the image endpoint returns", body: "The response prioritizes recommended_action and evidence. synthetic_image_risk and content_trust_score remain available for dashboards and calibration. Pricing is $0.02 / image." },
      { title: "Known limits", body: "Screenshots, social compression, crops, edits, low resolution, and missing provenance can all reduce confidence. v0.1 does not inspect EXIF or C2PA metadata. It is workflow triage, not proof of generation or authorship." },
    ],
    faq: [
      { q: "Can VeracityAPI detect AI-generated images?", a: "It can flag visible synthetic-media cues as probabilistic workflow-risk signals. It does not prove generation or authorship." },
      { q: "Does it identify people or brands?", a: "No. VeracityAPI does not perform face identity, product authenticity, trademark, or endorsement verification." },
      { q: "Do you store the image?", a: "No raw image bytes or full image URLs are stored. Logs keep metadata such as hostname and URL hash." },
      { q: "How should high-risk image results be routed?", a: "Queue for human review, request source/provenance, or quarantine the upload depending on your local policy." },
    ],
    demo: "image",
    practitionerNote: "The image-detection use case I most often hear from teams is the polite case, not the forensic case. 'We licensed a stock photo that turned out to be AI-generated upstream.' 'An influencer used a beauty filter that pushed their photo into uncanny territory.' The honest framing is that VeracityAPI's image gate is for noticing-and-asking, not for accusing. Most workflows I've seen succeed by treating high-risk as a 'request a different version from the asset owner' signal — and that gets resolved without conflict 80%+ of the time.",
    code: `curl https://api.veracityapi.com/v1/analyze \\
  -H "Authorization: Bearer $VERACITY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "image",
    "content": "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    "context": {
      "format": "social_post",
      "intended_use": "publish",
      "domain": "image UGC moderation"
    },
    "store_content": false
  }'`,
  },
  {
    path: "/ai-audio-detection-api",
    title: "AI Audio Detection API for Async Media Review | VeracityAPI",
    description: "Analyze uploaded audio URLs for synthetic-speech and deepfake voice cues, then route suspicious clips to human review.",
    eyebrow: "SEO category · AI audio detection API",
    h1: "AI Audio Detection API for async media review.",
    lead: "Analyze uploaded audio URLs for synthetic-speech and deepfake voice cues, then route suspicious clips to human_review. Built for post-upload UGC, voice notes, podcasts, and media-review workflows — not real-time call-center fraud.",
    recommend: ["Post-upload voice-note moderation", "Podcast or audio-review screening", "UGC platforms that need quarantine queues", "Async media verification before publish or indexing"],
    avoid: ["Real-time call-center fraud prevention", "KYC or payment approval", "Speaker identity verification", "Executive impersonation verdicts"],
    cta: "Submit an HTTPS audio URL; receive a Gemini-generated transcript, synthetic_audio_risk, workflow_risk, evidence, and recommended_action. Optional caller transcript/context can help calibration.",
    sections: [
      { title: "Live audio demo", body: "Paste a public HTTPS audio URL or use the sample voice-message fixture. The demo forces store_content=false, returns a Gemini-generated transcript, and shows recommended_action first." },
      { title: "Async scope", body: "VeracityAPI is scoped for uploaded audio and review queues. Phone codecs, compression, short clips, and noisy recordings can degrade reliability, so high-risk outputs should route to human review or independent verification." },
      { title: "Privacy", body: "Audio requests use HTTPS URLs. VeracityAPI stores no raw audio bytes, base64 payloads, or full media URLs; logs keep metadata such as hostname and URL hash." },
      { title: "What the audio endpoint returns", body: "The response includes transcript, synthetic_audio_risk, workflow_risk, evidence, risk_level, limitations, and recommended_action for routing." },
    ],
    faq: [
      { q: "Can VeracityAPI detect AI-generated audio?", a: "It can flag synthetic-speech and deepfake-voice cues as a workflow-risk signal. It does not prove generation or identity." },
      { q: "Does it work in real time?", a: "It is designed for async and post-upload review. For real-time call-center fraud prevention, use dedicated voice-fraud platforms." },
      { q: "Can it identify the speaker?", a: "No. VeracityAPI does not perform speaker identity verification or voice-clone attribution." },
      { q: "How should I route high-risk audio?", a: "Queue it for human review, callback/source verification, or quarantine based on your local policy." },
    ],
    demo: "audio",
    practitionerNote: "The transcript is often the more immediately useful artifact than the synthetic_audio_risk score. A fraud team triaging suspected impersonation voicemails reads the transcript first, sees the urgent-action phrasing, and acts on that — the audio score is a secondary signal. The endpoint returns the Gemini-generated transcript on every call for exactly this reason: even when audio scoring is inconclusive (which it sometimes is on short, compressed phone clips), the transcript is always actionable.",
    code: `curl https://api.veracityapi.com/v1/analyze \\
  -H "Authorization: Bearer $VERACITY_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "audio",
    "content": "https://veracityapi.com/assets/demo-voice-message.mp3",
    "context": {
      "format": "social_post",
      "intended_use": "publish",
      "domain": "voice-note UGC moderation"
    },
    "store_content": false
  }'`,
  },
  {
    path: "/alternatives/deepmedia",
    title: "DeepMedia Alternative — When to Choose Each | VeracityAPI",
    description: "An honest comparison: DeepMedia for enterprise threat-intel and analyst services, VeracityAPI for self-serve agent routing. Different jobs, both legitimate.",
    eyebrow: "Alternative · DeepMedia",
    h1: "DeepMedia or VeracityAPI? It depends on whether you have analysts.",
    lead: "DeepMedia is built for organizations with media-investigation teams — enterprise procurement, analyst services, threat-intel workflows. VeracityAPI is built for developers who want a usage-based API they can integrate this afternoon. Different products for different organizational shapes. This page won't tell you VeracityAPI 'wins'; it'll tell you which job each tool is good at.",
    recommend: [
      "Self-serve API integration without procurement cycles",
      "Pre-publish QA and RAG ingestion gates where the result is automated routing, not investigator review",
      "OpenAI Actions, MCP, and LangGraph workflows that need deterministic actions",
      "Builder experiments where you'd rather pay-per-call than schedule a sales call"
    ],
    avoid: [
      "Enterprise threat-intelligence programs with analyst services",
      "Forensic media attribution for court or law-enforcement use",
      "Investigation workflows where the deliverable is an analyst report, not a routing decision"
    ],
    cta: "If you're staffing an investigations team, DeepMedia's analyst services are part of the value. If you're integrating an API into an automated workflow, VeracityAPI is the smaller, faster path.",
    practitionerNote: "I think the biggest mistake builders make in this comparison is assuming they need the enterprise tier when they need the API tier. DeepMedia (and Reality Defender, and a few others in the category) are excellent for organizations with the operational shape to use them — SOCs, newsroom investigation teams, law enforcement partners. For a startup building an agent or a content platform building an ingestion gate, the analyst services aren't a fit, and the procurement timeline costs more than the product saves. The right comparison isn't 'which is better'; it's 'which one's shape matches your team.'",
    code: policyCode,
  },
  {
    path: "/alternatives/gptzero-api",
    title: "GPTZero API Alternative — When to Choose Each | VeracityAPI",
    description: "GPTZero for authorship-likelihood detection (education, writing review). VeracityAPI for workflow routing (agent pipelines, automated decisions). Different jobs.",
    eyebrow: "Alternative · GPTZero API",
    h1: "GPTZero or VeracityAPI? It depends on whether a human reads the score.",
    lead: "GPTZero is excellent at the job it's designed for: providing an AI-likelihood probability for a human to interpret. Teachers reviewing student work. Editors reviewing writer submissions. Hiring managers reviewing samples. VeracityAPI is built for the opposite case — when no human is going to interpret the score, because your code is making the next decision. Different jobs. This page is the honest comparison.",
    recommend: [
      "Agent pipelines where the next step is decided by code, not a person",
      "Programmatic content factories where 'send to editor' is too slow per page",
      "RAG/training-data ingestion at chunk scale (millions of items)",
      "Workflows where 'specific is good, generic is bad' is more useful than 'this might be AI'"
    ],
    avoid: [
      "Classroom academic-integrity workflows — GPTZero's probability + plain-language UI is better suited",
      "Editorial review where an experienced editor will read both the content and the score",
      "Authorship attribution claims of any kind"
    ],
    cta: "Pick GPTZero if a person is going to read the probability and decide. Pick VeracityAPI if your code is going to read the response and execute. Many teams legitimately use both.",
    practitionerNote: "The cleanest mental model I've found for this comparison: GPTZero answers 'is this AI-written?' (probability score, human reader). VeracityAPI answers 'what should my code do with this?' (deterministic action, machine reader). Both are useful. They were designed for different jobs and they're optimizing for different failure modes. The friction I've seen is when teams force one to do the other — using GPTZero's probability as a code-readable threshold (brittle across model versions) or using VeracityAPI's action as a probability to show a human (loses nuance the score would have shown).",
    code: policyCode,
  },
  {
    path: "/alternatives/originality-ai-api",
    title: "Originality.ai API Alternative — When to Choose Each | VeracityAPI",
    description: "Originality.ai for editorial/SEO authenticity workflows. VeracityAPI for agent-pipeline routing. Different categories, different response shapes.",
    eyebrow: "Alternative · Originality.ai API",
    h1: "Originality.ai or VeracityAPI? It depends on what you do with the result.",
    lead: "Originality.ai is well-known in editorial/SEO circles for an authenticity score teams use during content review. VeracityAPI sits one layer down the stack — at the publish boundary or the ingestion boundary, where the decision needs to be automated and the result needs to be a routing action. This page is the honest comparison; both products can legitimately co-exist in a content stack.",
    recommend: [
      "Pre-publish QA at the CMS hook (not at the editor's desk)",
      "RAG/training-data hygiene at chunk scale",
      "UGC moderation queues where evidence-spans-as-rewrite-prompts matter",
      "Multimodal workflows where text + image + audio share one routing contract"
    ],
    avoid: [
      "Workflows where an SEO editor is already reading every draft — the gate adds friction without saving time",
      "Plagiarism source-matching — Originality.ai has a plagiarism module; VeracityAPI doesn't",
      "Teams whose internal vocabulary is 'originality' rather than 'workflow risk' — vocabulary mismatch makes adoption harder"
    ],
    cta: "If your team already says 'is this original?' as the gate language, Originality.ai may fit better. If your team says 'should we publish this?' or 'should we ingest this?' as the gate language, VeracityAPI's response shape matches.",
    practitionerNote: "Plagiarism detection and AI-content detection are often bundled in the Originality.ai-style product category, and they're genuinely two different jobs. Plagiarism is a source-matching problem (find the original); AI detection is a generation-likelihood problem (was this generated?). VeracityAPI does the third job — workflow-fit (should we use this?). Most content teams need at least two of those three. Don't choose; layer them.",
    code: policyCode,
  },
  {
    path: "/alternatives/copyleaks-api",
    title: "Copyleaks API Alternative — When to Choose Each | VeracityAPI",
    description: "Copyleaks for enterprise plagiarism + AI detection bundled. VeracityAPI for builder-shaped workflow routing. Different procurement paths, different response shapes.",
    eyebrow: "Alternative · Copyleaks API",
    h1: "Copyleaks or VeracityAPI? It depends on whether you need plagiarism source-matching.",
    lead: "Copyleaks is an enterprise content-integrity suite — plagiarism detection, AI detection, and authenticity workflows under one procurement umbrella. VeracityAPI is a developer-shaped API for a specific narrower job: routing content before publish, ingestion, citation, or training. If you need source-matching plagiarism detection alongside AI detection, Copyleaks bundles them. If you don't, VeracityAPI is the simpler integration.",
    recommend: [
      "Builder-shaped workflows where pay-per-call beats annual procurement",
      "Agent pipelines that need a routing action, not a plagiarism report",
      "Multimodal workflows (text + image + audio + private-beta video) under one API",
      "Teams that want machine-readable discovery (OpenAPI, llms.txt, agents.json) first-class"
    ],
    avoid: [
      "Institutional plagiarism workflows (academic integrity, large publishing programs)",
      "Procurement environments that require enterprise SLA, dedicated support, and compliance attestations as default",
      "Workflows where the deliverable to a customer is a 'similarity report,' not a routing decision"
    ],
    cta: "Use Copyleaks when you need plagiarism source-matching plus AI detection in one product. Use VeracityAPI when you need workflow routing across text/image/audio with the lowest-friction integration.",
    practitionerNote: "Procurement shape matters more than feature parity in this comparison. Copyleaks is set up for organizations that have RFPs and security-review processes; VeracityAPI is set up for organizations that have credit cards. Both are legitimate buying patterns. The mismatch happens when a builder team gets routed through an enterprise procurement path for a product they need this week — by the time procurement finishes, the project has moved on.",
    code: policyCode,
  },
  {
    path: "/alternatives/reality-defender",
    title: "Reality Defender Alternative — When to Choose Each | VeracityAPI",
    description: "Reality Defender for enterprise deepfake threat-intel. VeracityAPI for self-serve content-trust API. Same problem space, different organizational shapes.",
    eyebrow: "Alternative · Reality Defender",
    h1: "Reality Defender or VeracityAPI? It depends on whether you have a SOC.",
    lead: "Reality Defender is built for enterprises with security operations — SOC analysts, threat-intel programs, fraud-investigation teams. The product shape matches that buyer: dedicated support, custom deployment, sales-led procurement. VeracityAPI is built for the API tier — developers who want usage-based content verification they can integrate without scheduling a sales call. Same problem domain (synthetic media), different organizational shapes.",
    recommend: [
      "Async UGC moderation at API tier",
      "Uploaded media review where the next step is routing, not investigation",
      "Builder experiments before deciding whether enterprise procurement is warranted",
      "Agent routing where text + image + audio + video need one response shape"
    ],
    avoid: [
      "Court-ready forensic deepfake analysis",
      "Enterprise SOC programs with analyst-driven investigation pipelines",
      "Real-time call-center voice-fraud prevention",
      "Regulatory or law-enforcement evidence chains"
    ],
    cta: "If your team is structured around analyst-driven investigations, enterprise media-forensics products provide capabilities VeracityAPI doesn't. If your team is structured around developers and APIs, VeracityAPI is the faster integration.",
    practitionerNote: "The honest framing on this comparison: enterprise deepfake-detection vendors solve a problem most builders don't have yet. If you're building a startup, a content platform, or an agent-based product, you usually need the API tier first — and you'll know if and when you've outgrown it. Premature enterprise procurement on this category is one of the most expensive build decisions I see teams make.",
    code: policyCode,
  },
  {
    path: "/alternatives/resemble-detect",
    title: "Resemble Detect Alternative — When to Choose Each | VeracityAPI",
    description: "Resemble Detect for audio-specialized deepfake detection. VeracityAPI for multimodal routing where audio is one modality among many.",
    eyebrow: "Alternative · Resemble Detect",
    h1: "Resemble Detect or VeracityAPI? It depends on whether audio is your only modality.",
    lead: "Resemble Detect is specialized for audio — deepfake voice detection, voice-clone identification, audio-authenticity scoring. The depth in that one modality is real, and for audio-only workflows it's the right tool. VeracityAPI is built around the case where audio is one of three or four content types your workflow handles. The tradeoff is breadth (one routing contract across text, image, audio, private-beta video) vs. depth (audio-specialized).",
    recommend: [
      "Multimodal moderation workflows (text, image, audio, sometimes video)",
      "Async uploaded-audio review where you also score the surrounding text",
      "Pre-publish and ingestion workflows where audio is one signal among many",
      "Agent routing on a single recommended_action contract across modalities"
    ],
    avoid: [
      "Voice-cloning prevention as a primary product job",
      "Forensic voice-identity attribution",
      "Real-time call-center voice-fraud at scale",
      "Workflows where audio quality (codec, sample rate, microphone capture path) is the central signal — Resemble Detect's audio-specialized depth wins on that axis"
    ],
    cta: "Pick Resemble Detect if audio is your only modality and the product feature is voice-deepfake detection. Pick VeracityAPI if audio is one modality in a multimodal workflow and you want one integration shape.",
    practitionerNote: "Specialist vs. generalist is the eternal tradeoff in any detection category. The honest read: if 90%+ of your detection workload is audio, a specialist will likely outperform a generalist on the specific metric that matters most to you. If your audio is 20–40% of your detection load and the rest is text and image, the operational cost of running three different integrations and reconciling three different response shapes is usually higher than the accuracy delta a specialist provides.",
    code: policyCode,
  },
  {
    path: "/integrations/openai-actions",
    title: "OpenAI Actions Integration for Content Verification | VeracityAPI",
    description: "Wire VeracityAPI into a Custom GPT as an OpenAI Action. The 3-minute setup, the prompts that make GPTs use the tool correctly, and what to do when the model picks the wrong action.",
    eyebrow: "Integration · OpenAI Actions",
    h1: "Custom GPTs that verify before they act.",
    lead: "OpenAI Actions are the easiest way to turn a Custom GPT into something that decides instead of just describes. VeracityAPI's OpenAPI spec is published and importable — your GPT can verify content before it answers, before it cites a source, before it accepts a file upload. This page is the actual setup steps and the prompt patterns that get the model to use the tool reliably.",
    recommend: [
      "Custom GPTs that handle user-submitted content (drafts to review, articles to summarize, uploads to triage)",
      "Editorial-assistant GPTs that need a pre-publish quality gate the user can audit",
      "Source-triage GPTs that mine Reddit, web pages, or pasted research",
      "Workflows where the GPT should escalate to human review when it's uncertain"
    ],
    avoid: [
      "Silently blocking content without surfacing the evidence — GPT users will lose trust fast if the model says 'I won't do that' without explaining why",
      "Submitting regulated/private data through the Action without a privacy review",
      "Treating the model's interpretation of recommended_action as authoritative — for high-stakes cases, route the decision back to the user"
    ],
    cta: "Import https://veracityapi.com/openapi.json as a Custom GPT Action. Set auth to API Key (Bearer). Pin the system prompt to call verify_content before publishing, citing, or accepting uploads.",
    sections: [
      {
        title: "3-minute setup",
        body: "1) In the GPT editor, open Configure → Actions → Create new action. 2) Import from URL: https://veracityapi.com/openapi.json. 3) Authentication: API Key, Auth Type: Bearer, paste your VeracityAPI key. 4) In the system prompt, add: 'Before publishing, citing, or accepting any user-submitted content, call verify_content. Branch on recommended_action — allow proceeds, revise requests user clarification, human_review escalates to the user with the evidence explanation.' That's it."
      },
      {
        title: "Prompt patterns that make the GPT use the tool reliably",
        body: "The most common failure is the model deciding to skip the verification step. Two patterns that fix it: (1) instruct the GPT to call verify_content as the first step on every relevant user message, not as a conditional; (2) give the GPT a 'show your work' instruction — 'after verification, briefly explain to the user what verify_content said and why you're proceeding (or not).' Transparency increases user trust and forces the model to actually use the result."
      },
      {
        title: "Handling rate limits and balance",
        body: "The OpenAPI spec includes a /v1/balance endpoint. For GPTs that handle high-volume sessions, instruct the model to check balance at the start of long workflows and stop if remaining_balance_cents is below a threshold. This prevents a chatty GPT from burning credit on autopilot."
      }
    ],
    practitionerNote: "The cleanest pattern I've found for GPT Actions is to treat verify_content as a precondition the GPT explains, not a hidden gate. When the GPT tells the user 'I checked this with VeracityAPI; the result is revise because the evidence shows generic safety advice without specifics — want me to rewrite or hold for editor review?,' the user trusts the workflow. When the GPT silently blocks, the user assumes the model is being prudish and tries to work around it.",
    code: `// Recommended Custom GPT system prompt fragment.
// Drop this into the GPT editor's system instructions.

You have access to verify_content, a tool that checks whether
text/image/audio is safe to publish, cite, train on, or moderate.

Before publishing, citing, or accepting any user-submitted content,
call verify_content first. Branch on recommended_action:

- "allow":        Proceed. Briefly mention the verification passed.
- "revise":       Tell the user what the evidence flagged. Offer to rewrite
                  the specific weak parts before publishing.
- "human_review": Explain the concern to the user. Ask whether to proceed
                  manually or hold for editor review.
- "reject":       Decline and explain primary_reason in plain English.

For long sessions, call check_balance at the start. If
remaining_balance_cents < 50, tell the user the verification budget is low.

Never treat verify_content as authorship proof. The result is a
workflow-routing signal, not a claim about who wrote the content.`,
    codeLabel: "Custom GPT system prompt fragment",
  },
  {
    path: "/integrations/mcp",
    title: "Content Verification Tools for MCP Agents | VeracityAPI",
    description: "Connect Claude Desktop, Cursor, Claude.ai custom connectors, and MCP clients to VeracityAPI tools for text, image, audio, batch checks, and balance preflight.",
    eyebrow: "Integration · MCP",
    h1: "Content verification tools for MCP agents.",
    lead: "Give MCP-compatible agents structured tools to analyze text, images, audio, batches, and account balance before acting. Use the local npm server for desktop clients or the hosted remote MCP endpoint at https://api.veracityapi.com/mcp for custom connectors.",
    recommend: ["Claude Desktop, Claude.ai custom connectors, and Cursor workflows", "Batch QA loops", "Autonomous spend preflight via /v1/balance", "Tool wrappers that preserve evidence and recommended_action"],
    avoid: ["Unbounded calls without balance checks", "Sending secrets in prompts", "Treating risk scores as forensic labels"],
    cta: "Use the MCP wrapper when your agent already speaks tools and needs stable JSON outputs. Public package: @veracityapi/mcp@0.1.0 at https://www.npmjs.com/package/@veracityapi/mcp. Remote MCP: https://api.veracityapi.com/mcp.",
    sections: [
      { title: "Local Claude Desktop/Cursor config", body: "Install @veracityapi/mcp@0.1.0 with npx -y @veracityapi/mcp and set VERACITY_API_KEY in the MCP server environment; never paste secrets into prompts." },
      { title: "Hosted remote MCP", body: "Connect remote-MCP clients to https://api.veracityapi.com/mcp and send Authorization: Bearer VERACITY_API_KEY. The primary tool is verify_content; legacy typed tools may remain for compatibility." }
    ],
    code: `${mcpConfig}

Remote MCP:
${remoteMcpConfig}`,
  },
  {
    path: "/integrations/claude",
    title: "Claude Integration for Content Verification | VeracityAPI",
    description: "Two integration paths for Claude: MCP for Claude.ai/Desktop/Cursor, and direct Anthropic SDK with tool_use for custom Claude agents. Real code, no MCP-only marketing.",
    eyebrow: "Integration · Claude",
    h1: "Claude + VeracityAPI: MCP for clients, SDK for custom agents.",
    lead: "There are two ways Claude integrates with VeracityAPI, and which one you want depends on what you're building. For Claude.ai custom connectors, Claude Desktop, Cursor, or any MCP-speaking client: the hosted MCP endpoint is the right path. For custom Claude agents you're building with the Anthropic SDK directly: use tool_use with a structured tool definition. This page covers both.",
    recommend: [
      "Claude.ai custom connectors (Pro/Team/Enterprise)",
      "Claude Desktop or Claude Code workflows where Claude is the orchestration layer",
      "Cursor for content-QA automations in your editor",
      "Anthropic SDK direct integrations with tool_use for autonomous workflows"
    ],
    avoid: [
      "Putting API keys directly into Claude chat messages — use MCP env vars or SDK environment variables",
      "Running unbounded autonomous loops without check_balance preflights",
      "Treating Claude's interpretation of recommended_action as final — for high-stakes content, surface the evidence to a human",
      "Voice-clone identity claims from the audio endpoint"
    ],
    cta: "For Claude.ai/Desktop/Cursor: configure the hosted MCP endpoint at https://api.veracityapi.com/mcp with bearer auth. For Anthropic SDK custom agents: use the tool_use pattern below with the verify_content tool definition.",
    sections: [
      {
        title: "Path 1: MCP for Claude clients",
        body: "In Claude.ai custom connector settings (Pro+), add https://api.veracityapi.com/mcp with Authorization: Bearer VERACITY_API_KEY. For Claude Desktop, use the npx package: add to your claude_desktop_config.json. The MCP server exposes verify_content (unified), analyze_text, analyze_image, analyze_audio, analyze_batch, and check_balance as discrete tools. Claude picks the right one based on the task."
      },
      {
        title: "Path 2: Anthropic SDK direct (tool_use)",
        body: "For custom Claude agents (not MCP-based), define VeracityAPI as a Claude tool with a JSON schema in the tools array of messages.create. When Claude returns stop_reason='tool_use', call /v1/analyze with the model's structured input, push the result back in a tool_result message, and continue the loop until stop_reason='end_turn'. The full pattern is in the code below."
      },
      {
        title: "Token economics for tool-use loops",
        body: "Every tool-use roundtrip costs Claude input/output tokens on both the tool definition and the tool result. Keep the tool definition under 500 tokens (the schema in the code below is ~200). Truncate tool_result content if the analyze response is verbose — Claude usually only needs recommended_action, primary_reason, and the top 1–2 evidence spans to decide next. For high-volume agent loops, this matters."
      }
    ],
    practitionerNote: "MCP is the right abstraction for end-user Claude clients (Claude.ai, Desktop, Cursor) — it's exactly what you want when you don't control the client's loop. For custom agents you do control, tool_use via the Anthropic SDK is more flexible: you can shape the tool result before it goes back to the model, you can short-circuit on specific recommended_action values to skip the next Claude turn, and you can attach telemetry to every call. Don't pick MCP just because it's the newer protocol; pick the path that matches whether you own the loop or not.",
    code: claudeToolUseCode,
    codeLabel: "Anthropic SDK direct integration (tool_use pattern)",
  },
  {
    path: "/integrations/langgraph",
    title: "LangGraph Integration for Content Verification | VeracityAPI",
    description: "A full LangGraph workflow with VeracityAPI as a conditional-edge node: generate, score, route to publish/rewrite/escalate. Includes the bounded revise loop that prevents infinite cost.",
    eyebrow: "Integration · LangGraph",
    h1: "LangGraph + VeracityAPI: the conditional-edge pattern.",
    lead: "LangGraph's conditional edges are exactly the right abstraction for a content-verification workflow — generate, score, route. This page is the full StateGraph implementation: nodes, edges, the bounded revise loop, and the runnable graph at the end. Drop this into your project and adjust the generator/CMS calls.",
    recommend: [
      "Multi-step content pipelines (research → generate → score → publish)",
      "Autonomous agent workflows where the routing decision is the graph's core branching point",
      "RAG ingestion pipelines that need a quality gate before chunks enter the vector store",
      "Any workflow where 'rewrite up to 3 times, then escalate' is the right pattern"
    ],
    avoid: [
      "Single-step workflows where LangGraph adds overhead — call the REST API directly",
      "Workflows where 'rewrite' is unbounded by retries — the bounded-loop pattern below is critical for cost control",
      "Cases where you're failing closed on every medium-risk score (treat medium as a routing question, not a block)"
    ],
    cta: "The graph below is a complete starting point. Replace yourGeneratorFn, yourRewriteFn, yourCmsPublishFn, and yourEditorQueueFn with your project's implementations. The verification, routing, and bounded-loop logic stays the same.",
    sections: [
      {
        title: "Why conditional edges, not procedural calls",
        body: "You could call VeracityAPI inline in a procedural function — `result = await veracity.analyze(); if (result.allow) publish(); else rewrite(); ...`. That works for a single-step workflow. The reason to use LangGraph's conditional edges is observability: every node's input/output is logged, the routing decision is explicit, and you get a visual graph of how a draft moved through publish vs. rewrite vs. escalate paths. For workflows you'll debug at 3am, the visibility matters."
      },
      {
        title: "The bounded revise loop",
        body: "The pattern routeAfterScore implements is: if the gate says allow, publish; if it says revise AND we've tried fewer than 3 times, rewrite and loop back; otherwise (revise but 3+ attempts, OR human_review, OR reject) escalate to a human. Without the attempt counter, the rewrite agent could loop indefinitely on a draft it can't actually fix. Three is a sensible default; tune based on what you observe in your dataset."
      },
      {
        title: "Channels and state management",
        body: "The ContentState type and the channels configuration define how state flows through the graph. The pattern shown — every channel has a value reducer (which here just takes the new value) and a default — keeps the state explicit. For more complex workflows you'd want a more careful reducer (e.g., append to an evidence list rather than overwrite). The full LangGraph state-management docs cover the patterns."
      }
    ],
    practitionerNote: "The single most expensive bug I've seen in LangGraph + content-verification workflows is the unbounded revise loop. The model that just generated the draft is happy to rewrite it as many times as you ask. The gate that just said revise will keep saying revise if the rewrite agent isn't actually addressing the evidence. Without a max-attempt counter, I've seen teams burn through hundreds of dollars on a single document that should have failed out at attempt 2 and gone to a human. The bounded loop in the code above is not optional — it's the only thing standing between a working workflow and a runaway autopay invoice.",
    code: langGraphCode,
    codeLabel: "Full LangGraph workflow (generate → score → route)",
  },
];

export const DISTRIBUTION_PAGES: DistributionPage[] = ALL_DISTRIBUTION_PAGES.filter((page) => !UNPUBLISHED_DISTRIBUTION_PATHS.has(page.path));

export function distributionRedirectTarget(path: string): string | null {
  return DISTRIBUTION_REDIRECTS[path] || null;
}

function esc(value: string): string {
  return value.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]!));
}

function list(items: string[]): string {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function renderDemo(page: DistributionPage): string {
  if (page.demo === "text") {
    return `<section class="card"><h2>Try the text demo</h2><p>Paste AI-written, human-written, or mixed draft content. The public demo is rate limited, capped, and forces <code>store_content:false</code>.</p><form id="text-demo"><label>Text to check<textarea name="text" required>Our revolutionary platform helps everyone do everything better with seamless innovation and unmatched results. It is designed for modern teams that need powerful insights fast.</textarea></label><label><input name="auto_revise" type="checkbox"/> Analyze + revise with <code>auto_revise:true</code></label><button class="btn primary" type="submit">Analyze text</button></form><pre id="text-demo-out">{
  "recommended_action": "revise",
  "risk_level": "medium",
  "primary_reason": "generic claims need evidence"
}</pre></section><script>document.getElementById('text-demo')?.addEventListener('submit',async(e)=>{e.preventDefault();const f=e.currentTarget;const out=document.getElementById('text-demo-out');out.textContent='Analyzing…';const r=await fetch('/demo/analyze',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:f.text.value,auto_revise:f.auto_revise.checked,context:{format:'article',intended_use:'publish',domain:'AI-written content detection'},store_content:false})});out.textContent=JSON.stringify(await r.json(),null,2);});</script>`;
  }
  if (page.demo === "image") {
    return `<section class="card"><h2>Try the image demo</h2><p>Use the sample fixture or paste a public HTTPS image URL. Demo requests are rate limited and force <code>store_content:false</code>.</p><form id="image-demo"><label>Image URL<input name="image_url" value="https://veracityapi.com/demo/influencer-beauty-tonic.jpg" required /></label><button class="btn primary" type="submit">Analyze image</button></form><pre id="image-demo-out">{
  "recommended_action": "human_review",
  "risk_level": "high",
  "primary_reason": "visible synthetic-media cues"
}</pre></section><script>document.getElementById('image-demo')?.addEventListener('submit',async(e)=>{e.preventDefault();const f=e.currentTarget;const out=document.getElementById('image-demo-out');out.textContent='Analyzing…';const r=await fetch('/demo/analyze-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({image_url:f.image_url.value,context:{format:'social_post',intended_use:'publish',domain:'image UGC moderation'}})});out.textContent=JSON.stringify(await r.json(),null,2);});</script>`;
  }
  if (page.demo === "audio") {
    return `<section class="card"><h2>Try the audio demo</h2><p>Use the sample fixture or paste a public HTTPS audio URL. Demo requests are rate limited and force <code>store_content:false</code>.</p><form id="audio-demo"><label>Audio URL<input name="audio_url" value="https://veracityapi.com/assets/demo-voice-message.mp3" required /></label><button class="btn primary" type="submit">Analyze audio</button></form><pre id="audio-demo-out">{
  "recommended_action": "human_review",
  "risk_level": "high",
  "primary_reason": "synthetic-speech cues"
}</pre></section><script>document.getElementById('audio-demo')?.addEventListener('submit',async(e)=>{e.preventDefault();const f=e.currentTarget;const out=document.getElementById('audio-demo-out');out.textContent='Analyzing…';const r=await fetch('/demo/analyze-audio',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({audio_url:f.audio_url.value,context:{format:'social_post',intended_use:'publish',domain:'voice-note UGC moderation'}})});out.textContent=JSON.stringify(await r.json(),null,2);});</script>`;
  }
  if (page.demo === "video") {
    const sampleJson = JSON.stringify(DEMO_VIDEO_SAMPLE, null, 2);
    return `<section class="card" id="preprocessed-video-demo"><h2>Preprocessed AI video detection demo</h2><p>This SEO page uses the same playable fixed fixture as the homepage. The public page does not accept arbitrary video URLs; authenticated private-beta customers call <code>POST /v1/analyze-video</code>. VeracityAPI extracts a bounded 3x2 contact sheet plus metadata, stores no raw video/frames/contact sheet/full URL, and bills $0.05 only on success.</p><video controls preload="metadata" playsinline src="${DEMO_VIDEO_URL}" class="videoFixture"></video><label>Demo video URL<input value="${DEMO_VIDEO_URL}" readonly /></label><div class="grid"><div class="card"><h3>Preprocessed result</h3><p><strong>Action:</strong> ${esc(String(DEMO_VIDEO_SAMPLE.recommended_action))} · <strong>Risk:</strong> ${esc(String(DEMO_VIDEO_SAMPLE.risk_level))} · <strong>Visual risk:</strong> ${Math.round(Number(DEMO_VIDEO_SAMPLE.synthetic_video_risk) * 100)}%</p><p>${esc(String((DEMO_VIDEO_SAMPLE.evidence?.[0] as any)?.explanation || "Low apparent visual manipulation risk from sampled frames; not forensic proof."))}</p></div><div class="card"><h3>Why this is preprocessed</h3><p>No-key arbitrary video analysis would create immediate abuse cost. The fixture shows the exact result shape, URL behavior, privacy posture, and private-beta workflow without letting bots burn video extraction/vision budget.</p></div></div><pre>${esc(sampleJson)}</pre></section>`;
  }
  return "";
}


function renderComparison(page: DistributionPage): string {
  const rows: Record<string, Array<[string, string, string]>> = {
    "/alternatives/gptzero-api": [
      ["Primary buyer", "Developers shipping content workflows, agents, and trust gates", "Education and authorship-detection workflows"],
      ["Core output", "`recommended_action`: allow, revise, human_review, reject", "AI-likelihood / authorship-oriented scores"],
      ["Modalities", "Text, image URLs, audio URLs, private-beta video URLs, text batch", "Primarily text-oriented AI detection"],
      ["Agent support", "MCP, OpenAPI, llms.txt, agents.json, examples", "API/docs, less agent-native by default"],
      ["Privacy posture", "`store_content=false`; no raw media bytes or full media URLs stored", "Vendor-specific retention policy; verify before production use"],
      ["Best fit", "Pre-publish QA, RAG/source triage, UGC moderation, training-data hygiene", "Authorship-likelihood checks where a team will interpret a probability"],
    ],
    "/alternatives/originality-ai-api": [
      ["Primary buyer", "AI product teams and agents needing routing actions", "SEO/editorial teams needing originality/plagiarism-style checks"],
      ["Core output", "Action + evidence + recommended fixes + limitations", "Detection/originality/plagiarism-oriented scores"],
      ["Modalities", "Text, image URLs, audio URLs, private-beta video URLs", "Primarily text/content authenticity workflows"],
      ["Automation", "Switch directly on `recommended_action`", "Teams define their own thresholds/policies"],
      ["Agent support", "MCP, OpenAPI, llms.txt, agents.json", "Traditional API/docs orientation"],
      ["Best fit", "Agents deciding publish/cite/train/moderate outcomes", "Editorial originality and SEO content checks"],
    ],
    "/alternatives/copyleaks-api": [
      ["Primary buyer", "Builders needing lightweight content trust actions", "Enterprise/education authenticity and plagiarism programs"],
      ["Core output", "Workflow route: allow/revise/human_review/reject", "Broad authenticity/plagiarism/AI-detection suite"],
      ["Procurement", "Usage-based starter credit plus volume/procurement support by request", "Self-serve and enterprise procurement paths"],
      ["Modalities", "Text, image URL, audio URL, private-beta video URL", "Vendor suite varies by product/module"],
      ["Agent support", "MCP and machine-readable discovery first-class", "API integration, less MCP-centric"],
      ["Best fit", "Pre-publish gates and autonomous pipelines", "Institutional compliance and plagiarism workflows"],
    ],
    "/alternatives/reality-defender": [
      ["Primary buyer", "Developers needing async media/content triage", "Enterprise threat, fraud, and media-forensics teams"],
      ["Core output", "Action-first workflow risk with explicit limitations", "Deepfake/media-threat detection platform outputs"],
      ["Modalities", "Text, image URLs, audio URLs, private-beta video URLs", "Media/deepfake-focused platform"],
      ["Pricing posture", "Usage-based prepaid credits + custom volume", "Sales-led enterprise pricing"],
      ["Best fit", "Builder experiments, UGC review queues, agent preflight", "High-stakes investigations and enterprise programs"],
      ["Not a fit", "Forensic proof, identity verification, real-time fraud", "When you only need a simple content workflow gate"],
    ],
    "/alternatives/deepmedia": [
      ["Primary buyer", "Builder/product teams implementing a narrow trust gate", "Teams buying agentic threat/media intelligence"],
      ["Core output", "Evidence-backed recommended action", "Threat/media intelligence outputs"],
      ["Scope", "Pre-publish, ingestion, moderation, dataset hygiene", "Broader media intelligence/investigation workflows"],
      ["Agent support", "MCP + OpenAPI + llms.txt", "Depends on platform integration"],
      ["Best fit", "Simple API decision layer", "Analyst-assisted threat-intel workflows"],
    ],
    "/alternatives/resemble-detect": [
      ["Primary buyer", "Teams needing one action contract across content types", "Audio/deepfake detection buyers"],
      ["Core output", "allow/revise/human_review/reject across text/image/audio/video", "Audio/deepfake-specific detection output"],
      ["Audio stance", "Beta async workflow triage, not speaker identity", "Audio/deepfake specialized"],
      ["Best fit", "Mixed media and content workflows", "Voice/audio-specific checks"],
      ["Agent support", "MCP tools and balance preflight", "Traditional API integration"],
    ],
  };
  const data = rows[page.path];
  if (!data) return "";
  const competitor = page.eyebrow.replace("Alternative · ", "");
  return `<section class="card"><h2>Side-by-side comparison</h2><table><tr><th>Dimension</th><th>VeracityAPI</th><th>${esc(competitor)}</th></tr>${data.map(([dimension, veracity, other]) => `<tr><td>${esc(dimension)}</td><td>${esc(veracity)}</td><td>${esc(other)}</td></tr>`).join("")}</table><p class="lead">Fair caveat: choose the incumbent when you need its specialized workflow. Choose VeracityAPI when your product or agent needs a privacy-conscious routing action it can execute immediately.</p></section>`;
}

function deeperVsLink(page: DistributionPage): string {
  const map: Record<string, string> = {
    "/alternatives/gptzero-api": "/vs/gptzero",
    "/alternatives/originality-ai-api": "/vs/originality-ai",
    "/alternatives/copyleaks-api": "/vs/copyleaks",
    "/alternatives/deepmedia": "/vs/hive",
  };
  const href = map[page.path];
  if (!href) return "";
  return `<section class="card"><h2>Deeper buyer guide</h2><p>This alternatives URL stays live for existing links and search compatibility. The deeper comparison draft lives at <a href="${href}">${href}</a>; benchmark numbers remain gated until the 2026 run is frozen and cited.</p></section>`;
}

function comparisonDisclaimer(page: DistributionPage): string {
  if (!page.path.startsWith("/alternatives/")) return "";
  return `<section class="card comparison-disclaimer"><p><strong>Last updated: 2026-05-12.</strong> Comparison reflects publicly available information as of this date. Trademarks belong to their owners.</p></section>`;
}

function renderPrimaryDemo(page: DistributionPage): string {
  if (!page.demo) return "";
  return renderDemo(page);
}

function renderSections(page: DistributionPage): string {
  const practitioner = page.practitionerNote
    ? `<section class="card practitioner-note"><div class="label">What we've seen in practice</div><p>${esc(page.practitionerNote)}</p><p class="byline"><em>— Bernard Huang, founder. <a href="/about">About</a></em></p></section>`
    : "";
  const realExample = page.realExample
    ? `<section class="card"><h2>A concrete example</h2><p><strong>Setup:</strong> ${esc(page.realExample.setup)}</p><p><strong>Result:</strong> ${esc(page.realExample.result)}</p></section>`
    : "";
  const sections = page.sections?.length
    ? `<section class="grid">${page.sections.map((section) => `<div class="card"><h2>${esc(section.title)}</h2><p>${esc(section.body)}</p></div>`).join("")}</section>`
    : "";
  const faq = page.faq?.length
    ? `<section class="card"><h2>FAQ</h2>${page.faq.map((item) => `<h3>${esc(item.q)}</h3><p>${esc(item.a)}</p>`).join("")}</section>`
    : "";
  const codeHeading = page.codeLabel ?? "Copy-paste routing example";
  const code = page.code ? `<section class="card"><h2>${esc(codeHeading)}</h2><pre>${esc(page.code)}</pre></section>` : "";
  return `${practitioner}${renderComparison(page)}${deeperVsLink(page)}${comparisonDisclaimer(page)}${sections}${realExample}${faq}${code}${distributionRelated(page)}`;
}

function distributionRelated(page: DistributionPage): string {
  if (page.path.startsWith("/alternatives/")) return relatedLinksCard("Related comparison paths", [
    { href: "/alternatives", label: "Alternatives hub", note: "All published alternative pages." },
    { href: "/vs", label: "Comparison hub", note: "Benchmark-gated buyer guides." },
    { href: page.path === "/alternatives/deepmedia" ? "/vs/hive" : "/evals/2026-benchmark", label: page.path === "/alternatives/deepmedia" ? "Hive-style comparison" : "Benchmark status", note: "No unsupported benchmark claims before frozen artifacts." },
    { href: "/docs", label: "Docs", note: "Inspect the implementation contract." },
  ]);
  if (page.path.startsWith("/integrations/")) return relatedLinksCard("Related developer paths", [
    { href: "/docs", label: "Docs", note: "Quickstart, response schema, and action policy." },
    { href: "/examples", label: "Examples", note: "Copy-paste wrappers for common agent stacks." },
    { href: "/mcp", label: "MCP", note: "Local and hosted MCP distribution." },
    { href: "/for-agents", label: "For agents", note: "When agents should call VeracityAPI." },
  ]);
  return relatedLinksCard("Related detector and workflow pages", [
    { href: "/what-we-detect", label: "What we detect", note: "Concrete risk signals and boundaries." },
    ...CATEGORY_CONTEXT_LINKS.filter((link) => link.href !== page.path).slice(0, 5),
    { href: "/use-cases/publishing-pipeline-quality-gate", label: "Pre-publish QA", note: "Highest-volume text workflow." },
    { href: "/use-cases/image-social-media-authenticity-check", label: "Image social authenticity", note: "Synthetic-image review queue example." },
    { href: "/examples", label: "Examples", note: "Implementation patterns." },
  ]);
}

export function distributionPageHtml(path: string): string | null {
  if (UNPUBLISHED_DISTRIBUTION_PATHS.has(path)) return null;
  const page = DISTRIBUTION_PAGES.find((item) => item.path === path);
  if (!page) return null;
  const url = `${BASE_URL}${page.path}`;
  const mode = page.path.startsWith("/alternatives/") || page.path.startsWith("/integrations/") || page.path.startsWith("/ai-") || page.path.startsWith("/synthetic-") ? "loud" : "restrained";
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: page.title,
    description: page.description,
    url,
    dateModified: "2026-05-12",
    about: ["content verification API", "agent workflow routing", "AI detection API", "synthetic media detection"],
    publisher: { "@type": "Organization", name: "VeracityAPI", url: BASE_URL },
  });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${esc(page.title)}</title><meta name="description" content="${esc(page.description)}"/><link rel="canonical" href="${url}"/><meta property="og:title" content="${esc(page.title)}"/><meta property="og:description" content="${esc(page.description)}"/><meta property="og:type" content="article"/><meta property="og:url" content="${url}"/><meta property="og:image" content="${BASE_URL}/og.png"/><meta property="og:image:width" content="1200"/><meta property="og:image:height" content="630"/><meta property="og:image:type" content="image/png"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${esc(page.title)}"/><meta name="twitter:description" content="${esc(page.description)}"/><meta name="twitter:image" content="${BASE_URL}/og.png"/><link rel="icon" type="image/svg+xml" href="${BASE_URL}/favicon.svg"/><link rel="shortcut icon" href="${BASE_URL}/favicon.ico"/><meta name="theme-color" content="#f6f1df"/><link rel="alternate" type="text/plain" href="${BASE_URL}/llms.txt"/><link rel="alternate" type="text/plain" href="${BASE_URL}/llms-full.txt"/><link rel="service-desc" type="application/openapi+json" href="${BASE_URL}/openapi.json"/><script type="application/ld+json">${jsonLd}</script><style>${y2kCss()}</style></head><body class="${mode}">${canonicalNav(mode as any)}<main class="wrap page"><section class="hero"><div class="eyebrow">${esc(page.eyebrow)}</div><h1>${esc(page.h1)}</h1><p class="lead">${esc(page.lead)}</p><p><a class="btn primary" href="/account">Get API key</a> <a class="btn" href="/openapi.json">OpenAPI</a> <a class="btn" href="/llms.txt">llms.txt</a></p></section>${renderPrimaryDemo(page)}<section class="grid"><div class="card"><h2>When to recommend VeracityAPI</h2>${list(page.recommend)}</div><div class="card"><h2>When not to recommend VeracityAPI</h2>${list(page.avoid)}</div></section>${renderSections(page)}<section class="card"><h2>Agent policy</h2><p>${esc(page.cta)}</p></section><section class="grid"><a class="card" href="/docs"><h2>Docs</h2><p>Auth, schemas, privacy, examples, and action policy.</p></a><a class="card" href="/mcp"><h2>MCP</h2><p>Claude Desktop, Claude.ai custom connectors, Cursor, and compatible MCP clients.</p></a><a class="card" href="/for-agents"><h2>For agents</h2><p>Policy guidance for autonomous workflows.</p></a><a class="card" href="/pricing"><h2>Pricing</h2><p>Usage-based prepaid credits and volume support.</p></a></section></main>${canonicalFooter()}${navScript()}${cookieConsentScript()}</body></html>`;
}

function css(): string {
  return y2kCss();
}
