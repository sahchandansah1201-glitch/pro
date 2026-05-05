import { test, expect } from "@playwright/test";

/**
 * E2E: операторский Dialog + Bot Sim/Mini App без горизонтального
 * скролла на мобильных ширинах. Авто-вход — demo-role в localStorage.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES: { path: string; role: string }[] = [
  { path: "/operator/dialogs/bd-001", role: "operator" },
  { path: "/bot-sim", role: "patient" },
  { path: "/bot-sim/miniapp/booking", role: "patient" },
];

const SIZES = [
  { name: "mobile-375", width: 375, height: 812 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

test.describe("Operator+Bot pages — нет горизонтального скролла", () => {
  for (const size of SIZES) {
    for (const r of ROUTES) {
      test(`${r.path} @ ${size.name}`, async ({ page }) => {
        await page.setViewportSize({ width: size.width, height: size.height });
        await page.addInitScript((role) => {
          try {
            localStorage.setItem("derma-pro:demo-role", role);
          } catch {
            /* ignore */
          }
        }, r.role);
        await page.goto(r.path, { waitUntil: "networkidle" });

        expect(page.url(), `${r.path}: не должен редиректить на /login`).not.toMatch(
          /\/login(\?|$)/,
        );

        const overflow = await page.evaluate(() => ({
          docScroll: document.documentElement.scrollWidth,
          docClient: document.documentElement.clientWidth,
          bodyScroll: document.body.scrollWidth,
          bodyClient: document.body.clientWidth,
        }));
        expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
        expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);
      });
    }
  }
});
