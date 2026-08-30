import { useEffect, useMemo, useRef, useState } from "react";
import { Inbox, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLeads,
  getAppointments,
  getDialogs,
  getAnalysisCards,
  getClinics,
} from "@/lib/mock-data";
import type {
  BotDialogState,
  LeadStatus,
  PartnerTier,
  RiskLevel,
} from "@/lib/domain";
import { resolveEmptyCopy, type EmptyStateKey } from "./analytics-empty-copy";
import { isProductionAppMode } from "@/lib/app-mode";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  getAdminAnalytics,
  type AdminAnalyticsDTO,
  type AdminAnalyticsPeriod,
} from "@/lib/self-hosted-admin-api";

/**
 * Аналитика клиники: агрегаты по воронке лидов, источникам,
 * маршрутизации, риску, качеству фото и состояниям бот-диалогов.
 *
 * SAFETY:
 *   - Только агрегаты (counts/percentages). Никаких пациент-уровневых
 *     полей: имена, контакты, фото, диагнозы, ссылки, детали подсказок,
 *     внешние идентификаторы пользователей мессенджера и т.п. — не
 *     импортируются и не рендерятся.
 *   - Никаких сетевых вызовов, clipboard, storage. Только локальное
 *     состояние внутри компонента.
 */

// ───────── Range filter ─────────

type RangeKey = "all" | "march_2026" | "last_90d";
const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "Все данные" },
  { key: "march_2026", label: "Март 2026" },
  { key: "last_90d", label: "Последние 90 дней" },
];
const RANGE_META: Record<RangeKey, { label: string; windowLabel: string }> = {
  all: { label: "Все данные", windowLabel: "полный учебный набор" },
  march_2026: { label: "Март 2026", windowLabel: "01.03-31.03.2026" },
  last_90d: { label: "Последние 90 дней", windowLabel: "03.02-04.05.2026" },
};

/**
 * Фиксированный «сейчас» для детерминированных учебных данных.
 * Учебный набор без реального clock — не импортируем Date.now во избежание дрейфа
 * в тестах/снимках.
 */
const NOW_ISO = "2026-05-04T00:00:00Z";

function inRange(iso: string, range: RangeKey): boolean {
  if (range === "all") return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  if (range === "march_2026") {
    const start = Date.parse("2026-03-01T00:00:00Z");
    const end = Date.parse("2026-04-01T00:00:00Z");
    return t >= start && t < end;
  }
  // last_90d
  const now = Date.parse(NOW_ISO);
  const start = now - 90 * 24 * 60 * 60 * 1000;
  return t >= start && t <= now;
}

// ───────── Labels ─────────

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Низкий",
  moderate: "Умеренный",
  high: "Высокий",
  urgent: "Срочный",
};

const RISK_TONE: Record<RiskLevel, string> = {
  low: "hsl(var(--success))",
  moderate: "hsl(var(--info))",
  high: "hsl(var(--warning))",
  urgent: "hsl(var(--destructive))",
};

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Новый",
  qualified: "Квалифицирован",
  booked: "Записан",
  lost: "Потерян",
  duplicate: "Дубль",
};

const SOURCE_LABEL: Record<string, string> = {
  telegram: "Telegram",
  whatsapp: "WhatsApp",
  web: "Сайт",
  site: "Сайт",
  operator: "Оператор",
};

const DIALOG_STATE_LABEL: Record<BotDialogState, string> = {
  new: "Новый",
  awaiting_photo: "Ожидает фото",
  awaiting_quality: "Ожидает качества",
  recommendation_sent: "Рекомендация отправлена",
  with_operator: "У оператора",
  booked: "Записан",
  closed: "Закрыт",
};

const PARTNER_TIER_LABEL: Record<PartnerTier, string> = {
  owned: "Своя",
  partner: "Партнёр",
  external: "Внешняя",
};

// ───────── Helpers ─────────

