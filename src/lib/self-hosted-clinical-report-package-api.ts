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
      requiresSelfHostedFileProxy: boolean;
      requiresReleaseAudit: boolean;
      requiresRevoke: boolean;
      requiresIdentityCheck: boolean;
    };
  };
  productBoundary: {
    managedRuntimeDependency: "none" | string;
    managedDatabaseDependency: "none" | string;
    externalRuntimeCalls: boolean;
    rawPatientDataInReport: boolean;
  };
}

interface Args {
  apiBaseUrl: string | null | undefined;
  apiToken: string | null | undefined;
  visitId: string;
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
        requiresSelfHostedFileProxy: bool(deliveryBoundary.requiresSelfHostedFileProxy),
        requiresReleaseAudit: bool(deliveryBoundary.requiresReleaseAudit),
        requiresRevoke: bool(deliveryBoundary.requiresRevoke),
        requiresIdentityCheck: bool(deliveryBoundary.requiresIdentityCheck),
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
