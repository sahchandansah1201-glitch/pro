import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppMode, isDemoAppMode, isProductionAppMode, normalizeAppMode } from "@/lib/app-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("app-mode", () => {
  it("defaults to demo unless explicitly set to production", () => {
    expect(normalizeAppMode(undefined)).toBe("demo");
    expect(normalizeAppMode("")).toBe("demo");
    expect(normalizeAppMode("staging")).toBe("demo");
    expect(normalizeAppMode("production")).toBe("production");
    expect(normalizeAppMode(" Production ")).toBe("production");
  });

  it("reads VITE_APP_MODE at runtime", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    expect(getAppMode()).toBe("production");
    expect(isProductionAppMode()).toBe(true);
    expect(isDemoAppMode()).toBe(false);

    vi.stubEnv("VITE_APP_MODE", "demo");
    expect(getAppMode()).toBe("demo");
    expect(isProductionAppMode()).toBe(false);
    expect(isDemoAppMode()).toBe(true);
  });
});
