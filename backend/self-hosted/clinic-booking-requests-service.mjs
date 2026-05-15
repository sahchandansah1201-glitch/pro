// Stage 5P · Clinic booking requests service.
// Operators and clinic admins review patient portal booking requests inside the
// self-hosted product. External CRM/ad intake is intentionally not called here.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, leadsAppointmentsReadScope, leadsAppointmentsWriteScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UPDATE_STATUS_VALUES = new Set(["requested", "reviewing", "booked", "cancelled"]);
const MAX_NOTE_LENGTH = 1000;

export class ClinicBookingRequestValidationError extends Error {
  constructor(details = [], message = "Clinic booking request payload failed validation.") {
    super(message);
    this.name = "ClinicBookingRequestValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class ClinicBookingRequestNotFoundError extends Error {
  constructor(message = "Booking request was not found in the allowed clinic scope.") {
    super(message);
    this.name = "ClinicBookingRequestNotFoundError";
    this.publicCode = "not_found";
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

export function assertClinicBookingRequestUuid(value, field = "requestId") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.publicCode = "invalid_uuid";
    error.publicStatus = 400;
    throw error;
  }
  return text;
}

function validateUuid(value, field, details) {
  if (value != null && !UUID_PATTERN.test(String(value))) {
    details.push({ field, message: `${field} must be a UUID.` });
  }
}

export function normalizeClinicBookingRequestUpdatePayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new ClinicBookingRequestValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const payload = {};

  if (hasOwn(input, "status")) {
    const status = cleanString(input.status);
    if (!status || !UPDATE_STATUS_VALUES.has(status)) {
      details.push({ field: "status", message: "Status must be requested, reviewing, booked, or cancelled." });
    } else {
      payload.status = status;
    }
  }

  if (hasOwn(input, "clinicNote")) {
    const clinicNote = cleanString(input.clinicNote);
    if (clinicNote && clinicNote.length > MAX_NOTE_LENGTH) {
      details.push({ field: "clinicNote", message: "Clinic note is too long." });
    } else {
      payload.clinicNote = clinicNote;
    }
  }

  if (hasOwn(input, "assignedVisitId")) {
    const assignedVisitId = cleanString(input.assignedVisitId);
    validateUuid(assignedVisitId, "assignedVisitId", details);
    payload.assignedVisitId = assignedVisitId;
  }

  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one booking request field is required." });
  }

  if (payload.status === "booked" && !payload.assignedVisitId) {
    details.push({ field: "assignedVisitId", message: "Booked requests must reference a visit." });
  }

  if (details.length > 0) throw new ClinicBookingRequestValidationError(details);
  return payload;
}

export function normalizeClinicBookingRequestSlotBookingPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new ClinicBookingRequestValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const slotId = cleanString(input.slotId);
  if (!slotId) {
    details.push({ field: "slotId", message: "slotId is required." });
  } else {
    validateUuid(slotId, "slotId", details);
  }

  const payload = { slotId };
  if (hasOwn(input, "clinicNote")) {
    const clinicNote = cleanString(input.clinicNote);
    if (clinicNote && clinicNote.length > MAX_NOTE_LENGTH) {
      details.push({ field: "clinicNote", message: "Clinic note is too long." });
    } else {
      payload.clinicNote = clinicNote;
    }
  }

  if (details.length > 0) throw new ClinicBookingRequestValidationError(details);
  return payload;
}

function requireRequest(row) {
  if (!row) throw new ClinicBookingRequestNotFoundError();
  return row;
}

function ensureClinicOperatorScope(scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("doctor") && !roles.some((role) => ["operator", "clinic_admin", "system_admin"].includes(role))) {
    throw new ForbiddenError("Clinic booking request intake is reserved for operators and administrators.");
  }
}

export function createClinicBookingRequestsService({
  clinicBookingRequestsRepository,
  auditRepository,
} = {}) {
  return {
    async listBookingRequests(authContext, params = {}, { correlationId } = {}) {
      const scope = leadsAppointmentsReadScope(authContext);
      ensureClinicOperatorScope(scope);
      const queue = await clinicBookingRequestsRepository.listBookingRequests({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "clinic_booking_request.list",
        entityType: "patient_portal_booking_request",
        correlationId,
        metadata: {
          allClinics: scope.allClinics,
          count: queue.items.length,
          status: queue.filters.status,
        },
      });
      return { queue, scope };
    },

    async getBookingRequest(requestId, authContext, { correlationId } = {}) {
      const safeRequestId = assertClinicBookingRequestUuid(requestId);
      const scope = leadsAppointmentsReadScope(authContext);
      ensureClinicOperatorScope(scope);
      const bookingRequest = requireRequest(
        await clinicBookingRequestsRepository.getBookingRequest({
          requestId: safeRequestId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: bookingRequest.clinic.id || null,
        actorUserId: authContext.userId,
        action: "clinic_booking_request.read",
        entityType: "patient_portal_booking_request",
        entityId: bookingRequest.id,
        correlationId,
        metadata: {
          status: bookingRequest.status,
          allClinics: scope.allClinics,
        },
      });
      return { bookingRequest, scope };
    },

    async updateBookingRequest(requestId, input, authContext, { correlationId } = {}) {
      const safeRequestId = assertClinicBookingRequestUuid(requestId);
      const scope = leadsAppointmentsWriteScope(authContext);
      ensureClinicOperatorScope(scope);
      const payload = normalizeClinicBookingRequestUpdatePayload(input);
      const bookingRequest = requireRequest(
        await clinicBookingRequestsRepository.updateBookingRequest({
          requestId: safeRequestId,
          ...payload,
          reviewedByUserId: authContext.userId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: bookingRequest.clinic.id || null,
        actorUserId: authContext.userId,
        action: "clinic_booking_request.update",
        entityType: "patient_portal_booking_request",
        entityId: bookingRequest.id,
        correlationId,
        metadata: {
          status: bookingRequest.status,
          assignedVisitId: bookingRequest.assignedVisitId,
          hasClinicNote: Boolean(bookingRequest.clinicNote),
        },
      });
      return { bookingRequest, scope };
    },

    async bookBookingRequestFromSlot(requestId, input, authContext, { correlationId } = {}) {
      const safeRequestId = assertClinicBookingRequestUuid(requestId);
      const scope = leadsAppointmentsWriteScope(authContext);
      ensureClinicOperatorScope(scope);
      const payload = normalizeClinicBookingRequestSlotBookingPayload(input);
      const bookingRequest = requireRequest(
        await clinicBookingRequestsRepository.bookBookingRequestFromSlot({
          requestId: safeRequestId,
          slotId: payload.slotId,
          clinicNote: payload.clinicNote,
          reviewedByUserId: authContext.userId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: bookingRequest.clinic.id || null,
        actorUserId: authContext.userId,
        action: "clinic_booking_request.book_from_slot",
        entityType: "patient_portal_booking_request",
        entityId: bookingRequest.id,
        correlationId,
        metadata: {
          slotId: payload.slotId,
          assignedVisitId: bookingRequest.assignedVisitId,
          hasClinicNote: Boolean(bookingRequest.clinicNote),
          source: "local_slot_cache",
        },
      });
      return { bookingRequest, scope };
    },
  };
}
