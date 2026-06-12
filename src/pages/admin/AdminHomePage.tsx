import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  FileText,
  Plug,
  ShieldAlert,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getAppointments,
  getClinics,
  getDialogs,
  getIntegrations,
  getLeads,
} from "@/lib/mock-data";
import type {
  Appointment,
  AppointmentStatus,
  BotDialogState,
  Integration,
  IntegrationStatus,
  PartnerTier,
} from "@/lib/domain";

/**
 * Операционный центр клиники.
 *
 * Safety boundary:
 *   - Только агрегаты и учебные операционные сущности: расписание, заявки,
 *     филиалы, услуги, подключения, статусы бота.
 *   - Не импортируем и не рендерим пациентов, фото, диагнозы, подсказки системы,
 *     внешние идентификаторы пользователей мессенджеров или секретные значения.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "Учебный режим: показаны только агрегаты. Персональные данные, фото и медицинские выводы скрыты.";

const STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  error: "Ошибка",
  disabled: "Отключено",
};

const STATUS_TONE: Record<IntegrationStatus, string> = {
  connected: "text-success border-success/40 bg-success/10",
  draft: "text-muted-foreground border-border bg-muted/40",
  error: "text-destructive border-destructive/40 bg-destructive/10",
  disabled: "text-warning border-warning/40 bg-warning/10",
};

const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  planned: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Завершён",
  cancelled: "Отменён",
  no_show: "Не пришёл",
};

const APPOINTMENT_STATUS_TONE: Record<AppointmentStatus, string> = {
  planned: "text-info border-info/40 bg-info/10",
  confirmed: "text-success border-success/40 bg-success/10",
  completed: "text-muted-foreground border-border bg-muted/40",
  cancelled: "text-destructive border-destructive/40 bg-destructive/10",
  no_show: "text-warning border-warning/40 bg-warning/10",
};

const APPOINTMENT_CHANNEL_LABEL: Record<Appointment["channel"], string> = {
  bot: "бот",
  operator: "оператор",
  phone: "телефон",
  portal: "личный кабинет",
};

const INTEGRATION_KIND_LABEL: Record<Integration["kind"], string> = {
  crm: "Клиентская база",
  erp: "Учёт",
  mis: "Учётная система",
  messenger: "Мессенджер",
  telephony: "Телефония",
};

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

const integrationProviderLabel = (provider: string) => {
  if (provider === "Bitrix24") return "Битрикс24";
  if (provider === "amoCRM") return "Амо";
  if (provider === "1С: Медицина") return "1С: Медицина";
  if (provider === "Telegram Bot API") return "Телеграм";
  if (provider === "Demo MIS") return "Учебная система клиники";
  return provider;
};

const DIALOG_STATE_LABEL: Record<BotDialogState, string> = {
  new: "Новый",
  awaiting_photo: "Ждёт фото",
  awaiting_quality: "Ждёт качество",
  recommendation_sent: "Ответ отправлен",
  with_operator: "У оператора",
  booked: "Записан",
  closed: "Закрыт",
};

type OpsTone = "ok" | "warn" | "danger" | "info";

const OPS_TONE: Record<OpsTone, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  warn: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-info/40 bg-info/10 text-info",
};

interface ServiceOpsRow {
  code: string;
  name: string;
  status: "ready" | "needs_setup";
  slotMin: number;
  price: string;
  online: boolean;
  consent: string;
}

const SERVICE_OPS: ServiceOpsRow[] = [
  {
    code: "DRM-001",
    name: "Первичный приём",
    status: "ready",
    slotMin: 30,
    price: "2 500-3 500 ₽",
    online: true,
    consent: "ПДн",
  },
  {
    code: "DRM-010",
    name: "Дерматоскопия",
    status: "ready",
    slotMin: 15,
    price: "800-1 200 ₽",
    online: true,
    consent: "Медицинская съёмка",
  },
  {
    code: "DRM-011",
    name: "Цифровая карта кожи",
    status: "needs_setup",
    slotMin: 60,
    price: "4 500-6 000 ₽",
    online: false,
    consent: "Съёмка и хранение снимков",
  },
];

const CLINIC_READINESS: Record<string, { integration: "ok" | "warn"; bridge: "ok" | "warn" }> = {
  "clinic-demo-001": { integration: "ok", bridge: "ok" },
  "clinic-demo-002": { integration: "warn", bridge: "warn" },
  "clinic-private-007": { integration: "warn", bridge: "warn" },
};

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSync(iso: string | null): string {
  if (!iso) return "нет синхронизации";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "нет синхронизации";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function money(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
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
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </Card>
  );
}

function OpsMetric({
  label,
  value,
  hint,
  tone = "info",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: OpsTone;
}) {
  return (
    <div className={`rounded-md border p-3 ${OPS_TONE[tone]}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-tight tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function StatusPill({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] ${tone}`}>
      {children}
    </span>
  );
}

function ActionLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Button
      asChild
      size="sm"
      variant="outline"
      className="min-h-[44px] justify-start sm:min-h-[32px]"
    >
      <Link to={to}>{children}</Link>
    </Button>
  );
}

function countBy<T extends string>(items: T[]): Record<T, number> {
  return items.reduce(
    (acc, item) => ({ ...acc, [item]: (acc[item] ?? 0) + 1 }),
    {} as Record<T, number>,
  );
}

export default function AdminHomePage() {
  const appointments = getAppointments();
  const clinics = getClinics();
  const dialogs = getDialogs();
  const integrations = getIntegrations();
  const leads = getLeads();

  const upcoming = appointments
    .filter((item) => item.status === "planned" || item.status === "confirmed")
    .slice()
    .sort((a, b) => a.slotAt.localeCompare(b.slotAt));
  const finished = appointments.filter((item) => item.status === "completed");
  const integrationsNeedAction = integrations.filter((item) =>
    item.status === "draft" || item.status === "disabled" || item.status === "error"
  );
  const botNeedsAction = dialogs.filter((item) =>
    item.state === "awaiting_photo" || item.state === "awaiting_quality" || item.state === "with_operator"
  );
  const lostLeads = leads.filter((lead) => lead.status === "lost");
  const leadStates = countBy(leads.map((lead) => lead.status));
  const dialogStates = countBy(dialogs.map((dialog) => dialog.state));
  const completedRevenue = finished.length * 3200;
  const plannedPotential = upcoming.length * 2800;
  const lostOpportunity = lostLeads.length * 2500;

  const actionQueue = [
    {
      title: "Связь с учётной системой выключена",
      detail: "Записи и отчёты не обновляются в учётной системе клиники.",
      meta: "Система клиники · подключение",
      to: "/admin/integrations",
      cta: "Проверить подключение",
      tone: "danger" as OpsTone,
      Icon: Plug,
    },
    {
      title: "Бот ждёт фото лучшего качества",
      detail: `${dialogStates.awaiting_quality ?? 0} диалог требует повторного фото перед записью или передачей оператору.`,
      meta: "Контроль качества фото",
      to: "/admin/bot",
      cta: "Настроить бот",
      tone: "warn" as OpsTone,
      Icon: Bot,
    },
    {
      title: "Цифровая карта кожи не в онлайн-записи",
      detail: "Услуга есть в каталоге, но онлайн-запись отключена: нужен слот 60 мин и согласие на съёмку.",
      meta: "Каталог услуг",
      to: "/admin/services",
      cta: "Проверить услуги",
      tone: "warn" as OpsTone,
      Icon: FileText,
    },
    {
      title: "Северный филиал готов частично",
      detail: "Перед маршрутизацией заявок нужно проверить подключение и локальную связь с кабинетом.",
      meta: "Клиники и филиалы",
      to: "/admin/clinics",
      cta: "Проверить филиалы",
      tone: "info" as OpsTone,
      Icon: Building2,
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Операционный центр клиники"
        subtitle="Расписание, очереди, подключения, бот, услуги и финансовая готовность."
      />

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
          <span>{DEMO_NOTICE}</span>
        </div>

        <section aria-label="Операционный статус" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <OpsMetric
            label="Ближайшие записи"
            value={upcoming.length}
            hint="плановые и подтверждённые"
            tone="info"
          />
          <OpsMetric
            label="Требуют действия"
            value={actionQueue.length}
            hint="очередь администратора"
            tone="warn"
          />
          <OpsMetric
            label="Подключения с риском"
            value={integrationsNeedAction.length}
            hint="черновик или отключено"
            tone="danger"
          />
          <OpsMetric
            label="Потенциал записи"
            value={money(plannedPotential)}
            hint="учебная оценка по слотам"
            tone="ok"
          />
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <SectionCard title="Очередь решений администратора" hint={`${actionQueue.length} действия`}>
            <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-1">
              {actionQueue.map(({ title, detail, meta, to, cta, tone, Icon }) => (
                <article
                  key={title}
                  className="rounded-md border border-border bg-surface p-3 text-[12px]"
                >
                  <div className="flex items-start gap-2">
                    <span className={`rounded-md border p-1.5 ${OPS_TONE[tone]}`}>
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{title}</div>
                      <p className="mt-0.5 text-muted-foreground">{detail}</p>
                      <div className="mt-1 text-[11px] text-muted-foreground">{meta}</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <ActionLink to={to}>{cta}</ActionLink>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Операционный день" hint={`${upcoming.length} ближайшие`}>
            <ul className="space-y-2">
              {upcoming.map((appointment) => {
                const clinic = clinics.find((item) => item.id === appointment.clinicId);
                return (
                  <li
                    key={appointment.id}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium">{fmtDateShort(appointment.slotAt)}</div>
                        <div className="truncate text-muted-foreground">
                          {clinic?.name ?? "Клиника"} · канал: {APPOINTMENT_CHANNEL_LABEL[appointment.channel]}
                        </div>
                      </div>
                      <StatusPill tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
                        {APPOINTMENT_STATUS_LABEL[appointment.status]}
                      </StatusPill>
                    </div>
                  </li>
                );
              })}
            </ul>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
          <SectionCard title="Готовность подключений" hint={`${integrations.length} систем`}>
            <ul className="space-y-2">
              {integrations.map((integration) => (
                <IntegrationRow key={integration.id} integration={integration} />
              ))}
            </ul>
            <div className="mt-3">
              <ActionLink to="/admin/integrations">Проверить подключения</ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Бот и заявки" hint={`${botNeedsAction.length} требуют внимания`}>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Состояния диалогов
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(DIALOG_STATE_LABEL).map(([key, label]) => (
                    <div key={key} className="rounded-sm border border-border bg-surface px-2 py-1.5">
                      <div className="font-medium tabular-nums">{dialogStates[key as BotDialogState] ?? 0}</div>
                      <div className="text-[11px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Воронка заявок
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <SmallMetric label="Новые" value={leadStates.new ?? 0} />
                  <SmallMetric label="Квалифицированы" value={leadStates.qualified ?? 0} />
                  <SmallMetric label="Записаны" value={leadStates.booked ?? 0} />
                  <SmallMetric label="Потеряны" value={leadStates.lost ?? 0} />
                </div>
              </div>
              <ActionLink to="/admin/bot">Настроить бот</ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Финансовый контур" hint="учебная оценка">
            <div className="space-y-2 text-[12px]">
              <FinanceRow label="Завершённые визиты" value={money(completedRevenue)} hint={`${finished.length} визита`} />
              <FinanceRow label="Ближайшие записи" value={money(plannedPotential)} hint={`${upcoming.length} слота`} />
              <FinanceRow label="Потерянные заявки" value={money(lostOpportunity)} hint={`${lostLeads.length} заявка`} />
            </div>
            <div className="mt-3">
              <ActionLink to="/admin/analytics">Открыть аналитику</ActionLink>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.1fr_0.9fr]">
          <SectionCard title="Услуги и филиалы" hint="готовность к записи">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                {SERVICE_OPS.map((service) => (
                  <div
                    key={service.code}
                    className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{service.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          служебный код скрыт · {service.slotMin} мин · {service.price}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          согласие: {service.consent}
                        </div>
                      </div>
                      <StatusPill tone={service.status === "ready" ? OPS_TONE.ok : OPS_TONE.warn}>
                        {service.online ? "онлайн" : "настройка"}
                      </StatusPill>
                    </div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {clinics.map((clinic) => {
                  const readiness = CLINIC_READINESS[clinic.id] ?? { integration: "warn", bridge: "warn" };
                  const leadsCount = leads.filter((lead) => lead.clinicId === clinic.id).length;
                  const bookings = appointments.filter((appointment) => appointment.clinicId === clinic.id).length;
                  return (
                    <div
                      key={clinic.id}
                      className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{clinic.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {PARTNER_TIER_LABEL[clinic.partnerTier]} · заявки {leadsCount} · записи {bookings}
                          </div>
                        </div>
                        <StatusPill tone={readiness.integration === "ok" && readiness.bridge === "ok" ? OPS_TONE.ok : OPS_TONE.warn}>
                          {readiness.integration === "ok" && readiness.bridge === "ok" ? "готово" : "частично"}
                        </StatusPill>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionLink to="/admin/services">Проверить услуги</ActionLink>
              <ActionLink to="/admin/clinics">Проверить филиалы</ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Быстрый переход" hint="админ-разделы">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <QuickLink to="/admin/doctors" label="Врачи" hint="состав и лицензии" Icon={Stethoscope} />
              <QuickLink to="/admin/services" label="Услуги" hint="цены и длительность" Icon={FileText} />
              <QuickLink to="/admin/clinics" label="Клиники" hint="маршрутизация заявок" Icon={Building2} />
              <QuickLink to="/admin/integrations" label="Интеграции" hint="клиентская база, учёт, бот" Icon={Plug} />
              <QuickLink to="/admin/bot" label="Бот" hint="шаблоны и эскалация" Icon={Bot} />
              <QuickLink to="/admin/analytics" label="Аналитика" hint="воронка и качество" Icon={BarChart3} />
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function IntegrationRow({ integration }: { integration: Integration }) {
  const Icon = integration.status === "connected" ? CheckCircle2 : AlertTriangle;
  return (
    <li className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate font-medium">{integrationProviderLabel(integration.provider)}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {INTEGRATION_KIND_LABEL[integration.kind]} · синхр.: {fmtSync(integration.lastSyncAt)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            передача: безопасное резюме + защищённая ссылка
          </div>
        </div>
        <StatusPill tone={STATUS_TONE[integration.status]}>
          {STATUS_LABEL[integration.status]}
        </StatusPill>
      </div>
    </li>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-2 py-1.5">
      <div className="font-medium tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function FinanceRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
      <div className="shrink-0 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function QuickLink({
  to,
  label,
  hint,
  Icon,
}: {
  to: string;
  label: string;
  hint: string;
  Icon: LucideIcon;
}) {
  return (
    <Button
      asChild
      variant="outline"
      className="h-auto min-h-[44px] justify-start whitespace-normal py-2 text-left"
    >
      <Link to={to}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-col items-start">
          <span className="text-[12px] font-medium">{label}</span>
          <span className="text-[11px] text-muted-foreground">{hint}</span>
        </span>
      </Link>
    </Button>
  );
}
