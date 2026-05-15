// Stage 5R · self-hosted clinic availability API client.
// Reads local backend slot cache only; no browser call to clinic CRM/ad systems.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface ListSelfHostedClinicAvailableSlotsArgs extends BaseArgs {
  sourceSystem?: string;
  status?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number;
  offset?: number;
}

export interface SelfHostedClinicAvailableSlotDTO {
  id: string;
  clinicId: string | null;
  doctorUserId: string | null;
  sourceSystem: string;
  externalSlotId: string;
  startedAt: string | null;
  durationMinutes: number;
  status: string;
  importedAt: string | null;
  updatedAt: string | null;
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
  doctor: {
    id: string | null;
    displayName: string | null;
  };
}

export interface SelfHostedClinicAvailableSlotsPage {
  items: SelfHostedClinicAvailableSlotDTO[];
  count: number;
  limit: number;
  offset: number;
  filters: {
    sourceSystem: string;
    status: string;
    dateFrom: string | null;
    dateTo: string | null;
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
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

async function requestJson(args: BaseArgs, path: string): Promise<SelfHostedApiResult<unknown>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, path);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: authHeaders(String(args.apiToken)),
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

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nested(input: Record<string, unknown>, key: string): Record<string, unknown> {
  return isRecord(input[key]) ? input[key] : {};
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

export function toSelfHostedClinicAvailableSlot(input: unknown): SelfHostedClinicAvailableSlotDTO {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  const doctor = nested(row, "doctor");
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    doctorUserId: textOrNull(row.doctorUserId),
    sourceSystem: String(row.sourceSystem ?? "other"),
    externalSlotId: String(row.externalSlotId ?? ""),
    startedAt: textOrNull(row.startedAt),
    durationMinutes: asNumber(row.durationMinutes),
    status: String(row.status ?? "available"),
    importedAt: textOrNull(row.importedAt),
    updatedAt: textOrNull(row.updatedAt),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    doctor: {
      id: textOrNull(doctor.id),
      displayName: textOrNull(doctor.displayName),
    },
  };
}

export function toSelfHostedClinicAvailableSlotsPage(input: unknown): SelfHostedClinicAvailableSlotsPage {
  const source = isRecord(input) ? input : {};
  const filters = nested(source, "filters");
  return {
    items: Array.isArray(source.items)
      ? source.items.map(toSelfHostedClinicAvailableSlot).filter((item) => item.id)
      : [],
    count: asNumber(source.count),
    limit: asNumber(source.limit) || 20,
    offset: asNumber(source.offset),
    filters: {
      sourceSystem: String(filters.sourceSystem ?? "all"),
      status: String(filters.status ?? "available"),
      dateFrom: textOrNull(filters.dateFrom),
      dateTo: textOrNull(filters.dateTo),
    },
  };
}

export async function listSelfHostedClinicAvailableSlots(
  args: ListSelfHostedClinicAvailableSlotsArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicAvailableSlotsPage>> {
  const result = await requestJson(
    args,
    `/api/v1/clinic/available-slots${query({
      sourceSystem: args.sourceSystem,
      status: args.status,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
      limit: args.limit,
      offset: args.offset,
    })}`,
  );
  return result.ok ? ok(toSelfHostedClinicAvailableSlotsPage(result.value)) : fail(result.error);
}

