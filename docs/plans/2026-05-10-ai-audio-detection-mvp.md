# VeracityAPI AI Audio Detection MVP Plan

Date: 2026-05-10
Status: Draft for review
Owner: Bernard / VeracityAPI

## Goal

Add a simple, streamlined AI-audio risk endpoint to VeracityAPI without overbuilding raw-audio processing or making brittle “AI detector” claims.

The MVP should help agents answer:

> “Should this audio asset be trusted, published, moderated, cited, or routed to human review?”

It should **not** claim:

> “This is definitive proof that the audio is AI-generated / cloned / fake.”

## Recommended positioning

Use this framing everywhere:

> **Synthetic-audio workflow risk scoring for agents.**

Expanded copy:

> VeracityAPI scores audio assets for synthetic-audio workflow risk using caller-provided transcript and metadata. Results are probabilistic risk signals with evidence and recommended next actions, not proof of AI generation, voice cloning, speaker identity, or truth.

This keeps audio aligned with the current VeracityAPI positioning:

- content trust scoring, not authorship proof
- workflow triage, not truth oracle
- evidence + recommended action, not binary detector
- privacy-first logging

## MVP scope: transcript + metadata only

For v0.1, do **not** fetch, store, transcribe, or inspect raw audio bytes.

The endpoint accepts:

1. `audio_url` — HTTPS source URL, used only for hashing/hostname logging and caller reference.
2. `transcript` — optional caller-provided transcript or ASR output.
3. `metadata` — optional caller-observed metadata.
4. `context` — same workflow context shape as text/image endpoints.
5. `privacy_mode` — defaults true.

Require at least one of:

- `transcript`
- `metadata`

This makes the endpoint immediately shippable while avoiding:

- large file handling
- malware/file safety concerns
- private URL fetching / SSRF complexity
- ffmpeg dependencies in the Worker
- async job orchestration
- ASR vendor cost
- acoustic-forensics model selection
- raw media retention questions

## Proposed endpoint

```http
POST /v1/analyze-audio
Authorization: Bearer <api_key>
Content-Type: application/json
```

## Request schema

```json
{
  "audio_url": "https://example.com/clip.mp3",
  "transcript": "Optional caller-provided transcript or ASR output. Strongly recommended for v0.1.",
  "metadata": {
    "duration_seconds": 18,
    "codec": "mp3",
    "sample_rate_hz": 44100,
    "source_platform": "ugc_upload",
    "speaker_count": 1
  },
  "context": {
    "format": "social_post",
    "intended_use": "moderate",
    "domain": "travel safety"
  },
  "store_content": false
}
```

### Validation rules

- `audio_url`
  - required
  - must be `https://`
  - max 2,000 chars
- `transcript`
  - optional
  - if present: 20–20,000 chars
- `metadata`
  - optional
  - allowed fields:
    - `duration_seconds`: 0–86,400
    - `codec`: max 80 chars
    - `sample_rate_hz`: 1–384,000
    - `source_platform`: max 120 chars
    - `speaker_count`: 1–100
- request must include at least one of `transcript` or `metadata`
- `context` follows existing VeracityAPI context:
  - `format`: `article | social_post | product_review | caption | other`
  - `intended_use`: `publish | train | cite | moderate | other`
  - `domain`: optional string
- `privacy_mode` defaults to true

## Response schema

```json
{
  "analysis_id": "aud_01K...",
  "content_trust_score": 0.34,
  "synthetic_audio_risk": 0.66,
  "synthetic_risk": 0.66,
  "risk_level": "medium",
  "recommended_action": "human_review",
  "confidence": "low",
  "evidence": [
    {
      "type": "declared_synthetic",
      "severity": "high",
      "span": "generated with a synthetic voice",
      "explanation": "The supplied transcript explicitly says the clip used a synthetic voice."
    }
  ],
  "recommended_fixes": [
    "Verify source consent and provenance before publishing.",
    "Use dedicated acoustic or voice-forensics tooling for high-stakes identity decisions."
  ],
  "model_version": "v0.1",
  "limitations": [
    "Scores are probabilistic workflow risk signals, not proof of AI audio, voice cloning, or speaker identity.",
    "v0.1 audio scoring does not inspect waveforms or store audio bytes; it uses caller-provided transcript and metadata only.",
    "If no transcript is provided, confidence should be treated as low unless metadata explicitly indicates synthetic/TTS generation.",
    "For high-stakes decisions, pair this result with provenance, consent, source checks, and/or a dedicated acoustic forensics model."
  ],
  "billing": {
    "units_analyzed": 1,
    "bucket": "audio_v0",
    "price_cents": 2,
    "remaining_balance_cents": 148
  }
}
```

### Field notes

- `synthetic_audio_risk`: primary audio-specific risk score, 0–1.
- `synthetic_risk`: compatibility alias so SDKs/agents can handle text/image/audio uniformly.
- `content_trust_score`: derived inverse-ish trust score, higher is better.
- `confidence`: should often be `low` for metadata-only requests.
- `evidence`: must cite only transcript text or supplied metadata fields.
- `limitations`: must explicitly state no waveform/identity/voice-clone proof.

## Scoring guidance

The LLM scorer should evaluate only caller-provided transcript and metadata.

### Higher-risk signals

