import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildDeviceBridgeProductionReadiness,
  createDeviceBridgeProductionReadinessService,
} from "./device-bridge-production-readiness-service.mjs";

const AUTH = {
  userId: "10000000-0000-4000-8000-000000000101",
  roles: ["system_admin"],
  clinicIds: ["10000000-0000-4000-8000-000000000001"],
};

test("Stage 8J-8L readiness summarizes worker pressure without raw payloads", () => {
  const readiness = buildDeviceBridgeProductionReadiness({
    telemetry: {
      summary: {
        bridgeCount: 2,
        onlineWorkers: 2,
        degradedWorkers: 0,
        offlineWorkers: 0,
        queuedCommands: 1,
        failedCommands: 0,
      },
    },
    hardening: { summary: { staleWorkers: 0, maxQueueAgeSeconds: 20 } },
    recovery: { summary: { stuckCommands: 0, retryableCommands: 0, cancellableCommands: 0 } },
    audit: { summary: { totalEvents: 12 }, policy: { payloadVisibility: "backend-only" } },
  });

  assert.equal(readiness.status, "ready");
  assert.equal(readiness.completionPercent, 100);
  assert.equal(readiness.policy.managedRuntimeDependency, "none");
  assert.equal(readiness.policy.browserHardwareApis, false);
  assert.doesNotMatch(JSON.stringify(readiness), /payload_json|result_json|worker_metadata_json|token|secret|signed_url|storage_object_path/i);
});

test("Stage 8J-8L readiness marks attention gates when telemetry is unsafe", () => {
  const readiness = buildDeviceBridgeProductionReadiness({
    telemetry: { summary: { bridgeCount: 1, offlineWorkers: 1, failedCommands: 2 } },
    hardening: { summary: { staleWorkers: 1, maxQueueAgeSeconds: 900 } },
    recovery: { summary: { stuckCommands: 1, retryableCommands: 2, cancellableCommands: 1 } },
    audit: { summary: { totalEvents: 0 }, policy: { payloadVisibility: "backend-only" } },
  });

  assert.equal(readiness.status, "attention");
  assert.ok(readiness.completionPercent < 100);
  assert.ok(readiness.gates.some((item) => item.key === "worker_health" && item.status === "attention"));
});

test("Stage 8J-8L service aggregates existing worker services and writes safe audit metadata", async () => {
  const calls = [];
  const auditEvents = [];
  const service = createDeviceBridgeProductionReadinessService({
    deviceBridgeWorkerService: {
      async listWorkerTelemetry(authContext, searchParams) {
        calls.push(["telemetry", searchParams.toString()]);
        return {
          summary: { bridgeCount: 1, onlineWorkers: 1, failedCommands: 0 },
          scope: { roles: authContext.roles, clinicIds: authContext.clinicIds, allClinics: false },
        };
      },
      async listWorkerHardening(_authContext, searchParams) {
        calls.push(["hardening", searchParams.toString()]);
        return { summary: { staleWorkers: 0, maxQueueAgeSeconds: 10 } };
      },
      async listWorkerRecovery(_authContext, searchParams) {
        calls.push(["recovery", searchParams.toString()]);
        return { summary: { stuckCommands: 0, retryableCommands: 0, cancellableCommands: 0 } };
      },
      async listWorkerCommandAudit(_authContext, searchParams) {
        calls.push(["audit", searchParams.toString()]);
        return { summary: { totalEvents: 3 }, policy: { payloadVisibility: "backend-only" } };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-stage8j" };
      },
    },
  });

  const result = await service.getProductionReadiness(AUTH, { correlationId: "corr-stage8j" });

  assert.equal(result.readiness.status, "ready");
  assert.deepEqual(calls.map(([name]) => name), ["telemetry", "hardening", "recovery", "audit"]);
  assert.equal(auditEvents[0].action, "device_bridge.production_readiness.read");
  assert.deepEqual(auditEvents[0].metadata, {
    status: "ready",
    completionPercent: 100,
    bridgeCount: 1,
    attentionGateCount: 0,
  });
});
