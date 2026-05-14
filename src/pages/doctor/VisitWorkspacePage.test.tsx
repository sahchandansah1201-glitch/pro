import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  SELF_HOSTED_API_BASE_URL_KEY,
  SELF_HOSTED_API_TOKEN_KEY,
} from "@/lib/self-hosted-api-session";

// Stage 1I-A · Mock the api-session hook with a mutable container so the
// majority of tests keep the demo (null) session, while the auth smoke
// tests below can flip it to a doctor JWT before rendering.
const apiSessionMock = vi.hoisted(() => ({
  current: { apiToken: null as string | null, apiBaseUrl: null as string | null },
}));
vi.mock("@/lib/api-session", () => ({
  useApiSession: () => apiSessionMock.current,
}));

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
  const t = screen.getByRole("tab", { name: /body map/i });
  fireEvent.pointerDown(t, { button: 0 });
  fireEvent.mouseDown(t, { button: 0 });
  fireEvent.click(t);
}

describe("VisitWorkspacePage · Body map", () => {
  it("p-001/v-001 (female) shows 'Тип карты: Женщина', front surface label, badge and aria-label", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    fireEvent.click(screen.getByRole("button", { name: "Спереди" }));
    expect(screen.getByText(/Тип карты:\s*Женщина/)).toBeInTheDocument();
    expect(screen.getByText(/Передняя поверхность/)).toBeInTheDocument();
    const svg = screen.getByRole("img", { name: /Body map/ });
    expect(svg.getAttribute("aria-label")).toMatch(/Женщина/);
    expect(svg.getAttribute("aria-label")).toMatch(/Передняя поверхность/);
    expect(svg.textContent).toMatch(/ПЕРЕД/);
  });

  it("clicking 'Сзади' switches to back surface with hint and aria-label", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    fireEvent.click(screen.getByRole("button", { name: "Сзади" }));
    expect(screen.getByText(/Задняя поверхность/)).toBeInTheDocument();
    const hint = screen.getByText(/Ориентиры:/);
    expect(hint.textContent).toMatch(/лопатки/);
    expect(hint.textContent).toMatch(/позвоночник/);
    const svg = screen.getByRole("img", { name: /Body map/ });
    expect(svg.getAttribute("aria-label")).toMatch(/Задняя поверхность/);
    expect(svg.textContent).toMatch(/СПИНА/);
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
    expect(svg.getAttribute("aria-label")).toMatch(/Левая боковая поверхность/);
  });

  it("clicking SVG opens 'Новый очаг (демо)' panel with defaults; cancel hides it", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    expect(screen.getByText(/Новый очаг \(демо\)/)).toBeInTheDocument();
    const labelInput = screen.getByDisplayValue("Новый очаг") as HTMLInputElement;
    expect(labelInput).toBeInTheDocument();
    const statusSelect = screen.getByLabelText(/Статус демо-очага/) as HTMLSelectElement;
    expect(statusSelect.value).toBe("active");
    expect(screen.getByRole("button", { name: /Добавить локально/ })).toBeInTheDocument();
    const cancel = screen.getByRole("button", { name: /Отменить/ });
    fireEvent.click(cancel);
    expect(screen.queryByText(/Новый очаг \(демо\)/)).toBeNull();
  });

  it("does not contain forbidden tokens or placeholder text in DOM", () => {
    const { container } = renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    const html = container.innerHTML;
    for (const t of FORBIDDEN) expect(html).not.toMatch(new RegExp(t));
    expect(html.toLowerCase()).not.toMatch(/placeholder/);
  });
});

describe("VisitWorkspacePage · Body Map ↔ Imaging integration", () => {
  it("Body Map selected lesion shows 'Связанные снимки' panel for l-008", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /К снимкам этого очага/ })).toBeInTheDocument();
  });

  it("clicking 'К снимкам этого очага' switches to Imaging tab with lesion preselected", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(screen.getByText(/Захват/)).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    const lesionSelect = selects.find((s) => s.value === "l-008");
    expect(lesionSelect).toBeTruthy();
  });

  it("Imaging tab shows 'Открыть на Body Map' for selected linked image and returns to Body Map", () => {
    renderAt("/patients/p-004/visits/v-005?tab=imaging&lesion=l-008");
    const btn = screen.getByRole("button", { name: /Открыть на Body Map/ });
    fireEvent.click(btn);
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();
  });

  it("lesion list shows 'нет оценки' and 'нужен пересмотр' chips on v-005", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap");
    expect(screen.getAllByText(/нет оценки/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/нужен пересмотр/).length).toBeGreaterThan(0);
  });

  it("регрессия: round-trip Body Map → Imaging → Body Map сохраняет lesion и переключает таб", async () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");

    const bodymapTab = screen.getByRole("tab", { name: /body map/i });
    const imagingTab = screen.getByRole("tab", { name: /снимки/i });
    expect(bodymapTab.getAttribute("aria-selected")).toBe("true");
    expect(imagingTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();

    // Body Map → Imaging: таб переключился, lesion предвыбран.
    fireEvent.click(screen.getByRole("button", { name: /К снимкам этого очага/ }));
    expect(imagingTab.getAttribute("aria-selected")).toBe("true");
    expect(bodymapTab.getAttribute("aria-selected")).toBe("false");
    const lesionSelect = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "l-008",
    );
    expect(lesionSelect).toBeTruthy();

    // Imaging → Body Map: возврат с тем же lesion.
    fireEvent.click(screen.getByRole("button", { name: /Открыть на Body Map/ }));
    expect(bodymapTab.getAttribute("aria-selected")).toBe("true");
    expect(imagingTab.getAttribute("aria-selected")).toBe("false");
    expect(screen.getByText(/Связанные снимки/)).toBeInTheDocument();

    const lesion = (await import("@/lib/mock-data"))
      .getLesionsByPatientId("p-004")
      .find((l) => l.id === "l-008")!;
    expect(screen.getAllByText(new RegExp(lesion.label)).length).toBeGreaterThan(0);
  });
});

