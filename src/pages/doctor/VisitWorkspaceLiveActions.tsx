// Stage 4H · Live write controls for self-hosted visit workspace.
// Hidden in demo mode. Keeps the existing demo tabs untouched.

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Lesion, Visit } from "@/lib/domain";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import {
  createSelfHostedVisitFollowUp,
  getSelfHostedClinicalFollowUpClinicReviewSummary,
  getSelfHostedClinicalFollowUpOutcomeQualitySummary,
  getSelfHostedClinicalFollowUpOperationsSummary,
  listSelfHostedClinicalFollowUpOperations,
  type FollowUpClinicReviewSummary,
  type FollowUpOutcomeQualitySummary,
  type FollowUpOperationsSummary,
  type SelfHostedClinicalFollowUp,
  updateSelfHostedClinicalFollowUpClinicReview,
  updateSelfHostedClinicalFollowUpOperations,
  updateSelfHostedClinicalFollowUpQuality,
} from "@/lib/self-hosted-follow-up-api";
import {
  archiveSelfHostedVisitLesion,
  buildSelfHostedVisitReportPayload,
  createSelfHostedVisitLesion,
  updateSelfHostedVisit,
  updateSelfHostedVisitLesion,
  updateSelfHostedVisitReport,
} from "@/lib/self-hosted-visit-write-api";

interface VisitWorkspaceLiveActionsProps {
  visit: Visit;
  lesions: Lesion[];
}

type BusyAction =
  | "visit"
  | "create-lesion"
  | "update-lesion"
  | "archive-lesion"
  | "report"
  | "follow-up"
  | "operations-load"
  | "operations-update"
  | "quality-update"
  | "clinic-review-update"
  | null;

const EMPTY_OPERATIONS_SUMMARY: FollowUpOperationsSummary = {
  totalOpen: 0,
  overdue: 0,
  waitingPatient: 0,
  escalated: 0,
  deliveryFailed: 0,
  deliveryPending: 0,
};

const EMPTY_OUTCOME_SUMMARY: FollowUpOutcomeQualitySummary = {
  totalFollowUps: 0,
  closedFollowUps: 0,
  openOverdue: 0,
  openEscalated: 0,
  closedWithEvidence: 0,
  closedMissingEvidence: 0,
  qualityReviewed: 0,
  qualityPending: 0,
  qualityNeedsAttention: 0,
  patientReached: 0,
  clinicalEscalations: 0,
  deliveryFailures: 0,
};

const EMPTY_CLINIC_REVIEW_SUMMARY: FollowUpClinicReviewSummary = {
  totalFollowUps: 0,
  retentionDue: 0,
  retentionReviewed: 0,
  retentionArchived: 0,
  clinicReviewScheduled: 0,
  clinicReviewCompleted: 0,
  clinicNeedsPolicyReview: 0,
  qualityNeedsAttention: 0,
  closedMissingEvidence: 0,
  localReviewEvents: 0,
};

function publicMessage(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Не удалось сохранить изменения.";
  if (error.code === "forbidden") return "Недостаточно прав для записи в self-hosted backend.";
  if (error.code === "validation_error") return "Проверьте поля: backend вернул ошибку валидации.";
  return error.message || "Не удалось сохранить изменения.";
}

