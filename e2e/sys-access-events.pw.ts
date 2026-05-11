import { test, expect } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

async function setDemoRole(page: import("@playwright/test").Page, role: string) {
  await page.addInitScript((r) => {
    try {
      localStorage.setItem("derma-pro:demo-role", r);
    } catch {
      // ignore
    }
  }, role);
}

test.describe("/sys/access-events", () => {
  test("system_admin can view and export safe access events", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "События доступа" })).toBeVisible();
    await expect(page.getByText(/RPC list_access_events_admin/)).toBeVisible();
    const table = page.locator("tbody");
    await expect(table.getByText("report.share").first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("Иванова Наталья");
    expect(bodyText).not.toContain("access_token");
    expect(bodyText).not.toContain("storage_object_path");

    await page.getByLabel("Размер страницы событий").selectOption("5");
    await expect(page.getByText("1–5 из 12 событий")).toBeVisible();
    await page.getByRole("button", { name: "Последняя страница" }).click();
    await expect(page.getByText("11–12 из 12 событий")).toBeVisible();
    await page.getByRole("button", { name: "Первая страница" }).click();
    await expect(page.getByText("1–5 из 12 событий")).toBeVisible();

    await page.getByLabel("Клиника события").selectOption("Дерма-Про · Центр");
    await page.getByLabel("Актор события").selectOption("Врач · u-doc-001");
    await page.getByLabel("Действие события").selectOption("report.generate");
    await page.getByLabel("Код пациента события").fill("DP-2026-0001");
    await expect(table.getByText("report.generate").first()).toBeVisible();
    await expect(table.getByText("report.share")).toHaveCount(0);

    await page.getByLabel("Автообновление событий доступа").check();
    await expect(page.getByText(/Автообновление включено: каждые 60 секунд/i)).toBeVisible();
    await page.getByRole("button", { name: "Сбросить фильтры" }).click();

    await page.getByLabel("Тип сущности").selectOption("device");
    await expect(table.getByText("device.register").first()).toBeVisible();
    await expect(table.getByText("report.share")).toHaveCount(0);

    await expect(page.getByText("1–1 из 1 событий")).toBeVisible();
    await expect(page.getByRole("region", { name: "Журнал запросов событий доступа" })).toContainText(
      /Демо-журнал: локальные события загружены/,
    );

    await page.getByRole("button", { name: /Подробнее о событии al-009/i }).first().click();
    await expect(page.getByRole("heading", { name: "Детали события" })).toBeVisible();
    await expect(page.getByText("al-009")).toBeVisible();
    const drawerText = await page.locator('[role="dialog"]').innerText();
    expect(drawerText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(drawerText).not.toContain("Иванова Наталья");
    expect(drawerText).not.toContain("access_token");
    expect(drawerText).not.toContain("storage_object_path");
    await page.getByRole("button", { name: "Закрыть" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать события доступа в CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^access-events-\d{4}-\d{2}-\d{2}-all\.csv$/);
    await expect(page.getByText(/CSV экспортирован:/)).toBeVisible();

    const xlsxDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать события доступа в XLSX" }).click();
    const xlsxDownload = await xlsxDownloadPromise;
    expect(xlsxDownload.suggestedFilename()).toMatch(/^access-events-\d{4}-\d{2}-\d{2}-all\.xlsx$/);
    await expect(page.getByText(/XLSX экспортирован:/)).toBeVisible();
  });

  test("clinic_admin cannot view access events", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByText(/Нет доступа в демо-режиме|только роли system_admin/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Экспортировать события доступа в CSV" })).toHaveCount(0);
    await expect(page.getByText("report.share")).toHaveCount(0);
  });
});
