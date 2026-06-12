import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

/**
 * E2E: на вкладке «Отчёт» кнопка отправки пациенту не реагирует на
 * клик — DOM не меняется, статус/история отправки не появляются — даже после
 * «Сформировать учебный отчёт». Рабочий код не трогаем.
 */

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const ROUTE = "/patients/p-004/visits/v-005?tab=report&lesion=l-008";

test.describe("VisitReportTab · отправка пациенту недоступна", () => {
  test.beforeEach(async ({ page }) => {
    await setDemoRole(page, "doctor");
  });

  test("клик не меняет DOM и не создаёт статус/историю отправки", async ({ page }) => {
    await page.goto(ROUTE, { waitUntil: "networkidle" });

    const reportTab = page.getByRole("tab", { name: "Отчёт" });
    await expect(reportTab).toHaveAttribute("data-state", "active");

    // 1. Заполняем поля и формируем учебный отчёт.
    await page
      .getByLabel(/Текст для пациента/)
      .fill("Запишитесь на повторный осмотр через 3 месяца.");
    await page
      .getByLabel(/Внутренняя заметка врача/)
      .fill("ABCD граничный, контроль через 3 мес.");
    await page.getByRole("button", { name: /Сформировать учебный отчёт/ }).click();

    // Превью появилось — отчёт реально сформирован.
    await expect(page.getByTestId("demo-report-preview")).toBeVisible();

    const sendBtn = page
      .getByRole("button", { name: /Отправка недоступна/ })
      .first();
    await expect(sendBtn).toBeVisible();
    await expect(sendBtn).toBeDisabled();
    await expect(sendBtn).toHaveAttribute("aria-disabled", /true/i);

    // 2. Снимок DOM до клика.
    const htmlBefore = await page.locator("main, body").first().innerHTML();

    // 3. Принудительный клик в обход disabled.
    await sendBtn.click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(200);

    // 4. Никакого статуса/истории отправки не появилось.
    const forbiddenStatusRe =
      /Отправлено|Отправляется|Ошибка отправки|История отправок|sending|sent|failed/i;
    expect(await page.content()).not.toMatch(forbiddenStatusRe);

    // Никаких «свежих» элементов с явной семантикой статуса/истории.
    expect(
      await page
        .locator(
          '[data-testid*="send-status"], [data-testid*="send-history"], [role="status"]',
        )
        .filter({ hasText: /отправ|sent|failed|sending/i })
        .count(),
    ).toBe(0);

    // 5. DOM main не изменился.
    const htmlAfter = await page.locator("main, body").first().innerHTML();
    expect(htmlAfter).toBe(htmlBefore);

    // 6. Helper-текст про систему клиники остался.
    await expect(
      page.getByText(/Отправка и печать будут подключены через систему клиники/),
    ).toBeVisible();
  });
});
