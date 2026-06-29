import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildObjectKey,
  createAssetWriteService,
  normalizeCreateAssetPayload,
  normalizeDownloadUrlParams,
} from "./asset-write-service.mjs";

const CLINIC_ID = "10000000-0000-4000-8000-000000000001";
const PATIENT_ID = "10000000-0000-4000-8000-000000000201";
const VISIT_ID = "10000000-0000-4000-8000-000000000301";
const LESION_ID = "10000000-0000-4000-8000-000000000401";
const ASSET_ID = "10000000-0000-4000-8000-000000000901";
const USER_ID = "10000000-0000-4000-8000-000000000101";

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
    ...overrides.visitWorkspaceRepository,
  };
  const assetWriteRepository = {
    async createVisitAsset(params) {
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
    { correlationId: "c-1" },
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
    { correlationId: "c-assistant-capture" },
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
    { correlationId: "c-asset-bytes" },
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

test("createVisitAsset rejects lesion outside visit scope", async () => {
  const { service } = createService({
    visitWorkspaceRepository: { async listVisitLesions() { return []; } },
  });
  await assert.rejects(
    () =>
      service.createVisitAsset(
        VISIT_ID,
        { lesionId: LESION_ID, contentType: "image/png" },
        authContext,
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
