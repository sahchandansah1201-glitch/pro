import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListWorkerCommandsSql,
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
  assert.match(updateSql, /acknowledged_at/);
  assert.match(updateSql, /completed_at/);
  assert.match(updateSql, /result_json/);
  assert.doesNotMatch(`${heartbeatSql}\n${listSql}\n${updateSql}`, /\bsupabase\b|api-read|api-write|edge function/i);
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
