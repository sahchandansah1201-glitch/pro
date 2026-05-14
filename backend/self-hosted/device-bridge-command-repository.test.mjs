import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateDeviceBridgeCommandSql,
  buildGetBridgeForCommandSql,
  buildGetDeviceForCommandSql,
  createDeviceBridgeCommandRepository,
} from "./device-bridge-command-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const BRIDGE_ID = "10000000-0000-4000-8000-000000000301";
const DEVICE_ID = "10000000-0000-4000-8000-000000000401";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("command SQL is clinic scoped and avoids driver payloads", () => {
  const bridgeSql = buildGetBridgeForCommandSql({
    bridgeId: BRIDGE_ID,
    clinicIds: [CLINIC_ID],
  });
  const deviceSql = buildGetDeviceForCommandSql({
    deviceId: DEVICE_ID,
    clinicIds: [CLINIC_ID],
  });
  const commandSql = buildCreateDeviceBridgeCommandSql({
    clinicId: CLINIC_ID,
    bridgeId: BRIDGE_ID,
    deviceId: DEVICE_ID,
    commandType: "device_calibration_request",
    requestedBy: USER_ID,
    reason: "Проверка",
    payload: { requestedFrom: "sys_devices" },
  });

  assert.match(bridgeSql, /from device_bridges b/);
  assert.match(bridgeSql, /b\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(deviceSql, /from medical_devices d/);
  assert.match(commandSql, /insert into device_bridge_commands/);
  assert.match(commandSql, /device_calibration_request/);
  assert.match(commandSql, /requestedFrom/);
  assert.doesNotMatch(`${bridgeSql}\n${deviceSql}\n${commandSql}`, /password_hash|object_key|storage_path|access_token/i);
});

test("repository normalizes bridge, device and command rows", async () => {
  const repository = createDeviceBridgeCommandRepository({
    async queryJson(sql) {
      if (sql.includes("from device_bridges b")) {
        return [{
          id: BRIDGE_ID,
          clinicId: CLINIC_ID,
          bridgeCode: "br-live-01",
          hostName: "bridge-host",
          lanStatus: "online",
          version: "1.2.3",
        }];
      }
      if (sql.includes("from medical_devices d")) {
        return [{
          id: DEVICE_ID,
          clinicId: CLINIC_ID,
          model: "DermLite DL5",
          serial: "DL5-AX-1042",
          status: "connected",
          bridgeId: BRIDGE_ID,
          bridgeCode: "br-live-01",
          bridgeHostName: "bridge-host",
          bridgeLanStatus: "online",
        }];
      }
      return [{
        id: "10000000-0000-4000-8000-000000000901",
        clinicId: CLINIC_ID,
        bridgeId: BRIDGE_ID,
        deviceId: DEVICE_ID,
        commandType: "device_calibration_request",
        status: "queued",
        reason: "Проверка",
        createdAt: "2026-05-14T09:00:00.000Z",
      }];
    },
  });

  const bridge = await repository.getBridgeForCommand({ bridgeId: BRIDGE_ID, clinicIds: [CLINIC_ID] });
  const device = await repository.getDeviceForCommand({ deviceId: DEVICE_ID, clinicIds: [CLINIC_ID] });
  const command = await repository.createCommand({
    clinicId: CLINIC_ID,
    bridgeId: BRIDGE_ID,
    deviceId: DEVICE_ID,
    commandType: "device_calibration_request",
    requestedBy: USER_ID,
  });

  assert.equal(bridge.bridgeCode, "br-live-01");
  assert.equal(device.serial, "DL5-AX-1042");
  assert.equal(device.bridge.code, "br-live-01");
  assert.equal(command.commandType, "device_calibration_request");
  assert.equal(command.status, "queued");
});
