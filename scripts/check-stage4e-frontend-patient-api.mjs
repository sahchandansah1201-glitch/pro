#!/usr/bin/env node
// Stage 4E · Frontend bridge to the self-hosted patient API.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "src/lib/self-hosted-api-session.ts",
  "src/lib/self-hosted-patient-api.ts",
  "src/lib/self-hosted-patient-api.test.ts",
  "src/pages/doctor/PatientsPage.tsx",
  "src/pages/doctor/PatientsPage.test.tsx",
  "docs/backend/stage-4e-frontend-patient-api.md",
  "scripts/check-stage4e-frontend-patient-api.mjs",
  "scripts/check-stage4e-frontend-patient-api.test.mjs",
  ".github/workflows/stage4e-frontend-patient-api.yml",
];

const REQUIRED_TEXT = {
  "src/lib/self-hosted-api-session.ts": [
    "SELF_HOSTED_API_BASE_URL_KEY",
    "SELF_HOSTED_API_TOKEN_KEY",
    "VITE_SELF_HOSTED_API_BASE_URL",
    "useSelfHostedApiSession",
  ],
  "src/lib/self-hosted-patient-api.ts": [
    "buildSelfHostedApiUrl",
    "listSelfHostedPatients",
    "getSelfHostedPatient",
    "createSelfHostedPatient",
    "updateSelfHostedPatient",
    "archiveSelfHostedPatient",
    "/api/v1/patients",
    "selfHostedPatientToDomain",
  ],
  "src/lib/self-hosted-patient-api.test.ts": [
    "lists patients with bearer auth",
    "creates, updates, and archives patients",
    "maps validation errors",
  ],
  "src/pages/doctor/PatientsPage.tsx": [
    "Self-hosted backend подключён",
    "createSelfHostedPatient",
    "updateSelfHostedPatient",
    "archiveSelfHostedPatient",
    "getSelfHostedPatient",
    "PATIENT_DEMO_CREATE_BLOCKED_MESSAGE",
  ],
  "src/pages/doctor/PatientsPage.test.tsx": [
    "loads patients from the self-hosted backend",
    "creates a patient through the self-hosted backend",
    "updates a live backend patient",
    "archives a live backend patient",
    "surfaces backend RBAC/list errors",
  ],
  "docs/backend/stage-4e-frontend-patient-api.md": [
    "Stage 4E",
    "Frontend patient API integration",
    "demo fallback",
    "self-hosted token",
    "npm run preflight:stage4e",
    "Stage 4F",
  ],
  ".github/workflows/stage4e-frontend-patient-api.yml": [
    "name: stage4e-frontend-patient-api",
    "npm run preflight:stage4e",
    "GITHUB_STEP_SUMMARY",
  ],
};

const FORBIDDEN_RUNTIME_PATTERNS = [
  /\bsupabase\b/i,
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /\bedge function\b/i,
  /\bSUPABASE_/,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

function requireText(errors, root, file, expected) {
  const content = read(root, file);
  for (const text of expected) {
    if (!content.includes(text)) {
      errors.push(`${file} missing required text: ${text}`);
    }
  }
}

function scanRuntimeCoupling(errors, root) {
  const protectedFiles = [
    "src/lib/self-hosted-api-session.ts",
    "src/lib/self-hosted-patient-api.ts",
    "src/pages/doctor/PatientsPage.tsx",
  ];
  for (const file of protectedFiles) {
    if (!existsSync(join(root, file))) continue;
    const content = read(root, file);
    for (const pattern of FORBIDDEN_RUNTIME_PATTERNS) {
      if (pattern.test(content)) {
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    "\"test:stage4e\"",
    "\"check:stage4e\"",
    "\"preflight:stage4e\"",
  ]) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4E frontend patient API preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4E frontend patient API preflight");
  }
}

export function collectStage4EChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) {
      requireText(errors, root, file, expected);
    }
  }
  scanRuntimeCoupling(errors, root);
  validatePackageScripts(errors, root);
  return {
    ok: errors.length === 0,
    errors,
    checkedFiles: REQUIRED_FILES.length,
  };
}

export function main() {
  const result = collectStage4EChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4e-frontend-patient-api] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4e-frontend-patient-api] OK (${result.checkedFiles} files, frontend patient API guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
