import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DeviceBridgeWorkerValidationError,
  createDeviceBridgeWorkerService,
  normalizeWorkerCommandUpdate,
  normalizeWorkerHardeningQuery,
  normalizeWorkerHeartbeat,
  normalizeWorkerRecoveryAction,
  normalizeWorkerRecoveryQuery,
  normalizeWorkerTelemetryQuery,
} from "./device-bridge-worker-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const BRIDGE_ID = "10000000-0000-4000-8000-000000000301";
const COMMAND_ID = "10000000-0000-4000-8000-000000000901";
const HEADERS = { authorization: "Bearer stage4s-worker-token" };

function createService({ auditEvents = [], command = {} } = {}) {
  return createDeviceBridgeWorkerService({
    config: { deviceBridgeWorkerToken: "stage4s-worker-token" },
    deviceBridgeWorkerRepository: {
      async recordHeartbeat(payload) {
        return {
          id: BRIDGE_ID,
          clinicId: payload.clinicId,
          bridgeCode: payload.bridgeCode,
          workerStatus: payload.workerStatus,
        };
      },
      async listCommands() {
        return [{
          id: COMMAND_ID,
          clinicId: CLINIC_ID,
          bridgeId: BRIDGE_ID,
          commandType: "bridge_health_check",
          status: "queued",
          payload: { requestedFrom: "sys_devices" },
          ...command,
        }];
      },
      async updateCommandStatus(params) {
        if (command === null) return null;
        return {
          id: params.commandId,
          clinicId: params.clinicId,
          bridgeId: BRIDGE_ID,
          commandType: "bridge_health_check",
          status: params.status,
          ...command,
        };
      },
      async listWorkerTelemetry(params) {
        return {
          source: "postgres",
          bridges: [{
            id: BRIDGE_ID,
            clinicId: CLINIC_ID,
            bridgeCode: "bridge-01",
            workerStatus: params.workerStatus === "all" ? "online" : params.workerStatus,
            queuedCount: 1,
            failedCount: 1,
          }],
          commands: [{
            id: COMMAND_ID,
            clinicId: CLINIC_ID,
            bridgeId: BRIDGE_ID,
            commandType: "bridge_health_check",
            status: params.commandStatus === "all" ? "queued" : params.commandStatus,
          }],
          summary: {
            bridgeCount: 1,
            onlineWorkers: 1,
            degradedWorkers: 0,
            offlineWorkers: 0,
            queuedCommands: 1,
            failedCommands: 1,
          },
          filters: {
            workerStatus: params.workerStatus,
            commandStatus: params.commandStatus,
            limit: params.limit,
          },
          clinicIds: [],
          allClinics: true,
        };
      },
      async listWorkerHardening(params) {
        return {
          source: "postgres",
          summary: {
            staleWorkers: 1,
            retryingCommands: 2,
            rateLimitedCommands: 1,
            maxQueueAgeSeconds: 120,
            cleanupCandidates: 3,
          },
          policy: {
            staleAfterMinutes: params.staleAfterMinutes,
            retentionDays: params.retentionDays,
            pollBackoff: "linear-capped",
            maxPollLimit: 50,
          },
          bridges: [{
            id: BRIDGE_ID,
            clinicId: CLINIC_ID,
            bridgeCode: "bridge-01",
            workerStatus: "degraded",
            stale: true,
            retryingCommandCount: 2,
          }],
          filters: {
            limit: params.limit,
            staleAfterMinutes: params.staleAfterMinutes,
            retentionDays: params.retentionDays,
          },
          clinicIds: [],
          allClinics: true,
        };
      },
      async listWorkerRecovery(params) {
        return {
          source: "postgres",
          summary: {
            stuckCommands: 1,
            expiredCommands: 1,
            leaseExpiredCommands: 1,
            retryableCommands: 1,
            cancellableCommands: 2,
          },
          policy: {
            staleAfterMinutes: params.staleAfterMinutes,
            leaseTtlSeconds: params.leaseTtlSeconds,
            maxRecoveryBatch: 100,
            allowedActions: ["reschedule", "cancel"],
          },
          commands: [{
            id: COMMAND_ID,
            clinicId: CLINIC_ID,
            bridgeId: BRIDGE_ID,
            commandType: "bridge_health_check",
            status: "failed",
            attemptCount: 3,
            recoveryState: "retryable_failed",
          }],
          filters: {
            limit: params.limit,
            staleAfterMinutes: params.staleAfterMinutes,
            leaseTtlSeconds: params.leaseTtlSeconds,
          },
          clinicIds: [],
          allClinics: true,
        };
      },
      async recoverCommand(params) {
        if (command === null) return null;
        return {
          id: params.commandId,
          clinicId: CLINIC_ID,
          bridgeId: BRIDGE_ID,
          commandType: "bridge_health_check",
          status: params.action === "cancel" ? "cancelled" : "queued",
          attemptCount: 3,
          lifecycleRevision: 4,
          recoveryAction: params.action,
          recoveryReason: params.reason,
          ...command,
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
}

test("normalizes worker heartbeat and redacts sensitive result payload keys", () => {
  const heartbeat = normalizeWorkerHeartbeat({
    clinicId: CLINIC_ID,
    bridgeCode: " bridge-01 ",
    hostName: " worker.local ",
    version: "4.0.0",
    lanStatus: "online",
    metadata: { signedUrl: "https://example.test?sig=secret", os: "linux" },
  });
  const update = normalizeWorkerCommandUpdate({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    status: "completed",
    result: { accessToken: "secret", status: "ok" },
  });

  assert.equal(heartbeat.bridgeCode, "bridge-01");
  assert.equal(heartbeat.metadata.signedUrl, "[redacted]");
  assert.equal(update.result.payload.accessToken, "[redacted]");
  assert.throws(
    () => normalizeWorkerCommandUpdate({ clinicId: CLINIC_ID, bridgeCode: "bridge-01", status: "raw" }),
    DeviceBridgeWorkerValidationError,
  );
});

test("normalizes worker telemetry query for system-admin monitoring", () => {
  const query = normalizeWorkerTelemetryQuery(
    new URLSearchParams({ workerStatus: "online", commandStatus: "failed", limit: "500" }),
  );
  const fallback = normalizeWorkerTelemetryQuery(
    new URLSearchParams({ workerStatus: "secret", commandStatus: "raw", limit: "-1" }),
  );

  assert.deepEqual(query, {
    workerStatus: "online",
    commandStatus: "failed",
    limit: 100,
  });
  assert.deepEqual(fallback, {
    workerStatus: "all",
    commandStatus: "all",
    limit: 25,
  });
});

test("normalizes worker hardening query for production metrics", () => {
  const query = normalizeWorkerHardeningQuery(
    new URLSearchParams({ staleAfterMinutes: "15", retentionDays: "45", limit: "500" }),
  );
  const fallback = normalizeWorkerHardeningQuery(
    new URLSearchParams({ staleAfterMinutes: "0", retentionDays: "-2", limit: "raw" }),
  );

  assert.deepEqual(query, {
    staleAfterMinutes: 15,
    retentionDays: 45,
    limit: 100,
  });
  assert.deepEqual(fallback, {
    staleAfterMinutes: 10,
    retentionDays: 30,
    limit: 25,
  });
});

test("normalizes worker recovery query and action payloads", () => {
  const query = normalizeWorkerRecoveryQuery(
    new URLSearchParams({ staleAfterMinutes: "20", leaseTtlSeconds: "120", limit: "500" }),
  );
  const fallback = normalizeWorkerRecoveryQuery(
    new URLSearchParams({ staleAfterMinutes: "0", leaseTtlSeconds: "-2", limit: "raw" }),
  );
  const action = normalizeWorkerRecoveryAction({
    action: "reschedule",
    reason: "  Повторить   безопасно  ",
  });

  assert.deepEqual(query, {
    staleAfterMinutes: 20,
    leaseTtlSeconds: 120,
    limit: 100,
  });
  assert.deepEqual(fallback, {
    staleAfterMinutes: 10,
    leaseTtlSeconds: 90,
    limit: 25,
  });
  assert.equal(action.action, "reschedule");
  assert.equal(action.reason, "Повторить безопасно");
  assert.throws(
    () => normalizeWorkerRecoveryAction({ action: "delete" }),
    DeviceBridgeWorkerValidationError,
  );
});

test("records heartbeat, polls commands, and audits command lifecycle", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const heartbeat = await service.recordHeartbeat(
    HEADERS,
    { clinicId: CLINIC_ID, bridgeCode: "bridge-01", hostName: "worker", version: "4.0.0" },
    { correlationId: "corr-heartbeat" },
  );
  const list = await service.listCommands(
    HEADERS,
    new URLSearchParams({ clinicId: CLINIC_ID, bridgeCode: "bridge-01", limit: "5" }),
    { correlationId: "corr-list" },
  );
  const ack = await service.updateCommandStatus(
    COMMAND_ID,
    HEADERS,
    { clinicId: CLINIC_ID, bridgeCode: "bridge-01", status: "acknowledged" },
    { correlationId: "corr-ack" },
  );
  const done = await service.updateCommandStatus(
    COMMAND_ID,
    HEADERS,
    { clinicId: CLINIC_ID, bridgeCode: "bridge-01", status: "completed", message: "done" },
    { correlationId: "corr-done" },
  );

  assert.equal(heartbeat.worker.workerId, "local_device_bridge_worker");
  assert.equal(list.commands[0].id, COMMAND_ID);
  assert.equal(ack.command.status, "acknowledged");
  assert.equal(done.command.status, "completed");
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "device_bridge.worker.heartbeat",
    "device_bridge.command.poll",
    "device_bridge.command.ack",
    "device_bridge.command.complete",
  ]);
});

test("lists worker telemetry through system_admin RBAC and audits safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.listWorkerTelemetry(
    {
      userId: "10000000-0000-4000-8000-000000000999",
      roles: ["system_admin"],
      clinicIds: [],
    },
    new URLSearchParams({ workerStatus: "online", commandStatus: "failed", limit: "10" }),
    { correlationId: "corr-worker-status" },
  );

  assert.equal(result.summary.bridgeCount, 1);
  assert.equal(result.bridges[0].workerStatus, "online");
  assert.equal(result.commands[0].status, "failed");
  assert.deepEqual(result.scope.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.worker.telemetry.read");
  assert.equal(auditEvents.at(-1).metadata.bridgeCount, 1);
});

test("lists worker hardening through system_admin RBAC and audits safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.listWorkerHardening(
    {
      userId: "10000000-0000-4000-8000-000000000999",
      roles: ["system_admin"],
      clinicIds: [],
    },
    new URLSearchParams({ staleAfterMinutes: "15", retentionDays: "45", limit: "20" }),
    { correlationId: "corr-worker-hardening" },
  );

  assert.equal(result.summary.staleWorkers, 1);
  assert.equal(result.summary.retryingCommands, 2);
  assert.equal(result.policy.retentionDays, 45);
  assert.deepEqual(result.scope.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.worker.hardening.read");
  assert.equal(auditEvents.at(-1).metadata.cleanupCandidates, 3);
});

