export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  /** Last update date, if different from publish date. */
  updated?: string;
  body: string[];
  /** Required for new posts. Older posts may omit and fall back to "VeracityAPI". */
  author?: {
    name: string;
    role: string;
    bioBlurb: string;
    profileUrl: string;
  };
}

const bernardByline = {
  name: "Bernard Huang",
  role: "Founder, VeracityAPI",
  bioBlurb: "Co-founded Clearscope and bootstrapped it to 7-figure ARR over 10 years of working with editorial and content teams at companies like Nvidia, HubSpot, Adobe, IBM, and Condé Nast. Now building VeracityAPI — content trust infrastructure for autonomous agent workflows.",
  profileUrl: "/author/bernard-huang",
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "what-ten-years-at-clearscope-taught-me-about-ai-slop",
    title: "What 10 years at Clearscope taught me about AI slop",
    description: "The lesson that shaped VeracityAPI's design: specificity, not authorship, is the signal that predicts whether content earns trust.",
    date: "2026-05-15",
    author: bernardByline,
    body: [
      "I spent the better part of a decade at Clearscope watching content teams make the same kinds of decisions over and over again. Should we publish this draft? Does it need another round of edits? Why did THIS page get the traffic and the one next to it die in obscurity?",
      "Across thousands of editorial reviews, across hundreds of content teams, the pattern that emerged was almost embarrassingly simple. The pages that worked were the ones with specifics. Named places, named products, named people, specific numbers, real examples, firsthand details. The pages that died were the ones where you could swap out 'travel safety' for 'personal finance' or 'B2B SaaS' and the paragraph would still read like a paragraph.",
      "That wasn't a Google ranking pattern. Or rather — it was, but indirectly. The deeper pattern was that specificity was the signal humans use to judge whether someone actually knows what they're talking about. Search engines were just measuring what humans were already measuring. Vague advice means you're summarizing; specific advice means you've lived it. Readers, raters, and ranking algorithms all converged on the same gut check.",
      "When AI-generated content arrived, it arrived with a very particular failure mode: confident plausibility without specificity. The drafts read fine in isolation. They made sense paragraph-by-paragraph. They just didn't say anything that couldn't have appeared on a thousand other pages. The category we started calling 'AI slop' isn't really about AI — it's about the same vagueness pattern that human writers fall into when they're working too fast, writing about something they don't know, or pasting in summary language to hit a word count.",
      "Which brings me to the design choice behind VeracityAPI.",
      "Most AI-detection products were built around the question 'was this written by an AI?' That's an interesting question and there's a real market for it — academic-integrity workflows, editorial review, hiring. GPTZero, Originality.ai, and the others in that category serve that market well. But it's not the question that matters in autonomous workflows.",
      "In an autonomous workflow, no human is reading the score. The agent generates a draft, scores it, and decides what to do next. 'This is 73% likely to be AI' is not actionable; the agent has to convert that probability into a decision. Every team building these workflows ends up writing their own thresholding code, picking arbitrary cutoffs, watching them drift when the underlying model recalibrates, and explaining to a stakeholder six months later why the gate has been quietly broken for a quarter.",
      "The question that's actually useful in those workflows is the same question Clearscope's editorial customers were asking: should we ship this? And the most reliable predictor of whether something should ship is the specificity signal — the same one editors had been using by gut feel for decades.",
      "So when we designed VeracityAPI, we deliberately weighted specificity_risk and provenance_weakness higher than synthetic_texture_risk. The product question isn't 'is this AI?' — it's 'is this generic enough that we shouldn't publish it, regardless of who wrote it?' A specific page written by a model is fine. A generic page written by a human is not fine. The signal we score is the one that actually matters for the decision.",
      "There's a downstream effect of this design that I didn't fully anticipate. Teams using VeracityAPI to gate their content end up improving their generation prompts over time, because the evidence array tells them exactly what their generator is producing too much of. 'generic_phrasing,' 'specificity_gap,' 'paraphrase_summary' — these aren't accusations of AI-generation. They're a punch list of writing weaknesses. The same punch list that a good editor would give a writer at any other time in history.",
      "I think that's the most useful framing for what we're building. VeracityAPI isn't an AI-detection product. It's an editor that scales — one that catches the specific weakness patterns that have always separated good content from forgettable content, but does it cheaply enough to run on every draft, before publish, at the boundary where the decision actually matters.",
      "If your team is asking 'is this AI?' — there are good products for that. If your team is asking 'should we publish this?' — that's the question I spent ten years watching content teams struggle with, and that's the question VeracityAPI is built to answer."
    ]
  },
  {
    slug: "the-most-expensive-bug-in-agent-content-workflows",
    title: "The most expensive bug in agent content workflows",
    description: "The unbounded revise loop. Why it happens, why your agent will burn through hundreds of dollars on a single draft if you let it, and the four-line fix.",
    date: "2026-05-15",
    author: bernardByline,
    body: [
      "Here's the bug I see most often when teams integrate VeracityAPI into agent workflows: the unbounded revise loop. It's the most expensive bug in agent content systems and almost everyone hits it at least once.",
      "The setup is innocent. You wire VeracityAPI into your content pipeline. The agent generates a draft, you score it, the gate returns 'revise,' you pass the evidence array back to the rewrite agent, the rewrite agent produces a revised draft, you score again. So far so good — this is exactly the pattern the API is designed to support.",
      "The problem is the loop's exit condition. If you don't explicitly cap the number of revise cycles, you can run indefinitely on a single document. The rewrite agent will happily try again. The scoring gate will happily say 'revise' again. Both systems are doing their jobs correctly. Neither has any way of knowing the loop has become economically irrational.",
      "I've seen teams burn through $200, $300, $500 on a single document before they noticed the pattern. The economics seem fine at the per-call level — $0.005 per scoring call, a few cents per rewrite — but the multiplication is brutal. Five rewrites per page, 100 pages in the queue, three documents that get stuck in an infinite loop: suddenly you're looking at a four-figure surprise on next month's bill.",
      "The fix is four lines of code and one configuration decision.",
      "The four lines: track a counter on the state object. Increment it every time you re-enter the score node. If the counter exceeds your max-attempts threshold, route to escalate instead of rewrite. That's it.",
      "The configuration decision: what's the right max-attempts value? My recommendation is three. Here's the reasoning:",
      "On the first rewrite cycle, the rewrite agent has the full evidence array and can usually address it. Most drafts that fail on first scoring pass within one rewrite — call it 70%+ in healthy steady state.",
      "On the second cycle, the agent has the evidence from both the original AND the first rewrite. If it still can't fix the document, the problem usually isn't a writing problem — it's a structural problem (the document is making a claim that can't be specifically supported, or the topic is one the generation prompt isn't suited for). Another 20% land here.",
      "By the third cycle, you're paying real money to discover what's already true: this document needs a human. Escalate, log the evidence trail for the editor, and move on.",
      "Above three attempts, you're not getting better content — you're getting the same evidence categories paraphrased into different generic alternatives. The cost-benefit curve goes negative fast.",
      "There's a related anti-pattern worth flagging: scoring on a moving threshold. Some teams set up the gate to use a probability score (content_trust_score) as the routing decision instead of recommended_action. That works until the underlying model recalibrates in a version bump, at which point your 0.65 threshold no longer means what it used to mean and your gate is quietly letting through drafts that previously would have been caught (or vice versa).",
      "The recommendation is to branch on recommended_action exclusively. The action labels stay stable across versions because they're tied to the decision the response is designed for. The score is for your telemetry; the action is for your code.",
      "Both patterns — the unbounded loop and the score-threshold drift — share a root cause. Agent content workflows are easy to write but hard to operate. Every loop, every threshold, every edge case becomes part of the runtime surface area you're maintaining. The reason the API ships with recommended_action as the primary integration field, and the reason this post exists, is that I'd rather your agent workflow run cheaply and stably than save you the four lines of counter code.",
      "If you're integrating VeracityAPI into a LangGraph workflow specifically, the integration page at /integrations/langgraph has the full pattern with the bounded-loop implementation. The same pattern applies to OpenAI Actions, Claude tool_use, or any other agent framework — the framework changes, the failure mode doesn't."
    ]
  },
  {
    slug: "why-the-ai-detection-category-is-splitting",
    title: "Why the AI-detection category is splitting",
    description: "The category that started as 'is this written by AI?' is becoming two categories. Where each one is heading, who they're built for, and why a single product can't do both jobs well.",
    date: "2026-05-15",
    author: bernardByline,
    body: [
      "Three years ago, 'AI detection' was a single category. A tool you uploaded text to, and it returned a probability that the text was generated by an AI. The use cases were narrow but coherent: academic integrity, editorial review, hiring portfolio review, journalism.",
      "Sometime around the second half of 2024, the category started bifurcating. By early 2026 — where we are now — it's clearly become two categories with different buyers, different response shapes, and different success metrics. I want to lay out what's happening, because the bifurcation has implications for how teams should evaluate the products in this space.",
      "Category 1: Authorship likelihood detection. This is where the category started. GPTZero, Originality.ai, Copyleaks' AI module, and several others occupy this space well. The job is to provide a probability score that a human will read and interpret. The product surface is built around that: a probability output, often a confidence interval, a UI that explains the score in plain language for a human reviewer.",
      "Authorship-likelihood detection is settling into mature category dynamics. The buyers are institutions (universities, school districts, large publishers, hiring platforms). The procurement shape is recognizable: annual contracts, security reviews, dedicated support. The competitive axes are accuracy on adversarial samples, false-positive rates, and brand recognition with institutional buyers.",
      "Category 2: Workflow-routing APIs. This is the category VeracityAPI is in, and it's still being defined. The job is to take content and return a deterministic action that automation can execute. The product surface is built around that: a structured response with an action label, an evidence array that's machine-readable, fixes that a rewrite agent can consume as prompts.",
      "Workflow-routing buyers look very different. They're developers building autonomous agents, content platforms with programmatic publishing pipelines, AI infrastructure teams curating training data. The procurement shape is API-tier: pay-per-call, self-serve, no procurement cycle. The competitive axes are routing-action accuracy, integration cost, multimodal coverage under one response shape.",
      "Why is this happening now? Two reasons, both downstream of the same broader shift.",
      "First, the volume of agent-driven content has grown to the point where workflow-routing is the dominant use case by call volume. Academic integrity is real but bounded — there are only so many student essays in the world. Programmatic content factories, RAG pipelines, and agent workflows generate orders of magnitude more decisions per day. A product designed for the bounded use case can't economically serve the unbounded one without warping its response shape.",
      "Second, the response shapes that serve a human reviewer and the response shapes that serve an autonomous agent are genuinely different. A probability score is the right shape for a human; it gives the reviewer judgment. A probability score is the wrong shape for an agent; it forces the developer to write thresholding code that becomes brittle as the underlying model evolves. The action label is right for the agent; it would be insulting to a human reviewer.",
      "You can imagine a product that returns both — a probability AND an action label. Some products do try this. The problem is that the response shape determines the product's center of gravity. If you optimize for the probability accuracy on adversarial samples (the authorship-likelihood metric), you don't optimize for routing-action stability across versions. If you optimize for routing-action stability, the probability isn't your headline metric, and authorship-likelihood buyers correctly perceive the product as not built for them.",
      "Most products will pick a side, even if they keep marketing copy that suggests they serve both. I think VeracityAPI is on the workflow-routing side definitively — the response shape, the documentation, the pricing model, the integration patterns are all designed for the second category. I think GPTZero, Originality.ai, and Copyleaks are on the authorship-likelihood side definitively, even though all of them have shipped API products that look superficially similar to VeracityAPI's.",
      "What this means for buyers: pick by the question your workflow is actually asking. If a human reviewer is going to read the score and decide, pick a Category-1 product. If your code is going to read the response and execute, pick a Category-2 product. Many teams legitimately use one of each, in different layers of the same stack.",
      "What this means for the category: the next 18 months will probably see explicit specialization. Category-1 products will get more sophisticated UIs for human reviewers (explanation interfaces, confidence intervals, sample-comparison tools). Category-2 products will get more sophisticated response shapes for autonomous agents (richer evidence arrays, structured rewrite prompts, multimodal routing). The middle won't hold.",
      "The 2026 benchmark program VeracityAPI is publishing will report both binary-flagging F1 (the Category-1 metric) AND routing-action F1 (the Category-2 metric), with frozen artifacts. Not because we expect to dominate the Category-1 leaderboard — we don't — but because the comparison only makes sense if both metrics are visible at the same time. If you only see one number, you can't tell which category the product is optimized for."
    ]
  },
  {
    slug: "why-we-dont-publish-competitor-benchmarks-yet",
    title: "Why we don't publish competitor benchmark numbers (yet)",
    description: "The most common question I get is 'how does VeracityAPI compare to GPTZero on accuracy?' The honest answer is that I don't have a number I'm willing to publish — and here's the system we're building to produce one.",
    date: "2026-05-15",
    author: bernardByline,
    body: [
      "The most common question I get on sales calls and Twitter DMs is some version of: 'how does VeracityAPI compare to GPTZero on accuracy?'",
      "The honest answer is that I don't have a number I'm willing to publish. Not because the comparison would be unflattering — I don't actually know what it would show, which is the point — but because the comparison done badly is worse than no comparison at all. This post is the long-form version of why, and what we're building instead.",
      "Most published benchmarks in the AI-detection category fall into one of three problematic patterns.",
      "Pattern 1: The vendor-self-benchmark. A vendor publishes their own accuracy numbers against a hand-picked corpus of their own design. The numbers always look good. They don't replicate when independent researchers try them. The benchmark serves as marketing collateral, not as evaluation. Every reader knows this is happening and discounts the numbers accordingly, which is rational but doesn't help anyone make a buying decision.",
      "Pattern 2: The leaderboard-game. A third party publishes a benchmark with results across multiple vendors. The leaderboard becomes the metric vendors optimize for. Within a quarter, every vendor's published numbers cluster within a fraction of a point of each other — not because the vendors converged on quality, but because they all overfit to the public corpus. The leaderboard stops being informative.",
      "Pattern 3: The 'I ran some tests' blog post. A practitioner publishes their own informal benchmark on a small dataset, usually with a specific failure mode the practitioner cares about. The post goes viral. Within a week, half the threads in the category are referencing it as ground truth. The practitioner did good work, but a small informal benchmark gets cited as if it were a comprehensive study.",
      "All three patterns share a root problem: the benchmark isn't structured to survive scrutiny. The corpus isn't licensed and reproducible. The methodology isn't documented in a way that supports replication. The results aren't versioned with the model versions at the time of the run. Six months later, no one can recreate the run or check the work.",
      "The 2026 benchmark program we're building is structured specifically to avoid those patterns. The design constraints I want to share publicly:",
      "First: licensed, frozen corpus. The text corpus is 1,000 samples drawn from a mix of human-written, generated, polished-AI-with-specifics, and adversarial categories. The image and audio corpora are smaller pilots (120 and 80 items respectively). Every item has a documented licensing path and is reproducible by anyone with the same corpus.",
      "Second: vendor terms cleared before any vendor numbers appear. Most detection vendors have terms of service that govern benchmark publication. We're working through those terms vendor by vendor before publishing any competitor-specific numbers. If a vendor's terms preclude the kind of benchmark we want to publish, we'll publish the structural results (corpus composition, methodology, our own numbers) without that vendor's specific numbers and disclose why.",
      "Third: both binary-flagging F1 AND routing-action F1 reported. This is the most important commitment. The 'AI-detection' category is splitting into two product categories (I wrote a longer post about this) and reporting only one metric obscures the comparison. Binary-flagging F1 is the metric Category-1 products (authorship-likelihood detectors) optimize for; routing-action F1 is the metric VeracityAPI is built around. We'll publish both. Some products will look better on one; we expect to look better on the other.",
      "Fourth: 'where Veracity loses' stays on the page. Even if the final benchmark is favorable for us, the failure-mode slices stay published. English-first calibration. Compressed-audio confidence drops. Adversarial-sample weaknesses. The benchmark isn't a sales tool; it's an evaluation artifact. Hiding the weaknesses would defeat the point.",
      "Fifth: frozen run manifest with versioned model identifiers. Every result is tied to the specific model version each vendor was running at run time. Six months from now, when the models have evolved, the results will be a snapshot of that specific moment — useful for trend analysis, not eternally valid.",
      "The benchmark status page at /evals/2026-benchmark shows the current state. As of this writing, the corpus design is frozen, the vendor terms review is in progress for four named competitors, and the planned publish date is later in 2026 once the legal-clearance gate completes.",
      "I know this is slower than publishing a sales-friendly number this quarter. I think the slower path is the only one that produces a benchmark anyone should believe. The category has had enough cycles of marketing-driven numbers; I'd rather contribute one careful artifact than five fast ones.",
      "If you're evaluating VeracityAPI for production right now and the question 'how does it compare?' is blocking your decision, here's the version of an answer I can stand behind: VeracityAPI publishes its own routing-action F1 (0.871 macro F1 on a 500-item seed corpus) and the underlying JSONL artifacts. We don't publish competitor numbers yet. Use the published numbers, try the free tier, and judge against your actual workflow. That's the honest comparison the eventual benchmark will formalize."
    ]
  },
  // Legacy posts retained for URL compatibility.
  {
    slug: "benchmarking-ai-detectors-routing-f1",
    title: "Benchmarking AI detectors on the routing decision production teams actually need",
    description: "Why VeracityAPI will report binary flagging metrics alongside workflow-routing F1, with caveats and reproducibility gates.",
    date: "2026-05-13",
    author: bernardByline,
    body: [
      "Most detector comparisons ask whether a model can label content as AI or human. Production teams usually need a different answer: should this content ship, be revised, go to human review, or be rejected?",
      "Our benchmark program will report conventional binary metrics and a routing-action metric. The routing metric is not a claim that competitors are bad detectors; it measures the workflow contract VeracityAPI is built around.",
      "We will not publish named competitor numbers until vendor terms, corpus licensing, and frozen artifacts are complete. The longer-form rationale is in 'Why we don't publish competitor benchmark numbers (yet)' — the short version is that a benchmark done badly is worse than no benchmark."
    ]
  },
  {
    slug: "not-an-ai-detector-routing-linter",
    title: "VeracityAPI is not an AI detector. It is a routing linter for AI outputs.",
    description: "The product wedge: action plus evidence for agent workflows, not forensic authorship proof.",
    date: "2026-05-13",
    author: bernardByline,
    body: [
      "AI detector is the market phrase, but the operational problem is shippability. VeracityAPI does not care who wrote a draft; it cares whether an agent should publish, revise, review, or reject it.",
      "For text, the API looks for AI slop, generic phrasing, weak specificity, and unsupported claims. For image and audio, it uses synthetic-media and provenance-risk language rather than calling media slop.",
      "The output is designed for software branches: recommended_action, primary_reason, evidence, limitations, and optional auto_revise for text. The longer-form rationale for why the category is splitting into authorship-likelihood detectors and workflow-routing APIs is in 'Why the AI-detection category is splitting.'"
    ]
  }
];
