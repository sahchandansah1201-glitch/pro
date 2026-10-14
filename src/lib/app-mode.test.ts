import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppMode, isDemoAppMode, isProductionAppMode, normalizeAppMode } from "../../test-fixtures/legacy-ui/app-mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("historical app-mode vocabulary, excluded from runtime", () => {
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
