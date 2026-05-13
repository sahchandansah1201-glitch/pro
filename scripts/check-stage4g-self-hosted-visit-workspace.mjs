#!/usr/bin/env node
// Stage 4G · Self-hosted visit workspace read API.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/visit-workspace-repository.mjs",
  "backend/self-hosted/visit-workspace-repository.test.mjs",
  "backend/self-hosted/openapi.stage4g.json",
  "src/lib/self-hosted-visit-api.ts",
  "src/lib/self-hosted-visit-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveBanner.tsx",
  "src/pages/doctor/VisitWorkspaceLiveBanner.test.tsx",
  "docs/backend/stage-4g-self-hosted-visit-workspace.md",
  "scripts/check-stage4g-self-hosted-visit-workspace.mjs",
  "scripts/check-stage4g-self-hosted-visit-workspace.test.mjs",
  ".github/workflows/stage4g-self-hosted-visit-workspace.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/visit-workspace-repository.mjs": [
    "createVisitWorkspaceRepository",
    "buildListVisitsByPatientSql",
    "buildGetVisitSql",
    "buildListVisitLesionsSql",
    "buildListVisitAssetsSql",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/patients/${patientId}/visits",
    "visit_not_found",
    "visit.list",
    "visit.read",
    "visit.lesions",
    "visit.assets",
    "openapi.stage4g.json",
    "visitReadScope",
  ],
  "backend/self-hosted/rbac.mjs": [
    "visitReadScope",
    "VISIT_READ_ROLES",
  ],
  "backend/self-hosted/openapi.stage4g.json": [
    "4G-visit-workspace",
    "/api/v1/patients/{patientId}/visits",
    "/api/v1/visits/{visitId}",
    "/api/v1/visits/{visitId}/lesions",
    "/api/v1/visits/{visitId}/assets",
  ],
  "src/lib/self-hosted-visit-api.ts": [
    "listSelfHostedVisitsByPatient",
    "getSelfHostedVisit",
    "listSelfHostedVisitLesions",
    "listSelfHostedVisitAssets",
    "/api/v1/patients/",
    "/api/v1/visits/",
  ],
  "src/pages/doctor/VisitWorkspaceLiveBanner.tsx": [
    "isSelfHostedApiConfigured",
    "Self-hosted backend (read-only)",
    "Demo-режим",
    "visit-workspace-live-banner",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "VisitWorkspaceLiveBanner",
  ],
  "docs/backend/stage-4g-self-hosted-visit-workspace.md": [
    "Stage 4G",
    "Self-hosted visit workspace",
    "GET /api/v1/patients/{patientId}/visits",
    "GET /api/v1/visits/{visitId}",
    "GET /api/v1/visits/{visitId}/lesions",
    "GET /api/v1/visits/{visitId}/assets",
    "npm run preflight:stage4g",
  ],
  ".github/workflows/stage4g-self-hosted-visit-workspace.yml": [
    "name: stage4g-self-hosted-visit-workspace",
    "npm run preflight:stage4g",
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

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/visit-workspace-repository.mjs",
  "backend/self-hosted/openapi.stage4g.json",
  "src/lib/self-hosted-visit-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveBanner.tsx",
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
  for (const file of PROTECTED_RUNTIME_FILES) {
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
  for (const script of ['"test:stage4g"', '"check:stage4g"', '"preflight:stage4g"']) {
    if (!packageJson.includes(script)) {
      errors.push(`package.json missing ${script}`);
    }
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4G self-hosted visit workspace preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4G self-hosted visit workspace preflight");
  }
}

export function collectStage4GChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) {
      requireText(errors, root, file, expected);
    } else {
      errors.push(`Missing required file (text check): ${file}`);
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
  const result = collectStage4GChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4g-self-hosted-visit-workspace] failed:");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    return 1;
  }
  console.log(
    `[check-stage4g-self-hosted-visit-workspace] OK (${result.checkedFiles} files, visit workspace read guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
