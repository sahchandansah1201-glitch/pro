import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  createClinicalWorkspaceService,
  normalizeAssetCaptureMetadataPayload,
  normalizeLesionComparisonDraftPayload,
  normalizeLesionComparisonViewerQaPayload,
  normalizeLesionComparisonViewerQaReviewPayload,
  normalizeUpdateAssessmentPayload,
  normalizeUpdateConclusionPayload,
} from "./clinical-workspace-service.mjs";
import { VisitWorkspaceValidationError } from "./visit-workspace-write-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const authContext = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

function createService({ auditEvents = [], repo = {} } = {}) {
  const defaults = {
    async getAssessment() {
      return { id: "assessment-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async upsertAssessment() {
      return { id: "assessment-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async getConclusion() {
      return { id: "conclusion-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async upsertConclusion() {
      return { id: "conclusion-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "ready" };
    },
    async getReport() {
      return { id: "report-1", clinicId: CLINIC_ID, visitId: VISIT_ID, status: "draft" };
    },
    async upsertLesionComparisonDraft() {
      return {
        id: "draft-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        action: "retake",
        comparability: "not_comparable",
        reasons: ["Разные условия съёмки"],
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async getLesionLongitudinalHistory() {
      return {
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        lesionId: "10000000-0000-4000-8000-000000000801",
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
        visits: [],
        candidatePairs: [
          {
            previousVisitId: "10000000-0000-4000-8000-000000000302",
            currentVisitId: VISIT_ID,
            previousImageId: "10000000-0000-4000-8000-000000000901",
            currentImageId: "10000000-0000-4000-8000-000000000902",
            kind: "dermoscopy",
            status: "ready",
            reasons: [],
          },
        ],
        boundaries: {
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          rawImageBytesExposed: false,
          doctorOnlyTextExposed: false,
          clinicalConclusionGenerated: false,
        },
      };
    },
    async getProtectedLesionImageAsset() {
      return {
        id: "10000000-0000-4000-8000-000000000901",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        lesionId: "10000000-0000-4000-8000-000000000801",
        kind: "dermoscopy",
        contentType: "image/png",
        byteSize: 12,
        capturedAt: "2026-05-19T10:40:00.000Z",
        objectBucket: "clinical-assets",
        objectKey: "clinics/demo/protected.png",
        patientDeliveryAllowed: false,
        signedUrlsIssued: false,
        storagePathsExposed: false,
        rawImageBytesExposedInJson: false,
      };
    },
    async getLesionCaptureMetadata() {
      return {
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        lesionId: "10000000-0000-4000-8000-000000000801",
        summary: {
          assetCount: 2,
          metadataCount: 1,
          missingMetadataCount: 1,
          readyForTechnicalCompareCount: 1,
          scaleReadyCount: 0,
        },
        items: [],
        boundaries: {
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          rawImageBytesExposed: false,
          doctorOnlyTextExposed: false,
          clinicalConclusionGenerated: false,
        },
      };
    },
    async upsertAssetCaptureMetadata() {
      return {
        id: "capture-metadata-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        lesionId: "10000000-0000-4000-8000-000000000801",
        assetId: "10000000-0000-4000-8000-000000000901",
        captureSource: "device_bridge",
        deviceId: "10000000-0000-4000-8000-000000000501",
        frame: { width: 2048, height: 2048 },
        quality: { score: 91, issues: [] },
        calibration: { scaleMarkerDetected: false, millimetersAvailable: false },
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async upsertLesionComparisonViewerQa() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
        calibrationStatus: "not_ready",
        calibrationReasons: ["scale_marker_missing"],
        captureMetadataStatus: "needs_review",
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async reviewLesionComparisonViewerQa() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
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
          reviewedByUserId: USER_ID,
        },
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
  };
  return createClinicalWorkspaceService({
    visitWorkspaceRepository: {
      async getVisit() {
        return {
          id: VISIT_ID,
          patient: { id: PATIENT_ID },
          clinic: { id: CLINIC_ID },
        };
      },
    },
    clinicalWorkspaceRepository: { ...defaults, ...repo },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
    objectStore: {
      async getObject({ bucket, key }) {
        assert.equal(bucket, "clinical-assets");
        assert.equal(key, "clinics/demo/protected.png");
        return {
          bytes: Buffer.from("protected-image-bytes", "utf8"),
          byteSize: Buffer.byteLength("protected-image-bytes"),
          contentType: "image/png",
        };
      },
    },
  });
}

test("Stage 5H payload normalizers reject invalid clinical workspace writes", () => {
  assert.throws(() => normalizeUpdateAssessmentPayload({}), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateAssessmentPayload({ riskLevel: "diagnosis" }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateAssessmentPayload({ abcdTotal: 999 }), VisitWorkspaceValidationError);
  assert.throws(() => normalizeUpdateConclusionPayload({ status: "published" }), VisitWorkspaceValidationError);
  assert.deepEqual(normalizeUpdateAssessmentPayload({ status: "ready", abcdTotal: "3.4" }).abcdTotal, 3.4);
});

test("Stage 5H lesion comparison draft normalizer rejects unsafe or clinical-claim payloads", () => {
  const valid = normalizeLesionComparisonDraftPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    action: "retake",
    comparability: "not_comparable",
    reasons: ["Разные условия съёмки", "Есть технические замечания"],
  });
  assert.equal(valid.patientDeliveryAllowed, false);
  assert.equal(valid.protectedFieldsExposed, false);

  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, photoRef: "mock://photo" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, reasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonDraftPayload({ ...valid, imageIds: ["i-011"] }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BC/BD Stage 5H normalizers keep capture metadata and viewer QA technical-only", () => {
  const capture = normalizeAssetCaptureMetadataPayload({
    captureSource: "device_bridge",
    deviceId: "10000000-0000-4000-8000-000000000501",
    frameWidth: 2048,
    frameHeight: 2048,
    qualityScore: 91,
    qualityIssues: ["soft_focus"],
    scaleMarkerDetected: false,
    millimetersAvailable: false,
  });
  assert.equal(capture.patientDeliveryAllowed, false);
  assert.equal(capture.protectedFieldsExposed, false);
  assert.equal(capture.frameWidth, 2048);

  const qa = normalizeLesionComparisonViewerQaPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
    calibrationStatus: "not_ready",
    calibrationReasons: ["scale_marker_missing"],
    captureMetadataStatus: "needs_review",
  });
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);

  assert.throws(
    () => normalizeAssetCaptureMetadataPayload({ ...capture, storagePath: "/x" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeAssetCaptureMetadataPayload({ ...capture, millimetersAvailable: true, scaleMarkerDetected: false }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonViewerQaPayload({ ...qa, calibrationReasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonViewerQaPayload({
        ...qa,
        pairKey: "l-008:i-011+i-011",
        imageIds: ["i-011", "i-011"],
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonViewerQaPayload({ ...qa, technicalMarkers: [{ target: "A", xPercent: 200, yPercent: 52 }] }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BE Stage 5H viewer QA review normalizer is technical-only and metadata-safe", () => {
  const review = normalizeLesionComparisonViewerQaReviewPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    reviewStatus: "needs_recapture",
    reviewReasons: ["repeat_capture_required"],
  });

  assert.equal(review.reviewStatus, "needs_recapture");
  assert.deepEqual(review.reviewReasons, ["repeat_capture_required"]);
  assert.equal(review.medicalMeasurementAllowed, false);
  assert.equal(review.patientDeliveryAllowed, false);
  assert.equal(review.protectedFieldsExposed, false);

  assert.throws(
    () => normalizeLesionComparisonViewerQaReviewPayload({ ...review, signedUrl: "https://example.test/x" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonViewerQaReviewPayload({ ...review, reviewReasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonViewerQaReviewPayload({
        ...review,
        pairKey: "l-008:i-011+i-011",
        imageIds: ["i-011", "i-011"],
      }),
    VisitWorkspaceValidationError,
  );
});

test("Stage 5H service reads and writes assessment/conclusion/report with audit events", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const assessmentRead = await service.getAssessment(VISIT_ID, authContext, { correlationId: "c1" });
  const assessmentWrite = await service.updateAssessment(VISIT_ID, { status: "ready" }, authContext, { correlationId: "c2" });
  const conclusionRead = await service.getConclusion(VISIT_ID, authContext, { correlationId: "c3" });
  const conclusionWrite = await service.updateConclusion(VISIT_ID, { summary: "готово" }, authContext, { correlationId: "c4" });
  const reportRead = await service.getReport(VISIT_ID, authContext, { correlationId: "c5" });

  assert.equal(assessmentRead.assessment.visitId, VISIT_ID);
  assert.equal(assessmentWrite.assessment.status, "ready");
  assert.equal(conclusionRead.conclusion.visitId, VISIT_ID);
  assert.equal(conclusionWrite.conclusion.status, "ready");
  assert.equal(reportRead.report.visitId, VISIT_ID);
  assert.deepEqual(
    auditEvents.map((event) => event.action),
    ["assessment.read", "assessment.update", "conclusion.read", "conclusion.update", "report.read"],
  );
});

test("Stage 5H service persists lesion comparison draft with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.saveLesionComparisonDraft(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки"],
    },
    authContext,
    { correlationId: "c6" },
  );

  assert.equal(result.draft.patientDeliveryAllowed, false);
  assert.equal(result.draft.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_draft.upsert");
  assert.equal(auditEvents.at(-1).entityType, "lesion_comparison_decision_draft");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    action: "retake",
    comparability: "not_comparable",
    imageCount: 2,
    reasonsCount: 1,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });
  assert.doesNotMatch(JSON.stringify(auditEvents.at(-1)), /i-011|i-012|pairKey|storagePath|photoRef|token|session/i);
});

test("Batch AW Stage 5H service reads longitudinal history with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.getLesionLongitudinalHistory(
    PATIENT_ID,
    "10000000-0000-4000-8000-000000000801",
    authContext,
    { correlationId: "c7" },
  );

  assert.equal(result.history.summary.visitCount, 2);
  assert.equal(result.history.boundaries.patientDeliveryAllowed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_longitudinal_history.read");
  assert.equal(auditEvents.at(-1).entityType, "lesion_longitudinal_history");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    visitCount: 2,
    imageCount: 4,
    candidatePairCount: 2,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /previousImageId|currentImageId|object_bucket|object_key|storagePath|signedUrl|token|session|doctorOnly/i,
  );
});

test("Batch AX Stage 5H service streams protected lesion image through backend proxy with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.downloadProtectedLesionImage(
    {
      patientId: PATIENT_ID,
      lesionId: "10000000-0000-4000-8000-000000000801",
      assetId: "10000000-0000-4000-8000-000000000901",
    },
    authContext,
    { correlationId: "c8" },
  );

  assert.equal(String(result.object.bytes), "protected-image-bytes");
  assert.equal(result.object.contentType, "image/png");
  assert.equal(result.download.fileName, "lesion-image-10000000.png");
  assert.equal(auditEvents.at(-1).action, "lesion_protected_image.proxy.download");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetId: "10000000-0000-4000-8000-000000000901",
    kind: "dermoscopy",
    contentType: "image/png",
    byteSize: Buffer.byteLength("protected-image-bytes"),
    deliveryMode: "doctor_backend_proxy",
    patientDeliveryAllowed: false,
    signedUrlsIssued: false,
    storagePathsExposed: false,
    rawImageBytesExposedInJson: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /objectBucket|objectKey|"storagePath"\s*:|"signedUrl"\s*:|storage_object_path|signed_url|token|session|qr|doctorOnly|physicianText|patientSafeText/i,
  );
});

test("Batch BC Stage 5H service reads and writes capture metadata with audit-safe aggregate metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const read = await service.getLesionCaptureMetadata(
    PATIENT_ID,
    "10000000-0000-4000-8000-000000000801",
    authContext,
    { correlationId: "c9" },
  );
  assert.equal(read.metadata.summary.assetCount, 2);
  assert.equal(auditEvents.at(-1).action, "lesion_capture_metadata.read");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetCount: 2,
    metadataCount: 1,
    readyForTechnicalCompareCount: 1,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });

  const write = await service.saveAssetCaptureMetadata(
    VISIT_ID,
    "10000000-0000-4000-8000-000000000901",
    {
      captureSource: "device_bridge",
      deviceId: "10000000-0000-4000-8000-000000000501",
      frameWidth: 2048,
      frameHeight: 2048,
      qualityScore: 91,
      qualityIssues: [],
      scaleMarkerDetected: false,
      millimetersAvailable: false,
    },
    authContext,
    { correlationId: "c10" },
  );
  assert.equal(write.metadata.patientDeliveryAllowed, false);
  assert.equal(auditEvents.at(-1).action, "clinical_asset_capture_metadata.upsert");
  assert.doesNotMatch(
    JSON.stringify(auditEvents),
    /objectBucket|objectKey|storagePath|signedUrl|token|session|qr|doctorOnly|patientSafeText/i,
  );
});

