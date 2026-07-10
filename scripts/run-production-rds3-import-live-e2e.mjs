#!/usr/bin/env node
// Read-only live browser acceptance for a photo already imported by the Windows RDS-3 bridge.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { deployStatusBlocksLiveE2E } from "./run-production-admin-management-live-e2e.mjs";

const DEFAULT_BASE_URL = "https://pro.skindoktor.ru";
const DEFAULT_DEPLOY_STATUS_FILE = "/opt/dermatolog-pro/logs/update-production-status.json";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const FORBIDDEN_RECEIPT_KEY = /(token|secret|password|cookie|signed|signature|object[_-]?key|storage[_-]?path|patient|email|credential|session|qr|visit|lesion|watch|ledger|receiptPath)/i;

function command(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function hasForbiddenReceiptKey(value) {
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, nested]) =>
    FORBIDDEN_RECEIPT_KEY.test(key) || hasForbiddenReceiptKey(nested));
}

export function validateRds3Receipt(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("RDS-3 receipt must be a JSON object.");
  }
  if (value.schemaVersion !== 1 || value.status !== "imported" || value.captureSource !== "device_bridge") {
    throw new Error("RDS-3 receipt does not confirm a completed device import.");
  }
  if (!UUID_PATTERN.test(String(value.assetId || ""))) {
    throw new Error("RDS-3 receipt assetId must be a UUID.");
  }
  if (!SHA256_PATTERN.test(String(value.checksumSha256 || ""))) {
    throw new Error("RDS-3 receipt checksumSha256 must be a sha256 digest.");
  }
  if (Number.isNaN(Date.parse(String(value.importedAt || "")))) {
    throw new Error("RDS-3 receipt importedAt must be an ISO date-time.");
  }
  if (hasForbiddenReceiptKey(value)) {
    throw new Error("RDS-3 receipt contains a forbidden protected field.");
  }
  return value;
}

export function parseLiveRds3E2EArgs(argv = [], env = process.env) {
  const parsed = {
    baseUrl: env.STAGE4M_LIVE_RDS3_BASE_URL || DEFAULT_BASE_URL,
    credentialsFile: env.STAGE4M_RDS3_DOCTOR_CREDENTIALS_FILE || "",
    receiptFile: env.STAGE4M_RDS3_RECEIPT_FILE || "",
    visitId: env.STAGE4M_RDS3_VISIT_ID || "",
    deployStatusFile: env.STAGE4M_DEPLOY_STATUS_FILE || DEFAULT_DEPLOY_STATUS_FILE,
    ignoreDeployStatus: env.STAGE4M_IGNORE_DEPLOY_STATUS === "1",
    headed: false,
    help: false,
    errors: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (["--base-url", "--credentials-file", "--receipt-file", "--visit-id", "--deploy-status-json"].includes(arg)) {
      if (!next) parsed.errors.push(`${arg} requires a value`);
      else {
        const key = {
          "--base-url": "baseUrl",
          "--credentials-file": "credentialsFile",
          "--receipt-file": "receiptFile",
          "--visit-id": "visitId",
          "--deploy-status-json": "deployStatusFile",
        }[arg];
        parsed[key] = next;
        index += 1;
      }
    } else if (arg === "--ignore-deploy-status") parsed.ignoreDeployStatus = true;
    else if (arg === "--headed") parsed.headed = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else parsed.errors.push(`Unknown argument: ${arg}`);
  }

  if (!parsed.help) {
    if (!/^https?:\/\//i.test(parsed.baseUrl)) parsed.errors.push("--base-url must start with http:// or https://");
    if (!parsed.credentialsFile) parsed.errors.push("--credentials-file is required");
    if (!parsed.receiptFile) parsed.errors.push("--receipt-file is required");
    if (!UUID_PATTERN.test(parsed.visitId)) parsed.errors.push("--visit-id must be a UUID");
  }
  return parsed;
}

export function usage() {
  return [
    "Usage:",
    "  npm run e2e:rds3-import:live -- \\",
    "    --base-url https://pro.skindoktor.ru \\",
    "    --credentials-file /root/dermatolog-pro-rds3-doctor-credentials.txt \\",
    "    --receipt-file /root/dermatolog-pro-rds3-last-receipt.json \\",
    "    --visit-id <test-visit-uuid>",
    "",
    "The test is read-only. It verifies a photo already imported by the Windows RDS-3 bridge.",
  ].join("\n");
}

export function runLiveRds3E2E(argv = process.argv.slice(2), { spawn = spawnSync, cwd = process.cwd() } = {}) {
  const parsed = parseLiveRds3E2EArgs(argv);
  if (parsed.help) {
    console.log(usage());
    return 0;
  }
  if (parsed.errors.length) {
    console.error(parsed.errors.join("\n"));
    console.error(`\n${usage()}`);
    return 2;
  }
  if (!existsSync(parsed.credentialsFile) || !existsSync(parsed.receiptFile)) {
    console.error("RDS-3 doctor credentials or receipt file was not found.");
    return 2;
  }
  try {
    validateRds3Receipt(JSON.parse(readFileSync(parsed.receiptFile, "utf8")));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "RDS-3 receipt is invalid.");
    return 2;
  }
  const deployBlocker = deployStatusBlocksLiveE2E({
    deployStatusFile: parsed.deployStatusFile,
    ignoreDeployStatus: parsed.ignoreDeployStatus,
  });
  if (deployBlocker) {
    console.error(deployBlocker);
    return 2;
  }
  if (!existsSync(`${cwd}/node_modules/@playwright/test/index.js`)) {
    console.error("Local dependency @playwright/test is missing. Wait for deployment npm ci to finish.");
    return 2;
  }

  const args = ["playwright", "test", "e2e/production-rds3-import-live.pw.ts", "--project=chromium"];
  if (parsed.headed) args.push("--headed");
  const result = spawn(command("npx"), args, {
    cwd,
    env: {
      ...process.env,
      STAGE4M_LIVE_RDS3_BASE_URL: parsed.baseUrl.replace(/\/+$/, ""),
      STAGE4M_RDS3_DOCTOR_CREDENTIALS_FILE: parsed.credentialsFile,
      STAGE4M_RDS3_RECEIPT_FILE: parsed.receiptFile,
      STAGE4M_RDS3_VISIT_ID: parsed.visitId,
    },
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
    return 1;
  }
  return result.status ?? 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(runLiveRds3E2E());
}
