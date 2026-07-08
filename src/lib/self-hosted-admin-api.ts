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
  active: boolean;
  disabledAt: string | null;
  clinicStatus?: AdminClinicStatus;
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
  status: AdminClinicStatus;
  statusReason: string | null;
  statusChangedAt: string | null;
  createdAt: string | null;
  updatedAt?: string | null;
  usersCount?: number;
  patientsCount?: number;
  visitsCount?: number;
}

export type AdminClinicStatus = "active" | "suspended" | "archived";

export interface AdminClinicDeleteResultDTO {
  id: string | null;
  name: string | null;
  deleted: boolean;
  blockerCount: number;
  blockers: Record<string, number>;
}

export interface AdminRoleStatusDTO {
  userId: string;
  role: string;
  clinicId: string | null;
  status: "active" | "disabled";
  disabledAt: string | null;
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

export interface AdminAuditEventDTO {
  id: string;
  action: string;
  entityType: string;
  actorName: string | null;
  clinicName: string | null;
  createdAt: string | null;
}

export interface AdminPrivatePracticeDTO {
  clinic: AdminClinicDTO;
  owner: AdminUserDTO;
}

export type AdminClinicServiceCategory = "consult" | "procedure" | "imaging";

export interface AdminClinicServiceDTO {
  id: string;
  clinicId: string;
  clinicName: string;
  name: string;
  category: AdminClinicServiceCategory;
  durationMin: number;
  priceMin: number;
  priceMax: number;
  consentNote: string;
  onlineBooking: boolean;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type AdminClinicIntegrationKind = "crm" | "erp" | "mis" | "messenger" | "telephony";
export type AdminClinicIntegrationStatus = "draft" | "connected" | "disabled" | "error";

export interface AdminClinicIntegrationDTO {
  id: string;
  clinicId: string;
  clinicName: string;
  provider: string;
  kind: AdminClinicIntegrationKind;
  status: AdminClinicIntegrationStatus;
  safeSummaryEnabled: boolean;
  protectedLinkEnabled: boolean;
  fieldMap: Record<string, string>;
  lastCheckedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminClinicBotSettingsDTO {
  id: string;
  clinicId: string;
  clinicName: string;
  enabled: boolean;
  intakeSteps: Record<string, boolean>;
  templates: Record<string, string>;
  lastDryRunAt: string | null;
  updatedAt: string | null;
}

export type AdminServiceKeyStatus = "active" | "revoked";

export interface AdminServiceKeyDTO {
  id: string;
  label: string;
  owner: string;
  masked: string;
  scopes: string[];
  status: AdminServiceKeyStatus;
  lastUsedAt: string | null;
  expiresAt: string | null;
  rotatedAt: string | null;
  revokedAt: string | null;
  createdAt: string | null;
  secretOnce?: string;
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
    active: item.active !== false,
    disabledAt: item.disabledAt == null ? null : String(item.disabledAt),
    clinicStatus: item.clinicStatus == null ? undefined : (String(item.clinicStatus) as AdminClinicStatus),
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
    status: (String(item.status ?? "active") as AdminClinicStatus),
    statusReason: item.statusReason == null ? null : String(item.statusReason),
    statusChangedAt: item.statusChangedAt == null ? null : String(item.statusChangedAt),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    updatedAt: item.updatedAt == null ? null : String(item.updatedAt),
    usersCount: Number(item.usersCount ?? 0),
    patientsCount: Number(item.patientsCount ?? 0),
    visitsCount: Number(item.visitsCount ?? 0),
  };
}

function normalizeClinicDeleteResult(input: unknown): AdminClinicDeleteResultDTO {
  const item = isRecord(input) ? input : {};
  const blockers = isRecord(item.blockers) ? item.blockers : {};
  return {
    id: item.id == null ? null : String(item.id),
    name: item.name == null ? null : String(item.name),
    deleted: item.deleted === true,
    blockerCount: Number(item.blockerCount ?? 0),
    blockers: Object.fromEntries(Object.entries(blockers).map(([key, value]) => [key, Number(value ?? 0)])),
  };
}

function normalizeRoleStatus(input: unknown): AdminRoleStatusDTO {
  const item = isRecord(input) ? input : {};
  return {
    userId: String(item.userId ?? ""),
    role: String(item.role ?? ""),
    clinicId: item.clinicId == null ? null : String(item.clinicId),
    status: item.status === "disabled" ? "disabled" : "active",
    disabledAt: item.disabledAt == null ? null : String(item.disabledAt),
  };
}

function normalizeClinicService(input: unknown): AdminClinicServiceDTO {
  const item = isRecord(input) ? input : {};
  const category = String(item.category ?? "consult");
  return {
    id: String(item.id ?? ""),
    clinicId: String(item.clinicId ?? ""),
    clinicName: String(item.clinicName ?? ""),
    name: String(item.name ?? ""),
    category: (["consult", "procedure", "imaging"].includes(category) ? category : "consult") as AdminClinicServiceCategory,
    durationMin: Number(item.durationMin ?? 0),
    priceMin: Number(item.priceMin ?? 0),
    priceMax: Number(item.priceMax ?? 0),
    consentNote: String(item.consentNote ?? ""),
    onlineBooking: item.onlineBooking === true,
    active: item.active !== false,
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    updatedAt: item.updatedAt == null ? null : String(item.updatedAt),
  };
}

function stringRecord(input: unknown): Record<string, string> {
  const item = isRecord(input) ? input : {};
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, String(value ?? "")]));
}

