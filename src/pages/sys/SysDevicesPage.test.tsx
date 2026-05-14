import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SysDevicesPage from "./SysDevicesPage";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

function renderPage() {
  return render(
    <MemoryRouter>
      <SysDevicesPage />
    </MemoryRouter>,
  );
}

function writeLiveSession() {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-device-test");
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({ id: "u-sys", displayName: "System Admin", roles: ["system_admin"] }),
  );
}

describe("SysDevicesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders demo registry without backend calls when self-hosted session is missing", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderPage();

    expect(screen.getByText(/Демо-режим\. Реальные роли, RLS, аудит, ключи и Device Bridge/)).toBeInTheDocument();
    expect(screen.getAllByText("DermLite DL5").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads self-hosted bridge and device registry with bearer token", async () => {
    writeLiveSession();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-device-test");
      if (url.includes("/api/v1/device-bridges/br-uuid/commands")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            command: { id: "cmd-bridge", commandType: "bridge_health_check", status: "queued" },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/devices/dev-uuid/commands")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            command: { id: "cmd-device", commandType: "device_calibration_request", status: "queued", deviceId: "dev-uuid" },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/status")) {
        return new Response(
          JSON.stringify({
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
              },
            ],
            commands: [
              {
                id: "cmd-live",
                clinicId: "clinic-1",
                bridgeId: "br-uuid",
                bridgeCode: "br-live-01",
                commandType: "bridge_health_check",
                status: "failed",
                createdAt: "2026-05-14T08:01:00Z",
              },
            ],
            filters: { workerStatus: "all", commandStatus: "all", limit: 25 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridges")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "br-uuid",
                bridgeCode: "br-live-01",
                hostName: "live-bridge",
                lanStatus: "online",
                version: "1.2.3",
                pairedCount: 1,
                lastHeartbeatAt: "2026-05-14T08:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
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
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    renderPage();

    expect(await screen.findByText(/Self-hosted backend подключён/)).toBeInTheDocument();
    expect((await screen.findAllByText("LiveScope 20")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("br-live-01").length).toBeGreaterThan(0);
    expect(screen.getByText("Реестр устройств загружен из backend.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Device Bridge worker observability" })).toHaveTextContent(
      "stage4t-local-worker",
    );
    expect(screen.getByRole("region", { name: "Device Bridge worker command lifecycle" })).toHaveTextContent(
      "bridge_health_check",
    );
    expect(screen.getByRole("note", { name: "Device Bridge worker privacy boundary" })).toHaveTextContent(
      "lifecycle-метаданные",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);

    fireEvent.click(screen.getByRole("tab", { name: "Нужна калибровка" }));
    expect(screen.getAllByText("LiveScope 20").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Проверить мост" })[0]);
    expect(await screen.findByText(/Команда проверки моста br-live-01 поставлена в очередь Device Bridge: cmd-bridge/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Запросить калибровку" })[0]);
    expect(await screen.findByText(/Команда калибровки LS-200 поставлена в очередь Device Bridge: cmd-device/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it("shows a safe live error without rendering backend internals", async () => {
    writeLiveSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "database_unavailable",
            message: "Database unavailable",
          },
          storage_object_path: "bucket/private",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    const { container } = renderPage();

    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("bucket/private");
  });
});
