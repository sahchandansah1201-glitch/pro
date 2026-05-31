// Batch R · Patient photo/protocol release ledger service.
// Doctor-write RBAC + audit for metadata-only prepare/revoke operations.

import { recordAuditBestEffort } from "./audit-repository.mjs";
import {
  patientPhotoProtocolGovernanceWriteScope,
  visitReadScope,
  visitWriteScope,
} from "./rbac.mjs";
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

function validateOptionalBoolean(value, field, details) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    details.push({ field, message: `${field} must be boolean.` });
    return undefined;
  }
  return value;
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

export function normalizeReviewPatientPhotoProtocolReleasePolicyPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  const expiresAtProvided = Object.prototype.hasOwnProperty.call(input, "expiresAt");
  let expiresAt = null;
  if (expiresAtProvided) {
    if (input.expiresAt === null || input.expiresAt === "") {
      expiresAt = null;
    } else {
      expiresAt = validateIsoDateTime(input.expiresAt, "expiresAt", details);
    }
  }
  const patientFileProxyEnabled = validateOptionalBoolean(
    input.patientFileProxyEnabled,
    "patientFileProxyEnabled",
    details,
  );
  const patientCopyApproved = validateOptionalBoolean(
    input.patientCopyApproved,
    "patientCopyApproved",
    details,
  );
  const retentionPolicyApproved = validateOptionalBoolean(
    input.retentionPolicyApproved,
    "retentionPolicyApproved",
    details,
  );
  if (
    !expiresAtProvided &&
    patientFileProxyEnabled === undefined &&
    patientCopyApproved === undefined &&
    retentionPolicyApproved === undefined
  ) {
    details.push({
      field: "body",
      message: "At least one policy field is required.",
    });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return {
    expiresAtProvided,
    expiresAt,
    patientFileProxyEnabled,
    patientCopyApproved,
    retentionPolicyApproved,
  };
}

export function normalizeExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredPayload(input = {}) {
  if (!isPlainObject(input)) {
    throw new VisitWorkspaceValidationError([{ field: "body", message: "JSON object is required." }]);
  }
  const details = [];
  if (input.confirm !== true) {
    details.push({ field: "confirm", message: "confirm must be true for production revoke execution." });
  }
  const rawLimit = input.limit ?? 50;
  const limit = Number(rawLimit);
  if (!Number.isFinite(limit) || limit <= 0 || Math.floor(limit) !== limit || limit > 200) {
    details.push({ field: "limit", message: "limit must be an integer from 1 to 200." });
  }
  if (details.length > 0) throw new VisitWorkspaceValidationError(details);
  return { limit };
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
    fileProxyReady: release.deliveryBoundary.fileProxyReady === true,
    requiresRetentionPolicy: release.deliveryBoundary.requiresRetentionPolicy === true,
    requiresApprovedPatientCopy: release.deliveryBoundary.requiresApprovedPatientCopy === true,
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
    policyReviewEvents: audit.summary.policyReviewEvents ?? 0,
    immutableLedger: audit.boundaries.immutableLedger === true,
    rawPayloadExposed: audit.boundaries.rawPayloadExposed === true,
  };
}

function auditGovernanceMetadata(governance) {
  return {
    releasesTotal: governance.summary.releasesTotal,
    prepared: governance.summary.prepared,
    blocked: governance.summary.blocked,
    revoked: governance.summary.revoked,
    retentionMissing: governance.summary.retentionMissing,
    patientCopyMissing: governance.summary.patientCopyMissing,
    fileProxyMissing: governance.summary.fileProxyMissing,
    activeAccessWindows: governance.summary.activeAccessWindows,
    expiringIn24h: governance.summary.expiringIn24h,
    retentionReviewDue: governance.operations?.retention?.reviewDue ?? 0,
    revokeReviewReady: governance.operations?.revokeReadiness?.canPrepareRevokeReview ?? 0,
    sessionMissingExpiry: governance.operations?.sessionLifecycle?.missingExpiry ?? 0,
    sessionIdsExposed: governance.operations?.sessionLifecycle?.sessionIdsExposed === true,
    metadataOnly: governance.boundaries.metadataOnly === true,
    rawIdentifiersExposed: governance.boundaries.rawIdentifiersExposed === true,
  };
}

