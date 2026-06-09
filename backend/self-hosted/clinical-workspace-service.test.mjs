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
  normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload,
  normalizeVisitLongitudinalTimelineRolloutEvidencePayload,
  normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload,
  normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload,
  normalizeVisitLongitudinalTimelineRolloutMonitoringPayload,
  normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload,
  normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload,
  normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload,
  normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload,
  normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload,
  normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload,
  normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload,
  normalizeVisitLongitudinalTimelineRolloutSopPayload,
  normalizeLesionComparisonViewerQaReviewPayload,
  normalizeLesionComparisonViewerQaReviewerWorkflowPayload,
  normalizeVisitLongitudinalTimelineRolloutPayload,
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
        timelineRollout: {
          id: "rollout-review-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          status: "review_required",
          reasons: ["timeline_dataset_not_ready"],
          validationStatus: "blocked",
          lesionCount: 2,
          readyTimelineCount: 1,
          needsReviewTimelineCount: 0,
          blockedTimelineCount: 1,
          candidatePairCount: 3,
          reviewerWorkflowReadyCount: 1,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
        timelineRolloutSop: {
          id: "sop-review-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          status: "not_started",
          reasons: [],
          validationStatus: "blocked",
          rolloutStatus: "review_required",
          datasetValidationStatus: "missing",
          reviewerOperationsStatus: "missing",
          rollbackPlanStatus: "missing",
          monitoringPlanStatus: "missing",
          rolloutWindowStatus: "missing",
          ownerAckStatus: "missing",
          lesionCount: 0,
          readyTimelineCount: 0,
          blockedTimelineCount: 0,
          candidatePairCount: 0,
          reviewerWorkflowReadyCount: 0,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
        timelineRolloutEvidence: {
          id: "evidence-review-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          status: "not_started",
          reasons: [],
          sopStatus: "not_started",
          validationStatus: "blocked",
          rolloutStatus: "review_required",
          monitoringEvidenceStatus: "missing",
          sampleAuditStatus: "missing",
          exceptionLogStatus: "missing",
          rollbackDrillStatus: "missing",
          ownerSignoffStatus: "missing",
          monitoringWindowDays: 0,
          sampledTimelineCount: 0,
          exceptionCount: 0,
          rollbackDrillCount: 0,
          lesionCount: 0,
          readyTimelineCount: 0,
          blockedTimelineCount: 0,
          candidatePairCount: 0,
          reviewerWorkflowReadyCount: 0,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
        timelineRolloutMonitoring: {
          id: "monitoring-review-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          status: "not_started",
          reasons: [],
          evidenceStatus: "not_started",
          sopStatus: "not_started",
          validationStatus: "blocked",
          rolloutStatus: "review_required",
          outcomeSamplingStatus: "missing",
          incidentReviewStatus: "missing",
          exceptionClosureStatus: "missing",
          rollbackOutcomeStatus: "missing",
          ownerFinalReviewStatus: "missing",
          monitoringWindowDays: 0,
          monitoredTimelineCount: 0,
          sampledTimelineCount: 0,
          incidentCount: 0,
          unresolvedIncidentCount: 0,
          closedExceptionCount: 0,
          rollbackExecutionCount: 0,
          lesionCount: 0,
          readyTimelineCount: 0,
          blockedTimelineCount: 0,
          candidatePairCount: 0,
          reviewerWorkflowReadyCount: 0,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
        timelineRolloutIncidentProcedure: {
          id: "incident-procedure-review-1",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          status: "not_started",
          reasons: [],
          monitoringStatus: "not_started",
          evidenceStatus: "not_started",
          sopStatus: "not_started",
          validationStatus: "blocked",
          rolloutStatus: "review_required",
          realDatasetStatus: "missing",
          outcomeSamplingProcedureStatus: "missing",
          incidentTriageStatus: "missing",
          escalationPathStatus: "missing",
          rollbackDecisionStatus: "missing",
          ownerReviewStatus: "missing",
          realDatasetTimelineCount: 0,
          monitoredTimelineCount: 0,
          sampledOutcomeCount: 0,
          incidentCaseCount: 0,
          unresolvedIncidentCount: 0,
          escalatedIncidentCount: 0,
          rollbackDecisionCount: 0,
          lesionCount: 0,
          readyTimelineCount: 0,
          blockedTimelineCount: 0,
          candidatePairCount: 0,
          reviewerWorkflowReadyCount: 0,
          patientDeliveryAllowed: false,
          medicalMeasurementAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
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
    async reviewVisitLongitudinalTimelineRollout({ rollout }) {
      return {
        id: "rollout-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: rollout.rolloutStatus,
        reasons: rollout.rolloutReasons,
        validationStatus: rollout.validationStatus,
        lesionCount: rollout.lesionCount,
        readyTimelineCount: rollout.readyTimelineCount,
        needsReviewTimelineCount: rollout.needsReviewTimelineCount,
        blockedTimelineCount: rollout.blockedTimelineCount,
        candidatePairCount: rollout.candidatePairCount,
        reviewerWorkflowReadyCount: rollout.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-04T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutSop({ sop }) {
      return {
        id: "sop-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: sop.sopStatus,
        reasons: sop.sopReasons,
        validationStatus: sop.validationStatus,
        rolloutStatus: sop.rolloutStatus,
        datasetValidationStatus: sop.datasetValidationStatus,
        reviewerOperationsStatus: sop.reviewerOperationsStatus,
        rollbackPlanStatus: sop.rollbackPlanStatus,
        monitoringPlanStatus: sop.monitoringPlanStatus,
        rolloutWindowStatus: sop.rolloutWindowStatus,
        ownerAckStatus: sop.ownerAckStatus,
        lesionCount: sop.lesionCount,
        readyTimelineCount: sop.readyTimelineCount,
        blockedTimelineCount: sop.blockedTimelineCount,
        candidatePairCount: sop.candidatePairCount,
        reviewerWorkflowReadyCount: sop.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-04T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutEvidence({ evidence }) {
      return {
        id: "evidence-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: evidence.evidenceStatus,
        reasons: evidence.evidenceReasons,
        sopStatus: evidence.sopStatus,
        validationStatus: evidence.validationStatus,
        rolloutStatus: evidence.rolloutStatus,
        monitoringEvidenceStatus: evidence.monitoringEvidenceStatus,
        sampleAuditStatus: evidence.sampleAuditStatus,
        exceptionLogStatus: evidence.exceptionLogStatus,
        rollbackDrillStatus: evidence.rollbackDrillStatus,
        ownerSignoffStatus: evidence.ownerSignoffStatus,
        monitoringWindowDays: evidence.monitoringWindowDays,
        sampledTimelineCount: evidence.sampledTimelineCount,
        exceptionCount: evidence.exceptionCount,
        rollbackDrillCount: evidence.rollbackDrillCount,
        lesionCount: evidence.lesionCount,
        readyTimelineCount: evidence.readyTimelineCount,
        blockedTimelineCount: evidence.blockedTimelineCount,
        candidatePairCount: evidence.candidatePairCount,
        reviewerWorkflowReadyCount: evidence.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-04T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutMonitoring({ monitoring }) {
      return {
        id: "monitoring-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: monitoring.monitoringStatus,
        reasons: monitoring.monitoringReasons,
        evidenceStatus: monitoring.evidenceStatus,
        sopStatus: monitoring.sopStatus,
        validationStatus: monitoring.validationStatus,
        rolloutStatus: monitoring.rolloutStatus,
        outcomeSamplingStatus: monitoring.outcomeSamplingStatus,
        incidentReviewStatus: monitoring.incidentReviewStatus,
        exceptionClosureStatus: monitoring.exceptionClosureStatus,
        rollbackOutcomeStatus: monitoring.rollbackOutcomeStatus,
        ownerFinalReviewStatus: monitoring.ownerFinalReviewStatus,
        monitoringWindowDays: monitoring.monitoringWindowDays,
        monitoredTimelineCount: monitoring.monitoredTimelineCount,
        sampledTimelineCount: monitoring.sampledTimelineCount,
        incidentCount: monitoring.incidentCount,
        unresolvedIncidentCount: monitoring.unresolvedIncidentCount,
        closedExceptionCount: monitoring.closedExceptionCount,
        rollbackExecutionCount: monitoring.rollbackExecutionCount,
        lesionCount: monitoring.lesionCount,
        readyTimelineCount: monitoring.readyTimelineCount,
        blockedTimelineCount: monitoring.blockedTimelineCount,
        candidatePairCount: monitoring.candidatePairCount,
        reviewerWorkflowReadyCount: monitoring.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-04T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutIncidentProcedure({ procedure }) {
      return {
        id: "incident-procedure-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: procedure.procedureStatus,
        reasons: procedure.procedureReasons,
        monitoringStatus: procedure.monitoringStatus,
        evidenceStatus: procedure.evidenceStatus,
        sopStatus: procedure.sopStatus,
        validationStatus: procedure.validationStatus,
        rolloutStatus: procedure.rolloutStatus,
        realDatasetStatus: procedure.realDatasetStatus,
        outcomeSamplingProcedureStatus: procedure.outcomeSamplingProcedureStatus,
        incidentTriageStatus: procedure.incidentTriageStatus,
        escalationPathStatus: procedure.escalationPathStatus,
        rollbackDecisionStatus: procedure.rollbackDecisionStatus,
        ownerReviewStatus: procedure.ownerReviewStatus,
        realDatasetTimelineCount: procedure.realDatasetTimelineCount,
        monitoredTimelineCount: procedure.monitoredTimelineCount,
        sampledOutcomeCount: procedure.sampledOutcomeCount,
        incidentCaseCount: procedure.incidentCaseCount,
        unresolvedIncidentCount: procedure.unresolvedIncidentCount,
        escalatedIncidentCount: procedure.escalatedIncidentCount,
        rollbackDecisionCount: procedure.rollbackDecisionCount,
        lesionCount: procedure.lesionCount,
        readyTimelineCount: procedure.readyTimelineCount,
        blockedTimelineCount: procedure.blockedTimelineCount,
        candidatePairCount: procedure.candidatePairCount,
        reviewerWorkflowReadyCount: procedure.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-04T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutClinicalValidation({ clinicalValidation }) {
      return {
        id: "clinical-validation-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: clinicalValidation.clinicalValidationStatus,
        reasons: clinicalValidation.clinicalValidationReasons,
        incidentProcedureStatus: clinicalValidation.incidentProcedureStatus,
        monitoringStatus: clinicalValidation.monitoringStatus,
        evidenceStatus: clinicalValidation.evidenceStatus,
        sopStatus: clinicalValidation.sopStatus,
        validationStatus: clinicalValidation.validationStatus,
        rolloutStatus: clinicalValidation.rolloutStatus,
        realDatasetLockStatus: clinicalValidation.realDatasetLockStatus,
        validatorTrainingStatus: clinicalValidation.validatorTrainingStatus,
        blindedSampleStatus: clinicalValidation.blindedSampleStatus,
        adjudicationStatus: clinicalValidation.adjudicationStatus,
        decisionLogStatus: clinicalValidation.decisionLogStatus,
        ownerAcceptanceStatus: clinicalValidation.ownerAcceptanceStatus,
        realDatasetTimelineCount: clinicalValidation.realDatasetTimelineCount,
        validationSampleCount: clinicalValidation.validationSampleCount,
        disagreementCaseCount: clinicalValidation.disagreementCaseCount,
        adjudicatedCaseCount: clinicalValidation.adjudicatedCaseCount,
        followupWindowDays: clinicalValidation.followupWindowDays,
        blockerCount: clinicalValidation.blockerCount,
        lesionCount: clinicalValidation.lesionCount,
        readyTimelineCount: clinicalValidation.readyTimelineCount,
        blockedTimelineCount: clinicalValidation.blockedTimelineCount,
        candidatePairCount: clinicalValidation.candidatePairCount,
        reviewerWorkflowReadyCount: clinicalValidation.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-05T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring({ postValidationMonitoring }) {
      return {
        id: "post-validation-monitoring-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: postValidationMonitoring.postValidationMonitoringStatus,
        reasons: postValidationMonitoring.postValidationMonitoringReasons,
        clinicalValidationStatus: postValidationMonitoring.clinicalValidationStatus,
        incidentProcedureStatus: postValidationMonitoring.incidentProcedureStatus,
        monitoringStatus: postValidationMonitoring.monitoringStatus,
        evidenceStatus: postValidationMonitoring.evidenceStatus,
        sopStatus: postValidationMonitoring.sopStatus,
        validationStatus: postValidationMonitoring.validationStatus,
        rolloutStatus: postValidationMonitoring.rolloutStatus,
        monitoringWindowStatus: postValidationMonitoring.monitoringWindowStatus,
        outcomeReviewStatus: postValidationMonitoring.outcomeReviewStatus,
        driftReviewStatus: postValidationMonitoring.driftReviewStatus,
        incidentFollowupStatus: postValidationMonitoring.incidentFollowupStatus,
        validatorRecheckStatus: postValidationMonitoring.validatorRecheckStatus,
        ownerSignoffStatus: postValidationMonitoring.ownerSignoffStatus,
        realDatasetTimelineCount: postValidationMonitoring.realDatasetTimelineCount,
        clinicalValidationSampleCount: postValidationMonitoring.clinicalValidationSampleCount,
        monitoredTimelineCount: postValidationMonitoring.monitoredTimelineCount,
        sampledOutcomeCount: postValidationMonitoring.sampledOutcomeCount,
        driftSignalCount: postValidationMonitoring.driftSignalCount,
        unresolvedDriftSignalCount: postValidationMonitoring.unresolvedDriftSignalCount,
        incidentFollowupCount: postValidationMonitoring.incidentFollowupCount,
        unresolvedIncidentFollowupCount: postValidationMonitoring.unresolvedIncidentFollowupCount,
        validatorRecheckCount: postValidationMonitoring.validatorRecheckCount,
        blockerCount: postValidationMonitoring.blockerCount,
        lesionCount: postValidationMonitoring.lesionCount,
        readyTimelineCount: postValidationMonitoring.readyTimelineCount,
        blockedTimelineCount: postValidationMonitoring.blockedTimelineCount,
        candidatePairCount: postValidationMonitoring.candidatePairCount,
        reviewerWorkflowReadyCount: postValidationMonitoring.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-05T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutObservationGovernance({ observationGovernance }) {
      return {
        id: "observation-governance-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: observationGovernance.observationGovernanceStatus,
        reasons: observationGovernance.observationGovernanceReasons,
        postValidationMonitoringStatus: observationGovernance.postValidationMonitoringStatus,
        clinicalValidationStatus: observationGovernance.clinicalValidationStatus,
        incidentProcedureStatus: observationGovernance.incidentProcedureStatus,
        monitoringStatus: observationGovernance.monitoringStatus,
        evidenceStatus: observationGovernance.evidenceStatus,
        sopStatus: observationGovernance.sopStatus,
        validationStatus: observationGovernance.validationStatus,
        rolloutStatus: observationGovernance.rolloutStatus,
        observationWindowStatus: observationGovernance.observationWindowStatus,
        outcomeObservationStatus: observationGovernance.outcomeObservationStatus,
        driftSignalReviewStatus: observationGovernance.driftSignalReviewStatus,
        incidentOutcomeReviewStatus: observationGovernance.incidentOutcomeReviewStatus,
        followupClosureStatus: observationGovernance.followupClosureStatus,
        governanceReviewStatus: observationGovernance.governanceReviewStatus,
        ownerSignoffStatus: observationGovernance.ownerSignoffStatus,
        realDatasetTimelineCount: observationGovernance.realDatasetTimelineCount,
        postValidationSampleCount: observationGovernance.postValidationSampleCount,
        observedTimelineCount: observationGovernance.observedTimelineCount,
        expectedFollowupCount: observationGovernance.expectedFollowupCount,
        completedFollowupCount: observationGovernance.completedFollowupCount,
        driftSignalCount: observationGovernance.driftSignalCount,
        unresolvedDriftSignalCount: observationGovernance.unresolvedDriftSignalCount,
        incidentOutcomeCount: observationGovernance.incidentOutcomeCount,
        unresolvedIncidentOutcomeCount: observationGovernance.unresolvedIncidentOutcomeCount,
        governanceExceptionCount: observationGovernance.governanceExceptionCount,
        unresolvedGovernanceExceptionCount: observationGovernance.unresolvedGovernanceExceptionCount,
        blockerCount: observationGovernance.blockerCount,
        lesionCount: observationGovernance.lesionCount,
        readyTimelineCount: observationGovernance.readyTimelineCount,
        blockedTimelineCount: observationGovernance.blockedTimelineCount,
        candidatePairCount: observationGovernance.candidatePairCount,
        reviewerWorkflowReadyCount: observationGovernance.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-06T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutExceptionGovernance({ exceptionGovernance }) {
      return {
        id: "exception-governance-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: exceptionGovernance.exceptionGovernanceStatus,
        reasons: exceptionGovernance.exceptionGovernanceReasons,
        observationGovernanceStatus: exceptionGovernance.observationGovernanceStatus,
        postValidationMonitoringStatus: exceptionGovernance.postValidationMonitoringStatus,
        clinicalValidationStatus: exceptionGovernance.clinicalValidationStatus,
        incidentProcedureStatus: exceptionGovernance.incidentProcedureStatus,
        monitoringStatus: exceptionGovernance.monitoringStatus,
        evidenceStatus: exceptionGovernance.evidenceStatus,
        sopStatus: exceptionGovernance.sopStatus,
        validationStatus: exceptionGovernance.validationStatus,
        rolloutStatus: exceptionGovernance.rolloutStatus,
        exceptionRegisterStatus: exceptionGovernance.exceptionRegisterStatus,
        triageSlaStatus: exceptionGovernance.triageSlaStatus,
        resolutionEvidenceStatus: exceptionGovernance.resolutionEvidenceStatus,
        recurrenceReviewStatus: exceptionGovernance.recurrenceReviewStatus,
        rollbackReadinessStatus: exceptionGovernance.rollbackReadinessStatus,
        governanceArchiveStatus: exceptionGovernance.governanceArchiveStatus,
        ownerSignoffStatus: exceptionGovernance.ownerSignoffStatus,
        realDatasetTimelineCount: exceptionGovernance.realDatasetTimelineCount,
        observedTimelineCount: exceptionGovernance.observedTimelineCount,
        governanceExceptionCount: exceptionGovernance.governanceExceptionCount,
        resolvedGovernanceExceptionCount: exceptionGovernance.resolvedGovernanceExceptionCount,
        unresolvedGovernanceExceptionCount: exceptionGovernance.unresolvedGovernanceExceptionCount,
        recurrenceSignalCount: exceptionGovernance.recurrenceSignalCount,
        unresolvedRecurrenceSignalCount: exceptionGovernance.unresolvedRecurrenceSignalCount,
        rollbackDrillCount: exceptionGovernance.rollbackDrillCount,
        blockerCount: exceptionGovernance.blockerCount,
        lesionCount: exceptionGovernance.lesionCount,
        readyTimelineCount: exceptionGovernance.readyTimelineCount,
        blockedTimelineCount: exceptionGovernance.blockedTimelineCount,
        candidatePairCount: exceptionGovernance.candidatePairCount,
        reviewerWorkflowReadyCount: exceptionGovernance.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-06T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutOutcomeGovernance({ outcomeGovernance }) {
      return {
        id: "outcome-governance-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: outcomeGovernance.outcomeGovernanceStatus,
        reasons: outcomeGovernance.outcomeGovernanceReasons,
        exceptionGovernanceStatus: outcomeGovernance.exceptionGovernanceStatus,
        observationGovernanceStatus: outcomeGovernance.observationGovernanceStatus,
        postValidationMonitoringStatus: outcomeGovernance.postValidationMonitoringStatus,
        clinicalValidationStatus: outcomeGovernance.clinicalValidationStatus,
        incidentProcedureStatus: outcomeGovernance.incidentProcedureStatus,
        monitoringStatus: outcomeGovernance.monitoringStatus,
        evidenceStatus: outcomeGovernance.evidenceStatus,
        sopStatus: outcomeGovernance.sopStatus,
        validationStatus: outcomeGovernance.validationStatus,
        rolloutStatus: outcomeGovernance.rolloutStatus,
        longitudinalWindowStatus: outcomeGovernance.longitudinalWindowStatus,
        realDatasetCoverageStatus: outcomeGovernance.realDatasetCoverageStatus,
        reviewerOperationsValidationStatus: outcomeGovernance.reviewerOperationsValidationStatus,
        exceptionTrendReviewStatus: outcomeGovernance.exceptionTrendReviewStatus,
        followupCadenceStatus: outcomeGovernance.followupCadenceStatus,
        governanceCadenceStatus: outcomeGovernance.governanceCadenceStatus,
        ownerSignoffStatus: outcomeGovernance.ownerSignoffStatus,
        realDatasetTimelineCount: outcomeGovernance.realDatasetTimelineCount,
        observedTimelineCount: outcomeGovernance.observedTimelineCount,
        followupWindowCount: outcomeGovernance.followupWindowCount,
        completedFollowupCount: outcomeGovernance.completedFollowupCount,
        governanceExceptionCount: outcomeGovernance.governanceExceptionCount,
        unresolvedGovernanceExceptionCount: outcomeGovernance.unresolvedGovernanceExceptionCount,
        recurrenceSignalCount: outcomeGovernance.recurrenceSignalCount,
        unresolvedRecurrenceSignalCount: outcomeGovernance.unresolvedRecurrenceSignalCount,
        governanceReviewCount: outcomeGovernance.governanceReviewCount,
        blockerCount: outcomeGovernance.blockerCount,
        lesionCount: outcomeGovernance.lesionCount,
        readyTimelineCount: outcomeGovernance.readyTimelineCount,
        blockedTimelineCount: outcomeGovernance.blockedTimelineCount,
        candidatePairCount: outcomeGovernance.candidatePairCount,
        reviewerWorkflowReadyCount: outcomeGovernance.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-06T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation({ longitudinalClinicalValidation }) {
      return {
        id: "longitudinal-clinical-validation-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: longitudinalClinicalValidation.longitudinalClinicalValidationStatus,
        reasons: longitudinalClinicalValidation.longitudinalClinicalValidationReasons,
        outcomeGovernanceStatus: longitudinalClinicalValidation.outcomeGovernanceStatus,
        exceptionGovernanceStatus: longitudinalClinicalValidation.exceptionGovernanceStatus,
        observationGovernanceStatus: longitudinalClinicalValidation.observationGovernanceStatus,
        postValidationMonitoringStatus: longitudinalClinicalValidation.postValidationMonitoringStatus,
        clinicalValidationStatus: longitudinalClinicalValidation.clinicalValidationStatus,
        incidentProcedureStatus: longitudinalClinicalValidation.incidentProcedureStatus,
        monitoringStatus: longitudinalClinicalValidation.monitoringStatus,
        evidenceStatus: longitudinalClinicalValidation.evidenceStatus,
        sopStatus: longitudinalClinicalValidation.sopStatus,
        validationStatus: longitudinalClinicalValidation.validationStatus,
        rolloutStatus: longitudinalClinicalValidation.rolloutStatus,
        outcomeWindowStatus: longitudinalClinicalValidation.outcomeWindowStatus,
        clinicianCoverageStatus: longitudinalClinicalValidation.clinicianCoverageStatus,
        adjudicationStatus: longitudinalClinicalValidation.adjudicationStatus,
        consensusReviewStatus: longitudinalClinicalValidation.consensusReviewStatus,
        followupValidationStatus: longitudinalClinicalValidation.followupValidationStatus,
        governanceCadenceStatus: longitudinalClinicalValidation.governanceCadenceStatus,
        ownerSignoffStatus: longitudinalClinicalValidation.ownerSignoffStatus,
        realOutcomeWindowCount: longitudinalClinicalValidation.realOutcomeWindowCount,
        clinicallyValidatedWindowCount: longitudinalClinicalValidation.clinicallyValidatedWindowCount,
        adjudicatedWindowCount: longitudinalClinicalValidation.adjudicatedWindowCount,
        followupValidatedWindowCount: longitudinalClinicalValidation.followupValidatedWindowCount,
        consensusReviewCount: longitudinalClinicalValidation.consensusReviewCount,
        unresolvedConsensusCaseCount: longitudinalClinicalValidation.unresolvedConsensusCaseCount,
        governanceReviewCount: longitudinalClinicalValidation.governanceReviewCount,
        blockerCount: longitudinalClinicalValidation.blockerCount,
        lesionCount: longitudinalClinicalValidation.lesionCount,
        readyTimelineCount: longitudinalClinicalValidation.readyTimelineCount,
        blockedTimelineCount: longitudinalClinicalValidation.blockedTimelineCount,
        candidatePairCount: longitudinalClinicalValidation.candidatePairCount,
        reviewerWorkflowReadyCount: longitudinalClinicalValidation.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-08T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerValidation({ protectedReviewerValidation }) {
      return {
        id: "protected-reviewer-validation-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: protectedReviewerValidation.protectedReviewerValidationStatus,
        reasons: protectedReviewerValidation.protectedReviewerValidationReasons,
        longitudinalClinicalValidationStatus: protectedReviewerValidation.longitudinalClinicalValidationStatus,
        outcomeGovernanceStatus: protectedReviewerValidation.outcomeGovernanceStatus,
        exceptionGovernanceStatus: protectedReviewerValidation.exceptionGovernanceStatus,
        observationGovernanceStatus: protectedReviewerValidation.observationGovernanceStatus,
        postValidationMonitoringStatus: protectedReviewerValidation.postValidationMonitoringStatus,
        clinicalValidationStatus: protectedReviewerValidation.clinicalValidationStatus,
        incidentProcedureStatus: protectedReviewerValidation.incidentProcedureStatus,
        monitoringStatus: protectedReviewerValidation.monitoringStatus,
        evidenceStatus: protectedReviewerValidation.evidenceStatus,
        sopStatus: protectedReviewerValidation.sopStatus,
        validationStatus: protectedReviewerValidation.validationStatus,
        rolloutStatus: protectedReviewerValidation.rolloutStatus,
        protectedAssetWindowStatus: protectedReviewerValidation.protectedAssetWindowStatus,
        protectedRenderStatus: protectedReviewerValidation.protectedRenderStatus,
        reviewerAssignmentStatus: protectedReviewerValidation.reviewerAssignmentStatus,
        secondReviewStatus: protectedReviewerValidation.secondReviewStatus,
        adjudicationOpsStatus: protectedReviewerValidation.adjudicationOpsStatus,
        followupOpsStatus: protectedReviewerValidation.followupOpsStatus,
        ownerSignoffStatus: protectedReviewerValidation.ownerSignoffStatus,
        protectedAssetTimelineCount: protectedReviewerValidation.protectedAssetTimelineCount,
        protectedRenderReadyCount: protectedReviewerValidation.protectedRenderReadyCount,
        reviewerAssignedProtectedCount: protectedReviewerValidation.reviewerAssignedProtectedCount,
        secondReviewedProtectedCount: protectedReviewerValidation.secondReviewedProtectedCount,
        adjudicatedProtectedCount: protectedReviewerValidation.adjudicatedProtectedCount,
        followupValidatedProtectedCount: protectedReviewerValidation.followupValidatedProtectedCount,
        unresolvedProtectedReviewCount: protectedReviewerValidation.unresolvedProtectedReviewCount,
        blockerCount: protectedReviewerValidation.blockerCount,
        lesionCount: protectedReviewerValidation.lesionCount,
        readyTimelineCount: protectedReviewerValidation.readyTimelineCount,
        blockedTimelineCount: protectedReviewerValidation.blockedTimelineCount,
        candidatePairCount: protectedReviewerValidation.candidatePairCount,
        reviewerWorkflowReadyCount: protectedReviewerValidation.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-08T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernance({ protectedReviewerGovernance }) {
      return {
        id: "protected-reviewer-governance-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: protectedReviewerGovernance.protectedReviewerGovernanceStatus,
        reasons: protectedReviewerGovernance.protectedReviewerGovernanceReasons,
        protectedReviewerValidationStatus: protectedReviewerGovernance.protectedReviewerValidationStatus,
        longitudinalClinicalValidationStatus: protectedReviewerGovernance.longitudinalClinicalValidationStatus,
        outcomeGovernanceStatus: protectedReviewerGovernance.outcomeGovernanceStatus,
        exceptionGovernanceStatus: protectedReviewerGovernance.exceptionGovernanceStatus,
        observationGovernanceStatus: protectedReviewerGovernance.observationGovernanceStatus,
        postValidationMonitoringStatus: protectedReviewerGovernance.postValidationMonitoringStatus,
        clinicalValidationStatus: protectedReviewerGovernance.clinicalValidationStatus,
        incidentProcedureStatus: protectedReviewerGovernance.incidentProcedureStatus,
        monitoringStatus: protectedReviewerGovernance.monitoringStatus,
        evidenceStatus: protectedReviewerGovernance.evidenceStatus,
        sopStatus: protectedReviewerGovernance.sopStatus,
        validationStatus: protectedReviewerGovernance.validationStatus,
        rolloutStatus: protectedReviewerGovernance.rolloutStatus,
        reviewerMonitoringStatus: protectedReviewerGovernance.reviewerMonitoringStatus,
        reviewerExceptionStatus: protectedReviewerGovernance.reviewerExceptionStatus,
        reviewerAdjudicationStatus: protectedReviewerGovernance.reviewerAdjudicationStatus,
        reviewerFollowupStatus: protectedReviewerGovernance.reviewerFollowupStatus,
        reviewerRollbackStatus: protectedReviewerGovernance.reviewerRollbackStatus,
        reviewerArchiveStatus: protectedReviewerGovernance.reviewerArchiveStatus,
        ownerSignoffStatus: protectedReviewerGovernance.ownerSignoffStatus,
        protectedReviewWindowCount: protectedReviewerGovernance.protectedReviewWindowCount,
        monitoredProtectedReviewCount: protectedReviewerGovernance.monitoredProtectedReviewCount,
        escalatedProtectedReviewCount: protectedReviewerGovernance.escalatedProtectedReviewCount,
        adjudicatedProtectedGovernanceCount: protectedReviewerGovernance.adjudicatedProtectedGovernanceCount,
        followupClosedProtectedCount: protectedReviewerGovernance.followupClosedProtectedCount,
        rollbackReadyProtectedCount: protectedReviewerGovernance.rollbackReadyProtectedCount,
        archivedProtectedReviewCount: protectedReviewerGovernance.archivedProtectedReviewCount,
        unresolvedGovernanceReviewCount: protectedReviewerGovernance.unresolvedGovernanceReviewCount,
        blockerCount: protectedReviewerGovernance.blockerCount,
        lesionCount: protectedReviewerGovernance.lesionCount,
        readyTimelineCount: protectedReviewerGovernance.readyTimelineCount,
        blockedTimelineCount: protectedReviewerGovernance.blockedTimelineCount,
        candidatePairCount: protectedReviewerGovernance.candidatePairCount,
        reviewerWorkflowReadyCount: protectedReviewerGovernance.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-09T00:00:00.000Z",
      };
    },
    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidence({ protectedReviewerEvidence }) {
      return {
        id: "protected-reviewer-evidence-review-1",
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        status: protectedReviewerEvidence.protectedReviewerEvidenceStatus,
        reasons: protectedReviewerEvidence.protectedReviewerEvidenceReasons,
        protectedReviewerGovernanceStatus: protectedReviewerEvidence.protectedReviewerGovernanceStatus,
        protectedReviewerValidationStatus: protectedReviewerEvidence.protectedReviewerValidationStatus,
        longitudinalClinicalValidationStatus: protectedReviewerEvidence.longitudinalClinicalValidationStatus,
        outcomeGovernanceStatus: protectedReviewerEvidence.outcomeGovernanceStatus,
        exceptionGovernanceStatus: protectedReviewerEvidence.exceptionGovernanceStatus,
        observationGovernanceStatus: protectedReviewerEvidence.observationGovernanceStatus,
        postValidationMonitoringStatus: protectedReviewerEvidence.postValidationMonitoringStatus,
        clinicalValidationStatus: protectedReviewerEvidence.clinicalValidationStatus,
        incidentProcedureStatus: protectedReviewerEvidence.incidentProcedureStatus,
        monitoringStatus: protectedReviewerEvidence.monitoringStatus,
        evidenceStatus: protectedReviewerEvidence.evidenceStatus,
        sopStatus: protectedReviewerEvidence.sopStatus,
        validationStatus: protectedReviewerEvidence.validationStatus,
        rolloutStatus: protectedReviewerEvidence.rolloutStatus,
        reviewerMonitoringEvidenceStatus: protectedReviewerEvidence.reviewerMonitoringEvidenceStatus,
        reviewerExceptionEvidenceStatus: protectedReviewerEvidence.reviewerExceptionEvidenceStatus,
        reviewerAdjudicationEvidenceStatus: protectedReviewerEvidence.reviewerAdjudicationEvidenceStatus,
        reviewerFollowupEvidenceStatus: protectedReviewerEvidence.reviewerFollowupEvidenceStatus,
        reviewerRollbackEvidenceStatus: protectedReviewerEvidence.reviewerRollbackEvidenceStatus,
        reviewerArchiveEvidenceStatus: protectedReviewerEvidence.reviewerArchiveEvidenceStatus,
        ownerSignoffStatus: protectedReviewerEvidence.ownerSignoffStatus,
        protectedReviewWindowCount: protectedReviewerEvidence.protectedReviewWindowCount,
        monitoredProtectedReviewCount: protectedReviewerEvidence.monitoredProtectedReviewCount,
        sampledProtectedReviewCount: protectedReviewerEvidence.sampledProtectedReviewCount,
        adjudicatedProtectedEvidenceCount: protectedReviewerEvidence.adjudicatedProtectedEvidenceCount,
        followupClosedProtectedCount: protectedReviewerEvidence.followupClosedProtectedCount,
        rollbackDrillProtectedCount: protectedReviewerEvidence.rollbackDrillProtectedCount,
        archivedProtectedReviewCount: protectedReviewerEvidence.archivedProtectedReviewCount,
        unresolvedProtectedEvidenceCount: protectedReviewerEvidence.unresolvedProtectedEvidenceCount,
        blockerCount: protectedReviewerEvidence.blockerCount,
        lesionCount: protectedReviewerEvidence.lesionCount,
        readyTimelineCount: protectedReviewerEvidence.readyTimelineCount,
        blockedTimelineCount: protectedReviewerEvidence.blockedTimelineCount,
        candidatePairCount: protectedReviewerEvidence.candidatePairCount,
        reviewerWorkflowReadyCount: protectedReviewerEvidence.reviewerWorkflowReadyCount,
        patientDeliveryAllowed: false,
        medicalMeasurementAllowed: false,
        protectedFieldsExposed: false,
        clinicalOutputGenerated: false,
        reviewedAt: "2026-06-09T00:00:00.000Z",
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

test("Batch BR Stage 5H service reviews timeline rollout with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRollout(
    VISIT_ID,
    {
      rolloutStatus: "approved_for_clinical_operations",
      rolloutReasons: ["timeline_rollout_governance_approved_no_dynamic_conclusion"],
    },
    authContext,
    { correlationId: "c16" },
  );

  assert.equal(result.rollout.status, "review_required");
  assert.deepEqual(result.rollout.reasons, [
    "timeline_rollout_governance_approved_no_dynamic_conclusion",
    "timeline_dataset_not_ready",
  ]);
  assert.equal(result.rollout.validationStatus, "blocked");
  assert.equal(result.rollout.patientDeliveryAllowed, false);
  assert.equal(result.rollout.medicalMeasurementAllowed, false);
  assert.equal(result.rollout.protectedFieldsExposed, false);
  assert.equal(result.rollout.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    rolloutStatus: "review_required",
    validationStatus: "blocked",
    lesionCount: 2,
    readyTimelineCount: 1,
    needsReviewTimelineCount: 0,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.rollout) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BR Stage 5H timeline rollout payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutPayload({
        rolloutStatus: "approved_for_clinical_operations",
        rolloutReasons: ["готово"],
        dynamicConclusion: "рост очага",
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutPayload({
        rolloutStatus: "approved_for_clinical_operations",
        rolloutReasons: ["вероятность меланомы низкая"],
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BS Stage 5H service reviews timeline rollout SOP with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutSop(
    VISIT_ID,
    {
      sopStatus: "ready_for_operational_rollout",
      sopReasons: ["timeline_rollout_sop_ready_no_patient_delivery"],
      datasetValidationStatus: "ready",
      reviewerOperationsStatus: "ready",
      rollbackPlanStatus: "ready",
      monitoringPlanStatus: "ready",
      rolloutWindowStatus: "ready",
      ownerAckStatus: "ready",
    },
    authContext,
    { correlationId: "c17" },
  );

  assert.equal(result.sop.status, "in_review");
  assert.deepEqual(result.sop.reasons, [
    "timeline_rollout_sop_ready_no_patient_delivery",
    "timeline_rollout_sop_not_ready",
  ]);
  assert.equal(result.sop.validationStatus, "blocked");
  assert.equal(result.sop.rolloutStatus, "review_required");
  assert.equal(result.sop.patientDeliveryAllowed, false);
  assert.equal(result.sop.medicalMeasurementAllowed, false);
  assert.equal(result.sop.protectedFieldsExposed, false);
  assert.equal(result.sop.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_sop.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    sopStatus: "in_review",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    checklistReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.sop) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BS Stage 5H timeline rollout SOP payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutSopPayload({
        sopStatus: "ready_for_operational_rollout",
        sopReasons: ["готово"],
        datasetValidationStatus: "ready",
        reviewerOperationsStatus: "ready",
        rollbackPlanStatus: "ready",
        monitoringPlanStatus: "ready",
        rolloutWindowStatus: "ready",
        ownerAckStatus: "ready",
        patientSafeText: "secret",
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutSopPayload({
        sopStatus: "ready_for_operational_rollout",
        sopReasons: ["вероятность меланомы низкая"],
        datasetValidationStatus: "ready",
        reviewerOperationsStatus: "ready",
        rollbackPlanStatus: "ready",
        monitoringPlanStatus: "ready",
        rolloutWindowStatus: "ready",
        ownerAckStatus: "ready",
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BT Stage 5H service reviews timeline rollout evidence with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutEvidence(
    VISIT_ID,
    {
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
    authContext,
    { correlationId: "c18" },
  );

  assert.equal(result.evidence.status, "in_review");
  assert.deepEqual(result.evidence.reasons, [
    "timeline_rollout_evidence_ready_no_dynamic_conclusion",
    "timeline_rollout_evidence_not_ready",
  ]);
  assert.equal(result.evidence.validationStatus, "blocked");
  assert.equal(result.evidence.rolloutStatus, "review_required");
  assert.equal(result.evidence.sopStatus, "not_started");
  assert.equal(result.evidence.patientDeliveryAllowed, false);
  assert.equal(result.evidence.medicalMeasurementAllowed, false);
  assert.equal(result.evidence.protectedFieldsExposed, false);
  assert.equal(result.evidence.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_evidence.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    evidenceStatus: "in_review",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    monitoringWindowDays: 14,
    sampledTimelineCount: 2,
    exceptionCount: 0,
    rollbackDrillCount: 1,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    evidenceChecklistReady: true,
    aggregateEvidenceReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.evidence) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BT Stage 5H timeline rollout evidence payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutEvidencePayload({
        evidenceStatus: "ready_for_monitored_rollout",
        evidenceReasons: ["готово"],
        monitoringEvidenceStatus: "ready",
        sampleAuditStatus: "ready",
        exceptionLogStatus: "ready",
        rollbackDrillStatus: "ready",
        ownerSignoffStatus: "ready",
        monitoringWindowDays: 14,
        sampledTimelineCount: 2,
        exceptionCount: 0,
        rollbackDrillCount: 1,
        patientSafeText: "secret",
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutEvidencePayload({
        evidenceStatus: "ready_for_monitored_rollout",
        evidenceReasons: ["вероятность меланомы низкая"],
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
    VisitWorkspaceValidationError,
  );
});

test("Batch BU Stage 5H service reviews timeline rollout monitoring with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutMonitoring(
    VISIT_ID,
    {
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
    authContext,
    { correlationId: "c19" },
  );

  assert.equal(result.monitoring.status, "in_review");
  assert.deepEqual(result.monitoring.reasons, [
    "timeline_rollout_monitoring_ready_no_dynamic_conclusion",
    "timeline_rollout_monitoring_not_ready",
  ]);
  assert.equal(result.monitoring.validationStatus, "blocked");
  assert.equal(result.monitoring.rolloutStatus, "review_required");
  assert.equal(result.monitoring.evidenceStatus, "not_started");
  assert.equal(result.monitoring.patientDeliveryAllowed, false);
  assert.equal(result.monitoring.medicalMeasurementAllowed, false);
  assert.equal(result.monitoring.protectedFieldsExposed, false);
  assert.equal(result.monitoring.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_monitoring.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    monitoringStatus: "in_review",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringWindowDays: 30,
    monitoredTimelineCount: 2,
    sampledTimelineCount: 2,
    incidentCount: 0,
    unresolvedIncidentCount: 0,
    closedExceptionCount: 0,
    rollbackExecutionCount: 1,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    monitoringChecklistReady: true,
    aggregateMonitoringReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawIncidentDetailsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.monitoring) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|rawMonitoringLog|incidentPayload|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BU Stage 5H timeline rollout monitoring payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutMonitoringPayload({
        monitoringStatus: "ready_for_production_rollout",
        monitoringReasons: ["готово"],
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
        incidentPayload: { unsafe: true },
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutMonitoringPayload({
        monitoringStatus: "ready_for_production_rollout",
        monitoringReasons: ["вероятность меланомы низкая"],
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
    VisitWorkspaceValidationError,
  );
});

test("Batch BV Stage 5H service reviews incident procedure with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutIncidentProcedure(
    VISIT_ID,
    {
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
      incidentCaseCount: 1,
      unresolvedIncidentCount: 0,
      escalatedIncidentCount: 0,
      rollbackDecisionCount: 1,
    },
    authContext,
    { correlationId: "c20" },
  );

  assert.equal(result.incidentProcedure.status, "in_review");
  assert.deepEqual(result.incidentProcedure.reasons, [
    "timeline_rollout_incident_procedure_ready_no_dynamic_conclusion",
    "timeline_rollout_incident_procedure_not_ready",
  ]);
  assert.equal(result.incidentProcedure.monitoringStatus, "not_started");
  assert.equal(result.incidentProcedure.validationStatus, "blocked");
  assert.equal(result.incidentProcedure.patientDeliveryAllowed, false);
  assert.equal(result.incidentProcedure.medicalMeasurementAllowed, false);
  assert.equal(result.incidentProcedure.protectedFieldsExposed, false);
  assert.equal(result.incidentProcedure.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_incident_procedure.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    procedureStatus: "in_review",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    realDatasetTimelineCount: 2,
    monitoredTimelineCount: 2,
    sampledOutcomeCount: 2,
    incidentCaseCount: 1,
    unresolvedIncidentCount: 0,
    escalatedIncidentCount: 0,
    rollbackDecisionCount: 1,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    procedureChecklistReady: true,
    aggregateProcedureReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawIncidentDetailsExposed: false,
    rawOutcomeLogsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.incidentProcedure) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawMonitoringLog"\s*:|"rawOutcomeLog"\s*:|"incidentPayload"\s*:|"incidentDetails"\s*:|"incidentTimeline"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BV Stage 5H incident procedure payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload({
        procedureStatus: "ready_for_clinic_monitoring",
        procedureReasons: ["готово"],
        realDatasetStatus: "ready",
        outcomeSamplingProcedureStatus: "ready",
        incidentTriageStatus: "ready",
        escalationPathStatus: "ready",
        rollbackDecisionStatus: "ready",
        ownerReviewStatus: "ready",
        realDatasetTimelineCount: 2,
        monitoredTimelineCount: 2,
        sampledOutcomeCount: 2,
        incidentCaseCount: 1,
        unresolvedIncidentCount: 0,
        escalatedIncidentCount: 0,
        rollbackDecisionCount: 1,
        incidentPayload: { unsafe: true },
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload({
        procedureStatus: "ready_for_clinic_monitoring",
        procedureReasons: ["вероятность меланомы низкая"],
        realDatasetStatus: "ready",
        outcomeSamplingProcedureStatus: "ready",
        incidentTriageStatus: "ready",
        escalationPathStatus: "ready",
        rollbackDecisionStatus: "ready",
        ownerReviewStatus: "ready",
        realDatasetTimelineCount: 2,
        monitoredTimelineCount: 2,
        sampledOutcomeCount: 2,
        incidentCaseCount: 1,
        unresolvedIncidentCount: 0,
        escalatedIncidentCount: 0,
        rollbackDecisionCount: 1,
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BW Stage 5H service reviews clinical validation with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutClinicalValidation(
    VISIT_ID,
    {
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
    authContext,
    { correlationId: "c21" },
  );

  assert.equal(result.clinicalValidation.status, "in_review");
  assert.deepEqual(result.clinicalValidation.reasons, [
    "timeline_rollout_clinical_validation_ready_no_dynamic_conclusion",
    "timeline_rollout_clinical_validation_not_ready",
  ]);
  assert.equal(result.clinicalValidation.incidentProcedureStatus, "not_started");
  assert.equal(result.clinicalValidation.validationStatus, "blocked");
  assert.equal(result.clinicalValidation.patientDeliveryAllowed, false);
  assert.equal(result.clinicalValidation.medicalMeasurementAllowed, false);
  assert.equal(result.clinicalValidation.protectedFieldsExposed, false);
  assert.equal(result.clinicalValidation.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_clinical_validation.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    clinicalValidationStatus: "in_review",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realDatasetTimelineCount: 8,
    validationSampleCount: 4,
    disagreementCaseCount: 1,
    adjudicatedCaseCount: 1,
    followupWindowDays: 90,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    clinicalValidationChecklistReady: true,
    aggregateClinicalValidationReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawValidationLogsExposed: false,
    rawAdjudicationLogsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.clinicalValidation) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawValidationLog"\s*:|"rawAdjudicationLog"\s*:|"clinicalValidationPayload"\s*:|"validationDetails"\s*:|"adjudicationDetails"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BW Stage 5H clinical validation payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload({
        clinicalValidationStatus: "ready_for_clinical_validation",
        clinicalValidationReasons: ["готово"],
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
        rawValidationLog: [{ unsafe: true }],
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload({
        clinicalValidationStatus: "ready_for_clinical_validation",
        clinicalValidationReasons: ["динамика подтверждает диагноз"],
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
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload({
        clinicalValidationStatus: "ready_for_clinical_validation",
        clinicalValidationReasons: ["готово"],
        realDatasetLockStatus: "ready",
        validatorTrainingStatus: "ready",
        blindedSampleStatus: "ready",
        adjudicationStatus: "ready",
        decisionLogStatus: "ready",
        ownerAcceptanceStatus: "ready",
        realDatasetTimelineCount: 8,
        validationSampleCount: 4,
        disagreementCaseCount: 3,
        adjudicatedCaseCount: 1,
        followupWindowDays: 90,
        blockerCount: 0,
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BX Stage 5H service reviews post-validation monitoring with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring(
    VISIT_ID,
    {
      postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
      postValidationMonitoringReasons: ["timeline_rollout_post_validation_monitoring_ready_no_dynamic_conclusion"],
      monitoringWindowStatus: "ready",
      outcomeReviewStatus: "ready",
      driftReviewStatus: "ready",
      incidentFollowupStatus: "ready",
      validatorRecheckStatus: "ready",
      ownerSignoffStatus: "ready",
      realDatasetTimelineCount: 8,
      clinicalValidationSampleCount: 4,
      monitoredTimelineCount: 8,
      sampledOutcomeCount: 4,
      driftSignalCount: 1,
      unresolvedDriftSignalCount: 0,
      incidentFollowupCount: 1,
      unresolvedIncidentFollowupCount: 0,
      validatorRecheckCount: 1,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c22" },
  );

  assert.equal(result.postValidationMonitoring.status, "in_review");
  assert.deepEqual(result.postValidationMonitoring.reasons, [
    "timeline_rollout_post_validation_monitoring_ready_no_dynamic_conclusion",
    "timeline_rollout_post_validation_monitoring_not_ready",
  ]);
  assert.equal(result.postValidationMonitoring.clinicalValidationStatus, "not_started");
  assert.equal(result.postValidationMonitoring.validationStatus, "blocked");
  assert.equal(result.postValidationMonitoring.patientDeliveryAllowed, false);
  assert.equal(result.postValidationMonitoring.medicalMeasurementAllowed, false);
  assert.equal(result.postValidationMonitoring.protectedFieldsExposed, false);
  assert.equal(result.postValidationMonitoring.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_post_validation_monitoring.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    postValidationMonitoringStatus: "in_review",
    clinicalValidationStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realDatasetTimelineCount: 8,
    clinicalValidationSampleCount: 4,
    monitoredTimelineCount: 8,
    sampledOutcomeCount: 4,
    driftSignalCount: 1,
    unresolvedDriftSignalCount: 0,
    incidentFollowupCount: 1,
    unresolvedIncidentFollowupCount: 0,
    validatorRecheckCount: 1,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    postValidationChecklistReady: true,
    aggregatePostValidationMonitoringReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawMonitoringLogsExposed: false,
    rawDriftLogsExposed: false,
    rawFollowupLogsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.postValidationMonitoring) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawMonitoringLog"\s*:|"rawOutcomeLog"\s*:|"rawDriftLog"\s*:|"rawFollowupLog"\s*:|"postValidationPayload"\s*:|"monitoringDetails"\s*:|"driftDetails"\s*:|"followupDetails"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BX Stage 5H post-validation monitoring payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload({
        postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
        postValidationMonitoringReasons: ["готово"],
        monitoringWindowStatus: "ready",
        outcomeReviewStatus: "ready",
        driftReviewStatus: "ready",
        incidentFollowupStatus: "ready",
        validatorRecheckStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        clinicalValidationSampleCount: 4,
        monitoredTimelineCount: 8,
        sampledOutcomeCount: 4,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 0,
        incidentFollowupCount: 1,
        unresolvedIncidentFollowupCount: 0,
        validatorRecheckCount: 1,
        blockerCount: 0,
        rawDriftLog: [{ unsafe: true }],
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload({
        postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
        postValidationMonitoringReasons: ["динамика подтверждает диагноз"],
        monitoringWindowStatus: "ready",
        outcomeReviewStatus: "ready",
        driftReviewStatus: "ready",
        incidentFollowupStatus: "ready",
        validatorRecheckStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        clinicalValidationSampleCount: 4,
        monitoredTimelineCount: 8,
        sampledOutcomeCount: 4,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 0,
        incidentFollowupCount: 1,
        unresolvedIncidentFollowupCount: 0,
        validatorRecheckCount: 1,
        blockerCount: 0,
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload({
        postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
        postValidationMonitoringReasons: ["готово"],
        monitoringWindowStatus: "ready",
        outcomeReviewStatus: "ready",
        driftReviewStatus: "ready",
        incidentFollowupStatus: "ready",
        validatorRecheckStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        clinicalValidationSampleCount: 4,
        monitoredTimelineCount: 8,
        sampledOutcomeCount: 4,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 2,
        incidentFollowupCount: 1,
        unresolvedIncidentFollowupCount: 0,
        validatorRecheckCount: 1,
        blockerCount: 0,
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BY Stage 5H service reviews observation governance with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutObservationGovernance(
    VISIT_ID,
    {
      observationGovernanceStatus: "ready_for_observation_governance",
      observationGovernanceReasons: ["timeline_rollout_observation_governance_ready_no_dynamic_conclusion"],
      observationWindowStatus: "ready",
      outcomeObservationStatus: "ready",
      driftSignalReviewStatus: "ready",
      incidentOutcomeReviewStatus: "ready",
      followupClosureStatus: "ready",
      governanceReviewStatus: "ready",
      ownerSignoffStatus: "ready",
      realDatasetTimelineCount: 8,
      postValidationSampleCount: 4,
      observedTimelineCount: 8,
      expectedFollowupCount: 1,
      completedFollowupCount: 1,
      driftSignalCount: 1,
      unresolvedDriftSignalCount: 0,
      incidentOutcomeCount: 1,
      unresolvedIncidentOutcomeCount: 0,
      governanceExceptionCount: 1,
      unresolvedGovernanceExceptionCount: 0,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c23" },
  );

  assert.equal(result.observationGovernance.status, "in_review");
  assert.deepEqual(result.observationGovernance.reasons, [
    "timeline_rollout_observation_governance_ready_no_dynamic_conclusion",
    "timeline_rollout_observation_governance_not_ready",
  ]);
  assert.equal(result.observationGovernance.postValidationMonitoringStatus, "not_started");
  assert.equal(result.observationGovernance.validationStatus, "blocked");
  assert.equal(result.observationGovernance.patientDeliveryAllowed, false);
  assert.equal(result.observationGovernance.medicalMeasurementAllowed, false);
  assert.equal(result.observationGovernance.protectedFieldsExposed, false);
  assert.equal(result.observationGovernance.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_observation_governance.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    observationGovernanceStatus: "in_review",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realDatasetTimelineCount: 8,
    postValidationSampleCount: 4,
    observedTimelineCount: 8,
    expectedFollowupCount: 1,
    completedFollowupCount: 1,
    driftSignalCount: 1,
    unresolvedDriftSignalCount: 0,
    incidentOutcomeCount: 1,
    unresolvedIncidentOutcomeCount: 0,
    governanceExceptionCount: 1,
    unresolvedGovernanceExceptionCount: 0,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    observationChecklistReady: true,
    aggregateObservationGovernanceReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawObservationLogsExposed: false,
    rawOutcomeReviewLogsExposed: false,
    rawIncidentOutcomeLogsExposed: false,
    rawGovernancePayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.observationGovernance) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawObservationLog"\s*:|"rawOutcomeReviewLog"\s*:|"rawIncidentOutcomeLog"\s*:|"observationPayload"\s*:|"outcomeReviewPayload"\s*:|"incidentOutcomePayload"\s*:|"governancePayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BY Stage 5H observation governance payload rejects protected and clinical fields", () => {
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload({
        observationGovernanceStatus: "ready_for_observation_governance",
        observationGovernanceReasons: ["готово"],
        observationWindowStatus: "ready",
        outcomeObservationStatus: "ready",
        driftSignalReviewStatus: "ready",
        incidentOutcomeReviewStatus: "ready",
        followupClosureStatus: "ready",
        governanceReviewStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        postValidationSampleCount: 4,
        observedTimelineCount: 8,
        expectedFollowupCount: 1,
        completedFollowupCount: 1,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 0,
        incidentOutcomeCount: 1,
        unresolvedIncidentOutcomeCount: 0,
        governanceExceptionCount: 1,
        unresolvedGovernanceExceptionCount: 0,
        blockerCount: 0,
        rawObservationLog: [{ unsafe: true }],
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload({
        observationGovernanceStatus: "ready_for_observation_governance",
        observationGovernanceReasons: ["динамика подтверждает диагноз"],
        observationWindowStatus: "ready",
        outcomeObservationStatus: "ready",
        driftSignalReviewStatus: "ready",
        incidentOutcomeReviewStatus: "ready",
        followupClosureStatus: "ready",
        governanceReviewStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        postValidationSampleCount: 4,
        observedTimelineCount: 8,
        expectedFollowupCount: 1,
        completedFollowupCount: 1,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 0,
        incidentOutcomeCount: 1,
        unresolvedIncidentOutcomeCount: 0,
        governanceExceptionCount: 1,
        unresolvedGovernanceExceptionCount: 0,
        blockerCount: 0,
      }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () =>
      normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload({
        observationGovernanceStatus: "ready_for_observation_governance",
        observationGovernanceReasons: ["готово"],
        observationWindowStatus: "ready",
        outcomeObservationStatus: "ready",
        driftSignalReviewStatus: "ready",
        incidentOutcomeReviewStatus: "ready",
        followupClosureStatus: "ready",
        governanceReviewStatus: "ready",
        ownerSignoffStatus: "ready",
        realDatasetTimelineCount: 8,
        postValidationSampleCount: 4,
        observedTimelineCount: 8,
        expectedFollowupCount: 1,
        completedFollowupCount: 2,
        driftSignalCount: 1,
        unresolvedDriftSignalCount: 0,
        incidentOutcomeCount: 1,
        unresolvedIncidentOutcomeCount: 0,
        governanceExceptionCount: 1,
        unresolvedGovernanceExceptionCount: 0,
        blockerCount: 0,
      }),
    VisitWorkspaceValidationError,
  );
});

test("Batch BZ Stage 5H service reviews exception governance with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutExceptionGovernance(
    VISIT_ID,
    {
      exceptionGovernanceStatus: "ready_for_exception_governance",
      exceptionGovernanceReasons: ["timeline_rollout_exception_governance_ready_no_dynamic_conclusion"],
      exceptionRegisterStatus: "ready",
      triageSlaStatus: "ready",
      resolutionEvidenceStatus: "ready",
      recurrenceReviewStatus: "ready",
      rollbackReadinessStatus: "ready",
      governanceArchiveStatus: "ready",
      ownerSignoffStatus: "ready",
      realDatasetTimelineCount: 8,
      observedTimelineCount: 8,
      governanceExceptionCount: 1,
      resolvedGovernanceExceptionCount: 1,
      unresolvedGovernanceExceptionCount: 0,
      recurrenceSignalCount: 1,
      unresolvedRecurrenceSignalCount: 0,
      rollbackDrillCount: 1,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c24" },
  );

  assert.equal(result.exceptionGovernance.status, "in_review");
  assert.deepEqual(result.exceptionGovernance.reasons, [
    "timeline_rollout_exception_governance_ready_no_dynamic_conclusion",
    "timeline_rollout_exception_governance_not_ready",
  ]);
  assert.equal(result.exceptionGovernance.observationGovernanceStatus, "not_started");
  assert.equal(result.exceptionGovernance.validationStatus, "blocked");
  assert.equal(result.exceptionGovernance.patientDeliveryAllowed, false);
  assert.equal(result.exceptionGovernance.medicalMeasurementAllowed, false);
  assert.equal(result.exceptionGovernance.protectedFieldsExposed, false);
  assert.equal(result.exceptionGovernance.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_exception_governance.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    exceptionGovernanceStatus: "in_review",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realDatasetTimelineCount: 8,
    observedTimelineCount: 8,
    governanceExceptionCount: 1,
    resolvedGovernanceExceptionCount: 1,
    unresolvedGovernanceExceptionCount: 0,
    recurrenceSignalCount: 1,
    unresolvedRecurrenceSignalCount: 0,
    rollbackDrillCount: 1,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    exceptionChecklistReady: true,
    aggregateExceptionGovernanceReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawExceptionLogsExposed: false,
    rawRecurrenceLogsExposed: false,
    rawRollbackLogsExposed: false,
    rawGovernancePayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.exceptionGovernance) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawExceptionLog"\s*:|"rawRecurrenceLog"\s*:|"rawRollbackLog"\s*:|"exceptionPayload"\s*:|"recurrencePayload"\s*:|"rollbackPayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch CA Stage 5H service reviews longitudinal outcome governance with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutOutcomeGovernance(
    VISIT_ID,
    {
      outcomeGovernanceStatus: "ready_for_outcome_governance",
      outcomeGovernanceReasons: ["timeline_rollout_outcome_governance_ready_no_dynamic_conclusion"],
      longitudinalWindowStatus: "ready",
      realDatasetCoverageStatus: "ready",
      reviewerOperationsValidationStatus: "ready",
      exceptionTrendReviewStatus: "ready",
      followupCadenceStatus: "ready",
      governanceCadenceStatus: "ready",
      ownerSignoffStatus: "ready",
      realDatasetTimelineCount: 8,
      observedTimelineCount: 8,
      followupWindowCount: 3,
      completedFollowupCount: 3,
      governanceExceptionCount: 1,
      unresolvedGovernanceExceptionCount: 0,
      recurrenceSignalCount: 1,
      unresolvedRecurrenceSignalCount: 0,
      governanceReviewCount: 2,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c25" },
  );

  assert.equal(result.outcomeGovernance.status, "in_review");
  assert.deepEqual(result.outcomeGovernance.reasons, [
    "timeline_rollout_outcome_governance_ready_no_dynamic_conclusion",
    "timeline_rollout_outcome_governance_not_ready",
  ]);
  assert.equal(result.outcomeGovernance.exceptionGovernanceStatus, "not_started");
  assert.equal(result.outcomeGovernance.validationStatus, "blocked");
  assert.equal(result.outcomeGovernance.patientDeliveryAllowed, false);
  assert.equal(result.outcomeGovernance.medicalMeasurementAllowed, false);
  assert.equal(result.outcomeGovernance.protectedFieldsExposed, false);
  assert.equal(result.outcomeGovernance.clinicalOutputGenerated, false);
  assert.equal(auditEvents.at(-1).action, "visit_longitudinal_timeline_rollout_outcome_governance.review");
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    outcomeGovernanceStatus: "in_review",
    exceptionGovernanceStatus: "not_started",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realDatasetTimelineCount: 8,
    observedTimelineCount: 8,
    followupWindowCount: 3,
    completedFollowupCount: 3,
    governanceExceptionCount: 1,
    unresolvedGovernanceExceptionCount: 0,
    recurrenceSignalCount: 1,
    unresolvedRecurrenceSignalCount: 0,
    governanceReviewCount: 2,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    outcomeChecklistReady: true,
    aggregateOutcomeGovernanceReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawLongitudinalOutcomeLogsExposed: false,
    rawGovernancePayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.outcomeGovernance) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawOutcomeLog"\s*:|"rawFollowupLog"\s*:|"rawGovernanceLog"\s*:|"outcomePayload"\s*:|"followupPayload"\s*:|"governancePayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch CB Stage 5H service reviews longitudinal clinical validation with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation(
    VISIT_ID,
    {
      longitudinalClinicalValidationStatus: "ready_for_longitudinal_clinical_validation",
      longitudinalClinicalValidationReasons: [
        "timeline_rollout_longitudinal_clinical_validation_ready_no_dynamic_conclusion",
      ],
      outcomeWindowStatus: "ready",
      clinicianCoverageStatus: "ready",
      adjudicationStatus: "ready",
      consensusReviewStatus: "ready",
      followupValidationStatus: "ready",
      governanceCadenceStatus: "ready",
      ownerSignoffStatus: "ready",
      realOutcomeWindowCount: 6,
      clinicallyValidatedWindowCount: 6,
      adjudicatedWindowCount: 4,
      followupValidatedWindowCount: 4,
      consensusReviewCount: 4,
      unresolvedConsensusCaseCount: 0,
      governanceReviewCount: 3,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c26" },
  );

  assert.equal(result.longitudinalClinicalValidation.status, "in_review");
  assert.deepEqual(result.longitudinalClinicalValidation.reasons, [
    "timeline_rollout_longitudinal_clinical_validation_ready_no_dynamic_conclusion",
    "timeline_rollout_longitudinal_clinical_validation_not_ready",
  ]);
  assert.equal(result.longitudinalClinicalValidation.outcomeGovernanceStatus, "not_started");
  assert.equal(result.longitudinalClinicalValidation.validationStatus, "blocked");
  assert.equal(result.longitudinalClinicalValidation.patientDeliveryAllowed, false);
  assert.equal(result.longitudinalClinicalValidation.medicalMeasurementAllowed, false);
  assert.equal(result.longitudinalClinicalValidation.protectedFieldsExposed, false);
  assert.equal(result.longitudinalClinicalValidation.clinicalOutputGenerated, false);
  assert.equal(
    auditEvents.at(-1).action,
    "visit_longitudinal_timeline_rollout_longitudinal_clinical_validation.review",
  );
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    longitudinalClinicalValidationStatus: "in_review",
    outcomeGovernanceStatus: "not_started",
    exceptionGovernanceStatus: "not_started",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    sopStatus: "not_started",
    evidenceStatus: "not_started",
    monitoringStatus: "not_started",
    incidentProcedureStatus: "not_started",
    realOutcomeWindowCount: 6,
    clinicallyValidatedWindowCount: 6,
    adjudicatedWindowCount: 4,
    followupValidatedWindowCount: 4,
    consensusReviewCount: 4,
    unresolvedConsensusCaseCount: 0,
    governanceReviewCount: 3,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    validationChecklistReady: true,
    aggregateValidationReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawLongitudinalClinicalValidationLogsExposed: false,
    rawAdjudicationPayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.longitudinalClinicalValidation) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawLongitudinalClinicalValidationLog"\s*:|"longitudinalClinicalValidationPayload"\s*:|"longitudinalClinicalValidationDetails"\s*:|"rawAdjudicationLog"\s*:|"adjudicationPayload"\s*:|"adjudicationDetails"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch CC Stage 5H service reviews protected reviewer validation with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutProtectedReviewerValidation(
    VISIT_ID,
    {
      protectedReviewerValidationStatus: "ready_for_protected_reviewer_validation",
      protectedReviewerValidationReasons: ["protected_reviewer_validation_ready_no_patient_delivery"],
      protectedAssetWindowStatus: "ready",
      protectedRenderStatus: "ready",
      reviewerAssignmentStatus: "ready",
      secondReviewStatus: "ready",
      adjudicationOpsStatus: "ready",
      followupOpsStatus: "ready",
      ownerSignoffStatus: "ready",
      protectedAssetTimelineCount: 6,
      protectedRenderReadyCount: 6,
      reviewerAssignedProtectedCount: 4,
      secondReviewedProtectedCount: 4,
      adjudicatedProtectedCount: 4,
      followupValidatedProtectedCount: 4,
      unresolvedProtectedReviewCount: 0,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c27" },
  );

  assert.equal(result.protectedReviewerValidation.status, "in_review");
  assert.deepEqual(result.protectedReviewerValidation.reasons, [
    "protected_reviewer_validation_ready_no_patient_delivery",
    "timeline_rollout_protected_reviewer_validation_not_ready",
  ]);
  assert.equal(result.protectedReviewerValidation.longitudinalClinicalValidationStatus, "not_started");
  assert.equal(result.protectedReviewerValidation.validationStatus, "blocked");
  assert.equal(result.protectedReviewerValidation.patientDeliveryAllowed, false);
  assert.equal(result.protectedReviewerValidation.medicalMeasurementAllowed, false);
  assert.equal(result.protectedReviewerValidation.protectedFieldsExposed, false);
  assert.equal(result.protectedReviewerValidation.clinicalOutputGenerated, false);
  assert.equal(
    auditEvents.at(-1).action,
    "visit_longitudinal_timeline_rollout_protected_reviewer_validation.review",
  );
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    protectedReviewerValidationStatus: "in_review",
    longitudinalClinicalValidationStatus: "not_started",
    outcomeGovernanceStatus: "not_started",
    exceptionGovernanceStatus: "not_started",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    incidentProcedureStatus: "not_started",
    monitoringStatus: "not_started",
    evidenceStatus: "not_started",
    sopStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    protectedAssetTimelineCount: 6,
    protectedRenderReadyCount: 6,
    reviewerAssignedProtectedCount: 4,
    secondReviewedProtectedCount: 4,
    adjudicatedProtectedCount: 4,
    followupValidatedProtectedCount: 4,
    unresolvedProtectedReviewCount: 0,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    validationChecklistReady: true,
    aggregateValidationReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawProtectedReviewerLogsExposed: false,
    rawProtectedReviewerPayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.protectedReviewerValidation) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawProtectedReviewLog"\s*:|"rawReviewerOpsLog"\s*:|"rawFollowupOpsLog"\s*:|"rawAdjudicationOpsLog"\s*:|"protectedReviewerValidationPayload"\s*:|"protectedReviewerValidationDetails"\s*:|"reviewerAssignmentPayload"\s*:|"secondReviewPayload"\s*:|"adjudicationOpsPayload"\s*:|"followupOpsPayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch CD Stage 5H service reviews protected reviewer governance with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernance(
    VISIT_ID,
    {
      protectedReviewerGovernanceStatus: "ready_for_protected_reviewer_governance",
      protectedReviewerGovernanceReasons: ["protected_reviewer_governance_ready_no_patient_delivery"],
      reviewerMonitoringStatus: "ready",
      reviewerExceptionStatus: "ready",
      reviewerAdjudicationStatus: "ready",
      reviewerFollowupStatus: "ready",
      reviewerRollbackStatus: "ready",
      reviewerArchiveStatus: "ready",
      ownerSignoffStatus: "ready",
      protectedReviewWindowCount: 6,
      monitoredProtectedReviewCount: 4,
      escalatedProtectedReviewCount: 1,
      adjudicatedProtectedGovernanceCount: 1,
      followupClosedProtectedCount: 1,
      rollbackReadyProtectedCount: 1,
      archivedProtectedReviewCount: 4,
      unresolvedGovernanceReviewCount: 0,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c28" },
  );

  assert.equal(result.protectedReviewerGovernance.status, "in_review");
  assert.deepEqual(result.protectedReviewerGovernance.reasons, [
    "protected_reviewer_governance_ready_no_patient_delivery",
    "timeline_rollout_protected_reviewer_governance_not_ready",
  ]);
  assert.equal(result.protectedReviewerGovernance.protectedReviewerValidationStatus, "not_started");
  assert.equal(result.protectedReviewerGovernance.validationStatus, "blocked");
  assert.equal(result.protectedReviewerGovernance.patientDeliveryAllowed, false);
  assert.equal(result.protectedReviewerGovernance.medicalMeasurementAllowed, false);
  assert.equal(result.protectedReviewerGovernance.protectedFieldsExposed, false);
  assert.equal(result.protectedReviewerGovernance.clinicalOutputGenerated, false);
  assert.equal(
    auditEvents.at(-1).action,
    "visit_longitudinal_timeline_rollout_protected_reviewer_governance.review",
  );
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    protectedReviewerGovernanceStatus: "in_review",
    protectedReviewerValidationStatus: "not_started",
    longitudinalClinicalValidationStatus: "not_started",
    outcomeGovernanceStatus: "not_started",
    exceptionGovernanceStatus: "not_started",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    incidentProcedureStatus: "not_started",
    monitoringStatus: "not_started",
    evidenceStatus: "not_started",
    sopStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    protectedReviewWindowCount: 6,
    monitoredProtectedReviewCount: 4,
    escalatedProtectedReviewCount: 1,
    adjudicatedProtectedGovernanceCount: 1,
    followupClosedProtectedCount: 1,
    rollbackReadyProtectedCount: 1,
    archivedProtectedReviewCount: 4,
    unresolvedGovernanceReviewCount: 0,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    validationChecklistReady: true,
    aggregateValidationReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawProtectedReviewerLogsExposed: false,
    rawProtectedReviewerPayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.protectedReviewerGovernance) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawProtectedReviewerLog"\s*:|"protectedReviewerGovernancePayload"\s*:|"protectedReviewerGovernanceDetails"\s*:|"reviewerMonitoringPayload"\s*:|"reviewerExceptionPayload"\s*:|"reviewerRollbackPayload"\s*:|"reviewerArchivePayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch CE Stage 5H service reviews protected reviewer evidence with downgrade and aggregate-only audit", async () => {
  const auditEvents = [];
  const service = createService({ auditEvents });

  const result = await service.reviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidence(
    VISIT_ID,
    {
      protectedReviewerEvidenceStatus: "ready_for_protected_reviewer_evidence",
      protectedReviewerEvidenceReasons: ["protected_reviewer_evidence_ready_no_patient_delivery"],
      reviewerMonitoringEvidenceStatus: "ready",
      reviewerExceptionEvidenceStatus: "ready",
      reviewerAdjudicationEvidenceStatus: "ready",
      reviewerFollowupEvidenceStatus: "ready",
      reviewerRollbackEvidenceStatus: "ready",
      reviewerArchiveEvidenceStatus: "ready",
      ownerSignoffStatus: "ready",
      protectedReviewWindowCount: 6,
      monitoredProtectedReviewCount: 4,
      sampledProtectedReviewCount: 3,
      adjudicatedProtectedEvidenceCount: 3,
      followupClosedProtectedCount: 3,
      rollbackDrillProtectedCount: 1,
      archivedProtectedReviewCount: 4,
      unresolvedProtectedEvidenceCount: 0,
      blockerCount: 0,
    },
    authContext,
    { correlationId: "c29" },
  );

  assert.equal(result.protectedReviewerEvidence.status, "in_review");
  assert.deepEqual(result.protectedReviewerEvidence.reasons, [
    "protected_reviewer_evidence_ready_no_patient_delivery",
    "timeline_rollout_protected_reviewer_evidence_not_ready",
  ]);
  assert.equal(result.protectedReviewerEvidence.protectedReviewerGovernanceStatus, "not_started");
  assert.equal(result.protectedReviewerEvidence.validationStatus, "blocked");
  assert.equal(result.protectedReviewerEvidence.patientDeliveryAllowed, false);
  assert.equal(result.protectedReviewerEvidence.medicalMeasurementAllowed, false);
  assert.equal(result.protectedReviewerEvidence.protectedFieldsExposed, false);
  assert.equal(result.protectedReviewerEvidence.clinicalOutputGenerated, false);
  assert.equal(
    auditEvents.at(-1).action,
    "visit_longitudinal_timeline_rollout_protected_reviewer_evidence.review",
  );
  assert.deepEqual(auditEvents.at(-1).metadata, {
    visitId: VISIT_ID,
    protectedReviewerEvidenceStatus: "in_review",
    protectedReviewerGovernanceStatus: "not_started",
    protectedReviewerValidationStatus: "not_started",
    longitudinalClinicalValidationStatus: "not_started",
    outcomeGovernanceStatus: "not_started",
    exceptionGovernanceStatus: "not_started",
    observationGovernanceStatus: "not_started",
    postValidationMonitoringStatus: "not_started",
    clinicalValidationStatus: "not_started",
    incidentProcedureStatus: "not_started",
    monitoringStatus: "not_started",
    evidenceStatus: "not_started",
    sopStatus: "not_started",
    validationStatus: "blocked",
    rolloutStatus: "review_required",
    protectedReviewWindowCount: 6,
    monitoredProtectedReviewCount: 4,
    sampledProtectedReviewCount: 3,
    adjudicatedProtectedEvidenceCount: 3,
    followupClosedProtectedCount: 3,
    rollbackDrillProtectedCount: 1,
    archivedProtectedReviewCount: 4,
    unresolvedProtectedEvidenceCount: 0,
    blockerCount: 0,
    lesionCount: 2,
    readyTimelineCount: 1,
    blockedTimelineCount: 1,
    candidatePairCount: 3,
    reviewerWorkflowReadyCount: 1,
    validationChecklistReady: true,
    aggregateValidationReady: true,
    reasonsCount: 2,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
    pairKeysExposed: false,
    imageIdsExposed: false,
    patientRowsExposed: false,
    rawProtectedReviewerLogsExposed: false,
    rawProtectedReviewerPayloadsExposed: false,
  });
  assert.doesNotMatch(
    JSON.stringify(result.protectedReviewerEvidence) + JSON.stringify(auditEvents.at(-1)),
    /i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|"rawProtectedReviewerEvidenceLog"\s*:|"protectedReviewerEvidencePayload"\s*:|"protectedReviewerEvidenceDetails"\s*:|"reviewerMonitoringEvidencePayload"\s*:|"reviewerExceptionEvidencePayload"\s*:|"reviewerRollbackEvidencePayload"\s*:|"reviewerArchiveEvidencePayload"\s*:|photoRef|heatmapRef|modelVersion|token|session|qr|reviewerName|reviewerEmail|validatorName|validatorEmail|dynamicConclusion|diagnosis|riskScore|меланома|рак кожи/i,
  );
});

test("Batch BZ Stage 5H exception governance payload rejects protected and clinical fields", () => {
  const base = {
    exceptionGovernanceStatus: "ready_for_exception_governance",
    exceptionGovernanceReasons: ["готово"],
    exceptionRegisterStatus: "ready",
    triageSlaStatus: "ready",
    resolutionEvidenceStatus: "ready",
    recurrenceReviewStatus: "ready",
    rollbackReadinessStatus: "ready",
    governanceArchiveStatus: "ready",
    ownerSignoffStatus: "ready",
    realDatasetTimelineCount: 8,
    observedTimelineCount: 8,
    governanceExceptionCount: 1,
    resolvedGovernanceExceptionCount: 1,
    unresolvedGovernanceExceptionCount: 0,
    recurrenceSignalCount: 1,
    unresolvedRecurrenceSignalCount: 0,
    rollbackDrillCount: 1,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload({
      ...base,
      rawExceptionLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload({
      ...base,
      exceptionGovernanceReasons: ["динамика подтверждает диагноз"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload({
      ...base,
      unresolvedRecurrenceSignalCount: 2,
    }),
    VisitWorkspaceValidationError,
  );
});

test("Batch CA Stage 5H outcome governance payload rejects protected and clinical fields", () => {
  const base = {
    outcomeGovernanceStatus: "ready_for_outcome_governance",
    outcomeGovernanceReasons: ["готово"],
    longitudinalWindowStatus: "ready",
    realDatasetCoverageStatus: "ready",
    reviewerOperationsValidationStatus: "ready",
    exceptionTrendReviewStatus: "ready",
    followupCadenceStatus: "ready",
    governanceCadenceStatus: "ready",
    ownerSignoffStatus: "ready",
    realDatasetTimelineCount: 8,
    observedTimelineCount: 8,
    followupWindowCount: 3,
    completedFollowupCount: 3,
    governanceExceptionCount: 1,
    unresolvedGovernanceExceptionCount: 0,
    recurrenceSignalCount: 1,
    unresolvedRecurrenceSignalCount: 0,
    governanceReviewCount: 2,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload({
      ...base,
      rawOutcomeLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload({
      ...base,
      outcomeGovernanceReasons: ["клинический диагноз подтверждён"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload({
      ...base,
      completedFollowupCount: 4,
    }),
    VisitWorkspaceValidationError,
  );
});

test("Batch CB Stage 5H longitudinal clinical validation payload rejects protected and clinical fields", () => {
  const base = {
    longitudinalClinicalValidationStatus: "ready_for_longitudinal_clinical_validation",
    longitudinalClinicalValidationReasons: ["готово"],
    outcomeWindowStatus: "ready",
    clinicianCoverageStatus: "ready",
    adjudicationStatus: "ready",
    consensusReviewStatus: "ready",
    followupValidationStatus: "ready",
    governanceCadenceStatus: "ready",
    ownerSignoffStatus: "ready",
    realOutcomeWindowCount: 6,
    clinicallyValidatedWindowCount: 6,
    adjudicatedWindowCount: 4,
    followupValidatedWindowCount: 4,
    consensusReviewCount: 4,
    unresolvedConsensusCaseCount: 0,
    governanceReviewCount: 3,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload({
      ...base,
      rawLongitudinalClinicalValidationLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload({
      ...base,
      longitudinalClinicalValidationReasons: ["клинический диагноз подтверждён"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload({
      ...base,
      adjudicatedWindowCount: 7,
    }),
    VisitWorkspaceValidationError,
  );
});

test("Batch CC Stage 5H protected reviewer validation payload rejects protected and clinical fields", () => {
  const base = {
    protectedReviewerValidationStatus: "ready_for_protected_reviewer_validation",
    protectedReviewerValidationReasons: ["готово"],
    protectedAssetWindowStatus: "ready",
    protectedRenderStatus: "ready",
    reviewerAssignmentStatus: "ready",
    secondReviewStatus: "ready",
    adjudicationOpsStatus: "ready",
    followupOpsStatus: "ready",
    ownerSignoffStatus: "ready",
    protectedAssetTimelineCount: 6,
    protectedRenderReadyCount: 6,
    reviewerAssignedProtectedCount: 4,
    secondReviewedProtectedCount: 4,
    adjudicatedProtectedCount: 4,
    followupValidatedProtectedCount: 4,
    unresolvedProtectedReviewCount: 0,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload({
      ...base,
      rawProtectedReviewLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload({
      ...base,
      protectedReviewerValidationReasons: ["клинический диагноз подтверждён"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload({
      ...base,
      secondReviewedProtectedCount: 5,
    }),
    VisitWorkspaceValidationError,
  );
});

test("Batch CD Stage 5H protected reviewer governance payload rejects protected and clinical fields", () => {
  const base = {
    protectedReviewerGovernanceStatus: "ready_for_protected_reviewer_governance",
    protectedReviewerGovernanceReasons: ["готово"],
    reviewerMonitoringStatus: "ready",
    reviewerExceptionStatus: "ready",
    reviewerAdjudicationStatus: "ready",
    reviewerFollowupStatus: "ready",
    reviewerRollbackStatus: "ready",
    reviewerArchiveStatus: "ready",
    ownerSignoffStatus: "ready",
    protectedReviewWindowCount: 6,
    monitoredProtectedReviewCount: 4,
    escalatedProtectedReviewCount: 1,
    adjudicatedProtectedGovernanceCount: 1,
    followupClosedProtectedCount: 1,
    rollbackReadyProtectedCount: 1,
    archivedProtectedReviewCount: 4,
    unresolvedGovernanceReviewCount: 0,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload({
      ...base,
      rawProtectedReviewerLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload({
      ...base,
      protectedReviewerGovernanceReasons: ["клинический диагноз подтверждён"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload({
      ...base,
      adjudicatedProtectedGovernanceCount: 2,
      escalatedProtectedReviewCount: 1,
    }),
    VisitWorkspaceValidationError,
  );
});

test("Batch CE Stage 5H protected reviewer evidence payload rejects protected and clinical fields", () => {
  const base = {
    protectedReviewerEvidenceStatus: "ready_for_protected_reviewer_evidence",
    protectedReviewerEvidenceReasons: ["готово"],
    reviewerMonitoringEvidenceStatus: "ready",
    reviewerExceptionEvidenceStatus: "ready",
    reviewerAdjudicationEvidenceStatus: "ready",
    reviewerFollowupEvidenceStatus: "ready",
    reviewerRollbackEvidenceStatus: "ready",
    reviewerArchiveEvidenceStatus: "ready",
    ownerSignoffStatus: "ready",
    protectedReviewWindowCount: 6,
    monitoredProtectedReviewCount: 4,
    sampledProtectedReviewCount: 3,
    adjudicatedProtectedEvidenceCount: 3,
    followupClosedProtectedCount: 3,
    rollbackDrillProtectedCount: 1,
    archivedProtectedReviewCount: 4,
    unresolvedProtectedEvidenceCount: 0,
    blockerCount: 0,
  };
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload({
      ...base,
      rawProtectedReviewerEvidenceLog: [{ unsafe: true }],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload({
      ...base,
      protectedReviewerEvidenceReasons: ["клинический диагноз подтверждён"],
    }),
    VisitWorkspaceValidationError,
  );
  assert.throws(
    () => normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload({
      ...base,
      sampledProtectedReviewCount: 5,
    }),
    VisitWorkspaceValidationError,
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
