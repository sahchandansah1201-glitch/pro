import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { RoleProvider } from "@/context/RoleContext";
import { ROLE_STORAGE_KEY } from "@/context/role-context";
import { buildAccessEventsCsv } from "@/lib/admin-access-events";
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
    expect(screen.getByText(/public\.access_events_admin/)).toBeInTheDocument();
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

  it("CSV helper quotes values safely and omits sensitive fields by contract", () => {
    const csv = buildAccessEventsCsv([
        {
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
      ]);
    expect(csv).toContain('"event.""quoted"""');
    expect(csv).toContain("created_at,clinic,actor,action,entity");
    expect(csv).not.toContain("actor_email");
    expect(csv).not.toContain("patient_full_name");
    expect(csv).not.toContain("access_token");
  });
});
