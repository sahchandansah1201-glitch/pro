import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { MemoryRouter } from "react-router-dom";
import { clearSelfHostedApiSession, writeSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import AdminGovernancePage from "./AdminGovernancePage";
import { governanceFixture } from "./__fixtures__/governance";
import { GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY } from "./governance-decision-receipt";
import { StrictMode } from "react";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); clearSelfHostedApiSession(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function renderPage() { return render(<MemoryRouter><AdminGovernancePage /></MemoryRouter>); }
function writeSession(token = "synthetic-A") {
  writeSelfHostedApiSession({ apiBaseUrl: "http://localhost:19161", apiToken: token,
    user: { id: token, displayName: "Проверочный администратор", roles: ["clinic_admin"] } });
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function deferred() {
  let resolve: () => void = () => {};
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}
function governanceResponse(count = 29) {
  return json({ item: { ...governanceFixture, summary: { ...governanceFixture.summary, retentionMissing: count },
    operations: { ...governanceFixture.operations, retention: { ...governanceFixture.operations.retention, reviewDue: count } } } });
}
const accessOperations = [
  ["Блокировать окна без правил", "Подтвердить блокировку"],
  ["Отозвать истёкшие окна", "Подтвердить отзыв"],
  ["Закрыть окна без срока", "Подтвердить закрытие"],
  ["Закрыть временные коды", "Подтвердить закрытие"],
  ["Подготовить новую выдачу", null],
  ["Подготовить ключ входа", null],
] as const;
function clickOperation(trigger: string, confirmation: string | null) {
  fireEvent.click(screen.getByRole("button", { name: trigger }));
  if (confirmation) fireEvent.click(screen.getByRole("button", { name: confirmation }));
}

describe("Working access governance", () => {
  it("requires clinic sign-in instead of rendering an invented access summary", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    expect(screen.getByRole("link", { name: "Войти в систему клиники" })).toHaveAttribute("href", "/self-hosted/login");
    expect(screen.queryByText("Правила выдачи")).toBeNull();
    expect(screen.queryByText("Решение о выдаче пациенту")).toBeNull();
    expect(screen.queryByRole("button", { name: "Сохранить временную заметку" })).toBeNull();
    expect(document.body).not.toHaveTextContent("учебный срез");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not render an invented access summary while loading", async () => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async () => { await pending.promise; return json({ item: null }); }));
    renderPage();
    expect(screen.getByRole("status")).toHaveTextContent(/Загружаем/);
    expect(screen.queryByText("Правила выдачи")).toBeNull();
    expect(screen.queryByText("Решение о выдаче пациенту")).toBeNull();
    expect(screen.queryByRole("button", { name: "Сохранить временную заметку" })).toBeNull();
    await act(async () => { pending.resolve(); });
  });

  it("discards the previous account response after session B has loaded", async () => {
    writeSession();
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-A") {
        await pending.promise;
        return governanceResponse(29);
      }
      return governanceResponse(41);
    }));
    renderPage();
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findByText("41 требуют правил");
    await act(async () => { pending.resolve(); });
    expect(screen.getByText("41 требуют правил")).toBeInTheDocument();
    expect(screen.queryByText("29 требуют правил")).toBeNull();
  });

  it("does not save a previous account note after sign-out", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => governanceResponse()));
    const pending = deferred();
    let delay = false;
    vi.stubGlobal("crypto", { subtle: { digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      if (delay) await pending.promise;
      return webcrypto.subtle.digest(algorithm, data);
    } } });
    renderPage();
    await screen.findByText("29 требуют правил");
    delay = true;
    fireEvent.click(screen.getByRole("button", { name: "Сохранить временную заметку" }));
    await act(async () => { clearSelfHostedApiSession(); });
    await act(async () => { pending.resolve(); });
    expect(screen.getByRole("link", { name: "Войти в систему клиники" })).toBeInTheDocument();
    expect(window.sessionStorage.getItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY)).toBeNull();
  });

  it.each([401, 403, 503, "network", "empty"])("shows no counters, notes or operations after %s", async (failure) => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => {
      if (failure === "network") throw new Error("private/storage token=hidden");
      return json(failure === "empty" ? { item: null } : { error: { message: "private/storage token=hidden" } }, typeof failure === "number" ? failure : 200);
    }));
    renderPage();
    await screen.findByRole("alert");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeInTheDocument();
    expect(screen.queryByText("Правила выдачи")).toBeNull();
    expect(screen.queryByRole("button", { name: "Блокировать окна без правил" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Сохранить временную заметку" })).toBeNull();
    expect(document.body).not.toHaveTextContent("private/storage");
  });

  it("retries a failed read and renders only the returned aggregates", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({}, 503)).mockImplementation(async () => governanceResponse()));
    renderPage();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));
    await screen.findByText("29 требуют правил");
    expect(screen.queryByText("4 требуют правил")).toBeNull();
    expect(document.body).not.toHaveTextContent("учебный срез");
  });

  it("hides account A data and note immediately while account B loads", async () => {
    writeSession();
    vi.stubGlobal("crypto", webcrypto);
    const pending = deferred();
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if ((init?.headers as Record<string, string>).Authorization === "Bearer synthetic-B") await pending.promise;
      return governanceResponse();
    }));
    renderPage();
    await screen.findByText("29 требуют правил");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить временную заметку" }));
    await screen.findByRole("status", { name: "Временная заметка о решении клиники" });
    await act(async () => { writeSession("synthetic-B"); });
    expect(screen.getByRole("status")).toHaveTextContent(/Загружаем/);
    expect(screen.queryByText("29 требуют правил")).toBeNull();
    expect(screen.queryByRole("status", { name: "Временная заметка о решении клиники" })).toBeNull();
    await act(async () => { pending.resolve(); });
    await screen.findByText("29 требуют правил");
    expect(screen.queryByRole("status", { name: "Временная заметка о решении клиники" })).toBeNull();
  });

  it("loads working aggregates under StrictMode", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => governanceResponse()));
    render(<StrictMode><MemoryRouter><AdminGovernancePage /></MemoryRouter></StrictMode>);
    await screen.findByText("29 требуют правил");
    expect(screen.getByRole("heading", { name: "Выдача выключена" })).toBeInTheDocument();
  });

  it.each(["ready", "error"])("ignores an older StrictMode read after a newer %s response", async (state) => {
    writeSession();
    const pending = deferred();
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async () => {
      reads += 1;
      if (reads === 1) { await pending.promise; return governanceResponse(29); }
      return state === "ready" ? governanceResponse(41) : json({}, 503);
    }));
    render(<StrictMode><MemoryRouter><AdminGovernancePage /></MemoryRouter></StrictMode>);
    if (state === "ready") await screen.findByText("41 требуют правил");
    else await screen.findByRole("alert");
    await act(async () => { pending.resolve(); });
    if (state === "ready") expect(screen.getByText("41 требуют правил")).toBeInTheDocument();
    else expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText("29 требуют правил")).toBeNull();
  });

  it.each(accessOperations)("retires an in-flight %s when account A signs out", async (trigger, confirmation) => {
    writeSession();
    const pending = deferred();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") { await pending.promise; return json({ item: { affectedCount: 83 } }); }
      return governanceResponse();
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage();
    await screen.findByText("29 требуют правил");
    clickOperation(trigger, confirmation);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
    await act(async () => { clearSelfHostedApiSession(); pending.resolve(); });
    expect(screen.getByRole("link", { name: "Войти в систему клиники" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "GET")).toHaveLength(1);
    expect(document.body).not.toHaveTextContent("83");
  });

  it.each(["loading", "error"])("does not display stale aggregates or a note during a %s mutation refresh", async (state) => {
    writeSession();
    vi.stubGlobal("crypto", webcrypto);
    const pending = deferred();
    let reads = 0;
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === "POST") return json({ item: { affectedCount: 2 } });
      reads += 1;
      if (reads === 1) return governanceResponse();
      await pending.promise;
      return json({}, 503);
    }));
    renderPage();
    await screen.findByText("29 требуют правил");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить временную заметку" }));
    await screen.findByRole("status", { name: "Временная заметка о решении клиники" });
    clickOperation(...accessOperations[0]);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/Загружаем/));
    if (state === "error") { await act(async () => { pending.resolve(); }); await screen.findByRole("alert"); }
    expect(screen.queryByText("29 требуют правил")).toBeNull();
    expect(screen.queryByRole("status", { name: "Временная заметка о решении клиники" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Блокировать окна без правил" })).toBeNull();
    await act(async () => { pending.resolve(); });
  });

  it("does not overwrite account B's note with account A's late save", async () => {
    writeSession();
    vi.stubGlobal("fetch", vi.fn(async () => governanceResponse()));
    const pending = deferred();
    let delay = false;
    vi.stubGlobal("crypto", { subtle: { digest: async (algorithm: AlgorithmIdentifier, data: BufferSource) => {
      if (delay && new TextDecoder().decode(data).includes("synthetic-A")) await pending.promise;
      return webcrypto.subtle.digest(algorithm, data);
    } } });
    renderPage();
    await screen.findByText("29 требуют правил");
    delay = true;
    fireEvent.click(screen.getByRole("button", { name: "Сохранить временную заметку" }));
    await act(async () => { writeSession("synthetic-B"); });
    await screen.findByText("29 требуют правил");
    fireEvent.click(screen.getByRole("button", { name: "Сохранить временную заметку" }));
    await screen.findByRole("status", { name: "Временная заметка о решении клиники" });
    const noteB = window.sessionStorage.getItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY);
    await act(async () => { pending.resolve(); });
    expect(window.sessionStorage.getItem(GOVERNANCE_DECISION_RECEIPT_STORAGE_KEY)).toBe(noteB);
    expect(screen.getByRole("status", { name: "Временная заметка о решении клиники" })).toBeInTheDocument();
  });
});
