#!/usr/bin/env node
// Stage 5W · external adapter incident runbook guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json",
  "deploy/self-hosted/integrations/booking-import-status.stage5v.example.json",
  "scripts/stage5w-external-adapter-incident-runbook.mjs",
  "scripts/stage5w-external-adapter-incident-runbook.test.mjs",
  "scripts/check-stage5w-external-adapter-incident-runbook.mjs",
  "scripts/check-stage5w-external-adapter-incident-runbook.test.mjs",
  "docs/backend/stage-5w-external-adapter-incident-runbook.md",
  ".github/workflows/stage5w-external-adapter-incident-runbook.yml",
];

const REQUIRED_TEXT = {
  "deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json": [
    "rejectedItemLimit",
    "duplicateItemLimit",
    "staleAfterMinutes",
    "controlFilePath",
  ],
  "scripts/stage5w-external-adapter-incident-runbook.mjs": [
    "Stage 5W",
    "classifyExternalAdapterIncident",
    "buildAdapterControlManifest",
    "Pause/resume protocol",
    "no network calls",
  ],
  "scripts/stage5w-external-adapter-incident-runbook.test.mjs": [
    "recommends pause",
    "writes report and control manifest",
  ],
  "docs/backend/stage-5w-external-adapter-incident-runbook.md": [
    "Stage 5W",
    "npm run preflight:stage5w",
    "Managed runtime/database dependency: none",
    "pause/resume",
  ],
  ".github/workflows/stage5w-external-adapter-incident-runbook.yml": [
    "name: stage5w-external-adapter-incident-runbook",
    "npm run preflight:stage5w",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_FILES = [
  "deploy/self-hosted/integrations/adapter-incident-policy.stage5w.example.json",
  "scripts/stage5w-external-adapter-incident-runbook.mjs",
  "docs/backend/stage-5w-external-adapter-incident-runbook.md",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bfetch\s*\(/i,
  /\bXMLHttpRequest\b/i,
  /\baxios\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
  /\bnavigator\.usb\b/i,
  /\bnavigator\.bluetooth\b/i,
  /\bnavigator\.serial\b/i,
  /\bstorage_object_path\b/i,
  /\bsigned_url\b/i,
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
        errors.push(`${file} contains forbidden Stage 5W runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage5w"',
    '"check:stage5w"',
    '"preflight:stage5w"',
    '"adapter:stage5w:incident:example"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5W external adapter incident runbook preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5W external adapter incident runbook preflight");
  }
}

export function collectStage5WChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanProtectedFiles(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage5WChecks();
  if (!result.ok) {
    console.error("[stage5w-external-adapter-incident-runbook] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5w-external-adapter-incident-runbook] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
