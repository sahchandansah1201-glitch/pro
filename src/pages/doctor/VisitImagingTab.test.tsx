// Stage 1E-E · UI tests for the API assets panel inside VisitImagingTab.
// The component preserves demo behaviour and only activates the API
// surface when an explicit token + baseUrl are passed via props.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { VisitImagingTab } from "./VisitImagingTab";
import { LESIONS, VISITS, getLesionsByPatientId } from "@/lib/mock-data";

const visit = VISITS[0];
const patientId = visit.patientId;
const lesions = getLesionsByPatientId(patientId).length > 0
  ? getLesionsByPatientId(patientId)
  : LESIONS.slice(0, 1);

function renderTab(extra: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <VisitImagingTab
        visit={visit}
        patientId={patientId}
        lesions={lesions}
        {...extra}
      />
    </MemoryRouter>,
  );
}

describe("VisitImagingTab · existing imaging surface preserved", () => {
  it("renders capture toolbar and the API assets section", () => {
    renderTab();
    expect(screen.getByText(/Захват/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /API ассеты визита/i })).toBeInTheDocument();
  });

  it("never renders a delete control on doctor imaging surface", () => {
    renderTab();
    const buttons = screen.getAllByRole("button");
    for (const b of buttons) {
      const label = (b.getAttribute("aria-label") ?? "") + " " + (b.textContent ?? "");
      expect(label.toLowerCase()).not.toMatch(/удал|delete|remove/);
    }
  });

  it("does not render raw storage path / exif labels", () => {
    const { container } = renderTab();
    const html = container.innerHTML;
    expect(html).not.toMatch(/storageObjectPath/);
    expect(html).not.toMatch(/storage_object_path/);
    expect(html).not.toMatch(/\bexif\b/i);
  });
});

describe("VisitImagingTab · API panel · demo (no token) mode", () => {
  it("shows demo-mode notice and upload click surfaces a non-blocking status", async () => {
    renderTab();
    const region = screen.getByRole("region", { name: /API ассеты визита/i });
    expect(within(region).getAllByText(/демо-режим/i).length).toBeGreaterThan(0);
    expect(within(region).getByText(/API клинических ассетов не сконфигурирован/i))
      .toBeInTheDocument();

    const uploadBtn = within(region).getByRole("button", { name: /Загрузить снимок/i });
    await userEvent.click(uploadBtn);

    expect(within(region).getByRole("status")).toHaveTextContent(
      /требует авторизованной сессии API/i,
    );
  });
});

describe("VisitImagingTab · API panel · with token", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("calls api-read on mount and shows empty state without leaking forbidden fields", async () => {
    renderTab({ apiToken: "tok", apiBaseUrl: "https://x.supabase.co" });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(
      /\/functions\/v1\/api-read\/doctor\/visits\/[^/]+\/assets$/,
    );
    expect((init as RequestInit).method).toBe("GET");

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(within(region).getByText(/В API ещё нет ассетов/i)).toBeInTheDocument();
    });
  });
});

// Stage 1I-A · Asset row rendering + signed download flow.
describe("VisitImagingTab · API panel · asset row + signed download", () => {
  const sampleAsset = {
    id: "a-1",
    clinicId: "c-1",
    visitId: visit.id,
    lesionId: null,
    kind: "dermoscopy",
    source: "device_bridge",
    capturedAt: "2026-05-09T10:00:00Z",
    deviceId: null,
    qualityScore: 0.92,
    qualityIssues: [],
    createdAt: "2026-05-09T10:00:01Z",
  };

  let fetchMock: ReturnType<typeof vi.fn>;
  let openSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn((input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes("/download-url")) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              assetId: "a-1",
              clinicId: "c-1",
              visitId: visit.id,
              downloadUrl: "https://signed.example/asset-1?sig=xyz",
              expiresIn: 300,
              expiresAt: "2026-05-09T10:05:00Z",
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify([sampleAsset]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    openSpy.mockRestore();
  });

  it("renders the asset row from api-read without leaking storage path / exif", async () => {
    const { container } = renderTab({
      apiToken: "doctor-jwt",
      apiBaseUrl: "https://abc.supabase.co",
    });

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    await waitFor(() => {
      expect(
        within(region).getByRole("button", { name: /Открыть снимок a-1/i }),
      ).toBeInTheDocument();
    });

    const html = container.innerHTML;
    expect(html).not.toMatch(/storageObjectPath/);
    expect(html).not.toMatch(/storage_object_path/);
    expect(html).not.toMatch(/\bexif\b/i);
  });

  it("clicking 'Открыть' calls download-url endpoint and opens the signed URL", async () => {
    renderTab({
      apiToken: "doctor-jwt",
      apiBaseUrl: "https://abc.supabase.co",
    });

    const region = await screen.findByRole("region", { name: /API ассеты визита/i });
    const openBtn = await within(region).findByRole("button", {
      name: /Открыть снимок a-1/i,
    });
    await userEvent.click(openBtn);

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api-read/doctor/assets/a-1/download-url"))).toBe(true);
    });

    const dlCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("/download-url"),
    )!;
    const headers = (dlCall[1] as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer doctor-jwt");

    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith(
        "https://signed.example/asset-1?sig=xyz",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });
});
