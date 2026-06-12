import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import SysDevicesPage from "./SysDevicesPage";
import { pollBackoffLabel, recoveryStateLabel, sysDeviceStatusLabel } from "./sysDeviceLabels";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
  SELF_HOSTED_API_USER_KEY,
} from "@/lib/self-hosted-api-session";

function renderPage() {
  return render(
    <MemoryRouter>
      <SysDevicesPage />
    </MemoryRouter>,
  );
}

function writeLiveSession() {
  window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
  window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "jwt-device-test");
  window.localStorage.setItem(
    SELF_HOSTED_API_USER_KEY,
    JSON.stringify({ id: "u-sys", displayName: "System Admin", roles: ["system_admin"] }),
  );
}

describe("SysDevicesPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps unknown service enum values to a safe Russian fallback", () => {
    expect(sysDeviceStatusLabel("raw_failed_state")).toBe("неизвестно");
    expect(pollBackoffLabel("raw_backoff_state")).toBe("неизвестно");
    expect(recoveryStateLabel("raw_recovery_state")).toBe("неизвестно");
  });

  it("renders demo registry without backend calls when self-hosted session is missing", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    renderPage();

    expect(screen.getByText(/Учебный режим\. Рабочие роли, аудит, ключи и мост устройств/)).toBeInTheDocument();
    expect(screen.getAllByText("DermLite DL5").length).toBeGreaterThan(0);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads self-hosted bridge and device registry with bearer token", async () => {
    writeLiveSession();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer jwt-device-test");
      if (url.includes("/api/v1/device-bridges/br-uuid/commands")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            command: { id: "cmd-bridge", commandType: "bridge_health_check", status: "queued" },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/devices/dev-uuid/commands")) {
        expect(init?.method).toBe("POST");
        return new Response(
          JSON.stringify({
            command: { id: "cmd-device", commandType: "device_calibration_request", status: "queued", deviceId: "dev-uuid" },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/status")) {
        return new Response(
          JSON.stringify({
            stage: "4U",
            source: "postgres",
            summary: {
              bridgeCount: 1,
              onlineWorkers: 1,
              degradedWorkers: 0,
              offlineWorkers: 0,
              queuedCommands: 1,
              failedCommands: 1,
            },
            items: [
              {
                id: "br-uuid",
                clinicId: "clinic-1",
                bridgeCode: "br-live-01",
                hostName: "live-bridge",
                lanStatus: "online",
                workerStatus: "online",
                workerVersion: "stage4t-local-worker",
                workerLastSeenAt: "2026-05-14T08:02:00Z",
                queuedCount: 1,
                failedCount: 1,
              },
            ],
            commands: [
              {
                id: "cmd-live",
                clinicId: "clinic-1",
                bridgeId: "br-uuid",
                bridgeCode: "br-live-01",
                commandType: "bridge_health_check",
                status: "raw_failed_state",
                createdAt: "2026-05-14T08:01:00Z",
              },
            ],
            filters: { workerStatus: "all", commandStatus: "all", limit: 25 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/hardening")) {
        return new Response(
          JSON.stringify({
            stage: "4V",
            source: "postgres",
            summary: {
              staleWorkers: 1,
              retryingCommands: 2,
              rateLimitedCommands: 1,
              maxQueueAgeSeconds: 120,
              cleanupCandidates: 3,
            },
            policy: { staleAfterMinutes: 10, retentionDays: 30, pollBackoff: "linear-capped", maxPollLimit: 50 },
            items: [
              {
                id: "br-uuid",
                clinicId: "clinic-1",
                bridgeCode: "br-live-01",
                hostName: "live-bridge",
                workerStatus: "degraded",
                workerVersion: "stage4t-local-worker",
                stale: true,
                activeCommandCount: 3,
                retryingCommandCount: 2,
                rateLimitedCommandCount: 1,
                maxQueueAgeSeconds: 120,
              },
            ],
            filters: { staleAfterMinutes: 10, retentionDays: 30, limit: 25 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/recovery") || url.includes("/api/v1/device-bridge-worker/commands/cmd-retry/recovery")) {
        if (init?.method === "POST") {
          expect(init.body).toBe(JSON.stringify({ action: "reschedule", reason: "Повторная постановка из панели восстановления." }));
          return new Response(
            JSON.stringify({
              command: {
                id: "cmd-retry",
                clinicId: "clinic-1",
                bridgeId: "br-uuid",
                bridgeCode: "br-live-01",
                commandType: "bridge_health_check",
                status: "queued",
                attemptCount: 3,
                recoveryAction: "reschedule",
              },
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({
            stage: "4W",
            source: "postgres",
            summary: {
              stuckCommands: 1,
              expiredCommands: 0,
              leaseExpiredCommands: 1,
              retryableCommands: 1,
              cancellableCommands: 2,
            },
            policy: { staleAfterMinutes: 10, leaseTtlSeconds: 90, maxRecoveryBatch: 100, allowedActions: ["reschedule", "cancel"] },
            items: [
              {
                id: "cmd-retry",
                clinicId: "clinic-1",
                bridgeId: "br-uuid",
                bridgeCode: "br-live-01",
                commandType: "bridge_health_check",
                status: "failed",
                attemptCount: 3,
                recoveryState: "retryable_failed",
              },
            ],
            filters: { staleAfterMinutes: 10, leaseTtlSeconds: 90, limit: 25 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/commands/cmd-audit/replay")) {
        expect(init?.method).toBe("POST");
        expect(init.body).toBe(JSON.stringify({ reason: "Ручной повтор из панели журнала команд." }));
        return new Response(
          JSON.stringify({
            command: {
              id: "cmd-replay",
              clinicId: "clinic-1",
              bridgeId: "br-uuid",
              bridgeCode: "br-live-01",
              commandType: "bridge_health_check",
              status: "queued",
              replayOfCommandId: "cmd-audit",
              replayPolicy: "manual_system_admin",
            },
          }),
          { status: 202, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/audit/export")) {
        return new Response(
          JSON.stringify({
            stage: "4Y",
            source: "postgres",
            export: {
              format: "csv",
              mime: "text/csv;charset=utf-8",
              filename: "device-bridge-command-audit-all-all-1-rows.csv",
              rowCount: 1,
              content: '# stage,4Y\n"event_id","action"\n"audit-1","replay"',
              privacy: {
                payloadVisibility: "backend-only",
                excludedFieldCount: 3,
                exportedFieldSet: "safe-command-metadata-only",
              },
            },
            filters: { action: "all", status: "all", limit: 100 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/audit")) {
        return new Response(
          JSON.stringify({
            stage: "4X",
            source: "postgres",
            summary: {
              totalEvents: 3,
              replayEvents: 1,
              recoveryEvents: 1,
              affectedCommands: 2,
            },
            policy: {
              replayPolicy: "manual_system_admin",
              allowedReplayStatuses: ["completed", "failed", "cancelled"],
              allowedReplayCommandTypes: ["bridge_health_check", "device_calibration_request"],
              payloadVisibility: "backend_only",
            },
            items: [
              {
                id: "audit-1",
                clinicId: "clinic-1",
                action: "replay",
                commandId: "cmd-audit",
                bridgeId: "br-uuid",
                bridgeCode: "br-live-01",
                commandType: "bridge_health_check",
                status: "raw_audit_state",
                attemptCount: 3,
                lifecycleRevision: 4,
                replayPolicy: "manual_system_admin",
                createdAt: "2026-05-14T08:05:00Z",
                metadata_json: { secret: true },
                payload_json: { token: "hidden" },
              },
            ],
            filters: { action: "all", status: "all", limit: 25 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/production-readiness")) {
        return new Response(
          JSON.stringify({
            stage: "8J-8L",
            source: "postgres",
            readiness: {
              status: "attention",
              completionPercent: 80,
              summary: {
                bridgeCount: 1,
                onlineWorkers: 1,
                degradedWorkers: 0,
                offlineWorkers: 0,
                staleWorkers: 1,
                queuedCommands: 1,
                failedCommands: 1,
                stuckCommands: 1,
                retryableCommands: 1,
                cancellableCommands: 2,
                auditEvents: 3,
                maxQueueAgeSeconds: 120,
              },
              gates: [
                {
                  key: "worker_telemetry",
                  label: "Worker heartbeat telemetry",
                  required: true,
                  status: "passed",
                  detail: "1 bridge worker visible.",
                },
                {
                  key: "worker_health",
                  label: "Worker health pressure",
                  required: true,
                  status: "attention",
                  detail: "1 stale worker.",
                },
              ],
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
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/operations-continuity")) {
        return new Response(
          JSON.stringify({
            stage: "8P-9A",
            source: "postgres",
            continuity: {
              status: "attention",
              completionPercent: 80,
              summary: {
                bridgeCount: 1,
                staleWorkers: 1,
                failedCommands: 1,
                stuckCommands: 1,
                retryableCommands: 1,
                cancellableCommands: 2,
                auditEvents: 3,
                attentionGateCount: 2,
                queuePressure: 5,
              },
              incidentDrill: {
                cadence: "monthly",
                lastDrillRecordedInGit: false,
                requiredSteps: ["Open /sys/devices."],
              },
              retentionPolicy: {
                workerTelemetryRetentionDays: 30,
                commandAuditRetentionDays: 90,
                exportContainsRawPayloads: false,
                cleanupMode: "operator-reviewed",
              },
              handoff: {
                nextBatchHypothesis: "Stage 9B-9D",
                includedStages: ["Stage 8P", "Stage 9A"],
                continuityOwner: "system_admin",
                liveOutcomeKnownToRepository: false,
              },
              stages: [
                {
                  id: "Stage 8P",
                  title: "Incident drill register",
                  status: "ready",
                  summary: "Incident drills are repository-defined.",
                  owner: "system_admin",
                },
                {
                  id: "Stage 9A",
                  title: "Next batch handoff",
                  status: "ready",
                  summary: "Stage 9B-9D remains a hypothesis.",
                  owner: "system_admin",
                },
              ],
              gates: [
                {
                  key: "incident_pressure_reviewed",
                  label: "Incident pressure reviewed",
                  status: "attention",
                  detail: "5 command(s).",
                },
                {
                  key: "self_hosted_boundary",
                  label: "Self-hosted product boundary",
                  status: "passed",
                  detail: "none/none.",
                },
              ],
              productBoundary: {
                managedRuntimeDependency: "none",
                managedDatabaseDependency: "none",
                browserHardwareApis: false,
                payloadVisibility: "backend-only",
                rawPatientDataInReports: false,
                signedUrlExposure: false,
                storagePathExposure: false,
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/fleet-reliability")) {
        return new Response(
          JSON.stringify({
            stage: "9B-9M",
            source: "postgres",
            reliability: {
              status: "attention",
              completionPercent: 67,
              summary: {
                bridgeCount: 1,
                staleWorkers: 1,
                failedCommands: 1,
                stuckCommands: 1,
                retryableCommands: 1,
                cancellableCommands: 2,
                auditEvents: 3,
                inheritedAttentionGates: 2,
                queuePressure: 5,
                fleetAttention: 8,
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
                includedStages: ["Stage 9B", "Stage 9M"],
                reliabilityOwner: "system_admin",
              },
              stages: [
                {
                  id: "Stage 9B",
                  title: "Fleet reliability register",
                  status: "ready",
                  summary: "Fleet reliability is repository-defined.",
                  owner: "system_admin",
                },
                {
                  id: "Stage 9M",
                  title: "Next batch handoff",
                  status: "ready",
                  summary: "Stage 9N-9Z remains a hypothesis.",
                  owner: "system_admin",
                },
              ],
              gates: [
                {
                  key: "command_slo_reviewed",
                  label: "Command SLO reviewed",
                  required: true,
                  status: "attention",
                  detail: "5 command(s).",
                },
                {
                  key: "self_hosted_boundary",
                  label: "Self-hosted product boundary",
                  required: true,
                  status: "passed",
                  detail: "none/none.",
                },
              ],
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
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridge-worker/lifecycle-assurance")) {
        return new Response(
          JSON.stringify({
            stage: "9N-9Z",
            source: "postgres",
            assurance: {
              status: "attention",
              completionPercent: 50,
              generatedAt: "2026-05-21T12:00:00.000Z",
              summary: {
                bridgeCount: 1,
                staleWorkers: 1,
                failedCommands: 1,
                stuckCommands: 1,
                retryableCommands: 1,
                cancellableCommands: 2,
                queuePressure: 5,
                fleetAttention: 8,
                inheritedAttentionGates: 2,
                auditEvents: 3,
                assuranceDebt: 10,
                upgradePressure: 2,
                maintenanceDue: true,
                retentionReviewDue: true,
              },
              lifecyclePolicy: {
                maintenanceReviewCadence: "weekly",
                workerUpgradeReviewCadence: "monthly",
                auditRetentionReviewDays: 90,
                closureEvidenceStorage: "external",
                liveOutcomeKnownToRepository: false,
                workerHeartbeatReviewMinutes: 30,
                commandQueueReviewMinutes: 15,
              },
              handoff: {
                previousBatch: "Stage 9B-9M",
                currentBatch: "Stage 9N-9Z",
                originalHypothesis: "Stage 9N-9Z",
                nextBatchHypothesis: "Stage 10A-10L",
                includedStages: ["Stage 9N", "Stage 9Z"],
                assuranceOwner: "system_admin",
                promptOnlyAfterMergeToMain: true,
              },
              stages: [
                {
                  id: "Stage 9N",
                  title: "Lifecycle assurance register",
                  status: "ready",
                  summary: "Lifecycle assurance is repository-defined.",
                  owner: "system_admin",
                },
                {
                  id: "Stage 9Z",
                  title: "Next batch handoff",
                  status: "ready",
                  summary: "Stage 10A-10L remains a hypothesis.",
                  owner: "system_admin",
                },
              ],
              gates: [
                {
                  key: "maintenance_window_reviewed",
                  label: "Maintenance window reviewed",
                  required: true,
                  status: "attention",
                  detail: "Review required.",
                },
                {
                  key: "self_hosted_boundary",
                  label: "Self-hosted product boundary",
                  required: true,
                  status: "passed",
                  detail: "none/none.",
                },
              ],
              inheritedReliability: {
                status: "attention",
                completionPercent: 67,
                gateCount: 2,
                attentionGateCount: 1,
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
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("/api/v1/device-bridges")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "br-uuid",
                bridgeCode: "br-live-01",
                hostName: "live-bridge",
                lanStatus: "online",
                version: "1.2.3",
                pairedCount: 1,
                lastHeartbeatAt: "2026-05-14T08:00:00Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          items: [
            {
              id: "dev-uuid",
              model: "LiveScope 20",
              serial: "LS-200",
              firmware: "4.0.0",
              magnification: "x20",
              polarization: "both",
              calibrationProfile: "LS-live",
              calibrationDueAt: "2026-05-10",
              status: "connected",
              lastSeenAt: "2026-05-14T08:01:00Z",
              bridgeId: "br-uuid",
              bridge: { id: "br-uuid", code: "br-live-01", hostName: "live-bridge", lanStatus: "online" },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    });

    const { container } = renderPage();

    expect(await screen.findByText(/Рабочая система подключена/)).toBeInTheDocument();
    expect((await screen.findAllByText("LiveScope 20")).length).toBeGreaterThan(0);
    expect(screen.queryByText("br-live-01")).not.toBeInTheDocument();
    expect(screen.getByText("Реестр устройств загружен из рабочей системы.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Наблюдение службы моста устройств" })).toHaveTextContent(
      "версия stage4t-local-worker",
    );
    expect(screen.getByRole("region", { name: "Жизненный цикл команд моста устройств" })).toHaveTextContent(
      "Служебная команда",
    );
    expect(container.innerHTML).not.toContain("raw_failed_state");
    expect(screen.getByRole("note", { name: "Граница данных службы моста устройств" })).toHaveTextContent(
      "служебные метаданные",
    );
    expect(screen.getByRole("region", { name: "Устойчивость службы моста устройств" })).toHaveTextContent(
      "На очистку",
    );
    expect(screen.getByRole("region", { name: "Правила устойчивости моста устройств" })).toHaveTextContent(
      "линейная задержка с ограничением",
    );
    expect(screen.getByRole("note", { name: "Граница данных устойчивости моста устройств" })).toHaveTextContent(
      "кандидаты на очистку",
    );
    expect(screen.getByRole("region", { name: "Восстановление команд моста устройств" })).toHaveTextContent(
      "Можно повторить",
    );
    expect(screen.getByRole("region", { name: "Очередь восстановления команд" })).toHaveTextContent(
      "можно повторить",
    );
    expect(screen.getByRole("note", { name: "Граница данных восстановления команд" })).toHaveTextContent(
      "аудит восстановления",
    );
    expect(screen.getByRole("region", { name: "Аудит и повтор команд моста устройств" })).toHaveTextContent(
      "События аудита",
    );
    expect(screen.getByRole("region", { name: "Правила повтора команд" })).toHaveTextContent(
      "видимость данных",
    );
    expect(screen.getByRole("region", { name: "Журнал аудита команд" })).toHaveTextContent(
      "вручную системным администратором",
    );
    expect(container.innerHTML).not.toContain("raw_audit_state");
    expect(screen.getByRole("note", { name: "Граница данных аудита команд" })).toHaveTextContent(
      "аудит без изменений",
    );
    expect(screen.getByRole("region", { name: "Готовность моста устройств" })).toHaveTextContent(
      "Готовность моста устройств",
    );
    expect(screen.getByRole("region", { name: "Проверки готовности моста устройств" })).toHaveTextContent(
      "Давление состояния службы",
    );
    expect(screen.getByRole("note", { name: "Граница данных готовности моста устройств" })).toHaveTextContent(
      "только безопасные агрегаты",
    );
    expect(screen.getByRole("region", { name: "Непрерывность операций моста устройств" })).toHaveTextContent(
      "Непрерывность операций",
    );
    expect(screen.getByRole("region", { name: "Шаги непрерывности операций" })).toHaveTextContent(
      "Реестр учений по инцидентам",
    );
    expect(screen.getByRole("region", { name: "Проверки непрерывности операций" })).toHaveTextContent(
      "Граница продукта клиники",
    );
    expect(screen.getByRole("note", { name: "Граница данных непрерывности операций" })).toHaveTextContent(
      "следующий шаг скрыт",
    );
    expect(screen.getByRole("region", { name: "Надёжность парка мостов устройств" })).toHaveTextContent(
      "Надёжность парка",
    );
    expect(screen.getByRole("region", { name: "Шаги надёжности парка" })).toHaveTextContent(
      "Реестр надёжности парка",
    );
    expect(screen.getByRole("region", { name: "Проверки надёжности парка" })).toHaveTextContent(
      "Норма обработки команд проверена",
    );
    expect(screen.getByRole("note", { name: "Граница данных надёжности парка" })).toHaveTextContent(
      "следующий шаг скрыт",
    );
    expect(screen.getByRole("region", { name: "Контроль жизненного цикла моста устройств" })).toHaveTextContent(
      "Контроль жизненного цикла",
    );
    expect(screen.getByRole("region", { name: "Шаги жизненного цикла" })).toHaveTextContent(
      "Реестр жизненного цикла",
    );
    expect(screen.getByRole("region", { name: "Проверки жизненного цикла" })).toHaveTextContent(
      "Окно обслуживания проверено",
    );
    expect(screen.getByRole("note", { name: "Граница данных жизненного цикла" })).toHaveTextContent(
      "следующий шаг скрыт",
    );
    expect(fetchMock).toHaveBeenCalledTimes(10);

    fireEvent.click(screen.getByRole("tab", { name: "Нужна калибровка" }));
    expect(screen.getAllByText("LiveScope 20").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Проверить мост" })[0]);
    expect(await screen.findByText(/Команда проверки «Мост 1» поставлена в очередь моста устройств/)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Запросить калибровку" })[0]);
    expect(await screen.findByText(/Команда калибровки поставлена в очередь моста устройств/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(12);

    fireEvent.click(screen.getAllByRole("button", { name: "Повторить" })[0]);
    expect(await screen.findByText(/Команда возвращена в очередь моста устройств/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(13);

    fireEvent.click(screen.getAllByRole("button", { name: "Повторить" })[1]);
    expect(await screen.findByText(/Повтор команды поставлен в очередь моста устройств/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(14);

    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:device-audit"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Скачать журнал" }));
    expect(await screen.findByText(/Экспорт журнала команд моста устройств скачан/)).toBeInTheDocument();
    expect(click).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(15);
  });

  it("shows a safe live error without rendering backend internals", async () => {
    writeLiveSession();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: "database_unavailable",
            message: "Database unavailable",
          },
          storage_object_path: "bucket/private",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );

    const { container } = renderPage();

    expect(await screen.findByText("Database unavailable")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("storage_object_path");
    expect(container.innerHTML).not.toContain("bucket/private");
  });
});
