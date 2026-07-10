import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import {
  ACCESS_EVENT_EXPORT_COLUMNS,
  ACCESS_EVENTS_EXPORT_LIMIT,
  accessEventsCsvFilename,
  accessEventsXlsxFilename,
  buildAccessEventsCsv,
  buildAccessEventsXlsxBlob,
  buildAccessEventsXlsxBytes,
  limitAccessEventExportRows,
} from "@/lib/admin-access-events";

const appModeMock = vi.hoisted(() => ({ production: false }));
const sessionMock = vi.hoisted(() => ({
  session: {
    apiBaseUrl: "https://pro.skindoktor.ru",
    apiToken: "admin-token",
    status: "configured",
    user: {
      id: "system-admin-1",
      displayName: "Администратор Dermatolog Pro",
      roles: ["system_admin"],
    },
  },
}));
const adminApiMock = vi.hoisted(() => ({
  listAdminAuditEvents: vi.fn(),
  adminApiErrorText: vi.fn((error: { message?: string } | null) => error?.message ?? "Действие не выполнено."),
}));

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => appModeMock.production,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => sessionMock.session,
}));

vi.mock("@/lib/self-hosted-admin-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/self-hosted-admin-api")>();
  return {
    ...actual,
    listAdminAuditEvents: adminApiMock.listAdminAuditEvents,
    adminApiErrorText: adminApiMock.adminApiErrorText,
  };
});

import SysAccessEventsPage from "./SysAccessEventsPage";

function renderPage(role = "system_admin") {
  window.localStorage.setItem(ROLE_STORAGE_KEY, role);
  return render(
    <MemoryRouter initialEntries={["/sys/access-events"]}>
      <RoleProvider>
        <SysAccessEventsPage />
      </RoleProvider>
    </MemoryRouter>,
  );
}

function nonOptionTextCount(text: string): number {
  return screen.queryAllByText(text).filter((node) => node.tagName !== "OPTION").length;
}

function firstMockArg<T>(mock: ReturnType<typeof vi.fn>): T {
  const call = mock.mock.calls.at(0) as unknown[] | undefined;
  expect(call).toBeDefined();
  expect(call?.length).toBeGreaterThan(0);
  return call?.[0] as T;
}

