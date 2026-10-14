import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { StrictMode } from "react";
import { RoleProvider } from "@/context/RoleContext";
import OperatorConsolePage from "./OperatorConsolePage";
import OperatorBookingRequestsPage from "./OperatorBookingRequestsPage";
import OperatorDialogPage from "./OperatorDialogPage";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";

const requestId = "10000000-0000-4000-8000-000000000501";
const pages = [OperatorConsolePage, OperatorBookingRequestsPage, OperatorDialogPage];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "Content-Type": "application/json" },
});
function writeSession(token = "synthetic-A", name = "Оператор A", base = "http://localhost:19156") {
  writeSelfHostedApiSession({ apiBaseUrl: base, apiToken: token,
    user: { id: token, displayName: name, roles: ["operator"],
      roleBindings: [{ role: "operator", clinicId: token, clinicName: name, clinicSlug: token }] } });
}
function workingResponse(input: RequestInfo | URL, name = "Запись A") {
  const path = new URL(String(input)).pathname;
  const patient = { id: "10000000-0000-4000-8000-000000000201", fullName: name, code: "TEST-1" };
  const clinic = { id: "test-clinic", slug: "test", name: "Проверочная клиника" };
  const request = { id: path.match(/booking-requests\/([^/]+)/)?.[1] ?? requestId, patient, clinic, patientId: patient.id, clinicId: clinic.id,
    status: "requested", reason: name, clinicNote: null, preferredFrom: null, preferredTo: null,
    createdAt: "2026-10-12T09:00:00Z", updatedAt: "2026-10-12T09:00:00Z" };
  if (path === "/api/v1/leads/appointments") return json({ leads: [{
    id: requestId, patient, clinic, status: "new", source: "operator", safeSummary: name,
    patientId: patient.id, clinicId: clinic.id, createdAt: request.createdAt, updatedAt: request.updatedAt,
  }], appointments: [], kpis: { leadsTotal: 1, newLeads: 1, qualifiedLeads: 0, bookedLeads: 0,
    plannedAppointments: 0, completedAppointments: 0 }, filters: {} });
  if (path === "/api/v1/clinic/booking-requests") return json({ items: [request], count: 1 });
  if (path.startsWith("/api/v1/clinic/booking-requests/")) return json({ item: request });
  return json({ items: [], count: 0, filters: {} });
}
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function renderPage(Page: typeof OperatorConsolePage) {
  return render(<RoleProvider><MemoryRouter initialEntries={[`/operator/dialogs/${requestId}`]}>
    <Routes><Route path="/operator/dialogs/:id" element={<Page />} /></Routes>
  </MemoryRouter></RoleProvider>);
}