test("lists worker recovery through system_admin RBAC and audits safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.listWorkerRecovery(
    {
      userId: "10000000-0000-4000-8000-000000000999",
      roles: ["system_admin"],
      clinicIds: [],
    },
    new URLSearchParams({ staleAfterMinutes: "20", leaseTtlSeconds: "120", limit: "10" }),
    { correlationId: "corr-worker-recovery" },
  );

  assert.equal(result.summary.stuckCommands, 1);
  assert.equal(result.summary.retryableCommands, 1);
  assert.equal(result.policy.leaseTtlSeconds, 120);
  assert.equal(result.commands[0].recoveryState, "retryable_failed");
  assert.deepEqual(result.scope.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.worker.recovery.read");
  assert.equal(auditEvents.at(-1).metadata.stuckCommands, 1);
});

test("runs worker command recovery actions through system_admin RBAC", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.recoverCommand(
    COMMAND_ID,
    {
      userId: "10000000-0000-4000-8000-000000000999",
      roles: ["system_admin"],
      clinicIds: [],
    },
    { action: "cancel", reason: "Operator cancelled" },
    { correlationId: "corr-worker-recover-action" },
  );

  assert.equal(result.action, "cancel");
  assert.equal(result.command.status, "cancelled");
  assert.deepEqual(result.scope.roles, ["system_admin"]);
  assert.equal(auditEvents.at(-1).action, "device_bridge.command.cancel");
  assert.equal(auditEvents.at(-1).metadata.lifecycleRevision, 4);
});

