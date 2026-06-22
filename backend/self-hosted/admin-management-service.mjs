import { hashPassword } from "./auth-crypto.mjs";
import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, requireAnyRole } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ADMIN_ROLES = ["system_admin", "clinic_admin"];
const SYSTEM_CREATABLE_ROLES = ["system_admin", "clinic_admin", "doctor", "private_doctor", "assistant", "operator"];
const CLINIC_CREATABLE_ROLES = ["doctor", "private_doctor", "assistant", "operator"];

export class AdminManagementValidationError extends Error {
  constructor(details = [], message = "Admin management payload failed validation.") {
    super(message);
    this.name = "AdminManagementValidationError";
    this.publicCode = "validation_error";
    this.publicStatus = 422;
    this.publicDetails = details;
  }
}

function cleanString(value, max = 240) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ").slice(0, max);
  return cleaned || null;
}

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function hasSystemRole(authContext) {
  return Array.isArray(authContext?.roles) && authContext.roles.includes("system_admin");
}

function adminScope(authContext) {
  const scoped = requireAnyRole(authContext, ADMIN_ROLES);
  if (scoped.roles.includes("system_admin")) {
    return { allClinics: true, clinicIds: [], roles: scoped.roles };
  }
  const clinicIds = Array.isArray(scoped.clinicIds) ? scoped.clinicIds.filter((id) => UUID_PATTERN.test(String(id))) : [];
  if (clinicIds.length === 0) throw new ForbiddenError("The authenticated user has no clinic scope.");
  return { allClinics: false, clinicIds, roles: scoped.roles };
}

function assertUuid(value, field) {
  if (!UUID_PATTERN.test(String(value || ""))) {
    throw new AdminManagementValidationError([{ field, message: "Нужен корректный идентификатор." }]);
  }
  return String(value);
}

function normalizeCreateUserPayload(input = {}, scope) {
  if (!isPlainObject(input)) {
    throw new AdminManagementValidationError([{ field: "body", message: "Нужен JSON-объект." }]);
  }
  const payload = {
    email: cleanString(input.email, 180)?.toLowerCase(),
    displayName: cleanString(input.displayName, 180),
    password: String(input.password ?? ""),
    role: cleanString(input.role, 40),
    clinicId: cleanString(input.clinicId, 80),
  };
  const details = [];
  if (!payload.email || !EMAIL_PATTERN.test(payload.email)) details.push({ field: "email", message: "Укажите рабочую почту." });
  if (!payload.displayName || payload.displayName.length < 3) details.push({ field: "displayName", message: "Укажите имя сотрудника." });
  if (payload.password.length < 10) details.push({ field: "password", message: "Пароль должен быть не короче 10 символов." });
  const allowedRoles = scope.allClinics ? SYSTEM_CREATABLE_ROLES : CLINIC_CREATABLE_ROLES;
  if (!allowedRoles.includes(payload.role)) details.push({ field: "role", message: "Эту роль нельзя назначить из текущей области доступа." });
  const needsClinic = payload.role !== "system_admin";
  if (needsClinic && !payload.clinicId) details.push({ field: "clinicId", message: "Выберите клинику." });
  if (payload.clinicId && !UUID_PATTERN.test(payload.clinicId)) details.push({ field: "clinicId", message: "Клиника должна быть выбрана из списка." });
  if (!scope.allClinics && payload.clinicId && !scope.clinicIds.includes(payload.clinicId)) {
    throw new ForbiddenError("The selected clinic is outside the authenticated user's scope.");
  }
  if (details.length > 0) throw new AdminManagementValidationError(details);
  return payload;
}

function normalizeRolePayload(input = {}, scope) {
  if (!isPlainObject(input)) {
    throw new AdminManagementValidationError([{ field: "body", message: "Нужен JSON-объект." }]);
  }
  const payload = {
    role: cleanString(input.role, 40),
    clinicId: cleanString(input.clinicId, 80),
  };
  const allowedRoles = scope.allClinics ? SYSTEM_CREATABLE_ROLES : CLINIC_CREATABLE_ROLES;
  const details = [];
  if (!allowedRoles.includes(payload.role)) details.push({ field: "role", message: "Эту роль нельзя назначить из текущей области доступа." });
  if (payload.role !== "system_admin" && !payload.clinicId) details.push({ field: "clinicId", message: "Выберите клинику." });
  if (payload.clinicId && !UUID_PATTERN.test(payload.clinicId)) details.push({ field: "clinicId", message: "Клиника должна быть выбрана из списка." });
  if (!scope.allClinics && payload.clinicId && !scope.clinicIds.includes(payload.clinicId)) {
    throw new ForbiddenError("The selected clinic is outside the authenticated user's scope.");
  }
  if (details.length > 0) throw new AdminManagementValidationError(details);
  return payload;
}

function slugFromName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/giu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || `clinic-${Date.now()}`;
}

