import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DeskPage from "./DeskPage";
import VisitsPage from "./VisitsPage";
import DoctorReportsPage from "./DoctorReportsPage";
import { RoleProvider } from "@/context/RoleContext";
import {
  clearSelfHostedApiSession,
  writeSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

function writeSession(name = "Тестовый врач", token = "synthetic-doctor") {
  writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19152", apiToken: token,
    user: { id: token, displayName: name, roles: ["doctor"] } });
}

const patientId = "10000000-0000-4000-8000-000000000201";
const visitId = "10000000-0000-4000-8000-000000000301";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function workingResponse(input: RequestInfo | URL, name = "Проверочная запись") {
  const path = new URL(String(input)).pathname;
  const visit = { id: visitId, patientId, clinicId: "test-clinic", doctorUserId: "test-doctor",
    status: "in_progress", startedAt: "2026-10-12T09:00:00Z", signedAt: null,
    patientFullName: name, clinicName: "Проверочная клиника",
    patient: { id: patientId, fullName: name, code: "TEST-1" },
    clinic: { id: "test-clinic", name: "Проверочная клиника", slug: "test" } };
  if (path === "/api/v1/doctor/dashboard") return json({ dashboard: {
    kpis: { visitsToday: 1, activeVisits: 1, awaitingConclusion: 0, patientsInScope: 1,
      assetsNeedReview: 0, devicesTotal: 0, devicesActive30d: 0 },
    upcoming: [visit], awaitingConclusions: [], recentPatients: [], assetIssues: [], devices: [],
  } });
  if (path === "/api/v1/visits") return json({ items: [visit], count: 1, limit: 50, offset: 0, filters: {} });
  return json({ items: [], kpis: {}, leads: [], appointments: [], filters: {} });
}
function renderPage(Page: typeof DeskPage) {
  return render(<RoleProvider><MemoryRouter><Page /></MemoryRouter></RoleProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  vi.stubEnv("VITE_APP_MODE", "demo");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Working doctor entry pages", () => {
  it.each([undefined, "invalid", "production"])("keeps all doctor entries working-only with mode %s", async (mode) => {
    vi.stubEnv("VITE_APP_MODE", mode);
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input) => workingResponse(input)));
    for (const Page of [DeskPage, VisitsPage, DoctorReportsPage]) {
      const { unmount } = renderPage(Page);
      await screen.findAllByText("Проверочная запись");
      expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём|Учебный режим/);
      unmount();
    }
  });

  it.each([["DeskPage", DeskPage], ["VisitsPage", VisitsPage], ["DoctorReportsPage", DoctorReportsPage]] as const)("%s shows only the authenticated API record and clears it after logout", async (_name, Page) => {
    writeSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => workingResponse(input));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    await screen.findAllByText("Проверочная запись");
    expect(document.querySelector(`a[href*="${visitId}"]`)).not.toBeNull();
    expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём|Учебный режим/);
    expect(fetchMock.mock.calls.every(([, init]) => !init?.method || init.method === "GET")).toBe(true);
    await act(async () => { clearSelfHostedApiSession(); });
    expect(document.body).not.toHaveTextContent("Проверочная запись");
    expect(document.querySelector(`a[href*="${visitId}"]`)).toBeNull();
  });

  it.each([["DeskPage", DeskPage], ["VisitsPage", VisitsPage], ["DoctorReportsPage", DoctorReportsPage]] as const)("%s ignores late results from the previous account after current data is ready", async (_name, Page) => {
    writeSession("Врач A", "synthetic-A");
    let finishOld: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishOld = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A") {
        await pending;
        return workingResponse(input, "Запись аккаунта A");
      }
      return workingResponse(input, "Запись аккаунта B");
    }));
    renderPage(Page);
    expect(document.body).not.toHaveTextContent("Запись аккаунта A");
    await act(async () => { writeSession("Врач B", "synthetic-B"); });
    await screen.findAllByText("Запись аккаунта B");
    await act(async () => { finishOld(); });
    expect(document.body).toHaveTextContent("Запись аккаунта B");
    expect(document.body).not.toHaveTextContent("Запись аккаунта A");
  });

  it.each([401, 403, 404, 500])("does not replace HTTP%s with training visits or reports", async (status) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "unavailable" } }, status)));
    for (const Page of [VisitsPage, DoctorReportsPage]) {
      const { unmount } = renderPage(Page);
      await waitFor(() => expect(screen.queryByText(/Загружаем расписание|Загружаем отчёты/)).not.toBeInTheDocument());
      expect(document.body).toHaveTextContent(status === 401 ? "Войдите снова" : status === 403 ? "Недостаточно прав" : `HTTP ${status}`);
      expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём/);
      expect(document.querySelector("a[href*='/patients/']")).toBeNull();
      unmount();
    }
  });

  it.each([["VisitsPage", VisitsPage], ["DoctorReportsPage", DoctorReportsPage], ["DeskPage", DeskPage]] as const)("%s hides the prior account immediately while a new account loads and fails", async (name, Page) => {
    writeSession("Врач A", "synthetic-A");
    let finishCurrent: () => void = () => {};
    const pending = new Promise<void>((resolve) => { finishCurrent = resolve; });
    vi.stubGlobal("fetch", vi.fn(async (input, init) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B") {
        await pending;
        return json({ error: { code: "service_unavailable" } }, 503);
      }
      return workingResponse(input, "Запись аккаунта A");
    }));
    renderPage(Page);
    await screen.findAllByText("Запись аккаунта A");
    await act(async () => { writeSession("Врач B", "synthetic-B"); });
    expect(document.body).not.toHaveTextContent("Запись аккаунта A");
    expect(document.querySelector(`a[href*="${visitId}"]`)).toBeNull();
    if (name === "VisitsPage") expect(screen.getByText("В расписании: 0")).toBeInTheDocument();
    if (name === "DoctorReportsPage") expect(screen.getByText("В очереди: 0")).toBeInTheDocument();
    await act(async () => { finishCurrent(); });
    expect(document.body).not.toHaveTextContent("Запись аккаунта A");
  });

  it("DoctorReportsPage requires working login even when the old mode flag is demo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage(DoctorReportsPage);
    expect(await screen.findByText("Войдите в систему клиники, чтобы открыть отчёты.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём|Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("VisitsPage requires working login even when the old mode flag is demo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RoleProvider><MemoryRouter><VisitsPage /></MemoryRouter></RoleProvider>);
    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/self-hosted/login");
    expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём|Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("DeskPage requires working login even when the old mode flag is demo", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RoleProvider><MemoryRouter><DeskPage /></MemoryRouter></RoleProvider>);
    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/self-hosted/login");
    expect(document.body).not.toHaveTextContent(/Иванова Наталья|Новиков Артём|Учебный режим/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
