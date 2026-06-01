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
  accessExpiresAt: string | null;
  accessStatus: string;
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

export interface SelfHostedPatientPortalPhotoProtocolPhoto {
  sequence: number;
  kind: string;
  contentType: string | null;
  capturedAt: string | null;
  lesionLabel: string | null;
  bodyZone: string | null;
  bodySurface: string | null;
  previewAvailable: false;
}

export interface SelfHostedPatientPortalPhotoProtocolAuditEntry {
  kind: string;
  label: string;
  occurredAt: string | null;
}

export interface SelfHostedPatientPortalPhotoProtocol {
  id: string;
  visitId: string | null;
  reportId: string | null;
  status: string;
  accessStatus: string;
  selectedPhotoCount: number;
  counts: {
    selectedPhotos: number;
    overviewPhotos: number;
    dermoscopyPhotos: number;
    reportAttachments: number;
  };
  preparedAt: string | null;
  revokedAt: string | null;
  expiresAt: string | null;
  blockerCount: number;
  patientSafeTextAvailable: boolean;
  availabilityMessages: string[];
  auditTrail: SelfHostedPatientPortalPhotoProtocolAuditEntry[];
  deliveryBoundary: {
    patientDeliveryAllowed: false;
    rawFilesExposed: false;
    signedUrlsIssued: false;
    storagePathsExposed: false;
    tokensExposed: false;
    doctorOnlyTextExposed: false;
    fileProxyReady: boolean;
    requiresIdentityCheck: boolean;
    requiresRetentionPolicy: boolean;
    requiresApprovedPatientCopy: boolean;
  };
  photos: SelfHostedPatientPortalPhotoProtocolPhoto[];
}

export interface SelfHostedPatientPortalPhotoProtocolPhotoFile {
  sequence: number;
  blob: Blob;
  contentType: string;
  fileName: string;
}

export interface SelfHostedPatientPortalPhotoProtocolAccessExchange {
  visitId: string | null;
  status: "confirmed" | "denied";
  accessStatus: string;
  deniedReason: string | null;
  sessionExpiresAt: string | null;
  sessionBoundary: {
    sessionEstablished: boolean;
    rawCredentialExposed: false;
    credentialHashExposed: false;
    credentialFingerprintExposed: false;
    rawSessionIdExposed: false;
    sessionHashExposed: false;
    sessionFingerprintExposed: false;
    qrTokenExposed: false;
    signedUrlsIssued: false;
    storagePathsExposed: false;
    doctorOnlyTextExposed: false;
  };
}

export interface SelfHostedPatientPortalHistoryLesion {
  id: string;
  title: string;
  bodyZone: string | null;
  bodySurface: string | null;
  status: string;
  stateLabel: string;
  firstSeenAt: string | null;
  checkedAt: string | null;
  snapshotCount: number;
  comparableSnapshotCount: number;
  nextStep: string;
  comparisonState: string;
}

export interface SelfHostedPatientPortalHistoryTimelineItem {
  id: string;
  visitId: string | null;
  visitDate: string | null;
  visitStatus: string;
  stateLabel: string;
  clinicName: string | null;
  summary: string | null;
  observedCount: number;
  snapshotCount: number;
}

export interface SelfHostedPatientPortalHistoryRetentionGovernance {
  releasesTotal: number;
  retentionApproved: number;
  patientCopyApproved: number;
  fileProxyEnabled: number;
  expiresConfigured: number;
  policyReady: number;
  status: "no_releases" | "policy_in_progress" | "policy_ready";
}

export interface SelfHostedPatientPortalHistoryBoundary {
  comparisonRequiresDoctorReview: true;
  clinicalDecisionExposed: false;
  rawFilesExposed: false;
  doctorOnlyTextExposed: false;
}

