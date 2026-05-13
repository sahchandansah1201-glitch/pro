import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, patientWriteScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEX_VALUES = new Set(["female", "male", "other", "unknown"]);
const PHOTOTYPE_VALUES = new Set(["I", "II", "III", "IV", "V", "VI"]);
const MAX_CODE_LENGTH = 48;
const MAX_FULL_NAME_LENGTH = 180;
const MAX_NOTES_LENGTH = 2000;
const MIN_BIRTH_YEAR = 1900;
const INVALID_BOOLEAN = Symbol("invalid_boolean");

export class PatientValidationError extends Error {
  constructor(details = [], message = "Patient payload failed validation.") {
    super(message);
    this.name = "PatientValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

export class PatientNotFoundError extends Error {
  constructor(message = "Patient was not found in the allowed clinic scope.") {
    super(message);
    this.name = "PatientNotFoundError";
    this.publicCode = "patient_not_found";
    this.publicStatus = 404;
  }
}

function cleanString(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function isValidDateString(value) {
  if (value == null || value === "") return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  const year = date.getUTCFullYear();
  if (year < MIN_BIRTH_YEAR) return false;
  const today = new Date();
  const todayUtc = new Date(Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  ));
  return date <= todayUtc;
}

function normalizeConsent(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value == null) return fallback;
  return INVALID_BOOLEAN;
}

function validateFullName(fullName, details) {
  if (!fullName) {
    details.push({ field: "fullName", message: "Full name is required." });
    return;
  }
  if (fullName.split(/\s+/).length < 2) {
    details.push({ field: "fullName", message: "Full name must include at least two words." });
  }
  if (fullName.length > MAX_FULL_NAME_LENGTH) {
    details.push({ field: "fullName", message: "Full name is too long." });
  }
}

function validateCommonFields(payload, details) {
  if (payload.birthDate != null && !isValidDateString(payload.birthDate)) {
    details.push({ field: "birthDate", message: "Birth date must be YYYY-MM-DD, not future, and year >= 1900." });
  }
  if (payload.sex != null && !SEX_VALUES.has(payload.sex)) {
    details.push({ field: "sex", message: "Sex must be female, male, other, or unknown." });
  }
  if (payload.phototype != null && !PHOTOTYPE_VALUES.has(payload.phototype)) {
    details.push({ field: "phototype", message: "Phototype must be I, II, III, IV, V, or VI." });
  }
  if (payload.imagingConsent === INVALID_BOOLEAN) {
    details.push({ field: "imagingConsent", message: "Imaging consent must be a boolean." });
  }
  if (payload.code != null && payload.code.length > MAX_CODE_LENGTH) {
    details.push({ field: "code", message: "Patient code is too long." });
  }
  if (payload.notes != null && payload.notes.length > MAX_NOTES_LENGTH) {
    details.push({ field: "notes", message: "Notes are too long." });
  }
}

export function normalizeCreatePatientPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new PatientValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {
    clinicId: cleanString(input.clinicId),
    code: cleanString(input.code),
    fullName: cleanString(input.fullName),
    birthDate: cleanString(input.birthDate),
    sex: cleanString(input.sex) || "unknown",
    phototype: cleanString(input.phototype),
    imagingConsent: normalizeConsent(input.imagingConsent),
    notes: cleanString(input.notes),
  };
  const details = [];
  validateFullName(payload.fullName, details);
  validateCommonFields(payload, details);
  if (payload.clinicId != null && !UUID_PATTERN.test(payload.clinicId)) {
    details.push({ field: "clinicId", message: "Clinic ID must be a UUID." });
  }
  if (details.length > 0) throw new PatientValidationError(details);
  return payload;
}

