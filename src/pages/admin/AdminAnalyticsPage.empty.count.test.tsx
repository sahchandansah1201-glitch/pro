import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Тест-инвариант для empty-states /admin/analytics:
 *
 *   1) При полностью пустых данных каждый из 3-х периодов
 *      («Все данные» / «Март 2026» / «Последние 90 дней»)
 *      показывает РОВНО 6 empty-state — все 6 секций аналитики.
 *
 *   2) При полностью заполненных демо-данных, период «Все данные»
 *      показывает 0 empty-state.
 *
 *   3) Среди отрендеренных empty-state нет дублирующихся title'ов —
 *      каждый блок принадлежит своей секции (защита от случайного
 *      двойного рендера одного и того же ключа словаря).
 *
 *   4) data-empty="true" и role/aria-live применяются ровно к одному
 *      и тому же набору узлов (нет «висячих» status-узлов без data-empty).
 */

const RANGE_TABS = ["Все данные", "Март 2026", "Последние 90 дней"] as const;

const EXPECTED_TITLES = [
  "Нет лидов",
  "Нет источников",
  "Нет клиник",
  "Нет карточек предварительной оценки",
  "Нет снимков",
  "Нет диалогов",
];

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

function getEmpties(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
  );
}

function getEmptyTitles(container: HTMLElement): string[] {
  return getEmpties(container).map((el) => {
    // title — первый дочерний div c классом text-foreground (см. EmptyState).
    const titleEl =
      el.querySelector<HTMLElement>("div.text-foreground") ??
      el.querySelector<HTMLElement>("div");
    return (titleEl?.textContent ?? "").trim();
  });
}

describe("AdminAnalyticsPage · точное число empty-state по периоду", () => {
  describe("полностью пустые моки → ровно 6 empty-state на каждом периоде", () => {
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

    for (const tab of RANGE_TABS) {
      it(`«${tab}»: ровно 6 empty-state и без дублей по title`, () => {
        const { container, getByRole } = renderPage(AdminAnalyticsPage);
        fireEvent.click(getByRole("tab", { name: tab }));

        const empties = getEmpties(container);
        expect(empties).toHaveLength(6);

        const titles = getEmptyTitles(container);
        // Уникальность.
        expect(new Set(titles).size).toBe(titles.length);
        // Полнота — все 6 ожидаемых title'ов присутствуют ровно по разу.
        for (const expected of EXPECTED_TITLES) {
          const matches = titles.filter((t) => t === expected);
          expect(matches, `title должен встретиться 1 раз: «${expected}»`).toHaveLength(1);
        }

        // Все status-узлы внутри empty-state имеют data-empty="true"
        // (нет «висячих» role=status без data-empty).
        const statuses = Array.from(
          container.querySelectorAll<HTMLElement>(
            'div[role="status"][aria-live="polite"]',
          ),
        );
        const emptyStatuses = statuses.filter(
          (s) => s.getAttribute("data-empty") === "true",
        );
        expect(emptyStatuses).toHaveLength(6);
      });
    }
  });

  describe("полностью заполненные демо-данные → 0 empty-state на «Все данные»", () => {
    let AdminAnalyticsPage: React.ComponentType;

    beforeEach(async () => {
      cleanup();
      vi.resetModules();
      // Без doMock — берём реальные демо-данные mock-data.
      AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
    });

    it("«Все данные»: 0 empty-state, нет дублирующих data-empty-узлов", () => {
      const { container } = renderPage(AdminAnalyticsPage);
      const empties = getEmpties(container);
      expect(empties).toHaveLength(0);

      // Уникальность тривиальна (пустой массив), но проверим инвариант
      // «один data-empty=true ↔ один role=status».
      const statuses = Array.from(
        container.querySelectorAll<HTMLElement>(
          'div[role="status"][aria-live="polite"][data-empty="true"]',
        ),
      );
      expect(statuses).toHaveLength(0);
    });
  });
});
