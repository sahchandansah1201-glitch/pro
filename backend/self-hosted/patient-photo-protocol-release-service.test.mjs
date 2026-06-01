import assert from "node:assert/strict";
import { test } from "node:test";

import { ForbiddenError } from "./rbac.mjs";
import { createPatientPhotoProtocolReleaseService } from "./patient-photo-protocol-release-service.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

const doctorAuth = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};

const clinicAdminAuth = {
  userId: "10000000-0000-4000-8000-000000000102",
  roles: ["clinic_admin"],
  clinicIds: [CLINIC_ID],
};

function release(overrides = {}) {
  return {
    id: "20000000-0000-4000-8000-000000000001",
    clinicId: CLINIC_ID,
    patientId: "10000000-0000-4000-8000-000000000201",
    visitId: VISIT_ID,
    status: "prepared",
    selectedPhotoCount: 2,
    blockers: ["self_hosted_photo_delivery_contract_missing"],
    deliveryBoundary: {
      patientDeliveryAllowed: false,
      fileProxyReady: false,
      requiresRetentionPolicy: true,
      requiresApprovedPatientCopy: true,
    },
    ...overrides,
  };
}

test("Batch R service prepares release ledger and writes aggregate audit metadata", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async prepareRelease() {
        return release();
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-1" };
      },
    },
  });
  const result = await service.prepareRelease(
    VISIT_ID,
    { expiresAt: "2026-06-07T10:00:00.000Z" },
    doctorAuth,
    { correlationId: "corr-r" },
  );
  assert.equal(result.release.status, "prepared");
  assert.equal(result.release.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release.prepare");
  assert.deepEqual(auditEvents[0].metadata, {
    visitId: VISIT_ID,
    status: "prepared",
    selectedPhotoCount: 2,
    blockerCount: 1,
    patientDeliveryAllowed: false,
    fileProxyReady: false,
    requiresRetentionPolicy: true,
    requiresApprovedPatientCopy: true,
  });
});

