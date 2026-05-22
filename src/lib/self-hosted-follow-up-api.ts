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
