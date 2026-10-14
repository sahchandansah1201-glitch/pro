import { useEffect, useRef, useState } from "react";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  getAdminAnalytics,
  type AdminAnalyticsDTO,
  type AdminAnalyticsPeriod,
} from "@/lib/self-hosted-admin-api";

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
  const session = useSelfHostedApiSession();
  return <AdminAnalyticsPageLive key={session.revision} />;
}
