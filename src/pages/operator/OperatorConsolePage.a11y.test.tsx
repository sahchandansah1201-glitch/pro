import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * A11y-контракт бейджа статуса защищённой ссылки на /operator:
 *   - role="status" + aria-live="polite" + aria-atomic="true" — смена
 *     состояния озвучивается ассистивными технологиями целиком;
 *   - aria-label содержит и слово «Статус», и состояние («активна»/«истекла»),
 *     и оставшееся/прошедшее время — пользователю скринридера понятно
 *     без визуального контекста;
 *   - tabIndex=0 — бейдж достижим клавиатурой;
 *   - видимый focus-ring (focus-visible:ring-2 + ring-offset-2 +
 *     ring-offset-background) одинаков в светлой и тёмной темах
 *     (без dark: оверрайдов и breakpoint-условностей);
 *   - focus:outline-none допустим только потому, что заменён на
 *     focus-visible:ring (а не убирает индикатор полностью).
 */

function renderWithTheme(theme: "light" | "dark") {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(theme);
  return render(
    <MemoryRouter>
      <OperatorConsolePage />
    </MemoryRouter>,
  );
}

function getStatusBadge(): HTMLElement {
  const badge = screen
    .getAllByRole("status")
    .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""));
  if (!badge) throw new Error("status badge not found");
  return badge;
}

afterEach(() => {
  document.documentElement.classList.remove("light", "dark");
});

describe("Protected link badge — accessible label & visible keyboard focus (light/dark)", () => {
  beforeEach(() => {
    renderWithTheme("light");
  });

  it("aria-label полный: слово «Статус», состояние и время", () => {
    const badge = getStatusBadge();
    const label = badge.getAttribute("aria-label") ?? "";

    expect(label).toMatch(/Статус/);
    expect(label).toMatch(/активна|истекла/);
    // Включает временную информацию (осталось/назад + единицы).
    expect(label).toMatch(/осталось|назад/);
  });

  it("у бейджа корректные ARIA-атрибуты: role=status, aria-live=polite, aria-atomic=true", () => {
    const badge = getStatusBadge();
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-live")).toBe("polite");
    expect(badge.getAttribute("aria-atomic")).toBe("true");
  });

  it("декоративные дочерние элементы скрыты от скринридера (aria-hidden)", () => {
    const badge = getStatusBadge();
    const spans = badge.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);
    // Точка и текст-дублёр — оба aria-hidden, чтобы не дублировать aria-label.
    expect(spans[0].getAttribute("aria-hidden")).toBe("true");
    expect(spans[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("в светлой теме бейдж входит в Tab-порядок и имеет видимый focus-ring", () => {
    const badge = getStatusBadge();
    expect(badge.getAttribute("tabindex")).toBe("0");

    badge.focus();
    expect(document.activeElement).toBe(badge);

    const cls = badge.className;
    expect(cls).toMatch(/\bfocus-visible:ring-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-ring\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-background\b/);
    expect(cls).toMatch(/\bfocus:outline-none\b/);
  });
});

describe("Protected link badge — focus ring identical in dark theme", () => {
  it("в тёмной теме фокус-кольцо тех же классов и не зависит от темы", () => {
    renderWithTheme("dark");
    const badge = getStatusBadge();

    badge.focus();
    expect(document.activeElement).toBe(badge);

    const cls = badge.className;
    expect(cls).toMatch(/\bfocus-visible:ring-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-ring\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-background\b/);
    // Никаких dark:focus-… оверрайдов — индикатор одинаков в обеих темах.
    expect(cls).not.toMatch(/dark:focus/);
    // Семантический токен ring-offset-background сам подстраивается под тему.
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
