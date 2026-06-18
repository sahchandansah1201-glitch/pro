import { expect, type Page, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

const ROUTE = "/patients/p-004/visits/v-005?tab=imaging&lesion=l-008";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /Открыть снимок a-1|Готовим ссылку для снимка a-1|Получить новую ссылку для снимка a-1|d-\d{3}|Device Bridge|Body Map|backend|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|MVP|demo|демо/i;

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

test.describe("Doctor visit imaging — native Russian asset labels", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
  });

  test("imaging route keeps native Russian UI on desktop and mobile", async ({ page }) => {

    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

      const body = page.locator("body");
      await expect(body).toContainText("Снимки визита");
      await expect(body).toContainText("Просмотр");
      await expect(body).not.toContainText(FORBIDDEN_VISIBLE);
      await expectNoHorizontalOverflow(page, `visit imaging @ ${viewport.name}`);
      if (viewport.width <= 390) {
        await expectMainTapTargets(page, `visit imaging @ ${viewport.name}`);
      }

      await page.screenshot({
        path: `test-results/ux-batch-28-visit-imaging-${viewport.name}.png`,
        fullPage: true,
      });
    }

    expect(consoleErrors, "application console errors").toEqual([]);
    expect(pageErrors, "application page errors").toEqual([]);
  });
});
