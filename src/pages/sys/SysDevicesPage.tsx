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
  getSelfHostedDeviceBridgeFleetReliability,
  getSelfHostedDeviceBridgeLifecycleAssurance,
  getSelfHostedDeviceBridgeOperationsContinuity,
  getSelfHostedDeviceBridgeProductionReadiness,
  recoverSelfHostedDeviceBridgeWorkerCommand,
  replaySelfHostedDeviceBridgeCommand,
  requestSelfHostedBridgeCommand,
  requestSelfHostedDeviceCommand,
  type SelfHostedDeviceBridgeCommandAuditDTO,
  type SelfHostedDeviceBridgeFleetReliabilityDTO,
  type SelfHostedDeviceBridgeLifecycleAssuranceDTO,
  type SelfHostedDeviceBridgeOperationsContinuityDTO,
  type SelfHostedDeviceBridgeProductionReadinessDTO,
  type SelfHostedDeviceBridgeWorkerHardeningDTO,
  type SelfHostedDeviceBridgeWorkerRecoveryDTO,
  type SelfHostedDeviceBridgeWorkerStatusDTO,
  type SelfHostedDeviceBridgeDTO,
  type SelfHostedDeviceDTO,
} from "@/lib/self-hosted-device-api";
import type { Device } from "@/lib/domain";

/**
 * Sys Devices — мост устройств и электронные дерматоскопы.
 * SAFETY: только метаданные устройств. Никаких WebUSB/WebBluetooth/WebSerial.
 */

const DEMO_BANNER =
  "Учебный режим. Рабочие роли, аудит, ключи и мост устройств включаются после подключения системы клиники.";

const LIVE_BANNER =
  "Рабочая система подключена. Устройства и мосты читаются из серверного реестра клиники.";

const BRIDGE_NOTE =
  "Браузер не подключается к драйверу напрямую. Обмен с дерматоскопами идёт через локальный мост устройств.";

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
  online: "Служба на связи",
  degraded: "Связь нестабильна",
  offline: "Служба не в сети",
  unknown: "Связь не проверена",
  ready: "Готово",
  ok: "Готово",
  blocked: "Блокер",
  warning: "Требует внимания",
  needs_review: "Нужен разбор",
  ready_for_production: "Готово к работе",
  ready_for_rollout: "Готово к включению",
  ready_for_handoff: "Готово к передаче",
  in_review: "На разборе",
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

const POLARIZATION_LABEL: Record<string, string> = {
  polarized: "поляризация",
  non_polarized: "без поляризации",
  both: "оба режима",
};

function polarizationLabel(value: string): string {
  return POLARIZATION_LABEL[value] ?? "не указано";
}

function sysDeviceStatusLabel(value: string | undefined): string {
  if (!value) return "нет данных";
  return (
    WORKER_STATUS_LABEL[value] ??
    COMMAND_STATUS_LABEL[value] ??
    {
      passed: "Пройдено",
      attention: "Требует внимания",
      ready: "Готово",
      failed: "Ошибка",
      active: "Активно",
    }[value] ??
    value
  );
}

function sysDeviceText(value: string | undefined): string {
  if (!value) return "нет данных";
  const labels: Record<string, string> = {
    "Worker heartbeat telemetry": "Связь службы моста",
    "Worker health pressure": "Давление состояния службы",
    "1 bridge worker visible.": "Мост на связи: 1.",
    "1 stale worker.": "Устаревших служб: 1.",
    "Incident drill register": "Реестр учений по инцидентам",
    "Incident drills are repository-defined.": "Учения по инцидентам описаны в проекте.",
    "Next batch handoff": "Передача следующего шага",
    "Stage 9B-9D remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 9N-9Z remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Stage 10A-10L remains a hypothesis.": "Следующий шаг пока не включён в интерфейс.",
    "Incident pressure reviewed": "Давление инцидентов проверено",
    "Self-hosted product boundary": "Граница продукта клиники",
    "none/none.": "внешние зависимости отсутствуют.",
    "Fleet reliability register": "Реестр надёжности парка",
    "Fleet reliability is repository-defined.": "Надёжность парка описана в проекте.",
    "Command SLO reviewed": "Норма обработки команд проверена",
    "Lifecycle assurance register": "Реестр жизненного цикла",
    "Lifecycle assurance is repository-defined.": "Жизненный цикл описан в проекте.",
    "Maintenance window reviewed": "Окно обслуживания проверено",
    "Review required.": "Нужен разбор.",
    "backend_only": "только рабочая система",
    "backend-only": "только рабочая система",
    audit: "аудит",
    manual: "вручную",
    manual_system_admin: "вручную системным администратором",
    none: "нет",
  };
  if (labels[value]) return labels[value];
  const commandCount = value.match(/^(\d+) command\(s\)\.$/);
  if (commandCount) return `команд: ${commandCount[1]}.`;
  return value;
}

