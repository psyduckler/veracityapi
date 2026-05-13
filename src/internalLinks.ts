export type InternalLink = { href: string; label: string; note?: string };
export type InternalLinkGroup = { title: string; links: InternalLink[] };

export const FOOTER_LINK_GROUPS: InternalLinkGroup[] = [
  { title: "Product", links: [
    { href: "/", label: "AI output linter" },
    { href: "/what-we-detect", label: "What we detect" },
    { href: "/how-it-works", label: "How it works" },
    { href: "/methodology", label: "Methodology" },
    { href: "/methodology", label: "Trust model" },
    { href: "/pricing", label: "Pricing" },
    { href: "/request-access", label: "Contact sales" },
  ]},
  { title: "Developers", links: [
    { href: "/docs", label: "Docs" },
    { href: "/docs/errors", label: "Error handling" },
    { href: "/examples", label: "Examples" },
    { href: "/for-agents", label: "For agents" },
    { href: "/mcp", label: "MCP" },
    { href: "/integrations/claude", label: "Claude" },
    { href: "/integrations/openai-actions", label: "OpenAI Actions" },
    { href: "/integrations/langgraph", label: "LangGraph" },
    { href: "/openapi.json", label: "OpenAPI" },
    { href: "/llms.txt", label: "llms.txt" },
  ]},
  { title: "Detection APIs", links: [
    { href: "/ai-detection-api", label: "AI detection API" },
    { href: "/ai-content-detector-api", label: "AI content detector API" },
    { href: "/ai-written-content-detection", label: "AI-written detection" },
    { href: "/ai-generated-content-detection", label: "AI-generated detection" },
    { href: "/ai-written-content-detector", label: "AI-written detector" },
    { href: "/ai-generated-text-detector", label: "AI text detector" },
    { href: "/synthetic-media-detection-api", label: "Synthetic media API" },
    { href: "/ai-video-detection-api", label: "AI video API" },
    { href: "/ai-image-detection-api", label: "AI image API" },
    { href: "/ai-audio-detection-api", label: "AI audio API" },
  ]},
  { title: "Use cases", links: [
    { href: "/use-cases", label: "All use cases" },
    { href: "/use-cases/publishing-pipeline-quality-gate", label: "Pre-publish QA" },
    { href: "/use-cases/training-data-curation", label: "Training data" },
    { href: "/use-cases/reddit-source-validation", label: "Source validation" },
    { href: "/use-cases/social-caption-preflight", label: "Caption preflight" },
    { href: "/use-cases/image-social-media-authenticity-check", label: "Image authenticity" },
    { href: "/use-cases/audio-phone-snippet-triage", label: "Audio UGC triage" },
    { href: "/use-cases/kdp-manuscript-qa", label: "Manuscript QA" },
  ]},
  { title: "Compare", links: [
    { href: "/alternatives", label: "Alternatives" },
    { href: "/alternatives/gptzero-api", label: "GPTZero alternative" },
    { href: "/alternatives/originality-ai-api", label: "Originality.ai alternative" },
    { href: "/alternatives/copyleaks-api", label: "Copyleaks alternative" },
    { href: "/alternatives/deepmedia", label: "DeepMedia alternative" },
    { href: "/vs", label: "Comparisons" },
    { href: "/vs/gptzero", label: "vs GPTZero" },
    { href: "/vs/originality-ai", label: "vs Originality.ai" },
    { href: "/vs/copyleaks", label: "vs Copyleaks" },
    { href: "/vs/hive", label: "vs Hive" },
    { href: "/evals", label: "Evals" },
    { href: "/evals/2026-benchmark", label: "2026 benchmark" },
  ]},
  { title: "Company", links: [
    { href: "/blog", label: "Blog" },
    { href: "/blog/benchmarking-ai-detectors-routing-f1", label: "Benchmarking detectors" },
    { href: "/blog/not-an-ai-detector-routing-linter", label: "Not just an AI detector" },
    { href: "/about", label: "About" },
    { href: "/status", label: "Status" },
    { href: "/changelog", label: "Changelog" },
    { href: "/privacy", label: "Privacy" },
    { href: "/security", label: "Security" },
    { href: "/subprocessors", label: "Subprocessors" },
    { href: "/terms", label: "Terms" },
    { href: "/sitemap.xml", label: "Sitemap" },
  ]},
];

