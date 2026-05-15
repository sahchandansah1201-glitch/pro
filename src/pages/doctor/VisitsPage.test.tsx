import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import VisitsPage from "@/pages/doctor/VisitsPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: () => true,
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "token-5j",
    status: "configured",
    user: { id: "u-1", displayName: "Ирина Соколова", roles: ["doctor"] },
  }),
}));

describe("VisitsPage · Stage 5J production schedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads visit schedule from self-hosted backend without demo fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "5J",
          source: "postgres",
          items: [
            {
              id: "10000000-0000-4000-8000-000000000301",
              clinicId: "10000000-0000-4000-8000-000000000001",
              patientId: "10000000-0000-4000-8000-000000000201",
              doctorUserId: "10000000-0000-4000-8000-000000000101",
              status: "draft",
              startedAt: "2026-05-15T09:00:00.000Z",
              signedAt: null,
              chiefComplaint: "Контроль",
              patient: {
                id: "10000000-0000-4000-8000-000000000201",
                fullName: "Live Schedule Patient",
                code: "DP-LIVE-S",
              },
              clinic: {
                id: "10000000-0000-4000-8000-000000000001",
                slug: "main",
                name: "Live Clinic",
              },
            },
          ],
          count: 1,
          limit: 50,
          offset: 0,
          filters: { status: "all", dateFrom: null, dateTo: null, search: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <VisitsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Live Schedule Patient")).toBeInTheDocument();
    expect(screen.getByText(/Источник данных: self-hosted backend \/api\/v1\/visits/)).toBeInTheDocument();
    expect(screen.getByText("Live Clinic")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Иванова Наталья Олеговна");
    expect(document.body.textContent).not.toContain("Демо-режим");
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/visits?limit=50", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer token-5j",
      },
    });
  });
});
