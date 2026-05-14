// Stage 5I · Self-hosted doctor dashboard service.
// Applies clinical RBAC and writes a safe audit event for the dashboard read.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { visitReadScope } from "./rbac.mjs";

function doctorUserFilter(authContext, scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("system_admin") || roles.includes("clinic_admin")) return null;
  if (roles.includes("doctor")) return authContext.userId;
  return null;
}

export function createDoctorDashboardService({
  doctorDashboardRepository,
  auditRepository,
} = {}) {
  return {
    async getDashboard(authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const dashboard = await doctorDashboardRepository.getDashboard({
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        doctorUserId: doctorUserFilter(authContext, scope),
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "doctor.dashboard.read",
        entityType: "doctor_dashboard",
        correlationId,
        metadata: {
          allClinics: scope.allClinics,
          upcoming: dashboard.upcoming.length,
          awaitingConclusions: dashboard.awaitingConclusions.length,
          assetIssues: dashboard.assetIssues.length,
        },
      });
      return { dashboard, scope };
    },
  };
}
