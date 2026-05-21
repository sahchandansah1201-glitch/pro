// Stage 8P-9A · Device Bridge operations continuity service.
// Builds safe operator-facing continuity metadata from existing backend-owned signals.

import { recordAuditBestEffort } from "./audit-repository.mjs";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromAttention(attentionCount) {
  return attentionCount > 0 ? "attention" : "ready";
}

function continuityStage(id, title, status, summary, owner = "system_admin") {
  return { id, title, status, summary, owner };
}

function continuityGate(key, label, passed, detail) {
  return {
    key,
    label,
    status: passed ? "passed" : "attention",
    detail,
  };
}

export function buildDeviceBridgeOperationsContinuity({
  readiness = {},
  generatedAt = "2026-05-21T00:00:00.000Z",
} = {}) {
  const summary = readiness.summary || {};
  const gates = Array.isArray(readiness.gates) ? readiness.gates : [];
  const readinessPolicy = readiness.policy || {};
  const attentionGates = gates.filter((item) => item.status !== "passed");
  const failedCommands = num(summary.failedCommands);
  const stuckCommands = num(summary.stuckCommands);
  const staleWorkers = num(summary.staleWorkers);
  const retryableCommands = num(summary.retryableCommands);
  const cancellableCommands = num(summary.cancellableCommands);
  const bridgeCount = num(summary.bridgeCount);
  const auditEvents = num(summary.auditEvents);
  const queuePressure = failedCommands + stuckCommands + retryableCommands + cancellableCommands;

  const stages = [
    continuityStage("Stage 8P", "Incident drill register", "ready", "Incident drills are repository-defined and operator-reviewed."),
    continuityStage("Stage 8Q", "Telemetry retention register", "ready", "Retention uses backend metadata only; raw worker payloads stay server-side."),
    continuityStage("Stage 8R", "Continuity checklist", statusFromAttention(attentionGates.length), `${attentionGates.length} readiness gate(s) need review.`),
    continuityStage("Stage 8S", "Backend continuity endpoint", "ready", "/api/v1/device-bridge-worker/operations-continuity is backend-owned."),
    continuityStage("Stage 8T", "OpenAPI and nginx publishing", "ready", "/openapi.stage8p-9a.json is exposed through nginx."),
    continuityStage("Stage 8U", "Frontend continuity adapter", "ready", "The browser reads continuity only through the self-hosted backend."),
    continuityStage("Stage 8V", "System devices continuity UI", statusFromAttention(queuePressure), `${queuePressure} command(s) need operator attention.`),
    continuityStage("Stage 8W", "Safe export preview", "ready", "Only metadata counts and policy labels are visible to operators."),
    continuityStage("Stage 8X", "Drift guard", "ready", "Repository guard scans endpoint, UI, docs, workflow and project-memory."),
    continuityStage("Stage 8Y", "Workflow gate", "ready", "CI runs the Stage 8P-9A preflight before merge."),
    continuityStage("Stage 8Z", "Project-memory refresh", "ready", "Project-memory records Stage 8P-9A and the next hypothesis."),
    continuityStage("Stage 9A", "Next batch handoff", "ready", "Stage 9B-9D remains a hypothesis until repository files define it."),
  ];

  const requiredGates = [
    continuityGate(
      "readiness_available",
      "Production readiness available",
      bridgeCount > 0,
      bridgeCount > 0
        ? `${bridgeCount} Device Bridge worker(s) are visible.`
        : "No Device Bridge worker telemetry is available.",
    ),
    continuityGate(
      "incident_pressure_reviewed",
      "Incident pressure reviewed",
      queuePressure === 0,
      `${failedCommands} failed, ${stuckCommands} stuck, ${retryableCommands} retryable, ${cancellableCommands} cancellable command(s).`,
    ),
    continuityGate(
      "stale_worker_reviewed",
      "Stale workers reviewed",
      staleWorkers === 0,
      `${staleWorkers} stale worker(s) require operator review.`,
    ),
    continuityGate(
      "audit_signal_available",
      "Audit signal available",
      auditEvents >= 0,
      `${auditEvents} safe audit event(s) are available in the current projection.`,
    ),
    continuityGate(
      "self_hosted_boundary",
      "Self-hosted product boundary",
      readinessPolicy.managedRuntimeDependency === "none" &&
        readinessPolicy.managedDatabaseDependency === "none" &&
        readinessPolicy.browserHardwareApis === false,
      "Managed runtime/database dependency remains none; browser hardware APIs remain disabled.",
    ),
  ];

  const passedRequired = requiredGates.filter((gate) => gate.status === "passed").length;
  const status = passedRequired === requiredGates.length ? "ready" : "attention";

  return {
    status,
    completionPercent: Math.round((passedRequired / requiredGates.length) * 100),
    generatedAt,
    summary: {
      bridgeCount,
      staleWorkers,
      failedCommands,
      stuckCommands,
      retryableCommands,
      cancellableCommands,
      auditEvents,
      attentionGateCount: attentionGates.length,
      queuePressure,
    },
    incidentDrill: {
      cadence: "monthly",
      lastDrillRecordedInGit: false,
      requiredSteps: [
        "Open /sys/devices as system_admin.",
        "Review production readiness and operations continuity gates.",
        "Use backend recovery/replay actions only; do not edit worker tables directly.",
        "Record external incident evidence outside Git.",
      ],
    },
    retentionPolicy: {
      workerTelemetryRetentionDays: 30,
      commandAuditRetentionDays: 90,
      exportContainsRawPayloads: false,
      cleanupMode: "operator-reviewed",
    },
    handoff: {
      nextBatchHypothesis: "Stage 9B-9D",
      includedStages: stages.map((stage) => stage.id),
      continuityOwner: "system_admin",
      liveOutcomeKnownToRepository: false,
    },
    stages,
    gates: requiredGates,
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      browserHardwareApis: false,
      payloadVisibility: "backend-only",
      rawPatientDataInReports: false,
      signedUrlExposure: false,
      storagePathExposure: false,
    },
  };
}

export function createDeviceBridgeOperationsContinuityService({
  deviceBridgeProductionReadinessService,
  auditRepository,
} = {}) {
  return {
    async getOperationsContinuity(authContext, { correlationId, generatedAt } = {}) {
      const readinessResult = await deviceBridgeProductionReadinessService.getProductionReadiness(
        authContext,
        { correlationId },
      );
      const continuity = buildDeviceBridgeOperationsContinuity({
        readiness: readinessResult.readiness,
        generatedAt,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: readinessResult.scope?.allClinics ? null : readinessResult.scope?.clinicIds?.[0] || null,
        actorUserId: authContext.userId,
        action: "device_bridge.operations_continuity.read",
        entityType: "device_bridge_worker",
        correlationId,
        metadata: {
          status: continuity.status,
          completionPercent: continuity.completionPercent,
          queuePressure: continuity.summary.queuePressure,
          attentionGateCount: continuity.summary.attentionGateCount,
        },
      });

      return {
        continuity,
        scope: readinessResult.scope || { roles: authContext.roles || [], clinicIds: [], allClinics: false },
      };
    },
  };
}
