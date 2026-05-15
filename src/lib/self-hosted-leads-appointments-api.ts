// Stage 5K · Self-hosted leads/appointments API client.
// Production intake data comes from /api/v1/leads/appointments only.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface ListSelfHostedLeadsAppointmentsArgs extends BaseArgs {
  leadStatus?: string;
  appointmentStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
}

export interface CreateSelfHostedLeadArgs extends BaseArgs {
  payload: {
    clinicId?: string | null;
    patientId?: string | null;
    source?: string;
    safeSummary: string;
  };
}

export interface UpdateSelfHostedLeadStatusArgs extends BaseArgs {
  leadId: string;
  status: "new" | "qualified" | "lost";
}

export interface BookSelfHostedLeadAppointmentArgs extends BaseArgs {
  leadId: string;
  payload: {
    patientId?: string | null;
    doctorUserId?: string | null;
    startedAt: string;
    chiefComplaint?: string | null;
  };
}

export interface SelfHostedLeadsAppointmentsKpis {
  leadsTotal: number;
  newLeads: number;
  qualifiedLeads: number;
  bookedLeads: number;
  plannedAppointments: number;
  completedAppointments: number;
}

export interface SelfHostedLeadOverviewDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  source: string;
  status: string;
  safeSummary: string | null;
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
}

