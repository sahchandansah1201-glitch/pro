#!/usr/bin/env node
// Stage 6Y · production release archive retention next-cycle register guard.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const REQUIRED_FILES = [
  "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json",
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs",
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.test.mjs",
  "scripts/check-stage6y-production-release-archive-retention-next-cycle-register.mjs",
  "scripts/check-stage6y-production-release-archive-retention-next-cycle-register.test.mjs",
  "docs/backend/stage-6y-production-release-archive-retention-next-cycle-register.md",
  ".github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml",
];

const REQUIRED_MARKERS = {
  "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json": [
    "\"stage\": \"6Y\"",
    "\"packageId\": \"stage6y-production-release-archive-retention-next-cycle-register\"",
    "\"stage6x_release_archive_retention_cycle_final_closure_reconciliation_receipt\"",
    "\"externalArchiveRetentionNextCycleRecordsStoredOutsideGit\": true",
    "\"archiveRetentionNextCycleOutcomeKnownToRepository\": false",
    "\"nextStageHypothesis\": \"Stage 6Z\"",
  ],
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs": [
    "Stage 6Y",
    "buildProductionReleaseArchiveRetentionNextCycleRegister",
    "renderProductionReleaseArchiveRetentionNextCycleRegisterMarkdown",
    "runStage6YProductionReleaseArchiveRetentionNextCycleRegister",
    "buildProductionReleaseArchiveRetentionCycleFinalClosureReconciliationReceipt",
    "archiveRetentionNextCycleOutcomeKnownToRepository",
  ],
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.test.mjs": [
    "Stage 6Y",
    "Ready for external release archive retention next-cycle register",
    "externalArchiveRetentionNextCycleRecordsStoredOutsideGit",
  ],
  "docs/backend/stage-6y-production-release-archive-retention-next-cycle-register.md": [
    "Stage 6Y",
    "Managed runtime/database dependency: none",
    "external archive retention next-cycle records stay outside git",
    "npm run preflight:stage6y",
  ],
  ".github/workflows/stage6y-production-release-archive-retention-next-cycle-register.yml": [
    "name: stage6y-production-release-archive-retention-next-cycle-register",
    "npm run preflight:stage6y",
    "stage6y-production-release-archive-retention-next-cycle-register.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/release-archive-retention-next-cycle-register.stage6y.json",
  "scripts/stage6y-production-release-archive-retention-next-cycle-register.mjs",
  "docs/backend/stage-6y-production-release-archive-retention-next-cycle-register.md",
];

const FORBIDDEN_PATTERNS = [
  /api-read/i,
  /api-write/i,
  /edge function/i,
  /SUPABASE_/,
  /access[_-]?token/i,
  /authorization:\s*bearer\s+(?!<SELF_HOSTED_BEARER_TOKEN>)/i,
  /\bcookie\s*:/i,
  /signed[_-]?url/i,
  /storage_object_path/i,
  /patient[_-]?full[_-]?name|fullName/i,
  /https?:\/\/(?!github\.com\/sahchandansah1201-glitch\/pro|localhost(?::|\/)|127\.0\.0\.1(?::|\/))/i,
];

function read(path) {
  return readFileSync(resolve(ROOT, path), "utf8");
}

export function collectStage6YChecks(root = ROOT) {
  const errors = [];
  const checkedFiles = [];
  for (const file of REQUIRED_FILES) {
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) {
      errors.push(`Missing required Stage 6Y file: ${file}`);
      continue;
    }
    checkedFiles.push(file);
  }

  for (const [file, markers] of Object.entries(REQUIRED_MARKERS)) {
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, "utf8");
    for (const marker of markers) {
      if (!content.includes(marker)) {
        errors.push(`${file} missing marker: ${marker}`);
      }
    }
  }

  for (const file of PROTECTED_FILES) {
    const absolute = resolve(root, file);
    if (!existsSync(absolute)) continue;
    const content = readFileSync(absolute, "utf8");
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden Stage 6Y runtime or live archive evidence coupling: ${pattern}`);
      }
    }
  }

  const packageJsonPath = resolve(root, "package.json");
  if (existsSync(packageJsonPath)) {
    const packageJson = readFileSync(packageJsonPath, "utf8");
    for (const marker of [
      "\"test:stage6y\"",
      "\"check:stage6y\"",
      "\"preflight:stage6y\"",
      "\"register:stage6y:dry-run\"",
      "\"register:stage6y:report\"",
    ]) {
      if (!packageJson.includes(marker)) errors.push(`package.json missing script marker: ${marker}`);
    }
  } else {
    errors.push("Missing package.json");
  }

  const preflightAllPath = resolve(root, "scripts/preflight-all.mjs");
  if (existsSync(preflightAllPath)) {
    const preflightAll = readFileSync(preflightAllPath, "utf8");
    if (!preflightAll.includes("Stage 6Y production release archive retention next-cycle register preflight")) {
      errors.push("scripts/preflight-all.mjs must include Stage 6Y production release archive retention next-cycle register preflight");
    }
  } else {
    errors.push("Missing scripts/preflight-all.mjs");
  }

  return { ok: errors.length === 0, errors, checkedFiles };
}

export function main() {
  const result = collectStage6YChecks();
  if (!result.ok) {
    console.error("[stage6y-production-release-archive-retention-next-cycle-register] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage6y-production-release-archive-retention-next-cycle-register] OK (${result.checkedFiles.length} files checked)`);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}