export interface SelfHostedPatientPortalHistoryComparisonOperations {
  lesionsTotal: number;
  readyForDoctorReview: number;
  requiresNextCapture: number;
  visitsWithComparableSeries: number;
  comparableCoveragePercent: number;
  status: "no_series" | "needs_capture" | "partial_ready" | "ready_for_review";
  doctorReviewRequired: true;
}

export interface SelfHostedPatientPortalHistorySessionLifecycle {
  preparedAccessWindows: number;
  revokedAccessWindows: number;
  activeAccessWindows: number;
  expiringIn24h: number;
  expiredAccessWindows: number;
  missingExpiry: number;
  identityCheckEnabled: number;
  policyReadyAccessWindows: number;
  status: "no_access_windows" | "governance_attention" | "governance_ready";
  sessionBoundary: {
    temporaryCredentialsExposed: false;
    qrSessionExposed: false;
    rawTokensExposed: false;
  };
}

export interface SelfHostedPatientPortalHistory {
  clinic: {
    id: string | null;
    slug: string | null;
    name: string | null;
  };
  lesions: SelfHostedPatientPortalHistoryLesion[];
  timeline: SelfHostedPatientPortalHistoryTimelineItem[];
  retentionGovernance: SelfHostedPatientPortalHistoryRetentionGovernance;
  comparisonOperations: SelfHostedPatientPortalHistoryComparisonOperations;
  sessionLifecycle: SelfHostedPatientPortalHistorySessionLifecycle;
  longitudinalBoundary: SelfHostedPatientPortalHistoryBoundary;
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

export interface ExchangePatientPortalPhotoProtocolAccessPayload {
  credential: string;
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

async function requestBlob(
  args: BaseArgs,
  path: string,
): Promise<SelfHostedApiResult<{ response: Response; blob: Blob }>> {
  const configError = ensureConfigured(args);
  if (configError) return fail(configError);
  const url = buildSelfHostedApiUrl(args.apiBaseUrl, path);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: { Accept: "image/*", Authorization: `Bearer ${String(args.apiToken)}` },
    });
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при загрузке фото из self-hosted backend.",
    });
  }
  if (!response.ok) {
    const body = await parseJsonSafe(response);
    return fail(apiErrorFromBody(response, body));
  }
  return ok({ response, blob: await response.blob() });
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrZero(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function imageExtension(contentType: string): string {
  const text = contentType.toLowerCase();
  if (text.includes("png")) return "png";
  if (text.includes("webp")) return "webp";
  if (text.includes("heic")) return "heic";
  if (text.includes("heif")) return "heif";
  return "jpg";
}

function patientPhotoProtocolDownloadErrorMessage(error: SelfHostedApiError): string {
  switch (error.code) {
    case "photo_protocol_revoked":
      return "Доступ к фото отозван клиникой.";
    case "photo_protocol_not_prepared":
      return "Фото-протокол ещё не подготовлен клиникой.";
    case "photo_protocol_proxy_disabled":
      return "Клиника ещё не включила защищённую выдачу фото.";
    case "photo_protocol_consent_missing":
      return "Клиника не подтвердила согласие на медицинскую съёмку.";
    case "photo_protocol_retention_required":
      return "Клиника не подтвердила срок и политику доступа к фото.";
    case "photo_protocol_expired":
      return "Срок доступа к фото истёк.";
    case "photo_protocol_photo_not_found":
    case "photo_protocol_binary_not_found":
      return "Фото сейчас недоступно в защищённом контуре.";
    case "photo_protocol_object_store_unavailable":
      return "Сервис выдачи фото временно недоступен.";
    default:
      return error.message || "Фото сейчас недоступно: доступ управляется клиникой.";
  }
}

function patientPhotoProtocolAccessExchangeErrorMessage(error: SelfHostedApiError): string {
  switch (error.code) {
    case "photo_protocol_access_credential_invalid":
      return "Доступ не подтверждён.";
    case "photo_protocol_access_revoked":
      return "Доступ отозван клиникой.";
    case "photo_protocol_access_expired":
      return "Срок доступа истёк.";
    case "photo_protocol_access_retention_required":
      return "Клиника не подтвердила срок и политику доступа к фото.";
    case "photo_protocol_access_policy_blocked":
      return "Клиника ещё не завершила проверку безопасной выдачи.";
    case "photo_protocol_access_proxy_disabled":
      return "Клиника ещё не включила защищённую выдачу фото.";
    case "photo_protocol_access_consent_missing":
      return "Клиника не подтвердила согласие на медицинскую съёмку.";
    case "photo_protocol_access_not_configured":
      return "Контур подтверждения доступа не настроен клиникой.";
    case "photo_protocol_access_not_found":
      return "Доступ к фото-протоколу не найден.";
    default:
      return error.message || "Доступ сейчас не подтверждён.";
  }
}

function fileNameFromDisposition(value: string | null, fallback: string): string {
  const match = value?.match(/filename="?([^";]+)"?/i);
  return match?.[1] ? match[1] : fallback;
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
    accessExpiresAt: textOrNull(row.accessExpiresAt ?? row.expiresAt),
    accessStatus: String(row.accessStatus ?? "released"),
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

function toSelfHostedPatientPortalPhotoProtocolPhoto(input: unknown): SelfHostedPatientPortalPhotoProtocolPhoto {
  const row = isRecord(input) ? input : {};
  return {
    sequence: numberOrZero(row.sequence),
    kind: String(row.kind ?? "photo"),
    contentType: textOrNull(row.contentType),
    capturedAt: textOrNull(row.capturedAt),
    lesionLabel: textOrNull(row.lesionLabel),
    bodyZone: textOrNull(row.bodyZone),
    bodySurface: textOrNull(row.bodySurface),
    previewAvailable: false,
  };
}

function toSelfHostedPatientPortalPhotoProtocolAuditEntry(
  input: unknown,
): SelfHostedPatientPortalPhotoProtocolAuditEntry {
  const row = isRecord(input) ? input : {};
  return {
    kind: String(row.kind ?? "event"),
    label: String(row.label ?? "Событие доступа"),
    occurredAt: textOrNull(row.occurredAt),
  };
}

function lesionStateLabel(status: string): string {
  switch (status) {
    case "active":
      return "Врачебная проверка";
    case "monitoring":
      return "Плановое наблюдение";
    case "removed":
    case "archived":
      return "Архив";
    default:
      return "Под наблюдением";
  }
}

function visitStateLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Запланирован";
    case "in_progress":
      return "Открыт";
    case "closed":
      return "Завершён";
    case "cancelled":
      return "Отменён";
    default:
      return "В работе";
  }
}

