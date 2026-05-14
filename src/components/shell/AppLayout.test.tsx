import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { AppLayout } from "@/components/shell/AppLayout";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

const noop = async () => ({ error: null });

const authValue: AuthContextValue = {
  status: "anonymous",
  session: null,
  user: null,
  accessToken: null,
  apiBaseUrl: null,
  signInWithPassword: noop,
  signInWithGoogle: noop,
  signOut: noop,
};

function renderLayout() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <AuthContext.Provider value={authValue}>
        <RoleProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<div data-testid="content">content</div>} />
            </Route>
          </Routes>
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.removeItem(SELF_HOSTED_API_BASE_URL_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_TOKEN_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_USER_KEY);
});

describe("AppLayout production mode", () => {
  it("renders demo shell controls by default", () => {
    renderLayout();
    expect(screen.getByText(/Демо-режим\. Переключение ролей/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /демо-режим/i })).toBeInTheDocument();
  });

  it("hides demo shell controls and shows self-hosted session in production mode", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-production");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Production Doctor", roles: ["doctor"] }),
    );

    renderLayout();

    expect(screen.queryByText(/Демо-режим\. Переключение ролей/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /демо-режим/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("production-session-chip")).toHaveTextContent("Production Doctor");
    expect(screen.getByRole("button", { name: "Выйти из self-hosted backend" })).toBeInTheDocument();
  });
});
