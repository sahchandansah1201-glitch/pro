import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Camera, ChevronRight, ServerCog } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { formatDateTime, sexShort } from "@/lib/format";
import {
  listSelfHostedLeadsAppointments,
  type SelfHostedAppointmentOverviewDTO,
  type SelfHostedLeadOverviewDTO,
  type SelfHostedLeadsAppointmentsOverview,
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
  filters: { leadStatus: "all", appointmentStatus: "all", dateFrom: null, dateTo: null, search: null },
};

export default function DeskPageLive() {
  const session = useSelfHostedApiSession();
  const [dashboard, setDashboard] = useState<SelfHostedDoctorDashboard>(EMPTY_DASHBOARD);
  const [leadsAppointments, setLeadsAppointments] =
    useState<SelfHostedLeadsAppointmentsOverview>(EMPTY_LEADS_APPOINTMENTS);
  const [leadsAppointmentsError, setLeadsAppointmentsError] = useState<SelfHostedApiError | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
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

  const subtitle = session.user?.displayName
    ? `${session.user.displayName} · production dashboard из self-hosted backend`
    : "Production dashboard из self-hosted backend";

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
            <Button asChild variant="outline" size="sm" className="h-8 text-[12px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          )}
        </section>

        {error && (
          <section role="alert" className="surface-card border-destructive/30 px-4 py-3 text-row text-destructive">
            {error.message}
          </section>
        )}

        <section className="surface-card grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
          <Kpi label="Визиты сегодня" value={dashboard.kpis.visitsToday} hint="из PostgreSQL" />
          <Kpi label="Ждут заключения" value={dashboard.kpis.awaitingConclusion} hint="подписанные без отчёта" />
          <Kpi label="Активные визиты" value={dashboard.kpis.activeVisits} hint="draft + in_progress" />
          <Kpi label="Снимки к проверке" value={dashboard.kpis.assetsNeedReview} hint="metadata QA" />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7" title="Ближайшие визиты" hint="self-hosted backend">
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

          <Card className="lg:col-span-5" title="Ждут заключения" hint="подписанные без отчёта">
            {dashboard.awaitingConclusions.length === 0 ? (
              <Empty text="Все подписанные визиты оформлены." />
            ) : (
              <ul className="divide-y divide-border">
                {dashboard.awaitingConclusions.map((visit) => (
                  <li key={visit.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-row font-medium">{visit.patientFullName || "Пациент"}</div>
                      <div className="truncate text-meta tabular-nums">{formatMaybeDate(visit.signedAt || visit.startedAt)}</div>
                    </div>
                    <span className="text-meta">{visit.clinicName || "Клиника"}</span>
                    <VisitLink visit={visit} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5" title="Недавние пациенты" hint="по последнему визиту">
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

          <Card className="lg:col-span-7" title="Замечания к снимкам" hint="metadata completeness">
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

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6" title="Лиды и записи" hint="self-hosted backend">
            <div className="border-b border-border px-4 py-2 text-meta">
              Источник данных: self-hosted backend /api/v1/leads/appointments.
            </div>
            {leadsAppointmentsError && (
              <div role="alert" className="px-4 py-3 text-row text-destructive">
                Не удалось загрузить лиды и записи из self-hosted backend.
              </div>
            )}
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
              <Stat term="Лиды всего" value={leadsAppointments.kpis.leadsTotal} />
              <Stat term="Новые/квалиф." value={`${leadsAppointments.kpis.newLeads}/${leadsAppointments.kpis.qualifiedLeads}`} />
              <Stat term="Записи запланированы" value={leadsAppointments.kpis.plannedAppointments} />
              <Stat term="Записи выполнены" value={leadsAppointments.kpis.completedAppointments} />
            </dl>
            {(leadsAppointments.leads.length > 0 || leadsAppointments.appointments.length > 0) && (
              <div className="grid grid-cols-1 border-t border-border md:grid-cols-2">
                <div className="min-w-0 border-b border-border md:border-b-0 md:border-r">
                  <div className="px-4 py-2 text-[12px] font-medium text-muted-foreground">Последние лиды</div>
                  <ul className="divide-y divide-border">
                    {leadsAppointments.leads.slice(0, 3).map((lead) => (
                      <LeadRow key={lead.id} lead={lead} />
                    ))}
                  </ul>
                </div>
                <div className="min-w-0">
                  <div className="px-4 py-2 text-[12px] font-medium text-muted-foreground">Ближайшие записи</div>
                  <ul className="divide-y divide-border">
                    {leadsAppointments.appointments.slice(0, 3).map((appointment) => (
                      <AppointmentRow key={appointment.id} appointment={appointment} />
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          <Card className="lg:col-span-6" title="Устройства" hint="self-hosted registry">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
              <Stat term="Всего" value={dashboard.kpis.devicesTotal} />
              <Stat term="Активны за 30 дней" value={dashboard.kpis.devicesActive30d} />
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
      </div>
    </div>
  );
}

function VisitRow({ visit }: { visit: SelfHostedDashboardVisit }) {
  return (
    <li className="row-grid">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">{visit.patientFullName || "Пациент"}</div>
        <div className="truncate text-meta">
          <span className="font-mono">{visit.patientCode || "—"}</span> · {visit.clinicName || "Клиника"}
        </div>
      </div>
      <div className="min-w-0">
        <div className="truncate text-row tabular-nums">{formatMaybeDate(visit.startedAt)}</div>
        <div className="truncate text-meta">{visit.chiefComplaint || "—"}</div>
      </div>
      <StatusChip>{STATUS_LABEL[visit.status] || visit.status}</StatusChip>
      <VisitLink visit={visit} />
    </li>
  );
}

function VisitLink({ visit }: { visit: SelfHostedDashboardVisit }) {
  return visit.patientId ? (
    <RowLink to={`/patients/${visit.patientId}/visits/${visit.id}`} label={`Открыть визит ${visit.id}`} />
  ) : (
    <span />
  );
}

function RecentPatientRow({ patient }: { patient: SelfHostedDashboardPatient }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">{patient.fullName || "Пациент"}</div>
        <div className="truncate text-meta">
          <span className="font-mono">{patient.code || "—"}</span>
          {patient.sex && <> · {sexShort(patient.sex === "male" ? "male" : "female")}</>}
        </div>
      </div>
      <span className="text-meta tabular-nums">{formatMaybeDate(patient.lastVisitAt)}</span>
      <RowLink to={`/patients/${patient.id}`} label={`Открыть карточку ${patient.fullName || patient.id}`} />
    </li>
  );
}

function AssetIssueRow({ issue }: { issue: SelfHostedDashboardAssetIssue }) {
  return (
    <li className="row-grid">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">{issue.patientFullName || "Пациент"}</div>
        <div className="truncate text-meta">{issue.kind}</div>
      </div>
      <div className="truncate text-meta">{ISSUE_LABEL[issue.issue] || issue.issue}</div>
      <span className="inline-flex shrink-0 items-center rounded-sm bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium">
        QA
      </span>
      {issue.patientId && issue.visitId ? (
        <RowLink to={`/patients/${issue.patientId}/visits/${issue.visitId}`} label={`Открыть визит ${issue.visitId}`} />
      ) : (
        <span />
      )}
    </li>
  );
}

function LeadRow({ lead }: { lead: SelfHostedLeadOverviewDTO }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2">
      <div className="min-w-0">
        <div className="truncate text-row font-medium">
          {lead.patient.fullName || lead.safeSummary || "Лид"}
        </div>
        <div className="truncate text-meta">
          {lead.source} · {lead.status} · {lead.clinic.name || "Клиника"}
        </div>
      </div>
      <span className="text-meta tabular-nums">{formatMaybeDate(lead.createdAt)}</span>
    </li>
  );
}

function AppointmentRow({ appointment }: { appointment: SelfHostedAppointmentOverviewDTO }) {
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
        <div className="truncate text-row font-medium">{device.model || "Устройство"}</div>
        <div className="truncate text-meta">
          <span className="font-mono">{device.serial || "—"}</span> · {device.status}
        </div>
      </div>
      <span className="text-meta tabular-nums">{formatMaybeDate(device.lastSeenAt)}</span>
    </li>
  );
}

function Card({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`surface-card overflow-hidden ${className ?? ""}`}>
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

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-4">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
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
      className="row-action inline-flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}

function formatMaybeDate(value: string | null | undefined): string {
  return value ? formatDateTime(value) : "—";
}
