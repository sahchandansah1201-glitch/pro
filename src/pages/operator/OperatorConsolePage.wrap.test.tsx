import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * E2E-контракт переноса: при нехватке ширины бейдж статуса должен переноситься
 * на новую строку ЦЕЛИКОМ (как единый inline-блок), без разрыва между
 * подписью «Статус:» и пилюлей и без разрыва внутри самой пилюли
 * (точка + текст всегда вместе).
 *
 * JSDOM не выполняет реальный layout, поэтому валидируем CSS-контракт,
 * который и обеспечивает это поведение в браузере:
 *   - родительский ряд: flex + flex-wrap + min-w-0 (разрешает перенос
 *     детей, но не растягивает их «в строку»);
 *   - подпись «Статус:»: shrink-0 (не схлопывается, остаётся отдельным
 *     блоком переноса);
 *   - бейдж: inline-flex + flex-nowrap + whitespace-nowrap + w-fit +
 *     max-w-full — переносится как один атомарный блок, внутри ничего
 *     не разрывается.
 */

function renderPage(widthPx?: number) {
  const container = document.createElement("div");
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

describe("Protected link badge — wraps as a single atomic block on /operator", () => {
  it("ряд-родитель разрешает перенос (flex + flex-wrap + min-w-0)", () => {
    renderPage(180);
    const badge = getStatusBadge();
    const row = badge.parentElement!;
    const cls = row.className;

    expect(cls).toMatch(/\bflex\b/);
    expect(cls).toMatch(/\bflex-wrap\b/);
    expect(cls).toMatch(/\bmin-w-0\b/);
  });

  it("подпись «Статус:» — shrink-0 и идёт отдельным блоком переноса", () => {
    renderPage(180);
    const badge = getStatusBadge();
    const row = badge.parentElement!;

    // Подпись — соседний элемент бейджа в том же ряду.
    const label = Array.from(row.children).find(
      (el) => el !== badge && /Статус/i.test(el.textContent ?? ""),
    ) as HTMLElement | undefined;
    expect(label, "label «Статус:» not found in row").toBeTruthy();
    expect(label!.className).toMatch(/\bshrink-0\b/);
  });

  it("бейдж переносится целиком: inline-flex + flex-nowrap + w-fit + max-w-full", () => {
    renderPage(180);
    const badge = getStatusBadge();
    const cls = badge.className;

    expect(cls).toMatch(/\binline-flex\b/);
    expect(cls).toMatch(/\bflex-nowrap\b/);
    expect(cls).toMatch(/\bw-fit\b/);
    expect(cls).toMatch(/\bmax-w-full\b/);
    // align-middle гарантирует корректную базовую линию при переносе на новую строку.
    expect(cls).toMatch(/\balign-middle\b/);
  });

  it("внутри пилюли запрещены разрывы: точка shrink-0 + текст whitespace-nowrap", () => {
    renderPage(180);
    const badge = getStatusBadge();
    const spans = badge.querySelectorAll("span");
    expect(spans.length).toBeGreaterThanOrEqual(2);

    // Точка не схлопывается и не уезжает на отдельную строку.
    expect(spans[0].className).toMatch(/\bshrink-0\b/);
    // Текст не ломается по словам/символам.
    expect(spans[1].className).toMatch(/\bwhitespace-nowrap\b/);
    // У самого бейджа — break-keep, чтобы кириллица не разрывалась.
    expect(badge.className).toMatch(/\bbreak-keep\b/);
  });
});
