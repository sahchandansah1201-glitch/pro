import { describe, expect, it, vi, afterEach } from "vitest";

import {
  bookSelfHostedLeadAppointment,
  buildDefaultSelfHostedLeadAppointmentStartedAt,
  createSelfHostedLead,
  listSelfHostedLeadsAppointments,
  toSelfHostedLeadsAppointmentsOverview,
  updateSelfHostedLeadStatus,
} from "@/lib/self-hosted-leads-appointments-api";

describe("self-hosted-leads-appointments-api · Stage 5K/5L", () => {
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

  it("builds the default booking date outside doctor UI files", () => {
    expect(buildDefaultSelfHostedLeadAppointmentStartedAt(new Date("2026-05-15T09:30:00.000Z"))).toBe(
      "2026-05-16T09:30:00.000Z",
    );
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

  it("creates, updates and books leads with bearer token", async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
      if (url.endsWith("/api/v1/leads") && init.method === "POST") {
        return Promise.resolve(new Response(
          JSON.stringify({ item: { id: "lead-1", source: "site", status: "new", safeSummary: "Lead" } }),
          { status: 201, headers: { "content-type": "application/json" } },
        ));
      }
      if (url.endsWith("/api/v1/leads/lead-1") && init.method === "PATCH") {
        return Promise.resolve(new Response(
          JSON.stringify({ item: { id: "lead-1", source: "site", status: "qualified", safeSummary: "Lead" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ));
      }
      return Promise.resolve(new Response(
        JSON.stringify({
          item: { id: "lead-1", source: "site", status: "booked", safeSummary: "Lead" },
          appointment: { id: "visit-1", visitId: "visit-1", status: "planned" },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      ));
    });
    vi.stubGlobal("fetch", fetchMock);

    const base = { apiBaseUrl: "https://clinic.local", apiToken: "token-5l" };
    const created = await createSelfHostedLead({
      ...base,
      payload: { source: "site", safeSummary: "Lead" },
    });
    const updated = await updateSelfHostedLeadStatus({ ...base, leadId: "lead-1", status: "qualified" });
    const booked = await bookSelfHostedLeadAppointment({
      ...base,
      leadId: "lead-1",
      payload: { startedAt: "2026-05-20T09:00:00.000Z", patientId: "patient-1" },
    });

    expect(created.value?.status).toBe("new");
    expect(updated.value?.status).toBe("qualified");
    expect(booked.value?.appointment.visitId).toBe("visit-1");
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/leads", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer token-5l", "Content-Type": "application/json" }),
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/leads/lead-1", expect.objectContaining({
      method: "PATCH",
    }));
    expect(fetchMock).toHaveBeenCalledWith("https://clinic.local/api/v1/leads/lead-1/book-appointment", expect.objectContaining({
      method: "POST",
    }));
  });
});
