import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ClinicalBodyMapCanvas } from "./ClinicalBodyMapCanvas";

const profile = { sex: "female", ageBand: "adult" } as const;

function markAtlasReady() {
  fireEvent.load(document.querySelector('[data-part="atlas-image"]') as SVGImageElement);
}

describe("ClinicalBodyMapCanvas", () => {
  it("explains placement without assuming a mouse pointer", () => {
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[]}
        demoPoints={[]}
        pending={null}
        onPlace={vi.fn()}
      />,
    );

    expect(screen.getByText(
      "Коснитесь нужного места на модели или выберите область из списка.",
    )).toBeInTheDocument();
    expect(screen.queryByText("наведите указатель на модель")).not.toBeInTheDocument();
  });

  it("announces loading and ready states for the model image", () => {
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[]}
        demoPoints={[]}
        pending={null}
        onPlace={vi.fn()}
      />,
    );

    expect(screen.getByRole("status", { name: "Состояние модели" }))
      .toHaveTextContent("Модель загружается…");
    fireEvent.load(document.querySelector('[data-part="atlas-image"]') as SVGImageElement);
    expect(screen.getByRole("status", { name: "Состояние модели" }))
      .toHaveTextContent("Модель готова");
  });

  it("fails closed while the model image is loading", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[{
          id: "lesion-1",
          num: 1,
          x: 0.35,
          y: 0.66,
          selected: true,
          label: "Очаг",
          onSelect: vi.fn(),
        }]}
        demoPoints={[]}
        pending={{ x: 0.35, y: 0.66, regionId: "front-right-thigh" }}
        onPlace={onPlace}
      />,
    );

    expect(document.querySelector('[data-marker-id="lesion-1"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Точное положение метки" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Выбрать анатомическую область")).toBeDisabled();

    fireEvent.click(screen.getByTestId("region-front-right-thigh"), {
      clientX: 84,
      clientY: 264,
    });
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("shows an image error and retries from the loading state", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="front"
        points={[{
          id: "lesion-1",
          num: 1,
          x: 0.35,
          y: 0.66,
          selected: true,
          label: "Очаг",
          onSelect: vi.fn(),
        }]}
        demoPoints={[]}
        pending={{ x: 0.35, y: 0.66, regionId: "front-right-thigh" }}
        onPlace={onPlace}
      />,
    );

    const firstImage = document.querySelector('[data-part="atlas-image"]') as SVGImageElement;
    fireEvent.error(firstImage);

    expect(screen.getByRole("alert", { name: "Состояние модели" }))
      .toHaveTextContent("Не удалось загрузить модель");
    expect(document.querySelector('[data-marker-id="lesion-1"]')).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Точное положение метки" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Выбрать анатомическую область")).toBeDisabled();
    fireEvent.click(screen.getByTestId("region-front-right-thigh"), {
      clientX: 84,
      clientY: 264,
    });
    expect(onPlace).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(screen.getByRole("status", { name: "Состояние модели" }))
      .toHaveTextContent("Модель загружается…");
    const retryImage = document.querySelector('[data-part="atlas-image"]') as SVGImageElement;
    expect(retryImage).not.toBe(firstImage);
    expect(document.querySelector('[data-marker-id="lesion-1"]')).not.toBeInTheDocument();
    expect(screen.getByLabelText("Выбрать анатомическую область")).toBeDisabled();

    fireEvent.load(retryImage);
    expect(screen.getByRole("status", { name: "Состояние модели" }))
      .toHaveTextContent("Модель готова");
    expect(document.querySelector('[data-marker-id="lesion-1"]')).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Точное положение метки" })).toBeInTheDocument();
    expect(screen.getByLabelText("Выбрать анатомическую область")).toBeEnabled();
  });

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
    markAtlasReady();
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

  it("supports keyboard placement through the current model hit-map geometry", () => {
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

    const region = screen.getByTestId("region-back-left-calf") as unknown as SVGGraphicsElement;
    markAtlasReady();
    region.getBBox = () => ({
      x: 132,
      y: 268,
      width: 16,
      height: 28,
    }) as DOMRect;

    fireEvent.change(screen.getByLabelText("Выбрать анатомическую область"), {
      target: { value: "back-left-calf" },
    });
    expect(onPlace).toHaveBeenCalledWith(
      expect.objectContaining({
        view: "back",
        regionId: "back-left-calf",
        regionLabel: "Задняя поверхность левой голени",
        x: 0.58333,
        y: 0.705,
      }),
    );
  });

  it("fine-tunes a keyboard placement inside the selected region", () => {
    const onPlace = vi.fn();
    render(
      <ClinicalBodyMapCanvas
        profile={profile}
        view="back"
        points={[]}
        demoPoints={[]}
        pending={{ x: 0.58333, y: 0.705, regionId: "back-left-calf" }}
        onPlace={onPlace}
      />,
    );

    const region = screen.getByTestId("region-back-left-calf") as unknown as SVGGraphicsElement;
    markAtlasReady();
    region.getBBox = () => ({
      x: 132,
      y: 268,
      width: 16,
      height: 28,
    }) as DOMRect;

    fireEvent.click(screen.getByRole("button", { name: "Сдвинуть метку вправо" }));

    expect(onPlace).toHaveBeenCalledWith({
      view: "back",
      regionId: "back-left-calf",
      regionLabel: "Задняя поверхность левой голени",
      x: 0.58833,
      y: 0.705,
    });
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
    markAtlasReady();
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
