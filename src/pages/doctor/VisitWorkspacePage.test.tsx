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
  const t = screen.getByRole("tab", { name: /карта тела/i });
  fireEvent.pointerDown(t, { button: 0 });
  fireEvent.mouseDown(t, { button: 0 });
  fireEvent.click(t);
}

function selectTab(name: RegExp) {
  const tab = screen.getByRole("tab", { name });
  fireEvent.pointerDown(tab, { button: 0 });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

describe("VisitWorkspacePage · Body map", () => {
  it("p-001/v-001 (female) shows 'Тип карты: Женщина', front surface label, badge and aria-label", () => {
    renderAt("/patients/p-001/visits/v-001");
    openBodyMap();
    fireEvent.click(screen.getByRole("button", { name: "Спереди" }));
    expect(screen.getByRole("tab", { name: /Карта тела/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/Полная карта тела/)).toBeInTheDocument();
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

    const bodymapTab = screen.getByRole("tab", { name: /карта тела/i });
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
    const tab = screen.getByRole("tab", { name: /карта тела/i });
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

function createLiveWorkspaceFetchMock() {
  return vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
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
    if (href.endsWith("/api/v1/visits/live-visit/assessment")) {
      const method = (init?.method ?? "GET").toUpperCase();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "live-assessment",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: method === "PATCH" ? "ready" : "draft",
              riskLevel: "moderate",
              abcdTotal: 3.4,
              sevenPointTotal: 2,
              summary: method === "PATCH" ? "Live assessment saved" : "Live assessment summary",
              recommendation: "Live recommendation",
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/conclusion")) {
      const method = (init?.method ?? "GET").toUpperCase();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "live-conclusion",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: method === "PATCH" ? "ready" : "draft",
              summary: method === "PATCH" ? "Live conclusion saved" : "Live conclusion summary",
              nextStep: "Контроль",
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/report")) {
      const method = (init?.method ?? "GET").toUpperCase();
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "live-report",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: method === "PATCH" ? "signed" : "draft",
              physicianText: method === "PATCH" ? "Live report saved" : "Live report physician text",
              patientSafeText: "Live report patient text",
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/report-package")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              visitId: "live-visit",
              visitStatus: "signed",
              assessment: {
                status: "ready",
                riskLevel: "moderate",
                abcdTotal: 3.4,
                sevenPointTotal: 2,
                summaryPresent: true,
                recommendationPresent: true,
              },
              conclusion: {
                status: "signed",
                summaryPresent: true,
                nextStepPresent: true,
              },
              report: {
                status: "signed",
                physicianTextPresent: true,
                patientSafeTextPresent: true,
                signedAt: "2026-05-21T10:00:00.000Z",
              },
              counts: { lesions: 1, assets: 0 },
              readiness: {
                ready: true,
                status: "ready",
                completionPercent: 100,
                missing: [],
                exportAllowed: true,
                patientDeliveryAllowed: true,
              },
              patientPhotoProtocol: {
                brainstormTask: "SD-MF-046",
                status: "metadata_ready_backend_blocked",
                readyForBackendContract: true,
                selectedPhotoCount: 2,
                counts: {
                  selectedPhotos: 2,
                  overviewPhotos: 1,
                  dermoscopyPhotos: 1,
                  reportAttachments: 0,
                },
                missing: ["self_hosted_photo_delivery_contract_missing"],
                deliveryBoundary: {
                  patientDeliveryAllowed: false,
                  rawFilesExposed: false,
                  signedUrlsIssued: false,
                  storagePathsExposed: false,
                  tokensExposed: false,
                  physicianTextExposed: false,
                  fileProxyReady: false,
                  requiresSelfHostedFileProxy: true,
                  requiresReleaseAudit: true,
                  requiresRevoke: true,
                  requiresIdentityCheck: true,
                  requiresRetentionPolicy: true,
                  requiresApprovedPatientCopy: true,
                },
                policy: {
                  releasePrepared: true,
                  patientFileProxyEnabled: false,
                  patientCopyApproved: false,
                  retentionPolicyApproved: false,
                  expiresAt: "2026-06-20T10:00:00.000Z",
                },
              },
              productBoundary: {
                managedRuntimeDependency: "none",
                managedDatabaseDependency: "none",
                externalRuntimeCalls: false,
                rawPatientDataInReport: false,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/patient-photo-protocol-release/audit")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              releaseId: "release-live-1",
              visitId: "live-visit",
              status: "revoked",
              summary: {
                eventCount: 3,
                preparedEvents: 1,
                revokedEvents: 1,
                patientReadEvents: 0,
                proxyDownloadEvents: 1,
                proxyDeniedEvents: 0,
              },
              events: [
                {
                  kind: "release_prepared",
                  label: "Подготовка выдачи",
                  occurredAt: "2026-05-31T09:30:00.000Z",
                  actorType: "staff",
                  reasonPresent: false,
                },
                {
                  kind: "release_revoked",
                  label: "Отзыв выдачи",
                  occurredAt: "2026-05-31T09:35:00.000Z",
                  actorType: "staff",
                  reasonPresent: true,
                  revokeReason: "SENSITIVE_INTERNAL_REASON",
                  actorUserId: "SENSITIVE_ACTOR_ID",
                  correlationId: "SENSITIVE_CORRELATION_ID",
                },
                {
                  kind: "proxy_download",
                  label: "Открытие фото пациентом",
                  occurredAt: "2026-05-31T09:40:00.000Z",
                  actorType: "patient",
                  reasonPresent: false,
                  rawPayload: { unsafe: "SENSITIVE_RAW_PAYLOAD" },
                },
              ],
              boundaries: {
                immutableLedger: true,
                rawPayloadExposed: false,
                revokeReasonExposed: false,
                actorIdsExposed: false,
                correlationIdsExposed: false,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/patient-photo-protocol-release/policy")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "release-live-1",
              status: "prepared",
              deliveryBoundary: {
                patientDeliveryAllowed: false,
                fileProxyReady: true,
                requiresSelfHostedFileProxy: false,
                requiresRetentionPolicy: false,
                requiresApprovedPatientCopy: false,
              },
              policy: {
                patientFileProxyEnabled: true,
                patientCopyApproved: true,
                retentionPolicyApproved: true,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "POST" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "review_required",
              reasons: ["timeline_dataset_not_ready"],
              validationStatus: "blocked",
              lesionCount: 2,
              readyTimelineCount: 1,
              needsReviewTimelineCount: 0,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-04T00:00:00.000Z",
              createdAt: "2026-06-04T00:00:00.000Z",
              updatedAt: "2026-06-04T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/sop")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-sop-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_sop_not_ready"],
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              datasetValidationStatus: "needs_review",
              reviewerOperationsStatus: "needs_review",
              rollbackPlanStatus: "needs_review",
              monitoringPlanStatus: "needs_review",
              rolloutWindowStatus: "needs_review",
              ownerAckStatus: "needs_review",
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-04T00:00:00.000Z",
              createdAt: "2026-06-04T00:00:00.000Z",
              updatedAt: "2026-06-04T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/evidence")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-evidence-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_evidence_not_ready"],
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              monitoringEvidenceStatus: "needs_review",
              sampleAuditStatus: "needs_review",
              exceptionLogStatus: "needs_review",
              rollbackDrillStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              monitoringWindowDays: 0,
              sampledTimelineCount: 0,
              exceptionCount: 0,
              rollbackDrillCount: 0,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-04T00:00:00.000Z",
              createdAt: "2026-06-04T00:00:00.000Z",
              updatedAt: "2026-06-04T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/monitoring")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-monitoring-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_monitoring_not_ready"],
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              outcomeSamplingStatus: "needs_review",
              incidentReviewStatus: "needs_review",
              exceptionClosureStatus: "needs_review",
              rollbackOutcomeStatus: "needs_review",
              ownerFinalReviewStatus: "needs_review",
              monitoringWindowDays: 0,
              monitoredTimelineCount: 0,
              sampledTimelineCount: 0,
              incidentCount: 0,
              unresolvedIncidentCount: 0,
              closedExceptionCount: 0,
              rollbackExecutionCount: 0,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-04T00:00:00.000Z",
              createdAt: "2026-06-04T00:00:00.000Z",
              updatedAt: "2026-06-04T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/incident-procedure")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-incident-procedure-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_incident_procedure_not_ready"],
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              realDatasetStatus: "needs_review",
              outcomeSamplingProcedureStatus: "needs_review",
              incidentTriageStatus: "needs_review",
              escalationPathStatus: "needs_review",
              rollbackDecisionStatus: "needs_review",
              ownerReviewStatus: "needs_review",
              realDatasetTimelineCount: 0,
              monitoredTimelineCount: 0,
              sampledOutcomeCount: 0,
              incidentCaseCount: 0,
              unresolvedIncidentCount: 0,
              escalatedIncidentCount: 0,
              rollbackDecisionCount: 0,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-05T00:00:00.000Z",
              createdAt: "2026-06-05T00:00:00.000Z",
              updatedAt: "2026-06-05T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/clinical-validation")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-clinical-validation-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_clinical_validation_not_ready"],
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              realDatasetLockStatus: "needs_review",
              validatorTrainingStatus: "needs_review",
              blindedSampleStatus: "needs_review",
              adjudicationStatus: "needs_review",
              decisionLogStatus: "needs_review",
              ownerAcceptanceStatus: "needs_review",
              realDatasetTimelineCount: 0,
              validationSampleCount: 0,
              disagreementCaseCount: 0,
              adjudicatedCaseCount: 0,
              followupWindowDays: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-05T00:00:00.000Z",
              createdAt: "2026-06-05T00:00:00.000Z",
              updatedAt: "2026-06-05T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/post-validation-monitoring")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-post-validation-monitoring-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_post_validation_monitoring_not_ready"],
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              monitoringWindowStatus: "needs_review",
              outcomeReviewStatus: "needs_review",
              driftReviewStatus: "needs_review",
              incidentFollowupStatus: "needs_review",
              validatorRecheckStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realDatasetTimelineCount: 0,
              clinicalValidationSampleCount: 0,
              monitoredTimelineCount: 0,
              sampledOutcomeCount: 0,
              driftSignalCount: 1,
              unresolvedDriftSignalCount: 1,
              incidentFollowupCount: 1,
              unresolvedIncidentFollowupCount: 1,
              validatorRecheckCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-05T00:00:00.000Z",
              createdAt: "2026-06-05T00:00:00.000Z",
              updatedAt: "2026-06-05T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/observation-governance")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-observation-governance-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_observation_governance_not_ready"],
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              observationWindowStatus: "needs_review",
              outcomeObservationStatus: "needs_review",
              driftSignalReviewStatus: "needs_review",
              incidentOutcomeReviewStatus: "needs_review",
              followupClosureStatus: "needs_review",
              governanceReviewStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realDatasetTimelineCount: 0,
              postValidationSampleCount: 0,
              observedTimelineCount: 0,
              expectedFollowupCount: 0,
              completedFollowupCount: 0,
              driftSignalCount: 1,
              unresolvedDriftSignalCount: 1,
              incidentOutcomeCount: 1,
              unresolvedIncidentOutcomeCount: 1,
              governanceExceptionCount: 1,
              unresolvedGovernanceExceptionCount: 1,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-06T00:00:00.000Z",
              createdAt: "2026-06-06T00:00:00.000Z",
              updatedAt: "2026-06-06T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/exception-governance")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-exception-governance-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_exception_governance_not_ready"],
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              exceptionRegisterStatus: "needs_review",
              triageSlaStatus: "needs_review",
              resolutionEvidenceStatus: "needs_review",
              recurrenceReviewStatus: "needs_review",
              rollbackReadinessStatus: "needs_review",
              governanceArchiveStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realDatasetTimelineCount: 0,
              observedTimelineCount: 0,
              governanceExceptionCount: 1,
              resolvedGovernanceExceptionCount: 0,
              unresolvedGovernanceExceptionCount: 1,
              recurrenceSignalCount: 1,
              unresolvedRecurrenceSignalCount: 1,
              rollbackDrillCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-06T00:00:00.000Z",
              createdAt: "2026-06-06T00:00:00.000Z",
              updatedAt: "2026-06-06T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/outcome-governance")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-outcome-governance-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_outcome_governance_not_ready"],
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              longitudinalWindowStatus: "needs_review",
              realDatasetCoverageStatus: "needs_review",
              reviewerOperationsValidationStatus: "needs_review",
              exceptionTrendReviewStatus: "needs_review",
              followupCadenceStatus: "needs_review",
              governanceCadenceStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realDatasetTimelineCount: 0,
              observedTimelineCount: 0,
              followupWindowCount: 0,
              completedFollowupCount: 0,
              governanceExceptionCount: 1,
              unresolvedGovernanceExceptionCount: 1,
              recurrenceSignalCount: 1,
              unresolvedRecurrenceSignalCount: 1,
              governanceReviewCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-06T00:00:00.000Z",
              createdAt: "2026-06-06T00:00:00.000Z",
              updatedAt: "2026-06-06T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/longitudinal-clinical-validation")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-longitudinal-clinical-validation-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_longitudinal_clinical_validation_not_ready"],
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              outcomeWindowStatus: "needs_review",
              clinicianCoverageStatus: "needs_review",
              adjudicationStatus: "needs_review",
              consensusReviewStatus: "needs_review",
              followupValidationStatus: "needs_review",
              governanceCadenceStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realOutcomeWindowCount: 0,
              clinicallyValidatedWindowCount: 0,
              adjudicatedWindowCount: 0,
              followupValidatedWindowCount: 0,
              consensusReviewCount: 0,
              unresolvedConsensusCaseCount: 0,
              governanceReviewCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-08T00:00:00.000Z",
              createdAt: "2026-06-08T00:00:00.000Z",
              updatedAt: "2026-06-08T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-validation")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-protected-reviewer-validation-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_protected_reviewer_validation_not_ready"],
              longitudinalClinicalValidationStatus: "not_started",
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              protectedAssetWindowStatus: "needs_review",
              protectedRenderStatus: "needs_review",
              reviewerAssignmentStatus: "needs_review",
              secondReviewStatus: "needs_review",
              adjudicationOpsStatus: "needs_review",
              followupOpsStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              protectedAssetTimelineCount: 0,
              protectedRenderReadyCount: 0,
              reviewerAssignedProtectedCount: 0,
              secondReviewedProtectedCount: 0,
              adjudicatedProtectedCount: 0,
              followupValidatedProtectedCount: 0,
              unresolvedProtectedReviewCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-08T00:00:00.000Z",
              createdAt: "2026-06-08T00:00:00.000Z",
              updatedAt: "2026-06-08T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-governance")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-protected-reviewer-governance-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_protected_reviewer_governance_not_ready"],
              protectedReviewerValidationStatus: "not_started",
              longitudinalClinicalValidationStatus: "not_started",
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              reviewerMonitoringStatus: "needs_review",
              reviewerExceptionStatus: "needs_review",
              reviewerAdjudicationStatus: "needs_review",
              reviewerFollowupStatus: "needs_review",
              reviewerRollbackStatus: "needs_review",
              reviewerArchiveStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              protectedReviewWindowCount: 0,
              monitoredProtectedReviewCount: 0,
              escalatedProtectedReviewCount: 0,
              adjudicatedProtectedGovernanceCount: 0,
              followupClosedProtectedCount: 0,
              rollbackReadyProtectedCount: 0,
              archivedProtectedReviewCount: 0,
              unresolvedGovernanceReviewCount: 0,
              blockerCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 1,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-evidence")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-protected-reviewer-evidence-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_protected_reviewer_evidence_not_ready"],
              protectedReviewerGovernanceStatus: "not_started",
              protectedReviewerValidationStatus: "not_started",
              longitudinalClinicalValidationStatus: "not_started",
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              reviewerMonitoringEvidenceStatus: "needs_review",
              reviewerExceptionEvidenceStatus: "needs_review",
              reviewerAdjudicationEvidenceStatus: "needs_review",
              reviewerFollowupEvidenceStatus: "needs_review",
              reviewerRollbackEvidenceStatus: "needs_review",
              reviewerArchiveEvidenceStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              protectedReviewWindowCount: 0,
              monitoredProtectedReviewCount: 0,
              sampledProtectedReviewCount: 0,
              adjudicatedProtectedEvidenceCount: 0,
              followupClosedProtectedCount: 0,
              rollbackDrillProtectedCount: 0,
              archivedProtectedReviewCount: 0,
              unresolvedProtectedEvidenceCount: 0,
              blockerCount: 1,
              lesionCount: 1,
              readyTimelineCount: 0,
              blockedTimelineCount: 1,
              candidatePairCount: 1,
              reviewerWorkflowReadyCount: 0,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-09T00:00:00.000Z",
              createdAt: "2026-06-09T00:00:00.000Z",
              updatedAt: "2026-06-09T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/production-dataset-evidence")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-production-dataset-evidence-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_production_dataset_evidence_not_ready"],
              protectedReviewerEvidenceStatus: "not_started",
              protectedReviewerGovernanceStatus: "not_started",
              protectedReviewerValidationStatus: "not_started",
              longitudinalClinicalValidationStatus: "not_started",
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              realClinicWindowStatus: "needs_review",
              datasetSamplingStatus: "needs_review",
              longitudinalFollowupStatus: "needs_review",
              protectedReviewerLinkageStatus: "needs_review",
              outcomeObservationStatus: "needs_review",
              incidentLinkageStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              realClinicWindowCount: 0,
              monitoredClinicOperationCount: 0,
              sampledClinicOperationCount: 0,
              longitudinalFollowupCount: 0,
              protectedReviewerLinkedCount: 0,
              observedOutcomeCount: 0,
              incidentLinkedCount: 0,
              unresolvedProductionDatasetEvidenceCount: 0,
              blockerCount: 1,
              lesionCount: 1,
              readyTimelineCount: 0,
              blockedTimelineCount: 1,
              candidatePairCount: 1,
              reviewerWorkflowReadyCount: 0,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-09T00:00:00.000Z",
              createdAt: "2026-06-09T00:00:00.000Z",
              updatedAt: "2026-06-09T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/production-reviewer-evidence")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              id: "timeline-rollout-production-reviewer-evidence-1",
              clinicId: "clinic-1",
              patientId: "live-patient",
              visitId: "live-visit",
              status: "in_review",
              reasons: ["timeline_rollout_production_reviewer_evidence_not_ready"],
              productionDatasetEvidenceStatus: "not_started",
              productionReviewerGovernanceStatus: "not_started",
              protectedReviewerEvidenceStatus: "not_started",
              protectedReviewerGovernanceStatus: "not_started",
              protectedReviewerValidationStatus: "not_started",
              longitudinalClinicalValidationStatus: "not_started",
              outcomeGovernanceStatus: "not_started",
              exceptionGovernanceStatus: "not_started",
              observationGovernanceStatus: "not_started",
              postValidationMonitoringStatus: "not_started",
              clinicalValidationStatus: "not_started",
              incidentProcedureStatus: "not_started",
              monitoringStatus: "not_started",
              evidenceStatus: "not_started",
              sopStatus: "not_started",
              validationStatus: "blocked",
              rolloutStatus: "review_required",
              productionReviewerAssignmentStatus: "needs_review",
              productionSecondReviewStatus: "needs_review",
              productionAdjudicationStatus: "needs_review",
              productionFollowupStatus: "needs_review",
              productionExceptionStatus: "needs_review",
              productionRollbackStatus: "needs_review",
              ownerSignoffStatus: "needs_review",
              productionReviewWindowCount: 0,
              assignedProductionReviewerCount: 0,
              secondReviewedProductionCount: 0,
              adjudicatedProductionReviewCount: 0,
              followupClosedProductionCount: 0,
              exceptionClosedProductionCount: 0,
              rollbackReadyProductionCount: 0,
              unresolvedProductionReviewerEvidenceCount: 0,
              blockerCount: 1,
              lesionCount: 1,
              readyTimelineCount: 0,
              blockedTimelineCount: 1,
              candidatePairCount: 1,
              reviewerWorkflowReadyCount: 0,
              patientDeliveryAllowed: false,
              medicalMeasurementAllowed: false,
              protectedFieldsExposed: false,
              clinicalOutputGenerated: false,
              reviewedAt: "2026-06-09T00:00:00.000Z",
              createdAt: "2026-06-09T00:00:00.000Z",
              updatedAt: "2026-06-09T00:00:00.000Z",
            },
          }),
          { headers: { "Content-Type": "application/json" }, status: init?.method === "PATCH" ? 200 : 405 },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/lesion-comparison-viewer-qa/review-queue?status=actionable&limit=20")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              visitId: "live-visit",
              filters: { status: "actionable", limit: 20 },
              summary: {
                total: 3,
                unreviewed: 1,
                technicalReady: 1,
                needsRecapture: 1,
                notSuitableForComparison: 1,
                measurementPolicyRequired: 1,
                productionAnalysisPolicyRequired: 1,
                reviewerAssignmentRequired: 1,
                secondReviewRequired: 1,
                actionable: 3,
              },
              items: [
                {
                  queueNumber: 1,
                  lesionId: "live-lesion",
                  lesionLabel: "Live lesion A",
                  bodyZone: "спина",
                  bodySurface: "back",
                  review: {
                    status: "needs_recapture",
                    reasons: ["repeat_capture_required"],
                    reviewedAt: "2026-05-19T10:50:00.000Z",
                    reviewedByUserId: "doctor-1",
                  },
                  calibrationStatus: "not_ready",
                  calibrationReasons: ["scale_marker_missing"],
                  captureMetadataStatus: "needs_review",
                  measurementPolicy: {
                    status: "review_required",
                    reasons: ["measurement_policy_requires_review"],
                    reviewedAt: null,
                    medicalMeasurementAllowed: true,
                    patientDeliveryAllowed: true,
                    clinicalOutputGenerated: true,
                  },
                  productionAnalysisPolicy: {
                    status: "review_required",
                    reasons: ["production_analysis_policy_required"],
                    reviewedAt: null,
                    medicalMeasurementAllowed: true,
                    patientDeliveryAllowed: true,
                    clinicalOutputGenerated: true,
                  },
                  reviewerAssignment: {
                    status: "unassigned",
                    reasons: [],
                    assignedAt: null,
                    reviewerIdentityExposed: true,
                    patientDeliveryAllowed: true,
                    medicalMeasurementAllowed: true,
                  },
                  secondReview: {
                    status: "required",
                    reasons: [],
                    reviewedAt: null,
                    reviewerIdentityExposed: true,
                    patientDeliveryAllowed: true,
                    medicalMeasurementAllowed: true,
                  },
                  technicalMarkerCount: 1,
                  updatedAt: "2026-05-19T10:55:00.000Z",
                  nextAction: "request_recapture",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
              ],
              boundaries: {
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                pairKeysExposed: true,
                imageIdsExposed: true,
                clinicalConclusionGenerated: true,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    if (href.endsWith("/api/v1/visits/live-visit/longitudinal-dataset-validation")) {
      return Promise.resolve(
        new Response(
          JSON.stringify({
            item: {
              visitId: "live-visit",
              readiness: {
                status: "blocked",
                lesionCount: 2,
                timelineCandidateCount: 2,
                readyTimelineCount: 1,
                needsReviewTimelineCount: 0,
                blockedTimelineCount: 1,
                imageCount: 8,
                candidatePairCount: 3,
                reviewedPairCount: 2,
                technicalReadyPairCount: 2,
                productionAssetNotReadyCount: 1,
                productionAnalysisPolicyNotReadyCount: 1,
                missingCaptureMetadataCount: 1,
                deviceEvidenceNotReadyCount: 1,
                deviceBridgeQualityNotReadyCount: 1,
                calibrationBlockedCount: 1,
                markerMissingCount: 1,
                reviewerWorkflowReadyCount: 1,
                dynamicConclusionAllowed: true,
              },
              items: [
                {
                  queueNumber: 1,
                  lesionId: "live-lesion",
                  lesionLabel: "Live lesion A",
                  bodyZone: "спина",
                  bodySurface: "back",
                  status: "blocked",
                  visitCount: 2,
                  imageCount: 4,
                  candidatePairCount: 2,
                  reviewedPairCount: 1,
                  technicalReadyPairCount: 1,
                  productionAssetNotReadyCount: 1,
                  productionAnalysisPolicyNotReadyCount: 1,
                  missingCaptureMetadataCount: 1,
                  deviceEvidenceNotReadyCount: 1,
                  deviceBridgeQualityNotReadyCount: 1,
                  calibrationBlockedCount: 1,
                  markerMissingCount: 1,
                  reviewerWorkflowReadyCount: 0,
                  nextAction: "complete_capture_metadata",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
                {
                  queueNumber: 2,
                  lesionId: "live-lesion-device",
                  lesionLabel: "Live lesion device",
                  bodyZone: "плечо",
                  bodySurface: "front",
                  status: "blocked",
                  visitCount: 2,
                  imageCount: 4,
                  candidatePairCount: 2,
                  reviewedPairCount: 1,
                  technicalReadyPairCount: 1,
                  productionAssetNotReadyCount: 0,
                  productionAnalysisPolicyNotReadyCount: 1,
                  missingCaptureMetadataCount: 0,
                  deviceEvidenceNotReadyCount: 1,
                  deviceBridgeQualityNotReadyCount: 1,
                  calibrationBlockedCount: 0,
                  markerMissingCount: 0,
                  reviewerWorkflowReadyCount: 0,
                  nextAction: "complete_device_metadata",
                  pairKey: "live-lesion-device:i-021+i-022",
                  imageIds: ["i-021", "i-022"],
                },
              ],
              blockers: [
                {
                  code: "missing_capture_metadata",
                  label: "Не хватает metadata съёмки",
                  count: 1,
                  nextAction: "complete_capture_metadata",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
                {
                  code: "device_metadata_not_ready",
                  label: "Device metadata требует проверки",
                  count: 1,
                  nextAction: "complete_device_metadata",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
                {
                  code: "production_asset_not_ready",
                  label: "Production asset требует проверки",
                  count: 1,
                  nextAction: "verify_production_asset",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
                {
                  code: "production_analysis_policy_required",
                  label: "Нужна production analysis policy",
                  count: 1,
                  nextAction: "approve_production_analysis_policy",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
                {
                  code: "device_bridge_quality_not_ready",
                  label: "Device Bridge требует проверки",
                  count: 1,
                  nextAction: "check_device_bridge",
                  pairKey: "live-lesion:i-011+i-012",
                  imageIds: ["i-011", "i-012"],
                },
              ],
              timelineRollout: {
                id: "timeline-rollout-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "review_required",
                reasons: ["timeline_dataset_not_ready"],
                validationStatus: "blocked",
                lesionCount: 2,
                readyTimelineCount: 1,
                needsReviewTimelineCount: 0,
                blockedTimelineCount: 1,
                candidatePairCount: 3,
                reviewerWorkflowReadyCount: 1,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                reviewedAt: "2026-06-04T00:00:00.000Z",
                createdAt: "2026-06-04T00:00:00.000Z",
                updatedAt: "2026-06-04T00:00:00.000Z",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutSop: {
                id: "timeline-rollout-sop-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                datasetValidationStatus: "missing",
                reviewerOperationsStatus: "missing",
                rollbackPlanStatus: "missing",
                monitoringPlanStatus: "missing",
                rolloutWindowStatus: "missing",
                ownerAckStatus: "missing",
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutEvidence: {
                id: "timeline-rollout-evidence-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                monitoringEvidenceStatus: "missing",
                sampleAuditStatus: "missing",
                exceptionLogStatus: "missing",
                rollbackDrillStatus: "missing",
                ownerSignoffStatus: "missing",
                monitoringWindowDays: 0,
                sampledTimelineCount: 0,
                exceptionCount: 0,
                rollbackDrillCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutMonitoring: {
                id: "timeline-rollout-monitoring-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                outcomeSamplingStatus: "missing",
                incidentReviewStatus: "missing",
                exceptionClosureStatus: "missing",
                rollbackOutcomeStatus: "missing",
                ownerFinalReviewStatus: "missing",
                monitoringWindowDays: 0,
                monitoredTimelineCount: 0,
                sampledTimelineCount: 0,
                incidentCount: 0,
                unresolvedIncidentCount: 0,
                closedExceptionCount: 0,
                rollbackExecutionCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawMonitoringLog: "unsafe",
                incidentPayload: { unsafe: true },
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutIncidentProcedure: {
                id: "timeline-rollout-incident-procedure-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                realDatasetStatus: "missing",
                outcomeSamplingProcedureStatus: "missing",
                incidentTriageStatus: "missing",
                escalationPathStatus: "missing",
                rollbackDecisionStatus: "missing",
                ownerReviewStatus: "missing",
                realDatasetTimelineCount: 0,
                monitoredTimelineCount: 0,
                sampledOutcomeCount: 0,
                incidentCaseCount: 0,
                unresolvedIncidentCount: 0,
                escalatedIncidentCount: 0,
                rollbackDecisionCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawOutcomeLog: "unsafe",
                incidentDetails: { unsafe: true },
                incidentTimeline: ["unsafe"],
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutClinicalValidation: {
                id: "timeline-rollout-clinical-validation-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                realDatasetLockStatus: "missing",
                validatorTrainingStatus: "missing",
                blindedSampleStatus: "missing",
                adjudicationStatus: "missing",
                decisionLogStatus: "missing",
                ownerAcceptanceStatus: "missing",
                realDatasetTimelineCount: 0,
                validationSampleCount: 0,
                disagreementCaseCount: 0,
                adjudicatedCaseCount: 0,
                followupWindowDays: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawValidationLog: "unsafe",
                rawAdjudicationLog: "unsafe",
                clinicalValidationPayload: { unsafe: true },
                validationDetails: { unsafe: true },
                adjudicationDetails: { unsafe: true },
                validatorName: "Unsafe Name",
                validatorEmail: "unsafe@example.com",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutPostValidationMonitoring: {
                id: "timeline-rollout-post-validation-monitoring-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                monitoringWindowStatus: "missing",
                outcomeReviewStatus: "missing",
                driftReviewStatus: "missing",
                incidentFollowupStatus: "missing",
                validatorRecheckStatus: "missing",
                ownerSignoffStatus: "missing",
                realDatasetTimelineCount: 0,
                clinicalValidationSampleCount: 0,
                monitoredTimelineCount: 0,
                sampledOutcomeCount: 0,
                driftSignalCount: 0,
                unresolvedDriftSignalCount: 0,
                incidentFollowupCount: 0,
                unresolvedIncidentFollowupCount: 0,
                validatorRecheckCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawDriftLog: "unsafe",
                rawFollowupLog: "unsafe",
                postValidationPayload: { unsafe: true },
                monitoringDetails: { unsafe: true },
                driftDetails: { unsafe: true },
                followupDetails: { unsafe: true },
                validatorName: "Unsafe Name",
                validatorEmail: "unsafe@example.com",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutObservationGovernance: {
                id: "timeline-rollout-observation-governance-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                observationWindowStatus: "missing",
                outcomeObservationStatus: "missing",
                driftSignalReviewStatus: "missing",
                incidentOutcomeReviewStatus: "missing",
                followupClosureStatus: "missing",
                governanceReviewStatus: "missing",
                ownerSignoffStatus: "missing",
                realDatasetTimelineCount: 0,
                postValidationSampleCount: 0,
                observedTimelineCount: 0,
                expectedFollowupCount: 0,
                completedFollowupCount: 0,
                driftSignalCount: 0,
                unresolvedDriftSignalCount: 0,
                incidentOutcomeCount: 0,
                unresolvedIncidentOutcomeCount: 0,
                governanceExceptionCount: 0,
                unresolvedGovernanceExceptionCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawObservationLog: "unsafe",
                rawOutcomeReviewLog: "unsafe",
                rawIncidentOutcomeLog: "unsafe",
                observationPayload: { unsafe: true },
                outcomeReviewPayload: { unsafe: true },
                incidentOutcomePayload: { unsafe: true },
                governancePayload: { unsafe: true },
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutExceptionGovernance: {
                id: "timeline-rollout-exception-governance-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                exceptionRegisterStatus: "missing",
                triageSlaStatus: "missing",
                resolutionEvidenceStatus: "missing",
                recurrenceReviewStatus: "missing",
                rollbackReadinessStatus: "missing",
                governanceArchiveStatus: "missing",
                ownerSignoffStatus: "missing",
                realDatasetTimelineCount: 0,
                observedTimelineCount: 0,
                governanceExceptionCount: 0,
                resolvedGovernanceExceptionCount: 0,
                unresolvedGovernanceExceptionCount: 0,
                recurrenceSignalCount: 0,
                unresolvedRecurrenceSignalCount: 0,
                rollbackDrillCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawExceptionLog: "unsafe",
                rawRecurrenceLog: "unsafe",
                rawRollbackLog: "unsafe",
                exceptionPayload: { unsafe: true },
                recurrencePayload: { unsafe: true },
                rollbackPayload: { unsafe: true },
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutOutcomeGovernance: {
                id: "timeline-rollout-outcome-governance-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                exceptionGovernanceStatus: "not_started",
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                longitudinalWindowStatus: "missing",
                realDatasetCoverageStatus: "missing",
                reviewerOperationsValidationStatus: "missing",
                exceptionTrendReviewStatus: "missing",
                followupCadenceStatus: "missing",
                governanceCadenceStatus: "missing",
                ownerSignoffStatus: "missing",
                realDatasetTimelineCount: 0,
                observedTimelineCount: 0,
                followupWindowCount: 0,
                completedFollowupCount: 0,
                governanceExceptionCount: 0,
                unresolvedGovernanceExceptionCount: 0,
                recurrenceSignalCount: 0,
                unresolvedRecurrenceSignalCount: 0,
                governanceReviewCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawOutcomeLog: "unsafe",
                rawFollowupLog: "unsafe",
                rawGovernanceLog: "unsafe",
                outcomePayload: { unsafe: true },
                followupPayload: { unsafe: true },
                governancePayload: { unsafe: true },
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutLongitudinalClinicalValidation: {
                id: "timeline-rollout-longitudinal-clinical-validation-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                outcomeGovernanceStatus: "not_started",
                exceptionGovernanceStatus: "not_started",
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                outcomeWindowStatus: "missing",
                clinicianCoverageStatus: "missing",
                adjudicationStatus: "missing",
                consensusReviewStatus: "missing",
                followupValidationStatus: "missing",
                governanceCadenceStatus: "missing",
                ownerSignoffStatus: "missing",
                realOutcomeWindowCount: 0,
                clinicallyValidatedWindowCount: 0,
                adjudicatedWindowCount: 0,
                followupValidatedWindowCount: 0,
                consensusReviewCount: 0,
                unresolvedConsensusCaseCount: 0,
                governanceReviewCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawLongitudinalClinicalValidationLog: "unsafe",
                longitudinalClinicalValidationPayload: { unsafe: true },
                longitudinalClinicalValidationDetails: { unsafe: true },
                rawAdjudicationLog: "unsafe",
                adjudicationPayload: { unsafe: true },
                adjudicationDetails: { unsafe: true },
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutProtectedReviewerValidation: {
                id: "timeline-rollout-protected-reviewer-validation-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                longitudinalClinicalValidationStatus: "not_started",
                outcomeGovernanceStatus: "not_started",
                exceptionGovernanceStatus: "not_started",
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                protectedAssetWindowStatus: "missing",
                protectedRenderStatus: "missing",
                reviewerAssignmentStatus: "missing",
                secondReviewStatus: "missing",
                adjudicationOpsStatus: "missing",
                followupOpsStatus: "missing",
                ownerSignoffStatus: "missing",
                protectedAssetTimelineCount: 0,
                protectedRenderReadyCount: 0,
                reviewerAssignedProtectedCount: 0,
                secondReviewedProtectedCount: 0,
                adjudicatedProtectedCount: 0,
                followupValidatedProtectedCount: 0,
                unresolvedProtectedReviewCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawProtectedReviewLog: "unsafe",
                protectedReviewerValidationPayload: { unsafe: true },
                protectedReviewerValidationDetails: { unsafe: true },
                reviewerAssignmentPayload: { unsafe: true },
                secondReviewPayload: { unsafe: true },
                reviewerName: "Unsafe Name",
                reviewerEmail: "unsafe@example.com",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutProtectedReviewerGovernance: {
                id: "timeline-rollout-protected-reviewer-governance-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                protectedReviewerValidationStatus: "not_started",
                longitudinalClinicalValidationStatus: "not_started",
                outcomeGovernanceStatus: "not_started",
                exceptionGovernanceStatus: "not_started",
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                reviewerMonitoringStatus: "missing",
                reviewerExceptionStatus: "missing",
                reviewerAdjudicationStatus: "missing",
                reviewerFollowupStatus: "missing",
                reviewerRollbackStatus: "missing",
                reviewerArchiveStatus: "missing",
                ownerSignoffStatus: "missing",
                protectedReviewWindowCount: 0,
                monitoredProtectedReviewCount: 0,
                escalatedProtectedReviewCount: 0,
                adjudicatedProtectedGovernanceCount: 0,
                followupClosedProtectedCount: 0,
                rollbackReadyProtectedCount: 0,
                archivedProtectedReviewCount: 0,
                unresolvedGovernanceReviewCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawProtectedReviewerLog: "unsafe",
                protectedReviewerGovernancePayload: { unsafe: true },
                reviewerMonitoringPayload: { unsafe: true },
                reviewerName: "Unsafe Name",
                reviewerEmail: "unsafe@example.com",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              timelineRolloutProtectedReviewerEvidence: {
                id: "timeline-rollout-protected-reviewer-evidence-1",
                clinicId: "clinic-1",
                patientId: "live-patient",
                visitId: "live-visit",
                status: "not_started",
                reasons: [],
                protectedReviewerGovernanceStatus: "not_started",
                protectedReviewerValidationStatus: "not_started",
                longitudinalClinicalValidationStatus: "not_started",
                outcomeGovernanceStatus: "not_started",
                exceptionGovernanceStatus: "not_started",
                observationGovernanceStatus: "not_started",
                postValidationMonitoringStatus: "not_started",
                clinicalValidationStatus: "not_started",
                incidentProcedureStatus: "not_started",
                monitoringStatus: "not_started",
                evidenceStatus: "not_started",
                sopStatus: "not_started",
                validationStatus: "blocked",
                rolloutStatus: "review_required",
                reviewerMonitoringEvidenceStatus: "missing",
                reviewerExceptionEvidenceStatus: "missing",
                reviewerAdjudicationEvidenceStatus: "missing",
                reviewerFollowupEvidenceStatus: "missing",
                reviewerRollbackEvidenceStatus: "missing",
                reviewerArchiveEvidenceStatus: "missing",
                ownerSignoffStatus: "missing",
                protectedReviewWindowCount: 0,
                monitoredProtectedReviewCount: 0,
                sampledProtectedReviewCount: 0,
                adjudicatedProtectedEvidenceCount: 0,
                followupClosedProtectedCount: 0,
                rollbackDrillProtectedCount: 0,
                archivedProtectedReviewCount: 0,
                unresolvedProtectedEvidenceCount: 0,
                blockerCount: 0,
                lesionCount: 0,
                readyTimelineCount: 0,
                blockedTimelineCount: 0,
                candidatePairCount: 0,
                reviewerWorkflowReadyCount: 0,
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                clinicalOutputGenerated: true,
                rawProtectedReviewerEvidenceLog: "unsafe",
                protectedReviewerEvidencePayload: { unsafe: true },
                reviewerMonitoringEvidencePayload: { unsafe: true },
                reviewerName: "Unsafe Name",
                reviewerEmail: "unsafe@example.com",
                pairKey: "live-lesion:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
              nextActions: [
                "verify_production_asset",
                "complete_capture_metadata",
                "complete_device_metadata",
                "check_device_bridge",
                "approve_production_analysis_policy",
              ],
              boundaries: {
                patientDeliveryAllowed: true,
                medicalMeasurementAllowed: true,
                protectedFieldsExposed: true,
                pairKeysExposed: true,
                imageIdsExposed: true,
                storagePathsExposed: true,
                signedUrlsIssued: true,
                rawImageBytesExposed: true,
                doctorOnlyTextExposed: true,
                clinicalConclusionGenerated: true,
              },
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({ items: [] })));
  });
}

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
    const fetchMock = createLiveWorkspaceFetchMock();
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

describe("VisitWorkspacePage · Stage 5G · production clinical workspace completion", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_APP_MODE", "production");
    window.localStorage.setItem(SELF_HOSTED_API_BASE_URL_KEY, "http://localhost:8080");
    window.localStorage.setItem(SELF_HOSTED_API_TOKEN_KEY, "local-jwt");
    vi.stubGlobal("fetch", createLiveWorkspaceFetchMock());
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hides mock-derived assessment, conclusion and report tabs in production", async () => {
    renderAt("/patients/live-patient/visits/live-visit?tab=assessment");

    expect(await screen.findByRole("heading", { name: /Петрова Анна Live/ })).toBeInTheDocument();
    expect(await screen.findByText(/Self-hosted assessment contract/)).toBeInTheDocument();
    expect(screen.getByText(/mock assessment\/report data hidden/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Live assessment summary/)).toBeInTheDocument();

    selectTab(/Заключение/);
    expect(await screen.findByText(/Self-hosted conclusion contract/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Live conclusion summary/)).toBeInTheDocument();
    expect(screen.getAllByText(/mock assessment\/report data hidden/).length).toBeGreaterThan(0);

    selectTab(/Отчёт/);
    expect(await screen.findByText(/Self-hosted report contract/)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Live report physician text/)).toBeInTheDocument();
    expect(await screen.findByText(/Clinical report completion/)).toBeInTheDocument();
    expect(screen.getByText(/Stage 8G-8I/)).toBeInTheDocument();
    expect(screen.getByText(/Готов · 100%/)).toBeInTheDocument();
    expect(screen.getAllByText(/Фото-протокол/).length).toBeGreaterThan(0);
    expect(screen.getByText(/metadata ready, backend blocked/)).toBeInTheDocument();
    expect(screen.getByText(/нет backend-контракта выдачи фото/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Проверка политики выдачи фото" })).toBeInTheDocument();
    expect(screen.getByText(/Требует проверки/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Журнал выдачи фото" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Очередь viewer QA" })).toBeInTheDocument();
    expect(screen.getByText(/Технический контур сравнения/)).toBeInTheDocument();
    expect(screen.getByText(/Нужен переснимок/)).toBeInTheDocument();
    expect(screen.getAllByText(/Выдача пациенту: выключена/).length).toBeGreaterThan(0);
    expect(await screen.findByRole("region", { name: "Готовность timeline QA" })).toBeInTheDocument();
    const timelineFocus = await screen.findByRole("region", { name: "Рабочий шаг timeline QA" });
    expect(within(timelineFocus).getByText(/Что делать сейчас/)).toBeInTheDocument();
    expect(within(timelineFocus).getByText(/Следующий шаг: Закрыть блокеры данных/)).toBeInTheDocument();
    expect(within(timelineFocus).getByText(/Ближайшее действие:/)).toBeInTheDocument();
    expect(within(timelineFocus).getByText(/Дозаполнить metadata/)).toBeInTheDocument();
    expect(within(timelineFocus).getByText(/Первый блокер: Не хватает metadata съёмки · 1/)).toBeInTheDocument();
    expect(within(timelineFocus).getByText(/Прогресс проверки: 0\/8/)).toBeInTheDocument();
    expect(within(timelineFocus).getByRole("link", { name: /Открыть очаги с блокерами/ })).toHaveAttribute(
      "href",
      "#timeline-qa-lesions",
    );
    expect(within(timelineFocus).getByRole("list", { name: "Этапы timeline QA" })).toBeInTheDocument();
    const timelineGroups = screen.getByRole("navigation", { name: "Группы timeline QA" });
    expect(within(timelineGroups).getByRole("link", { name: /Данные и запуск/ })).toHaveAttribute(
      "href",
      "#timeline-rollout-details",
    );
    expect(within(timelineGroups).getByRole("link", { name: /SOP и evidence/ })).toHaveAttribute(
      "href",
      "#timeline-sop-evidence",
    );
    expect(within(timelineGroups).getByRole("link", { name: /Monitoring и validation/ })).toHaveAttribute(
      "href",
      "#timeline-monitoring-validation",
    );
    expect(within(timelineGroups).getByRole("link", { name: /Protected review/ })).toHaveAttribute(
      "href",
      "#timeline-protected-review",
    );
    expect(within(timelineGroups).getByRole("link", { name: /Production rollout/ })).toHaveAttribute(
      "href",
      "#timeline-production-review",
    );
    expect(screen.getAllByText("Данные и запуск").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SOP и evidence").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monitoring и validation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Protected review").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Production rollout").length).toBeGreaterThan(0);
    expect(screen.getByText(/Production dataset validation/)).toBeInTheDocument();
    expect(screen.getByText(/не создаёт вывод о динамике/)).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Контур timeline rollout" })).toBeInTheDocument();
    expect(screen.getByText(/Rollout сохраняет только aggregate metadata/)).toBeInTheDocument();
    expect(screen.getAllByText(/Clinical dynamic conclusion: выключен/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Утвердить timeline rollout/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Нужен разбор rollout/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "SOP timeline rollout" })).toBeInTheDocument();
    expect(screen.getByText(/SOP фиксирует только operational checklist/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить SOP rollout/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать SOP review/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Evidence timeline rollout" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Monitoring outcomes rollout" })).toBeInTheDocument();
    expect(screen.getByText(/Monitoring фиксирует только aggregate outcomes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить production rollout/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать monitoring review/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Incident procedure rollout" })).toBeInTheDocument();
    expect(screen.getByText(/Incident procedure фиксирует только aggregate production outcomes/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить clinic monitoring/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать incident procedure/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Clinical validation rollout" })).toBeInTheDocument();
    expect(screen.getByText(/Clinical validation фиксирует только aggregate validation metadata/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить clinical validation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать clinical validation/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Post-validation monitoring rollout" })).toBeInTheDocument();
    expect(screen.getByText(/Post-validation monitoring фиксирует только aggregate follow-up\/drift metadata/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить post-validation monitoring/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать post-validation monitoring/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Outcome observation governance" })).toBeInTheDocument();
    expect(screen.getByText(/Observation governance фиксирует только aggregate outcome metadata/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить observation governance/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать observation governance/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Exception governance closure" })).toBeInTheDocument();
    expect(screen.getByText(/Exception governance фиксирует только aggregate exception closure/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить exception governance/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать exception governance/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Longitudinal outcome governance" })).toBeInTheDocument();
    expect(screen.getByText(/Outcome governance фиксирует только aggregate longitudinal metadata over time/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить outcome governance/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать outcome governance/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Longitudinal clinical validation" })).toBeInTheDocument();
    expect(screen.getByText(/Clinical longitudinal validation фиксирует только aggregate clinical longitudinal metadata over time/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить longitudinal clinical validation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать longitudinal clinical validation/ })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Protected reviewer validation" })).toBeInTheDocument();
    expect(screen.getByText(/Protected reviewer validation фиксирует только aggregate reviewer operations metadata on protected assets/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Утвердить protected reviewer validation/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Зафиксировать protected reviewer validation/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Дозаполнить metadata/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Проверить production assets/)).toBeInTheDocument();
    expect(screen.getByText(/Дозаполнить device metadata/)).toBeInTheDocument();
    expect(screen.getByText(/Проверить Device Bridge/)).toBeInTheDocument();
    expect(screen.getByText(/Утвердить analysis policy/)).toBeInTheDocument();
    expect(screen.getAllByText(/Analysis/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/assets: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/analysis: 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bridge: 1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Динамический вывод: выключен/)).toBeInTheDocument();
    expect(screen.getByText(/Неизменяемый backend-аудит/)).toBeInTheDocument();
    expect(screen.getByText(/Подготовка выдачи/)).toBeInTheDocument();
    expect(screen.getByText(/Отзыв выдачи/)).toBeInTheDocument();
    expect(screen.getByText(/Открытие фото пациентом/)).toBeInTheDocument();
    expect(screen.getByText(/причины отзыва и служебные идентификаторы скрыты/)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("SENSITIVE_INTERNAL_REASON");
    expect(document.body.textContent).not.toContain("SENSITIVE_ACTOR_ID");
    expect(document.body.textContent).not.toContain("SENSITIVE_CORRELATION_ID");
    expect(document.body.textContent).not.toContain("SENSITIVE_RAW_PAYLOAD");
    expect(document.body.textContent).not.toContain("revokeReason");
    expect(document.body.textContent).not.toContain("correlationId");
    expect(document.body.textContent).not.toContain("actorUserId");
    expect(document.body.textContent).not.toContain("rawPayload");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("incidentPayload");
    expect(document.body.textContent).not.toContain("rawMonitoringLog");
    expect(document.body.textContent).not.toContain("rawOutcomeLog");
    expect(document.body.textContent).not.toContain("incidentDetails");
    expect(document.body.textContent).not.toContain("incidentTimeline");
    expect(document.body.textContent).not.toContain("rawValidationLog");
    expect(document.body.textContent).not.toContain("rawAdjudicationLog");
    expect(document.body.textContent).not.toContain("clinicalValidationPayload");
    expect(document.body.textContent).not.toContain("validationDetails");
    expect(document.body.textContent).not.toContain("adjudicationDetails");
    expect(document.body.textContent).not.toContain("rawLongitudinalClinicalValidationLog");
    expect(document.body.textContent).not.toContain("longitudinalClinicalValidationPayload");
    expect(document.body.textContent).not.toContain("longitudinalClinicalValidationDetails");
    expect(document.body.textContent).not.toContain("adjudicationPayload");
    expect(document.body.textContent).not.toContain("validatorName");
    expect(document.body.textContent).not.toContain("validatorEmail");
    expect(document.body.textContent).not.toContain("i-011");
    expect(document.body.textContent).not.toContain("i-012");
    expect(screen.getAllByText(/mock assessment\/report data hidden/).length).toBeGreaterThan(0);
  });

  it("posts timeline rollout governance review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Контур timeline rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Нужен разбор rollout/ }));
    await screen.findByText(/Timeline rollout governance сохранён/);

    const rolloutCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(rolloutCall).toBeTruthy();
    expect(String((rolloutCall?.[1] as RequestInit | undefined)?.body)).toContain("review_required");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
  });

  it("posts timeline rollout SOP review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "SOP timeline rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать SOP review/ }));
    await screen.findByText(/Timeline rollout SOP сохранён/);

    const sopCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/sop")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(sopCall).toBeTruthy();
    expect(String((sopCall?.[1] as RequestInit | undefined)?.body)).toContain("in_review");
    expect(String((sopCall?.[1] as RequestInit | undefined)?.body)).toContain("rollbackPlanStatus");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
  });

  it("posts timeline rollout evidence review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Evidence timeline rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать evidence review/ }));
    await screen.findByText(/Timeline rollout evidence сохранён/);

    const evidenceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/evidence")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(evidenceCall).toBeTruthy();
    const body = String((evidenceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("monitoringEvidenceStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
  });

  it("posts timeline rollout monitoring review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Monitoring outcomes rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать monitoring review/ }));
    await screen.findByText(/Timeline rollout monitoring сохранён/);

    const monitoringCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/monitoring")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(monitoringCall).toBeTruthy();
    const body = String((monitoringCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("outcomeSamplingStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("incidentPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("incidentPayload");
  });

  it("posts timeline rollout incident procedure review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Incident procedure rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать incident procedure/ }));
    await screen.findByText(/Incident procedure сохранён/);

    const incidentProcedureCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/incident-procedure")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(incidentProcedureCall).toBeTruthy();
    const body = String((incidentProcedureCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("realDatasetStatus");
    expect(body).toContain("incidentTriageStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("incidentPayload");
    expect(body).not.toContain("rawOutcomeLog");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("incidentPayload");
    expect(document.body.textContent).not.toContain("rawOutcomeLog");
    expect(document.body.textContent).not.toContain("rawDriftLog");
    expect(document.body.textContent).not.toContain("rawFollowupLog");
    expect(document.body.textContent).not.toContain("postValidationPayload");
    expect(document.body.textContent).not.toContain("monitoringDetails");
    expect(document.body.textContent).not.toContain("driftDetails");
    expect(document.body.textContent).not.toContain("followupDetails");
  });

  it("posts timeline rollout clinical validation review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Clinical validation rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать clinical validation/ }));
    await screen.findByText(/Clinical validation metadata сохранён/);

    const clinicalValidationCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/clinical-validation")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(clinicalValidationCall).toBeTruthy();
    const body = String((clinicalValidationCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("realDatasetLockStatus");
    expect(body).toContain("validatorTrainingStatus");
    expect(body).toContain("validationSampleCount");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawValidationLog");
    expect(body).not.toContain("rawAdjudicationLog");
    expect(body).not.toContain("clinicalValidationPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawValidationLog");
    expect(document.body.textContent).not.toContain("rawAdjudicationLog");
  });

  it("posts timeline rollout post-validation monitoring review without patient delivery or dynamic conclusion", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Post-validation monitoring rollout" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать post-validation monitoring/ }));
    await screen.findByText(/Post-validation monitoring metadata сохранён/);

    const postValidationMonitoringCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/post-validation-monitoring")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(postValidationMonitoringCall).toBeTruthy();
    const body = String((postValidationMonitoringCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("monitoringWindowStatus");
    expect(body).toContain("outcomeReviewStatus");
    expect(body).toContain("driftReviewStatus");
    expect(body).toContain("validatorRecheckStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawMonitoringLog");
    expect(body).not.toContain("rawDriftLog");
    expect(body).not.toContain("rawFollowupLog");
    expect(body).not.toContain("postValidationPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawDriftLog");
    expect(document.body.textContent).not.toContain("rawFollowupLog");
  });

  it("posts timeline rollout exception governance review without patient delivery or clinical output", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Exception governance closure" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать exception governance/ }));
    await screen.findByText(/Exception governance metadata сохранён/);

    const exceptionGovernanceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/exception-governance")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(exceptionGovernanceCall).toBeTruthy();
    const body = String((exceptionGovernanceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("exceptionRegisterStatus");
    expect(body).toContain("resolutionEvidenceStatus");
    expect(body).toContain("recurrenceReviewStatus");
    expect(body).toContain("rollbackReadinessStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawExceptionLog");
    expect(body).not.toContain("rawRecurrenceLog");
    expect(body).not.toContain("rawRollbackLog");
    expect(body).not.toContain("exceptionPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawExceptionLog");
    expect(document.body.textContent).not.toContain("rawRecurrenceLog");
    expect(document.body.textContent).not.toContain("rawRollbackLog");
  });

  it("posts timeline rollout outcome governance review without patient delivery or clinical output", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Longitudinal outcome governance" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать outcome governance/ }));
    await screen.findByText(/Outcome governance metadata сохранён/);

    const outcomeGovernanceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/outcome-governance")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(outcomeGovernanceCall).toBeTruthy();
    const body = String((outcomeGovernanceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("longitudinalWindowStatus");
    expect(body).toContain("realDatasetCoverageStatus");
    expect(body).toContain("followupCadenceStatus");
    expect(body).toContain("governanceCadenceStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawOutcomeLog");
    expect(body).not.toContain("rawFollowupLog");
    expect(body).not.toContain("rawGovernanceLog");
    expect(body).not.toContain("outcomePayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawOutcomeLog");
    expect(document.body.textContent).not.toContain("rawFollowupLog");
    expect(document.body.textContent).not.toContain("rawGovernanceLog");
  });

  it("posts longitudinal clinical validation review without patient delivery or clinical output", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Longitudinal clinical validation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать longitudinal clinical validation/ }));
    await screen.findByText(/Longitudinal clinical validation metadata сохранён/);

    const longitudinalClinicalValidationCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/longitudinal-clinical-validation")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(longitudinalClinicalValidationCall).toBeTruthy();
    const body = String((longitudinalClinicalValidationCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("outcomeWindowStatus");
    expect(body).toContain("clinicianCoverageStatus");
    expect(body).toContain("adjudicationStatus");
    expect(body).toContain("consensusReviewStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawLongitudinalClinicalValidationLog");
    expect(body).not.toContain("longitudinalClinicalValidationPayload");
    expect(body).not.toContain("longitudinalClinicalValidationDetails");
    expect(body).not.toContain("adjudicationPayload");
    expect(body).not.toContain("adjudicationDetails");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawLongitudinalClinicalValidationLog");
    expect(document.body.textContent).not.toContain("longitudinalClinicalValidationPayload");
    expect(document.body.textContent).not.toContain("longitudinalClinicalValidationDetails");
    expect(document.body.textContent).not.toContain("adjudicationPayload");
    expect(document.body.textContent).not.toContain("adjudicationDetails");
  });

  it("posts protected reviewer validation review without patient delivery or protected asset leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Protected reviewer validation" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать protected reviewer validation/ }));
    await screen.findByText(/Protected reviewer validation metadata сохранён/);

    const protectedReviewerValidationCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-validation")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(protectedReviewerValidationCall).toBeTruthy();
    const body = String((protectedReviewerValidationCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("protectedAssetWindowStatus");
    expect(body).toContain("protectedRenderStatus");
    expect(body).toContain("reviewerAssignmentStatus");
    expect(body).toContain("secondReviewStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProtectedReviewLog");
    expect(body).not.toContain("protectedReviewerValidationPayload");
    expect(body).not.toContain("reviewerAssignmentPayload");
    expect(body).not.toContain("secondReviewPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProtectedReviewLog");
    expect(document.body.textContent).not.toContain("protectedReviewerValidationPayload");
    expect(document.body.textContent).not.toContain("reviewerAssignmentPayload");
    expect(document.body.textContent).not.toContain("secondReviewPayload");
  });

  it("posts protected reviewer governance review without patient delivery or reviewer asset leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Protected reviewer governance" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать protected reviewer governance/ }));
    await screen.findByText(/Protected reviewer governance metadata сохранён/);

    const governanceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-governance")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(governanceCall).toBeTruthy();
    const body = String((governanceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("reviewerMonitoringStatus");
    expect(body).toContain("reviewerExceptionStatus");
    expect(body).toContain("reviewerRollbackStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProtectedReviewerLog");
    expect(body).not.toContain("protectedReviewerGovernancePayload");
    expect(body).not.toContain("reviewerMonitoringPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProtectedReviewerLog");
    expect(document.body.textContent).not.toContain("protectedReviewerGovernancePayload");
    expect(document.body.textContent).not.toContain("reviewerMonitoringPayload");
  });

  it("posts protected reviewer evidence review without patient delivery or reviewer evidence leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Protected reviewer evidence" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать protected reviewer evidence/ }));
    await screen.findByText(/Protected reviewer evidence metadata сохранён/);

    const evidenceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/protected-reviewer-evidence")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(evidenceCall).toBeTruthy();
    const body = String((evidenceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("reviewerMonitoringEvidenceStatus");
    expect(body).toContain("reviewerExceptionEvidenceStatus");
    expect(body).toContain("reviewerRollbackEvidenceStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProtectedReviewerEvidenceLog");
    expect(body).not.toContain("protectedReviewerEvidencePayload");
    expect(body).not.toContain("reviewerMonitoringEvidencePayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProtectedReviewerEvidenceLog");
    expect(document.body.textContent).not.toContain("protectedReviewerEvidencePayload");
    expect(document.body.textContent).not.toContain("reviewerMonitoringEvidencePayload");
  });

  it("posts production dataset evidence review without patient delivery or production-operation leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Production dataset evidence" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать production dataset evidence/ }));
    await screen.findByText(/Production dataset evidence metadata сохранён/);

    const evidenceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/longitudinal-timeline-rollout/production-dataset-evidence")
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(evidenceCall).toBeTruthy();
    const body = String((evidenceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("realClinicWindowStatus");
    expect(body).toContain("datasetSamplingStatus");
    expect(body).toContain("longitudinalFollowupStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProductionDatasetEvidenceLog");
    expect(body).not.toContain("productionDatasetEvidencePayload");
    expect(body).not.toContain("clinicOperationPayload");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProductionDatasetEvidenceLog");
    expect(document.body.textContent).not.toContain("productionDatasetEvidencePayload");
    expect(document.body.textContent).not.toContain("clinicOperationPayload");
  });

  it("posts production reviewer governance review without patient delivery or reviewer identity leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Production reviewer governance" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать production reviewer governance/ }));
    await screen.findByText(/Production reviewer governance metadata сохранён/);

    const governanceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith(
          "/api/v1/visits/live-visit/longitudinal-timeline-rollout/production-reviewer-governance",
        )
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(governanceCall).toBeTruthy();
    const body = String((governanceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("productionReviewerAssignmentStatus");
    expect(body).toContain("productionSecondReviewStatus");
    expect(body).toContain("productionAdjudicationStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProductionReviewerGovernanceLog");
    expect(body).not.toContain("productionReviewerGovernancePayload");
    expect(body).not.toContain("reviewerName");
    expect(body).not.toContain("reviewerEmail");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProductionReviewerGovernanceLog");
    expect(document.body.textContent).not.toContain("productionReviewerGovernancePayload");
    expect(document.body.textContent).not.toContain("reviewerName");
    expect(document.body.textContent).not.toContain("reviewerEmail");
  });

  it("posts production reviewer evidence review without patient delivery or reviewer identity leaks", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Production reviewer evidence" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Зафиксировать production reviewer evidence/ }));
    await screen.findByText(/Production reviewer evidence metadata сохранён/);

    const evidenceCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith(
          "/api/v1/visits/live-visit/longitudinal-timeline-rollout/production-reviewer-evidence",
        )
        && (requestInit as RequestInit | undefined)?.method === "PATCH",
    );
    expect(evidenceCall).toBeTruthy();
    const body = String((evidenceCall?.[1] as RequestInit | undefined)?.body);
    expect(body).toContain("in_review");
    expect(body).toContain("productionReviewerAssignmentStatus");
    expect(body).toContain("productionSecondReviewStatus");
    expect(body).toContain("productionAdjudicationStatus");
    expect(body).not.toContain("dynamicConclusion");
    expect(body).not.toContain("pairKey");
    expect(body).not.toContain("imageIds");
    expect(body).not.toContain("rawProductionReviewerEvidenceLog");
    expect(body).not.toContain("productionReviewerEvidencePayload");
    expect(body).not.toContain("reviewerName");
    expect(body).not.toContain("reviewerEmail");
    expect(document.body.textContent).not.toContain("dynamicConclusion");
    expect(document.body.textContent).not.toContain("pairKey");
    expect(document.body.textContent).not.toContain("imageIds");
    expect(document.body.textContent).not.toContain("rawProductionReviewerEvidenceLog");
    expect(document.body.textContent).not.toContain("productionReviewerEvidencePayload");
    expect(document.body.textContent).not.toContain("reviewerName");
    expect(document.body.textContent).not.toContain("reviewerEmail");
  });

  it("posts policy governance updates for photo release in production report tab", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=report");

    expect(await screen.findByRole("region", { name: "Проверка политики выдачи фото" })).toBeInTheDocument();
    const retention = screen.getByLabelText(/Утверждён срок доступа \(retention\)/);
    fireEvent.click(retention);
    const patientCopy = screen.getByLabelText(/Проверен patient-safe текст для фото-протокола/);
    fireEvent.click(patientCopy);
    const fileProxy = screen.getByLabelText(/Включён защищённый file-proxy/);
    fireEvent.click(fileProxy);
    fireEvent.change(screen.getByLabelText("Photo policy expires at"), {
      target: { value: "2026-06-25T12:00:00.000Z" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить политику выдачи/ }));
    await screen.findByText(/Политика выдачи фото сохранена в self-hosted backend/);

    const policyCall = fetchMock.mock.calls.find(
      ([url, requestInit]) =>
        String(url).endsWith("/api/v1/visits/live-visit/patient-photo-protocol-release/policy")
        && (requestInit as RequestInit | undefined)?.method === "POST",
    );
    expect(policyCall).toBeTruthy();
  });

  it("saves production assessment, conclusion and report through self-hosted backend contracts", async () => {
    const fetchMock = createLiveWorkspaceFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    renderAt("/patients/live-patient/visits/live-visit?tab=assessment");

    expect(await screen.findByText(/Self-hosted assessment contract/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Assessment summary"), {
      target: { value: "Updated assessment" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить в self-hosted backend/ }));
    await screen.findByText(/Production clinical workspace сохранён/);

    selectTab(/Заключение/);
    expect(await screen.findByText(/Self-hosted conclusion contract/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Conclusion summary"), {
      target: { value: "Updated conclusion" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить в self-hosted backend/ }));
    await screen.findByText(/Production clinical workspace сохранён/);

    selectTab(/Отчёт/);
    expect(await screen.findByText(/Self-hosted report contract/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Report physician text"), {
      target: { value: "Updated report" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Сохранить в self-hosted backend/ }));
    await screen.findByText(/Production clinical workspace сохранён/);

    const patchUrls = fetchMock.mock.calls
      .filter(([, init]) => (init as RequestInit | undefined)?.method === "PATCH")
      .map(([url]) => String(url));
    expect(patchUrls).toContain("http://localhost:8080/api/v1/visits/live-visit/assessment");
    expect(patchUrls).toContain("http://localhost:8080/api/v1/visits/live-visit/conclusion");
    expect(patchUrls).toContain("http://localhost:8080/api/v1/visits/live-visit/report");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toContain(
      "http://localhost:8080/api/v1/visits/live-visit/report-package",
    );
  });

  it("disables local demo lesion placement in production Body Map", async () => {
    renderAt("/patients/live-patient/visits/live-visit?tab=bodymap");

    expect((await screen.findAllByText(/Live lesion A/)).length).toBeGreaterThan(0);
    const svg = screen.getByRole("img", { name: /Body map/ }) as unknown as SVGSVGElement;
    (svg as unknown as HTMLElement).getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 400, width: 200, height: 400, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    fireEvent.click(svg, { clientX: 100, clientY: 200 });

    expect(screen.getByText(/локальное демо-добавление очага отключено/)).toBeInTheDocument();
    expect(screen.queryByText(/Новый очаг \(демо\)/)).toBeNull();
    expect(screen.queryByRole("button", { name: /Добавить локально/ })).toBeNull();
  });
});
