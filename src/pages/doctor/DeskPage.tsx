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
import { calcAge, formatDateTime, sexShort } from "@/lib/format";
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

export default function DeskPage() {
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
  for (const v of [...myVisits].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    lastVisitByPatient.set(v.patientId, v.startedAt);
  }
  const recentPatients = [...lastVisitByPatient.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 5)
    .map(([pid, last]) => ({ patient: getPatientById(pid), lastAt: last }))
    .filter((x): x is { patient: NonNullable<ReturnType<typeof getPatientById>>; lastAt: string } => !!x.patient);

  const myVisitIds = new Set(myVisits.map((v) => v.id));
  const qualityIssues = IMAGES.filter(
    (i) => myVisitIds.has(i.visitId) && (i.quality.score < QUALITY_THRESHOLD || i.quality.issues.length > 0),
  ).slice(0, 5);

  const leadsNew = LEADS.filter((l) => l.status === "new").length;
  const leadsQualified = LEADS.filter((l) => l.status === "qualified").length;
  const leadsBooked = LEADS.filter((l) => l.status === "booked").length;
  const apptPlanned = APPOINTMENTS.filter((a) => a.status === "planned" || a.status === "confirmed").length;

  const devices = getDevices();
  const devicesTotal = devices.length;
  const DEMO_NOW_MS = Date.parse(BODY_MAP_DEMO_NOW);
  const devicesRecent = devices.filter((d) => {
    const last = new Date(d.lastSeenAt).getTime();
    return DEMO_NOW_MS - last < 1000 * 60 * 60 * 24 * 30;
  }).length;

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Рабочий стол"
        subtitle={`${currentUser.fullName} · очередь визитов и приоритеты`}
        actions={
          <Button asChild size="sm" className="h-8 text-[12px]">
            <Link to="/capture">
              <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Съёмка
            </Link>
          </Button>
        }
      />

      <div className="flex-1 space-y-6 px-6 py-6">
        {/* KPI — единая полоса без рамок, цифра доминирует */}
        <section className="surface-card grid grid-cols-2 divide-x divide-border sm:grid-cols-4">
          <Kpi label="Визиты сегодня" value={upcoming.length} hint="запланированы и в работе" />
          <Kpi label="Ждут заключения" value={awaitingConclusion.length} hint="закрытые без отчёта" />
          <Kpi label="Лиды нов./квал./зап." value={`${leadsNew}/${leadsQualified}/${leadsBooked}`} hint="бот и сайт" />
          <Kpi label="Записи в работе" value={apptPlanned} hint="plan + confirmed" />
        </section>

        {/* Основной двухколоночный блок: визиты и заключения */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-7" title="Ближайшие визиты" hint="запланированные и активные">
            {upcoming.length === 0 ? (
              <Empty text="Нет запланированных визитов." />
            ) : (
              <ul className="divide-y divide-border">
                {upcoming.map((v) => (
                  <li key={v.id} className="row-grid">
                    <div className="min-w-0">
                      <div className="truncate text-row font-medium">{patientName(v.patientId)}</div>
                      <div className="truncate text-meta">
                        <span className="font-mono">{patientCode(v.patientId)}</span> · {clinicName(v.clinicId)}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-row tabular-nums">{formatDateTime(v.startedAt)}</div>
                      <div className="truncate text-meta">{v.complaint}</div>
                    </div>
                    <StatusChip>{STATUS_LABEL[v.status]}</StatusChip>
                    <RowLink to={`/patients/${v.patientId}/visits/${v.id}`} label={`Открыть визит ${v.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="lg:col-span-5" title="Ждут заключения" hint="закрытые без отчёта">
            {awaitingConclusion.length === 0 ? (
              <Empty text="Все закрытые визиты оформлены." />
            ) : (
              <ul className="divide-y divide-border">
                {awaitingConclusion.map((v) => (
                  <li key={v.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-row font-medium">{patientName(v.patientId)}</div>
                      <div className="truncate text-meta tabular-nums">{formatDateTime(v.closedAt)}</div>
                    </div>
                    <span className="text-meta">{clinicName(v.clinicId)}</span>
                    <RowLink to={`/patients/${v.patientId}/visits/${v.id}`} label={`Открыть визит ${v.id}`} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Пациенты и снимки */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-5" title="Недавние пациенты" hint="по последнему визиту">
            <ul className="divide-y divide-border">
              {recentPatients.map(({ patient, lastAt }) => (
                <li key={patient.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-row font-medium">{patient.fullName}</div>
                    <div className="truncate text-meta">
                      <span className="font-mono">{patient.code}</span> · {sexShort(patient.sex)} · {calcAge(patient.birthDate)} лет
                    </div>
                  </div>
                  <span className="text-meta tabular-nums">{formatDateTime(lastAt)}</span>
                  <RowLink to={`/patients/${patient.id}`} label={`Открыть карточку ${patient.fullName}`} />
                </li>
              ))}
            </ul>
          </Card>

          <Card className="lg:col-span-7" title="Замечания к снимкам" hint="низкое качество или артефакты">
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
                        <div className="truncate text-row font-medium">{v ? patientName(v.patientId) : "—"}</div>
                        <div className="truncate text-meta">{img.kind}</div>
                      </div>
                      <div className="truncate text-meta">
                        {img.quality.issues.length > 0 ? img.quality.issues.join(", ") : "без замечаний"}
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
                        <RowLink to={`/patients/${v.patientId}/visits/${v.id}`} label={`Открыть визит ${v.id}`} />
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

        {/* Сводка: лиды и устройства */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-6" title="Лиды и записи" hint="из бота и партнёрских каналов">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
              <Stat term="Пациентов в базе" value={PATIENTS.length} />
              <Stat term="Лиды всего" value={LEADS.length} />
              <Stat term="Записи запланированы" value={apptPlanned} />
              <Stat term="Записи выполнены" value={APPOINTMENTS.filter((a) => a.status === "completed").length} />
            </dl>
          </Card>

          <Card className="lg:col-span-6" title="Устройства" hint="электронные дерматоскопы">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-3 text-row">
              <Stat term="Всего" value={devicesTotal} />
              <Stat term="Активны за 30 дней" value={devicesRecent} />
            </dl>
            <ul className="divide-y divide-border border-t border-border">
              {devices.slice(0, 2).map((d) => (
                <li key={d.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 px-4 py-2">
                  <div className="min-w-0">
                    <div className="truncate text-row font-medium">{d.model}</div>
                    <div className="truncate text-meta">
                      <span className="font-mono">{d.serial}</span> · {d.magnification} · {d.polarization}
                    </div>
                  </div>
                  <span className="text-meta tabular-nums">{formatDateTime(d.lastSeenAt)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
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