function auditGovernanceOperationMetadata(operation) {
  return {
    operation: operation.operation,
    status: operation.status,
    affectedCount: operation.affectedCount,
    skippedActiveCount: operation.skippedActiveCount,
    expiringIn24hCount: operation.expiringIn24hCount,
    skippedMissingExpiryCount: operation.skippedMissingExpiryCount,
    metadataOnly: operation.boundaries.metadataOnly === true,
    patientRowsExposed: operation.boundaries.patientRowsExposed === true,
    rawIdentifiersExposed: operation.boundaries.rawIdentifiersExposed === true,
    revokeReasonExposed: operation.boundaries.revokeReasonExposed === true,
    temporaryCredentialsExposed: operation.boundaries.temporaryCredentialsExposed === true,
    qrTokensExposed: operation.boundaries.qrTokensExposed === true,
    sessionIdsExposed: operation.boundaries.sessionIdsExposed === true,
    patientDeliveryAllowed: operation.boundaries.patientDeliveryAllowed === true,
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

    async reviewPolicy(visitId, input, authContext, { correlationId } = {}) {
      const safeVisitId = assertUuid(visitId, "visitId");
      const scope = visitWriteScope(authContext);
      const payload = normalizeReviewPatientPhotoProtocolReleasePolicyPayload(input);
      const release = await patientPhotoProtocolReleaseRepository.reviewPolicy({
        visitId: safeVisitId,
        actorUserId: authContext.userId,
        expiresAtProvided: payload.expiresAtProvided,
        expiresAt: payload.expiresAt,
        patientFileProxyEnabled: payload.patientFileProxyEnabled,
        patientCopyApproved: payload.patientCopyApproved,
        retentionPolicyApproved: payload.retentionPolicyApproved,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      if (!release) {
        throw new VisitWorkspaceNotFoundError("Patient photo protocol release policy could not be updated.");
      }
      ensureScopeAllowsClinic(scope, release.clinicId);
      await recordAuditBestEffort(auditRepository, {
        clinicId: release.clinicId,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release.policy_review",
        entityType: "patient_photo_protocol_release",
        entityId: release.id,
        correlationId,
        metadata: {
          ...auditMetadata(release),
          expiresAtPresent: Boolean(release.expiresAt),
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

    async getGovernance(authContext, { correlationId } = {}) {
      const scope = visitReadScope(authContext);
      const governance = await patientPhotoProtocolReleaseRepository.getGovernance({
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release_governance.read",
        entityType: "patient_photo_protocol_release_governance",
        entityId: null,
        correlationId,
        metadata: auditGovernanceMetadata(governance),
      });
      return { governance, scope };
    },

    async executeGovernanceRevokeExpired(input, authContext, { correlationId } = {}) {
      const scope = patientPhotoProtocolGovernanceWriteScope(authContext);
      const payload = normalizeExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredPayload(input);
      const operation = await patientPhotoProtocolReleaseRepository.executeGovernanceRevokeExpired({
        actorUserId: authContext.userId,
        clinicIds: scope.clinicIds,
        allClinics: scope.allClinics,
        limit: payload.limit,
      });
      await recordAuditBestEffort(auditRepository, {
        clinicId: null,
        actorUserId: authContext.userId,
        action: "patient_photo_protocol.release_governance.revoke_expired",
        entityType: "patient_photo_protocol_release_governance_operation",
        entityId: null,
        correlationId,
        metadata: auditGovernanceOperationMetadata(operation),
      });
      return { operation, scope };
    },
  };
}
