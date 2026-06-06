import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetVisitAssessmentSql,
  buildGetVisitConclusionSql,
  buildGetLesionCaptureMetadataSql,
  buildGetLesionLongitudinalHistorySql,
  buildGetLesionLongitudinalQaSql,
  buildGetProtectedLesionImageAssetSql,
  buildGetVisitLesionComparisonViewerQaReviewQueueSql,
  buildGetVisitLongitudinalDatasetValidationSql,
  buildGetVisitReportSql,
  buildAssignLesionComparisonReviewerSql,
  buildReviewVisitLongitudinalTimelineRolloutSql,
  buildReviewLesionComparisonMeasurementPolicySql,
  buildReviewLesionComparisonProductionAnalysisPolicySql,
  buildReviewVisitLongitudinalTimelineRolloutEvidenceSql,
  buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql,
  buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql,
  buildReviewVisitLongitudinalTimelineRolloutMonitoringSql,
  buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql,
  buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql,
  buildReviewVisitLongitudinalTimelineRolloutSopSql,
  buildReviewLesionComparisonViewerQaSql,
  buildReviewLesionComparisonViewerQaReviewerWorkflowSql,
  buildUpsertAssetCaptureMetadataSql,
  buildUpsertLesionComparisonDraftSql,
  buildUpsertLesionComparisonViewerQaSql,
  buildUpsertVisitAssessmentSql,
  buildUpsertVisitConclusionSql,
  createClinicalWorkspaceRepository,
} from "./clinical-workspace-repository.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("Stage 5H repository builders scope assessment, conclusion and report reads", () => {
  const assessment = buildGetVisitAssessmentSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(assessment, /from clinical_assessments a/);
  assert.match(assessment, /where a\.visit_id =/);
  assert.match(assessment, /and a\.clinic_id in/);

  const conclusion = buildGetVisitConclusionSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(conclusion, /from clinical_conclusions c/);
  assert.match(conclusion, /and c\.clinic_id in/);

  const report = buildGetVisitReportSql({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.match(report, /from reports r/);
  assert.match(report, /physician_text as "physicianText"/);
});

test("Batch AW Stage 5H repository builds metadata-only lesion longitudinal history SQL", () => {
  const sql = buildGetLesionLongitudinalHistorySql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /left join clinical_assessments ca/);
  assert.match(sql, /patient_delivery_allowed/i);
  assert.match(sql, /protected_fields_exposed/i);
  assert.match(sql, /and l\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text/i,
  );
});

test("Batch BG Stage 5H repository builds metadata-only lesion longitudinal QA SQL", () => {
  const sql = buildGetLesionLongitudinalQaSql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from lesions l/);
  assert.match(sql, /clinical_asset_capture_metadata/);
  assert.match(sql, /lesion_comparison_viewer_qa_drafts/);
  assert.match(sql, /device_evidence_status/);
  assert.match(sql, /deviceEvidenceNotReadyCount/);
  assert.match(sql, /device_metadata_not_ready/);
  assert.match(sql, /complete_device_metadata/);
  assert.match(sql, /medical_devices d/);
  assert.match(sql, /device_bridges b/);
  assert.match(sql, /device_bridge_quality_status/);
  assert.match(sql, /deviceBridgeQualityNotReadyCount/);
  assert.match(sql, /device_bridge_quality_not_ready/);
  assert.match(sql, /check_device_bridge/);
  assert.match(sql, /production_asset_status/);
  assert.match(sql, /productionAssetNotReadyCount/);
  assert.match(sql, /production_asset_not_ready/);
  assert.match(sql, /verify_production_asset/);
  assert.match(sql, /productionAnalysisPolicyNotReadyCount/);
  assert.match(sql, /production_analysis_policy_required/);
  assert.match(sql, /approve_production_analysis_policy/);
  assert.match(sql, /object_bucket is null or a\.object_key is null/);
  assert.match(sql, /longitudinal_qa\.read/i);
  assert.match(sql, /technicalRolloutReady/);
  assert.match(sql, /dynamicConclusionAllowed/);
  assert.match(sql, /pairKeysExposed/);
  assert.match(sql, /imageIdsExposed/);
  assert.match(sql, /and l\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /q\.pair_key|q\.image_ids|d\.serial|b\.host_name|worker_metadata_json|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken|sessionId/i,
  );
});

