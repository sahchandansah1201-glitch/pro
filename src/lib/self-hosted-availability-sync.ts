import type { SelfHostedClinicAvailableSlotDTO } from "@/lib/self-hosted-clinic-availability-api";
import type { SelfHostedClinicBookingRequestDTO } from "@/lib/self-hosted-clinic-booking-api";
import type { SelfHostedExternalIntakeStatusDTO } from "@/lib/self-hosted-external-intake-api";

type SyncStatus = "ready" | "attention" | "blocked";
type IssueSeverity = "warning" | "blocking";

export interface AvailabilitySyncIssue {
  type:
    | "no_available_slots"
    | "requests_without_matching_slot"
    | "stale_slots"
    | "import_duplicates_last_24h"
    | "import_rejections_last_24h"
    | "raw_payload_storage_enabled"
    | "external_runtime_calls_enabled";
  severity: IssueSeverity;
  count: number;
  label: string;
}

export interface AvailabilityConfirmationCandidate {
  requestId: string;
  slotId: string;
  reason: "preferred_window_match";
}

export interface AvailabilitySyncSummary {
  status: SyncStatus;
  openBookingRequests: number;
  availableSlots: number;
  confirmationCandidates: AvailabilityConfirmationCandidate[];
  issues: AvailabilitySyncIssue[];
  nextActionLabel: string;
}

interface BuildArgs {
  bookingRequests: SelfHostedClinicBookingRequestDTO[];
  availableSlots: SelfHostedClinicAvailableSlotDTO[];
  importStatus: SelfHostedExternalIntakeStatusDTO;
  now?: string;
}

const OPEN_REQUEST_STATUSES = new Set(["requested", "reviewing"]);

function toMs(value: string | null | undefined): number {
  const time = new Date(value || "").getTime();
  return Number.isFinite(time) ? time : 0;
}

function addIssue(
  issues: AvailabilitySyncIssue[],
  type: AvailabilitySyncIssue["type"],
  severity: IssueSeverity,
  count: number,
  label: string,
) {
  if (count > 0) issues.push({ type, severity, count, label });
}

function requestMatchesSlot(
  request: SelfHostedClinicBookingRequestDTO,
  slot: SelfHostedClinicAvailableSlotDTO,
  nowMs: number,
): boolean {
  if (!OPEN_REQUEST_STATUSES.has(request.status)) return false;
  if (slot.status !== "available") return false;
  if (request.clinicId && slot.clinicId && request.clinicId !== slot.clinicId) return false;
  const slotStart = toMs(slot.startedAt);
  return slotStart >= nowMs && slotStart >= toMs(request.preferredFrom) && slotStart <= toMs(request.preferredTo);
}

export function buildSelfHostedAvailabilitySyncSummary({
  bookingRequests,
  availableSlots,
  importStatus,
  now = "2026-05-21T12:00:00.000Z",
}: BuildArgs): AvailabilitySyncSummary {
  const nowMs = toMs(now);
  const openRequests = bookingRequests.filter((request) => OPEN_REQUEST_STATUSES.has(request.status));
  const localAvailableSlots = availableSlots.filter((slot) => slot.status === "available");
  const issues: AvailabilitySyncIssue[] = [];
  const staleSlots = localAvailableSlots.filter((slot) => toMs(slot.startedAt) < nowMs);
  const usedSlotIds = new Set<string>();
  const confirmationCandidates: AvailabilityConfirmationCandidate[] = [];

  for (const request of openRequests) {
    const slot = localAvailableSlots.find(
      (candidate) => !usedSlotIds.has(candidate.id) && requestMatchesSlot(request, candidate, nowMs),
    );
    if (!slot) continue;
    usedSlotIds.add(slot.id);
    confirmationCandidates.push({
      requestId: request.id,
      slotId: slot.id,
      reason: "preferred_window_match",
    });
  }

  addIssue(
    issues,
    "no_available_slots",
    "blocking",
    openRequests.length > 0 && localAvailableSlots.length === 0 ? openRequests.length : 0,
    "Нет локально кэшированных свободных окон для открытых заявок.",
  );
  addIssue(
    issues,
    "requests_without_matching_slot",
    "warning",
    Math.max(0, openRequests.length - confirmationCandidates.length),
    "Часть открытых заявок не совпадает с доступными окнами.",
  );
  addIssue(issues, "stale_slots", "warning", staleSlots.length, "В локальном кэше есть устаревшие окна.");
  addIssue(
    issues,
    "import_duplicates_last_24h",
    "warning",
    importStatus.duplicateLast24h,
    "За последние 24 часа были дубликаты импорта.",
  );
  addIssue(
    issues,
    "import_rejections_last_24h",
    "warning",
    importStatus.rejectedLast24h,
    "За последние 24 часа были отклонённые записи импорта.",
  );
  addIssue(
    issues,
    "raw_payload_storage_enabled",
    "blocking",
    importStatus.storedRawPayload ? 1 : 0,
    "Raw payload внешних систем не должен храниться.",
  );
  addIssue(
    issues,
    "external_runtime_calls_enabled",
    "blocking",
    importStatus.runtimeCallsExternalSystems ? 1 : 0,
    "Runtime-вызовы CRM/рекламных систем должны быть выключены.",
  );

  const blocking = issues.some((issue) => issue.severity === "blocking");
  const status: SyncStatus = blocking ? "blocked" : issues.length > 0 ? "attention" : "ready";
  const nextActionLabel =
    status === "blocked"
      ? "Сначала устраните блокирующие конфликты синхронизации."
      : status === "attention"
        ? "Проверьте предупреждения перед подтверждением записи."
        : "Можно подтверждать записи через локальное свободное окно.";

  return {
    status,
    openBookingRequests: openRequests.length,
    availableSlots: localAvailableSlots.length,
    confirmationCandidates,
    issues,
    nextActionLabel,
  };
}

export function availabilitySyncStatusLabel(status: SyncStatus): string {
  if (status === "ready") return "Готово";
  if (status === "attention") return "Требует проверки";
  return "Заблокировано";
}
