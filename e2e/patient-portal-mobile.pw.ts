import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: страницы пациентского портала на мобильной ширине без
 * горизонтального скролла. Авто-вход — demo-role в localStorage.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES = [
  "/me",
  "/me/history",
  "/me/booking",
  "/me/reminders",
  "/me/reports",
  "/me/reports/r-001",
] as const;

const SIZES = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /AI|XAI|demo|Demo|демо|follow-up|CRM|SMS|push|backend|бэкенд|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|MVP|raw ID|raw id|token|токен|credential|session|signedUrl|storagePath|accessToken|qrToken|doctorVersionText|patientSafeText|safeSummary|protectedLink|план лечения|Решения о лечении|автоматическая подсказка|предварительная оценка/i;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));

  expect(
    overflow.docScroll,
    `${label}: doc scroll ${overflow.docScroll} > client ${overflow.docClient}`,
  ).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(
    overflow.bodyScroll,
    `${label}: body scroll ${overflow.bodyScroll} > client ${overflow.bodyClient}`,
  ).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMainTapTargets(page: import("@playwright/test").Page, label: string) {
  const smallTargets = await page.locator("main a:visible, main button:visible, main [role='button']:visible").evaluateAll(
    (nodes) =>
      nodes
        .map((node) => {
          const rect = node.getBoundingClientRect();
          const text =
            node.getAttribute("aria-label") ||
            node.textContent?.replace(/\s+/g, " ").trim() ||
            node.getAttribute("href") ||
            node.tagName;
          return { width: rect.width, height: rect.height, text };
        })
        .filter((item) => item.width > 0 && item.height > 0 && (item.width < 44 || item.height < 44)),
  );

  expect(smallTargets, `${label}: tap targets below 44px`).toEqual([]);
}

const routeSlug = (route: string) =>
  route === "/me" ? "home" : route.replace(/^\/me\/?/, "").replace(/\//g, "-");

test.describe("Patient portal — native Russian UI", () => {
  for (const size of SIZES) {
    for (const route of ROUTES) {
      test(`${route} @ ${size.name}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await page.setViewportSize({ width: size.width, height: size.height });
        await setDemoRole(page, "patient");
        await page.goto(route, { waitUntil: "domcontentloaded" });

        expect(page.url(), `${route}: не должен редиректить на /login`).not.toMatch(
          /\/login(\?|$)/,
        );

        await expect(page.locator("h1, h2").first()).toBeVisible();

        await expectNoHorizontalOverflow(page, `${route} @ ${size.name}`);
        const visibleText = await page.locator("body").innerText();
        expect(visibleText, `${route} @ ${size.name}: forbidden visible wording`).not.toMatch(FORBIDDEN_VISIBLE);
        if (size.width <= 390) {
          await expectMainTapTargets(page, `${route} @ ${size.name}`);
        }
        await page.screenshot({
          path: `test-results/ux-batch-23-patient-${routeSlug(route)}-${size.name}.png`,
          fullPage: true,
        });
        expect(consoleErrors, `${route} @ ${size.name}: console errors`).toEqual([]);
        expect(pageErrors, `${route} @ ${size.name}: page errors`).toEqual([]);
      });
    }
  }
});
