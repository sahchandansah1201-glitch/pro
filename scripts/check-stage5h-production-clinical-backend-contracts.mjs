#!/usr/bin/env node
// Stage 5H · production clinical backend contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0014_stage5h_clinical_workspace_contracts.sql",
  "backend/self-hosted/db/migrations/0059_lesion_comparison_decision_drafts.sql",
  "backend/self-hosted/db/migrations/0060_stage5h_capture_metadata_and_viewer_qa.sql",
  "backend/self-hosted/db/migrations/0061_stage5h_viewer_qa_review_workflow.sql",
  "backend/self-hosted/db/migrations/0062_stage5h_calibrated_viewer_reviewer_workflow.sql",
  "backend/self-hosted/clinical-workspace-repository.mjs",
  "backend/self-hosted/clinical-workspace-repository.test.mjs",
  "backend/self-hosted/clinical-workspace-service.mjs",
  "backend/self-hosted/clinical-workspace-service.test.mjs",
  "backend/self-hosted/openapi.stage5h.json",
  "src/lib/mock-data.ts",
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
  "backend/self-hosted/db/migrations/0060_stage5h_capture_metadata_and_viewer_qa.sql": [
    "clinical_asset_capture_metadata",
    "lesion_comparison_viewer_qa_drafts",
    "patient_delivery_allowed boolean not null default false",
    "protected_fields_exposed boolean not null default false",
    "medical_measurement_allowed boolean not null default false",
    "clinical_asset_capture_metadata_no_protected_keys",
    "lesion_comparison_viewer_qa_drafts_no_protected_keys",
  ],
  "backend/self-hosted/db/migrations/0061_stage5h_viewer_qa_review_workflow.sql": [
    "review_status text not null default 'unreviewed'",
    "review_reasons jsonb not null default '[]'::jsonb",
    "reviewed_by_user_id uuid references app_users(id) on delete set null",
    "technical_ready",
    "needs_recapture",
    "not_suitable_for_comparison",
  ],
  "backend/self-hosted/db/migrations/0062_stage5h_calibrated_viewer_reviewer_workflow.sql": [
    "reviewer_workflow_status text not null default 'technical_gate_blocked'",
    "reviewer_workflow_reasons jsonb not null default '[]'::jsonb",
    "reviewer_workflow_by_user_id uuid references app_users(id) on delete set null",
    "technical_gate_blocked",
    "reviewer_accepted",
    "reviewer_rejected",
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
    "buildGetLesionLongitudinalQaSql",
    "buildGetVisitLongitudinalDatasetValidationSql",
    "buildGetProtectedLesionImageAssetSql",
    "buildGetLesionCaptureMetadataSql",
    "buildUpsertAssetCaptureMetadataSql",
    "buildUpsertLesionComparisonViewerQaSql",
    "buildReviewLesionComparisonViewerQaSql",
    "buildReviewLesionComparisonViewerQaReviewerWorkflowSql",
    "buildGetVisitLesionComparisonViewerQaReviewQueueSql",
    "getLesionLongitudinalHistory",
    "getLesionLongitudinalQa",
    "getVisitLongitudinalDatasetValidation",
    "getProtectedLesionImageAsset",
    "getLesionCaptureMetadata",
    "upsertAssetCaptureMetadata",
    "upsertLesionComparisonViewerQa",
    "reviewLesionComparisonViewerQa",
    "reviewLesionComparisonViewerQaReviewerWorkflow",
    "getVisitLesionComparisonViewerQaReviewQueue",
    "lesion_comparison_decision_drafts",
    "clinical_asset_capture_metadata",
    "lesion_comparison_viewer_qa_drafts",
    "patient_delivery_allowed",
    "rawImageBytesExposed",
  ],
  "backend/self-hosted/clinical-workspace-service.mjs": [
    "createClinicalWorkspaceService",
    "normalizeAssetCaptureMetadataPayload",
    "normalizeLesionComparisonDraftPayload",
    "normalizeLesionComparisonViewerQaPayload",
    "normalizeLesionComparisonViewerQaReviewPayload",
    "normalizeLesionComparisonViewerQaReviewerWorkflowPayload",
    "lesion_comparison_draft.upsert",
    "clinical_asset_capture_metadata.upsert",
    "lesion_capture_metadata.read",
    "lesion_comparison_viewer_qa.upsert",
    "lesion_comparison_viewer_qa.review",
    "lesion_comparison_viewer_qa.reviewer_workflow",
    "lesion_comparison_viewer_qa.review_queue.read",
    "lesion_longitudinal_qa.read",
    "visit_longitudinal_dataset_validation.read",
    "lesion_longitudinal_history.read",
    "lesion_protected_image.proxy.download",
    "getLesionCaptureMetadata",
    "saveAssetCaptureMetadata",
    "saveLesionComparisonViewerQa",
    "reviewLesionComparisonViewerQa",
    "reviewLesionComparisonViewerQaReviewerWorkflow",
    "getVisitLesionComparisonViewerQaReviewQueue",
    "getVisitLongitudinalDatasetValidation",
    "getLesionLongitudinalHistory",
    "getLesionLongitudinalQa",
    "downloadProtectedLesionImage",
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
    "visitLesionComparisonViewerQaMatch",
    "visitLesionComparisonViewerQaReviewMatch",
    "visitLesionComparisonViewerQaReviewerWorkflowMatch",
    "visitLesionComparisonViewerQaReviewQueueMatch",
    "visitLongitudinalDatasetValidationMatch",
    "lesionLongitudinalQaMatch",
    "visitAssetCaptureMetadataMatch",
    "lesionLongitudinalHistoryMatch",
    "lesionCaptureMetadataMatch",
    "protectedLesionImageRenderMatch",
    "stage: \"5H\"",
  ],
  "backend/self-hosted/openapi.stage5h.json": [
    "5H-clinical-workspace-contracts",
    "/api/v1/visits/{visitId}/assessment",
    "/api/v1/visits/{visitId}/conclusion",
    "/api/v1/visits/{visitId}/report",
    "/api/v1/visits/{visitId}/lesion-comparison-draft",
    "/api/v1/visits/{visitId}/lesion-comparison-viewer-qa",
    "/api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review",
    "/api/v1/visits/{visitId}/lesion-comparison-viewer-qa/reviewer-workflow",
    "/api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review-queue",
    "/api/v1/visits/{visitId}/longitudinal-dataset-validation",
    "/api/v1/visits/{visitId}/assets/{assetId}/capture-metadata",
    "/api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history",
    "/api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-qa",
    "/api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata",
    "/api/v1/patients/{patientId}/lesions/{lesionId}/images/{assetId}/render",
    "LesionComparisonDecisionDraft",
    "LesionComparisonViewerQaDraft",
    "LesionComparisonViewerQaReview",
    "LesionComparisonViewerQaReviewerWorkflow",
    "LesionComparisonViewerQaReviewQueue",
    "VisitLongitudinalDatasetValidation",
    "LesionLongitudinalQa",
    "LesionCaptureMetadata",
    "LesionLongitudinalHistory",
    "Protected image bytes streamed by the backend proxy",
    "rawImageBytesExposed",
  ],
  "src/lib/mock-data.ts": [
    "PROTECTED_RENDER_QA_IDS",
    "CALIBRATED_VIEWER_QA_IDS",
    "DP-QA-PROXY",
    "DP-QA-CAL",
    "QA protected proxy",
    "QA calibrated viewer",
    "mock://images/protected-render-qa",
    "mock://images/calibrated-viewer-qa",
  ],
  "src/lib/self-hosted-clinical-workspace-api.ts": [
    "getSelfHostedVisitAssessment",
    "updateSelfHostedVisitAssessment",
    "getSelfHostedVisitConclusion",
    "updateSelfHostedVisitConclusion",
    "getSelfHostedVisitReport",
    "updateSelfHostedVisitReportContract",
    "saveSelfHostedLesionComparisonDraft",
    "saveSelfHostedAssetCaptureMetadata",
    "getSelfHostedLesionCaptureMetadata",
    "saveSelfHostedLesionComparisonViewerQa",
    "reviewSelfHostedLesionComparisonViewerQa",
    "reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow",
    "getSelfHostedVisitLesionComparisonViewerQaReviewQueue",
    "getSelfHostedVisitLongitudinalDatasetValidation",
    "getSelfHostedLesionLongitudinalHistory",
    "getSelfHostedLesionLongitudinalQa",
    "downloadSelfHostedProtectedLesionImage",
    "SelfHostedLesionLongitudinalHistoryDTO",
    "SelfHostedLesionLongitudinalQaDTO",
    "SelfHostedVisitLongitudinalDatasetValidationDTO",
    "SelfHostedLesionCaptureMetadataDTO",
    "SelfHostedLesionComparisonViewerQaDTO",
    "SelfHostedLesionComparisonViewerQaReviewQueueDTO",
    "LesionComparisonViewerQaReviewPayload",
    "LesionComparisonViewerQaReviewerWorkflowPayload",
    "SelfHostedProtectedLesionImageDTO",
  ],
  "src/pages/doctor/LesionDetailPage.tsx": [
    "saveSelfHostedLesionComparisonDraft",
    "saveSelfHostedLesionComparisonViewerQa",
    "reviewSelfHostedLesionComparisonViewerQa",
    "reviewSelfHostedLesionComparisonViewerQaReviewerWorkflow",
    "downloadSelfHostedProtectedLesionImage",
    "Защищённые превью врача",
    "Подготовить защищённые превью",
    "Готовность protected rendering",
    "Production UUID",
    "Контроль условий съёмки",
    "Техническая геометрия",
    "Калибровка viewer",
    "Технический review viewer QA",
    "Clinical-grade reviewer workflow",
    "Reviewer workflow сохранён в self-hosted backend",
    "Reviewer gate:",
    "Готовность продольного QA",
    "Динамика заблокирована",
    "Не создаёт вывод о динамике",
    "Viewer QA review сохранён в self-hosted backend",
    "Решение техническое: не диагноз, не динамика, не измерение",
    "Координаты нормализованы: проценты кадра",
    "Viewer QA сохранён в self-hosted backend",
    "Измерения в мм недоступны",
    "Не используйте маркеры как размер очага",
    "Не является клинической оценкой динамики",
    "Backend audit сохранён",
    "backend audit: только self-hosted metadata",
    "Выдача пациенту: выключена",
  ],
  "src/pages/doctor/LesionDetailPage.test.tsx": [
    "saves the comparison draft to self-hosted backend",
    "loads protected previews from the production UUID QA fixture through backend proxy",
    "shows capture-condition QA details without clinical conclusions",
    "marks same-device QA UUID previews as technically repeatable",
    "supports normalized technical geometry markers without medical measurement",
    "shows calibration readiness gates without enabling measurements",
    "saves technical marker and calibration QA to self-hosted backend without patient delivery",
    "persists a technical viewer QA review after saving metadata-only viewer QA",
    "accepts clinical-grade reviewer workflow only after calibrated technical review gates",
    "shows a longitudinal QA gate before dynamic interpretation",
    "loads production longitudinal QA gate from self-hosted backend without protected identifiers",
    "keeps QA UUID viewer non-calibrated until a scale marker exists",
    "Готовность protected rendering",
    "Контроль условий съёмки",
    "Техническая геометрия",
    "Калибровка viewer",
    "/lesion-comparison-draft",
    "/lesion-comparison-viewer-qa",
    "/lesion-comparison-viewer-qa/review",
    "/lesion-comparison-viewer-qa/reviewer-workflow",
    "Backend audit сохранён",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "ProductionClinicalWorkspacePanel",
    "Self-hosted assessment contract",
    "Self-hosted conclusion contract",
    "Self-hosted report contract",
    "Очередь viewer QA",
    "Готовность timeline QA",
    "Production dataset validation",
    "Динамический вывод: выключен",
    "Технический контур сравнения",
    "Выдача пациенту: выключена",
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
    "PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa",
    "PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review",
    "PATCH /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/reviewer-workflow",
    "GET /api/v1/visits/{visitId}/lesion-comparison-viewer-qa/review-queue",
    "GET /api/v1/visits/{visitId}/longitudinal-dataset-validation",
    "GET /api/v1/patients/{patientId}/lesions/{lesionId}/capture-metadata",
    "PATCH /api/v1/visits/{visitId}/assets/{assetId}/capture-metadata",
    "GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-history",
    "GET /api/v1/patients/{patientId}/lesions/{lesionId}/longitudinal-qa",
    "GET /api/v1/patients/{patientId}/lesions/{lesionId}/images/{assetId}/render",
    "lesion_comparison_draft.upsert",
    "clinical_asset_capture_metadata.upsert",
    "lesion_capture_metadata.read",
    "lesion_comparison_viewer_qa.upsert",
    "lesion_comparison_viewer_qa.review",
    "lesion_comparison_viewer_qa.reviewer_workflow",
    "lesion_comparison_viewer_qa.review_queue.read",
    "visit_longitudinal_dataset_validation.read",
    "lesion_longitudinal_history.read",
    "lesion_longitudinal_qa.read",
    "lesion_protected_image.proxy.download",
    "Batch BB",
    "Batch BC",
    "Batch BD",
    "Batch BE",
    "Batch BF",
    "Batch BG",
    "Batch BH",
    "Batch BJ",
    "Batch BA",
    "Batch AZ",
    "Batch AY",
    "Batch AX",
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
