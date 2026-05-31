export const PATIENT_READ_ROLES = ["system_admin", "clinic_admin", "doctor"];
export const PATIENT_WRITE_ROLES = ["system_admin", "clinic_admin", "doctor"];
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

export function patientReadScope(authContext) {
  const scoped = requireAnyRole(authContext, PATIENT_READ_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return {
      allClinics: true,
      clinicIds: [],
      roles: scoped.roles,
    };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return {
    allClinics: false,
    clinicIds,
    roles: scoped.roles,
  };
}

export function patientWriteScope(authContext) {
  const scoped = requireAnyRole(authContext, PATIENT_WRITE_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return {
      allClinics: true,
      clinicIds: [],
      roles: scoped.roles,
    };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return {
    allClinics: false,
    clinicIds,
    roles: scoped.roles,
  };
}

export function patientPortalScope(authContext) {
  const scoped = requireAnyRole(authContext, PATIENT_PORTAL_ROLES);
  return {
    userId: scoped.userId,
    roles: scoped.roles,
  };
}

export function patientPhotoProtocolGovernanceWriteScope(authContext) {
  const scoped = requireAnyRole(authContext, PATIENT_PHOTO_PROTOCOL_GOVERNANCE_WRITE_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

// Stage 4G · Visit workspace read scope. Reuses the patient read RBAC: doctors,
// clinic admins and system admins can list visits/lesions/assets. Operators and
// other roles are denied.
export const VISIT_READ_ROLES = PATIENT_READ_ROLES;

export function visitReadScope(authContext) {
  return patientReadScope(authContext);
}

export function leadsAppointmentsReadScope(authContext) {
  const scoped = requireAnyRole(authContext, LEADS_APPOINTMENTS_READ_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

export function leadsAppointmentsWriteScope(authContext) {
  const scoped = requireAnyRole(authContext, LEADS_APPOINTMENTS_WRITE_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

// Stage 4H · Visit workspace write scope. Only doctors and system admins may
// mutate visits/lesions/reports. clinic_admin/assistant/operator are denied
// to keep clinical writes inside the doctor's hands.
export const VISIT_WRITE_ROLES = ["system_admin", "doctor"];

export function visitWriteScope(authContext) {
  const scoped = requireAnyRole(authContext, VISIT_WRITE_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

export function opsStatusScope(authContext) {
  const scoped = requireAnyRole(authContext, OPS_STATUS_ROLES);
  return { roles: scoped.roles };
}

export function deviceReadScope(authContext) {
  const scoped = requireAnyRole(authContext, DEVICE_READ_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

export function deviceCommandScope(authContext) {
  const scoped = requireAnyRole(authContext, DEVICE_COMMAND_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = normalizeRoles(scoped.clinicIds);
  if (clinicIds.length === 0) {
    throw new ForbiddenError("The authenticated user has no clinic scope.");
  }
  return { allClinics: false, clinicIds, roles: scoped.roles };
}
