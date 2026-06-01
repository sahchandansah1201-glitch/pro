import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockMissingExpirySql,
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashSql,
  buildExecutePatientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationSql,
  buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql,
  buildGetPatientPhotoProtocolReleaseGovernanceSql,
  buildGetPatientPhotoProtocolReleaseAuditSql,
  buildPreparePatientPhotoProtocolReleaseSql,
  buildReviewPatientPhotoProtocolReleasePolicySql,
  buildRevokePatientPhotoProtocolReleaseSql,
  createPatientPhotoProtocolReleaseRepository,
} from "./patient-photo-protocol-release-repository.mjs";

const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const USER_ID = "10000000-0000-4000-8000-000000000101";

test("Batch R repository builds prepare SQL without protected file fields", () => {
  const sql = buildPreparePatientPhotoProtocolReleaseSql({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    expiresAt: "2026-06-07T10:00:00.000Z",
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /insert into patient_photo_protocol_releases/);
  assert.match(sql, /p\.imaging_consent/);
  assert.match(sql, /patient_photo_count/);
  assert.match(sql, /self_hosted_photo_delivery_contract_missing/);
  assert.match(sql, /on conflict \(visit_id\) do update/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token/i);
});

test("Batch R repository normalizes prepared release as metadata-only and delivery-blocked", async () => {
  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        id: "20000000-0000-4000-8000-000000000001",
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        reportId: "30000000-0000-4000-8000-000000000001",
        status: "prepared",
        selectedPhotoCount: 2,
        overviewPhotoCount: 1,
        dermoscopyPhotoCount: 1,
        reportAttachmentCount: 0,
        blockers: ["self_hosted_photo_delivery_contract_missing"],
        preparedAt: "2026-05-31T09:30:00.000Z",
        revokedAt: null,
        revokeReason: null,
        expiresAt: "2026-06-07T10:00:00.000Z",
        patientFileProxyEnabled: true,
        patientCopyApproved: true,
        retentionPolicyApproved: true,
      }];
    },
  });
  const release = await repository.prepareRelease({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    expiresAt: "2026-06-07T10:00:00.000Z",
    clinicIds: [CLINIC_ID],
  });
  assert.equal(release.status, "prepared");
  assert.equal(release.selectedPhotoCount, 2);
  assert.deepEqual(release.blockers, ["self_hosted_photo_delivery_contract_missing"]);
  assert.equal(release.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(release.deliveryBoundary.rawFilesExposed, false);
  assert.equal(release.deliveryBoundary.signedUrlsIssued, false);
  assert.equal(release.deliveryBoundary.storagePathsExposed, false);
  assert.equal(release.deliveryBoundary.tokensExposed, false);
  assert.equal(release.deliveryBoundary.fileProxyReady, true);
  assert.equal(release.deliveryBoundary.requiresSelfHostedFileProxy, false);
  assert.equal(release.deliveryBoundary.requiresRetentionPolicy, false);
  assert.equal(release.deliveryBoundary.requiresApprovedPatientCopy, false);
  assert.equal(release.policy.patientFileProxyEnabled, true);
  assert.equal(release.policy.patientCopyApproved, true);
  assert.equal(release.policy.retentionPolicyApproved, true);
  assert.equal(release.deliveryBoundary.requiresReleaseAudit, true);
  assert.equal(release.deliveryBoundary.requiresRevoke, true);
  assert.equal("preparedByUserId" in release, false);
});

