import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createClinicalBodyAtlasContract,
} from "./clinical-body-region-contract.mjs";

const STANDARD_MANIFEST_SHA256 = "cf6838d134b41b6f6862e2d86a54daaeb54b87da5952aa9e3c66c36a22099da6";
const ADULT_FEMALE_FRONT_SHA256 = "7ca70b005832ff347c6eab0a8d6359af1b54ee232951b027d7e8f36e92e4a11c";
const visitContext = {
  startedAt: "2026-08-21T12:00:00.000Z",
  createdAt: "2026-08-21T11:00:00.000Z",
  patient: { sex: "female", birthDate: "1990-01-01" },
};

function standardContract() {
  return createClinicalBodyAtlasContract({
    atlasSource: "makehuman-cc0",
    expectedManifestSha256: STANDARD_MANIFEST_SHA256,
  });
}

function placement(overrides = {}) {
  return {
    atlasSource: "makehuman-cc0",
    atlasProfileId: "adult_female_30",
    view: "front",
    x: 0.35,
    y: 0.96,
    regionId: "front-right-toes",
    detailId: "digit-5",
    ...overrides,
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("accepts only a point covered by the exact source/profile/view region map", () => {
  assert.deepEqual(
    standardContract().normalizePlacement(placement(), visitContext),
    {
      atlasSource: "makehuman-cc0",
      atlasProfileId: "adult_female_30",
      atlasManifestSha256: STANDARD_MANIFEST_SHA256,
      bodyRegionMapSha256: ADULT_FEMALE_FRONT_SHA256,
      view: "front",
      x: 0.35,
      y: 0.96,
      regionId: "front-right-toes",
      detailId: "digit-5",
      regionLabel: "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
      bodySurface: "anterior",
    },
  );
});

test("fails closed for source mismatch, patient profile mismatch and point outside region", () => {
  const contract = standardContract();
  assert.throws(
    () => contract.normalizePlacement(placement({ atlasSource: "daz-hires-local" }), visitContext),
    (error) => error.field === "bodyMap.atlasSource",
  );
  assert.throws(
    () => contract.normalizePlacement(placement({ atlasProfileId: "adult_male_30" }), visitContext),
    (error) => error.field === "bodyMap.atlasProfileId",
  );
  assert.throws(
    () => contract.normalizePlacement(placement({ y: 0.5 }), visitContext),
    (error) => error.field === "bodyMap.regionId" && /outside/i.test(error.message),
  );
});

test("fails closed for unknown regions, view mismatch, invalid coordinates and unsupported details", () => {
  const contract = standardContract();
  assert.throws(
    () => contract.normalizePlacement(placement({ regionId: "front-unknown" }), visitContext),
    /bodyRegionId/,
  );
  assert.throws(
    () => contract.normalizePlacement(placement({ view: "back" }), visitContext),
    /bodyMap\.view/,
  );
  assert.throws(
    () => contract.normalizePlacement(placement({ x: 1.01 }), visitContext),
    /bodyMap\.x/,
  );
  assert.throws(
    () => contract.normalizePlacement({
      ...placement(),
      regionId: "front-face",
      x: 0.5,
      y: 0.09,
      detailId: "digit-1",
    }, visitContext),
    /bodyRegionDetailId/,
  );
});

test("uses the same clipped canonical scalp geometry as the UI", () => {
  const result = standardContract().normalizePlacement(placement({
    view: "scalp",
    x: 0.5,
    y: 0.5,
    regionId: "scalp-vertex",
    detailId: null,
  }), visitContext);
  assert.equal(result.regionId, "scalp-vertex");
  assert.match(result.bodyRegionMapSha256, /^[a-f0-9]{64}$/);
  assert.throws(
    () => standardContract().normalizePlacement(placement({
      view: "scalp",
      x: 0.1,
      y: 0.5,
      regionId: "scalp-vertex",
      detailId: null,
    }), visitContext),
    (error) => error.field === "bodyMap.regionId",
  );
});

test("derives the age profile at visit start instead of the current clock", () => {
  const result = standardContract().normalizePlacement(placement({
    atlasProfileId: "late_adolescent_female_16",
    x: 0.325,
    y: 0.96125,
  }), {
    startedAt: "2026-08-21T12:00:00.000Z",
    createdAt: "2026-08-30T12:00:00.000Z",
    patient: { sex: "female", birthDate: "2008-08-22" },
  });
  assert.equal(result.atlasProfileId, "late_adolescent_female_16");
});

test("requires a pinned manifest and rejects a mismatched manifest hash", () => {
  assert.throws(
    () => createClinicalBodyAtlasContract({
      atlasSource: "daz-hires-local",
      expectedManifestSha256: "a".repeat(64),
    }),
    /explicit local clinical atlas directory/i,
  );
  assert.throws(
    () => createClinicalBodyAtlasContract({
      atlasSource: "daz-hires-local",
      atlasDir: "public/clinical-body-atlas-daz-local",
    }),
    /manifest SHA-256/i,
  );
  assert.throws(
    () => createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      expectedManifestSha256: "0".repeat(64),
    }),
    /manifest SHA-256/i,
  );
});

