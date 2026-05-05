import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getAppointments,
  getClinics,
  getIntegrations,
  getLeads,
} from "@/lib/mock-data";
import { DEMO_USERS } from "@/lib/users";
import type {
  Appointment,
  Integration,
  IntegrationStatus,
  PartnerTier,
} from "@/lib/domain";

/**
 * Admin Home — операционная сводка клиники.
 *
 * SAFETY:
 *   - Только агрегаты и демо-операционные сущности (заявки, записи,
 *     клиники, интеграции, врачи). Пациент-уровневые поля (имена,
 *     контакты, диагнозы, фото, AI/XAI) не импортируются и не рендерятся.
 *   - Никаких сетевых вызовов, clipboard, storage, медиа.
 */

const DEMO_NOTICE =
  "MVP: данные демонстрационные. Реальные роли, RLS, аудит и синхронизация включаются на этапе бэкенда.";

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

const INTEGRATION_STATUS_LABEL: Record<IntegrationStatus, string> = {
  connected: "Подключено",
  draft: "Черновик",
  error: "Ошибка",
  disabled: "Отключено",
};

const INTEGRATION_KIND_LABEL: Record<Integration["kind"], string> = {
  crm: "CRM",
  erp: "ERP",
  mis: "МИС",
  messenger: "Мессенджер",
  telephony: "Телефония",
};

const STATUS_TONE: Record<IntegrationStatus, string> = {
  connected: "hsl(var(--success))",
  draft: "hsl(var(--info))",
  error: "hsl(var(--destructive))",
  disabled: "hsl(var(--muted-foreground))",
};

const APPOINTMENT_STATUS_LABEL: Record<Appointment["status"], string> = {
  planned: "Запланирован",
  confirmed: "Подтверждён",
  completed: "Завершён",
  cancelled: "Отменён",
  no_show: "Не пришёл",
};

const APPOINTMENT_STATUS_TONE: Record<Appointment["status"], string> = {
  planned: "hsl(var(--info))",
  confirmed: "hsl(var(--success))",
  completed: "hsl(var(--muted-foreground))",
  cancelled: "hsl(var(--destructive))",
  no_show: "hsl(var(--warning))",
};

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtSync(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function KpiCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Bar({ value, max }: { value: number; max: number }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full bg-primary" style={{ width: `${w}%` }} />
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
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-[13px] font-semibold">{title}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </Card>
  );
}

const QUICK_LINKS: { to: string; label: string; hint: string }[] = [
  { to: "/admin/doctors",      label: "Врачи",         hint: "состав, расписание, лицензии" },
  { to: "/admin/services",     label: "Услуги",        hint: "каталог, тарифы, длительности" },
  { to: "/admin/clinics",      label: "Клиники",       hint: "адреса, маршрутинг, готовность" },
  { to: "/admin/integrations", label: "Интеграции",    hint: "CRM, ERP, МИС, мессенджер" },
  { to: "/admin/bot",          label: "Настройки бота", hint: "сценарии, сообщения, безопасность" },
  { to: "/admin/analytics",    label: "Аналитика",      hint: "воронка, маршрутинг, качество" },
];

