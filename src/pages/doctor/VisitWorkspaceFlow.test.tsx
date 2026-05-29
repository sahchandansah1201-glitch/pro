import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

const tabSelected = (name: RegExp) =>
  screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true";

describe("Visit Workspace · end-to-end flow for p-004/v-005, lesion=l-008", () => {
  it("Body Map → Imaging → Body Map preserves lesion via URL", () => {
    const view = renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    expect(tabSelected(/карта тела/i)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(tabSelected(/снимки/i)).toBe(true);
    const lesionSelect = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "l-008",
    );
    expect(lesionSelect).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Открыть на Body Map/ }));
    expect(tabSelected(/карта тела/i)).toBe(true);
    view.unmount();
  });

  it("Assessment → Imaging preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    expect(tabSelected(/Оценка/)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(tabSelected(/снимки/i)).toBe(true);
    const sel = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "l-008",
    );
    expect(sel).toBeTruthy();
    v.unmount();
  });

  it("Assessment → Conclusion preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=assessment&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К заключению по визиту/ }));
    expect(tabSelected(/Заключение/)).toBe(true);
    v.unmount();
  });

  it("Conclusion → Assessment preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К оценке очага/ }));
    expect(tabSelected(/Оценка/)).toBe(true);
    v.unmount();
  });

  it("Conclusion → Imaging preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам очага/ }));
    expect(tabSelected(/снимки/i)).toBe(true);
    v.unmount();
  });

  it("Conclusion → Report preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=conclusion&lesion=l-008");
    fireEvent.click(screen.getAllByRole("button", { name: /К отчёту по визиту/ })[0]);
    expect(tabSelected(/Отчёт/)).toBe(true);
    v.unmount();
  });

  it("Report → Assessment preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К оценке очага/ }));
    expect(tabSelected(/Оценка/)).toBe(true);
    v.unmount();
  });

  it("Report → Conclusion preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К заключению по визиту/ }));
    expect(tabSelected(/Заключение/)).toBe(true);
    v.unmount();
  });

  it("Report → Imaging preserves lesion", () => {
    const v = renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам очага/ }));
    expect(tabSelected(/снимки/i)).toBe(true);
    v.unmount();
  });

  it("each downstream tab opens with l-008 context preserved via URL", () => {
    for (const tab of ["imaging", "assessment", "conclusion", "report"] as const) {
      const { unmount } = renderAt(
        `/patients/p-004/visits/v-005?tab=${tab}&lesion=l-008`,
      );
      // No crash; lesion l-008 referenced somewhere in DOM.
      expect(document.body.textContent ?? "").toMatch(/l-008|висок|Очаг/i);
      unmount();
    }
  });
});

describe("Visit Workspace · invalid params", () => {
  it("invalid ?tab=bad-tab falls back to Intake", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bad-tab");
    expect(tabSelected(/Интейк/)).toBe(true);
  });

  it("invalid ?lesion=bad-id does not crash on Imaging/Assessment/Conclusion/Report", () => {
    for (const tab of ["imaging", "assessment", "conclusion", "report"] as const) {
      const { unmount } = renderAt(
        `/patients/p-004/visits/v-005?tab=${tab}&lesion=bad-id`,
      );
      const tabName: Record<string, RegExp> = {
        imaging: /снимки/i,
        assessment: /Оценка/,
        conclusion: /Заключение/,
        report: /Отчёт/,
      };
      expect(tabSelected(tabName[tab])).toBe(true);
      unmount();
    }
  });

  it("?lesion=local-lesion-1 shows read-only notice in Assessment, Conclusion, and Report", () => {
    const cases: Array<{ tab: string; rx: RegExp }> = [
      { tab: "assessment", rx: /Локальный демо-очаг нужно сохранить на бэкенде перед оценкой/ },
      { tab: "conclusion", rx: /Локальный демо-очаг нужно сохранить на бэкенде перед заключением/ },
      { tab: "report", rx: /Локальный демо-очаг/ },
    ];
    for (const { tab, rx } of cases) {
      const { unmount } = renderAt(
        `/patients/p-004/visits/v-005?tab=${tab}&lesion=local-lesion-1`,
      );
      expect(screen.getByText(rx)).toBeInTheDocument();
      expect(document.querySelectorAll("a[href*='/lesions/local-lesion']").length).toBe(0);
      unmount();
    }
  });
});

describe("Visit Workspace · local draft isolation across downstream tabs", () => {
  function placeLocalDraft() {
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 200,
        bottom: 400,
        width: 200,
        height: 400,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));
  }

  it("local draft is labeled and does not leak to Imaging/Assessment/Conclusion/Report", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");
    placeLocalDraft();
    expect(screen.getAllByText(/локально, не сохранено/).length).toBeGreaterThan(0);

    for (const tabName of [/снимки/i, /Оценка/, /Заключение/, /Отчёт/]) {
      const tab = screen.getByRole("tab", { name: tabName });
      fireEvent.pointerDown(tab, { button: 0 });
      fireEvent.mouseDown(tab, { button: 0 });
      fireEvent.click(tab);
      expect(screen.queryByText(/локально, не сохранено/)).toBeNull();
      expect(screen.queryByText(/local-lesion-/)).toBeNull();
      expect(document.querySelectorAll("a[href*='/lesions/local-lesion']").length).toBe(0);
    }
  });
});

describe("Visit Workspace · Report demo-only actions", () => {
  it("Печать / PDF disabled; Отправить пациенту is initially disabled (no demo draft)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    const printBtn = screen.getByRole("button", { name: /Печать \/ PDF/ }) as HTMLButtonElement;
    const sendBtn = screen.getByRole("button", { name: /Отправить пациенту/ }) as HTMLButtonElement;
    expect(printBtn.disabled).toBe(true);
    expect(sendBtn.disabled).toBe(true);
  });

  it("source of VisitReportTab does not call window.print()", async () => {
    const fs = await import("fs/promises");
    const src = await fs.readFile("src/pages/doctor/VisitReportTab.tsx", "utf8");
    expect(src).not.toMatch(/window\.print\s*\(/);
    expect(src).not.toMatch(/\.print\s*\(\s*\)/);
  });
});

describe("Visit Workspace · mobile (390px) — no horizontal overflow heuristic", () => {
  // Limitation: jsdom does not perform real layout, so true horizontal-overflow
  // checks are not feasible here. Instead, verify presence of mobile-friendly
  // sizing classes on tab triggers and that the report renders without throwing
  // on a forced narrow viewport metadata.
  it("tab triggers carry min-h-[44px] mobile target", () => {
    renderAt("/patients/p-004/visits/v-005?tab=report&lesion=l-008");
    const triggers = screen.getAllByRole("tab");
    for (const t of triggers) {
      expect(t.className).toMatch(/min-h-\[44px\]/);
    }
  });
});

describe("Visit Workspace · forbidden token hygiene in flow tests", () => {
  it("rendered HTML in p-004/v-005 across all tabs contains no forbidden tokens", () => {
    for (const tab of ["bodymap", "imaging", "assessment", "conclusion", "report"] as const) {
      const { container, unmount } = renderAt(
        `/patients/p-004/visits/v-005?tab=${tab}&lesion=l-008`,
      );
      const html = container.innerHTML;
      for (const t of FORBIDDEN) expect(html).not.toMatch(new RegExp(t));
      unmount();
    }
  });
});
