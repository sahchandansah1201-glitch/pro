import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/admin/analytics";

const FORBIDDEN_VISIBLE =
  /MVP|PHI|AI\/XAI|AI|XAI|production|Production|JSON|DryRun|metadata|workflow|policy|evidence|rollout|monitoring|validation|backend|self-hosted|safeSummary|protectedLink|quality score|demo|Demo|демо/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

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

async function expectVisibleRussian(page: import("@playwright/test").Page, label: string) {
  const text = await page.locator("body").innerText();
  expect(text, `${label}: forbidden visible technical term`).not.toMatch(FORBIDDEN_VISIBLE);
  expect(text).toContain("Только агрегаты");
  expect(text).toContain("Без персональных данных");
  expect(text).toContain("Сформировать учебный отчёт");
}

async function expectTapTargets(page: import("@playwright/test").Page, label: string) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const nodes = Array.from(root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="tab"]'));
    return nodes.flatMap((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return [];
      if (rect.height >= 44) return [];
      return [{
        tag: el.tagName.toLowerCase(),
        text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
        h: Math.round(rect.height),
        w: Math.round(rect.width),
      }];
    });
  });

  expect(
    offenders,
    `${label}: interactive targets under 44px\n${offenders.map((item) => `  • <${item.tag}> "${item.text}" ${item.w}x${item.h}`).join("\n")}`,
  ).toEqual([]);
}

test.describe("Admin analytics — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: visible copy, report preview, overflow and targets`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setDemoRole(page, "clinic_admin");
      await page.goto(ROUTE, { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Аналитика" })).toBeVisible();
      await expect(page.getByText(/Только агрегаты\. Без персональных данных/)).toBeVisible();
      await page.waitForTimeout(350);

      await expectVisibleRussian(page, viewport.name);
      await page.getByRole("button", { name: "Сформировать учебный отчёт" }).click();
      const preview = page.getByLabel("Безопасный агрегатный предпросмотр отчёта");
      await expect(preview).toBeVisible();
      await expect(preview).toContainText("Граница: только агрегаты, без пациентских строк");
      await expectVisibleRussian(page, `${viewport.name} report`);
      await expectNoHorizontalOverflow(page, viewport.name);
      await expectTapTargets(page, viewport.name);

      await page.screenshot({
        path: `test-results/admin-analytics-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
