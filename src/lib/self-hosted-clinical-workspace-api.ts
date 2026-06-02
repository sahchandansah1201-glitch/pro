// Stage 5H · Self-hosted clinical workspace API client.
// Production assessment/conclusion/report contracts. No managed runtime coupling.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";
import type { SelfHostedVisitReportDTO, VisitReportPayload } from "@/lib/self-hosted-visit-write-api";

export interface SelfHostedClinicalAssessmentDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  status: "draft" | "ready" | "signed" | string;
  riskLevel: "low" | "moderate" | "high" | "urgent" | null;
  abcdTotal: number | null;
  sevenPointTotal: number | null;
  summary: string | null;
  recommendation: string | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedClinicalConclusionDTO {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  status: "draft" | "ready" | "signed" | string;
  summary: string | null;
  nextStep: string | null;
  followUpAt: string | null;
  signedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ClinicalAssessmentPayload {
  status?: "draft" | "ready" | "signed";
  riskLevel?: "low" | "moderate" | "high" | "urgent" | null;
  abcdTotal?: number | string | null;
  sevenPointTotal?: number | string | null;
  summary?: string | null;
  recommendation?: string | null;
}

export interface ClinicalConclusionPayload {
  status?: "draft" | "ready" | "signed";
  summary?: string | null;
  nextStep?: string | null;
  followUpAt?: string | null;
}

export type LesionComparisonDraftAction = "retake" | "excluded" | "report_limit";

export interface LesionComparisonDraftPayload {
  lesionId: string;
  pairKey: string;
  imageIds: [string, string];
  action: LesionComparisonDraftAction;
  comparability: "comparable" | "not_comparable";
  reasons: string[];
}

export interface SelfHostedLesionComparisonDraftDTO extends LesionComparisonDraftPayload {
  id: string;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  doctorUserId: string | null;
  patientDeliveryAllowed: false;
  protectedFieldsExposed: false;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SelfHostedLesionLongitudinalHistorySummaryDTO {
  visitCount: number;
  imageCount: number;
  candidatePairCount: number;
  comparablePairCount: number;
  warningPairCount: number;
  blockedPairCount: number;
  assessmentCount: number;
}

export interface SelfHostedLesionLongitudinalHistoryVisitDTO {
  visitId: string;
  startedAt: string | null;
  signedAt: string | null;
  status: string;
  imageCount: number;
  dermoscopyCount: number;
  overviewCount: number;
  assessmentCount: number;
  capturedAtFirst: string | null;
  capturedAtLast: string | null;
}

export interface SelfHostedLesionLongitudinalHistoryPairDTO {
  previousVisitId: string;
  currentVisitId: string;
  previousImageId: string;
  currentImageId: string;
  kind: string;
  status: "ready" | "warning" | "blocked";
  reasons: string[];
}

export interface SelfHostedLesionLongitudinalHistoryDTO {
  clinicId: string | null;
  patientId: string | null;
  lesionId: string;
  label: string | null;
  bodyZone: string | null;
  bodySurface: string | null;
  status: string;
  summary: SelfHostedLesionLongitudinalHistorySummaryDTO;
  visits: SelfHostedLesionLongitudinalHistoryVisitDTO[];
  candidatePairs: SelfHostedLesionLongitudinalHistoryPairDTO[];
  boundaries: {
    patientDeliveryAllowed: false;
    protectedFieldsExposed: false;
    storagePathsExposed: false;
    signedUrlsIssued: false;
    rawImageBytesExposed: false;
    doctorOnlyTextExposed: false;
    clinicalConclusionGenerated: false;
  };
}

interface BaseArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

interface VisitArgs extends BaseArgs {
  visitId: string;
}

interface PatchAssessmentArgs extends VisitArgs {
  payload: ClinicalAssessmentPayload;
}

interface PatchConclusionArgs extends VisitArgs {
  payload: ClinicalConclusionPayload;
}

interface PatchReportArgs extends VisitArgs {
  payload: VisitReportPayload;
}

interface PatchLesionComparisonDraftArgs extends VisitArgs {
  payload: LesionComparisonDraftPayload;
}

interface LesionLongitudinalHistoryArgs extends BaseArgs {
  patientId: string;
  lesionId: string;
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
  const details = Array.isArray(error?.details)
    ? error.details
        .filter(isRecord)
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

async function requestJson<T>(
  url: string,
  token: string,
  method: "GET" | "PATCH",
  payload: unknown,
  mapper: (item: Record<string, unknown>) => T,
): Promise<SelfHostedApiResult<T | null>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: method === "GET"
        ? authHeaders(token)
        : { ...authHeaders(token), "Content-Type": "application/json" },
      body: method === "GET" ? undefined : JSON.stringify(payload ?? {}),
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
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return ok(item ? mapper(item) : null);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function riskOrNull(value: unknown): SelfHostedClinicalAssessmentDTO["riskLevel"] {
  return value === "low" || value === "moderate" || value === "high" || value === "urgent" ? value : null;
}

function toAssessment(input: Record<string, unknown>): SelfHostedClinicalAssessmentDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    riskLevel: riskOrNull(input.riskLevel),
    abcdTotal: numberOrNull(input.abcdTotal),
    sevenPointTotal: numberOrNull(input.sevenPointTotal),
    summary: textOrNull(input.summary),
    recommendation: textOrNull(input.recommendation),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toConclusion(input: Record<string, unknown>): SelfHostedClinicalConclusionDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    summary: textOrNull(input.summary),
    nextStep: textOrNull(input.nextStep),
    followUpAt: textOrNull(input.followUpAt),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toReport(input: Record<string, unknown>): SelfHostedVisitReportDTO {
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    status: String(input.status ?? "draft"),
    physicianText: textOrNull(input.physicianText),
    patientSafeText: textOrNull(input.patientSafeText),
    signedAt: textOrNull(input.signedAt),
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map(String) : [];
}

function toRecordArray(input: unknown): Record<string, unknown>[] {
  return Array.isArray(input) ? input.filter(isRecord) : [];
}

function numberOrZero(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function toLesionComparisonDraft(input: Record<string, unknown>): SelfHostedLesionComparisonDraftDTO {
  const imageIds = toStringArray(input.imageIds).slice(0, 2);
  return {
    id: String(input.id ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    doctorUserId: textOrNull(input.doctorUserId),
    lesionId: String(input.lesionId ?? ""),
    pairKey: String(input.pairKey ?? ""),
    imageIds: [
      imageIds[0] ?? "",
      imageIds[1] ?? "",
    ],
    action: String(input.action ?? "retake") as LesionComparisonDraftAction,
    comparability: input.comparability === "comparable" ? "comparable" : "not_comparable",
    reasons: toStringArray(input.reasons),
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    createdAt: textOrNull(input.createdAt),
    updatedAt: textOrNull(input.updatedAt),
  };
}

function toLongitudinalPairStatus(value: unknown): SelfHostedLesionLongitudinalHistoryPairDTO["status"] {
  return value === "ready" || value === "warning" ? value : "blocked";
}

function toLesionLongitudinalHistory(input: Record<string, unknown>): SelfHostedLesionLongitudinalHistoryDTO {
  const summary = isRecord(input.summary) ? input.summary : {};
  return {
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    lesionId: String(input.lesionId ?? ""),
    label: textOrNull(input.label),
    bodyZone: textOrNull(input.bodyZone),
    bodySurface: textOrNull(input.bodySurface),
    status: String(input.status ?? "active"),
    summary: {
      visitCount: numberOrZero(summary.visitCount),
      imageCount: numberOrZero(summary.imageCount),
      candidatePairCount: numberOrZero(summary.candidatePairCount),
      comparablePairCount: numberOrZero(summary.comparablePairCount),
      warningPairCount: numberOrZero(summary.warningPairCount),
      blockedPairCount: numberOrZero(summary.blockedPairCount),
      assessmentCount: numberOrZero(summary.assessmentCount),
    },
    visits: toRecordArray(input.visits).map((visit) => ({
      visitId: String(visit.visitId ?? ""),
      startedAt: textOrNull(visit.startedAt),
      signedAt: textOrNull(visit.signedAt),
      status: String(visit.status ?? "draft"),
      imageCount: numberOrZero(visit.imageCount),
      dermoscopyCount: numberOrZero(visit.dermoscopyCount),
      overviewCount: numberOrZero(visit.overviewCount),
      assessmentCount: numberOrZero(visit.assessmentCount),
      capturedAtFirst: textOrNull(visit.capturedAtFirst),
      capturedAtLast: textOrNull(visit.capturedAtLast),
    })),
    candidatePairs: toRecordArray(input.candidatePairs).map((pair) => ({
      previousVisitId: String(pair.previousVisitId ?? ""),
      currentVisitId: String(pair.currentVisitId ?? ""),
      previousImageId: String(pair.previousImageId ?? ""),
      currentImageId: String(pair.currentImageId ?? ""),
      kind: String(pair.kind ?? ""),
      status: toLongitudinalPairStatus(pair.status),
      reasons: toStringArray(pair.reasons),
    })),
    boundaries: {
      patientDeliveryAllowed: false,
      protectedFieldsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      rawImageBytesExposed: false,
      doctorOnlyTextExposed: false,
      clinicalConclusionGenerated: false,
    },
  };
}

function visitUrl(apiBaseUrl: string | null | undefined, visitId: string, suffix: string): string {
  return buildSelfHostedApiUrl(apiBaseUrl, `/api/v1/visits/${encodeURIComponent(visitId)}${suffix}`);
}

function patientLesionUrl(
  apiBaseUrl: string | null | undefined,
  patientId: string,
  lesionId: string,
  suffix: string,
): string {
  return buildSelfHostedApiUrl(
    apiBaseUrl,
    `/api/v1/patients/${encodeURIComponent(patientId)}/lesions/${encodeURIComponent(lesionId)}${suffix}`,
  );
}

export async function getSelfHostedVisitAssessment(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalAssessmentDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/assessment"), args.apiToken as string, "GET", null, toAssessment);
}

export async function updateSelfHostedVisitAssessment(
  args: PatchAssessmentArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalAssessmentDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/assessment"), args.apiToken as string, "PATCH", args.payload, toAssessment);
}

export async function getSelfHostedVisitConclusion(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalConclusionDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/conclusion"), args.apiToken as string, "GET", null, toConclusion);
}

export async function updateSelfHostedVisitConclusion(
  args: PatchConclusionArgs,
): Promise<SelfHostedApiResult<SelfHostedClinicalConclusionDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/conclusion"), args.apiToken as string, "PATCH", args.payload, toConclusion);
}

export async function getSelfHostedVisitReport(
  args: VisitArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitReportDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/report"), args.apiToken as string, "GET", null, toReport);
}

export async function updateSelfHostedVisitReportContract(
  args: PatchReportArgs,
): Promise<SelfHostedApiResult<SelfHostedVisitReportDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(visitUrl(args.apiBaseUrl, args.visitId, "/report"), args.apiToken as string, "PATCH", args.payload, toReport);
}

export async function saveSelfHostedLesionComparisonDraft(
  args: PatchLesionComparisonDraftArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionComparisonDraftDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    visitUrl(args.apiBaseUrl, args.visitId, "/lesion-comparison-draft"),
    args.apiToken as string,
    "PATCH",
    args.payload,
    toLesionComparisonDraft,
  );
}

export async function getSelfHostedLesionLongitudinalHistory(
  args: LesionLongitudinalHistoryArgs,
): Promise<SelfHostedApiResult<SelfHostedLesionLongitudinalHistoryDTO | null>> {
  const cfg = ensureConfigured(args);
  if (cfg) return fail(cfg);
  return requestJson(
    patientLesionUrl(args.apiBaseUrl, args.patientId, args.lesionId, "/longitudinal-history"),
    args.apiToken as string,
    "GET",
    null,
    toLesionLongitudinalHistory,
  );
}
