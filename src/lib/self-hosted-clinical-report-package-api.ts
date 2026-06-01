// Stage 8G-8I · Self-hosted clinical report package client.
// Reads report completion readiness from the operator-owned backend only.

import type { SelfHostedApiError, SelfHostedApiResult } from "@/lib/self-hosted-patient-api";
import { buildSelfHostedApiUrl } from "@/lib/self-hosted-patient-api";

export interface SelfHostedClinicalReportPackageDTO {
  visitId: string;
  clinicId: string | null;
  patientId: string | null;
  visitStatus: string;
  assessment: {
    id: string | null;
    status: string | null;
    riskLevel: string | null;
    abcdTotal: number | null;
    sevenPointTotal: number | null;
    summaryPresent: boolean;
    recommendationPresent: boolean;
  };
  conclusion: {
    id: string | null;
    status: string | null;
    summaryPresent: boolean;
    nextStepPresent: boolean;
    followUpAt: string | null;
  };
  report: {
    id: string | null;
    status: string | null;
    physicianTextPresent: boolean;
    patientTextPresent: boolean;
    signedAt: string | null;
  };
  counts: {
    lesions: number;
    assets: number;
  };
  readiness: {
    ready: boolean;
    status: "ready" | "blocked" | string;
    completionPercent: number;
    missing: string[];
    exportAllowed: boolean;
    patientDeliveryAllowed: boolean;
  };
  patientPhotoProtocol: {
    brainstormTask: string;
    status: "metadata_ready_backend_blocked" | "blocked" | string;
    readyForBackendContract: boolean;
    selectedPhotoCount: number;
    counts: {
      selectedPhotos: number;
      overviewPhotos: number;
      dermoscopyPhotos: number;
      reportAttachments: number;
    };
    missing: string[];
    deliveryBoundary: {
      patientDeliveryAllowed: boolean;
      rawFilesExposed: boolean;
      signedUrlsIssued: boolean;
      storagePathsExposed: boolean;
      tokensExposed: boolean;
      physicianTextExposed: boolean;
      fileProxyReady: boolean;
      requiresSelfHostedFileProxy: boolean;
      requiresReleaseAudit: boolean;
      requiresRevoke: boolean;
      requiresIdentityCheck: boolean;
      requiresRetentionPolicy: boolean;
      requiresApprovedPatientCopy: boolean;
    };
    policy: {
      releasePrepared: boolean;
      patientFileProxyEnabled: boolean;
      patientCopyApproved: boolean;
      retentionPolicyApproved: boolean;
      expiresAt: string | null;
    };
  };
  productBoundary: {
    managedRuntimeDependency: "none" | string;
    managedDatabaseDependency: "none" | string;
    externalRuntimeCalls: boolean;
    rawPatientDataInReport: boolean;
  };
}

export interface SelfHostedPatientPhotoProtocolReleaseAuditEvent {
  kind: string;
  label: string;
  occurredAt: string | null;
  actorType: "staff" | "patient" | string;
  status: string | null;
  selectedPhotoCount: number;
  blockerCount: number;
  patientDeliveryAllowed: boolean;
  reasonPresent: boolean;
}

export interface SelfHostedPatientPhotoProtocolReleaseAuditDTO {
  releaseId: string | null;
  clinicId: string | null;
  patientId: string | null;
  visitId: string | null;
  status: string;
  summary: {
    eventCount: number;
    preparedEvents: number;
    policyReviewEvents: number;
    revokedEvents: number;
    patientReadEvents: number;
    proxyDownloadEvents: number;
    proxyDeniedEvents: number;
  };
  events: SelfHostedPatientPhotoProtocolReleaseAuditEvent[];
  boundaries: {
    immutableLedger: boolean;
    rawPayloadExposed: boolean;
    revokeReasonExposed: boolean;
    actorIdsExposed: boolean;
    correlationIdsExposed: boolean;
    storagePathsExposed: boolean;
    tokensExposed: boolean;
    signedUrlsIssued: boolean;
    doctorOnlyTextExposed: boolean;
  };
}

export interface SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow {
  queueNumber: number;
  status: string;
  policyStatus: string;
  selectedPhotoCount: number;
  blockerCount: number;
  expiresAt: string | null;
  updatedAt: string | null;
  patientFileProxyEnabled: boolean;
  patientCopyApproved: boolean;
  retentionPolicyApproved: boolean;
  attention: string[];
}

