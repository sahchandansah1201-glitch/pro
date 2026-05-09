import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { useContext } from "react";

// Mock the supabase client module before importing AuthProvider.
const subscribers: Array<(event: string, session: unknown) => void> = [];
const getSessionMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const signInWithOAuthMock = vi.fn();
const signOutMock = vi.fn();
const onAuthStateChangeMock = vi.fn((cb: (event: string, session: unknown) => void) => {
  subscribers.push(cb);
  return {
    data: { subscription: { unsubscribe: () => {} } },
  };
});

const fakeClient = {
  auth: {
    onAuthStateChange: onAuthStateChangeMock,
    getSession: getSessionMock,
    signInWithPassword: signInWithPasswordMock,
    signInWithOAuth: signInWithOAuthMock,
    signOut: signOutMock,
  },
};

vi.mock("@/lib/supabase-client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseUrl: () => "https://abc.supabase.co",
  getSupabaseClient: () => fakeClient,
  __resetSupabaseClientForTests: () => {},
}));

import { AuthProvider } from "@/context/AuthContext";
import { AuthContext, type AuthContextValue } from "@/context/auth-context";

function Probe({ onValue }: { onValue: (v: AuthContextValue) => void }) {
  const v = useContext(AuthContext);
  if (v) onValue(v);
  return null;
}

beforeEach(() => {
  subscribers.length = 0;
  getSessionMock.mockReset();
  signInWithPasswordMock.mockReset();
  signInWithOAuthMock.mockReset();
  signOutMock.mockReset();
  onAuthStateChangeMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("AuthProvider", () => {
  it("registers onAuthStateChange BEFORE getSession()", async () => {
    let getSessionCalledAfter = false;
    getSessionMock.mockImplementation(() => {
      getSessionCalledAfter = onAuthStateChangeMock.mock.invocationCallOrder[0] !== undefined;
      return Promise.resolve({ data: { session: null } });
    });
    let captured: AuthContextValue | null = null;
    render(
      <AuthProvider>
        <Probe onValue={(v) => (captured = v)} />
      </AuthProvider>,
    );
    await waitFor(() => expect(getSessionMock).toHaveBeenCalled());
    expect(getSessionCalledAfter).toBe(true);
    expect(captured).not.toBeNull();
  });

  it("transitions loading → authenticated when getSession returns a session", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: "tok-1",
          user: { id: "u-1", email: "a@b" },
        },
      },
    });
    const values: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <Probe onValue={(v) => values.push(v)} />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(values[values.length - 1].status).toBe("authenticated");
    });
    const last = values[values.length - 1];
    expect(last.accessToken).toBe("tok-1");
    expect(last.apiBaseUrl).toBe("https://abc.supabase.co");
    expect(last.user?.id).toBe("u-1");
    // First emission must be loading.
    expect(values[0].status).toBe("loading");
  });

  it("transitions to anonymous on SIGNED_OUT event", async () => {
    getSessionMock.mockResolvedValue({
      data: {
        session: { access_token: "tok-1", user: { id: "u-1" } },
      },
    });
    const values: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <Probe onValue={(v) => values.push(v)} />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(values[values.length - 1].status).toBe("authenticated");
    });

    act(() => {
      for (const cb of subscribers) cb("SIGNED_OUT", null);
    });

    await waitFor(() => {
      expect(values[values.length - 1].status).toBe("anonymous");
    });
    const last = values[values.length - 1];
    expect(last.session).toBeNull();
    expect(last.accessToken).toBeNull();
    expect(last.apiBaseUrl).toBeNull();
  });

  it("updates token on TOKEN_REFRESHED event", async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { access_token: "tok-1", user: { id: "u-1" } } },
    });
    const values: AuthContextValue[] = [];
    render(
      <AuthProvider>
        <Probe onValue={(v) => values.push(v)} />
      </AuthProvider>,
    );
    await waitFor(() => {
      expect(values[values.length - 1].accessToken).toBe("tok-1");
    });

    act(() => {
      for (const cb of subscribers) {
        cb("TOKEN_REFRESHED", { access_token: "tok-2", user: { id: "u-1" } });
      }
    });

    await waitFor(() => {
      expect(values[values.length - 1].accessToken).toBe("tok-2");
    });
    expect(values[values.length - 1].status).toBe("authenticated");
  });

  it("signOut() calls supabase auth signOut", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    signOutMock.mockResolvedValue({ error: null });
    let captured: AuthContextValue | null = null;
    render(
      <AuthProvider>
        <Probe onValue={(v) => (captured = v)} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured).not.toBeNull());
    const result = await captured!.signOut();
    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: null });
  });

  it("signInWithPassword + signInWithGoogle delegate to supabase", async () => {
    getSessionMock.mockResolvedValue({ data: { session: null } });
    signInWithPasswordMock.mockResolvedValue({ error: null });
    signInWithOAuthMock.mockResolvedValue({ error: null });
    let captured: AuthContextValue | null = null;
    render(
      <AuthProvider>
        <Probe onValue={(v) => (captured = v)} />
      </AuthProvider>,
    );
    await waitFor(() => expect(captured).not.toBeNull());

    await captured!.signInWithPassword("a@b", "pw");
    expect(signInWithPasswordMock).toHaveBeenCalledWith({ email: "a@b", password: "pw" });

    await captured!.signInWithGoogle();
    expect(signInWithOAuthMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "google" }),
    );
  });
});

describe("AuthProvider · unconfigured", () => {
  it("stays anonymous when supabase is not configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/supabase-client", () => ({
      isSupabaseConfigured: () => false,
      getSupabaseUrl: () => null,
      getSupabaseClient: () => null,
      __resetSupabaseClientForTests: () => {},
    }));
    const { AuthProvider: P } = await import("@/context/AuthContext");
    const { AuthContext: C } = await import("@/context/auth-context");

    let captured: AuthContextValue | null = null;
    function P2() {
      const v = useContext(C);
      if (v) captured = v;
      return null;
    }
    render(
      <P>
        <P2 />
      </P>,
    );
    await waitFor(() => expect(captured).not.toBeNull());
    expect(captured!.status).toBe("anonymous");
    expect(captured!.apiBaseUrl).toBeNull();
    vi.doUnmock("@/lib/supabase-client");
  });
});
