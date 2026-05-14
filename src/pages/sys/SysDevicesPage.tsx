import { useEffect, useMemo, useState } from "react";
import { Activity, Download, RadioTower, ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { blobFromParts } from "@/lib/blob-utils";
import { getDevices } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  listSelfHostedDeviceBridges,
  listSelfHostedDevices,
  exportSelfHostedDeviceBridgeCommandAudit,
  getSelfHostedDeviceBridgeWorkerStatus,
  getSelfHostedDeviceBridgeWorkerHardening,
  getSelfHostedDeviceBridgeWorkerRecovery,
  getSelfHostedDeviceBridgeCommandAudit,
  recoverSelfHostedDeviceBridgeWorkerCommand,
  replaySelfHostedDeviceBridgeCommand,
  requestSelfHostedBridgeCommand,
  requestSelfHostedDeviceCommand,
  type SelfHostedDeviceBridgeCommandAuditDTO,
  type SelfHostedDeviceBridgeWorkerHardeningDTO,
  type SelfHostedDeviceBridgeWorkerRecoveryDTO,
  type SelfHostedDeviceBridgeWorkerStatusDTO,
  type SelfHostedDeviceBridgeDTO,
  type SelfHostedDeviceDTO,
} from "@/lib/self-hosted-device-api";
import type { Device } from "@/lib/domain";

/**
 * Sys Devices — Device Bridge и электронные дерматоскопы (MVP).
 * SAFETY: только метаданные устройств. Никаких WebUSB/WebBluetooth/WebSerial.
 */

const DEMO_BANNER =
  "Демо-режим. Реальные роли, RLS, аудит, ключи и Device Bridge включаются на этапе бэкенда.";

const LIVE_BANNER =
  "Self-hosted backend подключён. Устройства и Device Bridge читаются из серверного реестра PostgreSQL.";

const BRIDGE_NOTE =
  "Браузер не подключается к драйверу напрямую. Реальная интеграция идёт через локальный Device Bridge.";

interface BridgeRow {
  id: string;
  code?: string;
  host: string;
  lan: "online" | "degraded" | "offline";
  version: string;
  pairedCount: number;
  lastHeartbeatAt: string;
}

const DEMO_BRIDGES: BridgeRow[] = [
  { id: "br-msk-01", host: "dp-bridge-msk-01", lan: "online",   version: "0.7.2", pairedCount: 2, lastHeartbeatAt: "2026-03-13T09:01:00Z" },
  { id: "br-msk-02", host: "dp-bridge-msk-02", lan: "degraded", version: "0.7.0", pairedCount: 1, lastHeartbeatAt: "2026-03-13T08:50:00Z" },
  { id: "br-spb-01", host: "dp-bridge-spb-01", lan: "offline",  version: "0.6.9", pairedCount: 1, lastHeartbeatAt: "2026-03-12T15:12:00Z" },
];

const LAN_LABEL = { online: "В сети", degraded: "Нестабильно", offline: "Не в сети" } as const;
const LAN_TONE = {
  online: "hsl(var(--success))",
  degraded: "hsl(var(--warning))",
  offline: "hsl(var(--destructive))",
};

const WORKER_STATUS_LABEL: Record<string, string> = {
  online: "Worker online",
  degraded: "Worker degraded",
  offline: "Worker offline",
  unknown: "Worker unknown",
};

const COMMAND_STATUS_LABEL: Record<string, string> = {
  queued: "В очереди",
  acknowledged: "Принята",
  completed: "Выполнена",
  failed: "Ошибка",
  cancelled: "Отменена",
};

type DevStatus = "connected" | "standby" | "offline";
const STATUS_LABEL: Record<DevStatus, string> = {
  connected: "Подключен",
  standby: "Ожидание",
  offline: "Не в сети",
};
const STATUS_TONE: Record<DevStatus, string> = {
  connected: "hsl(var(--success))",
  standby: "hsl(var(--info))",
  offline: "hsl(var(--destructive))",
};

interface DeviceRow extends Device {
  derivedStatus: DevStatus;
  calibrationDueAt?: string | null;
}

