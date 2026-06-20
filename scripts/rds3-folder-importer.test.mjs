import assert from "node:assert/strict";
import { mkdtempSync, rmSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildAssetPayload,
  buildCaptureMetadataPayload,
  contentTypeForPath,
  expandWindowsEnvPath,
  importImageFile,
  parseArgs,
  readLedger,
  scanOnce,
  sha256Hex,
} from "./rds3-folder-importer.mjs";

const UUID_VISIT = "10000000-0000-4000-8000-000000000101";
const UUID_LESION = "10000000-0000-4000-8000-000000000801";

async function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "rds3-importer-"));
  try {
    return await run(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

function baseConfig(dir) {
  return {
    watchDir: dir,
    apiBaseUrl: "http://localhost:3001",
    apiToken: "test-token",
    visitId: UUID_VISIT,
    lesionId: UUID_LESION,
    ledgerPath: join(dir, "ledger.json"),
    stableMs: 1,
    pollMs: 1,
    mode: "scan",
    moveImportedDir: "",
  };
}

function installFetchMock(assertCalls) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (String(url).endsWith(`/api/v1/visits/${UUID_VISIT}/assets`)) {
      assert.equal(body.kind, "dermoscopy");
      assert.equal(body.lesionId, UUID_LESION);
      assert.equal(body.originalFileName, "rds3 sample.jpg");
      assert.equal(body.contentType, "image/jpeg");
      assert.equal(body.byteSize, 5);
      assert.equal(typeof body.dataBase64, "string");
      assert.doesNotMatch(JSON.stringify(body), /storagePath|signedUrl|session|credential|patientSafeText|doctorVersionText/i);
      return Response.json({ item: { id: "asset-1" }, correlationId: "corr-1" }, { status: 201 });
    }
    if (String(url).endsWith(`/api/v1/visits/${UUID_VISIT}/assets/asset-1/capture-metadata`)) {
      assert.equal(init.method, "PATCH");
      assert.equal(body.captureSource, "device_bridge");
      assert.equal(body.deviceCaptureProfile, "standard_dermoscopy");
      assert.equal(body.captureProtocolVersion, "imported_standard");
      assert.equal(body.lensProfile, "dermoscope_contact");
      assert.equal(body.scaleMarkerDetected, false);
      assert.equal(body.millimetersAvailable, false);
      assert.doesNotMatch(JSON.stringify(body), /storagePath|signedUrl|token|qr|session|credential|diagnosis|risk|prognosis|treatment|measurement/i);
      return Response.json({ item: { id: "metadata-1" } }, { status: 200 });
    }
    return Response.json({ error: { message: "unexpected request" } }, { status: 404 });
  };
  return () => assertCalls(calls);
}

test("RDS-3 importer expands Windows default path and parses CLI args", () => {
  assert.equal(
    expandWindowsEnvPath("%USERPROFILE%\\Documents\\Dermatoscopy", { USERPROFILE: "C:\\Users\\Doctor" }),
    "C:\\Users\\Doctor\\Documents\\Dermatoscopy",
  );
  const parsed = parseArgs([
    "--watch-dir",
    "%USERPROFILE%\\Documents\\Dermatoscopy",
    "--api-base-url",
    "http://localhost:3001",
    "--api-token",
    "tok",
    "--visit-id",
    UUID_VISIT,
    "--mode",
    "watch",
  ], { USERPROFILE: "C:\\Users\\Doctor" });
  assert.equal(parsed.mode, "watch");
  assert.match(parsed.watchDir, /Dermatoscopy$/);
});

test("RDS-3 importer maps supported image extensions to safe content types", () => {
  assert.equal(contentTypeForPath("a.JPG"), "image/jpeg");
  assert.equal(contentTypeForPath("a.png"), "image/png");
  assert.equal(contentTypeForPath("a.webp"), "image/webp");
  assert.equal(contentTypeForPath("a.heic"), "image/heic");
  assert.equal(contentTypeForPath("a.txt"), null);
});

