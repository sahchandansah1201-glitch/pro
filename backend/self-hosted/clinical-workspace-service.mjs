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
const MAX_TEXT = 8000;

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
  };
}