test("Batch Y repository builds policy-review SQL and normalizes policy flags safely", async () => {
  const sql = buildReviewPatientPhotoProtocolReleasePolicySql({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    expiresAtProvided: true,
    expiresAt: "2026-06-08T10:00:00.000Z",
    patientFileProxyEnabled: true,
    patientCopyApproved: false,
    retentionPolicyApproved: true,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /patient_photo_protocol_releases/i);
  assert.match(sql, /metadata_json/);
  assert.match(sql, /patientFileProxyEnabled/);
  assert.match(sql, /retentionPolicyApproved/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        id: "20000000-0000-4000-8000-000000000001",
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        reportId: "30000000-0000-4000-8000-000000000001",
        status: "prepared",
        selectedPhotoCount: 2,
        overviewPhotoCount: 1,
        dermoscopyPhotoCount: 1,
        reportAttachmentCount: 0,
        blockers: ["self_hosted_photo_delivery_contract_missing"],
        preparedAt: "2026-05-31T09:30:00.000Z",
        revokedAt: null,
        revokeReason: null,
        expiresAt: "2026-06-08T10:00:00.000Z",
        patientFileProxyEnabled: true,
        patientCopyApproved: false,
        retentionPolicyApproved: true,
      }];
    },
  });
  const release = await repository.reviewPolicy({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    expiresAtProvided: true,
    expiresAt: "2026-06-08T10:00:00.000Z",
    patientFileProxyEnabled: true,
    patientCopyApproved: false,
    retentionPolicyApproved: true,
    clinicIds: [CLINIC_ID],
  });
  assert.equal(release.deliveryBoundary.fileProxyReady, true);
  assert.equal(release.deliveryBoundary.requiresSelfHostedFileProxy, false);
  assert.equal(release.deliveryBoundary.requiresRetentionPolicy, false);
  assert.equal(release.deliveryBoundary.requiresApprovedPatientCopy, true);
  assert.equal(release.policy.patientCopyApproved, false);
});

test("Batch R repository builds and normalizes revoke release SQL safely", async () => {
  const sql = buildRevokePatientPhotoProtocolReleaseSql({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    reason: "Пациент попросил закрыть доступ",
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /update patient_photo_protocol_releases/);
  assert.match(sql, /status = 'revoked'/);
  assert.doesNotMatch(sql, /object_bucket|object_key|storage_object_path|signed_url|access_token/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        id: "20000000-0000-4000-8000-000000000001",
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        reportId: "30000000-0000-4000-8000-000000000001",
        status: "revoked",
        selectedPhotoCount: 2,
        overviewPhotoCount: 1,
        dermoscopyPhotoCount: 1,
        reportAttachmentCount: 0,
        blockers: ["self_hosted_photo_delivery_contract_missing"],
        preparedAt: "2026-05-31T09:30:00.000Z",
        revokedAt: "2026-05-31T09:35:00.000Z",
        revokeReason: "Пациент попросил закрыть доступ",
        expiresAt: "2026-06-07T10:00:00.000Z",
        patientFileProxyEnabled: false,
        patientCopyApproved: false,
        retentionPolicyApproved: false,
      }];
    },
  });
  const release = await repository.revokeRelease({
    visitId: VISIT_ID,
    actorUserId: USER_ID,
    reason: "Пациент попросил закрыть доступ",
    clinicIds: [CLINIC_ID],
  });
  assert.equal(release.status, "revoked");
  assert.equal(release.revokeReason, "Пациент попросил закрыть доступ");
  assert.equal(release.deliveryBoundary.patientDeliveryAllowed, false);
  assert.equal(release.deliveryBoundary.requiresRetentionPolicy, true);
  assert.equal(release.policy.patientFileProxyEnabled, false);
});

