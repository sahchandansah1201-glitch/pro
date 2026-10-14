import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { expectWorkingFixtureSafe, installWorkingSmoke, loginWorkingSmoke } from "./helpers/working-smoke";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("/sys/access-events working smoke", () => {
  test("system administrator filters and exports safe API audit records", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "system_admin", baseURL!);
    await loginWorkingSmoke(page, "system_admin");
    await page.goto("/sys/access-events");
    await expect(page.getByRole("heading", { name: "События доступа", exact: true })).toBeVisible();
    const preview = page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" });
    await expect(preview).toContainText("Событий для выгрузки: 12.");
    expect(await page.locator("body").innerText()).not.toMatch(/SENSITIVE_CANARY|PRIVATE_CANARY|PRIVATE_STORAGE_CANARY|access_token|storage_object_path/);

    await page.getByRole("button", { name: "Расширенные фильтры", exact: true }).click();
    await page.getByLabel("Размер страницы событий", { exact: true }).selectOption("5");
    await expect(page.getByText("1–5 из 12 событий", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Параметры выгрузки", exact: true }).click();
    await page.getByLabel("Диапазон экспорта событий", { exact: true }).selectOption("current_page");
    await expect(preview).toContainText("Событий для выгрузки: 5.");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать события доступа таблицей", exact: true }).click();
    const download = await downloadPromise;
    const downloaded = await download.path();
    expect(downloaded).not.toBeNull();
    const csv = await readFile(downloaded!, "utf8");
    expect(csv).not.toMatch(/SENSITIVE_CANARY|PRIVATE_CANARY|PRIVATE_STORAGE_CANARY|access_token|storage_object_path/);
    expect(csv).toContain("synthetic-audit-0");
    expect(csv).toContain("Проверочная клиника");
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText("Табличный файл готов");
    await page.getByLabel("Тип объекта", { exact: true }).selectOption("device");
    await expect(page.getByText("1–1 из 1 событий", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Подробнее: Устройство зарегистрировано", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText("скрыт");
    expect(await page.getByRole("dialog").innerText()).not.toMatch(/synthetic-audit-|SENSITIVE_CANARY|PRIVATE_CANARY|PRIVATE_STORAGE_CANARY/);
    expect(fixture.mutations).toEqual([]);
    expectWorkingFixtureSafe(fixture);
  });

  test("failed audit API does not display a training success or allow exports", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "system_admin", baseURL!);
    await loginWorkingSmoke(page, "system_admin");
    fixture.failure = true;
    await page.goto("/sys/access-events");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("button", { name: "Скачать события доступа таблицей", exact: true })).toBeDisabled();
    await expect(page.getByText("Отчёт открыт по ссылке", { exact: true })).toHaveCount(0);
    expectWorkingFixtureSafe(fixture);
  });

  test("clinic administrator cannot open the system audit route or request audit data", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "clinic_admin", baseURL!);
    await loginWorkingSmoke(page, "clinic_admin");
    await page.goto("/sys/access-events");
    await expect(page.getByRole("heading", { name: "Нет доступа", exact: true })).toBeVisible();
    expect(fixture.requests.filter(r => r.path === "/api/v1/admin/audit-events")).toEqual([]);
    await expect(page.getByRole("heading", { name: "События доступа", exact: true })).toHaveCount(0);
    expectWorkingFixtureSafe(fixture);
  });
});
