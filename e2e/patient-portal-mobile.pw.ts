import { test, expect } from "@playwright/test";

/**
 * E2E: страницы пациентского портала на мобильной ширине без
 * горизонтального скролла. Авто-вход — demo-role в localStorage.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES = [
  "/me",
  "/me/booking",
  "/me/reminders",
  "/me/reports/r-001",
] as const;

const SIZES = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

test.describe("Patient portal — нет горизонтального скролла на мобильных", () => {
  for (const size of SIZES) {
    for (const route of ROUTES) {
      test(`${route} @ ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.addInitScript(() => {
          try {
            localStorage.setItem("derma-pro:demo-role", "patient");
          } catch {
            /* ignore */
          }
        });
        await page.goto(route, { waitUntil: "networkidle" });

        expect(page.url(), `${route}: не должен редиректить на /login`).not.toMatch(
          /\/login(\?|$)/,
        );

        await expect(page.locator("h1, h2").first()).toBeVisible();

        const overflow = await page.evaluate(() => ({
          docScroll: document.documentElement.scrollWidth,
          docClient: document.documentElement.clientWidth,
          bodyScroll: document.body.scrollWidth,
          bodyClient: document.body.clientWidth,
        }));

        expect(
          overflow.docScroll,
          `${route} @ ${size.name}: doc scroll ${overflow.docScroll} > client ${overflow.docClient}`,
        ).toBeLessThanOrEqual(overflow.docClient + 1);
        expect(
          overflow.bodyScroll,
          `${route} @ ${size.name}: body scroll ${overflow.bodyScroll} > client ${overflow.bodyClient}`,
        ).toBeLessThanOrEqual(overflow.bodyClient + 1);
      });
    }
  }
});
