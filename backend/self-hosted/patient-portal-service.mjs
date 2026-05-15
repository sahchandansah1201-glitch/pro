// Stage 5N · Patient portal service.
// Only the linked patient account may read /api/v1/me/* resources.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { patientPortalScope } from "./rbac.mjs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class PatientPortalNotFoundError extends Error {
  constructor(message = "Patient portal resource was not found.") {
    super(message);
    this.name = "PatientPortalNotFoundError";
    this.publicCode = "not_found";
    this.publicStatus = 404;
  }
}

function assertUuid(value, field = "id") {
  const text = String(value || "");
  if (!UUID_PATTERN.test(text)) {
    const error = new Error(`${field} must be a valid UUID.`);
    error.publicCode = "invalid_uuid";
    error.publicStatus = 400;
    throw error;
  }
  return text;
}

export function createPatientPortalService({
  patientPortalRepository,
  auditRepository,
} = {}) {
  return {
    async getOverview(authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const overview = await patientPortalRepository.getOverview({ userId: scope.userId });
      await recordAuditBestEffort(auditRepository, {
        clinicId: overview.patient?.clinic?.id || null,
        actorUserId: scope.userId,
        action: "patient_portal.overview.read",
        entityType: "patient_portal",
        entityId: overview.patient?.id || scope.userId,
        correlationId,
        metadata: {
          reportCount: overview.reports.length,
          reminderCount: overview.reminders.length,
        },
      });
      return { overview, scope };
    },

    async getReport(reportId, authContext, { correlationId } = {}) {
      const scope = patientPortalScope(authContext);
      const safeReportId = assertUuid(reportId, "reportId");
      const report = await patientPortalRepository.getReport({
        userId: scope.userId,
        reportId: safeReportId,
      });
      if (!report) throw new PatientPortalNotFoundError();
      await recordAuditBestEffort(auditRepository, {
        clinicId: report.clinic?.id || null,
        actorUserId: scope.userId,
        action: "patient_portal.report.read",
        entityType: "report",
        entityId: report.id,
        correlationId,
        metadata: {
          visitId: report.visitId,
        },
      });
      return { report, scope };
    },
  };
}
