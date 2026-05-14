import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DeskPage from "@/pages/doctor/DeskPage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: () => true,
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "token-5i",
    status: "configured",
    user: { id: "u-1", displayName: "Ирина Соколова", roles: ["doctor"] },
  }),
}));

describe("DeskPage · Stage 5I production dashboard", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads production dashboard from self-hosted backend without mock fallback", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "5I",
          source: "postgres",
          dashboard: {
            kpis: {
              visitsToday: 2,
              activeVisits: 3,
              awaitingConclusion: 1,
              patientsInScope: 8,
              assetsNeedReview: 4,
              devicesTotal: 2,
              devicesActive30d: 1,
            },
            upcoming: [
              {
                id: "10000000-0000-4000-8000-000000000301",
                patientId: "10000000-0000-4000-8000-000000000201",
                patientFullName: "Live Patient",
                patientCode: "DP-LIVE-1",
                clinicName: "Live Clinic",
                status: "in_progress",
                startedAt: "2026-05-15T09:00:00.000Z",
                chiefComplaint: "Контроль",
              },
            ],
            awaitingConclusions: [],
            recentPatients: [
              {
                id: "10000000-0000-4000-8000-000000000201",
                fullName: "Live Patient",
                code: "DP-LIVE-1",
                sex: "female",
                lastVisitAt: "2026-05-15T09:00:00.000Z",
              },
            ],
            assetIssues: [
              {
                id: "asset-live-1",
                visitId: "10000000-0000-4000-8000-000000000301",
                patientId: "10000000-0000-4000-8000-000000000201",
                patientFullName: "Live Patient",
                kind: "dermoscopy",
                issue: "checksum_missing",
              },
            ],
            devices: [{ id: "d-1", model: "DermLite Live", serial: "DL-LIVE", status: "active" }],
          },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter>
        <DeskPage />
      </MemoryRouter>,
    );

    expect(await screen.findAllByText("Live Patient")).toHaveLength(3);
    expect(screen.getByText(/Источник данных: self-hosted backend/)).toBeInTheDocument();
    expect(screen.getByText("DermLite Live")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Иванова Наталья Олеговна");
    expect(document.body.textContent).not.toContain("Демо-режим");
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/doctor/dashboard", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer token-5i",
      },
    });
  });
});