test("Batch BJ Stage 5H repository builds visit-level longitudinal dataset validation SQL", () => {
  const sql = buildGetVisitLongitudinalDatasetValidationSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from visits v/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /clinical_asset_capture_metadata/);
  assert.match(sql, /lesion_comparison_viewer_qa_drafts/);
  assert.match(sql, /device_evidence_status/);
  assert.match(sql, /deviceEvidenceNotReadyCount/);
  assert.match(sql, /device_metadata_not_ready/);
  assert.match(sql, /complete_device_metadata/);
  assert.match(sql, /medical_devices d/);
  assert.match(sql, /device_bridges b/);
  assert.match(sql, /device_bridge_quality_status/);
  assert.match(sql, /deviceBridgeQualityNotReadyCount/);
  assert.match(sql, /device_bridge_quality_not_ready/);
  assert.match(sql, /check_device_bridge/);
  assert.match(sql, /production_asset_status/);
  assert.match(sql, /productionAssetNotReadyCount/);
  assert.match(sql, /production_asset_not_ready/);
  assert.match(sql, /verify_production_asset/);
  assert.match(sql, /productionAnalysisPolicyNotReadyCount/);
  assert.match(sql, /production_analysis_policy_required/);
  assert.match(sql, /approve_production_analysis_policy/);
  assert.match(sql, /object_bucket is null or a\.object_key is null/);
  assert.match(sql, /reviewer_workflow_status/);
  assert.match(sql, /visit_longitudinal_dataset_validation\.read/i);
  assert.match(sql, /visit_longitudinal_timeline_rollout_reviews/);
  assert.match(sql, /timelineRollout/);
  assert.match(sql, /visit_longitudinal_timeline_rollout_sop_reviews/);
  assert.match(sql, /timelineRolloutSop/);
  assert.match(sql, /visit_longitudinal_timeline_rollout_evidence_reviews/);
  assert.match(sql, /timelineRolloutEvidence/);
  assert.match(sql, /visit_longitudinal_timeline_rollout_monitoring_reviews/);
  assert.match(sql, /timelineRolloutMonitoring/);
  assert.match(sql, /visit_longitudinal_timeline_rollout_incident_procedure_reviews/);
  assert.match(sql, /timelineRolloutIncidentProcedure/);
  assert.match(sql, /approved_for_clinical_operations|not_approved/);
  assert.match(sql, /ready_for_operational_rollout|not_started/);
  assert.match(sql, /ready_for_monitored_rollout|not_started/);
  assert.match(sql, /ready_for_production_rollout|not_started/);
  assert.match(sql, /ready_for_clinic_monitoring|not_started/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.match(sql, /ready_for_rollout/);
  assert.match(sql, /dynamicConclusionAllowed/);
  assert.match(sql, /pairKeysExposed/);
  assert.match(sql, /imageIdsExposed/);
  assert.match(sql, /and v\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /q\.pair_key|q\.image_ids|d\.serial|b\.host_name|worker_metadata_json|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken|sessionId/i,
  );
});

