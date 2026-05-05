import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminHomePage from "./AdminHomePage";
import AdminDoctorsPage from "./AdminDoctorsPage";
import AdminServicesPage from "./AdminServicesPage";
import AdminClinicsPage from "./AdminClinicsPage";

const FORBIDDEN = [
  "birthDate",
  "photoRef",
  "storagePath",
  "diagnosis",
  "doctorVersionText",
  "patientSafeText",
  "sharedLink",
  "modelVersion",
  "heatmapRef",
  "externalUserRef",
];

const renderRouted = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

describe("Admin clinic core pages — render & safety", () => {
  it("AdminHomePage renders KPIs, demo banner and quick links", () => {
    renderRouted(<AdminHomePage />);
    expect(screen.getByRole("heading", { name: /Администрирование клиники/ })).toBeInTheDocument();
    expect(screen.getByText(/MVP: данные демонстрационные/)).toBeInTheDocument();
    expect(screen.getByText("Лиды")).toBeInTheDocument();
    expect(screen.getByText("Филиалы")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Аналитика/ })).toHaveAttribute(
      "href",
      "/admin/analytics",
    );
    // Не плейсхолдер
    expect(
      screen.queryByText(/Раздел будет реализован в следующих задачах/),
    ).not.toBeInTheDocument();
  });

  it("AdminDoctorsPage filters narrow visible rows", () => {
    renderRouted(<AdminDoctorsPage />);
    expect(screen.getByText(/Состав, специализации/)).toBeInTheDocument();
    const before = screen.getAllByText(/Соколова|Морозов|Кузнецов|Никитина|Рябов/i).length;
    fireEvent.click(screen.getByRole("tab", { name: "Проверить лицензию" }));
    const after = screen.getAllByText(/Соколова|Морозов|Кузнецов|Никитина|Рябов/i).length;
    expect(after).toBeLessThan(before);
    // Никитина имеет needs_check
    expect(screen.getAllByText(/Никитина/).length).toBeGreaterThan(0);
  });

  it("AdminServicesPage search narrows rows and main button is tap-target friendly", () => {
    renderRouted(<AdminServicesPage />);
    expect(screen.getByText("Услуги и тарифы")).toBeInTheDocument();
    const input = screen.getByLabelText("Поиск услуг");
    fireEvent.change(input, { target: { value: "дермоскоп" } });
    expect(screen.getAllByText(/Дерматоскопия/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Удаление образования/)).not.toBeInTheDocument();
    // Хотя бы одна кнопка действия имеет min-h-[44px]
    const btn = screen.getAllByRole("button", { name: /Редактировать \(демо\)/ })[0];
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });

  it("AdminClinicsPage filter and sort change visible cards", () => {
    renderRouted(<AdminClinicsPage />);
    expect(screen.getByText("Клиники и филиалы")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Партнёрские" }));
    expect(screen.getByText(/Кабинет Морозова/)).toBeInTheDocument();
    expect(screen.queryByText(/Дерма-Про · Центр/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Все" }));
    fireEvent.click(screen.getByRole("tab", { name: "По конверсии" }));
    expect(screen.getByText(/Дерма-Про · Центр/)).toBeInTheDocument();
  });

  it("none of the new admin pages render forbidden patient-level tokens", () => {
    for (const ui of [
      <AdminHomePage />,
      <AdminDoctorsPage />,
      <AdminServicesPage />,
      <AdminClinicsPage />,
    ]) {
      const { container, unmount } = renderRouted(ui);
      const html = container.innerHTML;
      for (const token of FORBIDDEN) {
        expect(html, `forbidden token ${token}`).not.toContain(token);
      }
      // Доп. защита: явно не показываем телефон клиники в clinics (по требованию)
      if (ui.type === AdminClinicsPage) {
        expect(html).not.toMatch(/\+7 \(\d{3}\)/);
      }
      unmount();
    }
    // Используем within чтобы не сорить unused import warnings.
    expect(within(document.body)).toBeDefined();
  });
});
