import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import App from "./App";

const scrollToDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
  window.localStorage.clear();
  vi.stubEnv("VITE_APP_MODE", "production");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "Проверочный отказ" } }), { status: 503, headers: { "Content-Type": "application/json" } })));
});
afterEach(() => {
  cleanup(); window.localStorage.clear(); window.history.replaceState({}, "", "/"); vi.unstubAllGlobals(); vi.unstubAllEnvs();
  if (scrollToDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollTo", scrollToDescriptor);
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollTo");
});
describe("Retired simulator route", () => {
  it.each(["anonymous", "patient", "doctor", "assistant", "operator", "clinic_admin", "system_admin", "private_doctor"])("does not mount the simulator for %s", async (role) => {
    if (role !== "anonymous") writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19171", apiToken: "synthetic-patient",
      user: { id: "synthetic-patient", displayName: "Проверочный пациент", roles: [role] } });
    window.history.replaceState({}, "", "/bot-sim");
    render(<App />);
    expect(await screen.findByText("Страница не найдена")).toBeInTheDocument();
    expect(screen.queryByText(/Учебный помощник/)).toBeNull();
  });

  it("keeps the working patient form at its exact old child address", async () => {
    writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19171", apiToken: "synthetic-patient",
      user: { id: "synthetic-patient", displayName: "Проверочный пациент", roles: ["patient"] } });
    window.history.replaceState({}, "", "/bot-sim/miniapp/booking"); render(<App />);
    expect(await screen.findByRole("heading", { name: "Помощник записи" })).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить данные записи");
    expect(screen.queryByText("Страница не найдена")).toBeNull();
  });

  it("requires login before mounting the working child route", async () => {
    window.history.replaceState({}, "", "/bot-sim/miniapp/booking"); render(<App />);
    expect(await screen.findByLabelText("Эл. почта")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/self-hosted/login");
    expect(screen.queryByRole("heading", { name: "Помощник записи" })).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["doctor", "assistant", "operator", "clinic_admin", "system_admin", "private_doctor"])("does not grant %s a patient form or portal read", async (role) => {
    writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19171", apiToken: "synthetic-user",
      user: { id: "synthetic-user", displayName: "Проверочный сотрудник", roles: [role] } });
    window.history.replaceState({}, "", "/bot-sim/miniapp/booking"); render(<App />);
    expect(await screen.findByRole("heading", { name: "Нет доступа" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Помощник записи" })).toBeNull();
    expect(vi.mocked(fetch).mock.calls.some(([input]) => String(input).endsWith("/api/v1/me/portal"))).toBe(false);
  });
});
