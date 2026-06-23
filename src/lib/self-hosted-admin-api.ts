import type { SelfHostedApiResult, SelfHostedApiError } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface AdminRoleBindingDTO {
  role: string;
  clinicId: string | null;
  clinicName: string | null;
  clinicSlug: string | null;
}

export interface AdminUserDTO {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  disabledAt: string | null;
  createdAt: string | null;
  roles: AdminRoleBindingDTO[];
}

export interface AdminClinicDTO {
  id: string;
  slug: string;
  name: string;
  address: string;
  timezone: string;
  createdAt: string | null;
  updatedAt?: string | null;
  usersCount?: number;
  patientsCount?: number;
  visitsCount?: number;
}

export interface AdminAnalyticsDTO {
  clinics: number;
  activeUsers: number;
  doctors: number;
  patients: number;
  visits: number;
  photos: number;
  signedReports: number;
  auditEvents7d: number;
  recentAuditEvents: Array<{
    id: string;
    action: string;
    entityType: string;
    actorName: string | null;
    clinicName: string | null;
    createdAt: string | null;
  }>;
}

export interface AdminPrivatePracticeDTO {
  clinic: AdminClinicDTO;
  owner: AdminUserDTO;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Рабочая сессия не подключена.",
};

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function authHeaders(token: string, withJson = false): HeadersInit {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
    ...(withJson ? { "Content-Type": "application/json" } : {}),
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

async function request<T>(args: BaseArgs, path: string, init: RequestInit = {}): Promise<SelfHostedApiResult<T>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(buildSelfHostedApiUrl(args.apiBaseUrl, path), {
      ...init,
      headers: {
        ...authHeaders(args.apiToken, Boolean(init.body)),
        ...(init.headers || {}),
      },
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к рабочей системе.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(body as T);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function normalizeRole(input: unknown): AdminRoleBindingDTO {
  const item = isRecord(input) ? input : {};
  return {
    role: String(item.role ?? ""),
    clinicId: item.clinicId == null ? null : String(item.clinicId),
    clinicName: item.clinicName == null ? null : String(item.clinicName),
    clinicSlug: item.clinicSlug == null ? null : String(item.clinicSlug),
  };
}

function normalizeUser(input: unknown): AdminUserDTO {
  const item = isRecord(input) ? input : {};
  return {
    id: String(item.id ?? ""),
    email: String(item.email ?? ""),
    displayName: String(item.displayName ?? ""),
    active: item.active !== false,
    disabledAt: item.disabledAt == null ? null : String(item.disabledAt),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    roles: Array.isArray(item.roles) ? item.roles.map(normalizeRole) : [],
  };
}

function normalizeClinic(input: unknown): AdminClinicDTO {
  const item = isRecord(input) ? input : {};
  return {
    id: String(item.id ?? ""),
    slug: String(item.slug ?? ""),
    name: String(item.name ?? ""),
    address: String(item.address ?? ""),
    timezone: String(item.timezone ?? "Europe/Moscow"),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    updatedAt: item.updatedAt == null ? null : String(item.updatedAt),
    usersCount: Number(item.usersCount ?? 0),
    patientsCount: Number(item.patientsCount ?? 0),
    visitsCount: Number(item.visitsCount ?? 0),
  };
}

function itemsFrom<T>(result: SelfHostedApiResult<unknown>, normalize: (item: unknown) => T): SelfHostedApiResult<T[]> {
  if (!result.ok) return result as SelfHostedApiResult<T[]>;
  const body = isRecord(result.value) ? result.value : {};
  const items = Array.isArray(body.items) ? body.items.map(normalize) : [];
  return ok(items);
}

export async function listAdminUsers(args: BaseArgs & { search?: string }): Promise<SelfHostedApiResult<AdminUserDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/users${query}`), normalizeUser);
}

export async function createAdminUser(
  args: BaseArgs & { payload: { email: string; displayName: string; password: string; role: string; clinicId?: string | null } },
): Promise<SelfHostedApiResult<AdminUserDTO>> {
  const result = await request(args, "/api/v1/admin/users", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminUserDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeUser(body.item));
}

export async function assignAdminUserRole(
  args: BaseArgs & { userId: string; payload: { role: string; clinicId?: string | null } },
): Promise<SelfHostedApiResult<AdminUserDTO>> {
  const result = await request(args, `/api/v1/admin/users/${encodeURIComponent(args.userId)}/role`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminUserDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeUser(body.item));
}

export async function disableAdminUser(args: BaseArgs & { userId: string }): Promise<SelfHostedApiResult<AdminUserDTO>> {
  const result = await request(args, `/api/v1/admin/users/${encodeURIComponent(args.userId)}/disable`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "admin_action" }),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminUserDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeUser(body.item));
}

export async function listAdminClinics(args: BaseArgs & { search?: string }): Promise<SelfHostedApiResult<AdminClinicDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/clinics${query}`), normalizeClinic);
}

