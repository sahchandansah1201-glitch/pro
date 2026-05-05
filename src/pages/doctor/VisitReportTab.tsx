import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAssessmentsByVisitId,
  getClinicById,
  getImagesByVisitId,
} from "@/lib/mock-data";
import type { Assessment, ClinicalImage, Lesion, Patient, Visit } from "@/lib/domain";
import { DEMO_USERS } from "@/lib/users";
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
  const needsReview = images.some(
    (i) => i.quality.score < 0.8 || i.quality.issues.length > 0,
  );
  return needsReview ? "review" : "ok";
}

function qualityLabel(s: QualityStatus): string {
  if (s === "ok") return "ok";
  if (s === "review") return "needs review";
  return "no images";
}

interface Props {
  patient: Patient;
  visit: Visit;
  lesions: Lesion[];
}

export function VisitReportTab({ patient, visit, lesions }: Props) {
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
          Локальный демо-очаг нужно сохранить на бэкенде перед отчётом.
        </div>
      )}

      {/* Visit summary */}
      <section className="rounded-md border border-border bg-surface p-3">
        <h2 className="mb-2 text-[13px] font-semibold">Контекст отчёта</h2>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
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
        </dl>
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
        </section>

        {/* Internal block */}
        <section
          aria-label="Внутренний блок врача"
          className="rounded-md border border-border bg-surface p-3 lg:col-span-5"
        >
          <h2 className="mb-2 text-[13px] font-semibold">Внутренний блок врача</h2>
          {selAssessment ? (
            <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[12px]">
              <Field
                term="ABCD total"
                value={
                  <span className="tabular-nums">
                    {selAssessment.abcd.total.toFixed(1)}
                  </span>
                }
              />
              <Field
                term="7-point total"
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
            </dl>
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
        Отчёт в MVP отображает мок-данные. Реальная генерация PDF и отправка
        пациенту будут подключены на бэкенде.
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
            term="ABCD total"
            value={<span className="tabular-nums">{assessment.abcd.total.toFixed(1)}</span>}
          />
          <Field
            term="7-point total"
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
              onClick={() => onOpenConclusion(lesion.id)}
            >
              К заключению по визиту
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

type SendStatus = "idle" | "sending" | "sent" | "failed";

interface SendRecord {
  status: SendStatus;
  at: string;
  patientTextPreview: string;
  reason?: string;
}

function DemoReportForm({ assessment }: { assessment: Assessment | null }) {
  const [title, setTitle] = useState("");
  const [patientText, setPatientText] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [saved, setSaved] = useState<DemoReportDraft | null>(null);
  const [send, setSend] = useState<SendRecord>({
    status: "idle",
    at: "",
    patientTextPreview: "",
  });

  const onSave = () => {
    setSaved({
      title: title.trim(),
      patientText: patientText.trim(),
      internalNote: internalNote.trim(),
      createdAt: BODY_MAP_DEMO_NOW,
    });
  };

  const canSend = Boolean(saved && saved.patientText.length > 0) && send.status !== "sending";

  const onSendDemo = () => {
    if (!saved) return;
    if (!saved.patientText) {
      setSend({
        status: "failed",
        at: BODY_MAP_DEMO_NOW,
        patientTextPreview: "",
        reason: "Текст для пациента пуст.",
      });
      return;
    }
    setSend({
      status: "sending",
      at: BODY_MAP_DEMO_NOW,
      patientTextPreview: saved.patientText,
    });
    // Local UI-only transition; no network, no timers persisted across renders.
    setSend({
      status: "sent",
      at: BODY_MAP_DEMO_NOW,
      patientTextPreview: saved.patientText,
    });
  };

  return (
    <section
      aria-label="Локальный демо-отчёт"
      className="rounded-md border border-border bg-surface p-3"
    >
      <h2 className="mb-2 text-[13px] font-semibold">Локальный демо-отчёт</h2>
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
            className="min-h-[44px] sm:min-h-[32px]"
          />
        </FormField>
        <FormField id="demo-report-patient" label="Текст для пациента">
          <Textarea
            id="demo-report-patient"
            value={patientText}
            onChange={(e) => setPatientText(e.target.value)}
            rows={3}
            placeholder="Безопасная формулировка для пациента: «требуется дополнительное наблюдение»."
          />
        </FormField>
        <FormField id="demo-report-internal" label="Внутренняя заметка врача">
          <Textarea
            id="demo-report-internal"
            value={internalNote}
            onChange={(e) => setInternalNote(e.target.value)}
            rows={2}
            placeholder="Внутренний контекст: дифференциальная диагностика, план."
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
          Сформировать демо-отчёт
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled
          className="min-h-[44px] sm:min-h-[32px]"
        >
          Печать / PDF (демо)
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={!canSend}
          aria-disabled={!canSend}
          data-testid="send-to-patient-demo"
          className="min-h-[44px] sm:min-h-[32px]"
          onClick={onSendDemo}
        >
          Отправить пациенту (демо)
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Печать/PDF будут подключены на бэкенде. Отправка пациенту в этом режиме
        работает локально и не уходит во внешние сервисы.
      </p>

      <SendStatusBlock send={send} />

      {saved && (
        <div role="status" data-testid="demo-report-preview" className="mt-3 space-y-3">
          <div className="rounded-md border border-border bg-surface-muted p-3 text-[12px]">
            <div className="mb-1 text-[12px] font-medium">Демо-отчёт сформирован локально</div>
            <dl className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-3">
              <dt className="text-muted-foreground">Заголовок</dt>
              <dd className="sm:col-span-2">{saved.title || "—"}</dd>
              <dt className="text-muted-foreground">Время (демо)</dt>
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
              Превью не содержит ABCD, 7-point, AI-заметок, защищённых ссылок,
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
              <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-[12px] sm:grid-cols-2">
                <Field
                  term="ABCD total"
                  value={
                    <span className="tabular-nums">{assessment.abcd.total.toFixed(1)}</span>
                  }
                />
                <Field
                  term="7-point total"
                  value={<span className="tabular-nums">{assessment.sevenPoint.total}</span>}
                />
              </dl>
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
        <span className="ml-1 text-muted-foreground">{ok ? "· ок" : "· требуется"}</span>
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
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{term}</dt>
      <dd className="text-[13px] text-foreground">{value}</dd>
    </div>
  );
}
