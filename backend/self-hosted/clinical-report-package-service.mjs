// Stage 8G-8I · Clinical reporting completion service.
// RBAC + audit for report package readiness without external runtime calls.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { visitReadScope } from "./rbac.mjs";
import {
  assertUuid,
  VisitWorkspaceNotFoundError,
} from "./visit-workspace-write-service.mjs";

function ensureScopeAllowsClinic(scope, clinicId) {
  if (scope.allClinics) return;
  if (!clinicId || !scope.clinicIds.includes(clinicId)) {
    throw new VisitWorkspaceNotFoundError("Report package was not found in the allowed clinic scope.");
  }
}

export function createClinicalReportPackageService({
  clinicalReportPackageRepository,
  auditRepository,
} = {}) {
  return {
    async getReportPackage(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const reportPackage = await clinicalReportPackageRepository.getReportPackage({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!reportPackage) {
        throw new VisitWorkspaceNotFoundError("Report package was not found in the allowed clinic scope.");
      }
      ensureScopeAllowsClinic(scope, reportPackage.clinicId);
      await recordAuditBestEffort(auditRepository, {
        clinicId: reportPackage.clinicId,
        actorUserId: authContext.userId,
        action: "clinical_report.package.read",
        entityType: "visit",
        entityId: safeVisitId,
        correlationId,
        metadata: {
          ready: reportPackage.readiness.ready,
          missingCount: reportPackage.readiness.missing.length,
          lesionCount: reportPackage.counts.lesions,
          assetCount: reportPackage.counts.assets,
          patientPhotoProtocolStatus: reportPackage.patientPhotoProtocol?.status ?? "unknown",
          patientPhotoAssetCount: reportPackage.patientPhotoProtocol?.selectedPhotoCount ?? 0,
          patientPhotoDeliveryAllowed: reportPackage.patientPhotoProtocol?.deliveryBoundary?.patientDeliveryAllowed === true,
        },
      });
      return { reportPackage, scope };
    },
  };
}
