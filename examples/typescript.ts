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

export async function analyzeText(text: string) {
  return request("/v1/analyze-text", {
    method: "POST",
    body: JSON.stringify({
      text,
      context: { format: "article", intended_use: "publish", domain: "content QA" },
      privacy_mode: true,
    }),
  });
}

export async function analyzeImage(image_url: string) {
  return request("/v1/analyze-image", {
    method: "POST",
    body: JSON.stringify({
      image_url,
      context: { format: "social_post", intended_use: "publish", domain: "image trust" },
      privacy_mode: true,
    }),
  });
}

export async function analyzeAudio(audio_url: string, transcript?: string) {
  return request("/v1/analyze-audio", {
    method: "POST",
    body: JSON.stringify({
      audio_url,
      transcript,
      context: { format: "social_post", intended_use: "publish", domain: "audio workflow triage" },
      privacy_mode: true,
    }),
  });
}

export async function analyzeBatch(items: Array<{ id: string; text: string }>) {
  return request("/v1/analyze-batch", {
    method: "POST",
    body: JSON.stringify({
      items,
      context: { format: "article", intended_use: "publish", domain: "batch QA" },
      privacy_mode: true,
    }),
  });
}

async function main() {
  console.log(await getBalance());
  const result = await analyzeText("This is a specific enough demo sentence only if it includes concrete evidence and context for an agent workflow.");
  console.log(result.recommended_action, result.risk_level);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((err) => { console.error(err); process.exit(1); });
