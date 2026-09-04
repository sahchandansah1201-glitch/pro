import { describe, expect, it } from "vitest";

import type { Lesion } from "@/lib/domain";
import {
  clinicalBodyAtlasManifestSha256,
  clinicalBodyRegionMapSha256,
} from "@/lib/clinical-body-atlas";
import { bodyMapPlacementBinding } from "./bodyMapPlacementBinding";

const profile = { ageBand: "adult", sex: "female" } as const;

function exactLesion(overrides: Partial<Lesion> = {}): Lesion {
  return {
    id: "lesion-1",
    patientId: "patient-1",
    bodyZone: "Передняя область лица",
    mapPoint: { view: "front", x: 0.5, y: 0.09 },
    label: "Очаг",
    firstSeenAt: "2026-09-03",
    status: "active",
    bodyAtlasSource: "daz-hires-local",
    bodyAtlasProfileId: "adult_female_30",
    bodyAtlasManifestSha256: clinicalBodyAtlasManifestSha256(),
    bodyRegionMapSha256: clinicalBodyRegionMapSha256(profile, "front"),
    ...overrides,
  };
}

describe("bodyMapPlacementBinding", () => {
  it("accepts a placement only when source, profile, manifest and map hash match", () => {
    expect(bodyMapPlacementBinding(exactLesion(), profile)).toEqual({
      exact: true,
      mismatchFields: [],
    });
  });

  it.each([
    ["source", { bodyAtlasSource: "makehuman-cc0" }],
    ["profile", { bodyAtlasProfileId: "older_female_70" }],
    ["manifest", { bodyAtlasManifestSha256: "a".repeat(64) }],
    ["map", { bodyRegionMapSha256: "b".repeat(64) }],
  ] as const)("fails closed on a %s mismatch", (field, overrides) => {
    expect(bodyMapPlacementBinding(exactLesion(overrides), profile)).toEqual({
      exact: false,
      mismatchFields: [field],
    });
  });

  it("fails closed when binding metadata is missing", () => {
    expect(bodyMapPlacementBinding(exactLesion({
      bodyAtlasSource: null,
      bodyAtlasProfileId: null,
      bodyAtlasManifestSha256: null,
      bodyRegionMapSha256: null,
    }), profile)).toEqual({
      exact: false,
      mismatchFields: ["source", "profile", "manifest", "map"],
    });
  });
});