- Transcript or metadata explicitly says:
  - AI voice
  - TTS
  - synthetic voice
  - voice clone
  - generated narration
- Transcript reads like generic generated ad/script copy with no provenance.
- Audio is being used for publish/cite/moderate workflows but has weak source/provenance context.
- Metadata/source platform suggests generated or synthetic origin.
- Transcript contains claims that require source verification but lacks any source markers.
- Metadata and intended use conflict.

### Lower-risk signals

- Caller provides source/provenance context.
- Transcript contains specific, grounded, firsthand details.
- Metadata looks normal for the workflow.
- Intended use is low-stakes or internal.

### Confidence calibration

- Transcript + explicit synthetic disclosure: medium/high confidence for workflow risk.
- Transcript only, no source metadata: usually low/medium.
- Metadata only: usually low, unless metadata explicitly marks synthetic/TTS.
- Very short clips/transcripts: low.
- High-stakes identity decision: confidence should not imply proof.

## Claims to avoid

Do not output or imply:

- “This audio is definitely AI-generated.”
- “This speaker is cloned.”
- “This is/isn’t the real person.”
- “We detected waveform artifacts.”
- “We identified the generation provider.”
- “Breathing/noise/room tone proves synthetic audio.”
- “This is admissible proof of fraud.”

Allowed language:

- “workflow risk signal”
- “synthetic-audio risk”
- “evidence from supplied transcript/metadata”
- “route to human review”
- “verify source/provenance/consent”
- “use acoustic forensics for high-stakes identity decisions”

## Billing

MVP price:

```text
Audio v0.1: $0.02 / audio analysis
Bucket: audio_v0
```

Rationale:

- mirrors image MVP price
- simple for agents and docs
- covers LLM scoring pass
- avoids duration-based complexity until raw audio/ASR exists

Future pricing if raw audio is added:

- transcript/metadata-only: $0.02/request
- ASR + trust scoring: price by minute
- acoustic/voice forensics: higher per-minute/provider-pass pricing

## Privacy and logging

For v0.1:

- never store audio bytes
- never store full audio URL
- store URL hash
- store hostname/domain
- store `kind = "audio"`
- store context JSON
- store response JSON
- store latency/model version
- store billing event

Current schema can reuse the existing media-domain column initially, but a future cleanup could rename `image_url_domain` to `media_url_domain`.

## Implementation plan

### 1. Types

Add:

- `AnalyzeAudioRequest`
- `AudioScoredFields`
- `AnalyzeAudioResponse`

### 2. Validation

Add `parseAnalyzeAudioRequest()` with the validation rules above.

### 3. LLM scoring

Add `scoreAudio()` in `src/llm.ts` using Anthropic structured tool output.

Prompt requirements:

- transcript/metadata only
- no waveform claims
- no speaker identity claims
- no provider attribution
- no proof language
- call tool exactly once

### 4. Billing

Add:

- `priceForAudio()` → `{ bucket: "audio_v0", priceCents: 2 }`
- `debitForAudio()` → mirrors image billing path

Ledger type:

```text
audio_analysis_debit
```

### 5. Logging

Extend `logAnalysis()` to accept:

```ts
kind?: "text" | "image" | "audio"
```

For audio:

- hash `audio_url`
- store audio URL hostname/domain
- do not store transcript unless we deliberately add a separate transcript retention option later

Recommendation: for MVP, do **not** store transcript, even if `privacy_mode=false`, to keep privacy posture simple.

### 6. Route

Add:

```ts
POST /v1/analyze-audio
```

No public demo initially. Keep demo surface focused on text/image until the audio UX is clearer.

### 7. Discovery/docs

Update:

- `/openapi.json`
- `/llms.txt`
- `/.well-known/agents.json`
- `/docs`
- `/pricing`
- `/privacy`

Docs should emphasize:

- transcript/metadata-only
- no waveform inspection
- no audio-byte storage
- $0.02/request
- not proof of AI/voice clone

### 8. Tests

Add validation tests:

- accepts HTTPS audio URL + transcript
- accepts HTTPS audio URL + metadata only
- rejects HTTP URL
- rejects missing transcript+metadata
- rejects transcript over cap

Run:

```bash
npm test
npx tsc --noEmit
```

## Suggested rollout

### Phase 0: Ship transcript/metadata endpoint

- Fastest useful API surface.
- Lets agents integrate immediately.
- Minimal infrastructure risk.

### Phase 1: Add optional public docs examples

Examples:

- UGC moderation
- podcast/ad-read review
- voice-note fraud triage
- pre-publish social audio review

### Phase 2: Add raw audio processing only if there is demand

Possible additions:

- fetch audio with strict size/duration caps
- extract duration/codec/sample rate
- run ASR
- run acoustic synthetic-speech detector
- async job flow for longer clips

Likely future route shape:

```http
POST /v1/analyze-audio
GET /v1/analysis/:analysis_id
```

## Recommendation

Ship **Phase 0 only** first:

- `POST /v1/analyze-audio`
- transcript/metadata-only
- $0.02/request
- no raw audio fetch
- no public demo
- strong limitations copy

This gives VeracityAPI a multimodal text/image/audio story while preserving the trust-scoring positioning and avoiding “AI detector” overclaims.
