const API_BASE = process.env.VERACITYAPI_BASE_URL ?? "https://api.veracityapi.com";
const API_KEY = process.env.VERACITYAPI_KEY;

if (!API_KEY) throw new Error("Set VERACITYAPI_KEY");

type Json = Record<string, unknown>;

async function request(path: string, init: RequestInit = {}): Promise<Json> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

export async function getBalance() {
  return request("/v1/balance", { method: "GET" });
}

export async function analyzeText(text: string, autoRevise = false) {
  return request("/v1/analyze", {
    method: "POST",
    body: JSON.stringify({
      type: "text",
      content: text,
      auto_revise: autoRevise,
      context: { format: "article", intended_use: "publish", domain: "content QA" },
      store_content: false,
    }),
  });
}

export async function analyzeImage(imageUrl: string) {
  return request("/v1/analyze", {
    method: "POST",
    body: JSON.stringify({
      type: "image",
      content: imageUrl,
      context: { format: "social_post", intended_use: "publish", domain: "image trust" },
      store_content: false,
    }),
  });
}

export async function analyzeAudio(audioUrl: string, transcript?: string) {
  return request("/v1/analyze", {
    method: "POST",
    body: JSON.stringify({
      type: "audio",
      content: audioUrl,
      transcript,
      context: { format: "social_post", intended_use: "publish", domain: "audio workflow triage with transcript return" },
      store_content: false,
    }),
  });
}

export async function analyzeBatch(items: Array<{ id: string; text: string }>) {
  return request("/v1/analyze-batch", {
    method: "POST",
    body: JSON.stringify({
      items,
      context: { format: "article", intended_use: "publish", domain: "batch QA" },
      store_content: false,
    }),
  });
}

async function main() {
  console.log(await getBalance());
  const result = await analyzeText("This is a specific enough demo sentence only if it includes concrete evidence and context for an agent workflow.", true);
  console.log(result.recommended_action, result.risk_level, result.revised_text);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((err) => { console.error(err); process.exit(1); });

// Text auto-revise: auto_revise=true bills Analyze + revise at $0.010 / 1k characters
// and returns revised_text when recommended_action is revise. Analyze-only remains $0.005 / 1k.
// Evidence type values are strict enums for deterministic agent branching.