export function normalizeUpdatePatientPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new PatientValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const payload = {};
  if (hasOwn(input, "code")) payload.code = cleanString(input.code);
  if (hasOwn(input, "fullName")) payload.fullName = cleanString(input.fullName);
  if (hasOwn(input, "birthDate")) payload.birthDate = cleanString(input.birthDate);
  if (hasOwn(input, "sex")) payload.sex = cleanString(input.sex) || "unknown";
  if (hasOwn(input, "phototype")) payload.phototype = cleanString(input.phototype);
  if (hasOwn(input, "imagingConsent")) payload.imagingConsent = normalizeConsent(input.imagingConsent, INVALID_BOOLEAN);
  if (hasOwn(input, "notes")) payload.notes = cleanString(input.notes);

  const details = [];
  if (hasOwn(payload, "fullName")) validateFullName(payload.fullName, details);
  if (hasOwn(payload, "code") && !payload.code) {
    details.push({ field: "code", message: "Patient code cannot be empty." });
  }
  validateCommonFields(payload, details);
  if (Object.keys(payload).length === 0) {
    details.push({ field: "body", message: "At least one editable patient field is required." });
  }
  if (details.length > 0) throw new PatientValidationError(details);
  return payload;
}

export function normalizeArchivePatientPayload(input = {}) {
  const payload = isPlainObject(input) ? input : {};
  return {
    reason: cleanString(payload.reason)?.slice(0, 240) || null,
  };
}

export function assertUuid(value, field = "patientId") {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new PatientValidationError([{ field, message: `${field} must be a UUID.` }]);
  }
  return String(value);
}

export function resolvePatientWriteClinicId(scope, requestedClinicId = null) {
  if (scope.allClinics) {
    if (!requestedClinicId) {
      throw new PatientValidationError([
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
  throw new PatientValidationError([
    { field: "clinicId", message: "Clinic ID is required when multiple clinic scopes are available." },
  ]);
}

function changedFields(payload) {
  return Object.keys(payload).filter((key) => payload[key] !== undefined);
}

function requirePatient(patient) {
  if (!patient) throw new PatientNotFoundError();
  return patient;
}

export function createPatientWriteService({
  patientRepository,
  auditRepository,
} = {}) {
  return {
    async createPatient(input, authContext, { correlationId } = {}) {
      const scope = patientWriteScope(authContext);
      const payload = normalizeCreatePatientPayload(input);
      const clinicId = resolvePatientWriteClinicId(scope, payload.clinicId);
      const patient = requirePatient(
        await patientRepository.createPatient({
          ...payload,
          clinicId,
          actorUserId: authContext.userId,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId,
        actorUserId: authContext.userId,
        action: "patient.create",
        entityType: "patient",
        entityId: patient.id,
        correlationId,
        metadata: {
          changedFields: changedFields(payload).filter((field) => field !== "clinicId"),
        },
      });
      return { patient, scope };
    },

    async updatePatient(patientId, input, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId);
      const scope = patientWriteScope(authContext);
      const payload = normalizeUpdatePatientPayload(input);
      const patient = requirePatient(
        await patientRepository.updatePatient({
          patientId: safePatientId,
          changes: payload,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: patient.clinic.id || null,
        actorUserId: authContext.userId,
        action: "patient.update",
        entityType: "patient",
        entityId: patient.id,
        correlationId,
        metadata: {
          changedFields: changedFields(payload),
        },
      });
      return { patient, scope };
    },

    async archivePatient(patientId, input, authContext, { correlationId } = {}) {
      const safePatientId = assertUuid(patientId);
      const scope = patientWriteScope(authContext);
      const payload = normalizeArchivePatientPayload(input);
      const patient = requirePatient(
        await patientRepository.archivePatient({
          patientId: safePatientId,
          clinicIds: scope.clinicIds,
          allClinics: scope.allClinics,
        }),
      );
      await recordAuditBestEffort(auditRepository, {
        clinicId: patient.clinic.id || null,
        actorUserId: authContext.userId,
        action: "patient.archive",
        entityType: "patient",
        entityId: patient.id,
        correlationId,
        metadata: {
          reason: payload.reason,
        },
      });
      return { patient, scope };
    },
  };
}
