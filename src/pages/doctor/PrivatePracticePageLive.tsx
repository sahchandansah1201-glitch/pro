import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  FileText,
  LayoutDashboard,
  ServerCog,
  Stethoscope,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import {
  getSelfHostedDoctorDashboard,
  type SelfHostedApiError,
  type SelfHostedDashboardAssetIssue,
  type SelfHostedDashboardDevice,
  type SelfHostedDashboardVisit,
  type SelfHostedDoctorDashboard,
} from "@/lib/self-hosted-dashboard-api";
import {
  createSelfHostedLead,
  listSelfHostedLeadsAppointments,
  type SelfHostedLeadOverviewDTO,
  type SelfHostedLeadsAppointmentsOverview,
} from "@/lib/self-hosted-leads-appointments-api";
import {
  isSelfHostedApiConfigured,
  type SelfHostedApiSessionRoleBinding,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";

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

const EMPTY_LEADS: SelfHostedLeadsAppointmentsOverview = {
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

const VISIT_STATUS_LABEL: Record<string, string> = {
  planned: "Запланирован",
  draft: "Запланирован",
  in_progress: "В работе",
  signed: "Подписан",
  completed: "Завершён",
  cancelled: "Отменён",
};

const LEAD_STATUS_LABEL: Record<string, string> = {
  new: "Новая",
  qualified: "Проверена",
  booked: "Записана",
  lost: "Закрыта",
};

const DEVICE_STATUS_LABEL: Record<string, string> = {
  active: "на связи",
  inactive: "неактивно",
  error: "нужна проверка",
  disabled: "отключено",
};

function visitStatusLabel(status: string) {
  return VISIT_STATUS_LABEL[status] ?? "Статус не указан";
}

function leadStatusLabel(status: string) {
  return LEAD_STATUS_LABEL[status] ?? "Статус не указан";
}

function deviceStatusLabel(status: string) {
  return DEVICE_STATUS_LABEL[status] ?? "статус не указан";
}

function publicErrorMessage(error: SelfHostedApiError | null | undefined): string {
  if (!error) return "Рабочая база временно недоступна. Повторите действие позже.";
  if (error.code === "forbidden") return "Недостаточно прав для этого действия.";
  if (error.kind === "not_configured") return "Войдите в систему клиники, чтобы открыть рабочий кабинет.";
  if (error.kind === "validation") return "Проверьте заполненные поля.";
  return "Рабочая база временно недоступна. Повторите действие позже.";
}

function clinicNameFromData(
  dashboard: SelfHostedDoctorDashboard,
  leadsAppointments: SelfHostedLeadsAppointmentsOverview,
  roleBindings: SelfHostedApiSessionRoleBinding[] = [],
) {
  const roleClinicName =
    roleBindings.find((binding) => binding.role === "private_doctor" && binding.clinicName)?.clinicName ||
    roleBindings.find((binding) => binding.clinicName)?.clinicName;
  return (
    roleClinicName ||
    dashboard.upcoming.find((visit) => visit.clinicName)?.clinicName ||
    dashboard.awaitingConclusions.find((visit) => visit.clinicName)?.clinicName ||
    leadsAppointments.leads.find((lead) => lead.clinic.name)?.clinic.name ||
    leadsAppointments.appointments.find((appointment) => appointment.clinic.name)?.clinic.name ||
    "частный кабинет"
  );
}

export default function PrivatePracticePageLive() {
  const session = useSelfHostedApiSession();
  const [dashboard, setDashboard] = useState<SelfHostedDoctorDashboard>(EMPTY_DASHBOARD);
  const [leadsAppointments, setLeadsAppointments] =
    useState<SelfHostedLeadsAppointmentsOverview>(EMPTY_LEADS);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState<SelfHostedApiError | null>(null);
  const [leadSummary, setLeadSummary] = useState("");
  const [leadStatus, setLeadStatus] = useState("Заявки сохраняются в системе клиники.");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!isSelfHostedApiConfigured(session)) {
        setStatus("error");
        setError({
          kind: "not_configured",
          code: "not_configured",
          message: "Вход не выполнен.",
        });
        return;
      }
      setStatus("loading");
      const [dashboardResult, leadsResult] = await Promise.all([
        getSelfHostedDoctorDashboard({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
        }),
        listSelfHostedLeadsAppointments({
          apiBaseUrl: session.apiBaseUrl,
          apiToken: session.apiToken,
          limit: 6,
        }),
      ]);
      if (cancelled) return;
      if (!dashboardResult.ok || !dashboardResult.value) {
        setStatus("error");
        setError(dashboardResult.error);
        return;
      }
      setDashboard(dashboardResult.value);
      setLeadsAppointments(leadsResult.ok && leadsResult.value ? leadsResult.value : EMPTY_LEADS);
      setStatus("ready");
      setError(null);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [session.apiBaseUrl, session.apiToken, session.status]);

  async function refreshLeads() {
    const result = await listSelfHostedLeadsAppointments({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      limit: 6,
    });
    if (result.ok && result.value) setLeadsAppointments(result.value);
  }

  async function submitLead(event: FormEvent) {
    event.preventDefault();
    if (!leadSummary.trim()) {
      setLeadStatus("Опишите заявку перед сохранением.");
      return;
    }
    setBusy(true);
    const result = await createSelfHostedLead({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      payload: {
        source: "operator",
        safeSummary: leadSummary.trim(),
      },
    });
    setBusy(false);
    if (!result.ok) {
      setLeadStatus(publicErrorMessage(result.error));
      return;
    }
    setLeadStatus(`Заявка создана в системе клиники: ${result.value?.safeSummary ?? leadSummary.trim()}`);
    setLeadSummary("");
    await refreshLeads();
  }

  const clinicName = clinicNameFromData(dashboard, leadsAppointments, session.user?.roleBindings);
  const displayName = session.user?.displayName || "Частный врач";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Центр частной практики"
        subtitle={`${displayName} · ${clinicName} · приём, заявки, снимки и готовность кабинета`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild size="sm" className="min-h-11 text-[12px]">
              <Link to="/desk">Рабочий стол</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px]">
              <Link to="/capture">Съёмка</Link>
            </Button>
          </div>
        }
      />

      <main className="space-y-4 p-3 sm:p-4">
        <section
          role="status"
          aria-live="polite"
          className="surface-card flex flex-col gap-2 px-3 py-3 text-[12px] sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex min-w-0 items-center gap-2">
            <ServerCog className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>
              {status === "loading"
                ? "Загружаем данные частного кабинета…"
                : status === "error"
                  ? publicErrorMessage(error)
                  : "Источник данных: система клиники."}
            </span>
          </div>
          {status === "error" && (
            <Button asChild variant="outline" size="sm" className="min-h-11 text-[12px]">
              <Link to="/self-hosted/login">Войти</Link>
            </Button>
          )}
        </section>

        <section aria-label="Сводка частной практики" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Пациенты" value={dashboard.kpis.patientsInScope} hint="в области доступа" />
          <KpiCard label="Активные визиты" value={dashboard.kpis.activeVisits} hint="в работе" />
          <KpiCard label="Ждут заключения" value={dashboard.kpis.awaitingConclusion} hint="подписанные визиты" />
          <KpiCard label="Новые заявки" value={leadsAppointments.kpis.newLeads} hint="к разбору" />
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
          <Card title="Очередь частной практики" hint="приоритетные действия">
            <PracticeQueue dashboard={dashboard} leads={leadsAppointments.leads} />
          </Card>

          <Card title="Заявки на запись" hint="ручное добавление">
            <form onSubmit={submitLead} className="border-b border-border px-3 py-3">
              <label className="mb-1 block text-[12px] font-medium" htmlFor="private-practice-lead-summary">
                Краткое описание заявки
              </label>
              <Textarea
                id="private-practice-lead-summary"
                value={leadSummary}
                onChange={(event) => setLeadSummary(event.target.value)}
                className="min-h-20 text-[13px]"
                placeholder="Например: первичный осмотр, источник обращения и безопасный контекст"
              />
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div role="status" aria-live="polite" aria-atomic="true" className="text-meta">
                  {leadStatus}
                </div>
                <Button type="submit" size="sm" disabled={busy || !leadSummary.trim()} className="min-h-11 text-[12px]">
                  {busy ? "Сохраняем…" : "Добавить заявку"}
                </Button>
              </div>
            </form>
            <LeadList leads={leadsAppointments.leads} />
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card title="Сегодня" hint="визиты и записи">
            <ListEmptyGuard empty={dashboard.upcoming.length === 0} text="Активных визитов нет.">
              {dashboard.upcoming.slice(0, 4).map((visit) => (
                <VisitRow key={visit.id} visit={visit} />
              ))}
            </ListEmptyGuard>
          </Card>

          <Card title="Снимки к проверке" hint="качество данных">
            <ListEmptyGuard empty={dashboard.assetIssues.length === 0} text="Замечаний по снимкам нет.">
              {dashboard.assetIssues.slice(0, 4).map((issue) => (
                <AssetIssueRow key={issue.id} issue={issue} />
              ))}
            </ListEmptyGuard>
          </Card>

          <Card title="Готовность кабинета" hint="оборудование и действия">
            <div className="divide-y divide-border">
              <ReadinessRow
                Icon={CalendarDays}
                title="Расписание"
                detail={`${leadsAppointments.kpis.plannedAppointments} записи запланированы`}
                ready={leadsAppointments.kpis.plannedAppointments > 0}
              />
              <ReadinessRow
                Icon={Stethoscope}
                title="Дерматоскоп"
                detail={
                  dashboard.devices[0]
                    ? `${dashboard.devices[0].model || "Устройство"} · ${deviceStatusLabel(dashboard.devices[0].status)}`
                    : "активное устройство не найдено"
                }
                ready={dashboard.kpis.devicesActive30d > 0}
              />
            </div>
            <div className="grid grid-cols-1 gap-2 border-t border-border p-3">
              <QuickLink to="/desk" Icon={LayoutDashboard}>Открыть рабочий стол</QuickLink>
              <QuickLink to="/capture" Icon={Camera}>Перейти к съёмке</QuickLink>
              <QuickLink to="/reports" Icon={FileText}>Открыть отчёты</QuickLink>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="surface-card overflow-hidden">
      <header className="section-bar">
        <h2 className="h-section">{title}</h2>
        <span className="h-section-hint">{hint}</span>
      </header>
      {children}
    </section>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function PracticeQueue({
  dashboard,
  leads,
}: {
  dashboard: SelfHostedDoctorDashboard;
  leads: SelfHostedLeadOverviewDTO[];
}) {
  const queue = [
    ...dashboard.awaitingConclusions.slice(0, 2).map((visit) => ({
      id: `conclusion-${visit.id}`,
      title: "Закрыть заключение",
      detail: visit.patientFullName || "Пациент",
      meta: formatDateTime(visit.signedAt || visit.startedAt),
      href: visit.patientId ? `/patients/${visit.patientId}/visits/${visit.id}?tab=report` : "/reports",
    })),
    ...dashboard.assetIssues.slice(0, 2).map((issue) => ({
      id: `asset-${issue.id}`,
      title: "Проверить снимок",
      detail: issue.patientFullName || "Пациент",
      meta: "служебные данные снимка скрыты",
      href: issue.patientId && issue.visitId ? `/patients/${issue.patientId}/visits/${issue.visitId}` : "/capture",
    })),
    ...leads.slice(0, 2).map((lead) => ({
      id: `lead-${lead.id}`,
      title: "Разобрать заявку",
      detail: lead.patient.fullName || lead.safeSummary || "Новая заявка",
      meta: leadStatusLabel(lead.status),
      href: "/desk#desk-leads",
    })),
  ];

  if (queue.length === 0) return <Empty text="Срочных действий нет." />;

  return (
    <div className="grid grid-cols-1 gap-2 p-3">
      {queue.map((item) => (
        <article key={item.id} className="rounded-md border border-border bg-surface p-3 text-[12px]">
          <div className="font-semibold">{item.title}</div>
          <div className="mt-1 text-muted-foreground">{item.detail}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{item.meta}</div>
          <Button asChild variant="outline" size="sm" className="mt-3 min-h-11 text-[12px]">
            <Link to={item.href}>Открыть</Link>
          </Button>
        </article>
      ))}
    </div>
  );
}

