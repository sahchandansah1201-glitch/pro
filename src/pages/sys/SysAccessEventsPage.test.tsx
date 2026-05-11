import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import {
  accessEventsXlsxFilename,
  buildAccessEventsCsv,
  buildAccessEventsXlsxBlob,
  buildAccessEventsXlsxBytes,
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

describe("SysAccessEventsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
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
    expect(screen.getAllByText("report.share").length).toBeGreaterThan(0);
    expect(screen.queryByText("visit.open")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Поиск событий доступа"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("tab", { name: "Устройства" }));
    expect(screen.getAllByText("device.register").length).toBeGreaterThan(0);
    expect(screen.queryByText("report.share")).not.toBeInTheDocument();
  });

  it("filters rows by source, entity, and event date", () => {
    renderPage();

    fireEvent.change(screen.getByLabelText("Тип сущности"), {
      target: { value: "device" },
    });
    expect(screen.getAllByText("device.register").length).toBeGreaterThan(0);
    expect(screen.queryByText("report.share")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "2026-03-01" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(screen.queryByText("device.register")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Дата события с"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Источник событий"), {
      target: { value: "api" },
    });
    expect(screen.getByText("Найдено: 0")).toBeInTheDocument();
    expect(screen.queryByText("device.register")).not.toBeInTheDocument();
  });

  it("lets system admin change access-events page size", () => {
    renderPage();

    expect(screen.getByText("1–10 из 12 событий")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Размер страницы событий"), {
      target: { value: "5" },
    });
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
