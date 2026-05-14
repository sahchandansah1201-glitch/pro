#!/usr/bin/env node
// Stage 5G · production clinical workspace completion guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "src/pages/doctor/VisitWorkspacePage.test.tsx",
  "docs/backend/stage-5g-production-clinical-workspace-completion.md",
  ".github/workflows/stage5g-production-clinical-workspace-completion.yml",
  "scripts/check-stage5g-production-clinical-workspace-completion.mjs",
  "scripts/check-stage5g-production-clinical-workspace-completion.test.mjs",
  "scripts/preflight-all.mjs",
  "scripts/preflight-all.test.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "ProductionClinicalWorkspaceEmptyState",
    "Production clinical workspace: mock assessment/report data hidden",
    "локальное демо-добавление очага отключено",
    "productionMode ? [] : getAssessmentsByVisitId",
    "productionMode ? [] : getImagesByLesionId",
  ],
  "src/pages/doctor/VisitWorkspacePage.test.tsx": [
    "Stage 5G · production clinical workspace completion",
    "hides mock-derived assessment, conclusion and report tabs in production",
    "disables local demo lesion placement in production Body Map",
    "mock assessment",
  ],
  "docs/backend/stage-5g-production-clinical-workspace-completion.md": [
    "Stage 5G",
    "Production Clinical Workspace Completion",
    "npm run preflight:stage5g",
    "managed runtime: none",
    "managed database: none",
  ],
  ".github/workflows/stage5g-production-clinical-workspace-completion.yml": [
    "name: stage5g-production-clinical-workspace-completion",
    "npm run preflight:stage5g",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5G",
    "production clinical workspace",
    "npm run preflight:stage5g",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "src/pages/doctor/VisitWorkspacePage.tsx",
];

const FORBIDDEN_RUNTIME_PATTERNS = [
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

function scanRuntimeCoupling(errors, root) {
  for (const file of PROTECTED_RUNTIME_FILES) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden production runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of ['"test:stage5g"', '"check:stage5g"', '"preflight:stage5g"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5G production clinical workspace completion preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5G production clinical workspace completion preflight");
  }
}

export function collectStage5GChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanRuntimeCoupling(errors, root);
  validatePackageScripts(errors, root);
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = collectStage5GChecks();
  if (!result.ok) {
    console.error("[stage5g-production-clinical-workspace-completion] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5g-production-clinical-workspace-completion] OK (${result.checkedFiles} files checked)`);
}
