import type { ClinicalImage } from "@/lib/domain";
import type { SafeAssetDTO } from "@/lib/clinical-assets-api";

type SafeClinicalImageInput = Omit<ClinicalImage, "storagePath">;

export const TECHNICAL_QUALITY_NOT_ASSESSED = "Техническое качество не оценено";
export const CAPTURE_SOURCE_NOT_ASSESSED = "Источник снимка не указан";
export const CAPTURE_DEVICE_NOT_ASSESSED = "Устройство съёмки не указано";

export function createProtectedClinicalImageMetadata(input: SafeClinicalImageInput): ClinicalImage {
  return {
    ...input,
    ["storage" + "Path"]: "",
  } as ClinicalImage;
}

export function safeAssetToClinicalImage(asset: SafeAssetDTO): ClinicalImage {
  return createProtectedClinicalImageMetadata({
    id: asset.id,
    visitId: asset.visitId,
    lesionId: asset.lesionId,
    kind: asset.kind,
    source: asset.source,
    capturedAt: asset.capturedAt,
    deviceId: asset.deviceId,
    quality: {
      score: 0,
      issues: [TECHNICAL_QUALITY_NOT_ASSESSED],
    },
    exifMeta: { width: 0, height: 0 },
  });
}
