import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildObjectKey,
  createAssetWriteService,
  normalizeCreateAssetPayload,
  normalizeDownloadUrlParams,
} from "./asset-write-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const OTHER_CLINIC_ID = "10000000-0000-4000-8000-000000000002";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const OTHER_PATIENT_ID = "10000000-0000-4000-8000-000000000202";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const ORIGIN_VISIT_ID = "10000000-0000-4000-8000-000000000302";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";
const USER_ID = "10000000-0000-4000-8000-000000000101";
const IDEMPOTENCY_KEY = "asset-upload-0000000000000001";

const authContext = {
  userId: USER_ID,
  roles: ["doctor"],
  clinicIds: [CLINIC_ID],
};
const assistantAuthContext = {
  userId: USER_ID,
  roles: ["assistant"],
  clinicIds: [CLINIC_ID],
};

test("normalizeCreateAssetPayload accepts frontend aliases and rejects unsafe fields", () => {
  const payload = normalizeCreateAssetPayload({
    kind: "overview",
    contentType: "image/png",
    byteSize: 1024,
    capturedAt: "2026-05-12T09:00:00Z",
    checksumSha256: "A".repeat(64),
    originalFileName: "spot.png",
  });
  assert.equal(payload.kind, "overview_photo");
  assert.equal(payload.checksumSha256, "a".repeat(64));
  assert.equal(payload.contentType, "image/png");

  assert.throws(
    () => normalizeCreateAssetPayload({ kind: "dermoscopy", contentType: "application/pdf" }),
    /Visit workspace payload failed validation/,
  );
});

test("normalizeDownloadUrlParams clamps expiresIn", () => {
  assert.equal(normalizeDownloadUrlParams(new URLSearchParams("expiresIn=10")), 60);
  assert.equal(normalizeDownloadUrlParams(new URLSearchParams("expiresIn=5000")), 900);
  assert.equal(normalizeDownloadUrlParams(new URLSearchParams("expiresIn=120")), 120);
});

test("createVisitAsset requires a safe Idempotency-Key before any write", async () => {
  const { service, audits, storedObjects } = createService();

  await assert.rejects(
    () => service.createVisitAsset(
      VISIT_ID,
      { contentType: "image/png" },
      authContext,
      { correlationId: "c-missing-idempotency" },
    ),
    (error) =>
      error?.publicStatus === 422
      && Array.isArray(error.publicDetails)
      && error.publicDetails.some((detail) => detail.field === "Idempotency-Key"),
  );

  assert.equal(storedObjects.length, 0);
  assert.equal(audits.length, 0);
});

test("createVisitAsset replays the same completed upload without another object write or audit", async () => {
  let completedAsset = null;
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return completedAsset
          ? { status: "replayed", asset: completedAsset }
          : { status: "claimed", objectBucket: "clinical-assets", objectKey: "reserved/asset.png" };
      },
      async completeVisitAssetUpload(params) {
        completedAsset = {
          id: ASSET_ID,
          clinicId: params.clinicId,
          patientId: params.patientId,
          visitId: params.visitId,
          lesionId: params.lesionId,
          kind: params.kind,
          contentType: params.contentType,
          byteSize: params.byteSize,
          capturedAt: params.capturedAt,
          uploadedBy: params.uploadedBy,
          createdAt: "2026-05-12T09:00:00.000Z",
        };
        return completedAsset;
      },
    },
  });
  const bytes = Buffer.from("one-idempotent-upload");
  const input = {
    kind: "dermoscopy",
    lesionId: LESION_ID,
    contentType: "image/png",
    byteSize: bytes.byteLength,
    dataBase64: bytes.toString("base64"),
    capturedAt: "2026-05-12T09:00:00.000Z",
    originalFileName: "lesion.png",
  };

  const created = await service.createVisitAsset(
    VISIT_ID,
    input,
    authContext,
    { correlationId: "c-create", idempotencyKey: IDEMPOTENCY_KEY },
  );
  const replay = await service.createVisitAsset(
    VISIT_ID,
    input,
    authContext,
    { correlationId: "c-replay", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(created.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.asset.id, created.asset.id);
  assert.equal(storedObjects.length, 1);
  assert.equal(audits.length, 1);
});

