import { expect, type Page, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/patients/p-004/visits/v-005?tab=report&lesion=l-008";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /Пакет визита пациенту|Выпустить пакет пациенту|Выпуск заблокирован|Готов к выпуску|Пакет выпущен пациенту|Доступ пациенту выдан|DP-2026-\d+|Токен|токены|сервер|метаданные|ABCD total|7-point total|needs review|no images|\bok\b|backend|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i;

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
  const smallTargets = await page
    .locator("main a:visible, main button:visible, main [role='button']:visible")
    .evaluateAll((nodes) =>
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

test.describe("Doctor visit report — native Russian UI", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
  });

  test("report tab keeps human wording on desktop and mobile", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTE, { waitUntil: "networkidle" });

      await expect(page.getByRole("tab", { name: "Отчёт" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(page.locator("body")).toContainText("Контекст отчёта");
      await expect(page.locator("body")).toContainText("карта 0004");
      await expect(page.locator("body")).toContainText("Учебная форма");
      await expect(page.getByRole("region", { name: /Пакет визита для проверки/ })).toBeVisible();
      await expect(page.getByRole("region", { name: /Контур фото для проверки/ })).toBeVisible();
      await expect(page.locator("body")).not.toContainText(FORBIDDEN_VISIBLE);

      await expectNoHorizontalOverflow(page, `visit report @ ${viewport.name}`);
      if (viewport.width <= 390) {
        await expectMainTapTargets(page, `visit report @ ${viewport.name}`);
      }

      await page.screenshot({
        path: `test-results/ux-batch-27-visit-report-${viewport.name}.png`,
        fullPage: true,
      });
    }

    expect(consoleErrors, "application console errors").toEqual([]);
    expect(pageErrors, "application page errors").toEqual([]);
  });
});
