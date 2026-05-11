import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw, Search, ShieldAlert, ShieldCheck } from "lucide-react";

import { ListPagination } from "@/components/admin/ListPagination";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRole } from "@/context/role-context";
import { buildAccessEventsCsv, type AccessEventSource } from "@/lib/admin-access-events";
import { formatDateTime } from "@/lib/format";
import {
  getAuditLogs,
  getClinicById,
  getImages,
  getLesionById,
  getPatientById,
  getReports,
  getVisitById,
  getVisitsByPatientId,
} from "@/lib/mock-data";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase-client";
import { useListPagination } from "@/lib/use-list-pagination";
import { DEMO_USERS } from "@/lib/users";
import { ROLE_BY_ID } from "@/lib/roles";
import type { AuditLog } from "@/lib/domain";
import type { Tables } from "@/integrations/supabase/types";

type AccessEventsViewRow = Tables<"access_events_admin">;

type FilterKey = "all" | "clinical" | "admin" | "integrations" | "devices";

interface AccessEventRow {
  id: string;
  createdAt: string;
  clinicName: string;
  actorLabel: string;
  action: string;
  entity: string;
  entityId: string | null;
  patientCode: string | null;
  visitId: string | null;
  lesionLabel: string | null;
  source: AccessEventSource;
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "clinical", label: "Клиника" },
  { key: "admin", label: "Администрирование" },
  { key: "integrations", label: "Интеграции" },
  { key: "devices", label: "Устройства" },
];

const ENTITY_BUCKET: Record<string, FilterKey> = {
  visit: "clinical",
  image: "clinical",
  assessment: "clinical",
  lesion: "clinical",
  report: "clinical",
  appointment: "admin",
  lead: "admin",
  bot_dialog: "admin",
  integration: "integrations",
  device: "devices",
};

function actorLabel(actorId: string | null): string {
  if (!actorId) return "Системное событие";
  const user = Object.values(DEMO_USERS).find((u) => u.id === actorId);
  if (!user) return actorId;
  return `${ROLE_BY_ID[user.role].short} · ${user.id}`;
}

function clinicFromLog(log: AuditLog): string {
  let clinicId = typeof log.payload.clinicId === "string" ? log.payload.clinicId : null;
  if (!clinicId && typeof log.payload.visitId === "string") {
    clinicId = getVisitById(log.payload.visitId)?.clinicId ?? null;
  }
  if (!clinicId && log.entity === "visit") {
    clinicId = getVisitById(log.entityId)?.clinicId ?? null;
  }
  if (!clinicId && log.entity === "lesion") {
    const patientId = getLesionById(log.entityId)?.patientId;
    clinicId = patientId ? getVisitsByPatientId(patientId)[0]?.clinicId ?? null : null;
  }
  if (!clinicId && typeof log.payload.lesionId === "string") {
    const patientId = getLesionById(log.payload.lesionId)?.patientId;
    clinicId = patientId ? getVisitsByPatientId(patientId)[0]?.clinicId ?? null : null;
  }
  if (!clinicId && log.entity === "image") {
    const image = getImages().find((i) => i.id === log.entityId);
    clinicId = image ? getVisitById(image.visitId)?.clinicId ?? null : null;
  }
  if (!clinicId && log.entity === "report") {
    const report = getReports().find((r) => r.id === log.entityId);
    clinicId = report ? getVisitById(report.visitId)?.clinicId ?? null : null;
  }
  return clinicId ? getClinicById(clinicId)?.name ?? clinicId : "—";
}

function patientCodeFromLog(log: AuditLog): string | null {
  if (typeof log.payload.visitId === "string") {
    const visit = getVisitById(log.payload.visitId);
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "visit") {
    const visit = getVisitById(log.entityId);
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "lesion") {
    const lesion = getLesionById(log.entityId);
    return lesion ? getPatientById(lesion.patientId)?.code ?? null : null;
  }
  if (typeof log.payload.lesionId === "string") {
    const lesion = getLesionById(log.payload.lesionId);
    return lesion ? getPatientById(lesion.patientId)?.code ?? null : null;
  }
  if (log.entity === "image") {
    const image = getImages().find((i) => i.id === log.entityId);
    const visit = image ? getVisitById(image.visitId) : null;
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  if (log.entity === "report") {
    const report = getReports().find((r) => r.id === log.entityId);
    const visit = report ? getVisitById(report.visitId) : null;
    return visit ? getPatientById(visit.patientId)?.code ?? null : null;
  }
  return null;
}

function visitIdFromLog(log: AuditLog): string | null {
  if (typeof log.payload.visitId === "string") return log.payload.visitId;
  return log.entity === "visit" ? log.entityId : null;
}

function lesionLabelFromLog(log: AuditLog): string | null {
  if (log.entity === "lesion") return getLesionById(log.entityId)?.label ?? log.entityId;
  if (typeof log.payload.lesionId === "string") {
    return getLesionById(log.payload.lesionId)?.label ?? log.payload.lesionId;
  }
  return null;
}

function fromDemoLog(log: AuditLog): AccessEventRow {
  return {
    id: log.id,
    createdAt: log.createdAt,
    clinicName: clinicFromLog(log),
    actorLabel: actorLabel(log.actorId),
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    patientCode: patientCodeFromLog(log),
    visitId: visitIdFromLog(log),
    lesionLabel: lesionLabelFromLog(log),
    source: "demo",
  };
}

function fromViewRow(row: AccessEventsViewRow): AccessEventRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    clinicName: row.clinic_name,
    actorLabel: row.actor_full_name ?? row.actor_id ?? "Системное событие",
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    patientCode: row.patient_code,
    visitId: row.visit_id,
    lesionLabel: row.lesion_label,
    source: "api",
  };
}

