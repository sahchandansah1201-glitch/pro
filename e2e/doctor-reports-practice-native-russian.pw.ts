import { expect, type Page, test } from "@playwright/test";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROLE_STORAGE_KEY = "derma-pro:demo-role";

const FORBIDDEN_VISIBLE =
  /MVP|demo|Demo|демо|mock|Mock|raw ID|raw id|self-hosted|backend|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|token|токен|credential|session|signedUrl|storagePath|accessToken|qrToken|sharedLink|doctorVersionText|lead|лид|dermoscopy|macro|overview|body_map|DP-2026-\d+/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

async function setRole(page: Page, role: string) {
  await page.addInitScript(
    ({ key, value }) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        // Demo-role persistence is best-effort in browser startup hooks.
      }
    },
    { key: ROLE_STORAGE_KEY, value: role },
  );
}

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
  expect(visibleText, `${label}: visible UI contains forbidden technical wording`).not.toMatch(FORBIDDEN_VISIBLE);
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

test.describe("Doctor reports and private practice — native Russian UI", () => {
  test("reports and private practice keep task-first Russian UI on desktop and mobile", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    const routes = [
      {
        path: "/reports",
        role: "doctor",
        visibleText: "Центр отчётов",
        currentAction: "Открыть отчёт в визите",
        screenshot: "ux-batch-22-reports",
      },
      {
        path: "/practice",
        role: "private_doctor",
        visibleText: "Центр частной практики",
        currentAction: "Разобрать заявку",
        screenshot: "ux-batch-22-practice",
      },
    ];

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const route of routes) {
        await setRole(page, route.role);
        await page.goto(route.path, { waitUntil: "networkidle" });
        await expect(page.locator("body")).toContainText(route.visibleText);
        await expect(page.locator("body")).toContainText(route.currentAction);
        await expectNoForbiddenVisibleTerms(page, `${route.path} @ ${viewport.name}`);
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
