import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import {
  AUTH_CHANGED_EVENT,
  readSupabaseSession,
  useApiSession,
} from "@/lib/api-session";

const REF = "abcd1234";
const URL = `https://${REF}.supabase.co`;
const KEY = `sb-${REF}-auth-token`;

function setEnv(url: string | undefined) {
  vi.stubEnv("VITE_SUPABASE_URL", url ?? "");
}

beforeEach(() => {
  window.localStorage.clear();
  setEnv(URL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readSupabaseSession", () => {
  it("returns nulls when VITE_SUPABASE_URL is empty", () => {
    setEnv("");
    expect(readSupabaseSession()).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when no auth-token entry exists", () => {
    expect(readSupabaseSession()).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when JSON is malformed", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readSupabaseSession()).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when access_token is missing", () => {
    window.localStorage.setItem(KEY, JSON.stringify({ expires_at: 9999999999 }));
    expect(readSupabaseSession()).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when token is expired", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ access_token: "tok", expires_at: 1000 }),
    );
    expect(readSupabaseSession(2000)).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns token + base url for a fresh session (flat shape)", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ access_token: "tok-flat", expires_at: 9999999999 }),
    );
    expect(readSupabaseSession(1000)).toEqual({
      apiToken: "tok-flat",
      apiBaseUrl: URL,
    });
  });

  it("supports nested currentSession shape", () => {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        currentSession: { access_token: "tok-nested", expires_at: 9999999999 },
      }),
    );
    expect(readSupabaseSession(1000).apiToken).toBe("tok-nested");
  });

  it("strips trailing slashes from base url", () => {
    setEnv(`${URL}/`);
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ access_token: "tok", expires_at: 9999999999 }),
    );
    expect(readSupabaseSession(1000).apiBaseUrl).toBe(URL);
  });
});

describe("useApiSession", () => {
  it("re-reads on dermpro:auth-changed event", () => {
    const { result } = renderHook(() => useApiSession());
    expect(result.current.apiToken).toBeNull();

    act(() => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ access_token: "tok-evt", expires_at: 9999999999 }),
      );
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
    });
    expect(result.current.apiToken).toBe("tok-evt");
    expect(result.current.apiBaseUrl).toBe(URL);
  });

  it("re-reads on storage event", () => {
    const { result } = renderHook(() => useApiSession());
    act(() => {
      window.localStorage.setItem(
        KEY,
        JSON.stringify({ access_token: "tok-storage", expires_at: 9999999999 }),
      );
      window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
    });
    expect(result.current.apiToken).toBe("tok-storage");
  });
});
