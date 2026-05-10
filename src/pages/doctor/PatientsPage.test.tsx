import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PatientsPage from "./PatientsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PatientsPage />
    </MemoryRouter>,
  );
}

describe("PatientsPage", () => {
  it("shows a new-patient CTA on the patients page", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Пациенты" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Новый пациент/i }),
    ).toBeInTheDocument();
  });

  it("clicking new patient explains that manual creation is not available in demo mode", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: /Новый пациент/i }));

    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      /Создание пациента пока недоступно в демо-режиме/i,
    );
    expect(status).toHaveTextContent(/Реальные данные пациентов не вводите/i);
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("new-patient CTA does not add a local patient row", async () => {
    renderPage();
    const table = screen.getByRole("table");
    const rowsBefore = within(table).getAllByRole("row").length;

    await userEvent.click(screen.getByRole("button", { name: /Новый пациент/i }));

    expect(within(table).getAllByRole("row").length).toBe(rowsBefore);
    expect(screen.getByText(/Всего в базе: 8/)).toBeInTheDocument();
  });
});