function buildDemoRows(): AccessEventRow[] {
  return getAuditLogs()
    .map(fromDemoLog)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function contextLabel(row: AccessEventRow): string {
  const parts = [];
  if (row.visitId) parts.push(`визит ${row.visitId}`);
  if (row.lesionLabel) parts.push(`очаг ${row.lesionLabel}`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

function downloadText(filename: string, text: string) {
  const blob = new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SysAccessEventsPage() {
  const { role } = useRole();
  const configured = isSupabaseConfigured();
  const [rows, setRows] = useState<AccessEventRow[]>(() => buildDemoRows());
  const [source, setSource] = useState<AccessEventSource>("demo");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    if (!configured || role !== "system_admin") {
      setRows(buildDemoRows());
      setSource("demo");
      setError(null);
      setLoading(false);
      return;
    }

    const client = getSupabaseClient();
    if (!client) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    client
      .from("access_events_admin")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data, error: apiError }) => {
        if (cancelled) return;
        if (apiError) {
          setRows([]);
          setSource("api");
          setError("Не удалось загрузить события доступа. Проверьте роль system_admin и RLS.");
          return;
        }
        setRows((data ?? []).map(fromViewRow));
        setSource("api");
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setSource("api");
        setError("Сбой сети при загрузке событий доступа.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configured, reloadTick, role]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && ENTITY_BUCKET[row.entity] !== filter) return false;
      if (q) {
        const hay = `${row.action} ${row.entity} ${row.entityId ?? ""} ${row.patientCode ?? ""} ${row.clinicName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, filter, query]);

  const pagination = useListPagination(filteredRows, {
    mobilePageSize: 5,
    desktopPageSize: 10,
    deps: [filter, query, rows],
  });

  const handleExport = useCallback(() => {
    if (filteredRows.length === 0) return;
    downloadText("access-events.csv", buildAccessEventsCsv(filteredRows));
    setExportStatus(`CSV экспортирован: ${filteredRows.length} строк.`);
  }, [filteredRows]);

  if (role !== "system_admin") {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="События доступа" subtitle="Только для системного администратора." />
        <div className="p-4">
          <div
            role="alert"
            className="flex max-w-2xl items-start gap-2 rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
            <span>
              Этот раздел доступен только роли system_admin. Переключите демо-роль на
              системного администратора, чтобы открыть журнал.
            </span>
          </div>
        </div>
      </div>
    );
  }

  const visible = pagination.visible;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="События доступа"
        subtitle="Admin view `access_events_admin`: действия, акторы и безопасный контекст."
        actions={
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1"
            onClick={() => setReloadTick((n) => n + 1)}
            disabled={loading}
            aria-busy={loading || undefined}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Обновить
          </Button>
        }
      />

      <div className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {source === "api"
              ? "Данные читаются из public.access_events_admin. Доступ ограничен system_admin."
              : "Демо-режим. В production этот экран читает public.access_events_admin через RLS."}
          </span>
        </div>

        {error ? (
          <div
            role="alert"
            aria-live="assertive"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive"
          >
            {error}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div role="tablist" aria-label="Фильтр событий доступа" className="flex flex-wrap gap-1">
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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:w-72">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Поиск по действию, сущности, коду"
                  aria-label="Поиск событий доступа"
                  className="h-11 pl-7 text-[12px] sm:h-9"
                />
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-[44px] gap-1 text-[12px] sm:min-h-[32px]"
                onClick={handleExport}
                disabled={filteredRows.length === 0}
                aria-label="Экспортировать события доступа в CSV"
              >
                <Download className="h-3.5 w-3.5" aria-hidden />
                CSV
              </Button>
            </div>
          </div>
        </Card>

        {exportStatus ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground"
          >
            {exportStatus}
          </div>
        ) : null}

        <div className="text-[12px] text-muted-foreground" aria-live="polite">
          Найдено: {filteredRows.length}
        </div>

        <Card className="hidden p-0 md:block">
          <table className="w-full text-[12px]">
            <thead className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Когда</th>
                <th className="px-3 py-2">Клиника</th>
                <th className="px-3 py-2">Актор</th>
                <th className="px-3 py-2">Действие</th>
                <th className="px-3 py-2">Сущность</th>
                <th className="px-3 py-2">Пациент</th>
                <th className="px-3 py-2">Контекст</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-border/60 last:border-0">
                  <td className="px-3 py-2 text-muted-foreground">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-2">{row.clinicName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.actorLabel}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{row.action}</td>
                  <td className="px-3 py-2">
                    <span>{row.entity}</span>
                    <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                      {row.entityId ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {row.patientCode ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {contextLabel(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <div className="grid grid-cols-1 gap-2 md:hidden">
          {visible.map((row) => (
            <Card key={row.id} className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-mono text-[12px] font-semibold">{row.action}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {formatDateTime(row.createdAt)} · {row.actorLabel}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {row.source === "api" ? "API" : "demo"}
                </span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-muted-foreground">Клиника</dt>
                <dd className="text-right">{row.clinicName}</dd>
                <dt className="text-muted-foreground">Сущность</dt>
                <dd className="text-right">{row.entity}</dd>
                <dt className="text-muted-foreground">Пациент</dt>
                <dd className="text-right font-mono text-[11px]">{row.patientCode ?? "—"}</dd>
                <dt className="text-muted-foreground">Контекст</dt>
                <dd className="text-right">{contextLabel(row)}</dd>
              </dl>
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
          itemNoun="событий"
        />
      </div>
    </div>
  );
}
