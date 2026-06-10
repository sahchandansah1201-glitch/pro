import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronRight, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, sexShort } from "@/lib/format";
import {
  bookSelfHostedLeadAppointment,
  buildDefaultSelfHostedLeadAppointmentStartedAt,
  createSelfHostedLead,
  listSelfHostedLeadsAppointments,
  type SelfHostedAppointmentOverviewDTO,
  type SelfHostedLeadOverviewDTO,
  type SelfHostedLeadsAppointmentsOverview,
  updateSelfHostedLeadStatus,
} from "@/lib/self-hosted-leads-appointments-api";
import {
  getSelfHostedDoctorDashboard,
  type SelfHostedApiError,
  type SelfHostedDashboardAssetIssue,
  type SelfHostedDashboardDevice,
  type SelfHostedDashboardPatient,
  type SelfHostedDashboardVisit,
  type SelfHostedDoctorDashboard,
} from "@/lib/self-hosted-dashboard-api";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

const STATUS_LABEL: Record<string, string> = {
  draft: "Запланирован",
  in_progress: "В работе",
  signed: "Подписан",
  cancelled: "Отменён",
};

const ISSUE_LABEL: Record<string, string> = {
  metadata_incomplete: "метаданные не полные",
  size_missing: "не указан размер",
  checksum_missing: "нет контрольной суммы",
  review: "нужен пересмотр",
};

const LEAD_SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  site: "Сайт",
  operator: "Оператор",
  phone: "Телефон",
  portal: "Портал",
  other: "Другое",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  booked: "Записан",
  lost: "Потерян",
};

const EMPTY_DASHBOARD: SelfHostedDoctorDashboard = {
  kpis: {
    visitsToday: 0,
    activeVisits: 0,
    awaitingConclusion: 0,
    patientsInScope: 0,
    assetsNeedReview: 0,
    devicesTotal: 0,
    devicesActive30d: 0,
  },
  upcoming: [],
  awaitingConclusions: [],
  recentPatients: [],
  assetIssues: [],
  devices: [],
};

const EMPTY_LEADS_APPOINTMENTS: SelfHostedLeadsAppointmentsOverview = {
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
  filters: {
    leadStatus: "all",
    appointmentStatus: "all",
    dateFrom: null,
    dateTo: null,
    search: null,
  },
};

type CurrentAction = {
  nextStep: string;
  actionLabel: string;
  href: string;
};

