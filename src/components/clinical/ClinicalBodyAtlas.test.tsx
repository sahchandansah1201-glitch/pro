import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClinicalBodyAtlas } from "./ClinicalBodyAtlas";
import {
  CLINICAL_BODY_ATLAS_HEIGHT,
  CLINICAL_BODY_ATLAS_WIDTH,
  clinicalBodyAtlasAssetPath,
  clinicalBodyAtlasManifestSha256,
  clinicalBodyAtlasSource,
  clinicalBodyProfileFromAge,
  clinicalBodyProfileAssetName,
  clinicalBodyRegionMapSha256,
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

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("ClinicalBodyAtlas", () => {
  it("keeps frontend manifest and map pins equal to the owner-approved package", () => {
    const bytes = readFileSync("public/clinical-body-atlas-daz-local/manifest.json");
    const manifest = JSON.parse(bytes.toString("utf8")) as {
      records: Array<{ profile: string; view: Exclude<ClinicalBodyView, "scalp">; hitMapSha256: string }>;
    };
    expect(createHash("sha256").update(bytes).digest("hex"))
      .toBe(clinicalBodyAtlasManifestSha256());

    const bands: ClinicalBodyAgeBand[] = [
      "infant",
      "early_child",
      "child",
      "adolescent",
      "late_adolescent",
      "adult",
      "older_adult",
    ];
    for (const ageBand of bands) {
      for (const sex of ["female", "male"] as const) {
        const profile = { ageBand, sex };
        const profileId = clinicalBodyProfileAssetName(profile);
        for (const view of ["front", "back", "left", "right"] as const) {
          const record = manifest.records.find(
            (candidate) => candidate.profile === profileId && candidate.view === view,
          );
          expect(clinicalBodyRegionMapSha256(profile, view)).toBe(record?.hitMapSha256);
        }
      }
    }
  });

  it("uses the owner-approved high-resolution atlas without a legacy fallback", () => {
    vi.stubEnv("VITE_CLINICAL_BODY_ATLAS_SOURCE", "makehuman-cc0");

    expect(clinicalBodyAtlasSource()).toBe("daz-hires-local");
    expect(
      clinicalBodyAtlasAssetPath(
        { ageBand: "adult", sex: "female" },
        "front",
      ),
    ).toBe("/clinical-body-atlas-daz-local/adult_female_30-front.png");
  });

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
