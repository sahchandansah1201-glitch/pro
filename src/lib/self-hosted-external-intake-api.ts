// Stage 5Q · self-hosted external intake import API client.
// Operator UI reads import batches from the local backend only.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface ListSelfHostedExternalIntakeImportsArgs extends BaseArgs {
  sourceSystem?: string;
  limit?: number;
  offset?: number;
}

export interface SelfHostedExternalIntakeImportBatchDTO {
  id: string;
  clinicId: string | null;
  importedByUserId: string | null;
  sourceSystem: string;
  sourceReference: string | null;
  status: string;
  itemCount: number;
  acceptedBookingCount: number;
  acceptedSlotCount: number;
  rejectedCount: number;
  duplicateCount: number;
  idempotencyKey: string | null;
  hardeningVersion: string;
  createdAt: string | null;
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
  importedBy: {
    id: string | null;
    displayName: string | null;
  };
}

export interface SelfHostedExternalIntakeStatusDTO {
  sourceSystem: string;
  recentBatchCount: number;
  rejectedLast24h: number;
  duplicateLast24h: number;
  latestImportAt: string | null;
  openBookingRequestCount: number;
  availableSlotCount: number;
  storedRawPayload: boolean;
  runtimeCallsExternalSystems: boolean;
  hardeningVersion: string;
  latestBySource: Array<{
    sourceSystem: string;
    status: string;
    createdAt: string | null;
    itemCount: number;
    acceptedBookingCount: number;
    acceptedSlotCount: number;
    rejectedCount: number;
    duplicateCount: number;
    hardeningVersion: string;
  }>;
}

export interface SelfHostedExternalIntakeImportBatchesPage {
  items: SelfHostedExternalIntakeImportBatchDTO[];
  count: number;
  limit: number;
  offset: number;
  filters: {
    sourceSystem: string;
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

export function toSelfHostedExternalIntakeImportBatch(input: unknown): SelfHostedExternalIntakeImportBatchDTO {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  const importedBy = nested(row, "importedBy");
  return {
    id: String(row.id ?? ""),
    clinicId: textOrNull(row.clinicId),
    importedByUserId: textOrNull(row.importedByUserId),
    sourceSystem: String(row.sourceSystem ?? "other"),
    sourceReference: textOrNull(row.sourceReference),
    status: String(row.status ?? "completed"),
    itemCount: asNumber(row.itemCount),
    acceptedBookingCount: asNumber(row.acceptedBookingCount),
    acceptedSlotCount: asNumber(row.acceptedSlotCount),
    rejectedCount: asNumber(row.rejectedCount),
    duplicateCount: asNumber(row.duplicateCount),
    idempotencyKey: textOrNull(row.idempotencyKey),
    hardeningVersion: String(row.hardeningVersion ?? "stage5q"),
    createdAt: textOrNull(row.createdAt),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    importedBy: {
      id: textOrNull(importedBy.id),
      displayName: textOrNull(importedBy.displayName),
    },
  };
}

export function toSelfHostedExternalIntakeStatus(input: unknown): SelfHostedExternalIntakeStatusDTO {
  const row = isRecord(input) ? input : {};
  return {
    sourceSystem: String(row.sourceSystem ?? "all"),
    recentBatchCount: asNumber(row.recentBatchCount),
    rejectedLast24h: asNumber(row.rejectedLast24h),
    duplicateLast24h: asNumber(row.duplicateLast24h),
    latestImportAt: textOrNull(row.latestImportAt),
    openBookingRequestCount: asNumber(row.openBookingRequestCount),
    availableSlotCount: asNumber(row.availableSlotCount),
    storedRawPayload: row.storedRawPayload === true,
    runtimeCallsExternalSystems: row.runtimeCallsExternalSystems === true,
    hardeningVersion: String(row.hardeningVersion ?? "stage5t"),
    latestBySource: Array.isArray(row.latestBySource)
      ? row.latestBySource.map((item) => {
          const source = isRecord(item) ? item : {};
          return {
            sourceSystem: String(source.sourceSystem ?? "other"),
            status: String(source.status ?? "unknown"),
            createdAt: textOrNull(source.createdAt),
            itemCount: asNumber(source.itemCount),
            acceptedBookingCount: asNumber(source.acceptedBookingCount),
            acceptedSlotCount: asNumber(source.acceptedSlotCount),
            rejectedCount: asNumber(source.rejectedCount),
            duplicateCount: asNumber(source.duplicateCount),
            hardeningVersion: String(source.hardeningVersion ?? "stage5t"),
          };
        })
      : [],
  };
}

export function toSelfHostedExternalIntakeImportBatchesPage(input: unknown): SelfHostedExternalIntakeImportBatchesPage {
  const source = isRecord(input) ? input : {};
  const filters = nested(source, "filters");
  return {
    items: Array.isArray(source.items)
      ? source.items.map(toSelfHostedExternalIntakeImportBatch).filter((item) => item.id)
      : [],
    count: asNumber(source.count),
    limit: asNumber(source.limit) || 10,
    offset: asNumber(source.offset),
    filters: {
      sourceSystem: String(filters.sourceSystem ?? "all"),
    },
  };
}

export async function listSelfHostedExternalIntakeImports(
  args: ListSelfHostedExternalIntakeImportsArgs,
): Promise<SelfHostedApiResult<SelfHostedExternalIntakeImportBatchesPage>> {
  const result = await requestJson(
    args,
    `/api/v1/integrations/booking-imports${query({
      sourceSystem: args.sourceSystem,
      limit: args.limit,
      offset: args.offset,
    })}`,
  );
  return result.ok ? ok(toSelfHostedExternalIntakeImportBatchesPage(result.value)) : fail(result.error);
}

export async function getSelfHostedExternalIntakeStatus(
  args: ListSelfHostedExternalIntakeImportsArgs,
): Promise<SelfHostedApiResult<SelfHostedExternalIntakeStatusDTO>> {
  const result = await requestJson(
    args,
    `/api/v1/integrations/booking-imports/status${query({
      sourceSystem: args.sourceSystem,
    })}`,
  );
  const source = isRecord(result.value) && isRecord(result.value.item) ? result.value.item : result.value;
  return result.ok ? ok(toSelfHostedExternalIntakeStatus(source)) : fail(result.error);
}
