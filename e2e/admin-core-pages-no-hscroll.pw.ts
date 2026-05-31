import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: проверяем, что core admin-страницы открываются без редиректа
 * на /login и не имеют горизонтального скролла на ключевых ширинах.
 *
 * Авто-вход — через demo-role clinic_admin в localStorage (как в других
 * admin e2e). Сетевые/clipboard/storage-вызовы не делаем.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES = ["/admin", "/admin/doctors", "/admin/services", "/admin/clinics", "/admin/governance"] as const;

const SIZES = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
] as const;

test.describe("Admin core pages — нет горизонтального скролла", () => {
  for (const size of SIZES) {
    for (const route of ROUTES) {
      test(`${route} @ ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await setDemoRole(page, "clinic_admin");
        await page.goto(route, { waitUntil: "networkidle" });

        // Не ушли на /login.
        expect(page.url(), `${route}: не должен редиректить на /login`).not.toMatch(
          /\/login(\?|$)/,
        );

        // Страница реально отрендерилась (есть заголовок h1/h2 от PageHeader).
        await expect(page.locator("h1, h2").first()).toBeVisible();

        // Нет горизонтального скролла ни у документа, ни у body.
        const overflow = await page.evaluate(() => {
          const de = document.documentElement;
          const body = document.body;
          return {
            docScroll: de.scrollWidth,
            docClient: de.clientWidth,
            bodyScroll: body.scrollWidth,
            bodyClient: body.clientWidth,
            innerWidth: window.innerWidth,
          };
        });

        // Допускаем 1px на субпиксельный рендер.
        expect(
          overflow.docScroll,
          `${route} @ ${size.name}: documentElement.scrollWidth (${overflow.docScroll}) > clientWidth (${overflow.docClient})`,
        ).toBeLessThanOrEqual(overflow.docClient + 1);
        expect(
          overflow.bodyScroll,
          `${route} @ ${size.name}: body.scrollWidth (${overflow.bodyScroll}) > clientWidth (${overflow.bodyClient})`,
        ).toBeLessThanOrEqual(overflow.bodyClient + 1);

        // Скриншот для визуального ревью.
        await page.screenshot({
          path: `test-results/admin-core${route.replace(/\//g, "-")}-${size.name}.png`,
          fullPage: true,
        });
      });
    }
  }
});
