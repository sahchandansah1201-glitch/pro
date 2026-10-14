import { expect, test } from "@playwright/test";
import { expectWorkingFixtureSafe, installWorkingSmoke, loginWorkingSmoke, SMOKE_PATIENT_NAME } from "./helpers/working-smoke";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("Operator working queue smoke", () => {
  test("working login opens API queue and announces a saved synthetic lead", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "operator", baseURL!);
    await loginWorkingSmoke(page, "operator");
    await page.goto("/operator");
    await expect(page.getByRole("heading", { name: "Очередь заявок" })).toBeVisible();
    const ready = page.getByRole("status").filter({ hasText: "Данные загружены из системы клиники." });
    await expect(ready).toBeVisible();
    await expect(ready).toHaveAttribute("aria-live", "polite");
    await expect(page.getByText(SMOKE_PATIENT_NAME, { exact: true })).toBeVisible();
    await expect(page.getByText("Обращение 002")).toHaveCount(0);

    await page.getByLabel("Краткое описание заявки").fill("Проверка рабочей записи");
    await page.getByRole("button", { name: "Создать заявку", exact: true }).click();
    const saved = page.getByRole("status").filter({ hasText: "Заявка создана." });
    await expect(saved).toBeVisible();
    await expect(saved).toHaveAttribute("aria-live", "polite");
    await expect(saved).toHaveAttribute("aria-atomic", "true");
    expect(fixture.mutations).toEqual([{ path: "/api/v1/leads", method: "POST",
      payload: { source: "operator", safeSummary: "Проверка рабочей записи" } }]);
    expectWorkingFixtureSafe(fixture);
  });

  test("API failure has no training replacement and a user can retry", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "operator", baseURL!);
    await loginWorkingSmoke(page, "operator");
    await expect(page.getByText(SMOKE_PATIENT_NAME, { exact: true })).toBeVisible();
    fixture.failure = true;
    await page.getByRole("button", { name: "Обновить", exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("Рабочие данные недоступны.");
    await expect(page.getByText(SMOKE_PATIENT_NAME, { exact: true })).toHaveCount(0);
    await expect(page.getByText(/Обращение 00[12]/)).toHaveCount(0);
    fixture.failure = false;
    await page.getByRole("button", { name: "Обновить", exact: true }).click();
    await expect(page.getByText(SMOKE_PATIENT_NAME, { exact: true })).toBeVisible();
    expectWorkingFixtureSafe(fixture);
  });
});
