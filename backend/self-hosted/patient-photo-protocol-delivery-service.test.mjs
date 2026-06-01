import assert from "node:assert/strict";
import { test } from "node:test";

import { createPatientPhotoProtocolDeliveryService } from "./patient-photo-protocol-delivery-service.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VISIT_ID = "22222222-2222-4222-8222-222222222222";

function createCandidate(overrides = {}) {
  return {
    release: {
      id: "ppr-1",
      clinicId: "clinic-1",
      patientId: "patient-1",
      visitId: VISIT_ID,
      status: "prepared",
      expiresAt: "2026-06-20T10:00:00.000Z",
      imagingConsent: true,
      fileProxyEnabled: true,
      retentionPolicyApproved: true,
      accessSession: {
        matched: true,
        status: "active",
        expiresAt: "2026-06-01T10:30:00.000Z",
        rawSessionIdExposed: false,
        sessionHashExposed: false,
        sessionFingerprintExposed: false,
      },
      ...overrides.release,
    },
    asset: {
      id: "asset-1",
      sequence: 1,
      kind: "overview_photo",
      contentType: "image/jpeg",
      byteSize: 12,
      objectBucket: "clinical-assets",
      objectKey: "internal/key.jpg",
      ...overrides.asset,
    },
  };
}

function createService(overrides = {}) {
  const auditEvents = [];
  const objectReads = [];
  const repositoryCalls = [];
  const service = createPatientPhotoProtocolDeliveryService({
    patientPhotoProtocolDeliveryRepository: {
      async getDeliveryAsset(input) {
        repositoryCalls.push(input);
        return overrides.candidate === undefined ? createCandidate() : overrides.candidate;
      },
    },
    objectStore: {
      async getObject(input) {
        objectReads.push(input);
        if (overrides.objectError) throw overrides.objectError;
        return overrides.object || {
          bytes: Buffer.from("photo-bytes"),
          byteSize: Buffer.byteLength("photo-bytes"),
          contentType: "image/jpeg",
        };
      },
    },
    auditRepository: {
      async recordEvent(event) {
        auditEvents.push(event);
      },
    },
    now: () => new Date("2026-06-01T10:00:00.000Z"),
    sessionPepper: overrides.sessionPepper ?? "stage5n-session-pepper",
  });
  return { service, auditEvents, objectReads, repositoryCalls };
}

test("Batch AM service streams through backend proxy only after active session-cookie boundary", async () => {
  const { service, auditEvents, objectReads, repositoryCalls } = createService();

  const result = await service.downloadPhoto(
    { visitId: VISIT_ID, sequence: 1 },
    { userId: USER_ID, roles: ["patient"] },
    { correlationId: "corr-1", sessionCookieValue: "a".repeat(64) },
  );

  assert.equal(String(result.object.bytes), "photo-bytes");
  assert.equal(result.object.contentType, "image/jpeg");
  assert.equal(result.download.fileName, "photo-protocol-1.jpg");
  assert.equal(result.asset.id, "asset-1");
  assert.deepEqual(objectReads, [{ bucket: "clinical-assets", key: "internal/key.jpg" }]);
  assert.equal(repositoryCalls[0].sessionHash.length, 64);
  assert.equal(repositoryCalls[0].sessionFingerprint.length, 16);
  assert.equal("sessionCookieValue" in repositoryCalls[0], false);
  assert.deepEqual(auditEvents.map((event) => event.action), [
    "patient_portal.photo_protocol.proxy.download",
  ]);
  assert.equal(auditEvents[0].metadata.signedUrlsIssued, false);
  assert.equal(auditEvents[0].metadata.storagePathsExposed, false);
  assert.equal(auditEvents[0].metadata.rawSessionIdExposed, false);
  assert.equal(auditEvents[0].metadata.sessionHashExposed, false);
  assert.equal(auditEvents[0].metadata.sessionFingerprintExposed, false);
});

test("Batch AM service denies missing session cookie before storage reads", async () => {
  const { service, objectReads, auditEvents, repositoryCalls } = createService();

  await assert.rejects(
    () => service.downloadPhoto({ visitId: VISIT_ID, sequence: 1 }, { userId: USER_ID, roles: ["patient"] }),
    (error) => error.publicCode === "photo_protocol_session_required" && error.publicStatus === 401,
  );
  assert.equal(repositoryCalls.length, 0);
  assert.equal(objectReads.length, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].metadata.reason, "session_required");
  assert.equal(auditEvents[0].metadata.rawSessionIdExposed, false);
  assert.equal(auditEvents[0].metadata.sessionHashExposed, false);
  assert.equal(auditEvents[0].metadata.sessionFingerprintExposed, false);
});

