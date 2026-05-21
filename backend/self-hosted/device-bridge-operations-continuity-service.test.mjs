import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeviceBridgeOperationsContinuity,
  createDeviceBridgeOperationsContinuityService,
} from "./device-bridge-operations-continuity-service.mjs";

test("Stage 8P-9A continuity summarizes incident pressure without raw payloads", () => {
  const continuity = buildDeviceBridgeOperationsContinuity({
    generatedAt: "2026-05-21T10:00:00.000Z",
    readiness: {
      summary: {
        bridgeCount: 2,
        staleWorkers: 1,
        failedCommands: 2,
        stuckCommands: 1,
        retryableCommands: 1,
        cancellableCommands: 0,
        auditEvents: 12,
      },
      gates: [{ status: "attention" }],
      policy: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        browserHardwareApis: false,
      },
    },
  });

  assert.equal(continuity.status, "attention");
  assert.equal(continuity.summary.queuePressure, 4);
  assert.equal(continuity.stages.length, 12);
  assert.deepEqual(continuity.handoff.includedStages, [
    "Stage 8P",
    "Stage 8Q",
    "Stage 8R",
    "Stage 8S",
    "Stage 8T",
    "Stage 8U",
    "Stage 8V",
    "Stage 8W",
    "Stage 8X",
    "Stage 8Y",
    "Stage 8Z",
    "Stage 9A",
  ]);
  assert.equal(continuity.productBoundary.managedRuntimeDependency, "none");
  assert.equal(continuity.productBoundary.managedDatabaseDependency, "none");
  assert.equal(continuity.productBoundary.browserHardwareApis, false);
  assert.equal(continuity.productBoundary.payloadVisibility, "backend-only");
  assert.equal(JSON.stringify(continuity).includes("payload_json"), false);
  assert.equal(JSON.stringify(continuity).includes("signed_url"), false);
});

test("Stage 8P-9A service uses readiness service and writes safe audit metadata", async () => {
  const auditEvents = [];
  const service = createDeviceBridgeOperationsContinuityService({
    deviceBridgeProductionReadinessService: {
      async getProductionReadiness() {
        return {
          readiness: {
            summary: {
              bridgeCount: 1,
              failedCommands: 0,
              stuckCommands: 0,
              retryableCommands: 0,
              cancellableCommands: 0,
              staleWorkers: 0,
              auditEvents: 3,
            },
            gates: [{ status: "passed" }],
            policy: {
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

  const result = await service.getOperationsContinuity(
    { userId: "u-admin", roles: ["system_admin"] },
    { correlationId: "corr-8p", generatedAt: "2026-05-21T10:00:00.000Z" },
  );

  assert.equal(result.continuity.status, "ready");
  assert.equal(result.continuity.summary.queuePressure, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "device_bridge.operations_continuity.read");
  assert.equal(auditEvents[0].metadata.status, "ready");
  assert.equal(auditEvents[0].metadata.queuePressure, 0);
});
