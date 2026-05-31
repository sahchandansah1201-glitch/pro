import assert from "node:assert/strict";
import { test } from "node:test";

import {
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
