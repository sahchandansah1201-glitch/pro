import { test, expect, type Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /MVP|DryRun|JSON|MIS-style|MIS|МИС|RLS|demo|Demo|демо|backend|бэкенд|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|read-only|raw ID|imaging|DRM-\d|service-\d|doctor-\d|needs_check|in_progress|scheduled|cancelled|credential|session|signed|storagePath|signedUrl|accessToken|qrToken/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

async function openAdminRoute(page: Page, route: string) {
  await setDemoRole(page, "clinic_admin");
  await page.goto(route, { waitUntil: "networkidle" });
  expect(page.url(), `${route}: не должен редиректить на /login`).not.toMatch(/\/login(\?|$)/);
}

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));

  expect(overflow.docScroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll, `${label}: body overflow`).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMobileTapTargets(page: Page, label: string) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>('button, a[href], input:not([type="hidden"]), [role="tab"]'),
    );

    return nodes.flatMap((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") return [];
      if (rect.height >= 44) return [];
      return [
        {
          tag: el.tagName.toLowerCase(),
          text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
          h: Math.round(rect.height),
          w: Math.round(rect.width),
        },
      ];
    });
  });

  expect(
    offenders,
    `${label}: interactive targets under 44px\n${offenders
      .map((item) => `  • <${item.tag}> "${item.text}" ${item.w}x${item.h}`)
      .join("\n")}`,
  ).toEqual([]);
}

async function expectNativeRussianBoundary(page: Page, label: string) {
  const visible = await page.locator("body").innerText();
  expect(visible, `${label}: forbidden technical or English term`).not.toMatch(FORBIDDEN_VISIBLE);
  expect(visible, `${label}: unsafe medical copy`).not.toMatch(
    /меланома|рак кожи|вероятность меланомы|диагноз поставлен|назначить лечение/i,
  );
}

test.describe("Admin services and doctors — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`/admin/services @ ${viewport.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAdminRoute(page, "/admin/services");

      await expect(page.getByRole("heading", { name: "Услуги и тарифы" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Создание услуги" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Обновление из системы клиники" })).toBeVisible();
      if (viewport.width < 640) {
        await expect(page.getByText("Служебный код скрыт").first()).toBeVisible();
      } else {
        await expect(page.getByText("Служебный код").first()).toBeVisible();
      }

      await page.getByRole("button", { name: "Создать услугу вручную" }).click();
      await expect(page.getByText(/Черновик услуги подготовлен локально/)).toBeVisible();

      await expectNativeRussianBoundary(page, `/admin/services @ ${viewport.name}`);
      await expectNoHorizontalOverflow(page, `/admin/services @ ${viewport.name}`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(page, `/admin/services @ ${viewport.name}`);
      }
      expect(pageErrors, `/admin/services @ ${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(50);
      await page.screenshot({
        path: `test-results/admin-services-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });

    test(`/admin/doctors @ ${viewport.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAdminRoute(page, "/admin/doctors");

      await expect(page.getByRole("heading", { name: "Врачи" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Готовность врачей" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Расписание приёма" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Права и роли" })).toBeVisible();

      await page.getByRole("button", { name: "Проверить готовность врачей" }).click();
      await expect(page.getByText(/Проверка готовности врачей подготовлена локально/)).toBeVisible();

      await expectNativeRussianBoundary(page, `/admin/doctors @ ${viewport.name}`);
      await expectNoHorizontalOverflow(page, `/admin/doctors @ ${viewport.name}`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(page, `/admin/doctors @ ${viewport.name}`);
      }
      expect(pageErrors, `/admin/doctors @ ${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(50);
      await page.screenshot({
        path: `test-results/admin-doctors-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
