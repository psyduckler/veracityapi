import { describe, expect, it } from "vitest";
import { safeExtensionNextPath, safeRelativeNext, validateExtensionRedirectUri, validateExtensionState } from "../src/extensionAuth";

describe("extension auth helpers", () => {
  const redirectUri = "https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/veracity";

  it("accepts Chrome identity redirect URLs", () => {
    expect(validateExtensionRedirectUri(redirectUri)).toBe(redirectUri);
    expect(validateExtensionState("state_123")).toBe("state_123");
  });

  it("rejects non-extension redirect URLs", () => {
    expect(() => validateExtensionRedirectUri("https://veracityapi.com/callback")).toThrow(/Chrome extension identity/);
    expect(() => validateExtensionRedirectUri("http://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org/veracity")).toThrow(/Chrome extension identity/);
    expect(() => validateExtensionRedirectUri("https://zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.chromiumapp.org/veracity")).toThrow(/Chrome extension identity/);
  });

  it("round-trips only safe extension next paths", () => {
    const next = safeExtensionNextPath(redirectUri, "state_abc");
    expect(next).toContain("/extension/connect?");
    expect(safeRelativeNext(next)).toBe(next);
    expect(safeRelativeNext("https://evil.test/extension/connect?redirect_uri=" + encodeURIComponent(redirectUri) + "&state=x")).toBeNull();
    expect(safeRelativeNext("/account?message=hi")).toBeNull();
  });
});
