import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedVisitAssessment,
  getSelfHostedLesionLongitudinalHistory,
  saveSelfHostedLesionComparisonDraft,
  updateSelfHostedVisitAssessment,
  updateSelfHostedVisitConclusion,
  getSelfHostedVisitReport,
} from "@/lib/self-hosted-clinical-workspace-api";

describe("self-hosted-clinical-workspace-api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not_configured without a token", async () => {
    const result = await getSelfHostedVisitAssessment({
      apiBaseUrl: "http://localhost:3001",
      apiToken: null,
      visitId: "visit-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("not_configured");
  });

  it("reads assessment and maps numeric fields without protected runtime tokens", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "assessment-1",
            visitId: "visit-1",
            status: "ready",
            riskLevel: "moderate",
            abcdTotal: "3.70",
            sevenPointTotal: 2,
            summary: "контроль",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await getSelfHostedVisitAssessment({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });
    expect(result.ok).toBe(true);
    expect(result.value?.abcdTotal).toBe(3.7);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/assessment",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("patches assessment and conclusion through backend contracts", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: url.includes("assessment") ? "assessment-1" : "conclusion-1",
            visitId: "visit-1",
            status: "ready",
            summary: "готово",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const assessment = await updateSelfHostedVisitAssessment({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: { status: "ready", summary: "готово" },
    });
    const conclusion = await updateSelfHostedVisitConclusion({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: { status: "ready", summary: "готово" },
    });
    expect(assessment.ok).toBe(true);
    expect(conclusion.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "PATCH" });
  });

  it("reads report and surfaces mapped validation errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "validation_error",
              message: "Request payload failed validation.",
              details: [{ field: "summary", message: "required" }],
            },
            correlationId: "corr-1",
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const result = await getSelfHostedVisitReport({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });
    expect(result.ok).toBe(false);
    expect(result.error?.kind).toBe("validation");
    expect(result.error?.details?.[0]).toEqual({ field: "summary", message: "required" });
  });

  it("saves lesion comparison draft through metadata-only Stage 5H backend contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "draft-1",
            visitId: "visit-1",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            action: "retake",
            comparability: "not_comparable",
            reasons: ["Разные условия съёмки"],
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
            savedAt: "2026-06-02T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveSelfHostedLesionComparisonDraft({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        action: "retake",
        comparability: "not_comparable",
        reasons: ["Разные условия съёмки"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-draft",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toMatch(/storagePath|photoRef|heatmapRef|modelVersion|sharedLink|token|session/i);
  });

  it("reads lesion longitudinal history through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            patientId: "patient-1",
            lesionId: "lesion-1",
            label: "Очаг A",
            bodyZone: "Плечо",
            bodySurface: "перед",
            status: "active",
            summary: {
              visitCount: 2,
              imageCount: 4,
              candidatePairCount: 2,
              comparablePairCount: 1,
              warningPairCount: 1,
              blockedPairCount: 0,
              assessmentCount: 1,
            },
            visits: [{
              visitId: "visit-1",
              startedAt: "2026-05-19T10:31:25.000Z",
              status: "signed",
              imageCount: 2,
              dermoscopyCount: 1,
              overviewCount: 1,
              assessmentCount: 1,
              capturedAtFirst: "2026-05-19T10:40:00.000Z",
              capturedAtLast: "2026-05-19T10:45:00.000Z",
            }],
            candidatePairs: [{
              previousVisitId: "visit-0",
              currentVisitId: "visit-1",
              previousImageId: "image-a",
              currentImageId: "image-b",
              kind: "dermoscopy",
              status: "warning",
              reasons: ["missing_capture_time"],
            }],
            boundaries: {
              patientDeliveryAllowed: true,
              protectedFieldsExposed: true,
              storagePathsExposed: true,
              signedUrlsIssued: true,
              rawImageBytesExposed: true,
              doctorOnlyTextExposed: true,
              clinicalConclusionGenerated: true,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSelfHostedLesionLongitudinalHistory({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      patientId: "patient-1",
      lesionId: "lesion-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.summary.visitCount).toBe(2);
    expect(result.value?.candidatePairs[0]?.status).toBe("warning");
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(result.value?.boundaries.storagePathsExposed).toBe(false);
    expect(result.value?.boundaries.signedUrlsIssued).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patients/patient-1/lesions/lesion-1/longitudinal-history",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /object_bucket|object_key|"storagePath"\s*:|"signedUrl"\s*:|accessToken|rawToken|doctorVersionText/i,
    );
  });
});
