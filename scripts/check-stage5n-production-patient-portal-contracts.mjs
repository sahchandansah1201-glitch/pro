#!/usr/bin/env node
// Stage 5N · production patient portal contracts guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "backend/self-hosted/db/migrations/0017_stage5n_patient_portal_contracts.sql",
  "backend/self-hosted/patient-portal-repository.mjs",
  "backend/self-hosted/patient-portal-service.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-repository.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-service.mjs",
  "backend/self-hosted/patient-portal-repository.test.mjs",
  "backend/self-hosted/patient-portal-service.test.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-repository.test.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-service.test.mjs",
  "backend/self-hosted/openapi.stage5n.json",
  "backend/self-hosted/routes.mjs",
  "backend/self-hosted/rbac.mjs",
  "deploy/self-hosted/nginx.stage4a.conf",
  "src/lib/self-hosted-patient-portal-api.ts",
  "src/lib/self-hosted-patient-portal-api.test.ts",
  "src/pages/patient/MeHomePage.tsx",
  "src/pages/patient/MeHomePageDemo.tsx",
  "src/pages/patient/MeHomePageLive.tsx",
  "src/pages/patient/MeHistoryPage.tsx",
  "src/pages/patient/MeHistoryPageDemo.tsx",
  "src/pages/patient/MeHistoryPageLive.tsx",
  "src/pages/patient/MeReportsPage.tsx",
  "src/pages/patient/MeReportsPageDemo.tsx",
  "src/pages/patient/MeReportsPageLive.tsx",
  "src/pages/patient/MeReportPage.tsx",
  "src/pages/patient/MeReportPageDemo.tsx",
  "src/pages/patient/MeReportPageLive.tsx",
  "src/pages/patient/MeBookingPage.tsx",
  "src/pages/patient/MeBookingPageDemo.tsx",
  "src/pages/patient/MeBookingPageLive.tsx",
  "src/pages/patient/MeRemindersPage.tsx",
  "src/pages/patient/MeRemindersPageDemo.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
  "src/pages/patient/MePages.production.test.tsx",
  "docs/backend/stage-5n-production-patient-portal-contracts.md",
  "scripts/check-stage5n-production-patient-portal-contracts.mjs",
  "scripts/check-stage5n-production-patient-portal-contracts.test.mjs",
  ".github/workflows/stage5n-production-patient-portal-contracts.yml",
];

