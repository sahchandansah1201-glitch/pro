import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const STANDARD_CLINICAL_BODY_ATLAS_MANIFEST_SHA256 =
  "491be7e5abfdc3adc6e565293431c521f2eef7c992def061b5df56a643fc7024";

const HERE = dirname(fileURLToPath(import.meta.url));
const WIDTH = 240;
const HEIGHT = 400;
const VIEW_VALUES = new Set(["front", "back", "left", "right", "scalp"]);
const DETAIL_VALUES = new Set(["digit-1", "digit-2", "digit-3", "digit-4", "digit-5"]);
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SOURCE_PACKAGES = {
  "makehuman-cc0": {
    defaultDir: resolve(HERE, "../../public/clinical-body-atlas-regions"),
    manifestSourceName: "makehuman-cc0-clinical-line-art",
    defaultManifestSha256: STANDARD_CLINICAL_BODY_ATLAS_MANIFEST_SHA256,
  },
  "daz-hires-local": {
    defaultDir: resolve(HERE, "../../public/clinical-body-atlas-daz-local"),
    manifestSourceName: "daz-hires-r2-local-license-gate",
    defaultManifestSha256: null,
  },
};
const PROFILE_IDS = {
  infant: { female: "infant_female_1", male: "infant_male_1" },
  early_child: { female: "early_child_female_3", male: "early_child_male_3" },
  child: { female: "child_female_7", male: "child_male_7" },
  adolescent: { female: "adolescent_female_13", male: "adolescent_male_13" },
  late_adolescent: { female: "late_adolescent_female_16", male: "late_adolescent_male_16" },
  adult: { female: "adult_female_30", male: "adult_male_30" },
  older_adult: { female: "older_female_70", male: "older_male_70" },
};
const SCALP_RECTS = {
  "scalp-anterior": { x: 42, y: 92, width: 156, height: 64 },
  "scalp-posterior": { x: 42, y: 245, width: 156, height: 63 },
  "scalp-left": { x: 42, y: 156, width: 53, height: 89 },
  "scalp-right": { x: 145, y: 156, width: 53, height: 89 },
  "scalp-vertex": { x: 95, y: 156, width: 50, height: 89 },
};
const SCALP_CANONICAL_GEOMETRY = JSON.stringify({
  schemaVersion: 1,
  width: WIDTH,
  height: HEIGHT,
  clip: { type: "ellipse", cx: 120, cy: 200, rx: 78, ry: 108 },
  regions: SCALP_RECTS,
});

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

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
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

function wholeYearsAt(birthDate, referenceIso) {
  const birth = new Date(birthDate);
  const reference = new Date(referenceIso);
  if (!birthDate || !referenceIso || Number.isNaN(birth.getTime()) || Number.isNaN(reference.getTime())) {
    invalid("bodyMap.atlasProfileId", "Patient birth date and visit reference time are required for atlas profile validation.");
  }
  let years = reference.getUTCFullYear() - birth.getUTCFullYear();
  const month = reference.getUTCMonth() - birth.getUTCMonth();
  if (month < 0 || (month === 0 && reference.getUTCDate() < birth.getUTCDate())) years -= 1;
  return Math.max(0, years);
}

function profileIdForVisit(visitContext) {
  const sex = String(visitContext?.patient?.sex ?? "");
  if (sex !== "female" && sex !== "male") {
    invalid("bodyMap.atlasProfileId", "Patient sex must be female or male for atlas profile validation.");
  }
  const age = wholeYearsAt(
    visitContext?.patient?.birthDate,
    visitContext?.startedAt ?? visitContext?.createdAt,
  );
  const ageBand = age < 1
    ? "infant"
    : age < 5
      ? "early_child"
      : age < 10
        ? "child"
        : age < 15
          ? "adolescent"
          : age < 18
            ? "late_adolescent"
            : age >= 65
              ? "older_adult"
              : "adult";
  return PROFILE_IDS[ageBand][sex];
}

function attribute(tag, name) {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
}

