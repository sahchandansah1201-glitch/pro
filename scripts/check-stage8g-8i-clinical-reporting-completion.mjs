#!/usr/bin/env node
// Stage 8G-8I · clinical reporting completion drift guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_FILES = [
  "backend/self-hosted/clinical-report-package-repository.mjs",
  "backend/self-hosted/clinical-report-package-repository.test.mjs",
  "backend/self-hosted/clinical-report-package-service.mjs",
  "backend/self-hosted/clinical-report-package-service.test.mjs",
  "backend/self-hosted/openapi.stage8g-8i.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/routes.test.mjs",
  "src/lib/self-hosted-clinical-report-package-api.ts",
  "src/lib/self-hosted-clinical-report-package-api.test.ts",
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "src/pages/doctor/VisitWorkspacePage.test.tsx",
  "deploy/self-hosted/nginx.stage4a.conf",
  "docs/backend/stage-8g-8i-clinical-reporting-completion.md",
  ".github/workflows/stage8g-8i-clinical-reporting-completion.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/clinical-report-package-repository.mjs": [
    "buildGetClinicalReportPackageSql",
    "createClinicalReportPackageRepository",
    "clinical_assessments",
    "clinical_conclusions",
    "patient_safe_text_present",
    "patientPhotoProtocol",
    "self_hosted_photo_delivery_contract_missing",
    "externalRuntimeCalls: false",
    "managedRuntimeDependency: \"none\"",
  ],
  "backend/self-hosted/clinical-report-package-service.mjs": [
    "createClinicalReportPackageService",
    "visitReadScope",
    "clinical_report.package.read",
    "missingCount",
    "patientPhotoProtocolStatus",
  ],
  "backend/self-hosted/openapi.stage8g-8i.json": [
    "8G-8I-clinical-reporting-completion",
    "/api/v1/visits/{visitId}/report-package",
    "ClinicalReportPackage",
    "patientPhotoProtocol",
    "managedRuntimeDependency",
  ],
  "backend/self-hosted/routes.mjs": [
    "OPENAPI_8G_8I",
    "clinicalReportPackageService",
    "/api/v1/visits/{visitId}/report-package",
    "stage: \"8G-8I\"",
    "openapiStage8G8I",
  ],
  "src/lib/self-hosted-clinical-report-package-api.ts": [
    "getSelfHostedClinicalReportPackage",
    "toSelfHostedClinicalReportPackage",
    "clinicalReportMissingLabel",
    "patientPhotoProtocol",
    "/api/v1/visits/",
    "/report-package",
  ],
  "src/pages/doctor/VisitWorkspacePage.tsx": [
    "Clinical report completion",
    "Stage 8G-8I",
    "getSelfHostedClinicalReportPackage",
    "clinicalReportMissingLabel",
    "local PostgreSQL only",
    "Фото-протокол",
  ],
  "docs/backend/stage-8g-8i-clinical-reporting-completion.md": [
    "Stage 8G-8I",
    "Clinical reporting completion",
    "patientPhotoProtocol",
    "self_hosted_photo_delivery_contract_missing",
    "npm run preflight:stage8g-8i",
    "Managed runtime/database dependency: none",
    "/api/v1/visits/{visitId}/report-package",
  ],
  ".github/workflows/stage8g-8i-clinical-reporting-completion.yml": [
    "name: stage8g-8i-clinical-reporting-completion",
    "npm run preflight:stage8g-8i",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROJECT_MEMORY_REQUIRED_TEXT = {
  "docs/project-memory/PROJECT_STATE.yaml": [
    "stage8g_8i_preflight",
    "clinical_report_package_confirmed: true",
    "report_readiness_gate_confirmed: true",
    "command: \"npm run preflight:stage8g-8i\"",
    "Stage 8J-8L",
  ],
  "docs/project-memory/HANDOFF.md": [
    "Stage 8G-8I",
    "Clinical reporting completion",
    "Stage 8J-8L",
  ],
  "docs/project-memory/NEXT_ACTIONS.md": [
    "Stage 8G-8I",
    "Stage 8J-8L",
    "hypothesis",
  ],
  "docs/project-memory/WORKLOG.md": [
    "Stage 8G-8I",
    "Clinical reporting completion",
    "report package",
  ],
  "docs/project-memory/RISKS.md": [
    "Stage 8G-8I",
    "Stage 8J-8L",
    "hypothesis",
  ],
  "docs/project-memory/ARTIFACTS.md": [
    "clinical-report-package-repository.mjs",
    "self-hosted-clinical-report-package-api.ts",
    "stage-8g-8i-clinical-reporting-completion.md",
  ],
};

const PROTECTED_FILES = [
  "backend/self-hosted/clinical-report-package-repository.mjs",
  "backend/self-hosted/clinical-report-package-service.mjs",
  "backend/self-hosted/openapi.stage8g-8i.json",
  "src/lib/self-hosted-clinical-report-package-api.ts",
  "src/pages/doctor/VisitWorkspacePage.tsx",
  "docs/backend/stage-8g-8i-clinical-reporting-completion.md",
];

const FORBIDDEN = [
  /\bapi-read\b/i,
  /\bapi-write\b/i,
  /edge function/i,
  /SUPABASE_/i,
  /navigator\.(usb|bluetooth|serial)/i,
  /storage_object_path/i,
  /signed_url/i,
  /access_token/i,
  /object_bucket/i,
  /object_key/i,
];

function read(root, file) {
  return readFileSync(join(root, file), "utf8");
}

export function checkStage8G8I(root = process.cwd()) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, markers] of Object.entries(REQUIRED_TEXT)) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing marker: ${marker}`);
    }
  }
  for (const [file, markers] of Object.entries(PROJECT_MEMORY_REQUIRED_TEXT)) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing project-memory file: ${file}`);
      continue;
    }
    const text = read(root, file);
    for (const marker of markers) {
      if (!text.includes(marker)) errors.push(`${file} missing project-memory marker: ${marker}`);
    }
  }
  for (const file of PROTECTED_FILES) {
    if (!existsSync(join(root, file))) continue;
    const text = read(root, file);
    for (const pattern of FORBIDDEN) {
      if (pattern.test(text)) errors.push(`${file} contains forbidden runtime marker: ${pattern}`);
    }
  }
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = checkStage8G8I(process.cwd());
  if (!result.ok) {
    console.error("[stage8g-8i-clinical-reporting-completion] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`[stage8g-8i-clinical-reporting-completion] OK (${result.checkedFiles} files checked)`);
}