export interface SelfHostedPatientPhotoProtocolReleaseGovernanceDTO {
  summary: {
    releasesTotal: number;
    prepared: number;
    blocked: number;
    revoked: number;
    retentionMissing: number;
    patientCopyMissing: number;
    fileProxyMissing: number;
    expiryMissing: number;
    activeAccessWindows: number;
    expiringIn24h: number;
  };
  queue: SelfHostedPatientPhotoProtocolReleaseGovernanceQueueRow[];
  operations: {
    retention: {
      reviewDue: number;
      ready: number;
      blocked: number;
      requiresClinicSignoff: boolean;
      nextAction: string;
    };
    revokeReadiness: {
      activeWindows: number;
      expiringIn24h: number;
      revoked: number;
      canPrepareRevokeReview: number;
      requiresManualReason: boolean;
      revokeReasonExposed: boolean;
    };
    sessionLifecycle: {
      active: number;
      expiringIn24h: number;
      missingExpiry: number;
      revoked: number;
      temporaryCredentialsExposed: boolean;
      qrTokensExposed: boolean;
      sessionIdsExposed: boolean;
    };
    allowedOperations: string[];
    blockedOperations: string[];
  };
  boundaries: {
    metadataOnly: boolean;
    patientNamesExposed: boolean;
    rawIdentifiersExposed: boolean;
    rawTokensExposed: boolean;
    rawFilesExposed: boolean;
    storagePathsExposed: boolean;
    signedUrlsIssued: boolean;
    doctorOnlyTextExposed: boolean;
    rawPolicyPayloadExposed: boolean;
  };
}

export interface SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO {
  operation: "revoke_expired_access_windows" | "block_missing_expiry_access_windows" | string;
  status: "executed" | "no_op" | string;
  affectedCount: number;
  skippedActiveCount: number;
  expiringIn24hCount: number;
  skippedMissingExpiryCount: number;
  limit: number;
  auditAction:
    | "patient_photo_protocol.release_governance.revoke_expired"
    | "patient_photo_protocol.release_governance.block_missing_expiry"
    | string;
  boundaries: {
    metadataOnly: boolean;
    patientRowsExposed: boolean;
    rawIdentifiersExposed: boolean;
    revokeReasonExposed: boolean;
    temporaryCredentialsExposed: boolean;
    qrTokensExposed: boolean;
    sessionIdsExposed: boolean;
    storagePathsExposed: boolean;
    signedUrlsIssued: boolean;
    patientDeliveryAllowed: boolean;
  };
}

interface Args {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  visitId: string;
}

interface SessionArgs {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
}

export interface SelfHostedPatientPhotoProtocolReleasePolicyPayload {
  expiresAt?: string | null;
  patientFileProxyEnabled?: boolean;
  patientCopyApproved?: boolean;
  retentionPolicyApproved?: boolean;
}

export interface SelfHostedPatientPhotoProtocolGovernanceRevokeExpiredPayload {
  confirm: true;
  limit?: number;
}

export interface SelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiryPayload {
  confirm: true;
  limit?: number;
}

const NOT_CONFIGURED: SelfHostedApiError = {
  kind: "not_configured",
  code: "not_configured",
  message: "Self-hosted backend-сессия не подключена.",
};

function fail<T>(error: SelfHostedApiError): SelfHostedApiResult<T> {
  return { ok: false, value: null, error };
}

