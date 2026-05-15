// Stage 5N/5O · self-hosted patient portal API client.
// Production patient pages use only /api/v1/me/* from the self-hosted backend.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedPatientPortalPatient {
  id: string;
  code: string | null;
  fullName: string | null;
  birthDate: string | null;
  sex: string | null;
  phototype: string | null;
  imagingConsent: boolean;
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface SelfHostedPatientPortalAppointment {
  id: string;
  visitId: string;
  status: string;
  startedAt: string | null;
  signedAt: string | null;
  chiefComplaint: string | null;
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface SelfHostedPatientPortalReport {
  id: string;
  visitId: string | null;
  status: string;
  visitDate: string | null;
  signedAt: string | null;
  summary: string | null;
  patientSafeText: string | null;
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

export interface SelfHostedPatientPortalReminder {
  id: string;
  source: string;
  title: string;
  dueAt: string | null;
  status: string;
}

export interface SelfHostedPatientPortalReminderPreferences {
  appointmentRemindersEnabled: boolean;
  reportNotificationsEnabled: boolean;
  preferredChannel: "email" | "phone" | "none";
  updatedAt: string | null;
}

export interface SelfHostedPatientPortalBookingRequest {
  id: string;
  status: string;
  preferredFrom: string | null;
  preferredTo: string | null;
  reason: string | null;
  createdAt: string | null;
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
}

export interface SelfHostedPatientPortalOverview {
  patient: SelfHostedPatientPortalPatient;
  nextAppointment: SelfHostedPatientPortalAppointment | null;
  reports: SelfHostedPatientPortalReport[];
  reminders: SelfHostedPatientPortalReminder[];
  reminderPreferences: SelfHostedPatientPortalReminderPreferences;
  bookingRequests: SelfHostedPatientPortalBookingRequest[];
}

export interface CreatePatientPortalBookingRequestPayload {
  preferredFrom: string;
  preferredTo?: string | null;
  reason: string;
}

export interface UpdatePatientPortalReminderPreferencesPayload {
  appointmentRemindersEnabled?: boolean;
  reportNotificationsEnabled?: boolean;
  preferredChannel?: "email" | "phone" | "none";
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
  return {
    ...authHeaders(token),
    "Content-Type": "application/json",
  };
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
  init: { method?: "GET" | "POST" | "PATCH"; body?: unknown } = {},
): Promise<SelfHostedApiResult<unknown>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, path);
  const method = init.method ?? "GET";
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

function toPatient(input: unknown): SelfHostedPatientPortalPatient {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  return {
    id: String(row.id ?? ""),
    code: textOrNull(row.code),
    fullName: textOrNull(row.fullName),
    birthDate: textOrNull(row.birthDate),
    sex: textOrNull(row.sex),
    phototype: textOrNull(row.phototype),
    imagingConsent: Boolean(row.imagingConsent),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

function toAppointment(input: unknown): SelfHostedPatientPortalAppointment | null {
  if (!isRecord(input) || !input.id) return null;
  const clinic = nested(input, "clinic");
  return {
    id: String(input.id),
    visitId: String(input.visitId ?? input.id),
    status: String(input.status ?? "planned"),
    startedAt: textOrNull(input.startedAt),
    signedAt: textOrNull(input.signedAt),
    chiefComplaint: textOrNull(input.chiefComplaint),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

export function toSelfHostedPatientPortalReport(input: unknown): SelfHostedPatientPortalReport {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  const doctor = nested(row, "doctor");
  const patientSafeText = textOrNull(row.patientSafeText);
  return {
    id: String(row.id ?? ""),
    visitId: textOrNull(row.visitId),
    status: String(row.status ?? "signed"),
    visitDate: textOrNull(row.visitDate),
    signedAt: textOrNull(row.signedAt),
    summary: textOrNull(row.summary) || patientSafeText?.slice(0, 160) || null,
    patientSafeText,
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

function toReminder(input: unknown): SelfHostedPatientPortalReminder {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    source: String(row.source ?? "appointment"),
    title: String(row.title ?? "Напоминание"),
    dueAt: textOrNull(row.dueAt),
    status: String(row.status ?? "active"),
  };
}

function toReminderPreferences(input: unknown): SelfHostedPatientPortalReminderPreferences {
  const row = isRecord(input) ? input : {};
  const preferredChannel =
    row.preferredChannel === "phone" || row.preferredChannel === "none" ? row.preferredChannel : "email";
  return {
    appointmentRemindersEnabled: row.appointmentRemindersEnabled == null
      ? true
      : Boolean(row.appointmentRemindersEnabled),
    reportNotificationsEnabled: row.reportNotificationsEnabled == null
      ? true
      : Boolean(row.reportNotificationsEnabled),
    preferredChannel,
    updatedAt: textOrNull(row.updatedAt),
  };
}

export function toSelfHostedPatientPortalBookingRequest(input: unknown): SelfHostedPatientPortalBookingRequest {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? "requested"),
    preferredFrom: textOrNull(row.preferredFrom),
    preferredTo: textOrNull(row.preferredTo),
    reason: textOrNull(row.reason),
    createdAt: textOrNull(row.createdAt),
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
  };
}

export function toSelfHostedPatientPortalOverview(input: unknown): SelfHostedPatientPortalOverview {
  const source = isRecord(input) ? input : {};
  return {
    patient: toPatient(source.patient),
    nextAppointment: toAppointment(source.nextAppointment),
    reports: Array.isArray(source.reports)
      ? source.reports.map(toSelfHostedPatientPortalReport).filter((item) => item.id)
      : [],
    reminders: Array.isArray(source.reminders)
      ? source.reminders.map(toReminder).filter((item) => item.id)
      : [],
    reminderPreferences: toReminderPreferences(source.reminderPreferences),
    bookingRequests: Array.isArray(source.bookingRequests)
      ? source.bookingRequests.map(toSelfHostedPatientPortalBookingRequest).filter((item) => item.id)
      : [],
  };
}

export async function fetchSelfHostedPatientPortal(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientPortalOverview>> {
  const response = await requestJson(args, "/api/v1/me/portal");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalOverview(body.portal));
}

export async function fetchSelfHostedPatientPortalReport(
  args: BaseArgs & { reportId: string },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalReport>> {
  const response = await requestJson(args, `/api/v1/me/reports/${encodeURIComponent(args.reportId)}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalReport(body.item));
}

export async function createSelfHostedPatientPortalBookingRequest(
  args: BaseArgs & { payload: CreatePatientPortalBookingRequestPayload },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalBookingRequest>> {
  const response = await requestJson(args, "/api/v1/me/booking-requests", {
    method: "POST",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalBookingRequest(body.item));
}

export async function updateSelfHostedPatientPortalReminderPreferences(
  args: BaseArgs & { payload: UpdatePatientPortalReminderPreferencesPayload },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalReminderPreferences>> {
  const response = await requestJson(args, "/api/v1/me/reminder-preferences", {
    method: "PATCH",
    body: args.payload,
  });
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toReminderPreferences(body.item));
}
