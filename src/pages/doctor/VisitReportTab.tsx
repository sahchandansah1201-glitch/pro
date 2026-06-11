import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAssessmentsByVisitId,
  getAuditLogs,
  getClinicById,
  getImagesByVisitId,
  getReportByVisitId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Patient, Report, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
import { formatDate, formatDateTime } from "@/lib/format";
import { getReportLinkExpiry, getReportSafeText } from "@/lib/report-access";
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
  const needsReview = images.some(
    (i) => i.quality.score < 0.8 || i.quality.issues.length > 0,
  );
  return needsReview ? "review" : "ok";
}

function qualityLabel(s: QualityStatus): string {
  if (s === "ok") return "хорошее качество";
  if (s === "review") return "требует проверки";
  return "нет снимков";
}

function backendMissingLabel(item: string): string {
  if (item === "Нужно переснять или проверить качество") {
    return "качество снимков требует проверки перед сборкой отчёта";
  }
  return item;
}

const IMAGE_KIND_LABEL: Record<ClinicalImage["kind"], string> = {
  overview: "обзор",
  dermoscopy: "дерматоскопия",
  macro: "крупный план",
  body_map: "карта тела",
};

function imageKindSummary(images: ClinicalImage[]): string {
  if (images.length === 0) return "нет выбранных снимков";
  const counts = images.reduce<Record<ClinicalImage["kind"], number>>(
    (acc, image) => {
      acc[image.kind] += 1;
      return acc;
    },
    { overview: 0, dermoscopy: 0, macro: 0, body_map: 0 },
  );

  return (Object.keys(counts) as ClinicalImage["kind"][])
    .filter((kind) => counts[kind] > 0)
    .map((kind) => `${IMAGE_KIND_LABEL[kind]} ${counts[kind]}`)
    .join(" · ");
}

function imagePackageLabel(image: ClinicalImage, index: number): string {
  return `Снимок ${index + 1} · ${IMAGE_KIND_LABEL[image.kind]}`;
}

interface Props {
  patient: Patient;
  visit: Visit;
  lesions: Lesion[];
}