describe("SysAccessEventsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    appModeMock.production = false;
    sessionMock.session = {
      apiBaseUrl: "https://pro.skindoktor.ru",
      apiToken: "admin-token",
      status: "configured",
      user: {
        id: "system-admin-1",
        displayName: "Администратор Dermatolog Pro",
        roles: ["system_admin"],
      },
    };
    adminApiMock.listAdminAuditEvents.mockReset();
    adminApiMock.adminApiErrorText.mockImplementation(
      (error: { message?: string } | null) => error?.message ?? "Действие не выполнено.",
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders system-admin access events without raw emails or patient names", () => {
    const { container } = renderPage();

    expect(screen.getByRole("heading", { name: "События доступа" })).toBeInTheDocument();
    expect(screen.getByText(/проверкой роли в рабочей системе/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Скачать события доступа таблицей" })).toBeEnabled();
    expect(screen.getAllByText("Отчёт открыт по ссылке").length).toBeGreaterThan(0);

    const html = container.innerHTML;
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(html).not.toContain("Иванова Наталья");
    expect(html).not.toContain("storage_object_path");
    expect(html).not.toContain("access_token");
  });

  it("blocks non-system-admin roles before rendering rows or export", () => {
    renderPage("clinic_admin");

    expect(screen.getByRole("alert")).toHaveTextContent(/Нет доступа в учебном режиме/i);
    expect(screen.queryByRole("button", { name: "Скачать события доступа таблицей" })).not.toBeInTheDocument();
    expect(screen.queryByText("Отчёт открыт по ссылке")).not.toBeInTheDocument();
  });

  it("uses the self-hosted system admin session for production access events", async () => {
    appModeMock.production = true;
    adminApiMock.listAdminAuditEvents.mockResolvedValue({
      ok: true,
      value: [
        {
          id: "audit-1",
          action: "admin.user.create",
          entityType: "admin_user",
          actorName: "Админ 2",
          clinicName: "Dermatolog Pro",
          createdAt: "2026-06-27T10:00:00.000Z",
        },
      ],
      error: null,
    });

    renderPage("doctor");

    expect(screen.getByRole("heading", { name: "События доступа" })).toBeInTheDocument();
    await waitFor(() => expect(adminApiMock.listAdminAuditEvents).toHaveBeenCalledTimes(1));
    expect((await screen.findAllByText("Сотрудник создан")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("сотрудник").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Источник событий")).not.toHaveTextContent("Учебные данные");
    expect(screen.getByText(/Данные читаются из рабочей системы клиники/i)).toBeInTheDocument();
    expect(screen.queryByText(/system_admin|учебн/i)).not.toBeInTheDocument();
  });

  it("filters rows by query and event bucket", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "Отчёт открыт по ссылке" },
    });
    expect(nonOptionTextCount("Отчёт открыт по ссылке")).toBeGreaterThan(0);
    expect(nonOptionTextCount("Открыт визит")).toBe(0);

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Устройства" }));
    expect(nonOptionTextCount("Устройство зарегистрировано")).toBeGreaterThan(0);
    expect(nonOptionTextCount("Отчёт открыт по ссылке")).toBe(0);
  });

  it("filters rows by source, entity, and event date", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Тип сущности"), {
      target: { value: "device" },
    });
    expect(nonOptionTextCount("Устройство зарегистрировано")).toBeGreaterThan(0);
    expect(nonOptionTextCount("Отчёт открыт по ссылке")).toBe(0);

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "2026-03-01" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(nonOptionTextCount("Устройство зарегистрировано")).toBe(0);

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Источник событий"), {
      target: { value: "api" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(nonOptionTextCount("Устройство зарегистрировано")).toBe(0);
  });

  it("filters rows by clinic, actor, action, and patient code", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Клиника события"), {
      target: { value: "Дерма-Про · Центр" },
    });
    fireEvent.change(screen.getByLabelText("Актор события"), {
      target: { value: "Врач" },
    });
    fireEvent.change(screen.getByLabelText("Действие события"), {
      target: { value: "report.generate" },
    });
    fireEvent.change(screen.getByLabelText("Номер карты в событии"), {
      target: { value: "DP-2026-0001" },
    });

    expect(nonOptionTextCount("Отчёт сформирован")).toBeGreaterThan(0);
    expect(nonOptionTextCount("Отчёт открыт по ссылке")).toBe(0);
    expect(nonOptionTextCount("Открыт визит")).toBe(0);
    expect(screen.getAllByText(/клиника: Дерма-Про · Центр/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/номер карты: карта 0001/).length).toBeGreaterThan(0);
  });

  it("lets system admin change access-events page size", () => {
    renderPage();

    expect(screen.getByText("1–10 из 12 событий")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
    expect(screen.getByText("1–5 из 12 событий")).toBeInTheDocument();
  });

  it("resets filters, query, and page size to defaults", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "Отчёт открыт по ссылке" },
    });
    fireEvent.change(screen.getByLabelText("Клиника события"), {
      target: { value: "Дерма-Про · Центр" },
    });
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтры событий доступа" }));

    expect(screen.getByLabelText("Поиск событий доступа")).toHaveValue("");
    expect(screen.getByLabelText("Клиника события")).toHaveValue("all");
    expect(screen.getByLabelText("Размер страницы событий")).toHaveValue("10");
    expect(screen.getByText("Фильтры сброшены.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Фильтры событий: сброшены/i,
    );
  });

  it("applies date presets and can clear the date filter", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Показать события за март 2026" }));

    expect(screen.getByLabelText("Дата события с")).toHaveValue("2026-03-01");
    expect(screen.getByLabelText("Дата события по")).toHaveValue("2026-03-31");
    expect(screen.getByText("Пресет даты применён: март 2026.")).toBeInTheDocument();
    expect(screen.getByText("Найдено: 11")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Сбросить фильтр даты событий" }));

    expect(screen.getByLabelText("Дата события с")).toHaveValue("");
    expect(screen.getByLabelText("Дата события по")).toHaveValue("");
    expect(screen.getByText("Фильтр даты сброшен.")).toBeInTheDocument();
  });

  it("supports first, previous, next, and last pagination controls", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
    expect(screen.getByText("Страница 1 из 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Последняя страница" }));
    expect(screen.getByText("11–12 из 12 событий")).toBeInTheDocument();
    expect(screen.getByText("Страница 3 из 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Предыдущая страница" }));
    expect(screen.getByText("6–10 из 12 событий")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Первая страница" }));
    expect(screen.getByText("1–5 из 12 событий")).toBeInTheDocument();
  });

  it("shows query limit, refresh cooldown, and safe query log", () => {
    renderPage();

    expect(screen.getByText(/Лимит: 200 событий/i)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Учебный журнал: локальные события загружены/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Обновить события доступа" }));
    expect(screen.getByRole("button", { name: /^Обновление доступно через/i })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Обновление событий: запрошено, лимит 200/i,
    );
  });

  it("manual refresh button logs a safe refresh request", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Обновить события доступа вручную" }));

    expect(screen.getByText("Ручное обновление запрошено.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Ручное обновление событий: запрошено, лимит 200/i,
    );
  });

  it("auto-refresh can be enabled and requests a safe refresh on interval", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-11T12:00:00Z"));
    const { unmount } = renderPage();

    fireEvent.click(screen.getByLabelText("Автообновление событий доступа"));
    expect(screen.getByText(/Автообновление включено: каждые 60 секунд/i)).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Автообновление событий: запрошено, лимит 200/i,
    );
    unmount();
  });

  it("persists safe filter state across remounts", () => {
    const first = renderPage();

    fireEvent.change(screen.getByLabelText("Действие события"), {
      target: { value: "report.generate" },
    });
    fireEvent.change(screen.getByLabelText("Номер карты в событии"), {
      target: { value: "DP-2026-0001" },
    });
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
    first.unmount();

    renderPage();

    expect(screen.getByLabelText("Действие события")).toHaveValue("report.generate");
    expect(screen.getByLabelText("Номер карты в событии")).toHaveValue("DP-2026-0001");
    expect(screen.getByLabelText("Размер страницы событий")).toHaveValue("5");
    expect(nonOptionTextCount("Отчёт сформирован")).toBeGreaterThan(0);
    expect(nonOptionTextCount("Открыт визит")).toBe(0);
  });

  it("persists export settings across remounts", () => {
    const first = renderPage();

    fireEvent.change(screen.getByLabelText("Диапазон экспорта событий"), {
      target: { value: "custom_range" },
    });
    fireEvent.change(screen.getByLabelText("Начало пользовательского диапазона экспорта"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Конец пользовательского диапазона экспорта"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Выбрать основные колонки экспорта" }));
    first.unmount();

    renderPage();

    expect(screen.getByLabelText("Диапазон экспорта событий")).toHaveValue("custom_range");
    expect(screen.getByLabelText("Начало пользовательского диапазона экспорта")).toHaveValue(2);
    expect(screen.getByLabelText("Конец пользовательского диапазона экспорта")).toHaveValue(4);
    expect(screen.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toHaveTextContent(
      /Будет экспортировано 3 событий.*Колонки: 6/i,
    );
  });

  it("shows a safe export preview that reflects filters and export limits", () => {
    renderPage();

    const preview = screen.getByRole("region", { name: "Предпросмотр экспорта событий доступа" });
    expect(preview).toHaveTextContent(/Будет экспортировано 12 событий/i);
    expect(preview).toHaveTextContent(/Форматы: таблица и книга/i);
    expect(preview).not.toHaveTextContent(/email|access_token|storage_object_path/i);

    fireEvent.change(screen.getByLabelText("Тип сущности"), {
      target: { value: "device" },
    });
    expect(preview).toHaveTextContent(/Будет экспортировано 1 событий/i);

    fireEvent.change(screen.getByLabelText("Источник событий"), {
      target: { value: "api" },
    });
    expect(preview).toHaveTextContent(/Нет событий для экспорта/i);
    expect(screen.getByRole("button", { name: "Скачать события доступа таблицей" })).toBeDisabled();
  });

  it("exports all pages by default and supports current-page plus custom row ranges", () => {
    renderPage();

    const preview = screen.getByRole("region", { name: "Предпросмотр экспорта событий доступа" });
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
    expect(preview).toHaveTextContent(/Будет экспортировано 12 событий/i);
    expect(preview).toHaveTextContent(/Диапазон: все страницы/i);

    fireEvent.change(screen.getByLabelText("Диапазон экспорта событий"), {
      target: { value: "current_page" },
    });
    expect(preview).toHaveTextContent(/Будет экспортировано 5 событий/i);
    expect(preview).toHaveTextContent(/Диапазон: текущая страница/i);

    fireEvent.change(screen.getByLabelText("Диапазон экспорта событий"), {
      target: { value: "custom_range" },
    });
    fireEvent.change(screen.getByLabelText("Начало пользовательского диапазона экспорта"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("Конец пользовательского диапазона экспорта"), {
      target: { value: "4" },
    });
    expect(preview).toHaveTextContent(/Будет экспортировано 3 событий/i);
    expect(preview).toHaveTextContent(/Диапазон: строки 2–4/i);
  });

  it("lets system admin choose export columns and blocks empty column export", () => {
    renderPage();

    const preview = screen.getByRole("region", { name: "Предпросмотр экспорта событий доступа" });
    expect(preview).toHaveTextContent(`Колонки: ${ACCESS_EVENT_EXPORT_COLUMNS.length}`);

    fireEvent.click(screen.getByRole("button", { name: "Выбрать основные колонки экспорта" }));
    expect(preview).toHaveTextContent(/Колонки: 6/i);

    for (const column of ACCESS_EVENT_EXPORT_COLUMNS) {
      const checkbox = screen.getByLabelText(`Колонка экспорта: ${column.label}`);
      if ((checkbox as HTMLInputElement).checked) fireEvent.click(checkbox);
    }

    expect(preview).toHaveTextContent(/Выберите хотя бы одну колонку для экспорта/i);
    expect(screen.getByRole("button", { name: "Скачать события доступа таблицей" })).toBeDisabled();

    const selectAllColumnsButton = screen.getByRole("button", { name: "Выбрать все колонки экспорта" });
    expect(selectAllColumnsButton).toHaveClass("min-w-11");
    fireEvent.click(selectAllColumnsButton);
    expect(preview).toHaveTextContent(`Колонки: ${ACCESS_EVENT_EXPORT_COLUMNS.length}`);
  });

  it("opens a safe row details drawer without sensitive fields", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /Подробнее о событии al-005/i })[0]);

    expect(screen.getByRole("heading", { name: "Детали события" })).toBeInTheDocument();
    expect(screen.queryByText("al-005")).not.toBeInTheDocument();
    expect(screen.getAllByText("код скрыт").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Отчёт открыт по ссылке").length).toBeGreaterThan(0);
    expect(screen.getByText(/Почта, ФИО пациента, секретные ключи и места хранения не выводятся/i)).toBeInTheDocument();

    const html = container.innerHTML;
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(html).not.toContain("Иванова Наталья");
    expect(html).not.toContain("access_token");
    expect(html).not.toContain("storage_object_path");
  });

  it("exports a safe CSV without emails, access tokens, or patient full names", async () => {
    const createObjectURL = vi.fn(() => "blob:access-events");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:access-events");
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Табличный файл готов: .*Файл: access-events-\d{4}-\d{2}-\d{2}-all-all-pages-12-rows-11-cols\.csv/i,
    );
    expect(screen.getByRole("progressbar", { name: "Прогресс выгрузки: табличный файл" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Табличный файл: 12 строк\. Результат: Готов\. Диапазон: все страницы\. Колонки: 11/i,
    );

    expect(firstMockArg<Blob>(createObjectURL)).toBeInstanceOf(Blob);
  });

  it("exports XLSX with a safe Blob type and dated filename", async () => {
    const createObjectURL = vi.fn(() => "blob:access-events-xlsx");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа книгой" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:access-events-xlsx");
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Книга готова:/i,
    );
    expect(screen.getByRole("progressbar", { name: "Прогресс выгрузки: книга" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Книга: 12 строк\. Результат: Готов\. Диапазон: все страницы\. Колонки: 11/i,
    );
    const blob = firstMockArg<Blob>(createObjectURL);
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(0);
    expect(accessEventsXlsxFilename("all", "", { scope: "all-pages", rowCount: 12, columnCount: 11 })).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-all-all-pages-12-rows-11-cols\.xlsx$/,
    );
  });

  it("repeats an export from the export log", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:access-events-repeat"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /^Повторить выгрузку: табличный файл/i }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Повторная выгрузка готова: 12 строк/i,
    );
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /access-events-\d{4}-\d{2}-\d{2}-all-all-pages-12-rows-11-cols-repeat\.csv/i,
    );
  });

  it("filters export log entries by format and repeated exports", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:access-events-filtered"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа книгой" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: /^Повторить выгрузку: книга/i }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));

    const exportLog = screen.getByRole("region", { name: "Журнал экспортов событий доступа" });
    fireEvent.change(screen.getByLabelText("Фильтр журнала экспортов"), {
      target: { value: "csv" },
    });
    expect(exportLog).toHaveTextContent(/Табличный файл: 12 строк/i);
    expect(exportLog).not.toHaveTextContent(/Книга: 12 строк/i);

    fireEvent.change(screen.getByLabelText("Фильтр журнала экспортов"), {
      target: { value: "repeated" },
    });
    expect(exportLog).toHaveTextContent(/Повторная выгрузка готова/i);
    expect(exportLog).not.toHaveTextContent(/Табличный файл: 12 строк/i);
  });

  it("cancels an in-progress CSV export without creating a file", async () => {
    const createObjectURL = vi.fn(() => "blob:should-not-create");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    fireEvent.click(screen.getByRole("button", { name: "Отменить выгрузку событий доступа: табличный файл" }));

    await waitFor(() =>
      expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
        /Выгрузка отменена\. Файл не сформирован\./i,
      ),
    );
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Результат: Отменён/i,
    );
  });

  it("announces export errors assertively and records them in the export log", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("download blocked");
      }),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));

    await waitFor(() =>
      expect(screen.getByRole("alert", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
        /Не удалось выполнить выгрузку\. Файл не сформирован\./i,
      ),
    );
    expect(click).not.toHaveBeenCalled();
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Результат: Ошибка/i,
    );

    fireEvent.change(screen.getByLabelText("Фильтр журнала экспортов"), {
      target: { value: "error" },
    });
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Не удалось выполнить выгрузку/i,
    );
  });

  it("logs exports without echoing raw search text", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:access-events"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "Отчёт открыт по ссылке" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const exportLog = screen.getByRole("region", { name: "Журнал экспортов событий доступа" });
    expect(exportLog).toHaveTextContent(/Табличный файл: /i);
    expect(exportLog).toHaveTextContent(/Поиск: есть/i);
    expect(exportLog).not.toHaveTextContent("Отчёт открыт по ссылке");
  });

  it("persists, exports, confirms clear, and restores the export log", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:export-log"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const view = renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText("Фильтр журнала экспортов"), {
      target: { value: "csv" },
    });
    expect(window.localStorage.getItem("derma-pro:sys-access-events:export-log-filter")).toBe("csv");
    await waitFor(() => {
      expect(window.localStorage.getItem("derma-pro:sys-access-events:export-log")).toContain("CSV");
    });

    view.unmount();
    renderPage();
    expect(screen.getByLabelText("Фильтр журнала экспортов")).toHaveValue("csv");
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Табличный файл: 12 строк/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Скачать журнал экспортов таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Журнал экспортов выгружен таблицей/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Скачать журнал экспортов книгой" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(4));
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Журнал экспортов выгружен книгой/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Очистить журнал экспортов" }));
    expect(screen.getByRole("status", { name: "Статус экспорта событий доступа" })).toHaveTextContent(
      /Подтвердите очистку журнала экспортов/i,
    );
    fireEvent.click(screen.getByRole("button", { name: "Отменить очистку журнала экспортов" }));
    expect(screen.getByRole("region", { name: "Журнал экспортов событий доступа" })).toHaveTextContent(
      /Табличный файл: 12 строк/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Очистить журнал экспортов" }));
    fireEvent.click(screen.getByRole("button", { name: "Подтвердить очистку журнала экспортов" }));
    const exportLog = screen.getByRole("region", { name: "Журнал экспортов событий доступа" });
    expect(exportLog).toHaveTextContent(/Экспортов пока нет\.|По выбранному фильтру экспортов нет\./);
    expect(exportLog.querySelector('[role="status"]')).not.toBeNull();
    expect(screen.getByRole("button", { name: "Очистить журнал экспортов" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Скачать журнал экспортов таблицей" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Скачать журнал экспортов книгой" })).toBeDisabled();
  });

  it("searches and paginates the export log without leaking raw row data", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:export-log-pagination"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа книгой" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа таблицей" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole("button", { name: "Скачать события доступа книгой" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(4));

    const exportLog = screen.getByRole("region", { name: "Журнал экспортов событий доступа" });
    expect(exportLog).toHaveTextContent(/1–3 из 4 экспортов/i);
    expect(exportLog).toHaveTextContent(/Страница 1 из 2/i);
    fireEvent.click(exportLog.querySelector('[aria-label="Следующая страница"]') as HTMLButtonElement);
    expect(exportLog).toHaveTextContent(/4–4 из 4 экспортов/i);

    fireEvent.change(screen.getByLabelText("Поиск по журналу экспортов"), {
      target: { value: "xlsx" },
    });
    expect(exportLog).toHaveTextContent(/Книга: 12 строк/i);
    expect(exportLog).not.toHaveTextContent(/Табличный файл: 12 строк/i);
    expect(exportLog).not.toHaveTextContent(/Иванова Наталья|access_token|storage_object_path/i);
  });

  it("builds informative export filenames without raw query text", () => {
    const csvName = accessEventsCsvFilename("clinical", "Отчёт открыт по ссылке", {
      scope: "current-page",
      rowCount: 5,
      columnCount: 6,
    });
    const repeatedName = accessEventsCsvFilename("clinical", "Отчёт открыт по ссылке", {
      scope: "range-2-4",
      rowCount: 3,
      columnCount: 6,
      repeated: true,
    });

    expect(csvName).toMatch(/^access-events-\d{4}-\d{2}-\d{2}-clinical-current-page-5-rows-6-cols-query\.csv$/);
    expect(repeatedName).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-clinical-range-2-4-3-rows-6-cols-query-repeat\.csv$/,
    );
    expect(csvName).not.toContain("report");
    expect(csvName).not.toContain("share");
  });

  it("CSV helper quotes values safely and omits sensitive fields by contract", () => {
    const csv = buildAccessEventsCsv(
      [
        {
          id: "al-test",
          createdAt: "2026-05-11T12:00:00Z",
          clinicName: "Клиника, центр",
          actorLabel: "Сисадмин",
          action: 'event."quoted"',
          entity: "audit",
          entityId: "a-1",
          patientCode: null,
          visitId: null,
          lesionLabel: null,
          source: "demo",
        },
      ],
      { filterLabel: "Клиника · Demo", query: 'report "share"' },
    );
    expect(csv).toContain('"# filter","Клиника · Demo"');
    expect(csv).toContain('"# query","report ""share"""');
    expect(csv).toContain('"# scope","all"');
    expect(csv).toContain('"# columns","11"');
    expect(csv).toContain('"# row_count","1"');
    expect(csv).toContain('"event_id","created_at","clinic","actor","action","entity"');
    expect(csv).toContain('"al-test"');
    expect(csv).toContain('"event.""quoted"""');
    expect(csv).not.toContain("actor_email");
    expect(csv).not.toContain("patient_full_name");
    expect(csv).not.toContain("access_token");
  });

  it("CSV helper exports only selected safe columns", () => {
    const csv = buildAccessEventsCsv(
      [
        {
          id: "al-test",
          createdAt: "2026-05-11T12:00:00Z",
          clinicName: "Клиника",
          actorLabel: "Сисадмин",
          action: "event.export",
          entity: "audit",
          entityId: "a-1",
          patientCode: "DP-2026-0001",
          visitId: null,
          lesionLabel: null,
          source: "demo",
        },
      ],
      {
        filterLabel: "Все",
        query: "",
        scopeLabel: "строки 1–1",
        columns: ["event_id", "action", "patient_code"],
      },
    );

    expect(csv).toContain('"# scope","строки 1–1"');
    expect(csv).toContain('"# columns","3"');
    expect(csv).toContain('"event_id","action","patient_code"');
    expect(csv).toContain('"al-test","event.export","DP-2026-0001"');
    expect(csv).not.toContain('"actor"');
    expect(csv).not.toContain('"clinic"');
  });

  it("caps export rows at the admin access-events export limit", () => {
    const rows = Array.from({ length: ACCESS_EVENTS_EXPORT_LIMIT + 5 }, (_, index) => ({
      id: `al-${index}`,
      createdAt: "2026-05-11T12:00:00Z",
      clinicName: "Клиника",
      actorLabel: "Сисадмин",
      action: "event.export",
      entity: "audit",
      entityId: `a-${index}`,
      patientCode: null,
      visitId: null,
      lesionLabel: null,
      source: "demo" as const,
    }));

    const capped = limitAccessEventExportRows(rows);
    const csv = buildAccessEventsCsv(capped, { filterLabel: "Все", query: "" });

    expect(capped).toHaveLength(ACCESS_EVENTS_EXPORT_LIMIT);
    expect(csv).toContain(`"# row_count","${ACCESS_EVENTS_EXPORT_LIMIT}"`);
    expect(csv).toContain('"al-199"');
    expect(csv).not.toContain('"al-200"');
  });

  it("XLSX helper creates an Office Open XML zip without sensitive field names", async () => {
    const bytes = buildAccessEventsXlsxBytes(
      [
        {
          id: "al-test",
          createdAt: "2026-05-11T12:00:00Z",
          clinicName: "Клиника",
          actorLabel: "Сисадмин",
          action: "event.export",
          entity: "audit",
          entityId: "a-1",
          patientCode: "DP-2026-0001",
          visitId: null,
          lesionLabel: null,
          source: "demo",
        },
      ],
      { filterLabel: "Все", query: "" },
    );
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const decoded = new TextDecoder().decode(bytes);
    expect(decoded).toContain("event_id");
    expect(decoded).toContain("event.export");
    expect(decoded).not.toContain("actor_email");
    expect(decoded).not.toContain("patient_full_name");
    expect(decoded).not.toContain("access_token");
  });
});
