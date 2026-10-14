import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ListEmptyState } from "./ListEmptyState";

it("uses neutral working-list copy and preserves search recovery", () => {
  const reset = vi.fn();
  render(<ListEmptyState itemNoun="услуг" query="проверка" totalUnfiltered={3} onReset={reset} />);
  expect(screen.getByRole("status")).not.toHaveTextContent(/учебн/i);
  expect(screen.getByRole("status")).toHaveTextContent("Всего в каталоге: 3");
  fireEvent.click(screen.getByRole("button", { name: "Сбросить поиск и фильтры услуг" }));
  expect(reset).toHaveBeenCalledOnce();
});
