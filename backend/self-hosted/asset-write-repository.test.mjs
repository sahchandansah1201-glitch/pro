import assert from "node:assert/strict";
import { test } from "node:test";

import {
  AssetIdempotencyConflictError,
  buildBeginVisitAssetUploadSql,
  buildCompleteVisitAssetUploadSql,
  buildCreateVisitAssetSql,
  buildGetAssetInternalSql,
  createAssetWriteRepository,
} from "./asset-write-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const IDEMPOTENCY_KEY = "asset-upload-0000000000000001";
const REQUEST_HASH = "a".repeat(64);
const RESERVATION_TOKEN = "20000000-0000-4000-8000-000000000999";

test("buildBeginVisitAssetUploadSql atomically claims one clinic-scoped idempotency key", () => {
  const sql = buildBeginVisitAssetUploadSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
    reservationToken: RESERVATION_TOKEN,
    objectBucket: "clinical-assets",
    objectKey: "reserved/asset.png",
  });

  assert.match(sql, /insert into clinical_asset_upload_requests/);
  assert.match(sql, /on conflict \(clinic_id, idempotency_key\) do nothing/);
  assert.match(sql, /true as claimed/);
  assert.match(sql, /false as claimed/);
  assert.match(sql, /left join clinical_assets a on a\.id = selected\.asset_id/);
  assert.match(sql, new RegExp(`'${CLINIC_ID}'::uuid`));
  assert.match(sql, new RegExp(`'${IDEMPOTENCY_KEY}'`));
});

test("buildBeginVisitAssetUploadSql atomically reclaims only an expired exact pending request", () => {
  const sql = buildBeginVisitAssetUploadSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
    reservationToken: RESERVATION_TOKEN,
    objectBucket: "clinical-assets",
    objectKey: "new-key-must-not-replace-reserved-key.png",
  });

  assert.match(sql, /reclaimed as \(/);
  assert.match(sql, /update clinical_asset_upload_requests existing/);
  assert.match(sql, /existing\.state = 'pending'/);
  assert.match(sql, /existing\.patient_id = '10000000-0000-4000-8000-000000000201'::uuid/);
  assert.match(sql, /existing\.visit_id = '10000000-0000-4000-8000-000000000301'::uuid/);
  assert.match(sql, /existing\.request_hash = 'a{64}'/);
  assert.match(sql, /existing\.lease_expires_at <= now\(\)/);
  assert.match(sql, /reservation_token = '20000000-0000-4000-8000-000000000999'::uuid/);
  assert.match(sql, /lease_expires_at = now\(\) \+ interval '15 minutes'/);
  assert.match(sql, /recovery_count = existing\.recovery_count \+ 1/);
  assert.match(sql, /true as recovered/);
});

test("buildCompleteVisitAssetUploadSql atomically creates metadata and completes its reservation", () => {
  const sql = buildCompleteVisitAssetUploadSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
    reservationToken: RESERVATION_TOKEN,
    lesionId: null,
    kind: "overview_photo",
    contentType: "image/png",
    byteSize: 10,
    checksumSha256: "b".repeat(64),
    capturedAt: "2026-05-12T09:00:00.000Z",
    uploadedBy: USER_ID,
  });

  assert.match(sql, /^with reserved as \(/);
  assert.match(sql, /insert into clinical_assets/);
  assert.match(sql, /update clinical_asset_upload_requests/);
  assert.match(sql, /set state = 'completed'/);
  assert.match(sql, /returning r\.asset_id/);
});

test("createAssetWriteRepository distinguishes claimed, in-progress, replay, and conflicting requests", async () => {
  const rows = [
    [{ claimed: true, state: "pending", requestHash: REQUEST_HASH, objectBucket: "clinical-assets", objectKey: "reserved/asset.png" }],
    [{ claimed: false, state: "pending", requestHash: REQUEST_HASH, objectBucket: "clinical-assets", objectKey: "reserved/asset.png" }],
    [{
      claimed: false,
      state: "completed",
      requestHash: REQUEST_HASH,
      id: ASSET_ID,
      clinicId: CLINIC_ID,
      patientId: PATIENT_ID,
      visitId: VISIT_ID,
      lesionId: null,
      kind: "overview_photo",
      contentType: "image/png",
      byteSize: 10,
      capturedAt: "2026-05-12T09:00:00.000Z",
      uploadedBy: USER_ID,
      createdAt: "2026-05-12T09:00:01.000Z",
    }],
    [{ claimed: false, state: "completed", requestHash: "b".repeat(64) }],
  ];
  const repo = createAssetWriteRepository({ async queryJson() { return rows.shift(); } });
  const params = {
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
    reservationToken: RESERVATION_TOKEN,
    objectBucket: "clinical-assets",
    objectKey: "reserved/asset.png",
  };

  assert.equal((await repo.beginVisitAssetUpload(params)).status, "claimed");
  assert.equal((await repo.beginVisitAssetUpload(params)).status, "in_progress");
  const replay = await repo.beginVisitAssetUpload(params);
  assert.equal(replay.status, "replayed");
  assert.equal(replay.asset.id, ASSET_ID);
  await assert.rejects(
    () => repo.beginVisitAssetUpload(params),
    AssetIdempotencyConflictError,
  );
});

