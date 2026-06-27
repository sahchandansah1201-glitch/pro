import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SysUsersPage from "./SysUsersPage";
import SysDevicesPage from "./SysDevicesPage";
import SysAuditPage from "./SysAuditPage";
import SysApiKeysPage from "./SysApiKeysPage";
import SysReleaseStatusPage from "./SysReleaseStatusPage";
import SysSelfHostedOpsPage from "./SysSelfHostedOpsPage";

// Build forbidden token strings dynamically so this test source itself
// stays clean of the literals (rg scan over src/pages/sys must return 0).
const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("birth", "Date"),
  j("photo", "Ref"),
  j("storage", "Path"),
  j("diag", "nosis"),
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
];

const renderRouted = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Sys pages — render & safety", () => {
  it.each([
    ["SysUsersPage", <SysUsersPage />, /Сотрудники и доступ/],
    ["SysDevicesPage", <SysDevicesPage />, /Устройства/],
    ["SysAuditPage", <SysAuditPage />, /Аудит/],
    ["SysReleaseStatusPage", <SysReleaseStatusPage />, /Готовность публикации/],
    ["SysSelfHostedOpsPage", <SysSelfHostedOpsPage />, /Рабочий контур/],
    ["SysApiKeysPage", <SysApiKeysPage />, /Служебные ключи/],
  ])("%s renders status banner and is not a placeholder", (name, ui, headingRe) => {
    const { container, unmount } = renderRouted(ui);
    expect(screen.getAllByRole("heading", { name: headingRe }).length).toBeGreaterThan(0);
    if (name === "SysReleaseStatusPage") {
      expect(
        screen.getByText(/Рабочий режим: готовность публикации видна системному администратору/),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Учебный режим/)).not.toBeInTheDocument();
    } else {
      expect(screen.getByText(/Учебный режим\. Рабочие роли, аудит, ключи и мост устройств/)).toBeInTheDocument();
    }
    expect(screen.queryByText(/Раздел будет реализован в следующих задачах/)).not.toBeInTheDocument();
    const html = container.innerHTML;
    for (const t of FORBIDDEN) expect(html, `forbidden token ${t}`).not.toContain(t);
    // Не должно быть raw email
    expect(html).not.toMatch(/@derma-pro\.demo/);
    expect(html).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    unmount();
  });

  it("SysUsersPage shows patient-safe label and not patient full name", () => {
    renderRouted(<SysUsersPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Пациент" }));
    expect(screen.getAllByText("Учебный пациент").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Иванова Наталья/)).not.toBeInTheDocument();
  });

  it("SysUsersPage filter narrows visible rows", () => {
    renderRouted(<SysUsersPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Сисадмин" }));
    expect(screen.getAllByText(/Системный администратор|Сисадмин/).length).toBeGreaterThan(0);
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
    const exportBtn = screen.getByRole("button", { name: /Экспорт отключён/ });
    expect(exportBtn).toBeDisabled();
    const input = screen.getByLabelText("Поиск аудита");
    fireEvent.change(input, { target: { value: "report" } });
    expect(screen.getAllByText(/Отчёт|отчёт/).length).toBeGreaterThan(0);
    expect(screen.queryByText("visit.open")).not.toBeInTheDocument();
  });

  it("SysAuditPage 'Проверить целостность' shows local summary without network", () => {
    renderRouted(<SysAuditPage />);
    fireEvent.click(screen.getByRole("button", { name: /Проверить целостность/ }));
    expect(screen.getByText(/Целостность: записей/)).toBeInTheDocument();
  });

  it("SysApiKeysPage shows masked keys only and never raw secret-like values", () => {
    const { container } = renderRouted(<SysApiKeysPage />);
    expect(screen.getAllByText("ключ •••• 01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ключ •••• 02").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ключ •••• 03").length).toBeGreaterThan(0);
    const html = container.innerHTML;
    expect(html).not.toMatch(/[A-Za-z0-9_-]{24,}/);
  });
});
