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
    // Кликаем по элементу со ссылкой bd-002 в списке диалогов.
    const bd002Trigger = screen
      .getAllByText(/bd-002/i)
      .find((el) => el.closest("button")) as HTMLElement | undefined;
    expect(bd002Trigger).toBeTruthy();
    fireEvent.click(bd002Trigger!.closest("button") as HTMLElement);

    const badge = screen.getByLabelText("Защищённая ссылка активна");
    expect(badge).toHaveAttribute("role", "status");
    expect(within(badge).getByText("активна")).toBeInTheDocument();
  });
});