function deriveStatus(lastSeenIso: string | null | undefined, bridgeId: string | null, bridges: BridgeRow[]): DevStatus {
  const bridge = bridges.find((b) => b.id === bridgeId);
  if (!bridge || bridge.lan === "offline") return "offline";
  const ageMin = (Date.parse("2026-03-13T09:05:00Z") - Date.parse(lastSeenIso || "")) / 60000;
  if (!Number.isFinite(ageMin)) return "offline";
  if (ageMin < 30) return "connected";
  if (ageMin < 24 * 60) return "standby";
  return "offline";
}

type FilterKey = "all" | "connected" | "offline" | "needs_calibration";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "connected", label: "Подключены" },
  { key: "offline", label: "Не в сети" },
  { key: "needs_calibration", label: "Нужна калибровка" },
];

// Деттерминированный список устройств, требующих калибровки.
const NEEDS_CALIB = new Set(["d-004"]);
const TODAY = "2026-05-14";

function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8"): void {
  const url = URL.createObjectURL(blobFromParts(["\ufeff", content], mime));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function bridgeFromDto(dto: SelfHostedDeviceBridgeDTO): BridgeRow {
  return {
    id: dto.id,
    code: dto.bridgeCode,
    host: dto.hostName,
    lan: dto.lanStatus,
    version: dto.version,
    pairedCount: dto.pairedCount,
    lastHeartbeatAt: dto.lastHeartbeatAt ?? "",
  };
}

function deviceFromDto(dto: SelfHostedDeviceDTO): DeviceRow {
  return {
    id: dto.id,
    model: dto.model,
    serial: dto.serial,
    firmware: dto.firmware,
    magnification: dto.magnification,
    polarization: dto.polarization,
    calibrationProfile: dto.calibrationProfile,
    calibrationDueAt: dto.calibrationDueAt,
    lastSeenAt: dto.lastSeenAt ?? "",
    bridgeId: dto.bridge?.code ?? dto.bridgeId,
    derivedStatus: dto.status,
  };
}

function needsCalibration(device: DeviceRow): boolean {
  if (NEEDS_CALIB.has(device.id)) return true;
  return Boolean(device.calibrationDueAt && device.calibrationDueAt <= TODAY);
}

