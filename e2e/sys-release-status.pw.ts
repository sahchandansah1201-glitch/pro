import { expect, test } from "@playwright/test";
import { expectWorkingFixtureSafe, installWorkingSmoke, loginWorkingSmoke } from "./helpers/working-smoke";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("/sys/release-status working smoke", () => {
  test("missing live release evidence stays unconfirmed and cannot authorize a publication", async ({ page, baseURL }, testInfo) => {
    const fixture = await installWorkingSmoke(page, "system_admin", baseURL!);
    await loginWorkingSmoke(page, "system_admin");
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      await page.goto("/sys/release-status");
      await expect(page.getByRole("heading", { name: "Готовность публикации", exact: true })).toBeVisible();
      await expect(page.getByRole("alert", { name: "Текущий статус публикации не подтверждён" })).toContainText(
        "не подтверждает готовность публикации",
      );
      await expect(page.getByRole("link", { name: "Доступность сервера", exact: true })).toHaveAttribute("href", "/healthz");
      await expect(page.getByRole("link", { name: "Готовность базы данных и зависимостей", exact: true })).toHaveAttribute("href", "/readyz");
      await expect(page.getByRole("link", { name: "Открыть проверки GitHub", exact: true })).toHaveAttribute(
        "href", "https://github.com/sahchandansah1201-glitch/pro/actions",
      );
      await expect(page.getByRole("button", { name: /публиковать|опубликовать/i })).toHaveCount(0);
      expect(await page.locator("main").innerText()).not.toContain("9 из 9");
      const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
      expect(metrics.scroll).toBeLessThanOrEqual(metrics.width + 1);
      await page.screenshot({ path: testInfo.outputPath(`release-unconfirmed-${viewport.width}.png`), fullPage: true });
    }
    expect(fixture.mutations).toEqual([]);
    expectWorkingFixtureSafe(fixture);
  });

  test("clinic administrator cannot open the system release-status route", async ({ page, baseURL }) => {
    const fixture = await installWorkingSmoke(page, "clinic_admin", baseURL!);
    await loginWorkingSmoke(page, "clinic_admin");
    await page.goto("/sys/release-status");
    await expect(page.getByRole("heading", { name: "Нет доступа", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Готовность публикации", exact: true })).toHaveCount(0);
    expectWorkingFixtureSafe(fixture);
  });
});
