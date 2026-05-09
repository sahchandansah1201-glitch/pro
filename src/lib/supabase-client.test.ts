import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  __resetSupabaseClientForTests,
  getSupabaseClient,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase-client";

beforeEach(() => {
  __resetSupabaseClientForTests();
});

afterEach(() => {
  vi.unstubAllEnvs();
  __resetSupabaseClientForTests();
});

describe("supabase-client", () => {
  it("isSupabaseConfigured() is false when env is missing", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it("isSupabaseConfigured() is false when only URL is set", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
    expect(isSupabaseConfigured()).toBe(false);
    expect(getSupabaseClient()).toBeNull();
  });

  it("isSupabaseConfigured() is true with URL + publishable key", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk-test");
    expect(isSupabaseConfigured()).toBe(true);
    expect(getSupabaseUrl()).toBe("https://abc.supabase.co");
  });

  it("getSupabaseClient() returns a stable singleton when configured", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk-test");
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("getSupabaseUrl() strips trailing slashes", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://abc.supabase.co/");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "pk-test");
    expect(getSupabaseUrl()).toBe("https://abc.supabase.co");
  });
});
