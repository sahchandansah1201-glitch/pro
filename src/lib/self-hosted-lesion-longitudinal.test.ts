import { describe, expect, it } from "vitest";
import { toLesionLongitudinalHistory } from "./self-hosted-lesion-longitudinal";

describe("self-hosted lesion longitudinal history", () => {
  it("keeps every safe image independently from comparison candidates", () => {
    const history = toLesionLongitudinalHistory({
      lesionId: "lesion-1",
      images: [{
        id: "image-single",
        visitId: "visit-1",
        kind: "overview_photo",
        capturedAt: "2026-05-19T10:42:00.000Z",
      }],
      candidatePairs: [],
    });

    expect(history.images).toEqual([{
      id: "image-single",
      visitId: "visit-1",
      kind: "overview_photo",
      capturedAt: "2026-05-19T10:42:00.000Z",
    }]);
    expect(history.candidatePairs).toEqual([]);
    expect(history.boundaries.patientDeliveryAllowed).toBe(false);
    expect(history.boundaries.storagePathsExposed).toBe(false);
  });
});
