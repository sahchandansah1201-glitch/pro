// Stage 5N/5O · Patient portal service.
// Only the linked patient account may read/write /api/v1/me/* resources.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { patientPortalScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REMINDER_CHANNELS = new Set(["email", "phone", "none"]);
const MAX_BOOKING_REASON_LENGTH = 500;

class PatientPortalNotFoundError extends Error {
  constructor(message = "Patient portal resource was not found.") {
    super(message);
    this.name = "PatientPortalNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

class PatientPortalValidationError extends Error {
  constructor(details = [], message = "Patient portal payload failed validation.") {
    super(message);
    this.name = "PatientPortalValidationError";
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
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function validateIsoDateTime(value, field, details) {
  if (!value) {
    details.push({ field, message: `${field} is required.` });
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
    return null;
  }
  return date;
}

export function normalizePatientPortalBookingRequestPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new PatientPortalValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {
    preferredFrom: cleanString(input.preferredFrom),
    preferredTo: cleanString(input.preferredTo),
    reason: cleanString(input.reason),
  };
  const details = [];
  const from = validateIsoDateTime(payload.preferredFrom, "preferredFrom", details);
  const to = payload.preferredTo
    ? validateIsoDateTime(payload.preferredTo, "preferredTo", details)
    : null;
  if (from && to && to <= from) {
    details.push({ field: "preferredTo", message: "preferredTo must be after preferredFrom." });
  }
  if (!payload.reason) {
    details.push({ field: "reason", message: "Reason is required." });
  } else if (payload.reason.length > MAX_BOOKING_REASON_LENGTH) {
    details.push({ field: "reason", message: "Reason is too long." });
  }
  if (details.length > 0) throw new PatientPortalValidationError(details);
  return payload;
}

export function normalizePatientPortalReminderPreferencesPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new PatientPortalValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const payload = {};
  if (hasOwn(input, "appointmentRemindersEnabled")) {
    if (typeof input.appointmentRemindersEnabled !== "boolean") {
      details.push({
        field: "appointmentRemindersEnabled",
        message: "appointmentRemindersEnabled must be a boolean.",
      });
    } else {
      payload.appointmentRemindersEnabled = input.appointmentRemindersEnabled;
    }
  }
  if (hasOwn(input, "reportNotificationsEnabled")) {
    if (typeof input.reportNotificationsEnabled !== "boolean") {
      details.push({
        field: "reportNotificationsEnabled",
        message: "reportNotificationsEnabled must be a boolean.",
      });
    } else {
      payload.reportNotificationsEnabled = input.reportNotificationsEnabled;
    }
  }
  if (hasOwn(input, "preferredChannel")) {
    const preferredChannel = cleanString(input.preferredChannel);
    if (!preferredChannel || !REMINDER_CHANNELS.has(preferredChannel)) {
      details.push({ field: "preferredChannel", message: "preferredChannel must be email, phone, or none." });
    } else {
      payload.preferredChannel = preferredChannel;
    }
  }
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one reminder preference is required." });
  }
  if (details.length > 0) throw new PatientPortalValidationError(details);
  return {
    appointmentRemindersEnabled: payload.appointmentRemindersEnabled ?? true,
    reportNotificationsEnabled: payload.reportNotificationsEnabled ?? true,
    preferredChannel: payload.preferredChannel ?? "email",
  };
}

function assertUuid(value, field = "id") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.publicCode = "invalid_uuid";
    error.publicStatus = 400;
    throw error;
  }
  return text;
}

export function createPatientPortalService({
  patientPortalRepository,
  auditRepository,
} = {}) {
  return {
    async getOverview(authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const overview = await patientPortalRepository.getOverview({ userId: scope.userId });
      await recordAuditBestEffort(auditRepository, {
        clinicId: overview.patient?.clinic?.id || null,
        actorUserId: scope.userId,
        action: "patient_portal.overview.read",
        entityType: "patient_portal",
        entityId: overview.patient?.id || scope.userId,
        correlationId,
        metadata: {
          reportCount: overview.reports.length,
          reminderCount: overview.reminders.length,
        },
      });
      return { overview, scope };
    },

    async getReport(reportId, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const safeReportId = assertUuid(reportId, "reportId");
      const report = await patientPortalRepository.getReport({
        userId: scope.userId,
        reportId: safeReportId,
      });
      if (!report) throw new PatientPortalNotFoundError();
      await recordAuditBestEffort(auditRepository, {
        clinicId: report.clinic?.id || null,
        actorUserId: scope.userId,
        action: "patient_portal.report.read",
        entityType: "report",
        entityId: report.id,
        correlationId,
        metadata: {
          visitId: report.visitId,
        },
      });
      return { report, scope };
    },

    async createBookingRequest(input, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const payload = normalizePatientPortalBookingRequestPayload(input);
      const bookingRequest = await patientPortalRepository.createBookingRequest({
        userId: scope.userId,
        ...payload,
      });
      if (!bookingRequest) throw new PatientPortalNotFoundError("Linked patient was not found.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: bookingRequest.clinic?.id || null,
        actorUserId: scope.userId,
        action: "patient_portal.booking_request.create",
        entityType: "patient_portal_booking_request",
        entityId: bookingRequest.id,
        correlationId,
        metadata: {
          preferredFrom: bookingRequest.preferredFrom,
          preferredTo: bookingRequest.preferredTo,
          status: bookingRequest.status,
        },
      });
      return { bookingRequest, scope };
    },

    async updateReminderPreferences(input, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const payload = normalizePatientPortalReminderPreferencesPayload(input);
      const reminderPreferences = await patientPortalRepository.updateReminderPreferences({
        userId: scope.userId,
        ...payload,
      });
      if (!reminderPreferences) throw new PatientPortalNotFoundError("Linked patient was not found.");
      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: scope.userId,
        action: "patient_portal.reminder_preferences.update",
        entityType: "patient_portal",
        entityId: scope.userId,
        correlationId,
        metadata: {
          appointmentRemindersEnabled: reminderPreferences.appointmentRemindersEnabled,
          reportNotificationsEnabled: reminderPreferences.reportNotificationsEnabled,
          preferredChannel: reminderPreferences.preferredChannel,
        },
      });
      return { reminderPreferences, scope };
    },
  };
}
