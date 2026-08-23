import { describe, expect, it } from "vitest";

import {
  CLINICAL_BODY_REGIONS,
  clinicalBodyRegionById,
  clinicalBodyRegionDetailOptions,
  clinicalBodyRegionsForView,
  type ClinicalBodyRegion,
} from "@/lib/clinical-body-regions";
import atlasManifest from "../../public/clinical-body-atlas-regions/manifest.json";

describe("clinical body region vocabulary", () => {
  it("has stable unique ids and single-channel mask codes", () => {
    const ids = CLINICAL_BODY_REGIONS.map((region) => region.id);
    const codes = CLINICAL_BODY_REGIONS.map((region) => region.code);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(codes).size).toBe(codes.length);
    expect(Math.min(...codes)).toBeGreaterThan(0);
    expect(Math.max(...codes)).toBeLessThan(256);
  });

  it("stores native Russian labels plus side and surface for every region", () => {
    for (const region of CLINICAL_BODY_REGIONS) {
      expect(region.label).toMatch(/[А-Яа-яЁё]/);
      expect(region.side).toMatch(/^(left|right|midline)$/);
      expect(region.surface).toMatch(
        /^(anterior|posterior|left_lateral|right_lateral|superior)$/,
      );
      expect(region.terminologySource).toBe("FIPAT_TA2_working_alignment");
      expect(region.terminologyStatus).toBe("technical_review_required");
    }
  });

  it("uses patient laterality, not screen laterality", () => {
    expect(clinicalBodyRegionById("front-right-thigh")?.label).toBe(
      "Передняя поверхность правого бедра",
    );
    expect(clinicalBodyRegionById("front-left-thigh")?.label).toBe(
      "Передняя поверхность левого бедра",
    );
    expect(clinicalBodyRegionById("back-left-calf")?.label).toBe(
      "Задняя поверхность левой голени",
    );
    expect(clinicalBodyRegionById("back-right-calf")?.label).toBe(
      "Задняя поверхность правой голени",
    );
  });

  it("uses the correct Russian genitive case in lateral region labels", () => {
    const expected = {
      "left-upper-arm": "Боковая поверхность левого плеча",
      "left-elbow": "Боковая область левого локтя",
      "left-forearm": "Боковая поверхность левого предплечья",
      "left-wrist": "Боковая область левого запястья",
      "left-thigh": "Боковая поверхность левого бедра",
      "left-knee": "Боковая область левого колена",
      "left-ankle": "Боковая область левого голеностопного сустава",
      "right-upper-arm": "Боковая поверхность правого плеча",
      "right-elbow": "Боковая область правого локтя",
      "right-forearm": "Боковая поверхность правого предплечья",
      "right-wrist": "Боковая область правого запястья",
      "right-thigh": "Боковая поверхность правого бедра",
      "right-knee": "Боковая область правого колена",
      "right-ankle": "Боковая область правого голеностопного сустава",
    } as const;

    for (const [regionId, label] of Object.entries(expected)) {
      expect(clinicalBodyRegionById(regionId)?.label).toBe(label);
    }
  });

  it("keeps the distributed atlas manifest vocabulary synchronized", () => {
    expect(
      atlasManifest.regions.map(({ id, label }) => ({ id, label })),
    ).toEqual(
      CLINICAL_BODY_REGIONS.map(({ id, label }) => ({ id, label })),
    );
  });

  it("exposes only regions belonging to the active projection", () => {
    const assertView = (view: ClinicalBodyRegion["view"]) => {
      const regions = clinicalBodyRegionsForView(view);
      expect(regions.length).toBeGreaterThan(0);
      expect(regions.every((region) => region.view === view)).toBe(true);
    };

    assertView("front");
    assertView("back");
    assertView("left");
    assertView("right");
    assertView("scalp");
  });

  it("offers doctor-confirmed labels for individual fingers and toes", () => {
    expect(clinicalBodyRegionDetailOptions("front-right-toes")).toContainEqual({
      id: "digit-5",
      label: "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
    });
    expect(clinicalBodyRegionDetailOptions("front-left-fingers")).toContainEqual({
      id: "digit-2",
      label: "Ладонная поверхность 2-го пальца (указательного) левой кисти",
    });
    expect(clinicalBodyRegionDetailOptions("front-right-palm")).toEqual([]);
  });
});
