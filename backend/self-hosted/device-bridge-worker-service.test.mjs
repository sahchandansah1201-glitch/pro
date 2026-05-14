import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DeviceBridgeWorkerValidationError,
  createDeviceBridgeWorkerService,
  normalizeWorkerCommandUpdate,
  normalizeWorkerHeartbeat,
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
