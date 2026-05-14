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
      count: 9,
      expectedCount: 9,
      latest: "0009_stage4r_device_bridge_commands.sql",
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

    await page.goto("/sys/self-hosted-ops", { waitUntil: "networkidle" });

    await expect(page.getByRole("heading", { name: "Self-hosted ops" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Backend" })).toContainText("Готов");
    await expect(page.getByRole("region", { name: "Self-hosted dependencies" })).toContainText("postgres");
    await expect(page.getByRole("region", { name: "Self-hosted runtime checks" })).toContainText(
      "PostgreSQL connectivity",
    );
    await expect(page.getByRole("region", { name: "Self-hosted operations dry-runs" })).toContainText(
      "npm run ops:stage4l:backup:dry-run",
    );
    await expect(page.getByRole("region", { name: "Self-hosted observability contract" })).toContainText(
      "Structured JSON logs",
    );
    await expect(page.getByLabel("Предпросмотр audit export dry-run")).toContainText(
      "npm run ops:stage4n:audit-export:dry-run",
    );
    await expect(page.locator("body")).not.toContainText("secret");
    await expect(page.locator("body")).not.toContainText("Ivanova Natalia");
    await expect(page.locator("body")).not.toContainText("bucket/key");
    await expect(page.locator("body")).not.toContainText("storage_object_path");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать preview" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("stage4o-audit-export-preview.md");
    const path = await download.path();
    expect(path).not.toBeNull();
    const text = await readFile(path!, "utf8");
    expect(text).toContain("Stage 4O audit export preview");
    expect(text).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);

    const operationsDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "Скачать план" }).click();
    const operations = await operationsDownload;
    expect(operations.suggestedFilename()).toBe("stage4p-operations-preview.md");
    const operationsPath = await operations.path();
    expect(operationsPath).not.toBeNull();
    const operationsText = await readFile(operationsPath!, "utf8");
    expect(operationsText).toContain("Stage 4P operations preview");
    expect(operationsText).toContain("npm run smoke:stage4k:dry-run");
    expect(operationsText).not.toMatch(/access_token|storage_object_path|Bearer|password=/i);
  });

  test("clinic_admin demo role is blocked by route guard", async ({ page }) => {
    await setDemoRole(page, "clinic_admin");
    await page.goto("/sys/self-hosted-ops", { waitUntil: "networkidle" });

    await expect(page.getByText("Нет доступа в демо-режиме")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Self-hosted ops" })).not.toBeVisible();
  });
});
