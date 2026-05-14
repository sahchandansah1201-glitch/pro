import { expect, test } from "@playwright/test";

import { setDemoRole } from "./helpers/demo-role";

if (process.env.PW_CHROMIUM_PATH) {
  test.use({ launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } });
}

test.describe("Stage 4Q · /sys/devices self-hosted registry", () => {
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

    await page.goto("/sys/devices");

    await expect(page.getByRole("heading", { level: 1, name: "Устройства" })).toBeVisible();
    await expect(page.getByText("Self-hosted backend подключён")).toBeVisible();
    await expect(page.getByText("LiveScope 20").first()).toBeVisible();
    await expect(page.getByText("br-live-01").first()).toBeVisible();
    await expect(page.getByText("Реестр устройств загружен из backend.")).toBeVisible();
    await expect(page.getByText("Браузер не подключается к драйверу напрямую")).toBeVisible();

    const html = await page.locator("main").innerHTML();
    expect(html).not.toContain("access_token");
    expect(html).not.toContain("storage_object_path");
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
