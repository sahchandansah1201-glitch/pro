import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listSelfHostedDeviceBridges,
  listSelfHostedDevices,
  exportSelfHostedDeviceBridgeCommandAudit,
  getSelfHostedDeviceBridgeWorkerHardening,
  getSelfHostedDeviceBridgeWorkerRecovery,
  getSelfHostedDeviceBridgeWorkerStatus,
  getSelfHostedDeviceBridgeCommandAudit,
  replaySelfHostedDeviceBridgeCommand,
  recoverSelfHostedDeviceBridgeWorkerCommand,
  requestSelfHostedBridgeCommand,
  requestSelfHostedDeviceCommand,
  toSelfHostedDeviceBridgeCommandAuditExportDTO,
  toSelfHostedDeviceBridgeDTO,
  toSelfHostedDeviceBridgeCommandAuditDTO,
  toSelfHostedDeviceBridgeWorkerHardeningDTO,
  toSelfHostedDeviceBridgeWorkerRecoveryDTO,
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

  it("normalizes worker recovery DTO without exposing worker internals", () => {
    const recovery = toSelfHostedDeviceBridgeWorkerRecoveryDTO({
      stage: "4W",
      source: "postgres",
      summary: {
        stuckCommands: 1,
        expiredCommands: 2,
        leaseExpiredCommands: 1,
        retryableCommands: 3,
        cancellableCommands: 4,
      },
      policy: {
        staleAfterMinutes: 10,
        leaseTtlSeconds: 90,
        maxRecoveryBatch: 100,
        allowedActions: ["reschedule", "cancel"],
      },
      items: [
        {
          id: "cmd-1",
          clinicId: "clinic-1",
          bridgeId: "br-1",
          bridgeCode: "br-msk-01",
          commandType: "bridge_health_check",
          status: "failed",
          attemptCount: 3,
          lifecycleRevision: 2,
          leaseOwner: "br-msk-01",
          leaseExpiresAt: "2026-05-14T08:01:30Z",
          recoveryState: "retryable_failed",
          payload_json: { hidden: true },
          result_json: { hidden: true },
        },
      ],
      access_token: "secret",
      storage_object_path: "hidden",
    });

    expect(recovery?.stage).toBe("4W");
    expect(recovery?.summary.stuckCommands).toBe(1);
    expect(recovery?.items[0].recoveryState).toBe("retryable_failed");
    expect(recovery?.items[0].leaseOwner).toBe("br-msk-01");
    expect(JSON.stringify(recovery)).not.toContain("payload_json");
    expect(JSON.stringify(recovery)).not.toContain("result_json");
    expect(JSON.stringify(recovery)).not.toContain("access_token");
  });

  it("normalizes worker command audit DTO without exposing audit or payload internals", () => {
    const audit = toSelfHostedDeviceBridgeCommandAuditDTO({
      stage: "4X",
      source: "postgres",
      summary: {
        totalEvents: 2,
        replayEvents: 1,
        recoveryEvents: 1,
        affectedCommands: 2,
      },
      policy: {
        replayPolicy: "manual_system_admin",
        allowedReplayStatuses: ["completed", "failed", "cancelled"],
        allowedReplayCommandTypes: ["bridge_health_check"],
        payloadVisibility: "backend-only",
      },
      items: [
        {
          id: "audit-1",
          clinicId: "clinic-1",
          actorUserId: "user-1",
          action: "replay",
          commandId: "cmd-1",
          bridgeCode: "br-msk-01",
          commandType: "bridge_health_check",
          status: "queued",
          attemptCount: 1,
          lifecycleRevision: 2,
          metadata_json: { token: "hidden" },
          payload_json: { rawDriver: "hidden" },
          result_json: { signedUrl: "hidden" },
        },
      ],
      access_token: "secret",
      storage_object_path: "hidden",
    });

    expect(audit?.stage).toBe("4X");
    expect(audit?.summary.replayEvents).toBe(1);
    expect(audit?.policy.payloadVisibility).toBe("backend-only");
    expect(audit?.items[0].action).toBe("replay");
    expect(JSON.stringify(audit)).not.toContain("metadata_json");
    expect(JSON.stringify(audit)).not.toContain("payload_json");
    expect(JSON.stringify(audit)).not.toContain("result_json");
    expect(JSON.stringify(audit)).not.toContain("access_token");
  });

  it("normalizes worker command audit export DTO without exposing payload internals", () => {
    const exportFile = toSelfHostedDeviceBridgeCommandAuditExportDTO({
      stage: "4Y",
      source: "postgres",
      export: {
        format: "csv",
        mime: "text/csv;charset=utf-8",
        filename: "device-bridge-command-audit-replay-failed-1-rows.csv",
        rowCount: 1,
        content: '# stage,4Y\n"event_id","action"\n"audit-1","replay"',
        privacy: {
          payloadVisibility: "backend-only",
          excludedFieldCount: 3,
          exportedFieldSet: "safe-command-metadata-only",
        },
        payload_json: { raw: true },
      },
      filters: { action: "replay", status: "failed", limit: 10 },
      access_token: "secret",
    });

    expect(exportFile?.stage).toBe("4Y");
    expect(exportFile?.export.filename).toContain("audit-replay-failed");
    expect(exportFile?.export.rowCount).toBe(1);
    expect(exportFile?.export.privacy.excludedFieldCount).toBe(3);
    expect(exportFile?.export.privacy.exportedFieldSet).toBe("safe-command-metadata-only");
    expect(JSON.stringify(exportFile)).not.toContain("access_token");
    expect(JSON.stringify(exportFile)).not.toContain("payload_json");
    expect(JSON.stringify(exportFile)).not.toContain("raw");
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

  it("fetches Device Bridge worker recovery and posts recovery actions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
      if (url.includes("/api/v1/device-bridge-worker/recovery?")) {
        return new Response(
          JSON.stringify({
            stage: "4W",
            source: "postgres",
            summary: {
              stuckCommands: 1,
              expiredCommands: 0,
              leaseExpiredCommands: 1,
              retryableCommands: 1,
              cancellableCommands: 2,
            },
            policy: {
              staleAfterMinutes: 20,
              leaseTtlSeconds: 120,
              maxRecoveryBatch: 100,
              allowedActions: ["reschedule", "cancel"],
            },
            items: [
              {
                id: "cmd-1",
                clinicId: "clinic-1",
                bridgeId: "br-1",
                bridgeCode: "br-msk-01",
                commandType: "bridge_health_check",
                status: "failed",
                attemptCount: 3,
                recoveryState: "retryable_failed",
              },
            ],
            filters: { staleAfterMinutes: 20, leaseTtlSeconds: 120, limit: 10 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ action: "reschedule", reason: "Retry" }));
      return new Response(
        JSON.stringify({
          command: {
            id: "cmd-1",
            clinicId: "clinic-1",
            bridgeId: "br-1",
            commandType: "bridge_health_check",
            status: "queued",
            attemptCount: 3,
            recoveryAction: "reschedule",
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const recovery = await getSelfHostedDeviceBridgeWorkerRecovery({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      staleAfterMinutes: 20,
      leaseTtlSeconds: 120,
      limit: 10,
    });
    const action = await recoverSelfHostedDeviceBridgeWorkerCommand({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      commandId: "cmd-1",
      action: "reschedule",
      reason: "Retry",
    });

    expect(recovery.value?.summary.stuckCommands).toBe(1);
    expect(recovery.value?.policy.leaseTtlSeconds).toBe(120);
    expect(action.value?.status).toBe("queued");
    expect(action.value?.recoveryAction).toBe("reschedule");
    expect(String(fetchMock.mock.calls[0][0])).toContain("leaseTtlSeconds=120");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/v1/device-bridge-worker/commands/cmd-1/recovery");
  });

  it("fetches Device Bridge command audit, export, and posts replay actions", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt");
      if (url.includes("/api/v1/device-bridge-worker/audit/export?")) {
        return new Response(
          JSON.stringify({
            stage: "4Y",
            source: "postgres",
            export: {
              format: "csv",
              mime: "text/csv;charset=utf-8",
              filename: "device-bridge-command-audit-replay-queued-1-rows.csv",
              rowCount: 1,
              content: '# stage,4Y\n"event_id","action"\n"audit-1","replay"',
              privacy: {
                payloadVisibility: "backend-only",
                excludedFieldCount: 2,
                exportedFieldSet: "safe-command-metadata-only",
              },
            },
            filters: { action: "replay", status: "queued", limit: 10 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/audit?")) {
        return new Response(
          JSON.stringify({
            stage: "4X",
            source: "postgres",
            summary: {
              totalEvents: 2,
              replayEvents: 1,
              recoveryEvents: 1,
              affectedCommands: 2,
            },
            policy: {
              replayPolicy: "manual_system_admin",
              allowedReplayStatuses: ["completed", "failed", "cancelled"],
              allowedReplayCommandTypes: ["bridge_health_check"],
              payloadVisibility: "backend-only",
            },
            items: [
              {
                id: "audit-1",
                clinicId: "clinic-1",
                action: "replay",
                commandId: "cmd-1",
                bridgeCode: "br-msk-01",
                commandType: "bridge_health_check",
                status: "queued",
                replayPolicy: "manual_system_admin",
              },
            ],
            filters: { action: "replay", status: "queued", limit: 10 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ reason: "Replay" }));
      return new Response(
        JSON.stringify({
          command: {
            id: "cmd-2",
            clinicId: "clinic-1",
            bridgeId: "br-1",
            commandType: "bridge_health_check",
            status: "queued",
            replayOfCommandId: "cmd-1",
            replayPolicy: "manual_system_admin",
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    });

    const audit = await getSelfHostedDeviceBridgeCommandAudit({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      action: "replay",
      status: "queued",
      limit: 10,
    });
    const exportFile = await exportSelfHostedDeviceBridgeCommandAudit({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      action: "replay",
      status: "queued",
      limit: 10,
    });
    const replay = await replaySelfHostedDeviceBridgeCommand({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "jwt",
      commandId: "cmd-1",
      reason: "Replay",
    });

    expect(audit.value?.summary.replayEvents).toBe(1);
    expect(audit.value?.policy.payloadVisibility).toBe("backend-only");
    expect(exportFile.value?.export.filename).toContain("device-bridge-command-audit");
    expect(exportFile.value?.export.content).toContain("# stage,4Y");
    expect(replay.value?.status).toBe("queued");
    expect(replay.value?.replayOfCommandId).toBe("cmd-1");
    expect(String(fetchMock.mock.calls[0][0])).toContain("action=replay");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/api/v1/device-bridge-worker/audit/export");
    expect(String(fetchMock.mock.calls[2][0])).toContain("/api/v1/device-bridge-worker/commands/cmd-1/replay");
  });
});
