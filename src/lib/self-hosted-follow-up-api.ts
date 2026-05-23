// Stage 17A-17Z · self-hosted follow-up communication API client.
// Production UI uses only /api/v1/* on the operator-owned backend.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export type FollowUpPriority = "low" | "normal" | "high" | "urgent";
export type FollowUpStatus = "planned" | "in_progress" | "sent" | "acknowledged" | "completed" | "cancelled";
export type FollowUpTriageState = "new" | "queued" | "in_review" | "waiting_patient" | "escalated" | "resolved" | "blocked";
export type FollowUpEscalationLevel = "none" | "watch" | "clinic_admin" | "urgent";
export type FollowUpDeliveryState = "not_required" | "pending" | "delivered" | "failed" | "deferred";
export type FollowUpResolutionOutcome =
  | "not_reviewed"
  | "patient_reached"
  | "patient_unreachable"
  | "clinical_escalation"
  | "administrative_close";
export type FollowUpQualityReviewState = "pending" | "reviewed" | "needs_attention";
export type FollowUpRetentionReviewState = "not_due" | "due" | "reviewed" | "archived";
export type FollowUpClinicReviewState = "not_scheduled" | "scheduled" | "completed" | "needs_policy_review";

export interface SelfHostedFollowUpMessage {
  id: string;
  followUpId: string;
  senderRole: string;
  direction: string;
  channel: string;
  deliveryState: string;
  patientVisible: boolean;
  body: string | null;
  createdAt: string | null;
}

export interface SelfHostedClinicalFollowUp {
  id: string;
  clinicId?: string | null;
  patientId?: string | null;
  visitId: string | null;
  dueAt: string | null;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  reason: string | null;
  patientSummary: string | null;
  internalNote?: string | null;
  triageState: FollowUpTriageState;
  escalationLevel: FollowUpEscalationLevel;
  slaDueAt: string | null;
  deliveryState: FollowUpDeliveryState;
  deliveryAttempts: number;
  lastDeliveryAttemptAt: string | null;
  deliveryEvidence: Record<string, unknown>;
  operationsNote?: string | null;
  resolutionOutcome: FollowUpResolutionOutcome;
  qualityReviewState: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
  qualityReviewedAt?: string | null;
  retentionReviewState: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  retentionReviewedAt?: string | null;
  clinicReviewState: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
  clinicReviewedAt?: string | null;
  resolvedAt?: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  patient?: {
    id?: string | null;
    code?: string | null;
    fullName?: string | null;
  };
  latestMessage: SelfHostedFollowUpMessage | null;
  messageCount: number;
}