test("Batch BS Stage 5H repository builds metadata-only timeline rollout SOP SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutSopSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    sop: {
      sopStatus: "ready_for_operational_rollout",
      sopReasons: ["timeline_rollout_sop_ready_no_patient_delivery"],
      validationStatus: "ready_for_rollout",
      rolloutStatus: "approved_for_clinical_operations",
      datasetValidationStatus: "ready",
      reviewerOperationsStatus: "ready",
      rollbackPlanStatus: "ready",
      monitoringPlanStatus: "ready",
      rolloutWindowStatus: "ready",
      ownerAckStatus: "ready",
      lesionCount: 2,
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_sop_reviews/);
  assert.match(sql, /sop_status/);
  assert.match(sql, /ready_for_operational_rollout/);
  assert.match(sql, /timelineRolloutSopBoundary/);
  assert.match(sql, /operational_only/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BT Stage 5H repository builds metadata-only timeline rollout evidence SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutEvidenceSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    evidence: {
      evidenceStatus: "ready_for_monitored_rollout",
      evidenceReasons: ["timeline_rollout_evidence_ready_no_dynamic_conclusion"],
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
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_evidence_reviews/);
  assert.match(sql, /evidence_status/);
  assert.match(sql, /ready_for_monitored_rollout/);
  assert.match(sql, /timelineRolloutEvidenceBoundary/);
  assert.match(sql, /aggregate_only/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BU Stage 5H repository builds metadata-only timeline rollout monitoring SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutMonitoringSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    monitoring: {
      monitoringStatus: "ready_for_production_rollout",
      monitoringReasons: ["timeline_rollout_monitoring_ready_no_dynamic_conclusion"],
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
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_monitoring_reviews/);
  assert.match(sql, /monitoring_status/);
  assert.match(sql, /ready_for_production_rollout/);
  assert.match(sql, /timelineRolloutMonitoringBoundary/);
  assert.match(sql, /incidentEvidenceBoundary/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|rawMonitoringLog|incidentPayload|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BV Stage 5H repository builds metadata-only incident procedure SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutIncidentProcedureSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    procedure: {
      procedureStatus: "ready_for_clinic_monitoring",
      procedureReasons: ["timeline_rollout_incident_procedure_ready_no_dynamic_conclusion"],
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
      realDatasetTimelineCount: 8,
      monitoredTimelineCount: 8,
      sampledOutcomeCount: 4,
      incidentCaseCount: 1,
      unresolvedIncidentCount: 0,
      escalatedIncidentCount: 0,
      rollbackDecisionCount: 1,
      lesionCount: 2,
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_incident_procedure_reviews/);
  assert.match(sql, /procedure_status/);
  assert.match(sql, /ready_for_clinic_monitoring/);
  assert.match(sql, /timelineRolloutIncidentProcedureBoundary/);
  assert.match(sql, /realClinicalDatasetBoundary/);
  assert.match(sql, /incidentProcedureBoundary/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|rawMonitoringLog|rawOutcomeLog|incidentPayload|incidentDetails|incidentTimeline|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BW Stage 5H repository builds metadata-only clinical validation SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutClinicalValidationSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicalValidation: {
      clinicalValidationStatus: "ready_for_clinical_validation",
      clinicalValidationReasons: ["timeline_rollout_clinical_validation_ready_no_dynamic_conclusion"],
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
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_clinical_validation_reviews/);
  assert.match(sql, /clinical_validation_status/);
  assert.match(sql, /ready_for_clinical_validation/);
  assert.match(sql, /timelineRolloutClinicalValidationBoundary/);
  assert.match(sql, /realClinicalDatasetBoundary/);
  assert.match(sql, /validationReviewBoundary/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|rawValidationLog|rawAdjudicationLog|clinicalValidationPayload|validationDetails|adjudicationDetails|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|validatorName|validatorEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BX Stage 5H repository builds metadata-only post-validation monitoring SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutPostValidationMonitoringSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    postValidationMonitoring: {
      postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
      postValidationMonitoringReasons: ["timeline_rollout_post_validation_monitoring_ready_no_dynamic_conclusion"],
      clinicalValidationStatus: "ready_for_clinical_validation",
      incidentProcedureStatus: "ready_for_clinic_monitoring",
      monitoringStatus: "ready_for_production_rollout",
      evidenceStatus: "ready_for_monitored_rollout",
      sopStatus: "ready_for_operational_rollout",
      validationStatus: "ready_for_rollout",
      rolloutStatus: "approved_for_clinical_operations",
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
      lesionCount: 2,
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_post_validation_monitoring_reviews/);
  assert.match(sql, /post_validation_monitoring_status/);
  assert.match(sql, /ready_for_post_validation_monitoring/);
  assert.match(sql, /timelineRolloutPostValidationMonitoringBoundary/);
  assert.match(sql, /postValidationMonitoringBoundary/);
  assert.match(sql, /driftReviewBoundary/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|rawMonitoringLog|rawOutcomeLog|rawValidationLog|rawDriftLog|rawFollowupLog|postValidationPayload|monitoringDetails|driftDetails|followupDetails|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|validatorName|validatorEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BY Stage 5H repository builds metadata-only observation governance SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutObservationGovernanceSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    observationGovernance: {
      observationGovernanceStatus: "ready_for_observation_governance",
      observationGovernanceReasons: ["timeline_rollout_observation_governance_ready_no_dynamic_conclusion"],
      postValidationMonitoringStatus: "ready_for_post_validation_monitoring",
      clinicalValidationStatus: "ready_for_clinical_validation",
      incidentProcedureStatus: "ready_for_clinic_monitoring",
      monitoringStatus: "ready_for_production_rollout",
      evidenceStatus: "ready_for_monitored_rollout",
      sopStatus: "ready_for_operational_rollout",
      validationStatus: "ready_for_rollout",
      rolloutStatus: "approved_for_clinical_operations",
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
      lesionCount: 2,
      readyTimelineCount: 2,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_observation_governance_reviews/);
  assert.match(sql, /observation_governance_status/);
  assert.match(sql, /ready_for_observation_governance/);
  assert.match(sql, /timelineRolloutObservationGovernanceBoundary/);
  assert.match(sql, /observationGovernanceBoundary/);
  assert.match(sql, /incidentOutcomeReviewBoundary/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|rawObservationLog|rawOutcomeReviewLog|rawIncidentOutcomeLog|observationPayload|outcomeReviewPayload|incidentOutcomePayload|governancePayload|outcomeDetails|incidentOutcomeDetails|governanceDetails|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|validatorName|validatorEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch BR Stage 5H repository builds metadata-only timeline rollout governance SQL", () => {
  const sql = buildReviewVisitLongitudinalTimelineRolloutSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    rollout: {
      rolloutStatus: "approved_for_clinical_operations",
      rolloutReasons: ["timeline_rollout_governance_approved_no_dynamic_conclusion"],
      validationStatus: "ready_for_rollout",
      lesionCount: 2,
      readyTimelineCount: 2,
      needsReviewTimelineCount: 0,
      blockedTimelineCount: 0,
      candidatePairCount: 3,
      reviewerWorkflowReadyCount: 3,
    },
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /insert into visit_longitudinal_timeline_rollout_reviews/);
  assert.match(sql, /rollout_status/);
  assert.match(sql, /approved_for_clinical_operations/);
  assert.match(sql, /timelineRolloutBoundary/);
  assert.match(sql, /metadata_only/);
  assert.match(sql, /patientDeliveryAllowed/);
  assert.match(sql, /medicalMeasurementAllowed/);
  assert.match(sql, /protectedFieldsExposed/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.match(sql, /pairKeysExposed/);
  assert.match(sql, /imageIdsExposed/);
  assert.doesNotMatch(
    sql,
    /"pairKey"\s*:|"imageIds"\s*:|objectBucket|objectKey|storagePath|storageObjectPath|signedUrl|accessToken|qrToken|sessionId|reviewerName|reviewerEmail|doctorVersionText|patientSafeText|dynamicConclusion|diagnosis|riskScore/i,
  );
});

test("Batch AX Stage 5H repository builds internal protected lesion image proxy SQL", () => {
  const sql = buildGetProtectedLesionImageAssetSql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetId: "10000000-0000-4000-8000-000000000901",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /join lesions l/);
  assert.match(sql, /a\.object_bucket as "objectBucket"/);
  assert.match(sql, /a\.object_key as "objectKey"/);
  assert.match(sql, /a\.kind in \('overview_photo', 'dermoscopy'\)/);
  assert.match(sql, /a\.content_type like 'image\/%'/);
  assert.match(sql, /and a\.clinic_id in/);
  assert.doesNotMatch(sql, /signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken/i);
});

test("Batch BC Stage 5H repository builds production capture metadata SQL without protected storage fields", () => {
  const sql = buildGetLesionCaptureMetadataSql({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /clinical_asset_capture_metadata m/);
  assert.match(sql, /frame_width/);
  assert.match(sql, /scale_marker_detected/);
  assert.match(sql, /device_capture_profile/);
  assert.match(sql, /device_evidence_status/);
  assert.match(sql, /device_bridge_quality_status/);
  assert.match(sql, /production_asset_status/);
  assert.match(sql, /productionAssetReadyCount/);
  assert.match(sql, /productionAssetReviewCount/);
  assert.match(sql, /production_asset_not_ready/);
  assert.match(sql, /deviceBridgeQualityReadyCount/);
  assert.match(sql, /deviceBridgeQualityReviewCount/);
  assert.match(sql, /patient_delivery_allowed/i);
  assert.match(sql, /and a\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /d\.serial|b\.host_name|worker_metadata_json|checksum_sha256|signed_url\b|storage_object_path|physician_text|patient_safe_text|access_token|qrToken/i,
  );
});

test("Batch BC Stage 5H repository upserts capture metadata as metadata-only asset state", () => {
  const sql = buildUpsertAssetCaptureMetadataSql({
    visitId: VISIT_ID,
    assetId: "10000000-0000-4000-8000-000000000901",
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    capturedByUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    metadata: {
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
      deviceEvidenceStatus: "ready",
    },
  });

  assert.match(sql, /insert into clinical_asset_capture_metadata/);
  assert.match(sql, /device_capture_profile/);
  assert.match(sql, /lighting_profile/);
  assert.match(sql, /focus_profile/);
  assert.match(sql, /distance_profile/);
  assert.match(sql, /device_calibration_status/);
  assert.match(sql, /device_evidence_status/);
  assert.match(sql, /on conflict \(asset_id\) do update/);
  assert.match(sql, /patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false/);
  assert.match(sql, /where true and clinical_asset_capture_metadata\.clinic_id in/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token|qrToken|deviceSerial|macAddress|ipAddress|credential/i);
});

test("Stage 5H assessment/conclusion upserts use visit_id conflict and do not expose managed storage fields", () => {
  const assessment = buildUpsertVisitAssessmentSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: {
      status: "ready",
      riskLevel: "moderate",
      abcdTotal: 3.7,
      sevenPointTotal: 2,
      summary: "контроль",
      recommendation: "наблюдение",
    },
  });
  assert.match(assessment, /insert into clinical_assessments/);
  assert.match(assessment, /on conflict \(visit_id\) do update/);
  assert.match(assessment, /risk_level = 'moderate'/);

  const conclusion = buildUpsertVisitConclusionSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    changes: { status: "ready", summary: "заключение", nextStep: "контроль" },
  });
  assert.match(conclusion, /insert into clinical_conclusions/);
  assert.match(conclusion, /next_step = 'контроль'/);
  assert.doesNotMatch(`${assessment}\n${conclusion}`, /storage_object_path|signed_url|access_token/i);
});

test("Stage 5H repository normalizes assessment rows", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000701",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          doctorUserId: USER_ID,
          status: "ready",
          riskLevel: "moderate",
          abcdTotal: "3.70",
          sevenPointTotal: 2,
          summary: "контроль",
          recommendation: "наблюдение",
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const assessment = await repo.getAssessment({ visitId: VISIT_ID, clinicIds: [CLINIC_ID] });
  assert.equal(assessment.visitId, VISIT_ID);
  assert.equal(assessment.abcdTotal, 3.7);
  assert.equal(assessment.sevenPointTotal, 2);
});

