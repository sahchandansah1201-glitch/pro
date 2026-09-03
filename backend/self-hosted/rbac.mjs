export const PATIENT_READ_ROLES = ["system_admin", "doctor", "private_doctor", "assistant"];
export const PATIENT_WRITE_ROLES = ["system_admin", "doctor"];
export const CLINICAL_RECORD_READ_ROLES = [...PATIENT_READ_ROLES];
export const CLINICAL_MEDIA_READ_ROLES = [...PATIENT_READ_ROLES];
export const CLINIC_OPERATIONS_READ_ROLES = [
  "system_admin",
  "clinic_admin",
  "doctor",
  "private_doctor",
  "assistant",
];
export const CLINIC_GOVERNANCE_READ_ROLES = [...CLINIC_OPERATIONS_READ_ROLES];
export const PATIENT_PORTAL_ROLES = ["patient"];
export const PATIENT_PHOTO_PROTOCOL_GOVERNANCE_WRITE_ROLES = ["system_admin", "clinic_admin", "doctor"];
export const OPS_STATUS_ROLES = ["system_admin"];
export const DEVICE_READ_ROLES = ["system_admin", "clinic_admin"];
export const DEVICE_COMMAND_ROLES = ["system_admin", "clinic_admin"];
export const LEADS_APPOINTMENTS_READ_ROLES = ["system_admin", "clinic_admin", "doctor", "operator"];
export const LEADS_APPOINTMENTS_WRITE_ROLES = ["system_admin", "clinic_admin", "doctor", "operator"];

export class AuthRequiredError extends Error {
  constructor(message = "Authentication is required.") {
    super(message);
    this.name = "AuthRequiredError";
    this.publicCode = "auth_required";
    this.publicStatus = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(message = "The authenticated user does not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
    this.publicCode = "forbidden";
    this.publicStatus = 403;
  }
}

export function normalizeRoles(roles = []) {
  return Array.from(new Set((Array.isArray(roles) ? roles : []).map(String).filter(Boolean)));
}

export function assertAuthenticated(authContext) {
  if (!authContext?.userId) {
    throw new AuthRequiredError();
  }
  return authContext;
}

export function requireAnyRole(authContext, allowedRoles) {
  assertAuthenticated(authContext);
  const roles = normalizeRoles(authContext.roles);
  if (!roles.some((role) => allowedRoles.includes(role))) {
    throw new ForbiddenError();
  }
  return {
    ...authContext,
    roles,
  };
}

function clinicIdsForRoles(authContext, allowedRoles) {
  if (!Object.prototype.hasOwnProperty.call(authContext, "roleBindings")) {
    return normalizeRoles(authContext.clinicIds);
  }
  if (!Array.isArray(authContext.roleBindings)) {
    return [];
  }
  const activeRoles = new Set(normalizeRoles(authContext.roles));
  return normalizeRoles(
    authContext.roleBindings
      .filter((binding) => {
        const role = String(binding?.role || "");
        return activeRoles.has(role) && allowedRoles.includes(role);
      })
      .map((binding) => binding?.clinicId)
      .filter((clinicId) => typeof clinicId === "string" && clinicId.trim().length > 0)
      .map((clinicId) => clinicId.trim()),
  );
}

function clinicScope(authContext, allowedRoles) {
  const scoped = requireAnyRole(authContext, allowedRoles);
  if (scoped.roles.includes("system_admin")) {
    const hasBindings = Object.prototype.hasOwnProperty.call(scoped, "roleBindings");
    const hasSystemAdminBinding = Array.isArray(scoped.roleBindings)
      && scoped.roleBindings.some((binding) => binding?.role === "system_admin");
    if (hasBindings && !hasSystemAdminBinding) {
      throw new ForbiddenError("The authenticated user has no active system-admin binding.");
    }
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = clinicIdsForRoles(scoped, allowedRoles);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

export function patientReadScope(authContext) {
  return clinicScope(authContext, PATIENT_READ_ROLES);
}

export function patientWriteScope(authContext) {
  return clinicScope(authContext, PATIENT_WRITE_ROLES);
}

export function clinicalRecordReadScope(authContext) {
  return clinicScope(authContext, CLINICAL_RECORD_READ_ROLES);
}

export function clinicalMediaReadScope(authContext) {
  return clinicScope(authContext, CLINICAL_MEDIA_READ_ROLES);
}

export function clinicOperationsReadScope(authContext) {
  return clinicScope(authContext, CLINIC_OPERATIONS_READ_ROLES);
}

export function clinicGovernanceReadScope(authContext) {
  return clinicScope(authContext, CLINIC_GOVERNANCE_READ_ROLES);
}

export function patientPortalScope(authContext) {
  const scoped = requireAnyRole(authContext, PATIENT_PORTAL_ROLES);
  return {
    userId: scoped.userId,
    roles: scoped.roles,
  };
}

export function patientPhotoProtocolGovernanceWriteScope(authContext) {
  return clinicScope(authContext, PATIENT_PHOTO_PROTOCOL_GOVERNANCE_WRITE_ROLES);
}

export function leadsAppointmentsReadScope(authContext) {
  return clinicScope(authContext, LEADS_APPOINTMENTS_READ_ROLES);
}

export function leadsAppointmentsWriteScope(authContext) {
  return clinicScope(authContext, LEADS_APPOINTMENTS_WRITE_ROLES);
}

// Stage 4H · Visit workspace write scope. Only doctors and system admins may
// mutate visits/lesions/reports. clinic_admin/assistant/operator are denied
// to keep clinical writes inside the doctor's hands.
export const VISIT_WRITE_ROLES = ["system_admin", "doctor"];

export function visitWriteScope(authContext) {
  return clinicScope(authContext, VISIT_WRITE_ROLES);
}

// Capture assistants can add image assets to existing visits in their clinic,
// but cannot mutate visits, lesions, reports, conclusions, or patient records.
export const ASSET_WRITE_ROLES = ["system_admin", "doctor", "private_doctor", "assistant"];

export function assetWriteScope(authContext) {
  return clinicScope(authContext, ASSET_WRITE_ROLES);
}

export function opsStatusScope(authContext) {
  const scoped = requireAnyRole(authContext, OPS_STATUS_ROLES);
  return { roles: scoped.roles };
}

export function deviceReadScope(authContext) {
  return clinicScope(authContext, DEVICE_READ_ROLES);
}

export function deviceCommandScope(authContext) {
  return clinicScope(authContext, DEVICE_COMMAND_ROLES);
}