test("Batch W repository builds staff audit SQL and returns safe immutable summary", async () => {
  const sql = buildGetPatientPhotoProtocolReleaseAuditSql({
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.match(sql, /from patient_photo_protocol_releases/);
  assert.match(sql, /audit_log/);
  assert.match(sql, /patient_photo_protocol\.release\.prepare/);
  assert.match(sql, /patient_photo_protocol\.release\.policy_review/);
  assert.match(sql, /patient_portal\.photo_protocol\.proxy\.download/);
  assert.match(sql, /reasonPresent/);
  assert.doesNotMatch(sql, /revoke_reason|object_bucket|object_key|storage_object_path|signed_url|access_token/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        releaseId: "20000000-0000-4000-8000-000000000001",
        clinicId: CLINIC_ID,
        patientId: "10000000-0000-4000-8000-000000000201",
        visitId: VISIT_ID,
        status: "revoked",
        eventCount: 4,
        preparedEventCount: 1,
        policyReviewEventCount: 1,
        revokedEventCount: 1,
        patientReadEventCount: 0,
        proxyDownloadEventCount: 1,
        proxyDeniedEventCount: 0,
        events: [
          {
            occurredAt: "2026-05-31T09:30:00.000Z",
            action: "patient_photo_protocol.release.prepare",
            entityType: "patient_photo_protocol_release",
            status: "prepared",
            selectedPhotoCount: 2,
            blockerCount: 1,
            patientDeliveryAllowed: false,
            reasonPresent: false,
            correlationId: "hidden",
            actorUserId: USER_ID,
            rawPayload: { objectKey: "hidden" },
          },
          {
            occurredAt: "2026-05-31T09:32:00.000Z",
            action: "patient_photo_protocol.release.policy_review",
            entityType: "patient_photo_protocol_release",
            status: "prepared",
            selectedPhotoCount: 2,
            blockerCount: 1,
            patientDeliveryAllowed: false,
            reasonPresent: false,
          },
          {
            occurredAt: "2026-05-31T09:35:00.000Z",
            action: "patient_photo_protocol.release.revoke",
            entityType: "patient_photo_protocol_release",
            status: "revoked",
            selectedPhotoCount: 2,
            blockerCount: 1,
            patientDeliveryAllowed: false,
            reasonPresent: true,
            revokeReason: "hidden",
          },
          {
            occurredAt: "2026-05-31T09:40:00.000Z",
            action: "patient_portal.photo_protocol.proxy.download",
            entityType: "patient_photo_protocol_release",
            status: "prepared",
            selectedPhotoCount: 2,
            blockerCount: 0,
            patientDeliveryAllowed: false,
            reasonPresent: false,
            storagePath: "hidden",
          },
        ],
      }];
    },
  });
  const audit = await repository.getReleaseAudit({
    visitId: VISIT_ID,
    clinicIds: [CLINIC_ID],
  });
  assert.equal(audit.status, "revoked");
  assert.equal(audit.summary.eventCount, 4);
  assert.equal(audit.summary.policyReviewEvents, 1);
  assert.equal(audit.summary.revokedEvents, 1);
  assert.equal(audit.boundaries.immutableLedger, true);
  assert.equal(audit.boundaries.rawPayloadExposed, false);
  assert.equal(audit.boundaries.revokeReasonExposed, false);
  assert.equal(audit.boundaries.correlationIdsExposed, false);
  assert.equal(audit.events[0].kind, "release_prepared");
  const revokedEvent = audit.events.find((event) => event.kind === "release_revoked");
  const proxyDownloadEvent = audit.events.find((event) => event.kind === "proxy_download");
  assert.ok(revokedEvent);
  assert.ok(proxyDownloadEvent);
  assert.equal(revokedEvent.reasonPresent, true);
  assert.equal("correlationId" in audit.events[0], false);
  assert.equal("actorUserId" in audit.events[0], false);
  assert.equal("rawPayload" in audit.events[0], false);
  assert.equal("revokeReason" in revokedEvent, false);
  assert.equal("storagePath" in proxyDownloadEvent, false);
});

