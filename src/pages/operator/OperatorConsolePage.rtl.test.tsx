import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * RTL-регрессия: при dir="rtl" бейдж статуса защищённой ссылки на /operator
 * должен по-прежнему переноситься как ЕДИНЫЙ блок (без разрывов внутри
 * пилюли между точкой и текстом и без разрывов между подписью «Статус:»
 * и пилюлей).
 *
 * Контракт переноса не зависит от writing-direction: его обеспечивают
 * логические свойства Tailwind (inline-flex / flex-nowrap / whitespace-nowrap
 * / break-keep / w-fit / max-w-full / shrink-0 / gap-1.5). Эти классы
 * корректны и в LTR, и в RTL — проверяем их сохранение, а также то, что
 * бейдж не получает overflow-hidden или специфичных LTR-only оверрайдов.
 *
 * JSDOM не считает реальный layout, поэтому валидируем CSS-контракт +
 * структурные инварианты (порядок дочерних span'ов и ARIA).
 */

function renderRTL(widthPx?: number) {
  document.documentElement.setAttribute("dir", "rtl");
  document.documentElement.setAttribute("lang", "ar");
  const container = document.createElement("div");
  container.setAttribute("dir", "rtl");
  if (widthPx) container.setAttribute("style", `width: ${widthPx}px;`);
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

afterEach(() => {
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("lang");
});

describe("Protected link badge — atomic wrap is preserved under RTL direction", () => {
  it("при dir=rtl бейдж сохраняет inline-flex + flex-nowrap + whitespace-nowrap", () => {
    renderRTL(180);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\binline-flex\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    expect(cls).toMatch(/\bwhitespace-nowrap\b/);
    expect(cls).toMatch(/\bbreak-keep\b/);
    expect(cls).toMatch(/\bw-fit\b/);
    expect(cls).toMatch(/\bmax-w-full\b/);
  });

  it("при dir=rtl точка и текст остаются однострочными (shrink-0 + whitespace-nowrap)", () => {
    renderRTL(180);
    const badge = getStatusBadge();
    const spans = badge.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);

    // Порядок дочерних узлов — стабильный (точка, затем текст).
    // Их визуальный порядок в RTL зеркалит браузер, но DOM-структура
    // и классы не зависят от направления.
    expect(spans[0].className).toMatch(/\bshrink-0\b/);
    expect(spans[0].className).toMatch(/\brounded-full\b/);
    expect(spans[1].className).toMatch(/\bwhitespace-nowrap\b/);
  });

  it("при dir=rtl ряд-родитель допускает атомарный перенос (flex + flex-wrap + min-w-0)", () => {
    renderRTL(180);
    const badge = getStatusBadge();
    const row = badge.parentElement!;
    const cls = row.className;

    expect(cls).toMatch(/\bflex\b/);
    expect(cls).toMatch(/\bflex-wrap\b/);
    expect(cls).toMatch(/\bmin-w-0\b/);
    // overflow-hidden не должен клиппить пилюлю и её focus-ring при переносе.
    expect(cls).not.toMatch(/\boverflow-hidden\b/);
  });

  it("при dir=rtl ARIA-контракт сохраняется (status + aria-live + содержательный label)", () => {
    renderRTL(180);
    const badge = getStatusBadge();

    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-live")).toBe("polite");
    const label = badge.getAttribute("aria-label") ?? "";
    expect(label).toMatch(/Статус/);
    expect(label).toMatch(/активна|истекла/);
  });

  it("при dir=rtl и очень узкой ширине (140px) контракт переноса не ломается", () => {
    renderRTL(140);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\binline-flex\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    expect(cls).toMatch(/\bwhitespace-nowrap\b/);
  });
});
