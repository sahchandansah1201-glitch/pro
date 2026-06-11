import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Headphones, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  bookSelfHostedLeadAppointment,
  buildDefaultSelfHostedLeadAppointmentStartedAt,
  createSelfHostedLead,
  listSelfHostedLeadsAppointments,
  type SelfHostedApiError,
  type SelfHostedAppointmentOverviewDTO,
  type SelfHostedLeadOverviewDTO,
  type SelfHostedLeadsAppointmentsOverview,
  updateSelfHostedLeadStatus,
} from "@/lib/self-hosted-leads-appointments-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

const SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  site: "Сайт",
  operator: "Оператор",
  phone: "Телефон",
  portal: "Портал",
  other: "Другое",
};

const STATUS_LABEL: Record<string, string> = {
  all: "Все",
  new: "Новые",
  qualified: "Уточнённые",
  booked: "Записанные",
  lost: "Закрытые",
};

const APPOINTMENT_STATUS_LABEL: Record<string, string> = {
  planned: "Запланирован",
  completed: "Завершён",
  cancelled: "Отменён",
  draft: "Черновик",
};

const EMPTY_OVERVIEW: SelfHostedLeadsAppointmentsOverview = {
  kpis: {
    leadsTotal: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    bookedLeads: 0,
    plannedAppointments: 0,
    completedAppointments: 0,
  },
  leads: [],
  appointments: [],
  filters: { leadStatus: "all", appointmentStatus: "all", dateFrom: null, dateTo: null, search: null },
};

type LeadStatusFilter = "all" | "new" | "qualified" | "booked" | "lost";

