import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSelfHostedDeviceBridges,
  listSelfHostedDevices,
  getSelfHostedDeviceBridgeWorkerHardening,
  getSelfHostedDeviceBridgeWorkerStatus,
  requestSelfHostedBridgeCommand,
  requestSelfHostedDeviceCommand,
  toSelfHostedDeviceBridgeDTO,
  toSelfHostedDeviceBridgeWorkerHardeningDTO,
  toSelfHostedDeviceBridgeWorkerStatusDTO,
  toSelfHostedDeviceCommandDTO,
  toSelfHostedDeviceDTO,
} from "./self-hosted-device-api";

describe("self-hosted-device-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes bridge and device DTOs without exposing unsafe fields", () => {
    const bridge = toSelfHostedDeviceBridgeDTO({
      id: "br-1",
      bridgeCode: "br-msk-01",
      hostName: "bridge-host",
      lanStatus: "online",
      version: "1.0.0",
      pairedCount: 2,
      lastHeartbeatAt: "2026-05-14T08:00:00Z",
      metadata_json: { secret: true },
    });
    const device = toSelfHostedDeviceDTO({
      id: "d-1",
      model: "DermLite DL5",
      serial: "DL5-AX-1042",
      firmware: "2.4.1",
      magnification: "x10",
      polarization: "polarized",
      calibrationProfile: "DL5-std-A",
      calibrationDueAt: "2026-05-20",
      status: "connected",
      lastSeenAt: "2026-05-14T08:00:00Z",
      bridgeId: "br-1",
      bridge: { code: "br-msk-01", hostName: "bridge-host", lanStatus: "online" },
      object_key: "hidden",
      storage_object_path: "hidden",
    });

    expect(bridge?.bridgeCode).toBe("br-msk-01");
    expect(device?.serial).toBe("DL5-AX-1042");
    expect(JSON.stringify({ bridge, device })).not.toContain("metadata_json");
    expect(JSON.stringify({ bridge, device })).not.toContain("storage_object_path");
  });

  it("normalizes command DTOs without exposing payload internals", () => {
    const command = toSelfHostedDeviceCommandDTO({
      id: "cmd-1",
      clinicId: "clinic-1",
      bridgeId: "bridge-1",
      deviceId: "device-1",
      commandType: "device_calibration_request",
      status: "queued",
      reason: "Проверка",
      payload_json: { rawDriver: "hidden" },
    });

    expect(command?.commandType).toBe("device_calibration_request");
    expect(JSON.stringify(command)).not.toContain("payload_json");
    expect(JSON.stringify(command)).not.toContain("rawDriver");
  });

  it("normalizes worker status DTO without exposing worker payload internals", () => {
    const status = toSelfHostedDeviceBridgeWorkerStatusDTO({
      stage: "4U",
      source: "postgres",
      summary: { bridgeCount: 1, onlineWorkers: 1, queuedCommands: 2, failedCommands: 1 },
      items: [
        {
          id: "br-1",
          clinicId: "clinic-1",
          bridgeCode: "br-msk-01",
          hostName: "host",
          lanStatus: "online",
          workerStatus: "online",
          workerVersion: "stage4t-local-worker",
          queuedCount: 2,
          failedCount: 1,
          worker_metadata_json: { secret: true },
        },
      ],
      commands: [
        {
          id: "cmd-1",
          clinicId: "clinic-1",
          bridgeId: "br-1",
          bridgeCode: "br-msk-01",
          commandType: "bridge_health_check",
          status: "failed",
          result_json: { token: "hidden" },
          payload_json: { driver: "hidden" },
        },
      ],
      filters: { workerStatus: "online", commandStatus: "failed", limit: 10 },
      access_token: "secret",
      storage_object_path: "hidden",
    });

    expect(status?.summary.onlineWorkers).toBe(1);
    expect(status?.items[0].workerVersion).toBe("stage4t-local-worker");
    expect(status?.commands[0].status).toBe("failed");
    expect(JSON.stringify(status)).not.toContain("worker_metadata_json");
    expect(JSON.stringify(status)).not.toContain("payload_json");
    expect(JSON.stringify(status)).not.toContain("result_json");
    expect(JSON.stringify(status)).not.toContain("access_token");
  });

  it("normalizes worker hardening DTO without exposing worker internals", () => {
    const hardening = toSelfHostedDeviceBridgeWorkerHardeningDTO({
      stage: "4V",
      source: "postgres",
      summary: {
        staleWorkers: 1,
        retryingCommands: 2,
        rateLimitedCommands: 3,
        maxQueueAgeSeconds: 90,
        cleanupCandidates: 4,
      },
      policy: { staleAfterMinutes: 10, retentionDays: 30, pollBackoff: "linear-capped", maxPollLimit: 50 },
      items: [
        {
          id: "br-1",
          clinicId: "clinic-1",
          bridgeCode: "br-msk-01",
          hostName: "host",
          workerStatus: "degraded",
          workerVersion: "stage4t-local-worker",
          stale: true,
          retryingCommandCount: 2,
          rateLimitedCommandCount: 1,
          maxQueueAgeSeconds: 90,
          worker_metadata_json: { secret: true },
        },
      ],
      payload_json: { hidden: true },
      result_json: { hidden: true },
      access_token: "secret",
      storage_object_path: "hidden",
    });

    expect(hardening?.stage).toBe("4V");
    expect(hardening?.summary.staleWorkers).toBe(1);
    expect(hardening?.items[0].stale).toBe(true);
    expect(JSON.stringify(hardening)).not.toContain("worker_metadata_json");
    expect(JSON.stringify(hardening)).not.toContain("payload_json");
    expect(JSON.stringify(hardening)).not.toContain("result_json");
    expect(JSON.stringify(hardening)).not.toContain("access_token");
  });

  it("returns not_configured before network calls when token is missing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await listSelfHostedDevices({
      apiBaseUrl: "http://localhost:8080",
      apiToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls backend endpoints with bearer auth and query filters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes("/api/v1/device-bridges")) {
        return new Response(
          JSON.stringify({
            items: [{ id: "br-1", bridgeCode: "br-msk-01", hostName: "host", lanStatus: "online" }],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          items: [{ id: "d-1", model: "DermLite", serial: "DL5", status: "connected" }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const bridges = await listSelfHostedDeviceBridges({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      bridgeStatus: "online",
    });
    const devices = await listSelfHostedDevices({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      search: "DL5",
      status: "connected",
      needsCalibration: true,
    });

    expect(bridges.value?.[0].bridgeCode).toBe("br-msk-01");
    expect(devices.value?.[0].serial).toBe("DL5");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/api/v1/device-bridges?bridgeStatus=online");
    expect(String(fetchMock.mock.calls[1][0])).toContain("needsCalibration=true");
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
  });

  it("queues bridge and device commands through backend POST endpoints", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect(init?.method).toBe("POST");
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
      expect((init?.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
      if (url.includes("/api/v1/device-bridges/br-1/commands")) {
        expect(init?.body).toBe(JSON.stringify({ commandType: "bridge_health_check", reason: "Проверка" }));
        return new Response(
          JSON.stringify({
            command: { id: "cmd-bridge", commandType: "bridge_health_check", status: "queued" },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          command: {
            id: "cmd-device",
            commandType: "device_stream_open_request",
            status: "queued",
            deviceId: "device-1",
          },
        }),
        { status: 202, headers: { "content-type": "application/json" } },
      );
    });

    const bridge = await requestSelfHostedBridgeCommand({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      bridgeId: "br-1",
      commandType: "bridge_health_check",
      reason: "Проверка",
    });
    const device = await requestSelfHostedDeviceCommand({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      deviceId: "device-1",
      commandType: "device_stream_open_request",
    });

    expect(bridge.value?.commandType).toBe("bridge_health_check");
    expect(device.value?.deviceId).toBe("device-1");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches Device Bridge worker status with safe filters and bearer auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "4U",
          source: "postgres",
          summary: { bridgeCount: 1, onlineWorkers: 1, queuedCommands: 1, failedCommands: 0 },
          items: [{ id: "br-1", bridgeCode: "br-msk-01", workerStatus: "online", lanStatus: "online" }],
          commands: [{ id: "cmd-1", commandType: "bridge_health_check", status: "queued" }],
          filters: { workerStatus: "online", commandStatus: "queued", limit: 10 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await getSelfHostedDeviceBridgeWorkerStatus({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      workerStatus: "online",
      commandStatus: "queued",
      limit: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.summary.bridgeCount).toBe(1);
    expect(result.value?.commands[0].status).toBe("queued");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:8080/api/v1/device-bridge-worker/status?limit=10&workerStatus=online&commandStatus=queued",
    );
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
  });

  it("fetches Device Bridge worker hardening with policy filters and bearer auth", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "4V",
          source: "postgres",
          summary: {
            staleWorkers: 1,
            retryingCommands: 2,
            rateLimitedCommands: 1,
            maxQueueAgeSeconds: 120,
            cleanupCandidates: 3,
          },
          policy: { staleAfterMinutes: 15, retentionDays: 45, pollBackoff: "linear-capped", maxPollLimit: 50 },
          items: [{ id: "br-1", bridgeCode: "br-msk-01", workerStatus: "degraded", stale: true }],
          filters: { staleAfterMinutes: 15, retentionDays: 45, limit: 20 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    const result = await getSelfHostedDeviceBridgeWorkerHardening({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      staleAfterMinutes: 15,
      retentionDays: 45,
      limit: 20,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.summary.cleanupCandidates).toBe(3);
    expect(result.value?.items[0].bridgeCode).toBe("br-msk-01");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "http://localhost:8080/api/v1/device-bridge-worker/hardening?limit=20&staleAfterMinutes=15&retentionDays=45",
    );
    expect((fetchMock.mock.calls[0][1]?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
  });
});
