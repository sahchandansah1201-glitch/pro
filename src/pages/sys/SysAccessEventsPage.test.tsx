import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import {
  ACCESS_EVENTS_EXPORT_LIMIT,
  accessEventsXlsxFilename,
  buildAccessEventsCsv,
  buildAccessEventsXlsxBlob,
  buildAccessEventsXlsxBytes,
  limitAccessEventExportRows,
} from "@/lib/admin-access-events";
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

describe("SysAccessEventsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders system-admin access events without raw emails or patient names", () => {
    const { container } = renderPage();

    expect(screen.getByRole("heading", { name: "События доступа" })).toBeInTheDocument();
    expect(screen.getByText(/RPC list_access_events_admin/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Экспортировать события доступа в CSV" })).toBeEnabled();
    expect(screen.getAllByText("report.share").length).toBeGreaterThan(0);

    const html = container.innerHTML;
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(html).not.toContain("Иванова Наталья");
    expect(html).not.toContain("storage_object_path");
    expect(html).not.toContain("access_token");
  });

  it("blocks non-system-admin roles before rendering rows or export", () => {
    renderPage("clinic_admin");

    expect(screen.getByRole("alert")).toHaveTextContent(/только роли system_admin/i);
    expect(screen.queryByRole("button", { name: "Экспортировать события доступа в CSV" })).not.toBeInTheDocument();
    expect(screen.queryByText("report.share")).not.toBeInTheDocument();
  });

  it("filters rows by query and event bucket", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "report.share" },
    });
    expect(nonOptionTextCount("report.share")).toBeGreaterThan(0);
    expect(nonOptionTextCount("visit.open")).toBe(0);

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Устройства" }));
    expect(nonOptionTextCount("device.register")).toBeGreaterThan(0);
    expect(nonOptionTextCount("report.share")).toBe(0);
  });

  it("filters rows by source, entity, and event date", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Тип сущности"), {
      target: { value: "device" },
    });
    expect(nonOptionTextCount("device.register")).toBeGreaterThan(0);
    expect(nonOptionTextCount("report.share")).toBe(0);

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "2026-03-01" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(nonOptionTextCount("device.register")).toBe(0);

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Источник событий"), {
      target: { value: "api" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(nonOptionTextCount("device.register")).toBe(0);
  });

  it("filters rows by clinic, actor, action, and patient code", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Клиника события"), {
      target: { value: "Дерма-Про · Центр" },
    });
    fireEvent.change(screen.getByLabelText("Актор события"), {
      target: { value: "Врач · u-doc-001" },
    });
    fireEvent.change(screen.getByLabelText("Действие события"), {
      target: { value: "report.generate" },
    });
    fireEvent.change(screen.getByLabelText("Код пациента события"), {
      target: { value: "DP-2026-0001" },
    });

    expect(nonOptionTextCount("report.generate")).toBeGreaterThan(0);
    expect(nonOptionTextCount("report.share")).toBe(0);
    expect(nonOptionTextCount("visit.open")).toBe(0);
    expect(screen.getByText(/клиника: Дерма-Про · Центр/)).toBeInTheDocument();
    expect(screen.getByText(/код пациента: DP-2026-0001/)).toBeInTheDocument();
  });

  it("lets system admin change access-events page size", () => {
    renderPage();

    expect(screen.getByText("1–10 из 12 событий")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
    expect(screen.getByText("1–5 из 12 событий")).toBeInTheDocument();
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
      /Демо-журнал: локальные события загружены/i,
    );

    fireEvent.click(screen.getByRole("button", { name: "Обновить события доступа" }));
    expect(screen.getByRole("button", { name: /Обновление доступно через/i })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Журнал запросов событий доступа" })).toHaveTextContent(
      /Обновление событий: запрошено, лимит 200/i,
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

  it("opens a safe row details drawer without sensitive fields", () => {
    const { container } = renderPage();

    fireEvent.click(screen.getAllByRole("button", { name: /Подробнее о событии al-005/i })[0]);

    expect(screen.getByRole("heading", { name: "Детали события" })).toBeInTheDocument();
    expect(screen.getByText("al-005")).toBeInTheDocument();
    expect(screen.getAllByText("report.share").length).toBeGreaterThan(0);
    expect(screen.getByText(/Email, ФИО пациента, токены и storage-пути не выводятся/i)).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать события доступа в CSV" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:access-events");
    expect(screen.getByText(/CSV экспортирован:/)).toBeInTheDocument();

    expect(createObjectURL.mock.calls[0][0]).toBeInstanceOf(Blob);
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
    fireEvent.click(screen.getByRole("button", { name: "Экспортировать события доступа в XLSX" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:access-events-xlsx");
    expect(screen.getByText(/XLSX экспортирован:/)).toBeInTheDocument();
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(0);
    expect(accessEventsXlsxFilename("all", "")).toMatch(/^access-events-\d{4}-\d{2}-\d{2}-all\.xlsx$/);
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
    expect(csv).toContain('"# row_count","1"');
    expect(csv).toContain('"event_id","created_at","clinic","actor","action","entity"');
    expect(csv).toContain('"al-test"');
    expect(csv).toContain('"event.""quoted"""');
    expect(csv).not.toContain("actor_email");
    expect(csv).not.toContain("patient_full_name");
    expect(csv).not.toContain("access_token");
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
