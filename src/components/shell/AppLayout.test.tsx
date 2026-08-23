import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "@/context/auth-context";
import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
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

function renderLayout(initialEntry = "/") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AuthContext.Provider value={authValue}>
        <RoleProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="*" element={<LocationProbe />} />
            </Route>
          </Routes>
        </RoleProvider>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="content">{location.pathname + location.search}</div>;
}

beforeEach(() => {
  vi.unstubAllEnvs();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
  window.localStorage.removeItem(SELF_HOSTED_API_BASE_URL_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_TOKEN_KEY);
  window.localStorage.removeItem(SELF_HOSTED_API_USER_KEY);
  window.localStorage.removeItem(ROLE_STORAGE_KEY);
});

describe("AppLayout production mode", () => {
  it("renders demo shell controls by default", () => {
    renderLayout();
    expect(screen.getByText(/Учебный режим\. Переключение ролей/)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /учебный режим/i })).toBeInTheDocument();
  });

  it("shows full Body Map entry in the doctor sidebar", () => {
    renderLayout();
    const link = screen.getByRole("link", { name: /Карта тела/ });
    expect(link).toHaveAttribute("href", "/patients/p-004/visits/v-005?tab=bodymap");
  });

  it("shows the doctor reports center entry in the doctor sidebar", () => {
    renderLayout();
    const link = screen.getByRole("link", { name: /^Отчёты$/ });
    expect(link).toHaveAttribute("href", "/reports");
  });

  it("shows patient lesion history entry only in patient sidebar", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "patient");
    const { unmount } = renderLayout();
    expect(screen.getByRole("link", { name: /История очагов/ })).toHaveAttribute(
      "href",
      "/me/history",
    );

    unmount();
    window.localStorage.setItem(ROLE_STORAGE_KEY, "doctor");
    renderLayout();
    expect(screen.queryByRole("link", { name: /История очагов/ })).not.toBeInTheDocument();
  });

  it("shows the admin operating center entry for clinic admin", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "clinic_admin");
    renderLayout();
    const link = screen.getByRole("link", { name: /Операционный центр/ });
    expect(link).toHaveAttribute("href", "/admin");
    expect(screen.getByRole("link", { name: /Управление доступом/ })).toHaveAttribute(
      "href",
      "/admin/governance",
    );
    expect(screen.queryByRole("link", { name: /^Обзор$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Помощник записи" })).toHaveAttribute(
      "href",
      "/admin/bot",
    );
  });

  it("merges the operator support group with shared help instead of duplicating it", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "operator");
    renderLayout("/operator");

    expect(screen.getAllByText("Поддержка")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Очередь диалогов/ })).toHaveAttribute("href", "/operator");
    expect(screen.getByRole("link", { name: /Справка/ })).toHaveAttribute("href", "/help");
  });

  it("marks only the most specific admin sidebar entry as active", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "clinic_admin");
    renderLayout("/admin/governance");

    expect(screen.getByRole("link", { name: /Операционный центр/ })).toHaveAttribute(
      "data-active",
      "false",
    );
    expect(screen.getByRole("link", { name: /Управление доступом/ })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("marks body map active without also marking the generic patients entry active", () => {
    renderLayout("/patients/p-004/visits/v-005?tab=bodymap");

    expect(screen.getByRole("link", { name: /^Пациенты$/ })).toHaveAttribute(
      "data-active",
      "false",
    );
    expect(screen.getByRole("link", { name: /Карта тела/ })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("shows the private practice center entry only for private doctor", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "private_doctor");
    const { unmount } = renderLayout();
    expect(screen.getByRole("link", { name: /Центр практики/ })).toHaveAttribute(
      "href",
      "/practice",
    );

    unmount();
    window.localStorage.setItem(ROLE_STORAGE_KEY, "doctor");
    renderLayout();
    expect(screen.queryByRole("link", { name: /Центр практики/ })).not.toBeInTheDocument();
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

    expect(screen.queryByText(/Учебный режим\. Переключение ролей/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /учебный режим/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("production-session-chip")).toHaveTextContent("Production Doctor");
    expect(screen.getByRole("button", { name: "Выйти из рабочей системы" })).toBeInTheDocument();
  });

  it("does not expose demo doctor routes in production navigation", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-production");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Production Doctor", roles: ["doctor"] }),
    );

    renderLayout();

    expect(screen.queryByRole("link", { name: /Карта тела/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Рабочее место врача/ })).not.toBeInTheDocument();
  });

  it("routes a production doctor global search into the patient list", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-production");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-1", displayName: "Production Doctor", roles: ["doctor"] }),
    );
    renderLayout("/desk");

    fireEvent.change(screen.getByRole("searchbox", { name: "Глобальный поиск" }), {
      target: { value: "Тестовый пациент" },
    });
    fireEvent.submit(screen.getByRole("search", { name: "Глобальный поиск" }));

    expect(screen.getByTestId("content")).toHaveTextContent(
      "/patients?search=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D1%8B%D0%B9%20%D0%BF%D0%B0%D1%86%D0%B8%D0%B5%D0%BD%D1%82",
    );
  });

  it("closes the mobile navigation after a route is selected", async () => {
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    renderLayout();

    fireEvent.click(screen.getByRole("button", { name: "Переключить боковую панель" }));
    const dialog = await screen.findByRole("dialog", { name: "Основная навигация" });
    fireEvent.click(within(dialog).getByRole("link", { name: "Пациенты" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Основная навигация" })).not.toBeInTheDocument(),
    );
  });
});
