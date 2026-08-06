import type { BodyMapPoint } from "@/lib/domain";

export type SourcePhotoCoverage = "captured" | "partial" | "not_captured";
export type ClinicianConfirmation = "confirmed" | "needs_review" | "not_applicable";

export interface LesionSourceLocalization {
  lesionId: string;
  overviewImageId: string | null;
  linkedDermoscopyImageId: string | null;
  bodyView: BodyMapPoint["view"];
  anatomicalRegion: string;
  anatomicalSubregion: string;
  coverage: SourcePhotoCoverage;
  imagePoint: Pick<BodyMapPoint, "x" | "y"> | null;
  clinicianConfirmation: ClinicianConfirmation;
  syntheticAssetPath: string | null;
  note: string;
}

export interface SensitiveAreaCaptureState {
  label: string;
  coverage: SourcePhotoCoverage;
  guidance: string;
}

export const SENSITIVE_AREA_CAPTURE_PROTOCOL: SensitiveAreaCaptureState[] = [
  {
    label: "Область снята",
    coverage: "captured",
    guidance: "Положение можно подтвердить на исходном обзорном снимке.",
  },
  {
    label: "Область снята частично",
    coverage: "partial",
    guidance: "Нужен дополнительный ракурс с согласия пациента.",
  },
  {
    label: "Область не снята",
    coverage: "not_captured",
    guidance: "Отсутствие снимка не означает отсутствие образования.",
  },
];

const DEMO_LOCALIZATIONS: Record<string, LesionSourceLocalization> = {
  "l-001": {
    lesionId: "l-001",
    overviewImageId: "i-001",
    linkedDermoscopyImageId: "i-002",
    bodyView: "back",
    anatomicalRegion: "Спина",
    anatomicalSubregion: "Верхняя треть, слева от позвоночника",
    coverage: "captured",
    imagePoint: { x: 0.43, y: 0.31 },
    clinicianConfirmation: "confirmed",
    syntheticAssetPath: "/clinical-source-localization/adult-female-back.png",
    note: "Положение подтверждено на синтетическом обзорном снимке.",
  },
  "l-009": {
    lesionId: "l-009",
    overviewImageId: "i-013",
    linkedDermoscopyImageId: "i-014",
    bodyView: "front",
    anatomicalRegion: "Грудь",
    anatomicalSubregion: "Центральная зона",
    coverage: "partial",
    imagePoint: { x: 0.5, y: 0.34 },
    clinicianConfirmation: "needs_review",
    syntheticAssetPath: "/clinical-source-localization/adult-female-front.png",
    note: "Область видна частично; нужен дополнительный ракурс с согласия пациента.",
  },
  "l-010": {
    lesionId: "l-010",
    overviewImageId: null,
    linkedDermoscopyImageId: "i-015",
    bodyView: "front",
    anatomicalRegion: "Живот",
    anatomicalSubregion: "Левый квадрант",
    coverage: "not_captured",
    imagePoint: null,
    clinicianConfirmation: "not_applicable",
    syntheticAssetPath: null,
    note: "Область не снята. Это не означает отсутствие образования.",
  },
};

export function getDemoLesionSourceLocalization(
  lesionId: string,
): LesionSourceLocalization | null {
  return DEMO_LOCALIZATIONS[lesionId] ?? null;
}

export function validateLesionSourceLocalization(
  localization: LesionSourceLocalization,
): string[] {
  const errors: string[] = [];
  const point = localization.imagePoint;

  if (point && (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1)) {
    errors.push("Координаты исходного снимка должны быть нормализованы от 0 до 1.");
  }

  if (localization.coverage === "not_captured") {
    if (localization.overviewImageId || point || localization.syntheticAssetPath) {
      errors.push("Для неснятой области нельзя указывать исходный снимок или координаты.");
    }
    if (localization.clinicianConfirmation !== "not_applicable") {
      errors.push("Неснятую область нельзя отметить как подтверждённую врачом.");
    }
  } else if (!localization.overviewImageId || !point || !localization.syntheticAssetPath) {
    errors.push("Для снятой области нужны исходный снимок, координаты и визуальный источник.");
  }

  return errors;
}
