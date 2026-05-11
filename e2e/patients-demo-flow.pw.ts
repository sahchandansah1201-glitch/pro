import { expect, test } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("Patients demo flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("derma-pro:demo-role", "doctor");
      } catch {
        /* ignore */
      }
    });
  });

  test("demo gate is announced and patient create/delete stays local", async ({ page }) => {
    await page.goto("/patients", { waitUntil: "networkidle" });

    expect(page.url(), "patients page should not redirect to login").not.toMatch(
      /\/login(\?|$)/,
    );
    await expect(page.getByRole("heading", { name: "Пациенты" })).toBeVisible();
    await expect(page.getByText("Всего в базе: 8")).toBeVisible();

    const demoGate = page.getByRole("note", {
      name: "Ограничения демо-режима пациентов",
    });
    await expect(demoGate).toBeVisible();
    await expect(demoGate).toContainText("Кнопка «Новый пациент» не создаёт запись");
    await expect(demoGate).toContainText(
      "«Удалить локально» скрывает строку только в текущем демо-сеансе",
    );

    const newPatientButton = page.getByRole("button", { name: "Новый пациент" });
    const demoGateId = await demoGate.getAttribute("id");
    expect(demoGateId).toBe("patients-demo-gate-note");
    await expect(newPatientButton).toHaveAttribute("aria-describedby", demoGateId ?? "");
    await newPatientButton.click();

    const createStatus = page.getByRole("status", {
      name: "Статус действий с пациентами",
    });
    await expect(createStatus).toHaveAttribute("aria-live", "polite");
    await expect(createStatus).toHaveAttribute("aria-atomic", "true");
    await expect(createStatus).toContainText("действие заблокировано");
    await expect(createStatus).toContainText("Реальные данные пациентов не вводите");
    await expect(page.getByText("Всего в базе: 8")).toBeVisible();

    await page
      .getByRole("button", { name: "Удалить пациента Иванова Наталья Олеговна" })
      .first()
      .click();

    const deleteDialog = page.getByRole("alertdialog", {
      name: "Удалить пациента из локального списка?",
    });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog).toContainText("скрыт только на этой странице в демо-режиме");
    await deleteDialog.getByRole("button", { name: "Удалить локально" }).click();

    const deleteStatus = page.getByRole("status", {
      name: "Статус действий с пациентами",
    });
    await expect(deleteStatus).toContainText(
      "Пациент Иванова Наталья Олеговна удалён из локального списка",
    );
    await expect(page.getByText("Всего в базе: 7")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true }),
    ).toHaveCount(0);

    await page.getByRole("button", { name: "Отменить удаление" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Удаление пациента" }),
    ).toContainText(
      "Удаление пациента Иванова Наталья Олеговна отменено.",
    );
    await expect(page.getByText("Всего в базе: 8")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true }),
    ).toBeVisible();
    await expect(demoGate).toBeVisible();
  });

  test("keyboard users can trigger the gate and dismiss local delete safely", async ({ page }) => {
    await page.goto("/patients", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: "Новый пациент" }).focus();
    await page.keyboard.press("Enter");

    const createStatus = page.getByRole("status", {
      name: "Статус действий с пациентами",
    });
    await expect(createStatus).toContainText("действие заблокировано");
    await expect(page.getByText("Всего в базе: 8")).toBeVisible();

    const deleteButton = page
      .getByRole("button", { name: "Удалить пациента Иванова Наталья Олеговна" })
      .first();
    await deleteButton.focus();
    await page.keyboard.press("Enter");

    const deleteDialog = page.getByRole("alertdialog", {
      name: "Удалить пациента из локального списка?",
    });
    await expect(deleteDialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(deleteDialog).not.toBeVisible();
    await expect(page.getByText("Всего в базе: 8")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true }),
    ).toBeVisible();
  });

  test("reload resets local demo changes and keeps the gate available", async ({ page }) => {
    await page.goto("/patients", { waitUntil: "networkidle" });

    await page
      .getByRole("button", { name: "Удалить пациента Иванова Наталья Олеговна" })
      .first()
      .click();
    await page
      .getByRole("alertdialog", { name: "Удалить пациента из локального списка?" })
      .getByRole("button", { name: "Удалить локально" })
      .click();

    await expect(page.getByText("Всего в базе: 7")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true }),
    ).toHaveCount(0);

    await page.reload({ waitUntil: "networkidle" });

    await expect(page.getByText("Всего в базе: 8")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Иванова Наталья Олеговна", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("note", { name: "Ограничения демо-режима пациентов" }),
    ).toBeVisible();
  });
});
