import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import { RoleHome } from "@/components/shell/RoleHome";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

function renderHome() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <RoleProvider>
        <Routes>
          <Route path="/" element={<RoleHome />} />
          <Route path="/desk" element={<div data-testid="desk">desk</div>} />
          <Route path="/sys/users" element={<div data-testid="sys">sys</div>} />
          <Route path="/self-hosted/login" element={<div data-testid="login">login</div>} />
        </Routes>
      </RoleProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_BASE_URL_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_TOKEN_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_USER_KEY);
});

describe("RoleHome", () => {
  it("uses the demo role home path in demo mode", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "doctor");
    renderHome();
    expect(screen.getByTestId("desk")).toBeInTheDocument();
  });

  it("requires self-hosted login in production mode", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    renderHome();
    expect(screen.getByTestId("login")).toBeInTheDocument();
  });

  it("uses backend role home path in production mode", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-production");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Admin", roles: ["system_admin"] }),
    );
    renderHome();
    expect(screen.getByTestId("sys")).toBeInTheDocument();
  });
});
