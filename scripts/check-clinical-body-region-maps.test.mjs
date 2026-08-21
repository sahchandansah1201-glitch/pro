import assert from "node:assert/strict";
import test from "node:test";

import { checkClinicalBodyRegionMaps } from "./check-clinical-body-region-maps.mjs";

test("all generated body region maps satisfy fail-closed invariants", async () => {
  const result = await checkClinicalBodyRegionMaps("public/clinical-body-atlas-regions");
  assert.deepEqual(result, { profiles: 14, views: 56, regions: 114 });
});
