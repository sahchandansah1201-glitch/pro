import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import OperatorConsolePage from "@/pages/operator/OperatorConsolePage";

vi.mock("@/lib/app-mode", () => ({
  isProductionAppMode: () => true,
}));

vi.mock("@/lib/self-hosted-api-session", () => ({
  isSelfHostedApiConfigured: (session: { status: string; apiToken: string | null }) =>
    session.status === "configured" && Boolean(session.apiToken),
  useSelfHostedApiSession: () => ({
    apiBaseUrl: "https://clinic.local",
    apiToken: "stage5m-token",
    status: "configured",
    user: {
      id: "operator-1",
      displayName: "Ольга Оператор",
      roles: ["operator"],
    },
  }),
}));

const overview = {
  stage: "5M",
  source: "postgres",
  kpis: {
    leadsTotal: 1,
    newLeads: 1,
    qualifiedLeads: 0,
    bookedLeads: 0,
    plannedAppointments: 1,
    completedAppointments: 0,
  },
  leads: [
    {
      id: "lead-live-1",
      clinicId: "clinic-1",
      patientId: "patient-1",
      source: "operator",
      status: "new",
      safeSummary: "Новая production заявка",
      createdAt: "2026-05-15T09:00:00.000Z",
      updatedAt: "2026-05-15T09:00:00.000Z",
      patient: {
        id: "patient-1",
        fullName: "Live Intake Patient",
        code: "DP-LIVE-0001",
      },
      clinic: {
        id: "clinic-1",
        slug: "derma-pro",
        name: "Дерма-Про",
      },
    },
  ],
  appointments: [
    {
      id: "visit-live-1",
      visitId: "visit-live-1",
      clinicId: "clinic-1",
      patientId: "patient-1",
      doctorUserId: "doctor-1",
      status: "planned",
      channel: "self_hosted",
      slotAt: "2026-05-16T09:30:00.000Z",
      signedAt: null,
      chiefComplaint: "Новая production заявка",
      patient: {
        id: "patient-1",
        fullName: "Live Intake Patient",
        code: "DP-LIVE-0001",
      },
      clinic: {
        id: "clinic-1",
        slug: "derma-pro",
        name: "Дерма-Про",
      },
    },
  ],
  filters: {
    leadStatus: "all",
    appointmentStatus: "all",
    dateFrom: null,
    dateTo: null,
    search: null,
  },
};

function json(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  );
}

function renderProductionConsole() {
  return render(
    <MemoryRouter>
      <OperatorConsolePage />
    </MemoryRouter>,
  );
}

describe("OperatorConsolePage · Stage 5M production intake", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("loads operator intake from self-hosted leads/appointments and hides demo dialog console", async () => {
    const fetchMock = vi.fn(() => json(overview));
    vi.stubGlobal("fetch", fetchMock);

    renderProductionConsole();

    expect(await screen.findByText("Production intake queue")).toBeInTheDocument();
    expect(screen.getAllByText("Live Intake Patient").length).toBeGreaterThan(0);
    expect(screen.getByText(/self-hosted backend \/api\/v1\/leads\/appointments/i)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("bd-001");
    expect(document.body).not.toHaveTextContent("Защищённая ссылка");
    expect(document.body).not.toHaveTextContent("Демо-режим");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/leads/appointments?limit=20",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5m-token",
        },
      },
    );
  });

  it("creates, qualifies, books and marks leads lost through self-hosted backend only", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith("/api/v1/leads") && init?.method === "POST") {
        return json(
          {
            item: {
              ...overview.leads[0],
              id: "lead-created-1",
              safeSummary: "Создано оператором",
            },
          },
          201,
        );
      }
      if (href.endsWith("/api/v1/leads/lead-live-1") && init?.method === "PATCH") {
        const payload = JSON.parse(String(init.body ?? "{}")) as { status?: string };
        return json({
          item: {
            ...overview.leads[0],
            status: payload.status ?? "qualified",
          },
        });
      }
      if (href.endsWith("/api/v1/leads/lead-live-1/book-appointment") && init?.method === "POST") {
        return json(
          {
            item: {
              ...overview.leads[0],
              status: "booked",
            },
            appointment: overview.appointments[0],
          },
          201,
        );
      }
      return json(overview);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderProductionConsole();
    await waitFor(() => {
      expect(screen.getAllByText("Live Intake Patient").length).toBeGreaterThan(0);
    });

    fireEvent.change(screen.getByLabelText("Безопасное резюме лида"), {
      target: { value: "Создано оператором" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Создать лид" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer stage5m-token",
            "Content-Type": "application/json",
          }),
        }),
      );
    });
    expect(await screen.findByText(/Лид lead-created-1 создан/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Квалифицировать лид lead-live-1" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads/lead-live-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "qualified" }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Записать лид lead-live-1" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads/lead-live-1/book-appointment",
        expect.objectContaining({ method: "POST" }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Пометить лид потерянным lead-live-1" }));
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "https://clinic.local/api/v1/leads/lead-live-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "lost" }),
        }),
      );
    });
  });
});
