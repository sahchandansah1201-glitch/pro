import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { SELF_HOSTED_API_BASE_URL_KEY, SELF_HOSTED_API_TOKEN_KEY } from "@/lib/self-hosted-api-session";
import {
  clinicalBodyAtlasManifestSha256,
  clinicalBodyRegionMapSha256,
} from "@/lib/clinical-body-atlas";

const apiSessionMock = vi.hoisted(() => ({
  current: { apiToken: null as string | null, apiBaseUrl: null as string | null },
}));
vi.mock("@/lib/api-session", () => ({ useApiSession: () => apiSessionMock.current }));

import VisitWorkspacePage from "./VisitWorkspacePage";

const json = (value: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(value), {
  status,
  headers: { "Content-Type": "application/json" },
}));

type BodyMapPayload = {
  label?: string;
  status?: string;
  bodyMap?: {
    atlasSource: string;
    atlasProfileId: string;
    view: string;
    x: number;
    y: number;
    regionId: string;
    detailId?: string;
  };
};

function lesion(
  payload: BodyMapPayload,
  revision: number,
  bindingOverrides: Record<string, unknown> = {},
) {
  return {
    id: revision === 1 ? "live-lesion-created" : "live-lesion",
    clinicId: "clinic-1",
    patientId: "live-patient",
    visitId: "live-visit",
    label: payload.label ?? "Очаг из клиники A",
    bodyZone: "Тыльная поверхность 5-го пальца (мизинца) правой стопы",
    bodySurface: "anterior",
    status: payload.status ?? "active",
    bodyRegionId: payload.bodyMap?.regionId ?? "front-right-toes",
    bodyRegionDetailId: payload.bodyMap?.detailId ?? "digit-5",
    bodyAtlasSource: "daz-hires-local",
    bodyAtlasProfileId: "adult_female_30",
    bodyAtlasManifestSha256: clinicalBodyAtlasManifestSha256(),
    bodyRegionMapSha256: clinicalBodyRegionMapSha256(
      { ageBand: "adult", sex: "female" },
      payload.bodyMap?.view === "scalp" ? "scalp" : "front",
    ),
    mapPoint: payload.bodyMap
      ? { view: payload.bodyMap.view, x: payload.bodyMap.x, y: payload.bodyMap.y }
      : { view: "front", x: 0.38958, y: 0.7875 },
    placementRevision: revision,
    ...bindingOverrides,
  };
}