function booleanRecord(input: unknown): Record<string, boolean> {
  const item = isRecord(input) ? input : {};
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value === true]));
}

function normalizeClinicIntegration(input: unknown): AdminClinicIntegrationDTO {
  const item = isRecord(input) ? input : {};
  const kind = String(item.kind ?? "crm");
  const status = String(item.status ?? "draft");
  return {
    id: String(item.id ?? ""),
    clinicId: String(item.clinicId ?? ""),
    clinicName: String(item.clinicName ?? ""),
    provider: String(item.provider ?? ""),
    kind: (["crm", "erp", "mis", "messenger", "telephony"].includes(kind) ? kind : "crm") as AdminClinicIntegrationKind,
    status: (["draft", "connected", "disabled", "error"].includes(status) ? status : "draft") as AdminClinicIntegrationStatus,
    safeSummaryEnabled: item.safeSummaryEnabled !== false,
    protectedLinkEnabled: item.protectedLinkEnabled !== false,
    fieldMap: stringRecord(item.fieldMap),
    lastCheckedAt: item.lastCheckedAt == null ? null : String(item.lastCheckedAt),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    updatedAt: item.updatedAt == null ? null : String(item.updatedAt),
  };
}

function normalizeClinicBotSettings(input: unknown): AdminClinicBotSettingsDTO {
  const item = isRecord(input) ? input : {};
  return {
    id: String(item.id ?? ""),
    clinicId: String(item.clinicId ?? ""),
    clinicName: String(item.clinicName ?? ""),
    enabled: item.enabled !== false,
    intakeSteps: booleanRecord(item.intakeSteps),
    templates: stringRecord(item.templates),
    lastDryRunAt: item.lastDryRunAt == null ? null : String(item.lastDryRunAt),
    updatedAt: item.updatedAt == null ? null : String(item.updatedAt),
  };
}

function normalizeAuditEvent(input: unknown): AdminAuditEventDTO {
  const item = isRecord(input) ? input : {};
  return {
    id: String(item.id ?? ""),
    action: String(item.action ?? ""),
    entityType: String(item.entityType ?? ""),
    actorName: item.actorName == null ? null : String(item.actorName),
    clinicName: item.clinicName == null ? null : String(item.clinicName),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
  };
}

function normalizeServiceKey(input: unknown, { includeSecretOnce = false } = {}): AdminServiceKeyDTO {
  const item = isRecord(input) ? input : {};
  return {
    id: String(item.id ?? ""),
    label: String(item.label ?? ""),
    owner: String(item.owner ?? ""),
    masked: String(item.masked ?? ""),
    scopes: Array.isArray(item.scopes) ? item.scopes.map(String) : [],
    status: item.status === "revoked" ? "revoked" : "active",
    lastUsedAt: item.lastUsedAt == null ? null : String(item.lastUsedAt),
    expiresAt: item.expiresAt == null ? null : String(item.expiresAt),
    rotatedAt: item.rotatedAt == null ? null : String(item.rotatedAt),
    revokedAt: item.revokedAt == null ? null : String(item.revokedAt),
    createdAt: item.createdAt == null ? null : String(item.createdAt),
    secretOnce: includeSecretOnce && item.secretOnce != null ? String(item.secretOnce) : undefined,
  };
}