test("Batch AX Stage 5H repository normalizes protected lesion image asset internally", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000901",
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          lesionId: "10000000-0000-4000-8000-000000000801",
          kind: "dermoscopy",
          contentType: "image/png",
          byteSize: "12",
          capturedAt: "2026-05-19T10:40:00.000Z",
          objectBucket: "clinical-assets",
          objectKey: "clinics/demo/protected.png",
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const asset = await repo.getProtectedLesionImageAsset({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    assetId: "10000000-0000-4000-8000-000000000901",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(asset.id, "10000000-0000-4000-8000-000000000901");
  assert.equal(asset.contentType, "image/png");
  assert.equal(asset.objectBucket, "clinical-assets");
  assert.equal(asset.objectKey, "clinics/demo/protected.png");
  assert.equal(asset.patientDeliveryAllowed, false);
  assert.equal(asset.signedUrlsIssued, false);
  assert.equal(asset.storagePathsExposed, false);
});

test("Stage 5H lesion comparison draft upsert is clinic-scoped and metadata-only", () => {
  const sql = buildUpsertLesionComparisonDraftSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    draft: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки", "Есть технические замечания"],
    },
  });

  assert.match(sql, /insert into lesion_comparison_decision_drafts/);
  assert.match(sql, /on conflict \(visit_id, lesion_id, pair_key\) do update/);
  assert.match(sql, /patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false/);
  assert.match(sql, /where true and lesion_comparison_decision_drafts\.clinic_id in/);
  assert.doesNotMatch(sql, /storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion/i);
});

test("Batch BD Stage 5H viewer QA upsert is clinic-scoped and disables medical measurement", () => {
  const sql = buildUpsertLesionComparisonViewerQaSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    qa: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
      calibrationStatus: "not_ready",
      calibrationReasons: ["scale_marker_missing"],
      captureMetadataStatus: "needs_review",
    },
  });

  assert.match(sql, /insert into lesion_comparison_viewer_qa_drafts/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /a\.id::text = any/);
  assert.match(sql, /a\.kind in \('overview_photo', 'dermoscopy'\)/);
  assert.match(sql, /a\.content_type like 'image\/%'/);
  assert.match(sql, /where a\.asset_count = 2/);
  assert.match(sql, /on conflict \(visit_id, lesion_id, pair_key\) do update/);
  assert.match(sql, /medical_measurement_allowed,\s+patient_delivery_allowed,\s+protected_fields_exposed/);
  assert.match(sql, /false,\s+false,\s+false/);
  assert.match(sql, /and l\.clinic_id in/);
  assert.match(sql, /and a\.clinic_id in/);
  assert.match(sql, /where true and lesion_comparison_viewer_qa_drafts\.clinic_id in/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken/i);
});

