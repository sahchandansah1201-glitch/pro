import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeviceBridgeFleetReliability,
  createDeviceBridgeFleetReliabilityService,
} from "./device-bridge-fleet-reliability-service.mjs";

test("Stage 9B-9M fleet reliability summarizes SLO pressure without unsafe fields", () => {
  const reliability = buildDeviceBridgeFleetReliability({
    generatedAt: "2026-05-21T12:00:00.000Z",
    continuity: {
      summary: {
        bridgeCount: 3,
        staleWorkers: 1,
        failedCommands: 1,
        stuckCommands: 1,
        retryableCommands: 2,
        cancellableCommands: 0,
        auditEvents: 15,
      },
      gates: [{ status: "passed" }, { status: "attention" }],
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        browserHardwareApis: false,
      },
    },
  });

  assert.equal(reliability.status, "attention");
  assert.equal(reliability.summary.queuePressure, 4);
  assert.equal(reliability.summary.fleetAttention, 6);
  assert.equal(reliability.stages.length, 12);
  assert.deepEqual(reliability.handoff.includedStages, [
    "Stage 9B",
    "Stage 9C",
    "Stage 9D",
    "Stage 9E",
    "Stage 9F",
    "Stage 9G",
    "Stage 9H",
    "Stage 9I",
    "Stage 9J",
    "Stage 9K",
    "Stage 9L",
    "Stage 9M",
  ]);
  assert.equal(reliability.handoff.originalHypothesis, "Stage 9B-9D");
  assert.equal(reliability.handoff.nextBatchHypothesis, "Stage 9N-9Z");
  assert.equal(reliability.productBoundary.managedRuntimeDependency, "none");
  assert.equal(reliability.productBoundary.managedDatabaseDependency, "none");
  assert.equal(reliability.productBoundary.browserHardwareApis, false);
  assert.equal(reliability.productBoundary.payloadVisibility, "backend-only");
  assert.equal(JSON.stringify(reliability).includes("payload_json"), false);
  assert.equal(JSON.stringify(reliability).includes("signed_url"), false);
});

test("Stage 9B-9M service reuses continuity and writes safe audit metadata", async () => {
  const auditEvents = [];
  const service = createDeviceBridgeFleetReliabilityService({
    deviceBridgeOperationsContinuityService: {
      async getOperationsContinuity() {
        return {
          continuity: {
            summary: {
              bridgeCount: 2,
              staleWorkers: 0,
              failedCommands: 0,
              stuckCommands: 0,
              retryableCommands: 0,
              cancellableCommands: 0,
              auditEvents: 5,
            },
            gates: [{ status: "passed" }],
            productBoundary: {
              managedRuntimeDependency: "none",
              managedDatabaseDependency: "none",
              browserHardwareApis: false,
            },
          },
          scope: { allClinics: true, roles: ["system_admin"], clinicIds: [] },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
  });

  const result = await service.getFleetReliability(
    { userId: "u-admin", roles: ["system_admin"] },
    { correlationId: "corr-9b", generatedAt: "2026-05-21T12:00:00.000Z" },
  );

  assert.equal(result.reliability.status, "ready");
  assert.equal(result.reliability.summary.fleetAttention, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "device_bridge.fleet_reliability.read");
  assert.equal(auditEvents[0].metadata.status, "ready");
  assert.equal(auditEvents[0].metadata.fleetAttention, 0);
});
