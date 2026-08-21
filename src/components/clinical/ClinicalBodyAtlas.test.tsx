import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClinicalBodyAtlas } from "./ClinicalBodyAtlas";
import {
  CLINICAL_BODY_ATLAS_HEIGHT,
  CLINICAL_BODY_ATLAS_WIDTH,
  clinicalBodyAtlasAssetPath,
  clinicalBodyAtlasSource,
  clinicalBodyProfileFromAge,
  type ClinicalBodyAgeBand,
  type ClinicalBodyProfile,
  type ClinicalBodyView,
} from "@/lib/clinical-body-atlas";

function renderAtlas(profile: ClinicalBodyProfile, view: ClinicalBodyView) {
  return render(
    <svg
      viewBox={`0 0 ${CLINICAL_BODY_ATLAS_WIDTH} ${CLINICAL_BODY_ATLAS_HEIGHT}`}
    >
      <ClinicalBodyAtlas profile={profile} view={view} />
    </svg>,
  );
}

describe("ClinicalBodyAtlas", () => {
  it("maps every age band and sex to a dedicated four-view atlas", () => {
    const bands: ClinicalBodyAgeBand[] = [
      "infant",
      "early_child",
      "child",
      "adolescent",
      "late_adolescent",
      "adult",
      "older_adult",
    ];
    const views: Exclude<ClinicalBodyView, "scalp">[] = [
      "front",
      "back",
      "left",
      "right",
    ];

    for (const ageBand of bands) {
      for (const sex of ["female", "male"] as const) {
        for (const view of views) {
          const profile = { ageBand, sex };
          const { container, unmount } = renderAtlas(profile, view);
          const atlas = screen.getByTestId("clinical-body-atlas");
          const image = container.querySelector('[data-part="atlas-image"]');

          expect(atlas).toHaveAttribute("data-age-band", ageBand);
          expect(atlas).toHaveAttribute("data-sex", sex);
          expect(atlas).toHaveAttribute("data-view", view);
          expect(atlas).toHaveAttribute(
            "data-source",
            clinicalBodyAtlasSource(),
          );
          expect(image).toHaveAttribute(
            "href",
            clinicalBodyAtlasAssetPath(profile, view),
          );
          unmount();
        }
      }
    }
  });

  it("keeps the scalp as a dedicated clinical orientation map", () => {
    const { container } = renderAtlas(
      { sex: "female", ageBand: "adult" },
      "scalp",
    );

    expect(screen.getByTestId("clinical-body-atlas")).toHaveAttribute(
      "data-view",
      "scalp",
    );
    expect(container.querySelector('[data-part="scalp"]')).not.toBeNull();
    expect(container.querySelector('[data-part="atlas-image"]')).toBeNull();
  });

  it("selects the correct profile at every age boundary", () => {
    const cases: Array<[number, ClinicalBodyAgeBand]> = [
      [0, "infant"],
      [0.99, "infant"],
      [1, "early_child"],
      [4.99, "early_child"],
      [5, "child"],
      [9.99, "child"],
      [10, "adolescent"],
      [14.99, "adolescent"],
      [15, "late_adolescent"],
      [17.99, "late_adolescent"],
      [18, "adult"],
      [64.99, "adult"],
      [65, "older_adult"],
    ];

    for (const [age, ageBand] of cases) {
      expect(clinicalBodyProfileFromAge("female", age).ageBand).toBe(ageBand);
    }
  });
});
