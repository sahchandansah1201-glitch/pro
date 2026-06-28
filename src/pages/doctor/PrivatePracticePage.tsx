import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CalendarDays,
  Camera,
  CheckCircle2,
  CreditCard,
  FileText,
  Plug,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { isProductionAppMode } from "@/lib/app-mode";
import {
  getAppointments,
  getClinicById,
  getDevices,
  getImages,
  getLeads,
  getPatientById,
  getReports,
  getVisits,
} from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import { formatDateTime } from "@/lib/format";
import type {
  Appointment,
  AppointmentChannel,
  AppointmentStatus,
  ClinicalImage,
  LeadStatus,
  Visit,
} from "@/lib/domain";
import PrivatePracticePageLive from "@/pages/doctor/PrivatePracticePageLive";

const PRIVATE_DOCTOR = DEMO_USERS.private_doctor;
const PRIVATE_CLINIC_ID = PRIVATE_DOCTOR.clinicId ?? "";
const QUALITY_THRESHOLD = 0.8;

const DEMO_NOTICE =
  "Учебный режим: показаны рабочие очереди частного врача, оплата и готовность кабинета. Служебные коды, внешние идентификаторы и автоматические медицинские выводы скрыты.";

const VISIT_STATUS_LABEL: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  planned: "Запланирована",
  confirmed: "Подтверждена",
  completed: "Завершена",
  cancelled: "Отменена",
  no_show: "Не пришёл",
};

const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, OpsTone> = {
  planned: "info",
  confirmed: "ok",
  completed: "muted",
  cancelled: "danger",
  no_show: "warn",
};

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новая",
  qualified: "Проверена",
  booked: "Записана",
  lost: "Закрыта",
  duplicate: "Повтор",
};

const CHANNEL_LABEL: Record<AppointmentChannel, string> = {
  bot: "бот",
  operator: "оператор",
  phone: "телефон",
  portal: "портал",
};

type OpsTone = "ok" | "warn" | "danger" | "info" | "muted";

const TONE: Record<OpsTone, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  warn: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-info/40 bg-info/10 text-info",
  muted: "border-border bg-muted/50 text-muted-foreground",
};

type QueueItem = {
  id: string;
  title: string;
  detail: string;
  meta: string;
  to: string;
  cta: string;
  tone: OpsTone;
  Icon: LucideIcon;
};

