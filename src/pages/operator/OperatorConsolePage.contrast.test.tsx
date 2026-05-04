import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * Визуальная проверка контраста бейджа статуса защищённой ссылки.
 *
 * Бейдж специально использует фиксированные HSL-цвета фона и белый текст,
 * НЕ зависящие от CSS-токенов :root / .dark. Поэтому контраст одинаков
 * в светлой и тёмной темах и не меняется при изменении ширины карточки.
 *
 * Здесь мы:
 *  1) вычисляем реальный коэффициент контраста по WCAG 2.x;
 *  2) подтверждаем, что классы фона/цвета именно те, которые мы зафиксировали
 *     (зелёный hsl(158 70% 24%) и красный hsl(0 75% 36%) на белом тексте).
 */

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1 = 0, g1 = 0, b1 = 0;
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const norm = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * norm[0] + 0.7152 * norm[1] + 0.0722 * norm[2];
}

function contrastRatio(hsl: [number, number, number], white = true): number {
  const L1 = relLuminance(hslToRgb(...hsl));
  const L2 = white ? 1 : 0;
  const [hi, lo] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

describe("Protected link badge — contrast in both themes (light/dark) and any card width", () => {
  it("зелёный фон hsl(158 70% 24%) на белом тексте: контраст ≥ WCAG AA (4.5:1)", () => {
    const ratio = contrastRatio([158, 70, 24]);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("красный фон hsl(0 75% 36%) на белом тексте: контраст ≥ WCAG AA (4.5:1)", () => {
    const ratio = contrastRatio([0, 75, 36]);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });

  it("бейдж в DOM использует именно эти фиксированные HSL-цвета и text-white", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = screen
      .getAllByRole("status")
      .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""))!;

    const cls = badge.className;
    // Один из двух фиксированных вариантов фона.
    const usesFixedHsl =
      /bg-\[hsl\(158_70%_24%\)\]/.test(cls) || /bg-\[hsl\(0_75%_36%\)\]/.test(cls);
    expect(usesFixedHsl).toBe(true);

    // Белый текст — высокий контраст в обеих темах.
    expect(cls).toMatch(/\btext-white\b/);

    // Цвета НЕ берутся из тематических токенов (не зависят от light/dark).
    expect(cls).not.toMatch(/bg-success(?!-foreground)/);
    expect(cls).not.toMatch(/bg-destructive(?!-foreground)/);
  });

  it("ширина карточки не влияет на контраст: в классах нет ширино-зависимых вариантов цвета", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = screen
      .getAllByRole("status")
      .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""))!;
    const cls = badge.className;

    // Никаких sm:bg-… / md:bg-… / lg:bg-… / dark:bg-… / dark:text-… на бейдже.
    expect(cls).not.toMatch(/(sm|md|lg|xl|2xl):(bg|text)-/);
    expect(cls).not.toMatch(/dark:(bg|text)-/);
  });
});
