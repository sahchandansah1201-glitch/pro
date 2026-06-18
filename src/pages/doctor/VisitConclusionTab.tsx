import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByLesionId,
  getImagesByVisitId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Patient, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
import { formatCardNumber } from "@/lib/card-number";
import { formatDate, formatDateTime } from "@/lib/format";
import { BODY_MAP_DEMO_NOW, bodyMapSurfaceLabel } from "@/pages/doctor/body-map-model";

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

function userName(id: string | null | undefined): string {
  if (!id) return "—";
  return Object.values(DEMO_USERS).find((u) => u.id === id)?.fullName ?? id;
}

function isLocalDraftId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("local-lesion-");
}

type QualityStatus = "ok" | "review" | "none";

function qualityStatus(images: ClinicalImage[]): QualityStatus {
  if (images.length === 0) return "none";
  const needsReview = images.some((i) => i.quality.score < 0.8 || i.quality.issues.length > 0);
  return needsReview ? "review" : "ok";
}

function qualityLabel(s: QualityStatus): string {
  if (s === "ok") return "готово";
  if (s === "review") return "нужна проверка";
  return "нет снимков";
}

interface Props {
  patient: Patient;
  visit: Visit;
  lesions: Lesion[];
}

export function VisitConclusionTab({ patient, visit, lesions }: Props) {
  const assessments = useMemo(() => getAssessmentsByVisitId(visit.id), [visit.id]);
  const visitImages = useMemo(() => getImagesByVisitId(visit.id), [visit.id]);
  const clinic = getClinicById(visit.clinicId);

  const [searchParams, setSearchParams] = useSearchParams();
  const lesionParam = searchParams.get("lesion");
  const isDraftParam = isLocalDraftId(lesionParam);

  const updateNav = (tab: string, lesionId?: string | null) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        if (lesionId) next.set("lesion", lesionId);
        else next.delete("lesion");
        return next;
      },
      { replace: false },
    );
  };

  const assessedIds = useMemo(() => new Set(assessments.map((a) => a.lesionId)), [assessments]);

  // Selection rules:
  // - valid persisted id from URL → use it
  // - local-lesion-* → do NOT treat as persisted (selectedLesion stays via fallback)
  // - invalid/missing → first persisted with assessment, else first persisted
  const fromParam =
    lesionParam && !isDraftParam ? lesions.find((l) => l.id === lesionParam) ?? null : null;
  const fallbackAssessed = lesions.find((l) => assessedIds.has(l.id)) ?? null;
  const selectedLesion: Lesion | null = fromParam ?? fallbackAssessed ?? lesions[0] ?? null;

  return (
    <div className="space-y-3">
      {isDraftParam && (
        <div
          role="status"
          className="rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground"
        >
          Локальный учебный очаг нужно сохранить в системе клиники перед заключением.
        </div>
      )}

      {/* Visit summary */}
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="mb-2 text-[13px] font-semibold">Сводка по визиту</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <Field term="Пациент" value={`${patient.fullName} · ${formatCardNumber(patient.code)}`} />
          <Field term="Статус" value={VISIT_STATUS[visit.status]} />
          <Field term="Дата визита" value={formatDate(visit.startedAt)} />
          <Field term="Врач" value={userName(visit.doctorId)} />
          <Field term="Клиника" value={clinic?.name ?? "—"} />
          <Field
            term="Образования"
            value={`всего ${lesions.length} · оценено ${
              lesions.filter((l) => assessedIds.has(l.id)).length
            }`}
          />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Visit-level checklist */}
        <section
          aria-label="Чек-лист по образованиям визита"
          className="rounded-md border border-border bg-surface lg:col-span-5"
        >
          <header className="flex items-center justify-between border-b border-border px-3 py-2">
            <h2 className="text-[13px] font-semibold">Чек-лист образований</h2>
            <span className="text-[12px] text-muted-foreground">{lesions.length} шт.</span>
          </header>
          {lesions.length === 0 ? (
            <div className="p-4 text-[13px] text-muted-foreground">
              У пациента не зарегистрировано образований.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {lesions.map((l) => {
                const has = assessedIds.has(l.id);
                const lImages = visitImages.filter((img) => img.lesionId === l.id);
                const q = qualityStatus(lImages);
                const isSel = selectedLesion?.id === l.id;
                return (
                  <li key={l.id}>
                    <button
                      type="button"
                      data-testid={`checklist-item-${l.id}`}
                      onClick={() => updateNav("conclusion", l.id)}
                      aria-pressed={isSel}
                      className={`flex min-h-[44px] w-full flex-col gap-1 px-3 py-2 text-left text-[13px] transition-colors sm:min-h-[40px] ${
                        isSel
                          ? "bg-[hsl(var(--primary-soft))] text-[hsl(var(--accent-foreground))]"
                          : "bg-surface hover:bg-surface-muted"
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-medium">{l.label}</span>
                        <span className="shrink-0 rounded-sm border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {LESION_STATUS[l.status]}
                        </span>
                      </div>
                      <div className="truncate text-[12px] text-muted-foreground">{l.bodyZone}</div>
                      <div className="flex flex-wrap gap-1">
                        <Chip tone={has ? "ok" : "warn"}>
                          {has ? "оценка готова" : "нет оценки"}
                        </Chip>
                        {q === "review" && <Chip tone="warn">нужен пересмотр снимков</Chip>}
                        {q === "none" && <Chip tone="muted">нет снимков</Chip>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Selected lesion panel */}
        <section
          aria-label="Контекст выбранного очага"
          className="space-y-3 lg:col-span-7"
        >
          {selectedLesion ? (
            <SelectedLesionPanel
              lesion={selectedLesion}
              assessment={assessments.find((a) => a.lesionId === selectedLesion.id) ?? null}
              images={visitImages.filter((img) => img.lesionId === selectedLesion.id)}
              onOpenAssessment={(id) => updateNav("assessment", id)}
              onOpenImaging={(id) => updateNav("imaging", id)}
              onOpenReport={(id) => updateNav("report", id)}
            />
          ) : (
            <div className="rounded-md border border-dashed border-border bg-surface p-4 text-[13px] text-muted-foreground">
              Нет образований для заключения.
            </div>
          )}

          <DemoConclusionForm
            key={selectedLesion?.id ?? "none"}
            onOpenReport={() =>
              updateNav("report", selectedLesion ? selectedLesion.id : null)
            }
          />
        </section>
      </div>

      <p className="text-[12px] text-muted-foreground">
        Заключение в учебном режиме показывает справочные данные. В реальной системе решение фиксируется врачом и попадает в журнал клиники.
      </p>
    </div>
  );
}

// ───────── Selected lesion panel ─────────

function SelectedLesionPanel({
  lesion,
  assessment,
  images,
  onOpenAssessment,
  onOpenImaging,
  onOpenReport,
}: {
  lesion: Lesion;
  assessment: Assessment | null;
  images: ClinicalImage[];
  onOpenAssessment: (id: string) => void;
  onOpenImaging: (id: string) => void;
  onOpenReport: (id: string) => void;
}) {
  const q = qualityStatus(images);
  const surface = lesion.mapPoint?.view ?? "front";

  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <Field term="Очаг" value={<span className="font-medium">{lesion.label}</span>} />
          <Field term="Зона тела" value={lesion.bodyZone} />
          <Field term="Поверхность / проекция" value={bodyMapSurfaceLabel(surface)} />
          <Field term="Статус образования" value={LESION_STATUS[lesion.status]} />
        </div>
        <div>
          <Field
            term="Снимков в визите"
            value={<span className="tabular-nums">{images.length}</span>}
          />
          <Field
            term="Качество снимков"
            value={
              <span
                data-testid="conclusion-quality-summary"
                className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${
                  q === "ok"
                    ? "border-border bg-surface-muted text-foreground"
                    : q === "review"
                      ? "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
                      : "border-dashed border-border bg-surface-muted text-muted-foreground"
                }`}
              >
                {qualityLabel(q)}
              </span>
            }
          />
          <Field
            term="Структурированная оценка"
            value={assessment ? "есть" : <span className="text-muted-foreground">нет</span>}
          />
        </div>
      </div>

      {assessment ? (
        <div className="mt-3 grid grid-cols-1 gap-2 rounded-sm border border-border bg-surface-muted p-3 sm:grid-cols-2">
          <Field
            term="Итог ABCD"
            value={<span className="tabular-nums">{assessment.abcd.total.toFixed(1)}</span>}
          />
          <Field
            term="Итог по семи признакам"
            value={<span className="tabular-nums">{assessment.sevenPoint.total}</span>}
          />
          <Field term="План наблюдения" value={assessment.followUpPlan || "—"} wide />
          <Field term="Комментарий врача" value={assessment.doctorConclusion || "—"} wide />
          <Field term="Когда" value={formatDateTime(assessment.decidedAt)} />
        </div>
      ) : (
        <div
          role="status"
          className="mt-3 rounded-sm border border-dashed border-[hsl(var(--risk-medium))] bg-surface-muted px-2 py-1.5 text-[12px]"
        >
          Перед заключением нужна структурированная оценка очага.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {assessment ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-[44px] sm:min-h-[32px]"
              onClick={() => onOpenAssessment(lesion.id)}
            >
              К оценке очага
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-[44px] sm:min-h-[32px]"
              onClick={() => onOpenImaging(lesion.id)}
            >
              К снимкам очага
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="min-h-[44px] sm:min-h-[32px]"
            onClick={() => onOpenAssessment(lesion.id)}
          >
            Перейти к оценке
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="default"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={() => onOpenReport(lesion.id)}
        >
          К отчёту по визиту
        </Button>
      </div>
    </div>
  );
}

// ───────── Demo conclusion form (local-only) ─────────

interface DemoConclusionDraft {
  clinicalSummary: string;
  followUpPlan: string;
  patientComment: string;
  createdAt: string;
}

function DemoConclusionForm({ onOpenReport }: { onOpenReport: () => void }) {
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [followUpPlan, setFollowUpPlan] = useState("");
  const [patientComment, setPatientComment] = useState("");
  const [saved, setSaved] = useState<DemoConclusionDraft | null>(null);

  const onSave = () => {
    setSaved({
      clinicalSummary: clinicalSummary.trim(),
      followUpPlan: followUpPlan.trim(),
      patientComment: patientComment.trim(),
      createdAt: BODY_MAP_DEMO_NOW,
    });
  };

  return (
    <section
      aria-label="Локальное учебное заключение"
      className="rounded-md border border-border bg-surface p-3"
    >
      <h2 className="mb-2 text-[13px] font-semibold">Локальное учебное заключение</h2>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Форма существует только в UI текущего визита. Данные не сохраняются на сервере.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <FormField id="demo-conc-summary" label="Клиническое резюме">
          <Textarea
            id="demo-conc-summary"
            value={clinicalSummary}
            onChange={(e) => setClinicalSummary(e.target.value)}
            rows={2}
            placeholder="Например: структурные изменения, рекомендован очный осмотр специалистом."
          />
        </FormField>
        <FormField id="demo-conc-followup" label="План наблюдения">
          <Input
            id="demo-conc-followup"
            value={followUpPlan}
            onChange={(e) => setFollowUpPlan(e.target.value)}
            placeholder="Контроль через 3 мес., повторная дерматоскопия."
            className="min-h-[44px] sm:min-h-[32px]"
          />
        </FormField>
        <FormField id="demo-conc-patient" label="Комментарий для пациента">
          <Textarea
            id="demo-conc-patient"
            value={patientComment}
            onChange={(e) => setPatientComment(e.target.value)}
            rows={3}
            placeholder="Безопасная формулировка для пациента: «требуется дополнительный осмотр»."
          />
        </FormField>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={onSave}
        >
          Сохранить учебное заключение
        </Button>
        <span className="text-[11px] text-muted-foreground">
          Локально, без сети и хранилища.
        </span>
      </div>

      {saved && (
        <div
          role="status"
          data-testid="demo-conclusion-preview"
          className="mt-3 space-y-3"
        >
          <div className="rounded-md border border-border bg-surface-muted p-3 text-[12px]">
            <div className="mb-1 text-[12px] font-medium">Демо-заключение создано локально</div>
            <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
              <dt className="text-muted-foreground">Клиническое резюме</dt>
              <dd className="sm:col-span-2">{saved.clinicalSummary || "—"}</dd>
              <dt className="text-muted-foreground">План наблюдения</dt>
              <dd className="sm:col-span-2">{saved.followUpPlan || "—"}</dd>
              <dt className="text-muted-foreground">Комментарий для пациента</dt>
              <dd className="sm:col-span-2">{saved.patientComment || "—"}</dd>
              <dt className="text-muted-foreground">Время (демо)</dt>
              <dd className="tabular-nums sm:col-span-2">{formatDateTime(saved.createdAt)}</dd>
            </dl>
          </div>

          {/* Patient-facing safe preview: shows ONLY plain-language patient comment. */}
          <div
            data-testid="patient-facing-preview"
            className="rounded-md border border-border bg-surface p-3 text-[13px]"
          >
            <div className="mb-1 text-[12px] font-medium text-muted-foreground">
              Что увидит пациент
            </div>
            <p className="whitespace-pre-wrap text-foreground">
              {saved.patientComment ||
                "Текст для пациента не заполнен. Пациент увидит общий шаблон рекомендации."}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Превью не содержит внутренних оценок, ссылок и технических деталей.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-[44px] sm:min-h-[32px]"
              onClick={onOpenReport}
            >
              К отчёту по визиту
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────── Small UI helpers ─────────

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "muted";
}) {
  const cls =
    tone === "ok"
      ? "border-border bg-surface-muted text-foreground"
      : tone === "warn"
        ? "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
        : "border-dashed border-border bg-surface-muted text-muted-foreground";
  return (
    <span className={`rounded-sm border px-1.5 py-0.5 text-[11px] ${cls}`}>{children}</span>
  );
}

function FormField({
  id,
  label,
  className,
  children,
}: {
  id: string;
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className ?? ""}>
      <label htmlFor={id} className="mb-1 block text-[12px] font-medium text-muted-foreground">
        {label}
      </label>
      {children}
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
