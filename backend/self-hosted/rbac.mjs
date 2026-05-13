export const PATIENT_READ_ROLES = ["system_admin", "clinic_admin", "doctor"];
export const PATIENT_WRITE_ROLES = ["system_admin", "clinic_admin", "doctor"];

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

// Stage 4G · Visit workspace read scope. Reuses the patient read RBAC: doctors,
// clinic admins and system admins can list visits/lesions/assets. Operators and
// other roles are denied.
export const VISIT_READ_ROLES = PATIENT_READ_ROLES;

export function visitReadScope(authContext) {
  return patientReadScope(authContext);
}
