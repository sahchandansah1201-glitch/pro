#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  watch,
  writeFileSync,
} from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

export const DEFAULT_RDS3_FOLDER = "%USERPROFILE%\\Documents\\Dermatoscopy";
export const MAX_RDS3_IMAGE_BYTES = 25 * 1024 * 1024;
export const SUPPORTED_RDS3_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);

const DEFAULT_POLL_MS = 1000;
const DEFAULT_STABLE_MS = 1200;
const DEFAULT_LEDGER_NAME = ".dermatolog-pro-rds3-import-ledger.json";
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|cookie|signed|signature|object[_-]?key|storage[_-]?path|patient[_-]?name|email|credential|session|qr)/i;

function usage() {
  return `
Dermatolog Pro RDS-3 folder importer

Usage:
  node scripts/rds3-folder-importer.mjs \\
    --watch-dir "%USERPROFILE%\\Documents\\Dermatoscopy" \\
    --api-base-url "http://localhost:3001" \\
    --api-token "<worker-or-user-token>" \\
    --visit-id "<visit-uuid>" \\
    [--lesion-id "<lesion-uuid>"] \\
    [--mode scan|watch]

Safety:
  - reads only JPEG/PNG/WebP/HEIC files from the local RDS-3 folder;
  - sends bytes only to the self-hosted Dermatolog Pro backend;
  - never sends source file paths, signed URLs, QR/session values, credentials, or patient text;
  - records only local sha256/basename/import status in the local ledger.
`.trim();
}

function cleanString(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function expandWindowsEnvPath(input, env = process.env) {
  const raw = cleanString(input) || DEFAULT_RDS3_FOLDER;
  return raw.replace(/%([^%]+)%/g, (_, key) => env[key] || `%${key}%`);
}

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const args = {
    mode: "scan",
    pollMs: DEFAULT_POLL_MS,
    stableMs: DEFAULT_STABLE_MS,
    watchDir: env.RDS3_WATCH_DIR || DEFAULT_RDS3_FOLDER,
    apiBaseUrl: env.RDS3_API_BASE_URL || "",
    apiToken: env.RDS3_API_TOKEN || "",
    visitId: env.RDS3_VISIT_ID || "",
    lesionId: env.RDS3_LESION_ID || "",
    ledgerPath: env.RDS3_LEDGER_PATH || "",
    moveImportedDir: env.RDS3_MOVE_IMPORTED_DIR || "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--watch-dir") args.watchDir = next, index += 1;
    else if (arg === "--api-base-url") args.apiBaseUrl = next, index += 1;
    else if (arg === "--api-token") args.apiToken = next, index += 1;
    else if (arg === "--visit-id") args.visitId = next, index += 1;
    else if (arg === "--lesion-id") args.lesionId = next, index += 1;
    else if (arg === "--mode") args.mode = next, index += 1;
    else if (arg === "--ledger") args.ledgerPath = next, index += 1;
    else if (arg === "--move-imported-dir") args.moveImportedDir = next, index += 1;
    else if (arg === "--poll-ms") args.pollMs = Number(next), index += 1;
    else if (arg === "--stable-ms") args.stableMs = Number(next), index += 1;
    else throw new Error(`Unknown argument: ${arg}`);
  }

  const watchDir = resolve(expandWindowsEnvPath(args.watchDir, env));
  return {
    ...args,
    watchDir,
    apiBaseUrl: cleanString(args.apiBaseUrl),
    apiToken: cleanString(args.apiToken),
    visitId: cleanString(args.visitId),
    lesionId: cleanString(args.lesionId),
    ledgerPath: resolve(args.ledgerPath || join(watchDir, DEFAULT_LEDGER_NAME)),
    moveImportedDir: args.moveImportedDir ? resolve(expandWindowsEnvPath(args.moveImportedDir, env)) : "",
    mode: args.mode === "watch" ? "watch" : "scan",
    pollMs: Number.isFinite(args.pollMs) && args.pollMs > 0 ? Math.min(args.pollMs, 60000) : DEFAULT_POLL_MS,
    stableMs: Number.isFinite(args.stableMs) && args.stableMs > 0 ? Math.min(args.stableMs, 30000) : DEFAULT_STABLE_MS,
  };
}

