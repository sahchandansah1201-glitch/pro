import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Тесты CTA-кнопки в empty-states секций /admin/analytics.
 *
 * Цель — пользователю не нужно искать переключатель периода вверху,
 * чтобы выйти из «пустого» среза: рядом с пустым состоянием есть
 * явная кнопка для смены диапазона.
 *
 * Контракт:
 *   - на «Все данные» CTA предлагает «Последние 90 дней»;
 *   - на любом другом периоде CTA предлагает «Показать все данные»;
 *   - клик по CTA реально переключает период (aria-selected на табе);
 *   - empty-state секции «клиники» не зависит от периода и не имеет CTA.
 */

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

describe("AdminAnalyticsPage · empty CTA · смена периода из empty-state", () => {
  let AdminAnalyticsPage: React.ComponentType;

  beforeEach(async () => {
    cleanup();
    vi.resetModules();
    vi.doMock("@/lib/mock-data", () => ({
      getLeads: () => [],
      getAppointments: () => [],
      getDialogs: () => [],
      getAnalysisCards: () => [],
      getClinics: () => [],
    }));
    AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
  });

  afterEach(() => {
    vi.doUnmock("@/lib/mock-data");
  });

  it("на «Все данные» empty-states имеют CTA «Попробовать “Последние 90 дней”»", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    const try90 = container.querySelectorAll<HTMLButtonElement>(
      'button[data-empty-action="try-90d"]',
    );
    expect(try90.length).toBeGreaterThan(0);
    try90.forEach((b) => {
      expect(b.textContent).toMatch(/Последние 90 дней/);
    });
    // На «Все данные» CTA reset-range отсутствует.
    expect(
      container.querySelectorAll('button[data-empty-action="reset-range"]').length,
    ).toBe(0);
  });

  it("клик по CTA «Попробовать “Последние 90 дней”» переключает активный таб", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    const cta = container.querySelector<HTMLButtonElement>(
      'button[data-empty-action="try-90d"]',
    );
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);
    expect(
      getByRole("tab", { name: "Последние 90 дней" }).getAttribute("aria-selected"),
    ).toBe("true");
  });

  it("после переключения на «Март 2026» empty-states получают CTA «Показать все данные»", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    const reset = container.querySelectorAll<HTMLButtonElement>(
      'button[data-empty-action="reset-range"]',
    );
    expect(reset.length).toBeGreaterThan(0);
    reset.forEach((b) => {
      expect(b.textContent).toMatch(/Показать все данные/);
      expect(b.getAttribute("aria-label")).toMatch(/Март 2026/);
    });
  });

  it("клик по CTA «Показать все данные» возвращает таб «Все данные»", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    const cta = container.querySelector<HTMLButtonElement>(
      'button[data-empty-action="reset-range"]',
    );
    fireEvent.click(cta!);
    expect(getByRole("tab", { name: "Все данные" }).getAttribute("aria-selected")).toBe("true");
  });

  it("empty-state секции «клиники» не содержит CTA смены периода", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    const empties = Array.from(
      container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
    );
    const clinicEmpty = empties.find((el) =>
      /Нет клиник/.test(el.textContent ?? ""),
    );
    expect(clinicEmpty).toBeDefined();
    expect(within(clinicEmpty!).queryByRole("button")).toBeNull();

    // Остальные 5 empty-state имеют CTA-кнопку.
    const others = empties.filter((el) => el !== clinicEmpty);
    expect(others.length).toBe(5);
    others.forEach((el) => {
      expect(within(el).getByRole("button")).toBeInTheDocument();
    });
  });
});
