import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * Регрессия: при очень узких карточках (контейнер < 200px) точка-индикатор и
 * текст внутри пилюли статуса должны оставаться на одной строке и не «прыгать».
 *
 * JSDOM не выполняет реальный layout, поэтому проверяем CSS-контракт,
 * гарантирующий однострочность независимо от ширины родителя:
 *   - сам бейдж: inline-flex + flex-nowrap + whitespace-nowrap (+ break-keep);
 *   - точка: shrink-0 (не схлопывается);
 *   - текст: whitespace-nowrap (не переносится по словам/символам).
 *
 * Дополнительно рендерим страницу внутри контейнера шириной 180px,
 * чтобы зафиксировать кейс «карточка уже 200px» и убедиться, что бейдж
 * по-прежнему присутствует и сохраняет те же классы.
 */

function renderInNarrowContainer(widthPx: number) {
  const container = document.createElement("div");
  container.setAttribute("style", `width: ${widthPx}px;`);
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

describe("Protected link badge — single-line dot + text on very narrow cards (<200px)", () => {
  it("бейдж остаётся однострочным: inline-flex + flex-nowrap + whitespace-nowrap", () => {
    renderInNarrowContainer(180);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\binline-flex\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    expect(cls).toMatch(/\bwhitespace-nowrap\b/);
    // break-keep дополнительно запрещает разрыв между кириллическими словоформами.
    expect(cls).toMatch(/\bbreak-keep\b/);
    // max-w-full + w-fit — пилюля не растягивается и не выпрыгивает за карточку.
    expect(cls).toMatch(/\bmax-w-full\b/);
    expect(cls).toMatch(/\bw-fit\b/);
  });

  it("точка-индикатор не схлопывается (shrink-0) и не переносится отдельно", () => {
    renderInNarrowContainer(180);
    const badge = getStatusBadge();

    // Первый дочерний span — точка.
    const dot = badge.querySelector("span");
    expect(dot).not.toBeNull();
    const dotCls = dot!.className;

    expect(dotCls).toMatch(/\bshrink-0\b/);
    expect(dotCls).toMatch(/\brounded-full\b/);
    // Точка — inline-block, чтобы не ломать flex-строку бейджа.
    expect(dotCls).toMatch(/\binline-block\b/);
  });

  it("текстовый span бейджа не переносится по словам", () => {
    renderInNarrowContainer(180);
    const badge = getStatusBadge();

    const spans = badge.querySelectorAll("span");
    // Второй span — текстовая метка («Защищённая ссылка активна/истекла»).
    expect(spans.length).toBeGreaterThanOrEqual(2);
    const textCls = spans[1].className;

    expect(textCls).toMatch(/\bwhitespace-nowrap\b/);
  });

  it("даже при контейнере 160px бейдж рендерится и сохраняет однострочный контракт", () => {
    renderInNarrowContainer(160);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\binline-flex\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    expect(cls).toMatch(/\bwhitespace-nowrap\b/);
  });
});
