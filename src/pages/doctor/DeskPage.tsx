import { Link } from "react-router-dom";
import { Camera, ChevronRight, ImageOff, Stethoscope } from "lucide-react";

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

const QUALITY_THRESHOLD = 0.8;

function visitsForDoctor(doctorId: string): Visit[] {
  // Частный врач — свои визиты; штатный врач — визиты, где он лечащий или ассистент рядом.
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

  // «Ожидают заключения» — закрытые визиты без отчёта (упрощённая эвристика для MVP).
  const reportVisitIds = new Set(REPORTS.map((r) => r.visitId));
  const awaitingConclusion = myVisits
    .filter((v) => v.status === "closed" && !reportVisitIds.has(v.id))
    .sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""))
    .slice(0, 6);

  // Недавние пациенты — по последнему визиту врача.
  const lastVisitByPatient = new Map<string, string>();
  for (const v of [...myVisits].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    lastVisitByPatient.set(v.patientId, v.startedAt);
  }
  const recentPatients = [...lastVisitByPatient.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
    .slice(0, 5)
    .map(([pid, last]) => ({ patient: getPatientById(pid), lastAt: last }))
    .filter((x): x is { patient: NonNullable<ReturnType<typeof getPatientById>>; lastAt: string } => !!x.patient);

  // Проблемные снимки — низкое качество или с замечаниями.
  const myVisitIds = new Set(myVisits.map((v) => v.id));
  const qualityIssues = IMAGES.filter(
    (i) => myVisitIds.has(i.visitId) && (i.quality.score < QUALITY_THRESHOLD || i.quality.issues.length > 0),
  ).slice(0, 5);

  // Лиды и записи из бота — общая сводка по клинике.
  const leadsNew = LEADS.filter((l) => l.status === "new").length;
  const leadsQualified = LEADS.filter((l) => l.status === "qualified").length;
  const leadsBooked = LEADS.filter((l) => l.status === "booked").length;
  const apptPlanned = APPOINTMENTS.filter((a) => a.status === "planned" || a.status === "confirmed").length;

  // Устройства.
  const devices = getDevices();
  const devicesTotal = devices.length;
  const devicesRecent = devices.filter((d) => {
    const last = new Date(d.lastSeenAt).getTime();
    return Date.now() - last < 1000 * 60 * 60 * 24 * 30;
  }).length;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Рабочий стол врача"
        subtitle={`${currentUser.fullName} · очередь визитов и приоритеты`}
        actions={
          <Button asChild size="sm" className="h-8 text-[12px]">
            <Link to="/capture">
              <Camera className="mr-1.5 h-3.5 w-3.5" aria-hidden /> Съёмка
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-12">
        {/* KPI блок */}
        <section className="lg:col-span-12">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Визиты сегодня" value={upcoming.length} hint="Запланированные и в работе" />
            <Kpi label="Ждут заключения" value={awaitingConclusion.length} hint="Закрытые без отчёта" />
            <Kpi label="Лиды (нов./квал./запис.)" value={`${leadsNew}/${leadsQualified}/${leadsBooked}`} hint="Источник: бот и сайт" />
            <Kpi label="Записи в работе" value={apptPlanned} hint="Plan + confirmed" />
          </div>
        </section>

        {/* Колонка 1: ближайшие визиты */}
        <section className="rounded-md border border-border bg-surface lg:col-span-7">
          <SectionHeader title="Ближайшие визиты" hint="Запланированные и активные приёмы" />
          {upcoming.length === 0 ? (
            <Empty text="Нет запланированных визитов." />
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <Stethoscope className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-medium">{patientName(v.patientId)}</span>
                      <span className="text-[11px] text-muted-foreground">{patientCode(v.patientId)}</span>
                      <span className="text-[11px] text-muted-foreground">· {clinicName(v.clinicId)}</span>
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {formatDateTime(v.startedAt)} · {v.complaint}
                    </div>
                  </div>
                  <span className="hidden shrink-0 rounded-sm border border-border bg-surface-muted px-1.5 py-0.5 text-[11px] text-muted-foreground sm:inline">
                    {STATUS_LABEL[v.status]}
                  </span>
                  <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                    <Link to={`/patients/${v.patientId}/visits/${v.id}`}>
                      Открыть визит <ChevronRight className="ml-0.5 h-3.5 w-3.5" aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Колонка 2: ждут заключения */}
        <section className="rounded-md border border-border bg-surface lg:col-span-5">
          <SectionHeader title="Ждут заключения" hint="Закрытые визиты без отчёта" />
          {awaitingConclusion.length === 0 ? (
            <Empty text="Все закрытые визиты оформлены." />
          ) : (
            <ul className="divide-y divide-border">
              {awaitingConclusion.map((v) => (
                <li key={v.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{patientName(v.patientId)}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {formatDateTime(v.closedAt)} · {clinicName(v.clinicId)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                    <Link to={`/patients/${v.patientId}/visits/${v.id}`}>Открыть</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Колонка 3: недавние пациенты */}
        <section className="rounded-md border border-border bg-surface lg:col-span-5">
          <SectionHeader title="Недавние пациенты" hint="По последнему визиту" />
          {recentPatients.length === 0 ? (
            <Empty text="Нет недавних пациентов." />
          ) : (
            <ul className="divide-y divide-border">
              {recentPatients.map(({ patient, lastAt }) => (
                <li key={patient.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{patient.fullName}</div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      {patient.code} · {sexShort(patient.sex)} · {calcAge(patient.birthDate)} лет · посл. визит {formatDateTime(lastAt)}
                    </div>
                  </div>
                  <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                    <Link to={`/patients/${patient.id}`}>Открыть пациента</Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Колонка 4: проблемные снимки */}
        <section className="rounded-md border border-border bg-surface lg:col-span-7">
          <SectionHeader title="Замечания к снимкам" hint="Низкое качество или артефакты" />
          {qualityIssues.length === 0 ? (
            <Empty text="Замечаний по качеству фото нет." />
          ) : (
            <ul className="divide-y divide-border">
              {qualityIssues.map((img) => {
                const v = VISITS.find((x) => x.id === img.visitId);
                return (
                  <li key={img.id} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                    <ImageOff className="h-4 w-4 shrink-0 text-warning" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">
                        <span className="font-medium">{v ? patientName(v.patientId) : "—"}</span>{" "}
                        <span className="text-muted-foreground">· {img.kind}</span>
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        Качество {Math.round(img.quality.score * 100)}%
                        {img.quality.issues.length > 0 ? ` · ${img.quality.issues.join(", ")}` : ""}
                      </div>
                    </div>
                    {v && (
                      <Button asChild size="sm" variant="ghost" className="h-7 text-[12px]">
                        <Link to={`/patients/${v.patientId}/visits/${v.id}`}>Открыть визит</Link>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Сводка: лиды и устройства */}
        <section className="rounded-md border border-border bg-surface lg:col-span-6">
          <SectionHeader title="Сводка по лидам и записи" hint="Из бота и партнёрских каналов" />
          <dl className="grid grid-cols-2 gap-3 p-3 text-[13px]">
            <Stat term="Всего пациентов в базе" value={PATIENTS.length} />
            <Stat term="Лиды всего" value={LEADS.length} />
            <Stat term="Записи запланированы" value={apptPlanned} />
            <Stat term="Записи выполнены" value={APPOINTMENTS.filter((a) => a.status === "completed").length} />
          </dl>
        </section>

        <section className="rounded-md border border-border bg-surface lg:col-span-6">
          <SectionHeader title="Устройства" hint="Электронные дерматоскопы" />
          <dl className="grid grid-cols-2 gap-3 p-3 text-[13px]">
            <Stat term="Всего" value={devicesTotal} />
            <Stat term="Активны за 30 дней" value={devicesRecent} />
            {devices.slice(0, 2).map((d) => (
              <div key={d.id} className="col-span-2 rounded-sm border border-border bg-surface-muted px-2 py-1.5">
                <div className="text-[12px]">
                  <span className="font-medium">{d.model}</span>{" "}
                  <span className="text-muted-foreground">· {d.magnification} · {d.polarization}</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Серийный № {d.serial} · посл. активность {formatDateTime(d.lastSeenAt)}
                </div>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
      <h2 className="text-[13px] font-semibold">{title}</h2>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">{text}</div>;
}

function Kpi({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold leading-tight">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-muted-foreground">{term}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
