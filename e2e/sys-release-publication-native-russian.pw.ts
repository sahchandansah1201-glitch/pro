import { expect, test, type Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/sys/release-status";

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /релиз|пресет|токен|cookie|cookies|self-hosted|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|readiness|governance|Device Bridge|PostgreSQL|dry-run|history-запис|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|MVP|demo|mock|сервер|Release|Preset|workflow|history/i;

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
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), select, textarea',
      ),
    ).flatMap((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") return [];
      if (rect.height >= 44) return [];
      const label =
        el.getAttribute("aria-label") ||
        el.textContent?.replace(/\s+/g, " ").trim() ||
        el.getAttribute("href") ||
        el.tagName;
      return [`${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`];
    });
  });

  expect(offenders, `${label}: interactive targets below 44px`).toEqual([]);
}

test.describe("System publication status — native Russian UI", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "system_admin");
  });

  for (const viewport of VIEWPORTS) {
    test(`/sys/release-status @ ${viewport.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto(ROUTE, { waitUntil: "domcontentloaded" });

      await expect(
        page.getByRole("heading", { level: 1, name: "Готовность публикации" }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Предпросмотр готовности публикации" }),
      ).toContainText("Проверки основной ветки");
      await expect(page.getByRole("region", { name: "Импорт журнала публикации" })).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Управление наборами фильтров журнала публикации" }),
      ).toBeVisible();

      const visible = await page.locator("body").innerText();
      expect(visible, `${viewport.name}: forbidden technical copy`).not.toMatch(FORBIDDEN_VISIBLE);
      expect(visible, `${viewport.name}: unsafe medical copy`).not.toMatch(
        /диагноз|риск|прогноз|лечение|меланома|рак кожи|динамический вывод|измерени/i,
      );

      await expectNoHorizontalOverflow(page, `/sys/release-status @ ${viewport.name}`);
      if (viewport.width <= 390) {
        await expectMainTapTargets(page, `/sys/release-status @ ${viewport.name}`);
      }
      expect(consoleErrors, `${viewport.name}: application console errors`).toEqual([]);
      expect(pageErrors, `${viewport.name}: application page errors`).toEqual([]);

      await page.screenshot({
        path: `test-results/ux-batch-30-sys-release-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
