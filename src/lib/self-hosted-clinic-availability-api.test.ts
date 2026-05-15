import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listSelfHostedClinicAvailableSlots,
  toSelfHostedClinicAvailableSlotsPage,
} from "@/lib/self-hosted-clinic-availability-api";

describe("self-hosted-clinic-availability-api · Stage 5R", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes local clinic availability slot pages", () => {
    const page = toSelfHostedClinicAvailableSlotsPage({
      items: [{
        id: "slot-1",
        sourceSystem: "clinic_crm",
        externalSlotId: "crm-slot-1",
        startedAt: "2026-06-01T09:00:00.000Z",
        durationMinutes: "30",
        status: "available",
        clinic: { id: "clinic-1", name: "Clinic" },
        doctor: { displayName: "Dr Live" },
      }],
      count: "1",
      limit: "20",
      offset: "0",
      filters: { sourceSystem: "clinic_crm", status: "available" },
    });

    expect(page.items[0].sourceSystem).toBe("clinic_crm");
    expect(page.items[0].durationMinutes).toBe(30);
    expect(page.items[0].doctor.displayName).toBe("Dr Live");
    expect(page.filters.status).toBe("available");
  });

  it("calls /api/v1/clinic/available-slots with bearer token and filters", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [{ id: "slot-1", sourceSystem: "clinic_crm", externalSlotId: "crm-slot-1" }],
            count: 1,
            limit: 5,
            offset: 0,
            filters: { sourceSystem: "clinic_crm", status: "available" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSelfHostedClinicAvailableSlots({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "stage5r-token",
      sourceSystem: "clinic_crm",
      status: "available",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.items[0].id).toBe("slot-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/clinic/available-slots?sourceSystem=clinic_crm&status=available&limit=5",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5r-token",
        },
      },
    );
  });

  it("returns not_configured without a bearer token", async () => {
    const result = await listSelfHostedClinicAvailableSlots({
      apiBaseUrl: "https://clinic.local",
      apiToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("not_configured");
  });
});

