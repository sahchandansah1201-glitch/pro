import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

const OPS_STATUS = {
  stage: "4N",
  source: "self-hosted",
  ready: true,
  status: "ready",
  dependencies: [
    { name: "postgres", configured: true, connected: true, status: "connected" },
    { name: "jwt-signing-key", configured: true, connected: false, status: "configured" },
    { name: "object-storage", configured: true, connected: false, status: "configured" },
  ],
  observability: {
    structuredJsonLogs: true,
    correlationHeader: "x-correlation-id",
    redaction: "enabled",
    requestPathLogging: "path-only",
  },
  audit: {
    mode: "append-only",
    safeExport: "scripts/stage4n-audit-export.mjs --dry-run",
    exportedFields: ["created_at", "action", "entity_type", "entity_id", "correlation_id"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e",
};

const RUNTIME_CHECKS = {
  stage: "4P",
  source: "self-hosted",
  ready: true,
  status: "ready",
  checks: [
    {
      key: "postgres_connectivity",
      label: "PostgreSQL connectivity",
      status: "ready",
      detail: "PostgreSQL connection verified",
      connected: true,
    },
    {
      key: "migration_bundle",
      label: "Migration bundle",
      status: "ready",
      detail: "Self-hosted PostgreSQL migration bundle is present",
      count: 10,
      expectedCount: 10,
      latest: "0010_stage4s_device_bridge_worker_contract.sql",
    },
  ],
  commands: [
    {
      key: "backup_dry_run",
      label: "Backup dry-run",
      command: "npm run ops:stage4l:backup:dry-run",
      description: "Plan backup",
      status: "ready",
      dryRunOnly: true,
    },
    {
      key: "deploy_smoke_dry_run",
      label: "Deploy smoke dry-run",
      command: "npm run smoke:stage4k:dry-run",
      description: "Plan smoke",
      status: "ready",
      dryRunOnly: true,
    },
  ],
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e-runtime",
};

const PRODUCT_READINESS = {
  stage: "4Z",
  source: "self-hosted",
  status: "ready_for_server_deploy",
  productBoundary: {
    deployment: "single self-hosted product",
    frontend: "static React build served by nginx",
    backend: "Node self-hosted API",
    database: "operator-owned PostgreSQL",
    objectStorage: "operator-owned object storage",
    managedRuntime: "none",
    managedDatabase: "none",
    supabaseRuntimeCoupling: false,
    browserHardwareApis: false,
  },
  capabilities: [
    { key: "frontend", label: "React frontend", status: "ready", evidence: ["dist build"] },
    { key: "device_bridge", label: "Device Bridge worker operations", status: "ready", evidence: ["audit export"] },
  ],
  gates: [
    { key: "full_preflight", label: "Full deterministic preflight", command: "npm run preflight:all", required: true },
    { key: "compose_smoke", label: "Self-hosted compose smoke", command: "npm run smoke:stage4k", required: true },
  ],
  openapi: ["/openapi.stage4y.json", "/openapi.stage4z.json"],
  privacy: {
    redaction: "enabled",
    exportedData: "metadata-only operational readiness",
    excluded: ["tokens", "passwords", "patient names", "storage paths"],
  },
  auth: { userId: "u-1", roles: ["system_admin"] },
  generatedAt: "2026-05-14T00:00:00.000Z",
  correlationId: "corr-e2e-product",
};

test.describe("/sys/self-hosted-ops", () => {
  test("system_admin sees ops status and safe audit export preview", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.addInitScript(() => {
      localStorage.setItem("derma-pro:self-hosted-api-base-url", "http://localhost:8080");
      localStorage.setItem("derma-pro:self-hosted-api-token", "jwt-e2e");
      localStorage.setItem(
        "derma-pro:self-hosted-api-user",
        JSON.stringify({ id: "u-1", displayName: "System Admin", roles: ["system_admin"] }),
      );
    });
    await page.route("http://localhost:8080/api/v1/ops/status", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...OPS_STATUS,
          access_token: "secret",
          patient_full_name: "Ivanova Natalia",
          storage_object_path: "bucket/key",
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/ops/runtime-checks", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...RUNTIME_CHECKS,
          access_token: "secret",
          patient_full_name: "Ivanova Natalia",
          storage_object_path: "bucket/key",
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/product/readiness", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ...PRODUCT_READINESS,
          access_token: "secret",
          patient_full_name: "Ivanova Natalia",
          storage_object_path: "bucket/key",
        }),
      });
    });

    await page.goto("/sys/self-hosted-ops", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Рабочий контур" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Сводка рабочего контура" })).toContainText("Готов");
    await expect(page.getByRole("region", { name: "Зависимости рабочего контура" })).toContainText("PostgreSQL");
    await expect(page.getByRole("region", { name: "Проверки рабочей среды" })).toContainText("Связь с PostgreSQL");
    await expect(page.getByRole("region", { name: "Планы операций" })).toContainText("План резервной копии");
    await expect(page.getByRole("region", { name: "Планы операций" })).toContainText(
      "Служебная команда скрыта с экрана.",
    );
    await expect(page.getByRole("region", { name: "Договор наблюдаемости" })).toContainText(
      "Структурированные журналы",
    );
    const productReadinessRegion = page.locator('section[aria-label="Готовность продукта"]').filter({
      has: page.getByRole("heading", { name: "Готовность продукта" }),
    });
    await expect(productReadinessRegion).toContainText("Полная предварительная проверка");
    await expect(productReadinessRegion).toContainText("Управляемая среда");
    await expect(page.getByLabel("Предпросмотр экспорта аудита")).toContainText(
      "команда скрыта с экрана администратора",
    );
    await expect(page.locator("body")).not.toContainText("secret");
    await expect(page.locator("body")).not.toContainText("Ivanova Natalia");
    await expect(page.locator("body")).not.toContainText("bucket/key");
    await expect(page.locator("body")).not.toContainText("storage_object_path");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Скачать предпросмотр" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("stage4o-audit-export-preview.md");
    const path = await download.path();
    expect(path).not.toBeNull();
    const text = await readFile(path!, "utf8");
    expect(text).toContain("Предпросмотр экспорта аудита");
    expect(text).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);

    const [operations] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Скачать план" }).click(),
    ]);
    expect(operations.suggestedFilename()).toBe("stage4p-operations-preview.md");
    const operationsPath = await operations.path();
    expect(operationsPath).not.toBeNull();
    const operationsText = await readFile(operationsPath!, "utf8");
    expect(operationsText).toContain("Предпросмотр операционного плана");
    expect(operationsText).toContain("Проверка развёртывания");
    expect(operationsText).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);

    const [readiness] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Скачать готовность" }).click(),
    ]);
    expect(readiness.suggestedFilename()).toBe("stage4z-product-readiness-preview.md");
    const readinessPath = await readiness.path();
    expect(readinessPath).not.toBeNull();
    const readinessText = await readFile(readinessPath!, "utf8");
    expect(readinessText).toContain("Предпросмотр готовности продукта");
    expect(readinessText).toContain("Полная предварительная проверка");
    expect(readinessText).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);
  });

  test("clinic_admin demo role is blocked by route guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/self-hosted-ops", { waitUntil: "networkidle" });

    await expect(page.getByText("Нет доступа в учебном режиме")).toBeVisible();
    await expect(page.getByText(/учебный просмотр интерфейса/)).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/self-hosted|production|backend|демо/i);
    await expect(page.getByRole("heading", { name: "Рабочий контур" })).not.toBeVisible();
  });
});
