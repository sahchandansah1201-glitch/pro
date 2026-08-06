import { describe, expect, it } from "vitest";

import {
  SENSITIVE_AREA_CAPTURE_PROTOCOL,
  getDemoLesionSourceLocalization,
  validateLesionSourceLocalization,
} from "./lesion-source-localization";

describe("lesion source localization", () => {
  it("links a captured lesion to an exact overview image and normalized photo point", () => {
    const localization = getDemoLesionSourceLocalization("l-001");

    expect(localization).toMatchObject({
      lesionId: "l-001",
      overviewImageId: "i-001",
      linkedDermoscopyImageId: "i-002",
      bodyView: "back",
      coverage: "captured",
      clinicianConfirmation: "confirmed",
    });
    expect(localization?.imagePoint?.x).toBeGreaterThanOrEqual(0);
    expect(localization?.imagePoint?.x).toBeLessThanOrEqual(1);
    expect(localization?.imagePoint?.y).toBeGreaterThanOrEqual(0);
    expect(localization?.imagePoint?.y).toBeLessThanOrEqual(1);
    expect(validateLesionSourceLocalization(localization!)).toEqual([]);
  });

  it("marks a partially captured area for clinician review", () => {
    const localization = getDemoLesionSourceLocalization("l-009");

    expect(localization).toMatchObject({
      lesionId: "l-009",
      overviewImageId: "i-013",
      coverage: "partial",
      clinicianConfirmation: "needs_review",
    });
    expect(validateLesionSourceLocalization(localization!)).toEqual([]);
  });

  it("never assigns a source point or confirmation when the area was not captured", () => {
    const localization = getDemoLesionSourceLocalization("l-010");

    expect(localization).toMatchObject({
      lesionId: "l-010",
      overviewImageId: null,
      imagePoint: null,
      coverage: "not_captured",
      clinicianConfirmation: "not_applicable",
    });
    expect(localization?.note).toContain("не означает отсутствие образования");
    expect(validateLesionSourceLocalization(localization!)).toEqual([]);
  });

  it("returns no localization for an unknown lesion instead of deriving photo coordinates", () => {
    expect(getDemoLesionSourceLocalization("unknown-lesion")).toBeNull();
  });

  it("defines explicit captured, partial and not captured states for sensitive areas", () => {
    expect(SENSITIVE_AREA_CAPTURE_PROTOCOL.map((item) => item.coverage)).toEqual([
      "captured",
      "partial",
      "not_captured",
    ]);
    expect(SENSITIVE_AREA_CAPTURE_PROTOCOL[2].guidance).toContain(
      "не означает отсутствие образования",
    );
  });
});
