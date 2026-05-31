// Batch R · Patient photo/protocol release ledger service.
// Doctor-write RBAC + audit for metadata-only prepare/revoke operations.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import { visitReadScope, visitWriteScope } from "./rbac.mjs";
import {
  assertUuid,
  VisitWorkspaceNotFoundError,
  VisitWorkspaceValidationError,
} from "./visit-workspace-write-service.mjs";

const MAX_REASON = 500;

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value) {
  if (value == null) return null;
  const cleaned = String(value).trim().replace(/\s+/g, " ");
  return cleaned || null;
}

function validateIsoDateTime(value, field, details) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  const date = new Date(cleaned);
  if (Number.isNaN(date.getTime())) {
    details.push({ field, message: `${field} must be an ISO date-time.` });
    return null;
  }
  return date.toISOString();
}

export function normalizePreparePatientPhotoProtocolReleasePayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const expiresAt = validateIsoDateTime(input.expiresAt, "expiresAt", details);
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return { expiresAt };
}

export function normalizeRevokePatientPhotoProtocolReleasePayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const reason = cleanString(input.reason);
  const details = [];
  if (!reason) details.push({ field: "reason", message: "reason is required." });
  if (reason && reason.length > MAX_REASON) {
    details.push({ field: "reason", message: "reason is too long." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return { reason };
}

function ensureScopeAllowsClinic(scope, clinicId) {
  if (scope.allClinics) return;
  if (!clinicId || !scope.clinicIds.includes(clinicId)) {
    throw new VisitWorkspaceNotFoundError("Patient photo protocol release was not found in the allowed clinic scope.");
  }
}

function auditMetadata(release) {
  return {
    visitId: release.visitId,
    status: release.status,
    selectedPhotoCount: release.selectedPhotoCount,
    blockerCount: release.blockers.length,
    patientDeliveryAllowed: release.deliveryBoundary.patientDeliveryAllowed === true,
  };
}

function auditReviewMetadata(audit) {
  return {
    visitId: audit.visitId,
    status: audit.status,
    eventCount: audit.summary.eventCount,
    preparedEvents: audit.summary.preparedEvents,
    revokedEvents: audit.summary.revokedEvents,
    patientReadEvents: audit.summary.patientReadEvents,
    proxyDownloadEvents: audit.summary.proxyDownloadEvents,
    proxyDeniedEvents: audit.summary.proxyDeniedEvents,
    immutableLedger: audit.boundaries.immutableLedger === true,
    rawPayloadExposed: audit.boundaries.rawPayloadExposed === true,
  };
}

export function createPatientPhotoProtocolReleaseService({
  patientPhotoProtocolReleaseRepository,
  auditRepository,
} = {}) {
  return {
    async prepareRelease(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizePreparePatientPhotoProtocolReleasePayload(input);
      const release = await patientPhotoProtocolReleaseRepository.prepareRelease({
        visitId: safeVisitId,
        actorUserId: authContext.userId,
        expiresAt: payload.expiresAt,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!release) {
        throw new VisitWorkspaceNotFoundError("Patient photo protocol release could not be prepared.");
      }
      ensureScopeAllowsClinic(scope, release.clinicId);
      await recordAuditBestEffort(auditRepository, {
        clinicId: release.clinicId,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release.prepare",
        entityType: "patient_photo_protocol_release",
        entityId: release.id,
        correlationId,
        metadata: auditMetadata(release),
      });
      return { release, scope };
    },

    async revokeRelease(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeRevokePatientPhotoProtocolReleasePayload(input);
      const release = await patientPhotoProtocolReleaseRepository.revokeRelease({
        visitId: safeVisitId,
        actorUserId: authContext.userId,
        reason: payload.reason,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!release) {
        throw new VisitWorkspaceNotFoundError("Patient photo protocol release could not be revoked.");
      }
      ensureScopeAllowsClinic(scope, release.clinicId);
      await recordAuditBestEffort(auditRepository, {
        clinicId: release.clinicId,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release.revoke",
        entityType: "patient_photo_protocol_release",
        entityId: release.id,
        correlationId,
        metadata: {
          ...auditMetadata(release),
          reasonPresent: Boolean(release.revokeReason),
        },
      });
      return { release, scope };
    },

    async getReleaseAudit(visitId, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitReadScope(authContext);
      const audit = await patientPhotoProtocolReleaseRepository.getReleaseAudit({
        visitId: safeVisitId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!audit) {
        throw new VisitWorkspaceNotFoundError("Patient photo protocol release audit was not found.");
      }
      ensureScopeAllowsClinic(scope, audit.clinicId);
      await recordAuditBestEffort(auditRepository, {
        clinicId: audit.clinicId,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release_audit.read",
        entityType: "patient_photo_protocol_release",
        entityId: audit.releaseId,
        correlationId,
        metadata: auditReviewMetadata(audit),
      });
      return { audit, scope };
    },
  };
}
