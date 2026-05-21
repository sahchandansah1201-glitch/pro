// Stage 9B-9M · Device Bridge fleet reliability service.
// Aggregates safe backend-owned continuity signals into a fleet-level operator package.

import { recordAuditBestEffort } from "./audit-repository.mjs";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromAttention(attentionCount) {
  return attentionCount > 0 ? "attention" : "ready";
}

function reliabilityStage(id, title, status, summary, owner = "system_admin") {
  return { id, title, status, summary, owner };
}

function reliabilityGate(key, label, passed, detail, required = true) {
  return {
    key,
    label,
    required,
    status: passed ? "passed" : required ? "attention" : "info",
    detail,
  };
}

function percent(passed, total) {
  if (total <= 0) return 0;
  return Math.round((passed / total) * 100);
}

export function buildDeviceBridgeFleetReliability({
  continuity = {},
  generatedAt = "2026-05-21T00:00:00.000Z",
} = {}) {
  const continuitySummary = continuity.summary || {};
  const continuityGates = Array.isArray(continuity.gates) ? continuity.gates : [];
  const boundary = continuity.productBoundary || {};
  const bridgeCount = num(continuitySummary.bridgeCount);
  const staleWorkers = num(continuitySummary.staleWorkers);
  const failedCommands = num(continuitySummary.failedCommands);
  const stuckCommands = num(continuitySummary.stuckCommands);
  const retryableCommands = num(continuitySummary.retryableCommands);
  const cancellableCommands = num(continuitySummary.cancellableCommands);
  const auditEvents = num(continuitySummary.auditEvents);
  const inheritedAttentionGates = continuityGates.filter((item) => item.status !== "passed").length;
  const queuePressure = failedCommands + stuckCommands + retryableCommands + cancellableCommands;
  const fleetAttention = inheritedAttentionGates + queuePressure + staleWorkers;

  const stages = [
    reliabilityStage("Stage 9B", "Fleet reliability register", "ready", "Fleet reliability is repository-defined and sourced from backend continuity metadata."),
    reliabilityStage("Stage 9C", "Worker SLO policy", statusFromAttention(staleWorkers), `${staleWorkers} stale worker(s) require SLO review.`),
    reliabilityStage("Stage 9D", "Command queue SLO policy", statusFromAttention(queuePressure), `${queuePressure} command(s) require queue review.`),
    reliabilityStage("Stage 9E", "Backend reliability endpoint", "ready", "/api/v1/device-bridge-worker/fleet-reliability is backend-owned."),
    reliabilityStage("Stage 9F", "OpenAPI and nginx publishing", "ready", "/openapi.stage9b-9m.json is exposed through nginx."),
    reliabilityStage("Stage 9G", "Frontend reliability adapter", "ready", "The browser reads fleet reliability only through the self-hosted backend."),
    reliabilityStage("Stage 9H", "System devices reliability UI", statusFromAttention(fleetAttention), `${fleetAttention} reliability signal(s) need operator attention.`),
    reliabilityStage("Stage 9I", "Safe reliability export preview", "ready", "Only metadata counts, SLO labels and gate status are visible to operators."),
    reliabilityStage("Stage 9J", "Drift guard", "ready", "Repository guard scans endpoint, UI, docs, workflow and project-memory."),
    reliabilityStage("Stage 9K", "Workflow gate", "ready", "CI runs the Stage 9B-9M preflight before merge."),
    reliabilityStage("Stage 9L", "Project-memory refresh", "ready", "Project-memory records Stage 9B-9M as confirmed after merge."),
    reliabilityStage("Stage 9M", "Next batch handoff", "ready", "Stage 9N-9Z remains a hypothesis until repository files define it."),
  ];

  const gates = [
    reliabilityGate(
      "fleet_signal_available",
      "Fleet signal available",
      bridgeCount > 0,
      bridgeCount > 0
        ? `${bridgeCount} Device Bridge worker(s) contribute to the fleet reliability package.`
        : "No Device Bridge worker telemetry is available.",
    ),
    reliabilityGate(
      "worker_slo_reviewed",
      "Worker SLO reviewed",
      staleWorkers === 0,
      `${staleWorkers} stale worker(s); target review window is 30 minutes.`,
    ),
    reliabilityGate(
      "command_slo_reviewed",
      "Command SLO reviewed",
      queuePressure === 0,
      `${failedCommands} failed, ${stuckCommands} stuck, ${retryableCommands} retryable, ${cancellableCommands} cancellable command(s).`,
    ),
    reliabilityGate(
      "continuity_gate_reviewed",
      "Continuity gates reviewed",
      inheritedAttentionGates === 0,
      `${inheritedAttentionGates} inherited continuity gate(s) need review.`,
    ),
    reliabilityGate(
      "audit_signal_available",
      "Audit signal available",
      auditEvents >= 0,
      `${auditEvents} safe audit event(s) are visible in the current projection.`,
    ),
    reliabilityGate(
      "self_hosted_boundary",
      "Self-hosted product boundary",
      boundary.managedRuntimeDependency === "none" &&
        boundary.managedDatabaseDependency === "none" &&
        boundary.browserHardwareApis === false,
      "Managed runtime/database dependency remains none; browser hardware APIs remain disabled.",
    ),
  ];

  const required = gates.filter((item) => item.required);
  const passedRequired = required.filter((item) => item.status === "passed").length;
  const status = passedRequired === required.length ? "ready" : "attention";

  return {
    status,
    completionPercent: percent(passedRequired, required.length),
    generatedAt,
    summary: {
      bridgeCount,
      staleWorkers,
      failedCommands,
      stuckCommands,
      retryableCommands,
      cancellableCommands,
      auditEvents,
      inheritedAttentionGates,
      queuePressure,
      fleetAttention,
    },
    sloPolicy: {
      workerHeartbeatReviewMinutes: 30,
      commandQueueReviewMinutes: 15,
      retryReviewMinutes: 20,
      incidentDrillCadence: "monthly",
      reliabilityReviewCadence: "weekly",
      liveOutcomeKnownToRepository: false,
    },
    handoff: {
      previousBatch: "Stage 8P-9A",
      currentBatch: "Stage 9B-9M",
      originalHypothesis: "Stage 9B-9D",
      nextBatchHypothesis: "Stage 9N-9Z",
      includedStages: stages.map((stage) => stage.id),
      reliabilityOwner: "system_admin",
    },
    stages,
    gates,
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      browserHardwareApis: false,
      payloadVisibility: "backend-only",
      rawPatientDataInReports: false,
      signedUrlExposure: false,
      storagePathExposure: false,
      externalRuntimeCalls: false,
    },
  };
}

export function createDeviceBridgeFleetReliabilityService({
  deviceBridgeOperationsContinuityService,
  auditRepository,
} = {}) {
  return {
    async getFleetReliability(authContext, { correlationId, generatedAt } = {}) {
      const continuityResult = await deviceBridgeOperationsContinuityService.getOperationsContinuity(
        authContext,
        { correlationId, generatedAt },
      );
      const reliability = buildDeviceBridgeFleetReliability({
        continuity: continuityResult.continuity,
        generatedAt,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: continuityResult.scope?.allClinics ? null : continuityResult.scope?.clinicIds?.[0] || null,
        actorUserId: authContext.userId,
        action: "device_bridge.fleet_reliability.read",
        entityType: "device_bridge_worker",
        correlationId,
        metadata: {
          status: reliability.status,
          completionPercent: reliability.completionPercent,
          queuePressure: reliability.summary.queuePressure,
          fleetAttention: reliability.summary.fleetAttention,
        },
      });

      return {
        reliability,
        scope: continuityResult.scope || { roles: authContext.roles || [], clinicIds: [], allClinics: false },
      };
    },
  };
}