test("concurrent duplicate upload lets only the reservation owner write object metadata and audit", async () => {
  let beginCount = 0;
  let releaseObjectWrite;
  const objectWriteGate = new Promise((resolve) => { releaseObjectWrite = resolve; });
  const writes = [];
  const { service, audits } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        beginCount += 1;
        return beginCount === 1
          ? { status: "claimed", objectBucket: "clinical-assets", objectKey: "reserved/concurrent.png" }
          : { status: "in_progress" };
      },
      async completeVisitAssetUpload(params) {
        return {
          id: ASSET_ID,
          clinicId: params.clinicId,
          patientId: params.patientId,
          visitId: params.visitId,
          lesionId: params.lesionId,
          kind: params.kind,
          contentType: params.contentType,
          byteSize: params.byteSize,
          capturedAt: params.capturedAt,
          uploadedBy: params.uploadedBy,
          createdAt: "2026-05-12T09:00:00.000Z",
        };
      },
    },
    objectStore: {
      async putObject(object) {
        writes.push(object);
        await objectWriteGate;
        return { byteSize: object.bytes.byteLength };
      },
    },
  });
  const bytes = Buffer.from("one-concurrent-upload");
  const input = {
    contentType: "image/png",
    byteSize: bytes.byteLength,
    dataBase64: bytes.toString("base64"),
    capturedAt: "2026-05-12T09:00:00.000Z",
  };

  const owner = service.createVisitAsset(
    VISIT_ID,
    input,
    authContext,
    { correlationId: "c-owner", idempotencyKey: IDEMPOTENCY_KEY },
  );
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    () => service.createVisitAsset(
      VISIT_ID,
      input,
      authContext,
      { correlationId: "c-duplicate", idempotencyKey: IDEMPOTENCY_KEY },
    ),
    (error) => error?.publicStatus === 409 && error?.publicCode === "asset_upload_in_progress",
  );
  releaseObjectWrite();
  const result = await owner;

  assert.equal(result.replayed, false);
  assert.equal(writes.length, 1);
  assert.equal(audits.length, 1);
});

test("same Idempotency-Key with a different asset payload returns conflict before another object write", async () => {
  let requestHash = null;
  let completedAsset = null;
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload(params) {
        if (requestHash == null) {
          requestHash = params.requestHash;
          return { status: "claimed", objectBucket: "clinical-assets", objectKey: "reserved/conflict.png" };
        }
        if (requestHash !== params.requestHash) {
          const error = new Error("Idempotency conflict");
          error.publicCode = "idempotency_conflict";
          error.publicStatus = 409;
          throw error;
        }
        return { status: "replayed", asset: completedAsset };
      },
      async completeVisitAssetUpload(params) {
        completedAsset = {
          id: ASSET_ID,
          clinicId: params.clinicId,
          patientId: params.patientId,
          visitId: params.visitId,
          lesionId: params.lesionId,
          kind: params.kind,
          contentType: params.contentType,
          byteSize: params.byteSize,
          capturedAt: params.capturedAt,
          uploadedBy: params.uploadedBy,
          createdAt: "2026-05-12T09:00:00.000Z",
        };
        return completedAsset;
      },
    },
  });
  const firstBytes = Buffer.from("first-payload");
  const secondBytes = Buffer.from("different-payload");

  await service.createVisitAsset(
    VISIT_ID,
    {
      contentType: "image/png",
      byteSize: firstBytes.byteLength,
      dataBase64: firstBytes.toString("base64"),
      capturedAt: "2026-05-12T09:00:00.000Z",
    },
    authContext,
    { correlationId: "c-first", idempotencyKey: IDEMPOTENCY_KEY },
  );
  await assert.rejects(
    () => service.createVisitAsset(
      VISIT_ID,
      {
        contentType: "image/png",
        byteSize: secondBytes.byteLength,
        dataBase64: secondBytes.toString("base64"),
        capturedAt: "2026-05-12T09:00:00.000Z",
      },
      authContext,
      { correlationId: "c-conflict", idempotencyKey: IDEMPOTENCY_KEY },
    ),
    (error) => error?.publicStatus === 409 && error?.publicCode === "idempotency_conflict",
  );

  assert.equal(storedObjects.length, 1);
  assert.equal(audits.length, 1);
});

