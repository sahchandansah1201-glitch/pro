// Stage 5L · Self-hosted lead/appointment write service.
// Validates intake payloads, applies RBAC, and records audit events.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, leadsAppointmentsWriteScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LEAD_SOURCE_VALUES = new Set(["telegram", "whatsapp", "site", "operator", "phone", "portal", "other"]);
const LEAD_STATUS_UPDATE_VALUES = new Set(["new", "qualified", "lost"]);
const MAX_SUMMARY_LENGTH = 500;
const MAX_COMPLAINT_LENGTH = 500;

export class LeadAppointmentValidationError extends Error {
  constructor(details = [], message = "Lead/appointment payload failed validation.") {
    super(message);
    this.name = "LeadAppointmentValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class LeadAppointmentNotFoundError extends Error {
  constructor(message = "Lead was not found in the allowed clinic scope.") {
    super(message);
    this.name = "LeadAppointmentNotFoundError";
    this.publicCode = "lead_not_found";
    this.publicStatus = 404;
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
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

export function assertLeadUuid(value, field = "leadId") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    throw new LeadAppointmentValidationError([{ field, message: `${field} must be a UUID.` }]);
  }
  return text;
}

function validateUuid(value, field, details) {
  if (value != null && !UUID_PATTERN.test(String(value))) {
    details.push({ field, message: `${field} must be a UUID.` });
  }
}

function validateIsoDateTime(value, field, details) {
  if (!value) {
    details.push({ field, message: `${field} is required.` });
    return;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
  }
}

export function resolveLeadWriteClinicId(scope, requestedClinicId = null) {
  if (scope.allClinics) {
    if (!requestedClinicId) {
      throw new LeadAppointmentValidationError([
        { field: "clinicId", message: "System administrators must choose a clinic." },
      ]);
    }
    return requestedClinicId;
  }
  if (requestedClinicId && !scope.clinicIds.includes(requestedClinicId)) {
    throw new ForbiddenError("The selected clinic is outside the authenticated user's scope.");
  }
  if (requestedClinicId) return requestedClinicId;
  if (scope.clinicIds.length === 1) return scope.clinicIds[0];
  throw new LeadAppointmentValidationError([
    { field: "clinicId", message: "Clinic ID is required when multiple clinic scopes are available." },
  ]);
}

export function normalizeCreateLeadPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new LeadAppointmentValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {
    clinicId: cleanString(input.clinicId),
    patientId: cleanString(input.patientId),
    source: cleanString(input.source) || "operator",
    safeSummary: cleanString(input.safeSummary),
  };
  const details = [];
  validateUuid(payload.clinicId, "clinicId", details);
  validateUuid(payload.patientId, "patientId", details);
  if (!LEAD_SOURCE_VALUES.has(payload.source)) {
    details.push({ field: "source", message: "Lead source is not supported." });
  }
  if (!payload.safeSummary) {
    details.push({ field: "safeSummary", message: "Safe summary is required." });
  } else if (payload.safeSummary.length > MAX_SUMMARY_LENGTH) {
    details.push({ field: "safeSummary", message: "Safe summary is too long." });
  }
  if (details.length > 0) throw new LeadAppointmentValidationError(details);
  return payload;
}

export function normalizeUpdateLeadStatusPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new LeadAppointmentValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const status = cleanString(input.status);
  const details = [];
  if (!status || !LEAD_STATUS_UPDATE_VALUES.has(status)) {
    details.push({ field: "status", message: "Status must be new, qualified, or lost." });
  }
  if (details.length > 0) throw new LeadAppointmentValidationError(details);
  return { status };
}

export function normalizeBookLeadAppointmentPayload(input = {}, authContext = {}) {
  if (!isPlainObject(input)) {
    throw new LeadAppointmentValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const roles = Array.isArray(authContext.roles) ? authContext.roles : [];
  const requestedDoctorUserId = cleanString(input.doctorUserId);
  const payload = {
    patientId: cleanString(input.patientId),
    doctorUserId: roles.includes("doctor") ? (requestedDoctorUserId || authContext.userId) : requestedDoctorUserId,
    startedAt: cleanString(input.startedAt),
    chiefComplaint: cleanString(input.chiefComplaint),
  };
  const details = [];
  validateUuid(payload.patientId, "patientId", details);
  validateUuid(payload.doctorUserId, "doctorUserId", details);
  validateIsoDateTime(payload.startedAt, "startedAt", details);
  if (payload.chiefComplaint && payload.chiefComplaint.length > MAX_COMPLAINT_LENGTH) {
    details.push({ field: "chiefComplaint", message: "Chief complaint is too long." });
  }
  if (details.length > 0) throw new LeadAppointmentValidationError(details);
  return payload;
}

function requireLead(lead) {
  if (!lead) throw new LeadAppointmentNotFoundError();
  return lead;
}

function requireBooking(result) {
  if (!result?.lead || !result?.appointment) {
    throw new LeadAppointmentNotFoundError("Lead was not found or cannot be booked without a patient.");
  }
  return result;
}

export function createLeadsAppointmentsWriteService({
  leadsAppointmentsWriteRepository,
  auditRepository,
} = {}) {
  return {
    async createLead(input, authContext, { correlationId } = {}) {
      const scope = leadsAppointmentsWriteScope(authContext);
      const payload = normalizeCreateLeadPayload(input);
      const clinicId = resolveLeadWriteClinicId(scope, payload.clinicId);
      const lead = requireLead(
        await leadsAppointmentsWriteRepository.createLead({
          ...payload,
          clinicId,
          actorUserId: authContext.userId,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId,
        actorUserId: authContext.userId,
        action: "lead.create",
        entityType: "lead",
        entityId: lead.id,
        correlationId,
        metadata: {
          source: lead.source,
          hasPatient: Boolean(lead.patientId),
        },
      });
      return { lead, scope };
    },

    async updateLeadStatus(leadId, input, authContext, { correlationId } = {}) {
      const safeLeadId = assertLeadUuid(leadId);
      const scope = leadsAppointmentsWriteScope(authContext);
      const payload = normalizeUpdateLeadStatusPayload(input);
      const lead = requireLead(
        await leadsAppointmentsWriteRepository.updateLeadStatus({
          leadId: safeLeadId,
          status: payload.status,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: lead.clinic.id || null,
        actorUserId: authContext.userId,
        action: "lead.status.update",
        entityType: "lead",
        entityId: lead.id,
        correlationId,
        metadata: { status: lead.status },
      });
      return { lead, scope };
    },

    async bookLeadAppointment(leadId, input, authContext, { correlationId } = {}) {
      const safeLeadId = assertLeadUuid(leadId);
      const scope = leadsAppointmentsWriteScope(authContext);
      const payload = normalizeBookLeadAppointmentPayload(input, authContext);
      const booking = requireBooking(
        await leadsAppointmentsWriteRepository.bookLeadAppointment({
          leadId: safeLeadId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
          ...payload,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: booking.lead.clinic.id || booking.appointment.clinic.id || null,
        actorUserId: authContext.userId,
        action: "lead.appointment.book",
        entityType: "visit",
        entityId: booking.appointment.id,
        correlationId,
        metadata: {
          leadId: booking.lead.id,
          patientId: booking.appointment.patientId,
          doctorUserId: booking.appointment.doctorUserId,
        },
      });
      return { ...booking, scope };
    },
  };
}
