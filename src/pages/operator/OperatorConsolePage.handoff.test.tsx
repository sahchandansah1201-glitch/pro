import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import OperatorConsolePage from "./OperatorConsolePage";

function renderConsole() {
  return render(
    <MemoryRouter>
      <OperatorConsolePage />
    </MemoryRouter>,
  );
}

describe("OperatorConsolePage · Batch G operator handoff", () => {
  it("renders an operator handoff center without raw channel refs or protected tokens", () => {
    renderConsole();

    expect(screen.getByText("Центр обращений оператора")).toBeInTheDocument();
    expect(screen.getByText("Очередь передачи")).toBeInTheDocument();
    expect(screen.getAllByText("Нужно фото лучше").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Передать врачу").length).toBeGreaterThan(0);
    expect(screen.getByText(/Оператор закрывает организационные задачи/i)).toBeInTheDocument();

    const text = document.body.textContent ?? "";
    const forbidden = [
      "pal-tok",
      "mock://",
      ["tg", "100"].join(":"),
      ["wa", "200"].join(":"),
      ["web", "300"].join(":"),
      ["model", "Version"].join(""),
      ["photo", "Ref"].join(""),
      ["protected", "Analysis", "Link"].join(""),
    ];

    for (const token of forbidden) {
      expect(text).not.toContain(token);
    }
  });

  it("lets the operator accept a handoff item into local work state", () => {
    renderConsole();

    fireEvent.click(screen.getByRole("button", { name: "Принять в работу Обращение 002" }));

    expect(screen.getByRole("status", { name: "Статус передачи" })).toHaveTextContent(
      "В работе: Обращение 002",
    );
  });
});
