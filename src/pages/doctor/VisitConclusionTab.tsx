import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByLesionId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Patient, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
import { formatDate, formatDateTime } from "@/lib/format";

const VISIT_STATUS: Record<Visit["status"], string> = {
  scheduled: "Запланирован",
  in_progress: "В работе",
  closed: "Закрыт",
  cancelled: "Отменён",
};

const LESION_STATUS: Record<Lesion["status"], string> = {
  active: "Активное",
  monitoring: "Наблюдение",
  removed: "Удалено",
  archived: "Архив",
};

const ROUTE_OPTIONS: Array<{ id: "follow_up" | "repeat_photo" | "procedure"; label: string }> = [
  { id: "follow_up", label: "Контрольный осмотр" },
  { id: "repeat_photo", label: "Повторная съёмка" },
  { id: "procedure", label: "Процедура / биопсия" },
];

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

function imageQualitySummary(images: ClinicalImage[]): { needsReview: number; total: number } {
  let needsReview = 0;
  for (const img of images) {
    if (img.quality.score < 0.8 || img.quality.issues.length > 0) needsReview += 1;
  }
  return { needsReview, total: images.length };
}

interface Props {
  patient: Patient;
  visit: Visit;
  lesions: Lesion[];
}

export function VisitConclusionTab({ patient, visit, lesions }: Props) {
  const assessments = useMemo(() => getAssessmentsByVisitId(visit.id), [visit.id]);
  const clinic = getClinicById(visit.clinicId);

  const [selectedRoute, setSelectedRoute] = useState<typeof ROUTE_OPTIONS[number]["id"] | null>(
    null,
  );

  const visitLesions = useMemo(() => {
    const ids = new Set(assessments.map((a) => a.lesionId));
    const inVisit = lesions.filter((l) => ids.has(l.id));
    // include other patient lesions only as "no assessment" if assessments empty
    return inVisit.length > 0 ? inVisit : lesions;
  }, [assessments, lesions]);

  const assessedCount = assessments.length;
  const withoutAssessment = visitLesions.filter(
    (l) => !assessments.some((a) => a.lesionId === l.id),
  ).length;

  const followUps = assessments
    .map((a) => a.followUpPlan)
    .filter((s) => s && s.trim().length > 0);

  return (
    <div className="space-y-3">
      {/* Visit decision summary */}
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="mb-2 text-[13px] font-semibold">Сводка по визиту</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <Field term="Пациент" value={`${patient.fullName} · ${patient.code}`} />
          <Field term="Статус" value={VISIT_STATUS[visit.status]} />
          <Field term="Дата визита" value={formatDate(visit.startedAt)} />
          <Field term="Врач" value={userName(visit.doctorId)} />
          <Field term="Клиника" value={clinic?.name ?? "—"} />
          <Field
            term="Образования"
            value={`оценено ${assessedCount} · без оценки ${withoutAssessment}`}
          />
        </dl>
      </section>

      {/* Per-lesion conclusions */}
      <section className="rounded-md border border-border bg-surface">
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <h2 className="text-[13px] font-semibold">Заключения по образованиям</h2>
          <span className="text-[12px] text-muted-foreground">{visitLesions.length} шт.</span>
        </header>

        {assessments.length === 0 ? (
          <div className="p-4 text-[13px] text-muted-foreground">
            По визиту пока нет структурированных оценок. Вернитесь на вкладку «Оценка».
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visitLesions.map((lesion) => {
              const a: Assessment | undefined = assessments.find((x) => x.lesionId === lesion.id);
              const images = getImagesByLesionId(lesion.id);
              const q = imageQualitySummary(images);
              return (
                <li key={lesion.id} className="space-y-2 px-3 py-3 text-[13px]">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{lesion.label}</div>
                      <div className="truncate text-[12px] text-muted-foreground">
                        {lesion.bodyZone} · {LESION_STATUS[lesion.status]}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      Снимки: {q.total} · к проверке: {q.needsReview}
                    </span>
                  </div>

                  {a ? (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field
                        term="ABCD / TDS"
                        value={`A ${a.abcd.asymmetry} · B ${a.abcd.border} · C ${a.abcd.color} · D ${a.abcd.diameter} · TDS ${a.abcd.total.toFixed(1)}`}
                      />
                      <Field term="7-point" value={`сумма ${a.sevenPoint.total}`} />
                      <Field
                        term="Решение"
                        value={a.doctorConclusion || "—"}
                        wide
                      />
                      <Field term="План наблюдения" value={a.followUpPlan || "—"} wide />
                      <Field term="Зафиксировано" value={formatDateTime(a.decidedAt)} />
                    </div>
                  ) : (
                    <div className="rounded-sm border border-dashed border-border bg-surface-muted px-2 py-1.5 text-[12px] text-muted-foreground">
                      Структурированная оценка не зафиксирована.
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Route panel */}
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="mb-2 text-[13px] font-semibold">Маршрут и план наблюдения</h2>
        {followUps.length > 0 ? (
          <ul className="mb-3 space-y-1 text-[13px]">
            {followUps.map((f, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" aria-hidden />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mb-3 text-[12px] text-muted-foreground">
            План наблюдения не зафиксирован.
          </div>
        )}

        <div className="flex flex-wrap gap-2" role="group" aria-label="Демо-маршрут">
          {ROUTE_OPTIONS.map((opt) => {
            const active = selectedRoute === opt.id;
            return (
              <Button
                key={opt.id}
                type="button"
                size="sm"
                variant={active ? "default" : "secondary"}
                className="min-h-[44px] text-[13px] sm:min-h-9"
                aria-pressed={active}
                onClick={() => setSelectedRoute(active ? null : opt.id)}
              >
                {opt.label}
              </Button>
            );
          })}
        </div>
        {selectedRoute && (
          <div
            role="status"
            aria-live="polite"
            className="mt-2 text-[12px] text-muted-foreground"
          >
            Выбрано (демо): {ROUTE_OPTIONS.find((o) => o.id === selectedRoute)?.label}. Данные не сохраняются.
          </div>
        )}
      </section>

      <p className="text-[12px] text-muted-foreground">
        Заключение в MVP отображает мок-данные. В реальной системе решение фиксируется врачом и попадает в аудит.
      </p>
    </div>
  );
}

function Field({
  term,
  value,
  wide,
}: {
  term: string;
  value: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
