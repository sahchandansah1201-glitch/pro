#!/usr/bin/env node
// Stage 5H · production clinical backend contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0014_stage5h_clinical_workspace_contracts.sql",
  "backend/self-hosted/db/migrations/0059_lesion_comparison_decision_drafts.sql",
  "backend/self-hosted/clinical-workspace-repository.mjs",
  "backend/self-hosted/clinical-workspace-repository.test.mjs",
  "backend/self-hosted/clinical-workspace-service.mjs",
  "backend/self-hosted/clinical-workspace-service.test.mjs",
  "backend/self-hosted/openapi.stage5h.json",
  "src/lib/self-hosted-clinical-workspace-api.ts",
  "src/lib/self-hosted-clinical-workspace-api.test.ts",
  "src/pages/doctor/LesionDetailPage.tsx",
  "src/pages/doctor/LesionDetailPage.test.tsx",
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "src/pages/doctor/VisitWorkspacePage.test.tsx",
  "docs/backend/stage-5h-production-clinical-backend-contracts.md",
  "scripts/check-stage5h-production-clinical-backend-contracts.mjs",
  "scripts/check-stage5h-production-clinical-backend-contracts.test.mjs",
  ".github/workflows/stage5h-production-clinical-backend-contracts.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0014_stage5h_clinical_workspace_contracts.sql": [
    "clinical_assessments",
    "clinical_conclusions",
    "reports_visit_id_unique_idx",
  ],
  "backend/self-hosted/db/migrations/0059_lesion_comparison_decision_drafts.sql": [
    "lesion_comparison_decision_drafts",
    "patient_delivery_allowed boolean not null default false",
    "protected_fields_exposed boolean not null default false",
    "lesion_comparison_decision_drafts_metadata_no_protected_keys",
  ],
  "backend/self-hosted/clinical-workspace-repository.mjs": [
    "createClinicalWorkspaceRepository",
    "buildGetVisitAssessmentSql",
    "buildUpsertVisitAssessmentSql",
    "buildGetVisitConclusionSql",
    "buildUpsertVisitConclusionSql",
    "buildGetVisitReportSql",
    "buildUpsertLesionComparisonDraftSql",
    "buildGetLesionLongitudinalHistorySql",
    "getLesionLongitudinalHistory",
    "lesion_comparison_decision_drafts",
    "patient_delivery_allowed",
    "rawImageBytesExposed",
  ],
  "backend/self-hosted/clinical-workspace-service.mjs": [
    "createClinicalWorkspaceService",
    "normalizeLesionComparisonDraftPayload",
    "lesion_comparison_draft.upsert",
    "lesion_longitudinal_history.read",
    "getLesionLongitudinalHistory",
    "assessment.read",
    "assessment.update",
    "conclusion.read",
    "conclusion.update",
    "report.read",
    "visitWriteScope",
  ],
  "backend/self-hosted/routes.mjs": [
    "openapi.stage5h.json",
    "clinicalWorkspaceService",
    "visitAssessmentMatch",
    "visitConclusionMatch",
    "visitLesionComparisonDraftMatch",
    "lesionLongitudinalHistoryMatch",
    "stage: \"5H\"",
  ],
  "backend/self-hosted/openapi.stage5h.json": [
    "5H-clinical-workspace-contracts",
    "/api/v1/visits/{visitId}/assessment",
    "/api/v1/visits/{visitId}/conclusion",
    "/api/v1/visits/{visitId}/report",
    "/api/v1/visits/{visitId}/lesion-comparison-draft",
    "/api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history",
    "LesionComparisonDecisionDraft",
    "LesionLongitudinalHistory",
    "rawImageBytesExposed",
  ],
  "src/lib/self-hosted-clinical-workspace-api.ts": [
    "getSelfHostedVisitAssessment",
    "updateSelfHostedVisitAssessment",
    "getSelfHostedVisitConclusion",
    "updateSelfHostedVisitConclusion",
    "getSelfHostedVisitReport",
    "updateSelfHostedVisitReportContract",
    "saveSelfHostedLesionComparisonDraft",
    "getSelfHostedLesionLongitudinalHistory",
    "SelfHostedLesionLongitudinalHistoryDTO",
  ],
  "src/pages/doctor/LesionDetailPage.tsx": [
    "saveSelfHostedLesionComparisonDraft",
    "Backend audit сохранён",
    "backend audit: только self-hosted metadata",
    "Выдача пациенту: выключена",
  ],
  "src/pages/doctor/LesionDetailPage.test.tsx": [
    "saves the comparison draft to self-hosted backend",
    "/lesion-comparison-draft",
    "Backend audit сохранён",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "ProductionClinicalWorkspacePanel",
    "Self-hosted assessment contract",
    "Self-hosted conclusion contract",
    "Self-hosted report contract",
    "Production clinical workspace: mock assessment/report data hidden",
  ],
  "docs/backend/stage-5h-production-clinical-backend-contracts.md": [
    "Stage 5H",
    "GET /api/v1/visits/{visitId}/assessment",
    "PATCH /api/v1/visits/{visitId}/assessment",
    "GET /api/v1/visits/{visitId}/conclusion",
    "PATCH /api/v1/visits/{visitId}/conclusion",
    "GET /api/v1/visits/{visitId}/report",
    "PATCH /api/v1/visits/{visitId}/lesion-comparison-draft",
    "GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history",
    "lesion_comparison_draft.upsert",
    "lesion_longitudinal_history.read",
    "Batch AW",
    "npm run preflight:stage5h",
  ],
  ".github/workflows/stage5h-production-clinical-backend-contracts.yml": [
    "name: stage5h-production-clinical-backend-contracts",
    "npm run preflight:stage5h",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/clinical-workspace-repository.mjs",
  "backend/self-hosted/clinical-workspace-service.mjs",
  "backend/self-hosted/openapi.stage5h.json",
  "src/lib/self-hosted-clinical-workspace-api.ts",
  "src/pages/doctor/LesionDetailPage.tsx",
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
  for (const script of ['"test:stage5h"', '"check:stage5h"', '"preflight:stage5h"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5H production clinical backend contracts preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5H production clinical backend contracts preflight");
  }
}

export function collectStage5HChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5HChecks();
  if (!result.ok) {
    console.error("[stage5h-production-clinical-backend-contracts] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5h-production-clinical-backend-contracts] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
