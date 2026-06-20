import { expect, type Page, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const FORBIDDEN_VISIBLE =
  /MVP|DryRun|JSON|PHI|AI\/XAI|backend|бэкенд|self-hosted|production|metadata|workflow|policy|evidence|rollout|monitoring|validation|governance|readiness|raw ID|file proxy|credential|fingerprint|session id|storagePath|signedUrl|accessToken|qrToken|sessionId|doctorVersionText|patientSafeText|objectBucket|objectKey|DP-2026|меланома|рак кожи|вероятность меланомы|финальный диагноз|план лечения/i;

const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 900 },
  { name: "mobile-390", width: 390, height: 844 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    docScroll: document.documentElement.scrollWidth,
    docClient: document.documentElement.clientWidth,
    bodyScroll: document.body.scrollWidth,
    bodyClient: document.body.clientWidth,
  }));
  expect(overflow.docScroll).toBeLessThanOrEqual(overflow.docClient + 1);
  expect(overflow.bodyScroll).toBeLessThanOrEqual(overflow.bodyClient + 1);
}

async function expectMainTapTargets(page: Page) {
  const offenders = await page.evaluate(() => {
    const root = document.querySelector("main") ?? document.body;
    return Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, a[href], input:not([type="hidden"]), textarea, select, [role="button"], [role="tab"]',
      ),
    )
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          text: (el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 80),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          hidden:
            rect.width === 0 ||
            rect.height === 0 ||
            style.display === "none" ||
            style.visibility === "hidden",
        };
      })
      .filter((item) => !item.hidden && item.height < 44);
  });
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
}

