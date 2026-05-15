import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  listSelfHostedClinicBookingRequests,
  updateSelfHostedClinicBookingRequest,
  type SelfHostedApiError,
  type SelfHostedClinicBookingRequestDTO,
  type SelfHostedClinicBookingRequestsPage,
} from "@/lib/self-hosted-clinic-booking-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  listSelfHostedExternalIntakeImports,
  type SelfHostedExternalIntakeImportBatchesPage,
} from "@/lib/self-hosted-external-intake-api";

const STATUS_LABEL: Record<string, string> = {
  all: "Все",
  requested: "Новые",
  reviewing: "В работе",
  booked: "Записаны",
  cancelled: "Отменены",
};

const SOURCE_SYSTEM_LABEL: Record<string, string> = {
  clinic_crm: "CRM клиники",
  ads: "Рекламный источник",
  site: "Сайт",
  manual: "Ручной импорт",
  other: "Другой источник",
};

const EMPTY_PAGE: SelfHostedClinicBookingRequestsPage = {
  items: [],
  count: 0,
  limit: 25,
  offset: 0,
  filters: { status: "all", search: null },
};

const EMPTY_IMPORTS: SelfHostedExternalIntakeImportBatchesPage = {
  items: [],
  count: 0,
  limit: 5,
  offset: 0,
  filters: { sourceSystem: "all" },
};

type StatusFilter = "all" | "requested" | "reviewing" | "booked" | "cancelled";

