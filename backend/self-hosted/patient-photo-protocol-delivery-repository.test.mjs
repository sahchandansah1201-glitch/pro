import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildGetPatientPhotoProtocolDeliveryAssetSql,
  createPatientPhotoProtocolDeliveryRepository,
  normalizePatientPhotoProtocolDeliveryAsset,
} from "./patient-photo-protocol-delivery-repository.mjs";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const VISIT_ID = "22222222-2222-4222-8222-222222222222";

test("Batch AM SQL scopes patient photo proxy through linked active session and internal asset storage", () => {
  const sql = buildGetPatientPhotoProtocolDeliveryAssetSql({
    userId: USER_ID,
    visitId: VISIT_ID,
    sequence: 1,
    sessionHash: "a".repeat(64),
  });

  assert.match(sql, /patient_user_links/);
  assert.match(sql, /patient_photo_protocol_releases/);
  assert.match(sql, /clinical_assets/);
  assert.match(sql, /object_bucket/);
  assert.match(sql, /object_key/);
  assert.match(sql, /patientFileProxyEnabled/);
  assert.match(sql, /retentionPolicyApproved/);
  assert.match(sql, /patient_photo_protocol_access_sessions/);
  assert.match(sql, /session_hash/);
  assert.match(sql, /session_kind = 'patient_photo_protocol_access'/);
  assert.match(sql, /status = 'active'/);
  assert.match(sql, /expires_at > now\(\)/);
  assert.match(sql, /sessionBoundaryMatched/);
  assert.match(sql, /row_number\(\)/);
  assert.doesNotMatch(sql, /signed_url|access_token|storage_object_path|physician_text|rawSessionId/i);
});

test("Batch AM delivery normalizer keeps session/storage fields backend-internal", () => {
  const result = normalizePatientPhotoProtocolDeliveryAsset({
    releaseId: "ppr-1",
    clinicId: "c-1",
    patientId: "p-1",
    visitId: VISIT_ID,
    releaseStatus: "prepared",
    expiresAt: "2026-06-20T10:00:00.000Z",
    imagingConsent: true,
    fileProxyEnabled: true,
    retentionPolicyApproved: true,
    sessionBoundaryMatched: true,
    sessionStatus: "active",
    sessionExpiresAt: "2026-06-01T10:30:00.000Z",
    sequence: 1,
    assetId: "asset-1",
    kind: "overview_photo",
    contentType: "image/jpeg",
    byteSize: 123,
    objectBucket: "clinical-assets",
    objectKey: "internal/key.jpg",
    signedUrl: "hidden",
    accessToken: "hidden",
  });

  assert.equal(result.release.status, "prepared");
  assert.equal(result.release.fileProxyEnabled, true);
  assert.equal(result.release.retentionPolicyApproved, true);
  assert.equal(result.release.accessSession.matched, true);
  assert.equal(result.release.accessSession.status, "active");
  assert.equal(result.release.accessSession.rawSessionIdExposed, false);
  assert.equal(result.release.accessSession.sessionHashExposed, false);
  assert.equal(result.release.accessSession.sessionFingerprintExposed, false);
  assert.equal(result.asset.sequence, 1);
  assert.equal(result.asset.objectBucket, "clinical-assets");
  assert.equal(result.asset.objectKey, "internal/key.jpg");
  assert.equal("signedUrl" in result.asset, false);
  assert.equal("accessToken" in result.asset, false);
});

test("Batch T repository reads one delivery candidate through db client", async () => {
  const calls = [];
  const repository = createPatientPhotoProtocolDeliveryRepository({
    async queryJson(sql) {
      calls.push(sql);
      return [{
        releaseId: "ppr-1",
        clinicId: "c-1",
        patientId: "p-1",
        visitId: VISIT_ID,
        releaseStatus: "prepared",
        expiresAt: "2026-06-20T10:00:00.000Z",
        imagingConsent: true,
        fileProxyEnabled: true,
        retentionPolicyApproved: true,
        sessionBoundaryMatched: true,
        sessionStatus: "active",
        sessionExpiresAt: "2026-06-01T10:30:00.000Z",
        sequence: 1,
        assetId: "asset-1",
        kind: "overview_photo",
        contentType: "image/jpeg",
        byteSize: 123,
        objectBucket: "clinical-assets",
        objectKey: "internal/key.jpg",
      }];
    },
  });

  const candidate = await repository.getDeliveryAsset({
    userId: USER_ID,
    visitId: VISIT_ID,
    sequence: 1,
    sessionHash: "b".repeat(64),
  });

  assert.equal(candidate.release.id, "ppr-1");
  assert.equal(candidate.asset.objectKey, "internal/key.jpg");
  assert.equal(calls.length, 1);
});
