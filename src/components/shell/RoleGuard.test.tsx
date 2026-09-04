// Stage 1H-A · RoleGuard tests covering both the demo-only and the
// auth-aware code paths.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

// Configure mock per-test by mutating this flag.
let configured = false;
vi.mock("@/lib/supabase-client", () => ({
  isSupabaseConfigured: () => configured,
  getSupabaseUrl: () => (configured ? "https://abc.supabase.co" : null),
  getSupabaseClient: () => null,
  __resetSupabaseClientForTests: () => {},
}));

import { RoleGuard } from "@/components/shell/RoleGuard";

const patientLoader = vi.fn();

function PatientLoaderProbe() {
  patientLoader();
  return <div data-testid="patient-loader">PATIENT LOADER</div>;
}

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
            <Route
              path="/patients/:patientId"
              element={
                <RoleGuard>
                  <PatientLoaderProbe />
                </RoleGuard>
              }
            />
            <Route path="/admin" element={<div data-testid="admin-page">ADMIN</div>} />
            <Route path="/operator" element={<div data-testid="operator-page">OPERATOR</div>} />
            <Route path="/login" element={<div data-testid="login-page">LOGIN</div>} />
            <Route path="/self-hosted/login" element={<div data-testid="self-hosted-login">SELF HOSTED LOGIN</div>} />
          </Routes>
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.unstubAllEnvs();
  configured = false;
  patientLoader.mockClear();
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
    window.localStorage.removeItem(SELF_HOSTED_API_BASE_URL_KEY);
    window.localStorage.removeItem(SELF_HOSTED_API_TOKEN_KEY);
    window.localStorage.removeItem(SELF_HOSTED_API_USER_KEY);
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
    expect(screen.getByText(/Нет доступа в учебном режиме/)).toBeInTheDocument();
  });

  it("обозначает название учебного состояния запрета заголовком первого уровня", () => {
    renderAt("/sys/users", authValue(), "doctor");

    expect(
      screen.getByRole("heading", { level: 1, name: "Нет доступа в учебном режиме" }),
    ).toBeInTheDocument();
  });
});

describe("RoleGuard · configured + auth-aware", () => {
  it("renders the loading state while auth status is loading", () => {
    configured = true;
    renderAt("/desk", authValue({ status: "loading" }), "doctor");
    expect(screen.getByText(/Проверяем вход/)).toBeInTheDocument();
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
    expect(screen.getByText(/Нет доступа в учебном режиме/)).toBeInTheDocument();
  });
});

describe("RoleGuard · production self-hosted mode", () => {
  function writeSelfHostedSession(roles: string[]) {
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-production");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Production User", roles }),
    );
  }

  it("redirects missing self-hosted sessions to /self-hosted/login", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    renderAt("/desk", authValue(), "doctor");
    expect(screen.getByTestId("self-hosted-login")).toBeInTheDocument();
    expect(screen.queryByTestId("protected")).not.toBeInTheDocument();
  });

  it("allows access using backend roles instead of the demo role", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["system_admin"]);
    renderAt("/sys/users", authValue(), "doctor");
    expect(screen.getByTestId("protected-sys")).toBeInTheDocument();
  });

  it("denies access without exposing demo role switching", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["doctor"]);
    renderAt("/sys/users", authValue(), "system_admin");
    expect(screen.getByText("Нет доступа")).toBeInTheDocument();
    expect(screen.getByText(/Права доступа определяются активным рабочим входом/i)).toBeInTheDocument();
    expect(screen.queryByText(/Сменить учебную роль/i)).not.toBeInTheDocument();
    expect(document.body.textContent || "").not.toMatch(/self-hosted|production|backend|демо/i);
  });

  it("blocks a clinic administrator before the clinical patient screen mounts", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["clinic_admin"]);

    renderAt("/patients/patient-1", authValue(), "doctor");

    expect(screen.getByRole("heading", { name: "Нет доступа к клиническим данным" })).toBeInTheDocument();
    expect(
      screen.getByText("Этот раздел доступен только сотрудникам с клиническим доступом."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("patient-loader")).not.toBeInTheDocument();
    expect(patientLoader).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Вернуться к рабочему экрану" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Войти под другой учётной записью" })).toBeInTheDocument();
  });

  it("clears the working identity but keeps the API address before another login", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["clinic_admin"]);
    renderAt("/patients/patient-1", authValue(), "doctor");

    fireEvent.click(screen.getByRole("button", { name: "Войти под другой учётной записью" }));

    expect(screen.getByTestId("self-hosted-login")).toBeInTheDocument();
    expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBeNull();
    expect(window.localStorage.getItem(SELF_HOSTED_API_USER_KEY)).toBeNull();
    expect(window.localStorage.getItem(SELF_HOSTED_API_BASE_URL_KEY)).toBe("http://localhost:8080");
  });

  it("returns a blocked clinic administrator to the administration area", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["clinic_admin"]);
    renderAt("/patients/patient-1", authValue(), "doctor");

    fireEvent.click(screen.getByRole("button", { name: "Вернуться к рабочему экрану" }));

    expect(screen.getByTestId("admin-page")).toBeInTheDocument();
    expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBe("jwt-production");
  });

  it("returns a blocked operator to the operator home without implying doctor-only access", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["operator"]);
    renderAt("/patients/patient-1", authValue(), "doctor");

    expect(
      screen.getByText("Этот раздел доступен только сотрудникам с клиническим доступом."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Вернуться к рабочему экрану" }));

    expect(screen.getByTestId("operator-page")).toBeInTheDocument();
    expect(window.localStorage.getItem(SELF_HOSTED_API_TOKEN_KEY)).toBe("jwt-production");
  });

  it("moves focus to the production denial heading", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(["clinic_admin"]);
    renderAt("/patients/patient-1", authValue(), "doctor");

    expect(screen.getByRole("heading", { name: "Нет доступа к клиническим данным" })).toHaveFocus();
  });

  it.each([
    ["doctor"],
    ["private_doctor"],
    ["clinic_admin", "private_doctor"],
  ])("keeps the clinical screen available for the session roles %j", (...roles) => {
    vi.stubEnv("VITE_APP_MODE", "production");
    writeSelfHostedSession(roles);

    renderAt("/patients/patient-1", authValue(), "clinic_admin");

    expect(screen.getByTestId("patient-loader")).toBeInTheDocument();
    expect(patientLoader).toHaveBeenCalledTimes(1);
  });
});