export default function OperatorConsolePageLive() {
  const session = useSelfHostedApiSession();
  const [overview, setOverview] = useState<SelfHostedLeadsAppointmentsOverview>(EMPTY_OVERVIEW);
  const [statusFilter, setStatusFilter] = useState<LeadStatusFilter>("all");
  const [search, setSearch] = useState("");
  const [draftSummary, setDraftSummary] = useState("");
  const [draftSource, setDraftSource] = useState("operator");
  const [loadStatus, setLoadStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [actionStatus, setActionStatus] = useState("Очередь заявок готова.");
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const baseArgs = useMemo(
    () => ({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
    }),
    [session.apiBaseUrl, session.apiToken],
  );
  const isConfigured = isSelfHostedApiConfigured(session);

  const loadOverview = useCallback(async () => {
    if (!isConfigured) {
      setLoadStatus("error");
      setError({
        kind: "not_configured",
        code: "not_configured",
        message: "Для очереди заявок нужен вход в систему клиники.",
      });
      return;
    }
    setLoadStatus("loading");
    const result = await listSelfHostedLeadsAppointments({
      ...baseArgs,
      leadStatus: statusFilter,
      search,
      limit: 20,
    });
    if (result.ok && result.value) {
      setOverview(result.value);
      setError(null);
      setLoadStatus("ready");
    } else {
      setOverview(EMPTY_OVERVIEW);
      setError(result.error);
      setLoadStatus("error");
    }
  }, [baseArgs, isConfigured, search, statusFilter]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function submitCreateLead(event: FormEvent) {
    event.preventDefault();
    setBusyKey("create");
    const result = await createSelfHostedLead({
      ...baseArgs,
      payload: {
        source: draftSource,
        safeSummary: draftSummary,
      },
    });
    setBusyKey(null);
    if (result.ok) {
      setDraftSummary("");
      setActionStatus("Заявка создана.");
      await loadOverview();
    } else {
      setActionStatus(publicLeadMessage(result.error));
    }
  }

  async function updateLead(lead: SelfHostedLeadOverviewDTO, status: "qualified" | "lost") {
    setBusyKey(`${status}:${lead.id}`);
    const result = await updateSelfHostedLeadStatus({
      ...baseArgs,
      leadId: lead.id,
      status,
    });
    setBusyKey(null);
    setActionStatus(
      result.ok
        ? `Заявка: статус ${STATUS_LABEL[status].toLowerCase()}.`
        : publicLeadMessage(result.error),
    );
    if (result.ok) await loadOverview();
  }

  async function bookLead(lead: SelfHostedLeadOverviewDTO) {
    if (!lead.patient.id) {
      setActionStatus("Для записи нужен связанный пациент.");
      return;
    }
    setBusyKey(`book:${lead.id}`);
    const result = await bookSelfHostedLeadAppointment({
      ...baseArgs,
      leadId: lead.id,
      payload: {
        patientId: lead.patient.id,
        startedAt: buildDefaultSelfHostedLeadAppointmentStartedAt(),
        chiefComplaint: lead.safeSummary,
      },
    });
    setBusyKey(null);
    setActionStatus(
      result.ok
        ? "Заявка записана на визит."
        : publicLeadMessage(result.error),
    );
    if (result.ok) await loadOverview();
  }

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · рабочая очередь заявок`
    : "Рабочая очередь заявок клиники";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Консоль оператора"
        subtitle={subtitle}
        actions={
          <Button asChild size="sm" variant="outline" className="min-h-[44px] text-[12px]">
            <Link to="/self-hosted/login">Вход в систему</Link>
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
                ? "Загружаем очередь заявок…"
                : loadStatus === "error"
                  ? "Очередь заявок недоступна."
                  : "Данные загружены из системы клиники."}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-[44px] text-[12px]"
            onClick={() => void loadOverview()}
          >
            Обновить
          </Button>
        </section>

        {error && (
          <section role="alert" className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive">
            {error.message}
          </section>
        )}

        <section className="surface-card grid grid-cols-2 divide-x divide-border lg:grid-cols-6">
          <Kpi label="Заявок всего" value={overview.kpis.leadsTotal} />
          <Kpi label="Новые" value={overview.kpis.newLeads} />
          <Kpi label="Уточнены" value={overview.kpis.qualifiedLeads} />
          <Kpi label="Записаны" value={overview.kpis.bookedLeads} />
          <Kpi label="Плановые записи" value={overview.kpis.plannedAppointments} />
          <Kpi label="Выполнены" value={overview.kpis.completedAppointments} />
        </section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <Card className="overflow-hidden">
            <header className="section-bar">
              <h2 className="h-section">Очередь заявок</h2>
              <span className="h-section-hint">система клиники</span>
            </header>

            <div className="flex flex-wrap items-end gap-2 border-b border-border px-4 py-3">
              <div className="w-48">
                <label className="mb-1 block text-[12px] font-medium" htmlFor="stage5m-status-filter">
                  Статус заявки
                </label>
                <select
                  id="stage5m-status-filter"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as LeadStatusFilter)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
                >
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="min-w-64 flex-1">
                <label className="mb-1 block text-[12px] font-medium" htmlFor="stage5m-search">
                  Поиск
                </label>
                <Input
                  id="stage5m-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Пациент, код, описание заявки"
                  className="h-9"
                />
              </div>
            </div>

            {overview.leads.length === 0 ? (
              <Empty text="Заявок по текущим фильтрам нет." />
            ) : (
              <ul className="divide-y divide-border">
                {overview.leads.map((lead) => (
                  <LeadQueueRow
                    key={lead.id}
                    lead={lead}
                    busyKey={busyKey}
                    onQualify={(item) => updateLead(item, "qualified")}
                    onLost={(item) => updateLead(item, "lost")}
                    onBook={bookLead}
                  />
                ))}
              </ul>
            )}
          </Card>

          <aside className="space-y-6">
            <Card className="overflow-hidden">
              <header className="section-bar">
                <h2 className="h-section">Новая заявка</h2>
                <span className="h-section-hint">сохранение в системе</span>
              </header>
              <form onSubmit={submitCreateLead} className="space-y-3 p-4">
                <div>
                  <label className="mb-1 block text-[12px] font-medium" htmlFor="stage5m-new-lead-summary">
                    Краткое описание заявки
                  </label>
                  <Textarea
                    id="stage5m-new-lead-summary"
                    value={draftSummary}
                    onChange={(event) => setDraftSummary(event.target.value)}
                    placeholder="Коротко: причина обращения, канал, следующий шаг"
                    className="min-h-24 text-[13px]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium" htmlFor="stage5m-new-lead-source">
                    Источник
                  </label>
                  <select
                    id="stage5m-new-lead-source"
                    value={draftSource}
                    onChange={(event) => setDraftSource(event.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
                  >
                    {Object.entries(SOURCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <Button
                  type="submit"
                  size="sm"
                  disabled={busyKey === "create" || draftSummary.trim().length === 0}
                  className="h-9 text-[12px]"
                >
                  {busyKey === "create" ? "Создаём…" : "Создать заявку"}
                </Button>
                <div role="status" aria-live="polite" aria-atomic="true" className="text-meta">
                  {actionStatus}
                </div>
              </form>
            </Card>

            <Card className="overflow-hidden">
              <header className="section-bar">
                <h2 className="h-section">Ближайшие записи</h2>
                <span className="h-section-hint">по визитам</span>
              </header>
              {overview.appointments.length === 0 ? (
                <Empty text="Записей пока нет." />
              ) : (
                <ul className="divide-y divide-border">
                  {overview.appointments.map((appointment) => (
                    <AppointmentRow key={appointment.id} appointment={appointment} />
                  ))}
                </ul>
              )}
            </Card>
          </aside>
        </div>

        <section className="surface-card px-4 py-3 text-meta">
          <Headphones className="mr-2 inline h-3.5 w-3.5" aria-hidden />
          Экран показывает только рабочие заявки оператора. Действия сохраняются в системе клиники
          и проходят проверку прав.
        </section>
      </div>
    </div>
  );
}

function LeadQueueRow({
  lead,
  busyKey,
  onQualify,
  onLost,
  onBook,
}: {
  lead: SelfHostedLeadOverviewDTO;
  busyKey: string | null;
  onQualify: (lead: SelfHostedLeadOverviewDTO) => void | Promise<void>;
  onLost: (lead: SelfHostedLeadOverviewDTO) => void | Promise<void>;
  onBook: (lead: SelfHostedLeadOverviewDTO) => void | Promise<void>;
}) {
  const canQualify = lead.status === "new";
  const canBook = Boolean(lead.patient.id) && lead.status !== "booked" && lead.status !== "lost";
  const canLose = lead.status !== "lost" && lead.status !== "booked";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {lead.patient.fullName || lead.safeSummary || "Заявка"}
        </div>
        <div className="truncate text-meta">
          {SOURCE_LABEL[lead.source] ?? lead.source} · {STATUS_LABEL[lead.status] ?? lead.status} · {lead.clinic.name || "Клиника"}
        </div>
        <div className="truncate text-meta">
          {lead.patient.code || "пациент не связан"} · {formatMaybeDate(lead.createdAt)}
        </div>
      </div>
      <div className="flex max-w-sm flex-wrap justify-end gap-1">
        {canQualify && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyKey === `qualified:${lead.id}`}
            aria-label={`Уточнить заявку: ${lead.patient.fullName || lead.safeSummary || "без имени"}`}
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              void onQualify(lead);
            }}
          >
            Уточнить
          </Button>
        )}
        {canBook && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busyKey === `book:${lead.id}`}
            aria-label={`Записать заявку: ${lead.patient.fullName || lead.safeSummary || "без имени"}`}
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              void onBook(lead);
            }}
          >
            Записать
          </Button>
        )}
        {canLose && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busyKey === `lost:${lead.id}`}
            aria-label={`Закрыть заявку без записи: ${lead.patient.fullName || lead.safeSummary || "без имени"}`}
            className="h-7 px-2 text-[11px]"
            onClick={() => {
              void onLost(lead);
            }}
          >
            Закрыть
          </Button>
        )}
      </div>
    </li>
  );
}

function AppointmentRow({ appointment }: { appointment: SelfHostedAppointmentOverviewDTO }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">{appointment.patient.fullName || "Пациент"}</div>
        <div className="truncate text-meta">
          {formatMaybeDate(appointment.slotAt)} · {APPOINTMENT_STATUS_LABEL[appointment.status] ?? appointment.status}
        </div>
      </div>
      {appointment.patient.id ? (
        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <Link to={`/patients/${appointment.patient.id}/visits/${appointment.visitId}`}>Визит</Link>
        </Button>
      ) : (
        <span className="text-meta">—</span>
      )}
    </li>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-meta">{text}</div>;
}

function publicLeadMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Не удалось сохранить заявку.";
  if (error.code === "forbidden") return "Недостаточно прав для изменения заявки.";
  if (error.code === "validation_error") return "Проверьте поля заявки: система вернула ошибку проверки.";
  return error.message || "Не удалось сохранить заявку.";
}

function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "—";
}
