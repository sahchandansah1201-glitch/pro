import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { StrictMode } from "react";
import { RoleProvider } from "@/context/RoleContext";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import MeHomePage from "./MeHomePage";
import MeHistoryPage from "./MeHistoryPage";
import MeReportsPage from "./MeReportsPage";
import MeReportPage from "./MeReportPage";
import MeBookingPage from "./MeBookingPage";
import MeRemindersPage from "./MeRemindersPage";

const reportId = "10000000-0000-4000-8000-000000000701";
const visitId = "10000000-0000-4000-8000-000000000301";
const pages = [MeHomePage, MeHistoryPage, MeReportsPage, MeReportPage, MeBookingPage, MeRemindersPage];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function writeSession(token = "synthetic-A", base = "http://localhost:19158") {
  writeSelfHostedApiSession({ apiBaseUrl: base, apiToken: token, user: { id: token, displayName: token,
    roles: ["patient"], roleBindings: [{ role: "patient", clinicId: token, clinicName: "Проверочная клиника", clinicSlug: token }] } });
}
function workingResponse(input: RequestInfo | URL, text = "Данные A") {
  const url = new URL(String(input));
  const report = { id: url.pathname.match(/\/reports\/([^/]+)/)?.[1] ?? reportId, visitId,
    status: "signed", summary: text, patientSafeText: text, physicianText: "Не для пациента", clinic: { name: "Проверочная клиника" }, visitDate: "2026-10-12T09:00:00Z" };
  if (url.pathname === "/api/v1/me/portal") return json({ portal: {
    patient: { id: "synthetic-patient", fullName: text, clinic: { name: "Проверочная клиника" } },
    reports: [report], reminders: [{ id: "test-reminder", title: text, source: "appointment", status: "planned" }],
    reminderPreferences: { appointmentRemindersEnabled: true, reportNotificationsEnabled: true, preferredChannel: "email" },
    bookingRequests: [{ id: "test-request", reason: text, status: "requested" }],
  } });
  if (url.pathname === "/api/v1/me/history") return json({ history: { lesions: [{ id: "test-lesion", title: text }], timeline: [], reports: [] } });
  if (url.pathname.startsWith("/api/v1/me/reports/")) return json({ item: report });
  if (url.pathname === "/api/v1/me/follow-ups") return json({ items: [] });
  if (url.pathname.startsWith("/api/v1/me/photo-protocols/")) return json({ error: { message: "Доступ к фото не открыт" } }, 403);
  return json({ item: { id: "synthetic-write" }, items: [] });
}
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function photoProtocol(reportRef = reportId, visitRef = visitId) {
  return { id: "synthetic-protocol", visitId: visitRef, reportId: reportRef, status: "prepared", expiresAt: "2026-10-20T10:00:00Z",
    deliveryBoundary: { fileProxyReady: true, requiresRetentionPolicy: false, requiresApprovedPatientCopy: false },
    photos: [{ sequence: 1, kind: "overview_photo", lesionLabel: "Проверочное фото" }] };
}
function photoResponse(input: RequestInfo | URL) {
  const url = new URL(String(input));
  if (url.pathname.endsWith("/access/exchange")) return json({ item: { visitId, status: "confirmed", sessionBoundary: { sessionEstablished: true } } });
  if (url.pathname.endsWith("/access/session/end")) return json({ item: { visitId, status: "ended", sessionEnded: true } });
  if (url.pathname.includes("/photos/")) return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "image/png" } });
  if (url.pathname.startsWith("/api/v1/me/photo-protocols/")) return json({ item: photoProtocol() });
  return workingResponse(input);
}
function renderPage(Page: typeof MeHomePage) {
  return render(<RoleProvider><MemoryRouter initialEntries={[`/me/reports/${reportId}`]}>
    <Routes><Route path="/me/reports/:id" element={<Page />} /></Routes>
  </MemoryRouter></RoleProvider>);
}
beforeEach(() => { clearSelfHostedApiSession(); vi.stubEnv("VITE_APP_MODE", "demo"); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Working patient pages", () => {
  it.each(["loading", "error"])("does not claim home data was loaded during %s", async (state) => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async () => { await pending.promise; return json({ error: { message: "Проверочный отказ" } }, 503); }));
    renderPage(MeHomePage);
    await screen.findByText("Загружаем личный кабинет…");
    if (state === "error") { await act(async () => { pending.resolve(); }); await screen.findByRole("alert"); }
    expect(document.body).not.toHaveTextContent("Данные личного кабинета загружены");
    await act(async () => { pending.resolve(); });
  });

  it.each(["booking", "preferences", "reply"])("shows a failed %s write without inventing success or losing the draft", async (kind) => {
    writeSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" || init?.method === "PATCH") return json({ error: { message: "Проверочный отказ записи" } }, 503);
      if (String(input).endsWith("/follow-ups")) return json({ items: [{ id: "test-followup", reason: "Проверочный контроль" }] });
      return workingResponse(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(kind === "booking" ? MeBookingPage : MeRemindersPage);
    await screen.findByText("Данные A");
    const before = fetchMock.mock.calls.length;
    if (kind === "booking") {
      fireEvent.change(screen.getByLabelText("Предпочтительное начало записи"), { target: { value: "2026-10-13T09:00" } });
      fireEvent.change(screen.getByLabelText("Причина запроса на запись"), { target: { value: "Не терять черновик" } });
      fireEvent.click(screen.getByRole("button", { name: "Отправить запрос" }));
    } else if (kind === "reply") {
      fireEvent.change(await screen.findByLabelText("Ответ клинике по контролю Проверочный контроль"), { target: { value: "Не терять черновик" } });
      fireEvent.click(screen.getByRole("button", { name: "Ответить клинике" }));
    } else fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));
    await screen.findByText("Проверочный отказ записи");
    expect(document.body).not.toHaveTextContent("Запрос на запись отправлен");
    expect(document.body).not.toHaveTextContent("Настройки напоминаний сохранены");
    expect(document.body).not.toHaveTextContent("Ответ клинике сохранён");
    const writes = fetchMock.mock.calls.slice(before).filter(([, init]) => init?.method === "POST" || init?.method === "PATCH");
    expect(writes).toHaveLength(1);
    if (kind === "booking") expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("Не терять черновик");
    if (kind === "reply") expect(screen.getByLabelText("Ответ клинике по контролю Проверочный контроль")).toHaveValue("Не терять черновик");
  });

  it("revokes a prepared photo URL before account B loads", async () => {
    writeSession();
    const pending = deferred();
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL { static createObjectURL = vi.fn(() => "blob:synthetic-account-A"); static revokeObjectURL = revoke; });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B") { await pending.promise; return workingResponse(input, "Данные B"); }
      return photoResponse(input);
    }));
    renderPage(MeReportPage);
    fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Загрузить фото 1" }));
    await screen.findByRole("link", { name: "Открыть фото 1" });
    await act(async () => { writeSession("synthetic-B"); });
    expect(revoke).toHaveBeenCalledWith("blob:synthetic-account-A");
    expect(screen.queryByRole("link", { name: "Открыть фото 1" })).toBeNull();
    await act(async () => { pending.resolve(); });
    await screen.findByText("Данные B");
    expect(document.body).not.toHaveTextContent("Доступ подтверждён.");
  });

  it.each(pages)("loads working content under StrictMode", async (Page) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => workingResponse(input)));
    render(<StrictMode><RoleProvider><MemoryRouter initialEntries={[`/me/reports/${reportId}`]}>
      <Routes><Route path="/me/reports/:id" element={<Page />} /></Routes>
    </MemoryRouter></RoleProvider></StrictMode>);
    await screen.findAllByText("Данные A");
    expect(document.body).not.toHaveTextContent("Не для пациента");
  });

  it.each(["report", "exchange", "photo", "end", "prepared"])("retires report A's %s during navigation to report B", async (kind) => {
    writeSession();
    const nextId = "10000000-0000-4000-8000-000000000702";
    const nextVisit = "10000000-0000-4000-8000-000000000302";
    const pending = deferred();
    const create = vi.fn(() => "blob:synthetic-report-A");
    const revoke = vi.fn();
    vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = revoke; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith(`/reports/${nextId}`)) return json({ item: { id: nextId, visitId: nextVisit, patientSafeText: "Данные B" } });
      if (path.includes(nextVisit)) return json({ item: photoProtocol(nextId, nextVisit) });
      if ((kind === "report" && path.endsWith(`/reports/${reportId}`)) ||
          (kind === "exchange" && path.endsWith("/access/exchange")) ||
          (kind === "photo" && path.includes("/photos/")) ||
          (kind === "end" && path.endsWith("/access/session/end"))) await pending.promise;
      return photoResponse(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<RoleProvider><MemoryRouter initialEntries={[`/me/reports/${reportId}`]}>
      <Link to={`/me/reports/${nextId}`}>Следующее заключение</Link>
      <Routes><Route path="/me/reports/:id" element={<MeReportPage />} /></Routes>
    </MemoryRouter></RoleProvider>);
    if (kind !== "report") {
      fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
      fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
      if (kind !== "exchange") {
        await waitFor(() => expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeEnabled());
        if (kind === "photo" || kind === "prepared") {
          fireEvent.click(screen.getByRole("button", { name: "Загрузить фото 1" }));
          if (kind === "prepared") await screen.findByRole("link", { name: "Открыть фото 1" });
          else await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/photos/"))).toBe(true));
        }
        if (kind === "end") fireEvent.click(screen.getByRole("button", { name: "Завершить доступ" }));
      } else await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).endsWith("/access/exchange"))).toBe(true));
    }
    fireEvent.click(screen.getByRole("link", { name: "Следующее заключение" }));
    expect(document.body).not.toHaveTextContent("Данные A");
    await screen.findByText("Данные B");
    await screen.findByLabelText("Одноразовый код доступа");
    await act(async () => { pending.resolve(); });
    expect(document.body).not.toHaveTextContent("Данные A");
    expect(document.body).not.toHaveTextContent("Доступ подтверждён.");
    expect(document.body).not.toHaveTextContent("Доступ к фото завершён.");
    expect(screen.queryByRole("link", { name: "Открыть фото 1" })).toBeNull();
    expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeDisabled();
    if (kind === "prepared") expect(revoke).toHaveBeenCalledWith("blob:synthetic-report-A");
    else expect(create).not.toHaveBeenCalled();
  });

  it("blocks a new access exchange while the previous access is ending", async () => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/access/session/end")) await pending.promise;
      return photoResponse(input);
    }));
    renderPage(MeReportPage);
    fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Завершить доступ" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Завершить доступ" }));
    expect(screen.getByRole("button", { name: "Подтвердить доступ" })).toBeDisabled();
    expect(screen.getByLabelText("Одноразовый код доступа")).toBeDisabled();
    await act(async () => { pending.resolve(); });
  });

  it("does not accept a photo access confirmation for another visit", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/access/exchange")) return json({ item: { visitId: "other-visit", status: "confirmed", sessionBoundary: { sessionEstablished: true } } });
      return photoResponse(input);
    }));
    renderPage(MeReportPage);
    fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeDisabled();
  });

  it.each(pages)("shows only working data and clears it immediately on logout", async (Page) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => workingResponse(input)));
    renderPage(Page);
    await screen.findAllByText("Данные A");
    expect(document.body).not.toHaveTextContent("Не для пациента");
    await act(async () => { clearSelfHostedApiSession(); });
    expect(document.body).not.toHaveTextContent("Данные A");
    expect(await screen.findByRole("link", { name: "Войти" })).toBeInTheDocument();
  });

  it.each(pages)("clears account A before pending B fails", async (Page) => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B") {
        await pending.promise;
        return json({ error: { message: "Проверочный отказ" } }, 503);
      }
      return workingResponse(input);
    }));
    renderPage(Page);
    await screen.findAllByText("Данные A");
    await act(async () => { writeSession("synthetic-B", "http://localhost:19159"); });
    expect(document.body).not.toHaveTextContent("Данные A");
    await act(async () => { pending.resolve(); });
    await screen.findByRole("alert");
    expect(document.body).not.toHaveTextContent("Данные A");
    expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
    expect(screen.queryByLabelText("Одноразовый код доступа")).toBeNull();
  });

  it.each(pages)("ignores an old account response after account B is ready", async (Page) => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A") {
        await pending.promise;
        return workingResponse(input);
      }
      return workingResponse(input, "Данные B");
    }));
    renderPage(Page);
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findAllByText("Данные B");
    await act(async () => { pending.resolve(); });
    expect(document.body).toHaveTextContent("Данные B");
    expect(document.body).not.toHaveTextContent("Данные A");
  });

  it.each([401, 403, 404, 500])("does not replace HTTP%s with training content", async (status) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "Проверочный отказ" } }, status)));
    for (const Page of pages) {
      const { unmount } = renderPage(Page);
      await screen.findByRole("alert");
      expect(screen.queryByRole("button", { name: "Подтвердить запись" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Отправить запрос" })).toBeNull();
      expect(document.body).not.toHaveTextContent("Учебная запись");
      unmount();
    }
  });
  it("does not restore a prepared photo when a late download completes after access ends", async () => {
    writeSession();
    const pending = deferred();
    const create = vi.fn(() => "blob:synthetic-ended-photo");
    vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (new URL(String(input)).pathname.includes("/photos/")) await pending.promise;
      return photoResponse(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(MeReportPage);
    fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Загрузить фото 1" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/photos/"))).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: "Завершить доступ" }));
    await screen.findByText("Доступ к фото завершён. Для нового открытия подтвердите доступ снова.");
    await act(async () => { pending.resolve(); });
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Открыть фото 1" })).toBeNull();
  });
  it.each(["report", "photo"])("rejects mismatched %s identity without displaying foreign content", async (kind) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (kind === "report" && path.includes("/reports/")) return json({ item: { id: "other-report", visitId, patientSafeText: "Чужой текст" } });
      if (kind === "photo" && path.includes("/photo-protocols/")) return json({ item: { ...photoProtocol(reportId, "other-visit"), photos: [{ sequence: 1, kind: "overview_photo", lesionLabel: "Чужой текст" }] } });
      return workingResponse(input);
    }));
    renderPage(MeReportPage);
    if (kind === "report") await screen.findByRole("alert");
    else {
      await screen.findAllByText("Данные A");
      await waitFor(() => expect(document.body).not.toHaveTextContent("Проверяем доступность фотографий…"));
    }
    expect(document.body).not.toHaveTextContent("Чужой текст");
    expect(screen.queryByLabelText("Одноразовый код доступа")).toBeNull();
  });
  it("does not create a photo URL from a response after logout", async () => {
    writeSession();
    const pending = deferred();
    const create = vi.fn(() => "blob:synthetic-photo");
    vi.stubGlobal("URL", class extends URL { static createObjectURL = create; static revokeObjectURL = vi.fn(); });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (new URL(String(input)).pathname.includes("/photos/")) await pending.promise;
      return photoResponse(input);
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(MeReportPage);
    fireEvent.change(await screen.findByLabelText("Одноразовый код доступа"), { target: { value: "synthetic-code" } });
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить доступ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Загрузить фото 1" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Загрузить фото 1" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("/photos/"))).toBe(true));
    await act(async () => { clearSelfHostedApiSession(); });
    await act(async () => { pending.resolve(); });
    expect(create).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "Открыть фото 1" })).toBeNull();
  });
  it.each(["preferences", "reply"])("stops retired reminder %s follow-ups after session change", async (action) => {
    writeSession();
    const pending = deferred();
    const method = action === "preferences" ? "PATCH" : "POST";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === method) { await pending.promise; return workingResponse(input); }
      if (new URL(String(input)).pathname === "/api/v1/me/follow-ups") return json({ items: [{ id: "test-followup", reason: "Проверочный контроль" }] });
      return workingResponse(input, (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A" ? "Данные A" : "Данные B");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(MeRemindersPage);
    await screen.findByText("Данные A");
    if (action === "reply") {
      fireEvent.change(await screen.findByLabelText("Ответ клинике по контролю Проверочный контроль"), { target: { value: "Локальный ответ" } });
      fireEvent.click(screen.getByRole("button", { name: "Ответить клинике" }));
    } else fireEvent.click(screen.getByRole("button", { name: "Сохранить настройки" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === method)).toBe(true));
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findByText("Данные B");
    await screen.findByLabelText("Ответ клинике по контролю Проверочный контроль");
    const afterSwitch = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.slice(afterSwitch)).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("Ответ клинике сохранён.");
    expect(document.body).not.toHaveTextContent("Настройки напоминаний сохранены.");
  });
  it("does not reload the retired patient's portal after a pending booking", async () => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { await pending.promise; return workingResponse(input); }
      return workingResponse(input, (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A" ? "Данные A" : "Данные B");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(MeBookingPage);
    await screen.findByText("Данные A");
    fireEvent.change(screen.getByLabelText("Предпочтительное начало записи"), { target: { value: "2026-10-13T09:00" } });
    fireEvent.change(screen.getByLabelText("Причина запроса на запись"), { target: { value: "Локальная проверка" } });
    fireEvent.click(screen.getByRole("button", { name: "Отправить запрос" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findByText("Данные B");
    const afterSwitch = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.slice(afterSwitch)).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("Запрос на запись отправлен в клинику.");
  });
  it.each(pages.slice(1))("requires working login on the other patient route", async (Page) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/self-hosted/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires working login for the home page instead of training data", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage(MeHomePage);
    expect(await screen.findByRole("link", { name: "Войти" })).toHaveAttribute("href", "/self-hosted/login");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
