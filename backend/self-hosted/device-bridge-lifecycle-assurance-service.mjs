// Stage 9N-9Z · Device Bridge lifecycle assurance service.
// Converts fleet reliability into an operator-safe closure package for maintenance,
// upgrade posture, audit retention and next-cycle handoff.

import { recordAuditBestEffort } from "./audit-repository.mjs";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusFromAttention(attentionCount) {
  return attentionCount > 0 ? "attention" : "ready";
}

function assuranceStage(id, title, status, summary, owner = "system_admin") {
  return { id, title, status, summary, owner };
}

function assuranceGate(key, label, passed, detail, required = true) {
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

export function buildDeviceBridgeLifecycleAssurance({
  reliability = {},
  generatedAt = "2026-05-21T00:00:00.000Z",
} = {}) {
  const summary = reliability.summary || {};
  const gates = Array.isArray(reliability.gates) ? reliability.gates : [];
  const productBoundary = reliability.productBoundary || {};
  const reliabilityHandoff = reliability.handoff || {};
  const sloPolicy = reliability.sloPolicy || {};

  const bridgeCount = num(summary.bridgeCount);
  const staleWorkers = num(summary.staleWorkers);
  const queuePressure = num(summary.queuePressure);
  const fleetAttention = num(summary.fleetAttention);
  const auditEvents = num(summary.auditEvents);
  const inheritedAttentionGates = num(summary.inheritedAttentionGates);
  const failedCommands = num(summary.failedCommands);
  const stuckCommands = num(summary.stuckCommands);
  const retryableCommands = num(summary.retryableCommands);
  const cancellableCommands = num(summary.cancellableCommands);
  const assuranceDebt = fleetAttention + inheritedAttentionGates;
  const maintenanceDue = staleWorkers > 0 || queuePressure > 0 || inheritedAttentionGates > 0;
  const retentionReviewDue = auditEvents > 0 && (failedCommands > 0 || retryableCommands > 0 || cancellableCommands > 0);
  const upgradePressure = staleWorkers + stuckCommands;

  const stages = [
    assuranceStage("Stage 9N", "Lifecycle assurance register", "ready", "Lifecycle assurance is repository-defined and derived from backend fleet reliability metadata."),
    assuranceStage("Stage 9O", "Maintenance window policy", statusFromAttention(maintenanceDue ? 1 : 0), maintenanceDue ? "A maintenance review window is required before closure." : "No maintenance review window is currently required."),
    assuranceStage("Stage 9P", "Worker upgrade posture", statusFromAttention(upgradePressure), `${upgradePressure} worker/command signal(s) influence upgrade posture.`),
    assuranceStage("Stage 9Q", "Audit retention closure", statusFromAttention(retentionReviewDue ? 1 : 0), retentionReviewDue ? "Audit retention evidence should be reviewed externally." : "No retention exception is visible in repository metadata."),
    assuranceStage("Stage 9R", "Backend assurance endpoint", "ready", "/api/v1/device-bridge-worker/lifecycle-assurance is backend-owned."),
    assuranceStage("Stage 9S", "OpenAPI and nginx publishing", "ready", "/openapi.stage9n-9z.json is exposed through nginx."),
    assuranceStage("Stage 9T", "Frontend assurance adapter", "ready", "The browser reads assurance only through the self-hosted backend."),
    assuranceStage("Stage 9U", "System devices assurance UI", statusFromAttention(assuranceDebt), `${assuranceDebt} lifecycle assurance signal(s) need review.`),
    assuranceStage("Stage 9V", "Safe closure export preview", "ready", "Only safe lifecycle metadata, policy labels and gate status are visible."),
    assuranceStage("Stage 9W", "Drift guard", "ready", "Repository guard scans endpoint, UI, docs, workflow and project-memory."),
    assuranceStage("Stage 9X", "Workflow gate", "ready", "CI runs the Stage 9N-9Z preflight before merge."),
    assuranceStage("Stage 9Y", "Project-memory refresh", "ready", "Project-memory records Stage 9N-9Z as confirmed after merge."),
    assuranceStage("Stage 9Z", "Next batch handoff", "ready", "Stage 10A-10L remains a hypothesis until repository files define it."),
  ];

  const lifecycleGates = [
    assuranceGate(
      "fleet_reliability_available",
      "Fleet reliability available",
      bridgeCount > 0,
      bridgeCount > 0
        ? `${bridgeCount} Device Bridge worker(s) are visible in the fleet reliability package.`
        : "No Device Bridge worker telemetry is visible.",
    ),
    assuranceGate(
      "maintenance_window_reviewed",
      "Maintenance window reviewed",
      !maintenanceDue,
      maintenanceDue
        ? `${staleWorkers} stale worker(s), ${queuePressure} queued/recovery command signal(s), ${inheritedAttentionGates} inherited gate(s).`
        : "No maintenance window is currently required by safe metadata.",
    ),
    assuranceGate(
      "upgrade_posture_reviewed",
      "Worker upgrade posture reviewed",
      upgradePressure === 0,
      `${staleWorkers} stale worker(s) and ${stuckCommands} stuck command(s) influence upgrade posture.`,
    ),
    assuranceGate(
      "audit_retention_reviewed",
      "Audit retention reviewed",
      !retentionReviewDue,
      retentionReviewDue
        ? `${auditEvents} audit event(s) exist while command pressure is non-zero.`
        : `${auditEvents} audit event(s); no retention exception is visible.`,
    ),
    assuranceGate(
      "closure_debt_reviewed",
      "Closure debt reviewed",
      assuranceDebt === 0,
      `${assuranceDebt} lifecycle assurance signal(s) remain open.`,
    ),
    assuranceGate(
      "self_hosted_boundary",
      "Self-hosted product boundary",
      productBoundary.managedRuntimeDependency === "none" &&
        productBoundary.managedDatabaseDependency === "none" &&
        productBoundary.browserHardwareApis === false &&
        productBoundary.payloadVisibility === "backend-only",
      "Managed runtime/database dependency remains none; browser hardware APIs remain disabled; payload visibility remains backend-only.",
    ),
  ];

  const required = lifecycleGates.filter((item) => item.required);
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
      queuePressure,
      fleetAttention,
      inheritedAttentionGates,
      auditEvents,
      assuranceDebt,
      upgradePressure,
      maintenanceDue,
      retentionReviewDue,
    },
    lifecyclePolicy: {
      maintenanceReviewCadence: "weekly",
      workerUpgradeReviewCadence: "monthly",
      auditRetentionReviewDays: 90,
      closureEvidenceStorage: "external",
      liveOutcomeKnownToRepository: false,
      workerHeartbeatReviewMinutes: num(sloPolicy.workerHeartbeatReviewMinutes || 30),
      commandQueueReviewMinutes: num(sloPolicy.commandQueueReviewMinutes || 15),
    },
    handoff: {
      previousBatch: reliabilityHandoff.currentBatch || "Stage 9B-9M",
      currentBatch: "Stage 9N-9Z",
      originalHypothesis: "Stage 9N-9Z",
      nextBatchHypothesis: "Stage 10A-10L",
      includedStages: stages.map((stage) => stage.id),
      assuranceOwner: "system_admin",
      promptOnlyAfterMergeToMain: true,
    },
    stages,
    gates: lifecycleGates,
    inheritedReliability: {
      status: reliability.status || "attention",
      completionPercent: num(reliability.completionPercent),
      gateCount: gates.length,
      attentionGateCount: gates.filter((gate) => gate.status !== "passed").length,
    },
    productBoundary: {
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
      browserHardwareApis: false,
      payloadVisibility: "backend-only",
      rawPatientDataInReports: false,
      signedUrlExposure: false,
      storagePathExposure: false,
      externalRuntimeCalls: false,
      liveSecretsInReports: false,
    },
  };
}

export function createDeviceBridgeLifecycleAssuranceService({
  deviceBridgeFleetReliabilityService,
  auditRepository,
} = {}) {
  return {
    async getLifecycleAssurance(authContext, { correlationId, generatedAt } = {}) {
      const reliabilityResult = await deviceBridgeFleetReliabilityService.getFleetReliability(
        authContext,
        { correlationId, generatedAt },
      );
      const assurance = buildDeviceBridgeLifecycleAssurance({
        reliability: reliabilityResult.reliability,
        generatedAt,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: reliabilityResult.scope?.allClinics ? null : reliabilityResult.scope?.clinicIds?.[0] || null,
        actorUserId: authContext.userId,
        action: "device_bridge.lifecycle_assurance.read",
        entityType: "device_bridge_worker",
        correlationId,
        metadata: {
          status: assurance.status,
          completionPercent: assurance.completionPercent,
          assuranceDebt: assurance.summary.assuranceDebt,
          maintenanceDue: assurance.summary.maintenanceDue,
          retentionReviewDue: assurance.summary.retentionReviewDue,
        },
      });

      return {
        assurance,
        scope: reliabilityResult.scope || { roles: authContext.roles || [], clinicIds: [], allClinics: false },
      };
    },
  };
}
