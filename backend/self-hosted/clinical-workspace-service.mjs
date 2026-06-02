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
const MAX_TEXT = 8000;
const MAX_REASON_TEXT = 120;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:+-]{1,160}$/;
const UNSAFE_CLINICAL_REASON_PATTERN = /меланома|рак кожи|вероятность|диагноз|лечение|прогноз/i;
const PROTECTED_INPUT_KEYS = new Set([
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
  "patientDeliveryAllowed",
  "protectedFieldsExposed",
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
