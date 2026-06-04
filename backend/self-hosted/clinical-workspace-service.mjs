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
