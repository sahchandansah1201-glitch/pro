import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedLesionCaptureMetadata,
  getSelfHostedLesionLongitudinalQa,
  getSelfHostedVisitLesionComparisonViewerQaReviewQueue,
  getSelfHostedVisitAssessment,
  getSelfHostedLesionLongitudinalHistory,
  downloadSelfHostedProtectedLesionImage,
  saveSelfHostedAssetCaptureMetadata,
  saveSelfHostedLesionComparisonDraft,
  saveSelfHostedLesionComparisonViewerQa,
  reviewSelfHostedLesionComparisonViewerQa,
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

  it("downloads protected lesion image bytes through doctor backend proxy without URL/path exposure", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await downloadSelfHostedProtectedLesionImage({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      patientId: "patient-1",
      lesionId: "lesion-1",
      assetId: "asset-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.contentType).toBe("image/png");
    expect(result.value?.bytes.size).toBe(3);
    expect(result.value?.objectUrl).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patients/patient-1/lesions/lesion-1/images/asset-1/render",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"storagePath"\s*:|"signedUrl"\s*:|storage_object_path|signed_url|object_bucket|object_key|token|session|qr/i,
    );
  });

  it("reads and writes production capture metadata without protected fields", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new Response(
        JSON.stringify({
          item: url.includes("/patients/")
            ? {
                patientId: "patient-1",
                lesionId: "lesion-1",
                summary: {
                  assetCount: 2,
                  metadataCount: 1,
                  missingMetadataCount: 1,
                  readyForTechnicalCompareCount: 1,
                  scaleReadyCount: 0,
                },
                items: [{
                  assetId: "asset-1",
                  visitId: "visit-1",
                  kind: "dermoscopy",
                  contentType: "image/png",
                  capturedAt: "2026-05-19T10:40:00.000Z",
                  captureSource: "device_bridge",
                  deviceId: "device-1",
                  deviceProfile: "FotoFinder Handyscope · FF-screen",
                  frame: { width: 2048, height: 2048 },
                  quality: { score: 91, issues: [] },
                  calibration: { scaleMarkerDetected: false, millimetersAvailable: false },
                  technicalStatus: "ready",
                  technicalReasons: [],
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
              }
            : {
                id: "capture-metadata-1",
                visitId: "visit-1",
                assetId: "asset-1",
                captureSource: "device_bridge",
                deviceId: "device-1",
                frame: { width: 2048, height: 2048 },
                quality: { score: 91, issues: [] },
                calibration: { scaleMarkerDetected: false, millimetersAvailable: false },
                patientDeliveryAllowed: true,
                protectedFieldsExposed: true,
              },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const read = await getSelfHostedLesionCaptureMetadata({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      patientId: "patient-1",
      lesionId: "lesion-1",
    });
    const write = await saveSelfHostedAssetCaptureMetadata({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      assetId: "asset-1",
      payload: {
        captureSource: "device_bridge",
        deviceId: "device-1",
        frameWidth: 2048,
        frameHeight: 2048,
        qualityScore: 91,
        qualityIssues: [],
        scaleMarkerDetected: false,
        millimetersAvailable: false,
      },
    });

    expect(read.ok).toBe(true);
    expect(read.value?.summary.metadataCount).toBe(1);
    expect(read.value?.items[0]?.frame.width).toBe(2048);
    expect(read.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(read.value?.boundaries.storagePathsExposed).toBe(false);
    expect(write.ok).toBe(true);
    expect(write.value?.patientDeliveryAllowed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patients/patient-1/lesions/lesion-1/capture-metadata",
      expect.objectContaining({ method: "GET" }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/assets/asset-1/capture-metadata",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.stringify(read.value) + JSON.stringify(write.value)).not.toMatch(
      /object_bucket|object_key|"storagePath"\s*:|"signedUrl"\s*:|accessToken|rawToken|qrToken|sessionId|doctorVersionText/i,
    );
  });

  it("saves viewer QA marker and calibration draft through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
            calibrationStatus: "not_ready",
            calibrationReasons: ["scale_marker_missing"],
            captureMetadataStatus: "needs_review",
            medicalMeasurementAllowed: true,
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await saveSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
        calibrationStatus: "not_ready",
        calibrationReasons: ["scale_marker_missing"],
        captureMetadataStatus: "needs_review",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
  });

  it("reviews viewer QA through a separate metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "l-008",
            pairKey: "l-008:i-011+i-012",
            imageIds: ["i-011", "i-012"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
            calibrationStatus: "not_ready",
            calibrationReasons: ["scale_marker_missing"],
            captureMetadataStatus: "needs_review",
            review: {
              status: "needs_recapture",
              reasons: ["repeat_capture_required"],
              reviewedAt: "2026-05-19T10:50:00.000Z",
              reviewedByUserId: "doctor-1",
            },
            medicalMeasurementAllowed: true,
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedLesionComparisonViewerQa({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        reviewStatus: "needs_recapture",
        reviewReasons: ["repeat_capture_required"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.review.status).toBe("needs_recapture");
    expect(result.value?.review.reasons).toEqual(["repeat_capture_required"]);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/review",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
  });

  it("reads lesion longitudinal QA gate without exposing pair keys or image IDs", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            patientId: "patient-1",
            lesionId: "lesion-1",
            label: "Очаг A",
            readiness: {
              status: "blocked",
              visitCount: 2,
              imageCount: 4,
              candidatePairCount: 2,
              reviewedPairCount: 1,
              technicalReadyPairCount: 1,
              needsRecaptureCount: 1,
              notSuitableForComparisonCount: 0,
              unreviewedPairCount: 0,
              missingCaptureMetadataCount: 1,
              calibrationBlockedCount: 1,
              markerMissingCount: 1,
              technicalRolloutReady: false,
              dynamicConclusionAllowed: true,
            },
            blockers: [
              {
                code: "recapture_required",
                label: "Нужен переснимок",
                count: 1,
                nextAction: "request_recapture",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
            ],
            nextActions: ["request_recapture", "unsafe_action"],
            boundaries: {
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              pairKeysExposed: true,
              imageIdsExposed: true,
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

    const result = await getSelfHostedLesionLongitudinalQa({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      patientId: "patient-1",
      lesionId: "lesion-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.readiness.status).toBe("blocked");
    expect(result.value?.readiness.dynamicConclusionAllowed).toBe(false);
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(result.value?.boundaries.pairKeysExposed).toBe(false);
    expect(result.value?.boundaries.imageIdsExposed).toBe(false);
    expect(result.value?.nextActions).toEqual(["request_recapture"]);
    expect(JSON.stringify(result.value)).not.toMatch(
      /secret-pair|i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/patients/patient-1/lesions/lesion-1/longitudinal-qa",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
  });

  it("reads viewer QA review queue without exposing pair keys or image IDs", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            visitId: "visit-1",
            filters: { status: "actionable", limit: 20 },
            summary: {
              total: 3,
              unreviewed: 1,
              technicalReady: 1,
              needsRecapture: 1,
              notSuitableForComparison: 1,
              actionable: 3,
            },
            items: [
              {
                queueNumber: 1,
                lesionId: "l-008",
                lesionLabel: "Очаг B",
                bodyZone: "Плечо",
                bodySurface: "front",
                review: {
                  status: "needs_recapture",
                  reasons: ["repeat_capture_required"],
                  reviewedAt: "2026-05-19T10:50:00.000Z",
                  reviewedByUserId: "doctor-1",
                },
                calibrationStatus: "not_ready",
                calibrationReasons: ["scale_marker_missing"],
                captureMetadataStatus: "needs_review",
                technicalMarkerCount: 1,
                updatedAt: "2026-05-19T10:55:00.000Z",
                nextAction: "request_recapture",
                pairKey: "l-008:i-011+i-012",
                imageIds: ["i-011", "i-012"],
              },
            ],
            boundaries: {
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              pairKeysExposed: true,
              imageIdsExposed: true,
              clinicalConclusionGenerated: true,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await getSelfHostedVisitLesionComparisonViewerQaReviewQueue({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      status: "actionable",
      limit: 20,
    });

    expect(result.ok).toBe(true);
    expect(result.value?.summary.actionable).toBe(3);
    expect(result.value?.items[0]?.review.status).toBe("needs_recapture");
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(result.value?.boundaries.pairKeysExposed).toBe(false);
    expect(result.value?.boundaries.imageIdsExposed).toBe(false);
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/review-queue?status=actionable&limit=20",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
