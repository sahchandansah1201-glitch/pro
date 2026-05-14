import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListWorkerCommandsSql,
  buildListWorkerHardeningSql,
  buildListWorkerRecoverySql,
  buildRecoverWorkerCommandSql,
  buildListWorkerTelemetrySql,
  buildUpdateWorkerCommandStatusSql,
  buildWorkerHeartbeatSql,
  createDeviceBridgeWorkerRepository,
} from "./device-bridge-worker-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const BRIDGE_ID = "10000000-0000-4000-8000-000000000301";
const COMMAND_ID = "10000000-0000-4000-8000-000000000901";

test("worker SQL upserts heartbeat, polls queued commands, and updates lifecycle", () => {
  const heartbeatSql = buildWorkerHeartbeatSql({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    hostName: "bridge-host",
    version: "4.0.0",
    metadata: { os: "linux" },
  });
  const listSql = buildListWorkerCommandsSql({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    limit: 25,
  });
  const updateSql = buildUpdateWorkerCommandStatusSql({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    commandId: COMMAND_ID,
    status: "completed",
    result: { message: "done", secretToken: "redacted by service before repository" },
  });

  assert.match(heartbeatSql, /insert into device_bridges/);
  assert.match(heartbeatSql, /worker_last_seen_at/);
  assert.match(listSql, /for update skip locked/);
  assert.match(listSql, /dispatched_at = coalesce/);
  assert.match(listSql, /next_attempt_at/);
  assert.match(listSql, /attempt_count/);
  assert.match(listSql, /lease_owner/);
  assert.match(listSql, /lease_expires_at/);
  assert.match(updateSql, /acknowledged_at/);
  assert.match(updateSql, /completed_at/);
  assert.match(updateSql, /result_json/);
  assert.match(updateSql, /lifecycle_revision/);
  assert.match(updateSql, /resolved as/);
  assert.doesNotMatch(`${heartbeatSql}\n${listSql}\n${updateSql}`, /\bsupabase\b|api-read|api-write|edge function/i);
});

test("worker recovery SQL reports recoverable commands and writes safe actions", () => {
  const listSql = buildListWorkerRecoverySql({
    clinicIds: [CLINIC_ID],
    staleAfterMinutes: 20,
    leaseTtlSeconds: 120,
    limit: 10,
  });
  const recoverSql = buildRecoverWorkerCommandSql({
    commandId: COMMAND_ID,
    actorUserId: "10000000-0000-4000-8000-000000000999",
    action: "reschedule",
    reason: "retry safe command",
  });

  assert.match(listSql, /recovery_state/);
  assert.match(listSql, /lease_expired_commands/);
  assert.match(listSql, /retryable_commands/);
  assert.match(listSql, /allowedActions/);
  assert.match(recoverSql, /recovery_action/);
  assert.match(recoverSql, /recovered_by/);
  assert.match(recoverSql, /lifecycle_revision/);
  assert.doesNotMatch(`${listSql}\n${recoverSql}`, /payload_json|result_json|worker_metadata_json|token|secret|supabase|api-read|api-write|edge function/i);
});

test("worker telemetry SQL returns safe bridge status and command lifecycle only", () => {
  const sql = buildListWorkerTelemetrySql({
    clinicIds: [CLINIC_ID],
    allClinics: false,
    workerStatus: "online",
    commandStatus: "failed",
    limit: 40,
  });

  assert.match(sql, /worker_status/i);
  assert.match(sql, /worker_status = 'online'/);
  assert.match(sql, /c.status = 'failed'/);
  assert.match(sql, /queued_count/);
  assert.match(sql, /recent_commands/);
  assert.doesNotMatch(sql, /payload_json|result_json|worker_metadata_json|token|secret|supabase|api-read|api-write|edge function/i);
});

