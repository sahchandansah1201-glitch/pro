import { useMemo, useState } from "react";
import { ShieldAlert, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListPagination } from "@/components/admin/ListPagination";
import { useListPagination } from "@/lib/use-list-pagination";
import { getDevices } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";

/**
 * Sys Devices — Device Bridge и электронные дерматоскопы (MVP).
 * SAFETY: только метаданные устройств. Никаких WebUSB/WebBluetooth/WebSerial.
 */

const DEMO_BANNER =
  "Демо-режим. Реальные роли, RLS, аудит, ключи и Device Bridge включаются на этапе бэкенда.";

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

const BRIDGES: BridgeRow[] = [
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

function deriveStatus(lastSeenIso: string, bridgeId: string | null): DevStatus {
  const bridge = BRIDGES.find((b) => b.id === bridgeId);
  if (!bridge || bridge.lan === "offline") return "offline";
  const ageMin = (Date.parse("2026-03-13T09:05:00Z") - Date.parse(lastSeenIso)) / 60000;
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

export default function SysDevicesPage() {
  const devices = getDevices();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [note, setNote] = useState<string | null>(null);

  const enriched = useMemo(
    () => devices.map((d) => ({ ...d, derivedStatus: deriveStatus(d.lastSeenAt, d.bridgeId) })),
    [devices],
  );

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return enriched.filter((d) => {
      if (filter === "connected" && d.derivedStatus !== "connected") return false;
      if (filter === "offline" && d.derivedStatus !== "offline") return false;
      if (filter === "needs_calibration" && !NEEDS_CALIB.has(d.id)) return false;
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
          <span>{DEMO_BANNER}</span>
        </div>

        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          {BRIDGE_NOTE}
        </div>

        {/* Bridges */}
        <section className="space-y-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
            Device Bridge
          </h2>
          <Card className="p-0">
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
                {BRIDGES.map((b) => (
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
                          onClick={() => setNote(`Проверка моста ${b.id} — демо-действие.`)}
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
                          onClick={() => setNote(`Калибровка ${d.serial} — демо.`)}
                        >
                          Сымитировать калибровку
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9 min-h-[44px] sm:min-h-[32px]"
                          onClick={() => setNote(`Открытие потока ${d.serial} появится с Device Bridge.`)}
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
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Калибровка ${d.serial} — демо.`)}>
                    Сымитировать калибровку
                  </Button>
                  <Button variant="outline" className="min-h-[44px] text-[12px]" onClick={() => setNote(`Открытие потока ${d.serial} появится с Device Bridge.`)}>
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
