import { test, expect, Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTES = [
  {
    name: "assessment",
    label: "Оценка",
    route: "/patients/p-004/visits/v-005?tab=assessment&lesion=l-008",
    marker: /Внимание подсказки|Контекст выбранного очага/,
  },
  {
    name: "conclusion",
    label: "Заключение",
    route: "/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008",
    marker: /Учебное заключение на экране|Итог ABCD/,
  },
] as const;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

const FORBIDDEN_VISIBLE =
  /MVP|мок|mock|демо-заключение|Демо-заключение|ABCD total|7-point total|needs review|no images|Уровень риска|backend|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|storagePath|signedUrl|accessToken|qrToken|sessionId|credential|биопсия|biopsy|UI текущего|сервере/i;

const TRANSIENT_BROWSER_RESOURCE_ERROR = /^Failed to load resource: net::ERR_CONNECTION_CLOSED$/;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const body = document.body;
    return {
      docScroll: de.scrollWidth,
      docClient: de.clientWidth,
      bodyScroll: body.scrollWidth,
      bodyClient: body.clientWidth,
    };
  });
  expect(m.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(m.docClient + 1);
  expect(m.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(m.bodyClient + 1);
}

async function expectMainTapTargets(page: Page, label: string) {
  const offenders = await page.locator("main button, main a[href], main [role='button']").evaluateAll((els) =>
    els
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        const text = (el.textContent || el.getAttribute("aria-label") || "").trim();
        return {
          text,
          width: rect.width,
          height: rect.height,
          hidden:
            style.visibility === "hidden" ||
            style.display === "none" ||
            rect.width === 0 ||
            rect.height === 0,
        };
      })
      .filter((item) => !item.hidden && (item.width < 44 || item.height < 44)),
  );
  expect(offenders, `${label}: touch targets below 44px`).toEqual([]);
}

test.describe("Doctor visit assessment/conclusion — нативный русский UI", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
  });

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
        await page.goto(route.route, { waitUntil: "networkidle" });

        expect(page.url(), "не должно редиректить на /login").not.toMatch(/\/login(\?|$)/);
        await expect(page.getByRole("tab", { name: route.label })).toHaveAttribute(
          "data-state",
          "active",
        );

        const panel = page.locator('[role="tabpanel"][data-state="active"]').first();
        await expect(panel).toBeVisible();
        await expect(panel).toContainText(route.marker);

        const panelText = await panel.innerText();
        expect(panelText).not.toMatch(FORBIDDEN_VISIBLE);
        const mainText = await page.locator("main").innerText();
        expect(mainText, "raw patient card number must stay hidden").not.toMatch(/DP-\d{4}-\d+/);
        expect(mainText).toMatch(/карта 0004/);
        await expectNoHorizontalOverflow(page, `${route.name} ${viewport.name}`);

        if (viewport.width <= 390) {
          await expectMainTapTargets(page, `${route.name} ${viewport.name}`);
        }

        await page.screenshot({
          path: `test-results/ux-batch-25-${route.name}-${viewport.name}.png`,
          fullPage: true,
        });

        const appConsoleErrors = consoleErrors.filter(
          (text) => !TRANSIENT_BROWSER_RESOURCE_ERROR.test(text),
        );
        expect(appConsoleErrors).toEqual([]);
        expect(pageErrors).toEqual([]);
      });
    }
  }
});