function toSelfHostedPatientPortalHistoryLesion(input: unknown): SelfHostedPatientPortalHistoryLesion {
  const row = isRecord(input) ? input : {};
  const status = String(row.status ?? "active");
  const comparableSnapshotCount = numberOrZero(row.comparableSnapshotCount);
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.label ?? "Очаг"),
    bodyZone: textOrNull(row.bodyZone),
    bodySurface: textOrNull(row.bodySurface),
    status,
    stateLabel: String(row.stateLabel ?? lesionStateLabel(status)),
    firstSeenAt: textOrNull(row.firstSeenAt),
    checkedAt: textOrNull(row.checkedAt),
    snapshotCount: numberOrZero(row.snapshotCount),
    comparableSnapshotCount,
    nextStep: String(row.nextStep ?? "Покажите динамику врачу на контрольном визите."),
    comparisonState: String(
      row.comparisonState
      ?? (comparableSnapshotCount >= 2
        ? "Есть серия снимков для врачебного сравнения."
        : "Динамика появится после следующего контрольного визита."),
    ),
  };
}

function toSelfHostedPatientPortalHistoryTimelineItem(input: unknown): SelfHostedPatientPortalHistoryTimelineItem {
  const row = isRecord(input) ? input : {};
  const visitStatus = String(row.visitStatus ?? row.status ?? "closed");
  return {
    id: String(row.id ?? ""),
    visitId: textOrNull(row.visitId ?? row.id),
    visitDate: textOrNull(row.visitDate),
    visitStatus,
    stateLabel: String(row.stateLabel ?? visitStateLabel(visitStatus)),
    clinicName: textOrNull(row.clinicName),
    summary: textOrNull(row.summary),
    observedCount: numberOrZero(row.observedCount),
    snapshotCount: numberOrZero(row.snapshotCount),
  };
}

