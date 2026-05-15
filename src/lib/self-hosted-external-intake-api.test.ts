import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedExternalIntakeStatus,
  listSelfHostedExternalIntakeImports,
  toSelfHostedExternalIntakeImportBatchesPage,
  toSelfHostedExternalIntakeStatus,
} from "@/lib/self-hosted-external-intake-api";

describe("self-hosted-external-intake-api · Stage 5Q", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("normalizes import batch pages", () => {
    const page = toSelfHostedExternalIntakeImportBatchesPage({
      items: [{
        id: "batch-1",
        sourceSystem: "clinic_crm",
        itemCount: "2",
        acceptedBookingCount: 1,
        acceptedSlotCount: "1",
        rejectedCount: "0",
        duplicateCount: "1",
        hardeningVersion: "stage5t",
        clinic: { id: "clinic-1", name: "Clinic" },
      }],
      count: "1",
      limit: "10",
      offset: "0",
      filters: { sourceSystem: "clinic_crm" },
    });

    expect(page.items[0].sourceSystem).toBe("clinic_crm");
    expect(page.items[0].itemCount).toBe(2);
    expect(page.items[0].duplicateCount).toBe(1);
    expect(page.items[0].hardeningVersion).toBe("stage5t");
    expect(page.filters.sourceSystem).toBe("clinic_crm");
  });

  it("normalizes and fetches external intake hardening status", async () => {
    const status = toSelfHostedExternalIntakeStatus({
      sourceSystem: "all",
      recentBatchCount: "3",
      rejectedLast24h: "1",
      duplicateLast24h: "2",
      openBookingRequestCount: "4",
      availableSlotCount: "5",
      storedRawPayload: false,
      runtimeCallsExternalSystems: false,
      hardeningVersion: "stage5t",
      latestBySource: [{ sourceSystem: "ads", duplicateCount: "2" }],
    });
    expect(status.recentBatchCount).toBe(3);
    expect(status.duplicateLast24h).toBe(2);
    expect(status.runtimeCallsExternalSystems).toBe(false);
    expect(status.latestBySource[0].duplicateCount).toBe(2);

    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ item: status }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSelfHostedExternalIntakeStatus({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "stage5t-token",
      sourceSystem: "ads",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.hardeningVersion).toBe("stage5t");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/integrations/booking-imports/status?sourceSystem=ads",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5t-token",
        },
      },
    );
  });

  it("calls /api/v1/integrations/booking-imports with bearer token and filters", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            items: [{ id: "batch-1", sourceSystem: "ads", itemCount: 1 }],
            count: 1,
            limit: 5,
            offset: 0,
            filters: { sourceSystem: "ads" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSelfHostedExternalIntakeImports({
      apiBaseUrl: "https://clinic.local/",
      apiToken: "stage5q-token",
      sourceSystem: "ads",
      limit: 5,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.items[0].id).toBe("batch-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://clinic.local/api/v1/integrations/booking-imports?sourceSystem=ads&limit=5",
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: "Bearer stage5q-token",
        },
      },
    );
  });

  it("returns not_configured without a bearer token", async () => {
    const result = await listSelfHostedExternalIntakeImports({
      apiBaseUrl: "https://clinic.local",
      apiToken: null,
    });

    expect(result.ok).toBe(false);
    expect(result.error.code).toBe("not_configured");
  });
});