function assertConfig(config) {
  const missing = [];
  for (const key of ["watchDir", "apiBaseUrl", "apiToken", "visitId"]) {
    if (!cleanString(config[key])) missing.push(key);
  }
  if (missing.length) throw new Error(`Missing required config: ${missing.join(", ")}`);
  if (!existsSync(config.watchDir)) throw new Error("RDS-3 watch directory does not exist.");
  if (SENSITIVE_KEY_PATTERN.test(JSON.stringify({ visitId: config.visitId, lesionId: config.lesionId }))) {
    throw new Error("Visit and lesion identifiers must not contain secret-like values.");
  }
}

function contentTypeForPath(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  if (ext === ".heif") return "image/heif";
  return null;
}

function isSupportedImagePath(filePath) {
  return SUPPORTED_RDS3_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readLedger(ledgerPath) {
  try {
    const parsed = JSON.parse(readFileSync(ledgerPath, "utf8"));
    return parsed && typeof parsed === "object" && parsed.imported ? parsed : { imported: {} };
  } catch {
    return { imported: {} };
  }
}

function writeLedger(ledgerPath, ledger) {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
}

function safeFileName(filePath) {
  const nativeOrWindowsBase = String(filePath).split(/[\\/]/).filter(Boolean).at(-1) || basename(filePath);
  return nativeOrWindowsBase.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
}

async function waitForStableFile(filePath, stableMs = DEFAULT_STABLE_MS) {
  const first = statSync(filePath);
  await delay(stableMs);
  const second = statSync(filePath);
  return first.size === second.size && first.mtimeMs === second.mtimeMs;
}

function buildAssetPayload({ filePath, bytes, checksumSha256, contentType, lesionId, capturedAt }) {
  return {
    kind: "dermoscopy",
    contentType,
    byteSize: bytes.byteLength,
    checksumSha256,
    dataBase64: bytes.toString("base64"),
    originalFileName: safeFileName(filePath),
    lesionId: lesionId || null,
    capturedAt,
  };
}

function buildCaptureMetadataPayload() {
  return {
    captureSource: "device_bridge",
    scaleMarkerDetected: false,
    millimetersAvailable: false,
    deviceCaptureProfile: "standard_dermoscopy",
    lightingProfile: "unknown",
    focusProfile: "unknown",
    distanceProfile: "unknown",
    deviceCalibrationStatus: "unknown",
    captureProtocolVersion: "imported_standard",
    lensProfile: "dermoscope_contact",
    polarizationMode: "unknown",
    colorReferenceStatus: "unknown",
    deviceClockSyncStatus: "synced",
  };
}

async function requestJson(url, { apiToken, method = "POST", body }) {
  const response = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message = json?.error?.message || json?.message || `HTTP ${response.status}`;
    throw new Error(message);
  }
  return json;
}