export default function DeskPageLive() {
  const session = useSelfHostedApiSession();
  const [dashboard, setDashboard] =
    useState<SelfHostedDoctorDashboard>(EMPTY_DASHBOARD);
  const [leadsAppointments, setLeadsAppointments] =
    useState<SelfHostedLeadsAppointmentsOverview>(EMPTY_LEADS_APPOINTMENTS);
  const [leadsAppointmentsError, setLeadsAppointmentsError] =
    useState<SelfHostedApiError | null>(null);
  const [leadBusy, setLeadBusy] = useState<string | null>(null);
  const [leadStatus, setLeadStatus] = useState(
    "Live-лиды сохраняются в self-hosted backend.",
  );
  const [newLeadSummary, setNewLeadSummary] = useState("");
  const [newLeadSource, setNewLeadSource] = useState("operator");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState<SelfHostedApiError | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSelfHostedApiConfigured(session)) {
        setStatus("error");
        setError({
          kind: "not_configured",
          code: "not_configured",
          message: "Production-режим требует вход через self-hosted backend.",
        });
        return;
      }
      setStatus("loading");
      const [result, leadsResult] = await Promise.all([
        getSelfHostedDoctorDashboard({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
        }),
        listSelfHostedLeadsAppointments({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          limit: 5,
        }),
      ]);
      if (cancelled) return;
      if (!result.ok || !result.value) {
        setStatus("error");
        setError(result.error);
        return;
      }
      setDashboard(result.value);
      if (leadsResult.ok && leadsResult.value) {
        setLeadsAppointments(leadsResult.value);
        setLeadsAppointmentsError(null);
      } else {
        setLeadsAppointments(EMPTY_LEADS_APPOINTMENTS);
        setLeadsAppointmentsError(leadsResult.error);
      }
      setStatus("ready");
      setError(null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session.apiBaseUrl, session.apiToken, session.status]);

  const baseArgs = {
    apiBaseUrl: session.apiBaseUrl,
    apiToken: session.apiToken,
  };

  async function refreshLeadsAppointments() {
    const result = await listSelfHostedLeadsAppointments({
      ...baseArgs,
      limit: 5,
    });
    if (result.ok && result.value) {
      setLeadsAppointments(result.value);
      setLeadsAppointmentsError(null);
    } else {
      setLeadsAppointmentsError(result.error);
    }
  }

  async function submitCreateLead(event: FormEvent) {
    event.preventDefault();
    setLeadBusy("create");
    const result = await createSelfHostedLead({
      ...baseArgs,
      payload: {
        source: newLeadSource,
        safeSummary: newLeadSummary,
      },
    });
    setLeadBusy(null);
    if (result.ok) {
      setNewLeadSummary("");
      setLeadStatus(
        `Лид ${result.value?.safeSummary ?? ""} создан в self-hosted backend.`,
      );
      await refreshLeadsAppointments();
    } else {
      setLeadStatus(publicLeadMessage(result.error));
    }
  }

  async function qualifyLead(lead: SelfHostedLeadOverviewDTO) {
    setLeadBusy(`qualify:${lead.id}`);
    const result = await updateSelfHostedLeadStatus({
      ...baseArgs,
      leadId: lead.id,
      status: "qualified",
    });
    setLeadBusy(null);
    setLeadStatus(
      result.ok
        ? `Лид ${result.value?.safeSummary ?? lead.id} квалифицирован.`
        : publicLeadMessage(result.error),
    );
    if (result.ok) await refreshLeadsAppointments();
  }

  async function bookLead(lead: SelfHostedLeadOverviewDTO) {
    if (!lead.patient.id) return;
    const startedAt = buildDefaultSelfHostedLeadAppointmentStartedAt();
    setLeadBusy(`book:${lead.id}`);
    const result = await bookSelfHostedLeadAppointment({
      ...baseArgs,
      leadId: lead.id,
      payload: {
        patientId: lead.patient.id,
        startedAt,
        chiefComplaint: lead.safeSummary,
      },
    });
    setLeadBusy(null);
    setLeadStatus(
      result.ok
        ? `Лид ${result.value?.lead.safeSummary ?? lead.id} записан на визит.`
        : publicLeadMessage(result.error),
    );
    if (result.ok) await refreshLeadsAppointments();
  }

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · production dashboard из self-hosted backend`
    : "Production dashboard из self-hosted backend";

  const currentAction: CurrentAction =
    dashboard.awaitingConclusions.length > 0
      ? {
          nextStep: "Закрыть заключения",
          actionLabel: "Открыть очередь заключений",
          href: "#desk-reports",
        }
      : dashboard.assetIssues.length > 0
        ? {
            nextStep: "Проверить снимки",
            actionLabel: "Открыть замечания к снимкам",
            href: "#desk-photo-quality",
          }
        : dashboard.upcoming[0]?.patientId
          ? {
              nextStep: "Открыть ближайший визит",
              actionLabel: "Открыть ближайший визит",
              href: `/patients/${dashboard.upcoming[0].patientId}/visits/${dashboard.upcoming[0].id}`,
            }
          : {
              nextStep: "Начать съёмку",
              actionLabel: "Перейти к съёмке",
              href: "/capture",
            };

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Рабочий стол"
        subtitle={subtitle}
        actions={
          <Button asChild size="sm" className="h-8 text-[12px]">
            <Link to="/capture">
              <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Съёмка
            </Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <CurrentActionBand action={currentAction} />

        <section
          role="status"
          aria-live="polite"
          className="surface-card flex items-center justify-between gap-3 px-4 py-3 text-row"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ServerCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span className="truncate">
              {status === "loading"
                ? "Загружаем рабочий стол из self-hosted backend…"
                : status === "error"
                  ? "Production dashboard недоступен."
                  : "Источник данных: self-hosted backend /api/v1/doctor/dashboard."}
            </span>
          </div>
          {error && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
            >
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          )}
        </section>

        {error && (
          <section
            role="alert"
            className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive"
          >
            {error.message}
          </section>
        )}

        <section
          aria-label="Сводка рабочего дня"
          className="surface-card overflow-hidden"
        >
          <header className="section-bar">
            <h2 className="h-section">Сводка рабочего дня</h2>
            <span className="h-section-hint">нагрузка и очереди</span>
          </header>
          <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
            <Kpi
              label="Визиты сегодня"
              value={dashboard.kpis.visitsToday}
              hint="из PostgreSQL"
            />
            <Kpi
              label="Ждут заключения"
              value={dashboard.kpis.awaitingConclusion}
              hint="подписанные без отчёта"
            />
            <Kpi
              label="Активные визиты"
              value={dashboard.kpis.activeVisits}
              hint="draft + in_progress"
            />
            <Kpi
              label="Снимки к проверке"
              value={dashboard.kpis.assetsNeedReview}
              hint="metadata QA"
            />
          </div>
        </section>

        <section aria-labelledby="desk-today-heading" className="space-y-3">
          <BandHeader
            id="desk-today-heading"
            title="Сегодня и заключения"
            hint="сначала визиты, затем очередь отчётов"
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card
              id="desk-visits"
              className="lg:col-span-7"
              title="Ближайшие визиты"
              hint="self-hosted backend"
            >
              {dashboard.upcoming.length === 0 ? (
                <Empty text="Нет активных визитов." />
              ) : (
                <ul className="divide-y divide-border">
                  {dashboard.upcoming.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} />
                  ))}
                </ul>
              )}
            </Card>

            <Card
              id="desk-reports"
              className="lg:col-span-5"
              title="Ждут заключения"
              hint="подписанные без отчёта"
            >
              {dashboard.awaitingConclusions.length === 0 ? (
                <Empty text="Все подписанные визиты оформлены." />
              ) : (
                <ul className="divide-y divide-border">
                  {dashboard.awaitingConclusions.map((visit) => (
                    <li
                      key={visit.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-row font-medium">
                          {visit.patientFullName || "Пациент"}
                        </div>
                        <div className="truncate text-meta tabular-nums">
                          {formatMaybeDate(visit.signedAt || visit.startedAt)}
                        </div>
                      </div>
                      <span className="text-meta">
                        {visit.clinicName || "Клиника"}
                      </span>
                      <VisitLink visit={visit} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>

        <section aria-labelledby="desk-quality-heading" className="space-y-3">
          <BandHeader
            id="desk-quality-heading"
            title="Качество и пациенты"
            hint="замечания к фото рядом с последними пациентами"
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card
              id="desk-recent-patients"
              className="lg:col-span-5"
              title="Недавние пациенты"
              hint="по последнему визиту"
            >
              {dashboard.recentPatients.length === 0 ? (
                <Empty text="Недавних пациентов нет." />
              ) : (
                <ul className="divide-y divide-border">
                  {dashboard.recentPatients.map((patient) => (
                    <RecentPatientRow key={patient.id} patient={patient} />
                  ))}
                </ul>
              )}
            </Card>

            <Card
              id="desk-photo-quality"
              className="lg:col-span-7"
              title="Замечания к снимкам"
              hint="metadata completeness"
            >
              {dashboard.assetIssues.length === 0 ? (
                <Empty text="Замечаний по снимкам нет." />
              ) : (
                <ul className="divide-y divide-border">
                  {dashboard.assetIssues.map((issue) => (
                    <AssetIssueRow key={issue.id} issue={issue} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>

        <section aria-labelledby="desk-practice-heading" className="space-y-3">
          <BandHeader
            id="desk-practice-heading"
            title="Практика и оборудование"
            hint="записи, лиды и готовность устройств"
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <Card
              id="desk-leads"
              className="lg:col-span-6"
              title="Лиды и записи"
              hint="self-hosted backend"
            >
              <div className="border-b border-border px-4 py-2 text-meta">
                Источник данных: self-hosted backend /api/v1/leads/appointments.
              </div>
              <form
                onSubmit={submitCreateLead}
                className="border-b border-border px-4 py-3"
              >
                <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      htmlFor="stage5l-lead-summary"
                    >
                      Краткое описание лида
                    </label>
                    <Textarea
                      id="stage5l-lead-summary"
                      value={newLeadSummary}
                      onChange={(event) =>
                        setNewLeadSummary(event.target.value)
                      }
                      className="min-h-16 text-[13px]"
                      placeholder="Запрос на первичный осмотр, источник и безопасный контекст"
                    />
                  </div>
                  <div className="w-full sm:w-36">
                    <label
                      className="mb-1 block text-[12px] font-medium"
                      htmlFor="stage5l-lead-source"
                    >
                      Источник
                    </label>
                    <select
                      id="stage5l-lead-source"
                      value={newLeadSource}
                      onChange={(event) => setNewLeadSource(event.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
                    >
                      {Object.entries(LEAD_SOURCE_LABEL).map(
                        ([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      leadBusy === "create" ||
                      newLeadSummary.trim().length === 0
                    }
                    className="h-9 text-[12px]"
                  >
                    {leadBusy === "create" ? "Создаём…" : "Добавить лид"}
                  </Button>
                </div>
                <div
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                  className="text-meta"
                >
                  {leadStatus}
                </div>
              </form>
              {leadsAppointmentsError && (
                <div
                  role="alert"
                  className="px-4 py-3 text-row text-destructive"
                >
                  Не удалось загрузить лиды и записи из self-hosted backend.
                </div>
              )}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
                <Stat
                  term="Лиды всего"
                  value={leadsAppointments.kpis.leadsTotal}
                />
                <Stat
                  term="Новые/квалиф."
                  value={`${leadsAppointments.kpis.newLeads}/${leadsAppointments.kpis.qualifiedLeads}`}
                />
                <Stat
                  term="Записи запланированы"
                  value={leadsAppointments.kpis.plannedAppointments}
                />
                <Stat
                  term="Записи выполнены"
                  value={leadsAppointments.kpis.completedAppointments}
                />
              </dl>
              {(leadsAppointments.leads.length > 0 ||
                leadsAppointments.appointments.length > 0) && (
                <div className="grid grid-cols-1 border-t border-border md:grid-cols-2">
                  <div className="min-w-0 border-b border-border md:border-b-0 md:border-r">
                    <div className="px-4 py-2 text-[12px] font-medium text-muted-foreground">
                      Последние лиды
                    </div>
                    <ul className="divide-y divide-border">
                      {leadsAppointments.leads.slice(0, 3).map((lead) => (
                        <LeadRow
                          key={lead.id}
                          lead={lead}
                          busy={leadBusy}
                          onQualify={qualifyLead}
                          onBook={bookLead}
                        />
                      ))}
                    </ul>
                  </div>
                  <div className="min-w-0">
                    <div className="px-4 py-2 text-[12px] font-medium text-muted-foreground">
                      Ближайшие записи
                    </div>
                    <ul className="divide-y divide-border">
                      {leadsAppointments.appointments
                        .slice(0, 3)
                        .map((appointment) => (
                          <AppointmentRow
                            key={appointment.id}
                            appointment={appointment}
                          />
                        ))}
                    </ul>
                  </div>
                </div>
              )}
            </Card>

            <Card
              id="desk-devices"
              className="lg:col-span-6"
              title="Устройства"
              hint="self-hosted registry"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
                <Stat term="Всего" value={dashboard.kpis.devicesTotal} />
                <Stat
                  term="Активны за 30 дней"
                  value={dashboard.kpis.devicesActive30d}
                />
              </dl>
              {dashboard.devices.length > 0 && (
                <ul className="divide-y divide-border border-t border-border">
                  {dashboard.devices.map((device) => (
                    <DeviceRow key={device.id} device={device} />
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}

function VisitRow({ visit }: { visit: SelfHostedDashboardVisit }) {
  return (
    <li className="row-grid">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {visit.patientFullName || "Пациент"}
        </div>
        <div className="truncate text-meta">
          <span className="font-mono">{visit.patientCode || "—"}</span> ·{" "}
          {visit.clinicName || "Клиника"}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-row tabular-nums">
          {formatMaybeDate(visit.startedAt)}
        </div>
        <div className="truncate text-meta">{visit.chiefComplaint || "—"}</div>
      </div>
      <StatusChip>{STATUS_LABEL[visit.status] || visit.status}</StatusChip>
      <VisitLink visit={visit} />
    </li>
  );
}

function VisitLink({ visit }: { visit: SelfHostedDashboardVisit }) {
  return visit.patientId ? (
    <RowLink
      to={`/patients/${visit.patientId}/visits/${visit.id}`}
      label={`Открыть визит ${visit.id}`}
    />
  ) : (
    <span />
  );
}

function RecentPatientRow({
  patient,
}: {
  patient: SelfHostedDashboardPatient;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {patient.fullName || "Пациент"}
        </div>
        <div className="truncate text-meta">
          <span className="font-mono">{patient.code || "—"}</span>
          {patient.sex && (
            <> · {sexShort(patient.sex === "male" ? "male" : "female")}</>
          )}
        </div>
      </div>
      <span className="text-meta tabular-nums">
        {formatMaybeDate(patient.lastVisitAt)}
      </span>
      <RowLink
        to={`/patients/${patient.id}`}
        label={`Открыть карточку ${patient.fullName || patient.id}`}
      />
    </li>
  );
}

function AssetIssueRow({ issue }: { issue: SelfHostedDashboardAssetIssue }) {
  return (
    <li className="row-grid">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {issue.patientFullName || "Пациент"}
        </div>
        <div className="truncate text-meta">{issue.kind}</div>
      </div>
      <div className="truncate text-meta">
        {ISSUE_LABEL[issue.issue] || issue.issue}
      </div>
      <span className="inline-flex shrink-0 items-center rounded-sm bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium">
        QA
      </span>
      {issue.patientId && issue.visitId ? (
        <RowLink
          to={`/patients/${issue.patientId}/visits/${issue.visitId}`}
          label={`Открыть визит ${issue.visitId}`}
        />
      ) : (
        <span />
      )}
    </li>
  );
}

function publicLeadMessage(
  error: { code?: string; message?: string } | null | undefined,
): string {
  if (!error) return "Не удалось сохранить лид.";
  if (error.code === "forbidden")
    return "Недостаточно прав для изменения лидов.";
  if (error.code === "validation_error")
    return "Проверьте поля лида: backend вернул ошибку валидации.";
  return error.message || "Не удалось сохранить лид.";
}

function CurrentActionBand({ action }: { action: CurrentAction }) {
  const actionLink = action.href.startsWith("#") ? (
    <a href={action.href}>{action.actionLabel}</a>
  ) : (
    <Link to={action.href}>{action.actionLabel}</Link>
  );

  return (
    <section
      role="region"
      aria-label="Что делать сейчас"
      className="surface-card grid gap-3 px-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Что делать сейчас
        </p>
        <h2 className="mt-1 truncate text-[16px] font-semibold">
          Следующий шаг: {action.nextStep}
        </h2>
        <p className="mt-1 truncate text-meta">
          Ближайшее действие: {action.actionLabel}
        </p>
      </div>
      <Button asChild size="sm" className="min-h-10 justify-center text-[12px]">
        {actionLink}
      </Button>
    </section>
  );
}

function BandHeader({
  id,
  title,
  hint,
}: {
  id: string;
  title: string;
  hint: string;
}) {
  return (
    <header className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
      <h2 id={id} className="h-section">
        {title}
      </h2>
      <p className="truncate text-meta">{hint}</p>
    </header>
  );
}

function LeadRow({
  lead,
  busy,
  onQualify,
  onBook,
}: {
  lead: SelfHostedLeadOverviewDTO;
  busy: string | null;
  onQualify: (lead: SelfHostedLeadOverviewDTO) => void | Promise<void>;
  onBook: (lead: SelfHostedLeadOverviewDTO) => void | Promise<void>;
}) {
  const canQualify = lead.status === "new";
  const canBook =
    Boolean(lead.patient.id) &&
    lead.status !== "booked" &&
    lead.status !== "lost";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {lead.patient.fullName || lead.safeSummary || "Лид"}
        </div>
        <div className="truncate text-meta">
          {LEAD_SOURCE_LABEL[lead.source] ?? lead.source} ·{" "}
          {LEAD_STATUS_LABEL[lead.status] ?? lead.status} ·{" "}
          {lead.clinic.name || "Клиника"}
        </div>
      </div>
      <div className="flex flex-wrap justify-end gap-1">
        {canQualify && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            aria-label={`Квалифицировать лид ${lead.id}`}
            disabled={busy === `qualify:${lead.id}`}
            onClick={() => {
              void onQualify(lead);
            }}
          >
            {busy === `qualify:${lead.id}` ? "..." : "Квалифицировать"}
          </Button>
        )}
        {canBook && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            aria-label={`Создать запись из лида ${lead.id}`}
            disabled={busy === `book:${lead.id}`}
            onClick={() => {
              void onBook(lead);
            }}
          >
            {busy === `book:${lead.id}` ? "..." : "Записать"}
          </Button>
        )}
        <span className="self-center text-meta tabular-nums">
          {formatMaybeDate(lead.createdAt)}
        </span>
      </div>
    </li>
  );
}

function AppointmentRow({
  appointment,
}: {
  appointment: SelfHostedAppointmentOverviewDTO;
}) {
  const patientId = appointment.patient.id || appointment.patientId;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {appointment.patient.fullName || "Пациент"}
        </div>
        <div className="truncate text-meta">
          {formatMaybeDate(appointment.slotAt)} · {appointment.status}
        </div>
      </div>
      {patientId ? (
        <RowLink
          to={`/patients/${patientId}/visits/${appointment.visitId}`}
          label={`Открыть запись ${appointment.id}`}
        />
      ) : (
        <span />
      )}
    </li>
  );
}

function DeviceRow({ device }: { device: SelfHostedDashboardDevice }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {device.model || "Устройство"}
        </div>
        <div className="truncate text-meta">
          <span className="font-mono">{device.serial || "—"}</span> ·{" "}
          {device.status}
        </div>
      </div>
      <span className="text-meta tabular-nums">
        {formatMaybeDate(device.lastSeenAt)}
      </span>
    </li>
  );
}

function Card({
  id,
  title,
  hint,
  className,
  children,
}: {
  id?: string;
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-4 surface-card overflow-hidden ${className ?? ""}`}
    >
      <header className="section-bar">
        <h2 className="h-section">{title}</h2>
        {hint && <span className="h-section-hint">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-meta">{text}</div>;
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && (
        <span className="text-[11px] text-muted-foreground">{hint}</span>
      )}
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-meta">{term}</dt>
      <dd className="text-row font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function StatusChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden shrink-0 rounded-sm bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
      {children}
    </span>
  );
}

function RowLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="row-action inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground sm:h-7 sm:w-7"
    >
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "—";
}
