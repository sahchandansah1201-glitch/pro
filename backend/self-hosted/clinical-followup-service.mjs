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
const SOP_VALIDATION_STATES = new Set(["not_required", "required", "validated", "exception", "blocked"]);
const SOP_POLICY_DRIFT_STATES = new Set(["not_checked", "in_sync", "drifted", "missing_template", "review_required"]);
const SOP_POLICY_EXCEPTION_STATES = new Set(["none", "open", "accepted", "rejected", "closed"]);
const SOP_POLICY_AUDIT_STATES = new Set(["not_started", "ready", "reviewed", "needs_followup"]);
const SOP_POLICY_GOVERNANCE_STATES = new Set(["not_started", "ready", "reviewed", "needs_followup"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REASON = 1000;
const MAX_SUMMARY = 2000;
const MAX_INTERNAL_NOTE = 4000;
const MAX_MESSAGE_BODY = 3000;
const MAX_OPERATIONS_NOTE = 2000;
const MAX_QUALITY_NOTE = 2000;
const MAX_REVIEW_NOTE = 2000;
const MAX_SOP_POLICY_VERSION = 120;
const MAX_SOP_EXCEPTION_REASON = 2000;
const MAX_SOP_TEMPLATE_CODE = 80;
const MAX_SOP_TEMPLATE_TITLE = 160;
const MAX_SOP_TEMPLATE_DESCRIPTION = 2000;
const MAX_SOP_POLICY_DRIFT_REASON = 2000;
const MAX_SOP_POLICY_EXCEPTION_REASON = 2000;
const MAX_SOP_POLICY_EXCEPTION_RESOLUTION = 2000;
const MAX_SOP_POLICY_AUDIT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_NOTE = 2000;
const SOP_TEMPLATE_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{1,79}$/;

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

export function normalizeClinicalFollowUpSopValidationUpdatePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};
  if (hasOwn(body, "sopValidationState")) {
    const sopValidationState = cleanString(body.sopValidationState);
    if (!sopValidationState || !SOP_VALIDATION_STATES.has(sopValidationState)) {
      details.push({ field: "sopValidationState", message: "sopValidationState is not supported." });
    } else {
      payload.sopValidationState = sopValidationState;
    }
  }
  if (hasOwn(body, "sopPolicyVersion")) {
    payload.sopPolicyVersion = validateLimitedText(body.sopPolicyVersion, "sopPolicyVersion", MAX_SOP_POLICY_VERSION, details);
  }
  if (hasOwn(body, "sopExceptionReason")) {
    payload.sopExceptionReason = validateLimitedText(body.sopExceptionReason, "sopExceptionReason", MAX_SOP_EXCEPTION_REASON, details);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP validation field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

function normalizeSopTemplateAppliesTo(value, details) {
  if (value == null) return {};
  if (!isPlainObject(value)) {
    details.push({ field: "appliesTo", message: "appliesTo must be an object." });
    return {};
  }
  const normalized = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, 20)) {
    const key = cleanString(rawKey);
    if (!key || !/^[A-Za-z0-9_.-]{1,60}$/.test(key)) {
      details.push({ field: "appliesTo", message: "appliesTo keys must be bounded local identifiers." });
      continue;
    }
    if (rawValue == null || typeof rawValue === "boolean") {
      normalized[key] = rawValue;
    } else if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
      normalized[key] = rawValue;
    } else if (typeof rawValue === "string") {
      normalized[key] = cleanString(rawValue)?.slice(0, 200) || "";
    } else if (Array.isArray(rawValue)) {
      normalized[key] = rawValue.map(cleanString).filter(Boolean).slice(0, 20);
    } else {
      details.push({ field: "appliesTo", message: "appliesTo values must be primitive local metadata." });
    }
  }
  return normalized;
}

function normalizeSopValidationStates(value, details, { required = false } = {}) {
  if (value == null) {
    if (required) details.push({ field: "requiredValidationStates", message: "requiredValidationStates is required." });
    return ["required", "blocked"];
  }
  if (!Array.isArray(value)) {
    details.push({ field: "requiredValidationStates", message: "requiredValidationStates must be an array." });
    return ["required", "blocked"];
  }
  const states = Array.from(new Set(value.map(cleanString).filter(Boolean)));
  if (states.length === 0) {
    details.push({ field: "requiredValidationStates", message: "At least one validation state is required." });
  }
  for (const state of states) {
    if (!SOP_VALIDATION_STATES.has(state)) {
      details.push({ field: "requiredValidationStates", message: "requiredValidationStates contains an unsupported state." });
    }
  }
  return states;
}

