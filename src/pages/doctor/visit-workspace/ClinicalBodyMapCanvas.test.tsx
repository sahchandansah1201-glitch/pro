import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClinicalBodyMapCanvas } from "./ClinicalBodyMapCanvas";

const profile = { sex: "female", ageBand: "adult" } as const;

describe("ClinicalBodyMapCanvas", () => {
  it("fails closed on the background and resolves a patient-side region", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[]}
        demoPoints={[]}
        pending={null}
        onPlace={onPlace}
      />,
    );

    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 240, bottom: 400, width: 240, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.click(svg, { clientX: 8, clientY: 200 });
    expect(onPlace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("region-front-right-thigh"), {
      clientX: 84,
      clientY: 264,
    });
    expect(onPlace).toHaveBeenCalledWith({
      view: "front",
      x: 0.35,
      y: 0.66,
      regionId: "front-right-thigh",
      regionLabel: "Передняя поверхность правого бедра",
    });
  });

  it("supports keyboard placement through the stable region anchor", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="back"
        points={[]}
        demoPoints={[]}
        pending={null}
        onPlace={onPlace}
      />,
    );

    fireEvent.change(screen.getByLabelText("Выбрать анатомическую область"), {
      target: { value: "back-left-calf" },
    });
    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        view: "back",
        regionId: "back-left-calf",
        regionLabel: "Задняя поверхность левой голени",
      }),
    );
  });
});
