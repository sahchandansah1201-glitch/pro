import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

/**
 * Тесты стабильности ARIA-контракта empty-states при повторных
 * взаимодействиях с табами периода.
 *
 * Контракт:
 *   1) Все empty-state имеют единообразные aria-live="polite" и role="status"
 *      (никаких "assertive", "off", "alert" и т.п.).
 *   2) Многократные клики по тому же табу или чередование табов не меняют
 *      ни role, ни aria-live, ни data-empty (нет регрессии «после N кликов
 *      контейнер становится div role=region» и т.п.).
 *   3) Идентификаторы узлов/количество empty-state стабильны на одном
 *      и том же периоде между повторными кликами.
 */

const RANGE_TABS = ["Все данные", "Март 2026", "Последние 90 дней"] as const;

function renderPage(Comp: React.ComponentType) {
  return render(
    <MemoryRouter>
      <Comp />
    </MemoryRouter>,
  );
}

interface Snap {
  count: number;
  roles: string[];
  lives: string[];
  dataEmpty: string[];
}

function snapshot(container: HTMLElement): Snap {
  const empties = Array.from(
    container.querySelectorAll<HTMLElement>('[data-empty="true"]'),
  );
  return {
    count: empties.length,
    roles: empties.map((e) => e.getAttribute("role") ?? ""),
    lives: empties.map((e) => e.getAttribute("aria-live") ?? ""),
    dataEmpty: empties.map((e) => e.getAttribute("data-empty") ?? ""),
  };
}

function assertUniform(snap: Snap, ctx: string) {
  expect(snap.count, `${ctx}: должно быть 6 empty-state`).toBe(6);
  // Единообразие: все 6 — со строго одинаковыми aria-live и role.
  expect(new Set(snap.roles).size, `${ctx}: разные role`).toBe(1);
  expect(new Set(snap.lives).size, `${ctx}: разные aria-live`).toBe(1);
  expect(snap.roles[0]).toBe("status");
  expect(snap.lives[0]).toBe("polite");
  for (const v of snap.dataEmpty) expect(v).toBe("true");
}

describe("AdminAnalyticsPage · стабильность aria-live/role при кликах по табам", () => {
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

  it("единообразные aria-live=polite и role=status на всех 6 empty-state", () => {
    const { container } = renderPage(AdminAnalyticsPage);
    assertUniform(snapshot(container), "initial");
  });

  it("повторные клики по одному и тому же табу не меняют ARIA-контракт", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);
    const tab = getByRole("tab", { name: "Март 2026" });

    const before = snapshot(container);
    assertUniform(before, "before");

    for (let i = 0; i < 5; i++) {
      fireEvent.click(tab);
    }

    const after = snapshot(container);
    assertUniform(after, "after 5x same-tab clicks");
    expect(after).toEqual(before);
  });

  it("чередование табов туда-обратно не приводит к дрейфу role/aria-live", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    const initial = snapshot(container);
    assertUniform(initial, "initial");

    // 3 полных цикла: all → march → 90d → all → ...
    for (let i = 0; i < 3; i++) {
      for (const t of RANGE_TABS) {
        fireEvent.click(getByRole("tab", { name: t }));
        assertUniform(snapshot(container), `cycle ${i} tab ${t}`);
      }
    }

    // После всех циклов и возврата на «Все данные» — снимок идентичен начальному.
    fireEvent.click(getByRole("tab", { name: "Все данные" }));
    expect(snapshot(container)).toEqual(initial);
  });

  it("ни в одной точке после кликов не возникает empty-state с другим aria-live (assertive/off)", () => {
    const { container, getByRole } = renderPage(AdminAnalyticsPage);

    for (let i = 0; i < 10; i++) {
      const t = RANGE_TABS[i % RANGE_TABS.length];
      fireEvent.click(getByRole("tab", { name: t }));
      const snap = snapshot(container);
      for (const live of snap.lives) {
        expect(["polite"]).toContain(live);
      }
      for (const role of snap.roles) {
        expect(["status"]).toContain(role);
      }
    }
  });
});