function toSelfHostedPatientPortalHistoryRetentionGovernance(
  input: unknown,
): SelfHostedPatientPortalHistoryRetentionGovernance {
  const row = isRecord(input) ? input : {};
  const releasesTotal = numberOrZero(row.releasesTotal);
  const policyReady = numberOrZero(row.policyReady);
  const status =
    releasesTotal === 0
      ? "no_releases"
      : policyReady >= releasesTotal
        ? "policy_ready"
        : "policy_in_progress";
  return {
    releasesTotal,
    retentionApproved: numberOrZero(row.retentionApproved),
    patientCopyApproved: numberOrZero(row.patientCopyApproved),
    fileProxyEnabled: numberOrZero(row.fileProxyEnabled),
    expiresConfigured: numberOrZero(row.expiresConfigured),
    policyReady,
    status,
  };
}

function toSelfHostedPatientPortalHistoryBoundary(input: unknown): SelfHostedPatientPortalHistoryBoundary {
  return {
    comparisonRequiresDoctorReview: true,
    clinicalDecisionExposed: false,
    rawFilesExposed: false,
    doctorOnlyTextExposed: false,
  };
}

function toSelfHostedPatientPortalHistoryComparisonOperations(
  input: unknown,
): SelfHostedPatientPortalHistoryComparisonOperations {
  const row = isRecord(input) ? input : {};
  const lesionsTotal = numberOrZero(row.lesionsTotal);
  const readyForDoctorReview = numberOrZero(row.readyForDoctorReview);
  const status =
    lesionsTotal === 0
      ? "no_series"
      : readyForDoctorReview === 0
        ? "needs_capture"
        : readyForDoctorReview >= lesionsTotal
          ? "ready_for_review"
          : "partial_ready";
  return {
    lesionsTotal,
    readyForDoctorReview,
    requiresNextCapture: numberOrZero(row.requiresNextCapture),
    visitsWithComparableSeries: numberOrZero(row.visitsWithComparableSeries),
    comparableCoveragePercent: numberOrZero(row.comparableCoveragePercent),
    status,
    doctorReviewRequired: true,
  };
}

function toSelfHostedPatientPortalHistorySessionLifecycle(
  input: unknown,
): SelfHostedPatientPortalHistorySessionLifecycle {
  const row = isRecord(input) ? input : {};
  const preparedAccessWindows = numberOrZero(row.preparedAccessWindows);
  const revokedAccessWindows = numberOrZero(row.revokedAccessWindows);
  const missingExpiry = numberOrZero(row.missingExpiry);
  const identityCheckEnabled = numberOrZero(row.identityCheckEnabled);
  const policyReadyAccessWindows = numberOrZero(row.policyReadyAccessWindows);
  const status = preparedAccessWindows === 0 && revokedAccessWindows === 0
    ? "no_access_windows"
    : (
      missingExpiry > 0
      || identityCheckEnabled < preparedAccessWindows
      || policyReadyAccessWindows < preparedAccessWindows
    )
      ? "governance_attention"
      : "governance_ready";
  return {
    preparedAccessWindows,
    revokedAccessWindows,
    activeAccessWindows: numberOrZero(row.activeAccessWindows),
    expiringIn24h: numberOrZero(row.expiringIn24h),
    expiredAccessWindows: numberOrZero(row.expiredAccessWindows),
    missingExpiry,
    identityCheckEnabled,
    policyReadyAccessWindows,
    status,
    sessionBoundary: {
      temporaryCredentialsExposed: false,
      qrSessionExposed: false,
      rawTokensExposed: false,
    },
  };
}

