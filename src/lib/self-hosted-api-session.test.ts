import { describe, expect, it } from "vitest";
import {
  selfHostedSessionIdentityKey,
  type SelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

describe("selfHostedSessionIdentityKey", () => {
  it("uses the session revision instead of retaining the bearer token", () => {
    const token = "secret-bearer-token-that-must-not-be-retained";
    const session: SelfHostedApiSession = {
      apiBaseUrl: "http://localhost:3001",
      apiToken: token,
      user: { id: "doctor-1", displayName: "Врач", roles: ["doctor"] },
      status: "configured",
      revision: 4,
    };

    const first = selfHostedSessionIdentityKey(session, ["visit-1"]);
    const rotated = selfHostedSessionIdentityKey({ ...session, revision: 5 }, ["visit-1"]);

    expect(first).not.toContain(token);
    expect(first).not.toMatch(/bearer/i);
    expect(rotated).not.toBe(first);
  });
});