export function VisitWorkspaceLiveActions({ visit, lesions }: VisitWorkspaceLiveActionsProps) {
  const session = useSelfHostedApiSession();
  const configured = isSelfHostedApiConfigured(session);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [status, setStatus] = useState("Live-запись доступна после входа в self-hosted backend.");
  const [complaint, setComplaint] = useState(visit.complaint || "");
  const [visitStatus, setVisitStatus] = useState<"draft" | "in_progress" | "signed" | "cancelled">("in_progress");
  const [newLesionLabel, setNewLesionLabel] = useState("Новый очаг");
  const [newLesionZone, setNewLesionZone] = useState("");
  const [selectedLesionId, setSelectedLesionId] = useState(lesions[0]?.id ?? "");
  const [selectedLesionLabel, setSelectedLesionLabel] = useState(lesions[0]?.label ?? "");
  const [physicianText, setPhysicianText] = useState("");
  const [patientText, setPatientText] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpReason, setFollowUpReason] = useState("Контроль после визита");
  const [followUpPatientSummary, setFollowUpPatientSummary] = useState("");
  const [followUpInternalNote, setFollowUpInternalNote] = useState("");
  const [operationsSummary, setOperationsSummary] = useState<FollowUpOperationsSummary>(EMPTY_OPERATIONS_SUMMARY);
  const [outcomeSummary, setOutcomeSummary] = useState<FollowUpOutcomeQualitySummary>(EMPTY_OUTCOME_SUMMARY);
  const [clinicReviewSummary, setClinicReviewSummary] = useState<FollowUpClinicReviewSummary>(EMPTY_CLINIC_REVIEW_SUMMARY);
  const [operationsQueue, setOperationsQueue] = useState<SelfHostedClinicalFollowUp[]>([]);

  const selectedLesion = useMemo(
    () => lesions.find((lesion) => lesion.id === selectedLesionId) ?? null,
    [lesions, selectedLesionId],
  );

  const baseArgs = {
    apiBaseUrl: session.apiBaseUrl,
    apiToken: session.apiToken,
  };

  async function loadOperationsQueue() {
    if (!configured) return;
    setBusy((current) => current ?? "operations-load");
    const [summary, outcomes, clinicReview, queue] = await Promise.all([
      getSelfHostedClinicalFollowUpOperationsSummary(baseArgs),
      getSelfHostedClinicalFollowUpOutcomeQualitySummary(baseArgs),
      getSelfHostedClinicalFollowUpClinicReviewSummary(baseArgs),
      listSelfHostedClinicalFollowUpOperations({
        ...baseArgs,
        visitId: visit.id,
      }),
    ]);
    if (summary.ok) setOperationsSummary(summary.value);
    if (outcomes.ok) setOutcomeSummary(outcomes.value);
    if (clinicReview.ok) setClinicReviewSummary(clinicReview.value);
    if (queue.ok) setOperationsQueue(queue.value);
    setBusy((current) => current === "operations-load" ? null : current);
    if (!summary.ok || !outcomes.ok || !clinicReview.ok || !queue.ok) {
      setStatus(publicMessage(summary.error || outcomes.error || clinicReview.error || queue.error));
    }
  }

  useEffect(() => {
    void loadOperationsQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, session.apiBaseUrl, session.apiToken, visit.id]);

  if (!configured) {
    return null;
  }

  async function submitVisit(event: FormEvent) {
    event.preventDefault();
    setBusy("visit");
    const result = await updateSelfHostedVisit({
      ...baseArgs,
      visitId: visit.id,
      payload: { chiefComplaint: complaint, status: visitStatus },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Визит сохранён в self-hosted backend."
        : publicMessage(result.error),
    );
  }

  async function submitCreateLesion(event: FormEvent) {
    event.preventDefault();
    setBusy("create-lesion");
    const result = await createSelfHostedVisitLesion({
      ...baseArgs,
      visitId: visit.id,
      payload: {
        label: newLesionLabel,
        bodyZone: newLesionZone || null,
        status: "active",
      },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? ""} создан в self-hosted backend.`
        : publicMessage(result.error),
    );
  }

  async function submitUpdateLesion(event: FormEvent) {
    event.preventDefault();
    if (!selectedLesionId) return;
    setBusy("update-lesion");
    const result = await updateSelfHostedVisitLesion({
      ...baseArgs,
      lesionId: selectedLesionId,
      payload: { label: selectedLesionLabel || selectedLesion?.label || "Очаг" },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? ""} обновлён в self-hosted backend.`
        : publicMessage(result.error),
    );
  }

  async function submitArchiveLesion() {
    if (!selectedLesionId) return;
    setBusy("archive-lesion");
    const result = await archiveSelfHostedVisitLesion({
      ...baseArgs,
      lesionId: selectedLesionId,
      reason: "Archived from live visit workspace",
    });
    setBusy(null);
    setStatus(
      result.ok
        ? `Очаг ${result.value?.label ?? selectedLesionId} архивирован в self-hosted backend.`
        : publicMessage(result.error),
    );
  }

  async function submitReport(event: FormEvent) {
    event.preventDefault();
    setBusy("report");
    const result = await updateSelfHostedVisitReport({
      ...baseArgs,
      visitId: visit.id,
      payload: buildSelfHostedVisitReportPayload({ physicianText, patientText }),
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Отчёт визита сохранён в self-hosted backend."
        : publicMessage(result.error),
    );
  }

  async function submitFollowUp(event: FormEvent) {
    event.preventDefault();
    setBusy("follow-up");
    const result = await createSelfHostedVisitFollowUp({
      ...baseArgs,
      visitId: visit.id,
      payload: {
        dueAt: followUpDueAt,
        reason: followUpReason,
        priority: "normal",
        patientSummary: followUpPatientSummary || null,
        internalNote: followUpInternalNote || null,
      },
    });
    setBusy(null);
    setStatus(
      result.ok
        ? "Контрольный контакт создан в self-hosted backend."
        : publicMessage(result.error),
    );
    if (result.ok) await loadOperationsQueue();
  }

  async function updateOperationsState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpOperations>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("operations-update");
    const result = await updateSelfHostedClinicalFollowUpOperations({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateQualityState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpQuality>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("quality-update");
    const result = await updateSelfHostedClinicalFollowUpQuality({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  async function updateClinicReviewState(
    followUpId: string,
    payload: Parameters<typeof updateSelfHostedClinicalFollowUpClinicReview>[0]["payload"],
    successMessage: string,
  ) {
    setBusy("clinic-review-update");
    const result = await updateSelfHostedClinicalFollowUpClinicReview({
      ...baseArgs,
      followUpId,
      payload,
    });
    setBusy(null);
    setStatus(result.ok ? successMessage : publicMessage(result.error));
    if (result.ok) await loadOperationsQueue();
  }

  return (
    <section
      aria-label="Self-hosted запись визита"
      className="border-b border-border bg-surface px-4 py-3"
    >
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="h-section">Self-hosted запись визита</h2>
          <p className="text-meta">
            JSON-изменения сохраняются в backend. Снимки и object storage остаются вне Stage 4H.
          </p>
        </div>
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-[12px] text-muted-foreground"
        >
          {status}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-5">
        <form onSubmit={submitVisit} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Визит</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-visit-status">
            Статус
          </label>
          <select
            id="stage4h-visit-status"
            value={visitStatus}
            onChange={(event) => setVisitStatus(event.target.value as typeof visitStatus)}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
          >
            <option value="draft">Черновик</option>
            <option value="in_progress">В работе</option>
            <option value="signed">Подписан</option>
            <option value="cancelled">Отменён</option>
          </select>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-complaint">
            Жалоба
          </label>
          <Textarea
            id="stage4h-complaint"
            value={complaint}
            onChange={(event) => setComplaint(event.target.value)}
            className="min-h-20 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "visit"} className="h-8 text-[12px]">
            {busy === "visit" ? "Сохраняем…" : "Сохранить визит"}
          </Button>
        </form>

        <form onSubmit={submitCreateLesion} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Новый очаг</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-new-lesion-label">
            Метка
          </label>
          <Input
            id="stage4h-new-lesion-label"
            value={newLesionLabel}
            onChange={(event) => setNewLesionLabel(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage4h-new-lesion-zone">
            Зона
          </label>
          <Input
            id="stage4h-new-lesion-zone"
            value={newLesionZone}
            onChange={(event) => setNewLesionZone(event.target.value)}
            className="h-9 text-[13px]"
            placeholder="спина, плечо, голень"
          />
          <Button type="submit" size="sm" disabled={busy === "create-lesion"} className="h-8 text-[12px]">
            {busy === "create-lesion" ? "Создаём…" : "Создать очаг"}
          </Button>
        </form>

        <form onSubmit={submitUpdateLesion} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Существующий очаг</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-lesion-select">
            Очаг
          </label>
          <select
            id="stage4h-lesion-select"
            value={selectedLesionId}
            onChange={(event) => {
              const nextId = event.target.value;
              const next = lesions.find((lesion) => lesion.id === nextId);
              setSelectedLesionId(nextId);
              setSelectedLesionLabel(next?.label ?? "");
            }}
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-[13px]"
          >
            {lesions.map((lesion) => (
              <option key={lesion.id} value={lesion.id}>
                {lesion.label}
              </option>
            ))}
          </select>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-lesion-label">
            Новая метка
          </label>
          <Input
            id="stage4h-lesion-label"
            value={selectedLesionLabel}
            onChange={(event) => setSelectedLesionLabel(event.target.value)}
            className="h-9 text-[13px]"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={!selectedLesionId || busy === "update-lesion"} className="h-8 text-[12px]">
              {busy === "update-lesion" ? "Сохраняем…" : "Обновить очаг"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!selectedLesionId || busy === "archive-lesion"}
              onClick={submitArchiveLesion}
              className="h-8 text-[12px]"
            >
              {busy === "archive-lesion" ? "Архивируем…" : "Архивировать"}
            </Button>
          </div>
        </form>

        <form onSubmit={submitReport} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Отчёт</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage4h-physician-text">
            Текст для врача
          </label>
          <Textarea
            id="stage4h-physician-text"
            value={physicianText}
            onChange={(event) => setPhysicianText(event.target.value)}
            className="min-h-16 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage4h-patient-text">
            Patient-safe текст
          </label>
          <Textarea
            id="stage4h-patient-text"
            value={patientText}
            onChange={(event) => setPatientText(event.target.value)}
            className="min-h-16 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "report"} className="h-8 text-[12px]">
            {busy === "report" ? "Сохраняем…" : "Сохранить отчёт"}
          </Button>
        </form>

        <form onSubmit={submitFollowUp} className="surface-toolbar space-y-2 p-3">
          <h3 className="h-section text-[14px]">Контроль и связь</h3>
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-due-at">
            Дата и время контроля
          </label>
          <Input
            id="stage17-follow-up-due-at"
            type="datetime-local"
            value={followUpDueAt}
            onChange={(event) => setFollowUpDueAt(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-reason">
            Причина
          </label>
          <Input
            id="stage17-follow-up-reason"
            value={followUpReason}
            onChange={(event) => setFollowUpReason(event.target.value)}
            className="h-9 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-summary">
            Текст для пациента
          </label>
          <Textarea
            id="stage17-follow-up-summary"
            value={followUpPatientSummary}
            onChange={(event) => setFollowUpPatientSummary(event.target.value)}
            className="min-h-14 text-[13px]"
          />
          <label className="block text-[12px] font-medium" htmlFor="stage17-follow-up-note">
            Внутренняя заметка
          </label>
          <Textarea
            id="stage17-follow-up-note"
            value={followUpInternalNote}
            onChange={(event) => setFollowUpInternalNote(event.target.value)}
            className="min-h-14 text-[13px]"
          />
          <Button type="submit" size="sm" disabled={busy === "follow-up"} className="h-8 text-[12px]">
            {busy === "follow-up" ? "Создаём…" : "Создать контроль"}
          </Button>
        </form>
      </div>

      <section
        aria-label="Операционный контроль follow-up"
        className="mt-3 rounded-md border border-border bg-background p-3"
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="h-section text-[14px]">Операционный контроль</h3>
            <p className="text-meta">
              SLA, triage и delivery evidence ведутся локально в self-hosted backend.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === "operations-load"}
            onClick={() => void loadOperationsQueue()}
            className="h-8 text-[12px]"
          >
            {busy === "operations-load" ? "Обновляем…" : "Обновить очередь"}
          </Button>
        </div>
        <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-3 lg:grid-cols-6">
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Открыто</dt>
            <dd className="text-lg font-semibold">{operationsSummary.totalOpen}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Просрочено SLA</dt>
            <dd className="text-lg font-semibold">{operationsSummary.overdue}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Ждёт пациента</dt>
            <dd className="text-lg font-semibold">{operationsSummary.waitingPatient}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Эскалации</dt>
            <dd className="text-lg font-semibold">{operationsSummary.escalated}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Ошибки доставки</dt>
            <dd className="text-lg font-semibold">{operationsSummary.deliveryFailed}</dd>
          </div>
          <div className="surface-toolbar p-2">
            <dt className="text-muted-foreground">Доставка ждёт</dt>
            <dd className="text-lg font-semibold">{operationsSummary.deliveryPending}</dd>
          </div>
        </dl>

        <section
          aria-label="Качество закрытия follow-up"
          className="mt-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="h-section text-[13px]">Качество закрытия follow-up</h4>
              <p className="text-meta">
                Итоги основаны только на локальных outcome/QA полях и delivery evidence.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              QA pending: {outcomeSummary.qualityPending}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Закрыто всего</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedFollowUps}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">С evidence</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedWithEvidence}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Без evidence</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.closedMissingEvidence}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Требует внимания</dt>
              <dd className="text-lg font-semibold">{outcomeSummary.qualityNeedsAttention}</dd>
            </div>
          </dl>
        </section>

        <section
          aria-label="Retention и clinic review follow-up"
          className="mt-3 rounded-md border border-border bg-muted/20 p-3"
        >
          <div className="flex flex-col gap-1 md:flex-row md:items-start md:justify-between">
            <div>
              <h4 className="h-section text-[13px]">Retention и clinic review</h4>
              <p className="text-meta">
                Обзор хранит локальные retention/clinic-review отметки без внешнего SOP-подтверждения.
              </p>
            </div>
            <span className="text-[12px] text-muted-foreground">
              events: {clinicReviewSummary.localReviewEvents}
            </span>
          </div>
          <dl className="mt-3 grid gap-2 text-[12px] sm:grid-cols-2 lg:grid-cols-5">
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Retention due</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.retentionDue}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Retention reviewed</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.retentionReviewed}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Clinic scheduled</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicReviewScheduled}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Clinic completed</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicReviewCompleted}</dd>
            </div>
            <div className="surface-toolbar p-2">
              <dt className="text-muted-foreground">Policy review</dt>
              <dd className="text-lg font-semibold">{clinicReviewSummary.clinicNeedsPolicyReview}</dd>
            </div>
          </dl>
        </section>

        <div className="mt-3 space-y-2" aria-label="Очередь follow-up по визиту">
          {operationsQueue.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Для этого визита нет открытых follow-up задач.</p>
          ) : operationsQueue.map((item) => (
            <article key={item.id} className="surface-toolbar flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{item.reason || "Контрольный контакт"}</p>
                <p className="text-[12px] text-muted-foreground">
                  triage: {item.triageState} · escalation: {item.escalationLevel} · delivery: {item.deliveryState}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  outcome: {item.resolutionOutcome} · QA: {item.qualityReviewState}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  retention: {item.retentionReviewState} · clinic review: {item.clinicReviewState}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "waiting_patient", deliveryState: "pending", operationsNote: "Waiting for patient confirmation." },
                    "Follow-up переведён в ожидание пациента.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Ждёт пациента
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "escalated", escalationLevel: "clinic_admin", operationsNote: "Escalated locally to clinic admin." },
                    "Follow-up эскалирован администратору клиники.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Эскалировать
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={busy === "operations-update"}
                  onClick={() => void updateOperationsState(
                    item.id,
                    { triageState: "resolved", deliveryState: "delivered", deliveryEvidence: { channel: "portal", state: "confirmed" } },
                    "Follow-up закрыт в операционной очереди.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Закрыть
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "quality-update"}
                  onClick={() => void updateQualityState(
                    item.id,
                    {
                      resolutionOutcome: "patient_reached",
                      qualityReviewState: "reviewed",
                      qualityReviewNote: "Reviewed locally in clinical workspace.",
                    },
                    "Follow-up отмечен как QA reviewed.",
                  )}
                  className="h-8 text-[12px]"
                >
                  QA reviewed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "quality-update"}
                  onClick={() => void updateQualityState(
                    item.id,
                    {
                      resolutionOutcome: "clinical_escalation",
                      qualityReviewState: "needs_attention",
                      qualityReviewNote: "Needs local clinical review.",
                    },
                    "Follow-up помечен как требующий внимания.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Требует внимания
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      retentionReviewState: "reviewed",
                      retentionReviewNote: "Retention reviewed locally after follow-up closure.",
                    },
                    "Follow-up retention review отмечен локально.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Retention reviewed
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      clinicReviewState: "needs_policy_review",
                      clinicReviewNote: "Needs clinic policy review before SOP closure.",
                    },
                    "Follow-up отправлен на clinic policy review.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Policy review
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy === "clinic-review-update"}
                  onClick={() => void updateClinicReviewState(
                    item.id,
                    {
                      clinicReviewState: "completed",
                      clinicReviewNote: "Clinic review completed locally.",
                    },
                    "Clinic review по follow-up завершён локально.",
                  )}
                  className="h-8 text-[12px]"
                >
                  Clinic review done
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