export function VisitReportTab({ patient, visit, lesions }: Props) {
  const assessments = useMemo(() => getAssessmentsByVisitId(visit.id), [visit.id]);
  const visitImages = useMemo(() => getImagesByVisitId(visit.id), [visit.id]);
  const report = useMemo(() => getReportByVisitId(visit.id), [visit.id]);
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

  const assessedIds = useMemo(
    () => new Set(assessments.map((a) => a.lesionId)),
    [assessments],
  );

  const fromParam =
    lesionParam && !isDraftParam ? lesions.find((l) => l.id === lesionParam) ?? null : null;
  const fallbackAssessed = lesions.find((l) => assessedIds.has(l.id)) ?? null;
  const selectedLesion: Lesion | null = fromParam ?? fallbackAssessed ?? lesions[0] ?? null;

  const selImages = selectedLesion
    ? visitImages.filter((img) => img.lesionId === selectedLesion.id)
    : [];
  const selAssessment = selectedLesion
    ? assessments.find((a) => a.lesionId === selectedLesion.id) ?? null
    : null;
  const q = qualityStatus(selImages);

  const checklist = {
    hasContext: Boolean(patient && visit),
    hasLesions: lesions.length > 0,
    hasAssessments: assessments.length > 0,
    selectedHasAssessment: Boolean(selAssessment),
    hasImages: selImages.length > 0,
    qualityOk: q === "ok",
  };

  return (
    <div className="space-y-3">
      {isDraftParam && (
        <div
          role="status"
          className="rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-[12px] text-muted-foreground"
        >
          Локальный учебный очаг нужно сохранить в системе клиники перед отчётом.
        </div>
      )}

      {/* Visit summary */}
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="mb-2 text-[13px] font-semibold">Контекст отчёта</h2>
        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
          <Field term="Пациент" value={`${patient.fullName} · ${patient.code}`} />
          <Field term="Статус визита" value={VISIT_STATUS[visit.status]} />
          <Field term="Дата визита" value={formatDate(visit.startedAt)} />
          <Field term="Врач" value={userName(visit.doctorId)} />
          <Field term="Клиника" value={clinic?.name ?? "—"} />
          <Field
            term="Образования"
            value={`всего ${lesions.length} · оценено ${
              lesions.filter((l) => assessedIds.has(l.id)).length
            }`}
          />
        </div>
      </section>

      {/* Readiness checklist */}
      <section
        aria-label="Готовность к отчёту"
        className="rounded-md border border-border bg-surface p-3"
      >
        <h2 className="mb-2 text-[13px] font-semibold">Готовность к отчёту</h2>
        <ul className="grid grid-cols-1 gap-1 text-[12px] sm:grid-cols-2">
          <ChecklistItem ok={checklist.hasContext}>Пациент и визит загружены</ChecklistItem>
          <ChecklistItem ok={checklist.hasLesions}>Образования визита</ChecklistItem>
          <ChecklistItem ok={checklist.hasAssessments}>Структурированные оценки</ChecklistItem>
          <ChecklistItem ok={checklist.selectedHasAssessment}>
            Оценка для выбранного очага
          </ChecklistItem>
          <ChecklistItem ok={checklist.hasImages}>Снимки выбранного очага</ChecklistItem>
          <ChecklistItem ok={checklist.qualityOk}>Качество снимков (без ревизии)</ChecklistItem>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Selected lesion summary */}
        <section
          aria-label="Контекст выбранного очага"
          className="space-y-3 lg:col-span-7"
        >
          {selectedLesion ? (
            <SelectedLesionPanel
              lesion={selectedLesion}
              assessment={selAssessment}
              images={selImages}
              onOpenAssessment={(id) => updateNav("assessment", id)}
              onOpenImaging={(id) => updateNav("imaging", id)}
              onOpenConclusion={(id) => updateNav("conclusion", id)}
            />
          ) : (
            <div className="rounded-md border border-dashed border-border bg-surface p-4 text-[13px] text-muted-foreground">
              Нет образований для отчёта.
            </div>
          )}

          <DemoReportForm
            key={selectedLesion?.id ?? "none"}
            assessment={selAssessment}
          />

          <VisitPacketPanel
            patient={patient}
            visit={visit}
            lesion={selectedLesion}
            report={report}
            images={selImages}
            assessment={selAssessment}
          />
        </section>

        {/* Internal block */}
        <section
          aria-label="Внутренний блок врача"
          className="rounded-md border border-border bg-surface p-3 lg:col-span-5"
        >
          <h2 className="mb-2 text-[13px] font-semibold">Внутренний блок врача</h2>
          {selAssessment ? (
            <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[12px]">
              <Field
                term="Оценка ABCD"
                value={
                  <span className="tabular-nums">
                    {selAssessment.abcd.total.toFixed(1)}
                  </span>
                }
              />
              <Field
                term="Оценка 7 признаков"
                value={
                  <span className="tabular-nums">{selAssessment.sevenPoint.total}</span>
                }
              />
              <Field
                term="План наблюдения"
                value={selAssessment.followUpPlan || "—"}
              />
              <Field
                term="Внутренний комментарий"
                value={selAssessment.doctorConclusion || "—"}
              />
              <Field
                term="Зафиксировано"
                value={formatDateTime(selAssessment.decidedAt)}
              />
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">
              Для выбранного очага нет структурированной оценки.
            </p>
          )}
          <p className="mt-2 text-[11px] text-muted-foreground">
            Внутренний блок не выгружается пациенту и не содержит ссылок и файловых
            идентификаторов.
          </p>
        </section>
      </div>

      <p className="text-[12px] text-muted-foreground">
        Учебный отчёт отображает учебные данные. Реальная сборка отчёта и отправка
        пациенту будут подключены через систему клиники.
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
  onOpenConclusion,
}: {
  lesion: Lesion;
  assessment: Assessment | null;
  images: ClinicalImage[];
  onOpenAssessment: (id: string) => void;
  onOpenImaging: (id: string) => void;
  onOpenConclusion: (id: string) => void;
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
          <Field term="Статус" value={LESION_STATUS[lesion.status]} />
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
                data-testid="report-quality-summary"
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
            term="Оценка ABCD"
            value={<span className="tabular-nums">{assessment.abcd.total.toFixed(1)}</span>}
          />
          <Field
            term="Оценка 7 признаков"
            value={<span className="tabular-nums">{assessment.sevenPoint.total}</span>}
          />
          <Field term="План наблюдения" value={assessment.followUpPlan || "—"} wide />
          <Field term="Комментарий врача" value={assessment.doctorConclusion || "—"} wide />
        </div>
      ) : (
        <div
          role="status"
          className="mt-3 rounded-sm border border-dashed border-[hsl(var(--risk-medium))] bg-surface-muted px-2 py-1.5 text-[12px]"
        >
          Перед отчётом нужна структурированная оценка очага.
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {assessment ? (
          <>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11"
              onClick={() => onOpenAssessment(lesion.id)}
            >
              К оценке очага
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11"
              onClick={() => onOpenConclusion(lesion.id)}
            >
              К заключению по визиту
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="min-h-11"
              onClick={() => onOpenImaging(lesion.id)}
            >
              К снимкам очага
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            onClick={() => onOpenAssessment(lesion.id)}
          >
            Перейти к оценке
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────── Demo report form (local-only) ─────────

interface DemoReportDraft {
  title: string;
  patientText: string;
  internalNote: string;
  createdAt: string;
}


// ───────── Patient text validation & templates ─────────

export const PATIENT_TEXT_MAX_CHARS = 1000;
export const PATIENT_TEXT_MAX_LINES = 20;
export const PATIENT_TEXT_MAX_LINE_LEN = 200;

/**
 * Normalize line breaks and whitespace so the editor produces predictable
 * output regardless of where the doctor pasted the text from.
 */
export function normalizePatientText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\u00A0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^\n+|\n+$/g, "");
}

const patientTextSchema = z
  .string()
  .trim()
  .min(1, { message: "Текст для пациента не может быть пустым." })
  .max(PATIENT_TEXT_MAX_CHARS, {
    message: `Не более ${PATIENT_TEXT_MAX_CHARS} символов.`,
  })
  .refine((v) => !/[<>]/.test(v), { message: "Символы < и > запрещены." })
  .refine((v) => v.split("\n").length <= PATIENT_TEXT_MAX_LINES, {
    message: `Не более ${PATIENT_TEXT_MAX_LINES} строк.`,
  })
  .refine(
    (v) => v.split("\n").every((l) => l.length <= PATIENT_TEXT_MAX_LINE_LEN),
    { message: `В одной строке не более ${PATIENT_TEXT_MAX_LINE_LEN} символов.` },
  );

export interface PatientTextValidation {
  ok: boolean;
  errors: string[];
  chars: number;
  lines: number;
}

export function validatePatientText(raw: string): PatientTextValidation {
  const normalized = normalizePatientText(raw);
  const result = patientTextSchema.safeParse(normalized);
  return {
    ok: result.success,
    errors: result.success ? [] : result.error.issues.map((i) => i.message),
    chars: normalized.length,
    lines: normalized.length === 0 ? 0 : normalized.split("\n").length,
  };
}

interface PatientTemplate {
  id: string;
  label: string;
  body: string;
}

const PATIENT_TEMPLATES: PatientTemplate[] = [
  {
    id: "monitoring",
    label: "Наблюдение через 3 месяца",
    body:
      "По итогам осмотра рекомендуется наблюдение очага.\n" +
      "Пожалуйста, запишитесь на повторный осмотр через 3 месяца.\n" +
      "При появлении изменений (рост, изменение цвета, зуд, кровоточивость) — обратитесь раньше.",
  },
  {
    id: "in-person",
    label: "Очный осмотр требуется",
    body:
      "По снимкам однозначное заключение сделать нельзя.\n" +
      "Рекомендуется очный осмотр у дерматолога для уточнения.\n" +
      "Это не диагноз, а рекомендация для дополнительной проверки.",
  },
  {
    id: "urgent",
    label: "Срочная консультация",
    body:
      "Рекомендуется записаться на консультацию в ближайшие дни.\n" +
      "Это решение принято для дополнительной проверки и не означает диагноз.\n" +
      "Администратор клиники поможет выбрать удобное время.",
  },
  {
    id: "self-care",
    label: "Самонаблюдение и фотофиксация",
    body:
      "Очаг не требует срочных действий.\n" +
      "Рекомендуется самонаблюдение: раз в месяц делать фото в одинаковом освещении.\n" +
      "При любых заметных изменениях — записаться на осмотр.",
  },
];

function DemoReportForm({
  assessment,
}: {
  assessment: Assessment | null;
}) {
  const [title, setTitle] = useState("");
  const [patientText, setPatientText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saved, setSaved] = useState<DemoReportDraft | null>(null);

  const validation = useMemo(() => validatePatientText(patientText), [patientText]);

  const applyTemplate = (tpl: PatientTemplate, mode: "replace" | "append") => {
    setPatientText((prev) => {
      const base = mode === "replace" || prev.trim() === "" ? "" : prev + "\n\n";
      return normalizePatientText(base + tpl.body);
    });
  };

  const onNormalize = () => {
    setPatientText((prev) => normalizePatientText(prev));
  };

  const onSave = () => {
    if (!validation.ok) return;
    setSaved({
      title: title.trim(),
      patientText: normalizePatientText(patientText),
      internalNote: internalNote.trim(),
      createdAt: BODY_MAP_DEMO_NOW,
    });
  };

  return (
    <section
      aria-label="Локальный учебный отчёт"
      className="rounded-md border border-border bg-surface p-3"
    >
      <h2 className="mb-2 text-[13px] font-semibold">Локальный учебный отчёт</h2>
      <p className="mb-3 text-[12px] text-muted-foreground">
        Форма существует только в UI. Данные не сохраняются на сервере.
      </p>

      <div className="grid grid-cols-1 gap-3">
        <FormField id="demo-report-title" label="Заголовок отчёта">
          <Input
            id="demo-report-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: Отчёт по визиту от 04.05.2026"
            maxLength={200}
            className="min-h-11"
          />
        </FormField>

        <FormField id="demo-report-patient" label="Текст для пациента">
          <div
            className="mb-2 flex flex-wrap gap-1.5"
            aria-label="Шаблоны текста для пациента"
          >
            {PATIENT_TEMPLATES.map((tpl) => (
              <div
                key={tpl.id}
                className="inline-flex overflow-hidden rounded-sm border border-border"
              >
                <button
                  type="button"
                  data-testid={`tpl-${tpl.id}-replace`}
                  onClick={() => applyTemplate(tpl, "replace")}
                  className="min-h-11 bg-surface px-2 py-1 text-[12px] hover:bg-surface-muted"
                  title="Заменить текст шаблоном"
                >
                  {tpl.label}
                </button>
                <button
                  type="button"
                  data-testid={`tpl-${tpl.id}-append`}
                  onClick={() => applyTemplate(tpl, "append")}
                  className="min-h-[44px] min-w-[44px] border-l border-border bg-surface-muted px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
                  title="Добавить шаблон в конец"
                  aria-label={`Добавить шаблон: ${tpl.label}`}
                >
                  +
                </button>
              </div>
            ))}
            <button
              type="button"
              data-testid="patient-text-normalize"
              onClick={onNormalize}
              className="min-h-11 rounded-sm border border-dashed border-border bg-surface px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              Нормализовать переносы
            </button>
          </div>

          <Textarea
            id="demo-report-patient"
            value={patientText}
            onChange={(e) => setPatientText(e.target.value)}
            rows={6}
            maxLength={PATIENT_TEXT_MAX_CHARS + 200}
            aria-invalid={!validation.ok && patientText.length > 0}
            aria-describedby="demo-report-patient-help demo-report-patient-errors"
            placeholder="Безопасная формулировка для пациента: «требуется дополнительное наблюдение»."
            className="font-mono"
          />

          <div
            id="demo-report-patient-help"
            data-testid="patient-text-counter"
            className="mt-1 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground"
          >
            <span>
              Лимиты: до {PATIENT_TEXT_MAX_CHARS} символов, до{" "}
              {PATIENT_TEXT_MAX_LINES} строк, до {PATIENT_TEXT_MAX_LINE_LEN} симв./строку.
              Символы &lt;, &gt; запрещены.
            </span>
            <span className="tabular-nums">
              {validation.chars}/{PATIENT_TEXT_MAX_CHARS} симв. ·{" "}
              {validation.lines}/{PATIENT_TEXT_MAX_LINES} строк
            </span>
          </div>
          {!validation.ok && patientText.length > 0 && (
            <ul
              id="demo-report-patient-errors"
              role="alert"
              data-testid="patient-text-errors"
              className="mt-1 list-inside list-disc text-[11px] text-[hsl(var(--risk-high))]"
            >
              {validation.errors.map((msg, idx) => (
                <li key={idx}>{msg}</li>
              ))}
            </ul>
          )}
        </FormField>

        <FormField id="demo-report-internal" label="Внутренняя заметка врача">
          <Textarea
            id="demo-report-internal"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={2}
            maxLength={2000}
            placeholder="Внутренний контекст: дифференциальная диагностика, план."
          />
        </FormField>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="min-h-11"
          disabled={!validation.ok}
          onClick={onSave}
        >
          Сформировать учебный отчёт
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled
          className="min-h-11"
        >
          Печать недоступна
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled
          aria-disabled
          data-testid="send-to-patient-demo"
          className="min-h-11"
        >
          Отправка недоступна
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Отправка и печать будут подключены через систему клиники.
      </p>

      {saved && (
        <div role="status" data-testid="demo-report-preview" className="mt-3 space-y-3">
          <div className="rounded-md border border-border bg-surface-muted p-3 text-[12px]">
            <div className="mb-1 text-[12px] font-medium">Учебный отчёт сформирован локально</div>
            <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
              <dt className="text-muted-foreground">Заголовок</dt>
              <dd className="sm:col-span-2">{saved.title || "—"}</dd>
              <dt className="text-muted-foreground">Время создания</dt>
              <dd className="tabular-nums sm:col-span-2">{formatDateTime(saved.createdAt)}</dd>
            </dl>
          </div>

          {/* Patient-facing safe preview */}
          <div
            data-testid="patient-facing-preview"
            className="rounded-md border border-border bg-surface p-3 text-[13px]"
          >
            <div className="mb-1 text-[12px] font-medium text-muted-foreground">
              Что увидит пациент
            </div>
            <p className="whitespace-pre-wrap text-foreground">
              {saved.patientText ||
                "Текст для пациента не заполнен. Пациент увидит общий шаблон рекомендации."}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Превью не содержит оценочных баллов, заметок алгоритма, защищённых ссылок,
              путей к файлам и внутренних заметок врача.
            </p>
          </div>

          {/* Internal preview */}
          <div
            data-testid="internal-doctor-preview"
            className="rounded-md border border-border bg-surface p-3 text-[13px]"
          >
            <div className="mb-1 text-[12px] font-medium text-muted-foreground">
              Внутренний блок врача
            </div>
            {assessment ? (
              <div className="grid grid-cols-1 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-2">
                <Field
                  term="Оценка ABCD"
                  value={
                    <span className="tabular-nums">{assessment.abcd.total.toFixed(1)}</span>
                  }
                />
                <Field
                  term="Оценка 7 признаков"
                  value={<span className="tabular-nums">{assessment.sevenPoint.total}</span>}
                />
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Структурированной оценки нет.
              </p>
            )}
            <p className="mt-2 whitespace-pre-wrap text-[13px] text-foreground">
              {saved.internalNote || "Внутренняя заметка не заполнена."}
            </p>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Без защищённых ссылок, токенов и файловых ссылок.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────── Patient Visit Packet (local-only release gate) ─────────

type PacketState = "draft" | "released" | "revoked";
type BackendJobState = "idle" | "prepared";
type PhotoHandoffState = "idle" | "prepared";

const QR_PATTERN: number[][] = [
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 0, 1, 1, 0, 1],
  [1, 1, 1, 1, 0, 1, 1, 1, 1],
  [0, 0, 1, 0, 1, 0, 0, 1, 0],
  [1, 0, 0, 1, 1, 1, 0, 0, 1],
  [0, 1, 0, 0, 1, 0, 1, 0, 0],
  [1, 1, 1, 0, 1, 1, 1, 1, 1],
  [1, 0, 1, 1, 0, 0, 1, 0, 1],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
];

function VisitPacketPanel({
  patient,
  visit,
  lesion,
  report,
  images,
  assessment,
}: {
  patient: Patient;
  visit: Visit;
  lesion: Lesion | null;
  report: Report | undefined;
  images: ClinicalImage[];
  assessment: Assessment | null;
}) {
  const imageIds = useMemo(() => images.map((image) => image.id), [images]);
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>(() =>
    images.map((image) => image.id),
  );
  const [packetState, setPacketState] = useState<PacketState>("draft");
  const [backendJobState, setBackendJobState] = useState<BackendJobState>("idle");
  const [photoHandoffState, setPhotoHandoffState] = useState<PhotoHandoffState>("idle");
  const [auditRows, setAuditRows] = useState<string[]>([]);

  useEffect(() => {
    setSelectedImageIds(imageIds);
    setPacketState("draft");
    setBackendJobState("idle");
    setPhotoHandoffState("idle");
    setAuditRows([]);
  }, [imageIds]);

  const selectedImages = images.filter((image) => selectedImageIds.includes(image.id));
  const selectedQuality = qualityStatus(selectedImages);
  const patientText = report ? getReportSafeText(report) : "";
  const expiresAt = report ? getReportLinkExpiry(report) : "";
  const generatedAuditRows = useMemo(() => {
    if (!report) return [];
    const actions = getAuditLogs().filter(
      (row) => row.entity === "report" && row.entityId === report.id,
    );
    return actions.map((row) => {
      const label = row.action === "report.generate"
        ? "Отчёт сформирован"
        : row.action === "report.share"
          ? "Доступ пациенту выдан"
          : "Действие с отчётом";
      return `${label} · ${formatDateTime(row.createdAt)}`;
    });
  }, [report]);

  const missing = [
    !report || !patientText ? "нет безопасного текста для пациента" : null,
    !assessment ? "нет врачебной оценки очага" : null,
    selectedImages.length === 0 ? "выберите снимки для пакета" : null,
    selectedQuality === "review" ? "Нужно переснять или проверить качество" : null,
    selectedQuality === "none" ? "нет выбранных снимков" : null,
    !patient.consents.telemed ? "нет согласия на дистанционный доступ" : null,
    visit.status !== "closed" ? "визит ещё не закрыт" : null,
  ].filter(Boolean) as string[];
  const reportPackageReady = missing.length === 0;
  const canRelease = reportPackageReady && packetState !== "released";
  const photoReleaseMissing = [
    !report || !patientText ? "нет безопасного текста для пациента" : null,
    !assessment ? "нет врачебной оценки очага" : null,
    selectedImages.length === 0 ? "врач не выбрал снимки" : null,
    selectedQuality === "review" ? "качество фото требует проверки" : null,
    selectedQuality === "none" ? "нет выбранных снимков" : null,
    !patient.consents.imaging ? "нет согласия на медицинскую съёмку" : null,
    !patient.consents.telemed ? "нет согласия на дистанционный доступ" : null,
    !expiresAt ? "не задан срок доступа" : null,
  ].filter(Boolean) as string[];
  const photoMetadataReady = photoReleaseMissing.length === 0;
  const photoBackendBlocker = "нужна система клиники для файлов и журнала доступа";
  const photoAccessStatus = photoMetadataReady
    ? "Данные фото готовы для системы клиники"
    : "Доступ к фото заблокирован";

  const selectedLabel = selectedImages.length === 0
    ? "нет выбранных снимков"
    : `${selectedImages.length} из ${images.length}`;
  const qualityCopy =
    selectedQuality === "ok"
      ? "ок"
      : selectedQuality === "review"
        ? "проверка качества требуется"
        : "нет снимков";
  const stateLabel =
    packetState === "released"
      ? "Выпущен"
      : packetState === "revoked"
        ? "Отозван"
        : canRelease
          ? "Готов к выпуску"
          : "Выпуск заблокирован";

  const toggleImage = (imageId: string) => {
    setSelectedImageIds((prev) =>
      prev.includes(imageId) ? prev.filter((id) => id !== imageId) : [...prev, imageId],
    );
  };

  const releasePacket = () => {
    if (!canRelease) return;
    setPacketState("released");
    setAuditRows((prev) => [`Доступ пациенту выдан · ${formatDateTime(BODY_MAP_DEMO_NOW)}`, ...prev]);
  };

  const revokePacket = () => {
    setPacketState("revoked");
    setAuditRows((prev) => [`Отзыв доступа · ${formatDateTime(BODY_MAP_DEMO_NOW)}`, ...prev]);
  };

  const prepareBackendJob = () => {
    if (!reportPackageReady) return;
    setBackendJobState("prepared");
    setAuditRows((prev) => [
      `Задача отчёта подготовлена · ${formatDateTime(BODY_MAP_DEMO_NOW)}`,
      ...prev,
    ]);
  };

  const preparePhotoHandoff = () => {
    if (!photoMetadataReady) return;
    setPhotoHandoffState("prepared");
    setAuditRows((prev) => [
      `Метаданные фото подготовлены · ${formatDateTime(BODY_MAP_DEMO_NOW)}`,
      ...prev,
    ]);
  };

  return (
    <section
      aria-label="Пакет визита пациенту"
      className="rounded-md border border-border bg-surface p-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold">Пакет визита пациенту</h2>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Врач выпускает пациенту только проверенный текст, выбранные снимки и срок доступа.
          </p>
        </div>
        <span
          className={`rounded-sm border px-2 py-1 text-[12px] font-medium ${
            canRelease || packetState === "released"
              ? "border-border bg-surface-muted text-foreground"
              : "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
          }`}
        >
          {stateLabel}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
        <Field term="Очаг" value={lesion ? lesion.label : "—"} />
        <Field term="Выбранные снимки" value={selectedLabel} />
        <Field term="Качество снимков" value={qualityCopy} />
        <Field term="Текст для пациента" value={patientText ? "есть" : "нет"} />
        <Field term="Согласие на доступ" value={patient.consents.telemed ? "есть" : "нет"} />
        <Field term="Срок ссылки" value={expiresAt ? formatDateTime(expiresAt) : "—"} />
      </div>

      {missing.length > 0 ? (
        <div className="mt-3 rounded-sm border border-dashed border-[hsl(var(--risk-medium))] bg-surface-muted p-2">
          <div className="text-[12px] font-medium">Что нужно закрыть перед выпуском</div>
          <ul className="mt-1 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
            {missing.map((item) => (
              <li key={item} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 rounded-sm border border-border bg-surface-muted p-2 text-[12px] text-muted-foreground">
          Пакет готов: есть врачебная оценка, безопасный текст, выбранные снимки и согласие на доступ.
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[1fr_180px]">
        <div className="rounded-sm border border-border bg-surface-muted p-2">
          <div className="text-[12px] font-medium">Состав пакета</div>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {images.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Для выбранного очага нет снимков.</p>
            ) : (
              images.map((image, index) => (
                <label
                  key={image.id}
                  className="flex min-h-[44px] items-start gap-2 rounded-sm border border-border bg-surface px-2 py-2 text-[12px]"
                >
                  <input
                    type="checkbox"
                    checked={selectedImageIds.includes(image.id)}
                    onChange={() => toggleImage(image.id)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{imagePackageLabel(image, index)}</span>
                    <span className="block text-muted-foreground">
                      {formatDateTime(image.capturedAt)} · качество {Math.round(image.quality.score * 100)}%
                    </span>
                    {image.quality.issues.length > 0 && (
                      <span className="block text-muted-foreground">
                        {image.quality.issues.join(", ")}
                      </span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="rounded-sm border border-border bg-surface p-3">
          <div className="text-[12px] font-medium">Код доступа пациента</div>
          <DemoQr />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Токен доступа скрыт. В учебном пакете отображается только факт выпуска и срок.
          </p>
        </div>
      </div>

      <section
        aria-label="Контур фото для пациента"
        className="mt-3 rounded-sm border border-border bg-surface p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-medium">Контур фото для пациента</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Интерфейс готовит только данные выбранных врачом снимков. Реальная выдача
              файлов должна идти через систему клиники с журналом и отзывом доступа.
            </p>
          </div>
          <span
            className={`rounded-sm border px-2 py-1 text-[12px] font-medium ${
              photoMetadataReady
                ? "border-border bg-surface-muted text-foreground"
                : "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
            }`}
          >
            {photoAccessStatus}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
          <Field term="Фото выбирает врач" value={selectedLabel} />
          <Field term="Состав" value={imageKindSummary(selectedImages)} />
          <Field term="Сырые файлы и защищённые ссылки" value="скрыты" />
          <Field term="Срок доступа" value={expiresAt ? formatDateTime(expiresAt) : "—"} />
          <Field term="Контур" value="только метаданные" />
          <Field term="План" value="фото и протокол" />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Сырые файлы и защищённые ссылки скрыты. Пациентский доступ появится только
          после всех проверок клиники.
        </p>

        <div className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted p-2">
          <div className="text-[12px] font-medium">Что блокирует выдачу фото</div>
          <ul className="mt-1 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
            {photoReleaseMissing.map((item) => (
              <li key={`photo-${item}`} className="flex items-start gap-1.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
            <li className="flex items-start gap-1.5">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
              <span>{photoBackendBlocker}</span>
            </li>
          </ul>
        </div>

        {photoHandoffState === "prepared" && (
          <div
            role="status"
            className="mt-3 rounded-sm border border-border bg-surface-muted p-2 text-[12px]"
          >
            <div className="font-medium">Контур фото подготовлен локально</div>
            <div className="mt-1 text-muted-foreground">
              Файлы, токены и защищённые ссылки не выводятся. Следующий шаг —
              договор выдачи, журнал открытия и отзыв доступа.
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11"
            disabled={!photoMetadataReady}
            onClick={preparePhotoHandoff}
          >
            Подготовить метаданные фото
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Учебное действие не открывает фото пациенту и не создаёт ссылку.
          </span>
        </div>
      </section>

      {packetState === "released" && (
        <div
          role="status"
          className="mt-3 rounded-sm border border-border bg-surface-muted p-2 text-[12px]"
        >
          Пакет выпущен пациенту. Доступ действует до {expiresAt ? formatDateTime(expiresAt) : "заданного срока"}.
        </div>
      )}
      {packetState === "revoked" && (
        <div
          role="status"
          className="mt-3 rounded-sm border border-border bg-surface-muted p-2 text-[12px]"
        >
          Доступ отозван. Повторный выпуск создаст новую запись аудита.
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="min-h-11"
          disabled={!canRelease}
          onClick={releasePacket}
        >
          Выпустить пакет пациенту
        </Button>
        {packetState === "released" && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={revokePacket}
          >
            Отозвать доступ
          </Button>
        )}
      </div>

      <section
        aria-label="Подготовка отчёта"
        className="mt-3 rounded-sm border border-border bg-surface p-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-[12px] font-medium">Подготовка отчёта</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Документ не собирается в браузере. Интерфейс готовит только безопасную задачу
              для системы клиники.
            </p>
          </div>
          <span
            className={`rounded-sm border px-2 py-1 text-[12px] font-medium ${
              reportPackageReady
                ? "border-border bg-surface-muted text-foreground"
                : "border-[hsl(var(--risk-medium))] bg-surface-muted text-foreground"
            }`}
          >
            {reportPackageReady ? "Отчёт готов к сборке" : "Сборка отчёта заблокирована"}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
          <Field term="Сборка" value={reportPackageReady ? "разрешена после проверок" : "закрыта до проверок"} />
          <Field term="Снимки" value={selectedLabel} />
          <Field term="Текст" value={patientText ? "версия для пациента готова" : "нет безопасной версии"} />
          <Field term="Система клиники" value="обязательна" />
          <Field term="Ссылки" value="токены и ссылки скрыты" />
          <Field term="Аудит" value={backendJobState === "prepared" ? "подготовлен" : "ожидает"} />
        </div>

        {missing.length > 0 && (
          <div className="mt-3 rounded-sm border border-dashed border-border bg-surface-muted p-2">
            <div className="text-[12px] font-medium">Что блокирует сборку отчёта</div>
            <ul className="mt-1 grid grid-cols-1 gap-1 text-[12px] text-muted-foreground sm:grid-cols-2">
              {missing.map((item) => (
                <li key={`backend-${item}`} className="flex items-start gap-1.5">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground" aria-hidden />
                  <span>{backendMissingLabel(item)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {backendJobState === "prepared" && (
          <div
            role="status"
            className="mt-3 rounded-sm border border-border bg-surface-muted p-2 text-[12px]"
          >
            <div className="font-medium">Задача отчёта подготовлена локально</div>
            <div className="mt-1 text-muted-foreground">
              Задача ожидает систему клиники. Токены, защищённые ссылки и файловые пути
              не выводятся.
            </div>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11"
            disabled={!reportPackageReady}
            onClick={prepareBackendJob}
          >
            Подготовить задачу отчёта
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Учебное действие не делает сетевых вызовов и не выпускает документ пациенту.
          </span>
        </div>
      </section>

      <div className="mt-3 rounded-sm border border-border bg-surface-muted p-2">
        <div className="text-[12px] font-medium">Аудит пакета</div>
        <ul className="mt-1 space-y-1 text-[12px] text-muted-foreground">
          {[...auditRows, ...generatedAuditRows].length === 0 ? (
            <li>Действий по пакету пока нет.</li>
          ) : (
            [...auditRows, ...generatedAuditRows].map((row, index) => (
              <li key={`${row}-${index}`}>{row}</li>
            ))
          )}
        </ul>
      </div>
    </section>
  );
}

function DemoQr() {
  return (
    <div
      className="mt-2 grid w-[108px] grid-cols-9 rounded-sm border border-border bg-white p-1"
      aria-hidden="true"
    >
      {QR_PATTERN.flat().map((cell, index) => (
        <span
          key={index}
          className={`h-3 w-3 ${cell ? "bg-foreground" : "bg-white"}`}
        />
      ))}
    </div>
  );
}

// ───────── Small UI helpers ─────────

function ChecklistItem({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5">
      <span
        aria-hidden
        className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
          ok ? "bg-[hsl(var(--risk-low))]" : "bg-[hsl(var(--risk-medium))]"
        }`}
      />
      <span className="text-[12px]">
        {children}
        <span className="ml-1 text-muted-foreground">{ok ? "· готово" : "· требуется"}</span>
      </span>
    </li>
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
    <dl className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </dl>
  );
}
