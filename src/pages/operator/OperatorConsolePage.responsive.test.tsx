import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * E2E-стиль регресс-тест: проверяем, что бейдж статуса защищённой ссылки
 * НЕ обрезается на узкой колонке/при зуме 200%.
 *
 * JSDOM не считает реальный layout, поэтому фиксируем CSS-контракт:
 *  - бейдж: whitespace-nowrap (текст не рвётся на части), shrink-0 (не сжимается),
 *    max-w-full (не вылазит за карточку);
 *  - индикатор-точка: shrink-0 (не пропадает);
 *  - родительский ряд: flex-wrap (бейдж переносится на новую строку, а не обрезается).
 */
describe("OperatorConsolePage — protected link badge clipping safety", () => {
  it("бейдж и его контейнер имеют классы для безопасного переноса при узкой ширине и zoom 200%", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );

    const badge = screen
      .getAllByRole("status")
      .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""));
    expect(badge).toBeTruthy();

    // Бейдж не должен сжиматься и не должен переносить текст внутри пилюли.
    expect(badge!.className).toMatch(/\bwhitespace-nowrap\b/);
    expect(badge!.className).toMatch(/\bshrink-0\b/);
    expect(badge!.className).toMatch(/\bmax-w-full\b/);
    expect(badge!.className).toMatch(/\binline-flex\b/);

    // Точка-индикатор не должна исчезать при сжатии.
    const dot = badge!.querySelector("span[aria-hidden='true']");
    expect(dot).not.toBeNull();
    expect(dot!.className).toMatch(/\bshrink-0\b/);

    // Родительский ряд должен уметь переносить бейдж на новую строку.
    const row = badge!.parentElement;
    expect(row).not.toBeNull();
    expect(row!.className).toMatch(/\bflex\b/);
    expect(row!.className).toMatch(/\bflex-wrap\b/);
  });

  it("цвета бейджа фиксированы и не зависят от темы (контраст ≥ AA в light/dark)", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = screen
      .getAllByRole("status")
      .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""))!;

    // Используются явные HSL литералы, а не зависящие от темы токены.
    // hsl(158 70% 24%) ≈ 5.83:1 на белом, hsl(0 75% 36%) ≈ 6.05:1 на белом — оба выше WCAG AA 4.5:1.
    const hasGreen = /hsl\(158_70%_24%\)/.test(badge.className);
    const hasRed = /hsl\(0_75%_36%\)/.test(badge.className);
    expect(hasGreen || hasRed).toBe(true);
    expect(badge.className).toMatch(/\btext-white\b/);
  });
});
