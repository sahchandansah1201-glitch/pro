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

function writeWorkingRoles(roles: string[]) {
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "synthetic-navigation-token");
  window.localStorage.setItem(SELF_HOSTED_API_USER_KEY, JSON.stringify({
    id: "synthetic-navigation-user", displayName: "Тестовый сотрудник", roles,
  }));
}

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
  it("never shows training controls or clinical navigation without a real session", () => {
    window.localStorage.setItem(ROLE_STORAGE_KEY, "system_admin");
    renderLayout();
    expect(screen.queryByText(/Учебный режим/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Пациенты" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Сотрудники и доступ" })).not.toBeInTheDocument();
  });
  it("shows no training controls by default", () => {
    renderLayout();
    expect(screen.queryByText(/Учебный режим/)).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("keeps the doctor visit body map contextual rather than linking to a training patient", () => {
    writeWorkingRoles(["doctor"]);
    renderLayout();
    expect(screen.queryByRole("link", { name: /Карта тела/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Пациенты" })).toHaveAttribute("href", "/patients");
  });

  it("shows the doctor reports center entry in the doctor sidebar", () => {
    writeWorkingRoles(["doctor"]);
    renderLayout();
    const link = screen.getByRole("link", { name: /^Отчёты$/ });
    expect(link).toHaveAttribute("href", "/reports");
  });

  it("shows patient lesion history entry only in patient sidebar", () => {
    writeWorkingRoles(["patient"]);
    const { unmount } = renderLayout();
    expect(screen.getByRole("link", { name: /История очагов/ })).toHaveAttribute(
      "href",
      "/me/history",
    );

    unmount();
    writeWorkingRoles(["doctor"]);
    renderLayout();
    expect(screen.queryByRole("link", { name: /История очагов/ })).not.toBeInTheDocument();
  });

  it("shows the admin operating center entry for clinic admin", () => {
    writeWorkingRoles(["clinic_admin"]);
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
    writeWorkingRoles(["operator"]);
    renderLayout("/operator");

    expect(screen.getAllByText("Поддержка")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Заявки" })).toHaveAttribute("href", "/operator");
    expect(screen.getByRole("link", { name: /Справка/ })).toHaveAttribute("href", "/help");
  });

  it("marks only the most specific admin sidebar entry as active", () => {
    writeWorkingRoles(["clinic_admin"]);
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

  it("marks patients active for its contextual body map route", () => {
    writeWorkingRoles(["doctor"]);
    renderLayout("/patients/p-004/visits/v-005?tab=bodymap");

    expect(screen.getByRole("link", { name: /^Пациенты$/ })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.queryByRole("link", { name: /Карта тела/ })).not.toBeInTheDocument();
  });

  it("shows the private practice center entry only for private doctor", () => {
    writeWorkingRoles(["private_doctor"]);
    const { unmount } = renderLayout();
    expect(screen.getByRole("link", { name: /Центр практики/ })).toHaveAttribute(
      "href",
      "/practice",
    );

    unmount();
    writeWorkingRoles(["doctor"]);
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

  it("shows and activates services in the production system administrator navigation", () => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "synthetic-navigation-token");
    window.localStorage.setItem(
      SELF_HOSTED_API_USER_KEY,
      JSON.stringify({ id: "u-system", displayName: "Тестовый системный администратор", roles: ["system_admin"] }),
    );

    renderLayout("/admin/services");

    const navigation = screen.getByRole("navigation", { name: "Основная навигация" });
    const servicesLink = within(navigation).getByRole("link", { name: "Услуги" });
    expect(servicesLink).toHaveAttribute("href", "/admin/services");
    expect(servicesLink).toHaveAttribute("data-active", "true");
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

    fireEvent.change(screen.getByRole("searchbox", { name: "Поиск пациентов" }), {
      target: { value: "Тестовый пациент" },
    });
    fireEvent.submit(screen.getByRole("search", { name: "Поиск пациентов" }));

    expect(screen.getByTestId("content")).toHaveTextContent(
      "/patients?search=%D0%A2%D0%B5%D1%81%D1%82%D0%BE%D0%B2%D1%8B%D0%B9%20%D0%BF%D0%B0%D1%86%D0%B8%D0%B5%D0%BD%D1%82",
    );
  });

  it("closes the mobile navigation after a route is selected", async () => {
    writeWorkingRoles(["doctor"]);
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
