import { Link } from "react-router-dom";
import { ClipboardList, Search } from "lucide-react";

import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLINICS, getPatientById, VISITS } from "@/lib/mock-data";
import { formatDateTime } from "@/lib/format";
import type { Visit } from "@/lib/domain";

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

function clinicName(id: string): string {
  return CLINICS.find((clinic) => clinic.id === id)?.name ?? "Клиника";
}

function statusLabel(status: Visit["status"]): string {
  return STATUS_LABEL[status] ?? status;
}

function formatCardNumber(code?: string): string {
  if (!code) return "номер скрыт";
  const match = code.match(/^DP-\d{4}-(\d+)$/);
  return match ? `карта ${match[1]}` : code;
}

function visitHref(visit: Visit): string {
  return `/patients/${visit.patientId}/visits/${visit.id}`;
}

function visitPatientName(visit: Visit): string {
  return getPatientById(visit.patientId)?.fullName ?? "Пациент";
}

function visitPatientCode(visit: Visit): string {
  return formatCardNumber(getPatientById(visit.patientId)?.code);
}

function VisitCard({ visit }: { visit: Visit }) {
  const patientName = visitPatientName(visit);
  return (
    <article className="rounded-md border border-border bg-surface px-3 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[14px] font-semibold text-foreground">{patientName}</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {formatDateTime(visit.startedAt)} · {clinicName(visit.clinicId)}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            № {visitPatientCode(visit)} · {statusLabel(visit.status)}
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="min-h-11 shrink-0">
          <Link to={visitHref(visit)}>Открыть</Link>
        </Button>
      </div>
    </article>
  );
}

export default function VisitsPageDemo() {
  const visits = [...VISITS].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const currentVisit = visits.find((visit) => visit.status === "in_progress") ?? visits.find((visit) => visit.status === "scheduled") ?? visits[0];
  const todayCount = visits.length;
  const scheduledCount = visits.filter((visit) => visit.status === "scheduled").length;
  const closedCount = visits.filter((visit) => visit.status === "closed").length;

  return (
    <div className="flex h-full flex-col bg-surface-muted">
      <PageHeader
        title="Визиты"
        subtitle={`В расписании: ${todayCount}`}
        actions={
          <Button asChild size="sm" className="min-h-11 sm:min-h-9">
            <Link to="/capture">Съёмка</Link>
          </Button>
        }
      />
      <div className="space-y-4 px-6 py-6">
        <section
          role="note"
          aria-label="Режим работы расписания"
          className="surface-card flex items-start gap-3 px-4 py-3 text-row text-muted-foreground"
        >
          <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-medium text-foreground">Учебный режим:</span>{" "}
            расписание вымышленное, реальные данные пациентов не вводите.
          </span>
        </section>

        {currentVisit ? (
          <section
            role="region"
            aria-label="Что делать с визитами сейчас"
            className="surface-card flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase text-muted-foreground">Что делать сейчас</p>
              <h2 className="mt-1 text-base font-semibold text-foreground">Открыть текущий визит</h2>
              <p className="mt-1 text-row text-muted-foreground">
                Запланировано: {scheduledCount} · закрыто: {closedCount} · ближайший пациент: {visitPatientName(currentVisit)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11">
                <Link to={visitHref(currentVisit)}>Открыть визит</Link>
              </Button>
              <Button asChild variant="secondary" className="min-h-11">
                <Link to="/capture">Перейти к съёмке</Link>
              </Button>
            </div>
          </section>
        ) : null}

        <div className="flex max-w-xl items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <Input
            value=""
            readOnly
            className="min-h-11"
            aria-label="Поиск визита"
            placeholder="Поиск включается в рабочем режиме"
          />
        </div>

        <section className="surface-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
              Расписание
            </div>
            <div className="text-[12px] text-muted-foreground">Найдено: {visits.length}</div>
          </div>
          <div className="space-y-2 p-3 md:hidden">
            {visits.map((visit) => (
              <VisitCard key={visit.id} visit={visit} />
            ))}
          </div>
          <div className="hidden md:block">
          <div className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] border-b border-border px-4 py-3 text-[12px] font-medium text-muted-foreground">
            <div>Пациент</div>
            <div>Дата и время</div>
            <div>Клиника</div>
            <div>Статус</div>
            <div />
          </div>
          {visits.map((visit) => {
            const patient = getPatientById(visit.patientId);
            return (
              <div
                key={visit.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_110px_40px] items-center border-b border-border px-4 py-3 text-row last:border-b-0"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{patient?.fullName ?? "Пациент"}</div>
                  <div className="truncate text-muted-foreground">{formatCardNumber(patient?.code)}</div>
                </div>
                <div>{formatDateTime(visit.startedAt)}</div>
                <div className="truncate">{clinicName(visit.clinicId)}</div>
                <div>{statusLabel(visit.status)}</div>
                <Button asChild variant="ghost" size="icon" aria-label={`Открыть визит ${patient?.fullName ?? "пациента"}`}>
                  <Link to={visitHref(visit)}>›</Link>
                </Button>
              </div>
            );
          })}
          </div>
        </section>
      </div>
    </div>
  );
}
