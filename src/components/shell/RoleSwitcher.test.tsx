import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import { writeSelfHostedApiSession, readSelfHostedApiSession } from "@/lib/self-hosted-api-session";

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
  window.localStorage.clear();
  vi.unstubAllEnvs();
  try {
    window.localStorage.removeItem(ROLE_STORAGE_KEY);
  } catch {
    // ignore
  }
});

describe("RoleSwitcher", () => {
  it("waits for pending authentication before allowing logout of a selected account", () => {
    writeSelfHostedApiSession({ apiToken: "synthetic-selected-token", user: {
      id: "synthetic-doctor", displayName: "Тестовый врач", roles: ["doctor"],
    } });
    renderSwitcher(authValue({ status: "loading" }));
    const button = screen.getByRole("button", { name: "Выйти из рабочей системы" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(readSelfHostedApiSession().apiToken).toBe("synthetic-selected-token");
    expect(navigateMock).not.toHaveBeenCalled();
  });
  it("signs out the restored account after loading completes without clearing the selected account early", async () => {
    writeSelfHostedApiSession({ apiToken: "synthetic-selected-token", user: {
      id: "synthetic-doctor", displayName: "Тестовый врач", roles: ["doctor"],
    } });
    const signOut = vi.fn(async () => ({ error: null }));
    const view = (value: AuthContextValue) => (
      <MemoryRouter><AuthContext.Provider value={value}><RoleProvider><RoleSwitcher /></RoleProvider></AuthContext.Provider></MemoryRouter>
    );
    const rendered = render(view(authValue({ status: "loading", signOut })));
    fireEvent.click(screen.getByRole("button", { name: "Выйти из рабочей системы" }));
    expect(readSelfHostedApiSession().apiToken).toBe("synthetic-selected-token");
    expect(signOut).not.toHaveBeenCalled();
    rendered.rerender(view(authValue({ status: "authenticated", accessToken: "synthetic-restored-token", signOut })));
    fireEvent.click(screen.getByRole("button", { name: "Выйти из рабочей системы" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(readSelfHostedApiSession().apiToken).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith("/self-hosted/login", { replace: true });
  });
  it("signs out a dormant Supabase session before clearing the selected self-hosted account", async () => {
    writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:8080", apiToken: "synthetic-dual-token", user: {
      id: "synthetic-doctor", displayName: "Тестовый врач", roles: ["doctor"],
    } });
    const signOut = vi.fn(async () => ({ error: null }));
    renderSwitcher(authValue({ status: "authenticated", accessToken: "synthetic-supabase", signOut }));
    fireEvent.click(screen.getByRole("button", { name: "Выйти из рабочей системы" }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(readSelfHostedApiSession().apiToken).toBeNull();
    expect(readSelfHostedApiSession().apiBaseUrl).toBe("http://localhost:8080");
    expect(navigateMock).toHaveBeenCalledWith("/self-hosted/login", { replace: true });
  });
  it("never renders an arbitrary role picker", () => {
    renderSwitcher();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps the selected account if the other real session cannot sign out", async () => {
    writeSelfHostedApiSession({ apiToken: "synthetic-kept-token", user: {
      id: "synthetic-admin", displayName: "Тестовый администратор", roles: ["clinic_admin"],
    } });
    renderSwitcher(authValue({ status: "authenticated", accessToken: "synthetic-supabase", signOut: async () => ({ error: new Error("synthetic failure") }) }));
    fireEvent.click(screen.getByRole("button", { name: "Выйти из рабочей системы" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось выйти");
    expect(readSelfHostedApiSession().apiToken).toBe("synthetic-kept-token");
    expect(navigateMock).not.toHaveBeenCalled();
  });
  it("renders no role select or logout without a working account", () => {
    renderSwitcher();
    expect(
      screen.queryByRole("combobox"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /выйти/i })).not.toBeInTheDocument();
  });

  it("keeps a stale training administrator role out of the account controls", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "system_admin");
    renderSwitcher();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByText("Нет рабочего входа")).toBeInTheDocument();
  });

  it("marks the account as disconnected when anonymous", () => {
    renderSwitcher();
    expect(screen.queryByText(/Вход активен/)).not.toBeInTheDocument();
    expect(screen.getByTestId("auth-session-chip")).toHaveAttribute("aria-label", "Рабочий вход не подключён");
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
    expect(chip).toHaveTextContent("doc@x.co");
    expect(chip.getAttribute("aria-label")).toMatch(/doc@x\.co/);
  });

  it("clicking Выйти calls signOut, does not invent a role and navigates /login", async () => {
    const signOut = vi.fn(async () => ({ error: null }));
    window.localStorage.setItem(ROLE_STORAGE_KEY, "operator");
    renderSwitcher(authValue({ status: "authenticated", accessToken: "tok", signOut }));

    fireEvent.click(screen.getByRole("button", { name: /выйти/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true }),
    );
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("operator");
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
    expect(window.localStorage.getItem(ROLE_STORAGE_KEY)).toBe("operator");
  });
});
