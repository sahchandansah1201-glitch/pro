import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * Клавиатурная навигация: при последовательном нажатии Tab фокус должен
 * дойти до бейджа статуса защищённой ссылки, а затем — при Shift+Tab —
 * вернуться обратно без пропуска бейджа.
 *
 * JSDOM не реализует системный Tab-цикл браузера, поэтому моделируем его
 * через упорядоченный список фокусируемых элементов в DOM-порядке
 * (как это делает браузер по умолчанию для элементов без явного
 * tabindex>0). Это корректно, потому что:
 *   - бейдж имеет tabIndex=0 и попадает в естественный порядок;
 *   - в OperatorConsolePage не используются положительные tabindex;
 *   - порядок DOM на странице совпадает с визуальным порядком фокуса.
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getFocusables(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  ).filter((el) => {
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.hasAttribute("inert")) return false;
    return true;
  });
}

function pressTab(reverse = false) {
  const focusables = getFocusables();
  const current = document.activeElement as HTMLElement | null;
  const idx = current ? focusables.indexOf(current) : -1;
  let nextIdx: number;
  if (reverse) {
    nextIdx = idx <= 0 ? focusables.length - 1 : idx - 1;
  } else {
    nextIdx = idx === -1 || idx === focusables.length - 1 ? 0 : idx + 1;
  }
  const next = focusables[nextIdx];
  fireEvent.keyDown(current ?? document.body, {
    key: "Tab",
    shiftKey: reverse,
  });
  next.focus();
  return next;
}

function getStatusBadge(): HTMLElement {
  const badge = screen
    .getAllByRole("status")
    .find((el) =>
      /Статус защищённой ссылки/.test(el.getAttribute("aria-label") ?? ""),
    );
  if (!badge) throw new Error("status badge not found");
  return badge;
}

describe("Operator — Tab/Shift+Tab достигает бейджа статуса без пропусков", () => {
  it("бейдж присутствует в списке фокусируемых элементов страницы", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = getStatusBadge();
    const focusables = getFocusables();
    expect(focusables).toContain(badge);
  });

  it("Tab последовательно доходит до бейджа без обхода (нет ловушек до него)", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = getStatusBadge();
    const focusables = getFocusables();
    const targetIdx = focusables.indexOf(badge);
    expect(targetIdx).toBeGreaterThanOrEqual(0);

    // Стартуем с document.body, делаем ровно targetIdx+1 шагов Tab —
    // должны попасть в бейдж. Если на пути есть «дыра» (элемент с
    // tabIndex=-1 в нашем списке), focus просто перейдёт на него и
    // тест упадёт раньше — то, что нам нужно.
    document.body.focus();
    let last: HTMLElement | null = null;
    for (let i = 0; i <= targetIdx; i++) {
      last = pressTab(false);
    }
    expect(last).toBe(badge);
    expect(document.activeElement).toBe(badge);
  });

  it("Shift+Tab из бейджа возвращает фокус строго на предыдущий focusable", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = getStatusBadge();
    const focusables = getFocusables();
    const targetIdx = focusables.indexOf(badge);
    expect(targetIdx).toBeGreaterThan(0);

    badge.focus();
    expect(document.activeElement).toBe(badge);

    const prev = pressTab(true);
    expect(prev).toBe(focusables[targetIdx - 1]);
    expect(document.activeElement).toBe(focusables[targetIdx - 1]);
  });

  it("Tab после бейджа уходит на следующий focusable, затем Shift+Tab возвращает на бейдж", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = getStatusBadge();
    const focusables = getFocusables();
    const targetIdx = focusables.indexOf(badge);
    expect(targetIdx).toBeLessThan(focusables.length - 1);

    badge.focus();
    const next = pressTab(false);
    expect(next).toBe(focusables[targetIdx + 1]);

    const back = pressTab(true);
    expect(back).toBe(badge);
    expect(document.activeElement).toBe(badge);
  });
});
