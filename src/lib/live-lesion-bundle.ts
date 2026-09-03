import type { ClinicalImage, Lesion, Patient, Visit } from "@/lib/domain";
import type { SelfHostedLesionLongitudinalHistoryDTO } from "@/lib/self-hosted-clinical-workspace-api";
import {
  CAPTURE_DEVICE_NOT_ASSESSED,
  CAPTURE_SOURCE_NOT_ASSESSED,
  createProtectedClinicalImageMetadata,
  TECHNICAL_QUALITY_NOT_ASSESSED,
} from "@/lib/safe-clinical-image-adapter";

export interface LiveLesionBundle {
  patient: Patient;
  lesion: Lesion;
  visits: Visit[];
  images: ClinicalImage[];
  comparisonCandidatePairs: Array<[string, string]>;
  bodyMapBound: boolean;
}

export function isLiveComparisonPairAllowed(
  imageIds: string[],
  candidatePairs: Array<[string, string]>,
): boolean {
  if (imageIds.length !== 2 || imageIds[0] === imageIds[1]) return false;
  return candidatePairs.some((pair) =>
    pair.includes(imageIds[0]) && pair.includes(imageIds[1]));
}

export function isLiveComparisonSelectionAllowed(
  imageId: string,
  selectedImageIds: string[],
  candidatePairs: Array<[string, string]>,
): boolean {
  if (selectedImageIds.includes(imageId)) return true;
  if (selectedImageIds.length >= 2) return false;
  if (selectedImageIds.length === 1) {
    return isLiveComparisonPairAllowed([selectedImageIds[0], imageId], candidatePairs);
  }
  return candidatePairs.some((pair) => pair.includes(imageId));
}

export function projectLiveLesionBundle(
  patient: Patient,
  history: SelfHostedLesionLongitudinalHistoryDTO,
): LiveLesionBundle {
  const visits = history.visits.map<Visit>((visit) => ({
    id: visit.visitId,
    patientId: patient.id,
    doctorId: "system-clinic",
    assistantId: null,
    clinicId: history.clinicId ?? "self-hosted-clinic",
    status: liveVisitStatus(visit.status),
    startedAt: visit.startedAt ?? visit.capturedAtFirst ?? "",
    closedAt: visit.signedAt,
    complaint: "—",
  }));
  const visitsById = new Map(history.visits.map((visit) => [visit.visitId, visit]));
  const imagesById = new Map<string, ClinicalImage>();

  for (const item of history.images) {
    if (!item.id || !item.visitId || imagesById.has(item.id)) continue;
    const visit = visitsById.get(item.visitId);
    imagesById.set(item.id, createProtectedClinicalImageMetadata({
      id: item.id,
      visitId: item.visitId,
      lesionId: history.lesionId,
      kind: liveImageKind(item.kind),
      source: "file",
      capturedAt: item.capturedAt ?? visit?.capturedAtLast ?? visit?.capturedAtFirst ?? visit?.startedAt ?? "",
      deviceId: null,
      quality: {
        score: 0,
        issues: [
          TECHNICAL_QUALITY_NOT_ASSESSED,
          CAPTURE_SOURCE_NOT_ASSESSED,
          CAPTURE_DEVICE_NOT_ASSESSED,
        ],
      },
      exifMeta: { width: 0, height: 0 },
    }));
  }
  const comparisonCandidatePairs = history.candidatePairs
    .filter((pair) =>
      pair.status !== "blocked"
      && pair.previousImageId !== pair.currentImageId
      && imagesById.has(pair.previousImageId)
      && imagesById.has(pair.currentImageId))
    .map<[string, string]>((pair) => [pair.previousImageId, pair.currentImageId]);

  return {
    patient,
    lesion: {
      id: history.lesionId,
      patientId: patient.id,
      bodyZone: history.bodyZone ?? "не указана",
      mapPoint: { view: "front", x: 0.5, y: 0.5 },
      label: history.label ?? "Очаг",
      firstSeenAt: history.visits[0]?.startedAt ?? "",
      status: history.status === "monitoring" || history.status === "removed" || history.status === "archived"
        ? history.status
        : "active",
      bodyRegionId: null,
      bodyRegionDetailId: null,
      bodyAtlasSource: null,
      bodyAtlasProfileId: null,
      bodyAtlasManifestSha256: null,
      bodyRegionMapSha256: null,
      placementRevision: 0,
    },
    visits,
    images: [...imagesById.values()].sort((a, b) => a.capturedAt.localeCompare(b.capturedAt)),
    comparisonCandidatePairs,
    bodyMapBound: false,
  };
}

function liveImageKind(kind: string): ClinicalImage["kind"] {
  if (kind === "dermoscopy" || kind === "macro" || kind === "body_map") return kind;
  return "overview";
}

function liveVisitStatus(status: string): Visit["status"] {
  if (status === "signed") return "closed";
  if (status === "in_progress" || status === "cancelled") return status;
  return "scheduled";
}