export default function OperatorBookingRequestsPageLive() {
  const session = useSelfHostedApiSession();
  const [page, setPage] = useState<SelfHostedClinicBookingRequestsPage>(EMPTY_PAGE);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [selected, setSelected] = useState<SelfHostedClinicBookingRequestDTO | null>(null);
  const [clinicNote, setClinicNote] = useState("");
  const [assignedVisitId, setAssignedVisitId] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [importBatches, setImportBatches] = useState<SelfHostedExternalIntakeImportBatchesPage>(EMPTY_IMPORTS);
  const [actionMessage, setActionMessage] = useState("Очередь заявок работает только через self-hosted backend.");

  const baseArgs = useMemo(
    () => ({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    }),
    [session.apiBaseUrl, session.apiToken],
  );
  const isConfigured = isSelfHostedApiConfigured(session);

  const loadRequests = useCallback(async () => {
    if (!isConfigured) {
      setLoadStatus("error");
      setError({
        kind: "not_configured",
        code: "not_configured",
        message: "Production очередь заявок требует вход через self-hosted backend.",
      });
      return;
    }
    setLoadStatus("loading");
    const result = await listSelfHostedClinicBookingRequests({
      ...baseArgs,
      status: statusFilter,
      search,
      limit: 25,
    });
    if (result.ok && result.value) {
      setPage(result.value);
      const imports = await listSelfHostedExternalIntakeImports({
        ...baseArgs,
        limit: 5,
      });
      if (imports.ok && imports.value) setImportBatches(imports.value);
      setError(null);
      setLoadStatus("ready");
      setSelected((current) => current ? result.value.items.find((item) => item.id === current.id) ?? null : null);
    } else {
      setPage(EMPTY_PAGE);
      setError(result.error);
      setLoadStatus("error");
    }
  }, [baseArgs, isConfigured, search, statusFilter]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  function chooseRequest(request: SelfHostedClinicBookingRequestDTO) {
    setSelected(request);
    setClinicNote(request.clinicNote || "");
    setAssignedVisitId(request.assignedVisitId || "");
  }

  async function updateRequest(
    request: SelfHostedClinicBookingRequestDTO,
    status: "reviewing" | "cancelled" | "booked",
    extra: { clinicNote?: string | null; assignedVisitId?: string | null } = {},
  ) {
    setBusyKey(`${status}:${request.id}`);
    const result = await updateSelfHostedClinicBookingRequest({
      ...baseArgs,
      requestId: request.id,
      payload: {
        status,
        ...extra,
      },
    });
    setBusyKey(null);
    if (result.ok && result.value) {
      setActionMessage(`Запрос ${result.value.id}: статус ${STATUS_LABEL[result.value.status] || result.value.status}.`);
      setSelected(result.value);
      setClinicNote(result.value.clinicNote || "");
      setAssignedVisitId(result.value.assignedVisitId || "");
      await loadRequests();
    } else {
      setActionMessage(publicBookingMessage(result.error));
    }
  }

  async function submitDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    await updateRequest(selected, selected.status === "booked" ? "booked" : "reviewing", {
      clinicNote,
      assignedVisitId: assignedVisitId || null,
    });
  }

  async function bookSelected() {
    if (!selected) return;
    await updateRequest(selected, "booked", {
      clinicNote,
      assignedVisitId: assignedVisitId || null,
    });
  }

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · production booking intake`
    : "Production booking intake из self-hosted backend";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Запросы на запись"
        subtitle={subtitle}
        actions={
          <Button asChild size="sm" variant="outline" className="h-8 text-[12px]">
            <Link to="/self-hosted/login">Self-hosted вход</Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 overflow-auto px-6 py-6">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex items-center justify-between gap-3 px-4 py-3 text-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ServerCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              {loadStatus === "loading"
                ? "Загружаем заявки из self-hosted backend…"
                : loadStatus === "error"
                  ? "Production очередь заявок недоступна."
                  : "Источник данных: self-hosted backend /api/v1/clinic/booking-requests."}
            </span>
          </div>
          <Button type="button" size="sm" variant="outline" className="h-8 text-[12px]" onClick={() => void loadRequests()}>
            Обновить
          </Button>
        </section>

        {error && (
          <section role="alert" className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive">
            {error.message}
          </section>
        )}

        <section className="surface-card overflow-hidden" aria-label="Статус импорта CRM и рекламных источников">
          <header className="section-bar">
            <h2 className="h-section">Импорт CRM и рекламных источников</h2>
            <span className="h-section-hint">локальный backend contract</span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
            <Kpi label="Батчей" value={importBatches.count} />
            <Kpi
              label="Заявок принято"
              value={importBatches.items.reduce((sum, item) => sum + item.acceptedBookingCount, 0)}
            />
            <Kpi
              label="Окон принято"
              value={importBatches.items.reduce((sum, item) => sum + item.acceptedSlotCount, 0)}
            />
            <Kpi
              label="Отклонено"
              value={importBatches.items.reduce((sum, item) => sum + item.rejectedCount, 0)}
            />
          </div>
          <div className="border-t border-border px-4 py-3 text-[13px] text-muted-foreground">
            {importBatches.items.length === 0 ? (
              "Импортов пока нет. CRM и рекламные источники подключаются через входящий self-hosted API, без прямых вызовов из UI."
            ) : (
              <ul className="space-y-2">
                {importBatches.items.map((batch) => (
                  <li key={batch.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {SOURCE_SYSTEM_LABEL[batch.sourceSystem] || batch.sourceSystem} · {batch.status}
                    </span>
                    <span className="tabular-nums">
                      {batch.acceptedBookingCount} заявок / {batch.acceptedSlotCount} окон / {batch.rejectedCount} отклонено
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="surface-card grid grid-cols-2 divide-x divide-border lg:grid-cols-4">
          <Kpi label="Всего" value={page.count} />
          <Kpi label="Новые" value={page.items.filter((item) => item.status === "requested").length} />
          <Kpi label="В работе" value={page.items.filter((item) => item.status === "reviewing").length} />
          <Kpi label="Записаны" value={page.items.filter((item) => item.status === "booked").length} />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="overflow-hidden">
            <header className="section-bar">
              <h2 className="h-section">Production booking requests</h2>
              <span className="h-section-hint">self-hosted PostgreSQL</span>
            </header>

            <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
              <label className="grid w-48 gap-1 text-[12px] font-medium">
                Статус заявки
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                  className="h-9 rounded-md border border-input bg-background px-3 text-[13px]"
                  aria-label="Фильтр статуса заявок на запись"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-[220px] flex-1 gap-1 text-[12px] font-medium">
                Поиск
                <Input
                  aria-label="Поиск заявок на запись"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Пациент, код, причина"
                  className="h-9"
                />
              </label>
            </div>

            {page.items.length === 0 ? (
              <div className="p-6 text-[13px] text-muted-foreground">Заявок на запись по текущему фильтру нет.</div>
            ) : (
              <ul className="divide-y divide-border">
                {page.items.map((request) => (
                  <li key={request.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <button
                      type="button"
                      className="min-w-0 text-left"
                      onClick={() => chooseRequest(request)}
                      aria-label={`Открыть заявку на запись ${request.id}`}
                    >
                      <div className="truncate text-[14px] font-semibold">
                        {request.patient.fullName || "Пациент"} · {request.patient.code || "без кода"}
                      </div>
                      <div className="mt-1 text-[13px] text-muted-foreground">
                        {formatDateTime(request.preferredFrom)} · {STATUS_LABEL[request.status] || request.status}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[13px] text-muted-foreground">
                        {request.reason || "Причина не указана"}
                      </div>
                    </button>
                    <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px]"
                        disabled={busyKey === `reviewing:${request.id}`}
                        onClick={() => void updateRequest(request, "reviewing", { clinicNote: request.clinicNote })}
                        aria-label={`Взять в работу заявку ${request.id}`}
                      >
                        В работу
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-[12px]"
                        disabled={busyKey === `cancelled:${request.id}`}
                        onClick={() => void updateRequest(request, "cancelled", { clinicNote: request.clinicNote })}
                        aria-label={`Отменить заявку ${request.id}`}
                      >
                        Отменить
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="overflow-hidden">
            <header className="section-bar">
              <h2 className="h-section">Карточка заявки</h2>
              <span className="h-section-hint">review + assignment</span>
            </header>
            {!selected ? (
              <div className="p-4 text-[13px] text-muted-foreground">Выберите заявку из очереди.</div>
            ) : (
              <form className="space-y-4 p-4" onSubmit={submitDetails}>
                <div>
                  <div className="text-[14px] font-semibold">{selected.patient.fullName || "Пациент"}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {selected.patient.code || "без кода"} · {formatDateTime(selected.preferredFrom)}
                  </div>
                </div>
                <div className="rounded-md border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
                  {selected.reason || "Причина не указана"}
                </div>
                <label className="grid gap-1 text-[12px] font-medium">
                  ID визита для подтверждённой записи
                  <Input
                    aria-label="ID визита для заявки"
                    value={assignedVisitId}
                    onChange={(event) => setAssignedVisitId(event.target.value)}
                    placeholder="uuid визита"
                    className="h-9"
                  />
                </label>
                <label className="grid gap-1 text-[12px] font-medium">
                  Заметка клиники
                  <Textarea
                    aria-label="Заметка клиники по заявке"
                    value={clinicNote}
                    onChange={(event) => setClinicNote(event.target.value)}
                    maxLength={1000}
                    rows={5}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" size="sm" disabled={busyKey === `reviewing:${selected.id}`}>
                    Сохранить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!assignedVisitId || busyKey === `booked:${selected.id}`}
                    onClick={() => void bookSelected()}
                  >
                    Подтвердить запись
                  </Button>
                </div>
                <div role="status" aria-live="polite" className="text-[13px] text-muted-foreground">
                  {actionMessage}
                </div>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4">
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function publicBookingMessage(error: SelfHostedApiError | null): string {
  if (!error) return "Неизвестная ошибка self-hosted backend.";
  if (error.code === "validation_error") return "Проверьте статус, ID визита и заметку клиники.";
  if (error.code === "forbidden") return "У роли нет доступа к очереди заявок.";
  return error.message;
}
