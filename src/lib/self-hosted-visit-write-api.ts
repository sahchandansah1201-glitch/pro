// Stage 4H · Self-hosted visit workspace write API client.
// JSON writes for visits, lesions and reports. Binary asset upload remains out of scope.
// No managed-runtime coupling.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";
import type {
  SelfHostedVisitDTO,
  SelfHostedVisitLesionDTO,
} from "@/lib/self-hosted-visit-api";

export interface SelfHostedVisitReportDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  status: string;
  physicianText: string | null;
  patientSafeText: string | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface UpdateVisitPayload {
  status?: "draft" | "in_progress" | "signed" | "cancelled";
  chiefComplaint?: string | null;
}

export interface VisitLesionPayload {
  label?: string;
  bodyZone?: string | null;
  bodySurface?: string | null;
  status?: string;
  riskLevel?: "low" | "moderate" | "high" | "urgent" | null;
}

export interface VisitReportPayload {
  status?: "draft" | "signed";
  physicianText?: string | null;
  patientSafeText?: string | null;
}

export function buildSelfHostedVisitReportPayload({
  physicianText,
  patientText,
  status = "draft",
}: {
  physicianText?: string | null;
  patientText?: string | null;
  status?: "draft" | "signed";
}): VisitReportPayload {
  return {
    status,
    physicianText: physicianText ?? null,
    patientSafeText: patientText ?? null,
  };
}

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

interface VisitArgs extends BaseArgs {
  visitId: string;
}

interface LesionArgs extends BaseArgs {
  lesionId: string;
}

export interface UpdateSelfHostedVisitArgs extends VisitArgs {
  payload: UpdateVisitPayload;
}

export interface CreateSelfHostedVisitLesionArgs extends VisitArgs {
  payload: VisitLesionPayload;
}

export interface UpdateSelfHostedVisitLesionArgs extends LesionArgs {
  payload: VisitLesionPayload;
}

export interface ArchiveSelfHostedVisitLesionArgs extends LesionArgs {
  reason?: string | null;
}

export interface UpdateSelfHostedVisitReportArgs extends VisitArgs {
  payload: VisitReportPayload;
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

function ensureConfigured(args: BaseArgs): SelfHostedApiError | null {
  return args.apiToken ? null : NOT_CONFIGURED;
}

function authHeaders(token: string): HeadersInit {
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

async function parseJsonSafe(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function apiErrorFromBody(response: Response, body: unknown): SelfHostedApiError {
  const errorBody =
    body && typeof body === "object" && "error" in body
      ? (body as { error?: Record<string, unknown>; correlationId?: unknown })
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

async function requestJson<T>(
  url: string,
  token: string,
  method: "POST" | "PATCH" | "DELETE",
  payload: unknown,
  mapper: (item: Record<string, unknown>) => T,
): Promise<SelfHostedApiResult<T>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        ...authHeaders(token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload ?? {}),
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
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return item
    ? ok(mapper(item))
    : fail({ kind: "http", code: "empty_response", message: "Backend вернул пустой ответ." });
}

function toVisit(input: Record<string, unknown>): SelfHostedVisitDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: input.clinicId == null ? null : String(input.clinicId),
    patientId: input.patientId == null ? null : String(input.patientId),
    doctorUserId: input.doctorUserId == null ? null : String(input.doctorUserId),
    status: String(input.status ?? "draft"),
    startedAt: input.startedAt == null ? null : String(input.startedAt),
    signedAt: input.signedAt == null ? null : String(input.signedAt),
    chiefComplaint: input.chiefComplaint == null ? null : String(input.chiefComplaint),
    createdAt: input.createdAt == null ? null : String(input.createdAt),
    updatedAt: input.updatedAt == null ? null : String(input.updatedAt),
  };
}

function toLesion(input: Record<string, unknown>): SelfHostedVisitLesionDTO {
  const risk = input.riskLevel;
  const riskLevel =
    risk === "low" || risk === "moderate" || risk === "high" || risk === "urgent"
      ? risk
      : null;
  return {
    id: String(input.id ?? ""),
    clinicId: input.clinicId == null ? null : String(input.clinicId),
    patientId: input.patientId == null ? null : String(input.patientId),
    visitId: input.visitId == null ? null : String(input.visitId),
    label: String(input.label ?? ""),
    bodyZone: input.bodyZone == null ? null : String(input.bodyZone),
    bodySurface: input.bodySurface == null ? null : String(input.bodySurface),
    status: String(input.status ?? "active"),
    riskLevel,
    createdAt: input.createdAt == null ? null : String(input.createdAt),
    updatedAt: input.updatedAt == null ? null : String(input.updatedAt),
  };
}

function toReport(input: Record<string, unknown>): SelfHostedVisitReportDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: input.clinicId == null ? null : String(input.clinicId),
    patientId: input.patientId == null ? null : String(input.patientId),
    visitId: input.visitId == null ? null : String(input.visitId),
    doctorUserId: input.doctorUserId == null ? null : String(input.doctorUserId),
    status: String(input.status ?? "draft"),
    physicianText: input.physicianText == null ? null : String(input.physicianText),
    patientSafeText: input.patientSafeText == null ? null : String(input.patientSafeText),
    signedAt: input.signedAt == null ? null : String(input.signedAt),
    createdAt: input.createdAt == null ? null : String(input.createdAt),
    updatedAt: input.updatedAt == null ? null : String(input.updatedAt),
  };
}

export async function updateSelfHostedVisit(
  args: UpdateSelfHostedVisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId) {
    return fail({ kind: "validation", code: "validation_error", message: "visitId обязателен." });
  }
  return requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/visits/${encodeURIComponent(args.visitId)}`),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toVisit,
  );
}

export async function createSelfHostedVisitLesion(
  args: CreateSelfHostedVisitLesionArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLesionDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/visits/${encodeURIComponent(args.visitId)}/lesions`),
    args.apiToken as string,
    "POST",
    args.payload,
    toLesion,
  );
}

export async function updateSelfHostedVisitLesion(
  args: UpdateSelfHostedVisitLesionArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLesionDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/lesions/${encodeURIComponent(args.lesionId)}`),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesion,
  );
}

export async function archiveSelfHostedVisitLesion(
  args: ArchiveSelfHostedVisitLesionArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLesionDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/lesions/${encodeURIComponent(args.lesionId)}`),
    args.apiToken as string,
    "DELETE",
    { reason: args.reason ?? "Archived from Dermatolog Pro visit workspace" },
    toLesion,
  );
}

export async function updateSelfHostedVisitReport(
  args: UpdateSelfHostedVisitReportArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitReportDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/visits/${encodeURIComponent(args.visitId)}/report`),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toReport,
  );
}
