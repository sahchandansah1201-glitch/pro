import { Link } from "react-router-dom";
import { Camera, ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { useRole } from "@/context/role-context";
import {
  APPOINTMENTS,
  IMAGES,
  LEADS,
  PATIENTS,
  REPORTS,
  VISITS,
  getClinicById,
  getDevices,
  getPatientById,
} from "@/lib/mock-data";
import { calcAge, formatDateTime } from "@/lib/format";
import type { Visit } from "@/lib/domain";
import { BODY_MAP_DEMO_NOW } from "@/pages/doctor/body-map-model";

const QUALITY_THRESHOLD = 0.8;

function visitsForDoctor(doctorId: string): Visit[] {
  return VISITS.filter((v) => v.doctorId === doctorId);
}

function patientName(id: string): string {
  return getPatientById(id)?.fullName ?? "—";
}
function patientCode(id: string): string {
  return getPatientById(id)?.code ?? "—";
}
function clinicName(id: string): string {
  return getClinicById(id)?.name ?? "—";
}

const STATUS_LABEL: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const SEX_LABEL_SHORT: Record<string, string> = {
  male: "муж.",
  female: "жен.",
};

const IMAGE_KIND_LABEL: Record<string, string> = {
  overview: "Обзор",
  dermoscopy: "Дерматоскопия",
  macro: "Крупный план",
  body_map: "Карта тела",
};

const POLARIZATION_LABEL: Record<string, string> = {
  polarized: "поляризация",
  non_polarized: "без поляризации",
  both: "оба режима",
};

function imageKindLabel(kind: string): string {
  return IMAGE_KIND_LABEL[kind] ?? "Снимок";
}

function polarizationLabel(value: string): string {
  return POLARIZATION_LABEL[value] ?? "режим не указан";
}

type CurrentAction = {
  nextStep: string;
  actionLabel: string;
  href: string;
};

export default function DeskPageDemo() {
  const { currentUser } = useRole();
  const doctorId = currentUser.id;

  const myVisits = visitsForDoctor(doctorId);
  const upcoming = myVisits
    .filter((v) => v.status === "scheduled" || v.status === "in_progress")
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .slice(0, 6);

  const reportVisitIds = new Set(REPORTS.map((r) => r.visitId));
  const awaitingConclusion = myVisits
    .filter((v) => v.status === "closed" && !reportVisitIds.has(v.id))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, 6);

  const lastVisitByPatient = new Map<string, string>();
  for (const v of [...myVisits].sort((a, b) =>
    a.startedAt.localeCompare(b.startedAt),
  )) {
    lastVisitByPatient.set(v.patientId, v.startedAt);
  }
  const recentPatients = [...lastVisitByPatient.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 5)
    .map(([pid, last]) => ({ patient: getPatientById(pid), lastAt: last }))
    .filter(
      (
        x,
      ): x is {
        patient: NonNullable<ReturnType<typeof getPatientById>>;
        lastAt: string;
      } => !!x.patient,
    );

  const myVisitIds = new Set(myVisits.map((v) => v.id));
  const qualityIssues = IMAGES.filter(
    (i) =>
      myVisitIds.has(i.visitId) &&
      (i.quality.score < QUALITY_THRESHOLD || i.quality.issues.length > 0),
  ).slice(0, 5);

  const leadsNew = LEADS.filter((l) => l.status === "new").length;
  const leadsQualified = LEADS.filter((l) => l.status === "qualified").length;
  const leadsBooked = LEADS.filter((l) => l.status === "booked").length;
  const apptPlanned = APPOINTMENTS.filter(
    (a) => a.status === "planned" || a.status === "confirmed",
  ).length;

  const devices = getDevices();
  const devicesTotal = devices.length;
  const DEMO_NOW_MS = Date.parse(BODY_MAP_DEMO_NOW);
  const devicesRecent = devices.filter((d) => {
    const last = new Date(d.lastSeenAt).getTime();
    return DEMO_NOW_MS - last < 1000 * 60 * 60 * 24 * 30;
  }).length;

  const currentAction: CurrentAction =
    awaitingConclusion.length > 0
      ? {
          nextStep: "Закрыть заключения",
          actionLabel: "Открыть очередь заключений",
          href: "#desk-reports",
        }
      : qualityIssues.length > 0
        ? {
            nextStep: "Проверить снимки",
            actionLabel: "Открыть замечания к снимкам",
            href: "#desk-photo-quality",
          }
        : upcoming[0]
          ? {
              nextStep: "Открыть ближайший визит",
              actionLabel: "Открыть ближайший визит",
              href: `/patients/${upcoming[0].patientId}/visits/${upcoming[0].id}`,
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
        subtitle={`${currentUser.fullName} · очередь визитов и приоритеты`}
        actions={
          <Button asChild size="sm" className="min-h-11 text-[12px]">
            <Link to="/capture">
              <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Съёмка
            </Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        <CurrentActionBand action={currentAction} />

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
              value={upcoming.length}
              hint="запланированы и в работе"
            />
            <Kpi
              label="Ждут заключения"
              value={awaitingConclusion.length}
              hint="закрытые без отчёта"
            />
            <Kpi
              label="Лиды нов./квал./зап."
              value={`${leadsNew}/${leadsQualified}/${leadsBooked}`}
              hint="бот и сайт"
            />
            <Kpi
              label="Записи в работе"
              value={apptPlanned}
              hint="запланированы и подтверждены"
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
              hint="запланированные и активные"
            >
              {upcoming.length === 0 ? (
                <Empty text="Нет запланированных визитов." />
              ) : (
                <ul className="divide-y divide-border">
                  {upcoming.map((v) => (
                    <li key={v.id} className="row-grid">
                      <div className="min-w-0">
                        <div className="truncate text-row font-medium">
                          {patientName(v.patientId)}
                        </div>
                        <div className="truncate text-meta">
                          <span className="font-mono">
                            {patientCode(v.patientId)}
                          </span>{" "}
                          · {clinicName(v.clinicId)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-row tabular-nums">
                          {formatDateTime(v.startedAt)}
                        </div>
                        <div className="truncate text-meta">{v.complaint}</div>
                      </div>
                      <StatusChip>{STATUS_LABEL[v.status]}</StatusChip>
                      <RowLink
                        to={`/patients/${v.patientId}/visits/${v.id}`}
                        label={`Открыть визит ${patientName(v.patientId)}`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              id="desk-reports"
              className="lg:col-span-5"
              title="Ждут заключения"
              hint="закрытые без отчёта"
            >
              {awaitingConclusion.length === 0 ? (
                <Empty text="Все закрытые визиты оформлены." />
              ) : (
                <ul className="divide-y divide-border">
                  {awaitingConclusion.map((v) => (
                    <li
                      key={v.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-row font-medium">
                          {patientName(v.patientId)}
                        </div>
                        <div className="truncate text-meta tabular-nums">
                          {formatDateTime(v.closedAt)}
                        </div>
                      </div>
                      <span className="text-meta">
                        {clinicName(v.clinicId)}
                      </span>
                      <RowLink
                        to={`/patients/${v.patientId}/visits/${v.id}`}
                        label={`Открыть визит ${patientName(v.patientId)}`}
                      />
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
              <ul className="divide-y divide-border">
                {recentPatients.map(({ patient, lastAt }) => (
                  <li
                    key={patient.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-row font-medium">
                        {patient.fullName}
                      </div>
                      <div className="truncate text-meta">
                        <span className="font-mono">{patient.code}</span> ·{" "}
                        {SEX_LABEL_SHORT[patient.sex] ?? "пол не указан"} ·{" "}
                        {calcAge(patient.birthDate)} лет
                      </div>
                    </div>
                    <span className="text-meta tabular-nums">
                      {formatDateTime(lastAt)}
                    </span>
                    <RowLink
                      to={`/patients/${patient.id}`}
                      label={`Открыть карточку ${patient.fullName}`}
                    />
                  </li>
                ))}
              </ul>
            </Card>

            <Card
              id="desk-photo-quality"
              className="lg:col-span-7"
              title="Замечания к снимкам"
              hint="низкое качество или артефакты"
            >
              {qualityIssues.length === 0 ? (
                <Empty text="Замечаний по качеству фото нет." />
              ) : (
                <ul className="divide-y divide-border">
                  {qualityIssues.map((img) => {
                    const v = VISITS.find((x) => x.id === img.visitId);
                    const score = Math.round(img.quality.score * 100);
                    return (
                      <li key={img.id} className="row-grid">
                        <div className="min-w-0">
                          <div className="truncate text-row font-medium">
                            {v ? patientName(v.patientId) : "—"}
                          </div>
                          <div className="truncate text-meta">
                            {imageKindLabel(img.kind)}
                          </div>
                        </div>
                        <div className="truncate text-meta">
                          {img.quality.issues.length > 0
                            ? img.quality.issues.join(", ")
                            : "без замечаний"}
                        </div>
                        <span
                          className="inline-flex shrink-0 items-center rounded-sm px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                          style={{
                            background: "hsl(var(--warning) / 0.12)",
                            color: "hsl(var(--warning))",
                          }}
                        >
                          {score}%
                        </span>
                        {v ? (
                          <RowLink
                            to={`/patients/${v.patientId}/visits/${v.id}`}
                            label={`Открыть визит ${patientName(v.patientId)}`}
                          />
                        ) : (
                          <span />
                        )}
                      </li>
                    );
                  })}
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
              hint="из бота и партнёрских каналов"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
                <Stat term="Пациентов в базе" value={PATIENTS.length} />
                <Stat term="Лиды всего" value={LEADS.length} />
                <Stat term="Записи запланированы" value={apptPlanned} />
                <Stat
                  term="Записи выполнены"
                  value={
                    APPOINTMENTS.filter((a) => a.status === "completed").length
                  }
                />
              </dl>
            </Card>

            <Card
              id="desk-devices"
              className="lg:col-span-6"
              title="Устройства"
              hint="электронные дерматоскопы"
            >
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
                <Stat term="Всего" value={devicesTotal} />
                <Stat term="Активны за 30 дней" value={devicesRecent} />
              </dl>
              <ul className="divide-y divide-border border-t border-border">
                {devices.slice(0, 2).map((d) => (
                  <li
                    key={d.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-row font-medium">
                        {d.model}
                      </div>
                      <div className="truncate text-meta">
                        <span className="font-mono">{d.serial}</span> ·{" "}
                        увеличение {d.magnification} · {polarizationLabel(d.polarization)}
                      </div>
                    </div>
                    <span className="text-meta tabular-nums">
                      {formatDateTime(d.lastSeenAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
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
      <Button asChild size="sm" className="min-h-11 justify-center text-[12px]">
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
      className="row-action inline-flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
    >
      <ChevronRight className="h-4 w-4" aria-hidden />
    </Link>
  );
}