function normalizeServiceKeyWithSecret(input: unknown): AdminServiceKeyDTO {
  return normalizeServiceKey(input, { includeSecretOnce: true });
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

export async function reactivateAdminUser(args: BaseArgs & { userId: string }): Promise<SelfHostedApiResult<AdminUserDTO>> {
  const result = await request(args, `/api/v1/admin/users/${encodeURIComponent(args.userId)}/reactivate`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "admin_action" }),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminUserDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeUser(body.item));
}

export async function setAdminUserRoleStatus(
  args: BaseArgs & {
    userId: string;
    payload: { role: string; clinicId?: string | null; status: "active" | "disabled"; reason?: string | null };
  },
): Promise<SelfHostedApiResult<AdminRoleStatusDTO>> {
  const result = await request(args, `/api/v1/admin/users/${encodeURIComponent(args.userId)}/role-status`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminRoleStatusDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeRoleStatus(body.item));
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

export async function setAdminClinicStatus(
  args: BaseArgs & { clinicId: string; payload: { status: AdminClinicStatus; reason?: string | null } },
): Promise<SelfHostedApiResult<AdminClinicDTO>> {
  const result = await request(args, `/api/v1/admin/clinics/${encodeURIComponent(args.clinicId)}/status`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinic(body.item));
}

export async function deleteAdminClinic(args: BaseArgs & { clinicId: string }): Promise<SelfHostedApiResult<AdminClinicDeleteResultDTO>> {
  const result = await request(args, `/api/v1/admin/clinics/${encodeURIComponent(args.clinicId)}`, {
    method: "DELETE",
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicDeleteResultDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicDeleteResult(body.item));
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

export async function listAdminClinicServices(
  args: BaseArgs & { search?: string },
): Promise<SelfHostedApiResult<AdminClinicServiceDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/services${query}`), normalizeClinicService);
}

export async function createAdminClinicService(
  args: BaseArgs & {
    payload: {
      clinicId: string;
      name: string;
      category: AdminClinicServiceCategory;
      durationMin: number;
      priceMin: number;
      priceMax: number;
      consentNote?: string;
      onlineBooking: boolean;
      active: boolean;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicServiceDTO>> {
  const result = await request(args, "/api/v1/admin/services", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicServiceDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicService(body.item));
}

export async function updateAdminClinicService(
  args: BaseArgs & {
    serviceId: string;
    payload: {
      clinicId: string;
      name: string;
      category: AdminClinicServiceCategory;
      durationMin: number;
      priceMin: number;
      priceMax: number;
      consentNote?: string;
      onlineBooking: boolean;
      active: boolean;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicServiceDTO>> {
  const result = await request(args, `/api/v1/admin/services/${encodeURIComponent(args.serviceId)}`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicServiceDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicService(body.item));
}

export async function listAdminClinicIntegrations(
  args: BaseArgs & { search?: string },
): Promise<SelfHostedApiResult<AdminClinicIntegrationDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/integrations${query}`), normalizeClinicIntegration);
}

