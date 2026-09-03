import type { ClinicalImage } from "@/lib/domain";

export const CLINICAL_IMAGE_QUALITY_THRESHOLD = 0.8;

export function isClinicalImageReviewNeeded(image: ClinicalImage): boolean {
  return image.quality.score < CLINICAL_IMAGE_QUALITY_THRESHOLD || image.quality.issues.length > 0;
}
