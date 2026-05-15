// Stage 5J · Self-hosted visit schedule service.
// Applies clinical RBAC and records safe audit metadata for schedule reads.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { visitReadScope } from "./rbac.mjs";

function doctorUserFilter(authContext, scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("system_admin") || roles.includes("clinic_admin")) return null;
  if (roles.includes("doctor")) return authContext.userId;
  return null;
}

export function createVisitScheduleService({
  visitScheduleRepository,
  auditRepository,
} = {}) {
  return {
    async listVisits(authContext, params = {}, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const schedule = await visitScheduleRepository.listVisits({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        doctorUserId: doctorUserFilter(authContext, scope),
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "visit.schedule.list",
        entityType: "visit",
        correlationId,
        metadata: {
          allClinics: scope.allClinics,
          count: schedule.items.length,
          total: schedule.count,
          status: schedule.filters.status,
        },
      });
      return { schedule, scope };
    },
  };
}
