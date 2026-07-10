// Stage 4G · Self-hosted visit workspace API client.
// Read-only access to /api/v1/patients/{id}/visits, /api/v1/visits/{id},
// /api/v1/visits/{id}/lesions and /api/v1/visits/{id}/assets.
// No managed-runtime coupling.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

export interface SelfHostedVisitDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  doctorUserId: string | null;
  status: "draft" | "in_progress" | "signed" | "cancelled" | string;
  startedAt: string | null;
  signedAt: string | null;
  chiefComplaint: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedVisitScheduleItemDTO extends SelfHostedVisitDTO {
  patient: {
    id: string | null;
    fullName: string | null;
    code: string | null;
  };
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface SelfHostedVisitScheduleResult {
  items: SelfHostedVisitScheduleItemDTO[];
  count: number;
  limit: number;
  offset: number;
  filters: {
    status: string;
    dateFrom: string | null;
    dateTo: string | null;
    search: string | null;
  };
}

export interface SelfHostedVisitDetailDTO extends SelfHostedVisitDTO {
  patient: {
    id: string | null;
    fullName: string | null;
    code: string | null;
  };
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface SelfHostedVisitLesionDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  label: string;
  bodyZone: string | null;
  bodySurface: string | null;
  status: string;
  riskLevel: "low" | "moderate" | "high" | "urgent" | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedVisitAssetDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  lesionId: string | null;
  kind: "overview_photo" | "dermoscopy" | "report_attachment" | string;
  contentType: string | null;
  byteSize: number | null;
  captureSource: "phone" | "device_bridge" | "file_import" | "camera" | "local_transfer" | "unknown" | string;
  capturedAt: string | null;
  uploadedBy: string | null;
  createdAt: string | null;
}

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface VisitWorkspaceListVisitsArgs extends BaseArgs {
  patientId: string;
}

export interface VisitWorkspaceVisitArgs extends BaseArgs {
  visitId: string;
}

export interface ListSelfHostedVisitsArgs extends BaseArgs {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
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
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(error?.code ?? `http_${response.status}`),
    message: String(error?.message ?? `HTTP ${response.status}`),
    correlationId: errorBody?.correlationId ? String(errorBody.correlationId) : undefined,
  };
}

async function getJson(
  url: string,
  token: string,
): Promise<SelfHostedApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers: authHeaders(token) });
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

function extractItems(body: unknown): Record<string, unknown>[] {
  const raw = isRecord(body) && Array.isArray(body.items) ? body.items : [];
  return raw.filter(isRecord);
}

function extractItem(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  return isRecord(body.item) ? body.item : null;
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

function toVisitDetail(input: Record<string, unknown>): SelfHostedVisitDetailDTO {
  const patient = isRecord(input.patient) ? input.patient : {};
  const clinic = isRecord(input.clinic) ? input.clinic : {};
  return {
    ...toVisit(input),
    patient: {
      id: patient.id == null ? null : String(patient.id),
      fullName: patient.fullName == null ? null : String(patient.fullName),
      code: patient.code == null ? null : String(patient.code),
    },
    clinic: {
      id: clinic.id == null ? null : String(clinic.id),
      slug: clinic.slug == null ? null : String(clinic.slug),
      name: clinic.name == null ? null : String(clinic.name),
    },
  };
}

function toScheduleVisit(input: Record<string, unknown>): SelfHostedVisitScheduleItemDTO {
  const patient = isRecord(input.patient) ? input.patient : {};
  const clinic = isRecord(input.clinic) ? input.clinic : {};
  return {
    ...toVisit(input),
    patient: {
      id: patient.id == null ? null : String(patient.id),
      fullName: patient.fullName == null ? null : String(patient.fullName),
      code: patient.code == null ? null : String(patient.code),
    },
    clinic: {
      id: clinic.id == null ? null : String(clinic.id),
      slug: clinic.slug == null ? null : String(clinic.slug),
      name: clinic.name == null ? null : String(clinic.name),
    },
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

function toAsset(input: Record<string, unknown>): SelfHostedVisitAssetDTO {
  const byteSizeRaw = input.byteSize;
  const byteSize =
    typeof byteSizeRaw === "number" && Number.isFinite(byteSizeRaw)
      ? byteSizeRaw
      : byteSizeRaw == null
        ? null
        : Number(byteSizeRaw) || null;
  return {
    id: String(input.id ?? ""),
    clinicId: input.clinicId == null ? null : String(input.clinicId),
    patientId: input.patientId == null ? null : String(input.patientId),
    visitId: input.visitId == null ? null : String(input.visitId),
    lesionId: input.lesionId == null ? null : String(input.lesionId),
    kind: String(input.kind ?? "overview_photo"),
    contentType: input.contentType == null ? null : String(input.contentType),
    byteSize,
    captureSource: String(input.captureSource ?? "file_import"),
    capturedAt: input.capturedAt == null ? null : String(input.capturedAt),
    uploadedBy: input.uploadedBy == null ? null : String(input.uploadedBy),
    createdAt: input.createdAt == null ? null : String(input.createdAt),
  };
}

export async function listSelfHostedVisitsByPatient(
  args: VisitWorkspaceListVisitsArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.patientId) {
    return fail({ kind: "validation", code: "validation_error", message: "patientId обязателен." });
  }
  const url = buildSelfHostedApiUrl(
    args.apiBaseUrl,
    `/api/v1/patients/${encodeURIComponent(args.patientId)}/visits`,
  );
  const result = await getJson(url, args.apiToken as string);
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value).map(toVisit).filter((v) => v.id));
}

