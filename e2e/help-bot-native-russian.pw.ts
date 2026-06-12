import { expect, type Page, test } from "@playwright/test";

import { type DemoRole, setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /\b(MVP|AI|XAI|Demo|demo|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Device Bridge|Body Map|Mini App|Telegram|CRM|ERP|RoleGuard|raw ID|Lead ID|lead|quality gate|CTA)\b|демо|бэкенд|лид/i;

const ROUTES: { path: string; role: DemoRole; title: string; action: string; screenshot: string }[] = [
  {
    path: "/help",
    role: "doctor",
    title: "Справка",
    action: "Безопасность и границы текущей версии",
    screenshot: "ux-batch-24-help",
  },
  {
    path: "/bot-sim",
    role: "patient",
    title: "Помощник записи",
    action: "Новое фото",
    screenshot: "ux-batch-24-bot-sim",
  },
];

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));

  expect(
    overflow.docScroll,
    `${label}: documentElement.scrollWidth (${overflow.docScroll}) > clientWidth (${overflow.docClient})`,
  ).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(
    overflow.bodyScroll,
    `${label}: body.scrollWidth (${overflow.bodyScroll}) > clientWidth (${overflow.bodyClient})`,
  ).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMainTapTargets(page: Page, label: string) {
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

test.describe("Help and booking assistant — native Russian UI", () => {
  test("shared help and booking assistant stay Russian, readable, and mobile-safe", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of ROUTES) {
        await setDemoRole(page, route.role);
        await page.goto(route.path, { waitUntil: "networkidle" });

        expect(page.url(), `${route.path}: не должен редиректить на /login`).not.toMatch(/\/login(\?|$)/);
        await expect(page.locator("body")).toContainText(route.title);
        await expect(page.locator("body")).toContainText(route.action);

        const visibleText = await page.locator("body").innerText();
        expect(visibleText, `${route.path} @ ${viewport.name}: forbidden visible wording`).not.toMatch(FORBIDDEN_VISIBLE);

        await expectNoHorizontalOverflow(page, `${route.path} @ ${viewport.name}`);
        if (viewport.width <= 390) {
          await expectMainTapTargets(page, `${route.path} @ ${viewport.name}`);
        }
        await page.screenshot({
          path: `test-results/${route.screenshot}-${viewport.name}.png`,
          fullPage: true,
        });
      }
    }

    expect(consoleErrors, "application console errors").toEqual([]);
    expect(pageErrors, "application page errors").toEqual([]);
  });
});