test("Batch AB repository builds safe release governance SQL and normalizes metadata-only queue", async () => {
  const sql = buildGetPatientPhotoProtocolReleaseGovernanceSql({
    clinicIds: [CLINIC_ID],
    limit: 10,
  });
  assert.match(sql, /patient_photo_protocol_releases/);
  assert.match(sql, /retentionPolicyApproved/);
  assert.match(sql, /patientCopyApproved/);
  assert.match(sql, /patientFileProxyEnabled/);
  assert.match(sql, /review_retention_policy/);
  assert.match(sql, /prepare_revoke_review/);
  assert.match(sql, /temporaryCredentialsExposed/);
  assert.match(sql, /qrTokensExposed/);
  assert.match(sql, /sessionIdsExposed/);
  assert.match(sql, /queue/);
  assert.match(sql, /where sr\.queue_number <= 10/);
  assert.doesNotMatch(sql, /limit 10/);
  assert.doesNotMatch(sql, /patient_id::text|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
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
            selectedPhotoCount: 3,
            blockers: ["self_hosted_photo_delivery_contract_missing"],
            expiresAt: "2026-06-01T10:00:00.000Z",
            updatedAt: "2026-05-31T10:00:00.000Z",
            patientFileProxyEnabled: true,
            patientCopyApproved: false,
            retentionPolicyApproved: true,
            patientId: "hidden",
            storagePath: "hidden",
            accessToken: "hidden",
          },
        ],
        boundaries: {
          patientNamesExposed: true,
          rawIdentifiersExposed: true,
          rawTokensExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          doctorOnlyTextExposed: true,
        },
        operations: {
          retention: {
            reviewDue: 2,
            ready: 1,
            blocked: 1,
            requiresClinicSignoff: true,
            nextAction: "review_retention_policy",
          },
          revokeReadiness: {
            activeWindows: 1,
            expiringIn24h: 1,
            revoked: 1,
            canPrepareRevokeReview: 1,
            requiresManualReason: true,
            revokeReasonExposed: true,
          },
          sessionLifecycle: {
            active: 1,
            expiringIn24h: 1,
            missingExpiry: 1,
            revoked: 1,
            temporaryCredentialsExposed: true,
            qrTokensExposed: true,
            sessionIdsExposed: true,
          },
          allowedOperations: ["review_retention_policy", "prepare_revoke_review"],
          blockedOperations: ["issue_raw_token", "issue_signed_url"],
        },
      }];
    },
  });
  const governance = await repository.getGovernance({ clinicIds: [CLINIC_ID] });
  assert.equal(governance.summary.releasesTotal, 4);
  assert.equal(governance.summary.retentionMissing, 2);
  assert.equal(governance.queue[0].policyStatus, "patient_copy_required");
  assert.equal(governance.queue[0].selectedPhotoCount, 3);
  assert.equal(governance.operations.retention.reviewDue, 2);
  assert.equal(governance.operations.retention.nextAction, "review_retention_policy");
  assert.equal(governance.operations.revokeReadiness.canPrepareRevokeReview, 1);
  assert.equal(governance.operations.revokeReadiness.revokeReasonExposed, false);
  assert.equal(governance.operations.sessionLifecycle.missingExpiry, 1);
  assert.equal(governance.operations.sessionLifecycle.temporaryCredentialsExposed, false);
  assert.equal(governance.operations.sessionLifecycle.qrTokensExposed, false);
  assert.equal(governance.operations.sessionLifecycle.sessionIdsExposed, false);
  assert.deepEqual(governance.operations.allowedOperations, ["review_retention_policy", "prepare_revoke_review"]);
  assert.equal("patientId" in governance.queue[0], false);
  assert.equal("storagePath" in governance.queue[0], false);
  assert.equal(governance.boundaries.patientNamesExposed, false);
  assert.equal(governance.boundaries.rawIdentifiersExposed, false);
  assert.equal(governance.boundaries.rawTokensExposed, false);
});

test("Batch AD repository executes expired revoke operation as aggregate-only lifecycle control", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernanceRevokeExpiredSql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 25,
  });
  assert.match(sql, /revoke_expired_access_windows/);
  assert.match(sql, /status = 'revoked'/);
  assert.match(sql, /expires_at <= now\(\)/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.revoke_expired/);
  assert.match(sql, /temporaryCredentialsExposed/);
  assert.match(sql, /qrTokensExposed/);
  assert.match(sql, /sessionIdsExposed/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "revoke_expired_access_windows",
        status: "executed",
        affectedCount: 3,
        skippedActiveCount: 2,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 4,
        limit: 25,
        auditAction: "patient_photo_protocol.release_governance.revoke_expired",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernanceRevokeExpired({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 25,
  });
  assert.equal(result.operation, "revoke_expired_access_windows");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 3);
  assert.equal(result.skippedMissingExpiryCount, 4);
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.revokeReasonExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
});