test("repository normalizes worker bridge and commands", async () => {
  const repository = createDeviceBridgeWorkerRepository({
    async queryJson(sql) {
      if (sql.includes("insert into device_bridges")) {
        return [{
          id: BRIDGE_ID,
          clinicId: CLINIC_ID,
          bridgeCode: "bridge-01",
          hostName: "bridge-host",
          lanStatus: "online",
          workerStatus: "online",
          version: "4.0.0",
          workerVersion: "4.0.0",
          lastHeartbeatAt: "2026-05-14T10:00:00.000Z",
          workerLastSeenAt: "2026-05-14T10:00:00.000Z",
        }];
      }
      return [{
        id: COMMAND_ID,
        clinicId: CLINIC_ID,
        bridgeId: BRIDGE_ID,
        commandType: "bridge_health_check",
        status: sql.includes("update device_bridge_commands") ? "completed" : "queued",
        payload: { requestedFrom: "sys_devices" },
        createdAt: "2026-05-14T09:00:00.000Z",
      }];
    },
  });

  const bridge = await repository.recordHeartbeat({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    hostName: "bridge-host",
    version: "4.0.0",
  });
  const commands = await repository.listCommands({ clinicId: CLINIC_ID, bridgeCode: "bridge-01" });
  const updated = await repository.updateCommandStatus({
    clinicId: CLINIC_ID,
    bridgeCode: "bridge-01",
    commandId: COMMAND_ID,
    status: "completed",
  });

  assert.equal(bridge.workerStatus, "online");
  assert.equal(commands[0].payload.requestedFrom, "sys_devices");
  assert.equal(updated.status, "completed");
});

test("repository normalizes worker telemetry projection", async () => {
  const repository = createDeviceBridgeWorkerRepository({
    async queryJson(sql) {
      assert.match(sql, /jsonb_build_object/);
      return {
        bridges: [
          {
            id: BRIDGE_ID,
            clinicId: CLINIC_ID,
            clinicSlug: "demo",
            clinicName: "Demo Clinic",
            bridgeCode: "bridge-01",
            hostName: "bridge-host",
            lanStatus: "online",
            workerStatus: "online",
            version: "4.0.0",
            workerVersion: "stage4t-local-worker",
            pairedCount: 2,
            queuedCount: 1,
            acknowledgedCount: 1,
            completedCount: 3,
            failedCount: 1,
            workerLastSeenAt: "2026-05-14T10:00:00.000Z",
          },
        ],
        commands: [
          {
            id: COMMAND_ID,
            clinicId: CLINIC_ID,
            bridgeId: BRIDGE_ID,
            bridgeCode: "bridge-01",
            commandType: "bridge_health_check",
            status: "failed",
            reason: "ops check",
            createdAt: "2026-05-14T09:00:00.000Z",
          },
        ],
      };
    },
  });

  const result = await repository.listWorkerTelemetry({
    clinicIds: [CLINIC_ID],
    workerStatus: "online",
    commandStatus: "failed",
  });

  assert.equal(result.summary.bridgeCount, 1);
  assert.equal(result.summary.onlineWorkers, 1);
  assert.equal(result.summary.queuedCommands, 1);
  assert.equal(result.summary.failedCommands, 1);
  assert.equal(result.bridges[0].workerVersion, "stage4t-local-worker");
  assert.equal(result.commands[0].status, "failed");
  assert.equal(result.commands[0].bridgeCode, "bridge-01");
});

test("worker hardening SQL reports backoff, stale worker, and retention metrics safely", () => {
  const sql = buildListWorkerHardeningSql({
    clinicIds: [CLINIC_ID],
    staleAfterMinutes: 15,
    retentionDays: 45,
    limit: 20,
  });

  assert.match(sql, /stale_workers/);
  assert.match(sql, /retrying_commands/);
  assert.match(sql, /rate_limited_commands/);
  assert.match(sql, /cleanup_candidates/);
  assert.match(sql, /staleAfterMinutes/);
  assert.doesNotMatch(sql, /payload_json|result_json|worker_metadata_json|token|secret|supabase|api-read|api-write|edge function/i);
});

