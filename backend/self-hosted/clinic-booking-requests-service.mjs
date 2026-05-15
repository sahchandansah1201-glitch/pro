// Stage 5P · Self-hosted clinic booking requests intake service.
// Validates operator/clinic-side payloads, applies RBAC scope, and audits.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import {
  ForbiddenError,
  leadsAppointmentsWriteScope,
  requireAnyRole,
} from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STATUS_VALUES = new Set(["all", "requested", "reviewing", "booked", "cancelled"]);
const UPDATE_STATUS_VALUES = new Set(["reviewing", "booked", "cancelled"]);
const MAX_NOTE_LENGTH = 500;
export const CLINIC_BOOKING_REQUESTS_READ_ROLES = ["system_admin", "clinic_admin", "operator"];

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
    this.publicCode = "booking_request_not_found";
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

function assertUuid(value, field = "id") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    throw new ClinicBookingRequestValidationError([
      { field, message: `${field} must be a UUID.` },
    ]);
  }
  return text;
}

export function clinicBookingRequestsReadScope(authContext) {
  const scoped = requireAnyRole(authContext, CLINIC_BOOKING_REQUESTS_READ_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles, userId: scoped.userId };
  }
  const clinicIds = (Array.isArray(scoped.clinicIds) ? scoped.clinicIds : [])
    .map(String)
    .filter(Boolean);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles, userId: scoped.userId };
}

export function clinicBookingRequestsWriteScope(authContext) {
  // Reuses Stage 5L write scope: same operator/clinic_admin/system_admin and
  // (additionally) doctor — but doctor is intentionally not granted write
  // permission for the patient-side request workflow. Filter it out here so
  // that doctors can read patient records but cannot mutate booking requests.
  const scoped = leadsAppointmentsWriteScope(authContext);
  if (!scoped.roles.some((role) => CLINIC_BOOKING_REQUESTS_READ_ROLES.includes(role))) {
    throw new ForbiddenError("The authenticated user cannot mutate clinic booking requests.");
  }
  return scoped;
}

export function normalizeListClinicBookingRequestsParams(searchParams) {
  const params =
    searchParams && typeof searchParams.get === "function"
      ? searchParams
      : new URLSearchParams();
  const status = cleanString(params.get("status")) || "all";
  if (!STATUS_VALUES.has(status)) {
    throw new ClinicBookingRequestValidationError([
      { field: "status", message: "status must be all, requested, reviewing, booked, or cancelled." },
    ]);
  }
  const limitRaw = Number(params.get("limit") || 50);
  const offsetRaw = Number(params.get("offset") || 0);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { status, limit, offset };
}

export function normalizeUpdateClinicBookingRequestPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new ClinicBookingRequestValidationError([
      { field: "body", message: "JSON object is required." },
    ]);
  }
  const status = cleanString(input.status);
  const details = [];
  if (!status || !UPDATE_STATUS_VALUES.has(status)) {
    details.push({
      field: "status",
      message: "status must be reviewing, booked, or cancelled.",
    });
  }
  const assignedVisitId = cleanString(input.assignedVisitId);
  if (assignedVisitId && !UUID_PATTERN.test(assignedVisitId)) {
    details.push({ field: "assignedVisitId", message: "assignedVisitId must be a UUID." });
  }
  if (status === "booked" && !assignedVisitId) {
    details.push({
      field: "assignedVisitId",
      message: "assignedVisitId is required when status is booked.",
    });
  }
  const clinicNote = cleanString(input.clinicNote);
  if (clinicNote && clinicNote.length > MAX_NOTE_LENGTH) {
    details.push({ field: "clinicNote", message: "clinicNote is too long." });
  }
  if (details.length > 0) throw new ClinicBookingRequestValidationError(details);
  return {
    status,
    assignedVisitId: status === "booked" ? assignedVisitId : assignedVisitId || null,
    clinicNote: clinicNote || null,
  };
}

function requireBookingRequest(item) {
  if (!item) throw new ClinicBookingRequestNotFoundError();
  return item;
}

export function createClinicBookingRequestsService({
  clinicBookingRequestsRepository,
  auditRepository,
} = {}) {
  return {
    async listBookingRequests(authContext, params, { correlationId } = {}) {
      const scope = clinicBookingRequestsReadScope(authContext);
      const normalized = params && params.status
        ? params
        : normalizeListClinicBookingRequestsParams(params);
      const queryParams = {
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        status: normalized.status,
        limit: normalized.limit,
        offset: normalized.offset,
      };
      const [items, counts] = await Promise.all([
        clinicBookingRequestsRepository.listBookingRequests(queryParams),
        clinicBookingRequestsRepository.countBookingRequests({
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
          status: "all",
        }),
      ]);
      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: scope.userId,
        action: "clinic_booking_requests.list",
        entityType: "patient_portal_booking_request",
        entityId: null,
        correlationId,
        metadata: {
          status: normalized.status,
          limit: normalized.limit,
          offset: normalized.offset,
          returned: items.length,
        },
      });
      return {
        items,
        counts,
        filters: normalized,
        scope,
      };
    },

    async getBookingRequest(bookingRequestId, authContext, { correlationId } = {}) {
      const scope = clinicBookingRequestsReadScope(authContext);
      const safeId = assertUuid(bookingRequestId, "bookingRequestId");
      const item = requireBookingRequest(
        await clinicBookingRequestsRepository.getBookingRequest({
          bookingRequestId: safeId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: item.clinic?.id || null,
        actorUserId: scope.userId,
        action: "clinic_booking_requests.read",
        entityType: "patient_portal_booking_request",
        entityId: item.id,
        correlationId,
      });
      return { item, scope };
    },

    async updateBookingRequest(bookingRequestId, input, authContext, { correlationId } = {}) {
      const scope = clinicBookingRequestsWriteScope(authContext);
      const safeId = assertUuid(bookingRequestId, "bookingRequestId");
      const payload = normalizeUpdateClinicBookingRequestPayload(input);
      const item = requireBookingRequest(
        await clinicBookingRequestsRepository.updateBookingRequest({
          bookingRequestId: safeId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
          reviewerUserId: authContext.userId,
          status: payload.status,
          assignedVisitId: payload.assignedVisitId,
          clinicNote: payload.clinicNote,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: item.clinic?.id || null,
        actorUserId: scope.userId,
        action: "clinic_booking_requests.update",
        entityType: "patient_portal_booking_request",
        entityId: item.id,
        correlationId,
        metadata: {
          status: item.status,
          assignedVisitId: item.assignedVisitId,
        },
      });
      return { item, scope };
    },
  };
}
