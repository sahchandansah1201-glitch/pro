import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import BotMiniAppBookingPage from "./BotMiniAppBookingPage";
import { StrictMode } from "react";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function writeSession(token = "synthetic-A", apiBaseUrl = "http://localhost:19171") {
  writeSelfHostedApiSession({ apiBaseUrl, apiToken: token, user: { id: token, displayName: "Проверочный пациент", roles: ["patient"],
    roleBindings: [{ role: "patient", clinicId: token, clinicName: "Проверочная клиника", clinicSlug: token }] } });
}
function portal(name = "Пациент A") {
  return { portal: { patient: { id: "synthetic-patient", fullName: name, clinic: { name: "Проверочная клиника" } }, nextAppointment: null,
    reports: [], reminders: [], bookingRequests: [{ id: "synthetic-request", reason: name, status: "requested" }],
    reminderPreferences: { appointmentRemindersEnabled: true, reportNotificationsEnabled: true, preferredChannel: "email" } } };
}
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function renderPage() { return render(<MemoryRouter><BotMiniAppBookingPage /></MemoryRouter>); }
function fillRequest() {
  fireEvent.change(screen.getByLabelText("Предпочтительное начало записи"), { target: { value: "2026-10-20T09:00" } });
  fireEvent.change(screen.getByLabelText("Причина запроса на запись"), { target: { value: "Сохранить черновик" } });
}
beforeEach(() => { clearSelfHostedApiSession(); vi.stubEnv("VITE_APP_MODE", "demo"); });
afterEach(() => { cleanup(); clearSelfHostedApiSession(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Working bot booking", () => {
  it("requires a real clinic session even when the global mode is demo", () => {
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    renderPage();
    expect(screen.getByRole("link", { name: "Войти" })).toHaveAttribute("href", "/self-hosted/login");
    expect(screen.queryByText("Учебная форма записи")).toBeNull();
    expect(screen.queryByRole("button", { name: "Отправить заявку" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not repeat account A's portal request after a late successful write and account B sign-in", async () => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { await pending.promise; return json({ item: { id: "synthetic-write" } }, 201); }
      return json(portal((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B" ? "Пациент B" : "Пациент A"));
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findAllByText("Пациент A");
    fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findAllByText("Пациент B");
    await act(async () => { pending.resolve(); });
    expect(document.body).not.toHaveTextContent("Пациент A");
    expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "GET" && (init.headers as Record<string, string>).Authorization === "Bearer synthetic-A")).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("Заявка на запись отправлена в клинику.");
  });

  it("does not request account A again when its write resolves before React commits the new session", async () => {
    writeSession(); const pending = deferred();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { if (init?.method === "POST") { await pending.promise; return json({ item: { id: "synthetic-write" } }, 201); } return json(portal((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B" ? "Пациент B" : "Пациент A")); });
    vi.stubGlobal("fetch", fetchMock); renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await act(async () => { writeSession("synthetic-B"); pending.resolve(); });
    await screen.findAllByText("Пациент B");
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "GET" && (init.headers as Record<string, string>).Authorization === "Bearer synthetic-A")).toHaveLength(1);
  });

  it.each(["ready", "error"])("does not replace the latest StrictMode %s with an earlier portal response", async (state) => {
    writeSession();
    const pending = deferred(); let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      reads += 1;
      if (reads === 1) { await pending.promise; return json(portal("Пациент A")); }
      return state === "ready" ? json(portal("Пациент B")) : json({}, 503);
    }));
    render(<StrictMode><MemoryRouter><BotMiniAppBookingPage /></MemoryRouter></StrictMode>);
    if (state === "ready") await screen.findAllByText("Пациент B"); else await screen.findByRole("alert");
    await act(async () => { pending.resolve(); });
    if (state === "ready") expect(screen.getAllByText("Пациент B").length).toBeGreaterThan(0);
    else expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Пациент A");
  });

  it("does not claim a booking was created when the write response has no request ID", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? json({ item: {} }, 201) : json(portal())));
    renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Заявка создана");
    expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("Сохранить черновик");
  });

  it("rejects an empty portal response without showing a placeholder patient or booking form", async () => {
    writeSession(); vi.stubGlobal("fetch", vi.fn(async () => json({ portal: {} })));
    renderPage();
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
    expect(screen.queryByText("Активных записей нет.")).toBeNull();
  });

  it("shows a safe read error and lets the current patient retry", async () => {
    writeSession(); let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async () => ++reads === 1 ? json({ error: { message: "private/storage token=hidden" } }, 503) : json(portal())));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Не удалось загрузить данные записи. Повторите попытку.");
    expect(document.body).not.toHaveTextContent("private/storage");
    expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Повторить загрузку" }));
    await screen.findAllByText("Пациент A");
    expect(screen.getByLabelText("Причина запроса на запись")).toBeInTheDocument();
    expect(reads).toBe(2);
  });

  it.each([401, 403, 503])("does not expose raw write error details (%s) or discard the draft", async (status) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? json({ error: { message: "private/storage token=hidden" } }, status) : json(portal())));
    renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await screen.findByRole("alert");
    expect(document.body).not.toHaveTextContent("private/storage");
    expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("Сохранить черновик");
    expect(document.body).not.toHaveTextContent("Заявка создана");
  });

  it.each(["logout", "account", "base"])("clears the draft immediately on %s while ignoring the old read", async (change) => {
    writeSession(); const pending = deferred(); let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { reads += 1; if (reads > 1) await pending.promise; return json(portal(reads === 1 ? "Пациент A" : "Пациент B")); }));
    renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    await act(async () => { if (change === "logout") clearSelfHostedApiSession(); else writeSession(change === "account" ? "synthetic-B" : "synthetic-A", change === "base" ? "http://localhost:19172" : "http://localhost:19171"); });
    expect(document.body).not.toHaveTextContent("Пациент A");
    expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
    if (change === "logout") expect(screen.getByRole("link", { name: "Войти" })).toBeInTheDocument();
    else expect(screen.getByRole("status")).toHaveTextContent("Загружаем данные записи");
    await act(async () => { pending.resolve(); });
    if (change !== "logout") expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("");
  });

  it.each(["success", "error"])("ignores a late %s read from the previous account", async (outcome) => {
    writeSession(); const pending = deferred(); let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async () => { reads += 1; if (reads === 1) { await pending.promise; return outcome === "success" ? json(portal("Пациент A")) : json({}, 503); } return json(portal("Пациент B")); }));
    renderPage();
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findAllByText("Пациент B");
    await act(async () => { pending.resolve(); });
    expect(document.body).not.toHaveTextContent("Пациент A");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Причина запроса на запись")).toBeInTheDocument();
  });

  it.each(["logout", "base"])("ignores a late failed write after %s without making another read", async (change) => {
    writeSession(); const pending = deferred();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { if (init?.method === "POST") { await pending.promise; return json({}, 503); } return json(portal("Пациент B")); });
    vi.stubGlobal("fetch", fetchMock); renderPage(); await screen.findAllByText("Пациент B"); fillRequest();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    await act(async () => { if (change === "logout") clearSelfHostedApiSession(); else writeSession("synthetic-A", "http://localhost:19172"); });
    if (change === "base") await screen.findAllByText("Пациент B");
    const count = fetchMock.mock.calls.length;
    await act(async () => { pending.resolve(); });
    expect(fetchMock.mock.calls.length).toBe(count);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.body).not.toHaveTextContent("Сохранить черновик");
  });

  it("sends one real request while saving and does not show stale data if the refresh fails", async () => {
    writeSession(); const pending = deferred(); let reads = 0;
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { if (init?.method === "POST") { await pending.promise; return json({ item: { id: "actual-created-id" } }, 201); } return ++reads === 1 ? json(portal()) : json({}, 503); });
    vi.stubGlobal("fetch", fetchMock); renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    const button = screen.getByRole("button", { name: "Отправить заявку" });
    fireEvent.click(button); fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    const payload = JSON.parse(fetchMock.mock.calls.find(([, init]) => init?.method === "POST")![1]!.body as string);
    expect(payload).toEqual({ preferredFrom: new Date("2026-10-20T09:00").toISOString(), preferredTo: null, reason: "Сохранить черновик" });
    await act(async () => { pending.resolve(); });
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Пациент A");
    expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
    expect(screen.getByRole("button", { name: "Повторить загрузку" })).toBeInTheDocument();
  });

  it("shows only the real booking acknowledgement and uses a working back link", async () => {
    writeSession(); vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? json({ item: { id: "actual-created-id" } }, 201) : json(portal())));
    renderPage(); await screen.findAllByText("Пациент A"); fillRequest();
    expect(screen.getByRole("link", { name: "Вернуться к записи" })).toHaveAttribute("href", "/me/booking");
    expect(document.querySelector('a[href="/bot-sim"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" }));
    expect(await screen.findByText("Заявка создана")).toBeInTheDocument();
    expect(screen.getByLabelText("Причина запроса на запись")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent("Заявка на запись отправлена в клинику.");
  });

  it.each(["portal", "write"])("rejects a whitespace-only %s ID", async (kind) => {
    writeSession(); const data = portal(); if (kind === "portal") data.portal.patient.id = "   ";
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.method === "POST" ? json({ item: { id: "   " } }, 201) : json(data)));
    renderPage();
    if (kind === "write") { await screen.findAllByText("Пациент A"); fillRequest(); fireEvent.click(screen.getByRole("button", { name: "Отправить заявку" })); }
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Заявка создана");
    if (kind === "portal") expect(screen.queryByLabelText("Причина запроса на запись")).toBeNull();
  });

  it.each(["requested", "reviewing", "booked", "cancelled", "unknown_internal_state"])("shows a Russian booking state for %s", async (status) => {
    writeSession(); const data = portal(); data.portal.bookingRequests[0].status = status;
    vi.stubGlobal("fetch", vi.fn(async () => json(data)));
    renderPage(); await screen.findAllByText("Пациент A");
    expect(document.body).not.toHaveTextContent(status);
    expect(screen.getByRole("list")).toHaveTextContent(status === "requested" ? "Ожидает подтверждения" : status === "reviewing" ? "Клиника рассматривает заявку" : status === "booked" ? "Запись подтверждена" : status === "cancelled" ? "Отменена" : "Уточните статус в клинике");
  });
});