test("Batch AE repository blocks missing-expiry access windows as aggregate-only session lifecycle control", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernanceBlockMissingExpirySql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 20,
  });
  assert.match(sql, /block_missing_expiry_access_windows/);
  assert.match(sql, /status = 'blocked'/);
  assert.match(sql, /r\.status = 'prepared'/);
  assert.match(sql, /r\.expires_at is null/);
  assert.match(sql, /expiry_required/);
  assert.match(sql, /session_lifecycle_review_required/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_missing_expiry/);
  assert.match(sql, /temporaryCredentialsExposed/);
  assert.match(sql, /qrTokensExposed/);
  assert.match(sql, /sessionIdsExposed/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "block_missing_expiry_access_windows",
        status: "executed",
        affectedCount: 4,
        skippedActiveCount: 2,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 0,
        limit: 20,
        auditAction: "patient_photo_protocol.release_governance.block_missing_expiry",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernanceBlockMissingExpiry({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 20,
  });
  assert.equal(result.operation, "block_missing_expiry_access_windows");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 4);
  assert.equal(result.skippedMissingExpiryCount, 0);
  assert.equal(result.auditAction, "patient_photo_protocol.release_governance.block_missing_expiry");
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.revokeReasonExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
});

test("Batch AF repository blocks unapproved-retention access windows as aggregate-only lifecycle control", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnapprovedRetentionSql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 15,
  });
  assert.match(sql, /block_unapproved_retention_windows/);
  assert.match(sql, /status = 'blocked'/);
  assert.match(sql, /r\.status = 'prepared'/);
  assert.match(sql, /r\.expires_at is not null/);
  assert.match(sql, /r\.expires_at > now\(\)/);
  assert.match(sql, /retentionPolicyApproved/);
  assert.match(sql, /retention_policy_required/);
  assert.match(sql, /retention_review_required/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_unapproved_retention/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "block_unapproved_retention_windows",
        status: "executed",
        affectedCount: 3,
        skippedActiveCount: 2,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 0,
        limit: 15,
        auditAction: "patient_photo_protocol.release_governance.block_unapproved_retention",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernanceBlockUnapprovedRetention({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 15,
  });
  assert.equal(result.operation, "block_unapproved_retention_windows");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 3);
  assert.equal(result.auditAction, "patient_photo_protocol.release_governance.block_unapproved_retention");
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
});

test("Batch AH repository blocks unsafe session artifacts without exposing credentials", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernanceBlockUnsafeSessionArtifactsSql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 12,
  });
  assert.match(sql, /block_unsafe_session_artifacts/);
  assert.match(sql, /status = 'blocked'/);
  assert.match(sql, /r\.status = 'prepared'/);
  assert.match(sql, /temporaryCredentialIssued/);
  assert.match(sql, /qrTokenIssued/);
  assert.match(sql, /sessionIssued/);
  assert.match(sql, /- 'temporaryCredentialIssuedAt'/);
  assert.match(sql, /- 'qrTokenIssuedAt'/);
  assert.match(sql, /- 'sessionIssuedAt'/);
  assert.match(sql, /credential_rotation_required/);
  assert.match(sql, /session_boundary_review_required/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.block_unsafe_session_artifacts/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "block_unsafe_session_artifacts",
        status: "executed",
        affectedCount: 5,
        skippedActiveCount: 2,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 0,
        limit: 12,
        auditAction: "patient_photo_protocol.release_governance.block_unsafe_session_artifacts",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernanceBlockUnsafeSessionArtifacts({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 12,
  });
  assert.equal(result.operation, "block_unsafe_session_artifacts");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 5);
  assert.equal(result.auditAction, "patient_photo_protocol.release_governance.block_unsafe_session_artifacts");
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
});

test("Batch AI repository prepares access-artifact rotation ledger without issuing secrets", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernancePrepareAccessArtifactRotationSql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 9,
  });
  assert.match(sql, /prepare_access_artifact_rotation/);
  assert.match(sql, /patient_photo_protocol_access_artifact_rotations/);
  assert.match(sql, /r\.status = 'blocked'/);
  assert.match(sql, /credential_rotation_required/);
  assert.match(sql, /session_boundary_review_required/);
  assert.match(sql, /accessArtifactRotationPrepared/);
  assert.match(sql, /requiresSecureCredentialStore/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.prepare_access_artifact_rotation/);
  assert.match(sql, /temporaryCredentialsExposed/);
  assert.match(sql, /qrTokensExposed/);
  assert.match(sql, /sessionIdsExposed/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "prepare_access_artifact_rotation",
        status: "executed",
        affectedCount: 2,
        skippedActiveCount: 3,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 0,
        limit: 9,
        auditAction: "patient_photo_protocol.release_governance.prepare_access_artifact_rotation",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernancePrepareAccessArtifactRotation({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 9,
  });
  assert.equal(result.operation, "prepare_access_artifact_rotation");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 2);
  assert.equal(result.auditAction, "patient_photo_protocol.release_governance.prepare_access_artifact_rotation");
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
});

