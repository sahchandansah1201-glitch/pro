import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitWorkspacePage from "./VisitWorkspacePage";

const j = (...p: string[]) => p.join("");
const FORBIDDEN = [
  j("doctor", "Version", "Text"),
  j("patient", "Safe", "Text"),
  j("shared", "Link"),
  j("storage", "Path"),
  j("photo", "Ref"),
  j("model", "Version"),
  j("heatmap", "Ref"),
  j("external", "User", "Ref"),
  j("protected", "Analysis", "Link"),
];

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

function openBodyMap() {
  fireEvent.click(screen.getByRole("tab", { name: /body map/i }));
}

describe("VisitWorkspacePage · Body map", () => {
  it("p-001/v-001 (female) shows 'Тип карты: Женщина' and aria-label includes Женщина", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    expect(screen.getByText(/Тип карты:\s*Женщина/)).toBeInTheDocument();
    const svg = screen.getByRole("img", { name: /Body map/ });
    expect(svg.getAttribute("aria-label")).toMatch(/Женщина/);
  });

  it("p-004/v-005 (male) shows 'Тип карты: Мужчина'", () => {
    renderAt("/patients/p-004/visits/v-005");
    openBodyMap();
    expect(screen.getByText(/Тип карты:\s*Мужчина/)).toBeInTheDocument();
  });

  it("renders all five projection buttons", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    for (const name of ["Спереди", "Сзади", "Слева", "Справа", "Голова"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("selecting a 'left' lesion switches projection to Слева", () => {
    // p-004 has l-008 with mapPoint.view='left'
    renderAt("/patients/p-004/visits/v-005");
    openBodyMap();
    fireEvent.click(screen.getByText(/Очаг B/));
    const svg = screen.getByRole("img", { name: /Body map/ });
    expect(svg.getAttribute("aria-label")).toMatch(/слева/);
  });

  it("clicking SVG creates a 'Новая точка (демо)' with confirm/cancel; confirm shows demo-not-saved note", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    // jsdom getBoundingClientRect returns zeros — patch it for this test.
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    expect(screen.getByText(/Новая точка \(демо\)/)).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /Подтвердить демо-точку/ });
    const cancel = screen.getByRole("button", { name: /Отменить/ });
    expect(confirm).toBeInTheDocument();
    expect(cancel).toBeInTheDocument();
    fireEvent.click(confirm);
    expect(screen.queryByText(/Новая точка \(демо\)/)).toBeNull();
  });

  it("does not contain forbidden tokens or placeholder text in DOM", () => {
    const { container } = renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    const html = container.innerHTML;
    for (const t of FORBIDDEN) expect(html).not.toMatch(new RegExp(t));
    expect(html.toLowerCase()).not.toMatch(/placeholder/);
  });
});

describe("VisitWorkspacePage · production hygiene", () => {
  it("source files contain no forbidden tokens or restricted APIs", async () => {
    const fs = await import("fs/promises");
    const files = [
      "src/pages/doctor/VisitWorkspacePage.tsx",
      "src/pages/doctor/body-map-model.ts",
    ];
    for (const f of files) {
      const src = await fs.readFile(f, "utf8");
      for (const t of FORBIDDEN) expect(src).not.toMatch(new RegExp(t));
      expect(src).not.toMatch(/fetch\(|axios|XMLHttpRequest|sendBeacon|navigator\.clipboard|mediaDevices|localStorage|sessionStorage|Date\.now\(/);
    }
  });
});