test("Batch AM service denies invalid or unmatched session cookie before storage reads", async () => {
  const missingPepper = createService({ sessionPepper: "" });
  await assert.rejects(
    () => missingPepper.service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 1 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "a".repeat(64) },
    ),
    (error) => error.publicCode === "photo_protocol_session_not_configured" && error.publicStatus === 503,
  );
  assert.equal(missingPepper.objectReads.length, 0);

  const invalidShape = createService();
  await assert.rejects(
    () => invalidShape.service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 1 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "not-a-session" },
    ),
    (error) => error.publicCode === "photo_protocol_session_invalid" && error.publicStatus === 401,
  );
  assert.equal(invalidShape.objectReads.length, 0);

  const unmatched = createService({
    candidate: createCandidate({ release: { accessSession: { matched: false } } }),
  });
  await assert.rejects(
    () => unmatched.service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 1 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "b".repeat(64) },
    ),
    (error) => error.publicCode === "photo_protocol_session_invalid" && error.publicStatus === 401,
  );
  assert.equal(unmatched.objectReads.length, 0);
  assert.equal(unmatched.auditEvents[0].metadata.reason, "session_invalid");
});

test("Batch AG service denies missing retention policy before storage reads", async () => {
  const { service, objectReads, auditEvents } = createService({
    candidate: createCandidate({ release: { retentionPolicyApproved: false } }),
  });

  await assert.rejects(
    () => service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 1 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "a".repeat(64) },
    ),
    (error) => error.publicCode === "photo_protocol_retention_required" && error.publicStatus === 423,
  );
  assert.equal(objectReads.length, 0);
  assert.equal(auditEvents.length, 1);
  assert.equal(auditEvents[0].metadata.reason, "retention_policy_required");
  assert.equal(auditEvents[0].metadata.signedUrlsIssued, false);
  assert.equal(auditEvents[0].metadata.storagePathsExposed, false);
});

test("Batch T service denies disabled, revoked, missing expiry, and expired proxy access", async () => {
  const authContext = { userId: USER_ID, roles: ["patient"] };
  const options = { sessionCookieValue: "a".repeat(64) };

  await assert.rejects(
    () => createService({ candidate: createCandidate({ release: { fileProxyEnabled: false } }) })
      .service.downloadPhoto({ visitId: VISIT_ID, sequence: 1 }, authContext, options),
    (error) => error.publicCode === "photo_protocol_proxy_disabled" && error.publicStatus === 423,
  );
  await assert.rejects(
    () => createService({ candidate: createCandidate({ release: { status: "revoked" } }) })
      .service.downloadPhoto({ visitId: VISIT_ID, sequence: 1 }, authContext, options),
    (error) => error.publicCode === "photo_protocol_revoked" && error.publicStatus === 410,
  );
  await assert.rejects(
    () => createService({ candidate: createCandidate({ release: { expiresAt: null } }) })
      .service.downloadPhoto({ visitId: VISIT_ID, sequence: 1 }, authContext, options),
    (error) => error.publicCode === "photo_protocol_retention_required" && error.publicStatus === 423,
  );
  await assert.rejects(
    () => createService({ candidate: createCandidate({ release: { expiresAt: "2026-05-01T10:00:00.000Z" } }) })
      .service.downloadPhoto({ visitId: VISIT_ID, sequence: 1 }, authContext, options),
    (error) => error.publicCode === "photo_protocol_expired" && error.publicStatus === 410,
  );
});

test("Batch T service denies non-patient and invalid identifiers before storage reads", async () => {
  const { service, objectReads } = createService();

  await assert.rejects(
    () => service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 1 },
      { userId: USER_ID, roles: ["doctor"] },
      { sessionCookieValue: "a".repeat(64) },
    ),
    /access/,
  );
  await assert.rejects(
    () => service.downloadPhoto(
      { visitId: "bad-id", sequence: 1 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "a".repeat(64) },
    ),
    (error) => error.publicCode === "invalid_uuid" && error.publicStatus === 400,
  );
  await assert.rejects(
    () => service.downloadPhoto(
      { visitId: VISIT_ID, sequence: 0 },
      { userId: USER_ID, roles: ["patient"] },
      { sessionCookieValue: "a".repeat(64) },
    ),
    (error) => error.publicCode === "invalid_sequence" && error.publicStatus === 400,
  );
  assert.equal(objectReads.length, 0);
});