test("Batch BE Stage 5H viewer QA review updates an existing metadata-only draft", () => {
  const sql = buildReviewLesionComparisonViewerQaSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    review: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      reviewStatus: "needs_recapture",
      reviewReasons: ["repeat_capture_required"],
    },
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /review_status = 'needs_recapture'/);
  assert.match(sql, /review_reasons = '\["repeat_capture_required"\]'::jsonb/);
  assert.match(sql, /reviewed_by_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /reviewed_at = now\(\)/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText/i,
  );
});

test("Batch BH Stage 5H reviewer workflow requires calibrated technical gates", () => {
  const sql = buildReviewLesionComparisonViewerQaReviewerWorkflowSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    workflow: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      workflowStatus: "reviewer_accepted",
      workflowReasons: ["calibrated_reviewer_workflow_ready"],
    },
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /q\.review_status = 'technical_ready'/);
  assert.match(sql, /q\.calibration_status = 'ready'/);
  assert.match(sql, /q\.capture_metadata_status = 'ready'/);
  assert.match(sql, /q\.measurement_policy_status = 'approved_for_technical_review'/);
  assert.match(sql, /q\.production_analysis_policy_status = 'approved_for_production_analysis'/);
  assert.match(sql, /q\.reviewer_assignment_status in \('assigned', 'second_review_assigned', 'second_review_completed'\)/);
  assert.match(sql, /q\.second_review_status in \('not_required', 'completed'\)/);
  assert.match(sql, /measurement_policy_required/);
  assert.match(sql, /reviewer_assignment_required/);
  assert.match(sql, /second_review_required/);
  assert.match(sql, /production_analysis_policy_required/);
  assert.match(sql, /productionAnalysisPolicyApproved/);
  assert.match(sql, /jsonb_array_length\(q\.technical_markers\) >= 2/);
  assert.match(sql, /reviewer_workflow_status/);
  assert.match(sql, /'technical_gate_blocked'/);
  assert.match(sql, /'reviewer_accepted'/);
  assert.match(sql, /reviewer_workflow_reasons/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText|clinicalConclusion/i,
  );
});

test("Batch BO Stage 5H measurement policy review updates only metadata-safe policy state", () => {
  const sql = buildReviewLesionComparisonMeasurementPolicySql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    policy: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      measurementPolicyStatus: "approved_for_technical_review",
      measurementPolicyReasons: ["technical_measurement_policy_approved_no_mm_output"],
    },
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /measurement_policy_status = 'approved_for_technical_review'/);
  assert.match(sql, /measurement_policy_reasons = '\["technical_measurement_policy_approved_no_mm_output"\]'::jsonb/);
  assert.match(sql, /measurement_policy_reviewed_by_user_id = '10000000-0000-4000-8000-000000000101'::uuid/);
  assert.match(sql, /measurement_policy_reviewed_at = now\(\)/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText|diameterMm|areaMm2|riskScore/i,
  );
});

test("Batch BQ Stage 5H production analysis policy review updates only metadata-safe policy state", () => {
  const sql = buildReviewLesionComparisonProductionAnalysisPolicySql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    policy: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      productionAnalysisPolicyStatus: "approved_for_production_analysis",
      productionAnalysisPolicyReasons: ["production_analysis_policy_approved_no_dynamic_conclusion"],
    },
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /from lesions l/);
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, /production_analysis_policy_status/);
  assert.match(sql, /approved_for_production_analysis/);
  assert.match(sql, /production_analysis_policy_required/);
  assert.match(sql, /productionAnalysisPolicyBoundary/);
  assert.match(sql, /clinicalOutputGenerated/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /diameterMm|areaMm2|dynamicConclusion|clinicalDynamicConclusion|diagnosis|riskScore|treatment|storagePath|signedUrl|objectBucket|objectKey|qrToken|sessionId|patientSafeText/i,
  );
});

test("Batch BP Stage 5H reviewer assignment stores only metadata-safe assignment state", () => {
  const sql = buildAssignLesionComparisonReviewerSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    assignment: {
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
  });

  assert.match(sql, /update lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /reviewer_assignment_status/);
  assert.match(sql, /second_review_status/);
  assert.match(sql, /assigned_reviewer_user_id/);
  assert.match(sql, /second_reviewer_user_id/);
  assert.match(sql, /measurement_policy_required/);
  assert.match(sql, /reviewer_assignment_required/);
  assert.match(sql, /second_reviewer_must_differ/);
  assert.match(sql, /reviewerIdentityExposed/);
  assert.match(sql, /'reviewerAssignmentReady'/);
  assert.match(sql, /'secondReviewReady'/);
  assert.match(sql, /medical_measurement_allowed = false/);
  assert.match(sql, /patient_delivery_allowed = false/);
  assert.match(sql, /protected_fields_exposed = false/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /reviewerName|reviewerEmail|object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText|diagnosis|treatment|riskScore/i,
  );
});

