import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import type { User } from "@supabase/supabase-js";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => navigateMock };
});

vi.mock("@/lib/supabase-client", () => ({
  isSupabaseConfigured: () => true,
  getSupabaseUrl: () => "https://abc.supabase.co",
  getSupabaseClient: () => null,
  __resetSupabaseClientForTests: () => {},
}));

import LoginPage from "@/pages/Login";

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

function makeUser(meta: Partial<Pick<User, "app_metadata" | "user_metadata">>): User {
  return {
    id: "u",
    aud: "authenticated",
    created_at: "2025-01-01",
    app_metadata: meta.app_metadata ?? {},
    user_metadata: meta.user_metadata ?? {},
  } as unknown as User;
}

function renderPage(
  value: AuthContextValue = authValue(),
  opts: { from?: string } = {},
) {
  const initialEntries = [
    opts.from !== undefined
      ? { pathname: "/login", state: { from: opts.from } }
      : { pathname: "/login" },
  ];
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthContext.Provider value={value}>
        <RoleProvider>
          <LoginPage />
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

/** Render with a controllable AuthContext for testing post-login transitions. */
function renderControlled() {
  let setAuth: (v: AuthContextValue) => void = () => {};
  function Harness() {
    const [v, set] = useState<AuthContextValue>(authValue({
      signInWithPassword: async () => ({ error: null }),
    }));
    setAuth = set;
    return (
      <MemoryRouter>
        <AuthContext.Provider value={v}>
          <RoleProvider>
            <LoginPage />
          </RoleProvider>
        </AuthContext.Provider>
      </MemoryRouter>
    );
  }
  const utils = render(<Harness />);
  return { ...utils, setAuth: (v: AuthContextValue) => setAuth(v) };
}

beforeEach(() => {
  navigateMock.mockReset();
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

describe("LoginPage", () => {
  it("demo role picker still works and navigates for the selected role", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Ассистент/ }));
    expect(navigateMock).toHaveBeenCalledWith("/capture", { replace: true });
  });

  it("keeps the demo picker visible alongside the real login form", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Вход в Дерматолог Про/ })).toBeInTheDocument();
    expect(screen.getByText(/Выбрать учебную роль/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Дерматолог/ }).length).toBeGreaterThan(0);
  });

  it("after real sign-in with no role metadata, falls back to doctor and navigates /desk", async () => {
    const { setAuth } = renderControlled();
    fireEvent.change(screen.getByLabelText(/эл. почта/i), { target: { value: "doc@x.co" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$|Вход…/ }));

    await act(async () => {
      setAuth(
        authValue({
          status: "authenticated",
          user: makeUser({}),
          accessToken: "tok",
        }),
      );
    });

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });

  it("maps app_metadata.role=clinic_admin and navigates to /admin", async () => {
    const { setAuth } = renderControlled();
    fireEvent.change(screen.getByLabelText(/эл. почта/i), { target: { value: "a@x" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$|Вход…/ }));

    await act(async () => {
      setAuth(
        authValue({
          status: "authenticated",
          user: makeUser({ app_metadata: { role: "clinic_admin" } }),
          accessToken: "tok",
        }),
      );
    });

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/admin", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("clinic_admin");
  });

  it("falls back to user_metadata.role when app_metadata.role missing", async () => {
    const { setAuth } = renderControlled();
    fireEvent.change(screen.getByLabelText(/эл. почта/i), { target: { value: "a@x" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$|Вход…/ }));

    await act(async () => {
      setAuth(
        authValue({
          status: "authenticated",
          user: makeUser({ user_metadata: { role: "operator" } }),
          accessToken: "tok",
        }),
      );
    });

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/operator", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("operator");
  });

  it("unknown role falls back to doctor", async () => {
    const { setAuth } = renderControlled();
    fireEvent.change(screen.getByLabelText(/эл. почта/i), { target: { value: "a@x" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$|Вход…/ }));

    await act(async () => {
      setAuth(
        authValue({
          status: "authenticated",
          user: makeUser({ app_metadata: { role: "ceo" } }),
          accessToken: "tok",
        }),
      );
    });

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });

  it("already-authenticated visit with app_metadata.role=clinic_admin navigates /admin", async () => {
    renderPage(
      authValue({
        status: "authenticated",
        user: makeUser({ app_metadata: { role: "clinic_admin" } }),
        accessToken: "tok",
      }),
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/admin", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("clinic_admin");
  });

  it("already-authenticated visit with unknown role falls back to doctor /desk", async () => {
    renderPage(
      authValue({
        status: "authenticated",
        user: makeUser({ app_metadata: { role: "ceo" } }),
        accessToken: "tok",
      }),
    );
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });

  describe("return-to (Stage 1H-B)", () => {
    const authedDoctor = () =>
      authValue({
        status: "authenticated",
        user: makeUser({ app_metadata: { role: "doctor" } }),
        accessToken: "tok",
      });

    it("returns to allowed from-path after auth", async () => {
      renderPage(authedDoctor(), { from: "/patients/p-1/visits/v-1" });
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith("/patients/p-1/visits/v-1", {
          replace: true,
        }),
      );
    });

    it("ignores from-path the mapped role cannot access; goes to role home", async () => {
      renderPage(authedDoctor(), { from: "/sys/users" });
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
      );
      expect(navigateMock).not.toHaveBeenCalledWith("/sys/users", { replace: true });
    });

    it("ignores absolute external URLs", async () => {
      renderPage(authedDoctor(), { from: "https://evil.test/steal" });
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
      );
    });

    it("ignores protocol-relative URLs starting with //", async () => {
      renderPage(authedDoctor(), { from: "//evil.test/steal" });
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
      );
    });

    it("direct already-authenticated visit (no from) still navigates role home", async () => {
      renderPage(authedDoctor());
      await waitFor(() =>
        expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
      );
    });
  });
});