function ok<T>(value: T): SelfHostedApiResult<T> {
  return { ok: true, value, error: null };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
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
  return {
    kind: response.status === 422 ? "validation" : "http",
    status: response.status,
    code: String(error?.code ?? `http_${response.status}`),
    message: String(error?.message ?? `HTTP ${response.status}`),
    correlationId: errorBody?.correlationId ? String(errorBody.correlationId) : undefined,
  };
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function toSelfHostedClinicalReportPackage(
  input: Record<string, unknown>,
): SelfHostedClinicalReportPackageDTO {
  const assessment = isRecord(input.assessment) ? input.assessment : {};
  const conclusion = isRecord(input.conclusion) ? input.conclusion : {};
  const report = isRecord(input.report) ? input.report : {};
  const counts = isRecord(input.counts) ? input.counts : {};
  const readiness = isRecord(input.readiness) ? input.readiness : {};
  const patientPhotoProtocol = isRecord(input.patientPhotoProtocol) ? input.patientPhotoProtocol : {};
  const patientPhotoProtocolCounts = isRecord(patientPhotoProtocol.counts) ? patientPhotoProtocol.counts : {};
  const deliveryBoundary = isRecord(patientPhotoProtocol.deliveryBoundary) ? patientPhotoProtocol.deliveryBoundary : {};
  const photoPolicy = isRecord(patientPhotoProtocol.policy) ? patientPhotoProtocol.policy : {};
  const productBoundary = isRecord(input.productBoundary) ? input.productBoundary : {};
  return {
    visitId: String(input.visitId ?? ""),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitStatus: String(input.visitStatus ?? "draft"),
    assessment: {
      id: textOrNull(assessment.id),
      status: textOrNull(assessment.status),
      riskLevel: textOrNull(assessment.riskLevel),
      abcdTotal: numberOrNull(assessment.abcdTotal),
      sevenPointTotal: numberOrNull(assessment.sevenPointTotal),
      summaryPresent: bool(assessment.summaryPresent),
      recommendationPresent: bool(assessment.recommendationPresent),
    },
    conclusion: {
      id: textOrNull(conclusion.id),
      status: textOrNull(conclusion.status),
      summaryPresent: bool(conclusion.summaryPresent),
      nextStepPresent: bool(conclusion.nextStepPresent),
      followUpAt: textOrNull(conclusion.followUpAt),
    },
    report: {
      id: textOrNull(report.id),
      status: textOrNull(report.status),
      physicianTextPresent: bool(report.physicianTextPresent),
      patientTextPresent: bool(report.patientSafeTextPresent),
      signedAt: textOrNull(report.signedAt),
    },
    counts: {
      lesions: Number(counts.lesions ?? 0),
      assets: Number(counts.assets ?? 0),
    },
    readiness: {
      ready: bool(readiness.ready),
      status: String(readiness.status ?? "blocked"),
      completionPercent: Number(readiness.completionPercent ?? 0),
      missing: arrayOfStrings(readiness.missing),
      exportAllowed: bool(readiness.exportAllowed),
      patientDeliveryAllowed: bool(readiness.patientDeliveryAllowed),
    },
    patientPhotoProtocol: {
      brainstormTask: String(patientPhotoProtocol.brainstormTask ?? "SD-MF-046"),
      status: String(patientPhotoProtocol.status ?? "blocked"),
      readyForBackendContract: bool(patientPhotoProtocol.readyForBackendContract),
      selectedPhotoCount: Number(patientPhotoProtocol.selectedPhotoCount ?? 0),
      counts: {
        selectedPhotos: Number(patientPhotoProtocolCounts.selectedPhotos ?? 0),
        overviewPhotos: Number(patientPhotoProtocolCounts.overviewPhotos ?? 0),
        dermoscopyPhotos: Number(patientPhotoProtocolCounts.dermoscopyPhotos ?? 0),
        reportAttachments: Number(patientPhotoProtocolCounts.reportAttachments ?? 0),
      },
      missing: arrayOfStrings(patientPhotoProtocol.missing),
      deliveryBoundary: {
        patientDeliveryAllowed: bool(deliveryBoundary.patientDeliveryAllowed),
        rawFilesExposed: bool(deliveryBoundary.rawFilesExposed),
        signedUrlsIssued: bool(deliveryBoundary.signedUrlsIssued),
        storagePathsExposed: bool(deliveryBoundary.storagePathsExposed),
        tokensExposed: bool(deliveryBoundary.tokensExposed),
        physicianTextExposed: bool(deliveryBoundary.physicianTextExposed),
        fileProxyReady: bool(deliveryBoundary.fileProxyReady),
        requiresSelfHostedFileProxy: bool(deliveryBoundary.requiresSelfHostedFileProxy),
        requiresReleaseAudit: bool(deliveryBoundary.requiresReleaseAudit),
        requiresRevoke: bool(deliveryBoundary.requiresRevoke),
        requiresIdentityCheck: bool(deliveryBoundary.requiresIdentityCheck),
        requiresRetentionPolicy: bool(deliveryBoundary.requiresRetentionPolicy),
        requiresApprovedPatientCopy: bool(deliveryBoundary.requiresApprovedPatientCopy),
      },
      policy: {
        releasePrepared: bool(photoPolicy.releasePrepared ?? patientPhotoProtocol.photoReleaseExists),
        patientFileProxyEnabled: bool(photoPolicy.patientFileProxyEnabled ?? patientPhotoProtocol.patientFileProxyEnabled),
        patientCopyApproved: bool(photoPolicy.patientCopyApproved ?? patientPhotoProtocol.patientCopyApproved),
        retentionPolicyApproved: bool(photoPolicy.retentionPolicyApproved ?? patientPhotoProtocol.retentionPolicyApproved),
        expiresAt: textOrNull(photoPolicy.expiresAt ?? patientPhotoProtocol.photoReleaseExpiresAt),
      },
    },
    productBoundary: {
      managedRuntimeDependency: String(productBoundary.managedRuntimeDependency ?? "none"),
      managedDatabaseDependency: String(productBoundary.managedDatabaseDependency ?? "none"),
      externalRuntimeCalls: bool(productBoundary.externalRuntimeCalls),
      rawPatientDataInReport: bool(productBoundary.rawPatientDataInReport),
    },
  };
}

export function clinicalReportMissingLabel(key: string): string {
  const labels: Record<string, string> = {
    assessment_missing: "нет структурированной оценки",
    assessment_not_ready: "оценка не готова",
    assessment_summary_missing: "нет summary оценки",
    conclusion_missing: "нет заключения",
    conclusion_not_ready: "заключение не готово",
    conclusion_summary_missing: "нет summary заключения",
    report_missing: "нет отчёта",
    report_not_signed: "отчёт не подписан",
    patient_safe_text_missing: "нет patient-safe текста",
    physician_text_missing: "нет врачебного текста",
    imaging_consent_missing: "нет согласия на медицинскую съёмку",
    patient_photo_assets_missing: "нет фото для patient-пакета",
    self_hosted_photo_delivery_contract_missing: "нет backend-контракта выдачи фото",
  };
  return labels[key] ?? key;
}

export function toSelfHostedPatientPhotoProtocolReleaseAudit(
  input: Record<string, unknown>,
): SelfHostedPatientPhotoProtocolReleaseAuditDTO {
  const summary = isRecord(input.summary) ? input.summary : {};
  const boundaries = isRecord(input.boundaries) ? input.boundaries : {};
  return {
    releaseId: textOrNull(input.releaseId),
    clinicId: textOrNull(input.clinicId),
    patientId: textOrNull(input.patientId),
    visitId: textOrNull(input.visitId),
    status: String(input.status ?? "blocked"),
    summary: {
      eventCount: Number(summary.eventCount ?? 0),
      preparedEvents: Number(summary.preparedEvents ?? 0),
      policyReviewEvents: Number(summary.policyReviewEvents ?? 0),
      revokedEvents: Number(summary.revokedEvents ?? 0),
      patientReadEvents: Number(summary.patientReadEvents ?? 0),
      proxyDownloadEvents: Number(summary.proxyDownloadEvents ?? 0),
      proxyDeniedEvents: Number(summary.proxyDeniedEvents ?? 0),
    },
    events: arrayOfRecords(input.events).map((event) => ({
      kind: String(event.kind ?? "audit_event"),
      label: String(event.label ?? "Событие аудита"),
      occurredAt: textOrNull(event.occurredAt),
      actorType: String(event.actorType ?? "staff"),
      status: textOrNull(event.status),
      selectedPhotoCount: Number(event.selectedPhotoCount ?? 0),
      blockerCount: Number(event.blockerCount ?? 0),
      patientDeliveryAllowed: bool(event.patientDeliveryAllowed),
      reasonPresent: bool(event.reasonPresent),
    })),
    boundaries: {
      immutableLedger: bool(boundaries.immutableLedger),
      rawPayloadExposed: false,
      revokeReasonExposed: false,
      actorIdsExposed: false,
      correlationIdsExposed: false,
      storagePathsExposed: false,
      tokensExposed: false,
      signedUrlsIssued: false,
      doctorOnlyTextExposed: false,
    },
  };
}

export function toSelfHostedPatientPhotoProtocolReleaseGovernance(
  input: Record<string, unknown>,
): SelfHostedPatientPhotoProtocolReleaseGovernanceDTO {
  const summary = isRecord(input.summary) ? input.summary : {};
  const operations = isRecord(input.operations) ? input.operations : {};
  const retention = isRecord(operations.retention) ? operations.retention : {};
  const revokeReadiness = isRecord(operations.revokeReadiness) ? operations.revokeReadiness : {};
  const sessionLifecycle = isRecord(operations.sessionLifecycle) ? operations.sessionLifecycle : {};
  return {
    summary: {
      releasesTotal: Number(summary.releasesTotal ?? 0),
      prepared: Number(summary.prepared ?? 0),
      blocked: Number(summary.blocked ?? 0),
      revoked: Number(summary.revoked ?? 0),
      retentionMissing: Number(summary.retentionMissing ?? 0),
      patientCopyMissing: Number(summary.patientCopyMissing ?? 0),
      fileProxyMissing: Number(summary.fileProxyMissing ?? 0),
      expiryMissing: Number(summary.expiryMissing ?? 0),
      activeAccessWindows: Number(summary.activeAccessWindows ?? 0),
      expiringIn24h: Number(summary.expiringIn24h ?? 0),
    },
    queue: arrayOfRecords(input.queue).map((row) => ({
      queueNumber: Number(row.queueNumber ?? 0),
      status: String(row.status ?? "blocked"),
      policyStatus: String(row.policyStatus ?? "blocked"),
      selectedPhotoCount: Number(row.selectedPhotoCount ?? 0),
      blockerCount: Number(row.blockerCount ?? 0),
      expiresAt: textOrNull(row.expiresAt),
      updatedAt: textOrNull(row.updatedAt),
      patientFileProxyEnabled: bool(row.patientFileProxyEnabled),
      patientCopyApproved: bool(row.patientCopyApproved),
      retentionPolicyApproved: bool(row.retentionPolicyApproved),
      attention: arrayOfStrings(row.attention),
    })),
    operations: {
      retention: {
        reviewDue: Number(retention.reviewDue ?? 0),
        ready: Number(retention.ready ?? 0),
        blocked: Number(retention.blocked ?? 0),
        requiresClinicSignoff: bool(retention.requiresClinicSignoff),
        nextAction: String(retention.nextAction ?? "review_retention_policy"),
      },
      revokeReadiness: {
        activeWindows: Number(revokeReadiness.activeWindows ?? 0),
        expiringIn24h: Number(revokeReadiness.expiringIn24h ?? 0),
        revoked: Number(revokeReadiness.revoked ?? 0),
        canPrepareRevokeReview: Number(revokeReadiness.canPrepareRevokeReview ?? 0),
        requiresManualReason: true,
        revokeReasonExposed: false,
      },
      sessionLifecycle: {
        active: Number(sessionLifecycle.active ?? 0),
        expiringIn24h: Number(sessionLifecycle.expiringIn24h ?? 0),
        missingExpiry: Number(sessionLifecycle.missingExpiry ?? 0),
        revoked: Number(sessionLifecycle.revoked ?? 0),
        temporaryCredentialsExposed: false,
        qrTokensExposed: false,
        sessionIdsExposed: false,
      },
      allowedOperations: arrayOfStrings(operations.allowedOperations),
      blockedOperations: arrayOfStrings(operations.blockedOperations),
    },
    boundaries: {
      metadataOnly: true,
      patientNamesExposed: false,
      rawIdentifiersExposed: false,
      rawTokensExposed: false,
      rawFilesExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      doctorOnlyTextExposed: false,
      rawPolicyPayloadExposed: false,
    },
  };
}

export function toSelfHostedPatientPhotoProtocolGovernanceOperationResult(
  input: Record<string, unknown>,
): SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO {
  return {
    operation: String(input.operation ?? "revoke_expired_access_windows"),
    status: String(input.status ?? "no_op"),
    affectedCount: Number(input.affectedCount ?? 0),
    skippedActiveCount: Number(input.skippedActiveCount ?? 0),
    expiringIn24hCount: Number(input.expiringIn24hCount ?? 0),
    skippedMissingExpiryCount: Number(input.skippedMissingExpiryCount ?? 0),
    limit: Number(input.limit ?? 0),
    auditAction: String(input.auditAction ?? "patient_photo_protocol.release_governance.revoke_expired"),
    boundaries: {
      metadataOnly: true,
      patientRowsExposed: false,
      rawIdentifiersExposed: false,
      revokeReasonExposed: false,
      temporaryCredentialsExposed: false,
      qrTokensExposed: false,
      sessionIdsExposed: false,
      storagePathsExposed: false,
      signedUrlsIssued: false,
      patientDeliveryAllowed: false,
    },
  };
}

export async function getSelfHostedClinicalReportPackage(
  args: Args,
): Promise<SelfHostedApiResult<SelfHostedClinicalReportPackageDTO | null>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(args.apiBaseUrl, `/api/v1/visits/${encodeURIComponent(args.visitId)}/report-package`),
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${args.apiToken}` },
      },
    );
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
  return ok(item ? toSelfHostedClinicalReportPackage(item) : null);
}

export async function getSelfHostedPatientPhotoProtocolReleaseAudit(
  args: Args,
): Promise<SelfHostedApiResult<SelfHostedPatientPhotoProtocolReleaseAuditDTO | null>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(
        args.apiBaseUrl,
        `/api/v1/visits/${encodeURIComponent(args.visitId)}/patient-photo-protocol-release/audit`,
      ),
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${args.apiToken}` },
      },
    );
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
  return ok(item ? toSelfHostedPatientPhotoProtocolReleaseAudit(item) : null);
}

