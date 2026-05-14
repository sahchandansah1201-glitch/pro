// Stage 5I · Self-hosted doctor dashboard API client.
// Production dashboard data must come from /api/v1/doctor/dashboard only.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export type { SelfHostedApiError } from "@/lib/self-hosted-patient-api";

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedDashboardKpis {
  visitsToday: number;
  activeVisits: number;
  awaitingConclusion: number;
  patientsInScope: number;
  assetsNeedReview: number;
  devicesTotal: number;
  devicesActive30d: number;
}

export interface SelfHostedDashboardVisit {
  id: string;
  patientId: string | null;
  patientFullName: string | null;
  patientCode: string | null;
  clinicId: string | null;
  clinicName: string | null;
  status: string;
  startedAt: string | null;
  signedAt: string | null;
  chiefComplaint: string | null;
}

export interface SelfHostedDashboardPatient {
  id: string;
  fullName: string;
  code: string;
  birthDate: string | null;
  sex: string | null;
  lastVisitAt: string | null;
}

export interface SelfHostedDashboardAssetIssue {
  id: string;
  visitId: string | null;
  patientId: string | null;
  patientFullName: string | null;
  kind: string;
  contentType: string | null;
  byteSize: number | null;
  capturedAt: string | null;
  issue: string;
}

export interface SelfHostedDashboardDevice {
  id: string;
  model: string;
  serial: string;
  status: string;
  lastSeenAt: string | null;
}

export interface SelfHostedDoctorDashboard {
  kpis: SelfHostedDashboardKpis;
  upcoming: SelfHostedDashboardVisit[];
  awaitingConclusions: SelfHostedDashboardVisit[];
  recentPatients: SelfHostedDashboardPatient[];
  assetIssues: SelfHostedDashboardAssetIssue[];
  devices: SelfHostedDashboardDevice[];
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

function asNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asStringOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function normalizeVisit(input: unknown): SelfHostedDashboardVisit {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    patientId: asStringOrNull(row.patientId),
    patientFullName: asStringOrNull(row.patientFullName),
    patientCode: asStringOrNull(row.patientCode),
    clinicId: asStringOrNull(row.clinicId),
    clinicName: asStringOrNull(row.clinicName),
    status: String(row.status ?? "draft"),
    startedAt: asStringOrNull(row.startedAt),
    signedAt: asStringOrNull(row.signedAt),
    chiefComplaint: asStringOrNull(row.chiefComplaint),
  };
}

function normalizePatient(input: unknown): SelfHostedDashboardPatient {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    fullName: String(row.fullName ?? ""),
    code: String(row.code ?? ""),
    birthDate: asStringOrNull(row.birthDate),
    sex: asStringOrNull(row.sex),
    lastVisitAt: asStringOrNull(row.lastVisitAt),
  };
}

function normalizeAssetIssue(input: unknown): SelfHostedDashboardAssetIssue {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    visitId: asStringOrNull(row.visitId),
    patientId: asStringOrNull(row.patientId),
    patientFullName: asStringOrNull(row.patientFullName),
    kind: String(row.kind ?? "overview_photo"),
    contentType: asStringOrNull(row.contentType),
    byteSize: row.byteSize == null ? null : asNumber(row.byteSize),
    capturedAt: asStringOrNull(row.capturedAt),
    issue: String(row.issue ?? "review"),
  };
}

function normalizeDevice(input: unknown): SelfHostedDashboardDevice {
  const row = isRecord(input) ? input : {};
  return {
    id: String(row.id ?? ""),
    model: String(row.model ?? ""),
    serial: String(row.serial ?? ""),
    status: String(row.status ?? "unknown"),
    lastSeenAt: asStringOrNull(row.lastSeenAt),
  };
}

export function toSelfHostedDoctorDashboard(input: unknown): SelfHostedDoctorDashboard {
  const row = isRecord(input) ? input : {};
  const kpis = isRecord(row.kpis) ? row.kpis : {};
  return {
    kpis: {
      visitsToday: asNumber(kpis.visitsToday),
      activeVisits: asNumber(kpis.activeVisits),
      awaitingConclusion: asNumber(kpis.awaitingConclusion),
      patientsInScope: asNumber(kpis.patientsInScope),
      assetsNeedReview: asNumber(kpis.assetsNeedReview),
      devicesTotal: asNumber(kpis.devicesTotal),
      devicesActive30d: asNumber(kpis.devicesActive30d),
    },
    upcoming: Array.isArray(row.upcoming) ? row.upcoming.map(normalizeVisit) : [],
    awaitingConclusions: Array.isArray(row.awaitingConclusions)
      ? row.awaitingConclusions.map(normalizeVisit)
      : [],
    recentPatients: Array.isArray(row.recentPatients) ? row.recentPatients.map(normalizePatient) : [],
    assetIssues: Array.isArray(row.assetIssues) ? row.assetIssues.map(normalizeAssetIssue) : [],
    devices: Array.isArray(row.devices) ? row.devices.map(normalizeDevice) : [],
  };
}

export async function getSelfHostedDoctorDashboard(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedDoctorDashboard>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/doctor/dashboard");
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
  const dashboard = isRecord(body) ? body.dashboard : null;
  return ok(toSelfHostedDoctorDashboard(dashboard));
}
