// Stage 8J-8L · Device Bridge production readiness service.
// Aggregates existing PostgreSQL Device Bridge signals without exposing raw worker payloads.

import { recordAuditBestEffort } from "./audit-repository.mjs";

function num(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function gate(key, label, passed, detail, required = true) {
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

export function buildDeviceBridgeProductionReadiness({
  telemetry = {},
  hardening = {},
  recovery = {},
  audit = {},
} = {}) {
  const telemetrySummary = telemetry.summary || {};
  const hardeningSummary = hardening.summary || {};
  const recoverySummary = recovery.summary || {};
  const auditSummary = audit.summary || {};
  const auditPolicy = audit.policy || {};

  const bridgeCount = num(telemetrySummary.bridgeCount);
  const offlineWorkers = num(telemetrySummary.offlineWorkers);
  const degradedWorkers = num(telemetrySummary.degradedWorkers);
  const queuedCommands = num(telemetrySummary.queuedCommands);
  const failedCommands = num(telemetrySummary.failedCommands);
  const staleWorkers = num(hardeningSummary.staleWorkers);
  const maxQueueAgeSeconds = num(hardeningSummary.maxQueueAgeSeconds);
  const stuckCommands = num(recoverySummary.stuckCommands);
  const retryableCommands = num(recoverySummary.retryableCommands);
  const cancellableCommands = num(recoverySummary.cancellableCommands);
  const auditEvents = num(auditSummary.totalEvents);

  const gates = [
    gate(
      "worker_telemetry",
      "Worker heartbeat telemetry",
      bridgeCount > 0,
      bridgeCount > 0
        ? `${bridgeCount} bridge worker(s) visible in PostgreSQL telemetry.`
        : "No Device Bridge worker heartbeat telemetry is visible yet.",
    ),
    gate(
      "worker_health",
      "Worker health pressure",
      offlineWorkers === 0 && staleWorkers === 0,
      `${offlineWorkers} offline worker(s), ${degradedWorkers} degraded worker(s), ${staleWorkers} stale worker(s).`,
    ),
    gate(
      "command_queue",
      "Command queue pressure",
      stuckCommands === 0 && failedCommands === 0,
      `${queuedCommands} queued, ${failedCommands} failed, ${stuckCommands} stuck; max queue age ${maxQueueAgeSeconds}s.`,
    ),
    gate(
      "command_recovery",
      "Command recovery policy",
      retryableCommands === 0 && cancellableCommands === 0,
      `${retryableCommands} retryable and ${cancellableCommands} cancellable command(s) require operator review.`,
      false,
    ),
    gate(
      "audit_replay_policy",
      "Audit and replay visibility",
      auditPolicy.payloadVisibility === "backend-only",
      `Audit events: ${auditEvents}; payload visibility: ${auditPolicy.payloadVisibility || "unknown"}.`,
    ),
    gate(
      "safe_export",
      "Safe audit export",
      true,
      "Command audit export remains metadata-only; raw command payloads and results stay backend-side.",
    ),
  ];

  const required = gates.filter((item) => item.required);
  const passedRequired = required.filter((item) => item.status === "passed").length;
  const status = passedRequired === required.length ? "ready" : "attention";

  return {
    status,
    completionPercent: percent(passedRequired, required.length),
    summary: {
      bridgeCount,
      onlineWorkers: num(telemetrySummary.onlineWorkers),
      degradedWorkers,
      offlineWorkers,
      staleWorkers,
      queuedCommands,
      failedCommands,
      stuckCommands,
      retryableCommands,
      cancellableCommands,
      auditEvents,
      maxQueueAgeSeconds,
    },
    gates,
    policy: {
      workerTelemetrySource: "/api/v1/device-bridge-worker/status",
      hardeningSource: "/api/v1/device-bridge-worker/hardening",
      recoverySource: "/api/v1/device-bridge-worker/recovery",
      auditSource: "/api/v1/device-bridge-worker/audit",
      auditExportSource: "/api/v1/device-bridge-worker/audit/export",
      hardwareBoundary: "local Device Bridge worker only",
      payloadVisibility: "backend-only",
      browserHardwareApis: false,
      managedRuntimeDependency: "none",
      managedDatabaseDependency: "none",
    },
  };
}

export function createDeviceBridgeProductionReadinessService({
  deviceBridgeWorkerService,
  auditRepository,
} = {}) {
  return {
    async getProductionReadiness(authContext, { correlationId } = {}) {
      const [telemetry, hardening, recovery, audit] = await Promise.all([
        deviceBridgeWorkerService.listWorkerTelemetry(
          authContext,
          new URLSearchParams({ workerStatus: "all", commandStatus: "all", limit: "25" }),
          { correlationId },
        ),
        deviceBridgeWorkerService.listWorkerHardening(
          authContext,
          new URLSearchParams({ staleAfterMinutes: "10", retentionDays: "30", limit: "25" }),
          { correlationId },
        ),
        deviceBridgeWorkerService.listWorkerRecovery(
          authContext,
          new URLSearchParams({ staleAfterMinutes: "10", leaseTtlSeconds: "90", limit: "25" }),
          { correlationId },
        ),
        deviceBridgeWorkerService.listWorkerCommandAudit(
          authContext,
          new URLSearchParams({ action: "all", status: "all", limit: "25" }),
          { correlationId },
        ),
      ]);

      const readiness = buildDeviceBridgeProductionReadiness({
        telemetry,
        hardening,
        recovery,
        audit,
      });

      await recordAuditBestEffort(auditRepository, {
        clinicId: telemetry.scope?.allClinics ? null : telemetry.scope?.clinicIds?.[0] || null,
        actorUserId: authContext.userId,
        action: "device_bridge.production_readiness.read",
        entityType: "device_bridge_worker",
        correlationId,
        metadata: {
          status: readiness.status,
          completionPercent: readiness.completionPercent,
          bridgeCount: readiness.summary.bridgeCount,
          attentionGateCount: readiness.gates.filter((item) => item.status !== "passed").length,
        },
      });

      return {
        readiness,
        scope: telemetry.scope || { roles: authContext.roles || [], clinicIds: [], allClinics: false },
      };
    },
  };
}