function normalizeClinicPayload(input = {}, { partial = false } = {}) {
  if (!isPlainObject(input)) {
    throw new AdminManagementValidationError([{ field: "body", message: "Нужен JSON-объект." }]);
  }
  const payload = {
    name: cleanString(input.name, 180),
    slug: cleanString(input.slug, 80),
    timezone: cleanString(input.timezone, 80) || "Europe/Moscow",
  };
  if (!payload.slug && payload.name) payload.slug = slugFromName(payload.name);
  const details = [];
  if (!partial || payload.name != null) {
    if (!payload.name || payload.name.length < 3) details.push({ field: "name", message: "Укажите название клиники." });
  }
  if (!partial || payload.slug != null) {
    if (!payload.slug || !/^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$/i.test(payload.slug)) {
      details.push({ field: "slug", message: "Короткий адрес клиники должен содержать латинские буквы, цифры или дефисы." });
    }
  }
  if (details.length > 0) throw new AdminManagementValidationError(details);
  return payload;
}

function listMeta(params, items) {
  return {
    count: Array.isArray(items) ? items.length : 0,
    limit: params.limit,
    offset: params.offset,
    search: params.search || "",
    source: "postgres",
  };
}

export function createAdminManagementService({ adminManagementRepository, auditRepository }) {
  return {
    async listUsers(params, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const items = await adminManagementRepository.listUsers({ ...params, ...scope });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "admin.users.list",
        entityType: "admin_user",
        correlationId: meta.correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return { items, meta: listMeta(params, items), scope };
    },

    async createUser(input, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const payload = normalizeCreateUserPayload(input, scope);
      const user = await adminManagementRepository.createUser({
        ...payload,
        passwordHash: hashPassword(payload.password),
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: payload.clinicId || null,
        actorUserId: authContext.userId,
        action: "admin.user.create",
        entityType: "admin_user",
        entityId: user?.id || null,
        correlationId: meta.correlationId,
        metadata: { role: payload.role, passwordStoredAsHash: true },
      });
      return { item: user, scope };
    },

    async assignUserRole(userId, input, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const safeUserId = assertUuid(userId, "userId");
      const payload = normalizeRolePayload(input, scope);
      const user = await adminManagementRepository.assignUserRole({ userId: safeUserId, ...payload });
      await recordAuditBestEffort(auditRepository, {
        clinicId: payload.clinicId || null,
        actorUserId: authContext.userId,
        action: "admin.user.role.assign",
        entityType: "admin_user",
        entityId: safeUserId,
        correlationId: meta.correlationId,
        metadata: { role: payload.role },
      });
      return { item: user, scope };
    },

    async disableUser(userId, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const safeUserId = assertUuid(userId, "userId");
      const user = await adminManagementRepository.disableUser({ userId: safeUserId });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "admin.user.disable",
        entityType: "admin_user",
        entityId: safeUserId,
        correlationId: meta.correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return { item: user, scope };
    },

    async listClinics(params, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const items = await adminManagementRepository.listClinics({ ...params, ...scope });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "admin.clinics.list",
        entityType: "clinic",
        correlationId: meta.correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return { items, meta: listMeta(params, items), scope };
    },

    async createClinic(input, authContext, meta = {}) {
      if (!hasSystemRole(authContext)) throw new ForbiddenError();
      const payload = normalizeClinicPayload(input);
      const clinic = await adminManagementRepository.createClinic(payload);
      await recordAuditBestEffort(auditRepository, {
        clinicId: clinic?.id || null,
        actorUserId: authContext.userId,
        action: "admin.clinic.create",
        entityType: "clinic",
        entityId: clinic?.id || null,
        correlationId: meta.correlationId,
        metadata: { slug: clinic?.slug || payload.slug },
      });
      return { item: clinic, scope: { allClinics: true, clinicIds: [] } };
    },

    async updateClinic(clinicId, input, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const safeClinicId = assertUuid(clinicId, "clinicId");
      if (!scope.allClinics && !scope.clinicIds.includes(safeClinicId)) throw new ForbiddenError();
      const payload = normalizeClinicPayload(input, { partial: true });
      const clinic = await adminManagementRepository.updateClinic({ clinicId: safeClinicId, ...payload });
      await recordAuditBestEffort(auditRepository, {
        clinicId: safeClinicId,
        actorUserId: authContext.userId,
        action: "admin.clinic.update",
        entityType: "clinic",
        entityId: safeClinicId,
        correlationId: meta.correlationId,
        metadata: { fields: Object.keys(payload).filter((key) => payload[key] != null) },
      });
      return { item: clinic, scope };
    },

    async listDoctors(params, authContext, meta = {}) {
      const scope = adminScope(authContext);
      const items = await adminManagementRepository.listUsers({ ...params, ...scope, doctorsOnly: true });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "admin.doctors.list",
        entityType: "admin_user",
        correlationId: meta.correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return { items, meta: listMeta(params, items), scope };
    },

    async getAnalytics(authContext, meta = {}) {
      const scope = adminScope(authContext);
      const analytics = await adminManagementRepository.getAnalytics(scope);
      const auditEvents = await adminManagementRepository.listAuditEvents({ ...scope, limit: 20 });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "admin.analytics.read",
        entityType: "analytics",
        correlationId: meta.correlationId,
        metadata: { allClinics: scope.allClinics },
      });
      return { item: { ...analytics, recentAuditEvents: auditEvents }, scope };
    },
  };
}
