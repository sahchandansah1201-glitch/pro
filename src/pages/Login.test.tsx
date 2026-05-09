import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

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

function renderPage(value: AuthContextValue = authValue()) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <RoleProvider>
          <LoginPage />
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
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
    expect(screen.getByText(/Войти как/)).toBeInTheDocument();
    // Demo entry for doctor still rendered:
    expect(screen.getAllByRole("button", { name: /Дерматолог/ }).length).toBeGreaterThan(0);
  });

  it("successful real login navigates to the doctor home and stores doctor role", async () => {
    const signInWithPassword = vi.fn(async () => ({ error: null }));
    renderPage(authValue({ signInWithPassword }));

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "doc@x.co" } });
    fireEvent.change(screen.getByLabelText(/пароль/i), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: /^Войти$|Вход…/ }));

    await waitFor(() => expect(signInWithPassword).toHaveBeenCalledWith("doc@x.co", "pw"));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/desk", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });
});
