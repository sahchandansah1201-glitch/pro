import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * Проверка, что фокус-обводка бейджа статуса остаётся видимой
 * и не обрезается при клавиатурной навигации, в т.ч. при zoom 200%.
 *
 * JSDOM не считает layout, поэтому проверяем CSS-контракт:
 *  - focus-visible:ring-2 + ring-offset-2 + ring-offset-background — кольцо снаружи бейджа;
 *  - focus:outline-none не убирает focus-visible (модерн a11y-практика);
 *  - бейдж имеет tabIndex=0 (входит в Tab-порядок);
 *  - ring-offset-background не использует тематический оверрайд (одинаков в light/dark);
 *  - у самой карточки overflow не клиппит ring (нет overflow-hidden на родителе бейджа).
 *
 * Zoom 200% моделируем CSS-трансформом scale(2) на корне — focus-стили
 * (ring/ring-offset) отрисовываются box-shadow'ами и масштабируются вместе с элементом,
 * поэтому проверяем, что классы не зависят от zoom (нет zoom-conditional модификаторов).
 */

function renderAt(zoom: 1 | 2) {
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

function getStatusBadge(): HTMLElement {
  const badge = screen
    .getAllByRole("status")
    .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""));
  if (!badge) throw new Error("status badge not found");
  return badge;
}

describe("Protected link badge — keyboard focus ring stays visible (incl. 200% zoom)", () => {
  it("бейдж входит в Tab-порядок и фокусируется через .focus()", () => {
    renderAt(1);
    const badge = getStatusBadge();
    expect(badge.getAttribute("tabindex")).toBe("0");

    badge.focus();
    expect(document.activeElement).toBe(badge);
  });

  it("у бейджа есть focus-visible ring + ring-offset (видимое кольцо снаружи)", () => {
    renderAt(1);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\bfocus-visible:ring-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-ring\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-background\b/);
    // focus:outline-none допустим только в паре с focus-visible:ring — это и проверяем.
    expect(cls).toMatch(/\bfocus:outline-none\b/);
  });

  it("focus-стили не зависят от темы и breakpoint'а (не сломаются при zoom 200%)", () => {
    renderAt(2);
    const badge = getStatusBadge();
    const cls = badge.className;

    // Никаких dark:focus-… или sm:/md:/lg:focus-… — кольцо одинаково везде.
    expect(cls).not.toMatch(/dark:focus/);
    expect(cls).not.toMatch(/(sm|md|lg|xl|2xl):focus/);

    // При zoom 200% бейдж всё ещё фокусируется и сохраняет focus-visible классы.
    badge.focus();
    expect(document.activeElement).toBe(badge);
    expect(cls).toMatch(/\bfocus-visible:ring-2\b/);
    expect(cls).toMatch(/\bfocus-visible:ring-offset-2\b/);
  });

  it("предки бейджа не обрезают focus-ring (нет overflow-hidden на ближайших обёртках)", () => {
    renderAt(2);
    const badge = getStatusBadge();

    // Поднимаемся до карточки защищённой ссылки и проверяем, что нет overflow-hidden,
    // которое могло бы обрезать ring/offset снаружи бейджа.
    let el: HTMLElement | null = badge.parentElement;
    let depth = 0;
    while (el && depth < 4) {
      expect(el.className ?? "").not.toMatch(/\boverflow-hidden\b/);
      el = el.parentElement;
      depth++;
    }
  });
});