test("Batch BF Stage 5H viewer QA review queue SQL is visit-scoped and metadata-only", () => {
  const sql = buildGetVisitLesionComparisonViewerQaReviewQueueSql({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    status: "actionable",
    limit: 20,
    clinicIds: [CLINIC_ID],
  });

  assert.match(sql, /from visits v/);
  assert.match(sql, /from lesion_comparison_viewer_qa_drafts q/);
  assert.match(sql, /left join lesions l/);
  assert.match(sql, /q\.visit_id = v\.id/);
  assert.match(sql, /q\.review_status = any\(array\['unreviewed', 'technical_ready', 'needs_recapture', 'not_suitable_for_comparison'\]::text\[\]\)/);
  assert.match(sql, /jsonb_build_object\('total'/);
  assert.match(sql, /measurementPolicyRequired/);
  assert.match(sql, /reviewerAssignmentRequired/);
  assert.match(sql, /secondReviewRequired/);
  assert.match(sql, /productionAnalysisPolicyRequired/);
  assert.match(sql, /approve_measurement_policy/);
  assert.match(sql, /assign_reviewer/);
  assert.match(sql, /complete_second_review/);
  assert.match(sql, /approve_production_analysis_policy/);
  assert.match(sql, /'pairKeysExposed', false/);
  assert.match(sql, /'imageIdsExposed', false/);
  assert.match(sql, /limit 20/);
  assert.match(sql, /and q\.clinic_id in/);
  assert.doesNotMatch(
    sql,
    /q\.pair_key as|q\.image_ids as|object_bucket|object_key|storage_object_path|signed_url|access_token|photoRef|heatmapRef|modelVersion|qrToken|sessionId|doctorVersionText|patientSafeText/i,
  );
});

test("Stage 5H repository normalizes lesion comparison draft rows", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000704",
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
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const draft = await repo.upsertLesionComparisonDraft({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    draft: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      action: "retake",
      comparability: "not_comparable",
      reasons: ["Разные условия съёмки"],
    },
  });

  assert.equal(draft.visitId, VISIT_ID);
  assert.deepEqual(draft.imageIds, ["i-011", "i-012"]);
  assert.equal(draft.patientDeliveryAllowed, false);
  assert.equal(draft.protectedFieldsExposed, false);
});

test("Batch BE Stage 5H repository normalizes viewer QA review with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
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
          reviewStatus: "needs_recapture",
          reviewReasons: ["repeat_capture_required"],
          reviewedByUserId: USER_ID,
          reviewedAt: "2026-05-19T10:50:00.000Z",
          medicalMeasurementAllowed: true,
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.reviewLesionComparisonViewerQa({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    review: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      reviewStatus: "needs_recapture",
      reviewReasons: ["repeat_capture_required"],
    },
  });

  assert.equal(qa.review.status, "needs_recapture");
  assert.deepEqual(qa.review.reasons, ["repeat_capture_required"]);
  assert.equal(qa.review.reviewedByUserId, USER_ID);
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);
  assert.equal(qa.protectedFieldsExposed, false);
});

test("Batch BH Stage 5H repository normalizes reviewer workflow with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
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
          reviewStatus: "technical_ready",
          reviewReasons: ["technical_review_ready"],
          reviewedByUserId: USER_ID,
          reviewedAt: "2026-05-19T10:50:00.000Z",
          reviewerWorkflowStatus: "reviewer_accepted",
          reviewerWorkflowReasons: ["calibrated_reviewer_workflow_ready"],
          reviewerWorkflowByUserId: USER_ID,
          reviewerWorkflowAt: "2026-05-19T10:55:00.000Z",
          reviewerWorkflowGate: {
            technicalReviewReady: true,
            calibrationReady: true,
            captureMetadataReady: true,
            markerGateReady: true,
            productionAnalysisPolicyApproved: true,
            medicalMeasurementAllowed: true,
            patientDeliveryAllowed: true,
            clinicalConclusionGenerated: true,
          },
          medicalMeasurementAllowed: true,
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.reviewLesionComparisonViewerQaReviewerWorkflow({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    workflow: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      workflowStatus: "reviewer_accepted",
      workflowReasons: ["calibrated_reviewer_workflow_ready"],
    },
  });

  assert.equal(qa.reviewerWorkflow.status, "reviewer_accepted");
  assert.deepEqual(qa.reviewerWorkflow.reasons, ["calibrated_reviewer_workflow_ready"]);
  assert.equal(qa.reviewerWorkflow.gate.technicalReviewReady, true);
  assert.equal(qa.reviewerWorkflow.gate.productionAnalysisPolicyApproved, true);
  assert.equal(qa.reviewerWorkflow.gate.medicalMeasurementAllowed, false);
  assert.equal(qa.reviewerWorkflow.gate.patientDeliveryAllowed, false);
  assert.equal(qa.reviewerWorkflow.gate.clinicalConclusionGenerated, false);
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);
  assert.equal(qa.protectedFieldsExposed, false);
});

test("Batch BF Stage 5H repository normalizes viewer QA review queue without pair keys or image IDs", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
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
            actionable: 3,
            productionAnalysisPolicyRequired: 1,
          },
          items: [
            {
              queueNumber: 1,
              lesionId: "l-008",
              lesionLabel: "Очаг B",
              bodyZone: "Плечо",
              bodySurface: "front",
              reviewStatus: "needs_recapture",
              reviewReasons: ["repeat_capture_required"],
              calibrationStatus: "not_ready",
              calibrationReasons: ["scale_marker_missing"],
              captureMetadataStatus: "needs_review",
              productionAnalysisPolicy: {
                status: "review_required",
                reasons: ["production_analysis_policy_required"],
                reviewedAt: null,
                medicalMeasurementAllowed: true,
                patientDeliveryAllowed: true,
                clinicalOutputGenerated: true,
              },
              technicalMarkerCount: 1,
              reviewedAt: "2026-05-19T10:50:00.000Z",
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
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const queue = await repo.getVisitLesionComparisonViewerQaReviewQueue({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    status: "actionable",
    limit: 20,
    clinicIds: [CLINIC_ID],
  });

  assert.equal(queue.summary.needsRecapture, 1);
  assert.equal(queue.summary.productionAnalysisPolicyRequired, 1);
  assert.equal(queue.items[0].review.status, "needs_recapture");
  assert.equal(queue.items[0].productionAnalysisPolicy.status, "review_required");
  assert.equal(queue.items[0].productionAnalysisPolicy.patientDeliveryAllowed, false);
  assert.equal(queue.items[0].productionAnalysisPolicy.clinicalOutputGenerated, false);
  assert.equal(queue.items[0].nextAction, "request_recapture");
  assert.equal(queue.boundaries.patientDeliveryAllowed, false);
  assert.equal(queue.boundaries.pairKeysExposed, false);
  assert.equal(queue.boundaries.imageIdsExposed, false);
  assert.equal(Object.hasOwn(queue.items[0], "pairKey"), false);
  assert.equal(Object.hasOwn(queue.items[0], "imageIds"), false);
});