export function renderFooterGroups(groups: InternalLinkGroup[] = FOOTER_LINK_GROUPS): string {
  return groups.map((group) => `<div class="footerCol"><h3>${group.title}</h3>${group.links.map((link) => `<a href="${link.href}">${link.label}</a>`).join("")}</div>`).join("");
}

export function relatedLinksCard(title: string, links: InternalLink[], intro = ""): string {
  if (!links.length) return "";
  return `<section class="card relatedLinks"><div class="label">Internal links</div><h2>${title}</h2>${intro ? `<p>${intro}</p>` : ""}<div class="grid triple">${links.map((link) => `<a class="card" href="${link.href}"><h3>${link.label}</h3>${link.note ? `<p>${link.note}</p>` : "<p>Continue the product evaluation path.</p>"}</a>`).join("")}</div></section>`;
}

export const CORE_CONTEXT_LINKS: InternalLink[] = [
  { href: "/what-we-detect", label: "What VeracityAPI detects", note: "Map text slop, image forgery, audio, and workflow-risk signals to routing actions." },
  { href: "/docs/errors", label: "Error handling", note: "Production retry, billing, auth, and validation behavior for agent integrations." },
  { href: "/examples", label: "Copy-paste examples", note: "Drop-in wrappers for LangChain, queues, cron jobs, and moderation pipelines." },
  { href: "/mcp", label: "MCP tools", note: "Expose VeracityAPI to Claude Desktop, Cursor, Claude.ai connectors, and compatible clients." },
  { href: "/vs", label: "Detector comparisons", note: "Buyer guides kept benchmark-gated until frozen artifacts exist." },
  { href: "/blog", label: "Launch notes", note: "How we think about routing F1, slop detection, and linter-style checks." },
];

export const CATEGORY_CONTEXT_LINKS: InternalLink[] = [
  { href: "/ai-detection-api", label: "AI detection API", note: "Action-first routing instead of bare detector percentages." },
  { href: "/ai-content-detector-api", label: "AI content detector API", note: "Pre-publish and ingestion checks for text workflows." },
  { href: "/synthetic-media-detection-api", label: "Synthetic media detection API", note: "Image, audio, and private-beta video triage." },
  { href: "/ai-image-detection-api", label: "AI image detection API", note: "Review synthetic-looking images before publish or acceptance." },
  { href: "/ai-audio-detection-api", label: "AI audio detection API", note: "Route suspicious voice notes and audio clips to review." },
];

export function modalityLinks(modality?: "text" | "image" | "audio"): InternalLink[] {
  if (modality === "image") return [
    { href: "/ai-image-detection-api", label: "AI image detection API", note: "Synthetic-image workflow triage for visual assets." },
    { href: "/synthetic-media-detection-api", label: "Synthetic media detection API", note: "Shared policy for image, audio, and video review queues." },
    { href: "/what-we-detect", label: "Visual signals we detect", note: "Artifacts, provenance gaps, and review-worthy signals." },
  ];
  if (modality === "audio") return [
    { href: "/ai-audio-detection-api", label: "AI audio detection API", note: "Synthetic-speech and voice-note workflow triage." },
    { href: "/synthetic-media-detection-api", label: "Synthetic media detection API", note: "Shared policy for media review queues." },
    { href: "/what-we-detect", label: "Audio signals we detect", note: "Cadence, prosody, transcript mismatch, and provenance gaps." },
  ];
  return [
    { href: "/ai-content-detector-api", label: "AI content detector API", note: "Pre-publish and ingestion checks for text workflows." },
    { href: "/ai-generated-text-detector", label: "AI-generated text detector", note: "Analyze + revise loops for generated text." },
    { href: "/what-we-detect", label: "Text signals we detect", note: "Slop, specificity, provenance, and unsupported claims." },
  ];
}
