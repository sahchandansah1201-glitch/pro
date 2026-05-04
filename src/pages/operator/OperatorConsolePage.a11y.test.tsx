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

describe("OperatorConsolePage protected link status badge a11y", () => {
  it("по умолчанию (bd-001): role=status и aria-label про истёкшую ссылку", () => {
    renderPage();
    const badge = screen.getByLabelText("Защищённая ссылка истекла");
    expect(badge).toHaveAttribute("role", "status");
    expect(within(badge).getByText("истекла")).toBeInTheDocument();
  });

  it("после выбора bd-002: role=status и aria-label про активную ссылку", () => {
    renderPage();
    // Карточка диалога — div с onClick, не button.
    const bd002Label = screen.getAllByText("bd-002")[0];
    const card = bd002Label.closest("div.cursor-pointer") as HTMLElement | null;
    expect(card).toBeTruthy();
    fireEvent.click(card!);

    const badge = screen.getByLabelText("Защищённая ссылка активна");
    expect(badge).toHaveAttribute("role", "status");
    expect(within(badge).getByText("активна")).toBeInTheDocument();
  });
});
