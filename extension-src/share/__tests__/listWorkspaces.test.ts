import { describe, it, expect, vi } from "vitest";
import { listWorkspaces } from "../listWorkspaces";
import { ErrorCode } from "@shared/enums";
import { MessageError } from "@shared/messaging";
import type { ShareSettings } from "@shared/types";

const cfg: ShareSettings = {
  siteUrl: "https://example.com", userId: 1, displayName: "A",
  email: "a@b", nonce: "n", signedInAtIso: "2025-01-01T00:00:00Z",
};

function jsonRes(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { "Content-Type": "application/json" } });
}

describe("listWorkspaces", () => {
  it("parses workspace rows + normalizes role/license_status", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({
      workspaces: [
        { id: 1, name: "Solo",  role: "owner",  license_status: "active" },
        { id: 2, name: "Team",  role: "member", license_status: "free" },
        { id: 3, name: "Bad",   role: "unknown",  license_status: "weird" }, // normalized
        { id: 0, name: "Drop" },                                              // dropped
        "junk",                                                                // dropped
      ],
    }));
    const out = await listWorkspaces({ getShareSettings: async () => cfg, fetchImpl });
    expect(out).toEqual([
      { id: 1, name: "Solo", role: "owner",  licenseStatus: "active" },
      { id: 2, name: "Team", role: "member", licenseStatus: "free" },
      { id: 3, name: "Bad",  role: "member", licenseStatus: "free" },
    ]);
  });

  it("returns [] on 404 (old plugin without /workspaces)", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, 404));
    const out = await listWorkspaces({ getShareSettings: async () => cfg, fetchImpl });
    expect(out).toEqual([]);
  });

  it("maps 401 to E_SHARE_AUTH", async () => {
    const fetchImpl = vi.fn(async () => jsonRes({}, 401));
    const p = listWorkspaces({ getShareSettings: async () => cfg, fetchImpl });
    await p.catch((e) => expect((e as MessageError).code).toBe(ErrorCode.E_SHARE_AUTH));
  });
});
