import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("/sys/release-status", () => {
  test("system_admin can preview, privacy-check, and export release status artifacts", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Релиз-статус" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр release status" })).toContainText(
      "Main workflows: 6 из 6 success",
    );
    await expect(page.getByText(/Доступ к разделу открыт только роли system_admin/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Сравнение релизов" })).toContainText(
      "Статус улучшился",
    );
    await expect(page.getByText("npm run preflight:release-status")).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("access_token=");
    expect(bodyText).not.toContain("storage_object_path");
    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");

    await page.getByLabel("Формат предпросмотра релиз-статуса").selectOption("html");
    await expect(page.getByRole("textbox", { name: "Предпросмотр файла release status" })).toHaveValue(
      /<!doctype html>/i,
    );

    await page.getByRole("button", { name: "Проверить предпросмотр" }).click();
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      "Проверка приватности пройдена для HTML.",
    );
    await page.getByText("Показать категории приватности").click();
    await expect(page.getByRole("list", { name: "Категории проверки приватности" })).toContainText(
      "service role env",
    );

    const bundleDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать единый пакет release status" }).click();
    await bundleDownloadPromise;
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      "Пакетный экспорт готов: 4 файла.",
    );

    const htmlDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать release status в HTML" }).click();
    const htmlDownload = await htmlDownloadPromise;
    expect(htmlDownload.suggestedFilename()).toMatch(/^release-status-\d{4}-\d{2}-\d{2}\.html$/);
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      /HTML экспорт готов/,
    );

    const historyDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать release status в History JSONL" }).click();
    const historyDownload = await historyDownloadPromise;
    expect(historyDownload.suggestedFilename()).toMatch(/^release-history-\d{4}-\d{2}-\d{2}\.jsonl$/);
    await expect(page.getByRole("region", { name: "Журнал экспортов релиз-статуса" })).toContainText(
      /release-history-\d{4}-\d{2}-\d{2}\.jsonl/,
    );

    await page.getByRole("button", { name: "Подготовить локальный запуск" }).click();
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      /preflight/,
    );
  });

  test("clinic_admin is blocked by the demo RBAC guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Релиз-статус" })).toBeHidden();
    await expect(page.getByText("Нет доступа в демо-режиме")).toBeVisible();
    await expect(page.getByText(/Текущая роль Администратор клиники/)).toBeVisible();
  });
});
