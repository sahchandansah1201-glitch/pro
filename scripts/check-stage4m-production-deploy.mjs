#!/usr/bin/env node
// Stage 4M · Production deployment verification guard.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_FILES = [
  "scripts/stage4m-production-deploy-verify.mjs",
  "scripts/stage4m-production-deploy-verify.test.mjs",
  "scripts/stage4m-production-deploy-status.mjs",
  "scripts/stage4m-production-deploy-status.test.mjs",
  "scripts/stage4m-self-hosted-schema-migrations.mjs",
  "scripts/stage4m-self-hosted-schema-migrations.test.mjs",
  "backend/self-hosted/db/migrations/0090_stage6_service_keys.sql",
  "scripts/stage4m-admin-management-db-smoke.mjs",
  "scripts/stage4m-admin-management-db-smoke.test.mjs",
  "scripts/stage4m-doctor-lead-db-smoke.mjs",
  "scripts/stage4m-doctor-lead-db-smoke.test.mjs",
  "scripts/stage4m-doctor-patient-db-smoke.mjs",
  "scripts/stage4m-doctor-patient-db-smoke.test.mjs",
  "scripts/stage4m-doctor-visit-report-db-smoke.mjs",
  "scripts/stage4m-doctor-visit-report-db-smoke.test.mjs",
  "scripts/stage4m-assistant-capture-db-smoke.mjs",
  "scripts/stage4m-assistant-capture-db-smoke.test.mjs",
  "scripts/stage4m-patient-portal-db-smoke.mjs",
  "scripts/stage4m-patient-portal-db-smoke.test.mjs",
  "scripts/stage4m-admin-management-api-smoke.mjs",
  "scripts/stage4m-admin-management-api-smoke.test.mjs",
  "scripts/run-production-admin-management-live-e2e.mjs",
  "scripts/run-production-admin-management-live-e2e.test.mjs",
  "scripts/run-production-doctor-workspace-live-e2e.mjs",
  "scripts/run-production-doctor-workspace-live-e2e.test.mjs",
  "scripts/run-production-assistant-workspace-live-e2e.mjs",
  "scripts/run-production-assistant-workspace-live-e2e.test.mjs",
  "scripts/run-production-operator-workspace-live-e2e.mjs",
  "scripts/run-production-operator-workspace-live-e2e.test.mjs",
  "scripts/run-production-patient-portal-live-e2e.mjs",
  "scripts/run-production-patient-portal-live-e2e.test.mjs",
  "e2e/live-admin-test-helpers.ts",
  "e2e/production-admin-management-live.pw.ts",
  "e2e/production-doctor-workspace-live.pw.ts",
  "e2e/production-assistant-workspace-live.pw.ts",
  "e2e/production-operator-workspace-live.pw.ts",
  "e2e/production-patient-portal-live.pw.ts",
  "src/pages/doctor/DoctorReportsPage.tsx",
  "src/pages/doctor/DoctorReportsPageLive.tsx",
  "scripts/check-stage4m-production-deploy.mjs",
  "scripts/check-stage4m-production-deploy.test.mjs",
  "docs/backend/stage-4m-production-deployment-verification.md",
  ".github/workflows/stage4m-production-deployment-verification.yml",
  "deploy/self-hosted/.env.production.example",
  "deploy/self-hosted/update-production.sh",
  "deploy/self-hosted/docker-compose.production.example.yml",
  "scripts/stage4l-self-hosted-ops.mjs",
  "scripts/stage4k-self-hosted-compose-smoke.mjs",
];

