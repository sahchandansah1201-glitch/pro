import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * Snapshot-регрессия для бейджа статуса защищённой ссылки.
 *
 * JSDOM не считает реальный pixel-layout, поэтому "масштаб 200%" моделируем
 * CSS-трансформом на корне (zoom-эквивалент), а snapshot фиксирует DOM-разметку
 * и классы — главный источник визуальной регрессии (цвета, focus-ring,
 * whitespace-nowrap, shrink-0 и т.д.).
 */

function findBadge(matcher: RegExp): HTMLElement {
  const badge = screen
    .getAllByRole("status")
    .find((el) => matcher.test(el.getAttribute("aria-label") ?? ""));
  if (!badge) throw new Error(`badge not found for ${matcher}`);
  return badge;
}

function getBadge(state: "active" | "expired"): HTMLElement {
  if (state === "expired") {
    // bd-001 по умолчанию выбран и его ссылка истекла относительно DEMO_NOW.
    return findBadge(/истекла/);
  }
  // Кликаем по карточке bd-002 — там ссылка активна.
  const trigger = screen
    .getAllByText("bd-002")[0]
    .closest("div.cursor-pointer") as HTMLElement | null;
  if (!trigger) throw new Error("bd-002 card not found");
  fireEvent.click(trigger);
  return findBadge(/активна/);
}

function renderAt(zoom: 1 | 2) {
  // "Масштаб 200%" — корневой контейнер с transform: scale(2).
  const container = document.createElement("div");
  container.setAttribute(
    "style",
    `transform: scale(${zoom}); transform-origin: top left;`,
  );
  document.body.appendChild(container);
  return render(
    <MemoryRouter>
      <OperatorConsolePage />
    </MemoryRouter>,
    { container },
  );
}

describe("Protected link badge — DOM snapshots (active/expired × 100%/200%)", () => {
  it("expired @ 100% — snapshot бейджа", () => {
    renderAt(1);
    expect(getBadge("expired").outerHTML).toMatchSnapshot();
  });

  it("expired @ 200% — snapshot бейджа (контейнер scale(2))", () => {
    renderAt(2);
    expect(getBadge("expired").outerHTML).toMatchSnapshot();
  });

  it("active @ 100% — snapshot бейджа", () => {
    renderAt(1);
    expect(getBadge("active").outerHTML).toMatchSnapshot();
  });

  it("active @ 200% — snapshot бейджа (контейнер scale(2))", () => {
    renderAt(2);
    expect(getBadge("active").outerHTML).toMatchSnapshot();
  });
});
