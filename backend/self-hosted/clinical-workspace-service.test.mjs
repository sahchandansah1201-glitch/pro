import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import {
  createClinicalWorkspaceService,
  normalizeAssetCaptureMetadataPayload,
  normalizeLesionComparisonDraftPayload,
  normalizeLesionComparisonViewerQaPayload,
  normalizeLesionComparisonMeasurementPolicyPayload,
  normalizeLesionComparisonProductionAnalysisPolicyPayload,
  normalizeLesionComparisonReviewerAssignmentPayload,
  normalizeLesionComparisonViewerQaReviewPayload,
  normalizeLesionComparisonViewerQaReviewerWorkflowPayload,
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
          deviceEvidenceReadyCount: 1,
          deviceEvidenceReviewCount: 0,
          productionAssetReadyCount: 1,
          productionAssetReviewCount: 1,
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
    async getLesionLongitudinalQa() {
      return {
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        lesionId: "10000000-0000-4000-8000-000000000801",
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
          dynamicConclusionAllowed: false,
        },
        blockers: [
          {
            code: "recapture_required",
            label: "Нужен переснимок",
            count: 1,
            nextAction: "request_recapture",
          },
        ],
        nextActions: ["request_recapture", "verify_production_asset", "complete_capture_metadata", "complete_device_metadata"],
        boundaries: {
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
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
        deviceEvidence: {
          captureProfile: "standard_dermoscopy",
          lightingProfile: "polarized",
          focusProfile: "locked",
          distanceProfile: "fixed",
          calibrationStatus: "valid",
          calibrationCheckedAt: "2026-05-19T10:40:00.000Z",
          status: "ready",
        },
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
    async reviewLesionComparisonViewerQaReviewerWorkflow() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
        calibrationStatus: "ready",
        calibrationReasons: [],
        captureMetadataStatus: "ready",
        review: {
          status: "technical_ready",
          reasons: ["technical_review_ready"],
          reviewedAt: "2026-05-19T10:50:00.000Z",
          reviewedByUserId: USER_ID,
        },
        reviewerWorkflow: {
          status: "reviewer_accepted",
          reasons: ["calibrated_reviewer_workflow_ready"],
          reviewedAt: "2026-05-19T10:55:00.000Z",
          reviewedByUserId: USER_ID,
          gate: {
            technicalReviewReady: true,
            calibrationReady: true,
            captureMetadataReady: true,
            markerGateReady: true,
            measurementPolicyApproved: true,
            reviewerAssignmentReady: true,
            secondReviewReady: true,
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            clinicalConclusionGenerated: false,
          },
        },
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async reviewLesionComparisonMeasurementPolicy() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
        calibrationStatus: "ready",
        calibrationReasons: [],
        captureMetadataStatus: "ready",
        review: {
          status: "technical_ready",
          reasons: ["technical_review_ready"],
          reviewedAt: "2026-05-19T10:50:00.000Z",
          reviewedByUserId: USER_ID,
        },
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
            reviewerAssignmentReady: false,
            secondReviewReady: true,
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            clinicalConclusionGenerated: false,
          },
        },
        measurementPolicy: {
          status: "approved_for_technical_review",
          reasons: ["technical_measurement_policy_approved_no_mm_output"],
          reviewedAt: "2026-05-19T10:56:00.000Z",
          reviewedByUserId: USER_ID,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          clinicalOutputGenerated: false,
        },
        productionAnalysisPolicy: {
          status: "not_approved",
          reasons: ["production_analysis_policy_required"],
          reviewedAt: null,
          reviewedByUserId: null,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          clinicalOutputGenerated: false,
        },
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async reviewLesionComparisonProductionAnalysisPolicy() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
        calibrationStatus: "ready",
        calibrationReasons: [],
        captureMetadataStatus: "ready",
        review: {
          status: "technical_ready",
          reasons: ["technical_review_ready"],
          reviewedAt: "2026-05-19T10:50:00.000Z",
          reviewedByUserId: USER_ID,
        },
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
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            clinicalConclusionGenerated: false,
          },
        },
        productionAnalysisPolicy: {
          status: "approved_for_production_analysis",
          reasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
          reviewedAt: "2026-05-19T11:01:00.000Z",
          reviewedByUserId: USER_ID,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          clinicalOutputGenerated: false,
        },
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async assignLesionComparisonReviewer() {
      return {
        id: "viewer-qa-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        doctorUserId: USER_ID,
        lesionId: "l-008",
        pairKey: "l-008:i-011+i-012",
        imageIds: ["i-011", "i-012"],
        technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }, { target: "B", xPercent: 52, yPercent: 52 }],
        calibrationStatus: "ready",
        calibrationReasons: [],
        captureMetadataStatus: "ready",
        review: {
          status: "technical_ready",
          reasons: ["technical_review_ready"],
          reviewedAt: "2026-05-19T10:50:00.000Z",
          reviewedByUserId: USER_ID,
        },
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
            reviewerAssignmentReady: true,
            secondReviewReady: false,
            medicalMeasurementAllowed: false,
            patientDeliveryAllowed: false,
            clinicalConclusionGenerated: false,
          },
        },
        measurementPolicy: {
          status: "approved_for_technical_review",
          reasons: ["technical_measurement_policy_approved_no_mm_output"],
          reviewedAt: "2026-05-19T10:56:00.000Z",
          reviewedByUserId: USER_ID,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          clinicalOutputGenerated: false,
        },
        reviewerAssignment: {
          status: "second_review_required",
          reasons: ["second_review_required_for_clinical_grade_workflow"],
          assignedAt: "2026-05-19T10:57:00.000Z",
          reviewerIdentityExposed: false,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
        },
        secondReview: {
          status: "required",
          reasons: [],
          reviewedAt: null,
          reviewerIdentityExposed: false,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
        },
        medicalMeasurementAllowed: false,
        patientDeliveryAllowed: false,
        protectedFieldsExposed: false,
      };
    },
    async getVisitLesionComparisonViewerQaReviewQueue() {
      return {
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        filters: { status: "actionable", limit: 20 },
        summary: {
          total: 3,
          unreviewed: 1,
          technicalReady: 1,
          needsRecapture: 1,
          notSuitableForComparison: 1,
          measurementPolicyRequired: 0,
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
              reviewedByUserId: USER_ID,
            },
            calibrationStatus: "not_ready",
            calibrationReasons: ["scale_marker_missing"],
            captureMetadataStatus: "needs_review",
            technicalMarkerCount: 1,
            updatedAt: "2026-05-19T10:55:00.000Z",
            nextAction: "request_recapture",
          },
        ],
        boundaries: {
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          clinicalConclusionGenerated: false,
        },
      };
    },
    async getVisitLongitudinalDatasetValidation() {
      return {
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        readiness: {
          status: "blocked",
          lesionCount: 2,
          timelineCandidateCount: 2,
          readyTimelineCount: 1,
          needsReviewTimelineCount: 0,
          blockedTimelineCount: 1,
          imageCount: 8,
          candidatePairCount: 3,
          reviewedPairCount: 2,
          technicalReadyPairCount: 2,
          productionAssetNotReadyCount: 1,
          missingCaptureMetadataCount: 1,
          deviceEvidenceNotReadyCount: 1,
          deviceBridgeQualityNotReadyCount: 1,
          calibrationBlockedCount: 1,
          markerMissingCount: 1,
          reviewerWorkflowReadyCount: 1,
          dynamicConclusionAllowed: false,
        },
        items: [
          {
            queueNumber: 1,
            lesionId: "10000000-0000-4000-8000-000000000801",
            lesionLabel: "Очаг A",
            bodyZone: "спина",
            bodySurface: "back",
            status: "blocked",
            visitCount: 2,
            imageCount: 4,
            candidatePairCount: 2,
            reviewedPairCount: 1,
            technicalReadyPairCount: 1,
            productionAssetNotReadyCount: 1,
            missingCaptureMetadataCount: 1,
            deviceEvidenceNotReadyCount: 1,
            deviceBridgeQualityNotReadyCount: 1,
            calibrationBlockedCount: 1,
            markerMissingCount: 1,
            reviewerWorkflowReadyCount: 0,
            nextAction: "complete_capture_metadata",
          },
        ],
        blockers: [
          {
            code: "missing_capture_metadata",
            label: "Не хватает metadata съёмки",
            count: 1,
            nextAction: "complete_capture_metadata",
          },
          {
            code: "device_metadata_not_ready",
            label: "Device metadata требует проверки",
            count: 1,
            nextAction: "complete_device_metadata",
          },
          {
            code: "production_asset_not_ready",
            label: "Production asset требует проверки",
            count: 1,
            nextAction: "verify_production_asset",
          },
          {
            code: "device_bridge_quality_not_ready",
            label: "Device Bridge требует проверки",
            count: 1,
            nextAction: "check_device_bridge",
          },
        ],
        nextActions: ["verify_production_asset", "complete_capture_metadata", "complete_device_metadata", "check_device_bridge", "complete_calibration", "place_markers"],
        boundaries: {
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          storagePathsExposed: false,
          signedUrlsIssued: false,
          rawImageBytesExposed: false,
          doctorOnlyTextExposed: false,
          clinicalConclusionGenerated: false,
        },
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
    deviceCaptureProfile: "standard_dermoscopy",
    lightingProfile: "polarized",
    focusProfile: "locked",
    distanceProfile: "fixed",
    deviceCalibrationStatus: "valid",
    deviceCalibrationCheckedAt: "2026-05-19T10:40:00.000Z",
  });
  assert.equal(capture.patientDeliveryAllowed, false);
  assert.equal(capture.protectedFieldsExposed, false);
  assert.equal(capture.frameWidth, 2048);
  assert.equal(capture.deviceEvidenceStatus, "ready");
  assert.equal(capture.deviceCalibrationStatus, "valid");

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
    () => normalizeAssetCaptureMetadataPayload({ ...capture, macAddress: "00:11:22:33:44:55" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeAssetCaptureMetadataPayload({ ...capture, deviceCaptureProfile: "raw_serial_profile" }),
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

test("Batch BH Stage 5H reviewer workflow normalizer rejects protected fields and clinical claims", () => {
  assert.throws(
    () => normalizeLesionComparisonViewerQaReviewerWorkflowPayload({
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      workflowStatus: "reviewer_accepted",
      workflowReasons: ["меланома"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonViewerQaReviewerWorkflowPayload({
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      workflowStatus: "reviewer_accepted",
      workflowReasons: ["calibrated_reviewer_workflow_ready"],
      signedUrl: "https://example.invalid",
    }),
    VisitWorkspaceValidationError,
  );

  const payload = normalizeLesionComparisonViewerQaReviewerWorkflowPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    workflowStatus: "reviewer_accepted",
    workflowReasons: ["calibrated_reviewer_workflow_ready"],
  });

  assert.equal(payload.workflowStatus, "reviewer_accepted");
  assert.deepEqual(payload.workflowReasons, ["calibrated_reviewer_workflow_ready"]);
  assert.equal(payload.medicalMeasurementAllowed, false);
  assert.equal(payload.patientDeliveryAllowed, false);
  assert.equal(payload.protectedFieldsExposed, false);
});

test("Batch BO Stage 5H measurement policy normalizer rejects measurement values and clinical claims", () => {
  const policy = normalizeLesionComparisonMeasurementPolicyPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    measurementPolicyStatus: "approved_for_technical_review",
    measurementPolicyReasons: ["technical_measurement_policy_approved_no_mm_output"],
  });

  assert.equal(policy.measurementPolicyStatus, "approved_for_technical_review");
  assert.equal(policy.medicalMeasurementAllowed, false);
  assert.equal(policy.patientDeliveryAllowed, false);
  assert.equal(policy.protectedFieldsExposed, false);
  assert.equal(policy.clinicalOutputGenerated, false);
  assert.throws(
    () => normalizeLesionComparisonMeasurementPolicyPayload({ ...policy, diameterMm: 4.2 }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonMeasurementPolicyPayload({ ...policy, measurementPolicyReasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonMeasurementPolicyPayload({
        ...policy,
        pairKey: "l-008:i-011+i-011",
        imageIds: ["i-011", "i-011"],
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BQ Stage 5H production analysis policy normalizer rejects clinical dynamic claims", () => {
  const policy = normalizeLesionComparisonProductionAnalysisPolicyPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    productionAnalysisPolicyStatus: "approved_for_production_analysis",
    productionAnalysisPolicyReasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
  });

  assert.equal(policy.productionAnalysisPolicyStatus, "approved_for_production_analysis");
  assert.equal(policy.medicalMeasurementAllowed, false);
  assert.equal(policy.patientDeliveryAllowed, false);
  assert.equal(policy.protectedFieldsExposed, false);
  assert.equal(policy.clinicalOutputGenerated, false);
  assert.throws(
    () => normalizeLesionComparisonProductionAnalysisPolicyPayload({ ...policy, dynamicConclusion: "growth" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonProductionAnalysisPolicyPayload({
        ...policy,
        productionAnalysisPolicyReasons: ["вероятность меланомы"],
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonProductionAnalysisPolicyPayload({
        ...policy,
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
    deviceEvidenceReadyCount: 1,
    deviceEvidenceReviewCount: 0,
    productionAssetReadyCount: 1,
    productionAssetReviewCount: 1,
    deviceBridgeQualityReadyCount: 0,
    deviceBridgeQualityReviewCount: 0,
    captureProtocolReadyCount: 0,
    captureProtocolReviewCount: 0,
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
      deviceCaptureProfile: "standard_dermoscopy",
      lightingProfile: "polarized",
      focusProfile: "locked",
      distanceProfile: "fixed",
      deviceCalibrationStatus: "valid",
      deviceCalibrationCheckedAt: "2026-05-19T10:40:00.000Z",
    },
    authContext,
    { correlationId: "c10" },
  );
  assert.equal(write.metadata.patientDeliveryAllowed, false);
  assert.equal(auditEvents.at(-1).action, "clinical_asset_capture_metadata.upsert");
  assert.equal(auditEvents.at(-1).metadata.deviceEvidenceStatus, "ready");
  assert.equal(auditEvents.at(-1).metadata.deviceCalibrationStatus, "valid");
  assert.doesNotMatch(
    JSON.stringify(auditEvents),
    /objectBucket|objectKey|storagePath|signedUrl|token|session|qr|doctorOnly|patientSafeText/i,
  );
});

test("Batch BP Stage 5H reviewer assignment normalizer is identity-safe and metadata-only", () => {
  const assignment = normalizeLesionComparisonReviewerAssignmentPayload({
    lesionId: "l-008",
    pairKey: "l-008:i-011+i-012",
    imageIds: ["i-011", "i-012"],
    assignmentStatus: "second_review_required",
    assignmentReasons: ["second_review_required_for_clinical_grade_workflow"],
    assignedReviewerUserId: "10000000-0000-4000-8000-000000000201",
    secondReviewStatus: "required",
    secondReviewReasons: [],
    secondReviewerUserId: "10000000-0000-4000-8000-000000000202",
  });

  assert.equal(assignment.assignmentStatus, "second_review_required");
  assert.equal(assignment.secondReviewStatus, "required");
  assert.equal(assignment.reviewerIdentityExposed, false);
  assert.equal(assignment.medicalMeasurementAllowed, false);
  assert.equal(assignment.patientDeliveryAllowed, false);
  assert.equal(assignment.protectedFieldsExposed, false);
  assert.equal(assignment.clinicalOutputGenerated, false);
  assert.throws(
    () => normalizeLesionComparisonReviewerAssignmentPayload({ ...assignment, reviewerName: "Dr. Private" }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeLesionComparisonReviewerAssignmentPayload({ ...assignment, assignmentReasons: ["вероятность меланомы"] }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeLesionComparisonReviewerAssignmentPayload({
        ...assignment,
        secondReviewerUserId: assignment.assignedReviewerUserId,
      }),
    VisitWorkspaceValidationError,
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

test("Batch BH Stage 5H service persists reviewer workflow with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewLesionComparisonViewerQaReviewerWorkflow(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      workflowStatus: "reviewer_accepted",
      workflowReasons: ["calibrated_reviewer_workflow_ready"],
    },
    authContext,
    { correlationId: "c12b" },
  );

  assert.equal(result.qa.reviewerWorkflow.status, "reviewer_accepted");
  assert.equal(result.qa.reviewerWorkflow.gate.calibrationReady, true);
  assert.equal(result.qa.reviewerWorkflow.gate.medicalMeasurementAllowed, false);
  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_viewer_qa.reviewer_workflow");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    workflowStatus: "reviewer_accepted",
    workflowReasonsCount: 1,
    technicalReviewReady: true,
    calibrationReady: true,
    captureMetadataReady: true,
    markerGateReady: true,
    measurementPolicyApproved: true,
    productionAnalysisPolicyApproved: false,
    reviewerAssignmentReady: true,
    secondReviewReady: true,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalConclusionGenerated: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи|diagnosis|treatment/i,
  );
});

test("Batch BO Stage 5H service persists measurement policy with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewLesionComparisonMeasurementPolicy(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      measurementPolicyStatus: "approved_for_technical_review",
      measurementPolicyReasons: ["technical_measurement_policy_approved_no_mm_output"],
    },
    authContext,
    { correlationId: "c12c" },
  );

  assert.equal(result.qa.measurementPolicy.status, "approved_for_technical_review");
  assert.equal(result.qa.measurementPolicy.medicalMeasurementAllowed, false);
  assert.equal(result.qa.measurementPolicy.patientDeliveryAllowed, false);
  assert.equal(result.qa.measurementPolicy.clinicalOutputGenerated, false);
  assert.equal(result.qa.reviewerWorkflow.gate.measurementPolicyApproved, true);
  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_measurement_policy.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    measurementPolicyStatus: "approved_for_technical_review",
    reasonsCount: 1,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|diameterMm|areaMm2|меланома|рак кожи|diagnosis|treatment|riskScore/i,
  );
});

test("Batch BQ Stage 5H service persists production analysis policy with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewLesionComparisonProductionAnalysisPolicy(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      productionAnalysisPolicyStatus: "approved_for_production_analysis",
      productionAnalysisPolicyReasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
    },
    authContext,
    { correlationId: "c12d" },
  );

  assert.equal(result.qa.productionAnalysisPolicy.status, "approved_for_production_analysis");
  assert.equal(result.qa.productionAnalysisPolicy.medicalMeasurementAllowed, false);
  assert.equal(result.qa.productionAnalysisPolicy.patientDeliveryAllowed, false);
  assert.equal(result.qa.productionAnalysisPolicy.clinicalOutputGenerated, false);
  assert.equal(result.qa.reviewerWorkflow.gate.productionAnalysisPolicyApproved, true);
  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_production_analysis_policy.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    productionAnalysisPolicyStatus: "approved_for_production_analysis",
    reasonsCount: 1,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|dynamicConclusion|меланома|рак кожи|diagnosis|treatment/i,
  );
});

test("Batch BP Stage 5H service persists reviewer assignment with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.assignLesionComparisonReviewer(
    VISIT_ID,
    {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      assignmentStatus: "second_review_required",
      assignmentReasons: ["second_review_required_for_clinical_grade_workflow"],
      assignedReviewerUserId: "10000000-0000-4000-8000-000000000201",
      secondReviewStatus: "required",
      secondReviewReasons: [],
      secondReviewerUserId: "10000000-0000-4000-8000-000000000202",
    },
    authContext,
    { correlationId: "c12d" },
  );

  assert.equal(result.qa.reviewerAssignment.status, "second_review_required");
  assert.equal(result.qa.reviewerAssignment.reviewerIdentityExposed, false);
  assert.equal(result.qa.secondReview.status, "required");
  assert.equal(result.qa.secondReview.reviewerIdentityExposed, false);
  assert.equal(result.qa.medicalMeasurementAllowed, false);
  assert.equal(result.qa.patientDeliveryAllowed, false);
  assert.equal(result.qa.protectedFieldsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_reviewer_assignment.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    lesionId: "l-008",
    assignmentStatus: "second_review_required",
    assignmentReasonsCount: 1,
    secondReviewStatus: "required",
    secondReviewReasonsCount: 0,
    assignedReviewerPresent: true,
    secondReviewerPresent: true,
    reviewerIdentityExposed: false,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  });
  assert.doesNotMatch(
    JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|pairKey|reviewerName|reviewerEmail|10000000-0000-4000-8000-000000000201|10000000-0000-4000-8000-000000000202|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|diameterMm|areaMm2|меланома|рак кожи|diagnosis|treatment|riskScore/i,
  );
});