describe("VisitWorkspacePage · Local lesion draft workflow", () => {
  function placePoint() {
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
  }

  it("opens 'Новый очаг (демо)' panel with prefilled, editable zone and default label", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    placePoint();
    expect(screen.getByText(/Новый очаг \(демо\)/)).toBeInTheDocument();
    const labelInput = screen.getByDisplayValue("Новый очаг") as HTMLInputElement;
    expect(labelInput).toBeInTheDocument();
    // zone input is prefilled (non-empty) and editable
    const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
    const zoneCandidate = inputs.find((i) => i !== labelInput && i.tagName === "INPUT");
    expect(zoneCandidate).toBeTruthy();
    expect(zoneCandidate!.value.length).toBeGreaterThan(0);
    fireEvent.change(zoneCandidate!, { target: { value: "тестовая зона" } });
    expect(zoneCandidate!.value).toBe("тестовая зона");
  });

  it("status select defaults to 'Активное'", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    placePoint();
    const sel = screen.getByLabelText(/Статус демо-очага/) as HTMLSelectElement;
    const selectedOpt = Array.from(sel.options).find((o) => o.selected);
    expect(selectedOpt?.text).toBe("Активное");
  });

  it("'Добавить локально' adds the draft to the list with 'локально, не сохранено' label and detail panel text", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    placePoint();
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));
    expect(screen.queryByText(/Новый очаг \(демо\)/)).toBeNull();
    expect(screen.getByText(/Локальные демо-очаги/)).toBeInTheDocument();
    expect(screen.getAllByText(/локально, не сохранено/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Это демо-очаг\. Он существует только в UI текущего визита\./),
    ).toBeInTheDocument();
  });

  it("local draft detail does not render a /lesions/local-lesion link", () => {
    const { container } = renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    placePoint();
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));
    const links = container.querySelectorAll("a[href*='/lesions/local-lesion']");
    expect(links.length).toBe(0);
  });

  it("existing real lesion 'Открыть' link still works", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=l-008");
    const link = screen.getByRole("link", { name: /Открыть/ });
    expect(link.getAttribute("href")).toMatch(/\/patients\/p-004\/lesions\/l-008/);
  });

  it("does not mutate mock data: getLesionsByPatientId count is stable before/after add", async () => {
    const { getLesionsByPatientId } = await import("@/lib/mock-data");
    const before = getLesionsByPatientId("p-001").length;
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    placePoint();
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));
    const after = getLesionsByPatientId("p-001").length;
    expect(after).toBe(before);
  });
});