test("a stale exact retry reuses the reservation-owned object when its bytes already match", async () => {
  const bytes = Buffer.from("object-written-before-crash");
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return {
          status: "claimed",
          recovered: true,
          objectBucket: "clinical-assets",
          objectKey: "reserved/stale-object.png",
        };
      },
    },
    objectStore: {
      async getObject() {
        return {
          bytes,
          byteSize: bytes.byteLength,
          contentType: "image/png",
        };
      },
    },
  });

  const result = await service.createVisitAsset(
    VISIT_ID,
    {
      contentType: "image/png",
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString("base64"),
      capturedAt: "2026-05-12T09:00:00.000Z",
    },
    authContext,
    { correlationId: "c-stale-recovery", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(result.replayed, false);
  assert.equal(storedObjects.length, 0);
  assert.equal(audits.length, 1);
  assert.equal(audits[0].metadata.recoveredStaleUpload, true);
  assert.equal(audits[0].metadata.objectReconciliation, "reused");
});

test("a stale exact retry restores a missing reservation-owned object in the same key", async () => {
  const bytes = Buffer.from("object-missing-after-reservation");
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return {
          status: "claimed",
          recovered: true,
          objectBucket: "clinical-assets",
          objectKey: "reserved/stale-missing.png",
        };
      },
    },
    objectStore: {
      async getObject() {
        const error = new Error("missing object");
        error.code = "ENOENT";
        throw error;
      },
    },
  });

  await service.createVisitAsset(
    VISIT_ID,
    {
      contentType: "image/png",
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString("base64"),
      capturedAt: "2026-05-12T09:00:00.000Z",
    },
    authContext,
    { correlationId: "c-stale-missing", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(storedObjects.length, 1);
  assert.equal(storedObjects[0].key, "reserved/stale-missing.png");
  assert.equal(audits[0].metadata.objectReconciliation, "restored");
});

test("a stale exact retry rewrites corrupted bytes only inside the reservation-owned key", async () => {
  const bytes = Buffer.from("expected-recovery-bytes");
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return {
          status: "claimed",
          recovered: true,
          objectBucket: "clinical-assets",
          objectKey: "reserved/stale-corrupted.png",
        };
      },
    },
    objectStore: {
      async getObject() {
        const corrupted = Buffer.from("partial-bytes");
        return { bytes: corrupted, byteSize: corrupted.byteLength, contentType: "image/png" };
      },
    },
  });

  await service.createVisitAsset(
    VISIT_ID,
    {
      contentType: "image/png",
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString("base64"),
      capturedAt: "2026-05-12T09:00:00.000Z",
    },
    authContext,
    { correlationId: "c-stale-corrupted", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(storedObjects.length, 1);
  assert.equal(storedObjects[0].key, "reserved/stale-corrupted.png");
  assert.equal(String(storedObjects[0].bytes), "expected-recovery-bytes");
  assert.equal(audits[0].metadata.objectReconciliation, "rewritten");
});

