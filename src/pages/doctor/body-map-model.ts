/**
 * Helpers for the visit workspace Body Map.
 *
 * Pure logic only: variant selection, deterministic age calc, simple
 * anatomical zone hints. No mock-data mutation, no IO.
 */
import type { BodyMapPoint, Patient } from "@/lib/domain";

export type BodyMapVariant =
  | "adult_female"
  | "adult_male"
  | "child_girl"
  | "child_boy";

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

const CHILD_MAX_AGE = 14;

export function getBodyMapVariant(
  patient: Pick<Patient, "sex" | "birthDate">,
  nowIso: string = BODY_MAP_DEMO_NOW,
): BodyMapVariant {
  const isChild = calcAgeAt(patient.birthDate, nowIso) < CHILD_MAX_AGE;
  if (patient.sex === "female") return isChild ? "child_girl" : "adult_female";
  return isChild ? "child_boy" : "adult_male";
}

export function bodyMapVariantLabel(v: BodyMapVariant): string {
  switch (v) {
    case "adult_female": return "Женщина";
    case "adult_male": return "Мужчина";
    case "child_girl": return "Девочка";
    case "child_boy": return "Мальчик";
  }
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

/**
 * Suggest a broad anatomical zone for a placement.
 *
 * Deterministic; UI-only hint, not medical logic. Coordinates are normalized
 * 0..1 in the same viewBox as the silhouette (200x400).
 */
export function suggestBodyZone(view: BodyMapPoint["view"], x: number, y: number): string {
  if (view === "scalp") return "волосистая часть головы";

  if (view === "left" || view === "right") {
    const side = view === "left" ? "левая сторона" : "правая сторона";
    if (y < 0.18) return `${side}, голова/лицо`;
    if (y < 0.28) return `${side}, шея`;
    if (y < 0.55) return `${side}, боковая поверхность туловища`;
    if (y < 0.7) return `${side}, область таза/бедра`;
    if (y < 0.9) return `${side}, голень`;
    return `${side}, стопа`;
  }

  // front / back
  const isBack = view === "back";
  if (y < 0.1) return isBack ? "затылок" : "лицо";
  if (y < 0.18) return "шея";
  if (y < 0.28) {
    if (x < 0.35) return isBack ? "плечо левое (сзади)" : "плечо левое";
    if (x > 0.65) return isBack ? "плечо правое (сзади)" : "плечо правое";
    return isBack ? "верх спины" : "верх грудной клетки";
  }
  if (y < 0.42) {
    if (x < 0.28) return isBack ? "плечо/предплечье левое" : "плечо левое";
    if (x > 0.72) return isBack ? "плечо/предплечье правое" : "плечо правое";
    return isBack ? "межлопаточная область" : "грудная клетка";
  }
  if (y < 0.55) {
    if (x < 0.28) return "предплечье левое";
    if (x > 0.72) return "предплечье правое";
    return isBack ? "поясница" : "живот";
  }
  if (y < 0.62) {
    if (x < 0.25) return "кисть левая";
    if (x > 0.75) return "кисть правая";
    return isBack ? "крестцово-поясничная область" : "нижняя часть живота";
  }
  if (y < 0.78) {
    if (x < 0.5) return isBack ? "бедро левое (сзади)" : "бедро левое";
    return isBack ? "бедро правое (сзади)" : "бедро правое";
  }
  if (y < 0.93) {
    if (x < 0.5) return isBack ? "голень левая (сзади)" : "голень левая";
    return isBack ? "голень правая (сзади)" : "голень правая";
  }
  return x < 0.5 ? "стопа левая" : "стопа правая";
}
