import type { Env } from "./types";

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function authenticate(request: Request, env: Env): Promise<{ token: string; apiKeyHash: string }> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() ?? "";
  const validKeys = new Set((env.API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean));

  if (!token || !validKeys.has(token)) {
    throw new AuthError("unauthorized");
  }

  return { token, apiKeyHash: await sha256Hex(token) };
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