export async function createAdminClinicIntegration(
  args: BaseArgs & {
    payload: {
      clinicId: string;
      provider: string;
      kind: AdminClinicIntegrationKind;
      status?: AdminClinicIntegrationStatus;
      safeSummaryEnabled?: boolean;
      protectedLinkEnabled?: boolean;
      fieldMap?: Record<string, string>;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicIntegrationDTO>> {
  const result = await request(args, "/api/v1/admin/integrations", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicIntegrationDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicIntegration(body.item));
}

export async function getAdminClinicIntegration(
  args: BaseArgs & { integrationId: string },
): Promise<SelfHostedApiResult<AdminClinicIntegrationDTO>> {
  const result = await request(args, `/api/v1/admin/integrations/${encodeURIComponent(args.integrationId)}`);
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicIntegrationDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicIntegration(body.item));
}

export async function updateAdminClinicIntegration(
  args: BaseArgs & {
    integrationId: string;
    payload: {
      clinicId: string;
      provider?: string;
      kind?: AdminClinicIntegrationKind;
      status?: AdminClinicIntegrationStatus;
      safeSummaryEnabled?: boolean;
      protectedLinkEnabled?: boolean;
      fieldMap?: Record<string, string>;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicIntegrationDTO>> {
  const result = await request(args, `/api/v1/admin/integrations/${encodeURIComponent(args.integrationId)}`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicIntegrationDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicIntegration(body.item));
}

export async function checkAdminClinicIntegration(
  args: BaseArgs & { integrationId: string; payload: { clinicId: string } },
): Promise<SelfHostedApiResult<AdminClinicIntegrationDTO>> {
  const result = await request(args, `/api/v1/admin/integrations/${encodeURIComponent(args.integrationId)}/check`, {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicIntegrationDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicIntegration(body.item));
}

export async function listAdminClinicBotSettings(args: BaseArgs): Promise<SelfHostedApiResult<AdminClinicBotSettingsDTO[]>> {
  return itemsFrom(await request(args, "/api/v1/admin/bot-settings"), normalizeClinicBotSettings);
}

export async function updateAdminClinicBotSettings(
  args: BaseArgs & {
    payload: {
      clinicId: string;
      enabled: boolean;
      intakeSteps: Record<string, boolean>;
      templates: Record<string, string>;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicBotSettingsDTO>> {
  const result = await request(args, "/api/v1/admin/bot-settings", {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicBotSettingsDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicBotSettings(body.item));
}

export async function dryRunAdminClinicBotSettings(
  args: BaseArgs & {
    payload: {
      clinicId: string;
      enabled: boolean;
      intakeSteps: Record<string, boolean>;
      templates: Record<string, string>;
    };
  },
): Promise<SelfHostedApiResult<AdminClinicBotSettingsDTO>> {
  const result = await request(args, "/api/v1/admin/bot-settings/dry-run", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminClinicBotSettingsDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeClinicBotSettings(body.item));
}

export async function listAdminAuditEvents(args: BaseArgs): Promise<SelfHostedApiResult<AdminAuditEventDTO[]>> {
  return itemsFrom(await request(args, "/api/v1/admin/audit-events"), normalizeAuditEvent);
}

export async function listAdminServiceKeys(args: BaseArgs & { search?: string }): Promise<SelfHostedApiResult<AdminServiceKeyDTO[]>> {
  const query = args.search ? `?search=${encodeURIComponent(args.search)}` : "";
  return itemsFrom(await request(args, `/api/v1/admin/service-keys${query}`), normalizeServiceKey);
}

export async function createAdminServiceKey(
  args: BaseArgs & {
    payload: {
      label: string;
      owner: string;
      scopes: string[];
      expiresInDays: number;
    };
  },
): Promise<SelfHostedApiResult<AdminServiceKeyDTO>> {
  const result = await request(args, "/api/v1/admin/service-keys", {
    method: "POST",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminServiceKeyDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeServiceKeyWithSecret(body.item));
}

export async function rotateAdminServiceKey(
  args: BaseArgs & { keyId: string; payload: { expiresInDays: number } },
): Promise<SelfHostedApiResult<AdminServiceKeyDTO>> {
  const result = await request(args, `/api/v1/admin/service-keys/${encodeURIComponent(args.keyId)}/rotate`, {
    method: "PATCH",
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminServiceKeyDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeServiceKeyWithSecret(body.item));
}

export async function revokeAdminServiceKey(args: BaseArgs & { keyId: string }): Promise<SelfHostedApiResult<AdminServiceKeyDTO>> {
  const result = await request(args, `/api/v1/admin/service-keys/${encodeURIComponent(args.keyId)}/revoke`, {
    method: "PATCH",
    body: JSON.stringify({ reason: "admin_action" }),
  });
  if (!result.ok) return result as SelfHostedApiResult<AdminServiceKeyDTO>;
  const body = isRecord(result.value) ? result.value : {};
  return ok(normalizeServiceKey(body.item));
}

export function adminApiErrorText(error: SelfHostedApiError | null): string {
  if (!error) return "";
  if (error.details?.length) return error.details.map((item) => item.message).join(" ");
  if (isAdminSessionExpiredError(error)) {
    return "Сессия истекла. Выйдите и войдите в систему заново.";
  }
  if (error.status === 403) {
    return "У этой учётной записи нет доступа к действию. Проверьте роль или войдите под другой учётной записью.";
  }
  if (error.code === "database_unavailable") {
    return "Рабочая база временно недоступна или схема ещё обновляется. Повторите действие после завершения обновления сервера.";
  }
  if (error.code === "database_not_configured") {
    return "Рабочая база не подключена. Проверьте настройки self-hosted сервера.";
  }
  return error.message || "Действие не выполнено.";
}

export function isAdminSessionExpiredError(error: SelfHostedApiError | null): boolean {
  if (!error) return false;
  return (
    error.status === 401 ||
    error.code === "invalid_token" ||
    error.code === "token_expired" ||
    /expired authorization token/i.test(error.message)
  );
}
