import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, Clock, FileText, RefreshCcw, Search } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  listSelfHostedVisits,
  type SelfHostedApiError,
  type SelfHostedVisitScheduleItemDTO,
  type SelfHostedVisitScheduleResult,
} from "@/lib/self-hosted-visit-api";

const EMPTY_REPORT_QUEUE: SelfHostedVisitScheduleResult = {
  items: [],
  count: 0,
  limit: 50,
  offset: 0,
  filters: { status: "all", dateFrom: null, dateTo: null, search: null },
};

const VISIT_STATUS_LABEL: Record<string, string> = {
  draft: "Запланирован",
  in_progress: "В работе",
  signed: "Подписан",
  cancelled: "Отменён",
};

function errorText(error: SelfHostedApiError | null): string {
  if (!error) return "Не удалось загрузить отчёты.";
  if (error.kind === "not_configured") return "Войдите в систему клиники, чтобы открыть отчёты.";
  if (error.kind === "network") return "Система клиники временно недоступна. Повторите попытку.";
  if (error.status === 401) return "Рабочий вход истёк. Войдите снова.";
  if (error.status === 403) return "Недостаточно прав для просмотра отчётов.";
  return error.message || "Не удалось загрузить отчёты.";
}

function statusLabel(status: string): string {
  return VISIT_STATUS_LABEL[status] ?? status;
}

function reportState(visit: SelfHostedVisitScheduleItemDTO): string {
  if (visit.status === "signed") return "Отчёт подписан";
  if (visit.status === "in_progress") return "Черновик открыт";
  if (visit.status === "cancelled") return "Визит отменён";
  return "Ожидает приёма";
}

function statusTone(visit: SelfHostedVisitScheduleItemDTO): string {
  if (visit.status === "signed") return "border-success/40 bg-success/10 text-success";
  if (visit.status === "in_progress") return "border-warning/40 bg-warning/10 text-warning";
  if (visit.status === "cancelled") return "border-muted-foreground/30 bg-muted text-muted-foreground";
  return "border-primary/30 bg-primary/10 text-primary";
}

function reportHref(visit: SelfHostedVisitScheduleItemDTO): string {
  const patientId = visit.patient.id ?? visit.patientId ?? "";
  return patientId ? `/patients/${patientId}/visits/${visit.id}?tab=report` : "/reports";
}

function patientHref(visit: SelfHostedVisitScheduleItemDTO): string {
  const patientId = visit.patient.id ?? visit.patientId ?? "";
  return patientId ? `/patients/${patientId}` : "/reports";
}

function matchesVisit(visit: SelfHostedVisitScheduleItemDTO, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  if (!needle) return true;
  return [
    visit.patient.fullName,
    visit.patient.code,
    visit.clinic.name,
    visit.chiefComplaint,
    statusLabel(visit.status),
    reportState(visit),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("ru-RU")
    .includes(needle);
}

function SummaryTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: typeof FileText;
}) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
          <div className="mt-1 text-[24px] font-semibold tabular-nums">{value}</div>
          <div className="text-[12px] text-muted-foreground">{hint}</div>
        </div>
        <Icon className="size-4 text-primary" aria-hidden />
      </div>
    </div>
  );
}

