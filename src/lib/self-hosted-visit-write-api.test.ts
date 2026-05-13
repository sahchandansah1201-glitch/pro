import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  archiveSelfHostedVisitLesion,
  createSelfHostedVisitLesion,
  updateSelfHostedVisit,
  updateSelfHostedVisitLesion,
  updateSelfHostedVisitReport,
} from "@/lib/self-hosted-visit-write-api";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";

describe("self-hosted-visit-write-api", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns not_configured without network when token is missing", async () => {
    const result = await updateSelfHostedVisit({
      apiBaseUrl: "http://localhost:8080",
      apiToken: null,
      visitId: VISIT_ID,
      payload: { chiefComplaint: "контроль" },
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("PATCHes visit with bearer token and maps response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ item: { id: VISIT_ID, status: "in_progress", chiefComplaint: "контроль" } })),
    );
    const result = await updateSelfHostedVisit({
      apiBaseUrl: "http://localhost:8080/",
      apiToken: "token",
      visitId: VISIT_ID,
      payload: { chiefComplaint: "контроль" },
    });
    expect(result.ok).toBe(true);
    expect(result.value?.chiefComplaint).toBe("контроль");
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:8080/api/v1/visits/${VISIT_ID}`,
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("creates, updates and archives lesions through write endpoints", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { id: LESION_ID, label: "L1", status: "active" } }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { id: LESION_ID, label: "L2", riskLevel: "moderate" } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { id: LESION_ID, label: "L2", status: "archived" } })));

    const created = await createSelfHostedVisitLesion({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "token",
      visitId: VISIT_ID,
      payload: { label: "L1" },
    });
    const updated = await updateSelfHostedVisitLesion({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "token",
      lesionId: LESION_ID,
      payload: { label: "L2", riskLevel: "moderate" },
    });
    const archived = await archiveSelfHostedVisitLesion({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "token",
      lesionId: LESION_ID,
      reason: "duplicate",
    });

    expect(created.value?.label).toBe("L1");
    expect(updated.value?.riskLevel).toBe("moderate");
    expect(archived.value?.status).toBe("archived");
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      `http://localhost:8080/api/v1/visits/${VISIT_ID}/lesions`,
      `http://localhost:8080/api/v1/lesions/${LESION_ID}`,
      `http://localhost:8080/api/v1/lesions/${LESION_ID}`,
    ]);
  });

  it("updates report and maps validation errors", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ item: { id: "report-1", visitId: VISIT_ID, status: "draft", patientSafeText: "Контроль у врача." } })))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "validation_error",
              message: "Request payload failed validation.",
              details: [{ field: "status", message: "bad" }],
            },
            correlationId: "c1",
          }),
          { status: 422 },
        ),
      );

    const saved = await updateSelfHostedVisitReport({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "token",
      visitId: VISIT_ID,
      payload: { patientSafeText: "Контроль у врача." },
    });
    expect(saved.value?.patientSafeText).toBe("Контроль у врача.");

    const failed = await updateSelfHostedVisitReport({
      apiBaseUrl: "http://localhost:8080",
      apiToken: "token",
      visitId: VISIT_ID,
      payload: { status: "draft" },
    });
    expect(failed.ok).toBe(false);
    expect(failed.error?.kind).toBe("validation");
    expect(failed.error?.details?.[0].field).toBe("status");
  });
});
