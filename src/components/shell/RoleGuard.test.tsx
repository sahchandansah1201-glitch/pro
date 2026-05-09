// Stage 1H-A · RoleGuard tests covering both the demo-only and the
// auth-aware code paths.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";

// Configure mock per-test by mutating this flag.
let configured = false;
vi.mock("@/lib/supabase-client", () => ({
  isSupabaseConfigured: () => configured,
  getSupabaseUrl: () => (configured ? "https://abc.supabase.co" : null),
  getSupabaseClient: () => null,
  __resetSupabaseClientForTests: () => {},
}));

import { RoleGuard } from "@/components/shell/RoleGuard";

const noop = async () => ({ error: null });
function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    status: "anonymous",
    session: null,
    user: null,
    accessToken: null,
    apiBaseUrl: null,
    signInWithPassword: noop,
    signInWithGoogle: noop,
    signOut: noop,
    ...overrides,
  };
}

function renderAt(
  path: string,
  auth: AuthContextValue = authValue(),
  initialRole?: string,
) {
  if (initialRole) window.localStorage.setItem(ROLE_STORAGE_KEY, initialRole);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthContext.Provider value={auth}>
        <RoleProvider>
          <Routes>
            <Route
              path="/desk"
              element={
                <RoleGuard>
                  <div data-testid="protected">PROTECTED</div>
                </RoleGuard>
              }
            />
            <Route
              path="/sys/users"
              element={
                <RoleGuard>
                  <div data-testid="protected-sys">SYS</div>
                </RoleGuard>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
          </Routes>
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  configured = false;
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

describe("RoleGuard · unconfigured (demo) mode", () => {
  it("renders children when current demo role is allowed", () => {
    renderAt("/desk", authValue(), "doctor");
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("shows the demo no-access screen when role is not allowed", () => {
    renderAt("/sys/users", authValue(), "doctor");
    expect(screen.getByText(/Нет доступа в демо-режиме/)).toBeInTheDocument();
  });
});

describe("RoleGuard · configured + auth-aware", () => {
  it("renders the loading state while auth status is loading", () => {
    configured = true;
    renderAt("/desk", authValue({ status: "loading" }), "doctor");
    expect(screen.getByText(/Проверяем сессию/)).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("redirects anonymous users to /login", () => {
    configured = true;
    renderAt("/desk", authValue({ status: "anonymous" }), "doctor");
    expect(screen.getByTestId("login-page")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("renders children for authenticated users with allowed role", () => {
    configured = true;
    renderAt(
      "/desk",
      authValue({ status: "authenticated", accessToken: "tok" }),
      "doctor",
    );
    expect(screen.getByTestId("protected")).toBeInTheDocument();
  });

  it("still shows the demo no-access screen for authenticated + disallowed role", () => {
    configured = true;
    renderAt(
      "/sys/users",
      authValue({ status: "authenticated", accessToken: "tok" }),
      "doctor",
    );
    expect(screen.getByText(/Нет доступа в демо-режиме/)).toBeInTheDocument();
  });
});
