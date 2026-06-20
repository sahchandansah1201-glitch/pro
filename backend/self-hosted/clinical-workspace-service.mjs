// Stage 5H · Self-hosted clinical workspace service.
// RBAC, validation and audit for production assessment/conclusion/report contracts.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, visitReadScope, visitWriteScope } from "./rbac.mjs";
import {
  assertUuid,
  VisitWorkspaceNotFoundError,
  VisitWorkspaceValidationError,
} from "./visit-workspace-write-service.mjs";

const CLINICAL_STATUS_VALUES = new Set(["draft", "ready", "signed"]);
const RISK_LEVEL_VALUES = new Set(["low", "moderate", "high", "urgent"]);
const COMPARISON_ACTION_VALUES = new Set(["retake", "excluded", "report_limit"]);
const COMPARABILITY_VALUES = new Set(["comparable", "not_comparable"]);
const CAPTURE_SOURCE_VALUES = new Set(["phone", "device_bridge", "file_import", "camera", "local_transfer", "unknown"]);
const DEVICE_CAPTURE_PROFILE_VALUES = new Set(["standard_dermoscopy", "standard_macro", "overview", "unknown"]);
const LIGHTING_PROFILE_VALUES = new Set(["polarized", "non_polarized", "cross_polarized", "ambient", "unknown"]);
const FOCUS_PROFILE_VALUES = new Set(["locked", "auto", "manual", "unknown"]);
const DISTANCE_PROFILE_VALUES = new Set(["fixed", "estimated", "unknown"]);
const DEVICE_CALIBRATION_STATUS_VALUES = new Set(["valid", "due_soon", "expired", "missing", "not_applicable", "unknown"]);
const CAPTURE_PROTOCOL_VERSION_VALUES = new Set(["clinic_standard_v1", "device_standard_v1", "imported_standard", "unknown"]);
const LENS_PROFILE_VALUES = new Set(["dermoscope_contact", "dermoscope_non_contact", "macro_lens", "phone_camera", "unknown"]);
const POLARIZATION_MODE_VALUES = new Set(["polarized", "non_polarized", "cross_polarized", "not_applicable", "unknown"]);
const COLOR_REFERENCE_STATUS_VALUES = new Set(["captured", "not_required", "missing", "unknown"]);
const DEVICE_CLOCK_SYNC_STATUS_VALUES = new Set(["synced", "stale", "missing", "unknown"]);
const CALIBRATION_STATUS_VALUES = new Set(["ready", "not_ready", "limited"]);
const CAPTURE_METADATA_STATUS_VALUES = new Set(["ready", "needs_review", "missing"]);
const VIEWER_QA_REVIEW_STATUS_VALUES = new Set([
  "technical_ready",
  "needs_recapture",
  "not_suitable_for_comparison",
]);
const VIEWER_QA_REVIEWER_WORKFLOW_STATUS_VALUES = new Set([
  "ready_for_reviewer",
  "reviewer_accepted",
  "reviewer_rejected",
]);
const VIEWER_QA_MEASUREMENT_POLICY_STATUS_VALUES = new Set([
  "not_approved",
  "review_required",
  "approved_for_technical_review",
]);
const VIEWER_QA_PRODUCTION_ANALYSIS_POLICY_STATUS_VALUES = new Set([
  "not_approved",
  "review_required",
  "approved_for_production_analysis",
]);
const VIEWER_QA_REVIEWER_ASSIGNMENT_STATUS_VALUES = new Set([
  "unassigned",
  "assigned",
  "second_review_required",
  "second_review_assigned",
  "second_review_completed",
  "assignment_blocked",
]);
const VIEWER_QA_SECOND_REVIEW_STATUS_VALUES = new Set([
  "not_required",
  "required",
  "assigned",
  "completed",
  "blocked",
]);
const VIEWER_QA_REVIEW_QUEUE_STATUS_VALUES = new Set([
  "actionable",
  "all",
  "unreviewed",
  "technical_ready",
  "needs_recapture",
  "not_suitable_for_comparison",
]);
const TIMELINE_ROLLOUT_STATUS_VALUES = new Set([
  "not_approved",
  "review_required",
  "approved_for_clinical_operations",
]);
const TIMELINE_ROLLOUT_SOP_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_operational_rollout",
]);
const TIMELINE_ROLLOUT_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_monitored_rollout",
]);
const TIMELINE_ROLLOUT_MONITORING_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_rollout",
]);
const TIMELINE_ROLLOUT_INCIDENT_PROCEDURE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_clinic_monitoring",
]);
const TIMELINE_ROLLOUT_CLINICAL_VALIDATION_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_clinical_validation",
]);
const TIMELINE_ROLLOUT_POST_VALIDATION_MONITORING_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_post_validation_monitoring",
]);
const TIMELINE_ROLLOUT_OBSERVATION_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_observation_governance",
]);
const TIMELINE_ROLLOUT_EXCEPTION_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_exception_governance",
]);
const TIMELINE_ROLLOUT_OUTCOME_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_outcome_governance",
]);
const TIMELINE_ROLLOUT_LONGITUDINAL_CLINICAL_VALIDATION_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_longitudinal_clinical_validation",
]);
const TIMELINE_ROLLOUT_PROTECTED_REVIEWER_VALIDATION_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_protected_reviewer_validation",
]);
const TIMELINE_ROLLOUT_PROTECTED_REVIEWER_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_protected_reviewer_governance",
]);
const TIMELINE_ROLLOUT_PROTECTED_REVIEWER_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_protected_reviewer_evidence",
]);
const TIMELINE_ROLLOUT_PRODUCTION_DATASET_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_dataset_evidence",
]);
const TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_ROLLBACK_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_reviewer_rollback_evidence",
]);
const TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_GOVERNANCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_reviewer_governance",
]);
const TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_EVIDENCE_STATUS_VALUES = new Set([
  "not_started",
  "in_review",
  "ready_for_production_reviewer_evidence",
]);
const TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES = new Set(["missing", "needs_review", "ready"]);
const MAX_TEXT = 8000;
const MAX_REASON_TEXT = 120;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:+-]{1,160}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UNSAFE_CLINICAL_REASON_PATTERN = /меланома|рак кожи|вероятность|диагноз|лечение|прогноз/i;
const PROTECTED_INPUT_KEYS = new Set([
  "objectBucket",
  "objectKey",
  "storagePath",
  "storageObjectPath",
  "signedUrl",
  "sharedLink",
  "evidenceUrl",
  "incidentUrl",
  "validationUrl",
  "monitoringUrl",
  "driftUrl",
  "followupUrl",
  "outcomeUrl",
  "governanceUrl",
  "exceptionUrl",
  "recurrenceUrl",
  "rollbackUrl",
  "longitudinalOutcomeUrl",
  "longitudinalClinicalValidationUrl",
  "protectedReviewUrl",
  "reviewerOpsUrl",
  "followupOpsUrl",
  "adjudicationOpsUrl",
  "adjudicationUrl",
  "productionDatasetEvidenceUrl",
  "productionReviewerGovernanceUrl",
  "productionReviewerEvidenceUrl",
  "realClinicWindowUrl",
  "datasetSamplingUrl",
  "longitudinalFollowupUrl",
  "protectedReviewerLinkageUrl",
  "outcomeObservationUrl",
  "incidentLinkageUrl",
  "rawEvidenceLog",
  "rawMonitoringLog",
  "rawOutcomeLog",
  "rawValidationLog",
  "rawAdjudicationLog",
  "rawDriftLog",
  "rawFollowupLog",
  "rawObservationLog",
  "rawOutcomeReviewLog",
  "rawIncidentOutcomeLog",
  "rawExceptionLog",
  "rawRecurrenceLog",
  "rawRollbackLog",
  "rawLongitudinalOutcomeLog",
  "rawLongitudinalClinicalValidationLog",
  "rawProtectedReviewLog",
  "rawReviewerOpsLog",
  "rawFollowupOpsLog",
  "rawAdjudicationOpsLog",
  "rawProtectedAssetLog",
  "clinicalValidationPayload",
  "postValidationPayload",
  "observationPayload",
  "outcomeReviewPayload",
  "incidentOutcomePayload",
  "governancePayload",
  "exceptionPayload",
  "recurrencePayload",
  "rollbackPayload",
  "longitudinalOutcomePayload",
  "longitudinalClinicalValidationPayload",
  "protectedReviewerValidationPayload",
  "protectedReviewerGovernancePayload",
  "protectedReviewerEvidencePayload",
  "productionDatasetEvidencePayload",
  "productionReviewerGovernancePayload",
  "productionReviewerEvidencePayload",
  "productionReviewerAssignmentPayload",
  "productionSecondReviewPayload",
  "productionAdjudicationPayload",
  "productionFollowupPayload",
  "productionExceptionPayload",
  "productionRollbackPayload",
  "reviewerMonitoringPayload",
  "reviewerMonitoringEvidencePayload",
  "reviewerExceptionPayload",
  "reviewerExceptionEvidencePayload",
  "reviewerRollbackPayload",
  "reviewerRollbackEvidencePayload",
  "reviewerArchivePayload",
  "reviewerArchiveEvidencePayload",
  "rawProtectedReviewerLog",
  "rawProtectedReviewerEvidenceLog",
  "rawProductionDatasetEvidenceLog",
  "rawProductionReviewerGovernanceLog",
  "rawProductionReviewerEvidenceLog",
  "rawProductionReviewerOpsLog",
  "rawProductionAdjudicationLog",
  "rawProductionFollowupLog",
  "rawProductionExceptionLog",
  "rawProductionRollbackLog",
  "rawClinicOperationLog",
  "rawLongitudinalOperationLog",
  "rawProtectedReviewerLinkageLog",
  "rawOutcomeObservationLog",
  "rawIncidentLinkageLog",
  "rawReviewerMonitoringLog",
  "rawReviewerExceptionLog",
  "rawReviewerAdjudicationLog",
  "rawReviewerFollowupLog",
  "rawReviewerRollbackLog",
  "rawReviewerArchiveLog",
  "adjudicationOpsPayload",
  "followupOpsPayload",
  "reviewerAssignmentPayload",
  "secondReviewPayload",
  "validationDetails",
  "monitoringDetails",
  "driftDetails",
  "followupDetails",
  "outcomeDetails",
  "incidentOutcomeDetails",
  "governanceDetails",
  "exceptionDetails",
  "recurrenceDetails",
  "rollbackDetails",
  "longitudinalOutcomeDetails",
  "longitudinalClinicalValidationDetails",
  "protectedReviewerValidationDetails",
  "protectedReviewerGovernanceDetails",
  "protectedReviewerEvidenceDetails",
  "productionDatasetEvidenceDetails",
  "productionReviewerGovernanceDetails",
  "productionReviewerEvidenceDetails",
  "productionReviewerOpsDetails",
  "clinicOperationDetails",
  "longitudinalFollowupDetails",
  "protectedReviewerLinkageDetails",
  "outcomeObservationDetails",
  "incidentLinkageDetails",
  "reviewerMonitoringDetails",
  "reviewerMonitoringEvidenceDetails",
  "reviewerExceptionDetails",
  "reviewerExceptionEvidenceDetails",
  "reviewerAdjudicationEvidenceDetails",
  "reviewerFollowupEvidenceDetails",
  "reviewerRollbackDetails",
  "reviewerRollbackEvidenceDetails",
  "reviewerArchiveDetails",
  "reviewerArchiveEvidenceDetails",
  "adjudicationOpsDetails",
  "followupOpsDetails",
  "reviewerAssignmentDetails",
  "secondReviewDetails",
  "adjudicationDetails",
  "incidentPayload",
  "incidentDetails",
  "incidentTimeline",
  "photoRef",
  "heatmapRef",
  "modelVersion",
  "accessToken",
  "rawToken",
  "qrToken",
  "sessionId",
  "doctorVersionText",
  "patientSafeText",
  "deviceSerial",
  "serialNumber",
  "rawDeviceId",
  "rawDeviceIdentifier",
  "rawExif",
  "exifJson",
  "gpsLatitude",
  "gpsLongitude",
  "gpsLocation",
  "locationCoordinates",
  "operatorName",
  "patientName",
  "rawCapturePayload",
  "firmwareSerial",
  "macAddress",
  "ipAddress",
  "bluetoothAddress",
  "wifiSsid",
  "credential",
  "deviceCredential",
  "patientDeliveryAllowed",
  "protectedFieldsExposed",
  "measurementValue",
  "diameterMm",
  "areaMm2",
  "clinicalMeasurement",
  "diagnosis",
  "riskScore",
  "riskLevel",
  "prognosis",
  "treatment",
  "melanomaProbability",
  "dynamicConclusion",
  "clinicalDynamicConclusion",
  "lesionGrowth",
  "patientDeliveryPayload",
  "reviewerName",
  "reviewerEmail",
  "validatorName",
  "validatorEmail",
  "assignedReviewerName",
  "assignedReviewerEmail",
  "secondReviewerName",
  "secondReviewerEmail",
]);

function extensionForContentType(contentType) {
  const text = String(contentType || "").toLowerCase();
  if (text.includes("png")) return "png";
  if (text.includes("webp")) return "webp";
  if (text.includes("heic")) return "heic";
  if (text.includes("heif")) return "heif";
  if (text.includes("jpeg") || text.includes("jpg")) return "jpg";
  return "bin";
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function cleanText(value) {
  if (value == null) return null;
  const text = String(value).replace(/\r\n/g, "\n").trim();
  return text || null;
}

function cleanString(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text || null;
}

function changedFields(payload) {
  return Object.keys(payload).filter((key) => payload[key] !== undefined);
}

function normalizeClinicalStatus(input, details) {
  const status = cleanString(input);
  if (!status || !CLINICAL_STATUS_VALUES.has(status)) {
    details.push({ field: "status", message: "status must be draft, ready, or signed." });
    return undefined;
  }
  return status;
}

function normalizeNumber(input, field, details, { integer = false, min = 0, max = 100 } = {}) {
  if (input == null || input === "") return null;
  const value = Number(input);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    details.push({ field, message: `${field} must be a ${integer ? "whole " : ""}number between ${min} and ${max}.` });
    return undefined;
  }
  return integer ? value : Number(value.toFixed(2));
}

function normalizeLongField(input, field, details) {
  const value = cleanText(input);
  if (value && value.length > MAX_TEXT) {
    details.push({ field, message: `${field} is too long.` });
    return undefined;
  }
  return value;
}

function requireObject(input) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
}

function containsProtectedKey(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsProtectedKey);
  return Object.entries(value).some(([key, nested]) => PROTECTED_INPUT_KEYS.has(key) || containsProtectedKey(nested));
}

function normalizeSafeIdentifier(input, field, details) {
  const value = cleanString(input);
  if (!value || !SAFE_IDENTIFIER_PATTERN.test(value)) {
    details.push({ field, message: `${field} must be a safe metadata identifier.` });
    return undefined;
  }
  return value;
}

function normalizeComparisonReasons(input, details) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    details.push({ field: "reasons", message: "reasons must be an array." });
    return undefined;
  }
  const reasons = [];
  for (const reason of input.slice(0, 8)) {
    const text = cleanString(reason);
    if (!text) continue;
    if (text.length > MAX_REASON_TEXT || UNSAFE_CLINICAL_REASON_PATTERN.test(text)) {
      details.push({
        field: "reasons",
        message: "reasons must stay technical and avoid diagnosis, risk, prognosis, or treatment wording.",
      });
      return undefined;
    }
    reasons.push(text);
  }
  return reasons;
}

function normalizeUuidOrNull(input, field, details) {
  const value = cleanString(input);
  if (!value) return null;
  if (!UUID_PATTERN.test(value)) {
    details.push({ field, message: `${field} must be a UUID.` });
    return undefined;
  }
  return value;
}

function normalizeIntegerField(input, field, details, { min = 1, max = 20000 } = {}) {
  if (input == null || input === "") return null;
  const value = Number(input);
  if (!Number.isInteger(value) || value < min || value > max) {
    details.push({ field, message: `${field} must be a whole number between ${min} and ${max}.` });
    return undefined;
  }
  return value;
}

function normalizeBoundedInteger(input, fallback, { min = 1, max = 100 } = {}) {
  const value = Number(input);
  if (!Number.isInteger(value) || value < min) return fallback;
  return Math.min(value, max);
}

function normalizePercent(input, field, details) {
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    details.push({ field, message: `${field} must be a number between 0 and 100.` });
    return undefined;
  }
  return Number(value.toFixed(2));
}

function normalizeTechnicalStrings(input, field, details, { maxItems = 8 } = {}) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    details.push({ field, message: `${field} must be an array.` });
    return undefined;
  }
  const items = [];
  for (const item of input.slice(0, maxItems)) {
    const text = cleanString(item);
    if (!text) continue;
    if (text.length > MAX_REASON_TEXT || UNSAFE_CLINICAL_REASON_PATTERN.test(text)) {
      details.push({ field, message: `${field} must stay technical and avoid clinical claims.` });
      return undefined;
    }
    items.push(text);
  }
  return items;
}

function normalizeEnumField(input, field, values, fallback, details) {
  const value = cleanString(input) || fallback;
  if (!values.has(value)) {
    details.push({ field, message: `${field} is not supported.` });
    return undefined;
  }
  return value;
}

function deriveDeviceEvidenceStatus({
  deviceId,
  deviceCaptureProfile,
  lightingProfile,
  focusProfile,
  distanceProfile,
  deviceCalibrationStatus,
}) {
  if (!deviceId) return "missing";
  if (
    deviceCaptureProfile !== "unknown"
    && lightingProfile !== "unknown"
    && focusProfile !== "unknown"
    && distanceProfile !== "unknown"
    && deviceCalibrationStatus === "valid"
  ) {
    return "ready";
  }
  return "needs_review";
}

function deriveCaptureProtocolStatus({
  captureProtocolVersion,
  lensProfile,
  polarizationMode,
  colorReferenceStatus,
  deviceClockSyncStatus,
}) {
  const allUnknown = [
    captureProtocolVersion,
    lensProfile,
    polarizationMode,
    colorReferenceStatus,
    deviceClockSyncStatus,
  ].every((value) => value === "unknown");
  if (allUnknown) return "missing";
  if (
    captureProtocolVersion !== "unknown"
    && lensProfile !== "unknown"
    && polarizationMode !== "unknown"
    && (colorReferenceStatus === "captured" || colorReferenceStatus === "not_required")
    && deviceClockSyncStatus === "synced"
  ) {
    return "ready";
  }
  return "needs_review";
}

export function normalizeAssetCaptureMetadataPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in capture metadata payloads." });
  }
  const captureSource = cleanString(input.captureSource) || "unknown";
  if (!CAPTURE_SOURCE_VALUES.has(captureSource)) {
    details.push({ field: "captureSource", message: "captureSource is not supported." });
  }
  const deviceId = normalizeUuidOrNull(input.deviceId, "deviceId", details);
  const frameWidth = normalizeIntegerField(input.frameWidth, "frameWidth", details);
  const frameHeight = normalizeIntegerField(input.frameHeight, "frameHeight", details);
  const qualityScore = normalizeNumber(input.qualityScore, "qualityScore", details, { min: 0, max: 100 });
  const qualityIssues = normalizeTechnicalStrings(input.qualityIssues, "qualityIssues", details);
  const scaleMarkerDetected = input.scaleMarkerDetected === true;
  const millimetersAvailable = input.millimetersAvailable === true;
  const deviceCaptureProfile = normalizeEnumField(
    input.deviceCaptureProfile,
    "deviceCaptureProfile",
    DEVICE_CAPTURE_PROFILE_VALUES,
    "unknown",
    details,
  );
  const lightingProfile = normalizeEnumField(
    input.lightingProfile,
    "lightingProfile",
    LIGHTING_PROFILE_VALUES,
    "unknown",
    details,
  );
  const focusProfile = normalizeEnumField(input.focusProfile, "focusProfile", FOCUS_PROFILE_VALUES, "unknown", details);
  const distanceProfile = normalizeEnumField(
    input.distanceProfile,
    "distanceProfile",
    DISTANCE_PROFILE_VALUES,
    "unknown",
    details,
  );
  const deviceCalibrationStatus = normalizeEnumField(
    input.deviceCalibrationStatus,
    "deviceCalibrationStatus",
    DEVICE_CALIBRATION_STATUS_VALUES,
    "unknown",
    details,
  );
  const deviceCalibrationCheckedAt = cleanString(input.deviceCalibrationCheckedAt);
  if (deviceCalibrationCheckedAt && Number.isNaN(Date.parse(deviceCalibrationCheckedAt))) {
    details.push({ field: "deviceCalibrationCheckedAt", message: "deviceCalibrationCheckedAt must be an ISO timestamp." });
  }
  const captureProtocolVersion = normalizeEnumField(
    input.captureProtocolVersion,
    "captureProtocolVersion",
    CAPTURE_PROTOCOL_VERSION_VALUES,
    "unknown",
    details,
  );
  const lensProfile = normalizeEnumField(input.lensProfile, "lensProfile", LENS_PROFILE_VALUES, "unknown", details);
  const polarizationMode = normalizeEnumField(
    input.polarizationMode,
    "polarizationMode",
    POLARIZATION_MODE_VALUES,
    "unknown",
    details,
  );
  const colorReferenceStatus = normalizeEnumField(
    input.colorReferenceStatus,
    "colorReferenceStatus",
    COLOR_REFERENCE_STATUS_VALUES,
    "unknown",
    details,
  );
  const deviceClockSyncStatus = normalizeEnumField(
    input.deviceClockSyncStatus,
    "deviceClockSyncStatus",
    DEVICE_CLOCK_SYNC_STATUS_VALUES,
    "unknown",
    details,
  );
  if (millimetersAvailable && !scaleMarkerDetected) {
    details.push({ field: "millimetersAvailable", message: "millimetersAvailable requires scaleMarkerDetected." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  const deviceEvidenceStatus = deriveDeviceEvidenceStatus({
    deviceId,
    deviceCaptureProfile,
    lightingProfile,
    focusProfile,
    distanceProfile,
    deviceCalibrationStatus,
  });
  const captureProtocolStatus = deriveCaptureProtocolStatus({
    captureProtocolVersion,
    lensProfile,
    polarizationMode,
    colorReferenceStatus,
    deviceClockSyncStatus,
  });
  return {
    captureSource,
    deviceId,
    frameWidth,
    frameHeight,
    qualityScore,
    qualityIssues: qualityIssues ?? [],
    scaleMarkerDetected,
    millimetersAvailable,
    deviceCaptureProfile,
    lightingProfile,
    focusProfile,
    distanceProfile,
    deviceCalibrationStatus,
    deviceCalibrationCheckedAt: deviceCalibrationCheckedAt || null,
    deviceEvidenceStatus,
    captureProtocolVersion,
    lensProfile,
    polarizationMode,
    colorReferenceStatus,
    deviceClockSyncStatus,
    captureProtocolStatus,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}

function normalizeTechnicalMarkers(input, details) {
  if (input == null) return [];
  if (!Array.isArray(input)) {
    details.push({ field: "technicalMarkers", message: "technicalMarkers must be an array." });
    return undefined;
  }
  const markers = [];
  const seen = new Set();
  for (const marker of input.slice(0, 2)) {
    if (!isPlainObject(marker)) {
      details.push({ field: "technicalMarkers", message: "Each marker must be an object." });
      return undefined;
    }
    const target = marker.target === "A" || marker.target === "B" ? marker.target : null;
    if (!target || seen.has(target)) {
      details.push({ field: "technicalMarkers", message: "Markers must target A and/or B once." });
      return undefined;
    }
    const xPercent = normalizePercent(marker.xPercent, "technicalMarkers.xPercent", details);
    const yPercent = normalizePercent(marker.yPercent, "technicalMarkers.yPercent", details);
    if (xPercent === undefined || yPercent === undefined) return undefined;
    seen.add(target);
    markers.push({ target, xPercent, yPercent });
  }
  return markers;
}

export function normalizeLesionComparisonViewerQaPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in viewer QA payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const technicalMarkers = normalizeTechnicalMarkers(input.technicalMarkers, details);
  const calibrationStatus = cleanString(input.calibrationStatus) || "not_ready";
  if (!CALIBRATION_STATUS_VALUES.has(calibrationStatus)) {
    details.push({ field: "calibrationStatus", message: "calibrationStatus is not supported." });
  }
  const calibrationReasons = normalizeTechnicalStrings(input.calibrationReasons, "calibrationReasons", details);
  const captureMetadataStatus = cleanString(input.captureMetadataStatus) || "needs_review";
  if (!CAPTURE_METADATA_STATUS_VALUES.has(captureMetadataStatus)) {
    details.push({ field: "captureMetadataStatus", message: "captureMetadataStatus is not supported." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    technicalMarkers: technicalMarkers ?? [],
    calibrationStatus,
    calibrationReasons: calibrationReasons ?? [],
    captureMetadataStatus,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}

export function normalizeLesionComparisonViewerQaReviewPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in viewer QA review payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const reviewStatus = cleanString(input.reviewStatus);
  if (!reviewStatus || !VIEWER_QA_REVIEW_STATUS_VALUES.has(reviewStatus)) {
    details.push({
      field: "reviewStatus",
      message: "reviewStatus must be technical_ready, needs_recapture, or not_suitable_for_comparison.",
    });
  }
  const reviewReasons = normalizeTechnicalStrings(input.reviewReasons, "reviewReasons", details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    reviewStatus,
    reviewReasons: reviewReasons ?? [],
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}

export function normalizeLesionComparisonViewerQaReviewerWorkflowPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in reviewer workflow payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const workflowStatus = cleanString(input.workflowStatus);
  if (!workflowStatus || !VIEWER_QA_REVIEWER_WORKFLOW_STATUS_VALUES.has(workflowStatus)) {
    details.push({
      field: "workflowStatus",
      message: "workflowStatus must be ready_for_reviewer, reviewer_accepted, or reviewer_rejected.",
    });
  }
  const workflowReasons = normalizeTechnicalStrings(input.workflowReasons, "workflowReasons", details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    workflowStatus,
    workflowReasons: workflowReasons ?? [],
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}

export function normalizeLesionComparisonMeasurementPolicyPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in measurement policy payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const measurementPolicyStatus = cleanString(input.measurementPolicyStatus);
  if (!measurementPolicyStatus || !VIEWER_QA_MEASUREMENT_POLICY_STATUS_VALUES.has(measurementPolicyStatus)) {
    details.push({
      field: "measurementPolicyStatus",
      message: "measurementPolicyStatus must be not_approved, review_required, or approved_for_technical_review.",
    });
  }
  const measurementPolicyReasons = normalizeTechnicalStrings(
    input.measurementPolicyReasons,
    "measurementPolicyReasons",
    details,
  );
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    measurementPolicyStatus,
    measurementPolicyReasons: measurementPolicyReasons ?? [],
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeLesionComparisonProductionAnalysisPolicyPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in production analysis policy payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const productionAnalysisPolicyStatus = cleanString(input.productionAnalysisPolicyStatus);
  if (
    !productionAnalysisPolicyStatus
    || !VIEWER_QA_PRODUCTION_ANALYSIS_POLICY_STATUS_VALUES.has(productionAnalysisPolicyStatus)
  ) {
    details.push({
      field: "productionAnalysisPolicyStatus",
      message:
        "productionAnalysisPolicyStatus must be not_approved, review_required, or approved_for_production_analysis.",
    });
  }
  const productionAnalysisPolicyReasons = normalizeTechnicalStrings(
    input.productionAnalysisPolicyReasons,
    "productionAnalysisPolicyReasons",
    details,
  );
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    productionAnalysisPolicyStatus,
    productionAnalysisPolicyReasons: productionAnalysisPolicyReasons ?? [],
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in timeline rollout payloads." });
  }
  const rolloutStatus = cleanString(input.rolloutStatus);
  if (!rolloutStatus || !TIMELINE_ROLLOUT_STATUS_VALUES.has(rolloutStatus)) {
    details.push({
      field: "rolloutStatus",
      message: "rolloutStatus must be not_approved, review_required, or approved_for_clinical_operations.",
    });
  }
  const rolloutReasons = normalizeTechnicalStrings(input.rolloutReasons, "rolloutReasons", details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    rolloutStatus,
    rolloutReasons: rolloutReasons ?? [],
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutSopPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in timeline rollout SOP payloads." });
  }
  const sopStatus = cleanString(input.sopStatus);
  if (!sopStatus || !TIMELINE_ROLLOUT_SOP_STATUS_VALUES.has(sopStatus)) {
    details.push({
      field: "sopStatus",
      message: "sopStatus must be not_started, in_review, or ready_for_operational_rollout.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const sopReasons = normalizeTechnicalStrings(input.sopReasons, "sopReasons", details);
  const datasetValidationStatus = checklistStatus("datasetValidationStatus");
  const reviewerOperationsStatus = checklistStatus("reviewerOperationsStatus");
  const rollbackPlanStatus = checklistStatus("rollbackPlanStatus");
  const monitoringPlanStatus = checklistStatus("monitoringPlanStatus");
  const rolloutWindowStatus = checklistStatus("rolloutWindowStatus");
  const ownerAckStatus = checklistStatus("ownerAckStatus");
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    sopStatus,
    sopReasons: sopReasons ?? [],
    datasetValidationStatus,
    reviewerOperationsStatus,
    rollbackPlanStatus,
    monitoringPlanStatus,
    rolloutWindowStatus,
    ownerAckStatus,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutEvidencePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in timeline rollout evidence payloads." });
  }
  const evidenceStatus = cleanString(input.evidenceStatus);
  if (!evidenceStatus || !TIMELINE_ROLLOUT_EVIDENCE_STATUS_VALUES.has(evidenceStatus)) {
    details.push({
      field: "evidenceStatus",
      message: "evidenceStatus must be not_started, in_review, or ready_for_monitored_rollout.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const evidenceReasons = normalizeTechnicalStrings(input.evidenceReasons, "evidenceReasons", details);
  const monitoringEvidenceStatus = checklistStatus("monitoringEvidenceStatus");
  const sampleAuditStatus = checklistStatus("sampleAuditStatus");
  const exceptionLogStatus = checklistStatus("exceptionLogStatus");
  const rollbackDrillStatus = checklistStatus("rollbackDrillStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const monitoringWindowDays = count("monitoringWindowDays", 365);
  const sampledTimelineCount = count("sampledTimelineCount", 20000);
  const exceptionCount = count("exceptionCount", 20000);
  const rollbackDrillCount = count("rollbackDrillCount", 20000);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    evidenceStatus,
    evidenceReasons: evidenceReasons ?? [],
    monitoringEvidenceStatus,
    sampleAuditStatus,
    exceptionLogStatus,
    rollbackDrillStatus,
    ownerSignoffStatus,
    monitoringWindowDays,
    sampledTimelineCount,
    exceptionCount,
    rollbackDrillCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutMonitoringPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in timeline rollout monitoring payloads." });
  }
  const monitoringStatus = cleanString(input.monitoringStatus);
  if (!monitoringStatus || !TIMELINE_ROLLOUT_MONITORING_STATUS_VALUES.has(monitoringStatus)) {
    details.push({
      field: "monitoringStatus",
      message: "monitoringStatus must be not_started, in_review, or ready_for_production_rollout.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const monitoringReasons = normalizeTechnicalStrings(input.monitoringReasons, "monitoringReasons", details);
  const outcomeSamplingStatus = checklistStatus("outcomeSamplingStatus");
  const incidentReviewStatus = checklistStatus("incidentReviewStatus");
  const exceptionClosureStatus = checklistStatus("exceptionClosureStatus");
  const rollbackOutcomeStatus = checklistStatus("rollbackOutcomeStatus");
  const ownerFinalReviewStatus = checklistStatus("ownerFinalReviewStatus");
  const monitoringWindowDays = count("monitoringWindowDays", 365);
  const monitoredTimelineCount = count("monitoredTimelineCount", 20000);
  const sampledTimelineCount = count("sampledTimelineCount", 20000);
  const incidentCount = count("incidentCount", 20000);
  const unresolvedIncidentCount = count("unresolvedIncidentCount", 20000);
  const closedExceptionCount = count("closedExceptionCount", 20000);
  const rollbackExecutionCount = count("rollbackExecutionCount", 20000);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    monitoringStatus,
    monitoringReasons: monitoringReasons ?? [],
    outcomeSamplingStatus,
    incidentReviewStatus,
    exceptionClosureStatus,
    rollbackOutcomeStatus,
    ownerFinalReviewStatus,
    monitoringWindowDays,
    monitoredTimelineCount,
    sampledTimelineCount,
    incidentCount,
    unresolvedIncidentCount,
    closedExceptionCount,
    rollbackExecutionCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in incident procedure payloads." });
  }
  const procedureStatus = cleanString(input.procedureStatus);
  if (!procedureStatus || !TIMELINE_ROLLOUT_INCIDENT_PROCEDURE_STATUS_VALUES.has(procedureStatus)) {
    details.push({
      field: "procedureStatus",
      message: "procedureStatus must be not_started, in_review, or ready_for_clinic_monitoring.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const procedureReasons = normalizeTechnicalStrings(input.procedureReasons, "procedureReasons", details);
  const realDatasetStatus = checklistStatus("realDatasetStatus");
  const outcomeSamplingProcedureStatus = checklistStatus("outcomeSamplingProcedureStatus");
  const incidentTriageStatus = checklistStatus("incidentTriageStatus");
  const escalationPathStatus = checklistStatus("escalationPathStatus");
  const rollbackDecisionStatus = checklistStatus("rollbackDecisionStatus");
  const ownerReviewStatus = checklistStatus("ownerReviewStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const monitoredTimelineCount = count("monitoredTimelineCount", 20000);
  const sampledOutcomeCount = count("sampledOutcomeCount", 20000);
  const incidentCaseCount = count("incidentCaseCount", 20000);
  const unresolvedIncidentCount = count("unresolvedIncidentCount", 20000);
  const escalatedIncidentCount = count("escalatedIncidentCount", 20000);
  const rollbackDecisionCount = count("rollbackDecisionCount", 20000);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    procedureStatus,
    procedureReasons: procedureReasons ?? [],
    realDatasetStatus,
    outcomeSamplingProcedureStatus,
    incidentTriageStatus,
    escalationPathStatus,
    rollbackDecisionStatus,
    ownerReviewStatus,
    realDatasetTimelineCount,
    monitoredTimelineCount,
    sampledOutcomeCount,
    incidentCaseCount,
    unresolvedIncidentCount,
    escalatedIncidentCount,
    rollbackDecisionCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in clinical validation payloads." });
  }
  const clinicalValidationStatus = cleanString(input.clinicalValidationStatus);
  if (
    !clinicalValidationStatus
    || !TIMELINE_ROLLOUT_CLINICAL_VALIDATION_STATUS_VALUES.has(clinicalValidationStatus)
  ) {
    details.push({
      field: "clinicalValidationStatus",
      message: "clinicalValidationStatus must be not_started, in_review, or ready_for_clinical_validation.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const clinicalValidationReasons = normalizeTechnicalStrings(
    input.clinicalValidationReasons,
    "clinicalValidationReasons",
    details,
  );
  const realDatasetLockStatus = checklistStatus("realDatasetLockStatus");
  const validatorTrainingStatus = checklistStatus("validatorTrainingStatus");
  const blindedSampleStatus = checklistStatus("blindedSampleStatus");
  const adjudicationStatus = checklistStatus("adjudicationStatus");
  const decisionLogStatus = checklistStatus("decisionLogStatus");
  const ownerAcceptanceStatus = checklistStatus("ownerAcceptanceStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const validationSampleCount = count("validationSampleCount", 20000);
  const disagreementCaseCount = count("disagreementCaseCount", 20000);
  const adjudicatedCaseCount = count("adjudicatedCaseCount", 20000);
  const followupWindowDays = count("followupWindowDays", 3650);
  const blockerCount = count("blockerCount", 20000);
  if (adjudicatedCaseCount < disagreementCaseCount) {
    details.push({
      field: "adjudicatedCaseCount",
      message: "adjudicatedCaseCount must be greater than or equal to disagreementCaseCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    clinicalValidationStatus,
    clinicalValidationReasons: clinicalValidationReasons ?? [],
    realDatasetLockStatus,
    validatorTrainingStatus,
    blindedSampleStatus,
    adjudicationStatus,
    decisionLogStatus,
    ownerAcceptanceStatus,
    realDatasetTimelineCount,
    validationSampleCount,
    disagreementCaseCount,
    adjudicatedCaseCount,
    followupWindowDays,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in post-validation monitoring payloads." });
  }
  const postValidationMonitoringStatus = cleanString(input.postValidationMonitoringStatus);
  if (
    !postValidationMonitoringStatus
    || !TIMELINE_ROLLOUT_POST_VALIDATION_MONITORING_STATUS_VALUES.has(postValidationMonitoringStatus)
  ) {
    details.push({
      field: "postValidationMonitoringStatus",
      message: "postValidationMonitoringStatus must be not_started, in_review, or ready_for_post_validation_monitoring.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const postValidationMonitoringReasons = normalizeTechnicalStrings(
    input.postValidationMonitoringReasons,
    "postValidationMonitoringReasons",
    details,
  );
  const monitoringWindowStatus = checklistStatus("monitoringWindowStatus");
  const outcomeReviewStatus = checklistStatus("outcomeReviewStatus");
  const driftReviewStatus = checklistStatus("driftReviewStatus");
  const incidentFollowupStatus = checklistStatus("incidentFollowupStatus");
  const validatorRecheckStatus = checklistStatus("validatorRecheckStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const clinicalValidationSampleCount = count("clinicalValidationSampleCount", 20000);
  const monitoredTimelineCount = count("monitoredTimelineCount", 20000);
  const sampledOutcomeCount = count("sampledOutcomeCount", 20000);
  const driftSignalCount = count("driftSignalCount", 20000);
  const unresolvedDriftSignalCount = count("unresolvedDriftSignalCount", 20000);
  const incidentFollowupCount = count("incidentFollowupCount", 20000);
  const unresolvedIncidentFollowupCount = count("unresolvedIncidentFollowupCount", 20000);
  const validatorRecheckCount = count("validatorRecheckCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (unresolvedDriftSignalCount > driftSignalCount) {
    details.push({
      field: "unresolvedDriftSignalCount",
      message: "unresolvedDriftSignalCount must be less than or equal to driftSignalCount.",
    });
  }
  if (unresolvedIncidentFollowupCount > incidentFollowupCount) {
    details.push({
      field: "unresolvedIncidentFollowupCount",
      message: "unresolvedIncidentFollowupCount must be less than or equal to incidentFollowupCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    postValidationMonitoringStatus,
    postValidationMonitoringReasons: postValidationMonitoringReasons ?? [],
    monitoringWindowStatus,
    outcomeReviewStatus,
    driftReviewStatus,
    incidentFollowupStatus,
    validatorRecheckStatus,
    ownerSignoffStatus,
    realDatasetTimelineCount,
    clinicalValidationSampleCount,
    monitoredTimelineCount,
    sampledOutcomeCount,
    driftSignalCount,
    unresolvedDriftSignalCount,
    incidentFollowupCount,
    unresolvedIncidentFollowupCount,
    validatorRecheckCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in observation governance payloads." });
  }
  const observationGovernanceStatus = cleanString(input.observationGovernanceStatus);
  if (
    !observationGovernanceStatus
    || !TIMELINE_ROLLOUT_OBSERVATION_GOVERNANCE_STATUS_VALUES.has(observationGovernanceStatus)
  ) {
    details.push({
      field: "observationGovernanceStatus",
      message: "observationGovernanceStatus must be not_started, in_review, or ready_for_observation_governance.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const observationGovernanceReasons = normalizeTechnicalStrings(
    input.observationGovernanceReasons,
    "observationGovernanceReasons",
    details,
  );
  const observationWindowStatus = checklistStatus("observationWindowStatus");
  const outcomeObservationStatus = checklistStatus("outcomeObservationStatus");
  const driftSignalReviewStatus = checklistStatus("driftSignalReviewStatus");
  const incidentOutcomeReviewStatus = checklistStatus("incidentOutcomeReviewStatus");
  const followupClosureStatus = checklistStatus("followupClosureStatus");
  const governanceReviewStatus = checklistStatus("governanceReviewStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const postValidationSampleCount = count("postValidationSampleCount", 20000);
  const observedTimelineCount = count("observedTimelineCount", 20000);
  const expectedFollowupCount = count("expectedFollowupCount", 20000);
  const completedFollowupCount = count("completedFollowupCount", 20000);
  const driftSignalCount = count("driftSignalCount", 20000);
  const unresolvedDriftSignalCount = count("unresolvedDriftSignalCount", 20000);
  const incidentOutcomeCount = count("incidentOutcomeCount", 20000);
  const unresolvedIncidentOutcomeCount = count("unresolvedIncidentOutcomeCount", 20000);
  const governanceExceptionCount = count("governanceExceptionCount", 20000);
  const unresolvedGovernanceExceptionCount = count("unresolvedGovernanceExceptionCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (completedFollowupCount > expectedFollowupCount) {
    details.push({
      field: "completedFollowupCount",
      message: "completedFollowupCount must be less than or equal to expectedFollowupCount.",
    });
  }
  if (unresolvedDriftSignalCount > driftSignalCount) {
    details.push({
      field: "unresolvedDriftSignalCount",
      message: "unresolvedDriftSignalCount must be less than or equal to driftSignalCount.",
    });
  }
  if (unresolvedIncidentOutcomeCount > incidentOutcomeCount) {
    details.push({
      field: "unresolvedIncidentOutcomeCount",
      message: "unresolvedIncidentOutcomeCount must be less than or equal to incidentOutcomeCount.",
    });
  }
  if (unresolvedGovernanceExceptionCount > governanceExceptionCount) {
    details.push({
      field: "unresolvedGovernanceExceptionCount",
      message: "unresolvedGovernanceExceptionCount must be less than or equal to governanceExceptionCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    observationGovernanceStatus,
    observationGovernanceReasons: observationGovernanceReasons ?? [],
    observationWindowStatus,
    outcomeObservationStatus,
    driftSignalReviewStatus,
    incidentOutcomeReviewStatus,
    followupClosureStatus,
    governanceReviewStatus,
    ownerSignoffStatus,
    realDatasetTimelineCount,
    postValidationSampleCount,
    observedTimelineCount,
    expectedFollowupCount,
    completedFollowupCount,
    driftSignalCount,
    unresolvedDriftSignalCount,
    incidentOutcomeCount,
    unresolvedIncidentOutcomeCount,
    governanceExceptionCount,
    unresolvedGovernanceExceptionCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in exception governance payloads." });
  }
  const exceptionGovernanceStatus = cleanString(input.exceptionGovernanceStatus);
  if (
    !exceptionGovernanceStatus
    || !TIMELINE_ROLLOUT_EXCEPTION_GOVERNANCE_STATUS_VALUES.has(exceptionGovernanceStatus)
  ) {
    details.push({
      field: "exceptionGovernanceStatus",
      message: "exceptionGovernanceStatus must be not_started, in_review, or ready_for_exception_governance.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const exceptionGovernanceReasons = normalizeTechnicalStrings(
    input.exceptionGovernanceReasons,
    "exceptionGovernanceReasons",
    details,
  );
  const exceptionRegisterStatus = checklistStatus("exceptionRegisterStatus");
  const triageSlaStatus = checklistStatus("triageSlaStatus");
  const resolutionEvidenceStatus = checklistStatus("resolutionEvidenceStatus");
  const recurrenceReviewStatus = checklistStatus("recurrenceReviewStatus");
  const rollbackReadinessStatus = checklistStatus("rollbackReadinessStatus");
  const governanceArchiveStatus = checklistStatus("governanceArchiveStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const observedTimelineCount = count("observedTimelineCount", 20000);
  const governanceExceptionCount = count("governanceExceptionCount", 20000);
  const resolvedGovernanceExceptionCount = count("resolvedGovernanceExceptionCount", 20000);
  const unresolvedGovernanceExceptionCount = count("unresolvedGovernanceExceptionCount", 20000);
  const recurrenceSignalCount = count("recurrenceSignalCount", 20000);
  const unresolvedRecurrenceSignalCount = count("unresolvedRecurrenceSignalCount", 20000);
  const rollbackDrillCount = count("rollbackDrillCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (resolvedGovernanceExceptionCount > governanceExceptionCount) {
    details.push({
      field: "resolvedGovernanceExceptionCount",
      message: "resolvedGovernanceExceptionCount must be less than or equal to governanceExceptionCount.",
    });
  }
  if (unresolvedGovernanceExceptionCount > governanceExceptionCount) {
    details.push({
      field: "unresolvedGovernanceExceptionCount",
      message: "unresolvedGovernanceExceptionCount must be less than or equal to governanceExceptionCount.",
    });
  }
  if (unresolvedRecurrenceSignalCount > recurrenceSignalCount) {
    details.push({
      field: "unresolvedRecurrenceSignalCount",
      message: "unresolvedRecurrenceSignalCount must be less than or equal to recurrenceSignalCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    exceptionGovernanceStatus,
    exceptionGovernanceReasons: exceptionGovernanceReasons ?? [],
    exceptionRegisterStatus,
    triageSlaStatus,
    resolutionEvidenceStatus,
    recurrenceReviewStatus,
    rollbackReadinessStatus,
    governanceArchiveStatus,
    ownerSignoffStatus,
    realDatasetTimelineCount,
    observedTimelineCount,
    governanceExceptionCount,
    resolvedGovernanceExceptionCount,
    unresolvedGovernanceExceptionCount,
    recurrenceSignalCount,
    unresolvedRecurrenceSignalCount,
    rollbackDrillCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in outcome governance payloads." });
  }
  const outcomeGovernanceStatus = cleanString(input.outcomeGovernanceStatus);
  if (
    !outcomeGovernanceStatus
    || !TIMELINE_ROLLOUT_OUTCOME_GOVERNANCE_STATUS_VALUES.has(outcomeGovernanceStatus)
  ) {
    details.push({
      field: "outcomeGovernanceStatus",
      message: "outcomeGovernanceStatus must be not_started, in_review, or ready_for_outcome_governance.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const outcomeGovernanceReasons = normalizeTechnicalStrings(
    input.outcomeGovernanceReasons,
    "outcomeGovernanceReasons",
    details,
  );
  const longitudinalWindowStatus = checklistStatus("longitudinalWindowStatus");
  const realDatasetCoverageStatus = checklistStatus("realDatasetCoverageStatus");
  const reviewerOperationsValidationStatus = checklistStatus("reviewerOperationsValidationStatus");
  const exceptionTrendReviewStatus = checklistStatus("exceptionTrendReviewStatus");
  const followupCadenceStatus = checklistStatus("followupCadenceStatus");
  const governanceCadenceStatus = checklistStatus("governanceCadenceStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realDatasetTimelineCount = count("realDatasetTimelineCount", 20000);
  const observedTimelineCount = count("observedTimelineCount", 20000);
  const followupWindowCount = count("followupWindowCount", 20000);
  const completedFollowupCount = count("completedFollowupCount", 20000);
  const governanceExceptionCount = count("governanceExceptionCount", 20000);
  const unresolvedGovernanceExceptionCount = count("unresolvedGovernanceExceptionCount", 20000);
  const recurrenceSignalCount = count("recurrenceSignalCount", 20000);
  const unresolvedRecurrenceSignalCount = count("unresolvedRecurrenceSignalCount", 20000);
  const governanceReviewCount = count("governanceReviewCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (completedFollowupCount > followupWindowCount) {
    details.push({
      field: "completedFollowupCount",
      message: "completedFollowupCount must be less than or equal to followupWindowCount.",
    });
  }
  if (unresolvedGovernanceExceptionCount > governanceExceptionCount) {
    details.push({
      field: "unresolvedGovernanceExceptionCount",
      message: "unresolvedGovernanceExceptionCount must be less than or equal to governanceExceptionCount.",
    });
  }
  if (unresolvedRecurrenceSignalCount > recurrenceSignalCount) {
    details.push({
      field: "unresolvedRecurrenceSignalCount",
      message: "unresolvedRecurrenceSignalCount must be less than or equal to recurrenceSignalCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    outcomeGovernanceStatus,
    outcomeGovernanceReasons: outcomeGovernanceReasons ?? [],
    longitudinalWindowStatus,
    realDatasetCoverageStatus,
    reviewerOperationsValidationStatus,
    exceptionTrendReviewStatus,
    followupCadenceStatus,
    governanceCadenceStatus,
    ownerSignoffStatus,
    realDatasetTimelineCount,
    observedTimelineCount,
    followupWindowCount,
    completedFollowupCount,
    governanceExceptionCount,
    unresolvedGovernanceExceptionCount,
    recurrenceSignalCount,
    unresolvedRecurrenceSignalCount,
    governanceReviewCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in longitudinal clinical validation payloads.",
    });
  }
  const longitudinalClinicalValidationStatus = cleanString(input.longitudinalClinicalValidationStatus);
  if (
    !longitudinalClinicalValidationStatus
    || !TIMELINE_ROLLOUT_LONGITUDINAL_CLINICAL_VALIDATION_STATUS_VALUES.has(longitudinalClinicalValidationStatus)
  ) {
    details.push({
      field: "longitudinalClinicalValidationStatus",
      message: "longitudinalClinicalValidationStatus must be not_started, in_review, or ready_for_longitudinal_clinical_validation.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const longitudinalClinicalValidationReasons = normalizeTechnicalStrings(
    input.longitudinalClinicalValidationReasons,
    "longitudinalClinicalValidationReasons",
    details,
  );
  const outcomeWindowStatus = checklistStatus("outcomeWindowStatus");
  const clinicianCoverageStatus = checklistStatus("clinicianCoverageStatus");
  const adjudicationStatus = checklistStatus("adjudicationStatus");
  const consensusReviewStatus = checklistStatus("consensusReviewStatus");
  const followupValidationStatus = checklistStatus("followupValidationStatus");
  const governanceCadenceStatus = checklistStatus("governanceCadenceStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realOutcomeWindowCount = count("realOutcomeWindowCount", 20000);
  const clinicallyValidatedWindowCount = count("clinicallyValidatedWindowCount", 20000);
  const adjudicatedWindowCount = count("adjudicatedWindowCount", 20000);
  const followupValidatedWindowCount = count("followupValidatedWindowCount", 20000);
  const consensusReviewCount = count("consensusReviewCount", 20000);
  const unresolvedConsensusCaseCount = count("unresolvedConsensusCaseCount", 20000);
  const governanceReviewCount = count("governanceReviewCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (clinicallyValidatedWindowCount > realOutcomeWindowCount) {
    details.push({
      field: "clinicallyValidatedWindowCount",
      message: "clinicallyValidatedWindowCount must be less than or equal to realOutcomeWindowCount.",
    });
  }
  if (adjudicatedWindowCount > clinicallyValidatedWindowCount) {
    details.push({
      field: "adjudicatedWindowCount",
      message: "adjudicatedWindowCount must be less than or equal to clinicallyValidatedWindowCount.",
    });
  }
  if (followupValidatedWindowCount > clinicallyValidatedWindowCount) {
    details.push({
      field: "followupValidatedWindowCount",
      message: "followupValidatedWindowCount must be less than or equal to clinicallyValidatedWindowCount.",
    });
  }
  if (unresolvedConsensusCaseCount > consensusReviewCount) {
    details.push({
      field: "unresolvedConsensusCaseCount",
      message: "unresolvedConsensusCaseCount must be less than or equal to consensusReviewCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    longitudinalClinicalValidationStatus,
    longitudinalClinicalValidationReasons: longitudinalClinicalValidationReasons ?? [],
    outcomeWindowStatus,
    clinicianCoverageStatus,
    adjudicationStatus,
    consensusReviewStatus,
    followupValidationStatus,
    governanceCadenceStatus,
    ownerSignoffStatus,
    realOutcomeWindowCount,
    clinicallyValidatedWindowCount,
    adjudicatedWindowCount,
    followupValidatedWindowCount,
    consensusReviewCount,
    unresolvedConsensusCaseCount,
    governanceReviewCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in protected reviewer validation payloads.",
    });
  }
  const protectedReviewerValidationStatus = cleanString(input.protectedReviewerValidationStatus);
  if (
    !protectedReviewerValidationStatus
    || !TIMELINE_ROLLOUT_PROTECTED_REVIEWER_VALIDATION_STATUS_VALUES.has(protectedReviewerValidationStatus)
  ) {
    details.push({
      field: "protectedReviewerValidationStatus",
      message: "protectedReviewerValidationStatus must be not_started, in_review, or ready_for_protected_reviewer_validation.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const protectedReviewerValidationReasons = normalizeTechnicalStrings(
    input.protectedReviewerValidationReasons,
    "protectedReviewerValidationReasons",
    details,
  );
  const protectedAssetWindowStatus = checklistStatus("protectedAssetWindowStatus");
  const protectedRenderStatus = checklistStatus("protectedRenderStatus");
  const reviewerAssignmentStatus = checklistStatus("reviewerAssignmentStatus");
  const secondReviewStatus = checklistStatus("secondReviewStatus");
  const adjudicationOpsStatus = checklistStatus("adjudicationOpsStatus");
  const followupOpsStatus = checklistStatus("followupOpsStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const protectedAssetTimelineCount = count("protectedAssetTimelineCount", 20000);
  const protectedRenderReadyCount = count("protectedRenderReadyCount", 20000);
  const reviewerAssignedProtectedCount = count("reviewerAssignedProtectedCount", 20000);
  const secondReviewedProtectedCount = count("secondReviewedProtectedCount", 20000);
  const adjudicatedProtectedCount = count("adjudicatedProtectedCount", 20000);
  const followupValidatedProtectedCount = count("followupValidatedProtectedCount", 20000);
  const unresolvedProtectedReviewCount = count("unresolvedProtectedReviewCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (protectedRenderReadyCount > protectedAssetTimelineCount) {
    details.push({
      field: "protectedRenderReadyCount",
      message: "protectedRenderReadyCount must be less than or equal to protectedAssetTimelineCount.",
    });
  }
  if (reviewerAssignedProtectedCount > protectedAssetTimelineCount) {
    details.push({
      field: "reviewerAssignedProtectedCount",
      message: "reviewerAssignedProtectedCount must be less than or equal to protectedAssetTimelineCount.",
    });
  }
  if (secondReviewedProtectedCount > reviewerAssignedProtectedCount) {
    details.push({
      field: "secondReviewedProtectedCount",
      message: "secondReviewedProtectedCount must be less than or equal to reviewerAssignedProtectedCount.",
    });
  }
  if (adjudicatedProtectedCount > secondReviewedProtectedCount) {
    details.push({
      field: "adjudicatedProtectedCount",
      message: "adjudicatedProtectedCount must be less than or equal to secondReviewedProtectedCount.",
    });
  }
  if (followupValidatedProtectedCount > adjudicatedProtectedCount) {
    details.push({
      field: "followupValidatedProtectedCount",
      message: "followupValidatedProtectedCount must be less than or equal to adjudicatedProtectedCount.",
    });
  }
  if (unresolvedProtectedReviewCount > reviewerAssignedProtectedCount) {
    details.push({
      field: "unresolvedProtectedReviewCount",
      message: "unresolvedProtectedReviewCount must be less than or equal to reviewerAssignedProtectedCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    protectedReviewerValidationStatus,
    protectedReviewerValidationReasons: protectedReviewerValidationReasons ?? [],
    protectedAssetWindowStatus,
    protectedRenderStatus,
    reviewerAssignmentStatus,
    secondReviewStatus,
    adjudicationOpsStatus,
    followupOpsStatus,
    ownerSignoffStatus,
    protectedAssetTimelineCount,
    protectedRenderReadyCount,
    reviewerAssignedProtectedCount,
    secondReviewedProtectedCount,
    adjudicatedProtectedCount,
    followupValidatedProtectedCount,
    unresolvedProtectedReviewCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in protected reviewer governance payloads.",
    });
  }
  const protectedReviewerGovernanceStatus = cleanString(input.protectedReviewerGovernanceStatus);
  if (
    !protectedReviewerGovernanceStatus
    || !TIMELINE_ROLLOUT_PROTECTED_REVIEWER_GOVERNANCE_STATUS_VALUES.has(protectedReviewerGovernanceStatus)
  ) {
    details.push({
      field: "protectedReviewerGovernanceStatus",
      message: "protectedReviewerGovernanceStatus must be not_started, in_review, or ready_for_protected_reviewer_governance.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const protectedReviewerGovernanceReasons = normalizeTechnicalStrings(
    input.protectedReviewerGovernanceReasons,
    "protectedReviewerGovernanceReasons",
    details,
  );
  const reviewerMonitoringStatus = checklistStatus("reviewerMonitoringStatus");
  const reviewerExceptionStatus = checklistStatus("reviewerExceptionStatus");
  const reviewerAdjudicationStatus = checklistStatus("reviewerAdjudicationStatus");
  const reviewerFollowupStatus = checklistStatus("reviewerFollowupStatus");
  const reviewerRollbackStatus = checklistStatus("reviewerRollbackStatus");
  const reviewerArchiveStatus = checklistStatus("reviewerArchiveStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const protectedReviewWindowCount = count("protectedReviewWindowCount", 20000);
  const monitoredProtectedReviewCount = count("monitoredProtectedReviewCount", 20000);
  const escalatedProtectedReviewCount = count("escalatedProtectedReviewCount", 20000);
  const adjudicatedProtectedGovernanceCount = count("adjudicatedProtectedGovernanceCount", 20000);
  const followupClosedProtectedCount = count("followupClosedProtectedCount", 20000);
  const rollbackReadyProtectedCount = count("rollbackReadyProtectedCount", 20000);
  const archivedProtectedReviewCount = count("archivedProtectedReviewCount", 20000);
  const unresolvedGovernanceReviewCount = count("unresolvedGovernanceReviewCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (monitoredProtectedReviewCount > protectedReviewWindowCount) {
    details.push({
      field: "monitoredProtectedReviewCount",
      message: "monitoredProtectedReviewCount must be less than or equal to protectedReviewWindowCount.",
    });
  }
  if (escalatedProtectedReviewCount > monitoredProtectedReviewCount) {
    details.push({
      field: "escalatedProtectedReviewCount",
      message: "escalatedProtectedReviewCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (adjudicatedProtectedGovernanceCount > escalatedProtectedReviewCount) {
    details.push({
      field: "adjudicatedProtectedGovernanceCount",
      message: "adjudicatedProtectedGovernanceCount must be less than or equal to escalatedProtectedReviewCount.",
    });
  }
  if (followupClosedProtectedCount > adjudicatedProtectedGovernanceCount) {
    details.push({
      field: "followupClosedProtectedCount",
      message: "followupClosedProtectedCount must be less than or equal to adjudicatedProtectedGovernanceCount.",
    });
  }
  if (rollbackReadyProtectedCount > monitoredProtectedReviewCount) {
    details.push({
      field: "rollbackReadyProtectedCount",
      message: "rollbackReadyProtectedCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (archivedProtectedReviewCount > monitoredProtectedReviewCount) {
    details.push({
      field: "archivedProtectedReviewCount",
      message: "archivedProtectedReviewCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (unresolvedGovernanceReviewCount > monitoredProtectedReviewCount) {
    details.push({
      field: "unresolvedGovernanceReviewCount",
      message: "unresolvedGovernanceReviewCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    protectedReviewerGovernanceStatus,
    protectedReviewerGovernanceReasons: protectedReviewerGovernanceReasons ?? [],
    reviewerMonitoringStatus,
    reviewerExceptionStatus,
    reviewerAdjudicationStatus,
    reviewerFollowupStatus,
    reviewerRollbackStatus,
    reviewerArchiveStatus,
    ownerSignoffStatus,
    protectedReviewWindowCount,
    monitoredProtectedReviewCount,
    escalatedProtectedReviewCount,
    adjudicatedProtectedGovernanceCount,
    followupClosedProtectedCount,
    rollbackReadyProtectedCount,
    archivedProtectedReviewCount,
    unresolvedGovernanceReviewCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in protected reviewer evidence payloads.",
    });
  }
  const protectedReviewerEvidenceStatus = cleanString(input.protectedReviewerEvidenceStatus);
  if (
    !protectedReviewerEvidenceStatus
    || !TIMELINE_ROLLOUT_PROTECTED_REVIEWER_EVIDENCE_STATUS_VALUES.has(protectedReviewerEvidenceStatus)
  ) {
    details.push({
      field: "protectedReviewerEvidenceStatus",
      message: "protectedReviewerEvidenceStatus must be not_started, in_review, or ready_for_protected_reviewer_evidence.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const protectedReviewerEvidenceReasons = normalizeTechnicalStrings(
    input.protectedReviewerEvidenceReasons,
    "protectedReviewerEvidenceReasons",
    details,
  );
  const reviewerMonitoringEvidenceStatus = checklistStatus("reviewerMonitoringEvidenceStatus");
  const reviewerExceptionEvidenceStatus = checklistStatus("reviewerExceptionEvidenceStatus");
  const reviewerAdjudicationEvidenceStatus = checklistStatus("reviewerAdjudicationEvidenceStatus");
  const reviewerFollowupEvidenceStatus = checklistStatus("reviewerFollowupEvidenceStatus");
  const reviewerRollbackEvidenceStatus = checklistStatus("reviewerRollbackEvidenceStatus");
  const reviewerArchiveEvidenceStatus = checklistStatus("reviewerArchiveEvidenceStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const protectedReviewWindowCount = count("protectedReviewWindowCount", 20000);
  const monitoredProtectedReviewCount = count("monitoredProtectedReviewCount", 20000);
  const sampledProtectedReviewCount = count("sampledProtectedReviewCount", 20000);
  const adjudicatedProtectedEvidenceCount = count("adjudicatedProtectedEvidenceCount", 20000);
  const followupClosedProtectedCount = count("followupClosedProtectedCount", 20000);
  const rollbackDrillProtectedCount = count("rollbackDrillProtectedCount", 20000);
  const archivedProtectedReviewCount = count("archivedProtectedReviewCount", 20000);
  const unresolvedProtectedEvidenceCount = count("unresolvedProtectedEvidenceCount", 20000);
  const blockerCount = count("blockerCount", 20000);
  if (monitoredProtectedReviewCount > protectedReviewWindowCount) {
    details.push({
      field: "monitoredProtectedReviewCount",
      message: "monitoredProtectedReviewCount must be less than or equal to protectedReviewWindowCount.",
    });
  }
  if (sampledProtectedReviewCount > monitoredProtectedReviewCount) {
    details.push({
      field: "sampledProtectedReviewCount",
      message: "sampledProtectedReviewCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (adjudicatedProtectedEvidenceCount > monitoredProtectedReviewCount) {
    details.push({
      field: "adjudicatedProtectedEvidenceCount",
      message: "adjudicatedProtectedEvidenceCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (followupClosedProtectedCount > adjudicatedProtectedEvidenceCount) {
    details.push({
      field: "followupClosedProtectedCount",
      message: "followupClosedProtectedCount must be less than or equal to adjudicatedProtectedEvidenceCount.",
    });
  }
  if (rollbackDrillProtectedCount > monitoredProtectedReviewCount) {
    details.push({
      field: "rollbackDrillProtectedCount",
      message: "rollbackDrillProtectedCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (archivedProtectedReviewCount > monitoredProtectedReviewCount) {
    details.push({
      field: "archivedProtectedReviewCount",
      message: "archivedProtectedReviewCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (unresolvedProtectedEvidenceCount > monitoredProtectedReviewCount) {
    details.push({
      field: "unresolvedProtectedEvidenceCount",
      message: "unresolvedProtectedEvidenceCount must be less than or equal to monitoredProtectedReviewCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    protectedReviewerEvidenceStatus,
    protectedReviewerEvidenceReasons: protectedReviewerEvidenceReasons ?? [],
    reviewerMonitoringEvidenceStatus,
    reviewerExceptionEvidenceStatus,
    reviewerAdjudicationEvidenceStatus,
    reviewerFollowupEvidenceStatus,
    reviewerRollbackEvidenceStatus,
    reviewerArchiveEvidenceStatus,
    ownerSignoffStatus,
    protectedReviewWindowCount,
    monitoredProtectedReviewCount,
    sampledProtectedReviewCount,
    adjudicatedProtectedEvidenceCount,
    followupClosedProtectedCount,
    rollbackDrillProtectedCount,
    archivedProtectedReviewCount,
    unresolvedProtectedEvidenceCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProductionDatasetEvidencePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in production dataset evidence payloads.",
    });
  }
  const productionDatasetEvidenceStatus = cleanString(input.productionDatasetEvidenceStatus);
  if (
    !productionDatasetEvidenceStatus
    || !TIMELINE_ROLLOUT_PRODUCTION_DATASET_EVIDENCE_STATUS_VALUES.has(productionDatasetEvidenceStatus)
  ) {
    details.push({
      field: "productionDatasetEvidenceStatus",
      message:
        "productionDatasetEvidenceStatus must be not_started, in_review, or ready_for_production_dataset_evidence.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const productionDatasetEvidenceReasons = normalizeTechnicalStrings(
    input.productionDatasetEvidenceReasons,
    "productionDatasetEvidenceReasons",
    details,
  );
  const realClinicWindowStatus = checklistStatus("realClinicWindowStatus");
  const datasetSamplingStatus = checklistStatus("datasetSamplingStatus");
  const longitudinalFollowupStatus = checklistStatus("longitudinalFollowupStatus");
  const protectedReviewerLinkageStatus = checklistStatus("protectedReviewerLinkageStatus");
  const outcomeObservationStatus = checklistStatus("outcomeObservationStatus");
  const incidentLinkageStatus = checklistStatus("incidentLinkageStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const realClinicWindowCount = count("realClinicWindowCount", 30000);
  const monitoredClinicOperationCount = count("monitoredClinicOperationCount", 30000);
  const sampledClinicOperationCount = count("sampledClinicOperationCount", 30000);
  const longitudinalFollowupCount = count("longitudinalFollowupCount", 30000);
  const protectedReviewerLinkedCount = count("protectedReviewerLinkedCount", 30000);
  const observedOutcomeCount = count("observedOutcomeCount", 30000);
  const incidentLinkedCount = count("incidentLinkedCount", 30000);
  const unresolvedProductionDatasetEvidenceCount = count("unresolvedProductionDatasetEvidenceCount", 30000);
  const blockerCount = count("blockerCount", 30000);
  if (monitoredClinicOperationCount > realClinicWindowCount) {
    details.push({
      field: "monitoredClinicOperationCount",
      message: "monitoredClinicOperationCount must be less than or equal to realClinicWindowCount.",
    });
  }
  if (sampledClinicOperationCount > monitoredClinicOperationCount) {
    details.push({
      field: "sampledClinicOperationCount",
      message: "sampledClinicOperationCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (longitudinalFollowupCount > monitoredClinicOperationCount) {
    details.push({
      field: "longitudinalFollowupCount",
      message: "longitudinalFollowupCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (protectedReviewerLinkedCount > monitoredClinicOperationCount) {
    details.push({
      field: "protectedReviewerLinkedCount",
      message: "protectedReviewerLinkedCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (observedOutcomeCount > monitoredClinicOperationCount) {
    details.push({
      field: "observedOutcomeCount",
      message: "observedOutcomeCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (incidentLinkedCount > monitoredClinicOperationCount) {
    details.push({
      field: "incidentLinkedCount",
      message: "incidentLinkedCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (unresolvedProductionDatasetEvidenceCount > monitoredClinicOperationCount) {
    details.push({
      field: "unresolvedProductionDatasetEvidenceCount",
      message:
        "unresolvedProductionDatasetEvidenceCount must be less than or equal to monitoredClinicOperationCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    productionDatasetEvidenceStatus,
    productionDatasetEvidenceReasons: productionDatasetEvidenceReasons ?? [],
    realClinicWindowStatus,
    datasetSamplingStatus,
    longitudinalFollowupStatus,
    protectedReviewerLinkageStatus,
    outcomeObservationStatus,
    incidentLinkageStatus,
    ownerSignoffStatus,
    realClinicWindowCount,
    monitoredClinicOperationCount,
    sampledClinicOperationCount,
    longitudinalFollowupCount,
    protectedReviewerLinkedCount,
    observedOutcomeCount,
    incidentLinkedCount,
    unresolvedProductionDatasetEvidenceCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProductionReviewerRollbackEvidencePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in production reviewer rollback evidence payloads.",
    });
  }
  const productionReviewerRollbackEvidenceStatus = cleanString(
    input.productionReviewerRollbackEvidenceStatus,
  );
  if (
    !productionReviewerRollbackEvidenceStatus
    || !TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_ROLLBACK_EVIDENCE_STATUS_VALUES.has(
      productionReviewerRollbackEvidenceStatus,
    )
  ) {
    details.push({
      field: "productionReviewerRollbackEvidenceStatus",
      message:
        "productionReviewerRollbackEvidenceStatus must be not_started, in_review, or ready_for_production_reviewer_rollback_evidence.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const productionReviewerRollbackEvidenceReasons = normalizeTechnicalStrings(
    input.productionReviewerRollbackEvidenceReasons,
    "productionReviewerRollbackEvidenceReasons",
    details,
  );
  const rollbackDrillStatus = checklistStatus("rollbackDrillStatus");
  const rollbackOwnerStatus = checklistStatus("rollbackOwnerStatus");
  const rollbackWindowStatus = checklistStatus("rollbackWindowStatus");
  const rollbackExceptionStatus = checklistStatus("rollbackExceptionStatus");
  const rollbackArchiveStatus = checklistStatus("rollbackArchiveStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const productionReviewWindowCount = count("productionReviewWindowCount", 30000);
  const rollbackDrillProductionCount = count("rollbackDrillProductionCount", 30000);
  const rollbackReadyProductionCount = count("rollbackReadyProductionCount", 30000);
  const rollbackExceptionCount = count("rollbackExceptionCount", 30000);
  const unresolvedRollbackEvidenceCount = count("unresolvedRollbackEvidenceCount", 30000);
  const blockerCount = count("blockerCount", 30000);
  if (rollbackDrillProductionCount > productionReviewWindowCount) {
    details.push({
      field: "rollbackDrillProductionCount",
      message: "rollbackDrillProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (rollbackReadyProductionCount > productionReviewWindowCount) {
    details.push({
      field: "rollbackReadyProductionCount",
      message: "rollbackReadyProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (rollbackExceptionCount > productionReviewWindowCount) {
    details.push({
      field: "rollbackExceptionCount",
      message: "rollbackExceptionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (unresolvedRollbackEvidenceCount > productionReviewWindowCount) {
    details.push({
      field: "unresolvedRollbackEvidenceCount",
      message: "unresolvedRollbackEvidenceCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    productionReviewerRollbackEvidenceStatus,
    productionReviewerRollbackEvidenceReasons: productionReviewerRollbackEvidenceReasons ?? [],
    rollbackDrillStatus,
    rollbackOwnerStatus,
    rollbackWindowStatus,
    rollbackExceptionStatus,
    rollbackArchiveStatus,
    ownerSignoffStatus,
    productionReviewWindowCount,
    rollbackDrillProductionCount,
    rollbackReadyProductionCount,
    rollbackExceptionCount,
    unresolvedRollbackEvidenceCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeVisitLongitudinalTimelineRolloutProductionReviewerGovernancePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in production reviewer governance payloads.",
    });
  }
  const productionReviewerGovernanceStatus = cleanString(input.productionReviewerGovernanceStatus);
  if (
    !productionReviewerGovernanceStatus
    || !TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_GOVERNANCE_STATUS_VALUES.has(productionReviewerGovernanceStatus)
  ) {
    details.push({
      field: "productionReviewerGovernanceStatus",
      message:
        "productionReviewerGovernanceStatus must be not_started, in_review, or ready_for_production_reviewer_governance.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const productionReviewerGovernanceReasons = normalizeTechnicalStrings(
    input.productionReviewerGovernanceReasons,
    "productionReviewerGovernanceReasons",
    details,
  );
  const productionReviewerAssignmentStatus = checklistStatus("productionReviewerAssignmentStatus");
  const productionSecondReviewStatus = checklistStatus("productionSecondReviewStatus");
  const productionAdjudicationStatus = checklistStatus("productionAdjudicationStatus");
  const productionFollowupStatus = checklistStatus("productionFollowupStatus");
  const productionExceptionStatus = checklistStatus("productionExceptionStatus");
  const productionRollbackStatus = checklistStatus("productionRollbackStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const productionReviewWindowCount = count("productionReviewWindowCount", 30000);
  const assignedProductionReviewerCount = count("assignedProductionReviewerCount", 30000);
  const secondReviewedProductionCount = count("secondReviewedProductionCount", 30000);
  const adjudicatedProductionReviewCount = count("adjudicatedProductionReviewCount", 30000);
  const followupClosedProductionCount = count("followupClosedProductionCount", 30000);
  const exceptionClosedProductionCount = count("exceptionClosedProductionCount", 30000);
  const rollbackReadyProductionCount = count("rollbackReadyProductionCount", 30000);
  const unresolvedProductionReviewerGovernanceCount = count("unresolvedProductionReviewerGovernanceCount", 30000);
  const blockerCount = count("blockerCount", 30000);
  if (assignedProductionReviewerCount > productionReviewWindowCount) {
    details.push({
      field: "assignedProductionReviewerCount",
      message: "assignedProductionReviewerCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (secondReviewedProductionCount > assignedProductionReviewerCount) {
    details.push({
      field: "secondReviewedProductionCount",
      message: "secondReviewedProductionCount must be less than or equal to assignedProductionReviewerCount.",
    });
  }
  if (adjudicatedProductionReviewCount > secondReviewedProductionCount) {
    details.push({
      field: "adjudicatedProductionReviewCount",
      message: "adjudicatedProductionReviewCount must be less than or equal to secondReviewedProductionCount.",
    });
  }
  if (followupClosedProductionCount > assignedProductionReviewerCount) {
    details.push({
      field: "followupClosedProductionCount",
      message: "followupClosedProductionCount must be less than or equal to assignedProductionReviewerCount.",
    });
  }
  if (exceptionClosedProductionCount > productionReviewWindowCount) {
    details.push({
      field: "exceptionClosedProductionCount",
      message: "exceptionClosedProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (rollbackReadyProductionCount > productionReviewWindowCount) {
    details.push({
      field: "rollbackReadyProductionCount",
      message: "rollbackReadyProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (unresolvedProductionReviewerGovernanceCount > productionReviewWindowCount) {
    details.push({
      field: "unresolvedProductionReviewerGovernanceCount",
      message:
        "unresolvedProductionReviewerGovernanceCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    productionReviewerGovernanceStatus,
    productionReviewerGovernanceReasons: productionReviewerGovernanceReasons ?? [],
    productionReviewerAssignmentStatus,
    productionSecondReviewStatus,
    productionAdjudicationStatus,
    productionFollowupStatus,
    productionExceptionStatus,
    productionRollbackStatus,
    ownerSignoffStatus,
    productionReviewWindowCount,
    assignedProductionReviewerCount,
    secondReviewedProductionCount,
    adjudicatedProductionReviewCount,
    followupClosedProductionCount,
    exceptionClosedProductionCount,
    rollbackReadyProductionCount,
    unresolvedProductionReviewerGovernanceCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}


export function normalizeVisitLongitudinalTimelineRolloutProductionReviewerEvidencePayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({
      field: "body",
      message: "Protected fields are not accepted in production reviewer evidence payloads.",
    });
  }
  const productionReviewerEvidenceStatus = cleanString(input.productionReviewerEvidenceStatus);
  if (
    !productionReviewerEvidenceStatus
    || !TIMELINE_ROLLOUT_PRODUCTION_REVIEWER_EVIDENCE_STATUS_VALUES.has(productionReviewerEvidenceStatus)
  ) {
    details.push({
      field: "productionReviewerEvidenceStatus",
      message:
        "productionReviewerEvidenceStatus must be not_started, in_review, or ready_for_production_reviewer_evidence.",
    });
  }
  const checklistStatus = (field) => {
    const value = cleanString(input[field]) || "missing";
    if (!TIMELINE_ROLLOUT_SOP_CHECKLIST_STATUS_VALUES.has(value)) {
      details.push({ field, message: `${field} must be missing, needs_review, or ready.` });
      return "missing";
    }
    return value;
  };
  const count = (field, max) => normalizeNumber(input[field], field, details, { integer: true, min: 0, max }) ?? 0;
  const productionReviewerEvidenceReasons = normalizeTechnicalStrings(
    input.productionReviewerEvidenceReasons,
    "productionReviewerEvidenceReasons",
    details,
  );
  const productionReviewerAssignmentStatus = checklistStatus("productionReviewerAssignmentStatus");
  const productionSecondReviewStatus = checklistStatus("productionSecondReviewStatus");
  const productionAdjudicationStatus = checklistStatus("productionAdjudicationStatus");
  const productionFollowupStatus = checklistStatus("productionFollowupStatus");
  const productionExceptionStatus = checklistStatus("productionExceptionStatus");
  const productionRollbackStatus = checklistStatus("productionRollbackStatus");
  const ownerSignoffStatus = checklistStatus("ownerSignoffStatus");
  const productionReviewWindowCount = count("productionReviewWindowCount", 30000);
  const assignedProductionReviewerCount = count("assignedProductionReviewerCount", 30000);
  const secondReviewedProductionCount = count("secondReviewedProductionCount", 30000);
  const adjudicatedProductionReviewCount = count("adjudicatedProductionReviewCount", 30000);
  const followupClosedProductionCount = count("followupClosedProductionCount", 30000);
  const exceptionClosedProductionCount = count("exceptionClosedProductionCount", 30000);
  const rollbackReadyProductionCount = count("rollbackReadyProductionCount", 30000);
  const unresolvedProductionReviewerEvidenceCount = count("unresolvedProductionReviewerEvidenceCount", 30000);
  const blockerCount = count("blockerCount", 30000);
  if (assignedProductionReviewerCount > productionReviewWindowCount) {
    details.push({
      field: "assignedProductionReviewerCount",
      message: "assignedProductionReviewerCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (secondReviewedProductionCount > assignedProductionReviewerCount) {
    details.push({
      field: "secondReviewedProductionCount",
      message: "secondReviewedProductionCount must be less than or equal to assignedProductionReviewerCount.",
    });
  }
  if (adjudicatedProductionReviewCount > secondReviewedProductionCount) {
    details.push({
      field: "adjudicatedProductionReviewCount",
      message: "adjudicatedProductionReviewCount must be less than or equal to secondReviewedProductionCount.",
    });
  }
  if (followupClosedProductionCount > assignedProductionReviewerCount) {
    details.push({
      field: "followupClosedProductionCount",
      message: "followupClosedProductionCount must be less than or equal to assignedProductionReviewerCount.",
    });
  }
  if (exceptionClosedProductionCount > productionReviewWindowCount) {
    details.push({
      field: "exceptionClosedProductionCount",
      message: "exceptionClosedProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (rollbackReadyProductionCount > productionReviewWindowCount) {
    details.push({
      field: "rollbackReadyProductionCount",
      message: "rollbackReadyProductionCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (unresolvedProductionReviewerEvidenceCount > productionReviewWindowCount) {
    details.push({
      field: "unresolvedProductionReviewerEvidenceCount",
      message:
        "unresolvedProductionReviewerEvidenceCount must be less than or equal to productionReviewWindowCount.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    productionReviewerEvidenceStatus,
    productionReviewerEvidenceReasons: productionReviewerEvidenceReasons ?? [],
    productionReviewerAssignmentStatus,
    productionSecondReviewStatus,
    productionAdjudicationStatus,
    productionFollowupStatus,
    productionExceptionStatus,
    productionRollbackStatus,
    ownerSignoffStatus,
    productionReviewWindowCount,
    assignedProductionReviewerCount,
    secondReviewedProductionCount,
    adjudicatedProductionReviewCount,
    followupClosedProductionCount,
    exceptionClosedProductionCount,
    rollbackReadyProductionCount,
    unresolvedProductionReviewerEvidenceCount,
    blockerCount,
    patientDeliveryAllowed: false,
    medicalMeasurementAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

export function normalizeUpdateAssessmentPayload(input = {}) {
  requireObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(input, "status")) {
    const status = normalizeClinicalStatus(input.status, details);
    if (status) {
      payload.status = status;
      if (status === "signed") payload.signedAt = new Date().toISOString();
    }
  }
  if (hasOwn(input, "riskLevel")) {
    const risk = cleanString(input.riskLevel);
    if (risk && !RISK_LEVEL_VALUES.has(risk)) {
      details.push({ field: "riskLevel", message: "riskLevel must be low, moderate, high, or urgent." });
    } else {
      payload.riskLevel = risk;
    }
  }
  if (hasOwn(input, "abcdTotal")) {
    const value = normalizeNumber(input.abcdTotal, "abcdTotal", details, { min: 0, max: 20 });
    if (value !== undefined) payload.abcdTotal = value;
  }
  if (hasOwn(input, "sevenPointTotal")) {
    const value = normalizeNumber(input.sevenPointTotal, "sevenPointTotal", details, {
      integer: true,
      min: 0,
      max: 10,
    });
    if (value !== undefined) payload.sevenPointTotal = value;
  }
  if (hasOwn(input, "summary")) {
    const value = normalizeLongField(input.summary, "summary", details);
    if (value !== undefined) payload.summary = value;
  }
  if (hasOwn(input, "recommendation")) {
    const value = normalizeLongField(input.recommendation, "recommendation", details);
    if (value !== undefined) payload.recommendation = value;
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one assessment field is required." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return payload;
}

export function normalizeUpdateConclusionPayload(input = {}) {
  requireObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(input, "status")) {
    const status = normalizeClinicalStatus(input.status, details);
    if (status) {
      payload.status = status;
      if (status === "signed") payload.signedAt = new Date().toISOString();
    }
  }
  if (hasOwn(input, "summary")) {
    const value = normalizeLongField(input.summary, "summary", details);
    if (value !== undefined) payload.summary = value;
  }
  if (hasOwn(input, "nextStep")) {
    const value = normalizeLongField(input.nextStep, "nextStep", details);
    if (value !== undefined) payload.nextStep = value;
  }
  if (hasOwn(input, "followUpAt")) {
    payload.followUpAt = cleanString(input.followUpAt);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one conclusion field is required." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return payload;
}

export function normalizeLesionComparisonDraftPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in comparison draft payloads." });
  }

  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);

  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }

  const action = cleanString(input.action);
  if (!action || !COMPARISON_ACTION_VALUES.has(action)) {
    details.push({ field: "action", message: "action must be retake, excluded, or report_limit." });
  }

  const comparability = cleanString(input.comparability);
  if (!comparability || !COMPARABILITY_VALUES.has(comparability)) {
    details.push({ field: "comparability", message: "comparability must be comparable or not_comparable." });
  }

  const reasons = normalizeComparisonReasons(input.reasons, details);
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }

  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    action,
    comparability,
    reasons: reasons ?? [],
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
  };
}

export function normalizeLesionComparisonReviewerAssignmentPayload(input = {}) {
  requireObject(input);
  const details = [];
  if (containsProtectedKey(input)) {
    details.push({ field: "body", message: "Protected fields are not accepted in reviewer assignment payloads." });
  }
  const lesionId = normalizeSafeIdentifier(input.lesionId, "lesionId", details);
  const pairKey = normalizeSafeIdentifier(input.pairKey, "pairKey", details);
  const imageIds = Array.isArray(input.imageIds)
    ? input.imageIds.map((id, index) => normalizeSafeIdentifier(id, `imageIds[${index}]`, details))
    : undefined;
  if (!imageIds || imageIds.length !== 2 || imageIds.some((id) => !id)) {
    details.push({ field: "imageIds", message: "Exactly two safe image IDs are required." });
  }
  if (imageIds?.length === 2 && new Set(imageIds).size !== 2) {
    details.push({ field: "imageIds", message: "imageIds must reference two different images." });
  }
  const expectedPairKey =
    lesionId && imageIds?.length === 2 && imageIds.every(Boolean)
      ? `${lesionId}:${[...imageIds].sort().join("+")}`
      : null;
  if (pairKey && expectedPairKey && pairKey !== expectedPairKey) {
    details.push({ field: "pairKey", message: "pairKey must match lesionId and sorted imageIds." });
  }
  const assignmentStatus = cleanString(input.assignmentStatus) || "assigned";
  if (!VIEWER_QA_REVIEWER_ASSIGNMENT_STATUS_VALUES.has(assignmentStatus)) {
    details.push({ field: "assignmentStatus", message: "assignmentStatus is not supported." });
  }
  const secondReviewStatus = cleanString(input.secondReviewStatus) || "not_required";
  if (!VIEWER_QA_SECOND_REVIEW_STATUS_VALUES.has(secondReviewStatus)) {
    details.push({ field: "secondReviewStatus", message: "secondReviewStatus is not supported." });
  }
  const assignedReviewerUserId = normalizeUuidOrNull(input.assignedReviewerUserId, "assignedReviewerUserId", details);
  const secondReviewerUserId = normalizeUuidOrNull(input.secondReviewerUserId, "secondReviewerUserId", details);
  if ((assignmentStatus === "assigned" || assignmentStatus.startsWith("second_review")) && !assignedReviewerUserId) {
    details.push({ field: "assignedReviewerUserId", message: "assignedReviewerUserId is required for reviewer assignment." });
  }
  if ((secondReviewStatus === "assigned" || secondReviewStatus === "completed") && !secondReviewerUserId) {
    details.push({ field: "secondReviewerUserId", message: "secondReviewerUserId is required for second review." });
  }
  if (assignedReviewerUserId && secondReviewerUserId && assignedReviewerUserId === secondReviewerUserId) {
    details.push({ field: "secondReviewerUserId", message: "Second reviewer must differ from assigned reviewer." });
  }
  const assignmentReasons = normalizeTechnicalStrings(input.assignmentReasons, "assignmentReasons", details);
  const secondReviewReasons = normalizeTechnicalStrings(input.secondReviewReasons, "secondReviewReasons", details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    lesionId,
    pairKey,
    imageIds,
    assignmentStatus,
    assignmentReasons: assignmentReasons ?? [],
    assignedReviewerUserId,
    secondReviewStatus,
    secondReviewReasons: secondReviewReasons ?? [],
    secondReviewerUserId,
    reviewerIdentityExposed: false,
    medicalMeasurementAllowed: false,
    patientDeliveryAllowed: false,
    protectedFieldsExposed: false,
    clinicalOutputGenerated: false,
  };
}

function ensureScopeAllowsClinic(scope, clinicId) {
  if (scope.allClinics) return;
  if (!clinicId || !scope.clinicIds.includes(clinicId)) {
    throw new ForbiddenError("Resource is outside the authenticated user's clinic scope.");
  }
}

async function getVisitOrThrow(visitWorkspaceRepository, visitId, scope) {
  const visit = await visitWorkspaceRepository.getVisit({
    visitId,
    clinicIds: scope.clinicIds,
    allClinics: scope.allClinics,
  });
  if (!visit) throw new VisitWorkspaceNotFoundError("Visit was not found in the allowed clinic scope.");
  ensureScopeAllowsClinic(scope, visit.clinic.id);
  return visit;
}

function queryValue(input, key) {
  if (input instanceof URLSearchParams) return input.get(key);
  if (isPlainObject(input)) return input[key];
  return null;
}

export function normalizeLesionComparisonViewerQaReviewQueueParams(input = {}) {
  const rawStatus = cleanString(queryValue(input, "status")) || "actionable";
  const status = VIEWER_QA_REVIEW_QUEUE_STATUS_VALUES.has(rawStatus) ? rawStatus : "actionable";
  return {
    status,
    limit: normalizeBoundedInteger(queryValue(input, "limit"), 20, { min: 1, max: 100 }),
  };
}

export function createClinicalWorkspaceService({
  visitWorkspaceRepository,
  clinicalWorkspaceRepository,
  auditRepository,
  objectStore,
} = {}) {
  return {
    async getAssessment(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const assessment = await clinicalWorkspaceRepository.getAssessment({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: visit.clinic.id,
        actorUserId: authContext.userId,
        action: "assessment.read",
        entityType: "clinical_assessment",
        entityId: assessment?.id ?? safeVisitId,
        correlationId,
        metadata: { visitId: safeVisitId, exists: Boolean(assessment) },
      });
      return { assessment, scope };
    },

    async updateAssessment(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeUpdateAssessmentPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const assessment = await clinicalWorkspaceRepository.upsertAssessment({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        changes: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!assessment) throw new VisitWorkspaceNotFoundError("Assessment could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: assessment.clinicId,
        actorUserId: authContext.userId,
        action: "assessment.update",
        entityType: "clinical_assessment",
        entityId: assessment.id,
        correlationId,
        metadata: { visitId: safeVisitId, changedFields: changedFields(payload) },
      });
      return { assessment, scope };
    },

    async getConclusion(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const conclusion = await clinicalWorkspaceRepository.getConclusion({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: visit.clinic.id,
        actorUserId: authContext.userId,
        action: "conclusion.read",
        entityType: "clinical_conclusion",
        entityId: conclusion?.id ?? safeVisitId,
        correlationId,
        metadata: { visitId: safeVisitId, exists: Boolean(conclusion) },
      });
      return { conclusion, scope };
    },

    async updateConclusion(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeUpdateConclusionPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const conclusion = await clinicalWorkspaceRepository.upsertConclusion({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        changes: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!conclusion) throw new VisitWorkspaceNotFoundError("Conclusion could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: conclusion.clinicId,
        actorUserId: authContext.userId,
        action: "conclusion.update",
        entityType: "clinical_conclusion",
        entityId: conclusion.id,
        correlationId,
        metadata: { visitId: safeVisitId, changedFields: changedFields(payload) },
      });
      return { conclusion, scope };
    },

    async getReport(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const report = await clinicalWorkspaceRepository.getReport({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: visit.clinic.id,
        actorUserId: authContext.userId,
        action: "report.read",
        entityType: "report",
        entityId: report?.id ?? safeVisitId,
        correlationId,
        metadata: { visitId: safeVisitId, exists: Boolean(report) },
      });
      return { report, scope };
    },

    async saveLesionComparisonDraft(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonDraftPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const draft = await clinicalWorkspaceRepository.upsertLesionComparisonDraft({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        draft: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!draft) throw new VisitWorkspaceNotFoundError("Comparison draft could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: draft.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_draft.upsert",
        entityType: "lesion_comparison_decision_draft",
        entityId: draft.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          action: payload.action,
          comparability: payload.comparability,
          imageCount: payload.imageIds.length,
          reasonsCount: payload.reasons.length,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { draft, scope };
    },

    async saveAssetCaptureMetadata(visitId, assetId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const safeAssetId = assertUuid(assetId, "assetId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeAssetCaptureMetadataPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const metadata = await clinicalWorkspaceRepository.upsertAssetCaptureMetadata({
        visitId: safeVisitId,
        assetId: safeAssetId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        capturedByUserId: authContext.userId,
        metadata: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!metadata) throw new VisitWorkspaceNotFoundError("Capture metadata could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: metadata.clinicId,
        actorUserId: authContext.userId,
        action: "clinical_asset_capture_metadata.upsert",
        entityType: "clinical_asset_capture_metadata",
        entityId: metadata.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          assetId: safeAssetId,
          captureSource: payload.captureSource,
          framePresent: Boolean(payload.frameWidth && payload.frameHeight),
          qualityIssuesCount: payload.qualityIssues.length,
          scaleMarkerDetected: payload.scaleMarkerDetected,
          millimetersAvailable: payload.millimetersAvailable,
          deviceEvidenceStatus: payload.deviceEvidenceStatus,
          deviceCalibrationStatus: payload.deviceCalibrationStatus,
          deviceCaptureProfile: payload.deviceCaptureProfile,
          captureProtocolStatus: payload.captureProtocolStatus,
          captureProtocolVersion: payload.captureProtocolVersion,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { metadata, scope };
    },

    async getLesionCaptureMetadata(patientId, lesionId, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId, "patientId");
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const scope = visitReadScope(authContext);
      const metadata = await clinicalWorkspaceRepository.getLesionCaptureMetadata({
        patientId: safePatientId,
        lesionId: safeLesionId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const summary = metadata?.summary || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: metadata?.clinicId ?? scope.clinicIds[0] ?? null,
        actorUserId: authContext.userId,
        action: "lesion_capture_metadata.read",
        entityType: "lesion_capture_metadata",
        entityId: safeLesionId,
        correlationId,
        metadata: {
          patientId: safePatientId,
          lesionId: safeLesionId,
          assetCount: Number(summary.assetCount ?? 0),
          metadataCount: Number(summary.metadataCount ?? 0),
          readyForTechnicalCompareCount: Number(summary.readyForTechnicalCompareCount ?? 0),
          deviceEvidenceReadyCount: Number(summary.deviceEvidenceReadyCount ?? 0),
          deviceEvidenceReviewCount: Number(summary.deviceEvidenceReviewCount ?? 0),
          productionAssetReadyCount: Number(summary.productionAssetReadyCount ?? 0),
          productionAssetReviewCount: Number(summary.productionAssetReviewCount ?? 0),
          deviceBridgeQualityReadyCount: Number(summary.deviceBridgeQualityReadyCount ?? 0),
          deviceBridgeQualityReviewCount: Number(summary.deviceBridgeQualityReviewCount ?? 0),
          captureProtocolReadyCount: Number(summary.captureProtocolReadyCount ?? 0),
          captureProtocolReviewCount: Number(summary.captureProtocolReviewCount ?? 0),
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { metadata, scope };
    },

    async saveLesionComparisonViewerQa(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonViewerQaPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.upsertLesionComparisonViewerQa({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        qa: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Viewer QA draft could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_viewer_qa.upsert",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          markerCount: payload.technicalMarkers.length,
          calibrationStatus: payload.calibrationStatus,
          calibrationReasonsCount: payload.calibrationReasons.length,
          captureMetadataStatus: payload.captureMetadataStatus,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { qa, scope };
    },

    async reviewLesionComparisonViewerQa(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonViewerQaReviewPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.reviewLesionComparisonViewerQa({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        review: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Viewer QA review could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_viewer_qa.review",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          reviewStatus: payload.reviewStatus,
          reviewReasonsCount: payload.reviewReasons.length,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { qa, scope };
    },

    async reviewLesionComparisonViewerQaReviewerWorkflow(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonViewerQaReviewerWorkflowPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.reviewLesionComparisonViewerQaReviewerWorkflow({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        workflow: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Viewer QA reviewer workflow could not be saved.");
      const gate = qa.reviewerWorkflow?.gate || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_viewer_qa.reviewer_workflow",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          workflowStatus: qa.reviewerWorkflow?.status ?? payload.workflowStatus,
          workflowReasonsCount: payload.workflowReasons.length,
          technicalReviewReady: gate.technicalReviewReady === true,
          calibrationReady: gate.calibrationReady === true,
          captureMetadataReady: gate.captureMetadataReady === true,
          markerGateReady: gate.markerGateReady === true,
          measurementPolicyApproved: gate.measurementPolicyApproved === true,
          productionAnalysisPolicyApproved: gate.productionAnalysisPolicyApproved === true,
          reviewerAssignmentReady: gate.reviewerAssignmentReady === true,
          secondReviewReady: gate.secondReviewReady === true,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalConclusionGenerated: false,
        },
      });
      return { qa, scope };
    },

    async reviewLesionComparisonMeasurementPolicy(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonMeasurementPolicyPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.reviewLesionComparisonMeasurementPolicy({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        policy: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Measurement policy review could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_measurement_policy.review",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          measurementPolicyStatus: payload.measurementPolicyStatus,
          reasonsCount: payload.measurementPolicyReasons.length,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
      });
      return { qa, scope };
    },

    async reviewLesionComparisonProductionAnalysisPolicy(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonProductionAnalysisPolicyPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.reviewLesionComparisonProductionAnalysisPolicy({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        policy: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Production analysis policy review could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_production_analysis_policy.review",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          productionAnalysisPolicyStatus: payload.productionAnalysisPolicyStatus,
          reasonsCount: payload.productionAnalysisPolicyReasons.length,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
      });
      return { qa, scope };
    },

    async assignLesionComparisonReviewer(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeLesionComparisonReviewerAssignmentPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const qa = await clinicalWorkspaceRepository.assignLesionComparisonReviewer({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        assignment: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Reviewer assignment could not be saved.");
      const assignment = qa.reviewerAssignment || {};
      const secondReview = qa.secondReview || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_comparison_reviewer_assignment.review",
        entityType: "lesion_comparison_viewer_qa_draft",
        entityId: qa.id,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          lesionId: payload.lesionId,
          assignmentStatus: assignment.status ?? payload.assignmentStatus,
          assignmentReasonsCount: payload.assignmentReasons.length,
          secondReviewStatus: secondReview.status ?? payload.secondReviewStatus,
          secondReviewReasonsCount: payload.secondReviewReasons.length,
          assignedReviewerPresent: Boolean(payload.assignedReviewerUserId),
          secondReviewerPresent: Boolean(payload.secondReviewerUserId),
          reviewerIdentityExposed: false,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
        },
      });
      return { qa, scope };
    },

    async getVisitLesionComparisonViewerQaReviewQueue(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const params = normalizeLesionComparisonViewerQaReviewQueueParams(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const queue = await clinicalWorkspaceRepository.getVisitLesionComparisonViewerQaReviewQueue({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        status: params.status,
        limit: params.limit,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!queue) throw new VisitWorkspaceNotFoundError("Viewer QA review queue was not found in the allowed clinic scope.");
      const summary = queue.summary || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: queue.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "lesion_comparison_viewer_qa.review_queue.read",
        entityType: "lesion_comparison_viewer_qa_review_queue",
        entityId: safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          status: params.status,
          limit: params.limit,
          total: Number(summary.total ?? 0),
          actionable: Number(summary.actionable ?? 0),
          needsRecapture: Number(summary.needsRecapture ?? 0),
          notSuitableForComparison: Number(summary.notSuitableForComparison ?? 0),
          measurementPolicyRequired: Number(summary.measurementPolicyRequired ?? 0),
          productionAnalysisPolicyRequired: Number(summary.productionAnalysisPolicyRequired ?? 0),
          reviewerAssignmentRequired: Number(summary.reviewerAssignmentRequired ?? 0),
          secondReviewRequired: Number(summary.secondReviewRequired ?? 0),
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
        },
      });
      return { queue, scope };
    },

    async getVisitLongitudinalDatasetValidation(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: validation.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_dataset_validation.read",
        entityType: "visit_longitudinal_dataset_validation",
        entityId: safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          status: String(readiness.status ?? "blocked"),
          lesionCount: Number(readiness.lesionCount ?? 0),
          timelineCandidateCount: Number(readiness.timelineCandidateCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          needsReviewTimelineCount: Number(readiness.needsReviewTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          deviceEvidenceNotReadyCount: Number(readiness.deviceEvidenceNotReadyCount ?? 0),
          productionAssetNotReadyCount: Number(readiness.productionAssetNotReadyCount ?? 0),
          deviceBridgeQualityNotReadyCount: Number(readiness.deviceBridgeQualityNotReadyCount ?? 0),
          captureProtocolNotReadyCount: Number(readiness.captureProtocolNotReadyCount ?? 0),
          measurementPolicyNotReadyCount: Number(readiness.measurementPolicyNotReadyCount ?? 0),
          productionAnalysisPolicyNotReadyCount: Number(readiness.productionAnalysisPolicyNotReadyCount ?? 0),
          dynamicConclusionAllowed: false,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
        },
      });
      return { validation, scope };
    },

    async reviewVisitLongitudinalTimelineRollout(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const validationReady = validationStatus === "ready_for_rollout";
      const effectiveStatus =
        payload.rolloutStatus === "approved_for_clinical_operations" && !validationReady
          ? "review_required"
          : payload.rolloutStatus;
      const effectiveReasons = [
        ...payload.rolloutReasons,
        ...(payload.rolloutStatus === "approved_for_clinical_operations" && !validationReady
          ? ["timeline_dataset_not_ready"]
          : []),
      ];
      const rollout = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRollout({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        rollout: {
          rolloutStatus: effectiveStatus,
          rolloutReasons: effectiveReasons,
          validationStatus,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          needsReviewTimelineCount: Number(readiness.needsReviewTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!rollout) throw new VisitWorkspaceNotFoundError("Timeline rollout review could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: rollout.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout.review",
        entityType: "visit_longitudinal_timeline_rollout_review",
        entityId: rollout.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          rolloutStatus: rollout.status,
          validationStatus: rollout.validationStatus,
          lesionCount: Number(rollout.lesionCount ?? 0),
          readyTimelineCount: Number(rollout.readyTimelineCount ?? 0),
          needsReviewTimelineCount: Number(rollout.needsReviewTimelineCount ?? 0),
          blockedTimelineCount: Number(rollout.blockedTimelineCount ?? 0),
          candidatePairCount: Number(rollout.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(rollout.reviewerWorkflowReadyCount ?? 0),
          reasonsCount: rollout.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
        },
      });
      return { rollout, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutSop(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutSopPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const checklistReady = [
        payload.datasetValidationStatus,
        payload.reviewerOperationsStatus,
        payload.rollbackPlanStatus,
        payload.monitoringPlanStatus,
        payload.rolloutWindowStatus,
        payload.ownerAckStatus,
      ].every((status) => status === "ready");
      const productionReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && checklistReady;
      const effectiveStatus =
        payload.sopStatus === "ready_for_operational_rollout" && !productionReady
          ? "in_review"
          : payload.sopStatus;
      const effectiveReasons = [
        ...payload.sopReasons,
        ...(payload.sopStatus === "ready_for_operational_rollout" && !productionReady
          ? ["timeline_rollout_sop_not_ready"]
          : []),
      ];
      const sop = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutSop({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        sop: {
          sopStatus: effectiveStatus,
          sopReasons: effectiveReasons,
          validationStatus,
          rolloutStatus,
          datasetValidationStatus: payload.datasetValidationStatus,
          reviewerOperationsStatus: payload.reviewerOperationsStatus,
          rollbackPlanStatus: payload.rollbackPlanStatus,
          monitoringPlanStatus: payload.monitoringPlanStatus,
          rolloutWindowStatus: payload.rolloutWindowStatus,
          ownerAckStatus: payload.ownerAckStatus,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!sop) throw new VisitWorkspaceNotFoundError("Timeline rollout SOP could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: sop.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_sop.review",
        entityType: "visit_longitudinal_timeline_rollout_sop_review",
        entityId: sop.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          sopStatus: sop.status,
          validationStatus: sop.validationStatus,
          rolloutStatus: sop.rolloutStatus,
          lesionCount: Number(sop.lesionCount ?? 0),
          readyTimelineCount: Number(sop.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(sop.blockedTimelineCount ?? 0),
          candidatePairCount: Number(sop.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(sop.reviewerWorkflowReadyCount ?? 0),
          checklistReady,
          reasonsCount: sop.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
        },
      });
      return { sop, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutEvidence(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutEvidencePayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceChecklistReady = [
        payload.monitoringEvidenceStatus,
        payload.sampleAuditStatus,
        payload.exceptionLogStatus,
        payload.rollbackDrillStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateEvidenceReady =
        payload.monitoringWindowDays > 0
        && payload.sampledTimelineCount > 0
        && payload.rollbackDrillCount > 0
        && payload.exceptionCount === 0;
      const productionReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceChecklistReady
        && aggregateEvidenceReady;
      const effectiveStatus =
        payload.evidenceStatus === "ready_for_monitored_rollout" && !productionReady
          ? "in_review"
          : payload.evidenceStatus;
      const effectiveReasons = [
        ...payload.evidenceReasons,
        ...(payload.evidenceStatus === "ready_for_monitored_rollout" && !productionReady
          ? ["timeline_rollout_evidence_not_ready"]
          : []),
      ];
      const evidence = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutEvidence({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        evidence: {
          evidenceStatus: effectiveStatus,
          evidenceReasons: effectiveReasons,
          sopStatus,
          validationStatus,
          rolloutStatus,
          monitoringEvidenceStatus: payload.monitoringEvidenceStatus,
          sampleAuditStatus: payload.sampleAuditStatus,
          exceptionLogStatus: payload.exceptionLogStatus,
          rollbackDrillStatus: payload.rollbackDrillStatus,
          ownerSignoffStatus: payload.ownerSignoffStatus,
          monitoringWindowDays: payload.monitoringWindowDays,
          sampledTimelineCount: payload.sampledTimelineCount,
          exceptionCount: payload.exceptionCount,
          rollbackDrillCount: payload.rollbackDrillCount,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!evidence) throw new VisitWorkspaceNotFoundError("Timeline rollout evidence could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: evidence.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_evidence.review",
        entityType: "visit_longitudinal_timeline_rollout_evidence_review",
        entityId: evidence.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          evidenceStatus: evidence.status,
          validationStatus: evidence.validationStatus,
          rolloutStatus: evidence.rolloutStatus,
          sopStatus: evidence.sopStatus,
          monitoringWindowDays: Number(evidence.monitoringWindowDays ?? 0),
          sampledTimelineCount: Number(evidence.sampledTimelineCount ?? 0),
          exceptionCount: Number(evidence.exceptionCount ?? 0),
          rollbackDrillCount: Number(evidence.rollbackDrillCount ?? 0),
          lesionCount: Number(evidence.lesionCount ?? 0),
          readyTimelineCount: Number(evidence.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(evidence.blockedTimelineCount ?? 0),
          candidatePairCount: Number(evidence.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(evidence.reviewerWorkflowReadyCount ?? 0),
          evidenceChecklistReady,
          aggregateEvidenceReady,
          reasonsCount: evidence.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
        },
      });
      return { evidence, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutMonitoring(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutMonitoringPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringChecklistReady = [
        payload.outcomeSamplingStatus,
        payload.incidentReviewStatus,
        payload.exceptionClosureStatus,
        payload.rollbackOutcomeStatus,
        payload.ownerFinalReviewStatus,
      ].every((status) => status === "ready");
      const aggregateMonitoringReady =
        payload.monitoringWindowDays > 0
        && payload.monitoredTimelineCount > 0
        && payload.sampledTimelineCount > 0
        && payload.unresolvedIncidentCount === 0;
      const productionReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringChecklistReady
        && aggregateMonitoringReady;
      const effectiveStatus =
        payload.monitoringStatus === "ready_for_production_rollout" && !productionReady
          ? "in_review"
          : payload.monitoringStatus;
      const effectiveReasons = [
        ...payload.monitoringReasons,
        ...(payload.monitoringStatus === "ready_for_production_rollout" && !productionReady
          ? ["timeline_rollout_monitoring_not_ready"]
          : []),
      ];
      const monitoring = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutMonitoring({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        monitoring: {
          monitoringStatus: effectiveStatus,
          monitoringReasons: effectiveReasons,
          evidenceStatus,
          sopStatus,
          validationStatus,
          rolloutStatus,
          outcomeSamplingStatus: payload.outcomeSamplingStatus,
          incidentReviewStatus: payload.incidentReviewStatus,
          exceptionClosureStatus: payload.exceptionClosureStatus,
          rollbackOutcomeStatus: payload.rollbackOutcomeStatus,
          ownerFinalReviewStatus: payload.ownerFinalReviewStatus,
          monitoringWindowDays: payload.monitoringWindowDays,
          monitoredTimelineCount: payload.monitoredTimelineCount,
          sampledTimelineCount: payload.sampledTimelineCount,
          incidentCount: payload.incidentCount,
          unresolvedIncidentCount: payload.unresolvedIncidentCount,
          closedExceptionCount: payload.closedExceptionCount,
          rollbackExecutionCount: payload.rollbackExecutionCount,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!monitoring) throw new VisitWorkspaceNotFoundError("Timeline rollout monitoring could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: monitoring.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_monitoring.review",
        entityType: "visit_longitudinal_timeline_rollout_monitoring_review",
        entityId: monitoring.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          monitoringStatus: monitoring.status,
          validationStatus: monitoring.validationStatus,
          rolloutStatus: monitoring.rolloutStatus,
          sopStatus: monitoring.sopStatus,
          evidenceStatus: monitoring.evidenceStatus,
          monitoringWindowDays: Number(monitoring.monitoringWindowDays ?? 0),
          monitoredTimelineCount: Number(monitoring.monitoredTimelineCount ?? 0),
          sampledTimelineCount: Number(monitoring.sampledTimelineCount ?? 0),
          incidentCount: Number(monitoring.incidentCount ?? 0),
          unresolvedIncidentCount: Number(monitoring.unresolvedIncidentCount ?? 0),
          closedExceptionCount: Number(monitoring.closedExceptionCount ?? 0),
          rollbackExecutionCount: Number(monitoring.rollbackExecutionCount ?? 0),
          lesionCount: Number(monitoring.lesionCount ?? 0),
          readyTimelineCount: Number(monitoring.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(monitoring.blockedTimelineCount ?? 0),
          candidatePairCount: Number(monitoring.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(monitoring.reviewerWorkflowReadyCount ?? 0),
          monitoringChecklistReady,
          aggregateMonitoringReady,
          reasonsCount: monitoring.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawIncidentDetailsExposed: false,
        },
      });
      return { monitoring, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutIncidentProcedure(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutIncidentProcedurePayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const procedureChecklistReady = [
        payload.realDatasetStatus,
        payload.outcomeSamplingProcedureStatus,
        payload.incidentTriageStatus,
        payload.escalationPathStatus,
        payload.rollbackDecisionStatus,
        payload.ownerReviewStatus,
      ].every((status) => status === "ready");
      const aggregateProcedureReady =
        payload.realDatasetTimelineCount > 0
        && payload.monitoredTimelineCount > 0
        && payload.sampledOutcomeCount > 0
        && payload.unresolvedIncidentCount === 0;
      const clinicMonitoringReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && procedureChecklistReady
        && aggregateProcedureReady;
      const effectiveStatus =
        payload.procedureStatus === "ready_for_clinic_monitoring" && !clinicMonitoringReady
          ? "in_review"
          : payload.procedureStatus;
      const effectiveReasons = [
        ...payload.procedureReasons,
        ...(payload.procedureStatus === "ready_for_clinic_monitoring" && !clinicMonitoringReady
          ? ["timeline_rollout_incident_procedure_not_ready"]
          : []),
      ];
      const incidentProcedure = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutIncidentProcedure({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        procedure: {
          procedureStatus: effectiveStatus,
          procedureReasons: effectiveReasons,
          monitoringStatus,
          evidenceStatus,
          sopStatus,
          validationStatus,
          rolloutStatus,
          realDatasetStatus: payload.realDatasetStatus,
          outcomeSamplingProcedureStatus: payload.outcomeSamplingProcedureStatus,
          incidentTriageStatus: payload.incidentTriageStatus,
          escalationPathStatus: payload.escalationPathStatus,
          rollbackDecisionStatus: payload.rollbackDecisionStatus,
          ownerReviewStatus: payload.ownerReviewStatus,
          realDatasetTimelineCount: payload.realDatasetTimelineCount,
          monitoredTimelineCount: payload.monitoredTimelineCount,
          sampledOutcomeCount: payload.sampledOutcomeCount,
          incidentCaseCount: payload.incidentCaseCount,
          unresolvedIncidentCount: payload.unresolvedIncidentCount,
          escalatedIncidentCount: payload.escalatedIncidentCount,
          rollbackDecisionCount: payload.rollbackDecisionCount,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!incidentProcedure) throw new VisitWorkspaceNotFoundError("Timeline rollout incident procedure could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: incidentProcedure.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_incident_procedure.review",
        entityType: "visit_longitudinal_timeline_rollout_incident_procedure_review",
        entityId: incidentProcedure.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          procedureStatus: incidentProcedure.status,
          validationStatus: incidentProcedure.validationStatus,
          rolloutStatus: incidentProcedure.rolloutStatus,
          sopStatus: incidentProcedure.sopStatus,
          evidenceStatus: incidentProcedure.evidenceStatus,
          monitoringStatus: incidentProcedure.monitoringStatus,
          realDatasetTimelineCount: Number(incidentProcedure.realDatasetTimelineCount ?? 0),
          monitoredTimelineCount: Number(incidentProcedure.monitoredTimelineCount ?? 0),
          sampledOutcomeCount: Number(incidentProcedure.sampledOutcomeCount ?? 0),
          incidentCaseCount: Number(incidentProcedure.incidentCaseCount ?? 0),
          unresolvedIncidentCount: Number(incidentProcedure.unresolvedIncidentCount ?? 0),
          escalatedIncidentCount: Number(incidentProcedure.escalatedIncidentCount ?? 0),
          rollbackDecisionCount: Number(incidentProcedure.rollbackDecisionCount ?? 0),
          lesionCount: Number(incidentProcedure.lesionCount ?? 0),
          readyTimelineCount: Number(incidentProcedure.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(incidentProcedure.blockedTimelineCount ?? 0),
          candidatePairCount: Number(incidentProcedure.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(incidentProcedure.reviewerWorkflowReadyCount ?? 0),
          procedureChecklistReady,
          aggregateProcedureReady,
          reasonsCount: incidentProcedure.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawIncidentDetailsExposed: false,
          rawOutcomeLogsExposed: false,
        },
      });
      return { incidentProcedure, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutClinicalValidation(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutClinicalValidationPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationChecklistReady = [
        payload.realDatasetLockStatus,
        payload.validatorTrainingStatus,
        payload.blindedSampleStatus,
        payload.adjudicationStatus,
        payload.decisionLogStatus,
        payload.ownerAcceptanceStatus,
      ].every((status) => status === "ready");
      const aggregateClinicalValidationReady =
        payload.realDatasetTimelineCount > 0
        && payload.validationSampleCount > 0
        && payload.adjudicatedCaseCount >= payload.disagreementCaseCount
        && payload.blockerCount === 0;
      const clinicalValidationReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationChecklistReady
        && aggregateClinicalValidationReady;
      const effectiveStatus =
        payload.clinicalValidationStatus === "ready_for_clinical_validation" && !clinicalValidationReady
          ? "in_review"
          : payload.clinicalValidationStatus;
      const effectiveReasons = [
        ...payload.clinicalValidationReasons,
        ...(payload.clinicalValidationStatus === "ready_for_clinical_validation" && !clinicalValidationReady
          ? ["timeline_rollout_clinical_validation_not_ready"]
          : []),
      ];
      const clinicalValidation = await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutClinicalValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        clinicalValidation: {
          clinicalValidationStatus: effectiveStatus,
          clinicalValidationReasons: effectiveReasons,
          incidentProcedureStatus,
          monitoringStatus,
          evidenceStatus,
          sopStatus,
          validationStatus,
          rolloutStatus,
          realDatasetLockStatus: payload.realDatasetLockStatus,
          validatorTrainingStatus: payload.validatorTrainingStatus,
          blindedSampleStatus: payload.blindedSampleStatus,
          adjudicationStatus: payload.adjudicationStatus,
          decisionLogStatus: payload.decisionLogStatus,
          ownerAcceptanceStatus: payload.ownerAcceptanceStatus,
          realDatasetTimelineCount: payload.realDatasetTimelineCount,
          validationSampleCount: payload.validationSampleCount,
          disagreementCaseCount: payload.disagreementCaseCount,
          adjudicatedCaseCount: payload.adjudicatedCaseCount,
          followupWindowDays: payload.followupWindowDays,
          blockerCount: payload.blockerCount,
          lesionCount: Number(readiness.lesionCount ?? 0),
          readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
        },
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!clinicalValidation) {
        throw new VisitWorkspaceNotFoundError("Timeline rollout clinical validation could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: clinicalValidation.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_clinical_validation.review",
        entityType: "visit_longitudinal_timeline_rollout_clinical_validation_review",
        entityId: clinicalValidation.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          clinicalValidationStatus: clinicalValidation.status,
          validationStatus: clinicalValidation.validationStatus,
          rolloutStatus: clinicalValidation.rolloutStatus,
          sopStatus: clinicalValidation.sopStatus,
          evidenceStatus: clinicalValidation.evidenceStatus,
          monitoringStatus: clinicalValidation.monitoringStatus,
          incidentProcedureStatus: clinicalValidation.incidentProcedureStatus,
          realDatasetTimelineCount: Number(clinicalValidation.realDatasetTimelineCount ?? 0),
          validationSampleCount: Number(clinicalValidation.validationSampleCount ?? 0),
          disagreementCaseCount: Number(clinicalValidation.disagreementCaseCount ?? 0),
          adjudicatedCaseCount: Number(clinicalValidation.adjudicatedCaseCount ?? 0),
          followupWindowDays: Number(clinicalValidation.followupWindowDays ?? 0),
          blockerCount: Number(clinicalValidation.blockerCount ?? 0),
          lesionCount: Number(clinicalValidation.lesionCount ?? 0),
          readyTimelineCount: Number(clinicalValidation.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(clinicalValidation.blockedTimelineCount ?? 0),
          candidatePairCount: Number(clinicalValidation.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(clinicalValidation.reviewerWorkflowReadyCount ?? 0),
          clinicalValidationChecklistReady,
          aggregateClinicalValidationReady,
          reasonsCount: clinicalValidation.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawValidationLogsExposed: false,
          rawAdjudicationLogsExposed: false,
        },
      });
      return { clinicalValidation, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutPostValidationMonitoringPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationChecklistReady = [
        payload.monitoringWindowStatus,
        payload.outcomeReviewStatus,
        payload.driftReviewStatus,
        payload.incidentFollowupStatus,
        payload.validatorRecheckStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregatePostValidationMonitoringReady =
        payload.realDatasetTimelineCount > 0
        && payload.clinicalValidationSampleCount > 0
        && payload.monitoredTimelineCount > 0
        && payload.sampledOutcomeCount > 0
        && payload.unresolvedDriftSignalCount === 0
        && payload.unresolvedIncidentFollowupCount === 0
        && payload.blockerCount === 0;
      const postValidationMonitoringReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationChecklistReady
        && aggregatePostValidationMonitoringReady;
      const effectiveStatus =
        payload.postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
          && !postValidationMonitoringReady
          ? "in_review"
          : payload.postValidationMonitoringStatus;
      const effectiveReasons = [
        ...payload.postValidationMonitoringReasons,
        ...(payload.postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
          && !postValidationMonitoringReady
          ? ["timeline_rollout_post_validation_monitoring_not_ready"]
          : []),
      ];
      const postValidationMonitoring =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutPostValidationMonitoring({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          postValidationMonitoring: {
            postValidationMonitoringStatus: effectiveStatus,
            postValidationMonitoringReasons: effectiveReasons,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            monitoringWindowStatus: payload.monitoringWindowStatus,
            outcomeReviewStatus: payload.outcomeReviewStatus,
            driftReviewStatus: payload.driftReviewStatus,
            incidentFollowupStatus: payload.incidentFollowupStatus,
            validatorRecheckStatus: payload.validatorRecheckStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realDatasetTimelineCount: payload.realDatasetTimelineCount,
            clinicalValidationSampleCount: payload.clinicalValidationSampleCount,
            monitoredTimelineCount: payload.monitoredTimelineCount,
            sampledOutcomeCount: payload.sampledOutcomeCount,
            driftSignalCount: payload.driftSignalCount,
            unresolvedDriftSignalCount: payload.unresolvedDriftSignalCount,
            incidentFollowupCount: payload.incidentFollowupCount,
            unresolvedIncidentFollowupCount: payload.unresolvedIncidentFollowupCount,
            validatorRecheckCount: payload.validatorRecheckCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!postValidationMonitoring) {
        throw new VisitWorkspaceNotFoundError("Timeline rollout post-validation monitoring could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: postValidationMonitoring.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_post_validation_monitoring.review",
        entityType: "visit_longitudinal_timeline_rollout_post_validation_monitoring_review",
        entityId: postValidationMonitoring.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          postValidationMonitoringStatus: postValidationMonitoring.status,
          clinicalValidationStatus: postValidationMonitoring.clinicalValidationStatus,
          validationStatus: postValidationMonitoring.validationStatus,
          rolloutStatus: postValidationMonitoring.rolloutStatus,
          sopStatus: postValidationMonitoring.sopStatus,
          evidenceStatus: postValidationMonitoring.evidenceStatus,
          monitoringStatus: postValidationMonitoring.monitoringStatus,
          incidentProcedureStatus: postValidationMonitoring.incidentProcedureStatus,
          realDatasetTimelineCount: Number(postValidationMonitoring.realDatasetTimelineCount ?? 0),
          clinicalValidationSampleCount: Number(postValidationMonitoring.clinicalValidationSampleCount ?? 0),
          monitoredTimelineCount: Number(postValidationMonitoring.monitoredTimelineCount ?? 0),
          sampledOutcomeCount: Number(postValidationMonitoring.sampledOutcomeCount ?? 0),
          driftSignalCount: Number(postValidationMonitoring.driftSignalCount ?? 0),
          unresolvedDriftSignalCount: Number(postValidationMonitoring.unresolvedDriftSignalCount ?? 0),
          incidentFollowupCount: Number(postValidationMonitoring.incidentFollowupCount ?? 0),
          unresolvedIncidentFollowupCount: Number(postValidationMonitoring.unresolvedIncidentFollowupCount ?? 0),
          validatorRecheckCount: Number(postValidationMonitoring.validatorRecheckCount ?? 0),
          blockerCount: Number(postValidationMonitoring.blockerCount ?? 0),
          lesionCount: Number(postValidationMonitoring.lesionCount ?? 0),
          readyTimelineCount: Number(postValidationMonitoring.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(postValidationMonitoring.blockedTimelineCount ?? 0),
          candidatePairCount: Number(postValidationMonitoring.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(postValidationMonitoring.reviewerWorkflowReadyCount ?? 0),
          postValidationChecklistReady,
          aggregatePostValidationMonitoringReady,
          reasonsCount: postValidationMonitoring.reasons?.length ?? 0,
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
        },
      });
      return { postValidationMonitoring, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutObservationGovernance(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutObservationGovernancePayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationChecklistReady = [
        payload.observationWindowStatus,
        payload.outcomeObservationStatus,
        payload.driftSignalReviewStatus,
        payload.incidentOutcomeReviewStatus,
        payload.followupClosureStatus,
        payload.governanceReviewStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateObservationGovernanceReady =
        payload.realDatasetTimelineCount > 0
        && payload.postValidationSampleCount > 0
        && payload.observedTimelineCount > 0
        && payload.expectedFollowupCount > 0
        && payload.completedFollowupCount === payload.expectedFollowupCount
        && payload.unresolvedDriftSignalCount === 0
        && payload.unresolvedIncidentOutcomeCount === 0
        && payload.unresolvedGovernanceExceptionCount === 0
        && payload.blockerCount === 0;
      const observationGovernanceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationChecklistReady
        && aggregateObservationGovernanceReady;
      const effectiveStatus =
        payload.observationGovernanceStatus === "ready_for_observation_governance"
          && !observationGovernanceReady
          ? "in_review"
          : payload.observationGovernanceStatus;
      const effectiveReasons = [
        ...payload.observationGovernanceReasons,
        ...(payload.observationGovernanceStatus === "ready_for_observation_governance"
          && !observationGovernanceReady
          ? ["timeline_rollout_observation_governance_not_ready"]
          : []),
      ];
      const observationGovernance =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutObservationGovernance({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          observationGovernance: {
            observationGovernanceStatus: effectiveStatus,
            observationGovernanceReasons: effectiveReasons,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            observationWindowStatus: payload.observationWindowStatus,
            outcomeObservationStatus: payload.outcomeObservationStatus,
            driftSignalReviewStatus: payload.driftSignalReviewStatus,
            incidentOutcomeReviewStatus: payload.incidentOutcomeReviewStatus,
            followupClosureStatus: payload.followupClosureStatus,
            governanceReviewStatus: payload.governanceReviewStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realDatasetTimelineCount: payload.realDatasetTimelineCount,
            postValidationSampleCount: payload.postValidationSampleCount,
            observedTimelineCount: payload.observedTimelineCount,
            expectedFollowupCount: payload.expectedFollowupCount,
            completedFollowupCount: payload.completedFollowupCount,
            driftSignalCount: payload.driftSignalCount,
            unresolvedDriftSignalCount: payload.unresolvedDriftSignalCount,
            incidentOutcomeCount: payload.incidentOutcomeCount,
            unresolvedIncidentOutcomeCount: payload.unresolvedIncidentOutcomeCount,
            governanceExceptionCount: payload.governanceExceptionCount,
            unresolvedGovernanceExceptionCount: payload.unresolvedGovernanceExceptionCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!observationGovernance) {
        throw new VisitWorkspaceNotFoundError("Timeline rollout observation governance could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: observationGovernance.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_observation_governance.review",
        entityType: "visit_longitudinal_timeline_rollout_observation_governance_review",
        entityId: observationGovernance.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          observationGovernanceStatus: observationGovernance.status,
          postValidationMonitoringStatus: observationGovernance.postValidationMonitoringStatus,
          clinicalValidationStatus: observationGovernance.clinicalValidationStatus,
          validationStatus: observationGovernance.validationStatus,
          rolloutStatus: observationGovernance.rolloutStatus,
          sopStatus: observationGovernance.sopStatus,
          evidenceStatus: observationGovernance.evidenceStatus,
          monitoringStatus: observationGovernance.monitoringStatus,
          incidentProcedureStatus: observationGovernance.incidentProcedureStatus,
          realDatasetTimelineCount: Number(observationGovernance.realDatasetTimelineCount ?? 0),
          postValidationSampleCount: Number(observationGovernance.postValidationSampleCount ?? 0),
          observedTimelineCount: Number(observationGovernance.observedTimelineCount ?? 0),
          expectedFollowupCount: Number(observationGovernance.expectedFollowupCount ?? 0),
          completedFollowupCount: Number(observationGovernance.completedFollowupCount ?? 0),
          driftSignalCount: Number(observationGovernance.driftSignalCount ?? 0),
          unresolvedDriftSignalCount: Number(observationGovernance.unresolvedDriftSignalCount ?? 0),
          incidentOutcomeCount: Number(observationGovernance.incidentOutcomeCount ?? 0),
          unresolvedIncidentOutcomeCount: Number(observationGovernance.unresolvedIncidentOutcomeCount ?? 0),
          governanceExceptionCount: Number(observationGovernance.governanceExceptionCount ?? 0),
          unresolvedGovernanceExceptionCount: Number(observationGovernance.unresolvedGovernanceExceptionCount ?? 0),
          blockerCount: Number(observationGovernance.blockerCount ?? 0),
          lesionCount: Number(observationGovernance.lesionCount ?? 0),
          readyTimelineCount: Number(observationGovernance.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(observationGovernance.blockedTimelineCount ?? 0),
          candidatePairCount: Number(observationGovernance.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(observationGovernance.reviewerWorkflowReadyCount ?? 0),
          observationChecklistReady,
          aggregateObservationGovernanceReady,
          reasonsCount: observationGovernance.reasons?.length ?? 0,
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
        },
      });
      return { observationGovernance, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutExceptionGovernance(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutExceptionGovernancePayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionChecklistReady = [
        payload.exceptionRegisterStatus,
        payload.triageSlaStatus,
        payload.resolutionEvidenceStatus,
        payload.recurrenceReviewStatus,
        payload.rollbackReadinessStatus,
        payload.governanceArchiveStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateExceptionGovernanceReady =
        payload.realDatasetTimelineCount > 0
        && payload.observedTimelineCount > 0
        && payload.resolvedGovernanceExceptionCount >= payload.governanceExceptionCount
        && payload.unresolvedGovernanceExceptionCount === 0
        && payload.unresolvedRecurrenceSignalCount === 0
        && payload.rollbackDrillCount > 0
        && payload.blockerCount === 0;
      const exceptionGovernanceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionChecklistReady
        && aggregateExceptionGovernanceReady;
      const effectiveStatus =
        payload.exceptionGovernanceStatus === "ready_for_exception_governance"
          && !exceptionGovernanceReady
          ? "in_review"
          : payload.exceptionGovernanceStatus;
      const effectiveReasons = [
        ...payload.exceptionGovernanceReasons,
        ...(payload.exceptionGovernanceStatus === "ready_for_exception_governance"
          && !exceptionGovernanceReady
          ? ["timeline_rollout_exception_governance_not_ready"]
          : []),
      ];
      const exceptionGovernance =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutExceptionGovernance({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          exceptionGovernance: {
            exceptionGovernanceStatus: effectiveStatus,
            exceptionGovernanceReasons: effectiveReasons,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            exceptionRegisterStatus: payload.exceptionRegisterStatus,
            triageSlaStatus: payload.triageSlaStatus,
            resolutionEvidenceStatus: payload.resolutionEvidenceStatus,
            recurrenceReviewStatus: payload.recurrenceReviewStatus,
            rollbackReadinessStatus: payload.rollbackReadinessStatus,
            governanceArchiveStatus: payload.governanceArchiveStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realDatasetTimelineCount: payload.realDatasetTimelineCount,
            observedTimelineCount: payload.observedTimelineCount,
            governanceExceptionCount: payload.governanceExceptionCount,
            resolvedGovernanceExceptionCount: payload.resolvedGovernanceExceptionCount,
            unresolvedGovernanceExceptionCount: payload.unresolvedGovernanceExceptionCount,
            recurrenceSignalCount: payload.recurrenceSignalCount,
            unresolvedRecurrenceSignalCount: payload.unresolvedRecurrenceSignalCount,
            rollbackDrillCount: payload.rollbackDrillCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!exceptionGovernance) {
        throw new VisitWorkspaceNotFoundError("Timeline rollout exception governance could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: exceptionGovernance.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_exception_governance.review",
        entityType: "visit_longitudinal_timeline_rollout_exception_governance_review",
        entityId: exceptionGovernance.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          exceptionGovernanceStatus: exceptionGovernance.status,
          observationGovernanceStatus: exceptionGovernance.observationGovernanceStatus,
          postValidationMonitoringStatus: exceptionGovernance.postValidationMonitoringStatus,
          clinicalValidationStatus: exceptionGovernance.clinicalValidationStatus,
          validationStatus: exceptionGovernance.validationStatus,
          rolloutStatus: exceptionGovernance.rolloutStatus,
          sopStatus: exceptionGovernance.sopStatus,
          evidenceStatus: exceptionGovernance.evidenceStatus,
          monitoringStatus: exceptionGovernance.monitoringStatus,
          incidentProcedureStatus: exceptionGovernance.incidentProcedureStatus,
          realDatasetTimelineCount: Number(exceptionGovernance.realDatasetTimelineCount ?? 0),
          observedTimelineCount: Number(exceptionGovernance.observedTimelineCount ?? 0),
          governanceExceptionCount: Number(exceptionGovernance.governanceExceptionCount ?? 0),
          resolvedGovernanceExceptionCount: Number(exceptionGovernance.resolvedGovernanceExceptionCount ?? 0),
          unresolvedGovernanceExceptionCount: Number(exceptionGovernance.unresolvedGovernanceExceptionCount ?? 0),
          recurrenceSignalCount: Number(exceptionGovernance.recurrenceSignalCount ?? 0),
          unresolvedRecurrenceSignalCount: Number(exceptionGovernance.unresolvedRecurrenceSignalCount ?? 0),
          rollbackDrillCount: Number(exceptionGovernance.rollbackDrillCount ?? 0),
          blockerCount: Number(exceptionGovernance.blockerCount ?? 0),
          lesionCount: Number(exceptionGovernance.lesionCount ?? 0),
          readyTimelineCount: Number(exceptionGovernance.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(exceptionGovernance.blockedTimelineCount ?? 0),
          candidatePairCount: Number(exceptionGovernance.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(exceptionGovernance.reviewerWorkflowReadyCount ?? 0),
          exceptionChecklistReady,
          aggregateExceptionGovernanceReady,
          reasonsCount: exceptionGovernance.reasons?.length ?? 0,
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
        },
      });
      return { exceptionGovernance, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutOutcomeGovernance(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutOutcomeGovernancePayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeChecklistReady = [
        payload.longitudinalWindowStatus,
        payload.realDatasetCoverageStatus,
        payload.reviewerOperationsValidationStatus,
        payload.exceptionTrendReviewStatus,
        payload.followupCadenceStatus,
        payload.governanceCadenceStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateOutcomeGovernanceReady =
        payload.realDatasetTimelineCount > 0
        && payload.observedTimelineCount > 0
        && payload.followupWindowCount > 0
        && payload.completedFollowupCount >= payload.followupWindowCount
        && payload.unresolvedGovernanceExceptionCount === 0
        && payload.unresolvedRecurrenceSignalCount === 0
        && payload.governanceReviewCount > 0
        && payload.blockerCount === 0;
      const outcomeGovernanceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeChecklistReady
        && aggregateOutcomeGovernanceReady;
      const effectiveStatus =
        payload.outcomeGovernanceStatus === "ready_for_outcome_governance"
          && !outcomeGovernanceReady
          ? "in_review"
          : payload.outcomeGovernanceStatus;
      const effectiveReasons = [
        ...payload.outcomeGovernanceReasons,
        ...(payload.outcomeGovernanceStatus === "ready_for_outcome_governance"
          && !outcomeGovernanceReady
          ? ["timeline_rollout_outcome_governance_not_ready"]
          : []),
      ];
      const outcomeGovernance =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutOutcomeGovernance({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          outcomeGovernance: {
            outcomeGovernanceStatus: effectiveStatus,
            outcomeGovernanceReasons: effectiveReasons,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            longitudinalWindowStatus: payload.longitudinalWindowStatus,
            realDatasetCoverageStatus: payload.realDatasetCoverageStatus,
            reviewerOperationsValidationStatus: payload.reviewerOperationsValidationStatus,
            exceptionTrendReviewStatus: payload.exceptionTrendReviewStatus,
            followupCadenceStatus: payload.followupCadenceStatus,
            governanceCadenceStatus: payload.governanceCadenceStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realDatasetTimelineCount: payload.realDatasetTimelineCount,
            observedTimelineCount: payload.observedTimelineCount,
            followupWindowCount: payload.followupWindowCount,
            completedFollowupCount: payload.completedFollowupCount,
            governanceExceptionCount: payload.governanceExceptionCount,
            unresolvedGovernanceExceptionCount: payload.unresolvedGovernanceExceptionCount,
            recurrenceSignalCount: payload.recurrenceSignalCount,
            unresolvedRecurrenceSignalCount: payload.unresolvedRecurrenceSignalCount,
            governanceReviewCount: payload.governanceReviewCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!outcomeGovernance) {
        throw new VisitWorkspaceNotFoundError("Timeline rollout outcome governance could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: outcomeGovernance.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_outcome_governance.review",
        entityType: "visit_longitudinal_timeline_rollout_outcome_governance_review",
        entityId: outcomeGovernance.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          outcomeGovernanceStatus: outcomeGovernance.status,
          exceptionGovernanceStatus: outcomeGovernance.exceptionGovernanceStatus,
          observationGovernanceStatus: outcomeGovernance.observationGovernanceStatus,
          postValidationMonitoringStatus: outcomeGovernance.postValidationMonitoringStatus,
          clinicalValidationStatus: outcomeGovernance.clinicalValidationStatus,
          validationStatus: outcomeGovernance.validationStatus,
          rolloutStatus: outcomeGovernance.rolloutStatus,
          sopStatus: outcomeGovernance.sopStatus,
          evidenceStatus: outcomeGovernance.evidenceStatus,
          monitoringStatus: outcomeGovernance.monitoringStatus,
          incidentProcedureStatus: outcomeGovernance.incidentProcedureStatus,
          realDatasetTimelineCount: Number(outcomeGovernance.realDatasetTimelineCount ?? 0),
          observedTimelineCount: Number(outcomeGovernance.observedTimelineCount ?? 0),
          followupWindowCount: Number(outcomeGovernance.followupWindowCount ?? 0),
          completedFollowupCount: Number(outcomeGovernance.completedFollowupCount ?? 0),
          governanceExceptionCount: Number(outcomeGovernance.governanceExceptionCount ?? 0),
          unresolvedGovernanceExceptionCount: Number(outcomeGovernance.unresolvedGovernanceExceptionCount ?? 0),
          recurrenceSignalCount: Number(outcomeGovernance.recurrenceSignalCount ?? 0),
          unresolvedRecurrenceSignalCount: Number(outcomeGovernance.unresolvedRecurrenceSignalCount ?? 0),
          governanceReviewCount: Number(outcomeGovernance.governanceReviewCount ?? 0),
          blockerCount: Number(outcomeGovernance.blockerCount ?? 0),
          lesionCount: Number(outcomeGovernance.lesionCount ?? 0),
          readyTimelineCount: Number(outcomeGovernance.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(outcomeGovernance.blockedTimelineCount ?? 0),
          candidatePairCount: Number(outcomeGovernance.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(outcomeGovernance.reviewerWorkflowReadyCount ?? 0),
          outcomeChecklistReady,
          aggregateOutcomeGovernanceReady,
          reasonsCount: outcomeGovernance.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawLongitudinalOutcomeLogsExposed: false,
          rawGovernancePayloadsExposed: false,
        },
      });
      return { outcomeGovernance, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutLongitudinalClinicalValidationPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const validationChecklistReady = [
        payload.outcomeWindowStatus,
        payload.clinicianCoverageStatus,
        payload.adjudicationStatus,
        payload.consensusReviewStatus,
        payload.followupValidationStatus,
        payload.governanceCadenceStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateValidationReady =
        payload.realOutcomeWindowCount > 0
        && payload.clinicallyValidatedWindowCount > 0
        && payload.adjudicatedWindowCount > 0
        && payload.followupValidatedWindowCount > 0
        && payload.consensusReviewCount > 0
        && payload.unresolvedConsensusCaseCount === 0
        && payload.governanceReviewCount > 0
        && payload.blockerCount === 0;
      const longitudinalClinicalValidationReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && validationChecklistReady
        && aggregateValidationReady;
      const effectiveStatus =
        payload.longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
          && !longitudinalClinicalValidationReady
          ? "in_review"
          : payload.longitudinalClinicalValidationStatus;
      const effectiveReasons = [
        ...payload.longitudinalClinicalValidationReasons,
        ...(payload.longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
          && !longitudinalClinicalValidationReady
          ? ["timeline_rollout_longitudinal_clinical_validation_not_ready"]
          : []),
      ];
      const longitudinalClinicalValidation =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutLongitudinalClinicalValidation({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          longitudinalClinicalValidation: {
            longitudinalClinicalValidationStatus: effectiveStatus,
            longitudinalClinicalValidationReasons: effectiveReasons,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            outcomeWindowStatus: payload.outcomeWindowStatus,
            clinicianCoverageStatus: payload.clinicianCoverageStatus,
            adjudicationStatus: payload.adjudicationStatus,
            consensusReviewStatus: payload.consensusReviewStatus,
            followupValidationStatus: payload.followupValidationStatus,
            governanceCadenceStatus: payload.governanceCadenceStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realOutcomeWindowCount: payload.realOutcomeWindowCount,
            clinicallyValidatedWindowCount: payload.clinicallyValidatedWindowCount,
            adjudicatedWindowCount: payload.adjudicatedWindowCount,
            followupValidatedWindowCount: payload.followupValidatedWindowCount,
            consensusReviewCount: payload.consensusReviewCount,
            unresolvedConsensusCaseCount: payload.unresolvedConsensusCaseCount,
            governanceReviewCount: payload.governanceReviewCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!longitudinalClinicalValidation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal clinical validation could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: longitudinalClinicalValidation.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_longitudinal_clinical_validation.review",
        entityType: "visit_longitudinal_timeline_rollout_longitudinal_clinical_validation_review",
        entityId: longitudinalClinicalValidation.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          longitudinalClinicalValidationStatus: longitudinalClinicalValidation.status,
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
          realOutcomeWindowCount: Number(longitudinalClinicalValidation.realOutcomeWindowCount ?? 0),
          clinicallyValidatedWindowCount: Number(longitudinalClinicalValidation.clinicallyValidatedWindowCount ?? 0),
          adjudicatedWindowCount: Number(longitudinalClinicalValidation.adjudicatedWindowCount ?? 0),
          followupValidatedWindowCount: Number(longitudinalClinicalValidation.followupValidatedWindowCount ?? 0),
          consensusReviewCount: Number(longitudinalClinicalValidation.consensusReviewCount ?? 0),
          unresolvedConsensusCaseCount: Number(longitudinalClinicalValidation.unresolvedConsensusCaseCount ?? 0),
          governanceReviewCount: Number(longitudinalClinicalValidation.governanceReviewCount ?? 0),
          blockerCount: Number(longitudinalClinicalValidation.blockerCount ?? 0),
          lesionCount: Number(longitudinalClinicalValidation.lesionCount ?? 0),
          readyTimelineCount: Number(longitudinalClinicalValidation.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(longitudinalClinicalValidation.blockedTimelineCount ?? 0),
          candidatePairCount: Number(longitudinalClinicalValidation.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(longitudinalClinicalValidation.reviewerWorkflowReadyCount ?? 0),
          validationChecklistReady,
          aggregateValidationReady,
          reasonsCount: longitudinalClinicalValidation.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawLongitudinalClinicalValidationLogsExposed: false,
          rawAdjudicationPayloadsExposed: false,
        },
      });
      return { longitudinalClinicalValidation, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerValidation(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeVisitLongitudinalTimelineRolloutProtectedReviewerValidationPayload(input);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validation = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!validation) {
        throw new VisitWorkspaceNotFoundError("Longitudinal dataset validation was not found in the allowed clinic scope.");
      }
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const validationChecklistReady = [
        payload.protectedAssetWindowStatus,
        payload.protectedRenderStatus,
        payload.reviewerAssignmentStatus,
        payload.secondReviewStatus,
        payload.adjudicationOpsStatus,
        payload.followupOpsStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateValidationReady =
        payload.protectedAssetTimelineCount > 0
        && payload.protectedRenderReadyCount > 0
        && payload.reviewerAssignedProtectedCount > 0
        && payload.secondReviewedProtectedCount > 0
        && payload.adjudicatedProtectedCount > 0
        && payload.followupValidatedProtectedCount > 0
        && payload.unresolvedProtectedReviewCount === 0
        && payload.blockerCount === 0;
      const protectedReviewerValidationReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && validationChecklistReady
        && aggregateValidationReady;
      const effectiveStatus =
        payload.protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
          && !protectedReviewerValidationReady
          ? "in_review"
          : payload.protectedReviewerValidationStatus;
      const effectiveReasons = [
        ...payload.protectedReviewerValidationReasons,
        ...(payload.protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
          && !protectedReviewerValidationReady
          ? ["timeline_rollout_protected_reviewer_validation_not_ready"]
          : []),
      ];
      const protectedReviewerValidation =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProtectedReviewerValidation({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          protectedReviewerValidation: {
            protectedReviewerValidationStatus: effectiveStatus,
            protectedReviewerValidationReasons: effectiveReasons,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            protectedAssetWindowStatus: payload.protectedAssetWindowStatus,
            protectedRenderStatus: payload.protectedRenderStatus,
            reviewerAssignmentStatus: payload.reviewerAssignmentStatus,
            secondReviewStatus: payload.secondReviewStatus,
            adjudicationOpsStatus: payload.adjudicationOpsStatus,
            followupOpsStatus: payload.followupOpsStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            protectedAssetTimelineCount: payload.protectedAssetTimelineCount,
            protectedRenderReadyCount: payload.protectedRenderReadyCount,
            reviewerAssignedProtectedCount: payload.reviewerAssignedProtectedCount,
            secondReviewedProtectedCount: payload.secondReviewedProtectedCount,
            adjudicatedProtectedCount: payload.adjudicatedProtectedCount,
            followupValidatedProtectedCount: payload.followupValidatedProtectedCount,
            unresolvedProtectedReviewCount: payload.unresolvedProtectedReviewCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!protectedReviewerValidation) {
        throw new VisitWorkspaceNotFoundError("Protected reviewer validation could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: protectedReviewerValidation.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_protected_reviewer_validation.review",
        entityType: "visit_longitudinal_timeline_rollout_protected_reviewer_validation_review",
        entityId: protectedReviewerValidation.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          protectedReviewerValidationStatus: protectedReviewerValidation.status,
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
          protectedAssetTimelineCount: Number(protectedReviewerValidation.protectedAssetTimelineCount ?? 0),
          protectedRenderReadyCount: Number(protectedReviewerValidation.protectedRenderReadyCount ?? 0),
          reviewerAssignedProtectedCount: Number(protectedReviewerValidation.reviewerAssignedProtectedCount ?? 0),
          secondReviewedProtectedCount: Number(protectedReviewerValidation.secondReviewedProtectedCount ?? 0),
          adjudicatedProtectedCount: Number(protectedReviewerValidation.adjudicatedProtectedCount ?? 0),
          followupValidatedProtectedCount: Number(protectedReviewerValidation.followupValidatedProtectedCount ?? 0),
          unresolvedProtectedReviewCount: Number(protectedReviewerValidation.unresolvedProtectedReviewCount ?? 0),
          blockerCount: Number(protectedReviewerValidation.blockerCount ?? 0),
          lesionCount: Number(protectedReviewerValidation.lesionCount ?? 0),
          readyTimelineCount: Number(protectedReviewerValidation.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(protectedReviewerValidation.blockedTimelineCount ?? 0),
          candidatePairCount: Number(protectedReviewerValidation.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(protectedReviewerValidation.reviewerWorkflowReadyCount ?? 0),
          validationChecklistReady,
          aggregateValidationReady,
          reasonsCount: protectedReviewerValidation.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawProtectedReviewerLogsExposed: false,
          rawProtectedReviewerPayloadsExposed: false,
        },
      });
      return { protectedReviewerValidation, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernance(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProtectedReviewerGovernancePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const protectedReviewerValidationStatus = String(
        protectedReviewerValidation.status ?? "not_started",
      );
      const validationChecklistReady = [
        payload.reviewerMonitoringStatus,
        payload.reviewerExceptionStatus,
        payload.reviewerAdjudicationStatus,
        payload.reviewerFollowupStatus,
        payload.reviewerRollbackStatus,
        payload.reviewerArchiveStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateValidationReady =
        payload.protectedReviewWindowCount > 0
        && payload.monitoredProtectedReviewCount > 0
        && payload.escalatedProtectedReviewCount > 0
        && payload.adjudicatedProtectedGovernanceCount > 0
        && payload.followupClosedProtectedCount > 0
        && payload.rollbackReadyProtectedCount > 0
        && payload.archivedProtectedReviewCount > 0
        && payload.unresolvedGovernanceReviewCount === 0
        && payload.blockerCount === 0;
      const protectedReviewerGovernanceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
        && validationChecklistReady
        && aggregateValidationReady;
      const effectiveStatus =
        payload.protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
          && !protectedReviewerGovernanceReady
          ? "in_review"
          : payload.protectedReviewerGovernanceStatus;
      const effectiveReasons = [
        ...payload.protectedReviewerGovernanceReasons,
        ...(payload.protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
          && !protectedReviewerGovernanceReady
          ? ["timeline_rollout_protected_reviewer_governance_not_ready"]
          : []),
      ];
      const protectedReviewerGovernance =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProtectedReviewerGovernance({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          protectedReviewerGovernance: {
            protectedReviewerGovernanceStatus: effectiveStatus,
            protectedReviewerGovernanceReasons: effectiveReasons,
            protectedReviewerValidationStatus,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            reviewerMonitoringStatus: payload.reviewerMonitoringStatus,
            reviewerExceptionStatus: payload.reviewerExceptionStatus,
            reviewerAdjudicationStatus: payload.reviewerAdjudicationStatus,
            reviewerFollowupStatus: payload.reviewerFollowupStatus,
            reviewerRollbackStatus: payload.reviewerRollbackStatus,
            reviewerArchiveStatus: payload.reviewerArchiveStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            protectedReviewWindowCount: payload.protectedReviewWindowCount,
            monitoredProtectedReviewCount: payload.monitoredProtectedReviewCount,
            escalatedProtectedReviewCount: payload.escalatedProtectedReviewCount,
            adjudicatedProtectedGovernanceCount: payload.adjudicatedProtectedGovernanceCount,
            followupClosedProtectedCount: payload.followupClosedProtectedCount,
            rollbackReadyProtectedCount: payload.rollbackReadyProtectedCount,
            archivedProtectedReviewCount: payload.archivedProtectedReviewCount,
            unresolvedGovernanceReviewCount: payload.unresolvedGovernanceReviewCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!protectedReviewerGovernance) {
        throw new VisitWorkspaceNotFoundError("Protected reviewer governance could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: protectedReviewerGovernance.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_protected_reviewer_governance.review",
        entityType: "visit_longitudinal_timeline_rollout_protected_reviewer_governance_review",
        entityId: protectedReviewerGovernance.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          protectedReviewerGovernanceStatus: protectedReviewerGovernance.status,
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
          protectedReviewWindowCount: Number(protectedReviewerGovernance.protectedReviewWindowCount ?? 0),
          monitoredProtectedReviewCount: Number(protectedReviewerGovernance.monitoredProtectedReviewCount ?? 0),
          escalatedProtectedReviewCount: Number(protectedReviewerGovernance.escalatedProtectedReviewCount ?? 0),
          adjudicatedProtectedGovernanceCount: Number(protectedReviewerGovernance.adjudicatedProtectedGovernanceCount ?? 0),
          followupClosedProtectedCount: Number(protectedReviewerGovernance.followupClosedProtectedCount ?? 0),
          rollbackReadyProtectedCount: Number(protectedReviewerGovernance.rollbackReadyProtectedCount ?? 0),
          archivedProtectedReviewCount: Number(protectedReviewerGovernance.archivedProtectedReviewCount ?? 0),
          unresolvedGovernanceReviewCount: Number(protectedReviewerGovernance.unresolvedGovernanceReviewCount ?? 0),
          blockerCount: Number(protectedReviewerGovernance.blockerCount ?? 0),
          lesionCount: Number(protectedReviewerGovernance.lesionCount ?? 0),
          readyTimelineCount: Number(protectedReviewerGovernance.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(protectedReviewerGovernance.blockedTimelineCount ?? 0),
          candidatePairCount: Number(protectedReviewerGovernance.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(protectedReviewerGovernance.reviewerWorkflowReadyCount ?? 0),
          validationChecklistReady,
          aggregateValidationReady,
          reasonsCount: protectedReviewerGovernance.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawProtectedReviewerLogsExposed: false,
          rawProtectedReviewerPayloadsExposed: false,
        },
      });
      return { protectedReviewerGovernance, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidence(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProtectedReviewerEvidencePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation || {};
      const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const protectedReviewerValidationStatus = String(
        protectedReviewerValidation.status ?? "not_started",
      );
      const protectedReviewerGovernanceStatus = String(
        protectedReviewerGovernance.status ?? "not_started",
      );
      const validationChecklistReady = [
        payload.reviewerMonitoringEvidenceStatus,
        payload.reviewerExceptionEvidenceStatus,
        payload.reviewerAdjudicationEvidenceStatus,
        payload.reviewerFollowupEvidenceStatus,
        payload.reviewerRollbackEvidenceStatus,
        payload.reviewerArchiveEvidenceStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateValidationReady =
        payload.protectedReviewWindowCount > 0
        && payload.monitoredProtectedReviewCount > 0
        && payload.sampledProtectedReviewCount > 0
        && payload.adjudicatedProtectedEvidenceCount > 0
        && payload.followupClosedProtectedCount > 0
        && payload.rollbackDrillProtectedCount > 0
        && payload.archivedProtectedReviewCount > 0
        && payload.unresolvedProtectedEvidenceCount === 0
        && payload.blockerCount === 0;
      const protectedReviewerEvidenceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
        && protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
        && validationChecklistReady
        && aggregateValidationReady;
      const effectiveStatus =
        payload.protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence"
          && !protectedReviewerEvidenceReady
          ? "in_review"
          : payload.protectedReviewerEvidenceStatus;
      const effectiveReasons = [
        ...payload.protectedReviewerEvidenceReasons,
        ...(payload.protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence"
          && !protectedReviewerEvidenceReady
          ? ["timeline_rollout_protected_reviewer_evidence_not_ready"]
          : []),
      ];
      const protectedReviewerEvidence =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProtectedReviewerEvidence({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          protectedReviewerEvidence: {
            protectedReviewerEvidenceStatus: effectiveStatus,
            protectedReviewerEvidenceReasons: effectiveReasons,
            protectedReviewerGovernanceStatus,
            protectedReviewerValidationStatus,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            reviewerMonitoringEvidenceStatus: payload.reviewerMonitoringEvidenceStatus,
            reviewerExceptionEvidenceStatus: payload.reviewerExceptionEvidenceStatus,
            reviewerAdjudicationEvidenceStatus: payload.reviewerAdjudicationEvidenceStatus,
            reviewerFollowupEvidenceStatus: payload.reviewerFollowupEvidenceStatus,
            reviewerRollbackEvidenceStatus: payload.reviewerRollbackEvidenceStatus,
            reviewerArchiveEvidenceStatus: payload.reviewerArchiveEvidenceStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            protectedReviewWindowCount: payload.protectedReviewWindowCount,
            monitoredProtectedReviewCount: payload.monitoredProtectedReviewCount,
            sampledProtectedReviewCount: payload.sampledProtectedReviewCount,
            adjudicatedProtectedEvidenceCount: payload.adjudicatedProtectedEvidenceCount,
            followupClosedProtectedCount: payload.followupClosedProtectedCount,
            rollbackDrillProtectedCount: payload.rollbackDrillProtectedCount,
            archivedProtectedReviewCount: payload.archivedProtectedReviewCount,
            unresolvedProtectedEvidenceCount: payload.unresolvedProtectedEvidenceCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!protectedReviewerEvidence) {
        throw new VisitWorkspaceNotFoundError("Protected reviewer evidence could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: protectedReviewerEvidence.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_protected_reviewer_evidence.review",
        entityType: "visit_longitudinal_timeline_rollout_protected_reviewer_evidence_review",
        entityId: protectedReviewerEvidence.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          protectedReviewerEvidenceStatus: protectedReviewerEvidence.status,
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
          protectedReviewWindowCount: Number(protectedReviewerEvidence.protectedReviewWindowCount ?? 0),
          monitoredProtectedReviewCount: Number(protectedReviewerEvidence.monitoredProtectedReviewCount ?? 0),
          sampledProtectedReviewCount: Number(protectedReviewerEvidence.sampledProtectedReviewCount ?? 0),
          adjudicatedProtectedEvidenceCount: Number(protectedReviewerEvidence.adjudicatedProtectedEvidenceCount ?? 0),
          followupClosedProtectedCount: Number(protectedReviewerEvidence.followupClosedProtectedCount ?? 0),
          rollbackDrillProtectedCount: Number(protectedReviewerEvidence.rollbackDrillProtectedCount ?? 0),
          archivedProtectedReviewCount: Number(protectedReviewerEvidence.archivedProtectedReviewCount ?? 0),
          unresolvedProtectedEvidenceCount: Number(protectedReviewerEvidence.unresolvedProtectedEvidenceCount ?? 0),
          blockerCount: Number(protectedReviewerEvidence.blockerCount ?? 0),
          lesionCount: Number(protectedReviewerEvidence.lesionCount ?? 0),
          readyTimelineCount: Number(protectedReviewerEvidence.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(protectedReviewerEvidence.blockedTimelineCount ?? 0),
          candidatePairCount: Number(protectedReviewerEvidence.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(protectedReviewerEvidence.reviewerWorkflowReadyCount ?? 0),
          validationChecklistReady,
          aggregateValidationReady,
          reasonsCount: protectedReviewerEvidence.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawProtectedReviewerLogsExposed: false,
          rawProtectedReviewerPayloadsExposed: false,
        },
      });
      return { protectedReviewerEvidence, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProductionDatasetEvidence(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProductionDatasetEvidencePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation || {};
      const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance || {};
      const protectedReviewerEvidence = validation.timelineRolloutProtectedReviewerEvidence || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const protectedReviewerValidationStatus = String(
        protectedReviewerValidation.status ?? "not_started",
      );
      const protectedReviewerGovernanceStatus = String(
        protectedReviewerGovernance.status ?? "not_started",
      );
      const protectedReviewerEvidenceStatus = String(protectedReviewerEvidence.status ?? "not_started");
      const validationChecklistReady = [
        payload.realClinicWindowStatus,
        payload.datasetSamplingStatus,
        payload.longitudinalFollowupStatus,
        payload.protectedReviewerLinkageStatus,
        payload.outcomeObservationStatus,
        payload.incidentLinkageStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateValidationReady =
        payload.realClinicWindowCount > 0
        && payload.monitoredClinicOperationCount > 0
        && payload.sampledClinicOperationCount > 0
        && payload.longitudinalFollowupCount > 0
        && payload.protectedReviewerLinkedCount > 0
        && payload.observedOutcomeCount > 0
        && payload.incidentLinkedCount > 0
        && payload.unresolvedProductionDatasetEvidenceCount === 0
        && payload.blockerCount === 0;
      const productionDatasetEvidenceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
        && protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
        && protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence"
        && validationChecklistReady
        && aggregateValidationReady;
      const effectiveStatus =
        payload.productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence"
          && !productionDatasetEvidenceReady
          ? "in_review"
          : payload.productionDatasetEvidenceStatus;
      const effectiveReasons = [
        ...payload.productionDatasetEvidenceReasons,
        ...(payload.productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence"
          && !productionDatasetEvidenceReady
          ? ["timeline_rollout_production_dataset_evidence_not_ready"]
          : []),
      ];
      const productionDatasetEvidence =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProductionDatasetEvidence({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          productionDatasetEvidence: {
            productionDatasetEvidenceStatus: effectiveStatus,
            productionDatasetEvidenceReasons: effectiveReasons,
            protectedReviewerEvidenceStatus,
            protectedReviewerGovernanceStatus,
            protectedReviewerValidationStatus,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            realClinicWindowStatus: payload.realClinicWindowStatus,
            datasetSamplingStatus: payload.datasetSamplingStatus,
            longitudinalFollowupStatus: payload.longitudinalFollowupStatus,
            protectedReviewerLinkageStatus: payload.protectedReviewerLinkageStatus,
            outcomeObservationStatus: payload.outcomeObservationStatus,
            incidentLinkageStatus: payload.incidentLinkageStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            realClinicWindowCount: payload.realClinicWindowCount,
            monitoredClinicOperationCount: payload.monitoredClinicOperationCount,
            sampledClinicOperationCount: payload.sampledClinicOperationCount,
            longitudinalFollowupCount: payload.longitudinalFollowupCount,
            protectedReviewerLinkedCount: payload.protectedReviewerLinkedCount,
            observedOutcomeCount: payload.observedOutcomeCount,
            incidentLinkedCount: payload.incidentLinkedCount,
            unresolvedProductionDatasetEvidenceCount: payload.unresolvedProductionDatasetEvidenceCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!productionDatasetEvidence) {
        throw new VisitWorkspaceNotFoundError("Production dataset evidence could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: productionDatasetEvidence.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_production_dataset_evidence.review",
        entityType: "visit_longitudinal_timeline_rollout_production_dataset_evidence_review",
        entityId: productionDatasetEvidence.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          productionDatasetEvidenceStatus: productionDatasetEvidence.status,
          protectedReviewerEvidenceStatus: productionDatasetEvidence.protectedReviewerEvidenceStatus,
          protectedReviewerGovernanceStatus: productionDatasetEvidence.protectedReviewerGovernanceStatus,
          protectedReviewerValidationStatus: productionDatasetEvidence.protectedReviewerValidationStatus,
          longitudinalClinicalValidationStatus: productionDatasetEvidence.longitudinalClinicalValidationStatus,
          outcomeGovernanceStatus: productionDatasetEvidence.outcomeGovernanceStatus,
          exceptionGovernanceStatus: productionDatasetEvidence.exceptionGovernanceStatus,
          observationGovernanceStatus: productionDatasetEvidence.observationGovernanceStatus,
          postValidationMonitoringStatus: productionDatasetEvidence.postValidationMonitoringStatus,
          clinicalValidationStatus: productionDatasetEvidence.clinicalValidationStatus,
          incidentProcedureStatus: productionDatasetEvidence.incidentProcedureStatus,
          monitoringStatus: productionDatasetEvidence.monitoringStatus,
          evidenceStatus: productionDatasetEvidence.evidenceStatus,
          sopStatus: productionDatasetEvidence.sopStatus,
          validationStatus: productionDatasetEvidence.validationStatus,
          rolloutStatus: productionDatasetEvidence.rolloutStatus,
          realClinicWindowCount: Number(productionDatasetEvidence.realClinicWindowCount ?? 0),
          monitoredClinicOperationCount: Number(productionDatasetEvidence.monitoredClinicOperationCount ?? 0),
          sampledClinicOperationCount: Number(productionDatasetEvidence.sampledClinicOperationCount ?? 0),
          longitudinalFollowupCount: Number(productionDatasetEvidence.longitudinalFollowupCount ?? 0),
          protectedReviewerLinkedCount: Number(productionDatasetEvidence.protectedReviewerLinkedCount ?? 0),
          observedOutcomeCount: Number(productionDatasetEvidence.observedOutcomeCount ?? 0),
          incidentLinkedCount: Number(productionDatasetEvidence.incidentLinkedCount ?? 0),
          unresolvedProductionDatasetEvidenceCount: Number(
            productionDatasetEvidence.unresolvedProductionDatasetEvidenceCount ?? 0,
          ),
          blockerCount: Number(productionDatasetEvidence.blockerCount ?? 0),
          lesionCount: Number(productionDatasetEvidence.lesionCount ?? 0),
          readyTimelineCount: Number(productionDatasetEvidence.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(productionDatasetEvidence.blockedTimelineCount ?? 0),
          candidatePairCount: Number(productionDatasetEvidence.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(productionDatasetEvidence.reviewerWorkflowReadyCount ?? 0),
          validationChecklistReady,
          aggregateValidationReady,
          reasonsCount: productionDatasetEvidence.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          rawProductionDatasetLogsExposed: false,
          rawProductionDatasetPayloadsExposed: false,
        },
      });
      return { productionDatasetEvidence, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProductionReviewerRollbackEvidence(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProductionReviewerRollbackEvidencePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence || {};
      const productionDatasetEvidenceStatus = String(productionDatasetEvidence.status ?? "not_started");
      const rollbackChecklistReady = [
        payload.rollbackDrillStatus,
        payload.rollbackOwnerStatus,
        payload.rollbackWindowStatus,
        payload.rollbackExceptionStatus,
        payload.rollbackArchiveStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateRollbackEvidenceReady =
        payload.productionReviewWindowCount > 0
        && payload.rollbackDrillProductionCount > 0
        && payload.rollbackReadyProductionCount > 0
        && payload.unresolvedRollbackEvidenceCount === 0
        && payload.blockerCount === 0;
      const productionReviewerRollbackEvidenceReady =
        productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence"
        && rollbackChecklistReady
        && aggregateRollbackEvidenceReady;
      const effectiveStatus =
        payload.productionReviewerRollbackEvidenceStatus
          === "ready_for_production_reviewer_rollback_evidence"
          && !productionReviewerRollbackEvidenceReady
          ? "in_review"
          : payload.productionReviewerRollbackEvidenceStatus;
      const effectiveReasons = [
        ...payload.productionReviewerRollbackEvidenceReasons,
        ...(payload.productionReviewerRollbackEvidenceStatus
          === "ready_for_production_reviewer_rollback_evidence"
          && !productionReviewerRollbackEvidenceReady
          ? ["timeline_rollout_production_reviewer_rollback_evidence_not_ready"]
          : []),
      ];
      const productionReviewerRollbackEvidence =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProductionReviewerRollbackEvidence({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          productionReviewerRollbackEvidence: {
            productionReviewerRollbackEvidenceStatus: effectiveStatus,
            productionReviewerRollbackEvidenceReasons: effectiveReasons,
            productionDatasetEvidenceStatus,
            rollbackDrillStatus: payload.rollbackDrillStatus,
            rollbackOwnerStatus: payload.rollbackOwnerStatus,
            rollbackWindowStatus: payload.rollbackWindowStatus,
            rollbackExceptionStatus: payload.rollbackExceptionStatus,
            rollbackArchiveStatus: payload.rollbackArchiveStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            productionReviewWindowCount: payload.productionReviewWindowCount,
            rollbackDrillProductionCount: payload.rollbackDrillProductionCount,
            rollbackReadyProductionCount: payload.rollbackReadyProductionCount,
            rollbackExceptionCount: payload.rollbackExceptionCount,
            unresolvedRollbackEvidenceCount: payload.unresolvedRollbackEvidenceCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!productionReviewerRollbackEvidence) {
        throw new VisitWorkspaceNotFoundError("Production reviewer rollback evidence could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: productionReviewerRollbackEvidence.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence.review",
        entityType: "visit_longitudinal_timeline_rollout_production_reviewer_rollback_evidence_review",
        entityId: productionReviewerRollbackEvidence.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          productionReviewerRollbackEvidenceStatus: productionReviewerRollbackEvidence.status,
          productionDatasetEvidenceStatus: productionReviewerRollbackEvidence.productionDatasetEvidenceStatus,
          productionReviewWindowCount: Number(
            productionReviewerRollbackEvidence.productionReviewWindowCount ?? 0,
          ),
          rollbackDrillProductionCount: Number(
            productionReviewerRollbackEvidence.rollbackDrillProductionCount ?? 0,
          ),
          rollbackReadyProductionCount: Number(
            productionReviewerRollbackEvidence.rollbackReadyProductionCount ?? 0,
          ),
          rollbackExceptionCount: Number(productionReviewerRollbackEvidence.rollbackExceptionCount ?? 0),
          unresolvedRollbackEvidenceCount: Number(
            productionReviewerRollbackEvidence.unresolvedRollbackEvidenceCount ?? 0,
          ),
          blockerCount: Number(productionReviewerRollbackEvidence.blockerCount ?? 0),
          lesionCount: Number(productionReviewerRollbackEvidence.lesionCount ?? 0),
          readyTimelineCount: Number(productionReviewerRollbackEvidence.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(productionReviewerRollbackEvidence.blockedTimelineCount ?? 0),
          candidatePairCount: Number(productionReviewerRollbackEvidence.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(
            productionReviewerRollbackEvidence.reviewerWorkflowReadyCount ?? 0,
          ),
          rollbackChecklistReady,
          aggregateRollbackEvidenceReady,
          reasonsCount: productionReviewerRollbackEvidence.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          reviewerIdentityExposed: false,
          rawProductionReviewerRollbackEvidenceLogsExposed: false,
          rawProductionReviewerRollbackEvidencePayloadsExposed: false,
        },
      });
      return { productionReviewerRollbackEvidence, scope };
    },

    async reviewVisitLongitudinalTimelineRolloutProductionReviewerGovernance(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProductionReviewerGovernancePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation || {};
      const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance || {};
      const protectedReviewerEvidence = validation.timelineRolloutProtectedReviewerEvidence || {};
      const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const protectedReviewerValidationStatus = String(
        protectedReviewerValidation.status ?? "not_started",
      );
      const protectedReviewerGovernanceStatus = String(
        protectedReviewerGovernance.status ?? "not_started",
      );
      const protectedReviewerEvidenceStatus = String(protectedReviewerEvidence.status ?? "not_started");
      const productionDatasetEvidenceStatus = String(productionDatasetEvidence.status ?? "not_started");
      const governanceChecklistReady = [
        payload.productionReviewerAssignmentStatus,
        payload.productionSecondReviewStatus,
        payload.productionAdjudicationStatus,
        payload.productionFollowupStatus,
        payload.productionExceptionStatus,
        payload.productionRollbackStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateGovernanceReady =
        payload.productionReviewWindowCount > 0
        && payload.assignedProductionReviewerCount > 0
        && payload.secondReviewedProductionCount > 0
        && payload.adjudicatedProductionReviewCount > 0
        && payload.followupClosedProductionCount > 0
        && payload.exceptionClosedProductionCount > 0
        && payload.rollbackReadyProductionCount > 0
        && payload.unresolvedProductionReviewerGovernanceCount === 0
        && payload.blockerCount === 0;
      const productionReviewerGovernanceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
        && protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
        && protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence"
        && productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence"
        && governanceChecklistReady
        && aggregateGovernanceReady;
      const effectiveStatus =
        payload.productionReviewerGovernanceStatus === "ready_for_production_reviewer_governance"
          && !productionReviewerGovernanceReady
          ? "in_review"
          : payload.productionReviewerGovernanceStatus;
      const effectiveReasons = [
        ...payload.productionReviewerGovernanceReasons,
        ...(payload.productionReviewerGovernanceStatus === "ready_for_production_reviewer_governance"
          && !productionReviewerGovernanceReady
          ? ["timeline_rollout_production_reviewer_governance_not_ready"]
          : []),
      ];
      const productionReviewerGovernance =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProductionReviewerGovernance({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          productionReviewerGovernance: {
            productionReviewerGovernanceStatus: effectiveStatus,
            productionReviewerGovernanceReasons: effectiveReasons,
            productionDatasetEvidenceStatus,
            protectedReviewerEvidenceStatus,
            protectedReviewerGovernanceStatus,
            protectedReviewerValidationStatus,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            productionReviewerAssignmentStatus: payload.productionReviewerAssignmentStatus,
            productionSecondReviewStatus: payload.productionSecondReviewStatus,
            productionAdjudicationStatus: payload.productionAdjudicationStatus,
            productionFollowupStatus: payload.productionFollowupStatus,
            productionExceptionStatus: payload.productionExceptionStatus,
            productionRollbackStatus: payload.productionRollbackStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            productionReviewWindowCount: payload.productionReviewWindowCount,
            assignedProductionReviewerCount: payload.assignedProductionReviewerCount,
            secondReviewedProductionCount: payload.secondReviewedProductionCount,
            adjudicatedProductionReviewCount: payload.adjudicatedProductionReviewCount,
            followupClosedProductionCount: payload.followupClosedProductionCount,
            exceptionClosedProductionCount: payload.exceptionClosedProductionCount,
            rollbackReadyProductionCount: payload.rollbackReadyProductionCount,
            unresolvedProductionReviewerGovernanceCount: payload.unresolvedProductionReviewerGovernanceCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!productionReviewerGovernance) {
        throw new VisitWorkspaceNotFoundError("Production reviewer governance could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: productionReviewerGovernance.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_production_reviewer_governance.review",
        entityType: "visit_longitudinal_timeline_rollout_production_reviewer_governance_review",
        entityId: productionReviewerGovernance.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          productionReviewerGovernanceStatus: productionReviewerGovernance.status,
          productionDatasetEvidenceStatus: productionReviewerGovernance.productionDatasetEvidenceStatus,
          protectedReviewerEvidenceStatus: productionReviewerGovernance.protectedReviewerEvidenceStatus,
          protectedReviewerGovernanceStatus: productionReviewerGovernance.protectedReviewerGovernanceStatus,
          protectedReviewerValidationStatus: productionReviewerGovernance.protectedReviewerValidationStatus,
          longitudinalClinicalValidationStatus: productionReviewerGovernance.longitudinalClinicalValidationStatus,
          outcomeGovernanceStatus: productionReviewerGovernance.outcomeGovernanceStatus,
          exceptionGovernanceStatus: productionReviewerGovernance.exceptionGovernanceStatus,
          observationGovernanceStatus: productionReviewerGovernance.observationGovernanceStatus,
          postValidationMonitoringStatus: productionReviewerGovernance.postValidationMonitoringStatus,
          clinicalValidationStatus: productionReviewerGovernance.clinicalValidationStatus,
          incidentProcedureStatus: productionReviewerGovernance.incidentProcedureStatus,
          monitoringStatus: productionReviewerGovernance.monitoringStatus,
          evidenceStatus: productionReviewerGovernance.evidenceStatus,
          sopStatus: productionReviewerGovernance.sopStatus,
          validationStatus: productionReviewerGovernance.validationStatus,
          rolloutStatus: productionReviewerGovernance.rolloutStatus,
          productionReviewWindowCount: Number(productionReviewerGovernance.productionReviewWindowCount ?? 0),
          assignedProductionReviewerCount: Number(
            productionReviewerGovernance.assignedProductionReviewerCount ?? 0,
          ),
          secondReviewedProductionCount: Number(
            productionReviewerGovernance.secondReviewedProductionCount ?? 0,
          ),
          adjudicatedProductionReviewCount: Number(
            productionReviewerGovernance.adjudicatedProductionReviewCount ?? 0,
          ),
          followupClosedProductionCount: Number(productionReviewerGovernance.followupClosedProductionCount ?? 0),
          exceptionClosedProductionCount: Number(
            productionReviewerGovernance.exceptionClosedProductionCount ?? 0,
          ),
          rollbackReadyProductionCount: Number(productionReviewerGovernance.rollbackReadyProductionCount ?? 0),
          unresolvedProductionReviewerGovernanceCount: Number(
            productionReviewerGovernance.unresolvedProductionReviewerGovernanceCount ?? 0,
          ),
          blockerCount: Number(productionReviewerGovernance.blockerCount ?? 0),
          lesionCount: Number(productionReviewerGovernance.lesionCount ?? 0),
          readyTimelineCount: Number(productionReviewerGovernance.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(productionReviewerGovernance.blockedTimelineCount ?? 0),
          candidatePairCount: Number(productionReviewerGovernance.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(productionReviewerGovernance.reviewerWorkflowReadyCount ?? 0),
          governanceChecklistReady,
          aggregateGovernanceReady,
          reasonsCount: productionReviewerGovernance.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          reviewerIdentityExposed: false,
          rawProductionReviewerGovernanceLogsExposed: false,
          rawProductionReviewerGovernancePayloadsExposed: false,
        },
      });
      return { productionReviewerGovernance, scope };
    },
    async reviewVisitLongitudinalTimelineRolloutProductionReviewerEvidence(
      visitId,
      input,
      authContext,
      { correlationId } = {},
    ) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const payload = normalizeVisitLongitudinalTimelineRolloutProductionReviewerEvidencePayload(input);
      const scope = visitWriteScope(authContext);
      const visit = await getVisitOrThrow(visitWorkspaceRepository, safeVisitId, scope);
      const validationResult = await clinicalWorkspaceRepository.getVisitLongitudinalDatasetValidation({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const validation = validationResult || {};
      const readiness = validation.readiness || {};
      const rollout = validation.timelineRollout || {};
      const sop = validation.timelineRolloutSop || {};
      const evidence = validation.timelineRolloutEvidence || {};
      const monitoring = validation.timelineRolloutMonitoring || {};
      const incidentProcedure = validation.timelineRolloutIncidentProcedure || {};
      const clinicalValidation = validation.timelineRolloutClinicalValidation || {};
      const postValidationMonitoring = validation.timelineRolloutPostValidationMonitoring || {};
      const observationGovernance = validation.timelineRolloutObservationGovernance || {};
      const exceptionGovernance = validation.timelineRolloutExceptionGovernance || {};
      const outcomeGovernance = validation.timelineRolloutOutcomeGovernance || {};
      const longitudinalClinicalValidation = validation.timelineRolloutLongitudinalClinicalValidation || {};
      const protectedReviewerValidation = validation.timelineRolloutProtectedReviewerValidation || {};
      const protectedReviewerGovernance = validation.timelineRolloutProtectedReviewerGovernance || {};
      const protectedReviewerEvidence = validation.timelineRolloutProtectedReviewerEvidence || {};
      const productionDatasetEvidence = validation.timelineRolloutProductionDatasetEvidence || {};
      const validationStatus = String(readiness.status ?? "blocked");
      const rolloutStatus = String(rollout.status ?? "not_approved");
      const sopStatus = String(sop.status ?? "not_started");
      const evidenceStatus = String(evidence.status ?? "not_started");
      const monitoringStatus = String(monitoring.status ?? "not_started");
      const incidentProcedureStatus = String(incidentProcedure.status ?? "not_started");
      const clinicalValidationStatus = String(clinicalValidation.status ?? "not_started");
      const postValidationMonitoringStatus = String(postValidationMonitoring.status ?? "not_started");
      const observationGovernanceStatus = String(observationGovernance.status ?? "not_started");
      const exceptionGovernanceStatus = String(exceptionGovernance.status ?? "not_started");
      const outcomeGovernanceStatus = String(outcomeGovernance.status ?? "not_started");
      const longitudinalClinicalValidationStatus = String(
        longitudinalClinicalValidation.status ?? "not_started",
      );
      const protectedReviewerValidationStatus = String(
        protectedReviewerValidation.status ?? "not_started",
      );
      const protectedReviewerGovernanceStatus = String(
        protectedReviewerGovernance.status ?? "not_started",
      );
      const protectedReviewerEvidenceStatus = String(protectedReviewerEvidence.status ?? "not_started");
      const productionDatasetEvidenceStatus = String(productionDatasetEvidence.status ?? "not_started");
      const productionReviewerGovernance = validation.timelineRolloutProductionReviewerGovernance || {};
      const productionReviewerGovernanceStatus = String(productionReviewerGovernance.status ?? "not_started");
      const evidenceChecklistReady = [
        payload.productionReviewerAssignmentStatus,
        payload.productionSecondReviewStatus,
        payload.productionAdjudicationStatus,
        payload.productionFollowupStatus,
        payload.productionExceptionStatus,
        payload.productionRollbackStatus,
        payload.ownerSignoffStatus,
      ].every((status) => status === "ready");
      const aggregateEvidenceReady =
        payload.productionReviewWindowCount > 0
        && payload.assignedProductionReviewerCount > 0
        && payload.secondReviewedProductionCount > 0
        && payload.adjudicatedProductionReviewCount > 0
        && payload.followupClosedProductionCount > 0
        && payload.exceptionClosedProductionCount > 0
        && payload.rollbackReadyProductionCount > 0
        && payload.unresolvedProductionReviewerEvidenceCount === 0
        && payload.blockerCount === 0;
      const productionReviewerEvidenceReady =
        validationStatus === "ready_for_rollout"
        && rolloutStatus === "approved_for_clinical_operations"
        && sopStatus === "ready_for_operational_rollout"
        && evidenceStatus === "ready_for_monitored_rollout"
        && monitoringStatus === "ready_for_production_rollout"
        && incidentProcedureStatus === "ready_for_clinic_monitoring"
        && clinicalValidationStatus === "ready_for_clinical_validation"
        && postValidationMonitoringStatus === "ready_for_post_validation_monitoring"
        && observationGovernanceStatus === "ready_for_observation_governance"
        && exceptionGovernanceStatus === "ready_for_exception_governance"
        && outcomeGovernanceStatus === "ready_for_outcome_governance"
        && longitudinalClinicalValidationStatus === "ready_for_longitudinal_clinical_validation"
        && protectedReviewerValidationStatus === "ready_for_protected_reviewer_validation"
        && protectedReviewerGovernanceStatus === "ready_for_protected_reviewer_governance"
        && protectedReviewerEvidenceStatus === "ready_for_protected_reviewer_evidence"
        && productionDatasetEvidenceStatus === "ready_for_production_dataset_evidence"
        && productionReviewerGovernanceStatus === "ready_for_production_reviewer_governance"
        && evidenceChecklistReady
        && aggregateEvidenceReady;
      const effectiveStatus =
        payload.productionReviewerEvidenceStatus === "ready_for_production_reviewer_evidence"
          && !productionReviewerEvidenceReady
          ? "in_review"
          : payload.productionReviewerEvidenceStatus;
      const effectiveReasons = [
        ...payload.productionReviewerEvidenceReasons,
        ...(payload.productionReviewerEvidenceStatus === "ready_for_production_reviewer_evidence"
          && !productionReviewerEvidenceReady
          ? ["timeline_rollout_production_reviewer_evidence_not_ready"]
          : []),
      ];
      const productionReviewerEvidence =
        await clinicalWorkspaceRepository.reviewVisitLongitudinalTimelineRolloutProductionReviewerEvidence({
          visitId: safeVisitId,
          patientId: visit.patient.id,
          clinicId: visit.clinic.id,
          doctorUserId: authContext.userId,
          productionReviewerEvidence: {
            productionReviewerEvidenceStatus: effectiveStatus,
            productionReviewerEvidenceReasons: effectiveReasons,
            productionDatasetEvidenceStatus,
            productionReviewerGovernanceStatus,
            protectedReviewerEvidenceStatus,
            protectedReviewerGovernanceStatus,
            protectedReviewerValidationStatus,
            longitudinalClinicalValidationStatus,
            outcomeGovernanceStatus,
            exceptionGovernanceStatus,
            observationGovernanceStatus,
            postValidationMonitoringStatus,
            clinicalValidationStatus,
            incidentProcedureStatus,
            monitoringStatus,
            evidenceStatus,
            sopStatus,
            validationStatus,
            rolloutStatus,
            productionReviewerAssignmentStatus: payload.productionReviewerAssignmentStatus,
            productionSecondReviewStatus: payload.productionSecondReviewStatus,
            productionAdjudicationStatus: payload.productionAdjudicationStatus,
            productionFollowupStatus: payload.productionFollowupStatus,
            productionExceptionStatus: payload.productionExceptionStatus,
            productionRollbackStatus: payload.productionRollbackStatus,
            ownerSignoffStatus: payload.ownerSignoffStatus,
            productionReviewWindowCount: payload.productionReviewWindowCount,
            assignedProductionReviewerCount: payload.assignedProductionReviewerCount,
            secondReviewedProductionCount: payload.secondReviewedProductionCount,
            adjudicatedProductionReviewCount: payload.adjudicatedProductionReviewCount,
            followupClosedProductionCount: payload.followupClosedProductionCount,
            exceptionClosedProductionCount: payload.exceptionClosedProductionCount,
            rollbackReadyProductionCount: payload.rollbackReadyProductionCount,
            unresolvedProductionReviewerEvidenceCount: payload.unresolvedProductionReviewerEvidenceCount,
            blockerCount: payload.blockerCount,
            lesionCount: Number(readiness.lesionCount ?? 0),
            readyTimelineCount: Number(readiness.readyTimelineCount ?? 0),
            blockedTimelineCount: Number(readiness.blockedTimelineCount ?? 0),
            candidatePairCount: Number(readiness.candidatePairCount ?? 0),
            reviewerWorkflowReadyCount: Number(readiness.reviewerWorkflowReadyCount ?? 0),
          },
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        });
      if (!productionReviewerEvidence) {
        throw new VisitWorkspaceNotFoundError("Production reviewer evidence could not be saved.");
      }
      await recordAuditBestEffort(auditRepository, {
        clinicId: productionReviewerEvidence.clinicId ?? visit.clinic.id,
        actorUserId: authContext.userId,
        action: "visit_longitudinal_timeline_rollout_production_reviewer_evidence.review",
        entityType: "visit_longitudinal_timeline_rollout_production_reviewer_evidence_review",
        entityId: productionReviewerEvidence.id ?? safeVisitId,
        correlationId,
        metadata: {
          visitId: safeVisitId,
          productionReviewerEvidenceStatus: productionReviewerEvidence.status,
          productionDatasetEvidenceStatus: productionReviewerEvidence.productionDatasetEvidenceStatus,
          productionReviewerGovernanceStatus: productionReviewerEvidence.productionReviewerGovernanceStatus,
          protectedReviewerEvidenceStatus: productionReviewerEvidence.protectedReviewerEvidenceStatus,
          protectedReviewerGovernanceStatus: productionReviewerEvidence.protectedReviewerGovernanceStatus,
          protectedReviewerValidationStatus: productionReviewerEvidence.protectedReviewerValidationStatus,
          longitudinalClinicalValidationStatus: productionReviewerEvidence.longitudinalClinicalValidationStatus,
          outcomeGovernanceStatus: productionReviewerEvidence.outcomeGovernanceStatus,
          exceptionGovernanceStatus: productionReviewerEvidence.exceptionGovernanceStatus,
          observationGovernanceStatus: productionReviewerEvidence.observationGovernanceStatus,
          postValidationMonitoringStatus: productionReviewerEvidence.postValidationMonitoringStatus,
          clinicalValidationStatus: productionReviewerEvidence.clinicalValidationStatus,
          incidentProcedureStatus: productionReviewerEvidence.incidentProcedureStatus,
          monitoringStatus: productionReviewerEvidence.monitoringStatus,
          evidenceStatus: productionReviewerEvidence.evidenceStatus,
          sopStatus: productionReviewerEvidence.sopStatus,
          validationStatus: productionReviewerEvidence.validationStatus,
          rolloutStatus: productionReviewerEvidence.rolloutStatus,
          productionReviewWindowCount: Number(productionReviewerEvidence.productionReviewWindowCount ?? 0),
          assignedProductionReviewerCount: Number(
            productionReviewerEvidence.assignedProductionReviewerCount ?? 0,
          ),
          secondReviewedProductionCount: Number(
            productionReviewerEvidence.secondReviewedProductionCount ?? 0,
          ),
          adjudicatedProductionReviewCount: Number(
            productionReviewerEvidence.adjudicatedProductionReviewCount ?? 0,
          ),
          followupClosedProductionCount: Number(productionReviewerEvidence.followupClosedProductionCount ?? 0),
          exceptionClosedProductionCount: Number(
            productionReviewerEvidence.exceptionClosedProductionCount ?? 0,
          ),
          rollbackReadyProductionCount: Number(productionReviewerEvidence.rollbackReadyProductionCount ?? 0),
          unresolvedProductionReviewerEvidenceCount: Number(
            productionReviewerEvidence.unresolvedProductionReviewerEvidenceCount ?? 0,
          ),
          blockerCount: Number(productionReviewerEvidence.blockerCount ?? 0),
          lesionCount: Number(productionReviewerEvidence.lesionCount ?? 0),
          readyTimelineCount: Number(productionReviewerEvidence.readyTimelineCount ?? 0),
          blockedTimelineCount: Number(productionReviewerEvidence.blockedTimelineCount ?? 0),
          candidatePairCount: Number(productionReviewerEvidence.candidatePairCount ?? 0),
          reviewerWorkflowReadyCount: Number(productionReviewerEvidence.reviewerWorkflowReadyCount ?? 0),
          evidenceChecklistReady,
          aggregateEvidenceReady,
          reasonsCount: productionReviewerEvidence.reasons?.length ?? 0,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          clinicalOutputGenerated: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
          patientRowsExposed: false,
          reviewerIdentityExposed: false,
          rawProductionReviewerEvidenceLogsExposed: false,
          rawProductionReviewerEvidencePayloadsExposed: false,
        },
      });
      return { productionReviewerEvidence, scope };
    },

    async getLesionLongitudinalQa(patientId, lesionId, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId, "patientId");
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const scope = visitReadScope(authContext);
      const qa = await clinicalWorkspaceRepository.getLesionLongitudinalQa({
        patientId: safePatientId,
        lesionId: safeLesionId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!qa) throw new VisitWorkspaceNotFoundError("Lesion longitudinal QA was not found in the allowed clinic scope.");
      const readiness = qa.readiness || {};
      const boundaries = qa.boundaries || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: qa.clinicId ?? scope.clinicIds[0] ?? null,
        actorUserId: authContext.userId,
        action: "lesion_longitudinal_qa.read",
        entityType: "lesion_longitudinal_qa",
        entityId: safeLesionId,
        correlationId,
        metadata: {
          patientId: safePatientId,
          lesionId: safeLesionId,
          status: String(readiness.status ?? "blocked"),
          candidatePairCount: Number(readiness.candidatePairCount ?? 0),
          technicalReadyPairCount: Number(readiness.technicalReadyPairCount ?? 0),
          needsRecaptureCount: Number(readiness.needsRecaptureCount ?? 0),
          notSuitableForComparisonCount: Number(readiness.notSuitableForComparisonCount ?? 0),
          unreviewedPairCount: Number(readiness.unreviewedPairCount ?? 0),
          deviceEvidenceNotReadyCount: Number(readiness.deviceEvidenceNotReadyCount ?? 0),
          productionAssetNotReadyCount: Number(readiness.productionAssetNotReadyCount ?? 0),
          deviceBridgeQualityNotReadyCount: Number(readiness.deviceBridgeQualityNotReadyCount ?? 0),
          captureProtocolNotReadyCount: Number(readiness.captureProtocolNotReadyCount ?? 0),
          measurementPolicyNotReadyCount: Number(readiness.measurementPolicyNotReadyCount ?? 0),
          productionAnalysisPolicyNotReadyCount: Number(readiness.productionAnalysisPolicyNotReadyCount ?? 0),
          technicalRolloutReady: readiness.technicalRolloutReady === true,
          dynamicConclusionAllowed: false,
          medicalMeasurementAllowed: false,
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
          pairKeysExposed: false,
          imageIdsExposed: false,
        },
      });
      return { qa, scope };
    },

    async getLesionLongitudinalHistory(patientId, lesionId, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId, "patientId");
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const scope = visitReadScope(authContext);
      const history = await clinicalWorkspaceRepository.getLesionLongitudinalHistory({
        patientId: safePatientId,
        lesionId: safeLesionId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      const summary = history?.summary || {};
      await recordAuditBestEffort(auditRepository, {
        clinicId: history?.clinicId ?? scope.clinicIds[0] ?? null,
        actorUserId: authContext.userId,
        action: "lesion_longitudinal_history.read",
        entityType: "lesion_longitudinal_history",
        entityId: safeLesionId,
        correlationId,
        metadata: {
          patientId: safePatientId,
          lesionId: safeLesionId,
          visitCount: Number(summary.visitCount ?? 0),
          imageCount: Number(summary.imageCount ?? 0),
          candidatePairCount: Number(summary.candidatePairCount ?? 0),
          patientDeliveryAllowed: false,
          protectedFieldsExposed: false,
        },
      });
      return { history, scope };
    },

    async downloadProtectedLesionImage({ patientId, lesionId, assetId } = {}, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId, "patientId");
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const safeAssetId = assertUuid(assetId, "assetId");
      const scope = visitReadScope(authContext);
      const asset = await clinicalWorkspaceRepository.getProtectedLesionImageAsset({
        patientId: safePatientId,
        lesionId: safeLesionId,
        assetId: safeAssetId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!asset) throw new VisitWorkspaceNotFoundError("Protected lesion image was not found in the allowed clinic scope.");
      if (!asset.objectBucket || !asset.objectKey || !objectStore?.getObject) {
        const error = new Error("Protected lesion image is not available in the self-hosted object store.");
        error.publicCode = "asset_binary_not_found";
        error.publicStatus = 404;
        throw error;
      }
      let stored;
      try {
        stored = await objectStore.getObject({
          bucket: asset.objectBucket,
          key: asset.objectKey,
        });
      } catch {
        const error = new Error("Protected lesion image is not available in the self-hosted object store.");
        error.publicCode = "asset_binary_not_found";
        error.publicStatus = 404;
        throw error;
      }
      const contentType = stored.contentType || asset.contentType || "application/octet-stream";
      await recordAuditBestEffort(auditRepository, {
        clinicId: asset.clinicId,
        actorUserId: authContext.userId,
        action: "lesion_protected_image.proxy.download",
        entityType: "clinical_asset",
        entityId: asset.id,
        correlationId,
        metadata: {
          patientId: safePatientId,
          lesionId: safeLesionId,
          assetId: safeAssetId,
          kind: asset.kind,
          contentType,
          byteSize: stored.byteSize,
          deliveryMode: "doctor_backend_proxy",
          patientDeliveryAllowed: false,
          signedUrlsIssued: false,
          storagePathsExposed: false,
          rawImageBytesExposedInJson: false,
        },
      });
      return {
        asset: {
          id: asset.id,
          clinicId: asset.clinicId,
          patientId: asset.patientId,
          visitId: asset.visitId,
          lesionId: asset.lesionId,
          kind: asset.kind,
          contentType,
          byteSize: asset.byteSize,
          capturedAt: asset.capturedAt,
          patientDeliveryAllowed: false,
          signedUrlsIssued: false,
          storagePathsExposed: false,
        },
        object: {
          bytes: stored.bytes,
          byteSize: stored.byteSize,
          contentType,
        },
        download: {
          fileName: `lesion-image-${safeAssetId.slice(0, 8)}.${extensionForContentType(contentType)}`,
        },
        scope,
      };
    },
  };
}
