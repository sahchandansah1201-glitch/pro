import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCreateVisitAssetSql,
  buildGetAssetInternalSql,
  createAssetWriteRepository,
} from "./asset-write-repository.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";
const USER_ID = "10000000-0000-4000-8000-000000000101";

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