test("createAssetWriteRepository reports a stale pending reservation as recovered", async () => {
  const repo = createAssetWriteRepository({
    async queryJson() {
      return [{
        claimed: true,
        recovered: true,
        state: "pending",
        requestHash: REQUEST_HASH,
        objectBucket: "clinical-assets",
        objectKey: "reserved/orphan.png",
      }];
    },
  });

  const result = await repo.beginVisitAssetUpload({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    idempotencyKey: IDEMPOTENCY_KEY,
    requestHash: REQUEST_HASH,
    reservationToken: RESERVATION_TOKEN,
    objectBucket: "clinical-assets",
    objectKey: "new-key-must-not-be-used.png",
  });

  assert.equal(result.status, "claimed");
  assert.equal(result.recovered, true);
  assert.equal(result.objectKey, "reserved/orphan.png");
});

test("buildCreateVisitAssetSql inserts object storage fields but returns only safe projection", () => {
  const sql = buildCreateVisitAssetSql({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    kind: "dermoscopy",
    objectBucket: "clinical-assets",
    objectKey: "clinics/clinic/patients/patient/visits/visit/file.jpg",
    contentType: "image/jpeg",
    byteSize: 2048,
    checksumSha256: "a".repeat(64),
    capturedAt: "2026-05-12T09:00:00.000Z",
    uploadedBy: USER_ID,
  });
  assert.match(sql, /^with inserted as \(/);
  assert.doesNotMatch(sql, /from \(\s+with inserted as/i);
  assert.match(sql, /insert into clinical_assets/);
  assert.match(sql, /object_bucket/);
  assert.match(sql, /object_key/);
  assert.match(sql, /checksum_sha256/);
  assert.match(sql, /select[\s\S]+a\.id::text as "id"/);
});

test("buildGetAssetInternalSql scopes by clinic and keeps internals backend-only", () => {
  const sql = buildGetAssetInternalSql({ assetId: ASSET_ID, clinicIds: [CLINIC_ID] });
  assert.match(sql, /from clinical_assets a/);
  assert.match(sql, new RegExp(`a\\.id = '${ASSET_ID}'::uuid`));
  assert.match(sql, new RegExp(`a\\.clinic_id in \\('${CLINIC_ID}'::uuid\\)`));
  assert.match(sql, /a\.object_bucket as "objectBucket"/);
  assert.match(sql, /a\.object_key as "objectKey"/);
});

test("createAssetWriteRepository normalizes safe and internal rows", async () => {
  const calls = [];
  const repo = createAssetWriteRepository({
    async queryJson(sql) {
      calls.push(sql);
      if (sql.includes("insert into clinical_assets")) {
        return [{
          id: ASSET_ID,
          clinicId: CLINIC_ID,
          patientId: PATIENT_ID,
          visitId: VISIT_ID,
          lesionId: null,
          kind: "overview_photo",
          contentType: "image/png",
          byteSize: "4096",
          capturedAt: "2026-05-12T09:00:00.000Z",
          uploadedBy: USER_ID,
          createdAt: "2026-05-12T09:00:01.000Z",
        }];
      }
      return [{
        id: ASSET_ID,
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        lesionId: null,
        kind: "overview_photo",
        contentType: "image/png",
        byteSize: 4096,
        capturedAt: "2026-05-12T09:00:00.000Z",
        uploadedBy: USER_ID,
        createdAt: "2026-05-12T09:00:01.000Z",
        objectBucket: "clinical-assets",
        objectKey: "internal/path.png",
        checksumSha256: null,
      }];
    },
  });

  const asset = await repo.createVisitAsset({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    kind: "overview_photo",
    objectBucket: "clinical-assets",
    objectKey: "internal/path.png",
    contentType: "image/png",
  });
  assert.equal(asset.byteSize, 4096);
  assert.equal(asset.objectKey, undefined);

  const internal = await repo.getAssetInternal({ assetId: ASSET_ID, clinicIds: [CLINIC_ID] });
  assert.equal(internal.objectKey, "internal/path.png");
  assert.equal(internal.kind, "overview_photo");
  assert.equal(calls.length, 2);
});