test("denies worker hardening to non-system-admin roles", async () => {
  const service = createService();

  await assert.rejects(
    () => service.listWorkerHardening(
      {
        userId: "10000000-0000-4000-8000-000000000777",
        roles: ["clinic_admin"],
        clinicIds: [CLINIC_ID],
      },
      new URLSearchParams(),
    ),
    (error) => error.publicCode === "forbidden" && error.publicStatus === 403,
  );
});

test("denies worker recovery to non-system-admin roles", async () => {
  const service = createService();

  await assert.rejects(
    () => service.listWorkerRecovery(
      {
        userId: "10000000-0000-4000-8000-000000000777",
        roles: ["clinic_admin"],
        clinicIds: [CLINIC_ID],
      },
      new URLSearchParams(),
    ),
    (error) => error.publicCode === "forbidden" && error.publicStatus === 403,
  );

  await assert.rejects(
    () => service.recoverCommand(
      COMMAND_ID,
      {
        userId: "10000000-0000-4000-8000-000000000777",
        roles: ["clinic_admin"],
        clinicIds: [CLINIC_ID],
      },
      { action: "reschedule" },
    ),
    (error) => error.publicCode === "forbidden" && error.publicStatus === 403,
  );
});

test("denies worker telemetry to non-system-admin roles", async () => {
  const service = createService();

  await assert.rejects(
    () => service.listWorkerTelemetry(
      {
        userId: "10000000-0000-4000-8000-000000000777",
        roles: ["clinic_admin"],
        clinicIds: [CLINIC_ID],
      },
      new URLSearchParams(),
    ),
    (error) => error.publicCode === "forbidden" && error.publicStatus === 403,
  );
});

test("maps missing worker command to command_not_found", async () => {
  const service = createService({ command: null });

  await assert.rejects(
    () => service.updateCommandStatus(
      COMMAND_ID,
      HEADERS,
      { clinicId: CLINIC_ID, bridgeCode: "bridge-01", status: "failed" },
    ),
    (error) => error.publicCode === "command_not_found" && error.publicStatus === 404,
  );
});
