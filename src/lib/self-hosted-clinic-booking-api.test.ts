import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedClinicBookingRequest,
  listSelfHostedClinicBookingRequests,
  toSelfHostedClinicBookingRequestsPage,
  updateSelfHostedClinicBookingRequest,
} from "@/lib/self-hosted-clinic-booking-api";

describe("self-hosted-clinic-booking-api · Stage 5P", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes clinic booking request pages safely", () => {
    const page = toSelfHostedClinicBookingRequestsPage({
      items: [{
        id: "request-1",
        status: "requested",
        patient: { fullName: "Live Patient", code: "DP-1" },
        assignedVisitId: "visit-1",
        assignedVisit: { id: "visit-1", status: "planned" },
      }],
      count: "3",
      limit: "25",
      offset: 0,
      filters: { status: "requested", search: "Live" },
    });

    expect(page.count).toBe(3);
    expect(page.items[0].patient.code).toBe("DP-1");
    expect(page.items[0].assignedVisit?.status).toBe("planned");
    expect(page.filters.search).toBe("Live");
  });

  it("lists, reads and updates booking requests with bearer token", async () => {
    const fetchMock = vi.fn((url: string | URL | Request, init?: RequestInit) => {
      const href = String(url);
      if (href.includes("/api/v1/clinic/booking-requests/request-1") && init?.method === "PATCH") {
        return Promise.resolve(new Response(
          JSON.stringify({ item: { id: "request-1", status: "reviewing", clinicNote: "Позвонить" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ));
      }
      if (href.includes("/api/v1/clinic/booking-requests/request-1")) {
        return Promise.resolve(new Response(
          JSON.stringify({ item: { id: "request-1", status: "requested" } }),
          { status: 200, headers: { "content-type": "application/json" } },
        ));
      }
      return Promise.resolve(new Response(
        JSON.stringify({ items: [{ id: "request-1", status: "requested" }], count: 1, limit: 10, offset: 0 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ));
    });
    vi.stubGlobal("fetch", fetchMock);

    const base = { apiBaseUrl: "https://clinic.local/", apiToken: "stage5p-token" };
    const list = await listSelfHostedClinicBookingRequests({
      ...base,
      status: "requested",
      search: "контроль",
      limit: 10,
    });
    const detail = await getSelfHostedClinicBookingRequest({ ...base, requestId: "request-1" });
    const update = await updateSelfHostedClinicBookingRequest({
      ...base,
      requestId: "request-1",
      payload: { status: "reviewing", clinicNote: "Позвонить" },
    });

    expect(list.value?.items[0].id).toBe("request-1");
    expect(detail.value?.status).toBe("requested");
    expect(update.value?.clinicNote).toBe("Позвонить");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/clinic/booking-requests?status=requested&search=%D0%BA%D0%BE%D0%BD%D1%82%D1%80%D0%BE%D0%BB%D1%8C&limit=10",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5p-token",
        },
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/clinic/booking-requests/request-1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("returns not_configured without token", async () => {
    const result = await listSelfHostedClinicBookingRequests({ apiBaseUrl: "https://clinic.local", apiToken: null });
    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("not_configured");
  });
});