function fetchMock(bindingOverrides: Record<string, unknown> = {}) {
  return vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    const href = String(url);
    const method = (init?.method ?? "GET").toUpperCase();
    if (href.endsWith("/api/v1/visits/live-visit")) {
      return json({ item: {
        id: "live-visit",
        clinicId: "clinic-1",
        patientId: "live-patient",
        doctorUserId: "doctor-1",
        status: "in_progress",
        startedAt: "2026-08-21T12:00:00.000Z",
        signedAt: null,
        chiefComplaint: "контроль",
        createdAt: "2026-08-21T11:00:00.000Z",
        updatedAt: "2026-08-21T12:00:00.000Z",
        patient: {
          id: "live-patient",
          fullName: "Петрова Анна",
          code: "DP-live-001",
          birthDate: "1990-01-01",
          sex: "female",
          phototype: "II",
          imagingConsent: true,
        },
        clinic: { id: "clinic-1", slug: "live", name: "Клиника" },
      } });
    }
    if (href.endsWith("/api/v1/visits/live-visit/lesions")) {
      if (method === "POST") {
        const payload = JSON.parse(String(init?.body ?? "{}"));
        return json({ item: lesion(payload, 1) }, 201);
      }
      return json({ items: [lesion({}, 1, bindingOverrides)] });
    }
    if (href.endsWith("/api/v1/lesions/live-lesion-created") && method === "PATCH") {
      const payload = JSON.parse(String(init?.body ?? "{}"));
      return json({ item: lesion(payload, payload.expectedPlacementRevision + 1) });
    }
    if (href.endsWith("/api/v1/visits/live-visit/assets")) return json({ items: [] });
    return json({ items: [] });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/patients/live-patient/visits/live-visit?tab=bodymap"]}>
      <Routes>
        <Route path="/patients/:id/visits/:visitId" element={<VisitWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function markAtlasReady() {
  fireEvent.load(document.querySelector('[data-part="atlas-image"]') as SVGImageElement);
}

describe("VisitWorkspacePage · production body-map persistence", () => {
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

  it("saves a precise doctor-confirmed placement with an idempotency key", async () => {
    const request = fetchMock();
    vi.stubGlobal("fetch", request);
    renderPage();

    expect((await screen.findAllByText(/Очаг из клиники A/)).length).toBeGreaterThan(0);
    markAtlasReady();
    expect(document.querySelector('[data-marker-id="live-lesion-created"]')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Выбрать анатомическую область"), { target: { value: "front-right-toes" } });
    fireEvent.change(screen.getByLabelText("Уточнить палец стопы"), { target: { value: "digit-5" } });
    fireEvent.change(screen.getByLabelText("Метка очага"), { target: { value: "Очаг на мизинце" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить в системе клиники" }));

    expect(await screen.findByText("Очаг сохранён в системе клиники.")).toBeInTheDocument();
    const createCall = request.mock.calls.find(([url, init]) =>
      String(url).endsWith("/api/v1/visits/live-visit/lesions") && init?.method === "POST");
    expect((createCall?.[1] as RequestInit).headers).toMatchObject({
      Authorization: "Bearer local-jwt",
      "Idempotency-Key": expect.any(String),
    });
    expect(JSON.parse(String((createCall?.[1] as RequestInit).body))).toMatchObject({
      label: "Очаг на мизинце",
      bodyMap: {
        atlasSource: "daz-hires-local",
        atlasProfileId: "adult_female_30",
        view: "front",
        regionId: "front-right-toes",
        detailId: "digit-5",
      },
    });
  });

  it("corrects a saved placement with optimistic revision protection", async () => {
    const request = fetchMock();
    vi.stubGlobal("fetch", request);
    renderPage();

    expect((await screen.findAllByText(/Очаг из клиники A/)).length).toBeGreaterThan(0);
    markAtlasReady();
    fireEvent.click(await screen.findByRole("button", { name: "Исправить положение" }));
    fireEvent.change(screen.getByLabelText("Выбрать анатомическую область"), { target: { value: "front-right-toes" } });
    fireEvent.change(screen.getByLabelText("Уточнить палец стопы"), { target: { value: "digit-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Сохранить исправление" }));

    expect(await screen.findByText("Положение очага исправлено в системе клиники.")).toBeInTheDocument();
    const patchCall = request.mock.calls.find(([url, init]) =>
      String(url).endsWith("/api/v1/lesions/live-lesion-created") && init?.method === "PATCH");
    expect(JSON.parse(String((patchCall?.[1] as RequestInit).body))).toMatchObject({
      expectedPlacementRevision: 1,
      bodyMap: {
        atlasSource: "daz-hires-local",
        atlasProfileId: "adult_female_30",
        view: "front",
        regionId: "front-right-toes",
        detailId: "digit-5",
      },
    });
  });

  it("keeps a hash-mismatched lesion in the list but hides its exact marker", async () => {
    const request = fetchMock({ bodyAtlasManifestSha256: "a".repeat(64) });
    vi.stubGlobal("fetch", request);
    renderPage();

    expect((await screen.findAllByText(/Очаг из клиники A/)).length).toBeGreaterThan(0);
    expect(screen.getByText("Точное положение требует уточнения")).toBeInTheDocument();
    expect(document.querySelector("[data-marker-id]")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Уточнить положение" }));
    expect(screen.getByText("Укажите новое точное место на модели и подтвердите анатомическую область."))
      .toBeInTheDocument();
  });
});
