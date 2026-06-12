import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, RefreshCcw, Search, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
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

const STATUS_OPTIONS = [
  { value: "all", label: "Все статусы" },
  { value: "draft", label: "Запланирован" },
  { value: "in_progress", label: "В работе" },
  { value: "signed", label: "Подписан" },
  { value: "cancelled", label: "Отменён" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Запланирован",
  in_progress: "В работе",
  signed: "Подписан",
  cancelled: "Отменён",
};

const EMPTY_SCHEDULE: SelfHostedVisitScheduleResult = {
  items: [],
  count: 0,
  limit: 50,
  offset: 0,
  filters: { status: "all", dateFrom: null, dateTo: null, search: null },
};

function errorText(error: SelfHostedApiError | null): string {
  if (!error) return "Не удалось загрузить расписание.";
  if (error.kind === "not_configured") return "Войдите в систему клиники, чтобы открыть рабочее расписание.";
  if (error.kind === "network") return "Система клиники временно недоступна. Повторите попытку.";
  if (error.status === 401) return "Рабочий вход истёк. Войдите снова.";
  if (error.status === 403) return "Недостаточно прав для просмотра расписания визитов.";
  return error.message || "Не удалось загрузить расписание.";
}

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function formatCardNumber(code?: string | null): string {
  if (!code) return "номер скрыт";
  const match = code.match(/^DP-\d{4}-(\d+)$/);
  return match ? `карта ${match[1]}` : code;
}

function visitHref(visit: SelfHostedVisitScheduleItemDTO): string {
  const patientId = visit.patient.id ?? visit.patientId ?? "";
  return patientId ? `/patients/${patientId}/visits/${visit.id}` : "/visits";
}

function VisitRow({ visit }: { visit: SelfHostedVisitScheduleItemDTO }) {
  const href = visitHref(visit);
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] items-center border-b border-border px-4 py-3 text-row last:border-b-0">
      <div className="min-w-0">
        <div className="truncate font-medium">{visit.patient.fullName ?? "Пациент"}</div>
        <div className="truncate text-muted-foreground">{formatCardNumber(visit.patient.code)}</div>
      </div>
      <div>{visit.startedAt ? formatDateTime(visit.startedAt) : "—"}</div>
      <div className="truncate">{visit.clinic.name ?? "Клиника"}</div>
      <div>{statusLabel(visit.status)}</div>
      <Button asChild variant="ghost" size="icon" aria-label={`Открыть визит ${visit.patient.fullName ?? "пациента"}`}>
        <Link to={href}>›</Link>
      </Button>
    </div>
  );
}

