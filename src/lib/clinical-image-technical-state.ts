import type { ClinicalImage } from "@/lib/domain";
import {
  CAPTURE_DEVICE_NOT_ASSESSED,
  CAPTURE_SOURCE_NOT_ASSESSED,
  TECHNICAL_QUALITY_NOT_ASSESSED,
} from "@/lib/safe-clinical-image-adapter";

export function isImageQualityNotAssessed(image: ClinicalImage) {
  return image.quality.issues.includes(TECHNICAL_QUALITY_NOT_ASSESSED);
}

export function isImageSourceNotAssessed(image: ClinicalImage) {
  return image.quality.issues.includes(CAPTURE_SOURCE_NOT_ASSESSED);
}

export function isImageDeviceNotAssessed(image: ClinicalImage) {
  return !image.deviceId || image.quality.issues.includes(CAPTURE_DEVICE_NOT_ASSESSED);
}

export function imageQualityLabel(image: ClinicalImage) {
  if (isImageQualityNotAssessed(image)) return "Не оценено";
  if (image.quality.score >= 0.8 && image.quality.issues.length === 0) return "Готово";
  if (image.quality.score >= 0.72) return "С предупреждением";
  return "Нужен переснимок";
}

export function imageQualitySummary(image: ClinicalImage) {
  return isImageQualityNotAssessed(image)
    ? "Техническая оценка не выполнена"
    : `${imageQualityLabel(image)} · ${Math.round(image.quality.score * 100)}%`;
}

export function imageFrameSize(image: ClinicalImage) {
  return image.exifMeta.width > 0 && image.exifMeta.height > 0
    ? `${image.exifMeta.width}×${image.exifMeta.height}`
    : null;
}