const REQUIRED_TEXT = {
  "scripts/stage4m-production-deploy-verify.mjs": [
    "first-boot",
    "post-deploy",
    "backup-after-deploy",
    "rollback-drill",
    "update",
    "VITE_APP_MODE",
    "VITE_SELF_HOSTED_API_BASE_URL",
    "safeFrontendBuild",
    "dist/index.html",
    "stage4m-production-deploy-receipt/v1",
    "latestSummaryPath",
    "latestStatusPath",
    "Git HEAD before",
    "START",
    "FAIL",
    "Apply production schema migrations",
    "stage4m-self-hosted-schema-migrations.mjs",
    "Verify admin clinic create/edit database journey",
    "stage4m-admin-management-db-smoke.mjs",
    "Verify doctor lead create/update/book database journey",
    "stage4m-doctor-lead-db-smoke.mjs",
    "Verify doctor patient create/edit/archive database journey",
    "stage4m-doctor-patient-db-smoke.mjs",
    "Verify doctor visit/report database journey",
    "stage4m-doctor-visit-report-db-smoke.mjs",
    "Verify assistant capture asset database journey",
    "stage4m-assistant-capture-db-smoke.mjs",
    "Verify patient portal booking/reminder database journey",
    "stage4m-patient-portal-db-smoke.mjs",
    "--retry-all-errors",
    "--retry-delay",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
    "smoke:stage4k",
    "ops:stage4l:verify-env",
    "docker-compose.production.example.yml",
  ],
  "scripts/stage4m-production-deploy-status.mjs": [
    "Stage 4M deployment status",
    "update-production-status.json",
    "Git HEAD after",
    "stage4m-production-deploy-receipt/v1",
  ],
  "scripts/stage4m-self-hosted-schema-migrations.mjs": [
    "0086_stage6_admin_management.sql",
    "0087_stage6_clinic_address.sql",
    "0088_stage6_admin_lifecycle.sql",
    "0090_stage6_service_keys.sql",
    "private_doctor",
    "clinicAddressColumn",
    "clinics.address column",
    "clinicStatusColumn",
    "clinics.status column",
    "clinicDeletedAtColumn",
    "clinics.deleted_at column",
    "userRoleDisabledAtColumn",
    "user_roles.disabled_at column",
    "serviceApiKeysTable",
    "service_api_keys table",
    "No raw tokens, passwords, patient names, object keys, or storage paths are printed.",
  ],
  "scripts/stage4m-admin-management-db-smoke.mjs": [
    "stage4m_admin_management_db_smoke_ok",
    "admin clinic create did not persist the clinic row",
    "admin clinic list did not include the created clinic",
    "admin clinic update did not persist editable fields",
    "rollback;",
  ],
  "scripts/stage4m-doctor-lead-db-smoke.mjs": [
    "stage4m_doctor_lead_db_smoke_ok",
    "doctor lead create did not return the created lead",
    "doctor lead status update did not return qualified status",
    "doctor lead booking did not return booked lead and appointment",
    "buildCreateLeadSql",
    "buildUpdateLeadStatusSql",
    "buildBookLeadAppointmentSql",
    "rollback;",
  ],
  "scripts/stage4m-doctor-patient-db-smoke.mjs": [
    "stage4m_doctor_patient_db_smoke_ok",
    "doctor patient create did not return the created patient",
    "doctor patient update did not return updated patient",
    "doctor patient archive did not return archived patient",
    "buildCreatePatientSql",
    "buildUpdatePatientSql",
    "buildArchivePatientSql",
    "rollback;",
  ],
  "scripts/stage4m-doctor-visit-report-db-smoke.mjs": [
    "stage4m_doctor_visit_report_db_smoke_ok",
    "doctor visit schedule did not return the fixture visit",
    "doctor visit detail did not return the fixture visit",
    "doctor visit report did not return the fixture report",
    "doctor report package did not return report readiness",
    "buildVisitScheduleSql",
    "buildGetVisitSql",
    "buildGetVisitReportSql",
    "buildGetClinicalReportPackageSql",
    "rollback;",
  ],
  "scripts/stage4m-assistant-capture-db-smoke.mjs": [
    "stage4m_assistant_capture_db_smoke_ok",
    "assistant capture asset create did not return dermoscopy asset",
    "assistant capture asset create did not preserve assistant uploader",
    "assistant capture asset safe DTO exposed object storage details",
    "buildCreateVisitAssetSql",
    "rollback;",
  ],
  "scripts/stage4m-patient-portal-db-smoke.mjs": [
    "stage4m_patient_portal_db_smoke_ok",
    "patient portal overview did not return the linked patient",
    "patient portal booking request did not return requested booking",
    "patient portal reminder preferences did not return saved preferences",
    "buildPatientPortalOverviewSql",
    "buildCreatePatientPortalBookingRequestSql",
    "buildUpdatePatientPortalReminderPreferencesSql",
    "rollback;",
  ],
  "scripts/stage4m-admin-management-api-smoke.mjs": [
    "I_CONFIRM_CREATE_TEST_CLINIC",
    "assertDeployReadyForStage4MMutation",
    "Stage 4M deployment is still running",
    "/api/v1/auth/login",
    "/api/v1/admin/clinics",
    "createdClinicVisibleInList",
    "updatedClinicVisibleInList",
    "redactSecrets",
  ],
  "scripts/run-production-admin-management-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-admin-management-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Stage 4M deployment is still running",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_ADMIN_BASE_URL",
    "STAGE4M_ADMIN_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-doctor-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-doctor-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_DOCTOR_BASE_URL",
    "STAGE4M_DOCTOR_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-assistant-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-assistant-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_ASSISTANT_BASE_URL",
    "STAGE4M_ASSISTANT_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-operator-workspace-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-operator-workspace-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_OPERATOR_BASE_URL",
    "STAGE4M_OPERATOR_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "scripts/run-production-patient-portal-live-e2e.mjs": [
    "CREATE_TEST_CLINIC_CONFIRMATION",
    "production-patient-portal-live.pw.ts",
    "deployStatusBlocksLiveE2E",
    "Local dependency @playwright/test is missing",
    "STAGE4M_LIVE_PATIENT_BASE_URL",
    "STAGE4M_PATIENT_SETUP_CREDENTIALS_FILE",
    "STAGE4M_CONFIRM_CREATE_TEST_CLINIC",
    "Credentials file not found",
  ],
  "e2e/production-admin-management-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "Адрес системы клиники",
    "Клиники и кабинеты",
    "Создать клинику",
    "Клиника сохранена и добавлена в список",
    "Редактирование клиники",
    "Сохранить изменения",
    "Invalid or expired authorization token",
    "Database is unavailable",
    "live-admin-clinics-desktop-1280.png",
    "live-admin-clinics-mobile-390.png",
    "Служебные ключи",
    "/api/v1/admin/service-keys",
    "live-admin-api-keys-desktop-1280.png",
    "live-admin-api-keys-mobile-390.png",
    "Справка",
    "Поиск по разделам справки",
    "live-admin-help-desktop-1280.png",
    "live-admin-help-mobile-390.png",
  ],
  "e2e/production-doctor-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Рабочий стол",
    "Клиники и кабинеты",
    "Врачи",
    "Добавить врача",
    "/api/v1/admin/private-practices",
    "Создать кабинет и владельца",
    "Центр частной практики",
    "/api/v1/doctor/dashboard",
    "/api/v1/leads/appointments",
    "/api/v1/leads",
    "Краткое описание заявки",
    "Добавить заявку",
    "/api/v1/patients",
    "Новый пациент",
    "Создать пациента",
    "Сохранить изменения",
    "Архивировать",
    "live-doctor-desk-desktop-1280.png",
    "live-doctor-desk-mobile-390.png",
    "live-doctor-patients-desktop-1280.png",
    "live-doctor-patients-mobile-390.png",
    "Визиты",
    "Отчёты",
    "Поиск отчётов",
    "/report",
    "/report-package",
    "live-doctor-visits-desktop-1280.png",
    "live-doctor-visits-mobile-390.png",
    "live-doctor-reports-desktop-1280.png",
    "live-doctor-reports-mobile-390.png",
    "live-private-doctor-practice-desktop-1280.png",
    "live-private-doctor-practice-mobile-390.png",
  ],
  "src/pages/doctor/DoctorReportsPage.tsx": [
    "isProductionAppMode",
    "DoctorReportsPageDemo",
    "DoctorReportsPageLive",
  ],
  "src/pages/doctor/DoctorReportsPageLive.tsx": [
    "listSelfHostedVisits",
    "Источник данных: система клиники.",
    "Открыть отчёт в визите",
    "Поиск отчётов",
  ],
  "e2e/production-assistant-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Ассистент",
    "Захват фото",
    "Съёмка",
    "/api/v1/visits",
    "/assets",
    "Файл снимка",
    "Сохранить снимок",
    "Снимок сохранён в системе клиники",
    "live-assistant-capture-desktop-1280.png",
    "live-assistant-capture-mobile-390.png",
    "live-assistant-patients-desktop-1280.png",
  ],
  "e2e/production-operator-workspace-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Консоль оператора",
    "Запросы на запись",
    "Сотрудники и доступ",
    "Создать сотрудника",
    "/api/v1/leads/appointments",
    "/api/v1/leads",
    "/api/v1/clinic/booking-requests",
    "/api/v1/integrations/booking-imports",
    "/api/v1/integrations/booking-imports/status",
    "/api/v1/clinic/available-slots",
    "Краткое описание заявки",
    "Создать заявку",
    "live-operator-console-desktop-1280.png",
    "live-operator-console-mobile-390.png",
    "live-operator-booking-requests-desktop-1280.png",
    "live-operator-booking-requests-mobile-390.png",
  ],
  "e2e/production-patient-portal-live.pw.ts": [
    "/self-hosted/login",
    'from "./live-admin-test-helpers"',
    "appMain",
    "bannerText",
    "mainText",
    "pageHeaderText",
    "expectMainTapTargets",
    "expectNoHorizontalOverflow",
    "sidebarLink",
    "sidebarLinks",
    "Личный кабинет",
    "История очагов",
    "Запись на приём",
    "/api/v1/me/portal",
    "/api/v1/me/history",
    "/api/v1/me/booking-requests",
    "Причина запроса на запись",
    "Отправить запрос",
    "live-patient-home-desktop-1280.png",
    "live-patient-home-mobile-390.png",
    "live-patient-history-desktop-1280.png",
    "live-patient-booking-desktop-1280.png",
    "live-patient-booking-mobile-390.png",
  ],
  "e2e/live-admin-test-helpers.ts": [
    "export function appMain(page: Page)",
    'return page.locator("main").first();',
    "export function mainText(page: Page, text: string | RegExp)",
    "return appMain(page).getByText(text).filter({ visible: true }).first();",
    "export function mainLink(page: Page, name: string | RegExp)",
    'return appMain(page).getByRole("link", options).filter({ visible: true }).first();',
    "export function bannerText(page: Page, text: string | RegExp)",
    'return page.getByRole("banner").getByText(text).filter({ visible: true }).first();',
    "export function pageHeaderText(page: Page, title: string, text: string | RegExp)",
    'page.getByRole("heading", { level: 1, name: title })',
    "export function sidebarLink(page: Page, name: string)",
    'data-sidebar="menu-button"',
    "export async function expectNoHorizontalOverflow(page: Page)",
    "export async function expectMainTapTargets(page: Page)",
    "HTMLInputElement",
    "label.getBoundingClientRect()",
    "isBrowserInternalControl",
    'getAttribute("aria-hidden") === "true"',
    "el.tabIndex < 0",
  ],
  "docs/backend/stage-4m-production-deployment-verification.md": [
    "Stage 4M",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:post-deploy:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:self-hosted:update",
    "update-production-status.json",
    "deploys/<run-id>",
    "staging",
    "dist/index.html",
    "retries",
    "deploy:stage4m:rollback-drill:dry-run",
    "ROLLBACK_TO_SELF_HOSTED_BACKUP",
    "e2e:admin-management:live",
    "I_CONFIRM_CREATE_TEST_CLINIC",
  ],
  "deploy/self-hosted/update-production.sh": [
    "flock -n",
    "stage4m-production-deploy-verify.mjs update",
    "BACKUP_ROOT",
    "SUMMARY_PATH",
    "RECEIPT_PATH",
    "LATEST_STATUS_PATH",
  ],
  "deploy/self-hosted/.env.production.example": [
    "VITE_APP_MODE=production",
    "VITE_SELF_HOSTED_API_BASE_URL=https://dermatolog.example.test",
  ],
  ".github/workflows/stage4m-production-deployment-verification.yml": [
    "name: stage4m-production-deployment-verification",
    "npm run preflight:stage4m",
    "deploy:stage4m:first-boot:dry-run",
    "deploy:stage4m:update:dry-run",
    "deploy:stage4m:rollback-drill:dry-run",
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
  "scripts/stage4m-production-deploy-verify.mjs",
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
        errors.push(`${file} contains forbidden managed-runtime coupling: ${pattern}`);
      }
    }
  }
}

