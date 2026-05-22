// Stage 4H · Live write controls for self-hosted visit workspace.
// Hidden in demo mode. Keeps the existing demo tabs untouched.

import { FormEvent, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Lesion, Visit } from "@/lib/domain";
import {
  isSelfHostedApiConfigured,
  useSelfHostedApiSession,
} from "@/lib/self-hosted-api-session";
import { createSelfHostedVisitFollowUp } from "@/lib/self-hosted-follow-up-api";
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

type BusyAction = "visit" | "create-lesion" | "update-lesion" | "archive-lesion" | "report" | "follow-up" | null;

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

  const selectedLesion = useMemo(
    () => lesions.find((lesion) => lesion.id === selectedLesionId) ?? null,
    [lesions, selectedLesionId],
  );

  if (!configured) {
    return null;
  }

  const baseArgs = {
    apiBaseUrl: session.apiBaseUrl,
    apiToken: session.apiToken,
  };

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
    </section>
  );
}