beforeEach(() => {
  clearSelfHostedApiSession();
  vi.stubEnv("VITE_APP_MODE", "demo");
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Working operator routes", () => {
  it.each(["PATCH", "POST"])("stops retired booking follow-ups after a pending %s", async (method) => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === method) { await pending.promise; return workingResponse(input); }
      if (new URL(String(input)).pathname === "/api/v1/clinic/available-slots") return json({ items: [{
        id: "test-slot", sourceSystem: "manual", status: "available", startedAt: "2026-10-13T09:00:00Z",
        durationMinutes: 30, doctor: { displayName: "Проверочный врач" },
      }], count: 1 });
      return workingResponse(input, (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A" ? "Запись A" : "Запись B");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(OperatorBookingRequestsPage);
    await screen.findByText("Данные загружены из системы клиники.");
    if (method === "PATCH") fireEvent.click(screen.getByRole("button", { name: "Взять в работу заявку: Запись A" }));
    else {
      fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись: Запись A" }));
      fireEvent.change(screen.getByLabelText("Свободное окно для записи"), { target: { value: "test-slot" } });
      fireEvent.click(screen.getByRole("button", { name: "Подтвердить запись" }));
    }
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === method)).toBe(true));
    await act(async () => { writeSession("synthetic-B", "Оператор B"); });
    await screen.findAllByText("Запись B");
    const afterSwitch = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.slice(afterSwitch)).toHaveLength(0);
    expect(document.body).not.toHaveTextContent("Запись A");
    expect(document.body).not.toHaveTextContent("Заявка записана на визит.");
  });

  it("keeps a failed earlier booking write visible without changing the newly selected draft", async () => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") { await pending.promise; return json({ error: { message: "Запись не сохранена" } }, 503); }
      const result = await workingResponse(input);
      const body = await result.json();
      if (new URL(String(input)).pathname === "/api/v1/clinic/booking-requests") {
        body.items.push({ ...body.items[0], id: "10000000-0000-4000-8000-000000000502", patient: { ...body.items[0].patient, fullName: "Выбор B" } });
      }
      return json(body);
    }));
    renderPage(OperatorBookingRequestsPage);
    await screen.findByText("Данные загружены из системы клиники.");
    fireEvent.click(screen.getByRole("button", { name: "Взять в работу заявку: Запись A" }));
    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись: Выбор B" }));
    fireEvent.change(screen.getByLabelText("Заметка клиники по заявке"), { target: { value: "Черновик B" } });
    await act(async () => { pending.resolve(); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Запись не сохранена");
    expect(screen.getByLabelText("Заметка клиники по заявке")).toHaveValue("Черновик B");
  });

  it.each(["GET", "PATCH"])("ignores delayed %s after opening another dialog ID", async (method) => {
    writeSession();
    const pending = deferred();
    const otherId = "10000000-0000-4000-8000-000000000502";
    let hold = method === "GET";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith(requestId) && hold) await pending.promise;
      return workingResponse(input, path.endsWith(otherId) ? "Карточка B" : "Запись A");
    }));
    render(<RoleProvider><MemoryRouter initialEntries={[`/operator/dialogs/${requestId}`]}>
      <Link to={`/operator/dialogs/${otherId}`}>Другая карточка</Link>
      <Routes><Route path="/operator/dialogs/:id" element={<OperatorDialogPage />} /></Routes>
    </MemoryRouter></RoleProvider>);
    if (method === "PATCH") {
      await screen.findAllByText("Запись A");
      hold = true;
      fireEvent.change(screen.getByLabelText("Заметка клиники по обращению"), { target: { value: "Заметка A" } });
      fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
    }
    fireEvent.click(screen.getByRole("link", { name: "Другая карточка" }));
    await screen.findAllByText("Карточка B");
    fireEvent.change(screen.getByLabelText("Заметка клиники по обращению"), { target: { value: "Черновик B" } });
    await act(async () => { pending.resolve(); });
    expect(document.body).not.toHaveTextContent("Запись A");
    expect(document.body).not.toHaveTextContent("Заметка сохранена.");
    expect(screen.getByLabelText("Заметка клиники по обращению")).toHaveValue("Черновик B");
  });

  it.each(pages)("shows working API data and clears it immediately on logout", async (Page) => {
    writeSession();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => workingResponse(input));
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    await screen.findAllByText("Запись A");
    expect(document.body).not.toHaveTextContent("Обращение 001");
    await act(async () => { clearSelfHostedApiSession(); });
    expect(document.body).not.toHaveTextContent("Запись A");
    expect(screen.queryByLabelText("Заметка клиники по заявке")).toBeNull();
  });

  it.each(pages)("clears ready account A before a pending account B fails", async (Page) => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B") {
        await pending.promise;
        return json({ error: { message: "Отказ новой сессии" } }, 503);
      }
      return workingResponse(input);
    }));
    renderPage(Page);
    await screen.findAllByText("Запись A");
    await act(async () => { writeSession("synthetic-B", "Оператор B", "http://localhost:19157"); });
    expect(document.body).not.toHaveTextContent("Запись A");
    await act(async () => { pending.resolve(); });
    expect(await screen.findByRole("alert")).toHaveTextContent("Отказ новой сессии");
    expect(document.body).not.toHaveTextContent("Запись A");
  });

  it.each(pages)("ignores delayed old-session data after the new account is ready", async (Page) => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A") {
        await pending.promise;
        return workingResponse(input);
      }
      return workingResponse(input, "Запись B");
    }));
    renderPage(Page);
    await act(async () => { writeSession("synthetic-B", "Оператор B"); });
    await screen.findAllByText("Запись B");
    await act(async () => { pending.resolve(); });
    expect(document.body).toHaveTextContent("Запись B");
    expect(document.body).not.toHaveTextContent("Запись A");
  });

  it.each([401, 403, 404, 500])("never substitutes training data for HTTP%s", async (status) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { message: "Ответ недоступен" } }, status)));
    for (const Page of pages) {
      const { unmount } = renderPage(Page);
      await screen.findByRole("alert");
      expect(document.body).not.toHaveTextContent("Обращение 001");
      expect(screen.queryByRole("button", { name: "Сохранить заметку" })).toBeNull();
      unmount();
    }
  });

  it.each(pages)("continues to load working data under StrictMode", async (Page) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => workingResponse(input)));
    render(<StrictMode><RoleProvider><MemoryRouter initialEntries={[`/operator/dialogs/${requestId}`]}>
      <Routes><Route path="/operator/dialogs/:id" element={<Page />} /></Routes>
    </MemoryRouter></RoleProvider></StrictMode>);
    await screen.findAllByText("Запись A");
    expect(document.body).not.toHaveTextContent("Обращение 001");
  });
  it("does not replace the new booking selection or its draft with an earlier write", async () => {
    writeSession();
    const pending = deferred();
    const otherId = "10000000-0000-4000-8000-000000000502";
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") { await pending.promise; return workingResponse(input); }
      const result = await workingResponse(input);
      const body = await result.json();
      if (new URL(String(input)).pathname === "/api/v1/clinic/booking-requests") {
        body.items.push({ ...body.items[0], id: otherId, patient: { ...body.items[0].patient, fullName: "Выбор B" } });
      }
      return json(body);
    }));
    renderPage(OperatorBookingRequestsPage);
    await screen.findByText("Данные загружены из системы клиники.");
    fireEvent.click(screen.getByRole("button", { name: "Взять в работу заявку: Запись A" }));
    await screen.findByText("Выбор B", { exact: false });
    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись: Выбор B" }));
    fireEvent.change(screen.getByLabelText("Заметка клиники по заявке"), { target: { value: "Черновик выбранной заявки B" } });
    await act(async () => { pending.resolve(); });
    expect(screen.getByLabelText("Заметка клиники по заявке")).toHaveValue("Черновик выбранной заявки B");
    expect(document.body).not.toHaveTextContent("Заявка: статус Новые.");
  });

  it("does not accept a note-save response for a different dialog request", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "PATCH") return json({ item: {
        id: "10000000-0000-4000-8000-000000000599", status: "reviewing",
        patient: { fullName: "Чужая карточка" }, clinic: {}, clinicNote: "Чужая заметка",
      } });
      return workingResponse(input);
    }));
    renderPage(OperatorDialogPage);
    await screen.findAllByText("Запись A");
    fireEvent.change(screen.getByLabelText("Заметка клиники по обращению"), { target: { value: "Тестовая заметка" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить заметку" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Обращение не найдено или недоступно для вашей клиники.");
    expect(document.body).not.toHaveTextContent("Чужая карточка");
    expect(document.body).not.toHaveTextContent("Заметка сохранена.");
  });
  it("clears booking selection and secondary totals when the primary reload fails", async () => {
    writeSession();
    let fail = false;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const path = new URL(String(input)).pathname;
      if (fail && path === "/api/v1/clinic/booking-requests") return json({ error: { message: "Синтетический отказ" } }, 503);
      if (path === "/api/v1/integrations/booking-imports") return json({ items: [], count: 7 });
      if (path === "/api/v1/clinic/available-slots") return json({ items: [], count: 9 });
      return workingResponse(input);
    }));
    renderPage(OperatorBookingRequestsPage);
    await screen.findByText("Данные загружены из системы клиники.");
    fireEvent.click(screen.getByRole("button", { name: "Открыть заявку на запись: Запись A" }));
    expect(screen.getByLabelText("Заметка клиники по заявке")).toBeInTheDocument();
    expect(document.body).toHaveTextContent("7");
    expect(document.body).toHaveTextContent("9");
    fail = true;
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await screen.findByText("Синтетический отказ");
    expect(screen.queryByLabelText("Заметка клиники по заявке")).toBeNull();
    expect(screen.queryByText("7")).toBeNull();
    expect(screen.queryByText("9")).toBeNull();
  });

  it.each([
    ["console", OperatorConsolePage, "/api/v1/leads/appointments"],
    ["booking", OperatorBookingRequestsPage, "/api/v1/clinic/booking-requests"],
  ] as const)("reloads the current %s filter after a pending write", async (name, Page, primary) => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST" || init?.method === "PATCH") {
        await pending.promise;
        return name === "console" ? json({ item: { id: requestId } }) : workingResponse(input);
      }
      return workingResponse(input, new URL(String(input)).searchParams.get("search") === "new" ? "Новый поиск" : "Запись A");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    await screen.findAllByText("Запись A");
    if (name === "console") {
      fireEvent.change(screen.getByLabelText("Краткое описание заявки"), { target: { value: "Синтетический запрос" } });
      fireEvent.click(screen.getByRole("button", { name: "Создать заявку" }));
    } else fireEvent.click(screen.getByRole("button", { name: "Взять в работу заявку: Запись A" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST" || init?.method === "PATCH")).toBe(true));
    fireEvent.change(screen.getByLabelText(name === "console" ? "Поиск" : "Поиск заявок на запись"), { target: { value: "new" } });
    await screen.findAllByText("Новый поиск");
    await act(async () => { pending.resolve(); });
    const loads = fetchMock.mock.calls.filter(([input]) => new URL(String(input)).pathname === primary);
    expect(new URL(String(loads.at(-1)?.[0])).searchParams.get("search")).toBe("new");
    expect(document.body).toHaveTextContent("Новый поиск");
  });
  it.each([
    "/api/v1/clinic/booking-requests",
    "/api/v1/integrations/booking-imports",
    "/api/v1/integrations/booking-imports/status",
    "/api/v1/clinic/available-slots",
  ])("stops the retired booking chain after its pending %s response", async (stage) => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const old = (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A";
      if (old && new URL(String(input)).pathname === stage) await pending.promise;
      return workingResponse(input, old ? "Запись A" : "Запись B");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(OperatorBookingRequestsPage);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => new URL(String(input)).pathname === stage)).toBe(true));
    await act(async () => { writeSession("synthetic-B", "Оператор B"); });
    await screen.findByText("Данные загружены из системы клиники.");
    const afterSwitch = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.slice(afterSwitch).some(([, init]) =>
      (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A")).toBe(false);
    expect(document.body).not.toHaveTextContent("Запись A");
    expect(document.body).toHaveTextContent("Запись B");
  });

  it.each([[OperatorConsolePage, "Поиск"], [OperatorBookingRequestsPage, "Поиск заявок на запись"]] as const)(
    "keeps the latest search when the old response arrives last", async (Page, label) => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (new URL(String(input)).searchParams.get("search") === "old") {
        await pending.promise;
        return workingResponse(input, "Старый поиск");
      }
      return workingResponse(input, new URL(String(input)).searchParams.get("search") === "new" ? "Новый поиск" : "Запись A");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    await screen.findAllByText("Запись A");
    fireEvent.change(screen.getByLabelText(label), { target: { value: "old" } });
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input).includes("search=old"))).toBe(true));
    fireEvent.change(screen.getByLabelText(label), { target: { value: "new" } });
    await screen.findAllByText("Новый поиск");
    await act(async () => { pending.resolve(); });
    expect(document.body).toHaveTextContent("Новый поиск");
    expect(document.body).not.toHaveTextContent("Старый поиск");
  });

  it("rejects a dialog response for a different route request", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => json({ item: {
      id: "10000000-0000-4000-8000-000000000599", status: "requested",
      patient: { fullName: "Чужое обращение" }, clinic: {}, clinicNote: "Чужая заметка",
    } })));
    renderPage(OperatorDialogPage);
    expect(await screen.findByRole("alert")).toHaveTextContent("Обращение не найдено или недоступно для вашей клиники.");
    expect(document.body).not.toHaveTextContent("Чужое обращение");
    expect(screen.queryByRole("button", { name: "Сохранить заметку" })).toBeNull();
  });

  it("keeps the latest dialog reload when an older reload completes last", async () => {
    writeSession();
    const pending = deferred();
    let calls = 0;
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const call = ++calls;
      if (call === 2) { await pending.promise; return workingResponse(input, "Старое обращение"); }
      return workingResponse(input, call === 3 ? "Новое обращение" : "Запись A");
    }));
    renderPage(OperatorDialogPage);
    await screen.findAllByText("Запись A");
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await waitFor(() => expect(calls).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "Обновить" }));
    await screen.findAllByText("Новое обращение");
    await act(async () => { pending.resolve(); });
    expect(document.body).toHaveTextContent("Новое обращение");
    expect(document.body).not.toHaveTextContent("Старое обращение");
  });
  it("does not dispatch a retired console follow-up after a delayed create", async () => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { await pending.promise; return json({ item: { id: requestId } }); }
      return workingResponse(input, (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A" ? "Запись A" : "Запись B");
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage(OperatorConsolePage);
    await screen.findAllByText("Запись A");
    fireEvent.change(screen.getByLabelText("Краткое описание заявки"), { target: { value: "Синтетический запрос" } });
    fireEvent.click(screen.getByRole("button", { name: "Создать заявку" }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true));
    await act(async () => { writeSession("synthetic-B", "Оператор B"); });
    await screen.findAllByText("Запись B");
    const afterSwitch = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.slice(afterSwitch).some(([, init]) =>
      (init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A")).toBe(false);
    expect(document.body).not.toHaveTextContent("Заявка создана.");
    expect(document.body).not.toHaveTextContent("Запись A");
  });
  it.each([
    [OperatorBookingRequestsPage, "Для очереди заявок нужен вход в систему клиники."],
    [OperatorDialogPage, "Для карточки обращения нужен вход в систему клиники."],
  ] as const)("requires working login for the booking/card route", async (Page, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage(Page);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Обращение 001");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("requires working login instead of showing the training console", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<RoleProvider><MemoryRouter><OperatorConsolePage /></MemoryRouter></RoleProvider>);
    expect(await screen.findByText("Для очереди заявок нужен вход в систему клиники.")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Обращение 001");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