export function toSelfHostedPatientPortalPhotoProtocol(input: unknown): SelfHostedPatientPortalPhotoProtocol {
  const row = isRecord(input) ? input : {};
  const counts = nested(row, "counts");
  const deliveryBoundary = nested(row, "deliveryBoundary");
  const selectedPhotoCount = numberOrZero(row.selectedPhotoCount ?? counts.selectedPhotos);
  const status = String(row.status ?? "prepared");
  return {
    id: String(row.id ?? ""),
    visitId: textOrNull(row.visitId),
    reportId: textOrNull(row.reportId),
    status,
    accessStatus: String(
      row.accessStatus ?? (status === "prepared" ? "metadata_ready_delivery_blocked" : status),
    ),
    selectedPhotoCount,
    counts: {
      selectedPhotos: selectedPhotoCount,
      overviewPhotos: numberOrZero(row.overviewPhotoCount ?? counts.overviewPhotos),
      dermoscopyPhotos: numberOrZero(row.dermoscopyPhotoCount ?? counts.dermoscopyPhotos),
      reportAttachments: numberOrZero(row.reportAttachmentCount ?? counts.reportAttachments),
    },
    preparedAt: textOrNull(row.preparedAt),
    revokedAt: textOrNull(row.revokedAt),
    expiresAt: textOrNull(row.expiresAt),
    blockerCount: numberOrZero(row.blockerCount),
    patientSafeTextAvailable: Boolean(row.patientSafeTextAvailable),
    availabilityMessages: Array.isArray(row.availabilityMessages)
      ? row.availabilityMessages.map(String)
      : ["Файлы фото закрыты backend-контуром до включения защищённой выдачи."],
    auditTrail: Array.isArray(row.auditTrail)
      ? row.auditTrail.map(toSelfHostedPatientPortalPhotoProtocolAuditEntry)
      : [],
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      rawFilesExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      tokensExposed: false,
      doctorOnlyTextExposed: false,
      fileProxyReady: deliveryBoundary.fileProxyReady === true,
      requiresIdentityCheck: deliveryBoundary.requiresIdentityCheck !== false,
      requiresRetentionPolicy: deliveryBoundary.requiresRetentionPolicy !== false,
      requiresApprovedPatientCopy: deliveryBoundary.requiresApprovedPatientCopy !== false,
    },
    photos: Array.isArray(row.photos)
      ? row.photos.map(toSelfHostedPatientPortalPhotoProtocolPhoto).filter((item) => item.sequence > 0)
      : [],
  };
}

export function toSelfHostedPatientPortalPhotoProtocolAccessExchange(
  input: unknown,
): SelfHostedPatientPortalPhotoProtocolAccessExchange {
  const row = isRecord(input) ? input : {};
  const sessionBoundary = nested(row, "sessionBoundary");
  const status = row.status === "confirmed" ? "confirmed" : "denied";
  return {
    visitId: textOrNull(row.visitId),
    status,
    accessStatus: String(
      row.accessStatus ?? (status === "confirmed" ? "session_boundary_ready" : "photo_protocol_access_not_confirmed"),
    ),
    deniedReason: textOrNull(row.deniedReason),
    sessionExpiresAt: textOrNull(row.sessionExpiresAt),
    sessionBoundary: {
      sessionEstablished: sessionBoundary.sessionEstablished === true,
      rawCredentialExposed: false,
      credentialHashExposed: false,
      credentialFingerprintExposed: false,
      rawSessionIdExposed: false,
      sessionHashExposed: false,
      sessionFingerprintExposed: false,
      qrTokenExposed: false,
      signedUrlsIssued: false,
      storagePathsExposed: false,
      doctorOnlyTextExposed: false,
    },
  };
}

