import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  createLocalObjectStore,
  localObjectPath,
  sanitizeObjectStoreSegment,
} from "./object-store.mjs";

test("local object store writes and reads bytes with safe metadata", async () => {
  const root = await mkdtemp(join(tmpdir(), "derma-pro-object-store-"));
  try {
    const store = createLocalObjectStore({ objectStorageLocalDir: root });
    const bytes = Buffer.from("stage4j-binary", "utf8");
    const put = await store.putObject({
      bucket: "clinical-assets",
      key: "clinics/c1/patients/p1/visits/v1/photo.png",
      bytes,
      contentType: "image/png",
      checksumSha256: "abc",
    });
    assert.equal(put.byteSize, bytes.byteLength);

    const stored = await store.getObject({
      bucket: "clinical-assets",
      key: "clinics/c1/patients/p1/visits/v1/photo.png",
    });
    assert.equal(stored.contentType, "image/png");
    assert.equal(String(stored.bytes), "stage4j-binary");
    assert.equal(stored.checksumSha256, "abc");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("local object store rejects path traversal and unsafe segments", () => {
  assert.throws(() => sanitizeObjectStoreSegment(".."), /unsafe segment/);
  assert.throws(
    () => localObjectPath("/tmp/object-root", "clinical-assets", "clinics/../../secret"),
    /unsafe segment/,
  );
  assert.throws(
    () => localObjectPath("/tmp/object-root", "clinical-assets", "clinics/patient id/photo.png"),
    /unsupported characters/,
  );
});
