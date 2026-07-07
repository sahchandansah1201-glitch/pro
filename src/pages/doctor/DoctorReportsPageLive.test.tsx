import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import DoctorReportsPageLive from "./DoctorReportsPageLive";

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: () => true,
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "token-reports",
    status: "configured",
    user: { id: "u-1", displayName: "Ирина Соколова", roles: ["doctor"] },
  }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <DoctorReportsPageLive />
    </MemoryRouter>,
  );
}

describe("DoctorReportsPageLive", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads report queue from clinic visits without showing demo or technical copy", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [
            {
              id: "visit-live-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              doctorUserId: "doctor-1",
              status: "in_progress",
              startedAt: "2026-07-07T10:00:00.000Z",
              signedAt: null,
              chiefComplaint: "Контрольная проверка отчёта",
              patient: {
                id: "patient-1",
                fullName: "Пациент отчёта",
                code: "DP-2026-100",
              },
              clinic: {
                id: "clinic-1",
                slug: "main",
                name: "Клиника отчётов",
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

    renderPage();

    expect(await screen.findByRole("heading", { name: "Отчёты" })).toBeInTheDocument();
    expect(screen.getByText("Пациент отчёта")).toBeInTheDocument();
    expect(screen.getByText("Черновик открыт")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть отчёт в визите" })).toHaveAttribute(
      "href",
      "/patients/patient-1/visits/visit-live-1?tab=report",
    );
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/visits?limit=50", {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer token-reports",
      },
    });
    expect(document.body.textContent).not.toMatch(
      /Учебный режим|учебная роль|учебная очередь|демо|mock|backend|self-hosted|PostgreSQL|storagePath|signedUrl|accessToken|qrToken|sessionId|credential/i,
    );
  });
});
