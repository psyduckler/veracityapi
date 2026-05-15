export interface ComparisonPage {
  slug: string;
  competitorName: string;
  titleQualifier: string;
  lastUpdated: string;
  competitorHomepage: string;
  competitorDocs: string;
  competitorPricing: string;
  bestForCompetitor: string[];
  bestForVeracity: string[];
  modalityCoverage: string;
  outputDesign: string;
  pricingNotes: string[];
  migrationNotes: string[];
  faqs: Array<{ q: string; a: string }>;
  benchmarkVendorKey: string;
  /** Bernard's first-person practitioner perspective on this comparison. */
  practitionerNote?: string;
  /** Specific dimensions where the competitor genuinely outperforms VeracityAPI. */
  whereCompetitorWins?: string[];
  /** Specific dimensions where VeracityAPI outperforms. */
  whereVeracityWins?: string[];
}

export const COMPARISONS: ComparisonPage[] = [
  {
    slug: "originality-ai",
    competitorName: "Originality.ai",
    titleQualifier: "Authenticity score vs workflow routing",
    lastUpdated: "2026-05-15",
    competitorHomepage: "https://originality.ai/",
    competitorDocs: "https://originality.ai/",
    competitorPricing: "https://originality.ai/pricing",
    bestForCompetitor: [
      "Editorial teams that already have a 'authenticity check' step in their content review workflow",
      "SEO content shops where 'originality' is the established team vocabulary",
      "Workflows that need plagiarism source-matching alongside AI detection (Originality.ai bundles both)",
      "Teams where an editor reads the score and decides — not a code path"
    ],
    bestForVeracity: [
      "Agent pipelines where the next step is decided by code (publish, rewrite, queue, reject)",
      "Programmatic content factories shipping 50+ pages/day where the gate needs to be automated",
      "RAG and training-data hygiene at chunk scale",
      "Multimodal workflows (text + image + audio) under one routing contract"
    ],
    modalityCoverage: "VeracityAPI: text, image URL, audio URL, private-beta video URL under one routing contract. Originality.ai: text-focused with their own plagiarism source-matching as a bundled capability. Verify current Originality.ai modality coverage from their docs — they have been expanding.",
    outputDesign: "VeracityAPI: action-first response (recommended_action, primary_reason, evidence array, recommended_fixes, limitations, optional auto_revise). Originality.ai: probability score + originality verdict + plagiarism match list. Different shapes for different jobs — the former is designed for `switch` statements, the latter for human reviewers.",
    pricingNotes: [
      "VeracityAPI: usage-based. Text $0.005/1k chars analyze-only, $0.010/1k chars with auto_revise. Image $0.02, audio $0.01, video (private beta) $0.05.",
      "Originality.ai: credit-based subscription tiers. Check their pricing page for current rates — both pricing models have legitimate trade-offs depending on your volume profile."
    ],
    migrationNotes: [
      "Don't replace Originality.ai's plagiarism source-matching with VeracityAPI; the two products solve different problems.",
      "Add VeracityAPI as a code-readable routing layer ALONGSIDE Originality.ai's authenticity score if your team uses both an editor review step and an automated publish gate.",
      "Map any probability threshold you currently use (e.g., 'reject if originality < 70%') to a recommended_action value before integrating — score-based thresholds become brittle when products recalibrate."
    ],
    whereCompetitorWins: [
      "Plagiarism source-matching is genuinely Originality.ai's strength; VeracityAPI doesn't ship this capability",
      "Established category vocabulary — 'originality score' is a phrase SEO teams already understand",
      "Long history of public-facing benchmark methodology in the authorship-detection category"
    ],
    whereVeracityWins: [
      "Routing-action response shape designed for autonomous workflows, not human reviewers",
      "Multimodal coverage under one routing contract",
      "Evidence array structured as rewrite prompts, not authorship accusation",
      "Lower per-call pricing for high-volume programmatic workflows"
    ],
    practitionerNote: "Originality.ai is the comparison VeracityAPI gets most often, and I think it's a fair one — both products operate in the AI-content detection space, both are usable via API. The honest read is that they're built for different organizational shapes. Originality.ai is built for content teams that have an editorial review step where an editor reads the score; VeracityAPI is built for content teams where no editor is in the loop. If your team is the former, Originality.ai's UX is probably better for you. If you're the latter, VeracityAPI's routing-action shape will save you from writing your own thresholding code.",
    benchmarkVendorKey: "originality",
    faqs: [
      { q: "Is this saying Originality.ai is worse?", a: "No, and I want to be specific about this. Originality.ai is excellent at its category — authenticity scoring for editorial workflows. VeracityAPI solves a different problem: workflow routing for autonomous pipelines. Benchmark numbers are gated until the 2026 frozen-artifact program completes." },
      { q: "Can I use both?", a: "Yes, and some content teams legitimately do. Originality.ai for the editor-facing originality score in the editorial review step; VeracityAPI for the code-facing routing decision at the publish boundary. They occupy different layers of the stack." },
      { q: "Does VeracityAPI do plagiarism source-matching?", a: "No. If source-matching is part of your workflow (you need to find the document a paraphrase came from), Originality.ai bundles that capability. VeracityAPI scores workflow risk, specificity, and provenance weakness — not source-document matching." }
    ]
  },
  {
    slug: "gptzero",
    competitorName: "GPTZero",
    titleQualifier: "Authorship likelihood vs workflow routing",
    lastUpdated: "2026-05-15",
    competitorHomepage: "https://gptzero.me/",
    competitorDocs: "https://gptzero.me/",
    competitorPricing: "https://gptzero.me/pricing",
    bestForCompetitor: [
      "Education workflows (high school, university, online course review) where a known detector brand is recognized by institutional buyers",
      "Editorial review where an editor reads the probability and decides",
      "Hiring/portfolio review where a human will interpret the score in context",
      "Workflows centered on 'is this AI?' as the operational question"
    ],
    bestForVeracity: [
      "Agent pipelines where code, not a human, branches on the result",
      "Programmatic publishing where 'send to editor' per page doesn't scale",
      "RAG ingestion gates handling millions of chunks",
      "Workflows where 'specific is good, generic is bad' is more useful than 'this might be AI'"
    ],
    modalityCoverage: "VeracityAPI: text, image URL, audio URL, private-beta video URL. GPTZero: primarily text-focused with strong probability-detection methodology. Verify current GPTZero modality coverage from their docs — they have product updates over time.",
    outputDesign: "VeracityAPI: deterministic routing action plus evidence array. GPTZero: probability score in 'likely AI / mixed / likely human' bands with explanation. Different output shapes optimize for different downstream readers (machine vs. human).",
    pricingNotes: [
      "VeracityAPI: text $0.005/1k chars; usage-based, no minimum commitment.",
      "GPTZero: subscription tiers + API pricing. Verify current pricing from their site before procurement decisions."
    ],
    migrationNotes: [
      "Keep GPTZero for jobs that need a probability score a person will read.",
      "Add VeracityAPI for the second layer where code needs to make the next decision — the two complement each other rather than substitute.",
      "If you're currently using GPTZero's probability threshold as code-readable routing logic, that's the pattern most likely to benefit from VeracityAPI's recommended_action — probability thresholds drift when models recalibrate; action labels stay stable across versions."
    ],
    whereCompetitorWins: [
      "Established brand recognition in education and editorial review",
      "Probability-band output that matches the mental model of human reviewers",
      "Longer track record of category-defining methodology"
    ],
    whereVeracityWins: [
      "Deterministic action output designed for `switch` statements",
      "Multimodal routing under one response shape",
      "Evidence-array-as-rewrite-prompt design that competitor probability scores don't provide",
      "Per-call pricing tuned for high-volume programmatic workflows"
    ],
    practitionerNote: "The cleanest mental model for this comparison: GPTZero answers 'is this AI-written?' (probability, human reader). VeracityAPI answers 'what should my code do with this?' (action, machine reader). Both are useful. They were designed for different jobs and they're optimizing for different failure modes. Friction shows up when teams force one to do the other — using GPTZero's probability as a code-readable threshold (brittle across model versions) or using VeracityAPI's action as a probability to show a human (loses nuance the score would have shown).",
    benchmarkVendorKey: "gptzero",
    faqs: [
      { q: "Can I use both?", a: "Yes, and this is legitimately common. GPTZero in the editorial-review layer for human readers; VeracityAPI in the publish-boundary layer for code branching." },
      { q: "Is VeracityAPI a GPTZero replacement?", a: "Only if the job you're using GPTZero for is workflow routing for autonomous code (in which case yes). For editorial human-reviewer use cases, GPTZero remains the better fit." },
      { q: "What about probability-style thresholds in my existing code?", a: "Probability thresholds become brittle when products recalibrate scores in a new version. The migration pattern I recommend: keep your existing GPTZero call for telemetry, add VeracityAPI alongside for the actual routing decision via recommended_action. Then deprecate the threshold over a couple of releases." }
    ]
  },
  {
    slug: "hive",
    competitorName: "Hive",
    titleQualifier: "Multimodal moderation platform vs API routing layer",
    lastUpdated: "2026-05-15",
    competitorHomepage: "https://thehive.ai/",
    competitorDocs: "https://thehive.ai/",
    competitorPricing: "https://thehive.ai/contact",
    bestForCompetitor: [
      "Moderation operations with dedicated moderator teams using a dashboard-driven workflow",
      "Programs requiring breadth across CSAM, NSFW, hate speech, violence, and synthetic media in one platform",
      "Enterprise procurement environments with custom SLAs and dedicated support",
      "Teams that need a vendor-managed moderation infrastructure, not just an API"
    ],
    bestForVeracity: [
      "API-first workflows where the next step is automated routing, not moderator queues",
      "Pre-publish QA and ingestion gates where the gate is upstream of human moderation",
      "Builder teams that don't yet have moderation operations to plug into",
      "Workflows where 'workflow-risk signal + routing action' is the contract, not 'classification + moderator dashboard'"
    ],
    modalityCoverage: "VeracityAPI: text, image URL, audio URL, private-beta video URL focused on workflow-risk triage. Hive: multimodal moderation platform covering broader classification categories. Different product shapes — VeracityAPI is the lighter, narrower tool; Hive is the heavier, broader platform.",
    outputDesign: "VeracityAPI: small JSON actions (allow/revise/human_review/reject) designed for code branching. Hive: classification scores + moderator-facing dashboard. Both are appropriate for different operational models.",
    pricingNotes: [
      "VeracityAPI: self-serve, usage-based, no minimum.",
      "Hive: enterprise pricing, usually quoted. Compare based on your operational shape and procurement timeline, not just price-per-call."
    ],
    migrationNotes: [
      "Don't replace Hive's broader moderation classification (CSAM, hate speech, NSFW) with VeracityAPI. Those categories are explicitly out of scope.",
      "Use VeracityAPI as a preflight linter for AI-content and provenance risk in workflows where the rest of the moderation stack is Hive (or any moderation platform). The two layer cleanly.",
      "Treat VeracityAPI's recommended_action as a routing signal that escalates to Hive for the moderation review when human_review fires."
    ],
    whereCompetitorWins: [
      "Breadth of classification categories (CSAM, NSFW, hate speech, violence, etc.) that VeracityAPI doesn't cover",
      "Moderator-facing dashboard infrastructure",
      "Enterprise-grade support and SLA structures for operational moderation teams",
      "Established scale on real-time moderation workloads"
    ],
    whereVeracityWins: [
      "Builder-friendly self-serve API integration",
      "Routing-action contract for autonomous workflows",
      "Lower friction for pre-moderation gates where a moderator dashboard isn't yet the right product",
      "Lower cost for narrow workflow-risk-routing use cases"
    ],
    practitionerNote: "Hive and VeracityAPI are often presented as comparisons but they're really different layers of the same stack. Hive is the moderation platform layer — it's built for organizations with moderator operations. VeracityAPI is the routing-decision layer — it's built for builder teams that want a gate before the moderation queue even fires. The clean integration pattern I've seen work: VeracityAPI handles the 'should this even go to moderation' decision; Hive handles 'how should the moderator triage what arrives.'",
    benchmarkVendorKey: "hive",
    faqs: [
      { q: "Is VeracityAPI a media forensics product?", a: "No. It provides image/audio workflow triage signals with clear limitations. For court-ready forensic analysis, enterprise media-forensics platforms (Reality Defender, DeepMedia, Hive in some configurations) are the appropriate category." },
      { q: "Does VeracityAPI cover CSAM/NSFW/violence?", a: "No. Those categories are explicitly out of scope. VeracityAPI focuses on workflow-risk signals: AI-content, specificity, provenance weakness, synthetic-media cues. Pair with a moderation platform for broader content classification." },
      { q: "Can I layer them?", a: "Yes — and this is the pattern that makes sense for most teams. VeracityAPI as a pre-publish or ingestion gate that decides whether content reaches the moderation queue; the moderation platform (Hive or equivalent) handles the moderator-facing review for what arrives." }
    ]
  },
  {
    slug: "copyleaks",
    competitorName: "Copyleaks",
    titleQualifier: "Enterprise content-integrity suite vs API routing layer",
    lastUpdated: "2026-05-15",
    competitorHomepage: "https://copyleaks.com/",
    competitorDocs: "https://copyleaks.com/api",
    competitorPricing: "https://copyleaks.com/pricing",
    bestForCompetitor: [
      "Institutional plagiarism and academic-integrity programs",
      "Enterprise content-integrity suites with bundled plagiarism + AI detection requirements",
      "Procurement environments that need annual contracts, dedicated support, and security attestations",
      "Workflows where 'content integrity' is the operational category and plagiarism source-matching is required"
    ],
    bestForVeracity: [
      "Builder-friendly self-serve workflows where pay-per-call beats annual procurement",
      "Agent pipelines that need a routing action (allow/revise/human_review/reject)",
      "Multimodal workflows that need one routing contract across modalities",
      "Teams that want machine-readable discovery (OpenAPI, llms.txt, agents.json) first-class"
    ],
    modalityCoverage: "VeracityAPI: text, image, audio, private-beta video on one routing contract. Copyleaks: text-focused enterprise suite with strong plagiarism source-matching as a primary capability. Different product shapes; verify Copyleaks' current modality coverage from their docs.",
    outputDesign: "VeracityAPI: small JSON action for automation. Copyleaks: similarity reports, plagiarism match lists, and AI detection scoring optimized for institutional review.",
    pricingNotes: [
      "VeracityAPI: usage-based, no commitment, no procurement cycle.",
      "Copyleaks: enterprise tiers with annual contracts typical. Use the right pricing model for your buying shape — both are legitimate."
    ],
    migrationNotes: [
      "Don't try to replace plagiarism source-matching with VeracityAPI — different product, different category.",
      "Add VeracityAPI when the gap in your current setup is action routing for autonomous workflows, not authentication or source-matching.",
      "The clean integration pattern: Copyleaks for the source-matching/plagiarism layer in editorial review; VeracityAPI for the automated routing decision at the publish boundary."
    ],
    whereCompetitorWins: [
      "Plagiarism source-matching at enterprise scale (databases, similarity engines, institutional integrations)",
      "Established enterprise procurement track record",
      "Bundled content-integrity capabilities (plagiarism + AI + authentication) under one contract",
      "Compliance attestations and security certifications expected by institutional buyers"
    ],
    whereVeracityWins: [
      "Self-serve integration without procurement timelines",
      "Routing-action response shape for autonomous workflows",
      "Multimodal coverage under one API",
      "Per-call pricing for high-volume programmatic workflows"
    ],
    practitionerNote: "Procurement shape matters more than feature parity in this comparison. Copyleaks is set up for organizations that have RFPs and security-review processes; VeracityAPI is set up for organizations that have credit cards. Both are legitimate buying patterns. The mismatch happens when a builder team gets routed through an enterprise procurement path for a product they need this week — by the time procurement finishes, the project has moved on.",
    benchmarkVendorKey: "copyleaks",
    faqs: [
      { q: "Does VeracityAPI detect plagiarism?", a: "No. Plagiarism source-matching is a different capability — finding the document a paraphrase came from. Use Copyleaks (or another plagiarism-specialized tool) for that job. VeracityAPI scores workflow risk, specificity, provenance weakness, and synthetic-media cues." },
      { q: "Can I use both?", a: "Yes, and many institutional teams do. Copyleaks for the plagiarism + authentication review layer; VeracityAPI for the automated routing decision when content flows through programmatic pipelines that don't fit the editorial-review model." },
      { q: "Is VeracityAPI enterprise-ready?", a: "For self-serve API-first workflows, yes. For enterprise procurement with custom SLAs, dedicated support, and compliance attestations, the current product shape is API-tier. Volume/enterprise terms are available by request but the default integration pattern is self-serve." }
    ]
  }
];
