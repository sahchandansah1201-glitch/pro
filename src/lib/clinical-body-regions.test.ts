import { describe, expect, it } from "vitest";

import {
  CLINICAL_BODY_REGIONS,
  clinicalBodyRegionById,
  clinicalBodyRegionsForView,
  type ClinicalBodyRegion,
} from "@/lib/clinical-body-regions";

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
});
