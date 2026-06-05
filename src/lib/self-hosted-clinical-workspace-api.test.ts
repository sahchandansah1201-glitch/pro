import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getSelfHostedLesionCaptureMetadata,
  getSelfHostedLesionLongitudinalQa,
  getSelfHostedVisitLesionComparisonViewerQaReviewQueue,
  getSelfHostedVisitLongitudinalDatasetValidation,
  reviewSelfHostedVisitLongitudinalTimelineRollout,
  reviewSelfHostedVisitLongitudinalTimelineRolloutClinicalValidation,
  reviewSelfHostedVisitLongitudinalTimelineRolloutEvidence,
  reviewSelfHostedVisitLongitudinalTimelineRolloutIncidentProcedure,
  reviewSelfHostedVisitLongitudinalTimelineRolloutMonitoring,
  reviewSelfHostedVisitLongitudinalTimelineRolloutSop,
  getSelfHostedVisitAssessment,
  getSelfHostedLesionLongitudinalHistory,
  downloadSelfHostedProtectedLesionImage,
  saveSelfHostedAssetCaptureMetadata,
  saveSelfHostedLesionComparisonDraft,
  saveSelfHostedLesionComparisonViewerQa,
  reviewSelfHostedLesionComparisonMeasurementPolicy,
  reviewSelfHostedLesionComparisonProductionAnalysisPolicy,
  reviewSelfHostedLesionComparisonReviewerAssignment,
  reviewSelfHostedLesionComparisonViewerQa,
  reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow,
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
                  deviceEvidenceReadyCount: 1,
                  deviceEvidenceReviewCount: 0,
                  productionAssetReadyCount: 1,
                  productionAssetReviewCount: 1,
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
                  deviceEvidence: {
                    captureProfile: "standard_dermoscopy",
                    lightingProfile: "polarized",
                    focusProfile: "locked",
                    distanceProfile: "fixed",
                    calibrationStatus: "valid",
                    calibrationCheckedAt: "2026-05-19T10:40:00.000Z",
                    status: "ready",
                  },
                  productionAssetReadiness: {
                    status: "needs_review",
                    reasons: ["capture_time_missing"],
                  },
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
                deviceEvidence: {
                  captureProfile: "standard_dermoscopy",
                  lightingProfile: "polarized",
                  focusProfile: "locked",
                  distanceProfile: "fixed",
                  calibrationStatus: "valid",
                  calibrationCheckedAt: "2026-05-19T10:40:00.000Z",
                  status: "ready",
                },
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
        deviceCaptureProfile: "standard_dermoscopy",
        lightingProfile: "polarized",
        focusProfile: "locked",
        distanceProfile: "fixed",
        deviceCalibrationStatus: "valid",
        deviceCalibrationCheckedAt: "2026-05-19T10:40:00.000Z",
      },
    });

    expect(read.ok).toBe(true);
    expect(read.value?.summary.metadataCount).toBe(1);
    expect(read.value?.summary.deviceEvidenceReadyCount).toBe(1);
    expect(read.value?.summary.productionAssetReviewCount).toBe(1);
    expect(read.value?.items[0]?.frame.width).toBe(2048);
    expect(read.value?.items[0]?.deviceEvidence.status).toBe("ready");
    expect(read.value?.items[0]?.productionAssetReadiness.status).toBe("needs_review");
    expect(read.value?.items[0]?.productionAssetReadiness.reasons).toEqual(["capture_time_missing"]);
    expect(read.value?.items[0]?.deviceEvidence.captureProfile).toBe("standard_dermoscopy");
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
              productionAssetNotReadyCount: 1,
              missingCaptureMetadataCount: 1,
              deviceEvidenceNotReadyCount: 1,
              deviceBridgeQualityNotReadyCount: 1,
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
              {
                code: "production_asset_not_ready",
                label: "Production asset требует проверки",
                count: 1,
                nextAction: "verify_production_asset",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
              {
                code: "device_metadata_not_ready",
                label: "Device metadata требует проверки",
                count: 1,
                nextAction: "complete_device_metadata",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
              {
                code: "device_bridge_quality_not_ready",
                label: "Device Bridge требует проверки",
                count: 1,
                nextAction: "check_device_bridge",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
            ],
            nextActions: ["request_recapture", "verify_production_asset", "complete_device_metadata", "check_device_bridge", "unsafe_action"],
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
    expect(result.value?.readiness.productionAssetNotReadyCount).toBe(1);
    expect(result.value?.readiness.deviceEvidenceNotReadyCount).toBe(1);
    expect(result.value?.readiness.deviceBridgeQualityNotReadyCount).toBe(1);
    expect(result.value?.readiness.dynamicConclusionAllowed).toBe(false);
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(result.value?.boundaries.pairKeysExposed).toBe(false);
    expect(result.value?.boundaries.imageIdsExposed).toBe(false);
    expect(result.value?.nextActions).toEqual(["request_recapture", "verify_production_asset", "complete_device_metadata", "check_device_bridge"]);
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

  it("patches reviewer workflow without exposing measurements or patient delivery", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "lesion-1",
            pairKey: "lesion-1:image-a+image-b",
            imageIds: ["image-a", "image-b"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "ready",
            calibrationReasons: [],
            captureMetadataStatus: "ready",
            review: {
              status: "technical_ready",
              reasons: ["technical_review_ready"],
              reviewedAt: "2026-05-19T10:50:00.000Z",
              reviewedByUserId: "doctor-1",
            },
            reviewerWorkflow: {
              status: "reviewer_accepted",
              reasons: ["calibrated_reviewer_workflow_ready"],
              reviewedAt: "2026-05-19T10:55:00.000Z",
              reviewedByUserId: "doctor-1",
              gate: {
                technicalReviewReady: true,
                calibrationReady: true,
                captureMetadataReady: true,
                markerGateReady: true,
                medicalMeasurementAllowed: true,
                patientDeliveryAllowed: true,
                clinicalConclusionGenerated: true,
              },
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

    const result = await reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "lesion-1",
        pairKey: "lesion-1:image-a+image-b",
        imageIds: ["image-a", "image-b"],
        workflowStatus: "reviewer_accepted",
        workflowReasons: ["calibrated_reviewer_workflow_ready"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.reviewerWorkflow.status).toBe("reviewer_accepted");
	    expect(result.value?.reviewerWorkflow.gate.medicalMeasurementAllowed).toBe(false);
	    expect(result.value?.reviewerWorkflow.gate.patientDeliveryAllowed).toBe(false);
	    expect(result.value?.reviewerWorkflow.gate.clinicalConclusionGenerated).toBe(false);
	    expect(result.value?.medicalMeasurementAllowed).toBe(false);
	    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(JSON.stringify(result.value)).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|diagnosis|treatment/i,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/reviewer-workflow",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
	    );
	  });

  it("reviews measurement policy without enabling measurements or patient delivery", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "lesion-1",
            pairKey: "lesion-1:image-a+image-b",
            imageIds: ["image-a", "image-b"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "ready",
            calibrationReasons: [],
            captureMetadataStatus: "ready",
            review: { status: "technical_ready", reasons: [], reviewedAt: null, reviewedByUserId: null },
            reviewerWorkflow: {
              status: "technical_gate_blocked",
              reasons: ["measurement_policy_required"],
              reviewedAt: null,
              reviewedByUserId: null,
              gate: {
                technicalReviewReady: true,
                calibrationReady: true,
                captureMetadataReady: true,
                markerGateReady: true,
                measurementPolicyApproved: true,
                productionAnalysisPolicyApproved: false,
                medicalMeasurementAllowed: true,
                patientDeliveryAllowed: true,
                clinicalConclusionGenerated: true,
              },
            },
            measurementPolicy: {
              status: "approved_for_technical_review",
              reasons: ["technical_measurement_policy_approved_no_mm_output"],
              reviewedAt: "2026-05-19T10:53:00.000Z",
              reviewedByUserId: "doctor-1",
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
            },
            productionAnalysisPolicy: {
              status: "not_approved",
              reasons: [],
              reviewedAt: null,
              reviewedByUserId: null,
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
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

    const result = await reviewSelfHostedLesionComparisonMeasurementPolicy({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "lesion-1",
        pairKey: "lesion-1:image-a+image-b",
        imageIds: ["image-a", "image-b"],
        measurementPolicyStatus: "approved_for_technical_review",
        measurementPolicyReasons: ["technical_measurement_policy_approved_no_mm_output"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.measurementPolicy.status).toBe("approved_for_technical_review");
    expect(result.value?.measurementPolicy.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.measurementPolicy.patientDeliveryAllowed).toBe(false);
    expect(result.value?.measurementPolicy.clinicalOutputGenerated).toBe(false);
    expect(result.value?.reviewerWorkflow.gate.measurementPolicyApproved).toBe(true);
    expect(result.value?.reviewerWorkflow.gate.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/measurement-policy",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|diagnosis|treatment|diameterMm|areaMm2/i,
    );
  });

  it("reviews production analysis policy without enabling dynamic conclusions or patient delivery", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "lesion-1",
            pairKey: "lesion-1:image-a+image-b",
            imageIds: ["image-a", "image-b"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "ready",
            calibrationReasons: [],
            captureMetadataStatus: "ready",
            review: { status: "technical_ready", reasons: [], reviewedAt: null, reviewedByUserId: null },
            reviewerWorkflow: {
              status: "technical_gate_blocked",
              reasons: ["production_analysis_policy_required"],
              reviewedAt: null,
              reviewedByUserId: null,
              gate: {
                technicalReviewReady: true,
                calibrationReady: true,
                captureMetadataReady: true,
                markerGateReady: true,
                measurementPolicyApproved: true,
                productionAnalysisPolicyApproved: true,
                reviewerAssignmentReady: true,
                secondReviewReady: true,
                medicalMeasurementAllowed: true,
                patientDeliveryAllowed: true,
                clinicalConclusionGenerated: true,
              },
            },
            measurementPolicy: {
              status: "approved_for_technical_review",
              reasons: ["technical_measurement_policy_approved_no_mm_output"],
              reviewedAt: "2026-05-19T10:53:00.000Z",
              reviewedByUserId: "doctor-1",
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
            },
            productionAnalysisPolicy: {
              status: "approved_for_production_analysis",
              reasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
              reviewedAt: "2026-05-19T11:04:00.000Z",
              reviewedByUserId: "doctor-1",
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
            },
            reviewerAssignment: {
              status: "assigned",
              reasons: [],
              assignedAt: null,
              reviewerIdentityExposed: true,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
            },
            secondReview: {
              status: "completed",
              reasons: [],
              reviewedAt: "2026-05-19T11:02:00.000Z",
              reviewerIdentityExposed: true,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
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

    const result = await reviewSelfHostedLesionComparisonProductionAnalysisPolicy({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "lesion-1",
        pairKey: "lesion-1:image-a+image-b",
        imageIds: ["image-a", "image-b"],
        productionAnalysisPolicyStatus: "approved_for_production_analysis",
        productionAnalysisPolicyReasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.productionAnalysisPolicy.status).toBe("approved_for_production_analysis");
    expect(result.value?.productionAnalysisPolicy.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.productionAnalysisPolicy.patientDeliveryAllowed).toBe(false);
    expect(result.value?.productionAnalysisPolicy.clinicalOutputGenerated).toBe(false);
    expect(result.value?.reviewerWorkflow.gate.productionAnalysisPolicyApproved).toBe(true);
    expect(result.value?.reviewerWorkflow.gate.patientDeliveryAllowed).toBe(false);
    expect(result.value?.reviewerWorkflow.gate.clinicalConclusionGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/production-analysis-policy",
      expect.objectContaining({
        method: "PATCH",
        headers: expect.objectContaining({ Authorization: "Bearer jwt" }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /dynamicConclusion|clinicalDynamicConclusion|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|diagnosis|treatment|diameterMm|areaMm2/i,
    );
  });

  it("saves reviewer assignment without exposing reviewer identity", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          item: {
            id: "viewer-qa-1",
            visitId: "visit-1",
            lesionId: "lesion-1",
            pairKey: "lesion-1:image-a+image-b",
            imageIds: ["image-a", "image-b"],
            technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
            calibrationStatus: "ready",
            calibrationReasons: [],
            captureMetadataStatus: "ready",
            review: { status: "technical_ready", reasons: [], reviewedAt: null, reviewedByUserId: null },
            reviewerWorkflow: {
              status: "technical_gate_blocked",
              reasons: ["second_review_required"],
              reviewedAt: null,
              reviewedByUserId: null,
              gate: {
                technicalReviewReady: true,
                calibrationReady: true,
                captureMetadataReady: true,
                markerGateReady: true,
                measurementPolicyApproved: true,
                productionAnalysisPolicyApproved: false,
                reviewerAssignmentReady: true,
                secondReviewReady: false,
                medicalMeasurementAllowed: true,
                patientDeliveryAllowed: true,
                clinicalConclusionGenerated: true,
              },
            },
            measurementPolicy: {
              status: "approved_for_technical_review",
              reasons: ["technical_measurement_policy_approved_no_mm_output"],
              reviewedAt: null,
              reviewedByUserId: null,
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
            },
            productionAnalysisPolicy: {
              status: "review_required",
              reasons: ["production_analysis_policy_required"],
              reviewedAt: null,
              reviewedByUserId: null,
              medicalMeasurementAllowed: true,
              patientDeliveryAllowed: true,
              clinicalOutputGenerated: true,
            },
            reviewerAssignment: {
              status: "second_review_required",
              reasons: ["second_review_required_for_clinical_grade_workflow"],
              assignedAt: "2026-05-19T10:57:00.000Z",
              reviewerIdentityExposed: true,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
            },
            secondReview: {
              status: "required",
              reasons: [],
              reviewedAt: null,
              reviewerIdentityExposed: true,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
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

    const result = await reviewSelfHostedLesionComparisonReviewerAssignment({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        lesionId: "lesion-1",
        pairKey: "lesion-1:image-a+image-b",
        imageIds: ["image-a", "image-b"],
        assignmentStatus: "second_review_required",
        assignmentReasons: ["second_review_required_for_clinical_grade_workflow"],
        assignedReviewerUserId: "10000000-0000-4000-8000-000000000201",
        secondReviewStatus: "required",
        secondReviewReasons: [],
        secondReviewerUserId: "10000000-0000-4000-8000-000000000202",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.reviewerAssignment.status).toBe("second_review_required");
    expect(result.value?.reviewerAssignment.reviewerIdentityExposed).toBe(false);
    expect(result.value?.reviewerAssignment.patientDeliveryAllowed).toBe(false);
    expect(result.value?.secondReview.status).toBe("required");
    expect(result.value?.secondReview.reviewerIdentityExposed).toBe(false);
    expect(result.value?.reviewerWorkflow.gate.reviewerAssignmentReady).toBe(true);
    expect(result.value?.reviewerWorkflow.gate.secondReviewReady).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/lesion-comparison-viewer-qa/reviewer-assignment",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining("assignedReviewerUserId"),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /reviewerName|reviewerEmail|10000000-0000-4000-8000-000000000201|10000000-0000-4000-8000-000000000202|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи|diagnosis|treatment|diameterMm|areaMm2/i,
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
	              measurementPolicyRequired: 1,
              productionAnalysisPolicyRequired: 1,
              reviewerAssignmentRequired: 1,
              secondReviewRequired: 1,
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
	                measurementPolicy: {
	                  status: "review_required",
	                  reasons: ["measurement_policy_requires_review"],
	                  reviewedAt: null,
	                  medicalMeasurementAllowed: true,
	                  patientDeliveryAllowed: true,
	                  clinicalOutputGenerated: true,
	                },
                productionAnalysisPolicy: {
                  status: "review_required",
                  reasons: ["production_analysis_policy_required"],
                  reviewedAt: null,
                  medicalMeasurementAllowed: true,
                  patientDeliveryAllowed: true,
                  clinicalOutputGenerated: true,
                },
                reviewerAssignment: {
                  status: "second_review_required",
                  reasons: ["second_review_required_for_clinical_grade_workflow"],
                  assignedAt: "2026-05-19T10:57:00.000Z",
                  reviewerIdentityExposed: true,
                  patientDeliveryAllowed: true,
                  medicalMeasurementAllowed: true,
                },
                secondReview: {
                  status: "required",
                  reasons: [],
                  reviewedAt: null,
                  reviewerIdentityExposed: true,
                  patientDeliveryAllowed: true,
                  medicalMeasurementAllowed: true,
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
	    expect(result.value?.summary.measurementPolicyRequired).toBe(1);
    expect(result.value?.summary.productionAnalysisPolicyRequired).toBe(1);
    expect(result.value?.summary.reviewerAssignmentRequired).toBe(1);
    expect(result.value?.summary.secondReviewRequired).toBe(1);
	    expect(result.value?.items[0]?.review.status).toBe("needs_recapture");
	    expect(result.value?.items[0]?.measurementPolicy.status).toBe("review_required");
	    expect(result.value?.items[0]?.measurementPolicy.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.items[0]?.productionAnalysisPolicy.status).toBe("review_required");
    expect(result.value?.items[0]?.productionAnalysisPolicy.patientDeliveryAllowed).toBe(false);
    expect(result.value?.items[0]?.productionAnalysisPolicy.clinicalOutputGenerated).toBe(false);
    expect(result.value?.items[0]?.reviewerAssignment.reviewerIdentityExposed).toBe(false);
    expect(result.value?.items[0]?.secondReview.reviewerIdentityExposed).toBe(false);
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

  it("reads visit longitudinal dataset validation without exposing pair keys or image IDs", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            readiness: {
              status: "ready_for_rollout",
              lesionCount: 2,
              timelineCandidateCount: 2,
              readyTimelineCount: 1,
              needsReviewTimelineCount: 1,
              blockedTimelineCount: 0,
              imageCount: 8,
              candidatePairCount: 3,
              reviewedPairCount: 2,
              technicalReadyPairCount: 2,
              productionAssetNotReadyCount: 1,
              productionAnalysisPolicyNotReadyCount: 1,
              missingCaptureMetadataCount: 0,
              deviceEvidenceNotReadyCount: 1,
              deviceBridgeQualityNotReadyCount: 1,
              calibrationBlockedCount: 0,
              markerMissingCount: 0,
              reviewerWorkflowReadyCount: 1,
              dynamicConclusionAllowed: true,
            },
            items: [
              {
                queueNumber: 1,
                lesionId: "lesion-1",
                lesionLabel: "Очаг A",
                bodyZone: "спина",
                bodySurface: "back",
                status: "ready_for_rollout",
                visitCount: 2,
                imageCount: 4,
                candidatePairCount: 2,
                reviewedPairCount: 2,
                technicalReadyPairCount: 2,
                productionAssetNotReadyCount: 1,
                productionAnalysisPolicyNotReadyCount: 1,
                missingCaptureMetadataCount: 0,
                deviceEvidenceNotReadyCount: 1,
                deviceBridgeQualityNotReadyCount: 1,
                calibrationBlockedCount: 0,
                markerMissingCount: 0,
                reviewerWorkflowReadyCount: 1,
                nextAction: "continue_review",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
            ],
            blockers: [
              {
                code: "production_asset_not_ready",
                label: "Production asset требует проверки",
                count: 1,
                nextAction: "verify_production_asset",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
              {
                code: "device_metadata_not_ready",
                label: "Device metadata требует проверки",
                count: 1,
                nextAction: "complete_device_metadata",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
              {
                code: "device_bridge_quality_not_ready",
                label: "Device Bridge требует проверки",
                count: 1,
                nextAction: "check_device_bridge",
                pairKey: "secret-pair",
                imageIds: ["i-011", "i-012"],
              },
            ],
            timelineRollout: {
              id: "rollout-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "approved_for_clinical_operations",
              reasons: ["timeline_rollout_governance_approved_no_dynamic_conclusion"],
              validationStatus: "ready_for_rollout",
              lesionCount: 2,
              readyTimelineCount: 1,
              needsReviewTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              reviewedAt: "2026-06-04T00:00:00.000Z",
              createdAt: "2026-06-04T00:00:00.000Z",
              updatedAt: "2026-06-04T00:00:00.000Z",
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            timelineRolloutSop: {
              id: "sop-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "ready_for_operational_rollout",
              reasons: ["timeline_rollout_sop_ready_no_patient_delivery"],
              validationStatus: "ready_for_rollout",
              rolloutStatus: "approved_for_clinical_operations",
              datasetValidationStatus: "ready",
              reviewerOperationsStatus: "ready",
              rollbackPlanStatus: "ready",
              monitoringPlanStatus: "ready",
              rolloutWindowStatus: "ready",
              ownerAckStatus: "ready",
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            timelineRolloutEvidence: {
              id: "evidence-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "ready_for_monitored_rollout",
              reasons: ["timeline_rollout_evidence_ready_no_dynamic_conclusion"],
              sopStatus: "ready_for_operational_rollout",
              validationStatus: "ready_for_rollout",
              rolloutStatus: "approved_for_clinical_operations",
              monitoringEvidenceStatus: "ready",
              sampleAuditStatus: "ready",
              exceptionLogStatus: "ready",
              rollbackDrillStatus: "ready",
              ownerSignoffStatus: "ready",
              monitoringWindowDays: 14,
              sampledTimelineCount: 2,
              exceptionCount: 0,
              rollbackDrillCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            timelineRolloutMonitoring: {
              id: "monitoring-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "ready_for_production_rollout",
              reasons: ["timeline_rollout_monitoring_ready_no_dynamic_conclusion"],
              evidenceStatus: "ready_for_monitored_rollout",
              sopStatus: "ready_for_operational_rollout",
              validationStatus: "ready_for_rollout",
              rolloutStatus: "approved_for_clinical_operations",
              outcomeSamplingStatus: "ready",
              incidentReviewStatus: "ready",
              exceptionClosureStatus: "ready",
              rollbackOutcomeStatus: "ready",
              ownerFinalReviewStatus: "ready",
              monitoringWindowDays: 30,
              monitoredTimelineCount: 2,
              sampledTimelineCount: 2,
              incidentCount: 0,
              unresolvedIncidentCount: 0,
              closedExceptionCount: 0,
              rollbackExecutionCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              rawMonitoringLog: "unsafe",
              incidentPayload: { unsafe: true },
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            timelineRolloutIncidentProcedure: {
              id: "incident-procedure-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "ready_for_clinic_monitoring",
              reasons: ["timeline_rollout_incident_procedure_ready_no_dynamic_conclusion"],
              monitoringStatus: "ready_for_production_rollout",
              evidenceStatus: "ready_for_monitored_rollout",
              sopStatus: "ready_for_operational_rollout",
              validationStatus: "ready_for_rollout",
              rolloutStatus: "approved_for_clinical_operations",
              realDatasetStatus: "ready",
              outcomeSamplingProcedureStatus: "ready",
              incidentTriageStatus: "ready",
              escalationPathStatus: "ready",
              rollbackDecisionStatus: "ready",
              ownerReviewStatus: "ready",
              realDatasetTimelineCount: 2,
              monitoredTimelineCount: 2,
              sampledOutcomeCount: 2,
              incidentCaseCount: 0,
              unresolvedIncidentCount: 0,
              escalatedIncidentCount: 0,
              rollbackDecisionCount: 1,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              rawOutcomeLog: "unsafe",
              incidentDetails: { unsafe: true },
              incidentTimeline: ["unsafe"],
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            timelineRolloutClinicalValidation: {
              id: "clinical-validation-1",
              clinicId: "clinic-1",
              patientId: "patient-1",
              visitId: "visit-1",
              status: "ready_for_clinical_validation",
              reasons: ["timeline_rollout_clinical_validation_ready_no_dynamic_conclusion"],
              incidentProcedureStatus: "ready_for_clinic_monitoring",
              monitoringStatus: "ready_for_production_rollout",
              evidenceStatus: "ready_for_monitored_rollout",
              sopStatus: "ready_for_operational_rollout",
              validationStatus: "ready_for_rollout",
              rolloutStatus: "approved_for_clinical_operations",
              realDatasetLockStatus: "ready",
              validatorTrainingStatus: "ready",
              blindedSampleStatus: "ready",
              adjudicationStatus: "ready",
              decisionLogStatus: "ready",
              ownerAcceptanceStatus: "ready",
              realDatasetTimelineCount: 8,
              validationSampleCount: 4,
              disagreementCaseCount: 1,
              adjudicatedCaseCount: 1,
              followupWindowDays: 90,
              blockerCount: 0,
              lesionCount: 2,
              readyTimelineCount: 1,
              blockedTimelineCount: 0,
              candidatePairCount: 3,
              reviewerWorkflowReadyCount: 1,
              patientDeliveryAllowed: true,
              medicalMeasurementAllowed: true,
              protectedFieldsExposed: true,
              clinicalOutputGenerated: true,
              rawValidationLog: "unsafe",
              rawAdjudicationLog: "unsafe",
              clinicalValidationPayload: { unsafe: true },
              validationDetails: { unsafe: true },
              adjudicationDetails: { unsafe: true },
              validatorName: "Unsafe Name",
              validatorEmail: "unsafe@example.com",
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
            nextActions: ["verify_production_asset", "complete_device_metadata", "check_device_bridge", "continue_review", "unsafe_action"],
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

    const result = await getSelfHostedVisitLongitudinalDatasetValidation({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
    });

    expect(result.ok).toBe(true);
    expect(result.value?.readiness.status).toBe("ready_for_rollout");
    expect(result.value?.readiness.productionAssetNotReadyCount).toBe(1);
    expect(result.value?.readiness.productionAnalysisPolicyNotReadyCount).toBe(1);
    expect(result.value?.readiness.deviceEvidenceNotReadyCount).toBe(1);
    expect(result.value?.readiness.deviceBridgeQualityNotReadyCount).toBe(1);
    expect(result.value?.readiness.dynamicConclusionAllowed).toBe(false);
    expect(result.value?.items[0]?.nextAction).toBe("continue_review");
    expect(result.value?.items[0]?.productionAssetNotReadyCount).toBe(1);
    expect(result.value?.items[0]?.productionAnalysisPolicyNotReadyCount).toBe(1);
    expect(result.value?.items[0]?.deviceEvidenceNotReadyCount).toBe(1);
    expect(result.value?.items[0]?.deviceBridgeQualityNotReadyCount).toBe(1);
    expect(result.value?.boundaries.patientDeliveryAllowed).toBe(false);
    expect(result.value?.boundaries.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.boundaries.pairKeysExposed).toBe(false);
    expect(result.value?.boundaries.imageIdsExposed).toBe(false);
    expect(result.value?.timelineRollout.status).toBe("approved_for_clinical_operations");
    expect(result.value?.timelineRollout.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRollout.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRollout.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRollout.clinicalOutputGenerated).toBe(false);
    expect(result.value?.timelineRolloutSop.status).toBe("ready_for_operational_rollout");
    expect(result.value?.timelineRolloutSop.datasetValidationStatus).toBe("ready");
    expect(result.value?.timelineRolloutSop.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRolloutSop.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRolloutSop.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRolloutSop.clinicalOutputGenerated).toBe(false);
    expect(result.value?.timelineRolloutEvidence.status).toBe("ready_for_monitored_rollout");
    expect(result.value?.timelineRolloutEvidence.monitoringEvidenceStatus).toBe("ready");
    expect(result.value?.timelineRolloutEvidence.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRolloutEvidence.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRolloutEvidence.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRolloutEvidence.clinicalOutputGenerated).toBe(false);
    expect(result.value?.timelineRolloutMonitoring.status).toBe("ready_for_production_rollout");
    expect(result.value?.timelineRolloutMonitoring.outcomeSamplingStatus).toBe("ready");
    expect(result.value?.timelineRolloutMonitoring.unresolvedIncidentCount).toBe(0);
    expect(result.value?.timelineRolloutMonitoring.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRolloutMonitoring.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRolloutMonitoring.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRolloutMonitoring.clinicalOutputGenerated).toBe(false);
    expect(result.value?.timelineRolloutIncidentProcedure.status).toBe("ready_for_clinic_monitoring");
    expect(result.value?.timelineRolloutIncidentProcedure.realDatasetStatus).toBe("ready");
    expect(result.value?.timelineRolloutIncidentProcedure.sampledOutcomeCount).toBe(2);
    expect(result.value?.timelineRolloutIncidentProcedure.unresolvedIncidentCount).toBe(0);
    expect(result.value?.timelineRolloutIncidentProcedure.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRolloutIncidentProcedure.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRolloutIncidentProcedure.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRolloutIncidentProcedure.clinicalOutputGenerated).toBe(false);
    expect(result.value?.timelineRolloutClinicalValidation.status).toBe("ready_for_clinical_validation");
    expect(result.value?.timelineRolloutClinicalValidation.realDatasetLockStatus).toBe("ready");
    expect(result.value?.timelineRolloutClinicalValidation.validationSampleCount).toBe(4);
    expect(result.value?.timelineRolloutClinicalValidation.adjudicatedCaseCount).toBe(1);
    expect(result.value?.timelineRolloutClinicalValidation.patientDeliveryAllowed).toBe(false);
    expect(result.value?.timelineRolloutClinicalValidation.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.timelineRolloutClinicalValidation.protectedFieldsExposed).toBe(false);
    expect(result.value?.timelineRolloutClinicalValidation.clinicalOutputGenerated).toBe(false);
    expect(result.value?.blockers[0]?.code).toBe("production_asset_not_ready");
    expect(result.value?.blockers[0]?.nextAction).toBe("verify_production_asset");
    expect(result.value?.nextActions).toEqual(["verify_production_asset", "complete_device_metadata", "check_device_bridge", "continue_review"]);
    expect(JSON.stringify(result.value)).not.toMatch(
      /secret-pair|"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|rawMonitoringLog|rawOutcomeLog|incidentPayload|incidentDetails|incidentTimeline|rawValidationLog|rawAdjudicationLog|clinicalValidationPayload|validationDetails|adjudicationDetails|validatorName|validatorEmail|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|меланома|рак кожи/i,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-dataset-validation",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("reviews visit longitudinal timeline rollout through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "rollout-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "review_required",
            reasons: ["timeline_dataset_not_ready"],
            validationStatus: "blocked",
            lesionCount: 2,
            readyTimelineCount: 1,
            needsReviewTimelineCount: 0,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
            reviewedAt: "2026-06-04T00:00:00.000Z",
            createdAt: "2026-06-04T00:00:00.000Z",
            updatedAt: "2026-06-04T00:00:00.000Z",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRollout({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        rolloutStatus: "approved_for_clinical_operations",
        rolloutReasons: ["timeline_rollout_governance_approved_no_dynamic_conclusion"],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("review_required");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          rolloutStatus: "approved_for_clinical_operations",
          rolloutReasons: ["timeline_rollout_governance_approved_no_dynamic_conclusion"],
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });

  it("reviews visit longitudinal timeline rollout SOP through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "sop-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "in_review",
            reasons: ["timeline_rollout_sop_not_ready"],
            validationStatus: "blocked",
            rolloutStatus: "review_required",
            datasetValidationStatus: "ready",
            reviewerOperationsStatus: "ready",
            rollbackPlanStatus: "ready",
            monitoringPlanStatus: "ready",
            rolloutWindowStatus: "ready",
            ownerAckStatus: "ready",
            lesionCount: 2,
            readyTimelineCount: 1,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutSop({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        sopStatus: "ready_for_operational_rollout",
        sopReasons: ["timeline_rollout_sop_ready_no_patient_delivery"],
        datasetValidationStatus: "ready",
        reviewerOperationsStatus: "ready",
        rollbackPlanStatus: "ready",
        monitoringPlanStatus: "ready",
        rolloutWindowStatus: "ready",
        ownerAckStatus: "ready",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("in_review");
    expect(result.value?.rolloutStatus).toBe("review_required");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout/sop",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          sopStatus: "ready_for_operational_rollout",
          sopReasons: ["timeline_rollout_sop_ready_no_patient_delivery"],
          datasetValidationStatus: "ready",
          reviewerOperationsStatus: "ready",
          rollbackPlanStatus: "ready",
          monitoringPlanStatus: "ready",
          rolloutWindowStatus: "ready",
          ownerAckStatus: "ready",
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });

  it("reviews visit longitudinal timeline rollout evidence through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "evidence-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "in_review",
            reasons: ["timeline_rollout_evidence_not_ready"],
            sopStatus: "not_started",
            validationStatus: "blocked",
            rolloutStatus: "review_required",
            monitoringEvidenceStatus: "needs_review",
            sampleAuditStatus: "needs_review",
            exceptionLogStatus: "needs_review",
            rollbackDrillStatus: "needs_review",
            ownerSignoffStatus: "needs_review",
            monitoringWindowDays: 0,
            sampledTimelineCount: 0,
            exceptionCount: 0,
            rollbackDrillCount: 0,
            lesionCount: 2,
            readyTimelineCount: 1,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutEvidence({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        evidenceStatus: "ready_for_monitored_rollout",
        evidenceReasons: ["timeline_rollout_evidence_ready_no_dynamic_conclusion"],
        monitoringEvidenceStatus: "ready",
        sampleAuditStatus: "ready",
        exceptionLogStatus: "ready",
        rollbackDrillStatus: "ready",
        ownerSignoffStatus: "ready",
        monitoringWindowDays: 14,
        sampledTimelineCount: 2,
        exceptionCount: 0,
        rollbackDrillCount: 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("in_review");
    expect(result.value?.sopStatus).toBe("not_started");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout/evidence",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          evidenceStatus: "ready_for_monitored_rollout",
          evidenceReasons: ["timeline_rollout_evidence_ready_no_dynamic_conclusion"],
          monitoringEvidenceStatus: "ready",
          sampleAuditStatus: "ready",
          exceptionLogStatus: "ready",
          rollbackDrillStatus: "ready",
          ownerSignoffStatus: "ready",
          monitoringWindowDays: 14,
          sampledTimelineCount: 2,
          exceptionCount: 0,
          rollbackDrillCount: 1,
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });

  it("reviews visit longitudinal timeline rollout monitoring through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "monitoring-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "in_review",
            reasons: ["timeline_rollout_monitoring_not_ready"],
            evidenceStatus: "not_started",
            sopStatus: "not_started",
            validationStatus: "blocked",
            rolloutStatus: "review_required",
            outcomeSamplingStatus: "needs_review",
            incidentReviewStatus: "needs_review",
            exceptionClosureStatus: "needs_review",
            rollbackOutcomeStatus: "needs_review",
            ownerFinalReviewStatus: "needs_review",
            monitoringWindowDays: 0,
            monitoredTimelineCount: 0,
            sampledTimelineCount: 0,
            incidentCount: 0,
            unresolvedIncidentCount: 0,
            closedExceptionCount: 0,
            rollbackExecutionCount: 0,
            lesionCount: 2,
            readyTimelineCount: 1,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
            rawMonitoringLog: "unsafe",
            incidentPayload: { unsafe: true },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutMonitoring({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        monitoringStatus: "ready_for_production_rollout",
        monitoringReasons: ["timeline_rollout_monitoring_ready_no_dynamic_conclusion"],
        outcomeSamplingStatus: "ready",
        incidentReviewStatus: "ready",
        exceptionClosureStatus: "ready",
        rollbackOutcomeStatus: "ready",
        ownerFinalReviewStatus: "ready",
        monitoringWindowDays: 30,
        monitoredTimelineCount: 2,
        sampledTimelineCount: 2,
        incidentCount: 0,
        unresolvedIncidentCount: 0,
        closedExceptionCount: 0,
        rollbackExecutionCount: 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("in_review");
    expect(result.value?.evidenceStatus).toBe("not_started");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout/monitoring",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          monitoringStatus: "ready_for_production_rollout",
          monitoringReasons: ["timeline_rollout_monitoring_ready_no_dynamic_conclusion"],
          outcomeSamplingStatus: "ready",
          incidentReviewStatus: "ready",
          exceptionClosureStatus: "ready",
          rollbackOutcomeStatus: "ready",
          ownerFinalReviewStatus: "ready",
          monitoringWindowDays: 30,
          monitoredTimelineCount: 2,
          sampledTimelineCount: 2,
          incidentCount: 0,
          unresolvedIncidentCount: 0,
          closedExceptionCount: 0,
          rollbackExecutionCount: 1,
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|rawMonitoringLog|incidentPayload|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });

  it("reviews visit longitudinal timeline rollout incident procedure through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "incident-procedure-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "in_review",
            reasons: ["timeline_rollout_incident_procedure_not_ready"],
            monitoringStatus: "not_started",
            evidenceStatus: "not_started",
            sopStatus: "not_started",
            validationStatus: "blocked",
            rolloutStatus: "review_required",
            realDatasetStatus: "needs_review",
            outcomeSamplingProcedureStatus: "needs_review",
            incidentTriageStatus: "needs_review",
            escalationPathStatus: "needs_review",
            rollbackDecisionStatus: "needs_review",
            ownerReviewStatus: "needs_review",
            realDatasetTimelineCount: 0,
            monitoredTimelineCount: 0,
            sampledOutcomeCount: 0,
            incidentCaseCount: 0,
            unresolvedIncidentCount: 0,
            escalatedIncidentCount: 0,
            rollbackDecisionCount: 0,
            lesionCount: 2,
            readyTimelineCount: 1,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
            rawOutcomeLog: "unsafe",
            incidentDetails: { unsafe: true },
            incidentTimeline: ["unsafe"],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutIncidentProcedure({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        procedureStatus: "ready_for_clinic_monitoring",
        procedureReasons: ["timeline_rollout_incident_procedure_ready_no_dynamic_conclusion"],
        realDatasetStatus: "ready",
        outcomeSamplingProcedureStatus: "ready",
        incidentTriageStatus: "ready",
        escalationPathStatus: "ready",
        rollbackDecisionStatus: "ready",
        ownerReviewStatus: "ready",
        realDatasetTimelineCount: 2,
        monitoredTimelineCount: 2,
        sampledOutcomeCount: 2,
        incidentCaseCount: 0,
        unresolvedIncidentCount: 0,
        escalatedIncidentCount: 0,
        rollbackDecisionCount: 1,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("in_review");
    expect(result.value?.monitoringStatus).toBe("not_started");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout/incident-procedure",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          procedureStatus: "ready_for_clinic_monitoring",
          procedureReasons: ["timeline_rollout_incident_procedure_ready_no_dynamic_conclusion"],
          realDatasetStatus: "ready",
          outcomeSamplingProcedureStatus: "ready",
          incidentTriageStatus: "ready",
          escalationPathStatus: "ready",
          rollbackDecisionStatus: "ready",
          ownerReviewStatus: "ready",
          realDatasetTimelineCount: 2,
          monitoredTimelineCount: 2,
          sampledOutcomeCount: 2,
          incidentCaseCount: 0,
          unresolvedIncidentCount: 0,
          escalatedIncidentCount: 0,
          rollbackDecisionCount: 1,
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|rawOutcomeLog|incidentDetails|incidentTimeline|rawMonitoringLog|incidentPayload|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });

  it("reviews visit longitudinal timeline rollout clinical validation through metadata-only Stage 5H contract", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(
        JSON.stringify({
          item: {
            id: "clinical-validation-1",
            clinicId: "clinic-1",
            patientId: "patient-1",
            visitId: "visit-1",
            status: "in_review",
            reasons: ["timeline_rollout_clinical_validation_not_ready"],
            incidentProcedureStatus: "not_started",
            monitoringStatus: "not_started",
            evidenceStatus: "not_started",
            sopStatus: "not_started",
            validationStatus: "blocked",
            rolloutStatus: "review_required",
            realDatasetLockStatus: "needs_review",
            validatorTrainingStatus: "needs_review",
            blindedSampleStatus: "needs_review",
            adjudicationStatus: "needs_review",
            decisionLogStatus: "needs_review",
            ownerAcceptanceStatus: "needs_review",
            realDatasetTimelineCount: 0,
            validationSampleCount: 0,
            disagreementCaseCount: 0,
            adjudicatedCaseCount: 0,
            followupWindowDays: 0,
            blockerCount: 1,
            lesionCount: 2,
            readyTimelineCount: 1,
            blockedTimelineCount: 1,
            candidatePairCount: 3,
            reviewerWorkflowReadyCount: 1,
            patientDeliveryAllowed: true,
            medicalMeasurementAllowed: true,
            protectedFieldsExposed: true,
            clinicalOutputGenerated: true,
            rawValidationLog: "unsafe",
            rawAdjudicationLog: "unsafe",
            clinicalValidationPayload: { unsafe: true },
            validationDetails: { unsafe: true },
            adjudicationDetails: { unsafe: true },
            validatorName: "Unsafe Name",
            validatorEmail: "unsafe@example.com",
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await reviewSelfHostedVisitLongitudinalTimelineRolloutClinicalValidation({
      apiBaseUrl: "http://localhost:3001",
      apiToken: "jwt",
      visitId: "visit-1",
      payload: {
        clinicalValidationStatus: "ready_for_clinical_validation",
        clinicalValidationReasons: ["timeline_rollout_clinical_validation_ready_no_dynamic_conclusion"],
        realDatasetLockStatus: "ready",
        validatorTrainingStatus: "ready",
        blindedSampleStatus: "ready",
        adjudicationStatus: "ready",
        decisionLogStatus: "ready",
        ownerAcceptanceStatus: "ready",
        realDatasetTimelineCount: 8,
        validationSampleCount: 4,
        disagreementCaseCount: 1,
        adjudicatedCaseCount: 1,
        followupWindowDays: 90,
        blockerCount: 0,
      },
    });

    expect(result.ok).toBe(true);
    expect(result.value?.status).toBe("in_review");
    expect(result.value?.incidentProcedureStatus).toBe("not_started");
    expect(result.value?.realDatasetLockStatus).toBe("needs_review");
    expect(result.value?.patientDeliveryAllowed).toBe(false);
    expect(result.value?.medicalMeasurementAllowed).toBe(false);
    expect(result.value?.protectedFieldsExposed).toBe(false);
    expect(result.value?.clinicalOutputGenerated).toBe(false);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3001/api/v1/visits/visit-1/longitudinal-timeline-rollout/clinical-validation",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          clinicalValidationStatus: "ready_for_clinical_validation",
          clinicalValidationReasons: ["timeline_rollout_clinical_validation_ready_no_dynamic_conclusion"],
          realDatasetLockStatus: "ready",
          validatorTrainingStatus: "ready",
          blindedSampleStatus: "ready",
          adjudicationStatus: "ready",
          decisionLogStatus: "ready",
          ownerAcceptanceStatus: "ready",
          realDatasetTimelineCount: 8,
          validationSampleCount: 4,
          disagreementCaseCount: 1,
          adjudicatedCaseCount: 1,
          followupWindowDays: 90,
          blockerCount: 0,
        }),
      }),
    );
    expect(JSON.stringify(result.value)).not.toMatch(
      /"pairKey"\s*:|"imageIds"\s*:|i-011|i-012|"storagePath"\s*:|"signedUrl"\s*:|rawValidationLog|rawAdjudicationLog|clinicalValidationPayload|validationDetails|adjudicationDetails|validatorName|validatorEmail|photoRef|heatmapRef|modelVersion|sharedLink|token|session|qr|dynamicConclusion|diagnosis|riskScore/i,
    );
  });
});