describe("VisitWorkspacePage · acceptance — URL params and isolation", () => {
  it("invalid ?tab fallbacks to Intake", () => {
    renderAt("/patients/p-001/visits/v-001?tab=not-a-tab");
    const intakeTab = screen.getByRole("tab", { name: /Интейк/ });
    expect(intakeTab.getAttribute("aria-selected")).toBe("true");
  });

  it("invalid ?lesion is safely ignored on Body Map (no crash, tab opens)", () => {
    renderAt("/patients/p-004/visits/v-005?tab=bodymap&lesion=does-not-exist");
    const tab = screen.getByRole("tab", { name: /body map/i });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    // map renders
    expect(screen.getByRole("img", { name: /Body map/ })).toBeInTheDocument();
  });

  it("invalid ?lesion is safely ignored on Imaging (filter falls back to 'all')", () => {
    renderAt("/patients/p-004/visits/v-005?tab=imaging&lesion=does-not-exist");
    const tab = screen.getByRole("tab", { name: /снимки/i });
    expect(tab.getAttribute("aria-selected")).toBe("true");
    const allFilter = (screen.getAllByRole("combobox") as HTMLSelectElement[]).find(
      (s) => s.value === "all",
    );
    expect(allFilter).toBeTruthy();
  });

  it("local draft does not leak into Assessment, Conclusion, or Report", () => {
    renderAt("/patients/p-001/visits/v-001?tab=bodymap");
    // create a draft on Body Map
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });
    fireEvent.click(screen.getByRole("button", { name: /Добавить локально/ }));
    expect(screen.getByText(/Локальные демо-очаги/)).toBeInTheDocument();

    // switch to other tabs — draft must not appear
    for (const tabName of [/Оценка/, /Заключение/, /Отчёт/]) {
      const tab = screen.getByRole("tab", { name: tabName });
      fireEvent.pointerDown(tab, { button: 0 });
      fireEvent.mouseDown(tab, { button: 0 });
      fireEvent.click(tab);
      expect(screen.queryByText(/локально, не сохранено/)).toBeNull();
      expect(screen.queryByText(/local-lesion-/)).toBeNull();
    }
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
      const apiTokens = [
        j("fetch", "\\("),
        j("ax", "ios"),
        j("XML", "Http", "Request"),
        j("send", "Beacon"),
        j("navigator", "\\.", "clipboard"),
        j("media", "Devices"),
        j("local", "Storage"),
        j("session", "Storage"),
        j("Date", "\\.", "now", "\\("),
      ];
      expect(src).not.toMatch(new RegExp(apiTokens.join("|")));
    }
  });
});

// Stage 1I-A · Authenticated API session smoke.
//
// Confirms that when useApiSession exposes a real JWT + base URL, the
// VisitImagingTab API panel leaves demo mode and hits the Stage 1E
// api-read endpoint with a Bearer header — without touching backend code.
describe("VisitWorkspacePage · Stage 1I-A · authenticated API session smoke", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    apiSessionMock.current = {
      apiToken: "doctor-jwt",
      apiBaseUrl: "https://abc.supabase.co",
    };
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    apiSessionMock.current = { apiToken: null, apiBaseUrl: null };
    vi.unstubAllGlobals();
  });

  it("propagates JWT/baseUrl to the API panel and calls api-read with Bearer header", async () => {
    renderAt("/patients/p-001/visits/v-001?tab=imaging");

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      "https://abc.supabase.co/functions/v1/api-read/doctor/visits/v-001/assets",
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer doctor-jwt");
    expect((init as RequestInit).method).toBe("GET");
  });

  it("API panel does not show the demo not-configured notice when authenticated", async () => {
    renderAt("/patients/p-001/visits/v-001?tab=imaging");

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    expect(
      within(region).queryByText(/API клинических ассетов не сконфигурирован/i),
    ).toBeNull();
  });
});

describe("VisitWorkspacePage · Stage 5F · production self-hosted cutover", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "local-jwt");
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads live patient, visit and lesions by UUID without demo patient lookup", async () => {
    const fetchMock = vi.fn((url: RequestInfo | URL, _init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/visits/live-visit")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              item: {
                id: "live-visit",
                clinicId: "clinic-1",
                patientId: "live-patient",
                doctorUserId: "doctor-1",
                status: "in_progress",
                startedAt: "2026-05-12T09:00:00.000Z",
                signedAt: null,
                chiefComplaint: "контроль live",
                createdAt: "2026-05-12T08:00:00.000Z",
                updatedAt: "2026-05-12T09:00:00.000Z",
                patient: { id: "live-patient", fullName: "Петрова Анна Live", code: "DP-live-001" },
                clinic: { id: "clinic-1", slug: "live", name: "Live Clinic" },
              },
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (href.endsWith("/api/v1/visits/live-visit/lesions")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              items: [
                {
                  id: "live-lesion",
                  patientId: "live-patient",
                  visitId: "live-visit",
                  label: "Live lesion A",
                  bodyZone: "спина",
                  status: "active",
                },
              ],
            }),
            { headers: { "Content-Type": "application/json" } },
          ),
        );
      }
      if (href.endsWith("/api/v1/visits/live-visit/assets")) {
        return Promise.resolve(
          new Response(JSON.stringify({ items: [] }), {
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response(JSON.stringify({ items: [] })));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderAt("/patients/live-patient/visits/live-visit?tab=bodymap");

    expect(await screen.findByRole("heading", { name: /Петрова Анна Live/ })).toBeInTheDocument();
    expect(screen.getByText(/Источник данных: self-hosted backend/)).toBeInTheDocument();
    expect((await screen.findAllByText(/Live lesion A/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Визит не найден/)).not.toBeInTheDocument();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    for (const [, init] of fetchMock.mock.calls.filter(([url]) => String(url).includes("/api/v1/"))) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: "Bearer local-jwt" });
    }
  });
});