export interface CreateFollowUpPayload {
  dueAt: string;
  reason: string;
  priority?: FollowUpPriority;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface UpdateFollowUpPayload {
  dueAt?: string;
  status?: FollowUpStatus;
  priority?: FollowUpPriority;
  reason?: string;
  patientSummary?: string | null;
  internalNote?: string | null;
}

export interface CreateFollowUpMessagePayload {
  body: string;
  patientVisible?: boolean;
}

export interface FollowUpOperationsSummary {
  totalOpen: number;
  overdue: number;
  waitingPatient: number;
  escalated: number;
  deliveryFailed: number;
  deliveryPending: number;
  source?: string;
}

export interface FollowUpOutcomeQualitySummary {
  totalFollowUps: number;
  closedFollowUps: number;
  openOverdue: number;
  openEscalated: number;
  closedWithEvidence: number;
  closedMissingEvidence: number;
  qualityReviewed: number;
  qualityPending: number;
  qualityNeedsAttention: number;
  patientReached: number;
  clinicalEscalations: number;
  deliveryFailures: number;
  source?: string;
}

export interface FollowUpClinicReviewSummary {
  totalFollowUps: number;
  retentionDue: number;
  retentionReviewed: number;
  retentionArchived: number;
  clinicReviewScheduled: number;
  clinicReviewCompleted: number;
  clinicNeedsPolicyReview: number;
  qualityNeedsAttention: number;
  closedMissingEvidence: number;
  localReviewEvents: number;
  source?: string;
}

export interface UpdateFollowUpOperationsPayload {
  triageState?: FollowUpTriageState;
  escalationLevel?: FollowUpEscalationLevel;
  slaDueAt?: string | null;
  deliveryState?: FollowUpDeliveryState;
  deliveryEvidence?: Record<string, unknown>;
  operationsNote?: string | null;
}

export interface UpdateFollowUpQualityPayload {
  resolutionOutcome?: FollowUpResolutionOutcome;
  qualityReviewState?: FollowUpQualityReviewState;
  qualityReviewNote?: string | null;
}

export interface UpdateFollowUpClinicReviewPayload {
  retentionReviewState?: FollowUpRetentionReviewState;
  retentionReviewNote?: string | null;
  clinicReviewState?: FollowUpClinicReviewState;
  clinicReviewNote?: string | null;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function toStatus(value: unknown): FollowUpStatus {
  const status = String(value ?? "planned");
  return ["planned", "in_progress", "sent", "acknowledged", "completed", "cancelled"].includes(status)
    ? (status as FollowUpStatus)
    : "planned";
}

function toPriority(value: unknown): FollowUpPriority {
  const priority = String(value ?? "normal");
  return ["low", "normal", "high", "urgent"].includes(priority)
    ? (priority as FollowUpPriority)
    : "normal";
}

function toTriageState(value: unknown): FollowUpTriageState {
  const state = String(value ?? "new");
  return ["new", "queued", "in_review", "waiting_patient", "escalated", "resolved", "blocked"].includes(state)
    ? (state as FollowUpTriageState)
    : "new";
}

function toEscalationLevel(value: unknown): FollowUpEscalationLevel {
  const level = String(value ?? "none");
  return ["none", "watch", "clinic_admin", "urgent"].includes(level)
    ? (level as FollowUpEscalationLevel)
    : "none";
}

function toDeliveryState(value: unknown): FollowUpDeliveryState {
  const state = String(value ?? "not_required");
  return ["not_required", "pending", "delivered", "failed", "deferred"].includes(state)
    ? (state as FollowUpDeliveryState)
    : "not_required";
}

function toResolutionOutcome(value: unknown): FollowUpResolutionOutcome {
  const outcome = String(value ?? "not_reviewed");
  return ["not_reviewed", "patient_reached", "patient_unreachable", "clinical_escalation", "administrative_close"].includes(outcome)
    ? (outcome as FollowUpResolutionOutcome)
    : "not_reviewed";
}

function toQualityReviewState(value: unknown): FollowUpQualityReviewState {
  const state = String(value ?? "pending");
  return ["pending", "reviewed", "needs_attention"].includes(state)
    ? (state as FollowUpQualityReviewState)
    : "pending";
}

function toRetentionReviewState(value: unknown): FollowUpRetentionReviewState {
  const state = String(value ?? "not_due");
  return ["not_due", "due", "reviewed", "archived"].includes(state)
    ? (state as FollowUpRetentionReviewState)
    : "not_due";
}

function toClinicReviewState(value: unknown): FollowUpClinicReviewState {
  const state = String(value ?? "not_scheduled");
  return ["not_scheduled", "scheduled", "completed", "needs_policy_review"].includes(state)
    ? (state as FollowUpClinicReviewState)
    : "not_scheduled";
}

export function toSelfHostedFollowUpMessage(input: unknown): SelfHostedFollowUpMessage {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    followUpId: String(row.followUpId ?? ""),
    senderRole: String(row.senderRole ?? ""),
    direction: String(row.direction ?? ""),
    channel: String(row.channel ?? "portal"),
    deliveryState: String(row.deliveryState ?? "local_only"),
    patientVisible: Boolean(row.patientVisible ?? true),
    body: textOrNull(row.body),
    createdAt: textOrNull(row.createdAt),
  };
}

export function toSelfHostedClinicalFollowUp(input: unknown): SelfHostedClinicalFollowUp {
  const row = isRecord(input) ? input : {};
  const patient = isRecord(row.patient) ? row.patient : {};
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    visitId: textOrNull(row.visitId),
    dueAt: textOrNull(row.dueAt),
    status: toStatus(row.status),
    priority: toPriority(row.priority),
    reason: textOrNull(row.reason),
    patientSummary: textOrNull(row.patientSummary),
    internalNote: textOrNull(row.internalNote),
    triageState: toTriageState(row.triageState),
    escalationLevel: toEscalationLevel(row.escalationLevel),
    slaDueAt: textOrNull(row.slaDueAt),
    deliveryState: toDeliveryState(row.deliveryState),
    deliveryAttempts: Number(row.deliveryAttempts ?? 0),
    lastDeliveryAttemptAt: textOrNull(row.lastDeliveryAttemptAt),
    deliveryEvidence: isRecord(row.deliveryEvidence) ? row.deliveryEvidence : {},
    operationsNote: textOrNull(row.operationsNote),
    resolutionOutcome: toResolutionOutcome(row.resolutionOutcome),
    qualityReviewState: toQualityReviewState(row.qualityReviewState),
    qualityReviewNote: textOrNull(row.qualityReviewNote),
    qualityReviewedAt: textOrNull(row.qualityReviewedAt),
    retentionReviewState: toRetentionReviewState(row.retentionReviewState),
    retentionReviewNote: textOrNull(row.retentionReviewNote),
    retentionReviewedAt: textOrNull(row.retentionReviewedAt),
    clinicReviewState: toClinicReviewState(row.clinicReviewState),
    clinicReviewNote: textOrNull(row.clinicReviewNote),
    clinicReviewedAt: textOrNull(row.clinicReviewedAt),
    resolvedAt: textOrNull(row.resolvedAt),
    lastMessageAt: textOrNull(row.lastMessageAt),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
    patient: {
      id: textOrNull(patient.id),
      code: textOrNull(patient.code),
      fullName: textOrNull(patient.fullName),
    },
    latestMessage: row.latestMessage ? toSelfHostedFollowUpMessage(row.latestMessage) : null,
    messageCount: Number(row.messageCount ?? 0),
  };
}

