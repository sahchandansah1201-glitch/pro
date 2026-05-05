import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SysUsersPage from "./SysUsersPage";
import SysDevicesPage from "./SysDevicesPage";
import SysAuditPage from "./SysAuditPage";
import SysApiKeysPage from "./SysApiKeysPage";

const FORBIDDEN = [
  "birthDate", "photoRef", "storagePath", "diagnosis",
  "doctorVersionText", "patientSafeText", "sharedLink",
  "modelVersion", "heatmapRef", "externalUserRef",
];

const renderRouted = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Sys pages — render & safety", () => {
  it.each([
    ["SysUsersPage", <SysUsersPage />, /Пользователи и роли/],
    ["SysDevicesPage", <SysDevicesPage />, /Устройства/],
    ["SysAuditPage", <SysAuditPage />, /Аудит/],
    ["SysApiKeysPage", <SysApiKeysPage />, /API-ключи/],
  ])("%s renders demo banner and is not a placeholder", (_n, ui, headingRe) => {
    const { container, unmount } = renderRouted(ui);
    expect(screen.getAllByRole("heading", { name: headingRe }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Демо-режим\. Реальные роли, RLS, аудит, ключи и Device Bridge/)).toBeInTheDocument();
    expect(screen.queryByText(/Раздел будет реализован в следующих задачах/)).not.toBeInTheDocument();
    const html = container.innerHTML;
    for (const t of FORBIDDEN) expect(html, `forbidden token ${t}`).not.toContain(t);
    // Не должно быть raw email
    expect(html).not.toMatch(/@derma-pro\.demo/);
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    unmount();
  });

  it("SysUsersPage shows 'Демо-пациент' label and not patient full name", () => {
    renderRouted(<SysUsersPage />);
    expect(screen.getAllByText("Демо-пациент").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Иванова Наталья/)).not.toBeInTheDocument();
  });

  it("SysUsersPage filter narrows visible rows", () => {
    renderRouted(<SysUsersPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Сисадмин" }));
    expect(screen.getByText("u-sys-001")).toBeInTheDocument();
    expect(screen.queryByText("u-doc-001")).not.toBeInTheDocument();
  });

  it("SysDevicesPage filter narrows devices", () => {
    renderRouted(<SysDevicesPage />);
    expect(screen.getAllByText(/DermLite|FotoFinder|Heine/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "Не в сети" }));
    expect(screen.getAllByText(/DermLite DL3N/).length).toBeGreaterThan(0);
  });

  it("SysAuditPage export button is disabled and search narrows rows", () => {
    renderRouted(<SysAuditPage />);
    const exportBtn = screen.getByRole("button", { name: /Экспорт \(демо, отключено\)/ });
    expect(exportBtn).toBeDisabled();
    const input = screen.getByLabelText("Поиск аудита");
    fireEvent.change(input, { target: { value: "report.share" } });
    expect(screen.getAllByText("report.share").length).toBeGreaterThan(0);
    expect(screen.queryByText("visit.open")).not.toBeInTheDocument();
  });

  it("SysAuditPage 'Проверить целостность' shows local summary without network", () => {
    renderRouted(<SysAuditPage />);
    fireEvent.click(screen.getByRole("button", { name: /Проверить целостность/ }));
    expect(screen.getByText(/Целостность \(локально\)/)).toBeInTheDocument();
  });

  it("SysApiKeysPage shows masked keys only and never raw secret-like values", () => {
    const { container } = renderRouted(<SysApiKeysPage />);
    expect(screen.getByText("dp_demo_••••_01")).toBeInTheDocument();
    expect(screen.getByText("bridge_demo_••••_02")).toBeInTheDocument();
    expect(screen.getByText("crm_demo_••••_03")).toBeInTheDocument();
    const html = container.innerHTML;
    // Маска должна содержать символы маскирования, а не длинные «секретоподобные» строки
    expect(html).not.toMatch(/[A-Za-z0-9_-]{24,}/);
  });
});
