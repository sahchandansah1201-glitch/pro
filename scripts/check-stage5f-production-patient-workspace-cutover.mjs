#!/usr/bin/env node
// Stage 5F · production patient/workspace cutover guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/self-hosted-clinical-adapter.ts",
  "src/lib/self-hosted-clinical-adapter.test.ts",
  "src/pages/doctor/PatientsPage.tsx",
  "src/pages/doctor/PatientsPage.test.tsx",
  "src/pages/doctor/PatientDetailPage.tsx",
  "src/pages/doctor/PatientDetailPage.test.tsx",
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "src/pages/doctor/VisitWorkspacePage.test.tsx",
  "docs/backend/stage-5f-production-patient-workspace-cutover.md",
  ".github/workflows/stage5f-production-patient-workspace-cutover.yml",
  "scripts/check-stage5f-production-patient-workspace-cutover.mjs",
  "scripts/check-stage5f-production-patient-workspace-cutover.test.mjs",
  "scripts/preflight-all.mjs",
  "package.json",
];

const REQUIRED_TEXT = {
  "src/lib/self-hosted-clinical-adapter.ts": [
    "SELF_HOSTED_LIVE_SOURCE_LABEL",
    "selfHostedPatientDetailToDomain",
    "selfHostedVisitToDomain",
    "selfHostedLesionToDomain",
  ],
  "src/pages/doctor/PatientsPage.tsx": [
    "Production-режим: пациенты загружаются только из self-hosted backend",
    "Production-режим не показывает демо-пациентов",
    "isProductionAppMode",
  ],
  "src/pages/doctor/PatientDetailPage.tsx": [
    "getSelfHostedPatient",
    "listSelfHostedVisitsByPatient",
    "mock-данные для карточки пациента отключены",
    "Production-режим не открывает карточки пациентов из mock-данных",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "getSelfHostedVisit",
    "listSelfHostedVisitLesions",
    "workspace визита не использует mock patient/visit lookup",
    "Production-режим не открывает workspace визита из mock-данных",
  ],
  "docs/backend/stage-5f-production-patient-workspace-cutover.md": [
    "Stage 5F",
    "Production Patient Workspace Cutover",
    "npm run preflight:stage5f",
    "managed runtime: none",
    "managed database: none",
  ],
  ".github/workflows/stage5f-production-patient-workspace-cutover.yml": [
    "name: stage5f-production-patient-workspace-cutover",
    "npm run preflight:stage5f",
    "GITHUB_STEP_SUMMARY",
  ],
  "backend/self-hosted/README.md": [
    "Stage 5F",
    "production patient/workspace cutover",
    "npm run preflight:stage5f",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "src/lib/self-hosted-clinical-adapter.ts",
  "src/pages/doctor/PatientsPage.tsx",
  "src/pages/doctor/PatientDetailPage.tsx",
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
  for (const script of ['"test:stage5f"', '"check:stage5f"', '"preflight:stage5f"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5F production patient/workspace cutover preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5F production patient/workspace cutover preflight");
  }
}

export function collectStage5FChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5FChecks();
  if (!result.ok) {
    console.error("[stage5f-production-patient-workspace-cutover] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage5f-production-patient-workspace-cutover] OK (${result.checkedFiles} files checked)`);
}

