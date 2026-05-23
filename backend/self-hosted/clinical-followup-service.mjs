// Stage 17A-17Z · Clinical follow-up communication service.
// Doctors create local follow-up tasks; patients can answer through /api/v1/me.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { patientPortalScope, visitReadScope, visitWriteScope } from "./rbac.mjs";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T/;
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const STATUSES = new Set(["planned", "in_progress", "sent", "acknowledged", "completed", "cancelled"]);
const TRIAGE_STATES = new Set(["new", "queued", "in_review", "waiting_patient", "escalated", "resolved", "blocked"]);
const ESCALATION_LEVELS = new Set(["none", "watch", "clinic_admin", "urgent"]);
const DELIVERY_STATES = new Set(["not_required", "pending", "delivered", "failed", "deferred"]);
const RESOLUTION_OUTCOMES = new Set(["not_reviewed", "patient_reached", "patient_unreachable", "clinical_escalation", "administrative_close"]);
const QUALITY_REVIEW_STATES = new Set(["pending", "reviewed", "needs_attention"]);
const RETENTION_REVIEW_STATES = new Set(["not_due", "due", "reviewed", "archived"]);
const CLINIC_REVIEW_STATES = new Set(["not_scheduled", "scheduled", "completed", "needs_policy_review"]);
const MAX_REASON = 1000;
const MAX_SUMMARY = 2000;
const MAX_INTERNAL_NOTE = 4000;
const MAX_MESSAGE_BODY = 3000;
const MAX_OPERATIONS_NOTE = 2000;
const MAX_QUALITY_NOTE = 2000;
const MAX_REVIEW_NOTE = 2000;

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

