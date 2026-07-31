import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ClinicalBodyAtlas } from "./ClinicalBodyAtlas";
import type {
  ClinicalBodyAgeBand,
  ClinicalBodyProfile,
  ClinicalBodyView,
} from "@/lib/clinical-body-atlas";

function renderAtlas(profile: ClinicalBodyProfile, view: ClinicalBodyView) {
  return render(
    <svg viewBox="0 0 200 400">
      <ClinicalBodyAtlas profile={profile} view={view} />
    </svg>,
  );
}

describe("ClinicalBodyAtlas", () => {
  it("renders every age band and keeps a larger relative head for younger children", () => {
    const bands: ClinicalBodyAgeBand[] = [
      "infant",
      "early_child",
      "child",
      "adolescent",
      "late_adolescent",
      "adult",
    ];
    const headSizes: number[] = [];
    const shoulderPositions: number[] = [];
    const crotchPositions: number[] = [];

    for (const ageBand of bands) {
      const { unmount } = renderAtlas({ sex: "female", ageBand }, "front");
      const atlas = screen.getByTestId("clinical-body-atlas");
      expect(atlas).toHaveAttribute("data-age-band", ageBand);
      headSizes.push(Number(atlas.getAttribute("data-head-rx")));
      shoulderPositions.push(Number(atlas.getAttribute("data-shoulder-y")));
      crotchPositions.push(Number(atlas.getAttribute("data-crotch-y")));
      unmount();
    }

    expect(headSizes).toEqual([34, 29, 25, 22, 19.5, 19]);
    expect(shoulderPositions).toEqual([103, 91, 83, 74, 67, 65]);
    expect(crotchPositions).toEqual([250, 243, 237, 229, 223, 223]);
  });

  it("renders native front, back, left, right and scalp anatomy", () => {
    const views: ClinicalBodyView[] = ["front", "back", "left", "right", "scalp"];
    for (const view of views) {
      const { container, unmount } = renderAtlas({ sex: "male", ageBand: "adult" }, view);
      expect(screen.getByTestId("clinical-body-atlas")).toHaveAttribute("data-view", view);
      if (view === "left" || view === "right") {
        expect(container.querySelector('[data-part="side-profile"]')).not.toBeNull();
      }
      if (view === "scalp") {
        expect(container.querySelector('[data-part="scalp"]')).not.toBeNull();
      }
      unmount();
    }
  });

  it("keeps adult chest landmarks out of infant and child profiles", () => {
    const { container, rerender } = render(
      <svg viewBox="0 0 200 400">
        <ClinicalBodyAtlas profile={{ sex: "female", ageBand: "early_child" }} view="front" />
      </svg>,
    );
    expect(container.querySelector('[data-part="adult-female-chest"]')).toBeNull();

    rerender(
      <svg viewBox="0 0 200 400">
        <ClinicalBodyAtlas profile={{ sex: "female", ageBand: "adult" }} view="front" />
      </svg>,
    );
    expect(container.querySelector('[data-part="adult-female-chest"]')).not.toBeNull();
  });
});
