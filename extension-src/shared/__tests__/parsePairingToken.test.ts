import { describe, it, expect } from "vitest";
import { parsePairingToken } from "@shared/shareSettings";

/** base64url-encode a UTF-8 string. */
function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function tokenWith(payload: unknown): string {
  return `PPT1.${b64url(JSON.stringify(payload))}.SIGNATURE_NOT_VERIFIED_CLIENT_SIDE`;
}

describe("parsePairingToken", () => {
  it("decodes a well-formed token and trims trailing slash from site", () => {
    const t = tokenWith({
      v: 1, site: "https://example.com/", tid: "tok_abc", uid: 42, iat: 1, exp: null,
    });
    expect(parsePairingToken(t)).toEqual({
      siteUrl: "https://example.com",
      tokenId: "tok_abc",
      userId: 42,
    });
  });

  it("trims surrounding whitespace before parsing", () => {
    const t = "  " + tokenWith({ v: 1, site: "https://x.test", tid: "t1", uid: 1 }) + "\n";
    expect(parsePairingToken(t)?.tokenId).toBe("t1");
  });

  it("rejects non-string input", () => {
    expect(parsePairingToken(undefined as unknown as string)).toBeNull();
    expect(parsePairingToken(null as unknown as string)).toBeNull();
    expect(parsePairingToken(123 as unknown as string)).toBeNull();
  });

  it("rejects wrong prefix", () => {
    expect(parsePairingToken("PPT2.x.y")).toBeNull();
    expect(parsePairingToken("Bearer abc.def.ghi")).toBeNull();
    expect(parsePairingToken("")).toBeNull();
  });

  it("rejects wrong segment count", () => {
    expect(parsePairingToken("PPT1.onlypayload")).toBeNull();
    expect(parsePairingToken("PPT1.a.b.c")).toBeNull();
  });

  it("rejects invalid base64url payload", () => {
    expect(parsePairingToken("PPT1.!!!notb64!!!.sig")).toBeNull();
  });

  it("rejects payload that is not JSON", () => {
    expect(parsePairingToken(`PPT1.${b64url("not json")}.sig`)).toBeNull();
  });

  it("rejects unexpected version", () => {
    expect(parsePairingToken(tokenWith({ v: 2, site: "https://x", tid: "t", uid: 1 }))).toBeNull();
  });

  it("rejects payload missing required fields", () => {
    expect(parsePairingToken(tokenWith({ v: 1, tid: "t", uid: 1 }))).toBeNull();
    expect(parsePairingToken(tokenWith({ v: 1, site: "https://x", uid: 1 }))).toBeNull();
    expect(parsePairingToken(tokenWith({ v: 1, site: "https://x", tid: "t" }))).toBeNull();
  });

  it("rejects payload with non-numeric uid", () => {
    expect(parsePairingToken(tokenWith({ v: 1, site: "https://x", tid: "t", uid: "42" }))).toBeNull();
  });
});