function parseRunPath(pathData) {
  const runs = [];
  const pattern = /M(\d+) (\d+)h(\d+)v1H(\d+)z/g;
  let consumed = "";
  for (const match of pathData.matchAll(pattern)) {
    const x = Number(match[1]);
    const y = Number(match[2]);
    const width = Number(match[3]);
    const closeX = Number(match[4]);
    if (x !== closeX || width < 1 || x < 0 || y < 0 || x + width > WIDTH || y >= HEIGHT) {
      invalid("bodyMap", "Configured body-region map contains invalid run geometry.");
    }
    consumed += match[0];
    runs.push({ x, y, width });
  }
  if (runs.length === 0 || consumed !== pathData) {
    invalid("bodyMap", "Configured body-region map uses an unsupported geometry grammar.");
  }
  return runs;
}

function parseHitMap(svg, manifestRegions, expectedView) {
  if (!/<svg\b[^>]*\bviewBox="0 0 240 400"/.test(svg)) {
    invalid("bodyMap", "Configured body-region map has an unexpected view box.");
  }
  const regions = new Map();
  for (const tag of svg.match(/<path\b[^>]*>/g) ?? []) {
    const elementId = attribute(tag, "id");
    const pathData = attribute(tag, "d");
    if (!elementId?.startsWith("region-") || !pathData) {
      invalid("bodyMap", "Configured body-region map contains an invalid path record.");
    }
    const regionId = elementId.slice("region-".length);
    const manifestRegion = manifestRegions.get(regionId);
    if (!manifestRegion || manifestRegion.view !== expectedView || regions.has(regionId)) {
      invalid("bodyMap", "Configured body-region map does not match its manifest view.");
    }
    regions.set(regionId, parseRunPath(pathData));
  }
  if (regions.size === 0) invalid("bodyMap", "Configured body-region map has no region paths.");
  const expectedRegionIds = [...manifestRegions.values()]
    .filter((region) => region.view === expectedView)
    .map((region) => region.id);
  if (
    regions.size !== expectedRegionIds.length
    || expectedRegionIds.some((regionId) => !regions.has(regionId))
  ) {
    invalid("bodyMap", "Configured body-region map does not contain the complete region set.");
  }
  return regions;
}

function pointPixel(value, size) {
  return Math.min(size - 1, Math.floor(value * size));
}

function runMapContains(regions, regionId, x, y) {
  const pixelX = pointPixel(x, WIDTH);
  const pixelY = pointPixel(y, HEIGHT);
  return (regions.get(regionId) ?? []).some(
    (run) => run.y === pixelY && pixelX >= run.x && pixelX < run.x + run.width,
  );
}

function scalpContains(regionId, x, y) {
  const pointX = x * WIDTH;
  const pointY = y * HEIGHT;
  const rect = SCALP_RECTS[regionId];
  if (!rect) return false;
  const inRect = pointX >= rect.x && pointX <= rect.x + rect.width
    && pointY >= rect.y && pointY <= rect.y + rect.height;
  const ellipse = ((pointX - 120) / 78) ** 2 + ((pointY - 200) / 108) ** 2 <= 1;
  return inRect && ellipse;
}

function readAtlasManifest(atlasDir, expectedManifestSha256, sourcePackage) {
  if (!SHA256_PATTERN.test(String(expectedManifestSha256 ?? ""))) {
    throw new Error("A lowercase 64-character clinical atlas manifest SHA-256 is required.");
  }
  const bytes = readFileSync(resolve(atlasDir, "manifest.json"));
  const actualSha256 = sha256(bytes);
  if (actualSha256 !== expectedManifestSha256) {
    throw new Error("Clinical atlas manifest SHA-256 does not match the configured pin.");
  }
  const manifest = JSON.parse(bytes.toString("utf8"));
  if (
    manifest.schemaVersion !== 1
    || manifest.sourceName !== sourcePackage.manifestSourceName
    || manifest.width !== WIDTH
    || manifest.height !== HEIGHT
    || !Array.isArray(manifest.profiles)
    || !Array.isArray(manifest.regions)
    || !Array.isArray(manifest.records)
  ) {
    throw new Error("Clinical atlas manifest does not satisfy the deployable schema contract.");
  }
  return { manifest, manifestSha256: actualSha256 };
}

