// Stage 17A-17Z · Clinical follow-up communication service.
// Doctors create local follow-up tasks; patients can answer through /api/v1/me.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { patientPortalScope, visitReadScope, visitWriteScope } from "./rbac.mjs";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["planned", "in_progress", "sent", "acknowledged", "completed", "cancelled"]);
const MAX_REASON = 1000;
const MAX_SUMMARY = 2000;
const MAX_INTERNAL_NOTE = 4000;
const MAX_MESSAGE_BODY = 3000;

class ClinicalFollowUpNotFoundError extends Error {
  constructor(message = "Clinical follow-up was not found.") {
    super(message);
    this.name = "ClinicalFollowUpNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

class ClinicalFollowUpValidationError extends Error {
  constructor(details = [], message = "Clinical follow-up payload failed validation.") {
    super(message);
    this.name = "ClinicalFollowUpValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function cleanString(value) {
  if (value == null) return null;
  const text = String(value).trim().replace(/\s+/g, " ");
  return text || null;
}

function requireBodyObject(input) {
  if (!isPlainObject(input)) {
    throw new ClinicalFollowUpValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  return input;
}

function validateIsoDateTime(value, field, details) {
  const text = cleanString(value);
  if (!text) {
    details.push({ field, message: `${field} is required.` });
    return null;
  }
  const date = new Date(text);
  if (!ISO_DATE_RE.test(text) || Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
    return null;
  }
  return text;
}

function validateLimitedText(value, field, max, details, { required = false } = {}) {
  const text = cleanString(value);
  if (!text && required) {
    details.push({ field, message: `${field} is required.` });
    return null;
  }
  if (text && text.length > max) {
    details.push({ field, message: `${field} is too long.` });
  }
  return text;
}

export function normalizeClinicalFollowUpCreatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const dueAt = validateIsoDateTime(body.dueAt, "dueAt", details);
  const reason = validateLimitedText(body.reason, "reason", MAX_REASON, details, { required: true });
  const patientSummary = validateLimitedText(body.patientSummary, "patientSummary", MAX_SUMMARY, details);
  const internalNote = validateLimitedText(body.internalNote, "internalNote", MAX_INTERNAL_NOTE, details);
  const priority = cleanString(body.priority) || "normal";
  if (!PRIORITIES.has(priority)) {
    details.push({ field: "priority", message: "priority must be low, normal, high, or urgent." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return {
    dueAt,
    reason,
    patientSummary,
    internalNote,
    priority,
    assignedUserId: cleanString(body.assignedUserId),
  };
}

export function normalizeClinicalFollowUpUpdatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(body, "dueAt")) payload.dueAt = validateIsoDateTime(body.dueAt, "dueAt", details);
  if (hasOwn(body, "reason")) {
    payload.reason = validateLimitedText(body.reason, "reason", MAX_REASON, details, { required: true });
  }
  if (hasOwn(body, "patientSummary")) {
    payload.patientSummary = validateLimitedText(body.patientSummary, "patientSummary", MAX_SUMMARY, details);
  }
  if (hasOwn(body, "internalNote")) {
    payload.internalNote = validateLimitedText(body.internalNote, "internalNote", MAX_INTERNAL_NOTE, details);
  }
  if (hasOwn(body, "priority")) {
    const priority = cleanString(body.priority);
    if (!priority || !PRIORITIES.has(priority)) {
      details.push({ field: "priority", message: "priority must be low, normal, high, or urgent." });
    } else {
      payload.priority = priority;
    }
  }
  if (hasOwn(body, "status")) {
    const status = cleanString(body.status);
    if (!status || !STATUSES.has(status)) {
      details.push({ field: "status", message: "status is not supported." });
    } else {
      payload.status = status;
    }
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpMessagePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const messageBody = validateLimitedText(body.body, "body", MAX_MESSAGE_BODY, details, { required: true });
  const patientVisible = typeof body.patientVisible === "boolean" ? body.patientVisible : true;
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return {
    body: messageBody,
    patientVisible,
  };
}

async function audit(auditRepository, event) {
  await recordAuditBestEffort(auditRepository, event);
}

export function createClinicalFollowUpService({
  clinicalFollowUpRepository,
  auditRepository,
} = {}) {
  return {
    async listClinicalFollowUps(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const result = await clinicalFollowUpRepository.listClinicalFollowUps({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.list",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          count: result.items.length,
          status: params?.status || null,
        },
      });
      return { result, scope };
    },

    async createClinicalFollowUp(visitId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const payload = normalizeClinicalFollowUpCreatePayload(input);
      const followUp = await clinicalFollowUpRepository.createClinicalFollowUp({
        ...payload,
        visitId,
        createdByUserId: authContext.userId,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Visit was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.create",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          visitId: followUp.visitId,
          patientId: followUp.patientId,
          priority: followUp.priority,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUp(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpUpdatePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUp({
        followUpId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          status: followUp.status,
          priority: followUp.priority,
        },
      });
      return { followUp, scope };
    },

    async createClinicalFollowUpMessage(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const payload = normalizeClinicalFollowUpMessagePayload(input);
      const message = await clinicalFollowUpRepository.createClinicalFollowUpMessage({
        followUpId,
        senderUserId: authContext.userId,
        senderRole: "doctor",
        direction: "clinic_to_patient",
        channel: "portal",
        deliveryState: "local_only",
        patientVisible: payload.patientVisible,
        body: payload.body,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!message) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.message.create",
        entityType: "clinical_follow_up_message",
        entityId: message.id,
        correlationId,
        metadata: {
          followUpId,
          patientVisible: message.patientVisible,
        },
      });
      return { message, scope };
    },

    async listPatientFollowUps(authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const result = await clinicalFollowUpRepository.listPatientFollowUps({
        userId: scope.userId,
      });
      await audit(auditRepository, {
        actorUserId: scope.userId,
        action: "patient_portal.follow_up.list",
        entityType: "patient_portal",
        entityId: scope.userId,
        correlationId,
        metadata: { count: result.items.length },
      });
      return { result, scope };
    },

    async createPatientFollowUpMessage(followUpId, input, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const payload = normalizeClinicalFollowUpMessagePayload(input);
      const message = await clinicalFollowUpRepository.createPatientFollowUpMessage({
        followUpId,
        userId: scope.userId,
        body: payload.body,
      });
      if (!message) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        actorUserId: scope.userId,
        action: "patient_portal.follow_up.message.create",
        entityType: "clinical_follow_up_message",
        entityId: message.id,
        correlationId,
        metadata: { followUpId },
      });
      return { message, scope };
    },
  };
}
