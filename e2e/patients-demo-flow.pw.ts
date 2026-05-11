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

    await page.getByRole("button", { name: "Новый пациент" }).click();

    const createStatus = page
      .getByRole("status")
      .filter({ hasText: "Создание пациента пока недоступно" });
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

    const deleteStatus = page
      .getByRole("status")
      .filter({ hasText: "удалён из локального списка" });
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
});
