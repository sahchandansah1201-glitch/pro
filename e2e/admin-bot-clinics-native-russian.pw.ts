import { test, expect, type Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /MVP|DryRun|JSON|intake|routing|escalation|quality gate|demo|Demo|демо|raw ID|raw токен|Device Bridge|Bridge|backend|бэкенд|user refs|patient-visible|MVP boundary|aggregate\/config|Telegram Bot API|PHI|AI\/XAI|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|lead-\d|tg:|wa:|TELEGRAM|WHATSAPP|лиды|лидов|лидам/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

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

async function expectNativeRussianBoundary(page: Page, label: string) {
  const visible = await page.locator("body").innerText();
  expect(visible, `${label}: forbidden visible technical or English term`).not.toMatch(FORBIDDEN_VISIBLE);
  expect(visible, `${label}: unsafe medical copy`).not.toMatch(
    /меланома|рак кожи|вероятность меланомы|диагноз поставлен|назначить лечение/i,
  );
  expect(visible, `${label}: protected field leak`).not.toMatch(
    /storagePath|signedUrl|accessToken|qrToken|sessionId|credential|photoRef|doctorVersionText|patientSafeText/i,
  );
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

test.describe("Admin bot and clinics — native Russian UI", () => {
  for (const viewport of VIEWPORTS) {
    test(`/admin/bot @ ${viewport.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAdminRoute(page, "/admin/bot");

      await expect(page.getByRole("heading", { name: "Центр управления ботом" })).toBeVisible();
      await expect(page.getByText(/сбор данных, маршрутизация, качество фото/)).toBeVisible();
      await expect(page.getByText("Сценарии сбора данных")).toBeVisible();
      await expect(page.getByText("Передача оператору").first()).toBeVisible();

      await page
        .getByRole("button", { name: "Сформировать пробную проверку сценария" })
        .click();
      const preview = page.locator("pre");
      await expect(preview).toContainText("Пробная проверка сценария");
      await expect(preview).toContainText("Граница: только локальная проверка, сообщения не отправляются.");

      await expectNativeRussianBoundary(page, `/admin/bot @ ${viewport.name}`);
      await expectNoHorizontalOverflow(page, `/admin/bot @ ${viewport.name}`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(page, `/admin/bot @ ${viewport.name}`);
      }
      expect(pageErrors, `/admin/bot @ ${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(50);
      await page.screenshot({
        path: `test-results/admin-bot-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });

    test(`/admin/clinics @ ${viewport.name}`, async ({ page }) => {
      const pageErrors = collectPageErrors(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openAdminRoute(page, "/admin/clinics");

      await expect(page.getByRole("heading", { name: "Клиники и филиалы" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Маршрутизация заявок" })).toBeVisible();
      await expect(page.getByText("Ограничения передачи данных")).toBeVisible();
      await expect(page.getByText(/без фото, диагнозов и внутренних кодов/)).toBeVisible();

      await page.getByRole("button", { name: "Проверить филиалы" }).click();
      await expect(
        page.getByText("Проверка филиалов подготовлена локально. Рабочий пересчёт выполняется в системе клиники."),
      ).toBeVisible();

      await expectNativeRussianBoundary(page, `/admin/clinics @ ${viewport.name}`);
      await expectNoHorizontalOverflow(page, `/admin/clinics @ ${viewport.name}`);
      if (viewport.width < 640) {
        await expectMobileTapTargets(page, `/admin/clinics @ ${viewport.name}`);
      }
      expect(pageErrors, `/admin/clinics @ ${viewport.name}: console/page errors`).toEqual([]);

      await page.evaluate(() => window.scrollTo({ top: 0, left: 0 }));
      await page.waitForTimeout(50);
      await page.screenshot({
        path: `test-results/admin-clinics-native-russian-${viewport.name}.png`,
        fullPage: true,
      });
    });
  }
});