test("Batch R service revokes release ledger and requires doctor write scope", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async revokeRelease() {
        return release({ status: "revoked", revokeReason: "Пациент попросил закрыть доступ" });
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-2" };
      },
    },
  });
  const result = await service.revokeRelease(
    VISIT_ID,
    { reason: "Пациент попросил закрыть доступ" },
    doctorAuth,
    { correlationId: "corr-revoke" },
  );
  assert.equal(result.release.status, "revoked");
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release.revoke");
  assert.equal(auditEvents[0].metadata.reasonPresent, true);

  await assert.rejects(
    () => service.revokeRelease(VISIT_ID, { reason: "x" }, { userId: USER_ID, roles: ["operator"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch Y service reviews release policy and writes governance audit metadata", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async reviewPolicy() {
        return release({
          expiresAt: "2026-06-10T10:00:00.000Z",
          policy: {
            patientFileProxyEnabled: true,
            patientCopyApproved: true,
            retentionPolicyApproved: true,
          },
          deliveryBoundary: {
            patientDeliveryAllowed: false,
            fileProxyReady: true,
            requiresRetentionPolicy: false,
            requiresApprovedPatientCopy: false,
          },
        });
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-policy" };
      },
    },
  });
  const result = await service.reviewPolicy(
    VISIT_ID,
    {
      expiresAt: "2026-06-10T10:00:00.000Z",
      patientFileProxyEnabled: true,
      patientCopyApproved: true,
      retentionPolicyApproved: true,
    },
    doctorAuth,
    { correlationId: "corr-policy" },
  );
  assert.equal(result.release.deliveryBoundary.fileProxyReady, true);
  assert.equal(result.release.deliveryBoundary.requiresRetentionPolicy, false);
  assert.equal(result.release.deliveryBoundary.requiresApprovedPatientCopy, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release.policy_review");
  assert.equal(auditEvents[0].metadata.expiresAtPresent, true);

  await assert.rejects(
    () => service.reviewPolicy(VISIT_ID, { patientFileProxyEnabled: true }, { userId: USER_ID, roles: ["operator"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch W service exposes release audit to staff read scope and hides internals", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async getReleaseAudit() {
        return {
          releaseId: "20000000-0000-4000-8000-000000000001",
          clinicId: CLINIC_ID,
          patientId: "10000000-0000-4000-8000-000000000201",
          visitId: VISIT_ID,
          status: "revoked",
          summary: {
            eventCount: 2,
            preparedEvents: 1,
            policyReviewEvents: 0,
            revokedEvents: 1,
            patientReadEvents: 0,
            proxyDownloadEvents: 0,
            proxyDeniedEvents: 0,
          },
          events: [
            {
              kind: "release_prepared",
              label: "Подготовка выдачи",
              occurredAt: "2026-05-31T09:30:00.000Z",
              actorType: "staff",
              reasonPresent: false,
            },
            {
              kind: "release_revoked",
              label: "Отзыв выдачи",
              occurredAt: "2026-05-31T09:35:00.000Z",
              actorType: "staff",
              reasonPresent: true,
            },
          ],
          boundaries: {
            immutableLedger: true,
            rawPayloadExposed: false,
            revokeReasonExposed: false,
            actorIdsExposed: false,
            correlationIdsExposed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-read" };
      },
    },
  });

  const result = await service.getReleaseAudit(
    VISIT_ID,
    { userId: "admin-user", roles: ["clinic_admin"], clinicIds: [CLINIC_ID] },
    { correlationId: "corr-audit-read" },
  );
  assert.equal(result.audit.status, "revoked");
  assert.equal(result.audit.boundaries.immutableLedger, true);
  assert.equal(result.audit.boundaries.rawPayloadExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_audit.read");
  assert.equal(auditEvents[0].metadata.eventCount, 2);
  assert.equal(auditEvents[0].metadata.policyReviewEvents, 0);
  assert.equal("correlationId" in result.audit.events[0], false);
  assert.equal("actorUserId" in result.audit.events[0], false);
  assert.equal("revokeReason" in result.audit.events[1], false);

  await assert.rejects(
    () => service.getReleaseAudit(VISIT_ID, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AB service exposes aggregate release governance to clinic admin and audits read", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async getGovernance() {
        return {
          summary: {
            releasesTotal: 4,
            prepared: 2,
            blocked: 1,
            revoked: 1,
            retentionMissing: 2,
            patientCopyMissing: 1,
            fileProxyMissing: 2,
            expiryMissing: 1,
            activeAccessWindows: 1,
            expiringIn24h: 1,
          },
          queue: [
            {
              queueNumber: 1,
              status: "prepared",
              policyStatus: "patient_copy_required",
              selectedPhotoCount: 3,
              blockerCount: 1,
              expiresAt: "2026-06-01T10:00:00.000Z",
              updatedAt: "2026-05-31T10:00:00.000Z",
              attention: ["patient_copy_required"],
            },
          ],
          boundaries: {
            metadataOnly: true,
            patientNamesExposed: false,
            rawIdentifiersExposed: false,
            rawTokensExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            doctorOnlyTextExposed: false,
          },
          operations: {
            retention: { reviewDue: 2 },
            revokeReadiness: { canPrepareRevokeReview: 1 },
            sessionLifecycle: {
              missingExpiry: 1,
              unsafeArtifacts: 0,
              sessionExchangePending: 2,
              sessionExchangeReady: 1,
              sessionExchangeDenied: 1,
              sessionIdsExposed: false,
            },
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-governance" };
      },
    },
  });

  const result = await service.getGovernance(
    { userId: "admin-user", roles: ["clinic_admin"], clinicIds: [CLINIC_ID] },
    { correlationId: "corr-governance" },
  );
  assert.equal(result.governance.summary.releasesTotal, 4);
  assert.equal(result.governance.queue[0].policyStatus, "patient_copy_required");
  assert.equal(result.governance.boundaries.metadataOnly, true);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.read");
  assert.deepEqual(auditEvents[0].metadata, {
    releasesTotal: 4,
    prepared: 2,
    blocked: 1,
    revoked: 1,
    retentionMissing: 2,
    patientCopyMissing: 1,
    fileProxyMissing: 2,
    activeAccessWindows: 1,
    expiringIn24h: 1,
    retentionReviewDue: 2,
    revokeReviewReady: 1,
    sessionMissingExpiry: 1,
    unsafeSessionArtifacts: 0,
    accessArtifactRotationPending: 0,
    accessArtifactRotationPrepared: 0,
    sessionExchangePending: 2,
    sessionExchangeReady: 1,
    sessionExchangeDenied: 1,
    sessionIdsExposed: false,
    metadataOnly: true,
    rawIdentifiersExposed: false,
  });

  await assert.rejects(
    () => service.getGovernance({ userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AD service executes expired revoke operation with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernanceRevokeExpired(params) {
        assert.equal(params.limit, 50);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "revoke_expired_access_windows",
          status: "executed",
          affectedCount: 2,
          skippedActiveCount: 3,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 4,
          limit: 50,
          auditAction: "patient_photo_protocol.release_governance.revoke_expired",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-revoke-expired" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernanceRevokeExpired({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernanceRevokeExpired(
    { confirm: true, limit: 50 },
    clinicAdminAuth,
    { correlationId: "corr-revoke-expired" },
  );
  assert.equal(result.operation.affectedCount, 2);
  assert.equal(result.operation.boundaries.revokeReasonExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.revoke_expired");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "revoke_expired_access_windows",
    status: "executed",
    affectedCount: 2,
    skippedActiveCount: 3,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 4,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
  });

  await assert.rejects(
    () => service.executeGovernanceRevokeExpired({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AE service blocks missing-expiry session windows with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernanceBlockMissingExpiry(params) {
        assert.equal(params.limit, 20);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "block_missing_expiry_access_windows",
          status: "executed",
          affectedCount: 4,
          skippedActiveCount: 2,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 0,
          limit: 20,
          auditAction: "patient_photo_protocol.release_governance.block_missing_expiry",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-block-missing-expiry" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernanceBlockMissingExpiry({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernanceBlockMissingExpiry(
    { confirm: true, limit: 20 },
    clinicAdminAuth,
    { correlationId: "corr-block-missing-expiry" },
  );
  assert.equal(result.operation.affectedCount, 4);
  assert.equal(result.operation.boundaries.sessionIdsExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.block_missing_expiry");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "block_missing_expiry_access_windows",
    status: "executed",
    affectedCount: 4,
    skippedActiveCount: 2,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 0,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
  });

  await assert.rejects(
    () => service.executeGovernanceBlockMissingExpiry({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AF service blocks unapproved-retention windows with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernanceBlockUnapprovedRetention(params) {
        assert.equal(params.limit, 15);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "block_unapproved_retention_windows",
          status: "executed",
          affectedCount: 3,
          skippedActiveCount: 2,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 0,
          limit: 15,
          auditAction: "patient_photo_protocol.release_governance.block_unapproved_retention",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-block-unapproved-retention" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernanceBlockUnapprovedRetention({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernanceBlockUnapprovedRetention(
    { confirm: true, limit: 15 },
    clinicAdminAuth,
    { correlationId: "corr-block-unapproved-retention" },
  );
  assert.equal(result.operation.affectedCount, 3);
  assert.equal(result.operation.boundaries.patientDeliveryAllowed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.block_unapproved_retention");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "block_unapproved_retention_windows",
    status: "executed",
    affectedCount: 3,
    skippedActiveCount: 2,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 0,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
  });

  await assert.rejects(
    () => service.executeGovernanceBlockUnapprovedRetention({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AH service blocks unsafe session artifacts with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernanceBlockUnsafeSessionArtifacts(params) {
        assert.equal(params.limit, 12);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "block_unsafe_session_artifacts",
          status: "executed",
          affectedCount: 5,
          skippedActiveCount: 2,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 0,
          limit: 12,
          auditAction: "patient_photo_protocol.release_governance.block_unsafe_session_artifacts",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-block-unsafe-session" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernanceBlockUnsafeSessionArtifacts({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernanceBlockUnsafeSessionArtifacts(
    { confirm: true, limit: 12 },
    clinicAdminAuth,
    { correlationId: "corr-block-unsafe-session" },
  );
  assert.equal(result.operation.affectedCount, 5);
  assert.equal(result.operation.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.operation.boundaries.qrTokensExposed, false);
  assert.equal(result.operation.boundaries.sessionIdsExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.block_unsafe_session_artifacts");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "block_unsafe_session_artifacts",
    status: "executed",
    affectedCount: 5,
    skippedActiveCount: 2,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 0,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
  });

  await assert.rejects(
    () => service.executeGovernanceBlockUnsafeSessionArtifacts({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AI service prepares access-artifact rotation with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernancePrepareAccessArtifactRotation(params) {
        assert.equal(params.limit, 9);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "prepare_access_artifact_rotation",
          status: "executed",
          affectedCount: 2,
          skippedActiveCount: 3,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 0,
          limit: 9,
          auditAction: "patient_photo_protocol.release_governance.prepare_access_artifact_rotation",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-prepare-access-artifact-rotation" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernancePrepareAccessArtifactRotation({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernancePrepareAccessArtifactRotation(
    { confirm: true, limit: 9 },
    clinicAdminAuth,
    { correlationId: "corr-prepare-access-artifact-rotation" },
  );
  assert.equal(result.operation.affectedCount, 2);
  assert.equal(result.operation.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.operation.boundaries.qrTokensExposed, false);
  assert.equal(result.operation.boundaries.sessionIdsExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.prepare_access_artifact_rotation");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "prepare_access_artifact_rotation",
    status: "executed",
    affectedCount: 2,
    skippedActiveCount: 3,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 0,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
  });

  await assert.rejects(
    () => service.executeGovernancePrepareAccessArtifactRotation({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});

test("Batch AJ service issues credential hash store with aggregate audit and confirm gate", async () => {
  const auditEvents = [];
  const service = createPatientPhotoProtocolReleaseService({
    patientPhotoProtocolReleaseRepository: {
      async executeGovernanceIssueAccessCredentialHash(params) {
        assert.equal(params.limit, 7);
        assert.deepEqual(params.clinicIds, [CLINIC_ID]);
        return {
          operation: "issue_access_credential_hash",
          status: "executed",
          affectedCount: 3,
          skippedActiveCount: 4,
          expiringIn24hCount: 1,
          skippedMissingExpiryCount: 0,
          limit: 7,
          auditAction: "patient_photo_protocol.release_governance.issue_access_credential_hash",
          boundaries: {
            metadataOnly: true,
            patientRowsExposed: false,
            rawIdentifiersExposed: false,
            revokeReasonExposed: false,
            temporaryCredentialsExposed: false,
            qrTokensExposed: false,
            sessionIdsExposed: false,
            storagePathsExposed: false,
            signedUrlsIssued: false,
            patientDeliveryAllowed: false,
            rawCredentialExposed: false,
            credentialHashExposed: false,
            credentialFingerprintExposed: false,
          },
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
        return { id: "audit-issue-access-credential-hash" };
      },
    },
  });

  await assert.rejects(
    () => service.executeGovernanceIssueAccessCredentialHash({ confirm: false }, clinicAdminAuth),
    (error) => error.name === "VisitWorkspaceValidationError" && error.publicDetails?.[0]?.field === "confirm",
  );

  const result = await service.executeGovernanceIssueAccessCredentialHash(
    { confirm: true, limit: 7 },
    clinicAdminAuth,
    { correlationId: "corr-issue-access-credential-hash" },
  );
  assert.equal(result.operation.affectedCount, 3);
  assert.equal(result.operation.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.operation.boundaries.qrTokensExposed, false);
  assert.equal(result.operation.boundaries.sessionIdsExposed, false);
  assert.equal(result.operation.boundaries.rawCredentialExposed, false);
  assert.equal(result.operation.boundaries.credentialHashExposed, false);
  assert.equal(result.operation.boundaries.credentialFingerprintExposed, false);
  assert.equal(auditEvents[0].action, "patient_photo_protocol.release_governance.issue_access_credential_hash");
  assert.equal(auditEvents[0].entityType, "patient_photo_protocol_release_governance_operation");
  assert.deepEqual(auditEvents[0].metadata, {
    operation: "issue_access_credential_hash",
    status: "executed",
    affectedCount: 3,
    skippedActiveCount: 4,
    expiringIn24hCount: 1,
    skippedMissingExpiryCount: 0,
    metadataOnly: true,
    patientRowsExposed: false,
    rawIdentifiersExposed: false,
    revokeReasonExposed: false,
    temporaryCredentialsExposed: false,
    qrTokensExposed: false,
    sessionIdsExposed: false,
    patientDeliveryAllowed: false,
    rawCredentialExposed: false,
    credentialHashExposed: false,
    credentialFingerprintExposed: false,
  });

  await assert.rejects(
    () => service.executeGovernanceIssueAccessCredentialHash({ confirm: true }, { userId: USER_ID, roles: ["patient"], clinicIds: [CLINIC_ID] }),
    ForbiddenError,
  );
});