test("fails closed when the pinned package is missing or has malformed hit-map geometry", () => {
  const atlasDir = mkdtempSync(join(tmpdir(), "skindoctor-atlas-contract-"));
  try {
    cpSync("public/clinical-body-atlas-regions/manifest.json", join(atlasDir, "manifest.json"));
    const missingMap = createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      atlasDir,
      expectedManifestSha256: STANDARD_MANIFEST_SHA256,
    });
    assert.throws(
      () => missingMap.normalizePlacement(placement(), visitContext),
      (error) => error.field === "bodyMap" && /could not be loaded/i.test(error.message),
    );

    const malformedHitMap = '<svg viewBox="0 0 240 400"><path id="region-front-right-toes" d="M69 381L90 382z"/></svg>';
    writeFileSync(join(atlasDir, "adult_female_30-front.hitmap.svg"), malformedHitMap);
    const manifest = JSON.parse(readFileSync(join(atlasDir, "manifest.json"), "utf8"));
    const record = manifest.records.find(
      (item) => item.profile === "adult_female_30" && item.view === "front",
    );
    record.hitMapSha256 = sha256(malformedHitMap);
    const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
    writeFileSync(join(atlasDir, "manifest.json"), manifestBytes);
    const malformedMap = createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      atlasDir,
      expectedManifestSha256: sha256(manifestBytes),
    });
    assert.throws(
      () => malformedMap.normalizePlacement(placement(), visitContext),
      (error) => error.field === "bodyMap" && /unsupported geometry grammar/i.test(error.message),
    );
  } finally {
    rmSync(atlasDir, { recursive: true, force: true });
  }
});

test("rejects a well-formed hit map that is not bound to the pinned manifest", () => {
  const atlasDir = mkdtempSync(join(tmpdir(), "skindoctor-atlas-integrity-"));
  try {
    cpSync("public/clinical-body-atlas-regions/manifest.json", join(atlasDir, "manifest.json"));
    writeFileSync(
      join(atlasDir, "adult_female_30-front.hitmap.svg"),
      '<svg viewBox="0 0 240 400"><path id="region-front-right-toes" d="M84 384h1v1H84z"/></svg>',
    );
    const contract = createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      atlasDir,
      expectedManifestSha256: STANDARD_MANIFEST_SHA256,
    });

    assert.throws(
      () => contract.normalizePlacement(placement(), visitContext),
      (error) => error.field === "bodyMap" && /hit-map SHA-256/i.test(error.message),
    );
  } finally {
    rmSync(atlasDir, { recursive: true, force: true });
  }
});

test("rejects a manifest-pinned hit map with an incomplete region set", () => {
  const atlasDir = mkdtempSync(join(tmpdir(), "skindoctor-atlas-regions-"));
  try {
    const manifest = JSON.parse(
      readFileSync("public/clinical-body-atlas-regions/manifest.json", "utf8"),
    );
    const hitMap = '<svg viewBox="0 0 240 400"><path id="region-front-right-toes" d="M84 384h1v1H84z"/></svg>';
    const record = manifest.records.find(
      (item) => item.profile === "adult_female_30" && item.view === "front",
    );
    record.hitMapSha256 = sha256(hitMap);
    const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
    writeFileSync(join(atlasDir, "manifest.json"), manifestBytes);
    writeFileSync(join(atlasDir, record.hitMap), hitMap);
    const contract = createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      atlasDir,
      expectedManifestSha256: sha256(manifestBytes),
    });

    assert.throws(
      () => contract.normalizePlacement(placement(), visitContext),
      (error) => error.field === "bodyMap" && /complete region set/i.test(error.message),
    );
  } finally {
    rmSync(atlasDir, { recursive: true, force: true });
  }
});
