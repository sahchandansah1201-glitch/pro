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
      screen.getByRole("combobox", { name: /демо-режим/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /выйти/i })).not.toBeInTheDocument();
  });

  it("shows Выйти when authenticated", () => {
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok" }));
    expect(screen.getByRole("button", { name: /выйти/i })).toBeInTheDocument();
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
});
