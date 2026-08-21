// Stage 4H · Self-hosted visit workspace write service.
// Validation + RBAC + audit for PATCH /visits, POST/PATCH/DELETE /lesions,
// PATCH /visits/:id/report. No managed-runtime coupling.

import { createHash } from "node:crypto";

import { recordAuditBestEffort } from "./audit-repository.mjs";
import {
  ClinicalBodyRegionValidationError,
  normalizeClinicalBodyPlacement,
} from "./clinical-body-region-contract.mjs";
import { ForbiddenError, visitWriteScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISIT_STATUS_VALUES = new Set(["draft", "in_progress", "signed", "cancelled"]);
const LESION_STATUS_VALUES = new Set(["active", "monitoring", "removed", "archived"]);
const RISK_LEVEL_VALUES = new Set(["low", "moderate", "high", "urgent"]);
const REPORT_STATUS_VALUES = new Set(["draft", "ready", "signed", "sent"]);
const MAX_LABEL = 120;
const MAX_ZONE = 80;
const MAX_TEXT = 8000;
const MAX_COMPLAINT = 1000;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{16,128}$/;

export class VisitWorkspaceValidationError extends Error {
  constructor(details = [], message = "Visit workspace payload failed validation.") {
    super(message);
    this.name = "VisitWorkspaceValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class VisitWorkspaceNotFoundError extends Error {
  constructor(message = "Resource was not found in the allowed clinic scope.") {
    super(message);
    this.name = "VisitWorkspaceNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function cleanLongText(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\r\n/g, "\n").trim();
  return cleaned || null;
}

export function assertUuid(value, field = "id") {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new VisitWorkspaceValidationError([{ field, message: `${field} must be a UUID.` }]);
  }
  return String(value);
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function normalizeBodyMap(input) {
  try {
    return normalizeClinicalBodyPlacement(input);
  } catch (error) {
    if (error instanceof ClinicalBodyRegionValidationError) {
      throw new VisitWorkspaceValidationError([{ field: error.field, message: error.message }]);
    }
    throw error;
  }
}

function normalizeIdempotencyKey(value, required) {
  const key = cleanString(value);
  if (!key && required) {
    throw new VisitWorkspaceValidationError([
      { field: "Idempotency-Key", message: "Idempotency-Key is required for a body-map lesion create." },
    ]);
  }
  if (key && !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new VisitWorkspaceValidationError([
      { field: "Idempotency-Key", message: "Idempotency-Key must contain 16 to 128 safe characters." },
    ]);
  }
  return key;
}

function requestHash(visitId, payload) {
  return createHash("sha256").update(JSON.stringify({ visitId, payload })).digest("hex");
}

export function normalizeUpdateVisitPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {};
  const details = [];
  if (hasOwn(input, "status")) {
    const status = cleanString(input.status);
    if (!status || !VISIT_STATUS_VALUES.has(status)) {
      details.push({ field: "status", message: "status must be draft, in_progress, signed, or cancelled." });
    } else {
      payload.status = status;
      if (status === "signed") payload.signedAt = new Date().toISOString();
    }
  }
  if (hasOwn(input, "chiefComplaint")) {
    const complaint = input.chiefComplaint == null ? null : String(input.chiefComplaint).trim();
    if (complaint && complaint.length > MAX_COMPLAINT) {
      details.push({ field: "chiefComplaint", message: "chiefComplaint is too long." });
    } else {
      payload.chiefComplaint = complaint || null;
    }
  }
  if (hasOwn(input, "startedAt")) {
    payload.startedAt = cleanString(input.startedAt);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one editable visit field is required." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return payload;
}

export function normalizeCreateLesionPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const label = cleanString(input.label);
  const bodyMap = hasOwn(input, "bodyMap") ? normalizeBodyMap(input.bodyMap) : null;
  const bodyZone = bodyMap?.regionLabel ?? cleanString(input.bodyZone);
  const bodySurface = bodyMap?.bodySurface ?? cleanString(input.bodySurface);
  const status = cleanString(input.status) || "active";
  const riskLevel = cleanString(input.riskLevel);
  if (!label) details.push({ field: "label", message: "label is required." });
  if (label && label.length > MAX_LABEL) {
    details.push({ field: "label", message: "label is too long." });
  }
  if (bodyZone && bodyZone.length > MAX_ZONE) {
    details.push({ field: "bodyZone", message: "bodyZone is too long." });
  }
  if (!LESION_STATUS_VALUES.has(status)) {
    details.push({ field: "status", message: "status must be active, monitoring, removed, or archived." });
  }
  if (riskLevel && !RISK_LEVEL_VALUES.has(riskLevel)) {
    details.push({ field: "riskLevel", message: "riskLevel must be low, moderate, high, or urgent." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    label,
    bodyZone,
    bodySurface,
    status,
    riskLevel,
    ...(bodyMap
      ? {
          bodyMap: {
            view: bodyMap.view,
            x: bodyMap.x,
            y: bodyMap.y,
            regionId: bodyMap.regionId,
            detailId: bodyMap.detailId,
          },
        }
      : {}),
  };
}

export function normalizeUpdateLesionPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {};
  const details = [];
  if (hasOwn(input, "label")) {
    const label = cleanString(input.label);
    if (!label) details.push({ field: "label", message: "label cannot be empty." });
    else if (label.length > MAX_LABEL) details.push({ field: "label", message: "label is too long." });
    else payload.label = label;
  }
  if (hasOwn(input, "bodyZone")) payload.bodyZone = cleanString(input.bodyZone);
  if (hasOwn(input, "bodySurface")) payload.bodySurface = cleanString(input.bodySurface);
  if (hasOwn(input, "status")) {
    const status = cleanString(input.status);
    if (!status || !LESION_STATUS_VALUES.has(status)) {
      details.push({ field: "status", message: "status must be active, monitoring, removed, or archived." });
    } else {
      payload.status = status;
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
  if (hasOwn(input, "bodyMap")) {
    const bodyMap = normalizeBodyMap(input.bodyMap);
    if (!Number.isInteger(input.expectedPlacementRevision) || input.expectedPlacementRevision < 0) {
      details.push({
        field: "expectedPlacementRevision",
        message: "expectedPlacementRevision must be a non-negative integer when bodyMap is changed.",
      });
    } else {
      payload.expectedPlacementRevision = input.expectedPlacementRevision;
    }
    payload.bodyMap = {
      view: bodyMap.view,
      x: bodyMap.x,
      y: bodyMap.y,
      regionId: bodyMap.regionId,
      detailId: bodyMap.detailId,
    };
    payload.bodyZone = bodyMap.regionLabel;
    payload.bodySurface = bodyMap.bodySurface;
  } else if (hasOwn(input, "expectedPlacementRevision")) {
    details.push({
      field: "expectedPlacementRevision",
      message: "expectedPlacementRevision is only allowed together with bodyMap.",
    });
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one editable lesion field is required." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return payload;
}

export function normalizeUpdateReportPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {};
  const details = [];
  if (hasOwn(input, "status")) {
    const status = cleanString(input.status);
    if (!status || !REPORT_STATUS_VALUES.has(status)) {
      details.push({ field: "status", message: "status must be draft, ready, signed, or sent." });
    } else {
      payload.status = status;
      if (status === "signed") payload.signedAt = new Date().toISOString();
    }
  }
  if (hasOwn(input, "physicianText")) {
    const text = cleanLongText(input.physicianText);
    if (text && text.length > MAX_TEXT) {
      details.push({ field: "physicianText", message: "physicianText is too long." });
    } else {
      payload.physicianText = text;
    }
  }
  if (hasOwn(input, "patientSafeText")) {
    const text = cleanLongText(input.patientSafeText);
    if (text && text.length > MAX_TEXT) {
      details.push({ field: "patientSafeText", message: "patientSafeText is too long." });
    } else {
      payload.patientSafeText = text;
    }
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one editable report field is required." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return payload;
}

function changedFields(payload) {
  return Object.keys(payload).filter((key) => payload[key] !== undefined && key !== "expectedPlacementRevision");
}

function ensureScopeAllowsClinic(scope, clinicId) {
  if (scope.allClinics) return;
  if (!clinicId || !scope.clinicIds.includes(clinicId)) {
    throw new ForbiddenError("Resource is outside the authenticated user's clinic scope.");
  }
}

export function createVisitWorkspaceWriteService({
  visitWorkspaceRepository,
  visitWorkspaceWriteRepository,
  auditRepository,
} = {}) {
  return {
    async updateVisit(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeUpdateVisitPayload(input);
      const visit = await visitWorkspaceWriteRepository.updateVisit({
        visitId: safeVisitId,
        changes: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!visit) throw new VisitWorkspaceNotFoundError("Visit was not found in the allowed clinic scope.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: visit.clinicId,
        actorUserId: authContext.userId,
        action: "visit.update",
        entityType: "visit",
        entityId: visit.id,
        correlationId,
        metadata: { changedFields: changedFields(payload) },
      });
      return { visit, scope };
    },

    async createLesion(visitId, input, authContext, { correlationId, idempotencyKey } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeCreateLesionPayload(input);
      const safeIdempotencyKey = normalizeIdempotencyKey(idempotencyKey, Boolean(payload.bodyMap));
      const visit = await visitWorkspaceRepository.getVisit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!visit) throw new VisitWorkspaceNotFoundError("Visit was not found in the allowed clinic scope.");
      ensureScopeAllowsClinic(scope, visit.clinic.id);
      const writeResult = await visitWorkspaceWriteRepository.createLesion({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        idempotencyKey: safeIdempotencyKey,
        requestHash: safeIdempotencyKey ? requestHash(safeVisitId, payload) : null,
        auditEvent: payload.bodyMap
          ? {
              actorUserId: authContext.userId,
              correlationId,
              metadata: {
                visitId: safeVisitId,
                changedFields: changedFields(payload),
                bodyRegionId: payload.bodyMap.regionId,
                bodyMapView: payload.bodyMap.view,
                placementRevision: 1,
              },
            }
          : null,
        ...payload,
      });
      const lesion = writeResult?.lesion ?? writeResult;
      const replayed = Boolean(writeResult?.lesion && writeResult.replayed);
      if (!lesion) throw new VisitWorkspaceNotFoundError("Lesion could not be created.");
      if (!replayed && !writeResult?.auditPersisted) {
        await recordAuditBestEffort(auditRepository, {
          clinicId: lesion.clinicId,
          actorUserId: authContext.userId,
          action: "lesion.create",
          entityType: "lesion",
          entityId: lesion.id,
          correlationId,
          metadata: {
            visitId: safeVisitId,
            changedFields: changedFields(payload),
            ...(payload.bodyMap
              ? {
                  bodyRegionId: payload.bodyMap.regionId,
                  bodyMapView: payload.bodyMap.view,
                  placementRevision: lesion.placementRevision,
                }
              : {}),
          },
        });
      }
      return { lesion, scope, replayed };
    },

    async updateLesion(lesionId, input, authContext, { correlationId } = {}) {
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeUpdateLesionPayload(input);
      const writeResult = await visitWorkspaceWriteRepository.updateLesion({
        lesionId: safeLesionId,
        changes: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        auditEvent: payload.bodyMap
          ? {
              actorUserId: authContext.userId,
              correlationId,
              metadata: {
                changedFields: changedFields(payload),
                bodyRegionId: payload.bodyMap.regionId,
                bodyMapView: payload.bodyMap.view,
                placementRevision: payload.expectedPlacementRevision + 1,
              },
            }
          : null,
      });
      const lesion = writeResult?.lesion ?? writeResult;
      if (!lesion) throw new VisitWorkspaceNotFoundError("Lesion was not found in the allowed clinic scope.");
      if (!writeResult?.auditPersisted) await recordAuditBestEffort(auditRepository, {
        clinicId: lesion.clinicId,
        actorUserId: authContext.userId,
        action: "lesion.update",
        entityType: "lesion",
        entityId: lesion.id,
        correlationId,
        metadata: {
          changedFields: changedFields(payload),
          ...(payload.bodyMap
            ? {
                bodyRegionId: payload.bodyMap.regionId,
                bodyMapView: payload.bodyMap.view,
                placementRevision: lesion.placementRevision,
              }
            : {}),
        },
      });
      return { lesion, scope };
    },

    async archiveLesion(lesionId, authContext, { correlationId } = {}) {
      const safeLesionId = assertUuid(lesionId, "lesionId");
      const scope = visitWriteScope(authContext);
      const writeResult = await visitWorkspaceWriteRepository.archiveLesion({
        lesionId: safeLesionId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        auditEvent: {
          actorUserId: authContext.userId,
          correlationId,
          metadata: { softDelete: true },
        },
      });
      const lesion = writeResult?.lesion ?? writeResult;
      if (!lesion) throw new VisitWorkspaceNotFoundError("Lesion was not found in the allowed clinic scope.");
      if (!writeResult?.auditPersisted) await recordAuditBestEffort(auditRepository, {
        clinicId: lesion.clinicId,
        actorUserId: authContext.userId,
        action: "lesion.archive",
        entityType: "lesion",
        entityId: lesion.id,
        correlationId,
        metadata: { softDelete: true },
      });
      return { lesion, scope };
    },

    async updateReport(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeUpdateReportPayload(input);
      const visit = await visitWorkspaceRepository.getVisit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!visit) throw new VisitWorkspaceNotFoundError("Visit was not found in the allowed clinic scope.");
      ensureScopeAllowsClinic(scope, visit.clinic.id);
      const report = await visitWorkspaceWriteRepository.upsertReport({
        visitId: safeVisitId,
        patientId: visit.patient.id,
        clinicId: visit.clinic.id,
        doctorUserId: authContext.userId,
        changes: payload,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!report) throw new VisitWorkspaceNotFoundError("Report could not be saved.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: report.clinicId,
        actorUserId: authContext.userId,
        action: "report.update",
        entityType: "report",
        entityId: report.id,
        correlationId,
        metadata: { visitId: safeVisitId, changedFields: changedFields(payload) },
      });
      return { report, scope };
    },
  };
}
