import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

/**
 * A11y-регрессия: при переключении состояния защищённой ссылки
 * («активна» ↔ «истекла») скринридер должен озвучить новое значение
 * целиком благодаря live-region на самом бейдже.
 *
 * Контракт live-region:
 *   - role="status" — неявный aria-live=polite (но мы задаём его явно);
 *   - aria-live="polite" — анонс не прерывает текущую речь;
 *   - aria-atomic="true" — при изменении внутри узла зачитывается
 *     ВСЁ содержимое (новый aria-label целиком), а не только дельта;
 *   - aria-label обновляется при смене состояния и содержит и слово
 *     «Статус», и состояние, и временной контекст.
 *
 * Переключение состояния моделируем кликом по карточке другого диалога
 * (первое обращение — истекшая ссылка по умолчанию, «Обращение 002» — активная).
 */

function getStatusBadge(): HTMLElement {
  const badge = screen
    .getAllByRole("status")
    .find((el) => /Статус защищённой ссылки/.test(el.getAttribute("aria-label") ?? ""));
  if (!badge) throw new Error("status badge not found");
  return badge;
}

function selectDialog(label: string) {
  const card = screen
    .getAllByText(label)
    .map((node) => node.closest(".cursor-pointer") as HTMLElement | null)
    .find(Boolean);
  if (!card) throw new Error(`card ${label} not found`);
  fireEvent.click(card);
}

describe("Protected link badge — screen reader announces state change via aria-live/aria-atomic", () => {
  it("у бейджа стоят aria-live=polite и aria-atomic=true (анонс целым блоком)", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    const badge = getStatusBadge();
    expect(badge.getAttribute("role")).toBe("status");
    expect(badge.getAttribute("aria-live")).toBe("polite");
    expect(badge.getAttribute("aria-atomic")).toBe("true");
  });

  it("при смене диалога aria-label бейджа меняется (новый текст для озвучки)", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );

    // По умолчанию выбрано первое обращение — ссылка истекла.
    const before = getStatusBadge();
    const labelBefore = before.getAttribute("aria-label") ?? "";
    expect(labelBefore).toMatch(/истекла/);

    // Переключаемся на «Обращение 002» — ссылка активна.
    selectDialog("Обращение 002");

    const after = getStatusBadge();
    const labelAfter = after.getAttribute("aria-label") ?? "";
    expect(labelAfter).toMatch(/активна/);
    expect(labelAfter).not.toEqual(labelBefore);

    // Live-region остаётся тем же узлом с теми же ARIA-атрибутами:
    // браузер/AT зачтёт новый aria-label целиком (atomic).
    expect(after.getAttribute("aria-live")).toBe("polite");
    expect(after.getAttribute("aria-atomic")).toBe("true");
  });

  it("aria-atomic=true важно: внутренний текст пилюли тоже обновляется и читается целиком", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );

    const before = getStatusBadge();
    expect(within(before).getByText(/истекла/)).toBeTruthy();

    selectDialog("Обращение 002");

    const after = getStatusBadge();
    expect(within(after).getByText(/активна/)).toBeTruthy();

    // Декоративные дочерние узлы скрыты от AT — анонс идёт через aria-label,
    // а aria-atomic=true гарантирует, что обновление не «склеится» с прошлым.
    const spans = after.querySelectorAll("span");
    expect(spans[0].getAttribute("aria-hidden")).toBe("true");
    expect(spans[1].getAttribute("aria-hidden")).toBe("true");
  });

  it("новый aria-label содержит слово «Статус», состояние и временной контекст", () => {
    render(
      <MemoryRouter>
        <OperatorConsolePage />
      </MemoryRouter>,
    );
    selectDialog("Обращение 002");
    const label = getStatusBadge().getAttribute("aria-label") ?? "";

    expect(label).toMatch(/Статус/);
    expect(label).toMatch(/активна/);
    expect(label).toMatch(/осталось/);
  });
});