function money(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function qualityIssueText(image: ClinicalImage): string {
  return image.quality.issues.length > 0 ? image.quality.issues.join(", ") : "проверить качество";
}

function imageKindLabel(image: ClinicalImage): string {
  switch (image.kind) {
    case "overview":
      return "Общий вид";
    case "dermoscopy":
      return "Дерматоскопия";
    case "macro":
      return "Крупный план";
    case "body_map":
      return "Карта тела";
    default:
      return "Снимок";
  }
}

function patientLabel(patientId: string): string {
  const patient = getPatientById(patientId);
  return patient ? patient.fullName : "Пациент";
}

function buildPracticeData() {
  const clinic = getClinicById(PRIVATE_CLINIC_ID);
  const visits = getVisits().filter((visit) => visit.doctorId === PRIVATE_DOCTOR.id);
  const visitIds = new Set(visits.map((visit) => visit.id));
  const appointments = getAppointments()
    .filter((appointment) => appointment.doctorId === PRIVATE_DOCTOR.id)
    .sort((a, b) => a.slotAt.localeCompare(b.slotAt));
  const leads = getLeads()
    .filter((lead) => lead.clinicId === PRIVATE_CLINIC_ID)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const reports = getReports().filter((report) => visitIds.has(report.visitId));
  const reportVisitIds = new Set(reports.map((report) => report.visitId));
  const images = getImages().filter((image) => visitIds.has(image.visitId));
  const qualityIssues = images.filter(
    (image) => image.quality.score < QUALITY_THRESHOLD || image.quality.issues.length > 0,
  );
  const devices = getDevices().filter((device) => device.bridgeId === "br-spb-01");

  const todaySlots = appointments.filter((appointment) =>
    appointment.status === "planned" || appointment.status === "confirmed"
  );
  const completed = appointments.filter((appointment) => appointment.status === "completed");
  const closedWithoutReport = visits.filter(
    (visit) => visit.status === "closed" && !reportVisitIds.has(visit.id),
  );
  const activeVisits = visits.filter(
    (visit) => visit.status === "scheduled" || visit.status === "in_progress",
  );
  const openLeads = leads.filter((lead) => lead.status === "new" || lead.status === "qualified");
  const patientIds = new Set<string>();
  for (const visit of visits) patientIds.add(visit.patientId);
  for (const appointment of appointments) patientIds.add(appointment.patientId);
  for (const lead of leads) if (lead.patientId) patientIds.add(lead.patientId);

  const queue: QueueItem[] = [
    ...activeVisits.map((visit) => ({
      id: `visit-${visit.id}`,
      title: "Ближайший визит",
      detail: patientLabel(visit.patientId),
      meta: `${formatDateTime(visit.startedAt)} · ${VISIT_STATUS_LABEL[visit.status]}`,
      to: `/patients/${visit.patientId}/visits/${visit.id}`,
      cta: "Открыть визит",
      tone: "info" as OpsTone,
      Icon: Stethoscope,
    })),
    ...closedWithoutReport.map((visit) => ({
      id: `report-${visit.id}`,
      title: "Нужно закрыть отчёт",
      detail: patientLabel(visit.patientId),
      meta: "закрытый визит без пакета отчёта",
      to: `/patients/${visit.patientId}/visits/${visit.id}?tab=report`,
      cta: "Открыть отчёт",
      tone: "warn" as OpsTone,
      Icon: FileText,
    })),
    ...qualityIssues.slice(0, 2).map((image) => {
      const visit = visits.find((item) => item.id === image.visitId);
      return {
        id: `photo-${image.id}`,
        title: "Проверить снимок",
        detail: visit ? patientLabel(visit.patientId) : "Снимок визита",
        meta: `${Math.round(image.quality.score * 100)}% · ${qualityIssueText(image)}`,
        to: visit ? `/patients/${visit.patientId}/visits/${visit.id}` : "/capture",
        cta: "К снимкам",
        tone: "warn" as OpsTone,
        Icon: Camera,
      };
    }),
    ...openLeads.slice(0, 1).map((lead) => ({
      id: `lead-${lead.id}`,
      title: "Заявка ждёт решения",
      detail: lead.patientId ? patientLabel(lead.patientId) : "Пациент ещё не привязан",
      meta: `${LEAD_STATUS_LABEL[lead.status]} · канал скрыт`,
      to: "/admin/bot",
      cta: "Разобрать заявку",
      tone: "info" as OpsTone,
      Icon: Users,
    })),
  ];

  return {
    clinic,
    appointments,
    leads,
    visits,
    reports,
    qualityIssues,
    devices,
    todaySlots,
    completed,
    openLeads,
    patientCount: patientIds.size,
    queue,
    revenueClosed: completed.length * 3200,
    revenuePlanned: todaySlots.length * 2800,
    paymentTodo: Math.max(1, todaySlots.length + closedWithoutReport.length - reports.length),
  };
}

export default function PrivatePracticePage() {
  return isProductionAppMode() ? <PrivatePracticePageLive /> : <PrivatePracticePageDemo />;
}

function PrivatePracticePageDemo() {
  const data = buildPracticeData();
  const deviceReady = data.devices.length > 0;
  const clinicName = data.clinic?.name ?? "Частный кабинет";

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Центр частной практики"
        subtitle={`${PRIVATE_DOCTOR.fullName} · ${clinicName} · врачебная работа, запись, оплата и готовность кабинета`}
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild size="sm" className="min-h-11 text-[12px] sm:min-h-10">
              <Link to="/cockpit">Рабочее место</Link>
            </Button>
            <Button asChild size="sm" variant="secondary" className="min-h-11 text-[12px] sm:min-h-10">
              <Link to="/capture">Съёмка</Link>
            </Button>
          </div>
        }
      />

      <main className="space-y-3 p-3 sm:p-4">
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] leading-relaxed"
          style={{
            background: "hsl(var(--info) / 0.08)",
            borderColor: "hsl(var(--info) / 0.30)",
            color: "hsl(var(--info))",
          }}
        >
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{DEMO_NOTICE}</span>
        </div>

        <section aria-label="Сводка частной практики" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <MetricTile
            label="Пациенты практики"
            value={data.patientCount}
            hint="в учебном режиме врача"
            tone="info"
            Icon={Users}
          />
          <MetricTile
            label="Рабочая очередь"
            value={data.queue.length}
            hint="визиты, фото, отчёты, заявки"
            tone="warn"
            Icon={AlertTriangle}
          />
          <MetricTile
            label="Пакеты отчётов"
            value={data.reports.length}
            hint="сформированы врачом"
            tone="ok"
            Icon={FileText}
          />
          <MetricTile
            label="Оплата к сверке"
            value={data.paymentTodo}
            hint="учебные счета и акты"
            tone="muted"
            Icon={CreditCard}
          />
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <SectionCard title="Рабочий день" hint={`${data.todaySlots.length} записи`}>
            <ul className="space-y-2">
              {data.appointments.map((appointment) => (
                <AppointmentRow key={appointment.id} appointment={appointment} />
              ))}
            </ul>
          </SectionCard>

          <SectionCard title="Очередь частной практики" hint={`${data.queue.length} действий`}>
            {data.queue.length === 0 ? (
              <EmptyState text="Срочных операционных действий нет." />
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {data.queue.map((item) => (
                  <QueueCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <SectionCard title="Финансы и оплата" hint="учебный расчёт">
            <div className="space-y-2 text-[12px]">
              <FinanceRow
                label="Завершённые приёмы"
                value={money(data.revenueClosed)}
                hint={`${data.completed.length} визит`}
              />
              <FinanceRow
                label="Ближайшие записи"
                value={money(data.revenuePlanned)}
                hint={`${data.todaySlots.length} слот`}
              />
              <FinanceRow
                label="К оплате/акту"
                value={data.paymentTodo}
                hint="проверить после визита"
              />
            </div>
            <div className="mt-3">
              <ActionLink to="/admin/analytics" Icon={CreditCard}>
                Проверить оплату
              </ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Заявки на запись" hint={`${data.openLeads.length} в работе`}>
            <div className="grid grid-cols-2 gap-2">
              {(["new", "qualified", "booked", "lost"] as const).map((status) => (
                <SmallMetric
                  key={status}
                  label={LEAD_STATUS_LABEL[status]}
                  value={data.leads.filter((lead) => lead.status === status).length}
                />
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {data.leads.map((lead) => (
                <div key={lead.id} className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {lead.patientId ? patientLabel(lead.patientId) : "Новый контакт"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {formatDateTime(lead.createdAt)} · канал скрыт
                      </div>
                    </div>
                    <StatusPill tone={lead.status === "qualified" ? "ok" : "muted"}>
                      {LEAD_STATUS_LABEL[lead.status]}
                    </StatusPill>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Качество фото" hint={`${data.qualityIssues.length} замечания`}>
            {data.qualityIssues.length === 0 ? (
              <EmptyState text="Фото без технических замечаний." />
            ) : (
              <ul className="space-y-2">
                {data.qualityIssues.map((image) => {
                  const visit = data.visits.find((item) => item.id === image.visitId);
                  return (
                    <li
                      key={image.id}
                      className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {visit ? patientLabel(visit.patientId) : "Фото визита"}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {imageKindLabel(image)} · {qualityIssueText(image)}
                          </div>
                        </div>
                        <StatusPill tone={image.quality.score >= QUALITY_THRESHOLD ? "muted" : "warn"}>
                          {Math.round(image.quality.score * 100)}%
                        </StatusPill>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-3">
              <ActionLink to="/capture" Icon={Camera}>
                Перейти к съёмке
              </ActionLink>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
          <SectionCard title="Готовность кабинета" hint={deviceReady ? "устройство на связи" : "проверить вручную"}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <ReadinessItem
                title="Расписание"
                detail={`${data.todaySlots.length} активные записи, ${data.completed.length} завершены`}
                tone={data.todaySlots.length > 0 ? "ok" : "muted"}
                Icon={CalendarDays}
              />
              <ReadinessItem
                title="Дерматоскоп"
                detail={
                  data.devices[0]
                    ? `${data.devices[0].model} · ${formatDateTime(data.devices[0].lastSeenAt)}`
                    : "нет активного устройства"
                }
                tone={deviceReady ? "ok" : "warn"}
                Icon={Stethoscope}
              />
              <ReadinessItem
                title="Интеграции"
                detail="ручной режим кабинета включён"
                tone="warn"
                Icon={Plug}
              />
            </div>
          </SectionCard>

          <SectionCard title="Быстрые действия" hint="ключевые экраны">
            <div className="grid grid-cols-1 gap-2">
              <ActionLink to="/cockpit" Icon={Stethoscope}>
                Открыть рабочее место врача
              </ActionLink>
              <ActionLink to="/reports" Icon={FileText}>
                Открыть отчёты
              </ActionLink>
              <ActionLink to="/admin/services" Icon={Settings}>
                Настроить услуги
              </ActionLink>
            </div>
          </SectionCard>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="surface-card overflow-hidden">
      <header className="section-bar">
        <h2 className="h-section">{title}</h2>
        {hint && <span className="h-section-hint">{hint}</span>}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

function MetricTile({
  label,
  value,
  hint,
  tone,
  Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  tone: OpsTone;
  Icon: LucideIcon;
}) {
  return (
    <div className={`rounded-md border p-3 ${TONE[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide">{label}</div>
          <div className="mt-1 text-[22px] font-semibold leading-tight tabular-nums text-foreground">
            {value}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
        </div>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </div>
    </div>
  );
}

function AppointmentRow({ appointment }: { appointment: Appointment }) {
  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium">{patientLabel(appointment.patientId)}</div>
          <div className="text-[11px] text-muted-foreground">
            {formatDateTime(appointment.slotAt)} · канал: {CHANNEL_LABEL[appointment.channel]}
          </div>
        </div>
        <StatusPill tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
          {APPOINTMENT_STATUS_LABEL[appointment.status]}
        </StatusPill>
      </div>
    </li>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const Icon = item.Icon;
  return (
    <article className="rounded-md border border-border bg-surface p-3 text-[12px]">
      <div className="flex items-start gap-2">
        <span className={`rounded-md border p-1.5 ${TONE[item.tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{item.title}</div>
          <p className="mt-0.5 text-muted-foreground">{item.detail}</p>
          <div className="mt-1 text-[11px] text-muted-foreground">{item.meta}</div>
        </div>
      </div>
      <div className="mt-3">
        <ActionLink to={item.to} Icon={item.Icon}>
          {item.cta}
        </ActionLink>
      </div>
    </article>
  );
}

function FinanceRow({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <div className="text-[12px] font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="text-[13px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2">
      <div className="text-[16px] font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ReadinessItem({
  title,
  detail,
  tone,
  Icon,
}: {
  title: string;
  detail: string;
  tone: OpsTone;
  Icon: LucideIcon;
}) {
  const StatusIcon = tone === "ok" ? CheckCircle2 : AlertTriangle;
  return (
    <article className="rounded-md border border-border bg-surface p-3 text-[12px]">
      <div className="flex items-start gap-2">
        <span className={`rounded-md border p-1.5 ${TONE[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-semibold">
            <StatusIcon className="h-3.5 w-3.5" aria-hidden />
            {title}
          </div>
          <p className="mt-1 text-muted-foreground">{detail}</p>
        </div>
      </div>
    </article>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: OpsTone }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${TONE[tone]}`}>
      {children}
    </span>
  );
}

function ActionLink({
  to,
  children,
  Icon,
}: {
  to: string;
  children: React.ReactNode;
  Icon: LucideIcon;
}) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="min-h-[44px] w-full justify-start text-[12px] sm:min-h-[34px]"
    >
      <Link to={to}>
        <Icon className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {children}
      </Link>
    </Button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border bg-surface px-3 py-6 text-center text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}
