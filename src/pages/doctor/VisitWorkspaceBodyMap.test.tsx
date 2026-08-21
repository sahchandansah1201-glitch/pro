import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import VisitWorkspacePage from "./VisitWorkspacePage";

const FORBIDDEN = [
  "doctorВерсияText",
  "patientSafeText",
  "sharedLink",
  "storagePath",
  "photoRef",
  "modelВерсия",
  "heatmapRef",
  "externalUserRef",
  "protectedАнализLink",
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

function openBodyMap() {
  const tab = screen.getByRole("tab", { name: /карта тела/i });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

describe("VisitWorkspacePage · Карта тела", () => {
  it("shows the adult female profile, surface label, badge and aria-label", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    fireEvent.click(screen.getByRole("button", { name: "Спереди" }));
    expect(screen.getByRole("tab", { name: /Карта тела/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Профиль карты:\s*Женщина · 18–64 года/)).toBeInTheDocument();
    expect(screen.getByText("Передняя поверхность", { selector: "span" })).toBeInTheDocument();
    const svg = screen.getByRole("img", { name: /Карта тела/ });
    expect(screen.getByTestId("clinical-body-atlas")).toHaveAttribute("data-age-band", "adult");
    expect(screen.getByTestId("clinical-body-atlas")).toHaveAttribute("data-sex", "female");
    expect(svg.getAttribute("aria-label")).toMatch(/Женщина.+Передняя поверхность/);
    expect(svg.textContent).toMatch(/ПЕРЕД/);
  });

  it("switches to the back surface with native Russian guidance", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    fireEvent.click(screen.getByRole("button", { name: "Сзади" }));
    expect(screen.getByText("Задняя поверхность", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText(/Ориентиры:/).textContent).toMatch(/лопатки.+позвоночник/);
    const svg = screen.getByRole("img", { name: /Карта тела/ });
    expect(svg.getAttribute("aria-label")).toMatch(/Задняя поверхность/);
    expect(svg.textContent).toMatch(/СПИНА/);
  });

  it("selects the age-specific male profile and exposes all projections", () => {
    renderAt("/patients/p-004/visits/v-005");
    openBodyMap();
    expect(screen.getByText(/Профиль карты:\s*Мужчина · 18–64 года/)).toBeInTheDocument();
    for (const name of ["Спереди", "Сзади", "Слева", "Справа", "Голова"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("switches to the lesion projection and keeps the marker coordinates", () => {
    renderAt("/patients/p-004/visits/v-005");
    openBodyMap();
    fireEvent.click(screen.getByText(/Очаг B/));
    const svg = screen.getByRole("img", { name: /Карта тела/ });
    expect(svg.getAttribute("aria-label")).toMatch(/Левая боковая поверхность/);
    const marker = svg.querySelector("[data-marker-id='l-008'] circle");
    expect(Number(marker?.getAttribute("cx"))).toBeCloseTo(100.8);
    expect(Number(marker?.getAttribute("cy"))).toBeCloseTo(56);
  });

  it("fails closed on the background and opens a draft only for a named region", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    expect(screen.queryByText(/Новый учебный очаг/)).toBeNull();
    fireEvent.click(screen.getByTestId("region-back-lumbar-spine"), { clientX: 100, clientY: 172 });
    expect(screen.getByText(/Новый учебный очаг/)).toBeInTheDocument();
    expect((screen.getByLabelText(/Статус учебного очага/) as HTMLSelectElement).value).toBe("active");
    expect(screen.getByRole("button", { name: /Добавить локально/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Отменить/ }));
    expect(screen.queryByText(/Новый учебный очаг/)).toBeNull();
  });

  it("does not expose internal tokens or placeholder text", () => {
    const { container } = renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    for (const token of FORBIDDEN) expect(container.innerHTML).not.toContain(token);
    expect(container.innerHTML.toLowerCase()).not.toContain("placeholder");
  });

  it("lets a doctor inspect a high-resolution model at native-safe 800%", () => {
    vi.stubEnv("VITE_CLINICAL_BODY_ATLAS_SOURCE", "daz-hires-local");
    renderAt("/patients/p-001/visits/v-001?tab=bodymap");

    const zoomIn = screen.getByRole("button", { name: "Увеличить карту тела" });
    for (let step = 0; step < 6; step += 1) fireEvent.click(zoomIn);

    expect(screen.getByText("800%", { selector: "span" })).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
    expect(screen.getByText(/Исходник 2880×4320/)).toBeInTheDocument();
    expect(screen.getByTestId("body-map-zoom-surface")).toHaveStyle({ width: "2560px" });
  });

  it("lets the doctor refine a toe placement to the right little toe", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap");
    fireEvent.click(screen.getByRole("button", { name: "Спереди" }));

    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 240, bottom: 400, width: 240, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(screen.getByTestId("region-front-right-toes"), {
      clientX: 88,
      clientY: 314,
    });

    fireEvent.change(screen.getByLabelText("Уточнить палец стопы"), {
      target: { value: "digit-5" },
    });
    expect(screen.getByLabelText("Анатомическая область")).toHaveValue(
      "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
    );

    fireEvent.click(screen.getByRole("button", { name: "Добавить локально" }));
    expect(document.querySelector('[data-body-region-id="front-right-toes"]')).toHaveTextContent(
      "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
    );
  });

  it("stores two coordinate-distinct local lesions on the same hand", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap");
    fireEvent.click(screen.getByRole("button", { name: "Спереди" }));

    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 240, bottom: 400, width: 240, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const palm = screen.getByTestId("region-front-right-palm");

    fireEvent.click(palm, { clientX: 19.2, clientY: 186.4 });
    fireEvent.click(screen.getByRole("button", { name: "Добавить локально" }));
    fireEvent.click(palm, { clientX: 21.6, clientY: 190.8 });
    fireEvent.click(screen.getByRole("button", { name: "Добавить локально" }));

    expect(screen.getByText("Локальные учебные очаги (2)")).toBeInTheDocument();
    const first = document.querySelector('[data-local-marker-id="local-lesion-1"]');
    const second = document.querySelector('[data-local-marker-id="local-lesion-2"]');
    expect(first).toBeInTheDocument();
    expect(second).toBeInTheDocument();
    expect(first?.getAttribute("transform")).not.toBe(second?.getAttribute("transform"));
  });
});
