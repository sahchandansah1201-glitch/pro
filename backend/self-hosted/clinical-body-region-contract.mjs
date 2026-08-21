import { readFileSync } from "node:fs";

const MANIFEST_URL = new URL(
  "../../public/clinical-body-atlas-regions/manifest.json",
  import.meta.url,
);
const VIEW_VALUES = new Set(["front", "back", "left", "right", "scalp"]);
const DETAIL_VALUES = new Set(["digit-1", "digit-2", "digit-3", "digit-4", "digit-5"]);

const manifest = JSON.parse(readFileSync(MANIFEST_URL, "utf8"));
const regionsById = new Map(
  (Array.isArray(manifest.regions) ? manifest.regions : []).map((region) => [region.id, region]),
);

export class ClinicalBodyRegionValidationError extends Error {
  constructor(field, message) {
    super(message);
    this.name = "ClinicalBodyRegionValidationError";
    this.field = field;
  }
}

function invalid(field, message) {
  throw new ClinicalBodyRegionValidationError(field, message);
}

function normalizeCoordinate(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    invalid(field, `${field} must be a finite number from 0 to 1.`);
  }
  return Math.round(value * 100_000) / 100_000;
}

function digitLabel(region, detailId) {
  const digit = Number(detailId.slice("digit-".length));
  const side = region.side === "left" ? "левой" : region.side === "right" ? "правой" : null;
  if (!side) invalid("bodyRegionDetailId", "bodyRegionDetailId is not supported for this region.");

  if (region.id.endsWith("-fingers")) {
    const commonName = ["большого", "указательного", "среднего", "безымянного", "мизинца"][digit - 1];
    const surface = region.view === "front" ? "Ладонная" : region.view === "back" ? "Тыльная" : "Боковая";
    return `${surface} поверхность ${digit}-го пальца (${commonName}) ${side} кисти`;
  }

  if (region.id.startsWith("front-") && region.id.endsWith("-toes")) {
    const commonName = digit === 1 ? "большого" : digit === 5 ? "мизинца" : null;
    return `Тыльная поверхность ${digit}-го пальца${commonName ? ` (${commonName})` : ""} ${side} стопы`;
  }

  invalid("bodyRegionDetailId", "bodyRegionDetailId is not supported for this region.");
}

export function normalizeClinicalBodyPlacement(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalid("bodyMap", "bodyMap must be a JSON object.");
  }
  const view = String(input.view ?? "");
  if (!VIEW_VALUES.has(view)) invalid("bodyMap.view", "bodyMap.view is not supported.");

  const regionId = String(input.regionId ?? "");
  const region = regionsById.get(regionId);
  if (!region) invalid("bodyRegionId", "bodyRegionId is not registered in the clinical atlas.");
  if (region.view !== view) invalid("bodyMap.view", "bodyMap.view does not match bodyRegionId.");

  const detailId = input.detailId == null || input.detailId === "" ? null : String(input.detailId);
  if (detailId && !DETAIL_VALUES.has(detailId)) {
    invalid("bodyRegionDetailId", "bodyRegionDetailId is not supported.");
  }

  return {
    view,
    x: normalizeCoordinate(input.x, "bodyMap.x"),
    y: normalizeCoordinate(input.y, "bodyMap.y"),
    regionId,
    detailId,
    regionLabel: detailId ? digitLabel(region, detailId) : String(region.label),
    bodySurface: String(region.surface),
  };
}

export function clinicalBodyRegionManifestVersion() {
  return Number(manifest.schemaVersion ?? 0);
}