function ReportRow({ visit }: { visit: SelfHostedVisitScheduleItemDTO }) {
  const patientName = visit.patient.fullName ?? "Пациент";
  return (
    <li className="px-4 py-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_190px] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 text-[14px] font-semibold">
              <span className="truncate">{patientName}</span>
            </div>
            <Badge className={statusTone(visit)}>{reportState(visit)}</Badge>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {visit.startedAt ? formatDateTime(visit.startedAt) : "Время не указано"} · {visit.clinic.name ?? "Клиника"}
          </div>
          <p className="mt-2 line-clamp-2 max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            {visit.chiefComplaint || "Отчёт открывается внутри рабочего места визита."}
          </p>
        </div>

        <div className="rounded-md border bg-surface px-3 py-2 text-[12px]">
          <div className="flex items-center gap-1.5 font-medium">
            <FileText className="size-3.5" aria-hidden />
            Визит
          </div>
          <div className="mt-1 text-muted-foreground">
            {statusLabel(visit.status)} · {visit.patient.code ?? "номер скрыт"}
          </div>
        </div>

        <div className="space-y-2">
          <Button asChild size="sm" className="min-h-[44px] w-full sm:min-h-9">
            <Link to={reportHref(visit)}>Открыть отчёт в визите</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="min-h-[44px] w-full sm:min-h-9">
            <Link to={patientHref(visit)}>Карточка пациента</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

export default function DoctorReportsPageLive() {
  const session = useSelfHostedApiSession();
  const [queue, setQueue] = useState<SelfHostedVisitScheduleResult>(EMPTY_REPORT_QUEUE);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [query, setQuery] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const configured = isSelfHostedApiConfigured(session);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!configured) {
        setStatus("error");
        setError({
          kind: "not_configured",
          code: "not_configured",
          message: "Войдите в систему клиники, чтобы открыть отчёты.",
        });
        return;
      }
      setStatus("loading");
      const result = await listSelfHostedVisits({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        status: "all",
        limit: 50,
      });
      if (cancelled) return;
      if (!result.ok || !result.value) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setQueue(result.value);
      setError(null);
      setStatus("ready");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [configured, reloadKey, session.apiBaseUrl, session.apiToken]);

  const filteredVisits = useMemo(
    () => queue.items.filter((visit) => matchesVisit(visit, query)),
    [query, queue.items],
  );
  const signedCount = filteredVisits.filter((visit) => visit.status === "signed").length;
  const activeCount = filteredVisits.filter((visit) => visit.status === "in_progress").length;
  const plannedCount = filteredVisits.filter((visit) => visit.status === "draft").length;

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Отчёты"
        subtitle={`В очереди: ${filteredVisits.length}`}
        actions={
          <Button asChild size="sm" variant={configured ? "outline" : "default"} className="min-h-11 sm:min-h-9">
            <Link to="/visits">К визитам</Link>
          </Button>
        }
      />

      <main className="space-y-5 px-4 py-5 sm:px-6">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex flex-col gap-3 px-4 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
        >
          <span>
            <span className="font-medium text-foreground">Источник данных: система клиники.</span>{" "}
            Отчёт открывается внутри визита и хранится в рабочей базе.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 self-start sm:min-h-9 sm:self-auto"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={status === "loading"}
          >
            <RefreshCcw className="mr-1.5 size-3.5" aria-hidden />
            Обновить
          </Button>
        </section>

        <section aria-label="Сводка отчётов" className="grid gap-3 md:grid-cols-4">
          <SummaryTile label="Всего" value={filteredVisits.length} hint="в текущем фильтре" icon={FileText} />
          <SummaryTile label="Подписаны" value={signedCount} hint="готовы в визите" icon={CheckCircle2} />
          <SummaryTile label="В работе" value={activeCount} hint="черновики открыты" icon={AlertTriangle} />
          <SummaryTile label="Запланированы" value={plannedCount} hint="ожидают приёма" icon={Clock} />
        </section>

        <section className="surface-card overflow-hidden" aria-label="Очередь отчётов">
          <div className="section-bar flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="h-section">Очередь отчётов</h2>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Откройте визит, чтобы проверить или заполнить отчёт.
              </p>
            </div>
            <label className="relative block min-w-[220px]">
              <span className="sr-only">Поиск отчётов</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" aria-hidden />
              <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Поиск отчётов"
                placeholder="Пациент, клиника, статус"
                className="min-h-11 pl-9 text-[13px] sm:min-h-9"
              />
            </label>
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              aria-label="Сводка фильтра отчётов"
              className="w-full text-[12px] text-muted-foreground"
            >
              Найдено {filteredVisits.length} из {queue.count}
            </div>
          </div>

          {status === "loading" ? (
            <div className="px-4 py-8 text-[13px] text-muted-foreground">Загружаем отчёты…</div>
          ) : status === "error" ? (
            <div className="px-4 py-4 text-[13px] text-destructive">{errorText(error)}</div>
          ) : filteredVisits.length === 0 ? (
            <div className="px-4 py-8 text-[13px] text-muted-foreground">
              По текущему фильтру отчётов нет.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredVisits.map((visit) => (
                <ReportRow key={visit.id} visit={visit} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