const REQUIRED_TEXT = {
  "backend/self-hosted/db/migrations/0017_stage5n_patient_portal_contracts.sql": [
    "alter type app_role add value if not exists 'patient'",
    "create table if not exists patient_user_links",
  ],
  "backend/self-hosted/patient-portal-repository.mjs": [
    "patient_user_links",
    "patient_safe_text",
    "buildPatientPortalOverviewSql",
    "buildPatientPortalReportSql",
    "buildPatientPortalPhotoProtocolSql",
    "patient_photo_protocol_releases",
    "patientDeliveryAllowed",
    "auditTrail",
  ],
  "backend/self-hosted/patient-portal-service.mjs": [
    "patientPortalScope",
    "patient_portal.overview.read",
    "patient_portal.report.read",
    "patient_portal.photo_protocol.read",
  ],
  "backend/self-hosted/patient-photo-protocol-delivery-repository.mjs": [
    "buildGetPatientPhotoProtocolDeliveryAssetSql",
    "patient_user_links",
    "patient_photo_protocol_releases",
    "patientFileProxyEnabled",
    "object_bucket",
  ],
  "backend/self-hosted/patient-photo-protocol-delivery-service.mjs": [
    "patientPortalScope",
    "patient_portal.photo_protocol.proxy.download",
    "patient_portal.photo_protocol.proxy.denied",
    "signedUrlsIssued: false",
    "storagePathsExposed: false",
  ],
  "backend/self-hosted/routes.mjs": [
    "/api/v1/me/portal",
    "/api/v1/me/history",
    "/api/v1/me/reports",
    "/api/v1/me/photo-protocols",
    "patientPortalPhotoProxyMatch",
    "OPENAPI_5N",
    "stage: \"5N\"",
  ],
  "backend/self-hosted/openapi.stage5n.json": [
    "5N-patient-portal",
    "/api/v1/me/portal",
    "/api/v1/me/history",
    "/api/v1/me/reports/{reportId}",
    "/api/v1/me/photo-protocols/{visitId}",
    "/api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download",
    "PatientPortalPhotoProtocol",
    "PatientPortalHistory",
    "auditTrail",
  ],
  "src/lib/self-hosted-patient-portal-api.ts": [
    "fetchSelfHostedPatientPortal",
    "fetchSelfHostedPatientPortalHistory",
    "fetchSelfHostedPatientPortalReport",
    "fetchSelfHostedPatientPortalPhotoProtocol",
    "fetchSelfHostedPatientPortalPhotoProtocolPhoto",
    "/api/v1/me/portal",
    "/api/v1/me/history",
    "/api/v1/me/reports/",
    "/api/v1/me/photo-protocols/",
    "/photos/",
    "Accept: \"image/*\"",
  ],
  "src/pages/patient/MeHomePage.tsx": [
    "isProductionAppMode",
    "MeHomePageLive",
    "MeHomePageDemo",
  ],
  "src/pages/patient/MeHomePageLive.tsx": [
    "Production portal подключён",
    "/api/v1/me/portal",
  ],
  "src/pages/patient/MeHistoryPageLive.tsx": [
    "fetchSelfHostedPatientPortalHistory",
    "Очаги под наблюдением",
    "Хронология визитов",
    "Контур политики доступа к фото",
  ],
  "src/pages/patient/MeReportsPageLive.tsx": [
    "patient-safe reports",
    "usePatientPortalOverview",
  ],
  "src/pages/patient/MeReportPageLive.tsx": [
    "fetchSelfHostedPatientPortalReport",
    "fetchSelfHostedPatientPortalPhotoProtocolPhoto",
    "Подготовить фото",
    "Открыть фото",
    "Отзыв и журнал доступа",
    "URL.createObjectURL",
    "Врачебная версия заключения не отображается",
  ],
  "src/pages/patient/MeBookingPageLive.tsx": [
    "Самозапись пациента",
    "Отправить запрос",
  ],
  "src/pages/patient/MeRemindersPageLive.tsx": [
    "self-hosted reminder preferences",
    "usePatientPortalOverview",
  ],
  "docs/backend/stage-5n-production-patient-portal-contracts.md": [
    "Stage 5N",
    "npm run preflight:stage5n",
    "managed runtime/database: none",
    "/api/v1/me/history",
    "/api/v1/me/photo-protocols/{visitId}",
    "/api/v1/me/photo-protocols/{visitId}/photos/{sequence}/download",
    "Patient-visible photo controls",
    "Batch V",
    "Отзыв и журнал доступа",
  ],
  ".github/workflows/stage5n-production-patient-portal-contracts.yml": [
    "name: stage5n-production-patient-portal-contracts",
    "npm run preflight:stage5n",
    "GITHUB_STEP_SUMMARY",
  ],
};

const PROTECTED_RUNTIME_FILES = [
  "backend/self-hosted/patient-portal-repository.mjs",
  "backend/self-hosted/patient-portal-service.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-repository.mjs",
  "backend/self-hosted/patient-photo-protocol-delivery-service.mjs",
  "backend/self-hosted/openapi.stage5n.json",
  "src/lib/self-hosted-patient-portal-api.ts",
  "src/pages/patient/MeHomePage.tsx",
  "src/pages/patient/MeHomePageLive.tsx",
  "src/pages/patient/MeHistoryPage.tsx",
  "src/pages/patient/MeHistoryPageLive.tsx",
  "src/pages/patient/MeReportsPage.tsx",
  "src/pages/patient/MeReportsPageLive.tsx",
  "src/pages/patient/MeReportPage.tsx",
  "src/pages/patient/MeReportPageLive.tsx",
  "src/pages/patient/MeBookingPage.tsx",
  "src/pages/patient/MeBookingPageLive.tsx",
  "src/pages/patient/MeRemindersPage.tsx",
  "src/pages/patient/MeRemindersPageLive.tsx",
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
  /\bmock-data\b/i,
  /\bpatient-data\b/i,
  /\bphysician_text\b/i,
  /\bphysicianText\b/i,
  /\bdoctorVersionText\b/i,
  /\bcrm\b/i,
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
  for (const script of ['"test:stage5n"', '"check:stage5n"', '"preflight:stage5n"']) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 5N production patient portal contracts preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 5N production patient portal contracts preflight");
  }
}

export function collectStage5NChecks({ root = process.cwd() } = {}) {
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
  const result = collectStage5NChecks();
  if (!result.ok) {
    console.error("[stage5n-production-patient-portal-contracts] FAILED");
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  console.log(`[stage5n-production-patient-portal-contracts] OK (${result.checkedFiles} files checked)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
