import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DeviceCommandValidationError,
  createDeviceBridgeCommandService,
  normalizeBridgeCommandPayload,
  normalizeDeviceCommandPayload,
} from "./device-bridge-command-service.mjs";
import { ForbiddenError } from "./rbac.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const BRIDGE_ID = "10000000-0000-4000-8000-000000000301";
const DEVICE_ID = "10000000-0000-4000-8000-000000000401";
const USER_ID = "10000000-0000-4000-8000-000000000101";

function authContext(role = "clinic_admin") {
  return {
    userId: USER_ID,
    roles: [role],
    clinicIds: role === "system_admin" ? [] : [CLINIC_ID],
  };
}

function createService({ bridge = {}, device = {}, auditEvents = [] } = {}) {
  return createDeviceBridgeCommandService({
    deviceBridgeCommandRepository: {
      async getBridgeForCommand() {
        return bridge === null
          ? null
          : {
              id: BRIDGE_ID,
              clinicId: CLINIC_ID,
              bridgeCode: "br-live-01",
              hostName: "bridge-host",
              lanStatus: "online",
              ...bridge,
            };
      },
      async getDeviceForCommand() {
        return device === null
          ? null
          : {
              id: DEVICE_ID,
              clinicId: CLINIC_ID,
              serial: "DL5-AX-1042",
              model: "DermLite DL5",
              status: "connected",
              bridgeId: BRIDGE_ID,
              ...device,
            };
      },
      async createCommand(params) {
        return {
          id: "10000000-0000-4000-8000-000000000901",
          clinicId: params.clinicId,
          bridgeId: params.bridgeId,
          deviceId: params.deviceId || null,
          commandType: params.commandType,
          status: "queued",
          reason: params.reason || null,
          createdAt: "2026-05-14T09:00:00.000Z",
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

test("normalizes command payloads and rejects unknown commands", () => {
  assert.deepEqual(normalizeBridgeCommandPayload({ commandType: "bridge_health_check", reason: "  ok  " }), {
    commandType: "bridge_health_check",
    reason: "ok",
    payload: {
      requestedFrom: "sys_devices",
      expectedWorker: "local_device_bridge",
    },
  });
  assert.deepEqual(normalizeDeviceCommandPayload({ commandType: "device_stream_open_request" }).commandType, "device_stream_open_request");
  assert.throws(
    () => normalizeDeviceCommandPayload({ commandType: "raw_driver_open" }),
    DeviceCommandValidationError,
  );
});

test("queues bridge health command with RBAC and audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.requestBridgeCommand(
    BRIDGE_ID,
    { commandType: "bridge_health_check", reason: "LAN status check" },
    authContext("clinic_admin"),
    { correlationId: "corr-1" },
  );

  assert.equal(result.command.status, "queued");
  assert.equal(result.command.commandType, "bridge_health_check");
  assert.equal(result.mode, "bridge_health_check");
  assert.equal(auditEvents[0].action, "device_bridge.command.create");
  assert.equal(auditEvents[0].metadata.bridgeId, BRIDGE_ID);
});

test("queues calibration and stream commands for paired devices", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const calibration = await service.requestDeviceCommand(
    DEVICE_ID,
    { commandType: "device_calibration_request" },
    authContext("system_admin"),
    { correlationId: "corr-2" },
  );
  const stream = await service.requestDeviceCommand(
    DEVICE_ID,
    { commandType: "device_stream_open_request" },
    authContext("system_admin"),
    { correlationId: "corr-3" },
  );

  assert.equal(calibration.command.deviceId, DEVICE_ID);
  assert.equal(calibration.mode, "calibration_request");
  assert.equal(stream.mode, "stream_open_request");
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "device.calibration.request",
    "device.stream.request",
  ]);
});

test("rejects clinical roles and unpaired devices", async () => {
  const service = createService({ device: { bridgeId: null } });

  await assert.rejects(
    () => service.requestBridgeCommand(BRIDGE_ID, { commandType: "bridge_health_check" }, authContext("doctor")),
    ForbiddenError,
  );
  await assert.rejects(
    () => service.requestDeviceCommand(DEVICE_ID, { commandType: "device_calibration_request" }, authContext("clinic_admin")),
    DeviceCommandValidationError,
  );
});
