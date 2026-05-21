import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeviceBridgeLifecycleAssurance,
  createDeviceBridgeLifecycleAssuranceService,
} from "./device-bridge-lifecycle-assurance-service.mjs";

test("Stage 9N-9Z lifecycle assurance summarizes maintenance and retention pressure safely", () => {
  const assurance = buildDeviceBridgeLifecycleAssurance({
    generatedAt: "2026-05-21T12:00:00.000Z",
    reliability: {
      status: "attention",
      completionPercent: 67,
      summary: {
        bridgeCount: 3,
        staleWorkers: 1,
        failedCommands: 1,
        stuckCommands: 1,
        retryableCommands: 2,
        cancellableCommands: 0,
        auditEvents: 15,
        inheritedAttentionGates: 1,
        queuePressure: 4,
        fleetAttention: 6,
      },
      sloPolicy: {
        workerHeartbeatReviewMinutes: 30,
        commandQueueReviewMinutes: 15,
      },
      handoff: {
        currentBatch: "Stage 9B-9M",
      },
      gates: [{ status: "passed" }, { status: "attention" }],
      productBoundary: {
        managedRuntimeDependency: "none",
        managedDatabaseDependency: "none",
        browserHardwareApis: false,
        payloadVisibility: "backend-only",
      },
    },
  });

  assert.equal(assurance.status, "attention");
  assert.equal(assurance.summary.maintenanceDue, true);
  assert.equal(assurance.summary.retentionReviewDue, true);
  assert.equal(assurance.summary.assuranceDebt, 7);
  assert.equal(assurance.summary.upgradePressure, 2);
  assert.equal(assurance.stages.length, 13);
  assert.equal(assurance.handoff.previousBatch, "Stage 9B-9M");
  assert.equal(assurance.handoff.currentBatch, "Stage 9N-9Z");
  assert.equal(assurance.handoff.nextBatchHypothesis, "Stage 10A-10L");
  assert.equal(assurance.productBoundary.managedRuntimeDependency, "none");
  assert.equal(assurance.productBoundary.managedDatabaseDependency, "none");
  assert.equal(assurance.productBoundary.payloadVisibility, "backend-only");
  assert.equal(JSON.stringify(assurance).includes("payload_json"), false);
  assert.equal(JSON.stringify(assurance).includes("signed_url"), false);
  assert.equal(JSON.stringify(assurance).includes("patient_full_name"), false);
});

test("Stage 9N-9Z service reuses fleet reliability and writes safe audit metadata", async () => {
  const auditEvents = [];
  const service = createDeviceBridgeLifecycleAssuranceService({
    deviceBridgeFleetReliabilityService: {
      async getFleetReliability() {
        return {
          reliability: {
            status: "ready",
            completionPercent: 100,
            summary: {
              bridgeCount: 2,
              staleWorkers: 0,
              failedCommands: 0,
              stuckCommands: 0,
              retryableCommands: 0,
              cancellableCommands: 0,
              auditEvents: 5,
              inheritedAttentionGates: 0,
              queuePressure: 0,
              fleetAttention: 0,
            },
            sloPolicy: {
              workerHeartbeatReviewMinutes: 30,
              commandQueueReviewMinutes: 15,
            },
            handoff: {
              currentBatch: "Stage 9B-9M",
            },
            gates: [{ status: "passed" }],
            productBoundary: {
              managedRuntimeDependency: "none",
              managedDatabaseDependency: "none",
              browserHardwareApis: false,
              payloadVisibility: "backend-only",
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

  const result = await service.getLifecycleAssurance(
    { userId: "u-admin", roles: ["system_admin"] },
    { correlationId: "corr-9n", generatedAt: "2026-05-21T12:00:00.000Z" },
  );

  assert.equal(result.assurance.status, "ready");
  assert.equal(result.assurance.summary.assuranceDebt, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].action, "device_bridge.lifecycle_assurance.read");
  assert.equal(auditEvents[0].metadata.status, "ready");
  assert.equal(auditEvents[0].metadata.maintenanceDue, false);
  assert.equal(auditEvents[0].metadata.retentionReviewDue, false);
});