function VisitCard({ visit }: { visit: SelfHostedVisitScheduleItemDTO }) {
  const href = visitHref(visit);
  return (
    <article className="rounded-md border border-border bg-surface px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-foreground">
            {visit.patient.fullName ?? "Пациент"}
          </h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {visit.startedAt ? formatDateTime(visit.startedAt) : "Время не указано"} · {visit.clinic.name ?? "Клиника"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            № {formatCardNumber(visit.patient.code)} · {statusLabel(visit.status)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0">
          <Link to={href}>Открыть</Link>
        </Button>
      </div>
    </article>
  );
}

export default function VisitsPageLive() {
  const session = useSelfHostedApiSession();
  const [schedule, setSchedule] = useState<SelfHostedVisitScheduleResult>(EMPTY_SCHEDULE);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [search, setSearch] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const configured = isSelfHostedApiConfigured(session);
  const activeFilters = useMemo(
    () => ({
      status: selectedStatus,
      dateFrom,
      dateTo,
      search: search.trim(),
    }),
    [dateFrom, dateTo, search, selectedStatus],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!configured) {
        setStatus("error");
        setError({
          kind: "not_configured",
          code: "not_configured",
          message: "Войдите в систему клиники, чтобы открыть рабочее расписание.",
        });
        return;
      }
      setStatus("loading");
      const result = await listSelfHostedVisits({
        apiBaseUrl: session.apiBaseUrl,
        apiToken: session.apiToken,
        status: activeFilters.status,
        dateFrom: activeFilters.dateFrom,
        dateTo: activeFilters.dateTo,
        search: activeFilters.search,
        limit: 50,
      });
      if (cancelled) return;
      if (!result.ok || !result.value) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setSchedule(result.value);
      setError(null);
      setStatus("ready");
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeFilters, configured, reloadKey, session.apiBaseUrl, session.apiToken]);

  const currentVisit = schedule.items.find((visit) => visit.status === "in_progress")
    ?? schedule.items.find((visit) => visit.status === "draft")
    ?? schedule.items[0];
  const scheduledCount = schedule.items.filter((visit) => visit.status === "draft").length;
  const signedCount = schedule.items.filter((visit) => visit.status === "signed").length;
  const currentVisitHref = currentVisit ? visitHref(currentVisit) : "/capture";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Визиты"
        subtitle={`В расписании: ${schedule.count}`}
        actions={
          <Button asChild size="sm" variant={configured ? "outline" : "default"} className="min-h-11 sm:min-h-9">
            <Link to="/self-hosted/login">{configured ? "Рабочий вход" : "Войти"}</Link>
          </Button>
        }
      />
      <div className="space-y-4 px-6 py-6">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex items-center justify-between gap-3 px-4 py-3 text-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ServerCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">Данные загружаются из системы клиники.</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 sm:min-h-9"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={status === "loading"}
          >
            <RefreshCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Обновить
          </Button>
        </section>

        {currentVisit ? (
          <section
            role="region"
            aria-label="Что делать с визитами сейчас"
            className="surface-card flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Открыть текущий визит</h2>
              <p className="mt-1 text-row text-muted-foreground">
                Запланировано: {scheduledCount} · подписано: {signedCount} · ближайший пациент: {currentVisit.patient.fullName ?? "Пациент"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11">
                <Link to={currentVisitHref}>Открыть визит</Link>
              </Button>
              <Button asChild variant="secondary" className="min-h-11">
                <Link to="/capture">Перейти к съёмке</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <section className="surface-card space-y-3 px-4 py-4">
          <div className="grid gap-3 lg:grid-cols-[1.2fr_180px_160px_160px]">
            <label className="relative block">
              <span className="sr-only">Поиск визитов</span>
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="min-h-11 pl-9"
                placeholder="Пациент, код, жалоба"
                aria-label="Поиск визитов"
              />
            </label>
            <label className="block">
              <span className="sr-only">Статус визита</span>
              <select
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value)}
                className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-row"
                aria-label="Статус визита"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
              className="min-h-11"
              aria-label="Дата визита с"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
              className="min-h-11"
              aria-label="Дата визита по"
            />
          </div>
        </section>

        {status === "error" ? (
          <section role="alert" className="surface-card border-destructive/40 px-4 py-4 text-row text-destructive">
            {errorText(error)}
          </section>
        ) : (
          <section className="surface-card overflow-hidden" aria-busy={status === "loading"}>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
                Расписание
              </div>
              <div className="text-[12px] text-muted-foreground">
                Найдено: {schedule.count}
              </div>
            </div>
            {status === "loading" ? (
              <div className="px-4 py-8 text-center text-row text-muted-foreground">Загружаем расписание…</div>
            ) : schedule.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-row text-muted-foreground">
                Визитов по выбранным фильтрам нет.
              </div>
            ) : (
              <>
                <div className="space-y-2 p-3 md:hidden">
                  {schedule.items.map((visit) => <VisitCard key={visit.id} visit={visit} />)}
                </div>
                <div className="hidden md:block">
                  <div className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] border-b border-border px-4 py-3 text-[12px] font-medium text-muted-foreground">
                    <div>Пациент</div>
                    <div>Дата и время</div>
                    <div>Клиника</div>
                    <div>Статус</div>
                    <div />
                  </div>
                  {schedule.items.map((visit) => <VisitRow key={visit.id} visit={visit} />)}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
