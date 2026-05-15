// Stage 5P · self-hosted clinic booking requests API client.
// Operator UI talks only to /api/v1/clinic/booking-requests.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface ListSelfHostedClinicBookingRequestsArgs extends BaseArgs {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetSelfHostedClinicBookingRequestArgs extends BaseArgs {
  requestId: string;
}

export interface UpdateSelfHostedClinicBookingRequestArgs extends BaseArgs {
  requestId: string;
  payload: {
    status?: "requested" | "reviewing" | "booked" | "cancelled";
    clinicNote?: string | null;
    assignedVisitId?: string | null;
  };
}

export interface BookSelfHostedClinicBookingRequestFromSlotArgs extends BaseArgs {
  requestId: string;
  payload: {
    slotId: string;
    clinicNote?: string | null;
  };
}

export interface SelfHostedClinicBookingRequestDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  requestedByUserId: string | null;
  preferredFrom: string | null;
  preferredTo: string | null;
  reason: string | null;
  status: string;
  assignedVisitId: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  clinicNote: string | null;
  createdAt: string | null;
  updatedAt: string | null;
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
  assignedVisit: {
    id: string;
    startedAt: string | null;
    status: string | null;
  } | null;
}

export interface SelfHostedClinicBookingRequestsPage {
  items: SelfHostedClinicBookingRequestDTO[];
  count: number;
  limit: number;
  offset: number;
  filters: {
    status: string;
    search: string | null;
  };
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

function jsonHeaders(token: string): HeadersInit {
  return { ...authHeaders(token), "Content-Type": "application/json" };
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
    isRecord(body) && isRecord(body.error)
      ? body as { error?: Record<string, unknown>; correlationId?: unknown }
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

async function requestJson(
  args: BaseArgs,
  path: string,
  init: { method?: "GET" | "PATCH" | "POST"; body?: unknown } = {},
): Promise<SelfHostedApiResult<unknown>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const method = init.method ?? "GET";
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, path);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: method === "GET" ? authHeaders(String(args.apiToken)) : jsonHeaders(String(args.apiToken)),
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

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function nested(input: Record<string, unknown>, key: string): Record<string, unknown> {
  return isRecord(input[key]) ? input[key] : {};
}

export function toSelfHostedClinicBookingRequest(input: unknown): SelfHostedClinicBookingRequestDTO {
  const row = isRecord(input) ? input : {};
  const patient = nested(row, "patient");
  const clinic = nested(row, "clinic");
  const assignedVisit = nested(row, "assignedVisit");
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    patientId: textOrNull(row.patientId),
    requestedByUserId: textOrNull(row.requestedByUserId),
    preferredFrom: textOrNull(row.preferredFrom),
    preferredTo: textOrNull(row.preferredTo),
    reason: textOrNull(row.reason),
    status: String(row.status ?? "requested"),
    assignedVisitId: textOrNull(row.assignedVisitId),
    reviewedByUserId: textOrNull(row.reviewedByUserId),
    reviewedAt: textOrNull(row.reviewedAt),
    clinicNote: textOrNull(row.clinicNote),
    createdAt: textOrNull(row.createdAt),
    updatedAt: textOrNull(row.updatedAt),
    patient: {
      id: textOrNull(patient.id),
      fullName: textOrNull(patient.fullName),
      code: textOrNull(patient.code),
    },
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    assignedVisit: row.assignedVisitId || assignedVisit.id
      ? {
          id: String(assignedVisit.id ?? row.assignedVisitId ?? ""),
          startedAt: textOrNull(assignedVisit.startedAt),
          status: textOrNull(assignedVisit.status),
        }
      : null,
  };
}

export function toSelfHostedClinicBookingRequestsPage(input: unknown): SelfHostedClinicBookingRequestsPage {
  const source = isRecord(input) ? input : {};
  const filters = nested(source, "filters");
  return {
    items: Array.isArray(source.items)
      ? source.items.map(toSelfHostedClinicBookingRequest).filter((item) => item.id)
      : [],
    count: Number.isFinite(Number(source.count)) ? Number(source.count) : 0,
    limit: Number.isFinite(Number(source.limit)) ? Number(source.limit) : 25,
    offset: Number.isFinite(Number(source.offset)) ? Number(source.offset) : 0,
    filters: {
      status: String(filters.status ?? "all"),
      search: textOrNull(filters.search),
    },
  };
}

function query(params: Record<string, string | number | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "" || value === "all") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function listSelfHostedClinicBookingRequests(
  args: ListSelfHostedClinicBookingRequestsArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicBookingRequestsPage>> {
  const result = await requestJson(
    args,
    `/api/v1/clinic/booking-requests${query({
      status: args.status,
      search: args.search,
      limit: args.limit,
      offset: args.offset,
    })}`,
    { method: "GET" },
  );
  return result.ok ? ok(toSelfHostedClinicBookingRequestsPage(result.value)) : fail(result.error);
}

export async function getSelfHostedClinicBookingRequest(
  args: GetSelfHostedClinicBookingRequestArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicBookingRequestDTO>> {
  const result = await requestJson(
    args,
    `/api/v1/clinic/booking-requests/${encodeURIComponent(args.requestId)}`,
    { method: "GET" },
  );
  return result.ok
    ? ok(toSelfHostedClinicBookingRequest(isRecord(result.value) ? result.value.item : result.value))
    : fail(result.error);
}

export async function updateSelfHostedClinicBookingRequest(
  args: UpdateSelfHostedClinicBookingRequestArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicBookingRequestDTO>> {
  const result = await requestJson(
    args,
    `/api/v1/clinic/booking-requests/${encodeURIComponent(args.requestId)}`,
    { method: "PATCH", body: args.payload },
  );
  return result.ok
    ? ok(toSelfHostedClinicBookingRequest(isRecord(result.value) ? result.value.item : result.value))
    : fail(result.error);
}

export async function bookSelfHostedClinicBookingRequestFromSlot(
  args: BookSelfHostedClinicBookingRequestFromSlotArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicBookingRequestDTO>> {
  const result = await requestJson(
    args,
    `/api/v1/clinic/booking-requests/${encodeURIComponent(args.requestId)}/book-from-slot`,
    { method: "POST", body: args.payload },
  );
  return result.ok
    ? ok(toSelfHostedClinicBookingRequest(isRecord(result.value) ? result.value.item : result.value))
    : fail(result.error);
}