export function toSelfHostedPatientPortalHistory(input: unknown): SelfHostedPatientPortalHistory {
  const row = isRecord(input) ? input : {};
  const clinic = nested(row, "clinic");
  return {
    clinic: {
      id: textOrNull(clinic.id),
      slug: textOrNull(clinic.slug),
      name: textOrNull(clinic.name),
    },
    lesions: Array.isArray(row.lesions)
      ? row.lesions.map(toSelfHostedPatientPortalHistoryLesion).filter((item) => item.id)
      : [],
    timeline: Array.isArray(row.timeline)
      ? row.timeline.map(toSelfHostedPatientPortalHistoryTimelineItem).filter((item) => item.id)
      : [],
    retentionGovernance: toSelfHostedPatientPortalHistoryRetentionGovernance(row.retentionGovernance),
    comparisonOperations: toSelfHostedPatientPortalHistoryComparisonOperations(row.comparisonOperations),
    sessionLifecycle: toSelfHostedPatientPortalHistorySessionLifecycle(row.sessionLifecycle),
    longitudinalBoundary: toSelfHostedPatientPortalHistoryBoundary(row.longitudinalBoundary),
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

export async function fetchSelfHostedPatientPortalHistory(
  args: BaseArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientPortalHistory>> {
  const response = await requestJson(args, "/api/v1/me/history");
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalHistory(body.history ?? body.item));
}

export async function fetchSelfHostedPatientPortalPhotoProtocol(
  args: BaseArgs & { visitId: string },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalPhotoProtocol>> {
  const response = await requestJson(args, `/api/v1/me/photo-protocols/${encodeURIComponent(args.visitId)}`);
  if (!response.ok) return fail(response.error);
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalPhotoProtocol(body.item));
}

export async function exchangeSelfHostedPatientPortalPhotoProtocolAccess(
  args: BaseArgs & { visitId: string; payload: ExchangePatientPortalPhotoProtocolAccessPayload },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalPhotoProtocolAccessExchange>> {
  const response = await requestJson(
    args,
    `/api/v1/me/photo-protocols/${encodeURIComponent(args.visitId)}/access/exchange`,
    {
      method: "POST",
      body: args.payload,
    },
  );
  if (!response.ok) {
    return fail({
      ...response.error,
      message: patientPhotoProtocolAccessExchangeErrorMessage(response.error),
    });
  }
  const body = isRecord(response.value) ? response.value : {};
  return ok(toSelfHostedPatientPortalPhotoProtocolAccessExchange(body.item));
}

export async function fetchSelfHostedPatientPortalPhotoProtocolPhoto(
  args: BaseArgs & { visitId: string; sequence: number },
): Promise<SelfHostedApiResult<SelfHostedPatientPortalPhotoProtocolPhotoFile>> {
  if (!args.visitId) {
    return fail({
      kind: "validation",
      code: "missing_visit_id",
      message: "visitId обязателен.",
    });
  }
  if (!Number.isInteger(args.sequence) || args.sequence < 1 || args.sequence > 200) {
    return fail({
      kind: "validation",
      code: "invalid_sequence",
      message: "Номер фото должен быть от 1 до 200.",
    });
  }
  const result = await requestBlob(
    args,
    `/api/v1/me/photo-protocols/${encodeURIComponent(args.visitId)}/photos/${encodeURIComponent(String(args.sequence))}/download`,
  );
  if (!result.ok) {
    return fail({
      ...result.error,
      message: patientPhotoProtocolDownloadErrorMessage(result.error),
    });
  }
  const contentType = result.value.response.headers.get("content-type") || result.value.blob.type || "image/jpeg";
  const fileName = fileNameFromDisposition(
    result.value.response.headers.get("content-disposition"),
    `photo-protocol-${args.sequence}.${imageExtension(contentType)}`,
  );
  return ok({
    sequence: args.sequence,
    blob: result.value.blob,
    contentType,
    fileName,
  });
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