test("Batch BD Stage 5H service persists viewer QA with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.saveLesionComparisonViewerQa(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
      calibrationStatus: "not_ready",
      calibrationReasons: ["scale_marker_missing"],
      captureMetadataStatus: "needs_review",
    },
    authContext,
    { correlationId: "c11" },
  );

  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_viewer_qa.upsert");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    markerCount: 1,
    calibrationStatus: "not_ready",
    calibrationReasonsCount: 1,
    captureMetadataStatus: "needs_review",
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи/i,
  );
});

test("Batch BE Stage 5H service persists viewer QA review with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewLesionComparisonViewerQa(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      reviewStatus: "needs_recapture",
      reviewReasons: ["repeat_capture_required"],
    },
    authContext,
    { correlationId: "c12" },
  );

  assert.equal(result.qa.review.status, "needs_recapture");
  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_viewer_qa.review");
  assert.equal(auditEvents.at(-1).entityType, "lesion_comparison_viewer_qa_draft");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    reviewStatus: "needs_recapture",
    reviewReasonsCount: 1,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи/i,
  );
});

test("Stage 5H service denies assessment writes without visit write scope", async () => {
  const service = createService();
  await assert.rejects(
    () => service.updateAssessment(VISIT_ID, { status: "ready" }, {
      userId: "u",
      roles: ["assistant"],
      clinicIds: [CLINIC_ID],
    }),
    ForbiddenError,
  );
});
