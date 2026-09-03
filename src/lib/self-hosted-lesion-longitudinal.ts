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

export interface SelfHostedLesionLongitudinalHistoryImageDTO {
  id: string;
  visitId: string;
  kind: string;
  capturedAt: string | null;
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
  images: SelfHostedLesionLongitudinalHistoryImageDTO[];
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

function isRecord(input: unknown): input is Record<string, unknown> {
  return Boolean(input) && typeof input === "object" && !Array.isArray(input);
}

function textOrNull(value: unknown): string | null {
  return value == null ? null : String(value);
}

function numberOrZero(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function toRecordArray(input: unknown): Record<string, unknown>[] {
  return Array.isArray(input) ? input.filter(isRecord) : [];
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map(String) : [];
}

function pairStatus(value: unknown): SelfHostedLesionLongitudinalHistoryPairDTO["status"] {
  return value === "ready" || value === "warning" ? value : "blocked";
}

export function toLesionLongitudinalHistory(
  input: Record<string, unknown>,
): SelfHostedLesionLongitudinalHistoryDTO {
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
    images: toRecordArray(input.images).map((image) => ({
      id: String(image.id ?? ""),
      visitId: String(image.visitId ?? ""),
      kind: String(image.kind ?? ""),
      capturedAt: textOrNull(image.capturedAt),
    })),
    candidatePairs: toRecordArray(input.candidatePairs).map((pair) => ({
      previousVisitId: String(pair.previousVisitId ?? ""),
      currentVisitId: String(pair.currentVisitId ?? ""),
      previousImageId: String(pair.previousImageId ?? ""),
      currentImageId: String(pair.currentImageId ?? ""),
      kind: String(pair.kind ?? ""),
      status: pairStatus(pair.status),
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
