#!/usr/bin/env node
// Stage 4H · Self-hosted visit workspace write API.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0005_stage4h_visit_workspace_writes.sql",
  "backend/self-hosted/visit-workspace-write-repository.mjs",
  "backend/self-hosted/visit-workspace-write-repository.test.mjs",
  "backend/self-hosted/visit-workspace-write-service.mjs",
  "backend/self-hosted/visit-workspace-write-service.test.mjs",
  "backend/self-hosted/openapi.stage4h.json",
  "src/lib/self-hosted-visit-write-api.ts",
  "src/lib/self-hosted-visit-write-api.test.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
  "src/pages/doctor/VisitWorkspaceLiveActions.test.tsx",
  "docs/backend/stage-4h-visit-workspace-writes.md",
  "scripts/check-stage4h-self-hosted-visit-workspace-writes.mjs",
  "scripts/check-stage4h-self-hosted-visit-workspace-writes.test.mjs",
  ".github/workflows/stage4h-visit-workspace-writes.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/visit-workspace-write-repository.mjs": [
    "createVisitWorkspaceWriteRepository",
    "buildUpdateVisitSql",
    "buildCreateLesionSql",
    "buildUpdateLesionSql",
    "buildArchiveLesionSql",
    "buildUpsertReportSql",
  ],
  "backend/self-hosted/visit-workspace-write-service.mjs": [
    "createVisitWorkspaceWriteService",
    "visit.update",
    "lesion.create",
    "lesion.update",
    "lesion.archive",
    "report.update",
    "visitWriteScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage4h.json",
    "visitWorkspaceWriteService",
    "visitReportMatch",
    "lesionMatch",
    "stage: \"4H\"",
  ],
  "backend/self-hosted/rbac.mjs": [
    "VISIT_WRITE_ROLES",
    "visitWriteScope",
  ],
  "backend/self-hosted/openapi.stage4h.json": [
    "4H-visit-workspace-writes",
    "/api/v1/visits/{visitId}",
    "/api/v1/visits/{visitId}/lesions",
    "/api/v1/lesions/{lesionId}",
    "/api/v1/visits/{visitId}/report",
  ],
  "src/lib/self-hosted-visit-write-api.ts": [
    "updateSelfHostedVisit",
    "createSelfHostedVisitLesion",
    "updateSelfHostedVisitLesion",
    "archiveSelfHostedVisitLesion",
    "updateSelfHostedVisitReport",
  ],
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx": [
    "Self-hosted запись визита",
    "Сохранить визит",
    "Создать очаг",
    "Архивировать",
    "Сохранить отчёт",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "VisitWorkspaceLiveActions",
  ],
  "docs/backend/stage-4h-visit-workspace-writes.md": [
    "Stage 4H",
    "PATCH /api/v1/visits/{visitId}",
    "POST /api/v1/visits/{visitId}/lesions",
    "PATCH /api/v1/lesions/{lesionId}",
    "DELETE /api/v1/lesions/{lesionId}",
    "PATCH /api/v1/visits/{visitId}/report",
    "npm run preflight:stage4h",
  ],
  ".github/workflows/stage4h-visit-workspace-writes.yml": [
    "name: stage4h-visit-workspace-writes",
    "npm run preflight:stage4h",
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
  "backend/self-hosted/visit-workspace-write-repository.mjs",
  "backend/self-hosted/visit-workspace-write-service.mjs",
  "backend/self-hosted/openapi.stage4h.json",
  "src/lib/self-hosted-visit-write-api.ts",
  "src/pages/doctor/VisitWorkspaceLiveActions.tsx",
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
  for (const script of ['"test:stage4h"', '"check:stage4h"', '"preflight:stage4h"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4H visit workspace writes preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4H visit workspace writes preflight");
  }
}

export function collectStage4HChecks({ root = process.cwd() } = {}) {
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
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage4HChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4h-self-hosted-visit-workspace-writes] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4h-self-hosted-visit-workspace-writes] OK (${result.checkedFiles} files, visit workspace write guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