export async function createAdminClinic(
  args: BaseArgs & { payload: { name: string; address?: string; slug?: string; timezone?: string } },
): Promise<SelfHostedApiResult<AdminClinicDTO>> {
  const result = await request(args, "/api/v1/admin/clinics", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinic(body.item));
}

export async function updateAdminClinic(
  args: BaseArgs & { clinicId: string; payload: { name?: string; address?: string; slug?: string; timezone?: string } },
): Promise<SelfHostedApiResult<AdminClinicDTO>> {
  const result = await request(args, `/api/v1/admin/clinics/${encodeURIComponent(args.clinicId)}`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinic(body.item));
}

export async function createAdminPrivatePractice(
  args: BaseArgs & {
    payload: {
      clinicName: string;
      address?: string;
      slug?: string;
      timezone?: string;
      ownerDisplayName: string;
      ownerEmail: string;
      ownerPassword: string;
    };
  },
): Promise<SelfHostedApiResult<AdminPrivatePracticeDTO>> {
  const result = await request(args, "/api/v1/admin/private-practices", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminPrivatePracticeDTO>;
  const body = isRecord(result.value) ? result.value : {};
  const item = isRecord(body.item) ? body.item : {};
  return ok({
    clinic: normalizeClinic(item.clinic),
    owner: normalizeUser(item.owner),
  });
}

export async function listAdminDoctors(args: BaseArgs & { search?: string }): Promise<SelfHostedApiResult<AdminUserDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/doctors${query}`), normalizeUser);
}

export async function createAdminDoctor(
  args: BaseArgs & { payload: { email: string; displayName: string; password: string; role: "doctor" | "private_doctor"; clinicId: string } },
): Promise<SelfHostedApiResult<AdminUserDTO>> {
  const result = await request(args, "/api/v1/admin/doctors", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminUserDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeUser(body.item));
}

export async function getAdminAnalytics(args: BaseArgs): Promise<SelfHostedApiResult<AdminAnalyticsDTO>> {
  const result = await request(args, "/api/v1/admin/analytics");
  if (!result.ok) return result as SelfHostedApiResult<AdminAnalyticsDTO>;
  const body = isRecord(result.value) ? result.value : {};
  const item = isRecord(body.item) ? body.item : {};
  return ok({
    clinics: Number(item.clinics ?? 0),
    activeUsers: Number(item.activeUsers ?? 0),
    doctors: Number(item.doctors ?? 0),
    patients: Number(item.patients ?? 0),
    visits: Number(item.visits ?? 0),
    photos: Number(item.photos ?? 0),
    signedReports: Number(item.signedReports ?? 0),
    auditEvents7d: Number(item.auditEvents7d ?? 0),
    recentAuditEvents: Array.isArray(item.recentAuditEvents)
      ? item.recentAuditEvents.map((event) => {
          const record = isRecord(event) ? event : {};
          return {
            id: String(record.id ?? ""),
            action: String(record.action ?? ""),
            entityType: String(record.entityType ?? ""),
            actorName: record.actorName == null ? null : String(record.actorName),
            clinicName: record.clinicName == null ? null : String(record.clinicName),
            createdAt: record.createdAt == null ? null : String(record.createdAt),
          };
        })
      : [],
  });
}

export function adminApiErrorText(error: SelfHostedApiError | null): string {
  if (!error) return "";
  if (error.details?.length) return error.details.map((item) => item.message).join(" ");
  return error.message || "Действие не выполнено.";
}
