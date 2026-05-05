import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import BotMiniAppBookingPage from "./BotMiniAppBookingPage";
import { CLINICS, getAppointments, getLeads } from "@/lib/mock-data";

const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("photo", "Ref"),
  j("storage", "Path"),
  j("shared", "Link"),
  j("diag", "nosis"),
  j("external", "User", "Ref"),
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <BotMiniAppBookingPage />
    </MemoryRouter>,
  );

describe("BotMiniAppBookingPage", () => {
  it("рендерит мини-эпп и список клиник", () => {
    const { container } = renderPage();
    expect(screen.getAllByText(/Запись в клинику/)[0]).toBeInTheDocument();
    expect(screen.getByText(/Шаг 1/)).toBeInTheDocument();
    expect(screen.getByText(CLINICS[0].name)).toBeInTheDocument();
    for (const t of FORBIDDEN) expect(container.innerHTML).not.toContain(t);
  });

  it("проходит локальный flow: клиника → слот → подтверждение → done", () => {
    renderPage();
    fireEvent.click(screen.getByText(CLINICS[0].name));
    // Выбираем слот и продолжаем
    const slotBtns = screen.getAllByRole("button").filter((b) => /\d{2}:\d{2}/.test(b.textContent ?? ""));
    expect(slotBtns.length).toBeGreaterThan(0);
    fireEvent.click(slotBtns[0]);
    fireEvent.click(screen.getByRole("button", { name: /Продолжить/ }));
    fireEvent.click(screen.getByRole("button", { name: /Подтвердить демо-запись/ }));
    expect(screen.getByText(/Демо-запись создана локально/)).toBeInTheDocument();
  });

  it("не мутирует глобальные mock-данные (leads/appointments)", () => {
    const beforeLeads = getLeads().length;
    const beforeAppts = getAppointments().length;
    renderPage();
    fireEvent.click(screen.getByText(CLINICS[0].name));
    expect(getLeads().length).toBe(beforeLeads);
    expect(getAppointments().length).toBe(beforeAppts);
  });

  it("кнопки навигации имеют min-h 44px (мобильные tap-targets)", () => {
    const { container } = renderPage();
    const clinicBtn = screen.getByText(CLINICS[0].name).closest("button")!;
    expect(clinicBtn.className).toMatch(/min-h-\[44px\]/);
    void within;
    void container;
  });
});
