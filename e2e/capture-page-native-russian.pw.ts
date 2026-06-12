import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/capture";
const FORBIDDEN_VISIBLE = [
  "MVP",
  "Device Bridge",
  "Body map",
  "DryRun",
  "JSON",
  "backend",
  "production",
  "metadata",
  "workflow",
  "policy",
  "evidence",
  "rollout",
  "monitoring",
  "validation",
  "AI",
  "XAI",
  "PHI",
  "credential",
  "session",
  "signed",
  "482 913",
  "DP-LOCAL",
  "quality score",
  "closed",
  "scheduled",
  "in_progress",
  "cancelled",
] as const;

const FORBIDDEN_REGEX = /MVP|Device Bridge|Body map|DryRun|JSON|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|AI|XAI|PHI|credential|session|signed|482 913|DP-LOCAL|quality score|closed|scheduled|in_progress|cancelled/i;
const RAW_DEVICE_REGEX = /\b(?:d-00[1-4]|DL5-|HD30-|FF-HS|DL3-|br-msk|br-spb)\b/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 900 },
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

test.describe("Capture page — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name}: visible copy, overflow and targets`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setDemoRole(page, "doctor");
      await page.goto(ROUTE, { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Съёмка" })).toBeVisible();
      await expect(page.getByText(/Учебный режим: реальные устройства не подключены/)).toBeVisible();

      for (const tab of ["Телефон", "Файл", "Дерматоскоп", "Локально"]) {
        await page.getByRole("tab", { name: tab }).click();
        await page.waitForTimeout(100);
        await expectNoHorizontalOverflow(page, `${viewport.name} ${tab}`);
      }

      const visible = await page.locator("body").innerText();
      expect(visible).not.toMatch(FORBIDDEN_REGEX);
      expect(visible).not.toMatch(RAW_DEVICE_REGEX);
      for (const term of FORBIDDEN_VISIBLE) {
        expect(visible, `${term} should not be visible`).not.toContain(term);
      }

      await expectTapTargets(page, viewport.name);
      await page.screenshot({
        path: `test-results/capture-page-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