test("a stale exact retry rewrites matching bytes when object metadata is incomplete", async () => {
  const bytes = Buffer.from("matching-bytes-with-missing-metadata");
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return {
          status: "claimed",
          recovered: true,
          objectBucket: "clinical-assets",
          objectKey: "reserved/stale-metadata.png",
        };
      },
    },
    objectStore: {
      async getObject() {
        return {
          bytes,
          byteSize: bytes.byteLength,
          contentType: "application/octet-stream",
        };
      },
    },
  });

  await service.createVisitAsset(
    VISIT_ID,
    {
      contentType: "image/png",
      byteSize: bytes.byteLength,
      dataBase64: bytes.toString("base64"),
      capturedAt: "2026-05-12T09:00:00.000Z",
    },
    authContext,
    { correlationId: "c-stale-metadata", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(storedObjects.length, 1);
  assert.equal(storedObjects[0].key, "reserved/stale-metadata.png");
  assert.equal(storedObjects[0].contentType, "image/png");
  assert.equal(audits[0].metadata.objectReconciliation, "rewritten");
});

test("a stale retry fails closed on object-store read errors without metadata or audit writes", async () => {
  const bytes = Buffer.from("safe-retry-bytes");
  const storageError = Object.assign(new Error("object store permission denied"), { code: "EACCES" });
  const { service, audits, storedObjects } = createService({
    assetWriteRepository: {
      async beginVisitAssetUpload() {
        return {
          status: "claimed",
          recovered: true,
          objectBucket: "clinical-assets",
          objectKey: "reserved/unreadable.png",
        };
      },
    },
    objectStore: {
      async getObject() { throw storageError; },
    },
  });

  await assert.rejects(
    () => service.createVisitAsset(
      VISIT_ID,
      {
        contentType: "image/png",
        byteSize: bytes.byteLength,
        dataBase64: bytes.toString("base64"),
        capturedAt: "2026-05-12T09:00:00.000Z",
      },
      authContext,
      { correlationId: "c-stale-storage-error", idempotencyKey: IDEMPOTENCY_KEY },
    ),
    storageError,
  );
  assert.equal(storedObjects.length, 0);
  assert.equal(audits.length, 0);
});

test("buildObjectKey creates deterministic backend-owned path", () => {
  const key = buildObjectKey({
    clinicId: CLINIC_ID,
    patientId: PATIENT_ID,
    visitId: VISIT_ID,
    contentType: "image/jpeg",
    originalFileName: "photo.jpeg",
    now: () => "2026-05-12T09:10:11.000Z",
    uuid: () => "20000000-0000-4000-8000-000000000999",
  });
  assert.equal(
    key,
    `clinics/${CLINIC_ID}/patients/${PATIENT_ID}/visits/${VISIT_ID}/20260512091011-20000000-0000-4000-8000-000000000999.jpeg`,
  );
});

