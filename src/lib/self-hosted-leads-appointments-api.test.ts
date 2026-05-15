import { describe, expect, it, vi, afterEach } from "vitest";

import {
  listSelfHostedLeadsAppointments,
  toSelfHostedLeadsAppointmentsOverview,
} from "@/lib/self-hosted-leads-appointments-api";

describe("self-hosted-leads-appointments-api · Stage 5K", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes overview safely", () => {
    const overview = toSelfHostedLeadsAppointmentsOverview({
      kpis: {
        leadsTotal: "6",
        newLeads: 2,
        qualifiedLeads: 2,
        bookedLeads: 1,
        plannedAppointments: "3",
        completedAppointments: 4,
      },
      leads: [{ id: "lead-1", source: "site", status: "new", safeSummary: "Новая заявка" }],
      appointments: [{ id: "visit-1", visitId: "visit-1", status: "planned", patient: { fullName: "Live Patient" } }],
    });

    expect(overview.kpis.leadsTotal).toBe(6);
    expect(overview.kpis.plannedAppointments).toBe(3);
    expect(overview.leads[0].safeSummary).toBe("Новая заявка");
    expect(overview.appointments[0].patient.fullName).toBe("Live Patient");
  });

  it("calls /api/v1/leads/appointments with bearer token and filters", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          stage: "5K",
          source: "postgres",
          kpis: { leadsTotal: 1, newLeads: 1, qualifiedLeads: 0, bookedLeads: 0, plannedAppointments: 1, completedAppointments: 0 },
          leads: [{ id: "lead-1", source: "site", status: "new" }],
          appointments: [{ id: "visit-1", visitId: "visit-1", status: "planned" }],
          filters: { leadStatus: "new", appointmentStatus: "planned", dateFrom: "2026-05-01", dateTo: null, search: "Live" },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSelfHostedLeadsAppointments({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "token-5k",
      leadStatus: "new",
      appointmentStatus: "planned",
      dateFrom: "2026-05-01",
      search: "Live",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.kpis.leadsTotal).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/leads/appointments?leadStatus=new&appointmentStatus=planned&dateFrom=2026-05-01&search=Live&limit=5",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer token-5k",
        },
      },
    );
  });
});
