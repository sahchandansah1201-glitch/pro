// Stage 4J · Local self-hosted object store.
// Stores clinical asset bytes under a backend-owned directory. The browser never
// receives bucket/key paths; routes stream bytes through authenticated backend
// endpoints.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, normalize, resolve, sep } from "node:path";

const DEFAULT_LOCAL_OBJECT_DIR = ".self-hosted/object-storage";

function isPlainObject(value) {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

export function sanitizeObjectStoreSegment(value, field = "object path") {
  const raw = String(value || "").trim();
  if (!raw || raw === "." || raw === ".." || raw.includes("\0")) {
    throw new Error(`${field} contains an unsafe segment.`);
  }
  if (!/^[A-Za-z0-9._=-]+$/.test(raw)) {
    throw new Error(`${field} contains unsupported characters.`);
  }
  return raw;
}

export function localObjectPath(rootDir, bucket, key) {
  const root = resolve(rootDir || DEFAULT_LOCAL_OBJECT_DIR);
  const safeBucket = sanitizeObjectStoreSegment(bucket, "object bucket");
  const keyParts = String(key || "")
    .split("/")
    .filter(Boolean)
    .map((part) => sanitizeObjectStoreSegment(part, "object key"));
  if (keyParts.length === 0) throw new Error("object key is required.");
  const target = resolve(root, safeBucket, ...keyParts);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;
  if (!target.startsWith(rootWithSep)) {
    throw new Error("object key escapes the configured object store root.");
  }
  return normalize(target);
}

function normalizeBytes(bytes) {
  if (bytes instanceof Uint8Array) return bytes;
  if (Buffer.isBuffer(bytes)) return bytes;
  throw new Error("object bytes must be Uint8Array.");
}

function metadataPath(path) {
  return `${path}.metadata.json`;
}

function readJsonSafe(bytes) {
  try {
    const parsed = JSON.parse(String(bytes || "{}"));
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createLocalObjectStore(config = {}) {
  const rootDir = config.objectStorageLocalDir || DEFAULT_LOCAL_OBJECT_DIR;
  return {
    mode: "local-filesystem",

    async putObject({ bucket, key, bytes, contentType, checksumSha256 }) {
      const safeBytes = normalizeBytes(bytes);
      const path = localObjectPath(rootDir, bucket, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, safeBytes);
      await writeFile(
        metadataPath(path),
        JSON.stringify(
          {
            contentType: contentType || "application/octet-stream",
            byteSize: safeBytes.byteLength,
            checksumSha256: checksumSha256 || null,
            storedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      return {
        bucket,
        key,
        byteSize: safeBytes.byteLength,
        contentType: contentType || "application/octet-stream",
      };
    },

    async getObject({ bucket, key }) {
      const path = localObjectPath(rootDir, bucket, key);
      const bytes = await readFile(path);
      let metadata = {};
      try {
        metadata = readJsonSafe(await readFile(metadataPath(path)));
      } catch {
        metadata = {};
      }
      return {
        bytes,
        byteSize: bytes.byteLength,
        contentType: String(metadata.contentType || "application/octet-stream"),
        checksumSha256: metadata.checksumSha256 || null,
      };
    },
  };
}
