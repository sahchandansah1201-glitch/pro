import { describe, it, expect } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import OperatorConsolePage from "./OperatorConsolePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <OperatorConsolePage />
    </MemoryRouter>,
  );
}

function getStatusBadge(): HTMLElement {
  // Берём именно бейдж в карточке защищённой ссылки.
  const all = screen.getAllByRole("status");
  const badge = all.find((el) => /активна|истекла/.test(el.textContent ?? ""));
  if (!badge) throw new Error("status badge not found");
  return badge;
}

describe("OperatorConsolePage protected link status badge a11y", () => {
  it("по умолчанию (bd-001): role=status и accessible name про истёкшую ссылку, без дублей", () => {
    renderPage();
    const badge = getStatusBadge();
    expect(badge).toHaveAttribute("role", "status");
    // Доступное имя собирается из sr-only "Защищённая ссылка " + видимого "истекла".
    expect(badge).toHaveAccessibleName("Защищённая ссылка истекла");
    // Не должно быть aria-label (чтобы не дублировать видимый/sr-only текст).
    expect(badge).not.toHaveAttribute("aria-label");
    // Видимый текст содержит только короткое слово, без "Защищённая ссылка".
    expect(within(badge).getByText("истекла")).toBeInTheDocument();
  });

  it("после выбора bd-002: role=status и accessible name про активную ссылку", () => {
    renderPage();
    const bd002Label = screen.getAllByText("bd-002")[0];
    const card = bd002Label.closest("div.cursor-pointer") as HTMLElement | null;
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    const badge = getStatusBadge();
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAccessibleName("Защищённая ссылка активна");
    expect(badge).not.toHaveAttribute("aria-label");
    expect(within(badge).getByText("активна")).toBeInTheDocument();
  });
});
