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
      page.getByRole("heading", { name: "Релиз-статус" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Предпросмотр release status" }),
    ).toContainText("Main workflows: 6 из 6 success");
    await expect(
      page.getByText(/Доступ к разделу открыт только роли system_admin/),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Сравнение релизов" }),
    ).toContainText("Статус улучшился");
    await expect(
      page.getByText("npm run preflight:release-status"),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Импорт release history" }),
    ).toBeVisible();
    await expect(page.getByText("Предпросмотр истории")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей release history" }),
    ).toContainText("c3d2d18");

    await page.getByLabel("Вставить release-history JSONL").fill(
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
      .getByLabel("Пресет фильтров release history")
      .selectOption("builtin-e2e-failures");
    await expect(
      page.getByLabel("Фильтр workflow результата истории"),
    ).toHaveValue("failure");
    await expect(page.getByLabel("Поиск по release history")).toHaveValue(
      "e2e",
    );
    await expect(
      page.getByRole("status", { name: "Сводка фильтров release history" }),
    ).toContainText("5 из 6");
    await page.getByLabel("Название пресета release history").fill("E2E blockers");
    await page
      .getByRole("button", {
        name: "Сохранить текущие фильтры release history как пресет",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов release history" }),
    ).toContainText("Сохранено: 1/8");
    await expect(
      page.getByRole("region", {
        name: "Управление пресетами release history",
      }),
    ).toBeVisible();
    const presetJsonDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать пресеты release history в JSON",
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
        name: "Экспортировать пресеты release history в XLSX",
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
      .getByLabel("Импортировать пресеты release history JSON")
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
        name: "Предпросмотр импорта пресетов release history",
      }),
    ).toContainText("принято: 1");
    await expect(
      page.getByRole("status", {
        name: "Предпросмотр импорта пресетов release history",
      }),
    ).toContainText("Imported E2E safe preset");
    await expect(
      page.getByRole("status", {
        name: "План импорта пресетов release history",
      }),
    ).toContainText("Будет импортировано: 1");
    await page
      .getByRole("button", {
        name: "Импортировать пресеты release history",
      })
      .click();
    await expect(
      page.getByRole("option", { name: "Imported E2E safe preset" }),
    ).toBeAttached();
    await expect(
      page.getByRole("region", { name: "Аудит пресетов release history" }),
    ).toContainText("import");

    await page
      .getByRole("button", {
        name: "Очистить сохранённые пресеты release history",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов release history" }),
    ).toContainText("Сохранено: 0/8");
    await page
      .getByRole("button", {
        name: "Восстановить очищенные пресеты release history",
      })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка пресетов release history" }),
    ).toContainText("Сохранено: 2/8");

    const presetAuditDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Скачать аудит пресетов release history",
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
      .getByLabel("Импортировать пресеты release history JSON")
      .fill("{bad json");
    await expect(
      page.getByLabel("Импортировать пресеты release history JSON"),
    ).toHaveAttribute("aria-invalid", "true");
    await expect(
      page.getByRole("list", {
        name: "Подсказки исправления импорта пресетов release history",
      }),
    ).toContainText("Проверьте JSON");
    await page
      .getByRole("button", { name: "Фокус на JSON пресетов с ошибкой" })
      .click();
    await expect(
      page.getByLabel("Импортировать пресеты release history JSON"),
    ).toBeFocused();

    await page.reload({ waitUntil: "networkidle" });
    await expect(
      page.getByRole("option", { name: "E2E blockers" }),
    ).toBeAttached();
    await page.getByLabel("Вставить release-history JSONL").fill(
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
      .getByLabel("Пресет фильтров release history")
      .selectOption({ label: "E2E blockers" });
    await page.getByLabel("Фильтр статуса истории").selectOption("fail");
    await page.getByLabel("Фильтр deno-lock истории").selectOption("blocked");
    await page.getByLabel("Фильтр artifact истории").selectOption("missing");
    await page
      .getByLabel("Фильтр workflow результата истории")
      .selectOption("failure");
    await page.getByLabel("Поиск по release history").fill("e2e-smoke");
    await expect(
      page.getByRole("status", { name: "Сводка фильтров release history" }),
    ).toContainText("5 из 6");
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей release history" }),
    ).toContainText("aaaaaaaaaaa");
    const filteredJsonlDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать отфильтрованную release history в JSONL",
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
        name: "Экспортировать отфильтрованную release history в CSV",
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
        name: "Экспортировать отфильтрованную release history в XLSX",
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
      page.getByRole("region", { name: "Пагинация release history" }),
    ).toContainText("1-3 из 5");
    await page
      .getByRole("button", { name: "Следующая страница истории" })
      .click();
    await expect(
      page.getByRole("list", { name: "Предпросмотр записей release history" }),
    ).toContainText("ddddddddddd");
    await expect(
      page.getByRole("region", { name: "Пагинация release history" }),
    ).toContainText("4-5 из 5");
    await page
      .getByRole("button", { name: "Предыдущая страница истории" })
      .click();
    await page.getByLabel("Поиск по release history").fill("not-present-sha");
    await expect(
      page.getByText("По выбранным фильтрам history-записей нет."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованную release history в JSONL",
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованную release history в CSV",
      }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", {
        name: "Экспортировать отфильтрованную release history в XLSX",
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Сбросить фильтры release history" })
      .click();
    await expect(
      page.getByRole("status", { name: "Сводка фильтров release history" }),
    ).toContainText("6 из 6");
    await page.getByRole("button", { name: "Dry-run импорт" }).click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта release history",
        exact: true,
      }),
    ).toContainText("Dry-run импорт выполнен");
    await expect(
      page.getByRole("button", { name: "Удалить импортированные baseline" }),
    ).toBeDisabled();

    await page
      .getByRole("button", { name: "Импортировать history JSONL" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта release history",
        exact: true,
      }),
    ).toContainText("Импортировано 6 baseline-записей");
    await expect(
      page.getByRole("status", {
        name: "Privacy статус импорта release history",
        exact: true,
      }),
    ).toContainText("Privacy-проверка импорта пройдена");
    await page
      .getByLabel("Выбрать baseline release status")
      .selectOption("imported-aaaaaaaaaaa-0");
    await expect(
      page.getByRole("region", { name: "Сравнение релизов" }),
    ).toContainText("aaaaaaaaaaa");
    await expect(
      page.getByRole("region", { name: "Предпросмотр выбранного baseline" }),
    ).toContainText("aaaaaaaaaaa");
    await expect(
      page.getByRole("list", { name: "Workflow выбранного baseline" }),
    ).toContainText("e2e-smoke");
    await expect(
      page.getByRole("region", { name: "Аудит импортов release history" }),
    ).toContainText("Импорт обработан");

    const auditDownloadPromise = page.waitForEvent("download");
    await page
      .getByLabel("Фильтр статуса аудита импортов")
      .selectOption("safe");
    await expect(
      page.getByRole("status", { name: "Сводка фильтров аудита импортов" }),
    ).toContainText("1 из 5");
    await page.getByLabel("Поиск по аудиту импортов").fill("privacy");
    await expect(
      page.getByRole("region", { name: "Аудит импортов release history" }),
    ).toContainText("Импорт обработан");
    await page
      .getByRole("button", {
        name: "Скачать JSON отчет аудита импортов release history",
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
        name: "Скачать CSV отчет аудита импортов release history",
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
      .getByRole("button", { name: "Удалить импортированные baseline" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText("Импортированные baseline удалены");
    await expect(
      page.getByRole("region", { name: "Аудит импортов release history" }),
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
      page.getByRole("textbox", { name: "Предпросмотр файла release status" }),
    ).toHaveValue(/<!doctype html>/i);

    await page.getByRole("button", { name: "Проверить предпросмотр" }).click();
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText("Проверка приватности пройдена для HTML.");
    await page.getByText("Показать категории приватности").click();
    await expect(
      page.getByRole("list", { name: "Категории проверки приватности" }),
    ).toContainText("service role env");

    const bundleDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать единый пакет release status",
      })
      .click();
    await bundleDownloadPromise;
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText("Пакетный экспорт готов: 4 файла.");

    const htmlDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Экспортировать release status в HTML" })
      .click();
    const htmlDownload = await htmlDownloadPromise;
    expect(htmlDownload.suggestedFilename()).toMatch(
      /^release-status-\d{4}-\d{2}-\d{2}\.html$/,
    );
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText(/HTML экспорт готов/);

    const historyDownloadPromise = page.waitForEvent("download");
    await page
      .getByRole("button", {
        name: "Экспортировать release status в History JSONL",
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
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText(/preflight/);
    await expect(
      page
        .getByRole("region", { name: "Sync checker gate release status" })
        .getByText("npm run check:release-status-sync"),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Скопировать sync checker" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText(/sync checker/);
    await expect(
      page.getByRole("region", { name: "Sync checker gate release status" }),
    ).toContainText("npm run ci:release-status-sync");
    await expect(
      page.getByRole("status", { name: "CI gate status release status" }),
    ).toContainText(/Запись release-status отчётов.*заблокирована/);
    await expect(
      page.getByRole("region", { name: "Sync checker gate release status" }),
    ).toContainText("git status --short");
    await page
      .getByRole("button", { name: "Скопировать полный sync checker блок" })
      .click();
    await expect(
      page.getByRole("status", { name: "Статус релиз-дашборда" }),
    ).toContainText(/sync checker/i);

    await page
      .getByLabel("Вставить release-history JSONL")
      .fill("{bad json}\n");
    await expect(page.getByLabel("Вставить release-history JSONL")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expect(
      page.getByRole("status", {
        name: "Сводка ошибок импорта release history",
      }),
    ).toContainText("Первая ошибка: строка 1");
    await expect(
      page.getByRole("list", { name: "Ошибки формата release history" }),
    ).toContainText("строка 1: invalid JSON");
    await expect(
      page.getByRole("list", {
        name: "Подсказки исправления release history",
      }),
    ).toContainText("Проверьте синтаксис JSON");
    await page
      .getByRole("button", { name: "Фокус на JSONL с ошибкой" })
      .click();
    await expect(page.getByLabel("Вставить release-history JSONL")).toBeFocused();
    await page
      .getByRole("button", { name: "Импортировать history JSONL" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта release history",
        exact: true,
      }),
    ).toContainText("Импорт не содержит валидных baseline-записей");

    await page
      .getByLabel("Вставить release-history JSONL")
      .fill(
        'actor_email=doctor@example.com\n{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"e2e-smoke","conclusion":"success"}]}\n',
      );
    await page
      .getByRole("button", { name: "Импортировать history JSONL" })
      .click();
    await expect(
      page.getByRole("status", {
        name: "Статус импорта release history",
        exact: true,
      }),
    ).toContainText("Импорт заблокирован");
    await expect(
      page.getByRole("status", {
        name: "Privacy статус импорта release history",
        exact: true,
      }),
    ).toContainText("Privacy-проверка импорта: блокер");
    await expect(
      page.getByRole("region", { name: "Аудит импортов release history" }),
    ).toContainText("Импорт заблокирован");
  });

  test("clinic_admin is blocked by the demo RBAC guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(
      page.getByRole("heading", { name: "Релиз-статус" }),
    ).toBeHidden();
    await expect(page.getByText("Нет доступа в демо-режиме")).toBeVisible();
    await expect(
      page.getByText(/Текущая роль Администратор клиники/),
    ).toBeVisible();
  });
});
