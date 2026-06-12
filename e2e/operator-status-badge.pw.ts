import { test, expect, Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * Визуальная регрессия бейджа статуса защищённой ссылки на /operator.
 *
 * Снимаем сам бейдж (selector по role=status + aria-label) в 4 состояниях:
 *   active @ 100%, active @ 200%, expired @ 100%, expired @ 200%.
 *
 * "Масштаб 200%" реализуем через CSS zoom на <html> — это эквивалентно
 * браузерному Ctrl++ и затрагивает реальный layout, а не только transform.
 *
 * Эталоны (snapshot) автогенерируются при первом запуске; последующие
 * прогоны сравнивают с ними попиксельно (с допуском из playwright.config).
 */

async function setZoom(page: Page, zoom: 1 | 2) {
  await page.evaluate((z) => {
    document.documentElement.style.zoom = String(z);
  }, zoom);
}

async function gotoOperator(page: Page) {
  await setDemoRole(page, "operator");
  await page.goto("/operator", { waitUntil: "networkidle" });
  // Ждём, пока хотя бы один бейдж статуса появится в DOM.
  await page.waitForSelector('[role="status"][aria-label*="Статус защищённой ссылки"]');
}

async function selectActiveCard(page: Page) {
  // «Обращение 002» — карточка с активной ссылкой (по DEMO_NOW в фикстурах).
  await page
    .locator(".cursor-pointer", { hasText: "Обращение 002" })
    .first()
    .click();
  await page.waitForSelector('[role="status"][aria-label*="активна"]');
}

async function badgeLocator(page: Page, state: "active" | "expired") {
  const re = state === "active" ? /активна/ : /истекла/;
  return page.locator('[role="status"]').filter({ hasText: "" }).filter({
    has: page.locator("span"),
  }).filter({ hasText: state === "active" ? "активна" : "истекла" }).or(
    page.locator(`[role="status"][aria-label*="${re.source}"]`),
  ).first();
}

test.describe("Protected link status badge — visual regression", () => {
  for (const zoom of [1, 2] as const) {
    test(`expired @ ${zoom * 100}%`, async ({ page }) => {
      await gotoOperator(page);
      await setZoom(page, zoom);
      const badge = await badgeLocator(page, "expired");
      await expect(badge).toBeVisible();
      await badge.screenshot({ path: `test-results/badge-expired-${zoom * 100}.png` });
    });

    test(`active @ ${zoom * 100}%`, async ({ page }) => {
      await gotoOperator(page);
      await selectActiveCard(page);
      await setZoom(page, zoom);
      const badge = await badgeLocator(page, "active");
      await expect(badge).toBeVisible();
      await badge.screenshot({ path: `test-results/badge-active-${zoom * 100}.png` });
    });
  }
});
