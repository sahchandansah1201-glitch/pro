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
const SOP_POLICY_GOVERNANCE_CLOSURE_STATES = new Set(["not_started", "ready", "closed", "needs_followup"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_STATES = new Set(["not_started", "ready", "exported", "needs_followup"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_STATES = new Set(["not_started", "ready", "reconciled", "mismatch", "needs_followup"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_STATES = new Set(["not_started", "ready", "closed", "closure_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_STATES = new Set(["not_started", "ready", "archived", "archive_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_STATES = new Set(["not_started", "ready", "closed", "closure_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_STATES = new Set(["not_started", "ready", "handed_off", "handoff_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_STATES = new Set(["not_started", "ready", "reconciled", "reconciliation_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_STATES = new Set(["not_started", "ready", "closed", "closure_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_STATES = new Set(["not_started", "ready", "archived", "archive_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_STATES = new Set(["not_started", "ready", "closed", "closure_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_STATES = new Set(["not_started", "ready", "handed_off", "handoff_exception", "needs_rework"]);
const SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_STATES = new Set(["not_started", "ready", "received", "receipt_exception", "needs_rework"]);
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
const MAX_SOP_POLICY_GOVERNANCE_CLOSURE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_NOTE = 2000;
const MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_NOTE = 2000;
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

export function normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceClosureState")) {
    const state = cleanString(body.sopPolicyGovernanceClosureState);
    if (!state || !SOP_POLICY_GOVERNANCE_CLOSURE_STATES.has(state)) {
      details.push({ field: "sopPolicyGovernanceClosureState", message: "sopPolicyGovernanceClosureState is not supported." });
    } else {
      payload.sopPolicyGovernanceClosureState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceClosureNote")) {
    payload.sopPolicyGovernanceClosureNote = validateLimitedText(
      body.sopPolicyGovernanceClosureNote,
      "sopPolicyGovernanceClosureNote",
      MAX_SOP_POLICY_GOVERNANCE_CLOSURE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance closure field is required." });
  }
  if (payload.sopPolicyGovernanceClosureState === "needs_followup" && !payload.sopPolicyGovernanceClosureNote) {
    details.push({ field: "sopPolicyGovernanceClosureNote", message: "sopPolicyGovernanceClosureNote is required when governance closure needs follow-up." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_STATES.has(state)) {
      details.push({ field: "sopPolicyGovernanceEvidenceState", message: "sopPolicyGovernanceEvidenceState is not supported." });
    } else {
      payload.sopPolicyGovernanceEvidenceState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceNote")) {
    payload.sopPolicyGovernanceEvidenceNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceNote,
      "sopPolicyGovernanceEvidenceNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence field is required." });
  }
  if (payload.sopPolicyGovernanceEvidenceState === "needs_followup" && !payload.sopPolicyGovernanceEvidenceNote) {
    details.push({ field: "sopPolicyGovernanceEvidenceNote", message: "sopPolicyGovernanceEvidenceNote is required when governance evidence needs follow-up." });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_STATES.has(state)) {
      details.push({ field: "sopPolicyGovernanceEvidenceReconciliationState", message: "sopPolicyGovernanceEvidenceReconciliationState is not supported." });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationNote,
      "sopPolicyGovernanceEvidenceReconciliationNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation field is required." });
  }
  if (
    ["mismatch", "needs_followup"].includes(payload.sopPolicyGovernanceEvidenceReconciliationState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationNote",
      message: "sopPolicyGovernanceEvidenceReconciliationNote is required when reconciliation needs follow-up.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure field is required." });
  }
  if (
    ["closure_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureNote is required when reconciliation closure is not closed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt field is required." });
  }
  if (
    ["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptNote is required when closure receipt is not received.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive readiness field is required." });
  }
  if (
    ["archive_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessNote is required when archive readiness is not ready.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure field is required." });
  }
  if (
    ["closure_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureNote is required when archive closure is not closed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt field is required." });
  }
  if (
    ["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptNote is required when archive closure receipt is not received.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff field is required." });
  }
  if (
    ["handoff_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffNote is required when archive closure receipt handoff is not completed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt field is required." });
  }
  if (
    ["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptNote is required when archive closure receipt handoff receipt is not received.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation field is required." });
  }
  if (
    ["reconciliation_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationNote is required when archive closure receipt handoff receipt reconciliation is not completed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure field is required." });
  }
  if (
    ["closure_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState) &&
    !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote
  ) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureNote is required when archive closure receipt handoff receipt reconciliation closure is not completed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt field is required." });
  }
  if (["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptNote is required when archive closure receipt handoff receipt reconciliation closure receipt is not received.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}
export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness field is required." });
  }
  if (["archive_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessNote is required when archive closure receipt handoff receipt reconciliation closure receipt archive readiness is not ready.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}
export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure field is required." });
  }
  if (["closure_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureNote is required when archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure is not closed.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff field is required." });
  }
  if (["handoff_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffNote is required when archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff is not handed off.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptPayload(input = {}) {
  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_HANDOFF_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt field is required." });
  }
  if (["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptNote is required when archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt is not received.",
    });
  }
  if (details.length > 0) throw new ClinicalFollowUpValidationError(details);
  return payload;
}

export function normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload(input = {}) {

  const body = requireBodyObject(input);
  const details = [];
  const payload = {};

  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState")) {
    const state = cleanString(body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState);
    if (!state || !SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_STATES.has(state)) {
      details.push({
        field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState",
        message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState is not supported.",
      });
    } else {
      payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState = state;
    }
  }
  if (hasOwn(body, "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote")) {
    payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote = validateLimitedText(
      body.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote,
      "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote",
      MAX_SOP_POLICY_GOVERNANCE_EVIDENCE_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_CLOSURE_RECEIPT_HANDOFF_RECEIPT_RECONCILIATION_CLOSURE_RECEIPT_ARCHIVE_READINESS_CLOSURE_RECEIPT_NOTE,
      details,
    );
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt field is required." });
  }
  if (["receipt_exception", "needs_rework"].includes(payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState) && !payload.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote) {
    details.push({
      field: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote",
      message: "sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptNote is required when archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt is not received.",
    });
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

    async getClinicalFollowUpSopPolicyGovernanceClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          closureReady: summary.closureReady,
          needsClosureReview: summary.needsClosureReview,
          closedGovernanceReviews: summary.closedGovernanceReviews,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          evidenceReady: summary.evidenceReady,
          needsEvidenceReview: summary.needsEvidenceReview,
          exportedGovernanceEvidence: summary.exportedGovernanceEvidence,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          reconciliationReady: summary.reconciliationReady,
          needsReconciliation: summary.needsReconciliation,
          reconciledGovernanceEvidence: summary.reconciledGovernanceEvidence,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          reconciliationClosureReady: summary.reconciliationClosureReady,
          needsReconciliationClosure: summary.needsReconciliationClosure,
          closedReconciliationEvidence: summary.closedReconciliationEvidence,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          closureReceiptReady: summary.closureReceiptReady,
          needsClosureReceipt: summary.needsClosureReceipt,
          receivedClosureReceipts: summary.receivedClosureReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveReadinessReady: summary.archiveReadinessReady,
          needsArchiveReadiness: summary.needsArchiveReadiness,
          archivedLocal: summary.archivedLocal,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReady: summary.archiveClosureReady,
          needsArchiveClosure: summary.needsArchiveClosure,
          closedLocalArchives: summary.closedLocalArchives,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptReady: summary.archiveClosureReceiptReady,
          needsArchiveClosureReceipt: summary.needsArchiveClosureReceipt,
          receivedArchiveClosureReceipts: summary.receivedArchiveClosureReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReady: summary.archiveClosureReceiptHandoffReady,
          needsArchiveClosureReceiptHandoff: summary.needsArchiveClosureReceiptHandoff,
          handedOffArchiveClosureReceipts: summary.handedOffArchiveClosureReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReady: summary.archiveClosureReceiptHandoffReceiptReady,
          needsArchiveClosureReceiptHandoffReceipt: summary.needsArchiveClosureReceiptHandoffReceipt,
          receivedArchiveClosureReceiptHandoffReceipts: summary.receivedArchiveClosureReceiptHandoffReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationReady: summary.archiveClosureReceiptHandoffReceiptReconciliationReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliation: summary.needsArchiveClosureReceiptHandoffReceiptReconciliation,
          reconciledArchiveClosureReceiptHandoffReceipts: summary.reconciledArchiveClosureReceiptHandoffReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt,
          receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: summary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts,
        },
      });
      return { summary, scope };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness,
          archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts: summary.archivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipts,
        },
      });
      return { summary, scope };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure,
          closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures: summary.closedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosures,
        },
      });
      return { summary, scope };
    },    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt,
          receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts: summary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipts,
        },
      });
      return { summary, scope };
    },
    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff,
          handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs: summary.handedOffArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffs,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt,
          receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts: summary.receivedArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipts,
        },
      });
      return { summary, scope };
    },

    async getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary(params, authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const summary = await clinicalFollowUpRepository.getClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureSummary({
        ...params,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      await audit(auditRepository, {
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.summary",
        entityType: "clinical_follow_up",
        correlationId,
        metadata: {
          archiveClosureReceiptHandoffReceiptReconciliationClosureReady: summary.archiveClosureReceiptHandoffReceiptReconciliationClosureReady,
          needsArchiveClosureReceiptHandoffReceiptReconciliationClosure: summary.needsArchiveClosureReceiptHandoffReceiptReconciliationClosure,
          closedArchiveClosureReceiptHandoffReceiptReconciliations: summary.closedArchiveClosureReceiptHandoffReceiptReconciliations,
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

    async updateClinicalFollowUpSopPolicyGovernanceClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance closure was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceClosureState: followUp.sopPolicyGovernanceClosureState,
          sopPolicyGovernanceState: followUp.sopPolicyGovernanceState,
          sopPolicyAuditState: followUp.sopPolicyAuditState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidence(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidencePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidence({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceState: followUp.sopPolicyGovernanceEvidenceState,
          sopPolicyGovernanceClosureState: followUp.sopPolicyGovernanceClosureState,
          sopPolicyGovernanceState: followUp.sopPolicyGovernanceState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliation({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationState,
          sopPolicyGovernanceEvidenceState: followUp.sopPolicyGovernanceEvidenceState,
          sopPolicyGovernanceClosureState: followUp.sopPolicyGovernanceClosureState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureState,
          sopPolicyGovernanceEvidenceReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationState,
          sopPolicyGovernanceEvidenceState: followUp.sopPolicyGovernanceEvidenceState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureState,
          sopPolicyGovernanceEvidenceReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadiness({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive readiness was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_readiness.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveReadinessState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoff({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliation({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState,
        },
      });
      return { followUp, scope };
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadiness({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState,
        },
      });
      return { followUp, scope };
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState,
        },
      });
      return { followUp, scope };
    },    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptState,
        },
      });
      return { followUp, scope };
    },
    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoff({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptPayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceipt({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure receipt archive readiness closure receipt handoff receipt was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure_receipt_archive_readiness_closure_receipt_handoff_receipt.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptHandoffReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureReceiptState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureReceiptArchiveReadinessClosureState,
        },
      });
      return { followUp, scope };
    },

    async updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure(followUpId, input, authContext, { correlationId } = {}) {
      const scope = visitWriteScope(authContext);
      const changes = normalizeClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosurePayload(input);
      const followUp = await clinicalFollowUpRepository.updateClinicalFollowUpSopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosure({
        followUpId,
        actorUserId: authContext.userId,
        changes,
        allClinics: scope.allClinics,
        clinicIds: scope.clinicIds,
      });
      if (!followUp) throw new ClinicalFollowUpNotFoundError("Follow-up SOP policy governance evidence reconciliation closure receipt archive closure receipt handoff receipt reconciliation closure was not found.");
      await audit(auditRepository, {
        clinicId: followUp.clinicId || null,
        actorUserId: authContext.userId,
        action: "clinical_follow_up.sop_policy_governance_evidence_reconciliation_closure_receipt_archive_closure_receipt_handoff_receipt_reconciliation_closure.update",
        entityType: "clinical_follow_up",
        entityId: followUp.id,
        correlationId,
        metadata: {
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationClosureState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptReconciliationState,
          sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState: followUp.sopPolicyGovernanceEvidenceReconciliationClosureReceiptArchiveClosureReceiptHandoffReceiptState,
        },
      });
      return { followUp, scope };
    },
  };
}