function bridgeLabel(bridges: BridgeRow[], bridgeId: string | null | undefined): string {
  if (!bridgeId) return "—";
  const index = bridges.findIndex((bridge) => bridge.id === bridgeId || bridge.code === bridgeId);
  return index >= 0 ? `Мост ${index + 1}` : "мост скрыт";
}

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
  const [productionReadiness, setProductionReadiness] = useState<SelfHostedDeviceBridgeProductionReadinessDTO | null>(null);
  const [productionReadinessError, setProductionReadinessError] = useState<string | null>(null);
  const [operationsContinuity, setOperationsContinuity] = useState<SelfHostedDeviceBridgeOperationsContinuityDTO | null>(null);
  const [operationsContinuityError, setOperationsContinuityError] = useState<string | null>(null);
  const [fleetReliability, setFleetReliability] = useState<SelfHostedDeviceBridgeFleetReliabilityDTO | null>(null);
  const [fleetReliabilityError, setFleetReliabilityError] = useState<string | null>(null);
  const [lifecycleAssurance, setLifecycleAssurance] = useState<SelfHostedDeviceBridgeLifecycleAssuranceDTO | null>(null);
  const [lifecycleAssuranceError, setLifecycleAssuranceError] = useState<string | null>(null);
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
      setProductionReadiness(null);
      setProductionReadinessError(null);
      setOperationsContinuity(null);
      setOperationsContinuityError(null);
      setFleetReliability(null);
      setFleetReliabilityError(null);
      setLifecycleAssurance(null);
      setLifecycleAssuranceError(null);
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
    setProductionReadinessError(null);
    setOperationsContinuityError(null);
    setFleetReliabilityError(null);
    setLifecycleAssuranceError(null);
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
      getSelfHostedDeviceBridgeProductionReadiness({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      getSelfHostedDeviceBridgeOperationsContinuity({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      getSelfHostedDeviceBridgeFleetReliability({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
      getSelfHostedDeviceBridgeLifecycleAssurance({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
      }),
    ]).then(([bridgeResult, deviceResult, workerResult, hardeningResult, recoveryResult, auditResult, readinessResult, continuityResult, reliabilityResult, assuranceResult]) => {
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
        setProductionReadiness(null);
        setOperationsContinuity(null);
        setFleetReliability(null);
        setLifecycleAssurance(null);
        return;
      }
      setLiveBridges((bridgeResult.value ?? []).map(bridgeFromDto));
      setLiveDevices((deviceResult.value ?? []).map(deviceFromDto));
      if (workerResult?.ok) {
        setWorkerStatus(workerResult.value ?? null);
      } else {
        setWorkerStatus(null);
        setWorkerStatusError(workerResult?.error?.message || "Не удалось загрузить состояние службы моста устройств.");
      }
      if (hardeningResult?.ok) {
        setWorkerHardening(hardeningResult.value ?? null);
      } else {
        setWorkerHardening(null);
        setWorkerHardeningError(
          hardeningResult?.error?.message || "Не удалось загрузить проверку устойчивости моста устройств.",
        );
      }
      if (recoveryResult?.ok) {
        setWorkerRecovery(recoveryResult.value ?? null);
      } else {
        setWorkerRecovery(null);
        setWorkerRecoveryError(
          recoveryResult?.error?.message || "Не удалось загрузить восстановление команд моста устройств.",
        );
      }
      if (auditResult?.ok) {
        setWorkerAudit(auditResult.value ?? null);
      } else {
        setWorkerAudit(null);
        setWorkerAuditError(
          auditResult?.error?.message || "Не удалось загрузить журнал команд моста устройств.",
        );
      }
      if (readinessResult?.ok) {
        setProductionReadiness(readinessResult.value ?? null);
      } else {
        setProductionReadiness(null);
        setProductionReadinessError(
          readinessResult?.error?.message || "Не удалось загрузить готовность моста устройств.",
        );
      }
      if (continuityResult?.ok) {
        setOperationsContinuity(continuityResult.value ?? null);
      } else {
        setOperationsContinuity(null);
        setOperationsContinuityError(
          continuityResult?.error?.message || "Не удалось загрузить непрерывность работы моста устройств.",
        );
      }
      if (reliabilityResult?.ok) {
        setFleetReliability(reliabilityResult.value ?? null);
      } else {
        setFleetReliability(null);
        setFleetReliabilityError(
          reliabilityResult?.error?.message || "Не удалось загрузить надёжность парка мостов устройств.",
        );
      }
      if (assuranceResult?.ok) {
        setLifecycleAssurance(assuranceResult.value ?? null);
      } else {
        setLifecycleAssurance(null);
        setLifecycleAssuranceError(
          assuranceResult?.error?.message || "Не удалось загрузить жизненный цикл моста устройств.",
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
    const label = bridgeLabel(bridges, bridge.id);
    if (!isLive || !session.apiToken) {
      setNote(`Проверка «${label}» — учебное действие.`);
      return;
    }
    const key = `bridge:${bridge.id}`;
    setCommandBusyKey(key);
    setNote(`Команда проверки «${label}» отправляется в рабочую систему.`);
    const result = await requestSelfHostedBridgeCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      bridgeId: bridge.id,
      commandType: "bridge_health_check",
      reason: "Проверка сети и связи из системной страницы устройств.",
    });
    setCommandBusyKey(null);
    setNote(
      result.ok
        ? `Команда проверки «${label}» поставлена в очередь моста устройств.`
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
          ? "Калибровка устройства — учебное действие."
          : "Просмотр потока появится после подключения моста устройств.",
      );
      return;
    }
    const key = `${commandType}:${device.id}`;
    setCommandBusyKey(key);
    setNote(
      isCalibration
        ? "Команда калибровки отправляется в рабочую систему."
        : "Команда просмотра потока отправляется в рабочую систему.",
    );
    const result = await requestSelfHostedDeviceCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      deviceId: device.id,
      commandType,
      reason: isCalibration
        ? "Запрос калибровки из системной страницы устройств."
        : "Запрос просмотра потока через локальный мост устройств.",
    });
    setCommandBusyKey(null);
    setNote(
      result.ok
        ? (
            isCalibration
              ? "Команда калибровки поставлена в очередь моста устройств."
              : "Команда просмотра потока поставлена в очередь моста устройств."
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
        ? "Команда моста устройств отправляется на повторную постановку в очередь."
        : "Команда моста устройств отменяется через восстановление.",
    );
    const result = await recoverSelfHostedDeviceBridgeWorkerCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      commandId,
      action,
      reason: action === "reschedule"
        ? "Повторная постановка из панели восстановления."
        : "Отмена из панели восстановления.",
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
          ? "Команда возвращена в очередь моста устройств."
          : "Команда отменена через восстановление моста устройств.",
      );
      return;
    }
    setNote(result.error?.message || "Не удалось восстановить команду моста устройств.");
  }

  async function replayWorkerCommand(commandId: string) {
    if (!isLive || !session.apiToken) return;
    const key = `replay:${commandId}`;
    setCommandBusyKey(key);
    setNote("Повтор команды моста устройств создаётся без раскрытия содержимого в интерфейсе.");
    const result = await replaySelfHostedDeviceBridgeCommand({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      commandId,
      reason: "Ручной повтор из панели журнала команд.",
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
      setNote("Повтор команды поставлен в очередь моста устройств.");
      return;
    }
    setNote(result.error?.message || "Не удалось повторить команду моста устройств.");
  }

  async function exportWorkerAudit() {
    if (!isLive || !session.apiToken || auditExportBusy) return;
    setAuditExportBusy(true);
    setNote("Готовим безопасный табличный экспорт журнала команд моста устройств.");
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
      setNote("Экспорт журнала команд моста устройств скачан.");
      return;
    }
    setNote(result.error?.message || "Не удалось экспортировать журнал команд моста устройств.");
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Устройства" subtitle="Мост устройств и электронные дерматоскопы." />

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
            {loadStatus === "loading" && "Загружаем реестр устройств из рабочей системы."}
            {loadStatus === "ready" && "Реестр устройств загружен из рабочей системы."}
            {loadStatus === "error" && (loadError || "Не удалось загрузить реестр устройств.")}
          </div>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Наблюдение службы моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" aria-hidden />
                Служба моста устройств
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Состояние службы
              </span>
            </div>
            <Card className="p-3">
              {workerStatus ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
                    <WorkerMetric label="Мосты" value={workerStatus.summary.bridgeCount} />
                    <WorkerMetric label="На связи" value={workerStatus.summary.onlineWorkers} />
                    <WorkerMetric label="Снижено" value={workerStatus.summary.degradedWorkers} />
                    <WorkerMetric label="Нет связи" value={workerStatus.summary.offlineWorkers} />
                    <WorkerMetric label="В очереди" value={workerStatus.summary.queuedCommands} />
                    <WorkerMetric label="Ошибки" value={workerStatus.summary.failedCommands} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
                    <div
                      role="region"
                      aria-label="Список связи моста устройств"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Связь
                      </div>
                      <div className="divide-y divide-border/70">
                        {workerStatus.items.length > 0 ? workerStatus.items.map((bridge) => (
                          <div key={bridge.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto] sm:items-center">
                            <div className="min-w-0">
                              <div className="truncate font-mono text-[11px] font-semibold">{bridge.bridgeCode}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                адрес скрыт · версия {bridge.workerVersion || "не указана"}
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
                            Данные службы пока не поступали.
                          </div>
                        )}
                      </div>
                    </div>

                    <div
                      role="region"
                      aria-label="Жизненный цикл команд моста устройств"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Жизненный цикл команд
                      </div>
                      <div className="divide-y divide-border/70">
                        {workerStatus.commands.slice(0, 5).map((command) => (
                          <div key={command.id} className="px-3 py-2 text-[12px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-[11px]">Служебная команда</span>
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
                            Команд службы пока нет.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных службы моста устройств"
                    className="flex items-start gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>
                      Показываются только служебные метаданные. Секреты, сырые команды,
                      пути хранения, имена пациентов и аппаратный доступ браузера не выводятся.
                    </span>
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerStatusError || "Служба моста устройств ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Устойчивость службы моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Устойчивость службы
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Проверки устойчивости
              </span>
            </div>
            <Card className="p-3">
              {workerHardening ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <WorkerMetric label="Устарели" value={workerHardening.summary.staleWorkers} />
                    <WorkerMetric label="Повторяются" value={workerHardening.summary.retryingCommands} />
                    <WorkerMetric label="Отложены" value={workerHardening.summary.rateLimitedCommands} />
                    <WorkerMetric label="Возраст очереди" value={workerHardening.summary.maxQueueAgeSeconds} />
                    <WorkerMetric label="На очистку" value={workerHardening.summary.cleanupCandidates} />
                  </div>
                  <div
                    role="region"
                    aria-label="Правила устойчивости моста устройств"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Правила устойчивости</div>
                    <div className="mt-1">
                      устаревает через {workerHardening.policy.staleAfterMinutes} мин · хранение {workerHardening.policy.retentionDays} дн. · задержка {workerHardening.policy.pollBackoff} · лимит опроса {workerHardening.policy.maxPollLimit}
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Список устойчивости моста устройств"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Состояние устойчивости
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerHardening.items.length > 0 ? workerHardening.items.slice(0, 5).map((bridge) => (
                        <div key={bridge.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-semibold">{bridge.bridgeCode}</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              адрес скрыт · версия {bridge.workerVersion || "не указана"}
                            </div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {bridge.stale ? "устарел" : "актуален"}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            повтор {bridge.retryingCommandCount} / отложено {bridge.rateLimitedCommandCount}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            очередь {bridge.maxQueueAgeSeconds} с
                          </span>
                        </div>
                      )) : (
                        <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                          Данные устойчивости пока не поступали.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных устойчивости моста устройств"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Показываются только агрегированные сигналы: устаревшие службы, возраст очереди,
                    давление повторов и кандидаты на очистку. Секреты службы, сырые команды,
                    пути хранения, имена пациентов и аппаратный доступ браузера не выводятся.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerHardeningError || "Устойчивость моста устройств ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Восстановление команд моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Восстановление команд
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Очередь восстановления
              </span>
            </div>
            <Card className="p-3">
              {workerRecovery ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    <WorkerMetric label="Зависли" value={workerRecovery.summary.stuckCommands} />
                    <WorkerMetric label="Истекли" value={workerRecovery.summary.expiredCommands} />
                    <WorkerMetric label="Аренда истекла" value={workerRecovery.summary.leaseExpiredCommands} />
                    <WorkerMetric label="Можно повторить" value={workerRecovery.summary.retryableCommands} />
                    <WorkerMetric label="Можно отменить" value={workerRecovery.summary.cancellableCommands} />
                  </div>
                  <div
                    role="region"
                    aria-label="Правила восстановления команд"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Правила восстановления</div>
                    <div className="mt-1">
                      устаревает через {workerRecovery.policy.staleAfterMinutes} мин · срок аренды {workerRecovery.policy.leaseTtlSeconds} с · максимум за раз {workerRecovery.policy.maxRecoveryBatch}
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Очередь восстановления команд"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Команды для восстановления
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerRecovery.items.length > 0 ? workerRecovery.items.slice(0, 5).map((command) => (
                        <div key={command.id} className="grid gap-2 px-3 py-2 text-[12px] lg:grid-cols-[1fr_auto_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate text-[11px] font-semibold">Служебная команда</div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {command.bridgeCode ?? "мост"} · состояние {command.recoveryState ?? "активно"} · попытки {command.attemptCount}
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
                          Команд для восстановления пока нет.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных восстановления команд"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Управляются только служебные метаданные: аренда, повторы, отмена и аудит
                    восстановления. Секреты службы, сырые команды, пути хранения, имена пациентов
                    и аппаратный доступ браузера не выводятся.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerRecoveryError || "Восстановление команд ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Аудит и повтор команд моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Аудит и повтор команд
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
                  {auditExportBusy ? "Скачиваем..." : "Скачать журнал"}
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Безопасная выгрузка аудита
                </span>
              </div>
            </div>
            <Card className="p-3">
              {workerAudit ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <WorkerMetric label="События аудита" value={workerAudit.summary.totalEvents} />
                    <WorkerMetric label="Повторы" value={workerAudit.summary.replayEvents} />
                    <WorkerMetric label="Восстановления" value={workerAudit.summary.recoveryEvents} />
                    <WorkerMetric label="Команды" value={workerAudit.summary.affectedCommands} />
                  </div>
                  <div
                    role="region"
                    aria-label="Правила повтора команд"
                    className="rounded-md border border-border px-3 py-2 text-[12px] text-muted-foreground"
                  >
                    <div className="font-semibold text-foreground">Правила повтора</div>
                    <div className="mt-1">
                      политика {sysDeviceText(workerAudit.policy.replayPolicy)} · видимость данных {sysDeviceText(workerAudit.policy.payloadVisibility)} · типы команд скрыты
                    </div>
                  </div>
                  <div
                    role="region"
                    aria-label="Журнал аудита команд"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Безопасный аудит команд
                    </div>
                    <div className="divide-y divide-border/70">
                      {workerAudit.items.length > 0 ? workerAudit.items.slice(0, 5).map((event) => (
                        <div key={event.id} className="grid gap-2 px-3 py-2 text-[12px] lg:grid-cols-[1fr_auto_auto] lg:items-center">
                          <div className="min-w-0">
                            <div className="truncate font-mono text-[11px] font-semibold">
                              Событие аудита · служебная команда
                            </div>
                            <div className="truncate text-[11px] text-muted-foreground">
                              {event.bridgeCode ?? "мост"} · {event.status} · ревизия {event.lifecycleRevision}
                            </div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {sysDeviceText(event.replayPolicy ?? "audit")}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-9 min-h-[44px] sm:min-h-[32px]"
                            disabled={!event.commandId || commandBusyKey === `replay:${event.commandId}`}
                            onClick={() => event.commandId ? void replayWorkerCommand(event.commandId) : undefined}
                          >
                            {event.commandId && commandBusyKey === `replay:${event.commandId}` ? "Создаём..." : "Повторить"}
                          </Button>
                        </div>
                      )) : (
                        <div role="status" className="px-3 py-4 text-[12px] text-muted-foreground">
                          Аудит команд пока пуст.
                        </div>
                      )}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных аудита команд"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Показывается только аудит без изменений задним числом и правила повтора.
                    Сырые данные аудита, команды, секреты службы, пути хранения, имена пациентов
                    и аппаратный доступ браузера не выводятся.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {workerAuditError || "Аудит команд ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Готовность моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Готовность моста устройств
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Проверка перед рабочим использованием
              </span>
            </div>
            <Card className="p-3">
              {productionReadiness ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <WorkerMetric label="Готовность, %" value={productionReadiness.readiness.completionPercent} />
                    <WorkerMetric label="Мосты" value={productionReadiness.readiness.summary.bridgeCount} />
                    <WorkerMetric label="Устарели" value={productionReadiness.readiness.summary.staleWorkers} />
                    <WorkerMetric label="Ошибки" value={productionReadiness.readiness.summary.failedCommands} />
                    <WorkerMetric label="Зависли" value={productionReadiness.readiness.summary.stuckCommands} />
                    <WorkerMetric label="Аудит" value={productionReadiness.readiness.summary.auditEvents} />
                  </div>
                  <div
                    role="region"
                    aria-label="Проверки готовности моста устройств"
                    className="rounded-md border border-border"
                  >
                    <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Проверки готовности · {sysDeviceStatusLabel(productionReadiness.readiness.status)}
                    </div>
                    <div className="divide-y divide-border/70">
                      {productionReadiness.readiness.gates.map((gate) => (
                        <div key={gate.key} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            <div className="font-medium text-foreground">{sysDeviceText(gate.label)}</div>
                            <div className="text-[11px] text-muted-foreground">{sysDeviceText(gate.detail)}</div>
                          </div>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {sysDeviceStatusLabel(gate.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных готовности моста устройств"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Показываются только безопасные агрегаты жизненного цикла из PostgreSQL.
                    Видимость данных: только служебные метаданные; внешняя среда{" "}
                    {sysDeviceText(productionReadiness.readiness.policy.managedRuntimeDependency)}; аппаратный доступ браузера{" "}
                    {productionReadiness.readiness.policy.browserHardwareApis ? "включён" : "выключен"}.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {productionReadinessError || "Готовность моста устройств ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Непрерывность операций моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Непрерывность операций
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Контроль рабочих процессов
              </span>
            </div>
            <Card className="p-3">
              {operationsContinuity ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <WorkerMetric label="Готовность, %" value={operationsContinuity.continuity.completionPercent} />
                    <WorkerMetric label="Давление очереди" value={operationsContinuity.continuity.summary.queuePressure} />
                    <WorkerMetric label="Требуют внимания" value={operationsContinuity.continuity.summary.attentionGateCount} />
                    <WorkerMetric label="Устарели" value={operationsContinuity.continuity.summary.staleWorkers} />
                    <WorkerMetric label="Аудит" value={operationsContinuity.continuity.summary.auditEvents} />
                    <WorkerMetric label="Шаги" value={operationsContinuity.continuity.stages.length} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div
                      role="region"
                      aria-label="Шаги непрерывности операций"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Шаги непрерывности · {sysDeviceStatusLabel(operationsContinuity.continuity.status)}
                      </div>
                      <div className="divide-y divide-border/70">
                        {operationsContinuity.continuity.stages.map((stage, index) => (
                          <div key={stage.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <span className="text-[11px] text-muted-foreground">Шаг {index + 1}</span>
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(stage.title)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(stage.summary)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(stage.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      role="region"
                      aria-label="Проверки непрерывности операций"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Проверки непрерывности
                      </div>
                      <div className="divide-y divide-border/70">
                        {operationsContinuity.continuity.gates.map((gate) => (
                          <div key={gate.key} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(gate.label)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(gate.detail)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(gate.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных непрерывности операций"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Публикуются только служебные метаданные непрерывности. Внешняя среда{" "}
                    {sysDeviceText(operationsContinuity.continuity.productBoundary.managedRuntimeDependency)}; внешняя база{" "}
                    {sysDeviceText(operationsContinuity.continuity.productBoundary.managedDatabaseDependency)}; видимость данных:
                    только служебные метаданные; следующий шаг скрыт из интерфейса.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {operationsContinuityError || "Непрерывность операций ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Надёжность парка мостов устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <RadioTower className="h-3.5 w-3.5" aria-hidden />
                Надёжность парка
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Контроль устойчивости парка
              </span>
            </div>
            <Card className="p-3">
              {fleetReliability ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <WorkerMetric label="Надёжность, %" value={fleetReliability.reliability.completionPercent} />
                    <WorkerMetric label="Внимание" value={fleetReliability.reliability.summary.fleetAttention} />
                    <WorkerMetric label="Давление очереди" value={fleetReliability.reliability.summary.queuePressure} />
                    <WorkerMetric label="Устарели" value={fleetReliability.reliability.summary.staleWorkers} />
                    <WorkerMetric label="Норма, мин" value={fleetReliability.reliability.sloPolicy.commandQueueReviewMinutes} />
                    <WorkerMetric label="Шаги" value={fleetReliability.reliability.stages.length} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div
                      role="region"
                      aria-label="Шаги надёжности парка"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Шаги надёжности · {sysDeviceStatusLabel(fleetReliability.reliability.status)}
                      </div>
                      <div className="divide-y divide-border/70">
                        {fleetReliability.reliability.stages.map((stage, index) => (
                          <div key={stage.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <span className="text-[11px] text-muted-foreground">Шаг {index + 1}</span>
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(stage.title)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(stage.summary)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(stage.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      role="region"
                      aria-label="Проверки надёжности парка"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Проверки надёжности
                      </div>
                      <div className="divide-y divide-border/70">
                        {fleetReliability.reliability.gates.map((gate) => (
                          <div key={gate.key} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(gate.label)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(gate.detail)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(gate.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных надёжности парка"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Показываются только агрегаты надёжности парка. Внешняя среда{" "}
                    {sysDeviceText(fleetReliability.reliability.productBoundary.managedRuntimeDependency)}; внешняя база{" "}
                    {sysDeviceText(fleetReliability.reliability.productBoundary.managedDatabaseDependency)}; видимость данных:
                    только служебные метаданные; следующий шаг скрыт из интерфейса.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {fleetReliabilityError || "Надёжность парка ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {isLive && (
          <section
            className="space-y-2"
            aria-label="Контроль жизненного цикла моста устройств"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                Контроль жизненного цикла
              </h2>
              <span className="text-[11px] text-muted-foreground">
                Обслуживание и передача смены
              </span>
            </div>
            <Card className="p-3">
              {lifecycleAssurance ? (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                    <WorkerMetric label="Готовность, %" value={lifecycleAssurance.assurance.completionPercent} />
                    <WorkerMetric label="Долг контроля" value={lifecycleAssurance.assurance.summary.assuranceDebt} />
                    <WorkerMetric label="Обновление" value={lifecycleAssurance.assurance.summary.upgradePressure} />
                    <WorkerMetric label="Обслуживание" value={lifecycleAssurance.assurance.summary.maintenanceDue ? "Да" : "Нет"} />
                    <WorkerMetric label="Хранение" value={lifecycleAssurance.assurance.summary.retentionReviewDue ? "Да" : "Нет"} />
                    <WorkerMetric label="Шаги" value={lifecycleAssurance.assurance.stages.length} />
                  </div>
                  <div className="grid gap-3 lg:grid-cols-2">
                    <div
                      role="region"
                      aria-label="Шаги жизненного цикла"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Шаги жизненного цикла · {sysDeviceStatusLabel(lifecycleAssurance.assurance.status)}
                      </div>
                      <div className="divide-y divide-border/70">
                        {lifecycleAssurance.assurance.stages.map((stage, index) => (
                          <div key={stage.id} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[auto_1fr_auto] sm:items-center">
                            <span className="text-[11px] text-muted-foreground">Шаг {index + 1}</span>
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(stage.title)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(stage.summary)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(stage.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div
                      role="region"
                      aria-label="Проверки жизненного цикла"
                      className="rounded-md border border-border"
                    >
                      <div className="border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Проверки жизненного цикла
                      </div>
                      <div className="divide-y divide-border/70">
                        {lifecycleAssurance.assurance.gates.map((gate) => (
                          <div key={gate.key} className="grid gap-2 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                              <div className="font-medium text-foreground">{sysDeviceText(gate.label)}</div>
                              <div className="text-[11px] text-muted-foreground">{sysDeviceText(gate.detail)}</div>
                            </div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {sysDeviceStatusLabel(gate.status)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div
                    role="note"
                    aria-label="Граница данных жизненного цикла"
                    className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground"
                  >
                    Закрываются только служебные признаки обслуживания, обновления службы,
                    хранения аудита и передачи смены. Внешняя среда{" "}
                    {sysDeviceText(lifecycleAssurance.assurance.productBoundary.managedRuntimeDependency)};
                    внешняя база {sysDeviceText(lifecycleAssurance.assurance.productBoundary.managedDatabaseDependency)};
                    видимость данных: только служебные метаданные;
                    следующий шаг скрыт из интерфейса.
                  </div>
                </div>
              ) : (
                <div role="status" className="text-[12px] text-muted-foreground">
                  {lifecycleAssuranceError || "Жизненный цикл моста устройств ожидает ответ рабочей системы."}
                </div>
              )}
            </Card>
          </section>
        )}

        {/* Bridges */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Мост устройств
          </h2>
          <Card className="hidden p-0 md:block">
            <table className="w-full text-[12px]">
              <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Мост</th>
                  <th className="px-3 py-2">Адрес</th>
                  <th className="px-3 py-2">Сеть</th>
                  <th className="px-3 py-2">Версия</th>
                  <th className="px-3 py-2 text-right">Устройств</th>
                  <th className="px-3 py-2">Проверка связи</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {bridges.map((b, index) => (
                  <tr key={b.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">Мост {index + 1}</td>
                    <td className="px-3 py-2 text-muted-foreground">скрыт</td>
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
            {bridges.map((b, index) => (
              <Card key={b.id} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold">Мост {index + 1}</div>
                    <div className="truncate text-[11px] text-muted-foreground">адрес скрыт</div>
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
                  <dt className="text-muted-foreground">Проверка связи</dt>
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
                  <th className="px-3 py-2">Мост</th>
                  <th className="px-3 py-2">Последняя связь</th>
                  <th className="px-3 py-2">Статус</th>
                  <th className="px-3 py-2 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2 font-medium">{d.model}</td>
                    <td className="px-3 py-2 text-muted-foreground">скрыта</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.firmware}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.magnification}</td>
                    <td className="px-3 py-2 text-muted-foreground">{polarizationLabel(d.polarization)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{d.calibrationProfile}</td>
                    <td className="px-3 py-2 text-muted-foreground">{bridgeLabel(bridges, d.bridgeId)}</td>
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
                          {commandBusyKey === `device_stream_open_request:${d.id}` ? "Ставим..." : "Открыть просмотр"}
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
                    <div className="truncate text-[11px] text-muted-foreground">серия скрыта</div>
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
                  <dd className="text-right">{polarizationLabel(d.polarization)}</dd>
                  <dt className="text-muted-foreground">Калибровка</dt>
                  <dd className="text-right">{d.calibrationProfile}</dd>
                  <dt className="text-muted-foreground">Мост</dt>
                  <dd className="text-right">{bridgeLabel(bridges, d.bridgeId)}</dd>
                  <dt className="text-muted-foreground">Последняя связь</dt>
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
                    {commandBusyKey === `device_stream_open_request:${d.id}` ? "Ставим..." : "Открыть просмотр"}
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

function WorkerMetric({ label, value }: { label: string; value: number | string }) {
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