function LeadList({ leads }: { leads: SelfHostedLeadOverviewDTO[] }) {
  if (leads.length === 0) return <Empty text="Заявок пока нет." />;
  return (
    <ul className="divide-y divide-border">
      {leads.slice(0, 5).map((lead) => (
        <li key={lead.id} className="px-3 py-2 text-[12px]">
          <div className="font-medium">{lead.patient.fullName || lead.safeSummary || "Заявка"}</div>
          <div className="text-[11px] text-muted-foreground">
            {leadStatusLabel(lead.status)} · {formatDateTime(lead.createdAt)}
          </div>
        </li>
      ))}
    </ul>
  );
}

function VisitRow({ visit }: { visit: SelfHostedDashboardVisit }) {
  return (
    <div className="px-3 py-2 text-[12px]">
      <div className="font-medium">{visit.patientFullName || "Пациент"}</div>
      <div className="text-[11px] text-muted-foreground">
        {visitStatusLabel(visit.status)} · {formatDateTime(visit.startedAt)}
      </div>
    </div>
  );
}

function AssetIssueRow({ issue }: { issue: SelfHostedDashboardAssetIssue }) {
  return (
    <div className="px-3 py-2 text-[12px]">
      <div className="font-medium">{issue.patientFullName || "Пациент"}</div>
      <div className="text-[11px] text-muted-foreground">Проверить данные снимка</div>
    </div>
  );
}

function ReadinessRow({
  Icon,
  title,
  detail,
  ready,
}: {
  Icon: typeof Users;
  title: string;
  detail: string;
  ready: boolean;
}) {
  const StatusIcon = ready ? CheckCircle2 : AlertTriangle;
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 px-3 py-3 text-[12px]">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-muted-foreground">{detail}</div>
      </div>
      <StatusIcon className={ready ? "h-4 w-4 text-success" : "h-4 w-4 text-warning"} aria-hidden />
    </div>
  );
}

function QuickLink({ to, Icon, children }: { to: string; Icon: typeof Users; children: ReactNode }) {
  return (
    <Button asChild variant="outline" size="sm" className="min-h-11 justify-start text-[12px]">
      <Link to={to}>
        <Icon className="mr-2 h-4 w-4" aria-hidden />
        {children}
      </Link>
    </Button>
  );
}

function ListEmptyGuard({ empty, text, children }: { empty: boolean; text: string; children: ReactNode }) {
  return empty ? <Empty text={text} /> : <div className="divide-y divide-border">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">{text}</div>;
}
