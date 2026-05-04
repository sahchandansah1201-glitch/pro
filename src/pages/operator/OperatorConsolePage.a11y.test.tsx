import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  const badge = screen
    .getAllByRole("status")
    .find((el) => /активна|истекла/.test(el.getAttribute("aria-label") ?? ""));
  if (!badge) throw new Error("status badge not found");
  return badge;
}

describe("OperatorConsolePage protected link status badge a11y", () => {
  it("по умолчанию (bd-001): role=status и accessible name про истёкшую ссылку", () => {
    renderPage();
    const badge = getStatusBadge();
    expect(badge).toHaveAttribute("role", "status");
    expect(badge).toHaveAccessibleName("Защищённая ссылка истекла");
    // Видимая короткая метка скрыта от AT, чтобы не дублировать aria-label.
    const visible = badge.querySelector("span[aria-hidden='true']:not(.bg-current)");
    expect(visible).not.toBeNull();
    expect(visible!.textContent).toBe("истекла");
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
    const visible = badge.querySelector("span[aria-hidden='true']:not(.bg-current)");
    expect(visible).not.toBeNull();
    expect(visible!.textContent).toBe("активна");
  });
});