test("Batch BC Stage 5H repository normalizes capture metadata with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
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
          },
          items: [
            {
              assetId: "10000000-0000-4000-8000-000000000901",
              visitId: VISIT_ID,
              kind: "dermoscopy",
              contentType: "image/png",
              capturedAt: "2026-05-19T10:40:00.000Z",
              captureSource: "device_bridge",
              deviceId: "10000000-0000-4000-8000-000000000501",
              deviceProfile: "FotoFinder Handyscope · FF-screen",
              frameWidth: 2048,
              frameHeight: 2048,
              qualityScore: "91.00",
              qualityIssues: [],
              scaleMarkerDetected: false,
              millimetersAvailable: false,
              deviceCaptureProfile: "standard_dermoscopy",
              lightingProfile: "polarized",
              focusProfile: "locked",
              distanceProfile: "fixed",
              deviceCalibrationStatus: "valid",
              deviceCalibrationCheckedAt: "2026-05-19T10:40:00.000Z",
              deviceEvidenceStatus: "ready",
              technicalStatus: "ready",
              technicalReasons: [],
            },
          ],
          boundaries: {
            patientDeliveryAllowed: true,
            protectedFieldsExposed: true,
            storagePathsExposed: true,
            signedUrlsIssued: true,
            rawImageBytesExposed: true,
          },
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const metadata = await repo.getLesionCaptureMetadata({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(metadata.summary.assetCount, 2);
  assert.equal(metadata.items[0].frame.width, 2048);
  assert.equal(metadata.items[0].quality.score, 91);
  assert.equal(metadata.items[0].calibration.millimetersAvailable, false);
  assert.equal(metadata.summary.deviceEvidenceReadyCount, 1);
  assert.equal(metadata.summary.deviceEvidenceReviewCount, 0);
  assert.equal(metadata.items[0].deviceEvidence.status, "ready");
  assert.equal(metadata.items[0].deviceEvidence.captureProfile, "standard_dermoscopy");
  assert.equal(metadata.items[0].deviceEvidence.calibrationStatus, "valid");
  assert.equal(metadata.boundaries.patientDeliveryAllowed, false);
  assert.equal(metadata.boundaries.storagePathsExposed, false);
});

test("Batch BD Stage 5H repository normalizes viewer QA drafts with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          id: "10000000-0000-4000-8000-000000000705",
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
          medicalMeasurementAllowed: true,
          patientDeliveryAllowed: true,
          protectedFieldsExposed: true,
        },
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.upsertLesionComparisonViewerQa({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    doctorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    qa: {
      lesionId: "l-008",
      pairKey: "l-008:i-011+i-012",
      imageIds: ["i-011", "i-012"],
      technicalMarkers: [{ target: "A", xPercent: 48, yPercent: 52 }],
      calibrationStatus: "not_ready",
      calibrationReasons: ["scale_marker_missing"],
      captureMetadataStatus: "needs_review",
    },
  });

  assert.equal(qa.visitId, VISIT_ID);
  assert.deepEqual(qa.technicalMarkers, [{ target: "A", xPercent: 48, yPercent: 52 }]);
  assert.equal(qa.medicalMeasurementAllowed, false);
  assert.equal(qa.patientDeliveryAllowed, false);
  assert.equal(qa.protectedFieldsExposed, false);
});

