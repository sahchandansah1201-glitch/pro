import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart3, Bot, Building2, FileText, Plug, Stethoscope, type LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSelfHostedApiSession } from "@/lib/self-hosted-api-session";
import {
  adminApiErrorText,
  getAdminAnalytics,
  listAdminClinics,
  listAdminDoctors,
  type AdminAnalyticsDTO,
  type AdminClinicDTO,
  type AdminUserDTO,
} from "@/lib/self-hosted-admin-api";

const LIVE_EMPTY_ANALYTICS: AdminAnalyticsDTO = {
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

type OpsTone = "ok" | "warn" | "danger" | "info";

const OPS_TONE: Record<OpsTone, string> = {
  ok: "border-success/40 bg-success/10 text-success",
  warn: "border-warning/40 bg-warning/10 text-warning",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  info: "border-info/40 bg-info/10 text-info",
};

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

function liveClinicStatusLabel(status: AdminClinicDTO["status"]): string {
  if (status === "suspended") return "приостановлена";
  if (status === "archived") return "архив";
  return "работает";
}

function liveClinicStatusTone(status: AdminClinicDTO["status"]): string {
  if (status === "suspended") return OPS_TONE.warn;
  if (status === "archived") return OPS_TONE.danger;
  return OPS_TONE.ok;
}

function userClinicNames(user: AdminUserDTO): string {
  const names = user.roles
    .map((role) => role.clinicName)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names)).join(", ") || "клиника не указана";
}

