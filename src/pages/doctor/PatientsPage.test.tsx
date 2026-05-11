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

  it("opens quick patient preview without entering edit mode", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Просмотреть пациента Иванова Наталья Олеговна/i,
      }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Просмотр пациента",
    });
    expect(within(dialog).getByText("DP-2026-0001")).toBeInTheDocument();
    expect(within(dialog).getByText("Иванова Наталья Олеговна")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Открыть карточку" })).toHaveAttribute(
      "href",
      "/patients/p-001",
    );
    expect(
      within(dialog).queryByRole("button", { name: "Сохранить изменения" }),
    ).not.toBeInTheDocument();
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

  it("records edit actions in the patient change log", async () => {
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
    await userEvent.type(nameInput, "Иванова Наталья Журнал");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    const log = screen.getByRole("region", { name: "Журнал изменений пациентов" });
    expect(log).toHaveTextContent("DP-2026-0001");
    expect(log).toHaveTextContent("Иванова Наталья Журнал");
    expect(log).toHaveTextContent("Обновлены данные пациента локально.");
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

  it("rejects a future birth date before saving", async () => {
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
    const birthDateInput = within(dialog).getByLabelText("Дата рождения");
    await userEvent.clear(birthDateInput);
    await userEvent.type(birthDateInput, "2099-01-01");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Дата рождения не может быть в будущем.",
    );
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

  it("extended search filters by age range", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: "Расширенный поиск пациентов" }),
    );
    await userEvent.type(screen.getByLabelText("Возраст пациента от"), "70");
    await userEvent.type(screen.getByLabelText("Возраст пациента до"), "72");

    expect(screen.getAllByText("Беляева Елена Сергеевна").length).toBeGreaterThan(0);
    expect(screen.queryByText("Иванова Наталья Олеговна")).not.toBeInTheDocument();
    expect(screen.getByText(/Найдено:/).textContent).toContain("1");
  });

  it("sorts patients by age descending", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("combobox", { name: "Сортировка пациентов" }),
    );
    await userEvent.click(
      await screen.findByRole("option", { name: "Возраст по убыванию" }),
    );

    const table = screen.getByRole("table");
    const firstDataRow = within(table).getAllByRole("row")[1];
    expect(firstDataRow).toHaveTextContent("Беляева Елена Сергеевна");
    expect(firstDataRow).toHaveTextContent("71");
  });

  it("paginates the patient list", async () => {
    renderPage();

    expect(screen.getByRole("navigation", { name: "Пагинация пациентов" })).toHaveTextContent(
      "Страница 1 из 2",
    );
    expect(screen.queryByText("Кузнецов Павел Андреевич")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Вперёд" }));

    expect(screen.getByRole("navigation", { name: "Пагинация пациентов" })).toHaveTextContent(
      "Страница 2 из 2",
    );
    expect(screen.getAllByText("Кузнецов Павел Андреевич").length).toBeGreaterThan(0);
    expect(screen.queryByText("Иванова Наталья Олеговна")).not.toBeInTheDocument();
  });

  it("deletes a patient from the local list only and records it in the change log", async () => {
    const before = PATIENTS.length;
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Удалить пациента Иванова Наталья Олеговна/i,
      }),
    );
    const alert = await screen.findByRole("alertdialog", {
      name: "Удалить пациента из локального списка?",
    });
    await userEvent.click(
      within(alert).getByRole("button", { name: "Удалить локально" }),
    );

    expect(within(table).queryByRole("link", { name: "Иванова Наталья Олеговна" })).not.toBeInTheDocument();
    expect(screen.getByText(/Всего в базе: 7/)).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      /Пациент Иванова Наталья Олеговна удалён из локального списка/i,
    );
    const log = screen.getByRole("region", { name: "Журнал изменений пациентов" });
    expect(log).toHaveTextContent("Удалён из локального списка.");
    expect(PATIENTS.length).toBe(before);
  });

  it("undoes the last local deletion", async () => {
    renderPage();
    const table = screen.getByRole("table");

    await userEvent.click(
      within(table).getByRole("button", {
        name: /Удалить пациента Иванова Наталья Олеговна/i,
      }),
    );
    const alert = await screen.findByRole("alertdialog", {
      name: "Удалить пациента из локального списка?",
    });
    await userEvent.click(
      within(alert).getByRole("button", { name: "Удалить локально" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Отменить удаление" }));

    expect(screen.getByText(/Всего в базе: 8/)).toBeInTheDocument();
    expect(screen.getAllByText("Иванова Наталья Олеговна").length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Удаление пациента Иванова Наталья Олеговна отменено.",
    );
    expect(screen.getByRole("region", { name: "Журнал изменений пациентов" })).toHaveTextContent(
      "Удаление отменено.",
    );
  });

  it("exports the patient change log as selectable text", async () => {
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
    await userEvent.type(nameInput, "Иванова Наталья Экспорт");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Сохранить изменения" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Экспорт журнала" }));

    const exportDialog = await screen.findByRole("dialog", {
      name: "Экспорт журнала изменений",
    });
    expect(
      within(exportDialog).getByLabelText("Текст экспорта журнала изменений"),
    ).toHaveValue(
      "1. DP-2026-0001 Иванова Наталья Экспорт: Обновлены данные пациента локально.",
    );
  });
});