test("repository normalizes worker hardening projection", async () => {
  const repository = createDeviceBridgeWorkerRepository({
    async queryJson(sql) {
      assert.match(sql, /cleanup_candidates/);
      return {
        summary: {
          staleWorkers: 1,
          retryingCommands: 2,
          rateLimitedCommands: 1,
          maxQueueAgeSeconds: 120,
          cleanupCandidates: 3,
        },
        policy: { staleAfterMinutes: 15, retentionDays: 45, pollBackoff: "linear-capped", maxPollLimit: 50 },
        bridges: [
          {
            id: BRIDGE_ID,
            clinicId: CLINIC_ID,
            bridgeCode: "bridge-01",
            hostName: "bridge-host",
            workerStatus: "degraded",
            workerVersion: "stage4t-local-worker",
            workerLastSeenAt: "2026-05-14T09:40:00.000Z",
            stale: true,
            activeCommandCount: 3,
            retryingCommandCount: 2,
            rateLimitedCommandCount: 1,
            maxQueueAgeSeconds: 120,
          },
        ],
      };
    },
  });

  const result = await repository.listWorkerHardening({
    clinicIds: [CLINIC_ID],
    staleAfterMinutes: 15,
    retentionDays: 45,
    limit: 20,
  });

  assert.equal(result.summary.staleWorkers, 1);
  assert.equal(result.summary.cleanupCandidates, 3);
  assert.equal(result.policy.retentionDays, 45);
  assert.equal(result.bridges[0].stale, true);
  assert.equal(result.bridges[0].retryingCommandCount, 2);
});

test("repository normalizes worker recovery projection and recovered commands", async () => {
  const repository = createDeviceBridgeWorkerRepository({
    async queryJson(sql) {
      if (sql.includes("update device_bridge_commands c")) {
        return [{
          id: COMMAND_ID,
          clinicId: CLINIC_ID,
          bridgeId: BRIDGE_ID,
          commandType: "bridge_health_check",
          status: sql.includes("'cancelled'") ? "cancelled" : "queued",
          attemptCount: 3,
          lifecycleRevision: 4,
          recoveryAction: sql.includes("'cancelled'") ? "cancel" : "reschedule",
          recoveryReason: "safe",
        }];
      }
      assert.match(sql, /recovery_state/);
      return {
        summary: {
          stuckCommands: 1,
          expiredCommands: 1,
          leaseExpiredCommands: 1,
          retryableCommands: 1,
          cancellableCommands: 2,
        },
        policy: { staleAfterMinutes: 20, leaseTtlSeconds: 120, maxRecoveryBatch: 100, allowedActions: ["reschedule", "cancel"] },
        commands: [
          {
            id: COMMAND_ID,
            clinicId: CLINIC_ID,
            bridgeId: BRIDGE_ID,
            bridgeCode: "bridge-01",
            commandType: "bridge_health_check",
            status: "failed",
            attemptCount: 3,
            lifecycleRevision: 2,
            recoveryState: "retryable_failed",
          },
        ],
      };
    },
  });

  const recovery = await repository.listWorkerRecovery({
    clinicIds: [CLINIC_ID],
    staleAfterMinutes: 20,
    leaseTtlSeconds: 120,
  });
  const command = await repository.recoverCommand({
    commandId: COMMAND_ID,
    actorUserId: "10000000-0000-4000-8000-000000000999",
    action: "cancel",
    reason: "safe",
  });

  assert.equal(recovery.summary.stuckCommands, 1);
  assert.equal(recovery.policy.leaseTtlSeconds, 120);
  assert.equal(recovery.commands[0].recoveryState, "retryable_failed");
  assert.equal(command.status, "cancelled");
  assert.equal(command.recoveryAction, "cancel");
});