export interface SelfHostedAppointmentOverviewDTO {
  id: string;
  visitId: string;
  clinicId: string | null;
  patientId: string | null;
  doctorUserId: string | null;
  status: string;
  channel: string;
  slotAt: string | null;
  signedAt: string | null;
  chiefComplaint: string | null;
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

export interface SelfHostedLeadsAppointmentsOverview {
  kpis: SelfHostedLeadsAppointmentsKpis;
  leads: SelfHostedLeadOverviewDTO[];
  appointments: SelfHostedAppointmentOverviewDTO[];
  filters: {
    leadStatus: string;
    appointmentStatus: string;
    dateFrom: string | null;
    dateTo: string | null;
    search: string | null;
  };
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

const EMPTY_OVERVIEW: SelfHostedLeadsAppointmentsOverview = {
  kpis: {
    leadsTotal: 0,
    newLeads: 0,
    qualifiedLeads: 0,
    bookedLeads: 0,
    plannedAppointments: 0,
    completedAppointments: 0,
  },
  leads: [],
  appointments: [],
  filters: { leadStatus: "all", appointmentStatus: "all", dateFrom: null, dateTo: null, search: null },
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

async function requestJson(
  args: BaseArgs,
  path: string,
  init: RequestInit,
): Promise<SelfHostedApiResult<unknown>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, path);
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

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStringOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function safeNested(input: Record<string, unknown>, key: string): Record<string, unknown> {
  return isRecord(input[key]) ? input[key] as Record<string, unknown> : {};
}

function normalizeLead(input: unknown): SelfHostedLeadOverviewDTO {
  const row = isRecord(input) ? input : {};
  const patient = safeNested(row, "patient");
  const clinic = safeNested(row, "clinic");
  return {
    id: String(row.id ?? ""),
    clinicId: asStringOrNull(row.clinicId),
    patientId: asStringOrNull(row.patientId),
    source: String(row.source ?? "operator"),
    status: String(row.status ?? "new"),
    safeSummary: asStringOrNull(row.safeSummary),
    createdAt: asStringOrNull(row.createdAt),
    updatedAt: asStringOrNull(row.updatedAt),
    patient: {
      id: asStringOrNull(patient.id),
      fullName: asStringOrNull(patient.fullName),
      code: asStringOrNull(patient.code),
    },
    clinic: {
      id: asStringOrNull(clinic.id),
      slug: asStringOrNull(clinic.slug),
      name: asStringOrNull(clinic.name),
    },
  };
}

function normalizeAppointment(input: unknown): SelfHostedAppointmentOverviewDTO {
  const row = isRecord(input) ? input : {};
  const patient = safeNested(row, "patient");
  const clinic = safeNested(row, "clinic");
  return {
    id: String(row.id ?? ""),
    visitId: String(row.visitId ?? row.id ?? ""),
    clinicId: asStringOrNull(row.clinicId),
    patientId: asStringOrNull(row.patientId),
    doctorUserId: asStringOrNull(row.doctorUserId),
    status: String(row.status ?? "planned"),
    channel: String(row.channel ?? "self_hosted"),
    slotAt: asStringOrNull(row.slotAt),
    signedAt: asStringOrNull(row.signedAt),
    chiefComplaint: asStringOrNull(row.chiefComplaint),
    patient: {
      id: asStringOrNull(patient.id),
      fullName: asStringOrNull(patient.fullName),
      code: asStringOrNull(patient.code),
    },
    clinic: {
      id: asStringOrNull(clinic.id),
      slug: asStringOrNull(clinic.slug),
      name: asStringOrNull(clinic.name),
    },
  };
}

export function toSelfHostedLeadsAppointmentsOverview(input: unknown): SelfHostedLeadsAppointmentsOverview {
  const row = isRecord(input) ? input : {};
  const kpis = isRecord(row.kpis) ? row.kpis : {};
  const filters = isRecord(row.filters) ? row.filters : {};
  return {
    kpis: {
      leadsTotal: asNumber(kpis.leadsTotal),
      newLeads: asNumber(kpis.newLeads),
      qualifiedLeads: asNumber(kpis.qualifiedLeads),
      bookedLeads: asNumber(kpis.bookedLeads),
      plannedAppointments: asNumber(kpis.plannedAppointments),
      completedAppointments: asNumber(kpis.completedAppointments),
    },
    leads: Array.isArray(row.leads) ? row.leads.map(normalizeLead).filter((item) => item.id) : [],
    appointments: Array.isArray(row.appointments)
      ? row.appointments.map(normalizeAppointment).filter((item) => item.id)
      : [],
    filters: {
      leadStatus: String(filters.leadStatus ?? "all"),
      appointmentStatus: String(filters.appointmentStatus ?? "all"),
      dateFrom: asStringOrNull(filters.dateFrom),
      dateTo: asStringOrNull(filters.dateTo),
      search: asStringOrNull(filters.search),
    },
  };
}

export function buildDefaultSelfHostedLeadAppointmentStartedAt(base = new Date()): string {
  const nextDay = new Date(base.getTime());
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay.toISOString();
}

export async function listSelfHostedLeadsAppointments(
  args: ListSelfHostedLeadsAppointmentsArgs,
): Promise<SelfHostedApiResult<SelfHostedLeadsAppointmentsOverview>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const params = new URLSearchParams();
  if (args.leadStatus && args.leadStatus !== "all") params.set("leadStatus", args.leadStatus);
  if (args.appointmentStatus && args.appointmentStatus !== "all") {
    params.set("appointmentStatus", args.appointmentStatus);
  }
  if (args.dateFrom) params.set("dateFrom", args.dateFrom);
  if (args.dateTo) params.set("dateTo", args.dateTo);
  if (args.search) params.set("search", args.search);
  if (args.limit) params.set("limit", String(args.limit));
  const query = params.toString();
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/leads/appointments${query ? `?${query}` : ""}`);
  let response: Response;
  try {
    response = await fetch(url, { method: "GET", headers: authHeaders(args.apiToken || "") });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при обращении к self-hosted backend.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(toSelfHostedLeadsAppointmentsOverview(isRecord(body) ? body : EMPTY_OVERVIEW));
}

function extractLead(body: unknown): SelfHostedLeadOverviewDTO | null {
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return item ? normalizeLead(item) : null;
}

function extractBooking(body: unknown): {
  lead: SelfHostedLeadOverviewDTO;
  appointment: SelfHostedAppointmentOverviewDTO;
} | null {
  if (!isRecord(body) || !isRecord(body.item) || !isRecord(body.appointment)) return null;
  const lead = normalizeLead(body.item);
  const appointment = normalizeAppointment(body.appointment);
  return lead.id && appointment.id ? { lead, appointment } : null;
}

export async function createSelfHostedLead(
  args: CreateSelfHostedLeadArgs,
): Promise<SelfHostedApiResult<SelfHostedLeadOverviewDTO>> {
  const result = await requestJson(args, "/api/v1/leads", {
    method: "POST",
    headers: jsonHeaders(args.apiToken || ""),
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return fail(result.error || NOT_CONFIGURED);
  const lead = extractLead(result.value);
  return lead
    ? ok(lead)
    : fail({ kind: "http", code: "invalid_response", message: "Self-hosted backend вернул некорректный лид." });
}

export async function updateSelfHostedLeadStatus(
  args: UpdateSelfHostedLeadStatusArgs,
): Promise<SelfHostedApiResult<SelfHostedLeadOverviewDTO>> {
  const result = await requestJson(args, `/api/v1/leads/${encodeURIComponent(args.leadId)}`, {
    method: "PATCH",
    headers: jsonHeaders(args.apiToken || ""),
    body: JSON.stringify({ status: args.status }),
  });
  if (!result.ok) return fail(result.error || NOT_CONFIGURED);
  const lead = extractLead(result.value);
  return lead
    ? ok(lead)
    : fail({ kind: "http", code: "invalid_response", message: "Self-hosted backend вернул некорректный лид." });
}

export async function bookSelfHostedLeadAppointment(
  args: BookSelfHostedLeadAppointmentArgs,
): Promise<SelfHostedApiResult<{
  lead: SelfHostedLeadOverviewDTO;
  appointment: SelfHostedAppointmentOverviewDTO;
}>> {
  const result = await requestJson(args, `/api/v1/leads/${encodeURIComponent(args.leadId)}/book-appointment`, {
    method: "POST",
    headers: jsonHeaders(args.apiToken || ""),
    body: JSON.stringify(args.payload),
  });
  if (!result.ok) return fail(result.error || NOT_CONFIGURED);
  const booking = extractBooking(result.value);
  return booking
    ? ok(booking)
    : fail({ kind: "http", code: "invalid_response", message: "Self-hosted backend вернул некорректную запись." });
}
