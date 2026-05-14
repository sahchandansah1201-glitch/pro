import { expect, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("Stage 4Q/4R · /sys/devices self-hosted registry and commands", () => {
  test("system_admin sees live Device Bridge registry without browser hardware APIs", async ({ page }) => {
    await setDemoRole(page, "system_admin");
    await page.addInitScript(() => {
      localStorage.setItem("derma-pro:self-hosted-api-base-url", "http://localhost:8080");
      localStorage.setItem("derma-pro:self-hosted-api-token", "jwt-device-e2e");
      localStorage.setItem(
        "derma-pro:self-hosted-api-user",
        JSON.stringify({ id: "u-sys", displayName: "System Admin", roles: ["system_admin"] }),
      );
    });
    await page.route("http://localhost:8080/api/v1/device-bridges", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4Q",
          source: "postgres",
          items: [
            {
              id: "br-uuid",
              bridgeCode: "br-live-01",
              hostName: "live-bridge",
              lanStatus: "online",
              version: "1.2.3",
              pairedCount: 1,
              lastHeartbeatAt: "2026-05-14T08:00:00Z",
              access_token: "secret",
              storage_object_path: "hidden",
            },
          ],
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/devices?limit=200&offset=0", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4Q",
          source: "postgres",
          items: [
            {
              id: "dev-uuid",
              model: "LiveScope 20",
              serial: "LS-200",
              firmware: "4.0.0",
              magnification: "x20",
              polarization: "both",
              calibrationProfile: "LS-live",
              calibrationDueAt: "2026-05-10",
              status: "connected",
              lastSeenAt: "2026-05-14T08:01:00Z",
              bridgeId: "br-uuid",
              bridge: { id: "br-uuid", code: "br-live-01", hostName: "live-bridge", lanStatus: "online" },
              access_token: "secret",
              storage_object_path: "hidden",
            },
          ],
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/status?limit=25", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4U",
          source: "postgres",
          summary: {
            bridgeCount: 1,
            onlineWorkers: 1,
            degradedWorkers: 0,
            offlineWorkers: 0,
            queuedCommands: 1,
            failedCommands: 1,
          },
          items: [
            {
              id: "br-uuid",
              clinicId: "clinic-1",
              bridgeCode: "br-live-01",
              hostName: "live-bridge",
              lanStatus: "online",
              workerStatus: "online",
              workerVersion: "stage4t-local-worker",
              workerLastSeenAt: "2026-05-14T08:02:00Z",
              queuedCount: 1,
              failedCount: 1,
              access_token: "secret",
              storage_object_path: "hidden",
            },
          ],
          commands: [
            {
              id: "cmd-worker-e2e",
              bridgeCode: "br-live-01",
              commandType: "bridge_health_check",
              status: "failed",
              createdAt: "2026-05-14T08:01:00Z",
              payload_json: { secret: true },
              result_json: { token: "hidden" },
            },
          ],
          filters: { workerStatus: "all", commandStatus: "all", limit: 25 },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/hardening?limit=25&staleAfterMinutes=10&retentionDays=30", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4V",
          source: "postgres",
          summary: {
            staleWorkers: 1,
            retryingCommands: 2,
            rateLimitedCommands: 1,
            maxQueueAgeSeconds: 180,
            cleanupCandidates: 3,
          },
          policy: { staleAfterMinutes: 10, retentionDays: 30, pollBackoff: "linear-capped", maxPollLimit: 50 },
          items: [
            {
              id: "br-uuid",
              clinicId: "clinic-1",
              bridgeCode: "br-live-01",
              hostName: "live-bridge",
              workerStatus: "degraded",
              workerVersion: "stage4t-local-worker",
              workerLastSeenAt: "2026-05-14T07:42:00Z",
              stale: true,
              activeCommandCount: 3,
              retryingCommandCount: 2,
              rateLimitedCommandCount: 1,
              maxQueueAgeSeconds: 180,
              payload_json: { secret: true },
              result_json: { token: "hidden" },
            },
          ],
          filters: { staleAfterMinutes: 10, retentionDays: 30, limit: 25 },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/recovery?limit=25&staleAfterMinutes=10&leaseTtlSeconds=90", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4W",
          source: "postgres",
          summary: {
            stuckCommands: 1,
            expiredCommands: 0,
            leaseExpiredCommands: 1,
            retryableCommands: 1,
            cancellableCommands: 2,
          },
          policy: { staleAfterMinutes: 10, leaseTtlSeconds: 90, maxRecoveryBatch: 100, allowedActions: ["reschedule", "cancel"] },
          items: [
            {
              id: "cmd-recovery-e2e",
              clinicId: "clinic-1",
              bridgeId: "br-uuid",
              bridgeCode: "br-live-01",
              commandType: "bridge_health_check",
              status: "failed",
              attemptCount: 3,
              lifecycleRevision: 2,
              recoveryState: "retryable_failed",
              payload_json: { secret: true },
              result_json: { token: "hidden" },
            },
          ],
          filters: { staleAfterMinutes: 10, leaseTtlSeconds: 90, limit: 25 },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/commands/cmd-recovery-e2e/recovery", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      expect(body.action).toBe("reschedule");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4W",
          command: {
            id: "cmd-recovery-e2e",
            clinicId: "clinic-1",
            bridgeId: "br-uuid",
            bridgeCode: "br-live-01",
            commandType: "bridge_health_check",
            status: "queued",
            attemptCount: 3,
            recoveryAction: "reschedule",
          },
          recovery: { action: "reschedule", persisted: true },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/audit?limit=25", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4X",
          source: "postgres",
          summary: {
            totalEvents: 4,
            replayEvents: 1,
            recoveryEvents: 1,
            affectedCommands: 2,
          },
          policy: {
            replayPolicy: "manual_system_admin",
            allowedReplayStatuses: ["completed", "failed", "cancelled"],
            allowedReplayCommandTypes: ["bridge_health_check", "device_calibration_request"],
            payloadVisibility: "backend_only",
          },
          items: [
            {
              id: "audit-e2e",
              clinicId: "clinic-1",
              action: "replay",
              commandId: "cmd-replay-e2e",
              bridgeId: "br-uuid",
              bridgeCode: "br-live-01",
              commandType: "bridge_health_check",
              status: "failed",
              attemptCount: 3,
              lifecycleRevision: 4,
              replayPolicy: "manual_system_admin",
              createdAt: "2026-05-14T08:05:00Z",
              payload_json: { token: "hidden" },
              metadata_json: { secret: true },
            },
          ],
          filters: { action: "all", status: "all", limit: 25 },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridge-worker/commands/cmd-replay-e2e/replay", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      expect(body.reason).toContain("Stage 4X");
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4X",
          command: {
            id: "cmd-replayed-e2e",
            clinicId: "clinic-1",
            bridgeId: "br-uuid",
            bridgeCode: "br-live-01",
            commandType: "bridge_health_check",
            status: "queued",
            replayOfCommandId: "cmd-replay-e2e",
            replayPolicy: "manual_system_admin",
          },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/device-bridges/br-uuid/commands", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      expect(body.commandType).toBe("bridge_health_check");
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4R",
          command: { id: "cmd-bridge-e2e", commandType: "bridge_health_check", status: "queued" },
          execution: { worker: "local_device_bridge", browserHardwareAccess: false },
        }),
      });
    });
    await page.route("http://localhost:8080/api/v1/devices/dev-uuid/commands", async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer jwt-device-e2e");
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      expect(body.commandType).toBe("device_calibration_request");
      await route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({
          stage: "4R",
          command: {
            id: "cmd-device-e2e",
            commandType: "device_calibration_request",
            status: "queued",
            deviceId: "dev-uuid",
          },
          execution: { worker: "local_device_bridge", browserHardwareAccess: false },
        }),
      });
    });

    await page.goto("/sys/devices");

    await expect(page.getByRole("heading", { level: 1, name: "Устройства" })).toBeVisible();
    await expect(page.getByText("Self-hosted backend подключён")).toBeVisible();
    await expect(page.getByText("LiveScope 20").first()).toBeVisible();
    await expect(page.getByText("br-live-01").first()).toBeVisible();
    await expect(page.getByRole("region", { name: "Device Bridge worker observability" })).toContainText(
      "stage4t-local-worker",
    );
    await expect(page.getByRole("region", { name: "Device Bridge worker command lifecycle" })).toContainText(
      "bridge_health_check",
    );
    await expect(page.getByRole("region", { name: "Device Bridge worker production hardening" })).toContainText(
      "Cleanup candidates",
    );
    await expect(page.getByRole("region", { name: "Device Bridge worker hardening policy" })).toContainText(
      "linear-capped",
    );
    await expect(page.getByRole("region", { name: "Device Bridge command recovery", exact: true })).toContainText(
      "Retryable failed",
    );
    await expect(page.getByRole("region", { name: "Device Bridge command recovery queue" })).toContainText(
      "retryable_failed",
    );
    await expect(page.getByRole("region", { name: "Device Bridge command audit and replay" })).toContainText(
      "Audit events",
    );
    await expect(page.getByRole("region", { name: "Device Bridge replay policy" })).toContainText(
      "backend_only",
    );
    await expect(page.getByRole("region", { name: "Device Bridge command audit log" })).toContainText(
      "manual_system_admin",
    );
    await expect(page.getByText("Реестр устройств загружен из backend.")).toBeVisible();
    await expect(page.getByText("Браузер не подключается к драйверу напрямую")).toBeVisible();

    await page.getByRole("button", { name: "Проверить мост" }).first().click();
    await expect(page.getByText(/cmd-bridge-e2e/)).toBeVisible();
    await page.getByRole("button", { name: "Запросить калибровку" }).first().click();
    await expect(page.getByText(/cmd-device-e2e/)).toBeVisible();
    await page.getByRole("button", { name: "Повторить" }).click();
    await expect(page.getByText(/cmd-recovery-e2e возвращена в очередь/)).toBeVisible();
    await page.getByRole("button", { name: "Replay" }).click();
    await expect(page.getByText(/cmd-replay-e2e поставлен в очередь Device Bridge: cmd-replayed-e2e/)).toBeVisible();

    const html = await page.locator("main").innerHTML();
    expect(html).not.toContain("access_token");
    expect(html).not.toContain("storage_object_path");
    expect(html).not.toContain("payload_json");
    expect(html).not.toContain("result_json");
    expect(html).not.toContain("Bearer");
    expect(html).not.toContain("WebUSB");
    expect(html).not.toContain("WebBluetooth");
    expect(html).not.toContain("WebSerial");
  });

  test("doctor role is blocked by the sys route guard", async ({ page }) => {
    await setDemoRole(page, "doctor");
    await page.goto("/sys/devices");

    await expect(page.getByText("Нет доступа в демо-режиме")).toBeVisible();
    await expect(page.getByText("Self-hosted backend подключён")).toHaveCount(0);
  });
});
