#!/usr/bin/env node
// Stage 8A-8C · CRM inbound adapter drift guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json",
  "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json",
  "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json",
  "deploy/self-hosted/integrations/booking-import.stage8b.example.json",
  "scripts/stage8a-8c-crm-inbound-adapter.mjs",
  "scripts/stage8a-8c-crm-inbound-adapter.test.mjs",
  "scripts/check-stage8a-8c-crm-inbound-adapter.mjs",
  "scripts/check-stage8a-8c-crm-inbound-adapter.test.mjs",
  "docs/backend/stage-8a-8c-crm-inbound-adapter.md",
  ".github/workflows/stage8a-8c-crm-inbound-adapter.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json": [
    "\"stage\": \"8A-8C\"",
    "stage8a-8c-crm-inbound-adapter",
    "CRM inbound adapter contract",
    "CRM export normalization",
    "Safe import audit flow",
    "\"networkCalls\": false",
    "\"storesRawExternalPayload\": false",
    "\"managedRuntimeDependency\": \"none\"",
    "\"managedDatabaseDependency\": \"none\"",
    "\"expectedConfirmation\": \"Confirmed: Stage 8A-8C synced from main, no conflicts.\"",
  ],
  "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json": [
    "crm-safe-export-2026-05-21-0900",
    "booking_request",
    "available_slot",
    "patientCode",
  ],
  "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json": [
    "sourceReferencePrefix",
    "idempotencyKeyPrefix",
    "fieldMap",
    "kindMap",
  ],
  "deploy/self-hosted/integrations/booking-import.stage8b.example.json": [
    "clinic_crm",
    "booking_request",
    "available_slot",
  ],
  "scripts/stage8a-8c-crm-inbound-adapter.mjs": [
    "buildStage8A8CCrmAdapterPlan",
    "normalizeCrmInboundRecords",
    "buildStage5QImportPayloadFromCrmExport",
    "renderStage8A8CCrmInboundAdapterDryRun",
    "runStage8A8CCrmInboundAdapter",
    "validateExternalAdapterPayload",
    "networkCallsExternalSystems: false",
  ],
  "scripts/stage8a-8c-crm-inbound-adapter.test.mjs": [
    "maps safe CRM records",
    "rejects raw CRM values",
    "CLI dry-run exits 0",
  ],
  "docs/backend/stage-8a-8c-crm-inbound-adapter.md": [
    "Stage 8A-8C",
    "CRM inbound adapter",
    "npm run preflight:stage8a-8c",
    "Managed runtime/database dependency: none",
    "Stage 5Q",
  ],
  ".github/workflows/stage8a-8c-crm-inbound-adapter.yml": [
    "name: stage8a-8c-crm-inbound-adapter",
    "npm run preflight:stage8a-8c",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage8a_8c_preflight",
    "crm_inbound_adapter_contract_confirmed: true",
    "crm_export_normalization_confirmed: true",
    "safe_import_audit_flow_confirmed: true",
    "command: \"npm run preflight:stage8a-8c\"",
    "Stage 8D-8F",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 8A-8C",
    "CRM inbound adapter",
    "Stage 8D-8F",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 8A-8C",
    "Stage 8D-8F",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 8A-8C",
    "CRM inbound adapter",
    "safe import audit flow",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 8A-8C",
    "Stage 8D-8F",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "crm-inbound-adapter.stage8a-8c.json",
    "stage8a-8c-crm-inbound-adapter.mjs",
    "stage-8a-8c-crm-inbound-adapter.md",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json",
  "deploy/self-hosted/integrations/crm-inbound-export.stage8a.example.json",
  "deploy/self-hosted/integrations/crm-inbound-mapping.stage8a.example.json",
  "deploy/self-hosted/integrations/booking-import.stage8b.example.json",
  "scripts/stage8a-8c-crm-inbound-adapter.mjs",
  "docs/backend/stage-8a-8c-crm-inbound-adapter.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bfetch\s*\(/i,
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
        errors.push(`${file} contains forbidden Stage 8A-8C runtime or raw CRM coupling: ${pattern}`);
      }
    }
  }
}

function validateManifest(errors, root) {
  const file = "deploy/self-hosted/integrations/crm-inbound-adapter.stage8a-8c.json";
  if (!existsSync(join(root, file))) return;
  const manifest = JSON.parse(read(root, file));
  if (manifest.productBoundary?.managedRuntimeDependency !== "none") {
    errors.push(`${file} must keep managedRuntimeDependency none`);
  }
  if (manifest.productBoundary?.managedDatabaseDependency !== "none") {
    errors.push(`${file} must keep managedDatabaseDependency none`);
  }
  if (manifest.adapter?.networkCalls !== false) errors.push(`${file} adapter.networkCalls must be false`);
  if (manifest.adapter?.storesRawExternalPayload !== false) {
    errors.push(`${file} adapter.storesRawExternalPayload must be false`);
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage8a-8c"',
    '"check:stage8a-8c"',
    '"adapter:stage8a-8c:dry-run"',
    '"preflight:stage8a-8c"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }

  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 8A-8C CRM inbound adapter preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 8A-8C CRM inbound adapter preflight");
  }
}

export function collectStage8A8CChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage8A8CChecks();
  if (!result.ok) {
    console.error("[stage8a-8c-crm-inbound-adapter] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage8a-8c-crm-inbound-adapter] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