test.describe("Patient delivery gates — native Russian release decision", () => {
  for (const viewport of VIEWPORTS) {
    test(`/admin/governance @ ${viewport.name}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") consoleErrors.push(msg.text());
      });
      page.on("pageerror", (error) => pageErrors.push(error.message));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await setDemoRole(page, "clinic_admin");
      await page.goto("/admin/governance", { waitUntil: "networkidle" });

      await expect(page.getByRole("heading", { name: "Управление доступом" })).toBeVisible();
      const decision = page.getByRole("region", { name: "Решение о выдаче пациенту" });
      await expect(decision).toBeVisible();
      await expect(decision.getByRole("heading", { name: "Выдача выключена" })).toBeVisible();

      for (const text of [
        "Текст для пациента",
        "Правила хранения",
        "Срок доступа",
        "Защищённая выдача файлов",
        "Сеансы доступа",
        "Безопасность данных",
        "Проверить текст для пациента",
      ]) {
        await expect(decision.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await decision.getByRole("button", { name: "Проверить текст для пациента" }).click();
      await expect(
        page.getByText(/Следующий шаг подготовлен локально: Проверить текст для пациента/).first(),
      ).toBeVisible();

      const drilldown = page.getByRole("region", { name: "Проверка хранения и сроков" });
      await expect(drilldown).toBeVisible();
      await expect(drilldown.getByText("Что закрыть перед выдачей")).toBeVisible();
      for (const text of [
        "Правила хранения",
        "Срок доступа",
        "4 требуют правил",
        "4 без срока",
        "Разобрать правила хранения",
        "Блокировать окна без правил",
        "Закрыть окна без срока",
        "Проверить истекающие окна",
      ]) {
        await expect(drilldown.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await drilldown.getByRole("button", { name: "Закрыть окна без срока" }).click();
      await expect(page.getByText(/Учебный режим: окна без срока заблокированы локально/).first()).toBeVisible();

      const sessions = page.getByRole("region", { name: "Проверка файлов и сеансов" });
      await expect(sessions).toBeVisible();
      await expect(sessions.getByText("Как не раскрыть файлы и коды")).toBeVisible();
      for (const text of [
        "Защищённая выдача файлов",
        "Сеансы доступа",
        "2 требуют канала",
        "2 временных кода",
        "Проверить выдачу файлов",
        "Закрыть временные коды",
        "Подготовить новую выдачу",
        "Подготовить ключ входа",
      ]) {
        await expect(sessions.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await sessions.getByRole("button", { name: "Проверить выдачу файлов" }).click();
      await expect(page.getByText(/Проверка выдачи файлов подготовлена локально/).first()).toBeVisible();
      await sessions.getByRole("button", { name: "Закрыть временные коды" }).click();
      await expect(page.getByText(/Учебный режим: небезопасные временные коды заблокированы локально/).first()).toBeVisible();

      const safety = page.getByRole("region", { name: "Итоговая проверка безопасности данных" });
      await expect(safety).toBeVisible();
      await expect(safety.getByText("Что можно показать администратору")).toBeVisible();
      for (const text of [
        "Скрытые данные",
        "Имена пациентов скрыты",
        "Фото и файлы скрыты",
        "Ссылки и пути скрыты",
        "Коды входа скрыты",
        "Номера сеансов скрыты",
        "Врачебный текст скрыт",
        "Что ещё блокирует выдачу",
        "Итог для рабочего решения",
        "Выдача пациенту остаётся выключенной",
        "Проверить безопасность данных",
      ]) {
        await expect(safety.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await safety.getByRole("button", { name: "Проверить безопасность данных" }).click();
      await expect(page.getByText(/Проверка безопасности данных подготовлена локально/).first()).toBeVisible();

      const receipt = page.getByRole("region", { name: "Предварительный акт готовности к выдаче" });
      await expect(receipt).toBeVisible();
      await expect(receipt.getByText("Что зафиксировано перед решением")).toBeVisible();
      for (const text of [
        "Итог акта",
        "Закрыто проверок",
        "Открыто проверок",
        "Всего препятствий",
        "Следующий шаг",
        "Зафиксировать предварительный акт",
      ]) {
        await expect(receipt.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await receipt.getByRole("button", { name: "Зафиксировать предварительный акт" }).click();
      await expect(page.getByText(/Предварительный акт готовности зафиксирован локально/).first()).toBeVisible();

      const history = page.getByRole("region", { name: "История локальных проверок готовности" });
      await expect(history).toBeVisible();
      await expect(history.getByText("Что уже проверили на этом экране")).toBeVisible();
      for (const text of [
        "Решение о выдаче",
        "Хранение и сроки",
        "Файлы и сеансы",
        "Безопасность данных",
        "Предварительный акт",
        "Последняя локальная проверка",
        "Система не раскрывала",
        "Обновить историю проверки",
      ]) {
        await expect(history.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await history.getByRole("button", { name: "Обновить историю проверки" }).click();
      await expect(page.getByText(/История проверки обновлена локально/).first()).toBeVisible();

      const blockers = page.getByRole("region", { name: "Предзапусковые препятствия выдачи" });
      await expect(blockers).toBeVisible();
      await expect(blockers.getByText("Что ещё нельзя включать")).toBeVisible();
      for (const text of [
        "Первое действие",
        "Открытые проверки",
        "Всего препятствий",
        "Выдача пациенту",
        "Сформировать список препятствий",
      ]) {
        await expect(blockers.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await blockers.getByRole("button", { name: "Сформировать список препятствий" }).click();
      await expect(page.getByText(/Список предзапусковых препятствий подготовлен локально/).first()).toBeVisible();

      const decisionPackage = page.getByRole("region", { name: "Пакет решения клиники по выдаче" });
      await expect(decisionPackage).toBeVisible();
      await expect(decisionPackage.getByText("Что передать на рабочее решение")).toBeVisible();
      for (const text of [
        "Служебная сводка",
        "Ответственный клиники",
        "Данные для пациента",
        "Повторная проверка",
        "Итог перед решением",
        "Подготовить пакет решения",
      ]) {
        await expect(decisionPackage.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await decisionPackage.getByRole("button", { name: "Подготовить пакет решения" }).click();
      await expect(page.getByText(/Пакет решения клиники подготовлен локально/).first()).toBeVisible();

      const launchGate = page.getByRole("region", { name: "Запрет запуска без решения клиники" });
      await expect(launchGate).toBeVisible();
      await expect(launchGate.getByText("Решение клиники не принято")).toBeVisible();
      for (const text of [
        "Финальный стоп-гейт",
        "Запуск выдачи",
        "Итог перед запуском",
        "Решение клиники",
        "Публикация файлов",
        "Зафиксировать запрет запуска",
      ]) {
        await expect(launchGate.getByText(text, { exact: true }).first()).toBeVisible();
      }
      await expect(launchGate.getByText("запрещён", { exact: true }).first()).toBeVisible();

      await launchGate.getByRole("button", { name: "Зафиксировать запрет запуска" }).click();
      await expect(page.getByText(/Запрет запуска зафиксирован локально: решение клиники не принято/).first()).toBeVisible();

      const auditReceipt = page.getByRole("region", { name: "Итоговый акт запрета выдачи" });
      await expect(auditReceipt).toBeVisible();
      await expect(auditReceipt.getByText("Что останется в журнале проверки")).toBeVisible();
      for (const text of [
        "Итоговый журнал",
        "Статус выдачи",
        "Скрытые данные",
        "Последняя запись",
        "Запуск выдачи",
        "Пациентские строки",
        "Файлы и ссылки",
        "Коды входа",
        "Зафиксировать итоговый акт",
      ]) {
        await expect(auditReceipt.getByText(text, { exact: true }).first()).toBeVisible();
      }

      await auditReceipt.getByRole("button", { name: "Зафиксировать итоговый акт" }).click();
      await expect(page.getByText(/Итоговый акт запрета выдачи зафиксирован локально/).first()).toBeVisible();

      const visible = await page.locator("main").innerText();
      expect(visible).not.toMatch(FORBIDDEN_VISIBLE);
      expect(visible).toContain("Выдача пациенту остаётся выключенной");

      await expectNoHorizontalOverflow(page);
      if (viewport.name === "mobile-390") await expectMainTapTargets(page);

      await page.screenshot({
        path: `test-results/patient-delivery-gates-${viewport.name}.png`,
        fullPage: true,
      });

      const appErrors = consoleErrors.filter(
        (text) => !/postMessage|cross-origin|ResizeObserver|NO_COLOR|FORCE_COLOR/i.test(text),
      );
      expect(appErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  }
});
