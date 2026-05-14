import { useEffect, useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { getDevices } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  listSelfHostedDeviceBridges,
  listSelfHostedDevices,
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

function bridgeFromDto(dto: SelfHostedDeviceBridgeDTO): BridgeRow {
  return {
    id: dto.bridgeCode,
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
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!session.apiToken) {
      setLiveDevices(null);
      setLiveBridges(null);
      setLoadStatus("idle");
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadStatus("loading");
    setLoadError(null);
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
    ]).then(([bridgeResult, deviceResult]) => {
      if (cancelled) return;
      if (!bridgeResult.ok || !deviceResult.ok) {
        setLoadStatus("error");
        setLoadError(bridgeResult.error?.message || deviceResult.error?.message || "Не удалось загрузить устройства.");
        setLiveDevices(null);
        setLiveBridges(null);
        return;
      }
      setLiveBridges((bridgeResult.value ?? []).map(bridgeFromDto));
      setLiveDevices((deviceResult.value ?? []).map(deviceFromDto));
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
                    <td className="px-3 py-2 font-mono text-[11px]">{b.id}</td>
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
                          onClick={() => setNote(isLive ? `Проверка моста ${b.id} выполняется через backend registry.` : `Проверка моста ${b.id} — демо-действие.`)}
                        >
                          Проверить мост (демо)
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
                    <div className="truncate font-mono text-[12px] font-semibold">{b.id}</div>
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
                    onClick={() => setNote(isLive ? `Проверка моста ${b.id} выполняется через backend registry.` : `Проверка моста ${b.id} — демо-действие.`)}
                  >
                    Проверить мост (демо)
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
                          onClick={() => setNote(isLive ? `Калибровка ${d.serial} фиксируется через Device Bridge, не через браузер.` : `Калибровка ${d.serial} — демо.`)}
                        >
                          Сымитировать калибровку
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(isLive ? `Поток ${d.serial} открывается через локальный Device Bridge компонент.` : `Открытие потока ${d.serial} появится с Device Bridge.`)}
                        >
                          Открыть поток (демо)
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
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(isLive ? `Калибровка ${d.serial} фиксируется через Device Bridge, не через браузер.` : `Калибровка ${d.serial} — демо.`)}>
                    Сымитировать калибровку
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(isLive ? `Поток ${d.serial} открывается через локальный Device Bridge компонент.` : `Открытие потока ${d.serial} появится с Device Bridge.`)}>
                    Открыть поток (демо)
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