test("Batch BF Stage 5H service reads viewer QA review queue with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.getVisitLesionComparisonViewerQaReviewQueue(
    VISIT_ID,
    new URLSearchParams("status=actionable&limit=20"),
    authContext,
    { correlationId: "c13" },
  );

  assert.equal(result.queue.summary.actionable, 3);
  assert.equal(result.queue.items[0].review.status, "needs_recapture");
  assert.equal(result.queue.boundaries.patientDeliveryAllowed, false);
  assert.equal(result.queue.boundaries.pairKeysExposed, false);
  assert.equal(result.queue.boundaries.imageIdsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_comparison_viewer_qa.review_queue.read");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    status: "actionable",
    limit: 20,
    total: 3,
    actionable: 3,
    needsRecapture: 1,
    notSuitableForComparison: 1,
    measurementPolicyRequired: 0,
    productionAnalysisPolicyRequired: 0,
    reviewerAssignmentRequired: 1,
    secondReviewRequired: 1,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.queue) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"|"imageIds"|storagePath|signedUrl|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи/i,
  );
});

test("Batch BG Stage 5H service reads longitudinal QA with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.getLesionLongitudinalQa(
    PATIENT_ID,
    "10000000-0000-4000-8000-000000000801",
    authContext,
    { correlationId: "c14" },
  );

  assert.equal(result.qa.readiness.status, "blocked");
  assert.equal(result.qa.readiness.needsRecaptureCount, 1);
  assert.equal(result.qa.boundaries.patientDeliveryAllowed, false);
  assert.equal(result.qa.boundaries.pairKeysExposed, false);
  assert.equal(result.qa.boundaries.imageIdsExposed, false);
  assert.equal(auditEvents.at(-1).action, "lesion_longitudinal_qa.read");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    status: "blocked",
    candidatePairCount: 2,
    technicalReadyPairCount: 1,
    needsRecaptureCount: 1,
    notSuitableForComparisonCount: 0,
    unreviewedPairCount: 0,
    deviceEvidenceNotReadyCount: 1,
    productionAssetNotReadyCount: 1,
    deviceBridgeQualityNotReadyCount: 1,
    captureProtocolNotReadyCount: 0,
    measurementPolicyNotReadyCount: 0,
    productionAnalysisPolicyNotReadyCount: 0,
    technicalRolloutReady: false,
    dynamicConclusionAllowed: false,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.qa) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи/i,
  );
});

test("Batch BJ Stage 5H service reads visit dataset validation with audit-safe metadata", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.getVisitLongitudinalDatasetValidation(VISIT_ID, authContext, { correlationId: "c15" });

  assert.equal(result.validation.readiness.status, "blocked");
  assert.equal(result.validation.readiness.blockedTimelineCount, 1);
  assert.equal(result.validation.boundaries.patientDeliveryAllowed, false);
  assert.equal(result.validation.boundaries.medicalMeasurementAllowed, false);
  assert.equal(result.validation.boundaries.pairKeysExposed, false);
  assert.equal(result.validation.boundaries.imageIdsExposed, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_dataset_validation.read");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    status: "blocked",
    lesionCount: 2,
    timelineCandidateCount: 2,
    readyTimelineCount: 1,
    needsReviewTimelineCount: 0,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    deviceEvidenceNotReadyCount: 1,
    productionAssetNotReadyCount: 1,
    deviceBridgeQualityNotReadyCount: 1,
    captureProtocolNotReadyCount: 0,
    measurementPolicyNotReadyCount: 0,
    productionAnalysisPolicyNotReadyCount: 0,
    dynamicConclusionAllowed: false,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.validation) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|меланома|рак кожи/i,
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