test("Batch AW Stage 5H repository normalizes longitudinal history with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
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
          visits: [
            {
              visitId: VISIT_ID,
              startedAt: "2026-05-19T10:31:25.000Z",
              status: "signed",
              imageCount: 2,
              dermoscopyCount: 1,
              overviewCount: 1,
              assessmentCount: 1,
              capturedAtFirst: "2026-05-19T10:40:00.000Z",
              capturedAtLast: "2026-05-19T10:45:00.000Z",
            },
          ],
          candidatePairs: [
            {
              previousVisitId: "10000000-0000-4000-8000-000000000302",
              currentVisitId: VISIT_ID,
              previousImageId: "10000000-0000-4000-8000-000000000901",
              currentImageId: "10000000-0000-4000-8000-000000000902",
              kind: "dermoscopy",
              status: "warning",
              reasons: ["missing_capture_time"],
            },
          ],
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
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const history = await repo.getLesionLongitudinalHistory({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(history.lesionId, "10000000-0000-4000-8000-000000000801");
  assert.equal(history.summary.visitCount, 2);
  assert.equal(history.candidatePairs[0].status, "warning");
  assert.equal(history.boundaries.patientDeliveryAllowed, false);
  assert.equal(history.boundaries.protectedFieldsExposed, false);
  assert.equal(history.boundaries.storagePathsExposed, false);
  assert.equal(history.boundaries.signedUrlsIssued, false);
  assert.equal(history.boundaries.rawImageBytesExposed, false);
  assert.equal(history.boundaries.doctorOnlyTextExposed, false);
  assert.equal(history.boundaries.clinicalConclusionGenerated, false);
});

test("Batch BG Stage 5H repository normalizes longitudinal QA with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          lesionId: "10000000-0000-4000-8000-000000000801",
          label: "Очаг A",
          readiness: {
            status: "technical_ready",
            visitCount: 2,
            imageCount: 4,
            candidatePairCount: 2,
            reviewedPairCount: 2,
            technicalReadyPairCount: 2,
            needsRecaptureCount: 0,
            notSuitableForComparisonCount: 0,
            unreviewedPairCount: 0,
            missingCaptureMetadataCount: 0,
            deviceEvidenceNotReadyCount: 1,
            productionAnalysisPolicyNotReadyCount: 1,
            calibrationBlockedCount: 0,
            markerMissingCount: 0,
            technicalRolloutReady: true,
            dynamicConclusionAllowed: true,
          },
          blockers: [
            {
              code: "device_metadata_not_ready",
              label: "Device metadata требует проверки",
              count: 1,
              nextAction: "complete_device_metadata",
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
          ],
          nextActions: ["complete_device_metadata", "continue_review", "unsafe_action"],
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
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const qa = await repo.getLesionLongitudinalQa({
    patientId: PATIENT_ID,
    lesionId: "10000000-0000-4000-8000-000000000801",
    clinicIds: [CLINIC_ID],
  });

  assert.equal(qa.readiness.status, "technical_ready");
  assert.equal(qa.readiness.technicalRolloutReady, true);
  assert.equal(qa.readiness.dynamicConclusionAllowed, false);
  assert.equal(qa.readiness.deviceEvidenceNotReadyCount, 1);
  assert.equal(qa.readiness.productionAnalysisPolicyNotReadyCount, 1);
  assert.equal(qa.boundaries.patientDeliveryAllowed, false);
  assert.equal(qa.boundaries.medicalMeasurementAllowed, false);
  assert.equal(qa.boundaries.pairKeysExposed, false);
  assert.equal(qa.boundaries.imageIdsExposed, false);
  assert.equal(qa.boundaries.clinicalConclusionGenerated, false);
  assert.deepEqual(qa.nextActions, ["complete_device_metadata", "continue_review"]);
  assert.equal(qa.blockers[0].code, "device_metadata_not_ready");
  assert.equal(qa.blockers[0].nextAction, "complete_device_metadata");
  assert.doesNotMatch(
    JSON.stringify(qa),
    /secret-pair|i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|token|session|qr/i,
  );
});

test("Batch BJ Stage 5H repository normalizes visit dataset validation with forced safe boundaries", async () => {
  const dbClient = {
    async queryJson() {
      return [
        {
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
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
            missingCaptureMetadataCount: 0,
            deviceEvidenceNotReadyCount: 1,
            productionAnalysisPolicyNotReadyCount: 1,
            calibrationBlockedCount: 0,
            markerMissingCount: 0,
            reviewerWorkflowReadyCount: 1,
            dynamicConclusionAllowed: true,
          },
          items: [
            {
              queueNumber: 1,
              lesionId: "10000000-0000-4000-8000-000000000801",
              lesionLabel: "Очаг A",
              bodyZone: "спина",
              bodySurface: "back",
              status: "ready_for_rollout",
              visitCount: 2,
              imageCount: 4,
              candidatePairCount: 2,
              reviewedPairCount: 2,
              technicalReadyPairCount: 2,
              missingCaptureMetadataCount: 0,
              deviceEvidenceNotReadyCount: 1,
              productionAnalysisPolicyNotReadyCount: 1,
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
              code: "device_metadata_not_ready",
              label: "Device metadata требует проверки",
              count: 1,
              nextAction: "complete_device_metadata",
              pairKey: "secret-pair",
              imageIds: ["i-011", "i-012"],
            },
          ],
          nextActions: ["complete_device_metadata", "continue_review", "unsafe_action"],
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
      ];
    },
  };
  const repo = createClinicalWorkspaceRepository(dbClient);
  const validation = await repo.getVisitLongitudinalDatasetValidation({
    visitId: VISIT_ID,
    patientId: PATIENT_ID,
    clinicId: CLINIC_ID,
    clinicIds: [CLINIC_ID],
  });

  assert.equal(validation.readiness.status, "ready_for_rollout");
  assert.equal(validation.readiness.dynamicConclusionAllowed, false);
  assert.equal(validation.readiness.deviceEvidenceNotReadyCount, 1);
  assert.equal(validation.readiness.productionAnalysisPolicyNotReadyCount, 1);
  assert.equal(validation.items[0].deviceEvidenceNotReadyCount, 1);
  assert.equal(validation.items[0].productionAnalysisPolicyNotReadyCount, 1);
  assert.equal(validation.items[0].nextAction, "continue_review");
  assert.equal(validation.boundaries.patientDeliveryAllowed, false);
  assert.equal(validation.boundaries.medicalMeasurementAllowed, false);
  assert.equal(validation.boundaries.pairKeysExposed, false);
  assert.equal(validation.boundaries.imageIdsExposed, false);
  assert.equal(validation.boundaries.clinicalConclusionGenerated, false);
  assert.deepEqual(validation.nextActions, ["complete_device_metadata", "continue_review"]);
  assert.equal(validation.blockers[0].code, "device_metadata_not_ready");
  assert.equal(validation.blockers[0].nextAction, "complete_device_metadata");
  assert.doesNotMatch(
    JSON.stringify(validation),
    /secret-pair|i-011|i-012|"pairKey"\s*:|"imageIds"\s*:|"storagePath"\s*:|"signedUrl"\s*:|token|session|qr/i,
  );
});
