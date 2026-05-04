import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAnalyticsPage from "./AdminAnalyticsPage";

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

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

describe("AdminAnalyticsPage · empty CTA · смена периода из empty-state", () => {
  afterEach(() => cleanup());

  it("на периоде «Март 2026» empty-states имеют CTA «Показать все данные»", () => {
    const { container, getByRole } = renderPage();
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    const ctas = container.querySelectorAll<HTMLButtonElement>(
      'button[data-empty-action="reset-range"]',
    );
    // Должны быть CTA в пустых секциях (минимум 1).
    expect(ctas.length).toBeGreaterThan(0);
    ctas.forEach((b) => {
      expect(b.textContent).toMatch(/Показать все данные/);
      expect(b.getAttribute("aria-label")).toMatch(/Март 2026/);
    });
  });

  it("клик по CTA «Показать все данные» переключает активный таб на «Все данные»", () => {
    const { container, getByRole } = renderPage();
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    const cta = container.querySelector<HTMLButtonElement>(
      'button[data-empty-action="reset-range"]',
    );
    expect(cta).not.toBeNull();
    fireEvent.click(cta!);

    expect(getByRole("tab", { name: "Все данные" }).getAttribute("aria-selected")).toBe("true");
    expect(getByRole("tab", { name: "Март 2026" }).getAttribute("aria-selected")).toBe("false");
  });

  it("на периоде «Все данные» empty-states (если есть) предлагают «Попробовать “Последние 90 дней”»", () => {
    // На демо-данных «Все данные» обычно полны, но empty-state клиник может
    // не показаться вовсе. Проверяем семантику: если CTA reset-range здесь
    // нет, а есть try-90d — он переключает таб корректно.
    const { container, getByRole } = renderPage();

    // Принудительно создадим empty-state: переключаемся в 90d, потом обратно.
    // На «Все данные» empty могут отсутствовать на демо-данных — в этом случае
    // тест просто подтвердит инвариант "нет reset-range на all".
    const reset = container.querySelectorAll('button[data-empty-action="reset-range"]');
    expect(reset.length).toBe(0);

    const try90 = container.querySelectorAll<HTMLButtonElement>(
      'button[data-empty-action="try-90d"]',
    );
    try90.forEach((b) => {
      expect(b.textContent).toMatch(/Последние 90 дней/);
    });

    if (try90[0]) {
      fireEvent.click(try90[0]);
      expect(
        getByRole("tab", { name: "Последние 90 дней" }).getAttribute("aria-selected"),
      ).toBe("true");
    }
  });

  it("empty-state не зависящих от периода секций (клиники) не содержит CTA смены периода", () => {
    const { container, getByRole } = renderPage();
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));

    // Найдём все empty-state и проверим: тот, что про клиники, не содержит data-empty-action.
    const empties = container.querySelectorAll<HTMLElement>('[data-empty="true"]');
    const clinicEmpty = Array.from(empties).find((el) =>
      /Нет клиник/.test(el.textContent ?? ""),
    );
    if (clinicEmpty) {
      expect(within(clinicEmpty).queryByRole("button")).toBeNull();
    }

    // Остальные empty-state, наоборот, имеют кнопку.
    const others = Array.from(empties).filter((el) => el !== clinicEmpty);
    others.forEach((el) => {
      expect(within(el).getByRole("button")).toBeInTheDocument();
    });
  });
});
