import type { Patient, Phototype, Sex } from "@/lib/domain";

export interface SelfHostedApiError {
  kind: "not_configured" | "network" | "http" | "validation";
  code: string;
  message: string;
  status?: number;
  correlationId?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface SelfHostedApiResult<T> {
  ok: boolean;
  value: T | null;
  error: SelfHostedApiError | null;
}

export interface SelfHostedPatientDTO {
  id: string;
  code: string;
  fullName: string;
  birthDate: string | null;
  sex: "female" | "male" | "other" | "unknown";
  phototype: Phototype | null;
  imagingConsent: boolean;
  notes?: string | null;
  clinic?: {
    id?: string;
    slug?: string;
    name?: string;
  };
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface PatientWritePayload {
  clinicId?: string | null;
  code?: string | null;
  fullName: string;
  birthDate?: string | null;
  sex?: "female" | "male" | "other" | "unknown";
  phototype?: Phototype | null;
  imagingConsent?: boolean;
  notes?: string | null;
}

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface ListSelfHostedPatientsArgs extends BaseArgs {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface PatientMutationArgs extends BaseArgs {
  patientId: string;
}

export interface CreateSelfHostedPatientArgs extends BaseArgs {
  payload: PatientWritePayload;
}

export interface UpdateSelfHostedPatientArgs extends PatientMutationArgs {
  payload: Partial<PatientWritePayload>;
}

export interface ArchiveSelfHostedPatientArgs extends PatientMutationArgs {
  reason?: string | null;
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
  if (!args.apiToken) return NOT_CONFIGURED;
  return null;
}

export function buildSelfHostedApiUrl(baseUrl: string | null | undefined, path: string): string {
  const base = String(baseUrl ?? "").replace(/\/+$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${safePath}`;
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
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
    body && typeof body === "object" && "error" in body
      ? (body as { error?: Record<string, unknown>; correlationId?: unknown })
      : null;
  const error = errorBody?.error;
  const details = Array.isArray(error?.details)
    ? error.details
        .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
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

async function request(
  url: string,
  init: RequestInit,
): Promise<SelfHostedApiResult<unknown>> {
  let response: Response;
  try {
    response = await fetch(url, init);
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function normalizePhototype(input: unknown): Phototype | null {
  return input === "I" || input === "II" || input === "III" || input === "IV" || input === "V" || input === "VI"
    ? input
    : null;
}

function normalizeSex(input: unknown): SelfHostedPatientDTO["sex"] {
  if (input === "female" || input === "male" || input === "other" || input === "unknown") return input;
  return "unknown";
}

export function toSelfHostedPatientDTO(input: Record<string, unknown>): SelfHostedPatientDTO {
  const clinic = isRecord(input.clinic)
    ? {
        id: input.clinic.id ? String(input.clinic.id) : undefined,
        slug: input.clinic.slug ? String(input.clinic.slug) : undefined,
        name: input.clinic.name ? String(input.clinic.name) : undefined,
      }
    : undefined;
  return {
    id: String(input.id ?? ""),
    code: String(input.code ?? ""),
    fullName: String(input.fullName ?? ""),
    birthDate: input.birthDate ? String(input.birthDate).slice(0, 10) : null,
    sex: normalizeSex(input.sex),
    phototype: normalizePhototype(input.phototype),
    imagingConsent: Boolean(input.imagingConsent),
    notes: input.notes == null ? null : String(input.notes),
    clinic,
    createdAt: input.createdAt == null ? null : String(input.createdAt),
    updatedAt: input.updatedAt == null ? null : String(input.updatedAt),
    deletedAt: input.deletedAt == null ? null : String(input.deletedAt),
  };
}

export function selfHostedPatientToDomain(dto: SelfHostedPatientDTO): Patient {
  const sex: Sex = dto.sex === "female" ? "female" : "male";
  return {
    id: dto.id,
    code: dto.code,
    fullName: dto.fullName,
    birthDate: dto.birthDate ?? "1900-01-01",
    sex,
    phototype: dto.phototype ?? "II",
    riskFactors: [],
    consents: {
      pdn: true,
      imaging: dto.imagingConsent,
      telemed: false,
    },
    createdBy: "self-hosted-backend",
    createdAt: dto.createdAt ?? "",
  };
}

function extractItems(body: unknown): SelfHostedPatientDTO[] {
  const rawItems =
    Array.isArray(body)
      ? body
      : isRecord(body) && Array.isArray(body.items)
        ? body.items
        : [];
  return rawItems
    .filter(isRecord)
    .map(toSelfHostedPatientDTO)
    .filter((patient) => patient.id && patient.fullName);
}

function extractItem(body: unknown): SelfHostedPatientDTO | null {
  const raw = isRecord(body) && isRecord(body.item) ? body.item : isRecord(body) ? body : null;
  return raw ? toSelfHostedPatientDTO(raw) : null;
}

export async function listSelfHostedPatients(
  args: ListSelfHostedPatientsArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientDTO[]>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const params = new URLSearchParams();
  params.set("limit", String(args.limit ?? 200));
  params.set("offset", String(args.offset ?? 0));
  if (args.search?.trim()) params.set("search", args.search.trim());
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/patients?${params.toString()}`);
  const result = await request(url, {
    method: "GET",
    headers: authHeaders(args.apiToken as string),
  });
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  return ok(extractItems(result.value));
}

export async function getSelfHostedPatient(
  args: PatientMutationArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  if (!args.patientId) {
    return fail({ kind: "validation", code: "validation_error", message: "patientId обязателен." });
  }
  const result = await request(buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/patients/${args.patientId}`), {
    method: "GET",
    headers: authHeaders(args.apiToken as string),
  });
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const item = extractItem(result.value);
  return item ? ok(item) : fail({ kind: "http", code: "empty_response", message: "Backend вернул пустую карточку пациента." });
}

export async function createSelfHostedPatient(
  args: CreateSelfHostedPatientArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const result = await request(buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/patients"), {
    method: "POST",
    headers: {
      ...authHeaders(args.apiToken as string),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const item = extractItem(result.value);
  return item ? ok(item) : fail({ kind: "http", code: "empty_response", message: "Backend не вернул созданного пациента." });
}

export async function updateSelfHostedPatient(
  args: UpdateSelfHostedPatientArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const result = await request(buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/patients/${args.patientId}`), {
    method: "PATCH",
    headers: {
      ...authHeaders(args.apiToken as string),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const item = extractItem(result.value);
  return item ? ok(item) : fail({ kind: "http", code: "empty_response", message: "Backend не вернул обновлённого пациента." });
}

export async function archiveSelfHostedPatient(
  args: ArchiveSelfHostedPatientArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientDTO>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  const result = await request(buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/patients/${args.patientId}`), {
    method: "DELETE",
    headers: {
      ...authHeaders(args.apiToken as string),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason: args.reason ?? "Archived from Dermatolog Pro frontend" }),
  });
  if (!result.ok) return fail(result.error as SelfHostedApiError);
  const item = extractItem(result.value);
  return item ? ok(item) : fail({ kind: "http", code: "empty_response", message: "Backend не вернул архивированного пациента." });
}
