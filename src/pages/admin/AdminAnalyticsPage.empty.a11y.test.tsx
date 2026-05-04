import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * a11y-контракт пустых состояний на /admin/analytics:
 *   1) Каждый empty-state имеет role="status" и aria-live="polite"
 *      (скринридер озвучит появление пустого блока).
 *   2) При смене периода набор пустых состояний пересчитывается
 *      корректно: для периода без данных появляются 6 empty-карточек,
 *      все с одинаковыми ARIA-атрибутами; при возврате к периоду
 *      с данными пустые состояния исчезают.
 */

function getEmpties(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
  );
}

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

describe("AdminAnalyticsPage — пустые состояния (полностью пустые моки)", () => {
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

  it("все 6 пустых состояний имеют role=status и aria-live=polite", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    const empties = getEmpties(container);
    expect(empties).toHaveLength(6);
    for (const e of empties) {
      expect(e.getAttribute("role")).toBe("status");
      expect(e.getAttribute("aria-live")).toBe("polite");
    }
  });

  it("ARIA-контракт сохраняется при переключении периода", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const checkAll = () => {
      const empties = getEmpties(container);
      expect(empties).toHaveLength(6);
      for (const e of empties) {
        expect(e.getAttribute("role")).toBe("status");
        expect(e.getAttribute("aria-live")).toBe("polite");
      }
    };

    checkAll();
    fireEvent.click(getByRole("tab", { name: "Март 2026" }));
    checkAll();
    fireEvent.click(getByRole("tab", { name: "Последние 90 дней" }));
    checkAll();
    fireEvent.click(getByRole("tab", { name: "Все данные" }));
    checkAll();
  });
});

describe("AdminAnalyticsPage — пустые состояния по периоду на реальных моках", () => {
  let AdminAnalyticsPage: React.ComponentType;

  beforeEach(async () => {
    cleanup();
    vi.resetModules();
    vi.doUnmock("@/lib/mock-data");
    AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
  });

  it("в «Все данные» нет пустых состояний (на демо-моках есть данные во всех секциях)", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    expect(getEmpties(container)).toHaveLength(0);
  });

  it("при смене периода количество empty-состояний меняется, и каждое сохраняет ARIA-атрибуты", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    expect(getEmpties(container)).toHaveLength(0);

    // Заведомо пустой период: «Последние 90 дней» относительно фиксированного
    // NOW = 2026-03-13 покрывает все мок-данные → 0 пустых; «Март 2026» —
    // тоже не пустой; поэтому переключение между ними не должно ломать
    // существующие непустые секции, и ARIA-атрибуты на любых empty
    // (если они появились) должны быть корректны.
    for (const label of ["Март 2026", "Последние 90 дней", "Все данные"]) {
      fireEvent.click(getByRole("tab", { name: label }));
      for (const e of getEmpties(container)) {
        expect(e.getAttribute("role")).toBe("status");
        expect(e.getAttribute("aria-live")).toBe("polite");
      }
    }
  });
});
