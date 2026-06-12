import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

function historyLine(
  currentSha: string,
  hour: string,
  options: {
    overallStatus?: "ok" | "incomplete" | "fail";
    workflowConclusion?: "success" | "failure" | "in_progress" | "unknown";
    denoLockOk?: boolean;
    artifactPresent?: boolean;
    workflowName?: string;
  } = {},
): string {
  const overallStatus = options.overallStatus ?? "fail";
  return JSON.stringify({
    recordedAt: `2026-05-11T${hour}:00:00Z`,
    repo: "sahchandansah1201-glitch/pro",
    branch: "main",
    currentSha,
    overallStatus,
    dirtyCount: overallStatus === "ok" ? 0 : 2,
    denoLockOk: options.denoLockOk ?? overallStatus !== "fail",
    artifactPresent: options.artifactPresent ?? overallStatus === "ok",
    workflows: [
      {
        name: options.workflowName ?? "e2e-smoke",
        conclusion: options.workflowConclusion ?? "failure",
      },
    ],
  });
}

test.describe("/sys/release-status", () => {
  test("system_admin can preview, privacy-check, and export release status artifacts", async ({
    page,
  }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { level: 1, name: "Готовность релиза" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Предпросмотр готовности релиза" }),
    ).toContainText("Проверки основной ветки: 9 из 9 пройдены");
    await expect(
      page.getByRole("region", { name: "Готовность релиза" }),
    ).toContainText("Готовность релиза");
    await expect(
      page.getByRole("status", { name: "Уведомление о готовности релиза" }),
    ).toContainText("Ссылку на отчёт можно публиковать");
    await expect(
      page.getByRole("status", { name: "Сводка проверок" }),
    ).toContainText("Проверки: 9 из 9 пройдены");
    await expect(
      page.getByRole("list", { name: "Проверки релиза" }),
    ).toContainText("Предварительная проверка");
    await expect(
      page.getByRole("link", {
        name: "Открыть опубликованный отчёт готовности релиза",
      }),
    ).toHaveAttribute("href", /#artifacts$/);
    await expect(
      page.getByText(/Доступ к разделу открыт только роли системного администратора/),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Сравнение релизов" }),
    ).toContainText("Статус улучшился");
    await expect(
      page.getByText("Команды скрыты с экрана"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Импорт журнала релиза" }),
    ).toBeVisible();
    await expect(page.getByText("Предпросмотр истории")).toBeVisible();
    await expect(page.getByText("c3d2d18")).toHaveCount(0);
    await expect(page.getByText("код версии скрыт").first()).toBeVisible();

    await page.getByLabel("Вставить журнал истории релиза").fill(
      [
        historyLine("aaaaaaaaaaa", "10"),
        historyLine("bbbbbbbbbbb", "09"),
        historyLine("ccccccccccc", "08"),
        historyLine("ddddddddddd", "07"),
        historyLine("eeeeeeeeeee", "06"),
        historyLine("fffffffffff", "05", {
          overallStatus: "ok",
          workflowConclusion: "success",
          denoLockOk: true,
          artifactPresent: true,
          workflowName: "release-status",
        }),
      ].join("\n"),
    );
    await page
      .getByLabel("Пресет фильтров журнала релиза")
      .selectOption("builtin-e2e-failures");
    await expect(
      page.getByLabel("Фильтр результата проверок истории"),
    ).toHaveValue("failure");
    await expect(page.getByLabel("Поиск по журналу релиза")).toHaveValue(
      "e2e",
    );
    await expect(
      page.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toContainText("5 из 6");
    await page.getByLabel("Название пресета журнала релиза").fill("E2E blockers");
    await page
      .getByRole("button", {
        name: "Сохранить текущие фильтры журнала релиза как пресет",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toContainText("Сохранено: 1/8");
    await expect(
      page.getByRole("region", {
        name: "Управление пресетами журнала релиза",
      }),
    ).toBeVisible();
    const presetJsonDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать пресеты журнала релиза в служебный файл",
      })
      .click();
    const presetJsonDownload = await presetJsonDownloadPromise;
    expect(presetJsonDownload.suggestedFilename()).toMatch(
      /^release-history-filter-presets-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const presetJsonPath = await presetJsonDownload.path();
    expect(presetJsonPath).not.toBeNull();
    const presetJsonText = await readFile(presetJsonPath!, "utf8");
    expect(presetJsonText).toContain("E2E blockers");
    expect(presetJsonText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    const presetXlsxDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать пресеты журнала релиза в книгу",
      })
      .click();
    const presetXlsxDownload = await presetXlsxDownloadPromise;
    expect(presetXlsxDownload.suggestedFilename()).toMatch(
      /^release-history-filter-presets-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    const presetXlsxPath = await presetXlsxDownload.path();
    expect(presetXlsxPath).not.toBeNull();
    const presetXlsxBytes = await readFile(presetXlsxPath!);
    expect(Array.from(presetXlsxBytes.subarray(0, 2))).toEqual([80, 75]);

    await page
      .getByLabel("Вставить пресеты журнала релиза")
      .fill(
        JSON.stringify({
          presets: [
            {
              id: "saved-imported-e2e-safe",
              name: "Imported E2E safe preset",
              source: "saved",
              createdAt: "2026-05-12T10:00:00Z",
              filters: {
                status: "ok",
                deno: "ok",
                artifact: "present",
                workflow: "success",
                query: "release-status",
              },
            },
          ],
        }),
      );
    await expect(
      page.getByRole("status", {
        name: "Предпросмотр импорта пресетов журнала релиза",
      }),
    ).toContainText("принято: 1");
    await expect(
      page.getByRole("status", {
        name: "Предпросмотр импорта пресетов журнала релиза",
      }),
    ).toContainText("Imported E2E safe preset");
    await expect(
      page.getByRole("status", {
        name: "План импорта пресетов журнала релиза",
      }),
    ).toContainText("Будет импортировано: 1");
    await page
      .getByRole("button", {
        name: "Импортировать пресеты журнала релиза",
      })
      .click();
    await expect(
      page.getByRole("option", { name: "Imported E2E safe preset" }),
    ).toBeAttached();
    await expect(
      page.getByRole("region", { name: "Аудит пресетов журнала релиза" }),
    ).toContainText("import");

    await page
      .getByRole("button", {
        name: "Очистить сохранённые пресеты журнала релиза",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toContainText("Сохранено: 0/8");
    await page
      .getByRole("button", {
        name: "Восстановить очищенные пресеты журнала релиза",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов журнала релиза" }),
    ).toContainText("Сохранено: 2/8");

    const presetAuditDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Скачать аудит пресетов журнала релиза",
      })
      .click();
    const presetAuditDownload = await presetAuditDownloadPromise;
    expect(presetAuditDownload.suggestedFilename()).toMatch(
      /^release-history-filter-presets-audit-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const presetAuditPath = await presetAuditDownload.path();
    expect(presetAuditPath).not.toBeNull();
    const presetAuditText = await readFile(presetAuditPath!, "utf8");
    expect(presetAuditText).toContain("Release history preset audit");
    expect(presetAuditText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    await page
      .getByLabel("Вставить пресеты журнала релиза")
      .fill("{bad json");
    await expect(
      page.getByLabel("Вставить пресеты журнала релиза"),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("list", {
        name: "Подсказки исправления импорта пресетов журнала релиза",
      }),
    ).toContainText("Проверьте данные");
    await page
      .getByRole("button", { name: "Фокус на пресетах с ошибкой" })
      .click();
    await expect(
      page.getByLabel("Вставить пресеты журнала релиза"),
    ).toBeFocused();

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("option", { name: "E2E blockers" }),
    ).toBeAttached();
    await page.getByLabel("Вставить журнал истории релиза").fill(
      [
        historyLine("aaaaaaaaaaa", "10"),
        historyLine("bbbbbbbbbbb", "09"),
        historyLine("ccccccccccc", "08"),
        historyLine("ddddddddddd", "07"),
        historyLine("eeeeeeeeeee", "06"),
        historyLine("fffffffffff", "05", {
          overallStatus: "ok",
          workflowConclusion: "success",
          denoLockOk: true,
          artifactPresent: true,
          workflowName: "release-status",
        }),
      ].join("\n"),
    );
    await page
      .getByLabel("Пресет фильтров журнала релиза")
      .selectOption({ label: "E2E blockers" });
    await page.getByLabel("Фильтр статуса истории").selectOption("fail");
    await page.getByLabel("Фильтр служебных файлов истории").selectOption("blocked");
    await page.getByLabel("Фильтр отчёта истории").selectOption("missing");
    await page
      .getByLabel("Фильтр результата проверок истории")
      .selectOption("failure");
    await page.getByLabel("Поиск по журналу релиза").fill("e2e-smoke");
    await expect(
      page.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toContainText("5 из 6");
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей журнала релиза" }),
    ).toContainText("код версии скрыт");
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей журнала релиза" }),
    ).not.toContainText("aaaaaaaaaaa");
    const filteredJsonlDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза",
        exact: true,
      })
      .click();
    const filteredJsonlDownload = await filteredJsonlDownloadPromise;
    expect(filteredJsonlDownload.suggestedFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.jsonl$/,
    );
    const filteredJsonlPath = await filteredJsonlDownload.path();
    expect(filteredJsonlPath).not.toBeNull();
    const filteredJsonlText = await readFile(filteredJsonlPath!, "utf8");
    expect(filteredJsonlText).toContain('"currentSha":"aaaaaaaaaaa"');
    expect(filteredJsonlText).not.toContain("fffffffffff");
    expect(filteredJsonlText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    const filteredCsvDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза таблицей",
      })
      .click();
    const filteredCsvDownload = await filteredCsvDownloadPromise;
    expect(filteredCsvDownload.suggestedFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const filteredCsvPath = await filteredCsvDownload.path();
    expect(filteredCsvPath).not.toBeNull();
    const filteredCsvText = await readFile(filteredCsvPath!, "utf8");
    expect(filteredCsvText).toContain('"summary","filteredCount","5"');
    expect(filteredCsvText).toContain('"summary","totalCount","6"');
    expect(filteredCsvText).toContain('"filter","workflow","failure"');
    expect(filteredCsvText).not.toContain("fffffffffff");
    expect(filteredCsvText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    const filteredXlsxDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза книгой",
      })
      .click();
    const filteredXlsxDownload = await filteredXlsxDownloadPromise;
    expect(filteredXlsxDownload.suggestedFilename()).toMatch(
      /^release-history-filtered-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    const filteredXlsxPath = await filteredXlsxDownload.path();
    expect(filteredXlsxPath).not.toBeNull();
    const filteredXlsxBytes = await readFile(filteredXlsxPath!);
    expect(Array.from(filteredXlsxBytes.subarray(0, 2))).toEqual([80, 75]);

    await expect(
      page.getByRole("region", { name: "Пагинация журнала релиза" }),
    ).toContainText("1-3 из 5");
    await page
      .getByRole("button", { name: "Следующая страница истории" })
      .click();
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей журнала релиза" }),
    ).toContainText("код версии скрыт");
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей журнала релиза" }),
    ).not.toContainText("ddddddddddd");
    await expect(
      page.getByRole("region", { name: "Пагинация журнала релиза" }),
    ).toContainText("4-5 из 5");
    await page
      .getByRole("button", { name: "Предыдущая страница истории" })
      .click();
    await page.getByLabel("Поиск по журналу релиза").fill("not-present-sha");
    await expect(
      page.getByText("По выбранным фильтрам history-записей нет."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза таблицей",
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованный журнал релиза книгой",
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Сбросить фильтры журнала релиза" })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка фильтров журнала релиза" }),
    ).toContainText("6 из 6");
    await page.getByRole("button", { name: "Проверить импорт" }).click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Проверка импорта выполнена");
    await expect(
      page.getByRole("button", { name: "Удалить импортированные эталоны" }),
    ).toBeDisabled();

    await page
      .getByRole("button", { name: "Импортировать журнал" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Импортировано 6 эталонных записей");
    await expect(
      page.getByRole("status", {
        name: "Статус проверки данных импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Проверка данных импорта пройдена");
    await page
      .getByLabel("Выбрать эталон готовности релиза")
      .selectOption("imported-aaaaaaaaaaa-0");
    await expect(
      page.getByRole("region", { name: "Сравнение релизов" }),
    ).toContainText("код версии скрыт");
    await expect(
      page.getByRole("region", { name: "Сравнение релизов" }),
    ).not.toContainText("aaaaaaaaaaa");
    await expect(
      page.getByRole("region", { name: "Предпросмотр выбранного эталона" }),
    ).toContainText("код скрыт");
    await expect(
      page.getByRole("list", { name: "Проверки выбранного эталона" }),
    ).toContainText("Быстрая проверка интерфейса");
    await expect(
      page.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toContainText("Импорт обработан");

    const auditDownloadPromise = page.waitForEvent("download");
    await page
      .getByLabel("Фильтр статуса аудита импортов")
      .selectOption("safe");
    await expect(
      page.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toContainText("1 из 5");
    await page.getByLabel("Поиск по аудиту импортов").fill("Импорт");
    await expect(
      page.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toContainText("Импорт обработан");
    await page
      .getByRole("button", {
        name: "Скачать служебный отчёт аудита импортов журнала релиза",
      })
      .click();
    const auditDownload = await auditDownloadPromise;
    expect(auditDownload.suggestedFilename()).toMatch(
      /^release-history-import-audit-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const auditPath = await auditDownload.path();
    expect(auditPath).not.toBeNull();
    const auditText = await readFile(auditPath!, "utf8");
    expect(auditText).toContain('"summary"');
    expect(auditText).toContain('"selectedBaselineSha": "aaaaaaaaaaa"');
    expect(auditText).toContain('"filteredHistoryCount": 6');
    expect(auditText).toContain('"visibleAuditCount": 1');
    expect(auditText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    const auditCsvDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Скачать табличный отчёт аудита импортов журнала релиза",
      })
      .click();
    const auditCsvDownload = await auditCsvDownloadPromise;
    expect(auditCsvDownload.suggestedFilename()).toMatch(
      /^release-history-import-audit-\d{4}-\d{2}-\d{2}\.csv$/,
    );
    const auditCsvPath = await auditCsvDownload.path();
    expect(auditCsvPath).not.toBeNull();
    const auditCsvText = await readFile(auditCsvPath!, "utf8");
    expect(auditCsvText).toContain('"summary","visibleAuditCount","1"');
    expect(auditCsvText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    await page
      .getByRole("button", { name: "Сбросить фильтры аудита импортов" })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toContainText("7 из 7");

    await page
      .getByRole("button", { name: "Удалить импортированные эталоны" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText("Импортированные эталоны удалены");
    await expect(
      page.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toContainText("Импорт удалён");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("access_token=");
    expect(bodyText).not.toContain("storage_object_path");
    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");

    await page
      .getByLabel("Формат предпросмотра релиз-статуса")
      .selectOption("html");
    await expect(
      page.getByRole("textbox", { name: "Предпросмотр файла готовности релиза" }),
    ).toHaveValue(/Готовность релиза: Готово/);

    await page.getByRole("button", { name: "Проверить предпросмотр" }).click();
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText("Проверка приватности пройдена для Веб-страница.");
    await page.getByText("Показать категории приватности").click();
    await expect(
      page.getByRole("list", { name: "Категории проверки приватности" }),
    ).toContainText("Служебная переменная");

    const bundleDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать единый пакет готовности релиза",
      })
      .click();
    await bundleDownloadPromise;
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText("Пакетный экспорт готов: 4 файла.");

    const htmlDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать готовность релиза: Веб-страница",
      })
      .click();
    const htmlDownload = await htmlDownloadPromise;
    expect(htmlDownload.suggestedFilename()).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.html$/,
    );
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText(/Веб-страница готова/);

    const historyDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать готовность релиза: Журнал истории",
      })
      .click();
    const historyDownload = await historyDownloadPromise;
    expect(historyDownload.suggestedFilename()).toMatch(
      /^release-history-\d{4}-\d{2}-\d{2}\.jsonl$/,
    );
    await expect(
      page.getByRole("region", { name: "Журнал экспортов релиз-статуса" }),
    ).toContainText(/release-history-\d{4}-\d{2}-\d{2}\.jsonl/);

    await page
      .getByRole("button", { name: "Подготовить локальный запуск" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText(/Команд[ау] предварительной проверки/);
    await expect(
      page
        .getByRole("region", { name: "Сверка синхронизации релиза" })
        .getByText("Сверка синхронизации", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Скопировать сверку" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText(/Команд[ау] сверки синхронизации/);
    await expect(
      page.getByRole("region", { name: "Сверка синхронизации релиза" }),
    ).toContainText("Запись отчётов разрешается только после успешных проверок");
    await expect(
      page.getByRole("status", { name: "Статус сверки записи отчётов" }),
    ).toContainText("Проверка записи включена");
    await expect(
      page.getByRole("region", { name: "Проверка записи отчётов релиза" }),
    ).toContainText("Запись отчётов разрешена");
    await expect(
      page.getByRole("status", { name: "Статус проверки записи отчётов" }),
    ).toContainText(/Запись отчётов разрешена/);
    await page
      .getByLabel("Сценарий проверки записи отчётов")
      .selectOption("fail");
    await expect(
      page.getByRole("status", { name: "Статус проверки записи отчётов" }),
    ).toContainText(/Запись отчётов заблокирована/);
    await expect(
      page.getByRole("alert", {
        name: "Уведомление о блокере релиза",
      }),
    ).toContainText(/Отчёты не записываются/);
    await expect(
      page.getByRole("list", { name: "Проверки записи отчётов" }),
    ).toContainText("Условие успешной проверки");
    await expect(
      page.getByRole("region", { name: "Сверка синхронизации релиза" }),
    ).toContainText("Сверка запускает проверки синхронизации");
    await page
      .getByRole("button", { name: "Скопировать полный блок сверки" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус готовности релиза" }),
    ).toContainText(/блок сверки|Команду сверки/);

    await page
      .getByLabel("Вставить журнал истории релиза")
      .fill("{bad json}\n");
    await expect(page.getByLabel("Вставить журнал истории релиза")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByRole("status", {
        name: "Сводка ошибок импорта журнала релиза",
      }),
    ).toContainText("Первая ошибка: строка 1");
    await expect(
      page.getByRole("list", { name: "Ошибки формата журнала релиза" }),
    ).toContainText("строка 1: данные некорректны");
    await expect(
      page.getByRole("list", {
        name: "Подсказки исправления журнала релиза",
      }),
    ).toContainText("Проверьте структуру данных");
    await page
      .getByRole("button", { name: "Фокус на журнале с ошибкой" })
      .click();
    await expect(page.getByLabel("Вставить журнал истории релиза")).toBeFocused();
    await page
      .getByRole("button", { name: "Импортировать журнал" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Импорт не содержит валидных эталонных записей");

    await page
      .getByLabel("Вставить журнал истории релиза")
      .fill(
        'actor_email=doctor@example.com\n{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"e2e-smoke","conclusion":"success"}]}\n',
      );
    await page
      .getByRole("button", { name: "Импортировать журнал" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Импорт заблокирован");
    await expect(
      page.getByRole("status", {
        name: "Статус проверки данных импорта журнала релиза",
        exact: true,
      }),
    ).toContainText("Проверка данных импорта: блокер");
    await expect(
      page.getByRole("region", { name: "Аудит импортов журнала релиза" }),
    ).toContainText("Импорт заблокирован");
  });

  test("write-gate drill blocks report writes in failed scenario", async ({
    page,
  }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    const drill = page.getByRole("region", {
      name: "Проверка записи отчётов релиза",
    });
    const status = page.getByRole("status", {
      name: "Статус проверки записи отчётов",
    });
    const checks = page.getByRole("list", {
      name: "Проверки записи отчётов",
    });

    await expect(drill).toContainText("Запись отчётов разрешена");
    await page.getByLabel("Сценарий проверки записи отчётов").selectOption("fail");

    await expect(status).toContainText(/Запись отчётов заблокирована/);
    await expect(
      page.getByRole("alert", {
        name: "Уведомление о блокере релиза",
      }),
    ).toContainText(/Отчёты не записываются/);
    await expect(status).not.toContainText(/Запись отчётов разрешена/);
    await expect(checks).toContainText("✗ Условие успешной проверки");
    await expect(checks).toContainText("✗ Проверка релиза");
    await expect(checks).toContainText("✗ Сверка синхронизации");
    await expect(checks).toContainText("✗ Проверка лишних служебных файлов");
    await expect(checks).toContainText(
      "Запись отчётов может запуститься без успешной проверки.",
    );
    await expect(checks).toContainText("Проверка релиза не готова: failure.");
    await expect(checks).toContainText(
      "Сверка синхронизации не прошла до генерации отчёта.",
    );
    await expect(checks).toContainText("Найден лишний служебный файл.");

    await page.getByLabel("Сценарий проверки записи отчётов").selectOption("pass");

    await expect(status).toContainText(/Запись отчётов разрешена/);
    await expect(status).not.toContainText(/Запись отчётов заблокирована/);
    await expect(checks).toContainText("✓ Условие успешной проверки");
    await expect(checks).toContainText("✓ Проверка релиза");
    await expect(checks).toContainText("✓ Сверка синхронизации");
    await expect(checks).toContainText("✓ Проверка лишних служебных файлов");
  });

  test("clinic_admin is blocked by the demo RBAC guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { level: 1, name: "Готовность релиза" }),
    ).toBeHidden();
    await expect(page.getByText("Нет доступа в учебном режиме")).toBeVisible();
    await expect(
      page.getByText(/Текущая роль Администратор клиники/),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/self-hosted|production|backend|демо/i);
  });
});