export function createClinicalBodyAtlasContract({
  atlasSource = "makehuman-cc0",
  atlasDir,
  expectedManifestSha256,
} = {}) {
  const sourcePackage = SOURCE_PACKAGES[atlasSource];
  if (!sourcePackage) throw new Error("Unsupported clinical body atlas source configuration.");
  if (atlasSource === "daz-hires-local" && !atlasDir) {
    throw new Error("An explicit local clinical atlas directory is required for daz-hires-local.");
  }
  const resolvedDir = resolve(atlasDir || sourcePackage.defaultDir);
  const manifestPin = expectedManifestSha256 || sourcePackage.defaultManifestSha256;
  const { manifest, manifestSha256 } = readAtlasManifest(resolvedDir, manifestPin, sourcePackage);
  const profiles = new Set(manifest.profiles.map(String));
  const regionsById = new Map(manifest.regions.map((region) => [region.id, region]));
  const recordsByKey = new Map(
    manifest.records.map((record) => [`${record.profile}-${record.view}`, record]),
  );
  const mapCache = new Map();
  const scalpMapSha256 = sha256(SCALP_CANONICAL_GEOMETRY);

  function mapFor(profileId, view) {
    if (view === "scalp") {
      return { sha256: scalpMapSha256, contains: (regionId, x, y) => scalpContains(regionId, x, y) };
    }
    const key = `${profileId}-${view}`;
    if (mapCache.has(key)) return mapCache.get(key);
    const record = recordsByKey.get(key);
    if (
      !record
      || record.hitMap !== `${key}.hitmap.svg`
      || !SHA256_PATTERN.test(String(record.hitMapSha256 ?? ""))
    ) {
      invalid("bodyMap", "Configured body-region map is not bound to the pinned manifest.");
    }
    let bytes;
    try {
      bytes = readFileSync(resolve(resolvedDir, `${key}.hitmap.svg`));
    } catch {
      invalid("bodyMap", "Configured body-region map could not be loaded.");
    }
    const mapSha256 = sha256(bytes);
    if (mapSha256 !== record.hitMapSha256) {
      invalid("bodyMap", "Configured body-region hit-map SHA-256 does not match the pinned manifest.");
    }
    const parsed = parseHitMap(bytes.toString("utf8"), regionsById, view);
    const result = {
      sha256: mapSha256,
      contains: (regionId, x, y) => runMapContains(parsed, regionId, x, y),
    };
    mapCache.set(key, result);
    return result;
  }

  return {
    atlasSource,
    manifestSha256,
    normalizePlacement(input, visitContext) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        invalid("bodyMap", "bodyMap must be a JSON object.");
      }
      if (String(input.atlasSource ?? "") !== atlasSource) {
        invalid("bodyMap.atlasSource", "bodyMap.atlasSource does not match the configured backend atlas source.");
      }
      const expectedProfileId = profileIdForVisit(visitContext);
      if (!profiles.has(expectedProfileId) || String(input.atlasProfileId ?? "") !== expectedProfileId) {
        invalid("bodyMap.atlasProfileId", "bodyMap.atlasProfileId does not match the patient profile at visit time.");
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
      const regionLabel = detailId ? digitLabel(region, detailId) : String(region.label);
      const x = normalizeCoordinate(input.x, "bodyMap.x");
      const y = normalizeCoordinate(input.y, "bodyMap.y");
      const regionMap = mapFor(expectedProfileId, view);
      if (!regionMap.contains(regionId, x, y)) {
        invalid("bodyMap.regionId", "The body-map point is outside the claimed region for this atlas profile and view.");
      }
      return {
        atlasSource,
        atlasProfileId: expectedProfileId,
        atlasManifestSha256: manifestSha256,
        bodyRegionMapSha256: regionMap.sha256,
        view,
        x,
        y,
        regionId,
        detailId,
        regionLabel,
        bodySurface: String(region.surface),
      };
    },
  };
}

const defaultContract = createClinicalBodyAtlasContract();

export function normalizeClinicalBodyPlacement(input, visitContext) {
  return defaultContract.normalizePlacement(input, visitContext);
}

export function clinicalBodyRegionManifestVersion() {
  return 1;
}