export function normalizeClinicalFollowUpOperationsUpdatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(body, "triageState")) {
    const triageState = cleanString(body.triageState);
    if (!triageState || !TRIAGE_STATES.has(triageState)) {
      details.push({ field: "triageState", message: "triageState is not supported." });
    } else {
      payload.triageState = triageState;
    }
  }
  if (hasOwn(body, "escalationLevel")) {
    const escalationLevel = cleanString(body.escalationLevel);
    if (!escalationLevel || !ESCALATION_LEVELS.has(escalationLevel)) {
      details.push({ field: "escalationLevel", message: "escalationLevel is not supported." });
    } else {
      payload.escalationLevel = escalationLevel;
    }
  }
  if (hasOwn(body, "deliveryState")) {
    const deliveryState = cleanString(body.deliveryState);
    if (!deliveryState || !DELIVERY_STATES.has(deliveryState)) {
      details.push({ field: "deliveryState", message: "deliveryState is not supported." });
    } else {
      payload.deliveryState = deliveryState;
    }
  }
  if (hasOwn(body, "slaDueAt")) {
    payload.slaDueAt = body.slaDueAt == null || body.slaDueAt === ""
      ? null
      : validateIsoDateTime(body.slaDueAt, "slaDueAt", details);
  }
  if (hasOwn(body, "deliveryEvidence")) {
    if (body.deliveryEvidence == null) {
      payload.deliveryEvidence = {};
    } else if (!isPlainObject(body.deliveryEvidence)) {
      details.push({ field: "deliveryEvidence", message: "deliveryEvidence must be an object." });
    } else {
      payload.deliveryEvidence = {
        channel: cleanString(body.deliveryEvidence.channel),
        state: cleanString(body.deliveryEvidence.state),
        checkedAt: cleanString(body.deliveryEvidence.checkedAt),
      };
    }
  }
  if (hasOwn(body, "operationsNote")) {
    payload.operationsNote = validateLimitedText(body.operationsNote, "operationsNote", MAX_OPERATIONS_NOTE, details);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one operations field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpQualityUpdatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(body, "resolutionOutcome")) {
    const resolutionOutcome = cleanString(body.resolutionOutcome);
    if (!resolutionOutcome || !RESOLUTION_OUTCOMES.has(resolutionOutcome)) {
      details.push({ field: "resolutionOutcome", message: "resolutionOutcome is not supported." });
    } else {
      payload.resolutionOutcome = resolutionOutcome;
    }
  }
  if (hasOwn(body, "qualityReviewState")) {
    const qualityReviewState = cleanString(body.qualityReviewState);
    if (!qualityReviewState || !QUALITY_REVIEW_STATES.has(qualityReviewState)) {
      details.push({ field: "qualityReviewState", message: "qualityReviewState is not supported." });
    } else {
      payload.qualityReviewState = qualityReviewState;
    }
  }
  if (hasOwn(body, "qualityReviewNote")) {
    payload.qualityReviewNote = validateLimitedText(body.qualityReviewNote, "qualityReviewNote", MAX_QUALITY_NOTE, details);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one quality field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpClinicReviewUpdatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(body, "retentionReviewState")) {
    const retentionReviewState = cleanString(body.retentionReviewState);
    if (!retentionReviewState || !RETENTION_REVIEW_STATES.has(retentionReviewState)) {
      details.push({ field: "retentionReviewState", message: "retentionReviewState is not supported." });
    } else {
      payload.retentionReviewState = retentionReviewState;
    }
  }
  if (hasOwn(body, "retentionReviewNote")) {
    payload.retentionReviewNote = validateLimitedText(body.retentionReviewNote, "retentionReviewNote", MAX_REVIEW_NOTE, details);
  }
  if (hasOwn(body, "clinicReviewState")) {
    const clinicReviewState = cleanString(body.clinicReviewState);
    if (!clinicReviewState || !CLINIC_REVIEW_STATES.has(clinicReviewState)) {
      details.push({ field: "clinicReviewState", message: "clinicReviewState is not supported." });
    } else {
      payload.clinicReviewState = clinicReviewState;
    }
  }
  if (hasOwn(body, "clinicReviewNote")) {
    payload.clinicReviewNote = validateLimitedText(body.clinicReviewNote, "clinicReviewNote", MAX_REVIEW_NOTE, details);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one clinic review field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
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

    async listClinicalFollowUpOperations(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const result = await clinicalFollowUpRepository.listClinicalFollowUpOperations({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.operations.list",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          count: result.items.length,
          triageState: params?.triageState || null,
          escalationLevel: params?.escalationLevel || null,
          overdueOnly: Boolean(params?.overdueOnly),
        },
      });
      return { result, scope };
    },

    async getClinicalFollowUpOperationsSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpOperationsSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.operations.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          totalOpen: summary.totalOpen,
          overdue: summary.overdue,
          escalated: summary.escalated,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpOutcomeQualitySummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpOutcomeQualitySummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.outcomes.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          closedFollowUps: summary.closedFollowUps,
          closedMissingEvidence: summary.closedMissingEvidence,
          qualityNeedsAttention: summary.qualityNeedsAttention,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpClinicReviewSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpClinicReviewSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.clinic_review.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          retentionDue: summary.retentionDue,
          clinicNeedsPolicyReview: summary.clinicNeedsPolicyReview,
          localReviewEvents: summary.localReviewEvents,
        },
      });
      return { summary, scope };
    },

    async updateClinicalFollowUpOperations(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpOperationsUpdatePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpOperations({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.operations.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          triageState: followUp.triageState,
          escalationLevel: followUp.escalationLevel,
          deliveryState: followUp.deliveryState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpQuality(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpQualityUpdatePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpQuality({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.quality.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          resolutionOutcome: followUp.resolutionOutcome,
          qualityReviewState: followUp.qualityReviewState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpClinicReview(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpClinicReviewUpdatePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpClinicReview({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError();
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.clinic_review.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          retentionReviewState: followUp.retentionReviewState,
          clinicReviewState: followUp.clinicReviewState,
        },
      });
      return { followUp, scope };
    },
  };
}