export function normalizeClinicalFollowUpSopPolicyTemplatePayload(input = {}, { create = false } = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (create) {
    payload.clinicId = cleanString(body.clinicId);
  } else if (hasOwn(body, "clinicId")) {
    details.push({ field: "clinicId", message: "clinicId cannot be updated." });
  }
  if (create || hasOwn(body, "code")) {
    const code = validateLimitedText(body.code, "code", MAX_SOP_TEMPLATE_CODE, details, { required: create });
    if (code && !SOP_TEMPLATE_CODE_RE.test(code)) {
      details.push({ field: "code", message: "code must be a local SOP identifier." });
    }
    payload.code = code;
  }
  if (create || hasOwn(body, "title")) {
    payload.title = validateLimitedText(body.title, "title", MAX_SOP_TEMPLATE_TITLE, details, { required: create });
  }
  if (create || hasOwn(body, "version")) {
    payload.version = validateLimitedText(body.version, "version", MAX_SOP_POLICY_VERSION, details, { required: create });
  }
  if (hasOwn(body, "description")) {
    payload.description = validateLimitedText(body.description, "description", MAX_SOP_TEMPLATE_DESCRIPTION, details);
  } else if (create) {
    payload.description = null;
  }
  if (hasOwn(body, "appliesTo")) {
    payload.appliesTo = normalizeSopTemplateAppliesTo(body.appliesTo, details);
  } else if (create) {
    payload.appliesTo = {};
  }
  if (hasOwn(body, "requiredValidationStates")) {
    payload.requiredValidationStates = normalizeSopValidationStates(body.requiredValidationStates, details);
  } else if (create) {
    payload.requiredValidationStates = ["required", "blocked"];
  }
  if (hasOwn(body, "defaultValidationState")) {
    const state = cleanString(body.defaultValidationState);
    if (!state || !SOP_VALIDATION_STATES.has(state)) {
      details.push({ field: "defaultValidationState", message: "defaultValidationState is not supported." });
    } else {
      payload.defaultValidationState = state;
    }
  } else if (create) {
    payload.defaultValidationState = "required";
  }
  if (hasOwn(body, "exceptionAllowed")) {
    if (typeof body.exceptionAllowed !== "boolean") {
      details.push({ field: "exceptionAllowed", message: "exceptionAllowed must be a boolean." });
    } else {
      payload.exceptionAllowed = body.exceptionAllowed;
    }
  } else if (create) {
    payload.exceptionAllowed = true;
  }
  if (hasOwn(body, "active")) {
    if (typeof body.active !== "boolean") {
      details.push({ field: "active", message: "active must be a boolean." });
    } else {
      payload.active = body.active;
    }
  } else if (create) {
    payload.active = true;
  }
  if (!create && Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy template field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyApplicationPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyTemplateId")) {
    const templateId = cleanString(body.sopPolicyTemplateId);
    if (!templateId || !UUID_RE.test(templateId)) {
      details.push({ field: "sopPolicyTemplateId", message: "sopPolicyTemplateId must be an active local template UUID." });
    } else {
      payload.sopPolicyTemplateId = templateId;
    }
  }
  if (hasOwn(body, "sopPolicyTemplateCode")) {
    const code = validateLimitedText(body.sopPolicyTemplateCode, "sopPolicyTemplateCode", MAX_SOP_TEMPLATE_CODE, details);
    if (code && !SOP_TEMPLATE_CODE_RE.test(code)) {
      details.push({ field: "sopPolicyTemplateCode", message: "sopPolicyTemplateCode must be a local SOP identifier." });
    }
    payload.sopPolicyTemplateCode = code;
  }
  if (hasOwn(body, "sopPolicyVersion")) {
    payload.sopPolicyVersion = validateLimitedText(body.sopPolicyVersion, "sopPolicyVersion", MAX_SOP_POLICY_VERSION, details);
  }
  if (hasOwn(body, "sopValidationState")) {
    const state = cleanString(body.sopValidationState);
    if (!state || !SOP_VALIDATION_STATES.has(state)) {
      details.push({ field: "sopValidationState", message: "sopValidationState is not supported." });
    } else {
      payload.sopValidationState = state;
    }
  }
  if (hasOwn(body, "sopPolicyDriftState")) {
    const state = cleanString(body.sopPolicyDriftState);
    if (!state || !SOP_POLICY_DRIFT_STATES.has(state)) {
      details.push({ field: "sopPolicyDriftState", message: "sopPolicyDriftState is not supported." });
    } else {
      payload.sopPolicyDriftState = state;
    }
  }
  if (hasOwn(body, "sopPolicyDriftReason")) {
    payload.sopPolicyDriftReason = validateLimitedText(body.sopPolicyDriftReason, "sopPolicyDriftReason", MAX_SOP_POLICY_DRIFT_REASON, details);
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy application field is required." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyExceptionClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyExceptionState")) {
    const state = cleanString(body.sopPolicyExceptionState);
    if (!state || !SOP_POLICY_EXCEPTION_STATES.has(state)) {
      details.push({ field: "sopPolicyExceptionState", message: "sopPolicyExceptionState is not supported." });
    } else {
      payload.sopPolicyExceptionState = state;
    }
  }
  if (hasOwn(body, "sopPolicyExceptionReason")) {
    payload.sopPolicyExceptionReason = validateLimitedText(
      body.sopPolicyExceptionReason,
      "sopPolicyExceptionReason",
      MAX_SOP_POLICY_EXCEPTION_REASON,
      details,
    );
  }
  if (hasOwn(body, "sopPolicyExceptionResolution")) {
    payload.sopPolicyExceptionResolution = validateLimitedText(
      body.sopPolicyExceptionResolution,
      "sopPolicyExceptionResolution",
      MAX_SOP_POLICY_EXCEPTION_RESOLUTION,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy exception closure field is required." });
  }
  if (
    ["accepted", "rejected", "closed"].includes(payload.sopPolicyExceptionState) &&
    !payload.sopPolicyExceptionResolution
  ) {
    details.push({ field: "sopPolicyExceptionResolution", message: "sopPolicyExceptionResolution is required when closing an exception." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyAuditRollupPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyAuditState")) {
    const state = cleanString(body.sopPolicyAuditState);
    if (!state || !SOP_POLICY_AUDIT_STATES.has(state)) {
      details.push({ field: "sopPolicyAuditState", message: "sopPolicyAuditState is not supported." });
    } else {
      payload.sopPolicyAuditState = state;
    }
  }
  if (hasOwn(body, "sopPolicyAuditNote")) {
    payload.sopPolicyAuditNote = validateLimitedText(
      body.sopPolicyAuditNote,
      "sopPolicyAuditNote",
      MAX_SOP_POLICY_AUDIT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy audit field is required." });
  }
  if (payload.sopPolicyAuditState === "needs_followup" && !payload.sopPolicyAuditNote) {
    details.push({ field: "sopPolicyAuditNote", message: "sopPolicyAuditNote is required when audit needs follow-up." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceState")) {
    const state = cleanString(body.sopPolicyGovernanceState);
    if (!state || !SOP_POLICY_GOVERNANCE_STATES.has(state)) {
      details.push({ field: "sopPolicyGovernanceState", message: "sopPolicyGovernanceState is not supported." });
    } else {
      payload.sopPolicyGovernanceState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceNote")) {
    payload.sopPolicyGovernanceNote = validateLimitedText(
      body.sopPolicyGovernanceNote,
      "sopPolicyGovernanceNote",
      MAX_SOP_POLICY_GOVERNANCE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance field is required." });
  }
  if (payload.sopPolicyGovernanceState === "needs_followup" && !payload.sopPolicyGovernanceNote) {
    details.push({ field: "sopPolicyGovernanceNote", message: "sopPolicyGovernanceNote is required when governance needs follow-up." });
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

    async getClinicalFollowUpSopValidationSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopValidationSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_validation.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          sopRequired: summary.sopRequired,
          sopValidated: summary.sopValidated,
          localSopEvents: summary.localSopEvents,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyTemplateSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyTemplateSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_template.summary",
        entityType: "clinical_follow_up_sop_policy_template",
        correlationId,
        metadata: {
          totalTemplates: summary.totalTemplates,
          activeTemplates: summary.activeTemplates,
          localPolicyEvents: summary.localPolicyEvents,
        },
      });
      return { summary, scope };
    },

    async listClinicalFollowUpSopPolicyTemplates(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const result = await clinicalFollowUpRepository.listClinicalFollowUpSopPolicyTemplates({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_template.list",
        entityType: "clinical_follow_up_sop_policy_template",
        correlationId,
        metadata: {
          count: result.items.length,
          activeOnly: Boolean(params?.activeOnly),
        },
      });
      return { result, scope };
    },

    async getClinicalFollowUpSopPolicyApplicationSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyApplicationSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_application.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          activeTemplates: summary.activeTemplates,
          needsPolicyApplication: summary.needsPolicyApplication,
          reviewRequired: summary.reviewRequired,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyExceptionClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyExceptionClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_exception_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          openExceptions: summary.openExceptions,
          unresolvedDrift: summary.unresolvedDrift,
          closedExceptions: summary.closedExceptions,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyAuditRollupSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyAuditRollupSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_audit_rollup.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          auditReady: summary.auditReady,
          needsAuditReview: summary.needsAuditReview,
          reviewedAudits: summary.reviewedAudits,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceReadinessSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceReadinessSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_readiness.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          governanceReady: summary.governanceReady,
          needsGovernanceReview: summary.needsGovernanceReview,
          reviewedGovernance: summary.reviewedGovernance,
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

    async createClinicalFollowUpSopPolicyTemplate(input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const payload = normalizeClinicalFollowUpSopPolicyTemplatePayload(input, { create: true });
      const clinicId = payload.clinicId || (!scope.allClinics && scope.clinicIds.length === 1 ? scope.clinicIds[0] : null);
      if (!clinicId) {
        throw new ClinicalFollowUpValidationError([{ field: "clinicId", message: "clinicId is required for this scope." }]);
      }
      const template = await clinicalFollowUpRepository.createClinicalFollowUpSopPolicyTemplate({
        clinicId,
        actorUserId: authContext.userId,
        payload: { ...payload, clinicId },
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!template) throw new ClinicalFollowUpNotFoundError("Clinic was not found.");
      await audit(auditRepository, {
        clinicId: template.clinicId || clinicId,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_template.create",
        entityType: "clinical_follow_up_sop_policy_template",
        entityId: template.id,
        correlationId,
        metadata: {
          code: template.code,
          version: template.version,
          active: template.active,
        },
      });
      return { template, scope };
    },

    async updateClinicalFollowUpSopPolicyTemplate(templateId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyTemplatePayload(input, { create: false });
      const template = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyTemplate({
        templateId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!template) throw new ClinicalFollowUpNotFoundError("SOP policy template was not found.");
      await audit(auditRepository, {
        clinicId: template.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_template.update",
        entityType: "clinical_follow_up_sop_policy_template",
        entityId: template.id,
        correlationId,
        metadata: {
          code: template.code,
          version: template.version,
          active: template.active,
        },
      });
      return { template, scope };
    },

    async updateClinicalFollowUpSopValidation(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopValidationUpdatePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopValidation({
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
        action: "clinical_follow_up.sop_validation.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopValidationState: followUp.sopValidationState,
          sopPolicyVersion: followUp.sopPolicyVersion,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyApplication(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyApplicationPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyApplication({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up or active SOP policy template was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_application.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyTemplateId: followUp.sopPolicyTemplateId,
          sopPolicyVersion: followUp.sopPolicyVersion,
          sopPolicyDriftState: followUp.sopPolicyDriftState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyExceptionClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyExceptionClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyExceptionClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy exception was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_exception_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyExceptionState: followUp.sopPolicyExceptionState,
          sopPolicyDriftState: followUp.sopPolicyDriftState,
          sopValidationState: followUp.sopValidationState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyAuditRollup(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyAuditRollupPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyAuditRollup({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy audit was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_audit_rollup.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyAuditState: followUp.sopPolicyAuditState,
          sopPolicyDriftState: followUp.sopPolicyDriftState,
          sopPolicyExceptionState: followUp.sopPolicyExceptionState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceReadiness(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceReadinessPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceReadiness({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance review was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_readiness.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceState: followUp.sopPolicyGovernanceState,
          sopPolicyAuditState: followUp.sopPolicyAuditState,
          sopPolicyExceptionState: followUp.sopPolicyExceptionState,
        },
      });
      return { followUp, scope };
    },
  };
}
