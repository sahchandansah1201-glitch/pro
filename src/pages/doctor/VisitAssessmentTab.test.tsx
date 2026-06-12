import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import VisitWorkspacePage from "./VisitWorkspacePage";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
        <Route path="*" element={<div>fallback</div>} />
      </Routes>
    </MemoryRouter>,
  );

describe("VisitAssessmentTab · URL params", () => {
  it("opens Assessment with context for ?lesion=l-008 (p-004/v-005)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    const tab = screen.getByRole("tab", { name: /Оценка/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Контекст выбранного очага/)).toBeInTheDocument();
    expect(screen.getAllByText(/висок левый/i).length).toBeGreaterThan(0);
  });

  it("invalid ?lesion=bad-id falls back to first persisted lesion without crashing", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=does-not-exist");
    const tab = screen.getByRole("tab", { name: /Оценка/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText(/Контекст выбранного очага/)).toBeInTheDocument();
  });

  it("local-lesion-* id shows read-only notice and does NOT treat draft as a real lesion", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=local-lesion-1");
    expect(
      screen.getByText(/Локальный учебный очаг нужно сохранить в системе клиники перед оценкой/),
    ).toBeInTheDocument();
    // No /lesions/local-lesion link
    expect(document.querySelectorAll("a[href*='/lesions/local-lesion']").length).toBe(0);
  });
});

describe("VisitAssessmentTab · linked images and quality", () => {
  it("shows image count and quality summary for l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    const q = screen.getByTestId("quality-summary");
    expect(q.textContent).toMatch(/нужна проверка/);
    // image count > 0
    expect(screen.getAllByText(/Снимков всего/).length).toBeGreaterThan(0);
  });
});

describe("VisitAssessmentTab · local training form for lesion without assessment", () => {
  it("shows training form for l-007 (no assessment in v-005)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-007");
    expect(screen.getByText(/Локальная учебная оценка/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Итог ABCD/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Итог по семи признакам/)).toBeInTheDocument();
    expect(screen.getByLabelText(/План наблюдения/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Комментарий врача/)).toBeInTheDocument();
  });

  it("'Сохранить учебную оценку' shows local preview and does not change getAssessmentsByVisitId", async () => {
    const { getAssessmentsByVisitId } = await import("@/lib/mock-data");
    const before = getAssessmentsByVisitId("v-005").length;

    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-007");
    fireEvent.change(screen.getByLabelText(/Итог ABCD/), { target: { value: "4.8" } });
    fireEvent.change(screen.getByLabelText(/Итог по семи признакам/), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить учебную оценку/ }));

    const preview = screen.getByTestId("demo-assessment-preview");
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toMatch(/Учебная оценка создана локально/);
    expect(preview.textContent).toMatch(/4\.8/);

    const after = getAssessmentsByVisitId("v-005").length;
    expect(after).toBe(before);
  });
});

describe("VisitAssessmentTab · existing assessment + CTAs", () => {
  it("l-008 shows existing assessment summary and both CTAs", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    expect(screen.getAllByText(/Итог/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /К снимкам этого очага/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /К заключению по визиту/ })).toBeInTheDocument();
  });

  it("CTA 'К снимкам этого очага' navigates to ?tab=imaging&lesion=l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    const imagingTab = screen.getByRole("tab", { name: /снимки/i });
    expect(imagingTab.getAttribute("aria-selected")).toBe("true");
    const lesionSelect = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "l-008",
    );
    expect(lesionSelect).toBeTruthy();
  });

  it("CTA 'К заключению по визиту' navigates to ?tab=conclusion&lesion=l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К заключению по визиту/ }));
    const concTab = screen.getByRole("tab", { name: /Заключение/ });
    expect(concTab.getAttribute("aria-selected")).toBe("true");
  });
});

describe("VisitAssessmentTab · Body Map draft does not leak", () => {
  it("draft created on Body Map is not selectable as a real lesion in Assessment", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap");
    const svg = screen.getByRole("img", { name: /Карта тела/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));

    const tab = screen.getByRole("tab", { name: /Оценка/ });
    fireEvent.pointerDown(tab, { button: 0 });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);

    // Draft must NOT be present in lesion navigator
    const navAside = screen.getByText(/Образования пациента/).closest("section")!;
    expect(within(navAside).queryByText(/local-lesion-/)).toBeNull();
    expect(within(navAside).queryByText(/локально, не сохранено/)).toBeNull();
  });
});
