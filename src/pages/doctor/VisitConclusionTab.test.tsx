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

describe("VisitConclusionTab · URL params", () => {
  it("opens Conclusion with context for ?lesion=l-008 (p-004/v-005)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    const tab = screen.getByRole("tab", { name: /Заключение/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("region", { name: /Контекст выбранного очага/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/висок левый/i).length).toBeGreaterThan(0);
  });

  it("invalid ?lesion=bad-id safely falls back without crashing", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=bad-id");
    const tab = screen.getByRole("tab", { name: /Заключение/ });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    expect(
      screen.getByRole("region", { name: /Контекст выбранного очага/ }),
    ).toBeInTheDocument();
  });

  it("?lesion=local-lesion-1 shows local notice and no /lesions/local-lesion-* link", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=local-lesion-1");
    expect(
      screen.getByText(/Локальный учебный очаг нужно сохранить в системе клиники перед заключением/),
    ).toBeInTheDocument();
    expect(document.querySelectorAll("a[href*='/lesions/local-lesion']").length).toBe(0);
  });
});

describe("VisitConclusionTab · checklist", () => {
  it("lists persisted lesions with assessed/not-assessed/needs-review chips", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion");
    const list = screen.getByRole("region", { name: /Чек-лист/ });
    expect(within(list).getByText(/Очаг B/)).toBeInTheDocument();
    expect(within(list).getAllByText(/оценка готова/).length).toBeGreaterThan(0);
    expect(within(list).getAllByText(/нет оценки/).length).toBeGreaterThan(0);
    expect(within(list).getAllByText(/нужен пересмотр снимков/).length).toBeGreaterThan(0);
    // No local drafts
    expect(within(list).queryByText(/local-lesion-/)).toBeNull();
  });
});

describe("VisitConclusionTab · selected lesion details", () => {
  it("l-008 (assessed) shows ABCD/7-point totals and CTAs to assessment/imaging", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    const panel = screen.getByRole("region", { name: /Контекст выбранного очага/ });
    expect(within(panel).getByText(/Итог ABCD/)).toBeInTheDocument();
    expect(within(panel).getByText(/Итог по семи признакам/)).toBeInTheDocument();
    expect(within(panel).getByText("9.0")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /К оценке очага/ })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: /К снимкам очага/ })).toBeInTheDocument();
  });

  it("l-007 (no assessment) shows warning and CTA 'Перейти к оценке'", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-007");
    expect(
      screen.getByText(/Перед заключением нужна структурированная оценка очага/),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Перейти к оценке/ })).toBeInTheDocument();
  });

  it("CTA 'К оценке очага' navigates to ?tab=assessment&lesion=l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К оценке очага/ }));
    const aTab = screen.getByRole("tab", { name: /Оценка/ });
    expect(aTab.getAttribute("aria-selected")).toBe("true");
  });

  it("CTA 'К снимкам очага' navigates to ?tab=imaging&lesion=l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам очага/ }));
    const iTab = screen.getByRole("tab", { name: /снимки/i });
    expect(iTab.getAttribute("aria-selected")).toBe("true");
  });

  it("CTA 'К отчёту по визиту' navigates to ?tab=report&lesion=l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(
      screen.getAllByRole("button", { name: /К отчёту по визиту/ })[0],
    );
    const rTab = screen.getByRole("tab", { name: /Отчёт/ });
    expect(rTab.getAttribute("aria-selected")).toBe("true");
  });
});

describe("VisitConclusionTab · learning conclusion form", () => {
  it("'Сохранить учебное заключение' shows local preview and does not mutate mock data", async () => {
    const { getAssessmentsByVisitId } = await import("@/lib/mock-data");
    const beforeA = getAssessmentsByVisitId("v-005").length;

    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.change(screen.getByLabelText(/Клиническое резюме/), {
      target: { value: "Внутренние детали для врача." },
    });
    fireEvent.change(screen.getByLabelText(/Комментарий для пациента/), {
      target: { value: "Рекомендована очная консультация." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить учебное заключение/ }));

    const preview = screen.getByTestId("demo-conclusion-preview");
    expect(preview.textContent).toMatch(/Учебное заключение создано локально/);

    const afterA = getAssessmentsByVisitId("v-005").length;
    expect(afterA).toBe(beforeA);
  });

  it("patient-facing preview only contains the plain-language patient comment", () => {
    renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.change(screen.getByLabelText(/Клиническое резюме/), {
      target: { value: "ABCD высокий, биопсия 10 дней." },
    });
    fireEvent.change(screen.getByLabelText(/Комментарий для пациента/), {
      target: { value: "Рекомендована очная консультация." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить учебное заключение/ }));

    const patient = screen.getByTestId("patient-facing-preview");
    expect(patient.textContent).toMatch(/Рекомендована очная консультация/);
    // must NOT contain internal fields, tokens, paths
    expect(patient.textContent).not.toMatch(/ABCD/);
    expect(patient.textContent).not.toMatch(/tok-/);
    expect(patient.textContent).not.toMatch(/mock:\/\//);
    expect(patient.textContent).not.toMatch(/biopsy|биопси/i);
  });
});
