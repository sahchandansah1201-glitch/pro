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

describe("VisitsPage · Stage 5J clinic schedule", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads visit schedule from the clinic system without showing technical copy", async () => {
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
                fullName: "Пациент из системы",
                code: "Карта 205",
              },
              clinic: {
                id: "10000000-0000-4000-8000-000000000001",
                slug: "main",
                name: "Клиника Север",
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

    expect((await screen.findAllByText("Пациент из системы")).length).toBeGreaterThan(0);
    expect(screen.getByText(/Данные загружаются из системы клиники/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Что делать с визитами сейчас" })).toBeInTheDocument();
    expect(screen.getByText("Клиника Север")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Иванова Наталья Олеговна");
    expect(document.body.textContent).not.toMatch(
      /self-hosted|backend|production|mock|demo|демо|metadata|workflow|policy|evidence|rollout|monitoring|validation|raw ID|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/visits?limit=50", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer token-5j",
      },
    });
  });
});