export default function AdminHomePage() {
  const leads = getLeads();
  const appointments = getAppointments();
  const clinics = getClinics();
  const integrations = getIntegrations();

  // Демо-врачи — из DEMO_USERS, без пациент-полей.
  const doctors = Object.values(DEMO_USERS).filter(
    (u) => u.role === "doctor" || u.role === "private_doctor",
  );

  // KPIs.
  const kpis = {
    leads: leads.length,
    bookings: appointments.length,
    visits: appointments.filter((a) => a.status === "completed").length,
    doctors: doctors.length,
    branches: clinics.length,
    integrations: integrations.filter((i) => i.status === "connected").length,
  };

  // Сегодня / ближайшие — берём planned/confirmed, сортируем по slotAt.
  const upcoming = appointments
    .filter((a) => a.status === "planned" || a.status === "confirmed")
    .slice()
    .sort((a, b) => a.slotAt.localeCompare(b.slotAt))
    .slice(0, 5);

  // Воронка за период (агрегированно, без фильтра по дате).
  const funnel = [
    { label: "Новые",            value: leads.filter((l) => l.status === "new").length },
    { label: "Квалифицированы",  value: leads.filter((l) => l.status === "qualified").length },
    { label: "Записаны",         value: leads.filter((l) => l.status === "booked").length },
    { label: "Завершено визитов", value: kpis.visits },
  ];
  const funnelMax = Math.max(1, ...funnel.map((f) => f.value));

  // Загрузка клиник: сколько записей привязано к каждой клинике.
  const clinicLoad = clinics.map((c) => ({
    id: c.id,
    name: c.name,
    tier: c.partnerTier,
    bookings: appointments.filter((a) => a.clinicId === c.id).length,
    leads: leads.filter((l) => l.clinicId === c.id).length,
  }));
  const loadMax = Math.max(1, ...clinicLoad.map((c) => c.bookings + c.leads));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Администрирование клиники"
        subtitle="Сводка по лидам, расписанию и интеграциям."
      />

      <div className="space-y-3 p-3 sm:p-4">
        {/* Демо-баннер */}
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

        {/* KPI */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          <KpiCard label="Лиды"        value={kpis.leads}         hint="за всё время" />
          <KpiCard label="Записи"      value={kpis.bookings}      hint="запланировано и завершено" />
          <KpiCard label="Визиты"      value={kpis.visits}        hint="завершённые приёмы" />
          <KpiCard label="Врачи"       value={kpis.doctors}       hint="демо-состав" />
          <KpiCard label="Филиалы"     value={kpis.branches}      hint="клиники в маршрутинге" />
          <KpiCard label="Интеграции"  value={kpis.integrations}  hint="активны сейчас" />
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {/* Сегодня / ближайшие */}
          <SectionCard title="Ближайшие приёмы" hint={`${upcoming.length} в очереди`}>
            {upcoming.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">Запланированных приёмов нет.</div>
            ) : (
              <ul className="space-y-2">
                {upcoming.map((a) => {
                  const c = clinics.find((cc) => cc.id === a.clinicId);
                  return (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-2.5 py-2 text-[12px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate font-medium">{c?.name ?? "Клиника"}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {fmtDateShort(a.slotAt)} · канал: {a.channel}
                        </div>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                        style={{
                          color: APPOINTMENT_STATUS_TONE[a.status],
                          background: `${APPOINTMENT_STATUS_TONE[a.status]} / 0.10`,
                          border: `1px solid ${APPOINTMENT_STATUS_TONE[a.status]}`,
                        }}
                      >
                        {APPOINTMENT_STATUS_LABEL[a.status]}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Воронка */}
          <SectionCard title="Воронка за период" hint="агрегаты">
            <div className="space-y-2">
              {funnel.map((row) => (
                <div key={row.label} className="space-y-1">
                  <div className="flex items-center justify-between text-[12px]">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">{row.value}</span>
                  </div>
                  <Bar value={row.value} max={funnelMax} />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Загрузка клиник */}
          <SectionCard title="Загрузка клиник" hint="лиды + записи">
            <div className="space-y-2">
              {clinicLoad.map((c) => {
                const total = c.bookings + c.leads;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="truncate">
                        {c.name}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          · {PARTNER_TIER_LABEL[c.tier]}
                        </span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {c.bookings}/{c.leads}
                      </span>
                    </div>
                    <Bar value={total} max={loadMax} />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Состояние интеграций */}
          <SectionCard title="Состояние интеграций" hint={`${integrations.length} всего`}>
            <ul className="space-y-1.5">
              {integrations.map((i) => (
                <li
                  key={i.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-2.5 py-2 text-[12px]"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">{i.provider}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {INTEGRATION_KIND_LABEL[i.kind]} · синхр.: {fmtSync(i.lastSyncAt)}
                    </div>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[10px]"
                    style={{
                      color: STATUS_TONE[i.status],
                      border: `1px solid ${STATUS_TONE[i.status]}`,
                    }}
                  >
                    {INTEGRATION_STATUS_LABEL[i.status]}
                  </span>
                </li>
              ))}
            </ul>
          </SectionCard>

          {/* Быстрые действия */}
          <SectionCard title="Быстрые действия">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {QUICK_LINKS.map((q) => (
                <Button
                  key={q.to}
                  asChild
                  variant="outline"
                  className="h-auto min-h-[44px] justify-start whitespace-normal py-2 text-left"
                >
                  <Link to={q.to}>
                    <div className="flex flex-col items-start">
                      <span className="text-[12px] font-medium">{q.label}</span>
                      <span className="text-[11px] text-muted-foreground">{q.hint}</span>
                    </div>
                  </Link>
                </Button>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
