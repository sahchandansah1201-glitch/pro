/**
 * Helpers for the visit workspace Body Map.
 *
 * Pure logic only: age-specific atlas selection and deterministic age calc.
 * Anatomical placement is resolved by the fail-closed region maps.
 */
import type { BodyMapPoint, Patient } from "@/lib/domain";
import {
  clinicalBodyProfileFromAge,
  clinicalBodyProfileLabel,
  type ClinicalBodyProfile,
} from "@/lib/clinical-body-atlas";

/** Stable demo "now" — used for deterministic age calculation in tests/UI. */
export const BODY_MAP_DEMO_NOW = "2026-05-04T00:00:00Z";

/** Whole-year age calculation, time-of-day independent. */
export function calcAgeAt(birthDate: string, nowIso: string = BODY_MAP_DEMO_NOW): number {
  const b = new Date(birthDate);
  const n = new Date(nowIso);
  let age = n.getUTCFullYear() - b.getUTCFullYear();
  const m = n.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && n.getUTCDate() < b.getUTCDate())) age -= 1;
  return age;
}

export function getBodyMapProfile(
  patient: Pick<Patient, "sex" | "birthDate">,
  nowIso: string = BODY_MAP_DEMO_NOW,
): ClinicalBodyProfile {
  return clinicalBodyProfileFromAge(
    patient.sex,
    Math.max(0, calcAgeAt(patient.birthDate, nowIso)),
  );
}

export function bodyMapProfileLabel(profile: ClinicalBodyProfile): string {
  return clinicalBodyProfileLabel(profile);
}

export function bodyMapViewLabel(v: BodyMapPoint["view"]): string {
  switch (v) {
    case "front": return "спереди";
    case "back": return "сзади";
    case "left": return "слева";
    case "right": return "справа";
    case "scalp": return "волосистая часть головы";
  }
}

/** Prominent active-surface label shown above the canvas and in aria-label. */
export function bodyMapSurfaceLabel(v: BodyMapPoint["view"]): string {
  switch (v) {
    case "front": return "Передняя поверхность";
    case "back": return "Задняя поверхность";
    case "left": return "Левая боковая поверхность";
    case "right": return "Правая боковая поверхность";
    case "scalp": return "Верх головы";
  }
}

/** Short anatomical landmark hint shown next to the surface label. */
export function bodyMapSurfaceHint(v: BodyMapPoint["view"]): string {
  switch (v) {
    case "front": return "Ориентиры: лицо, грудная клетка, живот";
    case "back": return "Ориентиры: затылок, лопатки, позвоночник, поясница";
    case "left": return "Ориентиры: левый висок, левое плечо, левое бедро";
    case "right": return "Ориентиры: правый висок, правое плечо, правое бедро";
    case "scalp": return "Ориентиры: темя, пробор, затылок";
  }
}

/** Compact uppercase badge rendered inside the SVG. */
export function bodyMapSurfaceBadge(v: BodyMapPoint["view"]): string {
  switch (v) {
    case "front": return "ПЕРЕД";
    case "back": return "СПИНА";
    case "left": return "ЛЕВЫЙ БОК";
    case "right": return "ПРАВЫЙ БОК";
    case "scalp": return "ГОЛОВА";
  }
}

export const BODY_MAP_VIEWS: BodyMapPoint["view"][] = [
  "front",
  "back",
  "left",
  "right",
  "scalp",
];

export const BODY_MAP_VIEW_BUTTON_LABEL: Record<BodyMapPoint["view"], string> = {
  front: "Спереди",
  back: "Сзади",
  left: "Слева",
  right: "Справа",
  scalp: "Голова",
};
