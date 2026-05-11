import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { PATIENTS } from "@/lib/mock-data";

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

  it("opens an edit dialog for an existing patient with current values", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    expect(within(dialog).getByLabelText("ФИО")).toHaveValue(
      "Иванова Наталья Олеговна",
    );
    expect(within(dialog).getByLabelText("Дата рождения")).toHaveValue(
      "1984-03-12",
    );
    expect(
      within(dialog).getByText(/Изменения сохраняются только локально/i),
    ).toBeInTheDocument();
  });

  it("saves patient edits locally and updates the row without changing total count", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Тестовая");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getAllByText("Иванова Наталья Тестовая").length).toBeGreaterThan(0);
    expect(screen.getByText(/Всего в базе: 8/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Изменения по пациенту Иванова Наталья Тестовая сохранены локально/i,
    );
  });

  it("requires a non-empty patient name before saving", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    await userEvent.clear(within(dialog).getByLabelText("ФИО"));
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Укажите ФИО пациента.",
    );
    expect(screen.getByRole("dialog", { name: "Редактировать пациента" })).toBeInTheDocument();
  });

  it("editing a patient does not mutate mock patient data", async () => {
    const before = PATIENTS.find((p) => p.id === "p-001")?.fullName;
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Редактировать пациента Иванова Наталья Олеговна/i,
      }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Редактировать пациента",
    });
    const nameInput = within(dialog).getByLabelText("ФИО");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Иванова Наталья Локальная");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(PATIENTS.find((p) => p.id === "p-001")?.fullName).toBe(before);
  });
});
