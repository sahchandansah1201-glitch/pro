import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
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

const reportTabSelected = () => {
  const tab = screen.getByRole("tab", { name: /Отчёт/ });
  expect(tab.getAttribute("aria-selected")).toBe("true");
};

const selectedRegion = () =>
  screen.getByRole("region", { name: /Контекст выбранного очага/ });

const localNotice = () =>
  screen.queryByText(/Локальный учебный очаг нужно сохранить в системе клиники перед отчётом/);

const j = (...p: string[]) => p.join("");
const FORBIDDEN_TOKENS = [
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

// p-004 / v-005 mock state recap:
//   lesions(p-004) = [l-007 (no assessment), l-008 (assessed in v-005)]
//   first assessed in visit = l-008
//   first persisted (lesions[0]) = l-007

describe("VisitReportTab · lesion fallback (p-004/v-005)", () => {
  it("no ?lesion param → uses first ASSESSED lesion (l-008)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report");
    reportTabSelected();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
    expect(localNotice()).toBeNull();
  });

  it("empty ?lesion= → first ASSESSED lesion (l-008)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=");
    reportTabSelected();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
    expect(localNotice()).toBeNull();
  });

  it("?lesion=bad-id → falls back to first ASSESSED lesion (l-008)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=bad-id");
    reportTabSelected();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
    expect(localNotice()).toBeNull();
  });

  it("?lesion belongs to another patient (l-009 of p-005) → falls back to l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-009");
    reportTabSelected();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
    expect(localNotice()).toBeNull();
  });

  it("?lesion=l-007 (persisted, unassessed) → respects valid id, shows warning + Перейти к оценке", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-007");
    reportTabSelected();
    const region = selectedRegion();
    expect(within(region).getByText(/голень правая/i)).toBeInTheDocument();
    // No assessment → readiness warning + CTA "Перейти к оценке"
    expect(
      within(region).getByText(/Перед отчётом нужна структурированная оценка очага/),
    ).toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: /Перейти к оценке/ }),
    ).toBeInTheDocument();
    expect(localNotice()).toBeNull();
  });

  it("?lesion=l-008 (valid, assessed) → keeps requested lesion and shows assessment CTAs", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    reportTabSelected();
    const region = selectedRegion();
    expect(within(region).getByText(/висок левый/i)).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /К оценке очага/ })).toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: /К заключению по визиту/ }),
    ).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /К снимкам очага/ })).toBeInTheDocument();
  });

  it("does not throw and falls back when ?lesion is whitespace", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=%20%20");
    reportTabSelected();
    // Whitespace is treated as a non-matching id → falls back to first assessed (l-008)
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
  });
});

describe("VisitReportTab · local-lesion-* fallback", () => {
  it("?lesion=local-lesion-1 → shows local-draft notice and falls back to persisted lesion (l-008)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=local-lesion-1");
    reportTabSelected();
    expect(localNotice()).toBeInTheDocument();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
    // No link/anchor leaks the local draft id
    expect(document.querySelectorAll("a[href*='/lesions/local-lesion']").length).toBe(0);
    // No forbidden token leaks anywhere on the page
    const html = document.body.innerHTML;
    for (const token of FORBIDDEN_TOKENS) {
      expect(html.includes(token)).toBe(false);
    }
  });

  it("?lesion=local-lesion-9999 (extreme suffix) → still shows notice and falls back safely", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=local-lesion-9999");
    reportTabSelected();
    expect(localNotice()).toBeInTheDocument();
    expect(within(selectedRegion()).getByText(/висок левый/i)).toBeInTheDocument();
  });

  it("local-lesion id never appears as a string on the page", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=local-lesion-42");
    reportTabSelected();
    expect(screen.queryByText(/local-lesion-42/)).toBeNull();
  });
});

describe("VisitReportTab · fallback for visits with existing assessments (v-001 of p-001)", () => {
  it("no ?lesion param → falls back to first ASSESSED lesion of the visit", () => {
    renderAt("/patients/p-001/visits/v-001?tab=report");
    reportTabSelected();
    const region = selectedRegion();
    // Assessed fallback → assessment CTAs are present
    expect(within(region).getByRole("button", { name: /К оценке очага/ })).toBeInTheDocument();
    expect(within(region).getByRole("button", { name: /К снимкам очага/ })).toBeInTheDocument();
    expect(
      within(region).queryByText(/Перед отчётом нужна структурированная оценка очага/),
    ).toBeNull();
  });

  it("?lesion=bad-id → also falls back to first ASSESSED lesion (no crash)", () => {
    renderAt("/patients/p-001/visits/v-001?tab=report&lesion=bad-id");
    reportTabSelected();
    expect(
      within(selectedRegion()).getByRole("button", { name: /К оценке очага/ }),
    ).toBeInTheDocument();
  });
});
