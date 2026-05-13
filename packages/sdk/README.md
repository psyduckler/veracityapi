# @veracityapi/sdk

Fetch-based, ESM TypeScript client for VeracityAPI content trust scoring.

VeracityAPI returns an action contract your app can route on: `allow`, `revise`, `human_review`, or `reject`.

This package is ESM-first for Node 18+, Workers, Vercel/Next.js, and modern bundlers.

## Install

```bash
npm install @veracityapi/sdk
```

## Quickstart

```ts
import { VeracityAPI } from "@veracityapi/sdk";

const veracity = new VeracityAPI({
  apiKey: process.env.VERACITY_API_KEY,
});

const result = await veracity.analyzeText({
  text: "Travelers should always be careful in tourist areas because scams can happen anywhere.",
  auto_revise: true,
  context: {
    format: "article",
    intended_use: "publish",
    domain: "travel safety",
  },
});

switch (result.recommended_action) {
  case "allow":
    break;
  case "revise":
    console.log(result.recommended_fixes);
    break;
  case "human_review":
    console.log(result.evidence);
    break;
  case "reject":
    throw new Error(result.primary_reason ?? "Rejected by content trust policy");
}
```

## Unified endpoint

```ts
const result = await veracity.analyze({
  type: "image",
  content: "https://cdn.example.com/photo.webp",
  context: { intended_use: "moderate" },
  store_content: false,
});
```

## Helpers

```ts
await veracity.analyzeText({ text, context, auto_revise: true });
await veracity.analyzeImage({ imageUrl: "https://cdn.example.com/photo.webp" });
await veracity.analyzeAudio({ audioUrl: "https://cdn.example.com/voice.mp3", transcript });
await veracity.analyzeVideo({ videoUrl: "https://cdn.example.com/clip.mp4", context: { intended_use: "moderate" } });
await veracity.analyzeBatch({ items: [{ id: "one", text }] });
await veracity.getBalance();
```

Image/audio/video helper methods force `store_content: false`; VeracityAPI does not retain raw media bytes, base64 payloads, frames/contact sheets, or full media URLs for media analysis.

## Video private beta

`client.analyzeVideo({ videoUrl, context })` calls the typed `/v1/analyze-video` endpoint, forces `store_content:false`, accepts direct HTTPS videos capped at 30 seconds / 25 MB, and costs $0.05 per API call (`video_v0`). It returns workflow-risk signals (`synthetic_video_risk`, `visual_synthetic_risk`, `metadata_risk`) and is not forensic proof.

## Options

```ts
const veracity = new VeracityAPI({
  apiKey: process.env.VERACITY_API_KEY,
  baseUrl: "https://api.veracityapi.com",
  timeoutMs: 30_000,
  fetch: customFetch,
});
```

`createClient(options)` is also exported as a convenience alias.

## Errors

Non-2xx responses throw `VeracityAPIError` with:

- `status`
- `body`
- `requestId` when the API returns `x-request-id`
- a safe message that does not include your API key

```ts
import { VeracityAPIError } from "@veracityapi/sdk";

try {
  await veracity.getBalance();
} catch (error) {
  if (error instanceof VeracityAPIError && error.status === 402) {
    console.log("Top up required");
  }
}
```

## Runtime support

- Node.js 18+
- Cloudflare Workers
- Vercel/Next.js route handlers
- Browser runtimes when you provide a safe server-issued key/proxy; do not expose production API keys in public client bundles.
