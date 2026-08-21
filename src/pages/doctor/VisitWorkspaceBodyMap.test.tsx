import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
