import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createClinicalBodyAtlasContract,
} from "./clinical-body-region-contract.mjs";

const STANDARD_MANIFEST_SHA256 = "e485f8cc56c2670f0dd052514d445f9f7692db2e1ed3ddca9075192752fd0a61";
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

    writeFileSync(
      join(atlasDir, "adult_female_30-front.hitmap.svg"),
      '<svg viewBox="0 0 240 400"><path id="region-front-right-toes" d="M69 381L90 382z"/></svg>',
    );
    const malformedMap = createClinicalBodyAtlasContract({
      atlasSource: "makehuman-cc0",
      atlasDir,
      expectedManifestSha256: STANDARD_MANIFEST_SHA256,
    });
    assert.throws(
      () => malformedMap.normalizePlacement(placement(), visitContext),
      (error) => error.field === "bodyMap" && /unsupported geometry grammar/i.test(error.message),
    );
  } finally {
    rmSync(atlasDir, { recursive: true, force: true });
  }
});