export function toFollowUpOperationsSummary(input: unknown): FollowUpOperationsSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalOpen: Number(row.totalOpen ?? 0),
    overdue: Number(row.overdue ?? 0),
    waitingPatient: Number(row.waitingPatient ?? 0),
    escalated: Number(row.escalated ?? 0),
    deliveryFailed: Number(row.deliveryFailed ?? 0),
    deliveryPending: Number(row.deliveryPending ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpOutcomeQualitySummary(input: unknown): FollowUpOutcomeQualitySummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    closedFollowUps: Number(row.closedFollowUps ?? 0),
    openOverdue: Number(row.openOverdue ?? 0),
    openEscalated: Number(row.openEscalated ?? 0),
    closedWithEvidence: Number(row.closedWithEvidence ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    qualityReviewed: Number(row.qualityReviewed ?? 0),
    qualityPending: Number(row.qualityPending ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    patientReached: Number(row.patientReached ?? 0),
    clinicalEscalations: Number(row.clinicalEscalations ?? 0),
    deliveryFailures: Number(row.deliveryFailures ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

export function toFollowUpClinicReviewSummary(input: unknown): FollowUpClinicReviewSummary {
  const row = isRecord(input) ? input : {};
  return {
    totalFollowUps: Number(row.totalFollowUps ?? 0),
    retentionDue: Number(row.retentionDue ?? 0),
    retentionReviewed: Number(row.retentionReviewed ?? 0),
    retentionArchived: Number(row.retentionArchived ?? 0),
    clinicReviewScheduled: Number(row.clinicReviewScheduled ?? 0),
    clinicReviewCompleted: Number(row.clinicReviewCompleted ?? 0),
    clinicNeedsPolicyReview: Number(row.clinicNeedsPolicyReview ?? 0),
    qualityNeedsAttention: Number(row.qualityNeedsAttention ?? 0),
    closedMissingEvidence: Number(row.closedMissingEvidence ?? 0),
    localReviewEvents: Number(row.localReviewEvents ?? 0),
    source: textOrNull(row.source) ?? undefined,
  };
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody =
    isRecord(body) && isRecord(body.error)
      ? body as { error?: Record<string, unknown>; correlationId?: unknown }
      : null;
  const error = errorBody?.error;
  const details = Array.isArray(error?.details)
    ? error.details
        .filter(isRecord)
        .map((item) => ({
          field: String(item.field ?? "body"),
          message: String(item.message ?? "Некорректное значение."),
        }))
    : undefined;
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(error?.code ?? `http_${response.status}`),
    message: String(error?.message ?? `HTTP ${response.status}`),
    correlationId: errorBody?.correlationId ? String(errorBody.correlationId) : undefined,
    details,
  };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function requestJson(
  args: BaseArgs,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<SelfHostedApiResult<unknown>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  const method = init.method ?? "GET";
  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, path), {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${args.apiToken}`,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      ...(method === "GET" ? {} : { body: JSON.stringify(init.body ?? {}) }),
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(body);
}

export async function listSelfHostedClinicalFollowUps(
  args: BaseArgs & { status?: string | null; patientId?: string | null; visitId?: string | null },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedVisitFollowUp(
  args: BaseArgs & { visitId: string; payload: CreateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/visits/${encodeURIComponent(args.visitId)}/follow-ups`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUp(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function createSelfHostedClinicalFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}

export async function listSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & {
    triageState?: string | null;
    escalationLevel?: string | null;
    deliveryState?: string | null;
    patientId?: string | null;
    visitId?: string | null;
    overdueOnly?: boolean;
  },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const params = new URLSearchParams();
  if (args.triageState) params.set("triageState", args.triageState);
  if (args.escalationLevel) params.set("escalationLevel", args.escalationLevel);
  if (args.deliveryState) params.set("deliveryState", args.deliveryState);
  if (args.patientId) params.set("patientId", args.patientId);
  if (args.visitId) params.set("visitId", args.visitId);
  if (args.overdueOnly) params.set("overdueOnly", "true");
  const suffix = params.toString() ? `?${params}` : "";
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/operations${suffix}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function getSelfHostedClinicalFollowUpOperationsSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOperationsSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/operations/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOperationsSummary(body.item));
}

export async function getSelfHostedClinicalFollowUpOutcomeQualitySummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpOutcomeQualitySummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/outcomes/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpOutcomeQualitySummary(body.item));
}

export async function getSelfHostedClinicalFollowUpClinicReviewSummary(
  args: BaseArgs,
): Promise<SelfHostedApiResult<FollowUpClinicReviewSummary>> {
  const response = await requestJson(args, "/api/v1/clinical/follow-ups/clinic-review/summary");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toFollowUpClinicReviewSummary(body.item));
}

export async function updateSelfHostedClinicalFollowUpOperations(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpOperationsPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/operations`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpQuality(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpQualityPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/quality`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function updateSelfHostedClinicalFollowUpClinicReview(
  args: BaseArgs & { followUpId: string; payload: UpdateFollowUpClinicReviewPayload },
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp>> {
  const response = await requestJson(args, `/api/v1/clinical/follow-ups/${encodeURIComponent(args.followUpId)}/clinic-review`, {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedClinicalFollowUp(body.item));
}

export async function listSelfHostedPatientFollowUps(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalFollowUp[]>> {
  const response = await requestJson(args, "/api/v1/me/follow-ups");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  const items = Array.isArray(body.items) ? body.items : [];
  return ok(items.map(toSelfHostedClinicalFollowUp).filter((item) => item.id));
}

export async function createSelfHostedPatientFollowUpMessage(
  args: BaseArgs & { followUpId: string; payload: CreateFollowUpMessagePayload },
): Promise<SelfHostedApiResult<SelfHostedFollowUpMessage>> {
  const response = await requestJson(args, `/api/v1/me/follow-ups/${encodeURIComponent(args.followUpId)}/messages`, {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedFollowUpMessage(body.item));
}