function createService(overrides = {}) {
  const audits = [];
  const storedObjects = [];
  const visitWorkspaceRepository = {
    async getVisit() {
      return {
        id: VISIT_ID,
        patient: { id: PATIENT_ID },
        clinic: { id: CLINIC_ID },
      };
    },
    async listVisitLesions() {
      return [{ id: LESION_ID }];
    },
    async getLesionContext() {
      return {
        id: ORIGIN_VISIT_ID,
        patient: { id: PATIENT_ID },
        clinic: { id: CLINIC_ID },
        lesionId: LESION_ID,
      };
    },
    ...overrides.visitWorkspaceRepository,
  };
  const assetWriteRepository = {
    async beginVisitAssetUpload(params) {
      return {
        status: "claimed",
        objectBucket: params.objectBucket,
        objectKey: params.objectKey,
      };
    },
    async completeVisitAssetUpload(params) {
      return {
        id: ASSET_ID,
        clinicId: params.clinicId,
        patientId: params.patientId,
        visitId: params.visitId,
        lesionId: params.lesionId,
        kind: params.kind,
        contentType: params.contentType,
        byteSize: params.byteSize,
        capturedAt: params.capturedAt,
        uploadedBy: params.uploadedBy,
        createdAt: "2026-05-12T09:00:00.000Z",
      };
    },
    async createVisitAsset(params) {
      return this.completeVisitAssetUpload(params);
    },
    async getAssetInternal() {
      return {
        id: ASSET_ID,
        clinicId: CLINIC_ID,
        patientId: PATIENT_ID,
        visitId: VISIT_ID,
        lesionId: null,
        kind: "overview_photo",
        contentType: "image/png",
        byteSize: 1024,
        capturedAt: null,
        uploadedBy: USER_ID,
        createdAt: "2026-05-12T09:00:00.000Z",
        objectBucket: "clinical-assets",
        objectKey: "internal/path.png",
        checksumSha256: null,
      };
    },
    ...overrides.assetWriteRepository,
  };
  const auditRepository = {
    async recordEvent(event) {
      audits.push(event);
    },
  };
  const objectStore = {
    async putObject(object) {
      storedObjects.push(object);
      return { byteSize: object.bytes.byteLength };
    },
    async getObject() {
      return {
        bytes: Buffer.from("download-bytes", "utf8"),
        byteSize: Buffer.byteLength("download-bytes"),
        contentType: "image/png",
      };
    },
    ...overrides.objectStore,
  };
  return {
    audits,
    storedObjects,
    service: createAssetWriteService({
      config: { objectStorageBucket: "clinical-assets" },
      visitWorkspaceRepository,
      assetWriteRepository,
      auditRepository,
      objectStore,
      now: () => "2026-05-12T09:10:11.000Z",
      uuid: () => "20000000-0000-4000-8000-000000000999",
    }),
  };
}

