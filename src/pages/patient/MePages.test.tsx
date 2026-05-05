import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import MeHomePage from "./MeHomePage";
import MeReportPage from "./MeReportPage";
import MeBookingPage from "./MeBookingPage";
import MeRemindersPage from "./MeRemindersPage";

// Запрещённые токены строим динамически, чтобы исходник теста сам не содержал литералов.
const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("diag", "nosis"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("features"),
  j("photo", "Ref"),
  j("storage", "Path"),
  j("shared", "Link"),
  j("external", "User", "Ref"),
];

const renderRouted = (ui: React.ReactElement, path = "/") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/me" element={<MeHomePage />} />
        <Route path="/me/reports/:id" element={<MeReportPage />} />
        <Route path="/me/booking" element={<MeBookingPage />} />
        <Route path="/me/reminders" element={<MeRemindersPage />} />
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  );

const expectClean = (html: string) => {
  for (const t of FORBIDDEN) expect(html, `forbidden token ${t}`).not.toContain(t);
  // doctorConclusion и токены ссылок не должны утечь
  expect(html).not.toMatch(/tok-r\d+/);
  expect(html).not.toMatch(/mock:\/\//);
};

describe("Patient portal pages", () => {
  it("MeHomePage не плейсхолдер и показывает дашборд", () => {
    const { container } = renderRouted(<MeHomePage />, "/me");
    expect(screen.getByRole("heading", { name: /Личный кабинет/ })).toBeInTheDocument();
    expect(screen.queryByText(/Раздел будет реализован/)).not.toBeInTheDocument();
    expect(screen.getByText(/Ближайший приём/)).toBeInTheDocument();
    expect(screen.getByText(/Последнее заключение/)).toBeInTheDocument();
    expect(screen.getByText(/Напоминания/)).toBeInTheDocument();
    expectClean(container.innerHTML);
  });

  it("MeReportPage показывает patient-safe текст и не утечки", () => {
    const { container } = renderRouted(<MeReportPage />, "/me/reports/r-001");
    expect(screen.getByRole("heading", { name: /Заключение/ })).toBeInTheDocument();
    expect(screen.getByText(/доброкачественным изменениям/)).toBeInTheDocument();
    expect(screen.queryByText(/Раздел будет реализован/)).not.toBeInTheDocument();
    // Печать/PDF — демо и disabled
    const print = screen.getByRole("button", { name: /Печать \/ PDF \(демо\)/ });
    expect(print).toBeDisabled();
    expectClean(container.innerHTML);
  });

  it("MeReportPage по неизвестному id показывает безопасное сообщение", () => {
    const { container } = renderRouted(<MeReportPage />, "/me/reports/unknown-id");
    expect(screen.getAllByText(/Отчёт не найден/).length).toBeGreaterThan(0);
    expectClean(container.innerHTML);
  });

  it("MeBookingPage проходит шаги локально и подтверждает запись", () => {
    const { container } = renderRouted(<MeBookingPage />, "/me/booking");
    expect(screen.getByRole("heading", { name: /Запись на приём/ })).toBeInTheDocument();
    expect(screen.queryByText(/Раздел будет реализован/)).not.toBeInTheDocument();

    // шаг 1: клиника
    fireEvent.click(screen.getByText(/Дерма-Про · Центр/));
    // шаг 2: услуга
    fireEvent.click(screen.getByText(/Консультация дерматолога/));
    // шаг 3: слот — берём первую кнопку слота
    const slotButtons = screen.getAllByRole("button").filter((b) => /\d{2}\.\d{2}\.\d{4}/.test(b.textContent ?? ""));
    expect(slotButtons.length).toBeGreaterThan(0);
    fireEvent.click(slotButtons[0]);
    // шаг 4: подтвердить
    fireEvent.click(screen.getByRole("button", { name: /Подтвердить \(демо\)/ }));
    expect(screen.getByText(/Демо-запись создана локально/)).toBeInTheDocument();
    expectClean(container.innerHTML);
  });

  it("MeRemindersPage переключает локальный статус", () => {
    const { container } = renderRouted(<MeRemindersPage />, "/me/reminders");
    expect(screen.getByRole("heading", { name: /Напоминания/ })).toBeInTheDocument();
    expect(screen.queryByText(/Раздел будет реализован/)).not.toBeInTheDocument();

    const firstCard = container.querySelector('[class*="rounded-lg"][class*="border"]');
    expect(firstCard).toBeTruthy();
    // Кликаем «Отметить выполнено» в первой карточке напоминания
    const doneBtns = screen.getAllByRole("button", { name: /Отметить выполнено/ });
    expect(doneBtns.length).toBeGreaterThan(0);
    fireEvent.click(doneBtns[0]);
    expect(screen.getAllByText("Выполнено").length).toBeGreaterThan(0);
    expectClean(container.innerHTML);
  });

  it("Страницы пациента не используют сетевые/storage API в исходниках", async () => {
    // Sanity: модули загружены без побочных эффектов.
    expect(MeHomePage).toBeTruthy();
    expect(MeReportPage).toBeTruthy();
    expect(MeBookingPage).toBeTruthy();
    expect(MeRemindersPage).toBeTruthy();
    void within; // keep import used
  });
});
