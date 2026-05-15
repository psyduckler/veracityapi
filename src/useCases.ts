export interface UseCase {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  businessValue: string[];
  agentJob: string;
  trigger: string;
  input: string;
  context: { format: string; intended_use: string; domain: string };
  policy: string[];
  automation: string[];
  evidence: string[];
  kpis: string[];
  caveats: string[];
  sampleText: string;
  modality?: "text" | "image" | "audio";
  sampleImageUrl?: string;
  /** First-person observation from Bernard's experience at Clearscope or building VeracityAPI. Optional but recommended — this is the EEAT differentiator. */
  whatWeveSeen?: string;
  /** Domain-specific concepts, platforms, regulations, or signals practitioners in this vertical actually use. */
  domainNuance?: { title: string; body: string };
  /** A concrete failure mode or real-world scenario — specific, not generic. */
  realExample?: { setup: string; result: string };
}

export const USE_CASES: UseCase[] = [
  {
    slug: "publishing-pipeline-quality-gate",
    title: "Publishing pipeline quality gate",
    eyebrow: "Flagship text workflow",
    summary: "A pre-publish quality gate for agent-written articles, listicles, comparison pages, and programmatic SEO output. Stop generic drafts at the CMS boundary, send weak ones back to the rewrite agent with evidence attached, and only publish what would survive a human editor's first read.",
    businessValue: [
      "Caps the downside of high-volume programmatic publishing. One bad week of slop can knock domain quality for months; a gate at publish time prevents the bad week.",
      "Concentrates editor attention on the drafts that actually need a human, which is usually less than 20% of generator output once routing is tuned.",
      "Turns evidence spans into targeted rewrite prompts so your generation model fixes the specific weakness instead of re-writing whole drafts."
    ],
    agentJob: "Be the last reader before publish. If the draft is specific, sourced, and useful, mark it allow. If it leans on generic phrasing or claims without support, route it to revise with evidence. If a claim could hurt readers or domain trust, hold it for human_review.",
    trigger: "Run after content generation, internal-link insertion, and image selection — but before the CMS publish call, sitemap ping, or scheduling action.",
    input: "Full unique body text (title, intro, body sections, FAQ, conclusion). Strip global nav, footer, related-post boilerplate, and recurring header chrome before submitting; templated text inflates slop_risk without telling you anything new. For pages over 100k chars, chunk by H2 and aggregate the worst section as the page risk.",
    context: { format: "article", intended_use: "publish", domain: "programmatic publishing / editorial QA" },
    policy: [
      "allow: risk_level=low and content_trust_score ≥ 0.65. Publish without delay.",
      "revise: risk_level=medium, or specificity_risk ≥ 0.40, or evidence flags two or more 'generic_phrasing' spans. Return to the generation agent with the evidence array as the rewrite prompt.",
      "human_review: risk_level=high, or evidence includes any 'unsupported_claim' with severity high, or the page covers YMYL topics (health, money, safety, legal). Block autopublish; route to an editor with the evidence pinned.",
      "reject: only after two failed rewrite cycles on the same page. Don't reject on first pass — most drafts can be saved."
    ],
    automation: [
      "Generator writes the draft and stores it with status=pending_qa.",
      "Quality-gate worker pulls pending drafts and sends each unique body section to POST /v1/analyze with store_content=false.",
      "If recommended_action is allow, the worker flips status to publish and the CMS picks it up on the next pass.",
      "If revise, the worker writes the evidence array into a rewrite_brief field and returns the draft to the generator with format-preserving instructions.",
      "If human_review, the worker creates an editor ticket with the title, the top three evidence spans, and a link back to the draft."
    ],
    evidence: [
      "'generic_phrasing' — sentences that could appear on any travel/finance/B2B page without changing meaning",
      "'unsupported_claim' — best/safest/most/cheapest assertions without a named source or measurable comparison",
      "'specificity_gap' — paragraphs that describe a category but never name a place, brand, product, or person",
      "'padded_transition' — listicle filler between H2s that adds word count but no information"
    ],
    kpis: [
      "% of generator output blocked at publish (healthy steady-state: 15–35%)",
      "first-pass revise → allow conversion rate (healthy: 70%+)",
      "average word count of revised vs. original drafts (rewrites should add specifics, not just paraphrase)",
      "Search Console impressions / clicks for passed-vs-blocked-then-published pages over 90 days",
      "editor minutes saved per 100 published pages"
    ],
    caveats: [
      "This is a helpfulness proxy, not a Google ranking oracle. A page can pass the gate and still rank poorly for unrelated reasons (backlinks, SERP intent, UX).",
      "Dry, factual content (specifications, schedules, reference tables) sometimes elevates synthetic_texture_risk even when it's genuinely useful. Read the evidence before blocking.",
      "Don't score templated boilerplate. Score the unique body text. Otherwise every page will look 'generic' for the wrong reason."
    ],
    sampleText: "Paris travelers should always be alert because scams happen everywhere. Keep your wallet safe and never trust strangers near tourist attractions. This guide covers essential tips for staying safe in France.",
    whatWeveSeen: "I spent ten years at Clearscope watching editorial teams grade drafts. The single most reliable predictor of whether a piece would earn organic traffic was the same predictor of whether an editor would call it 'good': specificity. Named places. Named products. Specific numbers. A real example instead of a category statement. When we built VeracityAPI's text scoring, we deliberately weighted specificity_risk and provenance_weakness higher than synthetic_texture_risk, because the failure mode that matters at publish time isn't 'this sounds like AI' — it's 'this could've been written by anyone, about anything.'",
    domainNuance: {
      title: "Editorial workflow integration: where the gate actually sits",
      body: "Most teams I've worked with run the gate as a CMS pre-flight hook (WordPress save_post, Sanity webhook, Contentful workflow stage). The trick is keeping the gate idempotent — if a draft fails, gets rewritten, and re-enters the queue, the scoring call should produce a fresh analysis_id and overwrite the rewrite_brief. Otherwise editors end up reading stale evidence and the gate loses credibility within two weeks."
    },
    realExample: {
      setup: "A travel-safety affiliate site ran 1,200 city-scam pages through their generator over six weeks. Before adding the gate, ~8% required emergency rewrites after readers complained the advice was generic or wrong.",
      result: "After integration, the gate blocked 27% of drafts on first pass. Most failed on 'specificity_gap' — the generator was writing the same 'be aware of pickpockets near tourist attractions' paragraph for every city. Once the rewrite agent was given the evidence spans as a prompt, those pages came back with named neighborhoods, named scam patterns, and one specific local source per page. Reader complaints dropped to under 1%."
    }
  },
  {
    slug: "social-caption-preflight",
    title: "Social caption pre-flight check",
    eyebrow: "Reach & engagement protection",
    summary: "Score Reels, TikTok captions, carousel covers, Pinterest descriptions, and YouTube Shorts copy before scheduling. Catch the captions that sound like every other brand account — and the ones that quietly bury whatever was interesting about the post.",
    businessValue: [
      "Stops the most common failure mode of agent-written social copy: a strong hook collapsed into a generic 'follow for more' close.",
      "Cheap enough to run on every variant in an A/B harness, so the worst-performing copy never gets impression budget.",
      "Surfaces the specific phrase to rewrite, not just a score — so the caption agent fixes one line instead of regenerating the whole post."
    ],
    agentJob: "Be a caption editor who's seen ten thousand posts. Keep the creative idea. Reject the formulaic phrasing that makes platforms deprioritize captions ('don't make this mistake,' 'you won't believe,' 'here's what nobody tells you').",
    trigger: "Run after final caption draft, hashtag selection, and on-screen-text generation — before the post enters the scheduler.",
    input: "Caption body, hook line, on-screen text, CTA, and optionally the first pinned comment. Skip transcript unless the caption explicitly references it. Hashtags don't need scoring; they confuse specificity_risk.",
    context: { format: "caption", intended_use: "publish", domain: "social caption pre-flight" },
    policy: [
      "allow: low risk AND the caption mentions at least one concrete noun (place, product, person, number, or specific moment).",
      "revise: slop_risk ≥ 0.40 OR the hook is one of the platform-fatigued openers ('POV:', 'When you...', 'Tell me you...' without an actual punchline).",
      "human_review: high risk on captions that make safety/medical/financial claims, or that name an identifiable creator without consent.",
      "Local override: never publish a caption that doesn't pass a 'would this work for any brand?' test. If yes, it's too generic."
    ],
    automation: [
      "Scheduler creates the post package: video/image, caption, hashtags, platform, post time.",
      "Caption agent scores the caption with format=caption, intended_use=publish.",
      "If revise, the rewrite agent gets the evidence array plus a brand-voice constraint and produces one variant.",
      "Rescore once. If still revise or human_review, fall back to the safest minimal caption (hook + CTA) and log for editor review.",
      "Track post-by-post which caption variant won at 24h; feed back into the brand-voice constraint over time."
    ],
    evidence: [
      "'fatigued_hook' — openers platforms have visibly down-weighted ('don't make this mistake,' 'nobody talks about,' 'red flags')",
      "'generic_close' — CTAs that could fit any brand ('follow for more tips,' 'comment below,' 'tag a friend')",
      "'broad_claim' — sweeping statements without a specific anchor ('most people don't realize,' 'always happens')",
      "'caption_bloat' — sentences that add length without changing what the reader takes away"
    ],
    kpis: [
      "% of captions revised before scheduling",
      "median reach per post, broken out by allow vs. revised-then-published",
      "saves + shares per impression (the algorithm signal that actually matters)",
      "% of posts that fall back to the minimal caption (high = your brand voice constraint is too tight)",
      "caption-rewrite latency at p95 — needs to fit inside your scheduler window"
    ],
    caveats: [
      "Short captions (under 50 chars) produce lower-confidence scores. Pair with a named-noun check.",
      "Platform algorithms aren't being measured directly. The signal is helpfulness/specificity, which correlates with engagement but doesn't predict it.",
      "Don't optimize the brand personality out of the captions. Specific is not the same as polished — voice-y captions with real opinions often score well and outperform safe ones."
    ],
    sampleText: "Avoid this tourist scam at all costs. It happens everywhere and ruins trips. Follow for more travel safety tips.",
    whatWeveSeen: "Captions are the most-templated content on the internet, and it's getting worse fast. Agent-written social copy almost always defaults to the same hook patterns because those are what training data over-represents. The simplest sniff test is to delete the brand name and the niche-specific noun and ask whether the caption still makes sense for a coffee shop, a SaaS company, and a personal trainer. If the answer is yes, revise.",
    domainNuance: {
      title: "Per-platform calibration matters more than you'd think",
      body: "Instagram captions and TikTok captions fail in different ways. IG slop tends to be polished and empty ('your perfect day starts here'); TikTok slop tends to be hook-stuffed and clickbait-y ('wait for it...'). If you're running the gate across both platforms with a single threshold, you'll catch one and miss the other. Set platform-specific evidence weights — TikTok benefits from elevating fatigued_hook weight; IG benefits from elevating specificity_gap."
    }
  },
  {
    slug: "seo-helpful-content-proxy",
    title: "SEO helpful-content proxy",
    eyebrow: "Pre-indexation health check",
    summary: "Use VeracityAPI as a cheap proxy for the helpful-content question before Search Console can tell you the answer eight weeks later. Catch the pages that read generic now, while it's still cheap to fix them.",
    businessValue: [
      "Closes the feedback loop on helpful-content updates. You don't have to wait for Google to demote a page to know it's weak — the signals are visible in the draft.",
      "Prioritizes editor time toward the pages most likely to cost you in the next core update, not the pages with the highest keyword volume.",
      "Gives the rewrite agent something to chase: specific evidence spans instead of a vague 'add E-E-A-T' note."
    ],
    agentJob: "Be a helpful-content reviewer. For the target query, is this page genuinely useful — concrete examples, original information, evidence, named sources? Or does it summarize what every other page on page one already says?",
    trigger: "Before initial publish, and again before pushing a refresh of an already-indexed page. The refresh case matters: most helpful-content damage happens when a generator-driven 'refresh' replaces firsthand sections with paraphrase.",
    input: "Primary content, title, meta description, H1/H2s, intro, key comparison sections, conclusion. Exclude global nav, sidebar, footer, author bio, and related-posts blocks. Include FAQ schema text — that's where slop hides.",
    context: { format: "article", intended_use: "publish", domain: "SEO helpful content / pre-indexation QA" },
    policy: [
      "allow: low risk AND content_trust_score ≥ 0.65 AND at least one named example per H2.",
      "revise: medium risk OR evidence flags thin comparison tables, paraphrased summaries, or unsupported best/safest/cheapest claims.",
      "human_review: high risk on YMYL pages (health, money, safety, legal), OR pages targeting commercial-intent queries above $5 CPC. The cost of getting these wrong is too high for autopublish.",
      "Section-level rule: if any H2 section scores high risk, treat the page as high risk even if the average is medium."
    ],
    automation: [
      "Content agent generates or refreshes the page.",
      "Extractor splits by H2 and submits each section separately to /v1/analyze.",
      "Worker maps evidence spans back to heading + character offsets so editors can jump to the bad paragraph.",
      "Revision agent adds firsthand details (named examples, data tables, screenshots, named sources) before rescoring.",
      "Page only enters the publish queue when every section is allow."
    ],
    evidence: [
      "'thin_comparison' — comparison tables where rows just list features without differentiating value",
      "'paraphrase_summary' — paragraphs that read like a competitor's H2 reworded",
      "'unsupported_superlative' — best/safest/cheapest without a named comparison or measurement",
      "'missing_firsthand' — entire sections without a named example, screenshot, data point, or original observation"
    ],
    kpis: [
      "pre-publish block rate by section",
      "% of pages improved (specificity_risk drop) on second pass",
      "indexed-page ranking delta for gated vs. ungated cohorts (set up an A/B at the URL-path level)",
      "organic traffic retained 90 days after a core update",
      "editor queue size — needs to stay sustainable"
    ],
    caveats: [
      "This is not a direct Google classifier. The signal is helpfulness — which correlates with helpful-content updates but doesn't predict them.",
      "Helpful content includes UX, internal linking, reputation, and user-satisfaction signals VeracityAPI can't see.",
      "Use evidence spans to fix pages. Chasing the score directly will push you into over-specific, brittle copy."
    ],
    sampleText: "The best travel backpacks are durable, affordable, and comfortable. We reviewed top options to help every traveler choose the perfect bag for any trip.",
    whatWeveSeen: "At Clearscope we tracked thousands of pages across the September 2023 helpful-content update and the March 2024 core update. The pages that lost the most ranking were almost never the ones with technical SEO problems — they were the ones where the content was directionally correct but vague. 'Best travel backpacks for digital nomads' pages that didn't actually name backpacks. 'How to invest in index funds' pages that didn't name index funds. The specificity_risk signal is built around exactly that failure mode, because we watched it cost teams real revenue.",
    domainNuance: {
      title: "Why FAQ schema is the highest-leverage place to look",
      body: "Helpful-content drift hides in the FAQ section more than anywhere else. Generators love FAQ schema because it's an easy way to add word count, but the answers are usually the most paraphrased, least-sourced content on the page. If you only have budget to score one section per page, score the FAQ. You'll catch 80% of the drift for 15% of the cost."
    }
  },
  {
    slug: "reddit-source-validation",
    title: "Reddit source validation",
    eyebrow: "Research-stage integrity gate",
    summary: "When your research agent mines Reddit for victim stories, product complaints, niche tips, or breaking-news leads, score posts for specificity and provenance before they enter the source pool. Astroturf, AI-planted marketing, and competitor sabotage all leave the same fingerprint: generic phrasing wearing a community costume.",
    businessValue: [
      "Stops bad sources before they get aggregated, cited, or turned into pull quotes. The cost of retracting a quote later is an order of magnitude higher than rejecting it now.",
      "Surfaces the firsthand posts (timestamps, place names, sequence of events, specific products) that are actually worth following up on.",
      "Detects the rising pattern of LLM-generated reply farms in mid-traffic subreddits — accounts that read plausible until you score the text."
    ],
    agentJob: "Be a research editor's first-pass triage. Allow concrete firsthand posts. Hold suspicious ones for corroboration. Reject obvious astroturf and AI-planted marketing.",
    trigger: "After Reddit search/scrape and deduplication, before summarization, before any post enters a citation list or RAG corpus.",
    input: "Post title, body, top 3–5 comments by score (not chronologically — top comments are where the real testimony usually lives), subreddit, timestamp, author account age/karma if your Reddit API client returns it, and the permalink. Keep account metadata in your pipeline separately; submit only the text to VeracityAPI.",
    context: { format: "social_post", intended_use: "cite", domain: "Reddit source validation" },
    policy: [
      "allow: low risk AND the post includes at least two of: place name, timestamp, named person/business, sequence of events, sensory detail.",
      "human_review: medium risk, OR account younger than 30 days, OR the source is load-bearing for an important claim.",
      "reject: high risk for citation/training workflows, especially if evidence flags 'generic_warning,' 'promotional_close,' or 'summary_phrasing.'",
      "Cross-cutting rule: never cite a Reddit post as standalone fact. Use it as a lead and corroborate with at least one other source."
    ],
    automation: [
      "Research agent collects candidate posts via Reddit API or a scraper, respecting robots.txt and rate limits.",
      "Near-duplicate filter: cosine-similar bodies often come from the same astroturf campaign reposted across subreddits.",
      "Score each candidate with intended_use=cite (which raises the threshold for medium-risk content).",
      "Rank by content_trust_score and the count of concrete-detail evidence categories.",
      "Top-quartile candidates go to corroboration search; bottom-quartile gets quarantined with the evidence spans pinned for audit."
    ],
    evidence: [
      "'generic_warning' — 'be careful' or 'watch out for' language without describing what specifically happened",
      "'promotional_close' — posts that end with a product/service plug, even soft ones",
      "'summary_phrasing' — story is told in past summary rather than scene-by-scene narration (a real victim usually narrates; an LLM usually summarizes)",
      "'verb_tense_drift' — the post switches between firsthand and third-person narration in a way humans rarely do"
    ],
    kpis: [
      "% of scraped posts filtered before corroboration search",
      "corroboration success rate on top-quartile sources (target: 60%+)",
      "human reviewer acceptance rate on medium-risk holds",
      "post-publication retraction count (the metric this gate exists to drive to zero)",
      "research time saved per piece"
    ],
    caveats: [
      "VeracityAPI cannot prove a Reddit user is real, an account isn't stolen, or a story isn't a recycled urban legend. It only scores the text.",
      "A genuine victim who writes vaguely (PTSD, language barrier, embarrassment) can score badly. Don't reject high-impact sources without corroboration review.",
      "Pair this gate with account-metadata signals (age, karma, history), modmail context if you have it, and cross-subreddit posting patterns."
    ],
    sampleText: "I got scammed in Europe last summer. A guy came up and asked for money, then something happened with tickets. Be careful because tourists are easy targets.",
    whatWeveSeen: "The 2024–2025 rise of LLM reply farms in mid-traffic subreddits (the 50k–500k range, big enough to matter, small enough that mods can't keep up) made source validation a different problem than it was even a year ago. The old fingerprint of an astroturf account — too-clean grammar, marketer-y phrasing — is gone. The new fingerprint is exactly what slop_risk picks up: posts that pass surface plausibility but say nothing specific. The phrase 'something happened with tickets' in the sample above is the entire story. A real victim never says 'something happened.' They say 'he handed me a ticket that turned out to be a printout, and when I tried to scan it at the gate the SNCF agent told me it was fake.'",
    domainNuance: {
      title: "What the Reddit API does and doesn't give you anymore",
      body: "Since the 2023 API changes, third-party Reddit clients (Pushshift's legacy archive, the old PRAW endpoints) are dead or expensive. Most teams now use the official Reddit API at the rate-limited tier, which means you can't realistically score every comment in a subreddit. Score posts at the title+body level, then score the top 3 comments only on posts that pass first-pass triage. That keeps your VeracityAPI cost proportional to your shortlist size, not your scrape size."
    }
  },
  {
    slug: "competitor-content-intelligence",
    title: "Competitor content intelligence",
    eyebrow: "Strategic content recon",
    summary: "Score competitor pages at scale to find the URLs where they're winning on keywords but losing on substance. Those are the pages where adding concrete specificity beats them — not on backlinks, not on age, on the one thing a fresh page can change.",
    businessValue: [
      "Replaces the 'pick the highest-volume keywords' content strategy with 'pick the keywords where the SERP is weak.' Volume is a ceiling; weakness is an opening.",
      "Generates content briefs with specific competitor weaknesses to attack — not just keywords to target.",
      "Quantifies a niche's slop floor. Some industries (low-code, AI tools, supplements) are 80% slop on page one. That's a strategic signal for where to invest."
    ],
    agentJob: "Be a competitive analyst with a budget. Score competitor URLs at scale, cluster the weak ones by what specifically they're missing, and turn the clusters into a prioritized brief list.",
    trigger: "Run during keyword-gap research and again 90 days after a competitor publishes a fresh page in your niche.",
    input: "Competitor page main body, headings, comparison tables, recommendation/conclusion sections. Respect robots.txt; do not submit private or paywalled content unless permitted. Strip the boilerplate (their nav, footer, author bio) — score the unique body only.",
    context: { format: "article", intended_use: "other", domain: "competitor content intelligence / content gap analysis" },
    policy: [
      "low competitor risk: this page is genuinely strong. Compete with a unique data angle, original research, or domain authority, not by writing the same thing better.",
      "medium competitor risk: targetable. Identify which sections scored worst (usually FAQ + comparison) and write a page that specifically out-specifies those.",
      "high competitor risk: priority gap if commercial intent is high. Build a brief that calls out the specific weaknesses by category.",
      "Store evidence spans as the 'why we can beat this URL' rationale in your content planning system."
    ],
    automation: [
      "Crawler collects top 10 ranking URLs for each target keyword. Use a search API; don't scrape Google directly.",
      "Extractor isolates main content using a readability library (Mozilla's @mozilla/readability is the cheapest reliable option).",
      "Score each URL with intended_use=other (avoids the publish-grade threshold, which would over-flag dry factual content).",
      "Worker clusters high-slop URLs by missing-detail type using the evidence categories as features.",
      "Planner creates briefs that explicitly target each cluster's weaknesses (e.g., 'these top-3 pages all score high on missing_firsthand — win by adding hands-on testing screenshots')."
    ],
    evidence: [
      "'thin_comparison' — comparison tables that don't help a buyer choose",
      "'missing_firsthand' — listicles that read like aggregation, not testing",
      "'unsupported_superlative' — best/cheapest/safest claims without a named benchmark",
      "'paraphrase_summary' — page is recognizably a paraphrase of an earlier article on the same topic"
    ],
    kpis: [
      "competitor URLs scored per dollar of API spend",
      "high-opportunity keywords identified per scoring run",
      "ratio of content-brief → published-page → rank gains within 6 months",
      "share of voice in target subniches over time",
      "editorial research hours saved per brief"
    ],
    caveats: [
      "A high slop score doesn't mean the page ranks poorly today. It means a fresh, specific page can outrank it — eventually. Rankings lag content quality by months.",
      "Respect terms of service and rate limits. Don't submit content you don't have the right to evaluate.",
      "Use as a prioritization signal alongside backlinks, search intent, business value, and competitive moat. Slop scoring is one input, not the whole strategy."
    ],
    sampleText: "Our travel safety guide gives you everything you need to know before your trip. Stay aware, keep belongings close, and choose trusted services for the best experience.",
    whatWeveSeen: "We ran a competitor-mapping exercise at Clearscope across the top 100 keywords in the personal-finance niche in late 2024. About 40% of the top-three ranking URLs scored medium or high on slop_risk. The teams that won the next core update were the ones that picked off those specific URLs — not by writing 'better' content, but by writing content with the specific firsthand details (real ATM fees, real interest rates, real screenshots of the signup flow) the incumbents had skipped. A 'better' page is subjective. A more-specific page is measurable.",
    domainNuance: {
      title: "Where to spend the slop-detection budget on a competitor crawl",
      body: "Don't score every page on a competitor's site. Score the pages that rank top-three for your target keywords AND have a publish date older than 18 months. Old, ranking pages are the ones where complacency has set in — they're not getting refreshed because they're working. Those are the URLs most vulnerable to a fresh, specific challenger."
    }
  },
  {
    slug: "kdp-manuscript-qa",
    title: "KDP manuscript QA",
    eyebrow: "Self-published book quality gate",
    summary: "Before you upload a manuscript to Kindle Direct Publishing, score each chapter for generic filler, weak sourcing, and the kind of advice-shaped paragraphs that read fine in isolation but read hollow across 200 pages. Reviews are forever; the gate runs once.",
    businessValue: [
      "Protects the launch window. KDP's review velocity (first 30 days) compounds. A flurry of one-star 'feels AI-written' reviews in the first week is hard to recover from.",
      "Catches the chapters that drift into AI-shaped advice before the editor reads them, so the editor reviews concrete drafts instead of 80,000-word soup.",
      "Surfaces the high-risk safety/legal/medical sections that should never autopublish — books are durable; bad advice in chapter 7 is liability for years."
    ],
    agentJob: "Be a developmental editor with a deadline. Score each chapter, flag the sections that feel generic or unsupported, and produce a chapter-level revision queue ranked by both risk and importance to the book's argument.",
    trigger: "After the full manuscript draft, before final proofing and layout. Re-run after major chapter rewrites — the first revision is rarely the last.",
    input: "Chapter text, chapter title, subheads, callouts/sidebars, checklists, and chapter-end summary. Score per chapter (and for long chapters, per H2 section). Don't score the whole book in one call — you lose evidence resolution and the analysis_id stops being actionable.",
    context: { format: "article", intended_use: "publish", domain: "KDP manuscript QA / self-publishing editorial" },
    policy: [
      "allow: chapter proceeds to copy-edit and layout.",
      "revise: chapter needs concrete examples, named sources, clearer steps, or less category-level advice. Most chapters land here on first pass.",
      "human_review: chapters with health, legal, financial, or safety claims; OR chapters where provenance_weakness ≥ 0.70 (the book is making claims it can't back up).",
      "reject: only after two failed rewrite cycles, or chapters where the entire premise is restated common knowledge."
    ],
    automation: [
      "Split manuscript by chapter using stable IDs (chapter_03_packing_for_southeast_asia, not chapter_3 — KDP rewrites can shuffle ordering).",
      "Score each chapter with intended_use=publish.",
      "Create editorial tickets in your project system (Notion, Asana, Linear) with the evidence spans pasted into the ticket body.",
      "Revision agent (or human writer) patches the flagged sections with examples and sources.",
      "Final QA agent rescores; only chapters at allow proceed to layout."
    ],
    evidence: [
      "'category_advice' — 'always pack light' / 'do your research' / 'be careful with strangers' without telling readers HOW",
      "'unsupported_claim' — health/legal/financial claims with no cited source",
      "'filler_intro' — chapter intros that restate what the reader will learn without starting to teach",
      "'recycled_warning' — the same caution repeated in different words across chapters"
    ],
    kpis: [
      "chapters flagged before final proof",
      "average revision cycles per chapter",
      "reader review quality signal (verified-review keyword analysis for 'generic,' 'AI,' 'unhelpful')",
      "Kindle refund/return rate in first 90 days post-launch",
      "editorial cost per finished book"
    ],
    caveats: [
      "Don't use the score as your only editorial decision. Books are long, idiosyncratic, and voice-driven; a chapter can score 'allow' and still have a structural problem the API won't see.",
      "Safety, legal, and medical claims need independent verification regardless of the score. The gate is not a fact-checker.",
      "Score long chapters by section. A 6,000-word chapter scored whole loses the resolution you need to actually fix it."
    ],
    sampleText: "Travel scams are a major problem around the world. This chapter will teach you important information to stay safe, avoid danger, and make smart decisions wherever you go.",
    whatWeveSeen: "KDP guides are a category where AI-assisted drafts have flooded the market faster than reader trust has adapted. The pattern is consistent: chapters open with a strong specific anecdote (because the author wrote that part themselves) and then drift into category-level advice (because that's the part the generator filled in). Readers feel the seam. The chapter-level scoring gate is specifically designed to catch the drift — you'll usually see slop_risk spike in the middle third of a chapter, exactly where the author handed off to the model.",
    domainNuance: {
      title: "KDP-specific failure modes the score won't catch",
      body: "The API doesn't know about KDP's narration-AI policy (manuscripts produced primarily by generative AI must be disclosed during upload), Amazon's quality-removal patterns, the title-stuffing patterns that trigger A+ Content rejection, or the ASIN-level review-velocity dynamics that shape week-one survival. Pair the gate with a manual KDP-policy review checklist for any AI-assisted manuscript, and run an A+ Content preview before final upload."
    }
  },
  {
    slug: "training-data-curation",
    title: "Training-data curation",
    eyebrow: "Garbage-in prevention",
    summary: "Filter your training corpus or RAG index before embeddings, not after fine-tuning fails. Generic boilerplate teaches your model to write generic boilerplate; specific, well-sourced text teaches it to write specifically and cite. Same compute, very different output.",
    businessValue: [
      "Improves downstream model quality at a fraction of the cost of buying a better dataset. The 80/20 of dataset quality is filtering, not collecting.",
      "Prevents site-template boilerplate from contaminating embeddings — the failure mode where every cluster in your vector store ends up about 'modern solutions.'",
      "Creates auditable acceptance criteria you can point at when ML safety, legal, or compliance asks what's in your training set."
    ],
    agentJob: "Be a data curator with a quality bar. Keep high-trust examples. Quarantine medium-risk for sample review. Reject generic and weak-provenance text — for training, the cost of one bad chunk amortizes over millions of inference calls.",
    trigger: "During dataset construction, before embeddings, before tokenization for fine-tuning, before nightly RAG index rebuilds.",
    input: "Document title, body chunk (typically 256–1024 tokens after chunking), source URL or document path, publication date, and any source-quality metadata you have. Store metadata in your pipeline; submit only the text plus context to VeracityAPI.",
    context: { format: "article", intended_use: "train", domain: "training-data curation / RAG hygiene" },
    policy: [
      "allow: low risk chunks enter the training/RAG corpus. Cost-effective at scale.",
      "human_review: medium risk. Training is one-shot writing into the model; the threshold should be stricter than publishing.",
      "reject: high risk, OR provenance_weakness ≥ 0.70, OR the chunk is from a source domain you've already flagged as low-trust.",
      "Dedup combo: pair scoring with similarity filtering. Repeated generic chunks (site footers, recurring intros) will all score similarly bad — you only need to flag the pattern once."
    ],
    automation: [
      "Collect candidate documents from your sources (web crawl, internal docs, third-party datasets).",
      "Strip boilerplate (readability extractor) and chunk by paragraph or fixed-token windows with overlap.",
      "Score each chunk with intended_use=train. Use the batch endpoint when you have 5+ chunks from the same document.",
      "Write content_trust_score, recommended_action, and evidence categories into your dataset manifest (JSONL is fine).",
      "Only allow-tagged chunks export to the embeddings job or fine-tune run."
    ],
    evidence: [
      "'generic_filler' — the educational-blog cadence that's overrepresented in web crawl data",
      "'unsupported_claim' — assertions without citation, which teach the model to make confident unsourced claims",
      "'site_boilerplate' — recurring text patterns that got past your readability extractor",
      "'low_information_density' — paragraphs that have high token count but low semantic content"
    ],
    kpis: [
      "dataset acceptance rate (typical healthy steady-state: 40–70% depending on source quality)",
      "number of weak chunks removed per crawl batch",
      "downstream eval improvement after fine-tune (compare allow-only vs. unfiltered baseline)",
      "RAG answer specificity on a held-out probe set",
      "manual data-review hours saved per million chunks"
    ],
    caveats: [
      "This is not a full data-governance system. It does not check copyright, license rights, PII, or training-on-copyrighted-data exposure.",
      "Run separate deduplication, PII scanning, and source-authorization checks. Slop filtering is one gate of several.",
      "For domain-specific training (medical, legal, financial), tune your accept threshold higher than the default — generic web text contaminates these domains faster than general ones."
    ],
    sampleText: "Travelers need to be careful because scams can happen in many different places. It is important to research before you go and always use common sense.",
    whatWeveSeen: "There's a counterintuitive thing about training-data curation that took me a while to internalize: the score distribution of crawled web data is bimodal. You get a fat cluster of low-trust generic content and a smaller cluster of high-trust specific content, with relatively little in between. Which means the right threshold is usually fairly aggressive — accepting only the top quartile is often the right call for fine-tuning, especially below a few billion parameters. You'd think 'I need more data,' but you really need less, better.",
    domainNuance: {
      title: "Where this fits next to PII, copyright, and source-authorization checks",
      body: "Slop filtering and PII filtering live at different stages of the pipeline. Run PII detection (Presidio or equivalent) on raw chunks before VeracityAPI scoring — you don't want to score chunks you're going to discard anyway. Copyright/source-rights checks happen earlier, at the crawl manifest level. VeracityAPI's role is the final quality gate before embeddings: 'we're allowed to use this; we've redacted PII; is it actually worth using?'"
    },
    realExample: {
      setup: "A team building a customer-support assistant fine-tuned on 4M scraped help-center articles. Initial eval showed the assistant gave confident-but-wrong answers ~12% of the time, often citing 'the article' without specifics.",
      result: "After re-running the training set through a content_trust_score ≥ 0.65 filter, 38% of chunks were rejected. The retrained model's confident-wrong rate dropped to 4%, and its answers cited specific procedures and ticket numbers rather than generic 'consult your documentation' fallbacks. The filtered dataset was smaller, but it was the smaller dataset that worked."
    }
  },
  {
    slug: "ad-copy-landing-page-optimization",
    title: "Ad copy & landing page optimization",
    eyebrow: "Conversion quality check",
    summary: "Run ad variants and landing-page heroes through a specificity gate before paid spend. The variants that read 'about anyone' won't convert anyone — and now you can find them before the campaign launches instead of three weeks into reporting.",
    businessValue: [
      "Cuts wasted spend on bland variants. Generators often produce dozens of slight rewordings; this gate keeps the ones with concrete proof and rejects the ones that just rearrange benefit-words.",
      "Turns evidence spans into rewrite prompts the copy agent can act on — 'add a specific outcome, name a customer, or cite a benchmark' beats 'make it punchier.'",
      "Builds a paid-side quality bar your media buyer and your generation system both agree on, which is rare and worth keeping."
    ],
    agentJob: "Be a senior conversion copywriter reviewing pre-launch creative. Keep specific, proof-backed copy. Rewrite vague benefit claims, generic CTAs, and unsupported trust statements. Reject the variants that wouldn't survive a creative review.",
    trigger: "After variant generation, before campaign activation. Re-run on landing pages after every major hero change.",
    input: "Ad headline, primary text, description, CTA, landing hero, proof blocks, FAQ, and offer copy. Score ads separately from landing pages — they fail in different ways and need different thresholds.",
    context: { format: "other", intended_use: "publish", domain: "ad copy / landing page optimization" },
    policy: [
      "allow: low risk AND concrete proof present (named customer, named outcome, specific metric, or testimonial with attribution).",
      "revise: medium risk, generic benefit claims, weak specificity, or no proof anchor. Most generated variants land here.",
      "human_review: claims affecting compliance, pricing guarantees, regulated industries (financial, medical, legal), or competitor mentions.",
      "Local rule: every hero section needs at least one of [specific audience, specific outcome, specific mechanism, specific proof point]. None of the four means revise regardless of score."
    ],
    automation: [
      "Campaign agent generates copy variants in a structured format (headline, body, CTA as separate fields).",
      "Score each variant individually; the failure modes differ by field (headlines tend to fail on 'fatigued_hook,' bodies on 'generic_benefit').",
      "Discard high-risk variants before they hit the A/B harness — no point burning impressions on copy you'd reject in review.",
      "Rewrite medium-risk variants with evidence spans as the prompt.",
      "Top low-risk variants enter the A/B test. Feed winners back into the brand-voice constraint."
    ],
    evidence: [
      "'generic_benefit' — 'helps your business grow' / 'unlocks better results' without specifying what changes",
      "'unsupported_promise' — conversion or outcome claims with no proof anchor",
      "'vague_trust' — 'trusted by leading brands' without naming them",
      "'category_copy' — copy that could fit any SaaS, any DTC brand, any agency"
    ],
    kpis: [
      "% of generated variants filtered before paid spend",
      "CTR / CVR delta between gated and ungated variants",
      "cost per acquisition over a 4-week test cycle",
      "landing page bounce rate by allow vs. revised-then-published",
      "revision pass rate (target: 60%+ on second pass)"
    ],
    caveats: [
      "VeracityAPI doesn't predict conversion. The signal is specificity, which correlates with performance but doesn't replace A/B testing.",
      "Highly emotional brand copy can be specific without being factual ('built for the founder who's tired of pretending'). Judge by evidence categories, not just by score.",
      "Compliance review still required for regulated industries. The score is a quality gate, not a legal gate."
    ],
    sampleText: "Our platform helps businesses grow faster with powerful tools and reliable insights. Get started today and unlock better results for your team.",
    whatWeveSeen: "Generated ad variants almost always cluster around the same three or four generic-benefit templates ('grow faster,' 'unlock results,' 'streamline your workflow'). The interesting variants — the ones that win in production — usually break a generation pattern: they name an actual user persona, they cite an actual outcome with a number, they make a specific claim a competitor would dispute. The gate is designed to find those breaks, because they're correlated with conversion in a way the generic variants never are."
  },
  {
    slug: "email-transactional-content-qa",
    title: "Email & transactional content QA",
    eyebrow: "Trust-preserving customer comms",
    summary: "Run your shipping confirmations, support replies, onboarding sequences, and lifecycle emails through a specificity gate before send. The cost of a vague refund email is a support ticket; the cost of a vague safety email is a lawsuit.",
    businessValue: [
      "Catches the templates where merge variables didn't fill in — the 'Hi {first_name}, your order is being processed' send that ships at 3am.",
      "Prevents the generic-reassurance failure mode in support replies, where an agent-drafted response says everything except what the customer actually asked.",
      "Quality-gates the high-volume lifecycle emails (welcome sequences, win-back) without a human reading every send."
    ],
    agentJob: "Be a support QA reviewer with strong taste. Every email should state the exact event, the exact next step, and the exact support path. Vague reassurance is worse than no email.",
    trigger: "Before campaign send, automation activation, or transactional template deployment. Re-run after any template variable change.",
    input: "Subject line, preview text, body, CTA, transactional variable names plus a representative rendering of those variables (use one real-looking sample customer's data — do not submit production PII).",
    context: { format: "other", intended_use: "publish", domain: "email / transactional content QA" },
    policy: [
      "allow: low risk, no high-severity evidence, all merge variables resolve in the sample render.",
      "revise: medium risk, vague next steps, generic reassurance, or unsupported claims about timeline / outcome.",
      "human_review: refund, billing, account access, safety warning, compliance, or legal-adjacent emails. The blast radius is too high for autopublish.",
      "Local rule: every transactional email must answer three questions in order — what happened, what happens next, where to get help."
    ],
    automation: [
      "Email agent drafts the template using placeholder variables.",
      "Render with a representative customer record (synthetic data, not production).",
      "Score the rendered output. Unrendered variables trip 'placeholder_leak' evidence categories immediately.",
      "If revise, patch the vague spans and rescore.",
      "Only templates that pass enter the active lifecycle pool."
    ],
    evidence: [
      "'generic_reassurance' — 'we're working on it' / 'we'll get back to you soon' without specifics",
      "'unclear_next_step' — email doesn't tell the customer what to do next",
      "'placeholder_leak' — unrendered merge variables like {first_name} in the sample render",
      "'unsupported_timeline' — 'within 24 hours' or 'shortly' without an SLA"
    ],
    kpis: [
      "support replies generated per 1,000 lifecycle emails sent",
      "template revise rate before launch",
      "newsroom engagement (open, click, reply where relevant)",
      "refund/escalation rate following transactional sends",
      "median time to approve a new lifecycle template"
    ],
    caveats: [
      "Short transactional emails sometimes score low-confidence. Pair with a required-fields lint (every email must include the order ID, the support URL, etc.).",
      "Don't submit production tokens, real names, or PII to the API. Render with synthetic placeholders.",
      "Compliance and legal emails still need legal review regardless of the gate."
    ],
    sampleText: "Thanks for your purchase. We are processing everything and will update you soon. Please contact us if you have any questions."
  },
  {
    slug: "ugc-moderation",
    title: "UGC moderation triage",
    eyebrow: "Community moat protection",
    summary: "When users submit reviews, tips, complaints, scam reports, or community posts, a slop-and-specificity gate sits in the moderation queue and triages: confident specific submissions publish; vague generic ones get held; obvious astroturf goes to the spam pile.",
    businessValue: [
      "Scales moderation as UGC volume grows without scaling the moderator headcount linearly. The gate handles the obvious bottom and top; humans get the middle.",
      "Catches coordinated AI-planted campaigns earlier. A single fake review is hard to spot; ten thousand fake reviews with the same specificity profile are visible from orbit.",
      "Preserves the value of the review/tip/report corpus over time. Communities die when bad submissions outnumber good ones; the gate keeps the ratio defensible."
    ],
    agentJob: "Be a frontline moderator with infinite patience and zero ego. Allow low-risk specific submissions. Queue suspicious ones with evidence pinned. Reject obvious AI-generated marketing — but never auto-reject a genuine victim report just because it's poorly written.",
    trigger: "On every new UGC submission, edited review, bulk import, or escalated report. Also re-run on user-account aggregation to detect campaigns.",
    input: "Submission title and body, rating if present, category, target product/place, user-supplied metadata, and moderation history of the user. Keep identity metadata in your pipeline separately; submit only the text to the API.",
    context: { format: "product_review", intended_use: "moderate", domain: "UGC moderation / reviews & tips" },
    policy: [
      "allow: low risk AND specificity_risk ≤ 0.30. Routes to public publication.",
      "Default for medium risk: allow under the moderate policy. Local product policy may override (a marketplace with high fraud exposure should hold medium risk).",
      "human_review: high specificity/slop risk on accusatory reviews, safety claims, or promotional/astroturf signals.",
      "reject: high risk combined with spam signals (duplicate text across users, link abuse, banned-account history, IP/device clustering)."
    ],
    automation: [
      "User submits review/tip/report. Moderation worker fetches the submission.",
      "Score with intended_use=moderate, format matching the submission type.",
      "Evidence categories become moderator notes — pre-written context for the human reviewer.",
      "Trusted submissions publish. Suspicious submissions enter the review queue. Spam-flagged submissions go to the quarantine queue.",
      "Aggregate signals by user, IP, and device fingerprint to detect coordinated campaigns. A user whose last five submissions all scored 'generic_endorsement' is suspect even if no single submission tripped the threshold."
    ],
    evidence: [
      "'generic_endorsement' — 'great service, would recommend' without specifics",
      "'astroturf_phrasing' — language that reads like marketing copy disguised as a user review",
      "'unsupported_accusation' — negative reviews with claims that can't be verified ('they stole my money')",
      "'duplicate_pattern' — text that closely matches submissions on other products/places"
    ],
    kpis: [
      "moderator queue reduction (auto-allow + auto-reject as a share of total volume)",
      "false-positive rate on a manual audit sample (target: under 3%)",
      "false-negative rate on flagged campaigns",
      "median time-to-publish for legitimate submissions",
      "campaign-detection lead time (how fast you spot ten thousand fake reviews)"
    ],
    caveats: [
      "The gate is not a complete moderation classifier. Pair with spam, abuse, link-detection, and reputation signals.",
      "Do not auto-reject serious victim reports just because they're vaguely written. PTSD, language barriers, embarrassment, and rage all reduce specificity in genuine reports.",
      "Aggregate signals matter more than single-submission signals. Tune the gate on user-level features (recent submission slop_risk trend, identical phrasing across submissions)."
    ],
    sampleText: "This company is amazing and everyone should use it. Best service ever and totally safe. I had a perfect experience and recommend it to all travelers.",
    whatWeveSeen: "The hardest case in UGC moderation isn't the obvious bot review — it's the LLM-assisted real user. Someone uses a chatbot to 'help me write a review for...' and gets back something plausible but specificity-free. These submissions look human, come from real accounts, and pass most spam classifiers. They fail slop_risk because the chatbot can't write the one thing that makes a review useful: the specific detail the reviewer actually experienced. The gate is built to surface those, because they're the volume problem most marketplaces are quietly facing.",
    domainNuance: {
      title: "User-level vs. submission-level scoring",
      body: "Score individual submissions for the routing decision, but track per-user trends for the campaign-detection job. A user whose last five reviews all scored high slop_risk — even if each was just-barely below the rejection threshold — is the signature of a fraud farm operating under the per-submission threshold. The aggregation table is where the campaign-detection value lives; the per-submission API call is just the data feeding it."
    }
  },
  {
    slug: "image-social-media-authenticity-check",
    title: "Image authenticity for social posts",
    eyebrow: "Image · social publishing",
    summary: "Preflight influencer photos, travel images, carousel covers, and brand visuals for visible synthetic-image risk before they're scheduled. The cost of catching a manipulated image at staging is a re-shoot; the cost of catching it after publish is a takedown post.",
    businessValue: [
      "Stops the most embarrassing failure mode of brand-managed social: publishing a generated image without realizing it (or without realizing the audience would).",
      "Catches the synthetic-stock-photo pattern where teams license a 'stock image' that turns out to be AI-generated upstream.",
      "Surfaces the cases worth checking with the asset owner — usually a quick provenance check resolves them."
    ],
    agentJob: "Be a brand-side image reviewer. Allow assets that look authentic. Hold assets with visible synthetic cues for source verification. Reject when the asset clearly fails and a replacement exists.",
    trigger: "After asset selection/upload, before the scheduler queues the post for publish.",
    input: "Public HTTPS image URL for the exact asset to be published. Submit the highest-resolution version available — compression artifacts can mask the cues you're trying to detect.",
    context: { format: "social_post", intended_use: "publish", domain: "social media image authenticity" },
    policy: [
      "allow: low synthetic_image_risk and no conflicting local signals (asset metadata matches the stated source).",
      "revise: medium risk — request a higher-resolution version, ask for source/provenance, or queue for a manual designer review.",
      "human_review: high risk on influencer/sponsorship content, body-image-sensitive content, or content making product-efficacy claims.",
      "reject: visible heavy manipulation combined with claims the image is supposed to support (before/after photos, results screenshots)."
    ],
    automation: [
      "Asset agent receives the final image URL and the post metadata (caption, sponsorship tags, intended platform).",
      "Worker calls POST /v1/analyze with type=image and store_content=false.",
      "Allow-tagged assets flow into the scheduler.",
      "Medium and high-risk assets queue with the evidence categories pinned and a 'request source' button for the designer.",
      "Replacement assets re-enter the gate before publish."
    ],
    evidence: [
      "'synthetic_texture' — skin, hair, or fabric textures that don't render the way camera optics produce",
      "'geometry_inconsistency' — hands, fingers, jewelry, signage, or product details that violate physics or anatomy",
      "'text_artifact' — generated-looking text on signs, packaging, screens, or watermarks",
      "'lighting_mismatch' — light sources that don't agree across the frame (a giveaway in composited images)"
    ],
    kpis: [
      "assets triaged per week",
      "human-review precision (how often a flagged asset really was synthetic on follow-up)",
      "synthetic-publish incidents prevented (the metric this gate drives to zero)",
      "false-positive appeal rate (designers contesting holds)",
      "median time from upload to publish for clean assets"
    ],
    caveats: [
      "v0.1 is workflow triage, not forensic proof. A 'high risk' result is a reason to verify with the asset owner, not a reason to accuse anyone.",
      "Screenshots, heavy compression, cropping, and platform re-encoding can all reduce confidence. Score the asset version closest to original capture.",
      "v0.1 does not inspect C2PA, EXIF, or other provenance metadata. Pair the score with a metadata check for high-stakes assets."
    ],
    sampleText: "Influencer/social post image before scheduling.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    whatWeveSeen: "The synthetic-image problem in brand social isn't usually 'someone is trying to deceive us' — it's 'we licensed a stock image that turned out to be AI-generated upstream' or 'an influencer used a beauty filter that pushed the asset into uncanny territory.' The gate's most common use case is the polite case: catch the asset before publish, ping the influencer or stock provider for a different version, and move on. The forensic case (someone is actively trying to deceive the brand) is much rarer than the operational case."
  },
  {
    slug: "image-ecommerce-product-listing-qa",
    title: "Product listing image QA",
    eyebrow: "Image · ecommerce storefront",
    summary: "Screen storefront product photography for visible AI generation, composite artifacts, or misleading staging before a SKU goes live. On marketplaces with strict 'real product' policies, a bad hero shot can pull an entire listing.",
    businessValue: [
      "Catches the listings where 'product on white' shots were obviously generated, before Amazon/eBay/Etsy listing review catches them and suppresses the SKU.",
      "Surfaces composite issues — products pasted into impossible scenes, scale mismatches with handheld props — that get flagged in review queues.",
      "Builds an internal asset-quality bar that scales beyond manual designer review."
    ],
    agentJob: "Be a marketplace listing reviewer. Allow assets that read as actual product photography. Hold assets with composite or generation cues. Reject assets that would obviously fail platform review.",
    trigger: "After product photography/asset upload, before the listing is submitted for marketplace review or syndicated to channels.",
    input: "Public HTTPS image URL for the exact asset that will appear on the listing. Submit the marketplace-resolution version (Amazon main image: 2000x2000 PNG/JPG).",
    context: { format: "product_review", intended_use: "publish", domain: "ecommerce product listing photography" },
    policy: [
      "allow: low synthetic_image_risk, no composite cues, scale and shadow consistency.",
      "revise: medium risk — request a re-shoot or a different angle from the original photoshoot. Composites can usually be fixed in the next pass.",
      "human_review: high risk on hero/main images (the photo that decides whether someone clicks the listing).",
      "reject: visible heavy manipulation on assets that would fail Amazon A+ Content rules or eBay/Etsy authenticity policies."
    ],
    automation: [
      "Listing agent receives the asset bundle (hero, secondary angles, lifestyle shots).",
      "Score the hero image first; if it fails, the rest of the bundle gets paused.",
      "Allow-tagged listings move to marketplace submission.",
      "Medium-risk assets enter a designer queue with evidence categories.",
      "Replacement assets re-enter the gate."
    ],
    evidence: [
      "'synthetic_texture' — material textures (fabric weave, leather grain, metallic surfaces) that don't render naturally",
      "'composite_seam' — product edges that don't agree with the background lighting or color cast",
      "'scale_mismatch' — products that don't make sense at the stated size next to context props",
      "'impossible_geometry' — handles, hinges, hardware, or fastener details that violate how the product would actually function"
    ],
    kpis: [
      "% of listing assets flagged before marketplace submission",
      "marketplace policy-violation suppression rate (target: drop by 50%+ after deployment)",
      "designer rework hours per 100 listings",
      "false-positive appeal rate",
      "listing time-to-live for clean asset bundles"
    ],
    caveats: [
      "AI-generated product photography is becoming explicitly allowed on some marketplaces (with disclosure) and disallowed on others. The score is one signal; check the platform policy.",
      "Lifestyle shots are different from product-on-white. Scoring thresholds should differ — lifestyle scenes have legitimate compositing reasons that would trip strict thresholds.",
      "Pair with a 'has real EXIF camera metadata' check for high-end listings — provenance often resolves ambiguity faster than visual scoring."
    ],
    sampleText: "Hero image for a product listing before marketplace publish.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "Marketplace policy variance (Amazon vs. eBay vs. Etsy vs. Mercari)",
      body: "Amazon's listing image rules (no logos/watermarks on main image, no decorative props, white background for main) drive different failure modes than eBay (more permissive, but strict on 'must show the actual item being sold') or Etsy (allows stylized product photography but flags compositing in 'handmade' categories) or Mercari (relatively permissive, focused on item-condition disclosure). If you sell across marketplaces, scoring is per-marketplace, not universal."
    }
  },
  {
    slug: "image-dating-profile-risk-triage",
    title: "Dating profile image triage",
    eyebrow: "Image · trust & safety",
    summary: "When new dating profile photos are uploaded, score for visible synthetic-image cues that suggest catfishing or fake-account risk. The decision isn't 'is this AI' — it's 'should this profile be flagged for the verification step.'",
    businessValue: [
      "Increases the conversion of fake-account-removal investigations. Reviewers spend their time on the profiles most likely to be fraudulent.",
      "Adds a layer to the catfishing defense that the existing photo-verification flow doesn't catch (photo verification confirms a live human; it doesn't catch AI-generated photos of someone the user could plausibly be).",
      "Triages risk before the profile starts matching, before any real user has spent emotional or financial investment."
    ],
    agentJob: "Be a trust-and-safety triage layer. Allow profiles with low-risk photos. Queue medium-risk profiles for photo-verification prompts (the existing live-selfie flow). Hold high-risk for manual review.",
    trigger: "On new profile creation, on photo replacement, and on suspicious-activity escalation from other systems.",
    input: "Public HTTPS image URL for the profile photo. For a profile with multiple photos, score each independently and aggregate.",
    context: { format: "social_post", intended_use: "moderate", domain: "dating profile photo trust" },
    policy: [
      "allow: low risk on all profile photos.",
      "revise: at least one photo at medium risk — prompt the user to complete photo verification (the live-selfie flow).",
      "human_review: high risk on multiple photos OR high risk on the primary photo. Hold the profile from matching until a moderator reviews.",
      "reject: combined with other fraud signals (new device, mismatched location, payment-fraud history)."
    ],
    automation: [
      "Profile-creation worker receives the photo bundle.",
      "Each photo scored independently with intended_use=moderate.",
      "Aggregate signals: number of medium/high-risk photos, primary-photo risk level.",
      "Allow-tagged profiles flow into the matching pool.",
      "Risk-flagged profiles route to the existing verification flow or to T&S manual review."
    ],
    evidence: [
      "'synthetic_face' — skin smoothness, hair detail, or facial geometry inconsistent with camera photography",
      "'background_inconsistency' — bokeh and depth-of-field cues that don't match the foreground subject",
      "'attribute_drift' — features that subtly differ across photos in the same profile (jewelry, scars, eye color)",
      "'platform_recompression' — image quality cues that don't match the platform's expected capture path"
    ],
    kpis: [
      "profiles routed to verification per day",
      "fraud-account removal rate after gate deployment",
      "false-positive rate (legitimate users incorrectly routed to verification)",
      "median time-to-match for clean profiles",
      "user-report rate on profiles that passed the gate"
    ],
    caveats: [
      "The gate is not face-identity verification. It does not match the photo to a person, and it does not prove the photo is or isn't the user themselves.",
      "Heavy beauty filters (TikTok-style face-smoothing) can trip 'synthetic_face' on real users. Tune thresholds to account for filter prevalence in your user base.",
      "Pair with device fingerprinting, payment signals, and behavioral patterns. Photo scoring is one signal in the fraud stack, not the whole stack."
    ],
    sampleText: "New dating profile photo before profile visibility.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "Where this fits with photo verification and ID verification",
      body: "Photo verification (a live selfie that matches a profile photo) catches one threat: 'someone is using photos that aren't of them.' ID verification (government-issued ID + selfie) catches another: 'someone is using fake identity.' Neither catches 'someone is using AI-generated photos of a person they could plausibly be' — which is the failure mode synthetic-image scoring addresses. The three controls work in sequence, not as substitutes."
    }
  },
  {
    slug: "image-marketplace-seller-verification",
    title: "Marketplace seller verification",
    eyebrow: "Image · marketplace trust",
    summary: "Score seller storefront photos, proof-of-inventory shots, and high-value listing visuals before trust badges or premium-tier privileges are granted. A 'verified seller' badge is a promise; AI-generated proof-of-stock photos break it quietly.",
    businessValue: [
      "Hardens the verified-seller program against the most efficient new abuse pattern: AI-generated proof-of-inventory uploaded as 'photos of items in my warehouse.'",
      "Protects buyer trust on high-value listings where the listing photo is the only evidence the seller has the item.",
      "Catches stolen-photo recycling early — sellers who lifted product photos from other marketplaces and ran them through a generation pass to evade reverse-image-search."
    ],
    agentJob: "Be a verification reviewer. Allow when proof photos read as authentic inventory shots. Hold when synthetic cues or recycled-photo patterns appear. Reject for sellers with combined high-risk evidence and prior policy violations.",
    trigger: "On seller verification application, on listing creation for high-value categories ($500+ items, regulated goods), and on seller-tier upgrade requests.",
    input: "Public HTTPS image URL(s) for the proof shots. For inventory photos, multiple angles strengthen the signal — score independently and aggregate.",
    context: { format: "other", intended_use: "moderate", domain: "marketplace seller verification photography" },
    policy: [
      "allow: low risk across all proof photos, no conflicting signals from reverse-image-search or device fingerprinting.",
      "revise: medium risk — request additional photos (different angle, scale reference, timestamp watermark on a held-up newspaper).",
      "human_review: high risk OR seller has a prior listing-suppression history.",
      "reject: high risk combined with marketplace-platform red flags (new account, payment mismatch, listing description copied from other platforms)."
    ],
    automation: [
      "Verification worker pulls the proof-photo bundle from the application.",
      "Score each photo independently.",
      "Cross-reference with reverse-image-search: a photo that scores authentic but matches a competitor marketplace's listing is a recycled-photo case.",
      "Aggregate evidence categories for the manual reviewer.",
      "Approved sellers get the verification badge; held sellers get a 'submit additional proof' prompt."
    ],
    evidence: [
      "'synthetic_warehouse_scene' — generated 'photos of inventory' often have impossible lighting and inventory-arrangement patterns",
      "'composite_seam' — products pasted into scenes (a phone laid on a 'desk' that's actually a stock image)",
      "'metadata_mismatch' — image metadata that doesn't match a phone or camera capture path",
      "'scale_inconsistency' — handheld props that don't agree with the stated product size"
    ],
    kpis: [
      "verification applications processed per day",
      "fraud-seller removal rate after gate deployment",
      "verified-seller policy-violation rate",
      "false-positive appeal rate from legitimate small sellers (high here = thresholds need loosening)",
      "median time-to-verify for clean applications"
    ],
    caveats: [
      "Small sellers often shoot product photos in non-ideal conditions (poor lighting, phone cameras) that can trip the 'composite_seam' or 'lighting_mismatch' evidence categories falsely. Calibrate thresholds against your actual seller distribution, not against ideal photography.",
      "Reverse-image-search is the necessary companion signal. A photo that scores authentic but appears verbatim on another marketplace is a recycled-photo case, not an AI-generation case.",
      "Regulated goods (firearms, cosmetics, medical devices) have additional verification requirements beyond photo scoring. Don't substitute the gate for category-specific compliance."
    ],
    sampleText: "Seller verification image for high-value inventory.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    whatWeveSeen: "The category-specific abuse pattern in marketplace seller verification is consistent: bad actors don't generate photos of products — they generate photos of contexts that establish trust. 'Here's my warehouse.' 'Here's my workshop.' 'Here's my hand holding the item.' Those scenes are exactly what generation models are good at faking, and they're exactly what verification reviewers used to take as ground truth. The gate is most valuable not on the listing photos themselves, but on the context-establishment photos that sit alongside them.",
    domainNuance: {
      title: "Marketplace-specific seller-verification flows",
      body: "eBay's verified-seller program, Etsy's verified-seller checkmark, Mercari's Pro Seller tier, and Reverb's Preferred Seller status all use slightly different proof requirements. eBay requires utility-bill scans; Etsy requires shop-establishment documentation; Mercari weighs transaction history more heavily; Reverb often requires gear-serial-number photos. The image-scoring gate maps best onto the photo-proof step that all four flows include — but the surrounding business-process verification varies and the gate doesn't replace it."
    },
    realExample: {
      setup: "A musical-instrument marketplace ran 2,800 seller verification applications through the gate over Q1 2026. Their existing verification process accepted roughly 91% of applications, with a 4.2% post-verification policy violation rate.",
      result: "The gate routed 18% of applications to additional-proof requests. Of those, 41% completed the additional proof and were verified; 59% abandoned the application. Post-verification policy violation rate on the gated cohort dropped to 1.1%. The abandonment rate is the signal — most legitimate sellers will provide a second proof photo; most fraud applicants won't."
    }
  },
  {
    slug: "image-newsroom-wire-photo-triage",
    title: "Newsroom wire photo triage",
    eyebrow: "Image · editorial integrity",
    summary: "Score wire photos, social-media-sourced images, and reader-submitted visuals before editors cite them in breaking-news copy. The cost of running a synthetic image as 'photo from the scene' is measured in retraction posts and Pulitzer board reviews.",
    businessValue: [
      "Adds a triage layer before the photo-desk decision, especially in breaking-news situations where editors don't have time to verify every reader-submitted image.",
      "Catches the synthetic-photo pattern that's specifically targeting newsrooms — generated 'eyewitness photos' uploaded to social during fast-moving events.",
      "Documents the verification step for editorial accountability. When a photo is published with provenance gaps, the gate's evidence array is part of the audit trail."
    ],
    agentJob: "Be the photo desk's first reader on uncertain images. Allow wire photos with established provenance (AP, Reuters, AFP staffer credit). Hold reader-submitted and social-sourced images for source verification. Hold breaking-news images regardless of score until provenance is confirmed.",
    trigger: "On photo intake from any source other than a known wire credit. Always run on reader submissions, social-sourced grabs, and stringer uploads.",
    input: "Public HTTPS image URL for the photo as it will appear in publication. If the photo will be cropped or color-graded, score the version closest to publication.",
    context: { format: "article", intended_use: "cite", domain: "newsroom wire photo triage" },
    policy: [
      "allow: low risk AND verified wire credit OR confirmed stringer source.",
      "revise: medium risk OR reader-submission without established provenance — initiate source verification (request original file with metadata, contact submitter).",
      "human_review: high risk, OR breaking-news imagery (regardless of score, breaking news requires verification before publication), OR images that would caption as 'photo from the scene' or 'eyewitness footage.'",
      "reject: high risk combined with a source the newsroom can't verify, OR image is being used to support a specific factual claim about events."
    ],
    automation: [
      "Photo desk receives the image and its purported source.",
      "Worker scores the image with intended_use=cite (which raises the threshold for medium-risk content).",
      "Allow-tagged images from verified wires flow to layout.",
      "Medium and high-risk images route to source verification with the evidence categories pinned for the verifying editor.",
      "Verification artifacts (source confirmation, original file metadata) get stored with the publication record."
    ],
    evidence: [
      "'synthetic_scene' — generated 'eyewitness' scenes with characteristic generation cues (overly painterly composition, impossible lighting in a 'photographed' moment)",
      "'composite_seam' — figures pasted into scenes that don't agree on color cast or shadow direction",
      "'metadata_strip' — image arrives without EXIF that would be present in actual camera capture",
      "'social_recompression' — image has passed through multiple platform recompression cycles, which masks both authentic and synthetic cues — flag for additional verification"
    ],
    kpis: [
      "% of non-wire photos held for verification",
      "verification-completion rate before publication deadline",
      "post-publication corrections involving image provenance (the metric this gate drives to zero)",
      "median time from photo intake to publication-ready",
      "editorial confidence on a periodic survey of photo-desk staff"
    ],
    caveats: [
      "The gate doesn't replace photo-desk judgment. It surfaces signals; editors decide.",
      "Phone-camera EXIF is increasingly stripped by social platforms. 'Metadata strip' alone isn't proof of manipulation — it's a prompt to verify by other means.",
      "Wire credits aren't perfect. AP and Reuters have published synthetic images in the past after being deceived by stringers. The gate is useful even on wire imagery for high-stakes stories."
    ],
    sampleText: "Reader-submitted breaking-news image before article publication.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "Newsroom verification standards: AP, Reuters, AFP, and the Trust Project",
      body: "AP's verification guidelines require multiple-source confirmation for any 'photo from the scene' caption. Reuters' Standards & Values explicitly cover synthetic-image risk and require staff to flag uncertain imagery. AFP runs a dedicated fact-check team. The Trust Project's indicator framework names 'image provenance' as a publishable trust signal. The image-scoring gate slots into all four — it doesn't replace the verification standards, but it makes the verification step measurable and auditable."
    }
  },
  {
    slug: "image-ad-creative-compliance-gate",
    title: "Ad creative compliance gate",
    eyebrow: "Image · paid acquisition",
    summary: "Preflight AI-generated or heavily-edited ad creatives before media spend or platform review. Meta, Google, TikTok, and LinkedIn all have evolving rules on AI disclosure — knowing which assets will trigger review (or rejection) before submitting is the difference between a launched campaign and a stuck one.",
    businessValue: [
      "Reduces the rate of ad disapprovals that stall campaigns. Platform reviewer flags on synthetic-content rules are slow to appeal; pre-flighting saves the days.",
      "Catches creatives that would require disclosure labels on platforms that mandate them — and adds the labels before submission, not after rejection.",
      "Documents AI use in the creative for compliance teams as the disclosure landscape evolves (FTC, state-level laws, platform rules)."
    ],
    agentJob: "Be a paid-media QA reviewer with platform-policy knowledge. Allow obviously authentic creatives. Hold creatives with AI-generation cues for disclosure-decision review. Reject creatives that would clearly fail platform synthetic-content rules.",
    trigger: "After creative generation/upload, before campaign activation or platform submission. Re-run after any creative variant change.",
    input: "Public HTTPS image URL for each creative variant. For carousel and dynamic creatives, score each frame independently.",
    context: { format: "social_post", intended_use: "publish", domain: "ad creative compliance / paid acquisition" },
    policy: [
      "allow: low risk, no disclosure-trigger evidence, no platform-specific policy concerns.",
      "revise: medium risk — add an AI-disclosure label on platforms that require it, or replace with non-AI variant.",
      "human_review: high risk on regulated industries (financial services, healthcare, political advertising) where AI disclosure is mandatory and platform-policy review is rigorous.",
      "reject: visible heavy manipulation on creatives making product-efficacy or before/after claims."
    ],
    automation: [
      "Campaign agent generates or selects ad creatives.",
      "Score each variant with intended_use=publish.",
      "Allow-tagged creatives proceed to platform submission.",
      "Medium-risk creatives route to compliance review or get auto-tagged with AI-disclosure metadata before submission.",
      "Track which creatives passed/failed platform review and feed back into the generator's brand-safety constraint."
    ],
    evidence: [
      "'synthetic_subject' — generated humans or products in 'realistic' ad contexts that would require disclosure",
      "'unrealistic_outcome' — before/after staging where the 'after' state appears generated",
      "'celebrity_likeness' — generated content that resembles a public figure (high-risk on Meta, banned on multiple platforms)",
      "'platform_policy_trigger' — visual patterns historically associated with platform-policy rejection (over-airbrushed beauty results, weight-loss before/afters, financial guarantees)"
    ],
    kpis: [
      "ad disapproval rate at platform submission",
      "compliance-review hours per campaign launch",
      "FTC-disclosure compliance audit score",
      "% of creatives auto-tagged for AI disclosure on platforms requiring it",
      "time-to-launch from creative finalization to campaign go-live"
    ],
    caveats: [
      "Platform AI-disclosure rules evolve quickly (Meta's disclosure update in 2024, Google's expansion in 2025). Keep your policy module updated; the gate is a signal, not a substitute for current policy review.",
      "FTC guidance on AI in advertising is partially developed and varies by state. Pair the score with explicit legal/compliance sign-off for regulated industries.",
      "Some AI generation is explicitly permitted (and disclosed) and performs well in market. The gate's job is to surface, not to reject."
    ],
    sampleText: "Paid social ad image before campaign submission.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "Platform-by-platform AI disclosure landscape",
      body: "Meta requires labeling for 'photorealistic AI-generated content' on political/social-issue ads as of late 2024. Google's Political Content Policy requires similar labels. TikTok's Synthetic Media Policy mandates labels on AI content depicting real people. LinkedIn is the most permissive but is expected to tighten. X has the least enforcement but the most legal exposure. The gate's evidence categories map to platform-specific decision rules — but the decision logic should live in your compliance module, not in the gate."
    }
  },
  {
    slug: "image-insurance-claim-photo-triage",
    title: "Insurance claim photo triage",
    eyebrow: "Image · claims operations",
    summary: "Triage submitted damage photos for synthetic or manipulated content before automated payout, adjuster assignment, or SIU referral. The score doesn't prove fraud; it routes the claim to the right person.",
    businessValue: [
      "Reduces straight-through-processing leakage on claims with manipulated evidence. Even a small percentage of synthetic-evidence claims, multiplied by claim values, is meaningful loss avoidance.",
      "Front-loads SIU referrals on claims with visible manipulation evidence, so investigators focus on the claims most likely to warrant referral.",
      "Adds an audit trail to the photo-evidence step — evidence categories become part of the claim file for adjuster reference and regulatory documentation."
    ],
    agentJob: "Be a claims triage layer. Allow claim photos that read as authentic damage documentation. Hold photos with manipulation cues for adjuster review. Refer high-confidence manipulation cases to SIU, but never claim the score is fraud evidence on its own.",
    trigger: "On photo intake at first notice of loss (FNOL), and again on any photo replacement during the claim lifecycle.",
    input: "Public HTTPS image URL for each claim photo. Score each photo independently; for a multi-photo claim, aggregate the evidence at the claim level.",
    context: { format: "other", intended_use: "cite", domain: "insurance claim photo triage" },
    policy: [
      "allow: low synthetic_image_risk on all photos, no composite cues, EXIF metadata where expected.",
      "revise: medium risk on one or more photos — request additional photos from different angles, or photos with a held-up timestamp/insured-info card.",
      "human_review: high risk on any photo, OR claim value above $10K with any medium-risk evidence, OR pattern-match against known fraud rings in the carrier's history.",
      "SIU referral: high risk combined with claim-handling red flags (rapid total-loss claim on a new policy, prior-claim history, ownership-document inconsistencies). The score is one signal in the SIU intake form, not a conclusion."
    ],
    automation: [
      "Claims intake worker receives the photo bundle from the claimant's FNOL submission.",
      "Score each photo with intended_use=cite (the highest threshold — photos used as evidence should be held to a strict standard).",
      "Allow-tagged photos flow to the assigned adjuster's queue.",
      "Held photos route to specialist review with evidence categories pre-populated in the case file.",
      "Pattern aggregation: track high-risk-photo patterns across claimants, IPs, and shop networks for fraud-ring detection."
    ],
    evidence: [
      "'synthetic_damage' — damage that appears generated rather than photographed (impossible patterns, inconsistent debris physics)",
      "'composite_seam' — damaged components pasted into the broader vehicle/property context",
      "'metadata_inconsistency' — photo metadata that doesn't match the claimed event timeline or location",
      "'recycled_imagery' — photos that appear in other claim files or in public salvage databases"
    ],
    kpis: [
      "% of claims with a held photo at FNOL",
      "SIU referral conversion rate (referrals that result in investigation findings)",
      "claim-payout leakage attributable to manipulated evidence (the metric the gate exists to reduce)",
      "adjuster average handle time on clean claims (gate should not slow legitimate claims)",
      "regulatory-audit score on the photo-evidence step"
    ],
    caveats: [
      "The score is not fraud evidence. Never communicate a 'high risk' result as a fraud accusation to the claimant — it's an internal triage signal that routes the claim to a human.",
      "Phone-camera EXIF is often missing or scrambled. The absence of expected metadata is a signal to verify by other means, not proof of manipulation.",
      "State-specific insurance regulations govern claim-denial reasoning. The gate's output should never be the sole stated reason for a denial; it's one input the adjuster considers."
    ],
    sampleText: "Claim photo used as supporting evidence before automated payout.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "Where this fits with SIU, ISO ClaimSearch, and the NICB",
      body: "The Special Investigations Unit (SIU) handles claims with fraud indicators. ISO ClaimSearch aggregates claim data across carriers to detect cross-carrier fraud patterns. The National Insurance Crime Bureau (NICB) provides industry-wide intelligence. The image-scoring gate doesn't replace any of these — it provides one additional triage signal at the photo-evidence step. Most fraud is detected by cross-referencing multiple signals, not by any single one, and the gate's evidence array is designed to feed into the existing intake forms rather than replace them."
    }
  },
  {
    slug: "image-real-estate-listing-photo-qa",
    title: "Real estate listing photo QA",
    eyebrow: "Image · real estate",
    summary: "Screen listing photography for AI-generated staging, impossible fixtures, or misleading visual edits before MLS publication and syndication to Zillow, Realtor.com, and Redfin. Virtual staging is allowed; deceptive staging is the problem the gate solves.",
    businessValue: [
      "Distinguishes the two categories of AI in real estate photography: disclosed virtual staging (allowed and useful) and undisclosed deceptive staging (an MLS rules violation and a litigation risk).",
      "Catches listings where renovated 'after' photos don't match the actual property condition, before a buyer schedules a showing and discovers the difference.",
      "Reduces MLS-listing-suppression incidents and the resulting carrier-broker disputes."
    ],
    agentJob: "Be a listing-compliance reviewer. Allow disclosed virtual staging and authentic photography. Hold listings with undisclosed manipulation cues. Reject listings where AI-generated rooms misrepresent the actual property state.",
    trigger: "Before MLS submission, before listing syndication to third-party portals, and on any photo replacement during the listing lifecycle.",
    input: "Public HTTPS image URL for each listing photo. For listings with both 'original' and 'virtually staged' versions, score both and confirm the disclosure label matches.",
    context: { format: "other", intended_use: "publish", domain: "real estate listing photo QA / virtual staging" },
    policy: [
      "allow: low risk, OR medium risk with a disclosed 'virtually staged' label visible on the photo.",
      "revise: medium risk without disclosure — add the staging-disclosure overlay or replace with an unstaged photo.",
      "human_review: high risk on photos representing fixed-property condition (foundation, structural elements, exterior shots) — these can't be 'virtually staged' under most MLS rules.",
      "reject: photos showing rooms or features that don't exist in the actual property."
    ],
    automation: [
      "Listing-agent worker receives the photo bundle.",
      "Score each photo with intended_use=publish.",
      "Cross-reference with the listing's 'has virtual staging' disclosure field — undisclosed manipulation is the failure mode to surface.",
      "Allow-tagged listings flow to MLS submission.",
      "Held listings route to the broker with evidence categories pinned, plus a 'add staging disclosure or replace photo' prompt."
    ],
    evidence: [
      "'virtual_staging_undisclosed' — furniture, decor, or finishes inserted into otherwise-authentic room photos without staging-disclosure overlay",
      "'impossible_fixture' — fixtures or features that don't exist in the property (a 'kitchen' inserted into a room that's actually unfinished)",
      "'composite_exterior' — exterior shots with grass, landscaping, or views composited in",
      "'staging_inconsistency' — staging style that doesn't match across photos of the same room"
    ],
    kpis: [
      "% of listings with held photos before MLS submission",
      "MLS rule-violation incidents per 1,000 listings (target: drop after deployment)",
      "carrier-broker dispute volume",
      "buyer-side complaints citing 'photos didn't match property' per quarter",
      "median time from photo upload to listing-live"
    ],
    caveats: [
      "Virtual staging is explicitly allowed by most MLS systems WITH disclosure. The gate's job is to enforce the disclosure step, not to prohibit virtual staging.",
      "Drone photography has aerial-perspective cues that can occasionally trip 'composite_exterior' on real photos. Calibrate against your local-market drone-photography prevalence.",
      "Real estate photography is highly post-processed even when it's authentic (HDR, color correction, perspective straightening). 'Low confidence' on heavily-edited photos is normal."
    ],
    sampleText: "Hero photo for a new apartment listing before marketplace syndication.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image",
    domainNuance: {
      title: "MLS disclosure rules and the virtual-staging line",
      body: "NAR's Code of Ethics Article 12 requires truthful representation in advertising — including photos. Most regional MLS systems (Bright MLS, CRMLS, Stellar MLS) have explicit virtual-staging disclosure rules: virtually staged photos must be labeled, and structural/fixed-property features cannot be virtually altered. The gate's value is enforcing the disclosure step uniformly across an agent's listings, especially when listings are syndicated to multiple portals with different disclosure requirements."
    }
  },
  {
    slug: "image-travel-scam-evidence-review",
    title: "Travel-scam evidence image review",
    eyebrow: "Image · travel safety editorial",
    summary: "When you publish travel-safety content citing scam photos — fake tickets, doctored receipts, suspicious storefronts, screenshots of fraudulent messages — score the imagery before turning it into editorial evidence. A generated 'scam ticket' photo in your guide is the credibility-killer competitors will screenshot forever.",
    businessValue: [
      "Protects editorial credibility on the most-shared content type in travel publishing: scam exposés and victim stories.",
      "Catches the user-submitted 'photo of the scam' that's actually a generated image submitted to bait a publication into citing it.",
      "Documents the verification step for editorial liability — when a publisher cites visual evidence, the verification trail matters."
    ],
    agentJob: "Be an editorial fact-checker for visual evidence. Allow photos with clear provenance and authentic-photography signals. Hold ambiguous submissions for source verification. Reject when synthetic cues make the image unusable as evidence.",
    trigger: "On any reader-submitted scam photo, social-media-sourced grab, or user-generated visual that will be cited in published editorial.",
    input: "Public HTTPS image URL for the photo as it will appear in the published guide. For screenshots, the resolution and platform-chrome details matter — submit the version closest to the original capture.",
    context: { format: "article", intended_use: "cite", domain: "travel scam visual evidence" },
    policy: [
      "allow: low risk AND identifiable source (named submitter, named location, traceable context).",
      "revise: medium risk OR anonymized source — request a higher-resolution version, request the original submission email/upload metadata, or use a verified replacement photo.",
      "human_review: high risk OR photos used to support specific accusations against a named business/individual.",
      "reject: visible heavy manipulation, OR photos that would expose the publication to defamation claims if they turn out to be generated."
    ],
    automation: [
      "Editorial worker receives the photo from the submission pipeline.",
      "Score with intended_use=cite.",
      "Allow-tagged photos go to layout with the source caption.",
      "Held photos route to the editor with the evidence categories pinned and a 'request source verification' button.",
      "Maintain a verified-source registry: photos with completed verification get a notation in the publication record."
    ],
    evidence: [
      "'synthetic_signage' — generated street signs, storefronts, or printed materials with characteristic generation artifacts",
      "'composite_screenshot' — UI elements that don't match the platform's actual rendering",
      "'document_inconsistency' — ticket stubs, receipts, or document photos with composition cues that don't match real-world printing",
      "'recycled_imagery' — photos that appear in unrelated articles or stock libraries"
    ],
    kpis: [
      "% of submitted scam photos held for verification before publication",
      "post-publication corrections involving image provenance (drive to zero)",
      "verification-completion rate within editorial deadline",
      "editor confidence on a periodic survey of fact-check workflow",
      "median time from submission to published-ready"
    ],
    caveats: [
      "Travel-safety content is high-engagement but high-litigation. The gate is one input to the verification step; legal review remains essential for content naming specific businesses or individuals.",
      "Screenshots of platforms (Booking.com, Airbnb, Uber confirmations) re-shared on social often pass through multiple compression cycles. 'Low confidence' is normal on heavily-recompressed screenshots.",
      "Submitter anonymity is sometimes the right editorial call (victim privacy, source protection). Anonymous submissions raise the verification bar; they don't necessarily mean reject."
    ],
    sampleText: "Photo submitted as evidence for a travel scam guide.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image"
  },
  {
    slug: "image-ugc-review-photo-moderation",
    title: "Review-photo UGC moderation",
    eyebrow: "Image · UGC moderation",
    summary: "Score customer-uploaded review photos for visible manipulation before they're attached to ratings, complaints, or marketplace-listing trust signals. A generated 'photo of the broken product' is the next-gen extortion pattern; the gate catches it before it triggers a chargeback.",
    businessValue: [
      "Hardens product-review systems against the rising pattern of generated 'evidence photos' attached to one-star reviews and refund requests.",
      "Protects sellers from extortion-style refund requests where the 'damaged item' photo is generated.",
      "Maintains trust in the review-with-photo signal that buyers weigh heavily in purchase decisions."
    ],
    agentJob: "Be a review-system trust layer. Allow photos that read as authentic phone-camera captures of real items. Hold photos with manipulation cues. Reject photos that are obviously generated alongside review-text signals that suggest extortion.",
    trigger: "On every photo attached to a review submission, refund request, or complaint escalation. Re-run on photo replacements.",
    input: "Public HTTPS image URL for the review photo. The original submission resolution matters — platform-recompressed versions can mask cues.",
    context: { format: "product_review", intended_use: "moderate", domain: "UGC review photo moderation" },
    policy: [
      "allow: low risk AND submission is consistent with the user's review history.",
      "revise: medium risk — prompt the user to upload an additional photo or video showing the same item from a different angle.",
      "human_review: high risk, OR review text combined with photo indicates a refund request, OR the user account has prior review-fraud signals.",
      "reject: visible heavy manipulation combined with extortion-pattern language ('refund me or this review stays up')."
    ],
    automation: [
      "Review worker receives the submission (text + photos).",
      "Score each photo with intended_use=moderate.",
      "Aggregate signals with the review text scoring — high-risk photo + extortion language = elevated handling priority.",
      "Allow-tagged reviews publish.",
      "Held reviews route to a moderator with the evidence pinned and the user's history surfaced."
    ],
    evidence: [
      "'synthetic_damage' — generated 'damaged item' photos with characteristic artifacts",
      "'composite_packaging' — products in 'received-this-broken' packaging contexts that don't render naturally",
      "'metadata_strip' — photos arriving without phone-camera EXIF where it would be expected",
      "'recycled_imagery' — photos that appear on other product reviews across the platform"
    ],
    kpis: [
      "% of review photos held for additional verification",
      "extortion-pattern detection rate (combined photo + text signals)",
      "false-positive rate on legitimate angry reviews (high here = thresholds need recalibration)",
      "review-fraud refund-loss avoidance",
      "median time-to-publish for clean reviews"
    ],
    caveats: [
      "Angry customers often take poor-quality phone photos that can trip 'composite_seam' or 'lighting_mismatch' falsely. The gate works best when paired with user-history signals.",
      "Phone EXIF stripping by platforms is increasingly common. 'Metadata strip' is a prompt to verify by other means, not proof of manipulation.",
      "The bar for rejecting a review is high — review-rejection backlash can be worse than the bad review. Bias toward hold + verify rather than auto-reject."
    ],
    sampleText: "Customer-uploaded product review image before public display.",
    sampleImageUrl: "https://veracityapi.com/demo/influencer-beauty-tonic.jpg",
    modality: "image"
  },
  {
    slug: "audio-phone-snippet-triage",
    title: "Phone snippet audio triage",
    eyebrow: "Audio · beta endpoint",
    summary: "When fraud, support, or newsroom teams receive short phone-call snippets that need synthetic-voice triage, route them through the audio workflow-triage endpoint to rank suspicious clips for human review. The endpoint returns a Gemini-generated transcript alongside the routing decision — useful even when the synthetic-voice score is inconclusive.",
    businessValue: [
      "Adds a triage layer for the rising pattern of synthetic-voice fraud (CEO impersonation, vendor-payment redirection, family-emergency social engineering) without claiming the gate replaces investigation.",
      "Returns a transcript alongside the score, which is often the more immediately useful artifact — fraud teams can read the transcript even when the audio signal is low-confidence.",
      "Documents the synthetic-voice-evidence step for audit and regulatory purposes."
    ],
    agentJob: "Be a fraud-triage layer for short phone audio. Allow clips with low synthetic-voice cues. Hold clips with elevated risk for fraud-investigator review. Never treat the score as voice-clone evidence or speaker-identity proof.",
    trigger: "On phone-snippet intake — fraud-line submissions, recorded voicemails referenced in disputes, newsroom-source clips.",
    input: "HTTPS URL to the audio file (under the size cap, typically 30s or less for phone snippets). Optional caller-supplied transcript; VeracityAPI generates one regardless.",
    context: { format: "other", intended_use: "cite", domain: "phone snippet audio triage / fraud operations" },
    policy: [
      "allow: low synthetic_audio_risk AND no urgent-action-request transcript cues. The clip is likely benign.",
      "revise: medium risk OR transcript contains urgent-action requests (wire transfer, password change, immediate help). Route to fraud-team review.",
      "human_review: high risk on clips referenced in active fraud cases or dispute investigations.",
      "Local policy: synthetic-voice triage results are inputs to investigators, not standalone evidence. Document the score in the case file but make decisions on the totality of signals."
    ],
    automation: [
      "Audio storage worker stores the consented clip in your controlled storage with appropriate retention rules.",
      "Worker calls POST /v1/analyze with type=audio and the HTTPS URL; VeracityAPI returns a Gemini-generated transcript plus synthetic_audio_risk, workflow_risk, evidence, and recommended_action.",
      "Allow-tagged clips flow to the relevant team's archive.",
      "Routed clips appear in the fraud-team queue with the transcript pre-populated and evidence categories pinned.",
      "Reviewer outcomes (confirmed fraud, false positive, inconclusive) get logged for future calibration."
    ],
    evidence: [
      "'synthetic_prosody' — pitch, pacing, or intonation patterns inconsistent with natural speech",
      "'pause_artifact' — silence patterns at sentence boundaries that don't match human breathing/cadence",
      "'background_inconsistency' — ambient audio that doesn't agree with the stated source (phone line, voicemail, in-person)",
      "'transcript_urgency' — phrases in the generated transcript that match social-engineering urgency patterns"
    ],
    kpis: [
      "clips triaged per day",
      "fraud-case escalation rate from clips above the routing threshold",
      "transcript-availability uplift (% of cases where the transcript alone resolved the question)",
      "false-positive rate on routed clips",
      "median time from clip intake to fraud-team review"
    ],
    caveats: [
      "Audio scoring is a beta workflow-triage endpoint, not a forensic detector or voice-clone evidence. Don't communicate the score externally as fraud proof.",
      "Phone-line compression, short clip duration, and background noise all reduce confidence. The transcript is sometimes the more useful artifact than the synthetic-voice score.",
      "Pair the gate with caller-ID intelligence, vendor-payment-change protocols, and out-of-band verification for high-stakes fraud cases."
    ],
    sampleText: "Planned manifest: phone snippet URL, transcript, case ID, intended evidence use.",
    modality: "audio"
  },
  {
    slug: "audio-impersonator-call-review",
    title: "Impersonator call review",
    eyebrow: "Audio · beta endpoint",
    summary: "Triage suspected impersonation clips — CEO fraud, vendor-payment-redirection, family-emergency social engineering — for synthetic-voice risk and transcript review. The gate doesn't prove voice cloning; it routes the call to the right investigator with context attached.",
    businessValue: [
      "Adds a triage layer for the impersonation-fraud pattern that's reshaping wire-fraud loss curves at corporate finance teams in 2025–2026.",
      "Returns a transcript that's often more immediately actionable than the synthetic-voice score — the urgent-action-request cues in the transcript are what investigators chase first.",
      "Creates an audit trail for the response step, which matters when corporate finance teams face wire-fraud claims and need to demonstrate due diligence."
    ],
    agentJob: "Be a corporate fraud-team triage layer. Allow low-risk clips. Route medium and high-risk clips to the impersonation-investigation queue. Never communicate the score as voice-clone evidence — investigators decide using totality of signals.",
    trigger: "On call-recording intake from suspected impersonation incidents — CFO/CEO clips, vendor-call recordings, support-line escalations.",
    input: "HTTPS URL to the call recording (stored in your controlled storage with appropriate consent). Optional partial transcript from any agent who heard the call live.",
    context: { format: "other", intended_use: "moderate", domain: "impersonator call review / corporate fraud" },
    policy: [
      "allow: low risk AND no urgent-action-request transcript cues.",
      "revise: medium risk — route to the impersonation-investigation queue with the transcript and evidence categories pinned.",
      "human_review: high risk, OR transcript contains wire-transfer / password-change / payment-route-change requests, OR the call is referenced in an active fraud claim.",
      "Local protocol: impersonation suspicions trigger out-of-band verification (callback to a known number, in-person confirmation) regardless of the gate's score."
    ],
    automation: [
      "Recording-storage worker stores the consented clip; consent and retention rules vary by jurisdiction (one-party-consent states vs. all-party-consent).",
      "Worker calls POST /v1/analyze with type=audio; VeracityAPI returns a transcript plus synthetic_audio_risk, workflow_risk, and evidence categories.",
      "Allow-tagged clips flow to the standard call-archive.",
      "Routed clips appear in the impersonation queue with the transcript pre-populated, evidence pinned, and a 'has out-of-band verification been completed' field.",
      "Investigation outcomes feed back into the calibration log."
    ],
    evidence: [
      "'synthetic_prosody' — intonation patterns inconsistent with natural speech",
      "'voice_emotion_flat' — generated voice often lacks emotional micro-variation under stress",
      "'transcript_urgency' — wire-transfer / authorization-change / immediate-help phrases",
      "'background_inconsistency' — ambient audio that doesn't match the caller's stated context (claims to be calling from a known office but background sounds wrong)"
    ],
    kpis: [
      "impersonation clips triaged per week",
      "out-of-band verification completion rate before action is taken",
      "wire-fraud loss avoidance per quarter",
      "false-positive rate on routed clips (legitimate executive calls held)",
      "regulatory-audit score on the fraud-response step"
    ],
    caveats: [
      "The score is not voice-clone evidence. Don't communicate a 'high synthetic_audio_risk' result externally as proof.",
      "Voice-clone technology improves rapidly. The score's confidence on state-of-the-art synthesis is lower than on older synthesis techniques. Don't over-rely.",
      "Out-of-band verification (calling back on a known number, in-person check, multi-party authorization for payments above a threshold) is the actual fraud control. The gate is a triage signal, not a substitute."
    ],
    sampleText: "Suspicious vendor voicemail requesting payment-route change.",
    modality: "audio",
    domainNuance: {
      title: "Where this fits in the corporate fraud control stack",
      body: "Vendor-payment-redirection fraud (also called Business Email Compromise extending to voice) is the loss category to model against. Industry losses are tracked by the FBI's IC3 reports. The standard control stack: vendor-onboarding verification, dual-authorization for payment-route changes, out-of-band callback before any change is processed, and post-incident reconciliation. The audio gate provides a triage signal for the callback step — but the callback itself, performed by a human using a known-good phone number, is what actually prevents the loss."
    }
  },
  {
    slug: "audio-voicemail-scam-inbox-filter",
    title: "Voicemail scam inbox filter",
    eyebrow: "Audio · beta endpoint",
    summary: "Rank voicemails in business inboxes by synthetic-voice and scam-pattern risk, so the suspicious ones get human review before being trusted or deleted. The endpoint returns a transcript, which is often the immediately useful artifact even when the voice score is uncertain.",
    businessValue: [
      "Triages voicemail inboxes that have become a high-volume scam vector — synthetic-voice 'urgent' messages targeting accounts-payable, customer-success, and executive lines.",
      "Surfaces the urgency-pattern transcripts (wire transfer, password reset, refund processing) regardless of whether the voice score is conclusive.",
      "Documents the voicemail-handling step for the small number of incidents that escalate to active fraud cases."
    ],
    agentJob: "Be a conservative voicemail triage layer. Suspicious clips rank higher for review; clearly-benign clips proceed to the standard inbox. Never auto-delete based on score alone — the cost of deleting a real voicemail from a real customer is higher than the cost of human-reviewing a fake one.",
    trigger: "On voicemail arrival to designated inboxes (accounts-payable, finance, executive-assistant lines). Re-run on voicemails referenced in active disputes.",
    input: "HTTPS URL to the voicemail audio. Optional metadata: inbound caller ID, voicemail timestamp, retention status.",
    context: { format: "other", intended_use: "moderate", domain: "voicemail scam inbox filter" },
    policy: [
      "allow: low risk AND no urgency-pattern transcript cues. Routes to standard inbox.",
      "revise: medium risk OR transcript contains payment / authorization / personal-info requests. Promote to the daily review batch.",
      "human_review: high risk, OR transcript contains specific high-stakes phrases (wire transfer, gift card, immediate help).",
      "Never auto-reject voicemails. The blast radius of deleting a real customer's voicemail is too high."
    ],
    automation: [
      "Voicemail-system integration receives the audio file on arrival.",
      "Worker stores the clip in your controlled storage and calls POST /v1/analyze with type=audio.",
      "Allow-tagged voicemails flow to the standard inbox.",
      "Promoted voicemails enter a 'daily review' batch surfaced to a designated reviewer.",
      "Outcomes (genuine, scam, ambiguous) feed back into the calibration log."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence patterns inconsistent with natural speech",
      "'urgency_phrasing' — transcript containing urgency patterns (immediately, right now, before close of business)",
      "'authorization_request' — transcript containing requests for password / payment-route / wire-instruction changes",
      "'caller_anonymous' — caller doesn't identify themselves by name, employer, or context"
    ],
    kpis: [
      "voicemails promoted to review per week",
      "scam-pattern detection rate at routed clips",
      "false-positive rate on routed voicemails (real customers held for review unnecessarily)",
      "median time from voicemail arrival to standard inbox for clean clips",
      "scam-incident escalation rate by quarter"
    ],
    caveats: [
      "Auto-deletion is never the right action. Triage prioritizes review; humans make the keep/delete decision.",
      "Voicemail-system audio compression varies by carrier and platform. Confidence is generally lower on voicemail audio than on direct recordings.",
      "Caller-ID spoofing is the standard companion attack. The gate's audio/transcript signals are useful precisely because caller ID can't be trusted."
    ],
    sampleText: "Voicemail requesting account unlock or payment change.",
    modality: "audio"
  },
  {
    slug: "audio-podcast-guest-provenance-check",
    title: "Podcast guest provenance check",
    eyebrow: "Audio · beta endpoint",
    summary: "Screen guest-submitted audio — remote interview clips, promo reads, ad-spot recordings — for synthetic-voice cues before publishing. The risk isn't usually deception; it's accidentally publishing voiceover work generated by a tool the guest used without disclosing.",
    businessValue: [
      "Catches the disclosure-gap pattern where a guest submitted ad-read audio they generated with a voice-clone tool of themselves — increasingly common, often not disclosed.",
      "Adds a verification step for guest-submitted clips before they appear under the show's editorial banner.",
      "Documents the verification step for editorial-policy compliance."
    ],
    agentJob: "Be an editorial QA reviewer for guest audio. Allow clips that read as authentic guest recordings. Hold clips with synthetic-voice cues for guest follow-up. Reject when the synthesis pattern would conflict with the show's editorial policy on AI-generated audio.",
    trigger: "On guest-audio intake — remote interview drop-files, promo reads, sponsorship spots, listener-submitted voice messages.",
    input: "HTTPS URL to the audio file. Optional metadata: guest name, intended use (interview, promo, listener segment), show's editorial-policy version.",
    context: { format: "other", intended_use: "publish", domain: "podcast guest audio provenance" },
    policy: [
      "allow: low risk, consistent with the show's editorial-policy version.",
      "revise: medium risk — confirm with the guest whether the audio was generated or processed with a voice-clone tool; if so, request a re-record or add disclosure.",
      "human_review: high risk on ad-reads, sponsor spots, or content under the show's editorial banner.",
      "Editorial-policy match: shows with strict 'no AI voice' policies should treat any synthetic cues as revise; shows with disclosure-allowed policies need a labeling step."
    ],
    automation: [
      "Episode-production worker receives guest audio.",
      "Worker scores each clip with intended_use=publish.",
      "Allow-tagged clips flow to the edit pass.",
      "Held clips route to the producer with a 'confirm with guest' workflow.",
      "Disclosure additions get appended to the episode metadata for transparency."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence inconsistent with the guest's prior episodes (if comparison audio is available)",
      "'voice_consistency_drift' — pitch or timbre that drifts in ways human recordings don't",
      "'background_inconsistency' — silent backgrounds where the guest's prior recording environment had consistent ambient cues",
      "'breath_artifact' — breath patterns that don't match natural speech"
    ],
    kpis: [
      "% of guest clips routed for follow-up",
      "disclosure-addition rate after follow-up",
      "editorial-policy compliance rate",
      "guest-relationship cost (legitimate guests offended by hold) — high here = thresholds need adjustment",
      "median time from intake to publish-ready"
    ],
    caveats: [
      "Phone-recorded interviews, remote-podcast platforms with auto-leveling, and noise-suppression tools can produce 'processed' audio that trips synthetic cues. The gate is one signal; producer judgment is the final call.",
      "Voice-clone tools used WITH disclosure are increasingly legitimate. The gate enforces the disclosure step rather than prohibiting voice-clone use.",
      "Editorial policy varies by show. Maintain per-show policy modules rather than a single threshold."
    ],
    sampleText: "Guest-uploaded audio clip before podcast publication.",
    modality: "audio"
  },
  {
    slug: "audio-user-generated-testimonial-review",
    title: "User-generated testimonial review",
    eyebrow: "Audio · beta endpoint",
    summary: "Screen customer-submitted voice testimonials for synthetic-voice cues before publishing them on landing pages or repurposing them in ads. A fake voice testimonial in your conversion funnel is FTC-exposure and brand risk in one.",
    businessValue: [
      "Hardens the testimonial-pipeline against the rising pattern of fabricated voice testimonials submitted via referral programs and review-incentive flows.",
      "Catches the case where a marketing team accidentally synthesizes a 'testimonial' from a customer quote, without disclosure.",
      "Adds an audit trail to the testimonial step, which matters for FTC-disclosure compliance as the testimonial-AI rules evolve."
    ],
    agentJob: "Be a testimonial-pipeline reviewer. Allow clips that read as authentic customer recordings. Hold clips with synthetic-voice cues for source verification. Reject when synthesis combined with marketing-intent signals indicates fabricated testimony.",
    trigger: "On testimonial-submission intake, before testimonials appear on landing pages, in ads, or in sales-enablement materials.",
    input: "HTTPS URL to the audio testimonial. Metadata: customer ID, submission source (referral form, review system, sales rep upload), intended use.",
    context: { format: "other", intended_use: "publish", domain: "voice testimonial / FTC disclosure" },
    policy: [
      "allow: low risk, customer identity verified through your existing identity flow.",
      "revise: medium risk — request a second testimonial from the same customer (different prompt, different time) for cross-comparison.",
      "human_review: high risk OR testimonial would appear in ads (where FTC disclosure rules are strictest).",
      "reject: high risk combined with sales-rep-upload pattern (a rep uploading multiple 'testimonials' that all score similarly synthetic is a red flag)."
    ],
    automation: [
      "Testimonial-pipeline worker receives the submission.",
      "Worker scores with intended_use=publish.",
      "Allow-tagged clips flow to the testimonial library with disclosure metadata.",
      "Held clips route to a marketing-ops reviewer with the evidence pinned.",
      "Published testimonials retain the analysis_id in the asset record for audit trail."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence inconsistent with natural speech",
      "'voice_consistency_drift' — pitch/timbre patterns that don't hold across the clip",
      "'background_inconsistency' — ambient audio that doesn't match a customer-environment recording",
      "'transcript_marketing_phrasing' — testimonial content that uses marketing-copy language patterns rather than customer-language patterns"
    ],
    kpis: [
      "testimonials reviewed before publication",
      "synthesis-detection rate at the testimonial pipeline",
      "FTC-disclosure compliance audit score",
      "false-positive rate on legitimate quiet customer recordings",
      "median time from submission to publication-ready"
    ],
    caveats: [
      "FTC's endorsement-and-testimonial rules require truthful representation. AI-generated or AI-assisted testimonials require disclosure. The gate enforces the disclosure step; it doesn't prohibit AI-assisted testimony per se.",
      "Customer recordings on phones with noise suppression, beauty audio filters, or platform-level processing can trip synthetic cues. Calibrate against your customer base.",
      "Sales-rep upload patterns deserve aggregate analysis. A rep with multiple high-risk-scoring submissions warrants pipeline review."
    ],
    sampleText: "Customer voice testimonial submitted for website or ad use.",
    modality: "audio"
  },
  {
    slug: "audio-training-data-cleanroom",
    title: "Audio training-data cleanroom",
    eyebrow: "Audio · beta endpoint",
    summary: "Filter audio chunks for synthetic-voice contamination before they enter speech-model training sets. The failure mode you're guarding against: AI-generated speech upstream getting absorbed into 'natural human speech' training corpora and degrading downstream voice quality.",
    businessValue: [
      "Hardens speech-model training pipelines against the rising baseline of synthetic-voice content in scraped/licensed audio datasets.",
      "Reduces downstream voice-model artifacts that compound when training data is already partially synthetic.",
      "Creates auditable training-set provenance for AI-safety and licensing-compliance review."
    ],
    agentJob: "Be a training-data curator with a strict voice-authenticity standard. Allow clips with low synthetic cues. Reject clips with elevated cues — for training-set use, the threshold should be stricter than for publishing.",
    trigger: "During dataset construction for speech models, before voice-cloning fine-tuning runs, before TTS training jobs.",
    input: "HTTPS URL to the audio chunk (typically 10–60 seconds for speech training). Metadata: source dataset, licensing tier, speaker-cohort designation.",
    context: { format: "other", intended_use: "train", domain: "audio training data cleanroom / speech-model curation" },
    policy: [
      "allow: low risk on speech-only clips. Routes to the training corpus.",
      "human_review: medium risk. For training use, medium-risk clips deserve sample review before bulk inclusion.",
      "reject: high risk, OR source dataset has elevated rates of synthetic contamination in prior batches.",
      "Conservative-mode override: voice-cloning fine-tune sets should reject medium-risk clips by default — synthesis-induced artifacts compound in training."
    ],
    automation: [
      "Curation worker pulls candidate audio chunks from upstream datasets.",
      "Worker chunks by sentence or fixed-duration windows.",
      "Score each chunk with intended_use=train.",
      "Allow-tagged chunks enter the training manifest with the analysis_id stored for audit.",
      "Rejected chunks log to the rejection table with evidence for periodic dataset-quality review."
    ],
    evidence: [
      "'synthetic_prosody' — patterns characteristic of TTS or voice-clone synthesis",
      "'compression_artifact' — codec artifacts indicating the audio has been re-encoded by a synthesis pipeline",
      "'voice_consistency_unnatural' — unnaturally uniform pitch/timbre that real recordings don't sustain",
      "'background_artifact' — generated 'natural-sounding' background that doesn't render the way real ambient audio does"
    ],
    kpis: [
      "dataset acceptance rate (typical healthy steady-state: 60–85% depending on source)",
      "downstream model-quality metric (PESQ, MOS, or domain-specific eval) compared to unfiltered baseline",
      "synthetic-contamination rate per source dataset over time",
      "human-review hours per million chunks (target: drop as the filter calibrates)",
      "training-set provenance audit-readiness score"
    ],
    caveats: [
      "This is not a complete training-set governance system. Pair with licensing review, speaker-consent verification, and PII/voice-identification audits.",
      "Conservative thresholds are correct for training. The cost of including bad data is amortized over millions of inference calls; the cost of excluding marginal data is small.",
      "Voice-clone synthesis improves rapidly. State-of-the-art synthesis can score below threshold even when it's synthetic. Pair with provenance metadata wherever available."
    ],
    sampleText: "Audio dataset manifest before speech model training.",
    modality: "audio"
  },
  {
    slug: "audio-news-tip-hotline-triage",
    title: "News tip hotline triage",
    eyebrow: "Audio · beta endpoint",
    summary: "Triage voice tips, leaked clips, and hotline recordings before journalists treat them as source material. A synthetic-voice tip masquerading as a whistleblower recording is the failure mode reporters need to surface before, not after, publication.",
    businessValue: [
      "Adds a verification step for the audio-evidence category that's hardest to fact-check independently — voice tips from anonymous sources.",
      "Catches the pattern of deceptive 'leaked' clips designed to bait newsrooms into citing them.",
      "Documents the verification step in the publication record for editorial-accountability and litigation-defense purposes."
    ],
    agentJob: "Be a tip-line triage layer. Allow tips with authentic-voice signals AND independent corroboration. Hold tips with synthetic-voice cues until verification completes. Reject tips that combine synthetic-voice with unverifiable claims.",
    trigger: "On tip-line intake — voicemail to dedicated tip lines, anonymous-upload form submissions, secure-drop equivalents that include audio.",
    input: "HTTPS URL to the audio tip (stored in your controlled storage). Metadata: tip ID, submission method, related story or investigation thread.",
    context: { format: "other", intended_use: "cite", domain: "news tip hotline audio triage" },
    policy: [
      "allow: low risk AND tip content is corroborated by independent sources.",
      "revise: medium risk — pursue independent corroboration before treating as source material. Tip can still be a lead; it can't be evidence.",
      "human_review: high risk, OR tips that would source named accusations against identifiable individuals or institutions.",
      "Editorial standard: voice tips alone are never sufficient sourcing for a published claim. The gate enforces the corroboration step."
    ],
    automation: [
      "Tip-line system stores incoming audio in your controlled storage.",
      "Worker scores with intended_use=cite (the highest-bar policy).",
      "Allow-tagged tips with completed corroboration enter the reporting workflow.",
      "Held tips route to the lead-investigations team with the evidence categories pinned and a 'corroboration required' status.",
      "Tip outcomes (verified, refuted, inconclusive) feed back into the calibration log."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence inconsistent with natural speech",
      "'voice_consistency_unnatural' — voice patterns that hold too uniformly for natural recording",
      "'transcript_specificity_gap' — tips that name no specific people, places, dates, or documents",
      "'transcript_marketing_phrasing' — language patterns that don't match how genuine whistleblowers actually talk"
    ],
    kpis: [
      "tips routed for verification vs. immediate dismissal",
      "tip-to-story conversion rate (only verified tips count)",
      "retracted-story rate involving audio sourcing (drive to zero)",
      "median time from tip intake to verification disposition",
      "editorial-confidence survey on tip-handling workflow"
    ],
    caveats: [
      "Voice tips alone are never publishable evidence regardless of score. The gate is one signal in the verification step, not a substitute for independent reporting.",
      "Real whistleblowers sometimes use voice-changing software for protection. 'High synthetic risk' isn't automatic disqualification — it's a flag to verify by other means.",
      "Source protection rules govern how tip metadata gets stored and accessed. The audio-scoring step shouldn't compromise source anonymity."
    ],
    sampleText: "Hotline audio tip used as possible source material.",
    modality: "audio"
  },
  {
    slug: "audio-financial-fraud-dispute-review",
    title: "Financial fraud dispute audio review",
    eyebrow: "Audio · beta endpoint",
    summary: "Score voice recordings submitted in chargeback, account-takeover, and wire-transfer disputes for synthetic-voice cues. The score doesn't prove fraud; it routes the dispute to the investigator most likely to find what happened.",
    businessValue: [
      "Adds a triage layer for disputes citing voice evidence — chargebacks claiming 'I never authorized this call,' wire-fraud claims, account-takeover disputes referencing recorded confirmations.",
      "Front-loads investigator attention on disputes most likely to involve voice-clone fraud.",
      "Creates an audit trail for the voice-evidence step, which regulators are beginning to scrutinize as fraud patterns evolve."
    ],
    agentJob: "Be a dispute-triage layer. Allow disputes with low-risk audio. Route disputes with synthetic-voice cues to specialist investigators. Never claim the score is fraud determination on its own.",
    trigger: "On dispute intake when the dispute references voice evidence (recorded calls, voicemails, authorization confirmations).",
    input: "HTTPS URL to the audio in question (stored in your controlled storage with appropriate retention). Metadata: dispute ID, dispute type, dispute amount, prior dispute history.",
    context: { format: "other", intended_use: "moderate", domain: "financial fraud audio dispute review" },
    policy: [
      "allow: low risk audio AND dispute pattern is consistent with the disputant's history.",
      "revise: medium risk — route to dispute specialist with the evidence pinned.",
      "human_review: high risk, OR dispute amount above the carrier's specialist-review threshold, OR disputant has prior fraud-pattern signals.",
      "Regulatory note: the score never gets communicated to the disputant as fraud evidence. It's an internal triage signal."
    ],
    automation: [
      "Dispute system worker pulls the referenced audio from your controlled storage.",
      "Worker scores with intended_use=moderate.",
      "Allow-tagged disputes flow to the standard dispute queue.",
      "Routed disputes appear in the specialist queue with evidence categories pinned and dispute-history surfaced.",
      "Investigation outcomes feed back into calibration."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence inconsistent with natural speech",
      "'voice_clone_pattern' — characteristics consistent with consumer voice-clone tools",
      "'background_inconsistency' — ambient audio that doesn't match the stated recording context",
      "'transcript_inconsistency' — what's said doesn't match what the disputant claims was said"
    ],
    kpis: [
      "disputes triaged with audio evidence per quarter",
      "specialist-investigator referral conversion rate (referrals that result in findings)",
      "voice-clone fraud loss avoidance",
      "false-positive rate on legitimate disputes incorrectly routed",
      "regulatory-audit score on the voice-evidence step"
    ],
    caveats: [
      "The score is not fraud determination. Communicate dispute outcomes to disputants in the language of policy and evidence, not in the language of API scores.",
      "Recording quality varies widely. Compressed/lossy recordings reduce confidence. Pair with other dispute signals.",
      "Reg-E, Reg-Z, and state-level financial-consumer-protection rules govern dispute handling. The gate's output should never be the sole stated reason for a dispute denial."
    ],
    sampleText: "Call recording submitted in a wire-transfer dispute.",
    modality: "audio"
  },
  {
    slug: "audio-creator-marketplace-submission-qa",
    title: "Creator marketplace submission QA",
    eyebrow: "Audio · beta endpoint",
    summary: "Screen voiceover, jingle, ad-read, and testimonial submissions on creator marketplaces for synthetic-voice cues before brands accept and pay for them. The disclosed-AI category is allowed; undisclosed AI sold as human voice work is the problem.",
    businessValue: [
      "Catches the marketplace-abuse pattern: creators selling AI-generated voiceover as 'my voice' on platforms where AI use requires disclosure.",
      "Protects brand-side buyers from accidentally licensing AI work they intended to license as human voice talent.",
      "Builds platform-side trust signals (verified-human-voice creators) that increase marketplace value."
    ],
    agentJob: "Be a marketplace QA reviewer. Allow submissions with low synthetic cues. Hold submissions with elevated cues for creator follow-up (disclosure prompt). Reject when creators have repeatedly submitted undisclosed-AI work.",
    trigger: "On creator submission intake, before brand-buyer delivery, on creator profile-tier review.",
    input: "HTTPS URL to the audio submission. Metadata: creator ID, submission type (voiceover, jingle, ad-read), brand brief, marketplace disclosure-policy version.",
    context: { format: "other", intended_use: "publish", domain: "creator marketplace audio QA" },
    policy: [
      "allow: low risk AND creator profile is in good standing.",
      "revise: medium risk — prompt the creator to confirm whether AI tools were used and request disclosure labeling if applicable.",
      "human_review: high risk on submissions for brand campaigns where the brief specified 'no AI voice.'",
      "reject: high risk combined with creator-history pattern of undisclosed AI submissions."
    ],
    automation: [
      "Submission-intake worker receives the audio.",
      "Worker scores with intended_use=publish.",
      "Allow-tagged submissions flow to brand-buyer delivery.",
      "Held submissions trigger the creator-disclosure prompt workflow.",
      "Creator-history aggregation surfaces patterns over time."
    ],
    evidence: [
      "'synthetic_prosody' — voice cadence inconsistent with natural recording",
      "'voice_consistency_unnatural' — uniform pitch/timbre patterns that real voice talent doesn't sustain",
      "'background_silence_artifact' — generated audio often has unnaturally clean silence between phrases",
      "'breath_pattern_absence' — natural recordings include breath sounds at predictable points; generated audio often lacks them"
    ],
    kpis: [
      "creator submissions held per week",
      "disclosure-addition rate after follow-up",
      "brand-buyer satisfaction (decreases if false-positives offend legitimate creators)",
      "marketplace policy-violation rate",
      "verified-human-voice creator-tier growth"
    ],
    caveats: [
      "Voice talent who uses AI tools for editing, noise suppression, or pitch correction can occasionally trip synthetic cues. The gate's purpose is the disclosure conversation, not creator-blocking.",
      "Voice clones of the creator's own voice are a special category — many marketplaces explicitly allow them with disclosure. The gate enforces the disclosure step.",
      "Brief language matters. 'No AI voice' briefs need strict enforcement; briefs that allow AI with disclosure need a different threshold."
    ],
    sampleText: "Creator voiceover submission before brand acceptance.",
    modality: "audio"
  }
];
