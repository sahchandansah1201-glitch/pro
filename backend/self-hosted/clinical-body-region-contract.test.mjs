import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeClinicalBodyPlacement,
} from "./clinical-body-region-contract.mjs";

test("normalizes a registered body region and doctor-confirmed right little toe", () => {
  assert.deepEqual(
    normalizeClinicalBodyPlacement({
      view: "front",
      x: 0.35083,
      y: 0.99001,
      regionId: "front-right-toes",
      detailId: "digit-5",
    }),
    {
      view: "front",
      x: 0.35083,
      y: 0.99001,
      regionId: "front-right-toes",
      detailId: "digit-5",
      regionLabel: "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
      bodySurface: "anterior",
    },
  );
});

test("fails closed for unknown regions, view mismatch, invalid coordinates and unsupported details", () => {
  assert.throws(
    () => normalizeClinicalBodyPlacement({ view: "front", x: 0.5, y: 0.5, regionId: "front-unknown" }),
    /bodyRegionId/,
  );
  assert.throws(
    () => normalizeClinicalBodyPlacement({ view: "back", x: 0.5, y: 0.5, regionId: "front-face" }),
    /bodyMap\.view/,
  );
  assert.throws(
    () => normalizeClinicalBodyPlacement({ view: "front", x: 1.01, y: 0.5, regionId: "front-face" }),
    /bodyMap\.x/,
  );
  assert.throws(
    () => normalizeClinicalBodyPlacement({ view: "front", x: 0.5, y: 0.5, regionId: "front-face", detailId: "digit-1" }),
    /bodyRegionDetailId/,
  );
});
