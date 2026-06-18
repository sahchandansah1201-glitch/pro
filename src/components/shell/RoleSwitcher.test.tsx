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

import { RoleSwitcher } from "@/components/shell/RoleSwitcher";

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

function renderSwitcher(value: AuthContextValue = authValue()) {
  return render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <RoleProvider>
          <RoleSwitcher />
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

describe("RoleSwitcher", () => {
  it("renders the role select in anonymous state without a logout button", () => {
    renderSwitcher();
    expect(
      screen.getByRole("combobox", { name: /учебный режим/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /выйти/i })).not.toBeInTheDocument();
  });

  it("does not show the session chip when anonymous", () => {
    renderSwitcher();
    expect(screen.queryByText(/Вход активен/)).not.toBeInTheDocument();
    expect(screen.queryByTestId("auth-session-chip")).not.toBeInTheDocument();
  });

  it("shows Выйти when authenticated", () => {
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok" }));
    expect(screen.getByRole("button", { name: /выйти/i })).toBeInTheDocument();
  });

  it("shows the session chip when authenticated", () => {
    renderSwitcher(
      authValue({
        status: "authenticated",
        accessToken: "tok",
        user: { id: "u", email: "doc@x.co" } as never,
      }),
    );
    const chip = screen.getByTestId("auth-session-chip");
    expect(chip).toBeInTheDocument();
    expect(chip).toHaveTextContent(/Вход активен/);
    expect(chip.getAttribute("aria-label")).toMatch(/doc@x\.co/);
  });

  it("clicking Выйти calls signOut, resets role to doctor and navigates /login", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    window.localStorage.setItem(ROLE_STORAGE_KEY, "operator");
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok", signOut }));

    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });

  it("disables Выйти while signOut is pending", async () => {
    let resolve: (v: { error: null }) => void = () => {};
    const signOut = vi.fn(
      () => new Promise<{ error: null }>((r) => { resolve = r; }),
    );
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok", signOut }));

    const btn = screen.getByRole("button", { name: /выйти/i }) as HTMLButtonElement;
    fireEvent.click(btn);
    await waitFor(() => expect(btn).toBeDisabled());
    expect(btn).toHaveTextContent(/Выход…/);

    resolve({ error: null });
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true }),
    );
  });

  it("shows an inline error and does not navigate when signOut fails", async () => {
    const signOut = vi.fn(async () => ({ error: new Error("boom") }));
    window.localStorage.setItem(ROLE_STORAGE_KEY, "operator");
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok", signOut }));

    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText(/Не удалось выйти\. Попробуйте ещё раз\./),
    ).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("operator");
  });

  it("retry after a failed logout clears the error and navigates", async () => {
    let call = 0;
    const signOut = vi.fn(async () => {
      call += 1;
      return call === 1 ? { error: new Error("boom") } : { error: null };
    });
    window.localStorage.setItem(ROLE_STORAGE_KEY, "operator");
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok", signOut }));

    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));
    expect(
      await screen.findByText(/Не удалось выйти\. Попробуйте ещё раз\./),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));

    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(
      screen.queryByText(/Не удалось выйти\. Попробуйте ещё раз\./),
    ).not.toBeInTheDocument();
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("doctor");
  });
});