function pct(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function fmtPct(n: number): string {
  return `${n}%`;
}

// ───────── Subcomponents ─────────

function KpiCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Card className="p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold leading-tight tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function Bar({ value, max, tone = "hsl(var(--primary))" }: { value: number; max: number; tone?: string }) {
  const w = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${w}%`, background: tone }}
        aria-hidden
      />
    </div>
  );
}

function SectionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
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

/**
 * Заголовок семантической зоны страницы (H2) + обёртка секции.
 * Используется для группировки существующих карточек в 4 зоны:
 * «Главное за период», «Запись и обращения», «Качество и маршрутизация»,
 * «Финансовая оценка».
 */
function ZoneSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h2 id={id} className="text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Раскрывающийся блок для деталей секции (таблицы, методика, лиды,
 * состояния бот-диалогов, финансовые пояснения). Содержимое остаётся
 * смонтированным в DOM всегда — скрытие делается классом Tailwind
 * "hidden", а не условным рендерингом, чтобы существующие unit-тесты
 * продолжали находить содержимое секций через getByRole/getByText.
 */
function Disclosure({
  id,
  label,
  defaultOpen = false,
  children,
}: {
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-[12px] font-medium text-foreground hover:bg-muted"
      >
        {open ? "Свернуть" : "Показать"}: {label}
      </button>
      <div id={id} className={open ? "mt-3" : "hidden"}>
        {children}
      </div>
    </div>
  );
}

/**
 * Унифицированное пустое состояние для всех секций аналитики.
 * Одинаковая высота, иконка, основной заголовок и подсказка
 * с указанием выбранного периода — чтобы все секции выглядели
 * визуально согласованно при отсутствии данных.
 */
function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-empty="true"
      className="flex min-h-[120px] flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface px-4 py-6 text-center"
    >
      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
      <div className="text-[12px] font-medium text-foreground">{title}</div>
      {hint && (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/**
 * Унифицированный skeleton-загрузчик для секций аналитики.
 * Показывается, пока данные «грузятся», и визуально отличается
 * от пустого состояния (анимация + плейсхолдеры строк), чтобы
 * пользователь не путал «грузим» с «нет данных».
 */
function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      data-loading="true"
      aria-label="Загрузка данных секции"
      className="flex min-h-[120px] flex-col gap-3"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton для KPI-плитки. Сохраняет ту же высоту, что и реальный KpiCard.
 */
function KpiSkeleton() {
  return (
    <Card className="p-3" aria-busy="true" data-loading="true">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-2 h-5 w-12" />
      <Skeleton className="mt-1 h-2.5 w-20" />
    </Card>
  );
}


/**
 * Длительность имитации загрузки секций (мс). Намеренно короткая —
 * нужна, чтобы отделить визуально «грузим» от «пусто» на учебных данных.
 * В тестах перекрывается через `window.__ANALYTICS_LOADING_MS__`.
 */
const DEFAULT_LOADING_MS = 250;
const FINANCE_ASSUMPTIONS = {
  completedVisitRub: 3200,
  plannedVisitRub: 2800,
  lostLeadRub: 1800,
} as const;
const FINANCE_VALIDATION_STEPS = [
  {
    key: "clinic_interview",
    label: "Интервью с клиникой",
    statusLabel: "Нужно подтвердить",
    detail: "Какая ценность нужна: приведённые пациенты, повторные визиты, стоимость сервиса.",
  },
  {
    key: "service_prices",
    label: "Стоимость услуги",
    statusLabel: "Не подключено",
    detail: "Сверить цены услуг из МИС или справочника перед реальным расчётом.",
  },
  {
    key: "service_cost",
    label: "Стоимость сервиса",
    statusLabel: "Не подключено",
    detail: "Зафиксировать модель оплаты SkinDoctor для врача или клиники.",
  },
  {
    key: "booking_payment_match",
    label: "Сверка с записью/оплатой",
    statusLabel: "Нужно сверить",
    detail: "Проверить атрибуцию лида к записи и оплате без пациентских строк.",
  },
  {
    key: "approval",
    label: "Утверждение методики",
    statusLabel: "Блокер запуска",
    detail: "Утвердить методику до реальных финансовых заявлений в интерфейсе.",
  },
] as const;

function money(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "admin.clinic.create": "Создана клиника",
  "admin.clinic.update": "Обновлена клиника",
  "admin.user.create": "Создан пользователь",
  "admin.user.role.assign": "Назначена роль",
  "admin.user.disable": "Отключён доступ",
  "admin.users.list": "Просмотрены пользователи",
  "admin.doctors.list": "Просмотрены врачи",
  "admin.analytics.read": "Открыта аналитика",
};

function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABEL[action] ?? "Служебное действие";
}

function AdminAnalyticsPageLive() {
  const session = useSelfHostedApiSession();
  const requestSequence = useRef(0);
  const [period, setPeriod] = useState<AdminAnalyticsPeriod>(() => {
    const parts = new Intl.DateTimeFormat("en", { timeZone: "Europe/Moscow", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
    const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
    const dateTo = `${part("year")}-${part("month")}-${part("day")}`;
    return { dateFrom: `${dateTo.slice(0, 7)}-01`, dateTo, timeZone: "Europe/Moscow" };
  });
  const [analytics, setAnalytics] = useState<AdminAnalyticsDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setNote(null);
    setAnalytics(null);
    const result = await getAdminAnalytics({
      apiBaseUrl: session.apiBaseUrl,
      apiToken: session.apiToken,
      period,
    });
    if (sequence !== requestSequence.current) return;
    setLoading(false);
    if (!result.ok) {
      setNote(adminApiErrorText(result.error));
      return;
    }
    setAnalytics(result.value);
  }

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  const data = analytics ?? {
    clinics: 0,
    activeUsers: 0,
    doctors: 0,
    patients: 0,
    visits: 0,
    photos: 0,
    signedReports: 0,
    auditEvents7d: 0,
    recentAuditEvents: [],
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Аналитика"
        subtitle="Количество рабочих записей за выбранные даты."
      />
      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Данные по доступным вам клиникам. Карточки пациентов, изображения и медицинские сведения здесь не показываются.
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="space-y-3 rounded-md border border-border bg-surface p-3">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Период</legend>
            <p id="analytics-period-help" className="text-xs text-muted-foreground">Даты по московскому времени. Обе даты включены.</p>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <label className="min-w-0 space-y-1 text-sm">С
                <Input type="date" required value={period.dateFrom} aria-describedby="analytics-period-help" className="min-h-11 min-w-0" onChange={(event) => setPeriod({ ...period, dateFrom: event.target.value })} />
              </label>
              <label className="min-w-0 space-y-1 text-sm">По
                <Input type="date" required min={period.dateFrom} value={period.dateTo} aria-describedby="analytics-period-help" className="min-h-11 min-w-0" onChange={(event) => setPeriod({ ...period, dateTo: event.target.value })} />
              </label>
              <Button type="submit" disabled={!period.dateFrom || !period.dateTo || period.dateFrom > period.dateTo} className="col-span-2 min-h-11 sm:col-span-1">Показать за период</Button>
            </div>
            {period.dateFrom > period.dateTo && <p role="alert" className="text-sm text-destructive">Дата окончания должна быть не раньше даты начала.</p>}
          </fieldset>
        </form>

        {note && (
          <div role="alert" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
            {note}
          </div>
        )}

        <section aria-labelledby="analytics-period-results" aria-busy={loading} className="space-y-2">
          <h2 id="analytics-period-results" className="text-base font-semibold">За выбранный период</h2>
          {loading && <p role="status" className="text-sm text-muted-foreground">Загружаем показатели…</p>}
          {analytics?.period && <>
            <p className="text-sm text-muted-foreground">{analytics.period.dateFrom.split("-").reverse().join(".")} — {analytics.period.dateTo.split("-").reverse().join(".")} · Москва</p>
            {(period.dateFrom !== analytics.period.dateFrom || period.dateTo !== analytics.period.dateTo) && <p role="status" className="text-sm">Даты изменены. Нажмите «Показать за период», чтобы обновить показатели.</p>}
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <KpiCard label="Добавлено карточек пациентов" value={analytics.period.patientsCreated} hint="без удалённых карточек" />
              <KpiCard label="Создано записей визитов" value={analytics.period.visitsCreated} hint="не число завершённых приёмов" />
              <KpiCard label="Добавлено снимков" value={analytics.period.photosAdded} hint="без вложений отчётов" />
              <KpiCard label="Подписано отчётов" value={analytics.period.reportsSigned} hint="по дате подписи" />
            </div>
            {Object.values({ p: analytics.period.patientsCreated, v: analytics.period.visitsCreated, a: analytics.period.photosAdded, r: analytics.period.reportsSigned }).every((count) => count === 0) && <p className="text-sm text-muted-foreground">За этот период записей нет. Выберите другие даты, чтобы посмотреть показатели.</p>}
          </>}
        </section>

        {analytics && <details className="space-y-3 rounded-md border border-border bg-surface p-3">
          <summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Общие показатели и последние события</summary>
          <p className="text-xs text-muted-foreground">Текущие количества без фильтра периода. События аудита показаны отдельно.</p>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <KpiCard label="Клиники" value={loading ? "…" : data.clinics} hint="зарегистрированы" />
          <KpiCard label="Сотрудники" value={loading ? "…" : data.activeUsers} hint="активный доступ" />
          <KpiCard label="Врачи" value={loading ? "…" : data.doctors} hint="дерматологи и частные врачи" />
          <KpiCard label="Аудит за 7 дней" value={loading ? "…" : data.auditEvents7d} hint="события системы" />
          <KpiCard label="Пациенты" value={loading ? "…" : data.patients} hint="агрегат без строк" />
          <KpiCard label="Визиты" value={loading ? "…" : data.visits} hint="рабочие записи" />
          <KpiCard label="Файлы" value={loading ? "…" : data.photos} hint="снимки и вложения отчётов" />
          <KpiCard label="Подписанные отчёты" value={loading ? "…" : data.signedReports} hint="итоговые документы" />
        </div>

        <SectionCard title="Последние события аудита" hint="без секретов и пациентских строк">
          {data.recentAuditEvents.length === 0 ? (
            <EmptyState title="Событий пока нет" hint="После действий администратора здесь появятся записи аудита." />
          ) : (
            <div className="grid gap-2">
              {data.recentAuditEvents.map((event) => (
                <div key={event.id} className="rounded-md border border-border bg-surface p-3 text-[12px]">
                  <div className="font-medium">{auditActionLabel(event.action)}</div>
                  <div className="mt-1 text-muted-foreground">
                    {event.actorName ?? "Система"} · {event.clinicName ?? "без клиники"} ·{" "}
                    {event.createdAt ? new Date(event.createdAt).toLocaleString("ru-RU") : "время не указано"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        </details>}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  if (isProductionAppMode()) return <AdminAnalyticsPageLive />;
  return <AdminAnalyticsPageDemo />;
}

function AdminAnalyticsPageDemo() {
  const [range, setRange] = useState<RangeKey>("all");
  const [clinicSort, setClinicSort] = useState<"priority" | "conversion">(
    "priority",
  );
  const [reportPreview, setReportPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Имитация загрузки: при монтировании и при смене периода.
  useEffect(() => {
    const w = typeof window !== "undefined" ? (window as unknown as { __ANALYTICS_LOADING_MS__?: number }) : undefined;
    const ms = w?.__ANALYTICS_LOADING_MS__ ?? DEFAULT_LOADING_MS;
    if (ms <= 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const t = window.setTimeout(() => setIsLoading(false), ms);
    return () => window.clearTimeout(t);
  }, [range]);

  const rangeLabel =
    RANGES.find((r) => r.key === range)?.label ?? "выбранный период";

  /**
   * Хелпер для рендера empty-state через единый словарь.
   * Для секций, зависящих от выбранного периода, добавляем CTA-кнопку
   * «Показать все данные» (или подсказку выбрать другой диапазон), чтобы
   * пользователь мог быстро выйти из «пустого» среза без поиска
   * переключателя периода вверху страницы. Для секции «клиники» CTA не
   * показываем — справочник клиник не зависит от периода.
   */
  const renderEmpty = (key: EmptyStateKey) => {
    const c = resolveEmptyCopy(key, rangeLabel);
    const rangeDependent = key !== "clinics";
    let action: React.ReactNode = null;
    if (rangeDependent) {
      if (range !== "all") {
        action = (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRange("all")}
            data-empty-action="reset-range"
            aria-label={`Показать все данные вместо периода «${rangeLabel}»`}
          >
            Показать все данные
          </Button>
        );
      } else {
        // Уже выбран диапазон «Все данные» — предлагаем переключиться
        // на конкретный период, если данные появятся позже.
        action = (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRange("last_90d")}
            data-empty-action="try-90d"
            aria-label="Попробовать период «Последние 90 дней»"
          >
            Попробовать «Последние 90 дней»
          </Button>
        );
      }
    }
    return <EmptyState title={c.title} hint={c.hint} action={action} />;
  };



  const all = useMemo(() => {
    const leads = getLeads();
    const appointments = getAppointments();
    const dialogs = getDialogs();
    const cards = getAnalysisCards();
    const clinics = getClinics();
    return { leads, appointments, dialogs, cards, clinics };
  }, []);

  const data = useMemo(() => {
    const leads = all.leads.filter((l) => inRange(l.createdAt, range));
    const appointments = all.appointments.filter((a) => inRange(a.slotAt, range));
    const dialogs = all.dialogs.filter((d) => inRange(d.lastMessageAt, range));
    const cards = all.cards.filter((c) => inRange(c.createdAt, range));
    return { ...all, leads, appointments, dialogs, cards };
  }, [all, range]);

  // Funnel
  const totalLeads = data.leads.length;
  const qualifiedLeads = data.leads.filter((l) => l.status === "qualified" || l.status === "booked").length;
  const bookedLeads = data.leads.filter((l) => l.status === "booked").length;
  const visits = data.appointments.filter((a) => a.status === "completed").length;

  const conversionLeadToBooking = pct(bookedLeads, totalLeads);
  const highOrUrgent = data.cards.filter((c) => c.routingRisk === "high" || c.routingRisk === "urgent").length;

  // Funnel rows
  const funnelMax = Math.max(totalLeads, qualifiedLeads, bookedLeads, visits, 1);
  const funnel = [
    { key: "lead", label: "Лиды", value: totalLeads },
    { key: "qualified", label: "Квалифицированы", value: qualifiedLeads },
    { key: "booked", label: "Записаны", value: bookedLeads },
    { key: "visit", label: "Визиты", value: visits },
  ];

  // Sources
  const bySource = useMemo(() => {
    const map = new Map<string, { source: string; count: number; booked: number }>();
    for (const l of data.leads) {
      const key = l.source;
      const cur = map.get(key) ?? { source: key, count: 0, booked: 0 };
      cur.count += 1;
      if (l.status === "booked") cur.booked += 1;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [data.leads]);

  // Clinics routing (агрегаты, без персональных данных)
  const byClinic = useMemo(() => {
    const rows = data.clinics.map((c) => {
      const leadsForClinic = data.leads.filter((l) => l.clinicId === c.id);
      const bookedForClinic = leadsForClinic.filter(
        (l) => l.status === "booked",
      ).length;
      return {
        id: c.id,
        name: c.name,
        partnerTier: c.partnerTier,
        routingPriority: c.routingPriority,
        leads: leadsForClinic.length,
        booked: bookedForClinic,
        conv: pct(bookedForClinic, leadsForClinic.length),
      };
    });
    if (clinicSort === "conversion") {
      // По убыванию конверсии; tie-break: больше лидов → выше приоритет (меньше число).
      rows.sort(
        (a, b) =>
          b.conv - a.conv ||
          b.leads - a.leads ||
          a.routingPriority - b.routingPriority,
      );
    } else {
      // По возрастанию routingPriority (1 — самый высокий приоритет).
      rows.sort(
        (a, b) =>
          a.routingPriority - b.routingPriority || b.conv - a.conv,
      );
    }
    return rows;
  }, [data.clinics, data.leads, clinicSort]);

  // Risk distribution
  const riskDist = useMemo(() => {
    const order: RiskLevel[] = ["low", "moderate", "high", "urgent"];
    return order.map((r) => ({
      key: r,
      label: RISK_LABEL[r],
      count: data.cards.filter((c) => c.routingRisk === r).length,
    }));
  }, [data.cards]);

  // Image quality
  const totalCards = data.cards.length;
  const passed = data.cards.filter((c) => c.qualityGate.passed).length;
  const needsRepeat = totalCards - passed;
  const avgScore =
    totalCards > 0
      ? Math.round(
          (data.cards.reduce((acc, c) => acc + c.qualityGate.score, 0) / totalCards) * 100,
        )
      : 0;
  const repeatCta = data.cards.filter((c) => c.ctaType === "repeat_photo").length;
  const withOperator = data.dialogs.filter((d) => d.state === "with_operator").length;

  // Bot dialog state aggregates
  const dialogStates = useMemo(() => {
    const order: BotDialogState[] = [
      "new",
      "awaiting_photo",
      "awaiting_quality",
      "recommendation_sent",
      "with_operator",
      "booked",
      "closed",
    ];
    return order.map((s) => ({
      key: s,
      label: DIALOG_STATE_LABEL[s],
      count: data.dialogs.filter((d) => d.state === s).length,
    }));
  }, [data.dialogs]);

  const completedAppointments = data.appointments.filter((a) => a.status === "completed");
  const plannedAppointments = data.appointments.filter(
    (a) => a.status === "planned" || a.status === "confirmed",
  );
  const lostLeads = data.leads.filter((l) => l.status === "lost");
  const botAttributedAppointments = data.appointments.filter((a) => Boolean(a.leadId));
  const completedVisitValueRub =
    completedAppointments.length * FINANCE_ASSUMPTIONS.completedVisitRub;
  const bookedPotentialRub =
    plannedAppointments.length * FINANCE_ASSUMPTIONS.plannedVisitRub;
  const lostPotentialRub = lostLeads.length * FINANCE_ASSUMPTIONS.lostLeadRub;
  const botAttributedValueRub = botAttributedAppointments.reduce((sum, appointment) => {
    if (appointment.status === "completed") return sum + FINANCE_ASSUMPTIONS.completedVisitRub;
    if (appointment.status === "planned" || appointment.status === "confirmed") {
      return sum + FINANCE_ASSUMPTIONS.plannedVisitRub;
    }
    return sum;
  }, 0);

  const clinicValue = useMemo(() => {
    return data.clinics
      .map((clinic) => {
        const appointments = data.appointments.filter((a) => a.clinicId === clinic.id);
        const completed = appointments.filter((a) => a.status === "completed").length;
        const planned = appointments.filter(
          (a) => a.status === "planned" || a.status === "confirmed",
        ).length;
        const estimatedRub =
          completed * FINANCE_ASSUMPTIONS.completedVisitRub +
          planned * FINANCE_ASSUMPTIONS.plannedVisitRub;
        return {
          id: clinic.id,
          name: clinic.name,
          partnerTier: clinic.partnerTier,
          completed,
          planned,
          estimatedRub,
        };
      })
      .sort((a, b) => b.estimatedRub - a.estimatedRub || b.completed - a.completed);
  }, [data.appointments, data.clinics]);

  const periodSlice = {
    label: RANGE_META[range].label,
    windowLabel: RANGE_META[range].windowLabel,
    scope: "aggregate_only",
    leads: totalLeads,
    appointments: data.appointments.length,
    analysisCards: totalCards,
    dialogs: data.dialogs.length,
  };

  const operationalBottlenecks = [
    {
      key: "repeat_photo",
      label: "Повтор фото",
      count: needsRepeat,
      share: pct(needsRepeat, totalCards),
      basis: "от карточек",
    },
    {
      key: "operator_handoff",
      label: "Передача оператору",
      count: withOperator,
      share: pct(withOperator, data.dialogs.length),
      basis: "от диалогов",
    },
    {
      key: "lost_leads",
      label: "Потерянные лиды",
      count: lostLeads.length,
      share: pct(lostLeads.length, totalLeads),
      basis: "от лидов",
    },
    {
      key: "high_urgent",
      label: "Высокий/срочный маршрут",
      count: highOrUrgent,
      share: pct(highOrUrgent, totalCards),
      basis: "от карточек",
    },
  ];
  const financeMethodologyValidation = {
    methodologyStatus: "needs_clinic_validation",
    brainstormTask: "SD-MF-048",
    scope: "aggregate_only",
    blockedUntil: "clinic_methodology_approved",
    steps: FINANCE_VALIDATION_STEPS.map((step) => ({
      key: step.key,
      label: step.label,
      status: step.statusLabel,
    })),
  };

  const onGenerateReport = () => {
    const sourceSummary =
      bySource.length > 0
        ? bySource.map((s) => `${SOURCE_LABEL[s.source] ?? s.source}: ${s.count}`).join("; ")
        : "источники отсутствуют";
    const riskSummary =
      riskDist.length > 0
        ? riskDist.map((r) => `${r.label}: ${r.count}`).join("; ")
        : "карточки отсутствуют";
    const dialogSummary =
      dialogStates.length > 0
        ? dialogStates.map((s) => `${s.label}: ${s.count}`).join("; ")
        : "диалоги отсутствуют";

    const safeAggregatePreview = [
      `Период: ${periodSlice.label}`,
      `Граница: только агрегаты, без пациентских строк.`,
      `Лиды: ${totalLeads}; квалифицированы: ${qualifiedLeads}; записаны: ${bookedLeads}; визиты: ${visits}.`,
      `Конверсия лид → запись: ${fmtPct(conversionLeadToBooking)}.`,
      `Источники: ${sourceSummary}.`,
      `Маршрут по срочности: ${riskSummary}.`,
      `Качество фото: прошли ${passed}; нужен повтор ${needsRepeat}; средний балл ${fmtPct(avgScore)}.`,
      `Диалоги: ${dialogSummary}.`,
      `Оценка вклада: завершённые визиты ${money(completedVisitValueRub)}; план ${money(bookedPotentialRub)}; потерянный потенциал ${money(lostPotentialRub)}.`,
      `Методика: требуется подтверждение с клиникой до рабочих финансовых выводов.`,
    ];
    setReportPreview(safeAggregatePreview.join("\n"));
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Аналитика"
        subtitle="Воронка заявок, запись, маршрутизация и качество фото · учебные агрегаты"
      />

      <div className="space-y-5 p-4">
        {/* Safety banner */}
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border px-3 py-2 text-[12px]"
          style={{
            background: "hsl(var(--warning) / 0.08)",
            borderColor: "hsl(var(--warning) / 0.30)",
            color: "hsl(var(--warning))",
          }}
        >
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Только агрегаты. Без персональных данных, фото, диагнозов и деталей подсказок. Внешние системы не вызываются.
          </span>
        </div>

        {/* ───────── Зона 1: Главное за период ───────── */}
        <ZoneSection id="zone-key-summary" title="Главное за период">
          {/* Range segmented control */}
          <div
            role="tablist"
          aria-label="Период"
          className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-surface p-1"
        >
          {RANGES.map((r) => {
            const active = r.key === range;
            return (
              <button
                key={r.key}
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.key)}
                className={`min-h-[44px] rounded px-3 text-[12px] font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            <>
              <KpiCard label="Лиды" value={totalLeads} />
              <KpiCard label="Квалифицированы" value={qualifiedLeads} />
              <KpiCard label="Записаны" value={bookedLeads} />
              <KpiCard label="Визиты" value={visits} hint="завершённые приёмы" />
              <KpiCard
                label="Конверсия лид → запись"
                value={fmtPct(conversionLeadToBooking)}
              />
              <KpiCard
                label="Высокий / срочный маршрут"
                value={highOrUrgent}
                hint="по предварительной оценке"
              />
            </>
            )}
          </div>

          {/* Primary action: единственное primary-действие демо-режима */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">Действия</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled
                  title="Учебный режим: отключено"
                  className="min-h-[44px]"
                >
                  Выгрузка CSV отключена
                </Button>
                <Button
                  size="sm"
                  onClick={onGenerateReport}
                  className="order-first w-full min-h-[44px] sm:order-none sm:w-auto"
                >
                  Сформировать учебный отчёт
                </Button>
              </div>
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground">
              Это учебный предпросмотр. Данные не отправляются во внешние системы.
            </div>
            {reportPreview && (
              <div className="mt-3 max-w-full overflow-auto rounded-md border border-border bg-muted/40">
                <pre
                  aria-label="Безопасный агрегатный предпросмотр отчёта"
                  className="max-h-80 min-w-0 whitespace-pre p-3 text-[12px] leading-relaxed"
                >
{reportPreview}
                </pre>
              </div>
            )}
          </Card>

          <Disclosure id="disclosure-period-slice" label="Срез периода — детали">
            <SectionCard title="Срез периода" hint="только агрегаты">
              {isLoading ? (
                <SectionSkeleton rows={4} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-border bg-surface-muted px-3 py-2">
                  <div className="text-[12px] font-medium">{periodSlice.label}</div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Окно: {periodSlice.windowLabel}. Граница: только агрегаты.
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[12px] sm:grid-cols-4">
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="text-muted-foreground">лиды:</div>
                    <div className="text-[18px] font-semibold tabular-nums">
                      {periodSlice.leads}
                    </div>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="text-muted-foreground">записи:</div>
                    <div className="text-[18px] font-semibold tabular-nums">
                      {periodSlice.appointments}
                    </div>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="text-muted-foreground">карточки:</div>
                    <div className="text-[18px] font-semibold tabular-nums">
                      {periodSlice.analysisCards}
                    </div>
                  </div>
                  <div className="rounded-md border border-border px-3 py-2">
                    <div className="text-muted-foreground">диалоги:</div>
                    <div className="text-[18px] font-semibold tabular-nums">
                      {periodSlice.dialogs}
                    </div>
                  </div>
                </div>
                </div>
              )}
            </SectionCard>
          </Disclosure>
        </ZoneSection>

        {/* ───────── Зона 2: Запись и обращения ───────── */}
        <ZoneSection id="zone-booking-inquiries" title="Запись и обращения">
          <Disclosure id="disclosure-funnel-sources" label="Воронка и источники">
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Funnel */}
              <SectionCard title="Воронка" hint="учебный расчёт на обезличенных агрегатах">
            {isLoading ? (
              <SectionSkeleton rows={4} />
            ) : totalLeads === 0 ? (
              renderEmpty("leads")
            ) : (
              <ul className="space-y-3">
                {funnel.map((row) => {
                  const sharePct = pct(row.value, totalLeads);
                  return (
                    <li key={row.key}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="font-medium">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {row.value} · {fmtPct(sharePct)}
                        </span>
                      </div>
                      <div className="mt-1">
                        <Bar value={row.value} max={funnelMax} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          {/* Sources */}
          <SectionCard title="Источники лидов">
            {isLoading ? (
              <SectionSkeleton rows={3} />
            ) : bySource.length === 0 ? (
              renderEmpty("sources")
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {bySource.map((s) => (
                  <div
                    key={s.source}
                    className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto] sm:items-center sm:gap-3"
                  >
                    <span className="font-medium">
                      {SOURCE_LABEL[s.source] ?? s.source}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {fmtPct(pct(s.count, totalLeads))}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      записан: {s.booked}
                    </span>
                  </div>
                ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </Disclosure>

          <Disclosure id="disclosure-operational" label="Операционный разбор">
            <SectionCard title="Операционный разбор" hint="без персональных строк">
              {isLoading ? (
                <SectionSkeleton rows={4} />
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {operationalBottlenecks.map((row) => (
                    <div
                      key={row.key}
                      className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto]"
                    >
                      <span className="font-medium">{row.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {row.count}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {fmtPct(row.share)} · {row.basis}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </Disclosure>

          <Disclosure id="disclosure-leads-by-status" label="Лиды по статусу">
            <SectionCard title="Лиды по статусу">
              <div className="flex flex-wrap gap-2 text-[12px]">
                {(Object.keys(LEAD_STATUS_LABEL) as LeadStatus[]).map((st) => {
                  const n = data.leads.filter((l) => l.status === st).length;
                  return (
                    <span
                      key={st}
                      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1"
                    >
                      <span>{LEAD_STATUS_LABEL[st]}</span>
                      <span className="tabular-nums text-muted-foreground">{n}</span>
                    </span>
                  );
                })}
              </div>
            </SectionCard>
          </Disclosure>
        </ZoneSection>

        {/* ───────── Зона 3: Качество и маршрутизация ───────── */}
        <ZoneSection id="zone-quality-routing" title="Качество и маршрутизация">
          <Disclosure id="disclosure-routing-risk" label="Маршрутизация по клиникам и риск">
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Clinics */}
              <SectionCard
                title="Маршрутизация по клиникам"
            hint={
              <span
                role="tablist"
                aria-label="Сортировка клиник"
                className="inline-flex gap-1 rounded-md border border-border bg-surface p-0.5"
              >
                {([
                  ["priority", "По приоритету"],
                  ["conversion", "По конверсии"],
                ] as const).map(([key, label]) => {
                  const active = clinicSort === key;
                  return (
                    <button
                      key={key}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setClinicSort(key)}
                      className={`min-h-[44px] rounded px-2 text-[12px] font-medium transition ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </span>
            }
          >
            {isLoading ? (
              <SectionSkeleton rows={4} />
            ) : byClinic.length === 0 ? (
              renderEmpty("clinics")
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {byClinic.map((c) => (
                  <div
                    key={c.id}
                    className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto_auto]"
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      приоритет: {c.routingPriority}
                    </span>
                    <span className="text-muted-foreground">
                      {PARTNER_TIER_LABEL[c.partnerTier]}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      лидов: {c.leads} · записан: {c.booked}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      конверсия: {fmtPct(c.conv)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Risk */}
          <SectionCard
            title="Распределение по риску"
            hint="по предварительному маршруту бот-воронки"
          >
            {isLoading ? (
              <SectionSkeleton rows={4} />
            ) : totalCards === 0 ? (
              renderEmpty("analysisCards")
            ) : (
              <ul className="space-y-3">
                {riskDist.map((r) => (
                  <li key={r.key}>
                    <div className="flex items-baseline justify-between gap-2 text-[12px]">
                      <span className="font-medium">{r.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {r.count} · {fmtPct(pct(r.count, totalCards))}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Bar
                        value={r.count}
                        max={totalCards}
                        tone={RISK_TONE[r.key]}
                      />
                    </div>
                  </li>
                ))}
                  </ul>
                )}
              </SectionCard>
            </div>
          </Disclosure>

          <Disclosure id="disclosure-quality-dialogs" label="Качество фото и состояния диалогов">
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Image quality */}
              <SectionCard
                title="Качество фото"
            hint="техническое качество снимка, не диагноз"
          >
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
            ) : totalCards === 0 ? (
              renderEmpty("imageQuality")
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <KpiCard label="Прошли проверку" value={passed} />
                <KpiCard label="Нужен повтор" value={needsRepeat} />
                <KpiCard label="Средний балл" value={fmtPct(avgScore)} />
                <KpiCard label="Просьба повторить фото" value={repeatCta} />
              </div>
            )}
          </SectionCard>

          {/* Bot dialog states */}
          <SectionCard title="Состояния бот-диалогов">
            {isLoading ? (
              <SectionSkeleton rows={4} />
            ) : data.dialogs.length === 0 ? (
              renderEmpty("botDialogs")
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {dialogStates.map((s) => (
                  <div
                    key={s.key}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-[12px]"
                  >
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.count}
                    </span>
                  </div>
                ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </Disclosure>
        </ZoneSection>

        {/* ───────── Зона 4: Финансовая оценка ───────── */}
        <ZoneSection id="zone-finance" title="Финансовая оценка">
          <Disclosure id="disclosure-finance-value" label="Финансовый контур и ценность по филиалам">
            <div className="grid gap-4 xl:grid-cols-2">
              {/* Financial value */}
              <SectionCard
                title="Финансовый контур"
            hint="оценка вклада, не бухгалтерская выручка"
          >
            {isLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <KpiSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <KpiCard label="Завершённые визиты" value={money(completedVisitValueRub)} />
                  <KpiCard label="Плановый потенциал" value={money(bookedPotentialRub)} />
                  <KpiCard label="Потерянный потенциал" value={money(lostPotentialRub)} />
                  <KpiCard label="Вклад бота и оператора" value={money(botAttributedValueRub)} />
                </div>
                <div className="rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground">
                  Учебная оценка вклада: коэффициенты фиксированы для прототипа, методика требует проверки с клиникой.
                  Это не бухгалтерская выручка и не финансовый прогноз.
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Ценность по филиалам" hint="только агрегаты">
            {isLoading ? (
              <SectionSkeleton rows={3} />
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {clinicValue.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[1fr_auto_auto_auto]"
                  >
                    <span className="font-medium">{row.name}</span>
                    <span className="tabular-nums text-muted-foreground">
                      завершено: {row.completed}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      план: {row.planned}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      оценка: {money(row.estimatedRub)}
                    </span>
                  </div>
                ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </Disclosure>

          <Disclosure id="disclosure-finance-methodology" label="Проверка методики">
            <SectionCard title="Проверка методики" hint="до рабочего запуска">
              {isLoading ? (
                <SectionSkeleton rows={5} />
            ) : (
              <div className="space-y-3">
                <div className="rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-[12px]">
                  <div className="font-medium">
                    Статус: методика не утверждена
                  </div>
                  <div className="mt-1 text-muted-foreground">
                    Финансовые числа остаются учебной оценкой до интервью с клиникой,
                    сверки стоимости услуг, стоимости сервиса и факта записи/оплаты.
                  </div>
                </div>
                <div className="divide-y divide-border rounded-md border border-border">
                  {FINANCE_VALIDATION_STEPS.map((step) => (
                    <div
                      key={step.key}
                      className="grid grid-cols-1 gap-1 px-3 py-2 text-[12px] sm:grid-cols-[160px_130px_1fr]"
                    >
                      <span className="font-medium">{step.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {step.statusLabel}
                      </span>
                      <span className="text-muted-foreground">
                        {step.detail}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Граница: только агрегаты, без пациентских строк, без бухгалтерской
                  выручки и без финансового прогноза.
                </div>
                </div>
              )}
            </SectionCard>
          </Disclosure>
        </ZoneSection>
      </div>
    </div>
  );
}
