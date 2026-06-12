import { test, expect } from "@playwright/test";

const VALID = "pal-tok-ac002-demo";
const EXPIRED = "pal-tok-ac001-demo";
const INVALID = "no-such-token";

const ROUTES: Array<{ path: string; heading: RegExp }> = [
  { path: `/analysis/${VALID}`, heading: /Предварительная сводка/ },
  { path: `/analysis/${EXPIRED}`, heading: /Ссылка истекла/ },
  { path: `/analysis/${INVALID}`, heading: /Ссылка не найдена/ },
];

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /AI|XAI|demo|Demo|демо|backend|бэкенд|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|token|токен|credential|session|signedUrl|storagePath|accessToken|qrToken|doctorVersionText|patientSafeText|safeSummary|protectedLink|raw ID|raw id|MVP/i;

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

for (const r of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`public analysis ${r.path} — native Russian UI @ ${viewport.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(r.path);
      await expect(page.getByRole("heading", { level: 1, name: r.heading })).toBeVisible();
      await expectNoHorizontalOverflow(page, `${r.path} @ ${viewport.name}`);
      const visibleText = await page.locator("body").innerText();
      expect(visibleText, `${r.path} @ ${viewport.name}: forbidden visible wording`).not.toMatch(FORBIDDEN_VISIBLE);
      await page.screenshot({
        path: `test-results/ux-batch-23-public-${r.path.split("/").pop()}-${viewport.name}.png`,
        fullPage: true,
      });
      expect(consoleErrors, `${r.path} @ ${viewport.name}: console errors`).toEqual([]);
      expect(pageErrors, `${r.path} @ ${viewport.name}: page errors`).toEqual([]);
    });
  }
}