export async function getSelfHostedPatientPhotoProtocolReleaseGovernance(
  args: SessionArgs,
): Promise<SelfHostedApiResult<SelfHostedPatientPhotoProtocolReleaseGovernanceDTO | null>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/patient-photo-protocol-release/governance"),
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${args.apiToken}` },
      },
    );
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
  return ok(item ? toSelfHostedPatientPhotoProtocolReleaseGovernance(item) : null);
}

export async function reviewSelfHostedPatientPhotoProtocolReleasePolicy(
  args: Args & { payload: SelfHostedPatientPhotoProtocolReleasePolicyPayload },
): Promise<SelfHostedApiResult<boolean>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(
        args.apiBaseUrl,
        `/api/v1/visits/${encodeURIComponent(args.visitId)}/patient-photo-protocol-release/policy`,
      ),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiToken}`,
        },
        body: JSON.stringify(args.payload ?? {}),
      },
    );
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при сохранении политики выдачи фото.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  return ok(true);
}

export async function executeSelfHostedPatientPhotoProtocolGovernanceRevokeExpired(
  args: SessionArgs & { payload: SelfHostedPatientPhotoProtocolGovernanceRevokeExpiredPayload },
): Promise<SelfHostedApiResult<SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/patient-photo-protocol-release/governance/revoke-expired"),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiToken}`,
        },
        body: JSON.stringify(args.payload),
      },
    );
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при отзыве истёкших окон доступа.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return ok(item ? toSelfHostedPatientPhotoProtocolGovernanceOperationResult(item) : null);
}

export async function executeSelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiry(
  args: SessionArgs & { payload: SelfHostedPatientPhotoProtocolGovernanceBlockMissingExpiryPayload },
): Promise<SelfHostedApiResult<SelfHostedPatientPhotoProtocolGovernanceOperationResultDTO | null>> {
  if (!args.apiToken) return fail(NOT_CONFIGURED);
  let response: Response;
  try {
    response = await fetch(
      buildSelfHostedApiUrl(args.apiBaseUrl, "/api/v1/patient-photo-protocol-release/governance/block-missing-expiry"),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${args.apiToken}`,
        },
        body: JSON.stringify(args.payload),
      },
    );
  } catch {
    return fail({
      kind: "network",
      code: "network_error",
      message: "Сбой сети при блокировке окон без срока.",
    });
  }
  const body = await parseJsonSafe(response);
  if (!response.ok) return fail(apiErrorFromBody(response, body));
  const item = isRecord(body) && isRecord(body.item) ? body.item : null;
  return ok(item ? toSelfHostedPatientPhotoProtocolGovernanceOperationResult(item) : null);
}