export default function SysDevicesPage() {
  const session = useSelfHostedApiSession();
  const isLive = Boolean(session.apiToken);
  const [liveDevices, setLiveDevices] = useState<DeviceRow[] | null>(null);
  const [liveBridges, setLiveBridges] = useState<BridgeRow[] | null>(null);
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workerStatus, setWorkerStatus] = useState<SelfHostedDeviceBridgeWorkerStatusDTO | null>(null);
  const [workerStatusError, setWorkerStatusError] = useState<string | null>(null);
  const [workerHardening, setWorkerHardening] = useState<SelfHostedDeviceBridgeWorkerHardeningDTO | null>(null);
  const [workerHardeningError, setWorkerHardeningError] = useState<string | null>(null);
  const [workerRecovery, setWorkerRecovery] = useState<SelfHostedDeviceBridgeWorkerRecoveryDTO | null>(null);
  const [workerRecoveryError, setWorkerRecoveryError] = useState<string | null>(null);
  const [workerAudit, setWorkerAudit] = useState<SelfHostedDeviceBridgeCommandAuditDTO | null>(null);
  const [workerAuditError, setWorkerAuditError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [commandBusyKey, setCommandBusyKey] = useState<string | null>(null);
  const [auditExportBusy, setAuditExportBusy] = useState(false);

  useEffect(() => {
    if (!session.apiToken) {
      setLiveDevices(null);
      setLiveBridges(null);
      setWorkerStatus(null);
      setWorkerStatusError(null);
      setWorkerHardening(null);
      setWorkerHardeningError(null);
      setWorkerRecovery(null);
      setWorkerRecoveryError(null);
      setWorkerAudit(null);
      setWorkerAuditError(null);
      setLoadStatus("idle");
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
    setWorkerStatusError(null);
    setWorkerHardeningError(null);
    setWorkerRecoveryError(null);
    setWorkerAuditError(null);
    Promise.all([
      listSelfHostedDeviceBridges({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      listSelfHostedDevices({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        limit: 200,
      }),
      getSelfHostedDeviceBridgeWorkerStatus({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        workerStatus: "all",
        commandStatus: "all",
        limit: 25,
      }),
      getSelfHostedDeviceBridgeWorkerHardening({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        staleAfterMinutes: 10,
        retentionDays: 30,
        limit: 25,
      }),
      getSelfHostedDeviceBridgeWorkerRecovery({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        staleAfterMinutes: 10,
        leaseTtlSeconds: 90,
        limit: 25,
      }),
      getSelfHostedDeviceBridgeCommandAudit({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        action: "all",
        status: "all",
        limit: 25,
      }),
    ]).then(([bridgeResult, deviceResult, workerResult, hardeningResult, recoveryResult, auditResult]) => {
      if (cancelled) return;
      if (!bridgeResult.ok || !deviceResult.ok) {
        setLoadStatus("error");
        setLoadError(bridgeResult.error?.message || deviceResult.error?.message || "Не удалось загрузить устройства.");
        setLiveDevices(null);
        setLiveBridges(null);
        setWorkerStatus(null);
        setWorkerHardening(null);
        setWorkerRecovery(null);
        setWorkerAudit(null);
        return;
      }
      setLiveBridges((bridgeResult.value ?? []).map(bridgeFromDto));
      setLiveDevices((deviceResult.value ?? []).map(deviceFromDto));
      if (workerResult?.ok) {
        setWorkerStatus(workerResult.value ?? null);
      } else {
        setWorkerStatus(null);
        setWorkerStatusError(workerResult?.error?.message || "Не удалось загрузить Device Bridge worker status.");
      }
      if (hardeningResult?.ok) {
        setWorkerHardening(hardeningResult.value ?? null);
      } else {
        setWorkerHardening(null);
        setWorkerHardeningError(
          hardeningResult?.error?.message || "Не удалось загрузить Device Bridge worker hardening.",
        );
      }
      if (recoveryResult?.ok) {
        setWorkerRecovery(recoveryResult.value ?? null);
      } else {
        setWorkerRecovery(null);
        setWorkerRecoveryError(
          recoveryResult?.error?.message || "Не удалось загрузить Device Bridge worker recovery.",
        );
      }
      if (auditResult?.ok) {
        setWorkerAudit(auditResult.value ?? null);
      } else {
        setWorkerAudit(null);
        setWorkerAuditError(
          auditResult?.error?.message || "Не удалось загрузить Device Bridge command audit.",
        );
      }
      setLoadStatus("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [session.apiBaseUrl, session.apiToken]);

  const bridges = liveBridges ?? DEMO_BRIDGES;
  const devices = liveDevices ?? getDevices();

  const enriched = useMemo(
    () => devices.map((d) => (
      "derivedStatus" in d
        ? d as DeviceRow
        : { ...d, derivedStatus: deriveStatus(d.lastSeenAt, d.bridgeId, bridges) }
    )),
    [bridges, devices],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((d) => {
      if (filter === "connected" && d.derivedStatus !== "connected") return false;
      if (filter === "offline" && d.derivedStatus !== "offline") return false;
      if (filter === "needs_calibration" && !needsCalibration(d)) return false;
      if (q && !`${d.model} ${d.serial} ${d.bridgeId ?? ""}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [enriched, filter, query]);

  const pagination = useListPagination(rows, {
    mobilePageSize: 4,
    desktopPageSize: 8,
    deps: [filter, query],
  });
  const visible = pagination.visible;

  async function runBridgeHealthCheck(bridge: BridgeRow) {
    const label = bridge.code ?? bridge.id;
    if (!isLive || !session.apiToken) {
      setNote(`Проверка моста ${label} — демо-действие.`);
      return;
    }
    const key = `bridge:${bridge.id}`;
    setCommandBusyKey(key);
    setNote(`Команда проверки моста ${label} отправляется в self-hosted backend.`);
    const result = await requestSelfHostedBridgeCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      bridgeId: bridge.id,
      commandType: "bridge_health_check",
      reason: "Проверка LAN и heartbeat из системной страницы устройств.",
    });
    setCommandBusyKey(null);
    setNote(
      result.ok
        ? `Команда проверки моста ${label} поставлена в очередь Device Bridge: ${result.value.id}.`
        : result.error?.message || `Не удалось поставить команду проверки моста ${label} в очередь.`,
    );
  }

  async function runDeviceCommand(
    device: DeviceRow,
    commandType: "device_calibration_request" | "device_stream_open_request",
  ) {
    const isCalibration = commandType === "device_calibration_request";
    if (!isLive || !session.apiToken) {
      setNote(
        isCalibration
          ? `Калибровка ${device.serial} — демо.`
          : `Открытие потока ${device.serial} появится с Device Bridge.`,
      );
      return;
    }
    const key = `${commandType}:${device.id}`;
    setCommandBusyKey(key);
    setNote(
      isCalibration
        ? `Команда калибровки ${device.serial} отправляется в self-hosted backend.`
        : `Команда открытия потока ${device.serial} отправляется в self-hosted backend.`,
    );
    const result = await requestSelfHostedDeviceCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      deviceId: device.id,
      commandType,
      reason: isCalibration
        ? "Запрос калибровки из системной страницы устройств."
        : "Запрос открытия потока через локальный Device Bridge.",
    });
    setCommandBusyKey(null);
    setNote(
      result.ok
        ? (
            isCalibration
              ? `Команда калибровки ${device.serial} поставлена в очередь Device Bridge: ${result.value.id}.`
              : `Команда открытия потока ${device.serial} поставлена в очередь Device Bridge: ${result.value.id}.`
          )
        : result.error?.message || `Не удалось поставить команду ${device.serial} в очередь.`,
    );
  }

  async function recoverWorkerCommand(commandId: string, action: "reschedule" | "cancel") {
    if (!isLive || !session.apiToken) return;
    const key = `recovery:${action}:${commandId}`;
    setCommandBusyKey(key);
    setNote(
      action === "reschedule"
        ? "Команда Device Bridge отправляется на повторную постановку в очередь."
        : "Команда Device Bridge отменяется через backend recovery.",
    );
    const result = await recoverSelfHostedDeviceBridgeWorkerCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      commandId,
      action,
      reason: action === "reschedule"
        ? "Повторная постановка из production recovery панели."
        : "Отмена из production recovery панели.",
    });
    setCommandBusyKey(null);
    if (result.ok && result.value) {
      setWorkerRecovery((current) => current
        ? {
            ...current,
            items: current.items.map((item) => item.id === commandId ? result.value : item),
          }
        : current);
      setNote(
        action === "reschedule"
          ? `Команда ${commandId} возвращена в очередь Device Bridge.`
          : `Команда ${commandId} отменена через Device Bridge recovery.`,
      );
      return;
    }
    setNote(result.error?.message || "Не удалось выполнить recovery action для Device Bridge command.");
  }

  async function replayWorkerCommand(commandId: string) {
    if (!isLive || !session.apiToken) return;
    const key = `replay:${commandId}`;
    setCommandBusyKey(key);
    setNote("Replay команды Device Bridge создаётся backend-side без раскрытия payload в UI.");
    const result = await replaySelfHostedDeviceBridgeCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      commandId,
      reason: "Manual replay из Stage 4X command audit панели.",
    });
    setCommandBusyKey(null);
    if (result.ok && result.value) {
      setWorkerAudit((current) => current
        ? {
            ...current,
            summary: {
              ...current.summary,
              replayEvents: current.summary.replayEvents + 1,
            },
          }
        : current);
      setNote(`Replay команды ${commandId} поставлен в очередь Device Bridge: ${result.value.id}.`);
      return;
    }
    setNote(result.error?.message || "Не удалось выполнить replay команды Device Bridge.");
  }

  async function exportWorkerAudit() {
    if (!isLive || !session.apiToken || auditExportBusy) return;
    setAuditExportBusy(true);
    setNote("Готовим safe CSV экспорт Device Bridge command audit.");
    const result = await exportSelfHostedDeviceBridgeCommandAudit({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      action: "all",
      status: "all",
      limit: 100,
    });
    setAuditExportBusy(false);
    if (result.ok && result.value) {
      downloadText(result.value.export.filename, result.value.export.content, result.value.export.mime);
      setNote(`Экспорт Device Bridge command audit скачан: ${result.value.export.filename}.`);
      return;
    }
    setNote(result.error?.message || "Не удалось экспортировать Device Bridge command audit.");
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Устройства" subtitle="Device Bridge и электронные дерматоскопы." />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{isLive ? LIVE_BANNER : DEMO_BANNER}</span>
        </div>

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          {BRIDGE_NOTE}
        </div>

        {isLive && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            {loadStatus === "loading" && "Загружаем реестр устройств из self-hosted backend."}
            {loadStatus === "ready" && "Реестр устройств загружен из backend."}
            {loadStatus === "error" && (loadError || "Не удалось загрузить реестр устройств.")}
          </div>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Device Bridge worker observability"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" aria-hidden />
                Worker runtime
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Stage 4U /api/v1/device-bridge-worker/status
              </span>
            </div>
            <Card className="p-3">
              {workerStatus ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <WorkerMetric label="Bridge workers" value={workerStatus.summary.bridgeCount} />
                    <WorkerMetric label="Online" value={workerStatus.summary.onlineWorkers} />
                    <WorkerMetric label="Degraded" value={workerStatus.summary.degradedWorkers} />
                    <WorkerMetric label="Offline" value={workerStatus.summary.offlineWorkers} />
                    <WorkerMetric label="Queued commands" value={workerStatus.summary.queuedCommands} />
                    <WorkerMetric label="Failed commands" value={workerStatus.summary.failedCommands} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                    <div
                      role="region"
                      aria-label="Device Bridge worker heartbeat list"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Heartbeat
                      </div>
                      <div className="divide-y divide-border/70">
                        {workerStatus.items.length > 0 ? workerStatus.items.map((bridge) => (
                          <div key={bridge.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div className="min-w-0">
                              <div className="truncate font-mono text-[11px] font-semibold">{bridge.bridgeCode}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {bridge.hostName || "host не указан"} · {bridge.workerVersion || "version unknown"}
                              </div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {WORKER_STATUS_LABEL[bridge.workerStatus] ?? bridge.workerStatus}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDateTime(bridge.workerLastSeenAt ?? bridge.lastHeartbeatAt ?? "")}
                            </span>
                          </div>
                        )) : (
                          <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                            Worker telemetry пока не поступала.
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      role="region"
                      aria-label="Device Bridge worker command lifecycle"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Command lifecycle
                      </div>
                      <div className="divide-y divide-border/70">
                        {workerStatus.commands.slice(0, 5).map((command) => (
                          <div key={command.id} className="px-3 py-2 text-[12px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate font-mono text-[11px]">{command.commandType}</span>
                              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                                {COMMAND_STATUS_LABEL[command.status] ?? command.status}
                              </span>
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground">
                              {command.bridgeCode ?? "bridge"} · {formatDateTime(command.createdAt ?? "")}
                            </div>
                          </div>
                        ))}
                        {workerStatus.commands.length === 0 ? (
                          <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                            Команд worker runtime пока нет.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Device Bridge worker privacy boundary"
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      Показываются только lifecycle-метаданные. Служебные секреты, сырые payloads,
                      storage paths, patient names и browser hardware APIs не выводятся в UI.
                    </span>
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerStatusError || "Device Bridge worker observability ожидает ответ backend."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Device Bridge worker production hardening"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Production hardening
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Stage 4V /api/v1/device-bridge-worker/hardening
              </span>
            </div>
            <Card className="p-3">
              {workerHardening ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <WorkerMetric label="Stale workers" value={workerHardening.summary.staleWorkers} />
                    <WorkerMetric label="Retrying commands" value={workerHardening.summary.retryingCommands} />
                    <WorkerMetric label="Backoff delayed" value={workerHardening.summary.rateLimitedCommands} />
                    <WorkerMetric label="Max queue age sec" value={workerHardening.summary.maxQueueAgeSeconds} />
                    <WorkerMetric label="Cleanup candidates" value={workerHardening.summary.cleanupCandidates} />
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge worker hardening policy"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Hardening policy</div>
                    <div className="mt-1">
                      stale after {workerHardening.policy.staleAfterMinutes} min · retention {workerHardening.policy.retentionDays} days · backoff {workerHardening.policy.pollBackoff} · max poll {workerHardening.policy.maxPollLimit}
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge worker hardening bridge list"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Bridge hardening status
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerHardening.items.length > 0 ? workerHardening.items.slice(0, 5).map((bridge) => (
                        <div key={bridge.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-semibold">{bridge.bridgeCode}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {bridge.hostName || "host не указан"} · {bridge.workerVersion || "version unknown"}
                            </div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {bridge.stale ? "stale" : "fresh"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            retry {bridge.retryingCommandCount} / delayed {bridge.rateLimitedCommandCount}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            queue age {bridge.maxQueueAgeSeconds}s
                          </span>
                        </div>
                      )) : (
                        <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                          Hardening telemetry пока не поступала.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Device Bridge worker hardening privacy boundary"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Stage 4V показывает только агрегированные production-сигналы: stale workers, queue age,
                    retry/backoff pressure и retention cleanup candidates. Секреты worker runtime,
                    драйверные payloads, storage paths, patient names и browser hardware APIs не выводятся.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerHardeningError || "Device Bridge worker hardening ожидает ответ backend."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Device Bridge command recovery"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Command recovery
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Stage 4W /api/v1/device-bridge-worker/recovery
              </span>
            </div>
            <Card className="p-3">
              {workerRecovery ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <WorkerMetric label="Stuck commands" value={workerRecovery.summary.stuckCommands} />
                    <WorkerMetric label="Expired commands" value={workerRecovery.summary.expiredCommands} />
                    <WorkerMetric label="Lease expired" value={workerRecovery.summary.leaseExpiredCommands} />
                    <WorkerMetric label="Retryable failed" value={workerRecovery.summary.retryableCommands} />
                    <WorkerMetric label="Cancellable" value={workerRecovery.summary.cancellableCommands} />
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge command recovery policy"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Recovery policy</div>
                    <div className="mt-1">
                      stale after {workerRecovery.policy.staleAfterMinutes} min · lease TTL {workerRecovery.policy.leaseTtlSeconds}s · max batch {workerRecovery.policy.maxRecoveryBatch}
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge command recovery queue"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Recoverable commands
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerRecovery.items.length > 0 ? workerRecovery.items.slice(0, 5).map((command) => (
                        <div key={command.id} className="grid gap-2 px-3 py-2 text-[12px] lg:grid-cols-[1fr_auto_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-semibold">{command.commandType}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {command.bridgeCode ?? "bridge"} · {command.recoveryState ?? "active"} · attempts {command.attemptCount}
                            </div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {COMMAND_STATUS_LABEL[command.status] ?? command.status}
                          </span>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 min-h-[44px] sm:min-h-[32px]"
                              disabled={commandBusyKey === `recovery:reschedule:${command.id}`}
                              onClick={() => void recoverWorkerCommand(command.id, "reschedule")}
                            >
                              {commandBusyKey === `recovery:reschedule:${command.id}` ? "Ставим..." : "Повторить"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 min-h-[44px] sm:min-h-[32px]"
                              disabled={commandBusyKey === `recovery:cancel:${command.id}`}
                              onClick={() => void recoverWorkerCommand(command.id, "cancel")}
                            >
                              {commandBusyKey === `recovery:cancel:${command.id}` ? "Отменяем..." : "Отменить"}
                            </Button>
                          </div>
                        </div>
                      )) : (
                        <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                          Команд для recovery пока нет.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Device Bridge command recovery privacy boundary"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Stage 4W управляет только backend-owned lifecycle metadata: leases, retry state,
                    cancellation и recovery audit. Worker secrets, raw command payloads, storage paths,
                    patient names и browser hardware APIs не выводятся в UI.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerRecoveryError || "Device Bridge command recovery ожидает ответ backend."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Device Bridge command audit and replay"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Command audit & replay
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 min-h-[44px] gap-1.5 sm:min-h-[32px]"
                  disabled={auditExportBusy || !workerAudit}
                  onClick={() => void exportWorkerAudit()}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  {auditExportBusy ? "Экспорт..." : "Экспорт audit CSV"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Stage 4Y /api/v1/device-bridge-worker/audit/export
                </span>
              </div>
            </div>
            <Card className="p-3">
              {workerAudit ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <WorkerMetric label="Audit events" value={workerAudit.summary.totalEvents} />
                    <WorkerMetric label="Replay events" value={workerAudit.summary.replayEvents} />
                    <WorkerMetric label="Recovery events" value={workerAudit.summary.recoveryEvents} />
                    <WorkerMetric label="Affected commands" value={workerAudit.summary.affectedCommands} />
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge replay policy"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Replay policy</div>
                    <div className="mt-1">
                      {workerAudit.policy.replayPolicy} · payload {workerAudit.policy.payloadVisibility} · command types{" "}
                      {workerAudit.policy.allowedReplayCommandTypes.join(", ")}
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Device Bridge command audit log"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Safe command audit
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerAudit.items.length > 0 ? workerAudit.items.slice(0, 5).map((event) => (
                        <div key={event.id} className="grid gap-2 px-3 py-2 text-[12px] lg:grid-cols-[1fr_auto_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-semibold">
                              {event.action} · {event.commandType ?? "command"}
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {event.bridgeCode ?? "bridge"} · {event.status} · rev {event.lifecycleRevision}
                            </div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {event.replayPolicy ?? "audit"}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-h-[44px] sm:min-h-[32px]"
                            disabled={!event.commandId || commandBusyKey === `replay:${event.commandId}`}
                            onClick={() => event.commandId ? void replayWorkerCommand(event.commandId) : undefined}
                          >
                            {event.commandId && commandBusyKey === `replay:${event.commandId}` ? "Создаём..." : "Replay"}
                          </Button>
                        </div>
                      )) : (
                        <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                          Command audit пока пуст.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Device Bridge command audit privacy boundary"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Stage 4X показывает только append-only audit projection и backend-owned replay policy.
                    Raw audit metadata, command payloads, worker secrets, storage paths, patient names и
                    browser hardware APIs не выводятся в UI.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerAuditError || "Device Bridge command audit ожидает ответ backend."}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Bridges */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Device Bridge
          </h2>
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Bridge ID</th>
                  <th className="px-3 py-2">Хост</th>
                  <th className="px-3 py-2">LAN</th>
                  <th className="px-3 py-2">Версия</th>
                  <th className="px-3 py-2 text-right">Устройств</th>
                  <th className="px-3 py-2">Heartbeat</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {bridges.map((b) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-[11px]">{b.code ?? b.id}</td>
                    <td className="px-3 py-2">{b.host}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{ color: LAN_TONE[b.lan], border: `1px solid ${LAN_TONE[b.lan]}` }}
                      >
                        {LAN_LABEL[b.lan]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{b.version}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.pairedCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(b.lastHeartbeatAt)}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          disabled={commandBusyKey === `bridge:${b.id}`}
                          onClick={() => void runBridgeHealthCheck(b)}
                        >
                          {commandBusyKey === `bridge:${b.id}` ? "Ставим в очередь..." : "Проверить мост"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Bridges — Mobile */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {bridges.map((b) => (
              <Card key={b.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px] font-semibold">{b.code ?? b.id}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{b.host}</div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{ color: LAN_TONE[b.lan], border: `1px solid ${LAN_TONE[b.lan]}` }}
                  >
                    {LAN_LABEL[b.lan]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Версия</dt>
                  <dd className="text-right">{b.version}</dd>
                  <dt className="text-muted-foreground">Устройств</dt>
                  <dd className="text-right tabular-nums">{b.pairedCount}</dd>
                  <dt className="text-muted-foreground">Heartbeat</dt>
                  <dd className="text-right">{formatDateTime(b.lastHeartbeatAt)}</dd>
                </dl>
                <div className="mt-3">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] text-[12px]"
                    disabled={commandBusyKey === `bridge:${b.id}`}
                    onClick={() => void runBridgeHealthCheck(b)}
                  >
                    {commandBusyKey === `bridge:${b.id}` ? "Ставим в очередь..." : "Проверить мост"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Filters */}
        <Card className="p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Фильтр устройств" className="flex flex-wrap gap-1">
              {FILTERS.map((f) => {
                const active = filter === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f.key)}
                    className={`min-h-[44px] rounded-md border px-3 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[32px] ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-surface text-foreground hover:bg-muted"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <label className="relative block w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по модели или серии"
                aria-label="Поиск устройств"
                className="h-11 pl-7 text-[12px] sm:h-9"
              />
            </label>
          </div>
        </Card>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        {/* Devices */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Устройства
          </h2>

          {/* Desktop */}
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Модель</th>
                  <th className="px-3 py-2">Серия</th>
                  <th className="px-3 py-2">Прошивка</th>
                  <th className="px-3 py-2">Увеличение</th>
                  <th className="px-3 py-2">Поляризация</th>
                  <th className="px-3 py-2">Калибровка</th>
                  <th className="px-3 py-2">Bridge</th>
                  <th className="px-3 py-2">Last seen</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{d.model}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{d.serial}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.firmware}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.magnification}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.polarization}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.calibrationProfile}</td>
                    <td className="px-3 py-2 font-mono text-[11px]">{d.bridgeId ?? "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateTime(d.lastSeenAt)}</td>
                    <td className="px-3 py-2">
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: STATUS_TONE[d.derivedStatus],
                          border: `1px solid ${STATUS_TONE[d.derivedStatus]}`,
                        }}
                      >
                        {STATUS_LABEL[d.derivedStatus]}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          disabled={commandBusyKey === `device_calibration_request:${d.id}`}
                          onClick={() => void runDeviceCommand(d, "device_calibration_request")}
                        >
                          {commandBusyKey === `device_calibration_request:${d.id}` ? "Ставим..." : "Запросить калибровку"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          disabled={commandBusyKey === `device_stream_open_request:${d.id}`}
                          onClick={() => void runDeviceCommand(d, "device_stream_open_request")}
                        >
                          {commandBusyKey === `device_stream_open_request:${d.id}` ? "Ставим..." : "Открыть поток"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* Mobile */}
          <div className="grid grid-cols-1 gap-2 md:hidden">
            {visible.map((d) => (
              <Card key={d.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold">{d.model}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">{d.serial}</div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: STATUS_TONE[d.derivedStatus],
                      border: `1px solid ${STATUS_TONE[d.derivedStatus]}`,
                    }}
                  >
                    {STATUS_LABEL[d.derivedStatus]}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                  <dt className="text-muted-foreground">Прошивка</dt>
                  <dd className="text-right">{d.firmware}</dd>
                  <dt className="text-muted-foreground">Увеличение</dt>
                  <dd className="text-right">{d.magnification}</dd>
                  <dt className="text-muted-foreground">Поляризация</dt>
                  <dd className="text-right">{d.polarization}</dd>
                  <dt className="text-muted-foreground">Калибровка</dt>
                  <dd className="text-right">{d.calibrationProfile}</dd>
                  <dt className="text-muted-foreground">Bridge</dt>
                  <dd className="text-right font-mono text-[11px]">{d.bridgeId ?? "—"}</dd>
                  <dt className="text-muted-foreground">Last seen</dt>
                  <dd className="text-right">{formatDateTime(d.lastSeenAt)}</dd>
                </dl>
                <div className="mt-3 flex flex-col gap-1.5">
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    disabled={commandBusyKey === `device_calibration_request:${d.id}`}
                    onClick={() => void runDeviceCommand(d, "device_calibration_request")}
                  >
                    {commandBusyKey === `device_calibration_request:${d.id}` ? "Ставим..." : "Запросить калибровку"}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] text-[12px]"
                    disabled={commandBusyKey === `device_stream_open_request:${d.id}`}
                    onClick={() => void runDeviceCommand(d, "device_stream_open_request")}
                  >
                    {commandBusyKey === `device_stream_open_request:${d.id}` ? "Ставим..." : "Открыть поток"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <ListPagination
            page={pagination.page}
            pageCount={pagination.pageCount}
            total={pagination.total}
            rangeLabel={pagination.rangeLabel}
            canPrev={pagination.canPrev}
            canNext={pagination.canNext}
            onPageChange={pagination.setPage}
            itemNoun="устройств"
          />
        </section>
      </div>
    </div>
  );
}

function WorkerMetric({ label, value }: { label: string; value: number }) {
  return (
    <div
      role="region"
      aria-label={label}
      className="rounded-md border border-border bg-surface px-3 py-2"
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[18px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
