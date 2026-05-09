import { describe, it, expect } from "vitest";

import * as apiSession from "@/lib/api-session";
import { useApiSession } from "@/lib/use-api-session";

// Stage 1G-A · The old Stage 1F implementation was replaced by the
// AuthContext-backed hook. This file now only verifies the compatibility
// shim still re-exports `useApiSession` so callers keep working.

describe("api-session compatibility shim", () => {
  it("re-exports useApiSession from use-api-session", () => {
    expect(apiSession.useApiSession).toBe(useApiSession);
  });

  it("does not export the removed Stage 1F symbols", () => {
    expect((apiSession as Record<string, unknown>).AUTH_CHANGED_EVENT).toBeUndefined();
    expect((apiSession as Record<string, unknown>).readSupabaseSession).toBeUndefined();
  });
});
