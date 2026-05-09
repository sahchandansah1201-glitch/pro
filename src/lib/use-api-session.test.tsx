import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { useApiSession } from "@/lib/use-api-session";

function makeWrapper(value: AuthContextValue) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
  };
}

const noop = async () => ({ error: null });

const baseValue: AuthContextValue = {
  status: "anonymous",
  session: null,
  user: null,
  accessToken: null,
  apiBaseUrl: null,
  signInWithPassword: noop,
  signInWithGoogle: noop,
  signOut: noop,
};

beforeEach(() => {
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("useApiSession", () => {
  it("returns nulls when no AuthContext is mounted", () => {
    const { result } = renderHook(() => useApiSession());
    expect(result.current).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when status is loading", () => {
    const wrapper = makeWrapper({ ...baseValue, status: "loading" });
    const { result } = renderHook(() => useApiSession(), { wrapper });
    expect(result.current).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns nulls when status is anonymous", () => {
    const wrapper = makeWrapper(baseValue);
    const { result } = renderHook(() => useApiSession(), { wrapper });
    expect(result.current).toEqual({ apiToken: null, apiBaseUrl: null });
  });

  it("returns token + base url when authenticated", () => {
    const wrapper = makeWrapper({
      ...baseValue,
      status: "authenticated",
      accessToken: "tok-abc",
      apiBaseUrl: "https://abc.supabase.co",
    });
    const { result } = renderHook(() => useApiSession(), { wrapper });
    expect(result.current).toEqual({
      apiToken: "tok-abc",
      apiBaseUrl: "https://abc.supabase.co",
    });
  });

  it("returns nulls when authenticated but token/url are missing", () => {
    const wrapper = makeWrapper({
      ...baseValue,
      status: "authenticated",
      accessToken: null,
      apiBaseUrl: "https://abc.supabase.co",
    });
    const { result } = renderHook(() => useApiSession(), { wrapper });
    expect(result.current).toEqual({ apiToken: null, apiBaseUrl: null });
  });
});
