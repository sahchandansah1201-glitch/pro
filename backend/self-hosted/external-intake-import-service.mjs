// Stage 5Q · External intake import service.
// Validates inbound CRM/ad payloads, resolves clinic scope locally, and records
// audit events. The service never calls external systems.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, leadsAppointmentsReadScope, leadsAppointmentsWriteScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_SYSTEM_VALUES = new Set(["clinic_crm", "ads", "site", "manual", "other"]);
const ITEM_KIND_VALUES = new Set(["booking_request", "available_slot"]);
const MAX_ITEMS = 100;
const MAX_REASON_LENGTH = 500;
const MAX_REFERENCE_LENGTH = 120;

export class ExternalIntakeImportValidationError extends Error {
  constructor(details = [], message = "External intake import payload failed validation.") {
    super(message);
    this.name = "ExternalIntakeImportValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
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

function validateUuid(value, field, details, { required = false } = {}) {
  if (!value) {
    if (required) details.push({ field, message: `${field} is required.` });
    return;
  }
  if (!UUID_PATTERN.test(String(value))) {
    details.push({ field, message: `${field} must be a UUID.` });
  }
}

function validateIsoDateTime(value, field, details, { required = false } = {}) {
  if (!value) {
    if (required) details.push({ field, message: `${field} is required.` });
    return;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
  }
}

function validateDuration(value, field, details) {
  if (value == null) return;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 5 || number > 720) {
    details.push({ field, message: `${field} must be an integer between 5 and 720.` });
  }
}

export function resolveExternalIntakeClinicId(scope, requestedClinicId = null) {
  if (scope.allClinics) {
    if (!requestedClinicId) {
      throw new ExternalIntakeImportValidationError([
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
  throw new ExternalIntakeImportValidationError([
    { field: "clinicId", message: "Clinic ID is required when multiple clinic scopes are available." },
  ]);
}

function normalizeImportItem(item, index, details) {
  if (!isPlainObject(item)) {
    details.push({ field: `items.${index}`, message: "Import item must be an object." });
    return null;
  }
  const kind = cleanString(item.kind);
  const externalId = cleanString(item.externalId);
  const normalized = {
    kind,
    externalId,
    patientCode: cleanString(item.patientCode),
    preferredFrom: cleanString(item.preferredFrom),
    preferredTo: cleanString(item.preferredTo),
    reason: cleanString(item.reason),
    doctorUserId: cleanString(item.doctorUserId),
    startedAt: cleanString(item.startedAt),
    durationMinutes: item.durationMinutes == null ? null : Number(item.durationMinutes),
  };

  if (!kind || !ITEM_KIND_VALUES.has(kind)) {
    details.push({ field: `items.${index}.kind`, message: "Kind must be booking_request or available_slot." });
  }
  if (!externalId) {
    details.push({ field: `items.${index}.externalId`, message: "External ID is required." });
  }

  if (kind === "booking_request") {
    if (!normalized.patientCode) {
      details.push({ field: `items.${index}.patientCode`, message: "Patient code is required for booking imports." });
    }
    validateIsoDateTime(normalized.preferredFrom, `items.${index}.preferredFrom`, details, { required: true });
    validateIsoDateTime(normalized.preferredTo, `items.${index}.preferredTo`, details);
  }

  if (kind === "available_slot") {
    validateUuid(normalized.doctorUserId, `items.${index}.doctorUserId`, details);
    validateIsoDateTime(normalized.startedAt, `items.${index}.startedAt`, details, { required: true });
    validateDuration(normalized.durationMinutes, `items.${index}.durationMinutes`, details);
  }

  if (normalized.reason && normalized.reason.length > MAX_REASON_LENGTH) {
    details.push({ field: `items.${index}.reason`, message: "Reason is too long." });
  }
  return normalized;
}

export function normalizeExternalIntakeImportPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new ExternalIntakeImportValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const sourceSystem = cleanString(input.sourceSystem) || "other";
  const payload = {
    clinicId: cleanString(input.clinicId),
    sourceSystem,
    sourceReference: cleanString(input.sourceReference),
    items: [],
  };
  validateUuid(payload.clinicId, "clinicId", details);
  if (!SOURCE_SYSTEM_VALUES.has(sourceSystem)) {
    details.push({ field: "sourceSystem", message: "Source system is not supported." });
  }
  if (payload.sourceReference && payload.sourceReference.length > MAX_REFERENCE_LENGTH) {
    details.push({ field: "sourceReference", message: "Source reference is too long." });
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    details.push({ field: "items", message: "At least one import item is required." });
  } else if (input.items.length > MAX_ITEMS) {
    details.push({ field: "items", message: `At most ${MAX_ITEMS} import items are allowed.` });
  } else {
    payload.items = input.items
      .map((item, index) => normalizeImportItem(item, index, details))
      .filter(Boolean);
  }
  if (details.length > 0) throw new ExternalIntakeImportValidationError(details);
  return payload;
}

function ensureIntegrationOperatorScope(scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("doctor") && !roles.some((role) => ["operator", "clinic_admin", "system_admin"].includes(role))) {
    throw new ForbiddenError("External intake imports are reserved for operators and administrators.");
  }
}

export function createExternalIntakeImportService({
  externalIntakeImportRepository,
  auditRepository,
} = {}) {
  return {
    async importExternalIntake(input, authContext, { correlationId } = {}) {
      const scope = leadsAppointmentsWriteScope(authContext);
      ensureIntegrationOperatorScope(scope);
      const payload = normalizeExternalIntakeImportPayload(input);
      const clinicId = resolveExternalIntakeClinicId(scope, payload.clinicId);
      const batch = await externalIntakeImportRepository.importExternalIntake({
        ...payload,
        clinicId,
        actorUserId: authContext.userId,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId,
        actorUserId: authContext.userId,
        action: "external_intake.import",
        entityType: "external_booking_import_batch",
        entityId: batch?.id || null,
        correlationId,
        metadata: {
          sourceSystem: payload.sourceSystem,
          itemCount: payload.items.length,
          acceptedBookingCount: batch?.acceptedBookingCount ?? 0,
          acceptedSlotCount: batch?.acceptedSlotCount ?? 0,
          rejectedCount: batch?.rejectedCount ?? 0,
        },
      });
      return { batch, scope };
    },

    async listImportBatches(authContext, params = {}, { correlationId } = {}) {
      const scope = leadsAppointmentsReadScope(authContext);
      ensureIntegrationOperatorScope(scope);
      const batches = await externalIntakeImportRepository.listImportBatches({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "external_intake.import.list",
        entityType: "external_booking_import_batch",
        correlationId,
        metadata: {
          count: batches.items.length,
          sourceSystem: batches.filters.sourceSystem,
          allClinics: scope.allClinics,
        },
      });
      return { batches, scope };
    },
  };
}
