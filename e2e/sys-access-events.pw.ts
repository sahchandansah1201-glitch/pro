import { test, expect } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("/sys/access-events", () => {
  test("system_admin can view and export safe access events", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "События доступа" })).toBeVisible();
    await expect(page.getByText(/RPC list_access_events_admin/)).toHaveCount(0);
    const table = page.locator("tbody");
    await expect(table.getByText("Отчёт открыт по ссылке").first()).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("Иванова Наталья");
    expect(bodyText).not.toContain("access_token");
    expect(bodyText).not.toContain("storage_object_path");
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 12 событий/,
    );

    await page.getByLabel("Размер страницы событий").selectOption("5");
    await expect(page.getByText("1–5 из 12 событий")).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 12 событий/,
    );
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Диапазон: все страницы/,
    );
    await page.getByLabel("Диапазон экспорта событий").selectOption("current_page");
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 5 событий/,
    );
    await page.getByLabel("Диапазон экспорта событий").selectOption("custom_range");
    await page.getByLabel("Начало пользовательского диапазона экспорта").fill("2");
    await page.getByLabel("Конец пользовательского диапазона экспорта").fill("4");
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 3 событий/,
    );
    await page.getByLabel("Диапазон экспорта событий").selectOption("all_pages");
    await page.getByRole("button", { name: "Выбрать основные колонки экспорта" }).click();
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Колонки: 6/,
    );
    await page.getByRole("button", { name: "Выбрать все колонки экспорта" }).click();
    await page.getByRole("button", { name: "Последняя страница" }).click();
    await expect(page.getByText("11–12 из 12 событий")).toBeVisible();
    await page.getByRole("button", { name: "Первая страница" }).click();
    await expect(page.getByText("1–5 из 12 событий")).toBeVisible();

    await page.getByLabel("Клиника события").selectOption("Дерма-Про · Центр");
    await page.getByLabel("Актор события").selectOption("Врач");
    await page.getByLabel("Действие события").selectOption("report.generate");
    await page.getByLabel("Код пациента события").fill("DP-2026-0001");
    await expect(table.getByText("Отчёт сформирован").first()).toBeVisible();
    await expect(table.getByText("Отчёт открыт по ссылке")).toHaveCount(0);

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("Действие события")).toHaveValue("report.generate");
    await expect(page.getByLabel("Код пациента события")).toHaveValue("DP-2026-0001");
    await expect(page.getByLabel("Размер страницы событий")).toHaveValue("5");

    await page.getByRole("button", { name: "Сбросить фильтры событий доступа" }).click();
    await expect(page.getByText("Фильтры сброшены.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 12 событий/,
    );

    await page.getByRole("button", { name: "Показать события за март 2026" }).click();
    await expect(page.getByLabel("Дата события с")).toHaveValue("2026-03-01");
    await expect(page.getByLabel("Дата события по")).toHaveValue("2026-03-31");
    await expect(page.getByText("Пресет даты применён: март 2026.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 11 событий/,
    );
    await page.getByRole("button", { name: "Сбросить фильтр даты событий" }).click();
    await expect(page.getByLabel("Дата события с")).toHaveValue("");
    await expect(page.getByLabel("Дата события по")).toHaveValue("");
    await expect(page.getByText("Фильтр даты сброшен.")).toBeVisible();

    await page.getByRole("button", { name: "Обновить события доступа вручную" }).click();
    await expect(page.getByText("Ручное обновление запрошено.")).toBeVisible();

    await page.getByLabel("Автообновление событий доступа").check();
    await expect(page.getByText(/Автообновление включено: каждые 60 секунд/i)).toBeVisible();

    await page.getByLabel("Тип сущности").selectOption("device");
    await expect(table.getByText("Устройство зарегистрировано").first()).toBeVisible();
    await expect(table.getByText("Отчёт открыт по ссылке")).toHaveCount(0);

    await expect(page.getByText("1–1 из 1 событий")).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр экспорта событий доступа" })).toContainText(
      /Будет экспортировано 1 событий/,
    );
    await expect(page.getByRole("region", { name: "Журнал запросов событий доступа" })).toContainText(
      /Учебный журнал: локальные события загружены/,
    );

    await page.getByRole("button", { name: /Подробнее о событии al-009/i }).first().click();
    await expect(page.getByRole("heading", { name: "Детали события" })).toBeVisible();
    await expect(page.getByText("al-009")).toHaveCount(0);
    await expect(page.getByRole("dialog")).toContainText("Код события");
    await expect(page.getByRole("dialog")).toContainText("скрыт");
    const drawerText = await page.locator('[role="dialog"]').innerText();
    expect(drawerText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(drawerText).not.toContain("Иванова Наталья");
    expect(drawerText).not.toContain("access_token");
    expect(drawerText).not.toContain("storage_object_path");
    await page.getByRole("button", { name: "Закрыть" }).click();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать события доступа таблицей" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-all-all-pages-1-rows-11-cols\.csv$/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Табличный файл готов:/,
    );
    await expect(page.getByRole("progressbar", { name: "Прогресс выгрузки: Табличный файл" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Табличный файл готов: 1 строк/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Файл: access-events-\d{4}-\d{2}-\d{2}-all-all-pages-1-rows-11-cols\.csv/,
    );

    const repeatDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /^Повторить выгрузку: табличный файл/i }).click();
    const repeatDownload = await repeatDownloadPromise;
    expect(repeatDownload.suggestedFilename()).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-all-all-pages-1-rows-11-cols-repeat\.csv$/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Повторная выгрузка готова:/,
    );

    const xlsxDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать события доступа книгой" }).click();
    const xlsxDownload = await xlsxDownloadPromise;
    expect(xlsxDownload.suggestedFilename()).toMatch(
      /^access-events-\d{4}-\d{2}-\d{2}-all-all-pages-1-rows-11-cols\.xlsx$/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Книга готова:/,
    );
    await expect(page.getByRole("progressbar", { name: "Прогресс выгрузки: Книга" })).toHaveAttribute(
      "aria-valuenow",
      "100",
    );
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Книга готова: 1 строк/,
    );
    await page.getByLabel("Фильтр журнала экспортов").selectOption("xlsx");
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Книга готова: 1 строк/,
    );
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).not.toContainText(
      /Табличный файл готов: 1 строк/,
    );
    await page.getByLabel("Фильтр журнала экспортов").selectOption("repeated");
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Повторная выгрузка готова/,
    );

    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByLabel("Фильтр журнала экспортов")).toHaveValue("repeated");
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Повторная выгрузка готова/,
    );

    await page.getByLabel("Поиск по журналу экспортов").fill("csv");
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /Табличный файл: 1 строк/,
    );
    await page.getByLabel("Поиск по журналу экспортов").fill("");

    const logDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать журнал экспортов таблицей" }).click();
    const logDownload = await logDownloadPromise;
    expect(logDownload.suggestedFilename()).toMatch(
      /^access-events-export-log-\d{4}-\d{2}-\d{2}-repeated-\d+-rows\.csv$/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Журнал экспортов выгружен таблицей/,
    );

    const logXlsxDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать журнал экспортов книгой" }).click();
    const logXlsxDownload = await logXlsxDownloadPromise;
    expect(logXlsxDownload.suggestedFilename()).toMatch(
      /^access-events-export-log-\d{4}-\d{2}-\d{2}-repeated-\d+-rows\.xlsx$/,
    );
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Журнал экспортов выгружен книгой/,
    );

    await page.getByRole("button", { name: "Очистить журнал экспортов" }).click();
    await expect(page.getByRole("status", { name: "Статус экспорта событий доступа" })).toContainText(
      /Подтвердите очистку журнала экспортов/,
    );
    await page.getByRole("button", { name: "Подтвердить очистку журнала экспортов" }).click();
    await expect(page.getByRole("region", { name: "Журнал экспортов событий доступа" })).toContainText(
      /По выбранному фильтру экспортов нет\.|Экспортов пока нет\./,
    );
    const emptyStatus = page
      .getByRole("region", { name: "Журнал экспортов событий доступа" })
      .getByRole("status");
    await expect(emptyStatus).toBeVisible();
  });

  test("clinic_admin cannot view access events", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/access-events", { waitUntil: "networkidle" });

    await expect(page.getByText(/Нет доступа в учебном режиме/)).toBeVisible();
    await expect(page.getByText(/учебный просмотр интерфейса/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/self-hosted|production|backend|демо/i);
    await expect(page.getByRole("button", { name: "Скачать события доступа таблицей" })).toHaveCount(0);
    await expect(page.getByText("Отчёт открыт по ссылке")).toHaveCount(0);
  });
});