function joinApiUrl(baseUrl, path) {
  return `${String(baseUrl).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function registerAsset({ config, filePath, bytes, checksumSha256, contentType, capturedAt }) {
  const assetBody = buildAssetPayload({
    filePath,
    bytes,
    checksumSha256,
    contentType,
    lesionId: config.lesionId,
    capturedAt,
  });
  const assetResponse = await requestJson(
    joinApiUrl(config.apiBaseUrl, `/api/v1/visits/${encodeURIComponent(config.visitId)}/assets`),
    { apiToken: config.apiToken, body: assetBody },
  );
  const assetId = assetResponse?.item?.id;
  if (!assetId) throw new Error("Backend did not return imported asset id.");
  await requestJson(
    joinApiUrl(
      config.apiBaseUrl,
      `/api/v1/visits/${encodeURIComponent(config.visitId)}/assets/${encodeURIComponent(assetId)}/capture-metadata`,
    ),
    { apiToken: config.apiToken, method: "PATCH", body: buildCaptureMetadataPayload() },
  );
  return { assetId, correlationId: assetResponse?.correlationId || null };
}

async function importImageFile({ config, filePath, ledger }) {
  if (!isSupportedImagePath(filePath)) return { status: "skipped", reason: "unsupported_extension" };
  if (!existsSync(filePath)) return { status: "skipped", reason: "missing_file" };
  if (!(await waitForStableFile(filePath, config.stableMs))) {
    return { status: "skipped", reason: "file_still_changing" };
  }
  const stat = statSync(filePath);
  if (stat.size <= 0) return { status: "skipped", reason: "empty_file" };
  if (stat.size > MAX_RDS3_IMAGE_BYTES) return { status: "failed", reason: "file_too_large" };
  const contentType = contentTypeForPath(filePath);
  if (!contentType) return { status: "skipped", reason: "unsupported_content_type" };
  const bytes = readFileSync(filePath);
  const checksumSha256 = sha256Hex(bytes);
  if (ledger.imported[checksumSha256]) {
    return { status: "skipped", reason: "already_imported", checksumSha256 };
  }
  const imported = await registerAsset({
    config,
    filePath,
    bytes,
    checksumSha256,
    contentType,
    capturedAt: stat.mtime.toISOString(),
  });
  ledger.imported[checksumSha256] = {
    fileName: safeFileName(filePath),
    assetId: imported.assetId,
    importedAt: new Date().toISOString(),
    byteSize: stat.size,
    contentType,
  };
  writeLedger(config.ledgerPath, ledger);
  if (config.moveImportedDir) {
    mkdirSync(config.moveImportedDir, { recursive: true });
    renameSync(filePath, join(config.moveImportedDir, safeFileName(filePath)));
  }
  return { status: "imported", assetId: imported.assetId, checksumSha256 };
}

async function scanOnce(config) {
  assertConfig(config);
  const ledger = readLedger(config.ledgerPath);
  const files = [];
  for (const name of readdirSync(config.watchDir)) {
    const filePath = join(config.watchDir, name);
    try {
      if (statSync(filePath).isFile() && isSupportedImagePath(filePath)) files.push(filePath);
    } catch {
      // Ignore files removed while scanning.
    }
  }
  const results = [];
  for (const filePath of files.sort()) {
    try {
      results.push({ fileName: safeFileName(filePath), ...(await importImageFile({ config, filePath, ledger })) });
    } catch (error) {
      results.push({
        fileName: safeFileName(filePath),
        status: "failed",
        reason: error instanceof Error ? error.message : "unknown_error",
      });
    }
  }
  return results;
}

async function watchFolder(config) {
  assertConfig(config);
  await scanOnce(config);
  const queue = new Set();
  let running = false;
  const drain = async () => {
    if (running) return;
    running = true;
    try {
      while (queue.size > 0) {
        const [filePath] = queue;
        queue.delete(filePath);
        await scanOnce({ ...config, stableMs: config.stableMs });
      }
    } finally {
      running = false;
    }
  };
  const watcher = watch(config.watchDir, { persistent: true }, (_, fileName) => {
    if (!fileName) return;
    const filePath = join(config.watchDir, String(fileName));
    if (!isSupportedImagePath(filePath)) return;
    queue.add(filePath);
    setTimeout(drain, config.pollMs).unref?.();
  });
  return watcher;
}

export {
  assertConfig,
  buildAssetPayload,
  buildCaptureMetadataPayload,
  contentTypeForPath,
  expandWindowsEnvPath,
  importImageFile,
  isSupportedImagePath,
  parseArgs,
  readLedger,
  scanOnce,
  sha256Hex,
  watchFolder,
};

async function main() {
  const config = parseArgs();
  if (config.help) {
    console.log(usage());
    return;
  }
  if (config.mode === "watch") {
    await watchFolder(config);
    console.log("RDS-3 importer is watching the local capture folder.");
    return;
  }
  const results = await scanOnce(config);
  const summary = {
    imported: results.filter((item) => item.status === "imported").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
  };
  console.log(JSON.stringify({ ok: summary.failed === 0, summary, results }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