export function validateLiveE2EContract(errors, root) {
  const helperImportPattern =
    /import\s*\{(?=[^}]*\bappMain\b)(?=[^}]*\bbannerText\b)(?=[^}]*\bmainText\b)(?=[^}]*\bexpectMainTapTargets\b)(?=[^}]*\bexpectNoHorizontalOverflow\b)(?=[^}]*\bsidebarLink\b)[^}]*\}\s*from\s*["']\.\/live-admin-test-helpers["'];?/s;
  const liveFiles = [
    {
      file: "e2e/production-admin-management-live.pw.ts",
      markers: [
        "Справка",
        "Поиск по разделам справки",
        "live-admin-help-desktop-1280.png",
        "live-admin-help-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-doctor-workspace-live.pw.ts",
      markers: [
        "Рабочий стол",
        "Центр частной практики",
        "/api/v1/admin/private-practices",
        "/api/v1/doctor/dashboard",
        "/api/v1/leads/appointments",
        "/api/v1/patients",
        "Новый пациент",
        "Создать пациента",
        "Сохранить изменения",
        "Архивировать",
        "live-doctor-desk-desktop-1280.png",
        "live-doctor-desk-mobile-390.png",
        "live-doctor-patients-desktop-1280.png",
        "live-doctor-patients-mobile-390.png",
        "Визиты",
        "Отчёты",
        "Поиск отчётов",
        "/report",
        "/report-package",
        "live-doctor-visits-desktop-1280.png",
        "live-doctor-visits-mobile-390.png",
        "live-doctor-reports-desktop-1280.png",
        "live-doctor-reports-mobile-390.png",
        "live-private-doctor-practice-desktop-1280.png",
        "live-private-doctor-practice-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-assistant-workspace-live.pw.ts",
      markers: [
        "Ассистент",
        "Захват фото",
        "Съёмка",
        "/api/v1/visits",
        "/assets",
        "Файл снимка",
        "Сохранить снимок",
        "live-assistant-capture-desktop-1280.png",
        "live-assistant-capture-mobile-390.png",
        "live-assistant-patients-desktop-1280.png",
      ],
    },
    {
      file: "e2e/production-operator-workspace-live.pw.ts",
      markers: [
        "Консоль оператора",
        "Запросы на запись",
        "/api/v1/leads/appointments",
        "/api/v1/leads",
        "/api/v1/clinic/booking-requests",
        "/api/v1/integrations/booking-imports",
        "/api/v1/integrations/booking-imports/status",
        "/api/v1/clinic/available-slots",
        "live-operator-console-desktop-1280.png",
        "live-operator-console-mobile-390.png",
        "live-operator-booking-requests-desktop-1280.png",
        "live-operator-booking-requests-mobile-390.png",
      ],
    },
    {
      file: "e2e/production-patient-portal-live.pw.ts",
      markers: [
        "Личный кабинет",
        "История очагов",
        "Запись на приём",
        "/api/v1/me/portal",
        "/api/v1/me/history",
        "/api/v1/me/booking-requests",
        "Причина запроса на запись",
        "Отправить запрос",
        "live-patient-home-desktop-1280.png",
        "live-patient-home-mobile-390.png",
        "live-patient-history-desktop-1280.png",
        "live-patient-booking-desktop-1280.png",
        "live-patient-booking-mobile-390.png",
      ],
    },
  ];

  for (const { file, markers } of liveFiles) {
    if (!existsSync(join(root, file))) {
      errors.push(`Missing required file: ${file}`);
      continue;
    }

    const content = read(root, file);
    if (!helperImportPattern.test(content)) {
      errors.push(`${file} must import live admin helpers from ./live-admin-test-helpers`);
    }
    for (const helperName of ["appMain", "bannerText", "mainLink", "mainText", "pageHeaderText", "sidebarLink", "expectNoHorizontalOverflow", "expectMainTapTargets"]) {
      const inlineHelperPattern = new RegExp(`(?:async\\s+)?function\\s+${helperName}\\s*\\(`);
      if (inlineHelperPattern.test(content)) {
        errors.push(`${file} defines inline live helper ${helperName}; import it from ./live-admin-test-helpers`);
      }
    }
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (line.includes('page.locator("main")')) {
        errors.push(
          `${file}:${index + 1} uses ambiguous page.locator("main"); use appMain(page) for live safety scans`,
        );
      }
      if (/\.getByRole\(["']link["']/.test(line)) {
        errors.push(
          `${file}:${index + 1} uses direct getByRole("link"); use mainLink(page, ...) or sidebarLink(page, ...)`,
        );
      }
      if (/page\.getByText\(/.test(line)) {
        errors.push(
          `${file}:${index + 1} uses direct page.getByText; use mainText(page, ...), bannerText(page, ...), or a scoped locator`,
        );
      }
    });
    for (const text of markers) {
      if (!content.includes(text)) errors.push(`${file} missing live coverage marker: ${text}`);
    }
  }
}

function validatePackageScripts(errors, root) {
  const packageJson = read(root, "package.json");
  for (const script of [
    '"test:stage4m"',
    '"check:stage4m"',
    '"preflight:stage4m"',
    '"deploy:stage4m:first-boot:dry-run"',
    '"deploy:stage4m:post-deploy:dry-run"',
    '"deploy:stage4m:backup-after-deploy:dry-run"',
    '"deploy:stage4m:update:dry-run"',
    '"deploy:stage4m:status"',
    '"smoke:stage4m:admin-db"',
    '"smoke:stage4m:admin-api"',
    '"e2e:admin-management:live"',
    '"e2e:doctor-workspace:live"',
    '"e2e:assistant-workspace:live"',
    '"e2e:operator-workspace:live"',
    '"e2e:patient-portal:live"',
    '"deploy:self-hosted:update"',
    '"deploy:stage4m:rollback-drill:dry-run"',
  ]) {
    if (!packageJson.includes(script)) errors.push(`package.json missing ${script}`);
  }
  const preflightAll = read(root, "scripts/preflight-all.mjs");
  if (!preflightAll.includes("Stage 4M production deployment verification preflight")) {
    errors.push("scripts/preflight-all.mjs must include Stage 4M production deployment verification preflight");
  }
}

export function collectStage4MChecks({ root = process.cwd() } = {}) {
  const errors = [];
  for (const file of REQUIRED_FILES) {
    if (!existsSync(join(root, file))) errors.push(`Missing required file: ${file}`);
  }
  for (const [file, expected] of Object.entries(REQUIRED_TEXT)) {
    if (existsSync(join(root, file))) requireText(errors, root, file, expected);
    else errors.push(`Missing required file (text check): ${file}`);
  }
  scanRuntimeCoupling(errors, root);
  validateLiveE2EContract(errors, root);
  validatePackageScripts(errors, root);
  return { ok: errors.length === 0, errors, checkedFiles: REQUIRED_FILES.length };
}

export function main() {
  const result = collectStage4MChecks({ root: process.cwd() });
  if (!result.ok) {
    console.error("[check-stage4m-production-deploy] failed:");
    for (const error of result.errors) console.error(`  - ${error}`);
    return 1;
  }
  console.log(
    `[check-stage4m-production-deploy] OK (${result.checkedFiles} files, production deploy verification guardrails verified)`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