test("Batch AJ repository issues credential hash ledger without exposing credential material", async () => {
  const sql = buildExecutePatientPhotoProtocolReleaseGovernanceIssueAccessCredentialHashSql({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 7,
  });
  assert.match(sql, /issue_access_credential_hash/);
  assert.match(sql, /patient_photo_protocol_access_credentials/);
  assert.match(sql, /current_setting\('app\.patient_photo_protocol_credential_pepper'/);
  assert.match(sql, /hmac\(/);
  assert.match(sql, /credential_hash/);
  assert.match(sql, /credential_fingerprint/);
  assert.match(sql, /accessArtifactRotationPrepared/);
  assert.match(sql, /requiresSecureCredentialStore/);
  assert.match(sql, /credentialHashStored/);
  assert.match(sql, /credentialFingerprintStored/);
  assert.match(sql, /credentialStoreReady/);
  assert.match(sql, /requiresSessionExchange/);
  assert.match(sql, /patient_photo_protocol\.release_governance\.issue_access_credential_hash/);
  assert.match(sql, /rawCredentialExposed/);
  assert.match(sql, /credentialHashExposed/);
  assert.match(sql, /credentialFingerprintExposed/);
  assert.doesNotMatch(sql, /patient_id::text|visit_id::text|revoke_reason as|object_bucket|object_key|storage_object_path|signed_url|access_token|physician_text|rawCredential"\s*:|credentialPlaintext|credentialValue/i);

  const repository = createPatientPhotoProtocolReleaseRepository({
    async queryJson() {
      return [{
        operation: "issue_access_credential_hash",
        status: "executed",
        affectedCount: 3,
        skippedActiveCount: 4,
        expiringIn24hCount: 1,
        skippedMissingExpiryCount: 0,
        limit: 7,
        auditAction: "patient_photo_protocol.release_governance.issue_access_credential_hash",
        boundaries: {
          metadataOnly: false,
          patientRowsExposed: true,
          rawIdentifiersExposed: true,
          revokeReasonExposed: true,
          temporaryCredentialsExposed: true,
          qrTokensExposed: true,
          sessionIdsExposed: true,
          storagePathsExposed: true,
          signedUrlsIssued: true,
          patientDeliveryAllowed: true,
          rawCredentialExposed: true,
          credentialHashExposed: true,
          credentialFingerprintExposed: true,
        },
      }];
    },
  });
  const result = await repository.executeGovernanceIssueAccessCredentialHash({
    actorUserId: USER_ID,
    clinicIds: [CLINIC_ID],
    limit: 7,
  });
  assert.equal(result.operation, "issue_access_credential_hash");
  assert.equal(result.status, "executed");
  assert.equal(result.affectedCount, 3);
  assert.equal(result.auditAction, "patient_photo_protocol.release_governance.issue_access_credential_hash");
  assert.equal(result.boundaries.metadataOnly, true);
  assert.equal(result.boundaries.patientRowsExposed, false);
  assert.equal(result.boundaries.rawIdentifiersExposed, false);
  assert.equal(result.boundaries.temporaryCredentialsExposed, false);
  assert.equal(result.boundaries.qrTokensExposed, false);
  assert.equal(result.boundaries.sessionIdsExposed, false);
  assert.equal(result.boundaries.patientDeliveryAllowed, false);
  assert.equal(result.boundaries.rawCredentialExposed, false);
  assert.equal(result.boundaries.credentialHashExposed, false);
  assert.equal(result.boundaries.credentialFingerprintExposed, false);
});
