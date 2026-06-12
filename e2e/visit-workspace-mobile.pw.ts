import { test, expect, Page } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E (mobile 390): Visit Workspace для p-004 / v-005 / l-008
 * проходит весь клинический поток без горизонтального скролла:
 *   Карта тела → Снимки → Оценка → Заключение → Отчёт.
 *
 * Production-код не трогаем. Используем только публичные ARIA-локаторы и
 * допустимую учебную роль в localStorage (как в других admin pw-тестах).
 * Сетевых/clipboard/storage вызовов нет.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE =
  "/patients/p-004/visits/v-005?tab=report&lesion=l-008";

const VIEWPORT = { width: 390, height: 1200 };

const TABS = [
  { value: "bodymap", label: "Карта тела" },
  { value: "imaging", label: "Снимки" },
  { value: "assessment", label: "Оценка" },
  { value: "conclusion", label: "Заключение" },
  { value: "report", label: "Отчёт" },
] as const;

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const m = await page.evaluate(() => {
    const de = document.documentElement;
    const body = document.body;
    return {
      docScroll: de.scrollWidth,
      docClient: de.clientWidth,
      bodyScroll: body.scrollWidth,
      bodyClient: body.clientWidth,
      innerWidth: window.innerWidth,
    };
  });
  // Допускаем 1px на субпиксельный рендер.
  expect(
    m.docScroll,
    `${label}: documentElement.scrollWidth ${m.docScroll} > clientWidth ${m.docClient}`,
  ).toBeLessThanOrEqual(m.docClient + 1);
  expect(
    m.bodyScroll,
    `${label}: body.scrollWidth ${m.bodyScroll} > clientWidth ${m.bodyClient}`,
  ).toBeLessThanOrEqual(m.bodyClient + 1);
}

test.describe("Visit Workspace mobile@390 — без горизонтального скролла", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(VIEWPORT);
    await setDemoRole(page, "doctor");
  });

  test("Report → переключение по всем вкладкам и обратно", async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: "networkidle" });

    expect(page.url(), "не должно редиректить на /login").not.toMatch(/\/login(\?|$)/);

    // 1. Активна вкладка «Отчёт».
    const reportTab = page.getByRole("tab", { name: "Отчёт" });
    await expect(reportTab).toBeVisible();
    await expect(reportTab).toHaveAttribute("data-state", "active");

    // 2. Нет горизонтального скролла на Report.
    await expectNoHorizontalOverflow(page, "report (initial)");

    // 3. Кнопки отчёта существуют и задизейблены.
    const printBtn = page
      .getByRole("button", { name: /Печать недоступна/ })
      .first();
    await expect(printBtn).toBeVisible();
    await expect(printBtn).toBeDisabled();

    const sendBtn = page
      .getByRole("button", { name: /Отправка недоступна/ })
      .first();
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();

    // 4. Переход по всем табам, проверка overflow на каждом.
    for (const tab of TABS) {
      const trigger = page.getByRole("tab", { name: tab.label });
      await expect(trigger).toBeVisible();
      await trigger.click();
      await expect(trigger).toHaveAttribute("data-state", "active");

      // Tab content должен показаться. Контент обёрнут в [role=tabpanel].
      const panel = page.locator(`[role="tabpanel"][data-state="active"]`).first();
      await expect(panel).toBeVisible();

      // Дать layout устаканиться.
      await page.waitForTimeout(150);
      await expectNoHorizontalOverflow(page, `tab=${tab.value}`);

      // Точечные проверки контекста по табам.
      if (tab.value === "bodymap") {
        // Карта/проекция: видимы русские переключатели сторон тела.
        const projection = page
          .getByRole("button", { name: /Спереди|Сзади|Слева|Справа|Голова/i })
          .first();
        await expect(projection).toBeVisible();
        // Попробуем переключить проекцию, если есть «Сзади».
        const back = page.getByRole("button", { name: /Сзади/i }).first();
        if (await back.isVisible().catch(() => false)) {
          await back.click().catch(() => undefined);
          await page.waitForTimeout(100);
          await expectNoHorizontalOverflow(page, "bodymap after projection switch");
        }
      }

      if (tab.value === "imaging" || tab.value === "assessment" ||
          tab.value === "conclusion" || tab.value === "report") {
        // Контекст лезии l-008 сохраняется в URL и где-то отображается
        // (заголовок, чип, breadcrumb). Достаточно проверить, что URL содержит lesion=l-008.
        expect(page.url()).toContain("lesion=l-008");
      }
    }

    // 5. Финальный заход на Report — overflow и кнопки.
    const reportTrigger = page.getByRole("tab", { name: "Отчёт" });
    await reportTrigger.click();
    await expect(reportTrigger).toHaveAttribute("data-state", "active");
    await page.waitForTimeout(150);
    await expectNoHorizontalOverflow(page, "report (final)");

    await expect(
      page.getByRole("button", { name: /Печать недоступна/ }).first(),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: /Отправка недоступна/ }).first(),
    ).toBeDisabled();

    await page.screenshot({
      path: `test-results/visit-workspace-mobile-390-report.png`,
      fullPage: true,
    });
  });
});
