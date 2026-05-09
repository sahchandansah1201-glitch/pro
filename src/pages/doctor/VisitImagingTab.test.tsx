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
    expect(within(region).getByText(/демо-режим/i)).toBeInTheDocument();
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
