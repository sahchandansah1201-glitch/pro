import { describe, it, expect, vi, beforeAll } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Visual snapshot-контракт для пустых состояний на /admin/analytics.
 * При полностью пустых моках на странице должно быть ровно 6 одинаково
 * выглядящих empty-карточек (по одной на каждую секцию). Снимаем
 * их outerHTML, чтобы любое расхождение в разметке/классах одной
 * из секций сразу всплывало в diff.
 */

vi.mock("@/lib/mock-data", () => ({
  getLeads: () => [],
  getAppointments: () => [],
  getDialogs: () => [],
  getAnalysisCards: () => [],
  getClinics: () => [],
}));

let AdminAnalyticsPage: React.ComponentType;

beforeAll(async () => {
  AdminAnalyticsPage = (await import("./AdminAnalyticsPage")).default;
});

function renderEmpty() {
  return render(
    <MemoryRouter>
      <AdminAnalyticsPage />
    </MemoryRouter>,
  );
}

function getEmptyStates(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
  );
}

/** Нормализуем к данным, существенным для визуального контракта. */
function normalize(el: HTMLElement) {
  const title = el.querySelector("div.text-foreground")?.textContent ?? null;
  const hint =
    el.querySelector("div.text-muted-foreground")?.textContent ?? null;
  return {
    role: el.getAttribute("role"),
    ariaLive: el.getAttribute("aria-live"),
    className: el.getAttribute("class"),
    title,
    hint,
    iconTag: el.querySelector("svg")?.tagName.toLowerCase() ?? null,
  };
}

describe("AdminAnalyticsPage — empty states snapshot", () => {
  it("на странице ровно 6 пустых состояний", () => {
    const { container } = renderEmpty();
    expect(getEmptyStates(container)).toHaveLength(6);
  });

  it("снимок всех 6 empty states (заголовки + структура)", () => {
    const { container } = renderEmpty();
    const snap = getEmptyStates(container).map(normalize);
    expect(snap).toMatchSnapshot();
  });

  it("все empty-карточки имеют одинаковый набор CSS-классов и обёртку", () => {
    const { container } = renderEmpty();
    const empties = getEmptyStates(container);
    const classNames = empties.map((e) => e.getAttribute("class"));
    const unique = new Set(classNames);
    expect(unique.size).toBe(1);

    // Каждый empty-state должен содержать иконку, заголовок и подсказку
    // в одной и той же структуре.
    for (const e of empties) {
      expect(e.querySelector("svg")).toBeTruthy();
      expect(e.querySelector(".text-foreground")?.textContent?.trim()).toBeTruthy();
      expect(
        e.querySelector(".text-muted-foreground")?.textContent?.trim(),
      ).toBeTruthy();
      expect(e.getAttribute("role")).toBe("status");
      expect(e.getAttribute("aria-live")).toBe("polite");
    }
  });

  it("первый и последний empty-state визуально совпадают по обёртке", () => {
    const { container } = renderEmpty();
    const empties = getEmptyStates(container);
    const first = empties[0];
    const last = empties[empties.length - 1];
    // Обёртка (классы, role, aria-live, иконка) идентична — отличаются только тексты.
    expect(first.getAttribute("class")).toBe(last.getAttribute("class"));
    expect(first.querySelector("svg")?.outerHTML).toBe(
      last.querySelector("svg")?.outerHTML,
    );
  });
});