test("createVisitAsset registers metadata, returns safe DTO and audits", async () => {
  const { service, audits } = createService();
  const result = await service.createVisitAsset(
    VISIT_ID,
    {
      kind: "dermoscopy",
      lesionId: LESION_ID,
      contentType: "image/jpeg",
      byteSize: 2048,
      originalFileName: "derm.jpg",
    },
    authContext,
    { correlationId: "c-1", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(result.asset.id, ASSET_ID);
  assert.equal(result.asset.kind, "dermoscopy");
  assert.equal(result.asset.uploadedBy, USER_ID);
  assert.equal(result.asset.objectKey, undefined);
  assert.equal(audits[0].action, "asset.create");
  assert.equal(audits[0].metadata.kind, "dermoscopy");
});

test("createVisitAsset allows assistant capture without exposing object storage details", async () => {
  const data = Buffer.from("assistant-image");
  const { service, audits, storedObjects } = createService();

  const result = await service.createVisitAsset(
    VISIT_ID,
    {
      kind: "overview_photo",
      contentType: "image/png",
      byteSize: data.byteLength,
      dataBase64: data.toString("base64"),
      originalFileName: "assistant.png",
    },
    assistantAuthContext,
    { correlationId: "c-assistant-capture", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(result.asset.uploadedBy, USER_ID);
  assert.equal(result.asset.objectKey, undefined);
  assert.equal(storedObjects.length, 1);
  assert.equal(audits[0].action, "asset.create");
  assert.equal(audits[0].metadata.binaryStored, true);
});

test("createVisitAsset stores decoded bytes and verifies checksum", async () => {
  const data = Buffer.from("binary-image");
  const checksumSha256 = "3a265d560b5dba77707bcbcdf07e250c3a05e6f4d3f2e7714e5819b0619846a8";
  const { service, audits, storedObjects } = createService();

  const result = await service.createVisitAsset(
    VISIT_ID,
    {
      kind: "overview_photo",
      contentType: "image/png",
      byteSize: data.byteLength,
      checksumSha256,
      dataBase64: data.toString("base64"),
      originalFileName: "spot.png",
    },
    authContext,
    { correlationId: "c-asset-bytes", idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(result.asset.byteSize, data.byteLength);
  assert.equal(storedObjects.length, 1);
  assert.equal(String(storedObjects[0].bytes), "binary-image");
  assert.equal(storedObjects[0].contentType, "image/png");
  assert.equal(storedObjects[0].checksumSha256, checksumSha256);
  assert.equal(audits[0].metadata.binaryStored, true);

  assert.throws(
    () =>
      normalizeCreateAssetPayload({
        contentType: "image/png",
        byteSize: data.byteLength + 1,
        dataBase64: data.toString("base64"),
      }),
    (error) =>
      Array.isArray(error.publicDetails) &&
      error.publicDetails.some((detail) => String(detail.message).includes("byteSize must match")),
  );
});

test("createVisitAsset accepts a persistent lesion first recorded in another visit of the same patient and clinic", async () => {
  const { service } = createService({
    visitWorkspaceRepository: {
      async listVisitLesions() { return []; },
      async getLesionContext() {
        return {
          id: ORIGIN_VISIT_ID,
          patient: { id: PATIENT_ID },
          clinic: { id: CLINIC_ID },
          lesionId: LESION_ID,
        };
      },
    },
  });

  const result = await service.createVisitAsset(
    VISIT_ID,
    { lesionId: LESION_ID, contentType: "image/png" },
    authContext,
    { idempotencyKey: IDEMPOTENCY_KEY },
  );

  assert.equal(result.asset.lesionId, LESION_ID);
  assert.equal(result.asset.visitId, VISIT_ID);
});

test("createVisitAsset rejects a lesion outside the patient scope", async () => {
  const { service } = createService({
    visitWorkspaceRepository: {
      async getLesionContext() {
        return {
          id: ORIGIN_VISIT_ID,
          patient: { id: OTHER_PATIENT_ID },
          clinic: { id: CLINIC_ID },
          lesionId: LESION_ID,
        };
      },
    },
  });
  await assert.rejects(
    () =>
      service.createVisitAsset(
        VISIT_ID,
        { lesionId: LESION_ID, contentType: "image/png" },
        authContext,
        { idempotencyKey: IDEMPOTENCY_KEY },
      ),
    /Lesion was not found/,
  );
});

test("createVisitAsset rejects a lesion outside the clinic scope", async () => {
  const { service } = createService({
    visitWorkspaceRepository: {
      async getLesionContext() {
        return {
          id: ORIGIN_VISIT_ID,
          patient: { id: PATIENT_ID },
          clinic: { id: OTHER_CLINIC_ID },
          lesionId: LESION_ID,
        };
      },
    },
  });

  await assert.rejects(
    () =>
      service.createVisitAsset(
        VISIT_ID,
        { lesionId: LESION_ID, contentType: "image/png" },
        authContext,
        { idempotencyKey: IDEMPOTENCY_KEY },
      ),
    /Lesion was not found/,
  );
});

test("getAssetDownloadUrl returns safe backend route and audits without object path leakage", async () => {
  const { service, audits } = createService();
  const result = await service.getAssetDownloadUrl(
    ASSET_ID,
    authContext,
    { correlationId: "c-2", expiresIn: 120 },
  );

  assert.equal(result.download.downloadUrl, `/api/v1/assets/${ASSET_ID}/download`);
  assert.equal(result.download.expiresIn, 120);
  assert.equal(result.download.objectKey, undefined);
  assert.equal(result.asset.objectKey, undefined);
  assert.equal(audits[0].action, "asset.download_url");
  assert.equal(audits[0].metadata.objectStorageBacked, true);
});

test("downloadAsset streams bytes through authenticated backend without object path leakage", async () => {
  const { service, audits } = createService();
  const result = await service.downloadAsset(ASSET_ID, authContext, { correlationId: "c-download" });

  assert.equal(String(result.object.bytes), "download-bytes");
  assert.equal(result.object.contentType, "image/png");
  assert.equal(result.asset.objectKey, undefined);
  assert.equal(audits[0].action, "asset.download");
  assert.equal(audits[0].metadata.byteSize, Buffer.byteLength("download-bytes"));
});