test("RDS-3 importer builds safe asset and metadata payloads without source paths", () => {
  const bytes = Buffer.from("abc");
  const payload = buildAssetPayload({
    filePath: "C:\\Users\\Doctor\\Documents\\Dermatoscopy\\rds3 sample.jpg",
    bytes,
    checksumSha256: sha256Hex(bytes),
    contentType: "image/jpeg",
    lesionId: UUID_LESION,
    capturedAt: "2026-06-20T10:00:00.000Z",
  });
  assert.equal(payload.originalFileName, "rds3 sample.jpg");
  assert.equal(payload.dataBase64, "YWJj");
  assert.doesNotMatch(JSON.stringify(payload), /C:\\|Documents|Dermatoscopy|storagePath|signedUrl|token|credential/i);
  const metadata = buildCaptureMetadataPayload();
  assert.equal(metadata.captureSource, "device_bridge");
  assert.equal(metadata.lightingProfile, "unknown");
  assert.equal(metadata.deviceClockSyncStatus, "synced");
});

test("RDS-3 importer uploads a new RDS image and records only local safe ledger data", () => withTempDir(async (dir) => {
  const filePath = join(dir, "rds3 sample.jpg");
  writeFileSync(filePath, Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]));
  const assertCalls = installFetchMock((calls) => {
    assert.equal(calls.length, 2);
    assert.match(calls[0].url, /\/api\/v1\/visits\/.+\/assets$/);
    assert.match(calls[1].url, /\/capture-metadata$/);
  });
  const result = await importImageFile({ config: baseConfig(dir), filePath, ledger: { imported: {} } });
  assert.equal(result.status, "imported");
  assert.equal(result.assetId, "asset-1");
  const ledger = readLedger(join(dir, "ledger.json"));
  const [entry] = Object.values(ledger.imported);
  assert.deepEqual(Object.keys(entry).sort(), ["assetId", "byteSize", "contentType", "fileName", "importedAt"].sort());
  assert.equal(entry.fileName, "rds3 sample.jpg");
  assertCalls();
}));

test("RDS-3 importer skips already imported checksum", () => withTempDir(async (dir) => {
  const filePath = join(dir, "rds3 sample.jpg");
  const bytes = Buffer.from([0xff, 0xd8, 0xff]);
  writeFileSync(filePath, bytes);
  const checksum = sha256Hex(bytes);
  const ledger = { imported: { [checksum]: { assetId: "asset-1" } } };
  globalThis.fetch = async () => {
    throw new Error("fetch must not be called for duplicate files");
  };
  const result = await importImageFile({ config: baseConfig(dir), filePath, ledger });
  assert.equal(result.status, "skipped");
  assert.equal(result.reason, "already_imported");
}));

test("RDS-3 importer scan ignores unsupported files and imports supported images", () => withTempDir(async (dir) => {
  writeFileSync(join(dir, "notes.txt"), "not an image");
  writeFileSync(join(dir, "rds3 sample.jpg"), Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]));
  const assertCalls = installFetchMock((calls) => assert.equal(calls.length, 2));
  const results = await scanOnce(baseConfig(dir));
  assert.equal(results.length, 1);
  assert.equal(results[0].status, "imported");
  assertCalls();
}));

test("RDS-3 importer rejects oversized local images before network upload", () => withTempDir(async (dir) => {
  const filePath = join(dir, "rds3 sample.jpg");
  writeFileSync(filePath, "");
  truncateSync(filePath, 26 * 1024 * 1024);
  globalThis.fetch = async () => {
    throw new Error("fetch must not be called for oversized files");
  };
  const config = baseConfig(dir);
  const result = await importImageFile({ config, filePath, ledger: { imported: {} } });
  assert.equal(result.status, "failed");
  assert.equal(result.reason, "file_too_large");
}));