export async function listSelfHostedVisits(
  args: ListSelfHostedVisitsArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitScheduleResult>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  if (args.status && args.status !== "all") params.set("status", args.status);
  if (args.dateFrom) params.set("dateFrom", args.dateFrom);
  if (args.dateTo) params.set("dateTo", args.dateTo);
  if (args.search) params.set("search", args.search);
  if (args.limit) params.set("limit", String(args.limit));
  if (args.offset) params.set("offset", String(args.offset));
  const query = params.toString();
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/visits${query ? `?${query}` : ""}`);
  const result = await getJson(url, args.apiToken as string);
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const body = isRecord(result.value) ? result.value : {};
  const filters = isRecord(body.filters) ? body.filters : {};
  return ok({
    items: extractItems(result.value).map(toScheduleVisit).filter((v) => v.id),
    count: Number(body.count ?? 0) || 0,
    limit: Number(body.limit ?? args.limit ?? 50) || 50,
    offset: Number(body.offset ?? args.offset ?? 0) || 0,
    filters: {
      status: String(filters.status ?? "all"),
      dateFrom: filters.dateFrom == null ? null : String(filters.dateFrom),
      dateTo: filters.dateTo == null ? null : String(filters.dateTo),
      search: filters.search == null ? null : String(filters.search),
    },
  });
}

export async function getSelfHostedVisit(
  args: VisitWorkspaceVisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitDetailDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId) {
    return fail({ kind: "validation", code: "validation_error", message: "visitId обязателен." });
  }
  const url = buildSelfHostedApiUrl(
    args.apiBaseUrl,
    `/api/v1/visits/${encodeURIComponent(args.visitId)}`,
  );
  const result = await getJson(url, args.apiToken as string);
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const item = extractItem(result.value);
  return item
    ? ok(toVisitDetail(item))
    : fail({ kind: "http", code: "empty_response", message: "Backend вернул пустой визит." });
}

export async function listSelfHostedVisitLesions(
  args: VisitWorkspaceVisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitLesionDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId) {
    return fail({ kind: "validation", code: "validation_error", message: "visitId обязателен." });
  }
  const url = buildSelfHostedApiUrl(
    args.apiBaseUrl,
    `/api/v1/visits/${encodeURIComponent(args.visitId)}/lesions`,
  );
  const result = await getJson(url, args.apiToken as string);
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value).map(toLesion).filter((l) => l.id));
}

export async function listSelfHostedVisitAssets(
  args: VisitWorkspaceVisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitAssetDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.visitId) {
    return fail({ kind: "validation", code: "validation_error", message: "visitId обязателен." });
  }
  const url = buildSelfHostedApiUrl(
    args.apiBaseUrl,
    `/api/v1/visits/${encodeURIComponent(args.visitId)}/assets`,
  );
  const result = await getJson(url, args.apiToken as string);
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value).map(toAsset).filter((a) => a.id));
}
