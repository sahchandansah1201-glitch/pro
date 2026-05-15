// Stage 5R · Clinic available slots service.
// Operators read locally imported appointment windows from PostgreSQL. This
// service never calls the clinic CRM or any external scheduling runtime.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { ForbiddenError, leadsAppointmentsReadScope } from "./rbac.mjs";

function ensureClinicOperatorScope(scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("doctor") && !roles.some((role) => ["operator", "clinic_admin", "system_admin"].includes(role))) {
    throw new ForbiddenError("Clinic available slots are reserved for operators and administrators.");
  }
}

export function createClinicAvailableSlotsService({
  clinicAvailableSlotsRepository,
  auditRepository,
} = {}) {
  return {
    async listAvailableSlots(authContext, params = {}, { correlationId } = {}) {
      const scope = leadsAppointmentsReadScope(authContext);
      ensureClinicOperatorScope(scope);
      const slots = await clinicAvailableSlotsRepository.listAvailableSlots({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "clinic_available_slot.list",
        entityType: "clinic_available_slot",
        correlationId,
        metadata: {
          allClinics: scope.allClinics,
          count: slots.items.length,
          status: slots.filters.status,
          sourceSystem: slots.filters.sourceSystem,
        },
      });
      return { slots, scope };
    },
  };
}

