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

  it("keeps native-resolution coordinate precision and marker size while zoomed", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[]}
        demoPoints={[{
          id: "local-lesion-1",
          num: 1,
          x: 0.12345,
          y: 0.23456,
          selected: false,
          label: "Учебный очаг",
          onSelect: vi.fn(),
        }]}
        pending={null}
        zoom={8}
        onPlace={onPlace}
      />,
    );

    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 2400, bottom: 4000, width: 2400, height: 4000, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    fireEvent.click(screen.getByTestId("region-front-right-thigh"), {
      clientX: 842.184,
      clientY: 2641.96,
    });
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({
      x: 0.35083,
      y: 0.66025,
    }));
    expect(document.querySelector('[data-local-marker-id="local-lesion-1"]')).toHaveAttribute(
      "transform",
      "translate(29.628 93.824) scale(0.125) translate(-29.628 -93.824)",
    );
    fireEvent.pointerEnter(screen.getByTestId("region-front-right-thigh"));
    expect(screen.getByTestId("region-front-right-thigh")).toHaveAttribute(
      "fill-opacity",
      "0.001",
    );
    expect(screen.getByText(/На увеличении контур области скрыт/)).toBeInTheDocument();
  });
});
