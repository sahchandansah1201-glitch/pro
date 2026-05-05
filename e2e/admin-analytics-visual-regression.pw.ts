import { test, expect } from "@playwright/test";

/**
 * Визуальная регрессия для /admin/analytics.
 *
 * Использует встроенный Playwright `toHaveScreenshot`, который при первом
 * прогоне сохраняет baseline-снимки рядом с тестом
 * (`admin-analytics-visual-regression.pw.ts-snapshots/`), а на последующих
 * прогонах делает pixel-diff против baseline. Допуски (maxDiffPixelRatio,
 * threshold) заданы в `playwright.config.ts`.
 *
 * Запуск:
 *   npx playwright test e2e/admin-analytics-visual-regression.pw.ts
 * Обновить baseline:
 *   npx playwright test e2e/admin-analytics-visual-regression.pw.ts --update-snapshots
 */

const SIZES = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

test.describe("/admin/analytics — visual regression (pixel diff)", () => {
  for (const size of SIZES) {
    test(`${size.name} (${size.width}x${size.height})`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });

      // Авто-вход в админ-панель: демо-роль clinic_admin до загрузки приложения.
      await page.addInitScript(() => {
        try {
          localStorage.setItem("derma-pro:demo-role", "clinic_admin");
        } catch {
          /* ignore */
        }
      });

      await page.goto("/admin/analytics", { waitUntil: "networkidle" });

      // Дожидаемся, что секция сортировки клиник отрисована — иначе скриншот
      // может попасть в момент загрузки и давать ложные diff'ы.
      await expect(
        page.locator('[role="tablist"][aria-label="Сортировка клиник"]'),
      ).toBeVisible();

      // Отключаем анимации/transition, чтобы убрать flaky pixel-diff.
      await page.addStyleTag({
        content: `*, *::before, *::after {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
        }`,
      });

      await expect(page).toHaveScreenshot(`admin-analytics-${size.name}.png`, {
        fullPage: true,
      });
    });
  }
});
