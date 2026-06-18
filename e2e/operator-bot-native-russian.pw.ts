import { expect, type Page, test } from "@playwright/test";

import { type DemoRole, setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /\b(MVP|AI|XAI|Demo|demo|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|Mini App|Lead ID|Appointment ID|Lead|lead|handoff|CTA|quality gate|raw ID|token|credential|session|signedUrl|storagePath|accessToken|qrToken|start|instruction|recommendation|done)\b|демо|бэкенд|лид|токен|Telegram|WhatsApp|DP-2026-\d+/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const ROUTES: {
  path: string;
  role: DemoRole;
  heading: string | RegExp;
  primaryText: string | RegExp;
  screenshot: string;
}[] = [
  {
    path: "/operator",
    role: "operator",
    heading: "Центр обращений оператора",
    primaryText: "Очередь передачи",
    screenshot: "ux-batch-32-operator-console",
  },
  {
    path: "/operator/booking-requests",
    role: "operator",
    heading: "Запросы на запись",
    primaryText: "Очередь заявок включается в рабочем режиме",
    screenshot: "ux-batch-32-operator-booking-requests",
  },
  {
    path: "/operator/dialogs/bd-001",
    role: "operator",
    heading: /Обращение 001/,
    primaryText: "Учебные действия",
    screenshot: "ux-batch-32-operator-dialog",
  },
  {
    path: "/bot-sim",
    role: "patient",
    heading: "Помощник записи",
    primaryText: "Предварительная сводка не является диагнозом.",
    screenshot: "ux-batch-32-bot-sim",
  },
  {
    path: "/bot-sim/miniapp/booking",
    role: "patient",
    heading: "Запись в клинику",
    primaryText: "Учебная форма записи",
    screenshot: "ux-batch-32-bot-mini-booking",
  },
];

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

async function expectNoForbiddenVisibleTerms(page: Page, label: string) {
  const visibleText = await page.locator("body").innerText();
  expect(visibleText, `${label}: visible UI contains forbidden technical wording`).not.toMatch(
    FORBIDDEN_VISIBLE,
  );
  expect(visibleText, `${label}: unsafe medical copy`).not.toMatch(
    /меланома|рак кожи|вероятность меланомы|финальный диагноз|назначить лечение|прогноз/i,
  );
}

async function expectMainTapTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"]',
      ),
    );
    return nodes.flatMap((node) => {
      const rect = node.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const style = getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden") return [];
      if (rect.height >= 44) return [];
      const label =
        node.getAttribute("aria-label") ||
        node.textContent?.replace(/\s+/g, " ").trim() ||
        node.getAttribute("href") ||
        node.tagName;
      return [{ label: label.slice(0, 100), width: Math.round(rect.width), height: Math.round(rect.height) }];
    });
  });

  expect(
    offenders,
    `${label}: interactive targets below 44px\n${offenders
      .map((item) => `  - ${item.width}x${item.height}: ${item.label}`)
      .join("\n")}`,
  ).toEqual([]);
}

test.describe("Operator and booking helper — native Russian UI", () => {
  test("operator and booking helper routes stay Russian, reachable, and responsive", async ({ page }) => {
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

        expect(page.url(), `${route.path}: should not redirect to login`).not.toMatch(/\/login(\?|$)/);
        await expect(page.locator("body")).toContainText(route.heading);
        await expect(page.locator("body")).toContainText(route.primaryText);

        await expectNoForbiddenVisibleTerms(page, `${route.path} @ ${viewport.name}`);
        await expectNoHorizontalOverflow(page, `${route.path} @ ${viewport.name}`);
        if (viewport.width <= 390) {
          await expectMainTapTargets(page, `${route.path} @ ${viewport.name}`);
        }

        await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
        await page.waitForTimeout(50);
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
