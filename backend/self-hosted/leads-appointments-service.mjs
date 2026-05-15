// Stage 5K · Self-hosted leads/appointments service.
// Applies local RBAC and records safe audit metadata for intake overview reads.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { leadsAppointmentsReadScope } from "./rbac.mjs";

function doctorUserFilter(authContext, scope) {
  const roles = Array.isArray(scope.roles) ? scope.roles : [];
  if (roles.includes("system_admin") || roles.includes("clinic_admin") || roles.includes("operator")) {
    return null;
  }
  if (roles.includes("doctor")) return authContext.userId;
  return null;
}

export function createLeadsAppointmentsService({
  leadsAppointmentsRepository,
  auditRepository,
} = {}) {
  return {
    async getOverview(authContext, params = {}, { correlationId } = {}) {
      const scope = leadsAppointmentsReadScope(authContext);
      const overview = await leadsAppointmentsRepository.getOverview({
        ...params,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        doctorUserId: doctorUserFilter(authContext, scope),
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: scope.allClinics ? null : scope.clinicIds[0],
        actorUserId: authContext.userId,
        action: "leads.appointments.overview.read",
        entityType: "lead_appointment_overview",
        correlationId,
        metadata: {
          allClinics: scope.allClinics,
          leads: overview.leads.length,
          appointments: overview.appointments.length,
          leadStatus: overview.filters.leadStatus,
          appointmentStatus: overview.filters.appointmentStatus,
        },
      });
      return { overview, scope };
    },
  };
}
