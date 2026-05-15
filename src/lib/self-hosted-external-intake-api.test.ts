import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listSelfHostedExternalIntakeImports,
  toSelfHostedExternalIntakeImportBatchesPage,
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
        clinic: { id: "clinic-1", name: "Clinic" },
      }],
      count: "1",
      limit: "10",
      offset: "0",
      filters: { sourceSystem: "clinic_crm" },
    });

    expect(page.items[0].sourceSystem).toBe("clinic_crm");
    expect(page.items[0].itemCount).toBe(2);
    expect(page.filters.sourceSystem).toBe("clinic_crm");
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
