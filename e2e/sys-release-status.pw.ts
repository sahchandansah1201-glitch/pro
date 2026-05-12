import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

function historyLine(currentSha: string, hour: string): string {
  return JSON.stringify({
    recordedAt: `2026-05-11T${hour}:00:00Z`,
    repo: "sahchandansah1201-glitch/pro",
    branch: "main",
    currentSha,
    overallStatus: "fail",
    dirtyCount: 2,
    denoLockOk: false,
    artifactPresent: false,
    workflows: [{ name: "e2e-smoke", conclusion: "failure" }],
  });
}

test.describe("/sys/release-status", () => {
  test("system_admin can preview, privacy-check, and export release status artifacts", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Релиз-статус" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Предпросмотр release status" })).toContainText(
      "Main workflows: 6 из 6 success",
    );
    await expect(page.getByText(/Доступ к разделу открыт только роли system_admin/)).toBeVisible();
    await expect(page.getByRole("region", { name: "Сравнение релизов" })).toContainText(
      "Статус улучшился",
    );
    await expect(page.getByText("npm run preflight:release-status")).toBeVisible();
    await expect(page.getByRole("region", { name: "Импорт release history" })).toBeVisible();
    await expect(page.getByText("Предпросмотр истории")).toBeVisible();
    await expect(page.getByRole("list", { name: "Предпросмотр записей release history" })).toContainText("c3d2d18");

    await page.getByLabel("Вставить release-history JSONL").fill(
      [
        historyLine("aaaaaaaaaaa", "10"),
        historyLine("bbbbbbbbbbb", "09"),
        historyLine("ccccccccccc", "08"),
        historyLine("ddddddddddd", "07"),
        historyLine("eeeeeeeeeee", "06"),
      ].join("\n"),
    );
    await page.getByLabel("Фильтр статуса истории").selectOption("fail");
    await page.getByLabel("Поиск по release history").fill("e2e-smoke");
    await expect(page.getByRole("list", { name: "Предпросмотр записей release history" })).toContainText(
      "aaaaaaaaaaa",
    );
    await expect(page.getByRole("region", { name: "Пагинация release history" })).toContainText("1-3 из 5");
    await page.getByRole("button", { name: "Следующая страница истории" }).click();
    await expect(page.getByRole("list", { name: "Предпросмотр записей release history" })).toContainText(
      "ddddddddddd",
    );
    await expect(page.getByRole("region", { name: "Пагинация release history" })).toContainText("4-5 из 5");
    await page.getByRole("button", { name: "Предыдущая страница истории" }).click();
    await page.getByRole("button", { name: "Dry-run импорт" }).click();
    await expect(page.getByRole("status", { name: "Статус импорта release history", exact: true })).toContainText(
      "Dry-run импорт выполнен",
    );
    await expect(page.getByRole("button", { name: "Удалить импортированные baseline" })).toBeDisabled();

    await page.getByRole("button", { name: "Импортировать history JSONL" }).click();
    await expect(page.getByRole("status", { name: "Статус импорта release history", exact: true })).toContainText(
      "Импортировано 5 baseline-записей",
    );
    await expect(page.getByRole("status", { name: "Privacy статус импорта release history", exact: true })).toContainText(
      "Privacy-проверка импорта пройдена",
    );
    await page.getByLabel("Выбрать baseline release status").selectOption("imported-aaaaaaaaaaa-0");
    await expect(page.getByRole("region", { name: "Сравнение релизов" })).toContainText("aaaaaaaaaaa");
    await expect(page.getByRole("region", { name: "Предпросмотр выбранного baseline" })).toContainText(
      "aaaaaaaaaaa",
    );
    await expect(page.getByRole("list", { name: "Workflow выбранного baseline" })).toContainText("e2e-smoke");
    await expect(page.getByRole("region", { name: "Аудит импортов release history" })).toContainText(
      "Импорт обработан",
    );

    const auditDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать отчет аудита импортов release history" }).click();
    const auditDownload = await auditDownloadPromise;
    expect(auditDownload.suggestedFilename()).toMatch(/^release-history-import-audit-\d{4}-\d{2}-\d{2}\.json$/);
    const auditPath = await auditDownload.path();
    expect(auditPath).not.toBeNull();
    const auditText = await readFile(auditPath!, "utf8");
    expect(auditText).toContain('"summary"');
    expect(auditText).toContain('"selectedBaselineSha": "aaaaaaaaaaa"');
    expect(auditText).toContain('"filteredHistoryCount": 5');
    expect(auditText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);

    await page.getByRole("button", { name: "Удалить импортированные baseline" }).click();
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      "Импортированные baseline удалены",
    );
    await expect(page.getByRole("region", { name: "Аудит импортов release history" })).toContainText(
      "Импорт удалён",
    );

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    expect(bodyText).not.toContain("access_token=");
    expect(bodyText).not.toContain("storage_object_path");
    expect(bodyText).not.toContain("SUPABASE_SERVICE_ROLE_KEY=");

    await page.getByLabel("Формат предпросмотра релиз-статуса").selectOption("html");
    await expect(page.getByRole("textbox", { name: "Предпросмотр файла release status" })).toHaveValue(
      /<!doctype html>/i,
    );

    await page.getByRole("button", { name: "Проверить предпросмотр" }).click();
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      "Проверка приватности пройдена для HTML.",
    );
    await page.getByText("Показать категории приватности").click();
    await expect(page.getByRole("list", { name: "Категории проверки приватности" })).toContainText(
      "service role env",
    );

    const bundleDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать единый пакет release status" }).click();
    await bundleDownloadPromise;
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      "Пакетный экспорт готов: 4 файла.",
    );

    const htmlDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать release status в HTML" }).click();
    const htmlDownload = await htmlDownloadPromise;
    expect(htmlDownload.suggestedFilename()).toMatch(/^release-status-\d{4}-\d{2}-\d{2}\.html$/);
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      /HTML экспорт готов/,
    );

    const historyDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Экспортировать release status в History JSONL" }).click();
    const historyDownload = await historyDownloadPromise;
    expect(historyDownload.suggestedFilename()).toMatch(/^release-history-\d{4}-\d{2}-\d{2}\.jsonl$/);
    await expect(page.getByRole("region", { name: "Журнал экспортов релиз-статуса" })).toContainText(
      /release-history-\d{4}-\d{2}-\d{2}\.jsonl/,
    );

    await page.getByRole("button", { name: "Подготовить локальный запуск" }).click();
    await expect(page.getByRole("status", { name: "Статус релиз-дашборда" })).toContainText(
      /preflight/,
    );

    await page.getByLabel("Вставить release-history JSONL").fill("{bad json}\n");
    await expect(page.getByRole("list", { name: "Ошибки формата release history" })).toContainText(
      "строка 1: invalid JSON",
    );
    await page.getByRole("button", { name: "Импортировать history JSONL" }).click();
    await expect(page.getByRole("status", { name: "Статус импорта release history", exact: true })).toContainText(
      "Импорт не содержит валидных baseline-записей",
    );

    await page.getByLabel("Вставить release-history JSONL").fill(
      'actor_email=doctor@example.com\n{"recordedAt":"2026-05-11T10:00:00Z","repo":"sahchandansah1201-glitch/pro","branch":"main","currentSha":"bbbbbbb","overallStatus":"ok","dirtyCount":0,"denoLockOk":true,"artifactPresent":true,"workflows":[{"name":"e2e-smoke","conclusion":"success"}]}\n',
    );
    await page.getByRole("button", { name: "Импортировать history JSONL" }).click();
    await expect(page.getByRole("status", { name: "Статус импорта release history", exact: true })).toContainText(
      "Импорт заблокирован",
    );
    await expect(page.getByRole("status", { name: "Privacy статус импорта release history", exact: true })).toContainText(
      "Privacy-проверка импорта: блокер",
    );
    await expect(page.getByRole("region", { name: "Аудит импортов release history" })).toContainText(
      "Импорт заблокирован",
    );
  });

  test("clinic_admin is blocked by the demo RBAC guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/release-status", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Релиз-статус" })).toBeHidden();
    await expect(page.getByText("Нет доступа в демо-режиме")).toBeVisible();
    await expect(page.getByText(/Текущая роль Администратор клиники/)).toBeVisible();
  });
});
