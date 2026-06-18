import { test, expect, type Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /Oops|Page not found|Return to Home|Previous slide|Next slide|Lovable Cloud|Email|Self-hosted|self-hosted|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Demo|demo|демо|MVP|raw ID|Body Map|Device Bridge|Mini App|сервер|сессия|Токен|token|credential|storagePath|signedUrl|accessToken|qrToken/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const ROUTES = [
  {
    name: "login",
    route: "/login",
    role: "doctor" as const,
    markers: [/Вход в Дерматолог Про/, /Выбрать учебную роль/, /Учебный режим/],
  },
  {
    name: "clinic-login",
    route: "/self-hosted/login",
    role: "doctor" as const,
    markers: [/Дерматолог Про — рабочий вход/, /Адрес системы клиники/, /Готовность входа/],
  },
  {
    name: "not-found",
    route: "/unknown-screen-for-ux-batch-26",
    role: "doctor" as const,
    markers: [/Страница не найдена/, /На стартовый экран/],
  },
  {
    name: "help",
    route: "/help",
    role: "doctor" as const,
    markers: [/Справка/, /Безопасность и границы текущей версии/],
  },
] as const;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectTapTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="button"], [role="tab"]'));
    return nodes.flatMap((el) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (rect.width === 0 || rect.height === 0 || cs.display === "none" || cs.visibility === "hidden") return [];
      if (rect.height >= 44 && rect.width >= 44) return [];
      return [{ text: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height) }];
    });
  });
  expect(offenders, `${label}: tap targets below 44px`).toEqual([]);
}

test.describe("UX Batch 26 — shared entry and fallback Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    for (const route of ROUTES) {
      test(`${route.name} @ ${viewport.name}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (msg) => {
          if (msg.type() === "error") consoleErrors.push(msg.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await setDemoRole(page, route.role);
        await page.goto(route.route, { waitUntil: "domcontentloaded" });

        for (const marker of route.markers) {
          await expect(page.locator("body")).toContainText(marker);
        }
        const visible = await page.locator("body").innerText();
        expect(visible, `${route.name} @ ${viewport.name}: forbidden visible text`).not.toMatch(FORBIDDEN_VISIBLE);
        await expectNoHorizontalOverflow(page, `${route.name} @ ${viewport.name}`);
        if (viewport.width <= 390) await expectTapTargets(page, `${route.name} @ ${viewport.name}`);

        await page.screenshot({
          path: `test-results/ux-batch-26-${route.name}-${viewport.name}.png`,
          fullPage: true,
        });
        const appConsoleErrors = consoleErrors.filter((text) => !text.includes("404 Error:"));
        expect(appConsoleErrors, `${route.name} @ ${viewport.name}: console errors`).toEqual([]);
        expect(pageErrors, `${route.name} @ ${viewport.name}: page errors`).toEqual([]);
      });
    }
  }
});
