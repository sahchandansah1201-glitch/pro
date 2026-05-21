#!/usr/bin/env node
// Stage 8D-8F · availability sync drift guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json",
  "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json",
  "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json",
  "scripts/stage8d-8f-availability-sync.mjs",
  "scripts/stage8d-8f-availability-sync.test.mjs",
  "scripts/check-stage8d-8f-availability-sync.mjs",
  "scripts/check-stage8d-8f-availability-sync.test.mjs",
  "src/lib/self-hosted-availability-sync.ts",
  "src/lib/self-hosted-availability-sync.test.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "src/pages/operator/OperatorBookingRequestsPage.production.test.tsx",
  "docs/backend/stage-8d-8f-availability-sync.md",
  ".github/workflows/stage8d-8f-availability-sync.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json": [
    "\"stage\": \"8D-8F\"",
    "Availability sync snapshot",
    "Conflict handling",
    "Booking confirmation readiness",
    "\"networkCalls\": false",
    "\"storesRawExternalPayload\": false",
    "\"managedRuntimeDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 8D-8F synced from main, no conflicts.\"",
  ],
  "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json": [
    "availability-sync-safe-snapshot",
    "bookingRequests",
    "availableSlots",
    "storedRawPayload",
    "runtimeCallsExternalSystems",
  ],
  "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json": [
    "\"status\": \"ready\"",
    "confirmationCandidates",
    "\"networkCalls\": false",
  ],
  "scripts/stage8d-8f-availability-sync.mjs": [
    "buildAvailabilitySyncReport",
    "normalizeAvailabilitySyncSnapshot",
    "renderAvailabilitySyncReport",
    "runStage8D8FAvailabilitySync",
    "networkCalls: false",
    "storesRawExternalPayload: false",
  ],
  "src/lib/self-hosted-availability-sync.ts": [
    "buildSelfHostedAvailabilitySyncSummary",
    "AvailabilitySyncIssue",
    "availabilitySyncStatusLabel",
    "external_runtime_calls_enabled",
    "raw_payload_storage_enabled",
  ],
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx": [
    "Availability sync readiness",
    "Stage 8D-8F",
    "buildSelfHostedAvailabilitySyncSummary",
    "no CRM runtime calls",
  ],
  "docs/backend/stage-8d-8f-availability-sync.md": [
    "Stage 8D-8F",
    "appointment availability sync",
    "npm run preflight:stage8d-8f",
    "Managed runtime/database dependency: none",
    "Stage 5S",
  ],
  ".github/workflows/stage8d-8f-availability-sync.yml": [
    "name: stage8d-8f-availability-sync",
    "npm run preflight:stage8d-8f",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage8d_8f_preflight",
    "availability_sync_snapshot_confirmed: true",
    "conflict_handling_confirmed: true",
    "booking_confirmation_readiness_confirmed: true",
    "command: \"npm run preflight:stage8d-8f\"",
    "Stage 8G-8I",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 8D-8F",
    "availability sync",
    "Stage 8G-8I",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 8D-8F",
    "Stage 8G-8I",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 8D-8F",
    "availability sync",
    "booking confirmation",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 8D-8F",
    "Stage 8G-8I",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "availability-sync.stage8d-8f.json",
    "stage8d-8f-availability-sync.mjs",
    "self-hosted-availability-sync.ts",
    "stage-8d-8f-availability-sync.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json",
  "deploy/self-hosted/integrations/availability-sync-input.stage8d.example.json",
  "deploy/self-hosted/integrations/availability-sync-report.stage8f.example.json",
  "scripts/stage8d-8f-availability-sync.mjs",
  "src/lib/self-hosted-availability-sync.ts",
  "src/pages/operator/OperatorBookingRequestsPageLive.tsx",
  "docs/backend/stage-8d-8f-availability-sync.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bXMLHttpRequest\b/i,
  /\baxios\b/i,
  new RegExp(String.raw`\bapi-${"read"}\b`, "i"),
  new RegExp(String.raw`\bapi-${"write"}\b`, "i"),
  new RegExp(String.raw`\b${"edge"} ${"function"}\b`, "i"),
  new RegExp(String.raw`\b${"SUPABASE"}_\w+`),
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
  /\bstorage_object_path\b/i,
  /\bsigned_url\b/i,
  /\baccess_token\b/i,
  /\bpatient_full_name\b/i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) errors.push(`${file} missing required text: ${text}`);
  }
}

function scanProtectedFiles(errors, root) {
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden Stage 8D-8F runtime or raw external coupling: ${pattern}`);
      }
    }
  }
}

function validateManifest(errors, root) {
  const file = "deploy/self-hosted/integrations/availability-sync.stage8d-8f.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push(`${file} must keep managedRuntimeDependency none`);
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push(`${file} must keep managedDatabaseDependency none`);
  }
  if (manifest.safetyPolicy?.networkCalls !== false) errors.push(`${file} safetyPolicy.networkCalls must be false`);
  if (manifest.safetyPolicy?.confirmationWritesDirectly !== false) {
    errors.push(`${file} safetyPolicy.confirmationWritesDirectly must be false`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage8d-8f"',
    '"check:stage8d-8f"',
    '"availability:stage8d-8f:dry-run"',
    '"preflight:stage8d-8f"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 8D-8F availability sync preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 8D-8F availability sync preflight");
  }
}

export function collectStage8D8FChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  for (const [file, expected] of Object.entries(PROJECT_MEMORY_REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required project-memory file: ${file}`);
  }
  validateManifest(errors, root);
  scanProtectedFiles(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage8D8FChecks();
  if (!result.ok) {
    console.error("[stage8d-8f-availability-sync] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage8d-8f-availability-sync] OK (${result.checkedFiles} files checked)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