function AdminHomePageLive() {
  const session = useSelfHostedApiSession();
  const [analytics, setAnalytics] = useState<AdminAnalyticsDTO>(LIVE_EMPTY_ANALYTICS);
  const [clinics, setClinics] = useState<AdminClinicDTO[]>([]);
  const [doctors, setDoctors] = useState<AdminUserDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setNote(null);
    const [analyticsResult, clinicsResult, doctorsResult] = await Promise.all([
      getAdminAnalytics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminClinics({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
      listAdminDoctors({ apiBaseUrl: session.apiBaseUrl, apiToken: session.apiToken }),
    ]);
    setLoading(false);

    const errors = [analyticsResult, clinicsResult, doctorsResult]
      .filter((result) => !result.ok)
      .map((result) => adminApiErrorText(result.error));
    if (errors.length) {
      setNote(errors[0]);
      return;
    }

    setAnalytics(analyticsResult.value ?? LIVE_EMPTY_ANALYTICS);
    setClinics(clinicsResult.value ?? []);
    setDoctors(doctorsResult.value ?? []);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.apiBaseUrl, session.apiToken]);

  const activeClinics = clinics.filter((clinic) => clinic.status === "active").length;
  const suspendedClinics = clinics.filter((clinic) => clinic.status === "suspended").length;
  const archivedClinics = clinics.filter((clinic) => clinic.status === "archived").length;
  const activeDoctors = doctors.filter((doctor) => doctor.active).length;
  const disabledDoctors = doctors.filter((doctor) => !doctor.active).length;
  const recentClinics = clinics.slice(0, 4);
  const recentDoctors = doctors.slice(0, 4);

  const actionQueue = [
    doctors.length === 0
      ? {
          title: "Добавьте первого врача",
          detail: "После добавления врача клиника сможет выдавать доступ к рабочему месту врача.",
          to: "/admin/doctors",
          cta: "Добавить врача",
          tone: "warn" as OpsTone,
          Icon: Stethoscope,
        }
      : null,
    suspendedClinics > 0 || archivedClinics > 0
      ? {
          title: "Проверьте приостановленные записи",
          detail: "Есть клиники или кабинеты без рабочего доступа. Проверьте статус перед записью пациентов.",
          to: "/admin/clinics",
          cta: "Проверить клиники",
          tone: "warn" as OpsTone,
          Icon: Building2,
        }
      : null,
    analytics.visits === 0
      ? {
          title: "Подготовьте запись и услуги",
          detail: "В рабочей базе пока нет визитов. Проверьте услуги, длительность и доступные кабинеты.",
          to: "/admin/services",
          cta: "Проверить услуги",
          tone: "info" as OpsTone,
          Icon: FileText,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Операционный центр клиники"
        subtitle="Рабочие показатели клиники, сотрудники, кабинеты и готовность к записи."
      />

      <div className="space-y-3 p-3 sm:p-4">
        <div className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
          Рабочий режим: показатели читаются из рабочей базы сервиса. Персональные строки, фото и медицинские выводы не выводятся.
        </div>

        {note && (
          <div role="status" aria-live="polite" className="rounded-md border border-border bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            {note}
          </div>
        )}

        <section aria-label="Рабочий статус клиники" className="grid grid-cols-2 gap-2 xl:grid-cols-4">
          <OpsMetric label="Клиники" value={loading ? "…" : activeClinics} hint="работают" tone="ok" />
          <OpsMetric label="Сотрудники" value={loading ? "…" : analytics.activeUsers} hint="активный доступ" tone="info" />
          <OpsMetric label="Врачи" value={loading ? "…" : activeDoctors} hint="могут работать" tone="info" />
          <OpsMetric label="Аудит за 7 дней" value={loading ? "…" : analytics.auditEvents7d} hint="действия в системе" tone="warn" />
        </section>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <SectionCard title="Очередь действий администратора" hint={`${actionQueue.length} задач`}>
            {actionQueue.length === 0 ? (
              <div className="rounded-md border border-border bg-surface px-3 py-4 text-[12px] text-muted-foreground">
                Срочных действий нет. Проверьте врачей, услуги или аналитику при изменении расписания.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-1">
                {actionQueue.map(({ title, detail, to, cta, tone, Icon }) => (
                  <article key={title} className="rounded-md border border-border bg-surface p-3 text-[12px]">
                    <div className="flex items-start gap-2">
                      <span className={`rounded-md border p-1.5 ${OPS_TONE[tone]}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold">{title}</div>
                        <p className="mt-0.5 text-muted-foreground">{detail}</p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <ActionLink to={to}>{cta}</ActionLink>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Рабочие агрегаты" hint="без персональных строк">
            <div className="grid grid-cols-2 gap-2 text-[12px]">
              <SmallMetric label="Пациенты" value={loading ? 0 : analytics.patients} />
              <SmallMetric label="Визиты" value={loading ? 0 : analytics.visits} />
              <SmallMetric label="Снимки" value={loading ? 0 : analytics.photos} />
              <SmallMetric label="Отчёты" value={loading ? 0 : analytics.signedReports} />
              <SmallMetric label="Приостановлены" value={loading ? 0 : suspendedClinics} />
              <SmallMetric label="В архиве" value={loading ? 0 : archivedClinics} />
              <SmallMetric label="Врачи работают" value={loading ? 0 : activeDoctors} />
              <SmallMetric label="Врачи отключены" value={loading ? 0 : disabledDoctors} />
            </div>
            <div className="mt-3">
              <ActionLink to="/admin/analytics">Открыть аналитику</ActionLink>
            </div>
          </SectionCard>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <SectionCard title="Клиники и кабинеты" hint={`${clinics.length} записей`}>
            {recentClinics.length === 0 ? (
              <div className="rounded-md border border-border bg-surface px-3 py-4 text-[12px] text-muted-foreground">
                Клиники ещё не добавлены. Создайте клинику или частный кабинет перед назначением сотрудников.
              </div>
            ) : (
              <ul className="space-y-2">
                {recentClinics.map((clinic) => (
                  <li key={clinic.id} className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{clinic.name}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {clinic.address || "адрес не указан"} · сотрудников {clinic.usersCount ?? 0}
                        </div>
                      </div>
                      <StatusPill tone={liveClinicStatusTone(clinic.status)}>
                        {liveClinicStatusLabel(clinic.status)}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <ActionLink to="/admin/clinics">Открыть клиники</ActionLink>
            </div>
          </SectionCard>

          <SectionCard title="Врачи" hint={`${doctors.length} записей`}>
            {recentDoctors.length === 0 ? (
              <div className="rounded-md border border-border bg-surface px-3 py-4 text-[12px] text-muted-foreground">
                Врачи ещё не добавлены. Создайте врача и назначьте клинику.
              </div>
            ) : (
              <ul className="space-y-2">
                {recentDoctors.map((doctor) => (
                  <li key={doctor.id} className="rounded-md border border-border bg-surface px-3 py-2 text-[12px]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium">{doctor.displayName}</div>
                        <div className="truncate text-[11px] text-muted-foreground">{userClinicNames(doctor)}</div>
                      </div>
                      <StatusPill tone={doctor.active ? OPS_TONE.ok : OPS_TONE.warn}>
                        {doctor.active ? "работает" : "отключён"}
                      </StatusPill>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <ActionLink to="/admin/doctors">Открыть врачей</ActionLink>
            </div>
          </SectionCard>
        </div>

        <SectionCard title="Быстрый переход" hint="рабочие разделы">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          <QuickLink to="/admin/doctors" label="Врачи и ассистенты" hint="учётные записи и доступ" Icon={Stethoscope} />
            <QuickLink to="/admin/services" label="Услуги" hint="цены и длительность" Icon={FileText} />
            <QuickLink to="/admin/clinics" label="Клиники и кабинеты" hint="статус и адрес" Icon={Building2} />
            <QuickLink to="/admin/integrations" label="Интеграции" hint="подключения клиники" Icon={Plug} />
            <QuickLink to="/admin/bot" label="Помощник записи" hint="заявки и передача" Icon={Bot} />
            <QuickLink to="/admin/analytics" label="Аналитика" hint="агрегаты" Icon={BarChart3} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default function AdminHomePage() {
  const session = useSelfHostedApiSession();
  return <AdminHomePageLive key={session.revision} />;
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border bg-surface px-2 py-1.5">
      <div className="font-medium tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
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
