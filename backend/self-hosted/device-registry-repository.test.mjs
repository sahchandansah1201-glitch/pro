import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildListDeviceBridgesSql,
  buildListMedicalDevicesSql,
  createDeviceRegistryRepository,
  parseDeviceRegistryParams,
} from "./device-registry-repository.mjs";

test("parseDeviceRegistryParams clamps pagination and normalizes filters", () => {
  const params = new URLSearchParams({
    limit: "999",
    offset: "-4",
    search: "  DL5  ",
    status: "connected",
    bridgeStatus: "online",
    needsCalibration: "true",
  });

  assert.deepEqual(parseDeviceRegistryParams(params), {
    limit: 200,
    offset: 0,
    search: "DL5",
    status: "connected",
    bridgeStatus: "online",
    needsCalibration: true,
  });
});

test("buildListDeviceBridgesSql is clinic scoped and avoids sensitive columns", () => {
  const sql = buildListDeviceBridgesSql({
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
    bridgeStatus: "online",
  });

  assert.match(sql, /from device_bridges b/);
  assert.match(sql, /join clinics c/);
  assert.match(sql, /left join medical_devices d/);
  assert.match(sql, /b\.clinic_id in \('10000000-0000-4000-8000-000000000001'::uuid\)/);
  assert.match(sql, /b\.lan_status = 'online'/);
  assert.doesNotMatch(sql, /metadata_json|password_hash|object_key|request_body|storage_path/i);
});

test("buildListMedicalDevicesSql filters safely without exposing raw device metadata", () => {
  const sql = buildListMedicalDevicesSql({
    limit: 25,
    offset: 5,
    search: "O'Hara",
    status: "offline",
    needsCalibration: true,
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });

  assert.match(sql, /from medical_devices d/);
  assert.match(sql, /O''Hara/);
  assert.match(sql, /d\.status = 'offline'/);
  assert.match(sql, /d\.calibration_due_at is not null/);
  assert.match(sql, /limit 25/);
  assert.match(sql, /offset 5/);
  assert.doesNotMatch(sql, /metadata_json|password_hash|object_key|request_body|storage_path/i);
});

test("createDeviceRegistryRepository normalizes bridge and device rows", async () => {
  const queries = [];
  const repository = createDeviceRegistryRepository({
    async queryJson(sql) {
      queries.push(sql);
      if (sql.includes("from device_bridges b")) {
        return [
          {
            id: "10000000-0000-4000-8000-000000000301",
            clinicId: "10000000-0000-4000-8000-000000000001",
            clinicSlug: "demo",
            clinicName: "Demo Clinic",
            bridgeCode: "br-demo-01",
            hostName: "bridge-host",
            lanStatus: "online",
            version: "1.0.0",
            pairedCount: 2,
            lastHeartbeatAt: "2026-05-14T08:00:00.000Z",
          },
        ];
      }
      return [
        {
          id: "10000000-0000-4000-8000-000000000401",
          clinicId: "10000000-0000-4000-8000-000000000001",
          clinicSlug: "demo",
          clinicName: "Demo Clinic",
          model: "DermLite DL5",
          serial: "DL5-AX-1042",
          firmware: "2.4.1",
          magnification: "x10",
          polarization: "polarized",
          calibrationProfile: "DL5-std-A",
          calibrationDueAt: "2026-05-20",
          status: "connected",
          lastSeenAt: "2026-05-14T08:00:00.000Z",
          bridgeId: "10000000-0000-4000-8000-000000000301",
          bridgeCode: "br-demo-01",
          bridgeHostName: "bridge-host",
          bridgeLanStatus: "online",
        },
      ];
    },
  });

  const bridges = await repository.listDeviceBridges({
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });
  const devices = await repository.listMedicalDevices({
    status: "connected",
    needsCalibration: true,
    clinicIds: ["10000000-0000-4000-8000-000000000001"],
  });

  assert.equal(bridges.source, "postgres");
  assert.equal(bridges.items[0].bridgeCode, "br-demo-01");
  assert.equal(bridges.items[0].pairedCount, 2);
  assert.equal(devices.items[0].serial, "DL5-AX-1042");
  assert.equal(devices.items[0].bridge.code, "br-demo-01");
  assert.equal(devices.items[0].calibrationDueAt, "2026-05-20");
  assert.equal(queries.length, 2);
});
